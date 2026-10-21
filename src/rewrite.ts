// SPDX-License-Identifier: GPL-3.0-or-later

import type { Engine, ResolvedOptions, RtkClient } from "./types.js"

const MAX_CACHE_ENTRIES = 256

const WRAPPER_COMMANDS = new Set(["command", "env", "exec", "nohup"])
const RTK_COMMANDS = new Set(["rtk", "rtk.exe"])
const PRIVILEGED_COMMANDS = new Set(["doas", "gsudo", "pkexec", "runas", "sudo", "su"])
const PRIVILEGED_ANYWHERE =
  /(?:^|[\s;&|()'"`])(?:doas|gsudo|pkexec|runas|sudo|su)(?=$|[\s;&|()'"`])/

function basename(token: string): string {
  const normalized = token.replaceAll("\\", "/")
  const name = normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase()
  return name.endsWith(".exe") ? name.slice(0, -".exe".length) : name
}

function executableName(command: string): string | undefined {
  for (const token of command.split(/\s+/)) {
    if (token.length === 0) continue
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) continue
    if (token.startsWith("-")) continue

    const name = basename(token)
    if (WRAPPER_COMMANDS.has(name)) continue
    return name
  }

  return undefined
}

export function shouldSkip(command: string, maxCommandLength: number): boolean {
  const trimmed = command.trim()
  if (trimmed.length === 0) return true
  if (trimmed.length > maxCommandLength) return true

  const executable = executableName(trimmed)
  if (executable === undefined) return true
  if (RTK_COMMANDS.has(executable)) return true
  if (PRIVILEGED_COMMANDS.has(executable)) return true

  return PRIVILEGED_ANYWHERE.test(trimmed)
}

export function createEngine(options: ResolvedOptions, client: RtkClient): Engine {
  const cache = new Map<string, string>()
  const inFlight = new Map<string, Promise<string | null>>()
  let disposed = false

  function readCache(command: string): string | undefined {
    const cached = cache.get(command)
    if (cached === undefined) return undefined
    cache.delete(command)
    cache.set(command, cached)
    return cached
  }

  function writeCache(command: string, rewritten: string): void {
    cache.delete(command)
    cache.set(command, rewritten)

    while (cache.size > MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next()
      if (oldest.done) break
      cache.delete(oldest.value)
    }
  }

  function rewrite(command: string): Promise<string | null> {
    if (disposed) return Promise.resolve(null)
    if (shouldSkip(command, options.maxCommandLength)) return Promise.resolve(null)

    const normalized = command.trim()
    const cached = readCache(normalized)
    if (cached !== undefined) return Promise.resolve(cached)

    const pending = inFlight.get(normalized)
    if (pending !== undefined) return pending

    const task = (async () => {
      const rewritten = await client.rewrite(normalized)
      if (disposed) return null
      if (rewritten === null) return null

      const result = rewritten.trim()
      if (result.length === 0) return null

      writeCache(normalized, result)
      return result
    })()

    inFlight.set(normalized, task)
    const settle = () => inFlight.delete(normalized)
    void task.then(settle, settle)
    return task
  }

  function dispose(): void {
    disposed = true
    cache.clear()
    inFlight.clear()
    client.dispose()
  }

  return {
    useShellHook: options.useShellHook,
    rewrite,
    dispose,
  }
}
