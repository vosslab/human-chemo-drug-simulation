// ============================================
// regimen_engine.js -- Regimen lookup and dose event generation
// ============================================
// Regimen source doses are mg/m2 in REGIMEN_PRESETS
// Converted to mg using current BSA at dose-event build time
// ============================================

// ============================================
// Look up a regimen by ID from REGIMEN_PRESETS
function chemoRegimenGetById(regimenId) {
	if (REGIMEN_PRESETS[regimenId]) {
		return REGIMEN_PRESETS[regimenId];
	}
	// fallback to first regimen
	return REGIMEN_PRESETS[REGIMEN_KEYS[0]];
}

// ============================================
// Infer the default spacing between scheduled regimen dose days
function chemoRegimenGetDefaultDoseIntervalDays(regimenId) {
	var regimen = chemoRegimenGetById(regimenId);
	if (regimen.doseDays.length < 2) {
		return regimen.cycleDays;
	}
	return Math.max(1, regimen.doseDays[1] - regimen.doseDays[0]);
}

// ============================================
// Infer the default number of scheduled regimen administrations
function chemoRegimenGetDefaultDoseCount(regimenId) {
	var regimen = chemoRegimenGetById(regimenId);
	return Math.max(1, regimen.doseDays.length);
}

// ============================================
// Build a continuous dose-day schedule from a fixed interval and dose count
function chemoRegimenBuildDoseDays(regimenId, doseIntervalDays, doseCount) {
	var intervalDays = doseIntervalDays || chemoRegimenGetDefaultDoseIntervalDays(regimenId);
	var count = doseCount || chemoRegimenGetDefaultDoseCount(regimenId);
	var doseDays = [];
	var doseIndex;
	for (doseIndex = 0; doseIndex < count; doseIndex += 1) {
		doseDays.push(doseIndex * intervalDays);
	}
	return doseDays;
}

// ============================================
// Build dose events for a regimen, converting mg/m2 to mg using given BSA
// doseMultiplier: scales all doses (default 1.0, use 2.0 for double dose)
// doseCount: number of full regimen administrations to schedule (default regimen count)
// doseIntervalDays: spacing between regimen administrations
// Returns array of {id, drugId, label, startHour, durationHours, amountMg}
function chemoRegimenBuildDoseEvents(regimenId, bsa, doseMultiplier, doseCount, doseIntervalDays) {
	var currentBSA = bsa || SIM_DEFAULTS.patientBSA;
	var multiplier = doseMultiplier || 1.0;
	var regimen = chemoRegimenGetById(regimenId);
	var doseDays = chemoRegimenBuildDoseDays(regimenId, doseIntervalDays, doseCount);
	var events = [];
	var dayIndex;
	var drugIndex;
	for (dayIndex = 0; dayIndex < doseDays.length; dayIndex += 1) {
		var doseDay = doseDays[dayIndex];
		var startHour = doseDay * 24;
		for (drugIndex = 0; drugIndex < regimen.drugs.length; drugIndex += 1) {
			var drugSpec = regimen.drugs[drugIndex];
			var drug = DRUG_DATA[drugSpec.drugKey];
			// convert mg/m2 to mg using current BSA, then apply multiplier
			var doseMg = Math.round(drugSpec.doseMgM2 * currentBSA * multiplier);
			var doseLabel = doseDays.length > 1 ? " (Dose " + (dayIndex + 1) + ")" : "";
			var eventId = regimen.id + "-d" + dayIndex + "-" + drug.id;
			var label = "Day " + (doseDay + 1) + " " + drug.name + doseLabel;
			events.push({
				id: eventId,
				drugId: drug.id,
				label: label,
				startHour: startHour + drugIndex * 0.5,
				durationHours: drug.infusionHours,
				amountMg: doseMg,
			});
		}
	}
	// sort by start time
	events.sort(function(left, right) {
		return left.startHour - right.startHour;
	});
	return events;
}

// ============================================
// Build list of drug objects for a regimen
function chemoRegimenBuildDrugList(regimenId) {
	var regimen = chemoRegimenGetById(regimenId);
	var drugs = [];
	var index;
	for (index = 0; index < regimen.drugKeys.length; index += 1) {
		drugs.push(DRUG_DATA[regimen.drugKeys[index]]);
	}
	return drugs;
}
