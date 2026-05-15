<script setup lang="ts">
defineProps<{
  color: string
  progress: number
  condition: number
}>()
</script>

<template>
  <div class="horse-sprite" :style="{ '--horse-progress': progress }">
    <span class="horse-sprite__condition">{{ condition }}</span>
    <svg
      class="horse-sprite__svg"
      viewBox="0 0 32 16"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="16" cy="10" rx="14" ry="5" :fill="color" />
      <circle cx="28" cy="7" r="3" :fill="color" />
    </svg>
  </div>
</template>

<style scoped>
.horse-sprite {
  --horse-progress: 0;
  position: absolute;
  left: calc(var(--horse-progress) * 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translateX(-50%);
}
.horse-sprite__condition {
  font-size: 0.7rem;
  line-height: 1;
}
.horse-sprite__svg {
  width: 2rem;
  height: 1rem;
}
</style>
