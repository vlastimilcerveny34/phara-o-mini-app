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

/** Trigger a browser download of `data` as pretty-printed JSON named `<name>.<ext>`. */
export function downloadJson(data: unknown, name: string, ext: string, fallbackName: string) {
	const json = JSON.stringify(data, null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${safeFileName(name, fallbackName)}.${ext}`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

function safeFileName(name: string, fallback: string): string {
	return name.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '') || fallback;
}
