<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { page } from '$app/stores';
	import { syncQuery } from '$lib/utils/urlSync.js';
	import { base } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import FormulaAccordion from '$lib/components/FormulaAccordion.svelte';
	import CitationSnippet from '$lib/components/CitationSnippet.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';

	// ── Types ──────────────────────────────────────────────────────
	type PredType    = 'continuous' | 'categorical';
	type StudyDesign = 'observational' | 'experimental';
	type ModelType   = 'linear' | 'loglinear' | 'logistic' | 'ordlogistic' | 'poisson' | 'negbin' | 'cox';
	type PredScale   = 'raw' | 'std' | 'log';
	type Scheme      = 'dummy' | 'effects' | 'helmert' | 'sdif';

	// ── Top-level state ────────────────────────────────────────────
	let predType  = $state<PredType>('continuous');
	let study     = $state<StudyDesign>('observational');
	let modelType = $state<ModelType>('linear');

	// ── Continuous predictor ───────────────────────────────────────
	let scaleX = $state<PredScale>('raw');
	let varX   = $state('');
	let varY   = $state('');
	let unitsX = $state('');
	let unitsY = $state('');
	let bStr   = $state('');
	let seStr  = $state('');
	let ciLoStr = $state('');
	let ciHiStr = $state('');
	let pStr   = $state('');
	let showOptional = $state(false);

	// ── Categorical predictor ──────────────────────────────────────
	let scheme      = $state<Scheme>('dummy');
	let nGroups     = $state(3);
	let groupNames  = $state(['Group A', 'Group B', 'Group C']);
	let refGroupIdx = $state(0);
	let bValues     = $state<string[]>(['', '']);

	$effect(() => {
		const n = nGroups; // only nGroups is tracked as a dependency
		const prevNames = untrack(() => groupNames);
		const prevVals  = untrack(() => bValues);
		const prevRef   = untrack(() => refGroupIdx);
		groupNames = Array.from({length: n}, (_, i) => prevNames[i] ?? `Group ${String.fromCharCode(65 + i)}`);
		bValues    = Array.from({length: n - 1}, (_, i) => prevVals[i] ?? '');
		if (prevRef >= n) refGroupIdx = 0;
	});

	function setGroupName(i: number, v: string) {
		groupNames = groupNames.map((g, j) => j === i ? v : g);
	}
	function setBValue(i: number, v: string) {
		bValues = bValues.map((old, j) => j === i ? v : old);
	}

	// ── Parsing ────────────────────────────────────────────────────
	function num(s: string): number | null {
		const v = parseFloat(s.trim().replace(',', '.'));
		return isNaN(v) ? null : v;
	}

	let b     = $derived(num(bStr));
	let se    = $derived(num(seStr));
	let ciLo  = $derived(num(ciLoStr));
	let ciHi  = $derived(num(ciHiStr));
	let pVal  = $derived(num(pStr));

	// CI from SE if not directly entered
	let effectiveCILo = $derived(ciLo ?? (b !== null && se !== null ? b - 1.96 * se : null));
	let effectiveCIHi = $derived(ciHi ?? (b !== null && se !== null ? b + 1.96 * se : null));

	// ── Helpers ────────────────────────────────────────────────────
	function fmt(n: number, dp = 3): string { return n.toFixed(dp); }
	// Smart format: strips trailing zeros (14.300 → "14.3", 14.000 → "14")
	function sFmt(n: number, dp = 3): string { return Number(n.toFixed(dp)).toString(); }
	function fmtP(p: number): string {
		if (p < 0.001) return '< .001';
		return '= .' + p.toFixed(3).slice(2);
	}

	const isMultiplicative = $derived(
		modelType === 'logistic' || modelType === 'ordlogistic' ||
		modelType === 'poisson'  || modelType === 'negbin' || modelType === 'cox'
	);

	// Implied reference-group coefficient for effects coding (= negative sum of all others)
	const impliedCoeff = $derived.by(() => {
		if (scheme !== 'effects') return null;
		const vals = bValues.map((s: string) => num(s));
		if (vals.some((v: number | null) => v === null)) return null;
		return -(vals as number[]).reduce((a: number, bv: number) => a + bv, 0);
	});

	const expLabel = $derived(
		modelType === 'logistic'    ? 'OR'  :
		modelType === 'ordlogistic' ? 'POR' :
		modelType === 'cox'         ? 'HR'  :
		(modelType === 'poisson' || modelType === 'negbin') ? 'IRR' : null
	);

	function caveat(): string {
		return study === 'experimental'
			? 'holding all other variables constant.'
			: 'holding all other variables constant. This is an observational association and does not imply a causal relationship.';
	}

	// ── Continuous interpretation ──────────────────────────────────
	interface InterpResult {
		headline: string;    // plain-language finding (no caveat)
		caveat: string;      // styled lighter in template
		plain: string | null;  // multiplicative framing + technical parenthetical
		expLine: string | null;
		assumption: string | null;
		warning: string | null;
	}

	interface CatInterp {
		main: string;          // plain-language interpretation
		techNote: string | null; // technical parenthetical (styled smaller/lighter)
	}

	function buildContinuousInterp(
		mt: ModelType, sx: PredScale,
		bVal: number, xN: string, yN: string, xU: string, yU: string
	): InterpResult {
		const x   = xN || 'the predictor';
		const y   = yN || 'the outcome';
		const xu  = xU ? ` (${xU})` : '';
		const yU2 = yU ? ` (${yU})` : '';
		const cv  = caveat();
		const bF  = sFmt(bVal);
		const bAbs = sFmt(Math.abs(bVal));
		const expB = Math.exp(bVal);
		const expF = sFmt(expB, 2);
		const pct    = sFmt(Math.abs((expB - 1) * 100), 1);
		const pctAdj = expB > 1 ? 'higher' : 'lower';
		const pctVb  = expB > 1 ? 'increases' : 'decreases';
		const largeExp = Math.abs(bVal) > 3 && isMultiplicative;

		// ── Linear ──────────────────────────────────────────────────────
		if (mt === 'linear') {
			const bDir  = bVal >= 0 ? 'increases' : 'decreases';
			const sdDir = bVal >= 0 ? 'increase' : 'decrease';
			if (sx === 'raw') {
				return {
					headline: `For each one-unit increase in ${x}${xu}, ${y}${yU2} ${bDir} by ${bAbs}${yU ? ' ' + yU : ''} on average`,
					caveat: cv, plain: null, expLine: null, assumption: null, warning: null
				};
			}
			if (sx === 'std') {
				return {
					headline: `A one standard deviation increase in ${x} is associated with a ${bAbs}${yU ? ' ' + yU : ''} ${sdDir} in ${y}`,
					caveat: cv, plain: null, expLine: null, assumption: null, warning: null
				};
			}
			// log predictor
			const per1pct = sFmt(bVal / 100, 4);
			const perDbl  = sFmt(bVal * Math.LN2);
			return {
				headline: `A 1% increase in ${x}${xu} is associated with approximately a ${per1pct}${yU ? ' ' + yU : ''} change in ${y}`,
				caveat: cv,
				plain: `A doubling of ${x} changes ${y} by ${perDbl}${yU ? ' ' + yU : ''}. (Log-transformed predictor: b = ${bF}.)`,
				expLine: null, assumption: null, warning: null
			};
		}

		// ── Log-transformed outcome (ln(Y), linear model) ────────────────
		if (mt === 'loglinear') {
			const approxPct = sFmt(bVal * 100, 1);
			const bigApprox = Math.abs(bVal) > 0.1;
			if (sx === 'raw') {
				if (!bigApprox) {
					return {
						headline: `For each one-unit increase in ${x}${xu}, ${y} changes by approximately ${approxPct}%`,
						caveat: cv,
						plain: `More precisely, ${y} is multiplied by exp(b) = ${expF} per unit. (Log-scale coefficient: b = ${bF}.)`,
						expLine: `×${expF}`, assumption: null, warning: null
					};
				} else {
					return {
						headline: `For each one-unit increase in ${x}${xu}, ${y} is multiplied by ${expF}`,
						caveat: cv,
						plain: `This corresponds to a ${pct}% ${pctAdj} per unit. The approximation b × 100 = ${approxPct}% is not reliable for |b| > 0.1. (Log-scale coefficient: b = ${bF}.)`,
						expLine: `×${expF}  (${pct}% ${pctAdj})`,
						assumption: null,
						warning: `The percentage approximation (${approxPct}%) is less accurate for |b| > 0.1. Use the exact multiplier ×${expF}.`
					};
				}
			}
			if (sx === 'std') {
				if (!bigApprox) {
					return {
						headline: `A one standard deviation increase in ${x} is associated with approximately a ${approxPct}% change in ${y}`,
						caveat: cv,
						plain: `Exact multiplier: ${y} is multiplied by ${expF} per SD. (Log-scale coefficient: b = ${bF}.)`,
						expLine: `×${expF}`, assumption: null, warning: null
					};
				} else {
					return {
						headline: `A one standard deviation increase in ${x} is associated with a ${pct}% ${pctAdj} in ${y}`,
						caveat: cv,
						plain: `${y} is multiplied by ${expF} per SD. (Log-scale coefficient: b = ${bF}.)`,
						expLine: `×${expF}`, assumption: null,
						warning: `The approximation b × 100 = ${approxPct}% is less accurate for |b| > 0.1.`
					};
				}
			}
			// log/log elasticity
			const bPctSign = bVal >= 0 ? 'increase' : 'decrease';
			return {
				headline: `A 1% increase in ${x} is associated with a ${bF}% ${bPctSign} in ${y}`,
				caveat: cv,
				plain: `This is an elasticity: b = ∂ln(${y})/∂ln(${x}). A 10% increase in ${x} is associated with a ${sFmt(Math.abs(bVal * 10), 1)}% change in ${y}. (Log-log coefficient: b = ${bF}.)`,
				expLine: null, assumption: null, warning: null
			};
		}

		// ── Logistic ──────────────────────────────────────────────────────
		if (mt === 'logistic') {
			const tech = `(Log-odds coefficient: b = ${bF}.)`;
			let headline = '';
			let plain = '';
			if (sx === 'raw') {
				headline = `For each one-unit increase in ${x}${xu}, the odds of ${y} ${pctVb} by ${pct}%`;
				plain = `The odds are multiplied by ${expF} per unit of ${x}${xu}. ${tech}`;
			} else if (sx === 'std') {
				headline = `A one standard deviation increase in ${x} is associated with ${pct}% ${pctAdj} odds of ${y}`;
				plain = `The odds are multiplied by ${expF} per SD. ${tech}`;
			} else {
				const dblOR  = sFmt(Math.exp(bVal * Math.LN2), 2);
				const dblPct = sFmt(Math.abs((Math.exp(bVal * Math.LN2) - 1) * 100), 1);
				const dblAdj = Math.exp(bVal * Math.LN2) > 1 ? 'higher' : 'lower';
				headline = `A doubling of ${x}${xu} is associated with ${dblPct}% ${dblAdj} odds of ${y}`;
				plain = `OR per doubling of ${x}: ${dblOR}. ${tech}`;
			}
			return {
				headline, caveat: cv, plain,
				expLine: `OR = ${expF}`,
				assumption: null,
				warning: largeExp ? `OR = ${expF} is very large. Check for quasi-complete separation, a predictor scaling issue, or model misspecification.` : null
			};
		}

		// ── Ordinal logistic ──────────────────────────────────────────────
		if (mt === 'ordlogistic') {
			const tech = `(Log-odds coefficient: b = ${bF}.)`;
			let headline = '';
			let plain = '';
			if (sx === 'raw') {
				headline = `For each one-unit increase in ${x}${xu}, the odds of being in a higher category of ${y} ${pctVb} by ${pct}%`;
				plain = `This proportional odds ratio (POR) of ${expF} applies at every cutpoint of ${y}. ${tech}`;
			} else if (sx === 'std') {
				headline = `A one standard deviation increase in ${x} is associated with ${pct}% ${pctAdj} odds of a higher ${y} category`;
				plain = `POR = ${expF} per SD. ${tech}`;
			} else {
				const dblPOR = sFmt(Math.exp(bVal * Math.LN2), 2);
				const dblPct = sFmt(Math.abs((Math.exp(bVal * Math.LN2) - 1) * 100), 1);
				const dblAdj = Math.exp(bVal * Math.LN2) > 1 ? 'higher' : 'lower';
				headline = `A doubling of ${x}${xu} is associated with ${dblPct}% ${dblAdj} odds of a higher ${y} category`;
				plain = `POR per doubling: ${dblPOR}. ${tech}`;
			}
			return {
				headline, caveat: cv, plain,
				expLine: `POR = ${expF}`,
				assumption: `Assumes the proportional odds assumption: the effect of ${x} is consistent across all cutpoints of ${y}.`,
				warning: largeExp ? `POR = ${expF} is very large. Verify your model output.` : null
			};
		}

		// ── Poisson / Negative binomial ───────────────────────────────────
		if (mt === 'poisson' || mt === 'negbin') {
			const tech = `(Log-count coefficient: b = ${bF}.)`;
			let headline = '';
			let plain = '';
			if (sx === 'raw') {
				headline = `For each one-unit increase in ${x}${xu}, the expected count of ${y} ${pctVb} by ${pct}%`;
				plain = `The rate is multiplied by ${expF} per unit, giving an incidence rate ratio (IRR) of ${expF}. ${tech}`;
			} else if (sx === 'std') {
				headline = `A one standard deviation increase in ${x} is associated with ${pct}% ${pctAdj} expected count of ${y}`;
				plain = `IRR = ${expF} per SD. ${tech}`;
			} else {
				const dblIRR = sFmt(Math.exp(bVal * Math.LN2), 2);
				const dblPct = sFmt(Math.abs((Math.exp(bVal * Math.LN2) - 1) * 100), 1);
				const dblAdj = Math.exp(bVal * Math.LN2) > 1 ? 'higher' : 'lower';
				headline = `A doubling of ${x}${xu} is associated with ${dblPct}% ${dblAdj} expected count of ${y}`;
				plain = `IRR per doubling: ${dblIRR}. ${tech}`;
			}
			return {
				headline, caveat: cv, plain,
				expLine: `IRR = ${expF}`,
				assumption: mt === 'negbin' ? 'Negative binomial model: same IRR interpretation as Poisson; the model accounts for overdispersion.' : null,
				warning: largeExp ? `IRR = ${expF} is very large. Verify your model output.` : null
			};
		}

		// ── Cox proportional hazards ──────────────────────────────────────
		if (mt === 'cox') {
			const tech   = `(Log-hazard coefficient: b = ${bF}.)`;
			const hrNote = expB > 1 ? 'faster time to event (increased risk)' : 'slower time to event (protective effect)';
			let headline = '';
			let plain = '';
			if (sx === 'raw') {
				headline = `For each one-unit increase in ${x}${xu}, the hazard of ${y} ${pctVb} by ${pct}%`;
				plain = `The hazard ratio (HR) is ${expF}, meaning the instantaneous risk is multiplied by ${expF} per unit — ${hrNote}. ${tech}`;
			} else if (sx === 'std') {
				headline = `A one standard deviation increase in ${x} is associated with ${pct}% ${pctAdj} hazard of ${y}`;
				plain = `HR = ${expF} per SD — ${hrNote}. ${tech}`;
			} else {
				const dblHR  = sFmt(Math.exp(bVal * Math.LN2), 2);
				const dblPct = sFmt(Math.abs((Math.exp(bVal * Math.LN2) - 1) * 100), 1);
				const dblAdj = Math.exp(bVal * Math.LN2) > 1 ? 'higher' : 'lower';
				headline = `A doubling of ${x}${xu} is associated with ${dblPct}% ${dblAdj} hazard of ${y}`;
				plain = `HR per doubling: ${dblHR}. ${tech}`;
			}
			return {
				headline, caveat: cv, plain,
				expLine: `HR = ${expF}`,
				assumption: 'Assumes the proportional hazards assumption: the HR is constant over time.',
				warning: largeExp ? `HR = ${expF} is very large. Verify your model output.` : null
			};
		}

		return { headline: '', caveat: cv, plain: null, expLine: null, assumption: null, warning: null };
	}

	let continuousInterp = $derived(
		b !== null && !isNaN(b)
			? buildContinuousInterp(modelType, scaleX, b, varX, varY, unitsX, unitsY)
			: null
	);

	// ── APA-style reporting ────────────────────────────────────────
	let bVal = $derived(b ?? 0); // must be declared before apaLine uses it
	let hasOptionalData = $derived(se !== null || ciLo !== null || pVal !== null);

	let apaLine = $derived.by(() => {
		if (b === null) return null;
		const parts: string[] = [`b = ${sFmt(bVal, 2)}`];
		if (se !== null) parts.push(`SE = ${sFmt(se, 2)}`);
		if (expLabel) {
			parts.push(`${expLabel} = ${sFmt(Math.exp(bVal), 2)}`);
		}
		if (effectiveCILo !== null && effectiveCIHi !== null) {
			if (expLabel) {
				parts.push(`95% CI [${sFmt(Math.exp(effectiveCILo), 2)}, ${sFmt(Math.exp(effectiveCIHi), 2)}]`);
			} else {
				parts.push(`95% CI [${sFmt(effectiveCILo, 2)}, ${sFmt(effectiveCIHi, 2)}]`);
			}
		}
		if (pVal !== null) parts.push(`p ${fmtP(pVal)}`);
		return parts.join(', ');
	});

	// ── Coding matrix ──────────────────────────────────────────────
	function computeMatrix(s: Scheme, n: number, refIdx: number): number[][] {
		const nc = n - 1;
		const m = Array.from({length: n}, () => Array(nc).fill(0));
		if (s === 'dummy') {
			let col = 0;
			for (let g = 0; g < n; g++) {
				if (g === refIdx) continue;
				m[g][col++] = 1;
			}
		} else if (s === 'effects') {
			let col = 0;
			for (let g = 0; g < n; g++) {
				if (g === refIdx) continue;
				m[g][col] = 1;
				m[refIdx][col] = -1;
				col++;
			}
		} else if (s === 'helmert') {
			for (let j = 0; j < nc; j++) {
				for (let g = 0; g <= j; g++) m[g][j] = -1;
				m[j + 1][j] = j + 1;
			}
		} else { // sdif
			for (let j = 0; j < nc; j++) {
				m[j][j] = -1; m[j + 1][j] = 1;
			}
		}
		return m;
	}

	let matrix = $derived(computeMatrix(scheme, nGroups, refGroupIdx));

	let contrastHeaders = $derived((() => {
		if (scheme === 'dummy') {
			const out: string[] = [];
			for (let g = 0; g < nGroups; g++) {
				if (g === refGroupIdx) continue;
				out.push(`${groupNames[g] || `G${g+1}`} vs ${groupNames[refGroupIdx] || `G${refGroupIdx+1}`}`);
			}
			return out;
		}
		if (scheme === 'effects') {
			return groupNames.filter((_, i) => i !== refGroupIdx).map(n => n || '?');
		}
		if (scheme === 'helmert') {
			return Array.from({length: nGroups - 1}, (_, j) => {
				const prev = groupNames.slice(0, j + 1).map((n, i) => n || `G${i+1}`).join(', ');
				return `${groupNames[j+1] || `G${j+2}`} vs mean(${prev})`;
			});
		}
		// sdif
		return Array.from({length: nGroups - 1}, (_, j) =>
			`${groupNames[j+1] || `G${j+2}`} − ${groupNames[j] || `G${j+1}`}`
		);
	})());

	let interceptMeaning = $derived((() => {
		const ref = groupNames[refGroupIdx] || 'reference group';
		const g0 = groupNames[0] || 'first group';
		const y = varY || 'the outcome';
		if (scheme === 'dummy') {
			if (modelType === 'linear') return `Mean ${y} in ${ref} (when all other predictors = 0).`;
			if (modelType === 'loglinear') return `ln(mean ${y}) in ${ref}, i.e. exp(intercept) = geometric mean of ${y} in ${ref}.`;
			if (modelType === 'logistic') return `Log-odds of ${y} in ${ref} (when all other predictors = 0).`;
			if (modelType === 'poisson' || modelType === 'negbin') return `Log of expected count of ${y} in ${ref}.`;
			if (modelType === 'cox') return `Baseline log-hazard (when all covariates = 0).`;
			return `Intercept for ${ref}.`;
		}
		if (scheme === 'effects') return `Grand mean of ${y} (unweighted mean across all groups).`;
		return `Mean ${y} in ${g0} (first group).`;
	})());

	let coeffInterps = $derived(contrastHeaders.map((hdr, j): CatInterp => {
		const bv   = num(bValues[j]);
		const hasB = bv !== null;
		const y    = varY || 'the outcome';
		const expB = hasB ? Math.exp(bv!) : null;
		const expF = expB !== null ? sFmt(expB, 2) : null;
		const pct    = expB !== null ? sFmt(Math.abs((expB - 1) * 100), 1) : null;
		const pctAdj = expB !== null ? (expB > 1 ? 'higher' : 'lower') : null;
		const bvF  = hasB ? sFmt(bv!) : null;

		if (scheme === 'dummy') {
			const other = groupNames.filter((_, i) => i !== refGroupIdx)[j] || `G${j+1}`;
			const ref   = groupNames[refGroupIdx] || 'reference';
			if (!hasB) return { main: `β₍${j+1}₎: mean difference in ${y}: ${other} − ${ref}.`, techNote: null };
			if (modelType === 'linear') {
				const dir = bv! > 0 ? 'higher' : 'lower';
				return { main: `${other} scores ${sFmt(Math.abs(bv!))} ${dir} on ${y} than ${ref} on average, ${caveat()}`, techNote: null };
			}
			if (modelType === 'loglinear') {
				const bigB = Math.abs(bv!) > 0.1;
				const approxPct = sFmt(Math.abs(bv!) * 100, 1);
				const dir = bv! > 0 ? 'higher' : 'lower';
				if (!bigB) return {
					main: `${other} has approximately ${approxPct}% ${dir} ${y} than ${ref}, ${caveat()}`,
					techNote: `More precisely, ${y} in ${other} is ${expF} times that in ${ref}. (Log-scale coefficient: b = ${bvF}.)`
				};
				return {
					main: `${y} in ${other} is ${expF} times that in ${ref}, a ${pct}% ${dir}, ${caveat()}`,
					techNote: `(Log-scale coefficient: b = ${bvF}.)`
				};
			}
			if (modelType === 'logistic') return {
				main: `${other} has ${pct}% ${pctAdj} odds of ${y} compared to ${ref}, ${caveat()}`,
				techNote: `Odds ratio: OR = ${expF}. (Log-odds coefficient: b = ${bvF}.)`
			};
			if (modelType === 'ordlogistic') return {
				main: `${other} has ${pct}% ${pctAdj} odds of being in a higher ${y} category compared to ${ref}, ${caveat()}`,
				techNote: `Proportional odds ratio: POR = ${expF}. (Log-odds coefficient: b = ${bvF}.)`
			};
			if (modelType === 'poisson' || modelType === 'negbin') return {
				main: `The expected count of ${y} in ${other} is ${pct}% ${pctAdj} than in ${ref}, ${caveat()}`,
				techNote: `Incidence rate ratio: IRR = ${expF}. (Log-count coefficient: b = ${bvF}.)`
			};
			if (modelType === 'cox') return {
				main: `The hazard of ${y} in ${other} is ${pct}% ${pctAdj} than in ${ref}, ${caveat()}`,
				techNote: `Hazard ratio: HR = ${expF}. (Log-hazard coefficient: b = ${bvF}.)`
			};
		}

		if (scheme === 'effects') {
			const gname = groupNames.filter((_, i) => i !== refGroupIdx)[j] || `G${j+1}`;
			if (!hasB) return { main: `β₍${j+1}₎: deviation of ${gname} from the grand mean.`, techNote: null };
			if (modelType === 'linear') {
				const dir = bv! > 0 ? 'above' : 'below';
				return { main: `${gname}'s mean ${y} is ${sFmt(Math.abs(bv!))} ${dir} the grand mean, ${caveat()}`, techNote: null };
			}
			if (modelType === 'loglinear') {
				const bigB = Math.abs(bv!) > 0.1;
				const approxPct = sFmt(Math.abs(bv!) * 100, 1);
				const dir = bv! > 0 ? 'higher' : 'lower';
				if (!bigB) return {
					main: `${gname} has approximately ${approxPct}% ${dir} ${y} than the average across all categories, ${caveat()}`,
					techNote: `More precisely, ${y} for ${gname} is ${expF} times the average across all categories. (Log-scale coefficient: b = ${bvF}.)`
				};
				return {
					main: `${y} for ${gname} is ${expF} times the average across all categories, a ${pct}% ${dir}, ${caveat()}`,
					techNote: `(Log-scale coefficient: b = ${bvF}.)`
				};
			}
			if (modelType === 'logistic') return {
				main: `${gname} has ${pct}% ${pctAdj} odds of ${y} compared to the average across all categories, ${caveat()}`,
				techNote: `OR relative to grand mean: ${expF}. (Log-odds coefficient: b = ${bvF}.)`
			};
			if (modelType === 'ordlogistic') return {
				main: `${gname} has ${pct}% ${pctAdj} odds of a higher ${y} category compared to the average across all categories, ${caveat()}`,
				techNote: `POR relative to grand mean: ${expF}. (Log-odds coefficient: b = ${bvF}.)`
			};
			if (modelType === 'poisson' || modelType === 'negbin') return {
				main: `The expected count of ${y} for ${gname} is ${pct}% ${pctAdj} the average across all categories, ${caveat()}`,
				techNote: `IRR relative to grand mean: ${expF}. (Log-count coefficient: b = ${bvF}.)`
			};
			if (modelType === 'cox') return {
				main: `The hazard of ${y} for ${gname} is ${pct}% ${pctAdj} the average across all categories, ${caveat()}`,
				techNote: `HR relative to grand mean: ${expF}. (Log-hazard coefficient: b = ${bvF}.)`
			};
			return { main: `${gname}'s ${y} deviates by ${sFmt(bv!)} from the grand mean on the link scale; exp(b) = ${expF}.`, techNote: null };
		}

		if (scheme === 'helmert') {
			const next = groupNames[j + 1] || `G${j+2}`;
			const prev = groupNames.slice(0, j + 1).map((n, i) => n || `G${i+1}`).join(', ');
			if (!hasB) return { main: `β₍${j+1}₎: ${next} vs mean(${prev}).`, techNote: null };
			// R's contr.helmert scales each contrast: b = (group − mean of previous) / k,
			// where k = number of groups involved. The actual comparison is b × k.
			const kH = j + 2;
			const scaleNote = `contr.helmert scales this contrast by 1/${kH}, so the comparison uses b × ${kH}. (Contrast coefficient: b = ${bvF}.)`;
			const expBH = Math.exp(bv! * kH);
			const expFH = sFmt(expBH, 2);
			const pctH = sFmt(Math.abs((expBH - 1) * 100), 1);
			const pctAdjH = expBH > 1 ? 'higher' : 'lower';
			if (modelType === 'linear') {
				const dir = bv! > 0 ? 'higher' : 'lower';
				return {
					main: `${next} scores ${sFmt(Math.abs(bv! * kH))} ${dir} on ${y} than the mean of (${prev}), ${caveat()}`,
					techNote: scaleNote
				};
			}
			if (modelType === 'logistic') return {
				main: `${next} has ${pctH}% ${pctAdjH} odds of ${y} compared to the average of (${prev}), ${caveat()}`,
				techNote: `OR = exp(b × ${kH}) = ${expFH}. ${scaleNote}`
			};
			if (modelType === 'poisson' || modelType === 'negbin') return {
				main: `The expected count of ${y} in ${next} is ${pctH}% ${pctAdjH} compared to the average of (${prev}), ${caveat()}`,
				techNote: `IRR = exp(b × ${kH}) = ${expFH}. ${scaleNote}`
			};
			if (modelType === 'cox') return {
				main: `The hazard of ${y} in ${next} is ${pctH}% ${pctAdjH} compared to the average of (${prev}), ${caveat()}`,
				techNote: `HR = exp(b × ${kH}) = ${expFH}. ${scaleNote}`
			};
			return { main: `β₍${j+1}₎ = ${sFmt(bv!)}: ${next} vs mean(${prev}); the comparison uses b × ${kH} = ${sFmt(bv! * kH)}.`, techNote: scaleNote };
		}

		// sdif
		const g1 = groupNames[j]     || `G${j+1}`;
		const g2 = groupNames[j + 1] || `G${j+2}`;
		if (!hasB) return { main: `β₍${j+1}₎: difference ${g2} − ${g1}.`, techNote: null };
		if (modelType === 'linear') {
			const dir = bv! > 0 ? 'higher' : 'lower';
			return { main: `${g2} scores ${sFmt(Math.abs(bv!))} ${dir} on ${y} than ${g1}, ${caveat()}`, techNote: null };
		}
		if (modelType === 'logistic') return {
			main: `${g2} has ${pct}% ${pctAdj} odds of ${y} compared to ${g1}, ${caveat()}`,
			techNote: `OR: ${expF}. (Log-odds coefficient: b = ${bvF}.)`
		};
		if (modelType === 'poisson' || modelType === 'negbin') return {
			main: `The expected count of ${y} in ${g2} is ${pct}% ${pctAdj} compared to ${g1}, ${caveat()}`,
			techNote: `IRR: ${expF}. (Log-count coefficient: b = ${bvF}.)`
		};
		if (modelType === 'cox') return {
			main: `The hazard of ${y} in ${g2} is ${pct}% ${pctAdj} compared to ${g1}, ${caveat()}`,
			techNote: `HR: ${expF}. (Log-hazard coefficient: b = ${bvF}.)`
		};
		return { main: `${g2} vs ${g1}: b = ${sFmt(bv!)}, exp(b) = ${expF}.`, techNote: null };
	}));

	// ── Copy text ──────────────────────────────────────────────────
	let continuousCopyText = $derived((() => {
		if (!continuousInterp) return '';
		const ci = continuousInterp;
		const parts = [ci.headline + (ci.caveat ? ', ' + ci.caveat : '')];
		if (ci.plain) parts.push(ci.plain);
		return parts.join(' ');
	})());

	let categoricalCopyText = $derived(
		`Intercept: ${interceptMeaning}\n` +
		coeffInterps.map((interp, j) =>
			`β${j+1}: ${interp.main}${interp.techNote ? ' ' + interp.techNote : ''}`
		).join('\n')
	);

	// ── Model type descriptions ────────────────────────────────────
	const modelDescriptions: Record<ModelType, {label: string; sub: string; desc: string}> = {
		linear:      { label: 'Linear (OLS)', sub: 'raw outcome', desc: 'b = unit change in Y per unit of X' },
		loglinear:   { label: 'Log-outcome (OLS)', sub: 'lm(log(Y) ~ X) — not logistic', desc: 'b ≈ % change in Y; exact: ×exp(b). Use when you ran lm(log(Y) ~ X), not glm().' },
		logistic:    { label: 'Logistic', sub: 'glm(family=binomial)', desc: 'b = log-OR; exp(b) = OR. For binary 0/1 outcomes via glm() or logit regression.' },
		ordlogistic: { label: 'Ordinal logistic', sub: 'proportional odds', desc: 'b = log-POR; exp(b) = proportional OR' },
		poisson:     { label: 'Poisson', sub: 'count outcome', desc: 'b = log-IRR; exp(b) = IRR' },
		negbin:      { label: 'Neg. binomial', sub: 'overdispersed counts', desc: 'Same IRR interpretation as Poisson' },
		cox:         { label: 'Cox / survival', sub: 'time-to-event', desc: 'b = log-HR; exp(b) = HR' }
	};

	const schemeDescriptions: Record<Scheme, string> = {
		dummy:   "One group is the reference; all others are compared to it. Intercept = reference group mean. Default in most software (R's contr.treatment, Python's get_dummies with drop_first=True).",
		effects: "Each group is compared to the grand mean. The reference group's coefficient equals the negative sum of the others. Intercept = grand mean. Called sum coding or contr.sum in R.",
		helmert: "Each group is compared to the mean of all previous groups (forward Helmert). Useful for ordered conditions.",
		sdif:    "Adjacent pairs are compared: G2−G1, G3−G2, etc. Ideal for ordered levels (time points, dosage). Each coefficient is a step difference."
	};

	// ── Formulas ───────────────────────────────────────────────────
	const formulas = [
		{
			title: 'Log-transformed outcome: back-transformation',
			latex: String.raw`\% \Delta Y \approx (e^b - 1) \times 100`,
			source: 'For a 1-unit increase in X when ln(Y) is the outcome. Approximation b×100 only accurate for |b| < 0.1.'
		},
		{
			title: 'Log-transformed predictor',
			latex: String.raw`\Delta Y \approx \frac{b}{100} \text{ per 1\% increase in } X`,
			source: 'A doubling of X changes Y by b × ln(2) ≈ 0.693b.'
		},
		{
			title: 'Log–log elasticity model',
			latex: String.raw`\% \Delta Y = b \times \% \Delta X`,
			source: 'Both outcome and predictor log-transformed. b = ∂ln(Y)/∂ln(X).'
		},
		{
			title: 'Odds ratio (logistic regression)',
			latex: String.raw`\text{OR} = e^b`,
			source: 'b is the log-odds coefficient. CI for OR: [exp(b − 1.96·SE), exp(b + 1.96·SE)].'
		},
		{
			title: 'Standardised coefficient (beta weight)',
			latex: String.raw`\beta = b \cdot \frac{SD_X}{SD_Y}`,
			source: 'Converting unstandardized b to β. When both X and Y are z-scored, β is returned directly by the model.'
		},
		{
			title: 'd ↔ logOR approximation (Borenstein)',
			latex: String.raw`\ln\text{OR} \approx d \cdot \frac{\pi}{\sqrt{3}}`,
			source: 'Approximation for standardised logistic coefficients. Borenstein et al. (2009).'
		}
	];

	// ── URL sync ───────────────────────────────────────────────────
	let mounted = $state(false); // must be $state so the $effect below can track it

	onMount(() => {
		const p = $page.url.searchParams;
		if (p.get('pred') === 'categorical') predType = 'categorical';
		if (p.get('study') === 'experimental') study = 'experimental';
		if (p.get('model')) modelType = p.get('model') as ModelType;
		if (p.get('scaleX')) scaleX = p.get('scaleX') as PredScale;
		if (p.get('varX'))  varX  = p.get('varX')!;
		if (p.get('varY'))  varY  = p.get('varY')!;
		if (p.get('unitsX')) unitsX = p.get('unitsX')!;
		if (p.get('unitsY')) unitsY = p.get('unitsY')!;
		if (p.get('b'))    bStr  = p.get('b')!;
		if (p.get('se'))   seStr = p.get('se')!;
		if (p.get('ciLo')) ciLoStr = p.get('ciLo')!;
		if (p.get('ciHi')) ciHiStr = p.get('ciHi')!;
		if (p.get('pval')) pStr  = p.get('pval')!;
		if (p.get('scheme')) scheme = p.get('scheme') as Scheme;
		const ng = parseInt(p.get('n') ?? '');
		if (!isNaN(ng) && ng >= 2 && ng <= 6) nGroups = ng;
		const gnames = p.get('groups');
		if (gnames) groupNames = gnames.split(',').map(s => s.trim());
		const ri = parseInt(p.get('ref') ?? '');
		if (!isNaN(ri)) refGroupIdx = ri;
		const bsParam = p.get('bs');
		if (bsParam) bValues = bsParam.split(',').map(s => s.trim());
		mounted = true;
	});

	$effect(() => {
		// Read all reactive deps first so Svelte tracks them regardless of the guard below
		const u = new URLSearchParams();
		u.set('pred', predType);
		u.set('study', study);
		u.set('model', modelType);
		if (predType === 'continuous') {
			u.set('scaleX', scaleX);
			if (varX)   u.set('varX', varX);
			if (varY)   u.set('varY', varY);
			if (unitsX) u.set('unitsX', unitsX);
			if (unitsY) u.set('unitsY', unitsY);
			if (bStr)   u.set('b', bStr);
			if (seStr)  u.set('se', seStr);
			if (ciLoStr) u.set('ciLo', ciLoStr);
			if (ciHiStr) u.set('ciHi', ciHiStr);
			if (pStr)   u.set('pval', pStr);
		} else {
			u.set('scheme', scheme);
			u.set('n', String(nGroups));
			u.set('groups', groupNames.join(','));
			u.set('ref', String(refGroupIdx));
			if (bValues.some(v => v)) u.set('bs', bValues.join(','));
		}
		// Guard goes AFTER reading deps — otherwise Svelte won't track them on first run
		if (!mounted) return;
		syncQuery(u);
	});

	function cellClass(v: number): string {
		if (v === 0)  return 'text-gray-400 bg-white';
		if (v > 0)    return 'text-emerald-800 bg-emerald-50 font-semibold';
		return 'text-red-800 bg-red-50 font-semibold';
	}
</script>

<Seo
	title="Coefficient Interpreter — explain your regression results | Magnitood"
	description="Interactive guide to interpreting regression coefficients for any model type (OLS, logistic, Poisson, Cox) and any coding scheme (dummy, effects, Helmert). Generates plain-English interpretation, OR/HR/IRR, and APA-style reporting."
	path="/regression-coefficients"
/>

<div style="background-color: #fefdf9; min-height: 100vh;">
<div class="h-1 bg-gradient-to-r from-teal-500 via-cyan-400 to-teal-400"></div>

<div class="mx-auto max-w-3xl px-4 py-10 space-y-6">

	<!-- Header -->
	<div>
		<h1 class="text-3xl font-bold text-gray-900 tracking-tight">Coefficient Interpreter</h1>
		<p class="mt-2 text-gray-500 text-sm leading-relaxed">
			Generate the correct plain-English interpretation for a regression coefficient,
			for any model type and variable scale.
		</p>
	</div>

	<!-- What is this? explainer -->
	<div class="rounded-2xl border border-teal-200 bg-teal-50/60 px-5 py-4 space-y-1.5">
		<p class="text-xs font-semibold text-teal-700 uppercase tracking-wide">What is this tool?</p>
		<p class="text-sm text-teal-900 leading-relaxed">
			You ran a regression and got one or several coefficients. This tool tells you what those numbers
			actually mean in plain English, based on your model type, variable scales, and coding scheme.
			It works for <strong>linear, logistic, ordinal logistic, Poisson, negative binomial,</strong> and
			<strong>Cox</strong> models — for both continuous and categorical predictors.
		</p>
	</div>

	<!-- ── Step 1: Study design + predictor type ─────────────────── -->
	<div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
		<!-- Study design -->
		<div class="space-y-2">
			<p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Study design</p>
			<div class="flex gap-2">
				{#each ([['observational', 'Observational'], ['experimental', 'Experimental / RCT']] as const) as [v, lbl]}
					<button
						onclick={() => { study = v; }}
						aria-pressed={study === v}
						class="flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors text-left
							{study === v ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}"
					>{lbl}</button>
				{/each}
			</div>
			<p class="text-xs text-gray-400 leading-snug">
				{study === 'observational'
					? 'Associations will be noted as non-causal in the interpretation.'
					: 'Causal language is appropriate for randomised designs.'}
			</p>
		</div>

		<div class="border-t border-gray-100"></div>

		<!-- Predictor type -->
		<div class="space-y-2">
			<p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Predictor type</p>
			<div class="flex gap-2">
				{#each ([['continuous', 'Continuous (numeric)'], ['categorical', 'Categorical (groups / dummies)']] as const) as [v, lbl]}
					<button
						onclick={() => { predType = v; }}
						aria-pressed={predType === v}
						class="flex-1 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-colors text-left
							{predType === v ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}"
					>{lbl}</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- ── Step 2: Model type ─────────────────────────────────────── -->
	<div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
		<p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Model type</p>
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
			{#each Object.entries(modelDescriptions) as [mt, info]}
				<button
					onclick={() => { modelType = mt as ModelType; }}
					aria-pressed={modelType === mt}
					class="rounded-xl border-2 px-3 py-2.5 text-left transition-colors
						{modelType === mt ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}"
				>
					<p class="text-sm font-semibold {modelType === mt ? 'text-teal-800' : 'text-gray-700'}">{info.label}</p>
					<p class="text-[11px] {modelType === mt ? 'text-teal-600' : 'text-gray-400'}">{info.sub}</p>
				</button>
			{/each}
		</div>
		<p class="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
			<strong class="text-gray-700">{modelDescriptions[modelType].label}:</strong>
			{modelDescriptions[modelType].desc}
		</p>

		{#if modelType === 'loglinear'}
			<div class="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-900 leading-relaxed space-y-1.5">
				<p class="font-semibold text-sky-800">What does exp() mean?</p>
				<p>exp(x) means raising the number e (≈ 2.718) to the power x — it is the reverse of the natural log. Your calculator may label it eˣ or exp. For example, exp(0.23) ≈ 1.26, meaning a 26% increase. For small coefficients (|b| &lt; 0.1), simply multiplying b × 100 gives roughly the same answer.</p>
			</div>
		{/if}

		{#if modelType === 'linear' && predType === 'continuous'}
			<p class="text-xs text-gray-400 leading-relaxed">
				<strong class="text-gray-500">Log-transformed predictor (X)?</strong> Keep Linear (OLS) selected above, then set “Scale of predictor” to “Log-transformed” in the variable setup below.
			</p>
		{/if}
	</div>

	<!-- ══════════════════════ CONTINUOUS ══════════════════════════ -->
	{#if predType === 'continuous'}

		<!-- Step 3: Variable setup -->
		<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
			<h2 class="text-base font-semibold text-gray-900">Variable setup</h2>

			<!-- Predictor -->
			<div class="space-y-3">
				<p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Predictor (X)</p>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<label for="varX" class="block text-xs font-medium text-gray-700">Name</label>
						<input id="varX" type="text" bind:value={varX} placeholder="e.g. age"
							class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
					</div>
					<div class="space-y-1">
						<label for="unitsX" class="block text-xs font-medium text-gray-700">Units <span class="text-gray-400">(optional)</span></label>
						<input id="unitsX" type="text" bind:value={unitsX} placeholder="e.g. years"
							class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
					</div>
				</div>
				<div class="space-y-1">
					<p class="text-xs font-medium text-gray-700">Scale of predictor</p>
					<div class="flex flex-wrap gap-2">
						{#each ([['raw', 'Raw / original units'], ['std', 'Standardized (z-score)'], ['log', 'Log-transformed  ln(X)']] as const) as [s, lbl]}
							<button onclick={() => { scaleX = s; }}
								aria-pressed={scaleX === s}
								class="rounded-full px-3 py-1 text-sm font-medium transition-colors
									{scaleX === s ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
							>{lbl}</button>
						{/each}
					</div>
					{#if scaleX === 'std'}
						<p class="text-xs text-gray-500 leading-relaxed">
							Enter the raw coefficient (b) from your software output. The interpretation will describe it as “per 1-SD increase in X.” This assumes your predictor was z-scored before running the model (e.g. <code class="font-mono text-[11px] bg-gray-100 px-1 rounded">scale(X)</code> in R). If you have a standardized β from SPSS, this applies only if X was z-scored.
						</p>
					{/if}
				</div>
			</div>

			<div class="border-t border-gray-100"></div>

			<!-- Outcome -->
			<div class="space-y-3">
				<p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Outcome (Y)</p>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<label for="varY" class="block text-xs font-medium text-gray-700">Name</label>
						<input id="varY" type="text" bind:value={varY}
							placeholder="{modelType === 'logistic' ? 'e.g. mortality' : modelType === 'cox' ? 'e.g. relapse' : modelType === 'poisson' || modelType === 'negbin' ? 'e.g. hospital admissions' : 'e.g. blood pressure'}"
							class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
					</div>
					<div class="space-y-1">
						<label for="unitsY" class="block text-xs font-medium text-gray-700">Units <span class="text-gray-400">(optional)</span></label>
						<input id="unitsY" type="text" bind:value={unitsY}
							placeholder="{modelType === 'linear' || modelType === 'loglinear' ? 'e.g. mmHg' : ''}"
							class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
					</div>
				</div>
			</div>

			<div class="border-t border-gray-100"></div>

			<!-- Coefficient + optional fields -->
			<div class="space-y-3">
				<div class="space-y-1">
					<label for="bInput" class="block text-sm font-semibold text-gray-700">
						Coefficient (b)
						<span class="text-xs font-normal text-gray-400 ml-1">from your regression output</span>
					</label>
					<input id="bInput" type="text" inputmode="decimal" bind:value={bStr}
						placeholder="e.g. 0.24 or −1.87"
						class="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-400" />
				</div>

				<!-- Optional: SE, CI, p-value -->
				<button
					onclick={() => { showOptional = !showOptional; }}
					class="text-xs text-teal-600 hover:text-teal-800 font-medium"
				>
					{showOptional ? '− Hide' : '+ Add'} SE, CI, p-value (for APA reporting)
				</button>

				{#if showOptional}
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<div class="space-y-1">
							<label for="seInput" class="block text-xs font-medium text-gray-700">SE</label>
							<input id="seInput" type="text" inputmode="decimal" bind:value={seStr}
								placeholder="e.g. 0.12"
								class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-400" />
						</div>
						<div class="space-y-1">
							<label for="ciLoInput" class="block text-xs font-medium text-gray-700">95% CI lower</label>
							<input id="ciLoInput" type="text" inputmode="decimal" bind:value={ciLoStr}
								placeholder="e.g. 0.01"
								class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-400" />
						</div>
						<div class="space-y-1">
							<label for="ciHiInput" class="block text-xs font-medium text-gray-700">95% CI upper</label>
							<input id="ciHiInput" type="text" inputmode="decimal" bind:value={ciHiStr}
								placeholder="e.g. 0.47"
								class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-400" />
						</div>
						<div class="space-y-1">
							<label for="pInput" class="block text-xs font-medium text-gray-700">p-value</label>
							<input id="pInput" type="text" inputmode="decimal" bind:value={pStr}
								placeholder="e.g. 0.023"
								class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-400" />
						</div>
					</div>
					<p class="text-xs text-gray-400">If you enter SE but not CI, the 95% CI will be computed as b ± 1.96 × SE.</p>
				{/if}
			</div>
		</div>

		<!-- Interpretation output -->
		{#if continuousInterp}
			{@const ci = continuousInterp}
			<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
				<div class="border-l-4 border-teal-500 p-5 space-y-3 relative">
					<div class="absolute right-3 top-3">
						<CopyButton text={continuousCopyText} title="Copy interpretation" />
					</div>

					<!-- Warning -->
					{#if ci.warning}
						<p class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
							{ci.warning}
						</p>
					{/if}

					<!-- Headline + caveat -->
					<p class="text-[15px] leading-relaxed text-gray-800 pr-8">
						{ci.headline}{#if ci.caveat},&thinsp;<span class="text-gray-400 text-sm">{ci.caveat}</span>{/if}
					</p>

					<!-- Technical detail + log-b parenthetical -->
					{#if ci.plain}
						<p class="text-sm text-gray-400 leading-relaxed italic">{ci.plain}</p>
					{/if}

					<!-- exp(b) educational note for log-scale models -->
					{#if (isMultiplicative || modelType === 'loglinear') && b !== null && Math.abs(b) > 0.1}
						{@const _bF  = sFmt(b, 3)}
						{@const _expB = Math.exp(b)}
						{@const _expF = sFmt(_expB, 3)}
						{@const _pct  = sFmt(Math.abs((_expB - 1) * 100), 1)}
						{@const _dir  = _expB > 1 ? 'increase' : 'decrease'}
						{@const _approx = sFmt(Math.abs(b * 100), 1)}
						<p class="text-xs text-gray-400 italic leading-relaxed">
							Why not {_approx}%? On a log scale, a coefficient of {_bF} means multiplying by exp({_bF}) = {_expF}, i.e. a {_pct}% {_dir}. The approximation b × 100 ≈ % change only holds for small coefficients (|b| &lt; 0.1).
						</p>
					{/if}

					<!-- Exponentiated value line -->
					{#if ci.expLine}
						<div class="inline-flex items-center gap-2 rounded-lg bg-teal-50 border border-teal-200 px-3 py-2">
							<span class="text-xs font-semibold text-teal-700 uppercase tracking-wide">{expLabel}</span>
							<span class="text-sm font-mono font-semibold text-teal-900">{ci.expLine.split('=')[1]?.split('(')[0]?.trim() ?? ''}</span>
							{#if effectiveCILo !== null && effectiveCIHi !== null && expLabel}
								<span class="text-xs text-teal-600">
									95% CI [{fmt(Math.exp(effectiveCILo))}, {fmt(Math.exp(effectiveCIHi))}]
								</span>
							{/if}
						</div>
					{/if}

					<!-- Assumption note -->
					{#if ci.assumption}
						<p class="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 leading-relaxed">
							{ci.assumption}
						</p>
					{/if}

					<!-- Link to binary outcomes for logistic -->
					{#if modelType === 'logistic'}
						<p class="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 leading-relaxed">
							Want NNT, risk difference, and more? Use the <a href="{base}/binary-outcomes" class="underline font-medium">Risk & Odds</a> page to convert an OR into all risk measures.
						</p>
					{/if}
				</div>

				<!-- APA reporting -->
				{#if apaLine && (hasOptionalData || b !== null)}
					<div class="border-t border-gray-100">
						<details>
							<summary class="flex items-center justify-between px-5 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer list-none focus:outline-none">
								<span class="text-xs font-semibold text-gray-600">APA-style reporting</span>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-gray-400">
									<path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
								</svg>
							</summary>
							<div class="px-5 py-4 space-y-2">
								<div class="flex items-start justify-between gap-3">
									<code class="text-xs bg-gray-100 rounded px-2 py-1.5 flex-1 leading-relaxed text-gray-800">{apaLine}</code>
									<CopyButton text={apaLine} title="Copy APA line" />
								</div>
								{#if !hasOptionalData}
									<p class="text-xs text-gray-400">Add SE, CI, or p-value above for a complete APA line.</p>
								{/if}
							</div>
						</details>
					</div>
				{/if}
			</div>
		{:else}
			<div class="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center text-sm text-gray-400">
				Enter a coefficient above to see the interpretation.
			</div>
		{/if}

		<!-- Quick reference table -->
		<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<details>
				<summary class="flex items-center justify-between px-5 py-3.5 text-left bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer list-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-400">
					<span class="text-sm font-semibold text-gray-700">Scale combination quick reference</span>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-gray-400">
						<path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
					</svg>
				</summary>
				<div class="px-5 py-4 overflow-x-auto">
					<table class="w-full text-xs border-collapse">
						<thead>
							<tr class="bg-gray-50 text-gray-500 uppercase tracking-wide">
								<th class="px-3 py-2 text-left font-medium border border-gray-200">Predictor scale</th>
								<th class="px-3 py-2 text-left font-medium border border-gray-200">Model type</th>
								<th class="px-3 py-2 text-left font-medium border border-gray-200">b means…</th>
							</tr>
						</thead>
						<tbody class="text-gray-700">
							{#each [
								['Raw',           'Linear (OLS)',     'Unit change in Y per 1-unit increase in X'],
								['Raw',           'Log-outcome',      '≈ b×100% change in Y (exact: ×exp(b))'],
								['Raw',           'Logistic',         'Log-OR per 1-unit X; OR = exp(b)'],
								['Raw',           'Poisson',          'Log-IRR per 1-unit X; IRR = exp(b)'],
								['Raw',           'Cox',              'Log-HR per 1-unit X; HR = exp(b)'],
								['Standardized',  'Linear (OLS)',     'Unit change in Y per 1-SD increase in X'],
								['Standardized',  'Standardized Y',   'SD change in Y per 1-SD X (= beta weight)'],
								['Standardized',  'Logistic',         'Log-OR per 1-SD X; d ≈ b × √3/π'],
								['Log-transformed','Linear (OLS)',     '≈ b/100 change in Y per 1% increase in X'],
								['Log-transformed','Log-outcome',      'Elasticity: b% change in Y per 1% change in X'],
							] as [sx, mt, desc]}
								<tr class="hover:bg-gray-50">
									<td class="px-3 py-2 border border-gray-100 font-mono">{sx}</td>
									<td class="px-3 py-2 border border-gray-100">{mt}</td>
									<td class="px-3 py-2 border border-gray-100">{desc}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</details>
		</div>

	<!-- ══════════════════════ CATEGORICAL ═════════════════════════ -->
	{:else}

		<!-- Scheme + groups -->
		<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
			<h2 class="text-base font-semibold text-gray-900">Coding scheme</h2>

			<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{#each Object.entries(schemeDescriptions) as [s, _]}
					{@const labels: Record<string, [string, string]> = {
						dummy:   ['Dummy', '(treatment / reference)'],
						effects: ['Effects', '(sum / deviation)'],
						helmert: ['Helmert', '(forward)'],
						sdif:    ['Successive diff.', '(adjacent pairs)']
					}}
					<button
						onclick={() => { scheme = s as Scheme; }}
						aria-pressed={scheme === s}
						class="rounded-xl border-2 px-3 py-2.5 text-left transition-colors
							{scheme === s ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}"
					>
						<p class="text-sm font-semibold {scheme === s ? 'text-teal-800' : 'text-gray-700'}">{labels[s][0]}</p>
						<p class="text-[11px] {scheme === s ? 'text-teal-600' : 'text-gray-400'}">{labels[s][1]}</p>
					</button>
				{/each}
			</div>
			<p class="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{schemeDescriptions[scheme]}</p>

		<!-- Help me identify coding scheme -->
		<div class="rounded-2xl border border-amber-200 bg-amber-50/50 shadow-sm overflow-hidden">
			<details>
				<summary class="flex items-center justify-between px-5 py-3.5 text-left hover:bg-amber-50 transition-colors cursor-pointer list-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-400">
					<span class="text-sm font-semibold text-amber-800">Help me identify my coding scheme</span>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-amber-500 shrink-0">
						<path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
					</svg>
				</summary>
				<div class="px-5 pb-5 pt-2 space-y-6 text-sm text-gray-700">
					<p class="text-xs text-amber-700 leading-relaxed">
						Look at your regression output table. The pattern of rows tells you which coding your software used.
					</p>

					<!-- Dummy / treatment coding -->
					<div class="space-y-2">
						<h4 class="font-semibold text-gray-800">Dummy coding (treatment/reference) — the most common</h4>
						<pre class="rounded-lg bg-white border border-gray-200 px-4 py-3 text-xs font-mono leading-relaxed text-gray-700 overflow-x-auto">             b      SE      p
(Intercept) 5.2    1.1   .000
GroupB      10.4   1.5   .000
GroupC       4.6   1.4   .001</pre>
						<p class="text-xs text-gray-600 leading-relaxed bg-white rounded-lg border border-gray-100 px-3 py-2">
							<strong>If your output looks like this</strong> — one group is completely absent from the table and you see an Intercept row — you have dummy/treatment coding.
							The missing group (here: Group A) is the <em>reference</em>. Each coefficient is the difference between that group and the reference.
							The intercept is the predicted outcome for the reference group (when all other predictors = 0).
							This is the default in R (<code>contr.treatment</code>), Python’s <code>pd.get_dummies(drop_first=True)</code>, and SPSS.
						</p>
					</div>

					<!-- Effects / sum coding -->
					<div class="space-y-2">
						<h4 class="font-semibold text-gray-800">Effects coding (sum/deviation)</h4>
						<pre class="rounded-lg bg-white border border-gray-200 px-4 py-3 text-xs font-mono leading-relaxed text-gray-700 overflow-x-auto">             b      SE      p
(Intercept) 11.8   0.9   .000
Group1       3.4   1.2   .005
Group2      -1.2   1.1   .277</pre>
						<p class="text-xs text-gray-600 leading-relaxed bg-white rounded-lg border border-gray-100 px-3 py-2">
							<strong>If your output shows k−1 groups and the intercept differs notably from any group’s raw mean</strong>, you likely have effects/sum coding.
							The intercept is the <em>unweighted grand mean</em> across all groups, not any single group’s mean.
							Each coefficient is that group’s deviation from the grand mean.
							The reference group’s coefficient (not shown) equals the negative sum of all reported coefficients.
							Used in R with <code>contr.sum</code>.
						</p>
					</div>

					<!-- Helmert -->
					<div class="space-y-2">
						<h4 class="font-semibold text-gray-800">Helmert coding</h4>
						<p class="text-xs text-gray-600 leading-relaxed bg-white rounded-lg border border-gray-100 px-3 py-2">
							Helmert coding compares each group to the <em>mean of all preceding groups</em> (forward Helmert, R’s <code>contr.helmert</code>).
							The coefficients do not correspond to simple pairwise differences and are rarely encountered outside designed experiments.
							<strong>Caution:</strong> different software implements Helmert differently (forward vs. backward). Always check your software’s documentation.
							If your coefficients have unusual magnitudes that don’t match any pairwise differences in your data, Helmert coding is a likely culprit.
						</p>
					</div>

					<!-- Successive differences -->
					<div class="space-y-2">
						<h4 class="font-semibold text-gray-800">Successive differences (SDIF / adjacent pairs)</h4>
						<p class="text-xs text-gray-600 leading-relaxed bg-white rounded-lg border border-gray-100 px-3 py-2">
							Each coefficient is the difference between adjacent groups: Group 2 − Group 1, Group 3 − Group 2, etc.
							Clearest for ordered levels (time points, dosage steps).
							Used in R’s <code>MASS::contr.sdif</code>. If each coefficient approximately matches the raw difference between consecutive group means, you have this coding.
						</p>
					</div>
				</div>
			</details>
		</div>


			<div class="border-t border-gray-100"></div>

			<!-- nGroups -->
			<div class="flex items-center gap-3">
				<span class="text-sm font-medium text-gray-700">Groups:</span>
				<div class="flex items-center gap-1">
					<button onclick={() => { if (nGroups > 2) nGroups--; }}
						class="w-7 h-7 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 flex items-center justify-center text-lg leading-none"
						disabled={nGroups <= 2}
					>−</button>
					<span class="w-8 text-center font-semibold text-gray-900">{nGroups}</span>
					<button onclick={() => { if (nGroups < 6) nGroups++; }}
						class="w-7 h-7 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 flex items-center justify-center text-lg leading-none"
						disabled={nGroups >= 6}
					>+</button>
				</div>
				<span class="text-xs text-gray-400">→ {nGroups - 1} contrast{nGroups > 2 ? 's' : ''}</span>
			</div>

			<!-- Group names -->
			<div class="space-y-2">
				<p class="text-xs font-medium text-gray-700">Group names</p>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
					{#each groupNames as gname, i}
						<div class="flex items-center gap-1.5">
							<span class="text-xs text-gray-400 w-4 shrink-0">{i+1}.</span>
							<input type="text" value={gname}
								oninput={(e) => setGroupName(i, (e.target as HTMLInputElement).value)}
								placeholder="Group {i+1}"
								class="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
						</div>
					{/each}
				</div>
			</div>

			<!-- Reference group -->
			{#if scheme === 'dummy' || scheme === 'effects'}
				<div class="space-y-1">
					<label for="refGroup" class="block text-xs font-medium text-gray-700">
						{scheme === 'dummy' ? 'Reference group (omitted category)' : 'Reference group (coded −1 on all contrasts)'}
					</label>
					<select id="refGroup" bind:value={refGroupIdx}
						class="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
						{#each groupNames as gname, i}
							<option value={i}>{gname || `Group ${i+1}`}</option>
						{/each}
					</select>
				</div>
				{#if scheme === 'effects'}
					<div class="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-900 leading-relaxed space-y-1.5">
						<p class="font-semibold text-amber-800">Why is there still a reference group in effects coding?</p>
						<p>Effects coding designates one group differently (coded −1 on every contrast column), but that group's coefficient is never shown in your software output — it is implied by the rule that all group deviations sum to zero.</p>
						<p>For example, if your software reports β₁ = +3.4 and β₂ = −1.2, the reference group's implied deviation is −(3.4 + (−1.2)) = −2.2. Your choice of reference group does not change any of the reported coefficients or the overall model fit.</p>
					</div>
				{/if}
			{/if}

			<!-- Outcome name -->
			<div class="border-t border-gray-100 pt-4 space-y-1">
				<label for="varYCat" class="block text-xs font-medium text-gray-700">
					Outcome name <span class="text-gray-400 font-normal">(optional)</span>
				</label>
				<input id="varYCat" type="text" bind:value={varY}
					placeholder="{modelType === 'logistic' ? 'e.g. mortality' : modelType === 'cox' ? 'e.g. relapse' : 'e.g. test score'}"
					class="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
			</div>

			<!-- Coefficient values -->
			<div class="space-y-2">
				<p class="text-xs font-medium text-gray-700">
					Coefficient values <span class="text-gray-400 font-normal">(optional)</span>
				</p>
				{#each bValues as bv, j}
					<div class="flex items-center gap-3">
						<span class="text-xs text-gray-500 min-w-0 flex-1 truncate">β₍{j+1}₎ — {contrastHeaders[j] ?? ''}</span>
						<input type="text" inputmode="decimal" value={bv}
							oninput={(e) => setBValue(j, (e.target as HTMLInputElement).value)}
							placeholder="e.g. 2.4"
							class="w-24 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-400" />
					</div>
				{/each}
			</div>
		</div>

		<!-- Coding matrix -->
		<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<div class="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
				<div>
					<h2 class="text-sm font-semibold text-gray-700">Coding matrix</h2>
					<p class="text-xs text-gray-400 mt-0.5">Rows = groups · Columns = contrasts</p>
				</div>
				<CopyButton text={categoricalCopyText} title="Copy interpretations" />
			</div>
			<div class="p-5 overflow-x-auto">
				<table class="text-sm border-collapse" aria-label="Coding matrix">
					<thead>
						<tr>
							<th class="px-3 py-2 text-left text-xs font-medium text-gray-500 border border-gray-200 bg-gray-50">Group</th>
							{#each contrastHeaders as hdr, j}
								<th class="px-3 py-2 text-center text-xs font-medium text-gray-500 border border-gray-200 bg-gray-50">
									β₍{j+1}₎<br/><span class="font-normal text-gray-400 text-[10px]">{hdr}</span>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each groupNames as gname, i}
							<tr class="{i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}">
								<td class="px-3 py-2 font-medium text-gray-700 border border-gray-200">
									{gname || `Group ${i+1}`}
									{#if (scheme === 'dummy' || scheme === 'effects') && i === refGroupIdx}
										<span class="ml-1 text-[10px] text-gray-400">(ref)</span>
									{/if}
								</td>
								{#each matrix[i] as code, j}
									<td class="px-3 py-2 text-center tabular-nums border border-gray-200 {cellClass(code)}">
										{code}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Categorical interpretation -->
		<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<div class="border-l-4 border-teal-500 p-5 space-y-4">
				<p class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Interpretation</p>

				<div class="space-y-1">
					<p class="text-xs font-medium text-gray-500">Intercept (β₀)</p>
					<p class="text-sm text-gray-800 leading-relaxed">{interceptMeaning}</p>
				</div>

				<div class="border-t border-gray-100 pt-3 space-y-4">
					{#each coeffInterps as interp, j}
						<div class="space-y-1">
							<div class="flex items-center justify-between gap-2">
								<p class="text-xs font-semibold text-gray-500">β₍{j+1}₎ — {contrastHeaders[j] ?? ''}</p>
								<CopyButton text={interp.main + (interp.techNote ? ' ' + interp.techNote : '')} title="Copy" />
							</div>
							<p class="text-sm text-gray-800 leading-relaxed">{interp.main}</p>
							{#if interp.techNote}
								<p class="text-xs text-gray-400 italic leading-relaxed">{interp.techNote}</p>
							{/if}
							{#if (isMultiplicative || modelType === 'loglinear') && (() => { const v = parseFloat(bValues[j]); return !isNaN(v) && Math.abs(v) > 0.1; })()}
								{@const _bv   = parseFloat(bValues[j])}
								{@const _expB = Math.exp(_bv)}
								{@const _bF   = sFmt(_bv, 3)}
								{@const _expF = sFmt(_expB, 3)}
								{@const _pct  = sFmt(Math.abs((_expB - 1) * 100), 1)}
								{@const _dir  = _expB > 1 ? 'increase' : 'decrease'}
								{@const _approx = sFmt(Math.abs(_bv * 100), 1)}
								<p class="text-xs text-gray-400 italic leading-relaxed mt-0.5">
									Why not {_approx}%? A coefficient of {_bF} means multiplying by exp({_bF}) = {_expF}, i.e. a {_pct}% {_dir}. The approximation b × 100 ≈ % change only holds for small coefficients (|b| &lt; 0.1).
								</p>
							{/if}
						</div>
					{/each}
				</div>

				{#if scheme === 'effects'}
					<div class="border-t border-gray-100 pt-3 space-y-1.5">
						{#if impliedCoeff !== null}
							{@const _ie = Math.exp(impliedCoeff)}
							{@const _ipct = sFmt(Math.abs((_ie - 1) * 100), 1)}
							{@const _idir = _ie > 1 ? 'higher' : 'lower'}
							<p class="text-xs text-gray-700 leading-relaxed">
								<span class="font-semibold">{groupNames[refGroupIdx] || 'Reference'} (implied, not shown by software):</span>
								b = {sFmt(impliedCoeff)}{#if modelType === 'loglinear' || isMultiplicative}, exp(b) = {sFmt(_ie, 2)} (→ {_ipct}% {_idir} than average){/if}.
								Computed as −(sum of all reported coefficients).
							</p>
						{:else}
							<p class="text-xs text-gray-400 leading-relaxed">
								The {groupNames[refGroupIdx] || 'reference'} group has an implied coefficient = −(β₁ + β₂ + …). Enter all coefficients above to compute it.
							</p>
						{/if}
						{#if modelType === 'loglinear' || isMultiplicative}
							<p class="text-xs text-gray-400 leading-relaxed">
								<span class="font-medium">Technical note:</span> “The average across all categories” is technically the geometric mean on a log scale — in practice simply treat it as the overall average.
							</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Which scheme? -->
		<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<details>
				<summary class="flex items-center justify-between px-5 py-3.5 text-left bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer list-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-400">
					<span class="text-sm font-semibold text-gray-700">Which coding scheme should I use?</span>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-gray-400">
						<path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
					</svg>
				</summary>
				<div class="px-5 py-4 space-y-3 text-sm text-gray-700 leading-relaxed">
					<p><strong>Dummy coding</strong> is the default in most software. Use it when you have a natural reference group (control, baseline, majority). All coefficients compare another group to that reference.</p>
					<p><strong>Effects coding</strong> is preferred when there is no natural reference, or when you want coefficients that represent deviations from the grand mean. The intercept becomes the grand mean, often more interpretable in factorial designs.</p>
					<p><strong>Helmert coding</strong> tests whether each successive group changes the running average. Useful in ordered conditions when you want to know if adding each level matters.</p>
					<p><strong>Successive differences</strong> directly tests adjacent steps: G2 vs G1, G3 vs G2, etc. Ideal for ordered levels such as dosage or time points. The simplest to explain to a reader.</p>
					<p class="text-xs text-gray-400 border-t border-gray-100 pt-3">All schemes produce identical model fit. The choice affects only what the coefficients and intercept represent.</p>
				</div>
			</details>
		</div>

	{/if}

	<!-- Formulas -->
	<FormulaAccordion {formulas} />

	<div class="flex items-center justify-end gap-3 mt-2">
		<ShareButton />
		<CitationSnippet />
	</div>

	<!-- References -->
	<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
		<details>
			<summary class="flex items-center justify-between px-5 py-3.5 text-left bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer list-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-400">
				<span class="text-sm font-semibold text-gray-700">References</span>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-gray-400">
					<path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
				</svg>
			</summary>
			<div>
				<ul class="px-5 py-4 space-y-2 text-xs text-gray-600 leading-relaxed">
					<li>Borenstein, M., Hedges, L. V., Higgins, J. P. T., &amp; Rothstein, H. R. (2009). <em>Introduction to meta-analysis.</em> Wiley.</li>
					<li>Gelman, A., &amp; Hill, J. (2007). <em>Data analysis using regression and multilevel/hierarchical models.</em> Cambridge University Press.</li>
					<li>Hosmer, D. W., Lemeshow, S., &amp; May, S. (2008). <em>Applied survival analysis</em> (2nd ed.). Wiley.</li>
					<li>Schad, D. J., Vasishth, S., Hohenstein, S., &amp; Kliegl, R. (2020). How to capitalize on a priori contrasts in linear (mixed) models. <em>Journal of Memory and Language, 110</em>, 104038.</li>
					<li>Venables, W. N., &amp; Ripley, B. D. (2002). <em>Modern applied statistics with S</em> (4th ed.). Springer.</li>
				</ul>
			</div>
		</details>
	</div>

</div><!-- /max-w-3xl -->
</div><!-- /background -->
