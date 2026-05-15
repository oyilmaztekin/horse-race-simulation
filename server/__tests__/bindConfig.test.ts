// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { resolveBindConfig, DEFAULT_HOST, DEFAULT_PORT } from '../bindConfig'

describe('resolveBindConfig', () => {
  it('uses HOST and PORT from env when both are present and valid', () => {
    expect(resolveBindConfig({ HOST: '0.0.0.0', PORT: '8080' })).toEqual({
      host: '0.0.0.0',
      port: 8080,
    })
  })

  it('falls back to localhost defaults when env is empty', () => {
    expect(resolveBindConfig({})).toEqual({ host: DEFAULT_HOST, port: DEFAULT_PORT })
    expect(DEFAULT_HOST).toBe('127.0.0.1')
    expect(DEFAULT_PORT).toBe(3001)
  })

  it('throws when PORT is set but cannot be parsed as a positive integer', () => {
    expect(() => resolveBindConfig({ PORT: 'not-a-number' })).toThrow(/PORT/)
    expect(() => resolveBindConfig({ PORT: '0' })).toThrow(/PORT/)
    expect(() => resolveBindConfig({ PORT: '-5' })).toThrow(/PORT/)
  })
})
