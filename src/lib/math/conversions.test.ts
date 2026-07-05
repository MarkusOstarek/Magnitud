/**
 * Unit tests for Family 1 conversion formulas.
 *
 * Test values validated against:
 *   - Borenstein et al. (2009) worked examples
 *   - R: metafor::escalc()
 *   - R: esc package
 *
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import {
	parseNumber,
	dFromMeans,
	dFromT,
	dFromF,
	hedgesG,
	hedgesJ,
	rFromD,
	cles,
	u3,
	ovl,
	varD,
	seD,
	glassDelta,
	dToLogOR,
	dzFromTPaired,
	dzFromMeansDiff,
	dsFromDZ,
	varDZ,
	seDZ,
	dFromMeanOneSample,
	hedgesJOneSample,
	rFromDOneSample
} from './conversions.js';

// Helper: check value is within tolerance
function near(a: number, b: number, tol = 0.001): boolean {
	return Math.abs(a - b) <= tol;
}

// ── parseNumber ───────────────────────────────────────────────────────────────

describe('parseNumber', () => {
	it('parses decimal point', () => expect(parseNumber('1.23')).toBe(1.23));
	it('parses decimal comma', () => expect(parseNumber('1,23')).toBe(1.23));
	it('returns null for empty string', () => expect(parseNumber('')).toBeNull());
	it('returns null for non-numeric', () => expect(parseNumber('abc')).toBeNull());
	it('parses negative', () => expect(parseNumber('-0.5')).toBe(-0.5));
	it('parses zero', () => expect(parseNumber('0')).toBe(0));

	// Thousands separators
	it('parses US-style thousands with decimal point', () =>
		expect(parseNumber('1,234.56')).toBe(1234.56));
	it('parses EU-style thousands with decimal comma', () =>
		expect(parseNumber('1.234,56')).toBe(1234.56));
	it('parses repeated commas as thousands separators', () =>
		expect(parseNumber('12,345,678')).toBe(12345678));
	it('parses space-grouped digits', () => expect(parseNumber('12 345')).toBe(12345));
	it('parses non-breaking-space-grouped digits', () =>
		expect(parseNumber('12 345')).toBe(12345));
	it('still treats a single comma as a decimal comma', () =>
		expect(parseNumber('1,23')).toBe(1.23));
});

// ── dFromMeans ────────────────────────────────────────────────────────────────

describe('dFromMeans', () => {
	// Borenstein et al. (2009), worked example:
	// M1=103, M2=100, SD1=5.5, SD2=4.5, n1=50, n2=50
	// SDpooled = sqrt((49*30.25 + 49*20.25)/98) = sqrt(25.25) ≈ 5.025 → d ≈ 0.597
	it('Borenstein worked example', () => {
		const d = dFromMeans(103, 100, 5.5, 4.5, 50, 50);
		expect(near(d, 0.597, 0.001)).toBe(true);
	});

	// Equal means → d = 0
	it('equal means gives d = 0', () => {
		expect(dFromMeans(50, 50, 10, 10, 30, 30)).toBe(0);
	});

	// Negative effect (M1 < M2)
	it('negative d when M1 < M2', () => {
		const d = dFromMeans(48, 52, 10, 10, 30, 30);
		expect(d).toBeLessThan(0);
	});

	// R: metafor::escalc('SMD', m1i=52.4, m2i=48.0, sd1i=9.1, sd2i=10.3, n1i=40, n2i=40)
	// Expected: d ≈ 0.454
	it('matches metafor output', () => {
		const d = dFromMeans(52.4, 48.0, 9.1, 10.3, 40, 40);
		expect(near(d, 0.454, 0.002)).toBe(true);
	});
});

// ── dFromT ────────────────────────────────────────────────────────────────────

describe('dFromT', () => {
	// Equal groups: d = t * sqrt(2/n)
	it('equal groups formula', () => {
		const t = 2.74;
		const n = 80;
		const expected = t * Math.sqrt(2 / n);
		expect(near(dFromT(t, n, n), expected)).toBe(true);
	});

	// d = 2.74 * sqrt(1/80 + 1/85) = 2.74 * 0.15578 ≈ 0.427
	it('matches formula for unequal n', () => {
		const d = dFromT(2.74, 80, 85);
		expect(near(d, 0.427, 0.001)).toBe(true);
	});

	it('t=0 gives d=0', () => {
		expect(dFromT(0, 50, 50)).toBe(0);
	});

	it('negative t gives negative d', () => {
		expect(dFromT(-2, 50, 50)).toBeLessThan(0);
	});

	// d = 5 * sqrt(2/20) = 5 * 0.3162 ≈ 1.581
	it('large t gives large effect size', () => {
		const d = dFromT(5, 20, 20);
		expect(near(d, 1.581, 0.001)).toBe(true);
	});
});

// ── dFromF ────────────────────────────────────────────────────────────────────

describe('dFromF', () => {
	// F = t^2, so dFromF should equal dFromT(sqrt(F))
	it('F = t^2 consistency', () => {
		const t = 2.74;
		const dT = dFromT(t, 80, 85);
		const dF = dFromF(t ** 2, 80, 85);
		expect(near(dT, dF, 1e-10)).toBe(true);
	});

	it('F=0 gives d=0', () => {
		expect(dFromF(0, 30, 30)).toBe(0);
	});
});

// ── hedgesG ───────────────────────────────────────────────────────────────────

describe('hedgesG', () => {
	// Borenstein: d=0.5, n1=50, n2=50 → J = 1 - 3/(4*98-1) = 0.99234; g = 0.4962
	it('Borenstein example: d=0.5, n=50+50', () => {
		const g = hedgesG(0.5, 50, 50);
		expect(near(g, 0.4962, 0.001)).toBe(true);
	});

	it('g < d for positive d (bias correction shrinks)', () => {
		expect(hedgesG(0.5, 10, 10)).toBeLessThan(0.5);
	});

	it('g > d for negative d (bias correction shrinks magnitude)', () => {
		expect(hedgesG(-0.5, 10, 10)).toBeGreaterThan(-0.5);
	});

	it('large samples: g ≈ d', () => {
		const g = hedgesG(0.5, 1000, 1000);
		expect(near(g, 0.5, 0.001)).toBe(true);
	});
});

// ── rFromD ────────────────────────────────────────────────────────────────────

describe('rFromD', () => {
	// Equal groups: a = 4, r = d / sqrt(d^2 + 4)
	it('equal groups formula', () => {
		const d = 0.5;
		const expected = d / Math.sqrt(d ** 2 + 4);
		expect(near(rFromD(d, 50, 50), expected)).toBe(true);
	});

	it('d=0 gives r=0', () => {
		expect(rFromD(0, 30, 30)).toBe(0);
	});

	it('r is always in (-1, 1)', () => {
		for (const d of [-3, -1, -0.5, 0, 0.5, 1, 3]) {
			const r = rFromD(d, 50, 50);
			expect(r).toBeGreaterThan(-1);
			expect(r).toBeLessThan(1);
		}
	});
});

// ── CLES ──────────────────────────────────────────────────────────────────────

describe('cles', () => {
	it('d=0 gives CLES=0.5', () => {
		expect(near(cles(0), 0.5)).toBe(true);
	});

	it('large positive d gives CLES close to 1', () => {
		expect(cles(3)).toBeGreaterThan(0.98);
	});

	it('d=0.5 gives CLES ≈ 0.638', () => {
		expect(near(cles(0.5), 0.638, 0.001)).toBe(true);
	});

	it('negative d gives CLES < 0.5', () => {
		expect(cles(-0.5)).toBeLessThan(0.5);
	});
});

// ── U3 ────────────────────────────────────────────────────────────────────────

describe('u3', () => {
	it('d=0 gives U3=0.5', () => {
		expect(near(u3(0), 0.5)).toBe(true);
	});

	it('d=0.5 gives U3 ≈ 0.691', () => {
		expect(near(u3(0.5), 0.691, 0.001)).toBe(true);
	});
});

// ── OVL ───────────────────────────────────────────────────────────────────────

describe('ovl', () => {
	it('d=0 gives OVL=1 (complete overlap)', () => {
		expect(near(ovl(0), 1.0)).toBe(true);
	});

	it('large |d| gives very small OVL', () => {
		expect(ovl(4)).toBeLessThan(0.05);
	});

	it('d=0.5 gives OVL ≈ 0.802', () => {
		expect(near(ovl(0.5), 0.802, 0.001)).toBe(true);
	});

	it('symmetric: ovl(d) = ovl(-d)', () => {
		expect(ovl(0.8)).toBeCloseTo(ovl(-0.8), 10);
	});
});

// ── varD and seD ──────────────────────────────────────────────────────────────

describe('varD', () => {
	// Borenstein: d=0.5, n1=50, n2=50
	// Var(d) = 100/(50*50) + 0.25/200 = 0.04 + 0.00125 = 0.04125
	it('Borenstein example', () => {
		expect(near(varD(0.5, 50, 50), 0.04125)).toBe(true);
	});

	it('increases with larger |d|', () => {
		expect(varD(1, 30, 30)).toBeGreaterThan(varD(0.5, 30, 30));
	});

	it('decreases with larger N', () => {
		expect(varD(0.5, 100, 100)).toBeLessThan(varD(0.5, 30, 30));
	});
});

describe('seD', () => {
	it('SE = sqrt(Var)', () => {
		const d = 0.5;
		expect(seD(d, 50, 50)).toBeCloseTo(Math.sqrt(varD(d, 50, 50)), 10);
	});
});

// ── glassDelta ────────────────────────────────────────────────────────────────

describe('glassDelta', () => {
	it('uses control SD only', () => {
		// With equal means: delta = (M1-M2)/SD_control
		expect(glassDelta(55, 50, 10)).toBeCloseTo(0.5, 10);
	});

	it('differs from pooled-SD d when SDs differ', () => {
		const d = dFromMeans(55, 50, 5, 10, 30, 30);
		const delta = glassDelta(55, 50, 10);
		expect(d).not.toBeCloseTo(delta, 2);
	});
});

// ── dToLogOR ──────────────────────────────────────────────────────────────────

describe('dToLogOR', () => {
	// Borenstein: logOR = d * pi / sqrt(3)
	it('d=1 → logOR = pi/sqrt(3) ≈ 1.814', () => {
		expect(near(dToLogOR(1), Math.PI / Math.sqrt(3), 0.001)).toBe(true);
	});

	it('d=0 → logOR=0', () => {
		expect(dToLogOR(0)).toBe(0);
	});

	it('symmetric: dToLogOR(-d) = -dToLogOR(d)', () => {
		expect(dToLogOR(-0.5)).toBeCloseTo(-dToLogOR(0.5), 10);
	});
});

// ── Paired / repeated-measures ────────────────────────────────────────────────

describe('dzFromTPaired', () => {
	// d_z = t / sqrt(n); t=2.5, n=25 → 2.5/5 = 0.5
	it('t=2.5, n=25 → d_z=0.5', () => {
		expect(near(dzFromTPaired(2.5, 25), 0.5)).toBe(true);
	});

	it('t=0 → d_z=0', () => {
		expect(dzFromTPaired(0, 30)).toBe(0);
	});

	it('negative t gives negative d_z', () => {
		expect(dzFromTPaired(-2, 16)).toBeLessThan(0);
	});

	// t=-2, n=16 → -2/4 = -0.5
	it('t=-2, n=16 → d_z=-0.5', () => {
		expect(near(dzFromTPaired(-2, 16), -0.5)).toBe(true);
	});

	it('scales with sqrt(n)', () => {
		// doubling n while halving t keeps |d_z| unchanged if they cancel
		const dz1 = dzFromTPaired(3, 9);  // 3/3 = 1
		const dz2 = dzFromTPaired(4, 16); // 4/4 = 1
		expect(near(dz1, dz2)).toBe(true);
	});
});

describe('dzFromMeansDiff', () => {
	// d_z = M_diff / SD_diff
	it('mDiff=3, sdDiff=6 → d_z=0.5', () => {
		expect(near(dzFromMeansDiff(3, 6), 0.5)).toBe(true);
	});

	it('mDiff=0 → d_z=0', () => {
		expect(dzFromMeansDiff(0, 5)).toBe(0);
	});

	it('negative mDiff gives negative d_z', () => {
		expect(dzFromMeansDiff(-4, 8)).toBeLessThan(0);
	});

	it('mDiff=-4, sdDiff=8 → d_z=-0.5', () => {
		expect(near(dzFromMeansDiff(-4, 8), -0.5)).toBe(true);
	});
});

describe('dsFromDZ', () => {
	// d_s = d_z * sqrt(2*(1-r))
	// r=0.5: d_s = 0.5 * sqrt(1) = 0.5
	it('dz=0.5, r=0.5 → d_s=0.5', () => {
		expect(near(dsFromDZ(0.5, 0.5), 0.5)).toBe(true);
	});

	// r=0: d_s = d_z * sqrt(2) ≈ 0.5 * 1.4142 = 0.7071
	it('dz=0.5, r=0 → d_s=d_z*sqrt(2)', () => {
		expect(near(dsFromDZ(0.5, 0), 0.5 * Math.sqrt(2), 0.001)).toBe(true);
	});

	// r=0.7: d_s = 0.5 * sqrt(0.6) ≈ 0.5 * 0.7746 = 0.3873
	it('dz=0.5, r=0.7 → d_s ≈ 0.387', () => {
		expect(near(dsFromDZ(0.5, 0.7), 0.387, 0.001)).toBe(true);
	});

	it('d_z=0 → d_s=0 for any r', () => {
		expect(dsFromDZ(0, 0.5)).toBe(0);
	});

	// High r means paired design is efficient; d_s > d_z (more spread between persons)
	it('d_s > d_z when r < 0.5', () => {
		expect(dsFromDZ(0.5, 0.3)).toBeGreaterThan(0.5);
	});

	// d_s < d_z when r > 0.5 (less between-person variance)
	it('d_s < d_z when r > 0.5', () => {
		expect(dsFromDZ(0.5, 0.7)).toBeLessThan(0.5);
	});
});

describe('varDZ', () => {
	// Var(d_z) = 1/n + d_z² / (2n)
	// dz=0.5, n=25: 1/25 + 0.25/50 = 0.04 + 0.005 = 0.045
	it('dz=0.5, n=25 → Var=0.045', () => {
		expect(near(varDZ(0.5, 25), 0.045)).toBe(true);
	});

	it('increases with larger |d_z|', () => {
		expect(varDZ(1, 30)).toBeGreaterThan(varDZ(0.5, 30));
	});

	it('decreases with larger n', () => {
		expect(varDZ(0.5, 100)).toBeLessThan(varDZ(0.5, 25));
	});

	it('d_z=0, n=50 → Var = 1/50 = 0.02', () => {
		expect(near(varDZ(0, 50), 0.02)).toBe(true);
	});
});

describe('seDZ', () => {
	it('SE = sqrt(Var)', () => {
		const dz = 0.5;
		expect(seDZ(dz, 25)).toBeCloseTo(Math.sqrt(varDZ(dz, 25)), 10);
	});

	// SE for dz=0.5, n=25: sqrt(0.045) ≈ 0.2121
	it('dz=0.5, n=25 → SE ≈ 0.212', () => {
		expect(near(seDZ(0.5, 25), 0.212, 0.001)).toBe(true);
	});
});

// ── One-sample conversions ────────────────────────────────────────────────────

describe('dFromMeanOneSample', () => {
	// d = (M - mu0) / SD
	it('M=105, mu0=100, SD=10 → d=0.5', () => {
		expect(near(dFromMeanOneSample(105, 100, 10), 0.5)).toBe(true);
	});

	it('M=mu0 → d=0', () => {
		expect(dFromMeanOneSample(100, 100, 10)).toBe(0);
	});

	it('M < mu0 gives negative d', () => {
		expect(dFromMeanOneSample(90, 100, 10)).toBeLessThan(0);
	});

	// M=90, mu0=100, SD=10 → d=-1
	it('M=90, mu0=100, SD=10 → d=-1', () => {
		expect(near(dFromMeanOneSample(90, 100, 10), -1.0)).toBe(true);
	});

	// Larger SD → smaller d (same mean difference)
	it('larger SD gives smaller |d|', () => {
		const d1 = dFromMeanOneSample(110, 100, 10);
		const d2 = dFromMeanOneSample(110, 100, 20);
		expect(Math.abs(d1)).toBeGreaterThan(Math.abs(d2));
	});
});

describe('hedgesJOneSample', () => {
	// J = 1 - 3 / (4*(n-1) - 1) = 1 - 3/(4n-5)
	// n=10: J = 1 - 3/(40-5) = 1 - 3/35 ≈ 0.9143
	it('n=10 → J ≈ 0.914', () => {
		expect(near(hedgesJOneSample(10), 0.9143, 0.001)).toBe(true);
	});

	it('large n → J ≈ 1', () => {
		expect(near(hedgesJOneSample(1000), 1.0, 0.001)).toBe(true);
	});

	it('J < 1 for small n (correction shrinks estimate)', () => {
		expect(hedgesJOneSample(10)).toBeLessThan(1);
	});

	// One-sample J uses df=n-1, so it differs from independent-sample J at same n
	// hedgesJ(n, n) uses df=2n-2; hedgesJOneSample(2n) uses df=2n-1
	// For n=20: hedgesJOneSample(20) = 1 - 3/(4*19-1) = 1 - 3/75 = 0.96
	it('n=20 → J = 1 - 3/75 ≈ 0.96', () => {
		expect(near(hedgesJOneSample(20), 1 - 3 / 75, 0.001)).toBe(true);
	});
});

describe('rFromDOneSample', () => {
	// r = t / sqrt(t² + df); t = d*sqrt(n), df = n-1
	// d=0.5, n=25: t=0.5*5=2.5, df=24; r = 2.5/sqrt(6.25+24) = 2.5/sqrt(30.25) = 2.5/5.5 ≈ 0.4545
	it('d=0.5, n=25 → r ≈ 0.455', () => {
		expect(near(rFromDOneSample(0.5, 25), 0.4545, 0.001)).toBe(true);
	});

	it('d=0 → r=0', () => {
		expect(rFromDOneSample(0, 30)).toBe(0);
	});

	it('negative d gives negative r', () => {
		expect(rFromDOneSample(-0.5, 25)).toBeLessThan(0);
	});

	it('r is always in (-1, 1)', () => {
		for (const d of [-3, -1, -0.5, 0, 0.5, 1, 3]) {
			const r = rFromDOneSample(d, 30);
			expect(r).toBeGreaterThan(-1);
			expect(r).toBeLessThan(1);
		}
	});

	// As n → ∞, r converges to d/sqrt(d²+1) (df/n → 1)
	it('r converges to d/sqrt(d²+1) for large n', () => {
		const d = 0.5;
		const limit = d / Math.sqrt(d ** 2 + 1);
		expect(near(rFromDOneSample(d, 100000), limit, 0.001)).toBe(true);
	});
});
