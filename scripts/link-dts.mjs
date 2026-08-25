#!/usr/bin/env node
/**
 * tsdown emits hashed *.d.ts names; copy to stable index.d.ts / index.d.cts
 * and ensure package.json exports include types conditions.
 */
import { copyFile, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const cwd = process.cwd()
const dist = join(cwd, 'dist')
const files = await readdir(dist)

async function link(pattern, stable) {
  const match = files.find((f) => pattern.test(f))
  if (!match) {
    console.warn(`[link-dts] no match for ${pattern} in ${dist}`)
    return
  }
  await copyFile(join(dist, match), join(dist, stable))
  console.log(`[link-dts] ${match} -> ${stable}`)
}

function hasEntry(name) {
  return files.some((f) => new RegExp(`^${name}-[^./]+\\.d\\.ts$`).test(f))
}

async function linkEntry(name) {
  await link(new RegExp(`^${name}-[^./]+\\.d\\.ts$`), `${name}.d.ts`)
  await link(new RegExp(`^${name}-[^./]+\\.d\\.cts$`), `${name}.d.cts`)
}

await linkEntry('index')

/** Optional secondary entries, each exposed as a subpath export. */
const subpathEntries = ['node', 'cli'].filter(hasEntry)
for (const name of subpathEntries) {
  await linkEntry(name)
}

const pkgPath = join(cwd, 'package.json')
const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
pkg.types = './dist/index.d.ts'
pkg.module = './dist/index.js'
pkg.main = './dist/index.cjs'
pkg.exports = pkg.exports ?? {}
pkg.exports['.'] = {
  types: './dist/index.d.ts',
  import: './dist/index.js',
  require: './dist/index.cjs',
}
for (const name of subpathEntries) {
  pkg.exports[`./${name}`] = {
    types: `./dist/${name}.d.ts`,
    import: `./dist/${name}.js`,
    require: `./dist/${name}.cjs`,
  }
}
if (pkg.bin?.flyreq) {
  pkg.bin.flyreq = './dist/cli.js'
}
pkg.exports['./package.json'] = './package.json'
await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
console.log(`[link-dts] patched ${pkgPath}`)
