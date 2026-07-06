import { SITE_URL } from '$lib/site.js';

export const prerender = true;

export function GET(): Response {
	const body = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

	return new Response(body, {
		headers: { 'Content-Type': 'text/plain' }
	});
}
