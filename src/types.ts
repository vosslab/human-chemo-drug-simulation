// ============================================
// types.ts -- Shared type contract for the chemotherapy teaching simulation
// ============================================
// These interfaces and unions describe the actual data produced and consumed by
// the constants, engine, state, and render modules. They are the normative
// TypeScript expression of docs/CONTRACTS.md plus the extra runtime fields the
// engine and state code actually set.
// Canonical units: time in minutes internally (display adapts), drug amount mg,
// volume L total, concentration mg/L, half-life minutes.
// ============================================

// ============================================
// String-literal unions
// ============================================

// Adverse-effect classification rule stored on each drug's adverseEffects entry.
export type AdverseEffectRule =
  | "acute"
  | "marrow"
  | "renal"
  | "cardiac"
  | "pulmonary"
  | "neuro"
  | "mucositis"
  | "fatigue"
  | "cumulative";

// Primary metabolizing organ for a drug.
export type PrimaryOrgan = "liver" | "kidney";

// Route by which a drug is excreted.
export type ExcretionOrgan = "kidney" | "bile";

// Traffic-light severity band for an adverse effect.
export type Severity = "green" | "yellow" | "red";

// Patient life-status string derived from patient health.
export type LifeStatus = "Stable" | "Fragile" | "Unstable" | "Critical" | "Deceased";

// Simulation randomness mode selected in the UI.
export type RandomnessMode = "deterministic" | "clinical" | "chaotic";

// Therapeutic-window classification for the current total burden.
export type TherapeuticWindowStatus = "ineffective" | "optimal" | "toxic";

// End-of-run letter grade.
export type Grade = "A" | "B" | "C" | "D" | "F";

// ============================================
// Static drug and regimen data (DRUG_DATA, REGIMEN_PRESETS)
// ============================================

// One adverse effect declared statically on a drug definition.
export interface DrugAdverseEffect {
  key: string;
  label: string;
  rule: AdverseEffectRule;
}

// Relative visual affinity of a drug for each body compartment.
export interface BodyAffinity {
  bloodstream: number;
  liver: number;
  kidney: number;
  tumor: number;
}

// A single drug's pharmacokinetic parameter record from DRUG_DATA.
export interface DrugDefinition {
  id: string;
  name: string;
  abbreviation: string;
  // 1 for one-compartment, 2 for two-compartment biphasic drugs
  compartments: 1 | 2;
  // one-compartment half-life; null for two-compartment drugs
  halfLifeMinutes: number | null;
  // two-compartment distribution-phase half-life; null for one-compartment
  halfLifeAlphaMinutes: number | null;
  // two-compartment elimination-phase half-life; null for one-compartment
  halfLifeBetaMinutes: number | null;
  vdLPerKg: number;
  typicalDoseMgM2: number;
  primaryOrgan: PrimaryOrgan;
  excretionOrgan: ExcretionOrgan;
  color: string;
  bodyAffinity: BodyAffinity;
  adverseEffects: DrugAdverseEffect[];
  infusionHours: number;
  description: string;
}

// A single drug dose within a regimen preset, in mg/m2 source units.
export interface RegimenDrugDose {
  drugKey: string;
  doseMgM2: number;
}

// Location and label geometry for a regimen's tumor site in the body diagram.
export interface TumorSite {
  key: string;
  label: string;
  cx: number;
  cy: number;
  labelX: number;
  labelY: number;
  lineToX: number;
  lineToY: number;
}

// Total-burden thresholds bounding the therapeutic window.
export interface TherapeuticWindow {
  ineffectiveMax: number;
  toxicMin: number;
}

// A full chemotherapy regimen preset from REGIMEN_PRESETS.
export interface RegimenPreset {
  id: string;
  name: string;
  subtitle: string;
  indication: string;
  efficacyWeight: number;
  acuteToxicityWeight: number;
  cumulativeToxicityWeight: number;
  recoveryPenalty: number;
  volatility: number;
  therapeuticWindow: TherapeuticWindow;
  tumorSite: TumorSite;
  cycleDays: number;
  drugKeys: string[];
  drugs: RegimenDrugDose[];
  primaryDrug: string;
  // 0-indexed dose days within one cycle
  doseDays: number[];
  description: string;
  teachingNotes: string[];
  caseGoals: string[];
  warning: string;
}

// A hidden-case difficulty trait from CHEMO_CASE_TRAITS.
export interface CaseTrait {
  key: string;
  label: string;
  description: string;
  clearanceMultiplier: number;
  resilienceMultiplier: number;
  // present only on traits that modify these axes
  efficacyMultiplier?: number;
  renalReserve?: number;
  hepaticReserve?: number;
  marrowReserve?: number;
}

// ============================================
// Simulation runtime shapes
// ============================================

// A generated case scenario built from a chosen trait and goal.
export interface CaseProfile {
  goal: string;
  mysteryTraitKey: string;
  mysteryTraitLabel: string;
  mysteryTraitDescription: string;
  revealed: boolean;
  renalReserve: number;
  hepaticReserve: number;
  marrowReserve: number;
  clearanceMultiplier: number;
  resilienceMultiplier: number;
  efficacyMultiplier: number;
}

// A scheduled dose administration produced by the regimen engine.
export interface DoseEvent {
  id: string;
  drugId: string;
  label: string;
  startHour: number;
  durationHours: number;
  amountMg: number;
}

// Per-compartment intensity and tumor sizing for body rendering.
export interface VisualState {
  bloodstream: number;
  liver: number;
  kidney: number;
  tumor: number;
  clearance: number;
  tumorRadius: number;
  tumorShrinkFraction: number;
}

// A realized adverse effect for the current sample.
// active and probability are set late during construction and are internal to
// the engine, so they are optional; consumers read key/label/severity/present.
export interface AdverseEffect {
  key: string;
  label: string;
  present: boolean;
  severity: Severity;
  score: number;
  sourceDrugs: string[];
  active?: boolean;
  probability?: number;
}

// Carry-over presence and severity of an effect between timesteps.
export interface EffectState {
  present: boolean;
  severity: Severity;
}

// Derived body-size and physiologic modifiers for a patient.
export interface PatientProfile {
  genderBalance: number;
  heightCm: number;
  weightKg: number;
  bsa: number;
  ageYears: number;
  bmi: number;
  activityLevel: number;
  renalReserve: number;
  hepaticReserve: number;
  marrowReserve: number;
  clearanceMultiplier: number;
  resilienceMultiplier: number;
}

// Regimen-level efficacy and toxicity modifiers.
export interface RegimenProfile {
  efficacyWeight: number;
  acuteToxicityWeight: number;
  cumulativeToxicityWeight: number;
  recoveryPenalty: number;
  volatility: number;
}

// One pre-computed simulation timestep sample.
export interface SimulationSample {
  timeHour: number;
  // concentration in mg/L keyed by drug id
  drugConcentrations: Record<string, number>;
  totalBurden: number;
  tumorVolume: number;
  responseProbability: number;
  patientHealth: number;
  lifeStatus: LifeStatus;
  patientProfile: PatientProfile;
  therapeuticWindowStatus: TherapeuticWindowStatus;
  adverseEffects: AdverseEffect[];
  visualState: VisualState;
  rollingToxicityLoad: number;
  regimenName: string;
  // cumulative event-log lines up to and including this sample
  eventLog: string[];
}

// Assembled configuration passed to the PK sample builder.
export interface SimulationConfig {
  regimenId: string;
  timeStepHours: number;
  durationHours: number;
  bodyScale: number;
  tumorSensitivity: number;
  playbackSpeed: number;
  simulationRunId: number;
  bsa: number;
  weightKg: number;
  patientProfile: PatientProfile;
  regimenProfile: RegimenProfile;
  ageYears: number;
  bmi: number;
  activityLevel: number;
  clearanceMultiplier: number;
  resilienceMultiplier: number;
  randomnessMode: RandomnessMode;
  caseProfile: CaseProfile | null;
  doseMultiplier: number;
  doseCount: number;
  doseIntervalDays: number;
}

// End-of-run scorecard.
export interface RunSummary {
  grade: Grade;
  totalScore: number;
  tumorReduction: number;
  toxicityBurden: number;
  survival: number;
  speed: number;
  overTreatmentPenalty: number;
  mysteryTraitLabel: string;
}

// The single shared mutable application state object (CHEMO_STATE).
export interface ChemoState {
  regimenId: string;
  bodyScale: number;
  tumorSensitivity: number;
  playbackSpeed: number;
  simulationRunId: number;
  doseMultiplier: number;
  doseCount: number;
  doseIntervalDays: number;
  genderBalance: number;
  bmi: number;
  ageYears: number;
  activityLevel: number;
  randomnessMode: RandomnessMode;
  caseModeEnabled: boolean;
  caseProfile: CaseProfile | null;
  samples: SimulationSample[];
  currentSampleIndex: number;
  peakExposure: number;
  minimumTumorVolume: number;
  runSummary: RunSummary | null;
  // browser interval handle; number in the DOM, null when stopped
  playbackTimerId: number | null;
}

// ============================================
// Constants module shapes
// ============================================

// Default simulation parameters (SIM_DEFAULTS).
export interface SimDefaults {
  patientWeightKg: number;
  patientBSA: number;
  timeStepMinutes: number;
  defaultDurationMinutes: number;
  defaultSpeed: number;
}

// Extraction ratios by clearance route for one organ column.
export interface ExtractionRoutes {
  hepatic: number;
  renal: number;
  biliary: number;
}

// Organ extraction lookup table (ORGAN_EXTRACTION).
export interface OrganExtraction {
  liver: ExtractionRoutes;
  kidney: ExtractionRoutes;
  tissue: ExtractionRoutes;
}

// A body visualization color channel (CHEMO_VIS_CHANNELS).
export interface VisualChannel {
  key: string;
  label: string;
  color: string;
}

// An organ description entry (CHEMO_ORGAN_INFO).
export interface OrganInfo {
  key: string;
  label: string;
  role: string;
}

// Backward-compatible per-regimen view built for the legacy adapter.
export interface ChemoRegimenView {
  id: string;
  name: string;
  subtitle: string;
  cycleHours: number;
  drugIds: string[];
  tumorSite: TumorSite;
  therapeuticWindow: TherapeuticWindow;
  caseGoals: string[];
  teachingNotes: string[];
  warning: string;
  doseEvents: DoseEvent[];
}

// The backward-compatible CHEMO_CONSTANTS adapter object.
export interface ChemoConstants {
  timeStepHours: number;
  defaultDurationHours: number;
  visualChannels: VisualChannel[];
  organInfo: OrganInfo[];
  caseTraits: CaseTrait[];
  drugs: Record<string, DrugDefinition>;
  regimens: ChemoRegimenView[];
}
