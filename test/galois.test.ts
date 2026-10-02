import assert from "node:assert/strict";
import { test } from "node:test";

import { exp, log, mul, polyMul } from "../src/galois.ts";

test("multiplication by zero is zero", () => {
  assert.equal(mul(0, 5), 0);
  assert.equal(mul(200, 0), 0);
});

test("multiplication by one is identity", () => {
  for (const a of [1, 2, 47, 128, 255]) assert.equal(mul(a, 1), a);
});

test("known GF(256) products", () => {
  assert.equal(mul(2, 2), 4); // x·x = x^2
  assert.equal(mul(0x80, 0x02), 0x1d); // x^7·x = x^8 reduces by the primitive poly
  assert.equal(mul(0x10, 0x10), 0x1d); // x^4·x^4 = x^8, same reduction
  assert.equal(mul(3, 7), 9); // (x+1)(x^2+x+1) = x^3 + 1
});

test("multiplication is commutative and associative", () => {
  assert.equal(mul(mul(23, 45), 67), mul(23, mul(45, 67)));
  assert.equal(mul(200, 17), mul(17, 200));
});

test("exp and log are inverses", () => {
  for (let i = 1; i < 256; i++) assert.equal(exp(log(i)), i);
});

test("exp cycles with period 255", () => {
  assert.equal(exp(0), exp(255));
  assert.equal(exp(1), exp(256));
});

test("log(0) throws", () => {
  assert.throws(() => log(0));
});

test("polyMul multiplies (x+1)(x+1) = x^2 + 0x + 1 over GF(2)", () => {
  // (1·x + 1)(1·x + 1): middle term is 1 XOR 1 = 0 in the field.
  assert.deepEqual(polyMul([1, 1], [1, 1]), [1, 0, 1]);
});
