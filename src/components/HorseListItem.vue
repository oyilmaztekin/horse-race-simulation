<script setup lang="ts">
import type { Horse } from '../domain/types'

defineProps<{ horse: Horse }>()
</script>

<template>
  <li class="horse-list-item">
    <span class="horse-list-item__number">{{ horse.number }}</span>
    <span class="horse-list-item__name">{{ horse.name }}</span>
    <span class="horse-list-item__condition">{{ horse.condition }}</span>
  </li>
</template>

<style scoped>
.horse-list-item {
  display: grid;
  grid-template-columns: 2rem 1fr 3rem;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.horse-list-item:nth-child(even) {
  background: var(--color-surface-muted);
}
.horse-list-item__number {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}
.horse-list-item__condition {
  text-align: right;
  font-family: var(--font-mono);
}
</style>
