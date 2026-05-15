<script setup lang="ts">
defineProps<{ color: string }>()
</script>

<template>
  <span class="color-swatch" :style="{ backgroundColor: color }" />
</template>

<style scoped>
.color-swatch {
  @apply inline-block w-3 h-3 rounded-sm;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4),
    0 0 0 2px rgba(255, 255, 255, 0.06);
}
</style>
