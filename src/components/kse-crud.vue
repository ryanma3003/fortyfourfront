<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useKseStore } from '@/stores/kse';
import { useStakeholdersStore } from '@/stores/stakeholders';
import Pageheader from '@/shared/components/pageheader/pageheader.vue';
import RespondentFormKse from '@/views/assessment/RespondentFormKse.vue';
import KseView from '@/components/kse.vue';

const router = useRouter();
const route  = useRoute();
const kseStore          = useKseStore();
const stakeholdersStore = useStakeholdersStore();

// ── Query params ──────────────────────────────────────────────
const currentSlug        = computed(() => String(route.query.slug        || ''));
const currentSource      = computed(() => String(route.query.source      || ''));
const stakeholderSlug    = computed(() => String(route.query.stakeholder || currentSlug.value));
const viewMode           = computed(() => route.query.mode === 'view');

// ── Step: 1 = Data Responden, 2 = Penilaian KSE ─────────────
const currentStep = ref(1);

// ── Init ──────────────────────────────────────────────────────
onMounted(async () => {
  kseStore.initialize();
  if (!stakeholdersStore.initialized) {
    await stakeholdersStore.initialize();
  }

  // View mode or profile already saved → go straight to step 2
  const profileKey = `kse_respondent_${currentSlug.value}`;
  if (viewMode.value || localStorage.getItem(profileKey)) {
    currentStep.value = 2;
  }
});

// ── Stakeholder info ──────────────────────────────────────────
const currentStakeholder = computed(() => {
  if (currentSlug.value) {
    return stakeholdersStore.getStakeholderBySlug(currentSlug.value);
  }
  return null;
});

// ── Page header ───────────────────────────────────────────────
const pageData = computed(() => ({
  title: {
    label: currentStakeholder.value
      ? `KSE ${currentStakeholder.value.nama_perusahaan}`
      : 'KSE',
    path: currentSlug.value
      ? `/admin/stakeholders/${currentSlug.value}`
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
  currentStep.value = 1;
};

const backToKse = () => {
  if (stakeholderSlug.value) {
    router.push({ path: '/kse', query: { slug: stakeholderSlug.value } });
  } else {
    router.push('/kse');
  }
};
</script>

<template>
  <Pageheader :propData="pageData" />

  <!-- No slug warning -->
  <div v-if="!currentSlug" class="row">
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
        :slug="currentSlug"
        @submit="handleFormSubmit"
        @cancel="backToKse"
      />
    </template>

    <!-- ── Step 2: KSE Assessment ── -->
    <template v-else-if="currentStep === 2">
      <KseView
        :embedded="true"
        :slug="currentSlug"
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
