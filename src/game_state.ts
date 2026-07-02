// ============================================
// game_state.ts -- Shared mutable application state and state-mutating actions
// ============================================
// INVARIANT: this app has exactly one instance and one shared simulation-state
// object, CHEMO_STATE. Every module that reads or mutates simulation state
// imports this same singleton and mutates it in place. Do not create a second
// CHEMO_STATE, do not clone it into a parallel copy, and do not split it into
// per-module state objects -- the UI, chart, and body-visual modules all read
// this one object and expect updates to be visible immediately.
// ============================================

import type { ChemoState, CaseProfile, CaseTrait, SimulationSample } from "./types";
import { CHEMO_CONSTANTS, REGIMEN_KEYS } from "./constants";
import {
  chemoRegimenGetById,
  chemoRegimenGetDefaultDoseCount,
  chemoRegimenGetDefaultDoseIntervalDays,
} from "./regimen_engine";
import {
  chemoPkBuildSimulationConfig,
  chemoPkBuildSamples,
  chemoPkFindPeakExposure,
  chemoPkFindMinimumTumorVolume,
  chemoPkBuildRunSummary,
} from "./pk_engine";

// ============================================
// Initial default values, also used by chemoStateReset to restore the
// singleton between independent simulation runs (and between tests).
// ============================================
function getInitialRegimenId(): string {
  const initialRegimenId = REGIMEN_KEYS[0];
  if (initialRegimenId === undefined) {
    throw new Error("REGIMEN_KEYS is empty; no initial regimen available");
  }
  return initialRegimenId;
}

function buildInitialState(): ChemoState {
  const initialRegimenId = getInitialRegimenId();
  const initialState: ChemoState = {
    regimenId: initialRegimenId,
    bodyScale: 1,
    tumorSensitivity: 1,
    playbackSpeed: 1,
    simulationRunId: 1,
    // protocol modifiers
    doseMultiplier: 1.0,
    doseCount: chemoRegimenGetDefaultDoseCount(initialRegimenId),
    doseIntervalDays: chemoRegimenGetDefaultDoseIntervalDays(initialRegimenId),
    // patient factors
    genderBalance: 0,
    bmi: 24,
    ageYears: 52,
    activityLevel: 0.35,
    randomnessMode: "clinical",
    caseModeEnabled: true,
    caseProfile: null,
    // simulation data
    samples: [],
    currentSampleIndex: 0,
    peakExposure: 0,
    minimumTumorVolume: 1,
    runSummary: null,
    playbackTimerId: null,
  };
  return initialState;
}

// ============================================
// The single shared mutable application state object
export const CHEMO_STATE: ChemoState = buildInitialState();

// ============================================
// Restore CHEMO_STATE to its initial default values in place, without
// reassigning the const binding. Intended for use between independent
// simulation runs in tests, so singleton state does not leak across cases.
export function chemoStateReset(): void {
  chemoStateStopPlayback();
  const defaults = buildInitialState();
  CHEMO_STATE.regimenId = defaults.regimenId;
  CHEMO_STATE.bodyScale = defaults.bodyScale;
  CHEMO_STATE.tumorSensitivity = defaults.tumorSensitivity;
  CHEMO_STATE.playbackSpeed = defaults.playbackSpeed;
  CHEMO_STATE.simulationRunId = defaults.simulationRunId;
  CHEMO_STATE.doseMultiplier = defaults.doseMultiplier;
  CHEMO_STATE.doseCount = defaults.doseCount;
  CHEMO_STATE.doseIntervalDays = defaults.doseIntervalDays;
  CHEMO_STATE.genderBalance = defaults.genderBalance;
  CHEMO_STATE.bmi = defaults.bmi;
  CHEMO_STATE.ageYears = defaults.ageYears;
  CHEMO_STATE.activityLevel = defaults.activityLevel;
  CHEMO_STATE.randomnessMode = defaults.randomnessMode;
  CHEMO_STATE.caseModeEnabled = defaults.caseModeEnabled;
  CHEMO_STATE.caseProfile = defaults.caseProfile;
  CHEMO_STATE.samples = defaults.samples;
  CHEMO_STATE.currentSampleIndex = defaults.currentSampleIndex;
  CHEMO_STATE.peakExposure = defaults.peakExposure;
  CHEMO_STATE.minimumTumorVolume = defaults.minimumTumorVolume;
  CHEMO_STATE.runSummary = defaults.runSummary;
  CHEMO_STATE.playbackTimerId = defaults.playbackTimerId;
}

// ============================================
// Choose a random case goal string for the given regimen
export function chemoStateChooseCaseGoal(regimenId: string): string {
  const regimen = chemoRegimenGetById(regimenId);
  const goals =
    regimen.caseGoals && regimen.caseGoals.length > 0
      ? regimen.caseGoals
      : ["Keep the patient alive while shrinking the tumor."];
  const goal = goals[Math.floor(Math.random() * goals.length)];
  // goals is non-empty (checked above), so the random index is always valid
  if (goal === undefined) {
    throw new Error("chemoStateChooseCaseGoal: goals index out of bounds");
  }
  return goal;
}

// ============================================
// Choose a random hidden-case difficulty trait
export function chemoStateChooseCaseTrait(): CaseTrait {
  const traits = CHEMO_CONSTANTS.caseTraits || [];
  const trait = traits[Math.floor(Math.random() * traits.length)];
  if (trait === undefined) {
    throw new Error("chemoStateChooseCaseTrait: caseTraits index out of bounds or empty");
  }
  return trait;
}

// ============================================
// Generate a new case profile (goal, hidden trait, physiologic reserves)
export function chemoStateGenerateCaseProfile(regimenId: string): CaseProfile {
  const trait = chemoStateChooseCaseTrait();
  const caseProfile: CaseProfile = {
    goal: chemoStateChooseCaseGoal(regimenId),
    mysteryTraitKey: trait.key,
    mysteryTraitLabel: trait.label,
    mysteryTraitDescription: trait.description,
    revealed: false,
    renalReserve: trait.renalReserve || 0.82 + Math.random() * 0.35,
    hepaticReserve: trait.hepaticReserve || 0.85 + Math.random() * 0.3,
    marrowReserve: trait.marrowReserve || 0.8 + Math.random() * 0.35,
    clearanceMultiplier: trait.clearanceMultiplier || 1,
    resilienceMultiplier: trait.resilienceMultiplier || 1,
    efficacyMultiplier: trait.efficacyMultiplier || 1,
  };
  return caseProfile;
}

// ============================================
// Rebuild the full simulation sample array and derived summary fields from
// the current CHEMO_STATE, generating a case profile if case mode is on and
// none exists yet.
export function chemoStateRebuildSimulation(): void {
  if (CHEMO_STATE.caseModeEnabled && !CHEMO_STATE.caseProfile) {
    CHEMO_STATE.caseProfile = chemoStateGenerateCaseProfile(CHEMO_STATE.regimenId);
  }
  if (!CHEMO_STATE.caseModeEnabled) {
    CHEMO_STATE.caseProfile = null;
  }
  const config = chemoPkBuildSimulationConfig(CHEMO_STATE);
  CHEMO_STATE.samples = chemoPkBuildSamples(config);
  CHEMO_STATE.currentSampleIndex = Math.min(
    CHEMO_STATE.currentSampleIndex,
    CHEMO_STATE.samples.length - 1,
  );
  CHEMO_STATE.peakExposure = chemoPkFindPeakExposure(CHEMO_STATE.samples);
  CHEMO_STATE.minimumTumorVolume = chemoPkFindMinimumTumorVolume(CHEMO_STATE.samples);
  CHEMO_STATE.runSummary = chemoPkBuildRunSummary(CHEMO_STATE.samples, config);
}

// ============================================
// Change the active regimen, resetting dose defaults and case profile
export function chemoStateSetRegimen(regimenId: string): void {
  CHEMO_STATE.regimenId = regimenId;
  CHEMO_STATE.doseCount = chemoRegimenGetDefaultDoseCount(regimenId);
  CHEMO_STATE.doseIntervalDays = chemoRegimenGetDefaultDoseIntervalDays(regimenId);
  CHEMO_STATE.caseProfile = CHEMO_STATE.caseModeEnabled
    ? chemoStateGenerateCaseProfile(regimenId)
    : null;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

// ============================================
// Change the body-scale slider value and rebuild the simulation
export function chemoStateSetBodyScale(value: number): void {
  CHEMO_STATE.bodyScale = value;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

// ============================================
// Change the tumor-sensitivity slider value and rebuild the simulation
export function chemoStateSetTumorSensitivity(value: number): void {
  CHEMO_STATE.tumorSensitivity = value;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

// ============================================
// Change the playback speed; does not rebuild the simulation
export function chemoStateSetPlaybackSpeed(value: number): void {
  CHEMO_STATE.playbackSpeed = value;
}

// ============================================
// Change the spacing between scheduled doses and rebuild the simulation
export function chemoStateSetDoseIntervalDays(value: number): void {
  CHEMO_STATE.doseIntervalDays = value;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

// ============================================
// Change the number of scheduled doses and rebuild the simulation
export function chemoStateSetDoseCount(value: number): void {
  CHEMO_STATE.doseCount = value;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

// ============================================
// Change the gender-balance patient-factor slider and rebuild the simulation
export function chemoStateSetGenderBalance(value: number): void {
  CHEMO_STATE.genderBalance = value;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

// ============================================
// Change the BMI patient-factor slider and rebuild the simulation
export function chemoStateSetBmi(value: number): void {
  CHEMO_STATE.bmi = value;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

// ============================================
// Change the age patient-factor slider and rebuild the simulation
export function chemoStateSetAgeYears(value: number): void {
  CHEMO_STATE.ageYears = value;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

// ============================================
// Change the activity-level patient-factor slider and rebuild the simulation
export function chemoStateSetActivityLevel(value: number): void {
  CHEMO_STATE.activityLevel = value;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

// ============================================
// Change the randomness mode and rebuild the simulation
export function chemoStateSetRandomnessMode(mode: ChemoState["randomnessMode"]): void {
  CHEMO_STATE.randomnessMode = mode;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

// ============================================
// Toggle case mode on or off, generating or clearing the case profile
export function chemoStateSetCaseModeEnabled(enabled: boolean): void {
  CHEMO_STATE.caseModeEnabled = enabled;
  CHEMO_STATE.caseProfile = enabled ? chemoStateGenerateCaseProfile(CHEMO_STATE.regimenId) : null;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

// ============================================
// Reveal the hidden mystery trait for the current case profile, if any
export function chemoStateRevealMysteryTrait(): void {
  if (CHEMO_STATE.caseProfile) {
    CHEMO_STATE.caseProfile.revealed = true;
  }
}

// ============================================
// Get the sample at the current playback index, or null if no samples exist
export function chemoStateGetCurrentSample(): SimulationSample | null {
  if (!CHEMO_STATE.samples.length) {
    return null;
  }
  return CHEMO_STATE.samples[CHEMO_STATE.currentSampleIndex] ?? null;
}

// ============================================
// Move the current sample index forward or backward, clamped to bounds
export function chemoStateAdvanceSample(stepCount: number): void {
  const nextIndex = CHEMO_STATE.currentSampleIndex + stepCount;
  CHEMO_STATE.currentSampleIndex = Math.max(0, Math.min(CHEMO_STATE.samples.length - 1, nextIndex));
}

// ============================================
// Reroll the simulation: reset playback, bump run id, generate a fresh case
// profile if case mode is enabled, and rebuild samples
export function chemoStateRerollSimulation(): void {
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  CHEMO_STATE.caseProfile = CHEMO_STATE.caseModeEnabled
    ? chemoStateGenerateCaseProfile(CHEMO_STATE.regimenId)
    : null;
  chemoStateRebuildSimulation();
}

// ============================================
// Stop the running playback timer, if any
export function chemoStateStopPlayback(): void {
  if (CHEMO_STATE.playbackTimerId !== null) {
    window.clearInterval(CHEMO_STATE.playbackTimerId);
    CHEMO_STATE.playbackTimerId = null;
  }
}

// ============================================
// Start advancing samples on a timer, calling onTick after each advance
export function chemoStateStartPlayback(onTick: () => void): void {
  chemoStateStopPlayback();
  const intervalMs = Math.max(120, 800 / CHEMO_STATE.playbackSpeed);
  CHEMO_STATE.playbackTimerId = window.setInterval(() => {
    if (CHEMO_STATE.currentSampleIndex >= CHEMO_STATE.samples.length - 1) {
      chemoStateStopPlayback();
      return;
    }
    chemoStateAdvanceSample(1);
    onTick();
  }, intervalMs);
}
