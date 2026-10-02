/**
 * Regenerate test/fixtures/matrices.json from Project Nayuki's reference
 * generator — the algorithm this plugin's encoder is a port of. Run with
 * `yarn fixtures` after a deliberate encoder change, and commit the result.
 *
 * The committed fixture lets `parity.test.ts` run even if the reference
 * dev-dependency is ever removed.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import nayuki from "nayuki-qr-code-generator";

const here = dirname(fileURLToPath(import.meta.url));
const { QrCode, QrSegment } = nayuki.default ?? nayuki;
const NAYUKI_ECC = { L: QrCode.Ecc.LOW, M: QrCode.Ecc.MEDIUM, Q: QrCode.Ecc.QUARTILE, H: QrCode.Ecc.HIGH };
const LEVELS = ["L", "M", "Q", "H"];

const SAMPLES = [
  "a", // version 1
  "https://example.com/path?q=1&x=2", // small
  "HELLO WORLD 123",
  "こんにちは世界 🌍", // multibyte UTF-8
  "MECARD:N:Doe,John;TEL:13035551212;;",
  "The quick brown fox jumps over the lazy dog. ".repeat(3), // multi-block
  "x".repeat(400), // mid versions
];

// Near the version-40 byte-mode ceiling for each level (capacities differ).
const NEAR_MAX = { L: 2950, M: 2330, Q: 1660, H: 1270 };

const combos = [
  ...SAMPLES.flatMap((text) => LEVELS.map((level) => ({ text, level }))),
  ...LEVELS.map((level) => ({ text: "9".repeat(NEAR_MAX[level]), level })),
];

const matrices = combos.map(({ text, level }) => {
  const bytes = Array.from(new TextEncoder().encode(text));
  const seg = QrSegment.makeBytes(bytes);
  // minVersion 1, maxVersion 40, automatic mask (-1), no ECC boosting.
  const qr = QrCode.encodeSegments([seg], NAYUKI_ECC[level], 1, 40, -1, false);
  const rows = [];
  for (let y = 0; y < qr.size; y++) {
    let line = "";
    for (let x = 0; x < qr.size; x++) line += qr.getModule(x, y) ? "1" : "0";
    rows.push(line);
  }
  return { text, ecc: level, version: qr.version, size: qr.size, mask: qr.mask, rows };
});

writeFileSync(join(here, "matrices.json"), JSON.stringify(matrices) + "\n");
console.log(`wrote ${matrices.length} fixtures to matrices.json`);
