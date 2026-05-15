<script setup lang="ts">
import { computed } from 'vue'
import { computeStandings } from '../domain/standings'
import type { HorseId, Standing } from '../domain/types'
import { useHorsesStore } from '../stores/horses'
import { useRaceStore } from '../stores/race'

const race = useRaceStore()
const horses = useHorsesStore()

const standings = computed<Standing[]>(() =>
  computeStandings(race.results, (horseId: HorseId) => horses.byId(horseId)),
)

function formatTime(totalMs: number): string {
  return (totalMs / 1000).toFixed(2)
}
</script>

<template>
  <section class="score-table">
    <header class="score-table__header">Final Standings</header>
    <table class="score-table__grid">
      <thead>
        <tr class="score-table__head-row">
          <th class="score-table__cell">#</th>
          <th class="score-table__cell">Horse</th>
          <th class="score-table__cell">Wins</th>
          <th class="score-table__cell">Podiums</th>
          <th class="score-table__cell">Runs</th>
          <th class="score-table__cell">Total (s)</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in standings"
          :key="row.horseId"
          data-testid="score-table-row"
          class="score-table__row"
          :class="{ 'score-table__row--champion': row.rank === 1 }"
        >
          <td class="score-table__cell">{{ row.rank }}</td>
          <td class="score-table__cell">{{ row.number }} — {{ row.name }}</td>
          <td class="score-table__cell">{{ row.wins }}</td>
          <td class="score-table__cell">{{ row.podiums }}</td>
          <td class="score-table__cell">{{ row.roundsRun }}</td>
          <td class="score-table__cell">{{ formatTime(row.totalFinishTimeMs) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.score-table {
  @apply flex flex-col bg-surface border border-border rounded-lg overflow-hidden shadow-panel;
}
.score-table__header {
  @apply py-s3 px-s4 font-racing uppercase tracking-widest text-sm text-text;
  background: linear-gradient(180deg, rgba(251, 191, 36, 0.14) 0%, transparent 100%);
  border-bottom: 1px solid rgba(251, 191, 36, 0.35);
}
.score-table__grid {
  @apply w-full text-sm font-body border-collapse;
}
.score-table__head-row {
  @apply text-xs font-racing uppercase tracking-widest text-text-muted;
  background: var(--color-surface-elevated);
}
.score-table__row {
  @apply even:bg-surface-muted;
}
.score-table__row--champion {
  @apply text-text;
  background: linear-gradient(90deg, rgba(251, 191, 36, 0.22) 0%, rgba(251, 191, 36, 0.05) 100%);
  box-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.45);
}
.score-table__cell {
  @apply py-s2 px-s3 text-left;
}
</style>
