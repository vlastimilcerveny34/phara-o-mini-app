<script lang="ts">
	import {
		captureSnapshot,
		downloadSnapshot,
		parseSnapshot,
		applySnapshotWithReport,
		type Snapshot
	} from '$lib/snapshot';
	import { FACTORY_PATCHES, INIT_PATCH, factoryToSnapshot, type FactoryPatch } from '$lib/factoryPatches';
	import { mutateParams } from '$lib/mutate';
	import { Feedback } from '$lib/feedback.svelte';

	let snapshotName = $state('');
	let fileInput: HTMLInputElement;

	const feedback = new Feedback();
	let busy = $state(false);

	async function onSave() {
		const snap = captureSnapshot(snapshotName || 'Untitled');
		busy = true;
		const saved = await downloadSnapshot(snap);
		busy = false;
		if (saved) feedback.flash('ok', `Saved “${snap.name}”.`);
	}

	function onMutate() {
		mutateParams();
		feedback.flash('ok', 'Mutated — press again to drift further.');
	}

	function onPickFile() {
		fileInput.click();
	}

	async function apply(snap: Snapshot) {
		snapshotName = snap.name;
		busy = true;
		const result = await applySnapshotWithReport(snap);
		busy = false;
		feedback.flash(result.ok ? 'ok' : 'bad', result.text);
	}

	async function onFileChosen(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = ''; // allow re-selecting the same file later
		if (!file) return;

		let snap: Snapshot;
		try {
			snap = parseSnapshot(await file.text());
		} catch (err) {
			feedback.flash('bad', err instanceof Error ? err.message : 'Could not read file.');
			return;
		}
		await apply(snap);
	}

	async function onFactory(p: FactoryPatch) {
		await apply(factoryToSnapshot(p));
	}
</script>

<section class="bar">
	<header>
		<h2>Snapshot Librarian</h2>
		<p class="sub">
			The Phara-O has only 10 patch slots and forgets switch positions. A snapshot file =
			an unlimited sound bank.
		</p>
	</header>

	<div class="row">
		<input
			class="name"
			type="text"
			placeholder="Patch name…"
			bind:value={snapshotName}
			aria-label="Snapshot name"
		/>
		<button class="btn" onclick={onSave} disabled={busy}>Save snapshot</button>
		<button class="btn accent" onclick={onPickFile} disabled={busy}>
			{busy ? 'Loading…' : 'Load snapshot'}
		</button>
		<button
			class="btn"
			onclick={() => onFactory(INIT_PATCH)}
			disabled={busy}
			title={INIT_PATCH.description}>Init</button
		>
		<button
			class="btn"
			onclick={onMutate}
			disabled={busy}
			title="Nudge every knob a little — repeat to drift further">Mutate</button
		>
		<input
			bind:this={fileInput}
			type="file"
			accept=".snp,application/json"
			onchange={onFileChosen}
			hidden
		/>
	</div>

	<div class="factory">
		<div class="factory-head">
			<h3>Factory patches</h3>
			<span class="note">Resonance &amp; Dry/Wet aren’t MIDI-controllable — set those on the synth.</span>
		</div>
		<div class="chips">
			{#each FACTORY_PATCHES as p (p.name)}
				<button class="chip" onclick={() => onFactory(p)} disabled={busy} title={p.description}>
					{p.name}
				</button>
			{/each}
		</div>
	</div>

	{#if feedback.message}
		<p class="feedback {feedback.message.kind}">{feedback.message.text}</p>
	{/if}
</section>

<style>
	.bar {
		background: var(--bg-panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 1rem 1.1rem 1.1rem;
	}
	header {
		margin-bottom: 0.8rem;
	}
	h2 {
		font-size: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-dim);
	}
	.sub {
		margin: 0.35rem 0 0;
		font-size: 0.8rem;
		color: var(--text-faint);
		max-width: 46rem;
	}
	.row {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
		align-items: center;
	}
	.name {
		flex: 1 1 14rem;
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		border-radius: 7px;
		padding: 0.55rem 0.7rem;
		font-size: 0.9rem;
	}
	.name:focus-visible {
		outline: 2px solid var(--accent-2);
		outline-offset: 1px;
	}
	.btn {
		background: var(--bg-panel-2);
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		padding: 0.55rem 1rem;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text);
		white-space: nowrap;
	}
	.btn:hover:not(:disabled) {
		border-color: var(--accent);
	}
	.btn.accent {
		background: var(--accent);
		color: #1a1206;
		border-color: var(--accent);
	}
	.btn.accent:hover:not(:disabled) {
		filter: brightness(1.06);
	}
	.btn:disabled {
		opacity: 0.55;
	}
	.factory {
		margin-top: 1rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--border);
	}
	.factory-head {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-bottom: 0.6rem;
	}
	.factory-head h3 {
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--text-dim);
	}
	.factory-head .note {
		font-size: 0.72rem;
		color: var(--text-faint);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}
	.chip {
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		padding: 0.4rem 0.85rem;
		font-size: 0.83rem;
		font-weight: 600;
		color: var(--text);
	}
	.chip:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
	}
	.chip:disabled {
		opacity: 0.55;
	}
	.feedback {
		margin: 0.75rem 0 0;
		font-size: 0.83rem;
	}
	.feedback.ok {
		color: var(--ok);
	}
	.feedback.bad {
		color: var(--danger);
	}
</style>
