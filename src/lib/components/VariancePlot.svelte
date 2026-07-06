<script lang="ts">
	interface Props {
		eta2: number | null;
		cohensF?: number | null;
		isPartial?: boolean;
		svgEl?: SVGSVGElement;
	}

	let {
		eta2,
		cohensF = null,
		isPartial = false,
		svgEl = $bindable()
	}: Props = $props();

	// ── Layout constants ──────────────────────────────────────────
	const ROWS = 5;
	const COLS = 20;
	const TOTAL = ROWS * COLS; // 100 dots
	const R = 9;               // dot radius
	const SP = 23;             // center-to-center spacing
	const X0 = 31;             // cx of first dot (col 0)
	const Y0 = 59;             // cy of first dot (row 0)

	// ── Derived values ────────────────────────────────────────────
	let nColored = $derived(
		eta2 !== null ? Math.round(Math.max(0, Math.min(1, eta2)) * TOTAL) : 0
	);

	interface Dot { cx: number; cy: number; colored: boolean }

	let dots = $derived<Dot[]>(
		Array.from({ length: TOTAL }, (_, i) => ({
			cx: X0 + (i % COLS) * SP,
			cy: Y0 + Math.floor(i / COLS) * SP,
			colored: i < nColored
		}))
	);

	let metricLabel = $derived(isPartial ? 'Partial η²' : 'η²');
	let pctLabel    = $derived(eta2 !== null ? `${(eta2 * 100).toFixed(2)}%` : '—');
	let fLabel      = $derived(
		cohensF !== null && Number.isFinite(cohensF) ? cohensF.toFixed(3) : '—'
	);
	// Flag small effects where dot resolution is misleading
	let isVerySmall = $derived(eta2 !== null && eta2 > 0 && eta2 < 0.01);
</script>

<svg
	bind:this={svgEl}
	width="100%"
	viewBox="0 0 500 193"
	preserveAspectRatio="xMidYMid meet"
	role="img"
	aria-label="Variance explained waffle chart — each of 100 dots represents 1% of total variance"
	style="display: block;"
>
	<!-- Background -->
	<rect width="500" height="193" fill="white" />

	<!-- Title: metric value -->
	<text
		x="250" y="18"
		text-anchor="middle"
		font-family="ui-sans-serif, system-ui, sans-serif"
		font-size="14"
		font-weight="600"
		fill="#111827"
	>
		{metricLabel} = {pctLabel}{fLabel !== '—' ? `  ·  Cohen's f = ${fLabel}` : ''}
	</text>

	<!-- Subtitle: explained count or small-effect note -->
	{#if isVerySmall}
		<text
			x="250" y="36"
			text-anchor="middle"
			font-family="ui-sans-serif, system-ui, sans-serif"
			font-size="11"
			font-weight="500"
			fill="#d97706"
		>
			Less than 1% of variance explained — dot resolution is too coarse to show this accurately
		</text>
	{:else}
		<text
			x="250" y="36"
			text-anchor="middle"
			font-family="ui-sans-serif, system-ui, sans-serif"
			font-size="11"
			fill="#6b7280"
		>
			{eta2 !== null
				? `${nColored} of 100 units of variance explained`
				: 'Enter values to see variance explained'}
		</text>
	{/if}

	<!-- Dots: 20 × 5 = 100 total -->
	{#each dots as dot, i (i)}
		<circle
			cx={dot.cx}
			cy={dot.cy}
			r={R}
			fill={dot.colored ? '#10b981' : '#e5e7eb'}
			stroke={dot.colored ? '#059669' : '#d1d5db'}
			stroke-width="1"
		/>
	{/each}

	<!-- Legend -->
	<g transform="translate(145, 170)">
		<circle cx="0" cy="0" r="5" fill="#10b981" stroke="#059669" stroke-width="1" />
		<text
			x="10" y="4"
			font-family="ui-sans-serif, system-ui, sans-serif"
			font-size="11"
			fill="#6b7280"
		>Explained</text>

		<circle cx="90" cy="0" r="5" fill="#e5e7eb" stroke="#d1d5db" stroke-width="1" />
		<text
			x="100" y="4"
			font-family="ui-sans-serif, system-ui, sans-serif"
			font-size="11"
			fill="#6b7280"
		>Unexplained</text>
	</g>
</svg>
