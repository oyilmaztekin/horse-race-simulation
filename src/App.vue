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
  @apply flex flex-col min-h-screen bg-bg text-text;
  background-image:
    radial-gradient(1200px 600px at 15% -10%, rgba(251, 191, 36, 0.06), transparent 60%),
    radial-gradient(900px 500px at 110% 10%, rgba(34, 211, 238, 0.05), transparent 60%);
}
.app__main {
  @apply grid gap-s4 p-s4 flex-1 min-h-0;
  grid-template-columns: minmax(240px, 1fr) minmax(0, 2.4fr) minmax(360px, 1.4fr);
}
.app__roster,
.app__center,
.app__results {
  @apply min-h-0 flex flex-col gap-s3;
}
.app__roster,
.app__results {
  @apply overflow-auto;
}
.app__panels {
  @apply grid grid-cols-2 gap-s3;
}
.app__panel {
  @apply min-w-0;
}
</style>
