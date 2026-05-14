import { describe, expect, it, vi } from 'vitest'
import { wait } from '../wait'

describe('wait', () => {
  it('resolves after the requested duration under fake timers (happy)', async () => {
    let resolved = false
    const pending = wait(1500).then(() => {
      resolved = true
    })
    await vi.advanceTimersByTimeAsync(1500)
    await pending
    expect(resolved).toBe(true)
  })

  it('still returns a Promise that eventually resolves when ms === 0 (edge — boundary)', async () => {
    let resolved = false
    const pending = wait(0).then(() => {
      resolved = true
    })
    await vi.advanceTimersByTimeAsync(0)
    await pending
    expect(resolved).toBe(true)
  })

  it('does not resolve before the duration elapses (sad — a stub `() => Promise.resolve()` would fail)', async () => {
    let resolved = false
    void wait(1500).then(() => {
      resolved = true
    })
    await vi.advanceTimersByTimeAsync(1499)
    expect(resolved).toBe(false)
  })
})
