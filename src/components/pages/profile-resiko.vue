<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { useResikoStore } from '@/stores/resiko';
import { useAuthStore } from '@/stores/auth';
import Pageheader from '@/shared/components/pageheader/pageheader.vue';

const router = useRouter();
const currentRoute = useRoute();
const stakeholdersStore = useStakeholdersStore();
const resikoStore = useResikoStore();
const authStore = useAuthStore();

const currentSlug = computed(() => String(currentRoute.query.slug || ''));
const isAdmin = computed(() => authStore.isAdmin);

onMounted(async () => {
    if (!stakeholdersStore.initialized) {
        await stakeholdersStore.initialize();
    }
    resikoStore.initialize();
    if (currentSlug.value) {
        resikoStore.setCurrentStakeholder(currentSlug.value);
    }
    await loadSurveyResult();
});

watch(currentSlug, async (slug) => {
    if (!slug) return;
    resikoStore.setCurrentStakeholder(slug);
    await loadSurveyResult();
});

const currentStakeholder = computed(() => {
    if (currentSlug.value) {
        return stakeholdersStore.getStakeholderBySlug(currentSlug.value);
    }
    return null;
});

const loadSurveyResult = async () => {
    if (!currentStakeholder.value?.id || !currentSlug.value) return;
    await resikoStore.loadSurveyResult(currentStakeholder.value.id, currentSlug.value);
};

const dataToPass = computed(() => {
    const stakeholderName = currentStakeholder.value?.nama_perusahaan || 'Stakeholder';
    return {
        title: { label: `Profile ${stakeholderName}`, path: `/stakeholders/${currentSlug.value}` },
        currentpage: "Manajemen Resiko",
        activepage: "Profile Resiko",
    };
});

const labelOf = (row: any, keys: string[], fallback = '-') => {
    const found = keys.map(key => row?.[key]).find(value => value !== undefined && value !== null && value !== '');
    return found !== undefined && found !== null && found !== '' ? String(found) : fallback;
};

const normalizeRiskLevel = (value: any) => {
    const text = String(value || '').trim().toLowerCase();
    const score = Number(value);
    if (text.includes('sangat') || score >= 20 || score === 4) return 'Sangat Tinggi';
    if (text.includes('tinggi') || score >= 12 || score === 3) return 'Tinggi';
    if (text.includes('sedang') || score >= 6 || score === 2) return 'Sedang';
    if (text.includes('rendah') || score >= 1 || score === 1) return 'Rendah';
    return 'Belum Dinilai';
};

const normalizedRisks = computed(() => {
    return (resikoStore.currentSurveyResult?.risks || []).map((row: any, index: number) => {
        const level = normalizeRiskLevel(row.level || row.level_risiko || row.tingkat_risiko || row.nilai_risiko || row.risk_level);
        return {
            id: row.id || `${index}`,
            asset: labelOf(row, ['aset', 'asset', 'nama_aset', 'namaAset', 'objek'], '-'),
            risk: labelOf(row, ['risiko', 'risk', 'deskripsi_risiko', 'deskripsiRisiko', 'ancaman', 'reason'], '-'),
            impact: labelOf(row, ['dampak', 'impact', 'nilai_dampak', 'impact_level'], '-'),
            prob: labelOf(row, ['probabilitas', 'probability', 'kemungkinan', 'likelihood', 'nilai_kemungkinan'], '-'),
            level,
            status: labelOf(row, ['status', 'status_mitigasi', 'mitigasi_status'], 'Open'),
        };
    });
});

const riskLevels = computed(() => {
    const levels = ['Sangat Tinggi', 'Tinggi', 'Sedang', 'Rendah'];
    return levels.map(label => ({
        label,
        count: normalizedRisks.value.filter(r => r.level === label).length,
    }));
});

const mitigationSummary = computed(() => {
    const rows = resikoStore.currentSurveyResult?.risks || [];
    const groups = [
        { label: 'Kontrol Teknis', keys: ['teknis', 'technical'] },
        { label: 'Kebijakan & Prosedur', keys: ['kebijakan', 'prosedur', 'policy'] },
        { label: 'Audit Keamanan', keys: ['audit'] },
    ];

    return groups.map((group) => {
        const related = rows.filter((row: any) => {
            const text = JSON.stringify(row).toLowerCase();
            return group.keys.some(key => text.includes(key));
        });
        const done = related.filter((row: any) => String(row.status || row.status_mitigasi || '').toLowerCase().includes('selesai')).length;
        const percent = related.length ? Math.round((done / related.length) * 100) : 0;
        return { ...group, percent, labelPercent: related.length ? `${percent}% Complete` : 'Belum Ada Data' };
    });
});

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
                   {{ normalizedRisks.length > 0 || resikoStore.progressMap[currentSlug]?.status === 'COMPLETED' ? 'Lengkap' : 'Belum Lengkap' }}
                </div>
             </div>
             <button v-if="!isAdmin" @click="router.push({ path: '/survey-resiko', query: { slug: currentSlug } })" class="btn btn-save-primary rounded-pill shadow-sm">
                <i class="ri-edit-2-line me-1"></i> Update Survey
             </button>
             <span v-else class="btn btn-light rounded-pill shadow-sm disabled-view-badge">
                <i class="ri-eye-line me-1"></i> Mode Lihat Hasil
             </span>
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
                         <tr v-if="resikoStore.surveyResultLoading">
                            <td colspan="6" class="text-center text-muted py-4">Memuat hasil survey risiko...</td>
                         </tr>
                         <tr v-else-if="resikoStore.surveyResultError">
                            <td colspan="6" class="text-center text-danger py-4">{{ resikoStore.surveyResultError }}</td>
                         </tr>
                         <tr v-else-if="normalizedRisks.length === 0">
                            <td colspan="6" class="text-center text-muted py-4">Belum ada hasil survey risiko untuk perusahaan ini.</td>
                         </tr>
                         <tr v-for="r in normalizedRisks" :key="r.id" class="stakeholder-row">
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
                      <div v-for="(item, index) in mitigationSummary" :key="item.label" :class="{ 'mb-4': index < mitigationSummary.length - 1 }">
                         <div class="d-flex align-items-center justify-content-between mb-2">
                             <div class="fs-13 fw-semibold">{{ item.label }}</div>
                             <div class="fs-12 text-muted">{{ item.labelPercent }}</div>
                         </div>
                         <div class="kse-score-bar">
                            <div class="kse-score-fill" :class="index === 0 ? 'stat-icon-indigo' : index === 1 ? 'stat-icon-amber' : 'stat-icon-blue'" :style="{ width: `${item.percent}%` }"></div>
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

.disabled-view-badge {
  pointer-events: none;
  color: #0f3f62;
  font-weight: 700;
}
</style>
