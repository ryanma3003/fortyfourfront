<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useDynamicAssessmentStore } from '@/stores/dynamic-assessment';
import { useIkasStore } from '@/stores/ikas';
import { useStakeholdersStore } from '@/stores/stakeholders';
import QuestionCard from '@/components/assessment/QuestionCard.vue';
import ProgressBar from '@/components/assessment/ProgressBar.vue';
import PaginationControl from '@/components/assessment/PaginationControl.vue';

import Swal from 'sweetalert2';
import { toast } from 'vue3-toastify';
import 'vue3-toastify/dist/index.css';

const route = useRoute();
const assessmentStore = useDynamicAssessmentStore();
const ikasStore = useIkasStore();
const stakeholdersStore = useStakeholdersStore();

const currentSlug = computed(() => String(route.query.slug || ''));

const props = withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false });

const emit = defineEmits<{
  (e: 'edit'): void;
  (e: 'back'): void;
}>();

// Sidebar collapsed state
const sidebarCollapsed = ref(false);

// Handle answer change
const parseTargetNilai = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value || '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeMeasurementDate = (tanggal: string | null | undefined, tahun: string | number | null | undefined): string => {
  const normalizedYear = String(tahun || '').match(/\d{4}/)?.[0] || String(new Date().getFullYear());
  const normalizedDate = String(tanggal || '').trim();
  if (normalizedDate && normalizedDate.startsWith(`${normalizedYear}-`)) {
    return normalizedDate;
  }
  if (!normalizedDate && normalizedYear === String(new Date().getFullYear())) {
    return new Date().toISOString().split('T')[0];
  }
  return `${normalizedYear}-01-01`;
};

const handleAnswer = async (questionId: string, index: number) => {
  await assessmentStore.saveAnswer(questionId, index);
};

// Check if domain is current
const isCurrentDomain = (domainId: string) => {
  return assessmentStore.progress.currentDomainId === domainId;
};

// Check if category is current
const isCurrentCategory = (domainId: string, categoryId: string) => {
  return assessmentStore.progress.currentDomainId === domainId &&
         assessmentStore.progress.currentCategoryId === categoryId;
};

// Get answered count for a category
const getCategoryProgress = (domainId: string, categoryId: string) => {
  const domain = assessmentStore.domains.find(d => d.id === domainId);
  const category = domain?.categories.find(c => c.id === categoryId);
  
  if (!category) return { answered: 0, total: 0 };

  const total = category.questions.length;
  const answered = category.questions.filter(q => 
    assessmentStore.getAnswer(q.id) !== undefined
  ).length;

  return { answered, total };
};

// Sidebar navigation - jump to specific category (page 1)
const jumpToCategory = (domainId: string, categoryId: string) => {
  assessmentStore.updateProgress(domainId, categoryId, 1);
};

// --- Computed Properties for Navigation & State ---

// Check if we are on the very last page of the entire assessment
const isLastPage = computed(() => {
    const totalPages = assessmentStore.totalPagesInCategory;
    const isLastPageInCat = assessmentStore.progress.currentPage === totalPages;
    
    const d = assessmentStore.currentDomain;
    const c = assessmentStore.currentCategory;
    
    if(!d || !c) return false;
    
    const domains = assessmentStore.domains;
    
    const isLastDom = d.id === domains[domains.length-1].id;
    const isLastCat = c.id === d.categories[d.categories.length-1].id;
    
    return isLastDom && isLastCat && isLastPageInCat;
});

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

const canGoNext = computed(() => {
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

const allQuestionsAnswered = computed(() => {
  return assessmentStore.answeredQuestions >= assessmentStore.totalQuestions && assessmentStore.totalQuestions > 0;
});

// Handle "Simpan Sementara" or "Simpan dan Selesai"
const handleSaveAction = async () => {
    const slug = currentSlug.value;
    const stakeholder = slug ? stakeholdersStore.getStakeholderBySlug(slug) : null;
    const profile = assessmentStore.respondentProfile;

    if (!stakeholder?.id || !profile) {
      toast.error('Data Form Responden tidak lengkap', {
        autoClose: 4000,
        position: 'top-right',
      });
      return;
    }

    const respondentPayload = {
      id_perusahaan: stakeholder.id,
      responden: profile.namaResponden || '',
      jabatan: profile.jabatanResponden || '',
      telepon: profile.nomorTelepon || '',
      tanggal: normalizeMeasurementDate(profile.tanggalPengisian, profile.tahunPengukuran),
      tahun_pengukuran: profile.tahunPengukuran,
      target_nilai: parseTargetNilai(profile.targetNilai),
    };

    if (allQuestionsAnswered.value) {
      try {
        const result = await ikasStore.submitToBackend(slug, respondentPayload);
        const answerSyncResult = await assessmentStore.syncPendingAnswersToBackend(slug);
        // Domain summary sync is disabled for this backend. Skip submitAllDomainScores.
        const domainResult = { success: true, errors: [], warnings: ['Domain summary sync disabled on client'] };

        const completed = result.success && answerSyncResult.success && assessmentStore.completeAssessment();

        if (completed) {
          toast.success('Assessment berhasil disimpan ke server', {
            icon: true,
            hideProgressBar: true,
            autoClose: 2000,
            position: 'top-right',
          });

          setTimeout(() => emit('back'), 1500);
        } else {
          const message = !result.success
            ? `Gagal menyimpan ke server: ${result.error || 'Server tidak merespon'}`
            : !answerSyncResult.success
              ? `Masih ada jawaban yang gagal disimpan: ${answerSyncResult.errors.length} item`
              : `Sebagian nilai domain gagal disimpan: ${domainResult.errors.join(', ')}`;

          toast.error(message, {
            autoClose: 4000,
            position: 'top-right',
          });
        }
      } catch (error) {
        console.error('[AssessmentView] Backend sync error:', error);
        toast.error('Terjadi kesalahan saat menghubungi server', {
          autoClose: 4000,
          position: 'top-right',
        });
      }
    } else {
      try {
        const result = await ikasStore.submitToBackend(slug, respondentPayload);
        const answerSyncResult = await assessmentStore.syncPendingAnswersToBackend(slug);
        // Skip domain summary sync — backend doesn't expose these endpoints.
        const domainResult = { success: true, errors: [], warnings: ['Domain summary sync disabled on client'] };

        if (result.success && answerSyncResult.success) {
          toast.info('Data berhasil disimpan sementara ke server', {
            theme: 'auto',
            icon: true,
            hideProgressBar: true,
            autoClose: 2000,
            position: 'top-right',
          });

          setTimeout(() => emit('back'), 1500);
          return;
        }

        const message = !result.success
          ? `Gagal menyimpan draft: ${result.error || 'Server tidak merespon'}`
          : !answerSyncResult.success
            ? `Sebagian jawaban draft belum tersimpan: ${answerSyncResult.errors.length} item`
            : `Nilai domain draft gagal tersimpan: ${domainResult.errors.join(', ')}`;

        toast.error(message, {
          autoClose: 4000,
          position: 'top-right',
        });
      } catch (error) {
        console.error('[AssessmentView] Draft save error:', error);
        toast.error('Terjadi kesalahan saat menyimpan sementara ke server', {
          autoClose: 4000,
          position: 'top-right',
        });
      }
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
  <div class="assessment-container" :class="{ 'assessment-container-embedded': embedded }">
  <div class="row sticky-progress-row">
    <div class="col-12">
      <div class="progress-wrapper">
        <ProgressBar
          :answered="assessmentStore.answeredQuestions"
          :total="assessmentStore.totalQuestions"
          :currentPage="assessmentStore.progress.currentPage"
          :totalPages="assessmentStore.totalPagesInCategory"
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
        
        <!-- Save Action Block -->
        <div v-if="!sidebarCollapsed" class="p-3 border-bottom bg-light">
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
            
          <div v-if="!assessmentStore.isLocked && !embedded" class="text-center mt-2">
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
              v-for="domain in assessmentStore.domains" 
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
                  <!-- Categories as Clickable Items -->
                  <div 
                    v-for="category in domain.categories" 
                    :key="category.id"
                    class="subcategory-item"
                    :class="{ 'active': isCurrentCategory(domain.id, category.id) }"
                    @click="jumpToCategory(domain.id, category.id)"
                  >
                    <div class="d-flex justify-content-between align-items-center">
                      <span class="subcategory-name">{{ category.name }}</span>
                      <span class="badge bg-secondary-transparent">
                        {{ getCategoryProgress(domain.id, category.id).answered }} / 
                        {{ getCategoryProgress(domain.id, category.id).total }}
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

    <!-- Main Content -->
    <div :class="sidebarCollapsed ? 'col-md-11' : 'col-md-9'">
      <div class="card custom-card">
        <div class="card-header d-flex justify-content-between align-items-center">
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
            
          <div v-if="assessmentStore.isLocked" class="alert alert-warning mb-4">
            <div class="d-flex align-items-center">
                <i class="ri-lock-2-line fs-24 me-3"></i>
                <div>
                    <h6 class="mb-1 fw-bold">Assessment Telah Selesai</h6>
                    <p class="mb-0 mb-2">Data telah dikunci. Klik tombol "Edit Data" di sidebar kiri jika Anda ingin mengubah jawaban.</p>
                </div>
            </div>
          </div>

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
              :readOnly="assessmentStore.isLocked"
              @answer="handleAnswer"
            />
          </div>
          <div v-else class="text-center py-5">
            <i class="ri-file-list-line fs-48 text-muted"></i>
            <p class="mt-3 text-muted">Tidak ada pertanyaan tersedia. Pastikan backend server menyala dan data terisi.</p>
            <div v-if="assessmentStore.error" class="alert alert-danger mt-3 mx-auto" style="max-width: 500px;">
              <i class="ri-error-warning-line me-2"></i> {{ assessmentStore.error }}
            </div>
            <div v-if="assessmentStore.domains.length === 0 && !assessmentStore.error" class="alert alert-info mt-3 mx-auto" style="max-width: 500px;">
              Debug: Data questionsList length from API was likely 0, or parsing failed.
              <hr>
              <strong>API Data Preview:</strong><br>
              <pre class="bg-dark text-light p-2 mt-2 rounded text-start" style="font-size: 11px;">{{ assessmentStore.rawJsonString || 'No data or empty JSON array []' }}</pre>
            </div>
          </div>

          <PaginationControl
            v-if="!assessmentStore.loading && assessmentStore.currentPageQuestions.length > 0"
            :currentPage="assessmentStore.progress.currentPage"
            :totalPages="assessmentStore.totalPagesInCategory"
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

.assessment-container-embedded .sticky-progress-row {
  position: static;
  top: auto;
  z-index: auto;
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
