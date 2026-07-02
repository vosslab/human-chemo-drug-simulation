// eslint.config.local.js - consumer-owned ESLint overrides.
//
// Add repo-specific ESLint config objects here: extra browser-context globs,
// per-tool globals, or local rule tweaks. This file ships once via the noexist
// bucket and is never overwritten by propagation, so your edits survive. The
// canonical eslint.config.js imports and spreads this array AFTER its own config,
// so entries here refine or override the canonical rules.
//
// Example: give two named node tools browser globals for page.evaluate() use,
// without loosening no-undef across all tools.
//
//   import globals from "globals";
//   export default [
//     {
//       files: ["tools/scene_to_png.mjs", "tools/svg_picker/**"],
//       languageOptions: { globals: { ...globals.browser } },
//     },
//   ];

import globals from "globals";

export default [
  {
    // parts/*.js are plain browser <script> files, not ES modules. They are
    // concatenated in dependency order at build time (see build_github_pages.sh
    // and the vm-context loader in tests/web/test_pk_calibration.js), so every
    // top-level const/function lives in one shared global scope. ESLint sees each
    // file in isolation and cannot resolve those ~100 cross-file symbols
    // (CHEMO_STATE, chemoChartRender, chemoVisualRenderBody, ...), so both
    // no-undef and no-unused-vars produce false positives here: an "undefined"
    // symbol is defined in a sibling part, and an "unused" function is called
    // from another part. Give the tree browser globals and turn off the two
    // scope-aware rules for parts/ only. Syntax and hygiene rules (no-var,
    // prefer-const, eqeqeq, no-throw-literal) stay active.
    files: ["parts/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.browser },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // tests/web/*.js are CommonJS Node scripts (require/module/__dirname) that
    // load parts/ sources through vm for calibration checks. Give them node
    // globals, parse as CommonJS, and allow require() imports.
    files: ["tests/web/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];
