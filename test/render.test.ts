import assert from "node:assert/strict";
import { test } from "node:test";
import { inflateSync } from "node:zlib";

import { generate } from "../src/index.ts";
import { renderPng } from "../src/png.ts";
import { renderSvg } from "../src/svg.ts";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readChunks(png: Buffer): Array<{ type: string; data: Buffer; crcOk: boolean }> {
  const chunks = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("latin1", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    const stored = png.readUInt32BE(offset + 8 + length);
    chunks.push({ type, data, crcOk: crc32(png.subarray(offset + 4, offset + 8 + length)) === stored });
    offset += 12 + length;
  }
  return chunks;
}

test("PNG has a valid signature and well-formed chunks", () => {
  const { modules } = generate("png structure", "M");
  const { data } = renderPng(modules, { size: 200, quietZone: 4 });
  assert.ok(data.subarray(0, 8).equals(PNG_SIGNATURE));

  const chunks = readChunks(data);
  assert.deepEqual(
    chunks.map((c) => c.type),
    ["IHDR", "IDAT", "IEND"],
  );
  assert.ok(chunks.every((c) => c.crcOk));
});

test("PNG size is quantised down to whole modules and reported", () => {
  const { modules, size } = generate("quantise", "M");
  const total = size + 8;
  const raster = renderPng(modules, { size: 1000, quietZone: 4 });
  const expectedScale = Math.floor(1000 / total);
  assert.equal(raster.scale, expectedScale);
  assert.equal(raster.pixels, expectedScale * total);

  const ihdr = readChunks(raster.data)[0].data;
  assert.equal(ihdr.readUInt32BE(0), raster.pixels);
  assert.equal(ihdr.readUInt32BE(4), raster.pixels);
});

test("PNG scale never drops below 1", () => {
  const { modules } = generate("tiny target", "H");
  const raster = renderPng(modules, { size: 1, quietZone: 4 });
  assert.equal(raster.scale, 1);
});

test("PNG pixel data decodes to the module matrix", () => {
  const { modules, size } = generate("pixels", "M");
  const quietZone = 4;
  const raster = renderPng(modules, { size: size + 2 * quietZone, quietZone }); // scale 1
  assert.equal(raster.scale, 1);

  const idat = readChunks(raster.data)[1].data;
  const raw = inflateSync(idat);
  const stride = raster.pixels + 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const byte = raw[(y + quietZone) * stride + 1 + (x + quietZone)];
      assert.equal(byte === 0x00, modules[y][x], `module ${x},${y}`);
    }
  }
});

test("SVG is well-formed with a module-unit viewBox and the requested pixel size", () => {
  const { modules, size } = generate("svg structure", "Q");
  const svg = renderSvg(modules, { size: 640, quietZone: 4 });
  assert.match(svg, /^<\?xml /);
  assert.ok(svg.includes(`width="640" height="640"`));
  assert.ok(svg.includes(`viewBox="0 0 ${size + 8} ${size + 8}"`));

  const darkModules = modules.flat().filter(Boolean).length;
  const drawn = svg.match(/M\d+ \d+h1v1h-1z/g)?.length ?? 0;
  assert.equal(drawn, darkModules);
});
