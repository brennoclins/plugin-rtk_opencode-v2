// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it, vi } from "vitest"
import { DEFAULT_OPTIONS } from "../src/config.js"
import { createEngine, shouldSkip } from "../src/rewrite.js"
import type { ResolvedOptions, RtkClient } from "../src/types.js"

function options(overrides: Partial<ResolvedOptions> = {}): ResolvedOptions {
  return { ...DEFAULT_OPTIONS, ...overrides }
}

function fakeClient(rewriter: (command: string) => Promise<string | null>) {
  const rewrite = vi.fn(rewriter)
  const dispose = vi.fn()
  const client: RtkClient = {
    isAvailable: vi.fn(async () => true),
    rewrite,
    dispose,
  }
  return { client, rewrite, dispose }
}

describe("shouldSkip", () => {
  it("skips empty and whitespace-only commands", () => {
    expect(shouldSkip("", 8_000)).toBe(true)
    expect(shouldSkip("   \n\t ", 8_000)).toBe(true)
  })

  it("skips commands that already invoke rtk", () => {
    expect(shouldSkip("rtk git status", 8_000)).toBe(true)
    expect(shouldSkip("rtk", 8_000)).toBe(true)
    expect(shouldSkip("\\rtk git status", 8_000)).toBe(true)
    expect(shouldSkip("command rtk git status", 8_000)).toBe(true)
    expect(shouldSkip("command \\rtk git status", 8_000)).toBe(true)
    expect(shouldSkip("  rtk ls  ", 8_000)).toBe(true)
  })

  it("skips rtk invoked through absolute paths or wrappers", () => {
    expect(shouldSkip("/usr/local/bin/rtk git status", 8_000)).toBe(true)
    expect(shouldSkip("env FOO=1 rtk git status", 8_000)).toBe(true)
    expect(shouldSkip("nohup rtk git status", 8_000)).toBe(true)
    expect(shouldSkip("command -v rtk", 8_000)).toBe(true)
  })

  it("skips commands that would run with elevated privileges", () => {
    for (const command of [
      "sudo apt install",
      "sudo -u root ls",
      "/usr/bin/sudo ls",
      "doas ls",
      "pkexec ls",
      "runas /user:Administrator cmd",
      "su -",
      "bash -c 'sudo apt update'",
      "echo ok | sudo tee /etc/config",
    ]) {
      expect(shouldSkip(command, 8_000)).toBe(true)
    }
  })

  it("does not skip commands that merely start with rtk", () => {
    expect(shouldSkip("rtkx git status", 8_000)).toBe(false)
    expect(shouldSkip("rtkfoo", 8_000)).toBe(false)
    expect(shouldSkip("command rtkit", 8_000)).toBe(false)
  })

  it("skips commands above the maximum length", () => {
    expect(shouldSkip("git status", 10)).toBe(false)
    expect(shouldSkip("git status", 9)).toBe(true)
    expect(shouldSkip(" git status ", 9)).toBe(true)
  })

  it("does not skip regular commands", () => {
    expect(shouldSkip("git status", 8_000)).toBe(false)
    expect(shouldSkip("ls | head", 8_000)).toBe(false)
    expect(shouldSkip("git status && cargo test", 8_000)).toBe(false)
  })
})

describe("createEngine", () => {
  it("rewrites through the client and caches successful results", async () => {
    const { client, rewrite } = fakeClient(async (command) => `rtk ${command}`)
    const engine = createEngine(options(), client)

    await expect(engine.rewrite("git status")).resolves.toBe("rtk git status")
    await expect(engine.rewrite("git status")).resolves.toBe("rtk git status")
    expect(rewrite).toHaveBeenCalledTimes(1)
  })

  it("normalizes surrounding whitespace before rewriting and caching", async () => {
    const { client, rewrite } = fakeClient(async (command) => `rtk ${command}`)
    const engine = createEngine(options(), client)

    await expect(engine.rewrite("  git status  ")).resolves.toBe("rtk git status")
    await expect(engine.rewrite("git status")).resolves.toBe("rtk git status")
    expect(rewrite).toHaveBeenCalledWith("git status")
    expect(rewrite).toHaveBeenCalledTimes(1)
  })

  it("returns null without calling the client for skipped commands", async () => {
    const { client, rewrite } = fakeClient(async (command) => `rtk ${command}`)
    const engine = createEngine(options({ maxCommandLength: 5 }), client)

    await expect(engine.rewrite("")).resolves.toBeNull()
    await expect(engine.rewrite("rtk git status")).resolves.toBeNull()
    await expect(engine.rewrite("git status")).resolves.toBeNull()
    expect(rewrite).not.toHaveBeenCalled()
  })

  it("passes through unsupported or empty client results", async () => {
    const { client } = fakeClient(async (command) => (command === "echo hi" ? null : "   "))
    const engine = createEngine(options(), client)

    await expect(engine.rewrite("echo hi")).resolves.toBeNull()
    await expect(engine.rewrite("ls")).resolves.toBeNull()
  })

  it("does not cache failed rewrites", async () => {
    let attempt = 0
    const { client, rewrite } = fakeClient(async () => {
      attempt += 1
      return attempt === 1 ? null : "rtk git status"
    })
    const engine = createEngine(options(), client)

    await expect(engine.rewrite("git status")).resolves.toBeNull()
    await expect(engine.rewrite("git status")).resolves.toBe("rtk git status")
    expect(rewrite).toHaveBeenCalledTimes(2)
  })

  it("shares a single rewrite between concurrent identical commands", async () => {
    let release: (value: string | null) => void = () => undefined
    const gate = new Promise<string | null>((resolve) => {
      release = resolve
    })
    const { client, rewrite } = fakeClient(() => gate)
    const engine = createEngine(options(), client)

    const first = engine.rewrite("git status")
    const second = engine.rewrite("  git status  ")
    release("rtk git status")

    await expect(Promise.all([first, second])).resolves.toEqual([
      "rtk git status",
      "rtk git status",
    ])
    expect(rewrite).toHaveBeenCalledTimes(1)
  })

  it("drops in-flight results after dispose", async () => {
    let release: (value: string | null) => void = () => undefined
    const gate = new Promise<string | null>((resolve) => {
      release = resolve
    })
    const { client } = fakeClient(() => gate)
    const engine = createEngine(options(), client)

    const pending = engine.rewrite("git status")
    engine.dispose()
    release("rtk git status")

    await expect(pending).resolves.toBeNull()
  })

  it("evicts the least recently used entry", async () => {
    const { client, rewrite } = fakeClient(async (command) => `rtk ${command}`)
    const engine = createEngine(options(), client)

    for (let index = 0; index < 256; index += 1) {
      await engine.rewrite(`cmd-${index}`)
    }
    expect(rewrite).toHaveBeenCalledTimes(256)

    await engine.rewrite("cmd-0")
    expect(rewrite).toHaveBeenCalledTimes(256)

    await engine.rewrite("cmd-256")
    expect(rewrite).toHaveBeenCalledTimes(257)

    await engine.rewrite("cmd-0")
    expect(rewrite).toHaveBeenCalledTimes(257)

    await engine.rewrite("cmd-1")
    expect(rewrite).toHaveBeenCalledTimes(258)
  })

  it("exposes the shell hook option", () => {
    const { client } = fakeClient(async () => null)
    expect(createEngine(options({ useShellHook: true }), client).useShellHook).toBe(true)
    expect(createEngine(options({ useShellHook: false }), client).useShellHook).toBe(false)
  })

  it("disposes the client and stops rewriting", async () => {
    const { client, rewrite, dispose } = fakeClient(async (command) => `rtk ${command}`)
    const engine = createEngine(options(), client)

    engine.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
    await expect(engine.rewrite("git status")).resolves.toBeNull()
    expect(rewrite).not.toHaveBeenCalled()
  })
})
