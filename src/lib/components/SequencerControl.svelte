<script lang="ts">
	import { midi } from '$lib/midi.svelte';
	import { noteGenerator } from '$lib/noteGenerator.svelte';
	import {
		sequencer,
		noteName,
		DIVISIONS,
		MAX_STEPS,
		parsePattern,
		downloadPattern,
		type PatternFile
	} from '$lib/sequencer.svelte';

	let patternName = $state('');
	let fileInput: HTMLInputElement;

	type Feedback = { kind: 'ok' | 'bad'; text: string } | null;
	let feedback = $state<Feedback>(null);

	let ready = $derived(midi.isReady);
	let active = $derived(noteGenerator.active === 'sequencer');
	let step = $derived(sequencer.steps[sequencer.cursor]);

	function flash(kind: 'ok' | 'bad', text: string) {
		feedback = { kind, text };
		setTimeout(() => (feedback = null), 5000);
	}

	function onPad(i: number) {
		sequencer.setCursor(i);
		sequencer.toggleStep(i);
	}

	// Step-record shortcuts: ←/→ move the cursor (never erase). Only while armed
	// in step mode, and never while typing/selecting in a field.
	function isTypingTarget(t: EventTarget | null): boolean {
		const el = t as HTMLElement | null;
		if (!el) return false;
		const tag = el.tagName;
		return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el.isContentEditable;
	}
	$effect(() => {
		if (!sequencer.recording || sequencer.recordMode !== 'step') return;
		const onKey = (e: KeyboardEvent) => {
			if (isTypingTarget(e.target)) return;
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				sequencer.cursorLeft();
			} else if (e.key === 'ArrowRight') {
				e.preventDefault();
				sequencer.cursorRight();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	function onSave() {
		downloadPattern(sequencer.serialize(patternName || 'Untitled'));
		flash('ok', 'Pattern saved.');
	}

	function onPickFile() {
		fileInput.click();
	}

	async function onFileChosen(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		let pat: PatternFile;
		try {
			pat = parsePattern(await file.text());
		} catch (err) {
			flash('bad', err instanceof Error ? err.message : 'Could not read file.');
			return;
		}
		sequencer.load(pat);
		patternName = pat.name;
		flash('ok', `Loaded “${pat.name}”.`);
	}
</script>

<section class="seq">
	<header>
		<div class="title">
			<h2>Step Sequencer</h2>
			<!-- Starting the sequencer turns off the arp (one note generator at a time). -->
			<button
				class="play"
				class:on={active}
				onclick={() => noteGenerator.select('sequencer')}
				disabled={!ready}
				title={ready ? '' : 'Connect MIDI first'}
			>
				{active ? '■ Stop' : '▶ Play'}
			</button>
		</div>

		<div class="transport">
			<div class="rec-group" class:armed={sequencer.recording}>
				<button
					class="rec"
					class:on={sequencer.recording}
					onclick={() => sequencer.toggleRecord()}
					title="Arm recording from the keyboard / MIDI input"
				>
					<span class="dot"></span>{sequencer.recording ? 'Recording' : 'Record'}
				</button>
				<div class="mode" role="group" aria-label="Record mode">
					<button
						class:sel={sequencer.recordMode === 'step'}
						disabled={!sequencer.recording}
						title={sequencer.recording ? '' : 'Turn on Record to choose a mode'}
						onclick={() => sequencer.setRecordMode('step')}>Step</button
					>
					<button
						class:sel={sequencer.recordMode === 'live'}
						disabled={!sequencer.recording}
						title={sequencer.recording ? '' : 'Turn on Record to choose a mode'}
						onclick={() => sequencer.setRecordMode('live')}>Live</button
					>
				</div>
			</div>
		</div>
	</header>

	{#if sequencer.recording}
		<div class="rec-bar" class:live={sequencer.recordMode === 'live'}>
			{#if sequencer.recordMode === 'step'}
				<span class="rec-msg">
					Play a note → fills step <strong>{sequencer.cursor + 1}</strong> and moves on.
					<span class="dim">← → move the cursor.</span>
				</span>
				<div class="rec-actions">
					<button class="mini" onclick={() => sequencer.cursorLeft()} aria-label="Cursor left">←</button>
					<button class="mini" onclick={() => sequencer.cursorRight()} aria-label="Cursor right">→</button>
				</div>
			{:else if !active}
				<span class="rec-msg">Press <strong>▶ Play</strong> to record live — notes snap to the nearest step.</span>
			{:else}
				<span class="rec-msg">Recording live — play along; notes snap to the nearest step, hold length sets gate.</span>
			{/if}
		</div>
	{/if}

	<div class="settings">
		<label>
			<span>Steps</span>
			<select
				value={sequencer.length}
				onchange={(e) => sequencer.setLength(Number((e.currentTarget as HTMLSelectElement).value))}
			>
				{#each Array.from({ length: MAX_STEPS }, (_, i) => i + 1) as n (n)}
					<option value={n}>{n}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Rate</span>
			<select bind:value={sequencer.ticksPerStep}>
				{#each DIVISIONS as d (d.ticksPerStep)}
					<option value={d.ticksPerStep}>{d.label}</option>
				{/each}
			</select>
		</label>
		<button class="mini" onclick={() => sequencer.clearAll()}>Clear</button>
	</div>

	<div class="grid" style="--cols: {MAX_STEPS}">
		{#each sequencer.steps as s, i (i)}
			<button
				class="step"
				class:on={s.on}
				class:playing={sequencer.currentStep === i}
				class:record-cursor={sequencer.recording &&
					sequencer.recordMode === 'step' &&
					sequencer.cursor === i}
				class:selected={sequencer.cursor === i}
				class:beat={i % 4 === 0}
				class:muted={i >= sequencer.length}
				disabled={i >= sequencer.length}
				onclick={() => onPad(i)}
				title={`Step ${i + 1}`}
			>
				<span class="num">{i + 1}</span>
				<span class="note">{s.on ? noteName(s.note) : '·'}</span>
			</button>
		{/each}
	</div>

	<div class="detail">
		<div class="detail-head">
			Step {sequencer.cursor + 1}{#if !step.on}<span class="rest"> · rest</span>{/if}
		</div>
		<div class="detail-rows">
			<div class="field">
				<span>Note</span>
				<div class="note-edit">
					<button class="mini" onclick={() => sequencer.nudgeNote(sequencer.cursor, -12)}>−12</button>
					<button class="mini" onclick={() => sequencer.nudgeNote(sequencer.cursor, -1)}>−</button>
					<strong class="note-val">{noteName(step.note)}</strong>
					<button class="mini" onclick={() => sequencer.nudgeNote(sequencer.cursor, 1)}>+</button>
					<button class="mini" onclick={() => sequencer.nudgeNote(sequencer.cursor, 12)}>+12</button>
				</div>
			</div>
			<label class="field">
				<span>Velocity <em>{step.velocity}</em></span>
				<input type="range" min="1" max="127" bind:value={step.velocity} />
			</label>
			<label class="field">
				<span>Gate <em>{Math.round(step.gate * 100)}%</em></span>
				<input type="range" min="0.05" max="1" step="0.05" bind:value={step.gate} />
			</label>
		</div>
	</div>

	<div class="lib">
		<input
			class="name"
			type="text"
			placeholder="Pattern name…"
			bind:value={patternName}
			aria-label="Pattern name"
		/>
		<button class="mini" onclick={onSave}>Save pattern</button>
		<button class="mini" onclick={onPickFile}>Load pattern</button>
		<input
			bind:this={fileInput}
			type="file"
			accept=".seq,application/json"
			onchange={onFileChosen}
			hidden
		/>
	</div>

	{#if feedback}
		<p class="feedback {feedback.kind}">{feedback.text}</p>
	{/if}

	{#if !ready}
		<p class="hint">Connect MIDI to hear the sequence. The synth needs MIDI Rx = ON (FUNC + key 13).</p>
	{/if}
</section>

<style>
	.seq {
		background: var(--bg-panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 1rem 1.1rem 1.1rem;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-bottom: 0.85rem;
	}
	.title {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		flex-wrap: wrap;
	}
	h2 {
		font-size: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-dim);
	}
	.play {
		background: var(--accent);
		color: #1a1206;
		border: none;
		border-radius: 8px;
		padding: 0.5rem 1.1rem;
		font-weight: 650;
		font-size: 0.9rem;
	}
	.play.on {
		background: var(--ok);
		color: #08210f;
	}
	.play:hover:not(:disabled) {
		filter: brightness(1.06);
	}
	.play:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.transport {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex-wrap: wrap;
	}
	.rec-group {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.2rem;
		border: 1px solid var(--border-strong);
		border-radius: 9px;
	}
	.rec-group.armed {
		border-color: color-mix(in srgb, var(--danger) 60%, var(--border));
	}
	.rec {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		border-radius: 7px;
		padding: 0.4rem 0.7rem;
		font-weight: 600;
		font-size: 0.82rem;
		color: var(--text-dim);
	}
	.rec .dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--text-faint);
		flex: none;
	}
	.rec.on {
		color: #fff;
		background: var(--danger);
		border-color: var(--danger);
	}
	.rec.on .dot {
		background: #fff;
		box-shadow: 0 0 6px 1px rgba(255, 255, 255, 0.7);
		animation: recpulse 1.2s ease-in-out infinite;
	}
	.rec:hover:not(.on) {
		border-color: var(--danger);
	}
	.mode {
		display: flex;
	}
	.mode button {
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		color: var(--text-dim);
		font-size: 0.78rem;
		font-weight: 600;
		padding: 0.38rem 0.6rem;
	}
	.mode button:first-child {
		border-radius: 7px 0 0 7px;
	}
	.mode button:last-child {
		border-radius: 0 7px 7px 0;
		border-left: none;
	}
	.mode button.sel {
		background: color-mix(in srgb, var(--accent) 30%, var(--bg-input));
		border-color: var(--accent);
		color: var(--text);
	}
	.mode button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.rec-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		flex-wrap: wrap;
		margin: -0.2rem 0 0.85rem;
		padding: 0.5rem 0.7rem;
		border-radius: 8px;
		background: color-mix(in srgb, var(--danger) 12%, var(--bg-input));
		border: 1px solid color-mix(in srgb, var(--danger) 35%, var(--border));
	}
	.rec-msg {
		font-size: 0.82rem;
		color: var(--text-dim);
	}
	.rec-msg .dim {
		color: var(--text-faint);
	}
	.rec-actions {
		display: flex;
		gap: 0.4rem;
	}
	.settings {
		display: flex;
		align-items: flex-end;
		gap: 0.8rem;
		margin-bottom: 0.85rem;
	}
	.settings label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-faint);
	}
	.settings select {
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		border-radius: 7px;
		padding: 0.4rem 0.5rem;
		font-size: 0.85rem;
		color: var(--text);
		width: 5rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: 0.3rem;
		margin-bottom: 0.9rem;
	}
	.step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		padding: 0.5rem 0.15rem;
		border-radius: 7px;
		background: var(--bg-input);
		border: 1px solid var(--border);
		color: var(--text-faint);
		min-height: 3.1rem;
		justify-content: space-between;
	}
	.step.beat {
		border-color: var(--border-strong);
	}
	.step.on {
		background: color-mix(in srgb, var(--accent) 22%, var(--bg-input));
		border-color: var(--accent);
		color: var(--text);
	}
	.step.selected {
		outline: 2px solid var(--accent-2);
		outline-offset: 1px;
	}
	.step.playing {
		box-shadow: 0 0 0 2px var(--ok), 0 0 10px 1px color-mix(in srgb, var(--ok) 60%, transparent);
	}
	.step.record-cursor {
		box-shadow: 0 0 0 2px var(--danger), 0 0 10px 1px color-mix(in srgb, var(--danger) 55%, transparent);
		animation: recpulse 1.2s ease-in-out infinite;
	}
	@keyframes recpulse {
		50% {
			box-shadow: 0 0 0 2px var(--danger), 0 0 16px 3px color-mix(in srgb, var(--danger) 70%, transparent);
		}
	}
	.step.muted {
		opacity: 0.3;
	}
	.step .num {
		font-size: 0.6rem;
		font-variant-numeric: tabular-nums;
	}
	.step .note {
		font-family: var(--mono);
		font-size: 0.72rem;
		font-weight: 600;
	}
	.detail {
		background: var(--bg-panel-2);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.7rem 0.8rem;
		margin-bottom: 0.85rem;
	}
	.detail-head {
		font-size: 0.8rem;
		color: var(--text-dim);
		margin-bottom: 0.55rem;
		font-weight: 600;
	}
	.rest {
		color: var(--text-faint);
		font-weight: 400;
	}
	.detail-rows {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		gap: 0.7rem 1rem;
		align-items: center;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.field > span {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-faint);
	}
	.field em {
		font-style: normal;
		color: var(--text-dim);
		font-family: var(--mono);
	}
	.note-edit {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.note-val {
		font-family: var(--mono);
		font-size: 1.05rem;
		min-width: 3rem;
		text-align: center;
	}
	input[type='range'] {
		-webkit-appearance: none;
		appearance: none;
		height: 6px;
		border-radius: 4px;
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		cursor: pointer;
	}
	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: var(--text);
		border: 2px solid var(--accent);
	}
	input[type='range']::-moz-range-thumb {
		width: 13px;
		height: 13px;
		border-radius: 50%;
		background: var(--text);
		border: 2px solid var(--accent);
	}
	.mini {
		background: var(--bg-panel-2);
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		padding: 0.4rem 0.6rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text);
	}
	.mini:hover {
		border-color: var(--accent);
	}
	.lib {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
		align-items: center;
	}
	.name {
		flex: 1 1 12rem;
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		border-radius: 7px;
		padding: 0.5rem 0.7rem;
		font-size: 0.9rem;
		color: var(--text);
	}
	.feedback {
		margin: 0.7rem 0 0;
		font-size: 0.83rem;
	}
	.feedback.ok {
		color: var(--ok);
	}
	.feedback.bad {
		color: var(--danger);
	}
	.hint {
		margin: 0.7rem 0 0;
		font-size: 0.78rem;
		color: var(--text-faint);
	}
</style>
