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
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before
  opening a pull request.
- Do not log commands or secrets. The plugin must remain silent by default.

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
