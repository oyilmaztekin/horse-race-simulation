<script setup lang="ts">
import { computed } from 'vue'
import ColorSwatch from './ColorSwatch.vue'
import { LANE_COLORS } from '../domain/constants'
import type { Horse } from '../domain/types'

const props = defineProps<{
  position: number
  horse: Horse
  laneIndex: number
}>()

const color = computed(() => LANE_COLORS[props.laneIndex] ?? LANE_COLORS[0] ?? '#000')
</script>

<template>
  <div class="ranking-row">
    <span class="ranking-row__position">{{ position }}</span>
    <ColorSwatch :color="color" />
    <span class="ranking-row__name">{{ horse.name }}</span>
  </div>
</template>

<style scoped>
.ranking-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
