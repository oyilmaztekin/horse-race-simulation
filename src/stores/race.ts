import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  PHASE_FINISHED,
  PHASE_INITIAL,
  PHASE_RACING,
  PHASE_READY,
  PHASE_RESTING,
} from '../domain/constants'
import { assertEnoughFitHorses } from '../domain/conditionMutation'
import { generateProgram as generateProgramFn } from '../domain/programGenerator'
import { createRng } from '../domain/rng'
import type { Program, Ranking, Rng, RoundResult } from '../domain/types'
import { useHorsesStore } from './horses'

export type RaceState =
  | { kind: typeof PHASE_INITIAL }
  | { kind: typeof PHASE_RESTING; restingUntil: number }
  | { kind: typeof PHASE_READY; program: Program; rng: Rng; seed: number }
  | {
      kind: typeof PHASE_RACING
      program: Program
      rng: Rng
      seed: number
      currentRoundIndex: number
      results: RoundResult[]
    }
  | { kind: typeof PHASE_FINISHED; program: Program; seed: number; results: RoundResult[] }

export const useRaceStore = defineStore('race', () => {
  const state = ref<RaceState>({ kind: PHASE_INITIAL })

  const phase = computed(() => state.value.kind)
  const program = computed<Program | null>(() =>
    'program' in state.value ? state.value.program : null,
  )
  const currentRound = computed(() =>
    state.value.kind === PHASE_RACING
      ? state.value.program[state.value.currentRoundIndex]
      : null,
  )
  const currentRoundIndex = computed(() =>
    state.value.kind === PHASE_RACING ? state.value.currentRoundIndex : -1,
  )
  const results = computed<RoundResult[]>(() =>
    'results' in state.value ? state.value.results : [],
  )
  const restingUntil = computed<number | null>(() =>
    state.value.kind === PHASE_RESTING ? state.value.restingUntil : null,
  )
  const seed = computed<number | null>(() =>
    'seed' in state.value ? state.value.seed : null,
  )
  const currentRng = computed<Rng | null>(() =>
    state.value.kind === PHASE_RACING ? state.value.rng : null,
  )

  function generateProgram(seed: number = Date.now()): void {
    const horses = useHorsesStore()
    assertEnoughFitHorses(horses.horses)
    const meetingRng = createRng(seed)
    const program = generateProgramFn(horses.horses, meetingRng)
    state.value = { kind: PHASE_READY, program, rng: meetingRng, seed }
  }

  function resumeRestFromBoot(_restingUntil: number): void {
    // wired in a later cycle
  }

  function completeRound(_rankings: Ranking[]): Promise<void> {
    return Promise.resolve()
  }

  return {
    state,
    phase,
    program,
    currentRound,
    currentRoundIndex,
    results,
    restingUntil,
    seed,
    currentRng,
    generateProgram,
    resumeRestFromBoot,
    completeRound,
  }
})
