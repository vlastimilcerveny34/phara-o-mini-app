<script lang="ts">
	import { midi } from '$lib/midi.svelte';
	import { arp, ARP_MODES, ARP_DIVISIONS, MAX_SWING, type ArpVelocityMode } from '$lib/arp.svelte';
	import { noteName } from '$lib/sequencer.svelte';
	import { noteGenerator } from '$lib/noteGenerator.svelte';

	let ready = $derived(midi.isReady);
	let active = $derived(noteGenerator.active === 'arp');
	// Chips show the arpeggiated set low→high; the sounding one is highlighted.
	let chipNotes = $derived([...arp.notes.keys()].sort((a, b) => a - b));

	const VEL_MODES: { id: ArpVelocityMode; label: string }[] = [
		{ id: 'played', label: 'As played' },
		{ id: 'fixed', label: 'Fixed' },
		{ id: 'accent', label: 'Accent on beat' }
	];
</script>

<section class="arp">
	<header>
		<div class="title">
			<h2>Arpeggiator</h2>
			<!-- Turning the arp on stops the sequencer (one note generator at a time). -->
			<button
				class="power"
				class:on={active}
				onclick={() => noteGenerator.select('arp')}
				disabled={!ready}
				title={ready
					? 'The arp plays the notes you hold, in tempo'
					: 'Connect MIDI first'}
			>
				{active ? 'On' : 'Off'}
			</button>
			<label class="latch">
				<input
					type="checkbox"
					checked={arp.latch}
					onchange={(e) => arp.setLatch((e.currentTarget as HTMLInputElement).checked)}
				/>
				<span>Latch</span>
			</label>
		</div>
		{#if active && arp.currentNote >= 0}
			<span class="now">♪ {noteName(arp.currentNote)}</span>
		{/if}
	</header>

	<div class="settings">
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
			<span>Octaves</span>
			<select bind:value={arp.octaves}>
				{#each [1, 2, 3, 4] as n (n)}
					<option value={n}>{n}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Velocity</span>
			<select bind:value={arp.velocityMode}>
				{#each VEL_MODES as m (m.id)}
					<option value={m.id}>{m.label}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="sliders">
		<label class="field">
			<span>Gate <em>{Math.round(arp.gate * 100)}%</em></span>
			<input type="range" min="0.05" max="1" step="0.05" bind:value={arp.gate} />
		</label>
		<label class="field">
			<span>Swing <em>{Math.round(arp.swing * 100)}%</em></span>
			<input type="range" min="0" max={MAX_SWING} step="0.05" bind:value={arp.swing} />
		</label>
		<label class="field" class:dim={arp.velocityMode === 'played'}>
			<span>Level <em>{arp.velocity}</em></span>
			<input
				type="range"
				min="1"
				max="127"
				bind:value={arp.velocity}
				disabled={arp.velocityMode === 'played'}
			/>
		</label>
	</div>

	<div class="status">
		{#if !active}
			<p class="hint">
				Turn the arp <strong>On</strong>, hold a chord, and it plays the notes one at a time in
				tempo. Turning it on stops the sequencer (one note generator at a time).
			</p>
		{:else if chipNotes.length > 0}
			<div class="chips">
				{#each chipNotes as n (n)}
					<span class="chip" class:sounding={arp.currentNote % 12 === n % 12}
						>{noteName(n)}</span
					>
				{/each}
			</div>
		{:else}
			<p class="hint">
				Hold notes on the keyboard below (or your MIDI input) — the arp plays them one at a
				time.{#if arp.latch}&nbsp;Latch keeps them running after you let go.{/if}
			</p>
		{/if}
	</div>
</section>

<style>
	.arp {
		background: var(--bg-panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 1rem 1.1rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
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
	.power {
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		border-radius: 7px;
		padding: 0.4rem 0.9rem;
		font-weight: 650;
		font-size: 0.82rem;
		color: var(--text-dim);
	}
	.power:hover:not(.on):not(:disabled) {
		border-color: var(--accent);
	}
	.power.on {
		background: var(--ok);
		border-color: var(--ok);
		color: #08210f;
	}
	.power:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.latch {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		color: var(--text-dim);
	}
	.now {
		font-family: var(--mono);
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--ok);
	}
	.settings {
		display: flex;
		align-items: flex-end;
		gap: 0.8rem;
		flex-wrap: wrap;
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
		min-width: 5rem;
	}
	.sliders {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		gap: 0.7rem 1rem;
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
	.field.dim {
		opacity: 0.45;
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
	.status {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		flex-wrap: wrap;
	}
	.chips {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.chip {
		font-family: var(--mono);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-dim);
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		padding: 0.2rem 0.6rem;
	}
	.chip.sounding {
		color: var(--ok);
		border-color: var(--ok);
		background: color-mix(in srgb, var(--ok) 15%, var(--bg-input));
	}
	.hint {
		margin: 0;
		font-size: 0.78rem;
		color: var(--text-faint);
	}
	.hint strong {
		color: var(--text-dim);
	}
</style>
