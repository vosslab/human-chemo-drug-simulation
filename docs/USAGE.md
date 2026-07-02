# Usage

`human-chemo-drug-simulation` is a browser-based teaching demo of chemotherapy drug
pharmacokinetics. Users build the app, open it in a browser, pick a regimen preset (or
set manual dosing), and watch drug concentration, tumor volume, and patient vitality
play out over a 30-day simulated window.

## Quick start

Build the app into `dist/` and preview it in a browser:

```bash
./run_web_server.sh
```

`run_web_server.sh` runs the build first, then serves `dist/` on a random `8xxx` port
and prints the local URL. To build without serving, run `./build_github_pages.sh`,
which typechecks `src/` with `tsc`, bundles `src/main.ts` into `dist/main.js` with
esbuild, and copies `src/index.html` and `src/style.css` into `dist/`.

## Source layout

There is no CLI; the app is driven entirely through the browser UI once built. Source
modules live under `src/` as TypeScript ESM:

| File | Role |
| --- | --- |
| `src/types.ts` | shared type definitions (see [CONTRACTS.md](CONTRACTS.md)) |
| `src/constants.ts` | drug and regimen constant data |
| `src/dom.ts` | typed DOM element lookups and helpers |
| `src/regimen_engine.ts` | regimen preset and dose-schedule logic |
| `src/pk_engine.ts` | one-compartment pharmacokinetic model and response/toxicity math |
| `src/game_state.ts` | simulation state, case-mode, and run-summary tracking |
| `src/chart_stage.ts` | concentration/outcome chart rendering |
| `src/body_visual.ts` | body diagram visualization |
| `src/ui_rendering.ts` | control-panel and stats-strip rendering |
| `src/main.ts` | app bootstrap and event wiring (build entry point) |

The page shell and styles are `src/index.html` and `src/style.css`. Edit any `src/*.ts`
file (or `src/index.html`, `src/style.css`), then rerun `./build_github_pages.sh` to
regenerate `dist/`. `docs/CONTRACTS.md` is the normative data-shape reference for
`src/types.ts`.

## Examples

Rebuild after a source edit and preview in the browser:

```bash
./run_web_server.sh
```

Run the fast codebase gate (typecheck, eslint, prettier, and Node unit tests):

```bash
./check_codebase.sh
```

Run just the Node unit tests, which import the `src/*.ts` modules through the tsx
runtime loader:

```bash
node --import tsx --test tests/test_*.mjs
```

Run the Python pytest suite (repo-wide lint/style checks):

```bash
source source_me.sh && python3 -m pytest tests/ -q
```

Run the browser-driven Playwright smoke test:

```bash
./run_playwright_tests.sh
```

## Inputs and outputs

- Inputs: the `src/*.ts` source modules plus `src/index.html` and `src/style.css`.
- Output: `dist/index.html` and `dist/main.js`, produced by `./build_github_pages.sh`.
  The `dist/` folder is gitignored and serves as the GitHub Pages artifact; preview it
  locally with `./run_web_server.sh`.
</content>
