<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { picService } from "../../services/pic.service";
import { useStakeholdersStore } from "../../stores/stakeholders";

// Router & Route
const route = useRoute();
const router = useRouter();
const stakeholdersStore = useStakeholdersStore();

// Route params
const picId = computed(() => route.query.picId as string | undefined);
const isEdit = computed(() => !!picId.value);

// Stakeholder info
const currentSlug = ref("");
const currentPerusahaanId = ref<string | number>("");
const stakeholderName = ref("");

// Page header data
const dataToPass = computed(() => ({
  title: {
    label: `Profile ${stakeholderName.value || "Stakeholder"}`,
    path: `/stakeholders/${currentSlug.value}`,
  },
  currentpage: isEdit.value ? "Edit PIC" : "Add PIC",
  activepage: "Account Settings",
}));

// Form state
const form = ref({ nama: "", telepon: "" });
const errors = ref({ name: "", telepon: "" });
const phoneNumber = ref("");

// Input refs
const inputName = ref<HTMLInputElement | null>(null);
const inputPhone = ref<HTMLInputElement | null>(null);

// UI state
const showSuccessAlert = ref(false);
const showErrorAlert = ref(false);
const errorMessage = ref("Terjadi kesalahan. Silakan coba lagi.");
const isSaving = ref(false);
const isLoadingPic = ref(false);

// Computed
const isFormValid = computed(() =>
  form.value.nama.trim() &&
  form.value.telepon.trim() &&
  !errors.value.name &&
  !errors.value.telepon
);

// Phone formatting - format: XXX-XXXX-XXXX
const formatPhoneNumber = (value: string): string => {
  const nums = value.replace(/\D/g, "");
  if (nums.length <= 3) return nums;
  if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
  return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7, 12)}`;
};

const updateFullPhone = () => {
  form.value.telepon = phoneNumber.value ? `+62 ${phoneNumber.value}` : "";
};

// Event handlers
const handlePhoneInput = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const nums = input.value.replace(/\D/g, "").slice(0, 12);
  phoneNumber.value = formatPhoneNumber(nums);
  updateFullPhone();
};

// Validation
const validateName = () => {
  errors.value.name = form.value.nama.trim() ? "" : "Nama tidak boleh kosong";
};

const validatePhone = () => {
  const nums = phoneNumber.value.replace(/\D/g, "");
  if (!nums) {
    errors.value.telepon = "Nomor telepon wajib diisi";
  } else if (nums.length < 8) {
    errors.value.telepon = "Nomor telepon minimal 8 digit";
  } else {
    errors.value.telepon = "";
  }
};

// Actions
const handleSave = async () => {
  validateName();
  validatePhone();
  if (!isFormValid.value) return;

  isSaving.value = true;
  try {
    if (isEdit.value && picId.value) {
      await picService.update(picId.value, {
        nama: form.value.nama,
        telepon: form.value.telepon,
      });
    } else {
      await picService.create({
        nama: form.value.nama,
        telepon: form.value.telepon,
        id_perusahaan: currentPerusahaanId.value,
      });
    }

    showSuccessAlert.value = true;
    setTimeout(() => router.back(), 1000);
  } catch (err: any) {
    showErrorAlert.value = true;
    errorMessage.value = err?.message || "Terjadi kesalahan. Silakan coba lagi.";
    setTimeout(() => (showErrorAlert.value = false), 3000);
  } finally {
    isSaving.value = false;
  }
};

const handleCancel = () => router.back();

const focusInput = (inputRef: any) => {
  const el = inputRef?.value || inputRef;
  if (el && typeof el.focus === "function") el.focus();
};

// Initialize
onMounted(async () => {
  // Get stakeholder info from slug
  const slug = route.query.slug as string;
  const idPerusahaan = route.query.id_perusahaan as string;

  if (slug) {
    currentSlug.value = slug;
    if (!stakeholdersStore.initialized) await stakeholdersStore.initialize();
    const found = stakeholdersStore.getStakeholderBySlug(slug);
    if (found) {
      stakeholderName.value = found.nama_perusahaan;
      currentPerusahaanId.value = found.id;
    }
  }

  if (idPerusahaan) {
    currentPerusahaanId.value = idPerusahaan;
  }

  // Load existing PIC if editing
  if (isEdit.value && picId.value) {
    isLoadingPic.value = true;
    try {
      const pic = await picService.getById(picId.value);
      form.value.nama = pic.nama;
      form.value.telepon = pic.telepon;

      // Parse phone number — strip +62 prefix if present
      const match = pic.telepon?.match(/^\+62\s*(.+)$/);
      phoneNumber.value = match ? match[1] : pic.telepon;
    } catch (err: any) {
      showErrorAlert.value = true;
      errorMessage.value = "Gagal memuat data PIC.";
    } finally {
      isLoadingPic.value = false;
    }
  }
});
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Alerts - Toast Style -->
  <transition name="slide-toast">
    <div v-if="showSuccessAlert" class="settings-toast settings-toast--success">
      <div class="settings-toast-icon"><i class="ri-checkbox-circle-fill"></i></div>
      <div class="settings-toast-body"><strong>Berhasil!</strong> Perubahan berhasil disimpan.</div>
      <button class="settings-toast-close" @click="showSuccessAlert = false"><i class="ri-close-line"></i></button>
    </div>
  </transition>
  <transition name="slide-toast">
    <div v-if="showErrorAlert" class="settings-toast settings-toast--error">
      <div class="settings-toast-icon"><i class="ri-error-warning-fill"></i></div>
      <div class="settings-toast-body"><strong>Error!</strong> {{ errorMessage }}</div>
      <button class="settings-toast-close" @click="showErrorAlert = false"><i class="ri-close-line"></i></button>
    </div>
  </transition>

  <!-- Main Container -->
  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card gradient-header-card">
        <!-- Card Header -->
        <div class="card-header d-flex align-items-center justify-content-between gap-3 users-header">
          <div class="d-flex align-items-center gap-3">
            <div class="header-icon-box">
              <i class="ri-user-add-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">
                {{ isEdit ? "Edit PIC" : "Tambah PIC" }}
              </div>
              <div class="header-subtitle mt-1">
                {{ isEdit ? "Ubah data Person in Charge" : "Tambah Person in Charge baru" }} — {{ stakeholderName || "Stakeholder" }}
              </div>
            </div>
          </div>
        </div>

        <!-- Card Body -->
        <div class="card-body p-4">
          <!-- Loading state -->
          <div v-if="isLoadingPic" class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <div class="text-muted mt-2 fs-13">Memuat data PIC...</div>
          </div>

          <div v-else class="row g-3">
            <!-- Name Field -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <div class="form-group-split" @click="focusInput(inputName)">
                <div class="form-group-split-label-card">
                  <div class="form-item-icon stat-icon-blue" style="width:32px;height:32px">
                    <i class="ri-user-line" style="font-size:0.95rem"></i>
                  </div>
                  <label class="form-item-label mb-0">
                    Nama PIC <span class="text-danger">*</span>
                  </label>
                </div>
                <div class="form-group-split-input-card" :class="{ 'is-invalid-card': errors.name }">
                  <input
                    ref="inputName"
                    type="text"
                    class="form-item-input"
                    v-model="form.nama"
                    @blur="validateName"
                    placeholder="Masukkan nama PIC"
                  />
                  <i class="ri-pencil-line form-item-edit-action"></i>
                </div>
              </div>
              <div v-if="errors.name" class="text-danger mt-1 fs-12">
                <i class="ri-error-warning-line me-1"></i>{{ errors.name }}
              </div>
            </div>

            <!-- Phone Field -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <div class="form-group-split" @click="focusInput(inputPhone)">
                <div class="form-group-split-label-card">
                  <div class="form-item-icon stat-icon-teal" style="width:32px;height:32px">
                    <i class="ri-phone-line" style="font-size:0.95rem"></i>
                  </div>
                  <label class="form-item-label mb-0">
                    Nomor Telepon <span class="text-danger">*</span>
                  </label>
                </div>
                <div class="form-group-split-input-card" :class="{ 'is-invalid-card': errors.telepon }">
                  <div class="input-group input-group-sm">
                    <span class="input-group-text fw-semibold bg-transparent border-0 px-0 pe-2">+62</span>
                    <input
                      ref="inputPhone"
                      type="tel"
                      class="form-control border-0 p-0 shadow-none bg-transparent form-item-input"
                      v-model="phoneNumber"
                      @input="handlePhoneInput"
                      @blur="validatePhone"
                      inputmode="numeric"
                      placeholder="813-8282-8282"
                    />
                  </div>
                  <i class="ri-pencil-line form-item-edit-action"></i>
                </div>
              </div>
              <div v-if="errors.telepon" class="text-danger mt-1 fs-12">
                <i class="ri-error-warning-line me-1"></i>{{ errors.telepon }}
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="col-12">
              <div class="d-flex justify-content-end gap-2">
                <button @click="handleCancel" class="btn-cancel-glass rounded-pill px-4">
                  <i class="ri-arrow-left-line me-1"></i>Batal
                </button>
                <button @click="handleSave" :disabled="!isFormValid || isSaving" class="btn-save-primary rounded-pill px-4">
                  <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="ri-save-line me-1"></i>
                  {{ isSaving ? "Menyimpan..." : "Simpan Perubahan" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

