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
  if (status === null || status === undefined) return 'Aktif';
  const s = String(status).toLowerCase().trim();
  if (['suspend', 'suspended', 'nonaktif', 'inactive', '0', 'false'].includes(s)) return 'Nonaktif';
  return 'Aktif';
};

const loadUser = async () => {
  const slugVal = (route.params.slug || '') as string;
  const isNumericId = /^\d+$/.test(slugVal);
  const isMe = authStore.currentUser?.username === slugVal || authStore.currentUser?.id?.toString() === slugVal || (!slugVal && authStore.currentUser);

  // 1. Optimization: If viewing own profile, load from store immediately
  if (isMe && authStore.currentUser) {
    const u = authStore.currentUser;
    isCurrentUser.value = true;
    
    // Ensure profileStore has data
    if (!profileStore.fotoProfileUrl || profileStore.fotoProfileUrl.includes('/faces/9.jpg')) {
      profileStore.fetchFromApi();
    }

    user.value = {
      id: u.id?.toString() || "",
      slug: u.slug || u.username || "",
      username: u.username || "",
      display_name: u.display_name || "",
      name: u.name || u.username || "Unknown",
      email: u.email || "",
      jabatan: u.jabatan || "",
      role: u.role || "user",
      status: 'Aktif',
      phone: u.phone || "",
      location: u.location || "",
      joined: u.createdAt || "",
      photo: profileStore.fotoProfileUrl || formatImageUrl(u.foto_profile),
      banner: profileStore.bannerUrl || formatImageUrl(u.banner),
      id_jabatan: u.id_jabatan || ""
    } as any;
    
    formData.value = {  
      id: user.value.id, 
      username: user.value.username, 
      display_name: profileStore.display_name || user.value.display_name || u.display_name || "", 
      email: profileStore.email || user.value.email || u.email || "", 
      phone: profileStore.phone || user.value.phone || u.phone || "", 
      location: profileStore.location || user.value.location || u.location || "", 
      jabatan: profileStore.jabatan || user.value.jabatan || u.jabatan || "", 
      id_jabatan: profileStore.idJabatan || (user.value as any).id_jabatan || u.id_jabatan || "", 
      role: user.value.role || u.role || "user", 
      status: 'Aktif', 
      namaPerusahaan: profileStore.namaPerusahaan || "" 
    };
    
    // Set previews and positions from profileStore
    bannerPreview.value = profileStore.bannerUrl || formatImageUrl(u.banner) || DEFAULT_BANNER;
    fotoPreview.value = profileStore.fotoProfileUrl || formatImageUrl(u.foto_profile) || DEFAULT_FOTO;
    bannerPosition.value = { x: profileStore.bannerPositionX, y: profileStore.bannerPositionY }; 
    fotoPosition.value = { x: profileStore.fotoProfilePositionX, y: profileStore.fotoProfilePositionY };

    loading.value = false;
    
    // Background refresh for roles/jabatan/company
    Promise.allSettled([roleService.getAll(), jabatanService.getAll()])
      .then(([r, j]) => {
        if (r.status === 'fulfilled') rolesData.value = r.value as any;
        if (j.status === 'fulfilled') jabatanList.value = j.value as any;
      });
      
    if (u.id_perusahaan || profileStore.idPerusahaan) {
      stakeholdersService.getById((u.id_perusahaan || profileStore.idPerusahaan).toString()).then(c => {
        const data = (c as any)?.data ?? c;
        userCompanyName.value = data.nama_perusahaan || '';
        userSubSektor.value = data.sub_sektor?.nama_sub_sektor || '';
      }).catch(() => {});
    }
    return;
  }

  // 2. Fetching other users
  loading.value = true;
  try {
    const [rolesRes, jabatansRes, usersRes] = await Promise.allSettled([
      roleService.getAll(),
      jabatanService.getAll(),
      isNumericId ? usersService.getById(slugVal) : usersService.getAll()
    ]);

    rolesData.value = rolesRes.status === 'fulfilled' ? (rolesRes.value as any) : [];
    jabatanList.value = jabatansRes.status === 'fulfilled' ? (jabatansRes.value as any) : [];

    let foundUser: any = null;
    if (usersRes.status === 'fulfilled') {
      const data = usersRes.value as any;
      if (isNumericId) {
        foundUser = data.data || data;
      } else {
        const usersList = data.data || data;
        foundUser = Array.isArray(usersList) ? usersList.find((u: any) => (u.slug || u.username) === slugVal || u.username === slugVal) : null;
      }
    }

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
        status: String(foundUser.status || foundUser.status_akun || '1'),
        phone: foundUser.phone || "",
        location: foundUser.location || "",
        joined: foundUser.joined || foundUser.created_at || "",
        photo: formatImageUrl(foundUser.photo || foundUser.foto_profile),
        banner: formatImageUrl(foundUser.banner),
        id_jabatan: foundUser.id_jabatan || ""
      } as any;

      formData.value = { id: user.value.id, username: user.value.username, display_name: user.value.display_name, email: user.value.email, phone: user.value.phone, location: user.value.location, jabatan: user.value.jabatan, id_jabatan: (user.value as any).id_jabatan, role: user.value.role, status: getUserStatusText(user.value.status), namaPerusahaan: "" };
      bannerPreview.value = user.value.banner || DEFAULT_BANNER;
      fotoPreview.value = user.value.photo || DEFAULT_FOTO;
      
      bannerPosition.value = { 
        x: Number(foundUser.banner_position_x ?? 50), 
        y: Number(foundUser.banner_position_y ?? 50) 
      };
      fotoPosition.value = { 
        x: Number(foundUser.foto_profile_position_x ?? 50), 
        y: Number(foundUser.foto_profile_position_y ?? 50) 
      };

      if (foundUser.id_perusahaan) {
        stakeholdersService.getById(foundUser.id_perusahaan.toString()).then(c => {
          const data = (c as any)?.data ?? c;
          userCompanyName.value = data.nama_perusahaan || '';
          userSubSektor.value = data.sub_sektor?.nama_sub_sektor || '';
        }).catch(() => {});
      }
    } else {
      router.push("/users");
    }
  } catch (error) {
    router.push("/users");
  } finally {
    loading.value = false;
  }
};

watch(slug, loadUser);
onMounted(loadUser);

// Sync from profile store if it updates (e.g. after background fetch)
watch(() => profileStore.fotoProfileUrl, (newVal) => {
  if (isCurrentUser.value && !isEditMode.value && newVal) {
    fotoPreview.value = newVal;
  }
});
watch(() => profileStore.bannerUrl, (newVal) => {
  if (isCurrentUser.value && !isEditMode.value && newVal) {
    bannerPreview.value = newVal;
  }
});
watch(() => [profileStore.bannerPositionX, profileStore.bannerPositionY], ([x, y]) => {
  if (isCurrentUser.value && !isEditMode.value) {
    bannerPosition.value = { x: Number(x), y: Number(y) };
  }
});
watch(() => [profileStore.fotoProfilePositionX, profileStore.fotoProfilePositionY], ([x, y]) => {
  if (isCurrentUser.value && !isEditMode.value) {
    fotoPosition.value = { x: Number(x), y: Number(y) };
  }
});

// Sync text fields from profile store
watch(() => profileStore.display_name, (newVal) => {
  if (isCurrentUser.value && !isEditMode.value && newVal) {
    formData.value.display_name = newVal;
    if (user.value) user.value.display_name = newVal;
  }
});
watch(() => profileStore.email, (newVal) => {
  if (isCurrentUser.value && !isEditMode.value && newVal) {
    formData.value.email = newVal;
    if (user.value) user.value.email = newVal;
  }
});
watch(() => profileStore.jabatan, (newVal) => {
  if (isCurrentUser.value && !isEditMode.value && newVal) {
    formData.value.jabatan = newVal;
    if (user.value) user.value.jabatan = newVal;
  }
});
watch(() => profileStore.idJabatan, (newVal) => {
  if (isCurrentUser.value && !isEditMode.value && newVal) {
    formData.value.id_jabatan = newVal;
    if (user.value) (user.value as any).id_jabatan = newVal;
  }
});

const displayName = computed(() => {
  if (isCurrentUser.value) {
    return profileStore.display_name || profileStore.name || authStore.currentUser?.username || 'User';
  }
  return user.value?.display_name || user.value?.name || user.value?.username || "User";
});
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
  isCurrentUser.value ? 'Aktif' : getUserStatusText(user.value?.status)
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
  { key: 'status',   icon: "ri-toggle-line",      label: "Status Akun",     value: displayStatus.value,      colorClass: displayStatus.value === 'Aktif' ? 'stat-icon-teal' : 'stat-icon-red', isEditable: true, type: 'select' },
  { key: 'joined',   icon: "ri-calendar-line",    label: "Bergabung Sejak", value: displayJoined.value,      colorClass: "stat-icon-teal",   isEditable: false },
]);

const showToast = ref(false);
const toastMessage = ref("");
const toastType = ref<"success" | "error">("success");

const showNotification = (msg: string, type: "success" | "error" = "success") => {
  toastMessage.value = msg;
  toastType.value = type;
  showToast.value = true;
  setTimeout(() => { showToast.value = false; }, 3000);
};

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

const dataURLtoBlob = (dataurl: string) => {
  const arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], {type: mime});
};

const saveProfile = async () => {
  if (!user.value) return;
  isSaving.value = true;
  try {
    const isAktif = formData.value.status === 'Aktif';
    const rawPayload: any = {
      username:     (user.value.username || '').toString(),
      name:         (formData.value.display_name || user.value?.name || user.value?.username || '').toString(), 
      email:        (formData.value.email || '').toString(),
      telepon:      (formData.value.phone || '').toString(),
      phone:        (formData.value.phone || '').toString(),
      alamat:       (formData.value.location || '').toString(),
      location:     (formData.value.location || '').toString(),
      id_jabatan:   formData.value.id_jabatan || null,
      status:       isAktif ? "Aktif" : "Nonaktif", 
      is_active:    isAktif ? 1 : 0,
      is_suspended: isAktif ? 0 : 1,
      aktif:        isAktif ? 1 : 0,
      status_akun:  isAktif ? "1" : "0",
      banner_position_x: bannerPosition.value.x,
      banner_position_y: bannerPosition.value.y,
      foto_profile_position_x: fotoPosition.value.x,
      foto_profile_position_y: fotoPosition.value.y,
    };

    // Only add display_name if it's not empty to avoid 400 error from backend
    if (formData.value.display_name && formData.value.display_name.trim() !== "") {
      rawPayload.display_name = formData.value.display_name.toString();
    }

    const roleObj = rolesData.value.find(r => r.name.toLowerCase() === formData.value.role.toLowerCase());
    if (roleObj) rawPayload.role_id = roleObj.id;

    const metadataPayload = { ...rawPayload };
    await (isCurrentUser.value ? usersService.updateMe(metadataPayload) : usersService.update(user.value.id, metadataPayload));

    if (!isCurrentUser.value && isAdmin.value) {
      try {
        const statusVal = isAktif ? "Aktif" : "Suspend";
        await usersService.updateStatus(user.value.id, { id: user.value.id, status: statusVal, status_akun: statusVal, aktif: isAktif ? 1 : 0, is_active: isAktif ? 1 : 0 });
      } catch (statusErr) { console.warn("⚠️ Dedicated status endpoint failed:", statusErr); }
    }

    if (fotoPreview.value.startsWith('data:')) {
      const photoData = new FormData();
      photoData.append('profile_photo', dataURLtoBlob(fotoPreview.value), 'foto_profile.jpg');
      isCurrentUser.value ? await usersService.updateMePhoto(photoData) : await usersService.updateProfilePhoto(user.value!.id, photoData);
    }

    if (bannerPreview.value.startsWith('data:')) {
      const bannerData = new FormData();
      bannerData.append('banner', dataURLtoBlob(bannerPreview.value), 'banner.jpg');
      isCurrentUser.value ? await usersService.updateMeBanner(bannerData) : await usersService.updateBanner(user.value!.id, bannerData);
    }

    showNotification("Profil berhasil diperbarui", "success");
    isEditMode.value = false;
    await loadUser(); 
  } catch (error: any) {
    showNotification(error.message || "Gagal menyimpan perubahan", "error");
  } finally {
    isSaving.value = false;
  }
};

const handleCancel = () => {
  isEditMode.value = false;
  if (user.value) {
    bannerPreview.value = user.value.banner || DEFAULT_BANNER;
    fotoPreview.value = user.value.photo || DEFAULT_FOTO;
    formData.value = { ...formData.value, display_name: user.value.display_name || "", email: user.value.email || "", phone: user.value.phone || "", location: user.value.location || "", jabatan: user.value.jabatan || "", id_jabatan: (user.value as any).id_jabatan || "", role: user.value.role || "user", status: getUserStatusText(user.value.status) };
  }
};

const getRoleBadgeClass = (role: string) => {
  const r = String(role || '').toLowerCase();
  if (r === 'admin') return 'p-badge--role-red';
  if (r === 'staff') return 'p-badge--role-green';
  if (r === 'user_pic' || r === 'pic') return 'p-badge--role-orange';
  return 'p-badge--role-sky';
};
</script>

<template>
  <div class="row">
    <div class="col-xl-12">
      <!-- Ultra-Premium Detailed Skeleton -->
      <div v-if="loading" class="skeleton-wrapper mb-5">
        <!-- Hero Card Skeleton -->
        <div class="skel-card skel-hero mb-4">
          <div class="skel-banner-main">
            <div class="skel-overlay-p">
              <div class="d-flex justify-content-between align-items-start w-100 p-4">
                <div class="skel-text-block">
                  <div class="skel-breadcrumb-h"></div>
                  <div class="skel-h-title"></div>
                  <div class="skel-h-sub"></div>
                </div>
                <div class="skel-actions-h d-flex gap-2">
                  <div class="skel-btn-round"></div>
                  <div class="skel-btn-round"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="skel-profile-body p-4 pt-0">
            <div class="d-flex gap-4 align-items-start">
              <div class="skel-avatar-wrap"></div>
              <div class="skel-info-block-main pt-4 flex-grow-1">
                <div class="skel-tag-h mb-3"></div>
                <div class="skel-name-h mb-2"></div>
                <div class="skel-badge-row d-flex gap-2 mb-3">
                  <div class="skel-chip-h"></div>
                  <div class="skel-chip-h"></div>
                  <div class="skel-chip-h"></div>
                </div>
                <div class="skel-meta-row-h d-flex gap-3">
                  <div class="skel-meta-item"></div>
                  <div class="skel-meta-item"></div>
                  <div class="skel-meta-item"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Account Info Card Skeleton -->
        <div class="skel-card skel-info">
          <div class="skel-card-header p-4 d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-2">
              <div class="skel-icon-box"></div>
              <div class="skel-line-h w-150"></div>
            </div>
            <div class="skel-btn-h w-80"></div>
          </div>
          <div class="skel-card-body p-4">
            <div class="row g-3">
              <div v-for="n in 6" :key="n" class="col-md-6">
                <div class="skel-field-box"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template v-else-if="user">
        <div class="card custom-card hero-card-shell mb-4 border-0 rounded-4 overflow-hidden stakeholder-profile-shell">
          <div
            ref="bannerContainer"
            class="profile-banner"
            :style="{ backgroundImage: `url(${bannerPreview})`, backgroundPosition: `${bannerPosition.x}% ${bannerPosition.y}%` }"
          >
              <div class="profile-banner-overlay-premium">
                <div class="profile-banner-top">
                  <div class="hero-text-block">
                    <div class="premium-breadcrumb mb-1">
                      <span class="breadcrumb-item">USERS</span>
                      <span class="breadcrumb-sep"><i class="ri-arrow-right-s-line"></i></span>
                      <span class="breadcrumb-item active">PROFILE</span>
                    </div>
                    <h2 class="hero-main-title">
                      {{ isEditMode ? 'Edit Profile' : 'User Profile' }}
                    </h2>
                    <p class="hero-sub-title mb-0">
                      {{ isEditMode ? 'Sesuaikan detail data pengguna di bawah ini' : 'Informasi akun dan data pribadi pengguna' }}
                    </p>
                  </div>

                  <div class="hero-action-tools">
                    <div class="d-flex gap-2 flex-wrap justify-content-end align-items-center">
                      <template v-if="!isEditMode">
                        <button v-if="isAdmin && !isCurrentUser" @click="toggleEditMode" class="btn-premium btn-premium--warning shadow-sm">
                          <i class="ri-edit-2-fill me-1"></i>Edit Profile
                        </button>
                        <button v-if="isCurrentUser" @click="toggleEditMode" class="btn-premium btn-premium--glass shadow-sm">
                          <i class="ri-pencil-fill me-1"></i>Sunting Profil
                        </button>
                        <router-link to="/users" class="btn-premium btn-premium--glass shadow-sm">
                          <i class="ri-arrow-left-line me-1"></i>
                          <span>Kembali</span>
                        </router-link>
                      </template>
                      <template v-else>
                        <button @click="handleCancel" :disabled="isSaving" class="btn-premium btn-premium--glass-danger shadow-sm">
                          <i class="ri-close-circle-fill me-1"></i>
                          <span>Batal</span>
                        </button>
                        <button @click="saveProfile" :disabled="isSaving" class="btn-premium btn-premium--warning shadow-sm">
                          <span v-if="isSaving" class="spinner-border spinner-border-sm me-1"></span>
                          <i v-else class="ri-save-3-fill me-1"></i>
                          <span>Simpan Perubahan</span>
                        </button>
                      </template>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="isEditMode" class="position-absolute bottom-0 end-0 p-3" style="z-index: 10;">
                 <button @click.stop="bannerInput?.click()" class="btn btn-primary btn-sm rounded-pill shadow-sm"><i class="ri-image-edit-line me-1"></i>Ganti Banner</button>
                 <input ref="bannerInput" type="file" accept="image/*" class="d-none" @change="handleImageUpload('banner', $event)" />
              </div>
          </div>

          <div class="profile-content-body profile-content-body--premium">
            <div class="profile-foto-profile-container">
              <div
                ref="fotoContainer"
                class="profile-foto-profile-wrap"
              >
                <img :src="fotoPreview" alt="Profile Foto" class="profile-foto-profile-img" :style="{ objectPosition: `${fotoPosition.x}% ${fotoPosition.y}%` }"/>
              </div>
              <button v-if="isEditMode" @click="fotoInput?.click()" class="btn-upload-camera shadow-lg">
                <i class="ri-camera-fill"></i>
              </button>
              <input ref="fotoInput" type="file" accept="image/*" class="d-none" @change="handleImageUpload('foto', $event)" />
            </div>

            <div class="profile-info-block">
              <template v-if="isEditMode">
                 <div class="h4-edit-wrapper"><input v-model="formData.display_name" type="text" class="profile-user-name-input" placeholder="Masukkan nama display" /></div>
              </template>
              <h4 v-else class="profile-user-name mb-2" :class="{ 'clickable-title': isAdmin && !isCurrentUser }" @click="isAdmin && !isCurrentUser && (isEditMode = true)">{{ displayName }}</h4>
              
              <div class="profile-badges-row mb-3">
                <span :class="['p-badge p-badge--role', getRoleBadgeClass(displayRole)]">
                  <i :class="(displayRole || '').toLowerCase() === 'admin' ? 'ri-shield-flash-line' : ((displayRole || '').toLowerCase() === 'staff' ? 'ri-shield-user-line' : 'ri-user-6-line')"></i>
                  {{ displayRole }}
                </span>
                <span class="p-badge p-badge--jabatan"><i class="ri-medal-line"></i>{{ displayJabatan }}</span>
                <span class="p-badge p-badge--company"><i class="ri-community-line"></i>{{ displayPerusahaan }}</span>
                <span class="p-badge p-badge--sector"><i class="ri-microscope-line"></i>{{ displaySubSektor }}</span>
              </div>

              <div class="profile-contact-grid">
                <div class="contact-item">
                  <div class="contact-icon contact-icon--email"><i class="ri-mail-send-line"></i></div>
                  <div class="contact-content">
                    <span class="contact-label">Email Address</span>
                    <span class="contact-value">{{ displayEmail }}</span>
                  </div>
                </div>
                <div class="contact-item">
                  <div class="contact-icon contact-icon--phone"><i class="ri-phone-camera-line"></i></div>
                  <div class="contact-content">
                    <span class="contact-label">Phone Number</span>
                    <span class="contact-value">{{ displayPhone }}</span>
                  </div>
                </div>
                <div class="contact-item">
                  <div class="contact-icon contact-icon--location"><i class="ri-map-pin-user-line"></i></div>
                  <div class="contact-content">
                    <span class="contact-label">Location</span>
                    <span class="contact-value">{{ displayLocation }}</span>
                  </div>
                </div>
                <div class="contact-item">
                  <div class="contact-icon contact-icon--joined"><i class="ri-calendar-check-line"></i></div>
                  <div class="contact-content">
                    <span class="contact-label">Joined Since</span>
                    <span class="contact-value">{{ displayJoined }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card custom-card mb-4 border-0 rounded-4 stakeholders-shell-card overflow-hidden">
          <div class="card-header border-bottom py-3 px-4 bg-transparent d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-2">
              <div class="header-icon-wrap text-primary fs-18"><i class="ri-user-settings-line"></i></div>
              <h5 class="card-title mb-0 fw-bold fs-15">Informasi Akun <span class="text-muted fs-12 fw-normal ms-2">- Detail profil pengguna</span></h5>
            </div>
            <div class="badge bg-light text-muted rounded-pill px-3 py-2 fs-11 fw-semibold border">{{ accountDetails.length }} Attributes</div>
          </div>
          <div class="card-body p-4 pt-3">
            <div class="row g-3">
              <div v-for="(item, idx) in accountDetails" :key="idx" class="col-xl-6 col-lg-6 col-md-6">
                <div class="form-group-split">
                  <div class="form-group-split-label-card">
                    <div class="form-item-icon" :class="item.colorClass" style="width:28px;height:28px"><i :class="item.icon" style="font-size:0.85rem"></i></div>
                    <div class="d-flex align-items-center gap-2"><label class="form-item-label mb-0 text-uppercase fs-10 fw-bold text-muted">{{ item.label }}</label><span v-if="item.badge" class="badge-source-info">{{ item.badge }}</span></div>
                  </div>
                  <div class="form-group-split-input-card transition-all" :class="{ 'bg-light': !item.isEditable || !isEditMode, 'form-item-card--readonly': !item.isEditable && isEditMode, 'form-item-card--clickable': !isEditMode && item.isEditable }" @click="!isEditMode && item.isEditable && (isEditMode = true)">
                    <template v-if="isEditMode && item.isEditable">
                       <select v-if="item.key === 'role'" v-model="formData.role" class="form-item-input border-0 bg-transparent p-0 outline-none w-100"><option v-for="r in rolesData" :key="r.id" :value="r.name">{{ r.name }}</option></select>
                       <select v-else-if="item.key === 'status'" v-model="formData.status" class="form-item-input border-0 bg-transparent p-0 outline-none w-100"><option value="Aktif">Aktif</option><option value="Nonaktif">Nonaktif</option></select>
                       <select v-else-if="item.key === 'jabatan'" v-model="formData.id_jabatan" class="form-item-input border-0 bg-transparent p-0 outline-none w-100"><option value="">Pilih Jabatan</option><option v-for="j in jabatanList" :key="j.id" :value="j.id">{{ j.nama_jabatan }}</option></select>
                       <input v-else v-model="formData[item.key]" type="text" class="form-item-input border-0 bg-transparent p-0 outline-none w-100" :placeholder="'Masukkan ' + item.label" />
                    </template>
                    <template v-else><div class="form-item-value" :class="{ 'wrap-text': item.wrap, 'text-muted': !item.isEditable }">{{ item.value }}</div><i :class="item.isEditable ? 'ri-pencil-line form-item-edit-action text-primary' : 'ri-lock-line form-item-edit-action text-light-muted'" class="form-item-edit-action"></i></template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>

  <transition name="toast-slide">
    <div v-if="showToast" class="toast-wrapper position-fixed p-3 top-0 end-0" style="z-index: 9999">
      <div class="toast-modern shadow-lg" :class="toastType === 'success' ? 'toast-success' : 'toast-error'" role="alert">
        <div class="toast-icon-wrap"><i :class="toastType === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'"></i></div>
        <div class="toast-content"><span class="toast-title">{{ toastType === 'success' ? 'Berhasil' : 'Gagal' }}</span><span class="toast-msg">{{ toastMessage }}</span></div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
@import "@/assets/css/style2.css";

:root {
  --profile-accent: #2f6fed;
  --profile-accent-dark: #102a73;
  --profile-card-border: #dbe7ff;
  --profile-soft-bg: linear-gradient(180deg, #f8fbff 0%, #f4f7fc 100%);
}

.stakeholders-shell-card, .stakeholder-profile-shell {
  box-shadow: 0 15px 40px rgba(15, 23, 42, 0.08) !important;
  border: 1px solid rgba(212, 224, 255, 0.6) !important;
}

.premium-breadcrumb { display: flex; align-items: center; gap: 0.5rem; margin-top: -0.5rem; }
.breadcrumb-item { font-size: 11px; font-weight: 800; color: rgba(255, 255, 255, 0.65); text-transform: uppercase; letter-spacing: 0.12em; }
.breadcrumb-item.active { color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.breadcrumb-sep { color: rgba(255, 255, 255, 0.4); font-size: 14px; }

.profile-banner {
  position: relative;
  min-height: 220px;
  overflow: hidden;
  background-size: cover;
  background-position: center;
}

.profile-banner::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.1) 0%, rgba(15, 23, 42, 0.7) 100%);
  z-index: 1;
}

.profile-banner-overlay-premium {
  position: relative;
  z-index: 2;
  padding: 1.75rem 2.25rem;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.hero-main-title { font-size: 2.25rem; font-weight: 900; letter-spacing: -0.04em; margin-bottom: 0.25rem; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3); color: #fff; }
.hero-sub-title { font-size: 0.95rem; font-weight: 500; max-width: 500px; color: rgba(255, 255, 255, 0.8); }

.btn-premium { display: inline-flex; align-items: center; justify-content: center; padding: 0.6rem 1.25rem; border-radius: 999px; font-size: 12px; font-weight: 800; transition: all 0.3s ease; border: 1px solid transparent; gap: 0.5rem; }
.btn-premium--warning { background: #f59e0b; color: #fff; border-color: #d97706; }
.btn-premium--warning:hover { background: #d97706; transform: translateY(-2px); }
.btn-premium--glass { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-color: rgba(255, 255, 255, 0.2); color: #fff; }
.btn-premium--glass:hover { background: rgba(255, 255, 255, 0.2); transform: translateY(-2px); }
.btn-premium--glass-danger { background: rgba(239, 68, 68, 0.15); backdrop-filter: blur(10px); border-color: rgba(239, 68, 68, 0.3); color: #fff; }

.profile-banner-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; width: 100%; }

.profile-content-body--premium { position: relative; background: #fff; padding: 0 2rem 2rem; }

.profile-foto-profile-container { position: relative; z-index: 5; flex: 0 0 160px; margin-top: -80px; display: flex; justify-content: center; }
.profile-foto-profile-wrap { width: 160px; height: 160px; border-radius: 50%; overflow: hidden; box-shadow: 0 15px 40px rgba(15, 23, 42, 0.15), 0 0 0 8px #fff; background: #fff; }
.profile-foto-profile-img { width: 100%; height: 100%; object-fit: cover; }

.profile-info-block { flex: 1 1 auto; min-width: 0; padding-top: 1.75rem; padding-left: 1rem; }
.profile-content-body { display: flex; align-items: flex-start; gap: 2rem; }

.profile-identity-topline { display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; padding: 0.4rem 1rem; border-radius: 999px; background: #eff6ff; color: #3b82f6; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #dbeafe; }
.profile-user-name { font-size: 2.5rem; font-weight: 900; color: #0f172a; letter-spacing: -0.04em; }

.profile-badges-row { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
.p-badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 12px; font-size: 12px; font-weight: 700; transition: all 0.2s ease; border: 1px solid transparent; }
.p-badge i { font-size: 14px; opacity: 0.8; }

.p-badge--role-red { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }
.p-badge--role-green { background: #dcfce7; color: #14532d; border-color: #86efac; }
.p-badge--role-orange { background: #ffedd5; color: #c2410c; border-color: #fdba74; }
.p-badge--role-sky { background: #e0f2fe; color: #075985; border-color: #7dd3fc; }

[data-theme-mode='dark'] .p-badge--role-red { color: #f87171 !important; background: rgba(248, 113, 113, 0.1) !important; border-color: rgba(248, 113, 113, 0.2) !important; }
[data-theme-mode='dark'] .p-badge--role-green { color: #4ade80 !important; background: rgba(74, 222, 128, 0.1) !important; border-color: rgba(74, 222, 128, 0.2) !important; }
[data-theme-mode='dark'] .p-badge--role-orange { color: #fb923c !important; background: rgba(251, 146, 60, 0.1) !important; border-color: rgba(251, 146, 60, 0.2) !important; }
[data-theme-mode='dark'] .p-badge--role-sky { color: #38bdf8 !important; background: rgba(56, 189, 248, 0.1) !important; border-color: rgba(56, 189, 248, 0.2) !important; }
.p-badge--jabatan { background: #f5f3ff; color: #7c3aed; border-color: #ddd6fe; }
.p-badge--company { background: #fff7ed; color: #ea580c; border-color: #ffedd5; }
.p-badge--sector { background: #f0f9ff; color: #0284c7; border-color: #e0f2fe; }

.p-badge:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); }

.profile-contact-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.25rem; margin-top: 1.5rem; }
.contact-item { display: flex; align-items: center; gap: 1rem; padding: 1rem; border-radius: 16px; background: #f8fafc; border: 1px solid #f1f5f9; transition: all 0.3s ease; }
.contact-item:hover { background: #fff; border-color: #e2e8f0; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.04); transform: translateY(-2px); }

.contact-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.contact-icon--email { background: #e0e7ff; color: #4338ca; }
.contact-icon--phone { background: #ede9fe; color: #6d28d9; }
.contact-icon--location { background: #ffedd5; color: #c2410c; }
.contact-icon--joined { background: #dcfce7; color: #15803d; }

.contact-content { display: flex; flex-direction: column; min-width: 0; }
.contact-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; }
.contact-value { font-size: 14px; font-weight: 700; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.form-item-edit-action { font-size: 16px; opacity: 0.4; }

.foto-upload-float { position: absolute; bottom: 8px; right: 8px; width: 36px; height: 36px; }

.btn-upload-camera {
  position: absolute;
  bottom: 5px;
  right: 5px;
  width: 38px;
  height: 38px;
  background: #104ab0;
  border: 2px solid #fff;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 1.15rem;
  transition: all 0.2s ease;
  cursor: pointer;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-upload-camera:hover {
  background: #0d3a8a;
  transform: scale(1.05);
}

.profile-user-name-input {
  font-size: 2.25rem;
  font-weight: 800;
  color: #0f172a;
  background: transparent !important;
  border: none !important;
  border-bottom: 2px solid transparent !important;
  border-radius: 0 !important;
  padding: 0 0 4px 0 !important;
  width: 100%;
  max-width: 600px;
  transition: all 0.3s ease;
  outline: none !important;
}

.profile-user-name-input:focus {
  border-bottom-style: solid !important;
  border-bottom-color: #2563eb !important;
  color: #2563eb;
}

.profile-user-name-input::placeholder {
  color: #cbd5e1;
  font-weight: 600;
}

.transition-all { transition: all 0.2s ease; }

/* ULTRA-PREMIUM SKELETON STYLES */
.skel-card {
  background: #fff;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 15px 40px rgba(15, 23, 42, 0.05);
  border: 1px solid #f1f5f9;
}

.skel-shimmer {
  background: linear-gradient(90deg, #f1f5f9 25%, #f8fafc 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: skel-shimmer-anim 1.5s infinite;
}

.skel-banner-main {
  height: 220px;
  background: #f1f5f9;
  position: relative;
}

.skel-overlay-p {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.1) 100%);
}

.skel-breadcrumb-h { width: 80px; height: 10px; background: rgba(0,0,0,0.1); border-radius: 4px; margin-bottom: 12px; }
.skel-h-title { width: 250px; height: 32px; background: rgba(0,0,0,0.1); border-radius: 8px; margin-bottom: 10px; }
.skel-h-sub { width: 400px; height: 14px; background: rgba(0,0,0,0.08); border-radius: 4px; }
.skel-btn-round { width: 100px; height: 36px; background: rgba(255,255,255,0.2); border-radius: 20px; }

.skel-avatar-wrap {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: #f1f5f9;
  border: 8px solid #fff;
  margin-top: -80px;
  position: relative;
  z-index: 10;
  flex-shrink: 0;
}

.skel-tag-h { width: 120px; height: 20px; background: #f1f5f9; border-radius: 20px; }
.skel-name-h { width: 300px; height: 36px; background: #f1f5f9; border-radius: 8px; }
.skel-chip-h { width: 80px; height: 24px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; }
.skel-meta-item { width: 140px; height: 14px; background: #f1f5f9; border-radius: 4px; }

.skel-icon-box { width: 36px; height: 36px; background: #f1f5f9; border-radius: 10px; }
.skel-line-h { height: 16px; background: #f1f5f9; border-radius: 4px; }
.skel-btn-h { height: 24px; background: #f1f5f9; border-radius: 12px; }
.skel-field-box { height: 100px; background: #fcfdfe; border: 1px solid #f1f5f9; border-radius: 16px; }

.w-150 { width: 150px; }
.w-80 { width: 80px; }

@keyframes skel-shimmer-anim {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Apply shimmer to placeholders */
.skel-banner-main, .skel-breadcrumb-h, .skel-h-title, .skel-h-sub, 
.skel-btn-round, .skel-avatar-wrap, .skel-tag-h, .skel-name-h, 
.skel-chip-h, .skel-meta-item, .skel-icon-box, .skel-line-h, 
.skel-btn-h, .skel-field-box {
  @extend .skel-shimmer;
}

/* Fallback if extend is not available in scoped style or env */
.skel-banner-main, .skel-breadcrumb-h, .skel-h-title, .skel-h-sub, 
.skel-btn-round, .skel-avatar-wrap, .skel-tag-h, .skel-name-h, 
.skel-chip-h, .skel-meta-item, .skel-icon-box, .skel-line-h, 
.skel-btn-h, .skel-field-box {
  background: linear-gradient(90deg, #f1f5f9 25%, #f8fafc 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: skel-shimmer-anim 1.5s infinite;
}

@media (max-width: 768px) {
  .profile-banner { min-height: 200px; }
  .profile-banner-overlay-premium { padding: 1.5rem 1.5rem; }
  .profile-content-body--premium { padding: 0 1.5rem 2rem; }
  .profile-foto-profile-container { margin-top: -60px; flex: 0 0 140px; }
  .profile-foto-profile-wrap { width: 140px; height: 140px; }
  .profile-content-body { flex-direction: column; gap: 1rem; }
  .profile-info-block { padding-top: 0.5rem; padding-left: 0; }
  .profile-user-name { font-size: 1.75rem; }
}
</style>
