# Contributing

Thanks for helping improve `plugin-rtk_opencode-v2`.

## Development setup

Requirements: Node.js 22.13+ and pnpm 11.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm coverage
pnpm build
```

Run `pnpm lint:fix` to apply formatting and import sorting. Tests use Vitest
and a fake RTK binary; a real `rtk` installation is not required.

## Pull requests

- Keep changes focused and add tests for behavior changes.
- Update `README.md` and `CHANGELOG.md` when user-visible behavior changes.
- Keep the four READMEs in sync: `README.md` (pt-BR), `README.en.md`,
  `README.it.md`, and `README.zh.md`.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before
  opening a pull request.
- Do not log commands or secrets. The plugin must remain silent by default.

## Package and release

`pnpm pack` builds `dist/` and creates the npm tarball. The published package
contains only `dist/`, the README files, and the license/notice documents; tests,
source files, and configuration stay out of the tarball.

The first public release, `0.1.0`, is available on npm:
<https://www.npmjs.com/package/plugin-rtk_opencode-v2>. It was published by the
`release.yml` workflow with npm provenance, and the matching GitHub Release is
`v0.1.0`.

Releases are published automatically by the `release.yml` workflow on every push
to `main`. The workflow runs lint, typecheck, tests, build, and
`npm pack --dry-run`, bumps the version (`patch` by default, `minor` for `feat:`
commits, `major` for breaking changes), commits and tags the bump, publishes
with `npm publish --access public --provenance`, and creates the matching GitHub
Release. No manual version or tag step is required. If the current
`package.json` version is not on npm yet, the workflow publishes it without
bumping, so a failed publish recovers on the next push.

The current workflow authenticates with the `NPM_TOKEN` repository secret: a
granular npm token with publish access and bypass 2FA for automated publishing.
Keep the token out of logs and never commit it. The workflow keeps
`id-token: write` because provenance uses OIDC, but npm authentication still
uses the token.

Trusted Publishing (OIDC) is planned for 2026-11-01. After that migration, the
workflow will publish without `NPM_TOKEN` (only `id-token: write`), and the
token will be revoked. Until the migration is complete, keep the token-based
flow as the supported release path.

Publishing locally with `npm publish` is possible without provenance; the
provenance attestation is generated only by the GitHub Actions workflow.

To test a local build as an OpenCode plugin, run `pnpm install && pnpm build`,
then point a project configuration to the absolute package directory:

```jsonc
{
  "plugins": ["/absolute/path/to/plugin-rtk_opencode-v2"]
}
```

## Developer Certificate of Origin

This project uses the [Developer Certificate of Origin](https://developercertificate.org/).
Sign off every commit:

```bash
git commit -s -m "your message"
```

The sign-off certifies that you have the right to submit the contribution under
this project's license.

## License and credits

By contributing, you agree that your contribution is licensed under
`GPL-3.0-or-later` and that the project may preserve and extend the credits in
`AUTHORS.md`, `NOTICE`, and `THIRD_PARTY_NOTICES.md`.

Keep the `SPDX-License-Identifier: GPL-3.0-or-later` header on source files and
do not add dependencies with licenses incompatible with GPL-3.0-or-later.

## Security

Do not report vulnerabilities in public issues. See [SECURITY.md](SECURITY.md).
