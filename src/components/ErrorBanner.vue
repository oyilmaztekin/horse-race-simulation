<script setup lang="ts">
import { computed } from 'vue'
import { useHorsesStore } from '../stores/horses'

const horses = useHorsesStore()

const isRosterEmpty = computed(() => !horses.isLoading && horses.horses.length === 0)
const isVisible = computed(() => horses.error !== null || isRosterEmpty.value)

const message = computed(() => {
  if (horses.error) return horses.error.message
  return 'No horses available. Tap Retry to load the roster.'
})

function onRetry() {
  horses.fetchAll()
}
</script>

<template>
  <div v-if="isVisible" class="error-banner" :data-testid="'error-banner'" role="alert">
    <span class="error-banner__message">{{ message }}</span>
    <button
      type="button"
      class="error-banner__retry"
      :data-testid="'btn-retry'"
      @click="onRetry"
    >
      Retry
    </button>
  </div>
</template>

<style scoped>
.error-banner {
  @apply flex items-center justify-between gap-s4 py-s3 px-s5 mx-s4 mt-s3 rounded font-body text-sm;
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
  border: 1px solid var(--color-warning-border);
}
.error-banner__retry {
  @apply py-s1 px-s4 cursor-pointer font-racing uppercase tracking-widest text-xs rounded-pill;
  background: var(--color-warning-border);
  color: var(--color-primary-text);
  transition: filter 150ms ease;
}
.error-banner__retry:hover {
  filter: brightness(1.1);
}
</style>
