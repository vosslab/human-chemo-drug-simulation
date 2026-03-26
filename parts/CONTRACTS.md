# Chemotherapy Body Simulation Contracts

## SimulationConfig
- `regimenId`: string
- `timeStepHours`: number
- `durationHours`: number
- `bodyScale`: number
- `tumorSensitivity`: number
- `playbackSpeed`: number
- `simulationRunId`: number
- `randomSeed`: number

## DrugDefinition
- `id`: string
- `name`: string
- `color`: string
- `infusionHours`: number
- `centralVolumeLiters`: number
- `peripheralVolumeLiters`: number
- `eliminationHalfLifeHours`: number
- `distributionHalfLifeHours`: number
- `bodyAffinity`: object
  - `bloodstream`: number
  - `liver`: number
  - `kidney`: number
  - `tumor`: number

## DoseEvent
- `id`: string
- `drugId`: string
- `label`: string
- `startHour`: number
- `durationHours`: number
- `amountMg`: number

## PresetRegimen
- `id`: string
- `name`: string
- `subtitle`: string
- `cycleHours`: number
- `drugIds`: string[]
- `doseEvents`: DoseEvent[]
- `teachingNotes`: string[]
- `warning`: string

## SimulationSample
- `timeHour`: number
- `drugConcentrations`: object keyed by `drugId` with concentration number
- `totalBurden`: number
- `tumorVolume`: number
- `responseProbability`: number
- `visualState`: VisualState

## VisualState
- `bloodstream`: number
- `liver`: number
- `kidney`: number
- `tumor`: number
- `clearance`: number
- `tumorRadius`: number
- `tumorShrinkFraction`: number

## Event Flow
1. User selects preset or adjusts sliders.
2. `chemoStateRebuildSimulation()` assembles `SimulationConfig`.
3. `chemoRegimenBuildDoseEvents()` returns regimen events.
4. `chemoPkBuildSamples()` runs a seeded stochastic step simulation and returns `SimulationSample[]`.
5. `chemoUiRenderAll()` updates KPI cards, chart, body visual, legend, and notes.
6. Playback updates `currentSampleIndex` and re-renders from the same sample array.
