<script setup>
import { ref, computed, onMounted, defineAsyncComponent } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useIkasStore } from "@/stores/ikas";
import { useKseStore } from "@/stores/kse";
import { usersService } from "@/services/users.service";

import * as salesData from "../../data/dashboards/salesdata";
import * as dummytotal from "../../data/dummytotal";  // ⬅️ PENTING
import SpkReusebleJobs from "../../shared/components/@spk/dashboards/jobs/dashboard/spk-reuseble-jobs.vue";
import TableComponent from "../../shared/components/@spk/table-reuseble/table-component.vue";
import * as radarData from '../../data/apexcharts/apexchart-radar.ts';
import RadarChartIkas from '../../shared/components/@spk/charts/ikas-charts.vue';

const router = useRouter();
const authStore = useAuthStore();
const ikasStore = useIkasStore();
const kseStore = useKseStore();

// --- User Dashboard Logic ---
const isUser = computed(() => authStore.userRole === 'user');
const userSlug = ref('');
const ikasFilled = ref(false);
const kseFilled = ref(false);
const kseCategory = ref('');
const kseColor = ref('');

const navigateToIkas = () => {
    if (userSlug.value) {
        router.push(`/ikas-crud?slug=${userSlug.value}&source=dashboard`);
    } else {
        // Fallback or error handling
        console.error("User slug not found");
    }
};

onMounted(async () => {
    // If user is logged in as 'user' role, fetch their specific data
    if (isUser.value && authStore.currentUser?.id) {
        try {
            // Initialize stores
            ikasStore.initialize();
            kseStore.initialize();
            
            // fetch fresh user data to get slug
            const user = await usersService.getById(authStore.currentUser.id);
            if (user && user.slug) {
                userSlug.value = user.slug;
                
                // Check IKAS Progress
                const progress = ikasStore.getOverallProgress(user.slug);
                ikasFilled.value = progress.percent > 0;
                
                // Check KSE Status
                const kseData = kseStore.getKseData(user.slug);
                // Assume filled if category is set different from default
                if (kseData && kseData.kategoriSE && kseData.kategoriSE !== 'Belum Dikategorikan') {
                    kseFilled.value = true;
                    kseCategory.value = kseData.kategoriSE;
                    kseColor.value = kseData.kategoriColor;
                } else {
                    kseFilled.value = false;
                    kseCategory.value = "Belum Dikategorikan";
                    kseColor.value = "#6c757d";
                }
            }
        } catch (error) {
            console.error("Error loading user dashboard data:", error);
        }
    }
});
// ----------------------------

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
    <!-- USER DASHBOARD VIEW -->
    <div v-if="isUser">
        <!-- Header User -->
        <div class="d-flex align-items-center justify-content-between mb-3 page-header-breadcrumb">
             <div>
                <h1 class="page-title fw-medium fs-20 mb-0">Dashboard Data Keamanan</h1>
            </div>
        </div>

        <div class="row g-3">
            <!-- Left Column: Main Content (Chart or CTA) -->
            <div class="col-xxl-9 col-xl-8">
                 <!-- CASE 1: IKAS NOT FILLED -->
                 <div v-if="!ikasFilled" class="card custom-card">
                     <div class="card-body d-flex flex-column align-items-center justify-content-center text-center p-5">
                         <div class="mb-4">
                             <div class="avatar avatar-xxl bg-primary-transparent rounded-circle">
                                 <i class="ri-shield-keyhole-line fs-32 text-primary"></i>
                             </div>
                         </div>
                         <h3 class="fw-bold mb-2">Lengkapi Data IKAS</h3>
                         <p class="text-muted mb-4 fs-15" style="max-width: 500px">
                             Data Instrumen Penilaian Kematangan Keamanan Siber (IKAS) Anda belum lengkap. Silakan lengkapi penilaian mandiri untuk melihat tingkat kematangan keamanan siber perusahaan Anda.
                         </p>
                         <button @click="navigateToIkas" class="btn btn-primary btn-lg shadow-sm waves-effect waves-light">
                             <i class="ri-edit-circle-line me-2"></i> Isi Data IKAS
                         </button>
                         
                     </div>
                 </div>
                 
                 <!-- CASE 2: IKAS FILLED (Radar Charts) -->
                 <RadarChartIkas v-else :stakeholderSlug="userSlug" />
            </div>
            
            <!-- Right Column: Status Cards -->
            <div class="col-xxl-3 col-xl-4">
                <div class="card custom-card">
                    <div class="card-header">
                         <div class="card-title">Status Data</div>
                    </div>
                    <div class="card-body">
                         <!-- IKAS Status -->
                         <div class="d-flex align-items-center mb-4">
                             <div class="flex-shrink-0">
                                 <div class="avatar avatar-lg bg-light rounded-circle">
                                     <i class="ri-file-list-3-line fs-24 text-primary"></i>
                                 </div>
                             </div>
                             <div class="flex-grow-1 ms-3">
                                 <p class="mb-1 text-muted fs-12 text-uppercase fw-medium">Formulir IKAS</p>
                                 <div class="d-flex align-items-center">
                                     <span class="badge" :class="ikasFilled ? 'bg-success-transparent text-success' : 'bg-warning-transparent text-warning'">
                                         <i :class="ikasFilled ? 'ri-checkbox-circle-line' : 'ri-time-line'" class="me-1"></i>
                                         {{ ikasFilled ? 'Sudah Diisi' : 'Belum Diisi' }}
                                     </span>
                                 </div>
                             </div>
                         </div>
                         
                         <!-- SE Categorization Status -->
                         <div class="d-flex align-items-center">
                             <div class="flex-shrink-0">
                                 <div class="avatar avatar-lg bg-light rounded-circle">
                                      <i class="ri-building-line fs-24 text-info"></i>
                                 </div>
                             </div>
                             <div class="flex-grow-1 ms-3">
                                 <p class="mb-1 text-muted fs-12 text-uppercase fw-medium">Kategorisasi SE</p>
                                 <h5 class="fw-bold mb-0" :style="{ color: kseColor || 'inherit' }">
                                     {{ kseCategory || 'Belum Ada' }}
                                 </h5>
                                 <small class="text-muted" v-if="kseFilled">Terverifikasi</small>
                                 <small class="text-warning" v-else>Belum lengkap</small>
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- ADMIN DASHBOARD VIEW (Existing) -->
    <template v-else>
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
                            src="https://metabase.kssindustri.site/public/dashboard/6322d724-0de2-4a91-92d9-94ac85aa7f83"
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
</template>
