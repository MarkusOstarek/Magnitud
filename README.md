# Magnitood

**Effect sizes, explained.** A free, open-source effect size calculator and interpreter for researchers, students, and anyone working with quantitative data.

**Live site:** https://markusostarek.github.io/Magnitood/

All computation is client-side — your data never leaves the browser. Every calculation produces a shareable URL.

## Tools

| Tool | Metrics |
| --- | --- |
| [Mean differences](https://markusostarek.github.io/Magnitood/cohens-d) | Cohen's d, Hedges' g, Glass's Δ, CLES, U3, overlap — independent, paired, and one-sample designs |
| [Correlations](https://markusostarek.github.io/Magnitood/correlation) | Pearson's r, R², Fisher's z, CIs, power |
| [ANOVA / Regression](https://markusostarek.github.io/Magnitood/variance-explained) | η², partial η², ω², Cohen's f, noncentral-F CIs |
| [Risk & Odds](https://markusostarek.github.io/Magnitood/binary-outcomes) | Odds ratio, risk ratio, risk difference, NNT/NNH, phi |
| [Coefficient Interpreter](https://markusostarek.github.io/Magnitood/regression-coefficients) | Plain-English interpretation of regression coefficients for any model type and coding scheme |
| [Visualizer](https://markusostarek.github.io/Magnitood/visualize) | Interactive sliders for d, r, OR, and η² |

Each calculator includes 95% confidence intervals, standard errors for meta-analysis, plain-language interpretations, benchmark ribbons, power/MDE panels, downloadable plots (SVG/PNG), and APA-style reporting strings.

## Methodology

Formulas follow Borenstein et al. (2009), Cohen (1988), and Hedges & Olkin (1985). Results are validated against R's `metafor::escalc()` and the `esc` package — see the test suite in `src/lib/math/*.test.ts`.

Found a formula that disagrees with your software? Please [open an issue](https://github.com/MarkusOstarek/Magnitood/issues) — statistical correctness reports are especially welcome.

## Development

Built with SvelteKit 2 + Svelte 5 (runes), TypeScript, Tailwind CSS, D3, jstat, and KaTeX. Deployed to GitHub Pages as a fully static site.

```bash
npm install
npm run dev      # local dev server
npm test         # vitest unit tests
npm run check    # svelte-check / TypeScript
npm run build    # production build (static, in ./build)
```

Pushes to `master` deploy automatically via GitHub Actions (tests → type check → build → Pages).

## Citing

Use the **Cite** button on the site for APA, BibTeX, and RIS formats.

## License

© Markus Ostarek. Source available for inspection and contributions via issues/PRs.
