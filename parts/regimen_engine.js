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
// Build dose events for a regimen, converting mg/m2 to mg using given BSA
// Returns array of {id, drugId, label, startHour, durationHours, amountMg}
function chemoRegimenBuildDoseEvents(regimenId, bsa) {
	var currentBSA = bsa || SIM_DEFAULTS.patientBSA;
	var regimen = chemoRegimenGetById(regimenId);
	var events = [];
	var dayIndex;
	var drugIndex;
	// generate dose events for each dose day in the cycle
	for (dayIndex = 0; dayIndex < regimen.doseDays.length; dayIndex += 1) {
		var doseDay = regimen.doseDays[dayIndex];
		var startHour = doseDay * 24;
		for (drugIndex = 0; drugIndex < regimen.drugs.length; drugIndex += 1) {
			var drugSpec = regimen.drugs[drugIndex];
			var drug = DRUG_DATA[drugSpec.drugKey];
			// convert mg/m2 to mg using current BSA
			var doseMg = Math.round(drugSpec.doseMgM2 * currentBSA);
			var eventId = regimen.id + "-d" + doseDay + "-" + drug.id;
			var label = "Day " + (doseDay + 1) + " " + drug.name;
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
// Build combined dose events: regimen doses plus any custom manual doses
function chemoRegimenBuildCombinedDoseEvents(regimenId, customDoseEvents, bsa) {
	var events = chemoRegimenBuildDoseEvents(regimenId, bsa);
	var manualEvents = customDoseEvents || [];
	var index;
	for (index = 0; index < manualEvents.length; index += 1) {
		events.push(manualEvents[index]);
	}
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
