<script setup>
import { computed } from 'vue';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { useCsirtStore } from '@/stores/csirt';
import { useNotificationStore } from '@/stores/notifications';

const stakeholdersStore = useStakeholdersStore();
const csirtStore = useCsirtStore();

const props = defineProps({
    summaryError: { type: Boolean, default: false },
});

const alerts = computed(() => {
    const items = [];
    const all = stakeholdersStore.allStakeholders;

    // Error state
    if (props.summaryError) {
        items.push({
            type: 'danger',
            icon: 'ri-error-warning-line',
            text: 'Gagal memuat data dari API Dashboard',
        });
    }

    // Check incomplete data
    const noCsirt = all.filter(s => !csirtStore.hasCompleteCsirt(s.id)).length;
    const totalSh = all.length;
    if (noCsirt > 0 && totalSh > 0) {
        const pct = Math.round((noCsirt / totalSh) * 100);
        if (pct > 50) {
            items.push({
                type: 'warning',
                icon: 'ri-shield-line',
                text: `${pct}% stakeholder belum memiliki CSIRT lengkap`,
            });
        }
    }

    return items;
});

const overallStatus = computed(() => {
    if (alerts.value.some(a => a.type === 'danger')) return 'danger';
    if (alerts.value.some(a => a.type === 'warning')) return 'warning';
    return 'success';
});
</script>

<template>
    <!-- Overall status bar -->
    <div v-if="overallStatus === 'success'" class="dw-alert-bar dw-alert-bar-success">
        <i class="ri-checkbox-circle-line fs-18"></i>
        <span>Semua sistem berjalan normal</span>
        <div class="dw-live-dot ms-auto"></div>
    </div>

    <div v-else>
        <div v-for="(alert, idx) in alerts" :key="idx"
             class="dw-alert-bar"
             :class="`dw-alert-bar-${alert.type}`"
             :style="{ animationDelay: `${idx * 100}ms` }">
            <i :class="alert.icon" class="fs-18"></i>
            <span>{{ alert.text }}</span>
        </div>
    </div>
</template>
