<script setup lang="ts">
import RaceControls from './RaceControls.vue'
import { useRaceStore } from '../stores/race'

const race = useRaceStore()
</script>

<template>
  <header class="app-header">
    <h1 class="app-header__title">Horse Racing</h1>
    <span class="app-header__phase" :data-testid="'phase-indicator'">state:{{ race.phase }}</span>
    <RaceControls />
  </header>
</template>

<style scoped>
.app-header {
  @apply flex items-center gap-s4 py-s3 px-s5 bg-header text-header-text;
  border-bottom: 1px solid var(--color-border);
  box-shadow: 0 1px 0 rgba(251, 191, 36, 0.35) inset,
    0 6px 24px rgba(0, 0, 0, 0.45);
}
.app-header__title {
  @apply font-racing text-2xl uppercase tracking-widest;
  background: linear-gradient(180deg, #ffe9a1 0%, var(--color-current) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 0 18px rgba(251, 191, 36, 0.25);
}
.app-header__phase {
  @apply font-mono text-xs uppercase tracking-widest mr-auto py-s1 px-s3 rounded-pill;
  background: rgba(34, 211, 238, 0.12);
  color: var(--color-program-header);
  border: 1px solid rgba(34, 211, 238, 0.4);
}
</style>
