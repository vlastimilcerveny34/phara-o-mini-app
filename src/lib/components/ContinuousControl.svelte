<script lang="ts">
	import type { ContinuousParam } from '$lib/params';
	import { paramState } from '$lib/paramState.svelte';

	let { param }: { param: ContinuousParam } = $props();

	let value = $derived(paramState.getContinuous(param.id));
	let pct = $derived((value / 127) * 100);

	function onInput(e: Event) {
		const v = Number((e.currentTarget as HTMLInputElement).value);
		paramState.setContinuous(param.id, v);
	}
</script>

<div class="ctrl">
	<div class="top">
		<span class="label" title={param.chartName}>{param.label}</span>
		<span class="value">{value}</span>
	</div>
	<input
		type="range"
		min={param.min}
		max={param.max}
		step="1"
		{value}
		oninput={onInput}
		style="--pct: {pct}%"
		aria-label="{param.label} ({param.chartName}), CC {param.cc}"
	/>
	<div class="meta">
		<span class="cc">CC {param.cc}</span>
	</div>
</div>

<style>
	.ctrl {
		background: var(--bg-panel-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.7rem 0.8rem 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.label {
		font-size: 0.82rem;
		color: var(--text-dim);
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.value {
		font-family: var(--mono);
		font-size: 1.55rem;
		font-weight: 600;
		line-height: 1;
		color: var(--text);
		font-variant-numeric: tabular-nums;
		min-width: 2.4ch;
		text-align: right;
	}
	input[type='range'] {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 8px;
		border-radius: 5px;
		background: linear-gradient(
			to right,
			var(--accent) 0%,
			var(--accent) var(--pct),
			var(--bg-input) var(--pct),
			var(--bg-input) 100%
		);
		border: 1px solid var(--border-strong);
		cursor: pointer;
	}
	input[type='range']:focus-visible {
		outline: 2px solid var(--accent-2);
		outline-offset: 3px;
	}
	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--text);
		border: 2px solid var(--accent);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
	}
	input[type='range']::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--text);
		border: 2px solid var(--accent);
	}
	.meta {
		display: flex;
		justify-content: flex-end;
	}
	.cc {
		font-family: var(--mono);
		font-size: 0.65rem;
		color: var(--text-faint);
		letter-spacing: 0.03em;
	}
</style>
