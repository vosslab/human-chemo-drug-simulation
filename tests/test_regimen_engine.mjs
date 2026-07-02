// test_regimen_engine.mjs -- Node test for src/regimen_engine.ts
// Run: node --import tsx --test tests/test_regimen_engine.mjs

import test from "node:test";
import assert from "node:assert/strict";

import {
  chemoRegimenGetById,
  chemoRegimenGetDefaultDoseIntervalDays,
  chemoRegimenGetDefaultDoseCount,
  chemoRegimenBuildDoseDays,
  chemoRegimenBuildDoseEvents,
  chemoRegimenBuildDrugList,
} from "../src/regimen_engine.ts";

//============================================
test("chemoRegimenGetById returns the matching regimen", () => {
  const regimen = chemoRegimenGetById("abvd");
  assert.equal(regimen.id, "abvd");
});

//============================================
test("chemoRegimenGetById falls back to the first regimen for unknown id", () => {
  const regimen = chemoRegimenGetById("nope");
  assert.equal(regimen.id, "abvd");
});

//============================================
test("chemoRegimenGetDefaultDoseIntervalDays derives spacing from doseDays", () => {
  assert.equal(chemoRegimenGetDefaultDoseIntervalDays("abvd"), 14);
  assert.equal(chemoRegimenGetDefaultDoseIntervalDays("bep"), 7);
});

//============================================
test("chemoRegimenGetDefaultDoseIntervalDays falls back to cycleDays for single dose day", () => {
  // folfox has a single dose day, so interval falls back to cycleDays (14)
  assert.equal(chemoRegimenGetDefaultDoseIntervalDays("folfox"), 14);
});

//============================================
test("chemoRegimenGetDefaultDoseCount reflects doseDays length", () => {
  assert.equal(chemoRegimenGetDefaultDoseCount("abvd"), 2);
  assert.equal(chemoRegimenGetDefaultDoseCount("folfox"), 1);
  assert.equal(chemoRegimenGetDefaultDoseCount("cmf"), 2);
});

//============================================
test("chemoRegimenBuildDoseDays uses regimen defaults when no overrides given", () => {
  assert.deepEqual(chemoRegimenBuildDoseDays("abvd"), [0, 14]);
  assert.deepEqual(chemoRegimenBuildDoseDays("folfox"), [0]);
});

//============================================
test("chemoRegimenBuildDoseDays honors explicit interval and count overrides", () => {
  assert.deepEqual(chemoRegimenBuildDoseDays("abvd", 5, 3), [0, 5, 10]);
});

//============================================
test("chemoRegimenBuildDoseEvents builds sorted mg-converted events for ABVD", () => {
  const events = chemoRegimenBuildDoseEvents("abvd", 1.7, 1.0);
  assert.equal(events.length, 8);

  const first = events[0];
  assert.equal(first.id, "abvd-d0-doxorubicin");
  assert.equal(first.drugId, "doxorubicin");
  assert.equal(first.label, "Day 1 Doxorubicin (Dose 1)");
  assert.equal(first.startHour, 0);
  assert.equal(first.durationHours, 1);
  assert.equal(first.amountMg, 43);

  const second = events[1];
  assert.equal(second.id, "abvd-d0-bleomycin");
  assert.equal(second.startHour, 0.5);
  assert.equal(second.amountMg, 17);

  const last = events[7];
  assert.equal(last.id, "abvd-d1-dacarbazine");
  assert.equal(last.label, "Day 15 Dacarbazine (Dose 2)");
  assert.equal(last.startHour, 337.5);
  assert.equal(last.amountMg, 638);

  // events are sorted ascending by startHour
  for (let index = 1; index < events.length; index += 1) {
    assert.ok(events[index].startHour >= events[index - 1].startHour);
  }
});

//============================================
test("chemoRegimenBuildDoseEvents omits dose-index suffix for single-dose regimens", () => {
  const events = chemoRegimenBuildDoseEvents("folfox", 1.7, 1.0);
  assert.equal(events.length, 3);

  const fluorouracilEvent = events.find((event) => event.drugId === "fluorouracil");
  assert.ok(fluorouracilEvent !== undefined);
  assert.equal(fluorouracilEvent.label, "Day 1 5-Fluorouracil");
  assert.equal(fluorouracilEvent.amountMg, 680);
  assert.equal(fluorouracilEvent.durationHours, 46);

  const oxaliplatinEvent = events.find((event) => event.drugId === "oxaliplatin");
  assert.ok(oxaliplatinEvent !== undefined);
  assert.equal(oxaliplatinEvent.amountMg, 145);

  const leucovorinEvent = events.find((event) => event.drugId === "leucovorin");
  assert.ok(leucovorinEvent !== undefined);
  assert.equal(leucovorinEvent.amountMg, 340);
});

//============================================
test("chemoRegimenBuildDoseEvents scales amounts by doseMultiplier", () => {
  const events = chemoRegimenBuildDoseEvents("abvd", 1.7, 2.0);
  const amounts = events.map((event) => event.amountMg);
  assert.deepEqual(amounts, [85, 34, 20, 1275, 85, 34, 20, 1275]);
});

//============================================
test("chemoRegimenBuildDrugList returns drug objects in drugKeys order", () => {
  const drugs = chemoRegimenBuildDrugList("abvd");
  const ids = drugs.map((drug) => drug.id);
  assert.deepEqual(ids, ["doxorubicin", "bleomycin", "vinblastine", "dacarbazine"]);
});
