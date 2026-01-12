<script lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import CountryCodeDropdown from "../shared/CountryCodeDropdown.vue";
import { stakeholdersData, type Stakeholder } from "../../data/dummydata";
import EasyDataTable from "vue3-easy-data-table";
import "vue3-easy-data-table/dist/style.css";
import { useAuthStore } from "../../stores/auth";



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
  components: { Pageheader, EasyDataTable, CountryCodeDropdown },
  setup() {
    const authStore = useAuthStore();
    const isAdmin = computed(() => authStore.isAdmin);

    const items = ref<Stakeholder[]>([]);
    const loading = ref(false);
    const searchQuery = ref("");
    const searchValue2 = ref("");
    const sortField = ref<"nama_perusahaan" | "sektor">("nama_perusahaan");
    const sortOrder = ref<"asc" | "desc">("asc");
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
      sektor: "",
      email: "",
      alamat: "",
      telepon: "",
      website: "",
      photo: "",
    });

    const formErrors = ref<Record<string, string>>({});
    
    // Phone state for modals
    const selectedCountryCode = ref("+62");
    const phoneNumber = ref("");
    
    const formatPhoneNumber = (value: string) => {
      const numbers = value.replace(/\D/g, "");
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 7) return `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
      return `${numbers.slice(0, 3)} ${numbers.slice(3, 7)} ${numbers.slice(7, 11)}`;
    };
    
    const handlePhoneInput = (event: Event) => {
      const input = event.target as HTMLInputElement;
      const numbers = input.value.replace(/\D/g, "").slice(0, 11);
      phoneNumber.value = formatPhoneNumber(numbers);
      formData.value.telepon = selectedCountryCode.value + " " + phoneNumber.value;
    };
    
    const handleCountryCodeChange = () => {
      if (phoneNumber.value) {
        formData.value.telepon = selectedCountryCode.value + " " + phoneNumber.value;
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
      { text: "Nama Perusahaan", value: "nama_perusahaan", sortable: true },
      { text: "Sektor", value: "sektor", sortable: true },
      { text: "Email", value: "email", sortable: true },
      { text: "Aksi", value: "id" },
    ];

    const loadStakeholders = async () => {
      loading.value = true;
      await new Promise((r) => setTimeout(r, 500));
      items.value = stakeholdersData;
      loading.value = false;
    };

    const filteredData = computed(() => {
      let data = items.value;
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
        return a[sortField.value].localeCompare(b[sortField.value]) * mod;
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

    // Generate slug from company name
    const generateSlug = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    };

    // Form validation
    const validateForm = (): boolean => {
      formErrors.value = {};
      let isValid = true;

      if (!formData.value.nama_perusahaan?.trim()) {
        formErrors.value.nama_perusahaan = "Nama perusahaan wajib diisi";
        isValid = false;
      }

      if (!formData.value.sektor?.trim()) {
        formErrors.value.sektor = "Sektor wajib diisi";
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

    // Show toast notification
    const showNotification = (
      message: string,
      type: "success" | "error" = "success"
    ) => {
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
        sektor: "",
        email: "",
        alamat: "",
        telepon: "",
        website: "",
        photo: "",
      };
      formErrors.value = {};
      selectedCountryCode.value = "+62";
      phoneNumber.value = "";
      showCreateModal.value = true;
    };

    const createStakeholder = () => {
      if (!validateForm()) return;

      const newId = Math.max(...items.value.map((i) => i.id), 0) + 1;
      const newStakeholder: Stakeholder = {
        id: newId,
        slug: generateSlug(formData.value.nama_perusahaan!),
        nama_perusahaan: formData.value.nama_perusahaan!,
        sektor: formData.value.sektor!,
        email: formData.value.email!,
        alamat: formData.value.alamat!,
        telepon: formData.value.telepon!,
        website: formData.value.website!,
        photo: formData.value.photo || undefined,
      };

      stakeholdersData.push(newStakeholder);
      items.value = stakeholdersData;
      showCreateModal.value = false;
      showNotification("Stakeholder berhasil ditambahkan!", "success");
    };

    // UPDATE
    const openEditModal = (item: Stakeholder) => {
      currentEditItem.value = item;
      formData.value = { ...item };
      formErrors.value = {};
      parsePhoneNumber(item.telepon);
      showEditModal.value = true;
    };

    const updateStakeholder = () => {
      if (!validateForm() || !currentEditItem.value) return;

      const index = stakeholdersData.findIndex(
        (i) => i.id === currentEditItem.value!.id
      );
      if (index !== -1) {
        stakeholdersData[index] = {
          ...stakeholdersData[index],
          nama_perusahaan: formData.value.nama_perusahaan!,
          sektor: formData.value.sektor!,
          email: formData.value.email!,
          alamat: formData.value.alamat!,
          telepon: formData.value.telepon!,
          website: formData.value.website!,
          photo: formData.value.photo,
          slug: generateSlug(formData.value.nama_perusahaan!),
        };
        items.value = stakeholdersData;
        showEditModal.value = false;
        showNotification("Stakeholder berhasil diperbarui!", "success");
      }
    };

    // DELETE
    const openDeleteModal = (item: Stakeholder) => {
      currentDeleteItem.value = item;
      showDeleteModal.value = true;
    };

    const deleteStakeholder = () => {
      if (!currentDeleteItem.value) return;

      const index = stakeholdersData.findIndex(
        (i) => i.id === currentDeleteItem.value!.id
      );
      if (index !== -1) {
        stakeholdersData.splice(index, 1);
        items.value = stakeholdersData;
        showDeleteModal.value = false;
        showNotification("Stakeholder berhasil dihapus!", "success");
      }
    };

    watch([searchQuery, itemsPerPage], () => (currentPage.value = 1));

    onMounted(loadStakeholders);

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

    return {
      isAdmin,
      items,
      loading,
      searchQuery,
      searchValue2,
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
      toggleSort: (f: "nama_perusahaan" | "sektor") => {
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
      selectedCountryCode,
      phoneNumber,
      handlePhoneInput,
      handleCountryCodeChange,
      getSektorBadgeClass: (sektor: string) => {
        const sektorColors: Record<string, string> = {
          'Teknologi Informasi': 'bg-primary-transparent text-primary',
          'Software Development': 'bg-info-transparent text-info',
          'Teknologi': 'bg-indigo-transparent text-indigo',
          'Keuangan': 'bg-success-transparent text-success',
          'Kesehatan': 'bg-danger-transparent text-danger',
          'Pendidikan': 'bg-warning-transparent text-warning',
          'Manufaktur': 'bg-secondary-transparent text-secondary',
          'Konstruksi': 'bg-orange-transparent text-orange',
          'Perdagangan Umum': 'bg-teal-transparent text-teal',
        };
        return sektorColors[sektor] || 'bg-info-transparent text-info';
      },
    };
  },
};

</script>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Toast Notification -->
  <div v-if="showToast" class="position-fixed top-0 end-0 p-3" style="z-index: 9999">
    <div class="toast show"
      :class="{
        'bg-success': toastType === 'success',
        'bg-danger': toastType === 'error',
      }"
      role="alert">
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
      <div class="card custom-card gradient-header-card">
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3" 
            style="background:
  radial-gradient(ellipse at top, #032a5c, #084696);
">
          <div class="d-flex align-items-center">
            <i class="ri-building-2-line me-2 fs-18" style="color: white !important;"></i>
            <div class="card-title mb-0" style="color: white !important;">Daftar Stakeholders</div>
          </div>
          <div class="d-flex gap-2 align-items-center flex-wrap">
            <div class="search-container position-relative" style="min-width: 400px">
              <input v-model="searchQuery" type="text" class="form-control form-control-sm" 
                placeholder="Cari perusahaan, sektor, atau email..." 
                style="background: #fff; color: #333; border: none; padding-right: 60px;" />
              <i class="ri-search-line search-icon" style="color: #666; right: 35px;"></i>
              <button v-if="searchQuery" @click="clearSearch" class="btn btn-sm clear-btn" style="color: #666;">
                <i class="ri-close-line"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="card-body p-4">
          <div v-if="loading" class="text-center p-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="text-muted mt-2 mb-0">Memuat data...</p>
          </div>

          <template v-else>
            <!-- Controls Bar -->
            <div class="controls-bar d-flex flex-wrap justify-content-between align-items-center mb-4 pb-3 border-bottom gap-3">
              <div class="d-flex align-items-center gap-2">
                <div class="d-flex align-items-center bg-light rounded-pill px-3 py-1">
                  <i class="ri-list-ordered me-2 text-primary"></i>
                  <span class="text-muted fs-13 me-2">Tampilkan</span>
                  <select v-model="itemsPerPage" class="form-select form-select-sm border-0 bg-transparent" style="width: 70px">
                    <option v-for="n in [5, 10, 15, 20, 25, 50]" :key="n" :value="n">{{ n }}</option>
                  </select>
                </div>
                <span class="badge bg-primary-transparent text-primary px-3 py-2">
                  <i class="ri-database-2-line me-1"></i>{{ displayData.length }} data
                </span>
              </div>
              <button v-if="isAdmin"
                @click="openCreateModal"
                class="btn btn-secondary d-flex align-items-center gap-2 shadow-sm"
              >
                <i class="ri-add-circle-line"></i>
                <span>Tambah Stakeholder</span>
              </button>
            </div>

            <!-- Table -->
            <div class="table-responsive rounded-3 border">
              <table class="table table-hover text-nowrap mb-0">
                <thead class="table-light">
                  <tr>
                    <th class="fw-semibold text-muted" style="width: 60px">No</th>
                    <th class="sortable fw-semibold">
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
                    <th class="sortable fw-semibold">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-pie-chart-line text-primary"></i>
                        <span class="column-label" @click="toggleSort('sektor')" title="Click to toggle sort">Sektor</span>
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
                    <th class="fw-semibold">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-mail-line text-primary"></i>
                        <span>Email</span>
                      </div>
                    </th>
                    <th class="text-center fw-semibold" style="width: 180px">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!displayData.length">
                    <td colspan="5" class="text-center py-5">
                      <div class="empty-state">
                        <div class="empty-icon mb-3">
                          <i class="ri-building-2-line"></i>
                        </div>
                        <h6 class="text-muted mb-1">Tidak Ada Stakeholder</h6>
                        <p class="text-muted fs-13 mb-0">Coba ubah kriteria pencarian Anda</p>
                      </div>
                    </td>
                  </tr>
                  <tr v-for="(item, i) in displayData" :key="item.slug" class="table-row-hover">
                    <td class="align-middle">
                      <span class="badge bg-light text-muted fw-medium">{{ (currentPage - 1) * itemsPerPage + i + 1 }}</span>
                    </td>
                    <td class="align-middle">
                      <div class="d-flex align-items-center gap-3">
                        <span class="avatar avatar-md avatar-rounded shadow-sm overflow-hidden" 
                          :style="{ background: item.photo ? 'transparent' : 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)' }">
                          <img v-if="item.photo" :src="item.photo" :alt="item.nama_perusahaan" class="w-100 h-100 object-fit-cover" />
                          <span v-else class="text-white fw-bold fs-16">{{ item.nama_perusahaan.charAt(0).toUpperCase() }}</span>
                        </span>
                        <div>
                          <span class="fw-semibold d-block text-dark">{{ item.nama_perusahaan }}</span>
                          <small class="text-muted d-none d-lg-block">
                            <i class="ri-map-pin-line me-1"></i>{{ item.alamat?.substring(0, 30) }}...
                          </small>
                        </div>
                      </div>
                    </td>
                    <td class="align-middle">
                      <span class="badge rounded-pill px-3 py-2 fs-12" 
                        :class="getSektorBadgeClass(item.sektor)">
                        {{ item.sektor }}
                      </span>
                    </td>
                    <td class="align-middle">
                      <a :href="`mailto:${item.email}`" class="email-link d-inline-flex align-items-center gap-2 text-decoration-none">
                        <span class="email-text">{{ item.email }}</span>
                      </a>
                    </td>
                    <td class="text-center align-middle">
                      <div class="d-flex gap-1 justify-content-center">
                        <router-link
                          :to="`/profile-stakeholders/${item.slug}`"
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
                          <i class="ri-edit-line"></i>
                        </button>
                        <button v-if="isAdmin"
                          @click="openDeleteModal(item)"
                          class="btn btn-sm btn-icon btn-wave btn-danger-light"
                          title="Delete">
                          <i class="ri-delete-bin-line"></i>
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
  <div v-if="showCreateModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0, 0, 0, 0.5)" @click.self="showCreateModal = false">
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
                      <div v-if="!formData.photo" class="position-absolute d-flex flex-column align-items-center justify-content-center text-muted" 
                        style="top: 50%; left: 50%; transform: translate(-50%, -50%);">
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

                <!-- Sektor -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-pie-chart-line me-1 text-primary"></i>Sektor
                    <span class="text-danger">*</span>
                  </label>
                  <select v-model="formData.sektor" class="form-select" :class="{ 'is-invalid': formErrors.sektor }">
                    <option value="" disabled>-- Pilih Sektor --</option>
                    <option value="Teknologi Informasi">Teknologi Informasi</option>
                    <option value="Perdagangan Umum">Perdagangan Umum</option>
                    <option value="Software Development">Software Development</option>
                    <option value="Konstruksi">Konstruksi</option>
                    <option value="Teknologi">Teknologi</option>
                    <option value="Keuangan">Keuangan</option>
                    <option value="Kesehatan">Kesehatan</option>
                    <option value="Pendidikan">Pendidikan</option>
                    <option value="Manufaktur">Manufaktur</option>
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
                  <div class="input-group" :class="{ 'is-invalid': formErrors.telepon }">
                    <CountryCodeDropdown 
                      v-model="selectedCountryCode" 
                      :error="!!formErrors.telepon"
                      @update:modelValue="handleCountryCodeChange"
                    />
                    <input 
                      type="tel" 
                      class="form-control" 
                      v-model="phoneNumber"
                      @input="handlePhoneInput"
                      inputmode="numeric" 
                      placeholder="813 8282 8282"
                      :class="{ 'is-invalid': formErrors.telepon }"
                    />
                  </div>
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
  <div v-if="showEditModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0, 0, 0, 0.5)" @click.self="showEditModal = false">
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
                      <div v-if="!formData.photo" class="position-absolute d-flex flex-column align-items-center justify-content-center text-muted" 
                        style="top: 50%; left: 50%; transform: translate(-50%, -50%);">
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

                <!-- Sektor -->
                <div class="col-xl-6 col-lg-6 col-md-6">
                  <label class="form-label fw-medium">
                    <i class="ri-pie-chart-line me-1 text-primary"></i>Sektor
                    <span class="text-danger">*</span>
                  </label>
                  <select v-model="formData.sektor" class="form-select" :class="{ 'is-invalid': formErrors.sektor }">
                    <option value="" disabled>-- Pilih Sektor --</option>
                    <option value="Teknologi Informasi">Teknologi Informasi</option>
                    <option value="Perdagangan Umum">Perdagangan Umum</option>
                    <option value="Software Development">Software Development</option>
                    <option value="Konstruksi">Konstruksi</option>
                    <option value="Teknologi">Teknologi</option>
                    <option value="Keuangan">Keuangan</option>
                    <option value="Kesehatan">Kesehatan</option>
                    <option value="Pendidikan">Pendidikan</option>
                    <option value="Manufaktur">Manufaktur</option>
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
                  <div class="input-group" :class="{ 'is-invalid': formErrors.telepon }">
                    <CountryCodeDropdown 
                      v-model="selectedCountryCode" 
                      :error="!!formErrors.telepon"
                      @update:modelValue="handleCountryCodeChange"
                    />
                    <input 
                      type="tel" 
                      class="form-control" 
                      v-model="phoneNumber"
                      @input="handlePhoneInput"
                      inputmode="numeric" 
                      placeholder="813 8282 8282"
                      :class="{ 'is-invalid': formErrors.telepon }"
                    />
                  </div>
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
  <div v-if="showDeleteModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0, 0, 0, 0.5)" @click.self="showDeleteModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Konfirmasi Hapus</h5>
          <button type="button" class="btn-close" @click="showDeleteModal = false"></button>
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
          <button type="button" class="btn btn-secondary" @click="showDeleteModal = false">Batal</button>
          <button type="button" class="btn btn-danger" @click="deleteStakeholder">
            <i class="ri-delete-bin-line me-1"></i>Hapus
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gradient-header-card { border: none !important; box-shadow: 0 0.125rem 0.25rem rgba(0,0,0,0.075) !important; overflow: hidden !important; }
.gradient-header-card .card-header { border: none !important; border-radius: 0 !important; margin: 0 !important; }
.gradient-header-card .card-body { border: 1px solid var(--default-border); border-top: none !important; border-radius: 0 !important; }

.search-container { position: relative; }
.search-container input { padding-right: 35px !important; }
.search-container input::placeholder { color: #999; }
.search-icon { position: absolute; right: 35px; top: 50%; transform: translateY(-50%); pointer-events: none; z-index: 10; }
.clear-btn { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); padding: 0.25rem; background: transparent; border: none; }
.clear-btn:hover { color: #333; }

.sortable, .column-label { cursor: pointer; user-select: none; }
.sort-arrows { display: flex; flex-direction: column; line-height: 0.5; }
.sort-arrows i { font-size: 1rem; color: #d1d5db; cursor: pointer; transition: color 0.2s; }
.sort-arrows i:hover { color: #6b7280; }
.sort-arrows i.active { color: #3b82f6; }

.modal.show { display: block; }
.modal.show .modal-dialog:not(.custom-modal) { margin: 0 auto; max-width: 800px; }
.modal.show .modal-dialog.custom-modal { margin: 0 auto; max-width: 800px; width: 800px; }
.modal.show .modal-dialog.modal-xxl { max-width: 95%; width: 95%; }
.modal.show .modal-dialog.custom-modal .modal-content { width: 100% !important; max-width: none !important; }
.toast { min-width: 250px; }

.empty-state { padding: 2rem 1rem; }
.empty-state .empty-icon { width: 80px; height: 80px; margin: 0 auto; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(var(--primary-rgb),0.1), rgba(var(--secondary-rgb),0.1)); border-radius: 50%; }
.empty-state .empty-icon i { font-size: 2.5rem; color: var(--primary-color); opacity: 0.7; }

.btn-icon { width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; }

.email-link { color: var(--default-text-color); transition: all 0.2s ease; }
.email-link:hover { color: var(--primary-color); }
.email-link .email-icon-wrapper { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(var(--primary-rgb),0.1), rgba(var(--info-rgb),0.1)); border-radius: 6px; color: var(--primary-color); font-size: 14px; transition: all 0.2s ease; }
.email-link:hover .email-icon-wrapper { background: linear-gradient(135deg, rgba(var(--primary-rgb),0.2), rgba(var(--info-rgb),0.2)); transform: scale(1.05); }
.email-link .email-text { font-size: 13px; color: #6c757d; transition: color 0.2s ease; }
.email-link:hover .email-text { color: var(--primary-color); }

.photo-preview-modal { width: 180px; height: 120px; border-color: #dee2e6 !important; }
@media (max-width: 575px) { .photo-preview-modal { width: 100%; height: 150px; } }


/* Dark Mode Specific Styles */
html[data-theme-mode="dark"] .card-header[style*="gradient"] .card-title,
html[data-theme-mode="dark"] .card-header[style*="gradient"] i,
html.dark .card-header[style*="gradient"] .card-title,
html.dark .card-header[style*="gradient"] i {
  color: rgb(0, 0, 0) !important;
}

html[data-theme-mode="dark"] .search-container input::placeholder,
html.dark .search-container input::placeholder {
  color: #000000 !important;
}

html[data-theme-mode="dark"] .search-icon,
html[data-theme-mode="dark"] .clear-btn,
html.dark .search-icon,
html.dark .clear-btn {  
  color: #000000 !important;
}

html[data-theme-mode="dark"] .table thead th,
html.dark .table thead th {
  color: #e2e8f0 !important;
}

html[data-theme-mode="dark"] .table tbody .text-dark,
html[data-theme-mode="dark"] .email-link,
html[data-theme-mode="dark"] .email-link .email-text,
html.dark .table tbody .text-dark,
html.dark .email-link,
html.dark .email-link .email-text {
  color: #cbd5e0 !important;
}

html[data-theme-mode="dark"] .table tbody .text-muted,
html.dark .table tbody .text-muted {
  color: #a0aec0 !important;
}

html[data-theme-mode="dark"] .badge.bg-light,
html.dark .badge.bg-light {
  background-color: #374151 !important;
  color: #d1d5db !important;
}

html[data-theme-mode="dark"] .email-link:hover,
html[data-theme-mode="dark"] .email-link:hover .email-text,
html.dark .email-link:hover,
html.dark .email-link:hover .email-text {
  color: var(--primary-color) !important;
}

</style>

<style>
/* Global style untuk modal - tidak scoped agar bisa override */
@media (min-width: 992px) {
  .modal.fade.show.d-block .modal-dialog {
    margin-left: calc(250px + ((100% - 250px - 1000px) / 2)) !important;
    margin-right: auto !important;
  }
}
</style>
