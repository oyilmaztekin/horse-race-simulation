<script setup lang="ts">
import { computed } from 'vue'
import { CONDITION_MIN } from '../domain/constants'
import type { Horse, Round } from '../domain/types'
import { useHorsesStore } from '../stores/horses'
import { useRaceStore } from '../stores/race'
import ProgramRoundCard from './ProgramRoundCard.vue'

interface CardProps {
  roundNumber: number
  distance: number
  entries: { laneIndex: number; horse: Horse }[]
  isCurrent: boolean
  isCompleted: boolean
}

const race = useRaceStore()
const horses = useHorsesStore()

// HorseId → Horse resolver. Treat a missing horse as a defensive placeholder
// rather than crashing: by the time a program exists, the roster has loaded
// (BUSINESS_LOGIC.md decision #20 / §4.3 roster-readiness gate).
function resolve(horseId: number): Horse {
  return horses.byId(horseId) ?? { number: horseId, name: '—', condition: CONDITION_MIN }
}

const cards = computed<CardProps[]>(() => {
  const program = race.program ?? []
  const completedCount = race.results.length
  return program.map((round: Round, index: number) => ({
    roundNumber: index + 1,
    distance: round.distance,
    entries: round.lanes.map((horseId: number, laneIndex: number) => ({
      laneIndex,
      horse: resolve(horseId),
    })),
    isCurrent: race.currentRoundIndex === index,
    isCompleted: index < completedCount,
  }))
})
</script>

<template>
  <section class="program-panel">
    <header class="program-panel__header">Program</header>
    <div class="program-panel__list">
      <ProgramRoundCard
        v-for="card in cards"
        :key="card.roundNumber"
        :round-number="card.roundNumber"
        :distance="card.distance"
        :entries="card.entries"
        :is-current="card.isCurrent"
        :is-completed="card.isCompleted"
      />
    </div>
  </section>
</template>

<style scoped>
.program-panel {
  @apply flex flex-col bg-surface border border-border rounded-lg overflow-hidden shadow-panel;
}
.program-panel__header {
  @apply py-s3 px-s4 font-racing uppercase tracking-widest text-sm;
  color: var(--color-program-header);
  background: linear-gradient(180deg, rgba(34, 211, 238, 0.12) 0%, transparent 100%);
  border-bottom: 1px solid rgba(34, 211, 238, 0.35);
}
.program-panel__list {
  @apply flex flex-col gap-s2 p-s3;
}
</style>
