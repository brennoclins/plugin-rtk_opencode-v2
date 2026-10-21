# Third-party notices

This project is licensed under `GPL-3.0-or-later`. It builds on the work and
tools listed below. Their licenses and copyright notices are reproduced or
referenced here.

## opencode-rtk

The original OpenCode V1 plugin inspired and informed this V2 implementation.

```text
MIT License

Copyright (c) 2026 Aris Ripandi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Source: <https://www.npmjs.com/package/opencode-rtk>

## RTK (Rust Token Killer)

RTK is used as an external command-line program. It is not bundled, linked into,
or redistributed with this plugin. Users install RTK independently.

- Repository: <https://github.com/rtk-ai/rtk>
- The `rtk` CLI is licensed under Apache-2.0.
- The `rtk-engine` component linked by the full `rtk` binary is licensed under
  BUSL-1.1, with an Additional Use Grant that covers production use as part of
  the `rtk` binary.
- The `rtk-oss` edition is licensed under Apache-2.0 only.
- The `rtk-proxy` daemon is licensed under BUSL-1.1 and is not used by this
  plugin.

This plugin invokes whichever `rtk` binary the user has installed and does not
incorporate RTK source code or binaries into its distribution.

Source and license details: <https://github.com/rtk-ai/rtk>

## OpenCode

This plugin targets OpenCode V2 and imports the `@opencode/plugin` package,
which is licensed under MIT. OpenCode is not bundled with this plugin.

Source: <https://github.com/anomalyco/opencode>
