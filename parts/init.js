// ============================================
// init.js -- Bootstrap and event wiring for interaction-first layout
// ============================================

// ============================================
// Bind regimen preset buttons via event delegation
function chemoInitBindPresetButtons() {
	var container = document.getElementById("preset-button-grid");
	container.addEventListener("click", function(event) {
		var button = event.target.closest(".preset-button");
		if (!button) {
			return;
		}
		// stop any playback, load regimen at t=0 (do NOT autoplay)
		chemoStateStopPlayback();
		chemoStateSetRegimen(button.getAttribute("data-regimen-id"));
		chemoUiRenderAll();
	});
}

// ============================================
// Bind playback and simulation controls
function chemoInitBindControls() {
	// playback speed slider
	document.getElementById("playback-speed-slider").addEventListener("input", function(event) {
		chemoStateSetPlaybackSpeed(parseFloat(event.target.value));
		chemoUiRenderSliderLabels();
		// if currently playing, restart with new speed
		if (CHEMO_STATE.playbackTimerId !== null) {
			chemoStateStartPlayback(chemoUiRenderAll);
		}
	});

	// play button
	document.getElementById("play-button").addEventListener("click", function() {
		chemoStateStartPlayback(chemoUiRenderAll);
	});

	// pause button
	document.getElementById("pause-button").addEventListener("click", function() {
		chemoStateStopPlayback();
	});

	// reset button
	document.getElementById("reset-button").addEventListener("click", function() {
		chemoStateStopPlayback();
		chemoStateRerollSimulation();
		chemoUiRenderAll();
	});

	// step button
	document.getElementById("step-button").addEventListener("click", function() {
		chemoStateStopPlayback();
		chemoStateAdvanceSample(1);
		chemoUiRenderAll();
	});

	// time scrubber
	document.getElementById("time-scrubber").addEventListener("input", function(event) {
		chemoStateStopPlayback();
		CHEMO_STATE.currentSampleIndex = parseInt(event.target.value, 10);
		chemoUiRenderAll();
	});
}

// ============================================
// Bind protocol adjustment and custom dosing controls
function chemoInitBindCustomDosing() {
	// dose multiplier slider: scales all regimen doses
	document.getElementById("dose-multiplier-slider").addEventListener("input", function(event) {
		chemoStateStopPlayback();
		CHEMO_STATE.doseMultiplier = parseFloat(event.target.value);
		document.getElementById("dose-multiplier-value").textContent = CHEMO_STATE.doseMultiplier.toFixed(2) + "x";
		CHEMO_STATE.currentSampleIndex = 0;
		CHEMO_STATE.simulationRunId += 1;
		chemoStateRebuildSimulation();
		chemoUiRenderAll();
	});

	// cycle count slider: repeats the full dose schedule
	document.getElementById("cycle-count-slider").addEventListener("input", function(event) {
		chemoStateStopPlayback();
		CHEMO_STATE.cycleCount = parseInt(event.target.value, 10);
		document.getElementById("cycle-count-value").textContent = CHEMO_STATE.cycleCount;
		CHEMO_STATE.currentSampleIndex = 0;
		CHEMO_STATE.simulationRunId += 1;
		chemoStateRebuildSimulation();
		chemoUiRenderAll();
	});

	// tumor sensitivity slider
	document.getElementById("tumor-sensitivity-slider").addEventListener("input", function(event) {
		chemoStateStopPlayback();
		chemoStateSetTumorSensitivity(parseFloat(event.target.value));
		chemoUiRenderAll();
	});

	// manual drug selector
	document.getElementById("manual-drug-select").addEventListener("change", function(event) {
		chemoStateSetManualDrugId(event.target.value);
		chemoUiRenderSliderLabels();
	});

	// manual dose time slider
	document.getElementById("manual-dose-time-slider").addEventListener("input", function(event) {
		chemoStateSetManualDoseTimeHour(parseFloat(event.target.value));
		chemoUiRenderSliderLabels();
	});

	// manual dose amount slider
	document.getElementById("manual-dose-amount-slider").addEventListener("input", function(event) {
		chemoStateSetManualDoseAmountMg(parseFloat(event.target.value));
		chemoUiRenderSliderLabels();
	});

	// add dose button
	document.getElementById("add-dose-button").addEventListener("click", function() {
		chemoStateStopPlayback();
		chemoStateAddCustomDose();
		chemoUiRenderAll();
	});

	// clear doses button
	document.getElementById("clear-doses-button").addEventListener("click", function() {
		chemoStateStopPlayback();
		chemoStateClearCustomDoses();
		chemoUiRenderAll();
	});
}

// ============================================
// Main bootstrap function
function chemoInitBootstrap() {
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
