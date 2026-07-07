<script lang="ts">
	/**
	 * Synth view — a one-screen "faceplate" alternative to the parametric UI.
	 * Same functionality, different skin: knobs laid out ROUGHLY like the
	 * hardware's two rows (VCO+VCF+MODE / LFO+EG+DELAY — Scale folded into VCO
	 * by choice), a control strip for the app-only generators (sequencer toggle,
	 * arp switches, panic) and the keyboard closing the page. Deliberately does
	 * NOT copy the hardware's appearance, only the coarse control placement.
	 */
	import { PARAM_BY_ID, type Param } from '$lib/params';
	import { paramState } from '$lib/paramState.svelte';
	import { midi } from '$lib/midi.svelte';
	import { transport, MIN_BPM, MAX_BPM } from '$lib/transport.svelte';
	import { noteGenerator } from '$lib/noteGenerator.svelte';
	import { noteSources } from '$lib/noteSource.svelte';
	import { arp, ARP_MODES, ARP_DIVISIONS, MAX_SWING, type ArpVelocityMode } from '$lib/arp.svelte';
	import {
		captureSnapshot,
		downloadSnapshot,
		parseSnapshot,
		applySnapshotWithReport,
		type Snapshot
	} from '$lib/snapshot';
	import { FACTORY_PATCHES, factoryToSnapshot } from '$lib/factoryPatches';
	import { Feedback } from '$lib/feedback.svelte';
	import Knob from './Knob.svelte';
	import MidiSetup from './MidiSetup.svelte';
	import SequencerControl from './SequencerControl.svelte';
	import Keyboard from './Keyboard.svelte';

	// Faceplate layout — coarse placement inspired by the hardware panel
	// (controls 10–26 in the QSG): top row VCO → VCF → MODE, bottom row
	// LFO → EG → DELAY. Unavailable params (Resonance, Dry/Wet) keep their
	// physical spot but render as ghosted "HW" knobs.
	const ROWS: { label: string; ids: string[] }[][] = [
		[
			{ label: 'VCO', ids: ['scale', 'portamento', 'detune', 'vco_env_mod'] },
			{ label: 'VCF', ids: ['resonance', 'vcf_cutoff', 'vcf_env_mod'] },
			{ label: 'Mode', ids: ['voice_mode'] }
		],
		[
			{ label: 'LFO', ids: ['lfo_vco_mod', 'lfo_rate', 'lfo_vcf_mod'] },
			{ label: 'EG', ids: ['eg_attack', 'eg_decay_release', 'eg_sustain'] },
			{ label: 'Delay', ids: ['delay_feedback', 'delay_time', 'dry_wet'] }
		]
	];
	const paramFor = (id: string): Param => PARAM_BY_ID[id];

	let ready = $derived(midi.isReady);
	let seqActive = $derived(noteGenerator.active === 'sequencer');
	let arpActive = $derived(noteGenerator.active === 'arp');

	let seqOpen = $state(false);
	let midiOpen = $state(false);

	// --- patch mini-librarian (same actions as SnapshotBar, compact) ----------
	let patchName = $state('');
	let busy = $state(false);
	const feedback = new Feedback();
	let fileInput: HTMLInputElement;

	function onSave() {
		const snap = captureSnapshot(patchName || 'Untitled');
		downloadSnapshot(snap);
		feedback.flash('ok', `Saved “${snap.name}”.`);
	}

	async function apply(snap: Snapshot) {
		patchName = snap.name;
		busy = true;
		const result = await applySnapshotWithReport(snap);
		busy = false;
		feedback.flash(result.ok ? 'ok' : 'bad', result.text);
	}

	async function onFileChosen(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
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

	async function onFactoryPick(e: Event) {
		const sel = e.currentTarget as HTMLSelectElement;
		const p = FACTORY_PATCHES.find((f) => f.name === sel.value);
		sel.value = ''; // reset to the placeholder so re-picking works
		if (!p) return;
		await apply(factoryToSnapshot(p));
	}

	const VEL_MODES: { id: ArpVelocityMode; label: string }[] = [
		{ id: 'played', label: 'As played' },
		{ id: 'fixed', label: 'Fixed' },
		{ id: 'accent', label: 'Accent' }
	];

	function panic() {
		arp.clear(); // also drop latched arp notes, or they'd keep playing
		noteSources.panic();
	}
</script>

{#snippet knob(param: Param)}
	{#if param.kind === 'continuous'}
		<Knob
			label={param.label}
			value={paramState.getContinuous(param.id)}
			title="{param.chartName} · CC {param.cc}"
			onchange={(v) => paramState.setContinuous(param.id, v)}
		/>
	{:else if param.kind === 'stepped'}
		<Knob
			label={param.label}
			value={paramState.getStepIndex(param.id)}
			min={0}
			max={param.options.length - 1}
			display={param.options[paramState.getStepIndex(param.id)].label}
			title="{param.chartName} · CC {param.cc}"
			onchange={(v) => paramState.setStep(param.id, v)}
		/>
	{:else}
		<Knob label={param.label} value={0} display="—" disabled badge="HW" title={param.note} />
	{/if}
{/snippet}

<section class="face">
	<header class="face-top">
		<div class="brand">
			<strong>Phara-O Mini</strong>
			<span>editor</span>
			<span class="led" class:on={ready} title={ready ? midi.selectedPort?.name : 'No MIDI'}
			></span>
		</div>

		<div class="tempo">
			<Knob
				label="Tempo"
				value={transport.bpm}
				min={MIN_BPM}
				max={MAX_BPM}
				display="{transport.bpm} BPM"
				onchange={(v) => transport.setBpm(v)}
			/>
		</div>

		<div class="patch">
			<input type="text" placeholder="Patch name…" bind:value={patchName} aria-label="Patch name" />
			<button class="mini" onclick={onSave} disabled={busy}>Save</button>
			<button class="mini" onclick={() => fileInput.click()} disabled={busy}>Load</button>
			<select onchange={onFactoryPick} disabled={busy} aria-label="Factory patches">
				<option value="">Factory…</option>
				{#each FACTORY_PATCHES as p (p.name)}
					<option value={p.name}>{p.name}</option>
				{/each}
			</select>
			<input
				bind:this={fileInput}
				type="file"
				accept=".snp,application/json"
				onchange={onFileChosen}
				hidden
			/>
			<button class="mini" class:sel={midiOpen} onclick={() => (midiOpen = !midiOpen)}>
				MIDI
			</button>
		</div>
	</header>

	{#if feedback.message}
		<p class="feedback {feedback.message.kind}">{feedback.message.text}</p>
	{/if}

	{#if midiOpen || (!ready && midi.status !== 'unsupported')}
		<div class="drawer">
			<MidiSetup />
		</div>
	{/if}

	<div class="panel">
		{#each ROWS as row, r (r)}
			<div class="row">
				{#each row as group (group.label)}
					<fieldset class="grp">
						<legend>{group.label}</legend>
						<div class="knobs">
							{#each group.ids as id (id)}
								{@render knob(paramFor(id))}
							{/each}
						</div>
					</fieldset>
				{/each}
			</div>
		{/each}
	</div>

	<div class="strip">
		<div class="cluster">
			<button
				class="big"
				class:sel={seqOpen}
				onclick={() => (seqOpen = !seqOpen)}
				title="Show / hide the step sequencer"
			>
				<span class="dot" class:on={seqActive}></span>Seq
			</button>
			<button
				class="big"
				class:sel={arpActive}
				onclick={() => noteGenerator.select('arp')}
				disabled={!ready}
				title={ready ? 'The arp plays the notes you hold, in tempo' : 'Connect MIDI first'}
			>
				<span class="dot" class:on={arpActive}></span>Arp
			</button>
		</div>

		<div class="cluster arp-set" class:dim={!arpActive}>
			<label>
				<span>Mode</span>
				<select bind:value={arp.mode}>
					{#each ARP_MODES as m (m.id)}
						<option value={m.id}>{m.label}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Rate</span>
				<select bind:value={arp.ticksPerStep}>
					{#each ARP_DIVISIONS as d (d.ticksPerStep)}
						<option value={d.ticksPerStep}>{d.label}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Oct</span>
				<select bind:value={arp.octaves}>
					{#each [1, 2, 3, 4] as n (n)}
						<option value={n}>{n}</option>
					{/each}
				</select>
			</label>
			<label class="check">
				<input
					type="checkbox"
					checked={arp.latch}
					onchange={(e) => arp.setLatch((e.currentTarget as HTMLInputElement).checked)}
				/>
				<span>Latch</span>
			</label>
			<label>
				<span>Gate</span>
				<input type="range" min="0.05" max="1" step="0.05" bind:value={arp.gate} />
			</label>
			<label>
				<span>Swing</span>
				<input type="range" min="0" max={MAX_SWING} step="0.05" bind:value={arp.swing} />
			</label>
			<label>
				<span>Vel</span>
				<select bind:value={arp.velocityMode}>
					{#each VEL_MODES as m (m.id)}
						<option value={m.id}>{m.label}</option>
					{/each}
				</select>
			</label>
			{#if arp.velocityMode !== 'played'}
				<label>
					<span>Lvl</span>
					<input type="range" min="1" max="127" bind:value={arp.velocity} />
				</label>
			{/if}
		</div>

		<button class="panic" onclick={panic} disabled={!ready} title="Send All Notes Off">
			Panic
		</button>
	</div>

	{#if seqOpen}
		<div class="drawer">
			<SequencerControl />
		</div>
	{/if}

	<div class="keys">
		<Keyboard />
	</div>
</section>

<style>
	.face {
		background: var(--bg-panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.9rem 1rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}
	.face-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.brand strong {
		font-size: 1.05rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.brand span {
		color: var(--text-faint);
		font-size: 0.8rem;
	}
	.led {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--text-faint);
		display: inline-block;
	}
	.led.on {
		background: var(--ok);
		box-shadow: 0 0 8px 1px color-mix(in srgb, var(--ok) 60%, transparent);
	}
	.tempo {
		--knob: 2.9rem;
		--knob-w: 5rem;
	}
	.patch {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.patch input[type='text'] {
		width: 9rem;
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		border-radius: 7px;
		padding: 0.4rem 0.55rem;
		font-size: 0.82rem;
	}
	.patch select {
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		border-radius: 7px;
		padding: 0.4rem 0.4rem;
		font-size: 0.8rem;
		color: var(--text);
	}
	.mini {
		background: var(--bg-panel-2);
		border: 1px solid var(--border-strong);
		border-radius: 7px;
		padding: 0.4rem 0.6rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text);
	}
	.mini:hover:not(:disabled) {
		border-color: var(--accent);
	}
	.mini.sel {
		border-color: var(--accent);
		color: var(--accent);
	}
	.feedback {
		margin: -0.3rem 0 0;
		font-size: 0.8rem;
	}
	.feedback.ok {
		color: var(--ok);
	}
	.feedback.bad {
		color: var(--danger);
	}
	.drawer {
		border-radius: var(--radius);
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.row {
		display: flex;
		gap: 0.7rem;
		flex-wrap: wrap;
	}
	.grp {
		border: 1px solid var(--border-strong);
		border-radius: 10px;
		padding: 0.35rem 0.7rem 0.5rem;
		margin: 0;
		flex: 1 1 auto;
	}
	.grp legend {
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--text-dim);
		font-weight: 700;
		padding: 0 0.35rem;
	}
	.knobs {
		display: flex;
		gap: 0.4rem;
		justify-content: space-around;
	}
	.strip {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.9rem;
		flex-wrap: wrap;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-panel-2);
		padding: 0.45rem 0.7rem;
	}
	.cluster {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
	}
	.big {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		padding: 0.45rem 0.8rem;
		font-weight: 650;
		font-size: 0.85rem;
		color: var(--text-dim);
	}
	.big:hover:not(:disabled) {
		border-color: var(--accent);
	}
	.big.sel {
		color: var(--text);
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 18%, var(--bg-input));
	}
	.big:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.big .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-faint);
	}
	.big .dot.on {
		background: var(--ok);
		box-shadow: 0 0 7px 1px color-mix(in srgb, var(--ok) 60%, transparent);
	}
	.arp-set {
		gap: 0.7rem;
	}
	.arp-set.dim {
		opacity: 0.55;
	}
	.arp-set label {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-faint);
	}
	.arp-set select {
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		padding: 0.28rem 0.3rem;
		font-size: 0.78rem;
		color: var(--text);
	}
	.arp-set input[type='range'] {
		width: 4.2rem;
	}
	.arp-set .check {
		color: var(--text-dim);
		font-size: 0.72rem;
		text-transform: none;
		letter-spacing: 0;
	}
	.panic {
		font-size: 0.72rem;
		font-weight: 600;
		padding: 0.35rem 0.7rem;
		border-radius: 7px;
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
	.keys {
		border-top: 1px solid var(--border);
		padding-top: 0.7rem;
	}
</style>
