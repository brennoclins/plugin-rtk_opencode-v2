# plugin-rtk_opencode-v2

**Português (Brasil)** | [English](README.en.md) | [Italiano](README.it.md) | [简体中文](README.zh.md)

Plugin para [OpenCode V2](https://opencode.ai) que reescreve comandos de shell
para equivalentes do [RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk)
antes da execução, reduzindo o número de tokens que o agente lê.

```text
git status          ->  rtk git status
ls -la | head -5    ->  rtk ls -la | head -5
cat package.json    ->  rtk read package.json
echo hi             ->  echo hi
```

A reescrita é feita em melhor esforço e de forma silenciosa: se o RTK estiver
ausente, lento ou falhar, o comando original é executado sem alterações.

## Requisitos

- OpenCode V2 `>= 2.1.1`
- Node.js `>= 20`
- [RTK](https://github.com/rtk-ai/rtk) `>= 0.27` disponível no `PATH` (ou defina
  `rtkPath`)

Instale o RTK usando um dos métodos oficiais:

```bash
brew install rtk
```

```bash
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
```

```powershell
winget install rtk-ai.rtk
```

Verifique a instalação:

```bash
rtk --version
```

## Instalação

Instale o plugin na configuração do OpenCode V2:

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

A forma abreviada em string também é aceita quando nenhuma opção é necessária:

```jsonc
{
  "plugins": ["plugin-rtk_opencode-v2"]
}
```

Reinicie o OpenCode após alterar a configuração.

## Como funciona

Por padrão, o plugin registra `ctx.tool.hook("execute.before")` e reescreve
comandos emitidos pelas tools `bash` e `shell`. Ele chama:

```text
rtk rewrite <command>
```

por meio de `execFile`, sem shell, portanto o comando é passado como um único
argumento e não pode injetar sintaxe de shell no processo do plugin.

Um comando é considerado reescrito com sucesso quando `rtk rewrite` imprime um
stdout não vazio. Atualmente o RTK sai com código `3` em caso de sucesso e `1`
quando não há equivalente, então o plugin ignora deliberadamente o código de
saída e verifica o stdout. Comandos que já invocam `rtk` (inclusive por caminho
absoluto, `command`, `env` ou `nohup`) são mantidos intactos.

A disponibilidade do RTK é verificada com `rtk --version` e armazenada em cache
por `probeTtlMs`. Cada reescrita é limitada por `timeoutMs`. `ENOENT`, timeouts e
saída vazia resultam em passthrough silencioso. Mensagens em stderr são tratadas
como diagnóstico: se houver stdout com uma reescrita, o resultado é usado mesmo
assim.

Comandos que envolvem elevação de privilégio (`sudo`, `doas`, `pkexec`, `runas`,
`gsudo`, `su`) nunca são reescritos, inclusive dentro de pipes e shells aninhados
como `bash -c 'sudo ...'`. A ideia é que o plugin opere sempre com as permissões
do usuário que executa o OpenCode.

### Hook de shell opcional

Defina `useShellHook: true` para também registrar
`ctx.shell.hook("create.before")`. Isso cobre todos os comandos de shell criados
pelo OpenCode, incluindo comandos de outras tools, plugins e subagentes. Fica
desativado por padrão porque pode reescrever comandos internos que não deveriam
mudar.

Quando os dois hooks estão habilitados, o mesmo comando pode passar duas vezes.
A segunda passagem é barata porque comandos que começam com `rtk` são ignorados,
e `rtk rewrite` é idempotente.

## Opções

| Opção              | Padrão   | Descrição                                                          |
| ------------------ | -------- | ------------------------------------------------------------------ |
| `enabled`          | `true`   | Ativa ou desativa o plugin.                                        |
| `rtkPath`          | `"rtk"`  | Nome ou caminho absoluto do binário RTK.                           |
| `timeoutMs`        | `500`    | Timeout de cada chamada `rtk rewrite`.                             |
| `probeTtlMs`       | `60000`  | Por quanto tempo a verificação do RTK fica em cache. `0` desativa. |
| `useShellHook`     | `false`  | Também reescreve via `ctx.shell.hook("create.before")`.            |
| `debug`            | `false`  | Grava diagnóstico em stderr. Comandos nunca são registrados.       |
| `maxCommandLength` | `8000`   | Comandos maiores que isso não são reescritos.                      |

Valores de opção inválidos voltam aos padrões em vez de impedir a inicialização
do plugin.

Exemplo com caminho personalizado do binário e o hook de shell habilitado:

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

## Solução de problemas

**Os comandos não são reescritos.** Confirme que `rtk rewrite "git status"`
imprime um comando reescrito no mesmo ambiente em que o OpenCode é executado.
Verifique se o comando ainda não tem o prefixo `rtk`, se não é maior que
`maxCommandLength` e se `enabled` não é `false`.

**RTK não é encontrado.** Defina `rtkPath` com um caminho absoluto. Em sistemas
onde o processo do OpenCode tem um `PATH` diferente, o binário pode não ser
encontrado pelo nome.

**Timeouts em máquinas lentas.** Aumente `timeoutMs`. Um timeout é sempre
seguro: o comando original é executado sem alterações.

**O hook de shell reescreve demais.** Mantenha `useShellHook` desativado (o
padrão) para que apenas comandos `bash`/`shell` emitidos pelo agente sejam
alterados.

**Windows.** `execFile` é multiplataforma, mas o suporte ao Windows é
best-effort e ainda não é coberto pela matriz de CI.

## Desenvolvimento

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm coverage
pnpm build
```

A suíte de testes usa um binário RTK falso em `test/fixtures/fake-rtk.mjs`; o
`rtk` real não é necessário para executar os testes.

## Compatibilidade

- OpenCode V2 `2.1.1` e posteriores (`@opencode/plugin@^2.1.1`)
- RTK `0.27` e posteriores, testado com `0.49.0`
- Node.js `20`, `22` e `24`

OpenCode V1 não é suportado. Use o plugin original
[`opencode-rtk`](https://www.npmjs.com/package/opencode-rtk) para V1.

## Créditos

- **Aris Ripandi** — autor do plugin original
  [`opencode-rtk`](https://www.npmjs.com/package/opencode-rtk), com licença MIT,
  cuja abordagem e comportamento inspiraram esta implementação V2.
- **Contribuidores do RTK** — [RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk),
  usado como binário externo e não incluído neste plugin.
- **Contribuidores do plugin-rtk_opencode-v2** — consulte [AUTHORS.md](AUTHORS.md).

Os textos de licenças de terceiros estão em
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Licença

Copyright (C) 2026 Brenno C. Lins.

Licenciado sob a GNU General Public License, versão 3 ou posterior
(`GPL-3.0-or-later`). Consulte [LICENSE](LICENSE).
