<script setup>
import { computed } from 'vue';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { useCsirtStore } from '@/stores/csirt';
import { useIkasStore } from '@/stores/ikas';
import { useDashboardFilterStore } from '@/stores/dashboardFilter';
import { useKseStore } from '@/stores/kse';

const stakeholdersStore = useStakeholdersStore();
const csirtStore = useCsirtStore();
const ikasStore = useIkasStore();
const filterStore = useDashboardFilterStore();
const kseStore = useKseStore();

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
    const results = [];

    if (all.length === 0) {
        results.push({
            type: 'warning',
            icon: 'ri-alert-line',
            color: '#f5b849',
            bg: 'rgba(245,184,73,0.1)',
            text: 'Tidak ada data stakeholder',
            detail: 'Silakan sesuaikan rentang tanggal atau filter sektor',
        });
        return results;
    }

    const totalSh = all.length;

    // 1. Total Stakeholder Terdaftar
    results.push({
        type: 'positive',
        icon: 'ri-building-4-line',
        color: '#1e40af',
        bg: 'rgba(30,64,175,0.1)',
        text: `Terdapat ${totalSh} Stakeholder Aktif`,
        detail: 'Berdasarkan filter aktif saat ini',
    });

    // 2. CSIRT Performance
    const withCsirt = all.filter(s => csirtStore.hasCompleteCsirt(s.id)).length;
    const csirtPct = totalSh > 0 ? Math.round((withCsirt / totalSh) * 100) : 0;
    
    if (csirtPct >= 50) {
        results.push({
            type: 'positive',
            icon: 'ri-shield-check-line',
            color: '#26bf94',
            bg: 'rgba(38,191,148,0.1)',
            text: `Kesiapan CSIRT Cukup Baik (${csirtPct}%)`,
            detail: `${withCsirt} instansi telah melengkapi profil CSIRT`,
        });
    } else {
        results.push({
            type: 'warning',
            icon: 'ri-shield-keyhole-line',
            color: '#f5b849',
            bg: 'rgba(245,184,73,0.1)',
            text: `Perlu Atensi Profil CSIRT`,
            detail: `Baru ${withCsirt} dari ${totalSh} instansi melengkapi CSIRT`,
        });
    }

    // 3. IKAS Participation
    const withIkas = all.filter(s => {
        const data = ikasStore.ikasDataMap[s.slug];
        return data && data.total_rata_rata && data.total_rata_rata !== 'NA' && data.total_rata_rata !== 0;
    });
    const ikasCount = withIkas.length;
    const ikasPct = totalSh > 0 ? Math.round((ikasCount / totalSh) * 100) : 0;
    
    if (ikasPct >= 50) {
        results.push({
            type: 'positive',
            icon: 'ri-bar-chart-box-line',
            color: '#26bf94',
            bg: 'rgba(38,191,148,0.1)',
            text: `Partisipasi IKAS Positif (${ikasPct}%)`,
            detail: `${ikasCount} instansi telah berpartisipasi dalam IKAS`,
        });
    } else {
        results.push({
            type: 'warning',
            icon: 'ri-pie-chart-line',
            color: '#f5b849',
            bg: 'rgba(245,184,73,0.1)',
            text: `Dorong Partisipasi IKAS`,
            detail: `Masih ada ${totalSh - ikasCount} instansi belum mengisi IKAS`,
        });
    }

    // 4. KSE Performance
    const withKse = all.filter(s => {
        const data = kseStore.kseDataMap[s.slug];
        return data && data.kategoriSE && data.kategoriSE !== 'Belum Dikategorikan';
    });
    const kseCount = withKse.length;
    const ksePct = totalSh > 0 ? Math.round((kseCount / totalSh) * 100) : 0;

    if (ksePct >= 50) {
        results.push({
            type: 'positive',
            icon: 'ri-file-shield-2-line',
            color: '#26bf94',
            bg: 'rgba(38,191,148,0.1)',
            text: `Kategori SE Cukup Baik (${ksePct}%)`,
            detail: `${kseCount} instansi telah menyelesaikan pendataan KSE`,
        });
    } else {
        results.push({
            type: 'warning',
            icon: 'ri-file-warning-line',
            color: '#f5b849',
            bg: 'rgba(245,184,73,0.1)',
            text: `Pengisian KSE`,
            detail: `Baru ${kseCount} dari ${totalSh} instansi yang mendata KSE`,
        });
    }

    return results.slice(0, 4);
});
</script>

<template>
    <div class="dw-card dw-fade-up">
        <div class="dw-card-header">
            <h6 class="dw-card-header-title">
                <div class="dw-card-header-icon" style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: #fff;">
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
