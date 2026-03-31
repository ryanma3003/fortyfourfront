<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useResikoStore } from '@/stores/resiko';
import { useStakeholdersStore } from '@/stores/stakeholders';
import Pageheader from '@/shared/components/pageheader/pageheader.vue';
import RespondentFormResiko from '@/views/assessment/RespondentFormResiko.vue';
import ResikoView from '@/views/assessment/ResikoView.vue';

const router = useRouter();
const route = useRoute();
const resikoStore = useResikoStore();
const stakeholdersStore = useStakeholdersStore();

const currentSlug = computed(() => String(route.query.slug || ''));
const currentStep = ref(1);

onMounted(async () => {
  resikoStore.initialize();
  if (!stakeholdersStore.initialized) {
    await stakeholdersStore.initialize();
  }
  
  if (currentSlug.value) {
    resikoStore.setCurrentStakeholder(currentSlug.value);
  }

  if (resikoStore.hasRespondentProfile) {
    currentStep.value = 2;
  }
});

const currentStakeholder = computed(() => {
  if (currentSlug.value) {
    return stakeholdersStore.getStakeholderBySlug(currentSlug.value);
  }
  return null;
});

const pageData = computed(() => {
  return {
    title: { 
      label: currentStakeholder.value 
        ? `Survey Resiko - ${currentStakeholder.value.nama_perusahaan}` 
        : "Survey Resiko", 
      path: currentSlug.value ? `/stakeholders/${currentSlug.value}` : '/stakeholders'
    },
    currentpage: currentStep.value === 1 ? "Data Responden" : "Input Data",
    activepage: currentStep.value === 1 ? "Data Responden" : "Pertanyaan Survey",
  };
});

const handleFormSubmit = () => {
  currentStep.value = 2;
};

const handleEditData = () => {
  currentStep.value = 1;
};

const backToProfile = () => {
  if (currentSlug.value) {
    router.push({ path: '/profile-resiko', query: { slug: currentSlug.value } });
  } else {
    router.push('/stakeholders');
  }
};
</script>

<template>
  <Pageheader :propData="pageData" />

  <div v-if="!currentSlug" class="row">
    <div class="col-12">
      <div class="alert alert-warning shadow-sm border-0">
        <i class="ri-alert-line me-2"></i>
        Tidak ada stakeholder yang dipilih. Silakan kembali dan pilih stakeholder terlebih dahulu.
      </div>
    </div>
  </div>

  <template v-else>
    <!-- Step Indicator -->
    <div class="row mb-2">
      <div class="col-12">
        <div class="card custom-card step-card shadow-none border">
          <div class="card-body py-4 bg-white">
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
                <span class="step-label">Survey Resiko</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Step 1: Respondent Form -->
    <template v-if="currentStep === 1">
      <RespondentFormResiko 
        @submit="handleFormSubmit"
        @cancel="backToProfile"
      />
    </template>

    <!-- Step 2: Assessment View -->
    <template v-else-if="currentStep === 2">
      <ResikoView 
        :embedded="true"
        @edit="handleEditData"
        @back="backToProfile"
      />
    </template>
  </template>
</template>

<style scoped>
.step-card {
  border: none;
  border-radius: 12px;
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
