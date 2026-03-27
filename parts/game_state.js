var CHEMO_STATE = {
	regimenId: REGIMEN_KEYS[0],
	bodyScale: 1,
	tumorSensitivity: 1,
	playbackSpeed: 1,
	simulationRunId: 1,
	// configurable patient parameters
	bsa: SIM_DEFAULTS.patientBSA,
	weightKg: SIM_DEFAULTS.patientWeightKg,
	// manual dose controls
	manualDrugId: "doxorubicin",
	manualDoseTimeHour: 24,
	manualDoseAmountMg: 120,
	customDoseEvents: [],
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

function chemoStateSetManualDrugId(drugId) {
	CHEMO_STATE.manualDrugId = drugId;
}

function chemoStateSetManualDoseTimeHour(value) {
	CHEMO_STATE.manualDoseTimeHour = value;
}

function chemoStateSetManualDoseAmountMg(value) {
	CHEMO_STATE.manualDoseAmountMg = value;
}

function chemoStateAddCustomDose() {
	var drug = CHEMO_CONSTANTS.drugs[CHEMO_STATE.manualDrugId];
	var customId = "custom-" + CHEMO_STATE.simulationRunId + "-" + (CHEMO_STATE.customDoseEvents.length + 1);
	CHEMO_STATE.customDoseEvents.push({
		id: customId,
		drugId: drug.id,
		label: "Custom " + drug.name + " at " + CHEMO_STATE.manualDoseTimeHour + " h",
		startHour: CHEMO_STATE.manualDoseTimeHour,
		durationHours: drug.infusionHours,
		amountMg: CHEMO_STATE.manualDoseAmountMg,
	});
	CHEMO_STATE.currentSampleIndex = 0;
	CHEMO_STATE.simulationRunId += 1;
	chemoStateRebuildSimulation();
}

function chemoStateClearCustomDoses() {
	CHEMO_STATE.customDoseEvents = [];
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
