# Install

Installing this repo means having Node.js/npm available to run the build script and,
optionally, Python 3.12 to run the pytest suite. No package is published; you run the
scripts directly from a clone.

## Requirements

- Node.js and npm on PATH (used by `build_app.sh` for no external packages; the app
  itself is plain JavaScript with no bundler at runtime).
- Python 3.12, run through `source source_me.sh && python3` (see [PYTHON_STYLE.md](PYTHON_STYLE.md)),
  for the pytest suite under `tests/`.
- A modern browser to open the built `chemotherapy_body_simulation.html` file.

## Install steps

- Clone the repo and `cd` into it.
- Install npm devDependencies (TypeScript tooling, eslint, prettier, playwright, tsx):

  ```bash
  npm install
  ```

  or run the wrapper, which also checks for `npm` and installs on first use:

  ```bash
  bash devel/setup_typescript.sh
  ```

- Python dependencies (`bandit`, `packaging`, `pyflakes`, `pytest`, `rich`) are declared
  in `pip_requirements-dev.txt`. Install with:

  ```bash
  source source_me.sh && pip3 install -r pip_requirements-dev.txt
  ```

- Playwright browsers (only needed if you plan to work on browser-driven tests; see
  [Known gaps](#known-gaps)):

  ```bash
  bash devel/setup_playwright.sh
  ```

## Verify install

Build the app and confirm the single-file artifact is produced:

```bash
bash build_app.sh
```

This prints `Built <repo>/chemotherapy_body_simulation.html` on success. You can also
run the focused pytest check that performs the same build and asserts on its content:

```bash
source source_me.sh && python3 -m pytest tests/web/test_web_build.py -q
```

## Known gaps

- [ ] Confirm the minimum supported Node.js version (no `engines` field in `package.json`).
- [ ] `npm run build` (`build_github_pages.sh`) currently fails with
  `ERROR: no entry point. Create src/main.ts (preferred) or src/init.ts.` because this
  repo predates the TypeScript `src/main.ts` template layout; its source lives in plain
  JavaScript under `parts/*.js`. Do not treat `npm run build` as installed/working until
  this is resolved.
- [ ] `npm run serve` (`run_web_server.sh`) calls `build_github_pages.sh` internally and
  fails for the same reason; `bash build_app.sh` plus opening the HTML file directly is
  the working path today.
- [ ] `npm run check` (`check_codebase.sh`) fails at the `tsc --noEmit -p tsconfig.json`
  typecheck step for the same missing-entry-point reason.
- [ ] `bash run_playwright_tests.sh` (and `npm run test:playwright`) require
  `playwright.config.ts`, which is not present in this repo yet.
