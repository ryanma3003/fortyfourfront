<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const isVisible = ref(false);
const mouseX = ref(0);
const mouseY = ref(0);
const pulseActive = ref(false);
let mouseMoveHandler = null;
let pulseInterval = null;

const userRole = computed(() => {
  const role = authStore.userRole || 'user';
  return role.split('_').join(' ').toUpperCase();
});
const userName = computed(() => authStore.userName || 'Pengguna');

const contactAdmin = () => {
  window.location.href = 'mailto:admin@example.com?subject=Permintaan%20Akses%20Dashboard';
};

const logout = async () => {
  await authStore.logUserOut();
  router.push('/');
};

onMounted(() => {
  setTimeout(() => { isVisible.value = true; }, 100);

  // Pulse effect interval for the lock icon
  pulseInterval = setInterval(() => {
    pulseActive.value = true;
    setTimeout(() => { pulseActive.value = false; }, 600);
  }, 5000);

  // Mouse parallax
  mouseMoveHandler = (e) => {
    mouseX.value = (e.clientX / window.innerWidth - 0.5) * 24;
    mouseY.value = (e.clientY / window.innerHeight - 0.5) * 24;
  };
  window.addEventListener('mousemove', mouseMoveHandler);

  document.body.classList.add('ra-active');
});

onUnmounted(() => {
  if (pulseInterval) clearInterval(pulseInterval);
  if (mouseMoveHandler) window.removeEventListener('mousemove', mouseMoveHandler);
  document.body.classList.remove('ra-active');
});
</script>

<template>
  <div class="ra-page" :class="{ 'ra-visible': isVisible }">
    <!-- Background layer -->
    <div class="ra-bg">
      <div class="ra-hex-grid"></div>
      <div class="ra-orb ra-orb-1" :style="{ transform: `translate(${mouseX * 0.5}px, ${mouseY * 0.5}px)` }"></div>
      <div class="ra-orb ra-orb-2" :style="{ transform: `translate(${mouseX * -0.3}px, ${mouseY * -0.3}px)` }"></div>
      <div class="ra-orb ra-orb-3" :style="{ transform: `translate(${mouseX * 0.2}px, ${mouseY * 0.2}px)` }"></div>
    </div>

    <!-- Floating particles -->
    <div class="ra-particles">
      <span v-for="n in 18" :key="n" class="ra-particle" :style="{
        '--delay': (n * 0.6) + 's',
        '--x': (Math.random() * 100) + '%',
        '--size': (Math.random() * 4 + 2) + 'px',
        '--duration': (Math.random() * 10 + 12) + 's',
        '--opacity': (Math.random() * 0.4 + 0.15),
      }"></span>
    </div>

    <!-- Scan lines effect -->
    <div class="ra-scanlines"></div>

    <!-- Main content -->
    <div class="ra-content" :style="{ transform: `translate(${mouseX * -0.08}px, ${mouseY * -0.08}px)` }">
      <!-- Status badge -->
      <div class="ra-status-badge">
        <span class="ra-status-dot"></span>
        <span class="ra-status-text">AKSES DITOLAK</span>
      </div>

      <!-- Lock visual -->
      <div class="ra-visual">
        <div class="ra-lock-container" :class="{ 'ra-pulse': pulseActive }">
          <!-- Glowing rings -->
          <div class="ra-ring ra-ring-1"></div>
          <div class="ra-ring ra-ring-2"></div>
          <div class="ra-ring ra-ring-3"></div>

          <!-- Shield with lock -->
          <svg class="ra-shield-svg" viewBox="0 0 80 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="raShieldFill" x1="0" y1="0" x2="80" y2="90">
                <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.15"/>
                <stop offset="100%" stop-color="#ef4444" stop-opacity="0.08"/>
              </linearGradient>
              <linearGradient id="raShieldStroke" x1="0" y1="0" x2="80" y2="90">
                <stop offset="0%" stop-color="#fbbf24"/>
                <stop offset="100%" stop-color="#ef4444"/>
              </linearGradient>
              <linearGradient id="raLockGrad" x1="30" y1="35" x2="50" y2="65">
                <stop offset="0%" stop-color="#fbbf24"/>
                <stop offset="100%" stop-color="#f59e0b"/>
              </linearGradient>
            </defs>
            <!-- Shield body -->
            <path d="M40 5L8 20V42C8 60 20 76 40 82C60 76 72 60 72 42V20L40 5Z"
                  fill="url(#raShieldFill)" stroke="url(#raShieldStroke)" stroke-width="2" class="ra-shield-path"/>
            <!-- Lock body -->
            <rect x="30" y="45" width="20" height="16" rx="3" fill="url(#raLockGrad)" class="ra-lock-body"/>
            <!-- Lock shackle -->
            <path d="M34 45V39C34 35.69 36.69 33 40 33C43.31 33 46 35.69 46 39V45" 
                  stroke="url(#raLockGrad)" stroke-width="2.5" stroke-linecap="round" fill="none" class="ra-lock-shackle"/>
            <!-- Keyhole -->
            <circle cx="40" cy="52" r="2" fill="#0f172a"/>
            <rect x="39" y="53" width="2" height="4" rx="1" fill="#0f172a"/>
          </svg>
        </div>
      </div>

      <!-- Title -->
      <h1 class="ra-title">Akses Terbatas</h1>

      <!-- Description -->
      <p class="ra-desc">
        Halo <strong>{{ userName }}</strong>, akun Anda saat ini tidak memiliki hak akses 
        untuk masuk ke Dashboard Admin. Silakan hubungi Administrator 
        jika ini adalah sebuah kesalahan.
      </p>

      <!-- Role badge -->
      <div class="ra-role-badge">
        <i class="ra-role-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </i>
        <span class="ra-role-label">Role:</span>
        <code class="ra-role-value">{{ userRole }}</code>
      </div>

      <!-- Action buttons -->
      <div class="ra-actions">
        <button class="ra-btn ra-btn-primary" @click="contactAdmin">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <span>Hubungi Admin</span>
        </button>
        <button class="ra-btn ra-btn-ghost" @click="logout">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Logout</span>
        </button>
      </div>

      <!-- Hint cards -->
      <div class="ra-hints">
        <div class="ra-hint" style="--hint-delay: 0.7s">
          <div class="ra-hint-icon ra-hint-amber">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <div class="ra-hint-title">Akses Terbatas</div>
            <div class="ra-hint-desc">Akun Anda belum memiliki izin admin</div>
          </div>
        </div>
        <div class="ra-hint" style="--hint-delay: 0.9s">
          <div class="ra-hint-icon ra-hint-blue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </div>
          <div>
            <div class="ra-hint-title">Hubungi Admin</div>
            <div class="ra-hint-desc">Minta upgrade role ke Administrator</div>
          </div>
        </div>
        <div class="ra-hint" style="--hint-delay: 1.1s">
          <div class="ra-hint-icon ra-hint-red">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <div class="ra-hint-title">Perlu Bantuan?</div>
            <div class="ra-hint-desc">Hubungi support jika ini kesalahan</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom wave decoration -->
    <div class="ra-bottom-wave">
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path d="M0,80 C360,120 720,0 1080,60 C1260,90 1380,40 1440,80 L1440,120 L0,120 Z" fill="url(#raWaveGrad)" opacity="0.08"/>
        <path d="M0,90 C300,50 600,110 900,70 C1100,50 1300,100 1440,80 L1440,120 L0,120 Z" fill="url(#raWaveGrad)" opacity="0.05"/>
        <defs>
          <linearGradient id="raWaveGrad" x1="0" y1="0" x2="1440" y2="0">
            <stop offset="0%" stop-color="#f59e0b"/>
            <stop offset="50%" stop-color="#ef4444"/>
            <stop offset="100%" stop-color="#f59e0b"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
  </div>
</template>

<style scoped>
/* ========================================
   PREMIUM ROLE-AKSES PAGE — ACCESS DENIED
   ======================================== */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

.ra-page {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  overflow: hidden;
  background: #0a0e1a;
  color: #e2e8f0;
  opacity: 0;
  transition: opacity 0.7s ease;
}
.ra-page.ra-visible {
  opacity: 1;
}

/* ——— Background ——— */
.ra-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.ra-hex-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(245, 158, 11, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(245, 158, 11, 0.025) 1px, transparent 1px);
  background-size: 50px 50px;
  animation: raGridDrift 25s linear infinite;
}
@keyframes raGridDrift {
  0% { transform: translate(0, 0) rotate(0deg); }
  100% { transform: translate(50px, 50px) rotate(0deg); }
}

.ra-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  transition: transform 0.3s ease-out;
  will-change: transform;
}
.ra-orb-1 {
  width: 450px; height: 450px;
  background: radial-gradient(circle, rgba(245, 158, 11, 0.18), transparent 70%);
  top: -12%; left: -8%;
  animation: raOrbFloat1 14s ease-in-out infinite;
}
.ra-orb-2 {
  width: 380px; height: 380px;
  background: radial-gradient(circle, rgba(239, 68, 68, 0.14), transparent 70%);
  bottom: -12%; right: -8%;
  animation: raOrbFloat2 16s ease-in-out infinite;
}
.ra-orb-3 {
  width: 280px; height: 280px;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.1), transparent 70%);
  top: 45%; left: 55%;
  animation: raOrbFloat3 11s ease-in-out infinite;
}
@keyframes raOrbFloat1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(35px, 45px) scale(1.06); }
  66% { transform: translate(-25px, 20px) scale(0.94); }
}
@keyframes raOrbFloat2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-45px, -35px) scale(1.1); }
  66% { transform: translate(25px, -15px) scale(0.9); }
}
@keyframes raOrbFloat3 {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(calc(-50% + 30px), calc(-50% + 40px)) scale(1.12); }
}

/* ——— Scan lines ——— */
.ra-scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.03) 2px,
    rgba(0, 0, 0, 0.03) 4px
  );
  pointer-events: none;
  z-index: 1;
}

/* ——— Particles ——— */
.ra-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}
.ra-particle {
  position: absolute;
  left: var(--x);
  bottom: -10px;
  width: var(--size);
  height: var(--size);
  background: rgba(251, 191, 36, var(--opacity));
  border-radius: 50%;
  animation: raParticleRise var(--duration) var(--delay) linear infinite;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.25);
}
@keyframes raParticleRise {
  0% { transform: translateY(0) scale(1); opacity: 0; }
  8% { opacity: 1; }
  92% { opacity: 1; }
  100% { transform: translateY(-100vh) scale(0.2); opacity: 0; }
}

/* ——— Content ——— */
.ra-content {
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

/* ——— Status Badge ——— */
.ra-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  margin-bottom: 1.5rem;
  animation: raFadeInDown 0.6s 0.2s both;
}
.ra-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 12px #ef4444;
  animation: raPulseDot 1.5s infinite;
}
@keyframes raPulseDot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.75); }
}
.ra-status-text {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: #ef4444;
}

/* ——— Lock Visual ——— */
.ra-visual {
  margin-bottom: 1rem;
  animation: raZoomIn 0.8s 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.ra-lock-container {
  position: relative;
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ra-lock-container.ra-pulse .ra-shield-svg {
  filter: drop-shadow(0 0 30px rgba(245, 158, 11, 0.5));
}

/* Glowing rings */
.ra-ring {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1px solid rgba(245, 158, 11, 0.15);
  animation: raRingPulse 4s cubic-bezier(0.21, 0.53, 0.56, 0.8) infinite;
}
.ra-ring-1 { width: 100px; height: 100px; animation-delay: 0s; }
.ra-ring-2 { width: 130px; height: 130px; animation-delay: 1.3s; }
.ra-ring-3 { width: 160px; height: 160px; animation-delay: 2.6s; }

@keyframes raRingPulse {
  0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; border-width: 2px; }
  50% { opacity: 0.8; }
  100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; border-width: 0.5px; }
}

.ra-shield-svg {
  width: 80px;
  height: 90px;
  filter: drop-shadow(0 0 20px rgba(245, 158, 11, 0.3));
  animation: raShieldFloat 4s 1s ease-in-out infinite;
  transition: filter 0.3s ease;
}
.ra-shield-path {
  stroke-dasharray: 300;
  stroke-dashoffset: 300;
  animation: raShieldDraw 1.5s 0.5s ease forwards;
}
.ra-lock-body {
  opacity: 0;
  animation: raLockAppear 0.4s 1.4s ease forwards;
}
.ra-lock-shackle {
  stroke-dasharray: 40;
  stroke-dashoffset: 40;
  animation: raShackleDraw 0.5s 1.6s ease forwards;
}

@keyframes raShieldDraw {
  to { stroke-dashoffset: 0; }
}
@keyframes raLockAppear {
  to { opacity: 1; }
}
@keyframes raShackleDraw {
  to { stroke-dashoffset: 0; }
}
@keyframes raShieldFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes raZoomIn {
  0% { opacity: 0; transform: scale(0.5) rotate(-10deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}

/* ——— Title ——— */
.ra-title {
  font-size: clamp(1.3rem, 4vw, 1.8rem);
  font-weight: 900;
  color: #f8fafc;
  margin: 0 0 0.7rem;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 40%, #ef4444 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: raFadeUp 0.6s 0.7s ease both;
}

/* ——— Description ——— */
.ra-desc {
  font-size: clamp(0.82rem, 2vw, 0.92rem);
  color: #94a3b8;
  line-height: 1.7;
  margin: 0 0 1.2rem;
  max-width: 440px;
  animation: raFadeUp 0.6s 0.85s ease both;
}
.ra-desc strong {
  color: #fbbf24;
}

/* ——— Role Badge ——— */
.ra-role-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(245, 158, 11, 0.25);
  backdrop-filter: blur(10px);
  margin-bottom: 1.8rem;
  animation: raFadeUp 0.6s 0.95s ease both;
  max-width: 90vw;
}
.ra-role-icon {
  color: #f59e0b;
  display: flex;
  flex-shrink: 0;
}
.ra-role-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #94a3b8;
}
.ra-role-value {
  font-size: 0.8rem;
  font-weight: 900;
  color: #fbbf24;
  letter-spacing: 1px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  text-shadow: 0 0 10px rgba(251, 191, 36, 0.3);
}

/* ——— Buttons ——— */
.ra-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 2rem;
  animation: raFadeUp 0.6s 1.05s ease both;
}
.ra-btn {
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
.ra-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.3s;
}
.ra-btn:active {
  transform: scale(0.97);
}

.ra-btn-primary {
  background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
  color: #fff;
  box-shadow: 0 8px 24px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255,255,255,0.15);
}
.ra-btn-primary::before {
  background: linear-gradient(135deg, #d97706 0%, #c2410c 100%);
}
.ra-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 36px rgba(245, 158, 11, 0.4), inset 0 1px 0 rgba(255,255,255,0.2);
}
.ra-btn-primary:hover::before { opacity: 1; }

.ra-btn-ghost {
  background: rgba(15, 23, 42, 0.5);
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.2);
  backdrop-filter: blur(6px);
}
.ra-btn-ghost:hover {
  background: rgba(30, 41, 59, 0.7);
  color: #f1f5f9;
  border-color: rgba(239, 68, 68, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
}

/* ——— Hint Cards ——— */
.ra-hints {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 560px;
}
.ra-hint {
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
  animation: raHintEntry 0.5s var(--hint-delay) cubic-bezier(0.16, 1, 0.3, 1) both;
}
.ra-hint:hover {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(245, 158, 11, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}
@keyframes raHintEntry {
  0% { opacity: 0; transform: translateY(16px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.ra-hint-icon {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ra-hint-amber { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
.ra-hint-blue { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
.ra-hint-red { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.ra-hint-title {
  font-size: 0.72rem;
  font-weight: 800;
  color: #e2e8f0;
  margin-bottom: 1px;
}
.ra-hint-desc {
  font-size: 0.62rem;
  color: #64748b;
  line-height: 1.3;
}

/* ——— Bottom Wave ——— */
.ra-bottom-wave {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120px;
  pointer-events: none;
  z-index: 1;
}
.ra-bottom-wave svg {
  width: 100%;
  height: 100%;
}

/* ——— Animations ——— */
@keyframes raFadeInDown {
  0% { opacity: 0; transform: translateY(-20px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes raFadeUp {
  0% { opacity: 0; transform: translateY(18px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* ——— Responsive ——— */
@media (max-width: 640px) {
  .ra-content { padding: 1.5rem 1rem; }
  .ra-lock-container { width: 110px; height: 110px; }
  .ra-shield-svg { width: 60px; height: 68px; }
  .ra-ring-1 { width: 80px; height: 80px; }
  .ra-ring-2 { width: 100px; height: 100px; }
  .ra-ring-3 { width: 130px; height: 130px; }
  .ra-title { margin-bottom: 0.5rem; }
  .ra-desc { margin-bottom: 1rem; }
  .ra-actions { gap: 8px; margin-bottom: 1.5rem; }
  .ra-btn { padding: 10px 18px; font-size: 0.78rem; border-radius: 10px; }
  .ra-hints { gap: 8px; }
  .ra-hint { min-width: 130px; padding: 8px 10px; border-radius: 10px; }
  .ra-hint-icon { width: 28px; height: 28px; border-radius: 7px; }
  .ra-hint-title { font-size: 0.68rem; }
  .ra-hint-desc { font-size: 0.58rem; }
  .ra-role-badge { padding: 6px 12px; }
  .ra-role-value { font-size: 0.72rem; }
  .ra-orb-1 { width: 300px; height: 300px; }
  .ra-orb-2 { width: 250px; height: 250px; }
  .ra-orb-3 { width: 180px; height: 180px; }
}

@media (max-width: 400px) {
  .ra-content { padding: 1rem 0.75rem; }
  .ra-btn { padding: 9px 14px; font-size: 0.74rem; gap: 6px; }
  .ra-btn svg { width: 16px; height: 16px; }
  .ra-hints { flex-direction: column; }
  .ra-hint { min-width: 0; }
  .ra-role-badge { margin-bottom: 1.2rem; }
  .ra-status-badge { margin-bottom: 1rem; }
}

@media (max-height: 700px) {
  .ra-lock-container { width: 100px; height: 100px; }
  .ra-shield-svg { width: 50px; height: 56px; }
  .ra-ring-1 { width: 70px; height: 70px; }
  .ra-ring-2 { width: 90px; height: 90px; }
  .ra-ring-3 { width: 110px; height: 110px; }
  .ra-title { font-size: 1.2rem; margin-bottom: 0.3rem; }
  .ra-desc { font-size: 0.8rem; margin-bottom: 0.8rem; }
  .ra-role-badge { margin-bottom: 1.2rem; }
  .ra-hints { gap: 6px; }
  .ra-hint { padding: 7px 10px; }
  .ra-status-badge { margin-bottom: 1rem; }
}
</style>
