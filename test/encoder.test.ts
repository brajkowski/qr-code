import assert from "node:assert/strict";
import { test } from "node:test";

import { encode, QrCapacityError } from "../src/encoder.ts";
import { blockLayout } from "../src/tables.ts";

test("picks the smallest version that fits the data", () => {
  // Version 1-L carries 19 data codewords = 152 bits; a byte segment costs
  // 4 + 8 + 8n bits, so 17 bytes (148 bits) is the last that fits version 1.
  assert.equal(encode("x".repeat(17), "L").version, 1);
  assert.equal(encode("x".repeat(18), "L").version, 2);
});

test("higher ECC levels need a larger symbol for the same data", () => {
  const text = "x".repeat(20);
  assert.ok(encode(text, "H").version >= encode(text, "L").version);
});

test("counts UTF-8 bytes, not characters", () => {
  // Each of these is 3 UTF-8 bytes.
  const result = encode("あ".repeat(10), "M");
  assert.ok(result.version >= 2);
});

test("throws QrCapacityError when data exceeds version 40", () => {
  assert.throws(() => encode("z".repeat(3000), "H"), QrCapacityError);
});

test("codeword stream length matches the version's total capacity", () => {
  for (const [text, ecc] of [
    ["hello", "M"],
    ["x".repeat(300), "Q"],
    ["y".repeat(800), "L"],
  ] as const) {
    const { version, codewords } = encode(text, ecc);
    const layout = blockLayout(version, ecc);
    const totalCodewords =
      layout.totalDataCodewords + layout.eccPerBlock * layout.blockDataLengths.length;
    assert.equal(codewords.length, totalCodewords);
  }
});

test("minVersion option is respected", () => {
  assert.equal(encode("a", "M", { minVersion: 5 }).version, 5);
});
