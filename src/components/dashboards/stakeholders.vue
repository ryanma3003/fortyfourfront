<script lang="ts">
import { ref, computed, onMounted, watch, nextTick } from "vue";
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
import { csirtService } from "../../services/csirt.service";
import { usersService } from "../../services/users.service";
import type { User } from "../../types/user.types";



export default {
  data() {
    return {
      dataToPass: {
        title: { label: "Dashboards", path: "/dashboard" },
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
    const viewMode = ref<"table" | "grid">("table");
    
    // Automatically change pagination limit to 12 when in Grid View to make it look balanced
    watch(viewMode, (newMode) => {
      itemsPerPage.value = newMode === "grid" ? 12 : 10;
      currentPage.value = 1; // Reset to page 1 on view switch
    }, { immediate: true });

    const selectedStakeholderIds = ref<string[]>([]);
    const expandedStakeholderSlugs = ref<string[]>([]);
    const showAdvancedFilters = ref(false);
    const dateRangeStart = ref("");
    const dateRangeEnd = ref("");
    const datePreset = ref<"7d" | "30d" | "all" | "custom">("all");

    // User data and filter
    const usersData = ref<User[]>([]);
    const userFilter = ref<'all' | 'hasUser' | 'noUser'>('all');
    const showCreateModal   = ref(false);
    const showEditModal     = ref(false);
    const showDeleteModal   = ref(false);
    const currentEditItem   = ref<Stakeholder | null>(null);
    const currentDeleteItem = ref<Stakeholder | null>(null);
    const sektorFilter = ref<string | number>("");
    const subSektorFilter = ref<string | number>("");

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

    // Filtered sub sektor untuk filter table
    const availableSubSektorFilters = computed(() => {
      if (!sektorFilter.value) return subSektorList.value;
      return subSektorList.value.filter(ss => {
        const pid = getSubSektorParentId(ss);
        return pid !== undefined && String(pid) === String(sektorFilter.value);
      });
    });

    const currentSektorNameFilter = computed(() => {
      if (!sektorFilter.value) return "";
      const s = sektorList.value.find(s => String(s.id) === String(sektorFilter.value));
      return s ? s.nama_sektor : "";
    });

    // ? Auto-set formData.sektor (nama) dan selectedSektorId ketika sub sektor ID dipilih
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

    // ? Helper: Dapatkan nama sektor induk dari nama sub sektor
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

    const loadUsers = async () => {
      try {
        usersData.value = await usersService.getAll();
      } catch (error) {
        console.error('Failed to load users:', error);
        usersData.value = [];
      }
    };

    // Helper: ambil nama sub sektor dari item
    const getItemSubSektorName = (item: Stakeholder): string => {
      return item.sub_sektor?.nama_sub_sektor || item.sektor || "";
    };

    const isWithinDateRange = (item: Stakeholder): boolean => {
      if (!dateRangeStart.value && !dateRangeEnd.value) return true;
      if (!item.created_at) return true;

      const itemDate = new Date(item.created_at);
      if (Number.isNaN(itemDate.getTime())) return true;

      const start = dateRangeStart.value ? new Date(dateRangeStart.value) : null;
      const end = dateRangeEnd.value ? new Date(`${dateRangeEnd.value}T23:59:59`) : null;

      if (start && itemDate < start) return false;
      if (end && itemDate > end) return false;
      return true;
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
      } else {
        // Filter by user status
        if (userFilter.value === 'hasUser') {
          data = data.filter(i => hasUser(i.id));
        } else if (userFilter.value === 'noUser') {
          data = data.filter(i => !hasUser(i.id));
        }

        // Filter by sektor (parent id)
        if (sektorFilter.value !== "") {
          data = data.filter(i => {
            const itemSubSektor = i.sub_sektor || subSektorList.value.find(ss => getSubSektorName(ss) === i.sektor);
            if (!itemSubSektor) return false;
            const parentId = getSubSektorParentId(itemSubSektor);
            return parentId !== undefined && String(parentId) === String(sektorFilter.value);
          });
        }
        
        // Filter by sub-sektor
        if (subSektorFilter.value !== "") {
          data = data.filter(i => {
            const itemSubSektor = i.sub_sektor || subSektorList.value.find(ss => getSubSektorName(ss) === i.sektor);
            if (!itemSubSektor) return false;
            return String(itemSubSektor.id) === String(subSektorFilter.value);
          });
        }
      }

      data = data.filter(isWithinDateRange);

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

      // ? Auto-detect sub sektor ID: utamakan dari sub_sektor.id (nested), fallback nama
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

    const deleteStakeholderWithCascade = async (stakeholderId: string | number) => {
      try {
        const allCsirts = await csirtService.getMembers();
        const companyCsirts = allCsirts.filter(
          c => String(c.perusahaan?.id) === String(stakeholderId) ||
               String(c.id_perusahaan) === String(stakeholderId)
        );
        for (const csirt of companyCsirts) {
          await csirtStore.deleteCsirtById(csirt.id);
        }
      } catch (err) {
        console.warn('Cascade delete CSIRT failed:', err);
        showNotification('Gagal menghapus data CSIRT terkait: ' + (err as any)?.message, 'error');
        return false;
      }

      const result = await stakeholdersStore.deleteStakeholderById(stakeholderId);
      if (!result.success) {
        showNotification("Gagal menghapus stakeholder: " + result.error, "error");
        return false;
      }

      await csirtStore.refresh();
      selectedStakeholderIds.value = selectedStakeholderIds.value.filter(id => String(id) !== String(stakeholderId));
      return true;
    };

    const deleteStakeholder = async () => {
      if (!currentDeleteItem.value) return;

      const stakeholderId = currentDeleteItem.value.id;

      // Cascade delete: SDMs → SEs → CSIRTs → perusahaan
      // Fetch fresh from API to avoid stale store data; filter by perusahaan UUID.
      try {
        const allCsirts = await csirtService.getMembers();
        const companyCsirts = allCsirts.filter(
          c => String(c.perusahaan?.id) === String(stakeholderId) ||
               String(c.id_perusahaan)  === String(stakeholderId)
        );
        for (const csirt of companyCsirts) {
          await csirtStore.deleteCsirtById(csirt.id);
        }
      } catch (err) {
        console.warn('Cascade delete CSIRT failed:', err);
        showNotification('Gagal menghapus data CSIRT terkait: ' + (err as any)?.message, 'error');
        return;
      }

      const result = await stakeholdersStore.deleteStakeholderById(stakeholderId);
      if (result.success) {
        await csirtStore.refresh();
        showDeleteModal.value = false;
        showNotification("Stakeholder berhasil dihapus!", "success");
      } else {
        showNotification("Gagal menghapus stakeholder: " + result.error, "error");
      }
    };

    // Reset page to 1 when any filter changes
    watch([sektorFilter, subSektorFilter, userFilter, dateRangeStart, dateRangeEnd], () => {
      currentPage.value = 1;
      selectedStakeholderIds.value = [];
    });

    // Scroll to top of table when page changes
    watch(currentPage, () => {
      nextTick(() => {
        const card = document.querySelector('.stakeholder-table-wrap');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    onMounted(async () => {
      loadStakeholders();
      await loadUsers();
      await loadAllSubSektors();
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

    // Check if stakeholder has a user associated with it
    const hasUser = (stakeholderId: string | number): boolean => {
      return usersData.value.some(u => String(u.id_perusahaan) === String(stakeholderId));
    };

    const countStakeholderWithUser = computed(() =>
      stakeholdersStore.stakeholders.filter(s => hasUser(s.id)).length
    );

    const countStakeholderNoUser = computed(() =>
      stakeholdersStore.stakeholders.filter(s => !hasUser(s.id)).length
    );

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

    const totalStakeholders = computed(() => filteredData.value.length);
    const activeSubSectors = computed(() =>
      new Set(filteredData.value.map(item => getItemSubSektorName(item)).filter(Boolean)).size
    );
    const filteredIkasCount = computed(() =>
      filteredData.value.filter(item => hasIkas(item.slug)).length
    );
    const filteredCsirtCount = computed(() =>
      filteredData.value.filter(item => hasCompleteCsirt(item.id)).length
    );
    const coveredCount = computed(() => {
      if (!filteredData.value.length) return 0;
      return filteredData.value.filter(item => hasIkas(item.slug) && hasCompleteCsirt(item.id)).length;
    });
    const visibleStart = computed(() =>
      filteredData.value.length ? (currentPage.value - 1) * itemsPerPage.value + 1 : 0
    );
    const visibleEnd = computed(() =>
      Math.min(currentPage.value * itemsPerPage.value, filteredData.value.length)
    );

    const isSelected = (id: string | number): boolean =>
      selectedStakeholderIds.value.includes(String(id));

    const toggleStakeholderSelection = (id: string | number) => {
      const normalizedId = String(id);
      if (isSelected(normalizedId)) {
        selectedStakeholderIds.value = selectedStakeholderIds.value.filter(item => item !== normalizedId);
      } else {
        selectedStakeholderIds.value = [...selectedStakeholderIds.value, normalizedId];
      }
    };

    const allVisibleSelected = computed(() =>
      !!displayData.value.length && displayData.value.every(item => isSelected(item.id))
    );

    const toggleSelectAllVisible = () => {
      if (allVisibleSelected.value) {
        selectedStakeholderIds.value = selectedStakeholderIds.value.filter(
          id => !displayData.value.some(item => String(item.id) === String(id))
        );
        return;
      }

      const next = new Set(selectedStakeholderIds.value);
      displayData.value.forEach(item => next.add(String(item.id)));
      selectedStakeholderIds.value = [...next];
    };

    const clearSelection = () => {
      selectedStakeholderIds.value = [];
    };

    const isExpanded = (slug: string): boolean =>
      expandedStakeholderSlugs.value.includes(slug);

    const toggleExpandedRow = (slug: string) => {
      if (isExpanded(slug)) {
        expandedStakeholderSlugs.value = expandedStakeholderSlugs.value.filter(item => item !== slug);
      } else {
        expandedStakeholderSlugs.value = [...expandedStakeholderSlugs.value, slug];
      }
    };

    const resetDateRange = () => {
      dateRangeStart.value = "";
      dateRangeEnd.value = "";
      datePreset.value = "all";
    };

    const formatDateInput = (date: Date) => {
      const year = date.getFullYear();
      const month = `${date.getMonth() + 1}`.padStart(2, "0");
      const day = `${date.getDate()}`.padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const applyDatePreset = (preset: "7d" | "30d" | "all" | "custom") => {
      datePreset.value = preset;
      if (preset === "all" || preset === "custom") {
        if (preset === "all") {
          dateRangeStart.value = "";
          dateRangeEnd.value = "";
        }
        return;
      }

      const end = new Date();
      const start = new Date();
      const offset = preset === "7d" ? 6 : 29;
      start.setDate(end.getDate() - offset);

      dateRangeStart.value = formatDateInput(start);
      dateRangeEnd.value = formatDateInput(end);
    };

    watch([dateRangeStart, dateRangeEnd], ([start, end]) => {
      if (!start && !end) {
        datePreset.value = "all";
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayString = formatDateInput(today);

      if (end === todayString && start) {
        const startDate = new Date(start);
        if (!Number.isNaN(startDate.getTime())) {
          const diffDays = Math.round((today.getTime() - startDate.getTime()) / 86400000) + 1;
          if (diffDays === 7) {
            datePreset.value = "7d";
            return;
          }
          if (diffDays === 30) {
            datePreset.value = "30d";
            return;
          }
        }
      }

      datePreset.value = "custom";
    });

    return {
      allVisibleSelected,
      activeSubSectors,
      countIkasOnly,
      countCsirtOnly,
      countBoth,
      countIkas,
      countCsirt,
      coveredCount,
      countStakeholderWithUser,
      countStakeholderNoUser,
      dateRangeEnd,
      dateRangeStart,
      datePreset,
      userFilter,
      sektorFilter,
      subSektorFilter,
      hasUser,
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
      availableSubSektorFilters,
      clearSelection,
      currentSektorNameFilter,
      expandedStakeholderSlugs,
      filteredCsirtCount,
      filteredIkasCount,
      isExpanded,
      isSelected,
      loadingSubSektors,
      resetDateRange,
      applyDatePreset,
      selectedSektorId,
      selectedStakeholderIds,
      selectedSubSektorId,
      showAdvancedFilters,
      toggleExpandedRow,
      toggleSelectAllVisible,
      toggleStakeholderSelection,
      totalStakeholders,
      viewMode,
      visibleEnd,
      visibleStart,
      getSektorName,
      getSubSektorName,
      getSektorFromSubSektor,

getSektorBadgeStyle: (subSektorName: string) => {
  if (!subSektorName || subSektorName === "-") {
    return {
      backgroundColor: '#e2e8f0',
      color: '#1e293b',
      border: '1.5px solid #cbd5e1'
    };
  }

  // --- HASH STABIL ---
  let hash = 0;
  for (let i = 0; i < subSektorName.length; i++) {
    hash = subSektorName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const base = Math.abs(hash);

  // --- RANGE HUE AMAN (NO UNGU / PINK) ---
  const MIN_HUE = 40;   // kuning
  const MAX_HUE = 220;  // biru
  const RANGE = MAX_HUE - MIN_HUE;

  // pakai golden angle tapi dibatasi range
  const goldenAngle = 137.508;
  const hue = MIN_HUE + ((base * goldenAngle) % RANGE);

  // --- VARIASI SATURATION ---
  const saturationVariants = [50, 60, 70];
  const saturation = saturationVariants[base % saturationVariants.length];

  // --- VARIASI LIGHTNESS (biar nggak mirip) ---
  const lightnessVariants = [82, 86, 90];
  const lightness = lightnessVariants[(Math.floor(base / 3)) % lightnessVariants.length];

  return {
    backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    color: `hsl(${hue}, ${Math.min(saturation + 10, 80)}%, 22%)`,
    border: `1.5px solid hsl(${hue}, ${saturation - 10}%, ${lightness - 12}%)`
  };
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
  <pageheader :propData="dataToPass" />

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
          <div class="stakeholders-header-main ">
            <div class="stakeholders-hero-copy1 d-flex justify-content-between align-items-start flex-column">
              <div>
                <div class="stakeholders-inline-breadcrumb">Dashboard <span>/</span> Stakeholders</div>
                <div class="card-title mb-0 fw-bold header-card-title stakeholders-hero-title">Stakeholders</div>
               <div class="header-subtitle mt-1 stakeholders-hero-subtitle">Daftar Perusahaan Terdaftar</div>
              </div>
              <div class="stakeholders-meta-stack">
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Active Sub-Sektor</span>
                  <strong><i class="ri-layout-grid-line"></i> {{ activeSubSectors }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Total Stakeholders</span>
                  <strong><i class="ri-building-line"></i> {{ totalStakeholders }}</strong>
                </div>
              </div>
            </div>
            <div class="stakeholders-header-tools stakeholders-hero-tools">
              <div class="search-container position-relative stakeholders-search">
                <i class="ri-search-line card-search-icon"></i>
                <input
                  v-model="searchQuery"
                  type="text"
                  class="form-control form-control-sm header-search-input"
                  placeholder="Search company, sector, sub-sector, or email"
                />
                <button v-if="searchQuery" @click="clearSearch" class="clear-btn" title="Clear search">
                  <i class="ri-close-circle-fill"></i>
                </button>
              </div>
              <div class="stakeholders-filter-panel">
                <div class="stakeholders-filter-label">
                  <i class="ri-filter-fill"></i>
                  <span>Filter Data</span>
                </div>
                <div class="stakeholders-filter-controls">
                  <select v-model="sektorFilter" class="form-select stakeholders-select-input">
                    <option value="">All sectors</option>
                    <option v-for="s in sektorList" :key="s.id" :value="s.id">{{ s.nama_sektor }}</option>
                  </select>
                  <select v-model="subSektorFilter" class="form-select stakeholders-select-input">
                    <option value="">All sub-sectors</option>
                    <option v-for="s in availableSubSektorFilters" :key="s.id" :value="s.id">{{ s.nama_sub_sektor }}</option>
                  </select>
                 <div class="dropdown">
                  <button class="form-select stakeholders-select-input" type="button" data-bs-toggle="dropdown">
                    <i class="ri-user-settings-line me-1"></i>
                    {{
                      userFilter === 'all'
                        ? 'Semua stakeholder'
                        : userFilter === 'hasUser'
                        ? 'Sudah punya user'
                        : 'Belum punya user'
                    }}
                  </button>
                  <ul class="dropdown-menu shadow-sm stakeholders-toolbar-menu">
                    <li><a class="dropdown-item" href="#" @click.prevent="userFilter = 'all'">Semua ({{ filteredData.length }})</a></li>
                    <li><a class="dropdown-item" href="#" @click.prevent="userFilter = 'hasUser'">Ada User ({{ countStakeholderWithUser }})</a></li>
                    <li><a class="dropdown-item" href="#" @click.prevent="userFilter = 'noUser'">Tanpa User ({{ countStakeholderNoUser }})</a></li>
                  </ul>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card-body p-4 stakeholders-premium-body" style="overflow: visible !important;">
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
            <div class="stakeholders-summary-grid mb-4">
              <div class="stakeholders-summary-card stakeholders-summary-card--indigo">
                <div class="stakeholders-summary-icon"><i class="ri-file-chart-line"></i></div>
                <div>
                  <div class="stakeholders-summary-value">{{ filteredIkasCount }}</div>
                  <div class="stakeholders-summary-label">IKAS Count</div>
                </div>
              </div>
              <div class="stakeholders-summary-card stakeholders-summary-card--emerald">
                <div class="stakeholders-summary-icon"><i class="ri-shield-check-line"></i></div>
                <div>
                  <div class="stakeholders-summary-value">{{ filteredCsirtCount }}</div>
                  <div class="stakeholders-summary-label">CSIRT Count</div>
                </div>
              </div>
              <div class="stakeholders-summary-card stakeholders-summary-card--slate">
                <div class="stakeholders-summary-icon"><i class="ri-pulse-line"></i></div>
                <div>
                  <div class="stakeholders-summary-value">
                    {{ coveredCount }} <span class="fs-15 text-muted fw-medium ms-1">/ {{ totalStakeholders }}</span>
                  </div>
                  <div class="stakeholders-summary-label">Ikas & Csirt</div>
                </div>
              </div>
            </div>

            <div class="controls-bar stakeholders-toolbar stakeholders-filter-bar">


              <div class="stakeholders-toolbar-right">
                <div class="stakeholders-view-toggle" role="group" aria-label="View mode">
                  <button class="stakeholders-view-btn" :class="{ active: viewMode === 'table' }" @click="viewMode = 'table'" title="List view">
                    <i class="ri-list-check-2"></i>
                    <span>List view</span>
                  </button>
                  <button class="stakeholders-view-btn" :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'" title="Grid view">
                    <i class="ri-layout-grid-line"></i>
                    <span>Grid view</span>
                  </button>
                </div>
                <div class="stakeholders-per-page">
                  <span>{{ viewMode === 'grid' ? 'Cards' : 'Rows' }}</span>
                  <select v-model="itemsPerPage" class="form-select form-select-sm entries-select">
                    <option v-for="n in (viewMode === 'grid' ? [6, 12, 18, 24, 60] : [5, 10, 15, 20, 25, 50])" :key="n" :value="n">{{ n }}</option>
                  </select>
                </div>

                <button v-if="isAdmin" @click="openCreateModal" class="btn stakeholders-add-btn ms-auto d-flex align-items-center gap-2">
                  <i class="ri-add-circle-line fs-13"></i>
                  <span class="btn-text">Add Stakeholder</span>
                </button>
              </div>
            </div>

            <transition name="fade">
              <div v-if="showAdvancedFilters" class="stakeholders-advanced-panel">
                <div class="dropdown">
                  <button class="btn btn-sm stakeholders-toolbar-btn dropdown-toggle" type="button" data-bs-toggle="dropdown">
                    <i class="ri-user-settings-line me-1"></i>
                    {{
                      userFilter === 'all'
                        ? 'Semua stakeholder'
                        : userFilter === 'hasUser'
                        ? 'Sudah punya user'
                        : 'Belum punya user'
                    }}
                  </button>
                  <ul class="dropdown-menu shadow-sm stakeholders-toolbar-menu">
                    <li><a class="dropdown-item" href="#" @click.prevent="userFilter = 'all'">Semua ({{ filteredData.length }})</a></li>
                    <li><a class="dropdown-item" href="#" @click.prevent="userFilter = 'hasUser'">Ada User ({{ countStakeholderWithUser }})</a></li>
                    <li><a class="dropdown-item" href="#" @click.prevent="userFilter = 'noUser'">Tanpa User ({{ countStakeholderNoUser }})</a></li>
                  </ul>
                </div>
                <div class="stakeholders-filter-hint">
                  <i class="ri-information-line"></i>
                  <span>{{ currentSektorNameFilter || 'Semua sektor' }} · {{ paginationInfo }}</span>
                </div>
              </div>
            </transition>
            <div v-if="viewMode === 'table'" class="table-responsive stakeholder-table-wrap stakeholders-table-shell">
              <table class="table stakeholder-table mb-0">
                <thead class="stakeholder-thead">
                  <tr>
                    <th class="th-no">No</th>
                    <th class="sortable fw-semibold th-name-wide">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-building-line text-primary"></i>
                        <span class="column-label" @click="toggleSort('nama_perusahaan')" title="Sort company">Company</span>
                        <div class="sort-arrows">
                          <i class="ri-arrow-up-s-line" :class="{ active: sortField === 'nama_perusahaan' && sortOrder === 'asc' }" @click.stop="sortField = 'nama_perusahaan'; sortOrder = 'asc';"></i>
                          <i class="ri-arrow-down-s-line" :class="{ active: sortField === 'nama_perusahaan' && sortOrder === 'desc' }" @click.stop="sortField = 'nama_perusahaan'; sortOrder = 'desc';"></i>
                        </div>
                      </div>
                    </th>
                    <th class="sortable fw-semibold th-sektor">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-pie-chart-line text-primary"></i>
                        <span class="column-label" @click="toggleSort('sektor')" title="Sort sector">Sector &amp; Sub-sector</span>
                        <div class="sort-arrows">
                          <i class="ri-arrow-up-s-line" :class="{ active: sortField === 'sektor' && sortOrder === 'asc' }" @click.stop="sortField = 'sektor'; sortOrder = 'asc';"></i>
                          <i class="ri-arrow-down-s-line" :class="{ active: sortField === 'sektor' && sortOrder === 'desc' }" @click.stop="sortField = 'sektor'; sortOrder = 'desc';"></i>
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
                    <td colspan="7" class="text-center py-5">
                      <div class="empty-state">
                        <div class="empty-icon-ring mb-3">
                          <div class="empty-icon-inner">
                            <i class="ri-building-2-line"></i>
                          </div>
                        </div>
                        <h6 class="fw-semibold mb-1 empty-state-title">No stakeholders found</h6>
                        <p class="text-muted fs-13 mb-3">Coba ubah pencarian, filter sektor, atau rentang tanggal.</p>
                        <button @click="clearSearch(); resetDateRange(); sektorFilter = ''; subSektorFilter = ''; userFilter = 'all';" class="btn btn-sm btn-outline-primary rounded-pill px-4">
                          <i class="ri-refresh-line me-1"></i>Reset filters
                        </button>
                      </div>
                    </td>
                  </tr>
                  <template v-for="(item, i) in displayData" :key="item.slug">
                    <tr class="stakeholder-row" :class="{ 'stakeholder-row-expanded': isExpanded(item.slug) }">

                      <td class="align-middle text-center">
                        <span class="row-number">{{ (currentPage - 1) * itemsPerPage + i + 1 }}</span>
                      </td>
                      <td class="align-middle">
                        <div class="stakeholder-company-cell">
                          <button class="stakeholder-expand-btn" @click="toggleExpandedRow(item.slug)" :title="isExpanded(item.slug) ? 'Collapse row' : 'Expand row'">
                            <i :class="isExpanded(item.slug) ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'"></i>
                          </button>
                          <div class="company-avatar" :class="getAvatarClass(item.nama_perusahaan.charAt(0).toUpperCase())">
                            <img v-if="item.photo" :src="item.photo" :alt="item.nama_perusahaan" class="company-avatar-img" />
                            <span v-else class="company-avatar-letter">{{ item.nama_perusahaan.charAt(0).toUpperCase() }}</span>
                          </div>
                          <div class="company-name-wrap">
                            <span class="company-name d-block">{{ item.nama_perusahaan }}</span>
                            <small class="company-address d-block">
                              <i class="ri-map-pin-2-line me-1"></i>{{ item.alamat?.substring(0, 54) }}{{ item.alamat?.length > 54 ? '...' : '' }}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td class="align-middle">
                        <div class="d-flex flex-column align-items-start gap-2">
                          <span class="stakeholders-sector-parent"><i class="ri-government-line text-muted me-1"></i>{{ getSektorFromSubSektor(getItemSubSektorName(item)) }}</span>
                          <span class="badge-sektor" :style="getSektorBadgeStyle(getItemSubSektorName(item))">{{ getItemSubSektorName(item) }}</span>
                        </div>
                      </td>
                      <td class="align-middle">
                        <a :href="`mailto:${item.email}`" class="email-link stakeholders-email-link">
                          <span class="email-text">{{ item.email }}</span>
                        </a>
                      </td>
                      <td class="text-center align-middle">
                        <div class="status-indicators">
                          <div class="status-badge" :class="hasIkas(item.slug) ? 'badge-done' : 'badge-pending'" title="IKAS status">
                            <span class="badge-icon-dot">
                              <i :class="hasIkas(item.slug) ? 'ri-check-line' : 'ri-subtract-line'"></i>
                            </span>
                            <span class="badge-label">IKAS</span>
                          </div>
                          <div class="status-badge" :class="hasCompleteCsirt(item.id) ? 'badge-done' : 'badge-pending'" title="CSIRT status">
                            <span class="badge-icon-dot">
                              <i :class="hasCompleteCsirt(item.id) ? 'ri-check-line' : 'ri-subtract-line'"></i>
                            </span>
                            <span class="badge-label">CSIRT</span>
                          </div>
                        </div>
                      </td>
                      <td class="text-center align-middle">
                        <div class="d-flex gap-1 justify-content-center">
                          <router-link :to="`/stakeholders/${item.slug}`" class="btn btn-sm btn-icon btn-wave btn-info-light stakeholders-action-btn" title="View">
                            <i class="ri-eye-line"></i>
                          </router-link>
                          <router-link :to="`/ikas?slug=${item.slug}&source=list`" class="btn btn-sm btn-icon btn-wave btn-warning-light stakeholders-action-btn" title="Open IKAS">
                            <i class="ri-file-chart-line"></i>
                          </router-link>
                          <button v-if="isAdmin" @click="openEditModal(item)" class="btn btn-sm btn-icon btn-wave btn-success-light stakeholders-action-btn" title="Edit">
                            <i class="ri-edit-2-line"></i>
                          </button>
                          <button v-if="isAdmin" @click="openDeleteModal(item)" class="btn btn-sm btn-icon btn-wave btn-danger-light stakeholders-action-btn" title="Delete">
                            <i class="ri-delete-bin-3-line"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="isExpanded(item.slug)" class="stakeholder-detail-row">
                      <td colspan="7">
                        <div class="stakeholder-detail-panel">
                          <div class="stakeholder-detail-item">
                            <span class="stakeholder-detail-label">Alamat</span>
                            <span class="stakeholder-detail-value">{{ item.alamat || '-' }}</span>
                          </div>
                          <div class="stakeholder-detail-item">
                            <span class="stakeholder-detail-label">Telepon</span>
                            <span class="stakeholder-detail-value">{{ item.telepon || '-' }}</span>
                          </div>
                          <div class="stakeholder-detail-item">
                            <span class="stakeholder-detail-label">Website</span>
                            <a :href="item.website" target="_blank" rel="noopener noreferrer" class="stakeholder-detail-link">{{ item.website || '-' }}</a>
                          </div>
                          <div class="stakeholder-detail-item">
                            <span class="stakeholder-detail-label">Monitoring</span>
                            <div class="stakeholder-detail-status">
                              <span class="status-badge" :class="hasIkas(item.slug) ? 'badge-done' : 'badge-pending'">IKAS</span>
                              <span class="status-badge" :class="hasCompleteCsirt(item.id) ? 'badge-done' : 'badge-pending'">CSIRT</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>

            <div v-else class="stakeholders-grid">
              <div v-if="!displayData.length" class="stakeholders-grid-empty">
                <div class="empty-state">
                  <div class="empty-icon-ring mb-3">
                    <div class="empty-icon-inner">
                      <i class="ri-layout-grid-line"></i>
                    </div>
                  </div>
                  <h6 class="fw-semibold mb-1 empty-state-title">Grid view is empty</h6>
                  <p class="text-muted fs-13 mb-0">Belum ada data yang cocok dengan filter aktif.</p>
                </div>
              </div>
              <div v-for="item in displayData" :key="`${item.slug}-card`" class="stakeholders-grid-card">
                <div class="stakeholders-grid-card-top">
                  <div class="d-flex align-items-center gap-3">
                    <div class="company-avatar" :class="getAvatarClass(item.nama_perusahaan.charAt(0).toUpperCase())">
                      <img v-if="item.photo" :src="item.photo" :alt="item.nama_perusahaan" class="company-avatar-img" />
                      <span v-else class="company-avatar-letter">{{ item.nama_perusahaan.charAt(0).toUpperCase() }}</span>
                    </div>
                    <div>
                      <div class="company-name">{{ item.nama_perusahaan }}</div>
                      <div class="company-address">{{ item.email }}</div>
                    </div>
                  </div>
                  <div class="d-flex gap-1">
                    <router-link :to="`/stakeholders/${item.slug}`" class="btn btn-sm btn-icon btn-wave btn-info-light stakeholders-action-btn" title="View">
                      <i class="ri-eye-line"></i>
                    </router-link>
                    <router-link :to="`/ikas?slug=${item.slug}&source=list`" class="btn btn-sm btn-icon btn-wave btn-warning-light stakeholders-action-btn" title="Open IKAS">
                      <i class="ri-file-chart-line"></i>
                    </router-link>
                    <button v-if="isAdmin" @click="openEditModal(item)" class="btn btn-sm btn-icon btn-wave btn-success-light stakeholders-action-btn" title="Edit">
                      <i class="ri-edit-2-line"></i>
                    </button>
                    <button v-if="isAdmin" @click="openDeleteModal(item)" class="btn btn-sm btn-icon btn-wave btn-danger-light stakeholders-action-btn" title="Delete">
                      <i class="ri-delete-bin-3-line"></i>
                    </button>
                  </div>
                </div>
                <div class="stakeholders-grid-card-body">
                  <div class="stakeholders-grid-sector">
                    <span class="stakeholders-sector-parent">{{ getSektorFromSubSektor(getItemSubSektorName(item)) }}</span>
                    <span class="badge-sektor" :style="getSektorBadgeStyle(getItemSubSektorName(item))">{{ getItemSubSektorName(item) }}</span>
                  </div>
                  <div class="status-indicators justify-content-start">
                    <div class="status-badge" :class="hasIkas(item.slug) ? 'badge-done' : 'badge-pending'">IKAS</div>
                    <div class="status-badge" :class="hasCompleteCsirt(item.id) ? 'badge-done' : 'badge-pending'">CSIRT</div>
                  </div>
                  <div class="stakeholders-grid-meta">
                    <div><i class="ri-phone-line"></i>{{ item.telepon || '-' }}</div>
                    <a :href="item.website" target="_blank" rel="noopener noreferrer"><i class="ri-global-line"></i>Website</a>
                  </div>
                </div>
              </div>
            </div>

            <div class="pagination-container stakeholders-pagination">
              <div class="stakeholders-pagination-copy">
                Showing {{ visibleStart }}-{{ visibleEnd }} of {{ filteredData.length }} stakeholders
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

                <!-- ? SUB SEKTOR (semua sub sektor, sektor induk otomatis) -->
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
          <div class="card-footer bg-light d-flex flex-wrap justify-content-end gap-2">
            <button type="button" class="btn btn-outline-danger flex-fill flex-sm-grow-0" @click="showCreateModal = false">
              <i class="ri-close-line me-1"></i>Batal
            </button>
            <button type="button" class="btn btn-secondary flex-fill flex-sm-grow-0" @click="createStakeholder">
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

                <!-- ? SUB SEKTOR (semua sub sektor, sektor induk otomatis) -->
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
          <div class="card-footer bg-light d-flex flex-wrap justify-content-end gap-2">
            <button type="button" @click="showEditModal = false" class="btn btn-outline-danger flex-fill flex-sm-grow-0">
              <i class="ri-arrow-left-line me-1"></i>Batal
            </button>
            <button type="button" @click="updateStakeholder" class="btn btn-secondary flex-fill flex-sm-grow-0">
              <i class="ri-save-line me-1"></i><span class="d-none d-sm-inline"> Simpan Perubahan</span><span class="d-inline d-sm-none"> Simpan</span>
            </button>
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


<style>
/* Global style untuk modal - tidak scoped agar bisa override */

@media (max-width: 575.98px) {
  .custom-modal {
    margin: 10px auto;
    width: calc(100% - 20px) !important;
  }
  
  /* Prevent flex-centering cutoff bug for very tall modals on short screens */
  .modal.fade.show.d-block .modal-dialog-centered {
    align-items: flex-start !important;
    min-height: calc(100% - 20px);
  }

  /* Make sure flex children can shrink */
  .form-group-split-input-card {
    min-width: 0;
    overflow: hidden;
    padding: 8px 12px !important; /* Compact padding for mobile */
  }
  
  /* Compact label cards */
  .form-group-split-label-card {
    padding: 6px 12px !important;
    gap: 8px !important;
  }
  
  /* Shrink icons */
  .form-group-split-label-card .form-item-icon {
    width: 24px !important;
    height: 24px !important;
  }
  .form-group-split-label-card .form-item-icon i {
    font-size: 0.8rem !important;
  }
  
  /* Shrink text */
  .form-item-label { font-size: 11.5px !important; }
  .form-item-input { 
    font-size: 13px !important; 
    padding: 2px 0 !important;
    max-width: 100%;
    text-overflow: ellipsis;
  }
  
  /* Compact Photo preview */
  .photo-preview-modal {
    width: 60px !important;
    height: 60px !important;
  }
  .photo-preview-modal i.ri-image-add-line {
    font-size: 1.5rem !important;
  }
  
  /* Form group spacing reductions */
  .modal-dialog .card-body.p-4 { padding: 12px !important; }
  .modal-dialog .card-header   { padding: 12px !important; }
  
  /* Text break for long modal headers */
  .header-card-title, .header-subtitle {
    white-space: normal !important;
    word-break: break-word;
    line-height: 1.4;
  }
}

@media (min-width: 992px) {
  .modal.fade.show.d-block .modal-dialog {
    margin-left: calc(250px + ((100% - 250px - 1000px) / 2)) !important;
    margin-right: auto !important;
  }
}
</style>
