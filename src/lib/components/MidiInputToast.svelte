<script lang="ts">
	/**
	 * Hot-plug toast: when a MIDI input appears after the app started (a
	 * keyboard plugged into USB), offer selecting it as the note input with one
	 * click. Floats over the page (both UI modes), auto-dismisses, and never
	 * selects anything by itself — see midi.newInput.
	 */
	import { midi } from '$lib/midi.svelte';

	const AUTO_DISMISS_MS = 10000;

	$effect(() => {
		if (!midi.newInput) return;
		const t = setTimeout(() => midi.dismissNewInput(), AUTO_DISMISS_MS);
		return () => clearTimeout(t);
	});
</script>

{#if midi.newInput}
	<div class="toast" role="status">
		<span class="icon" aria-hidden="true">🎹</span>
		<span class="msg">MIDI keyboard detected: <strong>{midi.newInput.name}</strong></span>
		<button class="use" onclick={() => midi.selectInput(midi.newInput!.id)}>Use as MIDI in</button>
		<button class="close" onclick={() => midi.dismissNewInput()} aria-label="Dismiss">×</button>
	</div>
{/if}

<style>
	.toast {
		position: fixed;
		top: 0.9rem;
		left: 50%;
		translate: -50% 0;
		z-index: 100;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		max-width: min(34rem, calc(100vw - 2rem));
		padding: 0.55rem 0.6rem 0.55rem 0.8rem;
		background: var(--bg-panel-2);
		border: 1px solid var(--accent);
		border-radius: 10px;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
		animation: slide-in 0.25s ease-out;
	}
	@keyframes slide-in {
		from {
			opacity: 0;
			translate: -50% -0.8rem;
		}
	}
	.icon {
		flex: none;
	}
	.msg {
		font-size: 0.84rem;
		color: var(--text-dim);
		min-width: 0;
	}
	.msg strong {
		color: var(--text);
	}
	.use {
		flex: none;
		background: var(--accent);
		color: #1a1206;
		border: none;
		border-radius: 7px;
		padding: 0.4rem 0.7rem;
		font-size: 0.8rem;
		font-weight: 650;
		white-space: nowrap;
	}
	.use:hover {
		filter: brightness(1.06);
	}
	.close {
		flex: none;
		background: none;
		border: none;
		color: var(--text-faint);
		font-size: 1.1rem;
		line-height: 1;
		padding: 0.25rem 0.4rem;
	}
	.close:hover {
		color: var(--text);
	}
</style>
