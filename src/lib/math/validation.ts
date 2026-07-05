import type { ValidationError, Family1InputType, EffectDirection, DesignType } from '../types/effects.js';
import { parseNumber } from './conversions.js';

/**
 * Validate a sample size string.
 * Must be a positive integer (or at least a positive number ≥ 2).
 */
export function validateSampleSize(value: string, field: string): ValidationError | null {
	const n = parseNumber(value);
	if (n === null) return { field, message: 'Required' };
	if (!Number.isInteger(n) || n < 2) return { field, message: 'Must be a whole number ≥ 2' };
	return null;
}

/**
 * Validate that a number is a finite real number (optional range check).
 */
export function validateFinite(
	value: string,
	field: string,
	min?: number,
	max?: number
): ValidationError | null {
	const n = parseNumber(value);
	if (n === null) return { field, message: 'Required' };
	if (!isFinite(n)) return { field, message: 'Must be a finite number' };
	if (min !== undefined && n < min) return { field, message: `Must be ≥ ${min}` };
	if (max !== undefined && n > max) return { field, message: `Must be ≤ ${max}` };
	return null;
}

/**
 * Validate a standard deviation (must be > 0).
 */
export function validateSD(value: string, field: string): ValidationError | null {
	const n = parseNumber(value);
	if (n === null) return { field, message: 'Required' };
	if (n <= 0) return { field, message: 'Must be > 0' };
	return null;
}

/**
 * Validate a p-value (must be 0 < p < 1).
 */
export function validatePValue(value: string): ValidationError | null {
	const p = parseNumber(value);
	if (p === null) return { field: 'p', message: 'Required' };
	if (p <= 0 || p >= 1) return { field: 'p', message: 'Must be between 0 and 1 (exclusive)' };
	return null;
}

/**
 * Validate an F-statistic (must be ≥ 0).
 */
export function validateF(value: string): ValidationError | null {
	const F = parseNumber(value);
	if (F === null) return { field: 'f', message: 'Required' };
	if (F < 0) return { field: 'f', message: 'Must be ≥ 0' };
	return null;
}

/**
 * Validate the correlation between paired measurements (optional field).
 * Must be strictly between -1 and 1. Empty string is valid (field is optional).
 */
export function validateRPaired(value: string): ValidationError | null {
	if (!value.trim()) return null; // optional
	const r = parseNumber(value);
	if (r === null) return { field: 'rPaired', message: 'Must be a number' };
	if (r <= -1 || r >= 1) return { field: 'rPaired', message: 'Must be between −1 and 1 (exclusive)' };
	return null;
}

/** Collect all validation errors for Family 1 inputs. Returns empty array if valid. */
export function validateFamily1(
	inputType: Family1InputType,
	fields: Record<string, string>,
	direction: EffectDirection,
	designType: DesignType = 'independent'
): ValidationError[] {
	const errors: ValidationError[] = [];

	const pushIf = (e: ValidationError | null) => { if (e) errors.push(e); };

	if (designType === 'one-sample') {
		pushIf(validateSampleSize(fields.nPairs, 'nPairs'));

		switch (inputType) {
			case 'd':
				pushIf(validateFinite(fields.d, 'd'));
				break;
			case 'g':
				pushIf(validateFinite(fields.g, 'g'));
				break;
			case 't':
				pushIf(validateFinite(fields.t, 't'));
				break;
			case 'means':
				pushIf(validateFinite(fields.m1, 'm1'));      // sample mean
				pushIf(validateFinite(fields.mu0, 'mu0'));    // reference value
				pushIf(validateSD(fields.sd1, 'sd1'));        // sample SD
				break;
			case 'p':
				pushIf(validatePValue(fields.p));
				break;
		}
	} else if (designType === 'paired') {
		pushIf(validateSampleSize(fields.nPairs, 'nPairs'));
		pushIf(validateRPaired(fields.rPaired));

		switch (inputType) {
			case 'd':
				pushIf(validateFinite(fields.d, 'd'));
				break;
			case 't':
				pushIf(validateFinite(fields.t, 't'));
				break;
			case 'means':
				pushIf(validateFinite(fields.mDiff, 'mDiff'));
				pushIf(validateSD(fields.sdDiff, 'sdDiff'));
				break;
			case 'p':
				pushIf(validatePValue(fields.p));
				break;
		}
	} else {
		// Independent samples — original logic
		pushIf(validateSampleSize(fields.n1, 'n1'));
		pushIf(validateSampleSize(fields.n2, 'n2'));

		switch (inputType) {
			case 'd':
				pushIf(validateFinite(fields.d, 'd'));
				break;
			case 'g':
				pushIf(validateFinite(fields.g, 'g'));
				break;
			case 't':
				pushIf(validateFinite(fields.t, 't'));
				break;
			case 'f':
				pushIf(validateF(fields.f));
				break;
			case 'means':
				pushIf(validateFinite(fields.m1, 'm1'));
				pushIf(validateFinite(fields.m2, 'm2'));
				pushIf(validateSD(fields.sd1, 'sd1'));
				pushIf(validateSD(fields.sd2, 'sd2'));
				break;
			case 'p':
				pushIf(validatePValue(fields.p));
				break;
		}
	}

	return errors;
}
