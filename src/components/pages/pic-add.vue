<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { FriendsList } from "../../data/pages/profiledata";
import { stakeholdersData } from "../../data/dummydata";

const route = useRoute();
const router = useRouter();

const index = computed(() =>
  route.query.index !== undefined ? Number(route.query.index) : null
);
const isEdit = computed(
  () => index.value !== null && !!FriendsList[index.value]
);

const currentSlug = ref("");
const stakeholderName = ref("");

const dataToPass = computed(() => ({
  title: {
    label: `Profile ${stakeholderName.value || "Stakeholder"}`,
    path: `/profile-stakeholders/${currentSlug.value}`,
  },
  currentpage: isEdit.value ? "Edit PIC" : "Add PIC",
  activepage: "Account Settings",
}));

const form = ref({
  name: "",
  telepon: "",
});

const errors = ref({
  name: "",
  telepon: "",
});

const isFormValid = computed(
  () =>
    form.value.name.trim() &&
    form.value.telepon.trim() &&
    !errors.value.name &&
    !errors.value.telepon
);

const showSuccessAlert = ref(false);
const showErrorAlert = ref(false);
const errorMessage = ref("Terjadi kesalahan. Silakan coba lagi.");
const isSaving = ref(false);

onMounted(() => {
  if (isEdit.value && index.value !== null) {
    Object.assign(form.value, FriendsList[index.value]);
  }

  const slug = route.query.slug as string;
  if (slug) {
    currentSlug.value = slug;
    const found = stakeholdersData.find((s) => s.slug === slug);
    if (found) {
      stakeholderName.value = found.nama_perusahaan;
    }
  }
});

const validateName = () => {
  errors.value.name = form.value.name.trim() ? "" : "Name cannot be empty";
};

const validatePhone = () => {
  errors.value.telepon = form.value.telepon.trim()
    ? ""
    : "Phone number is required";
};

const handleSave = async () => {
  validateName();
  validatePhone();

  if (!isFormValid.value) return;

  isSaving.value = true;

  try {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));

    const data = { ...form.value };
    if (isEdit.value && index.value !== null) {
      FriendsList[index.value] = data;
    } else {
      FriendsList.push(data);
    }

    showSuccessAlert.value = true;

    // Redirect after short delay
    setTimeout(() => {
      router.back();
    }, 1000);
  } catch (error) {
    showErrorAlert.value = true;
    errorMessage.value = "Terjadi kesalahan. Silakan coba lagi.";
    setTimeout(() => {
      showErrorAlert.value = false;
    }, 3000);
  } finally {
    isSaving.value = false;
  }
};

const handleCancel = () => router.back();
</script>

<template>
  <Pageheader :propData="dataToPass" />
  <div v-if="showSuccessAlert" class="alert alert-success alert-dismissible fade show mb-3 d-flex align-items-center" role="alert">
    <i class="ri-checkbox-circle-line fs-18 me-2"></i>
    <div>Perubahan berhasil disimpan!</div>
    <button type="button" class="btn-close" @click="showSuccessAlert = false"></button>
  </div>

  <div v-if="showErrorAlert" class="alert alert-danger alert-dismissible fade show mb-3 d-flex align-items-center" role="alert">
    <i class="ri-error-warning-line fs-18 me-2"></i>
    <div>{{ errorMessage }}</div>
    <button type="button" class="btn-close" @click="showErrorAlert = false"></button>
  </div>

  <!-- Main Container -->
  <div class="row justify-content-center">
    <div class="col-xl-11 col-xxl-10">
      <!-- PIC Information Card -->
      <div class="card custom-card gradient-header-card">
        <div class="card-header d-flex align-items-center gradient-header-blue">
          <i class="ri-user-add-line text-white me-2 fs-18"></i>
          <div class="card-title text-white mb-0">
            {{ isEdit ? "Edit PIC" : "Tambah PIC" }}
          </div>
        </div>
        <div class="card-body p-4">
          <div class="row gy-4">
            <!-- Name -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-user-line me-1 text-primary"></i>Nama PIC
              </label>
              <input type="text" class="form-control" v-model="form.name" @blur="validateName" placeholder="Masukkan nama PIC" 
                :class="{ 'is-invalid': errors.name }" />
              <div class="invalid-feedback">{{ errors.name }}</div>
            </div>

            <!-- Phone -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-phone-line me-1 text-primary"></i>Nomor Telepon
              </label>
              <input type="tel" class="form-control" v-model="form.telepon" inputmode="numeric" pattern="[0-9]*" maxlength="15" 
                placeholder="Masukkan nomor telepon" @input="form.telepon = form.telepon.replace(/[^0-9]/g, '')" @blur="validatePhone" 
                :class="{ 'is-invalid': errors.telepon }" />
              <div class="invalid-feedback">{{ errors.telepon }}</div>
            </div>

            <!-- Action Buttons -->
            <div class="col-12">
              <div class="d-flex justify-content-end gap-2">
                <button @click="handleCancel" class="btn btn-outline-danger">
                  <i class="ri-arrow-left-line me-1"></i>Batal
                </button>
                <button @click="handleSave" :disabled="!isFormValid || isSaving" class="btn btn-secondary">
                  <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="ri-save-line me-1"></i>
                  {{ isSaving ? "Menyimpan..." : "Simpan" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

/* Dark mode support for form labels and text */
html[data-theme-mode="dark"] .form-label,
html.dark .form-label {
  color: #cbd5e0 !important;
}

html[data-theme-mode="dark"] .text-primary,
html.dark .text-primary {
  color: var(--primary-color) !important;
}
</style>
