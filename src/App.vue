<script setup lang="ts">
import { computed, onMounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import ErrorBanner from './components/ErrorBanner.vue'
import HorseList from './components/HorseList.vue'
import ProgramPanel from './components/ProgramPanel.vue'
import RaceTrack from './components/RaceTrack.vue'
import ResultsPanel from './components/ResultsPanel.vue'
import { useRestPolling } from './composables/useRestPolling'
import { useHorsesStore } from './stores/horses'
import { useRaceStore } from './stores/race'
import { PHASE_INITIAL, PHASE_RACING } from './domain/constants'

const horses = useHorsesStore()
const race = useRaceStore()

useRestPolling()

onMounted(() => {
  horses.fetchAll()
})

const isRacing = computed(() => race.phase === PHASE_RACING)
const hasProgram = computed(() => race.phase !== PHASE_INITIAL)
const roundKey = computed(() => race.currentRoundIndex)
</script>

<template>
  <div class="app">
    <AppHeader />
    <ErrorBanner />
    <main class="app__main">
      <aside class="app__roster">
        <HorseList />
      </aside>
      <section class="app__center">
        <RaceTrack
          v-if="isRacing"
          :key="roundKey"
          :data-round-key="roundKey"
        />
      </section>
      <aside class="app__results">
        <div class="app__panels">
          <ProgramPanel v-if="hasProgram" class="app__panel app__panel--program" />
          <ResultsPanel class="app__panel app__panel--results" />
        </div>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-bg);
}
.app__main {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(0, 2.4fr) minmax(360px, 1.4fr);
  gap: var(--space-4);
  padding: var(--space-4);
  flex: 1;
  min-height: 0;
}
.app__roster,
.app__center,
.app__results {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.app__roster,
.app__results {
  overflow: auto;
}
.app__panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
.app__panel {
  min-width: 0;
}
</style>
