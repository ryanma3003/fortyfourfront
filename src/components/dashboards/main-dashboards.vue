<script setup>
import { ref, computed } from "vue";

// HAPUS INI JIKA TIDAK DIPAKAI LAGI
import * as salesData from "../../data/dashboards/salesdata";

import * as dummytotal from "../../data/dummytotal";  // ⬅️ PENTING
import SpkReusebleJobs from "../../shared/components/@spk/dashboards/jobs/dashboard/spk-reuseble-jobs.vue";
import TableComponent from "../../shared/components/@spk/table-reuseble/table-component.vue";
import * as radarData from '../../data/apexcharts/apexchart-radar.ts';
import { defineAsyncComponent } from 'vue';

const picked = ref(new Date());
const picked2 = ref(new Date());
const lowerpicked = new Date(picked2.value);
const date = ref();

const currentDay = picked.value.getDate();
const ChartCards = defineAsyncComponent(() => import('../../shared/components/@spk/chart-cards.vue'));

const dataToPass = {
    title: "Charts",
    subtitle: "Apex Charts",
    currentpage: "Apex Radar Charts",
    activepage: "Apex Radar Charts"
}

// ✅ COMPUTED: Hitung date range dari input Datepicker
const dateRange = computed(() => {
    if (!date.value || !Array.isArray(date.value) || date.value.length < 2) {
        return null;
    }
    return {
        start: date.value[0],
        end: date.value[1]
    };
});

// ✅ COMPUTED: Generate cards berdasarkan date range
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

            <div class="btn-list custom-button-list">
                <button class="btn btn-icon btn-primary btn-wave">
                    <i class="ri-refresh-line"></i>
                </button>
                <button class="btn btn-icon btn-primary btn-wave me-0">
                    <i class="ri-filter-3-line"></i>
                </button>
            </div>
        </div>
    </div>

    <!-- ROW 1 -->
    <div class="row">
        <div class="row">
            <div class='col-md-4' 
                 v-for='(idx, index) in PerusahaanCard1Filtered' 
                 :key='index'>

                <SpkReusebleJobs
                    titleClass="fs-13 fw-medium mb-0"
                    :listCard="true"
                    :cardClass="`card ${idx.cardClass}`"
                    :list="idx"
                    :NoCountUp="true"
                />
            </div>
            <div class="row">
                <div class='col-md-6' v-for='(idx, index) in PerusahaanCard2Filtered' :key='index'>
                    <SpkReusebleJobs titleClass="fs-13 fw-medium mb-0" :listCard="true"
                    :cardClass="`card ${idx.cardClass}`" :list="idx" :NoCountUp="true" />
                </div>
            </div>
        </div>
    </div>

    <!-- RADAR CHARTS -->
    <div class="row">
        <div class="col-xl-6" v-for="card in ApexRadarChart" :key="card.id">
            <ChartCards :card="card" :title="card.title" />
        </div>
    </div>
</template>
