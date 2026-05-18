<script lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from "vue";
import gsap from "gsap";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";

import { useCsirtStore } from "../../stores/csirt";
import { csirtService } from "../../services/csirt.service";
import { stakeholdersService } from "../../services/stakeholders.service";
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
  components: { Pageheader, EasyDataTable },
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
    const csirtPageRef = ref<HTMLElement | null>(null);
    const stakeholderOptions = ref<Array<{ id: string | number; nama_perusahaan: string; sub_sektor?: any }>>([]);
    let gsapCtx: gsap.Context | null = null;
    let hasRunInitialEntrance = false;

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
      { text: "Telepon", value: "telepon_csirt", sortable: true },
      { text: "Email", value: "email_csirt", sortable: true },
      { text: "Aksi", value: "id" },
    ];

    const loadStakeholderOptions = async () => {
      try {
        const options = await stakeholdersService.getDropdown();
        stakeholderOptions.value = Array.isArray(options) ? options : [];
      } catch (error) {
        console.warn("Gagal memuat daftar stakeholder ringan:", error);
        stakeholderOptions.value = [];
      }
    };

    const loadCsirtMembers = async () => {
      await Promise.all([
        csirtStore.initialize({ fetchGlobal: true }),
        loadStakeholderOptions(),
      ]);
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

    const normalizeRecordId = (value: unknown) => String(value ?? "").trim();

    const hasUsableId = (value: unknown) => {
      const id = normalizeRecordId(value);
      return !!id && id !== "undefined" && id !== "null";
    };

    const getCsirtCompanyId = (item: any) => normalizeRecordId(
      item?.id_perusahaan ||
      item?.perusahaan_id ||
      item?.company_id ||
      item?.perusahaan?.id
    );

    const recordBelongsToCsirt = (record: any, csirtId: string) => (
      normalizeRecordId(record?.id_csirt) === csirtId ||
      normalizeRecordId(record?.csirt_id) === csirtId ||
      normalizeRecordId(record?.csirt?.id) === csirtId
    );

    const recordBelongsToCompany = (record: any, companyId: string) => (
      hasUsableId(companyId) && (
        normalizeRecordId(record?.id_perusahaan) === companyId ||
        normalizeRecordId(record?.perusahaan_id) === companyId ||
        normalizeRecordId(record?.company_id) === companyId ||
        normalizeRecordId(record?.perusahaan?.id) === companyId
      )
    );

    const uniqueRecords = <T extends Record<string, any>>(records: T[], fallbackPrefix: string) => {
      const seen = new Set<string>();
      return records.filter((record, index) => {
        const key = normalizeRecordId(record?.id) ||
          normalizeRecordId(record?.uuid) ||
          `${fallbackPrefix}-${normalizeRecordId(record?.nama_personel || record?.nama_se || record?.nama || index)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const getNestedSdmRecords = (item: any): any[] => [
      ...(Array.isArray(item?.sdm_csirt) ? item.sdm_csirt : []),
      ...(Array.isArray(item?.sdms) ? item.sdms : []),
      ...(Array.isArray(item?.sdm) ? item.sdm : []),
    ];

    const getNestedSeRecords = (item: any): any[] => [
      ...(Array.isArray(item?.se_csirt) ? item.se_csirt : []),
      ...(Array.isArray(item?.ses) ? item.ses : []),
      ...(Array.isArray(item?.se) ? item.se : []),
      ...(Array.isArray(item?.sistem_elektronik) ? item.sistem_elektronik : []),
    ];

    const getSdmForCsirt = (item: CsirtMember) => {
      const csirtId = normalizeRecordId(item.id);
      const nested = getNestedSdmRecords(item);
      const fromStore = csirtStore.sdmList.filter((record: any) => recordBelongsToCsirt(record, csirtId));
      return uniqueRecords([...nested, ...fromStore], `sdm-${csirtId}`);
    };

    const getSeForCsirt = (item: CsirtMember) => {
      const csirtId = normalizeRecordId(item.id);
      const companyId = getCsirtCompanyId(item);
      const nested = getNestedSeRecords(item);
      const fromStore = csirtStore.seList.filter((record: any) => (
        recordBelongsToCsirt(record, csirtId) || recordBelongsToCompany(record, companyId)
      ));
      return uniqueRecords([...nested, ...fromStore], `se-${csirtId || companyId}`);
    };

    const isSeIncomplete = (item: any) => {
      const category = String(item?.kategori_se || item?.kategori || item?.status_kategori || "")
        .trim()
        .toLowerCase();
      return !category || ["-", "n/a", "draft", "belum lengkap", "belum dikategorikan"].includes(category);
    };

    const totalSdmCount = computed(() => {
      const linked = csirtStore.csirts.flatMap((item) => getSdmForCsirt(item));
      return uniqueRecords([...csirtStore.sdmList, ...linked], "sdm-total").length;
    });

    const totalSeCount = computed(() => {
      const linked = csirtStore.csirts.flatMap((item) => getSeForCsirt(item));
      return uniqueRecords([...csirtStore.seList, ...linked], "se-total").length;
    });

    const stakeholderOptionMap = computed(() => {
      const map = new Map<string, { id: string | number; nama_perusahaan: string; sub_sektor?: any }>();
      stakeholderOptions.value.forEach((item) => {
        map.set(normalizeRecordId(item.id), item);
      });
      return map;
    });

    const totalStakeholderCount = computed(() => stakeholderOptions.value.length);

    const completeCSIRTCount = computed(() => {
      return filteredData.value.filter((item) => {
        const sdm = getSdmForCsirt(item);
        const se = getSeForCsirt(item);
        return sdm.length > 0 && se.length > 0 && se.every((record) => !isSeIncomplete(record));
      }).length;
    });

    const incompleteCsirtCount = computed(() => Math.max(filteredData.value.length - completeCSIRTCount.value, 0));
    const csirtReadinessCoverage = computed(() => {
      const total = filteredData.value.length;
      if (!total) return 0;
      return Math.round((completeCSIRTCount.value / total) * 100);
    });

    const getStakeholderForItem = (item: CsirtMember) => (
      item.perusahaan || stakeholderOptionMap.value.get(getCsirtCompanyId(item))
    );

    const getStatusSummary = (item: CsirtMember) => {
      const status = csirtStatus(String(item.id));
      const isReady = status.sdmCount > 0 && status.seCount > 0 && status.seIncomplete === 0;
      const isProgress = !isReady && (status.sdmCount > 0 || status.seCount > 0);

      if (isReady) {
        return {
          tone: "ready",
          label: "CSIRT lengkap",
          hint: "Data SDM dan SE sudah lengkap",
          icon: "ri-checkbox-circle-line",
        };
      }

      if (isProgress) {
        return {
          tone: "progress",
          label: "Perlu dilengkapi",
          hint: status.seIncomplete > 0 ? "Masih ada SE yang belum lengkap" : "Masih ada data inti yang belum diisi",
          icon: "ri-time-line",
        };
      }

      return {
        tone: "empty",
        label: "Perlu mulai dilengkapi",
        hint: "Belum ada SDM atau SE yang terhubung",
        icon: "ri-alert-line",
      };
    };

    const prefersReducedMotion = () => (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );

    const getMotionItems = () => {
      const root = csirtPageRef.value;
      if (!root) return [];
      return Array.from(root.querySelectorAll<HTMLElement>(".csirt-table-row, .csirt-mobile-card"));
    };

    const animateListItems = (quick = false) => {
      const items = getMotionItems();
      if (!items.length) return;

      gsap.killTweensOf(items);

      if (prefersReducedMotion()) {
        gsap.set(items, { clearProps: "all", opacity: 1, y: 0, scale: 1 });
        return;
      }

      gsap.set(items, {
        y: quick ? 14 : 20,
        opacity: 0,
        scale: quick ? 0.992 : 0.985,
        force3D: true,
      });

      gsap.to(items, {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: quick ? 0.32 : 0.42,
        stagger: quick ? 0.035 : 0.055,
        ease: "power3.out",
        clearProps: "transform,opacity",
        overwrite: "auto",
      });
    };

    const runEntranceAnimations = () => {
      const root = csirtPageRef.value;
      if (!root) return;

      if (prefersReducedMotion()) {
        animateListItems(true);
        return;
      }

      gsapCtx?.revert();
      gsapCtx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.from(".csirt-hero-shell", {
          y: 18,
          opacity: 0,
          duration: 0.48,
          clearProps: "transform,opacity",
        })
          .from(".csirt-inline-breadcrumb", {
            y: -8,
            opacity: 0,
            duration: 0.28,
            clearProps: "transform,opacity",
          }, "-=0.28")
          .from(".csirt-hero-copy > *", {
            y: 16,
            opacity: 0,
            duration: 0.34,
            stagger: 0.06,
            clearProps: "transform,opacity",
          }, "-=0.2")
          .from(".csirt-kpi-card", {
            y: 18,
            opacity: 0,
            scale: 0.96,
            duration: 0.38,
            stagger: 0.05,
            ease: "back.out(1.35)",
            clearProps: "transform,opacity",
          }, "-=0.08")
          .from(".csirt-filter-shell", {
            y: 20,
            opacity: 0,
            duration: 0.36,
            clearProps: "transform,opacity",
          }, "-=0.14")
          .from(".csirt-list-shell", {
            y: 24,
            opacity: 0,
            duration: 0.42,
            clearProps: "transform,opacity",
          }, "-=0.12");
      }, root);

      animateListItems(true);
    };

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

    onMounted(async () => {
      await loadCsirtMembers();
    });

    watch(loading, (isLoading) => {
      if (!isLoading) {
        nextTick(() => {
          if (!hasRunInitialEntrance) {
            hasRunInitialEntrance = true;
            runEntranceAnimations();
            return;
          }
          animateListItems();
        });
      }
    });

    watch([displayData, currentPage, itemsPerPage], () => {
      if (!loading.value) {
        nextTick(() => animateListItems(true));
      }
    });

    onUnmounted(() => {
      gsapCtx?.revert();
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
      const id = normalizeRecordId(csirtId);
      const csirtObj = csirtStore.csirts.find(c => normalizeRecordId(c.id) === id);
      if (!csirtObj) return { sdmCount: 0, seCount: 0, seIncomplete: 0 };

      const sdmCount = getSdmForCsirt(csirtObj).length;
      const seAll = getSeForCsirt(csirtObj);
      const seCount = seAll.length;
      const seIncomplete = seAll.filter(isSeIncomplete).length;
      return { sdmCount, seCount, seIncomplete };
    };

    // Filter stakeholders to show only those without CSIRT in create modal
    const availableStakeholders = computed(() => {
      return stakeholderOptions.value.filter(stakeholder => {
        const hasExistingCsirt = csirtStore.csirts.some(c =>
          getCsirtCompanyId(c) === normalizeRecordId(stakeholder.id)
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
        s.sub_sektor?.nama_sub_sektor?.toLowerCase().includes(query)
      );
    });

    return {
      isAdmin,
      csirtStore,
      loading,
      searchQuery,
      availableStakeholders,
      stakeholderOptions,
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
      incompleteCsirtCount,
      csirtReadinessCoverage,
      totalSdmCount,
      totalSeCount,
      totalStakeholderCount,
      csirtPageRef,
      getStakeholderForItem,
      getStatusSummary,
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
        const p = getStakeholderForItem(item);
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

  <section ref="csirtPageRef" class="csirt-page">
  <div class="row">
    <div class="col-xl-12">
      <div class="csirt-page-shell">
        <header class="csirt-hero-shell">
          <div class="csirt-hero-header">
            <div class="csirt-hero-copy">
              <div class="csirt-inline-breadcrumb">Dashboards <span>/</span> CSIRT</div>
              <h1>Daftar CSIRT</h1>
              <p>Kelola data CSIRT, SDM CSIRT, dan sistem elektronik untuk kelengkapan data.</p>
            </div>

            <div class="csirt-hero-tools">
              <div class="csirt-hero-summary-card">
                <div class="csirt-hero-card-title">
                  <span>Kesiapan CSIRT</span>
                  <strong>{{ csirtReadinessCoverage }}%</strong>
                </div>
                <div class="csirt-hero-card-stats">
                  <div>
                    <span>Siap</span>
                    <strong>{{ completeCSIRTCount }}</strong>
                  </div>
                  <div>
                    <span>Perlu Tindak</span>
                    <strong>{{ incompleteCsirtCount }}</strong>
                  </div>
                  <div>
                    <span>SDM / SE</span>
                    <strong>{{ totalSdmCount }} / {{ totalSeCount }}</strong>
                  </div>
                </div>
                <div class="csirt-hero-progress" aria-hidden="true">
                  <span :style="{ width: `${csirtReadinessCoverage}%` }"></span>
                </div>
                <div class="csirt-hero-note">
                  <i class="ri-information-line"></i>
                  <span>{{ filteredData.length }} CSIRT dari {{ totalStakeholderCount }} stakeholder{{ searchQuery ? " sesuai pencarian" : "" }}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section class="csirt-kpi-grid" aria-label="Ringkasan CSIRT">
          <article class="csirt-kpi-card tone-blue">
            <div class="csirt-kpi-icon">
              <i class="ri-shield-user-line"></i>
            </div>
            <div class="csirt-kpi-body">
              <span class="csirt-kpi-label">Total CSIRT</span>
              <strong class="csirt-kpi-value">{{ filteredData.length }}</strong>
              <small class="csirt-kpi-hint">Dari total {{ totalStakeholderCount }} stakeholder</small>
            </div>
          </article>
          <article class="csirt-kpi-card tone-green">
            <div class="csirt-kpi-icon">
              <i class="ri-checkbox-circle-line"></i>
            </div>
            <div class="csirt-kpi-body">
              <span class="csirt-kpi-label">CSIRT Lengkap</span>
              <strong class="csirt-kpi-value">{{ completeCSIRTCount }}</strong>
              <small class="csirt-kpi-hint">SDM dan SE sudah lengkap</small>
            </div>
          </article>
          <article class="csirt-kpi-card tone-amber">
            <div class="csirt-kpi-icon">
              <i class="ri-time-line"></i>
            </div>
            <div class="csirt-kpi-body">
              <span class="csirt-kpi-label">Perlu Ditindaklanjuti</span>
              <strong class="csirt-kpi-value">{{ incompleteCsirtCount }}</strong>
              <small class="csirt-kpi-hint">Masih butuh kelengkapan data</small>
            </div>
          </article>
          <article class="csirt-kpi-card tone-cyan">
            <div class="csirt-kpi-icon">
              <i class="ri-team-line"></i>
            </div>
            <div class="csirt-kpi-body">
              <span class="csirt-kpi-label">SDM CSIRT</span>
              <strong class="csirt-kpi-value">{{ totalSdmCount }}</strong>
              <small class="csirt-kpi-hint">Total personel yang terhubung</small>
            </div>
          </article>
          <article class="csirt-kpi-card tone-indigo">
            <div class="csirt-kpi-icon">
              <i class="ri-server-line"></i>
            </div>
            <div class="csirt-kpi-body">
              <span class="csirt-kpi-label">SE CSIRT</span>
              <strong class="csirt-kpi-value">{{ totalSeCount }}</strong>
              <small class="csirt-kpi-hint">Total sistem elektronik yang terhubung</small>
            </div>
          </article>
        </section>

        <div class="card-body p-0 stakeholders-premium-body csirt-content">
          <div class="stakeholders-filter-bar csirt-filter-shell mb-3">
            <div class="csirt-toolbar-row">
              <div class="stakeholders-per-page csirt-rows-control">
                <i class="ri-list-check-2"></i>
                <span>Baris</span>
                <select v-model="itemsPerPage" class="form-select form-select-sm entries-select">
                  <option v-for="n in [5, 10, 15, 20, 25, 50]" :key="n" :value="n">{{ n }}</option>
                </select>
              </div>
              <div class="csirt-toolbar-search">
                <label class="csirt-search-field">
                  <i class="ri-search-line header-search-icon"></i>
                  <input v-model="searchQuery" type="text" class="form-control form-control-sm header-search-input" placeholder="Cari nama CSIRT, website, telepon, atau email..." />
                  <button v-if="searchQuery" @click="clearSearch" class="clear-btn csirt-search-clear" title="Reset pencarian">
                    <i class="ri-close-circle-fill"></i>
                  </button>
                </label>
              </div>
              <div class="csirt-filter-actions">
                <button
                  @click="exportAllCsirtPdf"
                  class="btn btn-danger d-flex align-items-center gap-2 csirt-btn csirt-btn-danger"
                >
                  <i class="ri-file-pdf-line fs-13"></i>
                  <span class="btn-text">Rekap CSIRT</span>
                </button>
                <button v-if="isAdmin"
                  @click="openCreateModal"
                  class="btn stakeholders-add-btn btn-primary d-flex align-items-center gap-2 csirt-btn csirt-btn-primary"
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
            <div class="table-responsive stakeholder-table-wrap stakeholders-table-shell csirt-list-shell d-none d-lg-block">
              <table class="table stakeholder-table csirt-data-table mb-0">
                <thead class="stakeholder-thead">
                  <tr>
                    <th class="th-no">No</th>
                    <th class="sortable fw-semibold" @click="toggleSort('nama_csirt')">
                      <div class="d-flex align-items-center gap-2">
                        <span>Nama CSIRT</span>
                        <i :class="sortField === 'nama_csirt' ? (sortOrder === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line') : 'ri-expand-up-down-line'" class="fs-14 opacity-50"></i>
                      </div>
                    </th>
                    <th class="fw-semibold">
                      <div class="d-flex align-items-center gap-2">
                        <span>Stakeholder</span>
                      </div>
                    </th>
                    <th class="fw-semibold">
                      <div class="d-flex align-items-center gap-2">
                        <span>Telepon</span>
                      </div>
                    </th>
                    <th class="fw-semibold">
                      <div class="d-flex align-items-center gap-2">
                        <span>Email</span>
                      </div>
                    </th>
                    <th class="fw-semibold" style="white-space:nowrap">
                      <div class="d-flex align-items-center gap-2">
                        <span>Status Ringkas</span>
                      </div>
                    </th>
                    <th class="text-center fw-semibold csirt-th-aksi">Aksi</th>
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
                  <tr v-for="(item, i) in displayData" :key="item.id" class="stakeholder-row csirt-table-row">
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
                          <span class="csirt-inline-meta">Profil tim respons insiden</span>
                        </div>
                      </div>
                    </td>
                    <td class="align-middle">
                      <template v-if="getStakeholderForItem(item)">
                        <div class="d-flex align-items-center gap-2">
                          <div>
                            <span class="company-name d-block">
                              {{ getStakeholderForItem(item)?.nama_perusahaan }}
                            </span>
                            <span class="text-muted fs-12">
                              {{ getStakeholderForItem(item)?.sub_sektor?.nama_sub_sektor || "-" }}
                            </span>
                          </div>
                        </div>
                      </template>
                      <span v-else class="text-muted fs-12">-</span>
                    </td>
                    <td class="align-middle" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                      <span class="text-muted">{{ item.telepon_csirt }}</span>
                    </td>
                    <td class="align-middle" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                      <a :href="`mailto:${item.email_csirt}`" v-if="item.email_csirt" class="text-muted text-decoration-none email-link">
                         {{ item.email_csirt }}
                      </a>
                      <span v-else class="text-muted">-</span>
                    </td>
                    <td class="align-middle csirt-status-cell">
                      <div class="csirt-status-card" :class="`tone-${getStatusSummary(item).tone}`">
                        <div class="csirt-status-main">
                          <span class="csirt-status-dot"></span>
                          <div class="min-w-0">
                            <span class="csirt-status-label">{{ getStatusSummary(item).label }}</span>
                            <span class="csirt-status-hint">{{ getStatusSummary(item).hint }}</span>
                          </div>
                        </div>
                        <div class="csirt-status-metrics">
                          <span
                            class="csirt-status-metric"
                            :class="csirtStatus(item.id).sdmCount > 0 ? 'metric-good' : 'metric-danger'"
                          >
                            <i :class="csirtStatus(item.id).sdmCount > 0 ? 'ri-user-3-line' : 'ri-user-unfollow-line'"></i>
                            {{ csirtStatus(item.id).sdmCount > 0 ? `${csirtStatus(item.id).sdmCount} SDM` : "SDM 0" }}
                          </span>
                          <span
                            class="csirt-status-metric"
                            :class="csirtStatus(item.id).seCount === 0
                              ? 'metric-danger'
                              : csirtStatus(item.id).seIncomplete > 0
                                ? 'metric-warning'
                                : 'metric-good'"
                          >
                            <i :class="csirtStatus(item.id).seCount === 0
                              ? 'ri-server-line'
                              : csirtStatus(item.id).seIncomplete > 0
                                ? 'ri-error-warning-line'
                                : 'ri-server-fill'"></i>
                            <template v-if="csirtStatus(item.id).seCount === 0">SE 0</template>
                            <template v-else-if="csirtStatus(item.id).seIncomplete > 0">
                              SE {{ csirtStatus(item.id).seCount }} / {{ csirtStatus(item.id).seIncomplete }}
                            </template>
                            <template v-else>{{ csirtStatus(item.id).seCount }} SE</template>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td class="text-center align-middle">
                      <div class="csirt-action-group users-action-group">
                        <router-link
                          :to="`/csirt/${toCsirtSlug(item)}`"
                          class="btn btn-sm btn-icon btn-wave btn-info-light stakeholders-action-btn"
                          data-tooltip="Lihat"
                          title="Lihat profil CSIRT"
                          aria-label="Lihat profil CSIRT">
                          <i class="ri-eye-line"></i>
                        </router-link>
                        <button v-if="isAdmin"
                          @click="openEditModal(item)"
                          class="btn btn-sm btn-icon btn-wave btn-success-light stakeholders-action-btn"
                          data-tooltip="Edit"
                          title="Edit CSIRT"
                          aria-label="Edit CSIRT">
                          <i class="ri-pencil-line"></i>
                        </button>
                        <button v-if="isAdmin"
                          @click="openDeleteModal(item)"
                          class="btn btn-sm btn-icon btn-wave btn-danger-light stakeholders-action-btn"
                          data-tooltip="Hapus"
                          title="Hapus CSIRT"
                          aria-label="Hapus CSIRT">
                          <i class="ri-delete-bin-line"></i>
                        </button>
                        <button
                          @click="exportPdf(item)"
                          class="btn btn-sm btn-icon btn-wave btn-secondary-light stakeholders-action-btn"
                          data-tooltip="PDF"
                          title="Export PDF"
                          aria-label="Export PDF">
                          <i class="ri-file-pdf-line"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="d-lg-none csirt-mobile-list">
              <article v-for="(item, i) in displayData" :key="`mobile-${item.id}`" class="csirt-mobile-card">
                <div class="csirt-mobile-top">
                  <div class="d-flex align-items-center gap-3">
                    <div class="company-avatar" :class="getAvatarClass(item.nama_csirt.charAt(0).toUpperCase())">
                      <img v-if="item.photo_csirt" :src="item.photo_csirt" :alt="item.nama_csirt" class="company-avatar-img" />
                      <span v-else class="company-avatar-letter">{{ item.nama_csirt.charAt(0).toUpperCase() }}</span>
                    </div>
                    <div class="min-w-0">
                      <div class="csirt-mobile-index">#{{ (currentPage - 1) * itemsPerPage + i + 1 }}</div>
                      <h3>{{ item.nama_csirt }}</h3>
                      <p>{{ getStakeholderForItem(item)?.nama_perusahaan || "Stakeholder belum terhubung" }}</p>
                    </div>
                  </div>
                  <div class="csirt-readiness-badge" :class="`tone-${getStatusSummary(item).tone}`">
                    <i :class="getStatusSummary(item).icon"></i>
                    <span>{{ getStatusSummary(item).label }}</span>
                  </div>
                </div>

                <div class="csirt-mobile-grid">
                  <div>
                    <span>Telepon</span>
                    <strong>{{ item.telepon_csirt || "-" }}</strong>
                  </div>
                  <div>
                    <span>Email</span>
                    <strong>{{ item.email_csirt || "-" }}</strong>
                  </div>
                  <div>
                    <span>Sektor</span>
                    <strong>{{ getStakeholderForItem(item)?.sub_sektor?.nama_sub_sektor || "-" }}</strong>
                  </div>
                </div>

                <div class="csirt-mobile-status">
                  <span class="badge-sektor" :class="csirtStatus(item.id).sdmCount > 0 ? 'badge-sektor-green' : 'badge-sektor-red'">
                    <i :class="csirtStatus(item.id).sdmCount > 0 ? 'ri-user-3-line me-1' : 'ri-user-unfollow-line me-1'"></i>
                    SDM {{ csirtStatus(item.id).sdmCount > 0 ? `${csirtStatus(item.id).sdmCount} personel` : "belum ada" }}
                  </span>
                  <span class="badge-sektor" :class="csirtStatus(item.id).seCount === 0 ? 'badge-sektor-red' : csirtStatus(item.id).seIncomplete > 0 ? 'badge-sektor-amber' : 'badge-sektor-green'">
                    <i :class="csirtStatus(item.id).seCount === 0 ? 'ri-server-line me-1' : csirtStatus(item.id).seIncomplete > 0 ? 'ri-error-warning-line me-1' : 'ri-server-fill me-1'"></i>
                    <template v-if="csirtStatus(item.id).seCount === 0">SE belum ada</template>
                    <template v-else-if="csirtStatus(item.id).seIncomplete > 0">SE {{ csirtStatus(item.id).seCount }} / {{ csirtStatus(item.id).seIncomplete }} belum lengkap</template>
                    <template v-else>SE {{ csirtStatus(item.id).seCount }} lengkap</template>
                  </span>
                </div>

                <div class="csirt-mobile-actions">
                  <router-link :to="`/csirt/${toCsirtSlug(item)}`" class="btn btn-sm btn-info-light">
                    <i class="ri-eye-line"></i><span>Lihat</span>
                  </router-link>
                  <button v-if="isAdmin" @click="openEditModal(item)" class="btn btn-sm btn-success-light">
                    <i class="ri-edit-2-line"></i><span>Edit</span>
                  </button>
                  <button v-if="isAdmin" @click="openDeleteModal(item)" class="btn btn-sm btn-danger-light">
                    <i class="ri-delete-bin-3-line"></i><span>Hapus</span>
                  </button>
                  <button @click="exportPdf(item)" class="btn btn-sm btn-secondary-light">
                    <i class="ri-file-pdf-line"></i><span>PDF</span>
                  </button>
                </div>
              </article>
            </div>

            <!-- Pagination -->
            <div class="pagination-container stakeholders-pagination csirt-table-pagination">
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
  </section>

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
                      placeholder="Cari nama perusahaan..." 
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
                  <div v-if="availableStakeholders.length < totalStakeholderCount" class="form-text text-muted fs-12 mt-1">
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
                    <span class="input-group-text">+62</span>
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
                    <option v-for="s in stakeholderOptions" :key="s.id" :value="s.id">{{ s.nama_perusahaan }}</option>
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
                    <span class="input-group-text">+62</span>
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
  <div
    v-if="showDeleteModal"
    class="modal fade show d-flex align-items-center justify-content-center"
    tabindex="-1"
    style="display: flex !important; background: rgba(15, 23, 42, 0.75); position: fixed; inset: 0; z-index: 9999;"
    @click.self="showDeleteModal = false"
  >
    <div class="modal-dialog modal-dialog-centered" style="max-width: 450px; width: 100%; margin: 16px;">
      <div class="modal-content border-0 shadow-lg bg-white" style="border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;">
        <div class="modal-header border-0 pb-0 pt-4 px-4 d-flex justify-content-between align-items-center">
          <h5 class="modal-title fw-bold text-dark">Konfirmasi Hapus</h5>
          <button
            type="button"
            class="btn-close"
            @click="showDeleteModal = false"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body py-4 px-4 text-center">
          <div class="mb-4">
            <div class="d-inline-flex align-items-center justify-content-center bg-light-danger rounded-circle mb-3" style="width: 80px; height: 80px; background-color: #fff1f2;">
              <i class="ri-error-warning-line text-danger" style="font-size: 3rem;"></i>
            </div>
            <h4 class="fw-bold text-dark mb-2">Apakah Anda yakin?</h4>
            <p class="text-muted mb-0 px-3">
              Anda akan menghapus CSIRT 
              <span class="text-dark fw-semibold">{{ currentDeleteItem?.nama_csirt }}</span>. 
              Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
        </div>
        <div class="modal-footer border-0 pt-0 pb-4 px-4 d-flex gap-2">
          <button
            type="button"
            class="btn btn-light flex-grow-1 fw-semibold py-2"
            style="border-radius: 10px; background-color: #f1f5f9; border: none; color: #64748b;"
            @click="showDeleteModal = false"
          >
            Batal
          </button>
          <button
            type="button"
            class="btn btn-danger flex-grow-1 fw-semibold py-2"
            style="border-radius: 10px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border: none;"
            @click="deleteCsirt"
          >
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

.csirt-page {
  --csirt-bg: linear-gradient(135deg, #0f1f53 0%, #1d4ed8 58%, #60a5fa 100%);
  --csirt-panel: #ffffff;
  --csirt-panel-soft: #f8fbff;
  --csirt-border: #dbe7f5;
  --csirt-text: #0f172a;
  --csirt-muted: #64748b;
}

.csirt-page-shell {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.csirt-hero-shell {
  padding: 1.45rem 1.55rem;
  background: var(--csirt-bg);
  color: #fff;
  border-radius: 24px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
}

.csirt-hero-header {
  align-items: flex-start;
  display: flex;
  gap: 1.25rem;
  justify-content: space-between;
}

.csirt-inline-breadcrumb {
  display: inline-flex;
  gap: 0.45rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.78);
  margin-bottom: 0.85rem;
}

.csirt-hero-copy h1 {
  color: #fff;
  font-size: clamp(1.9rem, 3vw, 2.4rem);
  line-height: 1.1;
  margin: 0;
}

.csirt-hero-copy p {
  color: rgba(255, 255, 255, 0.84);
  max-width: 700px;
  font-size: 0.97rem;
  line-height: 1.6;
  margin: 0.7rem 0 0;
}

.csirt-kpi-grid {
  display: grid;
  gap: 0.95rem;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.csirt-kpi-card {
  align-items: flex-start;
  background: var(--csirt-panel);
  border: 1px solid var(--csirt-border);
  border-radius: 18px;
  box-shadow: 0 14px 38px rgba(15, 23, 42, 0.06);
  display: flex;
  gap: 12px;
  overflow: hidden;
  padding: 16px;
  position: relative;
}

.csirt-kpi-card::before {
  background: var(--accent, #2563eb);
  content: "";
  height: 4px;
  inset: 0 0 auto;
  position: absolute;
}

.csirt-kpi-icon {
  align-items: center;
  background: color-mix(in srgb, var(--accent) 12%, #ffffff);
  border-radius: 14px;
  color: var(--accent);
  display: flex;
  flex: 0 0 40px;
  font-size: 19px;
  height: 40px;
  justify-content: center;
}

.csirt-kpi-body {
  min-width: 0;
}

.csirt-kpi-label {
  color: var(--csirt-muted);
  display: block;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
  text-transform: uppercase;
}

.csirt-kpi-value {
  color: var(--csirt-text);
  display: block;
  font-size: 22px;
  font-weight: 850;
  line-height: 1.1;
  margin-top: 4px;
}

.csirt-kpi-hint {
  color: var(--csirt-muted);
  display: block;
  font-size: 11.5px;
  line-height: 1.35;
  margin-top: 6px;
}

.csirt-kpi-card.tone-blue {
  --accent: #2563eb;
}

.csirt-kpi-card.tone-green {
  --accent: #16a34a;
}

.csirt-kpi-card.tone-amber {
  --accent: #f59e0b;
}

.csirt-kpi-card.tone-cyan {
  --accent: #0891b2;
}

.csirt-kpi-card.tone-indigo {
  --accent: #4f46e5;
}

.csirt-hero-tools {
  display: flex;
  justify-content: flex-end;
  min-width: 320px;
}

.csirt-hero-summary-card {
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  gap: 0.72rem;
  min-width: 290px;
  padding: 0.9rem;
  width: min(100%, 390px);
}

.csirt-search-field {
  display: block;
  position: relative;
}

.csirt-search-field .header-search-input {
  background: #ffffff !important;
  border: 1px solid rgba(255, 255, 255, 0.22) !important;
  box-shadow: none !important;
  height: 38px !important;
}

.csirt-hero-card-title {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.csirt-hero-card-title span,
.csirt-hero-card-stats span {
  color: rgba(255, 255, 255, 0.72);
  display: block;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
}

.csirt-hero-card-title strong {
  color: #fff;
  font-size: 1.55rem;
  font-weight: 850;
  line-height: 1;
}

.csirt-hero-card-stats {
  display: grid;
  gap: 0.7rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.csirt-hero-card-stats strong {
  color: #fff;
  display: block;
  font-size: 1.25rem;
  font-weight: 850;
  line-height: 1.1;
  margin-top: 0.2rem;
}

.csirt-hero-progress {
  background: rgba(15, 23, 42, 0.28);
  border-radius: 999px;
  height: 5px;
  overflow: hidden;
}

.csirt-hero-progress span {
  background: linear-gradient(90deg, #86efac 0%, #22d3ee 100%);
  border-radius: inherit;
  display: block;
  height: 100%;
}

.csirt-hero-note {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.85rem;
}

.csirt-content {
  padding: 0;
}

.csirt-filter-shell,
.csirt-list-shell {
  border-radius: 22px;
  border: 1px solid var(--csirt-border);
  background: var(--csirt-panel);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
}

.csirt-filter-shell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem !important;
}

.csirt-toolbar-row {
  align-items: center;
  display: flex;
  gap: 0.85rem;
  justify-content: space-between;
  width: 100%;
}

.csirt-rows-control {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 42px;
  min-width: 150px;
  padding: 0.45rem 0.7rem !important;
  background: #f8fafc !important;
  border: 1px solid #dbe7f5 !important;
  border-radius: 10px !important;
}

.csirt-rows-control::before {
  display: none !important;
}

.csirt-rows-control i {
  align-items: center;
  background: #dbeafe;
  border-radius: 8px;
  color: #2563eb;
  display: flex;
  flex: 0 0 28px;
  font-size: 15px;
  height: 28px;
  justify-content: center;
  width: 28px;
}

.csirt-rows-control span {
  color: var(--csirt-text) !important;
  font-size: 0.72rem !important;
  font-weight: 800;
  text-transform: uppercase;
}

.csirt-rows-control .entries-select {
  border: 0 !important;
  background: transparent !important;
  color: var(--csirt-text) !important;
  font-weight: 800 !important;
  height: 26px !important;
  min-width: 58px;
  padding: 0 1.45rem 0 0.2rem !important;
}

.csirt-toolbar-search {
  flex: 1 1 720px;
  max-width: 820px;
  min-width: 260px;
}

.csirt-toolbar-search .csirt-search-field .header-search-input {
  background: #ffffff !important;
  border: 1px solid #dbe7f5 !important;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04) !important;
  height: 42px !important;
}

.csirt-toolbar-search .header-search-icon {
  color: #64748b;
}

.csirt-filter-actions {
  align-items: center;
  display: flex;
  gap: 0.55rem;
  justify-content: flex-end;
  flex: 0 0 auto;
}

.csirt-btn {
  min-height: 40px;
  padding: 0.55rem 0.95rem !important;
  border-radius: 10px !important;
  font-weight: 700 !important;
  line-height: 1;
  white-space: nowrap;
}

.csirt-btn-danger {
  background: #fff5f5 !important;
  border: 1px solid #f7d7d7 !important;
  color: #b94a4a !important;
  box-shadow: 0 8px 18px rgba(185, 74, 74, 0.08);
}

.csirt-btn-primary {
  background: #f3f7ff !important;
  border: 1px solid #dbe7ff !important;
  color: #315bc7 !important;
  box-shadow: 0 8px 18px rgba(49, 91, 199, 0.08) !important;
}

.csirt-btn-danger:hover,
.csirt-btn-danger:focus-visible {
  background: #ffecec !important;
  border-color: #f1c4c4 !important;
  color: #9f3f3f !important;
}

.csirt-btn-primary:hover,
.csirt-btn-primary:focus-visible {
  background: #eaf1ff !important;
  border-color: #c8d8ff !important;
  color: #284faf !important;
}

[data-theme-mode='dark'] .csirt-btn {
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.22) !important;
}

[data-theme-mode='dark'] .csirt-btn-danger {
  background: rgba(248, 113, 113, 0.16) !important;
  border-color: rgba(248, 113, 113, 0.42) !important;
  color: #fecaca !important;
}

[data-theme-mode='dark'] .csirt-btn-primary {
  background: rgba(96, 165, 250, 0.16) !important;
  border-color: rgba(96, 165, 250, 0.44) !important;
  color: #bfdbfe !important;
}

[data-theme-mode='dark'] .csirt-btn-danger:hover,
[data-theme-mode='dark'] .csirt-btn-danger:focus-visible {
  background: rgba(248, 113, 113, 0.24) !important;
  border-color: rgba(252, 165, 165, 0.62) !important;
  color: #fee2e2 !important;
}

[data-theme-mode='dark'] .csirt-btn-primary:hover,
[data-theme-mode='dark'] .csirt-btn-primary:focus-visible {
  background: rgba(96, 165, 250, 0.24) !important;
  border-color: rgba(147, 197, 253, 0.64) !important;
  color: #dbeafe !important;
}

.csirt-list-shell {
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0;
  width: 100%;
}

.csirt-data-table {
  margin-bottom: 0;
  min-width: 960px;
  width: 100%;
  table-layout: auto;
}

.csirt-data-table thead th {
  background: #f8fafc !important;
  border-bottom: 1px solid #e2e8f0 !important;
  color: #475569 !important;
  font-size: 11.5px;
  font-weight: 900;
  letter-spacing: 0.08em;
  padding: 15px 14px !important;
  text-transform: uppercase;
  vertical-align: middle;
}

.csirt-data-table thead th.sortable {
  cursor: pointer;
}

/* Col 1 – No */
.csirt-data-table th:nth-child(1),
.csirt-data-table td:nth-child(1) {
  min-width: 46px;
  width: 46px;
}

/* Col 2 – Nama CSIRT */
.csirt-data-table th:nth-child(2),
.csirt-data-table td:nth-child(2) {
  min-width: 180px;
}

/* Col 3 – Stakeholder */
.csirt-data-table th:nth-child(3),
.csirt-data-table td:nth-child(3) {
  min-width: 160px;
}

/* Col 4 – Telepon */
.csirt-data-table th:nth-child(4),
.csirt-data-table td:nth-child(4) {
  min-width: 120px;
}

/* Col 5 – Email */
.csirt-data-table th:nth-child(5),
.csirt-data-table td:nth-child(5) {
  min-width: 150px;
}

/* Col 6 – Status Ringkas */
.csirt-data-table th:nth-child(6),
.csirt-data-table td:nth-child(6) {
  min-width: 210px;
}

/* Col 7 – Aksi */
.csirt-data-table th:nth-child(7),
.csirt-data-table td:nth-child(7) {
  min-width: 140px;
  width: 140px;
}

.csirt-th-aksi {
  position: sticky;
  right: 0;
  z-index: 2;
  background: #f8fafc !important;
}

.csirt-data-table tbody td:last-child {
  position: sticky;
  right: 0;
  z-index: 1;
  background: inherit;
}

.csirt-data-table tbody td:nth-child(7) {
  overflow: visible !important;
  padding-left: 10px !important;
  padding-right: 10px !important;
}

.csirt-data-table tbody td {
  border-bottom: 1px solid #eef2f7 !important;
  color: #475569;
  font-size: 13.5px;
  line-height: 1.45;
  padding: 14px !important;
  transition: background-color 0.18s ease, box-shadow 0.18s ease;
  vertical-align: middle;
}

.csirt-data-table .csirt-table-row td:last-child {
  background: #fff;
}

.csirt-data-table .csirt-table-row:hover td {
  background: #f8fbff !important;
}

.csirt-data-table .csirt-table-row:hover {
  position: relative;
  z-index: 20;
}

.csirt-data-table .th-no,
.csirt-data-table .csirt-table-row td:first-child,
.csirt-data-table .csirt-table-row:hover td:first-child {
  background: transparent !important;
  box-shadow: none !important;
}

.csirt-data-table .row-number {
  background: transparent !important;
}

.csirt-data-table .company-avatar {
  flex: 0 0 42px;
  height: 42px !important;
  width: 42px !important;
}

.csirt-data-table .company-name-wrap,
.csirt-data-table .company-name {
  min-width: 0;
}

.csirt-data-table .company-name {
  color: var(--csirt-text);
  font-size: 0.86rem;
  font-weight: 800;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csirt-data-table .email-link,
.csirt-data-table .email-text,
.csirt-data-table td > .text-muted {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csirt-status-cell {
  overflow: hidden !important;
  white-space: normal;
}

.csirt-status-card {
  border: 1px solid transparent;
  border-radius: 12px;
  display: grid;
  gap: 0.48rem;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  padding: 0.65rem 0.72rem;
}

.csirt-status-card.tone-ready {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.csirt-status-card.tone-progress {
  background: #fff7ed;
  border-color: #fed7aa;
}

.csirt-status-card.tone-empty {
  background: #fff1f2;
  border-color: #fecdd3;
}

.csirt-status-main {
  align-items: flex-start;
  display: flex;
  gap: 0.55rem;
  min-width: 0;
}

.csirt-status-dot {
  border-radius: 999px;
  flex: 0 0 9px;
  height: 9px;
  margin-top: 0.3rem;
  width: 9px;
}

.tone-ready .csirt-status-dot {
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.14);
}

.tone-progress .csirt-status-dot {
  background: #f97316;
  box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.14);
}

.tone-empty .csirt-status-dot {
  background: #ef4444;
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.14);
}

.csirt-status-label {
  color: var(--csirt-text);
  display: block;
  font-size: 0.78rem;
  font-weight: 850;
  line-height: 1.25;
}

.csirt-status-card .csirt-status-hint {
  display: block;
  font-size: 0.72rem;
  line-height: 1.35;
  margin-top: 0.12rem;
  overflow-wrap: anywhere;
}

.csirt-status-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.csirt-status-metric {
  align-items: center;
  border-radius: 999px;
  display: inline-flex;
  gap: 0.28rem;
  font-size: 0.7rem;
  font-weight: 800;
  line-height: 1;
  padding: 0.32rem 0.5rem;
  white-space: nowrap;
}

.csirt-status-metric.metric-good {
  background: #dcfce7;
  color: #166534;
}

.csirt-status-metric.metric-warning {
  background: #ffedd5;
  color: #9a3412;
}

.csirt-status-metric.metric-danger {
  background: #fee2e2;
  color: #991b1b;
}

.csirt-action-group {
  align-items: center;
  display: inline-flex;
  flex-direction: row;
  gap: 7px;
  justify-content: center;
  min-width: 166px;
  white-space: nowrap;
}

.csirt-action-group .stakeholders-action-btn {
  align-items: center;
  display: inline-flex;
  flex: 0 0 34px;
  height: 34px;
  justify-content: center;
  min-width: 34px;
  overflow: visible !important;
  position: relative;
  width: 34px;
}

.csirt-action-group .stakeholders-action-btn.btn-info-light {
  background: #f3f9ff !important;
  border-color: #d8ebfb !important;
  color: #377da8 !important;
}

.csirt-action-group .stakeholders-action-btn.btn-success-light {
  background: #f3fbf7 !important;
  border-color: #d5efe2 !important;
  color: #3f8b66 !important;
}

.csirt-action-group .stakeholders-action-btn.btn-danger-light {
  background: #fff5f5 !important;
  border-color: #f3d7d7 !important;
  color: #a65252 !important;
}

.csirt-action-group .stakeholders-action-btn.btn-secondary-light {
  background: #fff9f1 !important;
  border-color: #f4e0c3 !important;
  color: #b06b24 !important;
}

[data-theme-mode='dark'] .csirt-action-group .stakeholders-action-btn {
  border-width: 1px !important;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22) !important;
}

[data-theme-mode='dark'] .csirt-action-group .stakeholders-action-btn.btn-info-light {
  background: rgba(56, 189, 248, 0.16) !important;
  border-color: rgba(56, 189, 248, 0.42) !important;
  color: #7dd3fc !important;
}

[data-theme-mode='dark'] .csirt-action-group .stakeholders-action-btn.btn-success-light {
  background: rgba(52, 211, 153, 0.16) !important;
  border-color: rgba(52, 211, 153, 0.42) !important;
  color: #86efac !important;
}

[data-theme-mode='dark'] .csirt-action-group .stakeholders-action-btn.btn-danger-light {
  background: rgba(248, 113, 113, 0.16) !important;
  border-color: rgba(248, 113, 113, 0.42) !important;
  color: #fca5a5 !important;
}

[data-theme-mode='dark'] .csirt-action-group .stakeholders-action-btn.btn-secondary-light {
  background: rgba(251, 191, 36, 0.16) !important;
  border-color: rgba(251, 191, 36, 0.42) !important;
  color: #fde68a !important;
}

[data-theme-mode='dark'] .csirt-action-group .stakeholders-action-btn:hover,
[data-theme-mode='dark'] .csirt-action-group .stakeholders-action-btn:focus-visible {
  transform: translateY(-1px);
}

[data-theme-mode='dark'] .csirt-action-group .stakeholders-action-btn.btn-info-light:hover,
[data-theme-mode='dark'] .csirt-action-group .stakeholders-action-btn.btn-info-light:focus-visible {
  background: rgba(56, 189, 248, 0.24) !important;
  border-color: rgba(125, 211, 252, 0.62) !important;
  color: #bae6fd !important;
}

[data-theme-mode='dark'] .csirt-action-group .stakeholders-action-btn.btn-success-light:hover,
[data-theme-mode='dark'] .csirt-action-group .stakeholders-action-btn.btn-success-light:focus-visible {
  background: rgba(52, 211, 153, 0.24) !important;
  border-color: rgba(134, 239, 172, 0.62) !important;
  color: #bbf7d0 !important;
}

[data-theme-mode='dark'] .csirt-action-group .stakeholders-action-btn.btn-danger-light:hover,
[data-theme-mode='dark'] .csirt-action-group .stakeholders-action-btn.btn-danger-light:focus-visible {
  background: rgba(248, 113, 113, 0.24) !important;
  border-color: rgba(252, 165, 165, 0.62) !important;
  color: #fecaca !important;
}

[data-theme-mode='dark'] .csirt-action-group .stakeholders-action-btn.btn-secondary-light:hover,
[data-theme-mode='dark'] .csirt-action-group .stakeholders-action-btn.btn-secondary-light:focus-visible {
  background: rgba(251, 191, 36, 0.24) !important;
  border-color: rgba(253, 230, 138, 0.62) !important;
  color: #fef3c7 !important;
}

.csirt-action-group .stakeholders-action-btn[data-tooltip]::after {
  background: #0f172a;
  border-radius: 8px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.2);
  bottom: calc(100% + 9px);
  color: #fff;
  content: attr(data-tooltip);
  font-size: 11px;
  font-weight: 800;
  left: 50%;
  line-height: 1;
  opacity: 0;
  padding: 6px 8px;
  pointer-events: none;
  position: absolute;
  transform: translate(-50%, 4px);
  transition: opacity 160ms ease, transform 160ms ease;
  white-space: nowrap;
  z-index: 300;
}

.csirt-action-group .stakeholders-action-btn[data-tooltip]::before {
  border: 5px solid transparent;
  border-top-color: #0f172a;
  bottom: calc(100% + 4px);
  content: "";
  left: 50%;
  opacity: 0;
  pointer-events: none;
  position: absolute;
  transform: translate(-50%, 4px);
  transition: opacity 160ms ease, transform 160ms ease;
  z-index: 301;
}

.csirt-action-group .stakeholders-action-btn[data-tooltip]:hover::after,
.csirt-action-group .stakeholders-action-btn[data-tooltip]:focus-visible::after,
.csirt-action-group .stakeholders-action-btn[data-tooltip]:hover::before,
.csirt-action-group .stakeholders-action-btn[data-tooltip]:focus-visible::before {
  opacity: 1;
  transform: translate(-50%, 0);
}

.csirt-table-pagination {
  border-top: 1px solid #eef2f7;
  margin-top: 0 !important;
  padding: 16px 18px;
}

.csirt-inline-meta {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.74rem;
  color: var(--csirt-muted);
}

.csirt-status-stack {
  gap: 0.42rem !important;
}

.csirt-readiness-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  width: fit-content;
  padding: 0.38rem 0.72rem;
  border-radius: 999px;
  font-size: 0.73rem;
  font-weight: 700;
  border: 1px solid transparent;
}

.csirt-readiness-badge.tone-ready {
  color: #166534;
  background: #dcfce7;
  border-color: #86efac;
}

.csirt-readiness-badge.tone-progress {
  color: #9a3412;
  background: #ffedd5;
  border-color: #fdba74;
}

.csirt-readiness-badge.tone-empty {
  color: #991b1b;
  background: #fee2e2;
  border-color: #fca5a5;
}

.csirt-status-hint {
  font-size: 0.74rem;
  color: var(--csirt-muted);
  line-height: 1.45;
}

.csirt-mobile-list {
  display: grid;
  gap: 0.9rem;
}

.csirt-mobile-card {
  border: 1px solid var(--csirt-border);
  border-radius: 20px;
  background: var(--csirt-panel-soft);
  padding: 1rem;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
}

.csirt-mobile-top {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.csirt-mobile-index {
  font-size: 0.74rem;
  font-weight: 700;
  color: #2563eb;
  margin-bottom: 0.18rem;
}

.csirt-mobile-top h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--csirt-text);
}

.csirt-mobile-top p {
  margin: 0.18rem 0 0;
  font-size: 0.82rem;
  color: var(--csirt-muted);
}

.csirt-mobile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
  margin-top: 1rem;
}

.csirt-mobile-grid span {
  display: block;
  margin-bottom: 0.2rem;
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--csirt-muted);
}

.csirt-mobile-grid strong,
.csirt-mobile-grid a {
  color: var(--csirt-text);
  font-size: 0.84rem;
  text-decoration: none;
  word-break: break-word;
}

.csirt-mobile-status {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 1rem;
}

.csirt-mobile-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 1rem;
}

.csirt-mobile-actions .btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 12px;
}

.csirt-empty-state {
  padding: 2.5rem 1rem;
}

@media (max-width: 1199.98px) {
  .csirt-page-shell {
    gap: 0.9rem;
  }

  .csirt-hero-shell {
    border-radius: 20px;
    padding: 1.35rem;
  }

  .csirt-hero-header {
    flex-direction: column;
  }

  .csirt-hero-copy p {
    max-width: none;
  }

  .csirt-hero-tools {
    justify-content: flex-start;
    min-width: 100%;
    width: 100%;
  }

  .csirt-hero-summary-card {
    min-width: 0;
    width: 100%;
  }

  .csirt-kpi-grid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .csirt-kpi-card {
    min-height: 128px;
  }

  .csirt-filter-shell {
    padding: 0.85rem !important;
  }

  .csirt-toolbar-row {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .csirt-rows-control {
    flex: 0 0 150px;
  }

  .csirt-toolbar-search {
    flex: 1 1 420px;
    max-width: none;
    min-width: 280px;
  }

  .csirt-filter-actions {
    flex: 1 0 100%;
    justify-content: flex-end;
  }

  .csirt-list-shell.d-lg-block {
    display: none !important;
  }

  .csirt-mobile-list.d-lg-none {
    display: grid !important;
  }
}

@media (max-width: 991.98px) {
  .csirt-hero-header {
    flex-direction: column;
  }

  .csirt-hero-tools {
    justify-content: flex-start;
    min-width: 100%;
    width: 100%;
  }

  .csirt-hero-summary-card {
    width: 100%;
  }

  .csirt-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .csirt-filter-shell,
  .csirt-filter-actions {
    flex-direction: column;
    align-items: stretch !important;
  }

  .csirt-toolbar-row {
    align-items: stretch;
    flex-direction: column;
  }

  .csirt-rows-control,
  .csirt-toolbar-search {
    max-width: none;
    min-width: 0;
    width: 100%;
  }
}

@media (max-width: 767.98px) {
  .csirt-content,
  .csirt-hero-shell {
    padding: 1rem;
  }

  .csirt-mobile-grid {
    grid-template-columns: 1fr;
  }

  .csirt-kpi-card {
    padding: 16px;
  }

  .csirt-kpi-grid {
    grid-template-columns: 1fr;
  }
}

[data-theme-mode='dark'] .csirt-hero-shell {
  background:
    radial-gradient(circle at 82% 12%, rgba(96, 165, 250, 0.32), transparent 34%),
    linear-gradient(135deg, #111b34 0%, #15316f 54%, #1f5fcf 100%) !important;
  border: 1px solid rgba(96, 165, 250, 0.24);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.32);
}

[data-theme-mode='dark'] .csirt-hero-copy h1 {
  color: #ffffff;
}

[data-theme-mode='dark'] .csirt-hero-copy p {
  color: #dbeafe;
}

[data-theme-mode='dark'] .csirt-inline-breadcrumb {
  color: #dbeafe !important;
}

[data-theme-mode='dark'] .csirt-inline-breadcrumb span {
  color: rgba(191, 219, 254, 0.62) !important;
}

[data-theme-mode='dark'] .csirt-hero-summary-card {
  background: rgba(15, 23, 42, 0.36);
  border-color: rgba(191, 219, 254, 0.24);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 16px 30px rgba(0, 0, 0, 0.18);
}

[data-theme-mode='dark'] .csirt-hero-card-title span,
[data-theme-mode='dark'] .csirt-hero-card-stats span {
  color: #bfdbfe;
}

[data-theme-mode='dark'] .csirt-hero-card-title strong,
[data-theme-mode='dark'] .csirt-hero-card-stats strong {
  color: #ffffff;
}

[data-theme-mode='dark'] .csirt-hero-progress {
  background: rgba(15, 23, 42, 0.62);
}

[data-theme-mode='dark'] .csirt-hero-progress span {
  background: linear-gradient(90deg, #5eead4 0%, #60a5fa 100%);
}

[data-theme-mode='dark'] .csirt-hero-note {
  color: #dbeafe;
}

[data-theme-mode='dark'] .csirt-filter-shell,
[data-theme-mode='dark'] .csirt-list-shell,
[data-theme-mode='dark'] .csirt-mobile-card,
[data-theme-mode='dark'] .csirt-kpi-card {
  background: #111827 !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: #e2e8f0;
}

[data-theme-mode='dark'] .csirt-kpi-card {
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.22);
}

[data-theme-mode='dark'] .csirt-kpi-card::before {
  height: 3px;
  opacity: 0.92;
}

[data-theme-mode='dark'] .csirt-kpi-label {
  color: #cbd5e1;
}

[data-theme-mode='dark'] .csirt-kpi-value {
  color: #f8fafc;
}

[data-theme-mode='dark'] .csirt-kpi-hint {
  color: #94a3b8;
}

[data-theme-mode='dark'] .csirt-kpi-icon {
  border: 1px solid currentColor;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 10px 20px rgba(0, 0, 0, 0.2);
}

[data-theme-mode='dark'] .csirt-kpi-card.tone-blue .csirt-kpi-icon {
  background: rgba(96, 165, 250, 0.16);
  color: #93c5fd;
}

[data-theme-mode='dark'] .csirt-kpi-card.tone-green .csirt-kpi-icon {
  background: rgba(52, 211, 153, 0.16);
  color: #86efac;
}

[data-theme-mode='dark'] .csirt-kpi-card.tone-amber .csirt-kpi-icon {
  background: rgba(251, 191, 36, 0.16);
  color: #fde68a;
}

[data-theme-mode='dark'] .csirt-kpi-card.tone-cyan .csirt-kpi-icon {
  background: rgba(34, 211, 238, 0.16);
  color: #67e8f9;
}

[data-theme-mode='dark'] .csirt-kpi-card.tone-indigo .csirt-kpi-icon {
  background: rgba(129, 140, 248, 0.16);
  color: #c4b5fd;
}

[data-theme-mode='dark'] .csirt-inline-meta,
[data-theme-mode='dark'] .csirt-status-hint,
[data-theme-mode='dark'] .csirt-mobile-top p,
[data-theme-mode='dark'] .csirt-mobile-grid span {
  color: #94a3b8;
}

[data-theme-mode='dark'] .csirt-mobile-grid strong,
[data-theme-mode='dark'] .csirt-mobile-grid a,
[data-theme-mode='dark'] .csirt-rows-control span {
  color: #e2e8f0 !important;
}

[data-theme-mode='dark'] .csirt-rows-control {
  background: rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
}

[data-theme-mode='dark'] .csirt-rows-control .entries-select option {
  background-color: #111827;
  color: #e2e8f0;
}

[data-theme-mode='dark'] .csirt-rows-control .entries-select {
  color: #e2e8f0 !important;
}

[data-theme-mode='dark'] .csirt-toolbar-search .csirt-search-field .header-search-input {
  background: rgba(15, 23, 42, 0.82) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: #e2e8f0 !important;
}

[data-theme-mode='dark'] .csirt-data-table thead th {
  background: #111c31 !important;
  border-bottom-color: rgba(148, 163, 184, 0.18) !important;
  color: #cbd5e1 !important;
}

[data-theme-mode='dark'] .csirt-th-aksi {
  background: #111c31 !important;
}

[data-theme-mode='dark'] .csirt-data-table tbody td {
  border-bottom-color: rgba(148, 163, 184, 0.12) !important;
  color: #cbd5e1;
}

[data-theme-mode='dark'] .csirt-data-table .csirt-table-row td:last-child {
  background: #111827 !important;
}

[data-theme-mode='dark'] .csirt-data-table .csirt-table-row:hover td {
  background: rgba(37, 99, 235, 0.08) !important;
}

[data-theme-mode='dark'] .csirt-data-table .company-name,
[data-theme-mode='dark'] .csirt-status-label {
  color: #f8fafc;
}

[data-theme-mode='dark'] .csirt-status-card.tone-ready {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.28);
}

[data-theme-mode='dark'] .csirt-status-card.tone-progress {
  background: rgba(249, 115, 22, 0.1);
  border-color: rgba(249, 115, 22, 0.28);
}

[data-theme-mode='dark'] .csirt-status-card.tone-empty {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.28);
}

[data-theme-mode='dark'] .csirt-status-metric.metric-good {
  background: rgba(34, 197, 94, 0.14);
  color: #86efac;
}

[data-theme-mode='dark'] .csirt-status-metric.metric-warning {
  background: rgba(249, 115, 22, 0.14);
  color: #fdba74;
}

[data-theme-mode='dark'] .csirt-status-metric.metric-danger {
  background: rgba(239, 68, 68, 0.14);
  color: #fca5a5;
}

</style>


