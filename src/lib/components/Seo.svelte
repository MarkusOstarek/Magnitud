<script lang="ts">
	interface Props {
		title: string;
		description: string;
		/** Path within the site, e.g. "/cohens-d". Empty string for the home page. */
		path?: string;
	}

	import { SITE_URL, SITE_NAME } from '$lib/site.js';

	let { title, description, path = '' }: Props = $props();

	let url = $derived(path ? `${SITE_URL}${path}` : `${SITE_URL}/`);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
</svelte:head>
