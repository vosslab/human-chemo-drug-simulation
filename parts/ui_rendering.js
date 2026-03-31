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

// Update compact stats strip
function chemoUiRenderMetrics() {
	var sample = chemoStateGetCurrentSample();
	if (!sample) {
		return;
	}
	var responseChance = typeof sample.responseProbability === "number" ? sample.responseProbability : 0;
	var tumorVolume = typeof sample.tumorVolume === "number" ? sample.tumorVolume : 1;
	var patientProfile = sample.patientProfile || {};
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
	document.getElementById("metric-weight").textContent = (patientProfile.weightKg || 0).toFixed(1) + " kg";
	document.getElementById("metric-bsa").textContent = (patientProfile.bsa || 0).toFixed(2) + " m2";
	document.getElementById("metric-clearance-multiplier").textContent = (patientProfile.clearanceMultiplier || 0).toFixed(2) + "x";
	document.getElementById("metric-resilience").textContent = (patientProfile.resilienceMultiplier || 0).toFixed(2) + "x";
	// update warning text
	var warningEl = document.getElementById("regimen-warning-text");
	if (warningEl) {
		var reg = chemoRegimenGetById(CHEMO_STATE.regimenId);
		warningEl.textContent = reg.warning;
	}
	// update time label
	document.getElementById("time-label").textContent = chemoChartFormatTimeHour(sample.timeHour);
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
// Render current adverse effects for the active sample
function chemoUiRenderAdverseEffects() {
	var sample = chemoStateGetCurrentSample();
	var greenRoot = document.getElementById("adverse-effects-green");
	var yellowRoot = document.getElementById("adverse-effects-yellow");
	var redRoot = document.getElementById("adverse-effects-red");
	if (!sample || !sample.adverseEffects || !sample.adverseEffects.length) {
		var emptyMarkup = "<div class='effect-row'><span class='effect-name'>No tracked adverse effects</span><span class='effect-status is-green'>Green</span></div>";
		greenRoot.innerHTML = emptyMarkup;
		yellowRoot.innerHTML = "<div class='effect-empty'>No caution-level effects.</div>";
		redRoot.innerHTML = "<div class='effect-empty'>No danger-level effects.</div>";
		return;
	}
	var buckets = {
		green: [],
		yellow: [],
		red: [],
	};
	var index;
	for (index = 0; index < sample.adverseEffects.length; index += 1) {
		var effect = sample.adverseEffects[index];
		var severity = effect.severity || "green";
		var statusClass = " is-" + severity;
		var statusText = severity === "red" ? "Severe" : (severity === "yellow" ? "Present" : "Absent");
		buckets[severity].push(
			"<div class='effect-row'>" +
			"<div><div class='effect-name'>" + effect.label + "</div><div class='effect-source'>" +
			effect.sourceDrugs.join(", ") + "</div></div>" +
			"<span class='effect-status" + statusClass + "'>" + statusText + "</span>" +
			"</div>"
		);
	}
	greenRoot.innerHTML = buckets.green.length ? buckets.green.join("") : "<div class='effect-empty'>No green effects.</div>";
	yellowRoot.innerHTML = buckets.yellow.length ? buckets.yellow.join("") : "<div class='effect-empty'>No yellow effects.</div>";
	redRoot.innerHTML = buckets.red.length ? buckets.red.join("") : "<div class='effect-empty'>No red effects.</div>";
}

function chemoUiRenderScenarioPanel() {
	var caseRoot = document.getElementById("case-summary-root");
	var summaryRoot = document.getElementById("run-summary-root");
	var eventRoot = document.getElementById("event-log-root");
	var sample = chemoStateGetCurrentSample();
	var caseProfile = CHEMO_STATE.caseProfile;
	var runSummary = CHEMO_STATE.runSummary;
	if (caseRoot) {
		if (!CHEMO_STATE.caseModeEnabled || !caseProfile) {
			caseRoot.innerHTML = "<p class='scenario-empty'>Case Mode is off. Turn it on to generate a hidden patient scenario.</p>";
		} else {
			caseRoot.innerHTML = "" +
				"<div class='scenario-kv'><span>Regimen goal</span><strong>" + caseProfile.goal + "</strong></div>" +
				"<div class='scenario-kv'><span>Hidden organ reserve</span><strong>Renal " + Math.round(caseProfile.renalReserve * 100) + "% / Hepatic " + Math.round(caseProfile.hepaticReserve * 100) + "% / Marrow " + Math.round(caseProfile.marrowReserve * 100) + "%</strong></div>" +
				"<div class='scenario-kv'><span>Mystery trait</span><strong>" + (caseProfile.revealed ? caseProfile.mysteryTraitLabel : "Hidden until reveal") + "</strong></div>" +
				"<p class='model-note'>" + (caseProfile.revealed ? caseProfile.mysteryTraitDescription : "Infer the hidden trait from the burden curve, toxicity pattern, and final grade.") + "</p>";
		}
	}
	if (summaryRoot) {
		if (!runSummary) {
			summaryRoot.innerHTML = "<p class='scenario-empty'>No run summary available.</p>";
		} else {
			summaryRoot.innerHTML = "" +
				"<div class='grade-pill grade-" + runSummary.grade.toLowerCase() + "'>Grade " + runSummary.grade + " <span>" + runSummary.totalScore + "/100</span></div>" +
				"<div class='score-grid'>" +
				"<div class='score-chip'><span>Tumor reduction</span><strong>" + runSummary.tumorReduction + "%</strong></div>" +
				"<div class='score-chip'><span>Toxicity burden</span><strong>" + runSummary.toxicityBurden + "%</strong></div>" +
				"<div class='score-chip'><span>Survival</span><strong>" + runSummary.survival + "%</strong></div>" +
				"<div class='score-chip'><span>Speed</span><strong>" + runSummary.speed + "%</strong></div>" +
				"<div class='score-chip'><span>Over-treatment penalty</span><strong>-" + runSummary.overTreatmentPenalty + "</strong></div>" +
				"</div>";
		}
	}
	if (eventRoot) {
		var events = sample && sample.eventLog ? sample.eventLog : [];
		if (!events.length) {
			eventRoot.innerHTML = "<div class='scenario-empty'>No notable events yet.</div>";
		} else {
			var markup = [];
			var startIndex = Math.max(0, events.length - 8);
			var index;
			for (index = startIndex; index < events.length; index += 1) {
				markup.push("<div class='event-row'>" + events[index] + "</div>");
			}
			eventRoot.innerHTML = markup.join("");
		}
	}
}

function chemoUiRenderRevealTraitStatus() {
	var button = document.getElementById("reveal-trait-button");
	var status = document.getElementById("reveal-trait-status");
	var caseProfile = CHEMO_STATE.caseProfile;
	if (!button || !status) {
		return;
	}
	if (!CHEMO_STATE.caseModeEnabled || !caseProfile) {
		button.disabled = true;
		button.textContent = "Reveal Mystery Trait";
		button.classList.remove("is-revealed");
		status.textContent = "Case Mode off";
		return;
	}
	button.disabled = false;
	if (caseProfile.revealed) {
		button.textContent = "Trait Revealed";
		button.classList.add("is-revealed");
		status.textContent = caseProfile.mysteryTraitLabel + ": " + caseProfile.mysteryTraitDescription;
		return;
	}
	button.textContent = "Reveal Mystery Trait";
	button.classList.remove("is-revealed");
	status.textContent = "Mystery trait hidden";
}

// ============================================
// Update slider labels and scrubber bounds
function chemoUiRenderSliderLabels() {
	document.getElementById("dose-multiplier-slider").value = CHEMO_STATE.doseMultiplier;
	document.getElementById("dose-count-slider").value = CHEMO_STATE.doseCount;
	document.getElementById("dose-interval-slider").value = CHEMO_STATE.doseIntervalDays;
	document.getElementById("gender-slider").value = CHEMO_STATE.genderBalance;
	document.getElementById("bmi-slider").value = CHEMO_STATE.bmi;
	document.getElementById("age-slider").value = CHEMO_STATE.ageYears;
	document.getElementById("activity-slider").value = CHEMO_STATE.activityLevel;
	document.getElementById("dose-multiplier-value").textContent = CHEMO_STATE.doseMultiplier.toFixed(2) + "x";
	document.getElementById("dose-count-value").textContent = CHEMO_STATE.doseCount;
	document.getElementById("dose-interval-value").textContent = CHEMO_STATE.doseIntervalDays.toFixed(0) + " d";
	document.getElementById("gender-value").textContent = CHEMO_STATE.genderBalance >= 0.5 ? "Male" : "Female";
	document.getElementById("bmi-value").textContent = CHEMO_STATE.bmi.toFixed(1);
	document.getElementById("age-value").textContent = CHEMO_STATE.ageYears.toFixed(0) + " y";
	document.getElementById("activity-value").textContent = CHEMO_STATE.activityLevel >= 0.66 ? "Active" : (CHEMO_STATE.activityLevel >= 0.33 ? "Moderate" : "Sedentary");
	document.getElementById("tumor-sensitivity-value").textContent = CHEMO_STATE.tumorSensitivity.toFixed(2) + "x";
	document.getElementById("playback-speed-value").textContent = CHEMO_STATE.playbackSpeed.toFixed(1) + "x";
	document.getElementById("randomness-mode-select").value = CHEMO_STATE.randomnessMode;
	document.getElementById("case-mode-toggle").checked = CHEMO_STATE.caseModeEnabled;
	chemoUiRenderRevealTraitStatus();
}

// ============================================
// Update scrubber range and position
function chemoUiRenderScrubberBounds() {
	var scrubber = document.getElementById("time-scrubber");
	scrubber.max = Math.max(CHEMO_STATE.samples.length - 1, 1);
	scrubber.value = CHEMO_STATE.currentSampleIndex;
	var tickRoot = document.getElementById("time-ticks");
	var maxTimeHour = CHEMO_STATE.samples.length ? CHEMO_STATE.samples[CHEMO_STATE.samples.length - 1].timeHour : 0;
	var markup = [];
	var dayIndex;
	var tickCount = Math.max(0, Math.floor(maxTimeHour / 24));
	for (dayIndex = 0; dayIndex <= tickCount; dayIndex += 1) {
		markup.push("<span>D" + dayIndex + "</span>");
	}
	tickRoot.innerHTML = markup.join("");
}

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
	chemoUiRenderMetrics();
	chemoUiRenderTeachingNotes();
	chemoUiRenderAdverseEffects();
	chemoUiRenderScenarioPanel();
	chemoUiRenderSliderLabels();
	chemoUiRenderScrubberBounds();
	chemoUiRenderOrganGuide();
	chemoChartRender();
	chemoVisualRenderBody();
}
