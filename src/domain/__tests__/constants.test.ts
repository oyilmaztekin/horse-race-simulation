import { describe, expect, it } from 'vitest'
import { LANE_COLORS, LANE_COUNT } from '../constants'

describe('LANE_COLORS', () => {
  it('has exactly LANE_COUNT entries (happy — the invariant the runtime assertion guards)', () => {
    expect(LANE_COLORS).toHaveLength(LANE_COUNT)
  })

  it('every entry is a 7-char hex string starting with # (edge — shape)', () => {
    const hexShape = /^#[0-9A-Fa-f]{6}$/
    LANE_COLORS.forEach((color) => {
      expect(color).toMatch(hexShape)
    })
  })

  it('contains no duplicates (sad — a stub that reused one color would fail per BUSINESS_LOGIC.md §3.2 lane uniqueness)', () => {
    const unique = new Set(LANE_COLORS)
    expect(unique.size).toBe(LANE_COLORS.length)
  })
})
