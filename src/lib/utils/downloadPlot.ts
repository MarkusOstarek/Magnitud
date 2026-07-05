/**
 * Utilities for downloading plot SVGs as SVG or PNG files.
 *
 * SVG download: serialises the element directly — fully vector, editable in Illustrator/Inkscape.
 * PNG download: renders SVG to a canvas at 2× pixel density (retina-ready).
 */

function triggerDownload(href: string, filename: string): void {
	const link = document.createElement('a');
	link.href = href;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

/** Download an SVG element as an .svg file. */
export function downloadSVG(svgEl: SVGSVGElement, filename: string): void {
	const serializer = new XMLSerializer();
	let source = serializer.serializeToString(svgEl);

	// Ensure the SVG namespace is declared (required for standalone files)
	if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
		source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
	}

	const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	triggerDownload(url, filename);
	URL.revokeObjectURL(url);
}

/** Download an SVG element as a PNG file (2× scale for retina displays). */
export async function downloadPNG(
	svgEl: SVGSVGElement,
	filename: string,
	scale = 2
): Promise<void> {
	const serializer = new XMLSerializer();
	let source = serializer.serializeToString(svgEl);

	if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
		source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
	}

	// Determine pixel dimensions from viewBox or fallback to clientWidth/Height
	const vb = svgEl.viewBox.baseVal;
	const w = (vb.width  || svgEl.clientWidth  || 500);
	const h = (vb.height || svgEl.clientHeight || 340);

	const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
	const svgUrl = URL.createObjectURL(blob);

	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width  = w * scale;
			canvas.height = h * scale;
			const ctx = canvas.getContext('2d');
			if (!ctx) { URL.revokeObjectURL(svgUrl); reject(new Error('No canvas context')); return; }
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(img, 0, 0, w * scale, h * scale);
			URL.revokeObjectURL(svgUrl);
			triggerDownload(canvas.toDataURL('image/png'), filename);
			resolve();
		};
		img.onerror = () => { URL.revokeObjectURL(svgUrl); reject(new Error('SVG render failed')); };
		img.src = svgUrl;
	});
}

/** Turn a label into a safe filename segment. "Variable X" → "variable-x" */
export function sanitizeFilename(s: string): string {
	return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
