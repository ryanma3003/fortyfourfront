<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { stakeholdersData } from '../data/dummydata';
import { kseCategories, getKategoriSE, getMaxTotalBobot } from '../data/kse-data';
import { useKseStore } from '../stores/kse';
import Pageheader from '../shared/components/pageheader/pageheader.vue';
import Swal from 'sweetalert2';

const router = useRouter();
const route = useRoute();
const kseStore = useKseStore();

const currentSlug = computed(() => String(route.query.slug || ''));
const currentSource = computed(() => String(route.query.source || ''));

// Initialize store
onMounted(() => {
  kseStore.initialize();
  
  // Update stakeholder info if we have a slug
  if (currentSlug.value && currentStakeholder.value) {
    kseStore.updateStakeholderInfo(
      currentSlug.value,
      currentStakeholder.value.nama_perusahaan || '',
      currentStakeholder.value.jenis_usaha || ''
    );
  }
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

    if (source === 'list') {
      return {
        title: { label: 'Stakeholders', path: '/stakeholders' },
        currentpage: 'KSE',
        activepage: 'KSE',
      };
    }

    if (slug && stakeholdersData && Array.isArray(stakeholdersData)) {
      const stakeholder = stakeholdersData.find(s => s.slug === String(slug));
      if (stakeholder) {
        return {
          title: { label: `Profile ${stakeholder.nama_perusahaan}`, path: `/profile-stakeholders/${stakeholder.slug}` },
          currentpage: 'KSE',
          activepage: 'KSE',
        };
      }
    }
  } catch (error) {
    console.error('KSE Error in computed:', error);
  }

  return {
    title: { label: 'Stakeholders', path: '/stakeholders' },
    currentpage: 'KSE',
    activepage: 'KSE',
  };
});

// Get current stakeholder
const currentStakeholder = computed(() => {
  const slug = route.query.slug;
  if (slug && stakeholdersData && Array.isArray(stakeholdersData)) {
    return stakeholdersData.find(s => s.slug === String(slug));
  }
  return null;
});

// Handle option selection
const selectOption = (questionNo, optionKey, bobot) => {
  const slug = currentSlug.value || 'default';
  kseStore.updateAnswer(slug, questionNo, optionKey, bobot);
};

// Get selected option for a question
const getSelectedOption = (questionNo) => {
  return kseData.value?.answers?.[questionNo]?.selectedOption || null;
};

// Get selected bobot for a question
const getSelectedBobot = (questionNo) => {
  const answer = kseData.value?.answers?.[questionNo];
  if (!answer || answer.selectedOption === null) return '-';
  return answer.bobot;
};

// Get status label based on bobot
const getStatusLabel = (bobot) => {
  if (bobot >= 5) return 'Strategis';
  if (bobot >= 3) return 'Tinggi';
  if (bobot >= 1) return 'Rendah';
  return '-';
};

// Calculate total questions per category
const getCategoryRowspan = (category) => {
  return category.questions.length;
};

// Get total questions count
const getTotalQuestionsCount = () => {
  let count = 0;
  kseCategories.forEach(cat => {
    count += cat.questions.length;
  });
  return count;
};

// Max total for display
const maxTotalBobot = getMaxTotalBobot();

// Navigate to KSE CRUD
// Save and Exit
const saveAndExit = () => {
  // Data is already saved in store on every click. 
  // We just need to show success and navigate back.
  
  Swal.fire({
    title: 'Berhasil!',
    text: 'Data KSE berhasil disimpan.',
    icon: 'success',
    confirmButtonText: 'OK',
    confirmButtonColor: '#084696',
  }).then((result) => {
    if (result.isConfirmed) {
      // Navigate back to profile or list
      if (currentSlug.value) {
         // Check if we came from list or profile
         if (currentSource.value === 'list') {
             router.push('/stakeholders');
         } else {
             router.push(`/profile-stakeholders/${currentSlug.value}`);
         }
      } else {
         router.push('/stakeholders');
      }
    }
  });
};
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <div class="row">
    <div class="col-12">
      <div class="card custom-card gradient-header-card">
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3"
          style="background: radial-gradient(ellipse at top, #032a5c, #084696)">
          <div class="d-flex align-items-center">
            <i class="ri-shield-check-line me-2 fs-18" style="color: white !important;"></i>
            <div class="card-title mb-0" style="color: white !important;">
              KSE ({{ currentStakeholder?.nama_perusahaan || 'Stakeholder' }})
            </div>
          </div>
        </div>

        <div class="card-body">
          <div class="table-wrapper">
            <table class="kse-table">
              <thead>
                <!-- Title row -->
                <tr>
                  <th colspan="5" class="main-title">
                    Kategorisasi Sistem Elektronik
                  </th>
                </tr>
                <!-- Info row -->
                <tr>
                  <th colspan="5" class="header-info">
                    <div class="info-row">
                      <span class="info-label">Nama Perusahaan:</span>
                      <span class="info-value">{{ currentStakeholder?.nama_perusahaan || '-' }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Jenis Usaha:</span>
                      <span class="info-value">{{ currentStakeholder?.jenis_usaha || '-' }}</span>
                    </div>
                  </th>
                </tr>
                <!-- Column headers -->
                <tr class="center">
                  <th colspan="2" class="col-question text-start ps-3">
                    Kategori Sistem Elektronik <br>
                    <span style="font-weight: normal;">Rendah; Tinggi; Strategis</span>
                  </th>
                  <th class="col-status">Status</th>
                  <th class="col-bobot">Bobot Nilai</th>
                  <th class="col-dukung">Data Dukung</th>
                </tr>
              </thead>

              <tbody>
                <!-- Loop through each category -->
                <template v-for="(category, catIndex) in kseCategories" :key="category.id">
                  <!-- Category header row (displayed above questions) -->
                  <tr class="category-header-row">
                    <!-- 'No' column cell sharing the same background -->
                    <td class="domain-header center" :class="category.id" style="border-right: 1px solid rgba(255, 255, 255, 0.3);">
                      {{ ['No'][catIndex] }}
                    </td>
                    <!-- Title cell sharing the same background -->
                    <td colspan="4" class="domain-header text-start ps-3" :class="category.id" style="border-left: none;">
                      {{ category.title.toUpperCase() }}
                    </td>
                  </tr>
                  
                  <template v-for="question in category.questions" :key="question.no">
                    <tr>
                      <!-- Number cell -->
                      <td class="center number-cell">{{ question.no }}</td>
                      
                      <!-- Question content -->
                      <td class="question-cell">
                        <div class="question-text">{{ question.pertanyaan }}</div>
                        <div class="options-row">
                          <div v-for="(option, key) in question.options" :key="key"
                            class="option-item"
                            :class="{ 'selected': getSelectedOption(question.no) === key }"
                            @click="selectOption(question.no, key, option.bobot)">
                            <span class="option-key" :class="`key-${key.toLowerCase()}`">{{ key }}</span>
                            <span class="option-label">{{ option.label }}</span>
                          </div>
                        </div>
                      </td>

                      <!-- Status -->
                      <td class="center status-cell">
                        <span class="status-badge" 
                          :class="getSelectedOption(question.no) ? `status-${getStatusLabel(getSelectedBobot(question.no)).toLowerCase()}` : 'status-empty'">
                          {{ getStatusLabel(getSelectedBobot(question.no)) }}
                        </span>
                      </td>

                      <!-- Bobot Nilai -->
                      <td class="center bobot-cell">
                        {{ getSelectedBobot(question.no) }}
                      </td>

                      <!-- Data Dukung -->
                      <td class="dukung-cell">
                        {{ question.dataDukung }}
                      </td>
                    </tr>
                  </template>
                </template>

                <!-- Total Row -->
                <tr class="total-row">
                  <td colspan="4" class="total-label">Total Bobot Nilai</td>
                  <td class="center total-value">{{ kseData?.totalBobot || 0 }}</td>
                  <td rowspan="2" class="kategori-final">
                    <div class="kategori-label">Kategori SE</div>
                    <div class="kategori-value" :style="{ color: kseData?.kategoriColor || '#6c757d' }">
                      {{ kseData?.kategoriSE || 'Belum Dikategorikan' }}
                    </div>
                  </td>
                </tr>
                <tr class="total-row">
                  <td colspan="4" class="total-label">Nilai Maksimal</td>
                  <td class="center total-value">{{ maxTotalBobot }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="d-flex justify-content-end gap-2 mt-4 px-2 pb-2">
            <button @click="saveAndExit" class="btn btn-primary btn-save rounded-pill px-4">
              <i class="ri-save-line me-1"></i> Simpan Data
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-wrapper {
  overflow-x: auto;
}

.kse-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th, td {
  border: 1px solid #dee2e6;
  padding: 10px 12px;
  vertical-align: middle;
}

.main-title {
  font-weight: bold;
  text-align: center;
  background: #fff;
  color: #212529;
  font-size: 18px;
  padding: 14px 16px;
  border-bottom: 2px solid #e9ecef;
}

.col-question {
  background: #f8f9fa;
  font-weight: 600;
  text-align: left;
}

.header-info {
  background: #f8f9fa;
  text-align: left;
  padding: 12px 16px;
}

.info-row {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  font-weight: 600;
  color: #6c757d;
  min-width: 140px;
}

.info-value {
  font-weight: 500;
  color: #212529;
}

.col-status {
  width: 100px;
  text-align: center;
  background: #f8f9fa;
  font-weight: 600;
}

.col-bobot {
  width: 100px;
  text-align: center;
  background: #f8f9fa;
  font-weight: 600;
}

.col-dukung {
  width: 250px;
  background: #f8f9fa;
  font-weight: 600;
}

/* Domain Header (horizontal, above questions) */
.domain-header {
  color: #fff;
  font-weight: bold;
  text-align: left;
  font-size: 14px;
  padding: 12px 16px;
  letter-spacing: 0.5px;
}

.col-number {
  width: 50px;
  text-align: center;
  background: #f8f9fa;
  font-weight: 600;
}

.number-cell {
  font-weight: 600;
  color: #667eea;
}

.category-header-row td {
  border-left: none;
  border-right: none;
}


.karakteristik_instansi { background: #084696; }
.karakteristik_data { background: #8e44ad; }
.karakteristik_transaksi { background: #f39c12; }
.dampak_kegagalan { background: #e74c3c; }

/* Question Cell */
.question-cell {
  padding: 12px;
}

.question-no {
  display: inline-block;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}

.question-text {
  font-weight: 500;
  color: #212529;
  margin-bottom: 12px;
  line-height: 1.4;
}

/* Options */
.options-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 12px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #fff;
}

.option-item:hover {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.option-item.selected {
  border-color: #28a745;
  background: rgba(40, 167, 69, 0.08);
}

.option-key {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: 700;
  font-size: 12px;
  color: white;
  flex-shrink: 0;
}

.key-a { background: #e74c3c; }
.key-b { background: #f39c12; }
.key-c { background: #2ecc71; }

.option-label {
  font-size: 12px;
  color: #495057;
  line-height: 1.4;
}

/* Status Cell */
.status-cell {
  text-align: center;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}

.status-strategis {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: white;
}

.status-tinggi {
  background: linear-gradient(135deg, #f39c12, #e67e22);
  color: white;
}

.status-rendah {
  background: linear-gradient(135deg, #2ecc71, #27ae60);
  color: white;
}

.status-empty {
  background: #e9ecef;
  color: #6c757d;
}

/* Bobot Cell */
.bobot-cell {
  font-size: 16px;
  font-weight: 700;
  color: #212529;
}

/* Dukung Cell */
.dukung-cell {
  font-size: 11px;
  color: #6c757d;
  line-height: 1.4;
}

/* Total Row */
.total-row {
  background: #444;
}

.total-label {
  background: #444;
  color: white;
  font-weight: bold;
  text-align: right;
}

.total-value {
  background: #fff;
  font-size: 18px;
  font-weight: 700;
  color: #212529;
}

/* Kategori Final */
.kategori-final {
  text-align: center;
  background: #f8f9fa;
  padding: 16px;
}

.kategori-label {
  font-size: 12px;
  color: #6c757d;
  margin-bottom: 8px;
}

.kategori-value {
  font-size: 24px;
  font-weight: 700;
}

/* Gradient Header Card */
.gradient-header-card {
  border: none !important;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075) !important;
  overflow: hidden !important;
}

.gradient-header-card .card-header {
  border: none !important;
  border-bottom: none !important;
  border-block-end: none !important;
  border-radius: 0 !important;
  margin: 0 !important;
}

.gradient-header-card .card-body {
  border: 1px solid var(--default-border);
  border-top: none !important;
  border-radius: 0 !important;
}

.center {
  text-align: center;
}

/* Dark mode support */
[data-theme-mode="dark"] th,
[data-theme-mode="dark"] td {
  border-color: #3d4654;
}

[data-theme-mode="dark"] .header-info,
[data-theme-mode="dark"] .col-status,
[data-theme-mode="dark"] .col-bobot,
[data-theme-mode="dark"] .col-dukung {
  background: rgba(255, 255, 255, 0.05);
}

[data-theme-mode="dark"] .option-item {
  border-color: #3d4654;
  background: rgba(255, 255, 255, 0.02);
}

[data-theme-mode="dark"] .option-item:hover {
  background: rgba(102, 126, 234, 0.1);
}

[data-theme-mode="dark"] .option-item.selected {
  background: rgba(40, 167, 69, 0.15);
}

[data-theme-mode="dark"] .question-text,
[data-theme-mode="dark"] .info-value,
[data-theme-mode="dark"] .bobot-cell {
  color: var(--default-text-color);
}

[data-theme-mode="dark"] .kategori-final {
  background: rgba(255, 255, 255, 0.05);
}

[data-theme-mode="dark"] .total-value {
  background: rgba(255, 255, 255, 0.08);
  color: var(--default-text-color);
}

/* Responsive */
@media (max-width: 768px) {
  .options-row {
    gap: 6px;
  }

  .option-item {
    padding: 6px 10px;
  }

  .dukung-cell {
    min-width: 200px;
  }
}

.btn-save {
    background: linear-gradient(135deg, #084696 0%, #052c65 100%);
    border: none;
    font-weight: 500;
    transition: all 0.3s ease;
}

.btn-save:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(8, 70, 150, 0.3);
}
</style>
