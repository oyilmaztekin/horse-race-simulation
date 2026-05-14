import { describe, expect, it } from 'vitest'
import { createRng } from '../rng'

describe('createRng', () => {
  it('produces the same sequence twice from the same seed (happy)', () => {
    const a = createRng(1)
    const b = createRng(1)
    expect(a()).toBe(b())
  })

  it('returns a value in [0, 1) even when seeded with 0 (edge)', () => {
    const rng = createRng(0)
    const value = rng()
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(1)
  })

  it('produces different first values for different seeds (negative)', () => {
    const a = createRng(1)
    const b = createRng(2)
    expect(a()).not.toBe(b())
  })
})
