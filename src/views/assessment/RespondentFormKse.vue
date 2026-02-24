<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useKseStore } from '@/stores/kse';

// ----- Props & Emits -----
const props = defineProps<{ slug: string }>();

const emit = defineEmits<{
  (e: 'submit'): void;
  (e: 'cancel'): void;
}>();

const kseStore = useKseStore();

// ----- Storage key -----
const PROFILE_KEY = `kse_respondent_${props.slug}`;

// ----- Dropdown options -----
const jenisUsahaOptions = [
  'Pemerintah Pusat',
  'Pemerintah Daerah',
  'BUMN / BUMD',
  'Swasta - Keuangan & Perbankan',
  'Swasta - Telekomunikasi',
  'Swasta - Teknologi & E-Commerce',
  'Swasta - Kesehatan',
  'Swasta - Pendidikan',
  'Swasta - Ritel',
  'Swasta - Lainnya',
];

const tahunOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

// ----- Form state -----
interface KseRespondentProfile {
  namaPerusahaan     : string;
  jenisUsaha         : string;
  namaSistem         : string;
  alamat             : string;
  email              : string;
  nomorTelepon       : string;
  namaResponden      : string;
  jabatanResponden   : string;
  tahunPengukuran    : number;
  tanggalPengisian   : string;
}

const formData = reactive<KseRespondentProfile>({
  namaPerusahaan   : '',
  jenisUsaha       : 'Pemerintah Pusat',
  namaSistem       : '',
  alamat           : '',
  email            : '',
  nomorTelepon     : '',
  namaResponden    : '',
  jabatanResponden : '',
  tahunPengukuran  : new Date().getFullYear(),
  tanggalPengisian : new Date().toISOString().split('T')[0],
});

// ----- Validation -----
const errors = reactive<Record<string, string>>({});
const saveIndicator = ref('');

const validateField = (field: string, value: any): string => {
  const v = String(value ?? '').trim();
  switch (field) {
    case 'namaPerusahaan'  : return v === '' ? 'Nama instansi / perusahaan wajib diisi' : '';
    case 'namaSistem'      : return v === '' ? 'Nama sistem elektronik wajib diisi' : '';
    case 'alamat'          : return v === '' ? 'Alamat wajib diisi' : '';
    case 'email': {
      if (v === '') return 'Email wajib diisi';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Format email tidak valid';
    }
    case 'nomorTelepon': {
      if (v === '') return 'Nomor telepon wajib diisi';
      return /^[0-9+\-\s()]+$/.test(v) ? '' : 'Format nomor telepon tidak valid';
    }
    case 'namaResponden'   : return v === '' ? 'Nama responden wajib diisi' : '';
    case 'jabatanResponden': return v === '' ? 'Jabatan responden wajib diisi' : '';
    default                : return '';
  }
};

const requiredFields: (keyof KseRespondentProfile)[] = [
  'namaPerusahaan', 'namaSistem', 'alamat',
  'email', 'nomorTelepon', 'namaResponden', 'jabatanResponden',
];

const validateForm = (): boolean => {
  Object.keys(errors).forEach(k => delete errors[k]);
  const newErrors: Record<string, string> = {};
  requiredFields.forEach(f => {
    const err = validateField(f, (formData as any)[f]);
    if (err) newErrors[f] = err;
  });
  Object.assign(errors, newErrors);
  return Object.keys(newErrors).length === 0;
};

const handleFieldBlur = (field: string) => {
  const err = validateField(field, (formData as any)[field]);
  errors[field] = err;
  if (!err) saveProfile();
};

// ----- Persist -----
const saveProfile = () => {
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...formData }));

  // Sync namaPerusahaan + jenisUsaha into kse store
  kseStore.ensureStakeholderData(props.slug);
  kseStore.updateStakeholderInfo(props.slug, formData.namaPerusahaan, formData.jenisUsaha);

  saveIndicator.value = '✓ Disimpan otomatis';
  setTimeout(() => { saveIndicator.value = ''; }, 2500);
};

onMounted(() => {
  kseStore.initialize();

  // Restore from localStorage
  const stored = localStorage.getItem(PROFILE_KEY);
  if (stored) {
    try { Object.assign(formData, JSON.parse(stored)); } catch {}
  } else {
    // Pre-fill from kse store if available
    const kseData = kseStore.getKseData(props.slug);
    if (kseData.namaPerusahaan) formData.namaPerusahaan = kseData.namaPerusahaan;
    if (kseData.jenisUsaha)    formData.jenisUsaha    = kseData.jenisUsaha;
  }
});

// ----- Submit -----
const handleSubmit = () => {
  if (validateForm()) {
    saveProfile();
    emit('submit');
  }
};
</script>

<template>
  <div class="row">
    <div class="col-12">
      <div class="card custom-card">

        <!-- Card Header -->
        <div class="card-header">
          <div class="card-title d-flex align-items-center gap-2">
            <i class="ri-file-list-3-line text-primary"></i>
            Data Responden – Kategorisasi Sistem Elektronik (KSE)
          </div>
        </div>

        <div class="card-body">

          <!-- Auto-save indicator -->
          <transition name="fade">
            <div v-if="saveIndicator" class="alert alert-success py-2 mb-3">
              <i class="ri-check-line me-1"></i>{{ saveIndicator }}
            </div>
          </transition>

          <form @submit.prevent="handleSubmit" novalidate>
            <div class="row g-3">

              <!-- ── Instansi / Perusahaan ── -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">
                  Nama Instansi / Perusahaan <span class="text-danger">*</span>
                </label>
                <input type="text" class="form-control" :class="{ 'is-invalid': errors.namaPerusahaan }"
                  v-model="formData.namaPerusahaan" @blur="handleFieldBlur('namaPerusahaan')"
                  placeholder="Contoh: PT. ABC Indonesia" />
                <div v-if="errors.namaPerusahaan" class="invalid-feedback">{{ errors.namaPerusahaan }}</div>
              </div>

              <!-- ── Jenis Usaha ── -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">
                  Jenis Usaha / Sektor <span class="text-danger">*</span>
                </label>
                <select class="form-select" v-model="formData.jenisUsaha"
                  @change="handleFieldBlur('jenisUsaha')">
                  <option v-for="opt in jenisUsahaOptions" :key="opt" :value="opt">{{ opt }}</option>
                </select>
              </div>

              <!-- ── Nama Sistem Elektronik ── -->
              <div class="col-md-12">
                <label class="form-label fw-semibold">
                  Nama Sistem Elektronik <span class="text-danger">*</span>
                </label>
                <input type="text" class="form-control" :class="{ 'is-invalid': errors.namaSistem }"
                  v-model="formData.namaSistem" @blur="handleFieldBlur('namaSistem')"
                  placeholder="Contoh: Sistem Informasi Manajemen XYZ" />
                <div v-if="errors.namaSistem" class="invalid-feedback">{{ errors.namaSistem }}</div>
              </div>

              <!-- ── Alamat ── -->
              <div class="col-12">
                <label class="form-label fw-semibold">
                  Alamat <span class="text-danger">*</span>
                </label>
                <textarea class="form-control" :class="{ 'is-invalid': errors.alamat }"
                  v-model="formData.alamat" @blur="handleFieldBlur('alamat')"
                  rows="2" placeholder="Alamat lengkap instansi / perusahaan"></textarea>
                <div v-if="errors.alamat" class="invalid-feedback">{{ errors.alamat }}</div>
              </div>

              <!-- ── Email ── -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">
                  Alamat Surel (Email) <span class="text-danger">*</span>
                </label>
                <input type="email" class="form-control" :class="{ 'is-invalid': errors.email }"
                  v-model="formData.email" @blur="handleFieldBlur('email')"
                  placeholder="email@example.com" />
                <div v-if="errors.email" class="invalid-feedback">{{ errors.email }}</div>
              </div>

              <!-- ── Nomor Telepon ── -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">
                  Nomor Telepon <span class="text-danger">*</span>
                </label>
                <input type="tel" class="form-control" :class="{ 'is-invalid': errors.nomorTelepon }"
                  v-model="formData.nomorTelepon" @blur="handleFieldBlur('nomorTelepon')"
                  placeholder="Contoh: 021-12345678" />
                <div v-if="errors.nomorTelepon" class="invalid-feedback">{{ errors.nomorTelepon }}</div>
              </div>

              <!-- ── Separator ── -->
              <div class="col-12">
                <hr class="my-1" />
                <p class="text-muted fs-13 mb-0">
                  <i class="ri-user-line me-1"></i>Informasi Responden
                </p>
              </div>

              <!-- ── Nama Responden ── -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">
                  Nama Responden <span class="text-danger">*</span>
                </label>
                <input type="text" class="form-control" :class="{ 'is-invalid': errors.namaResponden }"
                  v-model="formData.namaResponden" @blur="handleFieldBlur('namaResponden')"
                  placeholder="Nama lengkap responden" />
                <div v-if="errors.namaResponden" class="invalid-feedback">{{ errors.namaResponden }}</div>
              </div>

              <!-- ── Jabatan Responden ── -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">
                  Jabatan Responden <span class="text-danger">*</span>
                </label>
                <input type="text" class="form-control" :class="{ 'is-invalid': errors.jabatanResponden }"
                  v-model="formData.jabatanResponden" @blur="handleFieldBlur('jabatanResponden')"
                  placeholder="Contoh: Manajer TI / Kepala Divisi IT" />
                <div v-if="errors.jabatanResponden" class="invalid-feedback">{{ errors.jabatanResponden }}</div>
              </div>

              <!-- ── Tahun Pengukuran ── -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Tahun Pengukuran <span class="text-danger">*</span></label>
                <select class="form-select" v-model.number="formData.tahunPengukuran"
                  @change="handleFieldBlur('tahunPengukuran')">
                  <option v-for="y in tahunOptions" :key="y" :value="y">{{ y }}</option>
                </select>
              </div>

              <!-- ── Tanggal Pengisian ── -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Tanggal Pengisian <span class="text-danger">*</span></label>
                <input type="date" class="form-control" v-model="formData.tanggalPengisian"
                  @change="handleFieldBlur('tanggalPengisian')" />
              </div>

            </div><!-- end .row -->

            <!-- Action Buttons -->
            <div class="d-flex justify-content-end gap-2 mt-4">
              <button type="button" class="btn btn-light" @click="emit('cancel')">
                <i class="ri-arrow-left-line me-1"></i>Kembali
              </button>
              <button type="submit" class="btn btn-primary">
                Mulai Kategorisasi
                <i class="ri-arrow-right-line ms-1"></i>
              </button>
            </div>

          </form>
        </div><!-- card-body -->
      </div><!-- card -->
    </div>
  </div>
</template>

<style scoped>
.form-label  { font-weight: 500; margin-bottom: 0.4rem; }
.text-danger { color: var(--danger) !important; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>
