<script lang="ts">
	import { midi } from '$lib/midi.svelte';
	import {
		captureSnapshot,
		downloadSnapshot,
		parseSnapshot,
		applySnapshot,
		type Snapshot
	} from '$lib/snapshot';

	let snapshotName = $state('');
	let fileInput: HTMLInputElement;

	type Feedback = { kind: 'ok' | 'bad'; text: string } | null;
	let feedback = $state<Feedback>(null);
	let busy = $state(false);

	function flash(kind: 'ok' | 'bad', text: string) {
		feedback = { kind, text };
		setTimeout(() => {
			feedback = null;
		}, 5000);
	}

	function onSave() {
		const snap = captureSnapshot(snapshotName || 'Untitled');
		downloadSnapshot(snap);
		flash('ok', `Saved “${snap.name}”.`);
	}

	function onPickFile() {
		fileInput.click();
	}

	async function onFileChosen(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = ''; // allow re-selecting the same file later
		if (!file) return;

		let snap: Snapshot;
		try {
			const text = await file.text();
			snap = parseSnapshot(text);
		} catch (err) {
			flash('bad', err instanceof Error ? err.message : 'Could not read file.');
			return;
		}

		snapshotName = snap.name;

		if (!midi.isReady) {
			// Still load values into the UI so the user sees them; just can't send.
			busy = true;
			await applySnapshot(snap); // sendBatch no-ops without a port
			busy = false;
			flash('bad', `Loaded “${snap.name}” into UI, but no MIDI port — nothing sent.`);
			return;
		}

		busy = true;
		const sent = await applySnapshot(snap);
		busy = false;
		flash('ok', `Loaded “${snap.name}” — sent ${sent} messages to the synth.`);
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
		<input
			bind:this={fileInput}
			type="file"
			accept=".json,application/json"
			onchange={onFileChosen}
			hidden
		/>
	</div>

	{#if feedback}
		<p class="feedback {feedback.kind}">{feedback.text}</p>
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
