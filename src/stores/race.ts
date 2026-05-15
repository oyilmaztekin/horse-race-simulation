// Stub — full implementation driven by src/stores/__tests__/race.test.ts (Phase 4).
// Exported here so horses.ts can import the type without a circular-at-test-time error.
import { defineStore } from 'pinia'

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const useRaceStore = defineStore('race', () => {
  function resumeRestFromBoot(_restingUntil: number): void {}
  return { resumeRestFromBoot }
})
