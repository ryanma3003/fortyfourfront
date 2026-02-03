<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAssessmentStore } from '@/stores/assessment';
import { assessmentData } from '@/data/assessment/assessment-data';
import QuestionCard from '@/components/assessment/QuestionCard.vue';
import ProgressBar from '@/components/assessment/ProgressBar.vue';
import PaginationControl from '@/components/assessment/PaginationControl.vue';
import type { AnswerIndex } from '@/types/assessment.types';

const assessmentStore = useAssessmentStore();

const emit = defineEmits<{
  (e: 'edit'): void;
  (e: 'back'): void;
}>();

// Sidebar collapsed state
const sidebarCollapsed = ref(false);

// Handle answer change
const handleAnswer = (questionId: string, index: AnswerIndex) => {
  assessmentStore.saveAnswer(questionId, index);
};

// Navigation handlers
const goToPreviousPage = () => {
  assessmentStore.goToPreviousPage();
};

const goToNextPage = () => {
  assessmentStore.goToNextPage();
};

// Navigation checks
const canGoPrevious = computed(() => {
  // Check if we're not at the very first page of the entire assessment
  const isFirstDomain = assessmentData.domains[0].id === assessmentStore.progress.currentDomainId;
  const domain = assessmentStore.currentDomain;
  const isFirstCategory = domain?.categories[0].id === assessmentStore.progress.currentCategoryId;
  const category = assessmentStore.currentCategory;
  const isFirstSubCategory = category?.subCategories[0].id === assessmentStore.progress.currentSubCategoryId;
  const isFirstPage = assessmentStore.progress.currentPage === 1;

  return !(isFirstDomain && isFirstCategory && isFirstSubCategory && isFirstPage);
});

const canGoNext = computed(() => {
  // Always allow next (will either go to next page or next sub-category)
  return true;
});

// Sidebar navigation
const jumpToSubCategory = (domainId: string, categoryId: string, subCategoryId: string) => {
  assessmentStore.jumpTo(domainId, categoryId, subCategoryId, 1);
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

// Check if sub-category is current
const isCurrentSubCategory = (domainId: string, categoryId: string, subCategoryId: string) => {
  return assessmentStore.progress.currentDomainId === domainId &&
         assessmentStore.progress.currentCategoryId === categoryId &&
         assessmentStore.progress.currentSubCategoryId === subCategoryId;
};
</script>

<template>
  <div class="row">
    <div class="col-12">
      <!-- Progress Bar -->
      <ProgressBar
        :answered="assessmentStore.answeredQuestions"
        :total="assessmentStore.totalQuestions"
        :currentPage="assessmentStore.progress.currentPage"
        :totalPages="assessmentStore.totalPagesInSubCategory"
        :questionsPerPage="5"
      />
    </div>
  </div>

  <div class="row mt-3">
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
        <div v-if="!sidebarCollapsed" class="card-body p-0">
          <div class="accordion" id="assessmentAccordion">
            <!-- Loop through domains -->
            <div 
              v-for="domain in assessmentData.domains" 
              :key="domain.id"
              class="accordion-item"
            >
              <h2 class="accordion-header">
                <button 
                  class="accordion-button collapsed"
                  type="button" 
                  data-bs-toggle="collapse" 
                  :data-bs-target="'#domain-' + domain.id"
                  :style="{ borderLeft: '4px solid ' + domain.color }"
                >
                  {{ domain.name }}
                </button>
              </h2>
              <div 
                :id="'domain-' + domain.id" 
                class="accordion-collapse collapse"
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
              @click="emit('edit')" 
              class="btn btn-sm btn-light"
              title="Edit Data Responden"
            >
              <i class="ri-edit-line me-1"></i>
              Edit Data
            </button>
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
          <!-- Questions -->
          <div v-if="assessmentStore.currentPageQuestions.length > 0">
            <QuestionCard
              v-for="(question, index) in assessmentStore.currentPageQuestions"
              :key="question.id"
              :question="question"
              :questionNumber="(assessmentStore.progress.currentPage - 1) * 5 + index + 1"
              :selectedIndex="assessmentStore.getAnswer(question.id)?.index"
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
  background-color: var(--light);
  color: var(--default-text-color);
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
</style>
