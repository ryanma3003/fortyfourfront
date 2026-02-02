<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Question, AnswerIndex } from '@/types/assessment.types';

const props = defineProps<{
  question: Question;
  questionNumber: number;
  selectedIndex?: AnswerIndex;
}>();

const emit = defineEmits<{
  (e: 'answer', questionId: string, index: AnswerIndex): void;
}>();

// Local state for selected index
const selectedAnswer = ref<AnswerIndex | undefined>(props.selectedIndex);

// Watch for prop changes (when navigating between pages)
watch(() => props.selectedIndex, (newValue) => {
  selectedAnswer.value = newValue;
});

// Index options 0-5
const indexOptions = [0, 1, 2, 3, 4, 5];

// Handle index selection
const selectIndex = (index: number) => {
  // Allow selecting index even if NA is currently selected (clears NA)
  selectedAnswer.value = index as AnswerIndex;
  emit('answer', props.question.id, index as AnswerIndex);
};

// Handle NA selection (toggle on/off)
const selectNA = () => {
  if (selectedAnswer.value === 'NA') {
    // If already NA, deselect it (clear answer)
    selectedAnswer.value = undefined;
    emit('answer', props.question.id, 0); // Reset to index 0
  } else {
    // Select NA
    selectedAnswer.value = 'NA';
    emit('answer', props.question.id, 'NA');
  }
};

// Get description for selected index
const selectedDescription = computed(() => {
  if (selectedAnswer.value === 'NA' || selectedAnswer.value === undefined) {
    return null;
  }
  return props.question.indexDescriptions[selectedAnswer.value];
});

// Scope badge color
const scopeColor = computed(() => {
  switch (props.question.scope) {
    case 'Tata Kelola':
      return 'bg-primary';
    case 'Sumber Daya Manusia':
      return 'bg-success';
    case 'Teknologi':
      return 'bg-info';
    default:
      return 'bg-secondary';
  }
});
</script>

<template>
  <div class="question-card card custom-card mb-3">
    <div class="card-body">
      <!-- Question Header -->
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div>
          <span :class="['badge', scopeColor, 'me-2']">{{ question.scope }}</span>
          <span class="text-muted">Pertanyaan {{ questionNumber }}</span>
        </div>
        <span v-if="selectedAnswer !== undefined" class="badge bg-success">
          <i class="ri-check-line"></i> Terjawab
        </span>
      </div>

      <!-- Question Text -->
      <div class="question-text mb-4">
        <h6 class="mb-0">{{ question.text }}</h6>
      </div>

      <!-- Index Options -->
      <div class="index-options mb-3">
        <label class="form-label fw-semibold">Pilih Index:</label>
        <div class="d-flex flex-wrap gap-2">
          <button
            v-for="index in indexOptions"
            :key="index"
            type="button"
            class="btn btn-outline-primary index-btn"
            :class="{ 'active': selectedAnswer === index, 'dimmed': selectedAnswer === 'NA' }"
            @click="selectIndex(index)"
          >
            Index {{ index }}
          </button>
        </div>
      </div>

      <!-- NA Option -->
      <div class="na-option mb-3">
        <button
          type="button"
          class="btn btn-outline-secondary"
          :class="{ 'active': selectedAnswer === 'NA' }"
          @click="selectNA"
        >
          <i class="ri-close-circle-line me-1"></i>
          Not Applicable
        </button>
      </div>

      <!-- Description Display -->
      <div v-if="selectedDescription" class="description-box mt-3">
        <div class="alert alert-info mb-0">
          <strong>Index {{ selectedAnswer }} - Deskripsi:</strong>
          <p class="mb-0 mt-2">{{ selectedDescription }}</p>
        </div>
      </div>

      <!-- NA Message -->
      <div v-if="selectedAnswer === 'NA'" class="alert alert-warning mb-0 mt-3">
        <i class="ri-information-line me-1"></i>
        Pertanyaan ini ditandai sebagai <strong>Not Applicable</strong> dan tidak akan diikutsertakan dalam perhitungan.
      </div>
    </div>
  </div>
</template>

<style scoped>
.question-card {
  border: 1px solid var(--default-border);
  transition: all 0.3s ease;
}

.question-card:hover {
  box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.1);
}

.question-text h6 {
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.6;
  color: var(--default-text-color);
}

.index-btn {
  min-width: 90px;
  font-weight: 500;
}

.index-btn.active {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.index-btn.dimmed {
  opacity: 0.4;
  position: relative;
}

.index-btn.dimmed::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.3);
  pointer-events: none;
}

.description-box {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.alert {
  border-left: 4px solid currentColor;
}
</style>
