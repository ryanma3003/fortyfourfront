<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAssessmentStore } from '@/stores/assessment';
import { useStakeholdersStore } from '@/stores/stakeholders';
import Pageheader from '@/shared/components/pageheader/pageheader.vue';
import RespondentForm from '@/views/assessment/RespondentForm.vue';
import AssessmentView from '@/views/assessment/AssessmentView.vue';

const router = useRouter();
const route = useRoute();
const assessmentStore = useAssessmentStore();
const stakeholdersStore = useStakeholdersStore();

// Get current stakeholder slug and source from route query
const currentSlug = computed(() => String(route.query.slug || ''));
const currentSource = computed(() => String(route.query.source || ''));

// Step management: 1 = Respondent Form, 2 = Assessment
const currentStep = ref(1);

// Initialize stores
onMounted(async () => {
  assessmentStore.initialize();
  
  if (!stakeholdersStore.initialized) {
    await stakeholdersStore.initialize();
  }

  // Check if respondent profile exists, if yes skip to step 2
  // But also check if form is newly requested via edit
  if (assessmentStore.hasRespondentProfile) {
    currentStep.value = 2;
  }
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
      path: currentSlug.value ? `/admin/stakeholders/${currentSlug.value}` : '/stakeholders'
    },
    currentpage: currentStep.value === 1 ? "Data Responden" : "Input Data",
    activepage: currentStep.value === 1 ? "Data Responden" : (assessmentStore.currentDomain?.name || 'Input Data'),
  };
});

// Navigation Handlers
const handleFormSubmit = () => {
  // Form is already saved to store by the component
  currentStep.value = 2;
};

const handleEditData = () => {
  currentStep.value = 1;
};

const backToIkas = () => {
  if (currentSlug.value) {
    router.push({ path: '/ikas', query: { slug: currentSlug.value } });
  } else {
    router.push('/ikas');
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
        @submit="handleFormSubmit"
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
