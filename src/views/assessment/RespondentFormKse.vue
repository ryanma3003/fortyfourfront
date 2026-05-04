<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useKseStore } from '@/stores/kse';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { csirtService } from '@/services/csirt.service';

// ----- Props & Emits -----
const props = defineProps<{ slug: string; stakeholderSlug?: string; seId?: string }>();

const emit = defineEmits<{
  (e: 'submit'): void;
  (e: 'cancel'): void;
}>();

const kseStore          = useKseStore();
const stakeholdersStore = useStakeholdersStore();

// ----- Storage key -----
const PROFILE_KEY = `kse_respondent_${props.slug}`;

// ----- Form state -----
interface KseRespondentProfile {
  namaPerusahaan   : string;
  jenisUsaha       : string;
  namaSistem       : string;
  alamat           : string;
  email            : string;
  nomorTelepon     : string;
  tanggalPengisian : string;
  ip_se            : string;
  as_number_se     : string;
  pengelola_se     : string;
  fitur_se         : string;
  fromCsirt?       : boolean;
  id_csirt?        : string;
  id_perusahaan?   : string;
  id_sub_sektor?   : string;
  seId?            : string | number;
}

const formData = reactive<KseRespondentProfile>({
  namaPerusahaan   : '',
  jenisUsaha       : '',
  namaSistem       : '',
  alamat           : '',
  email            : '',
  nomorTelepon     : '',
  tanggalPengisian : new Date().toISOString().split('T')[0],
  ip_se            : '',
  as_number_se     : '',
  pengelola_se     : '',
  fitur_se         : '',
  fromCsirt        : false,
});

// When from CSIRT flow, SE detail fields are editable on this form
const isFromCsirt = computed(() => !!formData.fromCsirt);

// ----- Validation -----
const errors = reactive<Record<string, string>>({});
const saveIndicator = ref('');

const validateField = (field: string, value: any): string => {
  const v = String(value ?? '').trim();
  switch (field) {
    case 'namaSistem': return v === '' ? 'Nama sistem elektronik wajib diisi' : '';
    case 'ip_se'     : return (isFromCsirt.value && v === '') ? 'IP SE wajib diisi' : '';
    default          : return '';
  }
};

const requiredFields = computed((): (keyof KseRespondentProfile)[] =>
  isFromCsirt.value ? ['namaSistem', 'ip_se'] : ['namaSistem']
);

const validateForm = (): boolean => {
  Object.keys(errors).forEach(k => delete errors[k]);
  const newErrors: Record<string, string> = {};
  requiredFields.value.forEach(f => {
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
  kseStore.ensureStakeholderData(props.slug);
  kseStore.updateStakeholderInfo(props.slug, formData.namaSistem, formData.jenisUsaha);

  // Keep kse_list namaSistem in sync (when filled from this form)
  if (isFromCsirt.value && formData.namaSistem) {
    const companySlug = props.stakeholderSlug || '';
    const listKey = `kse_list_${companySlug}`;
    try {
      const list = JSON.parse(localStorage.getItem(listKey) || '[]');
      const idx = list.findIndex((e: any) => e.id === props.slug);
      if (idx !== -1) { list[idx].namaSistem = formData.namaSistem; localStorage.setItem(listKey, JSON.stringify(list)); }
    } catch {}
  }
};

onMounted(async () => {
  kseStore.initialize();
  if (!stakeholdersStore.initialized) {
    await stakeholdersStore.initialize();
  }

  // 1. Fill company info from stakeholder profile (API /api/perusahaan)
  const companySlug = props.stakeholderSlug || '';
  if (companySlug) {
    const stakeholder = stakeholdersStore.getStakeholderBySlug(companySlug);
    if (stakeholder) {
      formData.namaPerusahaan = stakeholder.nama_perusahaan || '';
      formData.alamat         = stakeholder.alamat          || '';
      formData.email          = stakeholder.email           || '';
      formData.nomorTelepon   = stakeholder.telepon         || '';
      formData.jenisUsaha     = stakeholder.sub_sektor?.nama_sub_sektor || stakeholder.sektor || '';
      formData.id_perusahaan  = stakeholder.id              || '';
      formData.id_sub_sektor  = stakeholder.sub_sektor?.id  || '';
    }
  }

  // 2. Try to load from localStorage first
  let loadedFromLocal = false;
  const stored = localStorage.getItem(PROFILE_KEY);
  if (stored) {
    try {
      const saved = JSON.parse(stored);
      // Ensure we don't accidentally load old garbage for a different SE
      if (!props.seId || String(saved.seId) === String(props.seId)) {
        Object.assign(formData, saved);
        loadedFromLocal = true;
      }
    } catch {}
  }

  // 3. If seId exists AND we didn't just load it from local, fetch SE data from API
  if (props.seId && !loadedFromLocal) {
    try {
      const se = await csirtService.getSeById(props.seId);
      if (se) {
        formData.namaSistem    = se.nama_se       || '';
        formData.ip_se         = se.ip_se         || '';
        formData.as_number_se  = se.as_number_se  || '';
        formData.pengelola_se  = se.pengelola_se  || '';
        formData.fitur_se      = se.fitur_se      || '';
        formData.seId          = se.id;
        formData.id_csirt      = se.id_csirt      || formData.id_csirt;
        formData.id_perusahaan = se.id_perusahaan || formData.id_perusahaan;
        formData.id_sub_sektor = se.id_sub_sektor || formData.id_sub_sektor;
        formData.fromCsirt     = true;  // SE data fields editable
      }
    } catch {}
  }

  // 4. Auto-fill namaSistem from kse store if still empty
  if (!formData.namaSistem) {
    const kseData = kseStore.getKseData(props.slug);
    if (kseData.namaPerusahaan) {
      formData.namaSistem = kseData.namaPerusahaan;
    }
  }

  // 5. Save to localStorage for sub-components
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...formData }));
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

        <div class="card-header">
          <div class="card-title d-flex align-items-center gap-2">
            <i class="ri-file-list-3-line text-primary"></i>
            Data Responden Kategorisasi Sistem Elektronik (KSE)
          </div>
        </div>

        <div class="card-body">

          <transition name="fade">
            <div v-if="saveIndicator" class="alert alert-success py-2 mb-3">
              <i class="ri-check-line me-1"></i>{{ saveIndicator }}
            </div>
          </transition>

          <form @submit.prevent="handleSubmit" novalidate>
            <div class="row g-3">

              <div class="col-12">
                <div class="alert alert-info py-2 mb-0 d-flex align-items-center gap-2">
                  <i class="ri-information-line fs-16"></i>
                  <span class="fs-13">Data instansi diambil otomatis dari profil perusahaan.</span>
                </div>
              </div>

              <!--  Nama Instansi / Perusahaan  -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Nama Instansi / Perusahaan</label>
                <input type="text" class="form-control bg-light" :value="formData.namaPerusahaan" readonly />
              </div>

              <!--  Sektor  -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Sektor</label>
                <input type="text" class="form-control bg-light" :value="formData.jenisUsaha" readonly />
              </div>

              <!--  Nama Sistem Elektronik  editable when fromCsirt -->
              <div class="col-md-12">
                <label class="form-label fw-semibold">
                  Nama Sistem Elektronik <span class="text-danger">*</span>
                </label>
                <input
                  v-if="isFromCsirt"
                  type="text"
                  class="form-control" :class="{ 'is-invalid': errors.namaSistem }"
                  v-model="formData.namaSistem"
                  @blur="handleFieldBlur('namaSistem')"
                  placeholder="Nama sistem elektronik" />
                <input
                  v-else
                  type="text"
                  class="form-control bg-light" :class="{ 'is-invalid': errors.namaSistem }"
                  :value="formData.namaSistem" readonly />
                <div v-if="errors.namaSistem" class="invalid-feedback">{{ errors.namaSistem }}</div>
                <div v-if="!isFromCsirt" class="form-text">Nama sistem dari entri KSE yang dipilih.</div>
              </div>

              <!--  SE Detail fields editable when fromCsirt  -->
              <template v-if="isFromCsirt">
                <div class="col-12">
                  <div class="fs-12 fw-semibold text-muted text-uppercase border-bottom pb-1 mt-1">
                    <i class="ri-server-line me-1"></i>Detail Sistem Elektronik
                  </div>
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">IP SE <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" :class="{ 'is-invalid': errors.ip_se }"
                    v-model="formData.ip_se" @blur="handleFieldBlur('ip_se')"
                    placeholder="Contoh: 192.168.1.1" />
                  <div v-if="errors.ip_se" class="invalid-feedback">{{ errors.ip_se }}</div>
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">AS Number</label>
                  <input type="text" class="form-control" v-model="formData.as_number_se"
                    @blur="handleFieldBlur('as_number_se')" placeholder="Contoh: AS12345" />
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Pengelola</label>
                  <input type="text" class="form-control" v-model="formData.pengelola_se"
                    @blur="handleFieldBlur('pengelola_se')" placeholder="Contoh: PT Maju Jaya" />
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Fitur SE</label>
                  <input type="text" class="form-control" v-model="formData.fitur_se"
                    @blur="handleFieldBlur('fitur_se')" placeholder="Contoh: Firewall, IDS" />
                </div>
              </template>

              <div class="col-12"><hr class="my-1" /></div>

              <!--  Tanggal Pengisian  -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Tanggal Pengisian <span class="text-danger">*</span></label>
                <input type="date" class="form-control" v-model="formData.tanggalPengisian"
                  @change="handleFieldBlur('tanggalPengisian')" />
              </div>

            </div>

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
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-label  { font-weight: 500; margin-bottom: 0.4rem; }
.text-danger { color: var(--danger) !important; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>
