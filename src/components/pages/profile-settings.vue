<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useProfileStore } from "../../stores/profile";
import { useAuthStore } from "../../stores/auth";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";

// Router
const router = useRouter();

// Stores
const profileStore = useProfileStore();
const authStore = useAuthStore();

const dataToPass = {
  title: { label: "Profile", path: "/profile" },
  currentpage: "Profile Settings",
  activepage: "Profile Settings",
};

// Editing state
const isSaving = ref(false);
const showSuccessAlert = ref(false);
const showErrorAlert = ref(false);

// Form data (editable copy of profile)
const formData = ref({
  name: "",
  title: "",
  location: "",
  email: "",
  phone: "",
  website: "",
  bio: "",
  address: "",
});

// Avatar handling
const avatarInput = ref(null);
const avatarPreview = ref("");

// Initialize form data from store
onMounted(() => {
  profileStore.loadFromStorage();
  profileStore.initFromAuth();
  resetForm();
});

// Reset form to current profile values
const resetForm = () => {
  formData.value = {
    name: profileStore.displayName,
    title: profileStore.displayRole,
    location: profileStore.location,
    email: profileStore.displayEmail,
    phone: profileStore.phone,
    website: profileStore.website,
    bio: profileStore.bio,
    address: profileStore.address,
  };
  avatarPreview.value = profileStore.avatarUrl;
};

// Save profile changes
const saveProfile = async () => {
  isSaving.value = true;

  try {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));

    profileStore.updateProfile({
      name: formData.value.name,
      title: formData.value.title,
      location: formData.value.location,
      email: formData.value.email,
      phone: formData.value.phone,
      website: formData.value.website,
      bio: formData.value.bio,
      address: formData.value.address,
      avatarUrl: avatarPreview.value,
    });

    showSuccessAlert.value = true;

    // Redirect to profile after short delay
    setTimeout(() => {
      router.push("/profile");
    }, 1000);
  } catch (error) {
    showErrorAlert.value = true;
    setTimeout(() => {
      showErrorAlert.value = false;
    }, 3000);
  } finally {
    isSaving.value = false;
  }
};

// Avatar upload
const triggerAvatarUpload = () => {
  avatarInput.value?.click();
};

const handleAvatarChange = (event) => {
  const file = event.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      avatarPreview.value = e.target?.result;
    };
    reader.readAsDataURL(file);
  }
};

const removeAvatar = () => {
  avatarPreview.value = "/images/faces/9.jpg";
};

// Navigate back to profile
const goToProfile = () => {
  router.push("/profile");
};

// Password change
const passwordData = ref({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const savePassword = async () => {
  if (passwordData.value.newPassword !== passwordData.value.confirmPassword) {
    alert("Password tidak cocok!");
    return;
  }
  // Simulate password change
  await new Promise((resolve) => setTimeout(resolve, 500));
  passwordData.value = {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  };
  showSuccessAlert.value = true;
  setTimeout(() => {
    showSuccessAlert.value = false;
  }, 3000);
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
      <!-- Profile Header Card -->
      <div class="card custom-card overflow-hidden profile-main-card mb-3">
        <!-- Header Gradient -->
        <div
          class="profile-header-banner position-relative"
          style="
            background: linear-gradient(
              135deg,
              #1e3a5f 0%,
              #2c5282 50%,
              #1a365d 100%
            );
            min-height: 180px;
          "
        ></div>

        <!-- Card Body - Avatar + User Info -->
        <div class="card-body p-3 p-md-4 pb-4 position-relative">
          <!-- Avatar Section -->
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
                  <i class="ri-briefcase-line"></i>{{ formData.title }}
                </p>
                <p
                  class="text-black fs-13 mb-2 d-flex align-items-center gap-1"
                >
                  <i class="ri-mail-line"></i>{{ formData.email }}
                </p>
                <p class="fs-12 mb-0 mt-1">
                  <span class="me-3"
                    ><i class="ri-phone-line me-1"></i
                    >{{ formData.phone }}</span
                  >
                  <span
                    ><i class="ri-map-pin-line me-1"></i
                    >{{ formData.location }}</span
                  >
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

      <!-- Account Information Card -->
      <div class="card custom-card">
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

            <!-- Title/Role -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-briefcase-line me-1 text-primary"></i>Jabatan /
                Role
              </label>
              <input
                type="text"
                class="form-control"
                v-model="formData.title"
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

            <!-- Website -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-global-line me-1 text-primary"></i>Website
              </label>
              <input
                type="url"
                class="form-control"
                v-model="formData.website"
                placeholder="Masukkan website"
              />
            </div>

            <!-- Address -->
            <div class="col-12">
              <label class="form-label fw-medium">
                <i class="ri-home-line me-1 text-primary"></i>Alamat
              </label>
              <textarea
                class="form-control"
                v-model="formData.address"
                rows="2"
                placeholder="Masukkan alamat lengkap"
              ></textarea>
            </div>

            <!-- Bio -->
            <div class="col-12">
              <label class="form-label fw-medium">
                <i class="ri-file-text-line me-1 text-primary"></i>Tentang Saya
              </label>
              <textarea
                class="form-control"
                v-model="formData.bio"
                rows="3"
                placeholder="Ceritakan tentang diri Anda"
              ></textarea>
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

      <!-- Change Password Card -->
      <div class="card custom-card">
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

      <!-- Security Settings Card -->
      <div class="card custom-card">
        <div
          class="card-header d-flex justify-content-between align-items-center"
          data-bs-toggle="collapse"
          data-bs-target="#securitySettings"
          aria-expanded="false"
          style="
            cursor: pointer;
            background: linear-gradient(90deg, #1a365d 0%, #2a4365 100%);
          "
        >
          <div class="d-flex align-items-center">
            <i class="ri-shield-check-line text-white me-2 fs-18"></i>
            <div class="card-title text-white mb-0">Pengaturan Keamanan</div>
          </div>
          <i class="ri-arrow-down-s-line text-white fs-20"></i>
        </div>
        <div id="securitySettings" class="collapse">
          <div class="card-body p-4">
            <div
              class="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-4 pb-3 border-bottom"
            >
              <div class="flex-fill">
                <p class="fs-14 mb-1 fw-medium">Verifikasi Login</p>
                <p class="fs-12 mb-0 text-muted">
                  Aktifkan verifikasi dua langkah untuk keamanan akun yang lebih
                  baik.
                </p>
              </div>
              <a
                href="javascript:void(0);"
                class="btn btn-outline-primary btn-sm"
              >
                <i class="ri-shield-keyhole-line me-1"></i>Atur Verifikasi
              </a>
            </div>
            <div
              class="d-flex align-items-start justify-content-between flex-wrap gap-3"
            >
              <div class="flex-fill">
                <p class="fs-14 mb-1 fw-medium">Verifikasi Password</p>
                <p class="fs-12 mb-0 text-muted">
                  Minta verifikasi password saat mengubah detail penting akun.
                </p>
              </div>
              <div class="form-check form-switch">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="password-verification"
                />
                <label class="form-check-label" for="password-verification"
                  >Aktifkan</label
                >
              </div>
            </div>
          </div>
          <div class="card-footer bg-light border-top-0">
            <div class="d-flex justify-content-between flex-wrap gap-2">
              <button class="btn btn-outline-danger btn-sm">
                <i class="ri-user-unfollow-line me-1"></i>Nonaktifkan Akun
              </button>
              <button class="btn btn-outline-secondary btn-sm">
                <i class="ri-refresh-line me-1"></i>Reset ke Default
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
