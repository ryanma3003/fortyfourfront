<script setup lang="ts">
import type { KseQuestion } from '../../data/kse-data';
import { ref } from 'vue';

const props = defineProps<{
  question: KseQuestion;
  selectedOption?: 'A' | 'B' | 'C' | null;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'answer', questionNo: string, optionKey: 'A' | 'B' | 'C', bobot: number): void;
}>();

// Ripple effect state
const ripple = ref<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });

const handleSelect = (key: 'A' | 'B' | 'C', bobot: number, event: MouseEvent) => {
  if (props.readonly) return;
  
  // Trigger ripple
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  ripple.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    show: true,
  };
  setTimeout(() => { ripple.value.show = false; }, 600);
  
  emit('answer', props.question.no, key, bobot);
};

const castToKey = (key: string | number | symbol): 'A' | 'B' | 'C' => {
    return key as 'A' | 'B' | 'C';
}

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
  <div 
    class="question-card" 
    :class="{ 'is-answered': selectedOption }"
  >
    <!-- Answered accent border -->
    <div class="card-accent" :class="{ 'accent-active': selectedOption }" />
    
    <div class="card-body">
      <!-- Header -->
      <div class="q-header">
        <div class="q-header-left">
          <span class="question-number">
            <i class="ri-questionnaire-line q-num-icon"></i>
            {{ question.no }}
          </span>
          <transition name="badge-pop">
            <span v-if="selectedOption" class="answered-badge">
              <i class="ri-check-double-fill"></i> Terjawab
            </span>
          </transition>
        </div>
      </div>

      <!-- Question Text -->
      <div class="question-text">
        <h6 class="question-hero">{{ question.pertanyaan }}</h6>
        
        <!-- Insight Box -->
        <div class="insight-box">
          <div class="insight-content">
            <div class="insight-icon">
              <i class="ri-lightbulb-flash-fill"></i>
            </div>
            <div>
              <small class="insight-label">Insight & Konteks</small>
              <p class="insight-desc">{{ question.dataDukung }}</p>
            </div>
          </div>
          <div class="insight-gradient"></div>
        </div>
      </div>

      <!-- Options -->
      <div class="options-container">
        <div 
          v-for="(option, key) in question.options" 
          :key="key"
          class="option-item"
          :class="[
            getOptionColorClass(String(key)) + '-hover',
            { 
              'selected': selectedOption === key,
              'not-selected': selectedOption && selectedOption !== key,
              'readonly': readonly,
            }
          ]"
          :style="{ '--delay': `${Object.keys(question.options).indexOf(String(key)) * 80}ms` }"
          @click="handleSelect(castToKey(key), option.bobot, $event)"
        >
          <!-- Ripple effect -->
          <span 
            v-if="ripple.show && selectedOption === key" 
            class="click-ripple"
            :style="{ left: ripple.x + 'px', top: ripple.y + 'px' }"
          />
          
          <!-- Selected gradient bg -->
          <div class="option-bg" :class="getOptionColorClass(String(key))"></div>
          
          <div class="option-inner">
            <!-- Key Badge -->
            <div 
              class="option-key" 
              :class="[getOptionColorClass(String(key)), { 'key-selected': selectedOption === key }]"
            >
              {{ key }}
            </div>
            
            <!-- Label -->
            <div class="option-label-wrap">
              <span class="option-label">{{ option.label }}</span>
            </div>

            <!-- Bobot -->
            <div class="option-bobot">
              <span class="bobot-badge">
                <i class="ri-star-s-fill bobot-star"></i>
                <span>{{ option.bobot }}</span>
              </span>
            </div>
            
            <!-- Checkmark -->
            <transition name="pop-in">
              <div v-if="selectedOption === key" class="selected-check">
                <div class="check-circle" :class="getOptionColorClass(String(key))">
                  <i class="ri-check-line"></i>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ========== CARD ========== */
.question-card {
  position: relative;
  background: #ffffff;
  border-radius: 20px;
  box-shadow:
    0 1px 3px rgba(0,0,0,0.04),
    0 8px 24px -4px rgba(0,0,0,0.08);
  border: 1px solid rgba(0,0,0,0.04);
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
  margin-bottom: 20px;
}

.question-card:hover {
  box-shadow:
    0 2px 6px rgba(0,0,0,0.06),
    0 16px 40px -8px rgba(0,0,0,0.12);
}

.question-card.is-answered {
  border-color: rgba(46, 204, 113, 0.2);
}

/* Left accent bar */
.card-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: #e2e8f0;
  border-radius: 20px 0 0 20px;
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.card-accent.accent-active {
  background: linear-gradient(180deg, #2ecc71, #27ae60);
  box-shadow: 2px 0 12px rgba(46,204,113,0.3);
}

.card-body {
  padding: 24px 24px 24px 28px;
}

/* ========== HEADER ========== */
.q-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.q-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.question-number {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 800;
  color: #1e40af;
  background: rgba(30, 64, 175, 0.06);
  padding: 6px 14px;
  border-radius: 10px;
  letter-spacing: -0.01em;
}
.q-num-icon {
  font-size: 15px;
  opacity: 0.7;
}

.answered-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #059669;
  background: rgba(5, 150, 105, 0.08);
  padding: 5px 12px;
  border-radius: 100px;
  letter-spacing: 0.02em;
}

/* Badge animation */
.badge-pop-enter-active { animation: badgePop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.badge-pop-leave-active { animation: badgePop 0.3s ease reverse; }
@keyframes badgePop {
  0% { opacity: 0; transform: scale(0.6) translateX(-10px); }
  100% { opacity: 1; transform: scale(1) translateX(0); }
}

/* ========== QUESTION TEXT ========== */
.question-text {
  margin-bottom: 20px;
  padding-left: 2px;
}

.question-hero {
  font-size: 1.05rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.6;
  letter-spacing: -0.02em;
  margin: 0 0 16px;
}

/* Insight Box */
.insight-box {
  position: relative;
  background: linear-gradient(135deg, rgba(241,245,249,0.9) 0%, rgba(226,232,240,0.4) 100%);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(226,232,240,0.8);
  padding: 16px;
  border-radius: 14px;
  overflow: hidden;
}
.insight-content {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  position: relative;
  z-index: 1;
}
.insight-icon {
  width: 34px;
  height: 34px;
  min-width: 34px;
  border-radius: 10px;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3b82f6;
  font-size: 17px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  border: 1px solid rgba(0,0,0,0.04);
}
.insight-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  color: #3b82f6;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 4px;
  opacity: 0.8;
}
.insight-desc {
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
  margin: 0;
}
.insight-gradient {
  position: absolute;
  top: -60%;
  right: -15%;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%);
  border-radius: 50%;
  z-index: 0;
  pointer-events: none;
}

/* ========== OPTIONS ========== */
.options-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-radius: 14px;
  cursor: pointer;
  background: #ffffff;
  border: 1.5px solid rgba(0,0,0,0.06);
  box-shadow: 0 1px 4px rgba(0,0,0,0.02);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  overflow: hidden;
  animation: slideUpFade 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
  animation-delay: var(--delay);
}

@keyframes slideUpFade {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Hover glow per color */
.option-item.key-a-hover:hover {
  border-color: rgba(255, 107, 107, 0.3);
  box-shadow: 0 4px 20px rgba(255, 107, 107, 0.12), 0 0 0 3px rgba(255, 107, 107, 0.06);
  transform: translateY(-2px);
}
.option-item.key-b-hover:hover {
  border-color: rgba(253, 175, 34, 0.3);
  box-shadow: 0 4px 20px rgba(253, 175, 34, 0.12), 0 0 0 3px rgba(253, 175, 34, 0.06);
  transform: translateY(-2px);
}
.option-item.key-c-hover:hover {
  border-color: rgba(0, 201, 167, 0.3);
  box-shadow: 0 4px 20px rgba(0, 201, 167, 0.12), 0 0 0 3px rgba(0, 201, 167, 0.06);
  transform: translateY(-2px);
}

.option-item:active:not(.readonly) {
  transform: scale(0.98);
  transition-duration: 0.1s;
}

/* Not selected = dimmed */
.option-item.not-selected {
  opacity: 0.55;
  transform: scale(0.98);
}
.option-item.not-selected:hover {
  opacity: 0.8;
  transform: scale(0.99);
}

/* Selected state */
.option-item.selected {
  border-color: transparent;
  box-shadow: 0 6px 20px rgba(0,0,0,0.08);
  transform: translateY(-1px);
}

/* Selected backgrounds */
.option-bg {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.4s ease;
  z-index: 0;
}
.option-item.selected .option-bg.key-a { 
  background: linear-gradient(135deg, #fff0f0 0%, #ffe5e5 100%); 
  opacity: 1; 
}
.option-item.selected .option-bg.key-b { 
  background: linear-gradient(135deg, #fff8e6 0%, #ffefcc 100%); 
  opacity: 1; 
}
.option-item.selected .option-bg.key-c { 
  background: linear-gradient(135deg, #e8fbf3 0%, #d5f7e8 100%); 
  opacity: 1; 
}

.option-inner {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  position: relative;
  z-index: 1;
}

/* Key Badge */
.option-key {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-weight: 800;
  color: white;
  flex-shrink: 0;
  font-size: 15px;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.key-c { background: linear-gradient(135deg, #00c9a7, #00b894); box-shadow: 0 4px 12px rgba(0,201,167,0.3); }
.key-b { background: linear-gradient(135deg, #fdaf22, #f39c12); box-shadow: 0 4px 12px rgba(253,175,34,0.3); }
.key-a { background: linear-gradient(135deg, #ff6b6b, #ee5253); box-shadow: 0 4px 12px rgba(255,107,107,0.3); }

.key-selected {
  transform: scale(1.1) rotate(5deg);
  box-shadow: 0 6px 16px rgba(0,0,0,0.2);
}

/* Label */
.option-label-wrap {
  flex: 1;
  min-width: 0;
}
.option-label {
  font-weight: 600;
  color: #334155;
  font-size: 14px;
  letter-spacing: -0.01em;
  line-height: 1.4;
}

/* Bobot */
.bobot-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 5px 10px;
  border-radius: 8px;
}
.bobot-star { color: #f59e0b; font-size: 13px; }

/* Check Circle */
.selected-check {
  flex-shrink: 0;
}
.check-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
}
.check-circle.key-a { background: #ee5253; }
.check-circle.key-b { background: #f39c12; }
.check-circle.key-c { background: #00b894; }

/* Pop In */
.pop-in-enter-active { animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes popIn {
  0% { transform: scale(0) rotate(-30deg); opacity: 0; }
  70% { transform: scale(1.2) rotate(5deg); opacity: 1; }
  100% { transform: scale(1) rotate(0); }
}

/* Click Ripple */
.click-ripple {
  position: absolute;
  width: 300px;
  height: 300px;
  margin-left: -150px;
  margin-top: -150px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 60%);
  animation: rippleExpand 0.6s ease-out forwards;
  pointer-events: none;
  z-index: 2;
}
@keyframes rippleExpand {
  0% { transform: scale(0); opacity: 1; }
  100% { transform: scale(1); opacity: 0; }
}

/* Readonly */
.option-item.readonly {
  cursor: default;
  pointer-events: none;
}

/* ========== COMPREHENSIVE DARK MODE ========== */
[data-theme-mode="dark"] .question-card {
  background: #1e293b;
  border-color: rgba(255,255,255,0.06);
  box-shadow: 0 1px 3px rgba(0,0,0,0.2), 0 8px 24px -4px rgba(0,0,0,0.3);
}
[data-theme-mode="dark"] .question-card:hover {
  box-shadow: 0 2px 6px rgba(0,0,0,0.3), 0 16px 40px -8px rgba(0,0,0,0.4);
}
[data-theme-mode="dark"] .question-card.is-answered {
  border-color: rgba(46, 204, 113, 0.15);
}

[data-theme-mode="dark"] .card-accent { background: #334155; }
[data-theme-mode="dark"] .card-accent.accent-active {
  background: linear-gradient(180deg, #2ecc71, #27ae60);
  box-shadow: 2px 0 12px rgba(46,204,113,0.2);
}

[data-theme-mode="dark"] .question-number {
  color: #60a5fa;
  background: rgba(96,165,250,0.1);
}
[data-theme-mode="dark"] .answered-badge {
  color: #34d399;
  background: rgba(52,211,153,0.1);
}
[data-theme-mode="dark"] .question-hero { color: #e2e8f0; }

/* Dark insight box */
[data-theme-mode="dark"] .insight-box {
  background: linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.6) 100%);
  border-color: rgba(255,255,255,0.06);
}
[data-theme-mode="dark"] .insight-icon {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.06);
  color: #60a5fa;
}
[data-theme-mode="dark"] .insight-label { color: #60a5fa; }
[data-theme-mode="dark"] .insight-desc { color: #94a3b8; }

/* Dark options */
[data-theme-mode="dark"] .option-item {
  background: rgba(255,255,255,0.03);
  border-color: rgba(255,255,255,0.06);
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
}
[data-theme-mode="dark"] .option-item.key-a-hover:hover {
  border-color: rgba(255,107,107,0.25);
  box-shadow: 0 4px 20px rgba(255,107,107,0.1), 0 0 0 3px rgba(255,107,107,0.05);
}
[data-theme-mode="dark"] .option-item.key-b-hover:hover {
  border-color: rgba(253,175,34,0.25);
  box-shadow: 0 4px 20px rgba(253,175,34,0.1), 0 0 0 3px rgba(253,175,34,0.05);
}
[data-theme-mode="dark"] .option-item.key-c-hover:hover {
  border-color: rgba(0,201,167,0.25);
  box-shadow: 0 4px 20px rgba(0,201,167,0.1), 0 0 0 3px rgba(0,201,167,0.05);
}

/* Dark selected backgrounds */
[data-theme-mode="dark"] .option-item.selected .option-bg.key-a {
  background: linear-gradient(135deg, rgba(255,71,87,0.12) 0%, rgba(255,71,87,0.04) 100%);
}
[data-theme-mode="dark"] .option-item.selected .option-bg.key-b {
  background: linear-gradient(135deg, rgba(255,165,2,0.12) 0%, rgba(255,165,2,0.04) 100%);
}
[data-theme-mode="dark"] .option-item.selected .option-bg.key-c {
  background: linear-gradient(135deg, rgba(46,213,115,0.12) 0%, rgba(46,213,115,0.04) 100%);
}

[data-theme-mode="dark"] .option-label { color: #e2e8f0; }
[data-theme-mode="dark"] .bobot-badge { background: rgba(255,255,255,0.06); color: #94a3b8; }
[data-theme-mode="dark"] .click-ripple {
  background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 60%);
}
</style>
