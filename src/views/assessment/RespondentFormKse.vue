<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useKseStore } from '@/stores/kse';
import { useStakeholdersStore } from '@/stores/stakeholders';

// ----- Props & Emits -----
const props = defineProps<{ slug: string; stakeholderSlug?: string }>();

const emit = defineEmits<{
  (e: 'submit'): void;
  (e: 'cancel'): void;
}>();

const kseStore          = useKseStore();
const stakeholdersStore = useStakeholdersStore();

// ----- Storage key -----
const PROFILE_KEY = `kse_respondent_${props.slug}`;

const tahunOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

// ----- Form state -----
interface KseRespondentProfile {
  namaPerusahaan   : string;
  jenisUsaha       : string;
  namaSistem       : string;
  alamat           : string;
  email            : string;
  nomorTelepon     : string;
  tahunPengukuran  : number;
  tanggalPengisian : string;
}

const formData = reactive<KseRespondentProfile>({
  namaPerusahaan   : '',
  jenisUsaha       : '',
  namaSistem       : '',
  alamat           : '',
  email            : '',
  nomorTelepon     : '',
  tahunPengukuran  : new Date().getFullYear(),
  tanggalPengisian : new Date().toISOString().split('T')[0],
});

// ----- Validation -----
const errors = reactive<Record<string, string>>({});
const saveIndicator = ref('');

const validateField = (field: string, value: any): string => {
  const v = String(value ?? '').trim();
  switch (field) {
    case 'namaSistem': return v === '' ? 'Nama sistem elektronik wajib diisi' : '';
    default          : return '';
  }
};

const requiredFields: (keyof KseRespondentProfile)[] = ['namaSistem'];

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

  // Keep kse store in sync: namaPerusahaan slot holds namaSistem (as set on +tambah KSE)
  kseStore.ensureStakeholderData(props.slug);
  kseStore.updateStakeholderInfo(props.slug, formData.namaSistem, formData.jenisUsaha);

  saveIndicator.value = '✓ Disimpan otomatis';
  setTimeout(() => { saveIndicator.value = ''; }, 2500);
};

onMounted(async () => {
  kseStore.initialize();
  if (!stakeholdersStore.initialized) {
    await stakeholdersStore.initialize();
  }

  // 1. Auto-fill company data from stakeholder profile (always fresh)
  const companySlug = props.stakeholderSlug || '';
  if (companySlug) {
    const stakeholder = stakeholdersStore.getStakeholderBySlug(companySlug);
    if (stakeholder) {
      formData.namaPerusahaan = stakeholder.nama_perusahaan || '';
      formData.alamat         = stakeholder.alamat          || '';
      formData.email          = stakeholder.email           || '';
      formData.nomorTelepon   = stakeholder.telepon         || '';
      formData.jenisUsaha     = stakeholder.sub_sektor?.nama_sub_sektor || stakeholder.sektor || '';
    }
  }

  // 2. Auto-fill namaSistem from kse store (stored when +tambah KSE was clicked)
  const kseData = kseStore.getKseData(props.slug);
  if (kseData.namaPerusahaan) {
    formData.namaSistem = kseData.namaPerusahaan;
  }

  // 3. Restore user-editable fields (tahun & tanggal) from localStorage if previously saved
  const stored = localStorage.getItem(PROFILE_KEY);
  if (stored) {
    try {
      const saved = JSON.parse(stored);
      if (saved.tahunPengukuran)  formData.tahunPengukuran  = saved.tahunPengukuran;
      if (saved.tanggalPengisian) formData.tanggalPengisian = saved.tanggalPengisian;
    } catch {}
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

              <!-- Profile info note -->
              <div class="col-12">
                <div class="alert alert-info py-2 mb-0 d-flex align-items-center gap-2">
                  <i class="ri-information-line fs-16"></i>
                  <span class="fs-13">Data instansi diambil otomatis dari profil perusahaan.</span>
                </div>
              </div>

              <!-- ── Nama Instansi / Perusahaan ── -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Nama Instansi / Perusahaan</label>
                <input type="text" class="form-control bg-light"
                  :value="formData.namaPerusahaan" readonly />
              </div>

              <!-- ── Sektor (Sub-Sektor) ── -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Sektor</label>
                <input type="text" class="form-control bg-light"
                  :value="formData.jenisUsaha" readonly />
              </div>

              <!-- ── Nama Sistem Elektronik ── -->
              <div class="col-md-12">
                <label class="form-label fw-semibold">
                  Nama Sistem Elektronik <span class="text-danger">*</span>
                </label>
                <input type="text" class="form-control bg-light" :class="{ 'is-invalid': errors.namaSistem }"
                  :value="formData.namaSistem" readonly />
                <div v-if="errors.namaSistem" class="invalid-feedback">{{ errors.namaSistem }}</div>
                <div class="form-text">Nama sistem dari entri KSE yang dipilih.</div>
              </div>

              <!-- ── Alamat ── -->
              <div class="col-12">
                <label class="form-label fw-semibold">Alamat</label>
                <textarea class="form-control bg-light"
                  :value="formData.alamat" readonly
                  rows="2"></textarea>
              </div>

              <!-- ── Email ── -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Alamat Surel (Email)</label>
                <input type="email" class="form-control bg-light"
                  :value="formData.email" readonly />
              </div>

              <!-- ── Nomor Telepon ── -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Nomor Telepon</label>
                <input type="tel" class="form-control bg-light"
                  :value="formData.nomorTelepon" readonly />
              </div>

              <!-- ── Separator ── -->
              <div class="col-12"><hr class="my-1" /></div>

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
