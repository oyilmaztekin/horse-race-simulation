<script setup lang="ts">
import { computed } from 'vue'
import HorseSprite from './HorseSprite.vue'
import { LANE_COLORS } from '../domain/constants'
import type { Horse } from '../domain/types'

const props = defineProps<{
  laneIndex: number
  horse: Horse
  positionM: number
  distanceM: number
}>()

const color = computed(() => LANE_COLORS[props.laneIndex] ?? LANE_COLORS[0])
const progress = computed(() => props.positionM / props.distanceM)
</script>

<template>
  <div class="race-lane">
    <span class="race-lane__index">{{ laneIndex + 1 }}</span>
    <div class="race-lane__track">
      <HorseSprite :color="color" :progress="progress" :condition="horse.condition" />
    </div>
  </div>
</template>

<style scoped>
.race-lane {
  @apply flex items-center gap-s3 flex-1 px-s3 border-b;
  border-color: var(--color-track-line);
}
.race-lane:nth-child(even) {
  background: rgba(255, 255, 255, 0.02);
}
.race-lane__index {
  @apply w-6 font-mono text-right font-bold;
  color: var(--color-current);
}
.race-lane__track {
  @apply relative flex-1 h-full;
}
</style>
