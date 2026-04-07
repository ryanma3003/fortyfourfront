<script setup>
import { ref, computed } from "vue";

import * as radarData from '../../../../data/apexcharts/apexchart-radar.ts';
import { useIkasStore } from '../../../../stores/ikas';

const props = defineProps({
    stakeholderSlug: {
        type: String,
        default: null
    }
})
const store = useIkasStore();
store.initialize();

// Helper to convert null values to 0 for chart display
const toChartValue = (val) => {
    if (val === null || typeof val !== 'number') return 0;
    return val;
};

const calculatedSeries = computed(() => {
    if (props.stakeholderSlug) {
        const data = store.getIkasData(props.stakeholderSlug);
        return [
            {
                name: "Target Nilai Kematangan",
                data: Array(19).fill(2.51)
            },
            {
                name: "Nilai Kematangan",
                data: [
                    toChartValue(data.total_rata_rata),
                    toChartValue(data.identifikasi.nilai_subdomain1),
                    toChartValue(data.identifikasi.nilai_subdomain2),
                    toChartValue(data.identifikasi.nilai_subdomain3),
                    toChartValue(data.identifikasi.nilai_subdomain4),
                    toChartValue(data.identifikasi.nilai_subdomain5),
                    toChartValue(data.proteksi.nilai_subdomain1),
                    toChartValue(data.proteksi.nilai_subdomain2),
                    toChartValue(data.proteksi.nilai_subdomain3),
                    toChartValue(data.proteksi.nilai_subdomain4),
                    toChartValue(data.proteksi.nilai_subdomain5),
                    toChartValue(data.proteksi.nilai_subdomain6),
                    toChartValue(data.deteksi.nilai_subdomain1),
                    toChartValue(data.deteksi.nilai_subdomain2),
                    toChartValue(data.deteksi.nilai_subdomain3),
                    toChartValue(data.tanggulih.nilai_subdomain1),
                    toChartValue(data.tanggulih.nilai_subdomain2),
                    toChartValue(data.tanggulih.nilai_subdomain3),
                    toChartValue(data.tanggulih.nilai_subdomain4)
                ]
            }
        ];
    }
    const allData = Object.values(store.ikasDataMap);
    const count = allData.length;
    
    if (count === 0) {
        return radarData.Multiseries2; // Return default if no data
    }

    // Initialize sums array of size 19 (1 Total + 18 Subdomains)
    const sums = new Array(19).fill(0);

    allData.forEach(data => {
        // Index 0: Total
        sums[0] += data.total_rata_rata || 0;

        // Index 1-5: Identifikasi (5 subdomains)
        sums[1] += data.identifikasi.nilai_subdomain1 || 0;
        sums[2] += data.identifikasi.nilai_subdomain2 || 0;
        sums[3] += data.identifikasi.nilai_subdomain3 || 0;
        sums[4] += data.identifikasi.nilai_subdomain4 || 0;
        sums[5] += data.identifikasi.nilai_subdomain5 || 0;

        // Index 6-11: Proteksi (6 subdomains)
        sums[6] += data.proteksi.nilai_subdomain1 || 0;
        sums[7] += data.proteksi.nilai_subdomain2 || 0;
        sums[8] += data.proteksi.nilai_subdomain3 || 0;
        sums[9] += data.proteksi.nilai_subdomain4 || 0;
        sums[10] += data.proteksi.nilai_subdomain5 || 0;
        sums[11] += data.proteksi.nilai_subdomain6 || 0;

        // Index 12-14: Deteksi (3 subdomains)
        sums[12] += data.deteksi.nilai_subdomain1 || 0;
        sums[13] += data.deteksi.nilai_subdomain2 || 0;
        sums[14] += data.deteksi.nilai_subdomain3 || 0;

        // Index 15-18: Tanggulih (4 subdomains)
        sums[15] += data.tanggulih.nilai_subdomain1 || 0;
        sums[16] += data.tanggulih.nilai_subdomain2 || 0;
        sums[17] += data.tanggulih.nilai_subdomain3 || 0;
        sums[18] += data.tanggulih.nilai_subdomain4 || 0;
    });

    const averages = sums.map(sum => Number((sum / count).toFixed(2)));

    return [
        {
            name: "Target Nilai Kematangan",
            data: Array(19).fill(2.51)
        },
        {
            name: "Nilai Kematangan",
            data: averages
        }
    ];
});



const calculatedSeriesDomain = computed(() => {
    // Jika ada slug, ambil data stakeholder tersebut saja
    if (props.stakeholderSlug) {
        const data = store.getIkasData(props.stakeholderSlug);
        return [
            {
                name: "Target Nilai Kematangan",
                data: Array(4).fill(2.51)
            },
            {
                name: "Nilai Kematangan",
                data: [
                    toChartValue(data.identifikasi.nilai_identifikasi),
                    toChartValue(data.proteksi.nilai_proteksi),
                    toChartValue(data.deteksi.nilai_deteksi),
                    toChartValue(data.tanggulih.nilai_tanggulih)
                ]
            }
        ];
    }

    const allData = Object.values(store.ikasDataMap);
    const count = allData.length;
    
    if (count === 0) {
        return radarData.Multiseries; // Return default
    }

    const sums = [0, 0, 0, 0]; // Identifikasi, Proteksi, Deteksi, Tanggulih

    allData.forEach(data => {
        sums[0] += data.identifikasi.nilai_identifikasi || 0;
        sums[1] += data.proteksi.nilai_proteksi || 0;
        sums[2] += data.deteksi.nilai_deteksi || 0;
        sums[3] += data.tanggulih.nilai_tanggulih || 0;
    });

    const averages = sums.map(sum => Number((sum / count).toFixed(2)));

    return [
        {
            name: "Target Nilai Kematangan",
            data: Array(4).fill(2.51)
        },
        {
            name: "Nilai Kematangan",
            data: averages
        }
    ];
});

const ApexRadarChart = computed(() => [
    {
        id: 1,
        title: "Perkategori",
        type: "radar",
        height: "500",
        width: "500",
        chart: {
            options: radarData.Multioptions2,
            series: calculatedSeries.value
        },
    },
    {
        id: 2,
        title: "Perdomain",
        type: "radar",
        height: "500",
        width: "500",
        chart: {
            options: radarData.Multioptions,
            series: calculatedSeriesDomain.value
        },
    }
]);

</script>

<template>
    <div class="ikas-charts-container mt-4">
        <div class="row g-4">
            <div class="col-xl-6" v-for="card in ApexRadarChart" :key="card.id">
            <div class="radar-chart-card">
                <!-- Chart card header -->
                <div class="radar-chart-header">
                    <div class="radar-chart-header-inner">
                        <div class="radar-chart-icon-wrap">
                            <i :class="card.id === 1 ? 'ri-bar-chart-grouped-line' : 'ri-donut-chart-line'"></i>
                        </div>
                        <div>
                            <div class="radar-chart-title">{{ card.title }}</div>
                            <div class="radar-chart-sub">
                                {{ card.id === 1 ? 'Radar per sub-domain keamanan siber' : 'Radar per domain utama (4 domain)' }}
                            </div>
                        </div>
                    </div>
                    
                </div>
                <!-- Chart body -->
                <div class="radar-chart-body">
                    <apexchart
                        :height="card.height"
                        :type="card.type"
                        :options="card.chart.options"
                        :series="card.chart.series"
                    />
                </div>
            </div>
        </div>
        </div>
    </div>
</template>

<style scoped>
/* ── Radar chart card wrapper ──────────────────────────── */
.radar-chart-card {
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 12px 50px rgba(99,51,228,0.14), 0 4px 16px rgba(37,99,235,0.1), 0 1px 4px rgba(0,0,0,0.06);
    margin-bottom: 1.5rem;
    background: #fff;
    border: none;
}

/* ── Header ─────────────────────────────────────────────── */
.radar-chart-header {
    background: linear-gradient(135deg, #0c1e6b 0%, #1130a0 25%, #1a3fc8 50%, #2563eb 75%, #3b82f6 100%);
    padding: 0.75rem 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    position: relative;
    overflow: hidden;
}
.radar-chart-header::after {
    content: '';
    position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.5) 30%, rgba(96,165,250,0.8) 60%, rgba(167,243,208,0.4) 100%);
}
.radar-chart-header-inner  { display: flex; align-items: center; gap: 12px; }
.radar-chart-icon-wrap {
    width: 42px; height: 48px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.radar-chart-icon-wrap i   { font-size: 1.6rem; color: #fff; }
.radar-chart-title         { font-size: 1rem; font-weight: 800; color: #fff; line-height: 1.2; }
.radar-chart-sub           { font-size: 11.5px; color: rgba(255,255,255,0.6); margin-top: 2px; }

/* ── Legend ─────────────────────────────────────────────── */
.radar-chart-legend     { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
.radar-legend-item      { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: rgba(255,255,255,0.8); font-weight: 600; }
.radar-legend-dot       { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

/* ── Body ────────────────────────────────────────────────── */
.radar-chart-body {
    padding: 1rem 0.5rem;
    background: #fff;
}
</style>
