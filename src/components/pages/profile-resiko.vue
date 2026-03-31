<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { useResikoStore } from '@/stores/resiko';
import Pageheader from '@/shared/components/pageheader/pageheader.vue';

const router = useRouter();
const currentRoute = useRoute();
const stakeholdersStore = useStakeholdersStore();
const resikoStore = useResikoStore();

const currentSlug = computed(() => String(currentRoute.query.slug || ''));

onMounted(async () => {
    if (!stakeholdersStore.initialized) {
        await stakeholdersStore.initialize();
    }
    resikoStore.initialize();
});

const currentStakeholder = computed(() => {
    if (currentSlug.value) {
        return stakeholdersStore.getStakeholderBySlug(currentSlug.value);
    }
    return null;
});

const resikoScore = computed(() => {
    return resikoStore.completionPercentage || 0;
});

const dataToPass = computed(() => {
    const stakeholderName = currentStakeholder.value?.nama_perusahaan || 'Stakeholder';
    return {
        title: { label: `Profile ${stakeholderName}`, path: `/stakeholders/${currentSlug.value}` },
        currentpage: "Manajemen Resiko",
        activepage: "Profile Resiko",
    };
});

// Mock Risk Data for visualization
const riskLevels = [
    { label: 'Sangat Tinggi', color: '#f59e0b', count: 1 }, // Amber
    { label: 'Tinggi', color: '#fbbf24', count: 2 },
    { label: 'Sedang', color: '#6366f1', count: 4 }, // Indigo
    { label: 'Rendah', color: '#818cf8', count: 8 },
];

const riskRegister = [
    { id: 1, asset: 'Data Nasabah', risk: 'Kebocoran Data', impact: 'Sangat Tinggi', prob: 'Sedang', level: 'Tinggi', status: 'Mitigated' },
    { id: 2, asset: 'Sistem Core Banking', risk: 'Downtime', impact: 'Tinggi', prob: 'Rendah', level: 'Sedang', status: 'Open' },
    { id: 3, asset: 'Aplikasi Mobile', risk: 'Unauthorized Access', impact: 'Tinggi', prob: 'Tinggi', level: 'Sangat Tinggi', status: 'In Progress' },
];

</script>

<template>
  <Pageheader :propData="dataToPass" />

  <div class="row">
    <div class="col-12">
      <div class="card custom-card gradient-header-card">
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3 stakeholder-header">
          <div class="d-flex align-items-center gap-3 header-inner">
             <div class="header-icon-box">
                <i class="ri-shield-check-fill"></i>
             </div>
             <div>
                <h4 class="mb-0 text-white fw-bold header-card-title">Survey Manajemen Resiko</h4>
                <div class="header-subtitle mt-1">{{ currentStakeholder?.nama_perusahaan }}</div>
             </div>
          </div>
          <div class="d-flex align-items-center gap-3 header-inner">
             <div class="text-end text-white border-end pe-3 border-white-10 me-1">
                <div class="fs-11 text-uppercase fw-semibold opacity-75 mb-1">Status Survey</div>
                <div class="fw-bold fs-16">
                   {{ resikoStore.progressMap[currentSlug]?.status === 'COMPLETED' ? 'Lengkap' : 'Belum Lengkap' }}
                </div>
             </div>
             <button @click="router.push({ path: '/survey-resiko', query: { slug: currentSlug } })" class="btn btn-save-primary rounded-pill shadow-sm">
                <i class="ri-edit-2-line me-1"></i> Update Survey
             </button>
          </div>
        </div>
        
        <div class="card-body p-4">
          <!-- Stats Strip -->
          <div class="stats-strip mb-4">
            <div v-for="(level, index) in riskLevels" :key="level.label" class="stat-card">
              <div class="stat-icon" :class="[
                index === 0 ? 'stat-icon-amber' : 
                index === 1 ? 'stat-icon-amber' : 
                index === 2 ? 'stat-icon-indigo' : 'stat-icon-blue'
              ]">
                <i class="ri-alert-line"></i>
              </div>
              <div>
                <div class="stat-value">{{ level.count }}</div>
                <div class="stat-label">{{ level.label }}</div>
              </div>
            </div>
          </div>

          <!-- Risk Details -->
          <div class="row g-4">
             <div class="col-xl-8">
                <div class="stakeholder-table-wrap">
                   <table class="table stakeholder-table table-hover mb-0 text-nowrap">
                      <thead class="stakeholder-thead">
                         <tr>
                            <th class="th-name">Aset</th>
                            <th class="">Deskripsi Resiko</th>
                            <th class="text-center">Impact</th>
                            <th class="text-center">Prob</th>
                            <th class="text-center">Level</th>
                            <th class="th-status">Status</th>
                         </tr>
                      </thead>
                      <tbody>
                         <tr v-for="r in riskRegister" :key="r.id" class="stakeholder-row">
                            <td class="fw-bold text-primary">{{ r.asset }}</td>
                            <td class="text-muted">{{ r.risk }}</td>
                            <td class="text-center">
                              <span class="badge" :class="r.impact === 'Sangat Tinggi' ? 'badge-sektor-red' : 'badge-sektor-amber'">{{ r.impact }}</span>
                            </td>
                            <td class="text-center">
                               <span class="badge" :class="r.prob === 'Tinggi' ? 'badge-sektor-orange' : 'badge-sektor-teal'">{{ r.prob }}</span>
                            </td>
                            <td class="text-center">
                               <div class="fw-bold" :class="r.level === 'Sangat Tinggi' ? 'text-danger' : 'text-warning'">{{ r.level }}</div>
                            </td>
                            <td>
                               <span class="status-badge" :class="r.status === 'Mitigated' ? 'badge-done' : 'badge-pending'">
                                 <span class="badge-icon-dot"><i :class="r.status === 'Mitigated' ? 'ri-check-line' : 'ri-time-line'"></i></span>
                                 <span class="badge-label">{{ r.status }}</span>
                               </span>
                            </td>
                         </tr>
                      </tbody>
                   </table>
                </div>
             </div>
             
             <div class="col-xl-4">
                <div class="card shadow-none border h-100" style="border-radius: 12px; border-color: #dae4f0 !important;">
                    <div class="card-header bg-light-transparent" style="border-bottom: 1px solid #dae4f0;">
                      <div class="card-title fs-14 fw-bold">Mitigasi & Kontrol</div>
                   </div>
                   <div class="card-body">
                      <div class="mb-4">
                         <div class="d-flex align-items-center justify-content-between mb-2">
                             <div class="fs-13 fw-semibold">Kontrol Teknis</div>
                             <div class="fs-12 text-muted">75% Complete</div>
                         </div>
                         <div class="kse-score-bar">
                            <div class="kse-score-fill stat-icon-indigo" style="width: 75%"></div>
                         </div>
                      </div>
                      <div class="mb-4">
                         <div class="d-flex align-items-center justify-content-between mb-2">
                             <div class="fs-13 fw-semibold">Kebijakan & Prosedur</div>
                             <div class="fs-12 text-muted">90% Complete</div>
                         </div>
                         <div class="kse-score-bar">
                            <div class="kse-score-fill stat-icon-amber" style="width: 90%"></div>
                         </div>
                      </div>
                      <div>
                         <div class="d-flex align-items-center justify-content-between mb-2">
                             <div class="fs-13 fw-semibold">Audit Keamanan</div>
                             <div class="fs-12 text-muted">40% Early Stage</div>
                         </div>
                         <div class="kse-score-bar">
                            <div class="kse-score-fill stat-icon-blue" style="width: 40%"></div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.risk-unified-card {
  border: none;
  overflow: hidden;
  border-radius: 12px;
  background: white;
}

.border-white-10 {
    border-color: rgba(255,255,255,0.1) !important;
}

.bg-light-transparent {
  background: rgba(248, 250, 252, 0.8);
}
</style>
