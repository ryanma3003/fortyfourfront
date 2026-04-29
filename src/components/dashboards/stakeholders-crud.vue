<script lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useStakeholdersStore } from "../../stores/stakeholders";
import type { Stakeholder, CreateStakeholderPayload } from "../../types/stakeholders.types";
import { useAuthStore } from "../../stores/auth";
import { subSektorService, getSubSektorName } from "../../services/sektor.service";
import type { SubSektor } from "../../services/sektor.service";

export default {
  data() {
    return {
      dataToPass: {
        title: { label: "Dashboards", path: "/dashboards" },
        currentpage: "Stakeholders CRUD",
        activepage: "Stakeholders CRUD",
      },
    };
  },
  components: { Pageheader },
  setup() {
    const authStore = useAuthStore();
    const stakeholdersStore = useStakeholdersStore();
    const isAdmin = computed(() => authStore.isAdmin);
    const isFullAdmin = computed(() => authStore.isFullAdmin);
    
    // Derived from store
    const items = computed(() => stakeholdersStore.stakeholders);
    const loading = computed(() => stakeholdersStore.loading);
    
    const searchQuery = ref("");
    const sortField = ref<"nama_perusahaan">("nama_perusahaan");
    const sortOrder = ref<"asc" | "desc">("asc");
    const subSektorList = ref<SubSektor[]>([]);
    const loadingSubSektors = ref(false);
    const selectedSubSektorId = ref<string | number | "">("");
    const photoFile = ref<File | null>(null);
    const currentPage = ref(1);
    const itemsPerPage = ref(10);

    // CRUD state
    const showCreateModal = ref(false);
    const showEditModal = ref(false);
    const showDeleteModal = ref(false);
    const currentEditItem = ref<Stakeholder | null>(null);
    const currentDeleteItem = ref<Stakeholder | null>(null);
    const showToast = ref(false);
    const toastMessage = ref("");
    const toastType = ref<"success" | "error">("success");

    // Form state
    const formData = ref<Partial<Stakeholder>>({
      nama_perusahaan: "",
      email: "",
      alamat: "",
      telepon: "",
      website: "",
      photo: "",
    });

    const formErrors = ref<Record<string, string>>({});

    const headers = [
      { text: "Nama Perusahaan", value: "nama_perusahaan", sortable: true },
      { text: "Sektor", value: "sektor", sortable: true },
      { text: "Email", value: "email", sortable: true },
      { text: "Aksi", value: "id" },
    ];

    const loadAllSubSektors = async () => {
      loadingSubSektors.value = true;
      try { subSektorList.value = await subSektorService.getAll(); }
      catch (e) { console.error('Failed to load sub sektors:', e); }
      finally { loadingSubSektors.value = false; }
    };

    const loadStakeholders = async () => {
      await Promise.all([stakeholdersStore.initialize(), loadAllSubSektors()]);
    };

    const filteredData = computed(() => {
      let data = items.value;
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        data = data.filter(
          (i: Stakeholder) =>
            i.nama_perusahaan.toLowerCase().includes(q) ||
            (i.sub_sektor?.nama_sub_sektor || i.sektor || '').toLowerCase().includes(q) ||
            i.email.toLowerCase().includes(q)
        );
      }
      return [...data].sort((a: Stakeholder, b: Stakeholder) => {
        const mod = sortOrder.value === "asc" ? 1 : -1;
        const valA = a[sortField.value] || "";
        const valB = b[sortField.value] || "";
        return valA.localeCompare(valB) * mod;
      });
    });

    const totalPages = computed(() =>
      Math.ceil(filteredData.value.length / itemsPerPage.value)
    );

    const displayData = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredData.value.slice(start, start + itemsPerPage.value);
    });

    const paginationInfo = computed(() => {
      const total = filteredData.value.length;
      if (!total) return "Tidak ada data";
      const start = (currentPage.value - 1) * itemsPerPage.value + 1;
      const end = Math.min(currentPage.value * itemsPerPage.value, total);
      return `${start} - ${end} dari ${total}`;
    });

    // Form validation
    const validateForm = (): boolean => {
      formErrors.value = {};
      let isValid = true;

      if (!formData.value.nama_perusahaan?.trim()) {
        formErrors.value.nama_perusahaan = "Nama perusahaan wajib diisi";
        isValid = false;
      }

      if (!selectedSubSektorId.value) {
        formErrors.value.sektor = "Sub sektor wajib diisi";
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
        formErrors.value.website = "Format website tidak valid (harus dimulai dengan http:// atau https://)";
        isValid = false;
      }

      return isValid;
    };

    // Show toast notification
    const showNotification = (message: string, type: "success" | "error" = "success") => {
      toastMessage.value = message;
      toastType.value = type;
      showToast.value = true;
      setTimeout(() => {
        showToast.value = false;
      }, 3000);
    };

    // CREATE
    const openCreateModal = () => {
      formData.value = {
        nama_perusahaan: "",
        email: "",
        alamat: "",
        telepon: "",
        website: "",
        photo: "",
      };
      selectedSubSektorId.value = "";
      photoFile.value = null;
      formErrors.value = {};
      showCreateModal.value = true;
    };

    const createStakeholder = async () => {
      if (!validateForm()) return;

      const payload: CreateStakeholderPayload = {
        nama_perusahaan: formData.value.nama_perusahaan!,
        id_sub_sektor: String(selectedSubSektorId.value),
        email: formData.value.email!,
        alamat: formData.value.alamat!,
        telepon: formData.value.telepon!,
        website: formData.value.website!,
        photo: photoFile.value,
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
      selectedSubSektorId.value = item.sub_sektor?.id || "";
      photoFile.value = null;
      formErrors.value = {};
      showEditModal.value = true;
    };

    const updateStakeholder = async () => {
      if (!validateForm() || !currentEditItem.value) return;

      const payload: CreateStakeholderPayload = {
          nama_perusahaan: formData.value.nama_perusahaan!,
          id_sub_sektor: String(selectedSubSektorId.value),
          email: formData.value.email!,
          alamat: formData.value.alamat!,
          telepon: formData.value.telepon!,
          website: formData.value.website!,
          photo: photoFile.value,
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

    watch([searchQuery, itemsPerPage], () => (currentPage.value = 1));

    onMounted(loadStakeholders);

    const fileInput = ref<HTMLInputElement | null>(null);

    // Image validation constants
    const MAX_FILE_SIZE_MB = 2;
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

        photoFile.value = file;
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

    return {
      isAdmin, isFullAdmin,
      items,
      loading,
      searchQuery,
      headers,
      sortField,
      sortOrder,
      currentPage,
      itemsPerPage,
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
      subSektorList,
      loadingSubSektors,
      selectedSubSektorId,
      photoFile,
      getSubSektorName,
      toggleSort: (f: "nama_perusahaan") => {
        if (sortField.value === f)
          sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
        else {
          sortField.value = f;
          sortOrder.value = "asc";
        }
      },
      clearSearch: () => {
        searchQuery.value = "";
        currentPage.value = 1;
      },
      fileInput,
      triggerFileInput,
      onFileChange,
      removeImage,
      ALLOWED_EXTENSIONS,
      MAX_FILE_SIZE_MB,
      ALLOWED_FORMATS,
      getSektorBadgeClass: (sektor: string) => {
        const sektorColors: Record<string, string> = {
          'Hasil hutan & perkebunan': 'bg-success-transparent text-success',
          'Pangan & perikanan': 'bg-teal-transparent text-teal',
          'Minuman, tembakau & bahan penyegar': 'bg-warning-transparent text-warning',
          'Kemurgi, oleokimia & pakan': 'bg-orange-transparent text-orange',
          'Kimia hulu': 'bg-info-transparent text-info',
          'Kimia hilir & farmasi': 'bg-danger-transparent text-danger',
          'Semen, keramik & nonlogam': 'bg-secondary-transparent text-secondary',
          'Tekstil, kulit & alas kaki': 'bg-primary-transparent text-primary',
          'Logam': 'bg-indigo-transparent text-indigo',
          'Permesinan & alat pertanian': 'bg-secondary-transparent text-secondary',
          'Transportasi, maritim & pertahanan': 'bg-info-transparent text-info',
          'Elektronika & telematika': 'bg-primary-transparent text-primary',
        };
        return sektorColors[sektor] || 'bg-light text-muted';
      },
    };
  },
};
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Toast Notification -->
  <div
    v-if="showToast"
    class="position-fixed top-0 end-0 p-3"
    style="z-index: 9999"
  >
    <div
      class="toast show"
      :class="{
        'bg-success': toastType === 'success',
        'bg-danger': toastType === 'error',
      }"
      role="alert"
    >
      <div class="toast-body text-white">
        <i
          :class="
            toastType === 'success'
              ? 'ri-checkbox-circle-line'
              : 'ri-error-warning-line'
          "
          class="me-2"
        ></i>
        {{ toastMessage }}
      </div>
    </div>
  </div>

  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card">
        <div
          class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3"
        >
          <div class="card-title">Tabel Daftar Stakeholders (CRUD)</div>
          <div class="d-flex gap-2 align-items-center flex-wrap flex-grow-1">
            <div
              class="search-container position-relative"
              style="max-width: 350px; flex: 1"
            >
              <input
                v-model="searchQuery"
                type="text"
                class="form-control form-control-sm"
                placeholder="Cari perusahaan, sektor, atau email"
              />
              <i v-if="!searchQuery" class="ri-search-line search-icon"></i>
              <button v-else @click="clearSearch" class="btn btn-sm clear-btn">
                <i class="ri-close-line"></i>
              </button>
            </div>
            <button v-if="isAdmin"
              @click="openCreateModal"
              class="btn btn-sm btn-primary"
            >
              <i class="ri-add-line me-1"></i>Tambah Stakeholder
            </button>
          </div>
        </div>

        <div class="card-body p-3">
          <div v-if="loading" class="text-center p-4">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>

          <template v-else>
            <!-- Controls -->
            <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
              <div class="d-flex align-items-center gap-2">
                <span class="text-muted fs-13">Tampilkan</span>
                <select
                  v-model="itemsPerPage"
                  class="form-select form-select-sm"
                  style="width: 75px"
                >
                  <option
                    v-for="n in [5, 10, 15, 20, 25, 50]"
                    :key="n"
                    :value="n"
                  >
                    {{ n }}
                  </option>
                </select>
                <span class="text-muted fs-13">per halaman</span>
              </div>
            </div>

            <!-- Table -->
            <div class="table-responsive">
              <table class="table text-nowrap mb-0">
                <thead>
                  <tr>
                    <th>No</th>
                    <th class="sortable">
                      <div class="d-flex align-items-center gap-1">
                        <span
                          class="column-label"
                          @click="toggleSort('nama_perusahaan')"
                          title="Click to toggle sort"
                          >Nama Perusahaan</span
                        >
                        <div class="sort-arrows">
                          <i
                            class="ri-arrow-up-s-line"
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
                          <i
                            class="ri-arrow-down-s-line"
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
                    <th>Sub Sektor</th>
                    <th>Email</th>
                    <th class="text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!displayData.length">
                    <td colspan="5" class="text-center text-muted py-4">
                      <i class="ri-inbox-line fs-2 d-block mb-2"></i>Data tidak
                      ditemukan
                    </td>
                  </tr>
                  <tr v-for="(item, i) in displayData" :key="item.slug">
                    <td>{{ (currentPage - 1) * itemsPerPage + i + 1 }}</td>
                    <td class="fw-semibold">{{ item.nama_perusahaan }}</td>
                    <td>
                      <span class="badge fs-13" :class="getSektorBadgeClass(item.sektor)">{{
                        item.sektor
                      }}</span>
                    </td>
                    <td>{{ item.email }}</td>
                    <td class="text-center">
                      <button v-if="isAdmin"
                        @click="openEditModal(item)"
                        class="btn btn-sm btn-success-light me-1"
                        title="Edit"
                      >
                        <i class="ri-edit-line"></i>
                      </button>
                      <button v-if="isFullAdmin"
                        @click="openDeleteModal(item)"
                        class="btn btn-sm btn-danger-light"
                        title="Delete"
                      >
                        <i class="ri-delete-bin-line"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div
              v-if="totalPages > 1"
              class="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-3 border-top gap-2"
            >
              <span class="text-muted fs-13"
                >Halaman {{ currentPage }} dari {{ totalPages }}</span
              >
              <nav>
                <ul class="pagination pagination-sm mb-0">
                  <li
                    class="page-item"
                    :class="{ disabled: currentPage === 1 }"
                  >
                    <a
                      class="page-link"
                      href="#"
                      @click.prevent="currentPage = 1"
                      ><i class="ri-skip-back-mini-line"></i
                    ></a>
                  </li>
                  <li
                    class="page-item"
                    :class="{ disabled: currentPage === 1 }"
                  >
                    <a class="page-link" href="#" @click.prevent="currentPage--"
                      ><i class="ri-arrow-left-s-line"></i
                    ></a>
                  </li>
                  <template v-for="p in totalPages" :key="p">
                    <li
                      v-if="
                        p === 1 ||
                        p === totalPages ||
                        (p >= currentPage - 1 && p <= currentPage + 1)
                      "
                      class="page-item"
                      :class="{ active: p === currentPage }"
                    >
                      <a
                        class="page-link"
                        href="#"
                        @click.prevent="currentPage = p"
                        >{{ p }}</a
                      >
                    </li>
                    <li
                      v-else-if="p === currentPage - 2 || p === currentPage + 2"
                      class="page-item disabled"
                    >
                      <span class="page-link">...</span>
                    </li>
                  </template>
                  <li
                    class="page-item"
                    :class="{ disabled: currentPage === totalPages }"
                  >
                    <a class="page-link" href="#" @click.prevent="currentPage++"
                      ><i class="ri-arrow-right-s-line"></i
                    ></a>
                  </li>
                  <li
                    class="page-item"
                    :class="{ disabled: currentPage === totalPages }"
                  >
                    <a
                      class="page-link"
                      href="#"
                      @click.prevent="currentPage = totalPages"
                      ><i class="ri-skip-forward-mini-line"></i
                    ></a>
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
  <div
    v-if="showCreateModal"
    class="modal fade show d-block"
    tabindex="-1"
    style="background-color: rgba(0, 0, 0, 0.5)"
  >
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Tambah Stakeholder Baru</h5>
          <button
            type="button"
            class="btn-close"
            @click="showCreateModal = false"
          ></button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="createStakeholder">
            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label"
                  >Nama Perusahaan <span class="text-danger">*</span></label
                >
                <input
                  v-model="formData.nama_perusahaan"
                  type="text"
                  class="form-control"
                  :class="{ 'is-invalid': formErrors.nama_perusahaan }"
                  placeholder="Masukkan nama perusahaan"
                />
                <div v-if="formErrors.nama_perusahaan" class="invalid-feedback">
                  {{ formErrors.nama_perusahaan }}
                </div>
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label"
                  >Sektor <span class="text-danger">*</span></label
                >
                <select
                  v-model="selectedSubSektorId"
                  class="form-select"
                  :class="{ 'is-invalid': formErrors.sektor }"
                  :disabled="loadingSubSektors"
                >
                    <option value="" disabled>{{ loadingSubSektors ? 'Memuat...' : '-- Pilih Sub Sektor --' }}</option>
                    <option v-for="ss in subSektorList" :key="ss.id" :value="ss.id">{{ getSubSektorName(ss) }}</option>
                </select>
                <div v-if="formErrors.sektor" class="invalid-feedback">
                  {{ formErrors.sektor }}
                </div>
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label"
                  >Email <span class="text-danger">*</span></label
                >
                <input
                  v-model="formData.email"
                  type="email"
                  class="form-control"
                  :class="{ 'is-invalid': formErrors.email }"
                  placeholder="email@example.com"
                />
                <div v-if="formErrors.email" class="invalid-feedback">
                  {{ formErrors.email }}
                </div>
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label"
                  >Telepon <span class="text-danger">*</span></label
                >
                <input
                  v-model="formData.telepon"
                  type="text"
                  class="form-control"
                  :class="{ 'is-invalid': formErrors.telepon }"
                  placeholder="+62 21 1234 5678"
                />
                <div v-if="formErrors.telepon" class="invalid-feedback">
                  {{ formErrors.telepon }}
                </div>
              </div>
              <div class="col-md-12 mb-3">
                <label class="form-label"
                  >Alamat <span class="text-danger">*</span></label
                >
                <textarea
                  v-model="formData.alamat"
                  class="form-control"
                  :class="{ 'is-invalid': formErrors.alamat }"
                  rows="2"
                  placeholder="Masukkan alamat lengkap"
                ></textarea>
                <div v-if="formErrors.alamat" class="invalid-feedback">
                  {{ formErrors.alamat }}
                </div>
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label"
                  >Website <span class="text-danger">*</span></label
                >
                <input
                  v-model="formData.website"
                  type="url"
                  class="form-control"
                  :class="{ 'is-invalid': formErrors.website }"
                  placeholder="https://example.com"
                />
                <div v-if="formErrors.website" class="invalid-feedback">
                  {{ formErrors.website }}
                </div>
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label">Photo URL (Opsional)</label>
                <input
                  v-model="formData.photo"
                  type="text"
                  class="form-control"
                  placeholder="/images/media/photo.png"
                />
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            @click="showCreateModal = false"
          >
            Batal
          </button>
          <button type="button" class="btn btn-primary" @click="createStakeholder">
            <i class="ri-save-line me-1"></i>Simpan
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Edit Modal -->
  <div
    v-if="showEditModal"
    class="modal fade show d-block"
    tabindex="-1"
    style="background-color: rgba(0, 0, 0, 0.5)"
  >
    <div class="modal-dialog modal-dialog-centered modal-xl">
      <div class="modal-content border-0 bg-transparent">
        <div class="card custom-card gradient-header-card w-100 mb-0">
          <div
            class="card-header d-flex justify-content-between align-items-center"
            style="background: linear-gradient(90deg, #1e3a5f 0%, #2c5282 100%)"
          >
            <div class="d-flex align-items-center">
              <i class="ri-building-2-line text-white me-2 fs-18"></i>
              <div class="card-title text-white mb-0">
                Edit Stakeholder - Informasi Perusahaan
              </div>
            </div>
            <button
              type="button"
              class="btn-close btn-close-white"
              @click="showEditModal = false"
            ></button>
          </div>
          <div class="card-body p-4 bg-white">
            <form @submit.prevent="updateStakeholder">
              <div class="row gy-4">
                <!-- Profile Picture Section -->
                <div class="col-xl-12">
                  <div class="d-flex align-items-start flex-wrap gap-3">
                    <div class="position-relative">
                      <span
                        class="avatar avatar-xxl avatar-rounded shadow border border-2 border-light overflow-hidden"
                      >
                        <img
                          :src="formData.photo || '/images/faces/9.jpg'"
                          alt="Profile Avatar"
                        />
                      </span>
                      <input
                        ref="fileInput"
                        type="file"
                        :accept="ALLOWED_FORMATS.join(',')"
                        class="d-none"
                        @change="onFileChange"
                      />
                    </div>
                    <div>
                      <span class="fw-medium d-block mb-2"
                        >Profile Picture</span
                      >
                      <div class="btn-list mb-1">
                        <button
                          type="button"
                          class="btn btn-sm btn-primary btn-wave me-1"
                          @click="triggerFileInput"
                        >
                          <i class="ri-upload-2-line me-1"></i>Change Image
                        </button>
                        <button
                          type="button"
                          class="btn btn-sm btn-light btn-wave"
                          @click="removeImage"
                        >
                          <i class="ri-delete-bin-line me-1"></i>Remove
                        </button>
                      </div>
                      <span class="d-block fs-12 text-muted">
                        <i class="ri-information-line me-1"></i>
                        Format: {{ ALLOWED_EXTENSIONS }} | Max:
                        {{ MAX_FILE_SIZE_MB }}MB | Best size: 200x200 pixels
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Nama Perusahaan -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-building-line me-1 text-primary"></i>Nama
                    Perusahaan <span class="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    class="form-control"
                    v-model="formData.nama_perusahaan"
                    :class="{ 'is-invalid': formErrors.nama_perusahaan }"
                    placeholder="Masukkan nama perusahaan"
                  />
                  <div
                    v-if="formErrors.nama_perusahaan"
                    class="invalid-feedback"
                  >
                    {{ formErrors.nama_perusahaan }}
                  </div>
                </div>

                <!-- Sektor -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-pie-chart-line me-1 text-primary"></i>Sektor
                    <span class="text-danger">*</span>
                  </label>
                  <select
                    v-model="selectedSubSektorId"
                    class="form-select"
                    :class="{ 'is-invalid': formErrors.sektor }"
                    :disabled="loadingSubSektors"
                  >
                    <option value="" disabled>{{ loadingSubSektors ? 'Memuat...' : '-- Pilih Sub Sektor --' }}</option>
                    <option v-for="ss in subSektorList" :key="ss.id" :value="ss.id">{{ getSubSektorName(ss) }}</option>
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
                  <input
                    type="email"
                    class="form-control"
                    v-model="formData.email"
                    :class="{ 'is-invalid': formErrors.email }"
                    placeholder="Masukkan email"
                  />
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
                    :class="{ 'is-invalid': formErrors.telepon }"
                    placeholder="Masukkan nomor telepon"
                  />
                  <div v-if="formErrors.telepon" class="invalid-feedback">
                    {{ formErrors.telepon }}
                  </div>
                </div>

                <!-- Website -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-global-line me-1 text-primary"></i>Website
                    <span class="text-danger">*</span>
                  </label>
                  <input
                    type="url"
                    class="form-control"
                    v-model="formData.website"
                    :class="{ 'is-invalid': formErrors.website }"
                    placeholder="Masukkan website"
                  />
                  <div v-if="formErrors.website" class="invalid-feedback">
                    {{ formErrors.website }}
                  </div>
                </div>

                <!-- Empty column for alignment -->
                <div
                  class="col-xl-6 col-lg-6 col-md-6 d-none d-md-block"
                ></div>

                <!-- Alamat -->
                <div class="col-12">
                  <label class="form-label fw-medium">
                    <i class="ri-map-pin-line me-1 text-primary"></i>Alamat
                    <span class="text-danger">*</span>
                  </label>
                  <textarea
                    class="form-control"
                    v-model="formData.alamat"
                    :class="{ 'is-invalid': formErrors.alamat }"
                    rows="3"
                    placeholder="Masukkan alamat lengkap"
                  ></textarea>
                  <div v-if="formErrors.alamat" class="invalid-feedback">
                    {{ formErrors.alamat }}
                  </div>
                </div>

                <!-- Action Buttons -->
                <div class="col-12">
                  <div class="d-flex justify-content-end gap-2">
                    <button
                      type="button"
                      @click="showEditModal = false"
                      class="btn btn-outline-danger"
                    >
                      <i class="ri-arrow-left-line me-1"></i>Batal
                    </button>
                    <button
                      type="submit"
                      class="btn btn-secondary"
                    >
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
  <div
    v-if="showDeleteModal"
    class="modal fade show d-block"
    tabindex="-1"
    style="background-color: rgba(0, 0, 0, 0.5)"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Konfirmasi Hapus</h5>
          <button
            type="button"
            class="btn-close"
            @click="showDeleteModal = false"
          ></button>
        </div>
        <div class="modal-body">
          <div class="text-center">
            <i class="ri-error-warning-line text-danger" style="font-size: 3rem"></i>
            <h5 class="mt-3">Apakah Anda yakin?</h5>
            <p class="text-muted">
              Anda akan menghapus stakeholder
              <strong>{{ currentDeleteItem?.nama_perusahaan }}</strong
              >. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            @click="showDeleteModal = false"
          >
            Batal
          </button>
          <button type="button" class="btn btn-danger" @click="deleteStakeholder">
            <i class="ri-delete-bin-line me-1"></i>Hapus
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gradient-header-card {
  border: none !important;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075) !important;
  overflow: hidden !important;
}

.gradient-header-card .card-header {
  border: none !important;
  border-bottom: none !important;
  border-block-end: none !important;
  border-radius: 0 !important;
  margin: 0 !important;
}

.gradient-header-card .card-body {
  border: 1px solid var(--default-border);
  border-top: none !important;
  border-radius: 0 !important;
}

.cursor-pointer {
  cursor: pointer;
}

.search-container {
  position: relative;
}

.search-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #8c9097;
  pointer-events: none;
}

.clear-btn {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: none;
  color: #8c9097;
}

.clear-btn:hover {
  color: #495057;
}

.sortable {
  cursor: pointer;
  user-select: none;
}

.column-label {
  cursor: pointer;
}

.sort-arrows {
  display: flex;
  flex-direction: column;
  line-height: 0.5;
}

.sort-arrows i {
  font-size: 1rem;
  color: #d1d5db;
  cursor: pointer;
  transition: color 0.2s;
}

.sort-arrows i:hover {
  color: #6b7280;
}

.sort-arrows i.active {
  color: #3b82f6;
}

.modal.show {
  display: block;
}

.toast {
  min-width: 250px;
}
</style>
