// ============================================
// ui_rendering.ts -- UI update functions for the interaction-first layout
// ============================================
// Ported from the legacy ui_rendering module. Rendered DOM and text are preserved
// exactly; the only changes are typed DOM lookups (throwing helpers instead of
// raw document.getElementById) and explicit String() conversions where the
// legacy code relied on implicit number-to-string coercion when assigning to
// input.value, input.max, and element.textContent.
// ============================================

import { CHEMO_STATE, chemoStateGetCurrentSample } from "./game_state";
import { chemoChartRender, chemoChartFormatTimeHour } from "./chart_stage";
import { chemoVisualRenderBody } from "./body_visual";
import { chemoRegimenGetById } from "./regimen_engine";
import { CHEMO_CONSTANTS } from "./constants";
import { requireElement, requireInput, requireSelect, requireButton } from "./dom";

// ============================================
// Render regimen preset buttons
export function chemoUiRenderPresetButtons(): void {
  const container = requireElement("preset-button-grid");
  const markup: string[] = [];
  for (const regimen of CHEMO_CONSTANTS.regimens) {
    const activeClass = regimen.id === CHEMO_STATE.regimenId ? " is-active" : "";
    markup.push(
      "<button class='preset-button" +
        activeClass +
        "' data-regimen-id='" +
        regimen.id +
        "' type='button'>" +
        "<span class='preset-title'>" +
        regimen.name +
        "</span>" +
        "<span class='preset-subtitle'>" +
        regimen.subtitle +
        "</span>" +
        "<span class='preset-note'>" +
        regimen.drugIds.length +
        " drugs over " +
        (regimen.cycleHours / 24).toFixed(0) +
        " days</span>" +
        "</button>",
    );
  }
  container.innerHTML = markup.join("");
}

// ============================================
// Update compact stats strip
export function chemoUiRenderMetrics(): void {
  const sample = chemoStateGetCurrentSample();
  if (!sample) {
    return;
  }
  const responseChance =
    typeof sample.responseProbability === "number" ? sample.responseProbability : 0;
  const tumorVolume = typeof sample.tumorVolume === "number" ? sample.tumorVolume : 1;
  const patientProfile = sample.patientProfile;
  // current burden
  requireElement("metric-total-burden").textContent = sample.totalBurden.toFixed(2) + " mg/L";
  // max burden (peak)
  requireElement("metric-peak-exposure").textContent =
    CHEMO_STATE.peakExposure.toFixed(2) + " mg/L";
  // tumor size
  requireElement("metric-tumor-volume").textContent = Math.round(tumorVolume * 100) + "%";
  // response chance
  requireElement("metric-response-chance").textContent = Math.round(responseChance * 100) + "%";
  // patient health
  requireElement("metric-patient-vitality").textContent =
    Math.round(sample.patientHealth || 100) + "%";
  // life status
  requireElement("metric-life-status").textContent = sample.lifeStatus || "Stable";
  // hidden backward-compat elements
  const regimen = chemoRegimenGetById(CHEMO_STATE.regimenId);
  requireElement("metric-regimen-name").textContent = regimen.name;
  requireElement("metric-clearance").textContent =
    Math.round(sample.visualState.clearance * 100) + "%";
  requireElement("metric-weight").textContent = (patientProfile.weightKg || 0).toFixed(1) + " kg";
  requireElement("metric-bsa").textContent = (patientProfile.bsa || 0).toFixed(2) + " m2";
  requireElement("metric-clearance-multiplier").textContent =
    (patientProfile.clearanceMultiplier || 0).toFixed(2) + "x";
  requireElement("metric-resilience").textContent =
    (patientProfile.resilienceMultiplier || 0).toFixed(2) + "x";
  // update warning text
  requireElement("regimen-warning-text").textContent = regimen.warning;
  // update time label
  requireElement("time-label").textContent = chemoChartFormatTimeHour(sample.timeHour);
}

// ============================================
// Render teaching notes for current regimen
export function chemoUiRenderTeachingNotes(): void {
  const regimen = chemoRegimenGetById(CHEMO_STATE.regimenId);
  const noteRoot = requireElement("teaching-notes-list");
  const markup: string[] = [];
  for (const note of regimen.teachingNotes) {
    markup.push("<li>" + note + "</li>");
  }
  noteRoot.innerHTML = markup.join("");
}

// ============================================
// Render current adverse effects for the active sample
export function chemoUiRenderAdverseEffects(): void {
  const sample = chemoStateGetCurrentSample();
  const greenRoot = requireElement("adverse-effects-green");
  const yellowRoot = requireElement("adverse-effects-yellow");
  const redRoot = requireElement("adverse-effects-red");
  if (!sample || !sample.adverseEffects || !sample.adverseEffects.length) {
    const emptyMarkup =
      "<div class='effect-row'><span class='effect-name'>No tracked adverse effects</span><span class='effect-status is-green'>Green</span></div>";
    greenRoot.innerHTML = emptyMarkup;
    yellowRoot.innerHTML = "<div class='effect-empty'>No caution-level effects.</div>";
    redRoot.innerHTML = "<div class='effect-empty'>No danger-level effects.</div>";
    return;
  }
  const buckets: { green: string[]; yellow: string[]; red: string[] } = {
    green: [],
    yellow: [],
    red: [],
  };
  for (const effect of sample.adverseEffects) {
    const severity = effect.severity || "green";
    const statusClass = " is-" + severity;
    const statusText = severity === "red" ? "Severe" : severity === "yellow" ? "Present" : "Absent";
    buckets[severity].push(
      "<div class='effect-row'>" +
        "<div><div class='effect-name'>" +
        effect.label +
        "</div><div class='effect-source'>" +
        effect.sourceDrugs.join(", ") +
        "</div></div>" +
        "<span class='effect-status" +
        statusClass +
        "'>" +
        statusText +
        "</span>" +
        "</div>",
    );
  }
  greenRoot.innerHTML = buckets.green.length
    ? buckets.green.join("")
    : "<div class='effect-empty'>No green effects.</div>";
  yellowRoot.innerHTML = buckets.yellow.length
    ? buckets.yellow.join("")
    : "<div class='effect-empty'>No yellow effects.</div>";
  redRoot.innerHTML = buckets.red.length
    ? buckets.red.join("")
    : "<div class='effect-empty'>No red effects.</div>";
}

// ============================================
// Render the case-mode scenario panel: case summary, run summary, event log
export function chemoUiRenderScenarioPanel(): void {
  const caseRoot = requireElement("case-summary-root");
  const summaryRoot = requireElement("run-summary-root");
  const eventRoot = requireElement("event-log-root");
  const sample = chemoStateGetCurrentSample();
  const caseProfile = CHEMO_STATE.caseProfile;
  const runSummary = CHEMO_STATE.runSummary;
  if (!CHEMO_STATE.caseModeEnabled || !caseProfile) {
    caseRoot.innerHTML =
      "<p class='scenario-empty'>Case Mode is off. Turn it on to generate a hidden patient scenario.</p>";
  } else {
    caseRoot.innerHTML =
      "<div class='scenario-kv'><span>Regimen goal</span><strong>" +
      caseProfile.goal +
      "</strong></div>" +
      "<div class='scenario-kv'><span>Hidden organ reserve</span><strong>Renal " +
      Math.round(caseProfile.renalReserve * 100) +
      "% / Hepatic " +
      Math.round(caseProfile.hepaticReserve * 100) +
      "% / Marrow " +
      Math.round(caseProfile.marrowReserve * 100) +
      "%</strong></div>" +
      "<div class='scenario-kv'><span>Mystery trait</span><strong>" +
      (caseProfile.revealed ? caseProfile.mysteryTraitLabel : "Hidden until reveal") +
      "</strong></div>" +
      "<p class='model-note'>" +
      (caseProfile.revealed
        ? caseProfile.mysteryTraitDescription
        : "Infer the hidden trait from the burden curve, toxicity pattern, and final grade.") +
      "</p>";
  }
  if (!runSummary) {
    summaryRoot.innerHTML = "<p class='scenario-empty'>No run summary available.</p>";
  } else {
    summaryRoot.innerHTML =
      "<div class='grade-pill grade-" +
      runSummary.grade.toLowerCase() +
      "'>Grade " +
      runSummary.grade +
      " <span>" +
      runSummary.totalScore +
      "/100</span></div>" +
      "<div class='score-grid'>" +
      "<div class='score-chip'><span>Tumor reduction</span><strong>" +
      runSummary.tumorReduction +
      "%</strong></div>" +
      "<div class='score-chip'><span>Toxicity burden</span><strong>" +
      runSummary.toxicityBurden +
      "%</strong></div>" +
      "<div class='score-chip'><span>Survival</span><strong>" +
      runSummary.survival +
      "%</strong></div>" +
      "<div class='score-chip'><span>Speed</span><strong>" +
      runSummary.speed +
      "%</strong></div>" +
      "<div class='score-chip'><span>Over-treatment penalty</span><strong>-" +
      runSummary.overTreatmentPenalty +
      "</strong></div>" +
      "</div>";
  }
  const events = sample && sample.eventLog ? sample.eventLog : [];
  if (!events.length) {
    eventRoot.innerHTML = "<div class='scenario-empty'>No notable events yet.</div>";
  } else {
    const markup: string[] = [];
    const startIndex = Math.max(0, events.length - 8);
    // slice preserves the original tail-of-log ordering while avoiding an
    // index read that noUncheckedIndexedAccess would widen to string|undefined
    const recentEvents = events.slice(startIndex);
    for (const eventLine of recentEvents) {
      markup.push("<div class='event-row'>" + eventLine + "</div>");
    }
    eventRoot.innerHTML = markup.join("");
  }
}

// ============================================
// Update the reveal-mystery-trait button and its status label
export function chemoUiRenderRevealTraitStatus(): void {
  const button = requireButton("reveal-trait-button");
  const status = requireElement("reveal-trait-status");
  const caseProfile = CHEMO_STATE.caseProfile;
  if (!CHEMO_STATE.caseModeEnabled || !caseProfile) {
    button.disabled = true;
    button.textContent = "Reveal Mystery Trait";
    button.classList.remove("is-revealed");
    status.textContent = "Case Mode off";
    return;
  }
  button.disabled = false;
  if (caseProfile.revealed) {
    button.textContent = "Trait Revealed";
    button.classList.add("is-revealed");
    status.textContent = caseProfile.mysteryTraitLabel + ": " + caseProfile.mysteryTraitDescription;
    return;
  }
  button.textContent = "Reveal Mystery Trait";
  button.classList.remove("is-revealed");
  status.textContent = "Mystery trait hidden";
}

// ============================================
// Update slider positions and their value labels
export function chemoUiRenderSliderLabels(): void {
  requireInput("dose-multiplier-slider").value = String(CHEMO_STATE.doseMultiplier);
  requireInput("dose-count-slider").value = String(CHEMO_STATE.doseCount);
  requireInput("dose-interval-slider").value = String(CHEMO_STATE.doseIntervalDays);
  requireInput("gender-slider").value = String(CHEMO_STATE.genderBalance);
  requireInput("bmi-slider").value = String(CHEMO_STATE.bmi);
  requireInput("age-slider").value = String(CHEMO_STATE.ageYears);
  requireInput("activity-slider").value = String(CHEMO_STATE.activityLevel);
  requireElement("dose-multiplier-value").textContent = CHEMO_STATE.doseMultiplier.toFixed(2) + "x";
  requireElement("dose-count-value").textContent = String(CHEMO_STATE.doseCount);
  requireElement("dose-interval-value").textContent =
    CHEMO_STATE.doseIntervalDays.toFixed(0) + " d";
  requireElement("gender-value").textContent = CHEMO_STATE.genderBalance >= 0.5 ? "Male" : "Female";
  requireElement("bmi-value").textContent = CHEMO_STATE.bmi.toFixed(1);
  requireElement("age-value").textContent = CHEMO_STATE.ageYears.toFixed(0) + " y";
  requireElement("activity-value").textContent =
    CHEMO_STATE.activityLevel >= 0.66
      ? "Active"
      : CHEMO_STATE.activityLevel >= 0.33
        ? "Moderate"
        : "Sedentary";
  requireElement("tumor-sensitivity-value").textContent =
    CHEMO_STATE.tumorSensitivity.toFixed(2) + "x";
  requireElement("playback-speed-value").textContent = CHEMO_STATE.playbackSpeed.toFixed(1) + "x";
  requireSelect("randomness-mode-select").value = CHEMO_STATE.randomnessMode;
  requireInput("case-mode-toggle").checked = CHEMO_STATE.caseModeEnabled;
  chemoUiRenderRevealTraitStatus();
}

// ============================================
// Update the time scrubber range and its day tick marks
export function chemoUiRenderScrubberBounds(): void {
  const scrubber = requireInput("time-scrubber");
  scrubber.max = String(Math.max(CHEMO_STATE.samples.length - 1, 1));
  scrubber.value = String(CHEMO_STATE.currentSampleIndex);
  const tickRoot = requireElement("time-ticks");
  const lastSample = CHEMO_STATE.samples[CHEMO_STATE.samples.length - 1];
  const maxTimeHour = lastSample ? lastSample.timeHour : 0;
  const markup: string[] = [];
  const tickCount = Math.max(0, Math.floor(maxTimeHour / 24));
  for (let dayIndex = 0; dayIndex <= tickCount; dayIndex += 1) {
    markup.push("<span>D" + dayIndex + "</span>");
  }
  tickRoot.innerHTML = markup.join("");
}

// ============================================
// Render organ guide (hidden in the current layout, kept for backward compat)
export function chemoUiRenderOrganGuide(): void {
  const guideRoot = requireElement("organ-guide-root");
  if (guideRoot.style.display === "none") {
    return;
  }
}

// ============================================
// Full render: update all UI elements
export function chemoUiRenderAll(): void {
  chemoUiRenderPresetButtons();
  chemoUiRenderMetrics();
  chemoUiRenderTeachingNotes();
  chemoUiRenderAdverseEffects();
  chemoUiRenderScenarioPanel();
  chemoUiRenderSliderLabels();
  chemoUiRenderScrubberBounds();
  chemoUiRenderOrganGuide();
  chemoChartRender();
  chemoVisualRenderBody();
}
