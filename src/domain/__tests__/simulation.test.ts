import { describe, expect, it } from 'vitest'
import {
  BASE_SPEED_MPS_MAX,
  BASE_SPEED_MPS_MIN,
  CONDITION_MAX,
  CONDITION_MIN,
} from '../constants'
import { computeSpeed } from '../simulation'

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
