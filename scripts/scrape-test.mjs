#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const VALID_STEPS = new Set(["all", "unread", "grades", "attendance"])

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
  console.log(`Usage: npm run scrape:test -- [options]\n\nOptions:\n  -s, --step <mode>      one of: all, unread, grades, attendance (default: all)\n  -b, --base-url <url>   Next.js server URL (default: http://localhost:3000)\n  -o, --out <path>       optional file path to save response JSON\n  -h, --help             show this help\n\nEnvironment variables:\n  WILMA_USERNAME         Wilma username (required)\n  WILMA_PASSWORD         Wilma password (required)\n  WILMA_SCRAPE_BASE_URL  optional default for --base-url\n`)
}

async function saveOutput(filePath, data) {
  const absolutePath = path.resolve(process.cwd(), filePath)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, `${JSON.stringify(data, null, 2)}\n`, "utf8")
  return absolutePath
}

async function main() {
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
    throw new Error("Missing WILMA_USERNAME or WILMA_PASSWORD environment variables")
  }

  const endpoint = new URL("/api/connect-wilma", options.baseUrl)
  const response = await fetch(endpoint, {
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

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    console.error("Scrape request failed")
    console.error(JSON.stringify(payload, null, 2))
    process.exitCode = 1
    return
  }

  console.log(JSON.stringify(payload, null, 2))

  if (options.out) {
    const savedPath = await saveOutput(options.out, payload)
    console.error(`Saved output to ${savedPath}`)
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
