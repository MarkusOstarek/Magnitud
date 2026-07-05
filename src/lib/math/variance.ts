/**
 * Family 3: Variance-explained effect sizes
 * η² (eta-squared), partial η², ω² (omega-squared), Cohen's f
 *
 * Key references:
 *   Cohen (1988) — f thresholds (small=.10, medium=.25, large=.40)
 *   Hays (1963) — ω² formula
 *   Olejnik & Algina (2003) — partial η² and partial ω²
 *   Richardson (2011) — review of ω² and η² for ANOVA
 *   Smithson (2001) — noncentral F CI method
 */

// @ts-ignore — jstat ships CommonJS; types declared in src/lib/types/jstat.d.ts
import jStat from 'jstat';

// ─── Core conversions ─────────────────────────────────────────────────────────

/**
 * Partial η² from an F-statistic.
 * Equals η² for one-way (between-subjects) ANOVA.
 *
 * partial η² = F·df_num / (F·df_num + df_den)
 */
export function partialEta2FromF(F: number, dfNum: number, dfDen: number): number {
	return (F * dfNum) / (F * dfNum + dfDen);
}

/**
 * ω² / partial ω² from an F-statistic.
 *
 * For ONE-WAY ANOVA: this is ω² (unqualified).
 *   df_den = N − k, so df_num + df_den + 1 = N.
 *
 * For FACTORIAL ANOVA: this is partial ω² for the specific effect,
 *   using the pooled within-cell error as df_den.
 *   Olejnik & Algina (2003); Carroll & Nordholm (1975).
 *
 * NOT valid for repeated-measures or mixed designs (different error structure).
 *
 * ω² = df_num·(F − 1) / (F·df_num + df_den + 1)   [floored at 0]
 */
export function omega2FromF(F: number, dfNum: number, dfDen: number): number {
	const val = (dfNum * (F - 1)) / (F * dfNum + dfDen + 1);
	return Math.max(0, val);
}

/**
 * Cohen's f from η² (or partial η²).
 * Cohen (1988): f = √(η² / (1 − η²))
 */
export function cohensF(eta2: number): number {
	if (eta2 >= 1) return Infinity;
	return Math.sqrt(eta2 / (1 - eta2));
}

/**
 * Cohen's f² from η² (or partial η²).
 * f² = η² / (1 − η²)
 */
export function cohensFSq(eta2: number): number {
	if (eta2 >= 1) return Infinity;
	return eta2 / (1 - eta2);
}

/**
 * η² from Cohen's f.
 * η² = f² / (1 + f²)
 */
export function eta2FromCohensF(f: number): number {
	return f ** 2 / (1 + f ** 2);
}

// ─── SS-based conversions ─────────────────────────────────────────────────────

/**
 * Partial η² from SS values.
 * partial η² = SS_effect / (SS_effect + SS_error)
 */
export function partialEta2FromSS(ssEff: number, ssError: number): number {
	return ssEff / (ssEff + ssError);
}

/**
 * η² from SS values.
 * η² = SS_effect / SS_total
 */
export function eta2FromSS(ssEff: number, ssTotal: number): number {
	return ssEff / ssTotal;
}

/**
 * ω² from SS values (one-way ANOVA; needs SS_total).
 * ω² = (SS_eff − df_eff·MS_error) / (SS_total + MS_error)
 */
export function omega2FromSS(
	ssEff: number,
	dfEff: number,
	ssError: number,
	dfError: number,
	ssTotal: number
): number {
	const msError = ssError / dfError;
	const val = (ssEff - dfEff * msError) / (ssTotal + msError);
	return Math.max(0, val);
}

/**
 * Partial ω² from SS values (factorial ANOVA; does not need SS_total).
 * partial ω² = (SS_eff − df_eff·MS_error) / (SS_eff + SS_error + MS_error)
 * Olejnik & Algina (2003).
 */
export function partialOmega2FromSS(
	ssEff: number,
	dfEff: number,
	ssError: number,
	dfError: number
): number {
	const msError = ssError / dfError;
	const val = (ssEff - dfEff * msError) / (ssEff + ssError + msError);
	return Math.max(0, val);
}

// ─── Confidence intervals via noncentral F ────────────────────────────────────

/**
 * Noncentral F CDF using the Poisson-mixture-of-incomplete-betas formula.
 * P(F(df1, df2, λ) ≤ x) = Σ_{j≥0} Poisson(j; λ/2) · I(df1·x/(df1·x+df2), df1/2+j, df2/2)
 *
 * Uses jStat.beta.cdf for the regularized incomplete beta function.
 */
function noncentralFCDF(x: number, df1: number, df2: number, lambda: number): number {
	if (x <= 0) return 0;
	if (lambda <= 0) return jStat.centralF.cdf(x, df1, df2) as number;

	const betaArg = (df1 * x) / (df1 * x + df2);
	const halfLam = lambda / 2;
	const maxJ = Math.max(150, Math.ceil(halfLam * 4) + 50);

	let sum = 0;
	let logProb = -halfLam; // log P(J=0) = −λ/2

	for (let j = 0; j < maxJ; j++) {
		const prob = Math.exp(logProb);
		if (prob < 1e-15 && j > 10) break;

		const ibeta = jStat.beta.cdf(betaArg, df1 / 2 + j, df2 / 2) as number;
		sum += prob * ibeta;

		logProb += Math.log(halfLam) - Math.log(j + 1);
	}

	return Math.min(1, Math.max(0, sum));
}

/**
 * Find λ (noncentrality) such that noncentralFCDF(F_obs, df1, df2, λ) = targetCDF.
 * Returns 0 if no positive λ satisfies the condition (clips CI at 0).
 */
function findLambda(F_obs: number, df1: number, df2: number, targetCDF: number): number {
	const cdf0 = jStat.centralF.cdf(F_obs, df1, df2) as number;

	// noncentralFCDF is decreasing in λ. If target ≥ CDF at λ=0, no positive λ works.
	if (targetCDF >= cdf0) return 0;

	// Find an upper bound for the bisection
	let hi = Math.max(F_obs * df1 * 2, df1 + df2 + 10);
	while (noncentralFCDF(F_obs, df1, df2, hi) > targetCDF) {
		hi *= 4;
		if (hi > 1e9) break;
	}

	let lo = 0;
	for (let i = 0; i < 80; i++) {
		const mid = (lo + hi) / 2;
		const cdf = noncentralFCDF(F_obs, df1, df2, mid);
		if (Math.abs(cdf - targetCDF) < 1e-9) return mid;
		if (cdf > targetCDF) lo = mid;
		else hi = mid;
	}

	return (lo + hi) / 2;
}

/**
 * 95% CI for partial η² using the noncentral F method (Smithson, 2001).
 * Works for any design that produces an F-statistic (one-way, factorial,
 * repeated-measures). The CI is on partial η² for the specific effect.
 *
 * Algorithm:
 *   1. Find λ_lo where CDF(F_obs, df1, df2, λ_lo) = 0.975  → lower CI bound
 *   2. Find λ_hi where CDF(F_obs, df1, df2, λ_hi) = 0.025  → upper CI bound
 *   3. Convert: η² = λ / (λ + df1 + df2 + 1)
 */
export function ciPartialEta2(F: number, dfNum: number, dfDen: number): [number, number] {
	if (!isFinite(F) || F <= 0) return [0, 0];

	const lambdaLo = findLambda(F, dfNum, dfDen, 0.975);
	const lambdaHi = findLambda(F, dfNum, dfDen, 0.025);

	// Convert noncentrality to η²: η² = λ / (λ + N) where N = df1 + df2 + 1
	const N = dfNum + dfDen + 1;
	const lo = lambdaLo === 0 ? 0 : lambdaLo / (lambdaLo + N);
	const hi = lambdaHi / (lambdaHi + N);

	return [Math.max(0, lo), Math.min(1, hi)];
}
