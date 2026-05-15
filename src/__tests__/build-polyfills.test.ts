// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { build } from 'vite'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BUILD_TIMEOUT_MS = 60_000
const LEGACY_CHUNK_PATTERN = /-legacy-[A-Za-z0-9_-]+\.js$/
const POLYFILLS_CHUNK_PATTERN = /polyfills-legacy-[A-Za-z0-9_-]+\.js$/
const MODERN_CHUNK_PATTERN = /^(?!.*-legacy-).*\.js$/

async function buildToTempDir(): Promise<string[]> {
  const outDir = mkdtempSync(join(tmpdir(), 'horse-build-'))
  try {
    await build({
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true, write: true },
    })
    return readdirSync(join(outDir, 'assets'))
  } finally {
    rmSync(outDir, { recursive: true, force: true })
  }
}

describe('production build polyfilling', () => {
  it(
    'emits a legacy nomodule bundle alongside the modern bundle (happy path)',
    async () => {
      const assets = await buildToTempDir()
      const jsFiles = assets.filter((name: string) => name.endsWith('.js'))

      const legacyChunks = jsFiles.filter((name: string) => LEGACY_CHUNK_PATTERN.test(name))
      const modernChunks = jsFiles.filter((name: string) => MODERN_CHUNK_PATTERN.test(name))

      expect(modernChunks.length).toBeGreaterThan(0)
      expect(legacyChunks.length).toBeGreaterThan(0)
    },
    BUILD_TIMEOUT_MS,
  )

  it(
    'emits a legacy polyfills chunk so old browsers get core-js (edge: polyfill payload present)',
    async () => {
      const assets = await buildToTempDir()
      const polyfillChunks = assets.filter((name: string) => POLYFILLS_CHUNK_PATTERN.test(name))
      expect(polyfillChunks.length).toBeGreaterThan(0)
    },
    BUILD_TIMEOUT_MS,
  )

  it(
    'modern bundle never contains the -legacy- marker (sad: would-be-wrong stub fails)',
    async () => {
      const assets = await buildToTempDir()
      const jsFiles = assets.filter((name: string) => name.endsWith('.js'))
      const modernChunks = jsFiles.filter((name: string) => MODERN_CHUNK_PATTERN.test(name))
      expect(modernChunks.every((name: string) => !name.includes('-legacy-'))).toBe(true)
      expect(modernChunks.length).toBeGreaterThan(0)
    },
    BUILD_TIMEOUT_MS,
  )
})
