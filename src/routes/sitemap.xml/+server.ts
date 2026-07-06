import { SITE_URL, SITE_ROUTES } from '$lib/site.js';

export const prerender = true;

export function GET(): Response {
	const urls = SITE_ROUTES.map(
		(r) => `  <url>
    <loc>${SITE_URL}${r.path === '/' ? '/' : r.path}</loc>
    <changefreq>monthly</changefreq>
    <priority>${r.priority}</priority>
  </url>`
	).join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

	return new Response(xml, {
		headers: { 'Content-Type': 'application/xml' }
	});
}
