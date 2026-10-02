# qr-code

Zero-dependency QR code generator (PNG + SVG) for Node, published to npm as `@brajkowski/qr-code` (library and
`qr-code` CLI). Ported from `plugins/qr-code` in `github.com/brajkowski/agent-marketplace`.

## Commands

```
yarn install
yarn typecheck
yarn test
yarn test:coverage
yarn build
yarn lint:package
yarn test:smoke
yarn check:deps
yarn fixtures        # only after a deliberate encoder change
```

## Rules

- **TDD:** write the failing test and run it first, then implement. Every `feat`/`fix` needs a test (CI enforces it).
- **Zero runtime dependencies.** Oracles (`nayuki-qr-code-generator`, `@nuintun/qrcode`) are devDependencies only.
- `matrix.ts` is adapted from Project Nayuki's MIT library: keep its license header and `NOTICE.md`.
- Dev needs Node 24 (native TS in tests); the runtime floor is Node >= 22.
- `dist/` is built, never committed.
- The CLI entry guard in `src/cli.ts` must use `realpathSync(process.argv[1])`, because npm installs bins as symlinks.
- Commits, PR titles and branches: Conventional Commits in passive voice; see `CONTRIBUTING.md`.
- Work in a git worktree; never commit to `main`. GitHub operations go through `gh`.
