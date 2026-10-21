# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting a vulnerability

Do not open a public issue for security problems. Use the repository's private
security advisory feature:

<https://github.com/brennoclins/plugin-rtk_opencode-v2/security/advisories/new>

If that is not possible, contact the maintainer at <dev@bcl-st.com.br> with:

- A description of the issue and its impact
- Steps to reproduce
- Affected versions and platforms
- Any suggested fix or mitigation

You should receive an acknowledgement within a few business days. Please allow
time for a fix and coordinated disclosure before publishing details.

## Security model

`plugin-rtk_opencode-v2` invokes the RTK binary with `execFile`, without a shell, using
the command as a single argument. It does not evaluate shell syntax itself.

The plugin never logs commands by default, because commands may contain secrets.
Debug mode logs only error categories and never command contents.

When RTK is missing, times out, or fails, the plugin falls back silently to the
original command. A failure must never block or alter command execution.

If you discover a case where a command is logged, shell-interpreted, or
executed differently than the agent requested, treat it as a security issue.
