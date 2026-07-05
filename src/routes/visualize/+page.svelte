<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import DistributionPlot from '$lib/components/DistributionPlot.svelte';
	import CorrelationPlot  from '$lib/components/CorrelationPlot.svelte';
	import BinaryPlot       from '$lib/components/BinaryPlot.svelte';
	import VariancePlot     from '$lib/components/VariancePlot.svelte';

	type VizType = 'cohens-d' | 'pearson-r' | 'odds-ratio' | 'eta-squared';

	let mounted   = $state(false);
	let activeViz = $state<VizType>('cohens-d');

	// Per-viz state
	let demoD  = $state(0.5);
	let demoR  = $state(0.3);
	let demoP1 = $state(0.30);   // OR: baseline probability
	let demoP2 = $state(0.50);   // OR: comparison probability
	let demoE2 = $state(0.06);   // eta-squared

	// ── Derived: Odds Ratio panel ───────────────────────────────────
	let or = $derived(
		demoP1 > 0 && demoP1 < 1 && demoP2 > 0 && demoP2 < 1
			? (demoP2 / (1 - demoP2)) / (demoP1 / (1 - demoP1))
			: null
	);
	let rr  = $derived(demoP1 > 0 ? demoP2 / demoP1 : null);
	let rd  = $derived(demoP2 - demoP1);
	let nnt = $derived(Math.abs(rd) >= 0.005 ? Math.ceil(1 / Math.abs(rd)) : null);

	// ── Derived: Eta-squared panel ──────────────────────────────────
	let cohensF = $derived(
		demoE2 > 0 && demoE2 < 1 ? Math.sqrt(demoE2 / (1 - demoE2)) : 0
	);

	// ── URL sync ────────────────────────────────────────────────────
	$effect(() => {
		const viz = activeViz;
		const d = demoD; const r = demoR;
		const p1 = demoP1; const p2 = demoP2;
		const e2 = demoE2;
		if (!mounted) return;
		const u = new URLSearchParams();
		u.set('viz', viz);
		u.set('d',  d.toFixed(2));
		u.set('r',  r.toFixed(2));
		u.set('p1', p1.toFixed(2));
		u.set('p2', p2.toFixed(2));
		u.set('e2', e2.toFixed(3));
		goto(`?${u.toString()}`, { replaceState: true, keepFocus: true, noScroll: true });
	});

	onMount(() => {
		const p = $page.url.searchParams;
		const viz = p.get('viz') as VizType | null;
		if (viz === 'cohens-d' || viz === 'pearson-r' || viz === 'odds-ratio' || viz === 'eta-squared')
			activeViz = viz;
		const d  = parseFloat(p.get('d')  ?? ''); if (!isNaN(d))  demoD  = Math.max(-3, Math.min(3, d));
		const r  = parseFloat(p.get('r')  ?? ''); if (!isNaN(r))  demoR  = Math.max(-0.99, Math.min(0.99, r));
		const p1 = parseFloat(p.get('p1') ?? ''); if (!isNaN(p1)) demoP1 = Math.max(0.05, Math.min(0.95, p1));
		const p2 = parseFloat(p.get('p2') ?? ''); if (!isNaN(p2)) demoP2 = Math.max(0.05, Math.min(0.95, p2));
		const e2 = parseFloat(p.get('e2') ?? ''); if (!isNaN(e2)) demoE2 = Math.max(0, Math.min(0.5, e2));
		mounted = true;
	});

	// ── Benchmarks ──────────────────────────────────────────────────
	const dBenchmarks  = [{ val: 0.2, label: 'Small' }, { val: 0.5, label: 'Medium' }, { val: 0.8, label: 'Large' }];
	const rBenchmarks  = [{ val: 0.1, label: 'Small' }, { val: 0.3, label: 'Medium' }, { val: 0.5, label: 'Large' }];
	// eta² benchmarks: Cohen (1988) — small .01, medium .06, large .14
	const e2Benchmarks = [{ val: 0.01, label: 'Small' }, { val: 0.06, label: 'Medium' }, { val: 0.14, label: 'Large' }];
	// OR benchmarks equivalent to d = 0.2 / 0.5 / 0.8 via Chinn (2000): OR = exp(d × π / √3)
	const orBenchmarks = [
		{ val: 1.44, label: 'Small (≈ d 0.2)'  },
		{ val: 2.47, label: 'Medium (≈ d 0.5)' },
		{ val: 4.27, label: 'Large (≈ d 0.8)'  },
	];

	// ── Interpretation functions ─────────────────────────────────────
	function interpD(d: number) {
		const abs = Math.abs(d);
		const dir = d > 0 ? 'higher' : 'lower';
		if (abs < 0.01) return { label: 'No difference between groups.', size: '', color: 'text-gray-400' };
		if (abs < 0.2)  return { label: `Negligible effect — Group 2 is barely ${dir} than Group 1.`, size: 'Negligible', color: 'text-gray-400' };
		if (abs < 0.5)  return { label: `Small effect (d = ${d.toFixed(2)}). About ${ovlp(abs)}% of the two distributions overlap.`, size: 'Small', color: 'text-blue-600' };
		if (abs < 0.8)  return { label: `Medium effect (d = ${d.toFixed(2)}). About ${ovlp(abs)}% overlap — a difference visible to a careful observer.`, size: 'Medium', color: 'text-violet-600' };
		return { label: `Large effect (d = ${d.toFixed(2)}). About ${ovlp(abs)}% overlap — a substantial, noticeable difference.`, size: 'Large', color: 'text-orange-600' };
	}

	function interpR(r: number) {
		const abs = Math.abs(r);
		const dir = r > 0 ? 'positive' : 'negative';
		const r2  = (r * r * 100).toFixed(0);
		if (abs < 0.01) return { label: 'No linear relationship between the variables.', size: '', color: 'text-gray-400' };
		if (abs < 0.1)  return { label: `Negligible ${dir} correlation — the variables are nearly unrelated.`, size: 'Negligible', color: 'text-gray-400' };
		if (abs < 0.3)  return { label: `Small ${dir} correlation (r = ${r.toFixed(2)}). The predictor explains ${r2}% of variance (R²).`, size: 'Small', color: 'text-blue-600' };
		if (abs < 0.5)  return { label: `Medium ${dir} correlation (r = ${r.toFixed(2)}). Explains ${r2}% of variance — a clearly meaningful association.`, size: 'Medium', color: 'text-violet-600' };
		return { label: `Large ${dir} correlation (r = ${r.toFixed(2)}). Explains ${r2}% of variance — a large, reliable association.`, size: 'Large', color: 'text-orange-600' };
	}

	function interpOR(orVal: number | null, p1: number, p2: number) {
		if (orVal === null) return { label: '', size: '', color: 'text-gray-400' };
		const dir  = p2 > p1 ? 'higher' : 'lower';
		const dirV = p2 > p1 ? 'increases' : 'decreases';
		const rdAbs = Math.abs(p2 - p1);
		const nntV  = rdAbs >= 0.005 ? Math.ceil(1 / rdAbs) : null;
		const nntStr = nntV ? ` Treat ${nntV} people to see one additional ${p2 > p1 ? 'event' : 'prevented event'}.` : '';
		const orF = orVal.toFixed(2);
		if (Math.abs(orVal - 1) < 0.05) return { label: `No meaningful difference — the odds are nearly identical in both groups.`, size: '', color: 'text-gray-400' };
		if (orVal < 1.44 && orVal > 1/1.44) return { label: `Small effect (OR = ${orF}). The odds are ${dir} in the comparison group, but only modestly.${nntStr}`, size: 'Small', color: 'text-blue-600' };
		if (orVal < 2.47 && orVal > 1/2.47) return { label: `Medium effect (OR = ${orF}). The comparison group has ${dir} odds — a meaningful clinical or practical difference.${nntStr}`, size: 'Medium', color: 'text-violet-600' };
		return { label: `Large effect (OR = ${orF}). The odds ${dirV} substantially between groups — a major difference.${nntStr}`, size: 'Large', color: 'text-orange-600' };
	}

	function interpEta2(e2: number) {
		const pct = (e2 * 100).toFixed(1);
		if (e2 < 0.005) return { label: 'No variance explained — the predictor accounts for essentially nothing.', size: '', color: 'text-gray-400' };
		if (e2 < 0.01)  return { label: `Negligible effect (η² = ${e2.toFixed(3)}). Less than 1% of variance is explained.`, size: 'Negligible', color: 'text-gray-400' };
		if (e2 < 0.06)  return { label: `Small effect (η² = ${e2.toFixed(3)}). The predictor explains ${pct}% of variance.`, size: 'Small', color: 'text-blue-600' };
		if (e2 < 0.14)  return { label: `Medium effect (η² = ${e2.toFixed(3)}). Explains ${pct}% of variance — a noticeable and meaningful contribution.`, size: 'Medium', color: 'text-violet-600' };
		return { label: `Large effect (η² = ${e2.toFixed(3)}). Explains ${pct}% of variance — the predictor accounts for a substantial portion of the outcome.`, size: 'Large', color: 'text-orange-600' };
	}

	// Approximate % overlap for Cohen's d
	function ovlp(absD: number): number {
		const z = -absD / 2;
		const t = 1 / (1 + 0.2316419 * Math.abs(z));
		const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
		const phi = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-z * z / 2) * poly;
		return Math.round(2 * phi * 100);
	}

	let dInterp  = $derived(interpD(demoD));
	let rInterp  = $derived(interpR(demoR));
	let orInterp = $derived(interpOR(or, demoP1, demoP2));
	let e2Interp = $derived(interpEta2(demoE2));

	const vizTabs: { id: VizType; label: string }[] = [
		{ id: 'cohens-d',   label: "Cohen's d"   },
		{ id: 'pearson-r',  label: "Pearson's r"  },
		{ id: 'odds-ratio', label: "Odds Ratio"   },
		{ id: 'eta-squared',label: "Eta-squared"  },
	];
</script>

<svelte:head>
	<title>Effect Size Visualizer — Magnitood</title>
	<meta name="description" content="Interactively visualise Cohen's d, Pearson's r, Odds Ratio, and Eta-squared. Drag the sliders to see what different effect sizes look like." />
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-10 space-y-6">

	<div class="text-center space-y-1">
		<h1 class="text-2xl font-bold text-gray-900">Effect Size Visualizer</h1>
		<p class="text-sm text-gray-500">Drag the sliders to see what different effect sizes look like.</p>
	</div>

	<!-- Tab switcher -->
	<div class="flex justify-center">
		<div class="inline-flex rounded-xl bg-gray-100 p-1 gap-1 flex-wrap justify-center">
			{#each vizTabs as tab}
				<button
					onclick={() => { activeViz = tab.id; }}
					class="rounded-lg px-4 py-1.5 text-sm font-medium transition-colors
						{activeViz === tab.id
							? 'bg-white text-gray-900 shadow-sm'
							: 'text-gray-500 hover:text-gray-700'}"
				>{tab.label}</button>
			{/each}
		</div>
	</div>

	<!-- ── Cohen's d ──────────────────────────────────────────────── -->
	{#if activeViz === 'cohens-d'}
		<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<div class="p-5 space-y-4">
				<div class="flex items-center justify-between gap-3">
					<div class="flex items-baseline gap-2">
						<span class="text-3xl font-bold tabular-nums text-gray-900">{demoD.toFixed(2)}</span>
						<span class="text-sm text-gray-400">Cohen's d</span>
					</div>
					{#if dInterp.size}
						<span class="rounded-full px-3 py-0.5 text-xs font-semibold bg-gray-100 {dInterp.color}">{dInterp.size}</span>
					{/if}
				</div>

				<DistributionPlot d={demoD} height={220} />

				<div class="space-y-1.5">
					<input type="range" min="-2" max="2" step="0.05" bind:value={demoD}
						class="w-full accent-violet-500" aria-label="Cohen's d" />
					<div class="relative h-5">
						{#each dBenchmarks as bm}
							{@const pp = ((bm.val + 2) / 4) * 100}
							{@const pn = ((-bm.val + 2) / 4) * 100}
							<button onclick={() => { demoD = bm.val; }}
								class="absolute -translate-x-1/2 text-[10px] text-gray-400 hover:text-violet-600 transition-colors"
								style="left:{pp}%" title="d = {bm.val}">{bm.label}</button>
							<button onclick={() => { demoD = -bm.val; }}
								class="absolute -translate-x-1/2 text-[10px] text-gray-400 hover:text-violet-600 transition-colors"
								style="left:{pn}%" title="d = {-bm.val}">{bm.label}</button>
						{/each}
					</div>
					<div class="flex justify-between text-[10px] text-gray-300">
						<span>d = −2</span><span>d = 0</span><span>d = +2</span>
					</div>
				</div>

				<p class="text-sm {dInterp.color} leading-relaxed">{dInterp.label}</p>

				<details class="text-xs text-gray-500 leading-relaxed">
					<summary class="cursor-pointer font-medium text-gray-600 hover:text-gray-800 list-none flex items-center gap-1.5">
						<svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
						What is Cohen's d?
					</summary>
					<div class="mt-2 pl-5 space-y-1.5">
						<p>Cohen's d is the standardised difference between two group means: (Mean₂ − Mean₁) ÷ pooled SD. Because it uses SD units, d = 0.5 always means "half a standard deviation apart" regardless of the original scale.</p>
						<p>The two curves show the score distributions for each group. A larger |d| means less overlap and a more visible difference. Cohen's benchmarks (small 0.2, medium 0.5, large 0.8) are rough guides — the practical importance of any effect depends on context.</p>
					</div>
				</details>
			</div>
			<div class="border-t border-gray-100 px-5 py-3 bg-gray-50 flex items-center justify-between">
				<span class="text-xs text-gray-400">Need 95% CI, Hedges' g, CLES, power?</span>
				<a href="{base}/cohens-d" class="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors">Open full calculator →</a>
			</div>
		</div>

	<!-- ── Pearson's r ─────────────────────────────────────────────── -->
	{:else if activeViz === 'pearson-r'}
		<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<div class="p-5 space-y-4">
				<div class="flex items-center justify-between gap-3">
					<div class="flex items-baseline gap-2">
						<span class="text-3xl font-bold tabular-nums text-gray-900">{demoR.toFixed(2)}</span>
						<span class="text-sm text-gray-400">Pearson's r</span>
					</div>
					<div class="flex items-center gap-2">
						{#if rInterp.size}
							<span class="rounded-full px-3 py-0.5 text-xs font-semibold bg-gray-100 {rInterp.color}">{rInterp.size}</span>
						{/if}
						<span class="rounded-full px-3 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500">
							R² = {(demoR * demoR * 100).toFixed(1)}%
						</span>
					</div>
				</div>

				<CorrelationPlot r={demoR} />

				<div class="space-y-1.5">
					<input type="range" min="-0.99" max="0.99" step="0.01" bind:value={demoR}
						class="w-full accent-violet-500" aria-label="Pearson's r" />
					<div class="relative h-5">
						{#each rBenchmarks as bm}
							{@const pp = ((bm.val + 0.99) / 1.98) * 100}
							{@const pn = ((-bm.val + 0.99) / 1.98) * 100}
							<button onclick={() => { demoR = bm.val; }}
								class="absolute -translate-x-1/2 text-[10px] text-gray-400 hover:text-violet-600 transition-colors"
								style="left:{pp}%" title="r = {bm.val}">{bm.label}</button>
							<button onclick={() => { demoR = -bm.val; }}
								class="absolute -translate-x-1/2 text-[10px] text-gray-400 hover:text-violet-600 transition-colors"
								style="left:{pn}%" title="r = {-bm.val}">{bm.label}</button>
						{/each}
					</div>
					<div class="flex justify-between text-[10px] text-gray-300">
						<span>r = −1</span><span>r = 0</span><span>r = +1</span>
					</div>
				</div>

				<p class="text-sm {rInterp.color} leading-relaxed">{rInterp.label}</p>

				<details class="text-xs text-gray-500 leading-relaxed">
					<summary class="cursor-pointer font-medium text-gray-600 hover:text-gray-800 list-none flex items-center gap-1.5">
						<svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
						What is Pearson's r?
					</summary>
					<div class="mt-2 pl-5 space-y-1.5">
						<p>Pearson's r measures the strength and direction of the linear relationship between two continuous variables, ranging from −1 (perfect negative) through 0 (no relationship) to +1 (perfect positive). Each dot represents one observation.</p>
						<p>r² (R-squared) is the proportion of variance in one variable explained by the other. At r = 0.5, R² = 25%. Cohen's benchmarks: small ≥ 0.1, medium ≥ 0.3, large ≥ 0.5.</p>
					</div>
				</details>
			</div>
			<div class="border-t border-gray-100 px-5 py-3 bg-gray-50 flex items-center justify-between">
				<span class="text-xs text-gray-400">Need Fisher's z, CI, significance test?</span>
				<a href="{base}/correlation" class="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors">Open full calculator →</a>
			</div>
		</div>

	<!-- ── Odds Ratio ──────────────────────────────────────────────── -->
	{:else if activeViz === 'odds-ratio'}
		<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<div class="p-5 space-y-4">

				<!-- Header: primary metric + secondary badges -->
				<div class="flex items-start justify-between gap-3 flex-wrap">
					<div class="flex items-baseline gap-2">
						<span class="text-3xl font-bold tabular-nums text-gray-900">
							{or !== null ? or.toFixed(2) : '—'}
						</span>
						<span class="text-sm text-gray-400">Odds Ratio</span>
					</div>
					<div class="flex items-center gap-2 flex-wrap">
						{#if orInterp.size}
							<span class="rounded-full px-3 py-0.5 text-xs font-semibold bg-gray-100 {orInterp.color}">{orInterp.size}</span>
						{/if}
						{#if rr !== null}
							<span class="rounded-full px-3 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500">
								RR = {rr.toFixed(2)}
							</span>
						{/if}
						<span class="rounded-full px-3 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500">
							RD = {rd >= 0 ? '+' : ''}{(rd * 100).toFixed(1)}pp
						</span>
						{#if nnt !== null}
							<span class="rounded-full px-3 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500">
								NNT = {nnt}
							</span>
						{/if}
					</div>
				</div>

				<!-- Waffle chart -->
				<BinaryPlot p1={demoP1} p2={demoP2} label1="Group 1 (baseline)" label2="Group 2 (comparison)" labelEvent="event" />

				<!-- Two sliders -->
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-1.5">
						<div class="flex justify-between items-baseline">
							<span class="text-xs font-medium text-gray-600">Group 1 (baseline)</span>
							<span class="text-sm font-bold tabular-nums text-orange-500">{(demoP1 * 100).toFixed(0)}%</span>
						</div>
						<input type="range" min="0.05" max="0.95" step="0.01" bind:value={demoP1}
							class="w-full accent-orange-400" aria-label="Baseline probability" />
						<div class="flex justify-between text-[10px] text-gray-300">
							<span>5%</span><span>50%</span><span>95%</span>
						</div>
					</div>
					<div class="space-y-1.5">
						<div class="flex justify-between items-baseline">
							<span class="text-xs font-medium text-gray-600">Group 2 (comparison)</span>
							<span class="text-sm font-bold tabular-nums text-orange-400">{(demoP2 * 100).toFixed(0)}%</span>
						</div>
						<input type="range" min="0.05" max="0.95" step="0.01" bind:value={demoP2}
							class="w-full accent-orange-400" aria-label="Comparison probability" />
						<div class="flex justify-between text-[10px] text-gray-300">
							<span>5%</span><span>50%</span><span>95%</span>
						</div>
					</div>
				</div>

				<!-- OR benchmark reference -->
				<div class="rounded-xl bg-gray-50 border border-gray-100 px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1">
					<span class="text-[10px] font-semibold uppercase tracking-wide text-gray-400 self-center">OR benchmarks</span>
					{#each orBenchmarks as bm}
						<button onclick={() => {
							// Keep p1 fixed, solve p2 from target OR: p2 = OR × odds1 / (1 + OR × odds1)
							const odds1 = demoP1 / (1 - demoP1);
							demoP2 = Math.min(0.95, Math.max(0.05, (bm.val * odds1) / (1 + bm.val * odds1)));
						}}
							class="text-[10px] text-gray-500 hover:text-violet-600 transition-colors cursor-pointer">
							<span class="font-semibold">{bm.val.toFixed(2)}</span>
							<span class="text-gray-400"> {bm.label}</span>
						</button>
					{/each}
				</div>

				<p class="text-sm {orInterp.color} leading-relaxed">{orInterp.label}</p>

				<details class="text-xs text-gray-500 leading-relaxed">
					<summary class="cursor-pointer font-medium text-gray-600 hover:text-gray-800 list-none flex items-center gap-1.5">
						<svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
						What is an Odds Ratio?
					</summary>
					<div class="mt-2 pl-5 space-y-1.5">
						<p>The Odds Ratio compares the odds of an event in two groups. Odds = p / (1 − p), so OR = (p₂ / (1−p₂)) ÷ (p₁ / (1−p₁)). An OR of 1 means identical odds; OR &gt; 1 means higher odds in Group 2.</p>
						<p>Each grid above shows 100 people. Coloured dots had the event. The OR summarises the same information as the Risk Ratio (RR = p₂/p₁) and Risk Difference (RD = p₂ − p₁), but is scale-invariant — the same OR can represent very different absolute differences depending on the baseline rate. OR benchmarks loosely correspond to Cohen's d benchmarks via Chinn (2000): OR ≈ 1.44 ~ d 0.2, OR ≈ 2.47 ~ d 0.5, OR ≈ 4.27 ~ d 0.8.</p>
					</div>
				</details>
			</div>
			<div class="border-t border-gray-100 px-5 py-3 bg-gray-50 flex items-center justify-between">
				<span class="text-xs text-gray-400">Need NNT, CI, phi, absolute risk?</span>
				<a href="{base}/binary-outcomes" class="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors">Open full calculator →</a>
			</div>
		</div>

	<!-- ── Eta-squared ─────────────────────────────────────────────── -->
	{:else if activeViz === 'eta-squared'}
		<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<div class="p-5 space-y-4">
				<div class="flex items-center justify-between gap-3">
					<div class="flex items-baseline gap-2">
						<span class="text-3xl font-bold tabular-nums text-gray-900">{demoE2.toFixed(3)}</span>
						<span class="text-sm text-gray-400">η² (eta-squared)</span>
					</div>
					<div class="flex items-center gap-2">
						{#if e2Interp.size}
							<span class="rounded-full px-3 py-0.5 text-xs font-semibold bg-gray-100 {e2Interp.color}">{e2Interp.size}</span>
						{/if}
						<span class="rounded-full px-3 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500">
							f = {cohensF.toFixed(2)}
						</span>
					</div>
				</div>

				<VariancePlot eta2={demoE2} cohensF={cohensF} />

				<div class="space-y-1.5">
					<input type="range" min="0" max="0.5" step="0.005" bind:value={demoE2}
						class="w-full accent-emerald-500" aria-label="Eta-squared" />
					<div class="relative h-5">
						{#each e2Benchmarks as bm}
							{@const pct = (bm.val / 0.5) * 100}
							<button onclick={() => { demoE2 = bm.val; }}
								class="absolute -translate-x-1/2 text-[10px] text-gray-400 hover:text-emerald-600 transition-colors"
								style="left:{pct}%" title="η² = {bm.val}">{bm.label}</button>
						{/each}
					</div>
					<div class="flex justify-between text-[10px] text-gray-300">
						<span>η² = 0</span><span>0.25</span><span>0.50</span>
					</div>
				</div>

				<p class="text-sm {e2Interp.color} leading-relaxed">{e2Interp.label}</p>

				<details class="text-xs text-gray-500 leading-relaxed">
					<summary class="cursor-pointer font-medium text-gray-600 hover:text-gray-800 list-none flex items-center gap-1.5">
						<svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
						What is eta-squared?
					</summary>
					<div class="mt-2 pl-5 space-y-1.5">
						<p>Eta-squared (η²) is the proportion of total variance in the outcome that is accounted for by the predictor. It is the ANOVA equivalent of R²: η² = SS_effect / SS_total. Each dot above represents 1% of variance — coloured dots are explained, grey dots are not.</p>
						<p>Cohen's f (shown in the badge) is a related measure: f = √(η² / (1 − η²)), with benchmarks small ≥ 0.10, medium ≥ 0.25, large ≥ 0.40. Partial η² is preferred in factorial ANOVA designs because it partials out other factors. Cohen's benchmarks for η²: small ≥ .01, medium ≥ .06, large ≥ .14.</p>
					</div>
				</details>
			</div>
			<div class="border-t border-gray-100 px-5 py-3 bg-gray-50 flex items-center justify-between">
				<span class="text-xs text-gray-400">Need partial η², omega-squared, power?</span>
				<a href="{base}/variance-explained" class="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors">Open full calculator →</a>
			</div>
		</div>
	{/if}

</div>
