import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProgramRoundCard from '../ProgramRoundCard.vue'
import { LANE_COUNT } from '../../domain/constants'
import type { Horse } from '../../domain/types'

const buildEntries = (): { laneIndex: number; horse: Horse }[] =>
  Array.from({ length: LANE_COUNT }, (_, laneIndex) => ({
    laneIndex,
    horse: { number: laneIndex + 1, name: `Horse ${laneIndex + 1}`, condition: 50 + laneIndex },
  }))

describe('ProgramRoundCard', () => {
  it('renders the round number, distance, and every entry in lane order (happy)', () => {
    const wrapper = mount(ProgramRoundCard, {
      props: { roundNumber: 2, distance: 1400, entries: buildEntries(), isCurrent: false },
    })
    expect(wrapper.text()).toContain('Round 2')
    expect(wrapper.text()).toContain('1400')
    const items = wrapper.findAll('[data-test="program-entry"]')
    expect(items).toHaveLength(LANE_COUNT)
    expect(items[0]?.text()).toContain('Horse 1')
    expect(items[LANE_COUNT - 1]?.text()).toContain(`Horse ${LANE_COUNT}`)
  })

  it('applies the current-round class iff isCurrent is true (edge)', async () => {
    const wrapper = mount(ProgramRoundCard, {
      props: { roundNumber: 1, distance: 1200, entries: buildEntries(), isCurrent: true },
    })
    expect(wrapper.classes()).toContain('program-round-card--current')

    await wrapper.setProps({ isCurrent: false })
    expect(wrapper.classes()).not.toContain('program-round-card--current')
  })

  it('reorders entries when the entries prop changes (sad — stub ignoring entries would fail)', async () => {
    const wrapper = mount(ProgramRoundCard, {
      props: { roundNumber: 1, distance: 1200, entries: buildEntries(), isCurrent: false },
    })
    const reversed = [...buildEntries()].reverse()
    await wrapper.setProps({ entries: reversed })
    const items = wrapper.findAll('[data-test="program-entry"]')
    expect(items[0]?.text()).toContain(`Horse ${LANE_COUNT}`)
    expect(items[LANE_COUNT - 1]?.text()).toContain('Horse 1')
  })

  it('hides entries and applies collapsed class when isCompleted (happy)', () => {
    const wrapper = mount(ProgramRoundCard, {
      props: {
        roundNumber: 1,
        distance: 1200,
        entries: buildEntries(),
        isCurrent: false,
        isCompleted: true,
      },
    })
    expect(wrapper.classes()).toContain('program-round-card--collapsed')
    expect(wrapper.findAll('[data-test="program-entry"]')).toHaveLength(0)
  })

  it('shows entries when isCompleted is false (edge)', () => {
    const wrapper = mount(ProgramRoundCard, {
      props: {
        roundNumber: 1,
        distance: 1200,
        entries: buildEntries(),
        isCurrent: true,
        isCompleted: false,
      },
    })
    expect(wrapper.classes()).not.toContain('program-round-card--collapsed')
    expect(wrapper.findAll('[data-test="program-entry"]')).toHaveLength(LANE_COUNT)
  })

  it('collapses regardless of isCurrent when isCompleted is true (sad — implementation ignoring isCompleted would fail)', () => {
    const wrapper = mount(ProgramRoundCard, {
      props: {
        roundNumber: 1,
        distance: 1200,
        entries: buildEntries(),
        isCurrent: true,
        isCompleted: true,
      },
    })
    expect(wrapper.findAll('[data-test="program-entry"]')).toHaveLength(0)
  })
})
