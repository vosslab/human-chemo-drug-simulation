function chemoUiFormatMultiplier(value) {
	return value.toFixed(2) + "x";
}

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

function chemoUiRenderManualDrugOptions() {
	var select = document.getElementById("manual-drug-select");
	var markup = [];
	var drugIds = Object.keys(CHEMO_CONSTANTS.drugs);
	var index;
	for (index = 0; index < drugIds.length; index += 1) {
		var drug = CHEMO_CONSTANTS.drugs[drugIds[index]];
		var selected = drug.id === CHEMO_STATE.manualDrugId ? " selected" : "";
		markup.push("<option value='" + drug.id + "'" + selected + ">" + drug.name + "</option>");
	}
	select.innerHTML = markup.join("");
}

function chemoUiRenderMetrics() {
	var sample = chemoStateGetCurrentSample();
	var regimen = chemoRegimenGetById(CHEMO_STATE.regimenId);
	var responseChance = typeof sample.responseProbability === "number" ? sample.responseProbability : 0;
	var tumorVolume = typeof sample.tumorVolume === "number" ? sample.tumorVolume : 1;
	document.getElementById("metric-regimen-name").textContent = regimen.name;
	document.getElementById("metric-total-burden").textContent = chemoChartFormatMg(sample.totalBurden);
	document.getElementById("metric-peak-exposure").textContent = chemoChartFormatMg(CHEMO_STATE.peakExposure);
	document.getElementById("metric-clearance").textContent = Math.round(sample.visualState.clearance * 100) + "%";
	document.getElementById("metric-tumor-volume").textContent = Math.round(tumorVolume * 100) + "%";
	document.getElementById("metric-response-chance").textContent = Math.round(responseChance * 100) + "%";
	document.getElementById("metric-patient-vitality").textContent = Math.round(sample.patientHealth || 100) + "%";
	document.getElementById("metric-life-status").textContent = sample.lifeStatus || "Stable";
	document.getElementById("regimen-warning-text").textContent = regimen.warning;
	document.getElementById("time-label").textContent = sample.timeHour.toFixed(0) + " h";
}

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

function chemoUiRenderSliderLabels() {
	document.getElementById("tumor-sensitivity-value").textContent = chemoUiFormatMultiplier(CHEMO_STATE.tumorSensitivity);
	document.getElementById("playback-speed-value").textContent = CHEMO_STATE.playbackSpeed.toFixed(1) + "x";
	document.getElementById("manual-dose-time-value").textContent = CHEMO_STATE.manualDoseTimeHour.toFixed(0) + " h";
	document.getElementById("manual-dose-amount-value").textContent = CHEMO_STATE.manualDoseAmountMg.toFixed(0) + " mg";
	document.getElementById("manual-drug-label").textContent = CHEMO_CONSTANTS.drugs[CHEMO_STATE.manualDrugId].name;
}

function chemoUiRenderScrubberBounds() {
	var scrubber = document.getElementById("time-scrubber");
	scrubber.max = Math.max(CHEMO_STATE.samples.length - 1, 1);
	scrubber.value = CHEMO_STATE.currentSampleIndex;
}

function chemoUiRenderCustomDoseList() {
	var list = document.getElementById("manual-dose-list");
	var markup = [];
	var index;
	if (!CHEMO_STATE.customDoseEvents.length) {
		list.innerHTML = "<div class='dose-chip'>No manual doses yet. Add one to stress the body or boost tumor response.</div>";
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

function chemoUiRenderOrganGuide() {
	var guideRoot = document.getElementById("organ-guide-root");
	var markup = [];
	var colorMap = {};
	var channelIndex;
	for (channelIndex = 0; channelIndex < CHEMO_CONSTANTS.visualChannels.length; channelIndex += 1) {
		colorMap[CHEMO_CONSTANTS.visualChannels[channelIndex].key] = CHEMO_CONSTANTS.visualChannels[channelIndex].color;
	}
	var index;
	for (index = 0; index < CHEMO_CONSTANTS.organInfo.length; index += 1) {
		var organ = CHEMO_CONSTANTS.organInfo[index];
		markup.push(
			"<div class='organ-guide-card'><strong><span class='organ-dot' style='background:" + colorMap[organ.key] +
			";'></span>" + organ.label + "</strong><p>" + organ.role + "</p></div>"
		);
	}
	guideRoot.innerHTML = markup.join("");
}

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
