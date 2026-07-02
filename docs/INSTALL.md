# Install

Installing this repo means having Node.js/npm available to run the TypeScript build and,
optionally, Python 3.12 to run the pytest suite. No package is published; you run the
scripts directly from a clone.

## Requirements

- Node.js and npm on PATH (used by `build_github_pages.sh` to typecheck with `tsc` and
  bundle `src/main.ts` with esbuild).
- Python 3.12, run through `source source_me.sh && python3` (see [PYTHON_STYLE.md](PYTHON_STYLE.md)),
  for the pytest suite under `tests/`.
- A modern browser to open the built `dist/index.html` file.

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

- Playwright browsers (only needed if you plan to work on browser-driven tests):

  ```bash
  bash devel/setup_playwright.sh
  ```

## Verify install

Build the app and confirm the `dist/` artifact is produced:

```bash
./build_github_pages.sh
```

This prints `Built dist/ (GitHub Pages-ready).` on success and writes `dist/index.html`
and `dist/main.js` (the `dist/` folder is gitignored). You can also run the fast
codebase gate, which typechecks, lints, format-checks, and runs the Node unit tests:

```bash
./check_codebase.sh
```

## Known gaps

- [ ] Confirm the minimum supported Node.js version (no `engines` field in `package.json`).
</content>
</invoke>
