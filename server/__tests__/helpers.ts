import { vi } from 'vitest'
import type { Horse } from '../../src/domain/types'

export type MockDb = {
  horse: {
    findMany: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  appState: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
  }
  $transaction: ReturnType<typeof vi.fn>
}

export function createMockDb(horses: Horse[] = [], restingUntil: Date | null = null): MockDb {
  const mock: MockDb = {
    horse: {
      findMany: vi.fn().mockResolvedValue(horses),
      update: vi.fn().mockResolvedValue({}),
    },
    appState: {
      findUnique: vi.fn().mockResolvedValue({ id: 1, restingUntil }),
      update: vi.fn().mockResolvedValue({}),
      upsert: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn((callback: (transaction: MockDb) => unknown) => callback(mock)),
  }
  return mock
}

export function makeHorses(condition = 80): Horse[] {
  return Array.from({ length: 20 }, (_, i) => ({
    number: i + 1,
    name: `Horse ${i + 1}`,
    condition,
  }))
}
