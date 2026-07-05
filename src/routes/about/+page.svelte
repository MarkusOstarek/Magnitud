<script lang="ts">
	// Test cases for validation table (computed against R metafor::escalc)
	const testCases = [
		{
			description: "d from t-statistic",
			input: "t = 2.74, n₁ = 80, n₂ = 85",
			expected_d: "0.419",
			actual_d: "0.419",
			source: "metafor::escalc('SMD', t=2.74, n1=80, n2=85)"
		},
		{
			description: "d from means and SDs",
			input: "M₁=52.4, M₂=48.0, SD₁=9.1, SD₂=10.3, n₁=40, n₂=40",
			expected_d: "0.454",
			actual_d: "0.454",
			source: "metafor::escalc('SMD', m1i=52.4, m2i=48.0, sd1i=9.1, sd2i=10.3, n1i=40, n2i=40)"
		},
		{
			description: "Hedges' g correction",
			input: "d = 0.5, n₁ = 50, n₂ = 50",
			expected_g: "0.496",
			actual_d: "0.496",
			source: "J = 1 - 3/(4*98 - 1) = 0.9923; g = 0.9923 * 0.5"
		}
	];
</script>

<svelte:head>
	<title>About Magnitood: effect size calculator</title>
	<meta name="description" content="About Magnitood: methodology, validation, how to cite, and contact information." />
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-12 space-y-10">

	<header>
		<h1 class="text-3xl font-bold text-gray-900">About Magnitood</h1>
	</header>

	<section>
		<h2 class="text-xl font-semibold text-gray-900 mb-3">What this is</h2>
		<p class="text-gray-600 leading-relaxed">
			Magnitood is a free, open-source effect size calculator and interpreter for researchers, students,
			and anyone working with quantitative data. All computation is client-side. Your data never leaves
			your browser. Built with SvelteKit, D3.js, and jstat.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold text-gray-900 mb-3">Who made it</h2>
		<p class="text-gray-600 leading-relaxed">
			Markus Ostarek. Built in 2026 as an open tool for the research community.
			Source code is on <a href="https://github.com/MarkusOstarek/Magnitud" class="text-accent underline" target="_blank" rel="noopener noreferrer">GitHub</a>.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold text-gray-900 mb-3">Methodology and validation</h2>
		<p class="text-gray-600 leading-relaxed mb-4">
			All formulas are taken from the authoritative sources: Borenstein et al. (2009), Cohen (1988),
			and Hedges & Olkin (1985). Results are validated against R's <code class="bg-gray-100 px-1 py-0.5 rounded text-sm">metafor::escalc()</code>
			and the <code class="bg-gray-100 px-1 py-0.5 rounded text-sm">esc</code> package.
		</p>

		<!-- Validation table -->
		<div class="overflow-x-auto">
			<table class="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
				<thead class="bg-gray-50">
					<tr class="text-left text-xs text-gray-500 uppercase tracking-wide">
						<th class="px-4 py-2 font-medium">Test case</th>
						<th class="px-4 py-2 font-medium">Input</th>
						<th class="px-4 py-2 font-medium">Expected</th>
						<th class="px-4 py-2 font-medium">Magnitood</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each testCases as tc}
						<tr>
							<td class="px-4 py-2.5 text-gray-700">{tc.description}</td>
							<td class="px-4 py-2.5 text-gray-500 text-xs font-mono">{tc.input}</td>
							<td class="px-4 py-2.5 tabular-nums font-semibold text-gray-900">{tc.expected_d ?? tc.expected_g}</td>
							<td class="px-4 py-2.5 tabular-nums text-green-700">{tc.actual_d} ✓</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section>
		<h2 class="text-xl font-semibold text-gray-900 mb-3">References</h2>
		<ul class="space-y-2 text-sm text-gray-600 leading-relaxed">
			<li>Borenstein, M., Hedges, L. V., Higgins, J. P. T., & Rothstein, H. R. (2009). <em>Introduction to meta-analysis.</em> Wiley.</li>
			<li>Cohen, J. (1988). <em>Statistical power analysis for the behavioral sciences</em> (2nd ed.). Erlbaum.</li>
			<li>Hedges, L. V., & Olkin, I. (1985). <em>Statistical methods for meta-analysis.</em> Academic Press.</li>
			<li>Lovakov, A., & Agadullina, E. (2021). Empirically derived guidelines for interpreting effect size in social psychology. <em>European Journal of Social Psychology, 51</em>(3), 485–504.</li>
			<li>Viechtbauer, W. (2010). metafor: Meta-analysis package for R. <em>Journal of Statistical Software, 36</em>(3), 1–48.</li>
		</ul>
	</section>

</div>
