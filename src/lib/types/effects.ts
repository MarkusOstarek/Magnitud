/** Input type selector for Family 1 */
export type Family1InputType = 'd' | 'g' | 't' | 'f' | 'means' | 'p';

/** Direction of effect for p-value inputs */
export type EffectDirection = 1 | -1;

/** Independent vs paired/repeated-measures vs one-sample design */
export type DesignType = 'independent' | 'paired' | 'one-sample';

/** All raw string inputs for Family 1 */
export interface Family1Inputs {
	designType: DesignType;
	inputType: Family1InputType;
	// Direct d/g
	dStr: string;
	gStr: string;
	// Test statistics
	tStr: string;
	fStr: string;
	// Independent means and SDs
	m1Str: string;
	m2Str: string;
	sd1Str: string;
	sd2Str: string;
	// Paired means: mean difference and SD of differences
	mDiffStr: string;
	sdDiffStr: string;
	// p-value
	pStr: string;
	direction: EffectDirection;
	// Sample sizes — independent design
	n1Str: string;
	n2Str: string;
	// Sample size — paired design (number of pairs)
	nPairsStr: string;
	// Optional: correlation between paired measurements, for d_z → d_s conversion
	rPairedStr: string;
	// One-sample: reference / null value (μ₀)
	mu0Str: string;
}

/** Computed results for Family 1 */
export interface Family1Results {
	designType: DesignType;
	n: number;          // Total N (n1+n2 for independent, n for paired/one-sample)
	d: number;         // For independent: Cohen's d. For paired: d_z (primary estimate).
	g: number;
	glassDelta: number | null;
	r: number;
	cles: number;
	u3: number;
	ovl: number;
	variance: number;
	se: number;
	dCI: [number, number];
	gCI: [number, number];
	rCI: [number, number];
	n1: number;
	n2: number;
	// Paired-only fields
	ds: number | null;   // d_s (comparable to independent d), only when rPaired provided
	rPaired: number | null;
}

/** Benchmark set definition */
export interface BenchmarkSet {
	label: string;
	thresholds: { small: number; medium: number; large: number };
	note: string;
}

export type BenchmarkSetKey = 'cohen' | 'social_science' | 'education' | 'clinical' | 'ux_product';

/** A single output row in the results table */
export interface OutputRow {
	name: string;
	value: number | null;
	ci?: [number, number];
	se?: number;
	format: 'decimal3' | 'decimal4' | 'percent1' | 'integer';
	description: string;
}

/** Validation error */
export interface ValidationError {
	field: string;
	message: string;
}
