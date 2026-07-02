# human-chemo-drug-simulation

A browser-based teaching demo that visualizes chemotherapy drug concentration and tumor response
in a simplified human body over a 30-day window, for students and instructors exploring
pharmacokinetics through named regimen presets and manual dosing.

<!-- screenshots:begin (managed by screenshot-docs) -->
![Main simulation view showing regimen presets, concentration and tumor timelines, body flow view, and adverse effects panels](docs/screenshots/main_view.png)
<!-- screenshots:end -->

## Documentation

- [docs/INSTALL.md](docs/INSTALL.md): Setup steps and dependencies.
- [docs/USAGE.md](docs/USAGE.md): Build, serve, and test commands for the web app.
- [docs/CODE_ARCHITECTURE.md](docs/CODE_ARCHITECTURE.md): High-level system design and data flow.
- [docs/FILE_STRUCTURE.md](docs/FILE_STRUCTURE.md): Directory map of the repo.
- [docs/CHANGELOG.md](docs/CHANGELOG.md): History of changes.
- [docs/REPO_STYLE.md](docs/REPO_STYLE.md): Repository structure, naming, and versioning conventions.
- [docs/TYPESCRIPT_STYLE.md](docs/TYPESCRIPT_STYLE.md): TypeScript formatting and project conventions.
- [docs/MARKDOWN_STYLE.md](docs/MARKDOWN_STYLE.md): Markdown writing and formatting conventions.

## Quick start

Build the self-contained HTML page:

```bash
bash build_app.sh
```

Open [chemotherapy_body_simulation.html](chemotherapy_body_simulation.html) in a browser.

To develop against the GitHub Pages build with a local dev server instead:

```bash
bash run_web_server.sh
```

## Testing

Run the pytest suite:

```bash
pytest tests/
```

Run the Playwright browser test suite:

```bash
bash run_playwright_tests.sh
```
