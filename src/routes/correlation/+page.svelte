<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	import CorrelationPlot from '$lib/components/CorrelationPlot.svelte';
	import BenchmarkRibbon from '$lib/components/BenchmarkRibbon.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import CitationSnippet from '$lib/components/CitationSnippet.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import EditableLabel from '$lib/components/EditableLabel.svelte';
	import PlotDownloadButton from '$lib/components/PlotDownloadButton.svelte';
	import FormulaAccordion from '$lib/components/FormulaAccordion.svelte';
	import { sanitizeFilename } from '$lib/utils/downloadPlot.js';

	import type { Family2Inputs, Family2Results, Family2InputType } from '$lib/types/correlations.js';
	import {
		rFromT, rFromP, rFromChi2, rFromSlope, rFromR2, rFromFisherZ,
		fisherZ, seFisherZ, varFisherZ, ciR, rToD
	} from '$lib/math/correlations.js';
	import { parseNumber } from '$lib/math/conversions.js';
	import { normalCDF } from '$lib/math/distributions.js';

	// ── Input state ────────────────────────────────────────────────
	let inputs = $state<Family2Inputs>({
		inputType: 'r',
		rStr: '',
		r2Str: '',
		zStr: '',
		tStr: '',
		pStr: '',
		chi2Str: '',
		bStr: '',
		sdxStr: '',
		sdyStr: '',
		nStr: '',
		direction: 1
	});

	// ── Variable labels ────────────────────────────────────────────
	const DEFAULT_LABEL_X = 'Variable X';
	const DEFAULT_LABEL_Y = 'Variable Y';
	let labelX = $state(DEFAULT_LABEL_X);
	let labelY = $state(DEFAULT_LABEL_Y);
	let customLabels = $state(false);

	function setLabelX(v: string) { labelX = v; customLabels = true; }
	function setLabelY(v: string) { labelY = v; customLabels = true; }

	// ── Plot SVG ref and download filename ─────────────────────────
	let corrSvgEl = $state<SVGSVGElement | undefined>();
	let plotFilename = $derived(
		`correlation-${sanitizeFilename(labelX)}-${sanitizeFilename(labelY)}`
	);

	// ── Validation ─────────────────────────────────────────────────
	let errors = $derived.by(() => {
		const e = new Map<string, string>();
		const { inputType: it } = inputs;

		const n = parseNumber(inputs.nStr);
		const nOk = n !== null && Number.isFinite(n) && n >= 4 && Number.isInteger(n);

		// Per-input-type primary field
		if (it === 'r') {
			const r = parseNumber(inputs.rStr);
			if (inputs.rStr !== '' && (r === null || !Number.isFinite(r) || Math.abs(r) >= 1))
				e.set('r', 'Must be a number strictly between −1 and 1.');
		} else if (it === 'r2') {
			const r2 = parseNumber(inputs.r2Str);
			if (inputs.r2Str !== '' && (r2 === null || !Number.isFinite(r2) || r2 < 0 || r2 >= 1))
				e.set('r2', 'Must be a number in [0, 1).');
		} else if (it === 'z') {
			const z = parseNumber(inputs.zStr);
			if (inputs.zStr !== '' && (z === null || !Number.isFinite(z)))
				e.set('z', 'Must be a finite number.');
		} else if (it === 't') {
			const t = parseNumber(inputs.tStr);
			if (inputs.tStr !== '' && (t === null || !Number.isFinite(t)))
				e.set('t', 'Must be a finite number.');
		} else if (it === 'p') {
			const p = parseNumber(inputs.pStr);
			if (inputs.pStr !== '' && (p === null || !Number.isFinite(p) || p <= 0 || p >= 1))
				e.set('p', 'Must be a number strictly between 0 and 1.');
		} else if (it === 'chi2') {
			const chi2 = parseNumber(inputs.chi2Str);
			if (inputs.chi2Str !== '' && (chi2 === null || !Number.isFinite(chi2) || chi2 < 0))
				e.set('chi2', 'Must be a non-negative number.');
			// chi2/n must be < 1 for phi to be valid
			if (chi2 !== null && n !== null && chi2 / n >= 1)
				e.set('chi2', 'chi-square / n must be less than 1 (phi must be < 1).');
		} else if (it === 'slope') {
			const b = parseNumber(inputs.bStr);
			const sdx = parseNumber(inputs.sdxStr);
			const sdy = parseNumber(inputs.sdyStr);
			if (inputs.bStr !== '' && (b === null || !Number.isFinite(b)))
				e.set('b', 'Must be a finite number.');
			if (inputs.sdxStr !== '' && (sdx === null || !Number.isFinite(sdx) || sdx <= 0))
				e.set('sdx', 'Must be a positive number.');
			if (inputs.sdyStr !== '' && (sdy === null || !Number.isFinite(sdy) || sdy <= 0))
				e.set('sdy', 'Must be a positive number.');
		}

		// n always required
		if (inputs.nStr !== '' && !nOk)
			e.set('n', 'Must be a whole number of 4 or more.');

		return e;
	});

	// ── Computation ────────────────────────────────────────────────
	let results = $derived.by((): Family2Results | null => {
		if (errors.size > 0) return null;

		const { inputType: it } = inputs;
		const n = parseNumber(inputs.nStr);
		if (n === null || n < 4) return null;

		let r: number | null = null;

		if (it === 'r') {
			r = parseNumber(inputs.rStr);
		} else if (it === 'r2') {
			const r2 = parseNumber(inputs.r2Str);
			if (r2 === null) return null;
			r = rFromR2(r2, inputs.direction);
		} else if (it === 'z') {
			const z = parseNumber(inputs.zStr);
			if (z === null) return null;
			r = rFromFisherZ(z);
		} else if (it === 't') {
			const t = parseNumber(inputs.tStr);
			if (t === null) return null;
			r = rFromT(t, n);
		} else if (it === 'p') {
			const p = parseNumber(inputs.pStr);
			if (p === null) return null;
			r = rFromP(p, n, inputs.direction);
		} else if (it === 'chi2') {
			const chi2 = parseNumber(inputs.chi2Str);
			if (chi2 === null) return null;
			r = rFromChi2(chi2, n, inputs.direction);
		} else if (it === 'slope') {
			const b   = parseNumber(inputs.bStr);
			const sdx = parseNumber(inputs.sdxStr);
			const sdy = parseNumber(inputs.sdyStr);
			if (b === null || sdx === null || sdy === null) return null;
			r = rFromSlope(b, sdx, sdy);
		}

		if (r === null || !Number.isFinite(r) || Math.abs(r) >= 1) return null;

		return {
			r,
			r2: r ** 2,
			fisherZ: fisherZ(r),
			seZ: seFisherZ(n),
			varZ: varFisherZ(n),
			rCI: ciR(r, n),
			n
		};
	});

	// ── Interpretation helpers ─────────────────────────────────────
	function sizeLabel(absR: number): string {
		if (absR < 0.10) return 'negligible';
		if (absR < 0.30) return 'small';
		if (absR < 0.50) return 'medium';
		return 'large';
	}

	function fmt(x: number, dp = 2): string { return x.toFixed(dp); }
	function fmtPct(x: number): string { return (x * 100).toFixed(1); }

	let absR     = $derived(results ? Math.abs(results.r) : 0);
	let size     = $derived(results ? sizeLabel(absR) : '');
	let dirWord  = $derived(results ? (results.r < 0 ? 'negative' : 'positive') : 'positive');

	// Percentile rank on Y for someone 1 SD above average on X
	// E[Y | X=1] = r in standardised units; Φ(r) gives its population percentile
	let pctY = $derived(results ? Math.round(normalCDF(results.r, 0, 1) * 100) : 50);

	function ordinal(n: number): string {
		const v = n % 100;
		const suffix = (v >= 11 && v <= 13) ? 'th' : ['th','st','nd','rd'][Math.min(v % 10, 3)] || 'th';
		return `${n}${suffix}`;
	}

	// ── Power analysis (inline, correlation-specific) ──────────────
	const Z_ALPHA = 1.9600;
	const Z_BETA: Record<number, number> = { 80: 0.8416, 90: 1.2816, 95: 1.6449 };
	const POWERS = [80, 90, 95] as const;

	let openN   = $state(false);
	let openMDE = $state(false);
	let powerN   = $state<80 | 90 | 95>(80);
	let powerMDE = $state<80 | 90 | 95>(80);

	function nRequiredR(absRval: number, power: number): number | null {
		if (absRval < 0.001) return null;
		const z = Z_ALPHA + Z_BETA[power];
		const zr = Math.atanh(absRval);
		return Math.ceil(z ** 2 / zr ** 2 + 3);
	}

	function mdeR(n: number, power: number): number {
		const z = Z_ALPHA + Z_BETA[power];
		if (n <= 3) return 1;
		return Math.tanh(z / Math.sqrt(n - 3));
	}

	function conservativeAbsR(res: Family2Results): number | null {
		const [lo, hi] = res.rCI;
		const bound = res.r >= 0 ? lo : hi;
		if (res.r >= 0 && bound <= 0) return null;
		if (res.r < 0  && bound >= 0) return null;
		return Math.abs(bound);
	}

	let nPoint    = $derived(results ? nRequiredR(absR, powerN) : null);
	let consR     = $derived(results ? conservativeAbsR(results) : null);
	let nConserv  = $derived(results && consR !== null ? nRequiredR(consR, powerN) : null);
	let mde       = $derived(results ? mdeR(results.n, powerMDE) : null);
	let ciCrossesZero = $derived(results ? consR === null : false);

	function fmtN(n: number | null): string {
		if (n === null) return '—';
		if (n > 99999) return '>99\u202f999';
		return n.toLocaleString();
	}

	// ── Copy helpers ───────────────────────────────────────────────
	function fmtCI(ci: [number, number]): string {
		return `[${fmt(ci[0], 3)}, ${fmt(ci[1], 3)}]`;
	}

	function buildCopyText(res: Family2Results): string {
		const lines = [
			`Pearson's r = ${fmt(res.r, 3)}  95% CI ${fmtCI(res.rCI)}`,
			`R² = ${fmt(res.r2, 3)}`,
			`Fisher's z = ${fmt(res.fisherZ, 3)}`,
			`SE(z) = ${fmt(res.seZ, 3)}`,
			`Var(z) = ${fmt(res.varZ, 4)}`,
			`n = ${res.n}`
		];
		return lines.join('\n');
	}

	// ── URL sync ──────────────────────────────────────────────────
	let mounted = false;

	onMount(() => {
		const p = $page.url.searchParams;
		const it = p.get('input') as Family2InputType | null;
		if (it) inputs.inputType = it;
		if (p.get('r'))    inputs.rStr    = p.get('r')!;
		if (p.get('r2'))   inputs.r2Str   = p.get('r2')!;
		if (p.get('z'))    inputs.zStr    = p.get('z')!;
		if (p.get('t'))    inputs.tStr    = p.get('t')!;
		if (p.get('p'))    inputs.pStr    = p.get('p')!;
		if (p.get('chi2')) inputs.chi2Str = p.get('chi2')!;
		if (p.get('b'))    inputs.bStr    = p.get('b')!;
		if (p.get('sdx'))  inputs.sdxStr  = p.get('sdx')!;
		if (p.get('sdy'))  inputs.sdyStr  = p.get('sdy')!;
		if (p.get('n'))    inputs.nStr    = p.get('n')!;
		if (p.get('dir'))  inputs.direction = p.get('dir') === '-1' ? -1 : 1;
		if (p.get('lx'))   { labelX = p.get('lx')!; customLabels = true; }
		if (p.get('ly'))   { labelY = p.get('ly')!; customLabels = true; }
		mounted = true;
	});

	$effect(() => {
		if (!mounted) return;
		const u = new URLSearchParams();
		u.set('input', inputs.inputType);
		const fieldMap: Record<Family2InputType, string[][]> = {
			r:     [['r', inputs.rStr]],
			r2:    [['r2', inputs.r2Str]],
			z:     [['z', inputs.zStr]],
			t:     [['t', inputs.tStr]],
			p:     [['p', inputs.pStr]],
			chi2:  [['chi2', inputs.chi2Str]],
			slope: [['b', inputs.bStr], ['sdx', inputs.sdxStr], ['sdy', inputs.sdyStr]]
		};
		for (const [k, v] of fieldMap[inputs.inputType]) {
			if (v) u.set(k, v);
		}
		if (inputs.nStr) u.set('n', inputs.nStr);
		const needsDir: Family2InputType[] = ['r2', 'p', 'chi2'];
		if (needsDir.includes(inputs.inputType) && inputs.direction === -1) u.set('dir', '-1');
		if (labelX !== DEFAULT_LABEL_X) u.set('lx', labelX);
		if (labelY !== DEFAULT_LABEL_Y) u.set('ly', labelY);
		goto(`?${u.toString()}`, { replaceState: true, keepFocus: true, noScroll: true });
	});

	// ── Input type options ─────────────────────────────────────────
	const inputOptions: { value: Family2InputType; label: string }[] = [
		{ value: 'r',     label: "Pearson's r" },
		{ value: 'r2',    label: 'R²' },
		{ value: 'z',     label: "Fisher's z" },
		{ value: 't',     label: 't-statistic' },
		{ value: 'p',     label: 'p-value' },
		{ value: 'chi2',  label: 'Chi-square (1 df)' },
		{ value: 'slope', label: 'Regression slope' }
	];

	// ── Formulas ───────────────────────────────────────────────────
	const formulas = [
		{
			title: "r from t-statistic (H₀: ρ = 0)",
			latex: String.raw`r = \frac{t}{\sqrt{t^2 + df}}, \quad df = n - 2`,
			source: 'Standard formula for converting a correlation t-test statistic.'
		},
		{
			title: "Fisher's z transformation",
			latex: String.raw`z = \tanh^{-1}(r) = \frac{1}{2}\ln\!\left(\frac{1+r}{1-r}\right)`,
			source: 'Fisher (1921). Used for constructing CIs and meta-analytic pooling.'
		},
		{
			title: 'Standard error of Fisher\'s z',
			latex: String.raw`SE(z) = \frac{1}{\sqrt{n - 3}}`,
			source: 'Fisher (1921).'
		},
		{
			title: '95% CI for r (via Fisher z)',
			latex: String.raw`95\%\ \text{CI} = \bigl[\tanh(z - 1.96 \cdot SE),\ \tanh(z + 1.96 \cdot SE)\bigr]`,
			source: 'Fisher (1921).'
		},
		{
			title: 'phi from chi-square (2×2 table)',
			latex: String.raw`\phi = \sqrt{\frac{\chi^2}{n}}`,
			source: 'phi equals Pearson r for two binary variables.'
		},
		{
			title: 'r from regression slope',
			latex: String.raw`r = b \cdot \frac{SD_X}{SD_Y}`,
			source: 'Rearrangement of b = r × (SD_Y / SD_X) from standardised regression.'
		},
		{
			title: 'r to Cohen\'s d (equal groups)',
			latex: String.raw`d = \frac{2r}{\sqrt{1 - r^2}}`,
			source: 'Borenstein et al. (2009), eq. 7.5. Assumes equal group sizes.'
		}
	];
</script>

<svelte:head>
	<title>Correlation effect sizes: r, R², Fisher's z | Magnitood</title>
	<meta name="description" content="Convert and interpret Pearson's r, R², and Fisher's z. Input from t-statistics, p-values, chi-square, or regression slopes. Free, instant, client-side." />
</svelte:head>

<!-- Accent bar -->
<div class="h-1 bg-gradient-to-r from-violet-400 to-purple-500"></div>

<div class="mx-auto max-w-3xl px-4 py-10 space-y-6">

	<!-- Header -->
	<div>
		<h1 class="text-3xl font-bold text-gray-900">Correlations</h1>
		<p class="mt-2 text-gray-500">
			Compute and interpret Pearson's r, R², and Fisher's z. Accepts direct values or converts from
			t-statistics, p-values, chi-square statistics, or regression slopes.
		</p>
	</div>

	<!-- ── Input card ──────────────────────────────────────────── -->
	<div class="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 space-y-5">

		<!-- Input type selector -->
		<div>
			<p class="input-label mb-2">What do you have?</p>
			<div class="flex flex-wrap gap-2">
				{#each inputOptions as opt}
					<button
						type="button"
						onclick={() => { inputs.inputType = opt.value; }}
						class="rounded-full border px-3.5 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent
							{inputs.inputType === opt.value
								? 'border-violet-500 bg-violet-50 text-violet-700'
								: 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'}"
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Input type descriptions / notes -->
		{#if inputs.inputType === 't'}
			<p class="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
				This is the t-statistic from a test of whether r differs from zero, not a two-group
				comparison. Formula: r = t / √(t² + df), where df = n − 2.
			</p>
		{:else if inputs.inputType === 'chi2'}
			<p class="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
				For a 2×2 contingency table, the phi coefficient (phi = √(chi-square / n)) equals
				Pearson's r for two binary variables. Requires the direction to be specified below.
			</p>
		{:else if inputs.inputType === 'slope'}
			<p class="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
				From simple bivariate regression: r = b × (SD_X / SD_Y). Provide the unstandardised slope
				and the standard deviations of both variables.
			</p>
		{:else if inputs.inputType === 'p'}
			<p class="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
				A p-value alone does not determine the direction of the correlation. Specify whether the
				association is positive or negative below.
			</p>
		{/if}

		<!-- Fields -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

			{#if inputs.inputType === 'r'}
				<div>
					<label class="input-label" for="inp-r">Pearson's r</label>
					<input id="inp-r" type="text" inputmode="decimal" class="input-field {errors.has('r') ? 'border-red-400' : ''}"
						placeholder="e.g. 0.35" bind:value={inputs.rStr} />
					{#if errors.has('r')}<p class="mt-1 text-xs text-red-500">{errors.get('r')}</p>{/if}
				</div>

			{:else if inputs.inputType === 'r2'}
				<div>
					<label class="input-label" for="inp-r2">R²</label>
					<input id="inp-r2" type="text" inputmode="decimal" class="input-field {errors.has('r2') ? 'border-red-400' : ''}"
						placeholder="e.g. 0.12" bind:value={inputs.r2Str} />
					{#if errors.has('r2')}<p class="mt-1 text-xs text-red-500">{errors.get('r2')}</p>{/if}
				</div>

			{:else if inputs.inputType === 'z'}
				<div>
					<label class="input-label" for="inp-z">Fisher's z</label>
					<input id="inp-z" type="text" inputmode="decimal" class="input-field {errors.has('z') ? 'border-red-400' : ''}"
						placeholder="e.g. 0.365" bind:value={inputs.zStr} />
					{#if errors.has('z')}<p class="mt-1 text-xs text-red-500">{errors.get('z')}</p>{/if}
				</div>

			{:else if inputs.inputType === 't'}
				<div>
					<label class="input-label" for="inp-t">t-statistic</label>
					<input id="inp-t" type="text" inputmode="decimal" class="input-field {errors.has('t') ? 'border-red-400' : ''}"
						placeholder="e.g. 3.52" bind:value={inputs.tStr} />
					{#if errors.has('t')}<p class="mt-1 text-xs text-red-500">{errors.get('t')}</p>{/if}
				</div>

			{:else if inputs.inputType === 'p'}
				<div>
					<label class="input-label" for="inp-p">p-value</label>
					<input id="inp-p" type="text" inputmode="decimal" class="input-field {errors.has('p') ? 'border-red-400' : ''}"
						placeholder="e.g. 0.003" bind:value={inputs.pStr} />
					{#if errors.has('p')}<p class="mt-1 text-xs text-red-500">{errors.get('p')}</p>{/if}
				</div>

			{:else if inputs.inputType === 'chi2'}
				<div>
					<label class="input-label" for="inp-chi2">Chi-square statistic</label>
					<input id="inp-chi2" type="text" inputmode="decimal" class="input-field {errors.has('chi2') ? 'border-red-400' : ''}"
						placeholder="e.g. 8.41" bind:value={inputs.chi2Str} />
					{#if errors.has('chi2')}<p class="mt-1 text-xs text-red-500">{errors.get('chi2')}</p>{/if}
				</div>

			{:else if inputs.inputType === 'slope'}
				<div>
					<label class="input-label" for="inp-b">Regression slope (b)</label>
					<input id="inp-b" type="text" inputmode="decimal" class="input-field {errors.has('b') ? 'border-red-400' : ''}"
						placeholder="e.g. 0.54" bind:value={inputs.bStr} />
					{#if errors.has('b')}<p class="mt-1 text-xs text-red-500">{errors.get('b')}</p>{/if}
				</div>
			{/if}

			<!-- n — always shown -->
			<div>
				<label class="input-label" for="inp-n">Sample size (n)</label>
				<input id="inp-n" type="text" inputmode="numeric" class="input-field {errors.has('n') ? 'border-red-400' : ''}"
					placeholder="e.g. 120" bind:value={inputs.nStr} />
				{#if errors.has('n')}<p class="mt-1 text-xs text-red-500">{errors.get('n')}</p>{/if}
			</div>

			<!-- Extra slope fields -->
			{#if inputs.inputType === 'slope'}
				<div>
					<label class="input-label" for="inp-sdx">SD of X (predictor)</label>
					<input id="inp-sdx" type="text" inputmode="decimal" class="input-field {errors.has('sdx') ? 'border-red-400' : ''}"
						placeholder="e.g. 12.3" bind:value={inputs.sdxStr} />
					{#if errors.has('sdx')}<p class="mt-1 text-xs text-red-500">{errors.get('sdx')}</p>{/if}
				</div>
				<div>
					<label class="input-label" for="inp-sdy">SD of Y (outcome)</label>
					<input id="inp-sdy" type="text" inputmode="decimal" class="input-field {errors.has('sdy') ? 'border-red-400' : ''}"
						placeholder="e.g. 8.7" bind:value={inputs.sdyStr} />
					{#if errors.has('sdy')}<p class="mt-1 text-xs text-red-500">{errors.get('sdy')}</p>{/if}
				</div>
			{/if}
		</div>

		<!-- Direction toggle (for inputs that lose sign) -->
		{#if inputs.inputType === 'r2' || inputs.inputType === 'p' || inputs.inputType === 'chi2'}
			<div>
				<p class="input-label mb-2">Direction of association</p>
				<div class="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
					<button
						type="button"
						onclick={() => { inputs.direction = 1; }}
						class="rounded-md px-4 py-1.5 text-sm font-medium transition-all focus:outline-none
							{inputs.direction === 1 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
					>
						Positive
					</button>
					<button
						type="button"
						onclick={() => { inputs.direction = -1; }}
						class="rounded-md px-4 py-1.5 text-sm font-medium transition-all focus:outline-none
							{inputs.direction === -1 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
					>
						Negative
					</button>
				</div>
			</div>
		{/if}
	</div>

	<!-- ── Scatter plot ─────────────────────────────────────────── -->
	<div class="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
		<CorrelationPlot bind:svgEl={corrSvgEl} r={results?.r ?? 0} {labelX} {labelY} />

		<!-- Editable axis labels + download -->
		<div class="mt-2 flex flex-wrap items-center justify-between gap-2">
			<div class="flex items-center gap-6 text-sm text-gray-600">
				<span class="flex items-center gap-1">
					X:
					<EditableLabel value={labelX} oncommit={setLabelX} />
				</span>
				<span class="flex items-center gap-1">
					Y:
					<EditableLabel value={labelY} oncommit={setLabelY} />
				</span>
			</div>
			{#if results && corrSvgEl}
				<PlotDownloadButton getSvg={() => corrSvgEl} filename={plotFilename} />
			{/if}
		</div>

		{#if !results}
			<p class="text-center text-xs text-gray-400 mt-2">Enter values above to see the correlation</p>
		{/if}
	</div>

	<!-- ── Benchmark ribbon ─────────────────────────────────────── -->
	<div class="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
		<BenchmarkRibbon value={results?.r ?? null} metric="Pearson's r" family="r" />
	</div>

	<!-- ── Interpretation ─────────────────────────────────────────── -->
	{#if results}
		{@const res = results}
		<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<div class="border-l-4 border-violet-500 p-5">
				<p class="text-gray-800 leading-relaxed">
					This is a <strong>{size}</strong> {dirWord} correlation (r&nbsp;=&nbsp;{fmt(res.r, 3)}).
					{fmtPct(res.r2)}% of the variance in <EditableLabel value={labelY} oncommit={setLabelY} /> is accounted for by <EditableLabel value={labelX} oncommit={setLabelX} />.
					Someone 1&nbsp;SD above average on <EditableLabel value={labelX} oncommit={setLabelX} /> would typically rank around the <strong>{ordinal(pctY)} percentile</strong> on <EditableLabel value={labelY} oncommit={setLabelY} />.
				</p>

				<!-- Quick stats -->
				<div class="mt-4 grid grid-cols-3 divide-x divide-gray-100 text-center">
					<div class="px-3">
						<p class="text-xs text-gray-400 mb-0.5">R²</p>
						<p class="text-lg font-bold text-gray-900">{fmtPct(res.r2)}%</p>
						<p class="text-xs text-gray-400">variance explained</p>
					</div>
					<div class="px-3">
						<p class="text-xs text-gray-400 mb-0.5">Fisher's z</p>
						<p class="text-lg font-bold text-gray-900">{fmt(res.fisherZ, 3)}</p>
						<p class="text-xs text-gray-400">for meta-analysis</p>
					</div>
					<div class="px-3">
						<p class="text-xs text-gray-400 mb-0.5">95% CI</p>
						<p class="text-lg font-bold text-gray-900 text-base">[{fmt(res.rCI[0], 2)}, {fmt(res.rCI[1], 2)}]</p>
						<p class="text-xs text-gray-400">for r</p>
					</div>
				</div>
			</div>
			{#if (res.rCI[1] - res.rCI[0]) > 0.3}
				<div class="px-5 pt-3 pb-2">
					<p class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
						This wide confidence interval reflects considerable uncertainty about the true correlation. Interpret the point estimate with caution.
					</p>
				</div>
			{/if}

			<!-- Power panels -->
			<div class="px-5 pb-5 pt-1 space-y-2">

				<!-- Required sample size -->
				<div class="rounded-xl border border-gray-200 overflow-hidden">
					<button
						type="button"
						onclick={() => { openN = !openN; }}
						class="w-full flex items-center justify-between px-5 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
						aria-expanded={openN}
					>
						<div>
							<span class="text-sm font-semibold text-gray-700">Required sample size</span>
							<span class="ml-2 text-xs text-gray-400">for a follow-up study</span>
						</div>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
							class="w-4 h-4 text-gray-400 transition-transform duration-200 {openN ? 'rotate-180' : ''}" aria-hidden="true">
							<path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
						</svg>
					</button>

					{#if openN}
						<div class="px-5 py-4 space-y-4">
							<div class="flex items-center gap-2">
								<span class="text-xs text-gray-500">Target power:</span>
								<div class="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
									{#each POWERS as pw}
										<button type="button" onclick={() => { powerN = pw; }}
											class="rounded px-2.5 py-1 text-xs font-medium transition-all focus:outline-none
												{powerN === pw ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
										>{pw}%</button>
									{/each}
								</div>
							</div>

							<div class="space-y-2">
								<div class="flex items-baseline justify-between gap-4">
									<span class="text-sm text-gray-600">
										Point estimate <span class="text-gray-400">(r&nbsp;=&nbsp;{fmt(res.r, 3)})</span>
									</span>
									<span class="tabular-nums font-semibold text-gray-900 shrink-0">
										{#if nPoint !== null}n&nbsp;=&nbsp;{fmtN(nPoint)}
										{:else}<span class="text-gray-400 font-normal">r&nbsp;=&nbsp;0, undefined</span>{/if}
									</span>
								</div>
								<div class="flex items-baseline justify-between gap-4">
									<span class="text-sm text-gray-600">
										Conservative
										{#if ciCrossesZero}
											<span class="text-gray-400">(CI includes zero)</span>
										{:else}
											<span class="text-gray-400">(lower 95% CI: r&nbsp;=&nbsp;{fmt(consR ?? 0, 3)})</span>
										{/if}
									</span>
									<span class="tabular-nums font-semibold text-gray-900 shrink-0">
										{#if ciCrossesZero}
											<span class="text-gray-400 font-normal">not estimable</span>
										{:else if nConserv !== null}
											n&nbsp;=&nbsp;{fmtN(nConserv)}
										{:else}
											<span class="text-gray-400 font-normal">&mdash;</span>
										{/if}
									</span>
								</div>
							</div>

							<p class="text-xs text-gray-400 leading-relaxed">
								The conservative estimate uses the lower bound of the 95% CI, accounting for
								sampling uncertainty in the observed effect size. A large gap signals a noisy original
								study. Assumes &alpha;&nbsp;=&nbsp;0.05, two-tailed.
							</p>
						</div>
					{/if}
				</div>

				<!-- Minimum detectable effect -->
				<div class="rounded-xl border border-gray-200 overflow-hidden">
					<button
						type="button"
						onclick={() => { openMDE = !openMDE; }}
						class="w-full flex items-center justify-between px-5 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
						aria-expanded={openMDE}
					>
						<div>
							<span class="text-sm font-semibold text-gray-700">Minimum detectable effect</span>
							<span class="ml-2 text-xs text-gray-400">sensitivity of this study</span>
						</div>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
							class="w-4 h-4 text-gray-400 transition-transform duration-200 {openMDE ? 'rotate-180' : ''}" aria-hidden="true">
							<path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
						</svg>
					</button>

					{#if openMDE}
						<div class="px-5 py-4 space-y-4">
							<div class="flex items-center gap-2">
								<span class="text-xs text-gray-500">Target power:</span>
								<div class="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
									{#each POWERS as pw}
										<button type="button" onclick={() => { powerMDE = pw; }}
											class="rounded px-2.5 py-1 text-xs font-medium transition-all focus:outline-none
												{powerMDE === pw ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
										>{pw}%</button>
									{/each}
								</div>
							</div>

							{#if mde !== null}
								<p class="text-sm text-gray-700 leading-relaxed">
									With n&nbsp;=&nbsp;{res.n}, this study had {powerMDE}% power to detect correlations of
									<strong class="tabular-nums">|r|&nbsp;&ge;&nbsp;{fmt(mde, 3)}</strong>.
								</p>

								{#if absR > 0}
									{#if absR >= mde}
										<div class="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-xs text-green-800">
											The observed effect (|r|&nbsp;=&nbsp;{fmt(absR, 3)}) exceeds the detectable threshold.
										</div>
									{:else}
										<div class="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-800">
											The observed effect (|r|&nbsp;=&nbsp;{fmt(absR, 3)}) falls below the detectable threshold.
										</div>
									{/if}
								{/if}
							{/if}

							<p class="text-xs text-gray-400 leading-relaxed">
								Assumes &alpha;&nbsp;=&nbsp;0.05, two-tailed. Uses the actual sample size from this study.
								The minimum detectable effect does not depend on the observed effect size.
							</p>
						</div>
					{/if}
				</div>

			</div>
		</div>
	{/if}

	<!-- ── Results table ────────────────────────────────────────── -->
	{#if results}
		{@const res = results}
		<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
						<th class="px-5 py-3 text-left font-medium">Metric</th>
						<th class="px-5 py-3 text-right font-medium">Value</th>
						<th class="px-5 py-3 text-right font-medium hidden sm:table-cell">95% CI</th>
						<th class="px-3 py-3 text-right font-medium w-10"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-50">
					<tr class="hover:bg-gray-50/50">
						<td class="px-5 py-3 text-gray-700 font-medium">Pearson's r</td>
						<td class="px-5 py-3 text-right tabular-nums font-semibold text-gray-900">{fmt(res.r, 4)}</td>
						<td class="px-5 py-3 text-right tabular-nums text-gray-500 hidden sm:table-cell">{fmtCI(res.rCI)}</td>
						<td class="px-3 py-3 text-right"><CopyButton text={fmt(res.r, 4)} /></td>
					</tr>
					<tr class="hover:bg-gray-50/50">
						<td class="px-5 py-3 text-gray-700 font-medium">R²</td>
						<td class="px-5 py-3 text-right tabular-nums font-semibold text-gray-900">{fmt(res.r2, 4)}</td>
						<td class="px-5 py-3 text-right tabular-nums text-gray-400 hidden sm:table-cell">&mdash;</td>
						<td class="px-3 py-3 text-right"><CopyButton text={fmt(res.r2, 4)} /></td>
					</tr>
					<tr class="hover:bg-gray-50/50">
						<td class="px-5 py-3 text-gray-700 font-medium">
							Fisher's z
							<span class="ml-1 text-xs text-gray-400 font-normal">(for meta-analysis)</span>
						</td>
						<td class="px-5 py-3 text-right tabular-nums font-semibold text-gray-900">{fmt(res.fisherZ, 4)}</td>
						<td class="px-5 py-3 text-right tabular-nums text-gray-400 hidden sm:table-cell">&mdash;</td>
						<td class="px-3 py-3 text-right"><CopyButton text={fmt(res.fisherZ, 4)} /></td>
					</tr>
					<tr class="hover:bg-gray-50/50 bg-gray-50/30">
						<td class="px-5 py-3 text-gray-500">SE(z)</td>
						<td class="px-5 py-3 text-right tabular-nums text-gray-700">{fmt(res.seZ, 4)}</td>
						<td class="px-5 py-3 text-right tabular-nums text-gray-400 hidden sm:table-cell">&mdash;</td>
						<td class="px-3 py-3 text-right"><CopyButton text={fmt(res.seZ, 4)} /></td>
					</tr>
					<tr class="hover:bg-gray-50/50 bg-gray-50/30">
						<td class="px-5 py-3 text-gray-500">
							Var(z)
							<span class="ml-1 text-xs text-gray-400">(sampling variance)</span>
						</td>
						<td class="px-5 py-3 text-right tabular-nums text-gray-700">{fmt(res.varZ, 5)}</td>
						<td class="px-5 py-3 text-right tabular-nums text-gray-400 hidden sm:table-cell">&mdash;</td>
						<td class="px-3 py-3 text-right"><CopyButton text={fmt(res.varZ, 5)} /></td>
					</tr>
				</tbody>
			</table>

			<div class="px-5 py-3 border-t border-gray-100 flex justify-end">
				<CopyButton text={buildCopyText(res)} label="Copy all" />
			</div>
		</div>
	{/if}

	<!-- ── Cross-family conversions ─────────────────────────────── -->
	{#if results}
		{@const res = results}
		{@const d = rToD(res.r)}
		<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<button
				type="button"
				class="w-full flex items-center justify-between px-5 py-3.5 text-left bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
				onclick={(e) => {
					const panel = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
					panel.hidden = !panel.hidden;
					e.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
				}}
				aria-expanded="false"
			>
				<span class="text-sm font-semibold text-gray-700">Cross-family conversions</span>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
					class="w-4 h-4 text-gray-400" aria-hidden="true">
					<path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
				</svg>
			</button>
			<div hidden>
				<div class="px-5 py-4 space-y-3">
					<div class="flex items-baseline justify-between gap-4 text-sm">
						<span class="text-gray-600">
							Cohen's d <span class="text-gray-400">(assumes equal group sizes)</span>
						</span>
						<span class="tabular-nums font-semibold text-gray-900 shrink-0">
							{fmt(d, 3)}
							<CopyButton text={fmt(d, 3)} class="ml-1" />
						</span>
					</div>
					<p class="text-xs text-gray-400">
						d = 2r / √(1 − r²) — Borenstein et al. (2009), eq.&nbsp;7.5.
						Valid only when comparing two equal-sized groups.
					</p>
					<a
						href="{base}/cohens-d?input=d&d={fmt(d, 4)}"
						class="inline-flex items-center gap-1 text-xs text-accent hover:underline"
					>
						Open d&nbsp;=&nbsp;{fmt(d, 3)} in the mean differences calculator
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3" aria-hidden="true">
							<path fill-rule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
						</svg>
					</a>
				</div>
			</div>
		</div>
		<div class="mt-4 flex items-center justify-between gap-3">
			<a
				href="{base}/visualize?viz=pearson-r&r={results.r.toFixed(2)}"
				class="text-xs text-violet-600 hover:underline hover:text-violet-800 transition-colors"
			>
				Visualize this correlation →
			</a>
			<ShareButton />
				<CitationSnippet />
		</div>
	{/if}

	<!-- ── Formula accordion ────────────────────────────────────── -->
	<FormulaAccordion {formulas} title="Formulas and conversions" />

	<!-- ── References ───────────────────────────────────────────── -->
	<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
		<button
			type="button"
			class="w-full flex items-center justify-between px-5 py-3.5 text-left bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
			onclick={(e) => {
				const panel = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
				panel.hidden = !panel.hidden;
				e.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
			}}
			aria-expanded="false"
		>
			<span class="text-sm font-semibold text-gray-700">References</span>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
				class="w-4 h-4 text-gray-400" aria-hidden="true">
				<path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
			</svg>
		</button>
		<div hidden>
			<ul class="px-5 py-4 space-y-2 text-xs text-gray-600 leading-relaxed list-none">
				<li>Borenstein, M., Hedges, L. V., Higgins, J. P. T., &amp; Rothstein, H. R. (2009). <em>Introduction to meta-analysis.</em> Wiley.</li>
				<li>Cohen, J. (1988). <em>Statistical power analysis for the behavioral sciences</em> (2nd ed.). Lawrence Erlbaum.</li>
				<li>Fisher, R. A. (1921). On the "probable error" of a coefficient of correlation deduced from a small sample. <em>Metron, 1,</em> 3&ndash;32.</li>
				<li>Richard, F. D., Bond, C. F., Jr., &amp; Stokes-Zoota, J. J. (2003). One hundred years of social psychology quantitatively described. <em>Review of General Psychology, 7</em>(4), 331&ndash;363.</li>
			</ul>
		</div>
	</div>

</div>
