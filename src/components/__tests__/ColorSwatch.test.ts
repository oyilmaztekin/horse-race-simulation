import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ColorSwatch from '../ColorSwatch.vue'

describe('ColorSwatch', () => {
  it('renders an element styled with the given color (happy)', () => {
    const wrapper = mount(ColorSwatch, { props: { color: '#e69f00' } })
    expect(wrapper.attributes('style')).toContain('background-color: rgb(230, 159, 0)')
  })

  it('uses the color prop unchanged for arbitrary CSS color strings (edge)', () => {
    const wrapper = mount(ColorSwatch, { props: { color: 'rebeccapurple' } })
    expect(wrapper.attributes('style')).toContain('background-color: rebeccapurple')
  })

  it('changes background-color when the color prop changes (sad — stub that ignored prop would fail)', async () => {
    const wrapper = mount(ColorSwatch, { props: { color: '#000000' } })
    await wrapper.setProps({ color: '#ffffff' })
    expect(wrapper.attributes('style')).toContain('background-color: rgb(255, 255, 255)')
    expect(wrapper.attributes('style')).not.toContain('rgb(0, 0, 0)')
  })
})
