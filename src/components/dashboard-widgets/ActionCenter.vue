<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { useCsirtStore } from '@/stores/csirt';
import { useIkasStore } from '@/stores/ikas';
import { useKseStore } from '@/stores/kse';
import { useDashboardFilterStore } from '@/stores/dashboardFilter';

const router = useRouter();
const stakeholdersStore = useStakeholdersStore();
const csirtStore = useCsirtStore();
const ikasStore = useIkasStore();
const kseStore = useKseStore();
const filterStore = useDashboardFilterStore();
const props = defineProps({
    loading: { type: Boolean, default: false },
});
const isDarkMode = ref(false);
let themeObserver;

function syncThemeMode() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;
    isDarkMode.value =
        root.getAttribute('data-theme-mode') === 'dark' ||
        body?.getAttribute('data-theme-mode') === 'dark' ||
        root.classList.contains('dark') ||
        body?.classList.contains('dark');
}

onMounted(() => {
    syncThemeMode();
    themeObserver = new MutationObserver(syncThemeMode);
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme-mode', 'class'],
    });
    if (document.body) {
        themeObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-theme-mode', 'class'],
        });
    }
});

onUnmounted(() => {
    themeObserver?.disconnect();
});

const SEVERITY_RANK = {
    critical: 1,
    warning: 2,
    info: 3,
    success: 4,
};

// Helper to filter by global date range
function isInGlobalRange(createdAt) {
    const range = filterStore.dateRange;
    if (!range || !range[0] || !range[1] || !createdAt) return true;
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return false;
    const start = new Date(range[0]);
    start.setHours(0, 0, 0, 0);
    const end = new Date(range[1]);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
}

function isFilledKseCategory(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return !!normalized && !['belum dikategorikan', 'belum lengkap', 'n/a', 'na', '-'].includes(normalized);
}

function stakeholderHasKse(stakeholder) {
    const directSe = csirtStore.seByPerusahaanMap[String(stakeholder.id)] || [];
    if (directSe.some(se => isFilledKseCategory(se.kategori_se))) return true;

    const csirt = csirtStore.csirtByPerusahaanMap[String(stakeholder.id)];
    const csirtSe = csirt ? (csirtStore.seByCsirtMap[String(csirt.id)] || []) : [];
    if (csirtSe.some(se => isFilledKseCategory(se.kategori_se))) return true;

    const localData = kseStore.kseDataMap[stakeholder.slug];
    return !!localData && isFilledKseCategory(localData.kategoriSE);
}

const actions = computed(() => {
    if (props.loading) return [];

    const all = stakeholdersStore.allStakeholders.filter(s => {
        const inDate = isInGlobalRange(s.created_at);
        const inSector = filterStore.sektorId ? s.sub_sektor?.id_sektor == filterStore.sektorId || s.id_sektor == filterStore.sektorId : true;
        return inDate && inSector;
    });
    const items = [];

    // Critical: stakeholders without CSIRT
    const noCsirt = all.filter(s => !csirtStore.csirtByPerusahaanMap[String(s.id)]);
    if (noCsirt.length > 0) {
        items.push({
            severity: 'critical',
            score: noCsirt.length * 4,
            icon: 'ri-shield-line',
            color: '#e6533c',
            title: `Tindak Lanjut Pembentukan CSIRT`,
            desc: `${noCsirt.length} stakeholder belum mendaftarkan profil CSIRT`,
            action: 'Lengkapi',
            route: '/csirt-list',
            meta: `Prioritas operasional: Segera lengkapi`,
        });
    }

    // Critical: stakeholders without IKAS
    const noIkas = all.filter(s => {
        const data = ikasStore.ikasDataMap[s.slug];
        return !data || !data.total_rata_rata || data.total_rata_rata === 'NA' || data.total_rata_rata === 0;
    });
    if (noIkas.length > 0) {
        items.push({
            severity: 'critical',
            score: noIkas.length * 3,
            icon: 'ri-file-chart-line',
            color: '#e6533c',
            title: `Akselerasi Pengisian IKAS`,
            desc: `${noIkas.length} stakeholder belum memulai assessment IKAS`,
            action: 'Validasi Data',
            route: '/ikas-list',
            meta: `Kritikal: Perlu pendampingan`,
        });
    }

    // Critical: stakeholders without KSE
    const noKse = all.filter(s => !stakeholderHasKse(s));
    if (noKse.length > 0) {
        items.push({
            severity: 'critical',
            score: noKse.length * 3,
            icon: 'ri-file-shield-2-line',
            color: '#e6533c',
            title: `Verifikasi Kategori Sistem Elektronik`,
            desc: `${noKse.length} stakeholder belum memetakan kategori SE`,
            action: 'Lengkapi',
            route: '/kse-list-admin',
            meta: `Segera lengkapi`,
        });
    }

    // Warning: low CSIRT SDM count
    const csirtsLowSdm = csirtStore.csirts.filter(c => {
        const sdmCount = csirtStore.sdmList.filter(s =>
            String(s.id_csirt) === String(c.id)
        ).length;
        return sdmCount < 2;
    });
    if (csirtsLowSdm.length > 0) {
        items.push({
            severity: 'warning',
            score: csirtsLowSdm.length * 2,
            icon: 'ri-team-line',
            color: '#f5b849',
            title: `Evaluasi Kapasitas SDM CSIRT`,
            desc: `${csirtsLowSdm.length} tim CSIRT tercatat memiliki kurang dari 2 personel`,
            action: 'Review',
            route: '/csirt-list',
            meta: 'Risiko operasional',
        });
    }

    // Info: stagnant data (last update > 30 days)
    const stagnant = all.filter(s => {
        const d = new Date(s.updated_at || s.created_at);
        return !isNaN(d.getTime()) && (Date.now() - d.getTime()) > 30 * 86400000;
    });
    if (stagnant.length > 3) {
        items.push({
            severity: 'info',
            score: stagnant.length,
            icon: 'ri-time-line',
            color: '#0ea5e9',
            title: `Pembaruan Data Berkala`,
            desc: `${stagnant.length} stakeholder tidak ada aktivitas > 30 hari`,
            action: 'Review Data',
            route: '/stakeholders',
            meta: 'Review dan konfirmasi ulang',
        });
    }

    // All good
    if (items.length === 0) {
        items.push({
            severity: 'success',
            score: 0,
            icon: 'ri-checkbox-circle-line',
            color: '#26bf94',
            title: 'Semua data dalam kondisi baik',
            desc: 'Tidak ada aksi yang dibutuhkan saat ini',
            action: null,
            route: null,
            meta: 'Pantau pembaruan berikutnya',
        });
    }

    return items.sort((a, b) => {
        const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        return severityDiff || b.score - a.score;
    });
});

const actionStats = computed(() => {
    const active = actions.value.filter(item => item.severity !== 'success');
    const critical = active.filter(item => item.severity === 'critical').length;
    const totalImpact = active.reduce((sum, item) => sum + item.score, 0);

    return {
        activeCount: active.length,
        critical,
        totalImpact,
        focus: active[0] || null,
        label: critical > 0 ? 'Urgent' : active.length > 0 ? 'Perlu follow up' : 'Beres',
    };
});

const completionRate = computed(() => {
    const total = stakeholdersStore.allStakeholders.filter(s => {
        const inDate = isInGlobalRange(s.created_at);
        const inSector = filterStore.sektorId ? s.sub_sektor?.id_sektor == filterStore.sektorId || s.id_sektor == filterStore.sektorId : true;
        return inDate && inSector;
    }).length;

    if (total === 0) return 0;

    const complete = stakeholdersStore.allStakeholders.filter(s => {
        const inDate = isInGlobalRange(s.created_at);
        const inSector = filterStore.sektorId ? s.sub_sektor?.id_sektor == filterStore.sektorId || s.id_sektor == filterStore.sektorId : true;
        const ikas = ikasStore.ikasDataMap[s.slug];
        const hasIkas = ikas && ikas.total_rata_rata && ikas.total_rata_rata !== 'NA' && ikas.total_rata_rata !== 0;
        return inDate && inSector && csirtStore.hasCompleteCsirt(s.id) && hasIkas && stakeholderHasKse(s);
    }).length;

    return Math.round((complete / total) * 100);
});

function navigate(route) {
    if (route) router.push(route);
}
</script>

<template>
    <div class="dw-card dw-fade-up action-dashboard-card" :class="{ 'is-dark': isDarkMode }">
        <div class="dw-card-header">
            <h6 class="dw-card-header-title">
                <div class="dw-card-header-icon" style="background: linear-gradient(135deg, #e6533c, #f87171); color: #fff;">
                    <i class="ri-alarm-warning-line"></i>
                </div>
                <div>
                    <span>Action Center</span>
                    <div class="dw-card-header-sub">Prioritas kerja admin hari ini</div>
                </div>
            </h6>
            <span v-if="actionStats.activeCount > 0" class="dw-badge" :class="actionStats.critical > 0 ? 'dw-badge-critical' : 'dw-badge-warning'">
                {{ actionStats.label }}
            </span>
            <span v-else class="dw-badge dw-badge-success">
                <i class="ri-check-line"></i> OK
            </span>
        </div>
        <div class="dw-card-body action-center-body">
            <div v-if="loading" class="d-flex flex-column gap-2 placeholder-glow">
                <div class="action-summary-panel">
                    <span class="placeholder col-5" style="height:12px;border-radius:6px;"></span>
                    <span class="placeholder col-12" style="height:8px;border-radius:99px;"></span>
                </div>
                <div v-for="n in 4" :key="'action-skeleton-' + n" class="dw-action-item">
                    <span class="placeholder" style="width:4px;height:42px;border-radius:99px;"></span>
                    <span class="placeholder" style="width:36px;height:36px;border-radius:10px;"></span>
                    <div class="flex-grow-1">
                        <span class="placeholder col-10 d-block mb-2" style="height:12px;border-radius:6px;"></span>
                        <span class="placeholder col-7 d-block" style="height:10px;border-radius:6px;"></span>
                    </div>
                    <span class="placeholder" style="width:72px;height:28px;border-radius:8px;"></span>
                </div>
            </div>
            <div v-else class="d-flex flex-column gap-2">
                <div class="action-summary-panel">
                    <div class="action-summary-top">
                        <div>
                            <strong>{{ actionStats.activeCount }} agenda aktif</strong>
                            <span>{{ actionStats.critical }} prioritas kritis</span>
                        </div>
                        <div class="action-completion">{{ completionRate }}%</div>
                    </div>
                    <div class="action-progress">
                        <span :style="{ width: `${completionRate}%` }"></span>
                    </div>
                    <div class="action-focus" v-if="actionStats.critical > 0">
                        Fokus utama: Selesaikan {{ actionStats.critical }} kategori prioritas kritis
                    </div>
                    <div class="action-focus" v-else-if="actionStats.activeCount > 0">
                        Fokus utama: Lanjutkan pendampingan pada {{ actionStats.activeCount }} agenda
                    </div>
                </div>
                <div v-for="(item, idx) in actions" :key="idx"
                     class="dw-action-item dw-fade-up"
                     :class="{ 'is-clickable': item.route }"
                     :style="{ animationDelay: `${idx * 60}ms` }"
                     @click="navigate(item.route)">
                    <div class="dw-action-severity" :style="{
                        background: item.severity === 'critical' ? '#e6533c' :
                                    item.severity === 'warning' ? '#f5b849' :
                                    item.severity === 'success' ? '#26bf94' : '#0ea5e9'
                    }"></div>
                    <div class="dw-insight-icon" :style="{
                        background: item.severity === 'critical' ? 'rgba(230,83,60,0.1)' :
                                    item.severity === 'warning' ? 'rgba(245,184,73,0.1)' :
                                    item.severity === 'success' ? 'rgba(38,191,148,0.1)' : 'rgba(14,165,233,0.1)',
                        color: item.color
                    }">
                        <i :class="item.icon"></i>
                    </div>
                    <div class="flex-grow-1" style="min-width: 0;">
                        <div class="action-title">{{ item.title }}</div>
                        <div class="action-desc">{{ item.desc }}</div>
                        <div class="action-meta">
                            <i class="ri-information-line"></i>
                            <span>{{ item.meta }}</span>
                        </div>
                    </div>
                    <button v-if="item.action" class="action-button" @click.stop="navigate(item.route)">
                        {{ item.action }}
                        <i class="ri-arrow-right-s-line"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.action-center-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 12px 16px;
}

.action-dashboard-card.is-dark {
    color-scheme: dark;
    background: #151a2b;
    border-color: rgba(148, 163, 184, 0.22);
    box-shadow:
        0 16px 38px rgba(0, 0, 0, 0.26),
        inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.action-dashboard-card.is-dark .dw-card-header {
    border-bottom-color: rgba(148, 163, 184, 0.16);
    background: linear-gradient(180deg, rgba(23, 30, 48, 0.98), rgba(21, 26, 43, 0.96));
}

.action-dashboard-card.is-dark .dw-card-header-title,
.action-dashboard-card.is-dark .action-summary-top strong,
.action-dashboard-card.is-dark .action-title {
    color: #eef4ff;
}

.action-dashboard-card.is-dark .dw-card-header-sub,
.action-dashboard-card.is-dark .action-summary-top span,
.action-dashboard-card.is-dark .action-desc,
.action-dashboard-card.is-dark .action-meta,
.action-dashboard-card.is-dark .action-focus {
    color: #94a3b8;
}

.action-dashboard-card.is-dark .dw-card-header-icon {
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.action-dashboard-card.is-dark .dw-card-body {
    background:
        radial-gradient(circle at 12% 0%, rgba(239, 68, 68, 0.11), transparent 34%),
        linear-gradient(180deg, #151a2b 0%, #111827 100%);
}

.action-dashboard-card.is-dark .action-summary-panel {
    background: linear-gradient(135deg, rgba(127, 29, 29, 0.18), rgba(30, 41, 59, 0.92));
    border-color: rgba(148, 163, 184, 0.18);
}

.action-dashboard-card.is-dark .action-completion {
    color: #60a5fa;
}

.action-dashboard-card.is-dark .action-progress {
    background: rgba(148, 163, 184, 0.18);
}

.action-dashboard-card.is-dark .dw-action-item {
    background: rgba(15, 23, 42, 0.78);
    border-color: rgba(148, 163, 184, 0.16);
}

.action-dashboard-card.is-dark .dw-action-item:hover {
    background: rgba(37, 99, 235, 0.12);
    border-color: rgba(96, 165, 250, 0.3);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
}

.action-dashboard-card.is-dark .dw-insight-icon {
    background: rgba(30, 41, 59, 0.78) !important;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.action-dashboard-card.is-dark .action-button {
    background: rgba(15, 23, 42, 0.86);
    border-color: rgba(147, 197, 253, 0.22);
    color: #93c5fd;
}

.action-dashboard-card.is-dark .action-button:hover {
    background: #2563eb;
    border-color: #60a5fa;
    color: #ffffff;
}

.action-dashboard-card {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.action-summary-panel {
    padding: 13px 14px;
    border: 1px solid rgba(var(--dw-primary-rgb), 0.1);
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(230, 83, 60, 0.08), rgba(37, 99, 235, 0.06));
}

.action-summary-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
}

.action-summary-top strong {
    display: block;
    font-size: 0.9rem;
    color: var(--dw-text);
}

.action-summary-top span,
.action-desc,
.action-meta,
.action-focus {
    font-size: 0.72rem;
    color: var(--dw-text-muted);
}

.action-completion {
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--dw-primary);
}

.action-progress {
    height: 7px;
    margin-top: 10px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.18);
}

.action-progress span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #2563eb, #26bf94);
}

.action-focus {
    margin-top: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.dw-action-item.is-clickable {
    cursor: pointer;
}

.action-title {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--dw-text);
}

.action-desc {
    margin-top: 1px;
}

.action-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 5px;
}

.action-button {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    min-height: 30px;
    padding: 0 10px;
    border: 1px solid rgba(var(--dw-primary-rgb), 0.18);
    border-radius: 8px;
    background: rgba(var(--dw-primary-rgb), 0.06);
    color: var(--dw-primary);
    font-size: 0.72rem;
    font-weight: 700;
    white-space: nowrap;
}

.action-button:hover {
    background: var(--dw-primary);
    color: #fff;
}

@media (max-width: 480px) {
    .dw-action-item {
        align-items: flex-start;
    }

    .action-button {
        padding: 0 8px;
    }
}
</style>
