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
  @apply grid gap-s2 py-s2 px-s4 border-b border-border even:bg-surface-muted text-sm;
  grid-template-columns: 2.5rem 1fr 3.5rem;
  transition: background-color 150ms ease;
}
.horse-list-item:hover {
  background: var(--color-surface-elevated);
}
.horse-list-item__number {
  @apply font-mono;
  color: var(--color-current);
}
.horse-list-item__name {
  @apply font-body;
}
.horse-list-item__condition {
  @apply text-right font-mono font-bold;
  color: var(--color-success);
}
</style>
