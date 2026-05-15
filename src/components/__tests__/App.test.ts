import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  HORSE_COUNT,
  LANE_COUNT,
  PHASE_INITIAL,
  PHASE_RACING,
  PHASE_READY,
  ROUND_DISTANCES,
} from '../../domain/constants'
import type { Horse, HorseId, Program } from '../../domain/types'

vi.mock('../../composables/useRestPolling', () => ({
  useRestPolling: vi.fn(),
}))
import { useRestPolling } from '../../composables/useRestPolling'
const useRestPollingSpy = vi.mocked(useRestPolling)

import App from '../../App.vue'
import RaceTrack from '../RaceTrack.vue'
import { useHorsesStore } from '../../stores/horses'

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

function mountApp(raceState: Record<string, unknown> = { kind: PHASE_INITIAL }) {
  return mount(App, {
    global: {
      stubs: {
        AppHeader: true,
        ErrorBanner: true,
        HorseList: true,
        ProgramPanel: true,
        ResultsPanel: true,
        RaceTrack: true,
      },
      plugins: [
        createTestingPinia({
          stubActions: true,
          initialState: {
            horses: { horses: [], isLoading: false, error: null },
            race: { state: raceState },
          },
        }),
      ],
    },
  })
}

beforeEach(() => {
  useRestPollingSpy.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('App', () => {
  it('calls horses.fetchAll on mount and instantiates useRestPolling once (happy)', () => {
    const wrapper = mountApp()
    const horses = useHorsesStore()
    expect(horses.fetchAll).toHaveBeenCalledTimes(1)
    expect(useRestPollingSpy).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('mounts RaceTrack only during RACING and keys it by currentRoundIndex (edge)', async () => {
    const program = makeProgram()
    const racing = {
      kind: PHASE_RACING,
      program,
      rng: () => 0.5,
      seed: 1,
      currentRoundIndex: 0,
      results: [],
    }
    // RaceTrack itself reads stores — pre-seed horses too so it would mount if it had to.
    const wrapper = mount(App, {
      global: {
        stubs: { AppHeader: true, ErrorBanner: true, HorseList: true, ProgramPanel: true, ResultsPanel: true },
        plugins: [
          createTestingPinia({
            stubActions: true,
            initialState: {
              horses: { horses: makeHorses(), isLoading: false, error: null },
              race: { state: racing },
            },
          }),
        ],
      },
    })
    const firstTrack = wrapper.findComponent(RaceTrack)
    expect(firstTrack.exists()).toBe(true)
    expect(firstTrack.attributes('data-round-key')).toBe('0')
    wrapper.unmount()
  })

  it('does not render RaceTrack outside RACING (sad: a template missing the v-if would still mount it)', () => {
    const ready = { kind: PHASE_READY, program: makeProgram(), rng: () => 0.5, seed: 1 }
    const wrapper = mountApp(ready)
    expect(wrapper.findComponent(RaceTrack).exists()).toBe(false)
    wrapper.unmount()
  })
})
