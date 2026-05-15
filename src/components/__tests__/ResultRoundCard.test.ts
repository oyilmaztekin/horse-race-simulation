import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ResultRoundCard from '../ResultRoundCard.vue'
import ColorSwatch from '../ColorSwatch.vue'
import { LANE_COLORS, LANE_COUNT } from '../../domain/constants'
import type { Horse } from '../../domain/types'

const buildEntries = (): { position: number; horse: Horse; laneIndex: number }[] =>
  Array.from({ length: LANE_COUNT }, (_, index) => ({
    position: index + 1,
    horse: { number: index + 1, name: `Horse ${index + 1}`, condition: 50 },
    laneIndex: (LANE_COUNT - 1 - index) % LANE_COUNT,
  }))

describe('ResultRoundCard', () => {
  it('renders the round header and a row per finisher in finish order (happy)', () => {
    const wrapper = mount(ResultRoundCard, {
      props: { roundNumber: 3, distance: 1600, entries: buildEntries() },
    })
    expect(wrapper.text()).toContain('Round 3')
    expect(wrapper.text()).toContain('1600')
    const rows = wrapper.findAll('[data-test="result-row"]')
    expect(rows).toHaveLength(LANE_COUNT)
    expect(rows[0]?.text()).toContain('1')
    expect(rows[0]?.text()).toContain('Horse 1')
    expect(rows[LANE_COUNT - 1]?.text()).toContain(String(LANE_COUNT))
  })

  it('renders one ColorSwatch per entry using LANE_COLORS[laneIndex] (edge)', () => {
    const entries = buildEntries()
    const wrapper = mount(ResultRoundCard, {
      props: { roundNumber: 1, distance: 1200, entries },
    })
    const swatches = wrapper.findAllComponents(ColorSwatch)
    expect(swatches).toHaveLength(LANE_COUNT)
    entries.forEach((entry, index) => {
      expect(swatches[index]?.props('color')).toBe(LANE_COLORS[entry.laneIndex])
    })
  })

  it('rerenders rows in the new order when entries prop changes (sad — stub ignoring prop would fail)', async () => {
    const wrapper = mount(ResultRoundCard, {
      props: { roundNumber: 1, distance: 1200, entries: buildEntries() },
    })
    const reversed = [...buildEntries()].reverse().map((entry, index) => ({ ...entry, position: index + 1 }))
    await wrapper.setProps({ entries: reversed })
    const rows = wrapper.findAll('[data-test="result-row"]')
    expect(rows[0]?.text()).toContain(`Horse ${LANE_COUNT}`)
    expect(rows[LANE_COUNT - 1]?.text()).toContain('Horse 1')
  })
})
