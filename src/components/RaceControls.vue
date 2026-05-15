<script setup lang="ts">
import { useRaceStore } from '../stores/race'

const race = useRaceStore()
</script>

<template>
  <div class="race-controls">
    <button
      type="button"
      class="race-controls__button"
      data-testid="btn-generate"
      :disabled="!race.canGenerate"
    >
      Generate Program
    </button>
    <button
      type="button"
      class="race-controls__button"
      data-testid="btn-start"
      :disabled="!race.canStart"
    >
      Start
    </button>
  </div>
</template>
