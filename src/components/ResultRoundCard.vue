<script setup lang="ts">
import RankingRow from './RankingRow.vue'
import type { Horse } from '../domain/types'

defineProps<{
  roundNumber: number
  distance: number
  entries: { position: number; horse: Horse; laneIndex: number }[]
}>()
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
        <RankingRow
          :position="entry.position"
          :horse="entry.horse"
          :lane-index="entry.laneIndex"
        />
      </li>
    </ol>
  </section>
</template>

<style scoped>
.result-round-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-surface);
  overflow: hidden;
}
.result-round-card__header {
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: 600;
  background: var(--color-surface-muted);
  border-bottom: 1px solid var(--color-border);
}
.result-round-card__row {
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-size-sm);
}
.result-round-card__row:nth-child(even) {
  background: var(--color-surface-muted);
}
</style>
