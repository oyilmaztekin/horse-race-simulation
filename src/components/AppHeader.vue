<script setup lang="ts">
import RaceControls from './RaceControls.vue'
import { useRaceStore } from '../stores/race'

const race = useRaceStore()
</script>

<template>
  <header class="app-header">
    <h1 class="app-header__title">Horse Racing</h1>
    <span class="app-header__phase" :data-testid="'phase-indicator'">{{ race.phase }}</span>
    <RaceControls />
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e0e0e0;
}
.app-header__title {
  margin: 0;
  font-size: 1.25rem;
}
.app-header__phase {
  font-family: monospace;
  font-size: 0.875rem;
  color: #666;
}
</style>
