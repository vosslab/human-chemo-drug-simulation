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
// Derive body size and physiologic modifiers from patient-factor sliders
function chemoPkBuildPatientProfile(state) {
	var genderBalance = typeof state.genderBalance === "number" ? state.genderBalance : 0;
	var bmi = typeof state.bmi === "number" ? state.bmi : 24;
	var ageYears = typeof state.ageYears === "number" ? state.ageYears : 52;
	var activityLevel = typeof state.activityLevel === "number" ? state.activityLevel : 0.35;
	var heightCm = 162 + (genderBalance * 16);
	var heightMeters = heightCm / 100;
	var weightKg = bmi * heightMeters * heightMeters;
	var bsa = Math.sqrt((heightCm * weightKg) / 3600);
	var clearanceMultiplier = 1
		+ (activityLevel - 0.35) * 0.35
		+ (genderBalance * 0.04)
		- ((ageYears - 50) / 40) * 0.12
		- ((bmi - 24) / 20) * 0.08;
	var resilienceMultiplier = 1
		+ (activityLevel - 0.35) * 0.45
		- ((ageYears - 50) / 40) * 0.18
		- ((bmi - 24) / 20) * 0.10;
	return {
		genderBalance: genderBalance,
		heightCm: heightCm,
		weightKg: Math.max(42, weightKg),
		bsa: Math.max(1.2, bsa),
		ageYears: ageYears,
		bmi: bmi,
		activityLevel: activityLevel,
		clearanceMultiplier: chemoPkClamp(clearanceMultiplier, 0.65, 1.35),
		resilienceMultiplier: chemoPkClamp(resilienceMultiplier, 0.60, 1.40),
	};
}

// ============================================
// Estimate a normalized typical peak concentration for a drug
function chemoPkEstimateTypicalPeak(drug, config) {
	var weightKg = config.weightKg || SIM_DEFAULTS.patientWeightKg;
	var bsa = config.bsa || SIM_DEFAULTS.patientBSA;
	var doseMg = drug.typicalDoseMgM2 * bsa;
	var vdLiters = drug.vdLPerKg * weightKg;
	return Math.max(0.01, doseMg / Math.max(vdLiters, 0.01));
}

// ============================================
// Build a risk score for a particular adverse-effect rule
function chemoPkBuildAdverseEffectScore(effectRule, exposureRatio, cumulativeRatio, totalBurden, visualState, patientHealth) {
	if (effectRule === "acute") {
		return Math.max(exposureRatio / 0.18, totalBurden / 16);
	}
	if (effectRule === "marrow") {
		return Math.max(cumulativeRatio / 1.5, (100 - patientHealth) / 35);
	}
	if (effectRule === "renal") {
		return Math.max((visualState.kidney * exposureRatio) / 0.08, cumulativeRatio / 1.25);
	}
	if (effectRule === "cardiac") {
		return Math.max(cumulativeRatio / 1.55, ((100 - patientHealth) * exposureRatio) / 5);
	}
	if (effectRule === "pulmonary") {
		return Math.max(cumulativeRatio / 1.0, ((100 - patientHealth) + totalBurden) / 42);
	}
	if (effectRule === "neuro") {
		return Math.max(cumulativeRatio / 1.2, exposureRatio / 0.12);
	}
	if (effectRule === "mucositis") {
		return Math.max(cumulativeRatio / 0.95, exposureRatio / 0.1);
	}
	if (effectRule === "fatigue") {
		return Math.max((100 - patientHealth) / 28, totalBurden / 14);
	}
	if (effectRule === "cumulative") {
		return cumulativeRatio / 1.1;
	}
	return 0;
}

// ============================================
// Convert an adverse-effect score into a traffic-light severity band
function chemoPkBuildAdverseEffectSeverity(score) {
	if (score >= 1.2) {
		return "red";
	}
	if (score >= 0.65) {
		return "yellow";
	}
	return "green";
}

// ============================================
// Convert an adverse-effect score into a realized symptom probability
function chemoPkBuildAdverseEffectProbability(score, wasPresent) {
	var probability = chemoPkClamp(score * 0.45, 0.01, 0.98);
	if (wasPresent) {
		probability = Math.max(probability, chemoPkClamp(0.35 + (score * 0.22), 0.20, 0.98));
	}
	return probability;
}

// ============================================
// Build the realized adverse-effects list for the current simulated sample
function chemoPkBuildAdverseEffects(regimenDrugs, concentrationMap, totalBurden, visualState, cumulativeExposureMap, patientHealth, config, previousEffectStateMap) {
	var effectMap = {};
	var priorStateMap = previousEffectStateMap || {};
	var drugIndex;
	for (drugIndex = 0; drugIndex < regimenDrugs.length; drugIndex += 1) {
		var drug = regimenDrugs[drugIndex];
		var adverseEffects = drug.adverseEffects || [];
		var exposureRatio = (concentrationMap[drug.id] || 0) / chemoPkEstimateTypicalPeak(drug, config);
		var cumulativeRatio = cumulativeExposureMap[drug.id] || 0;
		var effectIndex;
		for (effectIndex = 0; effectIndex < adverseEffects.length; effectIndex += 1) {
			var effect = adverseEffects[effectIndex];
			if (!effectMap[effect.key]) {
				effectMap[effect.key] = {
					key: effect.key,
					label: effect.label,
					present: false,
					severity: "green",
					score: 0,
					sourceDrugs: [],
				};
			}
			effectMap[effect.key].sourceDrugs.push(drug.name);
			var effectScore = chemoPkBuildAdverseEffectScore(
				effect.rule,
				exposureRatio,
				cumulativeRatio,
				totalBurden,
				visualState,
				patientHealth
			);
			if (effectScore > effectMap[effect.key].score) {
				effectMap[effect.key].score = effectScore;
				effectMap[effect.key].severity = chemoPkBuildAdverseEffectSeverity(effectScore);
				effectMap[effect.key].active = effectMap[effect.key].severity !== "green";
			}
		}
	}
	var effectList = [];
	var nextEffectStateMap = {};
	var effectKeys = Object.keys(effectMap);
	var effectOrder = function(leftKey, rightKey) {
		var left = effectMap[leftKey];
		var right = effectMap[rightKey];
		var severityRank = { red: 0, yellow: 1, green: 2 };
		if (severityRank[left.severity] !== severityRank[right.severity]) {
			return severityRank[left.severity] - severityRank[right.severity];
		}
		return left.label.localeCompare(right.label);
	};
	effectKeys.sort(effectOrder);
	for (drugIndex = 0; drugIndex < effectKeys.length; drugIndex += 1) {
		var effectKey = effectKeys[drugIndex];
		var previousState = priorStateMap[effectKey] || {};
		var probability = chemoPkBuildAdverseEffectProbability(effectMap[effectKey].score, previousState.present);
		var isPresent = chemoPkRandom() < probability;
		var realizedSeverity = "green";
		if (isPresent) {
			realizedSeverity = effectMap[effectKey].score >= 1.2 ? "red" : "yellow";
		}
		effectMap[effectKey].present = isPresent;
		effectMap[effectKey].active = isPresent;
		effectMap[effectKey].severity = realizedSeverity;
		effectMap[effectKey].probability = probability;
		effectMap[effectKey].sourceDrugs.sort();
		nextEffectStateMap[effectKey] = {
			present: isPresent,
			severity: realizedSeverity,
		};
		effectList.push(effectMap[effectKey]);
	}
	return {
		effects: effectList,
		effectStateMap: nextEffectStateMap,
	};
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
function chemoPkOneCompartment(drug, doseMg, elapsedMinutes, weightKg, clearanceMultiplier) {
	// elimination rate constant: ke = ln(2) / half-life
	var ke = (0.693 / drug.halfLifeMinutes) * (clearanceMultiplier || 1);
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
function chemoPkTwoCompartment(drug, doseMg, elapsedMinutes, weightKg, clearanceMultiplier) {
	// alpha rate from distribution half-life
	var alphaRate = (0.693 / drug.halfLifeAlphaMinutes) * (clearanceMultiplier || 1);
	// beta rate from elimination half-life
	var betaRate = (0.693 / drug.halfLifeBetaMinutes) * (clearanceMultiplier || 1);
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
function chemoPkConcentrationAtTime(drug, doseMg, doseTimeMins, currentTimeMins, weightKg, clearanceMultiplier) {
	var elapsedMinutes = currentTimeMins - doseTimeMins;
	// dose not yet administered
	if (elapsedMinutes < 0) {
		return 0;
	}
	if (drug.compartments === 2) {
		return chemoPkTwoCompartment(drug, doseMg, elapsedMinutes, weightKg, clearanceMultiplier);
	}
	return chemoPkOneCompartment(drug, doseMg, elapsedMinutes, weightKg, clearanceMultiplier);
}

// ============================================
// Calculate total concentration from multiple doses using superposition
// doses: array of {timeMins, amountMg}
function chemoPkMultiDoseConcentration(drug, doses, currentTimeMins, weightKg, clearanceMultiplier) {
	var totalConcentration = 0;
	var index;
	for (index = 0; index < doses.length; index += 1) {
		totalConcentration += chemoPkConcentrationAtTime(
			drug, doses[index].amountMg, doses[index].timeMins,
			currentTimeMins, weightKg, clearanceMultiplier
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
	var patientProfile = chemoPkBuildPatientProfile(state);
	return {
		regimenId: state.regimenId,
		timeStepHours: CHEMO_CONSTANTS.timeStepHours,
		durationHours: CHEMO_CONSTANTS.defaultDurationHours,
		bodyScale: state.bodyScale,
		tumorSensitivity: state.tumorSensitivity,
		playbackSpeed: state.playbackSpeed,
		simulationRunId: state.simulationRunId,
		bsa: patientProfile.bsa,
		weightKg: patientProfile.weightKg,
		patientProfile: patientProfile,
		ageYears: patientProfile.ageYears,
		bmi: patientProfile.bmi,
		activityLevel: patientProfile.activityLevel,
		clearanceMultiplier: patientProfile.clearanceMultiplier,
		resilienceMultiplier: patientProfile.resilienceMultiplier,
		doseMultiplier: state.doseMultiplier || 1.0,
		doseCount: state.doseCount || chemoRegimenGetDefaultDoseCount(state.regimenId),
		doseIntervalDays: state.doseIntervalDays || chemoRegimenGetDefaultDoseIntervalDays(state.regimenId),
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
	if (tumorVolume <= 0.005) {
		return 0;
	}
	var roll = chemoPkRandom();
	if (roll < responseProbability) {
		// tumor shrinks: rate proportional to response probability
		var killFraction = 0.010 + responseProbability * 0.035 + chemoPkRandom() * 0.015;
		killFraction += Math.min(0.30, totalBurden * 0.0045);
		tumorVolume *= 1 - Math.min(0.92, killFraction);
	} else {
		// tumor grows very slowly when treatment is ineffective
		tumorVolume *= 1 + (0.001 + chemoPkRandom() * 0.003);
	}
	// minimal regrowth when no drug exposure
	if (totalBurden < 0.5) {
		tumorVolume *= 1 + (0.001 + chemoPkRandom() * 0.002);
	}
	if (tumorVolume < 0.02 && responseProbability > 0.85 && totalBurden > 8) {
		return 0;
	}
	if (tumorVolume <= 0.005) {
		return 0;
	}
	return chemoPkClamp(tumorVolume, 0, 1.25);
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
	visualState.tumorRadius = tumorVolume <= 0 ? 0 : 8 + (tumorVolume * 62);
	visualState.tumorShrinkFraction = chemoPkClamp(1 - tumorVolume, 0, 1);
	return visualState;
}

// ============================================
// Update patient health based on organ burden
// Deterministic toxicity model (no random shock for reproducibility)
function chemoPkUpdatePatientState(currentHealth, totalBurden, visualState, config) {
	var resilienceMultiplier = config.resilienceMultiplier || 1;
	// base toxicity proportional to drug burden
	var toxicity = totalBurden * 0.04 / resilienceMultiplier;
	// organ stress from liver and kidney processing
	var organStress = (visualState.liver + visualState.kidney + visualState.bloodstream) * (0.8 / resilienceMultiplier);
	// natural recovery (drops sharply when burden is high)
	var recovery = Math.max(0.2, (1.2 - (totalBurden * 0.02)) * resilienceMultiplier);
	// escalating toxicity at high burdens: narrow therapeutic window
	if (totalBurden > 15) {
		toxicity += (totalBurden - 15) * 0.05 / resilienceMultiplier;
	}
	if (totalBurden > 40) {
		toxicity += (totalBurden - 40) * 0.15 / resilienceMultiplier;
	}
	if (totalBurden > 80) {
		toxicity += (totalBurden - 80) * 0.4 / resilienceMultiplier;
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
	var patientProfile = config.patientProfile || chemoPkBuildPatientProfile(config);
	config.patientProfile = patientProfile;
	config.bsa = patientProfile.bsa;
	config.weightKg = patientProfile.weightKg;
	config.clearanceMultiplier = patientProfile.clearanceMultiplier;
	config.resilienceMultiplier = patientProfile.resilienceMultiplier;
	var regimen = chemoRegimenGetById(config.regimenId);
	var doseEvents = chemoRegimenBuildDoseEvents(
		config.regimenId, config.bsa,
		config.doseMultiplier, config.doseCount, config.doseIntervalDays
	);
	var regimenDrugs = chemoRegimenBuildDrugList(config.regimenId);
	var weightKg = config.weightKg || SIM_DEFAULTS.patientWeightKg;
	var clearanceMultiplier = config.clearanceMultiplier || 1;
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
	var cumulativeExposureMap = {};
	var effectStateMap = {};
	for (drugIndex = 0; drugIndex < regimenDrugs.length; drugIndex += 1) {
		cumulativeExposureMap[regimenDrugs[drugIndex].id] = 0;
	}
	var timeHour;
	for (timeHour = 0; timeHour <= config.durationHours; timeHour += config.timeStepHours) {
		var timeMins = timeHour * 60;
		var concentrationMap = {};
		var totalBurden = 0;
		// calculate concentration for each drug using superposition
		for (drugIndex = 0; drugIndex < regimenDrugs.length; drugIndex += 1) {
			var drug = regimenDrugs[drugIndex];
			var doses = drugDoseArrays[drug.id] || [];
			var drugConc = chemoPkMultiDoseConcentration(drug, doses, timeMins, weightKg, clearanceMultiplier);
			concentrationMap[drug.id] = drugConc;
			totalBurden += drugConc;
			cumulativeExposureMap[drug.id] += (drugConc / chemoPkEstimateTypicalPeak(drug, config)) * config.timeStepHours;
		}
		// build visual state and tumor/health response
		var visualState = chemoPkBuildVisualState(regimenDrugs, concentrationMap, totalBurden, config, tumorVolume);
		var responseProbability = chemoPkComputeResponseProbability(totalBurden, config);
		tumorVolume = chemoPkUpdateTumorVolume(tumorVolume, responseProbability, totalBurden);
		// rebuild visual state with updated tumor volume
		visualState = chemoPkBuildVisualState(regimenDrugs, concentrationMap, totalBurden, config, tumorVolume);
		patientHealth = chemoPkUpdatePatientState(patientHealth, totalBurden, visualState, config);
		var lifeStatus = chemoPkBuildLifeStatus(patientHealth);
		var adverseEffectResult = chemoPkBuildAdverseEffects(
			regimenDrugs,
			concentrationMap,
			totalBurden,
			visualState,
			cumulativeExposureMap,
			patientHealth,
			config,
			effectStateMap
		);
		var adverseEffects = adverseEffectResult.effects;
		effectStateMap = adverseEffectResult.effectStateMap;
		samples.push({
			timeHour: timeHour,
			drugConcentrations: concentrationMap,
			totalBurden: totalBurden,
			tumorVolume: tumorVolume,
			responseProbability: responseProbability,
			patientHealth: patientHealth,
			lifeStatus: lifeStatus,
			patientProfile: config.patientProfile,
			adverseEffects: adverseEffects,
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
