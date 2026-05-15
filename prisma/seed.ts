import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { generateRoster } from '../src/domain/horseFactory'
import { createRng } from '../src/domain/rng'

// Fixed roster seed (ARCHITECTURE.md §16) — same 20 horses + initial
// conditions on every reseed so the demo and tests are reproducible.
const ROSTER_SEED = 0xdecaf

function loadNames(): string[] {
  const url = new URL('./horseNames.json', import.meta.url)
  const parsed: unknown = JSON.parse(readFileSync(url, 'utf8'))
  if (!Array.isArray(parsed) || !parsed.every((item: unknown): item is string => typeof item === 'string')) {
    throw new Error('prisma/horseNames.json must be a JSON array of strings')
  }
  return parsed
}

async function main(): Promise<void> {
  const names = loadNames()
  const lookupName = (number: number): string => {
    const name = names[number - 1]
    if (typeof name !== 'string') throw new Error(`No name for horse number ${number}`)
    return name
  }
  const horses = generateRoster(createRng(ROSTER_SEED), lookupName)
  const prisma = new PrismaClient()
  try {
    await prisma.horse.deleteMany()
    await prisma.horse.createMany({ data: horses })
    await prisma.appState.upsert({
      where: { id: 1 },
      update: { restingUntil: null },
      create: { id: 1, restingUntil: null },
    })
    console.log(`Seeded ${await prisma.horse.count()} horses.`)
  } finally {
    await prisma.$disconnect()
  }
}

void main()
