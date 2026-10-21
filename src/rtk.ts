// SPDX-License-Identifier: GPL-3.0-or-later

import { execFile as nodeExecFile } from "node:child_process"
import type {
  ExecFileError,
  ExecFileFn,
  ExecFileOptions,
  ExecResult,
  ResolvedOptions,
  RtkClient,
  RtkClientDependencies,
} from "./types.js"

const MAX_BUFFER_BYTES = 1024 * 1024

const defaultExecFile: ExecFileFn = (file, args, options, callback) => {
  nodeExecFile(file, [...args], { ...options, encoding: "utf8" }, (error, stdout, stderr) => {
    callback(error as ExecFileError | null, stdout, stderr)
  })
}

function defaultWriteDebug(message: string): void {
  process.stderr.write(`[plugin-rtk_opencode-v2] ${message}\n`)
}

function isTimeout(error: ExecFileError | null): boolean {
  if (!error) return false
  return error.killed === true || error.code === "ETIMEDOUT"
}

function describeError(error: ExecFileError | null): string {
  if (!error) return "unknown error"
  if (isTimeout(error)) return "timeout"
  if (typeof error.code === "string" || typeof error.code === "number") return String(error.code)
  return error.name || "error"
}

export function createRtkClient(
  options: ResolvedOptions,
  dependencies: RtkClientDependencies = {},
): RtkClient {
  const execFile = dependencies.exec ?? defaultExecFile
  const now = dependencies.now ?? Date.now
  const writeDebug = options.debug
    ? (dependencies.writeDebug ?? defaultWriteDebug)
    : () => undefined

  let cachedAvailable: boolean | undefined
  let cacheExpiresAt = 0
  let disposed = false

  function run(args: readonly string[]): Promise<ExecResult> {
    const execOptions: ExecFileOptions = {
      timeout: options.timeoutMs,
      maxBuffer: MAX_BUFFER_BYTES,
    }

    return new Promise((resolve) => {
      let settled = false
      const finish = (error: ExecFileError | null, stdout: unknown, stderr: unknown) => {
        if (settled) return
        settled = true
        resolve({
          error,
          stdout: typeof stdout === "string" ? stdout : "",
          stderr: typeof stderr === "string" ? stderr : "",
        })
      }

      try {
        execFile(options.rtkPath, args, execOptions, finish)
      } catch (error) {
        finish(error as ExecFileError, "", "")
      }
    })
  }

  async function isAvailable(): Promise<boolean> {
    if (disposed) return false
    if (options.probeTtlMs > 0 && cachedAvailable !== undefined && now() < cacheExpiresAt) {
      return cachedAvailable
    }

    const result = await run(["--version"])
    const available = !result.error && result.stdout.trim().length > 0

    cachedAvailable = available
    cacheExpiresAt = now() + options.probeTtlMs
    writeDebug(
      available ? "rtk probe succeeded" : `rtk probe failed: ${describeError(result.error)}`,
    )

    return available
  }

  async function rewrite(command: string): Promise<string | null> {
    if (disposed) return null
    if (!(await isAvailable())) return null

    const result = await run(["rewrite", command])

    if (isTimeout(result.error)) {
      writeDebug("rtk rewrite timed out")
      return null
    }

    if (result.stderr.trim().length > 0) {
      writeDebug("rtk rewrite produced stderr diagnostics")
    }

    const output = result.stdout.trim()
    if (output.length === 0) {
      if (result.error) writeDebug(`rtk rewrite failed: ${describeError(result.error)}`)
      return null
    }

    return output
  }

  function dispose(): void {
    disposed = true
    cachedAvailable = undefined
    cacheExpiresAt = 0
  }

  return { isAvailable, rewrite, dispose }
}
