import pathlib
import subprocess
import json


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
OUTPUT_HTML = REPO_ROOT / "chemotherapy_body_simulation.html"


#============================================
def test_web_build_creates_single_file_artifact() -> None:
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
def test_web_build_contains_expected_sections() -> None:
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
	assert "outcome-chart-root" in html
	assert "body-visual-root" in html
	# stats strip
	assert "metric-total-burden" in html
	assert "metric-peak-exposure" in html
	assert "metric-tumor-volume" in html
	assert "metric-life-status" in html
	# playback controls
	assert "play-button" in html
	assert "time-scrubber" in html
	# dosing controls
	assert "Adjust Protocol" in html
	assert "dose-count-slider" in html
	assert "dose-interval-slider" in html
	assert "gender-slider" in html
	assert "bmi-slider" in html
	assert "age-slider" in html
	assert "activity-slider" in html
	assert "randomness-mode-select" in html
	assert "case-mode-toggle" in html
	assert "reveal-trait-button" in html
	# teaching notes
	assert "teaching-notes-list" in html
	assert "adverse-effects-green" in html
	assert "adverse-effects-yellow" in html
	assert "adverse-effects-red" in html
	assert "case-summary-root" in html
	assert "run-summary-root" in html
	assert "event-log-root" in html
	assert "THERAPEUTIC WINDOW" in html
	# body visualization elements
	assert any(token in html for token in ["Bloodstream", "Kidneys", "Tumor"])
	# health bar
	assert "patient-health-bar-root" in html
	# model disclaimer
	assert "not clinical predictions" in html


#============================================
def test_web_source_files_are_present() -> None:
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
def test_pk_engine_produces_valid_samples() -> None:
	"""
	Run the PK engine in Node and verify concentration and tumor response fields.
	Uses exponential decay model with ABVD regimen.
	"""
	script = """
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const repoRoot = process.cwd();
const mathProxy = Object.create(Math);
mathProxy.random = function() { return 0.0; };
const context = { console: console, Math: mathProxy };
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
	genderBalance: 0,
	bmi: 24,
	ageYears: 52,
	activityLevel: 0.35,
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
		firstVitality: samples[0].patientHealth,
		lastVitality: samples[samples.length - 1].patientHealth,
		profileWeight: samples[0].patientProfile.weightKg,
		profileBsa: samples[0].patientProfile.bsa,
		profileClearance: samples[0].patientProfile.clearanceMultiplier,
	firstResponseProbability: samples[0].responseProbability,
		lastVisualRadius: samples[samples.length - 1].visualState.tumorRadius,
		lastShrink: samples[samples.length - 1].visualState.tumorShrinkFraction,
		firstEffectCount: samples[0].adverseEffects.length,
		hasSeverityBands: samples[0].adverseEffects.every(function(effect) {
			return ["green", "yellow", "red"].includes(effect.severity);
		}),
		presentEffectsSeen: samples.some(function(s) {
			return s.adverseEffects.some(function(effect) { return effect.present; });
		}),
		presentFlagExists: samples[0].adverseEffects.every(function(effect) {
			return typeof effect.present === "boolean";
		}),
		firstHealth: samples[0].patientHealth,
		concentrationCheck: Math.abs(testConc - expectedConc) < 0.0001,
	noNaN: !samples.some(function(s) { return isNaN(s.totalBurden) || isNaN(s.patientHealth); }),
	abvdTumorLabel: context.REGIMEN_PRESETS.abvd.tumorSite.label,
	bepTumorLabel: context.REGIMEN_PRESETS.bep.tumorSite.label,
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
	assert data["firstEffectCount"] > 0
	assert data["hasSeverityBands"] is True
	assert data["presentEffectsSeen"] is True
	assert data["presentFlagExists"] is True
	# tumor volume changes over time
	assert data["firstTumorVolume"] != data["lastTumorVolume"]
	assert data["firstVitality"] != data["lastVitality"]
	assert data["profileWeight"] > 40
	assert data["profileBsa"] > 1.2
	assert 0.6 <= data["profileClearance"] <= 1.35
	# one-compartment math is exact at t=0
	assert data["concentrationCheck"] is True
	# no NaN values
	assert data["noNaN"] is True
	assert data["abvdTumorLabel"] == "Mediastinal mass"
	assert data["bepTumorLabel"] == "Testicular tumor"
	# health starts near 100 (may dip slightly from first timestep toxicity)
	assert data["firstHealth"] > 95


#============================================
def test_pk_engine_supports_dose_interval_and_tumor_eradication() -> None:
	"""
	Verify the regimen interval override changes event spacing and that tumor volume
	can reach zero under aggressive dosing instead of being clamped above zero.
	"""
	script = """
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const repoRoot = process.cwd();
const mathProxy = Object.create(Math);
mathProxy.random = function() { return 0.0; };
const context = { console: console, Math: mathProxy };
vm.createContext(context);
for (const relPath of [
	"parts/constants.js",
	"parts/regimen_engine.js",
	"parts/pk_engine.js"
]) {
	const source = fs.readFileSync(path.join(repoRoot, relPath), "utf8");
	vm.runInContext(source, context, { filename: relPath });
}
const intervalDays = context.chemoRegimenBuildDoseDays("abvd", 3, 4);
	const config = {
		regimenId: "abvd",
		timeStepHours: 2,
		durationHours: 720,
		bodyScale: 1,
		tumorSensitivity: 1.5,
		playbackSpeed: 1,
		simulationRunId: 99,
		genderBalance: 0,
		bmi: 24,
		ageYears: 52,
		activityLevel: 0.35,
		doseMultiplier: 2,
		doseCount: 4,
		doseIntervalDays: 7,
	};
	const samples = context.chemoPkBuildSamples(config);
	const minimumTumor = context.chemoPkFindMinimumTumorVolume(samples);
	console.log(JSON.stringify({
		intervalDays: intervalDays,
		minimumTumor: minimumTumor,
		lastTumor: samples[samples.length - 1].tumorVolume,
		lastStatus: samples[samples.length - 1].lifeStatus,
		peakExposure: context.chemoPkFindPeakExposure(samples),
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
	assert data["intervalDays"] == [0, 3, 6, 9]
	assert data["peakExposure"] > 0
	assert data["minimumTumor"] == 0
	assert data["lastTumor"] == 0
	assert data["lastStatus"] != "Deceased"


#============================================
def test_regimen_profiles_change_response_and_toxicity_behavior() -> None:
	"""
	Verify preset-level efficacy and toxicity weights change outcomes for the same burden input.
	"""
	script = """
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const repoRoot = process.cwd();
const mathProxy = Object.create(Math);
mathProxy.random = function() { return 0.0; };
const context = { console: console, Math: mathProxy };
vm.createContext(context);
for (const relPath of [
	"parts/constants.js",
	"parts/regimen_engine.js",
	"parts/pk_engine.js"
]) {
	const source = fs.readFileSync(path.join(repoRoot, relPath), "utf8");
	vm.runInContext(source, context, { filename: relPath });
}
const sharedConfig = {
	bodyScale: 1,
	tumorSensitivity: 1,
	playbackSpeed: 1,
	simulationRunId: 5,
	genderBalance: 0,
	bmi: 24,
	ageYears: 52,
	activityLevel: 0.35,
};
const abvdConfig = Object.assign({ regimenId: "abvd" }, sharedConfig);
const cmfConfig = Object.assign({ regimenId: "cmf" }, sharedConfig);
const bepConfig = Object.assign({ regimenId: "bep" }, sharedConfig);
const abvdResponse = context.chemoPkComputeResponseProbability(6, abvdConfig);
const cmfResponse = context.chemoPkComputeResponseProbability(6, cmfConfig);
const stableVisual = { liver: 0.45, kidney: 0.45, bloodstream: 0.45 };
const bepHealth = context.chemoPkUpdatePatientState(100, 20, stableVisual, bepConfig);
const folfoxHealth = context.chemoPkUpdatePatientState(100, 20, stableVisual, Object.assign({ regimenId: "folfox" }, sharedConfig));
console.log(JSON.stringify({
	abvdResponse: abvdResponse,
	cmfResponse: cmfResponse,
	bepHealth: bepHealth,
	folfoxHealth: folfoxHealth,
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
	assert data["abvdResponse"] > data["cmfResponse"]
	assert data["bepHealth"] < data["folfoxHealth"]


#============================================
def test_case_mode_and_run_summary_fields_exist_in_simulation_output() -> None:
	"""
	Verify the PK/game layer exposes case traits, event logging, and end-of-run summary data.
	"""
	script = """
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const repoRoot = process.cwd();
const mathProxy = Object.create(Math);
mathProxy.random = function() { return 0.0; };
const context = { console: console, Math: mathProxy };
vm.createContext(context);
for (const relPath of [
	"parts/constants.js",
	"parts/regimen_engine.js",
	"parts/pk_engine.js",
	"parts/game_state.js"
]) {
	const source = fs.readFileSync(path.join(repoRoot, relPath), "utf8");
	vm.runInContext(source, context, { filename: relPath });
}
context.CHEMO_STATE.caseModeEnabled = true;
context.CHEMO_STATE.randomnessMode = "deterministic";
context.CHEMO_STATE.regimenId = "abvd";
context.chemoStateRebuildSimulation();
const summary = context.CHEMO_STATE.runSummary;
const samples = context.CHEMO_STATE.samples;
console.log(JSON.stringify({
	randomnessMode: context.CHEMO_STATE.randomnessMode,
	hasCaseProfile: !!context.CHEMO_STATE.caseProfile,
	hasGoal: !!(context.CHEMO_STATE.caseProfile && context.CHEMO_STATE.caseProfile.goal),
	hasMysteryTrait: !!(context.CHEMO_STATE.caseProfile && context.CHEMO_STATE.caseProfile.mysteryTraitLabel),
	hasSummary: !!summary,
	summaryGrade: summary.grade,
	summaryScore: summary.totalScore,
	hasWindowStatus: samples.every(function(sample) {
		return ["ineffective", "optimal", "toxic"].includes(sample.therapeuticWindowStatus);
	}),
	hasEventLog: samples.some(function(sample) {
		return sample.eventLog && sample.eventLog.length > 0;
	}),
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
	assert data["randomnessMode"] == "deterministic"
	assert data["hasCaseProfile"] is True
	assert data["hasGoal"] is True
	assert data["hasMysteryTrait"] is True
	assert data["hasSummary"] is True
	assert data["summaryGrade"] in ["A", "B", "C", "D", "F"]
	assert 0 <= data["summaryScore"] <= 100
	assert data["hasWindowStatus"] is True
	assert data["hasEventLog"] is True
