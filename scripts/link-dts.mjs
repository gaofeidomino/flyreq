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
const subpathEntries = ['axios', 'node', 'cli'].filter(hasEntry)
for (const name of subpathEntries) {
  await linkEntry(name)
}

/**
 * Types must be nested per condition. A single top-level `types` pointing at
 * the ESM .d.ts makes `require("pkg")` resolve ESM declarations against a CJS
 * implementation — what are-the-types-wrong flags as "masquerading as ESM".
 */
function conditionalExport(name) {
  return {
    import: { types: `./dist/${name}.d.ts`, default: `./dist/${name}.js` },
    require: { types: `./dist/${name}.d.cts`, default: `./dist/${name}.cjs` },
  }
}

const pkgPath = join(cwd, 'package.json')
const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
pkg.types = './dist/index.d.ts'
pkg.module = './dist/index.js'
pkg.main = './dist/index.cjs'
pkg.exports = pkg.exports ?? {}
pkg.exports['.'] = conditionalExport('index')
for (const name of subpathEntries) {
  pkg.exports[`./${name}`] = conditionalExport(name)
}

/**
 * TypeScript's legacy `moduleResolution: "node"` ignores `exports`, so it
 * cannot find declarations for a subpath like `flyreq/axios`. Bundlers still
 * resolve the runtime fine, so mapping the types is enough to unbreak those
 * projects. Derived from the same entry list to stay in step with `exports`.
 */
if (subpathEntries.length > 0) {
  pkg.typesVersions = {
    '*': Object.fromEntries(
      subpathEntries.map((name) => [name, [`./dist/${name}.d.ts`]]),
    ),
  }
}
if (pkg.bin?.flyreq) {
  pkg.bin.flyreq = './dist/cli.js'
}
pkg.exports['./package.json'] = './package.json'
await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
console.log(`[link-dts] patched ${pkgPath}`)
