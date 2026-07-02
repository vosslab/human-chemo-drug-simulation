// test_pk_engine.mjs -- Node test for src/pk_engine.ts
// Run: node --import tsx --test tests/test_pk_engine.mjs
//
// Reproduces the CURRENT numeric behavior of the pk_engine module.
// The legacy node -e / vm test harnesses stub Math.random to 0 for determinism.
// chemoPkRandom reads the global Math.random, so this test replicates that
// approach by pinning Math.random to 0 for the whole module. Golden values were
// captured from the reference implementation under the same Math.random=0 stub.

import test from "node:test";
import assert from "node:assert/strict";

import { DRUG_DATA, ORGAN_EXTRACTION } from "../src/constants.ts";
import { chemoRegimenBuildDoseDays } from "../src/regimen_engine.ts";
import {
  chemoPkOneCompartment,
  chemoPkTwoCompartment,
  chemoPkConcentrationAtTime,
  chemoPkMultiDoseConcentration,
  chemoPkOrganConcentrations,
  chemoPkComputeResponseProbability,
  chemoPkUpdatePatientState,
  chemoPkBuildSamples,
  chemoPkBuildRunSummary,
  chemoPkFindPeakExposure,
  chemoPkFindMinimumTumorVolume,
} from "../src/pk_engine.ts";

// pin the global PRNG to 0 so chemoPkRandom is deterministic (matches legacy stub)
Math.random = function () {
  return 0.0;
};

const EPS = 1e-9;

//============================================
function close(actual, expected) {
  return Math.abs(actual - expected) < EPS;
}

//============================================
// One-compartment PK primitive (Calibration Tests 1-2)
//============================================
test("chemoPkOneCompartment at t=0 equals dose/Vd and decays monotonically", () => {
  const bleo = DRUG_DATA.bleomycin;
  const c0 = chemoPkOneCompartment(bleo, 100, 0, 70);
  const expected = 100 / (bleo.vdLPerKg * 70);
  assert.ok(close(c0, expected), `c0 ${c0} != ${expected}`);
  assert.ok(close(c0, 4.9261083743842375));

  const c60 = chemoPkOneCompartment(bleo, 100, 60, 70);
  const c120 = chemoPkOneCompartment(bleo, 100, 120, 70);
  assert.ok(c0 > c60 && c60 > c120, "concentration must decrease between doses");
  assert.ok(close(c60, 3.483540981710697));
  assert.ok(close(c120, 2.4634167275653587));
});

//============================================
// Two-compartment biphasic decay (Calibration Test 3)
//============================================
test("chemoPkTwoCompartment is biphasic and monotonically decreasing", () => {
  const dox = DRUG_DATA.doxorubicin;
  const d0 = chemoPkTwoCompartment(dox, 100, 0, 70);
  const d5 = chemoPkTwoCompartment(dox, 100, 5, 70);
  const d60 = chemoPkTwoCompartment(dox, 100, 60, 70);
  const d1800 = chemoPkTwoCompartment(dox, 100, 1800, 70);
  assert.ok(d0 > d5 && d5 > d60 && d60 > d1800, "biphasic decay must be monotonic");
  assert.ok(close(d0, 4.201680672268907));
  assert.ok(close(d5, 2.7288847582953464));
  assert.ok(close(d60, 1.2324396187506306));
  assert.ok(close(d1800, 0.6303448685240769));
});

//============================================
// Superposition of multiple doses (Calibration Test 4)
//============================================
test("chemoPkMultiDoseConcentration superposes doses", () => {
  const bleo = DRUG_DATA.bleomycin;
  const singleAt130 = chemoPkMultiDoseConcentration(
    bleo,
    [{ timeMins: 0, amountMg: 100 }],
    130,
    70,
  );
  const multiAt130 = chemoPkMultiDoseConcentration(
    bleo,
    [
      { timeMins: 0, amountMg: 100 },
      { timeMins: 120, amountMg: 100 },
    ],
    130,
    70,
  );
  assert.ok(multiAt130 > singleAt130, "two doses exceed one dose at t=130");
  assert.ok(close(singleAt130, 2.3251842888982512));
  assert.ok(close(multiAt130, 6.974868473209465));
});

//============================================
// Organ extraction routing (Calibration Test 5)
//============================================
test("chemoPkOrganConcentrations routes renal vs biliary drugs correctly", () => {
  const bleo = DRUG_DATA.bleomycin;
  const dox = DRUG_DATA.doxorubicin;
  // bleomycin: primaryOrgan kidney -> renal route
  const renalOrgans = chemoPkOrganConcentrations(bleo, 10.0);
  assert.equal(renalOrgans.plasma, 10);
  assert.equal(renalOrgans.liver, 10 * ORGAN_EXTRACTION.liver.renal);
  assert.equal(renalOrgans.kidney, 10 * ORGAN_EXTRACTION.kidney.renal);
  assert.equal(renalOrgans.tissue, 10 * ORGAN_EXTRACTION.tissue.renal);
  assert.equal(renalOrgans.liver, 2);
  assert.equal(renalOrgans.kidney, 7);
  assert.equal(renalOrgans.tissue, 3);
  assert.ok(renalOrgans.kidney > renalOrgans.liver, "kidney exceeds liver for renal drug");

  // doxorubicin: excretionOrgan bile -> biliary route
  const doxOrgans = chemoPkOrganConcentrations(dox, 10.0);
  assert.equal(doxOrgans.liver, 5);
  assert.equal(doxOrgans.kidney, 1);
  assert.ok(doxOrgans.liver > doxOrgans.kidney, "liver exceeds kidney for biliary drug");
});

//============================================
// No NaN or negative concentrations for any drug (Calibration Test 6)
//============================================
test("chemoPkConcentrationAtTime is valid for all 10 drugs", () => {
  for (const drugKey of Object.keys(DRUG_DATA)) {
    const drug = DRUG_DATA[drugKey];
    const conc = chemoPkConcentrationAtTime(drug, 100, 0, 60, 70);
    assert.ok(!Number.isNaN(conc) && conc >= 0, `invalid concentration for ${drugKey}: ${conc}`);
  }
});

//============================================
// Full ABVD simulation, 720 hours (Calibration Test 7)
//============================================
test("chemoPkBuildSamples produces 361 ABVD samples with golden metrics", () => {
  const config = {
    regimenId: "abvd",
    timeStepHours: 2,
    durationHours: 720,
    bodyScale: 1,
    tumorSensitivity: 1,
    playbackSpeed: 1,
    simulationRunId: 1,
    bsa: 1.7,
    weightKg: 70,
  };
  const samples = chemoPkBuildSamples(config);
  assert.equal(samples.length, 361);
  assert.ok(samples[0].totalBurden > 0);
  assert.ok(close(samples[0].totalBurden, 1.9612325954615955));
  assert.ok(close(chemoPkFindPeakExposure(samples), 26.984588407460773));
  assert.equal(samples[samples.length - 1].tumorVolume, 0);
  assert.equal(samples[samples.length - 1].patientHealth, 100);
  assert.equal(samples[samples.length - 1].lifeStatus, "Stable");
  assert.ok(!samples.some((s) => Number.isNaN(s.totalBurden) || Number.isNaN(s.patientHealth)));
});

//============================================
// All four regimens produce valid simulations (Calibration Test 8)
//============================================
test("chemoPkBuildSamples runs all four regimens with golden peaks", () => {
  const golden = {
    abvd: { count: 361, peak: 26.984588407460773 },
    folfox: { count: 361, peak: 42.73992785652593 },
    bep: { count: 361, peak: 1.1575382311524933 },
    cmf: { count: 361, peak: 26.72568628455629 },
  };
  for (const regimenId of Object.keys(golden)) {
    const config = {
      regimenId: regimenId,
      timeStepHours: 2,
      durationHours: 720,
      bodyScale: 1,
      tumorSensitivity: 1,
      playbackSpeed: 1,
      simulationRunId: 20,
      bsa: 1.7,
      weightKg: 70,
    };
    const samples = chemoPkBuildSamples(config);
    assert.equal(samples.length, golden[regimenId].count, regimenId);
    assert.ok(close(chemoPkFindPeakExposure(samples), golden[regimenId].peak), regimenId);
    assert.ok(!samples.some((s) => Number.isNaN(s.totalBurden)), regimenId);
  }
});

//============================================
// High-dose toxicity via doseMultiplier drives serious health decline
//============================================
test("chemoPkBuildSamples: high dose multiplier raises peak and drops health", () => {
  const config = {
    regimenId: "abvd",
    timeStepHours: 2,
    durationHours: 720,
    bodyScale: 1,
    tumorSensitivity: 1,
    playbackSpeed: 1,
    simulationRunId: 99,
    bsa: 1.7,
    weightKg: 70,
    doseMultiplier: 3,
  };
  const samples = chemoPkBuildSamples(config);
  const peak = chemoPkFindPeakExposure(samples);
  let minHealth = 100;
  for (const s of samples) {
    if (s.patientHealth < minHealth) {
      minHealth = s.patientHealth;
    }
  }
  assert.ok(peak > 40, `peak ${peak} should exceed 40`);
  assert.ok(minHealth < 50, `min health ${minHealth} should drop below 50`);
});

//============================================
// Build-test block 1: default profile sliders (durationHours=48)
//============================================
test("chemoPkBuildSamples: patient-factor config golden sample metrics", () => {
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
  const samples = chemoPkBuildSamples(config);
  assert.equal(samples.length, 25);
  const first = samples[0];
  const last = samples[samples.length - 1];
  assert.ok(close(first.totalBurden, 1.9612325954615955));
  assert.ok(close(first.tumorVolume, 1.0131592909777305));
  assert.ok(close(last.tumorVolume, 0.27883458497295205));
  assert.ok(close(first.patientHealth, 99.5006640032661));
  assert.ok(close(last.patientHealth, 80.79045831606308));
  assert.ok(close(first.patientProfile.weightKg, 62.985600000000005));
  assert.ok(close(first.patientProfile.bsa, 1.6835533849569488));
  assert.ok(close(first.patientProfile.clearanceMultiplier, 0.994));
  assert.ok(close(first.responseProbability, 0.46459551044118097));
  assert.ok(close(last.visualState.tumorRadius, 25.287744268323028));
  assert.ok(close(last.visualState.tumorShrinkFraction, 0.7211654150270479));
  assert.equal(first.adverseEffects.length, 9);
  // profile sanity bounds from the legacy build test
  assert.ok(first.patientProfile.weightKg > 40);
  assert.ok(first.patientProfile.bsa > 1.2);
  assert.ok(first.patientProfile.clearanceMultiplier >= 0.6);
  assert.ok(first.patientProfile.clearanceMultiplier <= 1.35);
  assert.ok(first.patientHealth > 95);
  // tumor volume and vitality change over the run
  assert.notEqual(first.tumorVolume, last.tumorVolume);
  assert.notEqual(first.patientHealth, last.patientHealth);
  // severity bands and present flags
  assert.ok(first.adverseEffects.every((e) => ["green", "yellow", "red"].includes(e.severity)));
  assert.ok(first.adverseEffects.every((e) => typeof e.present === "boolean"));
  assert.ok(samples.some((s) => s.adverseEffects.some((e) => e.present)));
  // response probability within open interval
  assert.ok(first.responseProbability > 0 && first.responseProbability < 1);
  assert.ok(last.visualState.tumorRadius > 0);
  assert.ok(last.visualState.tumorShrinkFraction >= 0 && last.visualState.tumorShrinkFraction <= 1);
});

//============================================
// Build-test block 2: dose interval override and tumor eradication
//============================================
test("chemoPkBuildSamples: aggressive dosing eradicates tumor without death", () => {
  assert.deepEqual(chemoRegimenBuildDoseDays("abvd", 3, 4), [0, 3, 6, 9]);
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
  const samples = chemoPkBuildSamples(config);
  const minimumTumor = chemoPkFindMinimumTumorVolume(samples);
  const last = samples[samples.length - 1];
  assert.equal(minimumTumor, 0);
  assert.equal(last.tumorVolume, 0);
  assert.notEqual(last.lifeStatus, "Deceased");
  assert.ok(chemoPkFindPeakExposure(samples) > 0);
  assert.ok(close(chemoPkFindPeakExposure(samples), 54.042534231144046));
});

//============================================
// Build-test block 3: regimen profiles change response and toxicity
//============================================
test("regimen profiles change response probability and toxicity", () => {
  const shared = {
    bodyScale: 1,
    tumorSensitivity: 1,
    playbackSpeed: 1,
    simulationRunId: 5,
    genderBalance: 0,
    bmi: 24,
    ageYears: 52,
    activityLevel: 0.35,
  };
  const abvdResponse = chemoPkComputeResponseProbability(6, { regimenId: "abvd", ...shared });
  const cmfResponse = chemoPkComputeResponseProbability(6, { regimenId: "cmf", ...shared });
  assert.ok(abvdResponse > cmfResponse, "ABVD efficacy weight exceeds CMF");
  assert.ok(close(abvdResponse, 0.8203230654854936));
  assert.ok(close(cmfResponse, 0.7586051844861704));

  const stableVisual = { liver: 0.45, kidney: 0.45, bloodstream: 0.45 };
  const bepHealth = chemoPkUpdatePatientState(100, 20, stableVisual, {
    regimenId: "bep",
    ...shared,
  });
  const folfoxHealth = chemoPkUpdatePatientState(100, 20, stableVisual, {
    regimenId: "folfox",
    ...shared,
  });
  assert.ok(bepHealth < folfoxHealth, "BEP toxicity exceeds FOLFOX at equal burden");
  assert.ok(close(bepHealth, 98.20776610169492));
  assert.ok(close(folfoxHealth, 98.56514074074076));
});

//============================================
// Run summary and window/event fields exist (deterministic mode)
//============================================
test("chemoPkBuildRunSummary and sample metadata expose expected fields", () => {
  const config = {
    regimenId: "abvd",
    timeStepHours: 2,
    durationHours: 720,
    bodyScale: 1,
    tumorSensitivity: 1,
    playbackSpeed: 1,
    simulationRunId: 7,
    randomnessMode: "deterministic",
    bsa: 1.7,
    weightKg: 70,
  };
  const samples = chemoPkBuildSamples(config);
  const summary = chemoPkBuildRunSummary(samples, config);
  assert.ok(["A", "B", "C", "D", "F"].includes(summary.grade));
  assert.ok(summary.totalScore >= 0 && summary.totalScore <= 100);
  assert.ok(
    samples.every((s) => ["ineffective", "optimal", "toxic"].includes(s.therapeuticWindowStatus)),
  );
  assert.ok(samples.some((s) => s.eventLog && s.eventLog.length > 0));
});
