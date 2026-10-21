// SPDX-License-Identifier: GPL-3.0-or-later

import { chmodSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { DEFAULT_OPTIONS } from "../src/config.js"
import { createRtkClient } from "../src/rtk.js"
import type {
  ExecFileError,
  ExecFileFn,
  ExecFileOptions,
  ExecResult,
  ResolvedOptions,
} from "../src/types.js"

const FIXTURE = fileURLToPath(new URL("./fixtures/fake-rtk.mjs", import.meta.url))

interface Call {
  file: string
  args: readonly string[]
  options: ExecFileOptions
}

type Handler = (call: Call) => ExecResult

function options(overrides: Partial<ResolvedOptions> = {}): ResolvedOptions {
  return { ...DEFAULT_OPTIONS, ...overrides }
}

function result(overrides: Partial<ExecResult> = {}): ExecResult {
  return { error: null, stdout: "", stderr: "", ...overrides }
}

function failure(code: string | number, extra: Partial<ExecFileError> = {}): ExecFileError {
  return Object.assign(new Error(`failed with ${code}`), { code, ...extra })
}

function fakeExec(handler: Handler) {
  const calls: Call[] = []
  const exec: ExecFileFn = (file, args, execOptions, callback) => {
    const call = { file, args, options: execOptions }
    calls.push(call)
    const outcome = handler(call)
    callback(outcome.error, outcome.stdout, outcome.stderr)
  }
  return { exec, calls }
}

function rewriteCalls(calls: Call[]): Call[] {
  return calls.filter((call) => call.args[0] === "rewrite")
}

describe("probe", () => {
  it("caches a successful probe until the TTL expires", async () => {
    let clock = 1_000
    const { exec, calls } = fakeExec(() => result({ stdout: "rtk 0.49.0" }))
    const client = createRtkClient(options({ probeTtlMs: 500 }), { exec, now: () => clock })

    await expect(client.isAvailable()).resolves.toBe(true)
    clock = 1_499
    await expect(client.isAvailable()).resolves.toBe(true)
    expect(calls).toHaveLength(1)

    clock = 1_500
    await expect(client.isAvailable()).resolves.toBe(true)
    expect(calls).toHaveLength(2)
  })

  it("caches a failed probe and retries after the TTL", async () => {
    let clock = 0
    let version = 0
    const { exec } = fakeExec(({ args }) => {
      if (args[0] !== "--version") return result()
      version += 1
      return version === 1 ? result({ error: failure("ENOENT") }) : result({ stdout: "rtk 0.49.0" })
    })
    const client = createRtkClient(options({ probeTtlMs: 100 }), { exec, now: () => clock })

    await expect(client.isAvailable()).resolves.toBe(false)
    clock = 99
    await expect(client.isAvailable()).resolves.toBe(false)
    expect(version).toBe(1)

    clock = 100
    await expect(client.isAvailable()).resolves.toBe(true)
    expect(version).toBe(2)
  })

  it("probes every time when the TTL is zero", async () => {
    const { exec, calls } = fakeExec(() => result({ stdout: "rtk" }))
    const client = createRtkClient(options({ probeTtlMs: 0 }), { exec })

    await client.isAvailable()
    await client.isAvailable()
    expect(calls).toHaveLength(2)
  })

  it("treats missing stdout as unavailable", async () => {
    const { exec } = fakeExec(() => result({ stdout: "   " }))
    const client = createRtkClient(options(), { exec })
    await expect(client.isAvailable()).resolves.toBe(false)
  })
})

describe("rewrite", () => {
  it("returns rewritten stdout on success", async () => {
    const { exec, calls } = fakeExec(({ args }) =>
      args[0] === "--version"
        ? result({ stdout: "rtk 0.49.0" })
        : result({ stdout: "rtk git status\n" }),
    )
    const client = createRtkClient(options(), { exec })

    await expect(client.rewrite("git status")).resolves.toBe("rtk git status")
    const rewrite = rewriteCalls(calls)[0]
    expect(rewrite?.file).toBe("rtk")
    expect(rewrite?.args).toEqual(["rewrite", "git status"])
    expect(rewrite?.options).toEqual({ timeout: 500, maxBuffer: 1024 * 1024 })
  })

  it("trusts stdout even when rtk exits with code 3", async () => {
    const { exec } = fakeExec(({ args }) =>
      args[0] === "--version"
        ? result({ stdout: "rtk 0.49.0" })
        : result({ error: failure(3), stdout: "rtk git status" }),
    )
    const client = createRtkClient(options(), { exec })
    await expect(client.rewrite("git status")).resolves.toBe("rtk git status")
  })

  it("trusts stdout even for other non-zero codes", async () => {
    const { exec } = fakeExec(({ args }) =>
      args[0] === "--version"
        ? result({ stdout: "rtk" })
        : result({ error: failure(1), stdout: "rtk ls" }),
    )
    const client = createRtkClient(options(), { exec })
    await expect(client.rewrite("ls")).resolves.toBe("rtk ls")
  })

  it("returns null when stdout is empty", async () => {
    const { exec } = fakeExec(({ args }) =>
      args[0] === "--version" ? result({ stdout: "rtk" }) : result({ error: failure(1) }),
    )
    const client = createRtkClient(options(), { exec })
    await expect(client.rewrite("echo hi")).resolves.toBeNull()
  })

  it("ignores stderr diagnostics when stdout has a rewrite", async () => {
    const messages: string[] = []
    const { exec } = fakeExec(({ args }) =>
      args[0] === "--version"
        ? result({ stdout: "rtk" })
        : result({ stdout: "rtk git status", stderr: "warning" }),
    )
    const client = createRtkClient(options({ debug: true }), {
      exec,
      writeDebug: (message) => messages.push(message),
    })

    await expect(client.rewrite("git status")).resolves.toBe("rtk git status")
    expect(messages).toContain("rtk rewrite produced stderr diagnostics")
  })

  it("returns null on timeout even with partial stdout", async () => {
    const { exec } = fakeExec(({ args }) =>
      args[0] === "--version"
        ? result({ stdout: "rtk" })
        : result({ error: failure("ETIMEDOUT", { killed: true }), stdout: "rtk git status" }),
    )
    const client = createRtkClient(options(), { exec })
    await expect(client.rewrite("git status")).resolves.toBeNull()
  })

  it("returns null when the probe fails and does not run rewrite", async () => {
    const { exec, calls } = fakeExec(() => result({ error: failure("ENOENT") }))
    const client = createRtkClient(options(), { exec })
    await expect(client.rewrite("git status")).resolves.toBeNull()
    expect(rewriteCalls(calls)).toHaveLength(0)
  })

  it("handles execFile throwing synchronously", async () => {
    const exec: ExecFileFn = () => {
      throw failure("EACCES")
    }
    const client = createRtkClient(options(), { exec })
    await expect(client.isAvailable()).resolves.toBe(false)
    await expect(client.rewrite("git status")).resolves.toBeNull()
  })

  it("logs diagnostics without leaking the command", async () => {
    const messages: string[] = []
    const secret = "curl -H 'Authorization: secret-token'"
    const { exec } = fakeExec(({ args }) =>
      args[0] === "--version"
        ? result({ stdout: "rtk" })
        : result({ error: failure("ETIMEDOUT", { killed: true }) }),
    )
    const client = createRtkClient(options({ debug: true, timeoutMs: 50 }), {
      exec,
      writeDebug: (message) => messages.push(message),
    })

    await client.rewrite(secret)
    expect(messages.some((message) => message.includes("timed out"))).toBe(true)
    expect(messages.join("\n")).not.toContain("secret-token")
  })

  it("stops working after dispose", async () => {
    let probeCount = 0
    const { exec } = fakeExec(({ args }) => {
      if (args[0] === "--version") {
        probeCount += 1
        return result({ stdout: "rtk" })
      }
      return result({ stdout: "rtk git status" })
    })
    const client = createRtkClient(options(), { exec })

    await expect(client.isAvailable()).resolves.toBe(true)
    client.dispose()
    await expect(client.isAvailable()).resolves.toBe(false)
    await expect(client.rewrite("git status")).resolves.toBeNull()
    expect(probeCount).toBe(1)
  })
})

describe("integration with a fake rtk binary", () => {
  afterEach(() => {
    delete process.env.FAKE_RTK_MODE
  })

  function fixtureClient(overrides: Partial<ResolvedOptions> = {}) {
    chmodSync(FIXTURE, 0o755)
    return createRtkClient(options({ rtkPath: FIXTURE, timeoutMs: 2_000, ...overrides }))
  }

  it("executes the fixture through child_process", async () => {
    const client = fixtureClient()
    await expect(client.isAvailable()).resolves.toBe(true)
    await expect(client.rewrite("git status")).resolves.toBe("rtk git status")
    await expect(client.rewrite("ls | head")).resolves.toBe("rtk ls | head")
    await expect(client.rewrite("git status && cargo test")).resolves.toBe(
      "rtk git status && rtk cargo test",
    )
    await expect(client.rewrite("echo hi")).resolves.toBeNull()
  })

  it("ignores stderr when the binary still writes a rewrite", async () => {
    process.env.FAKE_RTK_MODE = "stderr"
    const client = fixtureClient()
    await expect(client.rewrite("git status")).resolves.toBe("rtk git status")
  })

  it("passes through when the binary returns empty stdout", async () => {
    process.env.FAKE_RTK_MODE = "empty"
    const client = fixtureClient()
    await expect(client.rewrite("git status")).resolves.toBeNull()
  })

  it("passes through when the binary exceeds the timeout", async () => {
    process.env.FAKE_RTK_MODE = "slow"
    const client = fixtureClient({ timeoutMs: 100 })
    await expect(client.rewrite("git status")).resolves.toBeNull()
  })

  it("passes through when the binary does not exist", async () => {
    const client = createRtkClient(
      options({ rtkPath: fileURLToPath(new URL("./fixtures/missing-rtk", import.meta.url)) }),
    )
    await expect(client.rewrite("git status")).resolves.toBeNull()
  })
})
