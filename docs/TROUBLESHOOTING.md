# TROUBLESHOOTING.md

Known issues and fixes for building, checking, and running the chemotherapy
simulation. Symptoms are grouped by the command that surfaces them.

## Built page shows a blank screen or missing chart

- Symptom: `dist/index.html` loads but the simulation UI does not render.
- Cause: a stale or partial `dist/` from an interrupted build, so `dist/main.js`
  does not match the current `src/`.
- Fix: rebuild from scratch with `./build_github_pages.sh` (it wipes `dist/`
  first), then preview with `./run_web_server.sh`.

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
</content>
