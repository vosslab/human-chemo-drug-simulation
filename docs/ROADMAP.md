# ROADMAP.md

Planned work and priorities for the chemotherapy teaching simulation. Items are
grounded in the current codebase state and the change history. This is a
teaching demo, so clinical scope stays intentionally out.

## Near term

- Migrate `parts/*.js` to `src/*.ts` so the repo matches the TypeScript template.
  This unblocks `check_codebase.sh` (currently `TS18003`) and the
  `build_github_pages.sh` ESM build path. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
- Reconcile the two build paths: `build_app.sh` (single-file, working today) and
  `build_github_pages.sh` (ESM/`src`-based, not yet wired). Pick one canonical
  build once the migration lands.
- Keep the single self-contained HTML output as the primary deliverable through
  the migration so the app stays dependency-free and easy to open.

## Later

- Expand Playwright coverage for the gameplay layer (Case Mode, grading,
  event-log playback) added in the March 2026 work.
- Add GitHub Pages deploy once the ESM build is the canonical path.

## Out of scope (non-goals)

- Clinical decision support or patient-specific prediction.
- Detailed anatomy, backend services, or multi-page architecture.
- Anything beyond an educational, clearly-labeled teaching model.
