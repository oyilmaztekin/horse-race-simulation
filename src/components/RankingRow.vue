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
  display: grid;
  grid-template-columns: 1.5rem 0.75rem 1fr;
  align-items: center;
  gap: var(--space-2);
}
.ranking-row__position {
  font-family: var(--font-mono);
  color: var(--color-text-muted);
}
</style>
