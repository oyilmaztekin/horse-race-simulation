<script setup lang="ts">
defineProps<{ color: string }>()
</script>

<template>
  <span class="color-swatch" :style="{ backgroundColor: color }" />
</template>

<style scoped>
.color-swatch {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 2px;
}
</style>
