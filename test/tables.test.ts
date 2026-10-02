import assert from "node:assert/strict";
import { test } from "node:test";

import {
  alignmentPatternPositions,
  blockLayout,
  byteModeCountBits,
  remainderBits,
} from "../src/tables.ts";

test("version 1-M is a single 16-codeword block with 10 EC codewords", () => {
  const l = blockLayout(1, "M");
  assert.equal(l.eccPerBlock, 10);
  assert.deepEqual(l.blockDataLengths, [16]);
  assert.equal(l.totalDataCodewords, 16);
});

test("version 5-Q splits into 2 + 2 blocks of 15 and 16 data codewords", () => {
  const l = blockLayout(5, "Q");
  assert.equal(l.eccPerBlock, 18);
  assert.deepEqual(l.blockDataLengths, [15, 15, 16, 16]);
  assert.equal(l.totalDataCodewords, 62);
});

test("version 40-H has 81 blocks and 1276 data codewords", () => {
  const l = blockLayout(40, "H");
  assert.equal(l.eccPerBlock, 30);
  assert.equal(l.blockDataLengths.length, 81);
  assert.equal(l.totalDataCodewords, 1276);
  assert.equal(
    l.blockDataLengths.reduce((a, b) => a + b, 0),
    1276,
  );
});

test("alignment pattern positions match the spec table", () => {
  assert.deepEqual(alignmentPatternPositions(1), []);
  assert.deepEqual(alignmentPatternPositions(2), [6, 18]);
  assert.deepEqual(alignmentPatternPositions(7), [6, 22, 38]);
  assert.deepEqual(alignmentPatternPositions(32), [6, 34, 60, 86, 112, 138]);
  assert.deepEqual(alignmentPatternPositions(40), [6, 30, 58, 86, 114, 142, 170]);
});

test("remainder bits follow the spec", () => {
  assert.equal(remainderBits(1), 0);
  assert.equal(remainderBits(2), 7);
  assert.equal(remainderBits(14), 3);
  assert.equal(remainderBits(21), 4);
  assert.equal(remainderBits(40), 0);
});

test("byte-mode character-count width widens at version 10", () => {
  assert.equal(byteModeCountBits(9), 8);
  assert.equal(byteModeCountBits(10), 16);
  assert.equal(byteModeCountBits(40), 16);
});
