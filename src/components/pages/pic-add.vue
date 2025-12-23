<script setup lang="ts">
import { ref, onMounted, computed, reactive } from "vue";
import { useRoute, useRouter } from "vue-router";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { FriendsList } from "../../data/pages/profiledata";
import { stakeholdersData } from "../../data/dummydata";

const route = useRoute();
const router = useRouter();
const DEFAULT_IMAGE = "/images/faces/face9.png";

// Image validation constants
const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_FORMATS = ["image/jpeg", "image/png", "image/gif"];
const ALLOWED_EXTENSIONS = "JPEG, PNG, GIF";

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
  imgSrc: DEFAULT_IMAGE,
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

const fileInput = ref<HTMLInputElement | null>(null);
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

const openFilePicker = () => fileInput.value?.click();

const handleImageChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  // Validate file format
  if (!ALLOWED_FORMATS.includes(file.type)) {
    showErrorAlert.value = true;
    errorMessage.value = `Format file tidak didukung. Gunakan ${ALLOWED_EXTENSIONS}.`;
    setTimeout(() => {
      showErrorAlert.value = false;
    }, 4000);
    input.value = "";
    return;
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    showErrorAlert.value = true;
    errorMessage.value = `Ukuran file terlalu besar. Maksimal ${MAX_FILE_SIZE_MB}MB.`;
    setTimeout(() => {
      showErrorAlert.value = false;
    }, 4000);
    input.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => (form.value.imgSrc = reader.result as string);
  reader.readAsDataURL(file);
};

const removeImage = () => {
  form.value.imgSrc = DEFAULT_IMAGE;
  if (fileInput.value) fileInput.value.value = "";
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

  <!-- Alerts -->
  <div
    v-if="showSuccessAlert"
    class="alert alert-success alert-dismissible fade show mb-3 d-flex align-items-center"
    role="alert"
  >
    <i class="ri-checkbox-circle-line fs-18 me-2"></i>
    <div>Perubahan berhasil disimpan!</div>
    <button
      type="button"
      class="btn-close"
      @click="showSuccessAlert = false"
    ></button>
  </div>

  <div
    v-if="showErrorAlert"
    class="alert alert-danger alert-dismissible fade show mb-3 d-flex align-items-center"
    role="alert"
  >
    <i class="ri-error-warning-line fs-18 me-2"></i>
    <div>{{ errorMessage }}</div>
    <button
      type="button"
      class="btn-close"
      @click="showErrorAlert = false"
    ></button>
  </div>

  <!-- Main Container -->
  <div class="row justify-content-center">
    <div class="col-xl-11 col-xxl-10">
      <!-- PIC Information Card -->
      <div class="card custom-card">
        <div
          class="card-header d-flex align-items-center"
          style="background: linear-gradient(90deg, #1e3a5f 0%, #2c5282 100%)"
        >
          <i class="ri-user-add-line text-white me-2 fs-18"></i>
          <div class="card-title text-white mb-0">
            {{ isEdit ? "Edit PIC" : "Tambah PIC" }}
          </div>
        </div>
        <div class="card-body p-4">
          <div class="row gy-4">
            <!-- Profile Picture Section -->
            <div class="col-xl-12">
              <div class="d-flex align-items-start flex-wrap gap-3">
                <div class="position-relative">
                  <span
                    class="avatar avatar-xxl avatar-rounded shadow border border-2 border-light overflow-hidden"
                  >
                    <img :src="form.imgSrc" alt="Profile Avatar" />
                  </span>
                  <input
                    ref="fileInput"
                    type="file"
                    :accept="ALLOWED_FORMATS.join(',')"
                    class="d-none"
                    @change="handleImageChange"
                  />
                </div>
                <div>
                  <span class="fw-medium d-block mb-2">Profile Picture</span>
                  <div class="btn-list mb-1">
                    <button
                      class="btn btn-sm btn-primary btn-wave"
                      @click="openFilePicker"
                    >
                      <i class="ri-upload-2-line me-1"></i>Change Image
                    </button>
                    <button
                      class="btn btn-sm btn-light btn-wave"
                      @click="removeImage"
                    >
                      <i class="ri-delete-bin-line me-1"></i>Remove
                    </button>
                  </div>
                  <span class="d-block fs-12 text-muted">
                    <i class="ri-information-line me-1"></i>
                    Format: {{ ALLOWED_EXTENSIONS }} | Max:
                    {{ MAX_FILE_SIZE_MB }}MB | Best size: 200x200 pixels
                  </span>
                </div>
              </div>
            </div>

            <!-- Name -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-user-line me-1 text-primary"></i>Nama PIC
              </label>
              <input
                type="text"
                class="form-control"
                v-model="form.name"
                @blur="validateName"
                placeholder="Masukkan nama PIC"
                :class="{ 'is-invalid': errors.name }"
              />
              <div class="invalid-feedback">{{ errors.name }}</div>
            </div>

            <!-- Phone -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-phone-line me-1 text-primary"></i>Nomor Telepon
              </label>
              <input
                type="tel"
                class="form-control"
                v-model="form.telepon"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="15"
                placeholder="Masukkan nomor telepon"
                @input="form.telepon = form.telepon.replace(/[^0-9]/g, '')"
                @blur="validatePhone"
                :class="{ 'is-invalid': errors.telepon }"
              />
              <div class="invalid-feedback">{{ errors.telepon }}</div>
            </div>

            <!-- Action Buttons -->
            <div class="col-12">
              <div class="d-flex justify-content-end gap-2">
                <button @click="handleCancel" class="btn btn-outline-danger">
                  <i class="ri-arrow-left-line me-1"></i>Batal
                </button>
                <button
                  @click="handleSave"
                  :disabled="!isFormValid || isSaving"
                  class="btn btn-secondary"
                >
                  <span
                    v-if="isSaving"
                    class="spinner-border spinner-border-sm me-2"
                  ></span>
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
.avatar img {
  object-fit: cover;
}
</style>
