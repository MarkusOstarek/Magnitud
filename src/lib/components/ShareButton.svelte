<script lang="ts">
	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	async function share() {
		if (!navigator?.clipboard?.writeText) return;
		try {
			await navigator.clipboard.writeText(window.location.href);
			copied = true;
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => { copied = false; }, 2000);
		} catch {
			// silently fail
		}
	}
</script>

<button
	type="button"
	onclick={share}
	class="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors underline underline-offset-2"
	title="Copy link to this page"
>
	{#if copied}
		<!-- green checkmark -->
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
			class="w-3.5 h-3.5 text-green-500 shrink-0" aria-hidden="true">
			<path fill-rule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd"/>
		</svg>
		<span class="text-green-500">Copied!</span>
	{:else}
		<!-- link-chain icon -->
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
			class="w-3.5 h-3.5 shrink-0" aria-hidden="true">
			<path d="M6.354 5.646a.5.5 0 0 0-.708 0l-2 2a3.536 3.536 0 1 0 5 5l1-1a.5.5 0 0 0-.708-.708l-1 1a2.536 2.536 0 0 1-3.586-3.586l2-2a.5.5 0 0 0 0-.708Z"/>
			<path d="M9.646 10.354a.5.5 0 0 0 .708 0l2-2a3.536 3.536 0 0 0-5-5l-1 1a.5.5 0 0 0 .708.708l1-1a2.536 2.536 0 0 1 3.586 3.586l-2 2a.5.5 0 0 0 0 .708Z"/>
		</svg>
		Copy link
	{/if}
</button>
