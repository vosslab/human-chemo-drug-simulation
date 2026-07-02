// ============================================
// regimen_engine.ts -- Regimen lookup and dose event generation
// ============================================
// Regimen source doses are mg/m2 in REGIMEN_PRESETS
// Converted to mg using current BSA at dose-event build time
// ============================================

import type { RegimenPreset, DrugDefinition, DoseEvent } from "./types";
import { REGIMEN_PRESETS, REGIMEN_KEYS, DRUG_DATA, SIM_DEFAULTS } from "./constants";

// ============================================
// Look up a regimen by ID from REGIMEN_PRESETS
export function chemoRegimenGetById(regimenId: string): RegimenPreset {
  const regimen = REGIMEN_PRESETS[regimenId];
  if (regimen !== undefined) {
    return regimen;
  }
  // fallback to first regimen
  const fallbackKey = REGIMEN_KEYS[0];
  if (fallbackKey === undefined) {
    throw new Error("REGIMEN_KEYS is empty; no fallback regimen available");
  }
  const fallbackRegimen = REGIMEN_PRESETS[fallbackKey];
  if (fallbackRegimen === undefined) {
    throw new Error(`Missing regimen preset for fallback key: ${fallbackKey}`);
  }
  return fallbackRegimen;
}

// ============================================
// Infer the default spacing between scheduled regimen dose days
export function chemoRegimenGetDefaultDoseIntervalDays(regimenId: string): number {
  const regimen = chemoRegimenGetById(regimenId);
  if (regimen.doseDays.length < 2) {
    return regimen.cycleDays;
  }
  const firstDoseDay = regimen.doseDays[0];
  const secondDoseDay = regimen.doseDays[1];
  if (firstDoseDay === undefined || secondDoseDay === undefined) {
    throw new Error(`Regimen ${regimen.id} doseDays index out of bounds`);
  }
  return Math.max(1, secondDoseDay - firstDoseDay);
}

// ============================================
// Infer the default number of scheduled regimen administrations
export function chemoRegimenGetDefaultDoseCount(regimenId: string): number {
  const regimen = chemoRegimenGetById(regimenId);
  return Math.max(1, regimen.doseDays.length);
}

// ============================================
// Build a continuous dose-day schedule from a fixed interval and dose count
export function chemoRegimenBuildDoseDays(
  regimenId: string,
  doseIntervalDays?: number,
  doseCount?: number,
): number[] {
  const intervalDays = doseIntervalDays || chemoRegimenGetDefaultDoseIntervalDays(regimenId);
  const count = doseCount || chemoRegimenGetDefaultDoseCount(regimenId);
  const doseDays: number[] = [];
  for (let doseIndex = 0; doseIndex < count; doseIndex += 1) {
    doseDays.push(doseIndex * intervalDays);
  }
  return doseDays;
}

// ============================================
// Build dose events for a regimen, converting mg/m2 to mg using given BSA
// doseMultiplier: scales all doses (default 1.0, use 2.0 for double dose)
// doseCount: number of full regimen administrations to schedule (default regimen count)
// doseIntervalDays: spacing between regimen administrations
// Returns array of {id, drugId, label, startHour, durationHours, amountMg}
export function chemoRegimenBuildDoseEvents(
  regimenId: string,
  bsa?: number,
  doseMultiplier?: number,
  doseCount?: number,
  doseIntervalDays?: number,
): DoseEvent[] {
  const currentBSA = bsa || SIM_DEFAULTS.patientBSA;
  const multiplier = doseMultiplier || 1.0;
  const regimen = chemoRegimenGetById(regimenId);
  const doseDays = chemoRegimenBuildDoseDays(regimenId, doseIntervalDays, doseCount);
  const events: DoseEvent[] = [];
  for (let dayIndex = 0; dayIndex < doseDays.length; dayIndex += 1) {
    const doseDay = doseDays[dayIndex];
    if (doseDay === undefined) {
      throw new Error(`doseDays index out of bounds at ${dayIndex}`);
    }
    const startHour = doseDay * 24;
    for (let drugIndex = 0; drugIndex < regimen.drugs.length; drugIndex += 1) {
      const drugSpec = regimen.drugs[drugIndex];
      if (drugSpec === undefined) {
        throw new Error(`regimen.drugs index out of bounds at ${drugIndex}`);
      }
      const drug = DRUG_DATA[drugSpec.drugKey];
      if (drug === undefined) {
        throw new Error(`Missing drug data for key: ${drugSpec.drugKey}`);
      }
      // convert mg/m2 to mg using current BSA, then apply multiplier
      const doseMg = Math.round(drugSpec.doseMgM2 * currentBSA * multiplier);
      const doseLabel = doseDays.length > 1 ? " (Dose " + (dayIndex + 1) + ")" : "";
      const eventId = regimen.id + "-d" + dayIndex + "-" + drug.id;
      const label = "Day " + (doseDay + 1) + " " + drug.name + doseLabel;
      events.push({
        id: eventId,
        drugId: drug.id,
        label: label,
        startHour: startHour + drugIndex * 0.5,
        durationHours: drug.infusionHours,
        amountMg: doseMg,
      });
    }
  }
  // sort by start time
  events.sort((left, right) => left.startHour - right.startHour);
  return events;
}

// ============================================
// Build list of drug objects for a regimen
export function chemoRegimenBuildDrugList(regimenId: string): DrugDefinition[] {
  const regimen = chemoRegimenGetById(regimenId);
  const drugs: DrugDefinition[] = [];
  for (let index = 0; index < regimen.drugKeys.length; index += 1) {
    const drugKey = regimen.drugKeys[index];
    if (drugKey === undefined) {
      throw new Error(`regimen.drugKeys index out of bounds at ${index}`);
    }
    const drug = DRUG_DATA[drugKey];
    if (drug === undefined) {
      throw new Error(`Missing drug data for key: ${drugKey}`);
    }
    drugs.push(drug);
  }
  return drugs;
}
