<script setup lang="ts">
import type { Horse } from '../domain/types'

defineProps<{
  roundNumber: number
  distance: number
  entries: { laneIndex: number; horse: Horse }[]
  isCurrent: boolean
}>()
</script>

<template>
  <section class="program-round-card" :class="{ 'program-round-card--current': isCurrent }">
    <header class="program-round-card__header">
      Round {{ roundNumber }} — {{ distance }} m
    </header>
    <ol class="program-round-card__list">
      <li
        v-for="entry in entries"
        :key="entry.laneIndex"
        data-test="program-entry"
        class="program-round-card__entry"
      >
        <span class="program-round-card__lane">{{ entry.laneIndex + 1 }}</span>
        <span class="program-round-card__name">{{ entry.horse.name }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.program-round-card {
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  padding: 0.5rem;
}
.program-round-card--current {
  border-color: #0072b2;
  background: #f4f9ff;
}
.program-round-card__list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.program-round-card__entry {
  display: flex;
  gap: 0.5rem;
}
</style>
