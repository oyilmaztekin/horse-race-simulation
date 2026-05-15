<script setup lang="ts">
import { ref } from 'vue'
import { NotEnoughFitHorsesError } from '../domain/errors'
import { useRaceStore } from '../stores/race'

const race = useRaceStore()
const lastWarning = ref<string | null>(null)

function onGenerate(): void {
  try {
    race.generateProgram()
    lastWarning.value = null
  } catch (error: unknown) {
    if (error instanceof NotEnoughFitHorsesError) {
      lastWarning.value = `Cannot generate: only ${error.fitCount} of ${error.required} horses are fit to race.`
      return
    }
    throw error
  }
}
</script>

<template>
  <div class="race-controls">
    <button
      type="button"
      class="race-controls__button"
      data-testid="btn-generate"
      :disabled="!race.canGenerate"
      @click="onGenerate"
    >
      Generate Program
    </button>
    <button
      type="button"
      class="race-controls__button"
      data-testid="btn-start"
      :disabled="!race.canStart"
      @click="race.start()"
    >
      Start
    </button>
    <p
      v-if="lastWarning"
      class="race-controls__warning"
      data-testid="warning"
      role="alert"
    >
      {{ lastWarning }}
    </p>
    <button
      v-if="lastWarning"
      type="button"
      class="race-controls__button race-controls__button--rest"
      data-testid="btn-rest"
      :disabled="!race.canRest"
      @click="race.rest()"
    >
      Rest the horses
    </button>
  </div>
</template>
