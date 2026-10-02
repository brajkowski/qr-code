/**
 * Minimal PNG encoder for 8-bit grayscale images, using only Node's built-in
 * zlib. No external dependencies.
 */

import { deflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "latin1");
  const body = Buffer.concat([typeBytes, data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

export interface PngRenderOptions {
  /** Target width/height in pixels. Quantised down so every module is whole pixels. */
  size: number;
  /** White border width, in modules. */
  quietZone: number;
}

export interface RenderedRaster {
  data: Buffer;
  /** Actual pixel width/height written (may be smaller than the requested size). */
  pixels: number;
  /** Rendered scale — pixels per module. */
  scale: number;
}

/** Render a module matrix to a grayscale PNG buffer. */
export function renderPng(modules: boolean[][], options: PngRenderOptions): RenderedRaster {
  const n = modules.length;
  const totalModules = n + options.quietZone * 2;
  const scale = Math.max(1, Math.floor(options.size / totalModules));
  const pixels = scale * totalModules;

  // One filter byte (0 = None) per row, then `pixels` grayscale bytes.
  const raw = Buffer.alloc((pixels + 1) * pixels, 0xff);
  for (let py = 0; py < pixels; py++) {
    raw[py * (pixels + 1)] = 0x00; // filter byte
    const my = Math.floor(py / scale) - options.quietZone;
    if (my < 0 || my >= n) continue;
    const row = modules[my];
    for (let px = 0; px < pixels; px++) {
      const mx = Math.floor(px / scale) - options.quietZone;
      if (mx >= 0 && mx < n && row[mx]) {
        raw[py * (pixels + 1) + 1 + px] = 0x00;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(pixels, 0);
  ihdr.writeUInt32BE(pixels, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // color type: grayscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const png = Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  return { data: png, pixels, scale };
}
