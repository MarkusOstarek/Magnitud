// @ts-ignore — jstat ships CommonJS; types declared in src/lib/types/jstat.d.ts
import jStat from 'jstat';

/**
 * Standard normal probability density function.
 * Uses jstat.normal.pdf(x, mu, sigma).
 */
export function normalPDF(x: number, mu = 0, sigma = 1): number {
	return jStat.normal.pdf(x, mu, sigma) as number;
}

/**
 * Standard normal cumulative distribution function Φ(x).
 * Uses jstat.normal.cdf(x, mu, sigma).
 */
export function normalCDF(x: number, mu = 0, sigma = 1): number {
	return jStat.normal.cdf(x, mu, sigma) as number;
}

/**
 * Inverse standard normal CDF (quantile function).
 * normalInv(0.975) ≈ 1.96
 */
export function normalInv(p: number, mu = 0, sigma = 1): number {
	return jStat.normal.inv(p, mu, sigma) as number;
}

/**
 * Inverse CDF of Student's t distribution (quantile function).
 * Used for converting p-values to t-statistics.
 * tInv(0.975, 98) ≈ 1.984
 */
export function tInv(p: number, df: number): number {
	return jStat.studentt.inv(p, df) as number;
}

/**
 * Generate evenly spaced x values for plotting a normal distribution.
 * Returns an array of { x, y } points suitable for D3 area/line generators.
 */
export function normalPoints(
	mu: number,
	sigma: number,
	xMin: number,
	xMax: number,
	nPoints = 200
): { x: number; y: number }[] {
	const step = (xMax - xMin) / nPoints;
	const points: { x: number; y: number }[] = [];
	for (let x = xMin; x <= xMax; x += step) {
		points.push({ x, y: normalPDF(x, mu, sigma) });
	}
	return points;
}
