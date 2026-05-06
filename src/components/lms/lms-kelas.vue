<script lang="ts">
import { ref, computed, onMounted, nextTick, watch, onBeforeUnmount } from "vue";
import gsap from "gsap";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useLmsStore } from "../../stores/lms";
import { lmsService } from "../../services/lms.service";
import LmsEditor from "./LmsEditor.vue";
import { useRouter } from "vue-router";

export default {
  components: { Pageheader, LmsEditor },
  data() {
    return {
      dataToPass: {
        title: { label: "Dashboard", path: "/dashboard" },
        currentpage: "LMS — Kelas",
        activepage: "Kelas",
      },
    };
  },
  setup() {
    const lmsStore = useLmsStore();
    const router = useRouter();
    
    const searchQuery = ref("");
    const currentPage = ref(1);
    const itemsPerPage = ref(10);
    const sortKey = ref<"nama_kelas" | "status" | null>(null);
    const sortDirection = ref<"asc" | "desc">("asc");
    const isDarkMode = ref(false);
    let gsapCtx: gsap.Context | null = null;
    let themeObserver: MutationObserver | undefined;
    
    // Toast
    const showToast = ref(false);
    const toastMessage = ref("");
    const toastType = ref<"success" | "error">("success");
    const showNotification = (msg: string, type: "success" | "error") => {
      toastMessage.value = msg;
      toastType.value = type;
      showToast.value = true;
      setTimeout(() => (showToast.value = false), 3000);
    };

    const syncThemeMode = () => {
      if (typeof document === "undefined") return;
      const root = document.documentElement;
      isDarkMode.value = root.getAttribute("data-theme-mode") === "dark" || root.classList.contains("dark");
    };

    const runEntranceAnimations = () => {
      nextTick(() => {
        gsapCtx = gsap.context(() => {
          const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
          tl.from(".ev-breadcrumb", { y: -10, opacity: 0, duration: 0.45 })
            .from(".ev-hero-title", { y: 22, opacity: 0, duration: 0.58 }, "-=0.2")
            .from(".ev-hero-desc", { y: 16, opacity: 0, duration: 0.5 }, "-=0.32")
            .from(".ev-hero-tile", { opacity: 0, duration: 0.62, stagger: 0.05, ease: "power3.out" }, "-=0.34")
            .from(".ev-stat-card", { y: 18, opacity: 0, scale: 0.94, duration: 0.42, stagger: 0.08, ease: "back.out(1.4)" }, "-=0.2")
            .from(".ev-content-card", { y: 26, opacity: 0, duration: 0.55 }, "-=0.18");
        });
      });
    };

    const animateRows = (quick = false) => {
      nextTick(() => {
        const rows = Array.from(document.querySelectorAll<HTMLElement>(".ev-table-row"));
        if (!rows.length) return;
        gsap.killTweensOf(rows);

        rows.forEach((row, index) => {
          gsap.fromTo(
            row,
            { y: quick ? 12 : 18, opacity: 0, scale: quick ? 0.992 : 0.985, force3D: true },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              duration: quick ? 0.32 : 0.38,
              delay: index * (quick ? 0.05 : 0.055),
              ease: "power2.out",
              clearProps: "transform,opacity",
            }
          );
        });
      });
    };

    // Stats — derived from cache instead of separate API calls
    const materiCounts = ref<Record<string, number>>({});
    const kuisCounts = ref<Record<string, number>>({});

    const computedTotalMateri = computed(() => {
      let sum = 0;
      for (const k of lmsStore.kelasList) {
        sum += (materiCounts.value[k.id] || 0);
      }
      return sum;
    });

    const computedTotalKuis = computed(() => {
      let sum = 0;
      for (const k of lmsStore.kelasList) {
        sum += (kuisCounts.value[k.id] || 0);
      }
      return sum;
    });

    /**
     * Load stats in parallel batches — uses getKelasDetail which caches results.
     * Subsequent expands will be instant from cache.
     */
    const isInitialLoading = ref(lmsStore.kelasList.length === 0);

    const initStatsFromCache = () => {
      lmsStore.kelasList.forEach(k => {
        const cached = lmsStore.kelasCache[k.id];
        if (cached) {
          materiCounts.value[k.id] = cached.materi.length;
          kuisCounts.value[k.id] = cached.kuis.length;
        }
      });
    };

    /**
     * Load stats in parallel batches — uses store's cache-aware fetch.
     */
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const isLoadingStats = ref(false);

    const loadGlobalStats = async () => {
      if (isLoadingStats.value) return;
      isLoadingStats.value = true;

      try {
        const pending = lmsStore.kelasList.filter(k => !lmsStore.kelasCache[k.id]);

        for (let i = 0; i < pending.length; i += 2) {
          const batch = pending.slice(i, i + 2);
          await Promise.all(batch.map(k =>
            lmsStore.fetchKelasDetail(k.id).then(({ materi, kuis }) => {
              materiCounts.value[k.id] = materi.length;
              kuisCounts.value[k.id] = kuis.length;
            }).catch(() => {})
          ));

          if (i + 2 < pending.length) await delay(300);
        }
      } finally {
        isLoadingStats.value = false;
      }
    };

    onMounted(() => {
      syncThemeMode();
      if (typeof document !== "undefined") {
        themeObserver = new MutationObserver(syncThemeMode);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-mode", "class"] });
      }
      runEntranceAnimations();
      // 1. If we have data in store, use it immediately (Instant UI)
      if (lmsStore.kelasList.length > 0) {
        initStatsFromCache();
        // Even if we have data, we still trigger loadGlobalStats to refresh counts from cache
        loadGlobalStats(); 
      }

      // 2. Refresh data in background (SWR pattern)
      lmsStore.fetchKelas().then(() => {
        isInitialLoading.value = false;
        initStatsFromCache();
        loadGlobalStats(); 
        animateRows();
      }).catch((e: any) => {
        isInitialLoading.value = false;
        if (lmsStore.kelasList.length === 0) {
          showNotification(e.message || "Gagal memuat data kelas", "error");
        }
      });
    });

    watch(currentPage, () => animateRows(true));
    watch([searchQuery, itemsPerPage], () => {
      currentPage.value = 1;
      animateRows(true);
    });
    onBeforeUnmount(() => {
      gsapCtx?.revert();
      themeObserver?.disconnect();
    });

    const filteredData = computed(() => {
      const q = searchQuery.value.toLowerCase().trim();
      if (!q) return lmsStore.kelasList;
      return lmsStore.kelasList.filter(
        (k) =>
          (k.nama_kelas || "").toLowerCase().includes(q) ||
          (k.kategori || "").toLowerCase().includes(q) ||
          (k.penyelenggara || "").toLowerCase().includes(q)
      );
    });

    const sortedData = computed(() => {
      if (!sortKey.value) return filteredData.value;

      const direction = sortDirection.value === "asc" ? 1 : -1;

      return [...filteredData.value].sort((a, b) => {
        const aValue = sortKey.value === "status"
          ? (a.status === "published" ? "Publish" : "Draft")
          : (a.nama_kelas || "");
        const bValue = sortKey.value === "status"
          ? (b.status === "published" ? "Publish" : "Draft")
          : (b.nama_kelas || "");
        const result = String(aValue).localeCompare(String(bValue), "id", { sensitivity: "base" });
        if (result !== 0) return result * direction;
        return String(a.nama_kelas || "").localeCompare(String(b.nama_kelas || ""), "id", { sensitivity: "base" });
      });
    });

    const toggleSort = (key: "nama_kelas" | "status") => {
      if (sortKey.value === key) {
        if (sortDirection.value === "asc") {
          sortDirection.value = "desc";
        } else {
          sortKey.value = null;
          sortDirection.value = "asc";
        }
      } else {
        sortKey.value = key;
        sortDirection.value = "asc";
      }
      currentPage.value = 1;
      animateRows(true);
    };

    const getSortIcon = (key: "nama_kelas" | "status") => {
      if (sortKey.value !== key) return "ri-arrow-up-down-line";
      return sortDirection.value === "asc" ? "ri-sort-asc" : "ri-sort-desc";
    };

    const totalPages = computed(() => Math.max(1, Math.ceil(sortedData.value.length / itemsPerPage.value)));
    const displayData = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return sortedData.value.slice(start, start + itemsPerPage.value);
    });

    // Expand logic — uses cached data when available
    const expandedKelasId = ref<string | number | null>(null);
    const classMateriList = ref<any[]>([]);
    const classKuisList = ref<any[]>([]);
    const isLoadingDetail = ref(false);

    const toggleExpand = async (item: any) => {
      if (expandedKelasId.value === item.id) {
        expandedKelasId.value = null;
      } else {
        expandedKelasId.value = item.id;
        isLoadingDetail.value = true;
        try {
          // Uses cache if available (instant), fetches if not
          const { materi, kuis } = await lmsStore.fetchKelasDetail(item.id);
          classMateriList.value = materi;
          classKuisList.value = kuis;
          materiCounts.value[item.id] = materi.length;
          kuisCounts.value[item.id] = kuis.length;
        } catch(e) {
          showNotification("Gagal memuat detail kelas", "error");
        } finally {
          isLoadingDetail.value = false;
        }
      }
    };

    // Modals state
    const activeModal = ref<'kelas' | 'materi' | 'kuis' | 'delete' | null>(null);
    const isEdit = ref(false);
    const isSaving = ref(false);
    const formErrors = ref<Record<string, string>>({});

    const deleteType = ref<'kelas' | 'materi' | 'kuis'>('kelas');
    const deleteTarget = ref<any>(null);

    // KELAS FORM
    const emptyKelasForm = () => ({
      id: '',
      nama_kelas: '',
      deskripsi: '',
      durasi_jp: 0,
      informasi_umum: '',
      kategori: '',
      penyelenggara: '',
      syarat_pendaftaran: '',
      target_peserta: '',
      thumbnail: '',
      status: 'published'
    });
    const formKelas = ref(emptyKelasForm());
    const thumbnailPreview = computed(() => formKelas.value.thumbnail || null);

    const openKelasModal = (item?: any) => {
      formErrors.value = {};

      if (item) {
        isEdit.value = true;
        formKelas.value = { 
          id: item.id, 
          nama_kelas: item.nama_kelas, 
          deskripsi: item.deskripsi,
          durasi_jp: item.durasi_jp || 0,
          informasi_umum: item.informasi_umum || '',
          kategori: item.kategori || '',
          penyelenggara: item.penyelenggara || '',
          syarat_pendaftaran: item.syarat_pendaftaran || '',
          target_peserta: item.target_peserta || '',
          thumbnail: item.thumbnail || '',
          status: item.status || 'published' 
        };
      } else {
        isEdit.value = false;
        formKelas.value = emptyKelasForm();
      }
      activeModal.value = 'kelas';
    };

    const saveKelas = async () => {
      formErrors.value = {};
      if (!formKelas.value.nama_kelas) formErrors.value.nama_kelas = "Wajib diisi";
      if (!formKelas.value.deskripsi) formErrors.value.deskripsi = "Wajib diisi";
      if (!formKelas.value.kategori) formErrors.value.kategori = "Wajib diisi";
      if (Number(formKelas.value.durasi_jp) < 0) formErrors.value.durasi_jp = "Durasi tidak boleh negatif";
      if (Object.keys(formErrors.value).length > 0) return;
      
      isSaving.value = true;
      try {
        if (isEdit.value) {
          await lmsStore.updateKelas(formKelas.value.id, formKelas.value);
          showNotification("Kelas berhasil diperbarui!", "success");
        } else {
          await lmsStore.createKelas(formKelas.value);
          showNotification("Kelas berhasil dibuat!", "success");
        }
        activeModal.value = null;
      } catch (e: any) { 
        showNotification(e.message || "Gagal menyimpan kelas", "error"); 
      }
      finally { isSaving.value = false; }
    };

    // MATERI ROUTING
    const openMateriModal = (kelasId: string, item?: any) => {
      if (item) {
        router.push(`/lms/materi/edit/${item.id}`);
      } else {
        router.push({ path: `/lms/materi/create`, query: { kelasId } });
      }
    };

    // KUIS ROUTING
    const openKuisModal = async (kelasId: string, item?: any) => {
      if (item) {
        router.push(`/lms/quiz/edit/${item.id}`);
      } else {
        router.push({ path: `/lms/quiz/create`, query: { kelasId } });
      }
    };

    // DELETE
    const openDeleteModal = (type: 'kelas'|'materi'|'kuis', item: any) => {
      deleteType.value = type;
      deleteTarget.value = item;
      activeModal.value = 'delete';
    };
    const confirmDelete = async () => {
      isSaving.value = true;
      try {
        if (deleteType.value === 'kelas') {
          await lmsStore.deleteKelas(deleteTarget.value.id);
          if (expandedKelasId.value === deleteTarget.value.id) expandedKelasId.value = null;
        } else if (deleteType.value === 'materi') {
          await lmsStore.deleteMateri(deleteTarget.value.id);
          classMateriList.value = classMateriList.value.filter(m => m.id !== deleteTarget.value.id);
          if(expandedKelasId.value) materiCounts.value[expandedKelasId.value]--;
        } else if (deleteType.value === 'kuis') {
          await lmsStore.deleteKuis(deleteTarget.value.id);
          classKuisList.value = classKuisList.value.filter(k => k.id !== deleteTarget.value.id);
          if(expandedKelasId.value) kuisCounts.value[expandedKelasId.value]--;
        }
        showNotification("Berhasil dihapus", "success");
        activeModal.value = null;
      } catch(e) { showNotification("Gagal menghapus", "error"); }
      finally { isSaving.value = false; }
    };

    const getAvatarClass = (letter: string) => {
      const variants = ["avatar-blue","avatar-indigo","avatar-violet","avatar-purple","avatar-teal","avatar-cyan","avatar-green","avatar-amber","avatar-orange","avatar-red"];
      const idx = (letter.toUpperCase().charCodeAt(0) - 65 + variants.length) % variants.length;
      return variants[idx];
    };

    const findMateriJudul = (idMateri?: string | number) => {
      if (!idMateri) return "Unknown";
      const m = classMateriList.value.find(m => String(m.id) === String(idMateri));
      return m ? m.judul : "Materi tidak ditemukan";
    };

    const countKuisForMateri = (materiId: string | number) => {
      return classKuisList.value.filter(k => String(k.id_materi) === String(materiId)).length;
    };
    
    const kategoriOptions = ref(['Cybersecurity', 'CSIRT', 'Networking', 'Compliance', 'Risk Management', 'Incident Response', 'Lainnya']);
    
    // UI Expand / Collapse Soal state
    return {
      isInitialLoading,
      isDarkMode,
      router, lmsStore, searchQuery, currentPage, itemsPerPage, filteredData, sortedData, totalPages, displayData,
      sortKey, sortDirection, toggleSort, getSortIcon,
      showToast, toastMessage, toastType, 
      computedTotalMateri, computedTotalKuis, materiCounts, kuisCounts,
      expandedKelasId, classMateriList, classKuisList, toggleExpand, isLoadingDetail,
      activeModal, isEdit, isSaving, formErrors,
      formKelas, openKelasModal, saveKelas,
      openMateriModal, openKuisModal,
      openDeleteModal, confirmDelete, deleteType, deleteTarget,
      getAvatarClass, findMateriJudul, countKuisForMateri,
      thumbnailPreview, kategoriOptions
    };
  }
};
</script>

<template>
  <div :class="['lms-kelas-page', { 'is-dark': isDarkMode }]">
    <Pageheader :propData="dataToPass" />

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
        <header class="ikas-hero-header ev-hero mb-4">
          <div class="ev-hero-grid"></div>
          <div class="ev-hero-tiles" aria-hidden="true">
            <span class="ev-hero-tile tile-a"></span>
            <span class="ev-hero-tile tile-b"></span>
            <span class="ev-hero-tile tile-c"></span>
            <span class="ev-hero-tile tile-d"></span>
            <span class="ev-hero-tile tile-e"></span>
            <span class="ev-hero-tile tile-f"></span>
          </div>
          <div class="ikas-hero-content ev-hero-body">
            <div class="ikas-hero-copy ev-hero-text">
              <div class="ikas-inline-breadcrumb ev-breadcrumb">Dashboard <span>/</span> LMS <span>/</span> Kelas</div>
              <h1 class="ev-hero-title">LMS Kelas</h1>
              <p class="ev-hero-desc">Kelola kelas, materi, dan soal kuis dalam satu halaman</p>
            </div>
          </div>

          <div class="ikas-hero-tools ikas-stakeholder-summary ev-hero-stats" aria-label="Ringkasan LMS kelas">
            <div class="ikas-hero-stat-card ev-stat-card stat-total">
              <div class="ikas-stat-top ev-stat-head">
                <span>Total Kelas</span>
                <i class="ri-graduation-cap-line"></i>
              </div>
              <strong>{{ lmsStore.totalKelas }}</strong>
            </div>
            <div class="ikas-hero-stat-card ev-stat-card stat-materi">
              <div class="ikas-stat-top ev-stat-head">
                <span>Materi</span>
                <i class="ri-book-open-line"></i>
              </div>
              <strong>{{ computedTotalMateri }}</strong>
            </div>
            <div class="ikas-hero-stat-card ev-stat-card stat-kuis">
              <div class="ikas-stat-top ev-stat-head">
                <span>Kuis</span>
                <i class="ri-questionnaire-line"></i>
              </div>
              <strong>{{ computedTotalKuis }}</strong>
            </div>
          </div>
        </header>

        <div class="card custom-card lms-kelas-card ev-content-card" style="overflow: visible !important;">
          <div class="card-body p-4 stakeholders-premium-body">
            <div class="controls-bar stakeholders-toolbar stakeholders-filter-bar lms-kelas-toolbar-wrap ev-toolbar mb-4">
              <div class="stakeholders-toolbar-right lms-kelas-toolbar">
                <div class="stakeholders-per-page ev-per-page">
                  <span>Rows</span>
                  <select v-model="itemsPerPage" class="form-select form-select-sm entries-select ev-select" @change="currentPage = 1">
                    <option v-for="n in [5, 10, 15, 20]" :key="n" :value="n">{{ n }}</option>
                  </select>
                </div>
                <div class="ikas-header-search kelas-toolbar-search ev-search">
                  <i class="ri-search-line"></i>
                  <input v-model="searchQuery" type="text" placeholder="Cari nama, kategori, penyelenggara..." @input="currentPage = 1" />
                  <button v-if="searchQuery" @click="searchQuery = ''; currentPage = 1" class="ikas-clear-btn ev-search-clear" title="Clear search">
                    <i class="ri-close-circle-fill"></i>
                  </button>
                </div>
                <button @click="openKelasModal()" class="btn stakeholders-add-btn ev-btn-add ms-auto d-flex align-items-center gap-2">
                  <i class="ri-add-circle-line fs-13"></i>
                  <span class="btn-text">Tambah Kelas</span>
                </button>
              </div>
            </div>

          <div class="table-responsive stakeholder-table-wrap stakeholders-table-shell">
            <table class="table stakeholder-table mb-0">
              <thead class="stakeholder-thead lms-table-head">
                <tr>
                  <th class="th-no lms-th-no" style="width: 56px;">
                    <span class="lms-th-label">No</span>
                  </th>
                  <th class="lms-th-sortable" :aria-sort="sortKey === 'nama_kelas' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'">
                    <button type="button" class="lms-sort-btn" :class="{ active: sortKey === 'nama_kelas' }" @click="toggleSort('nama_kelas')" title="Urutkan nama kelas">
                      <span>Kelas</span>
                      <i :class="getSortIcon('nama_kelas')"></i>
                    </button>
                  </th>
                  <th class="lms-th-description">
                    <span class="lms-th-label">Deskripsi</span>
                  </th>
                  <th class="text-center lms-th-sortable" :aria-sort="sortKey === 'status' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'">
                    <button type="button" class="lms-sort-btn lms-sort-btn-center" :class="{ active: sortKey === 'status' }" @click="toggleSort('status')" title="Urutkan status">
                      <span>Status</span>
                      <i :class="getSortIcon('status')"></i>
                    </button>
                  </th>
                  <th class="text-center lms-th-action">
                    <span class="lms-th-label justify-content-center">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="isInitialLoading">
                  <td colspan="5" class="p-0">
                    <div class="skeleton-table-body">
                      <div v-for="n in 5" :key="n" class="skeleton-row p-3 d-flex align-items-center gap-3 border-bottom">
                        <div class="skel skel-circle" style="width: 40px; height: 40px;"></div>
                        <div class="flex-grow-1">
                          <div class="skel mb-2" style="width: 40%; height: 16px;"></div>
                          <div class="skel" style="width: 20%; height: 12px;"></div>
                        </div>
                        <div class="skel" style="width: 15%; height: 24px; border-radius: 20px;"></div>
                        <div class="skel" style="width: 80px; height: 32px;"></div>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr v-else-if="!displayData.length">
                  <td colspan="5" class="text-center py-5">
                    <div class="empty-state">
                      <div class="empty-icon-ring mb-3"><div class="empty-icon-inner"><i class="ri-graduation-cap-line"></i></div></div>
                      <h6 class="fw-semibold mb-1 empty-state-title">Belum Ada Kelas</h6>
                      <p class="text-muted fs-13 mb-3">Klik tombol "Tambah Kelas" untuk membuat kelas baru.</p>
                    </div>
                  </td>
                </tr>
                <template v-for="(item, i) in displayData" :key="item.id">
                  <tr class="stakeholder-row ev-table-row" :class="{ 'stakeholder-row-expanded': expandedKelasId === item.id }" @click="toggleExpand(item)" style="cursor: pointer;">
                    <td class="align-middle text-center">
                      <span class="row-number">{{ (currentPage - 1) * itemsPerPage + i + 1 }}</span>
                    </td>
                    <td class="align-middle">
                      <div class="stakeholder-company-cell">
                        <button class="stakeholder-expand-btn" @click.stop="toggleExpand(item)" :title="expandedKelasId === item.id ? 'Collapse row' : 'Expand row'">
                          <i :class="expandedKelasId === item.id ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'"></i>
                        </button>
                        <div class="company-avatar overflow-hidden" :class="item.thumbnail ? '' : getAvatarClass((item.nama_kelas || 'K').charAt(0))">
                          <img v-if="item.thumbnail" :src="item.thumbnail" class="w-100 h-100 object-fit-cover" alt="" />
                          <span v-else class="company-avatar-letter">{{ (item.nama_kelas || 'K').charAt(0).toUpperCase() }}</span>
                        </div>
                        <div class="company-name-wrap">
                          <span class="company-name d-block fw-bold">{{ item.nama_kelas }}</span>
                          <span class="text-muted fs-12">{{ materiCounts[item.id] || 0 }} Materi · {{ kuisCounts[item.id] || 0 }} Kuis</span>
                        </div>
                      </div>
                    </td>
                    <td class="align-middle text-muted fs-13">
                      <div class="fw-semibold text-dark mb-1">{{ item.deskripsi || '-' }}</div>
                      <div class="d-flex flex-wrap gap-2">
                        <span v-if="item.kategori" class="badge bg-primary-transparent text-primary fs-11">{{ item.kategori }}</span>
                        <span v-if="item.penyelenggara" class="badge bg-info-transparent text-info fs-11">{{ item.penyelenggara }}</span>
                        <span v-if="item.durasi_jp" class="badge bg-secondary-transparent text-secondary fs-11">{{ item.durasi_jp }} JP</span>
                      </div>
                    </td>
                    <td class="align-middle text-center">
                      <span class="badge-sektor" :class="item.status === 'published' ? 'badge-sektor-teal' : 'badge-sektor-amber'">
                        {{ item.status === 'published' ? 'Publish' : 'Draft' }}
                      </span>
                    </td>
                    <td class="align-middle text-center">
                      <div class="d-flex gap-1 justify-content-center">
                        <button @click.stop="router.push('/lms/kelas/view/' + item.id)" class="btn btn-sm btn-icon btn-wave btn-primary-light stakeholders-action-btn" title="Lihat Detail Kelas">
                          <i class="ri-eye-line"></i>
                        </button>
                        <button @click.stop="openKelasModal(item)" class="btn btn-sm btn-icon btn-wave btn-success-light stakeholders-action-btn" title="Edit Kelas">
                          <i class="ri-edit-2-line"></i>
                        </button>
                        <button @click.stop="openDeleteModal('kelas', item)" class="btn btn-sm btn-icon btn-wave btn-danger-light stakeholders-action-btn" title="Hapus Kelas">
                          <i class="ri-delete-bin-3-line"></i>
                        </button>
                      </div>
                    </td>
                  </tr>

                  <!-- EXPANDED ROW: MATERI & KUIS -->
                  <tr v-if="expandedKelasId === item.id" class="stakeholder-detail-row">
                    <td colspan="5" class="p-0 border-0">
                      <div class="stakeholder-expanded-wrapper">
                        <div v-if="isLoadingDetail" class="text-center py-3"><span class="spinner-border spinner-border-sm text-primary"></span><span class="ms-2 fs-13 text-muted">Memuat detail kelas...</span></div>
                        <div v-else class="row g-3">
                          
                          <!-- MATERI LIST -->
                          <div class="col-lg-6 col-12">
                            <div class="card border-0 mb-0 rounded-3 stakeholder-inner-card">
                              <div class="card-header bg-transparent border-bottom-0 d-flex justify-content-between align-items-center pt-3 pb-2 px-3">
                                <h6 class="mb-0 fw-bold d-flex align-items-center gap-2 fs-13 stakeholder-detail-card-title"><i class="ri-book-read-line text-primary fs-16"></i> Daftar Materi</h6>
                                <button @click="openMateriModal(item.id)" class="btn btn-sm rounded-pill px-2 py-1 fw-medium fs-12 stakeholder-sub-add-btn stakeholder-sub-add-btn-primary"><i class="ri-add-line"></i> Materi</button>
                              </div>
                              <div class="card-body px-3 pb-3 pt-0">
                                <div class="list-group rounded-3">
                                  <div v-if="classMateriList.length === 0" class="text-center text-muted py-3 fs-12 bg-light rounded-3">Belum ada materi ditambahkan.</div>
                                  <div v-for="m in classMateriList" :key="m.id" class="list-group-item d-flex justify-content-between align-items-center px-3 py-2 rounded-3 border-0 mb-1 stakeholder-detail-list-item">
                                    <div class="d-flex align-items-start gap-3 overflow-hidden me-2 w-100">
                                      <div class="mt-1 flex-shrink-0" :class="m.tipe === 'video' ? 'text-danger' : 'text-primary'">
                                        <i :class="m.tipe === 'video' ? 'ri-play-circle-fill' : 'ri-file-text-fill'" class="fs-20"></i>
                                      </div>
                                      <div class="overflow-hidden w-100">
                                        <div class="fw-bold fs-13 mb-0 text-truncate stakeholder-detail-card-title">{{ m.judul }}</div>
                                        <div class="d-flex align-items-center gap-2 flex-wrap mt-1">
                                          <span class="badge bg-primary-transparent text-primary fs-11 px-2 py-1 fw-medium"><i class="ri-price-tag-3-line me-1"></i> {{ m.kategori || 'Umum' }}</span>
                                          <span class="text-muted fs-11 text-uppercase fw-bold">{{ m.tipe }}</span>
                                          <span v-if="countKuisForMateri(m.id) > 0" class="badge bg-success-transparent text-success fs-10 fw-bold px-2 py-0-5 rounded-pill">
                                            <i class="ri-checkbox-circle-line me-1"></i> {{ countKuisForMateri(m.id) }} Kuis
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div class="d-flex gap-1 flex-shrink-0">
                                      <button @click="openMateriModal(item.id, m)" class="btn btn-sm btn-icon btn-outline-primary rounded-circle border-0 bg-primary-transparent" title="Edit"><i class="ri-edit-line"></i></button>
                                      <button @click="openDeleteModal('materi', m)" class="btn btn-sm btn-icon btn-outline-danger rounded-circle border-0 bg-danger-transparent" title="Hapus"><i class="ri-delete-bin-line"></i></button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <!-- KUIS LIST -->
                          <div class="col-lg-6 col-12">
                            <div class="card border-0 mb-0 rounded-3 stakeholder-inner-card">
                              <div class="card-header bg-transparent border-bottom-0 d-flex justify-content-between align-items-center pt-3 pb-2 px-3">
                                <h6 class="mb-0 fw-bold d-flex align-items-center gap-2 fs-13 stakeholder-detail-card-title"><i class="ri-shield-check-line text-success fs-16"></i> Daftar Evaluasi / Kuis</h6>
                                <button @click="openKuisModal(item.id)" class="btn btn-sm rounded-pill px-2 py-1 fw-medium fs-12 stakeholder-sub-add-btn stakeholder-sub-add-btn-success"><i class="ri-add-line"></i> Kuis</button>
                              </div>
                              <div class="card-body px-3 pb-3 pt-0">
                                <div class="list-group rounded-3">
                                  <div v-if="classKuisList.length === 0" class="text-center text-muted py-3 fs-12 bg-light rounded-3">Belum ada evaluasi / kuis.</div>
                                  <div v-for="(q, index) in classKuisList" :key="q.id" class="list-group-item d-flex justify-content-between align-items-center px-3 py-2 rounded-3 border-0 mb-1 stakeholder-detail-list-item">
                                    <div class="d-flex align-items-start gap-3 overflow-hidden me-2 w-100">
                                      <div class="mt-1 flex-shrink-0">
                                        <div class="avatar avatar-sm rounded-circle bg-success-transparent text-success fw-bold fs-12 d-flex align-items-center justify-content-center">Q{{ index + 1 }}</div>
                                      </div>
                                      <div class="overflow-hidden w-100">
                                        <div class="fw-bold fs-13 mb-0 text-truncate stakeholder-detail-card-title">{{ q.judul }}</div>
                                        <div class="d-flex align-items-center gap-2 flex-wrap mt-1">
                                          <span v-if="q.tipe_kuis === 'per_materi'" class="badge bg-primary-transparent text-primary fs-11 px-2 py-1 fw-semibold">
                                            <i class="ri-book-open-line me-1"></i> Materi: <span class="text-truncate d-inline-block align-bottom" style="max-width: 80px;">{{ findMateriJudul(q.id_materi) }}</span>
                                          </span>
                                          <span v-else class="badge bg-success-transparent text-success fs-11 px-2 py-1 fw-bold">
                                            <i class="ri-medal-line me-1"></i> FINAL KELAS
                                          </span>
                                          <span class="text-muted fs-11 fw-bold"><i class="ri-timer-line text-muted"></i> {{ q.durasi_menit || q.durasi || 0 }} Menit</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div class="d-flex gap-1 flex-shrink-0">
                                      <button @click="openKuisModal(item.id, q)" class="btn btn-sm btn-icon btn-outline-primary rounded-circle border-0 bg-primary-transparent" title="Edit"><i class="ri-edit-line"></i></button>
                                      <button @click="openDeleteModal('kuis', q)" class="btn btn-sm btn-icon btn-outline-danger rounded-circle border-0 bg-danger-transparent" title="Hapus"><i class="ri-delete-bin-line"></i></button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <div class="pagination-container stakeholders-pagination mt-2 mb-0 pb-0">
            <div class="stakeholders-pagination-copy">
              Showing {{ displayData.length ? (currentPage - 1) * itemsPerPage + 1 : 0 }}-{{ Math.min(currentPage * itemsPerPage, filteredData.length) }} of {{ filteredData.length }} kelas
            </div>
            <div class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
              <span class="stakeholders-page-pill">Page {{ currentPage }} of {{ totalPages || 1 }}</span>
              <nav v-if="totalPages > 1">
                <ul class="pagination pagination-sm mb-0 gap-1">
                  <li class="page-item" :class="{ disabled: currentPage === 1 }"><a class="page-link rounded-circle" href="#" @click.prevent="currentPage--"><i class="ri-arrow-left-s-line"></i></a></li>
                  <template v-for="p in totalPages" :key="p">
                    <li v-if="p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)" class="page-item" :class="{ active: p === currentPage }">
                      <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = p">{{ p }}</a>
                    </li>
                    <li v-else-if="p === currentPage - 2 || p === currentPage + 2" class="page-item disabled"><span class="page-link border-0 bg-transparent">...</span></li>
                  </template>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }"><a class="page-link rounded-circle" href="#" @click.prevent="currentPage++"><i class="ri-arrow-right-s-line"></i></a></li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  </div>

  <!-- ===================== MODALS ===================== -->
  
  <!-- KELAS MODAL -->
  <div v-if="activeModal === 'kelas'" :class="['modal-overlay', 'kelas-modal-overlay', { 'is-dark': isDarkMode }]" @click.self="activeModal = null">
    <div
      class="modal-dialog modal-dialog-centered lms-kelas-modal-size kelas-modal-dialog"
      style="width: min(90vw, 900px); max-width: 900px; margin: 1rem auto;"
    >
      <div class="modal-content border-0 bg-transparent kelas-modal-content" style="width: 100%; max-width: none;">
        <div class="card custom-card gradient-header-card w-100 mb-0 custom-modal kelas-modal-card">
          <div class="card-header d-flex justify-content-between align-items-center gap-3 users-header kelas-modal-header">
            <div class="d-flex align-items-center gap-3"><div class="header-icon-box"><i class="ri-graduation-cap-line"></i></div><div><div class="card-title mb-0 text-white fw-bold header-card-title">{{ isEdit ? 'Edit Kelas' : 'Tambah Kelas Baru' }}</div></div></div>
            <button type="button" class="btn-close btn-close-white" @click="activeModal = null"></button>
          </div>
          <div class="card-body p-4 bg-white kelas-modal-body">
            <div class="row g-4 kelas-form-grid">
              <div class="col-12">
                <label class="form-label fw-semibold">Nama Kelas <span class="text-danger">*</span></label>
                <input v-model="formKelas.nama_kelas" type="text" class="form-control kse-modal-input" :class="{'is-invalid': formErrors.nama_kelas}" placeholder="Masukkan nama kelas...">
                <div class="invalid-feedback">{{ formErrors.nama_kelas }}</div>
              </div>
              <div class="col-md-6">
                <label class="form-label fw-semibold">Kategori <span class="text-danger">*</span></label>
                <VueMultiselect
                  v-model="formKelas.kategori"
                  :options="kategoriOptions"
                  :searchable="true"
                  placeholder="Pilih kategori..."
                  select-label=""
                  selected-label="Terpilih"
                  deselect-label="Hapus"
                  :class="{'is-invalid': formErrors.kategori}"
                />
                <div v-if="formErrors.kategori" class="text-danger fs-12 mt-1">{{ formErrors.kategori }}</div>
              </div>
              <div class="col-md-6">
                <label class="form-label fw-semibold">Status</label>
                <select v-model="formKelas.status" class="form-select kse-modal-input">
                  <option value="published">Publish</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <div class="col-12">
                <label class="form-label fw-semibold">Deskripsi <span class="text-danger">*</span></label>
                <textarea v-model="formKelas.deskripsi" class="form-control kse-modal-input kelas-modal-textarea" :class="{'is-invalid': formErrors.deskripsi}" rows="3" placeholder="Deskripsi..."></textarea>
                <div class="invalid-feedback">{{ formErrors.deskripsi }}</div>
              </div>
              <div class="col-md-4">
                <label class="form-label fw-semibold">Penyelenggara</label>
                <input v-model="formKelas.penyelenggara" type="text" class="form-control kse-modal-input" placeholder="Nama penyelenggara">
              </div>
              <div class="col-md-4">
                <label class="form-label fw-semibold">Durasi JP</label>
                <input v-model.number="formKelas.durasi_jp" type="number" min="0" class="form-control kse-modal-input" :class="{'is-invalid': formErrors.durasi_jp}" placeholder="0">
                <div class="invalid-feedback">{{ formErrors.durasi_jp }}</div>
              </div>
              <div class="col-md-4">
                <label class="form-label fw-semibold">Target Peserta</label>
                <input v-model="formKelas.target_peserta" type="text" class="form-control kse-modal-input" placeholder="Contoh: ASN, admin sistem, pengelola layanan">
              </div>
              <div class="col-12">
                <label class="form-label fw-semibold">Informasi Umum</label>
                <textarea v-model="formKelas.informasi_umum" class="form-control kse-modal-input kelas-modal-textarea" rows="3" placeholder="Informasi umum kelas..."></textarea>
              </div>
              <div class="col-12">
                <label class="form-label fw-semibold">Syarat Pendaftaran</label>
                <textarea v-model="formKelas.syarat_pendaftaran" class="form-control kse-modal-input kelas-modal-textarea" rows="3" placeholder="Syarat pendaftaran peserta..."></textarea>
              </div>
              <div class="col-12 kelas-thumbnail-section">
                <label class="form-label fw-semibold">Thumbnail URL</label>
                
                <div class="d-flex flex-column gap-3 kelas-thumbnail-field">
                  <input
                    v-model="formKelas.thumbnail"
                    type="text"
                    class="form-control kse-modal-input"
                    placeholder="Masukkan URL Gambar (Misal: https://example.com/foto.jpg)"
                  />

                  <div v-if="thumbnailPreview" class="thumbnail-preview-box kelas-thumbnail-preview rounded-4 border p-2 bg-light d-flex align-items-center justify-content-center overflow-hidden position-relative">
                    <img :src="thumbnailPreview" class="w-100 h-100 object-fit-cover rounded-3" alt="Preview" @error="formKelas.thumbnail = ''" />
                    <button @click="formKelas.thumbnail = ''" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 rounded-circle" style="width: 28px; height: 28px; padding: 0;">
                      <i class="ri-close-line"></i>
                    </button>
                  </div>
                  <div v-else class="thumbnail-placeholder kelas-thumbnail-preview rounded-4 border-dashed p-4 text-center bg-light">
                    <i class="ri-image-line fs-1 text-muted opacity-50"></i>
                    <p class="text-muted fs-12 mb-0">Belum ada URL gambar</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="card-footer bg-light d-flex justify-content-end gap-2 kelas-modal-footer">
            <button class="btn btn-outline-danger" @click="activeModal = null">Batal</button>
            <button class="btn btn-primary" @click="saveKelas" :disabled="isSaving"><span v-if="isSaving" class="spinner-border spinner-border-sm me-1"></span>Simpan</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- KELAS MODAL (Materi & Kuis Modals removed, replaced by routing) -->

  <!-- DELETE MODAL -->
  <div v-if="activeModal === 'delete'" :class="['modal', 'fade', 'show', 'd-block', 'modal-overlay', { 'is-dark': isDarkMode }]" tabindex="-1" @click.self="activeModal = null">
    <div class="modal-dialog modal-dialog-centered modal-sm custom-modal">
      <div class="modal-content border-0 bg-transparent">
        <div class="kse-modal-box kse-modal-sm w-100">
          <div class="kse-modal-header kse-modal-header-danger">
            <div class="d-flex align-items-center gap-3">
              <div class="kse-modal-icon-wrap"><i class="ri-delete-bin-line"></i></div>
              <div>
                <div class="kse-modal-title">Hapus {{ deleteType === 'kelas' ? 'Kelas' : deleteType === 'materi' ? 'Materi' : 'Kuis' }}</div>
              </div>
            </div>
          </div>
          <div class="kse-modal-body text-center">
            <p class="mb-0 fs-14">Yakin ingin menghapus <strong>{{ deleteTarget?.nama_kelas || deleteTarget?.judul }}</strong>?</p>
          </div>
          <div class="kse-modal-footer">
            <button class="btn btn-light kse-modal-cancel" @click="activeModal = null">Batal</button>
            <button class="btn btn-danger" @click="confirmDelete" :disabled="isSaving"><span v-if="isSaving" class="spinner-border spinner-border-sm me-1"></span>Hapus</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
[data-theme-mode="dark"] .lms-kelas-page .lms-kelas-card,
html.dark .lms-kelas-page .lms-kelas-card {
  background: linear-gradient(180deg, #0b1220 0%, #111827 100%) !important;
  border-color: #22314a !important;
  box-shadow: 0 22px 54px rgba(2, 6, 23, 0.34) !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholders-premium-body,
html.dark .lms-kelas-page .stakeholders-premium-body {
  background: transparent !important;
}

[data-theme-mode="dark"] .lms-kelas-page .ikas-hero-header,
html.dark .lms-kelas-page .ikas-hero-header {
  background: linear-gradient(135deg, #081225 0%, #11294d 52%, #164e77 100%) !important;
  border-color: rgba(71, 85, 105, 0.5) !important;
  box-shadow: 0 22px 58px rgba(2, 6, 23, 0.42) !important;
}

[data-theme-mode="dark"] .lms-kelas-page .ikas-hero-stat-card,
html.dark .lms-kelas-page .ikas-hero-stat-card {
  background: rgba(15, 23, 42, 0.55) !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
  box-shadow: 0 16px 34px rgba(2, 6, 23, 0.28) !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholders-toolbar,
html.dark .lms-kelas-page .stakeholders-toolbar {
  background: rgba(15, 23, 42, 0.78) !important;
  border-color: rgba(51, 65, 85, 0.85) !important;
  box-shadow: none !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholders-per-page,
html.dark .lms-kelas-page .stakeholders-per-page {
  background: transparent !important;
  border-color: transparent !important;
  color: #cbd5e1 !important;
}

[data-theme-mode="dark"] .lms-kelas-page .entries-select,
html.dark .lms-kelas-page .entries-select {
  background-color: #0b1220 !important;
  border-color: #22314a !important;
  color: #cbd5e1 !important;
}

[data-theme-mode="dark"] .lms-kelas-page .entries-select option,
html.dark .lms-kelas-page .entries-select option {
  background: #111c2e !important;
  color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .lms-kelas-page .ikas-header-search,
html.dark .lms-kelas-page .ikas-header-search {
  background: #0b1220 !important;
  border-color: #22314a !important;
  color: #cbd5e1 !important;
  box-shadow: none !important;
}

[data-theme-mode="dark"] .lms-kelas-page .ikas-header-search:focus-within,
html.dark .lms-kelas-page .ikas-header-search:focus-within {
  border-color: #0ea5e9 !important;
  box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.16) !important;
}

[data-theme-mode="dark"] .lms-kelas-page .ikas-header-search input,
html.dark .lms-kelas-page .ikas-header-search input {
  color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .lms-kelas-page .ikas-header-search input::placeholder,
html.dark .lms-kelas-page .ikas-header-search input::placeholder {
  color: #64748b !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholder-table-wrap,
html.dark .lms-kelas-page .stakeholder-table-wrap {
  background: linear-gradient(180deg, #0b1220 0%, #0f1a2d 100%) !important;
  border-color: #22314a !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03) !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholder-table,
html.dark .lms-kelas-page .stakeholder-table {
  --bs-table-bg: transparent !important;
  --bs-table-color: #e2e8f0 !important;
  --bs-table-hover-bg: rgba(37, 99, 235, 0.12) !important;
  color: #e2e8f0 !important;
  border-color: transparent !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholder-table thead,
[data-theme-mode="dark"] .lms-kelas-page .stakeholder-table thead tr,
[data-theme-mode="dark"] .lms-kelas-page .stakeholder-table thead th,
html.dark .lms-kelas-page .stakeholder-table thead,
html.dark .lms-kelas-page .stakeholder-table thead tr,
html.dark .lms-kelas-page .stakeholder-table thead th {
  background: linear-gradient(180deg, #1e3a8a 0%, #1d4ed8 100%) !important;
  background-color: #1d4ed8 !important;
  border-color: transparent !important;
  color: #ffffff !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholder-table thead th:first-child,
html.dark .lms-kelas-page .stakeholder-table thead th:first-child {
  border-left-color: transparent !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholder-table thead th:last-child,
html.dark .lms-kelas-page .stakeholder-table thead th:last-child {
  border-right-color: transparent !important;
}

[data-theme-mode="dark"] .lms-kelas-page .lms-sort-btn,
[data-theme-mode="dark"] .lms-kelas-page .lms-th-label,
html.dark .lms-kelas-page .lms-sort-btn,
html.dark .lms-kelas-page .lms-th-label {
  color: #ffffff !important;
}

[data-theme-mode="dark"] .lms-kelas-page .lms-sort-btn,
html.dark .lms-kelas-page .lms-sort-btn {
  background: transparent !important;
}

[data-theme-mode="dark"] .lms-kelas-page .lms-sort-btn:hover,
[data-theme-mode="dark"] .lms-kelas-page .lms-sort-btn.active,
html.dark .lms-kelas-page .lms-sort-btn:hover,
html.dark .lms-kelas-page .lms-sort-btn.active {
  background: rgba(255, 255, 255, 0.18) !important;
  color: #ffffff !important;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22) !important;
}

[data-theme-mode="dark"] .lms-kelas-page .lms-sort-btn i,
html.dark .lms-kelas-page .lms-sort-btn i {
  color: #bfdbfe !important;
}

[data-theme-mode="dark"] .lms-kelas-page .lms-sort-btn.active i,
html.dark .lms-kelas-page .lms-sort-btn.active i {
  color: #ffffff !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholder-table tbody,
html.dark .lms-kelas-page .stakeholder-table tbody {
  background: transparent !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholder-table tbody tr,
[data-theme-mode="dark"] .lms-kelas-page .stakeholder-table tbody td,
html.dark .lms-kelas-page .stakeholder-table tbody tr,
html.dark .lms-kelas-page .stakeholder-table tbody td {
  background: #0f172a !important;
  background-color: #0f172a !important;
  border-color: #22314a !important;
  color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholder-table tbody tr:not(.stakeholder-detail-row) td:first-child,
html.dark .lms-kelas-page .stakeholder-table tbody tr:not(.stakeholder-detail-row) td:first-child {
  border-left-color: #2563eb !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholder-table tbody tr:not(.stakeholder-detail-row) td:last-child,
html.dark .lms-kelas-page .stakeholder-table tbody tr:not(.stakeholder-detail-row) td:last-child {
  border-right-color: #22314a !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholder-row:hover td,
html.dark .lms-kelas-page .stakeholder-row:hover td,
[data-theme-mode="dark"] .lms-kelas-page .stakeholder-row-expanded td,
html.dark .lms-kelas-page .stakeholder-row-expanded td {
  background: #13213a !important;
  border-color: rgba(96, 165, 250, 0.42) !important;
}

[data-theme-mode="dark"] .lms-kelas-page .company-name,
[data-theme-mode="dark"] .lms-kelas-page .text-dark,
[data-theme-mode="dark"] .lms-kelas-page .stakeholder-detail-card-title,
html.dark .lms-kelas-page .company-name,
html.dark .lms-kelas-page .text-dark,
html.dark .lms-kelas-page .stakeholder-detail-card-title {
  color: #f8fafc !important;
}

[data-theme-mode="dark"] .lms-kelas-page .text-muted,
html.dark .lms-kelas-page .text-muted {
  color: #94a3b8 !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholder-expand-btn,
html.dark .lms-kelas-page .stakeholder-expand-btn {
  background: #111c2e !important;
  border-color: rgba(148, 163, 184, 0.28) !important;
  color: #93c5fd !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholder-expanded-wrapper,
html.dark .lms-kelas-page .stakeholder-expanded-wrapper {
  background: #0b1220 !important;
  border-color: #22314a !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholder-inner-card,
html.dark .lms-kelas-page .stakeholder-inner-card {
  background: #0f172a !important;
  border: 1px solid #22314a !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholder-detail-list-item,
[data-theme-mode="dark"] .lms-kelas-page .list-group .bg-light,
html.dark .lms-kelas-page .stakeholder-detail-list-item,
html.dark .lms-kelas-page .list-group .bg-light {
  background: #111c2e !important;
  border-color: rgba(148, 163, 184, 0.14) !important;
  color: #dbeafe !important;
}

[data-theme-mode="dark"] .lms-kelas-page .skeleton-table-body,
[data-theme-mode="dark"] .lms-kelas-page .skeleton-row,
html.dark .lms-kelas-page .skeleton-table-body,
html.dark .lms-kelas-page .skeleton-row {
  background: #0f172a !important;
  border-color: #22314a !important;
}

[data-theme-mode="dark"] .lms-kelas-page .skel,
html.dark .lms-kelas-page .skel {
  background: linear-gradient(90deg, #111c2e 25%, #1d2b42 50%, #111c2e 75%) !important;
  background-size: 1000px 100% !important;
}

[data-theme-mode="dark"] .lms-kelas-page .stakeholders-pagination-copy,
[data-theme-mode="dark"] .lms-kelas-page .stakeholders-page-pill,
html.dark .lms-kelas-page .stakeholders-pagination-copy,
html.dark .lms-kelas-page .stakeholders-page-pill {
  color: #93c5fd !important;
}

[data-theme-mode="dark"] .lms-kelas-page .empty-state-title,
[data-theme-mode="dark"] .lms-kelas-page .row-number,
html.dark .lms-kelas-page .empty-state-title,
html.dark .lms-kelas-page .row-number {
  color: #f8fafc !important;
}

[data-theme-mode="dark"] .lms-kelas-page .empty-icon-ring,
html.dark .lms-kelas-page .empty-icon-ring {
  background: rgba(37, 99, 235, 0.12) !important;
  border-color: rgba(96, 165, 250, 0.28) !important;
}

[data-theme-mode="dark"] .lms-kelas-page .pagination .page-link,
html.dark .lms-kelas-page .pagination .page-link {
  background: #0b1628 !important;
  border-color: rgba(96, 165, 250, 0.22) !important;
  color: #bfdbfe !important;
}

[data-theme-mode="dark"] .lms-kelas-page .pagination .page-item.active .page-link,
html.dark .lms-kelas-page .pagination .page-item.active .page-link {
  background: #2563eb !important;
  border-color: #2563eb !important;
  color: #ffffff !important;
}

[data-theme-mode="dark"] .kelas-modal-body,
[data-theme-mode="dark"] .kelas-modal-footer,
html.dark .kelas-modal-body,
html.dark .kelas-modal-footer {
  background: #050b16 !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
  color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .kelas-modal-body .form-label,
html.dark .kelas-modal-body .form-label {
  color: #dbeafe !important;
}

[data-theme-mode="dark"] .kelas-modal-body .form-control,
[data-theme-mode="dark"] .kelas-modal-body .form-select,
[data-theme-mode="dark"] .kelas-modal-body .multiselect__tags,
html.dark .kelas-modal-body .form-control,
html.dark .kelas-modal-body .form-select,
html.dark .kelas-modal-body .multiselect__tags {
  background: #0b1220 !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
  color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .kelas-modal-body .form-control::placeholder,
html.dark .kelas-modal-body .form-control::placeholder {
  color: #64748b !important;
}

[data-theme-mode="dark"] .kelas-modal-body .multiselect__input,
[data-theme-mode="dark"] .kelas-modal-body .multiselect__single,
html.dark .kelas-modal-body .multiselect__input,
html.dark .kelas-modal-body .multiselect__single {
  background: #0b1220 !important;
  color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .kelas-modal-body .multiselect__content-wrapper,
html.dark .kelas-modal-body .multiselect__content-wrapper {
  background: #0b1220 !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
}

[data-theme-mode="dark"] .kelas-modal-body .multiselect__option,
html.dark .kelas-modal-body .multiselect__option {
  color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .kelas-modal-body .multiselect__option--highlight,
html.dark .kelas-modal-body .multiselect__option--highlight {
  background: #2563eb !important;
  color: #ffffff !important;
}

[data-theme-mode="dark"] .kelas-modal-body .multiselect__option--selected,
html.dark .kelas-modal-body .multiselect__option--selected {
  background: rgba(37, 99, 235, 0.2) !important;
  color: #bfdbfe !important;
}

[data-theme-mode="dark"] .kelas-thumbnail-preview,
html.dark .kelas-thumbnail-preview {
  background: #0b1220 !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
}

.lms-kelas-modal-size {
  max-width: 860px !important;
  width: min(84vw, 860px) !important;
  margin: 1rem auto !important;
}

.lms-kelas-modal-size .modal-content {
  max-width: none !important;
  width: 100% !important;
}

@media (max-width: 1200px) {
  .lms-kelas-modal-size {
    max-width: 96% !important;
    width: 96% !important;
    margin: 0.75rem auto !important;
  }
}
</style>

<style scoped>
.lms-kelas-page {
  padding: 2px;
}

.kelas-modal-overlay {
  align-items: center;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 20px;
}

.kelas-modal-dialog {
  max-width: 860px !important;
  width: min(84vw, 860px) !important;
  margin: 1rem auto;
}

.kelas-modal-content {
  height: calc(100vh - 1rem);
  max-height: calc(100vh - 1rem);
  width: 100%;
}

.kelas-modal-card {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 1rem);
  max-height: calc(100vh - 1rem);
  border-radius: 24px;
  overflow: hidden;
}

.kelas-modal-header,
.kelas-modal-footer {
  flex: 0 0 auto;
}

.kelas-modal-header.users-header {
  align-items: center !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
}

.kelas-modal-header > .d-flex {
  min-width: 0;
}

.kelas-modal-header .header-card-title {
  overflow-wrap: anywhere;
}

.kelas-modal-header .btn-close {
  flex: 0 0 auto;
  margin-left: auto;
}

.kelas-modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 1.5rem !important;
}

.kelas-form-grid {
  width: 100%;
}

.kelas-modal-textarea {
  min-height: 124px;
  resize: vertical;
}

.kelas-thumbnail-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.kelas-thumbnail-field {
  flex: 1 1 auto;
  min-height: 0;
}

.kelas-thumbnail-preview {
  align-items: center;
  display: flex;
  justify-content: center;
  min-height: 132px;
}

@media (max-width: 767.98px) {
  .kelas-modal-overlay {
    align-items: flex-start;
    padding: 12px;
  }

  .kelas-modal-dialog {
    max-width: calc(100vw - 24px) !important;
    width: calc(100vw - 24px) !important;
    margin: 0.5rem auto;
  }

  .kelas-modal-content,
  .kelas-modal-card {
    height: calc(100vh - 0.75rem);
    max-height: calc(100vh - 0.75rem);
  }

  .kelas-modal-body {
    padding: 1rem !important;
  }

  .kelas-form-grid {
    --bs-gutter-y: 1rem;
  }

  .kelas-modal-textarea {
    min-height: 96px;
  }

  .kelas-thumbnail-preview {
    min-height: 150px;
  }

  .kelas-modal-header {
    gap: 0.75rem !important;
    padding: 1rem !important;
  }

  .kelas-modal-header .header-icon-box {
    flex: 0 0 40px;
    height: 40px !important;
    width: 40px !important;
  }

  .kelas-modal-footer {
    flex-wrap: wrap;
    justify-content: stretch !important;
  }

  .kelas-modal-footer .btn {
    flex: 1 1 140px;
  }
}

.ikas-hero-header {
  align-items: center;
  background:
    radial-gradient(ellipse 390px 210px at 38% 112%, rgba(255, 255, 255, 0.14), transparent 62%),
    radial-gradient(circle at 78% 8%, rgba(255, 255, 255, 0.16), transparent 24%),
    linear-gradient(135deg, #0f1f57 0%, #2454d8 52%, #0ea5e9 100%);
  border: none;
  border-radius: 16px;
  box-shadow: 0 22px 58px rgba(37, 84, 216, 0.24);
  color: #ffffff;
  display: flex;
  gap: 28px;
  justify-content: space-between;
  min-height: 154px;
  overflow: hidden;
  padding: 30px 34px;
  position: relative;
  isolation: isolate;
}

.ikas-hero-header::before {
  background: radial-gradient(circle, rgba(255, 255, 255, 0.26), transparent 64%);
  border-radius: 999px;
  content: "";
  height: 360px;
  inset: auto -80px -120px auto;
  pointer-events: none;
  position: absolute;
  width: 360px;
  z-index: 0;
}

.ikas-hero-header::after {
  background: radial-gradient(circle, rgba(45, 212, 191, 0.22), transparent 62%);
  border-radius: 999px;
  content: "";
  height: 310px;
  left: -110px;
  pointer-events: none;
  position: absolute;
  top: -140px;
  width: 310px;
  z-index: 0;
}

.ikas-hero-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.ikas-hero-copy {
  max-width: 820px;
}

.ikas-inline-breadcrumb {
  color: #bae6fd;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ikas-inline-breadcrumb span {
  color: rgba(255, 255, 255, 0.58);
  margin: 0 5px;
}

.ikas-hero-copy h1 {
  color: #ffffff;
  font-size: 32px;
  font-weight: 900;
  line-height: 1.08;
  margin: 0;
  text-shadow: 0 10px 28px rgba(15, 23, 42, 0.2);
}

.ikas-hero-copy p {
  color: rgba(255, 255, 255, 0.88);
  font-size: 14px;
  line-height: 1.6;
  margin: 10px 0 0;
}

.ikas-hero-tools {
  align-items: stretch;
  display: flex;
  justify-content: flex-end;
  flex: 1 1 auto;
  gap: 10px;
  position: relative;
  z-index: 2;
}

.ikas-hero-tools.ikas-stakeholder-summary {
  align-self: center;
}

.ikas-hero-stat-card {
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 8px;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.16);
  display: flex;
  flex-direction: column;
  gap: 14px;
  justify-content: center;
  min-height: 92px;
  overflow: hidden;
  padding: 14px;
  position: relative;
  width: 140px;
  flex: 0 0 140px;
}

.ikas-hero-stat-card::before {
  background: radial-gradient(circle at 18% 0%, rgba(191, 219, 254, 0.32), transparent 44%);
  content: "";
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.ikas-stat-top {
  align-items: flex-start;
  display: flex;
  gap: 10px;
  justify-content: space-between;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.ikas-stat-top span {
  color: #ffffff;
  display: block;
  font-size: 10px;
  font-weight: 800;
  line-height: 1.1;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.ikas-stat-top i {
  align-items: center;
  background: transparent;
  border: none;
  color: #ffffff;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 22px;
  height: auto;
  justify-content: center;
  width: auto;
}

.ikas-hero-stat-card strong {
  color: #ffffff;
  display: block;
  font-size: 28px;
  font-weight: 900;
  line-height: 1;
  position: relative;
  z-index: 1;
}

.ikas-hero-stat-card.is-spotlight {
  background:
    linear-gradient(145deg, rgba(34, 211, 238, 0.3), rgba(59, 130, 246, 0.12)),
    rgba(7, 26, 78, 0.28);
  border-color: rgba(125, 211, 252, 0.42);
}

.ikas-hero-stat-card.is-spotlight::after {
  background: radial-gradient(circle, rgba(125, 211, 252, 0.32), transparent 62%);
  content: "";
  height: 74px;
  pointer-events: none;
  position: absolute;
  right: -24px;
  top: -26px;
  width: 74px;
}

.ikas-header-search {
  align-items: center;
  background: #f8fbff;
  border: 1px solid #cbdcf8;
  border-radius: 10px;
  color: #94a3b8;
  display: flex;
  gap: 9px;
  min-height: 40px;
  max-width: 460px;
  padding: 0 12px;
  transition: border-color 180ms ease, box-shadow 180ms ease;
  width: 100%;
}

.lms-kelas-card {
  background: linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);
  border: 1px solid #cfe0ff;
  border-radius: 14px;
  box-shadow: 0 22px 54px rgba(30, 64, 175, 0.11);
}

.lms-kelas-card .stakeholders-premium-body {
  background: transparent;
}

.lms-kelas-toolbar-wrap {
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(203, 213, 225, 0.72);
  border-radius: 14px;
  box-shadow: 0 12px 28px rgba(30, 64, 175, 0.08);
  padding: 12px;
}

.lms-kelas-toolbar {
  align-items: center;
  display: flex;
  gap: 14px;
  width: 100%;
}

.lms-kelas-toolbar .stakeholders-per-page {
  flex: 0 0 auto;
}

.kelas-toolbar-search {
  flex: 1 1 360px;
  max-width: 520px;
  min-width: 260px;
}

.ikas-header-search:focus-within {
  border-color: #0ea5e9;
  box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.11);
}

.ikas-header-search input {
  background: transparent;
  border: 0;
  color: #0f172a;
  font-size: 13px;
  min-width: 0;
  outline: 0;
  width: 100%;
}

.ikas-clear-btn {
  align-items: center;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  justify-content: center;
  padding: 0;
  transition: color 0.2s;
}

.ikas-clear-btn:hover {
  color: #475569;
}

.lms-kelas-page .stakeholders-per-page {
  background: transparent;
  border-color: transparent;
  margin: 0;
}

.lms-kelas-page .stakeholders-per-page span {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.lms-kelas-page .entries-select {
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  color: #334155;
  font-size: 13px;
}

.lms-kelas-page .stakeholders-add-btn {
  background: linear-gradient(135deg, #1d4ed8, #2563eb 55%, #0ea5e9) !important;
  border: none !important;
  border-radius: 10px;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.22);
  color: #ffffff !important;
  font-size: 13px;
  font-weight: 800;
  padding: 10px 16px;
}

.lms-kelas-page .stakeholders-add-btn:hover {
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.18);
  transform: translateY(-2px);
}

.lms-kelas-page .stakeholder-table-wrap {
  background: linear-gradient(180deg, #eaf3ff 0%, #f5f9ff 100%);
  border: 1px solid #d7e7ff;
  border-radius: 16px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
  padding: 12px;
}

.lms-kelas-page .stakeholder-table {
  border-collapse: separate;
  border-spacing: 0 10px;
}

.lms-kelas-page .stakeholder-table thead th {
  background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%) !important;
  border: 0;
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
  padding: 6px;
  vertical-align: middle;
}

.lms-kelas-page .stakeholder-table thead th:first-child {
  border-radius: 12px 0 0 12px;
}

.lms-kelas-page .stakeholder-table thead th:last-child {
  border-radius: 0 12px 12px 0;
}

.lms-th-label,
.lms-sort-btn {
  align-items: center;
  color: #ffffff;
  display: inline-flex;
  gap: 8px;
  min-height: 42px;
}

.lms-th-label {
  font-size: 12px;
  font-weight: 900;
  justify-content: flex-start;
  padding: 0 12px;
  width: 100%;
}

.lms-sort-btn {
  background: transparent;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
  justify-content: space-between;
  padding: 0 12px;
  transition: background 180ms ease, color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
  width: 100%;
}

.lms-sort-btn i {
  color: #bfdbfe;
  font-size: 16px;
  line-height: 1;
}

.lms-sort-btn:hover,
.lms-sort-btn.active {
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
}

.lms-sort-btn.active {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.26), 0 8px 18px rgba(15, 23, 42, 0.14);
}

.lms-sort-btn:hover {
  transform: translateY(-1px);
}

.lms-sort-btn.active i {
  color: #ffffff;
}

.lms-sort-btn-center {
  justify-content: center;
  margin-inline: auto;
}

.lms-th-no .lms-th-label,
.lms-th-action .lms-th-label {
  justify-content: center;
}

.lms-th-sortable {
  min-width: 150px;
}

.lms-th-description {
  min-width: 240px;
}

.lms-kelas-page .stakeholder-table tbody td {
  background: #f8fbff !important;
  border-bottom: 1px solid #dce8fb;
  border-top: 1px solid #dce8fb;
  padding-bottom: 16px;
  padding-top: 16px;
}

.lms-kelas-page .stakeholder-table tbody tr:not(.stakeholder-detail-row) td:first-child {
  border-left: 5px solid #2563eb;
  border-radius: 14px 0 0 14px;
}

.lms-kelas-page .stakeholder-table tbody tr:not(.stakeholder-detail-row) td:last-child {
  border-radius: 0 14px 14px 0;
  border-right: 1px solid #dce8fb;
}

.lms-kelas-page .stakeholder-row:hover td {
  background: #eff6ff !important;
  box-shadow: 0 18px 36px rgba(30, 64, 175, 0.12);
}

.lms-kelas-page .ev-hero {
  background: linear-gradient(135deg, #0f1f57 0%, #2454d8 52%, #0ea5e9 100%);
  border: none;
  border-radius: 16px;
  box-shadow: 0 22px 58px rgba(37, 84, 216, 0.24);
  color: #fff;
  overflow: hidden;
  position: relative;
}

.lms-kelas-page .ev-hero::before {
  background: radial-gradient(circle, rgba(255, 255, 255, 0.26), transparent 64%);
  border-radius: 999px;
  content: "";
  height: 360px;
  inset: auto -80px -120px auto;
  pointer-events: none;
  position: absolute;
  width: 360px;
}

.lms-kelas-page .ev-hero::after {
  background: radial-gradient(circle, rgba(45, 212, 191, 0.22), transparent 62%);
  border-radius: 999px;
  content: "";
  height: 310px;
  left: -110px;
  pointer-events: none;
  position: absolute;
  top: -140px;
  width: 310px;
}

.lms-kelas-page .ev-hero-grid {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 28px 28px;
  inset: 0;
  mask-image: linear-gradient(90deg, #000 0%, rgba(0, 0, 0, 0.44) 62%, transparent 100%);
  opacity: 0.34;
  pointer-events: none;
  position: absolute;
}

.lms-kelas-page .ev-hero-tiles {
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  position: absolute;
}

.lms-kelas-page .ev-hero-tile {
  animation: none;
  background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0.1) 38%, rgba(96, 165, 250, 0.13) 58%, transparent 76%);
  border: 0;
  border-radius: 999px;
  mix-blend-mode: screen;
  opacity: 0.5;
  position: absolute;
}

.lms-kelas-page .ev-hero-tile.tile-a {
  height: 200px;
  right: -78px;
  top: -40px;
  transform: rotate(-8deg);
  width: 390px;
}

.lms-kelas-page .ev-hero-tile.tile-b {
  height: 270px;
  left: 10%;
  top: -118px;
  width: 270px;
}

.lms-kelas-page .ev-hero-tile.tile-c {
  height: 240px;
  right: 25%;
  top: -88px;
  width: 240px;
}

.lms-kelas-page .ev-hero-tile.tile-d {
  bottom: -112px;
  height: 205px;
  left: 32%;
  width: 205px;
}

.lms-kelas-page .ev-hero-tile.tile-e {
  bottom: -130px;
  height: 220px;
  right: 8%;
  width: 220px;
}

.lms-kelas-page .ev-hero-tile.tile-f {
  bottom: -64px;
  height: 165px;
  left: -20px;
  width: 165px;
}

.lms-kelas-page .ev-breadcrumb {
  color: #bae6fd;
}

.lms-kelas-page .ev-breadcrumb span {
  color: rgba(255, 255, 255, 0.42);
}

.lms-kelas-page .ev-hero-title {
  color: #fff;
  text-shadow: 0 10px 28px rgba(15, 23, 42, 0.2);
}

.lms-kelas-page .ev-hero-desc {
  color: rgba(255, 255, 255, 0.86);
}

.lms-kelas-page .ev-stat-card {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.24);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.16);
}

.lms-kelas-page .ev-stat-head span,
.lms-kelas-page .ev-stat-card strong {
  color: #fff;
}

.lms-kelas-page .ev-stat-head i {
  color: #fde68a;
}

.lms-kelas-page .ev-content-card {
  background: linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);
  border-color: #cfe0ff;
  box-shadow: 0 22px 54px rgba(30, 64, 175, 0.11);
}

.lms-kelas-page .ev-toolbar {
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(203, 213, 225, 0.72);
  border-radius: 14px;
  box-shadow: 0 12px 28px rgba(30, 64, 175, 0.08);
  padding: 12px;
}

.lms-kelas-page .ev-search {
  background: #f8fbff;
  border-color: #cbdcf8;
}

.lms-kelas-page .ev-btn-add {
  background: linear-gradient(135deg, #1d4ed8, #2563eb 55%, #0ea5e9) !important;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.22);
}

@media (max-width: 768px) {
  .ikas-hero-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }

  .ikas-hero-tools {
    max-width: none;
  }

  .ikas-hero-stat-card {
    min-height: 84px;
  }

  .lms-kelas-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .kelas-toolbar-search {
    max-width: none;
    min-width: 0;
  }

  .lms-kelas-toolbar .stakeholders-add-btn {
    margin-left: 0 !important;
    justify-content: center;
    width: 100%;
  }
}

@media (max-width: 1100px) {
  .ikas-hero-header {
    align-items: stretch;
    flex-direction: column;
  }

  .ikas-hero-tools {
    min-width: 100%;
    width: 100%;
    flex: auto;
  }
}

.ikas-hero-stat-card.stat-total i {
  color: #fde68a;
  text-shadow: 0 2px 10px rgba(253, 230, 138, 0.3);
}
.ikas-hero-stat-card.stat-materi i {
  color: #fde68a;
  text-shadow: 0 2px 10px rgba(253, 230, 138, 0.3);
}
.ikas-hero-stat-card.stat-kuis i {
  color: #fde68a;
  text-shadow: 0 2px 10px rgba(253, 230, 138, 0.3);
}

.lms-kelas-page.is-dark .lms-kelas-card,
.lms-kelas-page.is-dark .ev-content-card {
  background: linear-gradient(180deg, #0b1220 0%, #111827 100%) !important;
  border-color: #22314a !important;
  box-shadow: 0 22px 54px rgba(2, 6, 23, 0.34) !important;
}

.lms-kelas-page.is-dark .ev-toolbar {
  background: rgba(15, 23, 42, 0.78) !important;
  border-color: rgba(51, 65, 85, 0.85) !important;
  box-shadow: none !important;
}

.lms-kelas-page.is-dark .stakeholder-table-wrap {
  background: linear-gradient(180deg, #0b1220 0%, #0f1a2d 100%) !important;
  border-color: #22314a !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03) !important;
}

.lms-kelas-page.is-dark .stakeholder-table {
  --bs-table-bg: transparent !important;
  --bs-table-color: #e2e8f0 !important;
  --bs-table-hover-bg: rgba(37, 99, 235, 0.14) !important;
  color: #e2e8f0 !important;
}

.lms-kelas-page.is-dark .stakeholder-table tbody,
.lms-kelas-page.is-dark .stakeholder-table tbody tr,
.lms-kelas-page.is-dark .stakeholder-table tbody td,
.lms-kelas-page.is-dark .stakeholder-table > :not(caption) > * > * {
  background: #0f172a !important;
  background-color: #0f172a !important;
  border-color: #22314a !important;
  color: #e2e8f0 !important;
  box-shadow: none !important;
}

.lms-kelas-page.is-dark .stakeholder-table tbody tr:not(.stakeholder-detail-row) td:first-child {
  border-left-color: #2563eb !important;
}

.lms-kelas-page.is-dark .stakeholder-table tbody tr:not(.stakeholder-detail-row) td:last-child {
  border-right-color: #22314a !important;
}

.lms-kelas-page.is-dark .stakeholder-row:hover td,
.lms-kelas-page.is-dark .stakeholder-row-expanded td {
  background: #13213a !important;
  background-color: #13213a !important;
  border-color: rgba(96, 165, 250, 0.42) !important;
}

.lms-kelas-page.is-dark .company-name,
.lms-kelas-page.is-dark .text-dark,
.lms-kelas-page.is-dark .row-number,
.lms-kelas-page.is-dark .empty-state-title,
.lms-kelas-page.is-dark .stakeholder-detail-card-title {
  color: #f8fafc !important;
}

.lms-kelas-page.is-dark .text-muted {
  color: #94a3b8 !important;
}

.lms-kelas-page.is-dark .stakeholder-expanded-wrapper {
  background: #0b1220 !important;
  border-color: #22314a !important;
}

.lms-kelas-page.is-dark .stakeholder-inner-card,
.lms-kelas-page.is-dark .stakeholder-detail-list-item,
.lms-kelas-page.is-dark .list-group .bg-light {
  background: #111c2e !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
  color: #dbeafe !important;
}

.lms-kelas-page.is-dark .lms-sort-btn:hover,
.lms-kelas-page.is-dark .lms-sort-btn.active,
.lms-kelas-page.is-dark .lms-sort-btn.active:hover {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.34), rgba(37, 99, 235, 0.46)) !important;
  border: 1px solid rgba(147, 197, 253, 0.42) !important;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 8px 18px rgba(37, 99, 235, 0.22) !important;
  color: #ffffff !important;
}

.lms-kelas-page.is-dark .lms-sort-btn i,
.lms-kelas-page.is-dark .lms-sort-btn.active i,
.lms-kelas-page.is-dark .lms-sort-btn:hover i {
  color: #dbeafe !important;
}
</style>
