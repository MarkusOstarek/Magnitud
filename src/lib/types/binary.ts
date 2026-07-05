export type Family4InputType = 'table' | 'props';

export interface Family4Inputs {
	inputType: Family4InputType;
	// 2×2 table mode: treatment=row1, control=row2; event=col1, no-event=col2
	aStr: string; // treatment + event
	bStr: string; // treatment + no event
	cStr: string; // control + event
	dStr: string; // control + no event
	// proportions mode
	p1Str: string;
	n1Str: string;
	p2Str: string;
	n2Str: string;
}

export interface Family4Results {
	/** Event rate in group 1 (treatment). */
	p1: number;
	/** Event rate in group 2 (control). */
	p2: number;
	/** Sample size of group 1. */
	n1: number;
	/** Sample size of group 2. */
	n2: number;
	/** Whether individual cell counts are known (table input gives exact phi). */
	hasTable: boolean;
	/** Whether Haldane-Anscombe correction (+0.5) was applied due to a zero cell. */
	hadZeroCell: boolean;
	/** Odds ratio: OR = (a·d) / (b·c). */
	or: number;
	/** Log odds ratio: ln(OR). For meta-analysis. */
	logOR: number;
	/** SE of log OR: √(1/a + 1/b + 1/c + 1/d). */
	seLogOR: number;
	/** 95% CI for OR (from log scale). */
	orCI: [number, number];
	/** Risk ratio (relative risk): RR = p1/p2. */
	rr: number;
	/** Log risk ratio. For meta-analysis. */
	logRR: number;
	/** SE of log RR. */
	seLogRR: number;
	/** 95% CI for RR (from log scale). */
	rrCI: [number, number];
	/** Risk difference (absolute risk reduction): RD = p1 − p2. */
	rd: number;
	/** SE of risk difference. */
	seRD: number;
	/** 95% CI for RD. */
	rdCI: [number, number];
	/** Number needed to treat/harm: 1/|RD|. Null if RD = 0. */
	nnt: number | null;
	/** Phi coefficient φ = (ad−bc)/√(n1·n2·(a+c)·(b+d)). */
	phi: number;
}
