// ============================================
// main.ts -- Bootstrap and event wiring for interaction-first layout
// ============================================
// This is the entry-point module. It ports the legacy init bootstrap exactly: same
// event bindings, same read/mutate order, same stopPlayback-before-mutate
// pattern for every custom-dosing control.
// ============================================

import type { RandomnessMode } from "./types";
import { requireElement, requireInput, requireSelect } from "./dom";
import {
  CHEMO_STATE,
  chemoStateStopPlayback,
  chemoStateStartPlayback,
  chemoStateSetRegimen,
  chemoStateRerollSimulation,
  chemoStateAdvanceSample,
  chemoStateSetPlaybackSpeed,
  chemoStateSetDoseCount,
  chemoStateSetDoseIntervalDays,
  chemoStateSetGenderBalance,
  chemoStateSetBmi,
  chemoStateSetAgeYears,
  chemoStateSetActivityLevel,
  chemoStateSetTumorSensitivity,
  chemoStateSetRandomnessMode,
  chemoStateSetCaseModeEnabled,
  chemoStateRevealMysteryTrait,
  chemoStateRebuildSimulation,
} from "./game_state";
import { chemoUiRenderAll, chemoUiRenderSliderLabels } from "./ui_rendering";

// ============================================
// Bind regimen preset buttons via event delegation
export function chemoInitBindPresetButtons(): void {
  const container = requireElement("preset-button-grid");
  container.addEventListener("click", (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const button = target.closest(".preset-button");
    if (button === null) {
      return;
    }
    const regimenId = button.getAttribute("data-regimen-id");
    if (regimenId === null) {
      return;
    }
    // stop any playback, load regimen at t=0 (do NOT autoplay)
    chemoStateStopPlayback();
    chemoStateSetRegimen(regimenId);
    chemoUiRenderAll();
  });
}

// ============================================
// Bind playback and simulation controls
export function chemoInitBindControls(): void {
  // playback speed slider
  requireInput("playback-speed-slider").addEventListener("input", () => {
    chemoStateSetPlaybackSpeed(parseFloat(requireInput("playback-speed-slider").value));
    chemoUiRenderSliderLabels();
    // if currently playing, restart with new speed
    if (CHEMO_STATE.playbackTimerId !== null) {
      chemoStateStartPlayback(chemoUiRenderAll);
    }
  });

  // play button
  requireElement("play-button").addEventListener("click", () => {
    chemoStateStartPlayback(chemoUiRenderAll);
  });

  // pause button
  requireElement("pause-button").addEventListener("click", () => {
    chemoStateStopPlayback();
  });

  // reset button
  requireElement("reset-button").addEventListener("click", () => {
    chemoStateStopPlayback();
    chemoStateRerollSimulation();
    chemoUiRenderAll();
  });

  // step button
  requireElement("step-button").addEventListener("click", () => {
    chemoStateStopPlayback();
    chemoStateAdvanceSample(1);
    chemoUiRenderAll();
  });

  // time scrubber
  requireInput("time-scrubber").addEventListener("input", () => {
    chemoStateStopPlayback();
    CHEMO_STATE.currentSampleIndex = parseInt(requireInput("time-scrubber").value, 10);
    chemoUiRenderAll();
  });
}

// ============================================
// Bind protocol adjustment controls
export function chemoInitBindCustomDosing(): void {
  // dose multiplier slider: scales all regimen doses
  requireInput("dose-multiplier-slider").addEventListener("input", () => {
    chemoStateStopPlayback();
    CHEMO_STATE.doseMultiplier = parseFloat(requireInput("dose-multiplier-slider").value);
    CHEMO_STATE.currentSampleIndex = 0;
    CHEMO_STATE.simulationRunId += 1;
    chemoStateRebuildSimulation();
    chemoUiRenderAll();
  });

  // dose count slider: schedules repeated regimen administrations
  requireInput("dose-count-slider").addEventListener("input", () => {
    chemoStateStopPlayback();
    chemoStateSetDoseCount(parseInt(requireInput("dose-count-slider").value, 10));
    chemoUiRenderAll();
  });

  // dose interval slider: changes spacing between regimen treatment days
  requireInput("dose-interval-slider").addEventListener("input", () => {
    chemoStateStopPlayback();
    chemoStateSetDoseIntervalDays(parseFloat(requireInput("dose-interval-slider").value));
    chemoUiRenderAll();
  });

  requireInput("gender-slider").addEventListener("input", () => {
    chemoStateStopPlayback();
    chemoStateSetGenderBalance(parseFloat(requireInput("gender-slider").value));
    chemoUiRenderAll();
  });

  requireInput("bmi-slider").addEventListener("input", () => {
    chemoStateStopPlayback();
    chemoStateSetBmi(parseFloat(requireInput("bmi-slider").value));
    chemoUiRenderAll();
  });

  requireInput("age-slider").addEventListener("input", () => {
    chemoStateStopPlayback();
    chemoStateSetAgeYears(parseFloat(requireInput("age-slider").value));
    chemoUiRenderAll();
  });

  requireInput("activity-slider").addEventListener("input", () => {
    chemoStateStopPlayback();
    chemoStateSetActivityLevel(parseFloat(requireInput("activity-slider").value));
    chemoUiRenderAll();
  });

  // tumor sensitivity slider
  requireInput("tumor-sensitivity-slider").addEventListener("input", () => {
    chemoStateStopPlayback();
    chemoStateSetTumorSensitivity(parseFloat(requireInput("tumor-sensitivity-slider").value));
    chemoUiRenderAll();
  });

  requireSelect("randomness-mode-select").addEventListener("change", () => {
    chemoStateStopPlayback();
    // the select only ever offers the fixed RandomnessMode option set, so the
    // string value is narrowed to the union here rather than validated at runtime
    const modeValue = requireSelect("randomness-mode-select").value as RandomnessMode;
    chemoStateSetRandomnessMode(modeValue);
    chemoUiRenderAll();
  });

  requireInput("case-mode-toggle").addEventListener("change", () => {
    chemoStateStopPlayback();
    chemoStateSetCaseModeEnabled(Boolean(requireInput("case-mode-toggle").checked));
    chemoUiRenderAll();
  });

  requireElement("reveal-trait-button").addEventListener("click", () => {
    chemoStateRevealMysteryTrait();
    chemoUiRenderAll();
  });
}

// ============================================
// Main bootstrap function
export function chemoInitBootstrap(): void {
  // build initial simulation
  chemoStateRebuildSimulation();
  // render all UI elements
  chemoUiRenderAll();
  // bind event listeners
  chemoInitBindPresetButtons();
  chemoInitBindControls();
  chemoInitBindCustomDosing();
}

// ============================================
// Start when DOM is ready
document.addEventListener("DOMContentLoaded", chemoInitBootstrap);
