<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useResikoStore } from '@/stores/resiko';
import type { RespondentProfile } from '@/types/assessment.types';

const resikoStore = useResikoStore();

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

// Form state
const formData = reactive<Partial<RespondentProfile>>({
  namaLengkap: '',
  jabatan: '',
  perusahaan: '',
  email: '',
  nomorTelepon: '',
  sektor: '',
  sertifikat: '',
});

// Validation errors
const errors = reactive<Record<string, string>>({});

// Auto-save indicator
const saveIndicator = ref('');

// Initialize form from store
onMounted(() => {
  if (resikoStore.respondentProfile) {
    Object.assign(formData, resikoStore.respondentProfile);
  }
});

// Validation rules
const validateField = (field: string, value: any): string => {
  switch (field) {
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
    case 'namaLengkap':
      return value.trim() === '' ? 'Nama lengkap wajib diisi' : '';
    case 'jabatan':
      return value.trim() === '' ? 'Jabatan wajib diisi' : '';
    case 'perusahaan':
      return value.trim() === '' ? 'Nama perusahaan wajib diisi' : '';
    case 'sektor':
      return value.trim() === '' ? 'Sektor wajib diisi' : '';
    case 'sertifikat':
      return value.trim() === '' ? 'Info sertifikat wajib diisi' : '';
    default:
      return '';
  }
};

const requiredFields = [
  'namaLengkap',
  'jabatan',
  'perusahaan',
  'email',
  'nomorTelepon',
  'sektor',
  'sertifikat'
];

const validateForm = (): boolean => {
  Object.keys(errors).forEach(key => delete errors[key]);
  const newErrors: Record<string, string> = {};
  requiredFields.forEach(key => {
    const value = (formData as any)[key] ?? '';
    const error = validateField(key, String(value));
    if (error) newErrors[key] = error;
  });
  Object.assign(errors, newErrors);
  return Object.keys(newErrors).length === 0;
};

const handleFieldBlur = (field: string) => {
  const error = validateField(field, (formData as any)[field]);
  errors[field] = error;
  if (!error) saveFormData();
};

const saveFormData = () => {
  const profile: RespondentProfile = {
    namaLengkap: formData.namaLengkap || '',
    jabatan: formData.jabatan || '',
    perusahaan: formData.perusahaan || '',
    email: formData.email || '',
    nomorTelepon: formData.nomorTelepon || '',
    sektor: formData.sektor || '',
    sertifikat: formData.sertifikat || '',
    createdAt: formData.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  resikoStore.saveRespondentProfile(profile);
  saveIndicator.value = '✓ Disimpan otomatis';
  setTimeout(() => { saveIndicator.value = ''; }, 3000);
};

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
            Data Responden Survey Resiko
          </div>
        </div>
        <div class="card-body">
          <div v-if="saveIndicator" class="alert alert-success py-2 mb-3">
            <i class="ri-check-line me-1"></i>
            {{ saveIndicator }}
          </div>

          <form @submit.prevent="startAssessment">
            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label fw-semibold">Nama Lengkap <span class="text-danger">*</span></label>
                <input type="text" class="form-control" :class="{ 'is-invalid': errors.namaLengkap }" v-model="formData.namaLengkap" @blur="handleFieldBlur('namaLengkap')" placeholder="Nama lengkap responden" />
                <div v-if="errors.namaLengkap" class="invalid-feedback">{{ errors.namaLengkap }}</div>
              </div>

              <div class="col-md-6 mb-3">
                <label class="form-label fw-semibold">Jabatan <span class="text-danger">*</span></label>
                <input type="text" class="form-control" :class="{ 'is-invalid': errors.jabatan }" v-model="formData.jabatan" @blur="handleFieldBlur('jabatan')" placeholder="IT Manager / Security Officer" />
                <div v-if="errors.jabatan" class="invalid-feedback">{{ errors.jabatan }}</div>
              </div>

              <div class="col-md-12 mb-3">
                <label class="form-label fw-semibold">Nama Perusahaan / Instansi <span class="text-danger">*</span></label>
                <input type="text" class="form-control" :class="{ 'is-invalid': errors.perusahaan }" v-model="formData.perusahaan" @blur="handleFieldBlur('perusahaan')" placeholder="Nama lengkap instansi" />
                <div v-if="errors.perusahaan" class="invalid-feedback">{{ errors.perusahaan }}</div>
              </div>

              <div class="col-md-6 mb-3">
                <label class="form-label fw-semibold">Email <span class="text-danger">*</span></label>
                <input type="email" class="form-control" :class="{ 'is-invalid': errors.email }" v-model="formData.email" @blur="handleFieldBlur('email')" placeholder="email@instansi.go.id" />
                <div v-if="errors.email" class="invalid-feedback">{{ errors.email }}</div>
              </div>

              <div class="col-md-6 mb-3">
                <label class="form-label fw-semibold">Nomor Telepon <span class="text-danger">*</span></label>
                <input type="tel" class="form-control" :class="{ 'is-invalid': errors.nomorTelepon }" v-model="formData.nomorTelepon" @blur="handleFieldBlur('nomorTelepon')" placeholder="0812..." />
                <div v-if="errors.nomorTelepon" class="invalid-feedback">{{ errors.nomorTelepon }}</div>
              </div>

              <div class="col-md-6 mb-3">
                <label class="form-label fw-semibold">Sektor <span class="text-danger">*</span></label>
                <select class="form-select" :class="{ 'is-invalid': errors.sektor }" v-model="formData.sektor" @blur="handleFieldBlur('sektor')">
                  <option value="" disabled>Pilih Sektor</option>
                  <option v-for="option in sektorOptions" :key="option" :value="option">{{ option }}</option>
                </select>
                <div v-if="errors.sektor" class="invalid-feedback">{{ errors.sektor }}</div>
              </div>

              <div class="col-md-6 mb-3">
                <label class="form-label fw-semibold">Sertifikat Keamanan (ISO/Lainnya) <span class="text-danger">*</span></label>
                <input type="text" class="form-control" :class="{ 'is-invalid': errors.sertifikat }" v-model="formData.sertifikat" @blur="handleFieldBlur('sertifikat')" placeholder="Contoh: ISO 27001, Tidak Ada, dll" />
                <div v-if="errors.sertifikat" class="invalid-feedback">{{ errors.sertifikat }}</div>
              </div>
            </div>

            <div class="d-flex justify-content-end gap-2 mt-4">
              <button type="button" class="btn btn-light" @click="emit('cancel')">
                <i class="ri-arrow-left-line me-1"></i>
                Batal
              </button>
              <button type="submit" class="btn btn-primary">
                {{ resikoStore.hasRespondentProfile ? 'Simpan & Lanjut ke Pertanyaan' : 'Lanjut ke Pertanyaan Survey' }}
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
</style>
