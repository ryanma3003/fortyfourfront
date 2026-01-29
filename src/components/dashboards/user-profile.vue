<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useProfileStore } from "../../stores/profile";
import { useAuthStore } from "../../stores/auth";
import { usersService } from "../../services/users.service";
import { roleService, type Role } from "../../services/role.service";
import type { User } from "../../types/user.types";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";

// User interface is imported from usersStore

const route = useRoute();
const router = useRouter();
const profileStore = useProfileStore();
const authStore = useAuthStore();

// Reactive user data
const user = ref<User | null>(null);
const loading = ref(true);
const isCurrentUser = ref(false);
const rolesData = ref<Role[]>([]);

// Check if current logged-in user is admin
const isAdmin = computed(() => authStore.isAdmin);

// Get slug from route params
const slug = computed(() => route.params.slug as string);

// Format date to Indonesian locale
const formatJoinedDate = (dateString: string | undefined): string => {
  if (!dateString) return 'Tidak diketahui';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { 
      day: 'numeric',
      month: 'long', 
      year: 'numeric' 
    });
  } catch {
    return dateString;
  }
};

// Load user data based on slug from API
const loadUser = async () => {
  loading.value = true;

  try {
    // Fetch users and roles in parallel
    const [users, roles] = await Promise.all([
      usersService.getAll(),
      roleService.getAll()
    ]);
    
    rolesData.value = roles;
    
    const foundUser = users.find((u: any) => 
      u.slug === slug.value || u.username === slug.value || u.id?.toString() === slug.value
    );

    if (foundUser) {
      // Map API response to User type
      user.value = {
        id: foundUser.id?.toString() || '',
        slug: foundUser.slug || foundUser.username || '',
        username: foundUser.username || '',
        name: foundUser.name || foundUser.username || 'Unknown',
        email: foundUser.email || '',
        jabatan: foundUser.jabatan || foundUser.id_jabatan || '',
        role: foundUser.role || foundUser.role_name || 'user',
        phone: foundUser.phone || '',
        location: foundUser.location || '',
        joined: foundUser.joined || foundUser.created_at || '',
        photo: foundUser.photo || '',
        banner: foundUser.banner || '',
      };

      // Check if this is the currently logged-in user
      if (
        authStore.currentUser &&
        authStore.currentUser.username === foundUser.username
      ) {
        isCurrentUser.value = true;
        // Load profile data from store for current user
        await profileStore.switchUser();
      } else {
        isCurrentUser.value = false;
      }
    } else {
      // Redirect to users-list if user not found
      router.push("/users-list");
    }
  } catch (error) {
    console.error('Failed to load user:', error);
    router.push("/users-list");
  } finally {
    loading.value = false;
  }
};

// Watch for slug changes
watch(slug, () => {
  loadUser();
});

onMounted(() => {
  loadUser();
});

const dataToPass = computed(() => ({
  title: { label: "Users", path: "/users-list" },
  currentpage: displayName.value || "User Profile",
  activepage: "User Profile",
}));

// Computed values - use profileStore for current user, users.json for others
const displayName = computed(() => {
  if (isCurrentUser.value) {
    return profileStore.displayName;
  }
  return user.value?.name || "";
});

const displayEmail = computed(() => {
  if (isCurrentUser.value) {
    return profileStore.displayEmail;
  }
  return user.value?.username || "";
});

const displayRole = computed(() => {
  if (isCurrentUser.value) {
    return profileStore.displayRole;
  }
  return user.value?.role || "";
});

const displayJabatan = computed(() => {
  if (isCurrentUser.value) {
    return profileStore.displayJabatan;
  }
  return user.value?.jabatan || "";
});

const displayPhone = computed(() => {
  if (isCurrentUser.value) {
    return profileStore.displayPhone;
  }
  return user.value?.phone || "";
});

const displayLocation = computed(() => {
  if (isCurrentUser.value) {
    return profileStore.displayLocation;
  }
  return user.value?.location || "";
});

const displayJoined = computed(() => {
  if (isCurrentUser.value) {
    return profileStore.displayJoined;
  }
  // Format the joined date for other users
  return formatJoinedDate(user.value?.joined);
});

const displayAvatar = computed(() => {
  if (isCurrentUser.value) {
    return profileStore.avatarUrl;
  }
  // Use photo from usersStore data (synced when user saved their profile)
  return user.value?.photo || "/images/faces/15.jpg";
});

const displayBanner = computed(() => {
  if (isCurrentUser.value) {
    return profileStore.bannerUrl;
  }
  // Use banner from usersStore data (synced when user saved their profile)
  return user.value?.banner || "/images/media/media-21.jpg";
});

// Edit Role Modal State
const showEditModal = ref(false);
const selectedRole = ref("");
const isSaving = ref(false);
const showToast = ref(false);
const toastMessage = ref("");
const toastType = ref<"success" | "error">("success");

const openEditModal = () => {
  if (user.value) {
    selectedRole.value = user.value.role;
    showEditModal.value = true;
  }
};

const showNotification = (message: string, type: "success" | "error" = "success") => {
  toastMessage.value = message;
  toastType.value = type;
  showToast.value = true;
  setTimeout(() => { showToast.value = false; }, 3000);
};

const saveRole = async () => {
  if (!user.value) return;
  
  isSaving.value = true;
  
  try {
    // Find the role ID from the selected role name
    const roleObj = rolesData.value.find(r => 
      r.name.toLowerCase() === selectedRole.value.toLowerCase()
    );
    
    if (roleObj) {
      // Use role service to assign role
      await roleService.assignToUser(user.value.id, roleObj.id);
    } else {
      // Fallback: update directly via users service
      await usersService.update(user.value.id, {
        role: selectedRole.value,
      });
    }
    
    // Update local user data
    user.value = { ...user.value, role: selectedRole.value };
    showEditModal.value = false;
    showNotification("Role berhasil diperbarui!", "success");
  } catch (error) {
    console.error('Failed to update role:', error);
    showNotification("Gagal memperbarui role!", "error");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Loading State -->
  <div v-if="loading" class="row justify-content-center">
    <div class="col-xl-11 col-xxl-10">
      <div class="card custom-card">
        <div class="card-body text-center p-5">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Profile Container -->
  <div v-else-if="user" class="row justify-content-center">
    <div class="col-xl-11 col-xxl-10">
      <!-- Main Profile Card -->
      <div class="card custom-card overflow-hidden profile-main-card">
        <!-- Banner Image -->
        <div class="profile-header-banner position-relative"
          :style="{
            backgroundImage: `url(${displayBanner})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '180px',
          }"
        >
          <!-- Overlay for better contrast -->
          <div class="position-absolute w-100 h-100"
            style="
              background: linear-gradient(
                to bottom,
                rgba(30, 58, 95, 0.3) 0%,
                rgba(26, 54, 93, 0.1) 100%
              );
            "
          ></div>
          <div class="position-absolute top-0 end-0 p-3 p-md-4 d-flex gap-2">
            <router-link to="/users-list" class="btn btn-light btn-sm rounded-pill shadow-sm d-flex align-items-center gap-2">
              <i class="ri-arrow-left-line"></i>
              <span class="d-none d-sm-inline">Kembali</span>
            </router-link>
          </div>
        </div>

        <!-- Profile Content -->
        <div class="card-body p-3 p-md-4 pb-4 position-relative">
          <!-- Avatar Section -->
          <div class="d-flex align-items-end justify-content-between flex-wrap gap-3" style="margin-top: -70px">
            <div class="d-flex align-items-end gap-3 flex-wrap">
              <!-- Avatar with Online Status -->
              <div class="position-relative">
                <div class="avatar-container">
                  <span class="avatar avatar-xxl avatar-rounded shadow-lg border border-4 border-white overflow-hidden">
                    <img :src="displayAvatar" alt="Profile Avatar" />
                  </span>
                </div>
              </div>

              <!-- Name & Title -->
              <div class="pb-2 mt-2 mt-md-5">
                <h4 class="fw-bold mb-1 text-dark profile-name">
                  {{ displayName }}
                </h4>
                <p class="text-primary-dark fw-medium mb-1 d-flex align-items-center gap-1">
                  <i class="ri-user-line"></i>{{ displayRole }}
                </p>
                <p class="text-primary-dark fw-medium mb-1 d-flex align-items-center gap-1">
                  <i class="ri-briefcase-line"></i>{{ displayJabatan }}
                </p>
                <p class="text-black fs-13 mb-2 d-flex align-items-center gap-1">
                  <i class="ri-mail-line"></i>{{ displayEmail }}
                </p>
                <p class="fs-12 mb-0 mt-1">
                  <span class="me-3"><i class="ri-phone-line me-1"></i>{{ displayPhone }}</span>
                  <span><i class="ri-map-pin-line me-1"></i>{{ displayLocation }}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Contact Information Cards -->
      <!-- Account Information Section -->
      <div class="card custom-card mt-3 overflow-hidden">
        <div class="card-header d-flex align-items-center border-0 gradient-header-blue">
          <i class="ri-file-user-line text-white me-2 fs-18"></i>
          <div class="card-title text-white mb-0">Informasi Akun</div>
        </div>
        <div class="card-body" style="background: linear-gradient(180deg, rgba(26, 54, 93, 0.03) 0%, rgba(255, 255, 255, 1) 100%);">
          <div class="row g-3">
            <!-- Email -->
            <div class="col-md-6 col-12">
              <div class="info-item p-4 rounded-3 h-100" style="background: rgba(26, 54, 93, 0.04);">
                <div class="d-flex align-items-center gap-3">
                  <span class="avatar avatar-md rounded-3" style="background: linear-gradient(135deg, #1e3a5f, #2c5282)">
                    <i class="ri-mail-line text-white fs-18"></i>
                  </span>
                  <div class="flex-fill min-width-0">
                    <span class="text-muted fs-12 d-block">Email</span>
                    <span class="fw-medium text-truncate d-block">{{ displayEmail }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Phone -->
            <div class="col-md-6 col-12">
              <div class="info-item p-4 rounded-3 h-100" style="background: rgba(26, 54, 93, 0.04);">
                <div class="d-flex align-items-center gap-3">
                  <span class="avatar avatar-md rounded-3" style="background: linear-gradient(135deg, #1e3a5f, #2c5282)">
                    <i class="ri-phone-line text-white fs-18"></i>
                  </span>
                  <div class="flex-fill min-width-0">
                    <span class="text-muted fs-12 d-block">Telepon</span>
                    <span class="fw-medium text-truncate d-block">{{ displayPhone }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Location -->
            <div class="col-md-6 col-12">
              <div class="info-item p-4 rounded-3 h-100" style="background: rgba(26, 54, 93, 0.04);">
                <div class="d-flex align-items-center gap-3">
                  <span class="avatar avatar-md rounded-3" style="background: linear-gradient(135deg, #1e3a5f, #2c5282)">
                    <i class="ri-map-pin-line text-white fs-18"></i>
                  </span>
                  <div class="flex-fill min-width-0">
                    <span class="text-muted fs-12 d-block">Lokasi</span>
                    <span class="fw-medium text-truncate d-block">{{ displayLocation }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Jabatan -->
            <div class="col-md-6 col-12">
              <div class="info-item p-4 rounded-3 h-100" style="background: rgba(26, 54, 93, 0.04);">
                <div class="d-flex align-items-center gap-3">
                  <span class="avatar avatar-md rounded-3" style="background: linear-gradient(135deg, #1e3a5f, #2c5282)">
                    <i class="ri-briefcase-line text-white fs-18"></i>
                  </span>
                  <div class="flex-fill min-width-0">
                    <span class="text-muted fs-12 d-block">Jabatan</span>
                    <span class="fw-medium text-truncate d-block">{{ displayJabatan }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Role (Clickable for Admin) -->
            <div class="col-md-6 col-12">
              <div 
                class="info-item p-4 rounded-3 h-100 role-card"
                :class="{ 'role-card-editable': isAdmin && !isCurrentUser }"
                :style="{ background: 'rgba(26, 54, 93, 0.04)' }"
                @click="isAdmin && !isCurrentUser && openEditModal()"
              >
                <div class="d-flex align-items-center gap-3">
                  <span class="avatar avatar-md rounded-3" style="background: linear-gradient(135deg, #1e3a5f, #2c5282)">
                    <i class="ri-shield-user-line text-white fs-18"></i>
                  </span>
                  <div class="flex-fill min-width-0">
                    <span class="text-muted fs-12 d-block">Role</span>
                    <span class="fw-medium text-truncate d-block">{{ displayRole }}</span>
                  </div>
                  <!-- Edit Icon Indicator (shows on hover for admin) -->
                  <i v-if="isAdmin && !isCurrentUser" class="ri-edit-2-line fs-18 text-primary"></i>
                </div>
              </div>
            </div>

             <!-- Member Since -->
            <div class="col-md-6 col-12">
              <div class="info-item p-4 rounded-3 h-100" style="background: rgba(26, 54, 93, 0.04);">
                <div class="d-flex align-items-center gap-3">
                  <span class="avatar avatar-md rounded-3" style="background: linear-gradient(135deg, #1e3a5f, #2c5282)">
                    <i class="ri-calendar-line text-white fs-18"></i>
                  </span>
                  <div class="flex-fill min-width-0">
                    <span class="text-muted fs-12 d-block">Bergabung Sejak</span>
                    <span class="fw-medium text-truncate d-block">{{ displayJoined }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Toast Notification -->
  <div v-if="showToast" class="position-fixed top-0 end-0 p-3" style="z-index: 9999">
    <div class="toast show" :class="{ 'bg-success': toastType === 'success', 'bg-danger': toastType === 'error' }" role="alert">
      <div class="toast-body text-white">
        <i :class="toastType === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'" class="me-2"></i>
        {{ toastMessage }}
      </div>
    </div>
  </div>

  <!-- Edit Role Modal -->
  <div v-if="showEditModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0, 0, 0, 0.5)" @click="showEditModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal" @click.stop>
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="ri-shield-user-line me-2"></i>Edit Role
          </h5>
          <button type="button" class="btn-close" @click="showEditModal = false"></button>
        </div>
        <div class="modal-body" v-if="user">
          <!-- User Info (Readonly) -->
          <div class="d-flex align-items-center gap-3 mb-4 p-3 bg-light rounded">
            <span class="avatar avatar-md avatar-rounded bg-primary-transparent overflow-hidden">
              <img v-if="user.photo" :src="user.photo" :alt="user.name" />
              <span v-else class="text-primary fw-semibold">{{ user.name.charAt(0).toUpperCase() }}</span>
            </span>
            <div>
              <h6 class="mb-0 fw-semibold">{{ user.name }}</h6>
              <span class="text-muted fs-13">{{ user.username }}</span>
            </div>
          </div>
          
          <!-- Role Selection -->
          <div class="mb-3">
            <label class="form-label fw-semibold">Role <span class="text-danger">*</span></label>
            <select v-model="selectedRole" class="form-select">
              <option v-for="role in rolesData" :key="role.id" :value="role.name">{{ role.name }}</option>
              <option v-if="!rolesData.length" value="admin">Admin</option>
              <option v-if="!rolesData.length" value="user">User</option>
            </select>
            <small class="text-muted">Pilih role untuk user ini.</small>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="showEditModal = false">Batal</button>
          <button type="button" class="btn btn-primary" @click="saveRole" :disabled="isSaving">
            <i class="ri-save-line me-1"></i>{{ isSaving ? 'Menyimpan...' : 'Simpan' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .row.justify-content-center {
  min-height: calc(84vh);
}
.bio-card {
  border: none !important;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075) !important;
  overflow: hidden !important;
}

.bio-card .card-header {
  border: none !important;
  border-bottom: none !important;
  border-block-end: none !important;
  border-radius: 0 !important;
  margin: 0 !important;
}

.bio-card .card-body {
  border: 1px solid var(--default-border);
  border-top: none !important;
  border-radius: 0 !important;
}

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

html[data-theme-mode="dark"] .text-muted,
html.dark .text-muted {
  color: #9ca3af !important;
}

html[data-theme-mode="dark"] .fw-medium,
html.dark .fw-medium {
  color: #e5e7eb !important;
}

html[data-theme-mode="dark"] .card-body[style*="linear-gradient"],
html.dark .card-body[style*="linear-gradient"] {
  background: #1f2937 !important;
}

html[data-theme-mode="dark"] .info-item[style*="rgba"],
html.dark .info-item[style*="rgba"] {
  background: #374151 !important;
}

html[data-theme-mode="dark"] .avatar.border-white,
html.dark .avatar.border-white {
  border-color: #374151 !important;
}

html[data-theme-mode="dark"] .avatar .text-white,
html.dark .avatar .text-white {
  color: #ffffff !important;
}

/* Role Card Editable Styles */
.role-card-editable {
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.role-card-editable:hover {
  background: rgba(26, 54, 93, 0.25) !important;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(26, 54, 93, 0.15);
}

.role-card-editable:hover .edit-icon-indicator {
  opacity: 1;
}

html[data-theme-mode="dark"] .role-card-editable:hover,
html.dark .role-card-editable:hover {
  background: rgba(99, 102, 241, 0.15) !important;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
}

/* Modal Centering */
.modal.show { display: block; }
.modal.show .modal-dialog.custom-modal { 
  margin: 0 auto !important; 
  max-width: 800px !important;
  width: 800px !important;
  position: fixed;
  top: 50%;
  left: calc(50% + 125px);
  transform: translate(-50%, -50%);
}
.modal.show .modal-dialog.custom-modal .modal-content {
  width: 100% !important;
}
</style>
