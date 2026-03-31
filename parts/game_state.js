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
	// simulation data
	samples: [],
	currentSampleIndex: 0,
	peakExposure: 0,
	minimumTumorVolume: 1,
	playbackTimerId: null,
};

function chemoStateRebuildSimulation() {
	var config = chemoPkBuildSimulationConfig(CHEMO_STATE);
	CHEMO_STATE.samples = chemoPkBuildSamples(config);
	CHEMO_STATE.currentSampleIndex = Math.min(CHEMO_STATE.currentSampleIndex, CHEMO_STATE.samples.length - 1);
	CHEMO_STATE.peakExposure = chemoPkFindPeakExposure(CHEMO_STATE.samples);
	CHEMO_STATE.minimumTumorVolume = chemoPkFindMinimumTumorVolume(CHEMO_STATE.samples);
}

function chemoStateSetRegimen(regimenId) {
	CHEMO_STATE.regimenId = regimenId;
	CHEMO_STATE.doseCount = chemoRegimenGetDefaultDoseCount(regimenId);
	CHEMO_STATE.doseIntervalDays = chemoRegimenGetDefaultDoseIntervalDays(regimenId);
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
	CHEMO_STATE.playbackTimerId = window.setInterval(function() {
		if (CHEMO_STATE.currentSampleIndex >= CHEMO_STATE.samples.length - 1) {
			chemoStateStopPlayback();
			return;
		}
		chemoStateAdvanceSample(1);
		onTick();
	}, intervalMs);
}
