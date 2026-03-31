function chemoChartFormatMg(value) {
	return value.toFixed(2) + " mg/L";
}

function chemoChartBuildTherapeuticBand(width, height, padding, minY, maxY, config) {
	var regimen = chemoRegimenGetById(config.regimenId);
	var windowSpec = regimen.therapeuticWindow || { ineffectiveMax: 1.5, toxicMin: 12 };
	var plotHeight = height - (padding * 2);
	var ineffectiveY = chemoChartMapLogY(windowSpec.ineffectiveMax, minY, maxY, plotHeight, height, padding);
	var toxicY = chemoChartMapLogY(windowSpec.toxicMin, minY, maxY, plotHeight, height, padding);
	return "" +
		"<rect x='" + padding + "' y='" + padding + "' width='" + (width - (padding * 2)) + "' height='" + Math.max(0, toxicY - padding).toFixed(1) + "' fill='rgba(183, 69, 58, 0.05)' />" +
		"<rect x='" + padding + "' y='" + toxicY.toFixed(1) + "' width='" + (width - (padding * 2)) + "' height='" + Math.max(0, ineffectiveY - toxicY).toFixed(1) + "' fill='rgba(85, 156, 96, 0.10)' />" +
		"<rect x='" + padding + "' y='" + ineffectiveY.toFixed(1) + "' width='" + (width - (padding * 2)) + "' height='" + Math.max(0, (height - padding) - ineffectiveY).toFixed(1) + "' fill='rgba(215, 186, 104, 0.10)' />" +
		"<text x='" + (width - padding - 4) + "' y='" + (toxicY + 12).toFixed(1) + "' text-anchor='end' fill='#8d1d1d' font-size='11' font-weight='700'>TOXIC</text>" +
		"<text x='" + (width - padding - 4) + "' y='" + (ineffectiveY - 6).toFixed(1) + "' text-anchor='end' fill='#2d7049' font-size='11' font-weight='700'>THERAPEUTIC WINDOW</text>" +
		"<text x='" + (width - padding - 4) + "' y='" + (height - padding - 6) + "' text-anchor='end' fill='#8d7a3a' font-size='11' font-weight='700'>INEFFECTIVE</text>";
}

function chemoChartBuildXAxisTicks(maxTimeHour, width, height, padding) {
	var tickMarkup = [];
	var index;
	var dayCount = Math.max(0, Math.floor(maxTimeHour / 24));
	for (index = 0; index <= dayCount; index += 1) {
		var tickHour = index * 24;
		var tickX = padding + ((width - (padding * 2)) * tickHour / Math.max(maxTimeHour, 1));
		tickMarkup.push(
			"<line x1='" + tickX.toFixed(1) + "' y1='" + (height - padding) + "' x2='" + tickX.toFixed(1) +
			"' y2='" + (height - padding + 7) + "' stroke='#5b6a73' stroke-width='1.2' />" +
			"<text x='" + tickX.toFixed(1) + "' y='" + (height - padding + 21) + "' text-anchor='middle' fill='#5b6a73' font-size='11'>D" + index + "</text>"
		);
	}
	return tickMarkup;
}

function chemoChartFormatTimeHour(timeHour) {
	var totalHours = Math.max(0, timeHour || 0);
	var dayNumber = Math.floor(totalHours / 24);
	var dayHours = Math.round(totalHours - (dayNumber * 24));
	if (dayHours === 24) {
		dayNumber += 1;
		dayHours = 0;
	}
	return "Day " + dayNumber + ", " + dayHours + " h";
}

function chemoChartLog10(value) {
	return Math.log(value) / Math.log(10);
}

function chemoChartMapLogY(value, minY, maxY, plotHeight, height, padding) {
	var safeValue = Math.max(value, minY);
	var minLog = chemoChartLog10(minY);
	var maxLog = chemoChartLog10(maxY);
	var valueLog = chemoChartLog10(safeValue);
	var ratio = (valueLog - minLog) / Math.max(maxLog - minLog, 0.0001);
	return height - padding - (ratio * plotHeight);
}

function chemoChartBuildPath(samples, drugId, minY, maxY, width, height, padding) {
	var points = [];
	var index;
	var plotWidth = width - (padding * 2);
	var plotHeight = height - (padding * 2);
	for (index = 0; index < samples.length; index += 1) {
		var x = padding + (plotWidth * index / Math.max(samples.length - 1, 1));
		var y = chemoChartMapLogY(samples[index].drugConcentrations[drugId] || 0, minY, maxY, plotHeight, height, padding);
		points.push((index === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1));
	}
	return points.join(" ");
}

function chemoChartBuildTotalPath(samples, minY, maxY, width, height, padding) {
	var points = [];
	var index;
	var plotWidth = width - (padding * 2);
	var plotHeight = height - (padding * 2);
	for (index = 0; index < samples.length; index += 1) {
		var x = padding + (plotWidth * index / Math.max(samples.length - 1, 1));
		var y = chemoChartMapLogY(samples[index].totalBurden, minY, maxY, plotHeight, height, padding);
		points.push((index === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1));
	}
	return points.join(" ");
}

function chemoChartBuildPercentPath(samples, metricKey, width, height, padding) {
	var points = [];
	var index;
	var plotWidth = width - (padding * 2);
	var plotHeight = height - (padding * 2);
	for (index = 0; index < samples.length; index += 1) {
		var x = padding + (plotWidth * index / Math.max(samples.length - 1, 1));
		var metricValue = samples[index][metricKey];
		var percentValue = 0;
		if (metricKey === "tumorVolume") {
			percentValue = (typeof metricValue === "number" ? metricValue : 0) * 100;
		} else {
			percentValue = typeof metricValue === "number" ? metricValue : 0;
		}
		var y = height - padding - ((percentValue / 100) * plotHeight);
		points.push((index === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1));
	}
	return points.join(" ");
}

function chemoChartRender() {
	var chartRoot = document.getElementById("chart-root");
	var legendRoot = document.getElementById("chart-legend");
	var outcomesRoot = document.getElementById("outcome-chart-root");
	var outcomesLegendRoot = document.getElementById("outcome-chart-legend");
	var currentSample = chemoStateGetCurrentSample();
	var regimenDrugs = chemoRegimenBuildDrugList(CHEMO_STATE.regimenId);
	var samples = CHEMO_STATE.samples;
	var width = 760;
	var height = 260;
	var padding = 40;
	var index;
	var maxY = 0;
	var minPositiveY = null;
	for (index = 0; index < samples.length; index += 1) {
		maxY = Math.max(maxY, samples[index].totalBurden);
		if (samples[index].totalBurden > 0) {
			if (minPositiveY === null || samples[index].totalBurden < minPositiveY) {
				minPositiveY = samples[index].totalBurden;
			}
		}
		for (var drugIndex = 0; drugIndex < regimenDrugs.length; drugIndex += 1) {
			var drugAmount = samples[index].drugConcentrations[regimenDrugs[drugIndex].id] || 0;
			if (drugAmount > 0 && (minPositiveY === null || drugAmount < minPositiveY)) {
				minPositiveY = drugAmount;
			}
		}
	}
	maxY = Math.max(maxY, 0.1);
	minPositiveY = Math.max(0.001, minPositiveY || (maxY / 1000));
	var minPower = Math.floor(chemoChartLog10(minPositiveY));
	var maxPower = Math.ceil(chemoChartLog10(maxY));
	var minY = Math.pow(10, minPower);
	var maxScaleY = Math.pow(10, Math.max(minPower + 1, maxPower));
	var gridLines = [];
	for (index = maxPower; index >= minPower; index -= 1) {
		var labelValue = Math.pow(10, index);
		var y = chemoChartMapLogY(labelValue, minY, maxScaleY, height - (padding * 2), height, padding);
		gridLines.push(
			"<line x1='" + padding + "' y1='" + y.toFixed(1) + "' x2='" + (width - padding) +
			"' y2='" + y.toFixed(1) + "' stroke='#d7d2c7' stroke-width='1' />" +
			"<text x='8' y='" + (y + 4).toFixed(1) + "' fill='#5b6a73' font-size='12'>" +
			(labelValue >= 1 ? labelValue.toFixed(0) : labelValue.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")) + "</text>"
		);
	}
	var maxTimeHour = samples[samples.length - 1].timeHour;
	var xAxisTicks = chemoChartBuildXAxisTicks(maxTimeHour, width, height, padding);
	var therapeuticBand = chemoChartBuildTherapeuticBand(width, height, padding, minY, maxScaleY, CHEMO_STATE);
	var doseMarkerMarkup = [];
	var doseEvents = chemoRegimenBuildDoseEvents(
		CHEMO_STATE.regimenId,
		CHEMO_STATE.bsa,
		CHEMO_STATE.doseMultiplier,
		CHEMO_STATE.doseCount,
		CHEMO_STATE.doseIntervalDays
	);
	for (index = 0; index < doseEvents.length; index += 1) {
		var event = doseEvents[index];
		if (event.startHour > maxTimeHour) {
			continue;
		}
		var doseX = padding + ((width - (padding * 2)) * event.startHour / Math.max(maxTimeHour, 1));
		doseMarkerMarkup.push(
			"<line x1='" + doseX.toFixed(1) + "' y1='" + padding + "' x2='" + doseX.toFixed(1) +
			"' y2='" + (height - padding) + "' stroke='rgba(186,74,47,0.22)' stroke-width='1.4' />"
		);
	}
	var lineMarkup = [];
	for (index = 0; index < regimenDrugs.length; index += 1) {
		var drug = regimenDrugs[index];
		lineMarkup.push(
			"<path d='" + chemoChartBuildPath(samples, drug.id, minY, maxScaleY, width, height, padding) +
			"' fill='none' stroke='" + drug.color + "' stroke-width='3' stroke-linecap='round' />"
		);
	}
	lineMarkup.push(
		"<path d='" + chemoChartBuildTotalPath(samples, minY, maxScaleY, width, height, padding) +
		"' fill='none' stroke='#1f2a33' stroke-width='2' stroke-dasharray='7 6' />"
	);
	var sampleX = padding + ((width - (padding * 2)) * CHEMO_STATE.currentSampleIndex / Math.max(samples.length - 1, 1));
	var deathMarker = "";
	for (index = 0; index < samples.length; index += 1) {
		if (samples[index].lifeStatus === "Deceased") {
			var deathX = padding + ((width - (padding * 2)) * index / Math.max(samples.length - 1, 1));
			var labelWidth = 112;
			var labelX = Math.max(
				padding + 4,
				Math.min((width - padding) - labelWidth - 4, deathX + 8)
			);
			var overlayWidth = Math.max(0, (width - padding) - deathX);
			deathMarker = "" +
				"<rect x='" + deathX.toFixed(1) + "' y='" + padding + "' width='" + overlayWidth.toFixed(1) +
				"' height='" + (height - (padding * 2)) + "' fill='rgba(186,36,36,0.10)' />" +
				"<line x1='" + deathX.toFixed(1) + "' y1='" + padding + "' x2='" + deathX.toFixed(1) + "' y2='" + (height - padding) +
				"' stroke='#8d1d1d' stroke-width='3' stroke-dasharray='6 5' />" +
				"<circle cx='" + deathX.toFixed(1) + "' cy='" + padding + "' r='5.5' fill='#8d1d1d' />" +
				"<rect x='" + labelX.toFixed(1) + "' y='" + (padding + 6) + "' width='" + labelWidth +
				"' height='22' rx='11' fill='#8d1d1d' />" +
				"<text x='" + (labelX + (labelWidth / 2)).toFixed(1) + "' y='" + (padding + 20) +
				"' text-anchor='middle' fill='#fffdf8' font-size='11' font-weight='700'>PATIENT DEATH</text>";
			break;
		}
	}
	var svg = "" +
		"<svg class='chart-svg' viewBox='0 0 " + width + " " + height + "' role='img' aria-label='Chemotherapy concentration chart'>" +
		"<rect x='0' y='0' width='" + width + "' height='" + height + "' rx='18' fill='#fffdf8' />" +
		therapeuticBand +
		gridLines.join("") +
		doseMarkerMarkup.join("") +
		"<line x1='" + padding + "' y1='" + (height - padding) + "' x2='" + (width - padding) + "' y2='" + (height - padding) + "' stroke='#1f2a33' stroke-width='1.5' />" +
		xAxisTicks.join("") +
		"<line x1='" + sampleX.toFixed(1) + "' y1='" + padding + "' x2='" + sampleX.toFixed(1) + "' y2='" + (height - padding) + "' stroke='#ba4a2f' stroke-width='2' />" +
		deathMarker +
		lineMarkup.join("") +
		"</svg>" +
		"<p class='footer-note'>Current time: <strong>" + chemoChartFormatTimeHour(currentSample.timeHour) +
		"</strong>. Y-axis uses a log scale. Pale vertical lines mark dose administrations; the dashed line shows total burden across all active drugs, and the colored band shows ineffective, therapeutic, and toxic exposure zones.</p>";
	chartRoot.innerHTML = svg;
	var legendMarkup = [];
	for (index = 0; index < regimenDrugs.length; index += 1) {
		var legendDrug = regimenDrugs[index];
		legendMarkup.push(
			"<div class='legend-chip'><span class='legend-swatch' style='background:" + legendDrug.color +
			";'></span><span>" + legendDrug.name + ": " +
			chemoChartFormatMg(currentSample.drugConcentrations[legendDrug.id] || 0) + "</span></div>"
		);
	}
	legendMarkup.push(
		"<div class='legend-chip'><span class='legend-swatch' style='background:#1f2a33;'></span><span>Total burden: " +
		chemoChartFormatMg(currentSample.totalBurden) + "</span></div>"
	);
	legendRoot.innerHTML = legendMarkup.join("");

	var outcomeWidth = 760;
	var outcomeHeight = 170;
	var outcomePadding = 34;
	var outcomeGrid = [];
	for (index = 0; index <= 4; index += 1) {
		var gridPercent = index * 25;
		var gridY = outcomeHeight - outcomePadding - ((gridPercent / 100) * (outcomeHeight - (outcomePadding * 2)));
		outcomeGrid.push(
			"<line x1='" + outcomePadding + "' y1='" + gridY.toFixed(1) + "' x2='" + (outcomeWidth - outcomePadding) +
			"' y2='" + gridY.toFixed(1) + "' stroke='#d7d2c7' stroke-width='1' />" +
			"<text x='10' y='" + (gridY + 4).toFixed(1) + "' fill='#5b6a73' font-size='12'>" + gridPercent + "%</text>"
		);
	}
	var outcomeTicks = chemoChartBuildXAxisTicks(maxTimeHour, outcomeWidth, outcomeHeight, outcomePadding);
	var outcomeSampleX = outcomePadding + ((outcomeWidth - (outcomePadding * 2)) * CHEMO_STATE.currentSampleIndex / Math.max(samples.length - 1, 1));
	var outcomeSvg = "" +
		"<svg class='chart-svg' viewBox='0 0 " + outcomeWidth + " " + outcomeHeight + "' role='img' aria-label='Tumor size and patient vitality chart'>" +
		"<rect x='0' y='0' width='" + outcomeWidth + "' height='" + outcomeHeight + "' rx='18' fill='#fffdf8' />" +
		outcomeGrid.join("") +
		"<line x1='" + outcomePadding + "' y1='" + (outcomeHeight - outcomePadding) + "' x2='" + (outcomeWidth - outcomePadding) + "' y2='" + (outcomeHeight - outcomePadding) + "' stroke='#1f2a33' stroke-width='1.5' />" +
		outcomeTicks.join("") +
		"<line x1='" + outcomeSampleX.toFixed(1) + "' y1='" + outcomePadding + "' x2='" + outcomeSampleX.toFixed(1) + "' y2='" + (outcomeHeight - outcomePadding) + "' stroke='#ba4a2f' stroke-width='2' />" +
		"<path d='" + chemoChartBuildPercentPath(samples, "tumorVolume", outcomeWidth, outcomeHeight, outcomePadding) + "' fill='none' stroke='#7e5bd6' stroke-width='3' stroke-linecap='round' />" +
		"<path d='" + chemoChartBuildPercentPath(samples, "patientHealth", outcomeWidth, outcomeHeight, outcomePadding) + "' fill='none' stroke='#3a8a5c' stroke-width='3' stroke-linecap='round' />" +
		"</svg>" +
		"<p class='footer-note'>Tumor size and patient vitality are shown on a linear 0-100% scale over time.</p>";
	outcomesRoot.innerHTML = outcomeSvg;
	outcomesLegendRoot.innerHTML = "" +
		"<div class='legend-chip'><span class='legend-swatch' style='background:#7e5bd6;'></span><span>Tumor size: " + Math.round(currentSample.tumorVolume * 100) + "%</span></div>" +
		"<div class='legend-chip'><span class='legend-swatch' style='background:#3a8a5c;'></span><span>Patient vitality: " + Math.round(currentSample.patientHealth) + "%</span></div>";
}
