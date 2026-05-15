// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { PrismaClient } from '@prisma/client'
import { createRoundsRouter } from '../routes/rounds'
import { createMockDb, makeHorses } from './helpers'
import { FATIGUE_PER_RACE, RECOVERY_PER_REST, CONDITION_MAX } from '../../src/domain/constants'
import type { Horse } from '../../src/domain/types'

function makeApp(db: ReturnType<typeof createMockDb>) {
  const app = new Hono()
  app.route('/api/rounds', createRoundsRouter(db as unknown as PrismaClient))
  return app
}

function post(app: Hono, body: object) {
  return app.request('/api/rounds/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/rounds/complete', () => {
  it('returns the full updated roster as a flat Horse array', async () => {
    const horses = makeHorses(80)
    const db = createMockDb(horses)
    db.horse.findMany.mockResolvedValue(horses)

    const res = await post(makeApp(db), { raced: [1, 2] })
    expect(res.status).toBe(200)
    const body: Horse[] = await res.json()
    expect(body).toHaveLength(20)
  })

  it('applies fatigue to raced horses and persists via update', async () => {
    const horses = makeHorses(80)
    const db = createMockDb(horses)

    await post(makeApp(db), { raced: [1, 2, 3] })

    const updateCalls: { where: { number: number }; data: { condition: number } }[] =
      db.horse.update.mock.calls.map((c: unknown[]) => c[0] as { where: { number: number }; data: { condition: number } })

    const racedUpdates = updateCalls.filter((c) => [1, 2, 3].includes(c.where.number))
    expect(racedUpdates.every((c) => c.data.condition === 80 - FATIGUE_PER_RACE)).toBe(true)
  })

  it('applies recovery to horses that did not race', async () => {
    const horses = makeHorses(80)
    const db = createMockDb(horses)

    await post(makeApp(db), { raced: [1] })

    const updateCalls: { where: { number: number }; data: { condition: number } }[] =
      db.horse.update.mock.calls.map((c: unknown[]) => c[0] as { where: { number: number }; data: { condition: number } })

    const restedUpdates = updateCalls.filter((c) => c.where.number !== 1)
    expect(restedUpdates.every((c) => c.data.condition === 80 + RECOVERY_PER_REST)).toBe(true)
  })

  it('clamps condition at CONDITION_MAX for already-fit horses recovering', async () => {
    const horses = makeHorses(CONDITION_MAX)
    const db = createMockDb(horses)

    await post(makeApp(db), { raced: [1] })

    const updateCalls: { where: { number: number }; data: { condition: number } }[] =
      db.horse.update.mock.calls.map((c: unknown[]) => c[0] as { where: { number: number }; data: { condition: number } })

    const restedUpdates = updateCalls.filter((c) => c.where.number !== 1)
    expect(restedUpdates.every((c) => c.data.condition === CONDITION_MAX)).toBe(true)
  })
})
