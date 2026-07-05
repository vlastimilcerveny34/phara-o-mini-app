<script lang="ts">
	import { noteSources } from '$lib/noteSource.svelte';
	import { midi } from '$lib/midi.svelte';
	import Keyboard from './Keyboard.svelte';

	let ready = $derived(midi.isReady);
	let heldCount = $derived(noteSources.held.size);
	let hasInput = $derived(midi.selectedInputId !== null);
</script>

<section class="ns">
	<header>
		<h2>Note Sources</h2>
		<div class="right">
			{#if heldCount > 0}
				<span class="held-pill">{heldCount} held</span>
			{/if}
			<button
				class="panic"
				onclick={() => noteSources.panic()}
				disabled={!ready}
				title="Send All Notes Off">Panic</button
			>
		</div>
	</header>

	<p class="src-hint">
		{#if !hasInput}
			Play the on-screen keyboard below, or pick a <strong>MIDI input</strong> in MIDI Setup to
			play an external keyboard through to the synth.
		{:else}
			Playing <strong>{midi.selectedInput?.name}</strong> and the on-screen keyboard through to
			the synth.
		{/if}
	</p>

	<Keyboard />

	{#if !ready}
		<p class="warn">Connect MIDI to play notes to the synth.</p>
	{/if}
</section>

<style>
	.ns {
		background: var(--bg-panel-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.8rem 0.9rem 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	h2 {
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-dim);
	}
	.right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.held-pill {
		font-size: 0.7rem;
		font-family: var(--mono);
		color: var(--ok);
		background: color-mix(in srgb, var(--ok) 15%, transparent);
		border: 1px solid color-mix(in srgb, var(--ok) 40%, transparent);
		border-radius: 999px;
		padding: 0.15rem 0.55rem;
	}
	.panic {
		font-size: 0.72rem;
		font-weight: 600;
		padding: 0.3rem 0.65rem;
		border-radius: 6px;
		background: color-mix(in srgb, var(--danger) 16%, transparent);
		border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
		color: var(--danger);
	}
	.panic:hover:not(:disabled) {
		filter: brightness(1.15);
	}
	.panic:disabled {
		opacity: 0.4;
	}
	.src-hint {
		margin: 0;
		font-size: 0.78rem;
		color: var(--text-faint);
	}
	.warn {
		margin: 0;
		font-size: 0.78rem;
		color: var(--danger);
	}
</style>
