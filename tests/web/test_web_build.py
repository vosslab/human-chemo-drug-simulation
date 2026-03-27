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
	# title and educational framing
	assert "Chemotherapy Teaching Simulation" in html
	assert "Educational use only" in html
	# regimen presets
	assert "preset-button-grid" in html
	# visualization areas
	assert "chart-root" in html
	assert "body-visual-root" in html
	# stats strip
	assert "metric-total-burden" in html
	assert "metric-peak-exposure" in html
	assert "metric-tumor-volume" in html
	assert "metric-life-status" in html
	# playback controls
	assert "play-button" in html
	assert "time-scrubber" in html
	# custom dosing section
	assert "Explore custom dosing" in html
	assert "manual-drug-select" in html
	# teaching notes
	assert "teaching-notes-list" in html
	# body visualization elements
	assert any(token in html for token in ["Bloodstream", "Kidneys", "Tumor"])
	# health bar
	assert "patient-health-bar-root" in html
	# model disclaimer
	assert "not clinical predictions" in html


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
def test_pk_engine_produces_valid_samples():
	"""
	Run the PK engine in Node and verify concentration and tumor response fields.
	Uses exponential decay model with ABVD regimen.
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
	customDoseEvents: [],
	bsa: 1.7,
	weightKg: 70,
};
const samples = context.chemoPkBuildSamples(config);
// validate one-compartment at t=0 for bleomycin
const bleo = context.DRUG_DATA.bleomycin;
const testConc = context.chemoPkOneCompartment(bleo, 100, 0, 70);
const expectedConc = 100 / (bleo.vdLPerKg * 70);
console.log(JSON.stringify({
	count: samples.length,
	firstTotalBurden: samples[0].totalBurden,
	firstTumorVolume: samples[0].tumorVolume,
	lastTumorVolume: samples[samples.length - 1].tumorVolume,
	firstResponseProbability: samples[0].responseProbability,
	lastVisualRadius: samples[samples.length - 1].visualState.tumorRadius,
	lastShrink: samples[samples.length - 1].visualState.tumorShrinkFraction,
	firstHealth: samples[0].patientHealth,
	concentrationCheck: Math.abs(testConc - expectedConc) < 0.0001,
	noNaN: !samples.some(function(s) { return isNaN(s.totalBurden) || isNaN(s.patientHealth); }),
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
	# sample count check
	assert data["count"] > 5
	# concentration at t=0 should be non-zero (exponential decay model)
	assert data["firstTotalBurden"] > 0.1
	# tumor response fields
	assert 0 < data["firstResponseProbability"] < 1
	assert data["lastVisualRadius"] > 0
	assert 0 <= data["lastShrink"] <= 1
	# tumor volume changes over time
	assert data["firstTumorVolume"] != data["lastTumorVolume"]
	# one-compartment math is exact at t=0
	assert data["concentrationCheck"] is True
	# no NaN values
	assert data["noNaN"] is True
	# health starts at 100
	assert data["firstHealth"] == 100
