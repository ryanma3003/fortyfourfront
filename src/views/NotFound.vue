<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const mouseX = ref(0);
const mouseY = ref(0);
const isVisible = ref(false);
const glitchActive = ref(false);
let glitchInterval = null;
let mouseMoveHandler = null;

const goHome = () => {
  router.push('/dashboard');
};

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/dashboard');
  }
};

onMounted(() => {
  // Stagger entrance
  setTimeout(() => { isVisible.value = true; }, 100);

  // Glitch effect interval
  glitchInterval = setInterval(() => {
    glitchActive.value = true;
    setTimeout(() => { glitchActive.value = false; }, 200);
  }, 4000);

  // Mouse parallax
  mouseMoveHandler = (e) => {
    mouseX.value = (e.clientX / window.innerWidth - 0.5) * 30;
    mouseY.value = (e.clientY / window.innerHeight - 0.5) * 30;
  };
  window.addEventListener('mousemove', mouseMoveHandler);

  // Add body class
  document.body.classList.add('notfound-active');
});

onUnmounted(() => {
  if (glitchInterval) clearInterval(glitchInterval);
  if (mouseMoveHandler) window.removeEventListener('mousemove', mouseMoveHandler);
  document.body.classList.remove('notfound-active');
});
</script>

<template>
  <div class="nf-page" :class="{ 'nf-visible': isVisible }">
    <!-- Background layer -->
    <div class="nf-bg">
      <div class="nf-grid-overlay"></div>
      <div class="nf-orb nf-orb-1" :style="{ transform: `translate(${mouseX * 0.4}px, ${mouseY * 0.4}px)` }"></div>
      <div class="nf-orb nf-orb-2" :style="{ transform: `translate(${mouseX * -0.3}px, ${mouseY * -0.3}px)` }"></div>
      <div class="nf-orb nf-orb-3" :style="{ transform: `translate(${mouseX * 0.2}px, ${mouseY * 0.2}px)` }"></div>
    </div>

    <!-- Floating particles -->
    <div class="nf-particles">
      <span v-for="n in 20" :key="n" class="nf-particle" :style="{
        '--delay': (n * 0.7) + 's',
        '--x': (Math.random() * 100) + '%',
        '--size': (Math.random() * 4 + 2) + 'px',
        '--duration': (Math.random() * 8 + 10) + 's',
        '--opacity': (Math.random() * 0.5 + 0.2),
      }"></span>
    </div>

    <!-- Main content -->
    <div class="nf-content" :style="{ transform: `translate(${mouseX * -0.08}px, ${mouseY * -0.08}px)` }">
      <!-- Glitch 404 -->
      <div class="nf-code-wrap">
        <div class="nf-code" :class="{ 'nf-glitch': glitchActive }" data-text="404">
          <span class="nf-code-digit nf-d1">4</span>
          <span class="nf-code-digit nf-d2">0</span>
          <span class="nf-code-digit nf-d3">4</span>
        </div>
        <div class="nf-code-scanline"></div>
      </div>

      <!-- Shield icon -->
      <div class="nf-shield">
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M32 4L8 16V30C8 46.57 18.12 61.72 32 60C45.88 61.72 56 46.57 56 30V16L32 4Z" 
                fill="url(#shieldGrad)" opacity="0.15" stroke="url(#shieldStroke)" stroke-width="2"/>
          <path d="M28 32L32 36L40 28" stroke="url(#checkGrad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="nf-check-path"/>
          <defs>
            <linearGradient id="shieldGrad" x1="8" y1="4" x2="56" y2="60">
              <stop offset="0%" stop-color="#3b82f6"/>
              <stop offset="100%" stop-color="#06b6d4"/>
            </linearGradient>
            <linearGradient id="shieldStroke" x1="8" y1="4" x2="56" y2="60">
              <stop offset="0%" stop-color="#60a5fa"/>
              <stop offset="100%" stop-color="#22d3ee"/>
            </linearGradient>
            <linearGradient id="checkGrad" x1="28" y1="28" x2="40" y2="36">
              <stop offset="0%" stop-color="#34d399"/>
              <stop offset="100%" stop-color="#06b6d4"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      <!-- Text -->
      <h1 class="nf-title">Halaman Tidak Ditemukan</h1>
      <p class="nf-desc">
        Maaf, halaman yang Anda cari tidak tersedia atau telah dipindahkan. 
        Periksa kembali URL atau kembali ke halaman utama.
      </p>

      <!-- Attempted path -->
      <div class="nf-path-badge">
        <i class="nf-path-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </i>
        <code>{{ $route.fullPath }}</code>
      </div>

      <!-- Action buttons -->
      <div class="nf-actions">
        <button class="nf-btn nf-btn-primary" @click="goHome">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>Kembali ke Dashboard</span>
        </button>
        <button class="nf-btn nf-btn-ghost" @click="goBack">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          <span>Halaman Sebelumnya</span>
        </button>
      </div>

      <!-- Floating hint cards -->
      <div class="nf-hints">
        <div class="nf-hint" style="--hint-delay: 0.6s">
          <div class="nf-hint-icon nf-hint-blue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <div>
            <div class="nf-hint-title">Cek URL</div>
            <div class="nf-hint-desc">Pastikan alamat yang diketik sudah benar</div>
          </div>
        </div>
        <div class="nf-hint" style="--hint-delay: 0.8s">
          <div class="nf-hint-icon nf-hint-cyan">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </div>
          <div>
            <div class="nf-hint-title">Refresh</div>
            <div class="nf-hint-desc">Coba muat ulang halaman ini</div>
          </div>
        </div>
        <div class="nf-hint" style="--hint-delay: 1.0s">
          <div class="nf-hint-icon nf-hint-green">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </div>
          <div>
            <div class="nf-hint-title">Hubungi Admin</div>
            <div class="nf-hint-desc">Laporkan jika masalah berlanjut</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom decoration -->
    <div class="nf-bottom-wave">
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path d="M0,80 C360,120 720,0 1080,60 C1260,90 1380,40 1440,80 L1440,120 L0,120 Z" fill="url(#waveGrad)" opacity="0.08"/>
        <path d="M0,90 C300,50 600,110 900,70 C1100,50 1300,100 1440,80 L1440,120 L0,120 Z" fill="url(#waveGrad)" opacity="0.05"/>
        <defs>
          <linearGradient id="waveGrad" x1="0" y1="0" x2="1440" y2="0">
            <stop offset="0%" stop-color="#3b82f6"/>
            <stop offset="50%" stop-color="#06b6d4"/>
            <stop offset="100%" stop-color="#3b82f6"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
  </div>
</template>

<style scoped>
/* ========================================
   PREMIUM 404 PAGE — FULL ANIMATIONS
   ======================================== */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

.nf-page {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  overflow: hidden;
  background: #050a18;
  color: #e2e8f0;
  opacity: 0;
  transition: opacity 0.6s ease;
}
.nf-page.nf-visible {
  opacity: 1;
}

/* ——— Background ——— */
.nf-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.nf-grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px);
  background-size: 60px 60px;
  animation: nfGridDrift 20s linear infinite;
}
@keyframes nfGridDrift {
  0% { transform: translate(0, 0); }
  100% { transform: translate(60px, 60px); }
}

.nf-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  transition: transform 0.3s ease-out;
  will-change: transform;
}
.nf-orb-1 {
  width: 500px; height: 500px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.2), transparent 70%);
  top: -10%; left: -5%;
  animation: nfOrbFloat1 12s ease-in-out infinite;
}
.nf-orb-2 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(6, 182, 212, 0.18), transparent 70%);
  bottom: -10%; right: -5%;
  animation: nfOrbFloat2 15s ease-in-out infinite;
}
.nf-orb-3 {
  width: 300px; height: 300px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.12), transparent 70%);
  top: 40%; left: 50%;
  animation: nfOrbFloat3 10s ease-in-out infinite;
}
@keyframes nfOrbFloat1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, 40px) scale(1.05); }
  66% { transform: translate(-20px, 20px) scale(0.95); }
}
@keyframes nfOrbFloat2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-40px, -30px) scale(1.08); }
  66% { transform: translate(20px, -15px) scale(0.92); }
}
@keyframes nfOrbFloat3 {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(calc(-50% + 25px), calc(-50% + 35px)) scale(1.1); }
}

/* ——— Particles ——— */
.nf-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.nf-particle {
  position: absolute;
  left: var(--x);
  bottom: -10px;
  width: var(--size);
  height: var(--size);
  background: rgba(96, 165, 250, var(--opacity));
  border-radius: 50%;
  animation: nfParticleRise var(--duration) var(--delay) linear infinite;
  box-shadow: 0 0 6px rgba(96, 165, 250, 0.3);
}
@keyframes nfParticleRise {
  0% { transform: translateY(0) scale(1); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(-100vh) scale(0.3); opacity: 0; }
}

/* ——— Content ——— */
.nf-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 600px;
  padding: 2rem;
  transition: transform 0.15s ease-out;
}

/* ——— 404 Code ——— */
.nf-code-wrap {
  position: relative;
  margin-bottom: 0.5rem;
  overflow: hidden;
}
.nf-code {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  position: relative;
}
.nf-code-digit {
  font-size: clamp(5rem, 15vw, 10rem);
  font-weight: 900;
  line-height: 1;
  background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 40%, #8b5cf6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 30px rgba(59, 130, 246, 0.3));
  animation: nfDigitEntry 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.nf-d1 { animation-delay: 0.2s; }
.nf-d2 { animation-delay: 0.35s; }
.nf-d3 { animation-delay: 0.5s; }

@keyframes nfDigitEntry {
  0% { opacity: 0; transform: translateY(40px) scale(0.7) rotateX(40deg); }
  100% { opacity: 1; transform: translateY(0) scale(1) rotateX(0); }
}

/* Glitch effect */
.nf-glitch {
  animation: nfGlitch 0.2s linear;
}
@keyframes nfGlitch {
  0% { transform: translate(0); }
  20% { transform: translate(-3px, 2px); filter: hue-rotate(40deg); }
  40% { transform: translate(3px, -1px); filter: hue-rotate(-40deg); }
  60% { transform: translate(-2px, -2px); }
  80% { transform: translate(2px, 1px); filter: hue-rotate(20deg); }
  100% { transform: translate(0); filter: none; }
}

.nf-code-scanline {
  position: absolute;
  left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.6), transparent);
  animation: nfScanline 3s ease-in-out infinite;
  pointer-events: none;
}
@keyframes nfScanline {
  0%, 100% { top: 0; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  50% { top: 100%; }
}

/* ——— Shield ——— */
.nf-shield {
  width: 56px;
  height: 56px;
  margin-bottom: 1rem;
  animation: nfShieldEntry 0.7s 0.6s cubic-bezier(0.16, 1, 0.3, 1) both,
             nfShieldFloat 4s 1.5s ease-in-out infinite;
}
.nf-shield svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 0 20px rgba(59, 130, 246, 0.25));
}
.nf-check-path {
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
  animation: nfCheckDraw 0.6s 1.2s ease forwards;
}
@keyframes nfCheckDraw {
  to { stroke-dashoffset: 0; }
}
@keyframes nfShieldEntry {
  0% { opacity: 0; transform: scale(0.4) rotate(-20deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}
@keyframes nfShieldFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

/* ——— Text ——— */
.nf-title {
  font-size: clamp(1.2rem, 3.5vw, 1.65rem);
  font-weight: 900;
  color: #f1f5f9;
  margin: 0 0 0.6rem;
  letter-spacing: -0.5px;
  animation: nfFadeUp 0.6s 0.7s ease both;
}
.nf-desc {
  font-size: clamp(0.8rem, 2vw, 0.92rem);
  color: #94a3b8;
  line-height: 1.65;
  margin: 0 0 1.2rem;
  max-width: 440px;
  animation: nfFadeUp 0.6s 0.85s ease both;
}
@keyframes nfFadeUp {
  0% { opacity: 0; transform: translateY(18px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* ——— Path Badge ——— */
.nf-path-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(59, 130, 246, 0.2);
  backdrop-filter: blur(8px);
  margin-bottom: 1.5rem;
  animation: nfFadeUp 0.6s 0.95s ease both;
  max-width: 90vw;
  overflow: hidden;
}
.nf-path-icon {
  color: #60a5fa;
  display: flex;
  flex-shrink: 0;
}
.nf-path-badge code {
  font-size: 0.72rem;
  font-weight: 600;
  color: #60a5fa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

/* ——— Buttons ——— */
.nf-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 2rem;
  animation: nfFadeUp 0.6s 1.05s ease both;
}
.nf-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 22px;
  border-radius: 12px;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  border: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: inherit;
  position: relative;
  overflow: hidden;
}
.nf-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.3s;
}
.nf-btn:active {
  transform: scale(0.97);
}

.nf-btn-primary {
  background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%);
  color: #fff;
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255,255,255,0.15);
}
.nf-btn-primary::before {
  background: linear-gradient(135deg, #1d4ed8 0%, #0e7490 100%);
}
.nf-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 36px rgba(37, 99, 235, 0.4), inset 0 1px 0 rgba(255,255,255,0.2);
}
.nf-btn-primary:hover::before { opacity: 1; }

.nf-btn-ghost {
  background: rgba(15, 23, 42, 0.5);
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.2);
  backdrop-filter: blur(6px);
}
.nf-btn-ghost:hover {
  background: rgba(30, 41, 59, 0.7);
  color: #f1f5f9;
  border-color: rgba(148, 163, 184, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
}

/* ——— Hint Cards ——— */
.nf-hints {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 560px;
}
.nf-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.45);
  border: 1px solid rgba(148, 163, 184, 0.1);
  backdrop-filter: blur(8px);
  flex: 1;
  min-width: 150px;
  transition: all 0.3s ease;
  animation: nfHintEntry 0.5s var(--hint-delay) cubic-bezier(0.16, 1, 0.3, 1) both;
}
.nf-hint:hover {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(96, 165, 250, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}
@keyframes nfHintEntry {
  0% { opacity: 0; transform: translateY(16px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.nf-hint-icon {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.nf-hint-blue { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
.nf-hint-cyan { background: rgba(6, 182, 212, 0.15); color: #22d3ee; }
.nf-hint-green { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.nf-hint-title {
  font-size: 0.72rem;
  font-weight: 800;
  color: #e2e8f0;
  margin-bottom: 1px;
}
.nf-hint-desc {
  font-size: 0.62rem;
  color: #64748b;
  line-height: 1.3;
}

/* ——— Bottom Wave ——— */
.nf-bottom-wave {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120px;
  pointer-events: none;
}
.nf-bottom-wave svg {
  width: 100%;
  height: 100%;
}

/* ——— Responsive ——— */
@media (max-width: 640px) {
  .nf-content { padding: 1.5rem 1rem; }
  .nf-code-digit { filter: drop-shadow(0 0 20px rgba(59, 130, 246, 0.2)); }
  .nf-shield { width: 44px; height: 44px; margin-bottom: 0.8rem; }
  .nf-title { margin-bottom: 0.4rem; }
  .nf-desc { margin-bottom: 1rem; }
  .nf-actions { gap: 8px; margin-bottom: 1.5rem; }
  .nf-btn { padding: 10px 18px; font-size: 0.78rem; border-radius: 10px; }
  .nf-hints { gap: 8px; }
  .nf-hint { min-width: 130px; padding: 8px 10px; border-radius: 10px; }
  .nf-hint-icon { width: 28px; height: 28px; border-radius: 7px; }
  .nf-hint-title { font-size: 0.68rem; }
  .nf-hint-desc { font-size: 0.58rem; }
  .nf-path-badge { padding: 6px 10px; }
  .nf-path-badge code { font-size: 0.65rem; }
  .nf-orb-1 { width: 300px; height: 300px; }
  .nf-orb-2 { width: 250px; height: 250px; }
  .nf-orb-3 { width: 200px; height: 200px; }
}

@media (max-width: 400px) {
  .nf-content { padding: 1rem 0.75rem; }
  .nf-shield { width: 38px; height: 38px; }
  .nf-btn { padding: 9px 14px; font-size: 0.74rem; gap: 6px; }
  .nf-btn svg { width: 16px; height: 16px; }
  .nf-hints { flex-direction: column; }
  .nf-hint { min-width: 0; }
  .nf-path-badge { margin-bottom: 1.2rem; }
}

@media (max-height: 700px) {
  .nf-code-digit { font-size: clamp(3.5rem, 10vw, 6rem); }
  .nf-shield { width: 40px; height: 40px; margin-bottom: 0.5rem; }
  .nf-title { font-size: 1.1rem; margin-bottom: 0.3rem; }
  .nf-desc { font-size: 0.78rem; margin-bottom: 0.8rem; }
  .nf-hints { gap: 6px; }
  .nf-hint { padding: 7px 10px; }
}
</style>
