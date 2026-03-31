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
// Bind protocol adjustment controls
function chemoInitBindCustomDosing() {
	// dose multiplier slider: scales all regimen doses
	document.getElementById("dose-multiplier-slider").addEventListener("input", function(event) {
		chemoStateStopPlayback();
		CHEMO_STATE.doseMultiplier = parseFloat(event.target.value);
		CHEMO_STATE.currentSampleIndex = 0;
		CHEMO_STATE.simulationRunId += 1;
		chemoStateRebuildSimulation();
		chemoUiRenderAll();
	});

	// dose count slider: schedules repeated regimen administrations
	document.getElementById("dose-count-slider").addEventListener("input", function(event) {
		chemoStateStopPlayback();
		chemoStateSetDoseCount(parseInt(event.target.value, 10));
		chemoUiRenderAll();
	});

	// dose interval slider: changes spacing between regimen treatment days
	document.getElementById("dose-interval-slider").addEventListener("input", function(event) {
		chemoStateStopPlayback();
		chemoStateSetDoseIntervalDays(parseFloat(event.target.value));
		chemoUiRenderAll();
	});

	document.getElementById("gender-slider").addEventListener("input", function(event) {
		chemoStateStopPlayback();
		chemoStateSetGenderBalance(parseFloat(event.target.value));
		chemoUiRenderAll();
	});

	document.getElementById("bmi-slider").addEventListener("input", function(event) {
		chemoStateStopPlayback();
		chemoStateSetBmi(parseFloat(event.target.value));
		chemoUiRenderAll();
	});

	document.getElementById("age-slider").addEventListener("input", function(event) {
		chemoStateStopPlayback();
		chemoStateSetAgeYears(parseFloat(event.target.value));
		chemoUiRenderAll();
	});

	document.getElementById("activity-slider").addEventListener("input", function(event) {
		chemoStateStopPlayback();
		chemoStateSetActivityLevel(parseFloat(event.target.value));
		chemoUiRenderAll();
	});

	// tumor sensitivity slider
	document.getElementById("tumor-sensitivity-slider").addEventListener("input", function(event) {
		chemoStateStopPlayback();
		chemoStateSetTumorSensitivity(parseFloat(event.target.value));
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
