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
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--color-header);
  color: var(--color-header-text);
  border-bottom: 1px solid var(--color-border);
}
.app-header__title {
  font-size: var(--font-size-xl);
  font-weight: 600;
}
.app-header__phase {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  opacity: 0.75;
  margin-right: auto;
}
</style>
