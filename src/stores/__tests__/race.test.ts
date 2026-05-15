import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  HORSE_COUNT,
  INTER_ROUND_DELAY_MS,
  LANE_COUNT,
  MIN_FIT_HORSES_FOR_PROGRAM,
  MIN_RACEABLE_CONDITION,
  PHASE_FINISHED,
  PHASE_INITIAL,
  PHASE_RACING,
  PHASE_READY,
  PHASE_RESTING,
  REST_DURATION_MS,
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

describe('useRaceStore — start()', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('transitions READY → RACING carrying program/rng/seed (happy)', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const race = useRaceStore()
    race.generateProgram(KNOWN_SEED)
    const readyProgram = race.program
    const readyRng = race.currentRng // null in READY — we'll assert via state below
    void readyRng

    race.start()

    expect(race.state.kind).toBe(PHASE_RACING)
    expect(race.phase).toBe(PHASE_RACING)
    expect(race.seed).toBe(KNOWN_SEED)
    expect(race.program).toBe(readyProgram)
    expect(race.currentRoundIndex).toBe(0)
    expect(race.results).toEqual([])
    expect(race.currentRng).not.toBeNull()
  })

  it('exposes currentRound = program[0] after start (edge: round index 0, not 1)', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const race = useRaceStore()
    race.generateProgram(KNOWN_SEED)

    race.start()

    expect(race.currentRound).not.toBeNull()
    expect(race.currentRound!.distance).toBe(ROUND_DISTANCES[0])
    expect(race.currentRound!.lanes).toHaveLength(LANE_COUNT)
  })

  it('throws InvalidTransitionError from INITIAL and leaves state unchanged (sad)', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const race = useRaceStore()

    let thrown: unknown
    try {
      race.start()
    } catch (caught) {
      thrown = caught
    }

    expect(thrown).toBeInstanceOf(InvalidTransitionError)
    expect((thrown as InvalidTransitionError).kind).toBe(PHASE_INITIAL)
    expect((thrown as InvalidTransitionError).action).toBe('start')
    expect(race.state.kind).toBe(PHASE_INITIAL)
  })
})

function emptyRankings(): import('../../domain/types').Ranking[] {
  return Array.from({ length: LANE_COUNT }, (_, index: number) => ({
    rank: index + 1,
    horseId: index + 1,
    lane: index + 1,
    finishTimeMs: 60_000 + index * 100,
  }))
}

describe('useRaceStore — completeRound()', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('POSTs raced lane ids, applies server roster, then advances to next round after wait (happy)', async () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const race = useRaceStore()
    race.generateProgram(KNOWN_SEED)
    race.start()

    const racedIds = race.currentRound!.lanes
    const fatiguedRoster: Horse[] = horses.horses.map((horse) => ({
      ...horse,
      condition: racedIds.includes(horse.number) ? horse.condition - 8 : horse.condition + 3,
    }))
    mockCompleteRound.mockResolvedValueOnce(fatiguedRoster)

    const pending = race.completeRound(emptyRankings())
    await vi.advanceTimersByTimeAsync(INTER_ROUND_DELAY_MS)
    await pending

    expect(mockCompleteRound).toHaveBeenCalledWith(racedIds)
    expect(horses.horses).toEqual(fatiguedRoster)
    expect(race.state.kind).toBe(PHASE_RACING)
    expect(race.currentRoundIndex).toBe(1)
    expect(race.results).toHaveLength(1)
    expect(race.results[0]!.roundNumber).toBe(1)
  })

  it('transitions to FINISHED after the last round without a wait (edge)', async () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const race = useRaceStore()
    race.generateProgram(KNOWN_SEED)
    race.start()
    race.state = {
      ...(race.state as Extract<typeof race.state, { kind: typeof PHASE_RACING }>),
      currentRoundIndex: ROUND_COUNT - 1,
    }

    mockCompleteRound.mockResolvedValueOnce(horses.horses)

    await race.completeRound(emptyRankings())

    expect(race.state.kind).toBe(PHASE_FINISHED)
    expect(race.results).toHaveLength(1)
    expect(race.results[0]!.roundNumber).toBe(ROUND_COUNT)
    expect(race.seed).toBe(KNOWN_SEED)
  })

  it('throws InvalidTransitionError when called outside RACING (sad)', async () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const race = useRaceStore()

    await expect(race.completeRound(emptyRankings())).rejects.toBeInstanceOf(
      InvalidTransitionError,
    )
    expect(race.state.kind).toBe(PHASE_INITIAL)
  })

  it('transitions to INITIAL when the POST rejects (sad: decision #23)', async () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const preFailureRoster = horses.horses
    const race = useRaceStore()
    race.generateProgram(KNOWN_SEED)
    race.start()

    mockCompleteRound.mockRejectedValueOnce(new Error('boom'))

    await race.completeRound(emptyRankings())

    expect(race.state.kind).toBe(PHASE_INITIAL)
    expect(race.results).toEqual([])
    expect(horses.horses).toEqual(preFailureRoster)
  })
})

describe('useRaceStore — rest()', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('transitions INITIAL → RESTING with envelope.restingUntil (happy)', async () => {
    vi.setSystemTime(FIXED_NOW_MS)
    const restEnd = FIXED_NOW_MS + REST_DURATION_MS
    mockStartRest.mockResolvedValueOnce({ horses: [], restingUntil: restEnd })
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const race = useRaceStore()

    await race.rest()

    expect(mockStartRest).toHaveBeenCalledOnce()
    expect(race.state.kind).toBe(PHASE_RESTING)
    expect(race.restingUntil).toBe(restEnd)
  })

  it('is reachable from FINISHED (edge: post-meeting rest)', async () => {
    vi.setSystemTime(FIXED_NOW_MS)
    const restEnd = FIXED_NOW_MS + REST_DURATION_MS
    mockStartRest.mockResolvedValueOnce({ horses: [], restingUntil: restEnd })
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const race = useRaceStore()
    const finishedProgram = generateProgramFn(horses.horses, createRng(KNOWN_SEED))
    race.state = {
      kind: PHASE_FINISHED,
      program: finishedProgram,
      seed: KNOWN_SEED,
      results: [],
    }

    await race.rest()

    expect(race.state.kind).toBe(PHASE_RESTING)
    expect(race.restingUntil).toBe(restEnd)
  })

  it('throws InvalidTransitionError from RACING (sad: no mid-meeting rest)', async () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const race = useRaceStore()
    race.generateProgram(KNOWN_SEED)
    race.start()

    await expect(race.rest()).rejects.toBeInstanceOf(InvalidTransitionError)
    expect(race.state.kind).toBe(PHASE_RACING)
    expect(mockStartRest).not.toHaveBeenCalled()
  })
})

describe('useRaceStore — completeRest()', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('transitions RESTING → INITIAL and applies the bumped roster (happy)', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const race = useRaceStore()
    race.state = { kind: PHASE_RESTING, restingUntil: FIXED_NOW_MS + 1000 }
    const bumped: Horse[] = makeFitRoster().map((horse) => ({
      ...horse,
      condition: MIN_RACEABLE_CONDITION,
    }))

    race.completeRest(bumped)

    expect(race.state.kind).toBe(PHASE_INITIAL)
    expect(race.restingUntil).toBeNull()
    expect(horses.horses).toEqual(bumped)
  })

  it('throws InvalidTransitionError when called outside RESTING (sad)', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const race = useRaceStore()

    expect(() => race.completeRest(makeFitRoster())).toThrow(InvalidTransitionError)
    expect(race.state.kind).toBe(PHASE_INITIAL)
  })

  it('rejects the call from RACING and preserves horses (sad: mid-meeting)', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const preCallRoster = horses.horses
    const race = useRaceStore()
    race.generateProgram(KNOWN_SEED)
    race.start()

    expect(() => race.completeRest(makeFitRoster())).toThrow(InvalidTransitionError)
    expect(horses.horses).toEqual(preCallRoster)
  })
})

describe('useRaceStore — resumeRestFromBoot()', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.setSystemTime(FIXED_NOW_MS)
  })

  it('transitions INITIAL → RESTING with the boot envelope timestamp (happy)', () => {
    const race = useRaceStore()
    const future = FIXED_NOW_MS + REST_DURATION_MS

    race.resumeRestFromBoot(future)

    expect(race.state.kind).toBe(PHASE_RESTING)
    expect(race.restingUntil).toBe(future)
  })

  it('no-ops when the timestamp is already past (edge: stale boot snapshot)', () => {
    const race = useRaceStore()

    race.resumeRestFromBoot(FIXED_NOW_MS - 1)

    expect(race.state.kind).toBe(PHASE_INITIAL)
  })

  it('no-ops when state is not INITIAL (sad: race already underway)', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const race = useRaceStore()
    race.generateProgram(KNOWN_SEED)

    race.resumeRestFromBoot(FIXED_NOW_MS + REST_DURATION_MS)

    expect(race.state.kind).toBe(PHASE_READY)
  })
})

describe('useRaceStore — derived gates (canGenerate / canStart / canRest / fitCount)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('INITIAL + fit roster → canGenerate true, canStart/canRest false, fitCount=HORSE_COUNT (happy)', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const race = useRaceStore()

    expect(race.fitCount).toBe(HORSE_COUNT)
    expect(race.canGenerate).toBe(true)
    expect(race.canStart).toBe(false)
    expect(race.canRest).toBe(false)
  })

  it('READY → canStart true, canGenerate still true (re-roll allowed), canRest false (edge)', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const race = useRaceStore()
    race.generateProgram(KNOWN_SEED)

    expect(race.canGenerate).toBe(true)
    expect(race.canStart).toBe(true)
    expect(race.canRest).toBe(false)
  })

  it('INITIAL + insufficient fit roster → canRest true, canStart false (edge: fit-gate triggered)', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeRosterWithFitCount(MIN_FIT_HORSES_FOR_PROGRAM - 1))
    const race = useRaceStore()

    expect(race.fitCount).toBe(MIN_FIT_HORSES_FOR_PROGRAM - 1)
    expect(race.canRest).toBe(true)
    expect(race.canStart).toBe(false)
  })

  it('RACING / RESTING / loading roster → all gates false (sad: all controls locked)', () => {
    const horses = useHorsesStore()
    horses.applyServerUpdate(makeFitRoster())
    const race = useRaceStore()
    race.generateProgram(KNOWN_SEED)
    race.start()

    expect(race.canGenerate).toBe(false)
    expect(race.canStart).toBe(false)
    expect(race.canRest).toBe(false)

    race.state = { kind: PHASE_RESTING, restingUntil: FIXED_NOW_MS + REST_DURATION_MS }
    expect(race.canGenerate).toBe(false)
    expect(race.canStart).toBe(false)
    expect(race.canRest).toBe(false)

    setActivePinia(createPinia())
    const loadingHorses = useHorsesStore()
    loadingHorses.$patch({ isLoading: true })
    const loadingRace = useRaceStore()
    expect(loadingRace.canGenerate).toBe(false)
    expect(loadingRace.canStart).toBe(false)
    expect(loadingRace.canRest).toBe(false)
  })
})
