# News

No tagged release exists yet. `VERSION` (`26.02`) and `package.json`
(`"version": "0.0.0"`) disagree, so this file frames current progress as
unreleased rather than claiming a version number. See
[docs/RELEASE_HISTORY.md](RELEASE_HISTORY.md) for the full log.

## Unreleased - 2026-07-02

### Highlights

- A browser-based chemotherapy PK teaching simulation is taking shape: pick a
  regimen preset (ABVD, FOLFOX, BEP, CMF), watch a concentration timeline and
  a body-flow visualization, and see tumor and vitality respond over time.
- Ten drugs now carry clinical PK parameters, with mathematically correct
  one- and two-compartment exponential decay math replacing the earlier
  stochastic model.
- Patient-factor sliders (gender, BMI, age, lifestyle) and a color-coded
  adverse-effects panel make dosing consequences visible and personalized.
- A gameplay layer adds Case Mode, therapeutic-window banding, mystery-trait
  reveal, and end-of-run grading for a more active teaching experience.

### Upgrade notes

- Custom-dosing users: manual single-dose controls were removed. Dosing is
  now driven by the continuous dose-count model (`Dose interval` = one full
  regimen administration every N days for the chosen number of doses).
- Build-script users: `dist_clean.sh` moved from the repo root into
  `devel/dist_clean.sh`; run `npm run clean` rather than calling the old root
  script directly.
