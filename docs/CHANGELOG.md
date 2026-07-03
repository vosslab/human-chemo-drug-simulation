## 2026-07-02

### Additions and New Features

- Completed the `parts/*.js` -> `src/*.ts` migration (Milestones 1, 3, 4, 6). Ported
  the remaining modules to strict TypeScript ES modules with named exports and
  explicit types: `src/types.ts` (data-shape contract), `src/constants.ts`,
  `src/dom.ts` (typed DOM helpers that throw on a missing id), `src/regimen_engine.ts`,
  `src/game_state.ts` (exports the shared `CHEMO_STATE` singleton plus a
  `chemoStateReset()` test helper), `src/chart_stage.ts`, `src/body_visual.ts`,
  `src/ui_rendering.ts`, and `src/main.ts` (the `DOMContentLoaded` entry point). Added
  `src/index.html` (merged from the old HTML fragments, loads `main.js` as an ES
  module) and `src/style.css`. Added tsx unit tests `tests/test_regimen_engine.mjs`
  and `tests/test_game_state.mjs` that import `src/*.ts` directly. `./build_github_pages.sh`
  now produces `dist/index.html` + `dist/main.js` from the single canonical build, and
  `./check_codebase.sh` runs a real typecheck instead of skipping. Old-vs-new DOM-id
  and control-default parity was captured in `tests/web/parity_fixture.json` (60 ids
  and all initial control values match) before any legacy file was deleted.
- Made `playwright.config.ts` pick a random port in the 8xxx range per run (same
  scheme as `run_web_server.sh`) instead of a fixed port, pinning it into `PW_PORT`
  so the webServer and worker processes agree, so a stray leftover server on one
  port can no longer block the suite.
- Added `playwright.config.ts` (repo root) and `tests/playwright/app_boots.spec.ts`
  (Milestone 5 / WP-playwright), closing the `run_playwright_tests.sh` gap noted
  earlier in this changelog. The `webServer` block runs `./build_github_pages.sh`
  before serving `dist/` on `http://127.0.0.1:8099`, so the smoke test can never run
  against stale build output. The spec asserts boot (populated `#chart-root`,
  `#preset-button-grid` buttons, non-empty `#metric-life-status`) and then exercises
  one interaction: it clicks a `.preset-button` other than the currently
  `is-active` one, moves `#time-scrubber`, and asserts `#chart-root` and
  `#metric-total-burden` both change from their pre-interaction snapshots. Verified
  `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p tsconfig.lint.json`
  (previously failed `TS18003` with no inputs; now typechecks the new spec file),
  `npx eslint playwright.config.ts tests/playwright/app_boots.spec.ts`, and
  `./run_playwright_tests.sh` all clean/passing. Playwright's Chromium browser was
  already installed in the local cache; no `npx playwright install` was needed.
- Ported the largest legacy module `parts/pk_engine.js` to strict TypeScript ESM as
  `src/pk_engine.ts` (Milestone 2 / WP-pk), preserving all numeric behavior verbatim.
  Exported all 28 `chemoPk*` functions as named exports with explicit parameter and
  return types, importing values from `./constants` and `./regimen_engine` and types via
  `import type` from `./types`. Handled `noUncheckedIndexedAccess` with loop-bound
  non-null reads (erased at runtime, zero behavior change) and honest optional-config
  input views; the two-compartment/one-compartment half-life reads use `!` under the
  dispatch invariant. Added `tests/test_pk_engine.mjs` (12 `node:test` cases) that pins
  `Math.random` to 0 and asserts golden values captured from the legacy `parts/*.js` via
  `node:vm`, covering the PK primitives, organ routing, full-run simulations for all four
  regimens, tumor eradication, regimen-profile effects, and the run summary. `tsc --noEmit`
  is clean and both `.mjs` suites pass.
- Added `docs/TROUBLESHOOTING.md` (symptoms and fixes for the `TS18003` typecheck
  failure, the broken `build_github_pages.sh` entry-point error, the repo-root build
  output path, and Playwright/Python setup) and `docs/ROADMAP.md` (near-term `parts/*.js`
  to `src/*.ts` migration, build-path reconciliation, and non-goals) during the docset
  refresh. Fixed a `docs/docs/` double-prefix link and two `..`/untracked-file link
  issues surfaced by `tests/test_markdown_links.py`.
- Captured `docs/screenshots/main_view.png` (Playwright, headless Chromium, full-page,
  1280x900 viewport) of the built `chemotherapy_body_simulation.html` at its default
  state: regimen presets, adjust-protocol and patient-factor controls, concentration
  and tumor/vitality timelines, body flow view, adverse effects, run summary, and
  teaching notes. Filled the `screenshot-docs`-managed block in `README.md` with the
  real embed line.
- Added `docs/INSTALL.md` with real requirements, `npm install` / `devel/setup_typescript.sh`
  / `pip_requirements-dev.txt` install steps, and a `bash build_app.sh` verify-install step.
  Recorded the `npm run build` / `npm run serve` / `npm run check` / `run_playwright_tests.sh`
  TypeScript-template gap (missing `src/main.ts` and `playwright.config.ts`, confirmed by
  running `build_github_pages.sh` directly) as "Known gaps" rather than presenting them as
  working commands.
- Added `docs/CODE_ARCHITECTURE.md` and `docs/FILE_STRUCTURE.md`, documenting the
  `parts/*.js` -> `build_app.sh` -> `chemotherapy_body_simulation.html` pipeline as the
  real, working build, and recording the `build_github_pages.sh` / `run_web_server.sh` /
  `check_codebase.sh` / `run_playwright_tests.sh` TypeScript-template gap (missing
  `src/main.ts` and `playwright.config.ts`) as a known structural issue in the
  architecture doc's "Known gaps" section rather than papering over it.
- Added `docs/RELATED_PROJECTS.md`, mapping confirmed upstream/tooling sources
  (`starter-repo-template`, `claude-code-permissions-hook`) plus same-author sibling
  teaching simulations and same-domain pharmacokinetics tools found via bounded web
  discovery (`pksim`, `PK-Visualization`, Maxsim2).
- Added `devel/clean_build.sh`, the light build cleaner wired to the `npm run clean` target. It
  wipes build output, tool caches, and test artifacts while keeping `node_modules` (and Rust
  `target/`) intact, so the next build is ab initio with no reinstall.
- Updated `devel/dist_clean.sh` (the deep reset) to keep the committed `package-lock.json`, so a
  distribution-clean checkout still drives a reproducible `npm ci`.
- Repointed the `clean` npm alias in `package.json` from `./dist_clean.sh` to
  `./devel/clean_build.sh`.
- Added a "Try it live" GitHub Pages link near the top of README.md pointing to https://vosslab.github.io/human-chemo-drug-simulation/, so readers can launch the live app in one click.

### Behavior or Interface Changes

- Replaced `docs/USAGE.md`, which had been stale `reset_repo.py` bootstrap-script
  boilerplate carried over from the starter template, with real usage for this app:
  `bash build_app.sh` quick start, the `parts/*.js` source-module table, pytest/node
  test invocation examples, and inputs/outputs. Cross-linked the same known-build-gap
  notes recorded in `docs/INSTALL.md`.
- Standardized `README.md` via the `readme-docs` skill: fixed the quick-start build output path
  from the stale `output/chemotherapy_body_simulation.html` to the actual repo-root
  `chemotherapy_body_simulation.html` written by `build_app.sh`; rewrote the first paragraph as
  pure prose (no repo-name code span, under the 250-character About-field limit) to pass
  `tests/test_readme_first_paragraph.py`; added a Documentation section linking
  `docs/INSTALL.md`, `docs/USAGE.md`, `docs/CODE_ARCHITECTURE.md`, and `docs/FILE_STRUCTURE.md` by
  convention (these four are being authored concurrently by other doc skills, so
  `tests/test_markdown_links.py::test_markdown_links[README.md]` fails until they land); added
  `run_web_server.sh` as the dev-server quick-start alternative; added a Testing section covering
  `pytest tests/` and `run_playwright_tests.sh`; inserted the empty
  `<!-- screenshots:begin/end (managed by screenshot-docs) -->` sentinel block reserved for the
  `screenshot-docs` skill. No live-demo/GitHub Pages link was added: `deploy-pages.yml` sits
  untracked at the repo root, not under `.github/workflows/`, so Pages deployment is not yet
  confirmed active.

### Removals and Deprecations

- Retired the legacy JavaScript pipeline (Milestone 6). Deleted the `parts/` directory
  (the concatenated `*.js` modules and HTML fragments), `build_app.sh`, and the
  generated single-file `chemotherapy_body_simulation.html`, now that `src/*.ts` ->
  `build_github_pages.sh` -> `dist/` is the single canonical build. Moved
  `parts/CONTRACTS.md` to `docs/CONTRACTS.md` (normative for `src/types.ts`) and reduced
  `eslint.config.local.js` to `export default []` (its `parts/**/*.js` and
  `tests/web/**/*.js` blocks targeted files that no longer exist). Refreshed
  `docs/CODE_ARCHITECTURE.md`, `docs/FILE_STRUCTURE.md`, `README.md`, `docs/INSTALL.md`,
  `docs/USAGE.md`, `docs/ROADMAP.md`, and `docs/TROUBLESHOOTING.md` to describe the
  single TypeScript build and drop the resolved "two pipelines / src missing" gaps.
- Removed the brittle `test_web_build_contains_expected_sections` substring-grep test
  and the build-invoking `test_web_build_creates_dist_artifacts` from
  `tests/web/test_web_build.py`; per `docs/PYTEST_STYLE.md` the pytest fast lane no
  longer runs `build_github_pages.sh` (building is covered by the Playwright smoke and
  `check_codebase.sh`). The file keeps only the fast source-presence check. Deleted the
  superseded vm-based `tests/web/test_pk_calibration.js`.
- Removed the root `dist_clean.sh`; both cleaners now live only under `devel/`
  (`devel/clean_build.sh` light, `devel/dist_clean.sh` deep).

## 2026-07-01

### Fixes and Maintenance

- Fixed `check_codebase.sh` failing with `TS18003: No inputs were found` on this JS-only
  repo. Both `tsc` steps (`tsconfig.json`, `tsconfig.lint.json`) now guard on `.ts` file
  presence via `find` and emit a loud `SKIP` when none exist, matching the existing
  `test:node` compgen guard and the script's stated honesty principle, instead of failing
  the gate. Root cause: `REPO_TYPE=typescript` scaffold, but all source is plain `.js` under
  `parts/`.
- Configured `eslint.config.local.js` (the consumer-owned overrides file) for the JS
  concatenation model, clearing 262 false-positive lint errors. `parts/**/*.js` get browser
  globals plus `no-undef` and `no-unused-vars` disabled, because those files are non-module
  browser scripts concatenated in dependency order at build time; ESLint sees each in
  isolation and cannot resolve the ~100 shared cross-file symbols (`CHEMO_STATE`,
  `chemoChartRender`, etc.). `tests/web/**/*.js` get CommonJS `sourceType` plus node globals
  and `no-require-imports` off. Syntax and hygiene rules (`no-var`, `prefer-const`, `eqeqeq`)
  stay active.
- Removed 4 genuine dead-code lint findings surfaced once the config was fixed: dead
  initializers `percentValue = 0` (`parts/chart_stage.js`) and `grade = "C"`
  (`parts/pk_engine.js`) that every branch reassigns; a discarded first `visualState` build
  in `parts/pk_engine.js` computed with the pre-update tumor volume and overwritten before
  any read; and a redeclared `var eventIndex` in the same function scope. Behavior preserved
  (the 210+ PK tests in `tests/web/test_web_build.py` pass).
- Added missing `-> None` return annotations to 7 test functions in
  `tests/web/test_web_build.py` to satisfy `tests/test_function_typing.py`.
- Reformatted 9 files with `prettier --write` after the prettier 3.9.4 floor bump. The fleet-wide
  prettier floor bump changed formatting output such that these previously-clean files failed
  `prettier --check`. Ran `npx prettier --write '**/*.{ts,tsx,mts,cts,js,mjs,cjs}'` to conform to
  the canonical `.prettierrc`; whitespace-only, no logic change.
- Added the canonical `allowScripts` allow-list (esbuild + fsevents install scripts) to `package.json` to silence `npm warn allow-scripts` and match the template.
- Added root `dist_clean.sh` (modeled on the sports-life-game reference script: `rm -rf
  dist _site *.tsbuildinfo .eslintcache`, rooted via `git rev-parse --show-toplevel`) so
  the `npm run clean` alias in `package.json` resolves to a real script instead of a
  missing file.
- Replaced the `__REPO_NAME__` / `__REPO_VERSION__` placeholders in `package.json` with
  `human-chemo-drug-simulation` and `0.0.0`.

### Decisions and Failures

- `./check_codebase.sh` fails at the typecheck step with `TS18003: No inputs were found
  in config file`, because this repo predates the TypeScript template: its source lives
  in plain JavaScript under `parts/*.js`, assembled by `build_app.sh` into a single HTML
  file, with no `src/*.ts` entry point anywhere in the repo. This is a structural,
  off-template gap, not a mechanical lint/format issue, so it was left as-is. Migrating
  `parts/*.js` to `src/*.ts` is deferred to a future TypeScript-migration pass.

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
- Added [USAGE.md](USAGE.md) and [active_plans/CHEMOTHERAPY_BODY_SIMULATION_PLAN.md](active_plans/CHEMOTHERAPY_BODY_SIMULATION_PLAN.md) to document the current app and implementation plan.
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
