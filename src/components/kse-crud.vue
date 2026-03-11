<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useKseStore } from '@/stores/kse';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { csirtService } from '@/services/csirt.service';
import Pageheader from '@/shared/components/pageheader/pageheader.vue';
import RespondentFormKse from '@/views/assessment/RespondentFormKse.vue';
import KseView from '@/components/kse.vue';

const router = useRouter();
const route  = useRoute();
const kseStore          = useKseStore();
const stakeholdersStore = useStakeholdersStore();

// ── Query params ──────────────────────────────────────────────
const seId               = computed(() => String(route.query.seId || ''));
const currentSlug        = computed(() => String(route.query.slug || ''));
const currentSource      = computed(() => String(route.query.source || ''));
const stakeholderSlug    = computed(() => String(route.query.stakeholder || currentSlug.value));
const viewMode           = computed(() => route.query.mode === 'view');

const effectiveSlug = computed(() => {
  if (currentSlug.value) return currentSlug.value;
  if (!seId.value) return '';

  // Reverse lookup: check if we have a local respondent with this seId
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('kse_respondent_')) {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        if (String(data.seId) === String(seId.value)) {
          return key.replace('kse_respondent_', '');
        }
      }
    }
  } catch (e) {
    console.warn('Failed to parse local storage for seId lookup', e);
  }

  // Fallback to purely synthetic API slug
  return `${stakeholderSlug.value}_kse_se_${seId.value}`;
});

// ── Step: 1 = Data Responden, 2 = Penilaian KSE ─────────────
const currentStep = ref(1);
const seDataLoaded = ref(false);

// ── Init ──────────────────────────────────────────────────────
onMounted(async () => {
  // Determine starting step IMMEDIATELY (before any async work)
  // so Vue never renders the wrong step
  const isFromCsirt = currentSource.value === 'csirt';
  if (viewMode.value) {
    currentStep.value = 2;
  } else if (seId.value) {
    currentStep.value = 2; // Always step 2 if editing an SE
  } else if (!seId.value && !isFromCsirt) {
    const profileKey = `kse_respondent_${effectiveSlug.value}`;
    if (localStorage.getItem(profileKey)) {
      currentStep.value = 2;
    }
  }
  // else: isFromCsirt → show step 1 first

  kseStore.initialize();
  if (!stakeholdersStore.initialized) {
    await stakeholdersStore.initialize();
  }

  // If we have an seId, fetch SE data from API and pre-fill localStorage for sub-components
  if (seId.value) {
    try {
      const se = await csirtService.getSeById(seId.value);
      if (se) {
        // Find stakeholder from store for company info
        const stakeholder = stakeholdersStore.getStakeholderBySlug(stakeholderSlug.value);

        // Pre-fill respondent profile from API data
        const profileKey = `kse_respondent_${effectiveSlug.value}`;
        localStorage.setItem(profileKey, JSON.stringify({
          namaPerusahaan  : stakeholder?.nama_perusahaan || '',
          jenisUsaha      : stakeholder?.sub_sektor?.nama_sub_sektor || stakeholder?.sektor || '',
          namaSistem      : se.nama_se || '',
          alamat          : stakeholder?.alamat || '',
          email           : stakeholder?.email || '',
          nomorTelepon    : stakeholder?.telepon || '',
          tanggalPengisian: new Date().toISOString().split('T')[0],
          ip_se           : se.ip_se || '',
          as_number_se    : se.as_number_se || '',
          pengelola_se    : se.pengelola_se || '',
          fitur_se        : se.fitur_se || '',
          fromCsirt       : currentSource.value === 'csirt',
          seId            : se.id,
          id_csirt        : se.id_csirt || '',
          id_perusahaan   : se.id_perusahaan || stakeholder?.id || '',
          id_sub_sektor   : se.id_sub_sektor || stakeholder?.sub_sektor?.id || '',
        }));

        // Also load penilaian answers from API into KSE store
        kseStore.updateStakeholderInfo(
          effectiveSlug.value,
          se.nama_se || '',
          stakeholder?.sub_sektor?.nama_sub_sektor || ''
        );
        kseStore.loadAnswersFromApi(effectiveSlug.value, se);

        seDataLoaded.value = true;
      }
    } catch (e) {
      console.warn('Failed to load SE data from API:', e);
    }
  }
});

// ── Stakeholder info ──────────────────────────────────────────
const currentStakeholder = computed(() => {
  if (stakeholderSlug.value) {
    return stakeholdersStore.getStakeholderBySlug(stakeholderSlug.value);
  }
  return null;
});

// ── Page header ───────────────────────────────────────────────
const pageData = computed(() => ({
  title: {
    label: currentStakeholder.value
      ? `KSE ${currentStakeholder.value.nama_perusahaan}`
      : 'KSE',
    path: stakeholderSlug.value
      ? `/stakeholders/${stakeholderSlug.value}`
      : '/stakeholders',
  },
  currentpage : currentStep.value === 1 ? 'Data Responden' : 'Input Data',
  activepage  : currentStep.value === 1 ? 'Data Responden' : 'Penilaian KSE',
}));

// ── Navigation handlers ───────────────────────────────────────
const handleFormSubmit = () => {
  currentStep.value = 2;
};

const handleEditData = () => {
  if (currentSource.value === 'csirt') {
    currentStep.value = 1; // CSIRT flow: go back to respondent info
  } else {
    // KSE List flow: stay on step 2, the store is already unlocked by kse.vue
    currentStep.value = 2; 
  }
};

const backToKse = () => {
  if (currentSource.value === 'csirt') {
    // Came from CSIRT dashboard → go back
    router.back();
  } else if (stakeholderSlug.value) {
    router.push({ path: '/kse', query: { slug: stakeholderSlug.value } });
  } else {
    router.push('/stakeholders');
  }
};
</script>

<template>
  <Pageheader :propData="pageData" />

  <!-- No slug warning -->
  <div v-if="!effectiveSlug && !seId" class="row">
    <div class="col-12">
      <div class="alert alert-warning">
        <i class="ri-alert-line me-2"></i>
        Tidak ada stakeholder yang dipilih. Silakan kembali dan pilih stakeholder terlebih dahulu.
      </div>
    </div>
  </div>

  <template v-else>
    <!-- ── Step Indicator (hanya tampil jika bukan view mode) ── -->
    <div v-if="!viewMode" class="row mb-2">
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
                <span class="step-label">Penilaian KSE</span>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Step 1: Respondent Form ── -->
    <template v-if="currentStep === 1">
      <RespondentFormKse
        :slug="effectiveSlug"
        :stakeholder-slug="stakeholderSlug"
        :se-id="seId"
        @submit="handleFormSubmit"
        @cancel="backToKse"
      />
    </template>

    <!-- ── Step 2: KSE Assessment ── -->
    <template v-else-if="currentStep === 2">
      <KseView
        :embedded="true"
        :slug="effectiveSlug"
        :se-id="seId"
        @back="backToKse"
        @edit="handleEditData"
      />
    </template>
  </template>
</template>

<style scoped>
.step-card {
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

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

.step-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #6c757d;
  white-space: nowrap;
  transition: all 0.3s ease;
}

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
