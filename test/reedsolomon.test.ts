import assert from "node:assert/strict";
import { test } from "node:test";

import { ecCodewords, generatorPoly } from "../src/reedsolomon.ts";

test("generator polynomial for 7 EC codewords", () => {
  // The canonical degree-7 generator (integer coefficients), high-degree first.
  assert.deepEqual(generatorPoly(7), [1, 127, 122, 154, 164, 11, 68, 117]);
});

test("generator polynomial has degree === codeword count", () => {
  for (const n of [10, 13, 18, 30]) assert.equal(generatorPoly(n).length, n + 1);
});

test("HELLO WORLD version 1-M error-correction codewords", () => {
  // Worked example reproduced in every QR tutorial: 16 data codewords for
  // "HELLO WORLD" at version 1, ECC level M, plus its 10 EC codewords.
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  assert.deepEqual(ecCodewords(data, 10), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});

test("all-zero data yields all-zero EC codewords", () => {
  assert.deepEqual(ecCodewords([0, 0, 0, 0], 5), [0, 0, 0, 0, 0]);
});
