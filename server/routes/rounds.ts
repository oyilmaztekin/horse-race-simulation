import { Hono } from 'hono'
import type { Context } from 'hono'
import type { PrismaClient } from '@prisma/client'
import { applyRoundEffects } from '../../src/domain/conditionMutation'
import type { HorseId, Horse } from '../../src/domain/types'

export function createRoundsRouter(db: PrismaClient): Hono {
  const app = new Hono()

  app.post('/complete', async (context: Context) => {
    const { raced } = await context.req.json<{ raced: HorseId[] }>()
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
