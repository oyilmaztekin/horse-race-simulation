import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { PHASE_INITIAL } from '../../domain/constants'

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
