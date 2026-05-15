// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { PrismaClient } from '@prisma/client'
import { createRoundsRouter } from '../routes/rounds'
import { createMockDb, makeHorses } from './helpers'
import { FATIGUE_PER_RACE, RECOVERY_PER_REST, CONDITION_MAX, HORSE_COUNT } from '../../src/domain/constants'
import type { Horse } from '../../src/domain/types'

type HorseUpdateCall = { where: { number: number }; data: { condition: number } }

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
  it('reads and writes inside a single db.$transaction (atomicity)', async () => {
    const horses = makeHorses(80)
    const db = createMockDb(horses)

    await post(makeApp(db), { raced: [1, 2] })

    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(typeof db.$transaction.mock.calls[0][0]).toBe('function')
  })

  it('propagates rejection when an update fails inside the transaction (rollback path)', async () => {
    const horses = makeHorses(80)
    const db = createMockDb(horses)
    let callCount = 0
    db.horse.update.mockImplementation(() => {
      callCount += 1
      return callCount === 3 ? Promise.reject(new Error('write failed')) : Promise.resolve({})
    })

    const res = await post(makeApp(db), { raced: [1] })

    expect(res.status).toBe(500)
  })

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

    const updateCalls: HorseUpdateCall[] = db.horse.update.mock.calls.map(
      (call: unknown[]) => call[0] as HorseUpdateCall,
    )

    const racedUpdates = updateCalls.filter(
      (updateCall: HorseUpdateCall) => [1, 2, 3].includes(updateCall.where.number),
    )
    expect(racedUpdates.every((updateCall: HorseUpdateCall) => updateCall.data.condition === 80 - FATIGUE_PER_RACE)).toBe(true)
  })

  it('applies recovery to horses that did not race', async () => {
    const horses = makeHorses(80)
    const db = createMockDb(horses)

    await post(makeApp(db), { raced: [1] })

    const updateCalls: HorseUpdateCall[] = db.horse.update.mock.calls.map(
      (call: unknown[]) => call[0] as HorseUpdateCall,
    )

    const restedUpdates = updateCalls.filter((updateCall: HorseUpdateCall) => updateCall.where.number !== 1)
    expect(restedUpdates.every((updateCall: HorseUpdateCall) => updateCall.data.condition === 80 + RECOVERY_PER_REST)).toBe(true)
  })

  it('accepts an empty raced array and applies recovery to every horse (edge)', async () => {
    const horses = makeHorses(80)
    const db = createMockDb(horses)

    const res = await post(makeApp(db), { raced: [] })

    expect(res.status).toBe(200)
    expect(db.horse.update).toHaveBeenCalledTimes(HORSE_COUNT)
  })

  it('rejects body with missing raced field (sad)', async () => {
    const db = createMockDb(makeHorses(80))

    const res = await post(makeApp(db), {})

    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('invalid raced')
    expect(db.horse.update).not.toHaveBeenCalled()
    expect(db.horse.findMany).not.toHaveBeenCalled()
  })

  it('rejects body with non-array raced (sad)', async () => {
    const db = createMockDb(makeHorses(80))

    const res = await post(makeApp(db), { raced: 'not-an-array' })

    expect(res.status).toBe(400)
    expect(db.horse.update).not.toHaveBeenCalled()
  })

  it('rejects raced entry below 1 (sad)', async () => {
    const db = createMockDb(makeHorses(80))

    const res = await post(makeApp(db), { raced: [0] })

    expect(res.status).toBe(400)
    expect(db.horse.update).not.toHaveBeenCalled()
  })

  it('rejects raced entry above HORSE_COUNT (sad)', async () => {
    const db = createMockDb(makeHorses(80))

    const res = await post(makeApp(db), { raced: [HORSE_COUNT + 1] })

    expect(res.status).toBe(400)
    expect(db.horse.update).not.toHaveBeenCalled()
  })

  it('rejects raced with non-integer entries (sad)', async () => {
    const db = createMockDb(makeHorses(80))

    const res = await post(makeApp(db), { raced: [1, 'two'] })

    expect(res.status).toBe(400)
    expect(db.horse.update).not.toHaveBeenCalled()
  })

  it('clamps condition at CONDITION_MAX for already-fit horses recovering', async () => {
    const horses = makeHorses(CONDITION_MAX)
    const db = createMockDb(horses)

    await post(makeApp(db), { raced: [1] })

    const updateCalls: HorseUpdateCall[] = db.horse.update.mock.calls.map(
      (call: unknown[]) => call[0] as HorseUpdateCall,
    )

    const restedUpdates = updateCalls.filter((updateCall: HorseUpdateCall) => updateCall.where.number !== 1)
    expect(restedUpdates.every((updateCall: HorseUpdateCall) => updateCall.data.condition === CONDITION_MAX)).toBe(true)
  })
})
