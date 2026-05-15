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
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2);
  overflow: hidden;
}
.horse-list__header {
  padding: var(--space-2) var(--space-3);
  font-weight: 600;
  background: var(--color-roster-header);
  border-bottom: 1px solid var(--color-border);
}
.horse-list__columns {
  display: grid;
  grid-template-columns: 2rem 1fr 3rem;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  background: var(--color-surface-muted);
  border-bottom: 1px solid var(--color-border);
}
.horse-list__items {
  overflow: auto;
  flex: 1;
}
.horse-list__skeleton {
  padding: var(--space-3);
  color: var(--color-text-muted);
  font-style: italic;
}
</style>
