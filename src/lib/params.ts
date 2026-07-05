/**
 * PARAMS — single source of truth for all Phara-O Mini parameters.
 *
 * Data taken verbatim from the official Behringer Phara-O Mini MIDI
 * implementation chart. The UI panel is just a map over these arrays;
 * do not hardcode CC numbers or ranges anywhere else.
 *
 * The application is ONE-WAY (app -> synth). The hardware exposes neither
 * encoders nor a SysEx state dump, so the app cannot read the physical knob
 * positions. For every parameter the app controls, the app is authoritative:
 * you set a value in the UI, the UI displays it and sends it as MIDI CC.
 */

/** A continuous parameter: full 0-127 range, sent as a raw CC value. */
export type ContinuousParam = {
	kind: 'continuous';
	id: string;
	/** Panel label as printed on / near the hardware. */
	label: string;
	/** Original name from the MIDI implementation chart, for reference. */
	chartName: string;
	cc: number;
	min: 0;
	max: 127;
	/** Optional grouping for panel layout. */
	group: ParamGroup;
};

/** One selectable option of a stepped parameter. */
export type SteppedOption = {
	label: string;
	/**
	 * The CC value actually transmitted when this option is selected.
	 * For bands we send the MIDDLE of the band so ambiguous / overlapping
	 * boundaries are avoided (see Voice Mode note below).
	 */
	send: number;
	/** Inclusive lower bound of the band from the chart (for display/matching). */
	lo: number;
	/** Inclusive upper bound of the band from the chart (for display/matching). */
	hi: number;
};

/** A stepped parameter: choose from named options, each mapping to a CC value. */
export type SteppedParam = {
	kind: 'stepped';
	id: string;
	label: string;
	chartName: string;
	cc: number;
	options: SteppedOption[];
	group: ParamGroup;
};

/**
 * A parameter that exists on the hardware but is NOT controllable via this
 * chart's CC set. Rendered disabled in the UI with an explanatory note; never
 * sent. We do not guess NRPN numbers for these.
 */
export type UnavailableParam = {
	kind: 'unavailable';
	id: string;
	label: string;
	/** Why it can't be controlled, shown to the user. */
	note: string;
	group: ParamGroup;
};

export type Param = ContinuousParam | SteppedParam | UnavailableParam;

export type ParamGroup = 'VCO' | 'VCF' | 'EG' | 'LFO' | 'DELAY' | 'GLOBAL';

export const GROUP_LABELS: Record<ParamGroup, string> = {
	VCO: 'VCO — Oscillator',
	VCF: 'VCF — Filter',
	EG: 'EG — Envelope',
	LFO: 'LFO',
	DELAY: 'Delay',
	GLOBAL: 'Global'
};

const cont = (
	id: string,
	label: string,
	chartName: string,
	cc: number,
	group: ParamGroup
): ContinuousParam => ({
	kind: 'continuous',
	id,
	label,
	chartName,
	cc,
	min: 0,
	max: 127,
	group
});

/**
 * All continuous CC parameters (14 total), in chart order.
 */
export const CONTINUOUS_PARAMS: ContinuousParam[] = [
	cont('modulation', 'Modulation', 'Modulation', 1, 'GLOBAL'),
	cont('portamento', 'Portamento', 'Portamento', 5, 'GLOBAL'),
	cont('detune', 'Detune', 'Detune', 42, 'VCO'),
	cont('vco_env_mod', 'ENV MOD', 'VCO EG Modulation', 43, 'VCO'),
	cont('vcf_cutoff', 'Cutoff', 'VCF Cutoff', 44, 'VCF'),
	cont('vcf_env_mod', 'ENV MOD', 'VCF EG Modulation', 45, 'VCF'),
	cont('lfo_rate', 'Rate', 'LFO Rate', 46, 'LFO'),
	cont('lfo_vco_mod', 'VCO MOD', 'LFO Pitch Modulation', 47, 'LFO'),
	cont('lfo_vcf_mod', 'VCF MOD', 'LFO VCF Modulation', 48, 'LFO'),
	cont('eg_attack', 'Attack', 'EG Attack Time', 49, 'EG'),
	cont('eg_decay_release', 'Decay/Release', 'EG Decay/Release Time', 50, 'EG'),
	cont('eg_sustain', 'Sustain', 'EG Sustain Level', 51, 'EG'),
	cont('delay_time', 'Delay Time', 'Delay Time', 52, 'DELAY'),
	cont('delay_feedback', 'Delay Feedback', 'Delay Feedback', 53, 'DELAY')
];

/**
 * Stepped parameters. `send` is the middle of each band from the chart.
 *
 * Voice Mode note: the official chart lists 88-112 (Unison Ring Modulation)
 * and 112-127 (Poly Ring Modulation) as overlapping on 112. We sidestep the
 * ambiguity by transmitting the band middle: Unison Ring = 100, Poly Ring = 120.
 */
export const STEPPED_PARAMS: SteppedParam[] = [
	{
		kind: 'stepped',
		id: 'voice_mode',
		label: 'Voice Mode',
		chartName: 'Voice Mode',
		cc: 40,
		group: 'GLOBAL',
		options: [
			{ label: 'Poly', lo: 0, hi: 12, send: 6 },
			{ label: 'Unison', lo: 13, hi: 37, send: 25 },
			{ label: 'Octave', lo: 38, hi: 62, send: 50 },
			{ label: 'Fifth', lo: 63, hi: 87, send: 75 },
			{ label: 'Unison Ring Mod', lo: 88, hi: 112, send: 100 },
			{ label: 'Poly Ring Mod', lo: 112, hi: 127, send: 120 }
		]
	},
	{
		kind: 'stepped',
		id: 'scale',
		label: 'Scale',
		chartName: 'Scale',
		cc: 41,
		group: 'VCO',
		options: [
			{ label: "32'", lo: 0, hi: 21, send: 10 },
			{ label: "16'", lo: 22, hi: 43, send: 32 },
			{ label: "8'", lo: 44, hi: 65, send: 54 },
			{ label: "4'", lo: 66, hi: 87, send: 76 },
			{ label: "2'", lo: 88, hi: 109, send: 98 },
			{ label: "1'", lo: 110, hi: 127, send: 118 }
		]
	}
];

/**
 * Parameters present on the hardware but not addressable via this chart's CC
 * set. Shown disabled so the user knows to reach for the physical knob.
 */
export const UNAVAILABLE_PARAMS: UnavailableParam[] = [
	{
		kind: 'unavailable',
		id: 'resonance',
		label: 'Resonance',
		note: 'No CC in the official chart. Manufacturer mentions NRPN but numbers are unknown — control on the hardware.',
		group: 'VCF'
	},
	{
		kind: 'unavailable',
		id: 'dry_wet',
		label: 'Dry/Wet',
		note: 'No CC in the official chart. Manufacturer mentions NRPN but numbers are unknown — control on the hardware.',
		group: 'DELAY'
	},
	{
		kind: 'unavailable',
		id: 'tempo',
		label: 'Tempo',
		note: 'Not a CC — driven over MIDI clock. Clock generation is planned for a later phase.',
		group: 'GLOBAL'
	}
];

/** Every parameter, useful for iteration / lookups. */
export const ALL_PARAMS: Param[] = [
	...CONTINUOUS_PARAMS,
	...STEPPED_PARAMS,
	...UNAVAILABLE_PARAMS
];

/** Fast id -> param lookup. */
export const PARAM_BY_ID: Record<string, Param> = Object.fromEntries(
	ALL_PARAMS.map((p) => [p.id, p])
);

/** The ids of every parameter this app actually controls (continuous + stepped). */
export const CONTROLLABLE_IDS: string[] = [
	...CONTINUOUS_PARAMS.map((p) => p.id),
	...STEPPED_PARAMS.map((p) => p.id)
];

/** Group ordering used for panel layout. */
export const GROUP_ORDER: ParamGroup[] = ['VCO', 'VCF', 'EG', 'LFO', 'DELAY', 'GLOBAL'];
