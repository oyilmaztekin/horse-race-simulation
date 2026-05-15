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
  @apply border border-border rounded bg-surface-muted overflow-hidden;
}
.result-round-card__header {
  @apply py-s2 px-s3 text-xs font-racing uppercase tracking-widest text-text-muted;
  background: var(--color-surface-elevated);
  border-bottom: 1px solid var(--color-border);
}
.result-round-card__row {
  @apply py-s1 px-s3 text-sm font-body even:bg-surface;
}
</style>
