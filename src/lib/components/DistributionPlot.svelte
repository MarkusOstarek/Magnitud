<script lang="ts">
	import * as d3 from 'd3';
	import { normalPDF } from '$lib/math/distributions.js';
	import EditableLabel from './EditableLabel.svelte';

	interface Props {
		d?: number;
		showCLES?: boolean;
		showU3?: boolean;
		height?: number;
		label1?: string;
		label2?: string;
		editable?: boolean;
		onlabel1change?: (v: string) => void;
		onlabel2change?: (v: string) => void;
		svgEl?: SVGSVGElement;
	}

	let {
		d = 0.5,
		showCLES = false,
		showU3 = false,
		height = 280,
		label1 = 'Group 1',
		label2 = 'Group 2',
		editable = false,
		onlabel1change,
		onlabel2change,
		svgEl = $bindable()
	}: Props = $props();

	const BLUE  = '#4a7fb5';
	const CORAL = '#e07a5f';
	const MARGIN = { top: 32, right: 24, bottom: 48, left: 36 };
	const VIEW_W = 600;

	function render(svg: SVGSVGElement, dVal: number, l1: string, l2: string) {
		const plotW = VIEW_W - MARGIN.left - MARGIN.right;
		const plotH = height - MARGIN.top - MARGIN.bottom;

		const xMin = Math.min(-4, dVal - 4);
		const xMax = Math.max(4, dVal + 4);

		const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, plotW]);
		const maxY = normalPDF(0, 0, 1) * 1.6;
		const yScale = d3.scaleLinear().domain([0, maxY]).range([plotH, 0]);

		const root = d3.select(svg);
		root.attr('viewBox', `0 0 ${VIEW_W} ${height}`);

		let g = root.selectAll<SVGGElement, null>('.plot-g').data([null]);
		g = g
			.join(enter =>
				enter
					.append('g')
					.attr('class', 'plot-g')
					.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
			)
			.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

		const nPts = 300;
		const xs = d3.range(xMin, xMax, (xMax - xMin) / nPts);
		const ctrlPts  = xs.map(x => ({ x, y: normalPDF(x, 0, 1) }));
		const treatPts = xs.map(x => ({ x, y: normalPDF(x, dVal, 1) }));

		const areaGen = d3
			.area<{ x: number; y: number }>()
			.x(p => xScale(p.x))
			.y0(plotH)
			.y1(p => yScale(p.y))
			.curve(d3.curveBasis);

		const lineGen = d3
			.line<{ x: number; y: number }>()
			.x(p => xScale(p.x))
			.y(p => yScale(p.y))
			.curve(d3.curveBasis);

		// Control area + line
		g.selectAll('.ctrl-area').data([ctrlPts]).join('path')
			.attr('class', 'ctrl-area')
			.attr('fill', BLUE).attr('fill-opacity', 0.22)
			.attr('d', areaGen);

		g.selectAll('.ctrl-line').data([ctrlPts]).join('path')
			.attr('class', 'ctrl-line')
			.attr('fill', 'none').attr('stroke', BLUE).attr('stroke-width', 2.5)
			.attr('d', lineGen);

		// Treatment area + line (animated)
		g.selectAll('.treat-area').data([treatPts]).join('path')
			.attr('class', 'treat-area')
			.attr('fill', CORAL).attr('fill-opacity', 0.22)
			.transition().duration(200).ease(d3.easeQuadOut)
			.attr('d', areaGen);

		g.selectAll('.treat-line').data([treatPts]).join('path')
			.attr('class', 'treat-line')
			.attr('fill', 'none').attr('stroke', CORAL).attr('stroke-width', 2.5)
			.transition().duration(200).ease(d3.easeQuadOut)
			.attr('d', lineGen);

		// X axis
		const xAxis = g.selectAll<SVGGElement, null>('.x-axis').data([null])
			.join(enter =>
				enter.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${plotH})`)
			);
		xAxis.call(
			d3.axisBottom(xScale).ticks(8)
				.tickFormat(dv => (Number(dv) === 0 ? '0' : `${d3.format('+.1f')(Number(dv))}σ`))
		);
		xAxis.selectAll('text').attr('fill', '#9ca3af').attr('font-size', 11);
		xAxis.selectAll('line').attr('stroke', '#e5e7eb');
		xAxis.select('.domain').attr('stroke', '#e5e7eb');

		// Grid lines
		g.selectAll('.grid-line').data(xScale.ticks(8)).join('line')
			.attr('class', 'grid-line')
			.attr('x1', v => xScale(v)).attr('x2', v => xScale(v))
			.attr('y1', 0).attr('y2', plotH)
			.attr('stroke', '#f3f4f6').attr('stroke-width', 1);

		// ── Labels (pill-style with auto stagger) ──
		const peakY  = yScale(normalPDF(0, 0, 1));
		const ctrlX  = xScale(0);
		const treatX = xScale(dVal);

		const PH = 20, PR = 10, PPX = 9;
		const CHAR_W = 7.5;
		const ctrlPW  = Math.max(l1.length * CHAR_W + PPX * 2, 50);
		const treatPW = Math.max(l2.length * CHAR_W + PPX * 2, 50);

		const pLeft = (cx: number, pw: number, anc: string) =>
			anc === 'middle' ? cx - pw / 2 : anc === 'start' ? cx - PPX : cx - pw + PPX;

		const ctrlAncN  = dVal > 0.5 ? 'end'   : dVal < -0.5 ? 'start' : 'middle';
		const treatAncN = dVal > 0.5 ? 'start' : dVal < -0.5 ? 'end'   : 'middle';

		const cL = pLeft(ctrlX, ctrlPW, ctrlAncN),  cR = cL + ctrlPW;
		const tL = pLeft(treatX, treatPW, treatAncN), tR = tL + treatPW;
		const stagger = cL < tR + 10 && cR > tL - 10;

		const ctrlAnc  = stagger ? 'middle' : ctrlAncN;
		const treatAnc = stagger ? 'middle' : treatAncN;
		const NEAR_Y = peakY - 14;
		const FAR_Y  = peakY - 46;
		const ctrlY  = stagger ? FAR_Y : NEAR_Y;
		const treatY = NEAR_Y;

		// Control label group
		const cg = g.selectAll('.lbl-ctrl').data([null]).join(enter => {
			const eg = enter.append('g').attr('class', 'lbl-ctrl');
			eg.append('line').attr('class', 'ldl');
			eg.append('rect').attr('class', 'pil');
			eg.append('text').attr('class', 'ltx');
			return eg;
		});

		cg.select('.ldl')
			.attr('x1', ctrlX).attr('x2', ctrlX)
			.attr('stroke', BLUE).attr('stroke-width', 1).attr('stroke-dasharray', '3,2')
			.transition().duration(200)
			.attr('y1', ctrlY + 5).attr('y2', stagger ? peakY - 4 : ctrlY + 5)
			.attr('stroke-opacity', stagger ? 0.4 : 0);

		cg.select('.pil')
			.attr('width', ctrlPW).attr('height', PH).attr('rx', PR)
			.attr('fill', BLUE).attr('fill-opacity', 0.1)
			.attr('stroke', BLUE).attr('stroke-width', 1.5).attr('stroke-opacity', 0.5)
			.transition().duration(200).ease(d3.easeQuadOut)
			.attr('x', pLeft(ctrlX, ctrlPW, ctrlAnc))
			.attr('y', ctrlY - 15);

		cg.select('.ltx')
			.attr('text-anchor', ctrlAnc).attr('fill', BLUE)
			.attr('font-size', 12).attr('font-weight', 600).text(l1)
			.transition().duration(200).ease(d3.easeQuadOut)
			.attr('x', ctrlX).attr('y', ctrlY);

		// Treatment label group (animated)
		const tg = g.selectAll('.lbl-treat').data([null]).join(enter => {
			const eg = enter.append('g').attr('class', 'lbl-treat');
			eg.append('rect').attr('class', 'pil');
			eg.append('text').attr('class', 'ltx');
			return eg;
		});

		tg.select('.pil')
			.attr('width', treatPW).attr('height', PH).attr('rx', PR)
			.attr('fill', CORAL).attr('fill-opacity', 0.1)
			.attr('stroke', CORAL).attr('stroke-width', 1.5).attr('stroke-opacity', 0.5)
			.transition().duration(200).ease(d3.easeQuadOut)
			.attr('x', pLeft(treatX, treatPW, treatAnc))
			.attr('y', treatY - 15);

		tg.select('.ltx')
			.attr('text-anchor', treatAnc).attr('fill', CORAL)
			.attr('font-size', 12).attr('font-weight', 600).text(l2)
			.transition().duration(200).ease(d3.easeQuadOut)
			.attr('x', treatX).attr('y', treatY);

		// Zero line
		g.selectAll('.zero-line').data([null])
			.join(enter =>
				enter.append('line').attr('class', 'zero-line')
					.attr('y1', 0).attr('stroke', '#d1d5db')
					.attr('stroke-width', 1).attr('stroke-dasharray', '3,3')
			)
			.attr('x1', xScale(0)).attr('x2', xScale(0)).attr('y2', plotH);
	}

	$effect(() => {
		if (!svgEl) return;
		render(svgEl, d, label1, label2);
	});
</script>

<div class="w-full overflow-hidden rounded-xl bg-white" aria-label="Overlapping normal distributions plot">
	<svg
		bind:this={svgEl}
		role="img"
		aria-label="Two overlapping normal distributions"
		class="w-full"
		style="min-height: {height}px;"
	></svg>

	{#if editable}
		<!-- Interactive legend with editable labels -->
		<div class="flex justify-center items-center gap-8 pb-2 pt-0.5 text-sm">
			<span class="flex items-center gap-2">
				<span class="inline-block w-3 h-3 rounded-full" style="background:{BLUE}; opacity:0.85"></span>
				<EditableLabel value={label1} oncommit={onlabel1change} />
			</span>
			<span class="flex items-center gap-2">
				<span class="inline-block w-3 h-3 rounded-full" style="background:{CORAL}; opacity:0.85"></span>
				<EditableLabel value={label2} oncommit={onlabel2change} />
			</span>
		</div>
	{:else}
		<p class="mt-1 pb-2 text-center text-xs text-gray-400">
			Standard deviation units (σ). {label1} mean = 0, {label2} mean = d.
		</p>
	{/if}
</div>
