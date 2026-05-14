import { describe, expect, it } from 'vitest'
import {
  BASE_SPEED_MPS_MAX,
  BASE_SPEED_MPS_MIN,
  CONDITION_MAX,
  CONDITION_MIN,
  JITTER_MPS,
  LANE_COUNT,
  ROUND_DISTANCES,
  SIM_TICK_MS,
} from '../constants'
import { createRng } from '../rng'
import { advanceLane, computeSpeed, createSnapshot, drawJitter, step } from '../simulation'
import type { HorseId, LanePosition, Round, SimulationSnapshot } from '../types'

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
    const next = advanceLane(lane, 18, SIM_TICK_MS, 1200, 0)
    expect(next.meters).toBeCloseTo(100 + (18 * SIM_TICK_MS) / 1000, 10)
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
    const next = advanceLane(finished, 18, SIM_TICK_MS, 1200, 90_000)
    expect(next.meters).toBe(1200)
    expect(next.finishedAtMs).toBe(60_000)
  })
})

describe('createSnapshot', () => {
  const round: Round = {
    distance: ROUND_DISTANCES[2],
    lanes: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  }

  it('returns a zeroed snapshot with distance + roundNumber wired through (happy)', () => {
    const snap = createSnapshot(round, 3)
    expect(snap.roundNumber).toBe(3)
    expect(snap.distance).toBe(round.distance)
    expect(snap.elapsedMs).toBe(0)
    expect(snap.lanes).toHaveLength(LANE_COUNT)
  })

  it('numbers lanes 1..LANE_COUNT in lane-order and matches horseIds by index (edge — boundary)', () => {
    const snap = createSnapshot(round, 3)
    snap.lanes.forEach((lane, index) => {
      expect(lane.lane).toBe(index + 1)
      expect(lane.horseId).toBe(round.lanes[index])
    })
  })

  it('every lane starts at meters=0 with finishedAtMs=null (sad — a stub returning distance/0 would fail)', () => {
    const snap = createSnapshot(round, 3)
    for (const lane of snap.lanes) {
      expect(lane.meters).toBe(0)
      expect(lane.finishedAtMs).toBeNull()
    }
  })
})

describe('step', () => {
  // Sequenced RNG: yields values[0], values[1], ... — overflow throws so the
  // test fails loudly if step draws more (or fewer) times than expected.
  const sequenceRng = (values: number[]) => {
    let index = 0
    return () => {
      if (index >= values.length) throw new Error('rng over-consumed')
      const value = values[index]
      index += 1
      return value as number
    }
  }
  const half = () => 0.5
  const maxConditionLookup = (_horseId: HorseId) => CONDITION_MAX
  const startSnapshot = (): SimulationSnapshot =>
    createSnapshot({ distance: ROUND_DISTANCES[0], lanes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }, 1)

  it('advances every lane by speed*dt and accumulates elapsedMs (happy — closed-form: cond=MAX, jitter=0)', () => {
    // rng() === 0.5 → jitter=0; condition=MAX → speed = BASE_SPEED_MPS_MAX exactly.
    const dtMs = SIM_TICK_MS
    const next = step(startSnapshot(), dtMs, maxConditionLookup, half)
    expect(next.elapsedMs).toBe(dtMs)
    const expectedMeters = BASE_SPEED_MPS_MAX * (dtMs / 1000)
    for (const lane of next.lanes) {
      expect(lane.meters).toBeCloseTo(expectedMeters, 10)
      expect(lane.finishedAtMs).toBeNull()
    }
  })

  it('draws jitter in lane-order 1→10 — lane 1 gets values[0], lane 10 gets values[9] (edge — decision #13)', () => {
    // All conditions equal → only the jitter draw distinguishes lanes.
    // values[0]=0 (most negative jitter) for lane 1, values[9]=1-eps (most positive) for lane 10.
    const epsilon = 1e-10
    const values = [0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1 - epsilon]
    const next = step(startSnapshot(), SIM_TICK_MS, maxConditionLookup, sequenceRng(values))
    const lane1 = next.lanes[0] as LanePosition
    const lane10 = next.lanes[9] as LanePosition
    // lane 10 drew the larger jitter → larger speed → more meters this tick.
    expect(lane10.meters).toBeGreaterThan(lane1.meters)
    // And every middle lane (jitter=0) sits strictly between them.
    for (let index = 1; index <= 8; index += 1) {
      const lane = next.lanes[index] as LanePosition
      expect(lane.meters).toBeGreaterThan(lane1.meters)
      expect(lane.meters).toBeLessThan(lane10.meters)
    }
  })

  it('skips already-finished lanes — no rng draw, no movement (sad — would fail if step blindly iterated)', () => {
    const snap = startSnapshot()
    // Pre-finish lane 1: meters at distance, finishedAtMs set.
    const finishedLane: LanePosition = { ...(snap.lanes[0] as LanePosition), meters: snap.distance, finishedAtMs: 12_345 }
    const seeded: SimulationSnapshot = { ...snap, lanes: [finishedLane, ...snap.lanes.slice(1)] }
    // Provide exactly LANE_COUNT - 1 rng values; an extra draw would overflow and throw.
    const values = Array.from({ length: LANE_COUNT - 1 }, () => 0.5)
    const next = step(seeded, SIM_TICK_MS, maxConditionLookup, sequenceRng(values))
    const lane1 = next.lanes[0] as LanePosition
    expect(lane1.meters).toBe(snap.distance)
    expect(lane1.finishedAtMs).toBe(12_345)
  })
})
