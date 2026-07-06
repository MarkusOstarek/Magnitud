<script lang="ts">
	import '../app.css';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	let menuOpen = $state(false);

	// Three groups: effect-size calculators | interpreter | utility
	const effectSizeLinks = [
		{ href: `${base}/cohens-d`,           label: "Mean differences",   short: "d"  },
		{ href: `${base}/correlation`,         label: "Correlations",        short: "r"  },
		{ href: `${base}/variance-explained`,  label: "ANOVA / Regression",  short: "η²" },
		{ href: `${base}/binary-outcomes`,     label: "Risk & Odds",     short: "OR" },
	];
	const interpreterLink  = { href: `${base}/regression-coefficients`, label: "Coefficient Interpreter", short: "β" };
	const visualizerLink   = { href: `${base}/visualize`, label: "Visualizer" };
	const aboutLink        = { href: `${base}/about`, label: "About" };

	let currentPath = $derived($page.url.pathname);

	function isActive(href: string): boolean {
		return currentPath === href || currentPath.startsWith(href + '/');
	}

	// Citation modal state
	let citeOpen    = $state(false);
	let copiedFormat = $state<string | null>(null);
	let dialogEl    = $state<HTMLDivElement>();
	let lastFocused: HTMLElement | null = null;

	// While the modal is open: lock body scroll, move focus into the dialog,
	// and restore focus to the trigger on close.
	$effect(() => {
		if (!citeOpen) return;
		lastFocused = document.activeElement as HTMLElement | null;
		document.body.style.overflow = 'hidden';
		queueMicrotask(() => dialogEl?.focus());
		return () => {
			document.body.style.overflow = '';
			lastFocused?.focus();
		};
	});

	function onModalKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			citeOpen = false;
			return;
		}
		// Keep Tab cycling inside the dialog
		if (e.key !== 'Tab' || !dialogEl) return;
		const focusables = dialogEl.querySelectorAll<HTMLElement>(
			'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
		);
		if (focusables.length === 0) return;
		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogEl)) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}

	const domain = 'https://markusostarek.github.io/Magnitud';

	const citations = {
		apa:    `Ostarek, M. (2026). Magnitood: Effect size calculator and interpreter. Retrieved from ${domain}`,
		bibtex: `@misc{ostarek2026magnitood,\n  author = {Ostarek, Markus},\n  title  = {Magnitood: Effect Size Calculator and Interpreter},\n  year   = {2026},\n  url    = {${domain}}\n}`,
		ris:    `TY  - COMP\nAU  - Ostarek, Markus\nTI  - Magnitood: Effect Size Calculator and Interpreter\nPY  - 2026\nUR  - ${domain}\nER  -`
	};

	async function copyCite(format: keyof typeof citations) {
		await navigator.clipboard.writeText(citations[format]);
		copiedFormat = format;
		setTimeout(() => { copiedFormat = null; }, 2000);
	}

	// Allow child pages to open the cite modal via a custom event
	$effect(() => {
		const handler = () => { citeOpen = true; };
		window.addEventListener('magnitood:cite', handler);
		return () => window.removeEventListener('magnitood:cite', handler);
	});
</script>

<div class="min-h-screen flex flex-col">
	<!-- Nav -->
	<header class="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
		<nav class="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5" aria-label="Main navigation">
			<!-- Logo -->
			<a href="{base}/" class="flex items-center gap-2 group shrink-0">
				<span class="text-lg font-bold tracking-tight text-gray-900 group-hover:text-accent transition-colors">
					Magnitood
				</span>
				<span class="hidden text-xs text-gray-400 lg:inline">effect sizes, explained</span>
			</a>

			<!-- Desktop nav — three visual groups -->
			<div class="hidden md:flex items-center gap-2">

				<!-- Group 1: effect-size calculators (indigo pill) -->
				<div class="flex items-center gap-0.5 rounded-xl bg-indigo-50 px-1.5 py-1">
					{#each effectSizeLinks as link}
						<a
							href={link.href}
							class="rounded-lg px-2.5 py-1 text-sm font-medium transition-colors whitespace-nowrap
								{isActive(link.href)
									? 'bg-indigo-200 text-indigo-900'
									: 'text-indigo-600 hover:bg-indigo-100 hover:text-indigo-900'}"
							aria-current={isActive(link.href) ? 'page' : undefined}
						>{link.label}</a>
					{/each}
				</div>

				<!-- Group 2: Visualizer (violet pill) -->
				<div class="rounded-xl bg-violet-50 px-1.5 py-1">
					<a
						href={visualizerLink.href}
						class="rounded-lg px-2.5 py-1 text-sm font-medium transition-colors whitespace-nowrap
							{isActive(visualizerLink.href)
								? 'bg-violet-200 text-violet-900'
								: 'text-violet-600 hover:bg-violet-100 hover:text-violet-900'}"
						aria-current={isActive(visualizerLink.href) ? 'page' : undefined}
						title="Drag sliders to explore what effect sizes look like as overlapping distributions"
					>{visualizerLink.label}</a>
				</div>

				<!-- Group 3: Coefficient Interpreter (teal pill) -->
				<div class="rounded-xl bg-teal-50 px-1.5 py-1">
					<a
						href={interpreterLink.href}
						class="rounded-lg px-2.5 py-1 text-sm font-medium transition-colors whitespace-nowrap
							{isActive(interpreterLink.href)
								? 'bg-teal-200 text-teal-900'
								: 'text-teal-600 hover:bg-teal-100 hover:text-teal-900'}"
						aria-current={isActive(interpreterLink.href) ? 'page' : undefined}
					>{interpreterLink.label}</a>
				</div>

				<!-- Group 4: utility (neutral) -->
				<div class="flex items-center">
					<a
						href={aboutLink.href}
						class="rounded-lg px-3 py-1 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors
							{isActive(aboutLink.href) ? 'bg-gray-100 text-gray-900' : ''}"
						aria-current={isActive(aboutLink.href) ? 'page' : undefined}
					>About</a>
					<button
						onclick={() => { citeOpen = true; }}
						class="rounded-lg px-3 py-1 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
					>Cite</button>
				</div>
			</div>

			<!-- Mobile hamburger -->
			<button
				class="md:hidden rounded-md p-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-accent"
				onclick={() => { menuOpen = !menuOpen; }}
				aria-label="Toggle menu"
				aria-expanded={menuOpen}
			>
				{#if menuOpen}
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
				{:else}
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
				{/if}
			</button>
		</nav>

		<!-- Mobile menu -->
		{#if menuOpen}
			<div class="md:hidden border-t border-gray-100 bg-white px-4 pb-4 pt-2 space-y-3">
				<!-- Effect sizes group -->
				<div>
					<p class="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-indigo-400">Effect sizes</p>
					<div class="space-y-0.5">
						{#each effectSizeLinks as link}
							<a
								href={link.href}
								onclick={() => { menuOpen = false; }}
								class="block rounded-lg px-3 py-2 text-sm font-medium transition-colors
									{isActive(link.href) ? 'bg-indigo-50 text-indigo-900' : 'text-gray-700 hover:bg-gray-100'}"
							>{link.label}</a>
						{/each}
					</div>
				</div>

				<!-- Visualizer group -->
				<div class="border-t border-gray-100 pt-2">
					<p class="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-violet-500">Visualizer</p>
					<a
						href={visualizerLink.href}
						onclick={() => { menuOpen = false; }}
						class="block rounded-lg px-3 py-2 text-sm font-medium transition-colors
							{isActive(visualizerLink.href) ? 'bg-violet-50 text-violet-900' : 'text-gray-700 hover:bg-gray-100'}"
					>{visualizerLink.label}</a>
				</div>

				<!-- Interpreter group -->
				<div class="border-t border-gray-100 pt-2">
					<p class="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-teal-500">Interpreter</p>
					<a
						href={interpreterLink.href}
						onclick={() => { menuOpen = false; }}
						class="block rounded-lg px-3 py-2 text-sm font-medium transition-colors
							{isActive(interpreterLink.href) ? 'bg-teal-50 text-teal-900' : 'text-gray-700 hover:bg-gray-100'}"
					>{interpreterLink.label}</a>
				</div>

				<!-- Utility group -->
				<div class="border-t border-gray-100 pt-2 space-y-0.5">
					<a
						href={aboutLink.href}
						onclick={() => { menuOpen = false; }}
						class="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
					>About</a>
					<button
						onclick={() => { menuOpen = false; citeOpen = true; }}
						class="block w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
					>Cite this tool</button>
				</div>
			</div>
		{/if}
	</header>

	<!-- Page content -->
	<main class="flex-1">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="border-t border-gray-200 bg-gray-50 mt-16">
		<div class="mx-auto max-w-6xl px-4 py-8">
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-gray-500">
				<div>
					<span class="font-medium text-gray-900">Magnitood</span>:
					effect sizes, explained.
					Built by
					<a href="{base}/about" class="underline hover:text-gray-900">Markus Ostarek</a>.
				</div>
				<div class="flex gap-4">
					<button
						onclick={() => { citeOpen = true; }}
						class="hover:text-gray-900 underline transition-colors"
					>Cite this tool</button>
					<a href="{base}/about" class="hover:text-gray-900 transition-colors">About</a>
					<a
						href="https://github.com/MarkusOstarek/Magnitud"
						target="_blank"
						rel="noopener noreferrer"
						class="hover:text-gray-900 transition-colors"
					>GitHub</a>
				</div>
			</div>
			<p class="mt-4 text-xs text-gray-400">
				Formulas from Borenstein et al. (2009) and Cohen (1988). Validated against R metafor::escalc().
				All computation is client-side; no data is sent to any server.
			</p>
		</div>
	</footer>
</div>

<svelte:window onkeydown={(e) => { if (citeOpen && e.key === 'Escape') citeOpen = false; }} />

<!-- Citation modal -->
{#if citeOpen}
	<div
		class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
		onclick={() => { citeOpen = false; }}
		role="presentation"
		aria-hidden="true"
	></div>

	<div
		bind:this={dialogEl}
		tabindex="-1"
		onkeydown={onModalKeydown}
		class="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-2xl focus:outline-none"
		role="dialog"
		aria-modal="true"
		aria-labelledby="cite-title"
	>
		<div class="flex items-center justify-between mb-4">
			<h2 id="cite-title" class="text-lg font-semibold text-gray-900">Cite Magnitood</h2>
			<button onclick={() => { citeOpen = false; }} class="text-gray-400 hover:text-gray-600 p-1 rounded" aria-label="Close">
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
			</button>
		</div>

		<div class="space-y-4">
			{#each [
				{ key: 'apa', label: 'APA' },
				{ key: 'bibtex', label: 'BibTeX' },
				{ key: 'ris', label: 'RIS' }
			] as fmt}
				<div>
					<div class="flex items-center justify-between mb-1">
						<span class="text-xs font-semibold uppercase tracking-wide text-gray-500">{fmt.label}</span>
						<button
							onclick={() => copyCite(fmt.key as keyof typeof citations)}
							class="text-xs px-2 py-0.5 rounded border transition-colors
								{copiedFormat === fmt.key
									? 'border-green-300 bg-green-50 text-green-700'
									: 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'}"
						>{copiedFormat === fmt.key ? 'Copied!' : 'Copy'}</button>
					</div>
					<pre class="rounded-lg bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap break-words border border-gray-100">{citations[fmt.key as keyof typeof citations]}</pre>
				</div>
			{/each}
		</div>
	</div>
{/if}
