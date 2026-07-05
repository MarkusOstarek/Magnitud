/**
 * Unit tests for Family 2 correlation formulas.
 *
 * Test values validated against:
 *   - Fisher (1915, 1921) — z transformation identities
 *   - R: cor.test(), psych::r.test()
 *   - Hand-computed from definitions
 *
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import {
	rFromT,
	rFromP,
	rFromChi2,
	rFromSlope,
	rFromR2,
	rFromFisherZ,
	fisherZ,
	seFisherZ,
	varFisherZ,
	ciR,
	rToD
} from './correlations.js';

// Helper: check value is within tolerance
function near(a: number, b: number, tol = 0.001): boolean {
	return Math.abs(a - b) <= tol;
}

// ── rFromT ────────────────────────────────────────────────────────────────────

describe('rFromT', () => {
	// r = t / sqrt(t² + df); df = n-2
	// t=2.5, n=30: df=28; r = 2.5/sqrt(6.25+28) = 2.5/sqrt(34.25) ≈ 2.5/5.852 ≈ 0.4272
	it('t=2.5, n=30 → r ≈ 0.427', () => {
		expect(near(rFromT(2.5, 30), 0.4272, 0.001)).toBe(true);
	});

	it('t=0 → r=0', () => {
		expect(rFromT(0, 50)).toBe(0);
	});

	it('negative t gives negative r', () => {
		expect(rFromT(-2, 30)).toBeLessThan(0);
	});

	it('r is always in (-1, 1)', () => {
		for (const t of [-10, -3, -1, 0, 1, 3, 10]) {
			const r = rFromT(t, 50);
			expect(r).toBeGreaterThan(-1);
			expect(r).toBeLessThan(1);
		}
	});

	// Larger df → r approaches sign(t) (large n gives high-precision estimate)
	it('very large n with fixed t gives small r', () => {
		// t=2, n=10000: df=9998; r ≈ 2/sqrt(4+9998) ≈ 2/100 = 0.02
		expect(near(rFromT(2, 10000), 0.02, 0.002)).toBe(true);
	});

	// Symmetry: rFromT(-t, n) = -rFromT(t, n)
	it('antisymmetric in t', () => {
		expect(rFromT(-2.5, 30)).toBeCloseTo(-rFromT(2.5, 30), 10);
	});
});

// ── rFromP ────────────────────────────────────────────────────────────────────

describe('rFromP', () => {
	// Consistency with rFromT: if we compute r from t, the p-value from that t
	// should give back the same r via rFromP.
	it('direction=+1 gives positive r', () => {
		expect(rFromP(0.05, 30, 1)).toBeGreaterThan(0);
	});

	it('direction=-1 gives negative r', () => {
		expect(rFromP(0.05, 30, -1)).toBeLessThan(0);
	});

	// Smaller p → larger |r| for fixed n
	it('smaller p → larger |r|', () => {
		expect(Math.abs(rFromP(0.001, 30, 1))).toBeGreaterThan(Math.abs(rFromP(0.05, 30, 1)));
	});

	// Larger n → smaller |r| for same p (more power means smaller effects are significant)
	it('larger n → smaller |r| for same p', () => {
		expect(Math.abs(rFromP(0.05, 30, 1))).toBeGreaterThan(Math.abs(rFromP(0.05, 300, 1)));
	});

	// Symmetry: rFromP(p, n, -1) = -rFromP(p, n, 1)
	it('direction symmetry', () => {
		expect(rFromP(0.05, 50, -1)).toBeCloseTo(-rFromP(0.05, 50, 1), 10);
	});

	// r is always in (-1, 1)
	it('r in (-1, 1) for valid p', () => {
		const r = rFromP(0.001, 20, 1);
		expect(r).toBeGreaterThan(-1);
		expect(r).toBeLessThan(1);
	});
});

// ── rFromChi2 ─────────────────────────────────────────────────────────────────

describe('rFromChi2', () => {
	// phi = sqrt(chi2/n); chi2=9, n=100 → r=sqrt(0.09)=0.3
	it('chi2=9, n=100 → r=0.3', () => {
		expect(near(rFromChi2(9, 100, 1), 0.3)).toBe(true);
	});

	it('chi2=0 → r=0', () => {
		expect(rFromChi2(0, 50, 1)).toBe(0);
	});

	// direction=-1 negates the result
	it('direction=-1 gives negative r', () => {
		expect(near(rFromChi2(4, 100, -1), -0.2)).toBe(true);
	});

	// chi2=4, n=100: r=sqrt(4/100)=0.2
	it('chi2=4, n=100 → r=0.2', () => {
		expect(near(rFromChi2(4, 100, 1), 0.2)).toBe(true);
	});

	// r is always in [0, 1] for direction=1 (chi2 ≥ 0, n > chi2 for valid phi)
	it('positive chi2 and direction=1 gives positive r', () => {
		expect(rFromChi2(16, 100, 1)).toBeGreaterThan(0);
	});
});

// ── rFromSlope ────────────────────────────────────────────────────────────────

describe('rFromSlope', () => {
	// r = b * (sdx / sdy)
	// b=0.5, sdx=2, sdy=4: r = 0.5 * 0.5 = 0.25
	it('b=0.5, sdx=2, sdy=4 → r=0.25', () => {
		expect(near(rFromSlope(0.5, 2, 4), 0.25)).toBe(true);
	});

	it('b=0 → r=0', () => {
		expect(rFromSlope(0, 3, 5)).toBe(0);
	});

	it('negative b gives negative r', () => {
		expect(rFromSlope(-1, 2, 4)).toBeLessThan(0);
	});

	// Equal SDs: r = b
	it('equal SDs → r = b', () => {
		expect(near(rFromSlope(0.4, 5, 5), 0.4)).toBe(true);
	});

	// b=2, sdx=3, sdy=6: r = 2 * (3/6) = 1.0
	it('b=2, sdx=3, sdy=6 → r=1', () => {
		expect(near(rFromSlope(2, 3, 6), 1.0)).toBe(true);
	});
});

// ── rFromR2 ───────────────────────────────────────────────────────────────────

describe('rFromR2', () => {
	// r = direction * sqrt(r2)
	it('r2=0.25, direction=1 → r=0.5', () => {
		expect(near(rFromR2(0.25, 1), 0.5)).toBe(true);
	});

	it('r2=0.16, direction=-1 → r=-0.4', () => {
		expect(near(rFromR2(0.16, -1), -0.4)).toBe(true);
	});

	it('r2=0 → r=0', () => {
		expect(rFromR2(0, 1)).toBe(0);
	});

	it('r2=1 → r=1 or r=-1 depending on direction', () => {
		expect(near(rFromR2(1, 1), 1.0)).toBe(true);
		expect(near(rFromR2(1, -1), -1.0)).toBe(true);
	});

	// Roundtrip: rFromR2(r², sign) should recover r
	it('roundtrip: rFromR2(r², sign(r)) ≈ r', () => {
		const r = 0.35;
		expect(near(rFromR2(r ** 2, 1), r)).toBe(true);
	});
});

// ── rFromFisherZ ──────────────────────────────────────────────────────────────

describe('rFromFisherZ', () => {
	it('z=0 → r=0', () => {
		expect(rFromFisherZ(0)).toBe(0);
	});

	// tanh(atanh(0.5)) = 0.5
	it('roundtrip: rFromFisherZ(fisherZ(r)) = r', () => {
		for (const r of [-0.7, -0.3, 0, 0.3, 0.7]) {
			expect(rFromFisherZ(Math.atanh(r))).toBeCloseTo(r, 10);
		}
	});

	// z=0.5493: r ≈ tanh(0.5493) ≈ 0.5
	it('z=atanh(0.3) → r=0.3', () => {
		expect(near(rFromFisherZ(Math.atanh(0.3)), 0.3)).toBe(true);
	});

	it('positive z gives positive r', () => {
		expect(rFromFisherZ(0.5)).toBeGreaterThan(0);
	});

	it('negative z gives negative r', () => {
		expect(rFromFisherZ(-0.5)).toBeLessThan(0);
	});
});

// ── fisherZ ───────────────────────────────────────────────────────────────────

describe('fisherZ', () => {
	it('r=0 → z=0', () => {
		expect(fisherZ(0)).toBe(0);
	});

	// atanh(0.5) ≈ 0.5493
	it('r=0.5 → z ≈ 0.549', () => {
		expect(near(fisherZ(0.5), 0.5493, 0.001)).toBe(true);
	});

	it('r=-0.5 → z ≈ -0.549', () => {
		expect(near(fisherZ(-0.5), -0.5493, 0.001)).toBe(true);
	});

	// Roundtrip: fisherZ(rFromFisherZ(z)) = z
	it('roundtrip: fisherZ(rFromFisherZ(z)) = z', () => {
		for (const z of [-1.5, -0.5, 0, 0.5, 1.5]) {
			expect(fisherZ(Math.tanh(z))).toBeCloseTo(z, 10);
		}
	});

	it('antisymmetric: fisherZ(-r) = -fisherZ(r)', () => {
		expect(fisherZ(-0.4)).toBeCloseTo(-fisherZ(0.4), 10);
	});
});

// ── seFisherZ ─────────────────────────────────────────────────────────────────

describe('seFisherZ', () => {
	// SE(z) = 1 / sqrt(n-3)
	it('n=100 → SE = 1/sqrt(97) ≈ 0.1015', () => {
		expect(near(seFisherZ(100), 1 / Math.sqrt(97), 0.0001)).toBe(true);
	});

	// n=28 → 1/sqrt(25) = 0.2
	it('n=28 → SE = 0.2', () => {
		expect(near(seFisherZ(28), 0.2)).toBe(true);
	});

	it('n≤3 → Infinity', () => {
		expect(seFisherZ(3)).toBe(Infinity);
		expect(seFisherZ(2)).toBe(Infinity);
	});

	it('decreases as n increases', () => {
		expect(seFisherZ(100)).toBeLessThan(seFisherZ(30));
	});

	// SE² = Var
	it('SE² = varFisherZ', () => {
		expect(seFisherZ(50) ** 2).toBeCloseTo(varFisherZ(50), 10);
	});
});

// ── varFisherZ ────────────────────────────────────────────────────────────────

describe('varFisherZ', () => {
	// Var(z) = 1/(n-3)
	it('n=100 → Var = 1/97 ≈ 0.01031', () => {
		expect(near(varFisherZ(100), 1 / 97, 0.0001)).toBe(true);
	});

	it('n=28 → Var = 1/25 = 0.04', () => {
		expect(near(varFisherZ(28), 0.04)).toBe(true);
	});

	it('n≤3 → Infinity', () => {
		expect(varFisherZ(3)).toBe(Infinity);
	});

	it('decreases as n increases', () => {
		expect(varFisherZ(100)).toBeLessThan(varFisherZ(30));
	});
});

// ── ciR ───────────────────────────────────────────────────────────────────────

describe('ciR', () => {
	// r=0.5, n=103: SE=1/sqrt(100)=0.1; CI=[tanh(atanh(0.5)-0.196), tanh(atanh(0.5)+0.196)]
	// atanh(0.5)≈0.5493; [tanh(0.3533), tanh(0.7453)] ≈ [0.339, 0.632]
	it('r=0.5, n=103 → CI ≈ [0.339, 0.632]', () => {
		const [lo, hi] = ciR(0.5, 103);
		expect(near(lo, 0.339, 0.002)).toBe(true);
		expect(near(hi, 0.632, 0.002)).toBe(true);
	});

	it('n≤3 → [-1, 1]', () => {
		expect(ciR(0.5, 3)).toEqual([-1, 1]);
		expect(ciR(0.5, 2)).toEqual([-1, 1]);
	});

	// CI is asymmetric around r (tanh transformation)
	it('CI is not symmetric around r', () => {
		const r = 0.5;
		const [lo, hi] = ciR(r, 103);
		expect(r - lo).not.toBeCloseTo(hi - r, 2);
	});

	it('CI contains r', () => {
		const r = 0.3;
		const [lo, hi] = ciR(r, 50);
		expect(lo).toBeLessThan(r);
		expect(hi).toBeGreaterThan(r);
	});

	// r=0: CI should be symmetric around 0
	it('r=0 gives symmetric CI around 0', () => {
		const [lo, hi] = ciR(0, 100);
		expect(lo).toBeCloseTo(-hi, 10);
	});

	it('wider CI for smaller n', () => {
		const r = 0.4;
		const [lo1, hi1] = ciR(r, 20);
		const [lo2, hi2] = ciR(r, 200);
		expect(hi1 - lo1).toBeGreaterThan(hi2 - lo2);
	});
});

// ── rToD ──────────────────────────────────────────────────────────────────────

describe('rToD', () => {
	// d = 2r / sqrt(1-r²)
	it('r=0 → d=0', () => {
		expect(rToD(0)).toBe(0);
	});

	// r=0.5: d = 1/sqrt(0.75) ≈ 1.1547
	it('r=0.5 → d ≈ 1.155', () => {
		expect(near(rToD(0.5), 1.1547, 0.001)).toBe(true);
	});

	it('negative r gives negative d', () => {
		expect(rToD(-0.3)).toBeLessThan(0);
	});

	it('antisymmetric: rToD(-r) = -rToD(r)', () => {
		expect(rToD(-0.4)).toBeCloseTo(-rToD(0.4), 10);
	});

	// Borenstein et al. (2009), eq. 7.5 roundtrip:
	// rFromD(d, n, n) ≈ r for equal groups (a=4)
	// rFromD(2r/√(1-r²)) = r/√(r²/(1-r²) + 1) = r/√(1/(1-r²)) = r√(1-r²) ...
	// Actually the exact roundtrip: rFromD(d, n, n) uses a=(2n)²/(n²)=4
	// r = d/√(d²+4); d=2r/√(1-r²); d²=4r²/(1-r²)
	// d²+4 = 4r²/(1-r²) + 4 = 4(r²+1-r²)/(1-r²) = 4/(1-r²)
	// → r/√(d²+4) = r/√(4/(1-r²)) = r√(1-r²)/2 ≠ r unless r→0
	// Wait, rFromD(d,n,n) = d/√(d²+4):
	// = [2r/√(1-r²)] / √[4r²/(1-r²)+4]
	// = [2r/√(1-r²)] / [2/√(1-r²)]
	// = r ✓ — roundtrip holds for equal groups!
	it('roundtrip with rFromD (equal groups)', () => {
		for (const r of [-0.5, -0.3, 0, 0.3, 0.5]) {
			const d = rToD(r);
			const a = 4; // equal groups
			const rBack = d / Math.sqrt(d ** 2 + a);
			expect(rBack).toBeCloseTo(r, 10);
		}
	});

	// r=0.3: d = 0.6/sqrt(1-0.09) = 0.6/sqrt(0.91) ≈ 0.6/0.9539 ≈ 0.6293
	it('r=0.3 → d ≈ 0.629', () => {
		expect(near(rToD(0.3), 0.6293, 0.001)).toBe(true);
	});
});
