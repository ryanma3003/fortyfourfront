<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useProfileStore } from "../../stores/profile";
import { useAuthStore } from "../../stores/auth";
import { usersService } from "../../services/users.service";
import { roleService, type Role } from "../../services/role.service";
import { stakeholdersService } from "../../services/stakeholders.service";
import { jabatanService } from "../../services/jabatan.service";
import type { Jabatan } from "../../types/jabatan.types";
import { formatImageUrl } from "../../utils/media";
import type { User } from "../../types/user.types";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";

const route = useRoute();
const router = useRouter();
const profileStore = useProfileStore();
const authStore = useAuthStore();

const DEFAULT_FOTO = "/images/faces/15.jpg";
const DEFAULT_BANNER = "/images/media/media-21.jpg";

const user = ref<User | null>(null);
const loading = ref(true);
const isCurrentUser = ref(false);
const isEditMode = ref(false);
const isSaving = ref(false);
const userCompanyName = ref('');
const userSubSektor = ref('');
const rolesData = ref<Role[]>([]);
const jabatanList = ref<Jabatan[]>([]);

const isAdmin = computed(() => authStore.isAdmin);
const slug = computed(() => route.params.slug as string);

// FORM STATE
interface UserFormData {
  id: string;
  username: string;
  display_name: string;
  email: string;
  phone: string;
  location: string;
  jabatan: string;
  id_jabatan: string;
  role: string;
  status: string;
  namaPerusahaan: string;
  [key: string]: string;
}

const formData = ref<UserFormData>({
  id: "",
  username: "",
  display_name: "",
  email: "",
  phone: "",
  location: "",
  jabatan: "",
  id_jabatan: "",
  role: "",
  status: "",
  namaPerusahaan: ""
});

// IMAGE STATE
const bannerPreview = ref(DEFAULT_BANNER);
const fotoPreview = ref(DEFAULT_FOTO);
const bannerPosition = ref({ x: 50, y: 50 });
const fotoPosition = ref({ x: 50, y: 50 });
const bannerInput = ref<HTMLInputElement | null>(null);
const fotoInput = ref<HTMLInputElement | null>(null);
const bannerContainer = ref<HTMLElement | null>(null);
const fotoContainer = ref<HTMLElement | null>(null);
const dragState = ref({ type: '' as 'banner' | 'foto' | '', startX: 0, startY: 0, initialX: 0, initialY: 0 });

const formatJoinedDate = (dateString: string | undefined): string => {
  if (!dateString) return "Tidak diketahui";
  try {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
};

const getUserStatusText = (status?: any) => {
  if (status === null || status === undefined) return 'Active';
  const s = String(status).toLowerCase().trim();
  if (['suspend', 'suspended', 'nonaktif', 'inactive', '0', 'false'].includes(s)) return 'Suspend';
  return 'Active';
};

const loadUser = async () => {
  loading.value = true;
  try {
    const [roles, jabatans] = await Promise.all([
      roleService.getAll(),
      jabatanService.getAll()
    ]);

    rolesData.value = roles;
    jabatanList.value = jabatans;

    const slugVal = (route.params.slug || '') as string;
    // Fetch users (fresh fetch)
    const usersList = await (usersService.getAll() as any);
    const foundUser = usersList.find((u: any) => 
      u.slug === slugVal || u.username === slugVal || u.id?.toString() === slugVal
    );

    if (foundUser) {
      user.value = {
        id: foundUser.id?.toString() || "",
        slug: foundUser.slug || foundUser.username || "",
        username: foundUser.username || "",
        display_name: foundUser.display_name || "",
        name: foundUser.name || foundUser.username || "Unknown",
        email: foundUser.email || "",
        jabatan: foundUser.jabatan_name || foundUser.jabatan || "",
        role: foundUser.role || foundUser.role_name || "user",
        status: typeof (foundUser as any).status !== 'undefined' ? String((foundUser as any).status) : 
                typeof (foundUser as any).is_active !== 'undefined' ? ((foundUser as any).is_active ? 'active' : 'suspend') :
                typeof (foundUser as any).is_suspended !== 'undefined' ? ((foundUser as any).is_suspended ? 'suspend' : 'active') :
                typeof (foundUser as any).aktif !== 'undefined' ? ((foundUser as any).aktif == 1 ? 'active' : 'suspend') :
                typeof (foundUser as any).status_akun !== 'undefined' ? String((foundUser as any).status_akun) : '1',
        phone: foundUser.phone || "",
        location: foundUser.location || "",
        joined: foundUser.joined || (foundUser as any).created_at || "",
        photo: formatImageUrl(foundUser.photo || foundUser.foto_profile),
        banner: formatImageUrl(foundUser.banner),
        id_jabatan: (foundUser as any).id_jabatan || ""
      } as any;

      if (authStore.currentUser?.username === foundUser.username) {
        isCurrentUser.value = true;
        await profileStore.switchUser();
      } else {
        isCurrentUser.value = false;
      }

      // Populate formData
      formData.value = {
        id: foundUser.id?.toString() || "",
        username: foundUser.username || "",
        display_name: foundUser.display_name || "",
        email: foundUser.email || "",
        phone: foundUser.phone || "",
        location: foundUser.location || "",
        jabatan: foundUser.jabatan_name || foundUser.jabatan || "",
        id_jabatan: foundUser.id_jabatan || "",
        role: foundUser.role || foundUser.role_name || "user",
        status: getUserStatusText(user.value?.status),
        namaPerusahaan: ""
      };

      // Set image previews
      bannerPreview.value = user.value?.banner || DEFAULT_BANNER;
      fotoPreview.value = user.value?.photo || DEFAULT_FOTO;
      bannerPosition.value = { 
        x: (foundUser as any).banner_position_x !== undefined ? Number((foundUser as any).banner_position_x) : 50, 
        y: (foundUser as any).banner_position_y !== undefined ? Number((foundUser as any).banner_position_y) : 50 
      };
      fotoPosition.value = { 
        x: (foundUser as any).foto_profile_position_x !== undefined ? Number((foundUser as any).foto_profile_position_x) : 50, 
        y: (foundUser as any).foto_profile_position_y !== undefined ? Number((foundUser as any).foto_profile_position_y) : 50 
      };

      const idPerusahaan = foundUser.id_perusahaan;
      if (idPerusahaan) {
        try {
          const company = await stakeholdersService.getById(idPerusahaan.toString());
          const c = (company as any)?.data ?? company;
          userCompanyName.value = c.nama_perusahaan || '';
          userSubSektor.value = c.sub_sektor?.nama_sub_sektor || '';
          formData.value.namaPerusahaan = userCompanyName.value;

          // Pull phone & location from stakeholder data
          const stakeholderPhone = c.telepon || '';
          const stakeholderLocation = c.alamat || '';
          if (stakeholderPhone) {
            user.value!.phone = stakeholderPhone;
            formData.value.phone = stakeholderPhone;
          }
          if (stakeholderLocation) {
            user.value!.location = stakeholderLocation;
            formData.value.location = stakeholderLocation;
          }
        } catch {
          userCompanyName.value = '';
          userSubSektor.value = '';
        }
      }

      // Automatically trigger edit mode if query param exists
      if (route.query.edit === 'true' && isAdmin.value && !isCurrentUser.value) {
        isEditMode.value = true;
      }
    } else {
      router.push("/users");
    }
  } catch (error) {
    console.error("Failed to load user:", error);
    router.push("/users");
  } finally {
    loading.value = false;
  }
};

watch(slug, loadUser);
onMounted(loadUser);

const dataToPass = computed(() => ({
  title: { label: "Users", path: "/users" },
  currentpage: displayName.value || "User Profile",
  activepage: "User Profile",
}));

const displayName = computed(() =>
  isCurrentUser.value ? profileStore.displayName : (user.value?.display_name || user.value?.name || "")
);
const displayEmail = computed(() =>
  isCurrentUser.value ? profileStore.displayEmail : user.value?.email || ""
);
const displayUsername = computed(() =>
  isCurrentUser.value ? (profileStore.name || authStore.currentUser?.username || '') : user.value?.username || ""
);
const displayRole = computed(() =>
  isCurrentUser.value ? profileStore.displayRole : user.value?.role || ""
);
const displayJabatan = computed(() =>
  isCurrentUser.value ? profileStore.displayJabatan : user.value?.jabatan || ""
);
const displayPhone = computed(() =>
  isCurrentUser.value ? profileStore.displayPhone : user.value?.phone || ""
);
const displayLocation = computed(() =>
  isCurrentUser.value ? profileStore.displayLocation : user.value?.location || ""
);
const displayJoined = computed(() =>
  isCurrentUser.value ? profileStore.displayJoined : formatJoinedDate(user.value?.joined)
);
const displayPerusahaan = computed(() =>
  isCurrentUser.value ? (profileStore.namaPerusahaan || 'Belum terkait') : (userCompanyName.value || 'Belum terkait')
);
const displaySubSektor = computed(() =>
  isCurrentUser.value ? (profileStore.namaSubSektor || 'Belum terkait') : (userSubSektor.value || 'Belum terkait')
);
const displayStatus = computed(() =>
  isCurrentUser.value ? 'Active' : getUserStatusText(user.value?.status)
);

const accountDetails = computed(() => [
  { key: 'username', icon: "ri-at-line",           label: "Username",        value: displayUsername.value,     colorClass: "stat-icon-teal",   isEditable: false, type: 'text' },
  { key: 'email',    icon: "ri-mail-line",        label: "Email",           value: displayEmail.value,       colorClass: "stat-icon-indigo", isEditable: true, type: 'text' },
  { key: 'phone',    icon: "ri-lock-line",        label: "Telepon",         value: displayPhone.value,       colorClass: "stat-icon-violet", isEditable: false, type: 'text', badge: 'dari stakeholder' },
  { key: 'jabatan',  icon: "ri-briefcase-line",   label: "Jabatan",         value: displayJabatan.value,     colorClass: "stat-icon-blue",   isEditable: true, type: 'select' },
  { key: 'company',  icon: "ri-building-line",    label: "Perusahaan",      value: displayPerusahaan.value,  colorClass: "stat-icon-amber",  isEditable: false, wrap: true, badge: 'dari registrasi' },
  { key: 'location', icon: "ri-map-pin-line",     label: "Lokasi",          value: displayLocation.value,    colorClass: "stat-icon-amber",  isEditable: false, type: 'text', wrap: true, badge: 'dari stakeholder' },
  { key: 'sector',   icon: "ri-pie-chart-line",   label: "Sektor",          value: displaySubSektor.value,   colorClass: "stat-icon-blue",   isEditable: false, wrap: true, badge: 'dari stakeholder' },
  { key: 'role',     icon: "ri-shield-user-line", label: "Role",            value: displayRole.value,        colorClass: "stat-icon-red",    isEditable: true, type: 'select' },
  { key: 'status',   icon: "ri-toggle-line",      label: "Status Akun",     value: displayStatus.value,      colorClass: displayStatus.value === 'Active' ? 'stat-icon-teal' : 'stat-icon-red', isEditable: true, type: 'select' },
  { key: 'joined',   icon: "ri-calendar-line",    label: "Bergabung Sejak", value: displayJoined.value,      colorClass: "stat-icon-teal",   isEditable: false },
]);

// --- Modal & Toast ---
const showToast = ref(false);
const toastMessage = ref("");
const toastType = ref<"success" | "error">("success");

const showNotification = (msg: string, type: "success" | "error" = "success") => {
  toastMessage.value = msg;
  toastType.value = type;
  showToast.value = true;
  setTimeout(() => { showToast.value = false; }, 3000);
};

// --- Image Compression & Handling ---
const compressImage = (file: File, maxWidth: number, quality: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas Error')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const handleImageUpload = async (type: 'foto' | 'banner', event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const config = type === 'foto' ? { w: 400, q: 0.7 } : { w: 1200, q: 0.8 };
  try {
    const compressed = await compressImage(file, config.w, config.q);
    if (type === 'foto') fotoPreview.value = compressed;
    else bannerPreview.value = compressed;
  } catch (err) {
    showNotification("Gagal memproses gambar", "error");
  }
};

// --- DRAG HANDLERS ---
const getClientPos = (e: MouseEvent | TouchEvent) => 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };

const startDrag = (type: 'banner' | 'foto', e: MouseEvent | TouchEvent) => {
  if (!isEditMode.value) return;
  e.preventDefault();
  const pos = getClientPos(e);
  const current = type === 'banner' ? bannerPosition.value : fotoPosition.value;
  dragState.value = { type, startX: pos.x, startY: pos.y, initialX: current.x, initialY: current.y };
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
};

const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!dragState.value.type) return;
  const container = dragState.value.type === 'banner' ? bannerContainer.value : fotoContainer.value;
  if (!container) return;
  const pos = getClientPos(e);
  const rect = container.getBoundingClientRect();
  const deltaX = ((pos.x - dragState.value.startX) / rect.width) * 100;
  const deltaY = ((pos.y - dragState.value.startY) / rect.height) * 100;
  const target = dragState.value.type === 'banner' ? bannerPosition : fotoPosition;
  target.value = {
    x: Math.max(0, Math.min(100, dragState.value.initialX - deltaX)),
    y: Math.max(0, Math.min(100, dragState.value.initialY - deltaY))
  };
};

const dataURLtoBlob = (dataurl: string) => {
  const arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], {type: mime});
};

const stopDrag = () => {
  dragState.value.type = '';
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
};

// --- PERSISTENCE ---
const saveProfile = async () => {
  if (!user.value) return;
  isSaving.value = true;
  try {
    const isStatusActive = formData.value.status === 'Active';
    
    // 1. METADATA UPDATE (Nested Payload for Go binding + Shotgun Status)
    const rawPayload: any = {
      username:     (user.value.username || '').toString(),
      display_name: (formData.value.display_name || '').toString(),
      name:         (formData.value.display_name || '').toString(), 
      email:        (formData.value.email || '').toString(),
      telepon:      (formData.value.phone || '').toString(),
      phone:        (formData.value.phone || '').toString(),
      alamat:       (formData.value.location || '').toString(),
      location:     (formData.value.location || '').toString(),
      id_jabatan:   formData.value.id_jabatan || null,

      // CLEAN TARGETED STATUS
      status:       isStatusActive ? "Active" : "Suspend", 
      is_active:    isStatusActive,
      is_suspended: !isStatusActive,
      aktif:        isStatusActive ? 1 : 0,
      
      banner_position_x: bannerPosition.value.x,
      banner_position_y: bannerPosition.value.y,
      foto_profile_position_x: fotoPosition.value.x,
      foto_profile_position_y: fotoPosition.value.y,
    };

    // Role
    const roleObj = rolesData.value.find(r => r.name.toLowerCase() === formData.value.role.toLowerCase());
    if (roleObj) {
      rawPayload.role_id = roleObj.id;
    }

    // Try BOTH flat and nested (common in Go)
    const metadataPayload = {
      ...rawPayload,
      user: rawPayload // Nested fallback
    };

    if (isCurrentUser.value) {
      await usersService.updateMe(metadataPayload);
    } else {
      await usersService.update(user.value.id, metadataPayload);
    }

    // 2. MEDIA UPLOADS (POST via FormData)
    // Profile Photo
    if (fotoPreview.value.startsWith('data:')) {
      try {
        const photoData = new FormData();
        const blob = dataURLtoBlob(fotoPreview.value);
        
        if (isCurrentUser.value) {
          photoData.append('profile_photo', blob, 'foto_profile.jpg');
          await usersService.updateMePhoto(photoData);
        } else {
          photoData.append('profile_photo', blob, 'foto_profile.jpg');
          await usersService.updateProfilePhoto(user.value!.id, photoData);
        }
      } catch (err) {
        console.error("Failed to upload profile photo:", err);
      }
    }

    // Banner
    if (bannerPreview.value.startsWith('data:')) {
      try {
        const bannerData = new FormData();
        const blob = dataURLtoBlob(bannerPreview.value);
        
        if (isCurrentUser.value) {
          bannerData.append('banner', blob, 'banner.jpg');
          await usersService.updateMeBanner(bannerData);
        } else {
          bannerData.append('banner', blob, 'banner.jpg');
          await usersService.updateBanner(user.value!.id, bannerData);
        }
      } catch (err) {
        console.error("Failed to upload banner:", err);
      }
    }

    showNotification("Profil berhasil diperbarui", "success");
    isEditMode.value = false;
    await loadUser(); // Reload to refresh display data
  } catch (error: any) {
    console.error("❌ SAVE FAILED:", error);
    if (error.response) {
      console.error("❌ SERVER ERROR DATA:", error.response.data);
      console.error("❌ SERVER STATUS:", error.response.status);
    }
    showNotification(error.message || "Gagal menyimpan perubahan", "error");
  } finally {
    isSaving.value = false;
  }
};

const handleCancel = () => {
  isEditMode.value = false;
  // Reset state to original user data
  if (user.value) {
    bannerPreview.value = user.value.banner || DEFAULT_BANNER;
    fotoPreview.value = user.value.photo || DEFAULT_FOTO;
    formData.value = {
      ...formData.value,
      display_name: user.value.display_name || "",
      email: user.value.email || "",
      phone: user.value.phone || "",
      location: user.value.location || "",
      jabatan: user.value.jabatan || "",
      id_jabatan: (user.value as any).id_jabatan || "",
      role: user.value.role || "user",
      status: getUserStatusText(user.value.status)
    };
  }
};

const toggleEditMode = () => {
  if (isCurrentUser.value) {
    router.push('/profile-settings');
  } else if (isAdmin.value) {
    isEditMode.value = !isEditMode.value;
  }
};

</script>

<template>
  <div class="row">
    <div class="col-xxl-9 col-xl-10 col-lg-12 mx-auto">
      <Pageheader :propData="dataToPass" />

      <!-- HEADER BAR -->
      <div class="card custom-card gradient-header-card mb-4 shadow-sm border-0">
        <div class="card-header d-flex flex-wrap align-items-center justify-content-between gap-3 users-header border-bottom-0 pb-3 pt-3">
          <div class="d-flex align-items-center gap-3">
            <div class="header-icon-box">
              <i class="ri-user-3-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">
                {{ loading ? "User Profile" : (isEditMode ? 'Edit Profile' : displayName) }}
              </div>
              <div class="header-subtitle mt-1">
                {{ isEditMode ? 'Sesuaikan detail data pengguna di bawah ini' : 'Informasi akun & data pribadi pengguna' }}
              </div>
            </div>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <!-- VIEW MODE ACTIONS -->
            <template v-if="!isEditMode">
               <button v-if="isAdmin && !isCurrentUser" @click="toggleEditMode" class="btn btn-warning btn-sm rounded-pill px-3 shadow-sm">
                <i class="ri-edit-2-line me-1"></i>Edit Data User
              </button>
              <router-link v-if="isCurrentUser" to="/profile-settings" class="btn btn-primary-light btn-sm rounded-pill px-3 shadow-sm">
                <i class="ri-edit-line me-1"></i>Sunting Profil
              </router-link>
              <router-link to="/users" class="btn-back-profile shadow-sm">
                <i class="ri-arrow-left-line"></i>
                <span class="d-none d-sm-inline">Kembali</span>
              </router-link>
            </template>
            <!-- EDIT MODE ACTIONS -->
            <template v-else>
               <button @click="handleCancel" :disabled="isSaving" class="btn-edit-action-cancel shadow-sm">
                <i class="ri-close-circle-line"></i>
                <span>Batal</span>
              </button>
              <button @click="saveProfile" :disabled="isSaving" class="btn btn-warning btn-sm rounded-pill px-3 shadow-sm">
                <span v-if="isSaving" class="spinner-border spinner-border-sm"></span>
                <i v-else class="ri-save-3-line"></i>
                <span>Simpan Perubahan</span>
              </button>
            </template>
          </div>
        </div>
      </div>

      <!-- Loading Skeleton -->
      <div v-if="loading" class="skeleton-loading p-4">
        <div v-for="n in 4" :key="n" class="skeleton-row">
          <div class="skel skel-avatar"></div>
          <div class="skel skel-name"></div>
          <div class="skel skel-email"></div>
        </div>
      </div>

      <template v-else-if="user">
        <!-- Hero Card -->
        <div class="card custom-card hero-card-shell mb-4 shadow-sm border-0 rounded-4 overflow-hidden">
          <div
            ref="bannerContainer"
            class="profile-banner"
            :class="{ 'draggable': isEditMode, 'dragging': dragState.type === 'banner' }"
            :style="{ 
              backgroundImage: `url(${bannerPreview})`, 
              backgroundPosition: `${bannerPosition.x}% ${bannerPosition.y}%` 
            }"
            @mousedown="startDrag('banner', $event)"
            @touchstart="startDrag('banner', $event)"
          >
             <!-- Banner Edit UI -->
             <div v-if="isEditMode" class="position-absolute top-0 end-0 p-3" style="z-index: 10;">
                <button @click.stop="bannerInput?.click()" class="btn btn-primary btn-sm rounded-pill shadow-sm">
                   <i class="ri-image-edit-line me-1"></i>Ganti Banner
                </button>
                <input ref="bannerInput" type="file" accept="image/*" class="d-none" @change="handleImageUpload('banner', $event)" />
             </div>
             <!-- Drag Hint -->
             <div v-if="isEditMode" class="drag-hint position-absolute pointer-events-none">
                 <div class="badge bg-dark bg-opacity-50 rounded-pill px-3 py-2">
                    <i class="ri-drag-move-2-line me-1"></i>Seret untuk atur posisi
                 </div>
             </div>
          </div>

          <div class="profile-content-body">
            <div class="profile-foto-profile-container">
              <div
                ref="fotoContainer"
                class="profile-foto-profile-wrap"
                :class="{ 'draggable': isEditMode, 'dragging': dragState.type === 'foto' }"
                @mousedown="startDrag('foto', $event)"
                @touchstart="startDrag('foto', $event)"
              >
                <img 
                   :src="fotoPreview" 
                   alt="Profile Foto" 
                   class="profile-foto-profile-img" 
                   :style="{ objectPosition: `${fotoPosition.x}% ${fotoPosition.y}%` }"
                />
                <!-- Foto Edit UI -->
                <div v-if="isEditMode" class="foto-edit-overlay">
                   <i class="ri-drag-move-2-line text-white fs-20"></i>
                </div>
              </div>
              <button v-if="isEditMode" @click="fotoInput?.click()" class="btn btn-primary btn-icon btn-sm rounded-circle shadow foto-upload-float">
                 <i class="ri-camera-line"></i>
              </button>
              <input ref="fotoInput" type="file" accept="image/*" class="d-none" @change="handleImageUpload('foto', $event)" />
            </div>

            <div class="profile-info-block">
               <!-- Inline Edit for Display Name -->
              <template v-if="isEditMode">
                 <div class="h4-edit-wrapper mb-2">
                    <div class="d-flex align-items-center gap-2 mb-1">
                       <label class="form-label fs-12 text-muted mb-0">Display Name</label>
                       <i class="ri-pencil-line text-primary fs-13"></i>
                    </div>
                    <input v-model="formData.display_name" type="text" class="profile-user-name-input" placeholder="Masukkan nama display" />
                 </div>
              </template>
              <h4 v-else class="profile-user-name mb-1" :class="{ 'clickable-title': isAdmin && !isCurrentUser }" @click="isAdmin && !isCurrentUser && (isEditMode = true)">{{ displayName }}</h4>
              
              <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
                <span :class="['profile-role-badge', `profile-role-badge--${(displayRole || '').toLowerCase()}`]">
                  <i :class="(displayRole || '').toLowerCase() === 'admin' ? 'ri-shield-user-line' : 'ri-user-line'"></i>
                  {{ displayRole }}
                </span>
                <span class="profile-jabatan-badge">
                  <i class="ri-briefcase-line"></i>{{ displayJabatan }}
                </span>
                <span class="profile-perusahaan-badge">
                  <i class="ri-building-line"></i>{{ displayPerusahaan }}
                </span>
                <span class="profile-sektor-badge">
                  <i class="ri-pie-chart-line"></i>{{ displaySubSektor }}
                </span>
              </div>
              <p class="profile-email-text mb-1">
                <i class="ri-mail-line me-1"></i>{{ displayEmail }}
              </p>
              <div class="profile-meta-row">
                <span><i class="ri-phone-line me-1"></i>{{ displayPhone }}</span>
                <span class="contact-bar-sep-inline d-none d-sm-inline"></span>
                <span><i class="ri-map-pin-line me-1"></i>{{ displayLocation }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Informasi Akun -->
        <div class="card custom-card mb-4 shadow-sm border-0 rounded-4">
          <div class="card-header d-flex align-items-center gap-3 bg-white border-bottom py-3 px-4">
            <div class="d-flex align-items-center gap-2">
              <div class="avatar avatar-sm bg-primary-transparent rounded-circle">
                <i class="ri-user-settings-line text-primary fs-18"></i>
              </div>
              <div class="card-title mb-0 fw-bold text-dark fs-15">Informasi Akun</div>
              <div class="text-muted ms-2 fs-13 d-none d-sm-block">- Detail profil pengguna</div>
            </div>
          </div>
          <div class="card-body p-4 p-md-5">
            <div class="row g-4">
              <div v-for="(item, idx) in accountDetails" :key="idx" class="col-xl-6 col-lg-6 col-md-6">
                <!-- FORM GROUP SPLIT -->
                <div class="form-group-split">
                  <div class="form-group-split-label-card">
                    <div class="form-item-icon" :class="item.colorClass" style="width:32px;height:32px">
                      <i :class="item.icon" style="font-size:0.95rem"></i>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                       <label class="form-item-label mb-0 text-uppercase fs-11 fw-bold text-muted">{{ item.label }}</label>
                       <span v-if="item.badge" class="badge-source-info">{{ item.badge }}</span>
                    </div>
                  </div>
                  <div 
                    class="form-group-split-input-card transition-all" 
                    :class="{ 
                      'bg-light': !item.isEditable || !isEditMode, 
                      'form-item-card--readonly': !item.isEditable && isEditMode,
                      'form-item-card--clickable': !isEditMode && item.isEditable 
                    }"
                    @click="!isEditMode && item.isEditable && (isEditMode = true)"
                  >
                    <!-- EDITABLE INPUTS -->
                    <template v-if="isEditMode && item.isEditable">
                       <!-- SELECT FOR ROLE -->
                       <select v-if="item.key === 'role'" v-model="formData.role" class="form-item-input form-item-select border-0 bg-transparent p-0 outline-none w-100">
                          <option v-for="r in rolesData" :key="r.id" :value="r.name">{{ r.name }}</option>
                       </select>
                       <!-- SELECT FOR STATUS -->
                       <select v-else-if="item.key === 'status'" v-model="formData.status" class="form-item-input form-item-select border-0 bg-transparent p-0 outline-none w-100">
                          <option value="Active">Active</option>
                          <option value="Suspend">Suspend</option>
                       </select>
                       <!-- SELECT FOR JABATAN -->
                       <select v-else-if="item.key === 'jabatan'" v-model="formData.id_jabatan" class="form-item-input form-item-select border-0 bg-transparent p-0 outline-none w-100">
                          <option value="">Pilih Jabatan</option>
                          <option v-for="j in jabatanList" :key="j.id" :value="j.id">{{ j.nama_jabatan }}</option>
                       </select>
                       <!-- TEXT INPUTS (Email, Phone, Location) -->
                       <input v-else v-model="formData[item.key]" type="text" class="form-item-input border-0 bg-transparent p-0 outline-none w-100" :placeholder="'Masukkan ' + item.label" />
                       <i class="ri-pencil-line form-item-edit-action text-primary"></i>
                    </template>
                    <!-- VIEW ONLY -->
                    <template v-else>
                        <div class="form-item-value" :class="{ 'wrap-text': item.wrap, 'text-muted': !item.isEditable }">{{ item.value }}</div>
                        <i :class="item.isEditable ? 'ri-pencil-line form-item-edit-action text-primary' : 'ri-lock-line form-item-edit-action text-light-muted'" class="form-item-edit-action"></i>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- Toast Notification -->
  <transition name="toast-slide">
    <div v-if="showToast" class="toast-wrapper position-fixed p-3 top-0 end-0" style="z-index: 9999">
      <div class="toast-modern shadow-lg" :class="toastType === 'success' ? 'toast-success' : 'toast-error'" role="alert">
        <div class="toast-icon-wrap">
          <i :class="toastType === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'"></i>
        </div>
        <div class="toast-content">
          <span class="toast-title">{{ toastType === 'success' ? 'Berhasil' : 'Gagal' }}</span>
          <span class="toast-msg">{{ toastMessage }}</span>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
@import "@/assets/css/style2.css";

.draggable { cursor: grab !important; }
.dragging { cursor: grabbing !important; opacity: 0.8; }
.drag-hint { bottom: 10px; left: 50%; transform: translateX(-50%); pointer-events: none; z-index: 5; }

.foto-edit-overlay { 
  position: absolute; top:0; left:0; right:0; bottom:0; 
  background: rgba(0,0,0,0.3); border-radius: 50%; 
  display: flex; align-items: center; justify-content: center;
}
.foto-upload-float { position: absolute; bottom: 5px; right: 5px; z-index: 10; }
.min-w-200 { min-width: 200px; }

.badge-source-info { 
  font-size: 9px;
  background: #f1f5f9;
  color: #64748b;
  padding: 1px 8px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  text-transform: lowercase;
  font-weight: 500;
}

.text-light-muted { color: #cbd5e1 !important; }

/* REFINED EDIT STYLES */
.h4-edit-wrapper { 
  margin-top: -8px; 
  margin-bottom: 0.5rem;
  width: 100%;
}
.profile-user-name-input { 
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--default-text-color);
  background: transparent !important;
  border: none !important;
  outline: none !important;
  padding: 0 !important;
  width: auto;
  min-width: 200px;
  max-width: 500px;
  line-height: 1.2;
}
.header-edit-indicator { align-self: center; margin-top: 2px; }

.form-item-input {
  border: none !important;
  outline: none !important;
  background: transparent !important;
  padding: 0 !important;
  width: 100%;
  font-size: inherit;
  color: inherit;
  box-shadow: none !important;
  appearance: none !important;
}

.form-item-input:focus, 
.form-item-input:active,
.profile-user-name-input:focus,
.profile-user-name-input:active {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
}

.form-item-input:focus {
  color: var(--primary-color);
}

.profile-user-name-input:focus {
  color: var(--primary-color);
}

.form-item-card--readonly {
  cursor: not-allowed !important;
}

.form-item-card--clickable {
  cursor: pointer !important;
}

.form-item-input {
  cursor: text;
}

.form-item-select {
  cursor: pointer;
}

.clickable-title {
  cursor: pointer;
  transition: color 0.2s ease;
}

.clickable-title:hover {
  color: var(--primary-color);
}


/* Transitions */
.toast-slide-enter-active, .toast-slide-leave-active { transition: transform 0.3s ease, opacity 0.3s ease; }
.toast-slide-enter-from { transform: translateX(100%); opacity: 0; }
.toast-slide-leave-to { opacity: 0; }

.transition-all { transition: all 0.2s ease; }

/* Custom Edit Action Buttons (Matches btn-back-profile sizes) */
.btn-edit-action-cancel {
  background: rgba(255,255,255,0.15);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.25);
  color: #fff;
  padding: 0.5rem 1.25rem;
  border-radius: 50px;
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.25s ease;
  white-space: nowrap;
  line-height: 1.5;
}
.btn-edit-action-cancel:hover {
  background: rgba(255,255,255,0.25);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.15);
  color: #fff;
}

.btn-edit-action-save {
  background: #f59e0b; /* Warmer yellow-orange matching the 'Edit Data User' button aesthetic */
  color: #fff;
  padding: 0.5rem 1.25rem;
  border-radius: 50px;
  border: none;
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.25s ease;
  white-space: nowrap;
  line-height: 1.5;
}
.btn-edit-action-save:hover {
  background: #d97706;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.3);
  color: #fff;
}
</style>

