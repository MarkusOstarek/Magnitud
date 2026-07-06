/**
 * Single source of truth for the site's public identity.
 *
 * When magnitood.org goes live, the switch is:
 *   1. Change SITE_URL below to 'https://magnitood.org'
 *   2. Set `base` to '' in svelte.config.js
 *   3. Add a static/CNAME file containing "magnitood.org"
 *   4. Update the hardcoded /Magnitood/ links in static/404.html to /
 *   5. Configure the custom domain in the repo's Pages settings
 * The sitemap and robots.txt are generated from SITE_URL and follow along
 * automatically.
 */
export const SITE_URL = 'https://markusostarek.github.io/Magnitood';
export const REPO_URL = 'https://github.com/MarkusOstarek/Magnitood';
export const SITE_NAME = 'Magnitood';

/** All indexable routes, used to build the sitemap. */
export const SITE_ROUTES: { path: string; priority: string }[] = [
	{ path: '/', priority: '1.0' },
	{ path: '/cohens-d', priority: '0.9' },
	{ path: '/correlation', priority: '0.9' },
	{ path: '/variance-explained', priority: '0.9' },
	{ path: '/binary-outcomes', priority: '0.9' },
	{ path: '/regression-coefficients', priority: '0.9' },
	{ path: '/visualize', priority: '0.8' },
	{ path: '/about', priority: '0.6' }
];
