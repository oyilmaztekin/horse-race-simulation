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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: #fff3cd;
  border: 1px solid #ffe69c;
  border-radius: 4px;
}
.error-banner__retry {
  padding: 0.25rem 0.75rem;
  cursor: pointer;
}
</style>
