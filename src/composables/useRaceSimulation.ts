import { computed, onMounted, onUnmounted, ref } from 'vue'
import { LANE_COUNT, SIM_TICK_MS } from '../domain/constants'
import { createSnapshot, step as simulationStep } from '../domain/simulation'
import type { HorseId, LanePosition, Ranking, Rng, Round, SimulationSnapshot } from '../domain/types'

type ConditionLookup = (horseId: HorseId) => number

export function useRaceSimulation(
  round: Round,
  roundNumber: number,
  conditionLookup: ConditionLookup,
  rng: Rng,
) {
  // createSnapshot draws form per lane (lane-order 1→10) from the shared rng
  // before any per-tick jitter draws — RNG consumption ordering frozen here.
  const snapshot = ref<SimulationSnapshot>(createSnapshot(round, roundNumber, rng))

  const positions = computed<LanePosition[]>(() => snapshot.value.lanes)

  const finishOrder = computed<Ranking[]>(() =>
    snapshot.value.lanes
      .filter((lane): lane is LanePosition & { finishedAtMs: number } => lane.finishedAtMs !== null)
      .sort((a, b) => a.finishedAtMs - b.finishedAtMs || a.lane - b.lane)
      .map((lane, index) => ({
        rank: index + 1,
        horseId: lane.horseId,
        lane: lane.lane,
        finishTimeMs: lane.finishedAtMs,
      })),
  )

  const done = computed(() => finishOrder.value.length === LANE_COUNT)

  let handle: number | null = null
  let lastRealTs = 0
  let accumulator = 0

  function loop(realTs: number) {
    if (done.value) {
      handle = null
      return
    }
    const realDt = lastRealTs === 0 ? 0 : realTs - lastRealTs
    lastRealTs = realTs
    accumulator += realDt
    while (accumulator >= SIM_TICK_MS && !done.value) {
      snapshot.value = simulationStep(snapshot.value, SIM_TICK_MS, conditionLookup, rng)
      accumulator -= SIM_TICK_MS
    }
    if (!done.value) handle = requestAnimationFrame(loop)
  }

  onMounted(() => {
    lastRealTs = 0
    accumulator = 0
    handle = requestAnimationFrame(loop)
  })

  onUnmounted(() => {
    if (handle !== null) {
      cancelAnimationFrame(handle)
      handle = null
    }
  })

  return { positions, finishOrder, done }
}
