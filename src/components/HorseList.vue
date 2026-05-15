<script setup lang="ts">
import { useHorsesStore } from '../stores/horses'
import HorseListItem from './HorseListItem.vue'

const horses = useHorsesStore()
</script>

<template>
  <ul class="horse-list">
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
</template>
