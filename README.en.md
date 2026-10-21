# plugin-rtk_opencode-v2

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

## Requirements

- OpenCode V2 `>= 2.1.1`
- Node.js `>= 20`
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

Install the plugin in your OpenCode V2 configuration:

```jsonc
{
  "plugins": [
    {
      "package": "plugin-rtk_opencode-v2",
      "options": {}
    }
  ]
}
```

The string shorthand is also accepted when no options are needed:

```jsonc
{
  "plugins": ["plugin-rtk_opencode-v2"]
}
```

Restart OpenCode after changing the configuration.

## How it works

By default the plugin registers `ctx.tool.hook("execute.before")` and rewrites
commands issued through the `bash` and `shell` tools. It calls:

```text
rtk rewrite <command>
```

through `execFile`, without a shell, so the command is passed as a single
argument and cannot inject shell syntax into the plugin process.

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

Invalid option values fall back to their defaults instead of failing plugin
startup.

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

**Commands are not rewritten.** Confirm that `rtk rewrite "git status"` prints a
rewritten command in the same environment where OpenCode runs. Check that the
command is not already prefixed with `rtk`, is not longer than
`maxCommandLength`, and that `enabled` is not `false`.

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
```

The test suite uses a fake RTK binary in `test/fixtures/fake-rtk.mjs`; the real
`rtk` is not required to run the tests.

## Compatibility

- OpenCode V2 `2.1.1` and later (`@opencode/plugin@^2.1.1`)
- RTK `0.27` and later, tested against `0.49.0`
- Node.js `20`, `22`, and `24`

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
