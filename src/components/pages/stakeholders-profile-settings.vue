<script setup lang="ts">
import { ref, onMounted, reactive, computed } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useRouter, useRoute } from "vue-router";
import { stakeholdersData } from "../../data/dummydata";
import type { Stakeholder } from "../../data/dummydata";

const router = useRouter();
const route = useRoute();

const handleCancel = () => {
  router.back();
};

const form = reactive<Partial<Stakeholder>>({
  nama_perusahaan: "",
  email: "",
  telepon: "",
  sektor: "",
  website: "",
  alamat: "",
  photo: "",
});

const currentSlug = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

// Image validation constants
const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_FORMATS = ["image/jpeg", "image/png", "image/gif"];
const ALLOWED_EXTENSIONS = "JPEG, PNG, GIF";

onMounted(() => {
  const slug = route.query.slug as string;
  if (slug) {
    currentSlug.value = slug;
    const found = stakeholdersData.find((s) => s.slug === slug);
    if (found) {
      form.nama_perusahaan = found.nama_perusahaan;
      form.email = found.email;
      form.telepon = found.telepon;
      form.sektor = found.sektor;
      form.website = found.website;
      form.alamat = found.alamat;
      form.photo = found.photo;
    }
  }
});

const triggerFileInput = () => {
  fileInput.value?.click();
};

const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const file = target.files[0];

    // Validate file format
    if (!ALLOWED_FORMATS.includes(file.type)) {
      showErrorAlert.value = true;
      errorMessage.value = `Format file tidak didukung. Gunakan ${ALLOWED_EXTENSIONS}.`;
      setTimeout(() => {
        showErrorAlert.value = false;
      }, 4000);
      target.value = "";
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showErrorAlert.value = true;
      errorMessage.value = `Ukuran file terlalu besar. Maksimal ${MAX_FILE_SIZE_MB}MB.`;
      setTimeout(() => {
        showErrorAlert.value = false;
      }, 4000);
      target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        form.photo = e.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  }
};

const removeImage = () => {
  form.photo = "";
};

const saveChanges = async () => {
  isSaving.value = true;

  try {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));

    const foundIndex = stakeholdersData.findIndex(
      (s) => s.slug === currentSlug.value
    );
    if (foundIndex !== -1) {
      Object.assign(stakeholdersData[foundIndex], form);
      showSuccessAlert.value = true;

      // Redirect after short delay
      setTimeout(() => {
        router.push(`/profile-stakeholders/${currentSlug.value}`);
      }, 1000);
    }
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

//Reactive State
const dataToPass = computed(() => ({
  title: {
    label: `Profile ${form.nama_perusahaan || "Stakeholder"}`,
    path: `/profile-stakeholders/${currentSlug.value}`,
  },
  currentpage: "Account Settings",
  activepage: "Account Settings",
}));

const isSaving = ref(false);
const showSuccessAlert = ref(false);
const showErrorAlert = ref(false);
const errorMessage = ref("Terjadi kesalahan. Silakan coba lagi.");
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
      <!-- Account Information Card -->
      <div class="card custom-card">
        <div
          class="card-header d-flex align-items-center"
          style="background: linear-gradient(90deg, #1e3a5f 0%, #2c5282 100%)"
        >
          <i class="ri-building-2-line text-white me-2 fs-18"></i>
          <div class="card-title text-white mb-0">Informasi Perusahaan</div>
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
                    <img
                      :src="form.photo || '/images/faces/9.jpg'"
                      alt="Profile Avatar"
                    />
                  </span>
                  <input
                    ref="fileInput"
                    type="file"
                    :accept="ALLOWED_FORMATS.join(',')"
                    class="d-none"
                    @change="onFileChange"
                  />
                </div>
                <div>
                  <span class="fw-medium d-block mb-2">Profile Picture</span>
                  <div class="btn-list mb-1">
                    <button
                      class="btn btn-sm btn-primary btn-wave"
                      @click="triggerFileInput"
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

            <!-- Nama Perusahaan -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-building-line me-1 text-primary"></i>Nama
                Perusahaan
              </label>
              <input
                type="text"
                class="form-control"
                v-model="form.nama_perusahaan"
                placeholder="Masukkan nama perusahaan"
              />
            </div>

            <!-- Sektor -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-pie-chart-line me-1 text-primary"></i>Sektor
              </label>
              <select class="form-select" v-model="form.sektor">
                <option value="" disabled>-- Pilih Sektor --</option>
                <option value="Teknologi Informasi">Teknologi Informasi</option>
                <option value="Perdagangan Umum">Perdagangan Umum</option>
                <option value="Software Development">
                  Software Development
                </option>
                <option value="Konstruksi">Konstruksi</option>
                <option value="teknologi">Teknologi</option>
                <option value="keuangan">Keuangan</option>
                <option value="kesehatan">Kesehatan</option>
                <option value="pendidikan">Pendidikan</option>
                <option value="manufaktur">Manufaktur</option>
              </select>
            </div>

            <!-- Email -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-mail-line me-1 text-primary"></i>Email
              </label>
              <input
                type="email"
                class="form-control"
                v-model="form.email"
                placeholder="Masukkan email"
              />
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
                placeholder="Masukkan nomor telepon"
              />
            </div>

            <!-- Website -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-global-line me-1 text-primary"></i>Website
              </label>
              <input
                type="url"
                class="form-control"
                v-model="form.website"
                placeholder="Masukkan website"
              />
            </div>

            <!-- Empty column for alignment -->
            <div class="col-xl-6 col-lg-6 col-md-6 d-none d-md-block"></div>

            <!-- Alamat -->
            <div class="col-12">
              <label class="form-label fw-medium">
                <i class="ri-map-pin-line me-1 text-primary"></i>Alamat
              </label>
              <textarea
                class="form-control"
                v-model="form.alamat"
                rows="3"
                placeholder="Masukkan alamat lengkap"
              ></textarea>
            </div>

            <!-- Action Buttons -->
            <div class="col-12">
              <div class="d-flex justify-content-end gap-2">
                <button @click="handleCancel" class="btn btn-outline-danger">
                  <i class="ri-arrow-left-line me-1"></i>Batal
                </button>
                <button
                  @click="saveChanges"
                  :disabled="isSaving"
                  class="btn btn-secondary"
                >
                  <span
                    v-if="isSaving"
                    class="spinner-border spinner-border-sm me-2"
                  ></span>
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

<style scoped>
/* Add your styles here */
</style>
