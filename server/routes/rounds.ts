import { Hono } from 'hono'
import type { Context } from 'hono'
import type { PrismaClient } from '@prisma/client'
import { applyRoundEffects } from '../../src/domain/conditionMutation'
import { HORSE_COUNT } from '../../src/domain/constants'
import type { HorseId, Horse } from '../../src/domain/types'

function isValidRaced(value: unknown): value is HorseId[] {
  return (
    Array.isArray(value) &&
    value.every((item) => Number.isInteger(item) && (item as number) >= 1 && (item as number) <= HORSE_COUNT)
  )
}

export function createRoundsRouter(db: PrismaClient): Hono {
  const app = new Hono()

  app.post('/complete', async (context: Context) => {
    const body = await context.req.json<Record<string, unknown>>()
    if (!isValidRaced(body.raced)) {
      return context.json({ error: 'invalid raced' }, 400)
    }
    const raced: HorseId[] = body.raced
    const current = await db.horse.findMany({ orderBy: { number: 'asc' } })
    const updated = applyRoundEffects(current, raced)
    await Promise.all(
      updated.map((horse: Horse) =>
        db.horse.update({ where: { number: horse.number }, data: { condition: horse.condition } }),
      ),
    )
    return context.json(updated)
  })

  return app
}
