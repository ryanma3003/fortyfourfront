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
  <div class="pagination-control">
    <button 
      class="pg-btn pg-btn-prev"
      :class="{ 'pg-btn-disabled': !canGoPrevious }"
      :disabled="!canGoPrevious"
      @click="emit('previous')"
    >
      <i class="ri-arrow-left-s-line pg-btn-icon"></i>
      <span>Sebelumnya</span>
    </button>

    <div class="pg-indicator">
      <span class="pg-current">{{ currentPage }}</span>
      <span class="pg-separator">/</span>
      <span class="pg-total">{{ totalPages }}</span>
    </div>

    <button 
      class="pg-btn pg-btn-next"
      :class="{ 'pg-btn-disabled': !canGoNext }"
      :disabled="!canGoNext"
      @click="emit('next')"
    >
      <span>Selanjutnya</span>
      <i class="ri-arrow-right-s-line pg-btn-icon"></i>
    </button>
  </div>
</template>

<style scoped>
.pagination-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.03);
}

/* Buttons */
.pg-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border: 1.5px solid rgba(0,0,0,0.08);
  border-radius: 10px;
  background: #ffffff;
  color: #334155;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
  font-family: 'Inter', sans-serif;
}

.pg-btn:hover:not(.pg-btn-disabled) {
  border-color: rgba(59,130,246,0.3);
  color: #1e40af;
  background: rgba(59,130,246,0.04);
  box-shadow: 0 4px 12px rgba(59,130,246,0.1);
  transform: translateY(-1px);
}

.pg-btn:active:not(.pg-btn-disabled) {
  transform: scale(0.97);
  transition-duration: 0.1s;
}

.pg-btn-next {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-color: transparent;
  color: white;
  box-shadow: 0 2px 8px rgba(59,130,246,0.25);
}
.pg-btn-next:hover:not(.pg-btn-disabled) {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: white;
  box-shadow: 0 4px 16px rgba(59,130,246,0.35);
}

.pg-btn-disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.pg-btn-icon {
  font-size: 18px;
}

/* Indicator */
.pg-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 600;
}
.pg-current {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 2px 6px rgba(59,130,246,0.25);
}
.pg-separator {
  color: #cbd5e1;
  font-weight: 400;
}
.pg-total {
  color: #94a3b8;
  font-weight: 600;
}

/* ========== DARK MODE ========== */
[data-theme-mode="dark"] .pagination-control {
  background: #1e293b;
  border-color: rgba(255,255,255,0.06);
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}
[data-theme-mode="dark"] .pg-btn {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.08);
  color: #cbd5e1;
}
[data-theme-mode="dark"] .pg-btn:hover:not(.pg-btn-disabled) {
  border-color: rgba(96,165,250,0.3);
  color: #60a5fa;
  background: rgba(96,165,250,0.08);
  box-shadow: 0 4px 12px rgba(96,165,250,0.1);
}
[data-theme-mode="dark"] .pg-btn-next {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-color: transparent;
  color: white;
}
[data-theme-mode="dark"] .pg-separator { color: #475569; }
[data-theme-mode="dark"] .pg-total { color: #64748b; }
</style>
