import { Hono } from 'hono'
import type { Context } from 'hono'
import type { PrismaClient } from '@prisma/client'
import { applyRestEffects } from '../../src/domain/conditionMutation'
import { REST_DURATION_MS } from '../../src/domain/constants'
import type { HorsesEnvelope } from '../../src/domain/types'

export function createHorsesRouter(db: PrismaClient): Hono {
  const app = new Hono()

  app.get('/', async (context: Context) => context.json(await readEnvelopeAndMaybeBump(db)))
  app.post('/rest', async (context: Context) => context.json(await startRestIfIdle(db)))

  return app
}

async function readEnvelopeAndMaybeBump(db: PrismaClient): Promise<HorsesEnvelope> {
  return db.$transaction(async (transaction) => {
    const meta = await transaction.appState.findUnique({ where: { id: 1 } })
    const now = Date.now()

    if (meta?.restingUntil && meta.restingUntil.getTime() <= now) {
      const current = await transaction.horse.findMany({ orderBy: { number: 'asc' } })
      const bumped = applyRestEffects(current)
      await Promise.all(
        bumped.map((horse) =>
          transaction.horse.update({ where: { number: horse.number }, data: { condition: horse.condition } }),
        ),
      )
      await transaction.appState.update({ where: { id: 1 }, data: { restingUntil: null } })
      return { horses: bumped, restingUntil: null, remainingRestMs: null }
    }

    const horses = await transaction.horse.findMany({ orderBy: { number: 'asc' } })
    const restingUntilMs = meta?.restingUntil?.getTime() ?? null
    return {
      horses,
      restingUntil: restingUntilMs,
      remainingRestMs: restingUntilMs === null ? null : restingUntilMs - now,
    }
  })
}

async function startRestIfIdle(db: PrismaClient): Promise<HorsesEnvelope> {
  return db.$transaction(async (transaction) => {
    const meta = await transaction.appState.findUnique({ where: { id: 1 } })
    const now = Date.now()

    if (meta?.restingUntil && meta.restingUntil.getTime() > now) {
      const horses = await transaction.horse.findMany({ orderBy: { number: 'asc' } })
      const restingUntilMs = meta.restingUntil.getTime()
      return { horses, restingUntil: restingUntilMs, remainingRestMs: restingUntilMs - now }
    }

    const restingUntil = new Date(now + REST_DURATION_MS)
    await transaction.appState.upsert({
      where: { id: 1 },
      update: { restingUntil },
      create: { id: 1, restingUntil },
    })
    const horses = await transaction.horse.findMany({ orderBy: { number: 'asc' } })
    return {
      horses,
      restingUntil: restingUntil.getTime(),
      remainingRestMs: restingUntil.getTime() - now,
    }
  })
}
