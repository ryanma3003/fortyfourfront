<script setup>
import { ref, computed } from "vue";

import * as dummytotal from "../../../../data/dummytotal";
import * as radarData from '../../../../data/apexcharts/apexchart-radar.ts';
import { defineAsyncComponent } from 'vue';
import { useIkasStore } from '../../../../stores/ikas';

const ChartCards = defineAsyncComponent(() => import('../../../../shared/components/@spk/chart-cards.vue'));

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
    <div class="row">
        <div class="col-xl-6" v-for="card in ApexRadarChart" :key="card.id">
            <ChartCards :card="card" :title="card.title" cardHeaderClass="gradient-header-ikas" />
        </div>
    </div>
</template>

<style scoped>
:deep(.gradient-header-ikas) {
  background: radial-gradient(ellipse at top, #032a5c, #084696) !important;
  color: white !important;
}

:deep(.gradient-header-ikas .card-title) {
  color: white !important;
}
</style>
