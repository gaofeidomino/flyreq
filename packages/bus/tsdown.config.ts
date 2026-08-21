import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  outDir: 'dist',
  sourcemap: true,
  external: ['@flyreq/core', '@flyreq/axios', '@flyreq/fetch'],
})
