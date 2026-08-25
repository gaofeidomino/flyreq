#!/usr/bin/env node
/**
 * Keep publish metadata identical across every package. Run after adding a
 * package; it is idempotent, so re-running it is the way to verify drift.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packagesDir = join(repoRoot, 'packages')

const REPO_URL = 'https://github.com/gaofeidomino/flyreq'

/**
 * Floor is set by the CLI's use of global `fetch`, unflagged since Node 18.
 * Nothing else here reaches past ES2020 plus node:fs / node:path.
 */
const NODE_RANGE = '>=18'

/** The umbrella's bin shim imports for side effects, so it cannot be pruned. */
const SIDE_EFFECTS = {
  flyreq: ['./dist/cli.js', './dist/cli.cjs'],
}

/** Field order npm and humans expect; unlisted keys keep their position. */
const ORDER = [
  'name',
  'version',
  'description',
  'keywords',
  'homepage',
  'bugs',
  'repository',
  'license',
  'author',
  'type',
  'sideEffects',
  'bin',
  'main',
  'module',
  'types',
  'typesVersions',
  'exports',
  'files',
  'engines',
  'scripts',
  'dependencies',
  'peerDependencies',
  'peerDependenciesMeta',
  'devDependencies',
  'publishConfig',
]

function reorder(pkg) {
  const out = {}
  for (const key of ORDER) if (key in pkg) out[key] = pkg[key]
  for (const key of Object.keys(pkg)) if (!(key in out)) out[key] = pkg[key]
  return out
}

const dirs = (await readdir(packagesDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

for (const dir of dirs) {
  const pkgPath = join(packagesDir, dir, 'package.json')
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))

  pkg.homepage = `${REPO_URL}#readme`
  pkg.bugs = { url: `${REPO_URL}/issues` }
  pkg.repository = {
    type: 'git',
    url: `git+${REPO_URL}.git`,
    directory: `packages/${dir}`,
  }
  pkg.sideEffects = SIDE_EFFECTS[dir] ?? false
  pkg.engines = { ...pkg.engines, node: NODE_RANGE }
  pkg.scripts = { ...pkg.scripts, prepublishOnly: 'pnpm build' }

  await writeFile(pkgPath, `${JSON.stringify(reorder(pkg), null, 2)}\n`)
  console.log(`[sync-manifests] ${pkg.name}`)
}
