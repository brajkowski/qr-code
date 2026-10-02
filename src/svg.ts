/**
 * SVG serializer for a QR module matrix. The image is resolution independent:
 * `size` only sets the rendered width/height, and the symbol scales losslessly.
 */

export interface SvgRenderOptions {
  /** Rendered width/height in pixels. */
  size: number;
  /** White border width, in modules. */
  quietZone: number;
}

/** Render a module matrix to an SVG document string. */
export function renderSvg(modules: boolean[][], options: SvgRenderOptions): string {
  const n = modules.length;
  const total = n + options.quietZone * 2;
  const q = options.quietZone;

  let path = "";
  for (let y = 0; y < n; y++) {
    const row = modules[y];
    for (let x = 0; x < n; x++) {
      if (row[x]) path += `M${x + q} ${y + q}h1v1h-1z`;
    }
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${options.size}" height="${options.size}" ` +
    `viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">\n` +
    `<rect width="${total}" height="${total}" fill="#fff"/>\n` +
    `<path d="${path}" fill="#000"/>\n` +
    `</svg>\n`
  );
}
