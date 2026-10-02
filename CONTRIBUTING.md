# Contributing

## Prerequisites

- Node.js 24 for development. The tests run `.ts` files directly through Node's native type stripping. The
  published package supports Node >= 22 at runtime.
- Yarn via corepack: `corepack enable`. The exact version is pinned by `packageManager` in `package.json`.

## Setup

```bash
yarn install
```

`yarn install` also runs `husky`, which installs a `commit-msg` hook that lints commit messages with commitlint.
The `prepack`/`postpack` scripts use `pinst` to remove the `postinstall` script from the published package.
CI is the real gate either way. If the hook gives you trouble, install it manually with `yarn husky`.

## Scripts

| Command | What it does |
| --- | --- |
| `yarn typecheck` | `tsc --noEmit` over `src` and `test`. |
| `yarn test` | `node --test` over `test/**/*.test.ts`. |
| `yarn test:coverage` | Tests with Node's built-in coverage and thresholds. Must pass. |
| `yarn build` | Bundles `dist/index.js` and `dist/cli.js` with esbuild and emits `.d.ts` files. |
| `yarn lint:package` | `publint` and `attw` against the packed package. Run after `yarn build`. |
| `yarn test:smoke` | Packs the package, installs the tarball into a temp project and exercises the library and the `qr-code` bin. |
| `yarn check:deps` | Fails if runtime, peer or optional dependencies are non-empty. |
| `yarn fixtures` | Regenerates `test/fixtures/matrices.json`. |

`dist/` is never committed.

## Test-driven development (required)

Work red, green, refactor:

1. Write the test and run it. Watch it fail for the right reason.
2. Implement the change and run it again until it passes.
3. Refactor with the tests green.

Every `feat` and `fix` includes a test that fails without the change, and the PR description shows the red then
green output. CI fails a `feat`/`fix` PR that changes `src/` without touching `test/`. Coverage thresholds in
`yarn test:coverage` must not be lowered.

Where tests live:

- `test/<module>.test.ts` unit-tests the matching file in `src/`.
- `test/parity.test.ts` compares every matrix with Project Nayuki's generator via `test/fixtures/matrices.json`.
- `test/roundtrip.test.ts` decodes generated symbols with `@nuintun/qrcode`.
- `test/cli.test.ts` and `test/bin.test.ts` cover the CLI in-process and through a symlinked bin.
- `test/api.test.ts` covers the public entry point.

Run `yarn fixtures` only after a deliberate encoder change, and commit the regenerated `matrices.json`.

## Zero runtime dependencies

The package must ship with no runtime dependencies. Dev-only tooling and the test oracles are fine as
`devDependencies`. `yarn check:deps` and the smoke test enforce this.

## Commits

Conventional Commits with the subject **in passive voice**:

```
<type>: <subject in passive voice>
```

Good: `feat: svg output can be colored`, `fix: quiet zone is respected below 4 modules`.
Avoid: `added svg colors`, `fix quiet zone bug`.

| Type | Release impact |
| --- | --- |
| `feat` | minor |
| `fix`, `perf` | patch |
| `docs`, `chore`, `ci`, `build`, `test`, `refactor`, `style` | none |

Breaking changes use `!` after the type (`feat!: ...`) or a `BREAKING CHANGE:` footer, and release a major version.
commitlint checks the type and format; passive voice is a convention enforced in review.

## Branches

`<type>/<passive-voice-slug>`, for example `feat/svg-output-can-be-colored`. Work in a git worktree and never commit
to `main`.

## Pull requests

PRs are squash-merged. The PR title becomes the commit message on `main`, so it must be a valid passive-voice
Conventional Commit; CI lints it.

## Releases

Releases are fully automated by semantic-release on merge to `main`. Do not bump versions by hand or edit a
changelog: the version in `package.json` is a placeholder and GitHub Releases hold the notes.

Until the repository variable `RELEASE_ENABLED` is `true`, the release workflow only rehearses: it computes the next
version, packs and smoke tests the tarball, runs `npm publish --dry-run`, and uploads the tarball as a workflow
artifact. Nothing is published.

Publishing uses npm trusted publishing (OIDC) with GitHub repo `brajkowski/qr-code` and workflow `release.yml`.
npm may require the package to exist before a trusted publisher can be configured. If so, use a granular
`NPM_TOKEN` secret (exposed to the release job as `NPM_TOKEN`) for the first release, then switch to OIDC and delete
the token. Provenance attestations are generated automatically once the repository is public.

## Licensing of contributions

Contributions are licensed under the MIT license (inbound = outbound).
