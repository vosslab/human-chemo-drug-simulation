function chemoInitBindPresetButtons() {
	var container = document.getElementById("preset-button-grid");
	container.addEventListener("click", function(event) {
		var button = event.target.closest(".preset-button");
		if (!button) {
			return;
		}
		chemoStateStopPlayback();
		chemoStateSetRegimen(button.getAttribute("data-regimen-id"));
		chemoUiRenderAll();
	});
}

function chemoInitBindControls() {
	document.getElementById("tumor-sensitivity-slider").addEventListener("input", function(event) {
		chemoStateStopPlayback();
		chemoStateSetTumorSensitivity(parseFloat(event.target.value));
		chemoUiRenderAll();
	});
	document.getElementById("playback-speed-slider").addEventListener("input", function(event) {
		chemoStateSetPlaybackSpeed(parseFloat(event.target.value));
		chemoUiRenderSliderLabels();
		if (CHEMO_STATE.playbackTimerId !== null) {
			chemoStateStartPlayback(chemoUiRenderAll);
		}
	});
	document.getElementById("manual-drug-select").addEventListener("change", function(event) {
		chemoStateSetManualDrugId(event.target.value);
		chemoUiRenderSliderLabels();
	});
	document.getElementById("manual-dose-time-slider").addEventListener("input", function(event) {
		chemoStateSetManualDoseTimeHour(parseFloat(event.target.value));
		chemoUiRenderSliderLabels();
	});
	document.getElementById("manual-dose-amount-slider").addEventListener("input", function(event) {
		chemoStateSetManualDoseAmountMg(parseFloat(event.target.value));
		chemoUiRenderSliderLabels();
	});
	document.getElementById("add-dose-button").addEventListener("click", function() {
		chemoStateStopPlayback();
		chemoStateAddCustomDose();
		chemoUiRenderAll();
	});
	document.getElementById("clear-doses-button").addEventListener("click", function() {
		chemoStateStopPlayback();
		chemoStateClearCustomDoses();
		chemoUiRenderAll();
	});
	document.getElementById("play-button").addEventListener("click", function() {
		chemoStateStartPlayback(chemoUiRenderAll);
	});
	document.getElementById("pause-button").addEventListener("click", function() {
		chemoStateStopPlayback();
	});
	document.getElementById("reset-button").addEventListener("click", function() {
		chemoStateStopPlayback();
		chemoStateRerollSimulation();
		chemoUiRenderAll();
	});
	document.getElementById("step-button").addEventListener("click", function() {
		chemoStateStopPlayback();
		chemoStateAdvanceSample(1);
		chemoUiRenderAll();
	});
	document.getElementById("time-scrubber").addEventListener("input", function(event) {
		chemoStateStopPlayback();
		CHEMO_STATE.currentSampleIndex = parseInt(event.target.value, 10);
		chemoUiRenderAll();
	});
}

function chemoInitBootstrap() {
	chemoStateRebuildSimulation();
	chemoUiRenderAll();
	chemoInitBindPresetButtons();
	chemoInitBindControls();
}

document.addEventListener("DOMContentLoaded", chemoInitBootstrap);
