import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RankingRow from '../RankingRow.vue'
import ColorSwatch from '../ColorSwatch.vue'
import { LANE_COLORS } from '../../domain/constants'
import type { Horse } from '../../domain/types'

const HORSE: Horse = { number: 7, name: 'Lightning', condition: 90 }

describe('RankingRow', () => {
  it('renders position, horse name, and a ColorSwatch using LANE_COLORS[laneIndex] (happy)', () => {
    const wrapper = mount(RankingRow, { props: { position: 1, horse: HORSE, laneIndex: 2 } })
    expect(wrapper.text()).toContain('1')
    expect(wrapper.text()).toContain('Lightning')
    const swatch = wrapper.findComponent(ColorSwatch)
    expect(swatch.exists()).toBe(true)
    expect(swatch.props('color')).toBe(LANE_COLORS[2])
  })

  it('renders the position prop verbatim across the rank range (edge)', () => {
    const first = mount(RankingRow, { props: { position: 1, horse: HORSE, laneIndex: 0 } })
    const last = mount(RankingRow, { props: { position: 10, horse: HORSE, laneIndex: 0 } })
    expect(first.text()).toContain('1')
    expect(last.text()).toContain('10')
  })

  it('updates swatch color when the laneIndex prop changes (sad — stub ignoring prop would fail)', async () => {
    const wrapper = mount(RankingRow, { props: { position: 3, horse: HORSE, laneIndex: 0 } })
    expect(wrapper.findComponent(ColorSwatch).props('color')).toBe(LANE_COLORS[0])
    await wrapper.setProps({ laneIndex: 9 })
    expect(wrapper.findComponent(ColorSwatch).props('color')).toBe(LANE_COLORS[9])
    expect(wrapper.findComponent(ColorSwatch).props('color')).not.toBe(LANE_COLORS[0])
  })
})
