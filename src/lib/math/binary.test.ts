/**
 * Unit tests for Family 4 binary outcome formulas.
 *
 * Reference table (hand-computed):
 *   Treatment: a=30, b=70  (n1=100, p1=0.30)
 *   Control:   c=20, d=80  (n2=100, p2=0.20)
 *
 *   OR  = (30·80)/(70·20) = 2400/1400 ≈ 1.7143
 *   lnOR= ln(1.7143) ≈ 0.5390
 *   SE  = √(1/30+1/70+1/20+1/80) = √(0.03333+0.01429+0.05+0.0125) ≈ 0.3318
 *   CI  = exp(0.5390 ± 1.96·0.3318) = [exp(-0.1114), exp(1.1894)] ≈ [0.895, 3.284]
 *
 *   RR  = (30/100)/(20/100) = 1.50
 *   lnRR= ln(1.5) ≈ 0.4055
 *   SE_RR = √(70/(30·100) + 80/(20·100)) = √(0.02333+0.04) ≈ 0.2516
 *   CI_RR = exp(0.4055 ± 1.96·0.2516) = [exp(-0.0876), exp(0.8986)] ≈ [0.916, 2.457]
 *
 *   RD  = 0.30 - 0.20 = 0.10
 *   SE_RD = √(0.30·0.70/100 + 0.20·0.80/100) = √(0.0021+0.0016) = √0.0037 ≈ 0.0608
 *   CI_RD = [0.10 - 1.96·0.0608, 0.10 + 1.96·0.0608] ≈ [-0.019, 0.219]
 *
 *   NNT = 1/0.10 = 10
 *
 *   phi = (30·80 - 70·20)/√(100·100·50·150)
 *       = (2400-1400)/√75000000 = 1000/8660.3 ≈ 0.1155
 *
 * Validated against R: epitools::oddsratio(), epitools::riskratio()
 *
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import {
	hasZeroCell,
	applyHaldane,
	oddsRatio,
	logOddsRatio,
	seLogOR,
	ciOR,
	riskRatio,
	logRiskRatio,
	seLogRR,
	ciRR,
	riskDifference,
	seRD,
	ciRD,
	nnt,
	phiCoefficient,
	dToLogOR,
	logORToD
} from './binary.js';

function near(a: number, b: number, tol = 0.001): boolean {
	return Math.abs(a - b) <= tol;
}

// Reference cells
const A = 30, B = 70, C = 20, D = 80;

// ── hasZeroCell ───────────────────────────────────────────────────────────────

describe('hasZeroCell', () => {
	it('returns false for all-positive cells', () => {
		expect(hasZeroCell(A, B, C, D)).toBe(false);
	});
	it('returns true when a = 0', () => {
		expect(hasZeroCell(0, B, C, D)).toBe(true);
	});
	it('returns true when any cell = 0', () => {
		expect(hasZeroCell(A, 0, C, D)).toBe(true);
		expect(hasZeroCell(A, B, 0, D)).toBe(true);
		expect(hasZeroCell(A, B, C, 0)).toBe(true);
	});
});

// ── applyHaldane ──────────────────────────────────────────────────────────────

describe('applyHaldane', () => {
	it('adds 0.5 to every cell', () => {
		const [a2, b2, c2, d2] = applyHaldane(A, B, C, D);
		expect(a2).toBe(A + 0.5);
		expect(b2).toBe(B + 0.5);
		expect(c2).toBe(C + 0.5);
		expect(d2).toBe(D + 0.5);
	});
	it('makes zero cells positive', () => {
		const [a2] = applyHaldane(0, B, C, D);
		expect(a2).toBe(0.5);
	});
});

// ── oddsRatio ─────────────────────────────────────────────────────────────────

describe('oddsRatio', () => {
	it('computes OR = (a·d)/(b·c)', () => {
		expect(near(oddsRatio(A, B, C, D), (A * D) / (B * C))).toBe(true);
	});
	it('reference: OR ≈ 1.714', () => {
		expect(near(oddsRatio(A, B, C, D), 1.7143, 0.001)).toBe(true);
	});
	it('equal groups → OR = 1', () => {
		expect(oddsRatio(50, 50, 50, 50)).toBe(1);
	});
	it('OR > 1 when group 1 has higher event rate', () => {
		expect(oddsRatio(40, 60, 20, 80)).toBeGreaterThan(1);
	});
	it('OR < 1 when group 1 has lower event rate', () => {
		expect(oddsRatio(20, 80, 40, 60)).toBeLessThan(1);
	});
	it('is reciprocal when rows swapped', () => {
		const or1 = oddsRatio(A, B, C, D);
		const or2 = oddsRatio(C, D, A, B);
		expect(near(or1 * or2, 1, 0.0001)).toBe(true);
	});
});

// ── logOddsRatio ──────────────────────────────────────────────────────────────

describe('logOddsRatio', () => {
	it('reference: logOR ≈ 0.539', () => {
		expect(near(logOddsRatio(A, B, C, D), 0.5390, 0.001)).toBe(true);
	});
	it('equal groups → logOR = 0', () => {
		expect(logOddsRatio(50, 50, 50, 50)).toBe(0);
	});
	it('logOR = ln(OR)', () => {
		expect(logOddsRatio(A, B, C, D)).toBeCloseTo(Math.log(oddsRatio(A, B, C, D)), 10);
	});
	it('sign flips when rows swapped', () => {
		expect(near(logOddsRatio(A, B, C, D) + logOddsRatio(C, D, A, B), 0, 1e-10)).toBe(true);
	});
});

// ── seLogOR ───────────────────────────────────────────────────────────────────

describe('seLogOR', () => {
	it('reference: SE ≈ 0.332', () => {
		expect(near(seLogOR(A, B, C, D), 0.3318, 0.001)).toBe(true);
	});
	it('SE = sqrt(1/a + 1/b + 1/c + 1/d)', () => {
		const expected = Math.sqrt(1/A + 1/B + 1/C + 1/D);
		expect(seLogOR(A, B, C, D)).toBeCloseTo(expected, 10);
	});
	it('larger cells → smaller SE', () => {
		expect(seLogOR(60, 140, 40, 160)).toBeLessThan(seLogOR(A, B, C, D));
	});
});

// ── ciOR ─────────────────────────────────────────────────────────────────────

describe('ciOR', () => {
	it('reference: CI ≈ [0.895, 3.284]', () => {
		const [lo, hi] = ciOR(A, B, C, D);
		expect(near(lo, 0.895, 0.005)).toBe(true);
		expect(near(hi, 3.284, 0.010)).toBe(true);
	});
	it('CI contains the point estimate', () => {
		const or = oddsRatio(A, B, C, D);
		const [lo, hi] = ciOR(A, B, C, D);
		expect(lo).toBeLessThan(or);
		expect(hi).toBeGreaterThan(or);
	});
	it('lower bound is positive', () => {
		const [lo] = ciOR(A, B, C, D);
		expect(lo).toBeGreaterThan(0);
	});
	it('CI width shrinks with larger N', () => {
		const w1 = Math.log(ciOR(A, B, C, D)[1]) - Math.log(ciOR(A, B, C, D)[0]);
		const w2 = Math.log(ciOR(60, 140, 40, 160)[1]) - Math.log(ciOR(60, 140, 40, 160)[0]);
		expect(w2).toBeLessThan(w1);
	});
});

// ── riskRatio ─────────────────────────────────────────────────────────────────

describe('riskRatio', () => {
	it('reference: RR = 1.5', () => {
		expect(near(riskRatio(A, B, C, D), 1.5, 0.001)).toBe(true);
	});
	it('RR = (a/n1) / (c/n2)', () => {
		expect(riskRatio(A, B, C, D)).toBeCloseTo((A / (A+B)) / (C / (C+D)), 10);
	});
	it('equal proportions → RR = 1', () => {
		expect(riskRatio(30, 70, 30, 70)).toBe(1);
	});
	it('RR < OR when event is common (> 10%)', () => {
		expect(riskRatio(A, B, C, D)).toBeLessThan(oddsRatio(A, B, C, D));
	});
	it('RR ≈ OR when event is rare (p < 5%)', () => {
		// p1=0.02, p2=0.01; OR and RR should be close
		const or = oddsRatio(2, 98, 1, 99);
		const rr = riskRatio(2, 98, 1, 99);
		expect(Math.abs(or - rr) / rr).toBeLessThan(0.05);
	});
});

// ── seLogRR ───────────────────────────────────────────────────────────────────

describe('seLogRR', () => {
	it('reference: SE(logRR) ≈ 0.252', () => {
		expect(near(seLogRR(A, B, C, D), 0.2516, 0.001)).toBe(true);
	});
	it('SE(logRR) = sqrt(b/(a·n1) + d/(c·n2))', () => {
		const n1 = A+B, n2 = C+D;
		const expected = Math.sqrt(B/(A*n1) + D/(C*n2));
		expect(seLogRR(A, B, C, D)).toBeCloseTo(expected, 10);
	});
	it('SE(logRR) < SE(logOR) for the same table', () => {
		expect(seLogRR(A, B, C, D)).toBeLessThan(seLogOR(A, B, C, D));
	});
});

// ── ciRR ──────────────────────────────────────────────────────────────────────

describe('ciRR', () => {
	it('reference: CI ≈ [0.916, 2.457]', () => {
		const [lo, hi] = ciRR(A, B, C, D);
		expect(near(lo, 0.916, 0.005)).toBe(true);
		expect(near(hi, 2.457, 0.010)).toBe(true);
	});
	it('CI contains the point estimate', () => {
		const rr = riskRatio(A, B, C, D);
		const [lo, hi] = ciRR(A, B, C, D);
		expect(lo).toBeLessThan(rr);
		expect(hi).toBeGreaterThan(rr);
	});
});

// ── riskDifference ────────────────────────────────────────────────────────────

describe('riskDifference', () => {
	it('reference: RD = 0.10', () => {
		expect(near(riskDifference(A, B, C, D), 0.10, 0.001)).toBe(true);
	});
	it('RD = p1 - p2', () => {
		expect(riskDifference(A, B, C, D)).toBeCloseTo(A/(A+B) - C/(C+D), 10);
	});
	it('equal proportions → RD = 0', () => {
		expect(riskDifference(30, 70, 30, 70)).toBe(0);
	});
	it('RD is antisymmetric: swapping rows negates it', () => {
		expect(riskDifference(A, B, C, D)).toBeCloseTo(-riskDifference(C, D, A, B), 10);
	});
});

// ── seRD ─────────────────────────────────────────────────────────────────────

describe('seRD', () => {
	it('reference: SE(RD) ≈ 0.061', () => {
		expect(near(seRD(A, B, C, D), 0.0608, 0.001)).toBe(true);
	});
	it('SE(RD) = sqrt(p1(1-p1)/n1 + p2(1-p2)/n2)', () => {
		const p1 = A/(A+B), p2 = C/(C+D);
		const expected = Math.sqrt(p1*(1-p1)/(A+B) + p2*(1-p2)/(C+D));
		expect(seRD(A, B, C, D)).toBeCloseTo(expected, 10);
	});
});

// ── ciRD ──────────────────────────────────────────────────────────────────────

describe('ciRD', () => {
	it('CI contains the point estimate', () => {
		const rd = riskDifference(A, B, C, D);
		const [lo, hi] = ciRD(A, B, C, D);
		expect(lo).toBeLessThan(rd);
		expect(hi).toBeGreaterThan(rd);
	});
	it('CI is symmetric around RD', () => {
		const rd = riskDifference(A, B, C, D);
		const [lo, hi] = ciRD(A, B, C, D);
		expect(near(rd - lo, hi - rd, 1e-10)).toBe(true);
	});
});

// ── nnt ───────────────────────────────────────────────────────────────────────

describe('nnt', () => {
	it('reference: NNT = 10 when RD = 0.10', () => {
		expect(near(nnt(0.10)!, 10, 0.001)).toBe(true);
	});
	it('returns null when RD = 0', () => {
		expect(nnt(0)).toBeNull();
	});
	it('NNT is always positive regardless of RD sign', () => {
		expect(nnt(-0.10)!).toBeGreaterThan(0);
	});
	it('larger |RD| → smaller NNT', () => {
		expect(nnt(0.20)!).toBeLessThan(nnt(0.10)!);
	});
	it('NNT = 1/|RD|', () => {
		const rd = 0.15;
		expect(nnt(rd)).toBeCloseTo(1 / rd, 10);
	});
});

// ── phiCoefficient ───────────────────────────────────────────────────────────

describe('phiCoefficient', () => {
	it('reference: phi ≈ 0.1155', () => {
		expect(near(phiCoefficient(A, B, C, D), 0.1155, 0.001)).toBe(true);
	});
	it('equal proportions → phi = 0', () => {
		expect(phiCoefficient(30, 70, 30, 70)).toBe(0);
	});
	it('perfect association → phi = ±1', () => {
		expect(phiCoefficient(100, 0.001, 0.001, 100)).toBeCloseTo(1, 2);
	});
	it('sign is positive when group 1 has higher event rate', () => {
		expect(phiCoefficient(A, B, C, D)).toBeGreaterThan(0);
	});
	it('sign flips when rows swapped', () => {
		expect(phiCoefficient(A, B, C, D)).toBeCloseTo(-phiCoefficient(C, D, A, B), 10);
	});
	it('phi is in [-1, 1]', () => {
		const p = phiCoefficient(A, B, C, D);
		expect(p).toBeGreaterThanOrEqual(-1);
		expect(p).toBeLessThanOrEqual(1);
	});
});

// ── d ↔ logOR conversions ────────────────────────────────────────────────────

describe('dToLogOR', () => {
	it('d=0 → logOR=0', () => {
		expect(dToLogOR(0)).toBe(0);
	});
	it('d=0.5 → logOR ≈ 0.907', () => {
		expect(near(dToLogOR(0.5), 0.5 * Math.PI / Math.sqrt(3), 1e-10)).toBe(true);
	});
	it('roundtrip: logORToD(dToLogOR(d)) = d', () => {
		for (const d of [0.2, 0.5, 0.8]) {
			expect(logORToD(dToLogOR(d))).toBeCloseTo(d, 10);
		}
	});
	it('positive d → positive logOR', () => {
		expect(dToLogOR(0.5)).toBeGreaterThan(0);
	});
});

describe('logORToD', () => {
	it('logOR=0 → d=0', () => {
		expect(logORToD(0)).toBe(0);
	});
	it('is the inverse of dToLogOR', () => {
		const logOR = 1.2;
		expect(dToLogOR(logORToD(logOR))).toBeCloseTo(logOR, 10);
	});
});
