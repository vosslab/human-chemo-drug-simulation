# Usage

`human-chemo-drug-simulation` is a browser-based teaching demo of chemotherapy drug
pharmacokinetics. Users build the app into one self-contained HTML file, open it in a
browser, pick a regimen preset (or set manual dosing), and watch drug concentration,
tumor volume, and patient vitality play out over a 30-day simulated window.

## Quick start

Build the single-file app and open it in a browser:

```bash
bash build_app.sh
open chemotherapy_body_simulation.html
```

`build_app.sh` concatenates `parts/head.html`, `parts/style.css`, `parts/body.html`,
and the `parts/*.js` modules (in dependency order: `constants.js`, `regimen_engine.js`,
`pk_engine.js`, `game_state.js`, `chart_stage.js`, `body_visual.js`, `ui_rendering.js`,
`init.js`) plus `parts/tail.html` into `chemotherapy_body_simulation.html` at the repo
root. Because the output is one self-contained file, opening it directly (`file://`)
works with no local server.

## Source layout

There is no CLI; the app is driven entirely through the browser UI once built. Source
modules live under `parts/`:

| File | Role |
| --- | --- |
| `parts/constants.js` | drug and regimen constant data |
| `parts/regimen_engine.js` | regimen preset and dose-schedule logic |
| `parts/pk_engine.js` | one-compartment pharmacokinetic model and response/toxicity math |
| `parts/game_state.js` | simulation state, case-mode, and run-summary tracking |
| `parts/chart_stage.js` | concentration/outcome chart rendering |
| `parts/body_visual.js` | body diagram visualization |
| `parts/ui_rendering.js` | control-panel and stats-strip rendering |
| `parts/init.js` | app bootstrap and event wiring |

Edit the relevant `parts/*.js` (or `parts/*.html`, `parts/style.css`) file, then rerun
`bash build_app.sh` to regenerate `chemotherapy_body_simulation.html`.

## Examples

Rebuild after a source edit and re-open in the browser:

```bash
bash build_app.sh
open chemotherapy_body_simulation.html
```

Run the fast pytest suite (repo-wide lint/style checks plus the Python-level web build
test):

```bash
source source_me.sh && python3 -m pytest tests/ -q
```

Run just the web build check, which builds the app and asserts on the generated HTML:

```bash
source source_me.sh && python3 -m pytest tests/web/test_web_build.py -q
```

Run the standalone Node.js PK-engine calibration script directly (loads `parts/constants.js`,
`parts/regimen_engine.js`, `parts/pk_engine.js` into a `vm` context and checks the math):

```bash
node tests/web/test_pk_calibration.js
```

## Inputs and outputs

- Inputs: the `parts/*.js` and `parts/*.html`/`parts/style.css` source files.
- Output: `chemotherapy_body_simulation.html` at the repo root, a single self-contained
  HTML file with inlined CSS and JS. Open it directly in any browser; no server or
  network access is required to run the simulation.

## Known gaps

- [ ] `npm run build` (`build_github_pages.sh`) and `npm run serve` (`run_web_server.sh`)
  are off-template TypeScript-build paths that currently fail (no `src/main.ts`); see
  [INSTALL.md](INSTALL.md#known-gaps). Use `bash build_app.sh` as documented above instead.
- [ ] Playwright browser E2E tests (`run_playwright_tests.sh`, `npm run test:playwright`)
  require a `playwright.config.ts` that is not present yet; see
  [PLAYWRIGHT_USAGE.md](PLAYWRIGHT_USAGE.md) for the intended usage once configured.
- [ ] Confirm whether `chemotherapy_body_simulation.html` is meant to be committed to
  git or is purely a local/CI build artifact (repo history shows it tracked and modified).
