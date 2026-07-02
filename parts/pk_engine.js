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
// Map randomness mode to simulation noise intensity
function chemoPkGetRandomnessScale(config) {
  var mode = config.randomnessMode || "clinical";
  if (mode === "deterministic") {
    return 0;
  }
  if (mode === "chaotic") {
    return 1.8;
  }
  return 1;
}

// ============================================
// Normalize regimen-level efficacy and toxicity modifiers
function chemoPkGetRegimenProfile(config) {
  var regimen = chemoRegimenGetById(config.regimenId);
  return {
    efficacyWeight: regimen.efficacyWeight || 1,
    acuteToxicityWeight: regimen.acuteToxicityWeight || 1,
    cumulativeToxicityWeight: regimen.cumulativeToxicityWeight || 1,
    recoveryPenalty: regimen.recoveryPenalty || 1,
    volatility: regimen.volatility || 1,
  };
}

// ============================================
// Derive body size and physiologic modifiers from patient-factor sliders
function chemoPkBuildPatientProfile(state) {
  var caseProfile = state.caseProfile || null;
  var genderBalance = typeof state.genderBalance === "number" ? state.genderBalance : 0;
  var bmi = typeof state.bmi === "number" ? state.bmi : 24;
  var ageYears = typeof state.ageYears === "number" ? state.ageYears : 52;
  var activityLevel = typeof state.activityLevel === "number" ? state.activityLevel : 0.35;
  var heightCm = 162 + genderBalance * 16;
  var heightMeters = heightCm / 100;
  var weightKg = bmi * heightMeters * heightMeters;
  var bsa = Math.sqrt((heightCm * weightKg) / 3600);
  var clearanceMultiplier =
    1 +
    (activityLevel - 0.35) * 0.35 +
    genderBalance * 0.04 -
    ((ageYears - 50) / 40) * 0.12 -
    ((bmi - 24) / 20) * 0.08;
  var resilienceMultiplier =
    1 + (activityLevel - 0.35) * 0.45 - ((ageYears - 50) / 40) * 0.18 - ((bmi - 24) / 20) * 0.1;
  if (caseProfile) {
    clearanceMultiplier *= caseProfile.clearanceMultiplier || 1;
    resilienceMultiplier *= caseProfile.resilienceMultiplier || 1;
  }
  return {
    genderBalance: genderBalance,
    heightCm: heightCm,
    weightKg: Math.max(42, weightKg),
    bsa: Math.max(1.2, bsa),
    ageYears: ageYears,
    bmi: bmi,
    activityLevel: activityLevel,
    renalReserve: caseProfile ? caseProfile.renalReserve : 1,
    hepaticReserve: caseProfile ? caseProfile.hepaticReserve : 1,
    marrowReserve: caseProfile ? caseProfile.marrowReserve : 1,
    clearanceMultiplier: chemoPkClamp(clearanceMultiplier, 0.65, 1.35),
    resilienceMultiplier: chemoPkClamp(resilienceMultiplier, 0.6, 1.4),
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
function chemoPkBuildAdverseEffectScore(
  effectRule,
  exposureRatio,
  cumulativeRatio,
  totalBurden,
  visualState,
  patientHealth,
) {
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
    return Math.max(cumulativeRatio / 1.0, (100 - patientHealth + totalBurden) / 42);
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
function chemoPkBuildAdverseEffectProbability(score, wasPresent, randomnessScale) {
  var probability = chemoPkClamp(score * 0.45, 0.01, 0.98);
  if (wasPresent) {
    probability = Math.max(probability, chemoPkClamp(0.35 + score * 0.22, 0.2, 0.98));
  }
  if (typeof randomnessScale === "number" && randomnessScale === 0) {
    if (score >= 1.2) {
      return 1;
    }
    if (score <= 0.55) {
      return 0;
    }
    return chemoPkClamp((score - 0.55) / 0.65, 0, 1);
  }
  return probability;
}

// ============================================
// Evaluate therapeutic window status from total burden
function chemoPkBuildTherapeuticWindowStatus(totalBurden, config) {
  var regimen = chemoRegimenGetById(config.regimenId);
  var windowSpec = regimen.therapeuticWindow || { ineffectiveMax: 1.5, toxicMin: 12 };
  if (totalBurden < windowSpec.ineffectiveMax) {
    return "ineffective";
  }
  if (totalBurden >= windowSpec.toxicMin) {
    return "toxic";
  }
  return "optimal";
}

// ============================================
// Build event log entries for a timestep transition
function chemoPkBuildStepEvents(previousSample, currentSample) {
  var entries = [];
  var dayText = "Day " + Math.floor(currentSample.timeHour / 24);
  if (
    currentSample.therapeuticWindowStatus === "optimal" &&
    (!previousSample || previousSample.therapeuticWindowStatus !== "optimal")
  ) {
    entries.push(dayText + ": exposure entered the therapeutic window.");
  }
  if (
    currentSample.therapeuticWindowStatus === "toxic" &&
    (!previousSample || previousSample.therapeuticWindowStatus !== "toxic")
  ) {
    entries.push(dayText + ": exposure crossed into the toxic range.");
  }
  if (previousSample && previousSample.tumorVolume >= 0.5 && currentSample.tumorVolume < 0.5) {
    entries.push(dayText + ": tumor burden dropped below 50% of baseline.");
  }
  if (previousSample && previousSample.patientHealth >= 60 && currentSample.patientHealth < 60) {
    entries.push(dayText + ": patient vitality fell below 60%.");
  }
  if (previousSample) {
    var effectIndex;
    var previousEffects = {};
    for (effectIndex = 0; effectIndex < previousSample.adverseEffects.length; effectIndex += 1) {
      previousEffects[previousSample.adverseEffects[effectIndex].key] =
        previousSample.adverseEffects[effectIndex];
    }
    for (effectIndex = 0; effectIndex < currentSample.adverseEffects.length; effectIndex += 1) {
      var effect = currentSample.adverseEffects[effectIndex];
      var priorEffect = previousEffects[effect.key];
      if (effect.present && (!priorEffect || !priorEffect.present)) {
        entries.push(dayText + ": " + effect.label.toLowerCase() + " started.");
      }
      if (effect.severity === "red" && (!priorEffect || priorEffect.severity !== "red")) {
        entries.push(dayText + ": " + effect.label.toLowerCase() + " became severe.");
      }
    }
  }
  if (
    currentSample.lifeStatus === "Deceased" &&
    (!previousSample || previousSample.lifeStatus !== "Deceased")
  ) {
    entries.push(dayText + ": patient died.");
  }
  return entries;
}

// ============================================
// Build an end-of-run scorecard and grade
function chemoPkBuildRunSummary(samples, config) {
  var firstSample = samples[0];
  var lastSample = samples[samples.length - 1];
  var peakExposure = chemoPkFindPeakExposure(samples);
  var minTumor = chemoPkFindMinimumTumorVolume(samples);
  var tumorReduction = chemoPkClamp(
    (1 - minTumor / Math.max(firstSample.tumorVolume, 0.01)) * 100,
    0,
    100,
  );
  var toxicityBurden = chemoPkClamp(100 - peakExposure * 3.2, 0, 100);
  var survivalScore =
    lastSample.lifeStatus === "Deceased" ? 0 : chemoPkClamp(lastSample.patientHealth, 0, 100);
  var responseTimeIndex = 0;
  var sampleIndex;
  for (sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    if (samples[sampleIndex].tumorVolume <= 0.5) {
      responseTimeIndex = sampleIndex;
      break;
    }
  }
  var responseTimeHours = samples[Math.min(responseTimeIndex, samples.length - 1)].timeHour;
  var speedScore = responseTimeHours > 0 ? chemoPkClamp(100 - responseTimeHours / 6, 0, 100) : 25;
  var overTreatmentPenalty = chemoPkClamp(Math.max(0, peakExposure - 14) * 4, 0, 100);
  var totalScore =
    tumorReduction * 0.3 +
    toxicityBurden * 0.2 +
    survivalScore * 0.25 +
    speedScore * 0.15 +
    (100 - overTreatmentPenalty) * 0.1;
  var grade;
  if (totalScore >= 90) {
    grade = "A";
  } else if (totalScore >= 80) {
    grade = "B";
  } else if (totalScore >= 70) {
    grade = "C";
  } else if (totalScore >= 60) {
    grade = "D";
  } else {
    grade = "F";
  }
  return {
    grade: grade,
    totalScore: Math.round(totalScore),
    tumorReduction: Math.round(tumorReduction),
    toxicityBurden: Math.round(toxicityBurden),
    survival: Math.round(survivalScore),
    speed: Math.round(speedScore),
    overTreatmentPenalty: Math.round(overTreatmentPenalty),
    mysteryTraitLabel: config.caseProfile ? config.caseProfile.mysteryTraitLabel : "",
  };
}

// ============================================
// Build the realized adverse-effects list for the current simulated sample
function chemoPkBuildAdverseEffects(
  regimenDrugs,
  concentrationMap,
  totalBurden,
  visualState,
  cumulativeExposureMap,
  patientHealth,
  config,
  previousEffectStateMap,
) {
  var effectMap = {};
  var priorStateMap = previousEffectStateMap || {};
  var regimenProfile = config.regimenProfile || chemoPkGetRegimenProfile(config);
  var patientProfile = config.patientProfile || {};
  var randomnessScale = chemoPkGetRandomnessScale(config);
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
        patientHealth,
      );
      if (effect.rule === "acute" || effect.rule === "fatigue") {
        effectScore *= regimenProfile.acuteToxicityWeight;
      } else {
        effectScore *= regimenProfile.cumulativeToxicityWeight;
      }
      if (effect.rule === "renal") {
        effectScore *= 1 / Math.max(patientProfile.renalReserve || 1, 0.55);
      }
      if (effect.rule === "marrow") {
        effectScore *= 1 / Math.max(patientProfile.marrowReserve || 1, 0.55);
      }
      if (effect.rule === "pulmonary") {
        effectScore *= 1 / Math.max(patientProfile.hepaticReserve || 1, 0.65);
      }
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
  var effectOrder = function (leftKey, rightKey) {
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
    var probability = chemoPkBuildAdverseEffectProbability(
      effectMap[effectKey].score,
      previousState.present,
      randomnessScale,
    );
    var isPresent = randomnessScale === 0 ? probability >= 0.5 : chemoPkRandom() < probability;
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
  var concentration =
    componentA * Math.exp(-alphaRate * elapsedMinutes) +
    componentB * Math.exp(-betaRate * elapsedMinutes);
  return Math.max(0, concentration);
}

// ============================================
// Calculate concentration for a single dose at a given time
// Dispatches to one-compartment or two-compartment based on drug properties
// doseTimeMins: when the dose was administered (in simulation minutes)
// currentTimeMins: current simulation time in minutes
function chemoPkConcentrationAtTime(
  drug,
  doseMg,
  doseTimeMins,
  currentTimeMins,
  weightKg,
  clearanceMultiplier,
) {
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
function chemoPkMultiDoseConcentration(
  drug,
  doses,
  currentTimeMins,
  weightKg,
  clearanceMultiplier,
) {
  var totalConcentration = 0;
  var index;
  for (index = 0; index < doses.length; index += 1) {
    totalConcentration += chemoPkConcentrationAtTime(
      drug,
      doses[index].amountMg,
      doses[index].timeMins,
      currentTimeMins,
      weightKg,
      clearanceMultiplier,
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
  var regimenProfile = chemoPkGetRegimenProfile(state);
  var doseCount = state.doseCount || chemoRegimenGetDefaultDoseCount(state.regimenId);
  var doseIntervalDays =
    state.doseIntervalDays || chemoRegimenGetDefaultDoseIntervalDays(state.regimenId);
  var lastDoseHour = Math.max(0, (doseCount - 1) * doseIntervalDays * 24);
  var durationHours = Math.max(CHEMO_CONSTANTS.defaultDurationHours, lastDoseHour + 240);
  return {
    regimenId: state.regimenId,
    timeStepHours: CHEMO_CONSTANTS.timeStepHours,
    durationHours: durationHours,
    bodyScale: state.bodyScale,
    tumorSensitivity: state.tumorSensitivity,
    playbackSpeed: state.playbackSpeed,
    simulationRunId: state.simulationRunId,
    bsa: patientProfile.bsa,
    weightKg: patientProfile.weightKg,
    patientProfile: patientProfile,
    regimenProfile: regimenProfile,
    ageYears: patientProfile.ageYears,
    bmi: patientProfile.bmi,
    activityLevel: patientProfile.activityLevel,
    clearanceMultiplier: patientProfile.clearanceMultiplier,
    resilienceMultiplier: patientProfile.resilienceMultiplier,
    randomnessMode: state.randomnessMode || "clinical",
    caseProfile: state.caseProfile || null,
    doseMultiplier: state.doseMultiplier || 1.0,
    doseCount: doseCount,
    doseIntervalDays: doseIntervalDays,
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
    var endHour =
      Math.ceil((event.startHour + event.durationHours) / timeStepHours) * timeStepHours;
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
  var regimenProfile = config.regimenProfile || chemoPkGetRegimenProfile(config);
  var caseProfile = config.caseProfile || null;
  var efficacyMultiplier =
    caseProfile && caseProfile.efficacyMultiplier ? caseProfile.efficacyMultiplier : 1;
  var scaledBurden =
    totalBurden *
    config.tumorSensitivity *
    efficacyMultiplier *
    regimenProfile.efficacyWeight *
    (1.15 / config.bodyScale);
  // logistic center tuned for typical ABVD burden range
  // at burden=2 response ~50%, at burden=10 response ~90%
  var logisticCenter = 2;
  var logisticSpread = 2.5;
  var baseline = 1 / (1 + Math.exp(-(scaledBurden - logisticCenter) / logisticSpread));
  // light pedagogic noise in tumor response only
  var jitter =
    (chemoPkRandom() - 0.5) * 0.18 * regimenProfile.volatility * chemoPkGetRandomnessScale(config);
  return chemoPkClamp(baseline + jitter, 0.03, 0.97);
}

// ============================================
// Update tumor volume based on response probability
function chemoPkUpdateTumorVolume(currentTumorVolume, responseProbability, totalBurden, config) {
  var tumorVolume = currentTumorVolume;
  var randomnessScale = chemoPkGetRandomnessScale(config || {});
  if (tumorVolume <= 0.005) {
    return 0;
  }
  var roll = randomnessScale === 0 ? (responseProbability > 0.5 ? 0 : 1) : chemoPkRandom();
  if (roll < responseProbability) {
    // tumor shrinks: rate proportional to response probability
    var killFraction =
      0.01 + responseProbability * 0.035 + chemoPkRandom() * 0.015 * Math.max(randomnessScale, 0.2);
    killFraction += Math.min(0.3, totalBurden * 0.0045);
    tumorVolume *= 1 - Math.min(0.92, killFraction);
  } else {
    // tumor grows very slowly when treatment is ineffective
    tumorVolume *= 1 + (0.001 + chemoPkRandom() * 0.003 * Math.max(randomnessScale, 0.2));
  }
  // minimal regrowth when no drug exposure
  if (totalBurden < 0.5) {
    tumorVolume *= 1 + (0.001 + chemoPkRandom() * 0.002 * Math.max(randomnessScale, 0.2));
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
  visualState.tumorRadius = tumorVolume <= 0 ? 0 : 8 + tumorVolume * 62;
  visualState.tumorShrinkFraction = chemoPkClamp(1 - tumorVolume, 0, 1);
  return visualState;
}

// ============================================
// Update patient health based on organ burden
// Deterministic toxicity model (no random shock for reproducibility)
function chemoPkUpdatePatientState(
  currentHealth,
  totalBurden,
  visualState,
  config,
  rollingToxicityLoad,
) {
  var resilienceMultiplier = config.resilienceMultiplier || 1;
  var regimenProfile = config.regimenProfile || chemoPkGetRegimenProfile(config);
  var patientProfile = config.patientProfile || {};
  var renalReserve = patientProfile.renalReserve || 1;
  var hepaticReserve = patientProfile.hepaticReserve || 1;
  var marrowReserve = patientProfile.marrowReserve || 1;
  var toxicityMemory = typeof rollingToxicityLoad === "number" ? rollingToxicityLoad : totalBurden;
  // base toxicity proportional to drug burden
  var toxicity = (totalBurden * 0.04 * regimenProfile.acuteToxicityWeight) / resilienceMultiplier;
  // organ stress from liver and kidney processing
  var organStress =
    (visualState.liver + visualState.kidney + visualState.bloodstream) *
    ((0.8 * regimenProfile.cumulativeToxicityWeight) / resilienceMultiplier);
  organStress +=
    (visualState.kidney / Math.max(renalReserve, 0.4) -
      visualState.kidney +
      (visualState.liver / Math.max(hepaticReserve, 0.4) - visualState.liver)) *
    0.5;
  toxicity +=
    Math.max(0, toxicityMemory - totalBurden) * 0.012 * regimenProfile.cumulativeToxicityWeight;
  toxicity += Math.max(0, 1 - marrowReserve) * 1.4;
  // natural recovery (drops sharply when burden is high)
  var recovery = Math.max(
    0.1,
    ((1.2 - toxicityMemory * 0.02) * resilienceMultiplier) /
      (regimenProfile.recoveryPenalty * (1 + (1 - marrowReserve) * 0.6)),
  );
  // escalating toxicity at high burdens: narrow therapeutic window
  if (totalBurden > 15) {
    toxicity +=
      ((totalBurden - 15) * 0.05 * regimenProfile.acuteToxicityWeight) / resilienceMultiplier;
  }
  if (totalBurden > 40) {
    toxicity +=
      ((totalBurden - 40) * 0.15 * regimenProfile.cumulativeToxicityWeight) / resilienceMultiplier;
  }
  if (totalBurden > 80) {
    toxicity +=
      ((totalBurden - 80) * 0.4 * regimenProfile.cumulativeToxicityWeight) / resilienceMultiplier;
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
  var regimenProfile = config.regimenProfile || chemoPkGetRegimenProfile(config);
  config.patientProfile = patientProfile;
  config.regimenProfile = regimenProfile;
  config.bsa = patientProfile.bsa;
  config.weightKg = patientProfile.weightKg;
  config.clearanceMultiplier = patientProfile.clearanceMultiplier;
  config.resilienceMultiplier = patientProfile.resilienceMultiplier;
  var regimen = chemoRegimenGetById(config.regimenId);
  var randomnessScale = chemoPkGetRandomnessScale(config);
  var doseEvents = chemoRegimenBuildDoseEvents(
    config.regimenId,
    config.bsa,
    config.doseMultiplier,
    config.doseCount,
    config.doseIntervalDays,
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
  var eventLog = [];
  var rollingToxicityLoad = 0;
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
      var drugConc = chemoPkMultiDoseConcentration(
        drug,
        doses,
        timeMins,
        weightKg,
        clearanceMultiplier,
      );
      concentrationMap[drug.id] = drugConc;
      totalBurden += drugConc;
      cumulativeExposureMap[drug.id] +=
        (drugConc / chemoPkEstimateTypicalPeak(drug, config)) * config.timeStepHours;
    }
    var responseProbability = chemoPkComputeResponseProbability(totalBurden, config);
    if (randomnessScale === 0) {
      responseProbability = chemoPkClamp((responseProbability - 0.5) * 0.8 + 0.5, 0.03, 0.97);
    }
    tumorVolume = chemoPkUpdateTumorVolume(tumorVolume, responseProbability, totalBurden, config);
    // build visual state from the updated tumor volume
    var visualState = chemoPkBuildVisualState(
      regimenDrugs,
      concentrationMap,
      totalBurden,
      config,
      tumorVolume,
    );
    rollingToxicityLoad = rollingToxicityLoad * 0.7 + totalBurden * 0.3;
    patientHealth = chemoPkUpdatePatientState(
      patientHealth,
      totalBurden,
      visualState,
      config,
      rollingToxicityLoad,
    );
    var lifeStatus = chemoPkBuildLifeStatus(patientHealth);
    var therapeuticWindowStatus = chemoPkBuildTherapeuticWindowStatus(totalBurden, config);
    var previousSample = samples.length ? samples[samples.length - 1] : null;
    var adverseEffectResult = chemoPkBuildAdverseEffects(
      regimenDrugs,
      concentrationMap,
      totalBurden,
      visualState,
      cumulativeExposureMap,
      patientHealth,
      config,
      effectStateMap,
    );
    var adverseEffects = adverseEffectResult.effects;
    effectStateMap = adverseEffectResult.effectStateMap;
    var sample = {
      timeHour: timeHour,
      drugConcentrations: concentrationMap,
      totalBurden: totalBurden,
      tumorVolume: tumorVolume,
      responseProbability: responseProbability,
      patientHealth: patientHealth,
      lifeStatus: lifeStatus,
      patientProfile: config.patientProfile,
      therapeuticWindowStatus: therapeuticWindowStatus,
      adverseEffects: adverseEffects,
      visualState: visualState,
      rollingToxicityLoad: rollingToxicityLoad,
      regimenName: regimen.name,
    };
    var newEvents = chemoPkBuildStepEvents(previousSample, sample);
    for (eventIndex = 0; eventIndex < newEvents.length; eventIndex += 1) {
      eventLog.push(newEvents[eventIndex]);
    }
    sample.eventLog = eventLog.slice();
    samples.push(sample);
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
