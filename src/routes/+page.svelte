<script lang="ts">
	import {
		ALL_PARAMS,
		GROUP_LABELS,
		GROUP_ORDER,
		type Param,
		type ParamGroup
	} from '$lib/params';
	import { midi } from '$lib/midi.svelte';
	import MidiSetup from '$lib/components/MidiSetup.svelte';
	import HardwareNote from '$lib/components/HardwareNote.svelte';
	import SnapshotBar from '$lib/components/SnapshotBar.svelte';
	import ContinuousControl from '$lib/components/ContinuousControl.svelte';
	import SteppedControl from '$lib/components/SteppedControl.svelte';
	import UnavailableControl from '$lib/components/UnavailableControl.svelte';

	// Group params for the panel layout; the panel is just a map over PARAMS.
	function paramsIn(group: ParamGroup): Param[] {
		return ALL_PARAMS.filter((p) => p.group === group);
	}

	const groups = GROUP_ORDER.map((g) => ({
		id: g,
		label: GROUP_LABELS[g],
		params: paramsIn(g)
	})).filter((g) => g.params.length > 0);
</script>

<svelte:head>
	<title>Phara-O Mini Editor</title>
</svelte:head>

<div class="page">
	<header class="masthead">
		<div>
			<h1>Phara-O Mini <span>Editor / Librarian</span></h1>
			<p class="tagline">
				The synth has no display — so this app shows you the numbers. Values here are what
				the app sends; the hardware can't report back.
			</p>
		</div>
		{#if !midi.isReady && midi.status !== 'unsupported'}
			<span class="pill warn">Not sending — connect MIDI</span>
		{:else if midi.isReady}
			<span class="pill live">Live · {midi.selectedPort?.name} · ch {midi.channel}</span>
		{/if}
	</header>

	<div class="controls-head">
		<MidiSetup />
		<HardwareNote />
	</div>

	<main>
		{#each groups as group (group.id)}
			<section class="group">
				<h2 class="group-title">{group.label}</h2>
				<div class="grid">
					{#each group.params as param (param.id)}
						{#if param.kind === 'continuous'}
							<ContinuousControl {param} />
						{:else if param.kind === 'stepped'}
							<SteppedControl {param} />
						{:else}
							<UnavailableControl {param} />
						{/if}
					{/each}
				</div>
			</section>
		{/each}
	</main>

	<SnapshotBar />

	<footer>
		<p>
			Phara-O Mini editor · one-way MIDI CC control · no data is read from the hardware. Built
			on standard Web MIDI, so it runs anywhere a browser supports it.
		</p>
	</footer>
</div>

<style>
	.page {
		max-width: 1080px;
		margin: 0 auto;
		padding: 1.5rem 1.25rem 3rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.masthead {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	h1 {
		font-size: 1.55rem;
		letter-spacing: 0.01em;
	}
	h1 span {
		color: var(--text-faint);
		font-weight: 400;
		font-size: 1.1rem;
	}
	.tagline {
		margin: 0.4rem 0 0;
		font-size: 0.86rem;
		color: var(--text-dim);
		max-width: 42rem;
	}
	.pill {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.35rem 0.7rem;
		border-radius: 999px;
		white-space: nowrap;
	}
	.pill.warn {
		background: color-mix(in srgb, var(--danger) 18%, transparent);
		color: var(--danger);
		border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
	}
	.pill.live {
		background: color-mix(in srgb, var(--ok) 15%, transparent);
		color: var(--ok);
		border: 1px solid color-mix(in srgb, var(--ok) 40%, transparent);
	}
	.controls-head {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	main {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.group-title {
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-faint);
		margin-bottom: 0.6rem;
		padding-bottom: 0.35rem;
		border-bottom: 1px solid var(--border);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.75rem;
	}
	footer {
		margin-top: 0.5rem;
		border-top: 1px solid var(--border);
		padding-top: 1rem;
	}
	footer p {
		margin: 0;
		font-size: 0.75rem;
		color: var(--text-faint);
	}
</style>
