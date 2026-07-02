# Related projects

## Confirmed related projects

### starter-repo-template
- Relationship: Upstream source (bootstrap template)
- Link: https://github.com/vosslab/starter-repo-template
- Evidence: `docs/USAGE.md` documents the reset script's folder-name guard against a
  checkout literally named `starter-repo-template`, and `docs/CLAUDE_HOOK_USAGE_GUIDE.md`
  states this repo's copy is "mirrored" from that repo and should not be edited locally.
  The style docs (`docs/REPO_STYLE.md`, `docs/PYTHON_STYLE.md`, `docs/MARKDOWN_STYLE.md`,
  `docs/E2E_TESTS.md`) and several `devel/` scripts were propagated from this template.
- Notes: Source of truth for repo-wide conventions; centrally maintained docs listed in
  `docs/REPO_STYLE.md` should be updated upstream, not edited in this repo.

### claude-code-permissions-hook
- Relationship: Optional integration target (tooling dependency)
- Link: https://github.com/vosslab/claude-code-permissions-hook
- Evidence: `docs/CLAUDE_HOOK_USAGE_GUIDE.md` states it is generated from and mirrors the
  `claude-code-permissions-hook` repo, describing the TOML-based allow/deny/passthrough
  rules that gate Claude Code tool calls while working in this repo.
- Notes: Governs which Bash, git, and file-tool invocations are auto-allowed for AI agents
  working in this codebase.

## Possible related projects

### virtual-lab-protocol-simulation
- Relationship: Same-author sibling repo, same problem domain
- Link: https://github.com/vosslab/virtual-lab-protocol-simulation
- Evidence: Same GitHub author (vosslab) building a browser-based interactive teaching
  simulation (cell culture technique training) with a TypeScript/JavaScript frontend,
  matching this repo's pattern of a self-contained single-file HTML teaching demo.
- Confidence: likely

### virus-outbreak-game
- Relationship: Same-author sibling repo, same problem domain
- Link: https://github.com/vosslab/virus-outbreak-game
- Evidence: Same GitHub author (vosslab), a browser-based epidemiological classroom
  simulation (cruise-ship outbreak scenario) built with TypeScript/JavaScript, sharing
  this repo's "single scenario, parameter sliders, classroom teaching tool" shape.
- Confidence: likely

### biology-problems
- Relationship: Same-author sibling repo, same domain (STEM education tooling)
- Link: https://github.com/vosslab/biology-problems
- Evidence: Same GitHub author (vosslab); Python generators for biochemistry, genetics,
  and molecular biology homework/quiz content, part of the same OER teaching-tool
  portfolio as this pharmacokinetics simulator.
- Confidence: possible

### pksim (dpastoor)
- Relationship: Same problem domain, independent implementation
- Link: https://github.com/dpastoor/pksim
- Evidence: A JavaScript library for pharmacokinetic simulations (concentration-time
  modeling), the same core domain as this repo's PK engine, with no code or author
  overlap found.
- Confidence: possible

### PK-Visualization (peytoncchen)
- Relationship: Same problem domain, independent implementation
- Link: https://github.com/peytoncchen/PK-Visualization
- Evidence: A browser-based (HTML/CSS/JS) pharmacokinetic data modeling and
  visualization tool that solves compartment-model differential equations and plots
  concentration-time curves, matching this repo's domain and single-page-app shape,
  with no code or author overlap found.
- Confidence: possible

### Maxsim2
- Relationship: Prior art, same problem domain
- Link: https://www.sciencedirect.com/science/article/pii/S0169260713003969
- Evidence: A published computer-assisted teaching tool for pharmacokinetics and
  pharmacodynamics that interactively updates concentration-time and response-time
  curves as parameters change, the same pedagogical goal as this repo, described in
  peer-reviewed literature rather than a public code repository.
- Confidence: possible

## Evidence notes

Confirmed entries come from direct in-repo references: `docs/USAGE.md` and
`docs/CLAUDE_HOOK_USAGE_GUIDE.md` both name their source repos explicitly
(`starter-repo-template`, `claude-code-permissions-hook`), and both are verified
public GitHub repositories under the same `vosslab` account as this repo's origin
remote (`git@github.com:vosslab/human-chemo-drug-simulation.git`).

Possible entries come from two bounded web-discovery rounds: a seed round listing
the `vosslab` GitHub profile's other repositories (surfacing same-author teaching
simulations and OER tooling), and a widening round searching for open-source and
academic pharmacokinetics teaching simulators (surfacing `pksim`,
`PK-Visualization`, and the published Maxsim2 tool). None of these show a direct
code or dependency link to this repo, so they are recorded at "possible" or
"likely" confidence rather than "confirmed".
