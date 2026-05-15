<script setup lang="ts">
defineProps<{
  color: string
  progress: number
  condition: number
}>()
</script>

<template>
  <div class="horse-sprite" :style="{ '--horse-progress': progress }">
    <span class="horse-sprite__condition"><small>condition</small>: <b>{{ condition }}</b></span>
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
  @apply absolute flex flex-col items-center gap-[2px];
  left: calc(var(--horse-progress) * 100%);
  transform: translate(-50%, -50%);
  top: 50%;
  transition: left 100ms linear;
}
.horse-sprite__condition {
  @apply font-mono leading-none text-[0.65rem] py-[1px] px-[6px] rounded-pill;
  background: rgba(15, 23, 41, 0.85);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
.horse-sprite__condition b {
  color: var(--color-success);
}
.horse-sprite__svg {
  @apply w-10 h-5;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}
</style>
