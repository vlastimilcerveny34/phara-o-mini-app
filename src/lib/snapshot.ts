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
import { midi, clamp7 } from './midi.svelte';
import { SNAPSHOT_FORMAT, parseTaggedJson, downloadJson } from './files';

export { SNAPSHOT_FORMAT };
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

/** Trigger a browser download of the snapshot as a .snp (JSON) file. */
export function downloadSnapshot(snapshot: Snapshot) {
	downloadJson(snapshot, snapshot.name, 'snp', 'snapshot');
}

/** Parse + validate an uploaded JSON string into a Snapshot. Throws on bad input. */
export function parseSnapshot(text: string): Snapshot {
	const obj = parseTaggedJson(text, SNAPSHOT_FORMAT);
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

/**
 * Apply a snapshot and describe the outcome for the status line — shared by
 * both librarian UIs (SnapshotBar and the synth view's mini-librarian) so
 * their messages stay consistent.
 */
export async function applySnapshotWithReport(
	snapshot: Snapshot
): Promise<{ ok: boolean; text: string }> {
	const sent = await applySnapshot(snapshot); // no-ops on MIDI without a port
	return midi.isReady
		? { ok: true, text: `Loaded “${snapshot.name}” — sent ${sent} messages to the synth.` }
		: { ok: false, text: `Loaded “${snapshot.name}” into UI, but no MIDI port — nothing sent.` };
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

