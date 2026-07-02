# Code architecture

## Overview

`human-chemo-drug-simulation` is a browser-based teaching demo that models chemotherapy
drug concentration, patient vitality, and tumor response over a simulated treatment
window. The working application is plain JavaScript split into topic modules under
[parts/](../parts/), assembled by [build_app.sh](../build_app.sh) into a single
self-contained HTML file, [chemotherapy_body_simulation.html](../chemotherapy_body_simulation.html).
There is no server component; all simulation math and rendering run client-side in the
browser after the page loads.

The repo carries `REPO_TYPE=typescript` (see [REPO_STYLE.md](REPO_STYLE.md)), but the
actual game logic predates the TypeScript template and was never migrated. See
"Known gaps" below for the resulting build-tooling mismatch.

## Major components

- [parts/constants.js](../parts/constants.js): static data tables -- `DRUG_DATA` (drug
  pharmacokinetic parameters, body affinities, colors) and `REGIMEN_PRESETS` (named
  chemotherapy regimens: drug combinations, dose schedule, tumor site, teaching notes).
- [parts/regimen_engine.js](../parts/regimen_engine.js): converts a selected regimen
  preset into a dose schedule. `chemoRegimenBuildDoseEvents()` converts each drug's
  mg/m2 dose to mg using the current patient's body surface area (BSA) and produces
  the list of `DoseEvent` objects.
- [parts/pk_engine.js](../parts/pk_engine.js): the pharmacokinetic (PK) simulation core.
  `chemoPkBuildSamples()` runs one- and two-compartment exponential decay with dose
  superposition across the dose events, and derives tumor volume, response
  probability, patient health, adverse effects, and visual intensity per timestep,
  producing an array of `SimulationSample`.
- [parts/game_state.js](../parts/game_state.js): holds `CHEMO_STATE` (current regimen,
  patient traits, playback position, case-mode settings) and
  `chemoStateRebuildSimulation()`, the orchestration function that reruns the
  regimen -> PK pipeline whenever a control changes.
- [parts/chart_stage.js](../parts/chart_stage.js): renders the concentration-over-time
  and outcome charts from the sample array (canvas or SVG-based plotting, no external
  charting library).
- [parts/body_visual.js](../parts/body_visual.js): renders the animated body diagram
  (bloodstream, liver, kidney, tumor regions) driven by each sample's `VisualState`.
- [parts/ui_rendering.js](../parts/ui_rendering.js): `chemoUiRenderAll()` updates the
  stats strip, playback controls, teaching notes, case summary, and event log from the
  current sample.
- [parts/init.js](../parts/init.js): wires DOM event listeners (regimen buttons,
  sliders, playback controls) to the state and render functions on page load.
- [parts/head.html](../parts/head.html), [parts/body.html](../parts/body.html),
  [parts/tail.html](../parts/tail.html), [parts/style.css](../parts/style.css): the
  static page shell and styling concatenated around the JavaScript modules.
- [parts/CONTRACTS.md](../parts/CONTRACTS.md): the canonical data-model and event-flow
  spec (units, `DrugDefinition`, `RegimenPreset`, `DoseEvent`, `SimulationSample`,
  `VisualState`). Treat this file as the primary source of truth for data shapes; this
  document summarizes it but does not replace it.

## Data flow

Primary use case: a user picks a regimen preset (or adjusts custom dosing controls)
and watches the simulated treatment course play out.

1. User selects a regimen preset or adjusts a dosing/patient-trait control in the UI.
2. `chemoStateRebuildSimulation()` (in [parts/game_state.js](../parts/game_state.js))
   assembles the `SimulationConfig` from current `CHEMO_STATE`.
3. `chemoRegimenBuildDoseEvents()` (in
   [parts/regimen_engine.js](../parts/regimen_engine.js)) converts mg/m2 doses to mg
   using the patient's BSA and builds the dose schedule.
4. `chemoPkBuildSamples()` (in [parts/pk_engine.js](../parts/pk_engine.js)) runs the
   exponential-decay PK model with dose superposition, computing per-timestep drug
   concentration, tumor volume, response probability, and patient health.
5. `chemoUiRenderAll()` (in [parts/ui_rendering.js](../parts/ui_rendering.js)) updates
   the stats strip, chart, body visual, and teaching notes from the sample array.
6. Playback (play/pause/scrub) advances `currentSampleIndex` through the
   pre-computed sample array without re-running the PK model.

Full unit conventions and per-object field lists live in
[parts/CONTRACTS.md](../parts/CONTRACTS.md).

## Build

[build_app.sh](../build_app.sh) is the real, working build. It concatenates
`parts/head.html`, `parts/style.css` (inlined in a `<style>` tag), `parts/body.html`,
the JavaScript modules in dependency order (constants, regimen_engine, pk_engine,
game_state, chart_stage, body_visual, ui_rendering, init), and `parts/tail.html` into
[chemotherapy_body_simulation.html](../chemotherapy_body_simulation.html). No bundler,
no transpilation -- the output is opened directly in a browser.

## Testing and verification

- [tests/web/test_web_build.py](../tests/web/test_web_build.py): runs `build_app.sh` and
  asserts the output HTML contains expected DOM regions (charts, controls, teaching
  notes), then exercises `parts/pk_engine.js` and `parts/regimen_engine.js` directly in
  a Node `vm` context to check PK math, regimen-specific efficacy/toxicity, case-mode
  fields, and event-log output.
- [tests/web/test_pk_calibration.js](../tests/web/test_pk_calibration.js): additional
  PK calibration checks.
- `pytest tests/` runs repo-wide lint gates (pyflakes, ASCII compliance, import
  hygiene, markdown links, shebangs) plus the web build test above; see
  [PYTEST_STYLE.md](PYTEST_STYLE.md).
- [run_web_server.sh](../run_web_server.sh) and [check_codebase.sh](../check_codebase.sh)
  target the TypeScript `dist/` pipeline (see "Known gaps"), not `build_app.sh`; they
  are not currently valid ways to preview or gate the working app.

## Extension points

- New drugs: add an entry to `DRUG_DATA` in
  [parts/constants.js](../parts/constants.js) following the `DrugDefinition` shape in
  [parts/CONTRACTS.md](../parts/CONTRACTS.md).
- New regimens: add an entry to `REGIMEN_PRESETS` in
  [parts/constants.js](../parts/constants.js) following the `RegimenPreset` shape.
- New PK behavior (e.g. a new compartment model or toxicity rule): extend
  [parts/pk_engine.js](../parts/pk_engine.js); keep `SimulationSample` output fields
  consistent with [parts/CONTRACTS.md](../parts/CONTRACTS.md) so downstream chart and
  body-visual renderers do not break.
- New UI controls: wire DOM listeners in [parts/init.js](../parts/init.js), read/write
  `CHEMO_STATE` in [parts/game_state.js](../parts/game_state.js), and render new output
  in [parts/ui_rendering.js](../parts/ui_rendering.js).

## Known gaps

- **Two build pipelines, one broken.** [build_app.sh](../build_app.sh) (parts/*.js ->
  single HTML file) is the real, working build and is what
  [tests/web/test_web_build.py](../tests/web/test_web_build.py) exercises.
  [build_github_pages.sh](../build_github_pages.sh) expects a TypeScript entry point at
  `src/main.ts` (or legacy `src/init.ts`) and `src/index.html` / `src/style.css`; none
  of `src/` exists in this repo. Running it aborts with `ERROR: no entry point`.
  [run_web_server.sh](../run_web_server.sh) calls `build_github_pages.sh` internally, so
  it is currently broken too. [check_codebase.sh](../check_codebase.sh) fails its
  typecheck step (`TS18003: No inputs were found in config file`) for the same reason.
  See [docs/CHANGELOG.md](CHANGELOG.md) (2026-07-01 entry) for the prior decision to
  leave this as a known structural gap rather than patch around it.
- **run_playwright_tests.sh** requires `playwright.config.ts` at the repo root, which
  does not exist; the Playwright test path is not currently runnable. `tests/playwright/`
  contains only [tests/playwright/repo_root.mjs](../tests/playwright/repo_root.mjs), a
  helper, with no `*.spec.ts` test files yet.
- Verification task: decide whether to migrate `parts/*.js` into a `src/*.ts` module
  set (aligning with the TypeScript template and unblocking `build_github_pages.sh`,
  `run_web_server.sh`, `check_codebase.sh`, and Playwright), or to formally retarget
  those scripts at the `build_app.sh` / `chemotherapy_body_simulation.html` pipeline.
