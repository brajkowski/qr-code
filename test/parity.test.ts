import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { generate } from "../src/index.ts";

interface Fixture {
  text: string;
  ecc: "L" | "M" | "Q" | "H";
  version: number;
  size: number;
  mask: number;
  rows: string[];
}

const fixtures: Fixture[] = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/matrices.json", import.meta.url)), "utf8"),
);

test("committed fixtures cover version 1 through 40 and all ECC levels", () => {
  assert.ok(fixtures.some((f) => f.version === 1));
  assert.ok(fixtures.some((f) => f.version === 40));
  assert.ok(fixtures.some((f) => f.version >= 10 && f.version <= 30));
  for (const level of ["L", "M", "Q", "H"]) {
    assert.ok(fixtures.some((f) => f.ecc === level));
  }
});

for (const fx of fixtures) {
  test(`matches the reference matrix for ${JSON.stringify(fx.text.slice(0, 16))} @ ${fx.ecc}`, () => {
    const symbol = generate(fx.text, fx.ecc);
    assert.equal(symbol.version, fx.version);
    assert.equal(symbol.size, fx.size);
    assert.equal(symbol.mask, fx.mask);
    const rows = symbol.modules.map((row) => row.map((cell) => (cell ? "1" : "0")).join(""));
    assert.deepEqual(rows, fx.rows);
  });
}
