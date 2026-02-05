<script setup lang="ts">
import { computed } from 'vue';
import type { KseQuestion } from '@/data/kse-data';

const props = defineProps<{
  question: KseQuestion;
  selectedOption?: 'A' | 'B' | 'C' | null;
}>();

const emit = defineEmits<{
  (e: 'answer', questionNo: string, optionKey: 'A' | 'B' | 'C', bobot: number): void;
}>();

const handleSelect = (key: 'A' | 'B' | 'C', bobot: number) => {
  emit('answer', props.question.no, key, bobot);
};

const getOptionColorClass = (key: string) => {
  switch (key) {
    case 'A': return 'key-a';
    case 'B': return 'key-b';
    case 'C': return 'key-c';
    default: return '';
  }
};
</script>

<template>
  <div class="question-card card custom-card mb-3">
    <div class="card-body">
      <!-- Header -->
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div>
          <span class="badge bg-primary-transparent me-2 text-primary">No. {{ question.no }}</span>
        </div>
        <span v-if="selectedOption" class="badge bg-success-transparent text-success">
          <i class="ri-check-line me-1"></i> Terjawab
        </span>
      </div>

      <!-- Question Text -->
      <div class="question-text mb-4">
        <h6 class="mb-2 fw-bold text-dark">{{ question.pertanyaan }}</h6>
        <div class="data-dukung p-3 bg-light rounded border border-dashed">
          <small class="text-muted d-block fw-semibold mb-1">
            <i class="ri-folder-info-line me-1"></i> Keterangan:
          </small>
          <p class="mb-0 fs-13 text-primary">{{ question.dataDukung }}</p>
        </div>
      </div>

      <!-- Options -->
      <div class="options-container">
        <div 
          v-for="(option, key) in question.options" 
          :key="key"
          class="option-item"
          :class="{ 'selected': selectedOption === key }"
          @click="handleSelect(key as 'A' | 'B' | 'C', option.bobot)"
        >
          <div class="d-flex align-items-center gap-3 w-100">
            <!-- Key Badge (A/B/C) -->
            <div class="option-key" :class="getOptionColorClass(String(key))">
              {{ key }}
            </div>
            
            <!-- Label -->
            <div class="flex-grow-1">
              <span class="option-label">{{ option.label }}</span>
            </div>

            <!-- Bobot Badge -->
            <div class="option-bobot">
                <span class="badge bg-light text-dark border">Bobot: {{ option.bobot }}</span>
            </div>
          </div>
        </div>
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.data-dukung {
    background-color: #f8f9fa;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 8px;
  border: 2px solid #e9ecef;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
}

.option-item:hover {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.option-item.selected {
  border-color: var(--primary-color);
  background: rgba(8, 70, 150, 0.05);
}

.option-key {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.key-c { background: rgb(0, 201, 167); } /* Green-ish */
.key-b { background: rgb(253, 175, 34); } /* Orange-ish */
.key-a { background: rgb(255, 103, 87); } /* Red-ish */

.option-label {
  font-weight: 500;
  color: var(--default-text-color);
}
</style>
