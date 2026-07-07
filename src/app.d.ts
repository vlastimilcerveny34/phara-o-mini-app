// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Injected by vite.config.ts from package.json at build time.
	const __APP_VERSION__: string;

	// File System Access API (Chromium) — showSaveFilePicker is missing from
	// TypeScript's lib.dom; declare the slice we use (see files.ts).
	interface SaveFilePickerOptions {
		suggestedName?: string;
		/** Per-kind key Chrome uses to remember the last directory. */
		id?: string;
		types?: { description?: string; accept: Record<string, string[]> }[];
	}
	interface Window {
		showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
	}
}

export {};
