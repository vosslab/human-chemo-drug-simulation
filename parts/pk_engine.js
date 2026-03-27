// ============================================
// pk_engine.js -- Pharmacokinetic engine with exponential decay models
// ============================================
// Uses canonical units: time in minutes, amount in mg, volume in L, concentration in mg/L
// Vd source is L/kg, converted to total L using patient weight at calculation time
// ============================================

// ============================================
// Utility: clamp value between minimum and maximum
function chemoPkClamp(value, minimum, maximum) {
	return Math.max(minimum, Math.min(maximum, value));
}

// ============================================
// PRNG for reproducible stochastic tumor response (pedagogic noise)
function chemoPkRandom() {
	return Math.random();
}

// ============================================
// One-compartment exponential decay: C(t) = C0 * e^(-ke * t)
// drug: object from DRUG_DATA
// doseMg: dose amount in mg
// elapsedMinutes: time since dose administration in minutes
// weightKg: patient weight for Vd conversion
function chemoPkOneCompartment(drug, doseMg, elapsedMinutes, weightKg) {
	// elimination rate constant: ke = ln(2) / half-life
	var ke = 0.693 / drug.halfLifeMinutes;
	// initial concentration: C0 = dose / (Vd_L/kg * weight_kg)
	var vdLiters = drug.vdLPerKg * weightKg;
	var c0 = doseMg / vdLiters;
	// exponential decay
	var concentration = c0 * Math.exp(-ke * elapsedMinutes);
	return Math.max(0, concentration);
}

// ============================================
// Two-compartment biphasic decay: C(t) = A*e^(-alpha*t) + B*e^(-beta*t)
// Alpha phase: rapid initial distribution
// Beta phase: slow terminal elimination
function chemoPkTwoCompartment(drug, doseMg, elapsedMinutes, weightKg) {
	// alpha rate from distribution half-life
	var alphaRate = 0.693 / drug.halfLifeAlphaMinutes;
	// beta rate from elimination half-life
	var betaRate = 0.693 / drug.halfLifeBetaMinutes;
	// total initial concentration
	var vdLiters = drug.vdLPerKg * weightKg;
	var cTotal = doseMg / vdLiters;
	// split into rapid (70%) and slow (30%) components
	var componentA = 0.7 * cTotal;
	var componentB = 0.3 * cTotal;
	// biphasic decay
	var concentration = componentA * Math.exp(-alphaRate * elapsedMinutes)
		+ componentB * Math.exp(-betaRate * elapsedMinutes);
	return Math.max(0, concentration);
}

// ============================================
// Calculate concentration for a single dose at a given time
// Dispatches to one-compartment or two-compartment based on drug properties
// doseTimeMins: when the dose was administered (in simulation minutes)
// currentTimeMins: current simulation time in minutes
function chemoPkConcentrationAtTime(drug, doseMg, doseTimeMins, currentTimeMins, weightKg) {
	var elapsedMinutes = currentTimeMins - doseTimeMins;
	// dose not yet administered
	if (elapsedMinutes < 0) {
		return 0;
	}
	if (drug.compartments === 2) {
		return chemoPkTwoCompartment(drug, doseMg, elapsedMinutes, weightKg);
	}
	return chemoPkOneCompartment(drug, doseMg, elapsedMinutes, weightKg);
}

// ============================================
// Calculate total concentration from multiple doses using superposition
// doses: array of {timeMins, amountMg}
function chemoPkMultiDoseConcentration(drug, doses, currentTimeMins, weightKg) {
	var totalConcentration = 0;
	var index;
	for (index = 0; index < doses.length; index += 1) {
		totalConcentration += chemoPkConcentrationAtTime(
			drug, doses[index].amountMg, doses[index].timeMins,
			currentTimeMins, weightKg
		);
	}
	return totalConcentration;
}

// ============================================
// Derive organ concentrations from plasma concentration using extraction ratios
function chemoPkOrganConcentrations(drug, plasmaConc) {
	// determine clearance route from drug properties
	var route = "hepatic";
	if (drug.primaryOrgan === "kidney") {
		route = "renal";
	}
	if (drug.excretionOrgan === "bile") {
		route = "biliary";
	}
	var liverRatio = ORGAN_EXTRACTION.liver[route];
	var kidneyRatio = ORGAN_EXTRACTION.kidney[route];
	var tissueRatio = ORGAN_EXTRACTION.tissue[route];
	return {
		plasma: plasmaConc,
		liver: plasmaConc * liverRatio,
		kidney: plasmaConc * kidneyRatio,
		tissue: plasmaConc * tissueRatio,
	};
}

// ============================================
// Build simulation config from current state
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
		bsa: state.bsa || SIM_DEFAULTS.patientBSA,
		weightKg: state.weightKg || SIM_DEFAULTS.patientWeightKg,
	};
}

// ============================================
// Build a dose map from dose events: {timeHour: {drugId: doseMg}}
function chemoPkBuildDoseMap(doseEvents, durationHours, timeStepHours) {
	var doseMap = {};
	var timeHour;
	for (timeHour = 0; timeHour <= durationHours; timeHour += timeStepHours) {
		doseMap[timeHour] = {};
	}
	var eventIndex;
	for (eventIndex = 0; eventIndex < doseEvents.length; eventIndex += 1) {
		var event = doseEvents[eventIndex];
		// snap dose to nearest time step
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

// ============================================
// Compute tumor response probability from total burden
// Uses logistic function; center and spread tuned for exponential decay PK scale
function chemoPkComputeResponseProbability(totalBurden, config) {
	var scaledBurden = totalBurden * config.tumorSensitivity * (1.15 / config.bodyScale);
	// logistic center tuned for typical ABVD burden range
	// at burden=2 response ~50%, at burden=10 response ~90%
	var logisticCenter = 2;
	var logisticSpread = 2.5;
	var baseline = 1 / (1 + Math.exp(-(scaledBurden - logisticCenter) / logisticSpread));
	// light pedagogic noise in tumor response only
	var jitter = (chemoPkRandom() - 0.5) * 0.18;
	return chemoPkClamp(baseline + jitter, 0.03, 0.97);
}

// ============================================
// Update tumor volume based on response probability
function chemoPkUpdateTumorVolume(currentTumorVolume, responseProbability, totalBurden) {
	var tumorVolume = currentTumorVolume;
	var roll = chemoPkRandom();
	if (roll < responseProbability) {
		// tumor shrinks: rate proportional to response probability
		tumorVolume *= 1 - (0.010 + responseProbability * 0.035 + chemoPkRandom() * 0.015);
	} else {
		// tumor grows very slowly when treatment is ineffective
		tumorVolume *= 1 + (0.001 + chemoPkRandom() * 0.003);
	}
	// minimal regrowth when no drug exposure
	if (totalBurden < 0.5) {
		tumorVolume *= 1 + (0.001 + chemoPkRandom() * 0.002);
	}
	return chemoPkClamp(tumorVolume, 0.15, 1.25);
}

// ============================================
// Build visual state for body rendering from drug concentrations
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
	// normalize organ intensities to 0-1 range
	// use a reference scale based on typical burden levels
	var normalizer = Math.max(totalBurden, 0.5) * 1.2;
	visualState.bloodstream = Math.min(1, visualState.bloodstream / normalizer);
	visualState.liver = Math.min(1, visualState.liver / normalizer);
	visualState.kidney = Math.min(1, visualState.kidney / normalizer);
	visualState.tumor = Math.min(1, visualState.tumor / normalizer);
	visualState.clearance = Math.min(1, (visualState.liver + visualState.kidney) / 2);
	// tumor visual sizing
	visualState.tumorRadius = 28 + (tumorVolume * 42);
	visualState.tumorShrinkFraction = chemoPkClamp(1 - tumorVolume, 0, 0.78);
	return visualState;
}

// ============================================
// Update patient health based on organ burden
// Deterministic toxicity model (no random shock for reproducibility)
function chemoPkUpdatePatientState(currentHealth, totalBurden, visualState) {
	// base toxicity proportional to drug burden
	var toxicity = totalBurden * 0.012;
	// organ stress from liver and kidney processing
	var organStress = (visualState.liver + visualState.kidney + visualState.bloodstream) * 0.6;
	// natural recovery (less when burden is high)
	var recovery = Math.max(0.4, 1.8 - (totalBurden * 0.008));
	// escalating toxicity at high burdens
	if (totalBurden > 20) {
		toxicity += (totalBurden - 20) * 0.025;
	}
	if (totalBurden > 50) {
		toxicity += (totalBurden - 50) * 0.08;
	}
	var health = currentHealth - toxicity - organStress + recovery;
	return chemoPkClamp(health, 0, 100);
}

// ============================================
// Determine life status string from health value
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

// ============================================
// Build all simulation samples using exponential decay PK with dose superposition
// This is the main simulation function: pre-computes the full sample array
function chemoPkBuildSamples(config) {
	var regimen = chemoRegimenGetById(config.regimenId);
	var doseEvents = chemoRegimenBuildCombinedDoseEvents(config.regimenId, config.customDoseEvents, config.bsa);
	var regimenDrugs = chemoRegimenBuildDrugList(config.regimenId);
	var weightKg = config.weightKg || SIM_DEFAULTS.patientWeightKg;
	// build per-drug dose arrays for superposition
	var drugDoseArrays = {};
	var drugIndex;
	for (drugIndex = 0; drugIndex < regimenDrugs.length; drugIndex += 1) {
		drugDoseArrays[regimenDrugs[drugIndex].id] = [];
	}
	// distribute dose events into per-drug arrays
	var eventIndex;
	for (eventIndex = 0; eventIndex < doseEvents.length; eventIndex += 1) {
		var event = doseEvents[eventIndex];
		if (!drugDoseArrays[event.drugId]) {
			drugDoseArrays[event.drugId] = [];
		}
		// convert dose event startHour to minutes for internal calculation
		drugDoseArrays[event.drugId].push({
			timeMins: event.startHour * 60,
			amountMg: event.amountMg,
		});
	}
	var tumorVolume = 1.05;
	var patientHealth = 100;
	var samples = [];
	var timeHour;
	for (timeHour = 0; timeHour <= config.durationHours; timeHour += config.timeStepHours) {
		var timeMins = timeHour * 60;
		var concentrationMap = {};
		var totalBurden = 0;
		// calculate concentration for each drug using superposition
		for (drugIndex = 0; drugIndex < regimenDrugs.length; drugIndex += 1) {
			var drug = regimenDrugs[drugIndex];
			var doses = drugDoseArrays[drug.id] || [];
			var drugConc = chemoPkMultiDoseConcentration(drug, doses, timeMins, weightKg);
			concentrationMap[drug.id] = drugConc;
			totalBurden += drugConc;
		}
		// build visual state and tumor/health response
		var visualState = chemoPkBuildVisualState(regimenDrugs, concentrationMap, totalBurden, config, tumorVolume);
		var responseProbability = chemoPkComputeResponseProbability(totalBurden, config);
		tumorVolume = chemoPkUpdateTumorVolume(tumorVolume, responseProbability, totalBurden);
		// rebuild visual state with updated tumor volume
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
		// stop simulation if patient dies
		if (lifeStatus === "Deceased") {
			break;
		}
	}
	return samples;
}

// ============================================
// Find peak total burden across all samples
function chemoPkFindPeakExposure(samples) {
	var peak = 0;
	var index;
	for (index = 0; index < samples.length; index += 1) {
		peak = Math.max(peak, samples[index].totalBurden);
	}
	return peak;
}

// ============================================
// Find minimum tumor volume across all samples
function chemoPkFindMinimumTumorVolume(samples) {
	var minimum = 10;
	var index;
	for (index = 0; index < samples.length; index += 1) {
		minimum = Math.min(minimum, samples[index].tumorVolume);
	}
	return minimum;
}
