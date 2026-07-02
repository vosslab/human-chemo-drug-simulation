# File structure

## Top-level layout

- [src/](../src/): the application source -- strict TypeScript ES modules plus the host
  HTML and CSS. See [docs/CODE_ARCHITECTURE.md](CODE_ARCHITECTURE.md) for how the modules
  fit together.
- [build_github_pages.sh](../build_github_pages.sh): the single canonical build.
  Type-checks `src/`, bundles [src/main.ts](../src/main.ts) into `dist/main.js` with
  esbuild (ESM, minified, sourcemap), copies the HTML and CSS into `dist/`, and writes
  `dist/.nojekyll`. `dist/` is the GitHub Pages artifact.
- [run_web_server.sh](../run_web_server.sh): local dev preview. Builds `dist/`, then serves
  it with `python3 -m http.server` on a random 8xxx port.
- [check_codebase.sh](../check_codebase.sh): fast, build-free gate -- `tsc` typecheck,
  wider `tests/`+`tools/` typecheck, ESLint, `prettier --check`, and the Node unit tests.
- [run_playwright_tests.sh](../run_playwright_tests.sh): runs the Playwright browser suite,
  building `dist/` first when needed.
- [playwright.config.ts](../playwright.config.ts): Playwright config; its `webServer` block
  rebuilds `dist/` and serves it on a random 8xxx port.
- [tests/](../tests/): pytest lint/hygiene gates, Node `*.mjs` unit tests, `tests/web/`
  (source-presence check and parity fixture), and `tests/playwright/` (browser smoke).
- [tools/](../tools/): standalone Node utilities, for example
  [tools/html_to_pdf.mjs](../tools/html_to_pdf.mjs).
- [devel/](../devel/): developer-only scripts (changelog rotation, version bump, clean
  build, environment setup). See [devel/DEVEL_README.md](../devel/DEVEL_README.md).
- [docs/](.): documentation, described below.
- [package.json](../package.json), [tsconfig.json](../tsconfig.json),
  [tsconfig.lint.json](../tsconfig.lint.json), [eslint.config.js](../eslint.config.js),
  [eslint.config.local.js](../eslint.config.local.js): TypeScript build and lint tooling.
  The npm scripts (`build`, `serve`, `check`, `clean`) are thin mirrors of the shell
  scripts above.
- [pip_requirements.txt](../pip_requirements.txt),
  [pip_requirements-dev.txt](../pip_requirements-dev.txt),
  [pip_extras.txt](../pip_extras.txt): Python dependency manifests for the pytest tooling.
- [Brewfile](../Brewfile): Homebrew package manifest.
- [source_me.sh](../source_me.sh): shell bootstrap sourced before running Python
  (`source source_me.sh && python3 ...`).
- [REPO_TYPE](../REPO_TYPE): repo type marker, `typescript`.
- [VERSION](../VERSION): current repo version string.
- [LICENSE.CC_BY_4_0](../LICENSE.CC_BY_4_0), [LICENSE.LGPL_v3](../LICENSE.LGPL_v3):
  license texts (docs/creative content vs. code).
- `deploy-pages.yml`: GitHub Pages deploy workflow. It lives at the repo root and is
  untracked, not under `.github/workflows/`; verify placement before relying on it. See
  [docs/CODE_ARCHITECTURE.md](CODE_ARCHITECTURE.md#known-gaps).

## The src/ subtree

Modules are listed in dependency order (bottom to top); `main.ts` is the entry point.

```text
src/
+- types.ts            (shared type contract; normative form of docs/CONTRACTS.md)
+- constants.ts        (DRUG_DATA, REGIMEN_PRESETS, SIM_DEFAULTS, CHEMO_CONSTANTS)
+- dom.ts              (typed requireElement/requireInput/requireSelect helpers)
+- regimen_engine.ts   (regimen lookup, mg/m2 -> mg dose-event construction)
+- pk_engine.ts        (PK simulation, tumor response, patient health, run summary)
+- game_state.ts       (CHEMO_STATE singleton, actions, rebuild + playback)
+- chart_stage.ts      (SVG concentration and outcome chart rendering)
+- body_visual.ts      (stylized body SVG, health bar, status pill)
+- ui_rendering.ts     (metric chips, controls, teaching notes; calls renderers)
+- main.ts             (bootstrap and DOM event wiring; entry point)
+- index.html          (host page; loads main.js as a module script)
`- style.css           (all page styling)
```

## tests/ subtree

```text
tests/
+- test_*.py                    (repo-wide pytest lint/hygiene gates)
+- test_regimen_engine.mjs      (Node unit test; imports src/regimen_engine.ts)
+- test_pk_engine.mjs           (Node unit test; imports src/pk_engine.ts)
+- test_game_state.mjs          (Node unit test; imports src/game_state.ts)
+- conftest.py                  (collect_ignore for e2e/ and playwright/)
+- file_utils.py                (shared REPO_ROOT helper)
+- check_ascii_compliance.py    (single-file ASCII checker)
+- fix_ascii_compliance.py      (single-file ASCII fixer)
+- fix_whitespace.py            (whitespace fixer)
+- TESTS_README.md, TESTS_TYPESCRIPT_README.md
+- web/
|  +- test_web_build.py         (fast, build-free src/ presence check)
|  `- parity_fixture.json       (legacy-vs-new DOM-id/control parity record)
`- playwright/
   +- app_boots.spec.ts         (browser smoke: bundle loads and reacts)
   `- repo_root.mjs             (helper)
```

## devel/ subtree

```text
devel/
+- DEVEL_README.md
+- bump_version.py
+- changelog_lib.py
+- clean_build.sh        (wipes dist/ and build/test artifacts)
+- dist_clean.sh          (deep cleaner; keeps package-lock.json for npm ci)
+- commit_changelog.py
+- query_changelog.py
+- rotate_changelog.py
+- flatten_broken_md_links.py
+- html_to_pdf.mjs
+- setup_playwright.sh
`- setup_typescript.sh
```

## Generated artifacts

- `dist/` is the build output of [build_github_pages.sh](../build_github_pages.sh) and the
  GitHub Pages artifact (`main.js`, `main.js.map`, `index.html`, `style.css`, `.nojekyll`).
  It is git-ignored and rebuilt from `src/` on every build.
- `_site/`, `node_modules/`, `*.tsbuildinfo`, `.eslintcache`, `.prettiercache`,
  `test-results/`, `playwright-report/`, `blob-report/`, `coverage/`, `meta.json`, and
  `stats.html` are git-ignored (see [.gitignore](../.gitignore)).
- `output*/` and `_temp*.?*` are git-ignored scratch conventions.
- `report_*.txt` at the repo root (for example `report_markdown_links.txt`) are git-ignored
  lint report scratch files.

## Documentation map

- [docs/CODE_ARCHITECTURE.md](CODE_ARCHITECTURE.md): system design, components, data flow
  (this file's companion).
- [docs/FILE_STRUCTURE.md](FILE_STRUCTURE.md): this file.
- [docs/CONTRACTS.md](CONTRACTS.md): canonical data-model and event-flow spec; normative
  source for [src/types.ts](../src/types.ts).
- [docs/INSTALL.md](INSTALL.md), [docs/USAGE.md](USAGE.md): setup and run instructions.
- [docs/CHANGELOG.md](CHANGELOG.md): dated change log; rotates into
  `docs/CHANGELOG-YYYY-MM[a-z].md` archives per [REPO_STYLE.md](REPO_STYLE.md).
- [docs/NEWS.md](NEWS.md), [docs/RELEASE_HISTORY.md](RELEASE_HISTORY.md),
  [docs/ROADMAP.md](ROADMAP.md), [docs/RELATED_PROJECTS.md](RELATED_PROJECTS.md),
  [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md): release, roadmap, and support docs.
- [docs/REPO_STYLE.md](REPO_STYLE.md), [docs/PYTHON_STYLE.md](PYTHON_STYLE.md),
  [docs/MARKDOWN_STYLE.md](MARKDOWN_STYLE.md), [docs/TYPESCRIPT_STYLE.md](TYPESCRIPT_STYLE.md):
  style guides.
- [docs/E2E_TESTS.md](E2E_TESTS.md), [docs/PYTEST_STYLE.md](PYTEST_STYLE.md),
  [docs/PLAYWRIGHT_USAGE.md](PLAYWRIGHT_USAGE.md): testing conventions.
- [docs/CLAUDE_HOOK_USAGE_GUIDE.md](CLAUDE_HOOK_USAGE_GUIDE.md),
  [docs/AUTHORS.md](AUTHORS.md): centrally maintained references.
- [docs/active_plans/](active_plans/): in-flight planning artifacts, filed by kind
  (`active/`, `audits/`, `reports/`, `decisions/`, `workstreams/`).

## Where to add new work

- App logic (drugs, regimens, PK math, rendering, UI wiring): add to the relevant module
  under [src/](../src/); update [docs/CONTRACTS.md](CONTRACTS.md) and
  [src/types.ts](../src/types.ts) if the change adds or changes a data field.
- Node unit tests for engine or state behavior: add a `tests/test_*.mjs` importing the
  `src/*.ts` module under test.
- Browser behavior: extend [tests/playwright/app_boots.spec.ts](../tests/playwright/app_boots.spec.ts)
  or add a new `tests/playwright/*.spec.ts`.
- Repo-wide lint/hygiene checks: add a new `tests/test_*.py` following the existing pattern
  in [tests/](../tests/).
- Developer tooling and one-off scripts: [devel/](../devel/) for repo maintenance,
  [tools/](../tools/) for standalone utilities.
- Documentation: `docs/` for reference docs (SCREAMING_SNAKE_CASE filenames);
  `docs/active_plans/<subdir>/` for working planning artifacts, filed by kind.
