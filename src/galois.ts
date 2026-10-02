/**
 * Arithmetic over GF(256) with the QR-standard primitive polynomial
 * x^8 + x^4 + x^3 + x^2 + 1 (0x11d). Used by Reed-Solomon error correction.
 */

const PRIMITIVE = 0x11d;

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(function buildTables(): void {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= PRIMITIVE;
  }
  // Duplicate the cycle so callers can index EXP[a + b] without a modulo.
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

/** α raised to the power `n` (n is reduced mod 255). */
export function exp(n: number): number {
  return EXP[((n % 255) + 255) % 255];
}

/** Discrete log base α of `n`. `n` must be non-zero. */
export function log(n: number): number {
  if (n === 0) throw new Error("log(0) is undefined in GF(256)");
  return LOG[n];
}

/** Multiply two field elements. */
export function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/**
 * Multiply two polynomials whose coefficients are field elements. Coefficients
 * are ordered high-degree first.
 */
export function polyMul(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      out[i + j] ^= mul(a[i], b[j]);
    }
  }
  return out;
}
