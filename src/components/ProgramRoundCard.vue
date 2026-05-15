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
  @apply border border-border rounded bg-surface-muted overflow-hidden;
  transition: box-shadow 200ms ease, border-color 200ms ease, transform 200ms ease;
}
.program-round-card--current {
  border-color: var(--color-current);
  background: var(--color-current-bg);
  box-shadow: var(--shadow-current);
}
.program-round-card__header {
  @apply py-s2 px-s3 text-xs font-racing uppercase tracking-widest text-text-muted;
  background: var(--color-surface-elevated);
  border-bottom: 1px solid var(--color-border);
}
.program-round-card--current .program-round-card__header {
  background: linear-gradient(180deg, var(--color-current) 0%, #f59e0b 100%);
  color: var(--color-primary-text);
  border-bottom-color: var(--color-current);
}
.program-round-card__entry {
  @apply grid gap-s2 py-s1 px-s3 text-sm font-body even:bg-surface;
  grid-template-columns: 1.75rem 1fr;
}
.program-round-card__lane {
  @apply font-mono;
  color: var(--color-current);
}
</style>
