<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useDynamicAssessmentStore } from '@/stores/dynamic-assessment';
import QuestionCard from '@/components/assessment/QuestionCard.vue';
import PaginationControl from '@/components/assessment/PaginationControl.vue';
import Pageheader from '@/shared/components/pageheader/pageheader.vue';

const router = useRouter();
const assessmentStore = useDynamicAssessmentStore();

const pageData = {
  title: { label: 'IKAS Management', path: '/ikas-list' },
  currentpage: 'IKAS Template Viewer',
  activepage: 'Template',
};

// Use a mock slug so any accidental store writes don't affect real stakeholders
const MOCK_SLUG = 'admin-template-view';

// Sidebar collapsed state
const sidebarCollapsed = ref(false);
const expandedDomains = ref<Record<string, boolean>>({});
const expandedCategories = ref<Record<string, boolean>>({});
const questionSectionRef = ref<HTMLElement | null>(null);

onMounted(async () => {
  assessmentStore.initializeLocalData();
  await assessmentStore.fetchAssessmentStructure();
  
  // Set mock stakeholder context so we can navigate pages
  assessmentStore.setCurrentStakeholder(MOCK_SLUG);
  assessmentStore.resetStakeholderData(MOCK_SLUG);
});

onUnmounted(() => {
  // Clean up the dummy data when leaving
  assessmentStore.resetStakeholderData(MOCK_SLUG);
});

// Check if domain is current
const isCurrentDomain = (domainId: string) => {
  return assessmentStore.progress.currentDomainId === domainId;
};

const isDomainExpanded = (domainId: string) => {
  return expandedDomains.value[domainId] ?? isCurrentDomain(domainId);
};

const toggleDomain = (domainId: string) => {
  expandedDomains.value[domainId] = !isDomainExpanded(domainId);
};

const ensureCurrentDomainExpanded = () => {
  const domainId = assessmentStore.progress.currentDomainId;
  if (!domainId) return;
  expandedDomains.value[domainId] = true;
};

const categoryAccentPalette = [
  'rgb(var(--success-rgb))',
  'rgb(var(--info-rgb))',
  'var(--primary-color)',
  '#f59e0b',
  '#8b5cf6',
];

const getCategoryAccent = (index: number) => {
  return categoryAccentPalette[index % categoryAccentPalette.length];
};

const getCategoryKey = (domainId: string, categoryId: string) => `${domainId}::${categoryId}`;

const isCategoryExpanded = (domainId: string, categoryId: string) => {
  const key = getCategoryKey(domainId, categoryId);
  return expandedCategories.value[key] ?? assessmentStore.progress.currentCategoryId === categoryId;
};

const toggleCategory = (domainId: string, categoryId: string) => {
  const key = getCategoryKey(domainId, categoryId);
  expandedCategories.value[key] = !isCategoryExpanded(domainId, categoryId);
};

const ensureCurrentCategoryExpanded = () => {
  const domainId = assessmentStore.progress.currentDomainId;
  const categoryId = assessmentStore.progress.currentCategoryId;

  if (!domainId || !categoryId) return;

  expandedCategories.value[getCategoryKey(domainId, categoryId)] = true;
};

// Navigation checks
const canGoPrevious = computed(() => {
  if (assessmentStore.domains.length === 0) return false;
  
  const isFirstDomain = assessmentStore.domains[0].id === assessmentStore.progress.currentDomainId;
  const domain = assessmentStore.currentDomain;
  if (!domain) return false;
  
  const isFirstCategory = domain.categories[0].id === assessmentStore.progress.currentCategoryId;
  const isFirstPage = assessmentStore.progress.currentPage === 1;

  if (isFirstDomain && isFirstCategory && isFirstPage) {
     return false;
  }
  return true;
});

const isLastPage = computed(() => {
    const d = assessmentStore.currentDomain;
    const c = assessmentStore.currentCategory;
    const sc = assessmentStore.currentSubCategory;
    
    if(!d || !c) return false;
    
    const domains = assessmentStore.domains;
    const lastDomain = domains[domains.length - 1];
    const lastCategory = lastDomain?.categories[lastDomain.categories.length - 1];
    const lastSubCategory = lastCategory?.subCategories[lastCategory.subCategories.length - 1];
    
    const isLastDom = d.id === lastDomain?.id;
    const isLastCat = c.id === lastCategory?.id;
    const isLastSubCat = (lastSubCategory?.id || '') === (sc?.id || '');
    const isLastPageInStep = assessmentStore.progress.currentPage === assessmentStore.totalPagesInSubCategory;

    return isLastDom && isLastCat && isLastSubCat && isLastPageInStep;
});

const canGoNext = computed(() => {
  return !isLastPage.value;
});

// Navigation handlers
const goToPreviousPage = () => {
  assessmentStore.goToPreviousPage();
};

const goToNextPage = () => {
  assessmentStore.goToNextPage();
};

const handleAnswer = async (questionId: string, index: number) => {
  // We save it in the store purely so they can click and see the description.
  // Because we are using MOCK_SLUG, it won't be sent to backend or affect real data.
  await assessmentStore.saveAnswer(questionId, index);
};

const scrollToQuestionSectionOnMobile = async () => {
  if (typeof window === 'undefined' || window.innerWidth >= 768) return;

  await nextTick();
  questionSectionRef.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
};

// Sidebar navigation - jump to specific sub-category (page 1)
const jumpToSubCategory = async (domainId: string, categoryId: string, subCategoryId: string) => {
  expandedDomains.value[domainId] = true;
  expandedCategories.value[getCategoryKey(domainId, categoryId)] = true;
  assessmentStore.updateProgress(domainId, categoryId, subCategoryId, 1);
  await scrollToQuestionSectionOnMobile();
};

watch(
  () => assessmentStore.progress.currentDomainId,
  () => {
    ensureCurrentDomainExpanded();
  },
  { immediate: true }
);

watch(
  () => assessmentStore.progress.currentCategoryId,
  () => {
    ensureCurrentCategoryExpanded();
  },
  { immediate: true }
);

const backToList = () => {
  router.push('/ikas-list');
};
</script>

<template>
  <Pageheader :propData="pageData" />

  <div class="assessment-container">
    <div class="row g-4 mt-2">
      <!-- Sidebar -->
      <div
        class="assessment-sidebar-column"
        :class="sidebarCollapsed ? 'assessment-sidebar-column-collapsed' : 'assessment-sidebar-column-expanded'"
      >
        <div class="card custom-card assessment-sidebar">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h6 v-if="!sidebarCollapsed" class="mb-0">Assessment Structure</h6>
            <button 
              class="btn btn-sm btn-light" 
              @click="sidebarCollapsed = !sidebarCollapsed"
              :title="sidebarCollapsed ? 'Expand' : 'Collapse'"
            >
              <i :class="sidebarCollapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line'"></i>
            </button>
          </div>
          
          <!-- Action Block -->
          <div v-if="!sidebarCollapsed" class="p-3 border-bottom bg-light">
            <button 
                class="btn btn-primary w-100 mb-2" 
                @click="backToList"
              >
                <i class="ri-arrow-left-line me-1"></i>
                Kembali ke List
            </button>
            <div class="text-center mt-2">
              <small class="text-muted" style="font-size: 0.75rem;">
                Mode Read-Only: Coba klik index untuk melihat deskripsi jawaban.
              </small>
            </div>
          </div>

          <div v-if="!sidebarCollapsed" class="card-body p-0">
            <div class="accordion" id="assessmentAccordion">
              <!-- Loop through domains -->
              <div 
                v-for="domain in assessmentStore.domains" 
                :key="domain.id"
                class="accordion-item"
                :class="{ 'domain-active': isCurrentDomain(domain.id) }"
              >
                <h2 class="accordion-header">
                  <button 
                    class="accordion-button"
                    :class="{ 'collapsed': !isDomainExpanded(domain.id) }"
                    type="button"
                    @click="toggleDomain(domain.id)"
                    :style="{ borderLeft: '4px solid ' + domain.color }"
                  >
                    <span class="me-2">{{ domain.name }}</span>
                    <span v-if="isCurrentDomain(domain.id)" class="badge bg-primary-transparent ms-auto me-2">Aktif</span>
                  </button>
                </h2>
                <div v-show="isDomainExpanded(domain.id)" class="accordion-collapse">
                  <div class="accordion-body p-0">
                    <div v-for="(category, categoryIndex) in domain.categories" :key="category.id" class="category-group border-bottom">
                      <button
                        type="button"
                        class="category-toggle"
                        :class="{ 'collapsed': !isCategoryExpanded(domain.id, category.id) }"
                        :style="{ '--category-accent': getCategoryAccent(categoryIndex) }"
                        @click="toggleCategory(domain.id, category.id)"
                      >
                        <span class="category-toggle__label">{{ category.name }}</span>
                        <i class="ri-arrow-down-s-line category-toggle__icon"></i>
                      </button>
                      <div v-show="isCategoryExpanded(domain.id, category.id)" class="category-content">
                        <div
                          v-for="subCategory in category.subCategories"
                          :key="subCategory.id"
                          class="subcategory-item px-3 py-2 d-flex justify-content-between align-items-center"
                          :class="{ 'active': assessmentStore.progress.currentCategoryId === category.id && assessmentStore.progress.currentSubCategoryId === subCategory.id }"
                          @click="jumpToSubCategory(domain.id, category.id, subCategory.id)"
                        >
                          <span class="subcategory-name">{{ subCategory.name }}</span>
                        </div>
                        <div
                          v-if="category.subCategories.length === 0"
                          class="subcategory-item px-3 py-2 d-flex justify-content-between align-items-center"
                          :class="{ 'active': assessmentStore.progress.currentCategoryId === category.id }"
                          @click="jumpToSubCategory(domain.id, category.id, '')"
                        >
                          <span class="subcategory-name">Pertanyaan</span>
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
      <div
        ref="questionSectionRef"
        class="assessment-content-column"
        :class="sidebarCollapsed ? 'assessment-content-column-collapsed' : 'assessment-content-column-expanded'"
      >
        <div class="card custom-card">
          <div class="card-header assessment-content-header d-flex justify-content-between align-items-center">
            <nav aria-label="breadcrumb">
              <ol class="breadcrumb mb-0 assessment-breadcrumb">
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
          </div>
          <div class="card-body">
            <!-- Loader -->
            <div v-if="assessmentStore.loading" class="text-center py-5">
              <div class="spinner-border text-primary" role="status">
                 <span class="visually-hidden">Loading...</span>
              </div>
              <p class="mt-3 text-muted">Memuat data dari server...</p>
            </div>
            <!-- Questions -->
            <div v-else-if="assessmentStore.currentPageQuestions.length > 0">
              <QuestionCard
                v-for="(question, index) in assessmentStore.currentPageQuestions"
                :key="question.id"
                :question="question"
                :questionNumber="(assessmentStore.progress.currentPage - 1) * 5 + index + 1"
                :selectedIndex="assessmentStore.getAnswer(question.id)?.index"
                :readOnly="false"
                :showAnsweredBadge="false"
                @answer="handleAnswer"
              />
            </div>
            <div v-else class="text-center py-5">
              <i class="ri-file-list-line fs-48 text-muted"></i>
              <p class="mt-3 text-muted">Tidak ada pertanyaan tersedia.</p>
              <div v-if="assessmentStore.error" class="alert alert-danger mt-3 mx-auto" style="max-width: 500px;">
                <i class="ri-error-warning-line me-2"></i> {{ assessmentStore.error }}
              </div>
            </div>

            <PaginationControl
              v-if="!assessmentStore.loading && assessmentStore.currentPageQuestions.length > 0"
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
.assessment-sidebar-column,
.assessment-content-column {
  width: 100%;
}

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

.category-toggle {
  position: relative;
  width: 100%;
  border: 0;
  background: var(--light);
  padding: 0.75rem 1rem 0.75rem 1.5rem;
  font-weight: 700;
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background-color 0.2s ease;
}

.category-toggle::before {
  content: "";
  position: absolute;
  left: 0.45rem;
  top: 50%;
  width: 0.35rem;
  height: 1.35rem;
  border-radius: 999px;
  background: var(--category-accent);
  transform: translateY(-50%);
  opacity: 0.85;
}

.category-toggle:hover {
  background: var(--primary-01);
}

.category-toggle:not(.collapsed) {
  box-shadow: inset 0.2rem 0 0 var(--category-accent);
}

.category-toggle__label {
  text-align: left;
  flex: 1;
  min-width: 0;
  line-height: 1.45;
  word-break: break-word;
}

.category-toggle__icon {
  flex-shrink: 0;
  font-size: 1rem;
  transition: transform 0.2s ease;
}

.category-toggle.collapsed .category-toggle__icon {
  transform: rotate(-90deg);
}

.category-content {
  background: var(--custom-white);
}

.subcategory-item {
  padding: 0.6rem 1.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid var(--default-border);
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
  min-width: 0;
  line-height: 1.45;
  word-break: break-word;
}

.breadcrumb {
  background: transparent;
  padding: 0;
  row-gap: 0.35rem;
}

.breadcrumb-item {
  font-size: 0.9rem;
  word-break: break-word;
}

.breadcrumb-item.active {
  font-weight: 600;
}

.assessment-content-header {
  gap: 0.75rem;
}

.assessment-breadcrumb {
  flex-wrap: wrap;
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

.assessment-container {
  min-height: 100vh;
  padding-bottom: 3rem;
  font-family: 'Inter', -apple-system, sans-serif;
}

@media (min-width: 768px) {
  .assessment-sidebar-column-expanded {
    flex: 0 0 33.333333%;
    max-width: 33.333333%;
  }

  .assessment-sidebar-column-collapsed {
    flex: 0 0 8.333333%;
    max-width: 8.333333%;
  }

  .assessment-content-column-expanded {
    flex: 0 0 66.666667%;
    max-width: 66.666667%;
  }

  .assessment-content-column-collapsed {
    flex: 0 0 91.666667%;
    max-width: 91.666667%;
  }
}

@media (max-width: 991.98px) {
  .assessment-container {
    padding-bottom: 2rem;
  }

  .assessment-sidebar {
    position: static;
    top: auto;
    max-height: none;
  }

  .accordion-button {
    font-size: 0.875rem;
  }

  .category-toggle {
    padding: 0.8rem 0.95rem 0.8rem 1.4rem;
    font-size: 0.68rem;
  }

  .subcategory-item {
    padding: 0.7rem 1rem;
    font-size: 0.82rem;
  }
}

@media (max-width: 767.98px) {
  .row.g-4.mt-2 {
    --bs-gutter-y: 1rem;
  }

  .assessment-sidebar-column,
  .assessment-content-column {
    flex: 0 0 100%;
    max-width: 100%;
  }

  .assessment-sidebar-column-collapsed,
  .assessment-content-column-collapsed,
  .assessment-sidebar-column-expanded,
  .assessment-content-column-expanded {
    flex: 0 0 100%;
    max-width: 100%;
  }

  .assessment-content-header {
    align-items: flex-start !important;
  }

  .accordion-button {
    padding: 0.85rem 0.9rem;
    font-size: 0.85rem;
    align-items: flex-start;
  }

  .category-toggle {
    padding: 0.85rem 0.9rem 0.85rem 1.35rem;
    font-size: 0.66rem;
    letter-spacing: 0.06em;
    align-items: flex-start;
  }

  .category-toggle::before {
    left: 0.4rem;
    height: 1.1rem;
  }

  .subcategory-item {
    padding: 0.75rem 0.9rem;
    font-size: 0.8rem;
    align-items: flex-start !important;
  }

  .breadcrumb-item {
    font-size: 0.8rem;
  }
}

@media (max-width: 575.98px) {
  .assessment-container {
    padding-bottom: 1.5rem;
  }

  .assessment-sidebar .card-header,
  .assessment-content-header,
  .card-body {
    padding-left: 0.9rem;
    padding-right: 0.9rem;
  }

  .assessment-sidebar .card-body.p-0 {
    padding-left: 0 !important;
    padding-right: 0 !important;
  }

  .accordion-button .badge {
    margin-left: 0.5rem !important;
    margin-right: 0.25rem !important;
  }
}
</style>
