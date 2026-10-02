/** Public QR generation API. */

import type { EccLevel } from "./config.ts";
import { encode } from "./encoder.ts";
import { buildMatrix } from "./matrix.ts";

export { QrCapacityError } from "./encoder.ts";
export type { EccLevel } from "./config.ts";
export { DEFAULT_ECC_LEVEL, DEFAULT_PNG_SIZE, DEFAULT_SVG_SIZE, QUIET_ZONE_MODULES } from "./config.ts";
export { renderPng } from "./png.ts";
export type { PngRenderOptions, RenderedRaster } from "./png.ts";
export { renderSvg } from "./svg.ts";
export type { SvgRenderOptions } from "./svg.ts";

export interface QrSymbol {
  /** `modules[y][x]` — true is a dark module. Does not include the quiet zone. */
  modules: boolean[][];
  /** Module count per side (21 for version 1 … 177 for version 40). */
  size: number;
  version: number;
  ecc: EccLevel;
  mask: number;
}

/** Generate the QR module matrix for a UTF-8 string. */
export function generate(text: string, ecc: EccLevel, options: { minVersion?: number } = {}): QrSymbol {
  const encoded = encode(text, ecc, options);
  const built = buildMatrix(encoded);
  return {
    modules: built.modules,
    size: built.size,
    version: encoded.version,
    ecc: encoded.ecc,
    mask: built.mask,
  };
}
