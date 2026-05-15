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
    <header class="race-track__header">Round {{ roundNumber }} — {{ round.distance }} m</header>
    <div class="race-track__lanes">
      <RaceLane
        v-for="lane in lanes"
        :key="lane.laneIndex"
        :lane-index="lane.laneIndex"
        :horse="lane.horse"
        :position-m="lane.positionM"
        :distance-m="lane.distanceM"
      />
    </div>
    <div class="race-track__finish-line" aria-hidden="true" />
  </section>
</template>

<style scoped>
.race-track {
  position: relative;
}
.race-track__header {
  font-weight: 600;
  margin-bottom: 0.5rem;
}
.race-track__lanes {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.race-track__finish-line {
  position: absolute;
  right: 0;
  top: 2rem;
  bottom: 0;
  width: 2px;
  background: repeating-linear-gradient(
    to bottom,
    #000 0 8px,
    #fff 8px 16px
  );
}
</style>
