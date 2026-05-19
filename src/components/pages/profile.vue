<script setup>
import { computed, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { useProfileStore } from "../../stores/profile";

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

// Initialize profile data on mount
onMounted(async () => {
  await profileStore.switchUser();
});

// Computed display values from store
const displayName = computed(() => profileStore.displayName);
const displayEmail = computed(() => profileStore.displayEmail);
const displayJabatan = computed(() => profileStore.displayJabatan);
const displayRole = computed(() => profileStore.displayRole);
const displayRoleLabel = computed(() => formatRoleLabel(displayRole.value));
const displayPhone = computed(() => profileStore.displayPhone);
const displayLocation = computed(() => profileStore.displayLocation);
const displayJoined = computed(() => profileStore.displayJoined);
const displayPerusahaan = computed(() => profileStore.namaPerusahaan || 'Belum terkait');
const displaySubSektor = computed(() => profileStore.namaSubSektor || 'Belum terkait');

const toTitleCase = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatRoleLabel = (role) => {
  const normalized = String(role || "").trim();
  if (!normalized) return "Belum diatur";
  if (normalized.toLowerCase() === "user_pic") return "User PIC";
  return toTitleCase(normalized);
};

const getRoleBadgeClass = (role) => {
  const r = String(role || "").toLowerCase();
  if (r.includes("admin")) return "p-badge--role-red";
  if (r === "user") return "p-badge--role-green";
  if (r === "user_pic" || r === "pic") return "p-badge--role-orange";
  return "p-badge--role-sky";
};

// Account details grid
const accountDetails = computed(() => [
  { icon: 'ri-mail-line',        label: 'Email',           value: displayEmail.value,       colorClass: 'stat-icon-indigo', wrap: false },
  { icon: 'ri-phone-line',       label: 'Telepon',         value: displayPhone.value,       colorClass: 'stat-icon-violet', wrap: false, badge: 'Sinkron stakeholder' },
  { icon: 'ri-map-pin-line',     label: 'Lokasi',          value: displayLocation.value,    colorClass: 'stat-icon-amber',  wrap: true,  badge: 'Sinkron stakeholder' },
  { icon: 'ri-briefcase-line',   label: 'Jabatan',         value: displayJabatan.value,     colorClass: 'stat-icon-blue',   wrap: false },
  { icon: 'ri-building-line',    label: 'Perusahaan',      value: displayPerusahaan.value,  colorClass: 'stat-icon-amber',  wrap: true,  badge: 'Data registrasi' },
  { icon: 'ri-pie-chart-line',   label: 'Sektor',          value: displaySubSektor.value,   colorClass: 'stat-icon-blue',   wrap: true,  badge: 'Sinkron stakeholder' },
  { icon: 'ri-shield-user-line', label: 'Role',            value: displayRoleLabel.value,   colorClass: 'stat-icon-red',    wrap: false },
  { icon: 'ri-calendar-line',    label: 'Bergabung Sejak', value: displayJoined.value,      colorClass: 'stat-icon-teal',   wrap: false },
]);
</script>

<template>
  <div class="row profile-user-page">
    <div class="col-xl-12">
      <div class="card custom-card hero-card-shell mb-4 border-0 rounded-4 overflow-hidden stakeholder-profile-shell">
        <div
          class="profile-banner"
          :class="{ 'profile-banner-nophoto': !bannerUrl }"
          :style="bannerUrl ? {
            backgroundImage: `url(${bannerUrl})`,
            backgroundPosition: `${bannerPositionX ?? 50}% ${bannerPositionY ?? 50}%`
          } : {}"
        >
          <div class="profile-banner-overlay-premium">
            <div class="profile-banner-top">
              <div class="hero-text-block">
                <div class="premium-breadcrumb mb-1">
                  <span class="breadcrumb-item">PROFILE</span>
                  <span class="breadcrumb-sep"><i class="ri-arrow-right-s-line"></i></span>
                  <span class="breadcrumb-item active">DETAIL</span>
                </div>
                <h2 class="hero-main-title">Profil Saya</h2>
                <p class="hero-sub-title mb-0">Informasi akun dan data pribadi pengguna</p>
              </div>

              <div class="hero-action-tools">
                <router-link to="/profile-settings" class="btn-premium btn-premium--glass shadow-sm">
                  <i class="ri-pencil-fill me-1"></i>
                  <span>Edit Profil</span>
                </router-link>
              </div>
            </div>
          </div>
        </div>

        <div class="profile-content-body profile-content-body--premium">
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
            <h4 class="profile-user-name mb-2">{{ displayName }}</h4>
            <div class="profile-badges-row mb-3">
              <span :class="['p-badge p-badge--role', getRoleBadgeClass(displayRole)]">
                <i :class="(displayRole || '').toLowerCase() === 'admin' ? 'ri-shield-flash-line' : 'ri-user-6-line'"></i>
                {{ displayRoleLabel }}
              </span>
              <span class="p-badge p-badge--jabatan">
                <i class="ri-medal-line"></i>{{ displayJabatan }}
              </span>
              <span class="p-badge p-badge--company">
                <i class="ri-community-line"></i>{{ displayPerusahaan }}
              </span>
              <span class="p-badge p-badge--sector">
                <i class="ri-microscope-line"></i>{{ displaySubSektor }}
              </span>
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
                  <div class="form-item-icon" :class="item.colorClass" style="width:28px;height:28px">
                    <i :class="item.icon" style="font-size:0.85rem"></i>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <label class="form-item-label mb-0 text-uppercase fs-10 fw-bold text-muted">{{ item.label }}</label>
                    <span v-if="item.badge" class="badge-source-info">{{ item.badge }}</span>
                  </div>
                </div>
                <div class="form-group-split-input-card bg-light form-item-card--readonly">
                  <div class="form-item-value text-muted" :class="{ 'wrap-text': item.wrap }">{{ item.value }}</div>
                  <i class="ri-lock-line form-item-edit-action text-light-muted"></i>
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
