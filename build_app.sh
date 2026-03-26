#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_FILE="$REPO_ROOT/output/chemotherapy_body_simulation.html"

cat "$REPO_ROOT/parts/head.html" > "$OUTPUT_FILE"
printf '<style>\n' >> "$OUTPUT_FILE"
cat "$REPO_ROOT/parts/style.css" >> "$OUTPUT_FILE"
printf '\n</style>\n</head>\n' >> "$OUTPUT_FILE"
cat "$REPO_ROOT/parts/body.html" >> "$OUTPUT_FILE"
printf '\n<script>\n' >> "$OUTPUT_FILE"
cat \
	"$REPO_ROOT/parts/constants.js" \
	"$REPO_ROOT/parts/regimen_engine.js" \
	"$REPO_ROOT/parts/pk_engine.js" \
	"$REPO_ROOT/parts/game_state.js" \
	"$REPO_ROOT/parts/chart_stage.js" \
	"$REPO_ROOT/parts/body_visual.js" \
	"$REPO_ROOT/parts/ui_rendering.js" \
	"$REPO_ROOT/parts/init.js" >> "$OUTPUT_FILE"
printf '\n</script>\n' >> "$OUTPUT_FILE"
cat "$REPO_ROOT/parts/tail.html" >> "$OUTPUT_FILE"

printf 'Built %s\n' "$OUTPUT_FILE"
