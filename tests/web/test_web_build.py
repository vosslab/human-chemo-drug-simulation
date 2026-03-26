import os
import pathlib
import subprocess
import json


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
OUTPUT_HTML = REPO_ROOT / "output" / "chemotherapy_body_simulation.html"


#============================================
def test_web_build_creates_single_file_artifact():
	"""
	Build the web app and verify the output artifact exists.
	"""
	result = subprocess.run(
		["bash", "build_app.sh"],
		cwd=REPO_ROOT,
		check=False,
		capture_output=True,
		text=True,
	)
	assert result.returncode == 0, result.stderr
	assert OUTPUT_HTML.is_file()


#============================================
def test_web_build_contains_expected_sections():
	"""
	Check that the built page includes core simulation regions.
	"""
	if not OUTPUT_HTML.is_file():
		test_web_build_creates_single_file_artifact()
	html = OUTPUT_HTML.read_text(encoding="utf-8")
	assert "Chemotherapy Body Simulation" in html
	assert "Educational use only" in html
	assert "preset-button-grid" in html
	assert "chart-root" in html
	assert "body-visual-root" in html
	assert any(token in html for token in ["Dose timing", "doseEvents", "manual dose"])
	assert any(token in html for token in ["Patient status", "Vitality", "life status", "Response chance"])
	assert any(token in html for token in ["Bloodstream", "Kidneys", "Tumor"])
	assert any(token in html for token in ["Tumor size", "Response chance", "tumor shrinkage"])
	assert any(token in html for token in ["stochastic response view", "non-seeded", "randomness"])
	assert "patient-health-bar-root" in html
	assert "organ-guide-root" in html


#============================================
def test_web_source_files_are_present():
	"""
	Ensure the modular source files for the app exist.
	"""
	required_files = [
		"parts/head.html",
		"parts/style.css",
		"parts/body.html",
		"parts/constants.js",
		"parts/regimen_engine.js",
		"parts/pk_engine.js",
		"parts/game_state.js",
		"parts/chart_stage.js",
		"parts/body_visual.js",
		"parts/ui_rendering.js",
		"parts/init.js",
	]
	for rel_path in required_files:
		assert (REPO_ROOT / rel_path).is_file(), rel_path


#============================================
def test_stochastic_engine_emits_tumor_response_fields():
	"""
	Run the simulation engine in Node and verify the stochastic tumor fields are emitted.
	"""
	script = """
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const repoRoot = process.cwd();
const context = { console: console, Math: Math };
vm.createContext(context);
for (const relPath of [
	"parts/constants.js",
	"parts/regimen_engine.js",
	"parts/pk_engine.js"
]) {
	const source = fs.readFileSync(path.join(repoRoot, relPath), "utf8");
	vm.runInContext(source, context, { filename: relPath });
}
const config = {
	regimenId: "abvd",
	timeStepHours: 2,
	durationHours: 48,
	bodyScale: 1,
	tumorSensitivity: 1,
	playbackSpeed: 1,
	simulationRunId: 3,
	randomSeed: 12345,
};
const samples = context.chemoPkBuildSamples(config);
console.log(JSON.stringify({
	count: samples.length,
	firstTumorVolume: samples[0].tumorVolume,
	lastTumorVolume: samples[samples.length - 1].tumorVolume,
	firstResponseProbability: samples[0].responseProbability,
	lastVisualRadius: samples[samples.length - 1].visualState.tumorRadius,
	lastShrink: samples[samples.length - 1].visualState.tumorShrinkFraction,
}));
"""
	result = subprocess.run(
		["node", "-e", script],
		cwd=REPO_ROOT,
		check=False,
		capture_output=True,
		text=True,
	)
	assert result.returncode == 0, result.stderr
	data = json.loads(result.stdout)
	assert data["count"] > 5
	assert 0 < data["firstResponseProbability"] < 1
	assert data["lastVisualRadius"] > 0
	assert 0 <= data["lastShrink"] <= 1
	assert data["firstTumorVolume"] != data["lastTumorVolume"]
