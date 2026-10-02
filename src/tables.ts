/**
 * QR symbol capacity tables, transcribed from ISO/IEC 18004 (and cross-checked
 * against the `qrcode` reference implementation by the test fixtures).
 *
 * Rather than storing the full five-number block layout for every
 * version/level, we store just two tables — error-correction codewords per
 * block, and number of blocks — and derive the block split arithmetically, the
 * way the spec itself defines it. `test/tables.test.ts` verifies the derived
 * numbers against fixtures generated from the reference library.
 */

import type { EccLevel } from "./config.ts";

export const ECC_ORDER: readonly EccLevel[] = ["L", "M", "Q", "H"];

/** ECC level -> its two format-info bits (per ISO/IEC 18004 Table 12). */
export const ECC_FORMAT_BITS: Record<EccLevel, number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

// Index [eccLevel 0..3][version 1..40]; index 0 of the inner array is a placeholder.
const ECC_CODEWORDS_PER_BLOCK: readonly (readonly number[])[] = [
  // L
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // M
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  // Q
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // H
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

const NUM_ERROR_CORRECTION_BLOCKS: readonly (readonly number[])[] = [
  // L
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  // M
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  // Q
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  // H
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

export const MIN_VERSION = 1;
export const MAX_VERSION = 40;

/** Total number of data-carrying module bits for a version (before ECC). */
export function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

/** Bits left over after packing raw data modules into whole codewords. */
export function remainderBits(version: number): number {
  return rawDataModules(version) % 8;
}

export interface BlockLayout {
  eccPerBlock: number;
  /** Data codeword count for each block, in placement order (short blocks first). */
  blockDataLengths: number[];
  totalDataCodewords: number;
}

/** Derive the Reed-Solomon block split for a version and ECC level. */
export function blockLayout(version: number, ecc: EccLevel): BlockLayout {
  const e = ECC_ORDER.indexOf(ecc);
  const eccPerBlock = ECC_CODEWORDS_PER_BLOCK[e][version];
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e][version];

  const totalCodewords = Math.floor(rawDataModules(version) / 8);
  const totalEcc = eccPerBlock * numBlocks;
  const totalDataCodewords = totalCodewords - totalEcc;

  const numShortBlocks = numBlocks - (totalCodewords % numBlocks);
  const shortBlockDataLen = Math.floor(totalCodewords / numBlocks) - eccPerBlock;

  const blockDataLengths: number[] = [];
  for (let i = 0; i < numBlocks; i++) {
    blockDataLengths.push(i < numShortBlocks ? shortBlockDataLen : shortBlockDataLen + 1);
  }

  return { eccPerBlock, blockDataLengths, totalDataCodewords };
}

/** Center coordinates of the alignment patterns for a version (empty for v1). */
export function alignmentPatternPositions(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step =
    version === 32
      ? 26
      : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result: number[] = [6];
  for (let pos = version * 4 + 10; result.length < numAlign; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

/** Character-count-indicator width in bits for byte mode at a given version. */
export function byteModeCountBits(version: number): number {
  return version <= 9 ? 8 : 16;
}
