# Chemotherapy Body Simulation Plan

## Objective

Build a single-page browser simulation that teaches how chemotherapy drug concentration changes
over time through a simplified body model, with synchronized timeline and organ-flow visuals.

## Scope

- Single self-contained HTML output built from modular files in `parts/`.
- Named regimen presets, editable simulation sliders, timeline playback, and teaching notes.
- Concentration chart plus stylized body silhouette with bloodstream, liver, kidney, and tumor
  activity channels.

## Non-goals

- Clinical decision support or patient-specific prediction.
- Detailed anatomy, backend services, or multi-page architecture.

## Delivery Notes

- Keep the implementation educational-only and visibly labeled as such.
- Use SVG visuals for the first release to keep the artifact dependency-free and testable.
- Use focused verification on the build artifact and supporting source files.
