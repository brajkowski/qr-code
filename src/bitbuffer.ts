/**
 * MSB-first bit accumulator. Bits are appended most-significant first and read
 * back as whole bytes (zero-padded on the right).
 */
export class BitBuffer {
  private bits: number[] = [];

  /** Append the low `length` bits of `value`, most-significant bit first. */
  push(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }

  /** Append every bit of every byte. */
  pushBytes(bytes: Iterable<number>): void {
    for (const byte of bytes) this.push(byte, 8);
  }

  /** Number of bits accumulated so far. */
  get length(): number {
    return this.bits.length;
  }

  /**
   * Pack the accumulated bits into bytes (MSB first, right zero-padded). If
   * `padToBytes` is given, the result is extended to that many bytes with the
   * QR pad pattern 0xEC, 0x11, 0xEC, 0x11, …
   */
  toBytes(padToBytes?: number): Uint8Array {
    const byteLength = Math.ceil(this.bits.length / 8);
    const out = new Uint8Array(padToBytes ?? byteLength);
    for (let i = 0; i < this.bits.length; i++) {
      if (this.bits[i]) out[i >> 3] |= 0x80 >> (i & 7);
    }
    if (padToBytes !== undefined) {
      const padBytes = [0xec, 0x11];
      for (let i = byteLength; i < padToBytes; i++) {
        out[i] = padBytes[(i - byteLength) % 2];
      }
    }
    return out;
  }
}
