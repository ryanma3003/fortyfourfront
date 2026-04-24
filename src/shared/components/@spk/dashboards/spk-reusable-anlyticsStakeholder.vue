<script setup lang="ts">
import { useRouter } from "vue-router";

const props = defineProps({
  analyticData: Object,
  csirtId: {
    type: [Number, String],
    default: null,
  },
  stakeholderSlug: {
    type: String,
    default: null,
  },
});

const router = useRouter();

const handleIkas = () => {
  if (props.stakeholderSlug) {
    router.push({ path: "/ikas", query: { slug: props.stakeholderSlug } });
  } else {
    router.push("/ikas");
  }
};
const handleResiko = () => {
  if (props.stakeholderSlug) {
    router.push({ path: "/profile-resiko", query: { slug: props.stakeholderSlug } });
  } else {
    router.push("/profile-resiko");
  }
};
const handleCsirt = () => {
  const routeParam = props.stakeholderSlug || props.csirtId;
  if (routeParam) {
    router.push(`/csirt/${routeParam}`);
  } else {
    router.push("/csirt");
  }
};
const handleKse = () => {
  if (props.stakeholderSlug) {
    router.push({ path: "/kse", query: { slug: props.stakeholderSlug } });
  } else {
    router.push("/kse");
  }
};

const subLabel: Record<string, string> = {
  IKAS: "Indeks Keamanan Siber",
  KSE: "Kapasitas SDM & Ekosistem",
  CSIRT: "Status Tim Respons Insiden",
  Resiko: "Profile Manajemen Resiko",
  "Survey Resiko": "Profile Manajemen Resiko",
};

const iconColorClass: Record<string, string> = {
  primary:   "icon-blue",
  secondary: "icon-violet",
  success:   "icon-teal",
  warning:   "icon-amber",
  danger:    "icon-red",
};

const accentColorClass: Record<string, string> = {
  primary:   "accent-blue",
  secondary: "accent-violet",
  success:   "accent-teal",
  warning:   "accent-amber",
  danger:    "accent-red",
};

const isBelum = (v: string) => v === "Belum Diisi" || v === "Belum Terdaftar";
const isRegistered = (v: string) => v === "Terdaftar" || v === "Sudah Terdaftar" || /^\d+\s+SE\s+Terdaftar$/i.test(v);
const isAktif = (v: string) => v === "Aktif";
const isSedangSetup = (v: string) => v === "Sedang Setup";
const isNumeric = (v: string) => !isNaN(parseFloat(v)) && isFinite(Number(v));
const isLevelText = (v: string) => /^Level\s+\d/i.test(v);
const isKseKategori = (v: string) => ['Strategis', 'Tinggi', 'Rendah'].includes(v);

const kseKategoriClass: Record<string, string> = {
  'Strategis': 'kse-strategis',
  'Tinggi':    'kse-tinggi',
  'Rendah':    'kse-rendah',
};
const kseKategoriIcon: Record<string, string> = {
  'Strategis': 'ri-error-warning-fill',
  'Tinggi':    'ri-alert-fill',
  'Rendah':    'ri-checkbox-circle-fill',
};

const levelColorClass = (v: string): string => {
  if (/Level 1/i.test(v)) return 'level-1';
  if (/Level 2/i.test(v)) return 'level-2';
  if (/Level 3/i.test(v)) return 'level-3';
  if (/Level 4/i.test(v)) return 'level-4';
  if (/Level 5/i.test(v)) return 'level-5';
  return 'level-0';
};

const levelIcon: Record<string, string> = {
  'level-1': 'ri-signal-wifi-1-line',
  'level-2': 'ri-signal-wifi-2-line',
  'level-3': 'ri-signal-wifi-3-line',
  'level-4': 'ri-bar-chart-line',
  'level-5': 'ri-bar-chart-fill',
  'level-0': 'ri-error-warning-line',
};

const scorePercent = (title: string, value: string) => {
  const n = parseFloat(value);
  if (title === "IKAS") return Math.min((n / 4) * 100, 100);
  if (title === "KSE")  return Math.min(n, 100);
  return 0;
};
</script>

<template>
  <div
    v-for="(item, index) in analyticData"
    :key="index"
    class="col-12 col-sm-6 col-md-6 col-lg-6 col-xl-3 col-xxl-3 mb-4 spk-card-col"
  >
    <div :class="['as-card', accentColorClass[item.svgColor] ?? 'accent-blue']">

      <!-- Left accent strip -->
      <div class="as-strip"></div>

      <div class="as-body">
        <!-- Top row: icon + meta + button -->
        <div class="d-flex align-items-start gap-3">

          <!-- Icon -->
          <div :class="['as-icon', iconColorClass[item.svgColor] ?? 'icon-blue']">
            <span v-html="item.svgIcon" class="as-svg"></span>
          </div>

          <!-- Text -->
          <div class="flex-grow-1" style="min-width: 0;">
            <p class="as-label mb-1">{{ item.title }}</p>

            <!-- Numeric value -->
            <template v-if="isNumeric(item.value)">
              <div class="d-flex align-items-baseline gap-1 mb-2">
                <span class="as-value">{{ item.value }}</span>
                <span v-if="item.title === 'IKAS'" class="as-max">/ 4.00</span>
              </div>
              <!-- Score bar -->
              <div class="as-bar-track">
                <div
                  class="as-bar-fill"
                  :style="`width:${scorePercent(item.title, item.value)}%`"
                ></div>
              </div>
            </template>

            <!-- Maturity Level text (IKAS kategori) -->
            <template v-else-if="isLevelText(item.value)">
              <div :class="['as-level-badge', levelColorClass(item.value)]">
                <i :class="[levelIcon[levelColorClass(item.value)], 'me-1']" style="font-size:0.85rem"></i>
                <span>{{ item.value }}</span>
              </div>
            </template>

            <!-- KSE kategori (Strategis / Tinggi / Rendah) -->
            <template v-else-if="isKseKategori(item.value)">
              <div :class="['as-level-badge', kseKategoriClass[item.value]]">
                <i :class="[kseKategoriIcon[item.value], 'me-1']" style="font-size:0.85rem"></i>
                <span>{{ item.value }}</span>
              </div>
            </template>

            <!-- Terdaftar / Sudah Terdaftar -->
            <template v-else-if="isRegistered(item.value)">
              <span class="as-badge as-badge-ok">
                <i class="ri-checkbox-circle-fill me-1"></i>{{ item.value }}
              </span>
            </template>

            <!-- Aktif (CSIRT lengkap: CSIRT + SDM + SE) -->
            <template v-else-if="isAktif(item.value)">
              <span class="as-badge as-badge-aktif">
                <i class="ri-shield-check-fill me-1"></i>Aktif
              </span>
            </template>

            <!-- Sedang Setup (CSIRT ada tapi SDM/SE belum) -->
            <template v-else-if="isSedangSetup(item.value)">
              <span class="as-badge as-badge-setup">
                <i class="ri-settings-3-line me-1"></i>Sedang Setup
              </span>
            </template>

            <!-- Belum Terdaftar / Belum Diisi -->
            <template v-else-if="isBelum(item.value)">
              <span class="as-badge as-badge-empty">
                <i class="ri-time-line me-1"></i>{{ item.value }}
              </span>
            </template>

            <!-- Fallback -->
            <template v-else>
              <span class="as-badge as-badge-empty">
                <i class="ri-time-line me-1"></i>Belum Diisi
              </span>
            </template>
          </div>

          <!-- Arrow button -->
          <button
            v-if="item.title === 'IKAS'"
            class="as-arrow"
            @click="handleIkas"
            title="Lihat Detail"
          >
            <i class="ri-arrow-right-up-line"></i>
          </button>
          <button
            v-else-if="item.title === 'CSIRT'"
            class="as-arrow"
            @click="handleCsirt"
            title="Lihat Detail"
          >
            <i class="ri-arrow-right-up-line"></i>
          </button>
          <button
            v-else-if="item.title === 'KSE'"
            class="as-arrow"
            @click="handleKse"
            title="Lihat Detail"
          >
            <i class="ri-arrow-right-up-line"></i>
          </button>
          <button
            v-else-if="item.title === 'Resiko' || item.title === 'Survey Resiko'"
            class="as-arrow"
            @click="handleResiko"
            title="Lihat Detail"
          >
            <i class="ri-arrow-right-up-line"></i>
          </button>
        </div>

        <!-- Footer divider + sub label + CTA -->
        <div class="as-footer">
          <span class="as-sublabel">
            <i class="ri-information-line me-1 opacity-50"></i>{{ subLabel[item.title] }}
          </span>
          <button
            v-if="item.title === 'IKAS'"
            class="as-detail-btn"
            @click="handleIkas"
          >Lihat Detail <i class="ri-arrow-right-line ms-1"></i></button>
          <button
            v-else-if="item.title === 'CSIRT'"
            class="as-detail-btn"
            @click="handleCsirt"
          >Lihat Detail <i class="ri-arrow-right-line ms-1"></i></button>
          <button
            v-else-if="item.title === 'KSE'"
            class="as-detail-btn"
            @click="handleKse"
          >Lihat Detail <i class="ri-arrow-right-line ms-1"></i></button>
          <button
            v-else-if="item.title === 'Resiko' || item.title === 'Survey Resiko'"
            class="as-detail-btn"
            @click="handleResiko"
          >Lihat Detail <i class="ri-arrow-right-line ms-1"></i></button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*  Card shell  */
.as-card {
  display: flex;
  border-radius: 14px;
  overflow: hidden;
  background: linear-gradient(145deg, #fff 0%, #f8fbff 100%);
  box-shadow: 0 2px 12px rgba(99,51,228,0.08), 0 1px 4px rgba(37,99,235,0.06);
  border: 1px solid transparent;
  background-clip: padding-box;
  position: relative;
  transition: box-shadow 0.25s, transform 0.25s;
}
.as-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 14px;
  padding: 1px;
  background: linear-gradient(135deg,
    rgba(99,51,228,0.15) 0%,
    rgba(37,99,235,0.10) 50%,
    rgba(20,184,166,0.08) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
.as-card:hover {
  box-shadow: 0 10px 32px rgba(99,51,228,0.16), 0 3px 10px rgba(37,99,235,0.10);
  transform: translateY(-3px);
}

/*  Left accent strip  */
.as-strip {
  width: 5px;
  flex-shrink: 0;
  background: var(--strip-color, #2563eb);
  border-radius: 0;
}
.accent-blue   { --strip-color: linear-gradient(180deg, #1e40af, #60a5fa); }
.accent-violet { --strip-color: linear-gradient(180deg, #5b21b6, #c084fc); }
.accent-teal   { --strip-color: linear-gradient(180deg, #0f766e, #5eead4); }
.accent-amber  { --strip-color: linear-gradient(180deg, #b45309, #fbbf24); }
.accent-red    { --strip-color: linear-gradient(180deg, #991b1b, #f87171); }
.as-strip { background: var(--strip-color); }

/*  Body  */
.as-body {
  flex: 1;
  padding: 16px 18px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

/*  Icon box  */
.as-icon {
  width: 50px;
  height: 50px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon-blue   { background: linear-gradient(135deg,#1e40af 0%,#2563eb 50%,#60a5fa 100%); box-shadow:0 4px 14px rgba(37,99,235,0.38); }
.icon-violet { background: linear-gradient(135deg,#5b21b6 0%,#7c3aed 50%,#c084fc 100%); box-shadow:0 4px 14px rgba(124,58,237,0.38); }
.icon-teal   { background: linear-gradient(135deg,#0f766e 0%,#14b8a6 50%,#5eead4 100%); box-shadow:0 4px 14px rgba(20,184,166,0.38); }
.icon-amber  { background: linear-gradient(135deg,#b45309 0%,#d97706 50%,#fbbf24 100%); box-shadow:0 4px 14px rgba(217,119,6,0.38); }
.icon-red    { background: linear-gradient(135deg,#991b1b 0%,#dc2626 50%,#f87171 100%); box-shadow:0 4px 14px rgba(220,38,38,0.38); }

.as-svg :deep(svg) {
  width: 23px;
  height: 23px;
  fill: #fff !important;
}

/*  Typography  */
.as-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8faabf;
  line-height: 1;
}
.as-value {
  font-size: 1.55rem;
  font-weight: 800;
  color: #1e3a5f;
  line-height: 1;
}
.as-max {
  font-size: 0.78rem;
  color: #aabdd0;
  font-weight: 500;
}

/*  Score bar  */
.as-bar-track {
  height: 5px;
  background: #e8f0f8;
  border-radius: 99px;
  overflow: hidden;
  width: 100%;
}
.as-bar-fill {
  height: 100%;
  border-radius: 99px;
  background: var(--strip-color, linear-gradient(90deg,#2563eb,#60a5fa));
  transition: width 0.7s ease;
}

/* ── Maturity Level Badge ── */
.as-level-badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: 50rem;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 2px;
}
.level-1 { background: #fef2f2; color: #b91c1c; border: 1px solid #fca5a5; }
.level-2 { background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; }
.level-3 { background: #fefce8; color: #a16207; border: 1px solid #fde047; }
.level-4 { background: #f0fdf4; color: #15803d; border: 1px solid #86efac; }
.level-5 { background: linear-gradient(135deg,#d1fae5,#a7f3d0); color: #065f46; border: 1px solid #6ee7b7; box-shadow: 0 1px 4px rgba(16,185,129,0.2); }
.level-0 { background: #f1f5f9; color: #94a3b8; border: 1px solid #e2e8f0; }
html[data-theme-mode="dark"] .level-1, html.dark .level-1 { background: rgba(185,28,28,0.15); color: #f87171; border-color: rgba(248,113,113,0.3); }
html[data-theme-mode="dark"] .level-2, html.dark .level-2 { background: rgba(194,65,12,0.15); color: #fb923c; border-color: rgba(251,146,60,0.3); }
html[data-theme-mode="dark"] .level-3, html.dark .level-3 { background: rgba(161,98,7,0.15);  color: #fbbf24; border-color: rgba(251,191,36,0.3); }
html[data-theme-mode="dark"] .level-4, html.dark .level-4 { background: rgba(21,128,61,0.15);  color: #4ade80; border-color: rgba(74,222,128,0.3); }
html[data-theme-mode="dark"] .level-5, html.dark .level-5 { background: rgba(16,185,129,0.18); color: #34d399; border-color: rgba(52,211,153,0.3); }

/* KSE Kategori badges — matches kse-badge from style2.css */
.kse-strategis { background: linear-gradient(135deg,#ffe4e6,#fecdd3); color: #991b1b; border: 1px solid #fca5a5; }
.kse-tinggi    { background: linear-gradient(135deg,#fef9c3,#fde68a); color: #92400e; border: 1px solid #fcd34d; }
.kse-rendah    { background: linear-gradient(135deg,#d1fae5,#a7f3d0); color: #065f46; border: 1px solid #6ee7b7; box-shadow: 0 1px 4px rgba(16,185,129,0.2); }
html[data-theme-mode="dark"] .kse-strategis, html.dark .kse-strategis { background: rgba(185,28,28,0.15); color: #f87171; border-color: rgba(248,113,113,0.3); }
html[data-theme-mode="dark"] .kse-tinggi,    html.dark .kse-tinggi    { background: rgba(161,98,7,0.15);  color: #fbbf24; border-color: rgba(251,191,36,0.3); }
html[data-theme-mode="dark"] .kse-rendah,    html.dark .kse-rendah    { background: rgba(16,185,129,0.18); color: #34d399; border-color: rgba(52,211,153,0.3); }

/*  Badges  */
.as-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 50rem;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.4;
}
.as-badge-ok {
  background: linear-gradient(135deg,#d1fae5,#a7f3d0);
  color: #065f46;
  border: 1px solid #6ee7b7;
  box-shadow: 0 1px 4px rgba(16,185,129,0.2);
}
.as-badge-empty {
  background: #f1f5f9;
  color: #94a3b8;
  border: 1px solid #e2e8f0;
}
.as-badge-aktif {
  background: linear-gradient(135deg,#d1fae5,#a7f3d0);
  color: #065f46;
  border: 1px solid #6ee7b7;
  box-shadow: 0 1px 4px rgba(16,185,129,0.2);
}
.as-badge-setup {
  background: linear-gradient(135deg,#fef9c3,#fde68a);
  color: #92400e;
  border: 1px solid #fcd34d;
}
html[data-theme-mode="dark"] .as-badge-aktif, html.dark .as-badge-aktif { background: rgba(16,185,129,0.18); color: #34d399; border-color: rgba(52,211,153,0.3); }
html[data-theme-mode="dark"] .as-badge-setup, html.dark .as-badge-setup { background: rgba(161,98,7,0.15); color: #fbbf24; border-color: rgba(251,191,36,0.3); }

/*  Arrow button (top-right)  */
.as-arrow {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1.5px solid #dce8f5;
  background: #f8fbff;
  color: #6b84a3;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.18s, border-color 0.18s, color 0.18s, transform 0.15s;
}
.as-arrow:hover {
  background: var(--strip-color, #e8f0fe);
  border-color: #2563eb;
  color: #2563eb;
  transform: scale(1.12) rotate(5deg);
}

/*  Footer row  */
.as-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid #eef3fb;
  gap: 8px;
  flex-wrap: wrap; /* allow wrap on tight spaces */
}
.as-sublabel {
  font-size: 11px;
  color: #9bb5ce;
  line-height: 1.35;
}
.as-detail-btn {
  font-size: 11.5px;
  font-weight: 700;
  color: #2563eb;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  transition: color 0.18s, gap 0.18s;
  flex-shrink: 0;
  margin-left: auto; /* keeps button on right when wrapped */
}
.as-detail-btn:hover { color: #1d4ed8; }
.as-detail-btn:hover i { transform: translateX(2px); transition: transform 0.15s; }

/*  Dark mode  */
html[data-theme-mode="dark"] .as-card,
html.dark .as-card {
  background: linear-gradient(145deg, #1a2535 0%, #1e2d40 100%);
  box-shadow: 0 2px 16px rgba(0,0,0,0.4);
}
html[data-theme-mode="dark"] .as-card:hover,
html.dark .as-card:hover {
  box-shadow: 0 10px 36px rgba(0,0,0,0.5);
}
html[data-theme-mode="dark"] .as-value,
html.dark .as-value { color: #dde8f5; }
html[data-theme-mode="dark"] .as-label,
html.dark .as-label { color: #5a7890; }
html[data-theme-mode="dark"] .as-max,
html.dark .as-max   { color: #3d5a72; }
html[data-theme-mode="dark"] .as-bar-track,
html.dark .as-bar-track { background: rgba(255,255,255,0.07); }
html[data-theme-mode="dark"] .as-footer,
html.dark .as-footer { border-top-color: rgba(255,255,255,0.07); }
html[data-theme-mode="dark"] .as-sublabel,
html.dark .as-sublabel { color: #3d5a72; }
html[data-theme-mode="dark"] .as-detail-btn,
html.dark .as-detail-btn { color: #60a5fa; }
html[data-theme-mode="dark"] .as-detail-btn:hover,
html.dark .as-detail-btn:hover { color: #93c5fd; }
html[data-theme-mode="dark"] .as-arrow,
html.dark .as-arrow {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.10);
  color: #4a6580;
}
html[data-theme-mode="dark"] .as-arrow:hover,
html.dark .as-arrow:hover {
  background: rgba(37,99,235,0.18);
  border-color: #3b82f6;
  color: #60a5fa;
}
html[data-theme-mode="dark"] .as-badge-empty,
html.dark .as-badge-empty {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.35);
}

/* Custom Responsive Rule: Force 2x2 grid on monitors up to 1600px (e.g. 1920px at 125% zoom) */
@media (min-width: 576px) and (max-width: 1620px) {
  .spk-card-col {
    flex: 0 0 auto !important;
    width: 50% !important;
  }
}
</style>