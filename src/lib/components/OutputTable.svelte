<script lang="ts">
	import CopyButton from './CopyButton.svelte';
	import { hedgesJ, hedgesJOneSample } from '$lib/math/conversions.js';
	import type { Family1Results } from '$lib/types/effects.js';

	interface Props {
		results: Family1Results | null;
		showGlassDelta?: boolean;
	}

	let { results, showGlassDelta = false }: Props = $props();

	function fmt(n: number | null | undefined, decimals = 3): string {
		if (n === null || n === undefined) return '—';
		return n.toFixed(decimals);
	}

	function fmtCI(ci: [number, number] | undefined, decimals = 3): string {
		if (!ci) return '—';
		return `[${ci[0].toFixed(decimals)}, ${ci[1].toFixed(decimals)}]`;
	}

	interface Row {
		name: string;
		value: string;
		ci: string;
		se: string;
		copyText: string;
		note?: string;
	}

	let rows = $derived(buildRows(results));

	function buildRows(r: Family1Results | null): Row[] {
		if (!r) return [];

		const { d, g, glassDelta, r: rVal, variance, se, dCI, gCI, rCI, designType, ds } = r;
		// Correction factor J from sample sizes (g/d ratio would be NaN at d = 0)
		const J = designType === 'one-sample' ? hedgesJOneSample(r.n1) : hedgesJ(r.n1, r.n2);
		const isPaired = designType === 'paired';
		const isOneSample = designType === 'one-sample';

		const out: Row[] = [
			{
				name: isPaired ? "Cohen's d_z (within-person)" : isOneSample ? "Cohen's d₁ (one-sample)" : "Cohen's d",
				value: fmt(d),
				ci: fmtCI(dCI),
				se: fmt(se, 4),
				copyText: fmt(d),
				note: isPaired ? 'Not directly comparable to independent-samples d' : undefined
			},
			{
				name: isPaired ? "Hedges' g_z" : isOneSample ? "Hedges' g₁" : "Hedges' g",
				value: fmt(g),
				ci: fmtCI(gCI),
				se: fmt(se * J, 4),
				copyText: fmt(g)
			}
		];

		if (isPaired && ds !== null) {
			out.push({
				name: "Cohen's d_s (between-person)",
				value: fmt(ds),
				ci: '—',
				se: '—',
				copyText: fmt(ds),
				note: 'Comparable to independent-samples d; requires r'
			});
		}

		if (showGlassDelta && glassDelta !== null) {
			out.push({
				name: "Glass's Δ",
				value: fmt(glassDelta),
				ci: '—',
				se: '—',
				copyText: fmt(glassDelta),
				note: 'Uses control group SD only'
			});
		}

		out.push(
			{
				name: 'r (point-biserial)',
				value: fmt(rVal),
				ci: fmtCI(rCI),
				se: '—',
				copyText: fmt(rVal)
			},
			{
				name: isPaired ? 'Var(d_z)' : isOneSample ? 'Var(d₁)' : 'Var(d)',
				value: fmt(variance, 4),
				ci: '—',
				se: '—',
				copyText: fmt(variance, 4),
				note: 'Sampling variance (for meta-analysis)'
			},
			{
				name: isPaired ? 'SE(d_z)' : isOneSample ? 'SE(d₁)' : 'SE(d)',
				value: fmt(se, 4),
				ci: '—',
				se: '—',
				copyText: fmt(se, 4),
				note: 'Standard error (for meta-analysis)'
			}
		);

		return out;
	}

	// "Copy all as table" formatted output
	let copyAllText = $derived(buildCopyAll(results));

	function buildCopyAll(r: Family1Results | null): string {
		if (!r) return '';
		const { d, g, r: rVal, cles, u3, ovl, variance, se, dCI, gCI, rCI, designType, ds } = r;
		const isPaired = designType === 'paired';
		const isOneSample = designType === 'one-sample';
		const dLabel = isPaired ? "Cohen's d_z      " : isOneSample ? "Cohen's d₁       " : "Cohen's d        ";
		const gLabel = isPaired ? "Hedges' g_z      " : isOneSample ? "Hedges' g₁       " : "Hedges' g        ";
		const varLabel = isPaired ? 'Var(d_z)         ' : isOneSample ? 'Var(d₁)          ' : 'Var(d)           ';
		const seLabel  = isPaired ? 'SE(d_z)          ' : isOneSample ? 'SE(d₁)           ' : 'SE(d)            ';
		const lines = [
			'Effect size         Value      95% CI               SE',
			`${dLabel}  ${fmt(d).padEnd(10)} ${fmtCI(dCI).padEnd(20)} ${fmt(se, 4)}`,
			`${gLabel}  ${fmt(g).padEnd(10)} ${fmtCI(gCI).padEnd(20)} —`,
		];
		if (isPaired && ds !== null) {
			lines.push(`Cohen's d_s        ${fmt(ds).padEnd(10)} —                    —`);
		}
		lines.push(
			`r (point-biserial) ${fmt(rVal).padEnd(10)} ${fmtCI(rCI).padEnd(20)} —`,
			`CLES               ${(cles * 100).toFixed(1)}%`,
			`U3                 ${(u3 * 100).toFixed(1)}%`,
			`Overlap            ${(ovl * 100).toFixed(1)}%`,
			`${varLabel}  ${fmt(variance, 4)}`,
			`${seLabel}  ${fmt(se, 4)}`
		);
		return lines.join('\n');
	}
</script>

{#if results}
	<!-- Desktop table (hidden on mobile) -->
	<div class="hidden sm:block overflow-x-auto">
		<table class="w-full text-sm" aria-label="Effect size results">
			<thead>
				<tr class="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
					<th class="pb-2 pr-4 font-medium">Metric</th>
					<th class="pb-2 pr-4 font-medium tabular-nums">Value</th>
					<th class="pb-2 pr-4 font-medium tabular-nums">95% CI</th>
					<th class="pb-2 pr-4 font-medium tabular-nums">SE</th>
					<th class="pb-2 font-medium"><span class="sr-only">Copy</span></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-100">
				{#each rows as row}
					<tr class="group">
						<td class="py-2.5 pr-4 text-gray-700 font-medium">
							{row.name}
							{#if row.note}
								<span class="ml-1 text-xs font-normal text-gray-400">({row.note})</span>
							{/if}
						</td>
						<td class="py-2.5 pr-4 tabular-nums text-gray-900 font-semibold">{row.value}</td>
						<td class="py-2.5 pr-4 tabular-nums text-gray-600">{row.ci}</td>
						<td class="py-2.5 pr-4 tabular-nums text-gray-600">{row.se}</td>
						<td class="py-2.5">
							<CopyButton text={row.copyText} title="Copy {row.name}" />
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Mobile stacked cards -->
	<div class="sm:hidden space-y-2">
		{#each rows as row}
			<div class="card px-4 py-3 flex items-start justify-between gap-4">
				<div class="min-w-0">
					<div class="text-xs text-gray-500 font-medium">{row.name}</div>
					<div class="text-xl font-bold tabular-nums text-gray-900 mt-0.5">{row.value}</div>
					{#if row.ci !== '—'}
						<div class="text-xs text-gray-500 mt-0.5">95% CI {row.ci}</div>
					{/if}
					{#if row.se !== '—'}
						<div class="text-xs text-gray-400">SE {row.se}</div>
					{/if}
					{#if row.note}
						<div class="text-xs text-gray-400 italic">{row.note}</div>
					{/if}
				</div>
				<CopyButton text={row.copyText} title="Copy" size="md" />
			</div>
		{/each}
	</div>

	<!-- Copy all button -->
	<div class="mt-3 flex items-center justify-between gap-3">
		<details class="group">
			<summary class="cursor-pointer text-[11px] text-gray-400 hover:text-gray-600 list-none flex items-center gap-1 select-none">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3 transition-transform group-open:rotate-90" aria-hidden="true"><path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg>
				What does the 95% CI mean?
			</summary>
			<p class="mt-1.5 text-[11px] text-gray-500 leading-relaxed max-w-sm">
				If the study were repeated many times, 95% of the CIs constructed this way would contain the true effect size. A <strong>narrow CI</strong> means the estimate is precise; a <strong>wide CI</strong> means the sample size is too small to pin down the effect. A CI that crosses zero is statistically compatible with no effect.
			</p>
		</details>
		<CopyButton text={copyAllText} title="Copy all results as formatted table" size="md" />
	</div>
{:else}
	<div class="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm text-gray-400">
		Results will appear here.
	</div>
{/if}
