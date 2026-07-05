<script lang="ts">
	interface Props {
		p1: number;
		p2: number;
		n1: number;
		n2: number;
	}

	let { p1, p2, n1, n2 }: Props = $props();

	let openN   = $state(false);
	let openMDE = $state(false);

	// Two-tailed α = 0.05 throughout
	const Z_ALPHA = 1.9600;
	const Z_BETA: Record<number, number> = { 80: 0.8416, 90: 1.2816, 95: 1.6449 };

	const POWERS = [80, 90, 95] as const;

	let powerMDE = $state<80 | 90 | 95>(80);

	// Required n per group (Fleiss formula, equal groups, two-sided α = 0.05)
	function nRequired(diff: number, _p1: number, _p2: number, power: number): number | null {
		if (Math.abs(diff) < 0.001) return null;
		const pBar  = (_p1 + _p2) / 2;
		const seH0  = Math.sqrt(2 * pBar * (1 - pBar));
		const seH1  = Math.sqrt(_p1 * (1 - _p1) + _p2 * (1 - _p2));
		const num   = (Z_ALPHA * seH0 + Z_BETA[power] * seH1) ** 2;
		return Math.ceil(num / diff ** 2);
	}

	// Minimum detectable absolute risk difference given the actual sample sizes.
	// Normal approximation with the SE evaluated at the observed event rates.
	function mdeDiff(_p1: number, _p2: number, _n1: number, _n2: number, power: number): number {
		const se = Math.sqrt(_p1 * (1 - _p1) / _n1 + _p2 * (1 - _p2) / _n2);
		return (Z_ALPHA + Z_BETA[power]) * se;
	}

	function fmtN(n: number | null): string {
		if (n === null) return '—';
		if (n > 99999) return '>99 999';
		return n.toLocaleString();
	}

	function fmtPP(x: number): string {
		return (x * 100).toFixed(1);
	}

	let diff     = $derived(Math.abs(p1 - p2));
	let tooSmall = $derived(diff < 0.001);
	let mde      = $derived(mdeDiff(p1, p2, n1, n2, powerMDE));

	// Table rows: [power level, n per group, total N]
	let nRows = $derived(
		POWERS.map((lvl) => {
			const n = nRequired(diff, p1, p2, lvl);
			return {
				lvl,
				nPer:  fmtN(n),
				total: n !== null ? fmtN(n * 2) : '—'
			};
		})
	);
</script>

<div class="mt-3 space-y-2">

	<!-- Sub-panel 1: Required sample size -->
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
				{#if tooSmall}
					<p class="text-sm text-gray-500 italic">Effect too small to compute.</p>
				{:else}
					<table class="w-full text-sm">
						<thead>
							<tr class="text-xs text-gray-400 uppercase tracking-wide">
								<th class="text-left font-medium pb-2">Power</th>
								<th class="text-right font-medium pb-2">n per group</th>
								<th class="text-right font-medium pb-2">Total N</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{#each nRows as row}
								<tr>
									<td class="py-1.5 text-gray-700">{row.lvl}%</td>
									<td class="py-1.5 text-right tabular-nums font-semibold text-gray-900">{row.nPer}</td>
									<td class="py-1.5 text-right tabular-nums font-semibold text-gray-900">{row.total}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}

				<p class="text-xs text-gray-400 leading-relaxed">
					Fleiss formula, two-sided &alpha;&nbsp;=&nbsp;0.05, equal group sizes.
					Based on the observed difference |p&#8321;&nbsp;&minus;&nbsp;p&#8322;|&nbsp;=&nbsp;{(diff * 100).toFixed(1)}%.
				</p>
			</div>
		{/if}
	</div>

	<!-- Sub-panel 2: Minimum detectable effect -->
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

				<!-- Power selector -->
				<div class="flex items-center gap-2">
					<span class="text-xs text-gray-500">Target power:</span>
					<div class="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
						{#each POWERS as pw}
							<button
								type="button"
								onclick={() => { powerMDE = pw; }}
								class="rounded px-2.5 py-1 text-xs font-medium transition-all focus:outline-none
									{powerMDE === pw ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
							>{pw}%</button>
						{/each}
					</div>
				</div>

				<p class="text-sm text-gray-700 leading-relaxed">
					With n&#8321;&nbsp;=&nbsp;{n1} and n&#8322;&nbsp;=&nbsp;{n2} at these event rates, this study had
					{powerMDE}% power to detect absolute risk differences of
					<strong class="tabular-nums">&ge;&nbsp;{fmtPP(mde)} percentage points</strong>.
				</p>

				{#if !tooSmall}
					{#if diff >= mde}
						<div class="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-xs text-green-800">
							The observed difference ({fmtPP(diff)} pp) exceeds the detectable threshold.
						</div>
					{:else}
						<div class="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-800">
							The observed difference ({fmtPP(diff)} pp) falls below the detectable threshold — a real effect of this size would often go undetected at this sample size.
						</div>
					{/if}
				{/if}

				<p class="text-xs text-gray-400 leading-relaxed">
					Normal approximation, two-tailed, &alpha;&nbsp;=&nbsp;0.05, with the standard error evaluated
					at the observed event rates. Uses the actual n&#8321; and n&#8322; from this study.
					The minimum detectable effect does not depend on the observed difference itself.
				</p>
			</div>
		{/if}
	</div>

</div>
