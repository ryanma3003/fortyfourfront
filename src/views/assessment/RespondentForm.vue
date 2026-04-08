<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import { useDynamicAssessmentStore } from '@/stores/dynamic-assessment';
import type { RespondentProfile } from '@/types/assessment.types';
import type { Stakeholder } from '@/types/stakeholders.types';

const assessmentStore = useDynamicAssessmentStore();

const props = defineProps<{
  stakeholder?: Stakeholder | null;
}>();

const emit = defineEmits<{
  (e: 'submit'): void;
  (e: 'cancel'): void;
}>();

// Dropdown options
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
  instansi: '',
  sektor: 'Kesehatan',
  alamat: '',
  email: '',
  nomorTelepon: '',
  namaResponden: '',
  jabatanResponden: '',
  tahunPengukuran: new Date().getFullYear().toString(),
  targetLevel: 3,
  targetNilai: '2.51 - 3.50',
  acuan: '',
  tanggalPengisian: new Date().toISOString().split('T')[0]
});

// Validation errors
const errors = reactive<Record<string, string>>({});

// Auto-save indicator
const saveIndicator = ref('');

// Pre-fill from stakeholder data
const prefillFromStakeholder = (stakeholder: Stakeholder) => {
  // Instansi dari nama perusahaan
  formData.instansi = stakeholder.nama_perusahaan || '';
  // Sektor dari sub-sektor perusahaan
  if (stakeholder.sub_sektor?.nama_sub_sektor) {
    formData.sektor = stakeholder.sub_sektor.nama_sub_sektor;
  } else if (stakeholder.sektor) {
    formData.sektor = stakeholder.sektor;
  }
  if (stakeholder.alamat) {
    formData.alamat = stakeholder.alamat;
  }
  if (stakeholder.email) {
    formData.email = stakeholder.email;
  }
};

// Initialize form from store, then overlay stakeholder data
onMounted(() => {
  if (assessmentStore.respondentProfile) {
    Object.assign(formData, assessmentStore.respondentProfile);
  }
  // Pre-fill from stakeholder (overrides stored data for these fields)
  if (props.stakeholder) {
    prefillFromStakeholder(props.stakeholder);
  }
});

// Watch for stakeholder changes
watch(() => props.stakeholder, (newVal) => {
  if (newVal) {
    prefillFromStakeholder(newVal);
  }
});

// Validation rules
const validateField = (field: string, value: any): string => {
  switch (field) {
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
    default:
      return '';
  }
};

// List of required fields
const requiredFields = [
  'alamat',
  'email',
  'nomorTelepon',
  'namaResponden',
  'jabatanResponden',
  'tahunPengukuran',
  'targetNilai'
];

// Validate all fields
const validateForm = (): boolean => {
  // Clear old errors first
  Object.keys(errors).forEach(key => delete errors[key]);
  
  const newErrors: Record<string, string> = {};
  
  // Only validate required fields
  requiredFields.forEach(key => {
    const value = (formData as any)[key] ?? '';
    const error = validateField(key, String(value));
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
    sektor: formData.sektor || '',
    alamat: formData.alamat || '',
    email: formData.email || '',
    namaResponden: formData.namaResponden || '',
    jabatanResponden: formData.jabatanResponden || '',
    nomorTelepon: formData.nomorTelepon || '',
    tahunPengukuran: formData.tahunPengukuran || '',
    targetLevel: formData.targetLevel || 3,
    targetNilai: formData.targetNilai || '',
    acuan: formData.acuan || '',
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



// Start assessment (emit submit event)
const startAssessment = () => {
  if (validateForm()) {
    saveFormData();
    emit('submit');
  }
};
</script>

<template>
  <div class="row">
    <div class="col-12">
      <div class="card custom-card">
        <div class="card-header">
          <div class="card-title">
            <i class="ri-file-list-3-line me-2"></i>
            Data Responden
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
              <!-- Instansi (Read-only from stakeholder) -->
              <div class="col-12 mb-3" v-if="stakeholder">
                <label class="form-label">Instansi / Perusahaan</label>
                <input 
                  type="text" 
                  class="form-control bg-light"
                  :value="stakeholder.nama_perusahaan"
                  readonly
                />
                <small class="text-muted">Diambil otomatis dari data Perusahaan</small>
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

              <!-- Email (pre-filled from stakeholder) -->
              <div class="col-md-6 mb-3">
                <label class="form-label">Alamat Surel (Email) <span class="text-danger">*</span></label>
                <input 
                  type="email" 
                  class="form-control"
                  :class="[{ 'is-invalid': errors.email }, stakeholder ? 'bg-light' : '']"
                  v-model="formData.email"
                  @blur="handleFieldBlur('email')"
                  placeholder="email@example.com"
                  :readonly="!!stakeholder"
                />
                <small v-if="stakeholder" class="text-muted">Diambil dari data Perusahaan</small>
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

              <!-- Sektor (pre-filled from stakeholder sub_sektor) -->
              <div class="col-md-6 mb-3">
                <label class="form-label">Sektor <span class="text-danger">*</span></label>
                <template v-if="stakeholder">
                  <input 
                    type="text" 
                    class="form-control bg-light"
                    :value="formData.sektor"
                    readonly
                  />
                  <small class="text-muted">Diambil dari sub-sektor Perusahaan</small>
                </template>
                <template v-else>
                  <select 
                    class="form-select"
                    v-model="formData.sektor"
                    @change="handleFieldBlur('sektor')"
                  >
                    <option v-for="option in sektorOptions" :key="option" :value="option">
                      {{ option }}
                    </option>
                  </select>
                </template>
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

              <!-- Alamat (pre-filled from stakeholder) -->
              <div class="col-12 mb-3">
                <label class="form-label">Alamat <span class="text-danger">*</span></label>
                <textarea 
                  class="form-control"
                  :class="[{ 'is-invalid': errors.alamat }, stakeholder ? 'bg-light' : '']"
                  v-model="formData.alamat"
                  @blur="handleFieldBlur('alamat')"
                  rows="2"
                  placeholder="Alamat lengkap instansi"
                  :readonly="!!stakeholder"
                ></textarea>
                <small v-if="stakeholder" class="text-muted">Diambil dari data Perusahaan</small>
                <div v-if="errors.alamat" class="invalid-feedback">{{ errors.alamat }}</div>
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

              <!-- Acuan (dikosongkan dulu) -->
              <div class="col-md-6 mb-3">
                <label class="form-label">Acuan</label>
                <input 
                  type="text" 
                  class="form-control bg-light"
                  v-model="formData.acuan"
                  placeholder="— Belum tersedia —"
                  disabled
                />
                <small class="text-muted">Akan diisi pada tahap selanjutnya</small>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="d-flex justify-content-end gap-2 mt-4">
              <button 
                type="button" 
                class="btn btn-light"
                @click="emit('cancel')"
              >
                <i class="ri-arrow-left-line me-1"></i>
                Kembali ke Ringkasan
              </button>
              <button 
                type="submit" 
                class="btn btn-primary"
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
</template>

<style scoped>
.form-label {
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.text-danger {
  color: var(--danger) !important;
}
</style>
