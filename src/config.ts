// SPDX-License-Identifier: GPL-3.0-or-later

import type { PluginOptions, ResolvedOptions } from "./types.js"

export const DEFAULT_OPTIONS: Readonly<ResolvedOptions> = Object.freeze({
  enabled: true,
  rtkPath: "rtk",
  timeoutMs: 500,
  probeTtlMs: 60_000,
  useShellHook: false,
  debug: false,
  maxCommandLength: 8_000,
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback
}

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value > 0
    ? value
    : fallback
}

function readNonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
    ? value
    : fallback
}

export function resolveOptions(options?: unknown): ResolvedOptions {
  const input: PluginOptions = isRecord(options) ? options : {}

  return {
    enabled: readBoolean(input.enabled, DEFAULT_OPTIONS.enabled),
    rtkPath: readString(input.rtkPath, DEFAULT_OPTIONS.rtkPath),
    timeoutMs: readPositiveInteger(input.timeoutMs, DEFAULT_OPTIONS.timeoutMs),
    probeTtlMs: readNonNegativeInteger(input.probeTtlMs, DEFAULT_OPTIONS.probeTtlMs),
    useShellHook: readBoolean(input.useShellHook, DEFAULT_OPTIONS.useShellHook),
    debug: readBoolean(input.debug, DEFAULT_OPTIONS.debug),
    maxCommandLength: readPositiveInteger(input.maxCommandLength, DEFAULT_OPTIONS.maxCommandLength),
  }
}
