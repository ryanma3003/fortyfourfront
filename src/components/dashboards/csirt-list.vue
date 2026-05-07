```typescript
<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import CountryCodeDropdown from "../shared/CountryCodeDropdown.vue";
import { useCsirtStore } from "../../stores/csirt";
import { useStakeholdersStore } from "../../stores/stakeholders";
import { csirtService } from "../../services/csirt.service";
import type { CsirtMember, CreateCsirtPayload } from "../../types/csirt.types";
import EasyDataTable from "vue3-easy-data-table";
import "vue3-easy-data-table/dist/style.css";
import { useAuthStore } from "../../stores/auth";
import { useListPage } from "../../composables/useListPage";
import { config } from "../../config/env";

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
    const stakeholdersStore = useStakeholdersStore();
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
    const formData = ref<Partial<CsirtMember> & { photo_csirt_file?: File | null; file_rfc2350_file?: File | null; file_public_key_pgp_file?: File | null; file_surat_tanda_registrasi_file?: File | null }>({
      nama_csirt: "",
      web_csirt: "",
      telepon_csirt: "",
      email_csirt: "",
      id_perusahaan: 0,
      photo_csirt: "",
      file_rfc2350: "",
      file_public_key_pgp: "",
      file_surat_tanda_registrasi: "",
      photo_csirt_file: null,
      file_rfc2350_file: null,
      file_public_key_pgp_file: null,
      file_surat_tanda_registrasi_file: null,
    });

    const formErrors = ref<Record<string, string>>({});
    
    // Phone state for modals
    const selectedCountryCode = ref("+62");
    const phoneNumber = ref("");
    const searchStakeholder = ref("");
    
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
      { text: "Email", value: "email_csirt", sortable: true },
      { text: "Aksi", value: "id" },
    ];

    const loadCsirtMembers = async () => {
      await stakeholdersStore.initialize();
      await csirtStore.initialize({ fetchGlobal: true });
    };

    const filteredData = computed(() => {
      let data = csirtStore.allCsirts;
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        data = data.filter(
          (i) =>
            i.nama_csirt.toLowerCase().includes(q) ||
            i.web_csirt.toLowerCase().includes(q) ||
            i.telepon_csirt.toLowerCase().includes(q) ||
            (i.email_csirt && i.email_csirt.toLowerCase().includes(q))
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

      if (!formData.value.id_perusahaan) {
        formErrors.value.id_perusahaan = "Perusahaan wajib dipilih";
        isValid = false;
      }

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
        email_csirt: "",
        id_perusahaan: 0,
        photo_csirt: "",
        file_rfc2350: "",
        file_public_key_pgp: "",
        file_surat_tanda_registrasi: "",
        photo_csirt_file: null,
        file_rfc2350_file: null,
        file_public_key_pgp_file: null,
        file_surat_tanda_registrasi_file: null,
      };
      formErrors.value = {};
      selectedCountryCode.value = "+62";
      phoneNumber.value = "";
      searchStakeholder.value = "";
      showCreateModal.value = true;
    };

    const createCsirt = async () => {
      if (!validateForm()) return;

      const payload: CreateCsirtPayload = {
        nama_csirt: formData.value.nama_csirt!,
        web_csirt: formData.value.web_csirt!,
        telepon_csirt: formData.value.telepon_csirt!,
        email_csirt: formData.value.email_csirt || "",
        id_perusahaan: formData.value.id_perusahaan!,
        photo_csirt: formData.value.photo_csirt_file || formData.value.photo_csirt || "",
        file_rfc2350: formData.value.file_rfc2350_file || formData.value.file_rfc2350 || "",
        file_public_key_pgp: formData.value.file_public_key_pgp_file || formData.value.file_public_key_pgp || "",
        file_surat_tanda_registrasi: formData.value.file_surat_tanda_registrasi_file || formData.value.file_surat_tanda_registrasi || "",
      };

      const result = await csirtStore.createCsirt(payload);

      if (result.success) {
        showCreateModal.value = false;
        showNotification("CSIRT berhasil ditambahkan!", "success");
      } else {
        showNotification("Gagal menambahkan CSIRT: " + result.error, "error");
      }
    };

    const editLoading = ref(false);

    // UPDATE
    const openEditModal = async (item: CsirtMember) => {
      currentEditItem.value = item;
      formData.value = { 
        ...item,
        photo_csirt_file: null,
        file_rfc2350_file: null,
        file_public_key_pgp_file: null,
        file_surat_tanda_registrasi_file: null,
      };
      formErrors.value = {};
      parsePhoneNumber(item.telepon_csirt);
      showEditModal.value = true;

      // Fetch full CSIRT to get nested perusahaan.id (UUID for dropdown)
      editLoading.value = true;
      try {
        const full = await csirtService.getMemberById(item.id as any);
        if (full?.perusahaan?.id) {
          formData.value.id_perusahaan = full.perusahaan.id as any;
        }
      } catch {
        // fallback: keep whatever id_perusahaan was on the list item
      } finally {
        editLoading.value = false;
      }
    };

    const updateCsirt = async () => {
      if (!validateForm() || !currentEditItem.value) return;

      const payload: Partial<CreateCsirtPayload> = {
        id_perusahaan: formData.value.id_perusahaan!,
        nama_csirt: formData.value.nama_csirt!,
        web_csirt: formData.value.web_csirt!,
        telepon_csirt: formData.value.telepon_csirt!,
        email_csirt: formData.value.email_csirt || "",
        photo_csirt: formData.value.photo_csirt_file || formData.value.photo_csirt || "",
        file_rfc2350: formData.value.file_rfc2350_file || formData.value.file_rfc2350 || "",
        file_public_key_pgp: formData.value.file_public_key_pgp_file || formData.value.file_public_key_pgp || "",
        file_surat_tanda_registrasi: formData.value.file_surat_tanda_registrasi_file || formData.value.file_surat_tanda_registrasi || "",
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
        formData.value.photo_csirt_file = file;
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
      formData.value.photo_csirt_file = null;
      if (fileInput.value) {
        fileInput.value.value = "";
      }
    };

    const handleFileUpload = (event: Event, type: 'rfc' | 'pgp' | 'str') => {
      const target = event.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const file = target.files[0];
        if (type === 'rfc') {
          formData.value.file_rfc2350_file = file;
        } else if (type === 'pgp') {
          formData.value.file_public_key_pgp_file = file;
        } else if (type === 'str') {
          formData.value.file_surat_tanda_registrasi_file = file;
        }
        showNotification(`${file.name} berhasil dipilih`, "success");
      }
    };

    // Status SDM & SE per CSIRT
    const csirtStatus = (csirtId: string) => {
      const id = String(csirtId);
      
      // Find the CSIRT object to get its id_perusahaan
      const csirtObj = csirtStore.csirts.find(c => String(c.id) === id);
      const currentPerusahaanId = String(csirtObj?.id_perusahaan || csirtObj?.perusahaan?.id);

      const sdmCount = csirtStore.sdmList.filter(
        s => String(s.id_csirt) === id || String((s as any).csirt?.id) === id || String((s as any).csirt_id) === id
      ).length;
      
      const seAll = csirtStore.seList.filter(
        s => String(s.id_csirt) === id || 
             String((s as any).csirt?.id) === id || 
             String((s as any).csirt_id) === id || 
             (s.id_perusahaan && String(s.id_perusahaan) === currentPerusahaanId)
      );
      const seCount = seAll.length;
      const seIncomplete = seAll.filter(
        s => !s.kategori_se || s.kategori_se === 'Belum Lengkap'
      ).length;
      return { sdmCount, seCount, seIncomplete };
    };

    // Count CSIRT yang benar-benar lengkap (memiliki SDM dan SE lengkap)
    const completeCSIRTCount = computed(() => {
      return csirtStore.csirts.filter(csirt => {
        const id = String(csirt.id);
        // Check if has SDM
        const hasSdm = csirtStore.sdmList.some(
          s => String(s.id_csirt) === id || String((s as any).csirt?.id) === id
        );
        // Check if has SE yang lengkap (not 'Belum Lengkap')
        const hasCompleteSe = csirtStore.seList.some(se =>
          (String(se.id_csirt) === id || String((se as any).csirt?.id) === id) &&
          se.kategori_se && se.kategori_se !== 'Belum Lengkap'
        );
        return hasSdm && hasCompleteSe;
      }).length;
    });

    // Filter stakeholders to show only those without CSIRT in create modal
    const availableStakeholders = computed(() => {
      return stakeholdersStore.stakeholders.filter(stakeholder => {
        const hasExistingCsirt = csirtStore.csirts.some(c =>
          String(c.id_perusahaan) === String(stakeholder.id) ||
          String((c as any).perusahaan?.id) === String(stakeholder.id)
        );
        return !hasExistingCsirt;
      });
    });

    // Filter available stakeholders by search
    const filteredAvailableStakeholders = computed(() => {
      const query = searchStakeholder.value.toLowerCase().trim();
      if (!query) return availableStakeholders.value;
      return availableStakeholders.value.filter(s =>
        s.nama_perusahaan.toLowerCase().includes(query) ||
        s.sub_sektor?.nama_sub_sektor.toLowerCase().includes(query)
      );
    });

    return {
      isAdmin,
      stakeholdersStore,
      csirtStore,
      loading,
      searchQuery,
      availableStakeholders,
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
      handleFileUpload,
      searchStakeholder,
      filteredAvailableStakeholders,
      ALLOWED_EXTENSIONS,
      MAX_FILE_SIZE_MB,
      ALLOWED_FORMATS,
      selectedCountryCode,
      phoneNumber,
      handlePhoneInput,
      editLoading,
      handleCountryCodeChange,
      csirtStatus,
      completeCSIRTCount,
      getAvatarClass: (letter: string) => {
        const variants = [
          'avatar-blue', 'avatar-indigo', 'avatar-violet', 'avatar-purple',
          'avatar-teal', 'avatar-cyan', 'avatar-green', 'avatar-amber',
          'avatar-orange', 'avatar-red'
        ];
        const idx = (letter.toUpperCase().charCodeAt(0) - 65 + variants.length) % variants.length;
        return variants[idx];
      },
      exportPdf: async (item: any) => {
        const id = item.id;
        const p = item.perusahaan || stakeholdersStore.getStakeholderById(String(item.id_perusahaan));
        const companyName = p?.nama_perusahaan || item.nama_csirt || 'csirt';
        const safeName = companyName.replace(/[^a-z0-9]/gi, '_');
        const filename = `Data_CSIRT_${safeName}.pdf`;

        try {
          const response = await fetch(`${config.api.baseUrl}/api/csirt/${id}/export-pdf`, {
            credentials: 'include'
          });
          if (!response.ok) throw new Error('Gagal mengunduh file');
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
        } catch (error) {
          console.error("Error exporting PDF:", error);
        }
      },
      exportAllCsirtPdf: async () => {
        const filename = `Rekap_Seluruh_CSIRT.pdf`;
        try {
          const response = await fetch(`${config.api.baseUrl}/api/csirt/export-pdf`, {
            credentials: 'include'
          });
          if (!response.ok) throw new Error('Gagal mengunduh file');
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
        } catch (error) {
          console.error("Error exporting all CSIRT PDF:", error);
        }
      },
      toCsirtSlug: (item: CsirtMember) => {
        const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const csirtPart = item.slug || toSlug(item.nama_csirt);
        const perusahaanName = (item as any).perusahaan?.nama_perusahaan;
        const perusahaanPart = perusahaanName ? toSlug(perusahaanName) : '';
        return perusahaanPart ? `${csirtPart}-${perusahaanPart}` : csirtPart;
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
     <div class="card custom-card gradient-header-card stakeholders-shell-card" style="overflow: visible !important;">
        <div class="stakeholder-header stakeholders-premium-header">
          <div class="stakeholders-header-main d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div class="stakeholders-hero-copy1 d-flex flex-column gap-1">
              <div>
                <div class="stakeholders-inline-breadcrumb">Dashboards <span>/</span> CSIRT</div>
                <div class="card-title mb-0 fw-bold header-card-title stakeholders-hero-title">Daftar CSIRT</div>
                <div class="header-subtitle mt-1 stakeholders-hero-subtitle">Manajemen data Computer Security Incident Response Team</div>
              </div>
              <div class="stakeholders-meta-stack">
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Total CSIRT</span>
                  <strong><i class="ri-shield-user-line text-primary"></i> {{ filteredData.length }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">CSIRT Lengkap</span>
                  <strong><i class="ri-user-3-line text-success"></i> {{ completeCSIRTCount }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Total SDM</span>
                  <strong><i class="ri-user-3-line text-info"></i> {{ csirtStore.sdmList.length }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Total SE</span>
                  <strong><i class="ri-server-line text-warning"></i> {{ csirtStore.seList.length }}</strong>
                </div>
              </div>
            </div>
            
            <div class="stakeholders-hero-tools d-flex flex-column gap-3">
              <div class="stakeholders-search position-relative w-100 mt-auto">
                <i class="ri-search-line header-search-icon"></i>
                <input v-model="searchQuery" type="text" class="form-control form-control-sm header-search-input" 
                  placeholder="Cari nama CSIRT..." />
                <button v-if="searchQuery" @click="clearSearch" class="clear-btn" title="Clear search">
                  <i class="ri-close-circle-fill"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="card-body p-4 stakeholders-premium-body">
          <div class="stakeholders-filter-bar mb-3">
            <div class="d-flex justify-content-between align-items-center w-100">
              <div class="stakeholders-per-page">
                <span class="me-2 fw-medium text-muted" style="font-size: 12px;">ROWS</span>
                <select v-model="itemsPerPage" class="form-select form-select-sm entries-select">
                  <option v-for="n in [5, 10, 15, 20, 25, 50]" :key="n" :value="n">{{ n }}</option>
                </select>
              </div>
              <div class="d-flex gap-2 ms-auto">
                <button
                  @click="exportAllCsirtPdf"
                  class="btn btn-danger d-flex align-items-center gap-2"
                >
                  <i class="ri-file-pdf-line fs-13"></i>
                  <span class="btn-text">Rekap CSIRT</span>
                </button>
                <button v-if="isAdmin"
                  @click="openCreateModal"
                  class="btn stakeholders-add-btn btn-primary ms-auto d-flex align-items-center gap-2"
                >
                  <i class="ri-add-circle-line fs-13"></i>
                  <span class="btn-text">Tambah CSIRT</span>
                </button>
              </div>
            </div>
          </div>
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

            <!-- Table -->
            <div class="table-responsive stakeholder-table-wrap stakeholders-table-shell">
              <table class="table stakeholder-table text-nowrap mb-0">
                <thead class="stakeholder-thead">
                  <tr>
                    <th class="th-no" style="width:50px">No</th>
                    <th class="sortable fw-semibold" style="width:18%">
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
                    <th class="fw-semibold" style="width:18%">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-building-2-line text-primary"></i>
                        <span>Stakeholder</span>
                      </div>
                    </th>
                    <th class="sortable fw-semibold" style="width:16%">
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
                    <th class="fw-semibold" style="width:13%">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-phone-line text-primary"></i>
                        <span>Telepon</span>
                      </div>
                    </th>
                    <th class="fw-semibold" style="width:15%">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-mail-line text-primary"></i>
                        <span>Email</span>
                      </div>
                    </th>
                    <th class="fw-semibold" style="width:160px;white-space:nowrap">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-bar-chart-box-line text-primary"></i>
                        <span>Status</span>
                      </div>
                    </th>
                    <th class="text-center fw-semibold" style="width:100px">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!displayData.length">
                    <td colspan="7" class="text-center py-5">
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
                      <template v-if="item.perusahaan || stakeholdersStore.getStakeholderById(String(item.id_perusahaan))">
                        <div class="d-flex align-items-center gap-2">
                          <div>
                            <span class="company-name d-block">
                              {{ (item.perusahaan || stakeholdersStore.getStakeholderById(String(item.id_perusahaan)))?.nama_perusahaan }}
                            </span>
                            <span class="text-muted fs-12">
                              {{ (item.perusahaan?.sub_sektor || stakeholdersStore.getStakeholderById(String(item.id_perusahaan))?.sub_sektor)?.nama_sub_sektor }}
                            </span>
                          </div>
                        </div>
                      </template>
                      <span v-else class="text-muted fs-12">—</span>
                    </td>
                    <td class="align-middle" style="white-space:nowrap">
                      <a :href="item.web_csirt" target="_blank" class="email-link d-inline-flex align-items-center gap-1 text-decoration-none" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;display:inline-block!important">
                        <span class="email-text">{{ item.web_csirt }}</span>
                      </a>
                    </td>
                    <td class="align-middle" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                      <span class="text-muted">{{ item.telepon_csirt }}</span>
                    </td>
                    <td class="align-middle" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                      <a :href="`mailto:${item.email_csirt}`" v-if="item.email_csirt" class="text-muted text-decoration-none email-link">
                         {{ item.email_csirt }}
                      </a>
                      <span v-else class="text-muted">—</span>
                    </td>
                    <td class="align-middle" style="white-space:normal;min-width:140px">
                      <div class="d-flex flex-column gap-1">
                        <!-- SDM badge -->
                        <div class="d-flex align-items-center gap-1">
                          <span class="badge-sektor"
                            :class="csirtStatus(item.id).sdmCount > 0 ? 'badge-sektor-green' : 'badge-sektor-red'">
                            <i :class="csirtStatus(item.id).sdmCount > 0 ? 'ri-user-3-line me-1' : 'ri-user-unfollow-line me-1'"></i>
                            SDM:
                            <template v-if="csirtStatus(item.id).sdmCount > 0">
                              {{ csirtStatus(item.id).sdmCount }} personel
                            </template>
                            <template v-else>Belum Ada</template>
                          </span>
                        </div>
                        <!-- SE badge -->
                        <div class="d-flex align-items-center gap-1 mt-1">
                          <span class="badge-sektor"
                            :class="csirtStatus(item.id).seCount === 0
                              ? 'badge-sektor-red'
                              : csirtStatus(item.id).seIncomplete > 0
                                ? 'badge-sektor-amber'
                                : 'badge-sektor-green'">
                            <i :class="csirtStatus(item.id).seCount === 0
                              ? 'ri-server-line me-1'
                              : csirtStatus(item.id).seIncomplete > 0
                                ? 'ri-error-warning-line me-1'
                                : 'ri-server-fill me-1'"></i>
                            SE:
                            <template v-if="csirtStatus(item.id).seCount === 0">Belum Ada</template>
                            <template v-else-if="csirtStatus(item.id).seIncomplete > 0">
                              {{ csirtStatus(item.id).seCount }} ({{ csirtStatus(item.id).seIncomplete }} blm lengkap)
                            </template>
                            <template v-else>{{ csirtStatus(item.id).seCount }} SE</template>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td class="text-center align-middle">
                      <div class="d-flex gap-1 justify-content-center">
                        <router-link
                          :to="`/csirt/${toCsirtSlug(item)}`"
                          class="btn btn-sm btn-icon btn-wave btn-info-light stakeholders-action-btn"
                          title="Lihat Profil">
                          <i class="ri-eye-line"></i>
                        </router-link>
                        <button v-if="isAdmin"
                          @click="openEditModal(item)"
                          class="btn btn-sm btn-icon btn-wave btn-success-light stakeholders-action-btn"
                          title="Edit">
                          <i class="ri-edit-2-line"></i>
                        </button>
                        <button v-if="isAdmin"
                          @click="openDeleteModal(item)"
                          class="btn btn-sm btn-icon btn-wave btn-danger-light stakeholders-action-btn"
                          title="Hapus">
                          <i class="ri-delete-bin-3-line"></i>
                        </button>
                        <button
                          @click="exportPdf(item)"
                          class="btn btn-sm btn-icon btn-wave btn-secondary-light stakeholders-action-btn"
                          title="Export PDF">
                          <i class="ri-file-pdf-line"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div class="pagination-container stakeholders-pagination mt-4">
              <div class="stakeholders-pagination-copy">
                Showing {{ displayData.length ? (currentPage - 1) * itemsPerPage + 1 : 0 }}-{{ Math.min(currentPage * itemsPerPage, filteredData.length) }} of {{ filteredData.length }} CSIRT
              </div>
              <div class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
                <span class="stakeholders-page-pill">Page {{ currentPage }} of {{ totalPages || 1 }}</span>
                <nav v-if="totalPages > 1">
                  <ul class="pagination pagination-sm mb-0 gap-1">
                    <li class="page-item" :class="{ disabled: currentPage === 1 }">
                      <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = 1" title="First">
                        <i class="ri-skip-back-mini-line"></i>
                      </a>
                    </li>
                    <li class="page-item d-none d-sm-block" :class="{ disabled: currentPage === 1 }">
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
                    <li class="page-item d-none d-sm-block" :class="{ disabled: currentPage === totalPages }">
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
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Modal -->
  <div v-if="showCreateModal" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="showCreateModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal csirt-form-dialog">
      <div class="modal-content csirt-form-modal-content">
        <div class="card custom-card gradient-header-card csirt-form-modal-card w-100 mb-0">
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
                        backgroundColor: formData.photo_csirt ? 'transparent' : '#f8f9fa',
                        width: '180px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }"
                    >
                      <img v-if="formData.photo_csirt" :src="formData.photo_csirt" class="w-100 h-100 p-2" style="object-fit:contain;" alt="Logo CSIRT" />
                      <!-- Empty State -->
                      <div v-if="!formData.photo_csirt" class="position-absolute w-100 h-100 d-flex flex-column align-items-center justify-content-center text-muted photo-empty-state">
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

                <!-- Perusahaan -->
                <div class="col-xl-12">
                  <label class="form-label fw-medium">
                    <i class="ri-building-2-line me-1 text-primary"></i>Perusahaan / Stakeholder <span class="text-danger">*</span>
                  </label>
                  <!-- Search Stakeholder -->
                  <div class="mb-2">
                    <input type="text" v-model="searchStakeholder" class="form-control form-control-sm" 
                      placeholder="Cari nama perusahaan atau sektor..." 
                      style="max-width:100%" />
                    <small class="text-muted d-block mt-1">
                      {{ filteredAvailableStakeholders.length }} dari {{ availableStakeholders.length }} stakeholder
                    </small>
                  </div>
                  <select class="form-select" v-model="formData.id_perusahaan" :class="{ 'is-invalid': formErrors.id_perusahaan }">
                    <option value="0" disabled>-- Pilih Perusahaan / Stakeholder --</option>
                    <option v-for="s in filteredAvailableStakeholders" :key="s.id" :value="s.id">{{ s.nama_perusahaan }}</option>
                  </select>
                  <div v-if="filteredAvailableStakeholders.length === 0 && searchStakeholder" class="form-text text-danger fs-12 mt-1">
                    <i class="ri-close-circle-line me-1"></i> Tidak ada stakeholder yang cocok
                  </div>
                  <div v-if="formErrors.id_perusahaan" class="invalid-feedback">
                    {{ formErrors.id_perusahaan }}
                  </div>
                  <div v-if="availableStakeholders.length < stakeholdersStore.stakeholders.length" class="form-text text-muted fs-12 mt-1">
                    <i class="ri-information-line me-1"></i> Beberapa stakeholder sudah memiliki CSIRT
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

                <!-- Email -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-mail-line me-1 text-primary"></i>Email CSIRT
                  </label>
                  <input type="email" class="form-control" v-model="formData.email_csirt" placeholder="Contoh: csirt@domain.com" />
                </div>

                <!-- Dokumen RFC 2350 -->
                <div class="col-xl-12">
                  <label class="form-label fw-medium">
                    <i class="ri-file-pdf-line me-1 text-primary"></i>RFC 2350
                  </label>
                  <div class="input-group w-100 gap-4">
                    <input type="text" class="form-control" v-model="formData.file_rfc2350"
                      placeholder="Link atau pilih file" />
                    <input type="file" ref="createRfcFile" class="d-none" @change="handleFileUpload($event, 'rfc')" accept=".pdf" />
                    <button class="btn btn-primary-light" type="button" @click="$refs.createRfcFile.click()">
                      <i class="ri-upload-2-line me-1"></i>Upload
                    </button>
                  </div>
                  <div v-if="formData.file_rfc2350_file" class="text-success small mt-1">
                    <i class="ri-check-line"></i> {{ formData.file_rfc2350_file.name }} siap diupload
                  </div>
                </div>

                <!-- Public Key PGP -->
                <div class="col-xl-12">
                  <label class="form-label fw-medium">
                    <i class="ri-key-2-line me-1 text-primary"></i>Public Key PGP
                  </label>
                  <div class="input-group w-100 gap-4">
                    <input type="text" class="form-control" v-model="formData.file_public_key_pgp"
                      placeholder="Link atau pilih file" />
                    <input type="file" ref="createPgpFile" class="d-none" @change="handleFileUpload($event, 'pgp')" accept=".asc,.txt,.key" />
                    <button class="btn btn-secondary-light" type="button" @click="$refs.createPgpFile.click()">
                      <i class="ri-upload-2-line me-1"></i>Upload
                    </button>
                  </div>
                  <div v-if="formData.file_public_key_pgp_file" class="text-success small mt-1">
                    <i class="ri-check-line"></i> {{ formData.file_public_key_pgp_file.name }} siap diupload
                  </div>
                </div>

                <!-- Surat Tanda Registrasi -->
                <div class="col-xl-12">
                  <label class="form-label fw-medium">
                    <i class="ri-file-pdf-line me-1 text-primary"></i>Surat Tanda Registrasi
                  </label>
                  <div class="input-group w-100 gap-4">
                    <input type="text" class="form-control" v-model="formData.file_surat_tanda_registrasi"
                      placeholder="Link atau pilih file" />
                    <input type="file" ref="createStrFile" class="d-none" @change="handleFileUpload($event, 'str')" accept=".pdf" />
                    <button class="btn btn-info-light" type="button" @click="$refs.createStrFile.click()">
                      <i class="ri-upload-2-line me-1"></i>Upload
                    </button>
                  </div>
                  <div v-if="formData.file_surat_tanda_registrasi_file" class="text-success small mt-1">
                    <i class="ri-check-line"></i> {{ formData.file_surat_tanda_registrasi_file.name }} siap diupload
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
    <div class="modal-dialog modal-dialog-centered custom-modal csirt-form-dialog">
      <div class="modal-content csirt-form-modal-content">
        <div class="card custom-card gradient-header-card csirt-form-modal-card w-100 mb-0">
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
                        backgroundColor: formData.photo_csirt ? 'transparent' : '#f8f9fa',
                        width: '180px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }"
                    >
                      <img v-if="formData.photo_csirt" :src="formData.photo_csirt" class="w-100 h-100 p-2" style="object-fit:contain;" alt="Logo CSIRT" />
                      <!-- Empty State -->
                      <div v-if="!formData.photo_csirt" class="position-absolute w-100 h-100 d-flex flex-column align-items-center justify-content-center text-muted photo-empty-state">
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

                <!-- Perusahaan -->
                <div class="col-xl-12">
                  <label class="form-label fw-medium">
                    <i class="ri-building-2-line me-1 text-primary"></i>Perusahaan / Stakeholder <span class="text-danger">*</span>
                  </label>
                  <div v-if="editLoading" class="form-control d-flex align-items-center gap-2 text-muted">
                    <span class="spinner-border spinner-border-sm"></span>
                    <span>Memuat data perusahaan...</span>
                  </div>
                  <select v-else class="form-select" v-model="formData.id_perusahaan" :class="{ 'is-invalid': formErrors.id_perusahaan }" disabled>
                    <option value="0" disabled>-- Pilih Perusahaan / Stakeholder --</option>
                    <option v-for="s in stakeholdersStore.stakeholders" :key="s.id" :value="s.id">{{ s.nama_perusahaan }}</option>
                  </select>
                  <div v-if="formErrors.id_perusahaan" class="invalid-feedback">
                    {{ formErrors.id_perusahaan }}
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

                <!-- Email -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-mail-line me-1 text-primary"></i>Email CSIRT
                  </label>
                  <input type="email" class="form-control" v-model="formData.email_csirt" placeholder="Contoh: csirt@domain.com" />
                </div>

                <!-- Dokumen RFC 2350 -->
                <div class="col-xl-12">
                  <label class="form-label fw-medium">
                    <i class="ri-file-pdf-line me-1 text-primary"></i>RFC 2350
                  </label>
                  <div class="input-group w-100 gap-4">
                    <input type="text" class="form-control" v-model="formData.file_rfc2350"
                      placeholder="Link atau pilih file" />
                    <input type="file" ref="editRfcFile" class="d-none" @change="handleFileUpload($event, 'rfc')" accept=".pdf" />
                    <button class="btn btn-primary-light" type="button" @click="$refs.editRfcFile.click()">
                      <i class="ri-upload-2-line me-1"></i>Upload
                    </button>
                  </div>
                  <div v-if="formData.file_rfc2350_file" class="text-success small mt-1">
                    <i class="ri-check-line"></i> {{ formData.file_rfc2350_file.name }} siap diupload
                  </div>
                </div>

                <!-- Public Key PGP -->
                <div class="col-xl-12">
                  <label class="form-label fw-medium">
                    <i class="ri-key-2-line me-1 text-primary"></i>Public Key PGP
                  </label>
                  <div class="input-group w-100 gap-4">
                    <input type="text" class="form-control" v-model="formData.file_public_key_pgp"
                      placeholder="Link atau pilih file" />
                    <input type="file" ref="editPgpFile" class="d-none" @change="handleFileUpload($event, 'pgp')" accept=".asc,.txt,.key" />
                    <button class="btn btn-secondary-light" type="button" @click="$refs.editPgpFile.click()">
                      <i class="ri-upload-2-line me-1"></i>Upload
                    </button>
                  </div>
                  <div v-if="formData.file_public_key_pgp_file" class="text-success small mt-1">
                    <i class="ri-check-line"></i> {{ formData.file_public_key_pgp_file.name }} siap diupload
                  </div>
                </div>

                <!-- Surat Tanda Registrasi -->
                <div class="col-xl-12">
                  <label class="form-label fw-medium">
                    <i class="ri-file-pdf-line me-1 text-primary"></i>Surat Tanda Registrasi
                  </label>
                  <div class="input-group w-100 gap-4">
                    <input type="text" class="form-control" v-model="formData.file_surat_tanda_registrasi"
                      placeholder="Link atau pilih file" />
                    <input type="file" ref="editStrFile" class="d-none" @change="handleFileUpload($event, 'str')" accept=".pdf" />
                    <button class="btn btn-info-light" type="button" @click="$refs.editStrFile.click()">
                      <i class="ri-upload-2-line me-1"></i>Upload
                    </button>
                  </div>
                  <div v-if="formData.file_surat_tanda_registrasi_file" class="text-success small mt-1">
                    <i class="ri-check-line"></i> {{ formData.file_surat_tanda_registrasi_file.name }} siap diupload
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

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-modal {
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

.modal.fade.show.d-block .modal-dialog.csirt-form-dialog {
  background: transparent !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  height: auto !important;
  min-height: auto !important;
  overflow: visible !important;
}

.csirt-form-modal-content {
  background: #ffffff !important;
  border: 0 !important;
  border-radius: 16px !important;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3) !important;
}

.csirt-form-modal-card {
  background: #ffffff !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

.csirt-form-modal-card .card-header,
.csirt-form-modal-card .card-footer {
  border-color: #e5e7eb !important;
}

/* Skeleton Loading */
.skel {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: skeletonLoad 1.5s infinite;
  border-radius: 4px;
}
.skel-circle { border-radius: 50%; }
@keyframes skeletonLoad {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-row {
  opacity: 0.7;
}

/* Meta Card Styles */
.stakeholders-meta-stack {
  display: flex !important;
  gap: 10px !important;
  flex-wrap: wrap !important;
  justify-content: flex-start !important;
  width: 100% !important;
}

.stakeholders-meta-card {
  flex: 1 1 auto !important;
  min-width: 100px !important;
  max-width: 130px !important;
  width: auto !important;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 8px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  transition: all 0.3s ease;
}

.stakeholders-meta-card:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
}

.stakeholders-meta-label {
  font-size: 9px;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 4px;
  white-space: nowrap;
}

.stakeholders-meta-card strong {
  font-size: 18px;
  color: white;
  display: flex;
  align-items: center;
  gap: 6px;
}

.stakeholders-meta-card strong i {
  font-size: 16px;
}

/* Search alignment tweaks */
.stakeholders-header-main {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  align-items: center !important;
  justify-content: space-between !important;
  width: 100% !important;
  gap: 20px !important;
}

.stakeholders-hero-copy1 {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  width: auto !important;
}

.stakeholders-hero-tools {
  flex: 0 0 350px !important;
  width: 350px !important;
  min-width: 350px !important;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.stakeholders-search {
  position: relative;
  width: 100% !important;
  max-width: 100% !important;
  margin-left: auto;
}

/* Search Bar Refinement - Match csirt-list style */
.header-search-input {
  border-radius: 50px !important;
  background-color: #ffffff !important;
  color: #1e293b !important;
  border: 1.5px solid #e2e8f0 !important;
  padding-left: 2.75rem !important;
  padding-right: 2.75rem !important;
  height: 44px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
  font-weight: 500 !important;
  transition: all 0.2s ease !important;
}

.header-search-input:focus {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1), 0 4px 12px rgba(0, 0, 0, 0.08) !important;
}

.header-search-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  font-size: 18px;
  pointer-events: none;
  z-index: 5;
}

.clear-btn {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 0;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: color 0.2s;
  z-index: 6;
}

.clear-btn:hover {
  color: #475569;
}

@media (max-width: 1250px) {
  .stakeholders-header-main {
    flex-wrap: wrap !important;
    gap: 20px !important;
  }
  .stakeholders-hero-tools {
    flex: 1 1 100% !important;
    width: 100% !important;
    min-width: 100% !important;
    justify-content: stretch !important;
  }
  .stakeholders-search {
    max-width: 100% !important;
  }
  .stakeholders-meta-stack {
    flex-wrap: wrap !important;
  }
  .stakeholders-meta-card {
    flex: 1 1 calc(33.333% - 12px) !important;
    max-width: calc(33.333% - 8px) !important;
  }
}
/* Header Rows Selector */
.header-rows-selector {
  position: absolute;
  right: 1.25rem;
  bottom: 1.15rem;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
}

@media (max-width: 1250px) {
  .header-rows-selector {
    position: static;
    margin-top: 15px;
    margin-left: auto;
    width: fit-content;
    padding-right: 1.25rem;
    padding-bottom: 1rem;
  }
}

.header-rows-selector:hover .header-rows-select {
  background-color: rgba(255, 255, 255, 0.15) !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
}

.header-rows-select {
  width: 72px !important;
  background-color: rgba(255, 255, 255, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  color: white !important;
  border-radius: 8px !important;
  height: 32px !important;
  font-size: 12px !important;
  padding: 0 24px 0 10px !important;
  cursor: pointer;
  transition: all 0.2s ease;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M12 16L6 10H18L12 16Z'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  background-size: 14px;
}


.header-rows-select:focus {
  background-color: rgba(255, 255, 255, 0.15) !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
  box-shadow: none !important;
}

.header-rows-select option {
  background-color: #1e293b;
  color: white;
}

@media (max-width: 768px) {
  .stakeholders-premium-body {
    padding: 1rem !important;
  }

  .stakeholder-table-wrap {
    margin: 0 -1rem;
    width: calc(100% + 2rem);
    border-radius: 0;
  }

  .stakeholders-pagination {
    flex-direction: column;
    gap: 16px;
    align-items: center !important;
    text-align: center;
  }

  .stakeholders-pagination .d-flex {
    justify-content: center !important;
    width: 100%;
  }
}

@media (max-width: 576px) {
  .stakeholders-hero-title {
    font-size: 1.25rem !important;
  }

  .stakeholders-hero-subtitle {
    font-size: 0.75rem !important;
  }

  .stakeholders-meta-stack {
    flex-wrap: wrap !important;
  }

  .stakeholders-meta-card {
    flex: 1 1 calc(50% - 12px) !important;
    max-width: calc(50% - 6px) !important;
  }

  .stakeholders-meta-card strong {
    font-size: 16px;
  }

  .header-search-input {
    height: 40px !important;
    font-size: 13px !important;
  }

  .header-rows-selector {
    margin-top: 15px;
    padding: 6px 12px;
    justify-content: center !important;
  }

  .stakeholders-premium-header {
    padding-bottom: 1.25rem !important;
  }

  /* Hide less important columns on mobile */
  .th-no, .stakeholder-row td:first-child,
  .stakeholder-thead th:nth-child(3), .stakeholder-row td:nth-child(3),
  .stakeholder-thead th:nth-child(5), .stakeholder-row td:nth-child(5) {
    display: none !important;
  }
  
  /* Adjust User column on mobile */
  .stakeholder-company-cell {
    gap: 8px;
  }
  .company-avatar {
    width: 32px !important;
    height: 32px !important;
    min-width: 32px !important;
  }
  .company-name {
    font-size: 13px !important;
  }
  
  /* Make sure table scrolls smoothly */
  .table-responsive {
    -webkit-overflow-scrolling: touch;
  }
}

/* Animations for toast */
.toast-slide-enter-active, .toast-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.toast-slide-leave-to {
  transform: translateY(-20px);
  opacity: 0;
}

.text-theme-dark {
  color: #1e293b !important; /* Elegant black/dark navy */
}

/* --- DARK MODE SUPPORT --- */
[data-theme-mode='dark'] .header-search-input {
  background-color: rgba(255, 255, 255, 0.1) !important;
  color: #ffffff !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
}

[data-theme-mode='dark'] .header-search-input:focus {
  background-color: rgba(255, 255, 255, 0.08) !important;
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2), 0 4px 12px rgba(0, 0, 0, 0.2) !important;
}

[data-theme-mode='dark'] .header-search-input::placeholder {
  color: rgba(255, 255, 255, 0.7) !important;
}

[data-theme-mode='dark'] .header-search-icon {
  color: rgba(255, 255, 255, 0.9) !important;
}

[data-theme-mode='dark'] .bg-theme-light {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

[data-theme-mode='dark'] .text-theme-dark {
  color: #ffffff !important;
}

[data-theme-mode='dark'] .stakeholder-row:hover {
  background-color: rgba(255, 255, 255, 0.02) !important;
}

[data-theme-mode='dark'] .company-name {
  color: #f1f5f9 !important;
}

[data-theme-mode='dark'] .row-number {
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.05);
}

[data-theme-mode='dark'] .empty-icon-inner {
  background: rgba(255, 255, 255, 0.05);
  color: #3b82f6;
}

[data-theme-mode='dark'] .empty-state-title {
  color: #f1f5f9;
}

[data-theme-mode='dark'] .pagination .page-link {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
}

[data-theme-mode='dark'] .pagination .page-item.active .page-link {
  background-color: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

[data-theme-mode='dark'] .pagination .page-item.disabled .page-link {
  background-color: transparent;
  color: rgba(255, 255, 255, 0.2);
}

[data-theme-mode='dark'] .stakeholders-page-pill {
  background: rgba(255, 255, 255, 0.05);
  color: #94a3b8;
}

[data-theme-mode='dark'] .header-rows-selector span {
  color: #ffffff !important;
  opacity: 1 !important;
}

[data-theme-mode='dark'] .stakeholders-inline-breadcrumb {
  color: rgba(255, 255, 255, 0.9) !important;
}

[data-theme-mode='dark'] .stakeholders-inline-breadcrumb span {
  color: rgba(255, 255, 255, 0.5) !important;
}



[data-theme-mode='dark'] .stakeholder-thead,
[data-theme-mode='dark'] table.stakeholder-table thead.stakeholder-thead {
  background-color: #1e293b !important;
}

[data-theme-mode='dark'] .stakeholder-thead th,
[data-theme-mode='dark'] table.stakeholder-table thead.stakeholder-thead th {
  background-color: #1e293b !important;
  color: #f1f5f9 !important;
  border-bottom: 1.5px solid rgba(255, 255, 255, 0.1) !important;
}

[data-theme-mode='dark'] .stakeholder-row td {
  border-bottom-color: rgba(255, 255, 255, 0.05) !important;
}

[data-theme-mode='dark'] .badge-sektor {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

[data-theme-mode='dark'] .badge-sektor-teal { color: #2dd4bf !important; background: rgba(45, 212, 191, 0.1) !important; }
[data-theme-mode='dark'] .badge-sektor-amber { color: #fbbf24 !important; background: rgba(251, 191, 36, 0.1) !important; }
[data-theme-mode='dark'] .badge-sektor-red { color: #f87171 !important; background: rgba(248, 113, 113, 0.1) !important; }
[data-theme-mode='dark'] .badge-sektor-green { color: #4ade80 !important; background: rgba(74, 222, 128, 0.1) !important; }
[data-theme-mode='dark'] .badge-sektor-orange { color: #fb923c !important; background: rgba(251, 146, 60, 0.1) !important; }
[data-theme-mode='dark'] .badge-sektor-sky { color: #38bdf8 !important; background: rgba(56, 189, 248, 0.1) !important; }

.stakeholders-add-btn-red {
  border: none !important;
  border-radius: 10px !important;
  padding: 0.55rem 1.2rem !important;
  background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%) !important;
  color: #fff !important;
  box-shadow: 0 4px 12px rgba(225, 29, 72, 0.25);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 13px !important;
  font-weight: 600 !important;
}

.stakeholders-add-btn-red:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(225, 29, 72, 0.35);
  filter: brightness(1.1);
}

.stakeholders-add-btn-red i {
  font-size: 16px;
}

/* Control Bar Refinement */
.stakeholders-filter-bar {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 12px 20px !important;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
  transition: all 0.3s ease;
}

[data-theme-mode='dark'] .stakeholders-filter-bar {
  background: rgba(15, 23, 42, 0.4);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.stakeholders-add-btn {
  padding: 0.55rem 1.2rem !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  border-radius: 10px !important;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
}

.stakeholders-add-btn:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3) !important;
}

.stakeholders-per-page {
  display: flex;
  align-items: center;
  background: #f8fafc;
  padding: 5px 12px !important;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

[data-theme-mode='dark'] .stakeholders-per-page {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
}

.stakeholders-per-page .entries-select {
  border: none !important;
  background-color: transparent !important;
  font-weight: 700 !important;
  color: #1e293b !important;
  padding: 0 20px 0 5px !important;
  height: 24px !important;
  cursor: pointer;
}

[data-theme-mode='dark'] .stakeholders-per-page .entries-select {
  color: #f1f5f9 !important;
}

</style>


