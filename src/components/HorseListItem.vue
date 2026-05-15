<script setup lang="ts">
import type { Horse } from '../domain/types'

defineProps<{ horse: Horse }>()
</script>

<template>
  <li class="horse-list-item">
    <span class="horse-list-item__name">{{ horse.name }}</span>
    <span class="horse-list-item__condition">{{ horse.condition }}</span>
  </li>
</template>

<style scoped>
.horse-list-item {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
}
</style>
