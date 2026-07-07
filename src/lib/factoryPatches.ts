/**
 * Factory patch library — Init plus a small bank of ~10 classic starting sounds.
 *
 * Each patch sets every MIDI-controllable parameter (the 13 continuous CCs plus
 * Voice Mode and Scale) to give a predictable sound regardless of prior state.
 * Resonance and Dry/Wet are NOT MIDI-controllable on the Phara-O (absent from
 * the CC chart — see params.ts), so patches can't set them; tweak those on the
 * hardware to taste.
 *
 * Values are 0-127. Stepped params are option INDEXES:
 *   voice_mode: 0 Poly · 1 Unison · 2 Octave · 3 Fifth · 4 Unison Ring · 5 Poly Ring
 *   scale:      0 32' · 1 16' · 2 8' · 3 4' · 4 2' · 5 1'
 */

import { type Snapshot, SNAPSHOT_FORMAT, SNAPSHOT_VERSION } from './snapshot';

export type FactoryPatch = {
	name: string;
	description: string;
	continuous: Record<string, number>;
	stepped: Record<string, number>;
};

/** Every continuous param at 0, so each patch only spells out what it changes. */
const ZEROED = {
	detune: 0,
	portamento: 0,
	vco_env_mod: 0,
	vcf_cutoff: 0,
	vcf_env_mod: 0,
	lfo_rate: 0,
	lfo_vco_mod: 0,
	lfo_vcf_mod: 0,
	eg_attack: 0,
	eg_decay_release: 0,
	eg_sustain: 0,
	delay_time: 0,
	delay_feedback: 0
};

function patch(
	name: string,
	description: string,
	voiceMode: number,
	scale: number,
	over: Partial<typeof ZEROED>
): FactoryPatch {
	return {
		name,
		description,
		continuous: { ...ZEROED, ...over },
		stepped: { voice_mode: voiceMode, scale }
	};
}

/**
 * The neutral base to start editing a sound from — and the one-click way to
 * put the synth into a known state (the app is one-way, so this is the only
 * way UI and hardware ever agree). Rendered as a dedicated Init button in both
 * librarian UIs rather than living in the factory bank.
 */
export const INIT_PATCH: FactoryPatch = patch(
	'Init',
	'Neutral starting point — poly, filter open, full sustain, no effects.',
	0,
	2,
	{ vcf_cutoff: 127, eg_sustain: 127 }
);

export const FACTORY_PATCHES: FactoryPatch[] = [
	patch('Classic Bass', 'Punchy unison bass with a filter-envelope pluck.', 1, 1, {
		detune: 18,
		vcf_cutoff: 50,
		vcf_env_mod: 75,
		eg_decay_release: 38,
		eg_sustain: 25
	}),
	patch('Sub Bass', 'Deep, clean sub — filter low, no movement.', 1, 0, {
		vcf_cutoff: 32,
		eg_decay_release: 55,
		eg_sustain: 110
	}),
	patch('Saw Lead', 'Bright detuned lead with a touch of delay and glide.', 1, 2, {
		detune: 30,
		portamento: 15,
		vcf_cutoff: 78,
		vcf_env_mod: 30,
		eg_attack: 3,
		eg_decay_release: 60,
		eg_sustain: 100,
		delay_time: 40,
		delay_feedback: 35
	}),
	patch('Soft Pad', 'Slow swell, gentle LFO on the filter, spacious delay.', 0, 2, {
		detune: 22,
		vcf_cutoff: 62,
		vcf_env_mod: 20,
		lfo_rate: 25,
		lfo_vcf_mod: 18,
		eg_attack: 70,
		eg_decay_release: 90,
		eg_sustain: 100,
		delay_time: 70,
		delay_feedback: 45
	}),
	patch('Pluck Keys', 'Short percussive keys, zero sustain, rhythmic delay.', 0, 2, {
		detune: 10,
		vcf_cutoff: 70,
		vcf_env_mod: 55,
		eg_decay_release: 30,
		eg_sustain: 0,
		delay_time: 55,
		delay_feedback: 40
	}),
	patch('Brass Stab', 'Fat unison stab with envelope-driven bite.', 1, 2, {
		detune: 20,
		vco_env_mod: 10,
		vcf_cutoff: 60,
		vcf_env_mod: 60,
		eg_attack: 10,
		eg_decay_release: 55,
		eg_sustain: 80
	}),
	patch('Fifth Lead', 'Power-fifth voicing for a bold mono-style lead.', 3, 2, {
		detune: 12,
		portamento: 20,
		vcf_cutoff: 80,
		vcf_env_mod: 25,
		eg_attack: 2,
		eg_decay_release: 50,
		eg_sustain: 95,
		delay_time: 45,
		delay_feedback: 40
	}),
	patch('Octave Stack', 'Oscillators stacked in octaves — thick and open.', 2, 2, {
		detune: 8,
		vcf_cutoff: 75,
		vcf_env_mod: 20,
		eg_attack: 4,
		eg_decay_release: 60,
		eg_sustain: 100
	}),
	patch('Ring Bell', 'Metallic ring-mod bell with decaying tail and delay.', 4, 3, {
		detune: 40,
		vcf_cutoff: 85,
		vcf_env_mod: 45,
		eg_decay_release: 45,
		eg_sustain: 10,
		delay_time: 60,
		delay_feedback: 55
	}),
	patch('LFO Sweep', 'Sustained tone with a wide LFO filter sweep.', 0, 2, {
		detune: 15,
		vcf_cutoff: 55,
		lfo_rate: 35,
		lfo_vcf_mod: 70,
		eg_attack: 20,
		eg_decay_release: 80,
		eg_sustain: 100,
		delay_time: 50,
		delay_feedback: 40
	})
];

/** Wrap a factory patch as a Snapshot so it can go through applySnapshot(). */
export function factoryToSnapshot(p: FactoryPatch): Snapshot {
	return {
		format: SNAPSHOT_FORMAT,
		version: SNAPSHOT_VERSION,
		createdAt: new Date().toISOString(),
		name: p.name,
		continuous: p.continuous,
		stepped: p.stepped
	};
}
