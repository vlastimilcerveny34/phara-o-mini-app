/**
 * Mutate — nudge every continuous parameter by a small random offset, as a
 * sound-design spark. Repeated presses compound, so the button doubles as a
 * "random walk" through sound space (an explicit Randomize was deliberately
 * dropped: full-range random too often lands on silence — see ROADMAP.md).
 *
 * Stepped params (Voice Mode, Scale) are left alone: jumping voicing or
 * footage is a different sound, not a mutation of this one.
 *
 * Values are applied through paramState, so the UI updates and the CCs are
 * transmitted exactly like a manual knob move.
 */

import { CONTINUOUS_PARAMS } from './params';
import { paramState } from './paramState.svelte';

/** Default mutation strength: max offset per press, as a fraction of range. */
export const MUTATE_AMOUNT = 0.1;

/**
 * Audibility guardrails. A mutation must never leave the patch silent, and on
 * this synth silence has two doors: filter fully shut with no envelope to open
 * it, and an envelope with neither sustain nor decay. If a floor param and all
 * its rescuers end up below their thresholds together, the floor param is
 * pulled back up to its threshold.
 */
const AUDIBILITY_FLOORS: { id: string; min: number; rescuers: { id: string; min: number }[] }[] = [
	{ id: 'vcf_cutoff', min: 25, rescuers: [{ id: 'vcf_env_mod', min: 30 }] },
	{ id: 'eg_decay_release', min: 20, rescuers: [{ id: 'eg_sustain', min: 15 }] }
];

/** Triangular-distribution offset in [-max, +max] — small nudges more likely. */
function offset(max: number): number {
	return (Math.random() + Math.random() - 1) * max;
}

/**
 * Mutate the current patch in place: every continuous param moves by up to
 * ±`amount` of its range, then the audibility guardrails are applied.
 */
export function mutateParams(amount = MUTATE_AMOUNT) {
	const maxOffset = amount * 127;
	for (const p of CONTINUOUS_PARAMS) {
		paramState.setContinuous(p.id, paramState.getContinuous(p.id) + offset(maxOffset));
	}
	for (const floor of AUDIBILITY_FLOORS) {
		const rescued = floor.rescuers.some((r) => paramState.getContinuous(r.id) >= r.min);
		if (!rescued && paramState.getContinuous(floor.id) < floor.min) {
			paramState.setContinuous(floor.id, floor.min);
		}
	}
}
