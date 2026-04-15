<script setup>
import { computed } from 'vue';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { useCsirtStore } from '@/stores/csirt';
import { useIkasStore } from '@/stores/ikas';
import { useDashboardFilterStore } from '@/stores/dashboardFilter';

const stakeholdersStore = useStakeholdersStore();
const csirtStore = useCsirtStore();
const ikasStore = useIkasStore();
const filterStore = useDashboardFilterStore();

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

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

function countInPeriod(items, dateField, daysBack, daysEnd = 0) {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() - daysEnd);
    end.setHours(23, 59, 59, 999);
    const start = new Date(now);
    start.setDate(start.getDate() - daysBack);
    start.setHours(0, 0, 0, 0);
    return items.filter(item => {
        const d = new Date(item[dateField] || item.created_at);
        return !isNaN(d.getTime()) && d >= start && d <= end;
    }).length;
}

function calcDelta(current, previous) {
    if (!previous) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
}

const insights = computed(() => {
    const all = stakeholdersStore.allStakeholders.filter(s => {
        const inDate = isInGlobalRange(s.created_at);
        const inSector = filterStore.sektorId ? s.sub_sektor?.id_sektor == filterStore.sektorId || s.id_sektor == filterStore.sektorId : true;
        return inDate && inSector;
    });
    const csirts = csirtStore.csirts;
    const results = [];

    // 1. Stakeholder growth this week vs last week
    const thisWeek = countInPeriod(all, 'created_at', 7, 0);
    const lastWeek = countInPeriod(all, 'created_at', 14, 7);
    const weekDelta = calcDelta(thisWeek, lastWeek);
    if (weekDelta > 0) {
        results.push({
            type: 'positive',
            icon: 'ri-arrow-up-line',
            color: '#26bf94',
            bg: 'rgba(38,191,148,0.1)',
            text: `Stakeholder naik ${weekDelta}% minggu ini`,
            detail: `${thisWeek} baru vs ${lastWeek} minggu lalu`,
        });
    } else if (weekDelta < 0) {
        results.push({
            type: 'negative',
            icon: 'ri-arrow-down-line',
            color: '#e6533c',
            bg: 'rgba(230,83,60,0.1)',
            text: `Stakeholder turun ${Math.abs(weekDelta)}% minggu ini`,
            detail: `${thisWeek} baru vs ${lastWeek} minggu lalu`,
        });
    }

    // 2. Sector with highest growth this month
    const thisMonth = countInPeriod(all, 'created_at', 30, 0);
    const lastMonth = countInPeriod(all, 'created_at', 60, 30);
    const monthDelta = calcDelta(thisMonth, lastMonth);
    if (monthDelta !== 0) {
        results.push({
            type: monthDelta > 0 ? 'positive' : 'negative',
            icon: monthDelta > 0 ? 'ri-line-chart-line' : 'ri-line-chart-fill',
            color: monthDelta > 0 ? '#26bf94' : '#e6533c',
            bg: monthDelta > 0 ? 'rgba(38,191,148,0.1)' : 'rgba(230,83,60,0.1)',
            text: `Pertumbuhan ${monthDelta > 0 ? '+' : ''}${monthDelta}% bulan ini`,
            detail: `${thisMonth} stakeholder vs ${lastMonth} bulan lalu`,
        });
    }

    // 3. CSIRT coverage
    const totalSh = all.length;
    const withCsirt = totalSh > 0 ? all.filter(s => csirtStore.hasCompleteCsirt(s.id)).length : 0;
    const csirtPct = totalSh > 0 ? Math.round((withCsirt / totalSh) * 100) : 0;
    if (csirtPct < 50) {
        results.push({
            type: 'warning',
            icon: 'ri-shield-line',
            color: '#f5b849',
            bg: 'rgba(245,184,73,0.1)',
            text: `Cakupan CSIRT masih ${csirtPct}%`,
            detail: `${withCsirt} dari ${totalSh} stakeholder memiliki CSIRT lengkap`,
        });
    }

    // 4. IKAS coverage
    const withIkas = all.filter(s => {
        const data = ikasStore.ikasDataMap[s.slug];
        return data && data.total_rata_rata && data.total_rata_rata !== 'NA' && data.total_rata_rata !== 0;
    }).length;
    const ikasPct = totalSh > 0 ? Math.round((withIkas / totalSh) * 100) : 0;
    if (ikasPct < 70) {
        results.push({
            type: 'warning',
            icon: 'ri-bar-chart-2-line',
            color: '#f5b849',
            bg: 'rgba(245,184,73,0.1)',
            text: `Data IKAS baru terisi ${ikasPct}%`,
            detail: `${withIkas} dari ${totalSh} stakeholder sudah mengisi IKAS`,
        });
    }

    // 5. Stakeholders with no activity > 30 days
    const stagnant = all.filter(s => {
        const d = new Date(s.updated_at || s.created_at);
        return !isNaN(d.getTime()) && (Date.now() - d.getTime()) > 30 * 86400000;
    }).length;
    if (stagnant > 0) {
        results.push({
            type: 'warning',
            icon: 'ri-time-line',
            color: '#f5b849',
            bg: 'rgba(245,184,73,0.1)',
            text: `${stagnant} stakeholder stagnan > 30 hari`,
            detail: 'Tidak ada pembaruan data dalam 30 hari terakhir',
        });
    }

    // 6. If everything is good
    if (results.length === 0) {
        results.push({
            type: 'positive',
            icon: 'ri-check-double-line',
            color: '#26bf94',
            bg: 'rgba(38,191,148,0.1)',
            text: 'Semua data dalam kondisi baik',
            detail: 'Tidak ada anomali yang terdeteksi',
        });
    }

    return results.slice(0, 5);
});
</script>

<template>
    <div class="dw-card dw-fade-up">
        <div class="dw-card-header">
            <h6 class="dw-card-header-title">
                <div class="dw-card-header-icon" style="background: linear-gradient(135deg, #845adf, #6366f1); color: #fff;">
                    <i class="ri-lightbulb-flash-line"></i>
                </div>
                <div>
                    <span>Insight Hari Ini</span>
                    <div class="dw-card-header-sub">Ringkasan otomatis dari data terkini</div>
                </div>
            </h6>
            <span class="dw-badge dw-badge-info">
                <i class="ri-sparkling-2-line"></i> AI
            </span>
        </div>
        <div class="dw-card-body" style="padding: 12px 16px;">
            <div class="d-flex flex-column gap-2">
                <div v-for="(insight, idx) in insights" :key="idx"
                     class="dw-insight-item dw-fade-up"
                     :style="{ animationDelay: `${idx * 80}ms` }">
                    <div class="dw-insight-icon"
                         :style="{ background: insight.bg, color: insight.color }">
                        <i :class="insight.icon"></i>
                    </div>
                    <div class="flex-grow-1" style="min-width: 0;">
                        <div style="font-size: 0.85rem; font-weight: 600; color: var(--dw-text);">
                            {{ insight.text }}
                        </div>
                        <div style="font-size: 0.72rem; color: var(--dw-text-muted); margin-top: 2px;">
                            {{ insight.detail }}
                        </div>
                    </div>
                    <div class="dw-delta" :class="{
                        'dw-delta-up': insight.type === 'positive',
                        'dw-delta-down': insight.type === 'negative',
                        'dw-delta-flat': insight.type === 'warning'
                    }">
                        <i :class="insight.type === 'positive' ? 'ri-arrow-up-s-fill' : insight.type === 'negative' ? 'ri-arrow-down-s-fill' : 'ri-alert-fill'"></i>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
