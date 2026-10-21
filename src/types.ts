// SPDX-License-Identifier: GPL-3.0-or-later

export interface PluginOptions {
  enabled?: boolean
  rtkPath?: string
  timeoutMs?: number
  probeTtlMs?: number
  useShellHook?: boolean
  debug?: boolean
  maxCommandLength?: number
}

export interface ResolvedOptions {
  enabled: boolean
  rtkPath: string
  timeoutMs: number
  probeTtlMs: number
  useShellHook: boolean
  debug: boolean
  maxCommandLength: number
}

export interface ExecFileOptions {
  timeout: number
  maxBuffer: number
}

export interface ExecFileError extends Omit<NodeJS.ErrnoException, "code"> {
  code?: string | number
  killed?: boolean
}

export type ExecFileCallback = (error: ExecFileError | null, stdout: string, stderr: string) => void

export type ExecFileFn = (
  file: string,
  args: readonly string[],
  options: ExecFileOptions,
  callback: ExecFileCallback,
) => unknown

export interface ExecResult {
  error: ExecFileError | null
  stdout: string
  stderr: string
}

export interface RtkClient {
  isAvailable(): Promise<boolean>
  rewrite(command: string): Promise<string | null>
  dispose(): void
}

export interface RtkClientDependencies {
  exec?: ExecFileFn
  now?: () => number
  writeDebug?: (message: string) => void
}

export interface Engine {
  readonly useShellHook: boolean
  rewrite(command: string): Promise<string | null>
  dispose(): void
}
