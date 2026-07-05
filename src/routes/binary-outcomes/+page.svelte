<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	import BinaryPlot from '$lib/components/BinaryPlot.svelte';
	import BenchmarkRibbon from '$lib/components/BenchmarkRibbon.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import PlotDownloadButton from '$lib/components/PlotDownloadButton.svelte';
	import FormulaAccordion from '$lib/components/FormulaAccordion.svelte';
	import CitationSnippet from '$lib/components/CitationSnippet.svelte';
	import BinaryPowerPanel from '$lib/components/BinaryPowerPanel.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import EditableLabel from '$lib/components/EditableLabel.svelte';
	import { sanitizeFilename } from '$lib/utils/downloadPlot.js';
	import { parseNumber } from '$lib/math/conversions.js';

	import type { Family4Inputs, Family4Results, Family4InputType } from '$lib/types/binary.js';
	import {
		hasZeroCell,
		applyHaldane,
		oddsRatio,
		logOddsRatio,
		seLogOR,
		ciOR,
		riskRatio,
		logRiskRatio,
		seLogRR,
		ciRR,
		riskDifference,
		seRD,
		ciRD,
		nnt,
		phiCoefficient,
		dToLogOR,
		logORToD
	} from '$lib/math/binary.js';

	// ── Labels ────────────────────────────────────────────────────
	let label1      = $state('Treatment');
	let label2      = $state('Control');
	let labelEvent  = $state('event');
	// Whether the event is a good outcome (recovery) or a bad one (relapse).
	// Determines NNT (benefit) vs NNH (harm) framing.
	let eventDesirable = $state(false);

	function setLabel1(v: string)     { label1     = v; }
	function setLabel2(v: string)     { label2     = v; }
	function setLabelEvent(v: string) { labelEvent = v; }

	// ── Input state ───────────────────────────────────────────────
	let inputs = $state<Family4Inputs>({
		inputType: 'table',
		aStr: '', bStr: '', cStr: '', dStr: '',
		p1Str: '', n1Str: '', p2Str: '', n2Str: ''
	});

	const inputOptions: { value: Family4InputType; label: string }[] = [
		{ value: 'table', label: '2×2 table (cell counts)' },
		{ value: 'props', label: 'Two proportions (p₁, p₂)' }
	];

	// ── Validation ────────────────────────────────────────────────
	let errors = $derived.by(() => {
		const e = new Map<string, string>();
		const it = inputs.inputType;

		if (it === 'table') {
			for (const [key, str, label] of [
				['a', inputs.aStr, 'a'] as const,
				['b', inputs.bStr, 'b'] as const,
				['c', inputs.cStr, 'c'] as const,
				['d', inputs.dStr, 'd'] as const
			]) {
				const v = parseNumber(str);
				if (str !== '' && (v === null || !Number.isFinite(v) || v < 0))
					e.set(key, `${label} must be a non-negative number.`);
			}
		} else {
			const p1 = parseNumber(inputs.p1Str);
			const n1 = parseNumber(inputs.n1Str);
			const p2 = parseNumber(inputs.p2Str);
			const n2 = parseNumber(inputs.n2Str);
			if (inputs.p1Str !== '' && (p1 === null || p1 < 0 || p1 > 1))
				e.set('p1', 'Must be between 0 and 1.');
			if (inputs.n1Str !== '' && (n1 === null || !Number.isInteger(n1) || n1 < 1))
				e.set('n1', 'Must be a whole number ≥ 1.');
			if (inputs.p2Str !== '' && (p2 === null || p2 < 0 || p2 > 1))
				e.set('p2', 'Must be between 0 and 1.');
			if (inputs.n2Str !== '' && (n2 === null || !Number.isInteger(n2) || n2 < 1))
				e.set('n2', 'Must be a whole number ≥ 1.');
		}
		return e;
	});

	// ── Results ───────────────────────────────────────────────────
	let results = $derived.by((): Family4Results | null => {
		if (errors.size > 0) return null;

		let a: number, b: number, c: number, d: number;
		let hadZeroCell = false;
		let hasTable    = false;

		if (inputs.inputType === 'table') {
			const av = parseNumber(inputs.aStr);
			const bv = parseNumber(inputs.bStr);
			const cv = parseNumber(inputs.cStr);
			const dv = parseNumber(inputs.dStr);
			if (av === null || bv === null || cv === null || dv === null) return null;
			hasTable = true;
			if (hasZeroCell(av, bv, cv, dv)) {
				hadZeroCell = true;
				[a, b, c, d] = applyHaldane(av, bv, cv, dv);
			} else {
				[a, b, c, d] = [av, bv, cv, dv];
			}
		} else {
			const p1v = parseNumber(inputs.p1Str);
			const n1v = parseNumber(inputs.n1Str);
			const p2v = parseNumber(inputs.p2Str);
			const n2v = parseNumber(inputs.n2Str);
			if (p1v === null || n1v === null || p2v === null || n2v === null) return null;
			// Synthesise effective counts from proportions
			a = p1v * n1v;
			b = (1 - p1v) * n1v;
			c = p2v * n2v;
			d = (1 - p2v) * n2v;
			// Guard: if either proportion is exactly 0 or 1
			if (a <= 0 || b <= 0 || c <= 0 || d <= 0) {
				hadZeroCell = true;
				[a, b, c, d] = applyHaldane(a, b, c, d);
			}
		}

		const n1 = a + b, n2 = c + d;
		const p1 = a / n1, p2 = c / n2;

		// Guard against degenerate denominators
		if (n1 <= 0 || n2 <= 0) return null;

		const orVal   = oddsRatio(a, b, c, d);
		const logOR   = logOddsRatio(a, b, c, d);
		const seOR    = seLogOR(a, b, c, d);
		const [orLo, orHi] = ciOR(a, b, c, d);

		const rrVal   = riskRatio(a, b, c, d);
		const logRR   = logRiskRatio(a, b, c, d);
		const seRR    = seLogRR(a, b, c, d);
		const [rrLo, rrHi] = ciRR(a, b, c, d);

		const rd      = riskDifference(a, b, c, d);
		const rdSE    = seRD(a, b, c, d);
		const [rdLo, rdHi] = ciRD(a, b, c, d);

		const nntVal  = nnt(rd);
		const phi     = phiCoefficient(a, b, c, d);

		return {
			p1, p2, n1, n2,
			hasTable, hadZeroCell,
			or: orVal, logOR, seLogOR: seOR, orCI: [orLo, orHi],
			rr: rrVal, logRR, seLogRR: seRR, rrCI: [rrLo, rrHi],
			rd, seRD: rdSE, rdCI: [rdLo, rdHi],
			nnt: nntVal,
			phi
		};
	});

	// ── Interpretation helpers ────────────────────────────────────
	function sizeLabel(absLogOR: number): string {
		if (absLogOR < 0.363) return 'negligible';
		if (absLogOR < 0.907) return 'small';
		if (absLogOR < 1.451) return 'medium';
		return 'large';
	}

	function fmt(x: number, dp = 3): string { return x.toFixed(dp); }
	function fmtPct(x: number): string      { return (x * 100).toFixed(1) + '%'; }
	function fmtCI(lo: number, hi: number, dp = 3): string {
		return `[${lo.toFixed(dp)}, ${hi.toFixed(dp)}]`;
	}

	let size    = $derived(results ? sizeLabel(Math.abs(results.logOR)) : '');

	// NNT vs NNH depends on both the sign of RD and whether the event is good or bad
	let nntIsBenefit = $derived(
		results !== null && results.rd !== 0 &&
		(eventDesirable ? results.rd > 0 : results.rd < 0)
	);
	let nntLabel = $derived(
		results === null || results.rd === 0 ? 'NNT/NNH' : nntIsBenefit ? 'NNT' : 'NNH'
	);

	let reportStr = $derived.by(() => {
		if (!results) return '';
		const r = results;
		const nntPart = r.nnt !== null ? `, ${nntLabel} = ${Math.ceil(r.nnt)}` : '';
		return `OR = ${fmt(r.or, 2)}, 95% CI [${fmt(r.orCI[0], 2)}, ${fmt(r.orCI[1], 2)}], `
			+ `RD = ${(r.rd * 100).toFixed(1)}%${nntPart}`;
	});
	let rd_ppt  = $derived(results ? (results.rd * 100).toFixed(1) : '');

	// Whether OR ≠ RR is likely to matter (common outcome > 10%)
	let orRrDiverge = $derived(
		results !== null && (results.p1 > 0.10 || results.p2 > 0.10)
	);

	// Wide CI: logOR CI width > 1.0 (OR CI spans a factor of exp(2) ≈ 7)
	let wideCI = $derived(
		results !== null &&
		Math.log(results.orCI[1]) - Math.log(results.orCI[0]) > 1.0
	);

	// CI crosses 1: compatible with no effect
	let ciCrossesOne = $derived(
		results !== null && results.orCI[0] < 1 && results.orCI[1] > 1
	);

	// ── Plot SVG ref ──────────────────────────────────────────────
	let plotSvgEl = $state<SVGSVGElement | undefined>();
	let plotFilename = $derived(`binary-outcomes-${sanitizeFilename(inputs.inputType)}`);

	// ── Copy text ─────────────────────────────────────────────────
	function buildCopyText(res: Family4Results): string {
		const lines: string[] = [
			`Odds ratio (OR) = ${fmt(res.or)}  95% CI ${fmtCI(res.orCI[0], res.orCI[1])}`,
			`Log OR = ${fmt(res.logOR)}  SE = ${fmt(res.seLogOR)}`,
			`Risk ratio (RR) = ${fmt(res.rr)}  95% CI ${fmtCI(res.rrCI[0], res.rrCI[1])}`,
			`Risk difference (RD) = ${fmt(res.rd)}  95% CI ${fmtCI(res.rdCI[0], res.rdCI[1])}`,
			res.nnt !== null ? `${nntLabel} = ${fmt(res.nnt, 1)}` : 'NNT = undefined (RD = 0)',
			`Phi (φ) = ${fmt(res.phi)}`
		];
		return lines.join('\n');
	}

	// ── URL sync ──────────────────────────────────────────────────
	let mounted = false;

	onMount(() => {
		const p = $page.url.searchParams;
		const it = p.get('input') as Family4InputType | null;
		if (it) inputs.inputType = it;
		if (p.get('a'))   inputs.aStr  = p.get('a')!;
		if (p.get('b'))   inputs.bStr  = p.get('b')!;
		if (p.get('c'))   inputs.cStr  = p.get('c')!;
		if (p.get('d'))   inputs.dStr  = p.get('d')!;
		if (p.get('p1'))  inputs.p1Str = p.get('p1')!;
		if (p.get('n1'))  inputs.n1Str = p.get('n1')!;
		if (p.get('p2'))  inputs.p2Str = p.get('p2')!;
		if (p.get('n2'))  inputs.n2Str = p.get('n2')!;
		if (p.get('good') === '1') eventDesirable = true;
		mounted = true;
	});

	$effect(() => {
		if (!mounted) return;
		const u = new URLSearchParams();
		u.set('input', inputs.inputType);
		if (inputs.inputType === 'table') {
			if (inputs.aStr) u.set('a', inputs.aStr);
			if (inputs.bStr) u.set('b', inputs.bStr);
			if (inputs.cStr) u.set('c', inputs.cStr);
			if (inputs.dStr) u.set('d', inputs.dStr);
		} else {
			if (inputs.p1Str) u.set('p1', inputs.p1Str);
			if (inputs.n1Str) u.set('n1', inputs.n1Str);
			if (inputs.p2Str) u.set('p2', inputs.p2Str);
			if (inputs.n2Str) u.set('n2', inputs.n2Str);
		}
		if (eventDesirable) u.set('good', '1');
		goto(`?${u.toString()}`, { replaceState: true, keepFocus: true, noScroll: true });
	});

	// ── Formulas ──────────────────────────────────────────────────
	const formulas = [
		{
			title: 'Odds ratio',
			latex: String.raw`\text{OR} = \frac{a \cdot d}{b \cdot c}`,
			source: 'Where a = treated + event, b = treated + no event, c = control + event, d = control + no event. Borenstein et al. (2009), eq. 5.1.'
		},
		{
			title: 'SE of log OR',
			latex: String.raw`\text{SE}(\ln\text{OR}) = \sqrt{\frac{1}{a} + \frac{1}{b} + \frac{1}{c} + \frac{1}{d}}`,
			source: 'Borenstein et al. (2009), eq. 5.4. Basis for 95% CI: exp(ln OR ± 1.96 · SE).'
		},
		{
			title: 'Risk ratio (relative risk)',
			latex: String.raw`\text{RR} = \frac{p_1}{p_2} = \frac{a/(a+b)}{c/(c+d)}`,
			source: 'Borenstein et al. (2009), eq. 5.11. SE(ln RR) = √(b/(an₁) + d/(cn₂)).'
		},
		{
			title: 'Risk difference',
			latex: String.raw`\text{RD} = p_1 - p_2`,
			source: 'SE(RD) = √(p₁(1−p₁)/n₁ + p₂(1−p₂)/n₂). Fleiss, Levin & Paik (2003).'
		},
		{
			title: 'Number needed to treat',
			latex: String.raw`\text{NNT} = \frac{1}{|\text{RD}|}`,
			source: 'Negative RD (treatment reduces event) → beneficial NNT. Positive RD → NNH (number needed to harm).'
		},
		{
			title: 'Phi coefficient',
			latex: String.raw`\varphi = \frac{ad - bc}{\sqrt{n_1 n_2 (a+c)(b+d)}}`,
			source: 'Equivalent to Pearson r for a 2×2 table. Cohen (1988): small = .10, medium = .30, large = .50.'
		},
		{
			title: 'd ↔ log OR (Borenstein approximation)',
			latex: String.raw`\ln\text{OR} = d \cdot \frac{\pi}{\sqrt{3}}`,
			source: 'Assumes the latent continuous outcome follows a logistic distribution. Borenstein et al. (2009), eq. 7.1. Approximation only.'
		}
	];
</script>

<svelte:head>
	<title>Risk & Odds: odds ratio, NNT, risk ratio | Magnitood</title>
	<meta name="description" content="Compute odds ratio, risk ratio, risk difference, NNT, and phi from 2×2 tables or two proportions. With 95% CIs. Free, instant, client-side." />
</svelte:head>

<div class="h-1 bg-gradient-to-r from-orange-400 to-red-400"></div>

<div class="mx-auto max-w-3xl px-4 py-10 space-y-6">

	<!-- Header ──────────────────────────────────────────────────── -->
	<div>
		<h1 class="text-3xl font-bold text-gray-900 tracking-tight">Risk & Odds</h1>
		<p class="mt-2 text-gray-500 text-sm leading-relaxed">
			Compare two groups on a binary event. Computes OR, RR, RD, NNT, and phi from
			a 2×2 table or two proportions, with 95% CIs.
		</p>
	</div>

	<!-- Input card ──────────────────────────────────────────────── -->
	<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
		<h2 class="text-base font-semibold text-gray-900">Input</h2>

		<!-- Input type selector -->
		<div class="space-y-2">
			<p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Input type</p>
			<div class="flex flex-wrap gap-2">
				{#each inputOptions as opt}
					<button
						onclick={() => { inputs.inputType = opt.value; }}
						class="rounded-full px-3 py-1 text-sm font-medium transition-colors
							{inputs.inputType === opt.value
								? 'bg-orange-500 text-white'
								: 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Group / outcome labels -->
		<div class="grid grid-cols-3 gap-4">
			<div class="space-y-1">
				<label for="lbl-group1" class="block text-xs font-medium text-gray-700">Group 1 name</label>
				<input id="lbl-group1" type="text" bind:value={label1}
					placeholder="Treatment"
					class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
			</div>
			<div class="space-y-1">
				<label for="lbl-group2" class="block text-xs font-medium text-gray-700">Group 2 name</label>
				<input id="lbl-group2" type="text" bind:value={label2}
					placeholder="Control"
					class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
			</div>
			<div class="space-y-1">
				<label for="lbl-event" class="block text-xs font-medium text-gray-700">Outcome name</label>
				<input id="lbl-event" type="text" bind:value={labelEvent}
					placeholder="event"
					class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
			</div>
		</div>

		<!-- Outcome valence: determines NNT vs NNH framing -->
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
			<span class="text-xs font-medium text-gray-700">The {labelEvent || 'event'} is</span>
			<div class="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 gap-0.5" role="radiogroup" aria-label="Is the outcome desirable or undesirable?">
				<button
					type="button"
					role="radio"
					aria-checked={!eventDesirable}
					onclick={() => { eventDesirable = false; }}
					class="rounded-md px-3 py-1 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-orange-400
						{!eventDesirable ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
				>undesirable <span class="font-normal text-gray-400">(e.g. relapse, death)</span></button>
				<button
					type="button"
					role="radio"
					aria-checked={eventDesirable}
					onclick={() => { eventDesirable = true; }}
					class="rounded-md px-3 py-1 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-orange-400
						{eventDesirable ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
				>desirable <span class="font-normal text-gray-400">(e.g. recovery, conversion)</span></button>
			</div>
			<span class="text-[10px] text-gray-400">determines whether NNT (benefit) or NNH (harm) is reported</span>
		</div>

		<!-- 2×2 table input -->
		{#if inputs.inputType === 'table'}
			<div class="space-y-1">
				<p class="text-xs font-medium text-gray-700 mb-2">
					Enter cell counts from your 2×2 table:
				</p>
				<!-- Column headers -->
				<div class="grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
					<div></div>
					<div class="text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
						{labelEvent || 'Event'}
					</div>
					<div class="text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
						No {labelEvent || 'event'}
					</div>
				</div>
				<!-- Row 1: Group 1 (Treatment) -->
				<div class="grid grid-cols-[auto_1fr_1fr] gap-2 items-start">
					<div class="text-xs font-semibold text-gray-600 uppercase tracking-wide w-24 shrink-0 pt-5">
						{label1 || 'Group 1'}
					</div>
					<div class="space-y-0.5">
						<p class="text-[10px] text-center text-gray-400 mb-0.5">{label1 || 'Group 1'} + {labelEvent || 'event'}</p>
						<input id="inp-a" type="text" inputmode="decimal" bind:value={inputs.aStr}
							placeholder="n"
							aria-label="{label1 || 'Group 1'} with {labelEvent || 'event'}"
							class="w-full rounded-lg border px-3 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-orange-400
								{errors.has('a') ? 'border-red-400' : 'border-gray-200'}" />
						{#if errors.has('a')}<p class="text-xs text-red-600">{errors.get('a')}</p>{/if}
					</div>
					<div class="space-y-0.5">
						<p class="text-[10px] text-center text-gray-400 mb-0.5">{label1 || 'Group 1'} + no {labelEvent || 'event'}</p>
						<input id="inp-b" type="text" inputmode="decimal" bind:value={inputs.bStr}
							placeholder="n"
							aria-label="{label1 || 'Group 1'} without {labelEvent || 'event'}"
							class="w-full rounded-lg border px-3 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-orange-400
								{errors.has('b') ? 'border-red-400' : 'border-gray-200'}" />
						{#if errors.has('b')}<p class="text-xs text-red-600">{errors.get('b')}</p>{/if}
					</div>
				</div>
				<!-- Row 2: Group 2 (Control) -->
				<div class="grid grid-cols-[auto_1fr_1fr] gap-2 items-start">
					<div class="text-xs font-semibold text-gray-600 uppercase tracking-wide w-24 shrink-0 pt-5">
						{label2 || 'Group 2'}
					</div>
					<div class="space-y-0.5">
						<p class="text-[10px] text-center text-gray-400 mb-0.5">{label2 || 'Group 2'} + {labelEvent || 'event'}</p>
						<input id="inp-c" type="text" inputmode="decimal" bind:value={inputs.cStr}
							placeholder="n"
							aria-label="{label2 || 'Group 2'} with {labelEvent || 'event'}"
							class="w-full rounded-lg border px-3 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-orange-400
								{errors.has('c') ? 'border-red-400' : 'border-gray-200'}" />
						{#if errors.has('c')}<p class="text-xs text-red-600">{errors.get('c')}</p>{/if}
					</div>
					<div class="space-y-0.5">
						<p class="text-[10px] text-center text-gray-400 mb-0.5">{label2 || 'Group 2'} + no {labelEvent || 'event'}</p>
						<input id="inp-d" type="text" inputmode="decimal" bind:value={inputs.dStr}
							placeholder="n"
							aria-label="{label2 || 'Group 2'} without {labelEvent || 'event'}"
							class="w-full rounded-lg border px-3 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-orange-400
								{errors.has('d') ? 'border-red-400' : 'border-gray-200'}" />
						{#if errors.has('d')}<p class="text-xs text-red-600">{errors.get('d')}</p>{/if}
					</div>
				</div>
			</div>

		<!-- Two proportions input -->
		{:else}
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-3">
					<p class="text-xs font-semibold text-gray-600">{label1 || 'Group 1'}</p>
					<div class="space-y-1">
						<label for="inp-p1" class="block text-xs font-medium text-gray-700">
							Event rate p₁ <span class="text-gray-400 font-normal">(0 to 1)</span>
						</label>
						<input id="inp-p1" type="text" inputmode="decimal" bind:value={inputs.p1Str}
							placeholder="e.g. 0.30"
							class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400
								{errors.has('p1') ? 'border-red-400' : 'border-gray-200'}" />
						{#if errors.has('p1')}<p class="text-xs text-red-600">{errors.get('p1')}</p>{/if}
					</div>
					<div class="space-y-1">
						<label for="inp-n1" class="block text-xs font-medium text-gray-700">Sample size n₁</label>
						<input id="inp-n1" type="text" inputmode="numeric" bind:value={inputs.n1Str}
							placeholder="e.g. 100"
							class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400
								{errors.has('n1') ? 'border-red-400' : 'border-gray-200'}" />
						{#if errors.has('n1')}<p class="text-xs text-red-600">{errors.get('n1')}</p>{/if}
					</div>
				</div>
				<div class="space-y-3">
					<p class="text-xs font-semibold text-gray-600">{label2 || 'Group 2'}</p>
					<div class="space-y-1">
						<label for="inp-p2" class="block text-xs font-medium text-gray-700">
							Event rate p₂ <span class="text-gray-400 font-normal">(0 to 1)</span>
						</label>
						<input id="inp-p2" type="text" inputmode="decimal" bind:value={inputs.p2Str}
							placeholder="e.g. 0.20"
							class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400
								{errors.has('p2') ? 'border-red-400' : 'border-gray-200'}" />
						{#if errors.has('p2')}<p class="text-xs text-red-600">{errors.get('p2')}</p>{/if}
					</div>
					<div class="space-y-1">
						<label for="inp-n2" class="block text-xs font-medium text-gray-700">Sample size n₂</label>
						<input id="inp-n2" type="text" inputmode="numeric" bind:value={inputs.n2Str}
							placeholder="e.g. 100"
							class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400
								{errors.has('n2') ? 'border-red-400' : 'border-gray-200'}" />
						{#if errors.has('n2')}<p class="text-xs text-red-600">{errors.get('n2')}</p>{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Zero-cell warning -->
		{#if results?.hadZeroCell}
			<div class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-0.5">
				<p><strong>Zero cell detected — Haldane-Anscombe correction applied.</strong></p>
				<p>When a cell count is 0, log-odds and risk ratios are undefined. The correction adds 0.5 to every cell before computing, which produces finite estimates. The results are approximations — interpret with extra caution and consider reporting only the risk difference, which does not require logarithms.</p>
			</div>
		{/if}
	</div>

	<!-- Plot ────────────────────────────────────────────────────── -->
	<div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
		<div class="flex justify-end mb-2">
			<PlotDownloadButton getSvg={() => plotSvgEl} filename={plotFilename} />
		</div>
		<BinaryPlot
			p1={results?.p1 ?? null}
			p2={results?.p2 ?? null}
			{label1}
			{label2}
			{labelEvent}
			bind:svgEl={plotSvgEl}
		/>
	</div>

	<!-- Benchmark ribbon ────────────────────────────────────────── -->
	<div class="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-2">
		<BenchmarkRibbon
			value={results ? results.logOR : null}
			metric="Odds ratio"
			family="or"
		/>
		<p class="text-xs text-gray-400 leading-snug">
			The benchmark scale always uses the absolute log OR (≥ 0), corresponding to OR ≥ 1. When your OR is below 1, the ribbon shows its reciprocal — the same association strength in the opposite direction.
		</p>
	</div>

	<!-- Interpretation ──────────────────────────────────────────── -->
	{#if results}
		{@const res = results}
		<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<div class="border-l-4 border-orange-400 p-5 space-y-3 relative">
				<div class="absolute right-3 top-3">
					<CopyButton text={buildCopyText(res)} title="Copy results" />
				</div>

				<!-- NNT callout -->
				{#if res.nnt !== null}
					<div class="rounded-lg bg-orange-50 border border-orange-200 px-4 py-2.5 flex items-center gap-3">
						<div class="text-center shrink-0">
							<div class="text-2xl font-bold text-orange-700 tabular-nums leading-none">{Math.ceil(res.nnt)}</div>
							<div class="text-[10px] font-semibold text-orange-500 uppercase tracking-wide">{nntLabel}</div>
						</div>
						<p class="text-sm text-orange-900 leading-snug">
							{#if res.rd > 0}
								For every <strong>{Math.ceil(res.nnt)}</strong> people given {label1} instead of {label2}, one additional {labelEvent} is expected{nntIsBenefit ? '' : ' — a harm'}.
							{:else}
								For every <strong>{Math.ceil(res.nnt)}</strong> people given {label1} instead of {label2}, one {labelEvent} is {nntIsBenefit ? 'prevented' : 'lost'}.
							{/if}
						</p>
					</div>
				{/if}

				<!-- OR sentence -->
				<p class="text-sm text-gray-700 leading-relaxed">
					The odds of <EditableLabel value={labelEvent} oncommit={setLabelEvent} class="font-medium" /> in
					<EditableLabel value={label1} oncommit={setLabel1} class="font-medium" /> are
					<strong>{fmt(res.or)}</strong> times the odds in
					<EditableLabel value={label2} oncommit={setLabel2} class="font-medium" />
					({res.or > 1 ? 'higher' : 'lower'} in {label1}).
					This is a <strong>{size}</strong> association (OR = {fmt(res.or)},
					95% CI {fmtCI(res.orCI[0], res.orCI[1])}).
					{#if res.or < 1}
						Equivalently, the OR in the other direction is {fmt(1 / res.or, 2)}
						({label2} → {label1}).
					{/if}
				</p>

				<!-- RR sentence -->
				<p class="text-sm text-gray-700 leading-relaxed">
					The risk ratio is {fmt(res.rr, 2)}, meaning a case of {labelEvent} is
					{#if res.rr > 1}
						<strong>{((res.rr - 1) * 100).toFixed(0)}% more likely</strong> in {label1} than in {label2}.
					{:else if res.rr < 1}
						<strong>{((1 - res.rr) * 100).toFixed(0)}% less likely</strong> in {label1} than in {label2}.
					{:else}
						equally likely in {label1} and {label2}.
					{/if}
				</p>

				<!-- RD and NNT sentence -->
				<p class="text-sm text-gray-700 leading-relaxed">
					The absolute risk difference is <strong>{rd_ppt} percentage points</strong>
					({fmtPct(res.p1)} vs {fmtPct(res.p2)}).
					{#if res.nnt !== null}
						{#if res.rd > 0}
							For every <strong>{Math.ceil(res.nnt)}</strong> people treated with {label1} instead
							of {label2}, one additional case of {labelEvent} would be expected ({nntLabel} = {Math.ceil(res.nnt)}).
						{:else}
							You would need to treat <strong>{Math.ceil(res.nnt)}</strong> people with {label1}
							(instead of {label2}) to {nntIsBenefit ? 'prevent one' : 'see one fewer'} case of {labelEvent} ({nntLabel} = {Math.ceil(res.nnt)}).
						{/if}
					{:else}
						Risk difference is zero — NNT is undefined.
					{/if}
				</p>

				<!-- CI crosses 1 -->
				{#if ciCrossesOne}
					<p class="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 leading-relaxed">
						The 95% confidence interval includes 1 ({fmtCI(res.orCI[0], res.orCI[1])}). An OR of exactly 1 would mean no difference between groups — the outcome is equally likely in both. Because 1 falls within this interval, the data are statistically compatible with no effect at this sample size, and the result would not be considered statistically significant at α = 0.05. The point estimate may still reflect a real association, but sampling uncertainty is too large to rule out chance.
					</p>
				{/if}

				<!-- OR ≠ RR note -->
				{#if orRrDiverge}
					<div class="text-sm text-amber-800 bg-amber-50 border-2 border-amber-300 rounded-lg px-4 py-3 leading-relaxed space-y-1">
						<p class="font-semibold">⚠️ OR ≠ RR — common outcome warning</p>
						<p>The event rate exceeds 10%, so the odds ratio ({fmt(res.or, 2)}) and risk ratio ({fmt(res.rr, 2)}) diverge substantially. The OR exaggerates how large the association appears. The risk ratio is usually the more interpretable and clinically meaningful measure here — report both and clarify which you are discussing.</p>
					</div>
				{/if}

				<!-- Wide CI warning -->
				{#if wideCI}
					<p class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
						This wide confidence interval reflects considerable uncertainty about the true effect size. Interpret the point estimate with caution.
					</p>
				{/if}
			</div>
		</div>

		<!-- Results table ───────────────────────────────────────── -->
		<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<table class="w-full text-sm" aria-label="Binary outcome effect size results">
				<thead>
					<tr class="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
						<th class="px-5 py-3 text-left font-medium">Metric</th>
						<th class="px-5 py-3 text-right font-medium">Value</th>
						<th class="px-5 py-3 text-right font-medium hidden sm:table-cell">
						95% CI
						<span class="text-[10px] font-normal normal-case text-gray-400 ml-1" title="Wald method: CIs computed on the log scale and back-transformed. Standard approach for ratio statistics.">(Wald)</span>
					</th>
						<th class="px-3 py-3 text-right font-medium w-10"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					<!-- OR -->
					<tr class="hover:bg-gray-50/50">
						<td class="px-5 py-3 text-gray-700 font-medium">Odds ratio (OR)</td>
						<td class="px-5 py-3 text-right tabular-nums font-semibold text-gray-900">
							{fmt(res.or)}
							<span class="block sm:hidden text-xs font-normal text-gray-400">95% CI {fmtCI(res.orCI[0], res.orCI[1])}</span>
						</td>
						<td class="px-5 py-3 text-right tabular-nums text-gray-500 hidden sm:table-cell">{fmtCI(res.orCI[0], res.orCI[1])}</td>
						<td class="px-3 py-3 text-right"><CopyButton text={fmt(res.or)} /></td>
					</tr>
					<!-- log OR -->
					<tr class="hover:bg-gray-50/50">
						<td class="px-5 py-3 text-gray-700 font-medium">
							Log OR
							<span class="ml-1 text-xs font-normal text-gray-400">(for meta-analysis)</span>
						</td>
						<td class="px-5 py-3 text-right tabular-nums font-semibold text-gray-900">{fmt(res.logOR)}</td>
						<td class="px-5 py-3 text-right tabular-nums text-gray-500 hidden sm:table-cell">
							{fmtCI(Math.log(res.orCI[0]), Math.log(res.orCI[1]))}
							<span class="text-gray-400 text-xs ml-1">SE = {fmt(res.seLogOR)}</span>
						</td>
						<td class="px-3 py-3 text-right"><CopyButton text={fmt(res.logOR)} /></td>
					</tr>
					<!-- RR -->
					<tr class="hover:bg-gray-50/50">
						<td class="px-5 py-3 text-gray-700 font-medium">Risk ratio (RR)</td>
						<td class="px-5 py-3 text-right tabular-nums font-semibold text-gray-900">
							{fmt(res.rr)}
							<span class="block sm:hidden text-xs font-normal text-gray-400">95% CI {fmtCI(res.rrCI[0], res.rrCI[1])}</span>
						</td>
						<td class="px-5 py-3 text-right tabular-nums text-gray-500 hidden sm:table-cell">{fmtCI(res.rrCI[0], res.rrCI[1])}</td>
						<td class="px-3 py-3 text-right"><CopyButton text={fmt(res.rr)} /></td>
					</tr>
					<!-- RD -->
					<tr class="hover:bg-gray-50/50">
						<td class="px-5 py-3 text-gray-700 font-medium">Risk difference (RD)</td>
						<td class="px-5 py-3 text-right tabular-nums font-semibold text-gray-900">
							{fmt(res.rd)}
							<span class="block sm:hidden text-xs font-normal text-gray-400">95% CI {fmtCI(res.rdCI[0], res.rdCI[1])}</span>
						</td>
						<td class="px-5 py-3 text-right tabular-nums text-gray-500 hidden sm:table-cell">
							{fmtCI(res.rdCI[0], res.rdCI[1])}
							<span class="text-gray-400 text-xs ml-1">SE = {fmt(res.seRD)}</span>
						</td>
						<td class="px-3 py-3 text-right"><CopyButton text={fmt(res.rd)} /></td>
					</tr>
					<!-- NNT -->
					<tr class="hover:bg-gray-50/50">
						<td class="px-5 py-3 text-gray-700 font-medium">
							{nntLabel}
							<span class="ml-1 text-xs font-normal text-gray-400">
								{res.rd === 0 ? '' : nntIsBenefit ? '(beneficial)' : '(harmful)'}
							</span>
						</td>
						<td class="px-5 py-3 text-right tabular-nums font-semibold text-gray-900">
							{res.nnt !== null ? fmt(res.nnt, 1) : '∞'}
						</td>
						<td class="px-5 py-3 text-right tabular-nums text-gray-500 hidden sm:table-cell">—</td>
						<td class="px-3 py-3 text-right">
							{#if res.nnt !== null}
								<CopyButton text={fmt(res.nnt, 1)} />
							{/if}
						</td>
					</tr>
					<!-- Phi -->
					<tr class="hover:bg-gray-50/50">
						<td class="px-5 py-3 text-gray-700 font-medium">Phi (φ)</td>
						<td class="px-5 py-3 text-right tabular-nums font-semibold text-gray-900">{fmt(res.phi)}</td>
						<td class="px-5 py-3 text-right tabular-nums text-gray-500 hidden sm:table-cell">
							{#if !res.hasTable}
								<span class="text-gray-400 text-xs">approx. from proportions</span>
							{:else}—{/if}
						</td>
						<td class="px-3 py-3 text-right"><CopyButton text={fmt(res.phi)} /></td>
					</tr>
				</tbody>
			</table>
			<!-- Report as strip -->
			<div class="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
				<span class="text-[10px] text-gray-400 shrink-0">Report as:</span>
				<code class="flex-1 rounded bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700 font-mono truncate border border-gray-100">{reportStr}</code>
				<CopyButton text={reportStr} title="Copy reporting string" size="sm" />
			</div>
		</div>

		<!-- Cross-family conversions ─────────────────────────────── -->
		<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<details>
				<summary class="flex items-center justify-between px-5 py-3.5 text-left bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer list-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-400">
					<span class="text-sm font-semibold text-gray-700">Cross-family conversion: d ↔ OR</span>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
						class="w-4 h-4 text-gray-400" aria-hidden="true">
						<path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
					</svg>
				</summary>
				<div class="px-5 py-4 space-y-3">
					<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
						Cross-family conversions involve assumptions. This approximation assumes the latent continuous outcome
						follows a logistic distribution. Report the assumption when citing.
					</div>
					<p class="text-sm text-gray-700">
						Equivalent Cohen's d (Borenstein approximation):
						<strong class="tabular-nums">{fmt(logORToD(res.logOR))}</strong>
					</p>
					<a
						href="{base}/cohens-d?input=d&d={encodeURIComponent(fmt(logORToD(res.logOR)))}"
						class="inline-block text-sm font-medium text-orange-600 underline underline-offset-2 hover:opacity-80"
					>
						Open d = {fmt(logORToD(res.logOR))} in mean differences calculator →
					</a>
				</div>
			</details>
		</div>

	{:else}
		<div class="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center text-sm text-gray-400">
			Results will appear here once you enter values above.
		</div>
	{/if}

	<!-- Formulas accordion ───────────────────────────────────────── -->
	<FormulaAccordion {formulas} />

	{#if results}
		<BinaryPowerPanel
			p1={results.p1}
			p2={results.p2}
			n1={results.n1}
			n2={results.n2}
		/>
		<div class="flex items-center justify-between gap-3">
			<a
				href="{base}/visualize?viz=odds-ratio&p1={results.p2.toFixed(2)}&p2={results.p1.toFixed(2)}"
				class="text-xs text-violet-600 hover:underline hover:text-violet-800 transition-colors"
			>
				Visualize this effect →
			</a>
			<ShareButton />
				<CitationSnippet />
		</div>
	{:else}
		<div class="flex justify-end"><CitationSnippet /></div>
	{/if}

	<!-- References ───────────────────────────────────────────────── -->
	<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
		<details>
			<summary class="flex items-center justify-between px-5 py-3.5 text-left bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer list-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-400">
				<span class="text-sm font-semibold text-gray-700">References</span>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
					class="w-4 h-4 text-gray-400" aria-hidden="true">
					<path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
				</svg>
			</summary>
			<div>
				<ul class="px-5 py-4 space-y-2 text-xs text-gray-600 leading-relaxed list-none">
					<li>Borenstein, M., Hedges, L. V., Higgins, J. P. T., &amp; Rothstein, H. R. (2009). <em>Introduction to meta-analysis.</em> Wiley.</li>
					<li>Cohen, J. (1988). <em>Statistical power analysis for the behavioral sciences</em> (2nd ed.). Erlbaum.</li>
					<li>Fleiss, J. L., Levin, B., &amp; Paik, M. C. (2003). <em>Statistical methods for rates and proportions</em> (3rd ed.). Wiley.</li>
					<li>Haldane, J. B. S. (1956). The estimation and significance of the logarithm of a ratio of frequencies. <em>Annals of Human Genetics, 20</em>(4), 309–311.</li>
				</ul>
			</div>
		</details>
	</div>

</div>
