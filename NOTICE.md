# Third-party notices

This plugin's QR encoder has zero runtime dependencies — everything in
`dist/qr.js` is original code in this repository. Two pieces of it are adapted
from, or checked against, third-party open-source work:

## Project Nayuki — QR Code generator library

`src/matrix.ts` ports the function-pattern placement, data masking, and
penalty-scoring routines (ISO/IEC 18004) from Project Nayuki's QR Code
generator library, to this project's own types and module structure. The
license text is reproduced in full at the top of `src/matrix.ts`, as MIT
requires, and reproduced here:

> QR Code generator library (TypeScript)
> Copyright (c) Project Nayuki. (MIT License)
> https://www.nayuki.io/page/qr-code-generator-library
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of
> this software and associated documentation files (the "Software"), to deal in
> the Software without restriction, including without limitation the rights to
> use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
> the Software, and to permit persons to whom the Software is furnished to do so,
> subject to the following conditions:
> - The above copyright notice and this permission notice shall be included in
>   all copies or substantial portions of the Software.
> - The Software is provided "as is", without warranty of any kind, express or
>   implied, including but not limited to the warranties of merchantability,
>   fitness for a particular purpose and noninfringement. In no event shall the
>   authors or copyright holders be liable for any claim, damages or other
>   liability, whether in an action of contract, tort or otherwise, arising from,
>   out of or in connection with the Software or the use or other dealings in
>   the Software.

The `nayuki-qr-code-generator` package is also used unmodified as a **dev-only**
test oracle (`test/parity.test.ts`, `test/fixtures/generate.mjs`) — it is never
bundled.

## @nuintun/qrcode

Used unmodified as a **dev-only** independent decode oracle
(`test/roundtrip.test.ts`) — no code from it is adapted or bundled. MIT license.
