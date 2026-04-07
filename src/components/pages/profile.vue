<script setup>
import { computed, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { useProfileStore } from "../../stores/profile";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";

// Profile store
const profileStore = useProfileStore();

// Use storeToRefs for reactive state
const {
  location,
  phone,
  bio,
  stats,
  fotoProfileUrl,
  bannerUrl,
  bannerPositionX,
  bannerPositionY,
  fotoProfilePositionX,
  fotoProfilePositionY,
  name,
  title,
  role,
  email,
  website,
  address,
  namaPerusahaan,
  namaSubSektor,
  isLoading,
} = storeToRefs(profileStore);

const dataToPass = {
  title: { label: "Dashboards", path: "/dashboards" },
  currentpage: "Profile",
  activepage: "Profile",
};

// Initialize profile data on mount
onMounted(async () => {
  await profileStore.switchUser();
});

// Computed display values from store
const displayName = computed(() => profileStore.displayName);
const displayEmail = computed(() => profileStore.displayEmail);
const displayJabatan = computed(() => profileStore.displayJabatan);
const displayRole = computed(() => profileStore.displayRole);
const displayPhone = computed(() => profileStore.displayPhone);
const displayLocation = computed(() => profileStore.displayLocation);
const displayJoined = computed(() => profileStore.displayJoined);
const displayPerusahaan = computed(() => profileStore.namaPerusahaan || 'Belum terkait');
const displaySubSektor = computed(() => profileStore.namaSubSektor || 'Belum terkait');

// Account details grid
const accountDetails = computed(() => [
  { icon: 'ri-mail-line',        label: 'Email',           value: displayEmail.value,       colorClass: 'stat-icon-teal',   wrap: false },
  { icon: 'ri-phone-line',       label: 'Telepon',         value: displayPhone.value,       colorClass: 'stat-icon-violet', wrap: false },
  { icon: 'ri-map-pin-line',     label: 'Lokasi',          value: displayLocation.value,    colorClass: 'stat-icon-amber',  wrap: true  },
  { icon: 'ri-briefcase-line',   label: 'Jabatan',         value: displayJabatan.value,     colorClass: 'stat-icon-blue',   wrap: false },
  { icon: 'ri-building-line',    label: 'Perusahaan',      value: displayPerusahaan.value,  colorClass: 'stat-icon-amber',  wrap: true  },
  { icon: 'ri-shield-user-line', label: 'Role',            value: displayRole.value,        colorClass: 'stat-icon-red',    wrap: false },
  { icon: 'ri-calendar-line',    label: 'Bergabung Sejak', value: displayJoined.value,      colorClass: 'stat-icon-teal',   wrap: false },
]);
</script>

<template>
  <div class="row">
    <div class="col-xxl-9 col-xl-10 col-lg-12 mx-auto">
      <Pageheader :propData="dataToPass" />

      <!-- HEADER BAR -->
      <div class="card custom-card gradient-header-card mb-4 shadow-sm border-0">
        <div class="card-header d-flex align-items-center justify-content-between gap-3 users-header border-bottom-0 pb-3 pt-3">
          <div class="d-flex align-items-center gap-3">
            <div class="header-icon-box">
              <i class="ri-account-circle-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">
                {{ displayName || 'Profil Saya' }}
              </div>
              <div class="header-subtitle mt-1">Informasi akun & data pribadi</div>
            </div>
          </div>
          <router-link to="/profile-settings" class="btn-edit-profile">
            <i class="ri-edit-2-line"></i>
            <span class="d-none d-sm-inline">Edit Profil</span>
          </router-link>
        </div>
      </div>

      <!-- HERO CARD -->
      <div class="card custom-card hero-card-shell mb-4 shadow-sm border-0 rounded-4 overflow-hidden">
        <!-- Banner Image -->
        <div
          class="profile-banner"
          :class="{ 'profile-banner-nophoto': !bannerUrl }"
          :style="bannerUrl ? {
            backgroundImage: `url(${bannerUrl})`,
            backgroundPosition: `${bannerPositionX ?? 50}% ${bannerPositionY ?? 50}%`
          } : {}"
        >
        </div>

        <!-- Profile Content Body -->
        <div class="profile-content-body">
          <div class="profile-foto-profile-container">
            <div class="profile-foto-profile-wrap">
              <img
                :src="fotoProfileUrl"
                alt="Profile Foto"
                class="profile-foto-profile-img"
                :style="{ objectPosition: `${fotoProfilePositionX ?? 50}% ${fotoProfilePositionY ?? 50}%` }"
              />
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
              <span class="contact-bar-sep-inline d-none d-sm-inline"></span>
              <span><i class="ri-map-pin-line me-1"></i>{{ displayLocation }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- INFORMASI AKUN -->
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
            <!-- Iterate accountDetails for consistent structure -->
            <div v-for="(item, idx) in accountDetails" :key="idx" class="col-xl-6 col-lg-6 col-md-6">
              <div class="form-group-split">
                <div class="form-group-split-label-card">
                  <div class="form-item-icon" :class="item.colorClass" style="width:32px;height:32px">
                    <i :class="item.icon" style="font-size:0.95rem"></i>
                  </div>
                  <label class="form-item-label mb-0">{{ item.label }}</label>
                </div>
                <div class="form-group-split-input-card form-item-card--readonly">
                  <div class="form-item-value" :class="{ 'wrap-text': item.wrap }">{{ item.value }}</div>
                  <i class="ri-lock-2-line form-item-edit-action" style="color: #cbd5e1; opacity: 1;"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<!-- All profile styles live in src/assets/css/style2.css -->