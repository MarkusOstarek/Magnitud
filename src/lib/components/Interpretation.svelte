<script lang="ts">
	import CopyButton from './CopyButton.svelte';
	import EditableLabel from './EditableLabel.svelte';
	import type { Family1Results } from '$lib/types/effects.js';

	interface Props {
		results: Family1Results | null;
		label1?: string;
		label2?: string;
		onlabel1change?: (v: string) => void;
		onlabel2change?: (v: string) => void;
	}

	let { results, label1 = 'Group 1', label2 = 'Group 2', onlabel1change, onlabel2change }: Props = $props();

	function fmt(n: number, decimals = 2): string { return n.toFixed(decimals); }
	function fmtPct(n: number): string { return (n * 100).toFixed(1) + '%'; }

	// Build a plain-text copy string (no editable components)
	let copyText = $derived(buildCopyText(results));

	function buildCopyText(r: Family1Results | null): string {
		if (!r) return '';
		const { d, cles, u3, ovl, designType, ds } = r;
		const absD = Math.abs(d);
		const sign = d < 0 ? 'lower' : 'higher';
		const direction = d < 0 ? 'below' : 'above';
		const isPaired = designType === 'paired';
		const isOneSample = designType === 'one-sample';
		const metricLabel = isPaired ? 'd_z' : isOneSample ? 'd₁' : 'd';

		let sizeLabel: string;
		if (absD < 0.1) sizeLabel = 'negligible';
		else if (absD < 0.2) sizeLabel = 'very small';
		else if (absD < 0.5) sizeLabel = 'small';
		else if (absD < 0.8) sizeLabel = 'medium';
		else if (absD < 1.2) sizeLabel = 'large';
		else sizeLabel = 'very large';

		const u3Pct  = (u3  * 100).toFixed(0);
		const ovlPct = (ovl * 100).toFixed(0);
		const clesPct = (cles * 100).toFixed(0);

		if (isOneSample) {
			return [
				`This is a ${sizeLabel} effect (${metricLabel} = ${fmt(d, 2)}).`,
				`The ${label1} mean is ${fmt(absD, 2)} standard deviations ${direction} the ${label2} value.`,
				`Around ${u3Pct}% of the ${label2} population would score below the ${label1} mean.`,
				`The two distributions overlap by roughly ${ovlPct}%.`,
			].join(' ');
		} else if (isPaired) {
			const parts = [
				`This is a ${sizeLabel} effect (${metricLabel} = ${fmt(d, 2)}).`,
				`Participants scored ${sign} in ${label1} compared to ${label2}.`,
			];
			if (ds !== null) {
				parts.push(`Converted to an independent-samples-equivalent scale (d_s = ${fmt(ds, 2)}), ${u3Pct}% of ${label1} scores would exceed the average ${label2} score.`);
			}
			return parts.join(' ');
		} else {
			const parts = [
				`This is a ${sizeLabel} effect (${metricLabel} = ${fmt(d, 2)}).`,
				d === 0
					? 'A randomly selected person from either group is equally likely to score higher.'
					: `If you picked one random person from each group, the ${label1} person would score ${sign} about ${clesPct}% of the time.`,
			];
			if (absD >= 0.05) parts.push(`Around ${u3Pct}% of ${label1} scored ${sign} than the ${label2} average.`);
			parts.push(`The two distributions overlap by roughly ${ovlPct}%.`);
			return parts.join(' ');
		}
	}

	// Derived values for template
	let sizeLabel = $derived(getSizeLabel(results?.d ?? 0));
	let metricLabel = $derived(
		results?.designType === 'paired' ? 'd_z' :
		results?.designType === 'one-sample' ? 'd₁' : 'd'
	);
	let isPaired = $derived(results?.designType === 'paired');
	let isOneSample = $derived(results?.designType === 'one-sample');
	let sign = $derived((results?.d ?? 0) < 0 ? 'lower' : 'higher');
	let direction = $derived((results?.d ?? 0) < 0 ? 'below' : 'above');
	let absD = $derived(Math.abs(results?.d ?? 0));
	let clesPct = $derived(Math.round((results?.cles ?? 0.5) * 100).toString());
	let u3Pct   = $derived(Math.round((results?.u3  ?? 0.5) * 100).toString());
	let ovlPct  = $derived(Math.round((results?.ovl ?? 1)   * 100).toString());

	function getSizeLabel(absD: number): string {
		absD = Math.abs(absD);
		if (absD < 0.1) return 'negligible';
		if (absD < 0.2) return 'very small';
		if (absD < 0.5) return 'small';
		if (absD < 0.8) return 'medium';
		if (absD < 1.2) return 'large';
		return 'very large';
	}
</script>

{#if results}
	<div class="relative rounded-xl border-l-4 border-accent bg-indigo-50/60 px-5 py-4 pr-12">
		<div class="absolute right-3 top-3">
			<CopyButton text={copyText} title="Copy interpretation" size="md" />
		</div>

		<p class="text-[15px] leading-relaxed text-gray-800">
			This is a <strong>{sizeLabel}</strong> effect
			({metricLabel}&nbsp;=&nbsp;{fmt(results.d, 2)}).

			{#if isOneSample}
				The
				<EditableLabel value={label1} oncommit={onlabel1change} class="font-medium" />
				mean is {fmt(absD, 2)} standard deviations {direction} the
				<EditableLabel value={label2} oncommit={onlabel2change} class="font-medium" />
				value.
				{#if absD >= 0.05}
					Around {u3Pct}% of the
					<EditableLabel value={label2} oncommit={onlabel2change} class="font-medium" />
					population would score below the
					<EditableLabel value={label1} oncommit={onlabel1change} class="font-medium" />
					mean.
				{/if}
				The two distributions overlap by roughly {ovlPct}%.
			{:else if isPaired}
				Participants scored {sign} in
				<EditableLabel value={label1} oncommit={onlabel1change} class="font-medium" />
				compared to
				<EditableLabel value={label2} oncommit={onlabel2change} class="font-medium" />.
				{#if results.ds !== null}
					Converted to an independent-samples-equivalent scale (d_s&nbsp;=&nbsp;{fmt(results.ds, 2)}),
					{u3Pct}% of
					<EditableLabel value={label1} oncommit={onlabel1change} class="font-medium" />
					scores would exceed the average
					<EditableLabel value={label2} oncommit={onlabel2change} class="font-medium" />
					score.
				{:else}
					<span class="text-sm text-indigo-700/70">
						(Provide the correlation between measurements to obtain d_s, which is comparable to independent-samples d.)
					</span>
				{/if}
			{:else}
				{#if results.d === 0}
					A randomly selected person from either group is equally likely to score higher.
				{:else}
					If you picked one random person from each group, the
					<EditableLabel value={label1} oncommit={onlabel1change} class="font-medium" />
					person would score {sign} about {clesPct}% of the time.
				{/if}
				{#if Math.abs(results.d) >= 0.05}
					Around {u3Pct}% of
					<EditableLabel value={label1} oncommit={onlabel1change} class="font-medium" />
					scored {sign} than the
					<EditableLabel value={label2} oncommit={onlabel2change} class="font-medium" />
					average.
				{/if}
				The two distributions overlap by roughly {ovlPct}%.
			{/if}
		</p>

		<!-- Secondary stats grid -->
		<div class="mt-3 grid grid-cols-3 gap-3 border-t border-indigo-100 pt-3 text-center">
			<div>
				<div class="text-xs text-gray-500 flex items-center justify-center gap-0.5">
					CLES
					<span title="Common Language Effect Size: the probability that a randomly selected person from Group 1 scores higher than one from Group 2. Also called the probability of superiority."><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3 text-gray-300 hover:text-gray-400 cursor-help shrink-0 transition-colors" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clip-rule="evenodd"/></svg></span>
				</div>
				<div class="font-semibold text-gray-900 tabular-nums">{fmtPct(results.cles)}</div>
				<div class="text-[10px] text-gray-400">{isOneSample ? 'prob. sample exceeds reference' : 'prob. a random person from group 1 scores higher'}</div>
			</div>
			<div>
				<div class="text-xs text-gray-500 flex items-center justify-center gap-0.5">
					Cohen’s U3
					<span title="Cohen’s U3: the percentage of Group 2 scores that the average Group 1 person exceeds. U3 = 50% when d = 0; U3 = 84% when d = 1."><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3 text-gray-300 hover:text-gray-400 cursor-help shrink-0 transition-colors" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clip-rule="evenodd"/></svg></span>
				</div>
				<div class="font-semibold text-gray-900 tabular-nums">{fmtPct(results.u3)}</div>
				<div class="text-[10px] text-gray-400">{isOneSample ? 'of reference pop. below sample mean' : isPaired ? 'exceed condition 2 mean' : 'of group 2 exceeded by group 1 mean'}</div>
			</div>
			<div>
				<div class="text-xs text-gray-500 flex items-center justify-center gap-0.5">
					Overlap (OVL)
					<span title="OVL: the proportion of area shared by both distributions. OVL = 100% when d = 0 (identical groups); OVL = 0% only at infinite d. OVL = 80% when d = 0.5."><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3 text-gray-300 hover:text-gray-400 cursor-help shrink-0 transition-colors" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clip-rule="evenodd"/></svg></span>
				</div>
				<div class="font-semibold text-gray-900 tabular-nums">{fmtPct(results.ovl)}</div>
				<div class="text-[10px] text-gray-400">shared area between the two distributions</div>
			</div>
		</div>

		<!-- Reporting template -->
		{#if results.dCI}
			{@const reportStr = `${metricLabel} = ${fmt(Math.abs(results.d), 2)}, 95% CI [${fmt(results.dCI[0], 2)}, ${fmt(results.dCI[1], 2)}]`}
			<div class="mt-3 flex items-center gap-2 border-t border-indigo-100 pt-3">
				<span class="text-[10px] text-gray-400 shrink-0">Report as:</span>
				<code class="flex-1 rounded bg-indigo-100/60 px-2 py-0.5 text-[11px] text-indigo-800 font-mono truncate">{reportStr}</code>
				<CopyButton text={reportStr} title="Copy reporting string" size="sm" />
			</div>
		{/if}
	</div>
{:else}
	<div class="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-6 text-center text-sm text-gray-400">
		Enter values above to see the interpretation.
	</div>
{/if}
