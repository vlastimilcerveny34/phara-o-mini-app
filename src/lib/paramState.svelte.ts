/**
 * Reactive parameter state (Svelte 5 runes).
 *
 * Holds the app-authoritative value of every controllable parameter and is the
 * bridge to the MIDI service: setting a value here both updates the UI and
 * transmits the corresponding CC. Because the hardware can't report back, this
 * state IS the truth as far as the app is concerned.
 */

import { CONTINUOUS_PARAMS, STEPPED_PARAMS, type SteppedParam } from './params';
import { midi } from './midi.svelte';

/** Continuous values keyed by param id (0-127). */
const continuous = $state<Record<string, number>>(defaultContinuous());

/** Selected option index for each stepped param, keyed by param id. */
const stepped = $state<Record<string, number>>(defaultStepped());

function defaultContinuous(): Record<string, number> {
	const out: Record<string, number> = {};
	// Sensible neutral-ish defaults: everything at 0 except the filter open.
	for (const p of CONTINUOUS_PARAMS) out[p.id] = 0;
	if ('vcf_cutoff' in out) out['vcf_cutoff'] = 127;
	if ('eg_sustain' in out) out['eg_sustain'] = 127;
	return out;
}

function defaultStepped(): Record<string, number> {
	const out: Record<string, number> = {};
	for (const p of STEPPED_PARAMS) out[p.id] = 0; // first option
	return out;
}

export const paramState = {
	get continuous() {
		return continuous;
	},
	get stepped() {
		return stepped;
	},

	/** Read a continuous value. */
	getContinuous(id: string): number {
		return continuous[id] ?? 0;
	},

	/** Set a continuous value and transmit its CC. */
	setContinuous(id: string, value: number) {
		const param = CONTINUOUS_PARAMS.find((p) => p.id === id);
		if (!param) return;
		const v = Math.min(127, Math.max(0, Math.round(value)));
		continuous[id] = v;
		midi.sendCC(param.cc, v);
	},

	/** Read the selected option index of a stepped param. */
	getStepIndex(id: string): number {
		return stepped[id] ?? 0;
	},

	/** Set a stepped param by option index and transmit its (band-middle) CC. */
	setStep(id: string, optionIndex: number) {
		const param = STEPPED_PARAMS.find((p) => p.id === id);
		if (!param) return;
		const idx = Math.min(param.options.length - 1, Math.max(0, optionIndex));
		stepped[id] = idx;
		midi.sendCC(param.cc, param.options[idx].send);
	},

	/** The transmitted CC value for a stepped param's current selection. */
	getStepSend(param: SteppedParam): number {
		const idx = stepped[param.id] ?? 0;
		return param.options[idx].send;
	}
};
