/** Input type selector for Family 2 (correlations) */
export type Family2InputType = 'r' | 'r2' | 'z' | 't' | 'p' | 'chi2' | 'slope';

/** Direction of effect for inputs that lose sign (R², p-value, chi-square) */
export type EffectDirection = 1 | -1;

/** All raw string inputs for Family 2 */
export interface Family2Inputs {
	inputType: Family2InputType;
	rStr: string;       // direct Pearson r
	r2Str: string;      // direct R²
	zStr: string;       // direct Fisher's z
	tStr: string;       // t-statistic from correlation test
	pStr: string;       // p-value
	chi2Str: string;    // chi-square with 1 df (gives phi = r for 2×2 tables)
	bStr: string;       // regression slope
	sdxStr: string;     // SD of predictor (X)
	sdyStr: string;     // SD of outcome (Y)
	nStr: string;       // sample size (all input types)
	direction: EffectDirection;  // for r2, p, chi2
}

/** Computed results for Family 2 */
export interface Family2Results {
	r: number;
	r2: number;
	fisherZ: number;
	seZ: number;
	varZ: number;
	rCI: [number, number];
	n: number;
}
