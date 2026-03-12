```typescript
<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import CountryCodeDropdown from "../shared/CountryCodeDropdown.vue";
import { useCsirtStore } from "../../stores/csirt";
import type { CsirtMember, CreateCsirtPayload } from "../../types/csirt.types";
import EasyDataTable from "vue3-easy-data-table";
import "vue3-easy-data-table/dist/style.css";
import { useAuthStore } from "../../stores/auth";
import { useListPage } from "../../composables/useListPage";

export default {
  data() {
    return {
      dataToPass: {
        title: { label: "Dashboards", path: "/dashboard" },
        currentpage: "CSIRT Administration",
        activepage: "CSIRT",
      },
    };
  },
  components: { Pageheader, EasyDataTable, CountryCodeDropdown },
  setup() {
    const authStore = useAuthStore();
    const csirtStore = useCsirtStore();
    const isAdmin = computed(() => authStore.isAdmin);

    const loading = computed(() => csirtStore.loading);
    
    const {
      searchQuery, currentPage, itemsPerPage, sortField, sortOrder,
      showToast, toastMessage, toastType, showNotification,
      clearSearch, toggleSort, makePagination,
    } = useListPage("nama_csirt");

    const searchValue2 = ref("");

    // CRUD state
    const showCreateModal = ref(false);
    const showEditModal = ref(false);
    const showDeleteModal = ref(false);
    const currentEditItem = ref<CsirtMember | null>(null);
    const currentDeleteItem = ref<CsirtMember | null>(null);

    // Form state
    const formData = ref<Partial<CsirtMember>>({
      nama_csirt: "",
      web_csirt: "",
      telepon_csirt: "",
      id_perusahaan: 0,
      photo_csirt: "",
    });

    const formErrors = ref<Record<string, string>>({});
    
    // Phone state for modals
    const selectedCountryCode = ref("+62");
    const phoneNumber = ref("");
    
// Phone formatting - format: XXX-XXXX-XXXX
    const formatPhoneNumber = (value: string): string => {
      const nums = value.replace(/\D/g, "");
      if (nums.length <= 3) return nums;
      if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
      return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7, 12)}`;
    };
    
    const handlePhoneInput = (event: Event) => {
      const input = event.target as HTMLInputElement;
      const numbers = input.value.replace(/\D/g, "").slice(0, 11);
      phoneNumber.value = formatPhoneNumber(numbers);
      formData.value.telepon_csirt = selectedCountryCode.value + " " + phoneNumber.value;
    };
    
    const handleCountryCodeChange = () => {
      if (phoneNumber.value) {
        formData.value.telepon_csirt = selectedCountryCode.value + " " + phoneNumber.value;
      }
    };
    
    const parsePhoneNumber = (telepon: string) => {
      if (telepon) {
        const match = telepon.match(/^(\+\d+)\s*(.+)$/);
        if (match) {
          selectedCountryCode.value = match[1];
          phoneNumber.value = match[2];
        } else {
          phoneNumber.value = telepon;
        }
      } else {
        selectedCountryCode.value = "+62";
        phoneNumber.value = "";
      }
    };

    const headers = [
      { text: "Nama CSIRT", value: "nama_csirt", sortable: true },
      { text: "Website", value: "web_csirt", sortable: true },
      { text: "Telepon", value: "telepon_csirt", sortable: true },
      { text: "Aksi", value: "id" },
    ];

    const loadCsirtMembers = async () => {
      await csirtStore.initialize();
    };

    const filteredData = computed(() => {
      let data = csirtStore.allCsirts;
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        data = data.filter(
          (i) =>
            i.nama_csirt.toLowerCase().includes(q) ||
            i.web_csirt.toLowerCase().includes(q) ||
            i.telepon_csirt.toLowerCase().includes(q)
        );
      }
      return [...data].sort((a, b) => {
        const mod = sortOrder.value === "asc" ? 1 : -1;
        const valA = (a[sortField.value as keyof CsirtMember] || "") as string;
        const valB = (b[sortField.value as keyof CsirtMember] || "") as string;
        return valA.localeCompare(valB) * mod;
      });
    });

    const { totalPages, displayData, paginationInfo } = makePagination(filteredData);

    // Form validation
    const validateForm = (): boolean => {
      formErrors.value = {};
      let isValid = true;

      if (!formData.value.nama_csirt?.trim()) {
        formErrors.value.nama_csirt = "Nama CSIRT wajib diisi";
        isValid = false;
      }

      if (!formData.value.web_csirt?.trim()) {
        formErrors.value.web_csirt = "Website CSIRT wajib diisi";
        isValid = false;
      } else if (!/^https?:\/\/.+/.test(formData.value.web_csirt)) {
        formErrors.value.web_csirt =
          "Format website tidak valid (harus dimulai dengan http:// atau https://)";
        isValid = false;
      }

      if (!formData.value.telepon_csirt?.trim()) {
        formErrors.value.telepon_csirt = "Telepon CSIRT wajib diisi";
        isValid = false;
      }

      return isValid;
    };

    // CREATE
    const openCreateModal = () => {
      formData.value = {
        nama_csirt: "",
        web_csirt: "",
        telepon_csirt: "",
        id_perusahaan: 0,
        photo_csirt: "",
      };
      formErrors.value = {};
      selectedCountryCode.value = "+62";
      phoneNumber.value = "";
      showCreateModal.value = true;
    };

    const createCsirt = async () => {
      if (!validateForm()) return;

      const payload: CreateCsirtPayload = {
        nama_csirt: formData.value.nama_csirt!,
        web_csirt: formData.value.web_csirt!,
        telepon_csirt: formData.value.telepon_csirt!,
        id_perusahaan: formData.value.id_perusahaan!,
        photo_csirt: formData.value.photo_csirt || "",
      };

      const result = await csirtStore.createCsirt(payload);

      if (result.success) {
        showCreateModal.value = false;
        showNotification("CSIRT berhasil ditambahkan!", "success");
      } else {
        showNotification("Gagal menambahkan CSIRT: " + result.error, "error");
      }
    };

    // UPDATE
    const openEditModal = (item: CsirtMember) => {
      currentEditItem.value = item;
      formData.value = { ...item };
      formErrors.value = {};
      parsePhoneNumber(item.telepon_csirt);
      showEditModal.value = true;
    };

    const updateCsirt = async () => {
      if (!validateForm() || !currentEditItem.value) return;

      const payload: Partial<CreateCsirtPayload> = {
        nama_csirt: formData.value.nama_csirt!,
        web_csirt: formData.value.web_csirt!,
        telepon_csirt: formData.value.telepon_csirt!,
        photo_csirt: formData.value.photo_csirt,
      };

      const result = await csirtStore.updateCsirtById(currentEditItem.value.id, payload);

      if (result.success) {
        showEditModal.value = false;
        showNotification("CSIRT berhasil diperbarui!", "success");
      } else {
        showNotification("Gagal memperbarui CSIRT: " + result.error, "error");
      }
    };

    // DELETE
    const openDeleteModal = (item: CsirtMember) => {
      currentDeleteItem.value = item;
      showDeleteModal.value = true;
    };

    const deleteCsirt = async () => {
      if (!currentDeleteItem.value) return;

      const result = await csirtStore.deleteCsirtById(currentDeleteItem.value.id);
      if (result.success) {
        showDeleteModal.value = false;
        showNotification("CSIRT berhasil dihapus!", "success");
      } else {
        showNotification("Gagal menghapus CSIRT: " + result.error, "error");
      }
    };

    onMounted(loadCsirtMembers);

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
            formData.value.photo_csirt = e.target.result as string;
          }
        };
        reader.readAsDataURL(file);
      }
    };

    const removeImage = () => {
      formData.value.photo_csirt = "";
      if (fileInput.value) {
        fileInput.value.value = "";
      }
    };

    return {
      isAdmin,
      csirtStore,
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
      createCsirt,
      openEditModal,
      updateCsirt,
      openDeleteModal,
      deleteCsirt,
      toggleSort,
      clearSearch,
      fileInput,
      triggerFileInput,
      onFileChange,
      removeImage,
      ALLOWED_EXTENSIONS,
      MAX_FILE_SIZE_MB,
      ALLOWED_FORMATS,
      selectedCountryCode,
      phoneNumber,
      handlePhoneInput,
      handleCountryCodeChange,
      getAvatarClass: (letter: string) => {
        const variants = [
          'avatar-blue', 'avatar-indigo', 'avatar-violet', 'avatar-purple',
          'avatar-teal', 'avatar-cyan', 'avatar-green', 'avatar-amber',
          'avatar-orange', 'avatar-red'
        ];
        const idx = (letter.toUpperCase().charCodeAt(0) - 65 + variants.length) % variants.length;
        return variants[idx];
      },
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
              <i class="ri-shield-user-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">Daftar CSIRT</div>
              <div class="header-subtitle mt-1">Manajemen data Computer Security Incident Response Team</div>
            </div>
          </div>
          <div class="d-flex gap-2 align-items-center flex-wrap header-inner">
            <div class="search-container position-relative">
              <i class="ri-search-line header-search-icon"></i>
              <input v-model="searchQuery" type="text" class="form-control form-control-sm header-search-input" 
                placeholder="Cari CSIRT, website, atau telepon..." />
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
                <div class="stat-icon stat-icon-blue"><i class="ri-shield-user-line"></i></div>
                <div>
                  <div class="stat-value">{{ filteredData.length }}</div>
                  <div class="stat-label">Total CSIRT</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-teal"><i class="ri-global-line"></i></div>
                <div>
                  <div class="stat-value">{{ new Set(filteredData.map((d) => d.web_csirt)).size }}</div>
                  <div class="stat-label">Website Aktif</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-violet"><i class="ri-phone-line"></i></div>
                <div>
                  <div class="stat-value">{{ filteredData.filter(d => d.telepon_csirt).length }}</div>
                  <div class="stat-label">Kontak Tersedia</div>
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
                <span>Tambah CSIRT</span>
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
                        <i class="ri-shield-line text-primary"></i>
                        <span class="column-label" @click="toggleSort('nama_csirt')" title="Click to toggle sort">Nama CSIRT</span>
                        <div class="sort-arrows">
                          <i class="ri-arrow-up-s-line" 
                            :class="{
                              active:
                                sortField === 'nama_csirt' &&
                                sortOrder === 'asc',
                            }"
                            @click.stop="
                              sortField = 'nama_csirt';
                              sortOrder = 'asc';
                            "
                            title="Sort A-Z"
                          ></i>
                          <i class="ri-arrow-down-s-line" 
                            :class="{
                              active:
                                sortField === 'nama_csirt' &&
                                sortOrder === 'desc',
                            }"
                            @click.stop="
                              sortField = 'nama_csirt';
                              sortOrder = 'desc';
                            "
                            title="Sort Z-A"
                          ></i>
                        </div>
                      </div>
                    </th>
                    <th class="sortable fw-semibold th-sektor">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-global-line text-primary"></i>
                        <span class="column-label" @click="toggleSort('web_csirt')" title="Click to toggle sort">Website</span>
                        <div class="sort-arrows">
                          <i class="ri-arrow-up-s-line" 
                            :class="{
                              active:
                                sortField === 'web_csirt' && sortOrder === 'asc',
                            }"
                            @click.stop="
                              sortField = 'web_csirt';
                              sortOrder = 'asc';
                            "
                            title="Sort A-Z"
                          ></i>
                          <i class="ri-arrow-down-s-line" 
                            :class="{
                              active:
                                sortField === 'web_csirt' && sortOrder === 'desc',
                            }"
                            @click.stop="
                              sortField = 'web_csirt';
                              sortOrder = 'desc';
                            "
                            title="Sort Z-A"
                          ></i>
                        </div>
                      </div>
                    </th>
                    <th class="th-email">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-phone-line text-primary"></i>
                        <span>Telepon</span>
                      </div>
                    </th>
                    <th class="text-center th-actions-md">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!displayData.length">
                    <td colspan="5" class="text-center py-5">
                      <div class="empty-state">
                        <div class="empty-icon-ring mb-3">
                          <div class="empty-icon-inner">
                            <i class="ri-shield-user-line"></i>
                          </div>
                        </div>
                        <h6 class="fw-semibold mb-1 empty-state-title">Tidak Ada CSIRT</h6>
                        <p class="text-muted fs-13 mb-3">Coba ubah kata kunci pencarian Anda</p>
                        <button v-if="searchQuery" @click="clearSearch" class="btn btn-sm btn-outline-primary rounded-pill px-4">
                          <i class="ri-refresh-line me-1"></i>Reset Pencarian
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-for="(item, i) in displayData" :key="item.id" class="stakeholder-row">
                    <td class="align-middle text-center">
                      <span class="row-number">{{ (currentPage - 1) * itemsPerPage + i + 1 }}</span>
                    </td>
                    <td class="align-middle">
                      <div class="d-flex align-items-center gap-3">
                        <div class="company-avatar" :class="getAvatarClass(item.nama_csirt.charAt(0).toUpperCase())">
                          <img v-if="item.photo_csirt" :src="item.photo_csirt" :alt="item.nama_csirt" class="company-avatar-img" />
                          <span v-else class="company-avatar-letter">{{ item.nama_csirt.charAt(0).toUpperCase() }}</span>
                        </div>
                        <div class="company-name-wrap">
                          <span class="company-name d-block">{{ item.nama_csirt }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="align-middle">
                      <a :href="item.web_csirt" target="_blank" class="email-link d-inline-flex align-items-center gap-1 text-decoration-none">
                        <span class="email-text">{{ item.web_csirt }}</span>
                      </a>
                    </td>
                    <td class="align-middle">
                      <span class="text-muted">{{ item.telepon_csirt }}</span>
                    </td>
                    <td class="text-center align-middle">
                      <div class="d-flex gap-1 justify-content-center">
                        <router-link
                          :to="`/csirt/${item.id}?from=csirt-admin`"
                          class="btn btn-sm btn-icon btn-wave btn-info-light"
                          title="Lihat Profil">
                          <i class="ri-eye-line"></i>
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
                Tambah CSIRT Baru
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" @click="showCreateModal = false"></button>
          </div>
          <div class="card-body p-4 bg-white">
            <form @submit.prevent="createCsirt">
              <div class="row gy-4">
                <!-- Photo Section -->
                <div class="col-xl-12">
                  <div class="d-flex flex-column flex-sm-row gap-3 align-items-start">
                    <!-- Photo Preview -->
                    <div 
                      class="photo-preview-modal position-relative overflow-hidden rounded-3 shadow-sm border flex-shrink-0"
                      :style="{ 
                        backgroundImage: formData.photo_csirt ? `url(${formData.photo_csirt})` : 'none',
                        backgroundColor: formData.photo_csirt ? 'transparent' : '#e9ecef',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }"
                    >
                      <!-- Empty State -->
                      <div v-if="!formData.photo_csirt" class="position-absolute d-flex flex-column align-items-center justify-content-center text-muted photo-empty-state">
                        <i class="ri-image-add-line fs-2 mb-1 opacity-50"></i>
                        <span class="fs-11">Belum ada logo</span>
                      </div>
                    </div>
                    <input ref="fileInput" type="file" :accept="ALLOWED_FORMATS.join(',')" class="d-none" @change="onFileChange" />
                    
                    <!-- Photo Info & Actions -->
                    <div class="flex-grow-1">
                      <h6 class="fw-semibold mb-3 d-flex align-items-center gap-2">
                        <i class="ri-image-2-line text-primary"></i>
                        Logo CSIRT
                      </h6>
                      <div class="d-flex flex-wrap gap-2 mb-2">
                        <button type="button" class="btn btn-primary btn-sm" @click="triggerFileInput">
                          <i class="ri-upload-2-line me-1"></i>
                          {{ formData.photo_csirt ? 'Ganti Logo' : 'Upload Logo' }}
                        </button>
                        <button v-if="formData.photo_csirt" type="button" class="btn btn-outline-danger btn-sm" @click="removeImage">
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

                <!-- Nama CSIRT -->
                <div class="col-xl-12">
                  <label class="form-label fw-medium">
                    <i class="ri-building-line me-1 text-primary"></i>Nama CSIRT <span class="text-danger">*</span>
                  </label>
                  <input type="text" class="form-control" v-model="formData.nama_csirt" :class="{ 'is-invalid': formErrors.nama_csirt }" placeholder="Masukkan nama CSIRT" />
                  <div v-if="formErrors.nama_csirt" class="invalid-feedback">
                    {{ formErrors.nama_csirt }}
                  </div>
                </div>

                <!-- Website -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-global-line me-1 text-primary"></i>Website CSIRT <span class="text-danger">*</span>
                  </label>
                  <input type="url" class="form-control" v-model="formData.web_csirt" :class="{ 'is-invalid': formErrors.web_csirt }" placeholder="https://csirt.example.com" />
                  <div v-if="formErrors.web_csirt" class="invalid-feedback">
                    {{ formErrors.web_csirt }}
                  </div>
                </div>

                <!-- Phone -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-phone-line me-1 text-primary"></i>Nomor Telepon <span class="text-danger">*</span>
                  </label>
                  <div class="input-group" :class="{ 'is-invalid': formErrors.telepon_csirt }">
                    <CountryCodeDropdown 
                      v-model="selectedCountryCode" 
                      :error="!!formErrors.telepon_csirt"
                      @update:modelValue="handleCountryCodeChange"
                    />
                    <input 
                      type="tel" 
                      class="form-control" 
                      v-model="phoneNumber"
                      @input="handlePhoneInput"
                      inputmode="numeric" 
                      placeholder="813-8282-8282"
                      :class="{ 'is-invalid': formErrors.telepon_csirt }"
                    />
                  </div>
                  <div v-if="formErrors.telepon_csirt" class="invalid-feedback d-block">
                    {{ formErrors.telepon_csirt }}
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="card-footer bg-light d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-outline-danger" @click="showCreateModal = false">
              <i class="ri-close-line me-1"></i>Batal
            </button>
            <button type="button" class="btn btn-secondary" @click="createCsirt">
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
              <i class="ri-edit-2-line text-white me-2 fs-18"></i>
              <div class="card-title text-white mb-0">
                Edit CSIRT - Profil Keamanan
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" @click="showEditModal = false"></button>
          </div>
          <div class="card-body p-4 bg-white">
            <form @submit.prevent="updateCsirt">
              <div class="row gy-4">
                <!-- Photo Section -->
                <div class="col-xl-12">
                  <div class="d-flex flex-column flex-sm-row gap-3 align-items-start">
                    <!-- Photo Preview -->
                    <div 
                      class="photo-preview-modal position-relative overflow-hidden rounded-3 shadow-sm border flex-shrink-0"
                      :style="{ 
                        backgroundImage: formData.photo_csirt ? `url(${formData.photo_csirt})` : 'none',
                        backgroundColor: formData.photo_csirt ? 'transparent' : '#e9ecef',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }"
                    >
                      <!-- Empty State -->
                      <div v-if="!formData.photo_csirt" class="position-absolute d-flex flex-column align-items-center justify-content-center text-muted photo-empty-state">
                        <i class="ri-image-add-line fs-2 mb-1 opacity-50"></i>
                        <span class="fs-11">Belum ada logo</span>
                      </div>
                    </div>
                    <input ref="fileInput" type="file" :accept="ALLOWED_FORMATS.join(',')" class="d-none" @change="onFileChange" />
                    
                    <!-- Photo Info & Actions -->
                    <div class="flex-grow-1">
                      <h6 class="fw-semibold mb-3 d-flex align-items-center gap-2">
                        <i class="ri-image-2-line text-primary"></i>
                        Logo CSIRT
                      </h6>
                      <div class="d-flex flex-wrap gap-2 mb-2">
                        <button type="button" class="btn btn-primary btn-sm" @click="triggerFileInput">
                          <i class="ri-upload-2-line me-1"></i>
                          {{ formData.photo_csirt ? 'Ganti Logo' : 'Upload Logo' }}
                        </button>
                        <button v-if="formData.photo_csirt" type="button" class="btn btn-outline-danger btn-sm" @click="removeImage">
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

                <!-- Nama CSIRT -->
                <div class="col-xl-12">
                  <label class="form-label fw-medium">
                    <i class="ri-building-line me-1 text-primary"></i>Nama CSIRT <span class="text-danger">*</span>
                  </label>
                  <input type="text" class="form-control" v-model="formData.nama_csirt" :class="{ 'is-invalid': formErrors.nama_csirt }" placeholder="Masukkan nama CSIRT" />
                  <div v-if="formErrors.nama_csirt" class="invalid-feedback">
                    {{ formErrors.nama_csirt }}
                  </div>
                </div>

                <!-- Website -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-global-line me-1 text-primary"></i>Website CSIRT <span class="text-danger">*</span>
                  </label>
                  <input type="url" class="form-control" v-model="formData.web_csirt" :class="{ 'is-invalid': formErrors.web_csirt }" placeholder="https://csirt.example.com" />
                  <div v-if="formErrors.web_csirt" class="invalid-feedback">
                    {{ formErrors.web_csirt }}
                  </div>
                </div>

                <!-- Phone -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-phone-line me-1 text-primary"></i>Nomor Telepon <span class="text-danger">*</span>
                  </label>
                  <div class="input-group" :class="{ 'is-invalid': formErrors.telepon_csirt }">
                    <CountryCodeDropdown 
                      v-model="selectedCountryCode" 
                      :error="!!formErrors.telepon_csirt"
                      @update:modelValue="handleCountryCodeChange"
                    />
                    <input 
                      type="tel" 
                      class="form-control" 
                      v-model="phoneNumber"
                      @input="handlePhoneInput"
                      inputmode="numeric" 
                      placeholder="813-8282-8282"
                      :class="{ 'is-invalid': formErrors.telepon_csirt }"
                    />
                  </div>
                  <div v-if="formErrors.telepon_csirt" class="invalid-feedback d-block">
                    {{ formErrors.telepon_csirt }}
                  </div>
                </div>

                <!-- Action Buttons -->
                <div class="col-12">
                  <div class="d-flex justify-content-end gap-2">
                    <button type="button" @click="showEditModal = false" class="btn btn-outline-danger">
                      <i class="ri-arrow-left-line me-1"></i>Batal
                    </button>
                    <button type="submit" class="btn btn-secondary" @click.prevent="updateCsirt">
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
              Anda akan menghapus CSIRT
              <strong>{{ currentDeleteItem?.nama_csirt }}</strong
              >. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="showDeleteModal = false">Batal</button>
          <button type="button" class="btn btn-danger" @click="deleteCsirt">
            <i class="ri-delete-bin-line me-1"></i>Hapus
          </button>
        </div>
      </div>
    </div>
  </div>
</template>


<style>
/* Global style untuk modal - tidak scoped agar bisa override */
@media (min-width: 992px) {
  .modal.fade.show.d-block .modal-dialog {
    margin-left: calc(250px + ((100% - 250px - 1000px) / 2)) !important;
    margin-right: auto !important;
  }
}
</style>
