/**
 * Transient status line ("Saved …", "File is not valid JSON.") shared by the
 * librarian-style panels. Each panel owns one instance; `flash` replaces the
 * message and restarts the auto-clear timer, so a second flash is no longer
 * cut short by the first one's timeout.
 */

export type FeedbackKind = 'ok' | 'bad';

export class Feedback {
	message = $state<{ kind: FeedbackKind; text: string } | null>(null);

	#timer: ReturnType<typeof setTimeout> | null = null;

	flash(kind: FeedbackKind, text: string, ms = 5000) {
		if (this.#timer !== null) clearTimeout(this.#timer);
		this.message = { kind, text };
		this.#timer = setTimeout(() => {
			this.message = null;
			this.#timer = null;
		}, ms);
	}
}
