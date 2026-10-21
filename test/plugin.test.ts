// SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest"
import { createSetup } from "../src/plugin.js"
import type { Engine, ResolvedOptions } from "../src/types.js"

type SetupContext = Parameters<ReturnType<typeof createSetup>>[0]
type HookHandler = (event: Record<string, unknown>) => unknown

function fakeEngine(rewriter: (command: string) => Promise<string | null>, useShellHook = false) {
  const rewrite = vi.fn(rewriter)
  const dispose = vi.fn()
  const engine: Engine = { useShellHook, rewrite, dispose }
  return { engine, rewrite, dispose }
}

function fakeContext(options: unknown, useShellHook = false) {
  const toolHandlers = new Map<string, HookHandler>()
  const shellHandlers = new Map<string, HookHandler>()
  const registrations: { dispose: ReturnType<typeof vi.fn> }[] = []

  const toolHook = vi.fn(async (name: string, callback: HookHandler) => {
    toolHandlers.set(name, callback)
    const registration = { dispose: vi.fn(async () => undefined) }
    registrations.push(registration)
    return registration
  })
  const shellHook = vi.fn(async (name: string, callback: HookHandler) => {
    shellHandlers.set(name, callback)
    const registration = { dispose: vi.fn(async () => undefined) }
    registrations.push(registration)
    return registration
  })

  const context = {
    options,
    tool: { hook: toolHook },
    shell: { hook: shellHook },
  } as unknown as SetupContext

  return {
    context,
    toolHandlers,
    shellHandlers,
    registrations,
    toolHook,
    shellHook,
    useShellHook,
  }
}

function toolEvent(command: unknown, tool = "bash") {
  return { tool, input: typeof command === "object" ? command : { command } }
}

describe("setup", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("registers the tool hook and rewrites bash commands", async () => {
    const { engine, rewrite } = fakeEngine(async (command) => `rtk ${command}`)
    const { context, toolHandlers } = fakeContext({})
    const setup = createSetup({ createEngine: () => engine })

    await setup(context)
    const event = toolEvent("git status") as { tool: string; input: { command: string } }
    await toolHandlers.get("execute.before")?.(event)

    expect(rewrite).toHaveBeenCalledWith("git status")
    expect(event.input.command).toBe("rtk git status")
  })

  it("rewrites shell tool commands too", async () => {
    const { engine } = fakeEngine(async (command) => `rtk ${command}`)
    const { context, toolHandlers } = fakeContext({})
    await createSetup({ createEngine: () => engine })(context)

    const event = toolEvent("ls", "shell") as { tool: string; input: { command: string } }
    await toolHandlers.get("execute.before")?.(event)
    expect(event.input.command).toBe("rtk ls")
  })

  it("ignores other tools and malformed inputs", async () => {
    const { engine, rewrite } = fakeEngine(async (command) => `rtk ${command}`)
    const { context, toolHandlers } = fakeContext({})
    await createSetup({ createEngine: () => engine })(context)
    const handler = toolHandlers.get("execute.before")

    await handler?.(toolEvent("git status", "read"))
    await handler?.(toolEvent("git status", "edit"))
    await handler?.({ tool: "bash", input: "git status" })
    await handler?.({ tool: "bash", input: null })
    await handler?.({ tool: "bash", input: ["git status"] })
    await handler?.(toolEvent(undefined))
    await handler?.(toolEvent(42))

    expect(rewrite).not.toHaveBeenCalled()
  })

  it("leaves the command unchanged when there is no rewrite", async () => {
    const { engine } = fakeEngine(async () => null)
    const { context, toolHandlers } = fakeContext({})
    await createSetup({ createEngine: () => engine })(context)

    const event = toolEvent("echo hi") as { tool: string; input: { command: string } }
    await toolHandlers.get("execute.before")?.(event)
    expect(event.input.command).toBe("echo hi")
  })

  it("leaves the command unchanged when the rewrite is identical", async () => {
    const { engine } = fakeEngine(async (command) => command)
    const { context, toolHandlers } = fakeContext({})
    await createSetup({ createEngine: () => engine })(context)

    const event = toolEvent("git status") as { tool: string; input: { command: string } }
    await toolHandlers.get("execute.before")?.(event)
    expect(event.input.command).toBe("git status")
  })

  it("swallows engine errors and logs only their name in debug mode", async () => {
    const error = new Error("boom")
    error.name = "BoomError"
    const { engine } = fakeEngine(async () => {
      throw error
    })
    const { context, toolHandlers } = fakeContext({ debug: true })
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
    await createSetup({ createEngine: () => engine })(context)

    const event = toolEvent("curl -H 'Authorization: secret'") as {
      tool: string
      input: { command: string }
    }
    await expect(toolHandlers.get("execute.before")?.(event)).resolves.toBeUndefined()

    expect(event.input.command).toBe("curl -H 'Authorization: secret'")
    expect(stderr).toHaveBeenCalledWith("[plugin-rtk_opencode-v2] rewrite skipped: BoomError\n")
    expect(stderr.mock.calls.join("")).not.toContain("secret")
  })

  it("stays silent when debug is disabled", async () => {
    const { engine } = fakeEngine(async () => {
      throw new TypeError("boom")
    })
    const { context, toolHandlers } = fakeContext({})
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
    await createSetup({ createEngine: () => engine })(context)

    await toolHandlers.get("execute.before")?.(toolEvent("git status"))
    expect(stderr).not.toHaveBeenCalled()
  })

  it("does nothing when the plugin is disabled", async () => {
    const { engine } = fakeEngine(async (command) => `rtk ${command}`)
    const { context, toolHook, shellHook } = fakeContext({ enabled: false })
    const cleanup = await createSetup({ createEngine: () => engine })(context)

    expect(toolHook).not.toHaveBeenCalled()
    expect(shellHook).not.toHaveBeenCalled()
    cleanup()
    expect(engine.dispose).not.toHaveBeenCalled()
  })

  it("does not register the shell hook by default", async () => {
    const { engine } = fakeEngine(async (command) => `rtk ${command}`)
    const { context, shellHook } = fakeContext({})
    await createSetup({ createEngine: () => engine })(context)
    expect(shellHook).not.toHaveBeenCalled()
  })

  it("registers the shell hook when enabled", async () => {
    const { engine } = fakeEngine(async (command) => `rtk ${command}`, true)
    const { context, shellHandlers, shellHook } = fakeContext({ useShellHook: true })
    await createSetup({ createEngine: () => engine })(context)

    expect(shellHook).toHaveBeenCalledWith("create.before", expect.any(Function))
    const event = { command: "git status" }
    await shellHandlers.get("create.before")?.(event)
    expect(event.command).toBe("rtk git status")
  })

  it("leaves shell commands unchanged when there is no rewrite", async () => {
    const { engine } = fakeEngine(async () => null, true)
    const { context, shellHandlers } = fakeContext({ useShellHook: true })
    await createSetup({ createEngine: () => engine })(context)

    const event = { command: "echo hi" }
    await shellHandlers.get("create.before")?.(event)
    expect(event.command).toBe("echo hi")
  })

  it("passes resolved options to the engine factory", async () => {
    const { engine } = fakeEngine(async () => null)
    const factory = vi.fn((_options: ResolvedOptions) => engine)
    const { context } = fakeContext({ maxCommandLength: 123, timeoutMs: 50 })

    await createSetup({ createEngine: factory })(context)
    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({ maxCommandLength: 123, timeoutMs: 50 }),
    )
  })

  it("disposes the engine on cleanup", async () => {
    const { engine, dispose } = fakeEngine(async (command) => `rtk ${command}`)
    const { context } = fakeContext({})
    const cleanup = await createSetup({ createEngine: () => engine })(context)

    await cleanup()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it("disposes hook registrations on cleanup", async () => {
    const { engine } = fakeEngine(async (command) => `rtk ${command}`, true)
    const { context, registrations } = fakeContext({ useShellHook: true })
    const cleanup = await createSetup({ createEngine: () => engine })(context)

    expect(registrations).toHaveLength(2)
    await cleanup()
    for (const registration of registrations) {
      expect(registration.dispose).toHaveBeenCalledTimes(1)
    }
  })
})
