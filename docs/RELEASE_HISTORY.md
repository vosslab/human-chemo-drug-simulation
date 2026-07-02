# Release history

This project has not cut a tagged release yet. No `## v<version>` block exists
below because no version number is confirmed by a git tag. The repo carries two
disagreeing version signals -- `VERSION` (`26.02`) and `package.json`
(`"version": "0.0.0"`) -- so this doc reports the state honestly as unreleased
rather than inventing a version number. See
[docs/CHANGELOG.md](CHANGELOG.md) for the full dated entry log this summary is
drawn from.

## Unreleased - 2026-07-02

### Highlights

- Added a browser-based chemotherapy PK teaching simulation assembled from
  modular files in `parts/` and built into a single HTML file
  (`chemotherapy_body_simulation.html`), with named regimen presets, a
  concentration timeline, and a stylized body-flow visualization for
  bloodstream, liver, kidney, and tumor activity.
- Replaced the initial stochastic PK model with mathematically correct
  exponential decay: one-compartment `C(t) = C0 * e^(-ke*t)` and
  two-compartment biphasic `A*e^(-alpha*t) + B*e^(-beta*t)` with dose
  superposition.
- Expanded the drug database from 7 to 10 drugs with clinical PK parameters
  (5-FU, doxorubicin, cisplatin, methotrexate, cyclophosphamide, bleomycin,
  vinblastine, dacarbazine, oxaliplatin, leucovorin) and regimen presets from
  2 to 4 (ABVD, FOLFOX, BEP, CMF) with BSA-sensitive dose calculation.
- Redesigned the UI from a sidebar-plus-hero layout to an interaction-first
  layout: regimen presets and playback controls at top, chart and body
  visualization dominant, compact stats strip, collapsible custom dosing
  section.
- Added dose-interval control, log-scaled concentration plotting, day/hour
  timeline labels with day tick marks, visible dose markers, and true tumor
  eradication instead of a hard minimum tumor floor.
- Added a simplified adverse-effects panel, later reworked into separate
  green, yellow, and red severity panels, that lists major side effects for
  the active regimen drugs and flags whether the simulated patient is
  currently experiencing them; effects are realized simulated symptoms via
  random rolls each timestep rather than deterministic risk projection.
- Added patient-factor sliders for gender, BMI, age, and lifestyle, with
  derived weight/BSA plus clearance and resilience modifiers that alter
  exposure and toxicity behavior.
- Added regimen-specific efficacy and toxicity weights, and preset-specific
  tumor locations, so presets now differ by tumor-kill strength, toxicity
  intensity, recovery drag, volatility, and anatomical placement (lymphoma,
  colorectal, testicular, breast cancer teaching presets).
- Added a gameplay layer on top of the PK model: therapeutic-window exposure
  banding on the concentration chart, Case Mode with hidden patient scenario
  generation, mystery-trait reveal, end-of-run grading, event-log playback,
  randomness-mode controls, and dynamic simulation duration based on the last
  scheduled dose plus washout.
- Added `devel/clean_build.sh`, the light build cleaner wired to the
  `npm run clean` target, which wipes build output, tool caches, and test
  artifacts while keeping `node_modules` (and Rust `target/`) intact.

### Notable fixes

- Fixed a volume-of-distribution bug where Vd was stored as L/kg but
  multiplied by patient weight, producing absurd total volumes (for example
  1750L for doxorubicin) and displaying all concentrations as "0.00".
- Fixed a regimen-preset UX bug where clicking a preset did not administer
  doses until a separate "Administer" button was clicked.
- Reformatted 9 files with `prettier --write` after a prettier 3.9.4 floor
  bump changed formatting output for previously-clean files; whitespace-only,
  no logic change.
- Added the canonical `allowScripts` allow-list (esbuild and fsevents install
  scripts) to `package.json` to silence `npm warn allow-scripts`.
- Replaced the `__REPO_NAME__` / `__REPO_VERSION__` placeholders in
  `package.json` with `human-chemo-drug-simulation` and `0.0.0`.

### Compatibility notes

- Merged two parallel simulation implementations (`parts/` and `parts2/`)
  into a single canonical `parts/` directory.
- Removed the hero section, sidebar, 8 metric cards, 9 body status pills, and
  organ guide section as part of the interaction-first UI redesign.
- Removed the manual single-dose controls and custom-dose plumbing in favor
  of a continuous dose-count model, where `Dose interval` means one full
  regimen administration every N days for the chosen number of doses.
- Removed the root `dist_clean.sh`; both cleaners now live only under
  `devel/` (`devel/clean_build.sh` light, `devel/dist_clean.sh` deep), with
  the `clean` npm alias in `package.json` repointed accordingly.
- Known gap: `./check_codebase.sh` fails at the typecheck step with
  `TS18003: No inputs were found in config file`, because this repo predates
  the TypeScript template -- its source lives in plain JavaScript under
  `parts/*.js`, assembled by `build_app.sh`, with no `src/*.ts` entry point.
  This is a structural gap left as-is; migrating `parts/*.js` to `src/*.ts`
  is deferred to a future pass.

### Validation

- `bash build_app.sh`
- `node --check parts/constants.js` and equivalent checks across
  `parts/*.js`
- `node tests/web/test_pk_calibration.js` (30 PK math, superposition, organ
  concentration, and calibration tests)
- `source source_me.sh && python3 -m pytest tests/web/test_web_build.py -q`
- `source source_me.sh && python3 -m pytest tests/test_ascii_compliance.py -q`
- `source source_me.sh && python3 -m pytest tests/test_pyflakes_code_lint.py -q`
