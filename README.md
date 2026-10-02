# @brajkowski/qr-code

Zero-dependency QR code generator (PNG and SVG) for Node, as a library and a CLI.

[![npm version](https://img.shields.io/npm/v/@brajkowski/qr-code)](https://www.npmjs.com/package/@brajkowski/qr-code)
[![CI](https://github.com/brajkowski/qr-code/actions/workflows/ci.yml/badge.svg)](https://github.com/brajkowski/qr-code/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/npm/l/@brajkowski/qr-code)](LICENSE)

## Features

- Zero runtime dependencies: the QR encoder, the PNG writer (Node's built-in `zlib`) and the SVG writer are all in-tree.
- PNG and SVG output.
- Error-correction levels L, M, Q and H.
- Automatic version selection (1–40).
- UTF-8 byte mode.
- ESM with bundled TypeScript types.

## Requirements

Node.js 22 or newer.

## Install

```bash
npm install @brajkowski/qr-code
yarn add @brajkowski/qr-code
pnpm add @brajkowski/qr-code
```

## CLI usage

```bash
npx @brajkowski/qr-code "https://example.com"
npx @brajkowski/qr-code "wifi network password" --type svg --ecc H
npx @brajkowski/qr-code https://example.com/really/long/link --size 1024 --output ./links/promo
```

Installed locally or globally, the command is `qr-code`.

```
qr-code <url-or-text> [options]

--data <string>     Text to encode (alternative to the positional argument).
                    --url and --text are accepted as aliases.
--type <png|svg>    Output format. Repeatable. Omit to write BOTH a PNG and an SVG.
--size <px>         Output size in pixels (see "PNG vs SVG sizing" below).
--ecc <L|M|Q|H>     Error-correction level (default: M).
--output <path>     Where to write. A stem when both formats are produced;
                    a filename when one is. A path ending in "/" or naming an
                    existing directory writes the default basename inside it.
                    Defaults to ./qrcode.
--json              Print only a JSON summary of what was written.
-h, --help          Show help.
```

Every `--flag` also accepts the `--flag=value` form.

### `--json` output

```json
{
  "data": "https://example.com",
  "version": 2,
  "modules": 25,
  "ecc": "M",
  "mask": 1,
  "files": [{ "path": "/abs/path/qrcode.png", "type": "png", "width": 495, "height": 495 }]
}
```

`files` has one entry per file written. `version` is the QR version (1–40) and `modules` the symbol width in modules.

### `--stdin-args`

`--stdin-args` reads the whole argument string from stdin and tokenizes it itself (single quotes, double quotes
and backslash escapes) instead of relying on a shell. Use it to pass untrusted text safely: nothing in the text
is ever interpreted as shell syntax.

```bash
printf '%s' 'https://example.com/?a=1&b=2 --type svg' | qr-code --stdin-args
```

### Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success. |
| 1 | Runtime error, including input too large for a QR code. |
| 2 | Usage error (bad or missing arguments). |

### PNG vs SVG sizing

| Format | What `--size` means |
| --- | --- |
| PNG | A **target**. The symbol is *N × N* modules plus a quiet zone, so the size is rounded **down** to a whole number of pixels per module. The CLI reports the real dimensions. |
| SVG | The **exact** rendered width/height. The `viewBox` is in module units, so the image scales losslessly regardless. |

### Environment variables

Built-in defaults can be overridden per invocation. Precedence is **CLI flag > env var > built-in default**.
These are read by the CLI only; the library takes explicit options.

| Variable | Overrides |
| --- | --- |
| `QR_PNG_SIZE` | `DEFAULT_PNG_SIZE` |
| `QR_SVG_SIZE` | `DEFAULT_SVG_SIZE` |
| `QR_ECC` | `DEFAULT_ECC_LEVEL` |
| `QR_QUIET_ZONE` | `QUIET_ZONE_MODULES` |
| `QR_OUTPUT_BASENAME` | default output basename (`qrcode`) |

## Library usage

```ts
import { generate, renderPng, renderSvg } from "@brajkowski/qr-code";
import { writeFileSync } from "node:fs";

const qr = generate("https://example.com", "M");
const png = renderPng(qr.modules, { size: 512, quietZone: 4 });
writeFileSync("qr.png", png.data); // png.pixels is the actual width/height
writeFileSync("qr.svg", renderSvg(qr.modules, { size: 512, quietZone: 4 }));
```

### API

- `generate(text, ecc, options?)` returns a `QrSymbol`. `options.minVersion` forces a minimum QR version.
- `QrSymbol`: `{ modules: boolean[][], size, version, ecc, mask }`. `modules[y][x]` is `true` for a dark module and
  does not include the quiet zone; `size` is the module count per side.
- `renderPng(modules, { size, quietZone })` returns `{ data: Buffer, pixels, scale }`.
- `renderSvg(modules, { size, quietZone })` returns an SVG document string.
- `QrCapacityError` is thrown when the input cannot fit in a version 40 symbol at the requested ECC level.
- Exported defaults: `DEFAULT_ECC_LEVEL` (`"M"`), `QUIET_ZONE_MODULES` (`4`), `DEFAULT_PNG_SIZE` (`512`),
  `DEFAULT_SVG_SIZE` (`512`).
- Types: `EccLevel`, `QrSymbol`, `PngRenderOptions`, `RenderedRaster`, `SvgRenderOptions`.

## Encoding notes

The encoder uses **byte mode (UTF-8)** and picks the smallest QR version (1–40) that fits. Numeric and
alphanumeric compaction are not implemented yet; they would be a backwards-compatible addition.

## How correctness is verified

The encoder is a from-scratch implementation, so the tests lean on two *independent* checks:

1. **Reference parity**: every generated matrix is compared module-for-module against
   [Project Nayuki's](https://www.nayuki.io/page/qr-code-generator-library) generator, via committed fixtures.
2. **Round-trip decode**: every symbol is rasterised and decoded back to its input with
   [`@nuintun/qrcode`](https://github.com/nuintun/qrcode), a different codebase from both the encoder and the
   parity oracle.

Both oracles are dev dependencies only and are never distributed.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). `src/matrix.ts` adapts routines from Project Nayuki's QR Code generator library (MIT); see
[NOTICE.md](NOTICE.md) for the full attribution.
