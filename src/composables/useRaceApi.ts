import { ApiError } from '../domain/errors'
import type { Horse, HorseId, HorsesEnvelope } from '../domain/types'

// Thin HTTP wrapper — Phase 5 tests drive the real implementation.
// Stores import this; test mocks override it via vi.mock.
export function useRaceApi() {
  async function getHorses(): Promise<HorsesEnvelope> {
    const response = await fetch('/api/horses')
    if (!response.ok) throw new ApiError(response.status, await response.text())
    return response.json() as Promise<HorsesEnvelope>
  }

  async function startRest(): Promise<HorsesEnvelope> {
    const response = await fetch('/api/horses/rest', { method: 'POST' })
    if (!response.ok) throw new ApiError(response.status, await response.text())
    return response.json() as Promise<HorsesEnvelope>
  }

  async function completeRound(raced: HorseId[]): Promise<Horse[]> {
    const response = await fetch('/api/rounds/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raced }),
    })
    if (!response.ok) throw new ApiError(response.status, await response.text())
    return response.json() as Promise<Horse[]>
  }

  return { getHorses, startRest, completeRound }
}
