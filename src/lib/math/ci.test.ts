import { describe, it, expect } from 'vitest';
import { ciD, ciG, ciR } from './ci.js';

// ── ciD ───────────────────────────────────────────────────────────────────────

describe('ciD', () => {
	it('is centred on d with half-width 1.96·SE', () => {
		const [lo, hi] = ciD(0.5, 0.1);
		expect(lo).toBeCloseTo(0.5 - 1.96 * 0.1, 10);
		expect(hi).toBeCloseTo(0.5 + 1.96 * 0.1, 10);
	});

	it('is symmetric around zero for d = 0', () => {
		const [lo, hi] = ciD(0, 0.2);
		expect(lo).toBeCloseTo(-hi, 10);
	});

	it('handles negative d', () => {
		const [lo, hi] = ciD(-0.8, 0.15);
		expect(lo).toBeCloseTo(-0.8 - 1.96 * 0.15, 10);
		expect(hi).toBeCloseTo(-0.8 + 1.96 * 0.15, 10);
	});
});

// ── ciG ───────────────────────────────────────────────────────────────────────

describe('ciG', () => {
	it('is centred on g with half-width 1.96·SE(g)', () => {
		const [lo, hi] = ciG(0.49, 0.09);
		expect(lo).toBeCloseTo(0.49 - 1.96 * 0.09, 10);
		expect(hi).toBeCloseTo(0.49 + 1.96 * 0.09, 10);
	});
});

// ── ciR ───────────────────────────────────────────────────────────────────────

describe('ciR', () => {
	it('matches the Fisher-z CI for r = .5, N = 100', () => {
		// z = atanh(.5) = 0.5493, SE = 1/sqrt(97) = 0.10153
		// CI_r = [tanh(0.3503), tanh(0.7483)] ≈ [0.3369, 0.6337]
		const [lo, hi] = ciR(0.5, 100);
		expect(lo).toBeCloseTo(0.3369, 3);
		expect(hi).toBeCloseTo(0.6337, 3);
	});

	it('is symmetric around zero for r = 0', () => {
		const [lo, hi] = ciR(0, 50);
		expect(lo).toBeCloseTo(-hi, 10);
		expect(lo).toBeLessThan(0);
		expect(hi).toBeGreaterThan(0);
	});

	it('stays inside (−1, 1) even for extreme r', () => {
		const [lo, hi] = ciR(0.99, 10);
		expect(lo).toBeGreaterThan(-1);
		expect(hi).toBeLessThan(1);
	});

	it('returns the full range when N ≤ 3', () => {
		expect(ciR(0.5, 3)).toEqual([-1, 1]);
		expect(ciR(0.5, 2)).toEqual([-1, 1]);
	});

	it('narrows as N grows', () => {
		const [lo1, hi1] = ciR(0.3, 20);
		const [lo2, hi2] = ciR(0.3, 2000);
		expect(hi2 - lo2).toBeLessThan(hi1 - lo1);
	});
});
