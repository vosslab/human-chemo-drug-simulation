// ============================================
// pk_engine.ts -- Pharmacokinetic engine with exponential decay models
// ============================================
// Uses canonical units: time in minutes, amount in mg, volume in L, concentration in mg/L
// Vd source is L/kg, converted to total L using patient weight at calculation time
// ============================================

import type {
  RandomnessMode,
  CaseProfile,
  PatientProfile,
  RegimenProfile,
  DrugDefinition,
  VisualState,
  AdverseEffect,
  AdverseEffectRule,
  Severity,
  EffectState,
  LifeStatus,
  TherapeuticWindowStatus,
  TherapeuticWindow,
  SimulationSample,
  SimulationConfig,
  RunSummary,
  Grade,
  ChemoState,
  DoseEvent,
  ExtractionRoutes,
} from "./types";
import { SIM_DEFAULTS, ORGAN_EXTRACTION, CHEMO_CONSTANTS } from "./constants";
import {
  chemoRegimenGetById,
  chemoRegimenGetDefaultDoseCount,
  chemoRegimenGetDefaultDoseIntervalDays,
  chemoRegimenBuildDoseEvents,
  chemoRegimenBuildDrugList,
} from "./regimen_engine";

// ============================================
// Local input views describing the loose config/state shapes the engine reads.
// The PK helpers are called both with a full SimulationConfig (production) and
// with partial config/state objects (tests, or before chemoPkBuildSamples has
// populated the derived fields), so the optional fields below are honest.
// ============================================

// Subset read by chemoPkGetRandomnessScale.
interface RandomnessConfigView {
  randomnessMode?: RandomnessMode;
}

// Subset read by regimen-id lookups.
interface RegimenConfigView {
  regimenId: string;
}

// Subset read by chemoPkEstimateTypicalPeak.
interface PeakConfigView {
  weightKg?: number;
  bsa?: number;
}

// Fields the patient-profile builder reads from a state or config object.
interface PatientProfileInput {
  caseProfile?: CaseProfile | null;
  genderBalance?: number;
  bmi?: number;
  ageYears?: number;
  activityLevel?: number;
}

// General loose config view used by the per-sample computation helpers.
interface PkConfigView {
  regimenId: string;
  tumorSensitivity: number;
  bodyScale: number;
  randomnessMode?: RandomnessMode;
  caseProfile?: CaseProfile | null;
  regimenProfile?: RegimenProfile;
  patientProfile?: PatientProfile;
  resilienceMultiplier?: number;
  weightKg?: number;
  bsa?: number;
}

// A single scheduled dose used for concentration superposition.
interface PkDose {
  timeMins: number;
  amountMg: number;
}

// Result bundle returned by chemoPkBuildAdverseEffects.
interface AdverseEffectResult {
  effects: AdverseEffect[];
  effectStateMap: Record<string, EffectState>;
}

// ============================================
// Utility: clamp value between minimum and maximum
export function chemoPkClamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

// ============================================
// Map randomness mode to simulation noise intensity
export function chemoPkGetRandomnessScale(config: RandomnessConfigView): number {
  const mode = config.randomnessMode || "clinical";
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
export function chemoPkGetRegimenProfile(config: RegimenConfigView): RegimenProfile {
  const regimen = chemoRegimenGetById(config.regimenId);
  const profile: RegimenProfile = {
    efficacyWeight: regimen.efficacyWeight || 1,
    acuteToxicityWeight: regimen.acuteToxicityWeight || 1,
    cumulativeToxicityWeight: regimen.cumulativeToxicityWeight || 1,
    recoveryPenalty: regimen.recoveryPenalty || 1,
    volatility: regimen.volatility || 1,
  };
  return profile;
}

// ============================================
// Derive body size and physiologic modifiers from patient-factor sliders
export function chemoPkBuildPatientProfile(state: PatientProfileInput): PatientProfile {
  const caseProfile = state.caseProfile || null;
  const genderBalance = typeof state.genderBalance === "number" ? state.genderBalance : 0;
  const bmi = typeof state.bmi === "number" ? state.bmi : 24;
  const ageYears = typeof state.ageYears === "number" ? state.ageYears : 52;
  const activityLevel = typeof state.activityLevel === "number" ? state.activityLevel : 0.35;
  const heightCm = 162 + genderBalance * 16;
  const heightMeters = heightCm / 100;
  const weightKg = bmi * heightMeters * heightMeters;
  const bsa = Math.sqrt((heightCm * weightKg) / 3600);
  let clearanceMultiplier =
    1 +
    (activityLevel - 0.35) * 0.35 +
    genderBalance * 0.04 -
    ((ageYears - 50) / 40) * 0.12 -
    ((bmi - 24) / 20) * 0.08;
  let resilienceMultiplier =
    1 + (activityLevel - 0.35) * 0.45 - ((ageYears - 50) / 40) * 0.18 - ((bmi - 24) / 20) * 0.1;
  if (caseProfile) {
    clearanceMultiplier *= caseProfile.clearanceMultiplier || 1;
    resilienceMultiplier *= caseProfile.resilienceMultiplier || 1;
  }
  const profile: PatientProfile = {
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
  return profile;
}

// ============================================
// Estimate a normalized typical peak concentration for a drug
export function chemoPkEstimateTypicalPeak(drug: DrugDefinition, config: PeakConfigView): number {
  const weightKg = config.weightKg || SIM_DEFAULTS.patientWeightKg;
  const bsa = config.bsa || SIM_DEFAULTS.patientBSA;
  const doseMg = drug.typicalDoseMgM2 * bsa;
  const vdLiters = drug.vdLPerKg * weightKg;
  return Math.max(0.01, doseMg / Math.max(vdLiters, 0.01));
}

// ============================================
// Build a risk score for a particular adverse-effect rule
export function chemoPkBuildAdverseEffectScore(
  effectRule: AdverseEffectRule,
  exposureRatio: number,
  cumulativeRatio: number,
  totalBurden: number,
  visualState: VisualState,
  patientHealth: number,
): number {
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
export function chemoPkBuildAdverseEffectSeverity(score: number): Severity {
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
export function chemoPkBuildAdverseEffectProbability(
  score: number,
  wasPresent: boolean | undefined,
  randomnessScale: number,
): number {
  let probability = chemoPkClamp(score * 0.45, 0.01, 0.98);
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
export function chemoPkBuildTherapeuticWindowStatus(
  totalBurden: number,
  config: RegimenConfigView,
): TherapeuticWindowStatus {
  const regimen = chemoRegimenGetById(config.regimenId);
  const windowSpec: TherapeuticWindow = regimen.therapeuticWindow || {
    ineffectiveMax: 1.5,
    toxicMin: 12,
  };
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
export function chemoPkBuildStepEvents(
  previousSample: SimulationSample | null,
  currentSample: SimulationSample,
): string[] {
  const entries: string[] = [];
  const dayText = "Day " + Math.floor(currentSample.timeHour / 24);
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
    // map previous effects by key for present/severity transition detection
    const previousEffects: Record<string, AdverseEffect> = {};
    for (const priorEffect of previousSample.adverseEffects) {
      previousEffects[priorEffect.key] = priorEffect;
    }
    for (const effect of currentSample.adverseEffects) {
      const priorEffect = previousEffects[effect.key];
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
export function chemoPkBuildRunSummary(
  samples: SimulationSample[],
  config: PkConfigView,
): RunSummary {
  const firstSample = samples[0];
  const lastSample = samples[samples.length - 1];
  if (firstSample === undefined || lastSample === undefined) {
    throw new Error("chemoPkBuildRunSummary requires at least one sample");
  }
  const peakExposure = chemoPkFindPeakExposure(samples);
  const minTumor = chemoPkFindMinimumTumorVolume(samples);
  const tumorReduction = chemoPkClamp(
    (1 - minTumor / Math.max(firstSample.tumorVolume, 0.01)) * 100,
    0,
    100,
  );
  const toxicityBurden = chemoPkClamp(100 - peakExposure * 3.2, 0, 100);
  const survivalScore =
    lastSample.lifeStatus === "Deceased" ? 0 : chemoPkClamp(lastSample.patientHealth, 0, 100);
  let responseTimeIndex = 0;
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    // sampleIndex is within bounds by the loop condition
    if (samples[sampleIndex]!.tumorVolume <= 0.5) {
      responseTimeIndex = sampleIndex;
      break;
    }
  }
  // index is clamped into [0, length-1] and samples is non-empty (checked above)
  const responseTimeHours = samples[Math.min(responseTimeIndex, samples.length - 1)]!.timeHour;
  const speedScore = responseTimeHours > 0 ? chemoPkClamp(100 - responseTimeHours / 6, 0, 100) : 25;
  const overTreatmentPenalty = chemoPkClamp(Math.max(0, peakExposure - 14) * 4, 0, 100);
  const totalScore =
    tumorReduction * 0.3 +
    toxicityBurden * 0.2 +
    survivalScore * 0.25 +
    speedScore * 0.15 +
    (100 - overTreatmentPenalty) * 0.1;
  let grade: Grade;
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
  const summary: RunSummary = {
    grade: grade,
    totalScore: Math.round(totalScore),
    tumorReduction: Math.round(tumorReduction),
    toxicityBurden: Math.round(toxicityBurden),
    survival: Math.round(survivalScore),
    speed: Math.round(speedScore),
    overTreatmentPenalty: Math.round(overTreatmentPenalty),
    mysteryTraitLabel: config.caseProfile ? config.caseProfile.mysteryTraitLabel : "",
  };
  return summary;
}

// ============================================
// Build the realized adverse-effects list for the current simulated sample
export function chemoPkBuildAdverseEffects(
  regimenDrugs: DrugDefinition[],
  concentrationMap: Record<string, number>,
  totalBurden: number,
  visualState: VisualState,
  cumulativeExposureMap: Record<string, number>,
  patientHealth: number,
  config: PkConfigView,
  previousEffectStateMap?: Record<string, EffectState>,
): AdverseEffectResult {
  const effectMap: Record<string, AdverseEffect> = {};
  const priorStateMap = previousEffectStateMap || {};
  const regimenProfile = config.regimenProfile || chemoPkGetRegimenProfile(config);
  const patientProfile: Partial<PatientProfile> = config.patientProfile || {};
  const randomnessScale = chemoPkGetRandomnessScale(config);
  for (const drug of regimenDrugs) {
    const adverseEffects = drug.adverseEffects || [];
    const exposureRatio =
      (concentrationMap[drug.id] || 0) / chemoPkEstimateTypicalPeak(drug, config);
    const cumulativeRatio = cumulativeExposureMap[drug.id] || 0;
    for (const effect of adverseEffects) {
      let entry = effectMap[effect.key];
      if (entry === undefined) {
        entry = {
          key: effect.key,
          label: effect.label,
          present: false,
          severity: "green",
          score: 0,
          sourceDrugs: [],
        };
        effectMap[effect.key] = entry;
      }
      entry.sourceDrugs.push(drug.name);
      let effectScore = chemoPkBuildAdverseEffectScore(
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
      if (effectScore > entry.score) {
        entry.score = effectScore;
        entry.severity = chemoPkBuildAdverseEffectSeverity(effectScore);
        entry.active = entry.severity !== "green";
      }
    }
  }
  // rank by severity band, then alphabetically by label
  const severityRank: Record<Severity, number> = { red: 0, yellow: 1, green: 2 };
  function compareEffects(left: AdverseEffect, right: AdverseEffect): number {
    if (severityRank[left.severity] !== severityRank[right.severity]) {
      return severityRank[left.severity] - severityRank[right.severity];
    }
    return left.label.localeCompare(right.label);
  }
  const effectValues: AdverseEffect[] = [];
  for (const key of Object.keys(effectMap)) {
    const entry = effectMap[key];
    if (entry !== undefined) {
      effectValues.push(entry);
    }
  }
  effectValues.sort(compareEffects);
  const effectList: AdverseEffect[] = [];
  const nextEffectStateMap: Record<string, EffectState> = {};
  for (const effect of effectValues) {
    const effectKey = effect.key;
    const previousState = priorStateMap[effectKey];
    const probability = chemoPkBuildAdverseEffectProbability(
      effect.score,
      previousState?.present,
      randomnessScale,
    );
    const isPresent = randomnessScale === 0 ? probability >= 0.5 : chemoPkRandom() < probability;
    let realizedSeverity: Severity = "green";
    if (isPresent) {
      realizedSeverity = effect.score >= 1.2 ? "red" : "yellow";
    }
    effect.present = isPresent;
    effect.active = isPresent;
    effect.severity = realizedSeverity;
    effect.probability = probability;
    effect.sourceDrugs.sort();
    nextEffectStateMap[effectKey] = {
      present: isPresent,
      severity: realizedSeverity,
    };
    effectList.push(effect);
  }
  const result: AdverseEffectResult = {
    effects: effectList,
    effectStateMap: nextEffectStateMap,
  };
  return result;
}

// ============================================
// PRNG for reproducible stochastic tumor response (pedagogic noise)
export function chemoPkRandom(): number {
  return Math.random();
}

// ============================================
// One-compartment exponential decay: C(t) = C0 * e^(-ke * t)
// drug: object from DRUG_DATA
// doseMg: dose amount in mg
// elapsedMinutes: time since dose administration in minutes
// weightKg: patient weight for Vd conversion
export function chemoPkOneCompartment(
  drug: DrugDefinition,
  doseMg: number,
  elapsedMinutes: number,
  weightKg: number,
  clearanceMultiplier?: number,
): number {
  // elimination rate constant: ke = ln(2) / half-life
  // one-compartment drugs always define halfLifeMinutes (dispatch guarantees compartments === 1)
  const ke = (0.693 / drug.halfLifeMinutes!) * (clearanceMultiplier || 1);
  // initial concentration: C0 = dose / (Vd_L/kg * weight_kg)
  const vdLiters = drug.vdLPerKg * weightKg;
  const c0 = doseMg / vdLiters;
  // exponential decay
  const concentration = c0 * Math.exp(-ke * elapsedMinutes);
  return Math.max(0, concentration);
}

// ============================================
// Two-compartment biphasic decay: C(t) = A*e^(-alpha*t) + B*e^(-beta*t)
// Alpha phase: rapid initial distribution
// Beta phase: slow terminal elimination
export function chemoPkTwoCompartment(
  drug: DrugDefinition,
  doseMg: number,
  elapsedMinutes: number,
  weightKg: number,
  clearanceMultiplier?: number,
): number {
  // alpha rate from distribution half-life
  // two-compartment drugs always define both phase half-lives (compartments === 2)
  const alphaRate = (0.693 / drug.halfLifeAlphaMinutes!) * (clearanceMultiplier || 1);
  // beta rate from elimination half-life
  const betaRate = (0.693 / drug.halfLifeBetaMinutes!) * (clearanceMultiplier || 1);
  // total initial concentration
  const vdLiters = drug.vdLPerKg * weightKg;
  const cTotal = doseMg / vdLiters;
  // split into rapid (70%) and slow (30%) components
  const componentA = 0.7 * cTotal;
  const componentB = 0.3 * cTotal;
  // biphasic decay
  const concentration =
    componentA * Math.exp(-alphaRate * elapsedMinutes) +
    componentB * Math.exp(-betaRate * elapsedMinutes);
  return Math.max(0, concentration);
}

// ============================================
// Calculate concentration for a single dose at a given time
// Dispatches to one-compartment or two-compartment based on drug properties
// doseTimeMins: when the dose was administered (in simulation minutes)
// currentTimeMins: current simulation time in minutes
export function chemoPkConcentrationAtTime(
  drug: DrugDefinition,
  doseMg: number,
  doseTimeMins: number,
  currentTimeMins: number,
  weightKg: number,
  clearanceMultiplier?: number,
): number {
  const elapsedMinutes = currentTimeMins - doseTimeMins;
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
export function chemoPkMultiDoseConcentration(
  drug: DrugDefinition,
  doses: PkDose[],
  currentTimeMins: number,
  weightKg: number,
  clearanceMultiplier?: number,
): number {
  let totalConcentration = 0;
  for (const dose of doses) {
    totalConcentration += chemoPkConcentrationAtTime(
      drug,
      dose.amountMg,
      dose.timeMins,
      currentTimeMins,
      weightKg,
      clearanceMultiplier,
    );
  }
  return totalConcentration;
}

// ============================================
// Derive organ concentrations from plasma concentration using extraction ratios
export function chemoPkOrganConcentrations(
  drug: DrugDefinition,
  plasmaConc: number,
): { plasma: number; liver: number; kidney: number; tissue: number } {
  // determine clearance route from drug properties
  let route: keyof ExtractionRoutes = "hepatic";
  if (drug.primaryOrgan === "kidney") {
    route = "renal";
  }
  if (drug.excretionOrgan === "bile") {
    route = "biliary";
  }
  const liverRatio = ORGAN_EXTRACTION.liver[route];
  const kidneyRatio = ORGAN_EXTRACTION.kidney[route];
  const tissueRatio = ORGAN_EXTRACTION.tissue[route];
  const organs = {
    plasma: plasmaConc,
    liver: plasmaConc * liverRatio,
    kidney: plasmaConc * kidneyRatio,
    tissue: plasmaConc * tissueRatio,
  };
  return organs;
}

// ============================================
// Build simulation config from current state
export function chemoPkBuildSimulationConfig(state: ChemoState): SimulationConfig {
  const patientProfile = chemoPkBuildPatientProfile(state);
  const regimenProfile = chemoPkGetRegimenProfile(state);
  const doseCount = state.doseCount || chemoRegimenGetDefaultDoseCount(state.regimenId);
  const doseIntervalDays =
    state.doseIntervalDays || chemoRegimenGetDefaultDoseIntervalDays(state.regimenId);
  const lastDoseHour = Math.max(0, (doseCount - 1) * doseIntervalDays * 24);
  const durationHours = Math.max(CHEMO_CONSTANTS.defaultDurationHours, lastDoseHour + 240);
  const config: SimulationConfig = {
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
  return config;
}

// ============================================
// Build a dose map from dose events: {timeHour: {drugId: doseMg}}
export function chemoPkBuildDoseMap(
  doseEvents: DoseEvent[],
  durationHours: number,
  timeStepHours: number,
): Record<number, Record<string, number>> {
  const doseMap: Record<number, Record<string, number>> = {};
  for (let timeHour = 0; timeHour <= durationHours; timeHour += timeStepHours) {
    doseMap[timeHour] = {};
  }
  for (const event of doseEvents) {
    // snap dose to nearest time step
    const startHour = Math.floor(event.startHour / timeStepHours) * timeStepHours;
    const endHour =
      Math.ceil((event.startHour + event.durationHours) / timeStepHours) * timeStepHours;
    const bucketCount = Math.max(1, Math.round((endHour - startHour) / timeStepHours));
    const bucketDose = event.amountMg / bucketCount;
    for (let timeHour = startHour; timeHour < endHour; timeHour += timeStepHours) {
      let bucket = doseMap[timeHour];
      if (bucket === undefined) {
        bucket = {};
        doseMap[timeHour] = bucket;
      }
      bucket[event.drugId] = (bucket[event.drugId] ?? 0) + bucketDose;
    }
  }
  return doseMap;
}

// ============================================
// Compute tumor response probability from total burden
// Uses logistic function; center and spread tuned for exponential decay PK scale
export function chemoPkComputeResponseProbability(
  totalBurden: number,
  config: PkConfigView,
): number {
  const regimenProfile = config.regimenProfile || chemoPkGetRegimenProfile(config);
  const caseProfile = config.caseProfile || null;
  const efficacyMultiplier =
    caseProfile && caseProfile.efficacyMultiplier ? caseProfile.efficacyMultiplier : 1;
  const scaledBurden =
    totalBurden *
    config.tumorSensitivity *
    efficacyMultiplier *
    regimenProfile.efficacyWeight *
    (1.15 / config.bodyScale);
  // logistic center tuned for typical ABVD burden range
  // at burden=2 response ~50%, at burden=10 response ~90%
  const logisticCenter = 2;
  const logisticSpread = 2.5;
  const baseline = 1 / (1 + Math.exp(-(scaledBurden - logisticCenter) / logisticSpread));
  // light pedagogic noise in tumor response only
  const jitter =
    (chemoPkRandom() - 0.5) * 0.18 * regimenProfile.volatility * chemoPkGetRandomnessScale(config);
  return chemoPkClamp(baseline + jitter, 0.03, 0.97);
}

// ============================================
// Update tumor volume based on response probability
export function chemoPkUpdateTumorVolume(
  currentTumorVolume: number,
  responseProbability: number,
  totalBurden: number,
  config: PkConfigView,
): number {
  let tumorVolume = currentTumorVolume;
  const randomnessScale = chemoPkGetRandomnessScale(config);
  if (tumorVolume <= 0.005) {
    return 0;
  }
  const roll = randomnessScale === 0 ? (responseProbability > 0.5 ? 0 : 1) : chemoPkRandom();
  if (roll < responseProbability) {
    // tumor shrinks: rate proportional to response probability
    let killFraction =
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
export function chemoPkBuildVisualState(
  regimenDrugs: DrugDefinition[],
  concentrationMap: Record<string, number>,
  totalBurden: number,
  config: PkConfigView,
  tumorVolume: number,
): VisualState {
  const visualState: VisualState = {
    bloodstream: 0,
    liver: 0,
    kidney: 0,
    tumor: 0,
    clearance: 0,
    tumorRadius: 54,
    tumorShrinkFraction: 0,
  };
  for (const drug of regimenDrugs) {
    const concentration = concentrationMap[drug.id] || 0;
    visualState.bloodstream += concentration * drug.bodyAffinity.bloodstream;
    visualState.liver += concentration * drug.bodyAffinity.liver;
    visualState.kidney += concentration * drug.bodyAffinity.kidney;
    visualState.tumor += concentration * drug.bodyAffinity.tumor * config.tumorSensitivity;
  }
  // normalize organ intensities to 0-1 range
  // use a reference scale based on typical burden levels
  const normalizer = Math.max(totalBurden, 0.5) * 1.2;
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
export function chemoPkUpdatePatientState(
  currentHealth: number,
  totalBurden: number,
  visualState: VisualState,
  config: PkConfigView,
  rollingToxicityLoad?: number,
): number {
  const resilienceMultiplier = config.resilienceMultiplier || 1;
  const regimenProfile = config.regimenProfile || chemoPkGetRegimenProfile(config);
  const patientProfile: Partial<PatientProfile> = config.patientProfile || {};
  const renalReserve = patientProfile.renalReserve || 1;
  const hepaticReserve = patientProfile.hepaticReserve || 1;
  const marrowReserve = patientProfile.marrowReserve || 1;
  const toxicityMemory =
    typeof rollingToxicityLoad === "number" ? rollingToxicityLoad : totalBurden;
  // base toxicity proportional to drug burden
  let toxicity = (totalBurden * 0.04 * regimenProfile.acuteToxicityWeight) / resilienceMultiplier;
  // organ stress from liver and kidney processing
  let organStress =
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
  const recovery = Math.max(
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
  const health = currentHealth - toxicity - organStress + recovery;
  return chemoPkClamp(health, 0, 100);
}

// ============================================
// Determine life status string from health value
export function chemoPkBuildLifeStatus(patientHealth: number): LifeStatus {
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
export function chemoPkBuildSamples(config: SimulationConfig): SimulationSample[] {
  const patientProfile = config.patientProfile || chemoPkBuildPatientProfile(config);
  const regimenProfile = config.regimenProfile || chemoPkGetRegimenProfile(config);
  config.patientProfile = patientProfile;
  config.regimenProfile = regimenProfile;
  config.bsa = patientProfile.bsa;
  config.weightKg = patientProfile.weightKg;
  config.clearanceMultiplier = patientProfile.clearanceMultiplier;
  config.resilienceMultiplier = patientProfile.resilienceMultiplier;
  const regimen = chemoRegimenGetById(config.regimenId);
  const randomnessScale = chemoPkGetRandomnessScale(config);
  const doseEvents = chemoRegimenBuildDoseEvents(
    config.regimenId,
    config.bsa,
    config.doseMultiplier,
    config.doseCount,
    config.doseIntervalDays,
  );
  const regimenDrugs = chemoRegimenBuildDrugList(config.regimenId);
  const weightKg = config.weightKg || SIM_DEFAULTS.patientWeightKg;
  const clearanceMultiplier = config.clearanceMultiplier || 1;
  // build per-drug dose arrays for superposition
  const drugDoseArrays: Record<string, PkDose[]> = {};
  for (const drug of regimenDrugs) {
    drugDoseArrays[drug.id] = [];
  }
  // distribute dose events into per-drug arrays
  for (const event of doseEvents) {
    let doseArray = drugDoseArrays[event.drugId];
    if (doseArray === undefined) {
      doseArray = [];
      drugDoseArrays[event.drugId] = doseArray;
    }
    // convert dose event startHour to minutes for internal calculation
    doseArray.push({
      timeMins: event.startHour * 60,
      amountMg: event.amountMg,
    });
  }
  let tumorVolume = 1.05;
  let patientHealth = 100;
  const samples: SimulationSample[] = [];
  const cumulativeExposureMap: Record<string, number> = {};
  let effectStateMap: Record<string, EffectState> = {};
  const eventLog: string[] = [];
  let rollingToxicityLoad = 0;
  for (const drug of regimenDrugs) {
    cumulativeExposureMap[drug.id] = 0;
  }
  for (let timeHour = 0; timeHour <= config.durationHours; timeHour += config.timeStepHours) {
    const timeMins = timeHour * 60;
    const concentrationMap: Record<string, number> = {};
    let totalBurden = 0;
    // calculate concentration for each drug using superposition
    for (const drug of regimenDrugs) {
      const doses = drugDoseArrays[drug.id] || [];
      const drugConc = chemoPkMultiDoseConcentration(
        drug,
        doses,
        timeMins,
        weightKg,
        clearanceMultiplier,
      );
      concentrationMap[drug.id] = drugConc;
      totalBurden += drugConc;
      // cumulativeExposureMap[drug.id] was initialized to 0 for every regimen drug above
      cumulativeExposureMap[drug.id] =
        cumulativeExposureMap[drug.id]! +
        (drugConc / chemoPkEstimateTypicalPeak(drug, config)) * config.timeStepHours;
    }
    let responseProbability = chemoPkComputeResponseProbability(totalBurden, config);
    if (randomnessScale === 0) {
      responseProbability = chemoPkClamp((responseProbability - 0.5) * 0.8 + 0.5, 0.03, 0.97);
    }
    tumorVolume = chemoPkUpdateTumorVolume(tumorVolume, responseProbability, totalBurden, config);
    // build visual state from the updated tumor volume
    const visualState = chemoPkBuildVisualState(
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
    const lifeStatus = chemoPkBuildLifeStatus(patientHealth);
    const therapeuticWindowStatus = chemoPkBuildTherapeuticWindowStatus(totalBurden, config);
    const previousSample = samples.length > 0 ? (samples[samples.length - 1] ?? null) : null;
    const adverseEffectResult = chemoPkBuildAdverseEffects(
      regimenDrugs,
      concentrationMap,
      totalBurden,
      visualState,
      cumulativeExposureMap,
      patientHealth,
      config,
      effectStateMap,
    );
    const adverseEffects = adverseEffectResult.effects;
    effectStateMap = adverseEffectResult.effectStateMap;
    const sample: SimulationSample = {
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
      // populated below once step events are computed for this sample
      eventLog: [],
    };
    const newEvents = chemoPkBuildStepEvents(previousSample, sample);
    for (const entry of newEvents) {
      eventLog.push(entry);
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
export function chemoPkFindPeakExposure(samples: SimulationSample[]): number {
  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(peak, sample.totalBurden);
  }
  return peak;
}

// ============================================
// Find minimum tumor volume across all samples
export function chemoPkFindMinimumTumorVolume(samples: SimulationSample[]): number {
  let minimum = 10;
  for (const sample of samples) {
    minimum = Math.min(minimum, sample.tumorVolume);
  }
  return minimum;
}
