function chemoChartFormatMg(value) {
	return value.toFixed(2) + " mg/L";
}

function chemoChartBuildPath(samples, drugId, maxY, width, height, padding) {
	var points = [];
	var index;
	var plotWidth = width - (padding * 2);
	var plotHeight = height - (padding * 2);
	for (index = 0; index < samples.length; index += 1) {
		var x = padding + (plotWidth * index / Math.max(samples.length - 1, 1));
		var y = height - padding - ((samples[index].drugConcentrations[drugId] || 0) / Math.max(maxY, 0.0001) * plotHeight);
		points.push((index === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1));
	}
	return points.join(" ");
}

function chemoChartBuildTotalPath(samples, maxY, width, height, padding) {
	var points = [];
	var index;
	var plotWidth = width - (padding * 2);
	var plotHeight = height - (padding * 2);
	for (index = 0; index < samples.length; index += 1) {
		var x = padding + (plotWidth * index / Math.max(samples.length - 1, 1));
		var y = height - padding - (samples[index].totalBurden / Math.max(maxY, 0.0001) * plotHeight);
		points.push((index === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1));
	}
	return points.join(" ");
}

function chemoChartRender() {
	var chartRoot = document.getElementById("chart-root");
	var legendRoot = document.getElementById("chart-legend");
	var currentSample = chemoStateGetCurrentSample();
	var regimenDrugs = chemoRegimenBuildDrugList(CHEMO_STATE.regimenId);
	var samples = CHEMO_STATE.samples;
	var width = 760;
	var height = 360;
	var padding = 38;
	var index;
	var maxY = 0;
	for (index = 0; index < samples.length; index += 1) {
		maxY = Math.max(maxY, samples[index].totalBurden);
	}
	var gridLines = [];
	for (index = 0; index <= 4; index += 1) {
		var y = padding + ((height - (padding * 2)) * index / 4);
		var labelValue = ((4 - index) / 4) * maxY;
		gridLines.push(
			"<line x1='" + padding + "' y1='" + y.toFixed(1) + "' x2='" + (width - padding) +
			"' y2='" + y.toFixed(1) + "' stroke='#d7d2c7' stroke-width='1' />" +
			"<text x='8' y='" + (y + 4).toFixed(1) + "' fill='#5b6a73' font-size='12'>" +
			labelValue.toFixed(1) + "</text>"
		);
	}
	var lineMarkup = [];
	for (index = 0; index < regimenDrugs.length; index += 1) {
		var drug = regimenDrugs[index];
		lineMarkup.push(
			"<path d='" + chemoChartBuildPath(samples, drug.id, maxY, width, height, padding) +
			"' fill='none' stroke='" + drug.color + "' stroke-width='3' stroke-linecap='round' />"
		);
	}
	lineMarkup.push(
		"<path d='" + chemoChartBuildTotalPath(samples, maxY, width, height, padding) +
		"' fill='none' stroke='#1f2a33' stroke-width='2' stroke-dasharray='7 6' />"
	);
	var sampleX = padding + ((width - (padding * 2)) * CHEMO_STATE.currentSampleIndex / Math.max(samples.length - 1, 1));
	var deathMarker = "";
	for (index = 0; index < samples.length; index += 1) {
		if (samples[index].lifeStatus === "Deceased") {
			var deathX = padding + ((width - (padding * 2)) * index / Math.max(samples.length - 1, 1));
			deathMarker = "<line x1='" + deathX.toFixed(1) + "' y1='" + padding + "' x2='" + deathX.toFixed(1) + "' y2='" + (height - padding) + "' stroke='#000000' stroke-width='2' stroke-dasharray='4 5' />" +
				"<text x='" + (deathX + 6).toFixed(1) + "' y='" + (padding + 16) + "' fill='#000000' font-size='12'>Patient death</text>";
			break;
		}
	}
	var svg = "" +
		"<svg class='chart-svg' viewBox='0 0 " + width + " " + height + "' role='img' aria-label='Chemotherapy concentration chart'>" +
		"<rect x='0' y='0' width='" + width + "' height='" + height + "' rx='18' fill='#fffdf8' />" +
		gridLines.join("") +
		"<line x1='" + padding + "' y1='" + (height - padding) + "' x2='" + (width - padding) + "' y2='" + (height - padding) + "' stroke='#1f2a33' stroke-width='1.5' />" +
		"<line x1='" + sampleX.toFixed(1) + "' y1='" + padding + "' x2='" + sampleX.toFixed(1) + "' y2='" + (height - padding) + "' stroke='#ba4a2f' stroke-width='2' />" +
		deathMarker +
		lineMarkup.join("") +
		"</svg>" +
		"<p class='footer-note'>Current time: <strong>" + currentSample.timeHour.toFixed(0) +
		" hours</strong>. Dashed line shows total burden across all active drugs.</p>";
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
}
