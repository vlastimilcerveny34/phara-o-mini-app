<script lang="ts">
	import type { UnavailableParam } from '$lib/params';
	let { param }: { param: UnavailableParam } = $props();
</script>

<div class="ctrl" aria-disabled="true">
	<div class="top">
		<span class="label">{param.label}</span>
		<span class="badge">hardware only</span>
	</div>
	<p class="note">{param.note}</p>
</div>

<style>
	.ctrl {
		background: repeating-linear-gradient(
			45deg,
			var(--bg-panel-2),
			var(--bg-panel-2) 10px,
			color-mix(in srgb, var(--bg-panel-2) 92%, #000) 10px,
			color-mix(in srgb, var(--bg-panel-2) 92%, #000) 20px
		);
		border: 1px dashed var(--border-strong);
		border-radius: var(--radius);
		padding: 0.7rem 0.8rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		opacity: 0.85;
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.label {
		font-size: 0.82rem;
		color: var(--text-dim);
		font-weight: 600;
	}
	.badge {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--text-faint);
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		padding: 0.1rem 0.35rem;
		white-space: nowrap;
	}
	.note {
		margin: 0;
		font-size: 0.74rem;
		color: var(--text-faint);
		line-height: 1.35;
	}
</style>
