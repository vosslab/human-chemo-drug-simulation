function chemoVisualColor(channelKey, intensity) {
  var palette = {
    bloodstream: [214, 80, 80],
    liver: [221, 139, 61],
    kidney: [74, 125, 178],
    tumor: [126, 91, 214],
    clearance: [115, 179, 125],
  };
  var rgb = palette[channelKey];
  var alpha = 0.15 + intensity * 0.8;
  return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + alpha.toFixed(2) + ")";
}

function chemoVisualPercentText(intensity) {
  return Math.round(intensity * 100) + "%";
}

function chemoVisualCreateSeed(sample) {
  var text = [sample.regimenName || "", sample.timeHour || 0, sample.totalBurden || 0].join("|");
  var seed = 2166136261;
  var index;
  for (index = 0; index < text.length; index += 1) {
    seed ^= text.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function chemoVisualCreatePrng(seed) {
  var state = seed >>> 0;
  return function () {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function chemoVisualGetTumorMetrics(sample) {
  var visualState = sample.visualState || {};
  var responseChance =
    typeof sample.responseProbability === "number" ? sample.responseProbability : 0;
  var tumorShrinkFraction =
    typeof visualState.tumorShrinkFraction === "number" ? visualState.tumorShrinkFraction : 0;
  var tumorRadius = typeof visualState.tumorRadius === "number" ? visualState.tumorRadius : 60;
  if (typeof sample.responseProbability !== "number") {
    var burdenEffect = Math.max(0, Math.min(1, (sample.totalBurden || 0) / 18));
    responseChance = 0.1 + burdenEffect * 0.65;
    if (responseChance < 0.03) {
      responseChance = 0.03;
    }
    if (responseChance > 0.97) {
      responseChance = 0.97;
    }
  }
  if (typeof visualState.tumorShrinkFraction !== "number") {
    var timeResponse = Math.max(0, Math.min(1, (sample.timeHour || 0) / 336));
    tumorShrinkFraction = Math.max(0, Math.min(1, responseChance * 0.75 + timeResponse * 0.18));
  }
  if (typeof visualState.tumorRadius !== "number") {
    tumorRadius = 84 - tumorShrinkFraction * 34;
  }
  return {
    responseChance: responseChance,
    tumorShrinkFraction: tumorShrinkFraction,
    tumorRadius: Math.max(0, Math.min(92, tumorRadius)),
  };
}

function chemoVisualGetTumorSite(regimenName) {
  var regimenIndex;
  for (regimenIndex = 0; regimenIndex < CHEMO_CONSTANTS.regimens.length; regimenIndex += 1) {
    var regimen = CHEMO_CONSTANTS.regimens[regimenIndex];
    if (regimen.name === regimenName) {
      return (
        regimen.tumorSite || {
          label: "Tumor",
          cx: 226,
          cy: 208,
          labelX: 304,
          labelY: 192,
          lineToX: 300,
          lineToY: 188,
        }
      );
    }
  }
  return {
    label: "Tumor",
    cx: 226,
    cy: 208,
    labelX: 304,
    labelY: 192,
    lineToX: 300,
    lineToY: 188,
  };
}

function chemoVisualRenderBody() {
  var currentSample = chemoStateGetCurrentSample();
  var visualState = currentSample.visualState;
  var tumorMetrics = chemoVisualGetTumorMetrics(currentSample);
  var tumorSite = chemoVisualGetTumorSite(currentSample.regimenName);
  var root = document.getElementById("body-visual-root");
  var statusRoot = document.getElementById("body-status-root");
  var tumorRadius = tumorMetrics.tumorRadius.toFixed(1);
  var tumorGlowRadius = (tumorMetrics.tumorRadius + 16).toFixed(1);
  var tumorCoreRadius = Math.max(0, tumorMetrics.tumorRadius * 0.72).toFixed(1);
  var patientHealth =
    typeof currentSample.patientHealth === "number" ? currentSample.patientHealth : 100;
  var lifeStatus = currentSample.lifeStatus || "Stable";
  var bodyOpacity = Math.max(0.18, patientHealth / 100);
  var outlineColor = lifeStatus === "Deceased" ? "#1a1a1a" : "#bfb7aa";
  var healthBarRoot = document.getElementById("patient-health-bar-root");
  var svg =
    "" +
    "<svg class='body-svg' viewBox='0 0 360 460' role='img' aria-label='Stylized body diagram'>" +
    "<rect x='0' y='0' width='360' height='460' rx='28' fill='#fffdf8' />" +
    "<circle cx='180' cy='64' r='38' fill='rgba(31,42,51,0.05)' stroke='#bfb7aa' />" +
    "<path d='M120 132 C138 108, 223 108, 240 132 L262 214 C268 236, 262 255, 248 270 L226 430 L194 430 L188 328 L172 328 L166 430 L134 430 L112 270 C98 255, 92 236, 98 214 Z' fill='rgba(31,42,51," +
    bodyOpacity.toFixed(2) +
    ")' stroke='" +
    outlineColor +
    "' stroke-width='2' />" +
    "<path d='M150 142 C162 132, 198 132, 210 142 C222 151, 228 174, 216 188 C204 202, 156 202, 144 188 C132 174, 138 151, 150 142 Z' fill='" +
    chemoVisualColor("bloodstream", visualState.bloodstream) +
    "' stroke='rgba(214,80,80,0.5)' />" +
    "<ellipse cx='145' cy='214' rx='34' ry='24' fill='" +
    chemoVisualColor("liver", visualState.liver) +
    "' stroke='rgba(221,139,61,0.55)' />" +
    "<ellipse cx='138' cy='274' rx='20' ry='34' fill='" +
    chemoVisualColor("kidney", visualState.kidney) +
    "' stroke='rgba(74,125,178,0.55)' />" +
    "<ellipse cx='222' cy='274' rx='20' ry='34' fill='" +
    chemoVisualColor("kidney", visualState.kidney) +
    "' stroke='rgba(74,125,178,0.55)' />" +
    (tumorMetrics.tumorRadius > 0
      ? "<circle cx='" +
        tumorSite.cx +
        "' cy='" +
        tumorSite.cy +
        "' r='" +
        tumorGlowRadius +
        "' fill='rgba(126,91,214,0.12)' />"
      : "") +
    (tumorMetrics.tumorRadius > 0
      ? "<circle cx='" +
        tumorSite.cx +
        "' cy='" +
        tumorSite.cy +
        "' r='" +
        tumorRadius +
        "' fill='" +
        chemoVisualColor("tumor", visualState.tumor) +
        "' stroke='rgba(126,91,214,0.78)' stroke-width='3' />"
      : "") +
    (tumorMetrics.tumorRadius > 0
      ? "<circle cx='" +
        (tumorSite.cx + 10) +
        "' cy='" +
        (tumorSite.cy - 12) +
        "' r='" +
        tumorCoreRadius +
        "' fill='rgba(255,255,255,0.12)' />"
      : "") +
    "<path d='M162 182 C170 214, 160 246, 150 266' fill='none' stroke='" +
    chemoVisualColor("clearance", visualState.clearance) +
    "' stroke-width='7' stroke-linecap='round' />" +
    "<path d='M200 182 C210 216, 220 240, 228 266' fill='none' stroke='" +
    chemoVisualColor("clearance", visualState.clearance) +
    "' stroke-width='7' stroke-linecap='round' />" +
    "<g fill='none' stroke='#5b6a73' stroke-width='1.6'>" +
    "<path d='M210 142 L284 120' />" +
    "<path d='M172 214 L78 206' />" +
    "<path d='M138 302 L58 332' />" +
    "<path d='M" +
    tumorSite.cx +
    " " +
    tumorSite.cy +
    " L" +
    tumorSite.lineToX +
    " " +
    tumorSite.lineToY +
    "' />" +
    "</g>" +
    "<g fill='#1f2a33' font-size='13' font-family='Avenir Next, Segoe UI, sans-serif'>" +
    "<text x='288' y='122'>Bloodstream</text>" +
    "<text x='26' y='210'>Liver</text>" +
    "<text x='18' y='338'>Kidneys</text>" +
    "<text x='" +
    tumorSite.labelX +
    "' y='" +
    tumorSite.labelY +
    "'>" +
    tumorSite.label +
    "</text>" +
    "</g>" +
    "<text x='180' y='28' text-anchor='middle' fill='#5b6a73' font-size='14'>Drug processing and stochastic response view</text>" +
    "<text x='180' y='446' text-anchor='middle' fill='#1f2a33' font-size='14'>Patient status: " +
    lifeStatus +
    "</text>" +
    "</svg>";
  root.innerHTML = svg;
  var healthColor = "#73b37d";
  if (patientHealth < 70) {
    healthColor = "#dd8b3d";
  }
  if (patientHealth < 40) {
    healthColor = "#ba4a2f";
  }
  if (patientHealth <= 0) {
    healthColor = "#1a1a1a";
  }
  healthBarRoot.innerHTML =
    "" +
    "<div class='health-bar-shell'>" +
    "<div class='health-bar-label'><span>Patient vitality</span><strong>" +
    Math.round(patientHealth) +
    "%</strong></div>" +
    "<div class='health-bar-track'><div class='health-bar-fill' style='width:" +
    Math.max(0, Math.min(100, patientHealth)).toFixed(0) +
    "%; background:" +
    healthColor +
    ";'></div></div>" +
    "</div>";
  statusRoot.innerHTML =
    "" +
    "<div class='status-pill'><span>Bloodstream</span><strong>" +
    chemoVisualPercentText(visualState.bloodstream) +
    "</strong></div>" +
    "<div class='status-pill'><span>Liver load</span><strong>" +
    chemoVisualPercentText(visualState.liver) +
    "</strong></div>" +
    "<div class='status-pill'><span>Kidney clearance</span><strong>" +
    chemoVisualPercentText(visualState.kidney) +
    "</strong></div>" +
    "<div class='status-pill'><span>Tumor exposure</span><strong>" +
    chemoVisualPercentText(visualState.tumor) +
    "</strong></div>" +
    "<div class='status-pill'><span>Tumor size</span><strong>" +
    Math.round(
      (typeof currentSample.tumorVolume === "number"
        ? currentSample.tumorVolume
        : tumorMetrics.tumorRadius / 92) * 100,
    ) +
    "%</strong></div>" +
    "<div class='status-pill'><span>Response chance</span><strong>" +
    chemoVisualPercentText(tumorMetrics.responseChance) +
    "</strong></div>" +
    "<div class='status-pill'><span>Tumor shrinkage</span><strong>" +
    chemoVisualPercentText(tumorMetrics.tumorShrinkFraction) +
    "</strong></div>" +
    "<div class='status-pill'><span>Patient vitality</span><strong>" +
    Math.round(patientHealth) +
    "%</strong></div>" +
    "<div class='status-pill'><span>Life status</span><strong>" +
    lifeStatus +
    "</strong></div>";
}
