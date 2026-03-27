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
// Bind custom dosing controls (inside collapsible section)
function chemoInitBindCustomDosing() {
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
// Wire up collapsible toggle for custom dosing section
function chemoInitBindCollapsible() {
	var toggle = document.getElementById("toggle-custom-dosing");
	var panel = document.getElementById("custom-dosing-panel");
	if (!toggle || !panel) {
		return;
	}
	toggle.addEventListener("click", function() {
		var expanded = toggle.getAttribute("aria-expanded") === "true";
		if (expanded) {
			// collapse
			panel.style.display = "none";
			toggle.setAttribute("aria-expanded", "false");
		} else {
			// expand
			panel.style.display = "block";
			toggle.setAttribute("aria-expanded", "true");
		}
	});
	// allow Enter and Space to toggle (keyboard accessibility)
	toggle.addEventListener("keydown", function(event) {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			toggle.click();
		}
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
	chemoInitBindCollapsible();
}

// ============================================
// Start when DOM is ready
document.addEventListener("DOMContentLoaded", chemoInitBootstrap);
