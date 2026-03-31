// ============================================
// constants.js -- Drug PK data, regimen presets, and simulation defaults
// ============================================
// Canonical unit system:
//   Time: minutes (internally), display adapts to min/hr/days
//   Drug amount: mg (regimen source doses are mg/m2, converted at dose-event build time)
//   Volume: L total (source Vd is L/kg, converted at concentration calculation time)
//   Concentration: mg/L
//   Half-life: minutes (stored in DRUG_DATA)
// ============================================

// Default simulation parameters
var SIM_DEFAULTS = {
	patientWeightKg: 70,
	patientBSA: 1.7,
	// sample interval in minutes (2 hours)
	timeStepMinutes: 120,
	// total simulation duration in minutes (720 hours = 30 days)
	defaultDurationMinutes: 43200,
	// derived: expected sample count = duration / interval + 1 = 361
	defaultSpeed: 1,
};

// ============================================
// Organ extraction ratios for deriving organ concentrations from plasma
// Keyed by clearance route: hepatic, renal, biliary
var ORGAN_EXTRACTION = {
	liver: {
		hepatic: 0.7,
		renal: 0.2,
		biliary: 0.5,
	},
	kidney: {
		hepatic: 0.2,
		renal: 0.7,
		biliary: 0.1,
	},
	tissue: {
		hepatic: 0.3,
		renal: 0.3,
		biliary: 0.3,
	},
};

// ============================================
// Visual channel colors and organ info for body visualization
var CHEMO_VIS_CHANNELS = [
	{ key: "bloodstream", label: "Bloodstream", color: "#d65050" },
	{ key: "liver", label: "Liver", color: "#dd8b3d" },
	{ key: "kidney", label: "Kidneys", color: "#4a7db2" },
	{ key: "tumor", label: "Tumor", color: "#7e5bd6" },
];

var CHEMO_ORGAN_INFO = [
	{ key: "bloodstream", label: "Bloodstream", role: "Carries the drug rapidly through the body right after dosing." },
	{ key: "liver", label: "Liver", role: "Breaks down and processes much of the chemotherapy burden." },
	{ key: "kidney", label: "Kidneys", role: "Clear water-soluble drug and metabolites from circulation." },
	{ key: "tumor", label: "Tumor", role: "Receives exposure that can reduce tumor mass over time." },
];

var CHEMO_CASE_TRAITS = [
	{
		key: "fast_clearer",
		label: "Fast clearer",
		description: "Drugs clear faster than expected, reducing exposure windows.",
		clearanceMultiplier: 1.18,
		resilienceMultiplier: 1.02,
	},
	{
		key: "fragile_marrow",
		label: "Fragile marrow",
		description: "Bone marrow reserve is limited, increasing delayed toxicity.",
		clearanceMultiplier: 1.0,
		resilienceMultiplier: 0.84,
	},
	{
		key: "chemo_resistant",
		label: "Chemo-resistant tumor",
		description: "Tumor kill is blunted despite otherwise adequate exposure.",
		clearanceMultiplier: 1.0,
		resilienceMultiplier: 1.0,
		efficacyMultiplier: 0.82,
	},
	{
		key: "renal_vulnerability",
		label: "Renal vulnerability",
		description: "Kidney reserve is low and renal-cleared drugs become more dangerous.",
		clearanceMultiplier: 0.90,
		resilienceMultiplier: 0.92,
		renalReserve: 0.72,
	},
];

// ============================================
// Drug pharmacokinetic parameter database
// Source units: vdLPerKg (L/kg), halfLife in minutes, dose in mg/m2
// Vd is converted to total L at concentration calculation time
// Doses are converted to mg at dose-event build time using current BSA
var DRUG_DATA = {
	fluorouracil: {
		id: "fluorouracil",
		name: "5-Fluorouracil",
		abbreviation: "5-FU",
		compartments: 1,
		halfLifeMinutes: 14,
		halfLifeAlphaMinutes: null,
		halfLifeBetaMinutes: null,
		vdLPerKg: 0.25,
		typicalDoseMgM2: 500,
		primaryOrgan: "liver",
		excretionOrgan: "kidney",
		color: "#FF6B35",
		// body affinity ratios for visual rendering
		bodyAffinity: { bloodstream: 1.25, liver: 0.55, kidney: 0.5, tumor: 1.2 },
		adverseEffects: [
			{ key: "mucositis", label: "Mucositis", rule: "mucositis" },
			{ key: "diarrhea", label: "Diarrhea", rule: "acute" },
			{ key: "myelosuppression", label: "Myelosuppression", rule: "marrow" },
		],
		infusionHours: 46,
		description: "Antimetabolite that inhibits thymidylate synthase. "
			+ "Very short plasma half-life (14 min) due to rapid hepatic metabolism.",
	},
	doxorubicin: {
		id: "doxorubicin",
		name: "Doxorubicin",
		abbreviation: "DOX",
		compartments: 2,
		halfLifeMinutes: null,
		halfLifeAlphaMinutes: 5,
		halfLifeBetaMinutes: 1800,
		vdLPerKg: 0.34,
		typicalDoseMgM2: 60,
		primaryOrgan: "liver",
		excretionOrgan: "bile",
		color: "#D62828",
		bodyAffinity: { bloodstream: 1.2, liver: 0.9, kidney: 0.4, tumor: 1.0 },
		adverseEffects: [
			{ key: "nausea", label: "Nausea and vomiting", rule: "acute" },
			{ key: "myelosuppression", label: "Myelosuppression", rule: "marrow" },
			{ key: "cardiotoxicity", label: "Cardiotoxicity", rule: "cardiac" },
		],
		infusionHours: 1,
		description: "Anthracycline that intercalates DNA. "
			+ "Biphasic elimination: rapid distribution (5 min) then slow terminal (30 hr). "
			+ "Cardiotoxicity risk.",
	},
	cisplatin: {
		id: "cisplatin",
		name: "Cisplatin",
		abbreviation: "CDDP",
		compartments: 2,
		halfLifeMinutes: null,
		halfLifeAlphaMinutes: 25,
		halfLifeBetaMinutes: 4320,
		vdLPerKg: 0.5,
		typicalDoseMgM2: 75,
		primaryOrgan: "kidney",
		excretionOrgan: "kidney",
		color: "#1B9AAA",
		bodyAffinity: { bloodstream: 1.0, liver: 0.5, kidney: 1.1, tumor: 0.9 },
		adverseEffects: [
			{ key: "nausea", label: "Nausea and vomiting", rule: "acute" },
			{ key: "kidney_injury", label: "Kidney injury", rule: "renal" },
			{ key: "neuropathy", label: "Peripheral neuropathy", rule: "neuro" },
		],
		infusionHours: 2,
		description: "Platinum-based alkylating agent that crosslinks DNA. "
			+ "Free drug clears in ~25 min, protein-bound platinum persists for days.",
	},
	methotrexate: {
		id: "methotrexate",
		name: "Methotrexate",
		abbreviation: "MTX",
		compartments: 1,
		halfLifeMinutes: 480,
		halfLifeAlphaMinutes: null,
		halfLifeBetaMinutes: null,
		vdLPerKg: 0.8,
		typicalDoseMgM2: 40,
		primaryOrgan: "kidney",
		excretionOrgan: "kidney",
		color: "#6A4C93",
		bodyAffinity: { bloodstream: 0.9, liver: 0.5, kidney: 1.2, tumor: 0.85 },
		adverseEffects: [
			{ key: "mucositis", label: "Mucositis", rule: "mucositis" },
			{ key: "kidney_injury", label: "Kidney injury", rule: "renal" },
			{ key: "myelosuppression", label: "Myelosuppression", rule: "marrow" },
		],
		infusionHours: 0.5,
		description: "Antifolate that inhibits DHFR. "
			+ "Primarily eliminated unchanged by kidneys (80-90% in 24 hr).",
	},
	cyclophosphamide: {
		id: "cyclophosphamide",
		name: "Cyclophosphamide",
		abbreviation: "CPA",
		compartments: 1,
		halfLifeMinutes: 360,
		halfLifeAlphaMinutes: null,
		halfLifeBetaMinutes: null,
		vdLPerKg: 0.6,
		typicalDoseMgM2: 750,
		primaryOrgan: "liver",
		excretionOrgan: "kidney",
		color: "#E07A5F",
		bodyAffinity: { bloodstream: 1.0, liver: 1.1, kidney: 0.6, tumor: 0.9 },
		adverseEffects: [
			{ key: "nausea", label: "Nausea and vomiting", rule: "acute" },
			{ key: "myelosuppression", label: "Myelosuppression", rule: "marrow" },
			{ key: "hemorrhagic_cystitis", label: "Hemorrhagic cystitis", rule: "renal" },
		],
		infusionHours: 1,
		description: "Nitrogen mustard prodrug activated by hepatic P450. "
			+ "Half-life ~6 hours.",
	},
	bleomycin: {
		id: "bleomycin",
		name: "Bleomycin",
		abbreviation: "BLEO",
		compartments: 1,
		halfLifeMinutes: 120,
		halfLifeAlphaMinutes: null,
		halfLifeBetaMinutes: null,
		vdLPerKg: 0.29,
		typicalDoseMgM2: 10,
		primaryOrgan: "kidney",
		excretionOrgan: "kidney",
		color: "#2B7A78",
		bodyAffinity: { bloodstream: 1.0, liver: 0.5, kidney: 1.1, tumor: 0.8 },
		adverseEffects: [
			{ key: "pulmonary_toxicity", label: "Pulmonary toxicity", rule: "pulmonary" },
			{ key: "fever", label: "Fever", rule: "acute" },
			{ key: "skin_reaction", label: "Skin reaction", rule: "cumulative" },
		],
		infusionHours: 0.75,
		description: "Glycopeptide antibiotic causing DNA strand breaks. "
			+ "Half-life ~2 hours. Cumulative pulmonary toxicity is dose-limiting.",
	},
	vinblastine: {
		id: "vinblastine",
		name: "Vinblastine",
		abbreviation: "VBL",
		compartments: 1,
		halfLifeMinutes: 1440,
		halfLifeAlphaMinutes: null,
		halfLifeBetaMinutes: null,
		vdLPerKg: 0.26,
		typicalDoseMgM2: 6,
		primaryOrgan: "liver",
		excretionOrgan: "bile",
		color: "#8A5CF5",
		bodyAffinity: { bloodstream: 0.9, liver: 0.6, kidney: 0.4, tumor: 1.15 },
		adverseEffects: [
			{ key: "neuropathy", label: "Peripheral neuropathy", rule: "neuro" },
			{ key: "constipation", label: "Constipation", rule: "cumulative" },
			{ key: "myelosuppression", label: "Myelosuppression", rule: "marrow" },
		],
		infusionHours: 0.5,
		description: "Vinca alkaloid that inhibits microtubule assembly. "
			+ "Half-life ~24 hours. Hepatic metabolism, biliary excretion.",
	},
	dacarbazine: {
		id: "dacarbazine",
		name: "Dacarbazine",
		abbreviation: "DTIC",
		compartments: 1,
		halfLifeMinutes: 300,
		halfLifeAlphaMinutes: null,
		halfLifeBetaMinutes: null,
		vdLPerKg: 0.37,
		typicalDoseMgM2: 375,
		primaryOrgan: "liver",
		excretionOrgan: "kidney",
		color: "#EF8D32",
		bodyAffinity: { bloodstream: 1.1, liver: 0.8, kidney: 0.9, tumor: 0.7 },
		adverseEffects: [
			{ key: "nausea", label: "Nausea and vomiting", rule: "acute" },
			{ key: "myelosuppression", label: "Myelosuppression", rule: "marrow" },
			{ key: "fatigue", label: "Fatigue", rule: "fatigue" },
		],
		infusionHours: 1.5,
		description: "Alkylating agent requiring hepatic activation. "
			+ "Half-life ~5 hours.",
	},
	oxaliplatin: {
		id: "oxaliplatin",
		name: "Oxaliplatin",
		abbreviation: "OXAL",
		compartments: 2,
		halfLifeMinutes: null,
		halfLifeAlphaMinutes: 15,
		halfLifeBetaMinutes: 1080,
		vdLPerKg: 0.26,
		typicalDoseMgM2: 85,
		primaryOrgan: "kidney",
		excretionOrgan: "kidney",
		color: "#3566C6",
		bodyAffinity: { bloodstream: 1.0, liver: 0.7, kidney: 0.8, tumor: 0.95 },
		adverseEffects: [
			{ key: "neuropathy", label: "Peripheral neuropathy", rule: "neuro" },
			{ key: "nausea", label: "Nausea and vomiting", rule: "acute" },
			{ key: "kidney_injury", label: "Kidney injury", rule: "renal" },
		],
		infusionHours: 2,
		description: "Platinum-based alkylating agent. "
			+ "Biphasic: rapid initial phase (15 min), prolonged terminal (18 hr).",
	},
	leucovorin: {
		id: "leucovorin",
		name: "Leucovorin",
		abbreviation: "LV",
		compartments: 1,
		halfLifeMinutes: 360,
		halfLifeAlphaMinutes: null,
		halfLifeBetaMinutes: null,
		vdLPerKg: 0.31,
		typicalDoseMgM2: 200,
		primaryOrgan: "liver",
		excretionOrgan: "kidney",
		color: "#5BA36E",
		bodyAffinity: { bloodstream: 0.85, liver: 0.6, kidney: 0.7, tumor: 0.6 },
		adverseEffects: [
			{ key: "fatigue", label: "Fatigue", rule: "fatigue" },
			{ key: "nausea", label: "Nausea and vomiting", rule: "acute" },
		],
		infusionHours: 2,
		description: "Reduced folate that enhances 5-FU efficacy. "
			+ "Half-life ~6 hours. Primarily renally excreted.",
	},
};

// Ordered list of drug keys for UI rendering
var DRUG_KEYS = [
	"fluorouracil", "doxorubicin", "cisplatin", "methotrexate",
	"cyclophosphamide", "bleomycin", "vinblastine", "dacarbazine",
	"oxaliplatin", "leucovorin",
];

// ============================================
// Chemotherapy regimen presets
// Source doses in doseMgM2, converted to mg at dose-event build time using current BSA
var REGIMEN_PRESETS = {
	abvd: {
		id: "abvd",
		name: "ABVD",
		subtitle: "Hodgkin lymphoma teaching preset",
		indication: "Hodgkin lymphoma teaching preset",
		efficacyWeight: 1.15,
		acuteToxicityWeight: 1.00,
		cumulativeToxicityWeight: 0.95,
		recoveryPenalty: 1.00,
		volatility: 1.05,
		therapeuticWindow: {
			ineffectiveMax: 1.8,
			toxicMin: 14,
		},
		tumorSite: {
			key: "mediastinum",
			label: "Mediastinal mass",
			cx: 214,
			cy: 170,
			labelX: 304,
			labelY: 172,
			lineToX: 286,
			lineToY: 168,
		},
		cycleDays: 28,
		drugKeys: ["doxorubicin", "bleomycin", "vinblastine", "dacarbazine"],
		drugs: [
			{ drugKey: "doxorubicin", doseMgM2: 25 },
			{ drugKey: "bleomycin", doseMgM2: 10 },
			{ drugKey: "vinblastine", doseMgM2: 6 },
			{ drugKey: "dacarbazine", doseMgM2: 375 },
		],
		primaryDrug: "doxorubicin",
		// dose days within each cycle (0-indexed from cycle start)
		doseDays: [0, 14],
		description: "Doxorubicin, Bleomycin, Vinblastine, Dacarbazine. "
			+ "Standard first-line for classical Hodgkin lymphoma. "
			+ "Given on days 1 and 15 of 28-day cycle.",
		teachingNotes: [
			"Multiple agents are introduced early, so the combined concentration burden spikes quickly.",
			"Bleomycin clears faster than doxorubicin, which makes late-cycle exposure profiles diverge.",
			"The tumor channel stays elevated longer when tissue affinity is high, even as bloodstream levels fall.",
		],
		caseGoals: [
			"Reach remission without dropping vitality below 55%.",
			"Keep pulmonary toxicity out of red while preserving tumor response.",
		],
		warning: "Illustrative ABVD timing only. The values are generalized for teaching trends.",
	},
	folfox: {
		id: "folfox",
		name: "FOLFOX",
		subtitle: "Colorectal cancer teaching preset",
		indication: "Colorectal cancer teaching preset",
		efficacyWeight: 1.00,
		acuteToxicityWeight: 0.92,
		cumulativeToxicityWeight: 1.12,
		recoveryPenalty: 1.08,
		volatility: 0.92,
		therapeuticWindow: {
			ineffectiveMax: 1.5,
			toxicMin: 11,
		},
		tumorSite: {
			key: "colon_liver",
			label: "Colon / liver lesion",
			cx: 158,
			cy: 238,
			labelX: 28,
			labelY: 162,
			lineToX: 114,
			lineToY: 214,
		},
		cycleDays: 14,
		drugKeys: ["oxaliplatin", "leucovorin", "fluorouracil"],
		drugs: [
			{ drugKey: "fluorouracil", doseMgM2: 400 },
			{ drugKey: "oxaliplatin", doseMgM2: 85 },
			{ drugKey: "leucovorin", doseMgM2: 200 },
		],
		primaryDrug: "fluorouracil",
		doseDays: [0],
		description: "5-Fluorouracil, Oxaliplatin, Leucovorin. "
			+ "Standard adjuvant and first-line metastatic colorectal cancer regimen.",
		teachingNotes: [
			"Oxaliplatin peaks early, while 5-FU contributes a long tail from extended infusion.",
			"Leucovorin changes the combined exposure without dominating total burden.",
			"Long infusion windows flatten the curve and sustain tumor exposure longer than a bolus alone.",
		],
		caseGoals: [
			"Control tumor burden while avoiding sustained neuropathy.",
			"Stay within the therapeutic window for at least half the run.",
		],
		warning: "Illustrative FOLFOX timing only. The values are generalized for teaching trends.",
	},
	bep: {
		id: "bep",
		name: "BEP",
		subtitle: "Testicular cancer teaching preset",
		indication: "Testicular cancer teaching preset",
		efficacyWeight: 1.24,
		acuteToxicityWeight: 1.18,
		cumulativeToxicityWeight: 1.14,
		recoveryPenalty: 1.18,
		volatility: 1.18,
		therapeuticWindow: {
			ineffectiveMax: 2.4,
			toxicMin: 12.5,
		},
		tumorSite: {
			key: "testicular",
			label: "Testicular tumor",
			cx: 214,
			cy: 350,
			labelX: 286,
			labelY: 336,
			lineToX: 246,
			lineToY: 346,
		},
		cycleDays: 21,
		drugKeys: ["cisplatin", "bleomycin"],
		drugs: [
			{ drugKey: "cisplatin", doseMgM2: 20 },
			{ drugKey: "bleomycin", doseMgM2: 10 },
		],
		primaryDrug: "cisplatin",
		doseDays: [0, 7, 14],
		description: "Bleomycin, Etoposide, Cisplatin. "
			+ "First-line for testicular germ cell tumors.",
		teachingNotes: [
			"Cisplatin has a very long terminal half-life due to protein binding, maintaining low-level exposure for days.",
			"Bleomycin pulmonary toxicity is cumulative and dose-limiting in this regimen.",
			"Etoposide (not modeled) would add an intermediate-clearance drug to the profile.",
		],
		caseGoals: [
			"Drive a fast response without triggering red pulmonary toxicity.",
			"Preserve kidney function while keeping survival intact.",
		],
		warning: "Illustrative BEP timing only. The values are generalized for teaching trends.",
	},
	cmf: {
		id: "cmf",
		name: "CMF",
		subtitle: "Breast cancer teaching preset",
		indication: "Breast cancer teaching preset",
		efficacyWeight: 0.88,
		acuteToxicityWeight: 0.96,
		cumulativeToxicityWeight: 1.22,
		recoveryPenalty: 1.12,
		volatility: 0.86,
		therapeuticWindow: {
			ineffectiveMax: 1.3,
			toxicMin: 9.5,
		},
		tumorSite: {
			key: "breast",
			label: "Breast mass",
			cx: 228,
			cy: 182,
			labelX: 300,
			labelY: 146,
			lineToX: 270,
			lineToY: 172,
		},
		cycleDays: 28,
		drugKeys: ["cyclophosphamide", "methotrexate", "fluorouracil"],
		drugs: [
			{ drugKey: "cyclophosphamide", doseMgM2: 600 },
			{ drugKey: "methotrexate", doseMgM2: 40 },
			{ drugKey: "fluorouracil", doseMgM2: 600 },
		],
		primaryDrug: "cyclophosphamide",
		doseDays: [0, 7],
		description: "Cyclophosphamide, Methotrexate, 5-Fluorouracil. "
			+ "Classic breast cancer adjuvant regimen.",
		teachingNotes: [
			"Three drugs with different half-lives create a staggered clearance pattern.",
			"Cyclophosphamide is a prodrug activated by hepatic enzymes, so liver concentration is clinically important.",
			"Methotrexate requires monitoring of renal function due to kidney-dependent clearance.",
		],
		caseGoals: [
			"Shrink the tumor while maintaining marrow reserve.",
			"Avoid cumulative toxicity overwhelming recovery late in the run.",
		],
		warning: "Illustrative CMF timing only. The values are generalized for teaching trends.",
	},
};

// Ordered list of regimen keys for UI rendering
var REGIMEN_KEYS = ["abvd", "folfox", "bep", "cmf"];

// ============================================
// Backward-compatible CHEMO_CONSTANTS adapter
// Maps old structure used by game_state, chart, body_visual, ui_rendering
// Will be removed once all modules are migrated to DRUG_DATA / REGIMEN_PRESETS
var CHEMO_CONSTANTS = {
	// time step in hours for backward compat with pk_engine sample loop
	timeStepHours: SIM_DEFAULTS.timeStepMinutes / 60,
	// duration in hours
	defaultDurationHours: SIM_DEFAULTS.defaultDurationMinutes / 60,
	// visual channels for body rendering
	visualChannels: CHEMO_VIS_CHANNELS,
	// organ info for organ guide
	organInfo: CHEMO_ORGAN_INFO,
	caseTraits: CHEMO_CASE_TRAITS,
	// drugs map (same structure as DRUG_DATA, keyed by id)
	drugs: DRUG_DATA,
	// regimens array built from REGIMEN_PRESETS
	regimens: (function() {
		var result = [];
		var index;
		for (index = 0; index < REGIMEN_KEYS.length; index += 1) {
			var preset = REGIMEN_PRESETS[REGIMEN_KEYS[index]];
			result.push({
				id: preset.id,
				name: preset.name,
				subtitle: preset.subtitle,
				cycleHours: preset.cycleDays * 24,
				drugIds: preset.drugKeys,
				tumorSite: preset.tumorSite,
				therapeuticWindow: preset.therapeuticWindow,
				caseGoals: preset.caseGoals,
				teachingNotes: preset.teachingNotes,
				warning: preset.warning,
				// dose events generated dynamically in regimen_engine.js
				doseEvents: [],
			});
		}
		return result;
	})(),
};
