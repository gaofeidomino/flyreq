/**
 * flyreq 示例：按场景跑用法（mock 传输，不访问真实网络）
 *
 *   pnpm --filter @flyreq/example-basic start
 *   pnpm --filter @flyreq/example-basic start -- retry
 *   pnpm --filter @flyreq/example-basic start -- list
 */
import { runQuick } from './scenarios/00-quick'
import { runSetup } from './scenarios/01-setup'
import { runBusProtocol } from './scenarios/02-bus-protocol'
import { runRetry } from './scenarios/03-retry'
import { runCache } from './scenarios/04-cache'
import { runIdempotent } from './scenarios/05-idempotent'
import { runFlowControl } from './scenarios/06-serial-parallel'
import { runCustomAdapter } from './scenarios/07-custom-adapter'
import { runCustomStore } from './scenarios/08-custom-store'
import { runTemplates } from './scenarios/09-templates'
import { runHooks } from './scenarios/10-hooks'

const scenarios: Record<string, () => Promise<void>> = {
  quick: runQuick,
  setup: runSetup,
  bus: runBusProtocol,
  retry: runRetry,
  cache: runCache,
  idempotent: runIdempotent,
  flow: runFlowControl,
  adapter: runCustomAdapter,
  store: runCustomStore,
  templates: runTemplates,
  hooks: runHooks,
}

function printHelp(): void {
  console.log(`flyreq example scenarios

Usage:
  pnpm --filter @flyreq/example-basic start
  pnpm --filter @flyreq/example-basic start -- <name>
  pnpm --filter @flyreq/example-basic start -- list

Names:
${Object.keys(scenarios).map((k) => `  ${k}`).join('\n')}
`)
}

async function main(): Promise<void> {
  const name = process.argv.slice(2).find((a) => a !== '--')

  if (name === '-h' || name === '--help' || name === 'help') {
    printHelp()
    return
  }
  if (name === 'list') {
    console.log(Object.keys(scenarios).join('\n'))
    return
  }
  if (name && !scenarios[name]) {
    console.error(`Unknown scenario "${name}". Try: list`)
    printHelp()
    process.exitCode = 1
    return
  }

  const selected = name
    ? { [name]: scenarios[name] }
    : scenarios

  for (const [key, run] of Object.entries(selected)) {
    console.log(`\n${'═'.repeat(56)}`)
    console.log(`  scenario: ${key}`)
    console.log('═'.repeat(56))
    await run()
  }

  console.log('\nall scenarios finished.\n')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
