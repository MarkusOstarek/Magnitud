<script lang="ts">
	interface Props {
		text: string;
		title?: string;
		size?: 'sm' | 'md';
		label?: string;
		class?: string;
	}

	let { text, title = 'Copy', size = 'sm', label, class: cls = '' }: Props = $props();

	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => { copied = false; }, 2000);
		} catch {
			// Fallback for browsers without clipboard API
			const el = document.createElement('textarea');
			el.value = text;
			el.style.position = 'fixed';
			el.style.opacity = '0';
			document.body.appendChild(el);
			el.select();
			document.execCommand('copy');
			document.body.removeChild(el);
			copied = true;
			setTimeout(() => { copied = false; }, 2000);
		}
	}
</script>

<button
	onclick={copy}
	{title}
	aria-label={copied ? 'Copied!' : title}
	class="inline-flex items-center gap-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1
		{size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'}
		{copied ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}
		{cls}"
>
	{#if copied}
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
			class="{size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}">
			<path fill-rule="evenodd"
				d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
				clip-rule="evenodd" />
		</svg>
		Copied
	{:else}
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
			class="{size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}">
			<path d="M5.5 3.5A1.5 1.5 0 0 1 7 2h2.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 1 .439 1.061V9.5A1.5 1.5 0 0 1 12 11V9.5a3 3 0 0 0-.879-2.121L9 5.257A3 3 0 0 0 6.879 4.5H5.5v-1Z" />
			<path d="M4 5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 4 14h5a1.5 1.5 0 0 0 1.5-1.5V8.621a1.5 1.5 0 0 0-.44-1.06L7.94 5.439A1.5 1.5 0 0 0 6.878 5H4Z" />
		</svg>
		{#if label}<span>{label}</span>{/if}
	{/if}
</button>
