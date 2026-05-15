import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  HORSE_COUNT,
  INTER_ROUND_DELAY_MS,
  MIN_FIT_HORSES_FOR_PROGRAM,
  PHASE_FINISHED,
  PHASE_INITIAL,
  PHASE_RACING,
  PHASE_READY,
  PHASE_RESTING,
  ROUND_COUNT,
  SIM_SPEED_DEFAULT,
  SIM_SPEED_MAX,
  SIM_SPEED_MIN,
  SIM_SPEED_STEP,
} from '../domain/constants'
import { assertEnoughFitHorses, countFitHorses } from '../domain/conditionMutation'
import { InvalidTransitionError } from '../domain/errors'
import { generateProgram as generateProgramFn } from '../domain/programGenerator'
import { createRng } from '../domain/rng'
import type { Horse, Program, Ranking, Rng, RoundResult } from '../domain/types'
import { wait } from '../domain/wait'
import { useRaceApi } from '../composables/useRaceApi'
import { useHorsesStore } from './horses'

export type RaceState =
  | { kind: typeof PHASE_INITIAL }
  | { kind: typeof PHASE_RESTING; restingUntil: number; remainingRestMs: number }
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

  // Reviewer-facing sim-speed control (Phase 12.2). Scales the rAF accumulator
  // in useRaceSimulation; never touches inter-round pauses or server-driven rest.
  const simSpeedMultiplier = ref<number>(SIM_SPEED_DEFAULT)

  function snapToStep(value: number): number {
    const clamped = Math.min(SIM_SPEED_MAX, Math.max(SIM_SPEED_MIN, value))
    return Math.round(clamped / SIM_SPEED_STEP) * SIM_SPEED_STEP
  }

  function increaseSimSpeed(): void {
    simSpeedMultiplier.value = snapToStep(simSpeedMultiplier.value + SIM_SPEED_STEP)
  }

  function decreaseSimSpeed(): void {
    simSpeedMultiplier.value = snapToStep(simSpeedMultiplier.value - SIM_SPEED_STEP)
  }

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
  // Display value driven by the server: each rest poll calls applyRestObservation()
  // with the server-computed remainingRestMs. The component renders this directly,
  // so no Date.now() math lives on the client (BUSINESS_LOGIC.md §4.7).
  const restingMsRemaining = computed<number | null>(() =>
    state.value.kind === PHASE_RESTING ? state.value.remainingRestMs : null,
  )
  const seed = computed<number | null>(() =>
    'seed' in state.value ? state.value.seed : null,
  )
  const currentRng = computed<Rng | null>(() =>
    state.value.kind === PHASE_RACING ? state.value.rng : null,
  )

  const fitCount = computed<number>(() => {
    const horses = useHorsesStore()
    return countFitHorses(horses.horses)
  })
  const isRosterReady = computed<boolean>(() => {
    const horses = useHorsesStore()
    return !horses.isLoading && horses.horses.length === HORSE_COUNT
  })
  const canGenerate = computed<boolean>(() => {
    if (!isRosterReady.value) return false
    const kind = state.value.kind
    return kind === PHASE_INITIAL || kind === PHASE_READY || kind === PHASE_FINISHED
  })
  const canStart = computed<boolean>(
    () => isRosterReady.value && state.value.kind === PHASE_READY,
  )
  const canRest = computed<boolean>(() => {
    if (!isRosterReady.value) return false
    const kind = state.value.kind
    const allowedPhase = kind === PHASE_INITIAL || kind === PHASE_FINISHED
    return allowedPhase && fitCount.value < MIN_FIT_HORSES_FOR_PROGRAM
  })

  function generateProgram(seed: number = Date.now()): void {
    const currentKind = state.value.kind
    if (currentKind === PHASE_RACING || currentKind === PHASE_RESTING) {
      throw new InvalidTransitionError(currentKind, 'generateProgram')
    }
    const horses = useHorsesStore()
    assertEnoughFitHorses(horses.horses)
    const meetingRng = createRng(seed)
    const program = generateProgramFn(horses.horses, meetingRng)
    state.value = { kind: PHASE_READY, program, rng: meetingRng, seed }
  }

  async function rest(): Promise<void> {
    const currentKind = state.value.kind
    if (currentKind !== PHASE_INITIAL && currentKind !== PHASE_FINISHED) {
      throw new InvalidTransitionError(currentKind, 'rest')
    }
    const envelope = await useRaceApi().startRest()
    state.value = {
      kind: PHASE_RESTING,
      restingUntil: envelope.restingUntil ?? Date.now(),
      remainingRestMs: envelope.remainingRestMs ?? 0,
    }
  }

  // Refresh the displayed countdown with the latest server-polled value.
  // Called by useRestPolling on every successful GET /api/horses tick.
  function applyRestObservation(remainingRestMs: number): void {
    if (state.value.kind !== PHASE_RESTING) return
    state.value = { ...state.value, remainingRestMs }
  }

  function start(): void {
    const current = state.value
    if (current.kind !== PHASE_READY) {
      throw new InvalidTransitionError(current.kind, 'start')
    }
    state.value = {
      kind: PHASE_RACING,
      program: current.program,
      rng: current.rng,
      seed: current.seed,
      currentRoundIndex: 0,
      results: [],
    }
  }

  function completeRest(updated: Horse[]): void {
    if (state.value.kind !== PHASE_RESTING) {
      throw new InvalidTransitionError(state.value.kind, 'completeRest')
    }
    useHorsesStore().applyServerUpdate(updated)
    state.value = { kind: PHASE_INITIAL }
  }

  function resumeRestFromBoot(restingUntil: number, remainingRestMs: number): void {
    if (state.value.kind !== PHASE_INITIAL) return
    if (remainingRestMs <= 0) return
    state.value = { kind: PHASE_RESTING, restingUntil, remainingRestMs }
  }

  async function completeRound(rankings: Ranking[]): Promise<void> {
    const current = state.value
    if (current.kind !== PHASE_RACING) {
      throw new InvalidTransitionError(current.kind, 'completeRound')
    }
    const roundNumber = current.currentRoundIndex + 1
    const racedIds = current.program[current.currentRoundIndex]!.lanes
    const newResults: RoundResult[] = [...current.results, { roundNumber, rankings }]
    const api = useRaceApi()
    const horses = useHorsesStore()
    let updated
    try {
      updated = await api.completeRound(racedIds)
    } catch {
      state.value = { kind: PHASE_INITIAL }
      return
    }
    horses.applyServerUpdate(updated)
    const isLastRound = current.currentRoundIndex === ROUND_COUNT - 1
    if (isLastRound) {
      state.value = {
        kind: PHASE_FINISHED,
        program: current.program,
        seed: current.seed,
        results: newResults,
      }
      return
    }
    await wait(INTER_ROUND_DELAY_MS)
    state.value = {
      kind: PHASE_RACING,
      program: current.program,
      rng: current.rng,
      seed: current.seed,
      currentRoundIndex: current.currentRoundIndex + 1,
      results: newResults,
    }
  }

  return {
    state,
    phase,
    program,
    currentRound,
    currentRoundIndex,
    results,
    restingUntil,
    restingMsRemaining,
    seed,
    currentRng,
    fitCount,
    canGenerate,
    canStart,
    canRest,
    simSpeedMultiplier,
    increaseSimSpeed,
    decreaseSimSpeed,
    generateProgram,
    start,
    rest,
    completeRest,
    resumeRestFromBoot,
    applyRestObservation,
    completeRound,
  }
})
