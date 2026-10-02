/**
 * Turn a UTF-8 string into the final interleaved codeword stream for a QR
 * symbol: mode + character count + data + terminator + padding, split into
 * Reed-Solomon blocks, error-corrected, and interleaved per the spec.
 */

import { BitBuffer } from "./bitbuffer.ts";
import type { EccLevel } from "./config.ts";
import { ecCodewords } from "./reedsolomon.ts";
import {
  blockLayout,
  byteModeCountBits,
  MAX_VERSION,
  MIN_VERSION,
  remainderBits,
} from "./tables.ts";

const BYTE_MODE_INDICATOR = 0b0100;

export class QrCapacityError extends Error {
  constructor(byteLength: number, ecc: EccLevel) {
    super(
      `data is ${byteLength} bytes; QR version ${MAX_VERSION} at ECC level ${ecc} ` +
        `cannot hold it — shorten the input or lower the ECC level`,
    );
    this.name = "QrCapacityError";
  }
}

export interface EncodeResult {
  version: number;
  ecc: EccLevel;
  /** Final interleaved data+ECC codeword stream, ready for matrix placement. */
  codewords: Uint8Array;
  /** Number of trailing zero bits to append after the codeword stream. */
  remainderBits: number;
}

/** Bit length of the data segment (mode + count + payload) at a given version. */
function segmentBitLength(byteLength: number, version: number): number {
  return 4 + byteModeCountBits(version) + byteLength * 8;
}

function chooseVersion(byteLength: number, ecc: EccLevel, minVersion: number): number {
  for (let version = Math.max(minVersion, MIN_VERSION); version <= MAX_VERSION; version++) {
    const capacityBits = blockLayout(version, ecc).totalDataCodewords * 8;
    if (segmentBitLength(byteLength, version) <= capacityBits) return version;
  }
  throw new QrCapacityError(byteLength, ecc);
}

export function encode(
  text: string,
  ecc: EccLevel,
  options: { minVersion?: number } = {},
): EncodeResult {
  const data = new TextEncoder().encode(text);
  const version = chooseVersion(data.length, ecc, options.minVersion ?? MIN_VERSION);
  const layout = blockLayout(version, ecc);
  const totalDataCodewords = layout.totalDataCodewords;

  // --- assemble the bitstream -------------------------------------------------
  const buffer = new BitBuffer();
  buffer.push(BYTE_MODE_INDICATOR, 4);
  buffer.push(data.length, byteModeCountBits(version));
  buffer.pushBytes(data);

  // Terminator: up to four zero bits, but not past capacity.
  const capacityBits = totalDataCodewords * 8;
  const terminator = Math.min(4, capacityBits - buffer.length);
  buffer.push(0, terminator);

  const codewordData = buffer.toBytes(totalDataCodewords);

  // --- split into blocks, error-correct -------------------------------------
  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];
  let offset = 0;
  for (const blockLen of layout.blockDataLengths) {
    const block = Array.from(codewordData.subarray(offset, offset + blockLen));
    offset += blockLen;
    dataBlocks.push(block);
    eccBlocks.push(ecCodewords(block, layout.eccPerBlock));
  }

  // --- interleave ----------------------------------------------------------
  const result: number[] = [];
  const maxDataLen = Math.max(...layout.blockDataLengths);
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  for (let i = 0; i < layout.eccPerBlock; i++) {
    for (const block of eccBlocks) result.push(block[i]);
  }

  return {
    version,
    ecc,
    codewords: Uint8Array.from(result),
    remainderBits: remainderBits(version),
  };
}
