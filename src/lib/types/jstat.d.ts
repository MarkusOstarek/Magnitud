declare module 'jstat' {
	interface Distribution {
		pdf(x: number, ...params: number[]): number;
		cdf(x: number, ...params: number[]): number;
		inv(p: number, ...params: number[]): number;
		mean(...params: number[]): number;
		variance(...params: number[]): number;
	}

	interface JStatStatic {
		normal: {
			pdf(x: number, mu: number, sigma: number): number;
			cdf(x: number, mu: number, sigma: number): number;
			inv(p: number, mu: number, sigma: number): number;
		};
		studentt: {
			pdf(x: number, df: number): number;
			cdf(x: number, df: number): number;
			inv(p: number, df: number): number;
		};
		chisquare: {
			pdf(x: number, df: number): number;
			cdf(x: number, df: number): number;
			inv(p: number, df: number): number;
		};
		beta: {
			pdf(x: number, alpha: number, beta: number): number;
			cdf(x: number, alpha: number, beta: number): number;
			inv(p: number, alpha: number, beta: number): number;
		};
		centralF: {
			pdf(x: number, df1: number, df2: number): number;
			cdf(x: number, df1: number, df2: number): number;
			inv(p: number, df1: number, df2: number): number;
		};
	}

	const jStat: JStatStatic;
	export default jStat;
	export = jStat;
}
