// Promise wrapper over setTimeout, driven by fake timers in tests
// (ARCHITECTURE.md §16.7). Used for INTER_ROUND_DELAY_MS between rounds.
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
