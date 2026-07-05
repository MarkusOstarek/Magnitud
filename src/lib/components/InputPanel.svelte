<script lang="ts">
	import type { Family1InputType, EffectDirection, Family1Inputs, DesignType } from '$lib/types/effects.js';
	import EditableLabel from './EditableLabel.svelte';

	interface Props {
		inputs: Family1Inputs;
		errors?: Record<string, string>;
		onchange?: (inputs: Family1Inputs) => void;
		label1?: string;
		label2?: string;
		onlabel1change?: (v: string) => void;
		onlabel2change?: (v: string) => void;
	}

	let { inputs = $bindable(), errors = {}, onchange, label1 = 'Group 1', label2 = 'Group 2', onlabel1change, onlabel2change }: Props = $props();

	// Input options differ between design types
	const independentOptions: { value: Family1InputType; label: string; description: string }[] = [
		{ value: 't', label: 't-statistic', description: 'I have a t-statistic from an independent-samples t-test' },
		{ value: 'means', label: 'Means and SDs', description: 'I have group means and standard deviations' },
		{ value: 'd', label: "Cohen's d", description: "I already have Cohen's d" },
		{ value: 'g', label: "Hedges' g", description: "I already have Hedges' g" },
		{ value: 'f', label: 'F-statistic (df₁ = 1)', description: 'I have an F-statistic with one numerator df' },
		{ value: 'p', label: 'p-value', description: 'I only have a p-value (less precise)' }
	];

	const pairedOptions: { value: Family1InputType; label: string; description: string }[] = [
		{ value: 't', label: 't-statistic', description: 'I have a t-statistic from a paired-samples / repeated-measures t-test' },
		{ value: 'means', label: 'Mean difference and SD', description: 'I have the mean difference (M₁ − M₂) and its standard deviation' },
		{ value: 'd', label: 'd_z (direct)', description: 'I already have d_z, the within-person effect size' },
		{ value: 'p', label: 'p-value', description: 'I only have a p-value from a paired t-test' }
	];

	const oneSampleOptions: { value: Family1InputType; label: string; description: string }[] = [
		{ value: 't', label: 't-statistic', description: 'I have a t-statistic from a one-sample t-test' },
		{ value: 'means', label: 'Mean and SD', description: 'I have the sample mean, SD, and a reference value to compare against' },
		{ value: 'd', label: "Cohen's d", description: "I already have Cohen's d for a one-sample comparison" },
		{ value: 'g', label: "Hedges' g", description: "I already have Hedges' g for a one-sample comparison" },
		{ value: 'p', label: 'p-value', description: 'I only have a p-value from a one-sample t-test (less precise)' }
	];

	let inputOptions = $derived(
		inputs.designType === 'paired' ? pairedOptions :
		inputs.designType === 'one-sample' ? oneSampleOptions :
		independentOptions
	);

	// When switching design, reset inputType if the current option is not available
	$effect(() => {
		if (!inputOptions.find(o => o.value === inputs.inputType)) {
			inputs.inputType = 't';
		}
	});

	function err(field: string): string {
		return errors[field] ?? '';
	}

	function setDesign(d: string) {
		inputs.designType = d as DesignType;
	}

	const designDescriptions: Record<string, string> = {
		independent: 'Two separate groups of different people (e.g. treatment vs. control, or men vs. women).',
		paired: 'The same people measured twice, or two matched groups (e.g. before/after, or two counterbalanced conditions).',
		'one-sample': 'Your sample compared to a known reference value or population norm (e.g. comparing your group\'s IQ to 100).'
	};
</script>

<div class="space-y-5">

	<!-- Design type selector -->
	<fieldset>
		<legend class="input-label mb-2">Design</legend>
		<div class="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 gap-0.5" role="radiogroup">
			{#each ([['independent', 'Independent samples'], ['paired', 'Paired / repeated'], ['one-sample', 'One sample']] as [string, string][]) as [val, lbl]}
				<button
					type="button"
					role="radio"
					aria-checked={inputs.designType === val}
					onclick={() => setDesign(val)}
					class="rounded-md px-3 py-1.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1
						{inputs.designType === val
							? 'bg-white text-gray-900 shadow-sm'
							: 'text-gray-500 hover:text-gray-700'}"
				>
					{lbl}
				</button>
			{/each}
		</div>
		<p class="mt-1.5 text-xs text-gray-400">{designDescriptions[inputs.designType]}</p>
	</fieldset>

	<!-- Input type selector -->
	<div>
		<label for="input-type" class="input-label">What do you have?</label>
		<select
			id="input-type"
			bind:value={inputs.inputType}
			class="input-field"
			aria-describedby="input-type-desc"
		>
			{#each inputOptions as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
		<p id="input-type-desc" class="mt-1 text-xs text-gray-400">
			{inputOptions.find(o => o.value === inputs.inputType)?.description ?? ''}
		</p>
		{#if inputs.inputType !== 't' && inputs.inputType !== 'means'}
			<p class="mt-1 text-xs text-gray-400">Not sure? Most researchers start with <strong class="text-gray-500">t-statistic</strong> (from SPSS/R output) or <strong class="text-gray-500">Means and SDs</strong>.</p>
		{/if}
		{#if inputs.inputType === 'p'}
			<p class="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
				A p-value alone doesn't uniquely determine an effect size — sample size is also needed. The result will be less precise than entering a t-statistic or means directly.
			</p>
		{/if}
	</div>

	<!-- Dynamic fields -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">

		<!-- ── Independent-only inputs ── -->

		{#if inputs.designType === 'independent'}

			{#if inputs.inputType === 'd'}
				<div class="sm:col-span-2">
					<label for="inp-d" class="input-label">Cohen's d</label>
					<input id="inp-d" type="text" inputmode="decimal" bind:value={inputs.dStr}
						placeholder="e.g. 0.43" class="input-field {err('d') ? 'border-red-400' : ''}" />
					{#if err('d')}<p class="mt-1 text-xs text-red-500">{err('d')}</p>{/if}
				</div>
			{/if}

			{#if inputs.inputType === 'g'}
				<div class="sm:col-span-2">
					<label for="inp-g" class="input-label">Hedges' g</label>
					<input id="inp-g" type="text" inputmode="decimal" bind:value={inputs.gStr}
						placeholder="e.g. 0.42" class="input-field {err('g') ? 'border-red-400' : ''}" />
					{#if err('g')}<p class="mt-1 text-xs text-red-500">{err('g')}</p>{/if}
				</div>
			{/if}

			{#if inputs.inputType === 'f'}
				<div class="sm:col-span-2">
					<label for="inp-f" class="input-label">F-statistic <span class="font-normal text-gray-400">(df₁ must = 1)</span></label>
					<input id="inp-f" type="text" inputmode="decimal" bind:value={inputs.fStr}
						placeholder="e.g. 7.51" class="input-field {err('f') ? 'border-red-400' : ''}" />
					{#if err('f')}<p class="mt-1 text-xs text-red-500">{err('f')}</p>{/if}
				</div>
			{/if}

			{#if inputs.inputType === 'means'}
				<div>
					<label for="inp-m1" class="input-label">Mean (<EditableLabel value={label1} oncommit={onlabel1change} />)</label>
					<input id="inp-m1" type="text" inputmode="decimal" bind:value={inputs.m1Str}
						placeholder="e.g. 52.4" class="input-field {err('m1') ? 'border-red-400' : ''}" />
					{#if err('m1')}<p class="mt-1 text-xs text-red-500">{err('m1')}</p>{/if}
				</div>
				<div>
					<label for="inp-sd1" class="input-label">SD (<EditableLabel value={label1} oncommit={onlabel1change} />)</label>
					<input id="inp-sd1" type="text" inputmode="decimal" bind:value={inputs.sd1Str}
						placeholder="e.g. 9.1" class="input-field {err('sd1') ? 'border-red-400' : ''}" />
					{#if err('sd1')}<p class="mt-1 text-xs text-red-500">{err('sd1')}</p>{/if}
				</div>
				<div>
					<label for="inp-m2" class="input-label">Mean (<EditableLabel value={label2} oncommit={onlabel2change} />)</label>
					<input id="inp-m2" type="text" inputmode="decimal" bind:value={inputs.m2Str}
						placeholder="e.g. 48.0" class="input-field {err('m2') ? 'border-red-400' : ''}" />
					{#if err('m2')}<p class="mt-1 text-xs text-red-500">{err('m2')}</p>{/if}
				</div>
				<div>
					<label for="inp-sd2" class="input-label">SD (<EditableLabel value={label2} oncommit={onlabel2change} />)</label>
					<input id="inp-sd2" type="text" inputmode="decimal" bind:value={inputs.sd2Str}
						placeholder="e.g. 10.3" class="input-field {err('sd2') ? 'border-red-400' : ''}" />
					{#if err('sd2')}<p class="mt-1 text-xs text-red-500">{err('sd2')}</p>{/if}
				</div>
			{/if}

		{/if}

		<!-- ── Paired-only inputs ── -->

		{#if inputs.designType === 'paired'}

			{#if inputs.inputType === 'd'}
				<div class="sm:col-span-2">
					<label for="inp-dz" class="input-label">
						d_z <span class="font-normal text-gray-400">(within-person effect size)</span>
					</label>
					<input id="inp-dz" type="text" inputmode="decimal" bind:value={inputs.dStr}
						placeholder="e.g. 0.61" class="input-field {err('d') ? 'border-red-400' : ''}" />
					{#if err('d')}<p class="mt-1 text-xs text-red-500">{err('d')}</p>{/if}
				</div>
			{/if}

			{#if inputs.inputType === 'means'}
				<div>
					<label for="inp-mdiff" class="input-label">
						Mean difference <span class="font-normal text-gray-400">(M₁ − M₂)</span>
					</label>
					<input id="inp-mdiff" type="text" inputmode="decimal" bind:value={inputs.mDiffStr}
						placeholder="e.g. 4.4" class="input-field {err('mDiff') ? 'border-red-400' : ''}" />
					{#if err('mDiff')}<p class="mt-1 text-xs text-red-500">{err('mDiff')}</p>{/if}
				</div>
				<div>
					<label for="inp-sddiff" class="input-label">
						SD of differences
					</label>
					<input id="inp-sddiff" type="text" inputmode="decimal" bind:value={inputs.sdDiffStr}
						placeholder="e.g. 7.2" class="input-field {err('sdDiff') ? 'border-red-400' : ''}" />
					{#if err('sdDiff')}<p class="mt-1 text-xs text-red-500">{err('sdDiff')}</p>{/if}
				</div>
			{/if}

		{/if}

		<!-- ── One-sample-only inputs ── -->

		{#if inputs.designType === 'one-sample'}

			{#if inputs.inputType === 'means'}
				<div>
					<label for="inp-m-os" class="input-label">Sample mean (<EditableLabel value={label1} oncommit={onlabel1change} />)</label>
					<input id="inp-m-os" type="text" inputmode="decimal" bind:value={inputs.m1Str}
						placeholder="e.g. 52.4" class="input-field {err('m1') ? 'border-red-400' : ''}" />
					{#if err('m1')}<p class="mt-1 text-xs text-red-500">{err('m1')}</p>{/if}
				</div>
				<div>
					<label for="inp-mu0" class="input-label">Reference value μ₀ (<EditableLabel value={label2} oncommit={onlabel2change} />)</label>
					<input id="inp-mu0" type="text" inputmode="decimal" bind:value={inputs.mu0Str}
						placeholder="e.g. 50.0" class="input-field {err('mu0') ? 'border-red-400' : ''}" />
					{#if err('mu0')}<p class="mt-1 text-xs text-red-500">{err('mu0')}</p>{/if}
				</div>
				<div class="sm:col-span-2 sm:max-w-xs">
					<label for="inp-sd-os" class="input-label">SD (<EditableLabel value={label1} oncommit={onlabel1change} />)</label>
					<input id="inp-sd-os" type="text" inputmode="decimal" bind:value={inputs.sd1Str}
						placeholder="e.g. 12.0" class="input-field {err('sd1') ? 'border-red-400' : ''}" />
					{#if err('sd1')}<p class="mt-1 text-xs text-red-500">{err('sd1')}</p>{/if}
				</div>
			{/if}

			{#if inputs.inputType === 'd'}
				<div class="sm:col-span-2">
					<label for="inp-d-os" class="input-label">Cohen's d <span class="font-normal text-gray-400">(one-sample)</span></label>
					<input id="inp-d-os" type="text" inputmode="decimal" bind:value={inputs.dStr}
						placeholder="e.g. 0.35" class="input-field {err('d') ? 'border-red-400' : ''}" />
					{#if err('d')}<p class="mt-1 text-xs text-red-500">{err('d')}</p>{/if}
				</div>
			{/if}

			{#if inputs.inputType === 'g'}
				<div class="sm:col-span-2">
					<label for="inp-g-os" class="input-label">Hedges' g <span class="font-normal text-gray-400">(one-sample)</span></label>
					<input id="inp-g-os" type="text" inputmode="decimal" bind:value={inputs.gStr}
						placeholder="e.g. 0.34" class="input-field {err('g') ? 'border-red-400' : ''}" />
					{#if err('g')}<p class="mt-1 text-xs text-red-500">{err('g')}</p>{/if}
				</div>
			{/if}

		{/if}

		<!-- ── Shared inputs (t-statistic) ── -->

		{#if inputs.inputType === 't'}
			<div class="sm:col-span-2">
				<label for="inp-t" class="input-label">t-statistic</label>
				<input id="inp-t" type="text" inputmode="decimal" bind:value={inputs.tStr}
					placeholder="e.g. 2.74" class="input-field {err('t') ? 'border-red-400' : ''}" />
				{#if err('t')}<p class="mt-1 text-xs text-red-500">{err('t')}</p>{/if}
			</div>
		{/if}

		<!-- ── Shared inputs (p-value) ── -->

		{#if inputs.inputType === 'p'}
			<div>
				<label for="inp-p" class="input-label">
					Two-tailed p-value
				</label>
				<input id="inp-p" type="text" inputmode="decimal" bind:value={inputs.pStr}
					placeholder="e.g. 0.031" class="input-field {err('p') ? 'border-red-400' : ''}" />
				{#if err('p')}<p class="mt-1 text-xs text-red-500">{err('p')}</p>{/if}
			</div>
			<div>
				<div class="input-label" role="group" aria-label="Direction of effect">Direction of effect</div>
				<div class="flex gap-3 mt-2">
					<label class="flex items-center gap-2 cursor-pointer">
						<input type="radio" bind:group={inputs.direction} value={1} class="accent-accent" />
						<span class="text-sm">
							{#if inputs.designType === 'paired'}
								Time 1 > Time 2
							{:else}
								{label1} > {label2}
							{/if}
						</span>
					</label>
					<label class="flex items-center gap-2 cursor-pointer">
						<input type="radio" bind:group={inputs.direction} value={-1} class="accent-accent" />
						<span class="text-sm">
							{#if inputs.designType === 'paired'}
								Time 1 &lt; Time 2
							{:else}
								{label1} &lt; {label2}
							{/if}
						</span>
					</label>
				</div>
			</div>
		{/if}

		<!-- ── Sample sizes ── -->

		{#if inputs.designType === 'independent'}
			<div>
				<label for="inp-n1" class="input-label">n (<EditableLabel value={label1} oncommit={onlabel1change} />)</label>
				<input id="inp-n1" type="text" inputmode="numeric" bind:value={inputs.n1Str}
					placeholder="e.g. 80" class="input-field {err('n1') ? 'border-red-400' : ''}" />
				{#if err('n1')}<p class="mt-1 text-xs text-red-500">{err('n1')}</p>{/if}
			</div>
			<div>
				<label for="inp-n2" class="input-label">n (<EditableLabel value={label2} oncommit={onlabel2change} />)</label>
				<input id="inp-n2" type="text" inputmode="numeric" bind:value={inputs.n2Str}
					placeholder="e.g. 85" class="input-field {err('n2') ? 'border-red-400' : ''}" />
				{#if err('n2')}<p class="mt-1 text-xs text-red-500">{err('n2')}</p>{/if}
			</div>
		{:else if inputs.designType === 'paired'}
			<div class="sm:col-span-2 sm:max-w-xs">
				<label for="inp-npairs" class="input-label">n (number of pairs / participants)</label>
				<input id="inp-npairs" type="text" inputmode="numeric" bind:value={inputs.nPairsStr}
					placeholder="e.g. 40" class="input-field {err('nPairs') ? 'border-red-400' : ''}" />
				{#if err('nPairs')}<p class="mt-1 text-xs text-red-500">{err('nPairs')}</p>{/if}
			</div>
		{:else if inputs.designType === 'one-sample'}
			<div class="sm:col-span-2 sm:max-w-xs">
				<label for="inp-nos" class="input-label">n (sample size)</label>
				<input id="inp-nos" type="text" inputmode="numeric" bind:value={inputs.nPairsStr}
					placeholder="e.g. 45" class="input-field {err('nPairs') ? 'border-red-400' : ''}" />
				{#if err('nPairs')}<p class="mt-1 text-xs text-red-500">{err('nPairs')}</p>{/if}
			</div>
		{/if}

		<!-- ── Paired: optional correlation for d_z → d_s conversion ── -->

		{#if inputs.designType === 'paired'}
			<div class="sm:col-span-2">
				<label for="inp-rpaired" class="input-label">
					r between measurements
					<span class="ml-1 font-normal text-gray-400">(optional, enables d_s conversion)</span>
				</label>
				<input
					id="inp-rpaired"
					type="text"
					inputmode="decimal"
					bind:value={inputs.rPairedStr}
					placeholder="e.g. 0.65   (Pearson r between time 1 and time 2)"
					class="input-field {err('rPaired') ? 'border-red-400' : ''}"
				/>
				{#if err('rPaired')}
					<p class="mt-1 text-xs text-red-500">{err('rPaired')}</p>
				{:else if inputs.rPairedStr.trim()}
					<p class="mt-1 text-xs text-gray-400">
						d_s = d_z × √(2(1 − r)) will be shown in the results.
					</p>
				{:else}
					<p class="mt-1 text-xs text-gray-400">
						If you know the correlation between your two sets of measurements, d_s is directly comparable to Cohen's d from independent samples.
					</p>
				{/if}
			</div>
		{/if}

	</div>
</div>
