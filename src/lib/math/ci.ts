/**
 * Confidence interval calculations.
 * Using normal approximation (z = 1.96 for 95% CI) unless noted.
 */

/**
 * 95% CI for Cohen's d using the large-sample normal approximation.
 * Borenstein et al. (2009), eq. 4.29
 */
export function ciD(d: number, se: number): [number, number] {
	return [d - 1.96 * se, d + 1.96 * se];
}

/**
 * 95% CI for Hedges' g (scales SE by the correction factor J).
 */
export function ciG(g: number, seG: number): [number, number] {
	return [g - 1.96 * seG, g + 1.96 * seG];
}

/**
 * 95% CI for Pearson's r via Fisher's z transformation.
 * Uses N = n1 + n2 as the total sample size.
 *
 * z = atanh(r)
 * SE(z) = 1 / sqrt(N - 3)
 * CI_z = z ± 1.96 * SE(z)
 * CI_r = tanh(CI_z)
 */
export function ciR(r: number, N: number): [number, number] {
	if (N <= 3) return [-1, 1];
	const z = Math.atanh(r);
	const se = 1 / Math.sqrt(N - 3);
	const lo = Math.tanh(z - 1.96 * se);
	const hi = Math.tanh(z + 1.96 * se);
	return [lo, hi];
}
