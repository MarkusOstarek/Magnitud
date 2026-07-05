/**
 * Family 1: Standardised mean differences
 * All formulas from Borenstein et al. (2009) "Introduction to Meta-Analysis"
 * and Cohen (1988) "Statistical Power Analysis for the Behavioral Sciences".
 *
 * Validated against R metafor::escalc() and the esc package.
 */

import { normalCDF, tInv } from './distributions.js';

// ─── Input parsing ────────────────────────────────────────────────────────────

/**
 * Parse a number from a string, accepting both decimal comma and decimal point.
 * Returns null for empty strings or invalid input.
 */
export function parseNumber(input: string): number | null {
	if (!input.trim()) return null;
	const normalised = input.replace(',', '.');
	const parsed = parseFloat(normalised);
	return isNaN(parsed) ? null : parsed;
}

// ─── Core conversions ─────────────────────────────────────────────────────────

/**
 * Cohen's d from group means and standard deviations.
 * Borenstein et al. (2009), eq. 4.18
 *
 * SD_pooled = sqrt(((n1-1)*SD1^2 + (n2-1)*SD2^2) / (n1+n2-2))
 * d = (M1 - M2) / SD_pooled
 */
export function dFromMeans(
	m1: number,
	m2: number,
	sd1: number,
	sd2: number,
	n1: number,
	n2: number
): number {
	const sdPooled = Math.sqrt(((n1 - 1) * sd1 ** 2 + (n2 - 1) * sd2 ** 2) / (n1 + n2 - 2));
	return (m1 - m2) / sdPooled;
}

/**
 * Pooled SD (returned separately for Glass's delta computation).
 */
export function pooledSD(sd1: number, sd2: number, n1: number, n2: number): number {
	return Math.sqrt(((n1 - 1) * sd1 ** 2 + (n2 - 1) * sd2 ** 2) / (n1 + n2 - 2));
}

/**
 * Glass's Δ — uses the control group SD as standardiser.
 * Only computable when individual SDs are available.
 * sdControl is typically SD of group 2 (the control group).
 */
export function glassDelta(m1: number, m2: number, sdControl: number): number {
	return (m1 - m2) / sdControl;
}

/**
 * Cohen's d from an independent-samples t-statistic.
 * Borenstein et al. (2009), eq. 4.20
 *
 * d = t * sqrt(1/n1 + 1/n2)
 */
export function dFromT(t: number, n1: number, n2: number): number {
	return t * Math.sqrt(1 / n1 + 1 / n2);
}

/**
 * Cohen's d from an F-statistic with df_numerator = 1.
 * Converts F → t = sqrt(F), then uses dFromT.
 */
export function dFromF(F: number, n1: number, n2: number): number {
	return dFromT(Math.sqrt(F), n1, n2);
}

/**
 * Cohen's d from a two-tailed p-value.
 * Inverts the t-distribution to obtain |t|, then applies dFromT.
 * Requires the user to specify the direction of the effect.
 *
 * @param p   Two-tailed p-value (0 < p < 1)
 * @param n1  Group 1 sample size
 * @param n2  Group 2 sample size
 * @param direction  +1 if group 1 > group 2, -1 otherwise
 */
export function dFromP(
	p: number,
	n1: number,
	n2: number,
	direction: 1 | -1
): number {
	const df = n1 + n2 - 2;
	const t = tInv(1 - p / 2, df); // upper tail → positive t
	return direction * dFromT(t, n1, n2);
}

// ─── Derived metrics ──────────────────────────────────────────────────────────

/**
 * Hedges' g — bias-corrected Cohen's d for small samples.
 * Borenstein et al. (2009), eq. 4.22–4.24
 *
 * J = 1 - 3 / (4*df - 1)   where df = n1 + n2 - 2
 * g = J * d
 */
export function hedgesG(d: number, n1: number, n2: number): number {
	const df = n1 + n2 - 2;
	const J = 1 - 3 / (4 * df - 1);
	return J * d;
}

/**
 * Correction factor J for Hedges' g.
 */
export function hedgesJ(n1: number, n2: number): number {
	return 1 - 3 / (4 * (n1 + n2 - 2) - 1);
}

/**
 * Point-biserial correlation r from Cohen's d.
 * Borenstein et al. (2009), eq. 4.25
 *
 * a = (n1 + n2)^2 / (n1 * n2)
 * r = d / sqrt(d^2 + a)
 *
 * When n1 = n2, a = 4 and r = d / sqrt(d^2 + 4).
 */
export function rFromD(d: number, n1: number, n2: number): number {
	const a = (n1 + n2) ** 2 / (n1 * n2);
	return d / Math.sqrt(d ** 2 + a);
}

/**
 * Common Language Effect Size (CLES) / Probability of Superiority.
 * McGraw & Wong (1992); Borenstein et al. (2009), p. 57
 *
 * CLES = Φ(d / √2)
 *
 * Interpretation: probability that a randomly selected member of
 * group 1 scores higher than a randomly selected member of group 2.
 */
export function cles(d: number): number {
	return normalCDF(d / Math.sqrt(2));
}

/**
 * Cohen's U3 — proportion of group 2 exceeded by the group 1 mean.
 * Cohen (1988)
 *
 * U3 = Φ(d)
 */
export function u3(d: number): number {
	return normalCDF(d);
}

/**
 * Overlap coefficient (OVL) — proportion of the two distributions
 * that overlap (area under both curves).
 * Reiser & Faraggi (1999)
 *
 * OVL = 2 * Φ(-|d| / 2)
 */
export function ovl(d: number): number {
	return 2 * normalCDF(-Math.abs(d) / 2);
}

// ─── Variance and standard error ─────────────────────────────────────────────

/**
 * Sampling variance of Cohen's d.
 * Borenstein et al. (2009), eq. 4.28
 *
 * Var(d) = (n1+n2)/(n1*n2) + d^2/(2*(n1+n2))
 */
export function varD(d: number, n1: number, n2: number): number {
	return (n1 + n2) / (n1 * n2) + d ** 2 / (2 * (n1 + n2));
}

/**
 * Standard error of Cohen's d.
 * SE(d) = sqrt(Var(d))
 */
export function seD(d: number, n1: number, n2: number): number {
	return Math.sqrt(varD(d, n1, n2));
}

// ─── Paired / repeated-measures conversions ──────────────────────────────────

/**
 * Cohen's d_z from a paired-samples t-statistic.
 * The subscript z denotes that the SD of the difference scores is the standardiser.
 * Lakens (2013), eq. 2; Borenstein et al. (2009), p. 29
 *
 * d_z = t / sqrt(n)    where n = number of pairs
 *
 * ⚠️ d_z is NOT directly comparable to Cohen's d from independent samples.
 *    Use dsFromDZ() to convert to d_s, which is comparable.
 */
export function dzFromTPaired(t: number, n: number): number {
	return t / Math.sqrt(n);
}

/**
 * Cohen's d_z from paired means: mean of the difference scores divided by
 * their standard deviation.
 * Equivalent to a one-sample t on the difference, then dividing by sqrt(n).
 *
 * d_z = M_diff / SD_diff
 *
 * @param mDiff   Mean of (score1 − score2)
 * @param sdDiff  Standard deviation of the difference scores
 */
export function dzFromMeansDiff(mDiff: number, sdDiff: number): number {
	return mDiff / sdDiff;
}

/**
 * Convert d_z to d_s — the "between-person" standardiser, directly comparable
 * to Cohen's d from independent samples.
 * Lakens (2013), eq. 11; Morris & DeShon (2002)
 *
 * d_s = d_z * sqrt(2 * (1 - r))
 *
 * @param dz  Cohen's d_z (within-person effect size)
 * @param r   Pearson correlation between the two sets of measurements
 */
export function dsFromDZ(dz: number, r: number): number {
	return dz * Math.sqrt(2 * (1 - r));
}

/**
 * Sampling variance of d_z.
 * Borenstein et al. (2009), p. 29; Lakens (2013)
 *
 * Var(d_z) = 1/n + d_z² / (2n)
 */
export function varDZ(dz: number, n: number): number {
	return 1 / n + dz ** 2 / (2 * n);
}

/**
 * Standard error of d_z.
 */
export function seDZ(dz: number, n: number): number {
	return Math.sqrt(varDZ(dz, n));
}

// ─── One-sample conversions ───────────────────────────────────────────────────

/**
 * Cohen's d for a one-sample design.
 * d₁ = (M − μ₀) / SD
 *
 * @param m    Sample mean
 * @param mu0  Reference (null) value
 * @param sd   Sample standard deviation
 */
export function dFromMeanOneSample(m: number, mu0: number, sd: number): number {
	return (m - mu0) / sd;
}

/**
 * Hedges' correction factor J for a one-sample design (df = n − 1).
 * More accurate than hedgesJ(n, n) which uses df = 2n − 2.
 */
export function hedgesJOneSample(n: number): number {
	return 1 - 3 / (4 * (n - 1) - 1);
}

/**
 * Point-biserial r for a one-sample design.
 * r = t / √(t² + df)   where t = d₁√n, df = n − 1
 */
export function rFromDOneSample(d: number, n: number): number {
	const t = d * Math.sqrt(n);
	const df = n - 1;
	return t / Math.sqrt(t ** 2 + df);
}

// ─── Cross-family conversions ─────────────────────────────────────────────────

/**
 * d to log odds ratio.
 * Borenstein et al. (2009), eq. 7.1
 * Assumes the continuous outcome follows a logistic distribution.
 *
 * log_OR = d * (π / √3)
 */
export function dToLogOR(d: number): number {
	return d * (Math.PI / Math.sqrt(3));
}

/**
 * SE of log odds ratio from SE of d.
 * Borenstein et al. (2009), eq. 7.2
 */
export function seDToSELogOR(seD: number): number {
	return seD * (Math.PI / Math.sqrt(3));
}
