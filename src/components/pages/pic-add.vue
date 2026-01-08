<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import CountryCodeDropdown from "../shared/CountryCodeDropdown.vue";
import { FriendsList } from "../../data/pages/profiledata";
import { stakeholdersData } from "../../data/dummydata";

const route = useRoute();
const router = useRouter();

const index = computed(() => route.query.index !== undefined ? Number(route.query.index) : null);
const isEdit = computed(() => index.value !== null && !!FriendsList[index.value]);

const currentSlug = ref("");
const stakeholderName = ref("");

const dataToPass = computed(() => ({
  title: { label: `Profile ${stakeholderName.value || "Stakeholder"}`, path: `/profile-stakeholders/${currentSlug.value}` },
  currentpage: isEdit.value ? "Edit PIC" : "Add PIC",
  activepage: "Account Settings",
}));

// Phone input state
const selectedCountryCode = ref("+62");
const phoneNumber = ref("");

const form = ref({ name: "", telepon: "" });
const errors = ref({ name: "", telepon: "" });

// Format phone number
const formatPhoneNumber = (value: string) => {
  const numbers = value.replace(/\D/g, "");
  if (selectedCountryCode.value === "+62") {
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)} ${numbers.slice(3, 7)} ${numbers.slice(7, 11)}`;
  } else {
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)} ${numbers.slice(3, 7)} ${numbers.slice(7, 11)}`;
  }
};

const handlePhoneInput = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const numbers = input.value.replace(/\D/g, "").slice(0, 11);
  phoneNumber.value = formatPhoneNumber(numbers);
  form.value.telepon = selectedCountryCode.value + " " + phoneNumber.value;
};

const handleCountryCodeChange = () => {
  if (phoneNumber.value) {
    form.value.telepon = selectedCountryCode.value + " " + phoneNumber.value;
  }
};

const isFormValid = computed(() => form.value.name.trim() && form.value.telepon.trim() && !errors.value.name && !errors.value.telepon);

const showSuccessAlert = ref(false);
const showErrorAlert = ref(false);
const errorMessage = ref("Terjadi kesalahan. Silakan coba lagi.");
const isSaving = ref(false);

onMounted(() => {
  if (isEdit.value && index.value !== null) {
    Object.assign(form.value, FriendsList[index.value]);
    if (form.value.telepon) {
      const match = form.value.telepon.match(/^(\+\d+)\s*(.+)$/);
      if (match) {
        selectedCountryCode.value = match[1];
        phoneNumber.value = match[2];
      } else {
        phoneNumber.value = form.value.telepon;
      }
    }
  }

  const slug = route.query.slug as string;
  if (slug) {
    currentSlug.value = slug;
    const found = stakeholdersData.find((s) => s.slug === slug);
    if (found) stakeholderName.value = found.nama_perusahaan;
  }
});

const validateName = () => {
  errors.value.name = form.value.name.trim() ? "" : "Name cannot be empty";
};

const validatePhone = () => {
  const numbers = phoneNumber.value.replace(/\D/g, "");
  if (!numbers) {
    errors.value.telepon = "Phone number is required";
  } else if (numbers.length < 8) {
    errors.value.telepon = "Phone number must be at least 8 digits";
  } else {
    errors.value.telepon = "";
  }
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
              <div class="input-group" :class="{ 'is-invalid': errors.telepon }">
                <!-- Country Code Dropdown Component -->
                <CountryCodeDropdown 
                  v-model="selectedCountryCode" 
                  :error="!!errors.telepon"
                  @update:modelValue="handleCountryCodeChange"
                />
                
                <!-- Phone Number Input -->
                <input 
                  type="tel" 
                  class="form-control" 
                  v-model="phoneNumber"
                  @input="handlePhoneInput"
                  @blur="validatePhone"
                  inputmode="numeric" 
                  placeholder="813 8282 8282"
                  :class="{ 'is-invalid': errors.telepon }"
                />
              </div>
              <div class="invalid-feedback d-block" v-if="errors.telepon">{{ errors.telepon }}</div>
              <div class="form-text text-muted mt-1">
                <i class="ri-information-line"></i> Format: {{ selectedCountryCode }} 813 8282 8282
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
/* Component styles are now in CountryCodeDropdown.vue */
</style>
