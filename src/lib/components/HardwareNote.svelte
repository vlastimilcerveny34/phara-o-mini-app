<script lang="ts">
	let open = $state(false);
</script>

<section class="note">
	<button class="head" onclick={() => (open = !open)} aria-expanded={open}>
		<span class="icon">ⓘ</span>
		<span class="title">Synth not responding? Check the hardware MIDI settings</span>
		<span class="chev" class:open>▾</span>
	</button>
	{#if open}
		<div class="body">
			<p>
				For the Phara-O to react to incoming MIDI over USB, its MIDI receive must be
				enabled. If it stays silent, this is almost always why.
			</p>
			<ul>
				<li>
					<strong>CC receive:</strong> make sure <em>MIDI Rx</em> is on. That's all that's
					needed for the knobs and switches on this page.
				</li>
				<li>
					<strong>Tempo over clock (future):</strong> for the planned tempo feature you'll
					need <em>Clock Source = USB MIDI</em>. Set it by holding
					<strong>FUNC + key 7</strong> while powering the unit on.
				</li>
				<li>
					Match the <strong>MIDI channel</strong> above to the synth's channel (default 1).
				</li>
			</ul>
			<p class="oneway">
				Remember: this app is one-way (app → synth). It can't read the physical knob
				positions, so the values shown here are what the app has sent, not necessarily
				where the hardware knobs sit.
			</p>
		</div>
	{/if}
</section>

<style>
	.note {
		background: color-mix(in srgb, var(--accent) 8%, var(--bg-panel));
		border: 1px solid var(--accent-dim);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.head {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		background: transparent;
		border: none;
		padding: 0.75rem 1rem;
		text-align: left;
		color: var(--text);
		font-size: 0.88rem;
		font-weight: 600;
	}
	.icon {
		color: var(--accent);
		font-size: 1rem;
	}
	.title {
		flex: 1;
	}
	.chev {
		transition: transform 0.15s;
		color: var(--text-faint);
	}
	.chev.open {
		transform: rotate(180deg);
	}
	.body {
		padding: 0 1rem 1rem;
		font-size: 0.83rem;
		color: var(--text-dim);
		line-height: 1.5;
	}
	.body p {
		margin: 0.4rem 0;
	}
	.body ul {
		margin: 0.5rem 0;
		padding-left: 1.1rem;
	}
	.body li {
		margin: 0.3rem 0;
	}
	.body strong {
		color: var(--text);
	}
	.oneway {
		color: var(--text-faint);
		border-top: 1px solid var(--border);
		padding-top: 0.6rem;
		margin-top: 0.7rem !important;
	}
</style>
