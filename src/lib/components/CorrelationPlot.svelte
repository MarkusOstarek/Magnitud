<script lang="ts">
	import * as d3 from 'd3';

	interface Props {
		r?: number;
		labelX?: string;
		labelY?: string;
		svgEl?: SVGSVGElement;
	}

	let { r = 0.3, labelX = 'Variable X', labelY = 'Variable Y', svgEl = $bindable() }: Props = $props();

	const VIEW_W = 500, VIEW_H = 340;
	const M = { top: 16, right: 20, bottom: 48, left: 48 };
	const IW = VIEW_W - M.left - M.right; // 432
	const IH = VIEW_H - M.top - M.bottom; // 276

	const DOMAIN: [number, number] = [-3.3, 3.3];

	// Mulberry32 seeded PRNG — deterministic scatter
	function mulberry32(seed: number) {
		return () => {
			seed |= 0;
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	// Box-Muller pairs
	function normalPair(rand: () => number): [number, number] {
		const u = Math.sqrt(-2 * Math.log(rand() + 1e-10));
		const v = 2 * Math.PI * rand();
		return [u * Math.cos(v), u * Math.sin(v)];
	}

	// 150 base variates generated once (fixed seed = reproducible)
	const N = 150;
	const rng = mulberry32(42);
	const baseU: number[] = [];
	const baseV: number[] = [];
	for (let i = 0; i < N; i++) {
		const [u, v] = normalPair(rng);
		baseU.push(u);
		baseV.push(v);
	}

	const xScale = d3.scaleLinear().domain(DOMAIN).range([0, IW]);
	const yScale = d3.scaleLinear().domain(DOMAIN).range([IH, 0]);

	function render(svg: SVGSVGElement, rVal: number, lx: string, ly: string) {
		const root = d3.select(svg);

		// ── Build static structure once ────────────────────────────
		let g = root.select<SVGGElement>('g.main');
		if (g.empty()) {
			// Clip path
			root.select('defs').remove();
			root
				.insert('defs', ':first-child')
				.append('clipPath')
				.attr('id', 'corr-clip')
				.append('rect')
				.attr('width', IW)
				.attr('height', IH);

			g = root
				.append('g')
				.attr('class', 'main')
				.attr('transform', `translate(${M.left},${M.top})`);

			// Plot background
			g.append('rect')
				.attr('width', IW)
				.attr('height', IH)
				.attr('fill', '#fafafa')
				.attr('rx', 4)
				.attr('stroke', '#e5e7eb')
				.attr('stroke-width', 1);

			// Horizontal zero line
			g.append('line')
				.attr('class', 'ax-x')
				.attr('x1', 0)
				.attr('x2', IW)
				.attr('y1', yScale(0))
				.attr('y2', yScale(0))
				.attr('stroke', '#d1d5db')
				.attr('stroke-width', 0.75);

			// Vertical zero line
			g.append('line')
				.attr('class', 'ax-y')
				.attr('x1', xScale(0))
				.attr('x2', xScale(0))
				.attr('y1', 0)
				.attr('y2', IH)
				.attr('stroke', '#d1d5db')
				.attr('stroke-width', 0.75);

			// Regression line (clipped)
			g.append('line')
				.attr('class', 'reg-line')
				.attr('clip-path', 'url(#corr-clip)')
				.attr('stroke', '#7c3aed')
				.attr('stroke-width', 1.75)
				.attr('stroke-dasharray', '6 3')
				.attr('opacity', 0.75);

			// Dots group (on top of regression line)
			const dotsG = g.append('g').attr('class', 'dots').attr('clip-path', 'url(#corr-clip)');

			dotsG
				.selectAll<SVGCircleElement, number>('circle')
				.data(baseU)
				.enter()
				.append('circle')
				.attr('r', 3.5)
				.attr('fill', '#8b5cf6')
				.attr('fill-opacity', 0.45)
				.attr('cx', (_, i) => xScale(baseU[i]))
				.attr('cy', IH / 2);

			// X axis label (text set in dynamic section)
			g.append('text')
				.attr('class', 'lbl-x')
				.attr('x', IW / 2)
				.attr('y', IH + 38)
				.attr('text-anchor', 'middle')
				.attr('fill', '#9ca3af')
				.attr('font-size', 11)
				.attr('font-family', 'inherit');

			// Y axis label (text set in dynamic section)
			g.append('text')
				.attr('class', 'lbl-y')
				.attr('transform', `translate(-36,${IH / 2}) rotate(-90)`)
				.attr('text-anchor', 'middle')
				.attr('fill', '#9ca3af')
				.attr('font-size', 11)
				.attr('font-family', 'inherit');
		}

		// ── Update dynamic elements with transitions ────────────────
		const sqrtTerm = Math.sqrt(Math.max(0, 1 - rVal ** 2));

		g.select<SVGGElement>('g.dots')
			.selectAll<SVGCircleElement, number>('circle')
			.data(baseU)
			.transition()
			.duration(200)
			.ease(d3.easeQuadOut)
			.attr('cx', (_, i) => xScale(baseU[i]))
			.attr('cy', (_, i) => yScale(rVal * baseU[i] + sqrtTerm * baseV[i]));

		// Axis labels (update whenever labels change)
		g.select('text.lbl-x').text(`${lx} (standardised)`);
		g.select('text.lbl-y').text(`${ly} (standardised)`);

		// Regression line y = r·x, clipped to domain
		const [d0, d1] = DOMAIN;
		const ry0 = Math.max(d0, Math.min(d1, rVal * d0));
		const ry1 = Math.max(d0, Math.min(d1, rVal * d1));

		g.select<SVGLineElement>('line.reg-line')
			.transition()
			.duration(200)
			.ease(d3.easeQuadOut)
			.attr('x1', xScale(d0))
			.attr('y1', yScale(ry0))
			.attr('x2', xScale(d1))
			.attr('y2', yScale(ry1));
	}

	$effect(() => {
		if (svgEl) render(svgEl, r, labelX, labelY);
	});
</script>

<svg
	bind:this={svgEl}
	width="100%"
	viewBox="0 0 {VIEW_W} {VIEW_H}"
	preserveAspectRatio="xMidYMid meet"
	aria-label="Scatter plot showing correlation r = {r.toFixed(2)}"
	role="img"
></svg>
