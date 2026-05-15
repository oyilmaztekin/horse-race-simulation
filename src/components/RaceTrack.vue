<script setup lang="ts">
import { computed, watch } from 'vue'
import RaceLane from './RaceLane.vue'
import { useRaceSimulation } from '../composables/useRaceSimulation'
import { useHorsesStore } from '../stores/horses'
import { useRaceStore } from '../stores/race'
import { CONDITION_MIN, SIM_SPEED_MAX, SIM_SPEED_MIN } from '../domain/constants'
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
  () => race.simSpeedMultiplier,
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

const atMin = computed<boolean>(() => race.simSpeedMultiplier <= SIM_SPEED_MIN)
const atMax = computed<boolean>(() => race.simSpeedMultiplier >= SIM_SPEED_MAX)
const speedReadout = computed<string>(() => `${race.simSpeedMultiplier}×`)
</script>

<template>
  <section class="race-track">
    <div
      class="race-track__speed-control"
      data-testid="race-track-speed-control"
      role="group"
      aria-label="Race speed"
    >
      <button
        type="button"
        class="race-track__speed-control__button"
        data-testid="race-track-speed-decrease"
        :disabled="atMin"
        aria-label="Decrease race speed"
        @click="race.decreaseSimSpeed()"
      >−</button>
      <span
        class="race-track__speed-control__readout"
        data-testid="race-track-speed-readout"
        aria-live="polite"
      >{{ speedReadout }}</span>
      <button
        type="button"
        class="race-track__speed-control__button"
        data-testid="race-track-speed-increase"
        :disabled="atMax"
        aria-label="Increase race speed"
        @click="race.increaseSimSpeed()"
      >+</button>
    </div>
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
  @apply flex flex-col bg-track border border-border rounded-lg overflow-hidden flex-1 min-h-0 shadow-panel;
  background-image:
    repeating-linear-gradient(
      90deg,
      transparent 0 calc(10% - 1px),
      var(--color-track-line) calc(10% - 1px) 10%
    );
}
.race-track__lanes {
  @apply relative flex flex-col flex-[0.25_1_0%];
}
.race-track__finish-line {
  @apply absolute right-0 top-0 bottom-0 pointer-events-none;
  width: 4px;
  background: repeating-linear-gradient(
    to bottom,
    var(--color-finish) 0 10px,
    #ffffff 10px 20px
  );
  box-shadow: var(--shadow-finish);
}
.race-track__footer {
  @apply flex justify-between items-center py-s2 px-s4 text-xs font-racing uppercase tracking-widest border-t border-border;
  background: var(--color-surface);
  color: var(--color-text-muted);
}
.race-track__finish-label {
  @apply font-racing tracking-[0.3em];
  color: var(--color-finish);
  text-shadow: 0 0 12px var(--color-finish-glow);
}
.race-track__speed-control {
  @apply flex items-center gap-s2 py-s2 px-s4 border-b border-border;
  background: var(--color-surface);
}
.race-track__speed-control__button {
  @apply w-8 h-8 inline-flex items-center justify-center rounded border border-border font-racing text-base;
  background: var(--color-surface-raised);
  color: var(--color-text);
  cursor: pointer;
}
.race-track__speed-control__button:hover:not(:disabled) {
  background: var(--color-surface-hover);
}
.race-track__speed-control__button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.race-track__speed-control__readout {
  @apply font-racing tracking-widest min-w-12 text-center;
  color: var(--color-text);
}
</style>
