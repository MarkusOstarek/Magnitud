/**
 * Unit tests for Family 3 variance-explained formulas.
 *
 * Test values validated against:
 *   - Cohen (1988) f thresholds
 *   - Hand-computed from definitions
 *   - R: effectsize::eta_squared(), effectsize::omega_squared()
 *
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import {
	partialEta2FromF,
	omega2FromF,
	cohensF,
	cohensFSq,
	eta2FromCohensF
} from './variance.js';

function near(a: number, b: number, tol = 0.001): boolean {
	return Math.abs(a - b) <= tol;
}

// ── partialEta2FromF ──────────────────────────────────────────────────────────

describe('partialEta2FromF', () => {
	// partial η² = F·dfNum / (F·dfNum + dfDen)
	// F=4, dfNum=2, dfDen=57: 8 / (8+57) = 8/65 ≈ 0.1231
	it('F=4, dfNum=2, dfDen=57 → partial η² ≈ 0.123', () => {
		expect(near(partialEta2FromF(4, 2, 57), 0.1231, 0.001)).toBe(true);
	});

	it('F=0 → partial η² = 0', () => {
		expect(partialEta2FromF(0, 2, 57)).toBe(0);
	});

	it('larger F → larger partial η²', () => {
		expect(partialEta2FromF(8, 2, 57)).toBeGreaterThan(partialEta2FromF(4, 2, 57));
	});

	it('partial η² is always in [0, 1)', () => {
		for (const F of [0, 1, 5, 10, 100]) {
			const v = partialEta2FromF(F, 2, 50);
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	// For one-way ANOVA, partial η² = η²:
	// With F=4, dfNum=2, dfDen=57 (3 groups, n=20 each, N=60):
	// This can be verified via R: effectsize::eta_squared()
	it('equals η² for one-way ANOVA (known result)', () => {
		// F=10, dfNum=1, dfDen=28: 10/(10+28) ≈ 0.2632
		expect(near(partialEta2FromF(10, 1, 28), 0.2632, 0.001)).toBe(true);
	});

	it('larger dfDen → smaller partial η² for same F', () => {
		expect(partialEta2FromF(5, 2, 100)).toBeLessThan(partialEta2FromF(5, 2, 30));
	});
});

// ── omega2FromF ───────────────────────────────────────────────────────────────

describe('omega2FromF', () => {
	// ω² = dfNum*(F-1) / (F*dfNum + dfDen + 1)
	// F=4, dfNum=2, dfDen=57: 2*3/(8+57+1) = 6/66 ≈ 0.0909
	it('F=4, dfNum=2, dfDen=57 → ω² ≈ 0.091', () => {
		expect(near(omega2FromF(4, 2, 57), 0.0909, 0.001)).toBe(true);
	});

	// ω² < η² for the same data (bias correction makes it more conservative)
	it('ω² < partial η² for same inputs', () => {
		expect(omega2FromF(4, 2, 57)).toBeLessThan(partialEta2FromF(4, 2, 57));
	});

	// F ≤ 1 → ω² = 0 (floored)
	it('F=1 → ω² = 0', () => {
		expect(omega2FromF(1, 2, 57)).toBe(0);
	});

	it('F < 1 → ω² = 0 (floored, not negative)', () => {
		expect(omega2FromF(0.5, 2, 30)).toBe(0);
	});

	it('F=0 → ω² = 0', () => {
		expect(omega2FromF(0, 2, 57)).toBe(0);
	});

	it('increases with larger F', () => {
		expect(omega2FromF(10, 2, 57)).toBeGreaterThan(omega2FromF(4, 2, 57));
	});

	it('decreases with larger dfDen for same F', () => {
		expect(omega2FromF(5, 2, 200)).toBeLessThan(omega2FromF(5, 2, 30));
	});

	// Note: N = dfNum + dfDen + 1 (total sample size for one-way)
	// F=4, dfNum=2, dfDen=57 → N=60, k=3
	// Manual check: ω² = 2*(4-1)/(4*2+57+1) = 6/66 = 1/11 ≈ 0.0909
	it('manual calculation for one-way 3-group design', () => {
		expect(near(omega2FromF(4, 2, 57), 6 / 66)).toBe(true);
	});
});

// ── cohensF ───────────────────────────────────────────────────────────────────

describe('cohensF', () => {
	// f = sqrt(η² / (1-η²))
	// η²=0.0625: f = sqrt(0.0625/0.9375) = sqrt(1/15) ≈ 0.2582
	// Cohen medium threshold: f=0.25 → η²=0.25²/(1+0.25²)=0.0625/1.0625≈0.0588
	// So η²=0.06 → f≈0.2530
	it('η²=0.0625 → f ≈ 0.258', () => {
		expect(near(cohensF(0.0625), Math.sqrt(0.0625 / 0.9375), 0.001)).toBe(true);
	});

	// Cohen's small threshold: f=0.10 → η²=0.01/(1.01)≈0.0099
	it('η²≈0.01 → f ≈ 0.10 (Cohen small)', () => {
		expect(near(cohensF(0.01 / 1.01), 0.10, 0.001)).toBe(true);
	});

	// Cohen's medium threshold: f=0.25 → η²=0.0625/1.0625
	it('η²=0.0625/1.0625 → f = 0.25 (Cohen medium)', () => {
		expect(near(cohensF(0.0625 / 1.0625), 0.25, 0.001)).toBe(true);
	});

	// Cohen's large threshold: f=0.40 → η²=0.16/1.16
	it('η²=0.16/1.16 → f = 0.40 (Cohen large)', () => {
		expect(near(cohensF(0.16 / 1.16), 0.40, 0.001)).toBe(true);
	});

	it('η²=0 → f=0', () => {
		expect(cohensF(0)).toBe(0);
	});

	it('increases monotonically with η²', () => {
		expect(cohensF(0.2)).toBeGreaterThan(cohensF(0.1));
	});

	it('η²→1 → f grows very large', () => {
		// cohensF(0.9999) = sqrt(0.9999/0.0001) = sqrt(9999) ≈ 99.995
		expect(cohensF(0.9999)).toBeGreaterThan(50);
		expect(cohensF(0.99999)).toBeGreaterThan(300);
	});

	// Roundtrip: cohensF(eta2FromCohensF(f)) ≈ f
	it('roundtrip: cohensF(eta2FromCohensF(f)) ≈ f', () => {
		for (const f of [0.10, 0.25, 0.40, 0.80]) {
			expect(cohensF(eta2FromCohensF(f))).toBeCloseTo(f, 10);
		}
	});
});

// ── cohensFSq ─────────────────────────────────────────────────────────────────

describe('cohensFSq', () => {
	// f² = η² / (1-η²)
	it('η²=0 → f²=0', () => {
		expect(cohensFSq(0)).toBe(0);
	});

	it('η²=0.5 → f²=1', () => {
		expect(near(cohensFSq(0.5), 1.0)).toBe(true);
	});

	// f² = f² — consistency with cohensF
	it('f² = (cohensF)²', () => {
		const eta2 = 0.12;
		expect(cohensFSq(eta2)).toBeCloseTo(cohensF(eta2) ** 2, 10);
	});

	// Cohen thresholds for f²: small=.02, medium=.15, large=.35
	it('f²=0.02 corresponds to f≈0.141 (small)', () => {
		const f2 = 0.02;
		const f = Math.sqrt(f2);
		expect(near(cohensFSq(eta2FromCohensF(f)), f2, 0.001)).toBe(true);
	});

	it('increases with η²', () => {
		expect(cohensFSq(0.2)).toBeGreaterThan(cohensFSq(0.1));
	});
});

// ── eta2FromCohensF ───────────────────────────────────────────────────────────

describe('eta2FromCohensF', () => {
	// η² = f² / (1+f²)
	it('f=0 → η²=0', () => {
		expect(eta2FromCohensF(0)).toBe(0);
	});

	it('f=1 → η²=0.5', () => {
		expect(near(eta2FromCohensF(1), 0.5)).toBe(true);
	});

	// Cohen small: f=0.10 → η² = 0.01/1.01 ≈ 0.0099
	it('f=0.10 → η² ≈ 0.0099 (small)', () => {
		expect(near(eta2FromCohensF(0.10), 0.01 / 1.01, 0.0001)).toBe(true);
	});

	// Cohen medium: f=0.25 → η² = 0.0625/1.0625 ≈ 0.0588
	it('f=0.25 → η² ≈ 0.059 (medium)', () => {
		expect(near(eta2FromCohensF(0.25), 0.0588, 0.001)).toBe(true);
	});

	// Cohen large: f=0.40 → η² = 0.16/1.16 ≈ 0.1379
	it('f=0.40 → η² ≈ 0.138 (large)', () => {
		expect(near(eta2FromCohensF(0.40), 0.1379, 0.001)).toBe(true);
	});

	it('η² is always in [0, 1)', () => {
		for (const f of [0, 0.1, 0.5, 1, 2, 5]) {
			const v = eta2FromCohensF(f);
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it('increases monotonically with f', () => {
		expect(eta2FromCohensF(0.5)).toBeGreaterThan(eta2FromCohensF(0.25));
	});
});
