<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAssessmentStore } from '@/stores/assessment';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { assessmentData } from '@/data/assessment/assessment-data';
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
  let backPath = '/ikas';
  let backQuery: Record<string, string> = { slug: currentSlug.value };
  if (currentSource.value) {
    backQuery.source = currentSource.value;
  }
  
  return {
    title: { 
      label: currentStakeholder.value 
        ? `IKAS ${currentStakeholder.value.nama_perusahaan}` 
        : "IKAS Dashboard", 
      path: `${backPath}?slug=${currentSlug.value}${currentSource.value ? '&source=' + currentSource.value : ''}` 
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
  const query: Record<string, string> = { slug: currentSlug.value };
  if (currentSource.value) {
    query.source = currentSource.value;
  }
  router.push({ path: '/ikas', query });
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
    <div class="row mb-3">
      <div class="col-12">
        <div class="card custom-card">
          <div class="card-body py-3">
            <div class="d-flex align-items-center justify-content-center gap-4">
              <!-- Step 1 -->
              <div class="d-flex align-items-center gap-2">
                <div 
                  class="step-indicator"
                  :class="{ 'active': currentStep === 1, 'completed': currentStep > 1 }"
                >
                  <i v-if="currentStep > 1" class="ri-check-line"></i>
                  <span v-else>1</span>
                </div>
                <span class="fw-semibold" :class="{ 'text-primary': currentStep === 1 }">
                  Data Responden
                </span>
              </div>

              <!-- Divider -->
              <div class="step-divider" :class="{ 'active': currentStep > 1 }"></div>

              <!-- Step 2 -->
              <div class="d-flex align-items-center gap-2">
                <div 
                  class="step-indicator"
                  :class="{ 'active': currentStep === 2 }"
                >
                  2
                </div>
                <span class="fw-semibold" :class="{ 'text-primary': currentStep === 2 }">
                  Penilaian IKAS
                </span>
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
        @edit="handleEditData"
        @back="backToIkas"
      />
    </template>
  </template>
</template>

<style scoped>
/* Step Indicator Styles */
.step-indicator {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--light);
  border: 2px solid var(--default-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: var(--text-muted);
  transition: all 0.3s ease;
}

.step-indicator.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.step-indicator.completed {
  background: var(--success);
  border-color: var(--success);
  color: white;
}

.step-divider {
  width: 80px;
  height: 2px;
  background: var(--default-border);
  transition: all 0.3s ease;
}

.step-divider.active {
  background: var(--success);
}
</style>
