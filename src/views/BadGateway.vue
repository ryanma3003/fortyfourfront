<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const isVisible = ref(false);
const mouseX = ref(0);
const mouseY = ref(0);
const isReconnecting = ref(false);
let mouseMoveHandler = null;
let reconnectTimeout = null;

const goHome = () => {
  router.push('/dashboard');
};

const retryConnection = () => {
  isReconnecting.value = true;
  reconnectTimeout = setTimeout(() => {
    window.location.reload();
  }, 1500);
};

onMounted(() => {
  setTimeout(() => { isVisible.value = true; }, 100);

  mouseMoveHandler = (e) => {
    mouseX.value = (e.clientX / window.innerWidth - 0.5) * 20;
    mouseY.value = (e.clientY / window.innerHeight - 0.5) * 20;
  };
  window.addEventListener('mousemove', mouseMoveHandler);

  document.body.classList.add('badgw-active');
});

onUnmounted(() => {
  if (mouseMoveHandler) window.removeEventListener('mousemove', mouseMoveHandler);
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  document.body.classList.remove('badgw-active');
});
</script>

<template>
  <div class="bgw-page" :class="{ 'bgw-visible': isVisible }">
    <!-- Animated background patterns -->
    <div class="bgw-bg">
      <div class="bgw-noise"></div>
      <div class="bgw-pulse-ring bgw-ring-1"></div>
      <div class="bgw-pulse-ring bgw-ring-2"></div>
      <div class="bgw-pulse-ring bgw-ring-3"></div>
      <div class="bgw-glow"></div>
    </div>

    <!-- Data stream lines (broken) -->
    <div class="bgw-streams">
      <div v-for="i in 5" :key="'s'+i" class="bgw-stream" :style="{ '--delay': (i * 0.4) + 's', '--left': (15 * i) + '%' }"></div>
    </div>

    <!-- Content -->
    <div class="bgw-content" :style="{ transform: `translate(${mouseX * -0.1}px, ${mouseY * -0.1}px)` }">
      <!-- Status Badge -->
      <div class="bgw-status-badge" :class="{ 'bgw-reconnecting': isReconnecting }">
        <span class="bgw-status-dot"></span>
        <span class="bgw-status-text">{{ isReconnecting ? 'MENCOBA KONEKSI ULANG...' : 'KONEKSI TERPUTUS' }}</span>
      </div>

      <!-- Main Visual -->
      <div class="bgw-visual">
        <div class="bgw-error-code">
          <span class="bgw-digit" style="--delay: 0s">5</span>
          <span class="bgw-server-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="2"/>
              <path d="M2 12H22" stroke="currentColor" stroke-width="2"/>
              <circle cx="6" cy="8" r="1.5" fill="currentColor" class="bgw-blink-red"/>
              <circle cx="10" cy="8" r="1.5" fill="currentColor"/>
              <circle cx="6" cy="16" r="1.5" fill="currentColor"/>
              <circle cx="10" cy="16" r="1.5" fill="currentColor"/>
              <path d="M14 8H18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M14 16H18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="bgw-digit" style="--delay: 0.2s">2</span>
        </div>
      </div>

      <!-- Typography -->
      <h1 class="bgw-title">Bad Gateway</h1>
      <p class="bgw-desc">
        Server menerima respon yang tidak valid dari server hulu (upstream). 
        Ini biasanya merupakan masalah sementara pada server atau jaringan kami.
      </p>

      <!-- Action Area -->
      <div class="bgw-actions">
        <button class="bgw-btn bgw-btn-primary" @click="retryConnection" :disabled="isReconnecting">
          <svg v-if="!isReconnecting" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          <svg v-else class="bgw-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line>
            <line x1="18" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
          </svg>
          <span>{{ isReconnecting ? 'Menghubungkan...' : 'Coba Lagi' }}</span>
        </button>
        <button class="bgw-btn bgw-btn-secondary" @click="goHome">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>Kembali</span>
        </button>
      </div>

      <!-- Server Trace / Terminal effect -->
      <div class="bgw-terminal">
        <div class="bgw-term-header">
          <span class="bgw-term-dot"></span>
          <span class="bgw-term-dot"></span>
          <span class="bgw-term-dot"></span>
        </div>
        <div class="bgw-term-body">
          <div class="bgw-log">> Checking upstream servers...</div>
          <div class="bgw-log">> Host: connection timeout</div>
          <div class="bgw-log bgw-log-error">> Error: 502 Bad Gateway</div>
          <div class="bgw-log bgw-log-blink" v-if="isReconnecting">> Retrying connection...</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ========================================
   PREMIUM 502 PAGE — SERVER DOWN THEME
   ======================================== */

@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

.bgw-page {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #0f172a;
  color: #f8fafc;
  overflow: hidden;
  opacity: 0;
  transition: opacity 0.8s ease;
}
.bgw-page.bgw-visible {
  opacity: 1;
}

/* ——— Background Elements ——— */
.bgw-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.bgw-noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.04'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 1;
}
.bgw-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80vw;
  height: 80vh;
  background: radial-gradient(ellipse at center, rgba(245, 158, 11, 0.15) 0%, transparent 60%);
  filter: blur(60px);
  z-index: 0;
}
.bgw-pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1px solid rgba(245, 158, 11, 0.2);
  box-shadow: inset 0 0 40px rgba(245, 158, 11, 0.05);
  animation: bgwPulse 4s cubic-bezier(0.21, 0.53, 0.56, 0.8) infinite;
  z-index: 0;
}
.bgw-ring-1 { width: 300px; height: 300px; animation-delay: 0s; }
.bgw-ring-2 { width: 500px; height: 500px; animation-delay: 1.3s; }
.bgw-ring-3 { width: 700px; height: 700px; animation-delay: 2.6s; }

@keyframes bgwPulse {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; border-width: 3px; }
  50% { opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; border-width: 1px; }
}

/* ——— Data Streams ——— */
.bgw-streams {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.bgw-stream {
  position: absolute;
  top: -100px;
  left: var(--left);
  width: 1px;
  height: 100px;
  background: linear-gradient(to bottom, transparent, rgba(245, 158, 11, 0.6), transparent);
  animation: bgwStreamDrop 3s var(--delay) infinite;
}
@keyframes bgwStreamDrop {
  0% { transform: translateY(0); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translateY(120vh); opacity: 0; }
}

/* ——— Main Content ——— */
.bgw-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 540px;
  padding: 2rem;
  transition: transform 0.1s ease-out;
}

/* ——— Status Badge ——— */
.bgw-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  margin-bottom: 2rem;
  animation: bgwFadeInDown 0.6s 0.2s both;
  transition: all 0.3s ease;
}
.bgw-reconnecting {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
}
.bgw-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 10px #ef4444;
  animation: bgwPulseDot 1.5s infinite;
}
.bgw-reconnecting .bgw-status-dot {
  background: #f59e0b;
  box-shadow: 0 0 10px #f59e0b;
}
@keyframes bgwPulseDot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}
.bgw-status-text {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 1px;
  color: #ef4444;
}
.bgw-reconnecting .bgw-status-text {
  color: #f59e0b;
}

/* ——— Visual & 502 Code ——— */
.bgw-visual {
  margin-bottom: 1.5rem;
  animation: bgwZoomIn 0.8s 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.bgw-error-code {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.bgw-digit {
  font-size: clamp(4.5rem, 12vw, 8rem);
  font-weight: 700;
  line-height: 1;
  background: linear-gradient(180deg, #f8fafc 0%, #cbd5e1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: bgwFloat 4s var(--delay) ease-in-out infinite;
}
.bgw-server-icon {
  width: clamp(60px, 15vw, 100px);
  height: clamp(60px, 15vw, 100px);
  color: #f59e0b;
  filter: drop-shadow(0 0 20px rgba(245, 158, 11, 0.4));
  animation: bgwShake 5s infinite;
}
.bgw-server-icon svg {
  width: 100%;
  height: 100%;
}
.bgw-blink-red {
  animation: bgwBlinkFast 0.5s infinite alternate;
}
@keyframes bgwBlinkFast {
  0% { fill: #ef4444; opacity: 1; filter: drop-shadow(0 0 5px #ef4444); }
  100% { fill: #991b1b; opacity: 0.5; filter: none; }
}

@keyframes bgwZoomIn {
  0% { opacity: 0; transform: scale(0.8); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes bgwFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@keyframes bgwShake {
  0%, 90%, 100% { transform: translateX(0); }
  92% { transform: translateX(-4px) rotate(-2deg); }
  94% { transform: translateX(4px) rotate(2deg); }
  96% { transform: translateX(-4px) rotate(-2deg); }
  98% { transform: translateX(4px) rotate(2deg); }
}

/* ——— Typography ——— */
.bgw-title {
  font-size: clamp(1.4rem, 4vw, 2rem);
  font-weight: 700;
  color: #f8fafc !important;
  margin: 0 0 0.8rem;
  letter-spacing: -0.5px;
  animation: bgwFadeInUp 0.6s 0.6s both;
}
.bgw-desc {
  font-size: clamp(0.85rem, 2vw, 0.95rem);
  color: #cbd5e1 !important;
  line-height: 1.6;
  margin: 0 0 2rem;
  max-width: 480px;
  animation: bgwFadeInUp 0.6s 0.7s both;
}

/* ——— Actions ——— */
.bgw-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 2.5rem;
  animation: bgwFadeInUp 0.6s 0.8s both;
}
.bgw-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.bgw-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.bgw-btn-primary {
  background: #f59e0b;
  color: #0f172a;
  box-shadow: 0 8px 20px rgba(245, 158, 11, 0.3);
}
.bgw-btn-primary:hover:not(:disabled) {
  background: #fbbf24;
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(245, 158, 11, 0.4);
}
.bgw-btn-secondary {
  background: rgba(30, 41, 59, 0.8);
  color: #f8fafc;
  border: 1px solid rgba(100, 116, 139, 0.3);
}
.bgw-btn-secondary:hover:not(:disabled) {
  background: rgba(51, 65, 85, 0.8);
  border-color: rgba(148, 163, 184, 0.4);
  transform: translateY(-2px);
}
.bgw-spin {
  animation: bgwSpin 1s linear infinite;
}
@keyframes bgwSpin {
  100% { transform: rotate(360deg); }
}

/* ——— Terminal Effect ——— */
.bgw-terminal {
  width: 100%;
  max-width: 420px;
  background: #020617;
  border: 1px solid rgba(51, 65, 85, 0.5);
  border-radius: 10px;
  overflow: hidden;
  text-align: left;
  animation: bgwFadeInUp 0.6s 0.9s both;
  box-shadow: 0 20px 40px rgba(0,0,0,0.4);
}
.bgw-term-header {
  background: #1e293b;
  padding: 8px 12px;
  display: flex;
  gap: 6px;
  border-bottom: 1px solid rgba(51, 65, 85, 0.5);
}
.bgw-term-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #475569;
}
.bgw-term-dot:nth-child(1) { background: #ef4444; }
.bgw-term-dot:nth-child(2) { background: #f59e0b; }
.bgw-term-dot:nth-child(3) { background: #10b981; }

.bgw-term-body {
  padding: 12px 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  line-height: 1.6;
  color: #94a3b8;
}
.bgw-log {
  margin-bottom: 4px;
}
.bgw-log-error {
  color: #ef4444;
}
.bgw-log-blink {
  color: #f59e0b;
  animation: bgwTextBlink 1s infinite;
}
@keyframes bgwTextBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes bgwFadeInDown {
  0% { opacity: 0; transform: translateY(-20px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes bgwFadeInUp {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* ——— Responsive ——— */
@media (max-width: 640px) {
  .bgw-content { padding: 1.5rem; }
  .bgw-status-badge { margin-bottom: 1.5rem; }
  .bgw-visual { margin-bottom: 1.2rem; }
  .bgw-error-code { gap: 8px; }
  .bgw-desc { margin-bottom: 1.8rem; }
  .bgw-actions { margin-bottom: 2rem; }
  .bgw-ring-1 { width: 250px; height: 250px; }
  .bgw-ring-2 { width: 400px; height: 400px; }
  .bgw-ring-3 { width: 550px; height: 550px; }
}

@media (max-width: 480px) {
  .bgw-content { padding: 1rem; }
  .bgw-status-badge { padding: 5px 12px; }
  .bgw-status-text { font-size: 0.65rem; }
  .bgw-actions { flex-direction: column; width: 100%; max-width: 280px; }
  .bgw-btn { width: 100%; justify-content: center; }
  .bgw-terminal { font-size: 0.65rem; }
}

@media (max-height: 700px) {
  .bgw-visual { margin-bottom: 0.8rem; }
  .bgw-status-badge { margin-bottom: 1rem; }
  .bgw-title { margin-bottom: 0.4rem; }
  .bgw-desc { margin-bottom: 1.2rem; }
  .bgw-actions { margin-bottom: 1.5rem; }
  .bgw-terminal { display: none; } /* Hide terminal on very short screens */
}
</style>
