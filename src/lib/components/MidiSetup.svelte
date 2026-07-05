<script lang="ts">
	import { midi, PHARAO_PORT_HINT } from '$lib/midi.svelte';

	const statusText: Record<string, string> = {
		unsupported: 'Web MIDI not supported in this browser',
		idle: 'Not connected',
		requesting: 'Requesting access…',
		denied: 'Permission denied',
		ready: 'MIDI ready',
		error: 'MIDI error'
	};

	const channels = Array.from({ length: 16 }, (_, i) => i + 1);

	let dotClass = $derived(
		midi.status === 'ready'
			? 'ok'
			: midi.status === 'requesting'
				? 'pending'
				: midi.status === 'unsupported'
					? 'off'
					: 'bad'
	);

	function portIsPharao(name: string) {
		return name.toUpperCase().includes(PHARAO_PORT_HINT);
	}
</script>

<section class="setup">
	<header>
		<h2>MIDI Setup</h2>
		<div class="status">
			<span class="dot {dotClass}"></span>
			<span>{statusText[midi.status]}</span>
		</div>
	</header>

	{#if midi.status === 'unsupported'}
		<p class="msg bad">
			This browser has no Web MIDI API. Use Chrome or Chromium (on Linux it speaks to ALSA).
		</p>
	{:else if midi.status === 'idle'}
		<button class="primary" onclick={() => midi.init()}>Connect MIDI</button>
		<p class="hint">The browser will ask for permission to use MIDI devices.</p>
	{:else}
		{#if midi.status === 'denied'}
			<p class="msg bad">
				Access was denied. Allow MIDI for this site and try again.
			</p>
			<button class="primary" onclick={() => midi.init()}>Retry</button>
		{:else if midi.status === 'error'}
			<p class="msg bad">{midi.errorMessage || 'Unknown MIDI error.'}</p>
			<button class="primary" onclick={() => midi.init()}>Retry</button>
		{/if}

		<div class="fields">
			<label>
				<span>Output port</span>
				{#if midi.outputs.length === 0}
					<select disabled>
						<option>No MIDI outputs found</option>
					</select>
				{:else}
					<select
						value={midi.selectedPortId}
						onchange={(e) => midi.selectPort((e.currentTarget as HTMLSelectElement).value)}
					>
						{#each midi.outputs as port (port.id)}
							<option value={port.id}>
								{portIsPharao(port.name) ? '★ ' : ''}{port.name}
							</option>
						{/each}
					</select>
				{/if}
			</label>

			<label class="channel">
				<span>Channel</span>
				<select
					value={midi.channel}
					onchange={(e) =>
						midi.setChannel(Number((e.currentTarget as HTMLSelectElement).value))}
				>
					{#each channels as ch (ch)}
						<option value={ch}>{ch}</option>
					{/each}
				</select>
			</label>

			<label>
				<span>Input port <small>(keyboard → synth)</small></span>
				<select
					value={midi.selectedInputId ?? ''}
					onchange={(e) => {
						const v = (e.currentTarget as HTMLSelectElement).value;
						midi.selectInput(v === '' ? null : v);
					}}
				>
					<option value="">None</option>
					{#each midi.inputs as port (port.id)}
						<option value={port.id}>{port.name}</option>
					{/each}
				</select>
			</label>
		</div>

		{#if midi.outputs.length === 0}
			<p class="hint">
				No outputs detected. Connect the Phara-O via USB, then reconnect it — the list
				refreshes automatically.
			</p>
		{:else if midi.selectedPort && !portIsPharao(midi.selectedPort.name)}
			<p class="hint">
				No port named “{PHARAO_PORT_HINT}” was found — using
				<strong>{midi.selectedPort.name}</strong>. Pick the right one above if needed.
			</p>
		{/if}
	{/if}
</section>

<style>
	.setup {
		background: var(--bg-panel-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.7rem 0.8rem 0.75rem;
		height: 100%;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		row-gap: 0.3rem;
		flex-wrap: wrap;
		margin-bottom: 0.7rem;
	}
	h2 {
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-dim);
	}
	.status {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		color: var(--text-dim);
		white-space: nowrap;
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--text-faint);
		flex: none;
	}
	.dot.ok {
		background: var(--ok);
		box-shadow: 0 0 8px 1px color-mix(in srgb, var(--ok) 60%, transparent);
	}
	.dot.pending {
		background: var(--accent);
	}
	.dot.bad {
		background: var(--danger);
	}
	.dot.off {
		background: var(--text-faint);
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	label.channel {
		max-width: 7rem;
	}
	label span {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-faint);
	}
	label span small {
		text-transform: none;
		letter-spacing: 0;
		font-size: 0.9em;
		opacity: 0.8;
	}
	select {
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		border-radius: 7px;
		padding: 0.5rem 0.6rem;
		font-size: 0.9rem;
		width: 100%;
	}
	select:focus-visible {
		outline: 2px solid var(--accent-2);
		outline-offset: 1px;
	}
	.primary {
		background: var(--accent);
		color: #1a1206;
		border: none;
		border-radius: 8px;
		padding: 0.55rem 1rem;
		font-weight: 650;
		font-size: 0.9rem;
	}
	.primary:hover {
		filter: brightness(1.06);
	}
	.hint {
		margin: 0.7rem 0 0;
		font-size: 0.8rem;
		color: var(--text-faint);
	}
	.msg {
		margin: 0 0 0.7rem;
		font-size: 0.85rem;
	}
	.msg.bad {
		color: var(--danger);
	}
</style>
