import type { Rng } from './types'

// mulberry32 PRNG: deterministic, 32-bit state, returns [0, 1).
// `>>> 0` keeps math in uint32; `Math.imul` is 32-bit integer multiply.
// Required by BUSINESS_LOGIC.md §3.4 — no Math.random() in domain/server.

const MULBERRY32_INCREMENT = 0x6d2b79f5
const FIRST_XORSHIFT_BITS = 15
const FIRST_ODDIFY_MASK = 1
const SECOND_XORSHIFT_BITS = 7
const SECOND_ODDIFY_MASK = 61
const FINAL_XORSHIFT_BITS = 14
const UINT32_RANGE = 2 ** 32

export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + MULBERRY32_INCREMENT) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> FIRST_XORSHIFT_BITS), t | FIRST_ODDIFY_MASK)
    t ^= t + Math.imul(t ^ (t >>> SECOND_XORSHIFT_BITS), t | SECOND_ODDIFY_MASK)
    return ((t ^ (t >>> FINAL_XORSHIFT_BITS)) >>> 0) / UINT32_RANGE
  }
}
