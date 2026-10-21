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

## Release integrity

Published versions are built and published automatically by the `release.yml`
GitHub Actions workflow on every push to `main`, which bumps the version, tags
the commit, and publishes to npm. The `0.1.0` release includes npm provenance
(`slsa.dev/provenance/v1`) and is listed at
<https://github.com/brennoclins/plugin-rtk_opencode-v2/releases/tag/v0.1.0>.

Until the migration to npm Trusted Publishing (OIDC) planned for 2026-11-01, the
workflow authenticates with the `NPM_TOKEN` repository secret: a granular npm
token with publish access and bypass 2FA. The token used for the first release
has broad package scope; revoking it is part of the OIDC migration. It is stored
only in GitHub Actions secrets and is never part of the package. It must not be
committed, printed, or included in reports. After the migration, releases will
use short-lived OIDC credentials and the token will be revoked.
