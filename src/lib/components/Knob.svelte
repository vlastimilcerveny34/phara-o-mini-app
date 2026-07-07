<script lang="ts">
	/**
	 * Rotary knob — the synth view's universal control. Purely presentational:
	 * takes a value + range and reports changes; the caller decides what a value
	 * means (continuous CC, stepped option index, BPM…).
	 *
	 * Interaction: vertical drag (Shift = fine), mouse wheel, arrow keys /
	 * PageUp/Down / Home/End when focused. Disabled knobs render ghosted with an
	 * optional badge (used for the hardware-only params like Resonance).
	 */
	let {
		label,
		value,
		min = 0,
		max = 127,
		display,
		disabled = false,
		badge = '',
		title = '',
		onchange
	}: {
		label: string;
		value: number;
		min?: number;
		max?: number;
		/** Text under the knob; defaults to the numeric value. */
		display?: string;
		disabled?: boolean;
		/** Small corner badge, e.g. "HW" for hardware-only params. */
		badge?: string;
		title?: string;
		onchange?: (v: number) => void;
	} = $props();

	// Classic knob orientation: min points down-left (225°), max down-right
	// (495° = 135°), sweeping 270° clockwise through the top. 0° = up.
	const START = 225; // pointer angle at min
	const SWEEP = 270; // degrees of travel between min and max

	let frac = $derived(max > min ? (value - min) / (max - min) : 0);
	let angle = $derived(START + SWEEP * frac);

	// Arc path helper (SVG). Angles in the same space as `angle`.
	function arc(from: number, to: number, r: number) {
		const s = pt(r, from);
		const e = pt(r, to);
		return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
	}
	/** Point on a circle of radius r around (50,50); 0° points up. */
	function pt(r: number, deg: number) {
		const rad = ((deg - 90) * Math.PI) / 180;
		return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
	}
	let tip = $derived(pt(26, angle));
	let tail = $derived(pt(11, angle));

	function set(v: number) {
		if (disabled) return;
		onchange?.(Math.min(max, Math.max(min, Math.round(v))));
	}

	// --- vertical drag ---------------------------------------------------------
	let dragging = false;
	let startY = 0;
	let startVal = 0;

	function onPointerDown(e: PointerEvent) {
		if (disabled) return;
		dragging = true;
		startY = e.clientY;
		startVal = value;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.preventDefault();
	}
	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		// Full sweep over ~150 px of travel; Shift slows it 4× for fine tuning.
		const px = e.shiftKey ? 600 : 150;
		set(startVal + ((startY - e.clientY) * (max - min)) / px);
	}
	function onPointerUp() {
		dragging = false;
	}

	function onWheel(e: WheelEvent) {
		if (disabled) return;
		e.preventDefault();
		const step = max - min > 12 && !e.shiftKey ? 3 : 1;
		set(value + (e.deltaY < 0 ? step : -step));
	}

	function onKey(e: KeyboardEvent) {
		if (disabled) return;
		const big = Math.max(1, Math.round((max - min) / 12));
		if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(value + 1);
		else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(value - 1);
		else if (e.key === 'PageUp') set(value + big);
		else if (e.key === 'PageDown') set(value - big);
		else if (e.key === 'Home') set(min);
		else if (e.key === 'End') set(max);
		else return;
		e.preventDefault();
	}
</script>

<div class="knob" class:disabled {title}>
	<div
		class="dial"
		role="slider"
		tabindex={disabled ? -1 : 0}
		aria-label={label}
		aria-valuemin={min}
		aria-valuemax={max}
		aria-valuenow={value}
		aria-valuetext={display}
		aria-disabled={disabled}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onwheel={onWheel}
		onkeydown={onKey}
	>
		<svg viewBox="0 0 100 100" aria-hidden="true">
			<path class="track" d={arc(START, START + SWEEP, 38)} />
			{#if !disabled && frac > 0.004}
				<path class="fill" d={arc(START, angle, 38)} />
			{/if}
			<circle class="cap" cx="50" cy="50" r="26" />
			<line class="ptr" x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} />
		</svg>
		{#if badge}<span class="badge">{badge}</span>{/if}
	</div>
	<span class="k-label">{label}</span>
	<span class="k-value">{display ?? value}</span>
</div>

<style>
	.knob {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.1rem;
		width: var(--knob-w, 4.6rem);
	}
	.knob.disabled {
		opacity: 0.45;
	}
	.dial {
		position: relative;
		width: var(--knob, 3.4rem);
		height: var(--knob, 3.4rem);
		cursor: ns-resize;
		touch-action: none;
		border-radius: 50%;
	}
	.knob.disabled .dial {
		cursor: not-allowed;
	}
	.dial:focus-visible {
		outline: 2px solid var(--accent-2);
		outline-offset: 2px;
	}
	svg {
		width: 100%;
		height: 100%;
		display: block;
	}
	.track {
		fill: none;
		stroke: var(--bg-input);
		stroke-width: 7;
		stroke-linecap: round;
	}
	.fill {
		fill: none;
		stroke: var(--accent);
		stroke-width: 7;
		stroke-linecap: round;
	}
	.cap {
		fill: var(--bg-panel-2);
		stroke: var(--border-strong);
		stroke-width: 2;
	}
	.ptr {
		stroke: var(--text);
		stroke-width: 5;
		stroke-linecap: round;
	}
	.badge {
		position: absolute;
		top: -0.2rem;
		right: -0.4rem;
		font-size: 0.5rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--text-ghost);
		background: var(--bg-input);
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		padding: 0.05rem 0.25rem;
	}
	.k-label {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-dim);
		font-weight: 650;
		margin-top: 0.15rem;
		text-align: center;
		white-space: nowrap;
	}
	.k-value {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--text);
		font-variant-numeric: tabular-nums;
		min-height: 1em;
		text-align: center;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
