<script setup lang="ts">
const props = defineProps<{
  currentPage: number;
  totalPages: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
}>();

const emit = defineEmits<{
  (e: 'previous'): void;
  (e: 'next'): void;
}>();
</script>

<template>
  <div class="pagination-control d-flex justify-content-between align-items-center mt-4">
    <button 
      class="btn btn-outline-secondary"
      :disabled="!canGoPrevious"
      @click="emit('previous')"
    >
      <i class="ri-arrow-left-line me-1"></i>
      Previous
    </button>

    <div class="page-indicator">
      <span class="fw-semibold">Halaman {{ currentPage }} dari {{ totalPages }}</span>
    </div>

    <button 
      class="btn btn-primary"
      :disabled="!canGoNext"
      @click="emit('next')"
    >
      Next
      <i class="ri-arrow-right-line ms-1"></i>
    </button>
  </div>
</template>

<style scoped>
.pagination-control {
  padding: 1rem;
  background: var(--custom-white);
  border: 1px solid var(--default-border);
  border-radius: 0.5rem;
}

.page-indicator {
  text-align: center;
  color: var(--default-text-color);
}
</style>
