<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useProfileStore } from "../../stores/profile";
import { useAuthStore } from "../../stores/auth";
import { useUsersStore, type User } from "../../stores/users";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import CountryCodeDropdown from "../shared/CountryCodeDropdown.vue";

// Constants
const DEFAULT_AVATAR = "/images/faces/9.jpg";
const DEFAULT_BANNER = "/images/media/media-3.jpg";
const MAX_BANNER_SIZE = 2 * 1024 * 1024;
const MAX_AVATAR_SIZE = 1 * 1024 * 1024;
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
const usersStore = useUsersStore();
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
  name: "", role: "", jabatan: "", location: "", email: "", phone: "", website: "", bio: "", address: ""
});

// Image State
const avatarInput = ref<HTMLInputElement | null>(null);
const avatarPreview = ref("");
const bannerInput = ref<HTMLInputElement | null>(null);
const bannerPreview = ref("");
const bannerPosition = ref({ x: 50, y: 50 });
const avatarPosition = ref({ x: 50, y: 50 });
const bannerContainer = ref<HTMLElement | null>(null);
const avatarContainer = ref<HTMLElement | null>(null);

// Unified Drag State
const dragState = ref({ type: '' as 'banner' | 'avatar' | '', startX: 0, startY: 0, initialX: 0, initialY: 0 });

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

// Phone input state
const selectedCountryCode = ref("+62");
const phoneNumber = ref("");

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
  formData.value.phone = selectedCountryCode.value + " " + phoneNumber.value;
};

const handleCountryCodeChange = () => {
  if (phoneNumber.value) {
    formData.value.phone = selectedCountryCode.value + " " + phoneNumber.value;
  }
};

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
const loadUserData = () => {
  // Initialize users store
  usersStore.initialize();
  
  // Self-edit mode: load from profileStore
  profileStore.switchUser();
  resetForm();
};

// Form Management
onMounted(() => { 
  loadUserData();
});

// Watch for route changes
watch(() => route.params.slug, () => {
  loadUserData();
});

const resetForm = () => {
  formData.value = {
    name: profileStore.displayName, role: profileStore.displayRole, jabatan: profileStore.displayJabatan,
    location: profileStore.location, email: profileStore.displayEmail, phone: profileStore.phone,
    website: profileStore.website, bio: profileStore.bio, address: profileStore.address,
  };
  // Parse existing phone number
  if (formData.value.phone) {
    const match = formData.value.phone.match(/^(\+\d+)\s*(.+)$/);
    if (match) {
      selectedCountryCode.value = match[1];
      phoneNumber.value = match[2];
    } else {
      phoneNumber.value = formData.value.phone;
    }
  }
  avatarPreview.value = profileStore.avatarUrl;
  bannerPreview.value = profileStore.bannerUrl;
  bannerPosition.value = { x: profileStore.bannerPositionX ?? 50, y: profileStore.bannerPositionY ?? 50 };
  avatarPosition.value = { x: profileStore.avatarPositionX ?? 50, y: profileStore.avatarPositionY ?? 50 };
};

// Unified Drag Handlers
const getClientPos = (e: MouseEvent | TouchEvent) => 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };

const startDrag = (type: 'banner' | 'avatar', e: MouseEvent | TouchEvent) => {
  e.preventDefault();
  const pos = getClientPos(e);
  const current = type === 'banner' ? bannerPosition.value : avatarPosition.value;
  dragState.value = { type, startX: pos.x, startY: pos.y, initialX: current.x, initialY: current.y };
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('touchmove', onDrag);
  document.addEventListener('touchend', stopDrag);
};

const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!dragState.value.type) return;
  const container = dragState.value.type === 'banner' ? bannerContainer.value : avatarContainer.value;
  if (!container) return;
  const pos = getClientPos(e);
  const rect = container.getBoundingClientRect();
  const deltaX = ((pos.x - dragState.value.startX) / rect.width) * 100;
  const deltaY = ((pos.y - dragState.value.startY) / rect.height) * 100;
  const target = dragState.value.type === 'banner' ? bannerPosition : avatarPosition;
  target.value = {
    x: Math.max(0, Math.min(100, dragState.value.initialX - deltaX)),
    y: Math.max(0, Math.min(100, dragState.value.initialY - deltaY))
  };
};

const stopDrag = () => {
  if (dragState.value.type && !isAdminEditMode) {
    const pos = dragState.value.type === 'banner' ? bannerPosition.value : avatarPosition.value;
    profileStore.updateProfile(dragState.value.type === 'banner' 
      ? { bannerPositionX: pos.x, bannerPositionY: pos.y }
      : { avatarPositionX: pos.x, avatarPositionY: pos.y }
    );
  }
  dragState.value.type = '';
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('touchend', stopDrag);
};

// Image Handlers
const triggerAvatarUpload = () => avatarInput.value?.click();
const triggerBannerUpload = () => bannerInput.value?.click();

const handleImageUpload = async (type: 'avatar' | 'banner', event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  imageError.value = "";
  const maxSize = type === 'avatar' ? MAX_AVATAR_SIZE : MAX_BANNER_SIZE;
  const config = type === 'avatar' ? { width: 400, quality: 0.7 } : { width: 1200, quality: 0.8 };
  if (file.size > maxSize) imageError.value = `Ukuran ${type} maksimal ${maxSize / 1024 / 1024}MB. Gambar akan dikompresi otomatis.`;
  try {
    const compressed = await compressImage(file, config.width, config.quality);
    if (type === 'avatar') avatarPreview.value = compressed;
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
    await new Promise(r => setTimeout(r, 800));
    
    // Self-edit mode: update profile store
    profileStore.updateProfile({
      ...formData.value,
      avatarUrl: avatarPreview.value, bannerUrl: bannerPreview.value,
      bannerPositionX: bannerPosition.value.x, bannerPositionY: bannerPosition.value.y,
      avatarPositionX: avatarPosition.value.x, avatarPositionY: avatarPosition.value.y,
    });
    
    // Sync profile data to usersStore so admin can see updated user data
    const currentUser = authStore.currentUser;
    if (currentUser) {
      usersStore.initialize(); // Ensure usersStore is initialized
      usersStore.updateUserById(currentUser.id, {
        name: formData.value.name,
        jabatan: formData.value.jabatan,
        phone: formData.value.phone,
        location: formData.value.location,
        photo: avatarPreview.value, // Sync photo to usersStore
        banner: bannerPreview.value, // Sync banner to usersStore
      });
    }
    
    showSuccessAlert.value = true;
    setTimeout(() => router.push("/profile"), 1000);
  } catch {
    showErrorAlert.value = true;
    errorMessage.value = "Terjadi kesalahan. Silakan coba lagi.";
    setTimeout(() => showErrorAlert.value = false, 3000);
  } finally { isSaving.value = false; }
};

const savePassword = async () => {
  if (passwordData.value.newPassword !== passwordData.value.confirmPassword) { alert("Password tidak cocok!"); return; }
  await new Promise(r => setTimeout(r, 500));
  passwordData.value = { currentPassword: "", newPassword: "", confirmPassword: "" };
  showSuccessAlert.value = true;
  setTimeout(() => showSuccessAlert.value = false, 3000);
};

// Cancel handler
const handleCancel = () => {
  router.push("/profile");
};

// Computed for drag state
const isDraggingBanner = computed(() => dragState.value.type === 'banner');
const isDraggingAvatar = computed(() => dragState.value.type === 'avatar');

// Role options for admin edit mode
const roleOptions = ['admin', 'User'];
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Alerts -->
  <div v-if="showSuccessAlert" class="alert alert-success alert-dismissible fade show mb-3 d-flex align-items-center" role="alert">
    <i class="ri-checkbox-circle-line fs-18 me-2"></i><div>Perubahan berhasil disimpan!</div>
    <button type="button" class="btn-close" @click="showSuccessAlert = false"></button>
  </div>
  <div v-if="showErrorAlert" class="alert alert-danger alert-dismissible fade show mb-3 d-flex align-items-center" role="alert">
    <i class="ri-error-warning-line fs-18 me-2"></i><div>{{ errorMessage || 'Terjadi kesalahan. Silakan coba lagi.' }}</div>
    <button type="button" class="btn-close" @click="showErrorAlert = false"></button>
  </div>
  <div v-if="imageError" class="alert alert-warning alert-dismissible fade show mb-3 d-flex align-items-center" role="alert">
    <i class="ri-image-line fs-18 me-2"></i><div>{{ imageError }}</div>
    <button type="button" class="btn-close" @click="imageError = ''"></button>
  </div>

  <!-- Main Container -->
  <div class="row justify-content-center">
    <div class="col-xl-11 col-xxl-10">
      <div class="card custom-card overflow-hidden profile-main-card mb-3">
        <!-- Banner Image -->
          <div ref="bannerContainer" class="profile-header-banner position-relative"
            :class="{ 'dragging': isDraggingBanner, 'draggable': !isAdminEditMode }"
            :style="{ backgroundImage: `url(${bannerPreview})`, backgroundSize: 'cover', backgroundPosition: `${bannerPosition.x}% ${bannerPosition.y}%`, minHeight: '180px', cursor: isAdminEditMode ? 'default' : (isDraggingBanner ? 'grabbing' : 'grab') }"
            @mousedown="!isAdminEditMode && startDrag('banner', $event)" @touchstart="!isAdminEditMode && startDrag('banner', $event)">
            <!-- Overlay -->
            <div class="position-absolute w-100 h-100 pointer-events-none" style="background: linear-gradient(to bottom, rgba(30, 58, 95, 0.3) 0%, rgba(26, 54, 93, 0.1) 100%);"></div>
            <!-- Banner Edit Buttons (only show in self-edit mode) -->
            <div v-if="!isAdminEditMode" class="position-absolute top-0 end-0 p-3" style="z-index: 10;">
              <div class="d-flex gap-2">
                <button @click.stop="triggerBannerUpload" class="btn btn-light btn-sm rounded-pill shadow-sm d-flex align-items-center gap-1" title="Ganti Banner">
                  <i class="ri-image-edit-line"></i><span class="d-none d-sm-inline">Ganti Banner</span>
                </button>
                <button v-if="bannerPreview !== DEFAULT_BANNER" @click="removeBanner" class="btn btn-danger btn-sm rounded-pill shadow-sm d-flex align-items-center gap-1" title="Hapus Banner">
                  <i class="ri-delete-bin-line"></i>
                </button>
              </div>
            </div>
            <!-- Drag Indicator (only show in self-edit mode) -->
            <div v-if="!isAdminEditMode" class="drag-indicator position-absolute d-flex flex-column align-items-center justify-content-center pointer-events-none" style="top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 5;">
              <div class="drag-hint-box bg-dark bg-opacity-50 text-white px-3 py-2 rounded-pill d-flex align-items-center gap-2">
                <i class="ri-drag-move-2-fill fs-16"></i><span class="fs-12">Seret untuk atur posisi</span>
              </div>
            </div>
            <input ref="bannerInput" type="file" accept="image/jpeg,image/png,image/webp" class="d-none" @change="handleImageUpload('banner', $event)" />
          </div>

          <!-- Card Body - Avatar + User Info -->
          <div class="card-body p-3 p-md-4 pb-4 position-relative">
            <div class="d-flex align-items-end justify-content-between flex-wrap gap-3" style="margin-top: -70px">
              <div class="d-flex align-items-end gap-3 flex-wrap">
                <!-- Avatar with Edit Actions -->
                <div class="position-relative">
                  <div ref="avatarContainer" class="avatar-container" :class="{ 'dragging': isDraggingAvatar, 'draggable': !isAdminEditMode }"
                    :style="{ cursor: isAdminEditMode ? 'default' : (isDraggingAvatar ? 'grabbing' : 'grab') }"
                    @mousedown="!isAdminEditMode && startDrag('avatar', $event)" @touchstart="!isAdminEditMode && startDrag('avatar', $event)">
                    <span class="avatar avatar-xxl avatar-rounded shadow-lg border border-4 border-white overflow-hidden position-relative">
                      <img :src="avatarPreview" alt="Profile Avatar" :style="{ objectPosition: `${avatarPosition.x}% ${avatarPosition.y}%`, objectFit: 'cover', width: '100%', height: '100%' }" />
                      <!-- Avatar Drag Indicator (only show in self-edit mode) -->
                      <div v-if="!isAdminEditMode" class="avatar-drag-indicator position-absolute d-flex align-items-center justify-content-center pointer-events-none" style="top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.2);">
                        <i class="ri-drag-move-2-fill text-white fs-20"></i>
                      </div>
                    </span>
                    <div v-if="!isAdminEditMode" class="avatar-actions position-absolute bottom-0 d-flex gap-1" style="z-index: 10;">
                      <button @click.stop="triggerAvatarUpload" class="btn btn-primary btn-icon btn-sm rounded-circle shadow" title="Ganti Foto">
                        <i class="ri-camera-line"></i>
                      </button>
                    </div>
                  </div>
                  <input ref="avatarInput" type="file" accept="image/*" class="d-none" @change="handleImageUpload('avatar', $event)" />
                </div>
                <!-- Name & Title -->
                <div class="pb-2 mt-2 mt-md-5">
                  <h4 class="fw-bold mb-1 text-dark profile-name">{{ formData.name || "User Name" }}</h4>
                  <p class="text-primary-dark fw-medium mb-1 d-flex align-items-center gap-1"><i class="ri-user-line"></i>{{ formData.role }}</p>
                  <p class="text-primary-dark fw-medium mb-1 d-flex align-items-center gap-1"><i class="ri-briefcase-line"></i>{{ formData.jabatan }}</p>
                  <p class="text-black fs-13 mb-2 d-flex align-items-center gap-1"><i class="ri-mail-line"></i>{{ formData.email }}</p>
                  <p class="fs-12 mb-0 mt-1">
                    <span class="me-3"><i class="ri-phone-line me-1"></i>{{ formData.phone }}</span>
                    <span><i class="ri-map-pin-line me-1"></i>{{ formData.location }}</span>
                  </p>
                </div>
              </div>
              <!-- Action Buttons (Desktop) -->
              <div class="save-btn-desktop d-none d-md-flex gap-2">
                <button @click="handleCancel" class="btn btn-outline-danger rounded-pill px-4"><i class="ri-arrow-left-line me-1"></i>Batal</button>
                <button @click="saveProfile" :disabled="isSaving" class="btn btn-secondary rounded-pill px-4">
                  <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="ri-save-line me-1"></i>{{ isSaving ? "Menyimpan..." : "Simpan Perubahan" }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Account Info Card -->
        <div class="card custom-card gradient-header-card">
          <div class="card-header d-flex align-items-center gradient-header-blue">
            <i class="ri-user-settings-line text-white me-2 fs-18"></i>
            <div class="card-title text-white mb-0">{{ isAdminEditMode ? 'Edit User' : 'Informasi Akun' }}</div>
          </div>
          <div class="card-body p-4">
            <div class="row gy-4">
              <!-- Name (readonly in admin mode) -->
              <div class="col-xl-6 col-lg-6 col-md-6">
                <label class="form-label fw-medium"><i class="ri-user-line me-1 text-primary"></i>Nama Lengkap</label>
                <input type="text" class="form-control" :class="{ 'bg-light': isAdminEditMode }" v-model="formData.name" placeholder="Masukkan nama lengkap" :readonly="isAdminEditMode" :disabled="isAdminEditMode" />
              </div>
              <!-- Jabatan (readonly in admin mode) -->
              <div class="col-xl-6 col-lg-6 col-md-6">
                <label class="form-label fw-medium"><i class="ri-briefcase-line me-1 text-primary"></i>Jabatan</label>
                <input type="text" class="form-control" :class="{ 'bg-light': isAdminEditMode }" v-model="formData.jabatan" placeholder="Masukkan jabatan" :readonly="isAdminEditMode" :disabled="isAdminEditMode" />
              </div>
              <!-- Email (readonly in admin mode) -->
              <div class="col-xl-6 col-lg-6 col-md-6">
                <label class="form-label fw-medium"><i class="ri-mail-line me-1 text-primary"></i>Email</label>
                <input type="email" class="form-control" :class="{ 'bg-light': isAdminEditMode }" v-model="formData.email" placeholder="Masukkan email" :readonly="isAdminEditMode" :disabled="isAdminEditMode" />
              </div>
              <!-- Phone (readonly in admin mode) -->
              <div class="col-xl-6 col-lg-6 col-md-6">
                <label class="form-label fw-medium"><i class="ri-phone-line me-1 text-primary"></i>Nomor Telepon</label>
                <div v-if="isAdminEditMode" class="input-group">
                  <input type="tel" class="form-control bg-light" v-model="formData.phone" placeholder="Masukkan nomor telepon" readonly disabled />
                </div>
                <div v-else class="input-group">
                  <CountryCodeDropdown 
                    v-model="selectedCountryCode" 
                    @update:modelValue="handleCountryCodeChange"
                  />
                  <input 
                    type="tel" 
                    class="form-control" 
                    v-model="phoneNumber"
                    @input="handlePhoneInput"
                    inputmode="numeric" 
                    placeholder="813 8282 8282"
                  />
                </div>
                <div class="form-text text-muted mt-1">
                  <i class="ri-information-line"></i> Format: {{ selectedCountryCode }} 813 8282 8282
                </div>
              </div>
              <!-- Location (readonly in admin mode) -->
              <div class="col-xl-6 col-lg-6 col-md-6">
                <label class="form-label fw-medium"><i class="ri-map-pin-line me-1 text-primary"></i>Lokasi</label>
                <input type="text" class="form-control" :class="{ 'bg-light': isAdminEditMode }" v-model="formData.location" placeholder="Masukkan lokasi" :readonly="isAdminEditMode" :disabled="isAdminEditMode" />
              </div>
              <!-- Role (editable dropdown in admin mode, readonly in self-edit mode) -->
              <div class="col-xl-6 col-lg-6 col-md-6">
                <label class="form-label fw-medium">
                  <i class="ri-shield-user-line me-1 text-primary"></i>Role 
                  <span v-if="!isAdminEditMode" class="text-muted fs-11 ms-1">(Tidak dapat diubah)</span>
                  <span v-else class="text-success fs-11 ms-1">(Dapat diubah)</span>
                </label>
                <select v-if="isAdminEditMode" v-model="formData.role" class="form-select">
                  <option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option>
                </select>
                <input v-else type="text" class="form-control bg-light" v-model="formData.role" readonly disabled />
              </div>
              <!-- Mobile Action Buttons -->
              <div class="col-12 d-md-none">
                <div class="d-flex gap-2">
                  <button @click="handleCancel" class="btn btn-outline-secondary w-50 py-2"><i class="ri-arrow-left-line me-1"></i>Batal</button>
                  <button @click="saveProfile" :disabled="isSaving" class="btn text-white w-50 py-2" style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%);">
                    <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                    <i v-else class="ri-save-line me-1"></i>{{ isSaving ? "Menyimpan..." : "Simpan Perubahan" }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Password Card (Hidden in Admin Edit Mode) -->
        <div v-if="!isAdminEditMode" class="card custom-card gradient-header-card">
          <div class="card-header d-flex justify-content-between align-items-center gradient-header-blue" data-bs-toggle="collapse" data-bs-target="#changePassword" style="cursor: pointer;">
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
                  <!-- Password Rules - Simplified -->
                  <div v-if="showHint && passwordData.newPassword" class="mt-2 small">
                    <div class="d-flex gap-4">
                      <ul class="list-unstyled mb-0">
                        <li v-for="(rule, i) in passwordRules.slice(0, 3)" :key="i" :class="rule.valid ? 'text-success' : 'text-danger'">
                          <i :class="rule.valid ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'" class="me-1"></i>{{ rule.label }}
                        </li>
                      </ul>
                      <ul class="list-unstyled mb-0">
                        <li v-for="(rule, i) in passwordRules.slice(3)" :key="i" :class="rule.valid ? 'text-success' : 'text-danger'">
                          <i :class="rule.valid ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'" class="me-1"></i>{{ rule.label }}
                        </li>
                      </ul>
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
            <div class="card-footer bg-light border-top-0">
              <div class="d-flex justify-content-end">
                <button @click="savePassword" class="btn btn-gradient-blue text-white">
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
.gradient-header-card { border: none !important; box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075) !important; overflow: visible !important; }
.gradient-header-card .card-header { border: none !important; border-bottom: none !important; border-block-end: none !important; border-radius: 0 !important; margin: 0 !important; overflow: hidden; }
.gradient-header-card .card-body { border: 1px solid var(--default-border); border-top: none !important; border-radius: 0 !important; overflow: visible !important; }
.gradient-header-card .card-footer { border: 1px solid var(--default-border); border-top: none !important; border-radius: 0 !important; }
.draggable { user-select: none; -webkit-user-select: none; }
.draggable:hover { cursor: grab; }
.draggable.dragging { cursor: grabbing; }
.pointer-events-none { pointer-events: none; }
@keyframes pulse { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(25, 135, 84, 0.7); } 50% { transform: scale(1.05); box-shadow: 0 0 0 6px rgba(25, 135, 84, 0); } 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(25, 135, 84, 0); } }
.animate-pulse { animation: pulse 1.5s infinite; }
.avatar-container.draggable img { pointer-events: none; }
.drag-indicator { opacity: 0.7; transition: opacity 0.3s ease; }
.profile-header-banner:hover .drag-indicator { opacity: 1; }
.profile-header-banner.dragging .drag-indicator { opacity: 0; }
.drag-hint-box { backdrop-filter: blur(4px); border: 1px solid rgba(255, 255, 255, 0.2); }
.avatar-drag-indicator { opacity: 0; transition: opacity 0.3s ease; border-radius: 50%; }
.avatar-container:hover .avatar-drag-indicator { opacity: 1; }
.avatar-container.dragging .avatar-drag-indicator { opacity: 0.5; }

/* Dark Mode Styles */
html[data-theme-mode="dark"] .text-dark,
html.dark .text-dark {
  color: #e2e8f0 !important;
}

html[data-theme-mode="dark"] .text-black,
html.dark .text-black {
  color: #cbd5e0 !important;
}

html[data-theme-mode="dark"] .text-primary-dark,
html.dark .text-primary-dark {
  color: #94a3b8 !important;
}

html[data-theme-mode="dark"] .form-label,
html.dark .form-label {
  color: #cbd5e0 !important;
}

html[data-theme-mode="dark"] .text-muted,
html.dark .text-muted {
  color: #9ca3af !important;
}

html[data-theme-mode="dark"] .avatar.border-white,
html.dark .avatar.border-white {
  border-color: #374151 !important;
}

/* Blue Button with White Text */
.btn-gradient-blue {
  background: #08377c !important;
  border: none !important;
  color: #ffffff !important;
}

.btn-gradient-blue:hover {
  background: #0b5ed7 !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  color: #ffffff !important;
}

.btn-gradient-blue:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Ensure white text in dark mode */
html[data-theme-mode="dark"] .btn-gradient-blue,
html.dark .btn-gradient-blue {
  color: #ffffff !important;
}

html[data-theme-mode="dark"] .btn-gradient-blue:hover,
html.dark .btn-gradient-blue:hover {
  color: #ffffff !important;
}
</style>
