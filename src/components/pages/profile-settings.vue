<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useProfileStore } from "../../stores/profile";
import { useAuthStore } from "../../stores/auth";
import type { Jabatan } from "@/types/jabatan.types";
import { usersService } from "../../services/users.service";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";

// Constants
const DEFAULT_FOTO_PROFILE = " ";
const DEFAULT_BANNER = " ";
const MAX_BANNER_SIZE = 2 * 1024 * 1024;
const MAX_FOTO_PROFILE_SIZE = 1 * 1024 * 1024;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 32;

// Image Compression
const compressImage = (file: File, maxWidth: number, quality: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Gagal membuat canvas context')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
};

// Core State
const router = useRouter();
const route = useRoute();
const profileStore = useProfileStore();
const authStore = useAuthStore();
const imageError = ref("");
const isSaving = ref(false);
const showSuccessAlert = ref(false);
const showErrorAlert = ref(false);
const errorMessage = ref("");

// Self-edit mode only (no admin edit mode)
const isAdminEditMode = false;

// Computed for page header
const dataToPass = computed(() => ({
  title: { label: "Profile", path: "/profile" },
  currentpage: "Profile Settings",
  activepage: "Profile Settings"
}));

const formData = ref({
  name: "", role: "", jabatan: "", idJabatan: "", location: "", email: "", phone: "", website: "", bio: "", address: ""
});

const nameInput = ref<HTMLInputElement | null>(null);
const jabatanSelect = ref<HTMLSelectElement | null>(null);
const emailInput = ref<HTMLInputElement | null>(null);
const roleSelect = ref<HTMLSelectElement | null>(null);

const focusInput = (inputRef: any) => {
  const el = inputRef?.value || inputRef;
  if (el && typeof el.focus === 'function') {
    el.focus();
  }
};

// Jabatan dropdown state
const jabatanList = ref<Jabatan[]>([]);
const isLoadingJabatan = ref(false);
const selectedJabatan = ref(""); // id or "NEW"
const newJabatanName = ref("");

// Image State
const fotoProfileInput = ref<HTMLInputElement | null>(null);
const fotoProfilePreview = ref("");
const bannerInput = ref<HTMLInputElement | null>(null);
const bannerPreview = ref("");
const bannerPosition = ref({ x: 50, y: 50 });
const fotoProfilePosition = ref({ x: 50, y: 50 });
const bannerContainer = ref<HTMLElement | null>(null);
const fotoProfileContainer = ref<HTMLElement | null>(null);

// Unified Drag State
const dragState = ref({ type: '' as 'banner' | 'foto_profile' | '', startX: 0, startY: 0, initialX: 0, initialY: 0 });

// Password State (only used in self-edit mode)
const passwordData = ref({ currentPassword: "", newPassword: "", confirmPassword: "" });
const showHint = ref(false);
const generatedPassword = ref("");
const showGeneratedPassword = ref(false);
const copiedToClipboard = ref(false);
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);
const passwordLength = ref(12);

// Phone input state - simplified to +62 only
const PHONE_PREFIX = "+62 ";

// Password Validation - Simplified with array
const passwordRules = computed(() => [
  { label: 'Minimal 8 karakter', valid: passwordData.value.newPassword.length >= 8 },
  { label: 'Huruf besar (A-Z)', valid: /[A-Z]/.test(passwordData.value.newPassword) },
  { label: 'Huruf kecil (a-z)', valid: /[a-z]/.test(passwordData.value.newPassword) },
  { label: 'Angka (0-9)', valid: /[0-9]/.test(passwordData.value.newPassword) },
  { label: 'Simbol (!@#$%)', valid: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/`~;']/.test(passwordData.value.newPassword) }
]);
const isPasswordValid = computed(() => passwordRules.value.every(r => r.valid));
const isPasswordLengthValid = computed(() => passwordLength.value >= MIN_PASSWORD_LENGTH && passwordLength.value <= MAX_PASSWORD_LENGTH);

const hideHint = () => setTimeout(() => { showHint.value = false; }, 200);

// Password Generator - Compact
const generatePassword = () => {
  if (!isPasswordLengthValid.value) return;
  const chars = { upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ', lower: 'abcdefghjkmnpqrstuvwxyz', num: '23456789', sym: '!@#$%^&*_+-=?' };
  let pwd = [chars.upper, chars.upper, chars.lower, chars.lower, chars.num, chars.num, chars.sym, chars.sym]
    .map(c => c[Math.floor(Math.random() * c.length)]).join('');
  const all = Object.values(chars).join('');
  while (pwd.length < passwordLength.value) pwd += all[Math.floor(Math.random() * all.length)];
  // Fisher-Yates shuffle
  const arr = pwd.split('');
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  generatedPassword.value = arr.join('');
  showGeneratedPassword.value = true;
  copiedToClipboard.value = false;
};

const copyToClipboard = async () => {
  try { await navigator.clipboard.writeText(generatedPassword.value); }
  catch { const t = document.createElement('textarea'); t.value = generatedPassword.value; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); }
  copiedToClipboard.value = true;
  setTimeout(() => copiedToClipboard.value = false, 2000);
};

const useGeneratedPassword = () => {
  passwordData.value.newPassword = generatedPassword.value;
  passwordData.value.confirmPassword = generatedPassword.value;
  showHint.value = true;
};

// Load user data (self-edit mode only)
const loadUserData = async () => {
  await profileStore.fetchFromApi();
  // Load jabatan list for dropdown
  isLoadingJabatan.value = true;
  jabatanList.value = await profileStore.fetchJabatanList();
  isLoadingJabatan.value = false;
  resetForm();
};

// Form Management
onMounted(async () => { 
  await loadUserData();
});

// Watch for route changes
watch(() => route.params.slug, async () => {
  await loadUserData();
});

const resetForm = () => {
  formData.value = {
    name: profileStore.name || profileStore.displayName,
    role: profileStore.displayRole,
    jabatan: profileStore.jabatan,
    idJabatan: profileStore.idJabatan,
    location: profileStore.location,
    email: profileStore.email || profileStore.displayEmail,
    phone: profileStore.phone,
    website: profileStore.website,
    bio: profileStore.bio,
    address: profileStore.address,
  };
  // Set jabatan dropdown selection
  selectedJabatan.value = profileStore.idJabatan || '';
  newJabatanName.value = '';
  fotoProfilePreview.value = profileStore.fotoProfileUrl;
  bannerPreview.value = profileStore.bannerUrl;
  bannerPosition.value = { x: profileStore.bannerPositionX ?? 50, y: profileStore.bannerPositionY ?? 50 };
  fotoProfilePosition.value = { x: profileStore.fotoProfilePositionX ?? 50, y: profileStore.fotoProfilePositionY ?? 50 };
};

// Unified Drag Handlers
const getClientPos = (e: MouseEvent | TouchEvent) => 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };

const startDrag = (type: 'banner' | 'foto_profile', e: MouseEvent | TouchEvent) => {
  e.preventDefault();
  const pos = getClientPos(e);
  const current = type === 'banner' ? bannerPosition.value : fotoProfilePosition.value;
  dragState.value = { type, startX: pos.x, startY: pos.y, initialX: current.x, initialY: current.y };
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('touchmove', onDrag);
  document.addEventListener('touchend', stopDrag);
};

const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!dragState.value.type) return;
  const container = dragState.value.type === 'banner' ? bannerContainer.value : fotoProfileContainer.value;
  if (!container) return;
  const pos = getClientPos(e);
  const rect = container.getBoundingClientRect();
  const deltaX = ((pos.x - dragState.value.startX) / rect.width) * 100;
  const deltaY = ((pos.y - dragState.value.startY) / rect.height) * 100;
  const target = dragState.value.type === 'banner' ? bannerPosition : fotoProfilePosition;
  target.value = {
    x: Math.max(0, Math.min(100, dragState.value.initialX - deltaX)),
    y: Math.max(0, Math.min(100, dragState.value.initialY - deltaY))
  };
};

const stopDrag = () => {
  if (dragState.value.type && !isAdminEditMode) {
    const pos = dragState.value.type === 'banner' ? bannerPosition.value : fotoProfilePosition.value;
    profileStore.updateProfile(dragState.value.type === 'banner' 
      ? { bannerPositionX: pos.x, bannerPositionY: pos.y }
      : { fotoProfilePositionX: pos.x, fotoProfilePositionY: pos.y }
    );
  }
  dragState.value.type = '';
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('touchend', stopDrag);
};

// Image Handlers
const triggerFotoProfileUpload = () => fotoProfileInput.value?.click();
const triggerBannerUpload = () => bannerInput.value?.click();

const handleImageUpload = async (type: 'foto_profile' | 'banner', event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  imageError.value = "";
  const maxSize = type === 'foto_profile' ? MAX_FOTO_PROFILE_SIZE : MAX_BANNER_SIZE;
  const config = type === 'foto_profile' ? { width: 400, quality: 0.7 } : { width: 1200, quality: 0.8 };
  if (file.size > maxSize) imageError.value = `Ukuran ${type} maksimal ${maxSize / 1024 / 1024}MB. Gambar akan dikompresi otomatis.`;
  try {
    const compressed = await compressImage(file, config.width, config.quality);
    if (type === 'foto_profile') fotoProfilePreview.value = compressed;
    else bannerPreview.value = compressed;
    imageError.value = "";
  } catch (error) {
    console.error(`Error compressing ${type}:`, error);
    imageError.value = "Gagal memproses gambar. Pastikan file adalah gambar yang valid.";
  }
};

const removeBanner = () => { bannerPreview.value = DEFAULT_BANNER; };

// Save Functions
const saveProfile = async () => {
  isSaving.value = true;
  try {
    const profileData: Record<string, any> = {
      name:     formData.value.name,
      email:    formData.value.email,
      phone:    formData.value.phone,
      location: formData.value.location,
      website:  formData.value.website,
      bio:      formData.value.bio,
      address:  formData.value.address,
      fotoProfileUrl: fotoProfilePreview.value, 
      bannerUrl: bannerPreview.value,
      bannerPositionX: bannerPosition.value.x, 
      bannerPositionY: bannerPosition.value.y,
      fotoProfilePositionX: fotoProfilePosition.value.x, 
      fotoProfilePositionY: fotoProfilePosition.value.y,
    };

    // Handle jabatan: existing ID or new name
    if (selectedJabatan.value === 'NEW') {
      profileData.newJabatanName = newJabatanName.value;
    } else if (selectedJabatan.value) {
      profileData.idJabatan = selectedJabatan.value;
      // Also pass the display name so non-admin path can show it without an extra API call
      const found = jabatanList.value.find(j => j.id === selectedJabatan.value);
      if (found) profileData.jabatan = found.nama_jabatan;
    }
    
    console.log('Saving profile data:', profileData);
    
    // Save to API
    const result = await profileStore.saveToApi(profileData);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to save profile');
    }

    // Refresh jabatan list if new one was created
    if (selectedJabatan.value === 'NEW') {
      jabatanList.value = await profileStore.fetchJabatanList();
    }
    
    // Refresh form fields from the freshly-fetched store state
    resetForm();
    showSuccessAlert.value = true;
    setTimeout(() => router.push("/profile"), 1000);
  } catch (error: any) {
    showErrorAlert.value = true;
    errorMessage.value = error.message || "Terjadi kesalahan. Silakan coba lagi.";
    setTimeout(() => showErrorAlert.value = false, 3000);
  } finally { isSaving.value = false; }
};

const savePassword = async () => {
  if (passwordData.value.newPassword !== passwordData.value.confirmPassword) { 
    showErrorAlert.value = true;
    errorMessage.value = "Password baru dan konfirmasi tidak cocok!";
    return; 
  }
  if (!isPasswordValid.value) {
    showErrorAlert.value = true;
    errorMessage.value = "Password tidak memenuhi syarat keamanan.";
    return;
  }
  isSaving.value = true;
  try {
    await usersService.updateMePassword({
      old_password: passwordData.value.currentPassword,
      new_password: passwordData.value.newPassword,
      confirm_new_password: passwordData.value.confirmPassword,
    });
    passwordData.value = { currentPassword: "", newPassword: "", confirmPassword: "" };
    showSuccessAlert.value = true;
    setTimeout(() => showSuccessAlert.value = false, 3000);
  } catch (error: any) {
    showErrorAlert.value = true;
    errorMessage.value = error.message || "Gagal mengubah password. Pastikan password lama benar.";
    setTimeout(() => showErrorAlert.value = false, 4000);
  } finally {
    isSaving.value = false;
  }
};

// Cancel handler
const handleCancel = () => {
  router.push("/profile");
};


// Computed for drag state
const isDraggingBanner = computed(() => dragState.value.type === 'banner');
const isDraggingFotoProfile = computed(() => dragState.value.type === 'foto_profile');
const displayPerusahaan = computed(() => profileStore.namaPerusahaan || 'Belum terkait');
const displaySektor = computed(() => profileStore.namaSubSektor || 'Belum terkait');

// Role options for admin edit mode
const roleOptions = ['admin', 'User'];
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
      <div class="settings-toast-body"><strong>Error!</strong> {{ errorMessage || 'Terjadi kesalahan. Silakan coba lagi.' }}</div>
      <button class="settings-toast-close" @click="showErrorAlert = false"><i class="ri-close-line"></i></button>
    </div>
  </transition>
  <transition name="slide-toast">
    <div v-if="imageError" class="settings-toast settings-toast--warning">
      <div class="settings-toast-icon"><i class="ri-image-2-fill"></i></div>
      <div class="settings-toast-body">{{ imageError }}</div>
      <button class="settings-toast-close" @click="imageError = ''"><i class="ri-close-line"></i></button>
    </div>
  </transition>

  <!-- Main container (style-2 layout) -->
  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card gradient-header-card">
        <!-- Page Header -->
        <div class="card-header d-flex align-items-center justify-content-between gap-3 users-header">
          <div class="d-flex align-items-center gap-3">
            <div class="header-icon-box">
              <i class="ri-user-settings-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">Profile Settings</div>
              <div class="header-subtitle mt-1">Edit informasi akun &amp; data pribadi</div>
            </div>
          </div>
        </div>

        <div class="card-body p-4">
          <!--  HERO CARD (banner + foto_profile + info)  -->
          <div class="card custom-card hero-card-shell mb-4">
            <!-- Banner Image -->
            <div
              ref="bannerContainer"
              class="profile-banner"
              :class="{ 'profile-banner-nophoto': !bannerPreview, 'dragging': isDraggingBanner, 'draggable': !isAdminEditMode }"
              :style="bannerPreview ? { backgroundImage: `url(${bannerPreview})`, backgroundPosition: `${bannerPosition.x}% ${bannerPosition.y}%` } : {}"
              @mousedown="!isAdminEditMode && startDrag('banner', $event)"
              @touchstart="!isAdminEditMode && startDrag('banner', $event)"
            >
              <!-- Banner Edit Buttons -->
              <div v-if="!isAdminEditMode" class="position-absolute top-0 end-0 p-3 p-md-4" style="z-index:10">
                <div class="d-flex gap-2">
                  <button @click.stop="triggerBannerUpload" class="btn-edit-profile btn-primary">
                    <i class="ri-image-edit-line"></i>
                    <span class="d-none d-sm-inline">Ganti Banner</span>
                  </button>
                  <button v-if="bannerPreview !== DEFAULT_BANNER" @click.stop="removeBanner" class="btn-edit-profile btn-danger">
                    <i class="ri-delete-bin-line"></i>
                  </button>
                </div>
              </div>
              <!-- Drag Indicator -->
              <div v-if="!isAdminEditMode" class="drag-indicator position-absolute d-flex flex-column align-items-center justify-content-center pointer-events-none" style="top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 5;">
                <div class="drag-hint-box bg-dark bg-opacity-50 text-white px-3 py-2 rounded-pill d-flex align-items-center gap-2">
                  <i class="ri-drag-move-2-fill fs-16"></i><span class="fs-12">Seret untuk atur posisi</span>
                </div>
              </div>
              <input ref="bannerInput" type="file" accept="image/jpeg,image/png,image/webp" class="d-none" @change="handleImageUpload('banner', $event)" />
            </div>

            <!-- Profile Content Body -->
            <div class="profile-content-body">
              <!-- Foto Profile Container -->
              <div class="profile-foto-profile-container">
                <div
                  ref="fotoProfileContainer"
                  class="profile-foto-profile-wrap"
                  :class="{ 'dragging': isDraggingFotoProfile, 'draggable': !isAdminEditMode }"
                  :style="{ cursor: isAdminEditMode ? 'default' : (isDraggingFotoProfile ? 'grabbing' : 'grab') }"
                  @mousedown="!isAdminEditMode && startDrag('foto_profile', $event)"
                  @touchstart="!isAdminEditMode && startDrag('foto_profile', $event)"
                >
                  <img
                    :src="fotoProfilePreview"
                    alt="Foto Profile"
                    class="profile-foto-profile-img"
                    :style="{ objectPosition: `${fotoProfilePosition.x}% ${fotoProfilePosition.y}%` }"
                  />
                  <!-- Foto Profile Drag Indicator -->
                  <div v-if="!isAdminEditMode" class="foto-profile-drag-indicator position-absolute d-flex align-items-center justify-content-center pointer-events-none" style="top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.2); border-radius: 50%;">
                    <i class="ri-drag-move-2-fill text-white fs-20"></i>
                  </div>
                </div>
                <!-- Foto Profile Upload Button -->
                <div v-if="!isAdminEditMode" class="foto-profile-upload-btn">
                  <button @click.stop="triggerFotoProfileUpload" class="btn btn-primary btn-icon btn-sm rounded-circle shadow" title="Ganti Foto">
                    <i class="ri-camera-line"></i>
                  </button>
                </div>
                <input ref="fotoProfileInput" type="file" accept="image/*" class="d-none" @change="handleImageUpload('foto_profile', $event)" />
              </div>

              <!-- Info Block -->
              <div class="profile-info-block">
                <div class="d-flex align-items-start justify-content-between flex-wrap gap-2">
                  <div>
                    <h4 class="profile-user-name mb-1">{{ formData.name || "User Name" }}</h4>
                    <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
                      <span :class="['profile-role-badge', `profile-role-badge--${(formData.role || '').toLowerCase()}`]">
                        <i :class="formData.role?.toLowerCase() === 'admin' ? 'ri-shield-user-line' : 'ri-user-line'"></i>{{ formData.role }}
                      </span>
                      <span class="profile-jabatan-badge">
                        <i class="ri-briefcase-line"></i>{{ formData.jabatan }}
                      </span>
                      <span class="profile-perusahaan-badge">
                        <i class="ri-building-line"></i>{{ displayPerusahaan }}
                      </span>
                      <span class="profile-sektor-badge">
                        <i class="ri-pie-chart-line"></i>{{ displaySektor }}
                      </span>
                    </div>
                    <p class="profile-email-text mb-1">
                      <i class="ri-mail-line me-1"></i>{{ formData.email }}
                    </p>
                    <div class="profile-meta-row">
                      <span><i class="ri-phone-line me-1"></i>{{ formData.phone }}</span>
                      <span class="contact-bar-sep-inline"></span>
                      <span><i class="ri-map-pin-line me-1"></i>{{ formData.location }}</span>
                    </div>
                  </div>
                  <!-- Action Buttons (Desktop) -->
                  <div class="save-btn-desktop d-none d-md-flex gap-2 align-self-start mt-1">
                    <button @click="handleCancel" class="btn-cancel-glass rounded-pill px-4">
                      <i class="ri-arrow-left-line me-1"></i>Batal
                    </button>
                    <button @click="saveProfile" :disabled="isSaving" class="btn-save-primary rounded-pill px-4">
                      <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                      <i v-else class="ri-save-line me-1"></i>{{ isSaving ? "Menyimpan..." : "Simpan Perubahan" }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- INFORMASI AKUN -->
          <div class="card custom-card gradient-header-card mb-4">
            <div class="card-header d-flex align-items-center gap-3 users-header">
              <div class="header-icon-box" style="width:36px;height:36px">
                <i class="ri-user-settings-line" style="font-size:1.3rem"></i>
              </div>
              <div>
                <div class="card-title mb-0 text-white fw-bold header-card-title">{{ isAdminEditMode ? 'Edit User' : 'Informasi Akun' }}</div>
                <div class="header-subtitle mt-1">Edit data detail profil pengguna</div>
              </div>
            </div>
          <div class="card-body p-4">
            <div class="row g-3">
              <!-- Name -->
              <div class="col-xl-6 col-lg-6 col-md-6">
                <div class="form-group-split" @click="focusInput(nameInput)">
                  <div class="form-group-split-label-card">
                    <div class="form-item-icon stat-icon-teal" style="width:32px;height:32px"><i class="ri-user-line" style="font-size:0.95rem"></i></div>
                    <label class="form-item-label mb-0">Nama Lengkap</label>
                  </div>
                  <div class="form-group-split-input-card">
                    <input ref="nameInput" type="text" class="form-item-input" v-model="formData.name" placeholder="Masukkan nama lengkap" />
                    <i class="ri-pencil-line form-item-edit-action"></i>
                  </div>
                </div>
              </div>
              <!-- Jabatan -->
              <div class="col-xl-6 col-lg-6 col-md-6">
                <div class="form-group-split" @click="focusInput(jabatanSelect)">
                  <div class="form-group-split-label-card">
                    <div class="form-item-icon stat-icon-blue" style="width:32px;height:32px"><i class="ri-briefcase-line" style="font-size:0.95rem"></i></div>
                    <label class="form-item-label mb-0">Jabatan</label>
                  </div>
                  <div class="form-group-split-input-card">
                    <select ref="jabatanSelect" class="form-item-input form-item-select" v-model="selectedJabatan" :disabled="isLoadingJabatan">
                      <option value="" disabled>Pilih jabatan</option>
                      <option value="NEW" class="fw-bold">+ Tambah Jabatan Baru</option>
                      <option v-for="j in jabatanList" :key="j.id" :value="j.id">{{ j.nama_jabatan }}</option>
                    </select>
                    <i class="ri-pencil-line form-item-edit-action"></i>
                  </div>
                </div>
              </div>
              <!-- New Jabatan input — expands into its own full-width row -->
              <transition name="slide-down">
                <div v-if="selectedJabatan === 'NEW'" class="col-12">
                  <div class="form-group-split" @click.stop>
                    <div class="form-group-split-label-card">
                      <div class="form-item-icon stat-icon-blue" style="width:32px;height:32px"><i class="ri-add-line" style="font-size:0.95rem"></i></div>
                      <label class="form-item-label mb-0">Nama Jabatan Baru</label>
                    </div>
                    <div class="form-group-split-input-card">
                      <input type="text" class="form-item-input" v-model="newJabatanName" placeholder="Masukkan nama jabatan baru" autofocus />
                      <i class="ri-pencil-line form-item-edit-action"></i>
                    </div>
                  </div>
                </div>
              </transition>
              <!-- Email -->
              <div class="col-xl-6 col-lg-6 col-md-6">
                <div class="form-group-split" @click="focusInput(emailInput)">
                  <div class="form-group-split-label-card">
                    <div class="form-item-icon stat-icon-indigo" style="width:32px;height:32px"><i class="ri-mail-line" style="font-size:0.95rem"></i></div>
                    <label class="form-item-label mb-0">Email</label>
                  </div>
                  <div class="form-group-split-input-card">
                    <input ref="emailInput" type="email" class="form-item-input" v-model="formData.email" placeholder="Masukkan email" />
                    <i class="ri-pencil-line form-item-edit-action"></i>
                  </div>
                </div>
              </div>
              <!-- Perusahaan (read-only) -->
              <div class="col-xl-6 col-lg-6 col-md-6">
                <div class="form-group-split">
                  <div class="form-group-split-label-card">
                    <div class="form-item-icon stat-icon-amber" style="width:32px;height:32px"><i class="ri-building-line" style="font-size:0.95rem"></i></div>
                    <label class="form-item-label mb-0">Perusahaan <span class="form-item-badge">dari registrasi</span></label>
                  </div>
                  <div class="form-group-split-input-card form-item-card--readonly">
                    <div class="form-item-value">{{ profileStore.namaPerusahaan || 'Belum terkait' }}</div>
                    <i class="ri-lock-2-line form-item-edit-action" style="color: #cbd5e1; opacity: 1;"></i>
                  </div>
                </div>
              </div>
              <!-- Phone -->
              <div class="col-xl-6 col-lg-6 col-md-6">
                <div class="form-group-split">
                  <div class="form-group-split-label-card">
                    <div class="form-item-icon stat-icon-violet" style="width:32px;height:32px"><i class="ri-phone-line" style="font-size:0.95rem"></i></div>
                    <label class="form-item-label mb-0">Nomor Telepon <span class="form-item-badge">dari stakeholder</span></label>
                  </div>
                  <div class="form-group-split-input-card form-item-card--readonly">
                    <div class="form-item-value">{{ PHONE_PREFIX }}{{ formData.phone }}</div>
                    <i class="ri-lock-2-line form-item-edit-action" style="color: #cbd5e1; opacity: 1;"></i>
                  </div>
                </div>
              </div>
              <!-- Location -->
              <div class="col-xl-6 col-lg-6 col-md-6">
                <div class="form-group-split">
                  <div class="form-group-split-label-card">
                    <div class="form-item-icon stat-icon-amber" style="width:32px;height:32px"><i class="ri-map-pin-line" style="font-size:0.95rem"></i></div>
                    <label class="form-item-label mb-0">Lokasi <span class="form-item-badge">dari stakeholder</span></label>
                  </div>
                  <div class="form-group-split-input-card form-item-card--readonly">
                    <div class="form-item-value">{{ formData.location || 'Belum diatur' }}</div>
                    <i class="ri-lock-2-line form-item-edit-action" style="color: #cbd5e1; opacity: 1;"></i>
                  </div>
                </div>
              </div>
              <!-- Sektor -->
              <div class="col-xl-6 col-lg-6 col-md-6">
                <div class="form-group-split">
                  <div class="form-group-split-label-card">
                    <div class="form-item-icon stat-icon-purple" style="width:32px;height:32px"><i class="ri-pie-chart-line" style="font-size:0.95rem"></i></div>
                    <label class="form-item-label mb-0">Sektor <span class="form-item-badge">dari stakeholder</span></label>
                  </div>
                  <div class="form-group-split-input-card form-item-card--readonly">
                    <div class="form-item-value">{{ profileStore.namaSubSektor || 'Belum terkait' }}</div>
                    <i class="ri-lock-2-line form-item-edit-action" style="color: #cbd5e1; opacity: 1;"></i>
                  </div>
                </div>
              </div>
              <!-- Role -->
              <div class="col-xl-6 col-lg-6 col-md-6">
                <div class="form-group-split" @click="isAdminEditMode && focusInput(roleSelect)">
                  <div class="form-group-split-label-card">
                    <div class="form-item-icon stat-icon-red" style="width:32px;height:32px"><i class="ri-shield-user-line" style="font-size:0.95rem"></i></div>
                    <label class="form-item-label mb-0">
                      Role
                      <span v-if="!isAdminEditMode" class="form-item-badge">tidak dapat diubah</span>
                    </label>
                  </div>
                  <div class="form-group-split-input-card" :class="{ 'form-item-card--readonly': !isAdminEditMode }">
                    <select v-if="isAdminEditMode" ref="roleSelect" class="form-item-input form-item-select" v-model="formData.role">
                      <option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option>
                    </select>
                    <div v-else class="form-item-value">{{ formData.role }}</div>
                    
                    <i v-if="isAdminEditMode" class="ri-pencil-line form-item-edit-action"></i>
                    <i v-else class="ri-lock-2-line form-item-edit-action" style="color: #cbd5e1; opacity: 1;"></i>
                  </div>
                </div>
              </div>
              <!-- Mobile Action Buttons -->
              <div class="col-12 d-md-none">
                <div class="d-flex gap-2 mt-1">
                  <button @click="handleCancel" class="btn-cancel-glass rounded-pill w-50">
                    <i class="ri-arrow-left-line me-1"></i>Batal
                  </button>
                  <button @click="saveProfile" :disabled="isSaving" class="btn-save-primary rounded-pill w-50">
                    <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                    <i v-else class="ri-save-line me-1"></i>{{ isSaving ? "Menyimpan..." : "Simpan" }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

          <!--  UBAH PASSWORD  -->
          <div v-if="!isAdminEditMode" class="card custom-card gradient-header-card mb-0">
            <div class="card-header d-flex justify-content-between align-items-center gap-3 users-header" data-bs-toggle="collapse" data-bs-target="#changePassword" style="cursor: pointer;">
              <div class="d-flex align-items-center gap-3">
                <div class="header-icon-box" style="width:36px;height:36px">
                  <i class="ri-lock-password-line" style="font-size:1.3rem"></i>
                </div>
                <div>
                  <div class="card-title mb-0 text-white fw-bold header-card-title">Ubah Password</div>
                  <div class="header-subtitle mt-1">Ganti kata sandi akun Anda</div>
                </div>
              </div>
              <i class="ri-arrow-down-s-line text-white fs-20"></i>
            </div>
          <div id="changePassword" class="collapse">
            <div class="card-body p-4">
              <div class="row gy-3">
                <div class="col-xl-4 col-lg-4 col-md-6">
                  <label class="form-label fw-medium">Password Saat Ini</label>
                  <div class="input-group">
                    <input :type="showCurrentPassword ? 'text' : 'password'" class="form-control" v-model="passwordData.currentPassword" placeholder="Masukkan password saat ini" />
                    <button @click="showCurrentPassword = !showCurrentPassword" class="btn btn-outline-secondary" type="button" :title="showCurrentPassword ? 'Sembunyikan' : 'Tampilkan'">
                      <i :class="showCurrentPassword ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
                    </button>
                  </div>
                </div>
                <div class="col-xl-4 col-lg-4 col-md-6">
                  <label class="form-label fw-medium">Password Baru</label>
                  <div class="input-group">
                    <input :type="showNewPassword ? 'text' : 'password'" class="form-control" v-model="passwordData.newPassword" placeholder="Masukkan password baru" @focus="showHint = true" @blur="hideHint" />
                    <button @click="showNewPassword = !showNewPassword" class="btn btn-outline-secondary" type="button" :title="showNewPassword ? 'Sembunyikan' : 'Tampilkan'">
                      <i :class="showNewPassword ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
                    </button>
                  </div>
                  <!-- Password Strength Bar + Rule Pills -->
                  <div v-if="passwordData.newPassword" class="mt-2">
                    <div class="pwd-strength-wrap">
                      <div class="pwd-strength-bar">
                        <div
                          class="pwd-strength-fill"
                          :class="{
                            'pwd-weak':   passwordRules.filter(r=>r.valid).length <= 1,
                            'pwd-medium': passwordRules.filter(r=>r.valid).length === 2 || passwordRules.filter(r=>r.valid).length === 3,
                            'pwd-good':   passwordRules.filter(r=>r.valid).length === 4,
                            'pwd-strong': passwordRules.filter(r=>r.valid).length === 5,
                          }"
                          :style="{ width: (passwordRules.filter(r=>r.valid).length / passwordRules.length * 100) + '%' }"
                        ></div>
                      </div>
                      <span class="pwd-strength-label" :class="{
                        'text-danger':  passwordRules.filter(r=>r.valid).length <= 1,
                        'text-warning': passwordRules.filter(r=>r.valid).length === 2 || passwordRules.filter(r=>r.valid).length === 3,
                        'text-primary': passwordRules.filter(r=>r.valid).length === 4,
                        'text-success': passwordRules.filter(r=>r.valid).length === 5,
                      }">
                        {{ passwordRules.filter(r=>r.valid).length <= 1 ? 'Lemah' : passwordRules.filter(r=>r.valid).length <= 3 ? 'Sedang' : passwordRules.filter(r=>r.valid).length === 4 ? 'Baik' : 'Kuat' }}
                      </span>
                    </div>
                    <div v-if="showHint" class="d-flex flex-wrap gap-1 mt-2">
                      <span v-for="(rule, i) in passwordRules" :key="i" :class="['pwd-rule-pill', rule.valid ? 'pwd-rule-valid' : 'pwd-rule-invalid']">
                        <i :class="rule.valid ? 'ri-checkbox-circle-fill' : 'ri-circle-line'"></i>{{ rule.label }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="col-xl-4 col-lg-4 col-md-12">
                  <label class="form-label fw-medium">Konfirmasi Password</label>
                  <div class="input-group">
                    <input :type="showConfirmPassword ? 'text' : 'password'" class="form-control" v-model="passwordData.confirmPassword" placeholder="Konfirmasi password baru" />
                    <button @click="showConfirmPassword = !showConfirmPassword" class="btn btn-outline-secondary" type="button" :title="showConfirmPassword ? 'Sembunyikan' : 'Tampilkan'">
                      <i :class="showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
                    </button>
                  </div>
                </div>
              </div>
              <!-- Password Generator -->
              <div class="row mt-3">
                <div class="col-xl-2 col-lg-2 col-md-3 col-6 mb-2 mb-md-0">
                  <label class="form-label fw-medium">Panjang <span class="text-muted fs-11">(8-32)</span></label>
                  <div class="position-relative">
                    <input type="number" v-model="passwordLength" min="8" max="32" class="form-control" :class="{ 'is-invalid': !isPasswordLengthValid }" />
                    <small v-if="!isPasswordLengthValid" class="text-danger position-absolute" style="white-space: nowrap; top: 100%; left: 0;">
                      <i class="ri-error-warning-line me-1"></i>Min 8, Max 32
                    </small>
                  </div>
                </div>
                <div class="col-xl-2 col-lg-2 col-md-3 col-6 mb-2 mb-md-0 d-flex align-items-end">
                  <button @click="generatePassword" class="btn btn-gradient-blue text-white w-100" :disabled="!isPasswordLengthValid">
                    <i class="ri-key-2-line me-1"></i>Generate
                  </button>
                </div>
                <div class="col-xl-4 col-lg-4 col-md-6">
                  <label class="form-label fw-medium">Hasil Generate Password</label>
                  <div class="position-relative">
                    <div class="input-group">
                      <input :type="showGeneratedPassword ? 'text' : 'password'" class="form-control" v-model="generatedPassword" placeholder="Klik Generate Password" readonly />
                      <button v-if="generatedPassword" @click="showGeneratedPassword = !showGeneratedPassword" class="btn btn-outline-secondary" type="button" :title="showGeneratedPassword ? 'Sembunyikan' : 'Tampilkan'">
                        <i :class="showGeneratedPassword ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
                      </button>
                      <button v-if="generatedPassword" @click="copyToClipboard" class="btn btn-outline-secondary" type="button" :title="copiedToClipboard ? 'Tersalin!' : 'Salin'">
                        <i :class="copiedToClipboard ? 'ri-check-line text-success' : 'ri-file-copy-line'"></i>
                      </button>
                    </div>
                    <small v-if="copiedToClipboard" class="text-success position-absolute" style="white-space: nowrap; top: 100%; left: 0;">Password berhasil disalin!</small>
                  </div>
                </div>
                <div class="col-xl-4 col-lg-4 col-md-12 mt-2 mt-lg-0">
                  <label class="form-label fw-medium d-none d-md-block">&nbsp;</label>
                  <button v-if="generatedPassword" @click="useGeneratedPassword" class="btn btn-success w-100">
                    <i class="ri-arrow-right-circle-line me-1"></i>Gunakan Password Ini
                  </button>
                </div>
              </div>
            </div>
            <div class="card-footer border-top-0 pwd-footer">
              <div class="d-flex justify-content-end">
                <button @click="savePassword" class="btn-save-primary rounded-pill" style="padding: 10px 32px">
                  <i class="ri-lock-line me-1"></i>Update Password
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style src="../../assets/css/style2.css"></style>

<!-- All styles live in src/assets/css/style2.css - PROFILE SETTINGS PAGE section -->
