# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Automatic releases: every push to `main` runs the `release.yml` workflow,
  which bumps the version, publishes to npm with provenance, and creates the
  matching GitHub Release. `feat:` commits bump minor, breaking changes bump
  major, and everything else bumps patch.

### Changed

- Documentation reviewed after the first public release: all four READMEs now
  state that `0.1.0` is available on npm, document `0.0.0-stage` as the
  first-publish placeholder, and remove the "no published version" fallback.
- `CONTRIBUTING.md` and `SECURITY.md` now describe the token-based release flow
  used for `0.1.0` and the planned migration to Trusted Publishing (OIDC) on
  2026-11-01.

## [0.1.0] - 2026-10-21

### Added

- OpenCode V2 plugin that rewrites `bash` and `shell` tool commands through
  `rtk rewrite` before execution.
- Optional `ctx.shell.hook("create.before")` integration behind `useShellHook`.
- Cached RTK availability probe with TTL and per-rewrite timeout.
- Safe passthrough for missing binaries, timeouts, and empty output.
- LRU cache for successful rewrites and skip rules for commands already using
  RTK or exceeding `maxCommandLength`.
- Configurable options with validation and defaults.
- Test suite with a fake RTK binary, including timeout, stderr, and missing
  binary scenarios.
- GPL-3.0-or-later licensing, notices, and credits.
- Multilingual README with Brazilian Portuguese as the default, plus English,
  Italian, and Simplified Chinese.
- README badges for npm, CI, and license.
- Installation guide covering the OpenCode CLI (`opencode plugin add`), global
  and project configuration files, the required `$schema`, first-load behavior,
  verification steps, update/removal commands, and local/Git alternatives.
- Explanation of why RTK reduces token usage and how to inspect savings with
  `rtk gain`.
- `prepare` script so Git-based installations build `dist/` automatically, and
  `prepublishOnly` to run lint, typecheck, and tests before publishing.
- Published `plugin-rtk_opencode-v2@0.1.0` to npm with provenance and created
  GitHub Release `v0.1.0`.

### Changed

- Stderr from `rtk rewrite` is now treated as diagnostics instead of a failure,
  so a valid rewrite on stdout is still applied.
- Commands involving privilege escalation (`sudo`, `doas`, `pkexec`, `runas`,
  `gsudo`, `su`) and commands invoking `rtk` through absolute paths or wrappers
  (`command`, `env`, `nohup`) are never rewritten.
- Concurrent identical rewrites now share a single `rtk` call.
- `@opencode/plugin` moved to `peerDependencies` and the GitHub repository
  metadata added for npm provenance.
- GitHub Actions updated to `checkout@v7`, `setup-node@v7`, and
  `pnpm/action-setup@v6`; TypeScript updated to 7 and `@types/node` aligned with
  the minimum supported Node.js 22.
- README installation examples now use complete `opencode.jsonc` snippets and
  state that options require the object form.

### Removed

- Node.js 20 support. It reached end-of-life on 2026-04-30 and pnpm 11
  requires Node.js 22.13 or newer; the supported range is now Node.js 22.13+
  (validated on Node 22 and 24).

### Fixed

- The build now removes stale `dist` artifacts before compiling, keeping test
  and source files out of the published package.
- Hook registrations are disposed when the plugin is cleaned up.
- Local `npm publish` no longer fails with "Automatic provenance generation not
  supported" because provenance is requested by the release workflow instead of
  being forced in `publishConfig`.
