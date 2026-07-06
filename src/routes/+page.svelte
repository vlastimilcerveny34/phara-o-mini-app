<script lang="ts">
	import { PANEL_GROUPS, panelParams, type Param } from '$lib/params';
	import { midi } from '$lib/midi.svelte';
	import { uiMode } from '$lib/uiMode.svelte';
	import SynthView from '$lib/components/SynthView.svelte';
	import MidiSetup from '$lib/components/MidiSetup.svelte';
	import TempoControl from '$lib/components/TempoControl.svelte';
	import NoteSourceControl from '$lib/components/NoteSourceControl.svelte';
	import ArpControl from '$lib/components/ArpControl.svelte';
	import SequencerControl from '$lib/components/SequencerControl.svelte';
	import SnapshotBar from '$lib/components/SnapshotBar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import ContinuousControl from '$lib/components/ContinuousControl.svelte';
	import SteppedControl from '$lib/components/SteppedControl.svelte';
	import UnavailableControl from '$lib/components/UnavailableControl.svelte';

	// The panel is just a map over the config's explicit layout.
	const panel = PANEL_GROUPS.map((g) => ({
		id: g.group,
		label: g.label,
		params: panelParams(g)
	}));

	// Global sits at the top; the MIDI setup card rides in the same row as its
	// last cell. Everything else stacks below.
	const globalGroup = panel.find((g) => g.id === 'GLOBAL');
	const otherGroups = panel.filter((g) => g.id !== 'GLOBAL');
</script>

<svelte:head>
	<title>Phara-O Mini Editor</title>
</svelte:head>

{#snippet control(param: Param)}
	{#if param.kind === 'continuous'}
		<ContinuousControl {param} />
	{:else if param.kind === 'stepped'}
		<SteppedControl {param} />
	{:else}
		<UnavailableControl {param} />
	{/if}
{/snippet}

<div class="page">
	<header class="masthead">
		<div>
			<h1>Phara-O Mini <span>Editor / Librarian</span></h1>
			{#if uiMode.mode === 'parametric'}
				<p class="tagline">
					The synth has no display — so this app shows you the numbers. Values here are what
					the app sends; the hardware can't report back.
				</p>
			{/if}
		</div>
		<div class="masthead-right">
			{#if !midi.isReady && midi.status !== 'unsupported'}
				<span class="pill warn">Not sending — connect MIDI</span>
			{:else if midi.isReady}
				<span class="pill live">Live · {midi.selectedPort?.name} · ch {midi.channel}</span>
			{/if}
			<div class="ui-toggle" role="group" aria-label="UI mode">
				<button class:sel={uiMode.mode === 'synth'} onclick={() => uiMode.set('synth')}
					>Synth</button
				>
				<button
					class:sel={uiMode.mode === 'parametric'}
					onclick={() => uiMode.set('parametric')}>Parametric</button
				>
			</div>
		</div>
	</header>

	{#if uiMode.mode === 'synth'}
		<!-- Synth view: the whole app on one faceplate, keyboard at the bottom,
		     nothing below it. Same state, different skin. -->
		<SynthView />
	{:else}
		{#if globalGroup}
			<section class="group">
				<h2 class="group-title">{globalGroup.label}</h2>
				<div class="grid">
					{#each globalGroup.params as param (param.id)}
						{@render control(param)}
					{/each}
					<!-- Tempo (the app-wide clock rate) + MIDI setup ride as equal-sized cards
					     in the Global row, after Scale and Voice Mode. -->
					<TempoControl />
					<MidiSetup />
				</div>
			</section>
		{/if}

		<!-- Patch management sits right under Global — pick a patch (or Init) first,
		     then tweak the parameters below. The keyboard closes the page, like on a
		     real instrument: control panel on top, keys at the bottom. -->
		<SnapshotBar />

		<main>
			{#each otherGroups as group (group.id)}
				<section class="group">
					<h2 class="group-title">{group.label}</h2>
					<div class="grid">
						{#each group.params as param (param.id)}
							{@render control(param)}
						{/each}
					</div>
				</section>
			{/each}
		</main>

		<SequencerControl />

		<ArpControl />

		<NoteSourceControl />
	{/if}

	<Footer />
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
	.masthead-right {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex-wrap: wrap;
	}
	.ui-toggle {
		display: flex;
		border: 1px solid var(--border-strong);
		border-radius: 9px;
		overflow: hidden;
	}
	.ui-toggle button {
		background: var(--bg-input);
		border: none;
		border-left: 1px solid var(--border-strong);
		color: var(--text-dim);
		font-size: 0.78rem;
		font-weight: 600;
		padding: 0.4rem 0.75rem;
	}
	.ui-toggle button:first-child {
		border-left: none;
	}
	.ui-toggle button.sel {
		background: color-mix(in srgb, var(--accent) 30%, var(--bg-input));
		color: var(--text);
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
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
		gap: 0.75rem;
		align-items: stretch;
	}
</style>
