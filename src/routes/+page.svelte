<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { base } from '$app/paths';
	import DistributionPlot from '$lib/components/DistributionPlot.svelte';
	let demoD = $state(0.5);

	const families = [
		{
			href: `${base}/cohens-d`,
			color: 'border-blue-400',
			bg: 'bg-blue-50',
			accent: 'text-blue-700',
			title: 'Mean differences',
			metrics: ["Cohen's d", "Hedges' g", "Glass's Δ", 'r (point-biserial)', 'CLES'],
			description: "Two independent groups. Did the intervention work? How big was the difference?"
		},
		{
			href: `${base}/correlation`,
			color: 'border-violet-400',
			bg: 'bg-violet-50',
			accent: 'text-violet-700',
			title: 'Correlations',
			metrics: ["Pearson's r", "Fisher's z", 'R²'],
			description: "How strongly are two continuous variables related? For correlational designs and simple regression."
		},
		{
			href: `${base}/variance-explained`,
			color: 'border-emerald-400',
			bg: 'bg-emerald-50',
			accent: 'text-emerald-700',
			title: 'ANOVA / Regression',
			metrics: ['Eta-squared', 'Partial η²', 'Omega-squared', "Cohen's f"],
			description: "ANOVA and regression. What proportion of the outcome is explained by the predictor?"
		},
		{
			href: `${base}/binary-outcomes`,
			color: 'border-orange-400',
			bg: 'bg-orange-50',
			accent: 'text-orange-700',
			title: 'Risk & Odds',
			metrics: ['Odds ratio', 'Risk ratio', 'Risk difference', 'NNT', 'Phi'],
			description: "OR, RR, RD, NNT, phi. Two-group comparisons with a binary event from a 2×2 table or two proportions."
		},
		{
			href: `${base}/regression-coefficients`,
			color: 'border-teal-400',
			bg: 'bg-teal-50',
			accent: 'text-teal-700',
			title: 'Coefficient Interpreter',
			metrics: ['Raw / log / standardized', 'Dummy coding', 'Effects coding', 'Helmert', 'Successive diff.'],
			description: "How to interpret a regression coefficient for any scale combination or categorical coding scheme."
		}
	];

	const helpChoose = [
		{ label: 'Comparing two groups',           href: `${base}/cohens-d`,              desc: 'e.g. treatment vs control, Group A vs Group B' },
		{ label: 'Same people, two conditions',    href: `${base}/cohens-d?design=paired`, desc: 'e.g. before vs after, Condition A vs B, with vs without' },
		{ label: 'A relationship between variables', href: `${base}/correlation`,           desc: 'e.g. correlation between age and income' },
		{ label: 'Multiple groups or predictors',  href: `${base}/variance-explained`,     desc: 'e.g. ANOVA with 3+ groups, regression with multiple variables' },
		{ label: 'A binary event rate',            href: `${base}/binary-outcomes`,        desc: 'e.g. recovery rate, mortality, conversion rate' },
		{ label: 'One sample vs a known value',    href: `${base}/cohens-d?design=one-sample`, desc: 'e.g. comparing a sample mean to a norm, chance level, or theoretical value' },
		{ label: 'A regression coefficient',       href: `${base}/regression-coefficients`, desc: 'e.g. β, log-odds, or b from a linear, logistic, or other regression model' },
	];
</script>

<Seo
	title="Magnitood: Effect size calculator and interpreter"
	description="Calculate, convert, and interpret statistical effect sizes. Cohen's d, Hedges' g, odds ratio, eta-squared, and more. Free online tool with visualisations and plain-language explanations."
/>

<svelte:head>

	<script type="application/ld+json">
		{JSON.stringify({
			"@context": "https://schema.org",
			"@type": "WebApplication",
			"name": "Magnitood",
			"description": "Effect size calculator and interpreter for researchers and students",
			"url": "https://markusostarek.github.io/Magnitud/",
			"applicationCategory": "EducationalApplication",
			"author": {
				"@type": "Person",
				"name": "Markus Ostarek"
			},
			"offers": { "@type": "Offer", "price": "0" }
		})}
	</script>
</svelte:head>

<!-- Hero -->
<section class="mx-auto max-w-6xl px-4 pt-16 pb-8 text-center">
	<h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
		Understand your statistical results
	</h1>
	<p class="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
		Calculate, convert, and interpret effect sizes with visualisations and <span class="whitespace-nowrap">plain-language</span> explanations.
		Free, instant, <span class="whitespace-nowrap">client-side</span>. Your data never leaves your browser.
	</p>
</section>

<!-- Live demo -->
<section class="mx-auto max-w-3xl px-4 pb-12" aria-label="Interactive demo">
	<div class="card p-5">
		<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
			<h2 class="text-sm font-semibold text-gray-700">Interactive preview: drag the slider</h2>
			<div class="flex items-center gap-3 text-sm">
				<span class="text-gray-500">Cohen's d =</span>
				<span class="font-bold tabular-nums text-gray-900 w-10">{demoD.toFixed(2)}</span>
			</div>
		</div>
		<DistributionPlot d={demoD} height={220} />
		<input
			type="range"
			min="-2"
			max="2"
			step="0.05"
			bind:value={demoD}
			class="w-full mt-3 accent-accent"
			aria-label="Cohen's d value for demo"
		/>
		<div class="flex justify-between text-xs text-gray-400 mt-1">
			<span>d = −2 (large negative)</span>
			<span>d = 0</span>
			<span>d = +2 (large positive)</span>
		</div>
	</div>
</section>

<!-- Help me choose -->
<section class="mx-auto max-w-6xl px-4 pb-12">
	<h2 class="section-title mb-1">What does your data look like?</h2>
	<p class="text-sm text-gray-500 mb-5">Pick the option that fits your design and we'll take you to the right calculator.</p>
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
		{#each helpChoose as item}
			<a href={item.href} class="card px-4 py-3.5 hover:border-accent hover:shadow-md transition-all group block">
				<div class="font-semibold text-gray-900 group-hover:text-accent transition-colors text-sm">{item.label}</div>
				<div class="text-xs text-gray-400 mt-1 leading-relaxed">{item.desc}</div>
			</a>
		{/each}
	</div>
</section>

<!-- Decision guide -->
<section class="mx-auto max-w-6xl px-4 pb-12">
	<details class="group rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
		<summary class="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors list-none select-none">
			Not sure which effect size to use? Start here.
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" aria-hidden="true"><path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg>
		</summary>
		<div class="border-t border-gray-100 px-5 py-4 grid sm:grid-cols-2 gap-6 text-sm">
			<div>
				<h3 class="font-semibold text-gray-800 mb-2">Continuous outcome (means, scores, times)</h3>
				<ul class="space-y-1.5 text-gray-600">
					<li><a href="{base}/cohens-d" class="text-accent hover:underline">Two independent groups</a> — Cohen’s d, Hedges’ g</li>
					<li><a href="{base}/cohens-d?design=paired" class="text-accent hover:underline">Same participants, two conditions</a> — paired d_z</li>
					<li><a href="{base}/cohens-d?design=one-sample" class="text-accent hover:underline">One sample vs a reference value</a> — d₁</li>
					<li><a href="{base}/correlation" class="text-accent hover:underline">A relationship between two variables</a> — Pearson’s r</li>
					<li><a href="{base}/variance-explained" class="text-accent hover:underline">3+ groups or multiple predictors</a> — η², ω², Cohen’s f</li>
				</ul>
			</div>
			<div class="space-y-4">
				<div>
					<h3 class="font-semibold text-gray-800 mb-2">Binary outcome (yes/no, event/no event)</h3>
					<ul class="space-y-1.5 text-gray-600">
						<li><a href="{base}/binary-outcomes" class="text-accent hover:underline">Two groups, did the event occur more often?</a> — OR, RR, NNT</li>
					</ul>
				</div>
				<div>
					<h3 class="font-semibold text-gray-800 mb-2">You have a model output to interpret</h3>
					<ul class="space-y-1.5 text-gray-600">
						<li><a href="{base}/regression-coefficients" class="text-accent hover:underline">A regression coefficient</a> — b, β, log-odds from any model</li>
					</ul>
				</div>
				<div>
					<h3 class="font-semibold text-gray-800 mb-2">Explore visually</h3>
					<ul class="space-y-1.5 text-gray-600">
						<li><a href="{base}/visualize" class="text-accent hover:underline">Effect Size Visualizer</a> — drag sliders to see distributions change</li>
					</ul>
				</div>
			</div>
		</div>
	</details>
</section>

<!-- Family cards -->
<section class="mx-auto max-w-6xl px-4 pb-16">
	<h2 class="section-title mb-5">Effect size families</h2>
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		{#each families as fam}
			<a
				href={fam.href}
				class="card border-l-4 {fam.color} p-5 hover:shadow-md transition-all group block"
			>
				<div class="font-bold text-gray-900 group-hover:text-accent transition-colors text-base mb-1">{fam.title}</div>
				<p class="text-sm text-gray-500 mb-3">{fam.description}</p>
				<div class="flex flex-wrap gap-1.5">
					{#each fam.metrics as m}
						<span class="inline-block rounded-full {fam.bg} {fam.accent} px-2.5 py-0.5 text-xs font-medium">{m}</span>
					{/each}
				</div>
			</a>
		{/each}
	</div>
</section>

<!-- SEO body text -->
<section class="mx-auto max-w-3xl px-4 pb-16 text-sm text-gray-500 leading-relaxed space-y-3">
	<h2 class="text-base font-semibold text-gray-700">What is an effect size?</h2>
	<p>
		An effect size is a standardised measure of the practical significance of a result. It tells you
		<em>how big</em> an effect is, not just whether it is statistically significant. Unlike p-values, effect sizes
		are comparable across studies, making them essential for meta-analysis and cumulative science.
	</p>
	<p>
		Magnitood helps you compute and interpret effect sizes for the most common statistical analyses:
		<span class="whitespace-nowrap">t-tests</span> (Cohen's d, Hedges' g), correlations (Pearson's r, Fisher's z), ANOVA and regression
		(<span class="whitespace-nowrap">eta-squared</span>, <span class="whitespace-nowrap">omega-squared</span>, Cohen's f), and <span class="whitespace-nowrap">A/B</span> test or clinical trial binary outcomes
		(odds ratio, NNT, risk difference).
	</p>
	<p>
		All calculations happen instantly in your browser. Results include 95% confidence intervals,
		standard errors for <span class="whitespace-nowrap">meta-analysis</span>, <span class="whitespace-nowrap">plain-language</span> interpretations, and interactive distribution plots.
		Every calculation generates a shareable URL. Bookmark it or send it to a colleague.
	</p>
</section>
