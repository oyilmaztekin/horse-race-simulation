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
}
</style>
