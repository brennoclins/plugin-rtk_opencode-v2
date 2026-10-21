#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later

const mode = process.env.FAKE_RTK_MODE ?? "normal"
const [subcommand, ...rest] = process.argv.slice(2)
const command = rest.join(" ")

const supported = new Set(["git", "ls", "cat", "rg", "cargo", "find", "grep", "diff"])
const aliases = new Map([["cat", "read"]])

function rewriteSegment(segment) {
  const leading = segment.match(/^\s*/)?.[0] ?? ""
  const trailing = segment.match(/\s*$/)?.[0] ?? ""
  const trimmed = segment.trim()
  const [head] = trimmed.split(/\s+/, 1)
  if (!head || !supported.has(head)) return null
  const rest = trimmed.slice(head.length)
  return `${leading}rtk ${aliases.get(head) ?? head}${rest}${trailing}`
}

function rewriteChain(chain) {
  const parts = chain.split(/(&&|\|\|)/)
  const rewritten = parts.map((part, index) => {
    if (index % 2 === 1) return part
    return rewriteSegment(part)
  })
  return rewritten.some((part) => part === null) ? null : rewritten.join("")
}

function rewriteCommand(text) {
  if (text.includes("&&") || text.includes("||")) return rewriteChain(text)

  const match = text.match(/^([^|;]*)([\s\S]*)$/)
  const head = match?.[1] ?? text
  const tail = match?.[2] ?? ""
  const rewritten = rewriteSegment(head)
  return rewritten === null ? null : `${rewritten}${tail}`
}

if (subcommand === "--version") {
  process.stdout.write("rtk 0.49.0-fake\n")
  process.exit(0)
}

if (subcommand !== "rewrite") {
  process.stderr.write("fake-rtk: unsupported subcommand\n")
  process.exit(1)
}

if (mode === "slow") {
  setTimeout(() => {
    process.stdout.write("rtk git status")
    process.exit(3)
  }, 5_000)
} else if (mode === "empty") {
  process.exit(0)
} else if (mode === "stderr") {
  process.stderr.write("fake-rtk: warning\n")
  process.stdout.write("rtk git status")
  process.exit(3)
} else {
  const rewritten = rewriteCommand(command)
  if (rewritten === null) process.exit(1)
  process.stdout.write(rewritten)
  process.exit(3)
}
