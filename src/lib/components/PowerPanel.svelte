<script lang="ts">
	import type { Family1Results } from '$lib/types/effects.js';

	interface Props {
		results: Family1Results | null;
	}

	let { results }: Props = $props();

	let openN   = $state(false);
	let openMDE = $state(false);

	let powerN   = $state<80 | 90 | 95>(80);
	let powerMDE = $state<80 | 90 | 95>(80);

	// Two-tailed α = 0.05 throughout
	const Z_ALPHA = 1.9600;
	const Z_BETA: Record<number, number> = { 80: 0.8416, 90: 1.2816, 95: 1.6449 };

	function fmt(n: number, decimals = 2): string { return n.toFixed(decimals); }

	// n required to detect effect d at the given power (equal groups / single sample)
	function nRequired(absD: number, power: number, design: string): number | null {
		if (absD < 0.001) return null;
		const z = Z_ALPHA + Z_BETA[power];
		if (design === 'independent') return Math.ceil(2 * z ** 2 / absD ** 2);
		return Math.ceil(z ** 2 / absD ** 2);
	}

	// Minimum detectable effect given actual sample sizes
	function calcMDE(r: Family1Results, power: number): number {
		const z = Z_ALPHA + Z_BETA[power];
		if (r.designType === 'independent') return z * Math.sqrt(1 / r.n1 + 1 / r.n2);
		return z / Math.sqrt(r.n1); // paired: n1 = n pairs; one-sample: n1 = n
	}

	// The CI bound closest to zero — used for the conservative n estimate
	function conservativeAbsD(r: Family1Results): number | null {
		const [lo, hi] = r.dCI;
		const bound = r.d >= 0 ? lo : hi;
		if (r.d >= 0 && bound <= 0) return null; // CI crosses zero
		if (r.d < 0  && bound >= 0) return null;
		return Math.abs(bound);
	}

	// Derived
	let absD        = $derived(Math.abs(results?.d ?? 0));
	let consD       = $derived(results ? conservativeAbsD(results) : null);
	let nPoint      = $derived(results ? nRequired(absD, powerN, results.designType) : null);
	let nConserv    = $derived(results && consD !== null ? nRequired(consD, powerN, results.designType) : null);
	let mde         = $derived(results ? calcMDE(results, powerMDE) : null);
	let ciCrossesZero = $derived(results ? consD === null : false);

	let nLabel = $derived(
		results?.designType === 'independent' ? 'per group' :
		results?.designType === 'paired'      ? 'pairs'     : 'participants'
	);

	// Describe actual sample for MDE panel
	let sampleDesc = $derived(() => {
		if (!results) return '';
		if (results.designType === 'independent') return `n\u2081\u202f=\u202f${results.n1}, n\u2082\u202f=\u202f${results.n2}`;
		return `n\u202f=\u202f${results.n1}`;
	});

	const POWERS = [80, 90, 95] as const;

	function fmtN(n: number | null): string {
		if (n === null) return '\u2014';
		if (n > 9999) return '>9\u202f999';
		return n.toLocaleString();
	}
</script>

{#if results}
	<div class="mt-3 space-y-2">

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

					<!-- Power selector -->
					<div class="flex items-center gap-2">
						<span class="text-xs text-gray-500">Target power:</span>
						<div class="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
							{#each POWERS as p}
								<button
									type="button"
									onclick={() => { powerN = p; }}
									class="rounded px-2.5 py-1 text-xs font-medium transition-all focus:outline-none
										{powerN === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
								>{p}%</button>
							{/each}
						</div>
					</div>

					<!-- Results rows -->
					<div class="space-y-2">
						<div class="flex items-baseline justify-between gap-4">
							<span class="text-sm text-gray-600">
								Point estimate
								<span class="text-gray-400">(d&nbsp;=&nbsp;{fmt(absD)})</span>
							</span>
							<span class="tabular-nums font-semibold text-gray-900 shrink-0">
								{#if nPoint !== null}
									n&nbsp;=&nbsp;{fmtN(nPoint)} {nLabel}
								{:else}
									<span class="text-gray-400 font-normal">d&nbsp;=&nbsp;0, undefined</span>
								{/if}
							</span>
						</div>

						<div class="flex items-baseline justify-between gap-4">
							<span class="text-sm text-gray-600">
								Conservative
								{#if ciCrossesZero}
									<span class="text-gray-400">(CI includes zero)</span>
								{:else}
									<span class="text-gray-400">(lower 95% CI: d&nbsp;=&nbsp;{fmt(consD ?? 0)})</span>
								{/if}
							</span>
							<span class="tabular-nums font-semibold text-gray-900 shrink-0">
								{#if ciCrossesZero}
									<span class="text-gray-400 font-normal">not estimable</span>
								{:else if nConserv !== null}
									n&nbsp;=&nbsp;{fmtN(nConserv)} {nLabel}
								{:else}
									<span class="text-gray-400 font-normal">&mdash;</span>
								{/if}
							</span>
						</div>
					</div>

					<p class="text-xs text-gray-400 leading-relaxed">
						The conservative estimate uses the lower bound of the 95% CI, accounting for sampling
						uncertainty in the observed effect size. A large gap between the two estimates signals a
						noisy original study. Assumes equal groups, &alpha;&nbsp;=&nbsp;0.05, two-tailed.
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

					<!-- Power selector -->
					<div class="flex items-center gap-2">
						<span class="text-xs text-gray-500">Target power:</span>
						<div class="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
							{#each POWERS as p}
								<button
									type="button"
									onclick={() => { powerMDE = p; }}
									class="rounded px-2.5 py-1 text-xs font-medium transition-all focus:outline-none
										{powerMDE === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
								>{p}%</button>
							{/each}
						</div>
					</div>

					{#if mde !== null}
						<p class="text-sm text-gray-700 leading-relaxed">
							With {sampleDesc()}, this study had {powerMDE}% power to detect effects of
							<strong class="tabular-nums">|d|&nbsp;&ge;&nbsp;{fmt(mde)}</strong>.
						</p>

						<!-- Observed vs detectable -->
						{#if absD > 0}
							{#if absD >= mde}
								<div class="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-xs text-green-800">
									The observed effect (|d|&nbsp;=&nbsp;{fmt(absD)}) exceeds the detectable threshold.
								</div>
							{:else}
								<div class="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-800">
									The observed effect (|d|&nbsp;=&nbsp;{fmt(absD)}) falls below the detectable threshold.
								</div>
							{/if}
						{/if}
					{/if}

					<p class="text-xs text-gray-400 leading-relaxed">
						Assumes &alpha;&nbsp;=&nbsp;0.05, two-tailed. Uses the actual sample sizes from this study.
						The minimum detectable effect does not depend on the observed effect size.
					</p>
				</div>
			{/if}
		</div>

	</div>
{/if}
