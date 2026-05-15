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
  @apply grid items-center gap-s3;
  grid-template-columns: 1.75rem 0.75rem 1fr;
}
.ranking-row__position {
  @apply font-mono font-bold;
  color: var(--color-current);
}
.ranking-row__name {
  @apply font-body;
}
</style>
