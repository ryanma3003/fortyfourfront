<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
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
const isUserProfileDarkMode = ref(false);
const userCompanyName = ref('');
const userSubSektor = ref('');
const rolesData = ref<Role[]>([]);
const jabatanList = ref<Jabatan[]>([]);
let userProfileThemeObserver: MutationObserver | null = null;

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
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  const datePart = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date).replace(":", ".");

  return `${datePart}, ${timePart} WIB`;
};

const toTitleCase = (value: string) =>
  value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatRoleLabel = (role: string | undefined): string => {
  const normalized = String(role || "").trim();
  if (!normalized) return "Belum diatur";
  if (normalized.toLowerCase() === "user_pic") return "User PIC";
  return toTitleCase(normalized);
};

const getUserStatusText = (status?: any) => {
  if (status === null || status === undefined) return 'Aktif';
  const s = String(status).toLowerCase().trim();
  if (['suspend', 'suspended', 'nonaktif', 'inactive', '0', 'false'].includes(s)) return 'Nonaktif';
  return 'Aktif';
};

const syncUserProfileTheme = () => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const body = document.body;
  isUserProfileDarkMode.value =
    root.getAttribute("data-theme-mode") === "dark" ||
    body?.getAttribute("data-theme-mode") === "dark" ||
    root.classList.contains("dark") ||
    body?.classList.contains("dark");
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
onMounted(() => {
  syncUserProfileTheme();
  userProfileThemeObserver = new MutationObserver(syncUserProfileTheme);
  userProfileThemeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme-mode", "class"],
  });
  if (document.body) {
    userProfileThemeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-theme-mode", "class"],
    });
  }

  loadUser();
});

onUnmounted(() => {
  userProfileThemeObserver?.disconnect();
});

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
const displayRoleLabel = computed(() => formatRoleLabel(displayRole.value));
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
  formatJoinedDate(isCurrentUser.value ? (profileStore.joined || authStore.currentUser?.createdAt) : user.value?.joined)
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
  { key: 'phone',    icon: "ri-phone-line",       label: "Telepon",         value: displayPhone.value,       colorClass: "stat-icon-violet", isEditable: false, type: 'text', badge: 'Sinkron stakeholder' },
  { key: 'jabatan',  icon: "ri-briefcase-line",   label: "Jabatan",         value: displayJabatan.value,     colorClass: "stat-icon-blue",   isEditable: true, type: 'select' },
  { key: 'company',  icon: "ri-building-line",    label: "Perusahaan",      value: displayPerusahaan.value,  colorClass: "stat-icon-amber",  isEditable: false, wrap: true, badge: 'Data registrasi' },
  { key: 'location', icon: "ri-map-pin-line",     label: "Lokasi",          value: displayLocation.value,    colorClass: "stat-icon-amber",  isEditable: false, type: 'text', wrap: true, badge: 'Sinkron stakeholder' },
  { key: 'sector',   icon: "ri-pie-chart-line",   label: "Sektor",          value: displaySubSektor.value,   colorClass: "stat-icon-blue",   isEditable: false, wrap: true, badge: 'Sinkron stakeholder' },
  { key: 'role',     icon: "ri-shield-user-line", label: "Role",            value: displayRoleLabel.value,   colorClass: "stat-icon-red",    isEditable: true, type: 'select' },
  { key: 'status',   icon: "ri-toggle-line",      label: "Status Akun",     value: displayStatus.value,      colorClass: displayStatus.value === 'Aktif' ? 'stat-icon-teal' : 'stat-icon-red', isEditable: true, type: 'select' },
  { key: 'joined',   icon: "ri-calendar-line",    label: "Bergabung Sejak", value: displayJoined.value,      colorClass: "stat-icon-teal",   isEditable: false },
]);

const getFieldActionTooltip = (item: { label: string; isEditable: boolean; badge?: string }) =>
  item.isEditable
    ? `Edit ${item.label.toLowerCase()}`
    : item.badge?.toLowerCase().includes("stakeholder")
      ? "Dikelola dari data stakeholder"
      : item.badge?.toLowerCase().includes("registrasi")
        ? "Dikelola dari data registrasi"
        : "Tidak dapat diedit";

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

const syncFormWithDisplayData = () => {
  if (!user.value) return;
  formData.value = {
    ...formData.value,
    id: user.value.id || "",
    username: displayUsername.value || user.value.username || "",
    display_name: displayName.value || "",
    email: displayEmail.value || "",
    phone: displayPhone.value || "",
    location: displayLocation.value || "",
    jabatan: displayJabatan.value || "",
    id_jabatan: (user.value as any).id_jabatan || formData.value.id_jabatan || "",
    role: displayRole.value || user.value.role || "user",
    status: displayStatus.value || getUserStatusText(user.value.status),
    namaPerusahaan: displayPerusahaan.value || "",
  };
};

const toggleEditMode = () => {
  syncFormWithDisplayData();
  isEditMode.value = true;
};

const saveProfile = async () => {
  if (!user.value) return;
  isSaving.value = true;
  try {
    const isAktif = formData.value.status === 'Aktif';
    const rawPayload: any = {
      id:           user.value.id,
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
      photoData.append('id', user.value.id);
      photoData.append('profile_photo', dataURLtoBlob(fotoPreview.value), 'foto_profile.jpg');
      isCurrentUser.value ? await usersService.updateMePhoto(photoData) : await usersService.updateProfilePhoto(user.value!.id, photoData);
    }

    if (bannerPreview.value.startsWith('data:')) {
      const bannerData = new FormData();
      bannerData.append('id', user.value.id);
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
  <div class="row profile-user-page" :class="{ 'is-dark': isUserProfileDarkMode }">
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
                      {{ isEditMode ? 'Edit Profil' : 'Profil Pengguna' }}
                    </h2>
                    <p class="hero-sub-title mb-0">
                      {{ isEditMode ? 'Sesuaikan detail data pengguna di bawah ini' : 'Informasi akun dan data pribadi pengguna' }}
                    </p>
                  </div>

                  <div class="hero-action-tools">
                    <div class="d-flex gap-2 flex-wrap justify-content-end align-items-center">
                      <template v-if="!isEditMode">
                        <button v-if="isAdmin && !isCurrentUser" @click="toggleEditMode" class="btn-premium btn-premium--warning shadow-sm">
                          <i class="ri-edit-2-fill me-1"></i>Edit Profil
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
                  {{ displayRoleLabel }}
                </span>
                <span class="p-badge p-badge--jabatan"><i class="ri-medal-line"></i>{{ displayJabatan }}</span>
                <span class="p-badge p-badge--company"><i class="ri-community-line"></i>{{ displayPerusahaan }}</span>
                <span class="p-badge p-badge--sector"><i class="ri-microscope-line"></i>{{ displaySubSektor }}</span>
              </div>

              <div class="profile-contact-grid">
                <div class="contact-item contact-item--email">
                  <div class="contact-icon contact-icon--email"><i class="ri-mail-send-line"></i></div>
                  <div class="contact-content">
                    <span class="contact-label">Email</span>
                    <span class="contact-value contact-value--email" :title="displayEmail">{{ displayEmail }}</span>
                  </div>
                </div>
                <div class="contact-item">
                  <div class="contact-icon contact-icon--phone"><i class="ri-phone-camera-line"></i></div>
                  <div class="contact-content">
                    <span class="contact-label">Nomor Telepon</span>
                    <span class="contact-value">{{ displayPhone }}</span>
                  </div>
                </div>
                <div class="contact-item">
                  <div class="contact-icon contact-icon--location"><i class="ri-map-pin-user-line"></i></div>
                  <div class="contact-content">
                    <span class="contact-label">Lokasi</span>
                    <span class="contact-value">{{ displayLocation }}</span>
                  </div>
                </div>
                <div class="contact-item">
                  <div class="contact-icon contact-icon--joined"><i class="ri-calendar-check-line"></i></div>
                  <div class="contact-content">
                    <span class="contact-label">Bergabung Sejak</span>
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
              <h5 class="card-title mb-0 fw-bold fs-15">Informasi Akun</h5>
            </div>
            <div class="badge bg-light text-muted rounded-pill px-3 py-2 fs-11 fw-semibold border">{{ accountDetails.length }} Atribut</div>
          </div>
          <div class="card-body p-4 pt-3">
            <div class="row g-3">
              <div v-for="(item, idx) in accountDetails" :key="idx" class="col-xl-6 col-lg-6 col-md-6">
                <div class="form-group-split">
                  <div class="form-group-split-label-card">
                    <div class="form-item-icon" :class="item.colorClass" style="width:28px;height:28px"><i :class="item.icon" style="font-size:0.85rem"></i></div>
                    <div class="d-flex align-items-center gap-2"><label class="form-item-label mb-0 text-uppercase fs-10 fw-bold text-muted">{{ item.label }}</label><span v-if="item.badge" class="badge-source-info">{{ item.badge }}</span></div>
                  </div>
                  <div
                    class="form-group-split-input-card transition-all"
                    :class="{ 'bg-light': !item.isEditable || !isEditMode, 'form-item-card--readonly': !item.isEditable && isEditMode, 'form-item-card--clickable': !isEditMode && item.isEditable }"
                    :data-tooltip="getFieldActionTooltip(item)"
                    @click="!isEditMode && item.isEditable && (isEditMode = true)"
                  >
                    <template v-if="isEditMode && item.isEditable">
                       <select v-if="item.key === 'role'" v-model="formData.role" class="form-item-input border-0 bg-transparent p-0 outline-none w-100"><option v-for="r in rolesData" :key="r.id" :value="r.name">{{ formatRoleLabel(r.name) }}</option></select>
                       <select v-else-if="item.key === 'status'" v-model="formData.status" class="form-item-input border-0 bg-transparent p-0 outline-none w-100"><option value="Aktif">Aktif</option><option value="Nonaktif">Nonaktif</option></select>
                       <select v-else-if="item.key === 'jabatan'" v-model="formData.id_jabatan" class="form-item-input border-0 bg-transparent p-0 outline-none w-100"><option value="">Pilih Jabatan</option><option v-for="j in jabatanList" :key="j.id" :value="j.id">{{ j.nama_jabatan }}</option></select>
                       <input v-else v-model="formData[item.key]" type="text" class="form-item-input border-0 bg-transparent p-0 outline-none w-100" :placeholder="'Masukkan ' + item.label" />
                    </template>
                    <template v-else><div class="form-item-value" :class="{ 'wrap-text': item.wrap, 'text-muted': !item.isEditable }">{{ item.value }}</div><i :class="item.isEditable ? 'ri-pencil-line form-item-edit-action text-primary' : 'ri-lock-line form-item-edit-action text-light-muted'" class="form-item-edit-action" :aria-label="getFieldActionTooltip(item)"></i></template>
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
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06) !important;
  border: 0 !important;
}

.premium-breadcrumb { display: flex; align-items: center; gap: 0.5rem; margin-top: -0.25rem; }
.breadcrumb-item { font-size: 11px; font-weight: 800; color: rgba(255, 255, 255, 0.65); text-transform: uppercase; letter-spacing: 0.12em; }
.breadcrumb-item.active { color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.breadcrumb-sep { color: rgba(255, 255, 255, 0.4); font-size: 14px; }

.profile-banner {
  position: relative;
  min-height: 185px;
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
  padding: 1.35rem 2rem;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.hero-main-title { font-size: 2rem; font-weight: 900; letter-spacing: -0.04em; margin-bottom: 0.2rem; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3); color: #fff; }
.hero-sub-title { font-size: 0.95rem; font-weight: 500; max-width: 500px; color: rgba(255, 255, 255, 0.8); }

.btn-premium { display: inline-flex; align-items: center; justify-content: center; padding: 0.6rem 1.25rem; border-radius: 999px; font-size: 12px; font-weight: 800; transition: all 0.3s ease; border: 1px solid transparent; gap: 0.5rem; }
.btn-premium--warning { background: #f59e0b; color: #fff; border-color: #d97706; }
.btn-premium--warning:hover { background: #d97706; transform: translateY(-2px); }
.btn-premium--glass { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-color: rgba(255, 255, 255, 0.2); color: #fff; }
.btn-premium--glass:hover { background: rgba(255, 255, 255, 0.2); transform: translateY(-2px); }
.btn-premium--glass-danger { background: rgba(239, 68, 68, 0.15); backdrop-filter: blur(10px); border-color: rgba(239, 68, 68, 0.3); color: #fff; }

.profile-banner-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; width: 100%; }

.profile-content-body--premium { position: relative; background: #fff; padding: 0 2rem 1.5rem; }

.profile-foto-profile-container { position: relative; z-index: 5; flex: 0 0 136px; margin-top: -68px; display: flex; justify-content: center; }
.profile-foto-profile-wrap { width: 136px; height: 136px; border-radius: 50%; overflow: hidden; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.13), 0 0 0 7px #fff; background: #fff; }
.profile-foto-profile-img { width: 100%; height: 100%; object-fit: cover; }

.profile-info-block { flex: 1 1 auto; min-width: 0; padding-top: 1.35rem; padding-left: 0.75rem; }
.profile-content-body { display: flex; align-items: flex-start; gap: 1.5rem; }

.profile-identity-topline { display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; padding: 0.4rem 1rem; border-radius: 999px; background: #eff6ff; color: #3b82f6; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #dbeafe; }
.profile-user-name { font-size: 2.1rem; font-weight: 900; color: #0f172a; letter-spacing: -0.04em; }

.profile-badges-row { display: flex; flex-wrap: wrap; gap: 0.55rem; align-items: center; }
.p-badge { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.42rem 0.8rem; border-radius: 10px; font-size: 12px; font-weight: 700; transition: all 0.2s ease; border: 1px solid transparent; }
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

.profile-contact-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.9rem; margin-top: 1.15rem; }
.contact-item { display: flex; align-items: center; gap: 0.85rem; padding: 0.8rem 0.9rem; border-radius: 14px; background: #f8fafc; border: 1px solid #eef2f7; transition: all 0.22s ease; }
.contact-item:hover { background: #fff; border-color: #dbe7ff; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04); transform: translateY(-1px); }
.contact-item--email { min-width: 270px; }

.contact-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }
.contact-icon--email { background: #e0e7ff; color: #4338ca; }
.contact-icon--phone { background: #ede9fe; color: #6d28d9; }
.contact-icon--location { background: #ffedd5; color: #c2410c; }
.contact-icon--joined { background: #dcfce7; color: #15803d; }

.contact-content { display: flex; flex-direction: column; min-width: 0; }
.contact-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; }
.contact-value { font-size: 14px; font-weight: 700; color: #1e293b; overflow-wrap: anywhere; word-break: normal; }
.contact-value--email { display: block; max-width: 100%; font-size: 13px; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.form-item-edit-action { font-size: 16px; opacity: 0.4; }

.profile-user-page .form-group-split,
.profile-user-page .form-group-split-label-card,
.profile-user-page .form-group-split-input-card {
  overflow: visible;
}

.profile-user-page .form-group-split-label-card {
  padding: 8px 14px;
}

.profile-user-page .form-group-split-input-card {
  min-height: 44px;
  padding: 9px 42px 9px 16px;
}

.profile-user-page .form-item-icon {
  box-shadow: none !important;
}

.profile-user-page .stat-icon-blue,
.profile-user-page .stat-icon-indigo,
.profile-user-page .stat-icon-violet,
.profile-user-page .stat-icon-amber,
.profile-user-page .stat-icon-red,
.profile-user-page .stat-icon-teal {
  box-shadow: none !important;
}

.profile-user-page .stat-icon-blue { background: #eaf2ff !important; color: #2563eb !important; }
.profile-user-page .stat-icon-indigo { background: #eef2ff !important; color: #4f46e5 !important; }
.profile-user-page .stat-icon-violet { background: #f3edff !important; color: #7c3aed !important; }
.profile-user-page .stat-icon-amber { background: #fff4e5 !important; color: #d97706 !important; }
.profile-user-page .stat-icon-red { background: #feecec !important; color: #dc2626 !important; }
.profile-user-page .stat-icon-teal { background: #e7f8f5 !important; color: #0f766e !important; }

.profile-user-page .stat-icon-blue i,
.profile-user-page .stat-icon-indigo i,
.profile-user-page .stat-icon-violet i,
.profile-user-page .stat-icon-amber i,
.profile-user-page .stat-icon-red i,
.profile-user-page .stat-icon-teal i {
  color: currentColor !important;
}

.badge-source-info {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  color: #64748b;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0;
  padding: 0.22rem 0.5rem;
  text-transform: none;
}

.form-group-split-input-card[data-tooltip]::after {
  background: #0f172a;
  border-radius: 8px;
  bottom: calc(100% + 8px);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
  color: #fff;
  content: attr(data-tooltip);
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  opacity: 0;
  padding: 6px 8px;
  pointer-events: none;
  position: absolute;
  right: 8px;
  transform: translateY(4px);
  transition: opacity 160ms ease, transform 160ms ease;
  white-space: nowrap;
  z-index: 25;
}

.form-group-split-input-card[data-tooltip]::before {
  border: 5px solid transparent;
  border-top-color: #0f172a;
  bottom: calc(100% + 3px);
  content: "";
  opacity: 0;
  pointer-events: none;
  position: absolute;
  right: 18px;
  transform: translateY(4px);
  transition: opacity 160ms ease, transform 160ms ease;
  z-index: 26;
}

.form-group-split-input-card[data-tooltip]:hover::after,
.form-group-split-input-card[data-tooltip]:focus-within::after,
.form-group-split-input-card[data-tooltip]:hover::before,
.form-group-split-input-card[data-tooltip]:focus-within::before {
  opacity: 1;
  transform: translateY(0);
}

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

/* Dark mode: support both global theme attributes and the local observer fallback. */
:global(html[data-theme-mode="dark"]) .profile-user-page,
:global(html.dark) .profile-user-page,
.profile-user-page.is-dark {
  color: #dbeafe !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .stakeholders-shell-card,
:global(html.dark) .profile-user-page .stakeholders-shell-card,
:global(html[data-theme-mode="dark"]) .profile-user-page .stakeholder-profile-shell,
:global(html.dark) .profile-user-page .stakeholder-profile-shell,
:global(html[data-theme-mode="dark"]) .profile-user-page .skel-card,
:global(html.dark) .profile-user-page .skel-card,
.profile-user-page.is-dark .stakeholders-shell-card,
.profile-user-page.is-dark .stakeholder-profile-shell,
.profile-user-page.is-dark .skel-card {
  background: #111827 !important;
  border: 0 !important;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.32) !important;
  color: #dbeafe !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .profile-content-body--premium,
:global(html.dark) .profile-user-page .profile-content-body--premium,
:global(html[data-theme-mode="dark"]) .profile-user-page .stakeholders-shell-card .card-header,
:global(html.dark) .profile-user-page .stakeholders-shell-card .card-header,
:global(html[data-theme-mode="dark"]) .profile-user-page .stakeholders-shell-card .card-body,
:global(html.dark) .profile-user-page .stakeholders-shell-card .card-body,
:global(html[data-theme-mode="dark"]) .profile-user-page .bg-white,
:global(html.dark) .profile-user-page .bg-white,
.profile-user-page.is-dark .profile-content-body--premium,
.profile-user-page.is-dark .stakeholders-shell-card .card-header,
.profile-user-page.is-dark .stakeholders-shell-card .card-body,
.profile-user-page.is-dark .bg-white {
  background: #0f172a !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .profile-banner::after,
:global(html.dark) .profile-user-page .profile-banner::after,
.profile-user-page.is-dark .profile-banner::after {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.18) 0%, rgba(15, 23, 42, 0.84) 100%);
}

:global(html[data-theme-mode="dark"]) .profile-user-page .profile-foto-profile-wrap,
:global(html.dark) .profile-user-page .profile-foto-profile-wrap,
.profile-user-page.is-dark .profile-foto-profile-wrap {
  background: #111827 !important;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.34), 0 0 0 8px #0f172a !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .profile-user-name,
:global(html.dark) .profile-user-page .profile-user-name,
:global(html[data-theme-mode="dark"]) .profile-user-page .profile-user-name-input,
:global(html.dark) .profile-user-page .profile-user-name-input,
:global(html[data-theme-mode="dark"]) .profile-user-page .contact-value,
:global(html.dark) .profile-user-page .contact-value,
:global(html[data-theme-mode="dark"]) .profile-user-page .form-item-value,
:global(html.dark) .profile-user-page .form-item-value,
:global(html[data-theme-mode="dark"]) .profile-user-page .form-item-input,
:global(html.dark) .profile-user-page .form-item-input,
:global(html[data-theme-mode="dark"]) .profile-user-page .card-title,
:global(html.dark) .profile-user-page .card-title,
.profile-user-page.is-dark .profile-user-name,
.profile-user-page.is-dark .profile-user-name-input,
.profile-user-page.is-dark .contact-value,
.profile-user-page.is-dark .form-item-value,
.profile-user-page.is-dark .form-item-input,
.profile-user-page.is-dark .card-title {
  color: #e5eefb !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .text-muted,
:global(html.dark) .profile-user-page .text-muted,
:global(html[data-theme-mode="dark"]) .profile-user-page .contact-label,
:global(html.dark) .profile-user-page .contact-label,
:global(html[data-theme-mode="dark"]) .profile-user-page .form-item-label,
:global(html.dark) .profile-user-page .form-item-label,
.profile-user-page.is-dark .text-muted,
.profile-user-page.is-dark .contact-label,
.profile-user-page.is-dark .form-item-label {
  color: #94a3b8 !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .contact-item,
:global(html.dark) .profile-user-page .contact-item,
:global(html[data-theme-mode="dark"]) .profile-user-page .form-group-split,
:global(html.dark) .profile-user-page .form-group-split,
.profile-user-page.is-dark .contact-item,
.profile-user-page.is-dark .form-group-split {
  background: linear-gradient(145deg, #1a2535 0%, #1e2d40 100%) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
  color: #c7d9f5 !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .contact-item:hover,
:global(html.dark) .profile-user-page .contact-item:hover,
:global(html[data-theme-mode="dark"]) .profile-user-page .form-group-split:hover,
:global(html.dark) .profile-user-page .form-group-split:hover,
.profile-user-page.is-dark .contact-item:hover,
.profile-user-page.is-dark .form-group-split:hover {
  background: linear-gradient(145deg, #1d2b3d 0%, #24364d 100%) !important;
  border-color: rgba(96, 165, 250, 0.28) !important;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .form-group-split-label-card,
:global(html.dark) .profile-user-page .form-group-split-label-card,
.profile-user-page.is-dark .form-group-split-label-card {
  background: #1a2535 !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .form-group-split-input-card,
:global(html.dark) .profile-user-page .form-group-split-input-card,
:global(html[data-theme-mode="dark"]) .profile-user-page .bg-light,
:global(html.dark) .profile-user-page .bg-light,
.profile-user-page.is-dark .form-group-split-input-card,
.profile-user-page.is-dark .bg-light {
  background: #111827 !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .form-item-value.text-muted,
:global(html.dark) .profile-user-page .form-item-value.text-muted,
.profile-user-page.is-dark .form-item-value.text-muted {
  color: #a8c2e5 !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .form-item-input::placeholder,
:global(html.dark) .profile-user-page .form-item-input::placeholder,
:global(html[data-theme-mode="dark"]) .profile-user-page .profile-user-name-input::placeholder,
:global(html.dark) .profile-user-page .profile-user-name-input::placeholder,
.profile-user-page.is-dark .form-item-input::placeholder,
.profile-user-page.is-dark .profile-user-name-input::placeholder {
  color: #64748b !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .form-item-input option,
:global(html.dark) .profile-user-page .form-item-input option,
.profile-user-page.is-dark .form-item-input option {
  background: #111827;
  color: #e5eefb;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .badge.bg-light,
:global(html.dark) .profile-user-page .badge.bg-light,
:global(html[data-theme-mode="dark"]) .profile-user-page .badge-source-info,
:global(html.dark) .profile-user-page .badge-source-info,
.profile-user-page.is-dark .badge.bg-light,
.profile-user-page.is-dark .badge-source-info {
  background: rgba(37, 99, 235, 0.14) !important;
  border-color: rgba(147, 197, 253, 0.22) !important;
  color: #bfdbfe !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .p-badge--jabatan,
:global(html.dark) .profile-user-page .p-badge--jabatan,
.profile-user-page.is-dark .p-badge--jabatan {
  background: rgba(139, 92, 246, 0.13) !important;
  border-color: rgba(167, 139, 250, 0.24) !important;
  color: #c4b5fd !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .p-badge--company,
:global(html.dark) .profile-user-page .p-badge--company,
.profile-user-page.is-dark .p-badge--company {
  background: rgba(249, 115, 22, 0.13) !important;
  border-color: rgba(251, 146, 60, 0.24) !important;
  color: #fdba74 !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .p-badge--sector,
:global(html.dark) .profile-user-page .p-badge--sector,
.profile-user-page.is-dark .p-badge--sector {
  background: rgba(14, 165, 233, 0.13) !important;
  border-color: rgba(56, 189, 248, 0.24) !important;
  color: #7dd3fc !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .p-badge--role-red,
:global(html.dark) .profile-user-page .p-badge--role-red,
.profile-user-page.is-dark .p-badge--role-red {
  color: #f87171 !important;
  background: rgba(248, 113, 113, 0.1) !important;
  border-color: rgba(248, 113, 113, 0.2) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .p-badge--role-green,
:global(html.dark) .profile-user-page .p-badge--role-green,
.profile-user-page.is-dark .p-badge--role-green {
  color: #4ade80 !important;
  background: rgba(74, 222, 128, 0.1) !important;
  border-color: rgba(74, 222, 128, 0.2) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .p-badge--role-orange,
:global(html.dark) .profile-user-page .p-badge--role-orange,
.profile-user-page.is-dark .p-badge--role-orange {
  color: #fb923c !important;
  background: rgba(251, 146, 60, 0.1) !important;
  border-color: rgba(251, 146, 60, 0.2) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .p-badge--role-sky,
:global(html.dark) .profile-user-page .p-badge--role-sky,
.profile-user-page.is-dark .p-badge--role-sky {
  color: #38bdf8 !important;
  background: rgba(56, 189, 248, 0.1) !important;
  border-color: rgba(56, 189, 248, 0.2) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .skel-profile-body,
:global(html.dark) .profile-user-page .skel-profile-body,
:global(html[data-theme-mode="dark"]) .profile-user-page .skel-card-header,
:global(html.dark) .profile-user-page .skel-card-header,
:global(html[data-theme-mode="dark"]) .profile-user-page .skel-card-body,
:global(html.dark) .profile-user-page .skel-card-body,
.profile-user-page.is-dark .skel-profile-body,
.profile-user-page.is-dark .skel-card-header,
.profile-user-page.is-dark .skel-card-body {
  background: #0f172a !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .skel-avatar-wrap,
:global(html.dark) .profile-user-page .skel-avatar-wrap,
.profile-user-page.is-dark .skel-avatar-wrap {
  border-color: #0f172a !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .skel-banner-main,
:global(html.dark) .profile-user-page .skel-banner-main,
:global(html[data-theme-mode="dark"]) .profile-user-page .skel-breadcrumb-h,
:global(html.dark) .profile-user-page .skel-breadcrumb-h,
:global(html[data-theme-mode="dark"]) .profile-user-page .skel-h-title,
:global(html.dark) .profile-user-page .skel-h-title,
:global(html[data-theme-mode="dark"]) .profile-user-page .skel-h-sub,
:global(html.dark) .profile-user-page .skel-h-sub,
:global(html[data-theme-mode="dark"]) .profile-user-page .skel-btn-round,
:global(html.dark) .profile-user-page .skel-btn-round,
:global(html[data-theme-mode="dark"]) .profile-user-page .skel-avatar-wrap,
:global(html.dark) .profile-user-page .skel-avatar-wrap,
:global(html[data-theme-mode="dark"]) .profile-user-page .skel-tag-h,
:global(html.dark) .profile-user-page .skel-tag-h,
:global(html[data-theme-mode="dark"]) .profile-user-page .skel-name-h,
:global(html.dark) .profile-user-page .skel-name-h,
:global(html[data-theme-mode="dark"]) .profile-user-page .skel-chip-h,
:global(html.dark) .profile-user-page .skel-chip-h,
:global(html[data-theme-mode="dark"]) .profile-user-page .skel-meta-item,
:global(html.dark) .profile-user-page .skel-meta-item,
:global(html[data-theme-mode="dark"]) .profile-user-page .skel-icon-box,
:global(html.dark) .profile-user-page .skel-icon-box,
:global(html[data-theme-mode="dark"]) .profile-user-page .skel-line-h,
:global(html.dark) .profile-user-page .skel-line-h,
:global(html[data-theme-mode="dark"]) .profile-user-page .skel-btn-h,
:global(html.dark) .profile-user-page .skel-btn-h,
:global(html[data-theme-mode="dark"]) .profile-user-page .skel-field-box,
:global(html.dark) .profile-user-page .skel-field-box,
.profile-user-page.is-dark .skel-banner-main,
.profile-user-page.is-dark .skel-breadcrumb-h,
.profile-user-page.is-dark .skel-h-title,
.profile-user-page.is-dark .skel-h-sub,
.profile-user-page.is-dark .skel-btn-round,
.profile-user-page.is-dark .skel-avatar-wrap,
.profile-user-page.is-dark .skel-tag-h,
.profile-user-page.is-dark .skel-name-h,
.profile-user-page.is-dark .skel-chip-h,
.profile-user-page.is-dark .skel-meta-item,
.profile-user-page.is-dark .skel-icon-box,
.profile-user-page.is-dark .skel-line-h,
.profile-user-page.is-dark .skel-btn-h,
.profile-user-page.is-dark .skel-field-box {
  background: linear-gradient(90deg, #1e293b 25%, #263449 50%, #1e293b 75%) !important;
  background-size: 200% 100% !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
}

/* Dark mode polish for the profile surface. */
:global(html[data-theme-mode="dark"]) .profile-user-page,
:global(html.dark) .profile-user-page,
.profile-user-page.is-dark {
  --profile-dark-page: #060b24;
  --profile-dark-shell: #0b1224;
  --profile-dark-panel: #101a2d;
  --profile-dark-panel-soft: #142033;
  --profile-dark-field: #0d1526;
  --profile-dark-line: rgba(148, 163, 184, 0.18);
  --profile-dark-line-strong: rgba(125, 211, 252, 0.18);
  color: #dbeafe !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .stakeholder-profile-shell,
:global(html.dark) .profile-user-page .stakeholder-profile-shell,
.profile-user-page.is-dark .stakeholder-profile-shell {
  background: linear-gradient(180deg, rgba(16, 26, 45, 0.98) 0%, rgba(11, 18, 36, 0.98) 100%) !important;
  border: 0 !important;
  box-shadow: 0 22px 50px rgba(0, 0, 0, 0.34) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .stakeholders-shell-card,
:global(html.dark) .profile-user-page .stakeholders-shell-card,
.profile-user-page.is-dark .stakeholders-shell-card {
  background: linear-gradient(180deg, #101a2d 0%, #0c1425 100%) !important;
  border-color: rgba(125, 211, 252, 0.14) !important;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.28) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .profile-content-body--premium,
:global(html.dark) .profile-user-page .profile-content-body--premium,
.profile-user-page.is-dark .profile-content-body--premium {
  background: linear-gradient(180deg, #111b2e 0%, #0d1526 100%) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .stakeholders-shell-card .card-header,
:global(html.dark) .profile-user-page .stakeholders-shell-card .card-header,
.profile-user-page.is-dark .stakeholders-shell-card .card-header {
  background: rgba(15, 23, 42, 0.52) !important;
  border-color: rgba(148, 163, 184, 0.14) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .stakeholders-shell-card .card-body,
:global(html.dark) .profile-user-page .stakeholders-shell-card .card-body,
.profile-user-page.is-dark .stakeholders-shell-card .card-body {
  background: rgba(8, 13, 31, 0.18) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .profile-banner::after,
:global(html.dark) .profile-user-page .profile-banner::after,
.profile-user-page.is-dark .profile-banner::after {
  background:
    linear-gradient(180deg, rgba(8, 13, 31, 0.16) 0%, rgba(8, 13, 31, 0.82) 100%),
    linear-gradient(90deg, rgba(14, 165, 233, 0.12) 0%, rgba(15, 23, 42, 0) 42%, rgba(15, 23, 42, 0.36) 100%) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .profile-foto-profile-wrap,
:global(html.dark) .profile-user-page .profile-foto-profile-wrap,
.profile-user-page.is-dark .profile-foto-profile-wrap {
  background: #050816 !important;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.38), 0 0 0 7px #111b2e, 0 0 0 8px rgba(125, 211, 252, 0.14) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .contact-item,
:global(html.dark) .profile-user-page .contact-item,
.profile-user-page.is-dark .contact-item {
  background: rgba(30, 41, 59, 0.62) !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .contact-item:hover,
:global(html.dark) .profile-user-page .contact-item:hover,
.profile-user-page.is-dark .contact-item:hover {
  background: rgba(36, 52, 77, 0.72) !important;
  border-color: rgba(125, 211, 252, 0.26) !important;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .contact-icon,
:global(html.dark) .profile-user-page .contact-icon,
.profile-user-page.is-dark .contact-icon {
  box-shadow: none !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .contact-icon--email,
:global(html.dark) .profile-user-page .contact-icon--email,
.profile-user-page.is-dark .contact-icon--email {
  background: rgba(129, 140, 248, 0.16) !important;
  color: #a5b4fc !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .contact-icon--phone,
:global(html.dark) .profile-user-page .contact-icon--phone,
.profile-user-page.is-dark .contact-icon--phone {
  background: rgba(167, 139, 250, 0.16) !important;
  color: #c4b5fd !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .contact-icon--location,
:global(html.dark) .profile-user-page .contact-icon--location,
.profile-user-page.is-dark .contact-icon--location {
  background: rgba(251, 146, 60, 0.16) !important;
  color: #fdba74 !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .contact-icon--joined,
:global(html.dark) .profile-user-page .contact-icon--joined,
.profile-user-page.is-dark .contact-icon--joined {
  background: rgba(45, 212, 191, 0.16) !important;
  color: #5eead4 !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .form-group-split,
:global(html.dark) .profile-user-page .form-group-split,
.profile-user-page.is-dark .form-group-split {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .form-group-split-label-card,
:global(html.dark) .profile-user-page .form-group-split-label-card,
.profile-user-page.is-dark .form-group-split-label-card {
  background: rgba(30, 41, 59, 0.62) !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .form-group-split-input-card,
:global(html.dark) .profile-user-page .form-group-split-input-card,
:global(html[data-theme-mode="dark"]) .profile-user-page .bg-light,
:global(html.dark) .profile-user-page .bg-light,
.profile-user-page.is-dark .form-group-split-input-card,
.profile-user-page.is-dark .bg-light {
  background: rgba(13, 21, 38, 0.92) !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .form-group-split-input-card:hover,
:global(html.dark) .profile-user-page .form-group-split-input-card:hover,
.profile-user-page.is-dark .form-group-split-input-card:hover {
  background: rgba(17, 28, 49, 0.96) !important;
  border-color: rgba(96, 165, 250, 0.32) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .form-item-value,
:global(html.dark) .profile-user-page .form-item-value,
.profile-user-page.is-dark .form-item-value {
  color: #dbeafe !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .form-item-value.text-muted,
:global(html.dark) .profile-user-page .form-item-value.text-muted,
.profile-user-page.is-dark .form-item-value.text-muted {
  color: #bfdbfe !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .form-item-card--clickable .form-item-edit-action,
:global(html.dark) .profile-user-page .form-item-card--clickable .form-item-edit-action,
.profile-user-page.is-dark .form-item-card--clickable .form-item-edit-action {
  color: #60a5fa !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .badge.bg-light,
:global(html.dark) .profile-user-page .badge.bg-light,
.profile-user-page.is-dark .badge.bg-light {
  background: rgba(37, 99, 235, 0.18) !important;
  border-color: rgba(96, 165, 250, 0.28) !important;
  color: #dbeafe !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .badge-source-info,
:global(html.dark) .profile-user-page .badge-source-info,
.profile-user-page.is-dark .badge-source-info {
  background: rgba(37, 99, 235, 0.16) !important;
  border-color: rgba(96, 165, 250, 0.26) !important;
  color: #bfdbfe !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .p-badge,
:global(html.dark) .profile-user-page .p-badge,
.profile-user-page.is-dark .p-badge {
  box-shadow: none !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .p-badge:hover,
:global(html.dark) .profile-user-page .p-badge:hover,
.profile-user-page.is-dark .p-badge:hover {
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .form-item-icon,
:global(html.dark) .profile-user-page .form-item-icon,
.profile-user-page.is-dark .form-item-icon {
  border: 1px solid rgba(148, 163, 184, 0.16) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .stat-icon-blue,
:global(html.dark) .profile-user-page .stat-icon-blue,
.profile-user-page.is-dark .stat-icon-blue {
  background: rgba(96, 165, 250, 0.14) !important;
  border-color: rgba(147, 197, 253, 0.24) !important;
  color: #93c5fd !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .stat-icon-indigo,
:global(html.dark) .profile-user-page .stat-icon-indigo,
.profile-user-page.is-dark .stat-icon-indigo {
  background: rgba(129, 140, 248, 0.15) !important;
  border-color: rgba(165, 180, 252, 0.24) !important;
  color: #a5b4fc !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .stat-icon-violet,
:global(html.dark) .profile-user-page .stat-icon-violet,
.profile-user-page.is-dark .stat-icon-violet {
  background: rgba(167, 139, 250, 0.15) !important;
  border-color: rgba(196, 181, 253, 0.24) !important;
  color: #c4b5fd !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .stat-icon-amber,
:global(html.dark) .profile-user-page .stat-icon-amber,
.profile-user-page.is-dark .stat-icon-amber {
  background: rgba(251, 146, 60, 0.15) !important;
  border-color: rgba(253, 186, 116, 0.24) !important;
  color: #fdba74 !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .stat-icon-red,
:global(html.dark) .profile-user-page .stat-icon-red,
.profile-user-page.is-dark .stat-icon-red {
  background: rgba(248, 113, 113, 0.14) !important;
  border-color: rgba(252, 165, 165, 0.24) !important;
  color: #fca5a5 !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .stat-icon-teal,
:global(html.dark) .profile-user-page .stat-icon-teal,
.profile-user-page.is-dark .stat-icon-teal {
  background: rgba(45, 212, 191, 0.14) !important;
  border-color: rgba(94, 234, 212, 0.24) !important;
  color: #5eead4 !important;
}

:global(html[data-theme-mode="dark"]) .profile-user-page .stat-icon-blue i,
:global(html[data-theme-mode="dark"]) .profile-user-page .stat-icon-indigo i,
:global(html[data-theme-mode="dark"]) .profile-user-page .stat-icon-violet i,
:global(html[data-theme-mode="dark"]) .profile-user-page .stat-icon-amber i,
:global(html[data-theme-mode="dark"]) .profile-user-page .stat-icon-red i,
:global(html[data-theme-mode="dark"]) .profile-user-page .stat-icon-teal i,
:global(html.dark) .profile-user-page .stat-icon-blue i,
:global(html.dark) .profile-user-page .stat-icon-indigo i,
:global(html.dark) .profile-user-page .stat-icon-violet i,
:global(html.dark) .profile-user-page .stat-icon-amber i,
:global(html.dark) .profile-user-page .stat-icon-red i,
:global(html.dark) .profile-user-page .stat-icon-teal i,
.profile-user-page.is-dark .stat-icon-blue i,
.profile-user-page.is-dark .stat-icon-indigo i,
.profile-user-page.is-dark .stat-icon-violet i,
.profile-user-page.is-dark .stat-icon-amber i,
.profile-user-page.is-dark .stat-icon-red i,
.profile-user-page.is-dark .stat-icon-teal i {
  color: currentColor !important;
}

@media (max-width: 768px) {
  .profile-user-page {
    margin-inline: 0;
  }

  .profile-user-page > .col-12 {
    padding-inline: 0.75rem;
  }

  .stakeholder-profile-shell,
  .stakeholders-shell-card {
    border-radius: 18px !important;
  }

  .profile-banner {
    min-height: 285px;
  }

  .profile-banner-overlay-premium {
    padding: 1.15rem 1.25rem;
  }

  .profile-banner-top {
    align-items: stretch;
    flex-direction: column;
    gap: 0.9rem;
  }

  .premium-breadcrumb {
    flex-wrap: wrap;
  }

  .hero-main-title {
    font-size: 1.45rem;
    line-height: 1.18;
    letter-spacing: 0;
  }

  .hero-sub-title {
    font-size: 0.82rem;
    line-height: 1.35;
  }

  .profile-banner-top .d-flex.flex-wrap {
    display: grid !important;
    gap: 0.55rem !important;
    width: 100%;
  }

  .hero-action-tools {
    position: relative;
    z-index: 6;
    width: 100%;
  }

  .hero-action-tools > .d-flex {
    display: grid !important;
    gap: 0.55rem !important;
    width: 100%;
  }

  .btn-premium {
    min-height: 38px;
    width: 100%;
  }

  .profile-content-body--premium {
    padding: 1rem 1.05rem 1.2rem;
  }

  .profile-content-body {
    align-items: center;
    flex-direction: column;
    gap: 0.8rem;
    text-align: center;
  }

  .profile-foto-profile-container {
    flex: 0 0 auto;
    margin-top: -54px !important;
    position: relative !important;
    transform: none !important;
    z-index: 1 !important;
    width: 100%;
  }

  .profile-foto-profile-wrap {
    height: 108px;
    width: 108px;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.2), 0 0 0 5px #fff;
  }

  .btn-upload-camera {
    bottom: 2px;
    height: 32px;
    right: calc(50% - 54px);
    transform: translateX(42px);
    width: 32px;
  }

  .profile-user-page .hero-action-tools,
  .profile-user-page .hero-action-tools .btn-premium {
    position: relative !important;
    z-index: 20 !important;
  }

  .profile-user-page .profile-content-body,
  .profile-user-page .profile-content-body--premium {
    padding-top: 1rem !important;
  }

  .profile-user-page .profile-foto-profile-container {
    margin-top: -54px !important;
    transform: none !important;
    position: relative !important;
    z-index: 1 !important;
  }

  .profile-info-block {
    padding-left: 0;
    padding-top: 0;
    width: 100%;
  }

  .profile-user-name {
    font-size: clamp(1.45rem, 7vw, 1.85rem);
    letter-spacing: 0;
    line-height: 1.18;
    overflow-wrap: anywhere;
  }

  .profile-user-name-input {
    font-size: clamp(1.35rem, 7vw, 1.75rem);
    text-align: center;
  }

  .profile-badges-row {
    justify-content: center;
    gap: 0.5rem;
  }

  .p-badge {
    max-width: 100%;
    min-height: 34px;
    overflow-wrap: anywhere;
    text-align: left;
  }

  .p-badge--company,
  .p-badge--sector {
    justify-content: center;
    width: 100%;
  }

  .profile-contact-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
    margin-top: 1rem;
    text-align: left;
  }

  .contact-item,
  .contact-item--email {
    min-width: 0;
    padding: 0.78rem;
    width: 100%;
  }

  .contact-icon {
    height: 38px;
    width: 38px;
  }

  .contact-value,
  .contact-value--email {
    font-size: 0.86rem;
    white-space: normal;
  }

  .stakeholders-shell-card .card-header {
    align-items: flex-start !important;
    gap: 0.75rem;
    padding-inline: 1rem !important;
  }

  .stakeholders-shell-card .card-body {
    padding: 1rem !important;
  }

  .profile-user-page .form-group-split {
    display: grid;
    gap: 0.5rem;
  }

  .profile-user-page .form-group-split-label-card,
  .profile-user-page .form-group-split-input-card {
    border-radius: 14px;
    width: 100%;
  }

  .profile-user-page .form-group-split-label-card {
    padding: 8px 10px;
  }

  .profile-user-page .form-group-split-label-card > .d-flex {
    min-width: 0;
  }

  .profile-user-page .form-group-split-input-card {
    min-height: 42px;
    padding: 9px 38px 9px 12px;
  }

  .form-item-value {
    overflow-wrap: anywhere;
    word-break: normal;
  }

  .form-group-split-input-card[data-tooltip]::before,
  .form-group-split-input-card[data-tooltip]::after {
    display: none;
  }
}

@media (max-width: 420px) {
  .profile-user-page > .col-12 {
    padding-inline: 0.35rem;
  }

  .profile-banner {
    min-height: 275px;
  }

  .profile-banner-overlay-premium {
    padding: 1rem;
  }

  .profile-content-body--premium {
    padding-inline: 0.85rem;
    padding-top: 1rem;
  }

  .profile-user-page .profile-banner {
    min-height: 285px;
  }

  .profile-foto-profile-wrap {
    height: 100px;
    width: 100px;
  }

  .btn-upload-camera {
    right: calc(50% - 50px);
  }

  .profile-user-page .profile-foto-profile-container {
    margin-top: -50px !important;
  }

  .profile-badges-row {
    align-items: stretch;
  }

  .p-badge {
    justify-content: center;
    width: 100%;
  }

  .contact-item {
    align-items: flex-start;
  }

  .stakeholders-shell-card .card-header {
    flex-direction: column;
  }
}
</style>
