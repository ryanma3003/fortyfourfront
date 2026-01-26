<script setup lang="ts">
// Import Vue FilePond
import vueFilePond from "vue-filepond";
import { useRoute } from "vue-router";
import { useStakeholdersStore } from "../../stores/stakeholders";
import type { Stakeholder } from "../../types/stakeholders.types";
import type { Penilaian } from "../../data/dashboards/dummyDataPercentage";
import { stakeholderPenilaian } from "../../data/dashboards/dummyDataPercentage";
import { computed, ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { FriendsList } from "../../data/pages/profiledata";
import { csirtMembersData } from "../../data/pages/csirt";
import { useAuthStore } from "../../stores/auth";

const authStore = useAuthStore();
const isAdmin = computed(() => authStore.isAdmin);

// Import FilePond styles
import "filepond/dist/filepond.min.css";

// Import image preview plugin styles
import "filepond-plugin-image-preview/dist/filepond-plugin-image-preview.min.css";

// Import image preview and file type validation plugins
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type";
import FilePondPluginImagePreview from "filepond-plugin-image-preview";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import SpkReusableAnlyticsCard from "../../shared/components/@spk/dashboards/spk-reusable-anlyticsStakeholder.vue";

const router = useRouter();
const stakeholdersStore = useStakeholdersStore();

// Create component
const FilePond = vueFilePond(
  FilePondPluginFileValidateType,
  FilePondPluginImagePreview
);

const friends = ref(FriendsList);

const editPIC = (index: number) => {
  router.push({
    path: "/pic-add",
    query: { index },
  });
};

const deletePIC = (index: number) => {
  if (!confirm("Yakin ingin menghapus PIC ini?")) return;

  // 🔥 HAPUS DARI SOURCE OF TRUTH
  friends.value.splice(index, 1);
};

const route = useRoute();
let myFiles = [];

const stakeholderSlug = computed(() => route.params.slug as string);

// Cari stakeholder berdasarkan slug
const currentStakeholder = computed<Stakeholder | undefined>(() => {
  return stakeholdersStore.getStakeholderBySlug(stakeholderSlug.value);
});

onMounted(async () => {
    if (!stakeholdersStore.initialized) {
        await stakeholdersStore.initialize();
    }
});

// Cari penilaian berdasarkan slug
const penilaian = computed<Penilaian[]>(() => {
  const found = stakeholderPenilaian.find(
    (sp) => sp.slug === stakeholderSlug.value
  );
  return found ? found.penilaian : [];
});

const relatedCsirtId = computed(() => {
  if (!currentStakeholder.value) return null;
  const csirt = csirtMembersData.find(
    (c) => c.id_perusahaan === Number(currentStakeholder.value?.id) || c.id_perusahaan === (currentStakeholder.value?.id as any)
  );
  return csirt ? csirt.id : null;
});

const dataToPass = computed(() => ({
  currentpage: "Profile Stakeholders",
  title: { label: "Stakeholders", path: "/stakeholders" },
  activepage: "Profile Stakeholder",
}));

// Computed for dynamic banner style with photo position
const bannerStyle = computed(() => {
  if (!currentStakeholder.value) return {};
  const stakeholder = currentStakeholder.value as any;
  return {
    backgroundImage: `url(${stakeholder.photo})`,
    backgroundSize: 'cover',
    backgroundPosition: `${stakeholder.photoPositionX ?? 50}% ${stakeholder.photoPositionY ?? 50}%`,
    backgroundRepeat: 'no-repeat'
  };
});
</script>

<style scoped>
/* Profile Card Styles */
.profile-card {
  overflow: visible;
  border: none;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.profile-banner-image {
  height: 400px;
  overflow: hidden;
  border-radius: 0.75rem 0.75rem 0 0;
  position: relative;
}

.profile-banner-image::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
  z-index: 1;
}

.enhanced-card {
  border: none;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}

.enhanced-card .card-header {
  background: linear-gradient(90deg, #1e3a5f 0%, #2c5282 100%);
  color: white;
  padding: 1.25rem 1.5rem;
  border: none;
}

.enhanced-card .card-title {
  font-weight: 700;
  font-size: 1.25rem;
  margin: 0;
  letter-spacing: -0.3px;
}

.btn-add-pic {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 0.5rem 1.25rem;
  border-radius: 50px;
  font-weight: 600;
}

.about-card {
  border: none;
  border-radius: 1rem;
  overflow: hidden;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}

.about-card .card-header {
  background: linear-gradient(90deg, #1e3a5f 0%, #2c5282 100%);
  color: white;
  padding: 1.25rem 1.5rem;
  border: none;
}

.info-detail-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: white;
  border-radius: 12px;
  margin-bottom: 0.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.info-detail-item .avatar {
  background: linear-gradient(90deg, #1e3a5f 0%, #2c5282 100%);
  color: white;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  flex-shrink: 0;
}

.info-detail-item .fw-medium {
  font-weight: 700;
  color: #1e3a5f;
  min-width: 80px;
}

/* Responsive - Tablet (768px - 991px) */
@media (max-width: 991px) {
  .profile-banner-image {
    height: 220px;
  }
  
  .company-name {
    font-size: 2rem;
  }
}

/* Responsive - Mobile (576px - 767px) */
@media (max-width: 767px) {
  .profile-banner-image {
    height: 180px;
  }
  
  .company-name {
    font-size: 1.75rem;
  }
}

/* Responsive - Small Mobile (< 576px) */
@media (max-width: 575px) {
  .profile-banner-image {
    height: 150px;
  }
  
  .company-name {
    font-size: 1.5rem;
  }
  
  .info-item {
    font-size: 0.75rem;
    padding: 0.375rem 0.75rem;
  }
}

/* Dark Mode Specific Styles */
html[data-theme-mode="dark"] .card-header[style*="gradient"] .card-title,
html[data-theme-mode="dark"] .card-header[style*="gradient"] i,
html.dark .card-header[style*="gradient"] .card-title,
html.dark .card-header[style*="gradient"] i {
  color: rgb(0, 0, 0) !important;
}

html[data-theme-mode="dark"] .enhanced-card .card-header,
html.dark .enhanced-card .card-header {
  color: rgb(0, 0, 0) !important;
}

html[data-theme-mode="dark"] .enhanced-card .card-title,
html.dark .enhanced-card .card-title {
  color: rgb(0, 0, 0) !important;
}

html[data-theme-mode="dark"] .about-card .card-header,
html.dark .about-card .card-header {
  color: rgb(0, 0, 0) !important;
}

html[data-theme-mode="dark"] .about-card .card-title,
html.dark .about-card .card-title {
  color: rgb(0, 0, 0) !important;
}

html[data-theme-mode="dark"] .text-black,
html.dark .text-black {
  color: #e2e8f0 !important;
}

html[data-theme-mode="dark"] .text-dark,
html.dark .text-dark {
  color: #e2e8f0 !important;
}

html[data-theme-mode="dark"] .text-muted,
html.dark .text-muted {
  color: #a0aec0 !important;
}

html[data-theme-mode="dark"] .table thead th,
html.dark .table thead th {
  color: #e2e8f0 !important;
}

html[data-theme-mode="dark"] .fw-semibold,
html.dark .fw-semibold {
  color: inherit !important;
}

html[data-theme-mode="dark"] .about-card,
html.dark .about-card {
  background: #1a202c !important;
}

html[data-theme-mode="dark"] .about-card .card-body,
html.dark .about-card .card-body {
  background: #1a202c !important;
}

html[data-theme-mode="dark"] .info-detail-item,
html.dark .info-detail-item {
  background: #2d3748 !important;
}

html[data-theme-mode="dark"] .info-detail-item .fw-medium,
html.dark .info-detail-item .fw-medium {
  color: #cbd5e0 !important;
}
</style>

<template>
  <Pageheader :propData="dataToPass" />
  <!-- Start:: row-1 -->
  <div class="row">
    <div class="col-xl-12">
      <!-- Outer wrapper card with "Profile Stakeholders" title -->
      <div class="card custom-card gradient-header-card">
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3" 
            style="background: radial-gradient(ellipse at top, #032a5c, #084696)">
          <div class="d-flex align-items-center">
            <i class="ri-building-2-line me-2 fs-18" style="color: white !important;"></i>
            <div class="card-title mb-0" style="color: white !important;">{{ currentStakeholder?.nama_perusahaan || 'Stakeholder' }}</div>
          </div>
        </div>

        <div class="card-body p-4">
          <!-- Error handling jika stakeholder tidak ditemukan -->
          <div v-if="!currentStakeholder" class="alert alert-warning alert-dismissible fade show" role="alert">
            <strong>Oops!</strong> Data stakeholder tidak ditemukan.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          </div>

      <!-- Content jika stakeholder ditemukan -->
      <template v-else>
        <div class="row">
          <div class="col-xl-12">
            <div class="card custom-card profile-card">
              <div 
                class="profile-banner-image"
                :style="bannerStyle"
              ></div>
              <div class="card-body p-4 pb-0 position-relative">
                <div class="d-flex align-items-end justify-content-between flex-wrap">
                  <div class="profile-avatar-container">
                    <div class="mt-4 mb-3 d-flex align-items-center flex-wrap gap-3 justify-content-between">
                      <div>
                        <h1 class="fw-semibold" style="margin-top: -1.75rem !important">{{ currentStakeholder.nama_perusahaan }}</h1>
                        <span class="d-block fw-medium text-black fs-18 mb-2">{{ currentStakeholder.sektor }}</span>
                        <p class="fs-12 mb-0 fw-medium text-black">
                          <span class="me-3">
                            <i class="ri-building-line me-1 align-middle"></i>{{ currentStakeholder.alamat }}</span>
                          <span class="me-3">
                            <i class="ri-phone-line me-1 align-middle"></i>{{ currentStakeholder.telepon }}</span>
                          <span>
                            <i class="ri-mail-line me-1 align-middle"></i>{{ currentStakeholder.email }}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <router-link v-if="isAdmin" :to="`/stakeholders-profile-settings?slug=${currentStakeholder.slug}`" class="btn btn-warning d-flex align-items-start mb-5 gap-2"><i class="ri-edit-line"></i><span>Edit Profil</span></router-link>
                </div>
              </div>
            </div>
          </div>
          <div class="col-xl-12">
            <div class="tab-content" id="profile-tabs">
              <div class="tab-pane show active p-0 border-0" id="profile-about-tab-pane" role="tabpanel" aria-labelledby="profile-about-tab" tabindex="0">
                <div class="row">
                  <SpkReusableAnlyticsCard :analyticData="penilaian" :csirtId="relatedCsirtId" :stakeholderSlug="currentStakeholder.slug" />
                  <div class="col-xl-12">
                    <div class="card custom-card enhanced-card">
                      <div class="card-header d-flex align-items-center justify-content-between" 
                          style="background: radial-gradient(ellipse at top, #032a5c, #084696)">
                        <div class="card-title" style="color: white !important;">PIC Perusahaan</div>
                        <router-link v-if="isAdmin" to="/pic-add" class="btn btn-add-pic d-flex align-items-center gap-2">
                          <i class="ri-add-line"></i>
                          <span>Add PIC</span>
                        </router-link>
                      </div>
                      <div class="card-body p-0">
                        <div class="table-responsive">
                          <table class="table text-nowrap">
                            <thead>
                              <tr>
                                <th>No</th>
                                <th>Nama</th>
                                <th>Telepon</th>
                                <th v-if="isAdmin" class="text-center">Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-if="!friends.length">
                                <td colspan="4" class="text-center text-muted py-4">
                                  <i class="ri-inbox-line fs-2 d-block mb-2"></i>
                                  Data tidak ditemukan
                                </td>
                              </tr>
                              <tr v-for="(idx, index) in friends" :key="index">
                                <td>{{ index + 1 }}</td>
                                <td class="fw-semibold">{{ idx.name }}</td>
                                <td>
                                  <span class="text-muted fs-13">
                                    <i class="ri-phone-line align-middle fs-15 me-1"></i>
                                    {{ idx.telepon }}
                                  </span>
                                </td>
                                <td v-if="isAdmin" class="text-center">
                                  <div class="btn btn-sm gap-2 d-flex justify-content-center">
                                    <button @click="editPIC(index)" class="btn btn-sm btn-info-light" title="Edit">
                                      <i class="ri-edit-line"></i>
                                    </button>
                                    <button @click="deletePIC(index)" class="btn btn-sm btn-danger-light" title="Delete">
                                      <i class="ri-delete-bin-line"></i>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="col-xl-12">
                    <div class="card custom-card about-card">
                      <div class="card-header" style="background: radial-gradient(ellipse at top, #032a5c, #084696)">
                        <div class="card-title" style="color: white !important;">Tentang Perusahaan</div>
                      </div>
                      <div class="card-body">
                        <p class="text-dark fw-medium mb-4">
                          Informasi lengkap tentang
                          {{ currentStakeholder.nama_perusahaan }}, perusahaan
                          yang bergerak di bidang
                          {{ currentStakeholder.sektor }}.
                        </p>
                        <div>
                          <div class="info-detail-item">
                            <span class="avatar avatar-sm avatar-rounded">
                              <i class="ri-mail-line align-middle fs-15"></i>
                            </span>
                            <span class="fw-medium">Email :</span>
                            <span class="text-dark">{{ currentStakeholder.email }}</span>
                          </div>
                          <div class="info-detail-item">
                            <span class="avatar avatar-sm avatar-rounded">
                              <i class="ri-phone-line align-middle fs-15"></i>
                            </span>
                            <span class="fw-medium">Telepon :</span>
                            <span class="text-dark">{{ currentStakeholder.telepon }}</span>
                          </div>
                          <div class="info-detail-item">
                            <span class="avatar avatar-sm avatar-rounded">
                              <i class="ri-map-pin-line align-middle fs-15"></i>
                            </span>
                            <span class="fw-medium">Website :</span>
                            <a :href="currentStakeholder.website" target="_blank" class="text-primary fw-semibold">{{ currentStakeholder.website }}</a>
                          </div>
                          <div class="info-detail-item">
                            <span class="avatar avatar-sm avatar-rounded">
                              <i class="ri-building-line align-middle fs-15"></i>
                            </span>
                            <span class="fw-medium">Lokasi :</span>
                            <span class="text-dark">{{ currentStakeholder.alamat }}</span>
                          </div>
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
        </div>
      </div>
    </div>
  </div>
  <!-- End:: row-1 -->
</template>

<style scoped>
/* Add your styles here */
</style>
