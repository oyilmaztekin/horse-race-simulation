import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HorseSprite from '../HorseSprite.vue'
import { CONDITION_MAX, CONDITION_MIN } from '../../domain/constants'

describe('HorseSprite', () => {
  it('renders an SVG colored by the color prop and shows the condition (happy)', () => {
    const wrapper = mount(HorseSprite, { props: { color: '#e69f00', progress: 0, condition: 80 } })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.html()).toContain('#e69f00')
    expect(wrapper.text()).toContain('80')
  })

  it('translates the sprite horizontally proportional to progress (edge: 0 → 0%, 1 → 100%)', async () => {
    const wrapper = mount(HorseSprite, { props: { color: '#000', progress: 0, condition: CONDITION_MAX } })
    expect(wrapper.attributes('style')).toContain('--horse-progress: 0')

    await wrapper.setProps({ progress: 1 })
    expect(wrapper.attributes('style')).toContain('--horse-progress: 1')
  })

  it('updates the rendered condition text when the prop changes (sad — stub ignoring prop would fail)', async () => {
    const wrapper = mount(HorseSprite, { props: { color: '#000', progress: 0.5, condition: CONDITION_MIN } })
    expect(wrapper.text()).toContain(String(CONDITION_MIN))
    await wrapper.setProps({ condition: CONDITION_MAX })
    expect(wrapper.text()).toContain(String(CONDITION_MAX))
    expect(wrapper.text()).not.toContain(`>${CONDITION_MIN}<`)
  })
})
