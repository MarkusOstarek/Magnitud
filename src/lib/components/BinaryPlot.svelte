<script lang="ts">
	interface Props {
		p1: number | null;
		p2: number | null;
		label1?: string;
		label2?: string;
		labelEvent?: string;
		svgEl?: SVGSVGElement;
	}

	let {
		p1,
		p2,
		label1 = 'Group 1',
		label2 = 'Group 2',
		labelEvent = 'event',
		svgEl = $bindable()
	}: Props = $props();

	// ── Layout constants ───────────────────────────────────────────
	const ROWS = 10;
	const COLS = 10;
	const TOTAL = ROWS * COLS; // 100 dots
	const R  = 6;              // dot radius
	const SP = 17;             // center-to-center spacing

	// Left group: center at x=125
	const X0_L = 125 - Math.floor(COLS / 2) * SP + Math.floor(SP / 2); // ≈ 51
	// Right group: center at x=375
	const X0_R = 375 - Math.floor(COLS / 2) * SP + Math.floor(SP / 2); // ≈ 301
	const Y0   = 62; // top of first row

	// ── Derived values ─────────────────────────────────────────────
	let n1Colored = $derived(
		p1 !== null ? Math.round(Math.max(0, Math.min(1, p1)) * TOTAL) : 0
	);
	let n2Colored = $derived(
		p2 !== null ? Math.round(Math.max(0, Math.min(1, p2)) * TOTAL) : 0
	);

	interface Dot { cx: number; cy: number; colored: boolean }

	function makeDots(x0: number, nColored: number): Dot[] {
		return Array.from({ length: TOTAL }, (_, i) => ({
			cx: x0 + (i % COLS) * SP,
			cy: Y0 + Math.floor(i / COLS) * SP,
			colored: i < nColored
		}));
	}

	let leftDots  = $derived(makeDots(X0_L, n1Colored));
	let rightDots = $derived(makeDots(X0_R, n2Colored));

	let p1Label = $derived(p1 !== null ? `${(p1 * 100).toFixed(1)}%` : '—');
	let p2Label = $derived(p2 !== null ? `${(p2 * 100).toFixed(1)}%` : '—');

	let isVerySmall1 = $derived(p1 !== null && p1 > 0 && p1 < 0.01);
	let isVerySmall2 = $derived(p2 !== null && p2 > 0 && p2 < 0.01);
</script>

<svg
	bind:this={svgEl}
	width="100%"
	viewBox="0 0 500 272"
	preserveAspectRatio="xMidYMid meet"
	role="img"
	aria-label="Binary outcomes waffle chart — each dot represents 1 person in 100"
	style="display: block;"
>
	<rect width="500" height="272" fill="white" />

	<!-- Divider line between groups -->
	<line x1="250" y1="10" x2="250" y2="225"
		stroke="#f3f4f6" stroke-width="1.5" />

	<!-- Group 1 header -->
	<text x="125" y="18" text-anchor="middle"
		font-family="ui-sans-serif, system-ui, sans-serif"
		font-size="12" font-weight="600" fill="#374151"
	>{label1}</text>
	<text x="125" y="38" text-anchor="middle"
		font-family="ui-sans-serif, system-ui, sans-serif"
		font-size="20" font-weight="700" fill="#f97316"
	>{p1Label}</text>
	{#if isVerySmall1}
		<text x="125" y="52" text-anchor="middle"
			font-family="ui-sans-serif, system-ui, sans-serif"
			font-size="9" fill="#d97706"
		>(&lt; 1% — dot resolution limited)</text>
	{/if}

	<!-- Group 2 header -->
	<text x="375" y="18" text-anchor="middle"
		font-family="ui-sans-serif, system-ui, sans-serif"
		font-size="12" font-weight="600" fill="#374151"
	>{label2}</text>
	<text x="375" y="38" text-anchor="middle"
		font-family="ui-sans-serif, system-ui, sans-serif"
		font-size="20" font-weight="700" fill="#9ca3af"
	>{p2Label}</text>
	{#if isVerySmall2}
		<text x="375" y="52" text-anchor="middle"
			font-family="ui-sans-serif, system-ui, sans-serif"
			font-size="9" fill="#d97706"
		>(&lt; 1% — dot resolution limited)</text>
	{/if}

	<!-- Left waffle -->
	{#each leftDots as dot, i (i)}
		<circle
			cx={dot.cx} cy={dot.cy} r={R}
			fill={dot.colored ? '#f97316' : '#e5e7eb'}
			stroke={dot.colored ? '#ea580c' : '#d1d5db'}
			stroke-width="0.8"
		/>
	{/each}

	<!-- Right waffle -->
	{#each rightDots as dot, i (i)}
		<circle
			cx={dot.cx} cy={dot.cy} r={R}
			fill={dot.colored ? '#fb923c' : '#e5e7eb'}
			stroke={dot.colored ? '#ea580c' : '#d1d5db'}
			stroke-width="0.8"
		/>
	{/each}

	<!-- Legend — symmetric split at x=250 -->
	<!-- Left item: "{labelEvent} ●" right-aligned to center -->
	<text x="237" y="252"
		text-anchor="end"
		font-family="ui-sans-serif, system-ui, sans-serif"
		font-size="11" fill="#6b7280"
	>{labelEvent}</text>
	<circle cx="242" cy="248" r="5" fill="#f97316" stroke="#ea580c" stroke-width="0.8" />
	<!-- Right item: "● no {labelEvent}" left-aligned from center -->
	<circle cx="258" cy="248" r="5" fill="#e5e7eb" stroke="#d1d5db" stroke-width="0.8" />
	<text x="263" y="252"
		text-anchor="start"
		font-family="ui-sans-serif, system-ui, sans-serif"
		font-size="11" fill="#6b7280"
	>no {labelEvent}</text>
	<!-- Scale note, centered -->
	<text x="250" y="268"
		text-anchor="middle"
		font-family="ui-sans-serif, system-ui, sans-serif"
		font-size="10" fill="#9ca3af"
	>Each dot = 1 person · 100 people per group</text>

	{#if p1 === null && p2 === null}
		<text x="250" y="148" text-anchor="middle"
			font-family="ui-sans-serif, system-ui, sans-serif"
			font-size="12" fill="#9ca3af"
		>Enter values to see the chart</text>
	{/if}
</svg>
