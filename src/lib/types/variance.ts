export type Family3InputType = 'F' | 't' | 'eta2' | 'partial_eta2' | 'cohens_f' | 'r2' | 'ss';
export type DesignType = 'one-way' | 'factorial' | 'repeated' | 'mixed';

export interface Family3Inputs {
	inputType: Family3InputType;
	fStr: string;
	dfNumStr: string;
	dfDenStr: string;
	// t-statistic input (shares dfErrorStr with ss mode)
	tStr: string;
	eta2Str: string;
	partialEta2Str: string;
	cohensFStr: string;
	r2Str: string;
	// SS input mode
	ssEffStr: string;
	ssErrorStr: string;
	ssTotalStr: string;
	dfEffStr: string;
	dfErrorStr: string;
}

export interface Family3Results {
	/**
	 * For F/SS input: partial η² (= η² for one-way ANOVA).
	 * For direct inputs: η² as given.
	 */
	eta2: number;
	/** Whether the eta2 field represents partial η². */
	isPartial: boolean;
	/** Bias-corrected estimate. Null when not computable. */
	omega2: number | null;
	/** Label for the omega2 row: 'ω²', 'Partial ω²', or null (shown as N/A). */
	omega2Label: string | null;
	/** Cohen's f = √(η² / (1 − η²)) */
	cohensF: number;
	/** Cohen's f² = η² / (1 − η²) */
	cohensFSq: number;
	/**
	 * 95% CI on η²/partial η² via noncentral F (Smithson 2001).
	 * Only available when an F-statistic is known.
	 */
	eta2CI: [number, number] | null;
}
