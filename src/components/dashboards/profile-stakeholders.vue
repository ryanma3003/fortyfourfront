<script setup lang="ts">
// Import Vue FilePond
import vueFilePond from "vue-filepond";
import { useRoute } from "vue-router";
import { stakeholdersData } from "../../data/dummydata.ts";
import type { Stakeholder } from "../../data/dummydata.ts";
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
  return stakeholdersData.find((sh) => sh.slug === stakeholderSlug.value);
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
    (c) => c.id_perusahaan === currentStakeholder.value?.id
  );
  return csirt ? csirt.id : null;
});

const dataToPass = computed(() => ({
  currentpage: `Profile ${
    currentStakeholder.value?.nama_perusahaan || "Stakeholder"
  }`,
  title: { label: "Stakeholders", path: "/stakeholders" },
  activepage:
    currentStakeholder.value?.nama_perusahaan || "Profile Stakeholder",
}));
</script>

<style scoped>
/* Profile Card Styles */
.profile-card {
  overflow: visible;
}

.profile-banner-image {
  height: 400px;
  overflow: hidden;
}

.profile-banner-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pic-item:hover {
  background-color: #f9fafb;
  border-radius: 6px;
}

/* Responsive - Tablet (768px - 991px) */
@media (max-width: 991px) {
  .profile-banner-image {
    height: 220px;
  }
}

/* Responsive - Mobile (576px - 767px) */
@media (max-width: 767px) {
  .profile-banner-image {
    height: 180px;
  }
}

/* Responsive - Small Mobile (< 576px) */
@media (max-width: 575px) {
  .profile-banner-image {
    height: 150px;
  }
}
</style>

<template>
  <Pageheader :propData="dataToPass" />
  <!-- Start:: row-1 -->
  <div class="row justify-content-center">
    <div class="col-xl-10">
      <!-- Error handling jika stakeholder tidak ditemukan -->
      <div
        v-if="!currentStakeholder"
        class="alert alert-warning alert-dismissible fade show"
        role="alert"
      >
        <strong>Oops!</strong> Data stakeholder tidak ditemukan.
        <button
          type="button"
          class="btn-close"
          data-bs-dismiss="alert"
          aria-label="Close"
        ></button>
      </div>

      <!-- Content jika stakeholder ditemukan -->
      <template v-else>
        <div class="row">
          <div class="col-xl-12">
            <div class="card custom-card profile-card">
              <div class="profile-banner-image">
                <img
                  :src="currentStakeholder.photo"
                  class="card-img-top"
                  alt="foto-perusahaan"
                />
              </div>
              <div class="card-body p-4 pb-0 position-relative">
                <div
                  class="d-flex align-items-end justify-content-between flex-wrap"
                >
                  <div class="profile-avatar-container">
                    <div
                      class="mt-4 mb-3 d-flex align-items-center flex-wrap gap-3 justify-content-between"
                    >
                      <div>
                        <h1
                          class="fw-semibold"
                          style="margin-top: -1.75rem !important"
                        >
                          {{ currentStakeholder.nama_perusahaan }}
                        </h1>
                        <span class="d-block fw-medium text-muted mb-1">{{
                          currentStakeholder.sektor
                        }}</span>
                        <p class="fs-12 mb-0 fw-medium text-muted">
                          <span class="me-3"
                            ><i class="ri-building-line me-1 align-middle"></i
                            >{{ currentStakeholder.alamat }}</span
                          >
                          <span class="me-3"
                            ><i class="ri-phone-line me-1 align-middle"></i
                            >{{ currentStakeholder.telepon }}</span
                          >
                          <span
                            ><i class="ri-mail-line me-1 align-middle"></i
                            >{{ currentStakeholder.email }}</span
                          >
                        </p>
                      </div>
                    </div>
                  </div>
                  <router-link
                    v-if="isAdmin"
                    :to="`/stakeholders-profile-settings?slug=${currentStakeholder.slug}`"
                    class="btn btn-warning d-flex align-items-start mb-5 gap-2"
                    ><i class="ri-edit-line"></i
                    ><span>Edit Profil</span></router-link
                  >
                  <!-- <router-link :to="`/pages/profile-settings`" class="btn btn-primary mb-3">Edit Profile</router-link> -->
                </div>
              </div>
            </div>
          </div>
          <div class="col-xl-12">
            <div class="tab-content" id="profile-tabs">
              <div
                class="tab-pane show active p-0 border-0"
                id="profile-about-tab-pane"
                role="tabpanel"
                aria-labelledby="profile-about-tab"
                tabindex="0"
              >
                <div class="row">
                  <SpkReusableAnlyticsCard
                    :analyticData="penilaian"
                    :csirtId="relatedCsirtId"
                  />
                  <div class="col-xl-12">
                    <div class="card custom-card">
                      <div
                        class="card-header d-flex align-items-center justify-content-between"
                      >
                        <div class="card-title">PIC Perusahaan</div>
                        <router-link
                          v-if="isAdmin"
                          to="/pic-add"
                          class="btn btn-warning d-flex align-items-start gap-2"
                          ><i class="ri-add-line"></i
                          ><span>Add PIC</span></router-link
                        >
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
                    <div class="card custom-card">
                      <div class="card-header">
                        <div class="card-title">Tentang Perusahaan</div>
                      </div>
                      <div class="card-body">
                        <p class="text-muted">
                          Informasi lengkap tentang
                          {{ currentStakeholder.nama_perusahaan }}, perusahaan
                          yang bergerak di bidang
                          {{ currentStakeholder.sektor }}.
                        </p>
                        <div class="text-muted">
                          <div
                            class="mb-2 d-flex align-items-center gap-1 flex-wrap"
                          >
                            <span
                              class="avatar avatar-sm avatar-rounded text-default"
                            >
                              <i class="ri-mail-line align-middle fs-15"></i>
                            </span>
                            <span class="fw-medium text-default">Email : </span>
                            {{ currentStakeholder.email }}
                          </div>
                          <div
                            class="mb-2 d-flex align-items-center gap-1 flex-wrap"
                          >
                            <span
                              class="avatar avatar-sm avatar-rounded text-default"
                            >
                              <i class="ri-phone-line align-middle fs-15"></i>
                            </span>
                            <span class="fw-medium text-default"
                              >Telepon :
                            </span>
                            {{ currentStakeholder.telepon }}
                          </div>
                          <div
                            class="mb-2 d-flex align-items-center gap-1 flex-wrap"
                          >
                            <span
                              class="avatar avatar-sm avatar-rounded text-default"
                            >
                              <i class="ri-map-pin-line align-middle fs-15"></i>
                            </span>
                            <span class="fw-medium text-default"
                              >Website :
                            </span>
                            <a
                              :href="currentStakeholder.website"
                              target="_blank"
                              >{{ currentStakeholder.website }}</a
                            >
                          </div>
                          <div class="mb-0 d-flex align-items-center gap-1">
                            <span
                              class="avatar avatar-sm avatar-rounded text-default"
                            >
                              <i
                                class="ri-building-line align-middle fs-15"
                              ></i>
                            </span>
                            <span class="fw-medium text-default"
                              >Lokasi :
                            </span>
                            {{ currentStakeholder.alamat }}
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
  <!-- End:: row-1 -->
</template>

<style scoped>
/* Add your styles here */
</style>
