import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HorseListItem from '../HorseListItem.vue'
import { CONDITION_MAX, CONDITION_MIN } from '../../domain/constants'
import type { Horse } from '../../domain/types'

const buildHorse = (overrides: Partial<Horse> = {}): Horse => ({
  number: 1,
  name: 'Thunderbolt',
  condition: 72,
  ...overrides,
})

describe('HorseListItem', () => {
  it("renders the horse's name and condition (happy)", () => {
    const wrapper = mount(HorseListItem, { props: { horse: buildHorse() } })
    expect(wrapper.text()).toContain('Thunderbolt')
    expect(wrapper.text()).toContain('72')
  })

  it('renders boundary conditions verbatim (edge: min and max)', () => {
    const minHorse = mount(HorseListItem, { props: { horse: buildHorse({ name: 'Minimal', condition: CONDITION_MIN }) } })
    expect(minHorse.text()).toContain('Minimal')
    expect(minHorse.text()).toContain(String(CONDITION_MIN))

    const maxHorse = mount(HorseListItem, { props: { horse: buildHorse({ name: 'Maximal', condition: CONDITION_MAX }) } })
    expect(maxHorse.text()).toContain('Maximal')
    expect(maxHorse.text()).toContain(String(CONDITION_MAX))
  })

  it('updates rendered values when the horse prop changes (sad — stub ignoring prop would fail)', async () => {
    const wrapper = mount(HorseListItem, { props: { horse: buildHorse({ name: 'Alpha', condition: 40 }) } })
    expect(wrapper.text()).toContain('Alpha')
    await wrapper.setProps({ horse: buildHorse({ name: 'Beta', condition: 88 }) })
    expect(wrapper.text()).toContain('Beta')
    expect(wrapper.text()).toContain('88')
    expect(wrapper.text()).not.toContain('Alpha')
  })
})
