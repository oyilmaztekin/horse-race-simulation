<script setup lang="ts">
import { computed, onMounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
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
        <ProgramPanel v-if="hasProgram" />
      </section>
      <aside class="app__results">
        <ResultsPanel />
      </aside>
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.app__main {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 2fr minmax(280px, 1fr);
  gap: 1rem;
  padding: 1rem;
  flex: 1;
  overflow: hidden;
}
.app__roster,
.app__center,
.app__results {
  min-height: 0;
  overflow: auto;
}
</style>
