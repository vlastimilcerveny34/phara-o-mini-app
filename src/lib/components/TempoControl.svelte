<script lang="ts">
	import { transport, MIN_BPM, MAX_BPM } from '$lib/transport.svelte';

	function onBpmInput(e: Event) {
		transport.setBpm(Number((e.currentTarget as HTMLInputElement).value));
	}
</script>

<div class="ctrl" class:playing={transport.isPlaying}>
	<div class="top">
		<span class="label">Tempo</span>
		<span class="value">{transport.bpm}<small>BPM</small></span>
	</div>

	<div class="row">
		<button
			class="step"
			onclick={() => transport.nudge(-1)}
			disabled={transport.bpm <= MIN_BPM}
			aria-label="Tempo down">−</button
		>
		<input
			type="range"
			min={MIN_BPM}
			max={MAX_BPM}
			step="1"
			value={transport.bpm}
			oninput={onBpmInput}
			aria-label="Tempo in BPM"
		/>
		<button
			class="step"
			onclick={() => transport.nudge(1)}
			disabled={transport.bpm >= MAX_BPM}
			aria-label="Tempo up">+</button
		>
	</div>

	<p class="hint">
		The sequencer and arp play at this tempo. MIDI clock is sent to the synth while they run
		(synth: Clock Source = USB MIDI, FUNC + key 7 at power-on).
	</p>
</div>

<style>
	.ctrl {
		background: var(--bg-panel-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.7rem 0.8rem 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		height: 100%;
	}
	.ctrl.playing {
		border-color: color-mix(in srgb, var(--ok) 55%, var(--border));
	}
	.top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.label {
		font-size: 0.82rem;
		color: var(--text-dim);
		font-weight: 600;
	}
	.value {
		font-family: var(--mono);
		font-size: 1.55rem;
		font-weight: 600;
		line-height: 1;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.value small {
		font-size: 0.6rem;
		color: var(--text-faint);
		margin-left: 0.2rem;
		font-weight: 500;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.step {
		flex: none;
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 6px;
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		color: var(--text);
		font-size: 1.1rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.step:hover:not(:disabled) {
		border-color: var(--accent);
	}
	.step:disabled {
		opacity: 0.4;
	}
	input[type='range'] {
		-webkit-appearance: none;
		appearance: none;
		flex: 1;
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
	.hint {
		margin: 0;
		font-size: 0.68rem;
		color: var(--text-faint);
		line-height: 1.3;
	}
</style>
