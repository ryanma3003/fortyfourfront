<script setup>
import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useProfileStore } from "../../stores/profile";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";

// Profile store
const profileStore = useProfileStore();

// Use storeToRefs for reactive state
const {
  location,
  phone,
  joined,
  bio,
  stats,
  avatarUrl,
  bannerUrl,
  bannerPositionX,
  bannerPositionY,
  avatarPositionX,
  avatarPositionY,
  name,
  title,
  role,
  email,
  website,
  address,
} = storeToRefs(profileStore);

const dataToPass = {
  title: { label: "Dashboards", path: "/dashboards" },
  currentpage: "Profile",
  activepage: "Profile",
};

// Initialize profile data on mount
onMounted(() => {
  profileStore.switchUser();
});

// Computed display values from store (these use getters so need computed)
const displayName = computed(() => profileStore.displayName);
const displayEmail = computed(() => profileStore.displayEmail);
const displayJabatan = computed(() => profileStore.displayJabatan);
const displayRole = computed(() => profileStore.displayRole);
const displayPhone = computed(() => profileStore.displayPhone);
const displayLocation = computed(() => profileStore.displayLocation);
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Main Profile Container -->
  <div class="row justify-content-center">
    <div class="col-xl-11 col-xxl-10">
      <!-- Main Profile Card -->
      <div class="card custom-card overflow-hidden profile-main-card">
        <!-- Banner Image -->
        <div class="profile-header-banner position-relative"
          :style="{
            backgroundImage: `url(${bannerUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: `${bannerPositionX ?? 50}% ${bannerPositionY ?? 50}%`,
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
          <div class="position-absolute top-0 end-0 p-3 p-md-4">
            <router-link to="/profile-settings" class="btn btn-light btn-sm rounded-pill shadow-sm d-flex align-items-center gap-2">
              <i class="ri-edit-2-line"></i>
              <span class="d-none d-sm-inline">Edit Profile</span>
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
                    <img 
                      :src="avatarUrl" 
                      alt="Profile Avatar" 
                      :style="{ objectPosition: `${avatarPositionX ?? 50}% ${avatarPositionY ?? 50}%`, objectFit: 'cover', width: '100%', height: '100%' }"
                    />
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

      <!-- Account Information Section (moved to top) -->
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
                    <span class="fw-medium text-truncate d-block">{{ phone }}</span>
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
                    <span class="fw-medium text-truncate d-block">{{ location }}</span>
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

            <!-- Role -->
            <div class="col-md-6 col-12">
              <div class="info-item p-4 rounded-3 h-100" style="background: rgba(26, 54, 93, 0.04);">
                <div class="d-flex align-items-center gap-3">
                  <span class="avatar avatar-md rounded-3" style="background: linear-gradient(135deg, #1e3a5f, #2c5282)">
                    <i class="ri-shield-user-line text-white fs-18"></i>
                  </span>
                  <div class="flex-fill min-width-0">
                    <span class="text-muted fs-12 d-block">Role</span>
                    <span class="fw-medium text-truncate d-block">{{ displayRole }}</span>
                  </div>
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
                    <span class="fw-medium text-truncate d-block">{{ joined }}</span>
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
/* Make entire content area fill viewport height */
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
</style>
