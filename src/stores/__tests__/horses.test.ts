import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { CONDITION_MIN } from '../../domain/constants'
import type { Horse, HorsesEnvelope } from '../../domain/types'

// --- module mocks (must be before store import) ---

const mockGetHorses = vi.fn<() => Promise<HorsesEnvelope>>()
const mockStartRest = vi.fn<() => Promise<HorsesEnvelope>>()
const mockCompleteRound = vi.fn<(raced: number[]) => Promise<Horse[]>>()

vi.mock('../../composables/useRaceApi', () => ({
  useRaceApi: () => ({
    getHorses: mockGetHorses,
    startRest: mockStartRest,
    completeRound: mockCompleteRound,
  }),
}))

const mockResumeRestFromBoot = vi.fn<(restingUntil: number, remainingRestMs: number) => void>()

vi.mock('../race', () => ({
  useRaceStore: () => ({ resumeRestFromBoot: mockResumeRestFromBoot }),
}))

// Import store after mocks are registered
import { useHorsesStore } from '../horses'

// ---------------------------------------------------------------------------

const horse1: Horse = { number: 1, name: 'Thunderbolt', condition: 75 }
const horse2: Horse = { number: 2, name: 'Stormwind', condition: 60 }

describe('useHorsesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // --- fetchAll ---

  describe('fetchAll', () => {
    it('populates horses and clears isLoading/error on success (happy path)', async () => {
      const envelope: HorsesEnvelope = { horses: [horse1, horse2], restingUntil: null, remainingRestMs: null }
      mockGetHorses.mockResolvedValue(envelope)

      const store = useHorsesStore()
      await store.fetchAll()

      expect(store.horses).toEqual([horse1, horse2])
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('calls race.resumeRestFromBoot with the timestamp when envelope has non-null restingUntil (edge)', async () => {
      const futureMs = Date.now() + 8_000
      const envelope: HorsesEnvelope = { horses: [horse1], restingUntil: futureMs, remainingRestMs: 8_000 }
      mockGetHorses.mockResolvedValue(envelope)

      const store = useHorsesStore()
      await store.fetchAll()

      expect(mockResumeRestFromBoot).toHaveBeenCalledWith(futureMs, 8_000)
      expect(mockResumeRestFromBoot).toHaveBeenCalledTimes(1)
    })

    it('sets error and clears isLoading when the API call rejects (sad path)', async () => {
      const networkError = new Error('network failure')
      mockGetHorses.mockRejectedValue(networkError)

      const store = useHorsesStore()
      await store.fetchAll()

      expect(store.error).toBe(networkError)
      expect(store.isLoading).toBe(false)
      expect(store.horses).toHaveLength(0)
    })
  })

  // --- applyServerUpdate ---

  describe('applyServerUpdate', () => {
    it('replaces the horses array wholesale (happy path)', () => {
      const store = useHorsesStore()
      store.applyServerUpdate([horse1])
      expect(store.horses).toEqual([horse1])

      store.applyServerUpdate([horse2])
      expect(store.horses).toEqual([horse2])
    })

    it('accepts an empty array and clears the roster (edge: empty update)', () => {
      const store = useHorsesStore()
      store.applyServerUpdate([horse1, horse2])
      store.applyServerUpdate([])
      expect(store.horses).toHaveLength(0)
    })

    it('result differs when called with different arrays (sad: a no-op stub would fail)', () => {
      const store = useHorsesStore()
      store.applyServerUpdate([horse1])
      const first = store.horses.slice()

      store.applyServerUpdate([horse2])
      expect(store.horses).not.toEqual(first)
    })
  })

  // --- byId ---

  describe('byId', () => {
    it('returns the horse matching the given number (happy path)', () => {
      const store = useHorsesStore()
      store.applyServerUpdate([horse1, horse2])

      expect(store.byId(1)).toEqual(horse1)
      expect(store.byId(2)).toEqual(horse2)
    })

    it('returns undefined for a number not in the roster (edge: miss)', () => {
      const store = useHorsesStore()
      store.applyServerUpdate([horse1])

      expect(store.byId(99)).toBeUndefined()
    })

    it('returns undefined when the roster is empty (sad: empty state)', () => {
      const store = useHorsesStore()
      expect(store.byId(1)).toBeUndefined()
    })
  })

  // --- conditionLookup ---

  describe('conditionLookup', () => {
    it('returns the condition of a known horse (happy path)', () => {
      const store = useHorsesStore()
      store.applyServerUpdate([horse1])

      expect(store.conditionLookup(1)).toBe(75)
    })

    it('returns CONDITION_MIN for an unknown horse number (edge: miss → floor)', () => {
      const store = useHorsesStore()
      expect(store.conditionLookup(99)).toBe(CONDITION_MIN)
    })

    it('differs from CONDITION_MIN when the horse has a higher condition (sad: stub returning CONDITION_MIN always would fail)', () => {
      const fitHorse: Horse = { number: 7, name: 'Ironhooves', condition: 80 }
      const store = useHorsesStore()
      store.applyServerUpdate([fitHorse])

      expect(store.conditionLookup(7)).toBeGreaterThan(CONDITION_MIN)
    })
  })
})
