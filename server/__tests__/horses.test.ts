// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { PrismaClient } from '@prisma/client'
import { createHorsesRouter } from '../routes/horses'
import { createMockDb, makeHorses } from './helpers'
import { MIN_RACEABLE_CONDITION, REST_DURATION_MS } from '../../src/domain/constants'
import type { HorsesEnvelope } from '../../src/domain/types'

function makeApp(db: ReturnType<typeof createMockDb>) {
  const app = new Hono()
  app.route('/api/horses', createHorsesRouter(db as unknown as PrismaClient))
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/horses', () => {
  it('returns envelope with horses and null restingUntil when no rest is active', async () => {
    const horses = makeHorses()
    const db = createMockDb(horses, null)
    const res = await makeApp(db).request('/api/horses')

    expect(res.status).toBe(200)
    const body: HorsesEnvelope = await res.json()
    expect(body.horses).toHaveLength(20)
    expect(body.restingUntil).toBeNull()
  })

  it('returns current restingUntil epoch millis when a rest is in progress', async () => {
    const future = new Date(Date.now() + REST_DURATION_MS)
    const db = createMockDb(makeHorses(), future)
    const res = await makeApp(db).request('/api/horses')

    const body: HorsesEnvelope = await res.json()
    expect(body.restingUntil).toBe(future.getTime())
  })

  it('lazy-bumps unfit horses and clears restingUntil when timer has elapsed', async () => {
    const unfitHorses = makeHorses(20)
    const past = new Date(Date.now() - 1)
    const db = createMockDb(unfitHorses, past)

    const res = await makeApp(db).request('/api/horses')
    const body: HorsesEnvelope = await res.json()

    expect(body.restingUntil).toBeNull()
    expect(body.horses.every((horse) => horse.condition >= MIN_RACEABLE_CONDITION)).toBe(true)
    expect(db.appState.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { restingUntil: null } })
  })

  it('does not bump fit horses during lazy-bump', async () => {
    const fitHorses = makeHorses(90)
    const past = new Date(Date.now() - 1)
    const db = createMockDb(fitHorses, past)

    const res = await makeApp(db).request('/api/horses')
    const body: HorsesEnvelope = await res.json()

    expect(body.horses.every((horse) => horse.condition === 90)).toBe(true)
  })

  it('does not lazy-bump when restingUntil is still in the future', async () => {
    const unfitHorses = makeHorses(20)
    const future = new Date(Date.now() + REST_DURATION_MS)
    const db = createMockDb(unfitHorses, future)

    const res = await makeApp(db).request('/api/horses')
    const body: HorsesEnvelope = await res.json()

    expect(body.horses.every((horse) => horse.condition === 20)).toBe(true)
    expect(db.horse.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/horses/rest', () => {
  it('sets restingUntil to now + REST_DURATION_MS and returns envelope', async () => {
    const horses = makeHorses()
    const db = createMockDb(horses, null)
    const before = Date.now()

    const res = await makeApp(db).request('/api/horses/rest', { method: 'POST' })
    expect(res.status).toBe(200)
    const body: HorsesEnvelope = await res.json()

    expect(body.restingUntil).toBeGreaterThanOrEqual(before + REST_DURATION_MS - 50)
    expect(body.restingUntil).toBeLessThanOrEqual(Date.now() + REST_DURATION_MS + 50)
    expect(db.appState.upsert).toHaveBeenCalled()
  })

  it('is idempotent: returns existing restingUntil without calling upsert again', async () => {
    const future = new Date(Date.now() + REST_DURATION_MS)
    const db = createMockDb(makeHorses(), future)

    const res = await makeApp(db).request('/api/horses/rest', { method: 'POST' })
    const body: HorsesEnvelope = await res.json()

    expect(body.restingUntil).toBe(future.getTime())
    expect(db.appState.upsert).not.toHaveBeenCalled()
  })

  it('starts a new rest when the previous rest has already elapsed', async () => {
    const past = new Date(Date.now() - 1)
    const db = createMockDb(makeHorses(), past)
    const before = Date.now()

    const res = await makeApp(db).request('/api/horses/rest', { method: 'POST' })
    const body: HorsesEnvelope = await res.json()

    expect(body.restingUntil).toBeGreaterThan(before)
    expect(db.appState.upsert).toHaveBeenCalled()
  })
})
