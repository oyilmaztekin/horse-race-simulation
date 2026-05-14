import { afterEach, beforeEach, vi } from 'vitest'

const FAKED_GLOBALS = [
  'setTimeout',
  'clearTimeout',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'performance',
  'Date',
] as const

beforeEach(() => {
  vi.useFakeTimers({ toFake: [...FAKED_GLOBALS] })
})

afterEach(() => {
  vi.useRealTimers()
})
