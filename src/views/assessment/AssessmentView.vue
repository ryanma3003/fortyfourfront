<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAssessmentStore } from '@/stores/assessment';
import { assessmentData } from '@/data/assessment/assessment-data';
import QuestionCard from '@/components/assessment/QuestionCard.vue';
import ProgressBar from '@/components/assessment/ProgressBar.vue';
import PaginationControl from '@/components/assessment/PaginationControl.vue';

import Swal from 'sweetalert2';
import { toast } from 'vue3-toastify';
import 'vue3-toastify/dist/index.css';

const assessmentStore = useAssessmentStore();

const props = withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false });

const emit = defineEmits<{
  (e: 'edit'): void;
  (e: 'back'): void;
}>();

// Sidebar collapsed state
const sidebarCollapsed = ref(false);

// Handle answer change
const handleAnswer = (questionId: string, index: number) => {
  assessmentStore.saveAnswer(questionId, index);
};

// Check if domain is current
const isCurrentDomain = (domainId: string) => {
  return assessmentStore.progress.currentDomainId === domainId;
};

// Check if sub-category is current
const isCurrentSubCategory = (domainId: string, categoryId: string, subCategoryId: string) => {
  return assessmentStore.progress.currentDomainId === domainId &&
         assessmentStore.progress.currentCategoryId === categoryId &&
         assessmentStore.progress.currentSubCategoryId === subCategoryId;
};

// Get answered count for a sub-category
const getSubCategoryProgress = (domainId: string, categoryId: string, subCategoryId: string) => {
  const domain = assessmentData.domains.find(d => d.id === domainId);
  const category = domain?.categories.find(c => c.id === categoryId);
  const subCategory = category?.subCategories.find(sc => sc.id === subCategoryId);
  
  if (!subCategory) return { answered: 0, total: 0 };

  const total = subCategory.questions.length;
  const answered = subCategory.questions.filter(q => 
    assessmentStore.getAnswer(q.id) !== undefined
  ).length;

  return { answered, total };
};

// Sidebar navigation
const jumpToSubCategory = (domainId: string, categoryId: string, subCategoryId: string) => {
  assessmentStore.jumpTo(domainId, categoryId, subCategoryId, 1);
};

// --- Computed Properties for Navigation & State ---

// Check if we are on the very last page of the entire assessment
const isLastPage = computed(() => {
    const totalPages = assessmentStore.totalPagesInSubCategory;
    const isLastPageInSub = assessmentStore.progress.currentPage === totalPages;
    
    const d = assessmentStore.currentDomain;
    const c = assessmentStore.currentCategory;
    const s = assessmentStore.currentSubCategory;
    
    if(!d || !c || !s) return false;
    
    const domains = assessmentData.domains;
    const categories = d.categories;
    const subCategories = c.subCategories;
    
    const isLastDom = d.id === domains[domains.length-1].id;
    const isLastCat = c.id === categories[categories.length-1].id;
    const isLastSub = s.id === subCategories[subCategories.length-1].id;
    
    return isLastDom && isLastCat && isLastSub && isLastPageInSub;
});

// Navigation checks
const canGoPrevious = computed(() => {
  const isFirstDomain = assessmentData.domains[0].id === assessmentStore.progress.currentDomainId;
  const domain = assessmentStore.currentDomain;
  const isFirstCategory = domain?.categories.find(c => c.id === assessmentStore.progress.currentCategoryId);
  const category = assessmentStore.currentCategory;
  const isFirstSubCategory = category?.subCategories.find(sc => sc.id === assessmentStore.progress.currentSubCategoryId);
  const isFirstPage = assessmentStore.progress.currentPage === 1;

  // Fix: Ensure we correctly identify if we can go back
  // If anything is undefined, we assume we are at start or something is wrong, so disable prev if truly at start
  if (!domain || !category) return true; // Should not happen ideally

  return !(isFirstDomain && domain.categories[0].id === assessmentStore.progress.currentCategoryId && category.subCategories[0].id === assessmentStore.progress.currentSubCategoryId && isFirstPage);
});

const canGoNext = computed(() => {
  // Disable next if it's the very last page
  if (isLastPage.value) return false;
  return true;
});

// Navigation handlers
const goToPreviousPage = () => {
  assessmentStore.goToPreviousPage();
};

const goToNextPage = () => {
  assessmentStore.goToNextPage();
};

// --- Save & Complete Logic ---

// Check if verification is complete
const allQuestionsAnswered = computed(() => {
  return assessmentStore.answeredQuestions === assessmentStore.totalQuestions;
});

// Handle "Simpan Sementara" or "Simpan dan Selesai"
const handleSaveAction = () => {
    if (allQuestionsAnswered.value) {
        // Simpan dan Selesai
        assessmentStore.completeAssessment();
        
        toast.success('Assessment berhasil disimpan', {
            theme: 'auto',
            icon: true,
            hideProgressBar: true,
            autoClose: 2000,
            position: 'top-right',
        });

        setTimeout(() => {
             emit('back'); // Go back to summary/list
        }, 1500);

    } else {
        // Simpan Sementara
        toast.info('Data berhasil disimpan sementara', {
            theme: 'auto',
            icon: true,
            hideProgressBar: true,
            autoClose: 2000,
            position: 'top-right',
        });

        setTimeout(() => {
             emit('back'); // Go back to summary/list
        }, 1500);
    }
}

const handleEditData = () => {
    assessmentStore.unlockAssessment();
    
    toast.info('Mode edit aktif. Silakan ubah data.', {
        autoClose: 2000,
        position: 'top-right'
    });
}
</script>

<template>
  <div class="assessment-container">
  <div class="row sticky-progress-row">
    <div class="col-12">
      <div class="progress-wrapper">
        <!-- Progress Bar -->
        <ProgressBar
          :answered="assessmentStore.answeredQuestions"
          :total="assessmentStore.totalQuestions"
          :currentPage="assessmentStore.progress.currentPage"
          :totalPages="assessmentStore.totalPagesInSubCategory"
          title="IKAS"
        />
      </div>
    </div>
  </div>

  <div class="row g-4">
    <!-- Sidebar -->
    <div :class="sidebarCollapsed ? 'col-md-1' : 'col-md-3'">
      <div class="card custom-card assessment-sidebar">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h6 v-if="!sidebarCollapsed" class="mb-0">Assessment Domains</h6>
          <button 
            class="btn btn-sm btn-light" 
            @click="sidebarCollapsed = !sidebarCollapsed"
            :title="sidebarCollapsed ? 'Expand' : 'Collapse'"
          >
            <i :class="sidebarCollapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line'"></i>
          </button>
        </div>
        
        <!-- Save Action Block (Above Accordion) -->
        <div v-if="!sidebarCollapsed" class="p-3 border-bottom bg-light">
          <!-- Non-Embedded Mode -->
          <template v-if="!embedded">
            <button 
              v-if="!assessmentStore.isLocked"
              class="btn w-100 mb-2" 
              :class="allQuestionsAnswered ? 'btn-success' : 'btn-warning'"
              @click="handleSaveAction"
            >
              <i class="ri-save-line me-1"></i>
              {{ allQuestionsAnswered ? 'Simpan dan Selesai' : 'Simpan Sementara' }}
            </button>
            <button 
              v-else
              class="btn btn-primary w-100" 
              @click="handleEditData"
            >
              <i class="ri-edit-line me-1"></i>
              Edit Data
            </button>
          </template>

          <!-- Embedded Mode: Show Both Buttons -->
          <template v-else>
            <template v-if="!assessmentStore.isLocked">
              <button 
                class="btn w-100 mb-2" 
                :class="allQuestionsAnswered ? 'btn-success' : 'btn-warning'"
                @click="handleSaveAction"
              >
                <i class="ri-save-line me-1"></i>
                {{ allQuestionsAnswered ? 'Simpan dan Selesai' : 'Simpan Sementara' }}
              </button>
              <button 
                v-if="allQuestionsAnswered"
                class="btn btn-primary w-100" 
                @click="emit('edit')"
              >
                <i class="ri-edit-line me-1"></i>
                Edit Data
              </button>
            </template>
            <button 
              v-else
              class="btn btn-warning w-100" 
              @click="handleEditData"
            >
              <i class="ri-edit-line me-1"></i>
              Edit Data
            </button>
          </template>
            
          <div v-if="!assessmentStore.isLocked && !embedded" class="text-center">
            <small v-if="!allQuestionsAnswered" class="text-muted" style="font-size: 0.75rem;">
              {{ assessmentStore.answeredQuestions }} / {{ assessmentStore.totalQuestions }} Terjawab
            </small>
            <small v-else class="text-success fw-bold" style="font-size: 0.75rem;">
              <i class="ri-checkbox-circle-line"></i> Siap Disimpan
            </small>
            </div>
        </div>

        <div v-if="!sidebarCollapsed" class="card-body p-0">
          <div class="accordion" id="assessmentAccordion">
            <!-- Loop through domains -->
            <div 
              v-for="domain in assessmentData.domains" 
              :key="domain.id"
              class="accordion-item"
              :class="{ 'domain-active': isCurrentDomain(domain.id) }"
            >
              <h2 class="accordion-header">
                <button 
                  class="accordion-button"
                  :class="{ 'collapsed': !isCurrentDomain(domain.id) }"
                  type="button" 
                  data-bs-toggle="collapse" 
                  :data-bs-target="'#domain-' + domain.id"
                  :style="{ borderLeft: '4px solid ' + domain.color }"
                >
                  <span class="me-2">{{ domain.name }}</span>
                  <span v-if="isCurrentDomain(domain.id)" class="badge bg-primary-transparent ms-auto me-2">Aktif</span>
                </button>
              </h2>
              <div 
                :id="'domain-' + domain.id" 
                class="accordion-collapse collapse"
                :class="{ 'show': isCurrentDomain(domain.id) }"
                data-bs-parent="#assessmentAccordion"
              >
                <div class="accordion-body p-0">
                  <!-- Categories -->
                  <div 
                    v-for="category in domain.categories" 
                    :key="category.id"
                    class="category-section"
                  >
                    <div class="category-title">{{ category.name }}</div>
                    <!-- Sub-categories -->
                    <div 
                      v-for="subCategory in category.subCategories" 
                      :key="subCategory.id"
                      class="subcategory-item"
                      :class="{ 'active': isCurrentSubCategory(domain.id, category.id, subCategory.id) }"
                      @click="jumpToSubCategory(domain.id, category.id, subCategory.id)"
                    >
                      <div class="d-flex justify-content-between align-items-center">
                        <span class="subcategory-name">{{ subCategory.name }}</span>
                        <span class="badge bg-secondary-transparent">
                          {{ getSubCategoryProgress(domain.id, category.id, subCategory.id).answered }} / 
                          {{ getSubCategoryProgress(domain.id, category.id, subCategory.id).total }}
                        </span>
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

    <!-- Main Content -->
    <div :class="sidebarCollapsed ? 'col-md-11' : 'col-md-9'">
      <div class="card custom-card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <!-- Breadcrumb -->
          <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-0">
              <li 
                v-for="(item, index) in assessmentStore.breadcrumbPath" 
                :key="index"
                class="breadcrumb-item"
                :class="{ 'active': index === assessmentStore.breadcrumbPath.length - 1 }"
              >
                {{ item }}
              </li>
            </ol>
          </nav>

          <!-- Action Buttons -->
          <div class="d-flex gap-2">
            <button 
              @click="emit('back')" 
              class="btn btn-sm btn-success-light"
              title="Kembali ke Ringkasan IKAS"
            >
              <i class="ri-file-list-3-line me-1"></i>
              Lihat Ringkasan
            </button>
          </div>
        </div>
        <div class="card-body">
            
          <!-- Locked State Message -->
          <div v-if="assessmentStore.isLocked" class="alert alert-warning mb-4">
            <div class="d-flex align-items-center">
                <i class="ri-lock-2-line fs-24 me-3"></i>
                <div>
                    <h6 class="mb-1 fw-bold">Assessment Telah Selesai</h6>
                    <p class="mb-0 mb-2">Data telah dikunci. Klik tombol "Edit Data" di sidebar kiri jika Anda ingin mengubah jawaban.</p>
                </div>
            </div>
          </div>

          <!-- Questions -->
          <div v-if="assessmentStore.currentPageQuestions.length > 0">
            <QuestionCard
              v-for="(question, index) in assessmentStore.currentPageQuestions"
              :key="question.id"
              :question="question"
              :questionNumber="(assessmentStore.progress.currentPage - 1) * 5 + index + 1"
              :selectedIndex="assessmentStore.getAnswer(question.id)?.index"
              :readOnly="assessmentStore.isLocked"
              @answer="handleAnswer"
            />
          </div>
          <div v-else class="text-center py-5">
            <i class="ri-file-list-line fs-48 text-muted"></i>
            <p class="mt-3 text-muted">Tidak ada pertanyaan tersedia.</p>
          </div>

          <!-- Pagination -->
          <PaginationControl
            :currentPage="assessmentStore.progress.currentPage"
            :totalPages="assessmentStore.totalPagesInSubCategory"
            :canGoPrevious="canGoPrevious"
            :canGoNext="canGoNext"
            @previous="goToPreviousPage"
            @next="goToNextPage"
          />
        </div>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.assessment-sidebar {
  position: sticky;
  top: 20px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}

.accordion-button {
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.75rem 1rem;
}

.accordion-button:not(.collapsed) {
  background-color: var(--primary-01);
  color: var(--primary-color);
  box-shadow: none;
}

.accordion-item.domain-active .accordion-button {
  background-color: var(--primary-01);
}

.category-section {
  border-bottom: 1px solid var(--default-border);
}

.category-title {
  padding: 0.75rem 1rem;
  font-weight: 600;
  font-size: 0.85rem;
  background: var(--light);
  color: var(--default-text-color);
}

.subcategory-item {
  padding: 0.6rem 1.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
  font-size: 0.85rem;
}

.subcategory-item:hover {
  background: var(--light);
}

.subcategory-item.active {
  background: var(--primary-01);
  border-left-color: var(--primary-color);
  font-weight: 600;
}

.subcategory-name {
  flex: 1;
}

.breadcrumb {
  background: transparent;
  padding: 0;
}

.breadcrumb-item {
  font-size: 0.9rem;
}

.breadcrumb-item.active {
  font-weight: 600;
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: var(--light);
}

::-webkit-scrollbar-thumb {
  background: var(--default-border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* Sticky Progress Row */
.sticky-progress-row {
  position: sticky;
  top: 74px;
  z-index: 99;
  margin-top: -10px;
  padding-bottom: 1.25rem;
  margin-bottom: 1rem;
}

.progress-wrapper {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

.assessment-container {
  min-height: 100vh;
  padding-bottom: 3rem;
  font-family: 'Inter', -apple-system, sans-serif;
}
</style>
