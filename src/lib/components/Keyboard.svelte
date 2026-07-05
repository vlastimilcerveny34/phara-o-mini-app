<script lang="ts">
	import { noteSources } from '$lib/noteSource.svelte';
	import { noteName, MIN_NOTE, MAX_NOTE } from '$lib/sequencer.svelte';

	// Two octaves + the top C (25 semitones). The visible range slides with octave shift.
	const SPAN = 24;
	let startNote = $state(48); // C3; middle C (60) sits in the middle of the default view
	let velocity = $state(100);
	let computerKeys = $state(false);

	const clampStart = (n: number) => Math.min(MAX_NOTE - SPAN, Math.max(MIN_NOTE, n));
	function shiftOctave(delta: number) {
		startNote = clampStart(startNote + delta * 12);
	}

	// White vs black key layout, derived from the start note.
	const WHITE_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
	type WhiteKey = { note: number };
	type RawBlack = { note: number; whiteIndex: number };

	let layout = $derived.by(() => {
		const whites: WhiteKey[] = [];
		const blacks: RawBlack[] = [];
		let whiteIndex = -1;
		for (let i = 0; i <= SPAN; i++) {
			const note = startNote + i;
			if (WHITE_PCS.has(note % 12)) {
				whiteIndex++;
				whites.push({ note });
			} else {
				// Black key sits over the right edge of the preceding white key.
				blacks.push({ note, whiteIndex });
			}
		}
		const numWhite = whites.length;
		return {
			whites,
			numWhite,
			blacks: blacks.map((b) => ({
				note: b.note,
				leftPct: ((b.whiteIndex + 1) / numWhite) * 100
			}))
		};
	});

	const isHeld = (note: number) => noteSources.held.has(note);

	// --- pointer (mouse / touch) ---------------------------------------------
	// Mouse is a monophonic glide: entering a new key while pressed swaps the note.
	let pointerActive = $state(false);
	const mouseNotes = new Set<number>();

	function pressKey(note: number) {
		if (mouseNotes.has(note)) return;
		mouseNotes.add(note);
		noteSources.noteOn(note, velocity, 'keyboard');
	}
	function releaseAllMouse() {
		for (const note of mouseNotes) noteSources.noteOff(note, 'keyboard');
		mouseNotes.clear();
	}
	function onPointerDown(note: number, e: PointerEvent) {
		e.preventDefault();
		pointerActive = true;
		pressKey(note);
	}
	function onPointerEnter(note: number) {
		if (!pointerActive) return;
		releaseAllMouse(); // mono glide
		pressKey(note);
	}

	$effect(() => {
		const up = () => {
			pointerActive = false;
			releaseAllMouse();
		};
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', up);
		return () => {
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', up);
		};
	});

	// --- computer (QWERTY) keys ----------------------------------------------
	// Classic single-row piano mapping; offsets are relative to startNote.
	const KEY_OFFSET: Record<string, number> = {
		a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7,
		y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15
	};
	// Remember which note each physical key started, so octave shifts mid-press
	// still release the right note.
	const keyNotes = new Map<string, number>();

	// Only block note keys while the user is actually entering text — NOT when a
	// checkbox/range/button has focus (e.g. right after toggling "Computer keys",
	// which otherwise swallowed every keypress).
	const TEXT_INPUT_TYPES = new Set([
		'text', 'search', 'email', 'url', 'tel', 'password', 'number'
	]);
	function isTypingTarget(t: EventTarget | null): boolean {
		const el = t as HTMLElement | null;
		if (!el) return false;
		if (el.isContentEditable) return true;
		const tag = el.tagName;
		if (tag === 'TEXTAREA') return true;
		if (tag === 'INPUT') return TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
		return false;
	}

	$effect(() => {
		if (!computerKeys) return;
		const down = (e: KeyboardEvent) => {
			if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
			if (isTypingTarget(e.target)) return;
			const key = e.key.toLowerCase();
			if (key === 'z') return shiftOctave(-1);
			if (key === 'x') return shiftOctave(1);
			const offset = KEY_OFFSET[key];
			if (offset === undefined || keyNotes.has(key)) return;
			const note = clampStart(startNote) + offset;
			keyNotes.set(key, note);
			noteSources.noteOn(note, velocity, 'keyboard');
			e.preventDefault();
		};
		const up = (e: KeyboardEvent) => {
			const key = e.key.toLowerCase();
			const note = keyNotes.get(key);
			if (note === undefined) return;
			keyNotes.delete(key);
			noteSources.noteOff(note, 'keyboard');
		};
		window.addEventListener('keydown', down);
		window.addEventListener('keyup', up);
		return () => {
			window.removeEventListener('keydown', down);
			window.removeEventListener('keyup', up);
			// Release anything still held from computer keys when the mode turns off.
			for (const note of keyNotes.values()) noteSources.noteOff(note, 'keyboard');
			keyNotes.clear();
		};
	});
</script>

<div class="kbd">
	<div class="toolbar">
		<div class="octave">
			<button
				class="oct-btn"
				onclick={() => shiftOctave(-1)}
				disabled={startNote <= MIN_NOTE}
				aria-label="Octave down">−</button
			>
			<span class="oct-label">{noteName(startNote)}–{noteName(startNote + SPAN)}</span>
			<button
				class="oct-btn"
				onclick={() => shiftOctave(1)}
				disabled={startNote >= MAX_NOTE - SPAN}
				aria-label="Octave up">+</button
			>
		</div>

		<label class="vel">
			<span>Velocity</span>
			<input type="range" min="1" max="127" bind:value={velocity} aria-label="Velocity" />
			<em>{velocity}</em>
		</label>

		<label class="ck" class:on={computerKeys}>
			<input type="checkbox" bind:checked={computerKeys} />
			<span>Computer keys</span>
		</label>
	</div>

	<div class="keys" role="group" aria-label="On-screen keyboard" style="--n:{layout.numWhite}">
		<div class="whites">
			{#each layout.whites as k (k.note)}
				<button
					class="white"
					class:held={isHeld(k.note)}
					class:c={k.note % 12 === 0}
					onpointerdown={(e) => onPointerDown(k.note, e)}
					onpointerenter={() => onPointerEnter(k.note)}
					aria-label={noteName(k.note)}
				>
					{#if k.note % 12 === 0}<small>{noteName(k.note)}</small>{/if}
				</button>
			{/each}
		</div>
		{#each layout.blacks as k (k.note)}
			<button
				class="black"
				class:held={isHeld(k.note)}
				style="left:{k.leftPct}%"
				onpointerdown={(e) => onPointerDown(k.note, e)}
				onpointerenter={() => onPointerEnter(k.note)}
				aria-label={noteName(k.note)}
			></button>
		{/each}
	</div>

	{#if computerKeys}
		<p class="hint">Play with A–L / W–P rows · <kbd>z</kbd>/<kbd>x</kbd> shift octave.</p>
	{/if}
</div>

<style>
	.kbd {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.toolbar {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.octave {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.oct-btn {
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 6px;
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		color: var(--text);
		font-size: 1.1rem;
		line-height: 1;
	}
	.oct-btn:hover:not(:disabled) {
		border-color: var(--accent);
	}
	.oct-btn:disabled {
		opacity: 0.4;
	}
	.oct-label {
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--text-dim);
		min-width: 5.5rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.vel {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-faint);
	}
	.vel input[type='range'] {
		width: 6.5rem;
	}
	.vel em {
		font-family: var(--mono);
		font-style: normal;
		color: var(--text-dim);
		min-width: 1.8rem;
		text-align: right;
	}
	.ck {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.78rem;
		color: var(--text-dim);
		cursor: pointer;
		user-select: none;
	}
	.ck.on {
		color: var(--text);
	}

	.keys {
		position: relative;
		height: 8.5rem;
		touch-action: none;
		user-select: none;
	}
	.whites {
		display: grid;
		grid-template-columns: repeat(var(--n), 1fr);
		height: 100%;
		gap: 2px;
	}
	.white {
		background: linear-gradient(180deg, #f4f1ea, #ded9cd);
		border: 1px solid #b8b2a4;
		border-radius: 0 0 5px 5px;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: 0.3rem;
		color: #6a6153;
	}
	.white small {
		font-size: 0.6rem;
		font-family: var(--mono);
	}
	.white.held {
		background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #000));
		color: #1a1206;
	}
	.black {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		width: calc(100% / var(--n, 15) * 0.62);
		height: 60%;
		background: linear-gradient(180deg, #2a2622, #050505);
		border: 1px solid #000;
		border-radius: 0 0 4px 4px;
		z-index: 2;
	}
	.black.held {
		background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #000));
	}
	.hint {
		margin: 0;
		font-size: 0.72rem;
		color: var(--text-faint);
	}
	.hint kbd {
		font-family: var(--mono);
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		border-radius: 3px;
		padding: 0 0.25rem;
	}
</style>
