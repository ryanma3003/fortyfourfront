<script setup>
import { ref, computed } from "vue";

import * as salesData from "../../data/dashboards/salesdata";

import * as dummytotal from "../../data/dummytotal";  // ⬅️ PENTING
import SpkReusebleJobs from "../../shared/components/@spk/dashboards/jobs/dashboard/spk-reuseble-jobs.vue";
import TableComponent from "../../shared/components/@spk/table-reuseble/table-component.vue";
import * as radarData from '../../data/apexcharts/apexchart-radar.ts';
import RadarChartIkas from '../../shared/components/@spk/charts/ikas-charts.vue';
import { defineAsyncComponent } from 'vue';

const picked = ref(new Date());
const picked2 = ref(new Date());
const lowerpicked = new Date(picked2.value);
const date = ref();
const showMetabase = ref(false);

const toggleMetabase = () => {
    showMetabase.value = !showMetabase.value;
};

const currentDay = picked.value.getDate();
const ChartCards = defineAsyncComponent(() => import('../../shared/components/@spk/chart-cards.vue'));

const dataToPass = {
    title: "Charts",
    subtitle: "Apex Charts",
    currentpage: "Apex Radar Charts",
    activepage: "Apex Radar Charts"
}

const dateRange = computed(() => {
    if (!date.value || !Array.isArray(date.value) || date.value.length < 2) {
        return null;
    }
    return {
        start: date.value[0],
        end: date.value[1]
    };
});

const PerusahaanCard1Filtered = computed(() => {
    return dummytotal.generatePerusahaanCard(dateRange.value);
});

const PerusahaanCard2Filtered = computed(() => {
    return dummytotal.generatePerusahaanCard2(dateRange.value);
});

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

const picked1 = new Date(picked.value);
picked1.setDate(currentDay + 5);
lowerpicked.setDate(currentDay - 5);

const startDate = new Date();
const endDate = new Date(new Date().setDate(startDate.getDate() + 7));
date.value = [startDate, endDate];

</script>

<template>
    <!-- HEADER -->
    <div class="d-flex align-items-center justify-content-between mb-3 page-header-breadcrumb flex-wrap gap-2">
        <div>
            <h1 class="page-title fw-medium fs-20 mb-0">Dashboard</h1>
        </div>

        <div class="d-flex align-items-center flex-wrap">
            <div class="form-group">
                <Datepicker placeholder="Search By Date Range"
                    class="form-control breadcrumb-input border-0 bg-white custom-date-input"
                    autoApply v-model="date" range />
            </div>
            <div class="ms-2">
                <button v-if="!showMetabase" class="btn btn-primary d-flex align-items-center gap-2 shadow-sm" @click="toggleMetabase">
                    <i class="ri-refresh-line"></i>
                    <span>Dashboard Metabase</span>
                </button>
                <button v-if="showMetabase" class="btn btn-primary d-flex align-items-center gap-2 shadow-sm" @click="toggleMetabase">
                    <i class="ri-refresh-line"></i>
                    <span>Dashboard Utama</span>
                </button>
            </div>
        </div>
    </div>

    <div v-if="!showMetabase">
        <!-- ROW 1 - Card dengan 3 kolom -->
        <div class="row g-3">
            <div class="col-md-4" 
                v-for="(idx, index) in PerusahaanCard1Filtered" 
                :key="index">
                <SpkReusebleJobs
                    titleClass="fs-13 fw-medium mb-0"
                    :listCard="true"
                    :cardClass="`card ${idx.cardClass}`"
                    :list="idx"
                    :NoCountUp="true"
                />
            </div>
        </div>

        <!-- ROW 2 - Card dengan 2 kolom -->
        <div class="row g-3">
            <div class="col-md-4" 
                v-for="(idx, index) in PerusahaanCard2Filtered" 
                :key="index">
                <SpkReusebleJobs 
                    titleClass="fs-13 fw-medium mb-0" 
                    :listCard="true"
                    :cardClass="`card ${idx.cardClass}`" 
                    :list="idx" 
                    :NoCountUp="true" 
                />
            </div>
        </div>

    <!-- RADAR CHARTS -->
        <RadarChartIkas />
    </div>

    <!-- METABASE EMBED -->
    <div v-else class="row">
        <div class="col-12">
            <div class="card custom-card">
                <div class="card-body p-0">
                    <iframe
                        src="https://metabase.kssindustri.site/public/dashboard/cf811c85-dbdc-4aa2-a0dc-72d45c364ccb"
                        frameborder="0"
                        width="100%"
                        height="800"
                        allowtransparency
                    ></iframe>
                </div>
            </div>
        </div>
    </div>
</template>
