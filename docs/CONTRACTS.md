# Chemotherapy Teaching Simulation Contracts

## Canonical unit system

| Quantity | Internal unit | Notes |
| --- | --- | --- |
| Time | minutes | Sample interval 120 min, duration 43,200 min. Display adapts to min/hr/days |
| Drug amount | mg | Regimen source doses are mg/m2, converted using BSA at dose-event build time |
| Volume | L (total) | Source Vd is L/kg, converted to total L at concentration calculation time |
| Concentration | mg/L | = amount / volume |
| Half-life | minutes | Stored in DRUG_DATA |

## DrugDefinition (DRUG_DATA)

- `id`: string
- `name`: string
- `abbreviation`: string
- `compartments`: number (1 or 2)
- `halfLifeMinutes`: number or null (for one-compartment)
- `halfLifeAlphaMinutes`: number or null (for two-compartment distribution phase)
- `halfLifeBetaMinutes`: number or null (for two-compartment elimination phase)
- `vdLPerKg`: number (volume of distribution in L/kg, converted at compute time)
- `typicalDoseMgM2`: number (for manual dose UI default)
- `primaryOrgan`: string (liver or kidney)
- `excretionOrgan`: string (kidney or bile)
- `color`: string (hex)
- `bodyAffinity`: object
  - `bloodstream`: number
  - `liver`: number
  - `kidney`: number
  - `tumor`: number
- `infusionHours`: number
- `description`: string

## RegimenPreset (REGIMEN_PRESETS)

- `id`: string
- `name`: string
- `subtitle`: string
- `indication`: string
- `cycleDays`: number
- `drugKeys`: string[]
- `drugs`: array of {drugKey: string, doseMgM2: number}
- `primaryDrug`: string (drugKey)
- `doseDays`: number[] (0-indexed days within cycle)
- `description`: string
- `teachingNotes`: string[]
- `warning`: string

## DoseEvent

- `id`: string
- `drugId`: string
- `label`: string
- `startHour`: number
- `durationHours`: number
- `amountMg`: number (converted from doseMgM2 * BSA)

## SimulationSample

- `timeHour`: number
- `drugConcentrations`: object keyed by drugId with concentration number (mg/L)
- `totalBurden`: number (mg/L)
- `tumorVolume`: number (fraction, 0.15 to 1.25)
- `responseProbability`: number (0 to 1)
- `patientHealth`: number (0 to 100)
- `lifeStatus`: string (Stable, Fragile, Unstable, Critical, Deceased)
- `visualState`: VisualState
- `regimenName`: string

## VisualState

- `bloodstream`: number (0 to 1 intensity)
- `liver`: number (0 to 1 intensity)
- `kidney`: number (0 to 1 intensity)
- `tumor`: number (0 to 1 intensity)
- `clearance`: number (0 to 1 intensity)
- `tumorRadius`: number (pixels)
- `tumorShrinkFraction`: number (0 to 0.78)

## Event flow

1. User selects a regimen preset or adjusts custom dosing controls.
2. `chemoStateRebuildSimulation()` assembles SimulationConfig.
3. `chemoRegimenBuildDoseEvents()` converts mg/m2 to mg using current BSA and generates dose schedule.
4. `chemoPkBuildSamples()` runs exponential decay PK with dose superposition, computes tumor response and patient health per timestep.
5. `chemoUiRenderAll()` updates stats strip, chart, body visual, and teaching notes.
6. Playback advances `currentSampleIndex` through the pre-computed sample array.
