#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const VALID_STEPS = new Set(["all", "unread", "grades", "attendance"])

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}

async function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env")
  let raw

  try {
    raw = await readFile(envPath, "utf8")
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return
    }
    throw error
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed
    const separatorIndex = withoutExport.indexOf("=")
    if (separatorIndex === -1) continue

    const key = withoutExport.slice(0, separatorIndex).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue

    const rawValue = withoutExport.slice(separatorIndex + 1).trim()
    if (process.env[key] === undefined) {
      process.env[key] = stripWrappingQuotes(rawValue)
    }
  }
}

function parseArgs(argv) {
  const options = {
    step: "all",
    baseUrl: process.env.WILMA_SCRAPE_BASE_URL || "http://localhost:3000",
    out: "",
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if ((arg === "--step" || arg === "-s") && i + 1 < argv.length) {
      options.step = argv[i + 1]
      i += 1
      continue
    }

    if ((arg === "--base-url" || arg === "-b") && i + 1 < argv.length) {
      options.baseUrl = argv[i + 1]
      i += 1
      continue
    }

    if ((arg === "--out" || arg === "-o") && i + 1 < argv.length) {
      options.out = argv[i + 1]
      i += 1
      continue
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function printHelp() {
  console.log(`Usage: npm run scrape:test -- [options]\n\nOptions:\n  -s, --step <mode>      one of: all, unread, grades, attendance (default: all)\n  -b, --base-url <url>   Next.js server URL (default: http://localhost:3000)\n  -o, --out <path>       optional file path to save response JSON\n  -h, --help             show this help\n\nEnvironment variables:\n  WILMA_USERNAME         Wilma username (required, loaded from .env if present)\n  WILMA_PASSWORD         Wilma password (required, loaded from .env if present)\n  WILMA_SCRAPE_BASE_URL  optional default for --base-url\n`)
}

async function saveOutput(filePath, data) {
  const absolutePath = path.resolve(process.cwd(), filePath)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, `${JSON.stringify(data, null, 2)}\n`, "utf8")
  return absolutePath
}

function formatPayloadForOutput(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload
  }

  const maybePayload = payload
  if (!Array.isArray(maybePayload.subjects) || !Array.isArray(maybePayload.grades)) {
    return payload
  }

  const maxLength = Math.max(maybePayload.subjects.length, maybePayload.grades.length)
  const subjectGrades = []

  for (let index = 0; index < maxLength; index += 1) {
    const subject = maybePayload.subjects[index] ?? `(unknown subject #${index + 1})`
    const grades = Array.isArray(maybePayload.grades[index]) ? maybePayload.grades[index] : []
    subjectGrades.push({ subject, grades })
  }

  const { subjects, grades, ...rest } = maybePayload
  return {
    ...rest,
    subjectGrades,
  }
}

async function main() {
  await loadDotEnv()
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  if (!VALID_STEPS.has(options.step)) {
    throw new Error(`Invalid --step value: ${options.step}`)
  }

  const wilmaUsername = process.env.WILMA_USERNAME
  const wilmaPassword = process.env.WILMA_PASSWORD

  if (!wilmaUsername || !wilmaPassword) {
    throw new Error("Missing WILMA_USERNAME or WILMA_PASSWORD (set shell env or add them to .env)")
  }

  const endpoint = new URL("/api/connect-wilma", options.baseUrl)
  let response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        wilmaUsername,
        wilmaPassword,
        step: options.step,
      }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Failed to reach ${endpoint.toString()} (${message}). Start the Next.js server with \`npm run dev\` or pass --base-url.`
    )
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    console.error("Scrape request failed")
    console.error(JSON.stringify(payload, null, 2))
    process.exitCode = 1
    return
  }

  const formattedPayload = formatPayloadForOutput(payload)
  console.log(JSON.stringify(formattedPayload, null, 2))

  if (options.out) {
    const savedPath = await saveOutput(options.out, formattedPayload)
    console.error(`Saved output to ${savedPath}`)
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
