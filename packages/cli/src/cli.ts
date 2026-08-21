#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { generateFromApiJson, type ApiJson } from './generate'

const BUILTIN_BACKENDS = ['axios', 'fetch'] as const

function printHelp(): void {
  console.log(`FeiFly flyreq CLI

Usage:
  flyreq gen <api.json> -o <outdir>
  flyreq use <backend>

Commands:
  gen     Generate bus API templates from endpoints JSON
  use     Write flyreq.config.json backend (axios | fetch | custom name)

Options:
  -o, --out <dir>   Output directory for gen (e.g. src/generated)
  -h, --help        Show help

Examples:
  flyreq gen ./api.json -o ./src/generated
  flyreq use fetch
  flyreq use axios

Convention:
  Put generated files under generated/; hand-written wrappers go in overrides/.
  Runtime setup() reads flyreq.config.json automatically (Node).
`)
}

function writeConfigBackend(backend: string, cwd = process.cwd()): string {
  const file = join(cwd, 'flyreq.config.json')
  let existing: Record<string, unknown> = {}
  if (existsSync(file)) {
    try {
      existing = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    }
    catch {
      existing = {}
    }
  }
  const next = { ...existing, backend }
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return file
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2)
  const cmd = args[0]
  if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') {
    return { cmd: 'help' as const }
  }
  if (cmd === 'use') {
    return { cmd: 'use' as const, backend: args[1] }
  }
  if (cmd === 'gen') {
    let input: string | undefined
    let outDir: string | undefined
    for (let i = 1; i < args.length; i++) {
      const a = args[i]
      if (a === '-o' || a === '--out') {
        outDir = args[++i]
      }
      else if (a === '-h' || a === '--help') {
        return { cmd: 'help' as const }
      }
      else if (!input) {
        input = a
      }
    }
    return { cmd: 'gen' as const, input, outDir }
  }
  return { cmd: 'unknown' as const, rest: args }
}

async function runGen(input: string, outDir: string): Promise<void> {
  const inputPath = resolve(input)
  const outPath = resolve(outDir)
  const raw = await readFile(inputPath, 'utf8')
  const api = JSON.parse(raw) as ApiJson
  const files = generateFromApiJson(api)

  if (Object.keys(files).length === 0) {
    console.warn('No endpoints found in JSON')
    return
  }

  for (const [name, content] of Object.entries(files)) {
    const filePath = join(outPath, name)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf8')
    console.log(`wrote ${filePath}`)
  }
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv)
  if (parsed.cmd === 'help') {
    printHelp()
    return
  }
  if (parsed.cmd === 'unknown') {
    console.error(`Unknown command. Run: flyreq --help`)
    process.exitCode = 1
    return
  }
  if (parsed.cmd === 'use') {
    if (!parsed.backend) {
      console.error('Usage: flyreq use <backend>')
      console.error(`Built-in: ${BUILTIN_BACKENDS.join(', ')}`)
      process.exitCode = 1
      return
    }
    const file = writeConfigBackend(parsed.backend)
    if (!(BUILTIN_BACKENDS as readonly string[]).includes(parsed.backend)) {
      console.log(`wrote ${file} (backend: ${parsed.backend})`)
      console.log('Note: custom backends must be registerAdapter()-ed before setup().')
    }
    else {
      console.log(`wrote ${file} (backend: ${parsed.backend})`)
    }
    return
  }
  if (!parsed.input || !parsed.outDir) {
    console.error('Usage: flyreq gen <api.json> -o <outdir>')
    process.exitCode = 1
    return
  }
  await runGen(parsed.input, parsed.outDir)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
