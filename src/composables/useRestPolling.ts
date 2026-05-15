import { onUnmounted, watch } from 'vue'
import { PHASE_RESTING, REST_POLL_INTERVAL_MS } from '../domain/constants'
import { useRaceApi } from './useRaceApi'
import { useHorsesStore } from '../stores/horses'
import { useRaceStore } from '../stores/race'

// BUSINESS_LOGIC.md §3.8 / §4.7 — polls GET /api/horses while race.phase === 'RESTING'.
// When the envelope returns restingUntil === null, the server has lazy-bumped
// every unfit horse; we hand the fresh roster to race.completeRest, which
// transitions RESTING → INITIAL.
export function useRestPolling() {
  const race = useRaceStore()
  const horses = useHorsesStore()
  const api = useRaceApi()
  let handle: ReturnType<typeof setInterval> | null = null

  async function tick() {
    try {
      const envelope = await api.getHorses()
      if (!envelope.restingUntil) {
        race.completeRest(envelope.horses)
        return
      }
      horses.applyServerUpdate(envelope.horses)
      if (envelope?.remainingRestMs) {
        race.applyRestObservation(envelope.remainingRestMs)
      }
    } catch {
      // Polling failures are non-fatal — next tick retries. A persistent
      // failure surfaces via horses.error on the next GET that succeeds.
    }
  }

  function stop() {
    if (handle) {
      clearInterval(handle)
      handle = null
    }
  }

  watch(
    () => race.phase,
    (phase) => {
      if (phase === PHASE_RESTING && handle === null) {
        handle = setInterval(tick, REST_POLL_INTERVAL_MS)
        void tick()
      } else if (phase !== PHASE_RESTING) {
        stop()
      }
    },
    { immediate: true },
  )

  onUnmounted(stop)
}
