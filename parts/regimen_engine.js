function chemoRegimenGetById(regimenId) {
	for (var index = 0; index < CHEMO_CONSTANTS.regimens.length; index += 1) {
		if (CHEMO_CONSTANTS.regimens[index].id === regimenId) {
			return CHEMO_CONSTANTS.regimens[index];
		}
	}
	return CHEMO_CONSTANTS.regimens[0];
}

function chemoRegimenBuildDoseEvents(regimenId) {
	var regimen = chemoRegimenGetById(regimenId);
	var events = [];
	for (var index = 0; index < regimen.doseEvents.length; index += 1) {
		var event = regimen.doseEvents[index];
		events.push({
			id: event.id,
			drugId: event.drugId,
			label: event.label,
			startHour: event.startHour,
			durationHours: event.durationHours,
			amountMg: event.amountMg,
		});
	}
	return events;
}

function chemoRegimenBuildCombinedDoseEvents(regimenId, customDoseEvents) {
	var events = chemoRegimenBuildDoseEvents(regimenId);
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

function chemoRegimenBuildDrugList(regimenId) {
	var regimen = chemoRegimenGetById(regimenId);
	var drugs = [];
	for (var index = 0; index < regimen.drugIds.length; index += 1) {
		drugs.push(CHEMO_CONSTANTS.drugs[regimen.drugIds[index]]);
	}
	return drugs;
}
