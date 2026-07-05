<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import InputPanel from '$lib/components/InputPanel.svelte';
	import DistributionPlot from '$lib/components/DistributionPlot.svelte';
	import BenchmarkRibbon from '$lib/components/BenchmarkRibbon.svelte';
	import Interpretation from '$lib/components/Interpretation.svelte';
	import PowerPanel from '$lib/components/PowerPanel.svelte';
	import OutputTable from '$lib/components/OutputTable.svelte';
	import CitationSnippet from '$lib/components/CitationSnippet.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import FormulaAccordion from '$lib/components/FormulaAccordion.svelte';
	import PlotDownloadButton from '$lib/components/PlotDownloadButton.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import { sanitizeFilename } from '$lib/utils/downloadPlot.js';
	import { syncQuery } from '$lib/utils/urlSync.js';

	import type { Family1Inputs, Family1Results, Family1InputType, EffectDirection } from '$lib/types/effects.js';
	import {
		parseNumber,
		dFromMeans,
		dFromT,
		dFromF,
		dFromP,
		hedgesG,
		hedgesJ,
		rFromD,
		cles,
		u3,
		ovl,
		varD,
		seD,
		glassDelta,
		dToLogOR,
		dzFromTPaired,
		dzFromMeansDiff,
		dsFromDZ,
		varDZ,
		seDZ,
		dFromMeanOneSample,
		hedgesJOneSample,
		rFromDOneSample
	} from '$lib/math/conversions.js';
	import { ciD, ciG, ciR } from '$lib/math/ci.js';
	import { validateFamily1 } from '$lib/math/validation.js';
	import { tInv } from '$lib/math/distributions.js';

	// ── State ────────────────────────────────────────────────────────────────────

	let inputs = $state<Family1Inputs>({
		designType: 'independent',
		inputType: 't',
		dStr: '',
		gStr: '',
		tStr: '',
		fStr: '',
		m1Str: '',
		m2Str: '',
		sd1Str: '',
		sd2Str: '',
		mDiffStr: '',
		sdDiffStr: '',
		pStr: '',
		direction: 1,
		n1Str: '',
		n2Str: '',
		nPairsStr: '',
		rPairedStr: '',
		mu0Str: ''
	});

	// ── Load from URL params on first render ─────────────────────────────────────

	$effect(() => {
		if (!browser) return;
		const params = $page.url.searchParams;
		if (params.get('design') === 'paired') inputs.designType = 'paired';
		if (params.get('design') === 'one-sample') inputs.designType = 'one-sample';
		const inputType = params.get('input') as Family1InputType | null;
		if (inputType && ['d','g','t','f','means','p'].includes(inputType)) {
			inputs.inputType = inputType;
		}
		if (params.has('d'))       inputs.dStr       = params.get('d')!;
		if (params.has('g'))       inputs.gStr       = params.get('g')!;
		if (params.has('t'))       inputs.tStr       = params.get('t')!;
		if (params.has('f'))       inputs.fStr       = params.get('f')!;
		if (params.has('m1'))      inputs.m1Str      = params.get('m1')!;
		if (params.has('m2'))      inputs.m2Str      = params.get('m2')!;
		if (params.has('sd1'))     inputs.sd1Str     = params.get('sd1')!;
		if (params.has('sd2'))     inputs.sd2Str     = params.get('sd2')!;
		if (params.has('mdiff'))   inputs.mDiffStr   = params.get('mdiff')!;
		if (params.has('sddiff'))  inputs.sdDiffStr  = params.get('sddiff')!;
		if (params.has('p'))       inputs.pStr       = params.get('p')!;
		if (params.has('n1'))      inputs.n1Str      = params.get('n1')!;
		if (params.has('n2'))      inputs.n2Str      = params.get('n2')!;
		if (params.has('np'))      inputs.nPairsStr  = params.get('np')!;
		if (params.has('rp'))      inputs.rPairedStr = params.get('rp')!;
		if (params.has('mu0'))     inputs.mu0Str     = params.get('mu0')!;
		if (params.get('dir') === '-1') inputs.direction = -1;
		if (params.has('label1')) { label1 = params.get('label1')!; customLabels = true; }
		if (params.has('label2')) { label2 = params.get('label2')!; customLabels = true; }
	});

	// ── URL sync (debounced) ─────────────────────────────────────────────────────

	$effect(() => {
		const { designType, inputType, dStr, gStr, tStr, fStr, m1Str, m2Str, sd1Str, sd2Str,
			mDiffStr, sdDiffStr, pStr, n1Str, n2Str, nPairsStr, rPairedStr, direction, mu0Str } = inputs;
		// Reference label state to make this effect reactive to label changes
		const _l1 = label1;
		const _l2 = label2;
		if (!browser) return;

		const params = new URLSearchParams();
		if (designType === 'paired') params.set('design', 'paired');
		if (designType === 'one-sample') params.set('design', 'one-sample');
		params.set('input', inputType);
		if (dStr)       params.set('d',      dStr);
		if (gStr)       params.set('g',      gStr);
		if (tStr)       params.set('t',      tStr);
		if (fStr)       params.set('f',      fStr);
		if (m1Str)      params.set('m1',     m1Str);
		if (m2Str)      params.set('m2',     m2Str);
		if (sd1Str)     params.set('sd1',    sd1Str);
		if (sd2Str)     params.set('sd2',    sd2Str);
		if (mDiffStr)   params.set('mdiff',  mDiffStr);
		if (sdDiffStr)  params.set('sddiff', sdDiffStr);
		if (pStr)       params.set('p',      pStr);
		if (n1Str)      params.set('n1',     n1Str);
		if (n2Str)      params.set('n2',     n2Str);
		if (nPairsStr)  params.set('np',     nPairsStr);
		if (rPairedStr) params.set('rp',     rPairedStr);
		if (mu0Str)     params.set('mu0',    mu0Str);
		if (direction === -1) params.set('dir', '-1');
		const [def1, def2] = LABEL_DEFAULTS[designType];
		if (_l1 !== def1) params.set('label1', _l1);
		if (_l2 !== def2) params.set('label2', _l2);
		syncQuery(params);
	});

	// ── Validation ───────────────────────────────────────────────────────────────

	let validationErrors = $derived(
		validateFamily1(
			inputs.inputType,
			{
				d: inputs.dStr, g: inputs.gStr, t: inputs.tStr, f: inputs.fStr,
				m1: inputs.m1Str, m2: inputs.m2Str, sd1: inputs.sd1Str, sd2: inputs.sd2Str,
				mDiff: inputs.mDiffStr, sdDiff: inputs.sdDiffStr,
				p: inputs.pStr, n1: inputs.n1Str, n2: inputs.n2Str,
				nPairs: inputs.nPairsStr, rPaired: inputs.rPairedStr,
				mu0: inputs.mu0Str
			},
			inputs.direction,
			inputs.designType
		)
	);

	// "Required" only means the field is still empty — don't paint a pristine
	// form red. Empty fields silently block results; only real errors display.
	let errorMap = $derived(
		Object.fromEntries(
			validationErrors.filter(e => e.message !== 'Required').map(e => [e.field, e.message])
		)
	);

	let missingFields = $derived(validationErrors.some(e => e.message === 'Required'));

	// ── Computed results ─────────────────────────────────────────────────────────

	let results = $derived(computeResults(inputs, validationErrors.length === 0));

	function computeResults(inp: Family1Inputs, valid: boolean): Family1Results | null {
		if (!valid) return null;
		if (inp.designType === 'paired') return computePairedResults(inp);
		if (inp.designType === 'one-sample') return computeOneSampleResults(inp);
		return computeIndependentResults(inp);
	}

	function computeIndependentResults(inp: Family1Inputs): Family1Results | null {
		const n1 = parseNumber(inp.n1Str)!;
		const n2 = parseNumber(inp.n2Str)!;

		let d: number;
		let glDelta: number | null = null;

		switch (inp.inputType) {
			case 'd':
				d = parseNumber(inp.dStr)!;
				break;
			case 'g': {
				const g_in = parseNumber(inp.gStr)!;
				d = g_in / hedgesJ(n1, n2);
				break;
			}
			case 't':
				d = dFromT(parseNumber(inp.tStr)!, n1, n2);
				break;
			case 'f':
				d = dFromF(parseNumber(inp.fStr)!, n1, n2);
				break;
			case 'means': {
				const m1 = parseNumber(inp.m1Str)!;
				const m2 = parseNumber(inp.m2Str)!;
				const sd1 = parseNumber(inp.sd1Str)!;
				const sd2 = parseNumber(inp.sd2Str)!;
				d = dFromMeans(m1, m2, sd1, sd2, n1, n2);
				glDelta = glassDelta(m1, m2, sd2);
				break;
			}
			case 'p':
				d = dFromP(parseNumber(inp.pStr)!, n1, n2, inp.direction);
				break;
			default:
				return null;
		}

		if (!isFinite(d)) return null;

		const g  = hedgesG(d, n1, n2);
		const J  = hedgesJ(n1, n2);
		const r  = rFromD(d, n1, n2);
		const se = seD(d, n1, n2);
		const N  = n1 + n2;

		return {
			designType: 'independent',
			n: N,
			d, g, glassDelta: glDelta, r,
			cles: cles(d), u3: u3(d), ovl: ovl(d),
			variance: varD(d, n1, n2), se,
			dCI: ciD(d, se),
			gCI: ciG(g, se * J),
			rCI: ciR(r, N),
			n1, n2,
			ds: null, rPaired: null
		};
	}

	function computePairedResults(inp: Family1Inputs): Family1Results | null {
		const n = parseNumber(inp.nPairsStr)!;
		let dz: number;

		switch (inp.inputType) {
			case 't': {
				const t = parseNumber(inp.tStr)!;
				dz = dzFromTPaired(t, n);
				break;
			}
			case 'd':
				dz = parseNumber(inp.dStr)!;
				break;
			case 'means': {
				const mDiff = parseNumber(inp.mDiffStr)!;
				const sdDiff = parseNumber(inp.sdDiffStr)!;
				dz = dzFromMeansDiff(mDiff, sdDiff);
				break;
			}
			case 'p': {
				// Paired t-test: df = n - 1
				const p = parseNumber(inp.pStr)!;
				const t = tInv(1 - p / 2, n - 1);
				dz = inp.direction * dzFromTPaired(t, n);
				break;
			}
			default:
				return null;
		}

		if (!isFinite(dz)) return null;

		// Optional d_s conversion (requires r between measurements)
		const rPairedVal = parseNumber(inp.rPairedStr);
		const ds = (rPairedVal !== null && rPairedVal > -1 && rPairedVal < 1)
			? dsFromDZ(dz, rPairedVal)
			: null;

		// Hedges' correction on d_z (df = n − 1, matching the formula shown to the user)
		const J  = hedgesJOneSample(n);
		const gz = J * dz;
		const r  = rFromD(dz, n, n);
		const se = seDZ(dz, n);
		const N  = 2 * n;

		return {
			designType: 'paired',
			n: n,
			d: dz, g: gz, glassDelta: null, r,
			cles: cles(dz), u3: u3(dz), ovl: ovl(dz),
			variance: varDZ(dz, n), se,
			dCI: ciD(dz, se),
			gCI: ciG(gz, se * J),
			rCI: ciR(r, N),
			n1: n, n2: n,
			ds, rPaired: rPairedVal
		};
	}

	function computeOneSampleResults(inp: Family1Inputs): Family1Results | null {
		const n = parseNumber(inp.nPairsStr)!;
		let d: number;

		switch (inp.inputType) {
			case 'd':
				d = parseNumber(inp.dStr)!;
				break;
			case 'g': {
				const g_in = parseNumber(inp.gStr)!;
				d = g_in / hedgesJOneSample(n);
				break;
			}
			case 't':
				d = dzFromTPaired(parseNumber(inp.tStr)!, n); // t / sqrt(n)
				break;
			case 'means': {
				const m  = parseNumber(inp.m1Str)!;
				const mu0 = parseNumber(inp.mu0Str)!;
				const sd = parseNumber(inp.sd1Str)!;
				d = dFromMeanOneSample(m, mu0, sd);
				break;
			}
			case 'p': {
				const p = parseNumber(inp.pStr)!;
				const t = tInv(1 - p / 2, n - 1);
				d = inp.direction * dzFromTPaired(t, n);
				break;
			}
			default:
				return null;
		}

		if (!isFinite(d)) return null;

		const J  = hedgesJOneSample(n);
		const g  = J * d;
		const r  = rFromDOneSample(d, n);
		const se = seDZ(d, n);   // Var(d₁) = 1/n + d²/(2n), same formula as d_z

		return {
			designType: 'one-sample',
			n: n,
			d, g, glassDelta: null, r,
			cles: cles(d), u3: u3(d), ovl: ovl(d),
			variance: varDZ(d, n), se,
			dCI: ciD(d, se),
			gCI: ciG(g, se * J),
			rCI: ciR(r, n),
			n1: n, n2: n,
			ds: null, rPaired: null
		};
	}

	// ── Cross-family conversions ─────────────────────────────────────────────────

	let crossFamily = $derived(buildCrossFamily(results));

	function buildCrossFamily(r: Family1Results | null) {
		if (!r) return null;
		const logOR = dToLogOR(r.d);
		const OR = Math.exp(logOR);
		const a = (r.n1 + r.n2) ** 2 / (r.n1 * r.n2);
		return {
			logOR: logOR.toFixed(3),
			OR: OR.toFixed(3),
			r: r.r.toFixed(3),
			dFromEta2note: 'Only valid for two-group designs; enter eta-squared on the variance-explained page.'
		};
	}

	let crossOpen = $state(false);
	let pasteText = $state('');
	let pasteOpen = $state(false);

	type ParsedPaste =
		| { type: 't_df' | 'f_to_t'; t: string; df: number; label: string }
		| { type: 'd'; d: string; label: string }
		| { type: 'g'; g: string; label: string };

	let parsedPaste = $derived.by((): ParsedPaste | null => {
		const txt = pasteText;
		// t(df) = X  or  t[df] = X
		const tDf = txt.match(/t\s*[\(\[]\s*(\d+(?:\.\d+)?)\s*[\)\]]\s*=\s*(-?\d+(?:\.\d+)?)/i);
		if (tDf) {
			const df = parseFloat(tDf[1]);
			const tVal = tDf[2];
			// For independent: df = n1+n2-2, so n = df/2+1 per group (assume equal)
			// For paired: df = n-1
			return { type: 't_df', t: tVal, df, label: `t(${df}) = ${tVal}` };
		}
		// F(df1, df2) = X with df1 = 1 (two-group F = t²)
		const fStat = txt.match(/F\s*[\(\[]\s*1\s*,\s*(\d+)\s*[\)\]]\s*=\s*(\d+(?:\.\d+)?)/i);
		if (fStat) {
			const df = parseFloat(fStat[1]);
			const tVal = Math.sqrt(parseFloat(fStat[2])).toFixed(4);
			return { type: 'f_to_t', t: tVal, df, label: `F(1,${df}) = ${fStat[2]} → t = ${tVal}` };
		}
		// d = X or Cohen's d = X
		const dMatch = txt.match(/(?:Cohen'?s?\s+)?d\s*=\s*(-?\d+(?:\.\d+)?)/i);
		if (dMatch) return { type: 'd', d: dMatch[1], label: `d = ${dMatch[1]}` };
		// g = X or Hedges'g = X
		const gMatch = txt.match(/(?:Hedges'?\s+)?g\s*=\s*(-?\d+(?:\.\d+)?)/i);
		if (gMatch) return { type: 'g', g: gMatch[1], label: `g = ${gMatch[1]}` };
		return null;
	});

	function applyPaste() {
		const p = parsedPaste;
		if (!p) return;
		if (p.type === 't_df' || p.type === 'f_to_t') {
			inputs.inputType = 't';
			inputs.tStr = p.t;
			// Fill n fields based on design
			if (inputs.designType === 'paired' || inputs.designType === 'one-sample') {
				inputs.nPairsStr = String(Math.round(p.df + 1));
			} else {
				// independent: df = n1+n2-2, assume equal groups
				const nEach = Math.round(p.df / 2 + 1);
				inputs.n1Str = String(nEach);
				inputs.n2Str = String(nEach);
			}
		} else if (p.type === 'd') {
			inputs.inputType = 'd';
			inputs.dStr = p.d;
		} else if (p.type === 'g') {
			inputs.inputType = 'g';
			inputs.gStr = p.g;
		}
		pasteText = '';
		pasteOpen = false;
	}

	// ── Labels ──────────────────────────────────────────────────────────────────

	const LABEL_DEFAULTS = {
		independent: ['Group 1', 'Group 2'],
		paired: ['Condition A', 'Condition B'],
		'one-sample': ['Sample', 'Reference'],
	} as const;

	let label1 = $state('Group 1');
	let label2 = $state('Group 2');
	let customLabels = $state(false);

	// Plot SVG ref and download filename
	let distSvgEl = $state<SVGSVGElement | undefined>();
	let distPlotFilename = $derived(
		`mean-differences-${sanitizeFilename(label1)}-${sanitizeFilename(label2)}`
	);

	// Sync labels to design type defaults when not customized
	$effect(() => {
		if (!customLabels) {
			const [def1, def2] = LABEL_DEFAULTS[inputs.designType];
			label1 = def1;
			label2 = def2;
		}
	});

	function setLabel1(v: string) { label1 = v; customLabels = true; }
	function setLabel2(v: string) { label2 = v; customLabels = true; }

	// ── Sticky input button ──────────────────────────────────────────────────────

	let inputSectionEl: HTMLElement | undefined = $state();
	let showStickyBtn = $state(false);

	$effect(() => {
		if (!inputSectionEl || !browser) return;
		const obs = new IntersectionObserver(
			([entry]) => { showStickyBtn = !entry.isIntersecting; },
			{ threshold: 0 }
		);
		obs.observe(inputSectionEl);
		return () => obs.disconnect();
	});

	function scrollToInput() {
		inputSectionEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// ── Formulas (design-type aware) ──────────────────────────────────────────────

	// Formulas shared across all designs
	const F_U3    = { title: "Cohen's U3",              latex: String.raw`U_3 = \Phi(d)`,                                                                       source: 'Cohen (1988), p. 22' };
	const F_OVL   = { title: 'Overlap coefficient (OVL)', latex: String.raw`\text{OVL} = 2\,\Phi\!\left(-\frac{|d|}{2}\right)`,                                  source: 'Reiser & Faraggi (1999)' };

	let formulas = $derived.by(() => {
		if (inputs.designType === 'paired') return [
			{
				title: "Cohen's d_z from paired means",
				latex: String.raw`d_z = \frac{M_{\text{diff}}}{SD_{\text{diff}}}`,
				source: 'Cohen (1988), p. 48; Lakens (2013)'
			},
			{
				title: "Cohen's d_z from paired t-statistic",
				latex: String.raw`d_z = \frac{t}{\sqrt{n}}`,
				source: 'Lakens (2013)'
			},
			{
				title: "Cohen's d_s (between-person scale, comparable to independent d)",
				latex: String.raw`d_s = d_z \cdot \sqrt{2(1 - r)}`,
				source: 'Cohen (1988); Lakens (2013). Requires r between the two paired measurements.'
			},
			{
				title: "Hedges' g (bias-corrected d_z)",
				latex: String.raw`g = J \cdot d_z, \quad J = 1 - \frac{3}{4(n-1)-1}`,
				source: 'Borenstein et al. (2009), eq. 4.22'
			},
			{
				title: 'CLES: Probability of superiority (paired)',
				latex: String.raw`\text{CLES} = \Phi\!\left(\frac{d_z}{\sqrt{2}}\right)`,
				source: 'McGraw & Wong (1992)'
			},
			{ ...F_U3,  latex: String.raw`U_3 = \Phi(d_z)` },
			{ ...F_OVL, latex: String.raw`\text{OVL} = 2\,\Phi\!\left(-\frac{|d_z|}{2}\right)` },
			{
				title: 'Sampling variance and SE of d_z',
				latex: String.raw`\text{Var}(d_z) = \frac{1}{n} + \frac{d_z^2}{2(n-1)}, \quad SE(d_z) = \sqrt{\text{Var}(d_z)}`,
				source: 'Borenstein et al. (2009)'
			}
		];

		if (inputs.designType === 'one-sample') return [
			{
				title: "Cohen's d (one-sample)",
				latex: String.raw`d = \frac{M - \mu_0}{SD}`,
				source: 'Cohen (1988). M is the sample mean, μ₀ is the reference value.'
			},
			{
				title: "Cohen's d from one-sample t-statistic",
				latex: String.raw`d = \frac{t}{\sqrt{n}}`,
				source: 'Lakens (2013)'
			},
			{
				title: "Hedges' g (bias-corrected d)",
				latex: String.raw`g = J \cdot d, \quad J = 1 - \frac{3}{4(n-1)-1}`,
				source: 'Borenstein et al. (2009), eq. 4.22'
			},
			{
				title: 'Correlation r (one-sample)',
				latex: String.raw`r = \frac{t}{\sqrt{t^2 + df}}, \quad df = n - 1`,
				source: 'Borenstein et al. (2009)'
			},
			F_U3,
			F_OVL,
			{
				title: 'Sampling variance and SE of d',
				latex: String.raw`\text{Var}(d) = \frac{1}{n} + \frac{d^2}{2(n-1)}, \quad SE(d) = \sqrt{\text{Var}(d)}`,
				source: 'Borenstein et al. (2009)'
			}
		];

		// Independent samples (default)
		return [
			{
				title: "Cohen's d from means and SDs",
				latex: String.raw`d = \frac{M_1 - M_2}{SD_{\text{pooled}}}, \quad SD_{\text{pooled}} = \sqrt{\frac{(n_1-1)SD_1^2 + (n_2-1)SD_2^2}{n_1+n_2-2}}`,
				source: 'Borenstein et al. (2009), eq. 4.18; Cohen (1988)'
			},
			{
				title: "Cohen's d from t-statistic",
				latex: String.raw`d = t\,\sqrt{\frac{1}{n_1} + \frac{1}{n_2}}`,
				source: 'Borenstein et al. (2009), eq. 4.20'
			},
			{
				title: "Hedges' g (bias-corrected d)",
				latex: String.raw`g = J \cdot d, \quad J = 1 - \frac{3}{4(n_1+n_2-2)-1}`,
				source: 'Borenstein et al. (2009), eq. 4.22–4.24; Hedges & Olkin (1985)'
			},
			{
				title: 'Point-biserial correlation r',
				latex: String.raw`r = \frac{d}{\sqrt{d^2 + a}}, \quad a = \frac{(n_1+n_2)^2}{n_1 n_2}`,
				source: 'Borenstein et al. (2009), eq. 4.25'
			},
			{
				title: 'CLES: Probability of superiority',
				latex: String.raw`\text{CLES} = \Phi\!\left(\frac{d}{\sqrt{2}}\right)`,
				source: 'McGraw & Wong (1992); Borenstein et al. (2009), p. 57'
			},
			F_U3,
			F_OVL,
			{
				title: 'Sampling variance and SE of d',
				latex: String.raw`\text{Var}(d) = \frac{n_1+n_2}{n_1 n_2} + \frac{d^2}{2(n_1+n_2)}, \quad SE(d) = \sqrt{\text{Var}(d)}`,
				source: 'Borenstein et al. (2009), eq. 4.28'
			}
		];
	});
</script>

<svelte:head>
	<title>Cohen's d calculator | Magnitood</title>
	<meta
		name="description"
		content="Calculate Cohen's d, Hedges' g, and related effect sizes from t-statistics, F-statistics, means and SDs, or p-values. Includes 95% CI, visualisation, and plain-language interpretation."
	/>
</svelte:head>

<!-- Family 1 top-bar accent -->
<div class="h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>

<div class="mx-auto max-w-3xl px-4 py-10 space-y-10">

	<!-- Page header -->
	<header>
		<h1 class="text-3xl font-bold text-gray-900">Standardised mean differences</h1>
		<p class="mt-2 text-gray-500">
			Quantifies how far apart two groups are, or how much a sample differs from a reference value,
			in standard deviation units. Use this for independent t-tests, paired t-tests, A/B tests,
			and one-sample comparisons against norms or known values.
		</p>
	</header>

	<!-- ── Input section ── -->
	<section bind:this={inputSectionEl} aria-labelledby="input-heading">
		<div class="card p-5 sm:p-6">
			<h2 id="input-heading" class="section-title mb-5">Enter your values</h2>
		<!-- Paste parser -->
		<div class="mb-4 rounded-xl border border-gray-200 overflow-hidden">
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
					<p class="text-xs text-gray-400">Paste any line containing a t-statistic, F-statistic, d, or g. Detected values will pre-fill the form.</p>
					<textarea
						bind:value={pasteText}
						rows="2"
						placeholder="e.g.  t(42) = 3.14, p = .003  or  Cohen's d = 0.48"
						class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-none"
					></textarea>
					{#if parsedPaste}
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
					{:else if pasteText.trim()}
						<p class="text-xs text-amber-600">No recognisable statistic found. Try a line like <code class="font-mono bg-amber-50 px-1">t(42) = 3.14</code>.</p>
					{/if}
				</div>
			{/if}
		</div>
			<InputPanel bind:inputs errors={errorMap} {label1} {label2} onlabel1change={setLabel1} onlabel2change={setLabel2} />
			{#if !results && missingFields}
				<p class="mt-4 text-xs text-gray-400">Results appear once all fields above are filled in.</p>
			{/if}
		</div>
	</section>

	<!-- No result state: show friendly prompt -->
	{#if !results && validationErrors.some(e => e.message !== 'Required')}
		<div class="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
			{validationErrors.find(e => e.message !== 'Required')?.message}
		</div>
	{/if}

	<!-- ── Distribution plot ── -->
	<section aria-labelledby="viz-heading">
		<h2 id="viz-heading" class="section-title mb-3">Overlapping distributions</h2>
		<div class="card overflow-hidden relative">
			<DistributionPlot bind:svgEl={distSvgEl} d={results?.d ?? 0.5} height={280} {label1} {label2} editable={true} onlabel1change={setLabel1} onlabel2change={setLabel2} />
			{#if !results}
				<div class="absolute inset-x-0 top-3 flex justify-center pointer-events-none">
					<span class="rounded-full bg-white/90 border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500 shadow-sm">
						Example (d = 0.5) — enter your values above to see your effect
					</span>
				</div>
			{/if}
			{#if results && distSvgEl}
				<div class="flex justify-end px-4 pb-3">
					<PlotDownloadButton getSvg={() => distSvgEl} filename={distPlotFilename} />
				</div>
			{/if}
		</div>
	</section>

	<!-- ── Benchmark ribbon ── -->
	<section aria-labelledby="bench-heading">
		<h2 id="bench-heading" class="section-title mb-3">Where does this effect fall?</h2>
		<div class="card p-4">
			<BenchmarkRibbon value={results?.d ?? null} metric={inputs.designType === 'paired' ? "Cohen's d_z" : inputs.designType === 'one-sample' ? "Cohen's d₁" : "Cohen's d"} />
		</div>
	</section>

	<!-- ── Interpretation ── -->
	<section aria-labelledby="interp-heading">
		<h2 id="interp-heading" class="section-title mb-3">Interpretation</h2>
		{#if results && results.d < 0}
			<p class="mb-3 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 leading-relaxed">
				<strong class="text-gray-700">Negative d:</strong> This means {label2} scored higher than {label1}. The sign indicates direction, not quality — the magnitude |d| = {Math.abs(results.d).toFixed(2)} is what matters for effect size interpretation.
			</p>
		{/if}
		<Interpretation {results} {label1} {label2} onlabel1change={setLabel1} onlabel2change={setLabel2} />
		{#if results && results.dCI && (results.dCI[1] - results.dCI[0]) > 0.8}
			<p class="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
				This wide confidence interval reflects considerable uncertainty about the true effect size. Interpret the point estimate with caution.
			</p>
		{/if}
		<PowerPanel {results} />
	</section>

	<!-- ── Results table ── -->
	<section aria-labelledby="results-heading">
		<h2 id="results-heading" class="section-title mb-3">Results</h2>
		<div class="card p-4 sm:p-5">
			<OutputTable {results} showGlassDelta={inputs.inputType === 'means' && inputs.designType === 'independent'} />
		</div>
		{#if results}
			<div class="mt-2 flex items-center justify-between gap-3">
				<a
					href="{base}/visualize?viz=cohens-d&d={results.d.toFixed(2)}"
					class="text-xs text-violet-600 hover:underline hover:text-violet-800 transition-colors"
				>
					Visualize this effect →
				</a>
				<ShareButton />
				<CitationSnippet />
			</div>
		{/if}
	</section>

	<!-- ── Cross-family conversions ── -->
	<section aria-labelledby="cross-heading">
		<div class="border border-gray-200 rounded-xl overflow-hidden">
			<button
				onclick={() => { crossOpen = !crossOpen; }}
				class="w-full flex items-center justify-between px-5 py-3.5 text-left bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
				aria-expanded={crossOpen}
				id="cross-heading"
			>
				<span class="text-sm font-semibold text-gray-700">Cross-family conversions</span>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
					class="w-4 h-4 text-gray-400 transition-transform duration-200 {crossOpen ? 'rotate-180' : ''}" aria-hidden="true">
					<path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
				</svg>
			</button>

			{#if crossOpen}
				<div class="px-5 py-4 space-y-4">
					<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
						Cross-family conversions involve assumptions and are approximations. Report the assumption when citing these values.
					</div>

					{#if crossFamily}
						<div class="space-y-3 text-sm">
							<div class="flex items-center justify-between py-2 border-b border-gray-100">
								<div>
									<div class="font-medium text-gray-800">Log odds ratio</div>
									<div class="text-xs text-gray-400">d × (π/√3). Borenstein et al. (2009), eq. 7.1. Assumes logistic distribution.</div>
								</div>
								<div class="flex items-center gap-2 tabular-nums">
									<span class="font-semibold text-gray-900">{crossFamily.logOR}</span>
									<CopyButton text={crossFamily.logOR} title="Copy log OR" />
								</div>
							</div>
							<div class="flex items-center justify-between py-2 border-b border-gray-100">
								<div>
									<div class="font-medium text-gray-800">Odds ratio (OR)</div>
									<div class="text-xs text-gray-400">exp(log OR)</div>
								</div>
								<div class="flex items-center gap-2 tabular-nums">
									<span class="font-semibold text-gray-900">{crossFamily.OR}</span>
									<CopyButton text={crossFamily.OR} title="Copy OR" />
								</div>
							</div>
							<div class="py-2 text-xs text-gray-500">
								{crossFamily.dFromEta2note}
							</div>
						</div>
					{:else}
						<p class="text-sm text-gray-400">Enter valid values above to see cross-family conversions.</p>
					{/if}
				</div>
			{/if}
		</div>
	</section>

	<!-- ── Formulas ── -->
	<section aria-label="Statistical formulas">
		<FormulaAccordion {formulas} title="Formulas and sources" />
	</section>

	<!-- ── References ── -->
	<section aria-label="References">
		<div class="border border-gray-200 rounded-xl px-5 py-4">
			<h2 class="text-sm font-semibold text-gray-700 mb-2">References</h2>
			<ul class="space-y-1 text-xs text-gray-500 leading-relaxed">
				<li>Borenstein, M., Hedges, L. V., Higgins, J. P. T., & Rothstein, H. R. (2009). <em>Introduction to meta-analysis.</em> Wiley.</li>
				<li>Cohen, J. (1988). <em>Statistical power analysis for the behavioral sciences</em> (2nd ed.). Erlbaum.</li>
				<li>Hedges, L. V., & Olkin, I. (1985). <em>Statistical methods for meta-analysis.</em> Academic Press.</li>
				<li>McGraw, K. O., & Wong, S. P. (1992). A common language effect size statistic. <em>Psychological Bulletin, 111</em>(2), 361–365.</li>
				<li>Reiser, B., & Faraggi, D. (1999). Confidence intervals for the overlapping coefficient. <em>Journal of the Royal Statistical Society: Series D, 48</em>(3), 413–418.</li>
			</ul>
		</div>
	</section>

</div>

<!-- Sticky "edit values" button (desktop, appears when input scrolled past) -->
{#if showStickyBtn}
	<div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 hidden sm:block">
		<button
			onclick={scrollToInput}
			class="btn-primary shadow-lg px-5 py-2.5"
		>
			↑ Edit values
		</button>
	</div>
{/if}
