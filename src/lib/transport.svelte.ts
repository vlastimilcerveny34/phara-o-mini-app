/**
 * Transport — MIDI clock master (phase 2).
 *
 * Emits System Real-Time messages so the Phara-O (set to Clock Source = USB
 * MIDI via FUNC + key 7 at power-on) slaves its tempo to the computer:
 *   Start (0xFA) → Clock (0xF8) × 24 PPQN → Stop (0xFC)
 *
 * Not user-facing: start/stop is driven by selecting a note generator
 * (`noteGenerator.svelte.ts`) — the clock runs for exactly as long as the
 * sequencer or the arp is playing. The user only ever sets the tempo.
 *
 * Timing uses a look-ahead scheduler ("A Tale of Two Clocks"): a coarse timer
 * wakes every INTERVAL_MS and schedules every tick due within the next
 * LOOKAHEAD_MS using Web MIDI's timestamped send, so clock jitter doesn't
 * depend on JS timer precision. Future sequencer/arp features attach here as
 * consumers of the tick, rather than spinning their own timers.
 *
 * State fields are Svelte 5 runes so the UI stays reactive.
 */

import { midi } from './midi.svelte';

const CLOCK = 0xf8;
const START = 0xfa;
const STOP = 0xfc;

export const MIN_BPM = 20;
export const MAX_BPM = 300;
export const DEFAULT_BPM = 120;

export const PPQN = 24;
const LOOKAHEAD_MS = 100;
const INTERVAL_MS = 25;

/** Max delay of every 2nd step, as a fraction of a step — shared by the swing
 * controls of both clock consumers (arp and step sequencer). */
export const MAX_SWING = 0.6;

/**
 * A consumer of the transport's musical clock (e.g. the step sequencer). It is
 * driven off the same look-ahead scheduler that emits MIDI clock, so its events
 * are scheduled ahead of time with accurate `performance.now()` timestamps.
 */
export type TickConsumer = {
	/** Playback started; `time` is when tick 0 fires. Reset your position here. */
	onStart?(time: number): void;
	/** One 24-PPQN tick. `tick` counts from 0 at start; `time` is its timestamp. */
	onTick(tick: number, time: number): void;
	/** Playback stopped; release any held notes. */
	onStop?(): void;
};

class Transport {
	bpm = $state(DEFAULT_BPM);
	isPlaying = $state(false);

	#timer: ReturnType<typeof setInterval> | null = null;
	/** Timestamp (performance.now() domain) of the next clock tick to schedule. */
	#nextTick = 0;
	/** Running 24-PPQN tick index since the last start(); handed to consumers. */
	#tickIndex = 0;
	/** Consumers driven off the same scheduler (the step sequencer, etc.). */
	#consumers = new Set<TickConsumer>();

	/** Register a clock consumer; returns an unsubscribe function. */
	subscribe(consumer: TickConsumer): () => void {
		this.#consumers.add(consumer);
		return () => this.#consumers.delete(consumer);
	}

	/** Milliseconds between clock ticks at the current tempo (24 PPQN). */
	get tickMs(): number {
		return 60000 / this.bpm / PPQN;
	}

	setBpm(value: number) {
		const v = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value)));
		this.bpm = v; // scheduler picks up the new rate on its next advance
	}

	nudge(delta: number) {
		this.setBpm(this.bpm + delta);
	}

	start() {
		if (this.isPlaying || !midi.isReady) return;
		const now = performance.now();
		midi.sendRaw([START], now);
		this.#nextTick = now;
		this.#tickIndex = 0;
		this.isPlaying = true;
		for (const c of this.#consumers) c.onStart?.(now);
		this.#timer = setInterval(() => this.#schedule(), INTERVAL_MS);
		this.#schedule(); // prime the first window immediately
	}

	stop() {
		if (this.#timer !== null) {
			clearInterval(this.#timer);
			this.#timer = null;
		}
		if (this.isPlaying) {
			midi.sendRaw([STOP], performance.now());
			for (const c of this.#consumers) c.onStop?.();
		}
		this.isPlaying = false;
	}

	#schedule() {
		if (!this.isPlaying) return;
		const horizon = performance.now() + LOOKAHEAD_MS;
		// Guard against unbounded catch-up if the tab was suspended for a while.
		if (this.#nextTick < performance.now() - LOOKAHEAD_MS) {
			this.#nextTick = performance.now();
		}
		while (this.#nextTick < horizon) {
			midi.sendRaw([CLOCK], this.#nextTick);
			for (const c of this.#consumers) c.onTick(this.#tickIndex, this.#nextTick);
			this.#tickIndex++;
			this.#nextTick += this.tickMs;
		}
	}
}

/** Singleton transport for the page. */
export const transport = new Transport();
