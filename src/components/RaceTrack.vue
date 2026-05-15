<script setup lang="ts">
import { computed, watch } from 'vue'
import RaceLane from './RaceLane.vue'
import { useRaceSimulation } from '../composables/useRaceSimulation'
import { useHorsesStore } from '../stores/horses'
import { useRaceStore } from '../stores/race'
import { CONDITION_MIN } from '../domain/constants'
import type { Horse, HorseId } from '../domain/types'

const race = useRaceStore()
const horses = useHorsesStore()

const round = race.currentRound!
const roundNumber = race.currentRoundIndex + 1
const rng = race.currentRng!

const { positions, finishOrder, done } = useRaceSimulation(
  round,
  roundNumber,
  horses.conditionLookup,
  rng,
)

const placeholderHorse: Horse = { number: 0, name: '—', condition: CONDITION_MIN }
function laneHorse(horseId: HorseId): Horse {
  return horses.byId(horseId) ?? placeholderHorse
}

const lanes = computed(() =>
  round.lanes.map((horseId: HorseId, index: number) => ({
    laneIndex: index,
    horse: laneHorse(horseId),
    positionM: positions.value[index]?.meters ?? 0,
    distanceM: round.distance,
  })),
)

watch(
  done,
  (isDone: boolean) => {
    if (isDone) race.completeRound(finishOrder.value)
  },
  { once: true },
)
</script>

<template>
  <section class="race-track">
    <div class="race-track__lanes">
      <RaceLane
        v-for="lane in lanes"
        :key="lane.laneIndex"
        :lane-index="lane.laneIndex"
        :horse="lane.horse"
        :position-m="lane.positionM"
        :distance-m="lane.distanceM"
      />
      <div class="race-track__finish-line" aria-hidden="true" />
    </div>
    <footer class="race-track__footer">
      <span>Lap {{ roundNumber }} — {{ round.distance }} m</span>
      <span class="race-track__finish-label">FINISH</span>
    </footer>
  </section>
</template>

<style scoped>
.race-track {
  display: flex;
  flex-direction: column;
  background: var(--color-track);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2);
  overflow: hidden;
  flex: 1;
  min-height: 0;
}
.race-track__lanes {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
}
.race-track__finish-line {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: repeating-linear-gradient(
    to bottom,
    var(--color-finish) 0 8px,
    var(--color-surface) 8px 16px
  );
  pointer-events: none;
}
.race-track__footer {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-finish);
  font-weight: 600;
  background: var(--color-track-lane-alt);
  border-top: 1px solid var(--color-border);
}
.race-track__finish-label {
  letter-spacing: 0.1em;
}
</style>
