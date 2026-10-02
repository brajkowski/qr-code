/**
 * Acceptance test: every generated symbol must decode back to its input with an
 * independent library (@nuintun/qrcode) — a different codebase from the encoder
 * and from the parity oracle. This is the "no scanner can read it" guard.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { binarize, Decoder, Detector, grayscale } from "@nuintun/qrcode";

import { generate } from "../src/index.ts";

const QUIET_ZONE = 4;
const SCALE = 4;

function rasterize(modules: boolean[][]): { data: Uint8ClampedArray; width: number; height: number } {
  const n = modules.length;
  const dim = (n + QUIET_ZONE * 2) * SCALE;
  const data = new Uint8ClampedArray(dim * dim * 4).fill(255);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!modules[y][x]) continue;
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const px = (x + QUIET_ZONE) * SCALE + dx;
          const py = (y + QUIET_ZONE) * SCALE + dy;
          const i = (py * dim + px) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width: dim, height: dim };
}

function decode(modules: boolean[][]): string {
  const img = rasterize(modules);
  const binarized = binarize(grayscale(img), img.width, img.height);
  const detected = new Detector().detect(binarized);
  const decoder = new Decoder({ decode: (bytes) => new TextDecoder().decode(bytes) });
  let cur = detected.next();
  while (!cur.done) {
    try {
      return decoder.decode(cur.value.matrix).content;
    } catch {
      cur = detected.next(false);
    }
  }
  throw new Error("no QR symbol decoded");
}

const INPUTS = [
  "a",
  "https://example.com/path?q=1&x=2#frag",
  "HELLO WORLD 123",
  "こんにちは世界 🌍",
  "MECARD:N:Doe,John;TEL:13035551212;;",
  "The quick brown fox jumps over the lazy dog. ".repeat(4),
  "x".repeat(600),
];

for (const text of INPUTS) {
  for (const ecc of ["L", "M", "Q", "H"] as const) {
    test(`round-trips ${JSON.stringify(text.slice(0, 20))} @ ${ecc}`, () => {
      assert.equal(decode(generate(text, ecc).modules), text);
    });
  }
}
