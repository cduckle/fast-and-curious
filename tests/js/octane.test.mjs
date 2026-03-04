import { describe, it, expect } from "vitest";
import OctaneMath from "../../static/js/octane.js";

const {
  stdAtmospherePressure,
  estimateRequiredOctaneAKI,
  generateOctaneVsTempCurve
} = OctaneMath;

describe("stdAtmospherePressure", () => {
  it("returns sea-level pressure and temperature", () => {
    const { P, T } = stdAtmospherePressure(0);
    expect(P).toBeCloseTo(101325, -1);
    expect(T).toBeCloseTo(288.15, 3);
  });

  it("decreases pressure with altitude", () => {
    const sea = stdAtmospherePressure(0).P;
    const high = stdAtmospherePressure(2000).P;
    expect(sea).toBeGreaterThan(high);
  });
});

describe("estimateRequiredOctaneAKI", () => {
  it("clamps octane within expected bounds", () => {
    const result = estimateRequiredOctaneAKI({
      compression: 10,
      aspiration: "NA",
      boostBar: 0,
      altitude_m: 0,
      iat_C: 20,
      baseOctaneAKI: 91,
      mileage_miles: 0
    }, "Well");

    expect(result.octane).toBeGreaterThanOrEqual(80);
    expect(result.octane).toBeLessThanOrEqual(110);
  });

  it("increases end-of-compression pressure with higher compression", () => {
    const low = estimateRequiredOctaneAKI({
      compression: 9.0,
      aspiration: "NA",
      boostBar: 0,
      altitude_m: 0,
      iat_C: 20,
      baseOctaneAKI: 91,
      mileage_miles: 0
    }, "Well");
    const high = estimateRequiredOctaneAKI({
      compression: 11.0,
      aspiration: "NA",
      boostBar: 0,
      altitude_m: 0,
      iat_C: 20,
      baseOctaneAKI: 91,
      mileage_miles: 0
    }, "Well");

    expect(high.components.P2_ideal).toBeGreaterThan(low.components.P2_ideal);
  });

  it("raises octane with boost", () => {
    const na = estimateRequiredOctaneAKI({
      compression: 10.0,
      aspiration: "NA",
      boostBar: 0,
      altitude_m: 0,
      iat_C: 20,
      baseOctaneAKI: 91,
      mileage_miles: 0
    }, "Well");
    const turbo = estimateRequiredOctaneAKI({
      compression: 10.0,
      aspiration: "Turbo",
      boostBar: 0.6,
      altitude_m: 0,
      iat_C: 20,
      baseOctaneAKI: 91,
      mileage_miles: 0
    }, "Well");

    expect(turbo.octane).toBeGreaterThan(na.octane);
  });
});

describe("generateOctaneVsTempCurve", () => {
  it("returns ordered temps and matching octane length", () => {
    const baseParams = {
      compression: 10,
      aspiration: "NA",
      boostBar: 0,
      altitude_m: 0,
      iat_C: 0,
      baseOctaneAKI: 91,
      mileage_miles: 80000
    };

    const curve = generateOctaneVsTempCurve(
      baseParams,
      -30,
      50,
      12,
      "Well",
      "Metric",
      20
    );

    expect(curve.tempsDisplay.length).toBe(12);
    expect(curve.octanes.length).toBe(12);
    expect(curve.tempsDisplay[0]).toBeLessThan(curve.tempsDisplay[11]);
  });
});
