# plugin-rtk_opencode-v2

[Português (Brasil)](README.md) | [English](README.en.md) | [Italiano](README.it.md) | **简体中文**

一个 [OpenCode V2](https://opencode.ai) 插件，在执行前将 shell 命令重写为
[RTK（Rust Token Killer）](https://github.com/rtk-ai/rtk) 的等价命令，从而减少智能体读取的
token 数量。

```text
git status          ->  rtk git status
ls -la | head -5    ->  rtk ls -la | head -5
cat package.json    ->  rtk read package.json
echo hi             ->  echo hi
```

重写采用尽力而为、静默回退的方式：如果 RTK 缺失、响应缓慢或执行失败，原始命令将保持不变。

## 环境要求

- OpenCode V2 `>= 2.1.1`
- Node.js `>= 22.13`
- [RTK](https://github.com/rtk-ai/rtk) `>= 0.27`，并位于 `PATH` 中（或设置
  `rtkPath`）

使用以下任一官方方式安装 RTK：

```bash
brew install rtk
```

```bash
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
```

```powershell
winget install rtk-ai.rtk
```

验证安装：

```bash
rtk --version
```

## 安装

在 OpenCode V2 配置中安装插件：

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

当不需要任何选项时，也可以使用字符串简写：

```jsonc
{
  "plugins": ["plugin-rtk_opencode-v2"]
}
```

修改配置后请重启 OpenCode。

## 工作原理

默认情况下，插件注册 `ctx.tool.hook("execute.before")`，并重写通过 `bash` 和 `shell`
工具发出的命令。它会调用：

```text
rtk rewrite <command>
```

通过 `execFile` 调用，不经过 shell，因此命令会作为单个参数传递，无法向插件进程注入 shell 语法。

当 `rtk rewrite` 输出非空 stdout 时，视为重写成功。RTK 目前在成功时返回退出码 `3`，没有等价命令时返回
`1`，因此插件有意忽略退出码，改为检查 stdout。已经调用 `rtk` 的命令（包括绝对路径、
`command`、`env` 或 `nohup`）会保持不变。

RTK 的可用性通过 `rtk --version` 探测，并缓存 `probeTtlMs` 时间。每次重写都受 `timeoutMs`
限制。`ENOENT`、超时和空输出都会静默回退到原始命令。stderr 仅视为诊断信息：只要 stdout
包含重写结果，仍会使用该结果。

涉及权限提升的命令（`sudo`、`doas`、`pkexec`、`runas`、`gsudo`、`su`）永远不会被重写，
包括管道和嵌套 shell 中的情况，例如 `bash -c 'sudo ...'`。插件应始终以运行 OpenCode
的普通用户权限工作。

### 可选的 shell hook

设置 `useShellHook: true` 还会注册 `ctx.shell.hook("create.before")`。这会覆盖 OpenCode
创建的所有 shell 命令，包括来自其他工具、插件和子代理的命令。默认关闭，因为它可能会重写不应更改的内部命令。

当两个 hook 都启用时，同一个命令可能会经过两次。第二次处理开销很小，因为以 `rtk` 开头的命令会被跳过，而且
`rtk rewrite` 是幂等的。

## 配置选项

| 选项               | 默认值  | 说明                                                         |
| ------------------ | ------- | ------------------------------------------------------------ |
| `enabled`          | `true`  | 启用或禁用插件。                                             |
| `rtkPath`          | `"rtk"` | RTK 二进制文件的名称或绝对路径。                             |
| `timeoutMs`        | `500`   | 每次 `rtk rewrite` 调用的超时时间。                          |
| `probeTtlMs`       | `60000` | RTK 可用性探测结果的缓存时间。`0` 表示禁用缓存。             |
| `useShellHook`     | `false` | 同时通过 `ctx.shell.hook("create.before")` 重写。            |
| `debug`            | `false` | 将诊断信息写入 stderr。绝不会记录命令内容。                  |
| `maxCommandLength` | `8000`  | 超过此长度的命令不会被重写。                                 |

无效的选项值会回退到默认值，而不会导致插件启动失败。

示例：自定义二进制路径并启用 shell hook：

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

## 故障排查

**命令没有被重写。** 确认在 OpenCode 运行的同一环境中，`rtk rewrite "git status"`
会输出重写后的命令。检查命令是否已带有 `rtk` 前缀、是否超过 `maxCommandLength`，以及 `enabled`
是否为 `false`。

**找不到 RTK。** 将 `rtkPath` 设置为绝对路径。如果 OpenCode 进程的 `PATH`
不同，可能无法按名称找到该二进制文件。

**在较慢的机器上超时。** 增大 `timeoutMs`。超时始终是安全的：原始命令会保持不变并继续执行。

**shell hook 重写过多。** 保持 `useShellHook` 关闭（默认值），这样只会更改智能体发出的
`bash`/`shell` 命令。

**Windows。** `execFile` 是跨平台的，但 Windows 支持属于尽力而为，尚未纳入 CI 矩阵。

## 开发

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm coverage
pnpm build
```

测试套件使用 `test/fixtures/fake-rtk.mjs` 中的假 RTK 二进制文件；运行测试不需要真实的 `rtk`。

## 兼容性

- OpenCode V2 `2.1.1` 及更高版本（`@opencode/plugin@^2.1.1`）
- RTK `0.27` 及更高版本，已针对 `0.49.0` 测试
- Node.js `22` 和 `24`

不支持 OpenCode V1。V1 请使用原始
[`opencode-rtk`](https://www.npmjs.com/package/opencode-rtk) 插件。

## 致谢

- **Aris Ripandi** — MIT 许可的原始
  [`opencode-rtk`](https://www.npmjs.com/package/opencode-rtk)
  插件的作者，其思路和行为启发了这个 V2 实现。
- **RTK 贡献者** — [RTK（Rust Token Killer）](https://github.com/rtk-ai/rtk)
  作为外部二进制文件使用，未与本插件捆绑。
- **plugin-rtk_opencode-v2 贡献者** — 参见 [AUTHORS.md](AUTHORS.md)。

第三方许可证文本位于 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 许可证

Copyright (C) 2026 Brenno C. Lins.

根据 GNU General Public License 第 3 版或更高版本（`GPL-3.0-or-later`）授权。参见
[LICENSE](LICENSE)。
