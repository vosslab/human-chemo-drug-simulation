// ============================================
// chart_stage.ts -- SVG concentration and outcome chart rendering
// ============================================
// Builds the log-scale concentration chart and the linear outcome (tumor
// size / patient vitality) chart, then writes their markup into the DOM.
// Ported 1:1 from the legacy chart_stage module; SVG path strings and numeric
// formatting must stay byte-identical to the legacy implementation.
// ============================================

import type { ChemoState, DrugDefinition, SimulationSample } from "./types";
import { CHEMO_STATE, chemoStateGetCurrentSample } from "./game_state";
import {
  chemoRegimenGetById,
  chemoRegimenBuildDrugList,
  chemoRegimenBuildDoseEvents,
} from "./regimen_engine";
import { requireElement } from "./dom";

// ============================================
// Format a concentration value in mg/L with two decimal places
export function chemoChartFormatMg(value: number): string {
  return value.toFixed(2) + " mg/L";
}

// ============================================
// Build the therapeutic-window shaded band and its labels for the
// concentration chart
export function chemoChartBuildTherapeuticBand(
  width: number,
  height: number,
  padding: number,
  minY: number,
  maxY: number,
  config: ChemoState,
): string {
  const regimen = chemoRegimenGetById(config.regimenId);
  const windowSpec = regimen.therapeuticWindow || { ineffectiveMax: 1.5, toxicMin: 12 };
  const plotHeight = height - padding * 2;
  const ineffectiveY = chemoChartMapLogY(
    windowSpec.ineffectiveMax,
    minY,
    maxY,
    plotHeight,
    height,
    padding,
  );
  const toxicY = chemoChartMapLogY(windowSpec.toxicMin, minY, maxY, plotHeight, height, padding);
  return (
    "" +
    "<rect x='" +
    padding +
    "' y='" +
    padding +
    "' width='" +
    (width - padding * 2) +
    "' height='" +
    Math.max(0, toxicY - padding).toFixed(1) +
    "' fill='rgba(183, 69, 58, 0.05)' />" +
    "<rect x='" +
    padding +
    "' y='" +
    toxicY.toFixed(1) +
    "' width='" +
    (width - padding * 2) +
    "' height='" +
    Math.max(0, ineffectiveY - toxicY).toFixed(1) +
    "' fill='rgba(85, 156, 96, 0.10)' />" +
    "<rect x='" +
    padding +
    "' y='" +
    ineffectiveY.toFixed(1) +
    "' width='" +
    (width - padding * 2) +
    "' height='" +
    Math.max(0, height - padding - ineffectiveY).toFixed(1) +
    "' fill='rgba(215, 186, 104, 0.10)' />" +
    "<text x='" +
    (width - padding - 4) +
    "' y='" +
    (toxicY + 12).toFixed(1) +
    "' text-anchor='end' fill='#8d1d1d' font-size='11' font-weight='700'>TOXIC</text>" +
    "<text x='" +
    (width - padding - 4) +
    "' y='" +
    (ineffectiveY - 6).toFixed(1) +
    "' text-anchor='end' fill='#2d7049' font-size='11' font-weight='700'>THERAPEUTIC WINDOW</text>" +
    "<text x='" +
    (width - padding - 4) +
    "' y='" +
    (height - padding - 6) +
    "' text-anchor='end' fill='#8d7a3a' font-size='11' font-weight='700'>INEFFECTIVE</text>"
  );
}

// ============================================
// Build day-boundary tick marks and labels for the shared x axis
export function chemoChartBuildXAxisTicks(
  maxTimeHour: number,
  width: number,
  height: number,
  padding: number,
): string[] {
  const tickMarkup: string[] = [];
  const dayCount = Math.max(0, Math.floor(maxTimeHour / 24));
  for (let index = 0; index <= dayCount; index += 1) {
    const tickHour = index * 24;
    const tickX = padding + ((width - padding * 2) * tickHour) / Math.max(maxTimeHour, 1);
    tickMarkup.push(
      "<line x1='" +
        tickX.toFixed(1) +
        "' y1='" +
        (height - padding) +
        "' x2='" +
        tickX.toFixed(1) +
        "' y2='" +
        (height - padding + 7) +
        "' stroke='#5b6a73' stroke-width='1.2' />" +
        "<text x='" +
        tickX.toFixed(1) +
        "' y='" +
        (height - padding + 21) +
        "' text-anchor='middle' fill='#5b6a73' font-size='11'>D" +
        index +
        "</text>",
    );
  }
  return tickMarkup;
}

// ============================================
// Format a time-in-hours value as "Day N, H h" for the footer note
export function chemoChartFormatTimeHour(timeHour: number): string {
  const totalHours = Math.max(0, timeHour || 0);
  let dayNumber = Math.floor(totalHours / 24);
  let dayHours = Math.round(totalHours - dayNumber * 24);
  if (dayHours === 24) {
    dayNumber += 1;
    dayHours = 0;
  }
  return "Day " + dayNumber + ", " + dayHours + " h";
}

// ============================================
// Base-10 logarithm helper for the log-scale y axis
export function chemoChartLog10(value: number): number {
  return Math.log(value) / Math.log(10);
}

// ============================================
// Map a concentration value onto the log-scale y coordinate of the chart
export function chemoChartMapLogY(
  value: number,
  minY: number,
  maxY: number,
  plotHeight: number,
  height: number,
  padding: number,
): number {
  const safeValue = Math.max(value, minY);
  const minLog = chemoChartLog10(minY);
  const maxLog = chemoChartLog10(maxY);
  const valueLog = chemoChartLog10(safeValue);
  const ratio = (valueLog - minLog) / Math.max(maxLog - minLog, 0.0001);
  return height - padding - ratio * plotHeight;
}

// ============================================
// Build an SVG path string for one drug's concentration curve
export function chemoChartBuildPath(
  samples: SimulationSample[],
  drugId: string,
  minY: number,
  maxY: number,
  width: number,
  height: number,
  padding: number,
): string {
  const points: string[] = [];
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (sample === undefined) {
      throw new Error(`chemoChartBuildPath: samples index out of bounds at ${index}`);
    }
    const x = padding + (plotWidth * index) / Math.max(samples.length - 1, 1);
    const y = chemoChartMapLogY(
      sample.drugConcentrations[drugId] || 0,
      minY,
      maxY,
      plotHeight,
      height,
      padding,
    );
    points.push((index === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1));
  }
  return points.join(" ");
}

// ============================================
// Build an SVG path string for the total-burden dashed curve
export function chemoChartBuildTotalPath(
  samples: SimulationSample[],
  minY: number,
  maxY: number,
  width: number,
  height: number,
  padding: number,
): string {
  const points: string[] = [];
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (sample === undefined) {
      throw new Error(`chemoChartBuildTotalPath: samples index out of bounds at ${index}`);
    }
    const x = padding + (plotWidth * index) / Math.max(samples.length - 1, 1);
    const y = chemoChartMapLogY(sample.totalBurden, minY, maxY, plotHeight, height, padding);
    points.push((index === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1));
  }
  return points.join(" ");
}

// ============================================
// Build an SVG path string for a linear 0-100% metric curve (tumor size or
// patient vitality) on the outcomes chart
export function chemoChartBuildPercentPath(
  samples: SimulationSample[],
  metricKey: "tumorVolume" | "patientHealth",
  width: number,
  height: number,
  padding: number,
): string {
  const points: string[] = [];
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (sample === undefined) {
      throw new Error(`chemoChartBuildPercentPath: samples index out of bounds at ${index}`);
    }
    const x = padding + (plotWidth * index) / Math.max(samples.length - 1, 1);
    const metricValue = sample[metricKey];
    let percentValue: number;
    if (metricKey === "tumorVolume") {
      percentValue = (typeof metricValue === "number" ? metricValue : 0) * 100;
    } else {
      percentValue = typeof metricValue === "number" ? metricValue : 0;
    }
    const y = height - padding - (percentValue / 100) * plotHeight;
    points.push((index === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1));
  }
  return points.join(" ");
}

// ============================================
// Render the concentration chart and outcomes chart into the DOM, along
// with their legends and footer notes
export function chemoChartRender(): void {
  const chartRoot = requireElement("chart-root");
  const legendRoot = requireElement("chart-legend");
  const outcomesRoot = requireElement("outcome-chart-root");
  const outcomesLegendRoot = requireElement("outcome-chart-legend");
  const currentSample = chemoStateGetCurrentSample();
  if (currentSample === null) {
    throw new Error("chemoChartRender: no current sample available");
  }
  const regimenDrugs: DrugDefinition[] = chemoRegimenBuildDrugList(CHEMO_STATE.regimenId);
  const samples: SimulationSample[] = CHEMO_STATE.samples;
  const width = 760;
  const height = 260;
  const padding = 40;
  let maxY = 0;
  let minPositiveY: number | null = null;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (sample === undefined) {
      throw new Error(`chemoChartRender: samples index out of bounds at ${index}`);
    }
    maxY = Math.max(maxY, sample.totalBurden);
    if (sample.totalBurden > 0) {
      if (minPositiveY === null || sample.totalBurden < minPositiveY) {
        minPositiveY = sample.totalBurden;
      }
    }
    for (let drugIndex = 0; drugIndex < regimenDrugs.length; drugIndex += 1) {
      const regimenDrug = regimenDrugs[drugIndex];
      if (regimenDrug === undefined) {
        throw new Error(`chemoChartRender: regimenDrugs index out of bounds at ${drugIndex}`);
      }
      const drugAmount = sample.drugConcentrations[regimenDrug.id] || 0;
      if (drugAmount > 0 && (minPositiveY === null || drugAmount < minPositiveY)) {
        minPositiveY = drugAmount;
      }
    }
  }
  maxY = Math.max(maxY, 0.1);
  minPositiveY = Math.max(0.001, minPositiveY || maxY / 1000);
  const minPower = Math.floor(chemoChartLog10(minPositiveY));
  const maxPower = Math.ceil(chemoChartLog10(maxY));
  const minY = Math.pow(10, minPower);
  const maxScaleY = Math.pow(10, Math.max(minPower + 1, maxPower));
  const gridLines: string[] = [];
  for (let index = maxPower; index >= minPower; index -= 1) {
    const labelValue = Math.pow(10, index);
    const y = chemoChartMapLogY(labelValue, minY, maxScaleY, height - padding * 2, height, padding);
    gridLines.push(
      "<line x1='" +
        padding +
        "' y1='" +
        y.toFixed(1) +
        "' x2='" +
        (width - padding) +
        "' y2='" +
        y.toFixed(1) +
        "' stroke='#d7d2c7' stroke-width='1' />" +
        "<text x='8' y='" +
        (y + 4).toFixed(1) +
        "' fill='#5b6a73' font-size='12'>" +
        (labelValue >= 1
          ? labelValue.toFixed(0)
          : labelValue.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")) +
        "</text>",
    );
  }
  const lastSample = samples[samples.length - 1];
  if (lastSample === undefined) {
    throw new Error("chemoChartRender: samples array is empty");
  }
  const maxTimeHour = lastSample.timeHour;
  const xAxisTicks = chemoChartBuildXAxisTicks(maxTimeHour, width, height, padding);
  const therapeuticBand = chemoChartBuildTherapeuticBand(
    width,
    height,
    padding,
    minY,
    maxScaleY,
    CHEMO_STATE,
  );
  const doseMarkerMarkup: string[] = [];
  // NOTE: legacy CHEMO_STATE never carried a bsa field either; chemoRegimenBuildDoseEvents
  // falls back to SIM_DEFAULTS.patientBSA when bsa is undefined, matching legacy behavior
  const doseEvents = chemoRegimenBuildDoseEvents(
    CHEMO_STATE.regimenId,
    undefined,
    CHEMO_STATE.doseMultiplier,
    CHEMO_STATE.doseCount,
    CHEMO_STATE.doseIntervalDays,
  );
  for (let index = 0; index < doseEvents.length; index += 1) {
    const event = doseEvents[index];
    if (event === undefined) {
      throw new Error(`chemoChartRender: doseEvents index out of bounds at ${index}`);
    }
    if (event.startHour > maxTimeHour) {
      continue;
    }
    const doseX = padding + ((width - padding * 2) * event.startHour) / Math.max(maxTimeHour, 1);
    doseMarkerMarkup.push(
      "<line x1='" +
        doseX.toFixed(1) +
        "' y1='" +
        padding +
        "' x2='" +
        doseX.toFixed(1) +
        "' y2='" +
        (height - padding) +
        "' stroke='rgba(186,74,47,0.22)' stroke-width='1.4' />",
    );
  }
  const lineMarkup: string[] = [];
  for (let index = 0; index < regimenDrugs.length; index += 1) {
    const drug = regimenDrugs[index];
    if (drug === undefined) {
      throw new Error(`chemoChartRender: regimenDrugs index out of bounds at ${index}`);
    }
    lineMarkup.push(
      "<path d='" +
        chemoChartBuildPath(samples, drug.id, minY, maxScaleY, width, height, padding) +
        "' fill='none' stroke='" +
        drug.color +
        "' stroke-width='3' stroke-linecap='round' />",
    );
  }
  lineMarkup.push(
    "<path d='" +
      chemoChartBuildTotalPath(samples, minY, maxScaleY, width, height, padding) +
      "' fill='none' stroke='#1f2a33' stroke-width='2' stroke-dasharray='7 6' />",
  );
  const sampleX =
    padding +
    ((width - padding * 2) * CHEMO_STATE.currentSampleIndex) / Math.max(samples.length - 1, 1);
  let deathMarker = "";
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (sample === undefined) {
      throw new Error(`chemoChartRender: samples index out of bounds at ${index}`);
    }
    if (sample.lifeStatus === "Deceased") {
      const deathX = padding + ((width - padding * 2) * index) / Math.max(samples.length - 1, 1);
      const labelWidth = 112;
      const labelX = Math.max(padding + 4, Math.min(width - padding - labelWidth - 4, deathX + 8));
      const overlayWidth = Math.max(0, width - padding - deathX);
      deathMarker =
        "" +
        "<rect x='" +
        deathX.toFixed(1) +
        "' y='" +
        padding +
        "' width='" +
        overlayWidth.toFixed(1) +
        "' height='" +
        (height - padding * 2) +
        "' fill='rgba(186,36,36,0.10)' />" +
        "<line x1='" +
        deathX.toFixed(1) +
        "' y1='" +
        padding +
        "' x2='" +
        deathX.toFixed(1) +
        "' y2='" +
        (height - padding) +
        "' stroke='#8d1d1d' stroke-width='3' stroke-dasharray='6 5' />" +
        "<circle cx='" +
        deathX.toFixed(1) +
        "' cy='" +
        padding +
        "' r='5.5' fill='#8d1d1d' />" +
        "<rect x='" +
        labelX.toFixed(1) +
        "' y='" +
        (padding + 6) +
        "' width='" +
        labelWidth +
        "' height='22' rx='11' fill='#8d1d1d' />" +
        "<text x='" +
        (labelX + labelWidth / 2).toFixed(1) +
        "' y='" +
        (padding + 20) +
        "' text-anchor='middle' fill='#fffdf8' font-size='11' font-weight='700'>PATIENT DEATH</text>";
      break;
    }
  }
  const svg =
    "" +
    "<svg class='chart-svg' viewBox='0 0 " +
    width +
    " " +
    height +
    "' role='img' aria-label='Chemotherapy concentration chart'>" +
    "<rect x='0' y='0' width='" +
    width +
    "' height='" +
    height +
    "' rx='18' fill='#fffdf8' />" +
    therapeuticBand +
    gridLines.join("") +
    doseMarkerMarkup.join("") +
    "<line x1='" +
    padding +
    "' y1='" +
    (height - padding) +
    "' x2='" +
    (width - padding) +
    "' y2='" +
    (height - padding) +
    "' stroke='#1f2a33' stroke-width='1.5' />" +
    xAxisTicks.join("") +
    "<line x1='" +
    sampleX.toFixed(1) +
    "' y1='" +
    padding +
    "' x2='" +
    sampleX.toFixed(1) +
    "' y2='" +
    (height - padding) +
    "' stroke='#ba4a2f' stroke-width='2' />" +
    deathMarker +
    lineMarkup.join("") +
    "</svg>" +
    "<p class='footer-note'>Current time: <strong>" +
    chemoChartFormatTimeHour(currentSample.timeHour) +
    "</strong>. Y-axis uses a log scale. Pale vertical lines mark dose administrations; the dashed line shows total burden across all active drugs, and the colored band shows ineffective, therapeutic, and toxic exposure zones.</p>";
  chartRoot.innerHTML = svg;
  const legendMarkup: string[] = [];
  for (let index = 0; index < regimenDrugs.length; index += 1) {
    const legendDrug = regimenDrugs[index];
    if (legendDrug === undefined) {
      throw new Error(`chemoChartRender: regimenDrugs index out of bounds at ${index}`);
    }
    legendMarkup.push(
      "<div class='legend-chip'><span class='legend-swatch' style='background:" +
        legendDrug.color +
        ";'></span><span>" +
        legendDrug.name +
        ": " +
        chemoChartFormatMg(currentSample.drugConcentrations[legendDrug.id] || 0) +
        "</span></div>",
    );
  }
  legendMarkup.push(
    "<div class='legend-chip'><span class='legend-swatch' style='background:#1f2a33;'></span><span>Total burden: " +
      chemoChartFormatMg(currentSample.totalBurden) +
      "</span></div>",
  );
  legendRoot.innerHTML = legendMarkup.join("");

  const outcomeWidth = 760;
  const outcomeHeight = 170;
  const outcomePadding = 34;
  const outcomeGrid: string[] = [];
  for (let index = 0; index <= 4; index += 1) {
    const gridPercent = index * 25;
    const gridY =
      outcomeHeight - outcomePadding - (gridPercent / 100) * (outcomeHeight - outcomePadding * 2);
    outcomeGrid.push(
      "<line x1='" +
        outcomePadding +
        "' y1='" +
        gridY.toFixed(1) +
        "' x2='" +
        (outcomeWidth - outcomePadding) +
        "' y2='" +
        gridY.toFixed(1) +
        "' stroke='#d7d2c7' stroke-width='1' />" +
        "<text x='10' y='" +
        (gridY + 4).toFixed(1) +
        "' fill='#5b6a73' font-size='12'>" +
        gridPercent +
        "%</text>",
    );
  }
  const outcomeTicks = chemoChartBuildXAxisTicks(
    maxTimeHour,
    outcomeWidth,
    outcomeHeight,
    outcomePadding,
  );
  const outcomeSampleX =
    outcomePadding +
    ((outcomeWidth - outcomePadding * 2) * CHEMO_STATE.currentSampleIndex) /
      Math.max(samples.length - 1, 1);
  const outcomeSvg =
    "" +
    "<svg class='chart-svg' viewBox='0 0 " +
    outcomeWidth +
    " " +
    outcomeHeight +
    "' role='img' aria-label='Tumor size and patient vitality chart'>" +
    "<rect x='0' y='0' width='" +
    outcomeWidth +
    "' height='" +
    outcomeHeight +
    "' rx='18' fill='#fffdf8' />" +
    outcomeGrid.join("") +
    "<line x1='" +
    outcomePadding +
    "' y1='" +
    (outcomeHeight - outcomePadding) +
    "' x2='" +
    (outcomeWidth - outcomePadding) +
    "' y2='" +
    (outcomeHeight - outcomePadding) +
    "' stroke='#1f2a33' stroke-width='1.5' />" +
    outcomeTicks.join("") +
    "<line x1='" +
    outcomeSampleX.toFixed(1) +
    "' y1='" +
    outcomePadding +
    "' x2='" +
    outcomeSampleX.toFixed(1) +
    "' y2='" +
    (outcomeHeight - outcomePadding) +
    "' stroke='#ba4a2f' stroke-width='2' />" +
    "<path d='" +
    chemoChartBuildPercentPath(
      samples,
      "tumorVolume",
      outcomeWidth,
      outcomeHeight,
      outcomePadding,
    ) +
    "' fill='none' stroke='#7e5bd6' stroke-width='3' stroke-linecap='round' />" +
    "<path d='" +
    chemoChartBuildPercentPath(
      samples,
      "patientHealth",
      outcomeWidth,
      outcomeHeight,
      outcomePadding,
    ) +
    "' fill='none' stroke='#3a8a5c' stroke-width='3' stroke-linecap='round' />" +
    "</svg>" +
    "<p class='footer-note'>Tumor size and patient vitality are shown on a linear 0-100% scale over time.</p>";
  outcomesRoot.innerHTML = outcomeSvg;
  outcomesLegendRoot.innerHTML =
    "" +
    "<div class='legend-chip'><span class='legend-swatch' style='background:#7e5bd6;'></span><span>Tumor size: " +
    Math.round(currentSample.tumorVolume * 100) +
    "%</span></div>" +
    "<div class='legend-chip'><span class='legend-swatch' style='background:#3a8a5c;'></span><span>Patient vitality: " +
    Math.round(currentSample.patientHealth) +
    "%</span></div>";
}
