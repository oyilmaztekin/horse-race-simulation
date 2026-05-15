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
  @apply flex flex-col bg-surface border border-border rounded-lg overflow-hidden shadow-panel;
}
.results-panel__header {
  @apply py-s3 px-s4 font-racing uppercase tracking-widest text-sm;
  color: var(--color-results-header);
  background: linear-gradient(180deg, rgba(52, 211, 153, 0.12) 0%, transparent 100%);
  border-bottom: 1px solid rgba(52, 211, 153, 0.35);
}
.results-panel__list {
  @apply flex flex-col gap-s2 p-s3;
}
</style>
