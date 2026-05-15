import { PrismaClient } from '@prisma/client'
import { applyRoundEffects } from '../src/domain/conditionMutation'
import { CONDITION_MIN, SIM_TICK_MS } from '../src/domain/constants'
import { generateProgram } from '../src/domain/programGenerator'
import { createRng } from '../src/domain/rng'
import { createSnapshot, step } from '../src/domain/simulation'
import type { Horse, HorseId, Rng, Round, SimulationSnapshot } from '../src/domain/types'

// Distinct from prisma/seed.ts's ROSTER_SEED so we exercise a different
// rng path; meeting RNG drives both generateProgram and the simulation.
const MEETING_SEED = 0xc0ffee

// Safety cap on the simulate-to-finish loop. 100k ticks @ 16.6 ms ≈ 28 min
// of sim time — vastly longer than any realistic 2200 m race.
const MAX_TICKS_PER_ROUND = 100_000

function conditionLookupFor(horses: Horse[]) {
  const byNumber = new Map(horses.map((h) => [h.number, h.condition]))
  return (id: HorseId): number => byNumber.get(id) ?? CONDITION_MIN
}

function simulateRoundToFinish(round: Round, roundNumber: number, horses: Horse[], rng: Rng): SimulationSnapshot {
  const lookup = conditionLookupFor(horses)
  let snap = createSnapshot(round, roundNumber)
  let ticks = 0
  while (snap.lanes.some((l) => !l.finishedAtMs) && ticks < MAX_TICKS_PER_ROUND) {
    snap = step(snap, SIM_TICK_MS, lookup, rng)
    ticks += 1
  }
  if (snap.lanes.some((l) => !l.finishedAtMs)) {
    throw new Error(`Round ${roundNumber} did not finish within ${MAX_TICKS_PER_ROUND} ticks`)
  }
  return snap
}

function printProgram(program: Round[], horses: Horse[]): void {
  console.log('\n=== Program ===')
  program.forEach((round, i) => {
    const lanes = round.lanes
      .map((id) => {
        const h = horses.find((x) => x.number === id)
        return `${id}:${h?.name ?? '?'}(${h?.condition ?? '?'})`
      })
      .join('  ')
    console.log(`Round ${i + 1} — ${round.distance} m`)
    console.log(`  Lanes 1..10: ${lanes}`)
  })
}

function printFinishOrder(roundNumber: number, snap: SimulationSnapshot, horses: Horse[]): void {
  console.log(`\n--- Round ${roundNumber} (${snap.distance} m) finished in ${snap.elapsedMs.toFixed(1)} ms ---`)
  const ordered = [...snap.lanes].sort(
    (a, b) => (a.finishedAtMs ?? Infinity) - (b.finishedAtMs ?? Infinity),
  )
  ordered.forEach((lane, rank) => {
    const horse = horses.find((h) => h.number === lane.horseId)
    const t = lane.finishedAtMs?.toFixed(1) ?? 'DNF'
    console.log(
      `  #${rank + 1} lane ${lane.lane}: ${horse?.name ?? '?'} (cond ${horse?.condition ?? '?'}) — ${t} ms`,
    )
  })
}

function printConditionDeltas(before: Horse[], after: Horse[], raced: HorseId[]): void {
  const racedSet = new Set(raced)
  console.log('  Condition changes (R = raced):')
  before.forEach((h, i) => {
    const a = after[i]
    const newCond = a?.condition ?? h.condition
    const delta = newCond - h.condition
    const flag = racedSet.has(h.number) ? 'R' : '.'
    const sign = delta >= 0 ? '+' : ''
    console.log(`    ${flag} ${h.name.padEnd(20)} ${h.condition} → ${newCond}  (${sign}${delta})`)
  })
}

function runRound(round: Round, roundNumber: number, horses: Horse[], rng: Rng): Horse[] {
  const snap = simulateRoundToFinish(round, roundNumber, horses, rng)
  printFinishOrder(roundNumber, snap, horses)
  const after = applyRoundEffects(horses, round.lanes)
  printConditionDeltas(horses, after, round.lanes)
  return after
}

async function runMeeting(prisma: PrismaClient): Promise<void> {
  const horses = await prisma.horse.findMany({ orderBy: { number: 'asc' } })
  if (horses.length === 0) {
    console.error('No horses in DB. Run `npm run db:seed` first.')
    process.exitCode = 1
    return
  }
  console.log(`Loaded ${horses.length} horses from dev.db.`)
  const rng = createRng(MEETING_SEED)
  const program = generateProgram(horses, rng)
  printProgram(program, horses)
  let current = horses
  program.forEach((round, i) => {
    current = runRound(round, i + 1, current, rng)
  })
  console.log('\n=== Smoke OK ===')
}

async function main(): Promise<void> {
  const prisma = new PrismaClient()
  try {
    await runMeeting(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

void main()
