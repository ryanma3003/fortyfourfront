```
<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useProfileStore } from "../../stores/profile";
import { useAuthStore } from "../../stores/auth";
import { usersService } from "../../services/users.service";
import { roleService, type Role } from "../../services/role.service";
import { stakeholdersService } from "../../services/stakeholders.service";
import { formatImageUrl } from "../../utils/media";
import type { User } from "../../types/user.types";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";

const route = useRoute();
const router = useRouter();
const profileStore = useProfileStore();
const authStore = useAuthStore();

const user = ref<User | null>(null);
const loading = ref(true);
const isCurrentUser = ref(false);
const userCompanyName = ref('');
const userSubSektor = ref('');
const rolesData = ref<Role[]>([]);

const isAdmin = computed(() => authStore.isAdmin);
const slug = computed(() => route.params.slug as string);

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

const loadUser = async () => {
  loading.value = true;
  try {
    const [users, roles] = await Promise.all([
      usersService.getAll(),
      roleService.getAll(),
    ]);

    rolesData.value = roles;

    const foundUser = users.find((u: any) =>
      u.slug === slug.value || u.username === slug.value || u.id?.toString() === slug.value
    );

    if (foundUser) {
      user.value = {
        id: foundUser.id?.toString() || "",
        slug: foundUser.slug || foundUser.username || "",
        username: foundUser.username || "",
        name: foundUser.name || foundUser.username || "Unknown",
        email: foundUser.email || "",
        jabatan: foundUser.jabatan_name || foundUser.jabatan || "",
        role: foundUser.role || foundUser.role_name || "user",
        phone: foundUser.phone || "",
        location: foundUser.location || "",
        joined: foundUser.joined || foundUser.created_at || "",
        photo: formatImageUrl(foundUser.photo || foundUser.foto_profile),
        banner: formatImageUrl(foundUser.banner),
        bio: (foundUser as any).bio || "",
        address: (foundUser as any).address || (foundUser as any).alamat || "",
        website: (foundUser as any).website || "",
        id_jabatan: (foundUser as any).id_jabatan || ""
      } as any;

      if (authStore.currentUser?.username === foundUser.username) {
        isCurrentUser.value = true;
        await profileStore.switchUser();
      } else {
        isCurrentUser.value = false;
      }

      const idPerusahaan = foundUser.id_perusahaan;
      if (idPerusahaan) {
        try {
          const company = await stakeholdersService.getById(idPerusahaan.toString());
          const c = (company as any)?.data ?? company;
          userCompanyName.value = c.nama_perusahaan || '';
          userSubSektor.value = c.sub_sektor?.nama_sub_sektor || '';
        } catch {
          userCompanyName.value = '';
          userSubSektor.value = '';
        }
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
  isCurrentUser.value ? profileStore.displayName : user.value?.name || ""
);
const displayEmail = computed(() =>
  isCurrentUser.value ? profileStore.displayEmail : user.value?.username || ""
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
const displayFotoProfile = computed(() =>
  isCurrentUser.value ? profileStore.fotoProfileUrl : user.value?.photo || "/images/faces/15.jpg"
);
const displayBanner = computed(() =>
  isCurrentUser.value ? profileStore.bannerUrl : user.value?.banner || "/images/media/media-21.jpg"
);
const displayPerusahaan = computed(() =>
  isCurrentUser.value ? (profileStore.namaPerusahaan || 'Belum terkait') : (userCompanyName.value || 'Belum terkait')
);
const displaySubSektor = computed(() =>
  isCurrentUser.value ? (profileStore.namaSubSektor || 'Belum terkait') : (userSubSektor.value || 'Belum terkait')
);

const accountDetails = computed(() => [
  { icon: "ri-mail-line",        label: "Email",           value: displayEmail.value,       colorClass: "stat-icon-teal",   isRole: false },
  { icon: "ri-phone-line",       label: "Telepon",         value: displayPhone.value,       colorClass: "stat-icon-violet", isRole: false },
  { icon: "ri-map-pin-line",     label: "Lokasi",          value: displayLocation.value,    colorClass: "stat-icon-amber",  isRole: false, wrap: true },
  { icon: "ri-briefcase-line",   label: "Jabatan",         value: displayJabatan.value,     colorClass: "stat-icon-blue",   isRole: false },
  { icon: "ri-building-line",    label: "Perusahaan",      value: displayPerusahaan.value,  colorClass: "stat-icon-amber",  isRole: false, wrap: true },
  { icon: "ri-shield-user-line", label: "Role",            value: displayRole.value,        colorClass: "stat-icon-red",    isRole: true },
  { icon: "ri-calendar-line",    label: "Bergabung Sejak", value: displayJoined.value,      colorClass: "stat-icon-teal",   isRole: false },
]);

// --- Modal & Toast ---
const showToast = ref(false);
const toastMessage = ref("");
const toastType = ref<"success" | "error">("success");

const goToEditPage = () => {
    if (user.value) {
        router.push(`/users/edit/${slug.value}`);
    }
}
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card gradient-header-card">

        <!-- Header -->
        <div class="card-header d-flex align-items-center justify-content-between gap-3 users-header">
          <div class="d-flex align-items-center gap-3">
            <div class="header-icon-box">
              <i class="ri-user-3-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">
                {{ loading ? "User Profile" : displayName || "User Profile" }}
              </div>
              <div class="header-subtitle mt-1">Informasi akun &amp; data pribadi pengguna</div>
            </div>
          </div>
          <div class="d-flex gap-2">
            <router-link v-if="isCurrentUser" to="/profile/settings" class="btn btn-primary-light btn-sm rounded-pill px-3">
              <i class="ri-edit-line me-1"></i>Sunting Profil
            </router-link>
            <button v-else-if="isAdmin" @click="goToEditPage" class="btn btn-warning-light btn-sm rounded-pill px-3">
              <i class="ri-user-settings-line me-1"></i>Edit Data User
            </button>
            <router-link to="/users" class="btn-back-profile">
              <i class="ri-arrow-left-line"></i>
              <span class="d-none d-sm-inline">Kembali</span>
            </router-link>
          </div>
        </div>

        <div class="card-body p-4">

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
            <div class="card custom-card hero-card-shell mb-4">
              <div
                class="profile-banner"
                :class="{ 'profile-banner-nophoto': !displayBanner || displayBanner === '/images/media/media-21.jpg' }"
                :style="displayBanner ? { backgroundImage: `url(${displayBanner})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : {}"
              ></div>

              <div class="profile-content-body">
                <div class="profile-foto-profile-container">
                  <div class="profile-foto-profile-wrap">
                    <img :src="displayFotoProfile" alt="Profile Foto" class="profile-foto-profile-img" />
                  </div>
                </div>
                <div class="profile-info-block">
                  <h4 class="profile-user-name mb-1">{{ displayName }}</h4>
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
                    <span class="contact-bar-sep-inline"></span>
                    <span><i class="ri-map-pin-line me-1"></i>{{ displayLocation }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Informasi Akun -->
            <div class="card custom-card mb-0">
              <div class="card-header d-flex align-items-center gap-3 bg-white border-bottom">
                <div class="d-flex align-items-center gap-2">
                  <div class="card-title mb-0 fw-semibold text-dark">Informasi Akun</div>
                </div>
              </div>
              <div class="card-body">
                <div class="info-grid" style="grid-template-columns: repeat(3, 1fr)">
                  <template v-for="(item, idx) in accountDetails" :key="idx">
                    <!-- Role item (editable by admin) -->
                    <div
                      v-if="item.isRole"
                      class="info-grid-item"
                      :class="{ 'info-grid-item--editable': isAdmin && !isCurrentUser }"
                      @click="isAdmin && !isCurrentUser && goToEditPage()"
                    >
                      <div class="info-grid-icon" :class="item.colorClass">
                        <i :class="item.icon"></i>
                      </div>
                      <div style="min-width:0;flex:1">
                        <div class="info-grid-label">{{ item.label }}</div>
                        <div class="info-grid-value">{{ item.value }}</div>
                      </div>
                      <i v-if="isAdmin && !isCurrentUser" class="ri-edit-2-line edit-role-icon"></i>
                    </div>
                    <!-- Normal item -->
                    <div v-else class="info-grid-item">
                      <div class="info-grid-icon" :class="item.colorClass">
                        <i :class="item.icon"></i>
                      </div>
                      <div style="min-width:0;flex:1">
                        <div class="info-grid-label">{{ item.label }}</div>
                        <div class="info-grid-value" :class="{ 'wrap-text': item.wrap }">{{ item.value }}</div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>

          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- Toast Notification -->
  <div v-if="showToast" class="position-fixed top-0 end-0 p-3" style="z-index: 9999">
    <div
      class="toast show"
      :class="{ 'bg-success': toastType === 'success', 'bg-danger': toastType === 'error' }"
      role="alert"
    >
      <div class="toast-body text-white">
        <i :class="toastType === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'" class="me-2"></i>
        {{ toastMessage }}
      </div>
    </div>
  </div>

  <!-- Modal removal -->
</template>

