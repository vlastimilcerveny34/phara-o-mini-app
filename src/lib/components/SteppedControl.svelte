<script lang="ts">
	import type { SteppedParam } from '$lib/params';
	import { paramState } from '$lib/paramState.svelte';

	let { param }: { param: SteppedParam } = $props();

	let selected = $derived(paramState.getStepIndex(param.id));
	let sendValue = $derived(param.options[selected].send);
</script>

<div class="ctrl">
	<div class="top">
		<span class="label" title={param.chartName}>{param.label}</span>
		<span class="value">{sendValue}</span>
	</div>
	<div class="segments" role="radiogroup" aria-label={param.label}>
		{#each param.options as opt, i (opt.label)}
			<button
				type="button"
				role="radio"
				aria-checked={selected === i}
				class:active={selected === i}
				onclick={() => paramState.setStep(param.id, i)}
				title="Sends CC {param.cc} = {opt.send} (chart band {opt.lo}–{opt.hi})"
			>
				{opt.label}
			</button>
		{/each}
	</div>
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
		gap: 0.45rem;
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
	}
	.value {
		font-family: var(--mono);
		font-size: 1.35rem;
		font-weight: 600;
		line-height: 1;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.segments {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.segments button {
		flex: 1 1 auto;
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		border-radius: 7px;
		padding: 0.42rem 0.6rem;
		font-size: 0.82rem;
		color: var(--text-dim);
		white-space: nowrap;
		transition:
			background 0.1s,
			color 0.1s,
			border-color 0.1s;
	}
	.segments button:hover {
		border-color: var(--accent);
		color: var(--text);
	}
	.segments button.active {
		background: var(--accent);
		border-color: var(--accent);
		color: #1a1206;
		font-weight: 650;
	}
	.segments button:focus-visible {
		outline: 2px solid var(--accent-2);
		outline-offset: 1px;
	}
	.meta {
		display: flex;
		justify-content: flex-end;
	}
	.cc {
		font-family: var(--mono);
		font-size: 0.65rem;
		color: var(--text-faint);
	}
</style>
