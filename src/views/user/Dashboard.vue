<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useIkasStore } from "@/stores/ikas";
import { useKseStore } from "@/stores/kse";
import { usersService } from "@/services/users.service";
import RadarChartIkas from '@/shared/components/@spk/charts/ikas-charts.vue';

const router = useRouter();
const authStore = useAuthStore();
const ikasStore = useIkasStore();
const kseStore = useKseStore();

const userSlug = ref('');
const ikasFilled = ref(false);
const kseFilled = ref(false);
const kseCategory = ref('');
const kseColor = ref('');

const navigateToIkas = () => {
    if (userSlug.value) {
        router.push(`/ikas-crud?slug=${userSlug.value}&source=dashboard`);
    } else {
        console.error("User slug not found");
    }
};

onMounted(async () => {
    if (authStore.currentUser?.id) {
        try {
            // Initialize stores
            ikasStore.initialize();
            kseStore.initialize();
            
            // Fetch fresh user data to get slug
            const user = await usersService.getById(authStore.currentUser.id);
            if (user && user.slug) {
                userSlug.value = user.slug;
                
                // Check IKAS Progress
                const progress = ikasStore.getOverallProgress(user.slug);
                ikasFilled.value = progress.percent > 0;
                
                // Check KSE Status
                const kseData = kseStore.getKseData(user.slug);
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
</script>

<template>
    <div>
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
</template>
