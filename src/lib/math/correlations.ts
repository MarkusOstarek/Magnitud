/**
 * Family 2: Correlation effect sizes
 * Pearson r, R², Fisher's z, and conversions from t, p, chi-square, and regression slope.
 *
 * Key references:
 *   Fisher (1915, 1921) — z transformation
 *   Cohen (1988) — r benchmarks (small = .10, medium = .30, large = .50)
 *   Borenstein et al. (2009) — r ↔ d conversion
 */

import { tInv } from './distributions.js';
import { parseNumber } from './conversions.js';

export { parseNumber };

// ─── Input conversions ────────────────────────────────────────────────────────

/** r from t-statistic of a correlation test. df = n − 2. */
export function rFromT(t: number, n: number): number {
	const df = n - 2;
	return t / Math.sqrt(t ** 2 + df);
}

/** r from a two-tailed p-value of a correlation test, with direction. */
export function rFromP(p: number, n: number, direction: 1 | -1): number {
	const t = tInv(1 - p / 2, n - 2);
	return direction * rFromT(t, n);
}

/** phi coefficient from chi-square with 1 df (equals Pearson r for 2×2 tables). */
export function rFromChi2(chi2: number, n: number, direction: 1 | -1): number {
	return direction * Math.sqrt(chi2 / n);
}

/** r from a regression slope, given the SDs of both variables. b = r × (SD_y / SD_x). */
export function rFromSlope(b: number, sdx: number, sdy: number): number {
	return b * (sdx / sdy);
}

/** r from R² with sign. */
export function rFromR2(r2: number, direction: 1 | -1): number {
	return direction * Math.sqrt(r2);
}

/** r from Fisher's z. */
export function rFromFisherZ(z: number): number {
	return Math.tanh(z);
}

// ─── Derived metrics ──────────────────────────────────────────────────────────

/** Fisher's z transformation. z = atanh(r). */
export function fisherZ(r: number): number {
	return Math.atanh(r);
}

/** Standard error of Fisher's z. SE(z) = 1 / √(n − 3). */
export function seFisherZ(n: number): number {
	if (n <= 3) return Infinity;
	return 1 / Math.sqrt(n - 3);
}

/** Sampling variance of Fisher's z. Var(z) = 1 / (n − 3). */
export function varFisherZ(n: number): number {
	if (n <= 3) return Infinity;
	return 1 / (n - 3);
}

/** 95% CI for Pearson's r via Fisher's z transformation. */
export function ciR(r: number, n: number): [number, number] {
	if (n <= 3) return [-1, 1];
	const z = Math.atanh(r);
	const se = seFisherZ(n);
	return [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)];
}

// ─── Cross-family ─────────────────────────────────────────────────────────────

/**
 * Convert Pearson r to Cohen's d.
 * Borenstein et al. (2009), eq. 7.5
 * Assumes equal group sizes.
 *
 * d = 2r / √(1 − r²)
 */
export function rToD(r: number): number {
	return (2 * r) / Math.sqrt(1 - r ** 2);
}
