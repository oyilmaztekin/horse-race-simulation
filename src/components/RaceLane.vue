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
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-height: 2.25rem;
  padding: 0 var(--space-2);
  border-bottom: 1px solid var(--color-border);
}
.race-lane:nth-child(even) {
  background: var(--color-track-lane-alt);
}
.race-lane__index {
  width: 1.25rem;
  font-family: var(--font-mono);
  color: var(--color-text-muted);
  text-align: right;
}
.race-lane__track {
  position: relative;
  flex: 1;
  height: 100%;
}
</style>
