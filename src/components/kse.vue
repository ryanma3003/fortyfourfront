<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { stakeholdersData } from '../data/dummydata';
import { kseCategories, type KseCategory, getMaxTotalBobot } from '../data/kse-data';
import { useKseStore } from '../stores/kse';
import Pageheader from '../shared/components/pageheader/pageheader.vue';

import { toast } from 'vue3-toastify';
import 'vue3-toastify/dist/index.css';

// Components
import KseQuestionCard from './kse/KseQuestionCard.vue';
import ProgressBar from './assessment/ProgressBar.vue';
import PaginationControl from './assessment/PaginationControl.vue';

const router = useRouter();
const route = useRoute();
const kseStore = useKseStore();

const currentSlug = computed(() => String(route.query.slug || ''));
const currentSource = computed(() => String(route.query.source || ''));

// Navigation state
const currentCategoryId = ref<string>(kseCategories[0].id);
const currentPage = ref(1);
const questionsPerPage = 5;

// Initialize store
onMounted(() => {
  kseStore.initialize();
  
  // Update stakeholder info if we have a slug
  if (currentSlug.value && currentStakeholder.value) {
    kseStore.updateStakeholderInfo(
      currentSlug.value,
      currentStakeholder.value.nama_perusahaan || '',
      currentStakeholder.value.sektor || ''
    );
  }
});

// Watch for category change to reset page
watch(currentCategoryId, () => {
  currentPage.value = 1;
});

// Get KSE data for current stakeholder
const kseData = computed(() => {
  if (currentSlug.value) {
    return kseStore.getKseData(currentSlug.value);
  }
  return kseStore.getKseData('default');
});

// Page header data
const dataToPass = computed(() => {
  try {
    const slug = route.query.slug;
    const source = route.query.source;

    let titleLabel = 'KSE';
    let titlePath = '/stakeholders';

    if (source === 'list') {
        titleLabel = 'Stakeholders';
        titlePath = '/stakeholders';
    } else if (slug && stakeholdersData && Array.isArray(stakeholdersData)) {
      const stakeholder = stakeholdersData.find(s => s.slug === String(slug));
      if (stakeholder) {
          titleLabel = `Profile ${stakeholder.nama_perusahaan}`;
          titlePath = `/profile-stakeholders/${stakeholder.slug}`;
      }
    }

    return {
      title: { label: titleLabel, path: titlePath },
      currentpage: 'KSE Assessment',
      activepage: 'KSE',
    };
  } catch (error) {
    console.error('KSE Error in computed:', error);
    return {
        title: { label: 'Stakeholders', path: '/stakeholders' },
        currentpage: 'KSE Assessment',
        activepage: 'KSE',
    };
  }
});

// Get current stakeholder
const currentStakeholder = computed(() => {
  const slug = route.query.slug;
  if (slug && stakeholdersData && Array.isArray(stakeholdersData)) {
    return stakeholdersData.find(s => s.slug === String(slug));
  }
  return null;
});

// Current Category Logic
const currentCategory = computed(() => {
  return kseCategories.find(c => c.id === currentCategoryId.value) || kseCategories[0];
});

// Pagination Logic
const currentQuestions = computed(() => {
  const category = currentCategory.value;
  if (!category) return [];
  
  const start = (currentPage.value - 1) * questionsPerPage;
  const end = start + questionsPerPage;
  return category.questions.slice(start, end);
});

const totalPagesInCategory = computed(() => {
  const category = currentCategory.value;
  if (!category) return 1;
  return Math.ceil(category.questions.length / questionsPerPage);
});

// Progress Logic
const totalQuestions = computed(() => {
  let count = 0;
  kseCategories.forEach(cat => count += cat.questions.length);
  return count;
});

const answeredQuestionsCount = computed(() => {
  const data = kseData.value;
  if (!data?.answers) return 0;
  return Object.values(data.answers).filter(a => a.selectedOption !== null).filter(a => a.selectedOption !== undefined).length;
});

// Handle option selection
const handleAnswer = (questionNo: string, optionKey: 'A' | 'B' | 'C', bobot: number) => {
  const slug = currentSlug.value || 'default';
  kseStore.updateAnswer(slug, questionNo, optionKey, bobot);
};

// Navigation Handlers
const prevPage = () => {
    if (currentPage.value > 1) {
        currentPage.value--;
    } else {
        // Go to previous category if exists
        const currentIndex = kseCategories.findIndex(c => c.id === currentCategoryId.value);
        if (currentIndex > 0) {
            currentCategoryId.value = kseCategories[currentIndex - 1].id;
             // Go to last page of previous category
            const prevCategory = kseCategories[currentIndex - 1];
            currentPage.value = Math.ceil(prevCategory.questions.length / questionsPerPage);
        }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

const nextPage = () => {
    if (currentPage.value < totalPagesInCategory.value) {
        currentPage.value++;
    } else {
        // Go to next category if exists
        const currentIndex = kseCategories.findIndex(c => c.id === currentCategoryId.value);
        if (currentIndex < kseCategories.length - 1) {
            currentCategoryId.value = kseCategories[currentIndex + 1].id;
            currentPage.value = 1;
        }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

const canGoPrevious = computed(() => {
    const isFirstCategory = kseCategories[0].id === currentCategoryId.value;
    const isFirstPage = currentPage.value === 1;
    return !(isFirstCategory && isFirstPage);
});

const canGoNext = computed(() => {
    const isLastCategory = kseCategories[kseCategories.length - 1].id === currentCategoryId.value;
    const isLastPage = currentPage.value === totalPagesInCategory.value;
    return !(isLastCategory && isLastPage);
});



// Lock state
const isLocked = computed(() => !!kseData.value?.isSubmitted);

// Save and Exit
const saveAndExit = () => {
    const slug = currentSlug.value || 'default';
    kseStore.submitData(slug); // Lock the data

  // Show success toast notification
  toast.success('Data KSE berhasil disimpan', {
    theme: 'auto',
    icon: true,
    hideProgressBar: true,
    autoClose: 2000,
    position: 'top-right',
  });
  
  // Navigate back after delay
  setTimeout(() => {
    if (currentSlug.value) {
      if (currentSource.value === 'list') {
        router.push('/stakeholders');
      } else {
        router.push(`/profile-stakeholders/${currentSlug.value}`);
      }
    } else {
      router.push('/stakeholders');
    }
  }, 1500);
};

// Edit Data
const editData = () => {
    const slug = currentSlug.value || 'default';
    kseStore.unlockData(slug); // Unlock the data
    toast.info('Mode edit aktif. Silakan ubah data.', {
        autoClose: 2000,
        position: 'top-right'
    });
};
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Progress Bar -->
  <div class="row sticky-progress-row">
    <div class="col-12">
      <ProgressBar
        :answered="answeredQuestionsCount"
        :total="totalQuestions"
        :currentPage="currentPage"
        :totalPages="totalPagesInCategory"
        :questionsPerPage="questionsPerPage"
      />
    </div>
  </div>

  <div class="row mt-3">
    <!-- Sidebar -->
    <div class="col-md-3">
      <div class="sticky-sidebar">
        <!-- Action Card -->
        <div class="card custom-card mb-3">
            <div class="card-body p-3">
              <button 
                  v-if="!isLocked"
                  @click="saveAndExit" 
                  class="btn btn-success btn-wave w-100 fw-bold"
                >
                  <i class="ri-save-line me-1"></i> Simpan & Selesai
                </button>
                <button 
                  v-else
                  @click="editData" 
                  class="btn btn-warning btn-wave w-100 fw-bold text-white"
                >
                  <i class="ri-edit-line me-1"></i> Edit Data
                </button>
            </div>
        </div>

        <!-- Score Card -->
        <div class="card custom-card bg-primary-transparent border-primary mb-3">
            <div class="card-body p-3">
                <h6 class="text-primary fw-bold mb-2">Kategori Sistem Elektronik</h6>
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span>Total Bobot:</span>
                    <span class="fw-bold">{{ kseData?.totalBobot || 0 }}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <span>Kategori:</span>
                    <span class="badge bg-primary">{{ kseData?.kategoriSE || 'Belum' }}</span>
                </div>
            </div>
        </div>

        <!-- Criteria Table Card -->
        <div class="card custom-card">
          <div class="card-header p-3 border-bottom-0 pb-0">
             <h6 class="card-title fw-semibold">Ketentuan Penilaian:</h6>
          </div>
          <div class="card-body p-3">
            <div class="table-responsive">
              <table class="table table-bordered text-center table-sm mb-0 fs-12">
                <thead class="bg-light">
                  <tr>
                    <th>Kategori</th>
                    <th>Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="text-start">Strategis</td>
                    <td>35 - 50</td>
                  </tr>
                  <tr>
                    <td class="text-start">Tinggi</td>
                    <td>16 - 34</td>
                  </tr>
                   <tr>
                    <td class="text-start">Rendah</td>
                    <td>10 - 15</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="col-md-9">
      <div class="card custom-card">
         <div class="card-header d-flex justify-content-between align-items-center p-3 border-bottom-0">
             <div>
                 <h5 class="mb-1 text-primary fw-bold">{{ currentCategory.title }}</h5>
                 <p class="mb-0 text-muted fs-13">Silakan lengkapi pertanyaan di bawah ini sesuai kondisi instansi.</p>
             </div>
             <!-- Button removed from header -->
         </div>

         <div class="card-body bg-light">
             <KseQuestionCard
                v-for="question in currentQuestions"
                :key="question.no"
                :question="question"
                :selectedOption="kseData?.answers?.[question.no]?.selectedOption"
                :readonly="isLocked"
                @answer="handleAnswer"
             />

             <PaginationControl
                :currentPage="currentPage"
                :totalPages="totalPagesInCategory"
                :canGoPrevious="canGoPrevious"
                :canGoNext="canGoNext"
                @previous="prevPage"
                @next="nextPage"
             />
         </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sticky-progress-row {
    position: sticky;
    top: 74px; /* Sticks below the main header */
    z-index: 10;
    backdrop-filter: blur(10px); /* Optional: adds a nice glass effect if transparent */
}

.sticky-sidebar {
    position: sticky;
    top: 250px; /* Pushes it down so it won't be covered by progress bar */
    z-index: 9;
}

.category-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}

.list-group-item.active {
    background-color: var(--primary-01);
    color: var(--primary-color);
    border-color: transparent;
    font-weight: 600;
}

.list-group-item.active .badge {
    background-color: var(--primary-color) !important;
    color: white !important;
}

/* SweetAlert customization (reused) */
.swal-custom-popup {
  border-radius: 16px !important;
}
</style>

<style>
/* Global styles for SweetAlert if needed */
.swal2-container {
  z-index: 99999 !important;
}
</style>
