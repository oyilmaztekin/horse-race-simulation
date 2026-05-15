<script setup lang="ts">
import { useHorsesStore } from '../stores/horses'
import HorseListItem from './HorseListItem.vue'

const horses = useHorsesStore()
</script>

<template>
  <section class="horse-list">
    <header class="horse-list__header">Horse List (1 – 20)</header>
    <div class="horse-list__columns">
      <span>#</span>
      <span>Name</span>
      <span>Condition</span>
    </div>
    <ul class="horse-list__items">
      <li
        v-if="horses.isLoading"
        class="horse-list__skeleton"
        data-testid="horse-list-skeleton"
      >
        Loading horses…
      </li>
      <HorseListItem
        v-for="horse in horses.horses"
        :key="horse.number"
        :horse="horse"
      />
    </ul>
  </section>
</template>

<style scoped>
.horse-list {
  @apply flex flex-col min-h-0 bg-surface border border-border rounded-lg overflow-hidden shadow-panel;
}
.horse-list__header {
  @apply py-s3 px-s4 font-racing uppercase tracking-widest text-sm;
  color: var(--color-roster-header);
  background: linear-gradient(180deg, rgba(251, 191, 36, 0.12) 0%, transparent 100%);
  border-bottom: 1px solid rgba(251, 191, 36, 0.35);
}
.horse-list__columns {
  @apply grid gap-s2 py-s2 px-s4 text-xs text-text-muted uppercase tracking-wider border-b border-border;
  background: var(--color-surface-muted);
  grid-template-columns: 2.5rem 1fr 3.5rem;
}
.horse-list__items {
  @apply overflow-auto flex-1;
}
.horse-list__skeleton {
  @apply p-s4 text-text-muted italic font-body;
}
</style>
