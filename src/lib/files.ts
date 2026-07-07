/**
 * Shared plumbing for the two JSON file formats the app saves/loads: patches
 * (.snp, see snapshot.ts) and sequencer patterns (.seq, see sequencer.svelte.ts).
 *
 * Both formats are plain JSON documents tagged with a `format` string. Keeping
 * the tags and the common download/parse code here lets the two modules stay
 * independent of each other (no circular import) while still giving a friendly
 * error when a file lands in the wrong loader.
 */

export const SNAPSHOT_FORMAT = 'phara-o-mini-snapshot';
export const PATTERN_FORMAT = 'phara-o-mini-pattern';

export type FileFormat = typeof SNAPSHOT_FORMAT | typeof PATTERN_FORMAT;

const KIND_LABEL: Record<FileFormat, string> = {
	[SNAPSHOT_FORMAT]: 'patch',
	[PATTERN_FORMAT]: 'pattern'
};

/**
 * Parse an uploaded JSON string and check its `format` tag. Throws a
 * user-facing Error on anything unexpected — including the friendly case of a
 * patch dropped into the pattern loader or vice versa.
 */
export function parseTaggedJson(text: string, expected: FileFormat): Record<string, unknown> {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		throw new Error('File is not valid JSON.');
	}
	if (typeof data !== 'object' || data === null) {
		throw new Error(`A ${KIND_LABEL[expected]} file must be a JSON object.`);
	}
	const obj = data as Record<string, unknown>;
	if (obj.format !== expected) {
		if (obj.format === PATTERN_FORMAT) {
			throw new Error('This is a sequencer pattern (.seq), not a patch — load it in the Sequencer.');
		}
		if (obj.format === SNAPSHOT_FORMAT) {
			throw new Error('This is a patch (.snp), not a pattern — load it in the Snapshot Librarian.');
		}
		throw new Error(`This does not look like a Phara-O Mini ${KIND_LABEL[expected]}.`);
	}
	return obj;
}

/**
 * Save `data` as pretty-printed JSON named `<name>.<ext>`.
 *
 * Uses the File System Access API's native "Save as" dialog where available
 * (Chromium — which the app effectively requires anyway, for Web MIDI). The
 * picker `id` makes the browser remember the last directory per file kind
 * (patches vs patterns) with no storage on our side. Falls back to a plain
 * download elsewhere or when the picker fails for any reason other than the
 * user cancelling.
 *
 * Returns false only when the user cancelled the dialog — callers should then
 * skip their "Saved" feedback.
 */
export async function saveJson(
	data: unknown,
	name: string,
	ext: string,
	fallbackName: string,
	pickerId: string
): Promise<boolean> {
	const json = JSON.stringify(data, null, 2);
	const fileName = `${safeFileName(name, fallbackName)}.${ext}`;

	if (window.showSaveFilePicker) {
		try {
			const handle = await window.showSaveFilePicker({
				suggestedName: fileName,
				id: pickerId,
				types: [{ description: 'Phara-O Mini JSON', accept: { 'application/json': [`.${ext}`] } }]
			});
			const writable = await handle.createWritable();
			await writable.write(json);
			await writable.close();
			return true;
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return false; // user cancelled
			// Anything else (permissions, weird target): fall through to the download.
		}
	}

	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
	return true;
}

/**
 * Open-file counterpart of saveJson: shows the native picker and returns the
 * file's text, or null when the user cancelled. The shared `pickerId` means
 * Load opens in the same remembered directory Save last used.
 *
 * Only call when `window.showOpenFilePicker` exists — callers keep their
 * hidden `<input type="file">` as the fallback path. Non-cancel errors throw;
 * the caller surfaces them like a parse failure.
 */
export async function openJson(ext: string, pickerId: string): Promise<string | null> {
	try {
		const [handle] = await window.showOpenFilePicker!({
			id: pickerId,
			types: [{ description: 'Phara-O Mini JSON', accept: { 'application/json': [`.${ext}`] } }]
		});
		return await handle.getFile().then((f) => f.text());
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') return null; // user cancelled
		throw err;
	}
}

function safeFileName(name: string, fallback: string): string {
	return name.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '') || fallback;
}
