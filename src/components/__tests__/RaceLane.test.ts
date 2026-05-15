import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RaceLane from '../RaceLane.vue'
import HorseSprite from '../HorseSprite.vue'
import { LANE_COLORS } from '../../domain/constants'
import type { Horse } from '../../domain/types'

const HORSE: Horse = { number: 3, name: 'Comet', condition: 65 }

describe('RaceLane', () => {
  it('passes the lane color from LANE_COLORS[laneIndex] to HorseSprite (happy)', () => {
    const wrapper = mount(RaceLane, {
      props: { laneIndex: 0, horse: HORSE, positionM: 0, distanceM: 1200 },
    })
    const sprite = wrapper.findComponent(HorseSprite)
    expect(sprite.exists()).toBe(true)
    expect(sprite.props('color')).toBe(LANE_COLORS[0])
    expect(sprite.props('condition')).toBe(HORSE.condition)
  })

  it('converts meters to progress = positionM / distanceM (edge: 0, midpoint, finish)', async () => {
    const wrapper = mount(RaceLane, {
      props: { laneIndex: 4, horse: HORSE, positionM: 0, distanceM: 1600 },
    })
    const sprite = wrapper.findComponent(HorseSprite)
    expect(sprite.props('progress')).toBe(0)

    await wrapper.setProps({ positionM: 800 })
    expect(sprite.props('progress')).toBe(0.5)

    await wrapper.setProps({ positionM: 1600 })
    expect(sprite.props('progress')).toBe(1)
  })

  it('uses a different color for a different lane index (sad — stub returning a fixed color would fail)', () => {
    const a = mount(RaceLane, { props: { laneIndex: 0, horse: HORSE, positionM: 0, distanceM: 1200 } })
    const b = mount(RaceLane, { props: { laneIndex: 5, horse: HORSE, positionM: 0, distanceM: 1200 } })
    const colorA = a.findComponent(HorseSprite).props('color')
    const colorB = b.findComponent(HorseSprite).props('color')
    expect(colorA).toBe(LANE_COLORS[0])
    expect(colorB).toBe(LANE_COLORS[5])
    expect(colorA).not.toBe(colorB)
  })
})
