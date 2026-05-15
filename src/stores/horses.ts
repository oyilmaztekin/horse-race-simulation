import { ref } from 'vue'
import { defineStore } from 'pinia'
import { CONDITION_MIN } from '../domain/constants'
import type { Horse, HorseId } from '../domain/types'
import { useRaceApi } from '../composables/useRaceApi'
import { useRaceStore } from './race'

export const useHorsesStore = defineStore('horses', () => {
  const horses = ref<Horse[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  const api = useRaceApi()

  async function fetchAll(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const envelope = await api.getHorses()
      horses.value = envelope.horses
      if (envelope.restingUntil && envelope.remainingRestMs) {
        useRaceStore().resumeRestFromBoot(envelope.restingUntil, envelope.remainingRestMs)
      }
    } catch (caught) {
      error.value = caught as Error
    } finally {
      isLoading.value = false
    }
  }

  function applyServerUpdate(updated: Horse[]): void {
    horses.value = updated
  }

  function byId(id: HorseId): Horse | undefined {
    return horses.value.find((horse: Horse) => horse.number === id)
  }

  function conditionLookup(id: HorseId): number {
    return byId(id)?.condition ?? CONDITION_MIN
  }

  return { horses, isLoading, error, fetchAll, applyServerUpdate, byId, conditionLookup }
})
