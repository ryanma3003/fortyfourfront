<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAssessmentStore } from '@/stores/assessment';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { assessmentData } from '@/data/assessment/assessment-data';
import Pageheader from '@/shared/components/pageheader/pageheader.vue';
import QuestionCard from '@/components/assessment/QuestionCard.vue';
import ProgressBar from '@/components/assessment/ProgressBar.vue';
import PaginationControl from '@/components/assessment/PaginationControl.vue';
import type { AnswerIndex, RespondentProfile } from '@/types/assessment.types';

const router = useRouter();
const route = useRoute();
const assessmentStore = useAssessmentStore();
const stakeholdersStore = useStakeholdersStore();

// Get current stakeholder slug and source from route query
const currentSlug = computed(() => String(route.query.slug || ''));
const currentSource = computed(() => String(route.query.source || ''));

// Step management: 1 = Respondent Form, 2 = Assessment
const currentStep = ref(1);

// Sidebar collapsed state
const sidebarCollapsed = ref(false);

// Initialize stores
onMounted(async () => {
  assessmentStore.initialize();
  
  if (!stakeholdersStore.initialized) {
    await stakeholdersStore.initialize();
  }

  // Check if respondent profile exists, if yes skip to step 2
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

// ========== RESPONDENT FORM LOGIC ==========

// Dropdown options
const jenisSistemOptions = ['IT', 'OT', 'IT & OT'];
const sektorOptions = [
  'Administrasi Pemerintahan',
  'Energi dan Sumber Daya Mineral',
  'Transportasi',
  'Keamanan',
  'Kesehatan',
  'TIK',
  'Pangan',
  'Pertahanan',
  'Sektor Lain'
];
const targetLevelOptions = [
  { value: 1, label: 'Level 1 - Awal' },
  { value: 2, label: 'Level 2 - Berulang' },
  { value: 3, label: 'Level 3 - Terdefinisi' },
  { value: 4, label: 'Level 4 - Terkelola' },
  { value: 5, label: 'Level 5 - Inovatif' }
];

// Form state
const formData = reactive<Partial<RespondentProfile>>({
  instansi: currentStakeholder.value?.nama_perusahaan || '',
  namaSistem: '',
  jenisSistem: 'IT',
  sektor: 'Kesehatan',
  alamat: '',
  email: '',
  nomorTelepon: '',
  namaResponden: '',
  jabatanResponden: '',
  tahunPengukuran: new Date().getFullYear().toString(),
  targetLevel: 3,
  targetNilai: '2.51 - 3.50',
  acuanManajemenRisiko: '',
  acuanKeamananSiber: '',
  tanggalPengisian: new Date().toISOString().split('T')[0]
});

// Validation errors
const errors = reactive<Record<string, string>>({});

// Auto-save indicator
const saveIndicator = ref('');

// Load existing respondent profile
onMounted(() => {
  if (assessmentStore.respondentProfile) {
    Object.assign(formData, assessmentStore.respondentProfile);
  } else if (currentStakeholder.value) {
    // Pre-fill with stakeholder data
    formData.instansi = currentStakeholder.value.nama_perusahaan;
  }
});

// Validation rules
const validateField = (field: string, value: any): string => {
  switch (field) {
    case 'instansi':
      return value.trim() === '' ? 'Instansi wajib diisi' : '';
    case 'namaSistem':
      return value.trim() === '' ? 'Nama sistem wajib diisi' : '';
    case 'alamat':
      return value.trim() === '' ? 'Alamat wajib diisi' : '';
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value.trim() === '') return 'Email wajib diisi';
      if (!emailRegex.test(value)) return 'Format email tidak valid';
      return '';
    case 'nomorTelepon':
      const phoneRegex = /^[0-9+\-\s()]+$/;
      if (value.trim() === '') return 'Nomor telepon wajib diisi';
      if (!phoneRegex.test(value)) return 'Format nomor telepon tidak valid';
      return '';
    case 'namaResponden':
      return value.trim() === '' ? 'Nama responden wajib diisi' : '';
    case 'jabatanResponden':
      return value.trim() === '' ? 'Jabatan responden wajib diisi' : '';
    case 'tahunPengukuran':
      const year = parseInt(value);
      if (isNaN(year) || year < 2000 || year > 2100) return 'Tahun tidak valid';
      return '';
    case 'targetNilai':
      return value.trim() === '' ? 'Target nilai wajib diisi' : '';
    case 'acuanManajemenRisiko':
      return value.trim() === '' ? 'Acuan manajemen risiko wajib diisi' : '';
    case 'acuanKeamananSiber':
      return value.trim() === '' ? 'Acuan keamanan siber wajib diisi' : '';
    default:
      return '';
  }
};

// Validate all fields
const validateForm = (): boolean => {
  const newErrors: Record<string, string> = {};
  
  Object.keys(formData).forEach(key => {
    const error = validateField(key, (formData as any)[key]);
    if (error) {
      newErrors[key] = error;
    }
  });

  Object.assign(errors, newErrors);
  return Object.keys(newErrors).length === 0;
};

// Auto-save on field blur
const handleFieldBlur = (field: string) => {
  const error = validateField(field, (formData as any)[field]);
  errors[field] = error;

  // Auto-save if field is valid
  if (!error) {
    saveFormData();
  }
};

// Save form data to store
const saveFormData = () => {
  const profile: RespondentProfile = {
    instansi: formData.instansi || '',
    namaSistem: formData.namaSistem || '',
    jenisSistem: formData.jenisSistem || 'IT',
    sektor: formData.sektor || '',
    alamat: formData.alamat || '',
    email: formData.email || '',
    nomorTelepon: formData.nomorTelepon || '',
    namaResponden: formData.namaResponden || '',
    jabatanResponden: formData.jabatanResponden || '',
    tahunPengukuran: formData.tahunPengukuran || '',
    targetLevel: formData.targetLevel || 3,
    targetNilai: formData.targetNilai || '',
    acuanManajemenRisiko: formData.acuanManajemenRisiko || '',
    acuanKeamananSiber: formData.acuanKeamananSiber || '',
    tanggalPengisian: formData.tanggalPengisian || '',
    createdAt: formData.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  assessmentStore.saveRespondentProfile(profile);
  saveIndicator.value = '✓ Disimpan otomatis';
  
  setTimeout(() => {
    saveIndicator.value = '';
  }, 3000);
};

// Check if form is valid
const isFormValid = computed(() => {
  return Object.keys(formData).every(key => {
    const value = (formData as any)[key];
    const error = validateField(key, value);
    return error === '';
  });
});

// Start assessment (move to step 2)
const startAssessment = () => {
  if (validateForm()) {
    saveFormData();
    currentStep.value = 2;
  }
};

// ========== ASSESSMENT LOGIC ==========

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
  const isFirstDomain = assessmentData.domains[0].id === assessmentStore.progress.currentDomainId;
  const domain = assessmentStore.currentDomain;
  const isFirstCategory = domain?.categories[0].id === assessmentStore.progress.currentCategoryId;
  const category = assessmentStore.currentCategory;
  const isFirstSubCategory = category?.subCategories[0].id === assessmentStore.progress.currentSubCategoryId;
  const isFirstPage = assessmentStore.progress.currentPage === 1;

  return !(isFirstDomain && isFirstCategory && isFirstSubCategory && isFirstPage);
});

const canGoNext = computed(() => {
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

// Back to IKAS summary
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

    <!-- STEP 1: Respondent Form -->
    <div v-if="currentStep === 1" class="row">
      <div class="col-12">
        <div class="card custom-card">
          <div class="card-header">
            <div class="card-title">
              <i class="ri-file-list-3-line me-2"></i>
              Data Responden
              <span v-if="currentStakeholder" class="ms-2 text-muted fs-14">
                - {{ currentStakeholder.nama_perusahaan }}
              </span>
            </div>
          </div>
          <div class="card-body">
            <!-- Save Indicator -->
            <div v-if="saveIndicator" class="alert alert-success py-2 mb-3">
              <i class="ri-check-line me-1"></i>
              {{ saveIndicator }}
            </div>

            <!-- Form -->
            <form @submit.prevent="startAssessment">
              <div class="row">
                <!-- Instansi -->
                <div class="col-md-6 mb-3">
                  <label class="form-label">Instansi / Penyelenggara Sistem Elektronik <span class="text-danger">*</span></label>
                  <input 
                    type="text" 
                    class="form-control" 
                    :class="{ 'is-invalid': errors.instansi }"
                    v-model="formData.instansi"
                    @blur="handleFieldBlur('instansi')"
                    placeholder="Contoh: Kementerian XYZ"
                  />
                  <div v-if="errors.instansi" class="invalid-feedback">{{ errors.instansi }}</div>
                </div>

                <!-- Nama Sistem -->
                <div class="col-md-6 mb-3">
                  <label class="form-label">Nama Sistem Elektronik <span class="text-danger">*</span></label>
                  <input 
                    type="text" 
                    class="form-control"
                    :class="{ 'is-invalid': errors.namaSistem }"
                    v-model="formData.namaSistem"
                    @blur="handleFieldBlur('namaSistem')"
                    placeholder="Contoh: Sistem Informasi ABC"
                  />
                  <div v-if="errors.namaSistem" class="invalid-feedback">{{ errors.namaSistem }}</div>
                </div>

                <!-- Jenis Sistem -->
                <div class="col-md-6 mb-3">
                  <label class="form-label">Jenis Sistem Elektronik <span class="text-danger">*</span></label>
                  <select 
                    class="form-select"
                    v-model="formData.jenisSistem"
                    @change="handleFieldBlur('jenisSistem')"
                  >
                    <option v-for="option in jenisSistemOptions" :key="option" :value="option">
                      {{ option }}
                    </option>
                  </select>
                </div>

                <!-- Sektor -->
                <div class="col-md-6 mb-3">
                  <label class="form-label">Sektor <span class="text-danger">*</span></label>
                  <select 
                    class="form-select"
                    v-model="formData.sektor"
                    @change="handleFieldBlur('sektor')"
                  >
                    <option v-for="option in sektorOptions" :key="option" :value="option">
                      {{ option }}
                    </option>
                  </select>
                </div>

                <!-- Alamat -->
                <div class="col-12 mb-3">
                  <label class="form-label">Alamat <span class="text-danger">*</span></label>
                  <textarea 
                    class="form-control"
                    :class="{ 'is-invalid': errors.alamat }"
                    v-model="formData.alamat"
                    @blur="handleFieldBlur('alamat')"
                    rows="2"
                    placeholder="Alamat lengkap instansi"
                  ></textarea>
                  <div v-if="errors.alamat" class="invalid-feedback">{{ errors.alamat }}</div>
                </div>

                <!-- Email -->
                <div class="col-md-6 mb-3">
                  <label class="form-label">Alamat Surel (Email) <span class="text-danger">*</span></label>
                  <input 
                    type="email" 
                    class="form-control"
                    :class="{ 'is-invalid': errors.email }"
                    v-model="formData.email"
                    @blur="handleFieldBlur('email')"
                    placeholder="email@example.com"
                  />
                  <div v-if="errors.email" class="invalid-feedback">{{ errors.email }}</div>
                </div>

                <!-- Nomor Telepon -->
                <div class="col-md-6 mb-3">
                  <label class="form-label">Nomor Telepon <span class="text-danger">*</span></label>
                  <input 
                    type="tel" 
                    class="form-control"
                    :class="{ 'is-invalid': errors.nomorTelepon }"
                    v-model="formData.nomorTelepon"
                    @blur="handleFieldBlur('nomorTelepon')"
                    placeholder="Contoh: 021-12345678"
                  />
                  <div v-if="errors.nomorTelepon" class="invalid-feedback">{{ errors.nomorTelepon }}</div>
                </div>

                <!-- Nama Responden -->
                <div class="col-md-6 mb-3">
                  <label class="form-label">Nama Responden <span class="text-danger">*</span></label>
                  <input 
                    type="text" 
                    class="form-control"
                    :class="{ 'is-invalid': errors.namaResponden }"
                    v-model="formData.namaResponden"
                    @blur="handleFieldBlur('namaResponden')"
                    placeholder="Nama lengkap responden"
                  />
                  <div v-if="errors.namaResponden" class="invalid-feedback">{{ errors.namaResponden }}</div>
                </div>

                <!-- Jabatan Responden -->
                <div class="col-md-6 mb-3">
                  <label class="form-label">Jabatan Responden <span class="text-danger">*</span></label>
                  <input 
                    type="text" 
                    class="form-control"
                    :class="{ 'is-invalid': errors.jabatanResponden }"
                    v-model="formData.jabatanResponden"
                    @blur="handleFieldBlur('jabatanResponden')"
                    placeholder="Contoh: Manager IT"
                  />
                  <div v-if="errors.jabatanResponden" class="invalid-feedback">{{ errors.jabatanResponden }}</div>
                </div>

                <!-- Tahun Pengukuran -->
                <div class="col-md-4 mb-3">
                  <label class="form-label">Tahun Pengukuran <span class="text-danger">*</span></label>
                  <input 
                    type="number" 
                    class="form-control"
                    :class="{ 'is-invalid': errors.tahunPengukuran }"
                    v-model="formData.tahunPengukuran"
                    @blur="handleFieldBlur('tahunPengukuran')"
                    min="2000"
                    max="2100"
                  />
                  <div v-if="errors.tahunPengukuran" class="invalid-feedback">{{ errors.tahunPengukuran }}</div>
                </div>

                <!-- Target Level -->
                <div class="col-md-4 mb-3">
                  <label class="form-label">Target Level Kematangan <span class="text-danger">*</span></label>
                  <select 
                    class="form-select"
                    v-model.number="formData.targetLevel"
                    @change="handleFieldBlur('targetLevel')"
                  >
                    <option v-for="option in targetLevelOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>

                <!-- Target Nilai -->
                <div class="col-md-4 mb-3">
                  <label class="form-label">Target Nilai <span class="text-danger">*</span></label>
                  <input 
                    type="text" 
                    class="form-control"
                    :class="{ 'is-invalid': errors.targetNilai }"
                    v-model="formData.targetNilai"
                    @blur="handleFieldBlur('targetNilai')"
                    placeholder="Contoh: 2.51 - 3.50"
                  />
                  <div v-if="errors.targetNilai" class="invalid-feedback">{{ errors.targetNilai }}</div>
                </div>

                <!-- Acuan Manajemen Risiko -->
                <div class="col-md-6 mb-3">
                  <label class="form-label">Acuan Manajemen Risiko yang Digunakan <span class="text-danger">*</span></label>
                  <input 
                    type="text" 
                    class="form-control"
                    :class="{ 'is-invalid': errors.acuanManajemenRisiko }"
                    v-model="formData.acuanManajemenRisiko"
                    @blur="handleFieldBlur('acuanManajemenRisiko')"
                    placeholder="Contoh: ISO 27005, NIST RMF"
                  />
                  <div v-if="errors.acuanManajemenRisiko" class="invalid-feedback">{{ errors.acuanManajemenRisiko }}</div>
                </div>

                <!-- Acuan Keamanan Siber -->
                <div class="col-md-6 mb-3">
                  <label class="form-label">Acuan Keamanan Siber yang Digunakan <span class="text-danger">*</span></label>
                  <input 
                    type="text" 
                    class="form-control"
                    :class="{ 'is-invalid': errors.acuanKeamananSiber }"
                    v-model="formData.acuanKeamananSiber"
                    @blur="handleFieldBlur('acuanKeamananSiber')"
                    placeholder="Contoh: ISO 27001, NIST CSF"
                  />
                  <div v-if="errors.acuanKeamananSiber" class="invalid-feedback">{{ errors.acuanKeamananSiber }}</div>
                </div>

                <!-- Tanggal Pengisian -->
                <div class="col-md-6 mb-3">
                  <label class="form-label">Tanggal Pengisian <span class="text-danger">*</span></label>
                  <input 
                    type="date" 
                    class="form-control"
                    v-model="formData.tanggalPengisian"
                    @change="handleFieldBlur('tanggalPengisian')"
                  />
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="d-flex justify-content-end gap-2 mt-4">
                <button 
                  type="button" 
                  class="btn btn-light"
                  @click="backToIkas"
                >
                  <i class="ri-arrow-left-line me-1"></i>
                  Kembali ke Ringkasan
                </button>
                <button 
                  type="submit" 
                  class="btn btn-primary"
                  :disabled="!isFormValid"
                >
                  Lanjut ke Penilaian
                  <i class="ri-arrow-right-line ms-1"></i>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- STEP 2: Assessment Interface -->
    <template v-else-if="currentStep === 2">
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
                  @click="currentStep = 1" 
                  class="btn btn-sm btn-light"
                  title="Edit Data Responden"
                >
                  <i class="ri-edit-line me-1"></i>
                  Edit Data
                </button>
                <button 
                  @click="backToIkas" 
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

/* Assessment Styles */
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

.form-label {
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.text-danger {
  color: var(--danger) !important;
}
</style>
