import { describe, expect, it } from 'vitest'
import {
  BASE_SPEED_MPS_MAX,
  BASE_SPEED_MPS_MIN,
  CONDITION_MAX,
  CONDITION_MIN,
  JITTER_MPS,
} from '../constants'
import { createRng } from '../rng'
import { computeSpeed, drawJitter } from '../simulation'

describe('computeSpeed', () => {
  it('returns BASE_SPEED_MPS_MAX exactly when condition === CONDITION_MAX and jitter === 0 (happy — closed-form anchor)', () => {
    // BUSINESS_LOGIC.md §3.4: this anchor must be exact for finish-time tests
    expect(computeSpeed(CONDITION_MAX, 0)).toBe(BASE_SPEED_MPS_MAX)
  })

  it('is strictly monotone in condition with zero jitter (edge — boundary inputs)', () => {
    expect(computeSpeed(CONDITION_MIN, 0)).toBeLessThan(computeSpeed(50, 0))
    expect(computeSpeed(50, 0)).toBeLessThan(computeSpeed(CONDITION_MAX, 0))
    // lower bound stays above MIN_SPEED's floor only by the (MIN/MAX) ratio term
    expect(computeSpeed(CONDITION_MIN, 0)).toBeGreaterThanOrEqual(BASE_SPEED_MPS_MIN)
  })

  it('adds jitter additively (negative — a stub that drops the jitter arg would fail)', () => {
    const base = computeSpeed(50, 0)
    expect(computeSpeed(50, 0.7)).toBeCloseTo(base + 0.7, 10)
    expect(computeSpeed(50, -0.5)).toBeCloseTo(base - 0.5, 10)
  })
})

describe('drawJitter', () => {
  // Constant-value RNG fixture — isolates the math from the PRNG so the test
  // pins drawJitter's mapping, not mulberry32's behaviour.
  const constantRng = (value: number) => () => value

  it('returns 0 exactly when rng() === 0.5 (happy — symmetry anchor for closed-form finish-time tests)', () => {
    expect(drawJitter(constantRng(0.5))).toBe(0)
  })

  it('maps [0, 1) onto [-JITTER_MPS, +JITTER_MPS) (edge — boundary values)', () => {
    expect(drawJitter(constantRng(0))).toBe(-JITTER_MPS)
    // 1 is outside rng()'s range (Rng returns [0, 1)), so we probe just below
    expect(drawJitter(constantRng(0.9999999))).toBeLessThan(JITTER_MPS)
    expect(drawJitter(constantRng(0.9999999))).toBeGreaterThan(JITTER_MPS - 1e-5)

    // Real rng across many seeds — every draw must stay strictly inside the band
    for (let seed = 1; seed <= 100; seed += 1) {
      const rng = createRng(seed)
      for (let draw = 0; draw < 20; draw += 1) {
        const j = drawJitter(rng)
        expect(j).toBeGreaterThanOrEqual(-JITTER_MPS)
        expect(j).toBeLessThan(JITTER_MPS)
      }
    }
  })

  it('different rng values produce different jitter (negative — stub returning 0 would fail)', () => {
    expect(drawJitter(constantRng(0.25))).not.toBe(drawJitter(constantRng(0.75)))
    // and the function actually consumes the rng — two calls on the same rng instance differ
    const rng = createRng(42)
    const first = drawJitter(rng)
    const second = drawJitter(rng)
    expect(first).not.toBe(second)
  })
})
