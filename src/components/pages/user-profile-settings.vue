<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import type { Jabatan } from "../../types/jabatan.types";
import { usersService } from "../../services/users.service";
import { roleService } from "../../services/role.service";
import { jabatanService } from "../../services/jabatan.service";
import { stakeholdersService } from "../../services/stakeholders.service";
import { formatImageUrl } from "../../utils/media";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";

// Constants
const DEFAULT_FOTO_PROFILE = "/images/faces/9.jpg";
const DEFAULT_BANNER = "/images/media/media-3.jpg";
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
const imageError = ref("");
const isSaving = ref(false);
const showSuccessAlert = ref(false);
const showErrorAlert = ref(false);
const errorMessage = ref("");
const loading = ref(true);

// User data for the specific user being edited
const targetUser = ref<any>(null);
const displaySektor = computed(() => (targetUser.value as any)?.sektor || "Sektor");

const formData = ref({
  id: "",
  name: "",
  role: "",
  jabatan: "",
  idJabatan: "",
  location: "",
  email: "",
  phone: "",
  website: "",
  bio: "",
  address: "",
  idPerusahaan: "",
  namaPerusahaan: ""
});

const dataToPass = computed(() => ({
  title: { label: "Users", path: "/users" },
  currentpage: "Profile Settings",
  activepage: "Profile Settings"
}));

// Unified Drag State
const dragState = ref({ type: '' as 'banner' | 'foto_profile' | '', startX: 0, startY: 0, initialX: 0, initialY: 0 });

const slug = computed(() => route.params.slug as string);

interface FormField {
  key: string;
  label: string;
  icon: string;
  type: string;
  iconClass: string;
  badge?: string;
  options?: { label: string; value: string }[];
  readonly?: boolean;
}

// Jabatan dropdown state
const jabatanList = ref<Jabatan[]>([]);
const selectedJabatan = ref(""); 
const newJabatanName = ref("");

// Image State
const fotoProfileInput = ref<HTMLInputElement | null>(null);
const fotoProfilePreview = ref(DEFAULT_FOTO_PROFILE);

// Password state removal - logic handled as per user request
const bannerInput = ref<HTMLInputElement | null>(null);
const bannerPreview = ref(DEFAULT_BANNER);
const bannerPosition = ref({ x: 50, y: 50 });
const fotoProfilePosition = ref({ x: 50, y: 50 });
const bannerContainer = ref<HTMLElement | null>(null);
const fotoProfileContainer = ref<HTMLElement | null>(null);

const formFields = computed<FormField[]>(() => [
  { key: 'name',     label: 'Nama Lengkap', icon: 'ri-user-line',      type: 'text', iconClass: 'stat-icon-teal' },
  { key: 'jabatan',  label: 'Jabatan',      icon: 'ri-briefcase-line', type: 'text', iconClass: 'stat-icon-blue' },
  { key: 'email',    label: 'Email',        icon: 'ri-mail-line',      type: 'email',iconClass: 'stat-icon-indigo' },
  { key: 'namaPerusahaan', label: 'Perusahaan',   icon: 'ri-building-line',  type: 'text', iconClass: 'stat-icon-amber', badge: 'dari registrasi', readonly: true },
  { key: 'phone',    label: 'Nomor Telepon',icon: 'ri-phone-line',     type: 'text', iconClass: 'stat-icon-violet',badge: 'dari stakeholder', readonly: true },
  { key: 'location', label: 'Lokasi',       icon: 'ri-map-pin-line',   type: 'text', iconClass: 'stat-icon-amber', badge: 'dari stakeholder', readonly: true },
  { key: 'website',  label: 'Sektor',       icon: 'ri-global-line',    type: 'text', iconClass: 'stat-icon-purple',badge: 'dari stakeholder', readonly: true },
  { key: 'role',     label: 'Role',         icon: 'ri-shield-user-line',type: 'select',iconClass: 'stat-icon-red',   options: roleOptions.map(r => ({ label: r, value: r })) },
]);

// Helper for dynamic fields
const getFieldModel = (key: string) => {
  return (formData.value as any)[key];
};
const setFieldModel = (key: string, val: any) => {
  (formData.value as any)[key] = val;
};

const handleFieldInput = (key: string, event: Event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  setFieldModel(key, target.value);
};

// Load target user data
const loadTargetUser = async () => {
  loading.value = true;
  try {
    const [users, jabatans] = await Promise.all([
      usersService.getAll(),
      jabatanService.getAll()
    ]);
    
    jabatanList.value = jabatans;
    
    const found = users.find((u: any) => u.slug === slug.value || u.username === slug.value || u.id?.toString() === slug.value);
    
    if (!found) {
      router.push("/users");
      return;
    }
    
    targetUser.value = found;
    
    formData.value = {
      id: found.id?.toString() || "",
      name: found.name || found.username || "",
      role: found.role || found.role_name || "user",
      jabatan: found.jabatan_name || found.jabatan || "",
      idJabatan: found.id_jabatan || "",
      location: found.location || "",
      email: found.email || "",
      phone: (found as any).phone || (found as any).telepon || "",
      website: (found as any).website || "",
      bio: (found as any).bio || "",
      address: (found as any).address || (found as any).alamat || "",
      idPerusahaan: found.id_perusahaan || "",
      namaPerusahaan: ""
    };
    
    // Fetch stakeholder data if available
    if (formData.value.idPerusahaan) {
      try {
        const company = await stakeholdersService.getById(formData.value.idPerusahaan.toString());
        const c = (company as any)?.data ?? company;
        formData.value.namaPerusahaan = c.nama_perusahaan || "";
        // Optional: override with stakeholder data if preferred
        formData.value.location = c.alamat || formData.value.location;
        formData.value.phone = c.telepon || formData.value.phone;
      } catch (err) {
        console.warn('Failed to fetch stakeholder data:', err);
      }
    }
    
    selectedJabatan.value = found.id_jabatan || "";
    fotoProfilePreview.value = formatImageUrl(found.photo || found.foto_profile) || DEFAULT_FOTO_PROFILE;
    bannerPreview.value = formatImageUrl(found.banner) || DEFAULT_BANNER;
    
    bannerPosition.value = { 
      x: (found as any).banner_position_x !== undefined ? Number((found as any).banner_position_x) : 50, 
      y: (found as any).banner_position_y !== undefined ? Number((found as any).banner_position_y) : 50 
    };
    fotoProfilePosition.value = { 
      x: (found as any).foto_profile_position_x !== undefined ? Number((found as any).foto_profile_position_x) : 50, 
      y: (found as any).foto_profile_position_y !== undefined ? Number((found as any).foto_profile_position_y) : 50 
    };

  } catch (err) {
    console.error("Failed to load user:", err);
    router.push("/users");
  } finally {
    loading.value = false;
  }
};

onMounted(loadTargetUser);
watch(slug, loadTargetUser);

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
  const config = type === 'foto_profile' ? { width: 400, quality: 0.7 } : { width: 1200, quality: 0.8 };
  try {
    const compressed = await compressImage(file, config.width, config.quality);
    if (type === 'foto_profile') fotoProfilePreview.value = compressed;
    else bannerPreview.value = compressed;
  } catch (error) {
    console.error(`Error compressing ${type}:`, error);
    imageError.value = "Gagal memproses gambar.";
  }
};

const removeBanner = () => { bannerPreview.value = DEFAULT_BANNER; };

// Save Function
const saveProfile = async () => {
  if (!targetUser.value) return;
  isSaving.value = true;
  try {
    const payload: any = {
      name:     formData.value.name,
      email:    formData.value.email,
      phone:    formData.value.phone,
      location: formData.value.location,
      website:  formData.value.website,
      bio:      formData.value.bio,
      address:  formData.value.address,
      role:     formData.value.role,
      banner_position_x: bannerPosition.value.x, 
      banner_position_y: bannerPosition.value.y,
      foto_profile_position_x: fotoProfilePosition.value.x, 
      foto_profile_position_y: fotoProfilePosition.value.y,
    };

    if (fotoProfilePreview.value.startsWith('data:')) {
      payload.fotoProfileBase64 = fotoProfilePreview.value;
    }
    if (bannerPreview.value.startsWith('data:')) {
      payload.bannerBase64 = bannerPreview.value;
    } else if (bannerPreview.value === DEFAULT_BANNER) {
      payload.banner = ""; // Remove banner
    }

    if (selectedJabatan.value === 'NEW') {
      payload.newJabatanName = newJabatanName.value;
    } else {
      payload.id_jabatan = selectedJabatan.value;
    }
    
    // Update user info
    await usersService.update(formData.value.id, payload);

    // Update role if changed
    const roleObj = (await roleService.getAll()).find(r => r.name.toLowerCase() === formData.value.role.toLowerCase());
    if (roleObj) {
      await roleService.assignToUser(formData.value.id, roleObj.id);
    }

    showSuccessAlert.value = true;
    setTimeout(() => router.push(`/users/${slug.value}`), 1000);
  } catch (error: any) {
    showErrorAlert.value = true;
    errorMessage.value = error.message || "Gagal menyimpan data.";
    setTimeout(() => showErrorAlert.value = false, 3000);
  } finally { isSaving.value = false; }
};

const handleCancel = () => {
  router.push(`/users/${slug.value}`);
};

const isDraggingBanner = computed(() => dragState.value.type === 'banner');
const isDraggingFotoProfile = computed(() => dragState.value.type === 'foto_profile');

const roleOptions = ['admin', 'user'];
</script>

<template>
  <Pageheader :propData="dataToPass"></Pageheader>

  <transition name="slide-toast">
    <div v-if="showSuccessAlert" class="settings-toast settings-toast--success">
      <div class="settings-toast-icon"><i class="ri-checkbox-circle-fill"></i></div>
      <div class="settings-toast-body"><strong>Berhasil!</strong> Perubahan berhasil disimpan.</div>
      <button class="settings-toast-close" @click="showSuccessAlert = false"><i class="ri-close-line"></i></button>
    </div>
  </transition>

  <div class="row">
    <div class="col-xl-12">
      <div v-if="loading" class="card custom-card p-5 text-center">
        <div class="spinner-border text-primary" role="status"></div>
        <div class="mt-2 text-muted">Memuat data user...</div>
      </div>

      <div v-else>
        <div class="card custom-card gradient-header-card">
          <!-- Page Header -->
          <div class="card-header d-flex align-items-center justify-content-between gap-3 users-header">
            <div class="d-flex align-items-center gap-3">
              <div class="header-icon-box">
                <i class="ri-user-settings-line"></i>
              </div>
              <div>
                <div class="card-title mb-0 text-white fw-bold header-card-title">Profile Settings</div>
                <div class="header-subtitle mt-1">Edit informasi akun & data pribadi</div>
              </div>
            </div>
          </div>

          <div class="card-body p-4">
            <!--  HERO CARD (banner + foto_profile + info)  -->
            <div class="card custom-card hero-card-shell mb-4">
              <!-- Banner Image -->
              <div
                ref="bannerContainer"
                class="profile-banner draggable"
                :class="{ 'dragging': isDraggingBanner }"
                :style="{ backgroundImage: `url(${bannerPreview})`, backgroundPosition: `${bannerPosition.x}% ${bannerPosition.y}%` }"
                @mousedown="startDrag('banner', $event)"
                @touchstart="startDrag('banner', $event)"
              >
                <!-- Banner Edit Buttons -->
                <div class="position-absolute top-0 end-0 p-3 p-md-4" style="z-index: 10;">
                  <div class="d-flex gap-2">
                    <button @click.stop="triggerBannerUpload" class="btn-edit-profile btn-primary" title="Maks 2MB">
                      <i class="ri-image-edit-line"></i>
                      <span class="d-none d-sm-inline">Ganti Banner (Maks 2MB)</span>
                    </button>
                    <button v-if="bannerPreview !== DEFAULT_BANNER" @click.stop="removeBanner" class="btn-edit-profile btn-danger">
                      <i class="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </div>
                <!-- Drag Indicator -->
                <div class="drag-indicator position-absolute d-flex flex-column align-items-center justify-content-center pointer-events-none" style="top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 5;">
                  <div class="drag-hint-box bg-dark bg-opacity-50 text-white px-3 py-2 rounded-pill d-flex align-items-center gap-2">
                    <i class="ri-drag-move-2-fill fs-16"></i><span class="fs-12">Seret untuk atur posisi</span>
                  </div>
                </div>
                <input ref="bannerInput" type="file" accept="image/*" class="d-none" @change="handleImageUpload('banner', $event)" />
              </div>

              <!-- Profile Content Body -->
              <div class="profile-content-body">
                <!-- Foto Profile Container -->
                <div class="profile-foto-profile-container">
                  <div
                    ref="fotoProfileContainer"
                    class="profile-foto-profile-wrap draggable"
                    :class="{ 'dragging': isDraggingFotoProfile }"
                    @mousedown="startDrag('foto_profile', $event)"
                    @touchstart="startDrag('foto_profile', $event)"
                  >
                    <img
                      :src="fotoProfilePreview"
                      alt="Foto Profile"
                      class="profile-foto-profile-img"
                      :style="{ objectPosition: `${fotoProfilePosition.x}% ${fotoProfilePosition.y}%` }"
                    />
                    <!-- Foto Profile Drag Indicator -->
                    <div class="foto-profile-drag-indicator position-absolute d-flex align-items-center justify-content-center pointer-events-none" style="top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.2); border-radius: 50%;">
                      <i class="ri-drag-move-2-fill text-white fs-20"></i>
                    </div>
                  </div>
                  <!-- Foto Profile Upload Button -->
                  <div class="foto-profile-upload-btn">
                    <button @click.stop="triggerFotoProfileUpload" class="btn btn-primary btn-icon btn-sm rounded-circle shadow" title="Ganti Foto (Maks 2MB)">
                      <i class="ri-camera-line"></i>
                    </button>
                  </div>
                  <input ref="fotoProfileInput" type="file" accept="image/*" class="d-none" @change="handleImageUpload('foto_profile', $event)" />
                </div>

                <!-- Info Block -->
                <div class="profile-info-block">
                  <div class="d-flex align-items-start justify-content-between flex-wrap gap-2">
                    <div>
                      <h4 class="profile-user-name mb-1">{{ targetUser?.username || "Username" }}</h4>
                      <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
                        <span :class="['profile-role-badge', `profile-role-badge--${(formData.role || '').toLowerCase()}`]">
                          <i :class="formData.role?.toLowerCase() === 'admin' ? 'ri-shield-user-line' : 'ri-user-line'"></i> {{ formData.role }}
                        </span>
                        <span class="profile-jabatan-badge">
                          <i class="ri-briefcase-line"></i> {{ formData.jabatan || "Role" }}
                        </span>
                        <span class="profile-perusahaan-badge">
                          <i class="ri-building-line"></i> {{ formData.namaPerusahaan || "Perusahaan" }}
                        </span>
                        <span class="profile-sektor-badge">
                           <i class="ri-pie-chart-line"></i> {{ displaySektor }}
                        </span>
                      </div>
                      <p class="profile-email-text mb-1">
                        <i class="ri-mail-line me-1"></i> {{ formData.email }}
                      </p>
                      <div class="profile-meta-row">
                        <span><i class="ri-phone-line me-1"></i> {{ formData.phone }}</span>
                        <span class="contact-bar-sep-inline"></span>
                        <span><i class="ri-map-pin-line me-1"></i> {{ formData.location }}</span>
                      </div>
                    </div>

                    <!-- Action Buttons (Desktop) -->
                    <div class="save-btn-desktop d-none d-md-flex gap-2 align-self-start mt-1">
                      <button @click="handleCancel" class="btn-cancel-glass rounded-pill px-4">
                        <i class="ri-arrow-left-line me-1"></i> Batal
                      </button>
                      <button @click="saveProfile" :disabled="isSaving" class="btn-save-primary rounded-pill px-4">
                        <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                        <i v-else class="ri-save-line me-1"></i> {{ isSaving ? "Menyimpan..." : "Simpan Perubahan" }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- INFORMASI AKUN SECTION -->
        <div class="card custom-card gradient-header-card mb-4">
          <div class="card-header d-flex align-items-center gap-3 users-header">
            <div class="header-icon-box" style="width:36px;height:36px">
              <i class="ri-user-settings-line" style="font-size:1.3rem"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">Informasi Akun</div>
              <div class="header-subtitle mt-1">Edit data detail profil pengguna</div>
            </div>
          </div>
          <div class="card-body p-4">
            <div class="row g-3">
              <div class="col-xl-6 col-lg-6 col-md-6" v-for="field in formFields" :key="field.key">
                <div class="form-group-split">
                  <div class="form-group-split-label-card">
                    <div :class="['form-item-icon', field.iconClass]" style="width:32px;height:32px">
                      <i :class="field.icon" style="font-size:0.95rem"></i>
                    </div>
                    <label class="form-item-label mb-0">
                      {{ field.label }}
                      <span v-if="field.badge" class="form-item-badge">{{ field.badge }}</span>
                    </label>
                  </div>
                  <div class="form-group-split-input-card" :class="{ 'form-item-card--readonly': field.readonly }">
                    <select 
                      v-if="field.type === 'select'"
                      :value="getFieldModel(field.key)"
                      @change="(e) => handleFieldInput(field.key, e)"
                      class="form-item-input form-item-select"
                      :disabled="field.readonly"
                    >
                       <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                    </select>
                    <input 
                      v-else
                      :type="field.type" 
                      :value="getFieldModel(field.key)"
                      @input="(e) => handleFieldInput(field.key, e)"
                      class="form-item-input" 
                      :readonly="field.readonly"
                      :placeholder="`Masukkan ${field.label.toLowerCase()}`"
                    />
                    <i :class="field.readonly ? 'ri-lock-2-line form-item-edit-action' : 'ri-pencil-line form-item-edit-action'"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
 
      </div>
    </div>
  </div>
</template>

<style scoped>
@import "@/assets/css/style2.css";

.draggable { cursor: grab; }
.draggable:active { cursor: grabbing; }
.dragging { cursor: grabbing !important; opacity: 0.8; }

.btn-icon { width:32px; height:32px; padding:0; display:inline-flex; align-items:center; justify-content:center; border-radius:6px; }

/* Sync with profile-settings.vue */
.gradient-header-card { border: none !important; border-radius: 12px; overflow: hidden; }
.hero-card-shell { border-radius: 12px; border: 1px solid #e2e8f0 !important; }

.form-item-icon {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 8px !important;
}

/* Transitions */
.slide-toast-enter-active, .slide-toast-leave-active { transition: all 0.3s ease; }
.slide-toast-enter-from, .slide-toast-leave-to { transform: translateX(100px); opacity: 0; }
</style>
