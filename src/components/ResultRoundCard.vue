<script setup lang="ts">
import ColorSwatch from './ColorSwatch.vue'
import { LANE_COLORS } from '../domain/constants'
import type { Horse } from '../domain/types'

defineProps<{
  roundNumber: number
  distance: number
  entries: { position: number; horse: Horse; laneIndex: number }[]
}>()

const colorFor = (laneIndex: number): string => LANE_COLORS[laneIndex] ?? LANE_COLORS[0] ?? '#000'
</script>

<template>
  <section class="result-round-card">
    <header class="result-round-card__header">
      Round {{ roundNumber }} — {{ distance }} m
    </header>
    <ol class="result-round-card__list">
      <li
        v-for="entry in entries"
        :key="entry.position"
        data-test="result-row"
        class="result-round-card__row"
      >
        <span class="result-round-card__position">{{ entry.position }}</span>
        <ColorSwatch :color="colorFor(entry.laneIndex)" />
        <span class="result-round-card__name">{{ entry.horse.name }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.result-round-card {
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  padding: 0.5rem;
}
.result-round-card__list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.result-round-card__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
