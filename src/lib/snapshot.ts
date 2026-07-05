/**
 * Snapshot / patch librarian.
 *
 * A snapshot captures the app-side value of every controllable parameter as a
 * plain JSON object and is saved/loaded as a downloaded/uploaded file — NO
 * browser storage. The point: the Phara-O has only 10 patch slots and does not
 * remember switch positions, so a file-based bank in the app is effectively an
 * unlimited sound library.
 */

import {
	CONTINUOUS_PARAMS,
	STEPPED_PARAMS,
	type SteppedParam
} from './params';
import { paramState } from './paramState.svelte';
import { midi } from './midi.svelte';

export const SNAPSHOT_FORMAT = 'phara-o-mini-snapshot';
export const SNAPSHOT_VERSION = 1;

export type Snapshot = {
	format: typeof SNAPSHOT_FORMAT;
	version: number;
	createdAt: string;
	name: string;
	/** Continuous param id -> value (0-127). */
	continuous: Record<string, number>;
	/** Stepped param id -> selected option index. */
	stepped: Record<string, number>;
};

/** Build a snapshot object from the current UI state. */
export function captureSnapshot(name = 'Untitled'): Snapshot {
	const continuous: Record<string, number> = {};
	for (const p of CONTINUOUS_PARAMS) continuous[p.id] = paramState.getContinuous(p.id);

	const stepped: Record<string, number> = {};
	for (const p of STEPPED_PARAMS) stepped[p.id] = paramState.getStepIndex(p.id);

	return {
		format: SNAPSHOT_FORMAT,
		version: SNAPSHOT_VERSION,
		createdAt: new Date().toISOString(),
		name: name.trim() || 'Untitled',
		continuous,
		stepped
	};
}

/** Trigger a browser download of the snapshot as a .json file. */
export function downloadSnapshot(snapshot: Snapshot) {
	const json = JSON.stringify(snapshot, null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${safeFileName(snapshot.name)}.snp`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

/** Parse + validate an uploaded JSON string into a Snapshot. Throws on bad input. */
export function parseSnapshot(text: string): Snapshot {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		throw new Error('File is not valid JSON.');
	}
	if (typeof data !== 'object' || data === null) {
		throw new Error('Snapshot must be a JSON object.');
	}
	const obj = data as Record<string, unknown>;
	// Friendlier guard: catch a sequencer pattern loaded into the patch slot.
	// (Literal mirrors PATTERN_FORMAT in sequencer.svelte.ts — kept inline to
	// avoid a circular import between the two modules.)
	if (obj.format === 'phara-o-mini-pattern') {
		throw new Error('This is a sequencer pattern (.seq), not a patch — load it in the Sequencer.');
	}
	if (obj.format !== SNAPSHOT_FORMAT) {
		throw new Error('This does not look like a Phara-O Mini patch.');
	}
	const continuous = coerceNumberMap(obj.continuous);
	const stepped = coerceNumberMap(obj.stepped);

	return {
		format: SNAPSHOT_FORMAT,
		version: typeof obj.version === 'number' ? obj.version : SNAPSHOT_VERSION,
		createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
		name: typeof obj.name === 'string' ? obj.name : 'Imported',
		continuous,
		stepped
	};
}

/**
 * Apply a snapshot: update the UI state AND send every value to the synth,
 * sequentially with a small gap so the MIDI buffer isn't flooded.
 * Returns the number of CC messages transmitted.
 */
export async function applySnapshot(snapshot: Snapshot, gapMs = 8): Promise<number> {
	const messages: { cc: number; value: number }[] = [];

	// Continuous params.
	for (const p of CONTINUOUS_PARAMS) {
		const raw = snapshot.continuous[p.id];
		if (typeof raw !== 'number') continue;
		const v = clamp7(raw);
		paramState.continuous[p.id] = v; // update UI without double-sending
		messages.push({ cc: p.cc, value: v });
	}

	// Stepped params (send the band middle for the stored option index).
	for (const p of STEPPED_PARAMS) {
		const idx = resolveStepIndex(p, snapshot.stepped[p.id]);
		paramState.stepped[p.id] = idx;
		messages.push({ cc: p.cc, value: p.options[idx].send });
	}

	const result = await midi.sendBatch(messages, gapMs);
	return result.sent;
}

function resolveStepIndex(param: SteppedParam, stored: unknown): number {
	if (typeof stored !== 'number') return 0;
	return Math.min(param.options.length - 1, Math.max(0, Math.round(stored)));
}

function coerceNumberMap(input: unknown): Record<string, number> {
	const out: Record<string, number> = {};
	if (typeof input !== 'object' || input === null) return out;
	for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
		if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
	}
	return out;
}

function clamp7(n: number): number {
	return Math.min(127, Math.max(0, Math.round(n)));
}

function safeFileName(name: string): string {
	return name.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '') || 'snapshot';
}
