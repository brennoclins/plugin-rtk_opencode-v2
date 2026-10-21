// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest"
import { DEFAULT_OPTIONS, resolveOptions } from "../src/config.js"

describe("resolveOptions", () => {
  it("returns defaults when no options are provided", () => {
    expect(resolveOptions()).toEqual(DEFAULT_OPTIONS)
    expect(resolveOptions(undefined)).toEqual(DEFAULT_OPTIONS)
    expect(resolveOptions(null)).toEqual(DEFAULT_OPTIONS)
    expect(resolveOptions("nope")).toEqual(DEFAULT_OPTIONS)
    expect(resolveOptions([1, 2])).toEqual(DEFAULT_OPTIONS)
  })

  it("accepts valid custom options", () => {
    expect(
      resolveOptions({
        enabled: false,
        rtkPath: "  /opt/bin/rtk  ",
        timeoutMs: 1_500,
        probeTtlMs: 0,
        useShellHook: true,
        debug: true,
        maxCommandLength: 42,
      }),
    ).toEqual({
      enabled: false,
      rtkPath: "/opt/bin/rtk",
      timeoutMs: 1_500,
      probeTtlMs: 0,
      useShellHook: true,
      debug: true,
      maxCommandLength: 42,
    })
  })

  it("falls back for values with the wrong type", () => {
    expect(
      resolveOptions({
        enabled: "false",
        rtkPath: 123,
        timeoutMs: "500",
        probeTtlMs: null,
        useShellHook: 1,
        debug: "yes",
        maxCommandLength: {},
      }),
    ).toEqual(DEFAULT_OPTIONS)
  })

  it("rejects empty paths and non-positive numbers", () => {
    expect(resolveOptions({ rtkPath: "   " }).rtkPath).toBe(DEFAULT_OPTIONS.rtkPath)
    expect(resolveOptions({ timeoutMs: 0 }).timeoutMs).toBe(DEFAULT_OPTIONS.timeoutMs)
    expect(resolveOptions({ timeoutMs: -1 }).timeoutMs).toBe(DEFAULT_OPTIONS.timeoutMs)
    expect(resolveOptions({ timeoutMs: 1.5 }).timeoutMs).toBe(DEFAULT_OPTIONS.timeoutMs)
    expect(resolveOptions({ timeoutMs: Number.NaN }).timeoutMs).toBe(DEFAULT_OPTIONS.timeoutMs)
    expect(resolveOptions({ timeoutMs: Number.POSITIVE_INFINITY }).timeoutMs).toBe(
      DEFAULT_OPTIONS.timeoutMs,
    )
    expect(resolveOptions({ maxCommandLength: 0 }).maxCommandLength).toBe(
      DEFAULT_OPTIONS.maxCommandLength,
    )
    expect(resolveOptions({ probeTtlMs: -1 }).probeTtlMs).toBe(DEFAULT_OPTIONS.probeTtlMs)
  })

  it("allows a zero probe TTL to disable caching", () => {
    expect(resolveOptions({ probeTtlMs: 0 }).probeTtlMs).toBe(0)
  })

  it("does not mutate the input", () => {
    const input = { enabled: false, timeoutMs: 10 }
    const snapshot = { ...input }
    resolveOptions(input)
    expect(input).toEqual(snapshot)
  })
})
