# File structure

## Top-level layout

- [parts/](../parts/): the real application source -- plain JavaScript modules, HTML
  shell fragments, CSS, and [parts/CONTRACTS.md](../parts/CONTRACTS.md) (the canonical
  data-model spec). See [docs/CODE_ARCHITECTURE.md](CODE_ARCHITECTURE.md) for how the
  modules fit together.
- [chemotherapy_body_simulation.html](../chemotherapy_body_simulation.html): the built,
  self-contained single-file output of `build_app.sh`. Committed to the repo so the app
  can be opened directly without a build step.
- [build_app.sh](../build_app.sh): concatenates `parts/*` into
  `chemotherapy_body_simulation.html`. The real, working build.
- [build_github_pages.sh](../build_github_pages.sh): TypeScript/esbuild build targeting
  `src/main.ts` -> `dist/`. `src/` does not exist in this repo; this script currently
  aborts. See [docs/CODE_ARCHITECTURE.md](CODE_ARCHITECTURE.md#known-gaps).
- [run_web_server.sh](../run_web_server.sh): serves `dist/` for local preview; depends
  on `build_github_pages.sh` succeeding first, so it is currently broken too.
- [run_playwright_tests.sh](../run_playwright_tests.sh): runs the Playwright browser
  suite; requires `playwright.config.ts`, which does not exist yet.
- [check_codebase.sh](../check_codebase.sh): typecheck + lint + format + Node unit-test
  gate for the TypeScript template layout (`src/`, `tests/*.mjs`). Fails the typecheck
  step in this repo for the same `src/`-does-not-exist reason.
- [tests/](../tests/): pytest unit/lint tests, plus `tests/web/` (Node-driven checks of
  the built app) and `tests/playwright/` (browser E2E, currently just a helper module).
- [tools/](../tools/): standalone Node scripts, for example
  [tools/html_to_pdf.mjs](../tools/html_to_pdf.mjs) (renders the built HTML to PDF).
- [devel/](../devel/): developer-only scripts (changelog rotation, version bump, clean
  build, environment setup). See [devel/DEVEL_README.md](../devel/DEVEL_README.md).
- [docs/](.): documentation, described below.
- [package.json](../package.json), [tsconfig.json](../tsconfig.json),
  [tsconfig.lint.json](../tsconfig.lint.json), [eslint.config.js](../eslint.config.js),
  [eslint.config.local.js](../eslint.config.local.js): TypeScript-template tooling
  config. `tsconfig.json` includes only `**/*.ts`, so it has no inputs while `src/`
  is absent.
- [pip_requirements.txt](../pip_requirements.txt),
  [pip_requirements-dev.txt](../pip_requirements-dev.txt),
  [pip_extras.txt](../pip_extras.txt): Python dependency manifests for the pytest
  tooling used to test and lint this repo.
- [Brewfile](../Brewfile): Homebrew package manifest.
- [source_me.sh](../source_me.sh): shell bootstrap sourced before running Python
  commands (`source source_me.sh && python3 ...`).
- [REPO_TYPE](../REPO_TYPE): repo type marker, currently `typescript`.
- [VERSION](../VERSION): current repo version string.
- [LICENSE.CC_BY_4_0](../LICENSE.CC_BY_4_0), [LICENSE.LGPL_v3](../LICENSE.LGPL_v3):
  license texts (docs/creative content vs. code).
- `deploy-pages.yml`: GitHub Pages deploy workflow definition (not
  under `.github/workflows/` at the time of this audit -- verify placement before relying
  on it to deploy automatically).

## Key subtrees

### parts/

```text
parts/
+- CONTRACTS.md        (canonical data-model + event-flow spec)
+- head.html            (page <head>, opening tags)
+- body.html            (page body markup, controls, chart/visual containers)
+- tail.html            (closing tags)
+- style.css            (all page styling)
+- constants.js         (DRUG_DATA, REGIMEN_PRESETS)
+- regimen_engine.js    (mg/m2 -> mg dose event construction)
+- pk_engine.js          (PK simulation, tumor response, patient health)
+- game_state.js         (CHEMO_STATE, simulation rebuild orchestration)
+- chart_stage.js        (concentration/outcome chart rendering)
+- body_visual.js        (animated body diagram rendering)
+- ui_rendering.js       (stats strip, teaching notes, event log rendering)
`- init.js               (DOM wiring, entry point loaded last)
```

`build_app.sh` concatenates these files in this exact order (head, style, body,
scripts, tail) to produce `chemotherapy_body_simulation.html`.

### tests/

```text
tests/
+- test_*.py                    (repo-wide pytest lint/hygiene gates)
+- conftest.py                  (collect_ignore for e2e/ and playwright/)
+- file_utils.py                (shared REPO_ROOT helper)
+- check_ascii_compliance.py    (single-file ASCII checker, used by test_ascii_compliance.py)
+- fix_ascii_compliance.py      (single-file ASCII fixer)
+- fix_whitespace.py            (whitespace fixer)
+- TESTS_README.md, TESTS_TYPESCRIPT_README.md
+- web/
|  +- test_web_build.py         (builds parts/* and checks output; PK/regimen checks via Node vm)
|  `- test_pk_calibration.js    (PK calibration checks)
`- playwright/
   `- repo_root.mjs             (helper; no *.spec.ts test files present yet)
```

### devel/

```text
devel/
+- DEVEL_README.md
+- bump_version.py
+- changelog_lib.py
+- clean_build.sh        (light cleaner: build output, caches, test artifacts)
+- dist_clean.sh          (deep cleaner: keeps package-lock.json for reproducible npm ci)
+- commit_changelog.py
+- query_changelog.py
+- rotate_changelog.py
+- flatten_broken_md_links.py
+- html_to_pdf.mjs
+- setup_playwright.sh
`- setup_typescript.sh
```

## Generated artifacts

- `chemotherapy_body_simulation.html` is committed (not generated-and-ignored) so the
  app works without a build step; `build_app.sh` overwrites it in place.
- `dist/`, `_site/`, `node_modules/`, `*.tsbuildinfo`, `.eslintcache`,
  `.prettiercache`, `test-results/`, `playwright-report/`, `blob-report/`, `coverage/`,
  `meta.json`, `stats.html` are all git-ignored (see [.gitignore](../.gitignore)).
  `dist/` is the target of the currently-broken `build_github_pages.sh`.
- `output*/` and `_temp*.?*` are also git-ignored (universal scratch conventions).
- `report_*.txt` (for example `report_function_typing.txt`,
  `report_markdown_links.txt` at the repo root) are git-ignored lint report scratch
  files.

## Documentation map

- [docs/CODE_ARCHITECTURE.md](CODE_ARCHITECTURE.md): system design, components, data
  flow (this file's companion).
- [docs/FILE_STRUCTURE.md](FILE_STRUCTURE.md): this file.
- [docs/USAGE.md](USAGE.md): currently documents the starter-template `reset_repo.py`
  bootstrap flow, not this app's own build/run/test commands; verify and update
  separately if app-specific usage docs are wanted here.
- [docs/CHANGELOG.md](CHANGELOG.md): dated change log; rotates into
  `docs/CHANGELOG-YYYY-MM[a-z].md` archives per [REPO_STYLE.md](REPO_STYLE.md).
- [docs/REPO_STYLE.md](REPO_STYLE.md), [docs/PYTHON_STYLE.md](PYTHON_STYLE.md),
  [docs/MARKDOWN_STYLE.md](MARKDOWN_STYLE.md),
  [docs/TYPESCRIPT_STYLE.md](TYPESCRIPT_STYLE.md): style guides.
- [docs/E2E_TESTS.md](E2E_TESTS.md), [docs/PYTEST_STYLE.md](PYTEST_STYLE.md),
  [docs/PLAYWRIGHT_USAGE.md](PLAYWRIGHT_USAGE.md): testing conventions.
- [docs/CLAUDE_HOOK_USAGE_GUIDE.md](CLAUDE_HOOK_USAGE_GUIDE.md): centrally maintained
  agent permissions reference.
- [docs/AUTHORS.md](AUTHORS.md): centrally maintained maintainers list.
- [docs/active_plans/](active_plans/): in-flight planning artifacts, filed by kind
  (`active/`, `audits/`, `reports/`, `decisions/`, `workstreams/`).
- [parts/CONTRACTS.md](../parts/CONTRACTS.md): lives under `parts/`, not `docs/`,
  because it documents the app's internal data contracts alongside the source that
  implements them.

## Where to add new work

- App logic (drugs, regimens, PK math, rendering, UI wiring): add to the relevant
  module under [parts/](../parts/); update
  [parts/CONTRACTS.md](../parts/CONTRACTS.md) if the change adds or changes a data
  field.
- Tests for app behavior: extend
  [tests/web/test_web_build.py](../tests/web/test_web_build.py) or add a new
  `tests/web/test_*.py`; browser-driven checks belong under `tests/playwright/`
  once `playwright.config.ts` exists.
- Repo-wide lint/hygiene checks: add a new `tests/test_*.py` following the existing
  pattern in [tests/](../tests/).
- Developer tooling and one-off scripts: [devel/](../devel/) for repo maintenance,
  [tools/](../tools/) for standalone utilities used by the app or its docs pipeline.
- Documentation: `docs/` for reference docs (SCREAMING_SNAKE_CASE filenames);
  `docs/active_plans/<subdir>/` for working planning artifacts, filed by kind.
