<script setup lang="ts">
import { computed, ref } from "vue";
import { NotEnoughFitHorsesError } from "../domain/errors";
import { useRaceStore } from "../stores/race";

// The server owns the rest timer (POST /api/horses/rest sets restingUntil,
// GET /api/horses returns the up-to-date remainingRestMs and lazy-bumps on
// expiry — BUSINESS_LOGIC.md §4.7 / ARCHITECTURE.md decision #29). This
// component reads what the most recent poll told us; useRestPolling is the
// heartbeat that refreshes the value.
const MS_PER_SECOND = 1000;

const race = useRaceStore();
const lastWarning = ref<string | null>(null);

 const secondsUntilRestComplete = computed<number | null>(() =>
    race.restingMsRemaining
      ? Math.max(0, Math.ceil(race.restingMsRemaining / MS_PER_SECOND))
      : null,
  )

function onGenerate(): void {
  try {
    race.generateProgram();
    lastWarning.value = null;
  } catch (error: unknown) {
    if (error instanceof NotEnoughFitHorsesError) {
      lastWarning.value = `Cannot generate: only ${error.fitCount} of ${error.required} horses are fit to race.`;
      return;
    }
    throw error;
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

<style scoped>
.race-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.race-controls__button {
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-2);
  font-weight: 600;
  font-size: var(--font-size-sm);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}
.race-controls__button:hover:not(:disabled) {
  background: var(--color-surface-muted);
}
.race-controls__button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.race-controls__button--rest {
  background: var(--color-warning-bg);
  border-color: var(--color-warning-border);
}
.race-controls__warning {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius-2);
  font-size: var(--font-size-sm);
}
.race-controls__countdown {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}
</style>
