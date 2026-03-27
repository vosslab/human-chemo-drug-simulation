// test_pk_calibration.js -- Node.js validation for merged PK engine
// Run: node tests/web/test_pk_calibration.js

var fs = require("fs");
var vm = require("vm");
var path = require("path");

var repoRoot = path.resolve(__dirname, "../..");
var context = { console: console, Math: Math };
vm.createContext(context);

// load source files in dependency order
var sourceFiles = [
	"parts/constants.js",
	"parts/regimen_engine.js",
	"parts/pk_engine.js",
];
for (var i = 0; i < sourceFiles.length; i++) {
	var source = fs.readFileSync(path.join(repoRoot, sourceFiles[i]), "utf8");
	vm.runInContext(source, context, { filename: sourceFiles[i] });
}

var passed = 0;
var failed = 0;

//============================================
function check(name, condition) {
	if (condition) {
		passed++;
		console.log("  PASS: " + name);
	} else {
		failed++;
		console.log("  FAIL: " + name);
	}
}

//============================================
// Test 1: One-compartment at t=0 equals dose/Vd
console.log("\n--- Test 1: One-compartment at t=0 ---");
var bleo = context.DRUG_DATA.bleomycin;
var c0 = context.chemoPkOneCompartment(bleo, 100, 0, 70);
var expected = 100 / (bleo.vdLPerKg * 70);
check("concentration equals dose/Vd", Math.abs(c0 - expected) < 0.0001);

//============================================
// Test 2: Monotonic decrease between doses
console.log("\n--- Test 2: Monotonic decrease ---");
var c60 = context.chemoPkOneCompartment(bleo, 100, 60, 70);
var c120 = context.chemoPkOneCompartment(bleo, 100, 120, 70);
check("c0 > c60 > c120", c0 > c60 && c60 > c120);

//============================================
// Test 3: Two-compartment biphasic (fast then slow)
console.log("\n--- Test 3: Two-compartment biphasic ---");
var dox = context.DRUG_DATA.doxorubicin;
var d0 = context.chemoPkTwoCompartment(dox, 100, 0, 70);
var d5 = context.chemoPkTwoCompartment(dox, 100, 5, 70);
var d60 = context.chemoPkTwoCompartment(dox, 100, 60, 70);
var d1800 = context.chemoPkTwoCompartment(dox, 100, 1800, 70);
check("monotonic: d0 > d5 > d60 > d1800", d0 > d5 && d5 > d60 && d60 > d1800);
var fastDrop = (d0 - d5) / d0;
var slowDrop = (d60 - d1800) / d60;
console.log("    fast drop (0-5min): " + (fastDrop * 100).toFixed(1) + "%");
console.log("    slow drop (60-1800min): " + (slowDrop * 100).toFixed(1) + "%");

//============================================
// Test 4: Superposition increases concentration
console.log("\n--- Test 4: Superposition ---");
var singleDose = [{ timeMins: 0, amountMg: 100 }];
var twoDoses = [{ timeMins: 0, amountMg: 100 }, { timeMins: 120, amountMg: 100 }];
var singleAt130 = context.chemoPkMultiDoseConcentration(bleo, singleDose, 130, 70);
var multiAt130 = context.chemoPkMultiDoseConcentration(bleo, twoDoses, 130, 70);
check("two doses > one dose at t=130", multiAt130 > singleAt130);

//============================================
// Test 5: Organ concentrations
console.log("\n--- Test 5: Organ concentrations ---");
var renalOrgans = context.chemoPkOrganConcentrations(bleo, 10.0);
check("kidney > liver for renal drug", renalOrgans.kidney > renalOrgans.liver);
check("all non-negative", renalOrgans.plasma >= 0 && renalOrgans.liver >= 0
	&& renalOrgans.kidney >= 0 && renalOrgans.tissue >= 0);
check("no organ > 2x plasma", renalOrgans.liver <= 2 * renalOrgans.plasma
	&& renalOrgans.kidney <= 2 * renalOrgans.plasma);
// hepatic drug should show liver > kidney
var doxOrgans = context.chemoPkOrganConcentrations(dox, 10.0);
check("liver > kidney for biliary drug", doxOrgans.liver > doxOrgans.kidney);

//============================================
// Test 6: No NaN or negative for all 10 drugs
console.log("\n--- Test 6: No NaN/negative for all drugs ---");
var allDrugs = Object.keys(context.DRUG_DATA);
var nanOk = true;
for (var j = 0; j < allDrugs.length; j++) {
	var drug = context.DRUG_DATA[allDrugs[j]];
	var conc = context.chemoPkConcentrationAtTime(drug, 100, 0, 60, 70);
	if (isNaN(conc) || conc < 0) {
		nanOk = false;
		console.log("    NaN/negative for " + allDrugs[j] + ": " + conc);
	}
}
check("all 10 drugs produce valid concentrations", nanOk);

//============================================
// Test 7: ABVD full simulation
console.log("\n--- Test 7: ABVD full simulation ---");
var config = {
	regimenId: "abvd",
	timeStepHours: 2,
	durationHours: 720,
	bodyScale: 1,
	tumorSensitivity: 1,
	playbackSpeed: 1,
	simulationRunId: 1,
	customDoseEvents: [],
	bsa: 1.7,
	weightKg: 70,
};
var samples = context.chemoPkBuildSamples(config);
var s0 = samples[0];
var sLast = samples[samples.length - 1];
console.log("    samples: " + samples.length);
console.log("    t=0 burden: " + s0.totalBurden.toFixed(2) + " mg/L");
console.log("    peak: " + context.chemoPkFindPeakExposure(samples).toFixed(2) + " mg/L");
console.log("    last tumor: " + (sLast.tumorVolume * 100).toFixed(1) + "%");
console.log("    last health: " + sLast.patientHealth.toFixed(1) + " (" + sLast.lifeStatus + ")");
check("361 samples", samples.length === 361);
check("t=0 burden > 0", s0.totalBurden > 0);
check("peak burden > 5 mg/L", context.chemoPkFindPeakExposure(samples) > 5);
check("health stays above critical", sLast.patientHealth > 20);
check("no NaN in samples", !samples.some(function(s) { return isNaN(s.totalBurden) || isNaN(s.patientHealth); }));
// tumor should show some response (not at max 125%)
check("tumor shows response (< 120%)", sLast.tumorVolume < 1.20);

//============================================
// Test 8: All 4 regimens produce valid simulations
console.log("\n--- Test 8: All regimens ---");
var regimens = ["abvd", "folfox", "bep", "cmf"];
for (var r = 0; r < regimens.length; r++) {
	config.regimenId = regimens[r];
	config.simulationRunId = r + 10;
	var rSamples = context.chemoPkBuildSamples(config);
	var rPeak = context.chemoPkFindPeakExposure(rSamples);
	var rLast = rSamples[rSamples.length - 1];
	console.log("    " + regimens[r] + ": " + rSamples.length + " samples, peak=" + rPeak.toFixed(2)
		+ ", tumor=" + (rLast.tumorVolume * 100).toFixed(1) + "%, health=" + rLast.patientHealth.toFixed(1));
	check(regimens[r] + " produces samples", rSamples.length > 100);
	check(regimens[r] + " peak > 0", rPeak > 0);
	check(regimens[r] + " no NaN", !rSamples.some(function(s) { return isNaN(s.totalBurden); }));
}

//============================================
// Test 9: High dose shows toxicity
console.log("\n--- Test 9: High dose toxicity ---");
config.regimenId = "abvd";
config.simulationRunId = 99;
// add 3x extra doses at multiple timepoints to stress the system
config.customDoseEvents = [
	{ id: "hi-1", drugId: "doxorubicin", label: "Extra DOX 48h", startHour: 48, durationHours: 1, amountMg: 300 },
	{ id: "hi-2", drugId: "dacarbazine", label: "Extra DTIC 48h", startHour: 48, durationHours: 1, amountMg: 1900 },
	{ id: "hi-3", drugId: "doxorubicin", label: "Extra DOX 96h", startHour: 96, durationHours: 1, amountMg: 300 },
	{ id: "hi-4", drugId: "dacarbazine", label: "Extra DTIC 96h", startHour: 96, durationHours: 1, amountMg: 1900 },
];
var hiSamples = context.chemoPkBuildSamples(config);
var hiPeak = context.chemoPkFindPeakExposure(hiSamples);
var hiLast = hiSamples[hiSamples.length - 1];
// find minimum health
var minHealth = 100;
for (var h = 0; h < hiSamples.length; h++) {
	if (hiSamples[h].patientHealth < minHealth) {
		minHealth = hiSamples[h].patientHealth;
	}
}
console.log("    peak: " + hiPeak.toFixed(2) + " mg/L");
console.log("    min health: " + minHealth.toFixed(1));
console.log("    last health: " + hiLast.patientHealth.toFixed(1) + " (" + hiLast.lifeStatus + ")");
check("high dose peak > 40 mg/L", hiPeak > 40);
check("high dose causes serious health decline (< 50)", minHealth < 50);
check("high dose does not instant-kill", hiSamples.length > 10);
// reset custom events
config.customDoseEvents = [];

//============================================
// Summary
console.log("\n=== RESULTS: " + passed + " passed, " + failed + " failed ===");
process.exit(failed > 0 ? 1 : 0);
