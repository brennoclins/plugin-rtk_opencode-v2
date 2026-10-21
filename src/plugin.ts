// SPDX-License-Identifier: GPL-3.0-or-later

import type { Plugin } from "@opencode/plugin"
import { resolveOptions } from "./config.js"
import { createEngine } from "./rewrite.js"
import { createRtkClient } from "./rtk.js"
import type { Engine, ResolvedOptions } from "./types.js"

const SHELL_TOOLS = new Set(["bash", "shell"])

type PluginContext = Parameters<Parameters<typeof Plugin.define>[0]["setup"]>[0]

export interface SetupDependencies {
  createEngine?: (options: ResolvedOptions) => Engine
}

function defaultCreateEngine(options: ResolvedOptions): Engine {
  return createEngine(options, createRtkClient(options))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function createSetup(dependencies: SetupDependencies = {}) {
  const makeEngine = dependencies.createEngine ?? defaultCreateEngine

  return async function setup(ctx: PluginContext): Promise<() => void | Promise<void>> {
    const options = resolveOptions(ctx.options)
    if (!options.enabled) return () => undefined

    const engine = makeEngine(options)
    const registrations: { dispose: () => Promise<void> }[] = []

    async function safeRewrite(command: string): Promise<string | null> {
      try {
        return await engine.rewrite(command)
      } catch (error) {
        if (options.debug) {
          const name = error instanceof Error ? error.name : "error"
          process.stderr.write(`[plugin-rtk_opencode-v2] rewrite skipped: ${name}\n`)
        }
        return null
      }
    }

    registrations.push(
      await ctx.tool.hook("execute.before", async (event) => {
        if (!SHELL_TOOLS.has(event.tool)) return
        if (!isRecord(event.input)) return

        const command = event.input.command
        if (typeof command !== "string") return

        const next = await safeRewrite(command)
        if (next && next !== command) event.input.command = next
      }),
    )

    if (engine.useShellHook) {
      registrations.push(
        await ctx.shell.hook("create.before", async (event) => {
          const next = await safeRewrite(event.command)
          if (next && next !== event.command) event.command = next
        }),
      )
    }

    return async () => {
      await Promise.allSettled(registrations.map((registration) => registration.dispose()))
      engine.dispose()
    }
  }
}

export const setup = createSetup()
