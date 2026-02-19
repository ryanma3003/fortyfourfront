<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

const props = defineProps<{
  answered: number;
  total: number;
  currentPage: number;
  totalPages: number;
  title?: string;
}>();

const isUpdating = ref(false);
const displayPercentage = ref(0);
const percentage = computed(() => props.total > 0 ? Math.round((props.answered / props.total) * 100) : 0);

// Theme based on progress
const theme = computed(() => {
  const p = percentage.value;
  if (p <= 30) return { bar: 'progress-red', text: 'text-red', subtle: 'bg-red-subtle', hex: '#ff5e6c', glow: 'glow-red' };
  if (p <= 70) return { bar: 'progress-orange', text: 'text-orange', subtle: 'bg-orange-subtle', hex: '#ffb142', glow: 'glow-orange' };
  return { bar: 'progress-green', text: 'text-green', subtle: 'bg-green-subtle', hex: '#2ecc71', glow: 'glow-green' };
});

// Trigger update animation on progress increase
watch(percentage, (newVal, oldVal) => {
  if (newVal > oldVal) {
    isUpdating.value = true;
    setTimeout(() => { isUpdating.value = false; }, 1500);
  }
  animateValue(oldVal, newVal);
});

// Animated number counter
function animateValue(start: number, end: number) {
  const duration = 1500;
  const startTime = performance.now();
  const step = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    displayPercentage.value = Math.floor(start + (end - start) * ease);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

onMounted(() => {
  displayPercentage.value = percentage.value;
  generateShapes();
  generateLines();
});

const backgroundShapes = ref<{ id: number; icon: string; variantClass: string; style: any }[]>([]);

function generateShapes() {
  const shapes = [];
  const icons = ['ri-key-2-line', 'ri-shield-keyhole-line', 'ri-lock-password-line', 'ri-fingerprint-line', 'ri-bug-line'];
  
  for (let i = 0; i < 12; i++) {
    // Randomize Icon
    const icon = icons[Math.floor(Math.random() * icons.length)];
    
    // Randomize Style
    const top = Math.floor(Math.random() * 100); // 0% to 100%
    const duration = 25 + Math.random() * 35; // Slow & smooth
    const delay = -(Math.random() * 20); 
    
    // Randomize Size
    const isLarge = Math.random() > 0.8; 
    const size = isLarge ? (3 + Math.random() * 15) : (18 + Math.random() * 10);

    // Randomize Color Variant (Sky Blue, Deep Blue, Slate)
    const variantRand = Math.random();
    let variantClass = '';
    
    if (variantRand > 0.6) {
        // Sky Blue (Original)
        variantClass = 'shape-sky';
    } else if (variantRand > 0.3) {
        // Deep Blue (New) - darker, richer
        variantClass = 'shape-deep';
    } else {
        // Slate/Black (Original)
        variantClass = 'shape-slate';
    }
      
    // Random Drift
    const driftY = Math.floor(Math.random() * 60 - 30); 

    shapes.push({
      id: i,
      icon,
      variantClass, // Pass class instead of inline color matching
      style: {
        top: `${top}%`,
        left: '-10%',
        fontSize: `${size}px`,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
        '--drift-y': `${driftY}px`
      }
    });
  }
  backgroundShapes.value = shapes;
}
const movingLines = ref<{ id: number; style: any }[]>([]);

function generateLines() {
  const lines = [];
  for (let i = 0; i < 18; i++) {
    const top = Math.random() * 100;
    const width = 30 + Math.random() * 80; // thin lines of varying width
    const height = 0.5 + Math.random() * 1.2; // very thin
    const duration = 12 + Math.random() * 25;
    const delay = -(Math.random() * 20);
    const opacity = 0.04 + Math.random() * 0.1;
    const angle = -2 + Math.random() * 4; // slight tilt
    const isBlue = Math.random() > 0.5;
    lines.push({
      id: i,
      style: {
        top: `${top}%`,
        width: `${width}px`,
        height: `${height}px`,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
        opacity,
        transform: `rotate(${angle}deg)`,
        background: isBlue
          ? 'linear-gradient(90deg, transparent, #3b82f6, transparent)' // blue
          : 'linear-gradient(90deg, transparent, #f97316, transparent)', // orange
      }
    });
  }
  movingLines.value = lines;
}
</script>

<template>
  <div 
    class="pb-wrapper"
    :style="{ '--theme-color': theme.hex, '--theme-color-soft': `${theme.hex}66` }"
  >
    <!-- HEADER -->
    <!-- HEADER (Ultra Futuristic V2) -->
    <!-- HEADER (V9 Linear Modern) -->
    <!-- HEADER (V9 Linear Modern / V10 Fluid) -->
    <!-- ROTATING BACKGROUND LAYER -->
    <div class="pb-rotating-bg">
      <!-- WAVE EFFECT (SVG SINE WAVES) -->
      <svg class="waves-container" viewBox="0 24 150 28" preserveAspectRatio="none" shape-rendering="auto">
        <defs>
          <path id="gentle-wave" d="M-160 44c30 0 58-12 88-12s 58 12 88 12 58-12 88-12 58 12 88 12 v44h-352z" />
        </defs>
        <g class="parallax-waves">
          <use xlink:href="#gentle-wave" x="48" y="5" fill="rgba(59,130,246,0.1)" />
          <use xlink:href="#gentle-wave" x="48" y="8" fill="rgba(249,115,22,0.1)" />
          <use xlink:href="#gentle-wave" x="48" y="10" fill="rgba(59,130,246,0.08)" />
          <use xlink:href="#gentle-wave" x="48" y="15" fill="rgba(249,115,22,0.05)" />
        </g>
      </svg>

      <!-- MOVING LINES -->
      <div 
        v-for="line in movingLines" 
        :key="'line-'+line.id" 
        class="moving-line"
        :style="line.style"
      />

      <!-- EXISTING MOVING SHAPES -->
      <div 
        v-for="shape in backgroundShapes" 
        :key="shape.id" 
        class="moving-shape" 
        :class="shape.variantClass"
        :style="shape.style"
      >
        <i :class="shape.icon"></i>
      </div>
    </div>

    <div class="pb-content-layer">
      <!-- HEADER -->
      <div class="pb-header-linear">
        <div class="pb-linear-scaffold">
          <!-- Left: Title & Badge -->
          <div class="linear-left">
            <div class="linear-badge-glass">
              <span>Progress Pengisian</span>
            </div>
            <div class="linear-titles">
              <h2 class="linear-title-glass">{{ props.title || 'Assessment' }}</h2>
            </div>
          </div>

          <!-- Right: Percentage -->
          <div class="linear-right">
            <div class="percent-group">
              <span class="linear-val-glass">{{ displayPercentage }}</span>
              <span class="linear-unit-glass">%</span>
            </div>
            <span class="count-sub">({{ answered }}/{{ total }})</span>
          </div>
        </div>
      </div>
      
      <!-- TRACK -->
      <div class="pb-track-wrapper">
        <div class="pb-track track-glass">
            <div 
              class="bar-container smooth-transition"
              :class="[theme.bar, theme.glow, { 'bar-updating': isUpdating }]"
              :style="{ width: percentage + '%' }"
            >
              <div class="shimmer"></div>
              <div class="glare-line"></div>
              
              <!-- Ambient Floating Particles -->
              <div class="ambient-particles">
                <span v-for="n in 8" :key="'amb-'+n" class="ambient-particle" :style="{ '--i': n }" />
              </div>

              <!-- Comet Runner -->
              <div class="pb-comet-area">
                <div class="comet-line comet-anim" />
                <div class="comet-line comet-line-secondary comet-anim anim-delay-1200" />
              </div>

              <!-- Tube Overlay -->
              <div class="tube-overlay" />

              <!-- Crystal Tip -->
              <div class="pb-crystal-container">
                <div 
                  class="pb-diamond smooth-transition"
                  :style="{ backgroundColor: theme.hex }"
                  :class="isUpdating ? 'crystal-active' : 'crystal-idle'"
                />
                <div class="crystal-inner-fire" :class="theme.bar" />
                <div class="crystal-glow-ring" />
                <div class="sparkle-trail">
                  <span v-for="n in 5" :key="'spark-'+n" class="trail-sparkle" :style="{ '--j': n }" />
                </div>
                <template v-if="isUpdating">
                  <div class="pb-burst-origin">
                    <span v-for="n in 10" :key="'burst-'+n" class="burst-particle" :style="{ '--angle': (n * 36) + 'deg' }" />
                  </div>
                </template>
              </div>
            </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="pb-footer-linear footer-glass">
        <div class="linear-prog-info">
          <span class="lin-step-label-glass">Halaman</span>
          <span class="lin-step-cur-glass">{{ currentPage }}</span>
          <span class="lin-step-div-glass">dari</span>
          <span class="lin-step-tot-glass">{{ totalPages }}</span>
        </div>

        <div class="linear-save-glass">
          <i class="ri-check-line lin-check-glass"></i>
          <span class="text-success fs-11 fw-medium">
          <i class="ri-checkbox-circle-line me-1"></i> Disimpan otomatis
        </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ========== KEYFRAMES ========== */
@keyframes liquidFlow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes shimmer {
  100% { transform: skewX(-20deg) translateX(250%); }
}

@keyframes floatUp {
  0%, 100% { transform: translateY(0) scale(0); opacity: 0; }
  20% { opacity: 0.9; transform: translateY(-2px) scale(1); }
  80% { opacity: 0.6; }
  100% { transform: translateY(-18px) scale(0.4); opacity: 0; }
}

@keyframes cometRun {
  0% { left: 0%; opacity: 0; width: 10px; }
  10% { opacity: 0.9; width: 40px; }
  90% { opacity: 0.9; width: 40px; }
  100% { left: 100%; opacity: 0; width: 10px; }
}

@keyframes crystalIdle {
  0%, 100% { transform: rotate(45deg) scale(1); box-shadow: 0 0 4px rgba(255,255,255,0.4), 0 0 8px var(--theme-color-soft); }
  50% { transform: rotate(45deg) scale(1.06); box-shadow: 0 0 8px rgba(255,255,255,0.7), 0 0 14px var(--theme-color); }
}

@keyframes crystalActive {
  0%, 100% { transform: rotate(45deg) scale(1); box-shadow: 0 0 6px rgba(255,255,255,0.6); }
  50% { transform: rotate(45deg) scale(1.12); box-shadow: 0 0 12px rgba(255,255,255,0.9), 0 0 20px var(--theme-color); }
}

@keyframes firePulse {
  0% { transform: rotate(45deg) scale(0.8); opacity: 0.7; }
  100% { transform: rotate(45deg) scale(1.2); opacity: 1; }
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.15); }
}

@keyframes sparkleTrail {
  0% { transform: translateX(20px) translateY(-50%) scale(1); opacity: 0.8; }
  100% { transform: translateX(-15px) translateY(-50%) scale(0); opacity: 0; }
}

@keyframes fallIn {
  0% { transform: translateY(0) scale(0) rotate(0deg); opacity: 0; }
  20% { opacity: 1; transform: translateY(12px) scale(1) rotate(90deg); }
  80% { opacity: 0.7; }
  100% { transform: translateY(55px) scale(0.2) rotate(180deg); opacity: 0; }
}

@keyframes burst {
  0% { transform: rotate(var(--angle)) translateX(0) scale(1); opacity: 1; }
  100% { transform: rotate(var(--angle)) translateX(30px) scale(0); opacity: 0; }
}

@keyframes textPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); text-shadow: 0 0 12px currentColor; }
  100% { transform: scale(1); }
}

@keyframes barBreathing {
  0%, 100% { filter: brightness(1); transform: scaleY(1); }
  50% { filter: brightness(1.08); transform: scaleY(1.03); }
}

/* ========== V10 FLUID LIGHT LAYOUT ========== */

.pb-wrapper {
  width: 100%;
  position: relative;
  border-radius: 16px;
  /* Make sure container clips the fluid bg */
  overflow: hidden; 
  /* Base background */
  background: #ffffff;
  box-shadow: 
    0 4px 20px -5px rgba(0,0,0,0.1),
    0 0 0 1px rgba(0,0,0,0.05);
  padding: 0; /* Content layer handles padding */
}

/* ========== ROTATING BACKGROUND ========== */
.pb-rotating-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.85); /* White semi-transparent */
}

/* PREMIUM ICON STYLES */
.moving-shape {
  position: absolute;
  width: auto;
  height: auto;
  /* Top, Left, Duration, Delay are now inline */
  
  background: transparent;
  border: none;
  backdrop-filter: none;
  
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform, opacity;
  
  /* Apply animation name here, duration/delay are inline */
  animation-name: floatRotate;
  animation-timing-function: linear; /* Smoother continuous flow */
  animation-iteration-count: infinite;
  
  /* Base Premium Style */
  opacity: 0.5;
  filter: drop-shadow(0 2px 4px rgba(148, 163, 184, 0.05)); /* Subtle shadow */
}

/* Gradient Text Effect for Icons */
.moving-shape i {
  display: block;
  transform: rotate(15deg);
  background: linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%); /* Default / Slate */
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 300; /* Thinner stroke */
}

/* Blue Variant (Sky) */
.moving-shape.shape-sky i {
  background: linear-gradient(135deg, #081a81 0%, #051686 100%); /* Sky Blue Gradient */
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Dark Variant (Deep Tech) */
.moving-shape.shape-slate i {
  background: linear-gradient(135deg, #475569 0%, #1e293b 100%); /* Slate Gradient */
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Deep Blue Variant (Rich) */
.moving-shape.shape-deep i {
  background: linear-gradient(135deg, #1e40af 0%, #172554 100%); /* Deep Blue Gradient */
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

@keyframes floatRotate {
  0% { transform: translate(0, 0) rotate(0deg) scale(0.9); opacity: 0; }
  10% { opacity: 0.6; transform: translate(10vw, calc(var(--drift-y) * 0.2)) rotate(45deg) scale(1); }
  90% { opacity: 0.6; transform: translate(90vw, calc(var(--drift-y) * 0.8)) rotate(315deg) scale(1); }
  100% { transform: translate(100vw, var(--drift-y)) rotate(360deg) scale(0.9); opacity: 0; }
}

/* ========== MOVING LINES ========== */
@keyframes lineSlide {
  0%   { left: -15%; opacity: 0; }
  10%  { opacity: var(--line-opacity, 0.07); }
  90%  { opacity: var(--line-opacity, 0.07); }
  100% { left: 110%; opacity: 0; }
}

.moving-line {
  position: absolute;
  border-radius: 2px;
  will-change: left, opacity;
  animation: lineSlide linear infinite;
  pointer-events: none;
  --line-opacity: 0.07;
}

/* ========== WAVE / RIPPLE EFFECT (SVG) ========== */
.waves-container {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 120px; /* Adjust height as needed */
  z-index: 1;
  pointer-events: none;
}

.parallax-waves > use {
  animation: move-forever 25s cubic-bezier(.55,.5,.45,.5) infinite;
}
.parallax-waves > use:nth-child(1) {
  animation-delay: -2s;
  animation-duration: 7s;
}
.parallax-waves > use:nth-child(2) {
  animation-delay: -3s;
  animation-duration: 10s;
}
.parallax-waves > use:nth-child(3) {
  animation-delay: -4s;
  animation-duration: 13s;
}
.parallax-waves > use:nth-child(4) {
  animation-delay: -5s;
  animation-duration: 20s;
}

@keyframes move-forever {
  0% {
    transform: translate3d(-90px, 0, 0);
  }
  100% {
    transform: translate3d(85px, 0, 0);
  }
}

/* Dark Mode Adaptation */
[data-theme-mode="dark"] .pb-rotating-bg { background: #0f172a; }
[data-theme-mode="dark"] .moving-shape i {
  background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  opacity: 0.5;
}

/* CONTENT LAYER (Sits on top of fluid) */
.pb-content-layer {
  position: relative;
  z-index: 10;
  padding: 12px 20px;
}

/* ========== STRUCTURE (Inherited from V9) ========== */
.pb-header-linear {
  margin-bottom: 8px;
}

.pb-linear-scaffold {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.linear-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.linear-titles {
  display: flex;
  flex-direction: column;
}

.linear-right {
  display: flex;
  align-items: baseline;
  text-align: right;
  gap: 8px;
  transform: translateY(3px); 
}

.percent-group {
  display: flex;
  align-items: baseline;
}

.count-sub {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}

.pb-footer-linear {
  display: flex;
  justify-content: space-between;
  align-items: center;
  /* top margin handled by footer-glass */
}

.linear-prog-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: 'Inter', sans-serif;
  font-size: 11px;
}

/* ========== TEXT STYLES (Glass Adapted) ========== */
.linear-badge-glass {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.4);
  padding: 4px 0 10px;
  border-radius: 100px;
  width: fit-content;
  font-size: 10px;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}
.active-dot-glass {
  width: 5px; height: 5px;
  background: #10B981;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(255,255,255,0.8);
}

.linear-title-glass {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  margin: 2px 0 0;
  line-height: 1.2;
}
.linear-sub-glass {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.linear-val-glass {
  font-family: 'Inter', sans-serif;
  font-size: 28px;
  font-weight: 800;
  /* Deep Blue/Purple for contrast against light bg */
  color: #334155; 
  letter-spacing: -0.03em;
  line-height: 1;
}
.linear-unit-glass {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #94a3b8;
  margin-left: 2px;
}

/* FOOTER GLASS */
.footer-glass {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(0,0,0,0.05);
}

.lin-step-label-glass { color: #000000; font-weight: 600; margin-right: 2px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;}
.lin-step-cur-glass { color: #144491; font-weight: 700; }
.lin-step-div-glass { color: #000000; }
.lin-step-tot-glass { color: #144491; font-weight: 600; }

.linear-save-glass {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #64748b;
  font-weight: 600;
  background: rgba(255,255,255,0.5);
  padding: 4px 8px;
  border-radius: 8px;
}
.lin-check-glass { font-size: 13px; color: #10B981; }

/* TRACK GLASS ADAPTATION */
.track-glass {
  background: rgba(0,0,0,0.05); /* Darker track for visibility */
  border: 1px solid rgba(255,255,255,0.4);
}

/* Dark Mode Overrides */
[data-theme-mode="dark"] .pb-fluid-bg { background: #0f172a; }
[data-theme-mode="dark"] .fluid-overlay { background: rgba(15, 23, 42, 0.6); }
[data-theme-mode="dark"] .blob-1 { background: #7c3aed; opacity: 0.3; } /* Deep Violet */
[data-theme-mode="dark"] .blob-2 { background: #db2777; opacity: 0.3; } /* Deep Pink */
[data-theme-mode="dark"] .linear-title-glass,
[data-theme-mode="dark"] .linear-val-glass,
[data-theme-mode="dark"] .lin-step-cur-glass { color: #f8fafc; }
[data-theme-mode="dark"] .linear-badge-glass,
[data-theme-mode="dark"] .linear-save-glass { 
  background: rgba(255,255,255,0.05); 
  border-color: rgba(255,255,255,0.1);
  color: #cbd5e1;
}
[data-theme-mode="dark"] .linear-sub-glass,
[data-theme-mode="dark"] .linear-unit-glass,
[data-theme-mode="dark"] .lin-step-tot-glass { color: #94a3b8; }

/* ========== TRACK ========== */
.pb-track-wrapper {
  position: relative;
  padding-top: 8px;
  padding-bottom: 6px;
  padding-right: 14px;
}

.pb-track {
  position: relative;
  height: 10px;
  border-radius: 8px;
  background: #e9ecef;
  overflow: visible;
}

.track-3d {
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.08), inset 0 -1px 1px rgba(255,255,255,0.4);
}

/* THE BAR */
.bar-container {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 12px;
  overflow: visible;
  transform-origin: center left;
  will-change: width, filter;
  transition: width 1.8s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.5s ease, filter 0.5s ease;
  z-index: 1;
  animation: barBreathing 3s ease-in-out infinite;
}

.bar-updating {
  filter: brightness(1.2) !important;
  animation: none;
  transform: scaleY(1.06);
}

/* ========== AMBIENT PARTICLES (from old) ========== */
.ambient-particles {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 12px;
  z-index: 5;
}

.ambient-particle {
  position: absolute;
  width: 3px;
  height: 3px;
  background: rgba(255,255,255,0.85);
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(255,255,255,0.9);
  animation: floatUp 3s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.4s);
  left: calc(var(--i) * 12%);
  bottom: 0;
}

/* ========== SHIMMER (from old) ========== */
.shimmer-clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 12px;
  z-index: 15;
  pointer-events: none;
}

.shimmer {
  position: absolute;
  top: 0;
  left: 0;
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%);
  transform: skewX(-20deg) translateX(-150%);
  animation: shimmer 2.5s infinite ease-in-out;
}

/* ========== TUBE OVERLAY (3D gloss) ========== */
.tube-overlay {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: linear-gradient(to bottom, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0) 55%, rgba(0,0,0,0.04) 100%);
  pointer-events: none;
  z-index: 18;
}



/* ========== COMET (from new) ========== */
.pb-comet-area {
  position: absolute;
  inset: 0;
  z-index: 12;
  pointer-events: none;
  overflow: hidden;
  border-radius: 12px;
}

.comet-line {
  position: absolute;
  top: 3px;
  height: 2px;
  background: linear-gradient(to right, transparent, rgba(255,255,255,0.9), transparent);
  opacity: 0.7;
  box-shadow: 0 0 6px rgba(255,255,255,0.5);
}

.comet-line-secondary {
  top: auto;
  bottom: 3px;
  height: 1.5px;
  opacity: 0.4;
}

.comet-anim { animation: cometRun 4s ease-in-out infinite; }
.anim-delay-1200 { animation-delay: 1.5s; }

/* ========== CRYSTAL TIP (mixed) ========== */
.pb-crystal-container {
  position: absolute;
  right: -10px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  z-index: 25;
  pointer-events: none;
}

.pb-diamond {
  width: 14px;
  height: 14px;
  position: absolute;
  top: 7px;
  left: 7px;
  border: 1.5px solid white;
  border-radius: 1px;
  z-index: 10;
}

.crystal-idle { animation: crystalIdle 3s ease-in-out infinite; }
.crystal-active { animation: crystalActive 0.6s ease-in-out infinite; }

.crystal-inner-fire {
  position: absolute;
  width: 7px;
  height: 7px;
  top: 10.5px;
  left: 10.5px;
  transform: rotate(45deg);
  animation: firePulse 0.6s infinite alternate;
  border-radius: 1px;
  z-index: 11;
}
.crystal-inner-fire.progress-red { background: #ff5e6c; box-shadow: 0 0 8px #ff5e6c; }
.crystal-inner-fire.progress-orange { background: #ffb142; box-shadow: 0 0 8px #ffb142; }
.crystal-inner-fire.progress-green { background: #2ecc71; box-shadow: 0 0 8px #2ecc71; }

.crystal-glow-ring {
  position: absolute;
  top: -6px;
  left: -6px;
  right: -6px;
  bottom: -6px;
  background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 65%);
  filter: blur(4px);
  opacity: 0.6;
  animation: glowPulse 2s infinite;
  pointer-events: none;
}

/* ========== TRAILING SPARKLES (from old) ========== */
.sparkle-trail {
  position: absolute;
  left: -20px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 18px;
}

.trail-sparkle {
  position: absolute;
  width: 3px;
  height: 3px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(255,255,255,0.8);
  animation: sparkleTrail 1.5s ease-out infinite;
  animation-delay: calc(var(--j) * 0.3s);
  left: calc(var(--j) * 4px);
  top: 50%;
}

/* ========== FALLING PARTICLES (on update) ========== */
.pb-falling-container {
  position: absolute;
  top: -10px;
  left: 0;
  right: 0;
  height: 50px;
  pointer-events: none;
  z-index: 5;
  overflow: hidden;
}

.falling-particle {
  position: absolute;
  top: 0;
  width: 4px;
  height: 4px;
  background: white;
  border-radius: 50%;
  left: var(--left);
  opacity: 0;
  box-shadow: 0 0 6px rgba(255,255,255,0.9);
  animation: fallIn 0.8s ease-in forwards;
  animation-delay: var(--delay);
}

/* ========== BURST (from old, simplified) ========== */
.pb-burst-origin {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  z-index: 20;
}

.burst-particle {
  position: absolute;
  width: 3px;
  height: 3px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 0 4px white;
  animation: burst 0.7s ease-out forwards;
}



/* ========== THEME COLORS ========== */
.progress-red {
  background: linear-gradient(90deg, #ff9aa2, #ff5e6c, #ff7675);
  background-size: 200% 200%;
  animation: liquidFlow 3s ease infinite;
}
.progress-orange {
  background: linear-gradient(90deg, #ffda79, #ffb142, #ffbe76);
  background-size: 200% 200%;
  animation: liquidFlow 3s ease infinite;
}
.progress-green {
  background: linear-gradient(90deg, #7bed9f, #2ecc71, #55efc4);
  background-size: 200% 200%;
  animation: liquidFlow 3s ease infinite;
}

.text-red { color: #ff5e6c; }
.text-orange { color: #ffb142; }
.text-green { color: #2ecc71; }

.bg-red-subtle { background: rgba(255, 94, 108, 0.08); border: 1px solid rgba(255, 94, 108, 0.15); }
.bg-orange-subtle { background: rgba(255, 177, 66, 0.08); border: 1px solid rgba(255, 177, 66, 0.15); }
.bg-green-subtle { background: rgba(46, 204, 113, 0.08); border: 1px solid rgba(46, 204, 113, 0.15); }

.glow-red { box-shadow: 0 0 10px rgba(255, 94, 108, 0.35); }
.glow-orange { box-shadow: 0 0 10px rgba(255, 177, 66, 0.35); }
.glow-green { box-shadow: 0 0 10px rgba(46, 204, 113, 0.35); }

/* ========== COMPREHENSIVE DARK MODE ========== */
[data-theme-mode="dark"] .pb-wrapper {
  background: #0f172a;
  box-shadow: 0 4px 20px -5px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06);
}
[data-theme-mode="dark"] .pb-track {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.06);
}
[data-theme-mode="dark"] .track-glass {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.08);
}
[data-theme-mode="dark"] .footer-glass {
  border-top-color: rgba(255,255,255,0.06);
}
[data-theme-mode="dark"] .lin-step-label-glass { color: #94a3b8; }
[data-theme-mode="dark"] .lin-step-cur-glass { color: #60a5fa; }
[data-theme-mode="dark"] .lin-step-div-glass { color: #475569; }
[data-theme-mode="dark"] .lin-step-tot-glass { color: #60a5fa; }
[data-theme-mode="dark"] .count-sub { color: #94a3b8; }

/* Dark mode SVG waves — brighter fills */
[data-theme-mode="dark"] .parallax-waves > use:nth-child(1) { fill: rgba(96,165,250,0.08); }
[data-theme-mode="dark"] .parallax-waves > use:nth-child(2) { fill: rgba(59,130,246,0.06); }
[data-theme-mode="dark"] .parallax-waves > use:nth-child(3) { fill: rgba(148,163,184,0.05); }
[data-theme-mode="dark"] .parallax-waves > use:nth-child(4) { fill: rgba(96,165,250,0.04); }

/* Dark mode moving lines */
[data-theme-mode="dark"] .moving-line {
  --line-opacity: 0.12;
}
</style>
