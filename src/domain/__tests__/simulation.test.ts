import { describe, expect, it } from 'vitest'
import {
  BASE_SPEED_MPS_MAX,
  BASE_SPEED_MPS_MIN,
  CONDITION_MAX,
  CONDITION_MIN,
  JITTER_MPS,
} from '../constants'
import { createRng } from '../rng'
import { advanceLane, computeSpeed, drawJitter } from '../simulation'
import type { LanePosition } from '../types'

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

describe('advanceLane', () => {
  const runningLane = (meters: number): LanePosition => ({
    horseId: 7,
    lane: 3,
    meters,
    finishedAtMs: null,
  })

  it('advances meters by speed*dt for a not-finished, non-crossing lane (happy)', () => {
    const lane = runningLane(100)
    const next = advanceLane(lane, 18, 1000 / 60, 1200, 0)
    expect(next.meters).toBeCloseTo(100 + 18 * (1000 / 60) / 1000, 10)
    expect(next.finishedAtMs).toBeNull()
    expect(next.horseId).toBe(lane.horseId)
    expect(next.lane).toBe(lane.lane)
  })

  it('clamps meters and sets finishedAtMs via sub-tick interpolation when crossing the line (edge — closed-form anchor)', () => {
    // prevMeters=0, distance=1200, speed=18 m/s, dt large enough to overshoot.
    // 1200 / 18 = 66.666… s → 66_666.666… ms exactly.
    const next = advanceLane(runningLane(0), 18, 200_000, 1200, 0)
    expect(next.meters).toBe(1200)
    expect(next.finishedAtMs).toBeCloseTo(66_666.666_666_666, 6)
  })

  it('returns an already-finished lane untouched (sad — no movement, no overwrite)', () => {
    const finished: LanePosition = { horseId: 7, lane: 3, meters: 1200, finishedAtMs: 60_000 }
    const next = advanceLane(finished, 18, 1000 / 60, 1200, 90_000)
    expect(next.meters).toBe(1200)
    expect(next.finishedAtMs).toBe(60_000)
  })
})
