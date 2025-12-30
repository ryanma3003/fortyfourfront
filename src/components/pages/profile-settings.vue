<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useProfileStore } from "../../stores/profile";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";

const DEFAULT_AVATAR = "/images/faces/9.jpg";
const DEFAULT_BANNER = "/images/media/media-3.jpg";
const MAX_BANNER_SIZE = 5 * 1024 * 1024; // 5MB

const dataToPass = {
  title: { label: "Profile", path: "/profile" },
  currentpage: "Profile Settings",
  activepage: "Profile Settings",
};

const router = useRouter();
const profileStore = useProfileStore();

const isSaving = ref(false);
const showSuccessAlert = ref(false);
const showErrorAlert = ref(false);

const formData = ref({
  name: "",
  role: "",
  jabatan: "",
  location: "",
  email: "",
  phone: "",
  website: "",
  bio: "",
  address: "",
});

const avatarInput = ref<HTMLInputElement | null>(null);
const avatarPreview = ref("");
const bannerInput = ref<HTMLInputElement | null>(null);
const bannerPreview = ref("");

const passwordData = ref({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

onMounted(() => {
  profileStore.loadFromStorage();
  profileStore.initFromAuth();
  resetForm();
});

const resetForm = () => {
  formData.value = {
    name: profileStore.displayName,
    role: profileStore.displayRole,
    jabatan: profileStore.displayJabatan,
    location: profileStore.location,
    email: profileStore.displayEmail,
    phone: profileStore.phone,
    website: profileStore.website,
    bio: profileStore.bio,
    address: profileStore.address,
  };
  avatarPreview.value = profileStore.avatarUrl;
  bannerPreview.value = profileStore.bannerUrl;
};

const saveProfile = async () => {
  isSaving.value = true;

  try {
    await new Promise((resolve) => setTimeout(resolve, 800));

    profileStore.updateProfile({
      ...formData.value,
      avatarUrl: avatarPreview.value,
      bannerUrl: bannerPreview.value,
    });

    showSuccessAlert.value = true;
    setTimeout(() => router.push("/profile"), 1000);
  } catch {
    showErrorAlert.value = true;
    setTimeout(() => (showErrorAlert.value = false), 3000);
  } finally {
    isSaving.value = false;
  }
};

const triggerAvatarUpload = () => avatarInput.value?.click();

const handleAvatarChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    avatarPreview.value = e.target?.result as string;
  };
  reader.readAsDataURL(file);
};

const triggerBannerUpload = () => bannerInput.value?.click();

const handleBannerChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  if (file.size > MAX_BANNER_SIZE) {
    alert("Ukuran file maksimal 5MB");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    bannerPreview.value = e.target?.result as string;
  };
  reader.readAsDataURL(file);
};

const removeBanner = () => {
  bannerPreview.value = DEFAULT_BANNER;
};

const savePassword = async () => {
  if (passwordData.value.newPassword !== passwordData.value.confirmPassword) {
    alert("Password tidak cocok!");
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  passwordData.value = {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  };

  showSuccessAlert.value = true;
  setTimeout(() => (showSuccessAlert.value = false), 3000);
};
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
    <div>Terjadi kesalahan. Silakan coba lagi.</div>
    <button
      type="button"
      class="btn-close"
      @click="showErrorAlert = false"
    ></button>
  </div>

  <!-- Main Container -->
  <div class="row justify-content-center">
    <div class="col-xl-11 col-xxl-10">
      <div class="card custom-card overflow-hidden profile-main-card mb-3">
        <!-- Banner Image -->
        <div
          class="profile-header-banner position-relative"
          :style="{
            backgroundImage: `url(${bannerPreview})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '180px',
          }"
        >
          <!-- Overlay -->
          <div
            class="position-absolute w-100 h-100"
            style="
              background: linear-gradient(
                to bottom,
                rgba(30, 58, 95, 0.3) 0%,
                rgba(26, 54, 93, 0.1) 100%
              );
            "
          ></div>

          <!-- Banner Edit Buttons -->
          <div class="position-absolute top-0 end-0 p-3">
            <div class="d-flex gap-2">
              <button
                @click="triggerBannerUpload"
                class="btn btn-light btn-sm rounded-pill shadow-sm d-flex align-items-center gap-1"
                title="Ganti Banner"
              >
                <i class="ri-image-edit-line"></i>
                <span class="d-none d-sm-inline">Ganti Banner</span>
              </button>
              <button
                v-if="bannerPreview !== DEFAULT_BANNER"
                @click="removeBanner"
                class="btn btn-danger btn-sm rounded-pill shadow-sm d-flex align-items-center gap-1"
                title="Hapus Banner"
              >
                <i class="ri-delete-bin-line"></i>
              </button>
            </div>
          </div>

          <input
            ref="bannerInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="d-none"
            @change="handleBannerChange"
          />
        </div>

        <!-- Card Body - Avatar + User Info -->
        <div class="card-body p-3 p-md-4 pb-4 position-relative">
          <div
            class="d-flex align-items-end justify-content-between flex-wrap gap-3"
            style="margin-top: -70px"
          >
            <div class="d-flex align-items-end gap-3 flex-wrap">
              <!-- Avatar with Edit Actions -->
              <div class="position-relative">
                <div class="avatar-container">
                  <span
                    class="avatar avatar-xxl avatar-rounded shadow-lg border border-4 border-white overflow-hidden"
                  >
                    <img :src="avatarPreview" alt="Profile Avatar" />
                  </span>
                  <div
                    class="avatar-actions position-absolute bottom-0 d-flex gap-1"
                  >
                    <button
                      @click="triggerAvatarUpload"
                      class="btn btn-primary btn-icon btn-sm rounded-circle shadow"
                      title="Ganti Foto"
                    >
                      <i class="ri-camera-line"></i>
                    </button>
                  </div>
                </div>
                <input
                  ref="avatarInput"
                  type="file"
                  accept="image/*"
                  class="d-none"
                  @change="handleAvatarChange"
                />
              </div>

              <!-- Name & Title -->
              <div class="pb-2 mt-2 mt-md-5">
                <h4 class="fw-bold mb-1 text-dark profile-name">
                  {{ formData.name || "User Name" }}
                </h4>
                <p
                  class="text-primary-dark fw-medium mb-1 d-flex align-items-center gap-1"
                >
                  <i class="ri-user-line"></i>{{ formData.role }}
                </p>
                <p
                  class="text-primary-dark fw-medium mb-1 d-flex align-items-center gap-1"
                >
                  <i class="ri-briefcase-line"></i>{{ formData.jabatan }}
                </p>
                <p
                  class="text-black fs-13 mb-2 d-flex align-items-center gap-1"
                >
                  <i class="ri-mail-line"></i>{{ formData.email }}
                </p>
                <p class="fs-12 mb-0 mt-1">
                  <span class="me-3">
                    <i class="ri-phone-line me-1"></i>{{ formData.phone }}
                  </span>
                  <span>
                    <i class="ri-map-pin-line me-1"></i>{{ formData.location }}
                  </span>
                </p>
              </div>
            </div>

            <!-- Save Button (Desktop) -->
            <div class="save-btn-desktop d-none d-md-block">
              <button
                @click="saveProfile"
                :disabled="isSaving"
                class="btn btn-secondary rounded-pill px-4"
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

      <div class="card custom-card gradient-header-card">
        <div
          class="card-header d-flex align-items-center"
          style="background: linear-gradient(90deg, #1e3a5f 0%, #2c5282 100%)"
        >
          <i class="ri-user-settings-line text-white me-2 fs-18"></i>
          <div class="card-title text-white mb-0">Informasi Akun</div>
        </div>

        <div class="card-body p-4">
          <div class="row gy-4">
            <!-- Name -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-user-line me-1 text-primary"></i>Nama Lengkap
              </label>
              <input
                type="text"
                class="form-control"
                v-model="formData.name"
                placeholder="Masukkan nama lengkap"
              />
            </div>

            <!-- Jabatan -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-briefcase-line me-1 text-primary"></i>Jabatan
              </label>
              <input
                type="text"
                class="form-control"
                v-model="formData.jabatan"
                placeholder="Masukkan jabatan"
              />
            </div>

            <!-- Email -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-mail-line me-1 text-primary"></i>Email
              </label>
              <input
                type="email"
                class="form-control"
                v-model="formData.email"
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
                v-model="formData.phone"
                placeholder="Masukkan nomor telepon"
              />
            </div>

            <!-- Location -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-map-pin-line me-1 text-primary"></i>Lokasi
              </label>
              <input
                type="text"
                class="form-control"
                v-model="formData.location"
                placeholder="Masukkan lokasi"
              />
            </div>

            <!-- Role (Read-only) -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-shield-user-line me-1 text-primary"></i>Role
                <span class="text-muted fs-11 ms-1">(Tidak dapat diubah)</span>
              </label>
              <input
                type="text"
                class="form-control bg-light"
                v-model="formData.role"
                readonly
                disabled
              />
            </div>

            <!-- Save Button (Mobile) -->
            <div class="col-12 d-md-none">
              <button
                @click="saveProfile"
                :disabled="isSaving"
                class="btn text-white w-100 py-2"
                style="
                  background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%);
                "
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

      <div class="card custom-card gradient-header-card">
        <div
          class="card-header d-flex justify-content-between align-items-center"
          data-bs-toggle="collapse"
          data-bs-target="#changePassword"
          style="
            cursor: pointer;
            background: linear-gradient(90deg, #2c5282 0%, #1e3a5f 100%);
          "
        >
          <div class="d-flex align-items-center">
            <i class="ri-lock-password-line text-white me-2 fs-18"></i>
            <div class="card-title text-white mb-0">Ubah Password</div>
          </div>
          <i class="ri-arrow-down-s-line text-white fs-20"></i>
        </div>

        <div id="changePassword" class="collapse">
          <div class="card-body p-4">
            <div class="row gy-3">
              <div class="col-xl-4 col-lg-4 col-md-6">
                <label class="form-label fw-medium">Password Saat Ini</label>
                <input
                  type="password"
                  class="form-control"
                  v-model="passwordData.currentPassword"
                  placeholder="Masukkan password saat ini"
                />
              </div>
              <div class="col-xl-4 col-lg-4 col-md-6">
                <label class="form-label fw-medium">Password Baru</label>
                <input
                  type="password"
                  class="form-control"
                  v-model="passwordData.newPassword"
                  placeholder="Masukkan password baru"
                />
              </div>
              <div class="col-xl-4 col-lg-4 col-md-12">
                <label class="form-label fw-medium">Konfirmasi Password</label>
                <input
                  type="password"
                  class="form-control"
                  v-model="passwordData.confirmPassword"
                  placeholder="Konfirmasi password baru"
                />
              </div>
            </div>
          </div>

          <div class="card-footer bg-light border-top-0">
            <div class="d-flex justify-content-end">
              <button
                @click="savePassword"
                class="btn text-white"
                style="
                  background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%);
                "
              >
                <i class="ri-lock-line me-1"></i>Update Password
              </button>
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

.gradient-header-card .card-footer {
  border: 1px solid var(--default-border);
  border-top: none !important;
  border-radius: 0 !important;
}
</style>
