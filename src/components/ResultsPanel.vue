<script setup lang="ts">
import { computed } from 'vue'
import { CONDITION_MIN, ROUND_DISTANCES } from '../domain/constants'
import type { Horse, Ranking, RoundResult } from '../domain/types'
import { useHorsesStore } from '../stores/horses'
import { useRaceStore } from '../stores/race'
import ResultRoundCard from './ResultRoundCard.vue'

interface CardProps {
  roundNumber: number
  distance: number
  entries: { position: number; horse: Horse; laneIndex: number }[]
}

const race = useRaceStore()
const horses = useHorsesStore()

function resolve(horseId: number): Horse {
  return horses.byId(horseId) ?? { number: horseId, name: '—', condition: CONDITION_MIN }
}

function toEntries(rankings: Ranking[]): CardProps['entries'] {
  return rankings.map((ranking: Ranking) => ({
    position: ranking.rank,
    horse: resolve(ranking.horseId),
    laneIndex: ranking.lane - 1,
  }))
}

// Always render one card per ROUND_DISTANCES entry — the meeting structure
// is visible from page load (BUSINESS_LOGIC.md §3.6). Result bodies fill in
// as race.results grows, keyed by roundNumber so insertion order in
// race.results doesn't affect placement.
const cards = computed<CardProps[]>(() =>
  ROUND_DISTANCES.map((distance: number, index: number) => {
    const roundNumber = index + 1
    const result = race.results.find((entry: RoundResult) => entry.roundNumber === roundNumber)
    return {
      roundNumber,
      distance,
      entries: result ? toEntries(result.rankings) : [],
    }
  }),
)
</script>

<template>
  <section class="results-panel">
    <header class="results-panel__header">Results</header>
    <div class="results-panel__list">
      <ResultRoundCard
        v-for="card in cards"
        :key="card.roundNumber"
        :round-number="card.roundNumber"
        :distance="card.distance"
        :entries="card.entries"
      />
    </div>
  </section>
</template>

<style scoped>
.results-panel {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2);
  overflow: hidden;
}
.results-panel__header {
  padding: var(--space-2) var(--space-3);
  font-weight: 600;
  background: var(--color-results-header);
  border-bottom: 1px solid var(--color-border);
}
.results-panel__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2);
}
</style>
