// test_game_state.mjs -- Node test for src/game_state.ts
// Run: node --import tsx --test tests/test_game_state.mjs
//
// Reproduces the CURRENT behavior of the game_state singleton.
// game_state reads the global Math.random (case-profile/goal/trait selection,
// plus pk_engine's chemoPkRandom for tumor-response jitter), so this file pins
// Math.random to 0 for the whole module, matching the test_pk_engine.mjs
// pattern. chemoStateReset() runs at the top of every test so singleton state
// does not leak between cases.

import test from "node:test";
import assert from "node:assert/strict";

import {
  CHEMO_STATE,
  chemoStateReset,
  chemoStateChooseCaseGoal,
  chemoStateChooseCaseTrait,
  chemoStateGenerateCaseProfile,
  chemoStateRebuildSimulation,
  chemoStateSetRegimen,
  chemoStateSetBodyScale,
  chemoStateSetTumorSensitivity,
  chemoStateSetPlaybackSpeed,
  chemoStateSetDoseIntervalDays,
  chemoStateSetDoseCount,
  chemoStateSetGenderBalance,
  chemoStateSetBmi,
  chemoStateSetAgeYears,
  chemoStateSetActivityLevel,
  chemoStateSetRandomnessMode,
  chemoStateSetCaseModeEnabled,
  chemoStateRevealMysteryTrait,
  chemoStateGetCurrentSample,
  chemoStateAdvanceSample,
  chemoStateRerollSimulation,
  chemoStateStopPlayback,
} from "../src/game_state.ts";

// pin the global PRNG to 0 so case-profile selection and pk_engine jitter are
// deterministic (matches the test_pk_engine.mjs stub)
Math.random = function () {
  return 0.0;
};

//============================================
test("chemoStateReset restores the singleton to its initial defaults", () => {
  chemoStateReset();
  const initialRegimenId = CHEMO_STATE.regimenId;
  const initialDoseCount = CHEMO_STATE.doseCount;

  chemoStateSetBmi(30);
  chemoStateSetAgeYears(70);
  chemoStateSetRegimen("cmf");
  assert.notEqual(CHEMO_STATE.bmi, 24);
  assert.notEqual(CHEMO_STATE.regimenId, initialRegimenId);

  chemoStateReset();
  assert.equal(CHEMO_STATE.regimenId, initialRegimenId);
  assert.equal(CHEMO_STATE.bodyScale, 1);
  assert.equal(CHEMO_STATE.tumorSensitivity, 1);
  assert.equal(CHEMO_STATE.playbackSpeed, 1);
  assert.equal(CHEMO_STATE.simulationRunId, 1);
  assert.equal(CHEMO_STATE.doseMultiplier, 1.0);
  assert.equal(CHEMO_STATE.doseCount, initialDoseCount);
  assert.equal(CHEMO_STATE.genderBalance, 0);
  assert.equal(CHEMO_STATE.bmi, 24);
  assert.equal(CHEMO_STATE.ageYears, 52);
  assert.equal(CHEMO_STATE.activityLevel, 0.35);
  assert.equal(CHEMO_STATE.randomnessMode, "clinical");
  assert.equal(CHEMO_STATE.caseModeEnabled, true);
  assert.equal(CHEMO_STATE.caseProfile, null);
  assert.deepEqual(CHEMO_STATE.samples, []);
  assert.equal(CHEMO_STATE.currentSampleIndex, 0);
  assert.equal(CHEMO_STATE.peakExposure, 0);
  assert.equal(CHEMO_STATE.minimumTumorVolume, 1);
  assert.equal(CHEMO_STATE.runSummary, null);
  assert.equal(CHEMO_STATE.playbackTimerId, null);
});

//============================================
test("chemoStateChooseCaseGoal picks a goal from the regimen's caseGoals", () => {
  chemoStateReset();
  const goal = chemoStateChooseCaseGoal("abvd");
  assert.equal(typeof goal, "string");
  assert.ok(goal.length > 0);
});

//============================================
test("chemoStateChooseCaseTrait picks a trait from CHEMO_CASE_TRAITS", () => {
  chemoStateReset();
  const trait = chemoStateChooseCaseTrait();
  assert.equal(typeof trait.key, "string");
  assert.equal(typeof trait.label, "string");
});

//============================================
test("chemoStateGenerateCaseProfile builds a full unrevealed case profile", () => {
  chemoStateReset();
  const profile = chemoStateGenerateCaseProfile("abvd");
  assert.equal(profile.revealed, false);
  assert.equal(typeof profile.goal, "string");
  assert.equal(typeof profile.mysteryTraitKey, "string");
  assert.equal(typeof profile.mysteryTraitLabel, "string");
  assert.equal(typeof profile.mysteryTraitDescription, "string");
  assert.equal(typeof profile.renalReserve, "number");
  assert.equal(typeof profile.hepaticReserve, "number");
  assert.equal(typeof profile.marrowReserve, "number");
  assert.equal(typeof profile.clearanceMultiplier, "number");
  assert.equal(typeof profile.resilienceMultiplier, "number");
  assert.equal(typeof profile.efficacyMultiplier, "number");
});

//============================================
test("chemoStateRebuildSimulation populates samples and derived summary fields", () => {
  chemoStateReset();
  chemoStateRebuildSimulation();

  assert.ok(CHEMO_STATE.samples.length > 0);
  assert.ok(CHEMO_STATE.peakExposure >= 0);
  assert.ok(CHEMO_STATE.minimumTumorVolume >= 0);
  assert.notEqual(CHEMO_STATE.runSummary, null);

  const summary = CHEMO_STATE.runSummary;
  assert.equal(typeof summary.grade, "string");
  assert.equal(typeof summary.totalScore, "number");
  assert.equal(typeof summary.tumorReduction, "number");
  assert.equal(typeof summary.toxicityBurden, "number");
  assert.equal(typeof summary.survival, "number");
  assert.equal(typeof summary.speed, "number");
  assert.equal(typeof summary.overTreatmentPenalty, "number");
  assert.equal(typeof summary.mysteryTraitLabel, "string");
});

//============================================
test("chemoStateRebuildSimulation generates a case profile when case mode is on", () => {
  chemoStateReset();
  assert.equal(CHEMO_STATE.caseModeEnabled, true);
  assert.equal(CHEMO_STATE.caseProfile, null);

  chemoStateRebuildSimulation();
  assert.notEqual(CHEMO_STATE.caseProfile, null);
});

//============================================
test("chemoStateSetCaseModeEnabled(false) clears the case profile", () => {
  chemoStateReset();
  chemoStateRebuildSimulation();
  assert.notEqual(CHEMO_STATE.caseProfile, null);

  chemoStateSetCaseModeEnabled(false);
  assert.equal(CHEMO_STATE.caseModeEnabled, false);
  assert.equal(CHEMO_STATE.caseProfile, null);
});

//============================================
test("chemoStateSetCaseModeEnabled(true) generates a fresh case profile", () => {
  chemoStateReset();
  chemoStateSetCaseModeEnabled(false);
  assert.equal(CHEMO_STATE.caseProfile, null);

  chemoStateSetCaseModeEnabled(true);
  assert.equal(CHEMO_STATE.caseModeEnabled, true);
  assert.notEqual(CHEMO_STATE.caseProfile, null);
});

//============================================
test("chemoStateRevealMysteryTrait marks the current case profile revealed", () => {
  chemoStateReset();
  chemoStateRebuildSimulation();
  assert.equal(CHEMO_STATE.caseProfile.revealed, false);

  chemoStateRevealMysteryTrait();
  assert.equal(CHEMO_STATE.caseProfile.revealed, true);
});

//============================================
test("chemoStateRevealMysteryTrait is a no-op when there is no case profile", () => {
  chemoStateReset();
  chemoStateSetCaseModeEnabled(false);
  assert.equal(CHEMO_STATE.caseProfile, null);

  chemoStateRevealMysteryTrait();
  assert.equal(CHEMO_STATE.caseProfile, null);
});

//============================================
test("setters that rebuild the simulation bump simulationRunId and reset currentSampleIndex", () => {
  const setterCases = [
    () => chemoStateSetRegimen("folfox"),
    () => chemoStateSetBodyScale(1.2),
    () => chemoStateSetTumorSensitivity(1.3),
    () => chemoStateSetDoseIntervalDays(10),
    () => chemoStateSetDoseCount(3),
    () => chemoStateSetGenderBalance(0.5),
    () => chemoStateSetBmi(28),
    () => chemoStateSetAgeYears(60),
    () => chemoStateSetActivityLevel(0.6),
    () => chemoStateSetRandomnessMode("deterministic"),
    () => chemoStateSetCaseModeEnabled(false),
  ];

  for (const applySetter of setterCases) {
    chemoStateReset();
    chemoStateRebuildSimulation();
    chemoStateAdvanceSample(3);
    assert.ok(CHEMO_STATE.currentSampleIndex > 0);
    const runIdBefore = CHEMO_STATE.simulationRunId;

    applySetter();

    assert.equal(CHEMO_STATE.currentSampleIndex, 0);
    assert.equal(CHEMO_STATE.simulationRunId, runIdBefore + 1);
    assert.ok(CHEMO_STATE.samples.length > 0);
  }
});

//============================================
test("chemoStateSetPlaybackSpeed updates speed without rebuilding the simulation", () => {
  chemoStateReset();
  chemoStateRebuildSimulation();
  const runIdBefore = CHEMO_STATE.simulationRunId;
  const samplesBefore = CHEMO_STATE.samples;

  chemoStateSetPlaybackSpeed(2.5);

  assert.equal(CHEMO_STATE.playbackSpeed, 2.5);
  assert.equal(CHEMO_STATE.simulationRunId, runIdBefore);
  assert.equal(CHEMO_STATE.samples, samplesBefore);
});

//============================================
test("chemoStateGetCurrentSample returns null before any simulation is built", () => {
  chemoStateReset();
  assert.equal(CHEMO_STATE.samples.length, 0);
  assert.equal(chemoStateGetCurrentSample(), null);
});

//============================================
test("chemoStateGetCurrentSample returns the sample at currentSampleIndex", () => {
  chemoStateReset();
  chemoStateRebuildSimulation();
  chemoStateAdvanceSample(2);
  const sample = chemoStateGetCurrentSample();
  assert.notEqual(sample, null);
  assert.equal(sample, CHEMO_STATE.samples[CHEMO_STATE.currentSampleIndex]);
});

//============================================
test("chemoStateAdvanceSample clamps within [0, samples.length - 1]", () => {
  chemoStateReset();
  chemoStateRebuildSimulation();
  const lastIndex = CHEMO_STATE.samples.length - 1;

  chemoStateAdvanceSample(-100);
  assert.equal(CHEMO_STATE.currentSampleIndex, 0);

  chemoStateAdvanceSample(100000);
  assert.equal(CHEMO_STATE.currentSampleIndex, lastIndex);
});

//============================================
test("chemoStateRerollSimulation bumps run id and resets playback index", () => {
  chemoStateReset();
  chemoStateRebuildSimulation();
  chemoStateAdvanceSample(3);
  const runIdBefore = CHEMO_STATE.simulationRunId;

  chemoStateRerollSimulation();

  assert.equal(CHEMO_STATE.currentSampleIndex, 0);
  assert.equal(CHEMO_STATE.simulationRunId, runIdBefore + 1);
  assert.ok(CHEMO_STATE.samples.length > 0);
});

//============================================
test("chemoStateStopPlayback is a no-op when no timer is running", () => {
  chemoStateReset();
  assert.equal(CHEMO_STATE.playbackTimerId, null);
  chemoStateStopPlayback();
  assert.equal(CHEMO_STATE.playbackTimerId, null);
});
