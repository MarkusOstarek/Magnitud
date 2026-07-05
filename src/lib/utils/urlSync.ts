import { replaceState } from '$app/navigation';

let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * Debounced, router-aware update of the page's query string.
 *
 * Every calculator mirrors its inputs into the URL so results are shareable.
 * This helper is the single mechanism for doing that: it debounces bursts of
 * keystrokes, uses SvelteKit's replaceState (so the router stays in sync and
 * no history entries pile up), and is safe to call from a $effect.
 */
export function syncQuery(params: URLSearchParams, delay = 150): void {
	clearTimeout(timer);
	timer = setTimeout(() => {
		try {
			replaceState(`?${params.toString()}`, {});
		} catch {
			// Router not initialised yet (first paint) — skip; the next
			// keystroke will sync.
		}
	}, delay);
}
