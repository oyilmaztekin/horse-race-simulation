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
      lastWarning.value = `Cannot generate: Only ${error.fitCount} of ${error.required} horses' conditions are fit for the race. Horses should rest`;
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
  @apply flex items-center gap-s2 flex-wrap;
}
.race-controls__button {
  @apply py-s2 px-s5 rounded font-racing text-sm uppercase cursor-pointer tracking-widest;
  background: linear-gradient(180deg, #fcd34d 0%, var(--color-current) 100%);
  color: var(--color-primary-text);
  border: 1px solid var(--color-current);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.35) inset,
    0 8px 18px rgba(251, 191, 36, 0.18);
  transition: transform 150ms ease, box-shadow 200ms ease, filter 200ms ease;
}
.race-controls__button:hover:not(:disabled) {
  filter: brightness(1.08);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.4) inset,
    0 0 0 1px var(--color-current),
    0 8px 28px rgba(251, 191, 36, 0.45);
}
.race-controls__button:active:not(:disabled) {
  transform: translateY(1px);
}
.race-controls__button:disabled {
  @apply cursor-not-allowed;
  background: var(--color-surface-elevated);
  color: var(--color-text-muted);
  border-color: var(--color-border);
  box-shadow: none;
}
.race-controls__button--rest {
  background: linear-gradient(180deg, rgba(34, 211, 238, 0.15) 0%, rgba(34, 211, 238, 0.05) 100%);
  color: var(--color-program-header);
  border-color: rgba(34, 211, 238, 0.55);
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.25) inset;
}
.race-controls__button--rest:hover:not(:disabled) {
  filter: none;
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.6) inset,
    0 0 24px rgba(34, 211, 238, 0.35);
}
.race-controls__warning {
  @apply w-full py-s2 px-s3 rounded text-sm font-body;
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  color: var(--color-warning-text);
}
.race-controls__countdown {
  @apply font-mono text-sm py-s1 px-s3 rounded-pill;
  background: rgba(251, 191, 36, 0.1);
  color: var(--color-current);
  border: 1px solid rgba(251, 191, 36, 0.35);
}
</style>
