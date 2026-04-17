<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { useCsirtStore } from '@/stores/csirt';
import { useIkasStore } from '@/stores/ikas';
import { useDashboardFilterStore } from '@/stores/dashboardFilter';

const router = useRouter();
const stakeholdersStore = useStakeholdersStore();
const csirtStore = useCsirtStore();
const ikasStore = useIkasStore();
const filterStore = useDashboardFilterStore();

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

const actions = computed(() => {
    const all = stakeholdersStore.allStakeholders.filter(s => {
        const inDate = isInGlobalRange(s.created_at);
        const inSector = filterStore.sektorId ? s.sub_sektor?.id_sektor == filterStore.sektorId || s.id_sektor == filterStore.sektorId : true;
        return inDate && inSector;
    });
    const items = [];

    // Critical: stakeholders without CSIRT
    const noCsirt = all.filter(s => !csirtStore.hasCompleteCsirt(s.id));
    if (noCsirt.length > 0) {
        items.push({
            severity: 'critical',
            icon: 'ri-shield-line',
            color: '#e6533c',
            title: `${noCsirt.length} stakeholder belum isi CSIRT`,
            desc: 'Tim CSIRT belum terdaftar lengkap',
            action: 'Lihat Daftar',
            route: '/csirt-list',
        });
    }

    // Warning: stakeholders without IKAS
    const noIkas = all.filter(s => {
        const data = ikasStore.ikasDataMap[s.slug];
        return !data || !data.total_rata_rata || data.total_rata_rata === 'NA' || data.total_rata_rata === 0;
    });
    if (noIkas.length > 0) {
        items.push({
            severity: 'warning',
            icon: 'ri-file-chart-line',
            color: '#f5b849',
            title: `${noIkas.length} stakeholder belum memiliki IKAS`,
            desc: 'Data assessment keamanan informasi belum diisi',
            action: 'Lihat Stakeholder',
            route: '/stakeholders',
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
            icon: 'ri-team-line',
            color: '#f5b849',
            title: `${csirtsLowSdm.length} CSIRT dengan SDM < 2 orang`,
            desc: 'Tim terlalu kecil untuk operasional efektif',
            action: 'Lihat CSIRT',
            route: '/csirt-list',
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
            icon: 'ri-time-line',
            color: '#0ea5e9',
            title: `${stagnant.length} stakeholder tidak ada update > 30 hari`,
            desc: 'Potensi data kedaluwarsa yang perlu diverifikasi',
            action: 'Review Data',
            route: '/stakeholders',
        });
    }

    // All good
    if (items.length === 0) {
        items.push({
            severity: 'success',
            icon: 'ri-checkbox-circle-line',
            color: '#26bf94',
            title: 'Semua data dalam kondisi baik',
            desc: 'Tidak ada aksi yang dibutuhkan saat ini',
            action: null,
            route: null,
        });
    }

    return items;
});

function navigate(route) {
    if (route) router.push(route);
}
</script>

<template>
    <div class="dw-card dw-fade-up">
        <div class="dw-card-header">
            <h6 class="dw-card-header-title">
                <div class="dw-card-header-icon" style="background: linear-gradient(135deg, #e6533c, #f87171); color: #fff;">
                    <i class="ri-alarm-warning-line"></i>
                </div>
                <div>
                    <span>Butuh Perhatian</span>
                    <div class="dw-card-header-sub">Aksi yang harus segera dilakukan</div>
                </div>
            </h6>
            <span v-if="actions.length > 0 && actions[0].severity !== 'success'" class="dw-badge dw-badge-critical">
                {{ actions.length }} item
            </span>
            <span v-else class="dw-badge dw-badge-success">
                <i class="ri-check-line"></i> OK
            </span>
        </div>
        <div class="dw-card-body" style="padding: 12px 16px;">
            <div class="d-flex flex-column gap-2">
                <div v-for="(item, idx) in actions" :key="idx"
                     class="dw-action-item dw-fade-up"
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
                        <div style="font-size: 0.85rem; font-weight: 600; color: var(--dw-text);">{{ item.title }}</div>
                        <div style="font-size: 0.72rem; color: var(--dw-text-muted); margin-top: 1px;">{{ item.desc }}</div>
                    </div>
                    <button v-if="item.action" class="btn btn-sm btn-outline-primary" style="font-size:0.72rem; white-space:nowrap; border-radius:8px;" @click.stop="navigate(item.route)">
                        {{ item.action }} <i class="ri-arrow-right-s-line"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
