<script setup lang="ts">
import { ref, computed } from 'vue';
import { useResikoStore } from '@/stores/resiko';
import { resikoData } from '@/data/assessment/resiko-data';
import QuestionCard from '@/components/assessment/QuestionCard.vue';
import ProgressBar from '@/components/assessment/ProgressBar.vue';
import { toast } from 'vue3-toastify';

const resikoStore = useResikoStore();
const props = withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false });
const emit = defineEmits<{
  (e: 'edit'): void;
  (e: 'back'): void;
}>();

const sidebarCollapsed = ref(false);

const handleAnswer = (questionId: string, index: number) => {
  resikoStore.saveAnswer(questionId, index);
};

const getSubCategoryProgress = (domainId: string, categoryId: string, subCategoryId: string) => {
  const domain = resikoData.domains.find((d: any) => d.id === domainId);
  const category = domain?.categories.find((c: any) => c.id === categoryId);
  const subCategory = category?.subCategories.find((sc: any) => sc.id === subCategoryId);
  if (!subCategory) return { answered: 0, total: 0 };
  const total = subCategory.questions.length;
  const answered = subCategory.questions.filter((q: any) => resikoStore.answers[q.id] !== undefined).length;
  return { answered, total };
};

const allQuestionsAnswered = computed(() => resikoStore.answeredQuestions === resikoStore.totalQuestions);

const handleSaveAction = () => {
    if (allQuestionsAnswered.value) {
        resikoStore.completeAssessment();
        toast.success('Survey Resiko berhasil disimpan', { autoClose: 2000, position: 'top-right' });
        setTimeout(() => { emit('back'); }, 1500);
    } else {
        toast.info('Data berhasil disimpan sementara', { autoClose: 2000, position: 'top-right' });
        setTimeout(() => { emit('back'); }, 1500);
    }
}

const goToNextPage = () => resikoStore.goToNextPage();
const goToPreviousPage = () => {
    // Basic previous page logic
    if (resikoStore.progress.currentPage > 1) {
        resikoStore.progress.currentPage--;
    }
}
</script>

<template>
  <div class="assessment-container">
    <div class="row sticky-progress-row">
      <div class="col-12">
        <div class="progress-wrapper border-indigo">
          <ProgressBar
            :answered="resikoStore.answeredQuestions"
            :total="resikoStore.totalQuestions"
            :currentPage="resikoStore.progress.currentPage"
            :totalPages="resikoStore.totalPagesInSubCategory"
            title="SURVEY RESIKO"
          />
        </div>
      </div>
    </div>

    <div class="row g-4 mt-2">
      <!-- Sidebar -->
      <div :class="sidebarCollapsed ? 'col-md-1' : 'col-md-3'">
        <div class="card custom-card assessment-sidebar shadow-sm">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h6 v-if="!sidebarCollapsed" class="mb-0 fw-bold">Domain Survey</h6>
            <button 
              class="btn btn-sm btn-light" 
              @click="sidebarCollapsed = !sidebarCollapsed"
              :title="sidebarCollapsed ? 'Expand' : 'Collapse'"
            >
              <i :class="sidebarCollapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line'"></i>
            </button>
          </div>
          
          <div v-if="!sidebarCollapsed" class="card-body p-0">
            <div class="accordion" id="riskSurveyAccordion">
              <div 
                v-for="domain in resikoData.domains" 
                :key="domain.id"
                class="accordion-item border-0"
              >
                <h2 class="accordion-header">
                  <button 
                    class="accordion-button"
                    type="button" 
                    data-bs-toggle="collapse" 
                    :data-bs-target="'#domain-' + domain.id"
                    aria-expanded="true"
                  >
                    <i class="ri-shield-check-line me-2 text-primary"></i>
                    <span class="fs-13 fw-semibold">{{ domain.name }}</span>
                  </button>
                </h2>
                <div 
                  :id="'domain-' + domain.id" 
                  class="accordion-collapse collapse show"
                  data-bs-parent="#riskSurveyAccordion"
                >
                  <div class="accordion-body p-0">
                    <div v-for="category in domain.categories" :key="category.id" class="category-group border-bottom">
                      <div class="bg-light px-3 py-2 fw-bold fs-11 text-muted text-uppercase tracking-wider">
                        {{ category.name }}
                      </div>
                      <div 
                        v-for="sub in category.subCategories" 
                        :key="sub.id" 
                        class="subcategory-link px-3 py-2 d-flex justify-content-between align-items-center"
                        :class="{ 'active': resikoStore.progress.currentSubCategoryId === sub.id }"
                        style="cursor: pointer"
                        @click="resikoStore.progress.currentSubCategoryId = sub.id; resikoStore.progress.currentCategoryId = category.id; resikoStore.progress.currentPage = 1"
                      >
                         <span class="fs-12">{{ sub.name }}</span>
                         <span class="badge bg-primary-transparent ms-2">
                           {{ getSubCategoryProgress(domain.id, category.id, sub.id).answered }}/{{ getSubCategoryProgress(domain.id, category.id, sub.id).total }}
                         </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Respondent Info Section -->
            <div class="p-3 bg-light border-top">
               <div class="d-flex align-items-center justify-content-between mb-2">
                  <h6 class="mb-0 fw-bold fs-11 text-uppercase text-muted">Data Responden</h6>
                  <button @click="emit('edit')" class="btn btn-sm btn-outline-primary py-0 px-2 fw-semibold fs-10">
                     <i class="ri-edit-line me-1"></i> Edit
                  </button>
               </div>
               <div class="respondent-summary-box p-2 bg-white rounded border border-light shadow-xs">
                  <div class="mb-1">
                     <div class="text-muted fs-10 text-uppercase fw-bold">Nama</div>
                     <div class="fs-11 fw-semibold text-primary text-truncate">{{ resikoStore.respondentProfile?.namaResponden || '-' }}</div>
                  </div>
                  <div class="mb-1">
                     <div class="text-muted fs-10 text-uppercase fw-bold">Jabatan</div>
                     <div class="fs-11 text-truncate">{{ resikoStore.respondentProfile?.jabatanResponden || '-' }}</div>
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
              <nav aria-label="breadcrumb">
                <ol class="breadcrumb mb-0">
                  <li class="breadcrumb-item fs-12 text-muted">Risk Survey</li>
                  <li class="breadcrumb-item fs-12 text-muted">{{ resikoStore.currentCategory?.name }}</li>
                  <li class="breadcrumb-item fs-12 active fw-bold text-primary">{{ resikoStore.currentSubCategory?.name }}</li>
                </ol>
              </nav>
              <button @click="emit('back')" class="btn btn-sm btn-success-light">
                <i class="ri-file-list-3-line me-1"></i> Lihat Ringkasan
              </button>
            </div>
            <div class="card-body">
               <div class="questions-list">
                  <QuestionCard
                    v-for="(question, index) in resikoStore.currentPageQuestions"
                    :key="question.id"
                    :question="question"
                    :questionNumber="((resikoStore.progress.currentPage - 1) * 5) + index + 1"
                    :answer="resikoStore.answers[question.id]?.index"
                    @update:answer="(idx) => handleAnswer(question.id, idx)"
                  />
               </div>

               <div class="navigation-footer mt-4 pt-3 border-top">
                 <div class="d-flex justify-content-between align-items-center">
                   <button class="btn btn-outline-primary" @click="goToPreviousPage" :disabled="resikoStore.progress.currentPage === 1 && resikoStore.progress.currentSubCategoryId === resikoData.domains[0].categories[0].subCategories[0].id">
                      <i class="ri-arrow-left-line me-1"></i> Sebelumnya
                   </button>
                   
                   <div class="d-flex gap-2">
                     <button class="btn btn-warning-light px-4" @click="handleSaveAction">
                        Simpan Sementara
                     </button>
                     <button v-if="resikoStore.progress.currentPage < resikoStore.totalPagesInSubCategory || resikoStore.currentCategory?.subCategories.indexOf(resikoStore.currentSubCategory) < resikoStore.currentCategory?.subCategories.length - 1" class="btn btn-primary px-4" @click="goToNextPage">
                        Lanjut <i class="ri-arrow-right-line ms-1"></i>
                     </button>
                     <button v-else-if="allQuestionsAnswered" class="btn btn-success px-4" @click="handleSaveAction">
                        Simpan dan Selesai <i class="ri-check-line ms-1"></i>
                     </button>
                   </div>
                 </div>
               </div>
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

.category-group {
  border-bottom: 1px solid var(--default-border);
}

.subcategory-link {
  padding: 0.6rem 1rem;
  transition: all 0.2s ease;
  font-size: 0.85rem;
  color: var(--default-text-color);
}

.subcategory-link:hover {
  background: var(--light);
}

.subcategory-link.active {
  background: var(--primary-01);
  color: var(--primary-color);
  font-weight: 600;
  border-left: 3px solid var(--primary-color);
}

.breadcrumb-item + .breadcrumb-item::before {
  content: "›";
}

.sticky-progress-row {
  position: sticky;
  top: 74px;
  z-index: 99;
  padding-bottom: 1.25rem;
  background: #f8fafc;
}

.progress-wrapper {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

.shadow-xs {
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}
</style>
