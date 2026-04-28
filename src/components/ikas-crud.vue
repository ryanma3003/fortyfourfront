<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDynamicAssessmentStore } from '@/stores/dynamic-assessment';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { useIkasStore } from '@/stores/ikas';
import Pageheader from '@/shared/components/pageheader/pageheader.vue';
import RespondentForm from '@/views/assessment/RespondentForm.vue';
import AssessmentView from '@/views/assessment/AssessmentView.vue';

import { toast } from 'vue3-toastify';
import 'vue3-toastify/dist/index.css';

const router = useRouter();
const route = useRoute();
const assessmentStore = useDynamicAssessmentStore();
const stakeholdersStore = useStakeholdersStore();
const ikasStore = useIkasStore();

// Get current stakeholder slug and source from route query
const currentSlug = computed(() => String(route.query.slug || ''));
const currentSource = computed(() => String(route.query.source || ''));

// Step management: 1 = Respondent Form, 2 = Assessment
const currentStep = ref(1);
const submitting = ref(false);

const parseTargetNilai = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value || '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const deriveTargetLevel = (targetNilai: string | number | null | undefined): number => {
  const nilai = parseTargetNilai(targetNilai);
  if (nilai <= 0) return 0;
  if (nilai < 1.5) return 1;
  if (nilai < 2.5) return 2;
  if (nilai < 3.5) return 3;
  if (nilai < 4.5) return 4;
  return 5;
};

const loadCurrentStakeholderIkas = async () => {
  assessmentStore.initializeLocalData();
  await assessmentStore.fetchAssessmentStructure();
  await ikasStore.initialize();
  
  if (!stakeholdersStore.initialized) {
    await stakeholdersStore.initialize();
  }

  // Set current stakeholder context in assessment store
  if (currentSlug.value) {
    assessmentStore.setCurrentStakeholder(currentSlug.value);
    assessmentStore.resetStakeholderData(currentSlug.value);
    ikasStore.resetStakeholderData(currentSlug.value);
  }

  // Try fetching existing IKAS data from backend
  const stakeholder = currentStakeholder.value;
  if (stakeholder?.id) {
    const result = await ikasStore.fetchFromBackend(currentSlug.value, stakeholder.id);
    if (result.exists && result.respondentData) {
      console.log('[IKAS CRUD] Loaded existing IKAS data from backend');

      // Populate the respondent profile in the assessment store
      // so hasRespondentProfile returns true and we skip to Step 2
      assessmentStore.saveRespondentProfile({
        instansi: stakeholder.nama_perusahaan || '',
        sektor: stakeholder.sub_sektor || '',
        alamat: stakeholder.alamat || '',
        email: stakeholder.email || '',
        namaResponden: result.respondentData.responden,
        jabatanResponden: result.respondentData.jabatan,
        nomorTelepon: result.respondentData.telepon,
        tahunPengukuran: result.respondentData.tanggal ? new Date(result.respondentData.tanggal).getFullYear().toString() : new Date().getFullYear().toString(),
        targetLevel: deriveTargetLevel(result.respondentData.target_nilai),
        targetNilai: String(result.respondentData.target_nilai || ''),
        acuan: '',
        tanggalPengisian: result.respondentData.tanggal ? result.respondentData.tanggal.split('T')[0] : new Date().toISOString().split('T')[0],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      if (stakeholder.id) {
        await assessmentStore.hydrateAnswersFromBackend(currentSlug.value, stakeholder.id);
      }
      currentStep.value = 2;
      return;
    }
  }

  currentStep.value = 1;
};

// Initialize stores + try to fetch existing IKAS data from backend
onMounted(async () => {
  await loadCurrentStakeholderIkas();
});

watch(currentSlug, async (newSlug, oldSlug) => {
  if (!newSlug || newSlug === oldSlug) return;
  await loadCurrentStakeholderIkas();
});

// Get current stakeholder info
const currentStakeholder = computed(() => {
  if (currentSlug.value) {
    return stakeholdersStore.getStakeholderBySlug(currentSlug.value);
  }
  return null;
});

// Dynamic page data based on stakeholder and source
const pageData = computed(() => {
  return {
    title: { 
      label: currentStakeholder.value 
        ? `IKAS ${currentStakeholder.value.nama_perusahaan}` 
        : "IKAS Dashboard", 
      path: currentSlug.value ? `/stakeholders/${currentSlug.value}` : '/stakeholders'
    },
    currentpage: currentStep.value === 1 ? "Data Responden" : "Input Data",
    activepage: currentStep.value === 1 ? "Data Responden" : (assessmentStore.currentDomain?.name || 'Input Data'),
  };
});

// Navigation Handlers
const handleFormSubmit = async () => {
  const profile = assessmentStore.respondentProfile;
  const stakeholder = currentStakeholder.value;
  if (!profile) {
    toast.error('Data Form Responden tidak lengkap', { autoClose: 3000, position: 'top-right' });
    return;
  }

  if (!stakeholder?.id) {
    toast.error('Data stakeholder tidak ditemukan', { autoClose: 3000, position: 'top-right' });
    return;
  }

  if (!ikasStore.getBackendIkasId(currentSlug.value)) {
    submitting.value = true;
    try {
      const ensureResult = await ikasStore.ensureBackendIkasRecord(currentSlug.value, {
        id_perusahaan: stakeholder.id,
        responden: profile.namaResponden || '',
        jabatan: profile.jabatanResponden || '',
        telepon: profile.nomorTelepon || '',
        tanggal: profile.tanggalPengisian || new Date().toISOString().split('T')[0],
        target_nilai: parseTargetNilai(profile.targetNilai),
      });

      if (!ensureResult.success) {
        toast.error(`Gagal menyiapkan sesi IKAS: ${ensureResult.error || 'ikas_id tidak tersedia'}`, { autoClose: 3000, position: 'top-right' });
        return;
      }
    } finally {
      submitting.value = false;
    }
  }

  currentStep.value = 2;
};

// Save respondent data to backend without advancing to step 2
const handleSaveRespondent = async () => {
  const stakeholder = currentStakeholder.value;
  const profile = assessmentStore.respondentProfile;

  if (!stakeholder?.id || !profile) {
    toast.error('Data Form Responden tidak lengkap', { autoClose: 3000, position: 'top-right' });
    return;
  }

  submitting.value = true;
  try {
    const result = await ikasStore.submitToBackend(currentSlug.value, {
      id_perusahaan: stakeholder.id,
      responden: profile.namaResponden || '',
      jabatan: profile.jabatanResponden || '',
      telepon: profile.nomorTelepon || '',
      tanggal: profile.tanggalPengisian || new Date().toISOString().split('T')[0],
      target_nilai: parseTargetNilai(profile.targetNilai),
    });

    if (result.success) {
      toast.success('Data responden berhasil disimpan ke server', { autoClose: 2000, position: 'top-right' });
      // Domain seeding / summary endpoints are disabled on this backend.
      // Skipping `seedAssessmentStructure` to avoid calling unavailable endpoints.
    } else {
      toast.error(`Gagal menyimpan: ${result.error || 'Server tidak merespon'}`, { autoClose: 3000, position: 'top-right' });
    }
  } catch (error: any) {
    console.error('[IKAS CRUD] Error saving respondent data:', error);
    toast.error('Terjadi kesalahan saat menyimpan data responden', { autoClose: 3000, position: 'top-right' });
  } finally {
    submitting.value = false;
  }
};

const handleEditData = () => {
  currentStep.value = 1;
};

const backToIkas = () => {
  if (currentSlug.value) {
    router.push({ path: '/ikas', query: { slug: currentSlug.value } });
  } else {
    router.push('/stakeholders');
  }
};
</script>

<template>
  <Pageheader :propData="pageData" />

  <!-- Show warning if no stakeholder -->
  <div v-if="!currentSlug" class="row">
    <div class="col-12">
      <div class="alert alert-warning">
        <i class="ri-alert-line me-2"></i>
        Tidak ada stakeholder yang dipilih. Silakan kembali dan pilih stakeholder terlebih dahulu.
      </div>
    </div>
  </div>

  <!-- Two-Step Wizard -->
  <template v-else>
    <!-- Step Indicator -->
    <div class="row mb-2">
      <div class="col-12">
        <div class="card custom-card step-card">
          <div class="card-body py-4">
            <div class="d-flex align-items-center justify-content-center gap-3">
              <!-- Step 1 -->
              <div class="step-item" :class="{ active: currentStep === 1, completed: currentStep > 1 }">
                <div class="step-indicator">
                  <span v-if="currentStep > 1" class="fs-18">✓</span>
                  <span v-else class="fs-18">1</span>
                </div>
                <span class="step-label">Data Responden</span>
              </div>

              <!-- Divider -->
              <div class="step-divider" :class="{ active: currentStep > 1 }"></div>

              <!-- Step 2 -->
              <div class="step-item" :class="{ active: currentStep === 2 }">
                <div class="step-indicator">
                  <span class="fs-18">2</span>
                </div>
                <span class="step-label">Penilaian IKAS</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Step 1: Respondent Form -->
    <template v-if="currentStep === 1">
      <RespondentForm 
          :stakeholder="currentStakeholder"
          @submit="handleFormSubmit"
          @save="handleSaveRespondent"
          @cancel="backToIkas"
        />
    </template>

    <!-- Step 2: Assessment View -->
    <template v-else-if="currentStep === 2">
      <AssessmentView 
        :embedded="true"
        @edit="handleEditData"
        @back="backToIkas"
      />
    </template>
  </template>
</template>

<style scoped>
/* Step Card Styling */
.step-card {
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* Step Item Container */
.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transition: all 0.3s ease;
}

.step-item.active .step-indicator {
  border-color: #0d6efd;
  color: #0d6efd;
  box-shadow: 0 2px 8px rgba(13, 110, 253, 0.1);
}

.step-item.active .step-label {
  color: #0d6efd;
  font-weight: 600;
}

.step-item.completed .step-indicator {
  border-color: #198754;
  color: #198754;
}

.step-item.completed .step-label {
  color: #198754;
  font-weight: 600;
}

/* Step Indicator Badge */
.step-indicator {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: white;
  border: 2px solid #dee2e6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6c757d;
  font-weight: 700;
  font-size: 0.85rem;
  transition: all 0.3s ease;
}

/* Step Label */
.step-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #6c757d;
  white-space: nowrap;
  transition: all 0.3s ease;
}

/* Divider Line */
.step-divider {
  width: 40px;
  height: 2px;
  background: #dee2e6;
  transition: all 0.3s ease;
}

.step-divider.active {
  background: #198754;
  width: 50px;
}
</style>
