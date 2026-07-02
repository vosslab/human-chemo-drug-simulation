var CHEMO_STATE = {
  regimenId: REGIMEN_KEYS[0],
  bodyScale: 1,
  tumorSensitivity: 1,
  playbackSpeed: 1,
  simulationRunId: 1,
  // protocol modifiers
  doseMultiplier: 1.0,
  doseCount: chemoRegimenGetDefaultDoseCount(REGIMEN_KEYS[0]),
  doseIntervalDays: chemoRegimenGetDefaultDoseIntervalDays(REGIMEN_KEYS[0]),
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

function chemoStateChooseCaseGoal(regimenId) {
  var regimen = chemoRegimenGetById(regimenId);
  var goals = regimen.caseGoals || ["Keep the patient alive while shrinking the tumor."];
  return goals[Math.floor(Math.random() * goals.length)];
}

function chemoStateChooseCaseTrait() {
  var traits = CHEMO_CONSTANTS.caseTraits || [];
  return traits[Math.floor(Math.random() * traits.length)];
}

function chemoStateGenerateCaseProfile(regimenId) {
  var trait = chemoStateChooseCaseTrait();
  return {
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
}

function chemoStateRebuildSimulation() {
  if (CHEMO_STATE.caseModeEnabled && !CHEMO_STATE.caseProfile) {
    CHEMO_STATE.caseProfile = chemoStateGenerateCaseProfile(CHEMO_STATE.regimenId);
  }
  if (!CHEMO_STATE.caseModeEnabled) {
    CHEMO_STATE.caseProfile = null;
  }
  var config = chemoPkBuildSimulationConfig(CHEMO_STATE);
  CHEMO_STATE.samples = chemoPkBuildSamples(config);
  CHEMO_STATE.currentSampleIndex = Math.min(
    CHEMO_STATE.currentSampleIndex,
    CHEMO_STATE.samples.length - 1,
  );
  CHEMO_STATE.peakExposure = chemoPkFindPeakExposure(CHEMO_STATE.samples);
  CHEMO_STATE.minimumTumorVolume = chemoPkFindMinimumTumorVolume(CHEMO_STATE.samples);
  CHEMO_STATE.runSummary = chemoPkBuildRunSummary(CHEMO_STATE.samples, config);
}

function chemoStateSetRegimen(regimenId) {
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

function chemoStateSetBodyScale(value) {
  CHEMO_STATE.bodyScale = value;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

function chemoStateSetTumorSensitivity(value) {
  CHEMO_STATE.tumorSensitivity = value;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

function chemoStateSetPlaybackSpeed(value) {
  CHEMO_STATE.playbackSpeed = value;
}

function chemoStateSetDoseIntervalDays(value) {
  CHEMO_STATE.doseIntervalDays = value;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

function chemoStateSetDoseCount(value) {
  CHEMO_STATE.doseCount = value;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

function chemoStateSetGenderBalance(value) {
  CHEMO_STATE.genderBalance = value;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

function chemoStateSetBmi(value) {
  CHEMO_STATE.bmi = value;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

function chemoStateSetAgeYears(value) {
  CHEMO_STATE.ageYears = value;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

function chemoStateSetActivityLevel(value) {
  CHEMO_STATE.activityLevel = value;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

function chemoStateSetRandomnessMode(mode) {
  CHEMO_STATE.randomnessMode = mode;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

function chemoStateSetCaseModeEnabled(enabled) {
  CHEMO_STATE.caseModeEnabled = enabled;
  CHEMO_STATE.caseProfile = enabled ? chemoStateGenerateCaseProfile(CHEMO_STATE.regimenId) : null;
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  chemoStateRebuildSimulation();
}

function chemoStateRevealMysteryTrait() {
  if (CHEMO_STATE.caseProfile) {
    CHEMO_STATE.caseProfile.revealed = true;
  }
}

function chemoStateGetCurrentSample() {
  if (!CHEMO_STATE.samples.length) {
    return null;
  }
  return CHEMO_STATE.samples[CHEMO_STATE.currentSampleIndex];
}

function chemoStateAdvanceSample(stepCount) {
  var nextIndex = CHEMO_STATE.currentSampleIndex + stepCount;
  CHEMO_STATE.currentSampleIndex = Math.max(0, Math.min(CHEMO_STATE.samples.length - 1, nextIndex));
}

function chemoStateRerollSimulation() {
  CHEMO_STATE.currentSampleIndex = 0;
  CHEMO_STATE.simulationRunId += 1;
  CHEMO_STATE.caseProfile = CHEMO_STATE.caseModeEnabled
    ? chemoStateGenerateCaseProfile(CHEMO_STATE.regimenId)
    : null;
  chemoStateRebuildSimulation();
}

function chemoStateStopPlayback() {
  if (CHEMO_STATE.playbackTimerId !== null) {
    window.clearInterval(CHEMO_STATE.playbackTimerId);
    CHEMO_STATE.playbackTimerId = null;
  }
}

function chemoStateStartPlayback(onTick) {
  chemoStateStopPlayback();
  var intervalMs = Math.max(120, 800 / CHEMO_STATE.playbackSpeed);
  CHEMO_STATE.playbackTimerId = window.setInterval(function () {
    if (CHEMO_STATE.currentSampleIndex >= CHEMO_STATE.samples.length - 1) {
      chemoStateStopPlayback();
      return;
    }
    chemoStateAdvanceSample(1);
    onTick();
  }, intervalMs);
}
