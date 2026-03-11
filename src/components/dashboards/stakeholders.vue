<script lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";

import { useStakeholdersStore } from "../../stores/stakeholders";
import type { Stakeholder, CreateStakeholderPayload } from "../../types/stakeholders.types";
import EasyDataTable from "vue3-easy-data-table";
import "vue3-easy-data-table/dist/style.css";
import { useAuthStore } from "../../stores/auth";
import { useIkasStore } from "../../stores/ikas";
import { useKseStore } from "../../stores/kse";
import { useCsirtStore } from "../../stores/csirt";
import { useListPage } from "../../composables/useListPage";
import { subSektorService, sektorService, getSektorName, getSubSektorName, getSubSektorParentId } from "../../services/sektor.service";
import type { SubSektor, Sektor } from "../../services/sektor.service";



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
    const csirtStore = useCsirtStore();
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

    // Sektor + Sub-Sektor state
    const sektorList = ref<Sektor[]>([]);
    const subSektorList = ref<SubSektor[]>([]);
    const loadingSubSektors = ref(false);
    const selectedSektorId = ref<string | number | "">("");
    const selectedSubSektorId = ref<string | number | "">("");

    // Filtered sub sektor berdasarkan sektor yang dipilih
    const filteredSubSektorList = computed(() => {
      if (!selectedSektorId.value) return [];
      return subSektorList.value.filter(ss => {
        const pid = getSubSektorParentId(ss);
        return pid !== undefined && String(pid) === String(selectedSektorId.value);
      });
    });

    // ✅ Auto-set formData.sektor (nama) dan selectedSektorId ketika sub sektor ID dipilih
    watch(selectedSubSektorId, (newId) => {
      if (newId && subSektorList.value.length) {
        const matched = subSektorList.value.find(ss => String(ss.id) === String(newId));
        if (matched) {
          formData.value.sektor = getSubSektorName(matched);
          const pid = getSubSektorParentId(matched);
          if (pid !== undefined) selectedSektorId.value = pid;
        }
      } else {
        formData.value.sektor = "";
      }
    });

    const loadAllSubSektors = async () => {
      loadingSubSektors.value = true;
      try {
        const [sektors, subSektors] = await Promise.all([
          sektorService.getAll(),
          subSektorService.getAll(),
        ]);
        sektorList.value = sektors;
        subSektorList.value = subSektors;
      } catch (e) {
        console.error("Gagal memuat sektor/sub_sektor:", e);
        sektorList.value = [];
        subSektorList.value = [];
        showNotification("Data sektor tidak dapat dimuat. Pastikan backend endpoint /api/sektor dan /api/sub_sektor tersedia.", "error");
      } finally {
        loadingSubSektors.value = false;
      }
    };

    // ✅ Helper: Dapatkan nama sektor induk dari nama sub sektor
    const getSektorFromSubSektor = (subSektorName: string): string => {
      if (!subSektorName || !subSektorList.value.length) return "-";
      const matched = subSektorList.value.find(ss => getSubSektorName(ss) === subSektorName);
      if (!matched) return "-";
      const parentId = getSubSektorParentId(matched);
      if (parentId === undefined) return "-";
      const parentSektor = sektorList.value.find(s => String(s.id) === String(parentId));
      return parentSektor ? getSektorName(parentSektor) : "-";
    };

    const headers = [
      { text: "Nama Perusahaan", value: "nama_perusahaan", sortable: true },
      { text: "sub_sektor", value: "sektor", sortable: true },
      { text: "Email", value: "email", sortable: true },
      { text: "Aksi", value: "id" },
    ];

    const loadStakeholders = async () => {
      await stakeholdersStore.initialize();
    };

    // Helper: ambil nama sub sektor dari item
    const getItemSubSektorName = (item: Stakeholder): string => {
      return item.sub_sektor?.nama_sub_sektor || item.sektor || "";
    };

    const filteredData = computed(() => {
      let data = stakeholdersStore.allStakeholders;
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        data = data.filter(
          (i) =>
            i.nama_perusahaan.toLowerCase().includes(q) ||
            getItemSubSektorName(i).toLowerCase().includes(q) ||
            i.email.toLowerCase().includes(q)
        );
      }
      return [...data].sort((a, b) => {
        const mod = sortOrder.value === "asc" ? 1 : -1;
        let aVal = "";
        let bVal = "";
        if (sortField.value === "sektor") {
          aVal = getItemSubSektorName(a);
          bVal = getItemSubSektorName(b);
        } else {
          aVal = (a[sortField.value as keyof Stakeholder] as string) || "";
          bVal = (b[sortField.value as keyof Stakeholder] as string) || "";
        }
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
        formErrors.value.website =
          "Format website tidak valid (harus dimulai dengan http:// atau https://)";
        isValid = false;
      }

      return isValid;
    };

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
      selectedSektorId.value = "";
      selectedSubSektorId.value = "";
      photoFile.value = null;
      loadAllSubSektors();
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
    const openEditModal = async (item: Stakeholder) => {
      currentEditItem.value = item;
      formData.value = { ...item };
      formErrors.value = {};
      selectedSektorId.value = "";
      selectedSubSektorId.value = "";
      photoFile.value = null;

      // Load sektor & sub sektor
      await loadAllSubSektors();

      // ✅ Auto-detect sub sektor ID: utamakan dari sub_sektor.id (nested), fallback nama
      if (item.sub_sektor?.id) {
        selectedSubSektorId.value = item.sub_sektor.id;
      } else if (item.sektor) {
        const matched = subSektorList.value.find(ss => getSubSektorName(ss) === item.sektor);
        if (matched) selectedSubSektorId.value = matched.id;
      }

      showEditModal.value = true;
    };

    const updateStakeholder = async () => {
      if (!validateForm() || !currentEditItem.value) return;

      const payload: Partial<CreateStakeholderPayload> = {
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

    onMounted(async () => {
      loadStakeholders();
      ikasStore.initialize();
      kseStore.initialize();
      await csirtStore.initialize();
      // If CSIRTs exist but SDM/SE lists are empty (e.g., global endpoint failed on prior load),
      // force a refresh so hasCompleteCsirt reflects the actual backend state.
      if (csirtStore.csirts.length > 0 && (csirtStore.sdmList.length === 0 || csirtStore.seList.length === 0)) {
        await csirtStore.refresh();
      }
    });

    const fileInput = ref<HTMLInputElement | null>(null);
    const photoFile = ref<File | null>(null);

    const input_nama_perusahaan = ref<HTMLInputElement | null>(null);
    const input_email = ref<HTMLInputElement | null>(null);
    const input_telepon = ref<HTMLInputElement | null>(null);
    const input_website = ref<HTMLInputElement | null>(null);
    const input_alamat = ref<HTMLTextAreaElement | null>(null);

    const focusInput = (field: string) => {
      setTimeout(() => {
        if (field === 'nama_perusahaan' && input_nama_perusahaan.value) input_nama_perusahaan.value.focus();
        else if (field === 'email' && input_email.value) input_email.value.focus();
        else if (field === 'telepon' && input_telepon.value) input_telepon.value.focus();
        else if (field === 'website' && input_website.value) input_website.value.focus();
        else if (field === 'alamat' && input_alamat.value) input_alamat.value.focus();
      }, 50);
    };

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

        if (!ALLOWED_FORMATS.includes(file.type)) {
          showNotification(
            `Format file tidak didukung. Gunakan ${ALLOWED_EXTENSIONS}.`,
            "error"
          );
          target.value = "";
          return;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          showNotification(
            `Ukuran file terlalu besar. Maksimal ${MAX_FILE_SIZE_MB}MB.`,
            "error"
          );
          target.value = "";
          return;
        }

        // Simpan File untuk upload
        photoFile.value = file;
        // Simpan base64 untuk preview
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
      photoFile.value = null;
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
    const hasCompleteCsirt = (id_perusahaan: string | number): boolean => {
      return csirtStore.hasCompleteCsirt(id_perusahaan);
    };

    const countIkasOnly = computed(() =>
      stakeholdersStore.stakeholders.filter(s => hasIkas(s.slug) && !hasCompleteCsirt(s.id)).length
    );
    const countCsirtOnly = computed(() =>
      stakeholdersStore.stakeholders.filter(s => !hasIkas(s.slug) && hasCompleteCsirt(s.id)).length
    );
    const countBoth = computed(() =>
      stakeholdersStore.stakeholders.filter(s => hasIkas(s.slug) && hasCompleteCsirt(s.id)).length
    );
    const countIkas = computed(() =>
      stakeholdersStore.stakeholders.filter(s => hasIkas(s.slug)).length
    );
    const countCsirt = computed(() =>
      stakeholdersStore.stakeholders.filter(s => hasCompleteCsirt(s.id)).length
    );

    return {
      countIkasOnly,
      countCsirtOnly,
      countBoth,
      countIkas,
      countCsirt,
      isAdmin,
      stakeholdersStore,
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
      createStakeholder,
      openEditModal,
      updateStakeholder,
      openDeleteModal,
      deleteStakeholder,
      toggleSort,
      clearSearch,
      fileInput,
      photoFile,
      input_nama_perusahaan,
      input_email,
      input_telepon,
      input_website,
      input_alamat,
      focusInput,
      triggerFileInput,
      onFileChange,
      removeImage,
      getItemSubSektorName,
      ALLOWED_EXTENSIONS,
      MAX_FILE_SIZE_MB,
      ALLOWED_FORMATS,
      subSektorList,
      sektorList,
      filteredSubSektorList,
      loadingSubSektors,
      selectedSektorId,
      selectedSubSektorId,
      getSektorName,
      getSubSektorName,
      getSektorFromSubSektor,

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
      hasCompleteCsirt,
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
                placeholder="Cari perusahaan, sub_sektor, atau email..." />
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
                  <div class="stat-value">{{ new Set(filteredData.map((d) => getItemSubSektorName(d))).size }}</div>
                  <div class="stat-label">Sub Sektor Aktif</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-violet"><i class="ri-check-double-line"></i></div>
                <div>
                  <div class="stat-value">{{ countBoth }}</div>
                  <div class="stat-label">IKAS &amp; CSIRT</div>
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
                  <div class="stat-value">{{ countCsirtOnly }}</div>
                  <div class="stat-label">CSIRT Saja</div>
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
                        <span class="column-label" @click="toggleSort('sektor')" title="Click to toggle sort">Sub Sektor</span>
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
                      <span :class="getSektorBadgeClass(getItemSubSektorName(item))">
                        {{ getItemSubSektorName(item) }}
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
                        <div class="status-badge" :class="hasCompleteCsirt(item.id) ? 'badge-done' : 'badge-pending'" title="CSIRT">
                          <span class="badge-icon-dot">
                            <i :class="hasCompleteCsirt(item.id) ? 'ri-check-line' : 'ri-subtract-line'"></i>
                          </span>
                          <span class="badge-label">CSIRT</span>
                        </div>
                      </div>
                    </td>
                    <td class="text-center align-middle">
                      <div class="d-flex gap-1 justify-content-center">
                        <router-link
                          :to="`/stakeholders/${item.slug}`"
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

  <!-- ===================== CREATE MODAL ===================== -->
  <div v-if="showCreateModal" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="showCreateModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal">
      <div class="modal-content border-0 bg-transparent">
        <div class="card custom-card gradient-header-card w-100 mb-0">
          <div class="card-header d-flex justify-content-between align-items-center gap-3 users-header">
            <div class="d-flex align-items-center gap-3">
              <div class="header-icon-box">
                <i class="ri-add-circle-line"></i>
              </div>
              <div>
                <div class="card-title mb-0 text-white fw-bold header-card-title">Tambah Stakeholder Baru</div>
                <div class="header-subtitle mt-1">Isi data perusahaan stakeholder baru</div>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" @click="showCreateModal = false"></button>
          </div>
          <div class="card-body p-4 bg-white">
            <form @submit.prevent="createStakeholder">
              <div class="row gy-3">
                <!-- Photo Section -->
                <div class="col-xl-12">
                  <div class="d-flex flex-column flex-sm-row gap-3 align-items-start">
                    <div 
                      class="photo-preview-modal position-relative overflow-hidden rounded-3 shadow-sm border flex-shrink-0"
                      :style="{ 
                        backgroundImage: formData.photo ? `url(${formData.photo})` : 'none',
                        backgroundColor: formData.photo ? 'transparent' : '#e9ecef',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }"
                    >
                      <div v-if="!formData.photo" class="position-absolute d-flex flex-column align-items-center justify-content-center text-muted photo-empty-state">
                        <i class="ri-image-add-line fs-2 mb-1 opacity-50"></i>
                        <span class="fs-11">Belum ada foto</span>
                      </div>
                    </div>
                    <input ref="fileInput" type="file" :accept="ALLOWED_FORMATS.join(',')" class="d-none" @change="onFileChange" />
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
                  <div class="form-group-split" @click="focusInput('nama_perusahaan')">
                    <div class="form-group-split-label-card">
                      <div class="form-item-icon stat-icon-blue" style="width:32px;height:32px">
                        <i class="ri-building-line" style="font-size:0.95rem"></i>
                      </div>
                      <label class="form-item-label mb-0">Nama Perusahaan <span class="text-danger ms-1">*</span></label>
                    </div>
                    <div class="form-group-split-input-card" :class="{ 'border-danger': formErrors.nama_perusahaan }">
                      <input ref="input_nama_perusahaan" type="text" class="form-item-input" v-model="formData.nama_perusahaan" :class="{ 'is-invalid': formErrors.nama_perusahaan }" placeholder="Masukkan nama perusahaan" />
                      <div v-if="formErrors.nama_perusahaan" class="invalid-feedback">{{ formErrors.nama_perusahaan }}</div>
                    </div>
                  </div>
                </div>

                <!-- ✅ SUB SEKTOR (semua sub sektor, sektor induk otomatis) -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <div class="form-group-split">
                    <div class="form-group-split-label-card">
                      <div class="form-item-icon stat-icon-teal" style="width:32px;height:32px">
                        <i class="ri-pie-chart-line" style="font-size:0.95rem"></i>
                      </div>
                      <label class="form-item-label mb-0">Sub Sektor <span class="text-danger ms-1">*</span></label>
                    </div>
                    <div class="form-group-split-input-card" :class="{ 'border-danger': formErrors.sektor }">
                      <select
                        v-model="selectedSubSektorId"
                        class="form-item-input form-item-select"
                        :class="{ 'is-invalid': formErrors.sektor }"
                        :disabled="loadingSubSektors"
                      >
                        <option value="" disabled>
                          {{ loadingSubSektors ? 'Memuat...' : '-- Pilih Sub Sektor --' }}
                        </option>
                        <option v-for="ss in subSektorList" :key="ss.id" :value="ss.id">
                          {{ getSubSektorName(ss) }}
                        </option>
                      </select>
                      <div v-if="formErrors.sektor" class="invalid-feedback">{{ formErrors.sektor }}</div>
                      <small v-if="loadingSubSektors" class="text-muted mt-1 d-block">Memuat data sektor...</small>
                    </div>
                  </div>
                </div>

                <!-- Email -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <div class="form-group-split" @click="focusInput('email')">
                    <div class="form-group-split-label-card">
                      <div class="form-item-icon stat-icon-indigo" style="width:32px;height:32px">
                        <i class="ri-mail-line" style="font-size:0.95rem"></i>
                      </div>
                      <label class="form-item-label mb-0">Email <span class="text-danger ms-1">*</span></label>
                    </div>
                    <div class="form-group-split-input-card" :class="{ 'border-danger': formErrors.email }">
                      <input ref="input_email" type="email" class="form-item-input" v-model="formData.email" :class="{ 'is-invalid': formErrors.email }" placeholder="Masukkan email" />
                      <div v-if="formErrors.email" class="invalid-feedback">{{ formErrors.email }}</div>
                    </div>
                  </div>
                </div>

                <!-- Phone -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <div class="form-group-split" @click="focusInput('telepon')">
                    <div class="form-group-split-label-card">
                      <div class="form-item-icon stat-icon-violet" style="width:32px;height:32px">
                        <i class="ri-phone-line" style="font-size:0.95rem"></i>
                      </div>
                      <label class="form-item-label mb-0">Nomor Telepon <span class="text-danger ms-1">*</span></label>
                    </div>
                    <div class="form-group-split-input-card" :class="{ 'border-danger': formErrors.telepon }">
                      <input ref="input_telepon" type="tel" class="form-item-input" v-model="formData.telepon" placeholder="Masukkan nomor telepon" :class="{ 'is-invalid': formErrors.telepon }" />
                      <div v-if="formErrors.telepon" class="invalid-feedback d-block">{{ formErrors.telepon }}</div>
                    </div>
                  </div>
                </div>

                <!-- Website -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <div class="form-group-split" @click="focusInput('website')">
                    <div class="form-group-split-label-card">
                      <div class="form-item-icon stat-icon-amber" style="width:32px;height:32px">
                        <i class="ri-global-line" style="font-size:0.95rem"></i>
                      </div>
                      <label class="form-item-label mb-0">Website <span class="text-danger ms-1">*</span></label>
                    </div>
                    <div class="form-group-split-input-card" :class="{ 'border-danger': formErrors.website }">
                      <input ref="input_website" type="url" class="form-item-input" v-model="formData.website" :class="{ 'is-invalid': formErrors.website }" placeholder="https://contoh.com" />
                      <div v-if="formErrors.website" class="invalid-feedback">{{ formErrors.website }}</div>
                    </div>
                  </div>
                </div>

                <!-- Alamat -->
                <div class="col-12">
                  <div class="form-group-split" @click="focusInput('alamat')">
                    <div class="form-group-split-label-card">
                      <div class="form-item-icon stat-icon-red" style="width:32px;height:32px">
                        <i class="ri-map-pin-line" style="font-size:0.95rem"></i>
                      </div>
                      <label class="form-item-label mb-0">Alamat <span class="text-danger ms-1">*</span></label>
                    </div>
                    <div class="form-group-split-input-card" :class="{ 'border-danger': formErrors.alamat }">
                      <textarea ref="input_alamat" class="form-item-input" v-model="formData.alamat" :class="{ 'is-invalid': formErrors.alamat }" rows="2" placeholder="Masukkan alamat lengkap"></textarea>
                      <div v-if="formErrors.alamat" class="invalid-feedback">{{ formErrors.alamat }}</div>
                    </div>
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

  <!-- ===================== EDIT MODAL ===================== -->
  <div v-if="showEditModal" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="showEditModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal">
      <div class="modal-content border-0 bg-transparent">
        <div class="card custom-card gradient-header-card w-100 mb-0">
          <div class="card-header d-flex justify-content-between align-items-center gap-3 users-header">
            <div class="d-flex align-items-center gap-3">
              <div class="header-icon-box">
                <i class="ri-building-2-line"></i>
              </div>
              <div>
                <div class="card-title mb-0 text-white fw-bold header-card-title">Edit Stakeholder</div>
                <div class="header-subtitle mt-1">Edit data detail informasi perusahaan</div>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" @click="showEditModal = false"></button>
          </div>
          <div class="card-body p-4 bg-white">
            <form @submit.prevent="updateStakeholder">
              <div class="row gy-3">
                <!-- Photo Section -->
                <div class="col-xl-12">
                  <div class="d-flex flex-column flex-sm-row gap-3 align-items-start">
                    <div 
                      class="photo-preview-modal position-relative overflow-hidden rounded-3 shadow-sm border flex-shrink-0"
                      :style="{ 
                        backgroundImage: formData.photo ? `url(${formData.photo})` : 'none',
                        backgroundColor: formData.photo ? 'transparent' : '#e9ecef',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }"
                    >
                      <div v-if="!formData.photo" class="position-absolute d-flex flex-column align-items-center justify-content-center text-muted photo-empty-state">
                        <i class="ri-image-add-line fs-2 mb-1 opacity-50"></i>
                        <span class="fs-11">Belum ada foto</span>
                      </div>
                    </div>
                    <input ref="fileInput" type="file" :accept="ALLOWED_FORMATS.join(',')" class="d-none" @change="onFileChange" />
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
                  <div class="form-group-split" @click="focusInput('nama_perusahaan')">
                    <div class="form-group-split-label-card">
                      <div class="form-item-icon stat-icon-blue" style="width:32px;height:32px">
                        <i class="ri-building-line" style="font-size:0.95rem"></i>
                      </div>
                      <label class="form-item-label mb-0">Nama Perusahaan <span class="text-danger ms-1">*</span></label>
                    </div>
                    <div class="form-group-split-input-card" :class="{ 'border-danger': formErrors.nama_perusahaan }">
                      <input ref="input_nama_perusahaan" type="text" class="form-item-input" v-model="formData.nama_perusahaan" :class="{ 'is-invalid': formErrors.nama_perusahaan }" placeholder="Masukkan nama perusahaan" />
                      <div v-if="formErrors.nama_perusahaan" class="invalid-feedback">{{ formErrors.nama_perusahaan }}</div>
                    </div>
                  </div>
                </div>

                <!-- ✅ SUB SEKTOR (semua sub sektor, sektor induk otomatis) -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <div class="form-group-split">
                    <div class="form-group-split-label-card">
                      <div class="form-item-icon stat-icon-teal" style="width:32px;height:32px">
                        <i class="ri-pie-chart-line" style="font-size:0.95rem"></i>
                      </div>
                      <label class="form-item-label mb-0">Sub Sektor <span class="text-danger ms-1">*</span></label>
                    </div>
                    <div class="form-group-split-input-card" :class="{ 'border-danger': formErrors.sektor }">
                      <select
                        v-model="selectedSubSektorId"
                        class="form-item-input form-item-select"
                        :class="{ 'is-invalid': formErrors.sektor }"
                        :disabled="loadingSubSektors"
                      >
                        <option value="" disabled>
                          {{ loadingSubSektors ? 'Memuat...' : '-- Pilih Sub Sektor --' }}
                        </option>
                        <option v-for="ss in subSektorList" :key="ss.id" :value="ss.id">
                          {{ getSubSektorName(ss) }}
                        </option>
                      </select>
                      <div v-if="formErrors.sektor" class="invalid-feedback">{{ formErrors.sektor }}</div>
                      <small v-if="loadingSubSektors" class="text-muted mt-1 d-block">Memuat data sektor...</small>
                    </div>
                  </div>
                </div>

                <!-- Email -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <div class="form-group-split" @click="focusInput('email')">
                    <div class="form-group-split-label-card">
                      <div class="form-item-icon stat-icon-indigo" style="width:32px;height:32px">
                        <i class="ri-mail-line" style="font-size:0.95rem"></i>
                      </div>
                      <label class="form-item-label mb-0">Email <span class="text-danger ms-1">*</span></label>
                    </div>
                    <div class="form-group-split-input-card" :class="{ 'border-danger': formErrors.email }">
                      <input ref="input_email" type="email" class="form-item-input" v-model="formData.email" :class="{ 'is-invalid': formErrors.email }" placeholder="Masukkan email" />
                      <div v-if="formErrors.email" class="invalid-feedback">{{ formErrors.email }}</div>
                    </div>
                  </div>
                </div>

                <!-- Phone -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <div class="form-group-split" @click="focusInput('telepon')">
                    <div class="form-group-split-label-card">
                      <div class="form-item-icon stat-icon-violet" style="width:32px;height:32px">
                        <i class="ri-phone-line" style="font-size:0.95rem"></i>
                      </div>
                      <label class="form-item-label mb-0">Nomor Telepon <span class="text-danger ms-1">*</span></label>
                    </div>
                    <div class="form-group-split-input-card" :class="{ 'border-danger': formErrors.telepon }">
                      <input ref="input_telepon" type="tel" class="form-item-input" v-model="formData.telepon" placeholder="Masukkan nomor telepon" :class="{ 'is-invalid': formErrors.telepon }" />
                      <div v-if="formErrors.telepon" class="invalid-feedback d-block">{{ formErrors.telepon }}</div>
                    </div>
                  </div>
                </div>

                <!-- Website -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <div class="form-group-split" @click="focusInput('website')">
                    <div class="form-group-split-label-card">
                      <div class="form-item-icon stat-icon-amber" style="width:32px;height:32px">
                        <i class="ri-global-line" style="font-size:0.95rem"></i>
                      </div>
                      <label class="form-item-label mb-0">Website <span class="text-danger ms-1">*</span></label>
                    </div>
                    <div class="form-group-split-input-card" :class="{ 'border-danger': formErrors.website }">
                      <input ref="input_website" type="url" class="form-item-input" v-model="formData.website" :class="{ 'is-invalid': formErrors.website }" placeholder="https://contoh.com" />
                      <div v-if="formErrors.website" class="invalid-feedback">{{ formErrors.website }}</div>
                    </div>
                  </div>
                </div>

                <!-- Alamat -->
                <div class="col-12">
                  <div class="form-group-split" @click="focusInput('alamat')">
                    <div class="form-group-split-label-card">
                      <div class="form-item-icon stat-icon-red" style="width:32px;height:32px">
                        <i class="ri-map-pin-line" style="font-size:0.95rem"></i>
                      </div>
                      <label class="form-item-label mb-0">Alamat <span class="text-danger ms-1">*</span></label>
                    </div>
                    <div class="form-group-split-input-card" :class="{ 'border-danger': formErrors.alamat }">
                      <textarea ref="input_alamat" class="form-item-input" v-model="formData.alamat" :class="{ 'is-invalid': formErrors.alamat }" rows="2" placeholder="Masukkan alamat lengkap"></textarea>
                      <div v-if="formErrors.alamat" class="invalid-feedback">{{ formErrors.alamat }}</div>
                    </div>
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

  <!-- ===================== DELETE MODAL ===================== -->
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
              <strong>{{ currentDeleteItem?.nama_perusahaan }}</strong>.
              Tindakan ini tidak dapat dibatalkan.
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