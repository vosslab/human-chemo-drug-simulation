function chemoPkClamp(value, minimum, maximum) {
	return Math.max(minimum, Math.min(maximum, value));
}

function chemoPkBuildSimulationConfig(state) {
	return {
		regimenId: state.regimenId,
		timeStepHours: CHEMO_CONSTANTS.timeStepHours,
		durationHours: CHEMO_CONSTANTS.defaultDurationHours,
		bodyScale: state.bodyScale,
		tumorSensitivity: state.tumorSensitivity,
		playbackSpeed: state.playbackSpeed,
		simulationRunId: state.simulationRunId,
		customDoseEvents: state.customDoseEvents,
	};
}

function chemoPkBuildDoseMap(doseEvents, durationHours, timeStepHours) {
	var doseMap = {};
	var timeHour;
	for (timeHour = 0; timeHour <= durationHours; timeHour += timeStepHours) {
		doseMap[timeHour] = {};
	}
	var eventIndex;
	for (eventIndex = 0; eventIndex < doseEvents.length; eventIndex += 1) {
		var event = doseEvents[eventIndex];
		var startHour = Math.floor(event.startHour / timeStepHours) * timeStepHours;
		var endHour = Math.ceil((event.startHour + event.durationHours) / timeStepHours) * timeStepHours;
		var bucketCount = Math.max(1, Math.round((endHour - startHour) / timeStepHours));
		var bucketDose = event.amountMg / bucketCount;
		for (timeHour = startHour; timeHour < endHour; timeHour += timeStepHours) {
			if (!doseMap[timeHour]) {
				doseMap[timeHour] = {};
			}
			if (!doseMap[timeHour][event.drugId]) {
				doseMap[timeHour][event.drugId] = 0;
			}
			doseMap[timeHour][event.drugId] += bucketDose;
		}
	}
	return doseMap;
}

function chemoPkBuildDrugState(regimenDrugs) {
	var state = {};
	var index;
	for (index = 0; index < regimenDrugs.length; index += 1) {
		state[regimenDrugs[index].id] = {
			central: 0,
			peripheral: 0,
		};
	}
	return state;
}

function chemoPkRandom() {
	return Math.random();
}

function chemoPkStepDrugState(drug, currentState, doseMg, config) {
	var central = currentState.central;
	var peripheral = currentState.peripheral;
	var injected = doseMg / Math.max(drug.centralVolumeLiters * config.bodyScale, 1);
	central += injected;
	var transferProbability = chemoPkClamp(
		(config.timeStepHours / Math.max(drug.distributionHalfLifeHours * 2.2, 1)) * (0.55 + chemoPkRandom() * 0.85),
		0.02,
		0.94
	);
	var eliminationProbability = chemoPkClamp(
		(config.timeStepHours / Math.max(drug.eliminationHalfLifeHours * 1.8, 1)) * (0.45 + chemoPkRandom() * 0.95),
		0.01,
		0.9
	);
	var reboundProbability = chemoPkClamp(transferProbability * (0.08 + chemoPkRandom() * 0.16), 0.005, 0.2);
	var transferOut = central * transferProbability * 0.42;
	var rebound = peripheral * reboundProbability * 0.24;
	var eliminatedCentral = central * eliminationProbability * 0.33;
	var eliminatedPeripheral = peripheral * eliminationProbability * 0.12;
	central = Math.max(0, central - transferOut - eliminatedCentral + rebound);
	peripheral = Math.max(0, peripheral + transferOut - rebound - eliminatedPeripheral);
	return {
		central: central,
		peripheral: peripheral,
		concentration: central + peripheral,
	};
}

function chemoPkComputeResponseProbability(totalBurden, config) {
	var scaledBurden = totalBurden * config.tumorSensitivity * (1.15 / config.bodyScale);
	var logisticCenter = 12;
	var logisticSpread = 2.8;
	var baseline = 1 / (1 + Math.exp(-(scaledBurden - logisticCenter) / logisticSpread));
	var jitter = (chemoPkRandom() - 0.5) * 0.28;
	return chemoPkClamp(baseline + jitter, 0.03, 0.97);
}

function chemoPkUpdateTumorVolume(currentTumorVolume, responseProbability, totalBurden) {
	var tumorVolume = currentTumorVolume;
	var roll = chemoPkRandom();
	if (roll < responseProbability) {
		tumorVolume *= 1 - (0.012 + responseProbability * 0.045 + chemoPkRandom() * 0.02);
	} else {
		tumorVolume *= 1 + (0.002 + chemoPkRandom() * 0.014);
	}
	if (totalBurden < 0.75) {
		tumorVolume *= 1 + (0.004 + chemoPkRandom() * 0.01);
	}
	return chemoPkClamp(tumorVolume, 0.22, 1.22);
}

function chemoPkUpdatePatientState(currentHealth, totalBurden, visualState) {
	var toxicity = totalBurden * 0.008;
	var organStress = (visualState.liver + visualState.kidney + visualState.bloodstream) * 0.75;
	var randomShock = chemoPkRandom() * 0.7;
	var recovery = Math.max(0.9, 3.0 - (totalBurden * 0.003));
	if (totalBurden > 140) {
		toxicity += (totalBurden - 140) * 0.03;
	}
	if (totalBurden > 240) {
		toxicity += (totalBurden - 240) * 0.14;
	}
	var health = currentHealth - toxicity - organStress - randomShock + recovery;
	return chemoPkClamp(health, 0, 100);
}

function chemoPkBuildLifeStatus(patientHealth) {
	if (patientHealth <= 0) {
		return "Deceased";
	}
	if (patientHealth < 20) {
		return "Critical";
	}
	if (patientHealth < 45) {
		return "Unstable";
	}
	if (patientHealth < 70) {
		return "Fragile";
	}
	return "Stable";
}

function chemoPkBuildVisualState(regimenDrugs, concentrationMap, totalBurden, config, tumorVolume) {
	var visualState = {
		bloodstream: 0,
		liver: 0,
		kidney: 0,
		tumor: 0,
		clearance: 0,
		tumorRadius: 54,
		tumorShrinkFraction: 0,
	};
	var drugIndex;
	for (drugIndex = 0; drugIndex < regimenDrugs.length; drugIndex += 1) {
		var drug = regimenDrugs[drugIndex];
		var concentration = concentrationMap[drug.id] || 0;
		visualState.bloodstream += concentration * drug.bodyAffinity.bloodstream;
		visualState.liver += concentration * drug.bodyAffinity.liver;
		visualState.kidney += concentration * drug.bodyAffinity.kidney;
		visualState.tumor += concentration * drug.bodyAffinity.tumor * config.tumorSensitivity;
	}
	var normalizer = Math.max(totalBurden, 1);
	visualState.bloodstream = Math.min(1, visualState.bloodstream / (normalizer * 1.12));
	visualState.liver = Math.min(1, visualState.liver / (normalizer * 1.15));
	visualState.kidney = Math.min(1, visualState.kidney / (normalizer * 1.1));
	visualState.tumor = Math.min(1, visualState.tumor / (normalizer * 1.05));
	visualState.clearance = Math.min(1, (visualState.liver + visualState.kidney) / 2);
	visualState.tumorRadius = 28 + (tumorVolume * 42);
	visualState.tumorShrinkFraction = chemoPkClamp(1 - tumorVolume, 0, 0.78);
	return visualState;
}

function chemoPkBuildSamples(config) {
	var regimen = chemoRegimenGetById(config.regimenId);
	var doseEvents = chemoRegimenBuildCombinedDoseEvents(config.regimenId, config.customDoseEvents);
	var regimenDrugs = chemoRegimenBuildDrugList(config.regimenId);
	var doseMap = chemoPkBuildDoseMap(doseEvents, config.durationHours, config.timeStepHours);
	var drugState = chemoPkBuildDrugState(regimenDrugs);
	var tumorVolume = 1.05;
	var patientHealth = 100;
	var samples = [];
	var timeHour;
	for (timeHour = 0; timeHour <= config.durationHours; timeHour += config.timeStepHours) {
		var concentrationMap = {};
		var totalBurden = 0;
		var drugIndex;
		for (drugIndex = 0; drugIndex < regimenDrugs.length; drugIndex += 1) {
			var drug = regimenDrugs[drugIndex];
			var doseMg = 0;
			if (doseMap[timeHour] && doseMap[timeHour][drug.id]) {
				doseMg = doseMap[timeHour][drug.id];
			}
			var stepped = chemoPkStepDrugState(drug, drugState[drug.id], doseMg, config);
			drugState[drug.id] = {
				central: stepped.central,
				peripheral: stepped.peripheral,
			};
			concentrationMap[drug.id] = stepped.concentration;
			totalBurden += stepped.concentration;
		}
		var visualState = chemoPkBuildVisualState(regimenDrugs, concentrationMap, totalBurden, config, tumorVolume);
		var responseProbability = chemoPkComputeResponseProbability(totalBurden, config);
		tumorVolume = chemoPkUpdateTumorVolume(tumorVolume, responseProbability, totalBurden);
		visualState = chemoPkBuildVisualState(regimenDrugs, concentrationMap, totalBurden, config, tumorVolume);
		patientHealth = chemoPkUpdatePatientState(patientHealth, totalBurden, visualState);
		var lifeStatus = chemoPkBuildLifeStatus(patientHealth);
		samples.push({
			timeHour: timeHour,
			drugConcentrations: concentrationMap,
			totalBurden: totalBurden,
			tumorVolume: tumorVolume,
			responseProbability: responseProbability,
			patientHealth: patientHealth,
			lifeStatus: lifeStatus,
			visualState: visualState,
			regimenName: regimen.name,
		});
		if (lifeStatus === "Deceased") {
			break;
		}
	}
	return samples;
}

function chemoPkFindPeakExposure(samples) {
	var peak = 0;
	var index;
	for (index = 0; index < samples.length; index += 1) {
		peak = Math.max(peak, samples[index].totalBurden);
	}
	return peak;
}

function chemoPkFindMinimumTumorVolume(samples) {
	var minimum = 10;
	var index;
	for (index = 0; index < samples.length; index += 1) {
		minimum = Math.min(minimum, samples[index].tumorVolume);
	}
	return minimum;
}
