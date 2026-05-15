import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { HORSE_COUNT, PHASE_RESTING, REST_DURATION_MS, REST_POLL_INTERVAL_MS } from '../../domain/constants'
import type { Horse, HorsesEnvelope } from '../../domain/types'

const mockGetHorses = vi.fn()
const mockStartRest = vi.fn()
const mockCompleteRound = vi.fn()

vi.mock('../../composables/useRaceApi', () => ({
  useRaceApi: () => ({
    getHorses: mockGetHorses,
    startRest: mockStartRest,
    completeRound: mockCompleteRound,
  }),
}))

const { useRaceStore } = await import('../../stores/race')
const { useHorsesStore } = await import('../../stores/horses')
const { useRestPolling } = await import('../useRestPolling')

const FIXED_NOW_MS = 1_700_000_000_000

function makeRoster(condition: number): Horse[] {
  return Array.from({ length: HORSE_COUNT }, (_, index) => ({
    number: index + 1,
    name: `Horse ${index + 1}`,
    condition,
  }))
}

function mountPollingHost() {
  const Host = defineComponent({
    setup() {
      useRestPolling()
      return () => h('div')
    },
  })
  return mount(Host)
}

async function enterResting(restingUntil: number) {
  const race = useRaceStore()
  mockStartRest.mockResolvedValueOnce({
    horses: makeRoster(20),
    restingUntil,
  } satisfies HorsesEnvelope)
  await race.rest()
}

beforeEach(() => {
  vi.setSystemTime(new Date(FIXED_NOW_MS))
  setActivePinia(createPinia())
  mockGetHorses.mockReset()
  mockStartRest.mockReset()
  mockCompleteRound.mockReset()
})

describe('useRestPolling', () => {
  it('polls GET /api/horses on entering RESTING and again every interval (happy)', async () => {
    mockGetHorses.mockResolvedValue({
      horses: makeRoster(20),
      restingUntil: FIXED_NOW_MS + REST_DURATION_MS,
    } satisfies HorsesEnvelope)
    const wrapper = mountPollingHost()
    await enterResting(FIXED_NOW_MS + REST_DURATION_MS)
    await vi.waitFor(() => expect(mockGetHorses).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(REST_POLL_INTERVAL_MS)
    expect(mockGetHorses).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(REST_POLL_INTERVAL_MS)
    expect(mockGetHorses).toHaveBeenCalledTimes(3)
    wrapper.unmount()
  })

  it('calls race.completeRest and stops polling when envelope clears (edge: rest complete)', async () => {
    const race = useRaceStore()
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeRoster(30))
    mockGetHorses.mockResolvedValueOnce({
      horses: makeRoster(20),
      restingUntil: FIXED_NOW_MS + REST_DURATION_MS,
    })
    mockGetHorses.mockResolvedValueOnce({
      horses: makeRoster(40),
      restingUntil: null,
    })

    const wrapper = mountPollingHost()
    await enterResting(FIXED_NOW_MS + REST_DURATION_MS)
    // first immediate tick — still resting
    await vi.waitFor(() => expect(mockGetHorses).toHaveBeenCalledTimes(1))
    expect(race.phase).toBe(PHASE_RESTING)
    // second tick — envelope clears, completeRest fires
    await vi.advanceTimersByTimeAsync(REST_POLL_INTERVAL_MS)
    await vi.waitFor(() => expect(race.phase).not.toBe(PHASE_RESTING))
    expect(horses.horses.every((horse) => horse.condition === 40)).toBe(true)

    const callsAfterCompletion = mockGetHorses.mock.calls.length
    await vi.advanceTimersByTimeAsync(REST_POLL_INTERVAL_MS * 5)
    expect(mockGetHorses).toHaveBeenCalledTimes(callsAfterCompletion)
    wrapper.unmount()
  })

  it('tolerates a failed GET without crashing and keeps polling (sad)', async () => {
    mockGetHorses.mockRejectedValueOnce(new Error('boom'))
    mockGetHorses.mockResolvedValueOnce({
      horses: makeRoster(20),
      restingUntil: FIXED_NOW_MS + REST_DURATION_MS,
    })
    const wrapper = mountPollingHost()
    await enterResting(FIXED_NOW_MS + REST_DURATION_MS)
    await vi.waitFor(() => expect(mockGetHorses).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(REST_POLL_INTERVAL_MS)
    expect(mockGetHorses).toHaveBeenCalledTimes(2)
    const race = useRaceStore()
    expect(race.phase).toBe(PHASE_RESTING)
    wrapper.unmount()
  })
})
