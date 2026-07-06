/**
 * UI mode — the app has two complete, interchangeable views over the same
 * state: the original "parametric" layout (sliders + numeric readouts) and the
 * "synth" view (a one-screen faceplate with knobs, roughly laid out like the
 * hardware, keyboard at the bottom). Both drive the identical paramState /
 * sequencer / arp singletons, so switching is purely visual.
 *
 * Session-only on purpose — the app stores nothing in the browser (same rule
 * as patches/patterns, which are files).
 */

export type UiMode = 'parametric' | 'synth';

class UiModeState {
	/** Synth view is the default face of the app; parametric is the detail view. */
	mode = $state<UiMode>('synth');

	set(mode: UiMode) {
		this.mode = mode;
	}
}

/** Singleton UI-mode switch for the page. */
export const uiMode = new UiModeState();
