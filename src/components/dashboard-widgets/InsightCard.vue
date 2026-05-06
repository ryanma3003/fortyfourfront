<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { useCsirtStore } from '@/stores/csirt';
import { useIkasStore } from '@/stores/ikas';
import { useDashboardFilterStore } from '@/stores/dashboardFilter';
import { useKseStore } from '@/stores/kse';
import { useKonversiStore } from '@/stores/konversi';
import { isKonversiComplete } from '@/services/konversi.service';
import { useNotificationStore } from '@/stores/notifications';

const stakeholdersStore = useStakeholdersStore();
const csirtStore = useCsirtStore();
const ikasStore = useIkasStore();
const filterStore = useDashboardFilterStore();
const kseStore = useKseStore();
const konversiStore = useKonversiStore();
const notifStore = useNotificationStore();
const emit = defineEmits(['drill-down']);
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

function handleInsightClick(insight) {
    let type = insight.label;
    if (insight.key === 'csirt') type = 'Cakupan CSIRT';
    else if (insight.key === 'ikas') type = 'Cakupan IKAS';
    else if (insight.key === 'kse') type = 'Sistem Elektronik';
    else if (insight.key === 'fresh') type = 'Update Terakhir';
    else if (insight.key === 'complete') type = 'Data Lengkap';
    emit('drill-down', { type });
}

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

function timeAgo(dateVal) {
    if (!dateVal) return 'Belum ada update';
    let then = new Date(dateVal).getTime();
    if (isNaN(then)) return 'Belum ada update';
    let now = Date.now();
    let diff = now - then;
    if (diff < -60000 && typeof dateVal === 'string') {
        const localThen = new Date(dateVal.replace('Z', '')).getTime();
        if (!isNaN(localThen)) {
            const localDiff = now - localThen;
            if (localDiff >= 0 && localDiff < 24 * 60 * 60 * 1000) {
                then = localThen;
                diff = localDiff;
            }
        }
    } else if (diff < 0) {
        diff = Math.abs(diff); 
    }
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins} menit lalu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} jam lalu`;
    const days = Math.floor(hrs / 24);
    return `${days} hari lalu`;
}

const insights = computed(() => {
    if (props.loading) return [];

    const all = stakeholdersStore.allStakeholders.filter(s => {
        const inDate = isInGlobalRange(s.created_at);
        const inSector = filterStore.sektorId ? s.sub_sektor?.id_sektor == filterStore.sektorId || s.id_sektor == filterStore.sektorId : true;
        return inDate && inSector;
    });
    if (all.length === 0) return [];

    const totalSh = all.length;
    const withCsirt = all.filter(s => !!csirtStore.csirtByPerusahaanMap[String(s.id)]).length;
    const csirtPct = totalSh > 0 ? Math.round((withCsirt / totalSh) * 100) : 0;

    const withIkas = all.filter(s => {
        const data = ikasStore.ikasDataMap[s.slug];
        return data && data.total_rata_rata && data.total_rata_rata !== 'NA' && data.total_rata_rata !== 0;
    });
    const ikasCount = withIkas.length;
    const ikasPct = totalSh > 0 ? Math.round((ikasCount / totalSh) * 100) : 0;

    const kseCount = all.filter(stakeholderHasKse).length;
    const ksePct = totalSh > 0 ? Math.round((kseCount / totalSh) * 100) : 0;

    let maxTime = 0;
    all.forEach(s => {
        const check = (item) => {
            if (item && (item.updated_at || item.created_at)) {
                const t = new Date(item.updated_at || item.created_at).getTime();
                if (!isNaN(t) && t > maxTime) maxTime = t;
            }
        };
        check(s);
        check(csirtStore.csirtByPerusahaanMap[String(s.id)]);
        check(ikasStore.ikasDataMap[s.slug]);
    });
    
    const formatEventLabel = (evt) => {
        const verbMap = { 'created': 'menambahkan', 'updated': 'memperbarui', 'deleted': 'menghapus' };
        const entityMap = { 'stakeholder': 'Stakeholder', 'csirt': 'CSIRT', 'sdm_csirt': 'SDM CSIRT', 'se_csirt': 'Sistem Elektronik', 'ikas': 'IKAS', 'user': 'Pengguna' };
        const verb = verbMap[evt.type] || 'Update';
        const entityLabel = entityMap[evt.entity] || evt.entity;
        const userName = evt.user?.name || 'Sistem';
        return `${userName} ${verb} Data ${entityLabel}`;
    };

    let latestEvent = null;
    const isUnfiltered = all.length === stakeholdersStore.allStakeholders.length;
    if (notifStore.events && notifStore.events.length > 0) {
        if (isUnfiltered) {
            latestEvent = notifStore.events[0];
        } else {
            const fIds = new Set(all.map(s => String(s.id)));
            const fSlugs = new Set(all.map(s => s.slug));
            latestEvent = notifStore.events.find(e => {
                const eid = String(e.entity_id);
                return fIds.has(eid) || fSlugs.has(eid);
            });
            if (!latestEvent) latestEvent = notifStore.events[0];
        }
    }

    let latestUpdateLabel = 'Data Dashboard';
    let finalTimeVal = maxTime;
    if (latestEvent) {
        const eventTime = new Date(latestEvent.timestamp || latestEvent.created_at).getTime();
        if (eventTime >= (maxTime - 300000)) { 
            latestUpdateLabel = formatEventLabel(latestEvent);
            if (eventTime > maxTime) finalTimeVal = latestEvent.timestamp || latestEvent.created_at;
        } else if (maxTime === 0) {
            finalTimeVal = latestEvent.timestamp || latestEvent.created_at;
            latestUpdateLabel = formatEventLabel(latestEvent);
        } else {
            latestUpdateLabel = 'Data Stakeholder / CSIRT / IKAS';
        }
    }

    const lastUpdateStr = finalTimeVal ? timeAgo(finalTimeVal) : 'Belum ada update';

    const complete = all.filter(s => isKonversiComplete(konversiStore.getByPerusahaanId(s.id))).length;
    const completePct = totalSh > 0 ? Math.round((complete / totalSh) * 100) : 0;

    const metrics = [
        {
            key: 'csirt',
            label: 'Cakupan CSIRT',
            value: withCsirt,
            total: totalSh,
            pct: csirtPct,
            missing: totalSh - withCsirt,
            icon: 'ri-shield-check-line',
            color: '#2563eb',
            action: 'lengkapi profil CSIRT',
        },
        {
            key: 'ikas',
            label: 'Cakupan IKAS',
            value: ikasCount,
            total: totalSh,
            pct: ikasPct,
            missing: totalSh - ikasCount,
            icon: 'ri-bar-chart-box-line',
            color: '#0f9f7a',
            action: 'kejar pengisian IKAS',
        },
        {
            key: 'kse',
            label: 'Sistem Elektronik',
            value: kseCount,
            total: totalSh,
            pct: ksePct,
            missing: totalSh - kseCount,
            icon: 'ri-file-shield-2-line',
            color: '#7c3aed',
            action: 'validasi kategori SE',
        },
        {
            key: 'fresh',
            label: 'Update Terakhir',
            value: lastUpdateStr,
            sub: latestUpdateLabel,
            isTime: true,
            icon: 'ri-history-line',
            color: '#ea580c',
        },
        {
            key: 'complete',
            label: 'Data Lengkap',
            value: complete,
            total: totalSh,
            pct: completePct,
            missing: totalSh - complete,
            icon: 'ri-checkbox-circle-line',
            color: '#f5b849',
            action: 'lengkapi data',
        },
    ];

    const measurable = metrics.filter(m => !m.isTime);
    measurable.sort((a, b) => a.pct - b.pct);
    const timeMetric = metrics.find(m => m.isTime);
    return [...measurable, timeMetric];
});

const healthSummary = computed(() => {
    if (props.loading || insights.value.length === 0) {
        return {
            score: 0,
            label: 'Belum ada data',
            tone: 'warning',
            message: 'Sesuaikan filter atau tambah stakeholder untuk melihat kondisi dashboard.',
            primaryGap: null,
        };
    }

    const measurableInsights = insights.value.filter(i => !i.isTime);
    const count = measurableInsights.length;
    const score = count > 0 ? Math.round(measurableInsights.reduce((sum, item) => sum + item.pct, 0) / count) : 0;
    const primaryGap = count > 0 ? measurableInsights[0] : null;
    const tone = score >= 80 ? 'positive' : score >= 55 ? 'warning' : 'negative';
    const label = score >= 80 ? 'Operasional stabil' : score >= 55 ? 'Perlu tindak lanjut' : 'Prioritas tinggi';

    return {
        score,
        label,
        tone,
        message: primaryGap.missing > 0
            ? `${primaryGap.missing} stakeholder perlu ${primaryGap.action}.`
            : 'Semua indikator utama sudah terpenuhi pada filter aktif.',
        primaryGap,
    };
});
</script>

<template>
    <div class="dw-card dw-fade-up insight-dashboard-card" :class="{ 'is-dark': isDarkMode }">
        <div class="dw-card-header">
            <h6 class="dw-card-header-title">
                <div class="dw-card-header-icon" style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: #fff;">
                    <i class="ri-lightbulb-flash-line"></i>
                </div>
                <div>
                    <span>Insight Operasional</span>
                    <div class="dw-card-header-sub">Health check data pada filter aktif</div>
                </div>
            </h6>
            <span class="dw-badge" :class="{
                'dw-badge-success': healthSummary.tone === 'positive',
                'dw-badge-warning': healthSummary.tone === 'warning',
                'dw-badge-critical': healthSummary.tone === 'negative'
            }">
                {{ healthSummary.score }}%
            </span>
        </div>
        <div class="dw-card-body insight-card-body">
            <div v-if="loading" class="d-flex flex-column gap-2 placeholder-glow">
                <div class="insight-summary-panel">
                    <span class="placeholder" style="width:62px;height:34px;border-radius:10px;"></span>
                    <div class="flex-grow-1">
                        <span class="placeholder col-6 d-block mb-2" style="height:12px;border-radius:6px;"></span>
                        <span class="placeholder col-10 d-block" style="height:10px;border-radius:6px;"></span>
                    </div>
                </div>
                <div v-for="n in 4" :key="'insight-skeleton-' + n" class="dw-insight-item">
                    <span class="placeholder" style="width:36px;height:36px;border-radius:10px;"></span>
                    <div class="flex-grow-1">
                        <span class="placeholder col-9 d-block mb-2" style="height:12px;border-radius:6px;"></span>
                        <span class="placeholder col-7 d-block" style="height:10px;border-radius:6px;"></span>
                    </div>
                    <span class="placeholder" style="width:26px;height:22px;border-radius:8px;"></span>
                </div>
            </div>
            <div v-else-if="insights.length === 0" class="insight-empty">
                <i class="ri-database-2-line"></i>
                <strong>Data tidak ditemukan</strong>
                <span>Tidak ada stakeholder yang cocok dengan filter dashboard saat ini.</span>
            </div>
            <div v-else class="d-flex flex-column gap-2">
                <div class="insight-summary-panel" :class="'is-' + healthSummary.tone">
                    <div class="insight-score">
                        <strong>{{ healthSummary.score }}%</strong>
                        <span>skor data</span>
                    </div>
                    <div class="insight-summary-copy">
                        <div class="insight-summary-title">{{ healthSummary.label }}</div>
                        <div class="insight-summary-text">{{ healthSummary.message }}</div>
                    </div>
                </div>
                <div v-for="(insight, idx) in insights" :key="idx"
                     class="dw-insight-item dw-fade-up insight-clickable"
                     :style="{ animationDelay: `${idx * 80}ms` }"
                     @click="handleInsightClick(insight)">
                    <div class="dw-insight-icon"
                         :style="{ background: `${insight.color}18`, color: insight.color }">
                        <i :class="insight.icon"></i>
                    </div>
                    <div class="insight-metric-main">
                        <div class="insight-metric-row">
                            <span>{{ insight.label }}</span>
                            <strong v-if="insight.isTime">{{ insight.value }}</strong>
                            <strong v-else>{{ insight.value }}/{{ insight.total }}</strong>
                        </div>
                        <div v-if="!insight.isTime" class="insight-progress" :aria-label="`${insight.label} ${insight.pct}%`">
                            <span :style="{ width: `${insight.pct}%`, background: insight.color }"></span>
                        </div>
                        <small v-if="!insight.isTime">{{ insight.missing }} belum selesai</small>
                        <small v-else class="text-muted">{{ insight.sub }}</small>
                    </div>
                    <div v-if="!insight.isTime" class="insight-percent" :style="{ color: insight.color }">{{ insight.pct }}%</div>
                    <div v-else class="insight-percent" :style="{ color: insight.color, fontSize: '1.2rem' }"><i :class="insight.icon"></i></div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.insight-card-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 12px 16px;
}

.insight-dashboard-card.is-dark {
    color-scheme: dark;
    background: #151a2b;
    border-color: rgba(148, 163, 184, 0.22);
    box-shadow:
        0 16px 38px rgba(0, 0, 0, 0.26),
        inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.insight-dashboard-card.is-dark .dw-card-header {
    border-bottom-color: rgba(148, 163, 184, 0.16);
    background: linear-gradient(180deg, rgba(23, 30, 48, 0.98), rgba(21, 26, 43, 0.96));
}

.insight-dashboard-card.is-dark .dw-card-header-title,
.insight-dashboard-card.is-dark .insight-score strong,
.insight-dashboard-card.is-dark .insight-summary-title,
.insight-dashboard-card.is-dark .insight-metric-row {
    color: #eef4ff;
}

.insight-dashboard-card.is-dark .dw-card-header-sub,
.insight-dashboard-card.is-dark .insight-score span,
.insight-dashboard-card.is-dark .insight-summary-text,
.insight-dashboard-card.is-dark .insight-metric-main small,
.insight-dashboard-card.is-dark .insight-empty span {
    color: #94a3b8;
}

.insight-dashboard-card.is-dark .dw-card-header-icon {
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.insight-dashboard-card.is-dark .dw-card-body {
    background:
        radial-gradient(circle at 12% 0%, rgba(37, 99, 235, 0.12), transparent 34%),
        linear-gradient(180deg, #151a2b 0%, #111827 100%);
}

.insight-dashboard-card.is-dark .insight-summary-panel {
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(17, 24, 39, 0.95));
    border-color: rgba(148, 163, 184, 0.18);
}

.insight-dashboard-card.is-dark .insight-summary-panel.is-warning {
    background: linear-gradient(135deg, rgba(124, 92, 21, 0.26), rgba(30, 41, 59, 0.92));
}

.insight-dashboard-card.is-dark .insight-summary-panel.is-negative {
    background: linear-gradient(135deg, rgba(127, 29, 29, 0.22), rgba(30, 41, 59, 0.92));
}

.insight-dashboard-card.is-dark .dw-insight-item {
    background: rgba(15, 23, 42, 0.78);
    border-color: rgba(148, 163, 184, 0.16);
}

.insight-dashboard-card.is-dark .dw-insight-item:hover {
    background: rgba(37, 99, 235, 0.12);
    border-color: rgba(96, 165, 250, 0.3);
}

.insight-dashboard-card.is-dark .insight-percent {
    color: #bfdbfe !important;
}

.insight-dashboard-card.is-dark .insight-progress {
    background: rgba(148, 163, 184, 0.18);
}

.insight-dashboard-card.is-dark .insight-empty i {
    color: #94a3b8;
    opacity: 0.8;
}

.insight-clickable {
    cursor: pointer;
    transition: transform 0.2s ease, background-color 0.2s ease;
    border-radius: 12px;
}
.insight-clickable:hover {
    transform: translateY(-2px);
    background-color: rgba(var(--dw-primary-rgb), 0.03);
}

.insight-dashboard-card {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.insight-summary-panel {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 14px;
    border: 1px solid rgba(var(--dw-primary-rgb), 0.1);
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(20, 184, 166, 0.07));
}

.insight-summary-panel.is-warning {
    background: linear-gradient(135deg, rgba(245, 184, 73, 0.12), rgba(37, 99, 235, 0.06));
}

.insight-summary-panel.is-negative {
    background: linear-gradient(135deg, rgba(230, 83, 60, 0.12), rgba(245, 184, 73, 0.08));
}

.insight-score {
    min-width: 66px;
    text-align: center;
}

.insight-score strong {
    display: block;
    font-size: 1.3rem;
    line-height: 1;
    color: var(--dw-text);
}

.insight-score span,
.insight-summary-text,
.insight-metric-main small,
.insight-empty span {
    font-size: 0.72rem;
    color: var(--dw-text-muted);
}

.insight-summary-copy {
    min-width: 0;
}

.insight-summary-title {
    font-size: 0.86rem;
    font-weight: 700;
    color: var(--dw-text);
}

.insight-summary-text {
    margin-top: 2px;
}

.insight-metric-main {
    flex: 1;
    min-width: 0;
}

.insight-metric-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--dw-text);
}

.insight-progress {
    height: 6px;
    margin: 7px 0 4px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.18);
}

.insight-progress span {
    display: block;
    height: 100%;
    border-radius: inherit;
}

.insight-percent {
    width: 42px;
    text-align: right;
    font-size: 0.86rem;
    font-weight: 800;
}

.insight-empty {
    display: flex;
    min-height: 210px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    text-align: center;
}

.insight-empty i {
    font-size: 2rem;
    color: var(--dw-text-muted);
    opacity: 0.65;
}
</style>
