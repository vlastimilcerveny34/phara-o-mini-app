/**
 * Step sequencer (phase 2) — monophonic.
 *
 * The app itself is the sequencer: it sends MIDI Note On/Off timed off the
 * transport's look-ahead scheduler (see `transport.svelte.ts`). This works
 * regardless of the synth's clock source — it only needs MIDI Rx = ON. Polyphony
 * and per-step parameter locks are planned follow-ups.
 *
 * State fields are Svelte 5 runes so the editor stays reactive.
 */

import { transport, type TickConsumer } from './transport.svelte';
import { midi } from './midi.svelte';

export const MAX_STEPS = 16;
export const MIN_NOTE = 24; // C1
export const MAX_NOTE = 96; // C7
export const DEFAULT_NOTE = 60; // C4 (middle C)

/** One monophonic step. */
export type Step = {
	/** Whether the step fires a note (off = rest). */
	on: boolean;
	/** MIDI note number 0-127. */
	note: number;
	/** Note-on velocity 1-127. */
	velocity: number;
	/** Gate length as a fraction of the step (0.05-1.0). */
	gate: number;
};

/** Step resolution choices, expressed in 24-PPQN ticks per step. */
export const DIVISIONS = [
	{ label: '1/8', ticksPerStep: 12 },
	{ label: '1/16', ticksPerStep: 6 },
	{ label: '1/32', ticksPerStep: 3 }
] as const;

export const PATTERN_FORMAT = 'phara-o-mini-pattern';
export const PATTERN_VERSION = 1;

export type PatternFile = {
	format: typeof PATTERN_FORMAT;
	version: number;
	createdAt: string;
	name: string;
	length: number;
	ticksPerStep: number;
	steps: Step[];
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI note number → name like "C4" (middle C = 60). */
export function noteName(n: number): string {
	return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
}

function makeStep(on = false, note = DEFAULT_NOTE): Step {
	return { on, note, velocity: 100, gate: 0.5 };
}

/** A gentle default so the very first Play does something audible. */
function defaultSteps(): Step[] {
	return Array.from({ length: MAX_STEPS }, (_, i) => makeStep(i % 4 === 0));
}

const clampNote = (n: number) => Math.min(MAX_NOTE, Math.max(MIN_NOTE, Math.round(n)));

class Sequencer implements TickConsumer {
	/** Always MAX_STEPS long; `length` decides how many actually play. */
	steps = $state<Step[]>(defaultSteps());
	length = $state(MAX_STEPS);
	ticksPerStep = $state(6); // 1/16 notes
	/** When false, the transport still runs (clock) but no notes are sent. */
	enabled = $state(true);
	/** Currently lit step for the playhead; -1 when stopped. */
	currentStep = $state(-1);

	constructor() {
		transport.subscribe(this);
	}

	/** Milliseconds per step at the current tempo + resolution. */
	get stepMs(): number {
		return transport.tickMs * this.ticksPerStep;
	}

	// --- editing -------------------------------------------------------------

	toggleStep(i: number) {
		this.steps[i].on = !this.steps[i].on;
	}

	nudgeNote(i: number, delta: number) {
		this.steps[i].note = clampNote(this.steps[i].note + delta);
	}

	setLength(n: number) {
		this.length = Math.min(MAX_STEPS, Math.max(1, Math.round(n)));
	}

	clearAll() {
		for (const s of this.steps) s.on = false;
	}

	// --- TickConsumer --------------------------------------------------------

	onStart() {
		this.currentStep = -1;
	}

	onTick(tick: number, time: number) {
		if (!this.enabled) return;
		if (tick % this.ticksPerStep !== 0) return; // only act on step boundaries
		const index = Math.floor(tick / this.ticksPerStep) % this.length;
		this.currentStep = index;
		this.#playStep(index, time);
	}

	onStop() {
		this.currentStep = -1;
		// Cancel any note-on/off already scheduled ahead, then silence everything.
		midi.clearScheduled();
		midi.allNotesOff();
	}

	#playStep(index: number, time: number) {
		const step = this.steps[index];
		if (!step || !step.on) return;
		midi.sendNoteOn(step.note, step.velocity, time);
		// Keep a small gap before the next step so same-pitch notes retrigger cleanly.
		const gateMs = Math.min(step.gate * this.stepMs, this.stepMs - 4);
		midi.sendNoteOff(step.note, time + Math.max(10, gateMs));
	}

	// --- serialization -------------------------------------------------------

	serialize(name: string): PatternFile {
		return {
			format: PATTERN_FORMAT,
			version: PATTERN_VERSION,
			createdAt: new Date().toISOString(),
			name: name.trim() || 'Untitled',
			length: this.length,
			ticksPerStep: this.ticksPerStep,
			steps: this.steps.map((s) => ({ ...s }))
		};
	}

	load(file: PatternFile) {
		this.length = Math.min(MAX_STEPS, Math.max(1, Math.round(file.length)));
		this.ticksPerStep = DIVISIONS.some((d) => d.ticksPerStep === file.ticksPerStep)
			? file.ticksPerStep
			: 6;
		// Rebuild a full-length step array, tolerating short/partial files.
		this.steps = Array.from({ length: MAX_STEPS }, (_, i) => {
			const s = file.steps[i];
			if (!s) return makeStep();
			return {
				on: Boolean(s.on),
				note: clampNote(typeof s.note === 'number' ? s.note : DEFAULT_NOTE),
				velocity: Math.min(127, Math.max(1, Math.round(s.velocity ?? 100))),
				gate: Math.min(1, Math.max(0.05, s.gate ?? 0.5))
			};
		});
	}
}

/** Singleton sequencer for the page. */
export const sequencer = new Sequencer();

/** Parse + validate an uploaded JSON string into a PatternFile. Throws on bad input. */
export function parsePattern(text: string): PatternFile {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		throw new Error('File is not valid JSON.');
	}
	if (typeof data !== 'object' || data === null) {
		throw new Error('Pattern must be a JSON object.');
	}
	const obj = data as Record<string, unknown>;
	// Friendlier guard: catch a patch loaded into the sequencer slot.
	// (Literal mirrors SNAPSHOT_FORMAT in snapshot.ts — kept inline to avoid a
	// circular import between the two modules.)
	if (obj.format === 'phara-o-mini-snapshot') {
		throw new Error('This is a patch (.snp), not a pattern — load it in the Snapshot Librarian.');
	}
	if (obj.format !== PATTERN_FORMAT) {
		throw new Error('This does not look like a Phara-O Mini pattern.');
	}
	const steps = Array.isArray(obj.steps) ? (obj.steps as Step[]) : [];
	return {
		format: PATTERN_FORMAT,
		version: typeof obj.version === 'number' ? obj.version : PATTERN_VERSION,
		createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
		name: typeof obj.name === 'string' ? obj.name : 'Imported',
		length: typeof obj.length === 'number' ? obj.length : MAX_STEPS,
		ticksPerStep: typeof obj.ticksPerStep === 'number' ? obj.ticksPerStep : 6,
		steps
	};
}

/** Trigger a browser download of a pattern as a .json file. */
export function downloadPattern(pattern: PatternFile) {
	const json = JSON.stringify(pattern, null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${safeFileName(pattern.name)}.seq`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

function safeFileName(name: string): string {
	return name.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '') || 'pattern';
}
