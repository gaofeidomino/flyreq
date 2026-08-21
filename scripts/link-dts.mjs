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

await link(/^index-[^./]+\.d\.ts$/, 'index.d.ts')
await link(/^index-[^./]+\.d\.cts$/, 'index.d.cts')

// optional cli entry
if (files.some((f) => /^cli-[^./]+\.d\.ts$/.test(f))) {
  await link(/^cli-[^./]+\.d\.ts$/, 'cli.d.ts')
  await link(/^cli-[^./]+\.d\.cts$/, 'cli.d.cts')
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
if (pkg.bin?.flyreq) {
  pkg.bin.flyreq = './dist/cli.js'
  pkg.exports['./cli'] = {
    types: './dist/cli.d.ts',
    import: './dist/cli.js',
    require: './dist/cli.cjs',
  }
}
pkg.exports['./package.json'] = './package.json'
await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
console.log(`[link-dts] patched ${pkgPath}`)
