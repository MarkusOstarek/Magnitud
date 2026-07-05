<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	import VariancePlot from '$lib/components/VariancePlot.svelte';
	import BenchmarkRibbon from '$lib/components/BenchmarkRibbon.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import PlotDownloadButton from '$lib/components/PlotDownloadButton.svelte';
	import FormulaAccordion from '$lib/components/FormulaAccordion.svelte';
	import CitationSnippet from '$lib/components/CitationSnippet.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import { sanitizeFilename } from '$lib/utils/downloadPlot.js';

	import type { Family3Inputs, Family3Results, Family3InputType, DesignType } from '$lib/types/variance.js';
	import {
		partialEta2FromF,
		omega2FromF,
		cohensF,
		cohensFSq,
		eta2FromCohensF,
		partialEta2FromSS,
		eta2FromSS,
		omega2FromSS,
		partialOmega2FromSS,
		ciPartialEta2
	} from '$lib/math/variance.js';
	import { parseNumber } from '$lib/math/conversions.js';

	// ── Design type (separate from input type) ────────────────────
	let designType = $state<DesignType>('one-way');

	const designOptions: { value: DesignType; label: string; short: string }[] = [
		{ value: 'one-way',   label: 'One-way between-subjects',   short: 'One-way' },
		{ value: 'factorial', label: 'Factorial between-subjects',  short: 'Factorial' },
		{ value: 'repeated',  label: 'Repeated-measures / within-subjects', short: 'Repeated' },
		{ value: 'mixed',     label: 'Mixed design',                short: 'Mixed' }
	];

	// ── Input state ────────────────────────────────────────────────
	let inputs = $state<Family3Inputs>({
		inputType: 'F',
		fStr: '',
		dfNumStr: '',
		dfDenStr: '',
		tStr: '',
		eta2Str: '',
		partialEta2Str: '',
		cohensFStr: '',
		r2Str: '',
		ssEffStr: '',
		ssErrorStr: '',
		ssTotalStr: '',
		dfEffStr: '',
		dfErrorStr: ''
	});

	// ── Two-group toggle (for equiv d section) ────────────────────
	let twoGroupOverride = $state(false);
	let pasteText = $state('');
	let pasteOpen = $state(false);

	type ParsedPaste =
		| { type: 'r_lm'; predictors: { name: string; t: string }[]; dfError: string; label: string }
		| { type: 't'; t: string; dfError: string; label: string }
		| { type: 'F'; F: string; dfNum: string; dfDen: string; label: string }
		| { type: 'eta2'; eta2: string; label: string }
		| { type: 'partial_eta2'; partial_eta2: string; label: string }
		| { type: 'cohensF'; cohensF: string; label: string };

	let parsedPaste = $derived.by((): ParsedPaste | null => {
		const txt = pasteText;

		// ── R lm() summary format ─────────────────────────────────────────
		// "Residual standard error: X on N degrees of freedom"
		const dfErrMatch = txt.match(/on\s+(\d+)\s+degrees? of freedom/i);
		// Coefficient rows: name  estimate  std.err  t-value  p-value  [stars]
		// Each row: anything, then 2+ spaces, then float, float, float, anything
		const rowRe = /^(.+?)\s{2,}(-?\d+\.\d+)\s+(\d+\.\d+)\s+(-?\d+\.\d+)\s+/gm;
		const rows = [...txt.matchAll(rowRe)];
		if (dfErrMatch && rows.length > 0) {
			const dfError = dfErrMatch[1];
			const predictors = rows.map(m => ({ name: m[1].trim(), t: m[4] }));
			return { type: 'r_lm', predictors, dfError,
				label: `R lm() output (${predictors.length} predictor${predictors.length !== 1 ? 's' : ''})` };
		}

		// ── t(df) = X ─────────────────────────────────────────────────────
		const tDfMatch = txt.match(/t\s*[\(\[]\s*(\d+)\s*[\)\]]\s*=\s*(-?\d+(?:\.\d+)?)/i);
		if (tDfMatch) return { type: 't', t: tDfMatch[2], dfError: tDfMatch[1],
			label: `t(${tDfMatch[1]}) = ${tDfMatch[2]}` };

		// ── F(df1, df2) = X ───────────────────────────────────────────────
		const fMatch = txt.match(/F\s*[\(\[]\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*[\)\]]\s*=\s*(\d+(?:\.\d+)?)/i);
		if (fMatch) return { type: 'F', F: fMatch[3], dfNum: fMatch[1], dfDen: fMatch[2],
			label: `F(${fMatch[1]}, ${fMatch[2]}) = ${fMatch[3]}` };

		// ── eta-squared ───────────────────────────────────────────────────
		const petaMatch = txt.match(/partial\s+(?:η²|eta[\s-]?squared|eta2)\s*=\s*(0?\.\d+)/i);
		if (petaMatch) return { type: 'partial_eta2', partial_eta2: petaMatch[1],
			label: `partial η² = ${petaMatch[1]}` };
		const etaMatch = txt.match(/(?:η²|eta[\s-]?squared|eta2)\s*=\s*(0?\.\d+)/i);
		if (etaMatch) return { type: 'eta2', eta2: etaMatch[1],
			label: `η² = ${etaMatch[1]}` };

		// ── Cohen's f ─────────────────────────────────────────────────────
		// Lookbehind prevents matching the "f" inside "df = ..."
		const fSqMatch = txt.match(/(?:Cohen'?s?\s+)?(?<![a-z])f\s*=\s*(0?\.\d+)/i);
		if (fSqMatch) return { type: 'cohensF', cohensF: fSqMatch[1],
			label: `Cohen's f = ${fSqMatch[1]}` };

		return null;
	});

	function applyPaste() {
		const p = parsedPaste;
		if (!p) return;
		if (p.type === 't') {
			inputs.inputType = 't';
			inputs.tStr = p.t;
			inputs.dfErrorStr = p.dfError;
		} else if (p.type === 'F') {
			inputs.inputType = 'F';
			inputs.fStr = p.F;
			inputs.dfNumStr = p.dfNum;
			inputs.dfDenStr = p.dfDen;
		} else if (p.type === 'eta2') {
			inputs.inputType = 'eta2';
			inputs.eta2Str = p.eta2;
		} else if (p.type === 'partial_eta2') {
			inputs.inputType = 'partial_eta2';
			inputs.partialEta2Str = p.partial_eta2;
		} else if (p.type === 'cohensF') {
			inputs.inputType = 'cohens_f';
			inputs.cohensFStr = p.cohensF;
		}
		// r_lm is handled per-predictor via applyRlmPredictor
		if (p.type !== 'r_lm') {
			pasteText = '';
			pasteOpen = false;
		}
	}

	function applyRlmPredictor(t: string, dfError: string) {
		inputs.inputType = 't';
		inputs.tStr = t;
		inputs.dfErrorStr = dfError;
		pasteText = '';
		pasteOpen = false;
	}

	// Is this detectably a two-group design?
	let isTwoGroup = $derived.by(() => {
		if (inputs.inputType === 'F') {
			const dfNum = parseNumber(inputs.dfNumStr);
			return dfNum === 1;
		}
		if (inputs.inputType === 'ss') {
			const dfEff = parseNumber(inputs.dfEffStr);
			return dfEff === 1;
		}
		return twoGroupOverride;
	});

	let dfNumOver1 = $derived.by(() => {
		if (inputs.inputType === 'F') {
			const dfNum = parseNumber(inputs.dfNumStr);
			return dfNum !== null && dfNum > 1;
		}
		if (inputs.inputType === 'ss') {
			const dfEff = parseNumber(inputs.dfEffStr);
			return dfEff !== null && dfEff > 1;
		}
		return false;
	});

	// ── Plot SVG ref ───────────────────────────────────────────────
	let varSvgEl = $state<SVGSVGElement | undefined>();
	let plotFilename = $derived(`variance-${sanitizeFilename(inputs.inputType)}`);

	// ── Validation ────────────────────────────────────────────────
	let errors = $derived.by(() => {
		const e = new Map<string, string>();
		const it = inputs.inputType;

		if (it === 'F') {
			const F = parseNumber(inputs.fStr);
			const dfNum = parseNumber(inputs.dfNumStr);
			const dfDen = parseNumber(inputs.dfDenStr);
			if (inputs.fStr !== '' && (F === null || !Number.isFinite(F) || F < 0))
				e.set('F', 'Must be a non-negative number.');
			if (inputs.dfNumStr !== '' && (dfNum === null || !Number.isInteger(dfNum) || dfNum < 1))
				e.set('dfNum', 'Must be a whole number ≥ 1.');
			if (inputs.dfDenStr !== '' && (dfDen === null || !Number.isInteger(dfDen) || dfDen < 1))
				e.set('dfDen', 'Must be a whole number ≥ 1.');
		} else if (it === 't') {
			const t = parseNumber(inputs.tStr);
			const dfErr = parseNumber(inputs.dfErrorStr);
			if (inputs.tStr !== '' && (t === null || !Number.isFinite(t)))
				e.set('t', 'Must be a number.');
			if (inputs.dfErrorStr !== '' && (dfErr === null || !Number.isInteger(dfErr) || dfErr < 1))
				e.set('dfError', 'Must be a whole number ≥ 1.');
		} else if (it === 'eta2') {
			const v = parseNumber(inputs.eta2Str);
			if (inputs.eta2Str !== '' && (v === null || !Number.isFinite(v) || v < 0 || v >= 1))
				e.set('eta2', 'Must be a number in [0, 1).');
		} else if (it === 'partial_eta2') {
			const v = parseNumber(inputs.partialEta2Str);
			if (inputs.partialEta2Str !== '' && (v === null || !Number.isFinite(v) || v < 0 || v >= 1))
				e.set('partialEta2', 'Must be a number in [0, 1).');
		} else if (it === 'cohens_f') {
			const v = parseNumber(inputs.cohensFStr);
			if (inputs.cohensFStr !== '' && (v === null || !Number.isFinite(v) || v < 0))
				e.set('cohensF', 'Must be a non-negative number.');
		} else if (it === 'r2') {
			const v = parseNumber(inputs.r2Str);
			if (inputs.r2Str !== '' && (v === null || !Number.isFinite(v) || v < 0 || v >= 1))
				e.set('r2', 'Must be a number in [0, 1).');
		} else if (it === 'ss') {
			const ssEff   = parseNumber(inputs.ssEffStr);
			const ssError = parseNumber(inputs.ssErrorStr);
			const ssTotal = parseNumber(inputs.ssTotalStr);
			const dfEff   = parseNumber(inputs.dfEffStr);
			const dfError = parseNumber(inputs.dfErrorStr);
			if (inputs.ssEffStr !== '' && (ssEff === null || !Number.isFinite(ssEff) || ssEff < 0))
				e.set('ssEff', 'Must be a non-negative number.');
			if (inputs.ssErrorStr !== '' && (ssError === null || !Number.isFinite(ssError) || ssError <= 0))
				e.set('ssError', 'Must be a positive number.');
			if (inputs.ssTotalStr !== '' && ssTotal !== null) {
				if (!Number.isFinite(ssTotal) || ssTotal <= 0)
					e.set('ssTotal', 'Must be a positive number.');
				else if (ssEff !== null && ssError !== null && ssTotal < ssEff + ssError - 0.001)
					e.set('ssTotal', 'SS_total must be ≥ SS_effect + SS_error.');
			}
			if (inputs.dfEffStr !== '' && (dfEff === null || !Number.isInteger(dfEff) || dfEff < 1))
				e.set('dfEff', 'Must be a whole number ≥ 1.');
			if (inputs.dfErrorStr !== '' && (dfError === null || !Number.isInteger(dfError) || dfError < 1))
				e.set('dfError', 'Must be a whole number ≥ 1.');
		}

		return e;
	});

	// ── Computation ───────────────────────────────────────────────
	let results = $derived.by((): Family3Results | null => {
		if (errors.size > 0) return null;
		const it = inputs.inputType;

		// Helper: determine ω² label based on design
		function omegaLabel(hasValue: boolean): string | null {
			if (!hasValue) return null;
			if (designType === 'one-way') return 'ω²';
			if (designType === 'factorial') return 'Partial ω²';
			return null; // repeated/mixed: not computable from F alone
		}

		if (it === 'F') {
			const F    = parseNumber(inputs.fStr);
			const dfNum = parseNumber(inputs.dfNumStr);
			const dfDen = parseNumber(inputs.dfDenStr);
			if (F === null || dfNum === null || dfDen === null) return null;

			const eta2 = partialEta2FromF(F, dfNum, dfDen);
			// ω²/partial ω² is the same formula; label depends on design
			const canComputeOmega = designType === 'one-way' || designType === 'factorial';
			const omega2 = canComputeOmega ? omega2FromF(F, dfNum, dfDen) : null;
			// CIs are valid for all design types (they're on partial η²)
			const eta2CI = ciPartialEta2(F, dfNum, dfDen);

			return {
				eta2,
				isPartial: true,
				omega2,
				omega2Label: omegaLabel(canComputeOmega),
				cohensF: cohensF(eta2),
				cohensFSq: cohensFSq(eta2),
				eta2CI
			};
		}

		if (it === 't') {
			const t = parseNumber(inputs.tStr);
			const dfErr = parseNumber(inputs.dfErrorStr);
			if (t === null || dfErr === null) return null;
			// t-stat from regression: F = t², dfNum = 1, dfDen = dfError
			const F = t * t;
			const eta2 = partialEta2FromF(F, 1, dfErr);
			const canComputeOmega = designType === 'one-way' || designType === 'factorial';
			const omega2 = canComputeOmega ? omega2FromF(F, 1, dfErr) : null;
			return {
				eta2,
				isPartial: true,
				omega2,
				omega2Label: omegaLabel(canComputeOmega),
				cohensF: cohensF(eta2),
				cohensFSq: cohensFSq(eta2),
				eta2CI: ciPartialEta2(F, 1, dfErr)
			};
		}

		if (it === 'ss') {
			const ssEff   = parseNumber(inputs.ssEffStr);
			const ssError = parseNumber(inputs.ssErrorStr);
			const dfEff   = parseNumber(inputs.dfEffStr);
			const dfError = parseNumber(inputs.dfErrorStr);
			if (ssEff === null || ssError === null || dfEff === null || dfError === null) return null;

			const ssTotal = parseNumber(inputs.ssTotalStr);
			const pEta2 = partialEta2FromSS(ssEff, ssError);

			// Reconstruct F to compute CIs
			const F = (ssEff / dfEff) / (ssError / dfError);
			const eta2CI = ciPartialEta2(F, dfEff, dfError);

			// partial ω² always available; total ω² only with SS_total
			const pOmega2 = partialOmega2FromSS(ssEff, dfEff, ssError, dfError);
			const canComputeOmega = designType === 'one-way' || designType === 'factorial';

			if (ssTotal !== null) {
				// Both η² and ω² available
				const useTotal = designType === 'one-way';
				return {
					eta2: useTotal ? eta2FromSS(ssEff, ssTotal) : pEta2,
					isPartial: !useTotal,
					omega2: canComputeOmega
						? (useTotal ? omega2FromSS(ssEff, dfEff, ssError, dfError, ssTotal) : pOmega2)
						: null,
					omega2Label: omegaLabel(canComputeOmega),
					cohensF: cohensF(pEta2),  // use partial η² for f
					cohensFSq: cohensFSq(pEta2),
					eta2CI
				};
			}

			// No SS_total: partial η² only
			return {
				eta2: pEta2,
				isPartial: true,
				omega2: canComputeOmega ? pOmega2 : null,
				omega2Label: omegaLabel(canComputeOmega),
				cohensF: cohensF(pEta2),
				cohensFSq: cohensFSq(pEta2),
				eta2CI
			};
		}

		if (it === 'eta2') {
			const v = parseNumber(inputs.eta2Str);
			if (v === null) return null;
			return {
				eta2: v, isPartial: false,
				omega2: null, omega2Label: null,
				cohensF: cohensF(v), cohensFSq: cohensFSq(v),
				eta2CI: null
			};
		}

		if (it === 'partial_eta2') {
			const v = parseNumber(inputs.partialEta2Str);
			if (v === null) return null;
			return {
				eta2: v, isPartial: true,
				omega2: null, omega2Label: null,
				cohensF: cohensF(v), cohensFSq: cohensFSq(v),
				eta2CI: null
			};
		}

		if (it === 'cohens_f') {
			const f = parseNumber(inputs.cohensFStr);
			if (f === null) return null;
			const eta2 = eta2FromCohensF(f);
			return {
				eta2, isPartial: false,
				omega2: null, omega2Label: null,
				cohensF: f, cohensFSq: f ** 2,
				eta2CI: null
			};
		}

		if (it === 'r2') {
			const v = parseNumber(inputs.r2Str);
			if (v === null) return null;
			return {
				eta2: v, isPartial: false,
				omega2: null, omega2Label: null,
				cohensF: cohensF(v), cohensFSq: cohensFSq(v),
				eta2CI: null
			};
		}

		return null;
	});

	// ── Interpretation helpers ─────────────────────────────────────
	function sizeLabel(f: number): string {
		if (f < 0.10) return 'negligible';
		if (f < 0.25) return 'small';
		if (f < 0.40) return 'medium';
		return 'large';
	}

	function fmt(x: number, dp = 3): string { return x.toFixed(dp); }
	function fmtPct(x: number): string { return (x * 100).toFixed(2); }

	let size    = $derived(results ? sizeLabel(results.cohensF) : '');
	let eta2Pct = $derived(results ? fmtPct(results.eta2) : '');
	let equivD  = $derived(results ? 2 * results.cohensF : 0);

	// ── Copy text ─────────────────────────────────────────────────
	function buildCopyText(res: Family3Results): string {
		const metricName = res.isPartial ? 'Partial η²' : 'η²';
		const lines: string[] = [
			`${metricName} = ${fmt(res.eta2)}`,
			res.eta2CI ? `95% CI [${fmt(res.eta2CI[0])}, ${fmt(res.eta2CI[1])}]` : '',
			res.omega2 !== null ? `${res.omega2Label} = ${fmt(res.omega2)}` : '',
			`Cohen's f = ${fmt(res.cohensF)}`,
			`Cohen's f² = ${fmt(res.cohensFSq)}`
		].filter(Boolean);
		return lines.join('\n');
	}

	// ── URL sync ──────────────────────────────────────────────────
	let mounted = false;

	onMount(() => {
		const p = $page.url.searchParams;
		const it = p.get('input') as Family3InputType | null;
		const dt = p.get('design') as DesignType | null;
		if (it) inputs.inputType = it;
		if (dt) designType = dt;
		if (p.get('F'))     inputs.fStr           = p.get('F')!;
		if (p.get('dnum'))  inputs.dfNumStr        = p.get('dnum')!;
		if (p.get('dden'))  inputs.dfDenStr        = p.get('dden')!;
		if (p.get('e2'))    inputs.eta2Str         = p.get('e2')!;
		if (p.get('pe2'))   inputs.partialEta2Str  = p.get('pe2')!;
		if (p.get('cf'))    inputs.cohensFStr      = p.get('cf')!;
		if (p.get('r2'))    inputs.r2Str           = p.get('r2')!;
		if (p.get('sse'))   inputs.ssEffStr        = p.get('sse')!;
		if (p.get('sserr')) inputs.ssErrorStr      = p.get('sserr')!;
		if (p.get('sst'))   inputs.ssTotalStr      = p.get('sst')!;
		if (p.get('dfe'))   inputs.dfEffStr        = p.get('dfe')!;
		if (p.get('dferr')) inputs.dfErrorStr      = p.get('dferr')!;
		mounted = true;
	});

	$effect(() => {
		if (!mounted) return;
		const u = new URLSearchParams();
		u.set('input', inputs.inputType);
		if (designType !== 'one-way') u.set('design', designType);

		const it = inputs.inputType;
		if (it === 'F') {
			if (inputs.fStr)     u.set('F',    inputs.fStr);
			if (inputs.dfNumStr) u.set('dnum', inputs.dfNumStr);
			if (inputs.dfDenStr) u.set('dden', inputs.dfDenStr);
		} else if (it === 'eta2'         && inputs.eta2Str)        u.set('e2',  inputs.eta2Str);
		  else if (it === 'partial_eta2' && inputs.partialEta2Str) u.set('pe2', inputs.partialEta2Str);
		  else if (it === 'cohens_f'     && inputs.cohensFStr)     u.set('cf',  inputs.cohensFStr);
		  else if (it === 'r2'           && inputs.r2Str)          u.set('r2',  inputs.r2Str);
		  else if (it === 'ss') {
			if (inputs.ssEffStr)   u.set('sse',   inputs.ssEffStr);
			if (inputs.ssErrorStr) u.set('sserr', inputs.ssErrorStr);
			if (inputs.ssTotalStr) u.set('sst',   inputs.ssTotalStr);
			if (inputs.dfEffStr)   u.set('dfe',   inputs.dfEffStr);
			if (inputs.dfErrorStr) u.set('dferr', inputs.dfErrorStr);
		}
		goto(`?${u.toString()}`, { replaceState: true, keepFocus: true, noScroll: true });
	});

	// ── Input type options ─────────────────────────────────────────
	const inputOptions: { value: Family3InputType; label: string }[] = [
		{ value: 'F',            label: 'F-statistic' },
		{ value: 't',            label: 't-statistic' },
		{ value: 'ss',           label: 'SS table' },
		{ value: 'eta2',         label: 'η²' },
		{ value: 'partial_eta2', label: 'Partial η²' },
		{ value: 'cohens_f',     label: "Cohen's f" },
		{ value: 'r2',           label: 'R²' }
	];

	// ── Formulas ──────────────────────────────────────────────────
	const formulas = [
		{
			title: 'Partial η² from F-statistic',
			latex: String.raw`\text{partial } \eta^2 = \frac{F \cdot df_{\text{effect}}}{F \cdot df_{\text{effect}} + df_{\text{error}}}`,
			source: 'Equals η² for one-way between-subjects ANOVA. Olejnik & Algina (2003).'
		},
		{
			title: 'ω² / partial ω² from F-statistic',
			latex: String.raw`\omega^2 = \frac{df_{\text{eff}} \cdot (F - 1)}{F \cdot df_{\text{eff}} + df_{\text{error}} + 1}`,
			source: 'One-way: gives ω² (total). Factorial: gives partial ω² for the effect. NOT valid for repeated-measures designs. Hays (1963); Olejnik & Algina (2003).'
		},
		{
			title: 'Partial ω² from SS values (factorial)',
			latex: String.raw`\text{partial } \omega^2 = \frac{SS_{\text{eff}} - df_{\text{eff}} \cdot MS_{\text{error}}}{SS_{\text{eff}} + SS_{\text{error}} + MS_{\text{error}}}`,
			source: 'Does not require SS_total. Olejnik & Algina (2003).'
		},
		{
			title: '95% CI for η² (noncentral F method)',
			latex: String.raw`\eta^2_{\text{CI}} = \left[\frac{\lambda_L}{\lambda_L + N},\ \frac{\lambda_U}{\lambda_U + N}\right]`,
			source: 'λ_L, λ_U found by bisection: CDF(F_obs, df₁, df₂, λ) = 0.975 / 0.025. Smithson (2001).'
		},
		{
			title: "Cohen's f",
			latex: String.raw`f = \sqrt{\frac{\eta^2}{1 - \eta^2}}`,
			source: 'Cohen (1988). Thresholds: small = .10, medium = .25, large = .40.'
		},
		{
			title: "Cohen's f²",
			latex: String.raw`f^2 = \frac{\eta^2}{1 - \eta^2}`,
			source: 'Used in multiple regression power analysis. Thresholds: small = .02, medium = .15, large = .35.'
		},
		{
			title: 'f to d (two equal groups only)',
			latex: String.raw`d = 2f`,
			source: 'Cohen (1988). Valid only for a two-group (k = 2) equal-n comparison.'
		}
	];
</script>

<svelte:head>
	<title>ANOVA / Regression: η², ω², Cohen's f | Magnitood</title>
	<meta name="description" content="Compute η², partial η², ω² and Cohen's f from ANOVA F-statistics or SS values. With 95% CIs via the noncentral F method. Free, instant, client-side." />
</svelte:head>

<div class="h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>

<div class="mx-auto max-w-3xl px-4 py-10 space-y-6">

	<!-- Header ─────────────────────────────────────────────────── -->
	<div>
		<h1 class="text-3xl font-bold text-gray-900 tracking-tight">ANOVA / Regression</h1>
		<p class="mt-2 text-gray-500 text-sm leading-relaxed">
			Convert and interpret η², partial η², ω², and Cohen's f from ANOVA output.
			95% CIs computed via the noncentral F method (Smithson, 2001).
		</p>
	</div>

	<!-- Input card ──────────────────────────────────────────────── -->
	<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
		<h2 class="text-base font-semibold text-gray-900">Input</h2>

		<!-- Paste parser -->
		<div class="rounded-xl border border-gray-200 overflow-hidden">
			<button
				type="button"
				onclick={() => { pasteOpen = !pasteOpen; }}
				class="w-full flex items-center justify-between px-4 py-2.5 text-left bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none"
				aria-expanded={pasteOpen}
			>
				<span class="text-xs font-medium text-gray-600">Paste from R / SPSS / Jamovi output</span>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
					class="w-4 h-4 text-gray-400 transition-transform duration-150 {pasteOpen ? 'rotate-180' : ''}" aria-hidden="true">
					<path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
				</svg>
			</button>
			{#if pasteOpen}
				<div class="px-4 pb-4 pt-3 space-y-2 border-t border-gray-100">
					<p class="text-xs text-gray-400">Paste any line from your output containing F, η², partial η², or Cohen's f. Detected values will pre-fill the form.</p>
					<textarea
						bind:value={pasteText}
						rows="2"
						placeholder="e.g.  F(2, 57) = 8.45, p = .001  or  partial η² = .08"
						class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-none"
					></textarea>
					{#if parsedPaste}
						{#if parsedPaste.type === 'r_lm'}
							{@const rlmDfError = parsedPaste.dfError}
							<div class="space-y-1.5">
								<p class="text-xs text-emerald-700 font-medium">
									Detected: {parsedPaste.label} &#x2014; df<sub>error</sub> = {rlmDfError}.
									Choose a predictor:
								</p>
								{#each parsedPaste.predictors as pred}
									<button
										type="button"
										onclick={() => applyRlmPredictor(pred.t, rlmDfError)}
										class="w-full flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs hover:bg-emerald-100 transition-colors text-left"
									>
										<span class="font-mono text-gray-700">{pred.name}</span>
										<span class="text-emerald-700 font-medium ml-2 shrink-0">t&nbsp;=&nbsp;{pred.t} &#x2192; Apply</span>
									</button>
								{/each}
							</div>
						{:else}
							<div class="flex items-center justify-between gap-3">
								<span class="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
									Detected: <strong>{parsedPaste.label}</strong>
								</span>
								<button
									type="button"
									onclick={applyPaste}
									class="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 transition-opacity"
								>Apply</button>
							</div>
						{/if}
					{:else if pasteText.trim()}
						<p class="text-xs text-amber-600">No recognisable statistic found. Try pasting R’s <code class="font-mono bg-amber-50 px-1">summary(lm(...))</code> output or a line like <code class="font-mono bg-amber-50 px-1">F(2, 57) = 8.45</code>.</p>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Step 1: Design type -->
		<div class="space-y-2">
			<p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Design</p>
			<div class="flex flex-wrap gap-2">
				{#each designOptions as opt}
					<button
						onclick={() => { designType = opt.value; }}
						class="rounded-full px-3 py-1 text-sm font-medium transition-colors
							{designType === opt.value
								? 'bg-emerald-600 text-white'
								: 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
					>
						{opt.short}
					</button>
				{/each}
			</div>
			{#if designType === 'one-way'}
				<p class="text-xs text-gray-500 leading-relaxed">One predictor or factor; all participants measured once in different groups (e.g. three treatment arms). This is the most common ANOVA design.</p>
			{:else if designType === 'factorial'}
				<p class="text-xs text-gray-500 leading-relaxed">Two or more factors crossed; each participant appears in exactly one cell (e.g. 2×2 design). Use <strong>partial η²</strong> here — total η² depends on how many other factors are in the model.</p>
			{:else if designType === 'repeated'}
				<p class="text-xs text-gray-500 leading-relaxed">Same participants measured across all conditions (e.g. three time points, or three tasks). Each person serves as their own control.</p>
			{:else if designType === 'mixed'}
				<p class="text-xs text-gray-500 leading-relaxed">At least one between-subjects factor (different people in each group) and one within-subjects factor (same people across conditions).</p>
			{/if}
			{#if designType === 'repeated' || designType === 'mixed'}
				<p class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
					For {designType === 'repeated' ? 'repeated-measures' : 'mixed'} designs:
					partial η² can be computed from any F-statistic, but ω² / partial ω²
					require the full within-subjects SS table and cannot be derived from F + df alone.
				</p>
			{/if}
		</div>

		<!-- Step 2: Input type -->
		<div class="space-y-2">
			<p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Input type</p>
			<div class="flex flex-wrap gap-2">
				{#each inputOptions as opt}
					<button
						onclick={() => { inputs.inputType = opt.value; }}
						class="rounded-full px-3 py-1 text-sm font-medium transition-colors
							{inputs.inputType === opt.value
								? 'bg-accent text-white'
								: 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Dynamic fields -->
		{#if inputs.inputType === 'F'}
			<div class="grid grid-cols-3 gap-4">
				<div class="space-y-1">
					<label for="inp-F" class="block text-xs font-medium text-gray-700">F-statistic</label>
					<input id="inp-F" type="text" inputmode="decimal" bind:value={inputs.fStr}
						placeholder="e.g. 8.45"
						class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent
							{errors.has('F') ? 'border-red-400' : 'border-gray-200'}" />
					{#if errors.has('F')}<p class="text-xs text-red-600">{errors.get('F')}</p>{/if}
				</div>
				<div class="space-y-1">
					<label for="inp-dfnum" class="block text-xs font-medium text-gray-700">
						df₁
						<span class="text-gray-400 font-normal">(numerator)</span>
					</label>
					<input id="inp-dfnum" type="text" inputmode="numeric" bind:value={inputs.dfNumStr}
						placeholder="e.g. 2"
						class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent
							{errors.has('dfNum') ? 'border-red-400' : 'border-gray-200'}" />
					{#if errors.has('dfNum')}<p class="text-xs text-red-600">{errors.get('dfNum')}</p>{/if}
				</div>
				<div class="space-y-1">
					<label for="inp-dfden" class="block text-xs font-medium text-gray-700">
						df₂
						<span class="text-gray-400 font-normal">(denominator)</span>
					</label>
					<input id="inp-dfden" type="text" inputmode="numeric" bind:value={inputs.dfDenStr}
						placeholder="e.g. 57"
						class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent
							{errors.has('dfDen') ? 'border-red-400' : 'border-gray-200'}" />
					{#if errors.has('dfDen')}<p class="text-xs text-red-600">{errors.get('dfDen')}</p>{/if}
				</div>
			</div>
			<p class="text-xs text-gray-500">
				Reported as F(df₁, df₂) = value — df₁ is the first number in parentheses (numerator / between groups / effect), df₂ is the second (denominator / within groups / residual).
			</p>
			{#if designType === 'one-way'}
				<p class="text-xs text-gray-400">
					Result is <strong>partial η²</strong>, which equals η² for one-way ANOVA
					(df_error = N − k; df_effect = k − 1).
				</p>
			{:else if designType === 'factorial'}
				<p class="text-xs text-gray-400">
					Enter the F and df values for a <strong>single effect</strong> from your ANOVA table
					(e.g. main effect A, or the A×B interaction). df_error should be the within-cell
					error degrees of freedom shared across effects.
				</p>
			{/if}

		{:else if inputs.inputType === 't'}
			<div class="grid grid-cols-2 gap-4 max-w-sm">
				<div class="space-y-1">
					<label for="inp-t" class="block text-xs font-medium text-gray-700">t-statistic</label>
					<input id="inp-t" type="text" inputmode="decimal" bind:value={inputs.tStr}
						placeholder="e.g. 7.61"
						class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent
							{errors.has('t') ? 'border-red-400' : 'border-gray-200'}" />
					{#if errors.has('t')}<p class="text-xs text-red-600">{errors.get('t')}</p>{/if}
				</div>
				<div class="space-y-1">
					<label for="inp-df-err-t" class="block text-xs font-medium text-gray-700">df (residual)</label>
					<input id="inp-df-err-t" type="text" inputmode="numeric" bind:value={inputs.dfErrorStr}
						placeholder="e.g. 456"
						class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent
							{errors.has('dfError') ? 'border-red-400' : 'border-gray-200'}" />
					{#if errors.has('dfError')}<p class="text-xs text-red-600">{errors.get('dfError')}</p>{/if}
				</div>
			</div>
			<p class="mt-2 text-xs text-gray-400">Enter the t-value and residual df from a regression coefficient row (e.g. from R’s <code class="font-mono bg-gray-100 px-1 rounded">summary(lm(...))</code>). Gives the partial η² for that predictor.</p>

		{:else if inputs.inputType === 'ss'}
			<!-- SS table input -->
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-1">
					<label for="inp-sse" class="block text-xs font-medium text-gray-700">SS effect</label>
					<input id="inp-sse" type="text" inputmode="decimal" bind:value={inputs.ssEffStr}
						placeholder="e.g. 120.4"
						class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent
							{errors.has('ssEff') ? 'border-red-400' : 'border-gray-200'}" />
					{#if errors.has('ssEff')}<p class="text-xs text-red-600">{errors.get('ssEff')}</p>{/if}
				</div>
				<div class="space-y-1">
					<label for="inp-sserr" class="block text-xs font-medium text-gray-700">SS error</label>
					<input id="inp-sserr" type="text" inputmode="decimal" bind:value={inputs.ssErrorStr}
						placeholder="e.g. 840.6"
						class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent
							{errors.has('ssError') ? 'border-red-400' : 'border-gray-200'}" />
					{#if errors.has('ssError')}<p class="text-xs text-red-600">{errors.get('ssError')}</p>{/if}
				</div>
				<div class="space-y-1">
					<label for="inp-dfe" class="block text-xs font-medium text-gray-700">df effect</label>
					<input id="inp-dfe" type="text" inputmode="numeric" bind:value={inputs.dfEffStr}
						placeholder="e.g. 2"
						class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent
							{errors.has('dfEff') ? 'border-red-400' : 'border-gray-200'}" />
					{#if errors.has('dfEff')}<p class="text-xs text-red-600">{errors.get('dfEff')}</p>{/if}
				</div>
				<div class="space-y-1">
					<label for="inp-dferr" class="block text-xs font-medium text-gray-700">df error</label>
					<input id="inp-dferr" type="text" inputmode="numeric" bind:value={inputs.dfErrorStr}
						placeholder="e.g. 57"
						class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent
							{errors.has('dfError') ? 'border-red-400' : 'border-gray-200'}" />
					{#if errors.has('dfError')}<p class="text-xs text-red-600">{errors.get('dfError')}</p>{/if}
				</div>
			</div>
			<div class="space-y-1">
				<label for="inp-sst" class="block text-xs font-medium text-gray-700">
					SS total
					<span class="text-gray-400 font-normal">(optional — enables η² and ω²)</span>
				</label>
				<input id="inp-sst" type="text" inputmode="decimal" bind:value={inputs.ssTotalStr}
					placeholder="e.g. 1200.0"
					class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent
						{errors.has('ssTotal') ? 'border-red-400' : 'border-gray-200'}" />
				{#if errors.has('ssTotal')}<p class="text-xs text-red-600">{errors.get('ssTotal')}</p>{/if}
			</div>
			{#if designType === 'factorial' && !inputs.ssTotalStr}
				<p class="text-xs text-gray-400">
					Without SS_total, results show <strong>partial η²</strong> and <strong>partial ω²</strong>.
					Add SS_total to also compute total η² and ω² (one-way designs) or total η² (factorial).
				</p>
			{/if}

		{:else if inputs.inputType === 'eta2'}
			<div class="max-w-xs space-y-1">
				<label for="inp-eta2" class="block text-xs font-medium text-gray-700">η² (eta-squared)</label>
				<input id="inp-eta2" type="text" inputmode="decimal" bind:value={inputs.eta2Str}
					placeholder="e.g. 0.12"
					class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent
						{errors.has('eta2') ? 'border-red-400' : 'border-gray-200'}" />
				{#if errors.has('eta2')}<p class="text-xs text-red-600">{errors.get('eta2')}</p>{/if}
			</div>

		{:else if inputs.inputType === 'partial_eta2'}
			<div class="max-w-xs space-y-1">
				<label for="inp-peta2" class="block text-xs font-medium text-gray-700">Partial η²</label>
				<input id="inp-peta2" type="text" inputmode="decimal" bind:value={inputs.partialEta2Str}
					placeholder="e.g. 0.08"
					class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent
						{errors.has('partialEta2') ? 'border-red-400' : 'border-gray-200'}" />
				{#if errors.has('partialEta2')}<p class="text-xs text-red-600">{errors.get('partialEta2')}</p>{/if}
			</div>
			<p class="text-xs text-gray-400">
				Typically reported for individual predictors in factorial ANOVA or ANCOVA.
				Enter the value as a proportion (e.g. 0.08, not 8%).
			</p>

		{:else if inputs.inputType === 'cohens_f'}
			<div class="max-w-xs space-y-1">
				<label for="inp-cf" class="block text-xs font-medium text-gray-700">Cohen's f</label>
				<input id="inp-cf" type="text" inputmode="decimal" bind:value={inputs.cohensFStr}
					placeholder="e.g. 0.40"
					class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent
						{errors.has('cohensF') ? 'border-red-400' : 'border-gray-200'}" />
				{#if errors.has('cohensF')}<p class="text-xs text-red-600">{errors.get('cohensF')}</p>{/if}
			</div>
			<p class="text-xs text-gray-400">Cohen's benchmarks: small = 0.10, medium = 0.25, large = 0.40.</p>

		{:else if inputs.inputType === 'r2'}
			<div class="max-w-xs space-y-1">
				<label for="inp-r2" class="block text-xs font-medium text-gray-700">R² (whole-model)</label>
				<input id="inp-r2" type="text" inputmode="decimal" bind:value={inputs.r2Str}
					placeholder="e.g. 0.24"
					class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent
						{errors.has('r2') ? 'border-red-400' : 'border-gray-200'}" />
				{#if errors.has('r2')}<p class="text-xs text-red-600">{errors.get('r2')}</p>{/if}
			</div>
			<p class="text-xs text-gray-400">
				Treated as η² for the whole model. Equivalent to partial η² for a single predictor.
			</p>
		{/if}
	</div>

	{#if results}
		<!-- Results table ──────────────────────────────────────────── -->
		<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-base font-semibold text-gray-900">Results</h2>
				<CopyButton text={buildCopyText(results)} label="Copy all" />
			</div>

			<table class="w-full text-sm">
				<tbody class="divide-y divide-gray-100">
					<!-- η² / partial η² with CI -->
					<tr>
						<td class="py-2.5 text-gray-600 pr-4">
							{results.isPartial ? 'Partial η²' : 'η²'}
							{#if results.isPartial && inputs.inputType === 'F' && designType === 'one-way'}
								<span class="text-xs text-gray-400 ml-1">(= η² for one-way)</span>
							{/if}
						</td>
						<td class="py-2.5 text-right">
							<span class="font-mono font-semibold text-gray-900">{fmt(results.eta2)}</span>
							{#if results.eta2CI}
								<span class="text-xs text-gray-400 ml-1">
									95% CI [{fmt(results.eta2CI[0])}, {fmt(results.eta2CI[1])}]
								</span>
							{/if}
						</td>
					</tr>

					<!-- ω² / partial ω² -->
					<tr>
						<td class="py-2.5 text-gray-600 pr-4">
							{results.omega2Label ?? 'ω²'}
							<span class="text-xs text-gray-400 ml-1">(bias-corrected — prefer for reporting)</span>
						</td>
						<td class="py-2.5 text-right">
							{#if results.omega2 !== null}
								<span class="font-mono font-semibold text-gray-900">{fmt(results.omega2)}</span>
							{:else if designType === 'repeated' || designType === 'mixed'}
								<span class="text-xs text-gray-400">
									Requires full SS table for {designType === 'repeated' ? 'repeated-measures' : 'mixed'} designs —
									use your statistical software
								</span>
							{:else}
								<span class="text-xs text-gray-400">requires F-statistic</span>
							{/if}
						</td>
					</tr>

					<!-- Cohen's f -->
					<tr>
						<td class="py-2.5 text-gray-600 pr-4">Cohen's f</td>
						<td class="py-2.5 font-mono font-semibold text-gray-900 text-right">{fmt(results.cohensF)}</td>
					</tr>

					<!-- Cohen's f² -->
					<tr>
						<td class="py-2.5 text-gray-600 pr-4">Cohen's f²</td>
						<td class="py-2.5 font-mono font-semibold text-gray-900 text-right">{fmt(results.cohensFSq)}</td>
					</tr>
				</tbody>
			</table>
		</div>

		<!-- Variance plot ───────────────────────────────────────────── -->
		<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
			<div class="flex items-center justify-between mb-3">
				<h2 class="text-base font-semibold text-gray-900">Variance partition</h2>
				<PlotDownloadButton getSvg={() => varSvgEl} filename={plotFilename} />
			</div>
			<VariancePlot
				eta2={results.eta2}
				cohensF={results.cohensF}
				isPartial={results.isPartial}
				bind:svgEl={varSvgEl}
			/>
			<p class="mt-2 text-xs text-gray-400 text-center">
				Each square represents 1% of total variance.
			</p>
		</div>

		<!-- Benchmark ribbon ────────────────────────────────────────── -->
		<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
			<BenchmarkRibbon value={results.cohensF} metric="Cohen's f" family="f" />
		</div>

		<!-- Interpretation ──────────────────────────────────────────── -->
		<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
			<h2 class="text-base font-semibold text-gray-900">Interpretation</h2>

			<p class="text-sm text-gray-700 leading-relaxed">
				This is a <strong>{size}</strong> effect (Cohen's f = {fmt(results.cohensF)},
				{results.isPartial ? 'partial ' : ''}η² = {fmt(results.eta2)}).
				The predictor or factor accounts for approximately
				<strong>{eta2Pct}%</strong> of the
				{results.isPartial ? 'variance attributable to this effect and its error' : 'total variance in the outcome'}.
			</p>

			{#if results.eta2CI}
				<p class="text-sm text-gray-700 leading-relaxed">
					The 95% confidence interval on {results.isPartial ? 'partial ' : ''}η² is
					[{fmt(results.eta2CI[0])}, {fmt(results.eta2CI[1])}],
					computed via the noncentral F method (Smithson, 2001).
					{#if results.eta2CI[0] === 0}
						The lower bound of zero means the data are also consistent with no effect.
					{/if}
				</p>
			{/if}
			{#if results.eta2CI && (results.eta2CI[1] - results.eta2CI[0]) > 0.2}
				<p class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
					This wide confidence interval reflects considerable uncertainty about the true effect size. Interpret the point estimate with caution.
				</p>
			{/if}

			{#if results.omega2 !== null}
				<p class="text-sm text-gray-700 leading-relaxed">
					{results.omega2Label} = {fmt(results.omega2)} is the bias-corrected estimate —
					it adjusts for η²'s tendency to overestimate the population effect,
					especially in small samples.
					{#if results.omega2 < results.eta2}
						Here it is {fmt((results.eta2 - results.omega2) * 100, 2)} percentage points lower than η².
					{/if}
				</p>
			{/if}

			<p class="text-sm text-gray-700 leading-relaxed">
				Cohen's f = {fmt(results.cohensF)} means the standard deviation of group means
				is {fmt(results.cohensF)} times the within-group standard deviation.
			</p>
		</div>

		<!-- Two-group equivalent ────────────────────────────────────── -->
		{#if isTwoGroup}
			<div class="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 space-y-2">
				<h2 class="text-sm font-semibold text-emerald-900">Two-group equivalent</h2>
				<p class="text-sm text-emerald-800">
					With df_effect = 1 (two groups), Cohen's f = d / 2, so this corresponds to
					<strong>Cohen's d ≈ {fmt(equivD)}</strong>.
				</p>
				<a
					href="{base}/cohens-d?input=d&d={encodeURIComponent(fmt(equivD))}"
					class="inline-block text-sm font-medium text-emerald-700 underline underline-offset-2 hover:opacity-80"
				>
					Open d = {fmt(equivD)} in the mean differences calculator →
				</a>
			</div>
		{:else if dfNumOver1}
			<div class="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
				<p class="text-sm text-gray-600">
					<strong>Converting to Cohen's d is not meaningful</strong> for designs with more than
					two groups — there is no single pairwise d that characterises the pattern of means.
					For pairwise comparisons, compute d separately for each pair using the
					<a href="{base}/cohens-d" class="text-accent underline underline-offset-2">mean differences calculator</a>.
				</p>
			</div>
		{:else}
			<!-- Non-F input, unknown k: offer a toggle -->
			<div class="rounded-2xl border border-gray-200 bg-white px-5 py-4">
				<label class="flex items-start gap-3 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={twoGroupOverride}
						class="mt-0.5 h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
					/>
					<span class="text-sm text-gray-700">
						This is a two-group design (k = 2) — show equivalent Cohen's d
					</span>
				</label>
			</div>
		{/if}

		<div class="flex items-center justify-between gap-3">
			<a
				href="{base}/visualize?viz=eta-squared&e2={results.eta2.toFixed(3)}"
				class="text-xs text-violet-600 hover:underline hover:text-violet-800 transition-colors"
			>
				Visualize this effect →
			</a>
			<ShareButton />
				<CitationSnippet />
		</div>

		<!-- Formulas accordion ──────────────────────────────────────── -->
		<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<FormulaAccordion formulas={formulas} />
		</div>
	{:else}
		<div class="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center text-sm text-gray-400">
			Results, the variance plot, and the interpretation will appear here once you enter values above.
		</div>

		<!-- Formulas shown even without results -->
		<div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<FormulaAccordion formulas={formulas} />
		</div>
	{/if}

</div>
