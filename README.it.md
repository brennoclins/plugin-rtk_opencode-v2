# plugin-rtk_opencode-v2

[Português (Brasil)](README.md) | [English](README.en.md) | **Italiano** | [简体中文](README.zh.md)

Plugin per [OpenCode V2](https://opencode.ai) che riscrive i comandi shell in
equivalenti [RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk) prima
dell'esecuzione, riducendo il numero di token letti dall'agente.

```text
git status          ->  rtk git status
ls -la | head -5    ->  rtk ls -la | head -5
cat package.json    ->  rtk read package.json
echo hi             ->  echo hi
```

La riscrittura è best-effort e silenziosa: se RTK manca, è lento o fallisce, il
comando originale viene eseguito invariato.

## Requisiti

- OpenCode V2 `>= 2.1.1`
- Node.js `>= 22.13`
- [RTK](https://github.com/rtk-ai/rtk) `>= 0.27` disponibile nel `PATH` (oppure
  imposta `rtkPath`)

Installa RTK usando uno dei metodi ufficiali:

```bash
brew install rtk
```

```bash
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
```

```powershell
winget install rtk-ai.rtk
```

Verifica l'installazione:

```bash
rtk --version
```

## Installazione

Installa il plugin nella configurazione di OpenCode V2:

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

La forma abbreviata con stringa è accettata anche quando non servono opzioni:

```jsonc
{
  "plugins": ["plugin-rtk_opencode-v2"]
}
```

Riavvia OpenCode dopo aver modificato la configurazione.

## Come funziona

Per impostazione predefinita il plugin registra
`ctx.tool.hook("execute.before")` e riscrive i comandi emessi tramite i tool
`bash` e `shell`. Chiama:

```text
rtk rewrite <command>
```

tramite `execFile`, senza shell, quindi il comando viene passato come un singolo
argomento e non può iniettare sintassi shell nel processo del plugin.

Un comando è considerato riscritto con successo quando `rtk rewrite` stampa uno
stdout non vuoto. Attualmente RTK esce con codice `3` in caso di successo e `1`
quando non esiste un equivalente, quindi il plugin ignora deliberatamente il
codice di uscita e controlla lo stdout. I comandi che invocano già `rtk`
(inclusi percorso assoluto, `command`, `env` o `nohup`) vengono lasciati
invariati.

La disponibilità di RTK viene verificata con `rtk --version` e memorizzata nella
cache per `probeTtlMs`. Ogni riscrittura è limitata da `timeoutMs`. `ENOENT`,
timeout e output vuoto producono un passthrough silenzioso. Lo stderr è trattato
come diagnostica: se lo stdout contiene una riscrittura, viene comunque usata.

I comandi che comportano escalation di privilegi (`sudo`, `doas`, `pkexec`,
`runas`, `gsudo`, `su`) non vengono mai riscritti, anche dentro pipe e shell
annidate come `bash -c 'sudo ...'`. Il plugin deve operare con i permessi
dell'utente che esegue OpenCode.

### Hook shell opzionale

Imposta `useShellHook: true` per registrare anche
`ctx.shell.hook("create.before")`. Questo copre ogni comando shell creato da
OpenCode, inclusi comandi di altri tool, plugin e subagenti. È disattivato per
impostazione predefinita perché potrebbe riscrivere comandi interni che non
dovrebbero cambiare.

Quando entrambi gli hook sono abilitati, lo stesso comando può passare due volte.
Il secondo passaggio è economico perché i comandi che iniziano con `rtk` vengono
saltati e `rtk rewrite` è idempotente.

## Opzioni

| Opzione            | Predefinito | Descrizione                                                             |
| ------------------ | ----------- | ----------------------------------------------------------------------- |
| `enabled`          | `true`      | Abilita o disabilita il plugin.                                         |
| `rtkPath`          | `"rtk"`     | Nome o percorso assoluto del binario RTK.                               |
| `timeoutMs`        | `500`       | Timeout per ogni chiamata `rtk rewrite`.                                |
| `probeTtlMs`       | `60000`     | Per quanto tempo viene memorizzata la verifica di RTK. `0` la disabilita. |
| `useShellHook`     | `false`     | Riscrive anche tramite `ctx.shell.hook("create.before")`.               |
| `debug`            | `false`     | Scrive messaggi diagnostici su stderr. I comandi non vengono mai registrati. |
| `maxCommandLength` | `8000`      | I comandi più lunghi di questo valore non vengono riscritti.            |

Valori non validi delle opzioni tornano ai valori predefiniti invece di impedire
l'avvio del plugin.

Esempio con un percorso personalizzato del binario e l'hook shell abilitato:

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

## Risoluzione dei problemi

**I comandi non vengono riscritti.** Verifica che `rtk rewrite "git status"`
stampi un comando riscritto nello stesso ambiente in cui viene eseguito
OpenCode. Controlla che il comando non abbia già il prefisso `rtk`, non sia più
lungo di `maxCommandLength` e che `enabled` non sia `false`.

**RTK non viene trovato.** Imposta `rtkPath` su un percorso assoluto. Sui sistemi
in cui il processo OpenCode ha un `PATH` diverso, il binario potrebbe non essere
individuabile per nome.

**Timeout su macchine lente.** Aumenta `timeoutMs`. Un timeout è sempre sicuro:
il comando originale viene eseguito invariato.

**L'hook shell riscrive troppo.** Mantieni `useShellHook` disattivato
(l'impostazione predefinita) in modo che vengano modificati solo i comandi
`bash`/`shell` emessi dall'agente.

**Windows.** `execFile` è multipiattaforma, ma il supporto Windows è best-effort
e non è ancora coperto dalla matrice CI.

## Sviluppo

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm coverage
pnpm build
```

La suite di test usa un binario RTK finto in `test/fixtures/fake-rtk.mjs`; il
`rtk` reale non è necessario per eseguire i test.

## Compatibilità

- OpenCode V2 `2.1.1` e successivi (`@opencode/plugin@^2.1.1`)
- RTK `0.27` e successivi, testato con `0.49.0`
- Node.js `22` e `24`

OpenCode V1 non è supportato. Usa il plugin originale
[`opencode-rtk`](https://www.npmjs.com/package/opencode-rtk) per V1.

## Crediti

- **Aris Ripandi** — autore del plugin originale
  [`opencode-rtk`](https://www.npmjs.com/package/opencode-rtk) con licenza MIT,
  il cui approccio e comportamento hanno ispirato questa implementazione V2.
- **Contributori di RTK** — [RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk),
  usato come binario esterno e non incluso in questo plugin.
- **Contributori di plugin-rtk_opencode-v2** — vedi [AUTHORS.md](AUTHORS.md).

I testi delle licenze di terze parti sono in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Licenza

Copyright (C) 2026 Brenno C. Lins.

Concesso in licenza sotto la GNU General Public License, versione 3 o successiva
(`GPL-3.0-or-later`). Vedi [LICENSE](LICENSE).
