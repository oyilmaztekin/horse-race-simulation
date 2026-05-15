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
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-surface);
  overflow: hidden;
}
.program-round-card--current {
  border-color: var(--color-current);
  background: var(--color-current-bg);
}
.program-round-card__header {
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: 600;
  background: var(--color-surface-muted);
  border-bottom: 1px solid var(--color-border);
}
.program-round-card--current .program-round-card__header {
  background: var(--color-current);
  color: var(--color-surface);
}
.program-round-card__entry {
  display: grid;
  grid-template-columns: 1.5rem 1fr;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-size-sm);
}
.program-round-card__entry:nth-child(even) {
  background: var(--color-surface-muted);
}
.program-round-card__lane {
  font-family: var(--font-mono);
  color: var(--color-text-muted);
}
</style>
