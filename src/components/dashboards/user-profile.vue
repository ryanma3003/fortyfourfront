<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useProfileStore } from "../../stores/profile";
import { useAuthStore } from "../../stores/auth";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import users from "../../utils/users.json";

interface User {
  id: number;
  slug: string;
  username: string;
  password: string;
  name: string;
  jabatan: string;
  role: string;
  phone: string;
  location: string;
  joined: string;
  token: string;
}

const route = useRoute();
const router = useRouter();
const profileStore = useProfileStore();
const authStore = useAuthStore();

// Reactive user data
const user = ref<User | null>(null);
const loading = ref(true);
const isCurrentUser = ref(false);

// Get slug from route params
const slug = computed(() => route.params.slug as string);

// Load user data based on slug
const loadUser = () => {
  loading.value = true;

  // Find user from users.json
  const foundUser = users.find((u: User) => u.slug === slug.value);

  if (foundUser) {
    user.value = foundUser;

    // Check if this is the currently logged-in user
    if (
      authStore.currentUser &&
      authStore.currentUser.username === foundUser.username
    ) {
      isCurrentUser.value = true;
      // Load profile data from store for current user
      profileStore.loadFromStorage();
      profileStore.initFromAuth();
    } else {
      isCurrentUser.value = false;
    }
  } else {
    // Redirect to users-list if user not found
    router.push("/users-list");
  }
  loading.value = false;
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
    return profileStore.joined;
  }
  return user.value?.joined || "";
});

const displayAvatar = computed(() => {
  if (isCurrentUser.value) {
    return profileStore.avatarUrl;
  }
  return "/images/faces/15.jpg";
});

const displayBanner = computed(() => {
  if (isCurrentUser.value) {
    return profileStore.bannerUrl;
  }
  return "/images/media/media-21.jpg";
});
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
        <div
          class="profile-header-banner position-relative"
          :style="{
            backgroundImage: `url(${displayBanner})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '180px',
          }"
        >
          <!-- Overlay for better contrast -->
          <div
            class="position-absolute w-100 h-100"
            style="
              background: linear-gradient(
                to bottom,
                rgba(30, 58, 95, 0.3) 0%,
                rgba(26, 54, 93, 0.1) 100%
              );
            "
          ></div>
          <div class="position-absolute top-0 end-0 p-3 p-md-4">
            <!-- <router-link
              v-if="isCurrentUser"
              to="/profile-settings"
              class="btn btn-light btn-sm rounded-pill shadow-sm d-flex align-items-center gap-2"
            >
              <i class="ri-edit-2-line"></i>
              <span class="d-none d-sm-inline">Edit Profile</span>
            </router-link> -->
            <router-link
              to="/users-list"
              class="btn btn-light btn-sm rounded-pill shadow-sm d-flex align-items-center gap-2"
            >
              <i class="ri-arrow-left-line"></i>
              <span class="d-none d-sm-inline">Kembali</span>
            </router-link>
          </div>
        </div>

        <!-- Profile Content -->
        <div class="card-body p-3 p-md-4 pb-4 position-relative">
          <!-- Avatar Section -->
          <div
            class="d-flex align-items-end justify-content-between flex-wrap gap-3"
            style="margin-top: -70px"
          >
            <div class="d-flex align-items-end gap-3 flex-wrap">
              <!-- Avatar with Online Status -->
              <div class="position-relative">
                <div class="avatar-container">
                  <span
                    class="avatar avatar-xxl avatar-rounded shadow-lg border border-4 border-white overflow-hidden"
                  >
                    <img :src="displayAvatar" alt="Profile Avatar" />
                  </span>
                </div>
              </div>

              <!-- Name & Title -->
              <div class="pb-2 mt-2 mt-md-5">
                <h4 class="fw-bold mb-1 text-dark profile-name">
                  {{ displayName }}
                </h4>
                <p
                  class="text-primary-dark fw-medium mb-1 d-flex align-items-center gap-1"
                >
                  <i class="ri-user-line"></i>{{ displayRole }}
                </p>
                <p
                  class="text-primary-dark fw-medium mb-1 d-flex align-items-center gap-1"
                >
                  <i class="ri-briefcase-line"></i>{{ displayJabatan }}
                </p>
                <p
                  class="text-black fs-13 mb-2 d-flex align-items-center gap-1"
                >
                  <i class="ri-mail-line"></i>{{ displayEmail }}
                </p>
                <p class="fs-12 mb-0 mt-1">
                  <span class="me-3"
                    ><i class="ri-phone-line me-1"></i>{{ displayPhone }}</span
                  >
                  <span
                    ><i class="ri-map-pin-line me-1"></i
                    >{{ displayLocation }}</span
                  >
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Contact Information Cards -->
      <div class="row g-3 mt-3 mb-4">
        <div class="col-lg-6 col-md-6 col-12">
          <div class="card custom-card contact-card h-100">
            <div class="card-body d-flex align-items-center">
              <div class="d-flex align-items-center gap-3">
                <span
                  class="avatar avatar-md rounded-3"
                  style="background: linear-gradient(135deg, #1e3a5f, #2c5282)"
                >
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
                <span
                  class="avatar avatar-md rounded-3"
                  style="background: linear-gradient(135deg, #2c5282, #3182ce)"
                >
                  <i class="ri-phone-line text-white fs-18"></i>
                </span>
                <div>
                  <span class="text-muted fs-12 d-block">Phone</span>
                  <span class="fw-medium">{{ displayPhone }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-6 col-md-6 col-12">
          <div class="card custom-card contact-card h-100">
            <div class="card-body d-flex align-items-center">
              <div class="d-flex align-items-center gap-3">
                <span
                  class="avatar avatar-md rounded-3"
                  style="background: linear-gradient(135deg, #1a365d, #2a4365)"
                >
                  <i class="ri-map-pin-line text-white fs-18"></i>
                </span>
                <div>
                  <span class="text-muted fs-12 d-block">Location</span>
                  <span class="fw-medium">{{ displayLocation }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-6 col-md-6 col-12">
          <div class="card custom-card contact-card h-100">
            <div class="card-body d-flex align-items-center">
              <div class="d-flex align-items-center gap-3">
                <span
                  class="avatar avatar-md rounded-3"
                  style="background: linear-gradient(135deg, #2b6cb0, #4299e1)"
                >
                  <i class="ri-calendar-line text-white fs-18"></i>
                </span>
                <div>
                  <span class="text-muted fs-12 d-block">Member Since</span>
                  <span class="fw-medium">{{ displayJoined }}</span>
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
