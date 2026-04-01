<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { stakeholdersData } from '../data/dummydata';
import { kseCategories } from '../data/kse-data';
import { useKseStore } from '../stores/kse';
import { csirtService } from '../services/csirt.service';
import Pageheader from '../shared/components/pageheader/pageheader.vue';

import { toast } from 'vue3-toastify';
import 'vue3-toastify/dist/index.css';

// Components
import KseQuestionCard from './kse/KseQuestionCard.vue';
import ProgressBar from './assessment/ProgressBar.vue';

const router = useRouter();
const route = useRoute();
const kseStore = useKseStore();

// When used inside kse-crud.vue stepper, embedded=true hides the Pageheader
// and uses emit events instead of router.push for navigation
const props = withDefaults(defineProps<{ embedded?: boolean; slug?: string; seId?: string }>(), { embedded: false, slug: '', seId: '' });
const emit = defineEmits<{ (e: 'back'): void; (e: 'edit'): void; }>();

const currentSlug = computed(() => props.slug || String(route.query.slug || ''));
const currentSource = computed(() => String(route.query.source || ''));
const stakeholderSlug = computed(() => String(route.query.stakeholder || '') || currentSlug.value);

// Navigation state
const currentCategoryId = ref<string>(kseCategories[0].id);
const currentPage = ref(1);
const displayMode = ref<'grid' | 'list'>('grid');
const uiSize = ref<'small' | 'medium' | 'large'>('medium');

const displayModeIcon = computed(() => {
  switch (displayMode.value) {
    case 'list': return 'ri-list-check';
    default: return 'ri-grid-fill';
  }
});

// Initialize store
onMounted(async () => {
  kseStore.initialize();
  
  // Update stakeholder info if we have a slug
  if (currentSlug.value && currentStakeholder.value) {
    kseStore.updateStakeholderInfo(
      currentSlug.value,
      currentStakeholder.value.nama_perusahaan || '',
      currentStakeholder.value.sub_sektor?.nama_sub_sektor || currentStakeholder.value.sektor || ''
    );
  }

  // Load penilaian answers from API if we have an seId
  // (Only do this if NOT embedded, because kse-crud handles it and we don't want to re-lock an unlocked form on step navigation)
  if (!props.embedded) {
    const resolvedSeId = props.seId || '';
    if (resolvedSeId) {
      try {
        const se = await csirtService.getSeById(resolvedSeId);
        if (se) {
          kseStore.loadAnswersFromApi(currentSlug.value, se);
        }
      } catch (e) {
        console.warn('KSE: Failed to load penilaian from API:', e);
      }
    } else {
      // Fallback: try localStorage for seId (legacy / Tambah SE flow)
      const profileKey = `kse_respondent_${currentSlug.value}`;
      try {
        const profileRaw = localStorage.getItem(profileKey);
        if (profileRaw) {
          const profile = JSON.parse(profileRaw);
          if (profile?.seId) {
            const se = await csirtService.getSeById(profile.seId);
            if (se) {
              kseStore.loadAnswersFromApi(currentSlug.value, se);
            }
          }
        }
      } catch (e) {
        console.warn('KSE: Failed to load penilaian from API:', e);
      }
    }
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

// --- Gauge & Theme Logic ---

const maxScore = 50; // Approximated max score based on criteria (Strategis > 35)

const scorePercentage = computed(() => {
    const score = kseData.value?.totalBobot || 0;
    // Cap at 100% just in case
    return Math.min(Math.round((score / maxScore) * 100), 100);
});

const themeColor = computed(() => {
    const category = (kseData.value?.kategoriSE || '').toLowerCase();
    if (category.includes('strategis')) return '#e63946'; // Red
    if (category.includes('tinggi')) return '#fb8500';   // Orange
    if (category.includes('rendah')) return '#2a9d8f';   // Teal
    return '#94a3b8'; // Slate/Gray
});

const gaugeStyle = computed(() => {
    const percent = scorePercentage.value;
    const color = themeColor.value;
    return {
        background: `conic-gradient(${color} ${percent}%, #f1f5f9 0deg)`
    };
});

const categoryLabel = computed(() => {
     return kseData.value?.kategoriSE || 'Belum Dikategorikan';
});

// --- End Gauge Logic ---

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
  return category?.questions || [];
});

const totalPagesInCategory = computed(() => 1);

// Progress Logic
const totalQuestions = computed(() => {
  let count = 0;
  kseCategories.forEach(cat => count += cat.questions.length);
  return count;
});

const answeredQuestionsCount = computed(() => {
  const data = kseData.value;
  if (!data?.answers) return 0;
  return Object.values(data.answers).filter(a => a.selectedOption !== null && a.selectedOption !== undefined).length;
});

const isAllAnswered = computed(() => {
    return answeredQuestionsCount.value === totalQuestions.value;
});

// Handle option selection
const handleAnswer = (questionNo: string, optionKey: 'A' | 'B' | 'C', bobot: number) => {
  const slug = currentSlug.value || 'default';
  kseStore.updateAnswer(slug, questionNo, optionKey, bobot);
};

// Navigation Handlers
// Navigation logic removed as buttons are no longer present



// Lock state
const viewOnly  = computed(() => route.query.mode === 'view');
const isLocked  = computed(() => viewOnly.value || !!kseData.value?.isSubmitted);

// Save and Exit
const saveAndExit = async () => {
    const slug = currentSlug.value || 'default';

    // ── Map question numbers to SE enum field names ──────────────────────────
    const questionToField: Record<string, string> = {
      '1.1': 'nilai_investasi',
      '1.2': 'anggaran_operasional',
      '1.3': 'kepatuhan_peraturan',
      '1.4': 'teknik_kriptografi',
      '1.5': 'jumlah_pengguna',
      '1.6': 'data_pribadi',
      '1.7': 'klasifikasi_data',
      '1.8': 'kekritisan_proses',
      '1.9': 'dampak_kegagalan',
      '1.10': 'potensi_kerugian_dan_dampak_negatif',
    };

    if (isAllAnswered.value) {
        // Simpan & Selesai (Lock Data)
        kseStore.submitData(slug);

        // ── Sync KSE answers to SE API ────────────────────────────────────────
        try {
          const profileRaw = localStorage.getItem(`kse_respondent_${slug}`);
          if (profileRaw) {
            const profile = JSON.parse(profileRaw);

            // Build penilaian payload from answers
            const answers = kseStore.getKseData(slug).answers;
            const penilaianPayload: Record<string, string> = {};
            Object.entries(answers).forEach(([qNo, ans]) => {
              const field = questionToField[qNo];
              if (field && ans.selectedOption) {
                penilaianPayload[field] = ans.selectedOption;
              }
            });
            const kategoriSE = kseStore.getKseData(slug).kategoriSE;

            if (profile?.fromCsirt && !profile?.seId) {
              // First time: create the SE with all fields at once
              const created = await csirtService.createSe({
                id_csirt      : profile.id_csirt,
                id_perusahaan : profile.id_perusahaan,
                id_sub_sektor : profile.id_sub_sektor,
                nama_se       : profile.namaSistem,
                ip_se         : profile.ip_se       || '',
                as_number_se  : profile.as_number_se || '',
                pengelola_se  : profile.pengelola_se || '',
                fitur_se      : profile.fitur_se     || '',
                kategori_se   : kategoriSE,
                ...penilaianPayload,
              });
              // Persist seId so subsequent edits use updateSe
              const updated = { ...profile, seId: created.id, fromCsirt: false };
              localStorage.setItem(`kse_respondent_${slug}`, JSON.stringify(updated));
              // Also update kse_list entry with seId
              const listKey = `kse_list_${stakeholderSlug.value}`;
              try {
                const list = JSON.parse(localStorage.getItem(listKey) || '[]');
                const idx = list.findIndex((e: any) => e.id === slug);
                if (idx !== -1) { list[idx].seId = created.id; localStorage.setItem(listKey, JSON.stringify(list)); }
              } catch {}
            } else if (profile?.seId) {
              // Already created: patch both respondent fields and penilaian fields
              await csirtService.updateSe(profile.seId, {
                id_csirt      : profile.id_csirt,
                nama_se       : profile.namaSistem,
                ip_se         : profile.ip_se       || '',
                as_number_se  : profile.as_number_se || '',
                pengelola_se  : profile.pengelola_se || '',
                fitur_se      : profile.fitur_se     || '',
                kategori_se   : kategoriSE,
                ...penilaianPayload
              });
            }
          }
        } catch (e) {
          console.warn('KSE → SE sync failed:', e);
        }

        toast.success('Assessment berhasil diselesaikan dan disimpan', {
            theme: 'auto',
            icon: true,
            hideProgressBar: true,
            autoClose: 2000,
            position: 'top-right',
        });
    } else {
        // Simpan Sementara (Do NOT Lock)
        // Data is already saved to local storage via watchers/updates, 
        // effectively we just notify and exit.
        
        toast.info('Data berhasil disimpan sementara', {
            theme: 'auto',
            icon: true,
            hideProgressBar: true,
            autoClose: 2000,
            position: 'top-right',
        });
    }
  
  // Navigate back after delay
  setTimeout(() => {
    if (props.embedded) {
      emit('back');
      return;
    }
    // Navigate to kse
    if (stakeholderSlug.value) {
      router.push({ path: '/kse', query: { slug: stakeholderSlug.value } });
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
    if (props.embedded) {
        emit('edit');
    }
};
</script>

<template>
  <div class="kse-container">
    <Pageheader v-if="!embedded" :propData="dataToPass" />

    <!-- Progress Bar -->
    <div class="row sticky-progress-row">
      <div class="col-12">
        <div class="progress-wrapper">
            <ProgressBar
              :answered="answeredQuestionsCount"
              :total="totalQuestions"
              :currentPage="currentPage"
              :totalPages="totalPagesInCategory"
              title="Kategorisasi SE"
            />
        </div>
      </div>
    </div>

    <div class="row g-4">
      <!-- Sidebar -->
      <div class="col-12 col-md-4 col-lg-3">
        <div class="sticky-sidebar">
          
          <!-- Score Card -->
          <div class="sidebar-card gauge-card">
            <div class="sidebar-card-accent" :style="{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}88)` }"></div>
            <div class="sidebar-card-body">
              <div class="gauge-label">
                <i class="ri-bar-chart-box-line"></i>
                Hasil Penilaian
              </div>
              
              <!-- Circular Gauge -->
              <div class="gauge-ring" :style="gaugeStyle">
                <div class="gauge-ring-inner">
                  <span class="gauge-score">{{ kseData?.totalBobot || 0 }}</span>
                  <span class="gauge-score-label">Skor</span>
                </div>
              </div>

              <!-- Status -->
              <div class="gauge-status">
                <span class="gauge-status-sublabel">Status Sistem Elektronik</span>
                <span class="gauge-status-value" :style="{ color: themeColor }">{{ categoryLabel }}</span>
              </div>
            </div>
          </div>

          <!-- Action Card -->
          <div class="sidebar-card action-card">
            <!-- Non-Embedded Mode -->
            <template v-if="!embedded">
              <button 
                v-if="!isLocked"
                @click="saveAndExit" 
                class="action-btn"
                :class="isAllAnswered ? 'action-btn-success' : 'action-btn-warning'"
              >
                <i :class="isAllAnswered ? 'ri-checkbox-circle-line' : 'ri-save-3-line'"></i> 
                <span>{{ isAllAnswered ? 'Simpan &amp; Selesai' : 'Simpan Sementara' }}</span>
              </button>
              <button 
                v-else-if="!viewOnly"
                @click="editData" 
                class="action-btn action-btn-edit"
              >
                <i class="ri-edit-2-line"></i>
                <span>Edit Data</span>
              </button>
              <div v-else class="action-btn action-btn-info" style="justify-content:center;cursor:default;">
                <i class="ri-eye-line"></i>
                <span>Mode Lihat Saja</span>
              </div>
            </template>

            <!-- Embedded Mode: Show Both Buttons -->
            <template v-else>
              <template v-if="viewOnly">
                <div class="action-btn action-btn-info" style="justify-content:center;cursor:default;">
                  <i class="ri-eye-line"></i>
                  <span>Mode Lihat Saja</span>
                </div>
              </template>
              <template v-else-if="!isLocked">
                <button 
                  @click="saveAndExit" 
                  class="action-btn mb-3"
                  :class="isAllAnswered ? 'action-btn-success' : 'action-btn-warning'"
                >
                  <i :class="isAllAnswered ? 'ri-checkbox-circle-line' : 'ri-save-3-line'"></i> 
                  <span>{{ isAllAnswered ? 'Simpan &amp; Selesai' : 'Simpan Sementara' }}</span>
                </button>
                <button 
                  @click="editData" 
                  class="action-btn action-btn-edit bg-primary"
                >
                  <i class="ri-edit-2-line"></i>
                  <span>Edit Data Responden</span>
                </button>
              </template>
              <button 
                v-else
                @click="editData" 
                class="action-btn action-btn-edit bg-warning"
              >
                <i class="ri-edit-2-line"></i>
                <span>Edit Data</span>
              </button>
            </template>
          </div> 
          <!-- Criteria Card -->
          <div class="sidebar-card criteria-card">
            <div class="criteria-header">
              <i class="ri-scales-3-line"></i>
              Ketentuan Penilaian
            </div>
            <div class="criteria-list">
              <div class="criteria-row">
                <div class="criteria-dot-group">
                  <span class="criteria-dot" style="background: #e63946;"></span>
                  <span class="criteria-name">Strategis</span>
                </div>
                <span class="criteria-badge" style="background: rgba(230,57,70,0.08); color: #e63946;">35 – 50</span>
              </div>
              <div class="criteria-row">
                <div class="criteria-dot-group">
                  <span class="criteria-dot" style="background: #fb8500;"></span>
                  <span class="criteria-name">Tinggi</span>
                </div>
                <span class="criteria-badge" style="background: rgba(251,133,0,0.08); color: #fb8500;">16 – 34</span>
              </div>
              <div class="criteria-row criteria-row-last">
                <div class="criteria-dot-group">
                  <span class="criteria-dot" style="background: #2a9d8f;"></span>
                  <span class="criteria-name">Rendah</span>
                </div>
                <span class="criteria-badge" style="background: rgba(42,157,143,0.08); color: #2a9d8f;">10 – 15</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="col-12 col-md-8 col-lg-9">
        <div class="main-content-card">
          <div class="main-content-header d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3">
            <div class="main-header-title-row">
              <div class="main-header-icon">
                <i class="ri-file-list-3-line"></i>
              </div>
              <div>
                <h5 class="main-header-title">{{ currentCategory.title }}</h5>
                <p class="main-header-subtitle">Silakan lengkapi pertanyaan di bawah ini sesuai kondisi instansi.</p>
              </div>
            </div>

            <!-- Display Mode Switcher -->
            <div class="display-mode-switcher d-flex align-items-center gap-2">
                <!-- Layout Selector -->
                <div class="dropdown me-1 d-none d-xxl-block">
                    <button class="btn btn-light btn-sm d-flex align-items-center gap-2 px-3 rounded-pill border shadow-sm" type="button" data-bs-toggle="dropdown">
                        <i :class="displayModeIcon" class="fs-14"></i>
                        <span class="fs-12 fw-bold text-uppercase ls-1">Tampilan</span>
                        <i class="ri-arrow-down-s-line fs-12 opacity-50"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow-lg border-0 p-2 rounded-3 animate__animated animate__fadeIn">
                        <li>
                            <a class="dropdown-item rounded-2 d-flex align-items-center justify-content-between py-2" 
                               :class="{ 'active': displayMode === 'grid' }"
                               href="javascript:void(0);" @click="displayMode = 'grid'">
                                <div class="d-flex align-items-center gap-2">
                                    <i class="ri-grid-fill fs-16"></i> 
                                    <span class="fs-13">Grid View</span>
                                </div>
                                <i v-if="displayMode === 'grid'" class="ri-check-line fs-14"></i>
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item rounded-2 d-flex align-items-center justify-content-between py-2" 
                               :class="{ 'active': displayMode === 'list' }"
                               href="javascript:void(0);" @click="displayMode = 'list'">
                                <div class="d-flex align-items-center gap-2">
                                    <i class="ri-list-check fs-16"></i> 
                                    <span class="fs-13">List View</span>
                                </div>
                                <i v-if="displayMode === 'list'" class="ri-check-line fs-14"></i>
                            </a>
                        </li>
                    </ul>
                </div>

                <!-- Size Settings Selector -->
                <div class="dropdown">
                    <button class="btn btn-light btn-sm d-flex align-items-center gap-1 px-2 px-sm-3 rounded-pill border shadow-sm" type="button" data-bs-toggle="dropdown">
                        <i class="ri-equalizer-line fs-13"></i>
                        <span class="fs-11 fs-sm-12 fw-bold text-uppercase ls-1">Ukuran</span>
                        <i class="ri-arrow-down-s-line fs-12 opacity-50"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow-lg border-0 p-2 rounded-3 animate__animated animate__fadeIn" style="min-width: 180px;">
                        <li>
                            <a class="dropdown-item rounded-2 d-flex align-items-center justify-content-between py-2" 
                               :class="{ 'active': uiSize === 'small' }"
                               href="javascript:void(0);" @click="uiSize = 'small'">
                                <div class="d-flex align-items-center gap-2">
                                    <i class="ri-font-size-2" style="font-size: 14px;"></i> 
                                    <span class="fs-13">Ukuran Kecil</span>
                                </div>
                                <i v-if="uiSize === 'small'" class="ri-check-line fs-14"></i>
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item rounded-2 d-flex align-items-center justify-content-between py-2" 
                               :class="{ 'active': uiSize === 'medium' }"
                               href="javascript:void(0);" @click="uiSize = 'medium'">
                                <div class="d-flex align-items-center gap-2">
                                    <i class="ri-font-size-2" style="font-size: 16px;"></i> 
                                    <span class="fs-13">Ukuran Normal</span>
                                </div>
                                <i v-if="uiSize === 'medium'" class="ri-check-line fs-14"></i>
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item rounded-2 d-flex align-items-center justify-content-between py-2" 
                               :class="{ 'active': uiSize === 'large' }"
                               href="javascript:void(0);" @click="uiSize = 'large'">
                                <div class="d-flex align-items-center gap-2">
                                    <i class="ri-font-size-2" style="font-size: 18px;"></i> 
                                    <span class="fs-13">Ukuran Besar</span>
                                </div>
                                <i v-if="uiSize === 'large'" class="ri-check-line fs-14"></i>
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
          </div>

          <div class="main-content-body">
            <transition-group 
              name="fade-list" 
              tag="div" 
              class="row g-4"
            >
              <div 
                v-for="question in currentQuestions" 
                :key="question.no"
                :class="displayMode === 'list' ? 'col-12' : 'col-12 col-xxl-6'"
              >
                <KseQuestionCard 
                  :question="question" 
                  :displayMode="displayMode"
                  :fontSize="uiSize"
                  :iconSize="uiSize"
                  :selectedOption="kseData?.answers?.[question.no]?.selectedOption"
                  :readonly="isLocked"
                  @answer="handleAnswer"
                />
              </div>
            </transition-group>

            <!-- Removed category navigation buttons as requested -->
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ========== PAGE ========== */
.kse-container {
  min-height: 100vh;
  padding-bottom: 3rem;
  font-family: 'Inter', -apple-system, sans-serif;
}

/* ========== PROGRESS WRAPPER ========== */
.sticky-progress-row {
  position: sticky;
  top: 74px;
  z-index: 99;
  margin-top: -10px;
  padding-bottom: 1.25rem;
  margin-bottom: 1rem; /* Add spacing to prevent overlap */
}

.progress-wrapper {
  /* Let the child component (ProgressBar) handle the card styling */
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

/* ========== SIDEBAR ========== */
.sticky-sidebar {
  position: sticky;
  top: 240px;
  z-index: 9;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Shared sidebar card */
.sidebar-card {
  background: white;
  border-radius: 20px;
  border: 1px solid rgba(226, 232, 240, 0.5);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.03),
    0 4px 16px -2px rgba(0, 0, 0, 0.06);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  overflow: hidden;
  position: relative;
}

.sidebar-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.04),
    0 12px 32px -4px rgba(0, 0, 0, 0.1);
}

/* ========== GAUGE CARD ========== */
.sidebar-card-accent {
  height: 4px;
  width: 100%;
  border-radius: 20px 20px 0 0;
}

.sidebar-card-body {
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.gauge-label {
  text-transform: uppercase;
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.12em;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.gauge-label i {
  font-size: 14px;
  opacity: 0.7;
}

.gauge-ring {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  position: relative;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.06),
    inset 0 0 0 2px rgba(241, 245, 249, 0.8);
}

.gauge-ring-inner {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  background: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
  z-index: 2;
}

.gauge-score {
  font-size: 36px;
  font-weight: 800;
  color: #1e293b;
  line-height: 1;
  letter-spacing: -0.03em;
}

.gauge-score-label {
  font-size: 10px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top: 4px;
}

.gauge-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gauge-status-sublabel {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 500;
}

.gauge-status-value {
  font-size: 18px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: -0.01em;
  transition: color 0.4s ease;
}

/* ========== ACTION CARD ========== */
.action-card {
  padding: 14px;
}

.action-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  min-height: 48px;
  border-radius: 14px;
  border: none;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.action-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, transparent 50%);
  pointer-events: none;
}

.action-btn-success {
  background: linear-gradient(135deg, #2ecc71, #27ae60);
  color: white;
  box-shadow: 0 4px 14px -2px rgba(46, 204, 113, 0.4);
}

.action-btn-success:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px -2px rgba(46, 204, 113, 0.5);
}

.action-btn-warning {
  background: linear-gradient(135deg, #ffb142, #f79f1f);
  color: white;
  box-shadow: 0 4px 14px -2px rgba(255, 177, 66, 0.4);
}

.action-btn-warning:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px -2px rgba(255, 177, 66, 0.5);
}

.action-btn-edit {
  background: white;
  color: #f59e0b;
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.12);
}

.action-btn-edit:hover {
  background: #fffbeb;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(251, 191, 36, 0.2);
}

/* ========== CRITERIA CARD ========== */
.criteria-header {
  padding: 18px 20px 0;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 8px;
}

.criteria-header i {
  font-size: 16px;
  color: #94a3b8;
}

.criteria-list {
  padding: 16px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.criteria-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px solid #f1f5f9;
}

.criteria-row-last {
  padding-bottom: 0;
  border-bottom: none;
}

.criteria-dot-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.criteria-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  box-shadow: 0 0 0 2px rgba(0,0,0,0.04);
}

.criteria-name {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.criteria-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 8px;
  letter-spacing: 0.02em;
}

/* ========== MAIN CONTENT ========== */
.main-content-card {
  background: white;
  border-radius: 20px;
  border: 1px solid rgba(226, 232, 240, 0.5);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.03),
    0 4px 16px -2px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  min-height: 400px;
}

.main-content-header {
  padding: 24px 28px 16px;
  background: white;
}
@media (max-width: 576px) {
  .main-content-header {
    padding: 16px 16px 12px;
  }
}

.main-header-title-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.main-header-icon {
  width: 44px;
  height: 44px;
  min-width: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  box-shadow: 0 4px 12px -2px rgba(99, 102, 241, 0.35);
}

.main-header-title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 4px;
}

.main-header-subtitle {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
  font-weight: 500;
}

.main-content-body {
  padding: 20px 28px 28px;
  background: #fafbfd;
  border-top: 1px solid #f1f5f9;
}
@media (max-width: 576px) {
  .main-content-body {
    padding: 16px 12px 20px;
  }
}

.main-content-pagination {
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
}

/* ========== TRANSITIONS ========== */
.fade-list-move,
.fade-list-enter-active,
.fade-list-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.fade-list-enter-from,
.fade-list-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

.fade-list-leave-active {
  /* Simplified for grid compatibility */
  opacity: 0;
}

/* ========== COMPREHENSIVE DARK MODE ========== */

/* Page */
[data-theme-mode="dark"] .kse-container {
  color: #e2e8f0;
}

/* Progress wrapper */
[data-theme-mode="dark"] .progress-wrapper {
  background: transparent;
}

/* Sidebar cards */
[data-theme-mode="dark"] .sidebar-card {
  background: #1e293b;
  border-color: rgba(255, 255, 255, 0.06);
  box-shadow: 0 1px 3px rgba(0,0,0,0.2), 0 4px 16px -2px rgba(0,0,0,0.3);
}
[data-theme-mode="dark"] .sidebar-card:hover {
  box-shadow: 0 2px 6px rgba(0,0,0,0.3), 0 12px 32px -4px rgba(0,0,0,0.4);
}

/* Gauge Card */
[data-theme-mode="dark"] .sidebar-card-body {
  background: transparent;
}
[data-theme-mode="dark"] .gauge-label {
  color: #64748b;
}
[data-theme-mode="dark"] .gauge-ring {
  box-shadow: 0 4px 12px rgba(0,0,0,0.2), inset 0 0 0 2px rgba(255,255,255,0.04);
}
[data-theme-mode="dark"] .gauge-ring-inner {
  background: #1e293b;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);
}
[data-theme-mode="dark"] .gauge-score { color: #f1f5f9; }
[data-theme-mode="dark"] .gauge-score-label { color: #64748b; }
[data-theme-mode="dark"] .gauge-status-sublabel { color: #64748b; }

/* Criteria Card */
[data-theme-mode="dark"] .criteria-header { color: #e2e8f0; }
[data-theme-mode="dark"] .criteria-header i { color: #64748b; }
[data-theme-mode="dark"] .criteria-name { color: #cbd5e1; }
[data-theme-mode="dark"] .criteria-row { border-color: rgba(255,255,255,0.06); }
[data-theme-mode="dark"] .criteria-badge {
  background: rgba(255,255,255,0.05) !important;
}

/* Action Card */
[data-theme-mode="dark"] .action-card { background: #1e293b; }
[data-theme-mode="dark"] .action-btn-edit {
  background: transparent;
  border-color: rgba(251,191,36,0.4);
  color: #fbbf24;
}
[data-theme-mode="dark"] .action-btn-edit:hover {
  background: rgba(251,191,36,0.08);
}

/* Main content card */
[data-theme-mode="dark"] .main-content-card {
  background: #1e293b;
  border-color: rgba(255,255,255,0.06);
  box-shadow: 0 1px 3px rgba(0,0,0,0.2), 0 4px 16px -2px rgba(0,0,0,0.3);
}
[data-theme-mode="dark"] .main-content-header {
  background: transparent;
}
[data-theme-mode="dark"] .main-header-title { color: #f1f5f9; }
[data-theme-mode="dark"] .main-header-subtitle { color: #64748b; }
[data-theme-mode="dark"] .main-content-body {
  background: rgba(255,255,255,0.02);
  border-color: rgba(255,255,255,0.06);
}
[data-theme-mode="dark"] .main-content-pagination {
  border-color: rgba(255,255,255,0.06);
}
</style>
