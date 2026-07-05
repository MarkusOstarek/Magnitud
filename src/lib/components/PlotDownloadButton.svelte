<script lang="ts">
	import { downloadSVG, downloadPNG } from '$lib/utils/downloadPlot.js';

	interface Props {
		getSvg: () => SVGSVGElement | undefined;
		filename?: string;
		class?: string;
	}

	let { getSvg, filename = 'plot', class: cls = '' }: Props = $props();

	let pngBusy = $state(false);

	function handleSVG() {
		const el = getSvg();
		if (el) downloadSVG(el, `${filename}.svg`);
	}

	async function handlePNG() {
		const el = getSvg();
		if (!el) return;
		pngBusy = true;
		try {
			await downloadPNG(el, `${filename}.png`);
		} finally {
			pngBusy = false;
		}
	}
</script>

<div class="flex items-center gap-0.5 {cls}" role="group" aria-label="Download plot">
	<span class="text-xs text-gray-400 mr-1 select-none">Download:</span>
	<button
		type="button"
		onclick={handleSVG}
		title="Download as SVG (vector, editable)"
		class="rounded px-2 py-1 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-1 focus:ring-accent"
	>
		SVG
	</button>
	<button
		type="button"
		onclick={handlePNG}
		disabled={pngBusy}
		title="Download as PNG (raster, 2× resolution)"
		class="rounded px-2 py-1 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
	>
		{pngBusy ? '…' : 'PNG'}
	</button>
</div>
