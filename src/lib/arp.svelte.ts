/**
 * Arpeggiator — turns the currently held notes (from the note-source layer)
 * into a figure played one note at a time, synced to the transport clock.
 *
 * Like the sequencer, it is a `TickConsumer` of `transport.svelte.ts`: notes
 * are scheduled ahead of time off the look-ahead clock (Note On + gated Note
 * Off), so timing does not depend on JS timer precision. Turning the arp on
 * (selecting it as the note generator) starts that clock, so held keys
 * arpeggiate immediately — there is no separate play button, like on hardware.
 *
 * While the arp is on it OWNS the held notes: the note-source layer captures
 * note-ons instead of playing them straight to the synth, otherwise every key
 * would sound twice (once held, once arpeggiated). See `setCaptureGate` in
 * `noteSource.svelte.ts`.
 *
 * The arp does not own an "enabled" flag itself — whether it's active comes
 * from the shared `noteGenerator` selector (`noteGenerator.svelte.ts`), which
 * also makes it mutually exclusive with the step sequencer.
 *
 * State fields are Svelte 5 runes so the control panel stays reactive. `notes`
 * is reassigned (not mutated) on every change so reactivity fires; its Map
 * insertion order doubles as the "as played" order.
 */

import { transport, PPQN, type TickConsumer } from './transport.svelte';
import { midi } from './midi.svelte';
import { noteSources } from './noteSource.svelte';
import { noteGenerator } from './noteGenerator.svelte';

export type ArpMode = 'up' | 'down' | 'updown' | 'downup' | 'asplayed' | 'random';

export const ARP_MODES: { id: ArpMode; label: string }[] = [
	{ id: 'up', label: 'Up' },
	{ id: 'down', label: 'Down' },
	{ id: 'updown', label: 'Up/Down' },
	{ id: 'downup', label: 'Down/Up' },
	{ id: 'asplayed', label: 'As played' },
	{ id: 'random', label: 'Random' }
];

/** Rate choices, expressed in 24-PPQN ticks per arp step. */
export const ARP_DIVISIONS = [
	{ label: '1/4', ticksPerStep: 24 },
	{ label: '1/8', ticksPerStep: 12 },
	{ label: '1/8T', ticksPerStep: 8 },
	{ label: '1/16', ticksPerStep: 6 },
	{ label: '1/32', ticksPerStep: 3 }
] as const;

/** How the arp picks each note's velocity (velocity is audible on this synth). */
export type ArpVelocityMode = 'played' | 'fixed' | 'accent';

export { MAX_SWING } from './transport.svelte';

type ArpNote = { note: number; vel: number };

class Arpeggiator implements TickConsumer {
	mode = $state<ArpMode>('up');
	ticksPerStep = $state(6); // 1/16 notes
	/** Repeat the figure this many octaves up (1 = just as held). */
	octaves = $state(1);
	/** Note length as a fraction of the arp step (staccato ↔ legato). */
	gate = $state(0.5);
	/** Keep playing after keys are released; a fresh press replaces the set. */
	latch = $state(false);
	/** Delay of every 2nd step as a fraction of a step (0 = straight). */
	swing = $state(0);
	velocityMode = $state<ArpVelocityMode>('played');
	/** Level used by 'fixed' (every note) and 'accent' (on-beat notes). */
	velocity = $state(100);

	/** The arpeggiated set: note → velocity, in the order the keys were played. */
	notes = $state<Map<number, number>>(new Map());
	/** Note scheduled most recently, for the UI; -1 when idle. */
	currentNote = $state(-1);

	/** Position in the figure; advances every step, resets when the set empties. */
	#pos = 0;
	/** Keys physically down right now — distinct from `notes` when latched. */
	#physicallyHeld = new Set<number>();

	constructor() {
		transport.subscribe(this);
		noteSources.subscribe({
			onNoteOn: (note, velocity) => this.#noteOn(note, velocity),
			onNoteOff: (note) => this.#noteOff(note)
		});
		// While on, the arp owns the notes — stop the direct play-thru.
		noteSources.setCaptureGate(() => this.enabled);
		noteGenerator.register('arp', {
			onActivate: () => this.#onActivate(),
			onDeactivate: () => this.#onDeactivate()
		});
	}

	/** True when the arp is the selected note generator (see noteGenerator.svelte.ts). */
	get enabled(): boolean {
		return noteGenerator.active === 'arp';
	}

	/** Milliseconds per arp step at the current tempo + rate. */
	get stepMs(): number {
		return transport.tickMs * this.ticksPerStep;
	}

	#onActivate() {
		this.#pos = 0;
		// Keys already sounding via direct play-thru would double the arp.
		for (const n of noteSources.held.keys()) midi.sendNoteOff(n);
	}

	#onDeactivate() {
		this.#pos = 0;
		this.currentNote = -1;
		// Hand physically held keys back to direct play so they keep sounding.
		// (Runs after the transport stopped + silenced everything, so these
		// note-ons survive.)
		for (const [n, v] of noteSources.held) midi.sendNoteOn(n, v);
	}

	setLatch(on: boolean) {
		this.latch = on;
		if (on) return;
		// Latch off: drop everything that isn't physically held any more.
		const next = new Map<number, number>();
		for (const [n, v] of this.notes) if (this.#physicallyHeld.has(n)) next.set(n, v);
		this.notes = next;
		if (next.size === 0) {
			this.#pos = 0;
			this.currentNote = -1;
		}
	}

	/** Forget all notes (Panic). The synth silencing is the caller's job. */
	clear() {
		this.notes = new Map();
		this.#physicallyHeld.clear();
		this.#pos = 0;
		this.currentNote = -1;
	}

	// --- note source events ----------------------------------------------------

	#noteOn(note: number, velocity: number) {
		// A fresh press after everything was released replaces a latched set.
		if (this.latch && this.#physicallyHeld.size === 0) this.notes = new Map();
		this.#physicallyHeld.add(note);
		const next = new Map(this.notes);
		next.set(note, velocity);
		this.notes = next;
	}

	#noteOff(note: number) {
		this.#physicallyHeld.delete(note);
		if (this.latch || !this.notes.has(note)) return;
		const next = new Map(this.notes);
		next.delete(note);
		this.notes = next;
		if (next.size === 0) {
			this.#pos = 0;
			this.currentNote = -1;
		}
	}

	// --- TickConsumer ------------------------------------------------------------

	onStart() {
		this.#pos = 0;
		// Steal keys sounding via direct play-thru so the arp starts from silence.
		if (this.enabled) {
			for (const n of noteSources.held.keys()) midi.sendNoteOff(n);
		}
	}

	onTick(tick: number, time: number) {
		if (!this.enabled) return;
		if (tick % this.ticksPerStep !== 0) return; // only act on step boundaries
		const seq = this.#sequence();
		if (seq.length === 0) {
			this.#pos = 0;
			this.currentNote = -1;
			return;
		}
		const stepIdx = Math.floor(tick / this.ticksPerStep);
		const idx =
			this.mode === 'random' ? Math.floor(Math.random() * seq.length) : this.#pos % seq.length;
		this.#pos++;
		const { note, vel } = seq[idx];

		let v = vel;
		if (this.velocityMode === 'fixed') {
			v = this.velocity;
		} else if (this.velocityMode === 'accent') {
			// Full level on quarter-note beats, softer in between.
			v = tick % PPQN === 0 ? this.velocity : Math.max(1, Math.round(this.velocity * 0.6));
		}

		const stepMs = this.stepMs;
		const swingMs = stepIdx % 2 === 1 ? this.swing * stepMs : 0;
		const t = time + swingMs;
		// Keep a small gap before the next step so same-pitch notes retrigger
		// cleanly; a swung note has less room until the (straight) next step.
		const gateMs = Math.max(10, Math.min(this.gate * stepMs, stepMs - swingMs - 4));
		midi.sendNoteOn(note, v, t);
		midi.sendNoteOff(note, t + gateMs);
		this.currentNote = note;
	}

	onStop() {
		this.#pos = 0;
		this.currentNote = -1;
		// Self-sufficient silence (the sequencer does the same; both are harmless).
		midi.clearScheduled();
		midi.allNotesOff();
	}

	// --- figure --------------------------------------------------------------

	/** Held notes sorted low→high, repeated across the octave range. */
	#expandedUp(): ArpNote[] {
		const base = [...this.notes.entries()].sort((a, b) => a[0] - b[0]);
		return this.#expand(base);
	}

	#expand(base: [number, number][]): ArpNote[] {
		const out: ArpNote[] = [];
		for (let o = 0; o < this.octaves; o++) {
			for (const [note, vel] of base) {
				const n = note + 12 * o;
				if (n <= 127) out.push({ note: n, vel });
			}
		}
		return out;
	}

	/** The full figure for the current mode (random picks from the 'up' pool). */
	#sequence(): ArpNote[] {
		switch (this.mode) {
			case 'up':
			case 'random':
				return this.#expandedUp();
			case 'down':
				return this.#expandedUp().reverse();
			case 'updown': {
				const up = this.#expandedUp();
				return up.concat(up.slice(1, -1).reverse()); // C E G → C E G E
			}
			case 'downup': {
				const down = this.#expandedUp().reverse();
				return down.concat(down.slice(1, -1).reverse());
			}
			case 'asplayed':
				return this.#expand([...this.notes.entries()]);
		}
	}
}

/** Singleton arpeggiator for the page. */
export const arp = new Arpeggiator();
