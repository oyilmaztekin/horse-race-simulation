import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it } from 'vitest'
import {
  HORSE_COUNT,
  PHASE_FINISHED,
  PHASE_INITIAL,
  PHASE_READY,
} from '../../domain/constants'
import type { Horse } from '../../domain/types'
import AppHeader from '../AppHeader.vue'
import RaceControls from '../RaceControls.vue'

function makeHorses(): Horse[] {
  return Array.from({ length: HORSE_COUNT }, (_: unknown, index: number) => ({
    number: index + 1,
    name: `Horse ${index + 1}`,
    condition: 60,
  }))
}

function mountHeader(raceState: Record<string, unknown>) {
  return mount(AppHeader, {
    global: {
      plugins: [
        createTestingPinia({
          stubActions: true,
          initialState: {
            horses: { horses: makeHorses(), isLoading: false, error: null },
            race: { state: raceState },
          },
        }),
      ],
    },
  })
}

describe('AppHeader', () => {
  it('renders the phase indicator with the current race phase (happy)', () => {
    const wrapper = mountHeader({ kind: PHASE_INITIAL })
    expect(wrapper.find('[data-testid="phase-indicator"]').text()).toBe(`state:${PHASE_INITIAL}`)
  })

  it('updates the phase indicator when the store phase changes (edge)', async () => {
    const wrapper = mountHeader({ kind: PHASE_INITIAL })
    // Simulate phase advance — write into the testing pinia's state.
    const pinia = wrapper.vm.$pinia as unknown as {
      state: { value: { race: { state: { kind: string } } } }
    }
    pinia.state.value.race.state = {
      kind: PHASE_FINISHED,
      program: [],
      seed: 1,
      results: [],
    } as unknown as { kind: string }
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="phase-indicator"]').text()).toBe(`state:${PHASE_FINISHED}`)
  })

  it('mounts RaceControls as a child (sad: a header without the nested controls would break the layout contract)', () => {
    const wrapper = mountHeader({ kind: PHASE_READY, program: [], rng: () => 0.5, seed: 1 })
    expect(wrapper.findComponent(RaceControls).exists()).toBe(true)
  })
})
