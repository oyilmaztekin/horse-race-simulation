import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRaceApi } from '../useRaceApi'
import { ApiError } from '../../domain/errors'
import type { Horse, HorsesEnvelope } from '../../domain/types'

const SAMPLE_HORSE: Horse = { number: 1, name: 'Lightning', condition: 80 }
const ENVELOPE: HorsesEnvelope = { horses: [SAMPLE_HORSE], restingUntil: null }

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

function errorResponse(status: number, text: string): Response {
  return new Response(text, { status })
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useRaceApi.getHorses', () => {
  it('GETs /api/horses and returns the envelope', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(ENVELOPE))
    const api = useRaceApi()
    const result = await api.getHorses()
    expect(fetchSpy).toHaveBeenCalledWith('/api/horses')
    expect(result).toEqual(ENVELOPE)
  })

  it('preserves a non-null restingUntil from the envelope', async () => {
    const future = new Date('2030-01-01T00:00:00Z').toISOString()
    fetchSpy.mockResolvedValueOnce(jsonResponse({ horses: [], restingUntil: future }))
    const api = useRaceApi()
    const result = await api.getHorses()
    expect(result.restingUntil).toBe(future)
    expect(result.horses).toEqual([])
  })

  it('throws ApiError with status and body on non-2xx', async () => {
    fetchSpy.mockResolvedValue(errorResponse(500, 'boom'))
    const api = useRaceApi()
    const thrown = await api.getHorses().catch((error) => error)
    expect(thrown).toBeInstanceOf(ApiError)
    expect(thrown).toMatchObject({ status: 500, body: 'boom' })
  })
})

describe('useRaceApi.startRest', () => {
  it('POSTs /api/horses/rest and returns the envelope', async () => {
    const future = new Date('2030-01-01T00:00:00Z').toISOString()
    fetchSpy.mockResolvedValueOnce(jsonResponse({ horses: [SAMPLE_HORSE], restingUntil: future }))
    const api = useRaceApi()
    const result = await api.startRest()
    expect(fetchSpy).toHaveBeenCalledWith('/api/horses/rest', { method: 'POST' })
    expect(result.restingUntil).toBe(future)
    expect(result.horses).toEqual([SAMPLE_HORSE])
  })

  it('accepts a null restingUntil envelope (idempotent no-op response)', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(ENVELOPE))
    const api = useRaceApi()
    const result = await api.startRest()
    expect(result).toEqual(ENVELOPE)
  })

  it('throws ApiError on non-2xx', async () => {
    fetchSpy.mockResolvedValueOnce(errorResponse(409, 'conflict'))
    const api = useRaceApi()
    await expect(api.startRest()).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      body: 'conflict',
    })
  })
})

describe('useRaceApi.completeRound', () => {
  it('POSTs /api/rounds/complete with raced ids as JSON and returns horses', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse([SAMPLE_HORSE]))
    const api = useRaceApi()
    const result = await api.completeRound([1, 2, 3])
    expect(fetchSpy).toHaveBeenCalledWith('/api/rounds/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raced: [1, 2, 3] }),
    })
    expect(result).toEqual([SAMPLE_HORSE])
  })

  it('supports an empty raced list (all-recovery round shape)', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse([]))
    const api = useRaceApi()
    const result = await api.completeRound([])
    const lastCall = fetchSpy.mock.calls.at(-1)
    expect(lastCall?.[1]).toMatchObject({ body: JSON.stringify({ raced: [] }) })
    expect(result).toEqual([])
  })

  it('throws ApiError on non-2xx', async () => {
    fetchSpy.mockResolvedValueOnce(errorResponse(400, 'invalid raced'))
    const api = useRaceApi()
    await expect(api.completeRound([1])).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      body: 'invalid raced',
    })
  })
})
