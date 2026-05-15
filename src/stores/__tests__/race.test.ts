import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  HORSE_COUNT,
  LANE_COUNT,
  MIN_FIT_HORSES_FOR_PROGRAM,
  MIN_RACEABLE_CONDITION,
  PHASE_FINISHED,
  PHASE_INITIAL,
  PHASE_RACING,
  PHASE_READY,
  PHASE_RESTING,
  ROUND_COUNT,
  ROUND_DISTANCES,
} from '../../domain/constants'
import { InvalidTransitionError, NotEnoughFitHorsesError } from '../../domain/errors'
import { createRng } from '../../domain/rng'
import { generateProgram as generateProgramFn } from '../../domain/programGenerator'
import type { Horse } from '../../domain/types'
import { useHorsesStore } from '../horses'

// --- module mocks (must be before store import) ---

const mockGetHorses = vi.fn()
const mockStartRest = vi.fn()
const mockCompleteRound = vi.fn()

vi.mock('../../composables/useRaceApi', () => ({
  useRaceApi: () => ({
    getHorses: mockGetHorses,
    startRest: mockStartRest,
    completeRound: mockCompleteRound,
  }),
}))

// Import store after mocks are registered.
import { useRaceStore } from '../race'

const FIT_CONDITION = 80
const KNOWN_SEED = 0xC0FFEE
const OTHER_SEED = 0xBADBEEF
const FIXED_NOW_MS = 1_700_000_000_000

function makeFitRoster(): Horse[] {
  return Array.from({ length: HORSE_COUNT }, (_, index: number) => ({
    number: index + 1,
    name: `Horse ${index + 1}`,
    condition: FIT_CONDITION,
  }))
}

function makeRosterWithFitCount(fitCount: number): Horse[] {
  return Array.from({ length: HORSE_COUNT }, (_, index: number) => ({
    number: index + 1,
    name: `Horse ${index + 1}`,
    condition: index < fitCount ? FIT_CONDITION : MIN_RACEABLE_CONDITION - 1,
  }))
}

describe('useRaceStore — initial state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('starts in INITIAL kind (happy path)', () => {
    const race = useRaceStore()
    expect(race.state.kind).toBe(PHASE_INITIAL)
  })

  it('exposes phase computed mirroring state.kind (edge: phase is a thin derivation)', () => {
    const race = useRaceStore()
    expect(race.phase).toBe(PHASE_INITIAL)
  })

  it('exposes neutral derivations in INITIAL (sad: a stub returning random shapes would fail)', () => {
    const race = useRaceStore()
    expect(race.program).toBeNull()
    expect(race.currentRound).toBeNull()
    expect(race.currentRoundIndex).toBe(-1)
    expect(race.results).toEqual([])
    expect(race.restingUntil).toBeNull()
    expect(race.seed).toBeNull()
    expect(race.currentRng).toBeNull()
  })
})

describe('useRaceStore — generateProgram (happy path)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('transitions INITIAL → READY with a full program when the roster is fit', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())

    const race = useRaceStore()
    race.generateProgram(KNOWN_SEED)

    expect(race.state.kind).toBe(PHASE_READY)
    expect(race.phase).toBe(PHASE_READY)
    expect(race.seed).toBe(KNOWN_SEED)

    expect(race.program).not.toBeNull()
    expect(race.program).toHaveLength(ROUND_COUNT)
    race.program!.forEach((round, index) => {
      expect(round.distance).toBe(ROUND_DISTANCES[index])
      expect(round.lanes).toHaveLength(LANE_COUNT)
    })
  })

  it('defaults seed to Date.now() when called with no argument (edge: default arg)', () => {
    vi.setSystemTime(FIXED_NOW_MS)
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())

    const race = useRaceStore()
    race.generateProgram()

    expect(race.seed).toBe(FIXED_NOW_MS)
  })

  it('rethrows NotEnoughFitHorsesError from the domain guard and stays in INITIAL', () => {
    const horses = useHorsesStore()
    const fitCount = MIN_FIT_HORSES_FOR_PROGRAM - 1
    horses.applyServerUpdate(makeRosterWithFitCount(fitCount))

    const race = useRaceStore()
    let thrown: unknown
    try {
      race.generateProgram(KNOWN_SEED)
    } catch (caught) {
      thrown = caught
    }

    expect(thrown).toBeInstanceOf(NotEnoughFitHorsesError)
    expect((thrown as NotEnoughFitHorsesError).fitCount).toBe(fitCount)
    expect(race.state.kind).toBe(PHASE_INITIAL)
  })

  it('produces different programs for different seeds (sad: a constant-RNG stub would fail)', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())

    const raceA = useRaceStore()
    raceA.generateProgram(KNOWN_SEED)
    const lanesA = raceA.program!.map((round) => round.lanes.join(','))

    setActivePinia(createPinia())
    useHorsesStore().applyServerUpdate(makeFitRoster())
    const raceB = useRaceStore()
    raceB.generateProgram(OTHER_SEED)
    const lanesB = raceB.program!.map((round) => round.lanes.join(','))

    expect(lanesA).not.toEqual(lanesB)
  })
})

describe('useRaceStore — generateProgram phase guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('re-rolls in place when called from READY (happy: re-roll is allowed)', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())

    const race = useRaceStore()
    race.generateProgram(KNOWN_SEED)
    const firstLanes = race.program!.map((round) => round.lanes.join(','))

    race.generateProgram(OTHER_SEED)

    expect(race.state.kind).toBe(PHASE_READY)
    expect(race.seed).toBe(OTHER_SEED)
    const secondLanes = race.program!.map((round) => round.lanes.join(','))
    expect(secondLanes).not.toEqual(firstLanes)
  })

  it('transitions FINISHED → READY and clears prior results (edge: post-meeting re-generation)', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())

    const race = useRaceStore()
    const priorRng = createRng(KNOWN_SEED)
    const priorProgram = generateProgramFn(horses.horses, priorRng)
    race.state = {
      kind: PHASE_FINISHED,
      program: priorProgram,
      seed: KNOWN_SEED,
      results: [{ roundNumber: 1, rankings: [] }],
    }

    race.generateProgram(OTHER_SEED)

    expect(race.state.kind).toBe(PHASE_READY)
    expect(race.seed).toBe(OTHER_SEED)
    expect(race.results).toEqual([])
  })

  it('throws InvalidTransitionError when called from RACING (sad: meeting in flight)', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())

    const race = useRaceStore()
    const racingRng = createRng(KNOWN_SEED)
    const racingProgram = generateProgramFn(horses.horses, racingRng)
    race.state = {
      kind: PHASE_RACING,
      program: racingProgram,
      rng: racingRng,
      seed: KNOWN_SEED,
      currentRoundIndex: 2,
      results: [],
    }

    let thrown: unknown
    try {
      race.generateProgram(OTHER_SEED)
    } catch (caught) {
      thrown = caught
    }

    expect(thrown).toBeInstanceOf(InvalidTransitionError)
    expect((thrown as InvalidTransitionError).kind).toBe(PHASE_RACING)
    expect((thrown as InvalidTransitionError).action).toBe('generateProgram')
    expect(race.state.kind).toBe(PHASE_RACING)
  })

  it('throws InvalidTransitionError when called from RESTING (sad: rest in flight)', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())

    const race = useRaceStore()
    race.state = { kind: PHASE_RESTING, restingUntil: FIXED_NOW_MS + 10_000 }

    let thrown: unknown
    try {
      race.generateProgram(OTHER_SEED)
    } catch (caught) {
      thrown = caught
    }

    expect(thrown).toBeInstanceOf(InvalidTransitionError)
    expect((thrown as InvalidTransitionError).kind).toBe(PHASE_RESTING)
    expect(race.state.kind).toBe(PHASE_RESTING)
  })
})
