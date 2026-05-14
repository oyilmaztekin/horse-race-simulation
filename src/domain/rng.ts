import type { Rng } from './types'

// RNG: Random Number Generator. A function that returns a pseudorandom number in [0, 1).
// mulberry32 PRNG: deterministic, 32-bit state, returns [0, 1).
// `>>> 0` keeps math in uint32; `Math.imul` is 32-bit integer multiply.
// Required by BUSINESS_LOGIC.md §3.4 — no Math.random() in domain/server.
// it implements a specific algorithm called mulberry32 — a fast, deterministic pseudo-random number generator
// realistic rather than perfectly ordered.
// The race simulation needs randomness to model horse speed jitter 
// — each tick a horse's speed varies slightly, making races feel


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
