#!/usr/bin/env node
/**
 * Guard for tag-triggered releases: every publishable package must sit at the
 * version named by the tag.
 *
 * The packages pin each other with exact versions, so a tag that disagrees
 * with the manifests would publish a set that cannot resolve itself.
 *
 *   node scripts/check-release-version.mjs v0.1.0
 *   node scripts/check-release-version.mjs        # reads GITHUB_REF
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packagesDir = join(repoRoot, 'packages')

const raw = process.argv[2] ?? process.env.GITHUB_REF?.replace(/^refs\/tags\//, '')
if (!raw) {
  console.error('[check-release-version] no tag given and GITHUB_REF is unset')
  process.exit(2)
}

const expected = raw.replace(/^v/, '')
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(expected)) {
  console.error(`[check-release-version] "${raw}" is not a version tag like v1.2.3`)
  process.exit(2)
}

const dirs = (await readdir(packagesDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

const mismatches = []
let checked = 0

for (const dir of dirs) {
  const pkg = JSON.parse(await readFile(join(packagesDir, dir, 'package.json'), 'utf8'))
  if (pkg.private) continue
  checked += 1
  if (pkg.version === expected) {
    console.log(`  ok    ${pkg.name}@${pkg.version}`)
  }
  else {
    console.log(`  FAIL  ${pkg.name}@${pkg.version} (tag says ${expected})`)
    mismatches.push(`${pkg.name}@${pkg.version}`)
  }
}

if (checked === 0) {
  console.error('[check-release-version] found no publishable packages')
  process.exit(2)
}

if (mismatches.length > 0) {
  console.error(
    `\n[check-release-version] ${mismatches.length} of ${checked} package(s) do not match tag ${raw}: `
    + mismatches.join(', '),
  )
  process.exit(1)
}

console.log(`\n[check-release-version] all ${checked} packages are at ${expected}`)
