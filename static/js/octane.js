function stdAtmospherePressure(alt_m) {
  // Troposphere ISA, h <= 11 km
  const P0 = 101325;   // Pa
  const T0 = 288.15;   // K
  const g = 9.80665;   // m/s2
  const L = 0.0065;    // K/m
  const R = 287.058;   // J/kgK
  const h = Math.max(0, alt_m || 0);

  const T = T0 - L * h;
  return {
    P: P0 * Math.pow(T / T0, g / (R * L)),
    T
  };
}

// maintenanceState: "Well" or "Poor"
function estimateRequiredOctaneAKI(params, maintenanceState) {
  const {
    compression,
    aspiration,   // "NA" | "Turbo"
    boostBar,     // gauge boost [bar]
    altitude_m,
    iat_C,        // intake air temp [°C]
    baseOctaneAKI,
    mileage_miles // odometer [miles]
  } = params;

  // --- 1. Ambient conditions (standard atmosphere) ---
  const { P: P_amb, T: T_amb } = stdAtmospherePressure(altitude_m || 0); // Pa, K
  const P0 = 101325;
  const altFactor = P_amb / P0;

  // --- 2. Mileage-based deposits and blow-by ---
  const miles = Math.max(0, Math.min(mileage_miles || 0, 250000)); // clamp 0..250k
  const frac  = miles / 250000; // 0..1

  // Deposits: increase effective CR up to +0.2 by 250k, only for "Poor"
  let deltaCR_deposits = 0.0;
  if (maintenanceState === "Poor") {
    deltaCR_deposits = 0.2 * frac;
  }

  let effectiveCR = compression + deltaCR_deposits;

  // Blow-by: scale 0..1 with same frac; reduce P2 by up to 7% at 250k
  const blowbyLevel = frac;              // 0 (new) -> 1 (250k+)
  const blowbyMaxDrop = 0.07;           // max 7% P2 loss at blowbyLevel = 1

  // --- 3. Polytropic exponent n (thermal behavior) ---
  let n = 1.30;
  if (maintenanceState === "Well") {
    n = 1.28;
  } else if (maintenanceState === "Poor") {
    n = 1.32;
  }

  // --- 4. Intake conditions at IVC ---
  const T1 = iat_C + 273.15; // K

  let P1;
  if (aspiration === "NA") {
    const eta_vol = 0.95;
    P1 = P_amb * eta_vol;
  } else if (aspiration === "Turbo") {
    P1 = P_amb + boostBar * 1e5; // 1 bar ≈ 1e5 Pa
  } else {
    P1 = P_amb;
  }

  // --- 5. Reference state for baseOctaneAKI ---
  const T1_ref = 40 + 273.15; // 40°C
  const r_ref  = compression;
  const n_ref  = 1.30;

  let P1_ref;
  if (aspiration === "NA") {
    P1_ref = P0 * 0.95;
  } else if (aspiration === "Turbo") {
    P1_ref = P0 + boostBar * 1e5;
  } else {
    P1_ref = P0;
  }

  // End-of-compression, ideal (before blow-by loss)
  const T2    = T1    * Math.pow(effectiveCR, n - 1);
  const P2    = P1    * Math.pow(effectiveCR, n);

  // Apply blow-by to P2 only
  const P2_effective = P2 * (1 - blowbyMaxDrop * blowbyLevel);

  // Reference end-of-compression
  const T2_ref = T1_ref * Math.pow(r_ref,   n_ref - 1);
  const P2_ref = P1_ref * Math.pow(r_ref,   n_ref);

  // --- 6. Map P2, T2 to AKI ---
  const logP_ratio = Math.log(P2_effective / P2_ref);
  const invT_delta = (1.0 / T2) - (1.0 / T2_ref);

  const kP = 10.0;
  const kT = -8000.0;

  const pressureScale = aspiration === "Turbo" ? 1 / 3 : 1;
  const dAKI_P = kP * logP_ratio * pressureScale;
  const dAKI_T = kT * invT_delta;

  // --- 7. Required octane ---
  let oct = baseOctaneAKI + dAKI_P + dAKI_T;
  oct = Math.max(80, Math.min(110, oct));

  // --- 8. Component breakdown (for debugging / UI) ---
  const boostTerm = (aspiration === "Turbo")
    ? kP * pressureScale * Math.log(P1 / (P_amb * 0.95))
    : 0.0;

  const compressionTerm = kP * pressureScale * Math.log(
    (P1 * Math.pow(effectiveCR, n)) /
    (P1 * Math.pow(r_ref, n_ref))
  );

  const altDeltaAKI = 0.0; // altitude effect is implicit via P1/P2
  const tempTerm = dAKI_T;

  return {
    octane: oct,
    components: {
      altFactor,
      altDeltaAKI,
      effectiveCR,
      deltaCR_deposits,
      blowbyLevel,
      compressionTerm,
      boostTerm,
      tempTerm,
      P_atm: P_amb,
      T_atm: T_amb,
      P1,
      T1,
      P2_ideal: P2,
      P2: P2_effective,
      T2
    }
  };
}

function generateOctaneVsTempCurve(baseParams, Tmin_C, Tmax_C, points, maintenanceState, units, iatRise_C) {
  const N = Math.max(5, Math.min(500, points));
  const tempsDisplay = [];
  const octanes = [];

  const dT_C = Tmax_C - Tmin_C;
  for (let i = 0; i < N; i++) {
    const frac = i / (N - 1);
    const Tamb_C = Tmin_C + frac * dT_C;
    const iat_C = Tamb_C + iatRise_C;

    const params = {
      ...baseParams,
      iat_C
    };

    const { octane } = estimateRequiredOctaneAKI(params, maintenanceState);

    // Convert ambient temperature to display units
    let Tamb_display;
    if (units === "Standard") {
      Tamb_display = Tamb_C * 9 / 5 + 32;
    } else {
      Tamb_display = Tamb_C;
    }

    tempsDisplay.push(Tamb_display);
    octanes.push(octane);
  }

  // Display endpoints
  let Tmin_display, Tmax_display;
  if (units === "Standard") {
    Tmin_display = Tmin_C * 9 / 5 + 32;
    Tmax_display = Tmax_C * 9 / 5 + 32;
  } else {
    Tmin_display = Tmin_C;
    Tmax_display = Tmax_C;
  }

  return { tempsDisplay, octanes, Tmin_C, Tmax_C, Tmin_display, Tmax_display };
}

const OctaneMath = {
  stdAtmospherePressure,
  estimateRequiredOctaneAKI,
  generateOctaneVsTempCurve
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = OctaneMath;
}

if (typeof window !== "undefined") {
  window.OctaneMath = OctaneMath;
}
