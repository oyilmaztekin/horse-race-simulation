import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'
import {
  HORSE_COUNT,
  MIN_FIT_HORSES_FOR_PROGRAM,
  PHASE_INITIAL,
  PHASE_READY,
  PHASE_RESTING,
} from '../../domain/constants'
import { NotEnoughFitHorsesError } from '../../domain/errors'
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

  it('hides warning + Rest button before any click (sad — stub that always showed would fail)', () => {
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
    expect(wrapper.find('[data-testid="warning"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="btn-rest"]').exists()).toBe(false)
  })

  it('shows warning + reveals Rest button after Generate throws NotEnoughFitHorsesError (happy)', async () => {
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
    const fitCount = MIN_FIT_HORSES_FOR_PROGRAM - 5
    vi.mocked(race.generateProgram).mockImplementation(() => {
      throw new NotEnoughFitHorsesError(fitCount, MIN_FIT_HORSES_FOR_PROGRAM)
    })
    await wrapper.find('[data-testid="btn-generate"]').trigger('click')
    expect(wrapper.find('[data-testid="warning"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="warning"]').text()).toContain(String(fitCount))
    expect(wrapper.find('[data-testid="warning"]').text()).toContain(String(MIN_FIT_HORSES_FOR_PROGRAM))
    expect(wrapper.find('[data-testid="btn-rest"]').exists()).toBe(true)
  })

  it('does not surface a warning when generateProgram succeeds (edge — successful gen must not reveal Rest)', async () => {
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
    await wrapper.find('[data-testid="btn-generate"]').trigger('click')
    expect(wrapper.find('[data-testid="warning"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="btn-rest"]').exists()).toBe(false)
  })

  it('renders a countdown derived from restingUntil during RESTING (happy)', () => {
    const restingUntil = Date.now() + 7000
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
    const countdown = wrapper.find('[data-testid="countdown"]')
    expect(countdown.exists()).toBe(true)
    expect(countdown.text()).toContain('7')
  })

  it('hides the countdown outside RESTING (edge — stub always rendering would fail)', () => {
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
    expect(wrapper.find('[data-testid="countdown"]').exists()).toBe(false)
  })

  it('disables Generate, Start, and the Rest button during RESTING (sad — stub leaving Rest live would fail)', async () => {
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
    vi.mocked(race.generateProgram).mockImplementation(() => {
      throw new NotEnoughFitHorsesError(MIN_FIT_HORSES_FOR_PROGRAM - 1, MIN_FIT_HORSES_FOR_PROGRAM)
    })
    await wrapper.find('[data-testid="btn-generate"]').trigger('click')
    expect(wrapper.find('[data-testid="btn-rest"]').exists()).toBe(true)

    race.state = { kind: PHASE_RESTING, restingUntil: Date.now() + 5000 }
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="btn-generate"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="btn-start"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="btn-rest"]').attributes('disabled')).toBeDefined()
  })

  it('dispatches race.rest on Rest button click (sad — stub ignoring @click would fail)', async () => {
    // Roster with most horses below MIN_RACEABLE_CONDITION so canRest === true.
    const unfitRoster = makeHorses(HORSE_COUNT, 10)
    const wrapper = mount(RaceControls, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              horses: { horses: unfitRoster, isLoading: false, error: null },
              race: { state: { kind: PHASE_INITIAL } },
            },
          }),
        ],
      },
    })
    const { useRaceStore } = await import('../../stores/race')
    const race = useRaceStore()
    vi.mocked(race.generateProgram).mockImplementation(() => {
      throw new NotEnoughFitHorsesError(0, MIN_FIT_HORSES_FOR_PROGRAM)
    })
    await wrapper.find('[data-testid="btn-generate"]').trigger('click')
    await wrapper.find('[data-testid="btn-rest"]').trigger('click')
    expect(race.rest).toHaveBeenCalledOnce()
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
