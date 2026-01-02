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
        <!-- Small Header Bar -->

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

            <!-- Stats -->
            <!-- <div class="d-none d-md-flex gap-4 stats-section">
              <div class="text-center stat-item">
                <h4 class="fw-bold mb-0 text-dark">
                  {{ profile.stats.projects }}
                </h4>
                <span class="text-muted fs-12">Projects</span>
              </div>
              <div class="text-center border-start border-end px-4 stat-item">
                <h4 class="fw-bold mb-0 text-dark">
                  {{ profile.stats.followers }}
                </h4>
                <span class="text-muted fs-12">Followers</span>
              </div>
              <div class="text-center stat-item">
                <h4 class="fw-bold mb-0 text-dark">
                  {{ profile.stats.following }}
                </h4>
                <span class="text-muted fs-12">Following</span>
              </div>
            </div> -->
          </div>

          <!-- Mobile Stats -->
          <!-- <div
            class="d-flex d-md-none justify-content-around py-3 mt-3 border-top border-bottom mobile-stats"
          >
            <div class="text-center">
              <h5 class="fw-bold mb-0 text-dark">
                {{ profile.stats.projects }}
              </h5>
              <span class="text-muted fs-12">Projects</span>
            </div>
            <div class="text-center">
              <h5 class="fw-bold mb-0 text-dark">
                {{ profile.stats.followers }}
              </h5>
              <span class="text-muted fs-12">Followers</span>
            </div>
            <div class="text-center">
              <h5 class="fw-bold mb-0 text-dark">
                {{ profile.stats.following }}
              </h5>
              <span class="text-muted fs-12">Following</span>
            </div>
          </div> -->
        </div>
      </div>

      <!-- Bio & About Section -->
      <!-- <div class="card custom-card bio-card mb-0 overflow-hidden">
        <div
          class="card-header d-flex align-items-center border-0"
          style="background: linear-gradient(90deg, #1e3a5f 0%, #2c5282 100%)"
        >
          <i class="ri-user-line text-white me-2"></i>
          <div class="card-title text-white mb-0">About</div>
        </div>
        <div
          class="card-body"
          style="
            background: linear-gradient(
              180deg,
              rgba(30, 58, 95, 0.05) 0%,
              rgba(255, 255, 255, 1) 50%
            );
          "
        >
          <p class="text-muted mb-0 lh-lg">{{ bio }}</p>
        </div>
      </div> -->

      <!-- Contact Information Cards -->
      <div class="row g-3 mt-3 mb-4">
        <div class="col-lg-6 col-md-6 col-12">
          <div class="card custom-card contact-card h-100">
            <div class="card-body d-flex align-items-center">
              <div class="d-flex align-items-center gap-3">
                <span class="avatar avatar-md rounded-3" style="background: linear-gradient(135deg, #1e3a5f, #2c5282)">
                  <i class="ri-mail-line text-white fs-18"></i>
                </span>
                <div>
                  <span class="text-muted fs-12 d-block">Email</span>
                  <span class="fw-medium">{{ displayEmail }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-6 col-md-6 col-12">
          <div class="card custom-card contact-card h-100">
            <div class="card-body d-flex align-items-center">
              <div class="d-flex align-items-center gap-3">
                <span class="avatar avatar-md rounded-3" style="background: linear-gradient(135deg, #2c5282, #3182ce)">
                  <i class="ri-phone-line text-white fs-18"></i>
                </span>
                <div>
                  <span class="text-muted fs-12 d-block">Phone</span>
                  <span class="fw-medium">{{ phone }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-6 col-md-6 col-12">
          <div class="card custom-card contact-card h-100">
            <div class="card-body d-flex align-items-center">
              <div class="d-flex align-items-center gap-3">
                <span class="avatar avatar-md rounded-3" style="background: linear-gradient(135deg, #1a365d, #2a4365)">
                  <i class="ri-map-pin-line text-white fs-18"></i>
                </span>
                <div>
                  <span class="text-muted fs-12 d-block">Location</span>
                  <span class="fw-medium">{{ location }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-6 col-md-6 col-12">
          <div class="card custom-card contact-card h-100">
            <div class="card-body d-flex align-items-center">
              <div class="d-flex align-items-center gap-3">
                <span class="avatar avatar-md rounded-3" style="background: linear-gradient(135deg, #2b6cb0, #4299e1)">
                  <i class="ri-calendar-line text-white fs-18"></i>
                </span>
                <div>
                  <span class="text-muted fs-12 d-block">Member Since</span>
                  <span class="fw-medium">{{ joined }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- <div class="card custom-card action-buttons-card">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-sm-4 col-12">
              <button class="btn btn-follow w-100 text-white fw-semibold py-2">
                <i class="ri-user-add-line me-1"></i>
                Follow
              </button>
            </div>
            <div class="col-sm-4 col-12">
              <button
                class="btn btn-outline-primary w-100 py-2 fw-semibold btn-message"
              >
                <i class="ri-message-3-line me-1"></i>
                Message
              </button>
            </div>
            <div class="col-sm-4 col-12">
              <button class="btn btn-outline-danger w-100 py-2 btn-like">
                <i class="ri-heart-line me-1"></i>
                Like
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-lg-4 col-md-6 col-12 mb-3 mb-lg-0">
          <div class="card custom-card quick-info-card h-100">
            <div class="card-body">
              <div
                class="d-flex align-items-center justify-content-between mb-3"
              >
                <span class="avatar avatar-md rounded-3 bg-warning-transparent">
                  <i class="ri-award-line fs-20 text-warning"></i>
                </span>
                <span class="badge bg-light text-muted fs-10 fw-semibold"
                  >ACHIEVEMENT</span
                >
              </div>
              <h5 class="fw-bold mb-1 text-dark">Top Contributor</h5>
              <span class="text-muted fs-13">2024 Q1</span>
            </div>
          </div>
        </div>

        <div class="col-lg-4 col-md-6 col-12 mb-3 mb-lg-0">
          <div class="card custom-card quick-info-card h-100">
            <div class="card-body">
              <div
                class="d-flex align-items-center justify-content-between mb-3"
              >
                <span class="avatar avatar-md rounded-3 bg-info-transparent">
                  <i class="ri-briefcase-line fs-20 text-info"></i>
                </span>
                <span class="badge bg-light text-muted fs-10 fw-semibold"
                  >EXPERIENCE</span
                >
              </div>
              <h5 class="fw-bold mb-1 text-dark">5+ Years</h5>
              <span class="text-muted fs-13">Product Design</span>
            </div>
          </div>
        </div>

        <div class="col-lg-4 col-md-12 col-12">
          <div class="card custom-card quick-info-card h-100">
            <div class="card-body">
              <div
                class="d-flex align-items-center justify-content-between mb-3"
              >
                <span class="avatar avatar-md rounded-3 bg-danger-transparent">
                  <i class="ri-heart-line fs-20 text-danger"></i>
                </span>
                <span class="badge bg-light text-muted fs-10 fw-semibold"
                  >LIKES</span
                >
              </div>
              <h5 class="fw-bold mb-1 text-dark">8.5K</h5>
              <span class="text-muted fs-13">Total Reactions</span>
            </div>
          </div>
        </div>
      </div> -->
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
</style>
