/**
 * Reed-Solomon error-correction codeword generation for QR symbols.
 */

import { exp, mul, polyMul } from "./galois.ts";

const generatorCache = new Map<number, number[]>();

/**
 * The generator polynomial for `degree` error-correction codewords:
 * ∏ (x − α^i) for i in 0..degree-1. Coefficients are high-degree first.
 */
export function generatorPoly(degree: number): number[] {
  const cached = generatorCache.get(degree);
  if (cached) return cached;

  let poly = [1];
  for (let i = 0; i < degree; i++) {
    poly = polyMul(poly, [1, exp(i)]);
  }
  generatorCache.set(degree, poly);
  return poly;
}

/**
 * The `ecCount` error-correction codewords for a block of data codewords,
 * i.e. the remainder of data·x^ecCount divided by the generator polynomial.
 */
export function ecCodewords(data: readonly number[], ecCount: number): number[] {
  const generator = generatorPoly(ecCount);
  const remainder = new Array<number>(data.length + ecCount).fill(0);
  for (let i = 0; i < data.length; i++) remainder[i] = data[i];

  for (let i = 0; i < data.length; i++) {
    const coeff = remainder[i];
    if (coeff === 0) continue;
    for (let j = 0; j < generator.length; j++) {
      remainder[i + j] ^= mul(generator[j], coeff);
    }
  }

  return remainder.slice(data.length);
}
