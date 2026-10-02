import assert from "node:assert/strict";
import { test } from "node:test";

import { generate } from "../src/index.ts";

function isFinder(modules: boolean[][], ox: number, oy: number): boolean {
  const pattern = [
    "1111111",
    "1000001",
    "1011101",
    "1011101",
    "1011101",
    "1000001",
    "1111111",
  ];
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      if (modules[oy + y][ox + x] !== (pattern[y][x] === "1")) return false;
    }
  }
  return true;
}

test("symbol size is 4·version + 17", () => {
  assert.equal(generate("a", "M").size, 21); // version 1
  assert.equal(generate("x".repeat(24), "M").size, 25); // version 2
});

test("finder patterns sit in three corners", () => {
  const { modules, size } = generate("hello world", "Q");
  assert.ok(isFinder(modules, 0, 0));
  assert.ok(isFinder(modules, size - 7, 0));
  assert.ok(isFinder(modules, 0, size - 7));
});

test("timing patterns alternate along row and column 6", () => {
  const { modules, size } = generate("timing", "M");
  for (let i = 8; i < size - 8; i++) {
    assert.equal(modules[6][i], i % 2 === 0);
    assert.equal(modules[i][6], i % 2 === 0);
  }
});

test("the dark module is always set", () => {
  const { modules, version } = generate("dark", "H");
  assert.equal(modules[4 * version + 9][8], true);
});

test("mask index is in range and generation is deterministic", () => {
  const a = generate("determinism", "M");
  const b = generate("determinism", "M");
  assert.ok(a.mask >= 0 && a.mask <= 7);
  assert.deepEqual(a.modules, b.modules);
});
