<script setup lang="ts">
import { nextTick, onActivated, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import gsap from "gsap";

interface AnalyticItem {
  svgIcon: string;
  svgColor: string;
  title: string;
  value: string | number;
}

const props = withDefaults(defineProps<{
  analyticData?: AnalyticItem[];
  csirtId?: number | string | null;
  stakeholderSlug?: string | null;
}>(), {
  analyticData: () => [],
  csirtId: null,
  stakeholderSlug: null,
});

const router = useRouter();
const cardContainer = ref<HTMLElement | null>(null);
let prefersReducedMotion = false;
let skippedInitialActivation = false;

onBeforeUnmount(() => {
  if (!cardContainer.value) return;

  const cards = cardContainer.value.querySelectorAll(".as-card");
  const fills = cardContainer.value.querySelectorAll(".as-meter-fill");
  gsap.killTweensOf(cards);
  gsap.killTweensOf(fills);
});

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
  Resiko: "Profil Manajemen Risiko",
  "Survey Resiko": "Profil Manajemen Risiko",
};

const iconColorClass: Record<string, string> = {
  primary: "icon-blue",
  secondary: "icon-violet",
  success: "icon-teal",
  warning: "icon-amber",
  danger: "icon-red",
};

const accentColorClass: Record<string, string> = {
  primary: "accent-blue",
  secondary: "accent-violet",
  success: "accent-teal",
  warning: "accent-amber",
  danger: "accent-red",
};

const kseKategoriClass: Record<string, string> = {
  Strategis: "kse-strategis",
  Tinggi: "kse-tinggi",
  Rendah: "kse-rendah",
};

const kseKategoriIcon: Record<string, string> = {
  Strategis: "ri-error-warning-fill",
  Tinggi: "ri-alert-fill",
  Rendah: "ri-checkbox-circle-fill",
};

const levelIcon: Record<string, string> = {
  "level-1": "ri-signal-wifi-1-line",
  "level-2": "ri-signal-wifi-2-line",
  "level-3": "ri-signal-wifi-3-line",
  "level-4": "ri-bar-chart-line",
  "level-5": "ri-bar-chart-fill",
  "level-0": "ri-error-warning-line",
};

const normalizeValue = (value: string | number) => String(value ?? "").trim();
const statusText = (item: AnalyticItem) => normalizeValue(item.value) || "Belum Diisi";

const isBelum = (value: string) => value === "Belum Diisi" || value === "Belum Terdaftar";
const isRegistered = (value: string) => value === "Terdaftar" || value === "Sudah Terdaftar" || /^\d+\s+SE\s+Terdaftar$/i.test(value);
const isAktif = (value: string) => value === "Aktif";
const isSedangSetup = (value: string) => value === "Sedang Setup";
const isNumeric = (value: string) => !Number.isNaN(parseFloat(value)) && Number.isFinite(Number(value));
const isLevelText = (value: string) => /^Level\s+\d/i.test(value);
const isKseKategori = (value: string) => ["Strategis", "Tinggi", "Rendah"].includes(value);

const levelColorClass = (value: string): string => {
  if (/Level 1/i.test(value)) return "level-1";
  if (/Level 2/i.test(value)) return "level-2";
  if (/Level 3/i.test(value)) return "level-3";
  if (/Level 4/i.test(value)) return "level-4";
  if (/Level 5/i.test(value)) return "level-5";
  return "level-0";
};

const scorePercent = (title: string, value: string) => {
  const numberValue = parseFloat(value);
  if (title === "IKAS") return Math.min((numberValue / 4) * 100, 100);
  if (title === "KSE") return Math.min(numberValue, 100);
  return 0;
};

const meterPercent = (item: AnalyticItem) => {
  const value = statusText(item);
  if (isNumeric(value)) return scorePercent(item.title, value);

  const level = value.match(/Level\s+(\d+)/i);
  if (level) return Math.min((Number(level[1]) / 5) * 100, 100);

  if (isRegistered(value) || isAktif(value)) return 100;
  if (isSedangSetup(value) || value === "Dalam Proses") return 58;
  if (isKseKategori(value)) return value === "Strategis" ? 100 : value === "Tinggi" ? 72 : 46;
  return 0;
};

const meterValueLabel = (item: AnalyticItem) => {
  const value = statusText(item);
  if (item.title === "IKAS" && isNumeric(value)) return value;
  return `${Math.round(meterPercent(item))}%`;
};

const statusClass = (item: AnalyticItem) => {
  const value = statusText(item);
  if (isLevelText(value)) return `as-status-level ${levelColorClass(value)}`;
  if (isKseKategori(value)) return `as-status-level ${kseKategoriClass[value]}`;
  if (isRegistered(value)) return "as-status-ok";
  if (isAktif(value)) return "as-status-aktif";
  if (isSedangSetup(value) || value === "Dalam Proses") return "as-status-setup";
  return "as-status-empty";
};

const statusIcon = (item: AnalyticItem) => {
  const value = statusText(item);
  if (isLevelText(value)) return levelIcon[levelColorClass(value)];
  if (isKseKategori(value)) return kseKategoriIcon[value];
  if (isRegistered(value)) return "ri-checkbox-circle-fill";
  if (isAktif(value)) return "ri-shield-check-fill";
  if (isSedangSetup(value)) return "ri-settings-3-line";
  if (value === "Dalam Proses") return "ri-loader-4-line";
  return "ri-time-line";
};

const metricCaption = (item: AnalyticItem) => {
  const value = statusText(item);
  if (isBelum(value)) return "Perlu tindakan";
  if (isSedangSetup(value) || value === "Dalam Proses") return "Dalam proses";
  if (isRegistered(value) || isAktif(value)) return "Lengkap";
  if (isNumeric(value) || isLevelText(value) || isKseKategori(value)) return "Skor terbaru";
  return "Status";
};

const navigateToDetail = (item: AnalyticItem) => {
  if (item.title === "IKAS") return handleIkas();
  if (item.title === "CSIRT") return handleCsirt();
  if (item.title === "KSE") return handleKse();
  if (item.title === "Resiko" || item.title === "Survey Resiko") return handleResiko();
};

const animateCards = async () => {
  if (!cardContainer.value) return;

  prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  await nextTick();

  const cards = cardContainer.value.querySelectorAll(".as-card");
  const fills = cardContainer.value.querySelectorAll(".as-meter-fill");

  gsap.killTweensOf(cards);
  gsap.killTweensOf(fills);

  gsap.set(cards, {
    y: 24,
    opacity: 0,
    scale: 0.975,
    filter: "blur(5px)",
  });
  gsap.set(fills, { scaleX: 0, transformOrigin: "left center" });

  gsap.to(cards, {
    y: 0,
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    duration: prefersReducedMotion ? 0.01 : 0.68,
    stagger: prefersReducedMotion ? 0 : 0.1,
    ease: "power3.out",
    clearProps: "filter",
  });

  gsap.to(fills, {
    scaleX: 1,
    duration: prefersReducedMotion ? 0.01 : 0.8,
    delay: prefersReducedMotion ? 0 : 0.2,
    stagger: prefersReducedMotion ? 0 : 0.07,
    ease: "power2.out",
  });
};

onMounted(() => {
  animateCards();
});

onActivated(() => {
  if (!skippedInitialActivation) {
    skippedInitialActivation = true;
    return;
  }

  animateCards();
});

const handleCardEnter = (event: MouseEvent) => {
  if (prefersReducedMotion) return;
  const card = event.currentTarget as HTMLElement;
  gsap.to(card, {
    y: -4,
    duration: 0.24,
    ease: "power2.out",
  });
};

const handleCardLeave = (event: MouseEvent) => {
  const card = event.currentTarget as HTMLElement;
  gsap.to(card, {
    y: 0,
    duration: prefersReducedMotion ? 0.01 : 0.28,
    ease: "power2.out",
  });
};
</script>

<template>
  <div ref="cardContainer" class="as-card-wrapper">
    <div
      v-for="(item, index) in analyticData"
      :key="index"
      class="col-12 col-sm-6 col-md-6 col-lg-6 col-xl-3 col-xxl-3 mb-3 spk-card-col"
    >
      <article
        :class="['as-card', accentColorClass[item.svgColor] ?? 'accent-blue']"
        @mouseenter="handleCardEnter"
        @mouseleave="handleCardLeave"
      >
        <div class="as-strip"></div>

        <div class="as-body">
          <div class="as-main">
            <div :class="['as-icon', iconColorClass[item.svgColor] ?? 'icon-blue']">
              <span v-html="item.svgIcon" class="as-svg"></span>
            </div>

            <div class="as-copy">
              <p class="as-label mb-1">{{ item.title }}</p>

              <template v-if="isNumeric(statusText(item))">
                <div class="as-value-row">
                  <span class="as-value">{{ statusText(item) }}</span>
                  <span v-if="item.title === 'IKAS'" class="as-max">/ 4.00</span>
                </div>
              </template>

              <template v-else>
                <span :class="['as-status-pill', statusClass(item)]">
                  <i :class="[statusIcon(item), 'me-1']"></i>{{ statusText(item) }}
                </span>
              </template>
            </div>

            <button
              type="button"
              class="as-arrow"
              @click="navigateToDetail(item)"
              title="Lihat Detail"
            >
              <i class="ri-arrow-right-up-line"></i>
            </button>
          </div>

          <div class="as-meter">
            <div class="as-meter-head">
              <span>{{ metricCaption(item) }}</span>
              <strong>{{ meterValueLabel(item) }}</strong>
            </div>
            <div class="as-meter-track">
              <div class="as-meter-fill" :style="`width:${meterPercent(item)}%`"></div>
            </div>
          </div>

          <div class="as-footer">
            <span class="as-sublabel">
              <i class="ri-information-line me-1"></i>{{ subLabel[item.title] }}
            </span>
            <button
              type="button"
              class="as-detail-btn"
              @click="navigateToDetail(item)"
            >
              Lihat Detail <i class="ri-arrow-right-line ms-1"></i>
            </button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.as-card-wrapper {
  display: contents;
}

.as-card {
  display: flex;
  min-height: 148px;
  border-radius: 16px;
  overflow: hidden;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--as-accent-solid) 5%, #ffffff) 0%, #ffffff 42%, #fbfdff 100%);
  box-shadow:
    0 12px 28px rgba(15, 23, 42, 0.055),
    0 1px 2px rgba(15, 23, 42, 0.04);
  border: 1px solid rgba(219, 226, 236, 0.95);
  position: relative;
  opacity: 0;
  will-change: transform, opacity;
  transition: box-shadow 0.24s ease, border-color 0.24s ease, background 0.24s ease;
}

.as-card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, color-mix(in srgb, var(--as-accent-solid) 6%, transparent), transparent 42%);
  pointer-events: none;
  opacity: 0.65;
}

.as-card:hover {
  box-shadow:
    0 16px 34px rgba(15, 23, 42, 0.08),
    0 3px 10px rgba(15, 23, 42, 0.035);
  border-color: color-mix(in srgb, var(--as-accent-solid) 28%, #dbe2ec);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--as-accent-solid) 7%, #ffffff) 0%, #ffffff 46%, #fbfdff 100%);
}

.as-strip {
  width: 4px;
  flex-shrink: 0;
  background: var(--strip-color, linear-gradient(180deg, #2563eb, #60a5fa));
  border-radius: 0;
  transition: width 0.3s cubic-bezier(.4,0,.2,1);
}

.as-card:hover .as-strip {
  width: 5px;
}

.accent-blue {
  --strip-color: linear-gradient(180deg, #3b82f6, #93c5fd);
  --as-accent-solid: #2563eb;
}

.accent-violet {
  --strip-color: linear-gradient(180deg, #8b5cf6, #c4b5fd);
  --as-accent-solid: #8b5cf6;
}

.accent-teal {
  --strip-color: linear-gradient(180deg, #14b8a6, #99f6e4);
  --as-accent-solid: #14b8a6;
}

.accent-amber {
  --strip-color: linear-gradient(180deg, #f59e0b, #fde68a);
  --as-accent-solid: #f59e0b;
}

.accent-red {
  --strip-color: linear-gradient(180deg, #ef4444, #fda4af);
  --as-accent-solid: #ef4444;
}

.as-body {
  flex: 1;
  padding: 15px 16px 13px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.as-main {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.as-icon {
  width: 42px;
  height: 42px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  transition: transform 0.3s cubic-bezier(.4,0,.2,1), box-shadow 0.3s ease, filter 0.3s ease;
}

.as-icon::before {
  display: none;
}

.as-card:hover .as-icon {
  transform: translateY(-1px);
  filter: saturate(1.04);
}

.icon-blue { background: linear-gradient(135deg,#2563eb 0%,#60a5fa 100%); box-shadow:0 8px 18px rgba(37,99,235,0.18); }
.icon-violet { background: linear-gradient(135deg,#7c3aed 0%,#a78bfa 100%); box-shadow:0 8px 18px rgba(124,58,237,0.17); }
.icon-teal { background: linear-gradient(135deg,#0f988a 0%,#2dd4bf 100%); box-shadow:0 8px 18px rgba(20,184,166,0.17); }
.icon-amber { background: linear-gradient(135deg,#d97706 0%,#fbbf24 100%); box-shadow:0 8px 18px rgba(217,119,6,0.17); }
.icon-red { background: linear-gradient(135deg,#dc2626 0%,#fb7185 100%); box-shadow:0 8px 18px rgba(220,38,38,0.16); }

.as-card:hover .icon-blue { box-shadow:0 10px 20px rgba(37,99,235,0.22); }
.as-card:hover .icon-violet { box-shadow:0 10px 20px rgba(124,58,237,0.21); }
.as-card:hover .icon-teal { box-shadow:0 10px 20px rgba(20,184,166,0.21); }
.as-card:hover .icon-amber { box-shadow:0 10px 20px rgba(217,119,6,0.21); }
.as-card:hover .icon-red { box-shadow:0 10px 20px rgba(220,38,38,0.2); }

.as-svg :deep(svg) {
  width: 20px;
  height: 20px;
  fill: #fff !important;
}

.as-copy {
  min-width: 0;
  flex: 1;
  padding-top: 1px;
}

.as-label {
  font-size: 10.5px;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: 0;
  color: #64748b;
  line-height: 1;
}

.as-value-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-top: 6px;
}

.as-value {
  font-size: 1.45rem;
  font-weight: 900;
  color: #0f172a;
  line-height: 1;
}

.as-max {
  font-size: 0.78rem;
  color: #aabdd0;
  font-weight: 500;
}

.as-status-pill {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 26px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
  white-space: normal;
  box-shadow: none;
}

.as-status-level {
  box-shadow: none;
}

.level-1 { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
.level-2 { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
.level-3 { background: #fefce8; color: #a16207; border: 1px solid #fef08a; }
.level-4 { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
.level-5 { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; box-shadow: none; }
.level-0 { background: #f1f5f9; color: #94a3b8; border: 1px solid #e2e8f0; }

.kse-strategis { background: #fff1f2; color: #991b1b; border: 1px solid #fecdd3; }
.kse-tinggi { background: #fefce8; color: #92400e; border: 1px solid #fde68a; }
.kse-rendah { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; box-shadow: none; }

.as-status-ok,
.as-status-aktif {
  background: #dcfce7;
  color: #065f46;
  border: 1px solid #86efac;
  box-shadow: none;
}

.as-status-empty {
  background: #f1f5f9;
  color: #94a3b8;
  border: 1px solid #e2e8f0;
}

.as-status-setup {
  background: #fef9c3;
  color: #92400e;
  border: 1px solid #fde68a;
}

.as-arrow {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  border: 1px solid rgba(226, 232, 240, 0.96);
  background: rgba(255,255,255,0.9);
  color: #334155;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.28s cubic-bezier(.4,0,.2,1);
  backdrop-filter: blur(8px);
}

.as-arrow:hover {
  background: color-mix(in srgb, var(--as-accent-solid) 7%, #ffffff);
  border-color: color-mix(in srgb, var(--as-accent-solid) 28%, #cbd5e1);
  color: var(--as-accent-solid);
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.06);
}

.as-card:hover .as-arrow {
  border-color: color-mix(in srgb, var(--as-accent-solid) 30%, #cbd5e1);
  background: rgba(255,255,255,0.92);
}

.as-meter {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: auto;
}

.as-meter-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #8a98aa;
  font-size: 10.5px;
  font-weight: 800;
}

.as-meter-head strong {
  color: #334155;
  font-size: 11px;
  font-weight: 900;
}

.as-meter-track {
  width: 100%;
  height: 5px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(226, 232, 240, 0.72);
  box-shadow: none;
}

.as-meter-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--strip-color, linear-gradient(90deg,#2563eb,#60a5fa));
  transform-origin: left center;
  box-shadow: none;
}

.as-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid #eef2f7;
  gap: 8px;
  flex-wrap: wrap;
}

.as-sublabel {
  font-size: 10.5px;
  color: #8b9ab0;
  line-height: 1.35;
  min-width: 0;
}

.as-detail-btn {
  font-size: 11px;
  font-weight: 850;
  color: var(--as-accent-solid);
  background: transparent;
  border: none;
  padding: 3px 8px;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  transition: all 0.25s cubic-bezier(.4,0,.2,1);
  flex-shrink: 0;
  margin-left: auto;
}

.as-detail-btn:hover {
  color: var(--as-accent-solid);
  background: color-mix(in srgb, var(--as-accent-solid) 7%, transparent);
}

.as-detail-btn i {
  transition: transform 0.25s cubic-bezier(.4,0,.2,1);
}

.as-detail-btn:hover i {
  transform: translateX(4px);
}

html[data-theme-mode="dark"] .as-card,
html.dark .as-card {
  background:
    radial-gradient(circle at 86% 0%, color-mix(in srgb, var(--as-accent-solid) 20%, transparent), transparent 34%),
    linear-gradient(145deg, #1a2535 0%, #1e2d40 100%);
  box-shadow: 0 2px 16px rgba(0,0,0,0.4);
  border-color: rgba(255,255,255,0.08);
}

html[data-theme-mode="dark"] .as-card:hover,
html.dark .as-card:hover {
  box-shadow: 0 10px 36px rgba(0,0,0,0.5);
}

html[data-theme-mode="dark"] .as-value,
html.dark .as-value { color: #dde8f5; }

html[data-theme-mode="dark"] .as-label,
html.dark .as-label { color: #7d91a8; }

html[data-theme-mode="dark"] .as-max,
html.dark .as-max { color: #69839c; }

html[data-theme-mode="dark"] .as-footer,
html.dark .as-footer { border-top-color: rgba(255,255,255,0.07); }

html[data-theme-mode="dark"] .as-meter-track,
html.dark .as-meter-track { background: rgba(255,255,255,0.08); }

html[data-theme-mode="dark"] .as-meter-head,
html.dark .as-meter-head { color: #71879f; }

html[data-theme-mode="dark"] .as-meter-head strong,
html.dark .as-meter-head strong { color: #cbd5e1; }

html[data-theme-mode="dark"] .as-sublabel,
html.dark .as-sublabel { color: #7b91aa; }

html[data-theme-mode="dark"] .as-detail-btn,
html.dark .as-detail-btn { color: color-mix(in srgb, var(--as-accent-solid) 70%, #ffffff); }

html[data-theme-mode="dark"] .as-detail-btn:hover,
html.dark .as-detail-btn:hover { color: #93c5fd; }

html[data-theme-mode="dark"] .as-arrow,
html.dark .as-arrow {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.10);
  color: #9aacc0;
}

html[data-theme-mode="dark"] .as-arrow:hover,
html.dark .as-arrow:hover {
  background: rgba(37,99,235,0.18);
  border-color: #3b82f6;
  color: #60a5fa;
}

html[data-theme-mode="dark"] .as-status-empty,
html.dark .as-status-empty {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.48);
}

html[data-theme-mode="dark"] .as-status-aktif,
html.dark .as-status-aktif,
html[data-theme-mode="dark"] .as-status-ok,
html.dark .as-status-ok {
  background: rgba(16,185,129,0.18);
  color: #34d399;
  border-color: rgba(52,211,153,0.3);
}

html[data-theme-mode="dark"] .as-status-setup,
html.dark .as-status-setup {
  background: rgba(161,98,7,0.15);
  color: #fbbf24;
  border-color: rgba(251,191,36,0.3);
}

html[data-theme-mode="dark"] .level-1,
html.dark .level-1 { background: rgba(185,28,28,0.15); color: #f87171; border-color: rgba(248,113,113,0.3); }

html[data-theme-mode="dark"] .level-2,
html.dark .level-2 { background: rgba(194,65,12,0.15); color: #fb923c; border-color: rgba(251,146,60,0.3); }

html[data-theme-mode="dark"] .level-3,
html.dark .level-3 { background: rgba(161,98,7,0.15); color: #fbbf24; border-color: rgba(251,191,36,0.3); }

html[data-theme-mode="dark"] .level-4,
html.dark .level-4 { background: rgba(21,128,61,0.15); color: #4ade80; border-color: rgba(74,222,128,0.3); }

html[data-theme-mode="dark"] .level-5,
html.dark .level-5 { background: rgba(16,185,129,0.18); color: #34d399; border-color: rgba(52,211,153,0.3); }

html[data-theme-mode="dark"] .kse-strategis,
html.dark .kse-strategis { background: rgba(185,28,28,0.15); color: #f87171; border-color: rgba(248,113,113,0.3); }

html[data-theme-mode="dark"] .kse-tinggi,
html.dark .kse-tinggi { background: rgba(161,98,7,0.15); color: #fbbf24; border-color: rgba(251,191,36,0.3); }

html[data-theme-mode="dark"] .kse-rendah,
html.dark .kse-rendah { background: rgba(16,185,129,0.18); color: #34d399; border-color: rgba(52,211,153,0.3); }

@media (max-width: 575px) {
  .as-card {
    min-height: 150px;
  }

  .as-body {
    padding: 14px;
  }

  .as-main {
    gap: 12px;
  }

  .as-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
  }

  .as-footer {
    align-items: flex-start;
  }

  .as-detail-btn {
    padding-left: 0;
  }
}

@media (min-width: 576px) and (max-width: 1620px) {
  .spk-card-col {
    flex: 0 0 auto !important;
    width: 50% !important;
  }
}
</style>
