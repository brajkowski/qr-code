import assert from "node:assert/strict";
import { test } from "node:test";

import { BitBuffer } from "../src/bitbuffer.ts";

test("packs bits most-significant first", () => {
  const b = new BitBuffer();
  b.push(0b1011, 4);
  b.push(0b0110, 4);
  assert.deepEqual([...b.toBytes()], [0b10110110]);
});

test("right-pads the final partial byte with zeros", () => {
  const b = new BitBuffer();
  b.push(0b101, 3);
  assert.equal(b.length, 3);
  assert.deepEqual([...b.toBytes()], [0b10100000]);
});

test("pushBytes appends whole bytes", () => {
  const b = new BitBuffer();
  b.push(0b0100, 4); // byte-mode indicator nibble
  b.pushBytes([0xff, 0x00]);
  assert.deepEqual([...b.toBytes()], [0b01001111, 0b11110000, 0b00000000]);
});

test("toBytes pads to a target length with the 0xEC 0x11 pattern", () => {
  const b = new BitBuffer();
  b.push(0, 8);
  assert.deepEqual([...b.toBytes(5)], [0x00, 0xec, 0x11, 0xec, 0x11]);
});
