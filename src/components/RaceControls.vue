<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { PHASE_RESTING } from '../domain/constants'
import { NotEnoughFitHorsesError } from '../domain/errors'
import { useRaceStore } from '../stores/race'

// Server is authoritative for rest: `race.restingUntil` (epoch ms) is set by
// POST /api/horses/rest and cleared by the lazy-bump on GET /api/horses
// (see BUSINESS_LOGIC.md §4.7 / ARCHITECTURE.md decision #29). This tick is
// purely a render trigger so the displayed remaining seconds tick down between
// the 1s polls; it never advances or ends the rest itself.
const DISPLAY_TICK_MS = 250

const race = useRaceStore()
const lastWarning = ref<string | null>(null)
const displayNowMs = ref<number>(Date.now())
const displayTickHandle = setInterval(() => {
  displayNowMs.value = Date.now()
}, DISPLAY_TICK_MS)
onUnmounted(() => clearInterval(displayTickHandle))

// Display value derived from server's restingUntil; null when not RESTING.
const secondsUntilRestComplete = computed<number | null>(() => {
  if (race.phase !== PHASE_RESTING || race.restingUntil === null) return null
  return Math.max(0, Math.ceil((race.restingUntil - displayNowMs.value) / 1000))
})

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
    <p
      v-if="secondsUntilRestComplete !== null"
      class="race-controls__countdown"
      data-testid="countdown"
    >
      Resting — {{ secondsUntilRestComplete }}s
    </p>
  </div>
</template>
