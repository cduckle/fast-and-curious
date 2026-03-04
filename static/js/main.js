  const OctaneMathLib = window.OctaneMath || {};
  const {
    stdAtmospherePressure: stdAtmospherePressureFn,
    estimateRequiredOctaneAKI: estimateRequiredOctaneAKIFn,
    generateOctaneVsTempCurve: generateOctaneVsTempCurveFn
  } = OctaneMathLib;

  // --- "Database" stub. Fill with real entries later. ---
  const carDatabase = {
    // "1995|nissan|skyline gtr": { aspiration: "Turbo", compression: 8.5, baseOctaneAKI: 93, defaultIAT: 45 }
  };

  function carKey(year, make, model) {
    return [
      (year || "").toString().trim(),
      (make || "").toLowerCase().trim(),
      (model || "").toLowerCase().trim()
    ].join("|");
  }

  function lookupCarConfig(year, make, model) {
    const key = carKey(year, make, model);
    return carDatabase[key] || null;
  }

  // --- UI elements ---

  const compressionSlider = document.getElementById("compression");
  const compressionReadout = document.getElementById("compression-readout");
  const iatSlider = document.getElementById("iat");
  const iatReadout = document.getElementById("iat-readout");
  const mileageSlider = document.getElementById("mileage");
  const mileageReadout = document.getElementById("mileage-readout");
  const boostSlider = document.getElementById("boost");
  const baseOctaneSlider = document.getElementById("base-octane");
  const baseOctaneReadout = document.getElementById("base-octane-readout");
  const aspirationToggle = document.getElementById("aspiration-toggle");
  const maintenanceToggle = document.getElementById("maintenance-toggle");
  const dbStatus = document.getElementById("db-status");
  const viewToggle = document.getElementById("view-toggle");
  const chartView = document.getElementById("chart-view");
  const formulaView = document.getElementById("formula-view");
  const imageView = document.getElementById("image-view");
  const imageStatus = document.getElementById("image-status");
  const pixelCanvas = document.getElementById("pixel-canvas");
  const chartControls = document.getElementById("chart-controls");
  const chartActions = document.getElementById("chart-actions");
  const chartContainer = document.getElementById("chart-container");
  const chartLegend = document.getElementById("chart-legend");
  const resultsPanel = document.getElementById("results-panel");
  const enginePanel = document.getElementById("engine-panel");
  const loadBtn = document.getElementById("load-btn");
  const configImageDock = document.getElementById("config-image-dock");
  const viewCaption = document.getElementById("view-caption");
  const statusLine = document.getElementById("status-line");
  const chartInfo = document.getElementById("chart-info");
  const unitsToggle = document.getElementById("units-toggle");
  const altitudeLabel = document.getElementById("altitude-label");
  const altitudeInput = document.getElementById("altitude");

  let currentUnits = "Metric";
  let lastCalcSnapshot = null;
  let lastImage = null;
  let imageSearchTimer = null;
  let imageFetchId = 0;
  let lastImageStatusText = "Image preview";
  let imageLoadEnabled = false;
  let currentLoadEventId = null;
  const imageHomeParent = imageView ? imageView.parentElement : null;
  const imageHomeNext = imageView ? imageView.nextElementSibling : null;

  function updateCompressionDisplay() {
    compressionReadout.textContent = compressionSlider.value + " : 1";
  }

  function updateIATDisplay() {
    const rise = parseFloat(iatSlider.value || "0");
    iatReadout.textContent = "+" + rise.toFixed(0) + "°";
  }

  function updateMileageDisplay() {
    const miles = parseFloat(mileageSlider.value || "0");
    mileageReadout.textContent = `${miles.toFixed(0)}k miles`;
  }

  function updateBoostDisplay() {}

  function updateBaseOctaneDisplay() {
    baseOctaneReadout.textContent = baseOctaneSlider.value;
  }

  function metersToFeet(meters) {
    return meters * 3.28084;
  }

  function feetToMeters(feet) {
    return feet / 3.28084;
  }

  function getAltitudeMeters() {
    if (!altitudeInput) {
      return 0;
    }
    const raw = parseFloat(altitudeInput.value || "0");
    return currentUnits === "Standard" ? feetToMeters(raw) : raw;
  }

  function setAltitudeDisplayFromMeters(meters) {
    if (!altitudeInput) {
      return;
    }
    if (currentUnits === "Standard") {
      altitudeInput.value = Math.round(metersToFeet(meters));
    } else {
      altitudeInput.value = Math.round(meters);
    }
  }

  function updateAltitudeLabel() {
    if (!altitudeLabel) {
      return;
    }
    altitudeLabel.textContent = currentUnits === "Standard" ? "Altitude (ft)" : "Altitude (m)";
    if (altitudeInput) {
      altitudeInput.placeholder = currentUnits === "Standard" ? "0" : "0";
    }
  }

  aspirationToggle.addEventListener("click", (e) => {
    if (e.target.tagName.toLowerCase() === "button") {
      Array.from(aspirationToggle.querySelectorAll("button")).forEach(btn => {
        btn.classList.toggle("active", btn === e.target);
      });
      const aspiration = e.target.dataset.value || "NA";
    }
  });

  maintenanceToggle.addEventListener("click", (e) => {
    if (e.target.tagName.toLowerCase() === "button") {
      Array.from(maintenanceToggle.querySelectorAll("button")).forEach(btn => {
        btn.classList.toggle("active", btn === e.target);
      });
    }
  });

  unitsToggle.addEventListener("click", (e) => {
    if (e.target.tagName.toLowerCase() === "button") {
      const prevUnits = currentUnits;
      Array.from(unitsToggle.querySelectorAll("button")).forEach(btn => {
        btn.classList.toggle("active", btn === e.target);
      });
      currentUnits = e.target.dataset.units || "Metric";
      if (altitudeInput && altitudeInput.value !== "") {
        const altitudeMeters = prevUnits === "Standard"
          ? feetToMeters(parseFloat(altitudeInput.value || "0"))
          : parseFloat(altitudeInput.value || "0");
        setAltitudeDisplayFromMeters(altitudeMeters);
      }
      updateAltitudeLabel();
      if (lastCalcSnapshot) {
        computeAndRender();
      }
    }
  });

  compressionSlider.addEventListener("input", updateCompressionDisplay);
  iatSlider.addEventListener("input", updateIATDisplay);
  mileageSlider.addEventListener("input", updateMileageDisplay);
  if (boostSlider) {
    boostSlider.addEventListener("input", updateBoostDisplay);
  }
  baseOctaneSlider.addEventListener("input", updateBaseOctaneDisplay);

  updateCompressionDisplay();
  updateIATDisplay();
  updateMileageDisplay();
  updateBoostDisplay();
  updateBaseOctaneDisplay();
  updateAltitudeLabel();

  function setViewToggleEnabled(enabled) {
    Array.from(viewToggle.querySelectorAll("button")).forEach(btn => {
      btn.disabled = !enabled;
    });
  }

  function setResultsMode(mode) {
    const showChart = mode === "chart";
    chartControls.classList.toggle("page-hidden", !showChart);
    chartActions.classList.toggle("page-hidden", !showChart);
    chartContainer.classList.toggle("page-hidden", !showChart);
    chartLegend.classList.toggle("page-hidden", !showChart);
    setViewToggleEnabled(showChart);

    chartView.classList.remove("page-hidden");
    formulaView.classList.add("page-hidden");
    Array.from(viewToggle.querySelectorAll("button")).forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === "chart");
    });
    if (viewCaption) {
      viewCaption.textContent = showChart
        ? "Temperature sweep"
        : lastImageStatusText;
    }
  }

  function updateImageStatus(text) {
    lastImageStatusText = text;
    if (imageStatus) {
      imageStatus.textContent = text;
    }
    if (viewCaption && chartView && !chartControls.classList.contains("page-hidden")) {
      return;
    }
    if (viewCaption && chartView && chartControls.classList.contains("page-hidden")) {
      viewCaption.textContent = text;
    }
  }

  function clearImageDock() {
    if (!imageView || !imageHomeParent) {
      return;
    }
    imageView.classList.remove("image-fly", "image-docked");
    imageView.style.position = "";
    imageView.style.top = "";
    imageView.style.left = "";
    imageView.style.width = "";
    imageView.style.height = "";
    imageView.style.margin = "";
    imageView.style.transform = "";
    imageView.style.zIndex = "";
    if (imageHomeNext) {
      imageHomeParent.insertBefore(imageView, imageHomeNext);
    } else {
      imageHomeParent.appendChild(imageView);
    }
  }

  function finalizeImageDockStyles() {
    if (!imageView) {
      return;
    }
    imageView.style.position = "";
    imageView.style.top = "";
    imageView.style.left = "";
    imageView.style.width = "";
    imageView.style.height = "";
    imageView.style.margin = "";
    imageView.style.transform = "";
    imageView.style.zIndex = "";
  }

  function flyImageToConfig() {
    if (!imageView || imageView.classList.contains("image-docked") || !configImageDock) {
      return;
    }

    const rect = imageView.getBoundingClientRect();
    const dockRect = configImageDock.getBoundingClientRect();
    const targetWidth = Math.max(1, Math.floor(dockRect.width));
    const targetHeight = Math.max(1, Math.floor(dockRect.height));
    const targetTop = dockRect.top;
    const targetLeft = dockRect.left;

    imageView.style.position = "fixed";
    imageView.style.top = `${rect.top}px`;
    imageView.style.left = `${rect.left}px`;
    imageView.style.width = `${rect.width}px`;
    imageView.style.height = `${rect.height}px`;
    imageView.style.margin = "0";
    imageView.style.zIndex = "30";

    const dx = targetLeft - rect.left;
    const dy = targetTop - rect.top;
    imageView.style.setProperty("--fly-x", `${dx}px`);
    imageView.style.setProperty("--fly-y", `${dy}px`);
    imageView.style.setProperty("--fly-scale-x", (targetWidth / rect.width).toFixed(3));
    imageView.style.setProperty("--fly-scale-y", (targetHeight / rect.height).toFixed(3));
    imageView.classList.add("image-fly");

    const onFlyEnd = () => {
      imageView.classList.remove("image-fly");
      imageView.classList.add("image-docked");
      configImageDock.appendChild(imageView);
      finalizeImageDockStyles();
      imageView.removeEventListener("animationend", onFlyEnd);
    };
    imageView.addEventListener("animationend", onFlyEnd);
  }

  // DB config
  function applyDbConfigIfPresent() {
    const year = document.getElementById("year").value;
    const make = document.getElementById("make").value;
    const model = document.getElementById("model").value;

    const cfg = lookupCarConfig(year, make, model);
    if (!cfg) {
      dbStatus.textContent = "no entry, sliders active";
      compressionSlider.disabled = false;
      iatSlider.disabled = false;
      if (boostSlider) {
        boostSlider.disabled = false;
      }
      baseOctaneSlider.disabled = false;
      return;
    }

    if (typeof cfg.compression === "number") {
      compressionSlider.value = cfg.compression;
      updateCompressionDisplay();
    }
    if (typeof cfg.defaultIAT === "number") {
      // defaultIAT is treated as *rise*, if you add that in DB later adjust as needed
      iatSlider.value = cfg.defaultIAT;
      updateIATDisplay();
    }
    if (typeof cfg.baseOctaneAKI === "number") {
      baseOctaneSlider.value = cfg.baseOctaneAKI;
      updateBaseOctaneDisplay();
    }
    if (cfg.aspiration === "Turbo") {
      Array.from(aspirationToggle.querySelectorAll("button")).forEach(btn => {
        btn.classList.toggle("active", btn.dataset.value === "Turbo");
      });
    } else {
      Array.from(aspirationToggle.querySelectorAll("button")).forEach(btn => {
        btn.classList.toggle("active", btn.dataset.value === "NA");
      });
    }

    dbStatus.textContent = "DB entry loaded";
  }

  ["year", "make", "model"].forEach(id => {
    document.getElementById(id).addEventListener("change", applyDbConfigIfPresent);
    document.getElementById(id).addEventListener("blur", applyDbConfigIfPresent);
  });

  function buildCarQuery() {
    const year = document.getElementById("year").value.trim();
    const make = document.getElementById("make").value.trim();
    const model = document.getElementById("model").value.trim();
    if (!make || !model) {
      return "";
    }
    return [year, make, model, "car"].filter(Boolean).join(" ");
  }

  function clearPixelCanvas() {
    if (!pixelCanvas) {
      return;
    }
    const ctx = pixelCanvas.getContext("2d");
    ctx.clearRect(0, 0, pixelCanvas.width, pixelCanvas.height);
    lastImage = null;
  }

  function drawPixelatedImage(img) {
    if (!pixelCanvas) {
      return;
    }
    const rect = pixelCanvas.getBoundingClientRect();
    const displayWidth = Math.max(1, Math.floor(rect.width));
    const displayHeight = Math.max(1, Math.floor(rect.height));
    if (!displayWidth || !displayHeight) {
      return;
    }

    pixelCanvas.width = displayWidth;
    pixelCanvas.height = displayHeight;

    const maxPixels = 256;
    const aspect = img.naturalHeight / img.naturalWidth;
    const pixelWidth = maxPixels;
    const pixelHeight = Math.max(1, Math.round(maxPixels * aspect));

    const offscreen = document.createElement("canvas");
    offscreen.width = pixelWidth;
    offscreen.height = pixelHeight;

    const octx = offscreen.getContext("2d");
    octx.imageSmoothingEnabled = true;
    octx.drawImage(img, 0, 0, pixelWidth, pixelHeight);

    const ctx = pixelCanvas.getContext("2d");
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.imageSmoothingEnabled = false;

    const scale = Math.min(displayWidth / pixelWidth, displayHeight / pixelHeight);
    const drawWidth = Math.floor(pixelWidth * scale);
    const drawHeight = Math.floor(pixelHeight * scale);
    const dx = Math.floor((displayWidth - drawWidth) / 2);
    const dy = Math.floor((displayHeight - drawHeight) / 2);
    ctx.drawImage(offscreen, dx, dy, drawWidth, drawHeight);
  }

  function drawPixelatedProgressive(img) {
    if (!pixelCanvas) {
      return;
    }
    const rect = pixelCanvas.getBoundingClientRect();
    const displayWidth = Math.max(1, Math.floor(rect.width));
    const displayHeight = Math.max(1, Math.floor(rect.height));
    if (!displayWidth || !displayHeight) {
      return;
    }

    pixelCanvas.width = displayWidth;
    pixelCanvas.height = displayHeight;

    const maxPixels = 256;
    const aspect = img.naturalHeight / img.naturalWidth;
    const pixelWidth = maxPixels;
    const pixelHeight = Math.max(1, Math.round(maxPixels * aspect));

    const offscreen = document.createElement("canvas");
    offscreen.width = pixelWidth;
    offscreen.height = pixelHeight;

    const octx = offscreen.getContext("2d");
    octx.imageSmoothingEnabled = true;
    octx.drawImage(img, 0, 0, pixelWidth, pixelHeight);

    const ctx = pixelCanvas.getContext("2d");
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.imageSmoothingEnabled = false;

    const scale = Math.min(displayWidth / pixelWidth, displayHeight / pixelHeight);
    const drawWidth = Math.floor(pixelWidth * scale);
    const drawHeight = Math.floor(pixelHeight * scale);
    const dx = Math.floor((displayWidth - drawWidth) / 2);
    const dy = Math.floor((displayHeight - drawHeight) / 2);

    let row = 0;
    let col = 0;
    const totalBlocks = pixelWidth * pixelHeight;
    let drawnBlocks = 0;
    const blocksPerFrame = Math.max(1, Math.floor(totalBlocks / 80));

    function drawNextBlock() {
      if (row >= pixelHeight) {
        return;
      }

      for (let i = 0; i < blocksPerFrame; i++) {
        if (row >= pixelHeight) {
          break;
        }

        ctx.drawImage(
          offscreen,
          col,
          row,
          1,
          1,
          dx + Math.floor(col * scale),
          dy + Math.floor(row * scale),
          Math.ceil(scale),
          Math.ceil(scale)
        );

        col += 1;
        if (col >= pixelWidth) {
          col = 0;
          row += 1;
        }
        drawnBlocks += 1;
      }

      if (drawnBlocks < totalBlocks) {
        requestAnimationFrame(drawNextBlock);
      }
    }

    drawNextBlock();
  }

  async function fetchAndRenderImage(query) {
    if (!query) {
      updateImageStatus("Enter year, make, model to load image.");
      clearPixelCanvas();
      return;
    }

    const fetchId = ++imageFetchId;
    updateImageStatus("Fetching image...");

    try {
      const response = await fetch(`/api/image?query=${encodeURIComponent(query)}`);
      if (fetchId !== imageFetchId) {
        return;
      }
      if (!response.ok) {
        let errorMessage = "No image found.";
        try {
          const errorData = await response.json();
          if (errorData.error === "missing_api_key") {
            errorMessage = "Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX.";
          }
        } catch (parseError) {
          errorMessage = "Image lookup failed.";
        }
        updateImageStatus(errorMessage);
        clearPixelCanvas();
        return;
      }
      const data = await response.json();
      if (!data.image_url) {
        updateImageStatus("No image found.");
        clearPixelCanvas();
        return;
      }

      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.onload = () => {
        if (fetchId !== imageFetchId) {
          return;
        }
        lastImage = img;
        drawPixelatedProgressive(img);
        updateImageStatus(`${query} · pixel preview`);
      };
      img.onerror = () => {
        if (fetchId !== imageFetchId) {
          return;
        }
        updateImageStatus("Unable to load image.");
        clearPixelCanvas();
      };
      img.src = data.image_url;
    } catch (err) {
      if (fetchId !== imageFetchId) {
        return;
      }
      updateImageStatus("Image lookup failed.");
      clearPixelCanvas();
    }
  }

  function scheduleImageSearch(immediate) {
    if (!imageLoadEnabled) {
      return;
    }
    if (imageSearchTimer) {
      window.clearTimeout(imageSearchTimer);
    }
    const delay = immediate ? 0 : 350;
    imageSearchTimer = window.setTimeout(() => {
      fetchAndRenderImage(buildCarQuery());
    }, delay);
  }

  ["year", "make", "model"].forEach(id => {
    document.getElementById(id).addEventListener("input", scheduleImageSearch);
    document.getElementById(id).addEventListener("change", scheduleImageSearch);
  });

  window.addEventListener("resize", () => {
    if (lastImage) {
      drawPixelatedImage(lastImage);
    }
  });

  // View toggle
  viewToggle.addEventListener("click", (e) => {
    if (e.target.tagName.toLowerCase() === "button") {
      if (!lastCalcSnapshot) {
        return;
      }
      const view = e.target.dataset.view;
      Array.from(viewToggle.querySelectorAll("button")).forEach(btn => {
        btn.classList.toggle("active", btn === e.target);
      });
      if (view === "chart") {
        chartView.classList.remove("page-hidden");
        formulaView.classList.add("page-hidden");
        document.getElementById("view-caption").textContent = "Temperature sweep";
      } else {
        chartView.classList.add("page-hidden");
        formulaView.classList.remove("page-hidden");
        document.getElementById("view-caption").textContent = "Formula breakdown";
        if (lastCalcSnapshot) {
          renderFormulaView(lastCalcSnapshot);
        }
      }
    }
  });

  // Chart setup
  const ctx = document.getElementById("octane-chart").getContext("2d");
  let octaneChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Required octane (AKI)",
        data: [],
        fill: false,
        tension: 0.25,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              const T = context.parsed.x.toFixed(1);
              const oct = context.parsed.y.toFixed(1);
              const unitLabel = currentUnits === "Standard" ? "°F" : "°C";
              return `Ambient: ${T} ${unitLabel}, Octane: ${oct}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: "Ambient temperature (°C)" },
          grid: { color: "rgba(255,255,255,0.05)" }
        },
        y: {
          title: { display: true, text: "Required octane (AKI)" },
          min: 80,
          max: 110,
          grid: { color: "rgba(255,255,255,0.05)" }
        }
      }
    }
  });

  function getActiveToggleValue(toggleEl, defaultValue) {
    const active = toggleEl.querySelector("button.active");
    return active ? active.dataset.value : defaultValue;
  }

  function computeAndRender() {
    const year = document.getElementById("year").value;
    const make = document.getElementById("make").value;
    const model = document.getElementById("model").value;
    const altitude_m = getAltitudeMeters();
    const points = 40;

    const aspiration = getActiveToggleValue(aspirationToggle, "NA");
    const maintenanceState = getActiveToggleValue(maintenanceToggle, "Well");
    const iatRise_display = parseFloat(iatSlider.value || "0");
    const compression = parseFloat(compressionSlider.value);
    const boostBar = boostSlider ? parseFloat(boostSlider.value) : 0;
    const baseOctaneAKI = parseFloat(baseOctaneSlider.value);

    // ΔT above ambient in °C internally
    const iatRise_C = currentUnits === "Standard"
      ? iatRise_display * 5 / 9
      : iatRise_display;

    // Fixed ambient sweep
    let Tmin_display, Tmax_display;
    if (currentUnits === "Standard") {
      Tmin_display = -20;
      Tmax_display = 120;
    } else {
      Tmin_display = -30;
      Tmax_display = 50;
    }

    const Tmin_C = currentUnits === "Standard"
      ? (Tmin_display - 32) * 5 / 9
      : Tmin_display;
    const Tmax_C = currentUnits === "Standard"
      ? (Tmax_display - 32) * 5 / 9
      : Tmax_display;

    const baseParams = {
      compression,
      aspiration,
      boostBar,
      altitude_m,
      iat_C: 0, // overridden pointwise
      baseOctaneAKI,
      mileage_miles: parseFloat(mileageSlider.value || "0") * 1000
    };

    const curve = generateOctaneVsTempCurveFn(
      baseParams,
      Tmin_C,
      Tmax_C,
      points,
      maintenanceState,
      currentUnits,
      iatRise_C
    );

    // Evaluate at center ambient (internal °C)
    const centerAmbient_C = 0.5 * (Tmin_C + Tmax_C);
    const iat_center_C = centerAmbient_C + iatRise_C;
    const centerEval = estimateRequiredOctaneAKIFn(
      { ...baseParams, iat_C: iat_center_C },
      maintenanceState
    );

    // Convert center to display units
    const centerAmbient_display = currentUnits === "Standard"
      ? centerAmbient_C * 9 / 5 + 32
      : centerAmbient_C;

    // Update chart
    octaneChart.data.labels = curve.tempsDisplay;
    octaneChart.data.datasets[0].data = curve.tempsDisplay.map((T, idx) => ({
      x: T,
      y: curve.octanes[idx]
    }));

    // X-axis label by units
    const xLabel = currentUnits === "Standard"
      ? "Ambient temperature (°F)"
      : "Ambient temperature (°C)";
    octaneChart.options.scales.x.title.text = xLabel;

    octaneChart.update();

    chartInfo.textContent =
      `Altitude ${currentUnits === "Standard" ? Math.round(metersToFeet(altitude_m)) : Math.round(altitude_m)} ` +
      (currentUnits === "Standard" ? "ft" : "m");

    statusLine.textContent =
      `At ambient ${centerAmbient_display.toFixed(1)} ` +
      (currentUnits === "Standard" ? "°F" : "°C") +
      `, required octane ≈ ${centerEval.octane.toFixed(1)} AKI.`;

    // Snapshot for formulas
    lastCalcSnapshot = {
      year,
      make,
      model,
      altitude_m,
      units: currentUnits,
      Tmin_display: curve.Tmin_display,
      Tmax_display: curve.Tmax_display,
      Tmin_C,
      Tmax_C,
      centerAmbient_display,
      centerAmbient_C,
      aspiration,
      maintenanceState,
      compression,
      boostBar,
      baseOctaneAKI,
      mileage_k: parseFloat(mileageSlider.value || "0"),
      iatRise_display,
      iatRise_C,
      iat_center_C,
      centerEval
    };

    setResultsMode("chart");
    flyImageToConfig();
    document.body.classList.remove("engine-loading");
  }

  document.getElementById("compute-btn").addEventListener("click", computeAndRender);
  loadBtn.addEventListener("click", () => {
    resultsPanel.classList.remove("page-hidden");
    enginePanel.classList.remove("page-hidden");
    resultsPanel.classList.remove("panel-reveal");
    enginePanel.classList.remove("panel-reveal");
    void resultsPanel.offsetHeight;
    void enginePanel.offsetHeight;
    resultsPanel.classList.add("panel-reveal");
    enginePanel.classList.add("panel-reveal");
    document.body.classList.remove("intro-loading");
    document.body.classList.add("engine-loading");
    clearImageDock();
    imageView.classList.remove("page-hidden");
    setResultsMode("image");
    imageLoadEnabled = true;
    requestAnimationFrame(() => {
      fetchAndRenderImage(buildCarQuery());
    });
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    document.getElementById("config-form").reset();
    // Reset units to Metric
    Array.from(unitsToggle.querySelectorAll("button")).forEach(btn => {
      btn.classList.toggle("active", btn.dataset.units === "Metric");
    });
    currentUnits = "Metric";
    updateAltitudeLabel();

    Array.from(aspirationToggle.querySelectorAll("button")).forEach(btn => {
      btn.classList.toggle("active", btn.dataset.value === "NA");
    });
    Array.from(maintenanceToggle.querySelectorAll("button")).forEach(btn => {
      btn.classList.toggle("active", btn.dataset.value === "Well");
    });

    compressionSlider.value = 10.0;
    iatSlider.value = 20;  // +20° over ambient
    mileageSlider.value = 80;
    if (boostSlider) {
      boostSlider.value = 0;
    }
    baseOctaneSlider.value = 91;

    updateCompressionDisplay();
    updateIATDisplay();
    updateMileageDisplay();
    updateBoostDisplay();
    updateBaseOctaneDisplay();

    dbStatus.textContent = "no entry, sliders active";

    octaneChart.data.labels = [];
    octaneChart.data.datasets[0].data = [];
    octaneChart.update();

    chartInfo.textContent = "Current configuration summary";
    statusLine.textContent = "Press Compute to update curve.";

    lastCalcSnapshot = null;
    setResultsMode("image");
    clearImageDock();
    imageLoadEnabled = false;
    document.body.classList.remove("engine-loading");
    updateImageStatus("Press Load to fetch image.");
  });

  // --- Formula view rendering ---

  function renderFormulaView(snapshot) {
    const {
      year,
      make,
      model,
      altitude_m,
      units,
      Tmin_display,
      Tmax_display,
      Tmin_C,
      Tmax_C,
      centerAmbient_display,
      centerAmbient_C,
      aspiration,
      maintenanceState,
      compression,
      boostBar,
      baseOctaneAKI,
      mileage_k,
      iatRise_display,
      iatRise_C,
      iat_center_C,
      centerEval
    } = snapshot;

    const unitsSymbol = units === "Standard" ? "°F" : "°C";

    const sgrid = document.getElementById("summary-grid");
    sgrid.innerHTML = "";

    const summaryItems = [
      ["Vehicle", `${year || "–"} ${make || ""} ${model || ""}`.trim() || "not set"],
      [
        currentUnits === "Standard" ? "Altitude (ft)" : "Altitude (m)",
        (currentUnits === "Standard" ? metersToFeet(altitude_m) : altitude_m).toFixed(0)
      ],
      ["Ambient min", `${Tmin_display.toFixed(1)} ${unitsSymbol}`],
      ["Ambient max", `${Tmax_display.toFixed(1)} ${unitsSymbol}`],
      ["Center ambient", `${centerAmbient_display.toFixed(1)} ${unitsSymbol}`],
      ["Aspiration", aspiration],
      ["Engine state", maintenanceState],
      ["Compression", `${compression.toFixed(1)} : 1`],
      ["Engine mileage", `${mileage_k.toFixed(0)}k miles`],
      ["Base octane at sea level (AKI)", baseOctaneAKI.toFixed(1)],
      ["IAT rise over ambient", `+${iatRise_display.toFixed(1)} ${unitsSymbol}`]
    ];

    summaryItems.forEach(([label, value]) => {
      const div = document.createElement("div");
      div.className = "summary-item";
      div.innerHTML =
        `<span class="label">${label}</span>` +
        `<span class="value">${value}</span>`;
      sgrid.appendChild(div);
    });

    const c = centerEval.components;
    const altFactorStr = c.altFactor.toFixed(4);
    const altDeltaAKIStr = c.altDeltaAKI.toFixed(2);

    // 1. Atmosphere
    document.getElementById("formula-atm").textContent =
`P(h) = P₀ · (T(h) / T₀)^(g / (R · L))

Inputs:
  h = ${altitude_m.toFixed(1)} m
  P₀ = 101325 Pa
  T₀ = 288.15 K

Result:
  P(h) = ${c.P_atm.toFixed(1)} Pa
  Altitude factor = P(h)/P₀ = ${altFactorStr}`;

    // 2. Compression and blow-by
    const pressureScale = aspiration === "Turbo" ? (1 / 3) : 1;
    document.getElementById("formula-compression").textContent =
`Effective compression (mileage + deposits):
  CR_eff = CR + ΔCR_deposits

  CR = ${compression.toFixed(2)}
  ΔCR_deposits = ${c.deltaCR_deposits.toFixed(3)}
  CR_eff = ${c.effectiveCR.toFixed(2)}

Blow-by factor:
  Blow-by level = ${c.blowbyLevel.toFixed(2)} (0..1)
  Pressure scale (aspiration = ${aspiration}) = ${pressureScale.toFixed(2)}

Compression contribution:
  ΔO_compression = ${c.compressionTerm.toFixed(2)} AKI`;

    // 3. Temperature and intake state
    const iat_center_display = units === "Standard"
      ? (iat_center_C * 9 / 5 + 32)
      : iat_center_C;

    document.getElementById("formula-temp").textContent =
`Engine state:
  ${maintenanceState === "Well" ? "Lower heat transfer" : "Higher heat transfer"}

Intake temperatures (internal):
  Ambient center = ${centerAmbient_C.toFixed(2)} °C
  IAT rise       = +${iatRise_C.toFixed(2)} °C
  IAT center     = ${iat_center_C.toFixed(2)} °C
  IAT center (display) = ${iat_center_display.toFixed(2)} ${unitsSymbol}

Temperature contribution:
  ΔO_temp = ${c.tempTerm.toFixed(2)} AKI`;

    // 4. Combined octane requirement
    const line1 =
      `O_required = O_base`
      + ` - ΔO_altitude`
      + ` + ΔO_compression`
      + ` + ΔO_temp`
      + ``;

    const line2 =
`Numeric at center ambient:
  O_base           = ${baseOctaneAKI.toFixed(2)} AKI
  ΔO_altitude      = ${altDeltaAKIStr} AKI
  ΔO_compression   = ${c.compressionTerm.toFixed(2)} AKI
  ΔO_temp          = ${c.tempTerm.toFixed(2)} AKI
  O_required_raw   = ${(
      baseOctaneAKI
      - c.altDeltaAKI
      + c.compressionTerm
      + c.tempTerm
    ).toFixed(2)} AKI
  O_required_clamp = ${centerEval.octane.toFixed(2)} AKI (clamped to [80, 110])`;

    document.getElementById("formula-octane").textContent =
line1 + "\n\n" + line2;
  }

  // Initial empty state (no auto compute)
  document.body.classList.add("intro-loading");
  setResultsMode("image");
  updateImageStatus("Press Load to fetch image.");
