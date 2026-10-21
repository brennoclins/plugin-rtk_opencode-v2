# plugin-rtk_opencode-v2

[![npm version](https://img.shields.io/npm/v/plugin-rtk_opencode-v2.svg)](https://www.npmjs.com/package/plugin-rtk_opencode-v2)
[![CI](https://github.com/brennoclins/plugin-rtk_opencode-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/brennoclins/plugin-rtk_opencode-v2/actions/workflows/ci.yml)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)](LICENSE)

[Português (Brasil)](README.md) | **English** | [Italiano](README.it.md) | [简体中文](README.zh.md)

[OpenCode V2](https://opencode.ai) plugin that rewrites shell commands to
[RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk) equivalents before they
run, reducing the number of tokens an agent reads.

```text
git status          ->  rtk git status
ls -la | head -5    ->  rtk ls -la | head -5
cat package.json    ->  rtk read package.json
echo hi             ->  echo hi
```

The rewrite is best-effort and silent: if RTK is missing, slow, or fails, the
original command runs unchanged.

## Why use it

Shell tools produce large outputs. `git status`, `grep`, `tsc`, and test suites
can dump thousands of lines into the agent context, and every line costs tokens.
RTK is a CLI proxy that filters and summarizes those outputs before the model
reads them, preserving the useful information.

The plugin does not reimplement any of that: it only swaps the command before
execution and lets RTK do the work.

```text
git status                    ->  rtk git status
rg "TODO" src                 ->  rtk rg "TODO" src
tsc --noEmit                  ->  rtk tsc --noEmit
```

Commands that invoke `npm`, `pnpm`, `yarn`, or `bun` are left untouched,
including scripts such as `pnpm lint`, because the script body is defined by the
project. See [How it works](#how-it-works).

Savings depend on the project and the command. RTK keeps a local savings
history; inspect it with:

```bash
rtk gain
```

The plugin does not collect telemetry and does not send data anywhere.

## Requirements

- OpenCode V2 `>= 2.1.1` installed and working
- Node.js `>= 22.13`
- [RTK](https://github.com/rtk-ai/rtk) `>= 0.27` available in `PATH` (or set
  `rtkPath`)

Install RTK using one of the official methods:

```bash
brew install rtk
```

```bash
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
```

```powershell
winget install rtk-ai.rtk
```

Verify the installation:

```bash
rtk --version
```

## Installation

The plugin is an npm package published on npm and loaded by OpenCode V2. The
current version is `0.1.1`:

```bash
npm view plugin-rtk_opencode-v2 version
# 0.1.1
```

You **do not** need to run `npm install` or `pnpm add`: OpenCode installs
packages declared in the configuration at startup and caches them in:

```text
~/.cache/opencode/npm/<package>@latest/<build>/node_modules/
```

> The `0.0.0-stage` version is a placeholder from the first publish; `latest`
> points to `0.1.1`, which is what OpenCode installs.

### Option 1 — CLI (recommended)

```bash
opencode plugin add plugin-rtk_opencode-v2
```

The command installs the package and adds the entry to the global
`opencode.jsonc`. Confirm with:

```bash
opencode plugin list
```

### Option 2 — edit the configuration

Configuration files accepted by OpenCode V2:

| Scope   | Path                                                    |
| ------- | ------------------------------------------------------- |
| Global  | `~/.config/opencode/opencode.jsonc` (or `.json`)        |
| Project | `./opencode.jsonc` or `./.opencode/opencode.jsonc`      |

Add `plugins` to the existing file; do not replace the rest of the
configuration. Example of a new file:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["plugin-rtk_opencode-v2"]
}
```

When you need options, use the object form:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "plugin-rtk_opencode-v2",
      "options": {
        "rtkPath": "/home/me/.local/bin/rtk",
        "timeoutMs": 750
      }
    }
  ]
}
```

> The string form (`"plugin-rtk_opencode-v2"`) does not accept options. Use the
> object form whenever you need to configure anything.

### First load

On the first run, OpenCode downloads the package; network access is required.
After that the package is cached and subsequent startups are fast.

`opencode plugin add` installs the package, but **does not activate the plugin in
sessions that are already open**. Loading happens at service/session startup. If
you just installed it, restart the service or open a new session:

```bash
opencode service restart
```

OpenCode V2 also reloads watched configuration automatically and installs
missing packages in the background, but the plugin hook only takes effect on the
next load.

### Verify that it is working

1. Confirm that the plugin is listed:

   ```bash
   opencode plugin list
   ```

2. Confirm that RTK rewrites commands in the same environment as OpenCode:

   ```bash
   rtk rewrite "git status"
   # rtk git status
   ```

3. Enable diagnostic mode in the plugin options:

   ```jsonc
   {
     "plugins": [
       {
         "package": "plugin-rtk_opencode-v2",
         "options": { "debug": true }
       }
     ]
   }
   ```

   With `debug`, messages such as `rtk probe succeeded`, `rtk rewrite timed out`,
   and `rtk rewrite produced stderr diagnostics` appear on OpenCode stderr. The
   command contents are never logged.

4. Run a command through the agent, such as `git status`, and then check whether
   the RTK history recorded the execution:

   ```bash
   rtk gain
   ```

### Update and remove

```bash
opencode plugin check
opencode plugin update plugin-rtk_opencode-v2
opencode plugin remove plugin-rtk_opencode-v2
```

`plugin check` looks for new versions; `plugin update` updates every outdated
plugin (or only the one you pass). To remove it, you can also delete the
`plugins` entry from the configuration file.

### Local or Git installation

To test a source checkout:

```bash
pnpm install
pnpm build
```

Then point the configuration to the absolute package directory:

```jsonc
{
  "plugins": ["/home/me/dev/plugin-rtk_opencode-v2"]
}
```

You can also install directly from GitHub:

```bash
opencode plugin add github:brennoclins/plugin-rtk_opencode-v2
```

The `prepare` script builds the project automatically for this kind of
installation.

For offline use, create the tarball, extract it, and point `plugins` to the
extracted directory (it contains `package.json` and `dist/`):

```bash
pnpm pack
tar -xzf plugin-rtk_opencode-v2-0.1.1.tgz
```

## How it works

By default the plugin registers `ctx.tool.hook("execute.before")` and rewrites
commands issued through the `bash` and `shell` tools. It calls:

```text
rtk rewrite <command>
```

through `execFile`, without a shell, so the command is passed as a single
argument and cannot inject shell syntax into the plugin process. The plugin also
does not execute the rewritten command: it only changes the command that
OpenCode will run.

A command is considered successfully rewritten when `rtk rewrite` prints a
non-empty stdout. RTK currently exits with code `3` on success and `1` when it
has no equivalent, so the plugin deliberately ignores the exit code and checks
stdout instead. Commands already invoking `rtk` (including through an absolute
path, `command`, `env`, or `nohup`) are left untouched.

RTK availability is probed with `rtk --version` and cached for `probeTtlMs`.
Every rewrite is bounded by `timeoutMs`. `ENOENT`, timeouts, and empty output all
result in a silent passthrough. Stderr is treated as diagnostics: when stdout
contains a rewrite, it is still used.

Commands that involve privilege escalation (`sudo`, `doas`, `pkexec`, `runas`,
`gsudo`, `su`) are never rewritten, including inside pipes and nested shells such
as `bash -c 'sudo ...'`. The plugin is meant to run with the permissions of the
user running OpenCode.

Commands that invoke `npm`, `pnpm`, `yarn`, or `bun` are also never rewritten,
including in compound commands such as `cd app && pnpm lint`. This includes
package-manager scripts: their body is defined by the project, and RTK may map,
for example, `pnpm lint` to `rtk lint`, which runs ESLint. On projects using Biome, oxlint, or another
linter, that would change the command and could break execution. To get RTK's
savings, call the tool directly (`tsc --noEmit`, `eslint src`) instead of going
through the package-manager script.

### Optional shell hook

Set `useShellHook: true` to also register `ctx.shell.hook("create.before")`.
This covers every shell command created by OpenCode, including commands from
other tools, plugins, and subagents. It is disabled by default because it may
rewrite internal commands that should not change.

When both hooks are enabled the same command may pass twice. The second pass is
cheap because commands starting with `rtk` are skipped, and `rtk rewrite` is
idempotent.

## Options

| Option             | Default  | Description                                                        |
| ------------------ | -------- | ------------------------------------------------------------------ |
| `enabled`          | `true`   | Enables or disables the plugin.                                    |
| `rtkPath`          | `"rtk"`  | RTK binary name or absolute path.                                  |
| `timeoutMs`        | `500`    | Timeout for each `rtk rewrite` call.                               |
| `probeTtlMs`       | `60000`  | How long the RTK availability probe is cached. `0` disables it.    |
| `useShellHook`     | `false`  | Also rewrite through `ctx.shell.hook("create.before")`.            |
| `debug`            | `false`  | Write diagnostic messages to stderr. Commands are never logged.    |
| `maxCommandLength` | `8000`   | Commands longer than this are not rewritten.                       |

Options can only be set in the object form shown above; the string form uses
defaults only. Invalid option values fall back to their defaults instead of
failing plugin startup.

Example with a custom binary path and the shell hook enabled:

```jsonc
{
  "plugins": [
    {
      "package": "plugin-rtk_opencode-v2",
      "options": {
        "rtkPath": "/home/me/.local/bin/rtk",
        "timeoutMs": 750,
        "useShellHook": true,
        "debug": true
      }
    }
  ]
}
```

## Troubleshooting

**The plugin does not appear in `opencode plugin list`.** Confirm that the key
is `plugins` (plural, the V2 syntax), that the file is in one of the accepted
paths, and that you restarted OpenCode. Run `opencode plugin add` again to check
the installation. To inspect the download, the cache lives at
`~/.cache/opencode/npm/plugin-rtk_opencode-v2@latest/<build>/node_modules/`.

**I installed it, but commands are unchanged.** `plugin add` does not apply the
plugin to a session that is already open. Restart the service with
`opencode service restart` or open a new session and try again. The OpenCode log
should show `loading plugin id=plugin-rtk_opencode-v2` at startup.

**404 or "package not found" during installation.** Confirm the exact package
name and published version with `npm view plugin-rtk_opencode-v2 version`
(expected: `0.1.1`) and check that the npm registry is reachable. If the problem
persists, use the local or Git installation described above.

**Commands are not rewritten.** Confirm that `rtk rewrite "git status"` prints a
rewritten command in the same environment where OpenCode runs. Check that the
command is not already prefixed with `rtk`, is not longer than
`maxCommandLength`, and that `enabled` is not `false`. Enable `debug: true` to
see the plugin diagnostics.

**`pnpm lint`, `npm run lint`, and other scripts are not rewritten.** This is
intentional. The plugin does not change package-manager script invocations
because the script body is defined by the project and RTK may assume ESLint when
the project uses another linter. Run the script normally or call the tool
directly.

**RTK is not found.** Set `rtkPath` to an absolute path. On systems where the
OpenCode process has a different `PATH`, the binary may not be discoverable by
name.

**Timeouts on slow machines.** Increase `timeoutMs`. A timeout is always safe:
the original command runs unchanged.

**The shell hook rewrites too much.** Keep `useShellHook` disabled (the default)
so only agent-issued `bash`/`shell` commands are changed.

**Windows.** `execFile` is cross-platform, but Windows support is best-effort
and not covered by the CI matrix yet.

## Development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm coverage
pnpm build
pnpm pack
```

The test suite uses a fake RTK binary in `test/fixtures/fake-rtk.mjs`; the real
`rtk` is not required to run the tests. The `prepare` script runs the build for
Git-based installations.

Releases are published automatically by the `release.yml` workflow in GitHub
Actions on every push to `main`: it bumps the version, publishes to npm with
provenance, and creates the GitHub Release. Version `0.1.1` and later are listed
at <https://github.com/brennoclins/plugin-rtk_opencode-v2/releases>. The current
flow uses a granular npm token; the migration to Trusted Publishing (OIDC) is
planned for 2026-11-01. See
[CONTRIBUTING.md](https://github.com/brennoclins/plugin-rtk_opencode-v2/blob/main/CONTRIBUTING.md).

## Compatibility

- OpenCode V2 `2.1.1` and later (`@opencode/plugin@^2.1.1`), tested with `2.1.2`
- RTK `0.27` and later, tested against `0.49.0`
- Node.js `22` and `24`

OpenCode V1 is not supported. Use the original
[`opencode-rtk`](https://www.npmjs.com/package/opencode-rtk) plugin for V1.

## Credits

- **Aris Ripandi** — author of the original MIT-licensed
  [`opencode-rtk`](https://www.npmjs.com/package/opencode-rtk) plugin, whose
  approach and behavior inspired this V2 implementation.
- **RTK contributors** — [RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk),
  used as an external binary and not bundled with this plugin.
- **plugin-rtk_opencode-v2 contributors** — see [AUTHORS.md](AUTHORS.md).

Third-party license texts are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

Copyright (C) 2026 Brenno C. Lins.

Licensed under the GNU General Public License, version 3 or later
(`GPL-3.0-or-later`). See [LICENSE](LICENSE).
