<script lang="ts">
	import type { BenchmarkSetKey, BenchmarkSet } from '$lib/types/effects.js';

	interface Props {
		value: number | null;
		metric?: string;
		family?: 'd' | 'r' | 'f' | 'or';
	}

	let { value, metric = "Cohen's d", family = 'd' }: Props = $props();

	let orNoteOpen = $state(false);

	// ── Family d (mean differences) ────────────────────────────────
	const dBenchmarkSets: Record<BenchmarkSetKey, BenchmarkSet> = {
		cohen: {
			label: "Cohen's conventions (1988)",
			thresholds: { small: 0.2, medium: 0.5, large: 0.8 },
			note: "Widely used but arbitrary conventions. Cohen himself cautioned against rigid interpretation."
		},
		social_science: {
			label: 'Social / behavioural science',
			thresholds: { small: 0.1, medium: 0.3, large: 0.5 },
			note: 'Based on typical effect sizes in social psychology (Richard et al., 2003; Lovakov & Agadullina, 2021).'
		},
		education: {
			label: 'Education (Hattie)',
			thresholds: { small: 0.2, medium: 0.4, large: 0.6 },
			note: "Based on Hattie's (2009) synthesis of educational interventions."
		},
		clinical: {
			label: 'Clinical significance',
			thresholds: { small: 0.2, medium: 0.5, large: 0.8 },
			note: 'Clinical significance is context-dependent; these align with Cohen in many clinical settings.'
		},
		ux_product: {
			label: 'UX / product experiments',
			thresholds: { small: 0.1, medium: 0.2, large: 0.5 },
			note: 'In product experiments, even small effects can be meaningful at scale.'
		}
	};

	// ── Family r (correlations) ────────────────────────────────────
	const rBenchmarkSets = {
		cohen_r: {
			label: "Cohen's conventions (1988)",
			thresholds: { small: 0.10, medium: 0.30, large: 0.50 },
			note: "Cohen's widely used thresholds for correlation magnitude. Treat as rough guides, not hard rules."
		},
		social_science_r: {
			label: 'Social / behavioural science',
			thresholds: { small: 0.10, medium: 0.20, large: 0.40 },
			note: 'Typical correlations in social psychology tend to be smaller (Richard et al., 2003).'
		}
	};
	type RBenchmarkKey = keyof typeof rBenchmarkSets;

	// ── Family or (binary outcomes / odds ratio) ──────────────────
	// Thresholds in |logOR| units, derived from Borenstein d→OR:
	//   d=0.2 → logOR=0.363 (OR≈1.44), d=0.5 → 0.907 (OR≈2.47), d=0.8 → 1.451 (OR≈4.27)
	const orBenchmarkSets = {
		borenstein: {
			label: 'Borenstein et al. (2009)',
			thresholds: { small: 0.363, medium: 0.907, large: 1.451 },
			note: 'Converted from Cohen d thresholds via logOR = d·π/√3 (Borenstein et al., 2009). OR equivalents: small ≈ 1.44, medium ≈ 2.47, large ≈ 4.27.'
		},
		epidemiology: {
			label: 'Common epidemiology heuristic',
			thresholds: { small: 0.405, medium: 1.099, large: 1.792 },
			note: 'Rough field heuristic: small OR≈1.5, medium OR≈3.0, large OR≈6.0. Highly context-dependent.'
		}
	};
	type ORBenchmarkKey = keyof typeof orBenchmarkSets;

	// ── Family f (variance explained / ANOVA) ─────────────────────
	const fBenchmarkSets = {
		cohen_f: {
			label: "Cohen's conventions (1988)",
			thresholds: { small: 0.10, medium: 0.25, large: 0.40 },
			note: "Cohen's thresholds for f. Equivalent η²: small ≈ .01, medium ≈ .06, large ≈ .14."
		},
		lovakov_f: {
			label: "Psychology empirical (Lovakov & Agadullina, 2021)",
			thresholds: { small: 0.10, medium: 0.31, large: 0.58 },
			note: "Based on meta-analysis of effects in psychology. Equivalent η²: small ≈ .01, medium ≈ .09, large ≈ .25."
		},
		sullivan_f: {
			label: "Medical / clinical (Sullivan & Feinn, 2012)",
			thresholds: { small: 0.10, medium: 0.25, large: 0.40 },
			note: "Sullivan & Feinn (2012) align with Cohen for clinical research. Equivalent η²: small ≈ .01, medium ≈ .06, large ≈ .14."
		}
	};
	type FBenchmarkKey = keyof typeof fBenchmarkSets;

	let selectedDKey  = $state<BenchmarkSetKey>('cohen');
	let selectedRKey  = $state<RBenchmarkKey>('cohen_r');
	let selectedFKey  = $state<FBenchmarkKey>('cohen_f');
	let selectedORKey = $state<ORBenchmarkKey>('borenstein');

	let set = $derived(
		family === 'r'  ? rBenchmarkSets[selectedRKey]   :
		family === 'f'  ? fBenchmarkSets[selectedFKey]   :
		family === 'or' ? orBenchmarkSets[selectedORKey] :
		dBenchmarkSets[selectedDKey]
	);

	// Ribbon gradient tinted to match each family's page accent
	const GRADIENTS: Record<'d' | 'r' | 'f' | 'or', [string, string, string, string, string]> = {
		d:  ['#e0e7ff', '#a5b4fc', '#818cf8', '#4f46e5', '#3730a3'], // indigo
		r:  ['#ede9fe', '#c4b5fd', '#a78bfa', '#7c3aed', '#5b21b6'], // violet
		f:  ['#d1fae5', '#6ee7b7', '#34d399', '#059669', '#065f46'], // emerald
		or: ['#ffedd5', '#fdba74', '#fb923c', '#ea580c', '#9a3412']  // orange
	};
	let grad = $derived(GRADIENTS[family]);

	let absVal = $derived(value !== null ? Math.abs(value) : null);
	let ribbonMax = $derived(set.thresholds.large * 1.6);
	let markerPct = $derived(
		absVal !== null ? Math.min(100, Math.max(0, (absVal / ribbonMax) * 100)) : null
	);

	function label(): string {
		if (absVal === null) return '—';
		const { small, medium, large } = set.thresholds;
		if (absVal < small) return 'negligible';
		if (absVal < medium) return 'small';
		if (absVal < large) return 'medium';
		return 'large';
	}

	function pctOf(threshold: number): number {
		return (threshold / ribbonMax) * 100;
	}
</script>

<div class="space-y-2">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<span class="text-xs font-medium text-gray-500 uppercase tracking-wide">
			Benchmark: {metric}
		</span>

		{#if family === 'r'}
			<select
				bind:value={selectedRKey}
				class="text-xs rounded border border-gray-200 bg-white px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
				aria-label="Select benchmark set"
			>
				{#each Object.entries(rBenchmarkSets) as [key, bs]}
					<option value={key}>{bs.label}</option>
				{/each}
			</select>
		{:else if family === 'f'}
			<select
				bind:value={selectedFKey}
				class="text-xs rounded border border-gray-200 bg-white px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
				aria-label="Select benchmark set"
			>
				{#each Object.entries(fBenchmarkSets) as [key, bs]}
					<option value={key}>{bs.label}</option>
				{/each}
			</select>
		{:else if family === 'or'}
			<select
				bind:value={selectedORKey}
				class="text-xs rounded border border-gray-200 bg-white px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
				aria-label="Select benchmark set"
			>
				{#each Object.entries(orBenchmarkSets) as [key, bs]}
					<option value={key}>{bs.label}</option>
				{/each}
			</select>
		{:else}
			<select
				bind:value={selectedDKey}
				class="text-xs rounded border border-gray-200 bg-white px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
				aria-label="Select benchmark set"
			>
				{#each Object.entries(dBenchmarkSets) as [key, bs]}
					<option value={key}>{bs.label}</option>
				{/each}
			</select>
		{/if}
	</div>

	<!-- Gradient ribbon -->
	<div class="relative h-10 rounded-full overflow-hidden" style="background: linear-gradient(to right, {grad[0]} 0%, {grad[1]} {pctOf(set.thresholds.small)}%, {grad[2]} {pctOf(set.thresholds.medium)}%, {grad[3]} {pctOf(set.thresholds.large)}%, {grad[4]} 100%);">

		<!-- Threshold ticks -->
		{#each [{ v: set.thresholds.small, lbl: 'Small' }, { v: set.thresholds.medium, lbl: 'Medium' }, { v: set.thresholds.large, lbl: 'Large' }] as tick}
			<div
				class="absolute top-0 bottom-0 flex flex-col items-center justify-end pb-1"
				style="left: {pctOf(tick.v)}%; transform: translateX(-50%);"
			>
				<span class="text-white text-[9px] font-semibold drop-shadow leading-none">{tick.lbl}</span>
				<span class="text-white/80 text-[9px] leading-none">{family === 'or' ? 'OR ' + Math.exp(tick.v).toFixed(2) : tick.v}</span>
			</div>
		{/each}

		<!-- Marker dot -->
		{#if markerPct !== null}
			<div
				class="absolute top-1/2 w-4 h-4 rounded-full bg-white border-2 border-gray-800 shadow-lg transition-all duration-200"
				style="left: {markerPct}%; transform: translate(-50%, -50%);"
				role="presentation"
				aria-hidden="true"
			></div>
		{/if}
	</div>

	<!-- Value and label -->
	<div class="flex items-center justify-between text-xs text-gray-500">
		<span>
			{#if absVal !== null}
				{#if family === 'or'}
					<span class="font-semibold text-gray-800">OR = {Math.exp(absVal).toFixed(3)}</span>
					= <span class="font-medium text-accent-700">{label()}</span>
					{#if value !== null && value < 0}
						<span class="text-gray-400">(reciprocal · your OR = {Math.exp(value).toFixed(3)})</span>
					{/if}
				{:else}
					<span class="font-semibold text-gray-800">{absVal.toFixed(3)}</span>
					= <span class="font-medium text-accent-700">{label()}</span>
					{#if value !== null && value < 0}
						<span class="text-gray-400">(negative direction)</span>
					{/if}
				{/if}
			{:else}
				Enter values to see benchmark
			{/if}
		</span>
		<span class="text-gray-400 max-w-xs text-right leading-tight hidden sm:block">
			{#if family !== 'or'}{set.note}{/if}
		</span>
	</div>
	{#if family !== 'or'}
	<p class="text-xs text-gray-400 leading-tight sm:hidden">{set.note}</p>
	{/if}
	<p class="mt-1 text-[10px] text-gray-400 leading-tight">Benchmarks are field-agnostic conventions — what counts as ‘large’ varies by discipline. Interpret in context.</p>

	{#if family === 'or'}
		<div class="mt-2 rounded-lg border border-blue-100 bg-blue-50 text-xs text-blue-700 leading-relaxed">
			<button
				onclick={() => { orNoteOpen = !orNoteOpen; }}
				class="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-100 rounded-lg transition-colors focus:outline-none"
				aria-expanded={orNoteOpen}
			>
				<strong>Why OR benchmarks are only approximate</strong>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
					class="w-3.5 h-3.5 text-blue-400 shrink-0 ml-2 transition-transform duration-200 {orNoteOpen ? 'rotate-180' : ''}" aria-hidden="true">
					<path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
				</svg>
			</button>
			{#if orNoteOpen}
				<div class="px-3 pb-2 space-y-1">
					<p>The Borenstein/Chinn thresholds above (OR ≈ 1.44 / 2.47 / 4.27) are derived by converting Cohen's d using logOR = d · π/√3, which assumes a logistic latent-variable distribution. This gives a single fixed set of thresholds — but that assumption only holds when the baseline event rate is around 50%.</p>
					<p>Chen et al. (2010) showed that the OR equivalent to a given Cohen's d depends on the baseline rate in the control group. At a 1% baseline rate, small/medium/large correspond to OR ≈ 1.68 / 3.47 / 6.71. As the baseline rises toward 50%, the thresholds converge toward the Borenstein values, then diverge again above 50%. The practical implication: the same OR can represent a larger or smaller effect depending on how common the outcome already is.</p>
					<p class="text-blue-500">Treat any OR benchmark as a rough guide. When baseline rates are far from 50%, report the risk difference or risk ratio alongside the OR — they are easier to interpret and do not have this dependency.</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
