import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_ECC_LEVEL,
  DEFAULT_PNG_SIZE,
  DEFAULT_SVG_SIZE,
  QUIET_ZONE_MODULES,
  generate,
  renderPng,
  renderSvg,
  type PngRenderOptions,
  type RenderedRaster,
  type SvgRenderOptions,
} from "../src/index.ts";

test("renderers are exported from the entry point", () => {
  assert.equal(typeof renderPng, "function");
  assert.equal(typeof renderSvg, "function");
});

test("defaults are re-exported with their expected values", () => {
  assert.equal(DEFAULT_ECC_LEVEL, "M");
  assert.equal(QUIET_ZONE_MODULES, 4);
  assert.equal(DEFAULT_PNG_SIZE, 512);
  assert.equal(DEFAULT_SVG_SIZE, 512);
});

test("a symbol is generated and rendered using only the entry-point exports", () => {
  const qr = generate("https://example.com", DEFAULT_ECC_LEVEL);

  const pngOptions: PngRenderOptions = { size: DEFAULT_PNG_SIZE, quietZone: QUIET_ZONE_MODULES };
  const png: RenderedRaster = renderPng(qr.modules, pngOptions);
  assert.deepEqual([...png.data.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(png.pixels > 0 && png.pixels <= DEFAULT_PNG_SIZE);

  const svgOptions: SvgRenderOptions = { size: DEFAULT_SVG_SIZE, quietZone: QUIET_ZONE_MODULES };
  assert.match(renderSvg(qr.modules, svgOptions), /^<\?xml/);
});
