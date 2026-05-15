import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it } from 'vitest'
import type { Horse } from '../../domain/types'
import HorseList from '../HorseList.vue'
import HorseListItem from '../HorseListItem.vue'

function makeHorses(count: number): Horse[] {
  return Array.from({ length: count }, (_: unknown, index: number) => ({
    number: index + 1,
    name: `Horse ${index + 1}`,
    condition: 60,
  }))
}

describe('HorseList', () => {
  it('renders one HorseListItem per horse in horses.horses (happy)', () => {
    const wrapper = mount(HorseList, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              horses: { horses: makeHorses(20), isLoading: false, error: null },
            },
          }),
        ],
      },
    })
    expect(wrapper.findAllComponents(HorseListItem)).toHaveLength(20)
  })

  it('renders a loading skeleton instead of items when isLoading (edge)', () => {
    const wrapper = mount(HorseList, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              horses: { horses: [], isLoading: true, error: null },
            },
          }),
        ],
      },
    })
    expect(wrapper.find('[data-testid="horse-list-skeleton"]').exists()).toBe(true)
    expect(wrapper.findAllComponents(HorseListItem)).toHaveLength(0)
  })

  it('renders zero items when the roster is empty and not loading (sad — stub returning a fixed list would fail)', () => {
    const wrapper = mount(HorseList, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              horses: { horses: [], isLoading: false, error: null },
            },
          }),
        ],
      },
    })
    expect(wrapper.findAllComponents(HorseListItem)).toHaveLength(0)
    expect(wrapper.find('[data-testid="horse-list-skeleton"]').exists()).toBe(false)
  })
})
