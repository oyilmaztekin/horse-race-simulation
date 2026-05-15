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
  return program.map((round: Round, index: number) => ({
    roundNumber: index + 1,
    distance: round.distance,
    entries: round.lanes.map((horseId: number, laneIndex: number) => ({
      laneIndex,
      horse: resolve(horseId),
    })),
    isCurrent: race.currentRoundIndex === index,
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
      />
    </div>
  </section>
</template>

<style scoped>
.program-panel {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2);
  overflow: hidden;
}
.program-panel__header {
  padding: var(--space-2) var(--space-3);
  font-weight: 600;
  background: var(--color-program-header);
  border-bottom: 1px solid var(--color-border);
}
.program-panel__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2);
}
</style>
