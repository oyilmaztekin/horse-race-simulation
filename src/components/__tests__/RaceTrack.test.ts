import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import {
  HORSE_COUNT,
  LANE_COUNT,
  PHASE_RACING,
  ROUND_DISTANCES,
  SIM_SPEED_DEFAULT,
  SIM_SPEED_MAX,
  SIM_SPEED_MIN,
  SIM_SPEED_STEP,
} from '../../domain/constants'
import type {
  Horse,
  HorseId,
  LanePosition,
  Program,
  Ranking,
} from '../../domain/types'

const positions = ref<LanePosition[]>([])
const finishOrder = ref<Ranking[]>([])
const done = ref(false)

vi.mock('../../composables/useRaceSimulation', () => ({
  useRaceSimulation: vi.fn(() => ({ positions, finishOrder, done })),
}))

import RaceTrack from '../RaceTrack.vue'
import RaceLane from '../RaceLane.vue'

function makeHorses(): Horse[] {
  return Array.from({ length: HORSE_COUNT }, (_: unknown, index: number) => ({
    number: index + 1,
    name: `Horse ${index + 1}`,
    condition: 60,
  }))
}

function makeProgram(): Program {
  return ROUND_DISTANCES.map((distance: number) => ({
    distance,
    lanes: Array.from(
      { length: LANE_COUNT },
      (_: unknown, index: number) => (index + 1) as HorseId,
    ),
  }))
}

function makeRankings(): Ranking[] {
  return Array.from({ length: LANE_COUNT }, (_: unknown, index: number) => ({
    rank: index + 1,
    horseId: index + 1,
    lane: index + 1,
    finishTimeMs: 60_000 + index,
  }))
}

function makePositions(): LanePosition[] {
  return Array.from({ length: LANE_COUNT }, (_: unknown, index: number) => ({
    horseId: (index + 1) as HorseId,
    lane: index + 1,
    meters: 0,
    finishedAtMs: null,
    form: 0,
  }))
}

function mountTrack(opts?: { currentRoundIndex?: number }) {
  positions.value = makePositions()
  finishOrder.value = []
  done.value = false
  const program = makeProgram()
  return mount(RaceTrack, {
    global: {
      plugins: [
        createTestingPinia({
          stubActions: false,
          initialState: {
            horses: { horses: makeHorses(), isLoading: false, error: null },
            race: {
              state: {
                kind: PHASE_RACING,
                program,
                rng: () => 0.5,
                seed: 1,
                currentRoundIndex: opts?.currentRoundIndex ?? 0,
                results: [],
              },
            },
          },
        }),
      ],
    },
  })
}

beforeEach(() => {
  positions.value = makePositions()
  finishOrder.value = []
  done.value = false
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('RaceTrack', () => {
  it('renders one RaceLane per lane in the current round (happy)', () => {
    const wrapper = mountTrack()
    const lanes = wrapper.findAllComponents(RaceLane)
    expect(lanes).toHaveLength(LANE_COUNT)
    expect(lanes[0]!.props().laneIndex).toBe(0)
    expect(lanes[LANE_COUNT - 1]!.props().laneIndex).toBe(LANE_COUNT - 1)
    expect(lanes[0]!.props().distanceM).toBe(ROUND_DISTANCES[0])
    expect(lanes[0]!.props().horse).toEqual({ number: 1, name: 'Horse 1', condition: 60 })
    expect(lanes[0]!.props().positionM).toBe(0)
    wrapper.unmount()
  })

  it('dispatches race.completeRound exactly once when done flips true (edge)', async () => {
    const wrapper = mountTrack()
    const completeRound = vi.fn()
    // Inject the action spy on the race store via the testing pinia.
    const raceStore = (wrapper.vm as unknown as { $pinia?: unknown }).$pinia
    void raceStore
    // Pull the store from the wrapper context.
    const { useRaceStore } = await import('../../stores/race')
    const race = useRaceStore()
    race.completeRound = completeRound as unknown as typeof race.completeRound

    finishOrder.value = makeRankings()
    done.value = true
    await nextTick()

    expect(completeRound).toHaveBeenCalledTimes(1)
    expect(completeRound).toHaveBeenCalledWith(finishOrder.value)
    wrapper.unmount()
  })

  it('Phase 12.2: renders a speed-control row showing the current multiplier and wired to store actions (happy)', async () => {
    const wrapper = mountTrack()
    const control = wrapper.find('[data-testid="race-track-speed-control"]')
    expect(control.exists()).toBe(true)
    const readout = wrapper.find('[data-testid="race-track-speed-readout"]')
    expect(readout.text()).toContain(SIM_SPEED_DEFAULT.toString())

    const { useRaceStore } = await import('../../stores/race')
    const race = useRaceStore()
    const increase = vi.fn()
    const decrease = vi.fn()
    race.increaseSimSpeed = increase as unknown as typeof race.increaseSimSpeed
    race.decreaseSimSpeed = decrease as unknown as typeof race.decreaseSimSpeed

    await wrapper.find('[data-testid="race-track-speed-increase"]').trigger('click')
    expect(increase).toHaveBeenCalledTimes(1)
    await wrapper.find('[data-testid="race-track-speed-decrease"]').trigger('click')
    expect(decrease).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('Phase 12.2: disables decrease at SIM_SPEED_MIN and increase at SIM_SPEED_MAX (edge — bounds)', async () => {
    const wrapper = mountTrack()
    const { useRaceStore } = await import('../../stores/race')
    const race = useRaceStore()
    // testing-pinia + stubActions:false → mutating state directly is supported.
    race.$patch({ simSpeedMultiplier: SIM_SPEED_MIN })
    await nextTick()
    expect(wrapper.find('[data-testid="race-track-speed-decrease"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="race-track-speed-increase"]').attributes('disabled')).toBeUndefined()

    race.$patch({ simSpeedMultiplier: SIM_SPEED_MAX })
    await nextTick()
    expect(wrapper.find('[data-testid="race-track-speed-increase"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="race-track-speed-decrease"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('Phase 12.2: readout reflects multiplier mutations (sad — a static display would fail)', async () => {
    const wrapper = mountTrack()
    const { useRaceStore } = await import('../../stores/race')
    const race = useRaceStore()
    race.$patch({ simSpeedMultiplier: SIM_SPEED_DEFAULT + SIM_SPEED_STEP })
    await nextTick()
    expect(wrapper.find('[data-testid="race-track-speed-readout"]').text()).toContain(
      (SIM_SPEED_DEFAULT + SIM_SPEED_STEP).toString(),
    )
    wrapper.unmount()
  })

  it('does not re-dispatch completeRound on subsequent done changes (sad: { once: true })', async () => {
    const wrapper = mountTrack()
    const completeRound = vi.fn()
    const { useRaceStore } = await import('../../stores/race')
    const race = useRaceStore()
    race.completeRound = completeRound as unknown as typeof race.completeRound

    finishOrder.value = makeRankings()
    done.value = true
    await nextTick()
    done.value = false
    await nextTick()
    done.value = true
    await nextTick()

    expect(completeRound).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
