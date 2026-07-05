/**
 * Note sources — the shared layer between "things that play notes" (the on-screen
 * keyboard, an external MIDI input) and the synth.
 *
 * It tracks the set of currently HELD notes (regardless of where they came from)
 * and plays them to the synth. Held notes are the foundation the arpeggiator and
 * real-time sequencer recording will build on next.
 *
 * Behaviour:
 *  - Every source (on-screen keyboard and external MIDI input) plays straight to
 *    the synth — there is no monitor gate. (A DAW-style "monitor off" switch only
 *    makes sense once recording/arp exists, to avoid doubling notes; it will come
 *    back then.)
 *  - All output goes out on the app's selected synth channel (force-to-synth),
 *    because midi.sendNoteOn/Off always use midi.channel. So an external keyboard
 *    on any channel still reaches the synth.
 *  - The `source` tag is kept for future use (arp/record may treat inputs
 *    differently) but currently does not change behaviour.
 *
 * State fields are Svelte 5 runes so the keyboard UI stays reactive. `held` is
 * reassigned (not mutated in place) on every change so the reactivity fires.
 */

import { midi } from './midi.svelte';

export type NoteSourceKind = 'keyboard' | 'midi';

/**
 * Something that wants to observe notes as they are played (the sequencer's
 * record mode). Separate from monitoring — these fire regardless of whether the
 * synth is audible, and carry the played velocity.
 */
export type NotePlayConsumer = {
	onNoteOn?(note: number, velocity: number): void;
	onNoteOff?(note: number): void;
};

class NoteSources {
	/** note number -> velocity for every note currently held, from any source. */
	held = $state<Map<number, number>>(new Map());

	#unbindInput: (() => void) | null = null;
	#consumers = new Set<NotePlayConsumer>();

	constructor() {
		// Bridge the MIDI service's raw note events into this layer.
		this.#unbindInput = midi.onInputNote((ev) => {
			if (ev.type === 'on') this.noteOn(ev.note, ev.velocity, 'midi');
			else this.noteOff(ev.note, 'midi');
		});
	}

	/** Observe played notes (e.g. the sequencer recorder); returns unsubscribe. */
	subscribe(consumer: NotePlayConsumer): () => void {
		this.#consumers.add(consumer);
		return () => this.#consumers.delete(consumer);
	}

	noteOn(note: number, velocity: number, _source: NoteSourceKind) {
		const next = new Map(this.held);
		next.set(note, velocity);
		this.held = next;
		midi.sendNoteOn(note, velocity);
		for (const c of this.#consumers) c.onNoteOn?.(note, velocity);
	}

	noteOff(note: number, _source: NoteSourceKind) {
		if (this.held.has(note)) {
			const next = new Map(this.held);
			next.delete(note);
			this.held = next;
		}
		midi.sendNoteOff(note);
		for (const c of this.#consumers) c.onNoteOff?.(note);
	}

	/** Panic: forget all held notes and tell the synth to silence everything. */
	panic() {
		this.held = new Map();
		midi.allNotesOff();
	}
}

/** Singleton note-source layer for the page. */
export const noteSources = new NoteSources();
