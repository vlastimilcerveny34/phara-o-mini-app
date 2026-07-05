/**
 * Web MIDI service — the only place that talks to the MIDI subsystem.
 *
 * Responsibilities: request access, enumerate output ports, keep the chosen
 * port + channel, and send Control Change messages. The app is one-way
 * (app -> synth), so there is no input handling here by design.
 *
 * State fields are Svelte 5 runes, so components can read them directly and
 * stay reactive without any manual subscription.
 */

export type MidiStatus =
	| 'unsupported' // browser has no navigator.requestMIDIAccess
	| 'idle' // not yet requested
	| 'requesting'
	| 'denied' // user refused the permission prompt
	| 'ready' // access granted, ports enumerated
	| 'error';

export type MidiPort = {
	id: string;
	name: string;
	manufacturer: string;
};

/** Substring we look for to auto-select the Phara-O's port (case-insensitive). */
export const PHARAO_PORT_HINT = 'PHARA-O';

/**
 * Virtual/loopback ports we never want to offer as the synth output. On Linux,
 * ALSA always exposes a "Midi Through" port (Midi Through Port-0) that is not a
 * device — surfacing it just confuses the port picker.
 */
const HIDDEN_PORT_PATTERNS = [/midi\s*through/i];

function isHiddenPort(name: string): boolean {
	return HIDDEN_PORT_PATTERNS.some((re) => re.test(name));
}

const CC_STATUS = 0xb0; // Control Change, channel added in low nibble
const NOTE_ON_STATUS = 0x90; // Note On, channel added in low nibble
const NOTE_OFF_STATUS = 0x80; // Note Off, channel added in low nibble
const CC_ALL_NOTES_OFF = 123;

class MidiService {
	status = $state<MidiStatus>('idle');
	errorMessage = $state('');
	outputs = $state<MidiPort[]>([]);
	selectedPortId = $state<string | null>(null);
	/** MIDI channel as shown to the user: 1-16. Wire value is channel-1. */
	channel = $state(1);

	#access: MIDIAccess | null = null;

	constructor() {
		if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
			this.status = 'unsupported';
		}
	}

	get selectedPort(): MidiPort | null {
		return this.outputs.find((p) => p.id === this.selectedPortId) ?? null;
	}

	get isReady(): boolean {
		return this.status === 'ready' && this.selectedPortId !== null;
	}

	/** Request MIDI access and enumerate outputs. Safe to call more than once. */
	async init(): Promise<void> {
		if (this.status === 'unsupported') return;
		this.status = 'requesting';
		this.errorMessage = '';

		try {
			// sysex not needed — plain CC only.
			this.#access = await navigator.requestMIDIAccess({ sysex: false });
			this.#access.onstatechange = () => this.#refreshOutputs();
			this.#refreshOutputs();
			this.status = 'ready';
		} catch (err) {
			// Permission denials surface here as SecurityError in most browsers.
			const name = err instanceof Error ? err.name : '';
			this.status = name === 'SecurityError' ? 'denied' : 'error';
			this.errorMessage = err instanceof Error ? err.message : String(err);
		}
	}

	#refreshOutputs() {
		if (!this.#access) return;
		const list: MidiPort[] = [];
		for (const output of this.#access.outputs.values()) {
			const name = output.name ?? '(unnamed)';
			if (isHiddenPort(name)) continue; // skip ALSA "Midi Through" and similar virtual ports
			list.push({
				id: output.id,
				name,
				manufacturer: output.manufacturer ?? ''
			});
		}
		this.outputs = list;

		// Auto-select: keep current if still present, else prefer a Phara-O port,
		// else fall back to the first available output.
		const stillThere = this.outputs.some((p) => p.id === this.selectedPortId);
		if (!stillThere) {
			const pharao = this.outputs.find((p) =>
				p.name.toUpperCase().includes(PHARAO_PORT_HINT)
			);
			this.selectedPortId = pharao?.id ?? this.outputs[0]?.id ?? null;
		}
	}

	selectPort(id: string) {
		this.selectedPortId = id;
	}

	setChannel(channel: number) {
		this.channel = Math.min(16, Math.max(1, Math.round(channel)));
	}

	#rawOutput(): MIDIOutput | null {
		if (!this.#access || !this.selectedPortId) return null;
		return this.#access.outputs.get(this.selectedPortId) ?? null;
	}

	/**
	 * Send a single Control Change. `cc` and `value` are clamped to 0-127.
	 * Returns false if there is no usable port (caller can surface that).
	 */
	sendCC(cc: number, value: number): boolean {
		const out = this.#rawOutput();
		if (!out) return false;
		const status = CC_STATUS | ((this.channel - 1) & 0x0f);
		out.send([status, clamp7(cc), clamp7(value)]);
		return true;
	}

	/**
	 * Send raw MIDI bytes, optionally scheduled at a `performance.now()`-domain
	 * timestamp (Web MIDI shares that time origin). Used by the transport to
	 * schedule clock ticks ahead of time for jitter-free timing. A timestamp in
	 * the past (or omitted) sends immediately.
	 */
	sendRaw(data: number[], timestamp?: number): boolean {
		const out = this.#rawOutput();
		if (!out) return false;
		out.send(data, timestamp);
		return true;
	}

	/**
	 * Send a Note On, optionally scheduled at a `performance.now()`-domain
	 * timestamp. `note` and `velocity` are clamped to 0-127. Used by the in-app
	 * sequencer; the synth only needs MIDI Rx = ON to react (independent of its
	 * clock source).
	 */
	sendNoteOn(note: number, velocity: number, timestamp?: number): boolean {
		const out = this.#rawOutput();
		if (!out) return false;
		const status = NOTE_ON_STATUS | ((this.channel - 1) & 0x0f);
		out.send([status, clamp7(note), clamp7(velocity)], timestamp);
		return true;
	}

	/** Send a Note Off, optionally scheduled at a `performance.now()` timestamp. */
	sendNoteOff(note: number, timestamp?: number): boolean {
		const out = this.#rawOutput();
		if (!out) return false;
		const status = NOTE_OFF_STATUS | ((this.channel - 1) & 0x0f);
		out.send([status, clamp7(note), 0], timestamp);
		return true;
	}

	/** Panic: send All Notes Off on the current channel so nothing hangs. */
	allNotesOff(): boolean {
		const out = this.#rawOutput();
		if (!out) return false;
		const status = CC_STATUS | ((this.channel - 1) & 0x0f);
		out.send([status, CC_ALL_NOTES_OFF, 0]);
		return true;
	}

	/**
	 * Cancel any messages scheduled with a future timestamp but not yet sent.
	 * Used when stopping the sequencer so look-ahead notes don't play after stop.
	 */
	clearScheduled(): void {
		// MIDIOutput.clear() is in the Web MIDI spec but missing from some type defs.
		const out = this.#rawOutput() as (MIDIOutput & { clear?: () => void }) | null;
		out?.clear?.();
	}

	/**
	 * Send a batch of CC messages sequentially with a small gap between them so
	 * we don't flood the MIDI buffer. Used when loading a snapshot.
	 */
	async sendBatch(
		messages: { cc: number; value: number }[],
		gapMs = 8
	): Promise<{ sent: number; ok: boolean }> {
		if (!this.#rawOutput()) return { sent: 0, ok: false };
		let sent = 0;
		for (const m of messages) {
			this.sendCC(m.cc, m.value);
			sent++;
			if (gapMs > 0) await delay(gapMs);
		}
		return { sent, ok: true };
	}
}

function clamp7(n: number): number {
	return Math.min(127, Math.max(0, Math.round(n)));
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Singleton — one MIDI service per page. */
export const midi = new MidiService();
