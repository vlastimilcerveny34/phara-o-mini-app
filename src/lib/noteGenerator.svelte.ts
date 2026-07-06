/**
 * Which note generator is currently active: the step sequencer, the
 * arpeggiator, or neither. They are mutually exclusive — both write notes for
 * a single mono voice, so running two at once would just have them fight over
 * it. This is the single source of truth both panels' On/Off buttons
 * read/write, instead of each generator owning its own "enabled" toggle and
 * reaching into the other's state to turn it off.
 *
 * The transport clock is NOT a user-facing concept (the hardware has no clock
 * button either — it just runs at a tempo). Selecting a generator here starts
 * the clock, deselecting stops it; MIDI clock is sent to the synth for exactly
 * as long as something is playing.
 */

import { transport } from './transport.svelte';

export type NoteGeneratorKind = 'off' | 'sequencer' | 'arp';

type GeneratorHooks = {
	/** This generator just became the active one. */
	onActivate?(): void;
	/** This generator just stopped being the active one. */
	onDeactivate?(): void;
};

class NoteGeneratorState {
	active = $state<NoteGeneratorKind>('off');

	#hooks: Partial<Record<Exclude<NoteGeneratorKind, 'off'>, GeneratorHooks>> = {};

	/** A generator registers its activate/deactivate side effects once, at construction. */
	register(kind: Exclude<NoteGeneratorKind, 'off'>, hooks: GeneratorHooks) {
		this.#hooks[kind] = hooks;
	}

	/** Picking the already-active one turns everything off; picking another switches directly. */
	select(kind: NoteGeneratorKind) {
		const next = this.active === kind ? 'off' : kind;
		if (next === this.active) return;
		const prev = this.active;
		this.active = next;
		// Stop first: silences the previous generator and resets the clock, so a
		// switch (seq → arp or back) restarts cleanly from tick 0 / step 1.
		transport.stop();
		if (prev !== 'off') this.#hooks[prev]?.onDeactivate?.();
		if (next !== 'off') {
			transport.start();
			this.#hooks[next]?.onActivate?.();
		}
	}
}

/** Singleton note-generator selector for the page. */
export const noteGenerator = new NoteGeneratorState();
