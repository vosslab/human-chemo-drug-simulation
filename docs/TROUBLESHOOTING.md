# TROUBLESHOOTING.md

Known issues and fixes for building, checking, and running the chemotherapy
simulation. Symptoms are grouped by the command that surfaces them.

## check_codebase.sh fails with TS18003

- Symptom: `./check_codebase.sh` aborts at the typecheck step with
  `TS18003: No inputs were found in config file`.
- Cause: this repo predates the TypeScript template. Its source lives in plain
  JavaScript under `parts/*.js`, assembled by `build_app.sh` into a single HTML
  file. There is no `src/*.ts` entry point for `tsconfig.json` to match.
- Status: known structural, off-template gap. It is not a mechanical lint or
  format problem.
- Workaround: skip the codebase-check gate for now. The working build is
  `bash build_app.sh`. See [ROADMAP.md](ROADMAP.md) for the migration plan.

## build_github_pages.sh cannot find an entry point

- Symptom: `./build_github_pages.sh` (aliased as `npm run build`) errors with
  `no entry point. Create src/main.ts (preferred) or src/init.ts.`
- Cause: the GitHub Pages build expects an ESM TypeScript entry under `src/`,
  which does not exist in this repo yet.
- Fix: use `bash build_app.sh` instead. It concatenates `parts/*.js`,
  `parts/style.css`, and the HTML fragments into the single-file output
  `chemotherapy_body_simulation.html` at the repo root.

## Built HTML file is not found where expected

- Symptom: the browser shows a missing-file error when opening the built page.
- Cause: `build_app.sh` writes `chemotherapy_body_simulation.html` to the repo
  root, not to an `output/` folder.
- Fix: open `chemotherapy_body_simulation.html` from the repo root, or serve it
  with `bash run_web_server.sh`.

## Playwright tests fail on a fresh checkout

- Symptom: `bash run_playwright_tests.sh` fails before any test runs.
- Cause: Playwright browsers are not installed.
- Fix: run `./devel/setup_playwright.sh` (or `npm run setup:playwright`) once to
  install the browser binaries, then re-run the tests.

## Python test commands fail to import repo modules

- Symptom: `python3 -m pytest tests/` cannot resolve repo paths or the wrong
  Python is used.
- Fix: run Python through the repo bootstrap: `source source_me.sh && python3`.
  Use Python 3.12.
