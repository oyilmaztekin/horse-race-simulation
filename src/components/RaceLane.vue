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
  gap: 0.5rem;
  height: 2rem;
}
.race-lane__track {
  position: relative;
  flex: 1;
  height: 100%;
  border-bottom: 1px dashed #d0d0d0;
}
</style>
