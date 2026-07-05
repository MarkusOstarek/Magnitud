/**
 * Family 4: Binary outcome effect sizes.
 * Odds ratio, risk ratio, risk difference, NNT, phi coefficient.
 *
 * 2×2 table convention:
 *   Treatment (group 1): event = a, no event = b   → n1 = a + b
 *   Control   (group 2): event = c, no event = d   → n2 = c + d
 *
 * Key references:
 *   Borenstein et al. (2009) — log OR, log RR, SE formulas
 *   Fleiss, Levin & Paik (2003) — 2×2 table statistics
 *   Haldane (1956) — zero-cell continuity correction
 */

// ─── Zero-cell handling ───────────────────────────────────────────────────────

/**
 * Returns true if any cell is ≤ 0 (OR/RR undefined without correction).
 */
export function hasZeroCell(a: number, b: number, c: number, d: number): boolean {
	return a <= 0 || b <= 0 || c <= 0 || d <= 0;
}

/**
 * Haldane-Anscombe continuity correction: add 0.5 to every cell.
 * Applied automatically when any cell equals zero.
 */
export function applyHaldane(
	a: number, b: number, c: number, d: number
): [number, number, number, number] {
	return [a + 0.5, b + 0.5, c + 0.5, d + 0.5];
}

// ─── Odds ratio ───────────────────────────────────────────────────────────────

/**
 * Odds ratio: OR = (a·d) / (b·c).
 */
export function oddsRatio(a: number, b: number, c: number, d: number): number {
	return (a * d) / (b * c);
}

/**
 * Log odds ratio: ln(OR).
 */
export function logOddsRatio(a: number, b: number, c: number, d: number): number {
	return Math.log(oddsRatio(a, b, c, d));
}

/**
 * SE of log OR: √(1/a + 1/b + 1/c + 1/d).
 * Borenstein et al. (2009), eq. 5.4.
 */
export function seLogOR(a: number, b: number, c: number, d: number): number {
	return Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d);
}

/**
 * 95% CI for OR (Wald interval on log scale).
 */
export function ciOR(a: number, b: number, c: number, d: number): [number, number] {
	const logOR = logOddsRatio(a, b, c, d);
	const se    = seLogOR(a, b, c, d);
	return [Math.exp(logOR - 1.96 * se), Math.exp(logOR + 1.96 * se)];
}

// ─── Risk ratio ───────────────────────────────────────────────────────────────

/**
 * Risk ratio (relative risk): RR = (a/n1) / (c/n2).
 */
export function riskRatio(a: number, b: number, c: number, d: number): number {
	const n1 = a + b, n2 = c + d;
	return (a / n1) / (c / n2);
}

/**
 * Log risk ratio: ln(RR).
 */
export function logRiskRatio(a: number, b: number, c: number, d: number): number {
	return Math.log(riskRatio(a, b, c, d));
}

/**
 * SE of log RR: √(b/(a·n1) + d/(c·n2)).
 * Borenstein et al. (2009), eq. 5.13.
 */
export function seLogRR(a: number, b: number, c: number, d: number): number {
	const n1 = a + b, n2 = c + d;
	return Math.sqrt(b / (a * n1) + d / (c * n2));
}

/**
 * 95% CI for RR (Wald interval on log scale).
 */
export function ciRR(a: number, b: number, c: number, d: number): [number, number] {
	const logRR = logRiskRatio(a, b, c, d);
	const se    = seLogRR(a, b, c, d);
	return [Math.exp(logRR - 1.96 * se), Math.exp(logRR + 1.96 * se)];
}

// ─── Risk difference ──────────────────────────────────────────────────────────

/**
 * Risk difference (absolute risk reduction): RD = p1 − p2.
 */
export function riskDifference(a: number, b: number, c: number, d: number): number {
	const n1 = a + b, n2 = c + d;
	return a / n1 - c / n2;
}

/**
 * SE of risk difference: √(p1(1−p1)/n1 + p2(1−p2)/n2).
 */
export function seRD(a: number, b: number, c: number, d: number): number {
	const n1 = a + b, n2 = c + d;
	const p1 = a / n1, p2 = c / n2;
	return Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
}

/**
 * 95% CI for RD (Wald interval).
 */
export function ciRD(a: number, b: number, c: number, d: number): [number, number] {
	const rd = riskDifference(a, b, c, d);
	const se = seRD(a, b, c, d);
	return [rd - 1.96 * se, rd + 1.96 * se];
}

// ─── NNT / NNH ───────────────────────────────────────────────────────────────

/**
 * Number needed to treat (or harm): 1 / |RD|.
 * Returns null when RD = 0 (undefined).
 * Positive RD → group 1 has more events (NNH if outcome is bad).
 * Negative RD → group 1 has fewer events (NNT if outcome is bad).
 */
export function nnt(rd: number): number | null {
	if (rd === 0 || !isFinite(rd)) return null;
	return 1 / Math.abs(rd);
}

// ─── Phi coefficient ──────────────────────────────────────────────────────────

/**
 * Phi coefficient: φ = (a·d − b·c) / √(n1·n2·(a+c)·(b+d)).
 * Equivalent to Cramér's V for 2×2 tables.
 * Sign: positive when group 1 has a higher event rate.
 */
export function phiCoefficient(a: number, b: number, c: number, d: number): number {
	const n1 = a + b, n2 = c + d;
	const nEvent = a + c, nNoEvent = b + d;
	return (a * d - b * c) / Math.sqrt(n1 * n2 * nEvent * nNoEvent);
}

// ─── Cross-family: d ↔ log OR ─────────────────────────────────────────────────

/**
 * Convert Cohen's d to log odds ratio using the Borenstein approximation.
 * Assumes the underlying latent variable follows a logistic distribution.
 * logOR = d · π / √3
 * Borenstein et al. (2009), eq. 7.1.
 */
export function dToLogOR(d: number): number {
	return d * Math.PI / Math.sqrt(3);
}

/**
 * Convert log odds ratio to Cohen's d.
 * d = logOR · √3 / π
 */
export function logORToD(logOR: number): number {
	return logOR * Math.sqrt(3) / Math.PI;
}
