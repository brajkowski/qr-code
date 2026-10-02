/**
 * Editable defaults for the QR generator — the single source of truth.
 *
 * These constants are compiled into `dist/qr.js` by esbuild. To change a
 * default: edit the value here, run `yarn build`, and commit both this file and
 * the regenerated `dist/qr.js` in the same commit (CI fails if they drift).
 *
 * For a per-invocation override without rebuilding, set the matching `QR_*`
 * environment variable (see README). Precedence is: CLI flag > env var > the
 * constant below.
 */

/** QR error-correction level. Higher levels survive more damage but need a larger symbol. */
export type EccLevel = "L" | "M" | "Q" | "H";

/**
 * Target width/height in pixels for PNG output. The QR symbol is a whole number
 * of square modules, so the actual file is quantised *down* to the nearest size
 * that keeps every module an integer number of pixels. The CLI reports the
 * real dimensions it wrote.
 */
export const DEFAULT_PNG_SIZE = 512;

/**
 * Rendered width/height in pixels for SVG output. SVG is resolution
 * independent, so this is applied exactly and the image still scales losslessly.
 */
export const DEFAULT_SVG_SIZE = 512;

/** Error-correction level used when `--ecc` / `QR_ECC` is not given. */
export const DEFAULT_ECC_LEVEL: EccLevel = "M";

/**
 * Width of the white border around the symbol, in modules. The QR spec mandates
 * a minimum of 4; going below that hurts scan reliability.
 */
export const QUIET_ZONE_MODULES = 4;

/** Base filename (no extension) used when `--output` is not given. */
export const DEFAULT_OUTPUT_BASENAME = "qrcode";
