<script setup>
import { ref, computed } from "vue";

import * as dummytotal from "../../../../data/dummytotal";
import * as radarData from '../../../../data/apexcharts/apexchart-radar.ts';
import { defineAsyncComponent } from 'vue';

const ChartCards = defineAsyncComponent(() => import('../../../../shared/components/@spk/chart-cards.vue'));

const ApexRadarChart = [
    {
        id: 1,
        title: "Perkategori",
        type: "radar",
        height: "500",
        width: "500",
        chart: {
            options: radarData.Multioptions2,
            series: radarData.Multiseries2
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
            series: radarData.Multiseries
        },
    }
];

</script>

<template>
    <div class="row">
        <div class="col-xl-6" v-for="card in ApexRadarChart" :key="card.id">
            <ChartCards :card="card" :title="card.title" />
        </div>
    </div>
</template>
