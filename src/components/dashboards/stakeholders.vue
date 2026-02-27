<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";

import { useStakeholdersStore } from "../../stores/stakeholders";
import type { Stakeholder, CreateStakeholderPayload } from "../../types/stakeholders.types";
import EasyDataTable from "vue3-easy-data-table";
import "vue3-easy-data-table/dist/style.css";
import { useAuthStore } from "../../stores/auth";
import { useIkasStore } from "../../stores/ikas";
import { useKseStore } from "../../stores/kse";
import { useListPage } from "../../composables/useListPage";



export default {
  data() {
    return {
      dataToPass: {
        title: { label: "Dashboards", path: "/dashboards" },
        currentpage: "Stakeholders",
        activepage: "Stakeholders",
      },
    };
  },
  components: { Pageheader, EasyDataTable },
  setup() {
    const authStore = useAuthStore();
    const stakeholdersStore = useStakeholdersStore();
    const ikasStore = useIkasStore();
    const kseStore = useKseStore();
    const isAdmin = computed(() => authStore.isAdmin);

    const loading = computed(() => stakeholdersStore.loading);

    const {
      searchQuery, currentPage, itemsPerPage, sortField, sortOrder,
      showToast, toastMessage, toastType, showNotification,
      clearSearch, toggleSort, makePagination,
    } = useListPage("nama_perusahaan");

    const searchValue2 = ref("");

    // CRUD state
    const showCreateModal   = ref(false);
    const showEditModal     = ref(false);
    const showDeleteModal   = ref(false);
    const currentEditItem   = ref<Stakeholder | null>(null);
    const currentDeleteItem = ref<Stakeholder | null>(null);

    // Form state
    const formData = ref<Partial<Stakeholder>>({
      nama_perusahaan: "",
      sektor: "",
      email: "",
      alamat: "",
      telepon: "",
      website: "",
      photo: "",
    });

    const formErrors = ref<Record<string, string>>({});
    


    const headers = [
      { text: "Nama Perusahaan", value: "nama_perusahaan", sortable: true },
      { text: "Sub-Sektor", value: "sektor", sortable: true },
      { text: "Email", value: "email", sortable: true },
      { text: "Aksi", value: "id" },
    ];

    const loadStakeholders = async () => {
      await stakeholdersStore.initialize();
    };

    const filteredData = computed(() => {
      let data = stakeholdersStore.allStakeholders;
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        data = data.filter(
          (i) =>
            i.nama_perusahaan.toLowerCase().includes(q) ||
            i.sektor.toLowerCase().includes(q) ||
            i.email.toLowerCase().includes(q)
        );
      }
      return [...data].sort((a, b) => {
        const mod = sortOrder.value === "asc" ? 1 : -1;
        const aVal = (a[sortField.value as keyof Stakeholder] || "") as string;
        const bVal = (b[sortField.value as keyof Stakeholder] || "") as string;
        return aVal.localeCompare(bVal) * mod;
      });
    });

    const { totalPages, displayData, paginationInfo } = makePagination(filteredData);

    // Form validation
    const validateForm = (): boolean => {
      formErrors.value = {};
      let isValid = true;

      if (!formData.value.nama_perusahaan?.trim()) {
        formErrors.value.nama_perusahaan = "Nama perusahaan wajib diisi";
        isValid = false;
      }

      if (!formData.value.sektor?.trim()) {
        formErrors.value.sektor = "Sub-Sektor wajib diisi";
        isValid = false;
      }

      if (!formData.value.email?.trim()) {
        formErrors.value.email = "Email wajib diisi";
        isValid = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.value.email)) {
        formErrors.value.email = "Format email tidak valid";
        isValid = false;
      }

      if (!formData.value.alamat?.trim()) {
        formErrors.value.alamat = "Alamat wajib diisi";
        isValid = false;
      }

      if (!formData.value.telepon?.trim()) {
        formErrors.value.telepon = "Telepon wajib diisi";
        isValid = false;
      }

      if (!formData.value.website?.trim()) {
        formErrors.value.website = "Website wajib diisi";
        isValid = false;
      } else if (!/^https?:\/\/.+/.test(formData.value.website)) {
        formErrors.value.website =
          "Format website tidak valid (harus dimulai dengan http:// atau https://)";
        isValid = false;
      }

      return isValid;
    };

    // â”€â”€â”€ show notification is provided by composable â”€â”€â”€

    // CREATE
    const openCreateModal = () => {
      formData.value = {
        nama_perusahaan: "",
        sektor: "",
        email: "",
        alamat: "",
        telepon: "",
        website: "",
        photo: "",
      };
      formErrors.value = {};

      showCreateModal.value = true;
    };

    const createStakeholder = async () => {
      if (!validateForm()) return;

      const payload: CreateStakeholderPayload = {
        nama_perusahaan: formData.value.nama_perusahaan!,
        sektor: formData.value.sektor!,
        email: formData.value.email!,
        alamat: formData.value.alamat!,
        telepon: formData.value.telepon!,
        website: formData.value.website!,
        photo: formData.value.photo || "",
      };

      const result = await stakeholdersStore.createStakeholder(payload);

      if (result.success) {
        showCreateModal.value = false;
        showNotification("Stakeholder berhasil ditambahkan!", "success");
      } else {
        showNotification("Gagal menambahkan stakeholder: " + result.error, "error");
      }
    };

    // UPDATE
    const openEditModal = (item: Stakeholder) => {
      currentEditItem.value = item;
      formData.value = { ...item };
      formErrors.value = {};

      showEditModal.value = true;
    };

    const updateStakeholder = async () => {
      if (!validateForm() || !currentEditItem.value) return;

      const payload: Partial<CreateStakeholderPayload> = {
        nama_perusahaan: formData.value.nama_perusahaan!,
        sektor: formData.value.sektor!,
        email: formData.value.email!,
        alamat: formData.value.alamat!,
        telepon: formData.value.telepon!,
        website: formData.value.website!,
        photo: formData.value.photo,
      };

      const result = await stakeholdersStore.updateStakeholderById(currentEditItem.value.id, payload);

      if (result.success) {
        showEditModal.value = false;
        showNotification("Stakeholder berhasil diperbarui!", "success");
      } else {
        showNotification("Gagal memperbarui stakeholder: " + result.error, "error");
      }
    };

    // DELETE
    const openDeleteModal = (item: Stakeholder) => {
      currentDeleteItem.value = item;
      showDeleteModal.value = true;
    };

    const deleteStakeholder = async () => {
      if (!currentDeleteItem.value) return;

      const result = await stakeholdersStore.deleteStakeholderById(currentDeleteItem.value.id);
      if (result.success) {
        showDeleteModal.value = false;
        showNotification("Stakeholder berhasil dihapus!", "success");
      } else {
        showNotification("Gagal menghapus stakeholder: " + result.error, "error");
      }
    };

    onMounted(() => {
      loadStakeholders();
      ikasStore.initialize();
      kseStore.initialize();
    });

    const fileInput = ref<HTMLInputElement | null>(null);

    // Image validation constants
    const MAX_FILE_SIZE_MB = 5;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
    const ALLOWED_FORMATS = ["image/jpeg", "image/png", "image/gif"];
    const ALLOWED_EXTENSIONS = "JPEG, PNG, GIF";

    const triggerFileInput = () => {
      fileInput.value?.click();
    };

    const onFileChange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        const file = target.files[0];

        // Validate file format
        if (!ALLOWED_FORMATS.includes(file.type)) {
          showNotification(
            `Format file tidak didukung. Gunakan ${ALLOWED_EXTENSIONS}.`,
            "error"
          );
          target.value = "";
          return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE_BYTES) {
          showNotification(
            `Ukuran file terlalu besar. Maksimal ${MAX_FILE_SIZE_MB}MB.`,
            "error"
          );
          target.value = "";
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            formData.value.photo = e.target.result as string;
          }
        };
        reader.readAsDataURL(file);
      }
    };

    const removeImage = () => {
      formData.value.photo = "";
      if (fileInput.value) {
        fileInput.value.value = "";
      }
    };

    // Status helpers
    const hasIkas = (slug: string): boolean => {
      const data = ikasStore.ikasDataMap[slug];
      if (!data) return false;
      const val = data.total_rata_rata;
      return val !== null && val !== 0 && val !== 'NA';
    };
    const hasKse = (slug: string): boolean => {
      const data = kseStore.kseDataMap[slug];
      if (!data) return false;
      return data.isSubmitted || Object.values(data.answers).some((a: any) => a.selectedOption !== null);
    };

    const countIkasOnly = computed(() =>
      stakeholdersStore.stakeholders.filter(s => hasIkas(s.slug) && !hasKse(s.slug)).length
    );
    const countKseOnly = computed(() =>
      stakeholdersStore.stakeholders.filter(s => !hasIkas(s.slug) && hasKse(s.slug)).length
    );
    const countBoth = computed(() =>
      stakeholdersStore.stakeholders.filter(s => hasIkas(s.slug) && hasKse(s.slug)).length
    );
    const countIkas = computed(() =>
      stakeholdersStore.stakeholders.filter(s => hasIkas(s.slug)).length
    );
    const countKse = computed(() =>
      stakeholdersStore.stakeholders.filter(s => hasKse(s.slug)).length
    );

    return {
      countIkasOnly,
      countKseOnly,
      countBoth,
      countIkas,
      countKse,
      isAdmin,
      stakeholdersStore,
      loading,
      searchQuery,
      searchValue2,
      headers,
      sortField,
      sortOrder,
      currentPage,
      itemsPerPage,
      filteredData,
      totalPages,
      displayData,
      paginationInfo,
      showCreateModal,
      showEditModal,
      showDeleteModal,
      currentEditItem,
      currentDeleteItem,
      formData,
      formErrors,
      showToast,
      toastMessage,
      toastType,
      openCreateModal,
      createStakeholder,
      openEditModal,
      updateStakeholder,
      openDeleteModal,
      deleteStakeholder,
      toggleSort,
      clearSearch,
      fileInput,
      triggerFileInput,
      onFileChange,
      removeImage,
      ALLOWED_EXTENSIONS,
      MAX_FILE_SIZE_MB,
      ALLOWED_FORMATS,

      getSektorBadgeClass: (sektor: string) => {
        const sektorColors: Record<string, string> = {
          'Hasil hutan & perkebunan': 'badge-sektor badge-sektor-green',
          'Pangan & perikanan': 'badge-sektor badge-sektor-teal',
          'Minuman, tembakau & bahan penyegar': 'badge-sektor badge-sektor-amber',
          'Kemurgi, oleokimia & pakan': 'badge-sektor badge-sektor-orange',
          'Kimia hulu': 'badge-sektor badge-sektor-cyan',
          'Kimia hilir & farmasi': 'badge-sektor badge-sektor-red',
          'Semen, keramik & nonlogam': 'badge-sektor badge-sektor-slate',
          'Tekstil, kulit & alas kaki': 'badge-sektor badge-sektor-blue',
          'Logam': 'badge-sektor badge-sektor-indigo',
          'Permesinan & alat pertanian': 'badge-sektor badge-sektor-violet',
          'Transportasi, maritim & pertahanan': 'badge-sektor badge-sektor-sky',
          'Elektronika & telematika': 'badge-sektor badge-sektor-purple',
        };
        return sektorColors[sektor] || 'badge-sektor badge-sektor-default';
      },
      getAvatarClass: (letter: string) => {
        const variants = [
          'avatar-blue', 'avatar-indigo', 'avatar-violet', 'avatar-purple',
          'avatar-teal', 'avatar-cyan', 'avatar-green', 'avatar-amber',
          'avatar-orange', 'avatar-red'
        ];
        const idx = (letter.toUpperCase().charCodeAt(0) - 65 + variants.length) % variants.length;
        return variants[idx];
      },
      hasIkas,
      hasKse,
    };
  },
};

</script>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Toast Notification -->
  <transition name="toast-slide">
    <div v-if="showToast" class="toast-wrapper position-fixed">
      <div class="toast-modern" :class="toastType === 'success' ? 'toast-success' : 'toast-error'" role="alert">
        <div class="toast-icon-wrap">
          <i :class="toastType === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'"></i>
        </div>
        <div class="toast-content">
          <span class="toast-title">{{ toastType === 'success' ? 'Berhasil' : 'Gagal' }}</span>
          <span class="toast-msg">{{ toastMessage }}</span>
        </div>
      </div>
    </div>
  </transition>

  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card gradient-header-card">
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3 stakeholder-header">
          <div class="d-flex align-items-center gap-3 header-inner">
            <div class="header-icon-box">
              <i class="ri-building-2-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">Daftar Stakeholders</div>
              <div class="header-subtitle mt-1">Manajemen data perusahaan stakeholder</div>
            </div>
          </div>
          <div class="d-flex gap-2 align-items-center flex-wrap header-inner">
            <div class="search-container position-relative">
              <i class="ri-search-line card-search-icon"></i>
              <input v-model="searchQuery" type="text" class="form-control form-control-sm header-search-input" 
                placeholder="Cari perusahaan, sub-sektor, atau email..." />
              <button v-if="searchQuery" @click="clearSearch" class="clear-btn">
                <i class="ri-close-circle-fill"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="card-body p-4">
          <div v-if="loading" class="skeleton-loading p-4">
            <div class="skeleton-row" v-for="n in 5" :key="n">
              <div class="skel skel-no"></div>
              <div class="skel skel-avatar"></div>
              <div class="skel skel-name"></div>
              <div class="skel skel-badge"></div>
              <div class="skel skel-email"></div>
              <div class="skel skel-actions"></div>
            </div>
          </div>

          <template v-else>
            <!-- Stats Strip -->
            <div class="stats-strip mb-4">
              <div class="stat-card">
                <div class="stat-icon stat-icon-blue"><i class="ri-building-2-line"></i></div>
                <div>
                  <div class="stat-value">{{ filteredData.length }}</div>
                  <div class="stat-label">Total Stakeholder</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-teal"><i class="ri-pie-chart-2-line"></i></div>
                <div>
                  <div class="stat-value">{{ new Set(filteredData.map((d) => d.sektor)).size }}</div>
                  <div class="stat-label">Sub-Sektor Aktif</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-violet"><i class="ri-check-double-line"></i></div>
                <div>
                  <div class="stat-value">{{ countBoth }}</div>
                  <div class="stat-label">IKAS &amp; KSE</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-blue"><i class="ri-bar-chart-grouped-line"></i></div>
                <div>
                  <div class="stat-value">{{ countIkasOnly }}</div>
                  <div class="stat-label">IKAS Saja</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-teal"><i class="ri-shield-check-line"></i></div>
                <div>
                  <div class="stat-value">{{ countKseOnly }}</div>
                  <div class="stat-label">KSE Saja</div>
                </div>
              </div>
            </div>

            <!-- Controls Bar -->
            <div class="controls-bar d-flex flex-wrap justify-content-between align-items-center mb-4 pb-3 border-bottom gap-3">
              <div class="d-flex align-items-center gap-2">
                <span class="text-muted fs-13">Tampilkan</span>
                <select v-model="itemsPerPage" class="form-select form-select-sm entries-select">
                  <option v-for="n in [5, 10, 15, 20, 25, 50]" :key="n" :value="n">{{ n }}</option>
                </select>
                <span class="text-muted fs-13">per halaman</span>
              </div>
              <button v-if="isAdmin"
                @click="openCreateModal"
                class="btn btn-warning d-flex align-items-center gap-2"
              >
                <i class="ri-add-circle-line fs-16"></i>
                <span>Tambah Stakeholder</span>
              </button>
            </div>

            <!-- Table -->
            <div class="table-responsive stakeholder-table-wrap">
              <table class="table stakeholder-table text-nowrap mb-0">
                <thead class="stakeholder-thead">
                  <tr>
                    <th class="th-no">No</th>
                    <th class="sortable fw-semibold th-name-wide">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-building-line text-primary"></i>
                        <span class="column-label" @click="toggleSort('nama_perusahaan')" title="Click to toggle sort">Nama Perusahaan</span>
                        <div class="sort-arrows">
                          <i class="ri-arrow-up-s-line" 
                            :class="{
                              active:
                                sortField === 'nama_perusahaan' &&
                                sortOrder === 'asc',
                            }"
                            @click.stop="
                              sortField = 'nama_perusahaan';
                              sortOrder = 'asc';
                            "
                            title="Sort A-Z"
                          ></i>
                          <i class="ri-arrow-down-s-line" 
                            :class="{
                              active:
                                sortField === 'nama_perusahaan' &&
                                sortOrder === 'desc',
                            }"
                            @click.stop="
                              sortField = 'nama_perusahaan';
                              sortOrder = 'desc';
                            "
                            title="Sort Z-A"
                          ></i>
                        </div>
                      </div>
                    </th>
                    <th class="sortable fw-semibold th-sektor">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-pie-chart-line text-primary"></i>
                        <span class="column-label" @click="toggleSort('sektor')" title="Click to toggle sort">Sub-Sektor</span>
                        <div class="sort-arrows">
                          <i class="ri-arrow-up-s-line" 
                            :class="{
                              active:
                                sortField === 'sektor' && sortOrder === 'asc',
                            }"
                            @click.stop="
                              sortField = 'sektor';
                              sortOrder = 'asc';
                            "
                            title="Sort A-Z"
                          ></i>
                          <i class="ri-arrow-down-s-line" 
                            :class="{
                              active:
                                sortField === 'sektor' && sortOrder === 'desc',
                            }"
                            @click.stop="
                              sortField = 'sektor';
                              sortOrder = 'desc';
                            "
                            title="Sort Z-A"
                          ></i>
                        </div>
                      </div>
                    </th>
                    <th class="th-email">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-mail-line text-primary"></i>
                        <span>Email</span>
                      </div>
                    </th>
                    <th class="text-center th-status">
                      <div class="d-flex align-items-center justify-content-center gap-2">
                        <i class="ri-bar-chart-grouped-line text-primary"></i>
                        <span>Status</span>
                      </div>
                    </th>
                    <th class="text-center th-actions-md">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!displayData.length">
                    <td colspan="6" class="text-center py-5">
                      <div class="empty-state">
                        <div class="empty-icon-ring mb-3">
                          <div class="empty-icon-inner">
                            <i class="ri-building-2-line"></i>
                          </div>
                        </div>
                        <h6 class="fw-semibold mb-1 empty-state-title">Tidak Ada Stakeholder</h6>
                        <p class="text-muted fs-13 mb-3">Coba ubah kata kunci pencarian Anda</p>
                        <button v-if="searchQuery" @click="clearSearch" class="btn btn-sm btn-outline-primary rounded-pill px-4">
                          <i class="ri-refresh-line me-1"></i>Reset Pencarian
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-for="(item, i) in displayData" :key="item.slug" class="stakeholder-row">
                    <td class="align-middle text-center">
                      <span class="row-number">{{ (currentPage - 1) * itemsPerPage + i + 1 }}</span>
                    </td>
                    <td class="align-middle">
                      <div class="d-flex align-items-center gap-3">
                        <div class="company-avatar" :class="getAvatarClass(item.nama_perusahaan.charAt(0).toUpperCase())">
                          <img v-if="item.photo" :src="item.photo" :alt="item.nama_perusahaan" class="company-avatar-img" />
                          <span v-else class="company-avatar-letter">{{ item.nama_perusahaan.charAt(0).toUpperCase() }}</span>
                        </div>
                        <div class="company-name-wrap">
                          <span class="company-name d-block">{{ item.nama_perusahaan }}</span>
                          <small class="company-address d-none d-lg-block">
                            <i class="ri-map-pin-2-line me-1"></i>{{ item.alamat?.substring(0, 38) }}...
                          </small>
                        </div>
                      </div>
                    </td>
                    <td class="align-middle">
                      <span :class="getSektorBadgeClass(item.sektor)">
                        {{ item.sektor }}
                      </span>
                    </td>
                    <td class="align-middle">
                      <a :href="`mailto:${item.email}`" class="email-link d-inline-flex align-items-center gap-1 text-decoration-none">
                       
                        <span class="email-text">{{ item.email }}</span>
                      </a>
                    </td>
                    <td class="text-center align-middle">
                      <div class="status-indicators">
                        <div class="status-badge" :class="hasIkas(item.slug) ? 'badge-done' : 'badge-pending'" title="IKAS">
                          <span class="badge-icon-dot">
                            <i :class="hasIkas(item.slug) ? 'ri-check-line' : 'ri-subtract-line'"></i>
                          </span>
                          <span class="badge-label">IKAS</span>
                        </div>
                        <div class="status-badge" :class="hasKse(item.slug) ? 'badge-done' : 'badge-pending'" title="KSE/CSIRT">
                          <span class="badge-icon-dot">
                            <i :class="hasKse(item.slug) ? 'ri-check-line' : 'ri-subtract-line'"></i>
                          </span>
                          <span class="badge-label">KSE</span>
                        </div>
                      </div>
                    </td>
                    <td class="text-center align-middle">
                      <div class="d-flex gap-1 justify-content-center">
                        <router-link
                          :to="`/admin/stakeholders/${item.slug}`"
                          class="btn btn-sm btn-icon btn-wave btn-info-light"
                          title="Lihat Profil">
                          <i class="ri-eye-line"></i>
                        </router-link>
                        <router-link
                          :to="`/ikas?slug=${item.slug}&source=list`"
                          class="btn btn-sm btn-icon btn-wave btn-warning-light"
                          title="IKAS">
                          <i class="ri-file-chart-line"></i>
                        </router-link>
                        <button v-if="isAdmin"
                          @click="openEditModal(item)"
                          class="btn btn-sm btn-icon btn-wave btn-success-light"
                          title="Edit">
                          <i class="ri-edit-2-line"></i>
                        </button>
                        <button v-if="isAdmin"
                          @click="openDeleteModal(item)"
                          class="btn btn-sm btn-icon btn-wave btn-danger-light"
                          title="Hapus">
                          <i class="ri-delete-bin-3-line"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="d-flex flex-wrap justify-content-between align-items-center mt-4 gap-3">
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-light text-muted px-3 py-2">
                  <i class="ri-file-list-3-line me-1"></i>
                  Halaman {{ currentPage }} dari {{ totalPages }}
                </span>
              </div>
              <nav>
                <ul class="pagination pagination-sm mb-0 gap-1">
                  <li class="page-item" :class="{ disabled: currentPage === 1 }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = 1" title="First">
                      <i class="ri-skip-back-mini-line"></i>
                    </a>
                  </li>
                  <li class="page-item" :class="{ disabled: currentPage === 1 }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage--" title="Previous">
                      <i class="ri-arrow-left-s-line"></i>
                    </a>
                  </li>
                  <template v-for="p in totalPages" :key="p">
                    <li v-if="p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)" class="page-item" :class="{ active: p === currentPage }">
                      <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = p">{{ p }}</a>
                    </li>
                    <li v-else-if="p === currentPage - 2 || p === currentPage + 2" class="page-item disabled">
                      <span class="page-link border-0 bg-transparent">...</span>
                    </li>
                  </template>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage++" title="Next">
                      <i class="ri-arrow-right-s-line"></i>
                    </a>
                  </li>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = totalPages" title="Last">
                      <i class="ri-skip-forward-mini-line"></i>
                    </a>
                  </li>
                </ul>
              </nav>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Modal -->
  <div v-if="showCreateModal" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="showCreateModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal">
      <div class="modal-content border-0 bg-transparent">
        <div class="card custom-card gradient-header-card w-100 mb-0">
          <div class="card-header d-flex justify-content-between align-items-center gradient-header-blue">
            <div class="d-flex align-items-center">
              <i class="ri-add-circle-line text-white me-2 fs-18"></i>
              <div class="card-title text-white mb-0">
                Tambah Stakeholder Baru
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" @click="showCreateModal = false"></button>
          </div>
          <div class="card-body p-4 bg-white">
            <form @submit.prevent="createStakeholder">
              <div class="row gy-4">
                <!-- Photo Section - Horizontal Layout -->
                <div class="col-xl-12">
                  <div class="d-flex flex-column flex-sm-row gap-3 align-items-start">
                    <!-- Photo Preview (Left) -->
                    <div 
                      class="photo-preview-modal position-relative overflow-hidden rounded-3 shadow-sm border flex-shrink-0"
                      :style="{ 
                        backgroundImage: formData.photo ? `url(${formData.photo})` : 'none',
                        backgroundColor: formData.photo ? 'transparent' : '#e9ecef',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }"
                    >
                      <!-- Empty State -->
                      <div v-if="!formData.photo" class="position-absolute d-flex flex-column align-items-center justify-content-center text-muted photo-empty-state">
                        <i class="ri-image-add-line fs-2 mb-1 opacity-50"></i>
                        <span class="fs-11">Belum ada foto</span>
                      </div>
                    </div>
                    <input ref="fileInput" type="file" :accept="ALLOWED_FORMATS.join(',')" class="d-none" @change="onFileChange" />
                    
                    <!-- Photo Info & Actions (Right) -->
                    <div class="flex-grow-1">
                      <h6 class="fw-semibold mb-3 d-flex align-items-center gap-2">
                        <i class="ri-image-2-line text-primary"></i>
                        Foto Perusahaan
                      </h6>
                      <div class="d-flex flex-wrap gap-2 mb-2">
                        <button type="button" class="btn btn-primary btn-sm" @click="triggerFileInput">
                          <i class="ri-upload-2-line me-1"></i>
                          {{ formData.photo ? 'Ganti Gambar' : 'Upload Gambar' }}
                        </button>
                        <button v-if="formData.photo" type="button" class="btn btn-outline-danger btn-sm" @click="removeImage">
                          <i class="ri-delete-bin-line me-1"></i>Hapus
                        </button>
                      </div>
                      <div class="d-flex align-items-center gap-3 fs-11 text-muted">
                        <span><i class="ri-file-type-line me-1"></i>{{ ALLOWED_EXTENSIONS }}</span>
                        <span><i class="ri-upload-cloud-line me-1"></i>Max {{ MAX_FILE_SIZE_MB }}MB</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Nama Perusahaan -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-building-line me-1 text-primary"></i>Nama
                    Perusahaan <span class="text-danger">*</span>
                  </label>
                  <input type="text" class="form-control" v-model="formData.nama_perusahaan" :class="{ 'is-invalid': formErrors.nama_perusahaan }" placeholder="Masukkan nama perusahaan" />
                  <div v-if="formErrors.nama_perusahaan" class="invalid-feedback">
                    {{ formErrors.nama_perusahaan }}
                  </div>
                </div>

                <!-- Sub-Sektor -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-pie-chart-line me-1 text-primary"></i>Sub-Sektor
                    <span class="text-danger">*</span>
                  </label>
                  <select v-model="formData.sektor" class="form-select" :class="{ 'is-invalid': formErrors.sektor }">
                    <option value="" disabled>-- Pilih Sub-Sektor --</option>
                    <option value="Hasil hutan & perkebunan">Hasil hutan & perkebunan</option>
                    <option value="Pangan & perikanan">Pangan & perikanan</option>
                    <option value="Minuman, tembakau & bahan penyegar">Minuman, tembakau & bahan penyegar</option>
                    <option value="Kemurgi, oleokimia & pakan">Kemurgi, oleokimia & pakan</option>
                    <option value="Kimia hulu">Kimia hulu</option>
                    <option value="Kimia hilir & farmasi">Kimia hilir & farmasi</option>
                    <option value="Semen, keramik & nonlogam">Semen, keramik & nonlogam</option>
                    <option value="Tekstil, kulit & alas kaki">Tekstil, kulit & alas kaki</option>
                    <option value="Logam">Logam</option>
                    <option value="Permesinan & alat pertanian">Permesinan & alat pertanian</option>
                    <option value="Transportasi, maritim & pertahanan">Transportasi, maritim & pertahanan</option>
                    <option value="Elektronika & telematika">Elektronika & telematika</option>
                  </select>
                  <div v-if="formErrors.sektor" class="invalid-feedback">
                    {{ formErrors.sektor }}
                  </div>
                </div>

                <!-- Email -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-mail-line me-1 text-primary"></i>Email
                    <span class="text-danger">*</span>
                  </label>
                  <input type="email" class="form-control" v-model="formData.email" :class="{ 'is-invalid': formErrors.email }" placeholder="Masukkan email" />
                  <div v-if="formErrors.email" class="invalid-feedback">
                    {{ formErrors.email }}
                  </div>
                </div>

                <!-- Phone -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-phone-line me-1 text-primary"></i>Nomor
                    Telepon <span class="text-danger">*</span>
                  </label>
                  <input 
                      type="tel" 
                      class="form-control" 
                      v-model="formData.telepon"
                      placeholder="Masukkan nomor telepon"
                      :class="{ 'is-invalid': formErrors.telepon }"
                    />
                  <div v-if="formErrors.telepon" class="invalid-feedback d-block">
                    {{ formErrors.telepon }}
                  </div>
                </div>

                <!-- Website -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-global-line me-1 text-primary"></i>Website
                    <span class="text-danger">*</span>
                  </label>
                  <input type="url" class="form-control" v-model="formData.website" :class="{ 'is-invalid': formErrors.website }" placeholder="Masukkan website" />
                  <div v-if="formErrors.website" class="invalid-feedback">
                    {{ formErrors.website }}
                  </div>
                </div>

                <!-- Empty column for alignment -->
                <div class="col-xl-6 col-lg-6 col-md-6 d-none d-md-block"></div>

                <!-- Alamat -->
                <div class="col-12">
                  <label class="form-label fw-medium">
                    <i class="ri-map-pin-line me-1 text-primary"></i>Alamat
                    <span class="text-danger">*</span>
                  </label>
                  <textarea class="form-control" v-model="formData.alamat" :class="{ 'is-invalid': formErrors.alamat }" rows="3" placeholder="Masukkan alamat lengkap"></textarea>
                  <div v-if="formErrors.alamat" class="invalid-feedback">
                    {{ formErrors.alamat }}
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="card-footer bg-light d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-outline-danger" @click="showCreateModal = false">
              <i class="ri-close-line me-1"></i>Batal
            </button>
            <button type="button" class="btn btn-secondary" @click="createStakeholder">
              <i class="ri-save-line me-1"></i>Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Edit Modal -->
  <div v-if="showEditModal" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="showEditModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal">
      <div class="modal-content border-0 bg-transparent">
        <div class="card custom-card gradient-header-card w-100 mb-0">
          <div class="card-header d-flex justify-content-between align-items-center gradient-header-blue">
            <div class="d-flex align-items-center">
              <i class="ri-building-2-line text-white me-2 fs-18"></i>
              <div class="card-title text-white mb-0">
                Edit Stakeholder - Informasi Perusahaan
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" @click="showEditModal = false"></button>
          </div>
          <div class="card-body p-4 bg-white">
            <form @submit.prevent="updateStakeholder">
              <div class="row gy-4">
                <!-- Photo Section - Horizontal Layout -->
                <div class="col-xl-12">
                  <div class="d-flex flex-column flex-sm-row gap-3 align-items-start">
                    <!-- Photo Preview (Left) -->
                    <div 
                      class="photo-preview-modal position-relative overflow-hidden rounded-3 shadow-sm border flex-shrink-0"
                      :style="{ 
                        backgroundImage: formData.photo ? `url(${formData.photo})` : 'none',
                        backgroundColor: formData.photo ? 'transparent' : '#e9ecef',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }"
                    >
                      <!-- Empty State -->
                      <div v-if="!formData.photo" class="position-absolute d-flex flex-column align-items-center justify-content-center text-muted photo-empty-state">
                        <i class="ri-image-add-line fs-2 mb-1 opacity-50"></i>
                        <span class="fs-11">Belum ada foto</span>
                      </div>
                    </div>
                    <input ref="fileInput" type="file" :accept="ALLOWED_FORMATS.join(',')" class="d-none" @change="onFileChange" />
                    
                    <!-- Photo Info & Actions (Right) -->
                    <div class="flex-grow-1">
                      <h6 class="fw-semibold mb-3 d-flex align-items-center gap-2">
                        <i class="ri-image-2-line text-primary"></i>
                        Foto Perusahaan
                      </h6>
                      <div class="d-flex flex-wrap gap-2 mb-2">
                        <button type="button" class="btn btn-primary btn-sm" @click="triggerFileInput">
                          <i class="ri-upload-2-line me-1"></i>
                          {{ formData.photo ? 'Ganti Gambar' : 'Upload Gambar' }}
                        </button>
                        <button v-if="formData.photo" type="button" class="btn btn-outline-danger btn-sm" @click="removeImage">
                          <i class="ri-delete-bin-line me-1"></i>Hapus
                        </button>
                      </div>
                      <div class="d-flex align-items-center gap-3 fs-11 text-muted">
                        <span><i class="ri-file-type-line me-1"></i>{{ ALLOWED_EXTENSIONS }}</span>
                        <span><i class="ri-upload-cloud-line me-1"></i>Max {{ MAX_FILE_SIZE_MB }}MB</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Nama Perusahaan -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-building-line me-1 text-primary"></i>Nama
                    Perusahaan <span class="text-danger">*</span>
                  </label>
                  <input type="text" class="form-control" v-model="formData.nama_perusahaan" :class="{ 'is-invalid': formErrors.nama_perusahaan }" placeholder="Masukkan nama perusahaan" />
                  <div v-if="formErrors.nama_perusahaan" class="invalid-feedback">
                    {{ formErrors.nama_perusahaan }}
                  </div>
                </div>

                <!-- Sub-Sektor -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-pie-chart-line me-1 text-primary"></i>Sub-Sektor
                    <span class="text-danger">*</span>
                  </label>
                  <select v-model="formData.sektor" class="form-select" :class="{ 'is-invalid': formErrors.sektor }">
                    <option value="" disabled>-- Pilih Sub-Sektor --</option>
                    <option value="Hasil hutan & perkebunan">Hasil hutan & perkebunan</option>
                    <option value="Pangan & perikanan">Pangan & perikanan</option>
                    <option value="Minuman, tembakau & bahan penyegar">Minuman, tembakau & bahan penyegar</option>
                    <option value="Kemurgi, oleokimia & pakan">Kemurgi, oleokimia & pakan</option>
                    <option value="Kimia hulu">Kimia hulu</option>
                    <option value="Kimia hilir & farmasi">Kimia hilir & farmasi</option>
                    <option value="Semen, keramik & nonlogam">Semen, keramik & nonlogam</option>
                    <option value="Tekstil, kulit & alas kaki">Tekstil, kulit & alas kaki</option>
                    <option value="Logam">Logam</option>
                    <option value="Permesinan & alat pertanian">Permesinan & alat pertanian</option>
                    <option value="Transportasi, maritim & pertahanan">Transportasi, maritim & pertahanan</option>
                    <option value="Elektronika & telematika">Elektronika & telematika</option>
                  </select>
                  <div v-if="formErrors.sektor" class="invalid-feedback">
                    {{ formErrors.sektor }}
                  </div>
                </div>

                <!-- Email -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-mail-line me-1 text-primary"></i>Email
                    <span class="text-danger">*</span>
                  </label>
                  <input type="email" class="form-control" v-model="formData.email" :class="{ 'is-invalid': formErrors.email }" placeholder="Masukkan email" />
                  <div v-if="formErrors.email" class="invalid-feedback">
                    {{ formErrors.email }}
                  </div>
                </div>

                <!-- Phone -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-phone-line me-1 text-primary"></i>Nomor
                    Telepon <span class="text-danger">*</span>
                  </label>
                  <input 
                      type="tel" 
                      class="form-control" 
                      v-model="formData.telepon"
                      placeholder="Masukkan nomor telepon"
                      :class="{ 'is-invalid': formErrors.telepon }"
                    />
                  <div v-if="formErrors.telepon" class="invalid-feedback d-block">
                    {{ formErrors.telepon }}
                  </div>
                </div>


                <!-- Website -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-global-line me-1 text-primary"></i>Website
                    <span class="text-danger">*</span>
                  </label>
                  <input type="url" class="form-control" v-model="formData.website" :class="{ 'is-invalid': formErrors.website }" placeholder="Masukkan website" />
                  <div v-if="formErrors.website" class="invalid-feedback">
                    {{ formErrors.website }}
                  </div>
                </div>

                <!-- Empty column for alignment -->
                <div class="col-xl-6 col-lg-6 col-md-6 d-none d-md-block"></div>

                <!-- Alamat -->
                <div class="col-12">
                  <label class="form-label fw-medium">
                    <i class="ri-map-pin-line me-1 text-primary"></i>Alamat
                    <span class="text-danger">*</span>
                  </label>
                  <textarea class="form-control" v-model="formData.alamat" :class="{ 'is-invalid': formErrors.alamat }" rows="3" placeholder="Masukkan alamat lengkap"></textarea>
                  <div v-if="formErrors.alamat" class="invalid-feedback">
                    {{ formErrors.alamat }}
                  </div>
                </div>

                <!-- Action Buttons -->
                <div class="col-12">
                  <div class="d-flex justify-content-end gap-2">
                    <button type="button" @click="showEditModal = false" class="btn btn-outline-danger">
                      <i class="ri-arrow-left-line me-1"></i>Batal
                    </button>
                    <button type="submit" class="btn btn-secondary">
                      <i class="ri-save-line me-1"></i> Simpan Perubahan
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Delete Confirmation Modal -->
  <div v-if="showDeleteModal" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="showDeleteModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Konfirmasi Hapus</h5>
          <button type="button" class="btn-close" @click="showDeleteModal = false"></button>
        </div>
        <div class="modal-body">
          <div class="text-center">
            <i class="ri-error-warning-line text-danger warning-icon-lg"></i>
            <h5 class="mt-3">Apakah Anda yakin?</h5>
            <p class="text-muted">
              Anda akan menghapus stakeholder
              <strong>{{ currentDeleteItem?.nama_perusahaan }}</strong
              >. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="showDeleteModal = false">Batal</button>
          <button type="button" class="btn btn-danger" @click="deleteStakeholder">
            <i class="ri-delete-bin-line me-1"></i>Hapus
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style src="../../assets/css/style2.css"></style>

<style>
/* Global style untuk modal - tidak scoped agar bisa override */
@media (min-width: 992px) {
  .modal.fade.show.d-block .modal-dialog {
    margin-left: calc(250px + ((100% - 250px - 1000px) / 2)) !important;
    margin-right: auto !important;
  }
}
</style>
