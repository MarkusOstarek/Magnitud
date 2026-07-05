<script lang="ts">
	import katex from 'katex';

	interface Formula {
		title: string;
		latex: string;
		source: string;
	}

	interface Props {
		formulas: Formula[];
		title?: string;
	}

	let { formulas, title = 'Formulas' }: Props = $props();

	let open = $state(false);

	function render(latex: string): string {
		return katex.renderToString(latex, {
			displayMode: true,
			throwOnError: false,
			trust: false
		});
	}
</script>

<div class="border border-gray-200 rounded-xl overflow-hidden">
	<button
		onclick={() => { open = !open; }}
		class="w-full flex items-center justify-between px-5 py-3.5 text-left bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
		aria-expanded={open}
	>
		<span class="text-sm font-semibold text-gray-700">{title}</span>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 20 20"
			fill="currentColor"
			class="w-4 h-4 text-gray-400 transition-transform duration-200 {open ? 'rotate-180' : ''}"
			aria-hidden="true"
		>
			<path
				fill-rule="evenodd"
				d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
				clip-rule="evenodd"
			/>
		</svg>
	</button>

	{#if open}
		<div class="divide-y divide-gray-100 px-5">
			{#each formulas as formula}
				<div class="py-4">
					<h4 class="text-sm font-semibold text-gray-800 mb-2">{formula.title}</h4>
					<div
						class="overflow-x-auto py-2 text-center text-gray-800"
						aria-label="{formula.title} formula"
					>
						{@html render(formula.latex)}
					</div>
					<p class="mt-2 text-xs text-gray-400 italic">{formula.source}</p>
				</div>
			{/each}
		</div>
	{/if}
</div>
