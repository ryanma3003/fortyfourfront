<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAssessmentStore } from '@/stores/assessment';
import type { RespondentProfile } from '@/types/assessment.types';
import Pageheader from '@/shared/components/pageheader/pageheader.vue';

const router = useRouter();
const assessmentStore = useAssessmentStore();

// Page header data
const pageheaderData = {
  title: { label: 'IKAS Assessment', path: '/respondent' },
  currentpage: 'Data Responden',
  activepage: 'Data Responden'
};

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
  instansi: '',
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
const lastSaved = ref<Date | null>(null);
const saveIndicator = ref('');

// Initialize form from store
onMounted(() => {
  assessmentStore.initialize();
  
  if (assessmentStore.respondentProfile) {
    Object.assign(formData, assessmentStore.respondentProfile);
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
  lastSaved.value = new Date();
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

// Start assessment
const startAssessment = () => {
  if (validateForm()) {
    saveFormData();
    router.push('/assessment');
  }
};
</script>

<template>
  <Pageheader :propData="pageheaderData" />
  
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
                @click="router.push('/dashboards')"
              >
                Batal
              </button>
              <button 
                type="submit" 
                class="btn btn-primary"
                :disabled="!isFormValid"
              >
                <i class="ri-arrow-right-line me-1"></i>
                Mulai Penilaian
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
