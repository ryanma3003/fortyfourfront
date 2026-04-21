<script setup>
import { computed } from 'vue';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { useCsirtStore } from '@/stores/csirt';
import { useIkasStore } from '@/stores/ikas';
import { useNotificationStore } from '@/stores/notifications';
import { useDashboardFilterStore } from '@/stores/dashboardFilter';

const stakeholdersStore = useStakeholdersStore();
const csirtStore = useCsirtStore();
const ikasStore = useIkasStore();
const notifStore = useNotificationStore();
const filterStore = useDashboardFilterStore();

const emit = defineEmits(['drill-down']);

// Helper to filter dates globally
function isInDateRange(createdAt, rangeStrArray) {
    if (!rangeStrArray || !rangeStrArray[0] || !rangeStrArray[1] || !createdAt) return true;
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return false;
    const start = new Date(rangeStrArray[0]);
    start.setHours(0, 0, 0, 0);
    const end = new Date(rangeStrArray[1]);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
}

function countInPeriod(items, daysBack, daysEnd = 0) {
    const now = new Date();
    const end = new Date(now); end.setDate(end.getDate() - daysEnd); end.setHours(23,59,59,999);
    const start = new Date(now); start.setDate(start.getDate() - daysBack); start.setHours(0,0,0,0);
    return items.filter(item => {
        const d = new Date(item.created_at);
        return !isNaN(d.getTime()) && d >= start && d <= end;
    }).length;
}

function calcDelta(cur, prev) {
    if (!prev) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
}

// Last update time
function timeAgo(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins} menit lalu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} jam lalu`;
    const days = Math.floor(hrs / 24);
    return `${days} hari lalu`;
}

const kpis = computed(() => {
    // Filter base array by global date filter and sector filter
    const all = stakeholdersStore.allStakeholders.filter(s => {
        const inDate = isInDateRange(s.created_at, filterStore.dateRange);
        
        const subId = filterStore.subSektorId;
        const fId = filterStore.sektorId;
        const effectiveSubId = subId === 'ALL' ? '' : subId;
        
        let inSector = true;
        if (effectiveSubId) {
            inSector = String(s.sub_sektor?.id || s.id_sub_sektor) === String(effectiveSubId);
        } else if (fId) {
            inSector = String(s.sub_sektor?.id_sektor || s.id_sektor) === String(fId);
        }
        return inDate && inSector;
    });
    const csirts = csirtStore.csirts; // if needed, also filter this
    const totalSh = all.length;

    // Growth rate
    const thisMonth = countInPeriod(all, 30, 0);
    const lastMonth = countInPeriod(all, 60, 30);
    const growthRate = calcDelta(thisMonth, lastMonth);

    // CSIRT coverage
    const withCsirt = all.filter(s => csirtStore.hasCompleteCsirt(s.id)).length;
    const csirtPct = totalSh > 0 ? Math.round((withCsirt / totalSh) * 100) : 0;

    // IKAS coverage
    const withIkas = all.filter(s => {
        const data = ikasStore.ikasDataMap[s.slug];
        return data && data.total_rata_rata && data.total_rata_rata !== 'NA' && data.total_rata_rata !== 0;
    }).length;
    const ikasPct = totalSh > 0 ? Math.round((withIkas / totalSh) * 100) : 0;

    // IKAS average score
    let totalScore = 0, scoreCount = 0;
    all.forEach(s => {
        const data = ikasStore.ikasDataMap[s.slug];
        if (data && data.total_rata_rata && data.total_rata_rata !== 'NA' && data.total_rata_rata !== 0) {
            totalScore += Number(data.total_rata_rata);
            scoreCount++;
        }
    });
    const avgIkas = scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : '0';

    // Data completeness (has CSIRT + IKAS)
    const complete = all.filter(s => {
        const hasC = csirtStore.hasCompleteCsirt(s.id);
        const data = ikasStore.ikasDataMap[s.slug];
        const hasI = data && data.total_rata_rata && data.total_rata_rata !== 'NA' && data.total_rata_rata !== 0;
        return hasC && hasI;
    }).length;
    const completePct = totalSh > 0 ? Math.round((complete / totalSh) * 100) : 0;

    // Last update
    const sorted = [...all].sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
    const lastUpdate = sorted[0] ? (sorted[0].updated_at || sorted[0].created_at) : null;

    return [
        {
            label: 'Cakupan CSIRT',
            value: `${csirtPct}%`,
            icon: 'ri-shield-check-line',
            color: '#e6533c',
            bg: 'rgba(230,83,60,0.1)',
            delta: null,
            sub: `${withCsirt} / ${totalSh}`,
            ring: csirtPct,
        },
        {
            label: 'Cakupan IKAS',
            value: `${ikasPct}%`,
            icon: 'ri-bar-chart-grouped-line',
            color: '#26bf94',
            bg: 'rgba(38,191,148,0.1)',
            delta: null,
            sub: `${withIkas} / ${totalSh}`,
            ring: ikasPct,
        },
        {
            label: 'Skor IKAS Rata-rata',
            value: avgIkas,
            icon: 'ri-award-line',
            color: '#0ea5e9',
            bg: 'rgba(14,165,233,0.1)',
            delta: null,
            sub: `dari ${scoreCount} stakeholder`,
            ring: null,
        },
        {
            label: 'Data Lengkap',
            value: `${completePct}%`,
            icon: 'ri-checkbox-circle-line',
            color: '#f5b849',
            bg: 'rgba(245,184,73,0.1)',
            delta: null,
            sub: `${complete} / ${totalSh} stakeholder`,
            ring: completePct,
        },
        {
            label: 'Update Terakhir',
            value: timeAgo(lastUpdate),
            icon: 'ri-time-line',
            color: '#6366f1',
            bg: 'rgba(99,102,241,0.1)',
            delta: null,
            sub: 'Data stakeholder',
            ring: null,
        },
    ];
});
</script>

<template>
    <div class="row g-3">
        <div v-for="(kpi, idx) in kpis" :key="kpi.label"
             class="col-xl col-lg-4 col-md-4 col-sm-6 dw-fade-up"
             :style="{ animationDelay: `${idx * 60}ms` }">
            <div class="dw-card dw-kpi-card-wrap" @click="$emit('drill-down', { type: kpi.label })">
                <div class="dw-card-body" style="padding: 16px;">
                    <!-- Header -->
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="dw-insight-icon" :style="{ background: kpi.bg, color: kpi.color }" style="width:38px;height:38px;">
                            <i :class="kpi.icon"></i>
                        </div>
                        <!-- Progress Ring -->
                        <div v-if="kpi.ring !== null" class="dw-progress-ring">
                            <svg width="40" height="40" viewBox="0 0 40 40">
                                <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="3" />
                                <circle cx="20" cy="20" r="16" fill="none" :stroke="kpi.color" stroke-width="3"
                                        stroke-linecap="round"
                                        :stroke-dasharray="`${kpi.ring * 1.005} ${100.5 - kpi.ring * 1.005}`"
                                        style="transition: stroke-dasharray 1s ease;" />
                            </svg>
                            <span class="dw-progress-ring-label" style="font-size:0.6rem;">{{ kpi.ring }}%</span>
                        </div>
                        <!-- Delta badge -->
                        <div v-else-if="kpi.delta !== null" class="dw-delta" :class="{
                            'dw-delta-up': kpi.delta > 0,
                            'dw-delta-down': kpi.delta < 0,
                            'dw-delta-flat': kpi.delta === 0,
                        }">
                            <i :class="kpi.delta > 0 ? 'ri-arrow-up-s-fill' : kpi.delta < 0 ? 'ri-arrow-down-s-fill' : 'ri-subtract-fill'"></i>
                            {{ Math.abs(kpi.delta) }}%
                        </div>
                    </div>
                    <!-- Value -->
                    <div class="dw-kpi-value" :style="{ fontSize: '1.5rem' }">{{ kpi.value }}</div>
                    <div class="dw-kpi-label">{{ kpi.label }}</div>
                    <div style="font-size:0.68rem; color:var(--dw-text-muted); margin-top:4px;">{{ kpi.sub }}</div>
                    <!-- Bottom accent -->
                    <div class="position-absolute bottom-0 start-0 w-100" style="height:3px;" :style="{ background: kpi.color }"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.dw-kpi-card-wrap {
    cursor: pointer;
    position: relative;
}
.dw-kpi-card-wrap:hover {
    transform: translateY(-4px);
}
</style>
