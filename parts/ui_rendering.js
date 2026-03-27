// ============================================
// ui_rendering.js -- UI update functions for new interaction-first layout
// ============================================

// ============================================
// Render regimen preset buttons
function chemoUiRenderPresetButtons() {
	var container = document.getElementById("preset-button-grid");
	var markup = [];
	var index;
	for (index = 0; index < CHEMO_CONSTANTS.regimens.length; index += 1) {
		var regimen = CHEMO_CONSTANTS.regimens[index];
		var activeClass = regimen.id === CHEMO_STATE.regimenId ? " is-active" : "";
		markup.push(
			"<button class='preset-button" + activeClass + "' data-regimen-id='" + regimen.id + "' type='button'>" +
			"<span class='preset-title'>" + regimen.name + "</span>" +
			"<span class='preset-subtitle'>" + regimen.subtitle + "</span>" +
			"<span class='preset-note'>" + regimen.drugIds.length + " drugs over " + (regimen.cycleHours / 24).toFixed(0) + " days</span>" +
			"</button>"
		);
	}
	container.innerHTML = markup.join("");
}

// ============================================
// Render manual drug options in the dropdown
function chemoUiRenderManualDrugOptions() {
	var select = document.getElementById("manual-drug-select");
	var markup = [];
	var index;
	for (index = 0; index < DRUG_KEYS.length; index += 1) {
		var drugId = DRUG_KEYS[index];
		var drug = DRUG_DATA[drugId];
		var selected = drug.id === CHEMO_STATE.manualDrugId ? " selected" : "";
		markup.push("<option value='" + drug.id + "'" + selected + ">" + drug.name + "</option>");
	}
	select.innerHTML = markup.join("");
}

// ============================================
// Update compact stats strip
function chemoUiRenderMetrics() {
	var sample = chemoStateGetCurrentSample();
	if (!sample) {
		return;
	}
	var responseChance = typeof sample.responseProbability === "number" ? sample.responseProbability : 0;
	var tumorVolume = typeof sample.tumorVolume === "number" ? sample.tumorVolume : 1;
	// current burden
	document.getElementById("metric-total-burden").textContent = sample.totalBurden.toFixed(2) + " mg/L";
	// max burden (peak)
	document.getElementById("metric-peak-exposure").textContent = CHEMO_STATE.peakExposure.toFixed(2) + " mg/L";
	// tumor size
	document.getElementById("metric-tumor-volume").textContent = Math.round(tumorVolume * 100) + "%";
	// response chance
	document.getElementById("metric-response-chance").textContent = Math.round(responseChance * 100) + "%";
	// patient health
	document.getElementById("metric-patient-vitality").textContent = Math.round(sample.patientHealth || 100) + "%";
	// life status
	document.getElementById("metric-life-status").textContent = sample.lifeStatus || "Stable";
	// hidden backward-compat elements
	var regimenNameEl = document.getElementById("metric-regimen-name");
	if (regimenNameEl) {
		var regimen = chemoRegimenGetById(CHEMO_STATE.regimenId);
		regimenNameEl.textContent = regimen.name;
	}
	var clearanceEl = document.getElementById("metric-clearance");
	if (clearanceEl) {
		clearanceEl.textContent = Math.round(sample.visualState.clearance * 100) + "%";
	}
	// update warning text
	var warningEl = document.getElementById("regimen-warning-text");
	if (warningEl) {
		var reg = chemoRegimenGetById(CHEMO_STATE.regimenId);
		warningEl.textContent = reg.warning;
	}
	// update time label
	document.getElementById("time-label").textContent = sample.timeHour.toFixed(0) + " h";
}

// ============================================
// Render teaching notes for current regimen
function chemoUiRenderTeachingNotes() {
	var regimen = chemoRegimenGetById(CHEMO_STATE.regimenId);
	var noteRoot = document.getElementById("teaching-notes-list");
	var markup = [];
	var index;
	for (index = 0; index < regimen.teachingNotes.length; index += 1) {
		markup.push("<li>" + regimen.teachingNotes[index] + "</li>");
	}
	noteRoot.innerHTML = markup.join("");
}

// ============================================
// Update slider labels and scrubber bounds
function chemoUiRenderSliderLabels() {
	document.getElementById("tumor-sensitivity-value").textContent = CHEMO_STATE.tumorSensitivity.toFixed(2) + "x";
	document.getElementById("playback-speed-value").textContent = CHEMO_STATE.playbackSpeed.toFixed(1) + "x";
	document.getElementById("manual-dose-time-value").textContent = CHEMO_STATE.manualDoseTimeHour.toFixed(0) + " h";
	document.getElementById("manual-dose-amount-value").textContent = CHEMO_STATE.manualDoseAmountMg.toFixed(0) + " mg";
	// update manual drug label if element exists
	var drugLabel = document.getElementById("manual-drug-label");
	if (drugLabel) {
		drugLabel.textContent = DRUG_DATA[CHEMO_STATE.manualDrugId].name;
	}
}

// ============================================
// Update scrubber range and position
function chemoUiRenderScrubberBounds() {
	var scrubber = document.getElementById("time-scrubber");
	scrubber.max = Math.max(CHEMO_STATE.samples.length - 1, 1);
	scrubber.value = CHEMO_STATE.currentSampleIndex;
}

// ============================================
// Render custom dose event list
function chemoUiRenderCustomDoseList() {
	var list = document.getElementById("manual-dose-list");
	var markup = [];
	var index;
	if (!CHEMO_STATE.customDoseEvents.length) {
		list.innerHTML = "<div class='dose-chip'>No custom doses yet.</div>";
		return;
	}
	for (index = 0; index < CHEMO_STATE.customDoseEvents.length; index += 1) {
		var event = CHEMO_STATE.customDoseEvents[index];
		markup.push(
			"<div class='dose-chip'>" + event.label + " - " + event.amountMg.toFixed(0) + " mg</div>"
		);
	}
	list.innerHTML = markup.join("");
}

// ============================================
// Render organ guide (hidden in new layout, kept for backward compat)
function chemoUiRenderOrganGuide() {
	var guideRoot = document.getElementById("organ-guide-root");
	if (!guideRoot || guideRoot.style.display === "none") {
		return;
	}
}

// ============================================
// Full render: update all UI elements
function chemoUiRenderAll() {
	chemoUiRenderPresetButtons();
	chemoUiRenderManualDrugOptions();
	chemoUiRenderMetrics();
	chemoUiRenderTeachingNotes();
	chemoUiRenderSliderLabels();
	chemoUiRenderScrubberBounds();
	chemoUiRenderCustomDoseList();
	chemoUiRenderOrganGuide();
	chemoChartRender();
	chemoVisualRenderBody();
}
