import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'
import {
  HORSE_COUNT,
  PHASE_INITIAL,
  PHASE_READY,
  PHASE_RESTING,
} from '../../domain/constants'
import type { Horse } from '../../domain/types'
import RaceControls from '../RaceControls.vue'

function makeHorses(count = HORSE_COUNT, condition = 80): Horse[] {
  return Array.from({ length: count }, (_: unknown, index: number) => ({
    number: index + 1,
    name: `Horse ${index + 1}`,
    condition,
  }))
}

describe('RaceControls — button enabled state', () => {
  it('enables Generate and disables Start in INITIAL phase with a full roster (happy)', () => {
    const wrapper = mount(RaceControls, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              horses: { horses: makeHorses(), isLoading: false, error: null },
              race: { state: { kind: PHASE_INITIAL } },
            },
          }),
        ],
      },
    })
    expect(wrapper.find('[data-testid="btn-generate"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="btn-start"]').attributes('disabled')).toBeDefined()
  })

  it('enables both Generate and Start when phase is READY (edge)', () => {
    const wrapper = mount(RaceControls, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              horses: { horses: makeHorses(), isLoading: false, error: null },
              race: { state: { kind: PHASE_READY, program: [], rng: () => 0.5, seed: 42 } },
            },
          }),
        ],
      },
    })
    expect(wrapper.find('[data-testid="btn-generate"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="btn-start"]').attributes('disabled')).toBeUndefined()
  })

  it('disables Generate and Start when phase is RESTING (sad — stub returning enabled would fail)', () => {
    const restingUntil = Date.now() + 5000
    const wrapper = mount(RaceControls, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              horses: { horses: makeHorses(), isLoading: false, error: null },
              race: { state: { kind: PHASE_RESTING, restingUntil } },
            },
          }),
        ],
      },
    })
    expect(wrapper.find('[data-testid="btn-generate"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="btn-start"]').attributes('disabled')).toBeDefined()
  })
})

describe('RaceControls — button click dispatches', () => {
  it('dispatches race.generateProgram on Generate click (happy)', async () => {
    const wrapper = mount(RaceControls, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              horses: { horses: makeHorses(), isLoading: false, error: null },
              race: { state: { kind: PHASE_INITIAL } },
            },
          }),
        ],
      },
    })
    const { useRaceStore } = await import('../../stores/race')
    const race = useRaceStore()
    await wrapper.find('[data-testid="btn-generate"]').trigger('click')
    expect(race.generateProgram).toHaveBeenCalledOnce()
  })

  it('dispatches race.start on Start click when READY (edge)', async () => {
    const wrapper = mount(RaceControls, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              horses: { horses: makeHorses(), isLoading: false, error: null },
              race: { state: { kind: PHASE_READY, program: [], rng: () => 0.5, seed: 1 } },
            },
          }),
        ],
      },
    })
    const { useRaceStore } = await import('../../stores/race')
    const race = useRaceStore()
    await wrapper.find('[data-testid="btn-start"]').trigger('click')
    expect(race.start).toHaveBeenCalledOnce()
    expect(race.generateProgram).not.toHaveBeenCalled()
  })

  it('does not dispatch generateProgram when Generate is disabled (sad — stub firing anyway would fail)', async () => {
    const restingUntil = Date.now() + 5000
    const wrapper = mount(RaceControls, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              horses: { horses: makeHorses(), isLoading: false, error: null },
              race: { state: { kind: PHASE_RESTING, restingUntil } },
            },
          }),
        ],
      },
    })
    const { useRaceStore } = await import('../../stores/race')
    const race = useRaceStore()
    await wrapper.find('[data-testid="btn-generate"]').trigger('click')
    expect(race.generateProgram).not.toHaveBeenCalled()
  })
})
