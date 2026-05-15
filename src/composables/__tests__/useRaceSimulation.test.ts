import { defineComponent, h, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { useRaceSimulation } from '../useRaceSimulation'
import { createRng } from '../../domain/rng'
import { CONDITION_MAX, LANE_COUNT, ROUND_DISTANCES } from '../../domain/constants'
import type { HorseId, Ranking, LanePosition, Round } from '../../domain/types'

const ROUND_NUMBER = 1
const SHORT_DISTANCE = ROUND_DISTANCES[0]
const ROUND: Round = {
  distance: SHORT_DISTANCE,
  lanes: Array.from({ length: LANE_COUNT }, (_, index) => (index + 1) as HorseId),
}

const conditionLookup = (_horseId: HorseId) => CONDITION_MAX

interface HarnessExposed {
  positions: Ref<LanePosition[]>
  finishOrder: Ref<Ranking[]>
  done: Ref<boolean>
}

function mountHarness(round: Round = ROUND, seed = 0xC0FFEE) {
  const exposed: { value: HarnessExposed | null } = { value: null }
  const Harness = defineComponent({
    setup() {
      const sim = useRaceSimulation(round, ROUND_NUMBER, conditionLookup, createRng(seed))
      exposed.value = sim as unknown as HarnessExposed
      return () => h('div')
    },
  })
  const wrapper = mount(Harness)
  return { wrapper, exposed: exposed.value! }
}

describe('useRaceSimulation', () => {
  it('advances positions as fake-time elapses (happy path)', async () => {
    const { wrapper, exposed } = mountHarness()
    expect(exposed.positions.value.every((lane) => lane.meters === 0)).toBe(true)
    await vi.advanceTimersByTimeAsync(500)
    expect(exposed.positions.value.some((lane) => lane.meters > 0)).toBe(true)
    expect(exposed.done.value).toBe(false)
    wrapper.unmount()
  })

  it('fills finishOrder and flips done when every lane crosses the line (edge)', async () => {
    const { wrapper, exposed } = mountHarness()
    // 1200m at ~16 m/s ≈ 75s; advance well past that.
    await vi.advanceTimersByTimeAsync(120_000)
    expect(exposed.done.value).toBe(true)
    expect(exposed.finishOrder.value).toHaveLength(LANE_COUNT)
    expect(exposed.finishOrder.value.map((ranking) => ranking.rank)).toEqual(
      Array.from({ length: LANE_COUNT }, (_, index) => index + 1),
    )
    const horseIds = exposed.finishOrder.value.map((ranking) => ranking.horseId)
    expect(new Set(horseIds).size).toBe(LANE_COUNT)
    expect([...horseIds].sort((a, b) => a - b)).toEqual(ROUND.lanes)
    wrapper.unmount()
  })

  it('is deterministic across two runs of the same seed (sad: stub returning constant would fail)', async () => {
    const { wrapper: wrapperA, exposed: exposedA } = mountHarness(ROUND, 42)
    await vi.advanceTimersByTimeAsync(120_000)
    const orderA = exposedA.finishOrder.value.map((ranking) => ranking.horseId)
    wrapperA.unmount()

    const { wrapper: wrapperB, exposed: exposedB } = mountHarness(ROUND, 42)
    await vi.advanceTimersByTimeAsync(120_000)
    const orderB = exposedB.finishOrder.value.map((ranking) => ranking.horseId)
    wrapperB.unmount()

    expect(orderA).toEqual(orderB)

    const { wrapper: wrapperC, exposed: exposedC } = mountHarness(ROUND, 99)
    await vi.advanceTimersByTimeAsync(120_000)
    const orderC = exposedC.finishOrder.value.map((ranking) => ranking.horseId)
    wrapperC.unmount()
    expect(orderC).not.toEqual(orderA)
  })

  it('cancels its rAF handle on unmount (sad: leaked rAF is a rejection-worthy bug)', async () => {
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame')
    const { wrapper } = mountHarness()
    await vi.advanceTimersByTimeAsync(100)
    wrapper.unmount()
    expect(cancelSpy).toHaveBeenCalled()
    cancelSpy.mockRestore()
  })
})
