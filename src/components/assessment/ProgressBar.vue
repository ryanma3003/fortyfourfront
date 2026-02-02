<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  answered: number;
  total: number;
  currentPage: number;
  totalPages: number;
  questionsPerPage: number;
}>();

// Calculate percentage
const percentage = computed(() => {
  return props.total > 0 ? Math.round((props.answered / props.total) * 100) : 0;
});

// Calculate question range for current page
const questionRange = computed(() => {
  const start = (props.currentPage - 1) * props.questionsPerPage + 1;
  const end = Math.min(props.currentPage * props.questionsPerPage, props.total);
  return { start, end };
});

// Progress bar color
const progressColor = computed(() => {
  const pct = percentage.value;
  if (pct < 25) return 'bg-danger';
  if (pct < 50) return 'bg-warning';
  if (pct < 75) return 'bg-info';
  return 'bg-success';
});
</script>

<template>
  <div class="progress-bar-component mb-4">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <div>
        <h6 class="mb-0">Overall Progress</h6>
        <small class="text-muted">{{ answered }} / {{ total }} pertanyaan ({{ percentage }}%)</small>
      </div>
      <div class="text-end">
        <small class="text-success">
          <i class="ri-save-line me-1"></i>
          Disimpan otomatis
        </small>
        <br>
        <small class="text-muted">
          Pertanyaan {{ questionRange.start }}–{{ questionRange.end }} dari {{ total }}
        </small>
      </div>
    </div>
    
    <!-- Progress Bar -->
    <div class="progress" style="height: 20px;">
      <div 
        :class="['progress-bar', progressColor]" 
        role="progressbar" 
        :style="{ width: percentage + '%' }"
        :aria-valuenow="percentage"
        aria-valuemin="0" 
        aria-valuemax="100"
      >
        <span class="fw-semibold">{{ percentage }}%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.progress-bar-component {
  padding: 1rem;
  background: var(--custom-white);
  border: 1px solid var(--default-border);
  border-radius: 0.5rem;
}

.progress {
  border-radius: 10px;
  overflow: hidden;
}

.progress-bar {
  transition: width 0.6s ease;
  font-size: 0.875rem;
}
</style>
