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
  <Pageheader :propData="dataToPass" />

  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card gradient-header-card">
        <!-- Page Header -->
        <div class="card-header d-flex align-items-center justify-content-between gap-3 users-header">
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

        <div class="card-body p-4">
          <!-- HERO CARD -->
          <div class="card custom-card hero-card-shell mb-4">
            <div
              class="profile-banner"
              :class="{ 'profile-banner-nophoto': !bannerUrl }"
              :style="bannerUrl ? {
                backgroundImage: `url(${bannerUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: `${bannerPositionX ?? 50}% ${bannerPositionY ?? 50}%`,
                backgroundRepeat: 'no-repeat'
              } : {}"
            ></div>

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
                <p class="profile-email-text mb-0">
                  <i class="ri-mail-line me-2 text-primary"></i>{{ displayEmail }}
                </p>
               <div class="profile-email-text d-flex gap-3">
                <span><i class="ri-phone-line me-2 text-primary"></i>{{ displayPhone }}</span>
                <span><i class="ri-map-pin-line me-2 text-primary"></i>{{ displayLocation }}</span>
            </div>
              </div>
            </div>
          </div>

          <!-- INFORMASI AKUN -->
          <div class="card custom-card mb-0">
            <div class="card-header d-flex align-items-center gap-3 bg-white border-bottom">
              <div class="d-flex align-items-center gap-2">
                <div class="card-title mb-0 fw-semibold text-dark">Informasi Akun</div>
              </div>
            </div>
            <div class="card-body">
              <div class="info-grid">
                <div v-for="(item, idx) in accountDetails" :key="idx" class="info-grid-item">
                  <div class="info-grid-icon" :class="item.colorClass">
                    <i :class="item.icon"></i>
                  </div>
                  <div style="min-width:0;flex:1">
                    <div class="info-grid-label">{{ item.label }}</div>
                    <div class="info-grid-value" :class="{ 'wrap-text': item.wrap }">{{ item.value }}</div>
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

<!-- All profile styles live in src/assets/css/style2.css -->