<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import CountryCodeDropdown from "../shared/CountryCodeDropdown.vue";
import { FriendsList } from "../../data/pages/profiledata";
import { stakeholdersData } from "../../data/dummydata";

// Router & Route
const route = useRoute();
const router = useRouter();

// Computed props from route
const index = computed(() => 
  route.query.index !== undefined ? Number(route.query.index) : null
);
const isEdit = computed(() => index.value !== null && !!FriendsList[index.value]);

// Stakeholder info
const currentSlug = ref("");
const stakeholderName = ref("");

// Page header data
const dataToPass = computed(() => ({
  title: { 
    label: `Profile ${stakeholderName.value || "Stakeholder"}`, 
    path: `/profile-stakeholders/${currentSlug.value}` 
  },
  currentpage: isEdit.value ? "Edit PIC" : "Add PIC",
  activepage: "Account Settings",
}));

// Form state
const form = ref({ name: "", telepon: "" });
const errors = ref({ name: "", telepon: "" });
const selectedCountryCode = ref("+62");
const phoneNumber = ref("");

// UI state
const showSuccessAlert = ref(false);
const showErrorAlert = ref(false);
const errorMessage = ref("Terjadi kesalahan. Silakan coba lagi.");
const isSaving = ref(false);

// Computed
const isFormValid = computed(() => 
  form.value.name.trim() && 
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
  form.value.telepon = phoneNumber.value 
    ? `${selectedCountryCode.value} ${phoneNumber.value}` 
    : "";
};

// Event handlers
const handlePhoneInput = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const nums = input.value.replace(/\D/g, "").slice(0, 12);
  phoneNumber.value = formatPhoneNumber(nums);
  updateFullPhone();
};

const handleCountryCodeChange = () => updateFullPhone();

// Validation
const validateName = () => {
  errors.value.name = form.value.name.trim() ? "" : "Name cannot be empty";
};

const validatePhone = () => {
  const nums = phoneNumber.value.replace(/\D/g, "");
  if (!nums) {
    errors.value.telepon = "Phone number is required";
  } else if (nums.length < 8) {
    errors.value.telepon = "Phone number must be at least 8 digits";
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
    await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate API

    if (isEdit.value && index.value !== null) {
      FriendsList[index.value] = { ...form.value };
    } else {
      FriendsList.push({ ...form.value });
    }

    showSuccessAlert.value = true;
    setTimeout(() => router.back(), 1000);
  } catch {
    showErrorAlert.value = true;
    errorMessage.value = "Terjadi kesalahan. Silakan coba lagi.";
    setTimeout(() => (showErrorAlert.value = false), 3000);
  } finally {
    isSaving.value = false;
  }
};

const handleCancel = () => router.back();

// Initialize
onMounted(() => {
  // Load existing data if editing
  if (isEdit.value && index.value !== null) {
    Object.assign(form.value, FriendsList[index.value]);
    
    // Parse phone number
    const match = form.value.telepon?.match(/^(\+\d+)\s*(.+)$/);
    if (match) {
      selectedCountryCode.value = match[1];
      phoneNumber.value = match[2];
    } else if (form.value.telepon) {
      phoneNumber.value = form.value.telepon;
    }
  }

  // Get stakeholder info from slug
  const slug = route.query.slug as string;
  if (slug) {
    currentSlug.value = slug;
    const found = stakeholdersData.find((s) => s.slug === slug);
    if (found) stakeholderName.value = found.nama_perusahaan;
  }
});
</script>

<template>
  <Pageheader :propData="dataToPass" />
  <!-- Alerts -->
  <div 
    v-if="showSuccessAlert" 
    class="alert alert-success alert-dismissible fade show mb-3 d-flex align-items-center" 
    role="alert"
  >
    <i class="ri-checkbox-circle-line fs-18 me-2"></i>
    <div>Perubahan berhasil disimpan!</div>
    <button type="button" class="btn-close" @click="showSuccessAlert = false"></button>
  </div>

  <div 
    v-if="showErrorAlert" 
    class="alert alert-danger alert-dismissible fade show mb-3 d-flex align-items-center" 
    role="alert"
  >
    <i class="ri-error-warning-line fs-18 me-2"></i>
    <div>{{ errorMessage }}</div>
    <button type="button" class="btn-close" @click="showErrorAlert = false"></button>
  </div>

  <!-- Main Container -->
  <div class="row justify-content-center">
    <div class="col-xl-11 col-xxl-10">
      <div class="card custom-card gradient-header-card">
        <!-- Card Header -->
        <div class="card-header d-flex align-items-center gradient-header-blue">
          <i class="ri-user-add-line text-white me-2 fs-18"></i>
          <div class="card-title text-white mb-0">
            {{ isEdit ? "Edit PIC" : "Tambah PIC" }}
          </div>
        </div>

        <!-- Card Body -->
        <div class="card-body p-4">
          <div class="row gy-4">
            <!-- Name Field -->
            <div class="col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-user-line me-1 text-primary"></i>Nama PIC
              </label>
              <input type="text" class="form-control" v-model="form.name" @blur="validateName" placeholder="Masukkan nama PIC" :class="{ 'is-invalid': errors.name }" />
              <div class="invalid-feedback">{{ errors.name }}</div>
            </div>

            <!-- Phone Field -->
            <div class="col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-phone-line me-1 text-primary"></i>Nomor Telepon
              </label>
              <div class="input-group" :class="{ 'is-invalid': errors.telepon }">
                <CountryCodeDropdown v-model="selectedCountryCode" :error="!!errors.telepon" @update:modelValue="handleCountryCodeChange"/>
                <input type="tel" class="form-control phone-input" v-model="phoneNumber" @input="handlePhoneInput" @blur="validatePhone" inputmode="numeric" placeholder="813-8282-8282" :class="{ 'is-invalid': errors.telepon }"/>
              </div>
              <div v-if="errors.telepon" class="invalid-feedback d-block">
                {{ errors.telepon }}
              </div>
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
.form-control {
  height: calc(2.5rem + 2px);
}

.phone-input {
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
}
</style>
