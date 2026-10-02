# qr-code

Zero-dependency QR code generator (PNG + SVG) for Node, published as a TypeScript package to NPM (private for now).

## Status

Bootstrap only. The code is being ported from `plugins/qr-code` in `github.com/brajkowski/agent-marketplace`
(local: `~/projects/ai/agent-marketplace/plugins/qr-code`). No source, build, or test tooling exists in this repo yet.
Do not invent commands or tooling; update this file as the port lands.

## Hard constraints

- **Zero runtime dependencies.** The encoder, PNG writer (Node's built-in `zlib`), and SVG writer are in-tree.
  Test oracles (`nayuki-qr-code-generator`, `@nuintun/qrcode`) are devDependencies only and are never bundled.
- Port-origin licensing: `matrix.ts` is adapted from Project Nayuki's MIT-licensed library. Keep its license header
  and the third-party notice (`NOTICE.md`) when porting.

## Conventions

- ESM (`"type": "module"`), TypeScript `strict`, Node >= 20.
- Commits and PR titles: Conventional Commits in passive voice, e.g. `feat: reports can be exported as CSV`.
- Branches: passive voice, e.g. `feat/png-output-can-be-resized`. Work in a git worktree; never commit to `main`.
- GitHub operations go through `gh`.

## Maintaining this file

Keep it short and only list what Claude can't infer from the code. Add build/test/release commands here once they exist.
