# Code architecture

## Overview

`human-chemo-drug-simulation` is a browser-based teaching demo that models chemotherapy
drug concentration, patient vitality, and tumor response over a simulated treatment
window. The application is written as strict TypeScript ES modules under
[src/](../src/) and bundled into a single ESM bundle by
[build_github_pages.sh](../build_github_pages.sh). There is no server component; all
simulation math and rendering run client-side in the browser after the module loads.

The repo carries `REPO_TYPE=typescript` (see [REPO_STYLE.md](REPO_STYLE.md)) and the app
source matches that template: `src/*.ts` type-checked by `tsc`, bundled by `esbuild`,
served as static files from `dist/`.

## Major components

Modules are listed bottom to top in dependency order. Every module imports only from
modules below it; [src/game_state.ts](../src/game_state.ts) exports the shared mutable
singleton `CHEMO_STATE` that the render layer reads.

- [src/types.ts](../src/types.ts): the shared type contract -- string-literal unions
  and interfaces (`DrugDefinition`, `RegimenPreset`, `DoseEvent`, `SimulationSample`,
  `VisualState`, `ChemoState`, `CaseProfile`, and related shapes). It is the normative
  TypeScript expression of [docs/CONTRACTS.md](CONTRACTS.md) plus the runtime fields the
  engine and state code set. Depends on nothing.
- [src/constants.ts](../src/constants.ts): static data tables -- `DRUG_DATA`
  (per-drug pharmacokinetic parameters, body affinities, colors), `REGIMEN_PRESETS` and
  `REGIMEN_KEYS` (named regimens: drug combinations, dose schedule, tumor site, teaching
  notes), plus `SIM_DEFAULTS`, `ORGAN_EXTRACTION`, and `CHEMO_CONSTANTS`. Depends on
  [src/types.ts](../src/types.ts).
- [src/dom.ts](../src/dom.ts): typed DOM lookup helpers (`requireElement`, `requireInput`,
  `requireSelect`) that throw a clear error naming the missing id instead of returning
  null. Depends on nothing.
- [src/regimen_engine.ts](../src/regimen_engine.ts): converts a selected regimen preset
  into a dose schedule. `chemoRegimenBuildDoseEvents()` converts each drug's mg/m2 dose
  to mg using the patient's body surface area (BSA) and produces the list of `DoseEvent`
  objects; also exposes regimen lookup and default dose-count/interval helpers. Depends on
  [src/constants.ts](../src/constants.ts).
- [src/pk_engine.ts](../src/pk_engine.ts): the pharmacokinetic (PK) simulation core.
  `chemoPkBuildSimulationConfig()` assembles a `SimulationConfig` from state, and
  `chemoPkBuildSamples()` runs exponential-decay PK with dose superposition across the
  dose events, deriving tumor volume, response probability, patient health, adverse
  effects, and visual intensity per timestep into an array of `SimulationSample`. Helpers
  compute peak exposure, minimum tumor volume, and the run summary. Depends on
  [src/constants.ts](../src/constants.ts) and [src/regimen_engine.ts](../src/regimen_engine.ts).
- [src/game_state.ts](../src/game_state.ts): holds the shared mutable singleton
  `CHEMO_STATE` (current regimen, patient factors, playback position, case-mode settings)
  and the state-mutating actions. `chemoStateRebuildSimulation()` is the orchestration
  function that reruns the regimen -> PK pipeline whenever a control changes; playback
  helpers advance `currentSampleIndex` on a timer. Depends on
  [src/constants.ts](../src/constants.ts), [src/regimen_engine.ts](../src/regimen_engine.ts),
  and [src/pk_engine.ts](../src/pk_engine.ts).
- [src/chart_stage.ts](../src/chart_stage.ts): renders the log-scale concentration chart
  and the linear outcome (tumor size / patient vitality) chart as SVG markup written into
  the DOM. Reads `CHEMO_STATE` and the current sample. Depends on
  [src/game_state.ts](../src/game_state.ts), [src/regimen_engine.ts](../src/regimen_engine.ts),
  and [src/constants.ts](../src/constants.ts).
- [src/body_visual.ts](../src/body_visual.ts): renders the stylized body SVG, health bar,
  and status pill driven by each sample's `VisualState`. Depends on
  [src/constants.ts](../src/constants.ts), [src/game_state.ts](../src/game_state.ts), and
  [src/dom.ts](../src/dom.ts).
- [src/ui_rendering.ts](../src/ui_rendering.ts): `chemoUiRenderAll()` updates the metric
  chips, playback controls, slider labels, teaching notes, and case summary from the
  current sample, and calls the chart and body-visual renderers. Depends on
  [src/game_state.ts](../src/game_state.ts), [src/chart_stage.ts](../src/chart_stage.ts),
  [src/body_visual.ts](../src/body_visual.ts), and [src/regimen_engine.ts](../src/regimen_engine.ts).
- [src/main.ts](../src/main.ts): the entry-point module. `chemoInitBootstrap()` builds the
  initial simulation, renders the UI, and binds DOM event listeners (preset buttons,
  playback controls, custom-dosing sliders). Registered on `DOMContentLoaded`. Depends on
  every module above.
- [src/index.html](../src/index.html): the host page; loads the bundle with
  `<script type="module" src="main.js"></script>`.
- [src/style.css](../src/style.css): all page styling.
- [docs/CONTRACTS.md](CONTRACTS.md): the canonical data-model and event-flow spec (units,
  `DrugDefinition`, `RegimenPreset`, `DoseEvent`, `SimulationSample`, `VisualState`).
  Treat it as the primary source of truth for data shapes and keep
  [src/types.ts](../src/types.ts) aligned with it.

## Data flow

Primary use case: a user picks a regimen preset (or adjusts custom dosing and
patient-factor controls) and watches the simulated treatment course play out.

1. On page load, `DOMContentLoaded` fires `chemoInitBootstrap()` in
   [src/main.ts](../src/main.ts).
2. `chemoStateRebuildSimulation()` (in [src/game_state.ts](../src/game_state.ts))
   assembles the `SimulationConfig` from the current `CHEMO_STATE`.
3. `chemoRegimenBuildDoseEvents()` (in [src/regimen_engine.ts](../src/regimen_engine.ts))
   converts mg/m2 doses to mg using the patient's BSA and builds the dose schedule.
4. `chemoPkBuildSamples()` (in [src/pk_engine.ts](../src/pk_engine.ts)) runs the
   exponential-decay PK model with dose superposition, computing per-timestep drug
   concentration, tumor volume, response probability, and patient health, and derives the
   peak exposure, minimum tumor volume, and run summary.
5. `chemoUiRenderAll()` (in [src/ui_rendering.ts](../src/ui_rendering.ts)) updates the
   metric chips, chart, body visual, and teaching notes from the sample array.
6. Each control listener stops any active playback, mutates `CHEMO_STATE`, calls
   `chemoStateRebuildSimulation()` when the change affects the model, and re-renders.
   Playback (play/pause/step/scrub) advances `currentSampleIndex` through the
   pre-computed sample array without re-running the PK model.

Full unit conventions and per-object field lists live in [docs/CONTRACTS.md](CONTRACTS.md).

## Build and tooling

- [build_github_pages.sh](../build_github_pages.sh) is the single canonical build. It
  type-checks with `npx tsc --noEmit -p tsconfig.json`, bundles
  [src/main.ts](../src/main.ts) into `dist/main.js` with esbuild (ESM, `es2020`, browser,
  minified, with sourcemap), copies [src/index.html](../src/index.html) and
  [src/style.css](../src/style.css) into `dist/`, and writes `dist/.nojekyll`. Output
  `dist/` is the GitHub Pages artifact. The build never produces single-file output.
- [run_web_server.sh](../run_web_server.sh) is the local dev preview. It runs
  `build_github_pages.sh`, then serves `dist/` with `python3 -m http.server` on a random
  8xxx port. `npm run serve` mirrors it.
- [check_codebase.sh](../check_codebase.sh) is the fast, build-free gate: `tsc` typecheck
  via [tsconfig.json](../tsconfig.json), a wider typecheck of `tests/` and `tools/` via
  [tsconfig.lint.json](../tsconfig.lint.json), ESLint at zero warnings, `prettier --check`,
  and the Node unit tests (`node --import tsx --test tests/test_*.mjs`). `npm run check`
  mirrors it.
- [run_playwright_tests.sh](../run_playwright_tests.sh) runs the browser suite. It builds
  `dist/` when needed, then runs `npx playwright test`; [playwright.config.ts](../playwright.config.ts)
  owns a `webServer` block that rebuilds `dist/` and serves it on a random 8xxx port.
- [devel/clean_build.sh](../devel/clean_build.sh) wipes `dist/` and other build/test
  artifacts. `npm run clean` mirrors it.

## Testing and verification

- [tests/test_regimen_engine.mjs](../tests/test_regimen_engine.mjs),
  [tests/test_pk_engine.mjs](../tests/test_pk_engine.mjs), and
  [tests/test_game_state.mjs](../tests/test_game_state.mjs): Node unit tests run under
  `node --import tsx --test`, importing the `src/*.ts` modules directly to check regimen
  dose-event construction, PK math, and state orchestration.
- [tests/web/test_web_build.py](../tests/web/test_web_build.py): a fast, build-free pytest
  check that every `src/*.ts` module and the static assets are present. Building `dist/`
  is the job of the Playwright smoke and `check_codebase.sh`, not the pytest fast lane.
- [tests/web/parity_fixture.json](../tests/web/parity_fixture.json): records the DOM-id
  and control-set parity captured during the migration from the legacy build.
- [tests/playwright/app_boots.spec.ts](../tests/playwright/app_boots.spec.ts): a browser
  smoke test that the ESM bundle loads, core panels render, and switching a regimen preset
  plus moving the time scrubber updates the chart and metric chips.
- `pytest tests/` runs the repo-wide lint gates (pyflakes, ASCII compliance, import
  hygiene, markdown links, shebangs) plus the source-presence check above; see
  [PYTEST_STYLE.md](PYTEST_STYLE.md).

## Extension points

- New drugs: add an entry to `DRUG_DATA` in [src/constants.ts](../src/constants.ts)
  following the `DrugDefinition` shape in [docs/CONTRACTS.md](CONTRACTS.md) and
  [src/types.ts](../src/types.ts).
- New regimens: add an entry to `REGIMEN_PRESETS` in [src/constants.ts](../src/constants.ts)
  following the `RegimenPreset` shape.
- New PK behavior (a new compartment model or toxicity rule): extend
  [src/pk_engine.ts](../src/pk_engine.ts); keep `SimulationSample` output fields consistent
  with [src/types.ts](../src/types.ts) so the chart and body-visual renderers do not break.
- New UI controls: add the DOM listener in [src/main.ts](../src/main.ts), read/write
  `CHEMO_STATE` through an action in [src/game_state.ts](../src/game_state.ts), and render
  new output in [src/ui_rendering.ts](../src/ui_rendering.ts).

## Known gaps

- Verification task: `deploy-pages.yml` lives at the repo root and is untracked, not under
  `.github/workflows/`. Confirm the intended path before relying on it to deploy `dist/` to
  GitHub Pages automatically.
