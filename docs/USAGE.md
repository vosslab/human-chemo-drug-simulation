# USAGE.md

## Build the Simulation

Generate the single-file browser artifact:

```bash
bash build_app.sh
```

This writes the runnable page to [output/chemotherapy_body_simulation.html](../output/chemotherapy_body_simulation.html).

## Run Focused Tests

Use the repo bootstrap environment and run the focused web build checks:

```bash
source source_me.sh && python3 -m pytest tests/web/test_web_build.py -q
```

## App Structure

- [parts/CONTRACTS.md](../parts/CONTRACTS.md): Shared data contracts for the simulator.
- [parts/body.html](../parts/body.html): Static app shell, simplified control panel, and dose sandbox.
- [parts/style.css](../parts/style.css): Visual design and responsive layout.
- [parts/pk_engine.js](../parts/pk_engine.js): Stochastic multi-compartment concentration and tumor-response model.
- [parts/chart_stage.js](../parts/chart_stage.js): Concentration timeline rendering.
- [parts/body_visual.js](../parts/body_visual.js): Stylized organ-flow rendering with a large labeled tumor that can shrink over time.
