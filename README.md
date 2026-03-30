# human-chemo-drug-simulation

`human-chemo-drug-simulation` is a browser-based teaching demo that visualizes how chemotherapy
drug concentration changes over time in a simplified human body. The app combines named regimen
presets, manual dose timing, patient vitality tracking, and a stochastic concentration-and-
response model with tumor shrinkage across a longer 30-day window in one self-contained HTML file.

## Documentation

- [docs/USAGE.md](docs/USAGE.md): Build and test commands for the web app.
- [docs/CHANGELOG.md](docs/CHANGELOG.md): History of changes.
- [docs/REPO_STYLE.md](docs/REPO_STYLE.md): Repository structure, naming, and versioning conventions.
- [docs/PYTHON_STYLE.md](docs/PYTHON_STYLE.md): Python formatting, imports, and testing rules.
- [docs/MARKDOWN_STYLE.md](docs/MARKDOWN_STYLE.md): Markdown writing and formatting conventions.

## Quick start

Build the self-contained HTML page:

```bash
bash build_app.sh
```

Open [output/chemotherapy_body_simulation.html](output/chemotherapy_body_simulation.html) in a browser.

## Testing

Run the focused web build check:

```bash
source source_me.sh && python3 -m pytest tests/web/test_web_build.py -q
```
