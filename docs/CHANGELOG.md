## 2026-03-29

### Fixes and Maintenance

- Cleaned up README.md: removed internal plan link, tightened doc descriptions.
- Updated the chemotherapy web simulation to support dose-interval control, log-scaled concentration plotting, day/hour timeline labels with day tick marks, visible dose markers, and true tumor eradication instead of a hard minimum tumor floor.
- Added a simplified adverse-effects panel that lists major side effects for the active regimen drugs and flags whether the simulated patient is currently experiencing them.
- Added a separate outcomes plot for tumor size and patient vitality over time so treatment response and toxicity trends can be read independently from the concentration chart.
- Replaced cycle-based scheduling controls with a continuous dose-count model so `Dose interval` now means one full regimen administration every N days for the chosen number of doses.
- Removed the manual single-dose controls and custom-dose plumbing to keep the regimen scheduling UI simpler and less confusing.
- Added patient-factor sliders for gender, BMI, age, and lifestyle, with derived weight/BSA plus clearance and resilience modifiers that alter exposure and toxicity behavior in the simulation.
- Reworked the adverse-effects display into separate green, yellow, and red panels, with each major side effect categorized by current severity instead of only present versus absent.
- Strengthened the concentration-chart death indicator with a prominent red post-death overlay and banner so fatal toxicity is visually obvious even when death occurs near the right edge of the timeline.
- Changed adverse effects from deterministic risk projection to realized simulated symptoms, using random rolls each timestep so effects like fever or nausea can actually be present, absent, or severe in the current patient state.
- Added regimen-specific efficacy and toxicity weights so presets now differ not just by PK timing and included drugs, but also by tumor-kill strength, toxicity intensity, recovery drag, and volatility.
- Added preset-specific tumor locations so the body view places the mass in a more anatomically appropriate region for lymphoma, colorectal, testicular, and breast cancer teaching presets.
- Added a gameplay layer tied to the existing PK model: therapeutic-window exposure banding on the concentration chart, Case Mode with hidden patient scenario generation, mystery-trait reveal, end-of-run grading, event-log playback, randomness-mode controls, and dynamic simulation duration based on the last scheduled dose plus washout.

## 2026-03-27

### Additions and New Features

- Merged two parallel simulation implementations (parts/ and parts2/) into a single canonical `parts/` directory.
- Replaced stochastic PK model with mathematically correct exponential decay: one-compartment `C(t) = C0 * e^(-ke*t)` and two-compartment biphasic `A*e^(-alpha*t) + B*e^(-beta*t)` with dose superposition.
- Expanded drug database from 7 to 10 drugs with clinical PK parameters: 5-FU, doxorubicin, cisplatin, methotrexate, cyclophosphamide, bleomycin, vinblastine, dacarbazine, oxaliplatin, leucovorin.
- Expanded regimen presets from 2 to 4: ABVD, FOLFOX, BEP, CMF with BSA-sensitive dose calculation.
- Added organ extraction ratio system (hepatic/renal/biliary routes) for organ concentration modeling.
- Added `tests/web/test_pk_calibration.js` with 30 validation tests covering PK math, superposition, organ concentrations, and calibration scenarios.

### Behavior or Interface Changes

- Redesigned UI from sidebar + hero layout to interaction-first layout: regimen presets and playback controls at top, chart + body visualization dominant, compact stats strip, collapsible custom dosing section.
- Removed hero section (3 paragraphs), sidebar (5 control sections), 8 metric cards, 9 body status pills, and organ guide section.
- Added "Educational use only" inline disclaimer and model note: "Simulated response is illustrative, not patient-specific."
- Regimen click loads simulation at t=0 without autoplay; user presses Play when ready.
- Custom dosing section labeled "Explore custom dosing (educational)" with collapsible toggle.
- Added canonical unit system: internal time in minutes, Vd in L/kg converted at computation time, doses in mg/m2 converted at dose-event build time.

### Fixes and Maintenance

- Fixed parts2/ Vd bug: volume of distribution was stored as L/kg but multiplied by patient weight to give absurd total volumes (e.g., 1750L for doxorubicin), causing all concentrations to display as "0.00".
- Fixed parts2/ regimen UX bug: clicking a regimen preset did not administer doses until separate "Administer" button was clicked.
- Retuned tumor response, tumor volume, and patient health functions against new exponential decay concentration scale.

### Removals and Deprecations

- None yet. parts2/ directory frozen pending final verification before removal.

### Decisions and Failures

- Chose parts/ as base (working build + tests) and ported PK math and drug data from parts2/.
- Kept SVG body visualization (135 lines) over parts2/'s canvas approach (819 lines) for simplicity.
- Deferred comparison mode (parts2/'s dual-panel feature) to future work; architecture kept open.
- Kept light stochastic variation only in tumor response, labeled as pedagogic noise.
- Product direction: educational PK sandbox answering "what happens if I change this?" not "what should I choose?"

### Developer Tests and Notes

- `bash build_app.sh`
- `node --check parts/constants.js && node --check parts/pk_engine.js`
- `node tests/web/test_pk_calibration.js`
- `source source_me.sh && python3 -m pytest tests/web/test_web_build.py -q`
- `source source_me.sh && python3 -m pytest tests/test_ascii_compliance.py -q`

## 2026-03-23

### Additions and New Features

- Added a browser-based chemotherapy teaching simulation assembled from modular files in `parts/` and built into `output/chemotherapy_body_simulation.html`.
- Added named regimen presets, a concentration timeline, and a stylized body-flow visualization for bloodstream, liver, kidney, and tumor activity.
- Added focused web build tests in `tests/web/test_web_build.py`.
- Expanded the interaction model to include manual dose timing, patient vitality tracking, and stochastic body processing.

### Behavior or Interface Changes

- Replaced the template README with project-specific quick-start instructions for building and testing the simulation.
- Added [docs/USAGE.md](docs/USAGE.md) and [docs/active_plans/CHEMOTHERAPY_BODY_SIMULATION_PLAN.md](docs/active_plans/CHEMOTHERAPY_BODY_SIMULATION_PLAN.md) to document the current app and implementation plan.
- Added direct organ labels to the body diagram so bloodstream, liver, kidneys, and tumor are readable without relying on the status cards.
- Expanded the body view with a large tumor, stochastic response labels, shrinking tumor readouts, and patient status feedback.
- Simplified the front-panel controls and extended the default simulation window from 336 hours to 720 hours.

### Fixes and Maintenance

- Added `parts/CONTRACTS.md` and a single-file build script to keep simulation data flow and assembly order explicit.

### Removals and Deprecations

- None.

### Decisions and Failures

- Chose SVG-based chart and body rendering for the first release so the app stays dependency-free and easy to build into one HTML file.
- Replaced the initial fixed decay approach with a stochastic response model so tumor behavior can vary by run without relying on a precomputed seed.

### Developer Tests and Notes

- `bash build_app.sh`
- `node --check parts/constants.js && node --check parts/regimen_engine.js && node --check parts/pk_engine.js && node --check parts/game_state.js && node --check parts/chart_stage.js && node --check parts/body_visual.js && node --check parts/ui_rendering.js && node --check parts/init.js`
- `source source_me.sh && python3 -m pytest tests/web/test_web_build.py -q`
- `REPO_HYGIENE_SCOPE=changed source source_me.sh && python3 -m pytest tests/test_ascii_compliance.py -q`
- `REPO_HYGIENE_SCOPE=changed source source_me.sh && python3 -m pytest tests/test_pyflakes_code_lint.py -q`

## 2026-02-25

### Fixes and Maintenance

- Fixed `devel/commit_changelog.py` to detect staged (`git add`) changelog changes by falling back to `git diff --cached` when the unstaged diff is empty.

## 2026-02-22

- Updated `docs/REPO_STYLE.md` to require consistent section headings for each changelog day block (`Added`, `Changed`, `Fixed`, `Failures`, `Decisions`) and to keep empty sections with `- None.`.
- Updated `docs/REPO_STYLE.md` section names for changelog day blocks to `Additions`, `Updates`, `Removals`, `Failures`, and `Validations`.
- Updated `docs/REPO_STYLE.md` changelog day template to also require `Fixes` and `Decisions` sections.
- Updated `docs/REPO_STYLE.md` changelog policy language: empty categories are optional, every entry must be categorized, entries are never removed (only rephrased), and day category names are now the six longer labels.

## 2026-02-20

- Added `tests/test_init_files.py` to enforce surface-level `__init__.py` style rules from `docs/PYTHON_STYLE.md`, including checks for non-docstring implementation, imports, exports/maps, global assignments, and `__version__` assignments.
- Scoped `tests/test_init_files.py` to analyze only substantial `__init__.py` files and write violations to `report_init.txt` with stale report cleanup at test startup.
- Updated `propagate_style_guides.py` and `.gitignore` to include `test_init_files.py`.
- Simplified gitignore management to require `report_*.txt` and clean up legacy per-report entries in `propagate_style_guides.py`.
- Updated `tests/test_init_files.py` so the no-`__init__.py` case reports pass instead of skip.
- Updated `propagate_style_guides.py` to skip propagating `source_me.sh` into repositories that are already present on `PATH` (for example `junk-drawer`).
- Optimized `tests/test_pyflakes_code_lint.py` to run `pyflakes` once per pytest session and reuse indexed results for per-file tests, preserving one-dot-per-file output while reducing runtime overhead.
- Updated `docs/REPO_STYLE.md` to clarify that changelog entries should capture notable failures and key implementation choices, not only successful changes.

## 2026-02-19

- Added `tests/test_import_dot.py` to fail on relative from-import statements such as `from . import x` and `from .module import x`.
- Updated `propagate_style_guides.py` so `test_import_dot.py` is included in propagated test scripts.
- Updated `tests/test_import_star.py` and `tests/test_import_dot.py` to write per-test report files (`report_import_star.txt` and `report_import_dot.txt`), remove stale reports at test start, and include report paths in assertion failures.
- Renamed `tests/test_import_requirements.py` output to `report_import_requirements.txt` (from `report_imports.txt`) while preserving existing report generation and stale-file cleanup behavior.
- Added import report files to `.gitignore` and `propagate_style_guides.py` required ignore entries: `report_import_star.txt`, `report_import_dot.txt`, and `report_import_requirements.txt`.
- Restored per-file parametrized execution in `tests/test_import_star.py` and `tests/test_import_dot.py` so pytest shows one dot/failure per scanned file while still writing per-test report files.

## 2026-02-16

- Fixed false positives in `tests/test_shebangs.py` where Rust inner attributes (`#![...]`) were misidentified as shebangs, causing `.rs` files to be flagged under `shebang_not_executable`.

## 2026-02-14

- Trimmed `propagate_style_guides.py` to stop editing existing `AGENTS.md` files in target repositories while keeping a no-overwrite bootstrap copy when `AGENTS.md` is missing.
- Added a no-overwrite style file category in `propagate_style_guides.py` so `AGENTS.md` and `docs/AUTHORS.md` are copied only when absent and never updated in-place.
- Updated `propagate_style_guides.py` style destination routing so `CLAUDE.md` is propagated with overwrite to repo root while standard style guides continue to copy into `docs/`.
- Refactored `propagate_style_guides.py` file lists to explicit `(source_name, target_path)` mappings for overwrite and no-overwrite categories, removing special-case destination branching.
- Simplified `propagate_style_guides.py` file lists again to target-relative paths only, deriving source filenames from basename while preserving overwrite/no-overwrite behavior.
- Updated `propagate_style_guides.py` default source lookup/help text to use `<base>/starter_repo_template` instead of `<base>/junk-drawer`.
- Clarified in `README.md` that only `README.md` and `docs/CHANGELOG.md` are repo-specific, while other files are intended to remain generic template infrastructure.
- Standardized `README.md` with a concise infrastructure-focused overview, curated `docs/` links, and a verifiable quick-start test command.
- Updated `AGENTS.md` to direct AI agents to run commands with `bash -lc` (not Zsh) so `source_me.sh` works with expected shell semantics.
