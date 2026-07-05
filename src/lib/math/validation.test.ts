import { describe, it, expect } from 'vitest';
import {
	validateSampleSize,
	validateFinite,
	validateSD,
	validatePValue,
	validateF,
	validateRPaired,
	validateFamily1
} from './validation.js';

// ── Field validators ──────────────────────────────────────────────────────────

describe('validateSampleSize', () => {
	it('flags empty input as required', () => {
		expect(validateSampleSize('', 'n1')?.message).toBe('Required');
	});
	it('rejects non-integers', () => {
		expect(validateSampleSize('2.5', 'n1')).not.toBeNull();
	});
	it('rejects n < 2', () => {
		expect(validateSampleSize('1', 'n1')).not.toBeNull();
	});
	it('accepts a valid sample size', () => {
		expect(validateSampleSize('30', 'n1')).toBeNull();
	});
	it('reports the field name', () => {
		expect(validateSampleSize('', 'nPairs')?.field).toBe('nPairs');
	});
});

describe('validateFinite', () => {
	it('flags empty input as required', () => {
		expect(validateFinite('', 't')?.message).toBe('Required');
	});
	it('accepts negative numbers', () => {
		expect(validateFinite('-2.7', 't')).toBeNull();
	});
	it('enforces a minimum when given', () => {
		expect(validateFinite('-1', 'x', 0)).not.toBeNull();
		expect(validateFinite('1', 'x', 0)).toBeNull();
	});
	it('enforces a maximum when given', () => {
		expect(validateFinite('2', 'x', undefined, 1)).not.toBeNull();
	});
});

describe('validateSD', () => {
	it('rejects zero and negatives', () => {
		expect(validateSD('0', 'sd1')).not.toBeNull();
		expect(validateSD('-1', 'sd1')).not.toBeNull();
	});
	it('accepts positive SDs', () => {
		expect(validateSD('9.1', 'sd1')).toBeNull();
	});
});

describe('validatePValue', () => {
	it('rejects the boundaries 0 and 1', () => {
		expect(validatePValue('0')).not.toBeNull();
		expect(validatePValue('1')).not.toBeNull();
	});
	it('accepts p strictly between 0 and 1', () => {
		expect(validatePValue('0.031')).toBeNull();
	});
});

describe('validateF', () => {
	it('rejects negative F', () => {
		expect(validateF('-1')).not.toBeNull();
	});
	it('accepts zero and positive F', () => {
		expect(validateF('0')).toBeNull();
		expect(validateF('7.51')).toBeNull();
	});
});

describe('validateRPaired', () => {
	it('treats empty input as valid (optional field)', () => {
		expect(validateRPaired('')).toBeNull();
	});
	it('rejects |r| ≥ 1', () => {
		expect(validateRPaired('1')).not.toBeNull();
		expect(validateRPaired('-1')).not.toBeNull();
	});
	it('accepts r strictly inside (−1, 1)', () => {
		expect(validateRPaired('0.65')).toBeNull();
		expect(validateRPaired('-0.99')).toBeNull();
	});
});

// ── validateFamily1 (whole-form validation) ───────────────────────────────────

describe('validateFamily1', () => {
	it('passes a complete independent-samples t input', () => {
		const errors = validateFamily1('t', { t: '2.74', n1: '80', n2: '85' }, 1);
		expect(errors).toEqual([]);
	});

	it('requires both group sizes for independent designs', () => {
		const errors = validateFamily1('t', { t: '2.74', n1: '80', n2: '' }, 1);
		expect(errors.map((e) => e.field)).toContain('n2');
	});

	it('requires all four means/SD fields for independent means input', () => {
		const errors = validateFamily1(
			'means',
			{ m1: '52.4', m2: '48.0', sd1: '9.1', sd2: '', n1: '40', n2: '40' },
			1
		);
		expect(errors.map((e) => e.field)).toEqual(['sd2']);
	});

	it('rejects a non-positive SD in means input', () => {
		const errors = validateFamily1(
			'means',
			{ m1: '52.4', m2: '48.0', sd1: '0', sd2: '10.3', n1: '40', n2: '40' },
			1
		);
		expect(errors.map((e) => e.field)).toContain('sd1');
	});

	it('validates paired designs against nPairs, not n1/n2', () => {
		const errors = validateFamily1('t', { t: '3.1', nPairs: '40', rPaired: '' }, 1, 'paired');
		expect(errors).toEqual([]);
	});

	it('flags an out-of-range paired correlation', () => {
		const errors = validateFamily1('t', { t: '3.1', nPairs: '40', rPaired: '1.2' }, 1, 'paired');
		expect(errors.map((e) => e.field)).toContain('rPaired');
	});

	it('requires mean, reference value, and SD for one-sample means input', () => {
		const errors = validateFamily1(
			'means',
			{ m1: '52.4', mu0: '', sd1: '12', nPairs: '45' },
			1,
			'one-sample'
		);
		expect(errors.map((e) => e.field)).toEqual(['mu0']);
	});

	it('rejects an invalid p-value in any design', () => {
		const errors = validateFamily1('p', { p: '1.2', n1: '30', n2: '30' }, 1);
		expect(errors.map((e) => e.field)).toContain('p');
	});
});
