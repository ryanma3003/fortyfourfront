<script lang="ts">
import { ref, computed, onMounted, nextTick, watch, onBeforeUnmount } from "vue";
import gsap from "gsap";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useLmsStore } from "../../stores/lms";
import { useRouter } from "vue-router";

export default {
  components: { Pageheader },
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
    let toastTimeout: ReturnType<typeof setTimeout> | undefined;
    const courseCardSelector = ".lms-course-card";
    
    // Toast
    const showToast = ref(false);
    const toastMessage = ref("");
    const toastType = ref<"success" | "error">("success");
    const showNotification = (msg: string, type: "success" | "error") => {
      if (toastTimeout) clearTimeout(toastTimeout);
      toastMessage.value = msg;
      toastType.value = type;
      showToast.value = true;
      toastTimeout = setTimeout(() => {
        showToast.value = false;
        toastTimeout = undefined;
      }, 3000);
    };

    const syncThemeMode = () => {
      if (typeof document === "undefined") return;
      const root = document.documentElement;
      const nextMode = root.getAttribute("data-theme-mode") === "dark" || root.classList.contains("dark");
      if (isDarkMode.value !== nextMode) isDarkMode.value = nextMode;
    };

    const runEntranceAnimations = () => {
      nextTick(() => {
        gsapCtx = gsap.context(() => {
          const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
          tl.from(".ev-breadcrumb", { y: -10, opacity: 0, duration: 0.42 })
            .from(".ev-hero-title", { y: 22, opacity: 0, duration: 0.58 }, "-=0.2")
            .from(".ev-hero-desc", { y: 16, opacity: 0, duration: 0.5 }, "-=0.32")
            .from(".ev-hero-tile", { opacity: 0, duration: 0.62, stagger: 0.05, ease: "power3.out" }, "-=0.34")
            .from(".lms-course-metric", { y: 16, opacity: 0, scale: 0.96, duration: 0.38, stagger: 0.07, ease: "power2.out" }, "-=0.2")
            .from(".lms-class-panel", { y: 22, opacity: 0, duration: 0.48 }, "-=0.18");
        });
      });
    };

    const animateRows = (quick = false, done?: () => void) => {
      nextTick(() => {
        const rows = Array.from(document.querySelectorAll<HTMLElement>(courseCardSelector));
        if (!rows.length) {
          done?.();
          return;
        }
        gsap.killTweensOf(rows);

        const tl = gsap.timeline({
          defaults: { duration: quick ? 0.3 : 0.36, ease: "power2.out", overwrite: "auto" },
          onComplete: done,
        });
        const gap = quick ? 0.055 : 0.07;

        rows.forEach((row, index) => {
          gsap.set(row, { y: quick ? 12 : 18, opacity: 0, scale: quick ? 0.995 : 0.99, force3D: true });
          tl.to(row, { y: 0, opacity: 1, scale: 1, clearProps: "transform,opacity" }, index * gap);
        });
      });
    };

    // Stats — derived from cache instead of separate API calls
    const materiCounts = ref<Record<string, number>>({});
    const kuisCounts = ref<Record<string, number>>({});
    let visibleStatsRequestId = 0;
    let visibleStatsIdleHandle: number | undefined;
    let skipNextPageAnimation = false;
    const materiCountKeys = ["materi_count", "count_materi", "jumlah_materi", "total_materi"];
    const materiArrayKeys = ["materi", "materi_list", "materials"];
    const kuisCountKeys = ["kuis_count", "quiz_count", "count_kuis", "count_quiz", "jumlah_kuis", "jumlah_quiz", "total_kuis", "total_quiz"];
    const kuisArrayKeys = ["kuis_list", "quiz_list", "kuis", "quiz", "quizzes"];
    const allowBackgroundDetailStats = true;
    const setKelasCounts = (kelasId: string | number, materiTotal: number, kuisTotal: number) => {
      const key = String(kelasId);
      materiCounts.value[key] = materiTotal;
      kuisCounts.value[key] = kuisTotal;
    };
    const adjustCount = (source: typeof materiCounts, kelasId: string | number | null, delta: number) => {
      if (kelasId === null) return;
      const key = String(kelasId);
      source.value[key] = Math.max(0, (source.value[key] ?? 0) + delta);
    };
    const visibleStatsInFlight = new Set<string>();

    /**
     * Load stats in parallel batches — uses getKelasDetail which caches results.
     * Subsequent expands will be instant from cache.
     */
    const isInitialLoading = ref(lmsStore.kelasList.length === 0);

    const readCount = (item: any, countKeys: string[], arrayKeys: string[]) => {
      const sources = [item, item?.data, item?.kelas, item?.detail].filter(Boolean);

      for (const key of arrayKeys) {
        for (const source of sources) {
          const value = source?.[key];
          if (Array.isArray(value)) return value.length;
        }
      }

      for (const key of countKeys) {
        for (const source of sources) {
          const value = source?.[key];
          if (value !== undefined && value !== null && value !== "") return Number(value) || 0;
        }
      }

      const countSources = sources.flatMap(source => [source?._count, source?.count, source?.counts, source?.progress]).filter(Boolean);
      for (const meta of countSources) {
        for (const key of countKeys) {
          const value = meta?.[key];
          if (value !== undefined && value !== null && value !== "") return Number(value) || 0;
        }
      }

      return 0;
    };

    const hasCountSource = (item: any, countKeys: string[], arrayKeys: string[]) => {
      const sources = [item, item?.data, item?.kelas, item?.detail].filter(Boolean);
      const countSources = sources.flatMap(source => [source, source?._count, source?.count, source?.counts, source?.progress]).filter(Boolean);

      return countSources.some(source =>
        arrayKeys.some(key => Array.isArray(source?.[key])) ||
        countKeys.some(key => source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== "")
      );
    };

    const hasKelasMateriSource = (kelas: any) =>
      hasCountSource(kelas, materiCountKeys, materiArrayKeys);

    const hasKelasKuisSource = (kelas: any) =>
      hasCountSource(kelas, kuisCountKeys, kuisArrayKeys);

    const hasStoredCount = (source: typeof materiCounts, kelasId: string | number | undefined | null) => {
      if (kelasId === undefined || kelasId === null) return false;
      return Object.prototype.hasOwnProperty.call(source.value, String(kelasId));
    };

    const readKelasMateriCount = (kelas: any) => {
      const key = String(kelas?.id ?? "");
      if (hasStoredCount(materiCounts, kelas?.id)) return materiCounts.value[key];

      const cached = lmsStore.kelasCache[key];
      if (cached) return cached.materi.length;

      return readCount(kelas, materiCountKeys, materiArrayKeys);
    };

    const readKelasKuisCount = (kelas: any) => {
      const key = String(kelas?.id ?? "");
      if (hasStoredCount(kuisCounts, kelas?.id)) return kuisCounts.value[key];

      const cached = lmsStore.kelasCache[key];
      if (cached) return cached.kuis.length;

      return readCount(kelas, kuisCountKeys, kuisArrayKeys);
    };

    const computedTotalMateri = computed(() => {
      let sum = 0;
      for (const k of lmsStore.kelasList) {
        sum += readKelasMateriCount(k);
      }
      return sum;
    });

    const computedTotalKuis = computed(() => {
      let sum = 0;
      for (const k of lmsStore.kelasList) {
        sum += readKelasKuisCount(k);
      }
      return sum;
    });

    const hydrateStatsFromKelasList = () => {
      lmsStore.kelasList.forEach((kelas: any) => {
        const key = String(kelas.id);
        if (!hasStoredCount(materiCounts, key) && hasKelasMateriSource(kelas)) {
          materiCounts.value[key] = readCount(kelas, materiCountKeys, materiArrayKeys);
        }
        if (!hasStoredCount(kuisCounts, key) && hasKelasKuisSource(kelas)) {
          kuisCounts.value[key] = readCount(kelas, kuisCountKeys, kuisArrayKeys);
        }
      });
    };

    const initStatsFromCache = () => {
      lmsStore.kelasList.forEach(k => {
        const cached = lmsStore.kelasCache[k.id];
        if (cached) {
          setKelasCounts(k.id, cached.materi.length, cached.kuis.length);
        }
      });
    };

    /**
     * Load stats in parallel batches — uses store's cache-aware fetch.
     */
    onMounted(() => {
      syncThemeMode();
      if (typeof document !== "undefined") {
        themeObserver = new MutationObserver(syncThemeMode);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-mode", "class"] });
      }
      runEntranceAnimations();
      // 1. If we have data in store, use it immediately (Instant UI)
      if (lmsStore.kelasList.length > 0) {
        hydrateStatsFromKelasList();
        initStatsFromCache();
        scheduleVisibleStatsLoad();
      }

      // 2. Refresh data in background (SWR pattern)
      lmsStore.fetchKelas().then(() => {
        isInitialLoading.value = false;
        hydrateStatsFromKelasList();
        initStatsFromCache();
        scheduleVisibleStatsLoad();
        animateRows();
      }).catch((e: any) => {
        isInitialLoading.value = false;
        if (lmsStore.kelasList.length === 0) {
          showNotification(e.message || "Gagal memuat data kelas", "error");
        }
      });
    });

    watch(currentPage, () => {
      if (skipNextPageAnimation) {
        skipNextPageAnimation = false;
        return;
      }
      animateRows(true);
    });
    watch([searchQuery, itemsPerPage], () => {
      currentPage.value = 1;
      animateRows(true);
    });
    onBeforeUnmount(() => {
      gsapCtx?.revert();
      themeObserver?.disconnect();
      if (toastTimeout) clearTimeout(toastTimeout);
      cancelVisibleStatsSchedule();
      visibleStatsRequestId++;
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

    const displayDataWithCounts = computed(() =>
      displayData.value.map((item: any) => ({
        ...item,
        materiTotal: readKelasMateriCount(item),
        kuisTotal: readKelasKuisCount(item),
      }))
    );

    const cancelVisibleStatsSchedule = () => {
      if (visibleStatsIdleHandle === undefined || typeof window === "undefined") return;
      if ("cancelIdleCallback" in window) {
        window.cancelIdleCallback(visibleStatsIdleHandle);
      } else {
        clearTimeout(visibleStatsIdleHandle);
      }
      visibleStatsIdleHandle = undefined;
    };

    const scheduleVisibleStatsLoad = () => {
      if (!allowBackgroundDetailStats) return;
      if (typeof window === "undefined") return;
      const needsStats = displayData.value.some((kelas: any) => {
        const key = String(kelas?.id ?? "");
        return (
          key &&
          !lmsStore.kelasCache[key] &&
          (!hasStoredCount(materiCounts, key) || !hasStoredCount(kuisCounts, key)) &&
          (!hasKelasMateriSource(kelas) || !hasKelasKuisSource(kelas))
        );
      });
      if (!needsStats) return;

      cancelVisibleStatsSchedule();
      const requestId = ++visibleStatsRequestId;
      const run = () => {
        visibleStatsIdleHandle = undefined;
        loadVisibleStats(requestId);
      };

      if ("requestIdleCallback" in window) {
        visibleStatsIdleHandle = window.requestIdleCallback(run, { timeout: 1200 });
      } else {
        visibleStatsIdleHandle = window.setTimeout(run, 300);
      }
    };

    const waitForBreath = () => new Promise(resolve => window.setTimeout(resolve, 120));

    const loadVisibleStats = async (requestId = visibleStatsRequestId) => {
      const pending = displayData.value.filter((kelas: any) => {
        const key = String(kelas?.id);
        return (
          key &&
          !lmsStore.kelasCache[key] &&
          !visibleStatsInFlight.has(key) &&
          (!hasStoredCount(materiCounts, key) || !hasStoredCount(kuisCounts, key)) &&
          (!hasKelasMateriSource(kelas) || !hasKelasKuisSource(kelas))
        );
      });

      for (const kelas of pending) {
        if (requestId !== visibleStatsRequestId) return;

        const key = String(kelas.id);
        visibleStatsInFlight.add(key);
        try {
          const { materi, kuis } = await lmsStore.fetchKelasDetail(kelas.id);
          if (requestId !== visibleStatsRequestId) return;
          setKelasCounts(kelas.id, materi.length, kuis.length);
        } catch {
          // Keep the list usable even if one detail/count request fails.
        } finally {
          visibleStatsInFlight.delete(key);
        }

        if (requestId !== visibleStatsRequestId) return;
        await waitForBreath();
      }
    };

    watch(
      () => displayData.value.map((kelas: any) => String(kelas.id)).join("|"),
      () => scheduleVisibleStatsLoad(),
      { flush: "post" }
    );
    watch(totalPages, (pages) => {
      if (currentPage.value > pages) currentPage.value = pages;
    });

    const goToPage = (page: number) => {
      const nextPage = Math.min(Math.max(page, 1), totalPages.value);
      if (nextPage === currentPage.value) return;
      const rows = Array.from(document.querySelectorAll<HTMLElement>(courseCardSelector));
      const changePage = () => {
        skipNextPageAnimation = true;
        currentPage.value = nextPage;
        animateRows(true);
      };
      if (!rows.length) {
        changePage();
        return;
      }
      gsap.killTweensOf(rows);
      gsap.to(rows, {
        y: -10,
        opacity: 0,
        scale: 0.995,
        duration: 0.18,
        stagger: 0.035,
        ease: "power1.in",
        overwrite: "auto",
        onComplete: changePage,
      });
    };

    // Expand logic — uses cached data when available
    const expandedKelasId = ref<string | number | null>(null);
    const classMateriList = ref<any[]>([]);
    const classKuisList = ref<any[]>([]);
    const isLoadingDetail = ref(false);
    const materiTitleById = computed(() => {
      const titles: Record<string, string> = {};
      for (const m of classMateriList.value) {
        titles[String(m.id)] = m.judul || "Materi tidak ditemukan";
      }
      return titles;
    });
    const kuisCountByMateri = computed(() => {
      const counts: Record<string, number> = {};
      for (const k of classKuisList.value) {
        if (k.id_materi === undefined || k.id_materi === null) continue;
        const key = String(k.id_materi);
        counts[key] = (counts[key] || 0) + 1;
      }
      return counts;
    });

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
          setKelasCounts(item.id, materi.length, kuis.length);
        } catch(e) {
          showNotification("Gagal memuat detail kelas", "error");
        } finally {
          isLoadingDetail.value = false;
          nextTick(() => {
            const panel = document.querySelector<HTMLElement>(".lms-expand-panel.is-open");
            if (panel) {
              gsap.fromTo(panel, { y: -8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.24, ease: "power2.out", clearProps: "transform,opacity" });
            }
          });
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
      thumbnail_file: null as File | null,
      status: 'published'
    });
    const formKelas = ref(emptyKelasForm());
    const thumbnailInput = ref<HTMLInputElement | null>(null);
    const thumbnailPreview = computed(() => {
      if (formKelas.value.thumbnail_file) return URL.createObjectURL(formKelas.value.thumbnail_file);
      return formKelas.value.thumbnail || null;
    });

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
          thumbnail_file: null,
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
      if (formKelas.value.thumbnail_file && !formKelas.value.thumbnail_file.type.startsWith('image/')) {
        formErrors.value.thumbnail = "File thumbnail harus berupa gambar";
      }
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

    const handleThumbnailChange = (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0] ?? null;
      formKelas.value.thumbnail_file = file;
      if (file) {
        formKelas.value.thumbnail = '';
        delete formErrors.value.thumbnail;
      }
    };

    const triggerThumbnailPicker = () => {
      thumbnailInput.value?.click();
    };

    const removeThumbnail = () => {
      formKelas.value.thumbnail = '';
      formKelas.value.thumbnail_file = null;
      if (thumbnailInput.value) {
        thumbnailInput.value.value = '';
      }
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
    const openKuisModal = (kelasId: string, item?: any) => {
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
          adjustCount(materiCounts, expandedKelasId.value, -1);
        } else if (deleteType.value === 'kuis') {
          await lmsStore.deleteKuis(deleteTarget.value.id);
          classKuisList.value = classKuisList.value.filter(k => k.id !== deleteTarget.value.id);
          adjustCount(kuisCounts, expandedKelasId.value, -1);
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

    const getDescriptionPreview = (value?: string) => {
      return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    };

    const getShortDescription = (value?: string, maxLength = 110) => {
      const text = getDescriptionPreview(value);
      if (!text) return "-";
      return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
    };

    const getClassTopic = (item: any) => {
      return String(item?.kategori || item?.penyelenggara || "Kelas").trim() || "Kelas";
    };

    const getClassCode = (item: any) => {
      const topic = getClassTopic(item).toLowerCase();
      const knownCodes: Record<string, string> = {
        cybersecurity: "CYB",
        "cyber security": "CYB",
        csirt: "CSIRT",
        networking: "NET",
        compliance: "COMP",
        "risk management": "RISK",
        "incident response": "IR",
        ai: "AI",
        "artificial intelligence": "AI",
      };

      if (knownCodes[topic]) return knownCodes[topic];

      const words = topic.split(/\s+/).filter(Boolean);
      if (words.length > 1) return words.map((word) => word.charAt(0)).join("").slice(0, 4).toUpperCase();
      return topic.slice(0, 4).toUpperCase() || "KLS";
    };
    
    const kategoriOptions = ref(['Cybersecurity', 'CSIRT', 'Networking', 'Compliance', 'Risk Management', 'Incident Response', 'Lainnya']);
    
    // UI Expand / Collapse Soal state
    return {
      isInitialLoading,
      isDarkMode,
      router, lmsStore, searchQuery, currentPage, itemsPerPage, filteredData, sortedData, totalPages, displayData, displayDataWithCounts,
      sortKey, sortDirection, toggleSort, getSortIcon,
      showToast, toastMessage, toastType, 
      computedTotalMateri, computedTotalKuis, materiCounts, kuisCounts,
      expandedKelasId, classMateriList, classKuisList, materiTitleById, kuisCountByMateri, toggleExpand, isLoadingDetail,
      goToPage,
      activeModal, isEdit, isSaving, formErrors,
      formKelas, openKelasModal, saveKelas,
      openMateriModal, openKuisModal,
      openDeleteModal, confirmDelete, deleteType, deleteTarget,
      getAvatarClass,
      getDescriptionPreview,
      getShortDescription,
      getClassTopic,
      getClassCode,
      thumbnailPreview, kategoriOptions,
      thumbnailInput, handleThumbnailChange, triggerThumbnailPicker, removeThumbnail
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
            <div class="ikas-hero-stat-card ev-stat-card lms-course-metric stat-total">
              <div class="ikas-stat-top ev-stat-head">
                <span>Total Kelas</span>
                <i class="ri-graduation-cap-line"></i>
              </div>
              <strong>{{ lmsStore.totalKelas }}</strong>
            </div>
            <div class="ikas-hero-stat-card ev-stat-card lms-course-metric stat-materi">
              <div class="ikas-stat-top ev-stat-head">
                <span>Materi</span>
                <i class="ri-book-open-line"></i>
              </div>
              <strong>{{ computedTotalMateri }}</strong>
            </div>
            <div class="ikas-hero-stat-card ev-stat-card lms-course-metric stat-kuis">
              <div class="ikas-stat-top ev-stat-head">
                <span>Kuis</span>
                <i class="ri-questionnaire-line"></i>
              </div>
              <strong>{{ computedTotalKuis }}</strong>
            </div>
          </div>
        </header>

        <div class="card custom-card lms-kelas-card ev-content-card lms-class-panel lms-kelas-card-shell">
          <div class="card-body p-4 stakeholders-premium-body">
            <div class="controls-bar stakeholders-toolbar stakeholders-filter-bar lms-kelas-toolbar-wrap ev-toolbar mb-4">
              <div class="stakeholders-toolbar-right lms-kelas-toolbar">
                <div class="stakeholders-per-page ev-per-page">
                  <span>Baris</span>
                  <select v-model="itemsPerPage" class="form-select form-select-sm entries-select ev-select">
                    <option v-for="n in [5, 10, 15, 20]" :key="n" :value="n">{{ n }}</option>
                  </select>
                </div>
                <div class="ikas-header-search kelas-toolbar-search ev-search">
                  <i class="ri-search-line"></i>
                  <input v-model="searchQuery" type="text" placeholder="Cari nama, kategori, penyelenggara..." />
                  <button v-if="searchQuery" @click="searchQuery = ''" class="ikas-clear-btn ev-search-clear" title="Clear search">
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
                      <span class="lms-sort-label">Kelas</span>
                      <i :class="getSortIcon('nama_kelas')"></i>
                    </button>
                  </th>
                  <th class="lms-th-description">
                    <span class="lms-th-label">Deskripsi</span>
                  </th>
                  <th class="text-center lms-th-sortable" :aria-sort="sortKey === 'status' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'">
                    <button type="button" class="lms-sort-btn lms-sort-btn-center" :class="{ active: sortKey === 'status' }" @click="toggleSort('status')" title="Urutkan status">
                      <span class="lms-sort-label">Status</span>
                      <i :class="getSortIcon('status')"></i>
                    </button>
                  </th>
                  <th class="text-center lms-th-action" style="min-width: 130px;">
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
                <template v-for="(item, i) in displayDataWithCounts" :key="item.id">
                  <tr class="stakeholder-row ev-table-row lms-course-card" :class="{ 'stakeholder-row-expanded': expandedKelasId === item.id }" @click="toggleExpand(item)">
                    <td class="align-middle text-center">
                      <span class="row-number">{{ (currentPage - 1) * itemsPerPage + i + 1 }}</span>
                    </td>
                    <td class="align-middle">
                      <div class="stakeholder-company-cell">
                        <button class="stakeholder-expand-btn" @click.stop="toggleExpand(item)" :title="expandedKelasId === item.id ? 'Tutup detail kelas' : 'Buka detail kelas'">
                          <i :class="expandedKelasId === item.id ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'"></i>
                        </button>
                        <div
                          class="company-avatar overflow-hidden lms-class-avatar"
                          :class="item.thumbnail ? '' : getAvatarClass(getClassTopic(item).charAt(0))"
                          :title="item.thumbnail ? item.nama_kelas : `Kategori: ${getClassTopic(item)}`"
                          :aria-label="item.thumbnail ? item.nama_kelas : `Kategori: ${getClassTopic(item)}`"
                        >
                          <img v-if="item.thumbnail" :src="item.thumbnail" class="w-100 h-100 object-fit-cover" alt="" />
                          <span v-else class="company-avatar-letter">{{ getClassCode(item) }}</span>
                        </div>
                        <div class="company-name-wrap">
                          <span class="company-name d-block fw-bold">{{ item.nama_kelas }}</span>
                          <span class="text-muted fs-12">{{ item.materiTotal }} Materi · {{ item.kuisTotal }} Kuis</span>
                        </div>
                      </div>
                    </td>
                    <td class="align-middle text-muted fs-13 lms-td-description">
                      <div class="lms-description-line">
                        <span class="fw-semibold text-dark lms-description-truncate" :title="getDescriptionPreview(item.deskripsi)">
                          {{ getShortDescription(item.deskripsi) }}
                        </span>
                        <button
                          type="button"
                          class="lms-inline-detail"
                          @click.stop="router.push('/lms/kelas/view/' + item.id)"
                          :aria-label="`Lihat detail kelas ${item.nama_kelas}`"
                        >
                          Lihat detail
                        </button>
                      </div>
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
                    <td class="align-middle text-center lms-td-action">
                      <div class="d-flex gap-1 justify-content-center">
                        <button @click.stop="router.push('/lms/kelas/view/' + item.id)" class="btn btn-sm btn-icon btn-wave btn-primary-light stakeholders-action-btn" data-tooltip="Lihat" aria-label="Lihat detail kelas">
                          <i class="ri-eye-line"></i>
                        </button>
                        <button @click.stop="openKelasModal(item)" class="btn btn-sm btn-icon btn-wave btn-success-light stakeholders-action-btn" data-tooltip="Edit" aria-label="Edit kelas">
                          <i class="ri-edit-2-line"></i>
                        </button>
                        <button @click.stop="openDeleteModal('kelas', item)" class="btn btn-sm btn-icon btn-wave btn-danger-light stakeholders-action-btn" data-tooltip="Hapus" aria-label="Hapus kelas">
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
                                          <span v-if="(kuisCountByMateri[m.id] || 0) > 0" class="badge bg-success-transparent text-success fs-10 fw-bold px-2 py-0-5 rounded-pill">
                                            <i class="ri-checkbox-circle-line me-1"></i> {{ kuisCountByMateri[m.id] || 0 }} Kuis
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div class="d-flex gap-1 flex-shrink-0">
                                      <button @click="openMateriModal(item.id, m)" class="btn btn-sm btn-icon btn-outline-primary rounded-circle border-0 bg-primary-transparent lms-detail-action-btn" data-tooltip="Edit materi" aria-label="Edit materi"><i class="ri-edit-line"></i></button>
                                      <button @click="openDeleteModal('materi', m)" class="btn btn-sm btn-icon btn-outline-danger rounded-circle border-0 bg-danger-transparent lms-detail-action-btn" data-tooltip="Hapus materi" aria-label="Hapus materi"><i class="ri-delete-bin-line"></i></button>
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
                                            <i class="ri-book-open-line me-1"></i> Materi: <span class="text-truncate d-inline-block align-bottom lms-materi-title-compact">{{ materiTitleById[q.id_materi] || 'Materi tidak ditemukan' }}</span>
                                          </span>
                                          <span v-else class="badge bg-success-transparent text-success fs-11 px-2 py-1 fw-bold">
                                            <i class="ri-medal-line me-1"></i> FINAL KELAS
                                          </span>
                                          <span class="text-muted fs-11 fw-bold"><i class="ri-timer-line text-muted"></i> {{ q.durasi_menit || q.durasi || 0 }} Menit</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div class="d-flex gap-1 flex-shrink-0">
                                      <button @click="openKuisModal(item.id, q)" class="btn btn-sm btn-icon btn-outline-primary rounded-circle border-0 bg-primary-transparent lms-detail-action-btn" data-tooltip="Edit kuis" aria-label="Edit kuis"><i class="ri-edit-line"></i></button>
                                      <button @click="openDeleteModal('kuis', q)" class="btn btn-sm btn-icon btn-outline-danger rounded-circle border-0 bg-danger-transparent lms-detail-action-btn" data-tooltip="Hapus kuis" aria-label="Hapus kuis"><i class="ri-delete-bin-line"></i></button>
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
              Menampilkan {{ displayData.length ? (currentPage - 1) * itemsPerPage + 1 : 0 }}-{{ Math.min(currentPage * itemsPerPage, filteredData.length) }} dari {{ filteredData.length }} kelas
            </div>
            <div class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
              <span class="stakeholders-page-pill">Halaman {{ currentPage }} dari {{ totalPages || 1 }}</span>
              <nav v-if="totalPages > 1">
                <ul class="pagination pagination-sm mb-0 gap-1">
                  <li class="page-item" :class="{ disabled: currentPage === 1 }"><a class="page-link rounded-circle" href="#" @click.prevent="goToPage(currentPage - 1)"><i class="ri-arrow-left-s-line"></i></a></li>
                  <template v-for="p in totalPages" :key="p">
                    <li v-if="p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)" class="page-item" :class="{ active: p === currentPage }">
                      <a class="page-link rounded-circle" href="#" @click.prevent="goToPage(p)">{{ p }}</a>
                    </li>
                    <li v-else-if="p === currentPage - 2 || p === currentPage + 2" class="page-item disabled"><span class="page-link border-0 bg-transparent">...</span></li>
                  </template>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }"><a class="page-link rounded-circle" href="#" @click.prevent="goToPage(currentPage + 1)"><i class="ri-arrow-right-s-line"></i></a></li>
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
      class="modal-dialog modal-dialog-centered lms-kelas-modal-size kelas-modal-dialog lms-kelas-modal-shell"
    >
      <div class="modal-content border-0 bg-transparent kelas-modal-content lms-kelas-modal-content-shell">
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
                <label class="form-label fw-semibold">Thumbnail Kelas</label>

                <div class="d-flex flex-column gap-3 kelas-thumbnail-field">
                  <input
                    ref="thumbnailInput"
                    type="file"
                    class="d-none"
                    accept="image/*"
                    @change="handleThumbnailChange"
                  />

                  <div v-if="thumbnailPreview" class="thumbnail-preview-box kelas-thumbnail-preview rounded-4 border p-2 bg-light d-flex align-items-center justify-content-center overflow-hidden position-relative">
                    <img :src="thumbnailPreview" class="w-100 h-100 object-fit-cover rounded-3" alt="Preview" @error="removeThumbnail" />
                    <button @click="removeThumbnail" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 rounded-circle" style="width: 28px; height: 28px; padding: 0;">
                      <i class="ri-close-line"></i>
                    </button>
                  </div>
                  <div v-else class="thumbnail-placeholder kelas-thumbnail-preview rounded-4 border-dashed p-4 text-center bg-light">
                    <i class="ri-image-add-line fs-1 text-muted opacity-50"></i>
                    <p class="text-muted fs-12 mb-0">Pilih gambar dari device untuk thumbnail kelas</p>
                  </div>

                  <div class="d-flex flex-wrap gap-2">
                    <button type="button" class="btn btn-outline-primary btn-sm" @click="triggerThumbnailPicker">
                      <i class="ri-upload-2-line me-1"></i>{{ thumbnailPreview ? 'Ganti Gambar' : 'Upload Gambar' }}
                    </button>
                    <button v-if="thumbnailPreview" type="button" class="btn btn-outline-danger btn-sm" @click="removeThumbnail">
                      <i class="ri-delete-bin-line me-1"></i>Hapus
                    </button>
                  </div>

                  <div v-if="formKelas.thumbnail_file" class="small text-success">
                    <i class="ri-check-line"></i> {{ formKelas.thumbnail_file.name }} siap diupload
                  </div>
                  <div v-if="formErrors.thumbnail" class="text-danger small">{{ formErrors.thumbnail }}</div>
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

.lms-kelas-modal-shell {
  max-width: 900px !important;
  margin: 1rem auto !important;
  width: min(90vw, 900px) !important;
}

.lms-kelas-modal-content-shell {
  max-width: none !important;
  width: 100% !important;
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

.lms-kelas-card-shell {
  overflow: visible !important;
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
  min-width: 200px;
  max-width: 380px;
}

.lms-th-action {
  min-width: 130px;
  white-space: nowrap;
}

.lms-td-description {
  max-width: 380px;
}

.lms-td-action {
  white-space: nowrap;
  min-width: 130px;
}

.lms-description-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  width: 100%;
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
  min-width: 116px;
  padding: 10px 12px !important;
}

.lms-kelas-page .ev-stat-head span,
.lms-kelas-page .ev-stat-card strong {
  color: #fff;
}

.lms-kelas-page .ev-stat-head i {
  color: #fde68a;
}

.lms-kelas-page .ev-hero-stats {
  gap: 8px;
}

.lms-kelas-page .ev-stat-head {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  min-height: 18px;
  width: 100%;
}

.lms-kelas-page .ev-stat-head span {
  font-size: 11px;
  letter-spacing: 0;
}

.lms-kelas-page .ev-stat-card strong {
  font-size: 24px;
  line-height: 1;
}

.lms-kelas-page .ev-stat-head i {
  font-size: 16px;
  line-height: 1;
  margin-left: 8px;
  transform: translateY(-1px);
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
    gap: 10px;
    width: 100%;
  }

  .ikas-hero-stat-card {
    flex: 1 1 calc(33.333% - 7px);
    width: auto;
    min-width: 0;
    min-height: 72px;
    gap: 10px;
    padding: 12px 10px;
  }

  .ikas-stat-top {
    gap: 8px;
  }

  .ikas-stat-top span {
    font-size: 9px;
    line-height: 1.2;
  }

  .ikas-stat-top i {
    font-size: 18px;
  }

  .ikas-hero-stat-card strong {
    font-size: 22px;
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

@media (max-width: 480px) {
  .ikas-hero-header {
    padding: 16px;
  }

  .ikas-hero-tools {
    gap: 8px;
  }

  .ikas-hero-stat-card {
    min-height: 64px;
    padding: 10px 8px;
    border-radius: 6px;
  }

  .ikas-stat-top span {
    font-size: 8px;
  }

  .ikas-stat-top i {
    font-size: 16px;
  }

  .ikas-hero-stat-card strong {
    font-size: 18px;
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
  scrollbar-color: #3b82f6 transparent;
}

.lms-kelas-page.is-dark .stakeholder-table-wrap::-webkit-scrollbar-thumb {
  background: #1e3a8a;
  border: 1px solid #0f172a;
}

.lms-kelas-page.is-dark .stakeholder-table-wrap::-webkit-scrollbar-thumb:hover {
  background: #2563eb;
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

/* Fresh LMS class list treatment */
.lms-kelas-page .ev-hero {
  background:
    linear-gradient(135deg, rgba(14, 116, 144, 0.94) 0%, rgba(37, 99, 235, 0.96) 48%, rgba(124, 58, 237, 0.9) 100%) !important;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 18px;
}

.lms-kelas-page .lms-class-panel {
  background: #f8fbff !important;
  border: 1px solid #d7e3f5 !important;
  border-radius: 18px !important;
  box-shadow: 0 22px 52px rgba(15, 23, 42, 0.08) !important;
}

.lms-kelas-page .lms-kelas-toolbar-wrap {
  background: #ffffff !important;
  border: 1px solid #e3eaf5 !important;
  border-radius: 16px !important;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06) !important;
}

.lms-kelas-page .kelas-toolbar-search {
  background: #f6f9fd !important;
  border: 1px solid #dce7f5 !important;
  border-radius: 12px !important;
  height: 42px;
}

.lms-kelas-page .entries-select {
  background-color: #f6f9fd;
  border-color: #dce7f5;
  border-radius: 10px;
  min-width: 72px;
}

.lms-kelas-page .stakeholders-add-btn {
  background: linear-gradient(135deg, #0f766e, #2563eb) !important;
  border-radius: 12px !important;
  box-shadow: 0 14px 26px rgba(15, 118, 110, 0.18) !important;
}

.lms-kelas-page .stakeholder-table-wrap {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  padding: 0 0 10px 0 !important;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: #93c5fd transparent;
}

.lms-kelas-page .stakeholder-table-wrap::-webkit-scrollbar {
  height: 8px;
}

.lms-kelas-page .stakeholder-table-wrap::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 8px;
}

.lms-kelas-page .stakeholder-table-wrap::-webkit-scrollbar-thumb {
  background: #93c5fd;
  border-radius: 8px;
}

.lms-kelas-page .stakeholder-table-wrap::-webkit-scrollbar-thumb:hover {
  background: #3b82f6;
}

.lms-kelas-page .stakeholder-table {
  border-collapse: separate;
  border-spacing: 0 12px !important;
  min-width: 760px;
  width: 100%;
}

.lms-kelas-page .stakeholder-table thead th {
  background: #10233f !important;
  box-shadow: none !important;
  padding-block: 8px !important;
}

.lms-kelas-page .stakeholder-table thead th:first-child {
  border-radius: 14px 0 0 14px !important;
}

.lms-kelas-page .stakeholder-table thead th:last-child {
  border-radius: 0 14px 14px 0 !important;
}

.lms-kelas-page .lms-course-card td {
  background: #ffffff !important;
  border-bottom: 1px solid #e1eaf6 !important;
  border-top: 1px solid #e1eaf6 !important;
  padding-block: 18px !important;
  transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.lms-kelas-page .lms-course-card {
  cursor: pointer;
}

.lms-kelas-page .lms-course-card td:first-child {
  border-left: 4px solid #0f766e !important;
  border-radius: 16px 0 0 16px !important;
}

.lms-kelas-page .lms-course-card td:last-child {
  border-radius: 0 16px 16px 0 !important;
  border-right: 1px solid #e1eaf6 !important;
}

.lms-kelas-page .lms-course-card:hover td,
.lms-kelas-page .lms-course-card.stakeholder-row-expanded td {
  background: #f6fbff !important;
  border-color: #bfdbfe !important;
  box-shadow: 0 16px 34px rgba(37, 99, 235, 0.1);
}

.lms-kelas-page .lms-course-card.stakeholder-row-expanded td:first-child {
  border-left-color: #f59e0b !important;
}

.lms-kelas-page .row-number {
  color: #64748b;
  font-weight: 900;
}

.lms-kelas-page .stakeholder-company-cell {
  gap: 14px;
}

.lms-kelas-page .stakeholder-expand-btn {
  background: #eef6ff !important;
  border: 1px solid #d8e8fb !important;
  color: #2563eb !important;
  transition: transform 180ms ease, background 180ms ease;
}

.lms-kelas-page .stakeholder-row-expanded .stakeholder-expand-btn {
  background: #fff7ed !important;
  border-color: #fed7aa !important;
  color: #f97316 !important;
  transform: rotate(90deg);
}

.lms-kelas-page .company-avatar {
  border-radius: 14px !important;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.11);
}

.lms-kelas-page .company-name {
  color: #10233f;
  font-size: 14px;
  line-height: 1.35;
}

.lms-kelas-page .lms-description-truncate {
  color: #26364d !important;
  font-weight: 700 !important;
}

.lms-kelas-page .lms-materi-title-compact {
  max-width: 80px;
}

.lms-kelas-page .badge-sektor {
  align-items: center;
  border-radius: 999px;
  display: inline-flex;
  font-weight: 800;
  min-height: 30px;
  padding: 7px 14px;
}

.lms-kelas-page .badge-sektor-teal {
  background: #ccfbf1 !important;
  border: 1px solid #5eead4;
  color: #0f766e !important;
}

.lms-kelas-page .badge-sektor-amber {
  background: #fffbeb !important;
  border: 1px solid #fcd34d;
  color: #b45309 !important;
}

.lms-kelas-page .stakeholders-action-btn {
  border-radius: 10px !important;
  height: 34px;
  width: 34px;
}



.lms-kelas-page .stakeholder-expanded-wrapper {
  background: linear-gradient(180deg, #f8fbff, #eef7ff) !important;
  border: 1px solid #d7e7ff !important;
  border-radius: 16px !important;
  margin: -4px 0 10px;
  padding: 16px !important;
}

.lms-kelas-page .stakeholder-inner-card {
  background: #ffffff !important;
  border: 1px solid #e0e9f6 !important;
  border-radius: 14px !important;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
}

.lms-kelas-page .stakeholder-detail-list-item {
  background: #f8fbff !important;
  border: 1px solid #edf3fb !important;
  margin-bottom: 8px !important;
}

.lms-kelas-page .pagination-container {
  background: transparent;
  border: 0;
  padding-top: 2px;
}

.lms-kelas-page.is-dark .lms-class-panel,
[data-theme-mode="dark"] .lms-kelas-page .lms-class-panel,
html.dark .lms-kelas-page .lms-class-panel {
  background: #0b1220 !important;
  border-color: #22314a !important;
}

.lms-kelas-page.is-dark .lms-kelas-toolbar-wrap,
[data-theme-mode="dark"] .lms-kelas-page .lms-kelas-toolbar-wrap,
html.dark .lms-kelas-page .lms-kelas-toolbar-wrap {
  background: #111c2e !important;
  border-color: #22314a !important;
}

.lms-kelas-page.is-dark .lms-course-card td,
[data-theme-mode="dark"] .lms-kelas-page .lms-course-card td,
html.dark .lms-kelas-page .lms-course-card td {
  background: #111c2e !important;
  border-color: #22314a !important;
}

.lms-kelas-page.is-dark .lms-course-card:hover td,
.lms-kelas-page.is-dark .lms-course-card.stakeholder-row-expanded td,
[data-theme-mode="dark"] .lms-kelas-page .lms-course-card:hover td,
[data-theme-mode="dark"] .lms-kelas-page .lms-course-card.stakeholder-row-expanded td,
html.dark .lms-kelas-page .lms-course-card:hover td,
html.dark .lms-kelas-page .lms-course-card.stakeholder-row-expanded td {
  background: #14243a !important;
  border-color: rgba(96, 165, 250, 0.38) !important;
}

@media (max-width: 768px) {
  .lms-kelas-page .lms-kelas-card .stakeholders-premium-body {
    padding: 14px !important;
  }

  .lms-kelas-page .stakeholder-table {
    min-width: 760px;
  }
}

/* Final LMS table spacing + color tuning */
.lms-kelas-page .ev-hero {
  background: linear-gradient(135deg, #0f1f57 0%, #2454d8 52%, #0ea5e9 100%) !important;
  border: none !important;
  box-shadow: 0 22px 58px rgba(37, 84, 216, 0.24) !important;
}

.lms-kelas-page .lms-kelas-card .stakeholders-premium-body {
  padding: 14px 16px 12px !important;
}

.lms-kelas-page .lms-class-panel {
  background: linear-gradient(180deg, #ffffff 0%, #f6f9fc 100%) !important;
  border-color: #dde8f2 !important;
  border-radius: 16px !important;
}

.lms-kelas-page .lms-kelas-toolbar-wrap {
  margin-bottom: 12px !important;
  padding: 10px !important;
  border-radius: 14px !important;
  background: #ffffff !important;
  border-color: #e1e9f2 !important;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.05) !important;
}

.lms-kelas-page .lms-kelas-toolbar {
  gap: 10px !important;
}

.lms-kelas-page .stakeholders-per-page {
  min-height: 40px !important;
}

.lms-kelas-page .stakeholders-per-page span {
  font-size: 11px !important;
}

.lms-kelas-page .entries-select {
  height: 34px !important;
  padding-block: 4px !important;
}

.lms-kelas-page .kelas-toolbar-search {
  background: #f8fafc !important;
  border-color: #d8e3ee !important;
  flex-basis: 430px !important;
  height: 40px !important;
  max-width: 560px !important;
}

.lms-kelas-page .stakeholders-add-btn {
  background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%) !important;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.18) !important;
  min-height: 40px !important;
  padding: 9px 15px !important;
}

.lms-kelas-page .stakeholder-table {
  border-spacing: 0 8px !important;
}

.lms-kelas-page .stakeholder-table thead th {
  background: linear-gradient(180deg, #f8fafc 0%, #edf4fb 100%) !important;
  color: #23405c !important;
  border-bottom: 1px solid #d5e2ef !important;
  padding-block: 6px !important;
}

.lms-kelas-page .lms-th-label,
.lms-kelas-page .lms-sort-btn {
  min-height: 36px !important;
  color: #23405c !important;
}

.lms-kelas-page .lms-sort-btn i {
  color: #647f9a !important;
}

.lms-kelas-page .lms-sort-btn:hover,
.lms-kelas-page .lms-sort-btn.active {
  background: #ffffff !important;
  color: #0f5f8d !important;
  box-shadow: inset 0 0 0 1px #cbdff0 !important;
}

.lms-kelas-page .lms-course-card td {
  background: #ffffff !important;
  border-color: #e3ebf3 !important;
  padding-bottom: 12px !important;
  padding-top: 12px !important;
}

.lms-kelas-page .lms-course-card td:first-child {
  border-left-color: #2563eb !important;
}

.lms-kelas-page .lms-course-card:hover td,
.lms-kelas-page .lms-course-card.stakeholder-row-expanded td {
  background: #f7fbff !important;
  border-color: #c9dff2 !important;
  box-shadow: 0 12px 26px rgba(15, 71, 123, 0.08) !important;
}

.lms-kelas-page .company-name {
  color: #172a41 !important;
}

.lms-kelas-page .lms-description-truncate {
  color: #405168 !important;
}

.lms-kelas-page .stakeholder-expand-btn {
  background: #eef6ff !important;
  border-color: #d5e7f7 !important;
  color: #2563eb !important;
}

.lms-kelas-page .stakeholder-row-expanded .stakeholder-expand-btn {
  background: #ecfeff !important;
  border-color: #a5f3fc !important;
  color: #0891b2 !important;
}

.lms-kelas-page .badge-sektor-teal {
  background: #ecfdf5 !important;
  border-color: #a7f3d0 !important;
  color: #047857 !important;
}

.lms-kelas-page .badge-sektor-amber {
  background: #fff7ed !important;
  border-color: #fed7aa !important;
  color: #c2410c !important;
}

.lms-kelas-page .stakeholder-expanded-wrapper {
  background: linear-gradient(180deg, #ffffff 0%, #f5fafc 100%) !important;
  border-color: #dbe8f3 !important;
}

.lms-kelas-page .stakeholder-inner-card {
  background: #ffffff !important;
  border-color: #e2ebf4 !important;
}

.lms-kelas-page .stakeholder-detail-list-item {
  background: #f8fbfe !important;
  border-color: #edf3f8 !important;
}

.lms-kelas-page.is-dark .lms-class-panel,
[data-theme-mode="dark"] .lms-kelas-page .lms-class-panel,
html.dark .lms-kelas-page .lms-class-panel {
  background: #0b1220 !important;
  border-color: #22314a !important;
}

.lms-kelas-page.is-dark .lms-kelas-toolbar-wrap,
[data-theme-mode="dark"] .lms-kelas-page .lms-kelas-toolbar-wrap,
html.dark .lms-kelas-page .lms-kelas-toolbar-wrap {
  background: #111c2e !important;
  border-color: #22314a !important;
}

.lms-kelas-page.is-dark .stakeholder-table thead th,
[data-theme-mode="dark"] .lms-kelas-page .stakeholder-table thead th,
html.dark .lms-kelas-page .stakeholder-table thead th {
  background: linear-gradient(180deg, #1e3a8a 0%, #1d4ed8 100%) !important;
  border-color: transparent !important;
  color: #ffffff !important;
}

.lms-kelas-page.is-dark .lms-course-card td,
[data-theme-mode="dark"] .lms-kelas-page .lms-course-card td,
html.dark .lms-kelas-page .lms-course-card td {
  background: #111c2e !important;
  border-color: #22314a !important;
}

.lms-kelas-page .stakeholder-expanded-wrapper {
  margin-top: -2px !important;
}

.lms-kelas-page .pagination-container {
  margin-top: 2px !important;
}

/* UX clarity refinements */
.lms-kelas-page .lms-sort-btn {
  gap: 6px !important;
  justify-content: flex-start !important;
  padding-inline: 10px !important;
  width: auto !important;
}

.lms-kelas-page .lms-sort-btn-center {
  margin-inline: auto !important;
}

.lms-kelas-page .lms-sort-label {
  line-height: 1;
}

.lms-kelas-page .lms-class-avatar .company-avatar-letter {
  font-size: 11px;
  letter-spacing: 0.02em;
  line-height: 1;
  padding-inline: 2px;
  text-align: center;
}

.lms-kelas-page .lms-description-line {
  align-items: center;
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  min-width: 0;
}

.lms-kelas-page .lms-description-line .lms-description-truncate {
  flex: 1 1 auto;
  min-width: 90px;
  width: auto;
}

.lms-kelas-page .lms-inline-detail {
  background: transparent;
  border: 0;
  color: #1d4ed8;
  cursor: pointer;
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.2;
  padding: 2px 0;
}

.lms-kelas-page .lms-inline-detail:hover,
.lms-kelas-page .lms-inline-detail:focus-visible {
  color: #0f766e;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.lms-kelas-page .stakeholders-action-btn,
.lms-kelas-page .lms-detail-action-btn {
  overflow: visible;
  position: relative;
}

.lms-kelas-page .lms-detail-action-btn {
  height: 32px;
  width: 32px;
}

.lms-kelas-page .stakeholders-action-btn[data-tooltip]::after,
.lms-kelas-page .lms-detail-action-btn[data-tooltip]::after {
  background: #0f172a;
  border-radius: 8px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.2);
  color: #ffffff;
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
  z-index: 30;
}

.lms-kelas-page .stakeholders-action-btn[data-tooltip]::after {
  bottom: auto;
  left: auto;
  right: calc(100% + 9px);
  top: 50%;
  transform: translate(4px, -50%);
}

.lms-kelas-page .lms-detail-action-btn[data-tooltip]::after {
  bottom: calc(100% + 9px);
}

.lms-kelas-page .stakeholders-action-btn[data-tooltip]::before,
.lms-kelas-page .lms-detail-action-btn[data-tooltip]::before {
  border: 5px solid transparent;
  content: "";
  left: 50%;
  opacity: 0;
  pointer-events: none;
  position: absolute;
  transform: translate(-50%, 4px);
  transition: opacity 160ms ease, transform 160ms ease;
  z-index: 31;
}

.lms-kelas-page .stakeholders-action-btn[data-tooltip]::before {
  border-left-color: #0f172a;
  bottom: auto;
  left: auto;
  right: calc(100% - 1px);
  top: 50%;
  transform: translate(4px, -50%);
}

.lms-kelas-page .lms-detail-action-btn[data-tooltip]::before {
  border-top-color: #0f172a;
  bottom: calc(100% + 4px);
}

.lms-kelas-page .stakeholders-action-btn[data-tooltip]:hover::after,
.lms-kelas-page .stakeholders-action-btn[data-tooltip]:focus-visible::after,
.lms-kelas-page .stakeholders-action-btn[data-tooltip]:hover::before,
.lms-kelas-page .stakeholders-action-btn[data-tooltip]:focus-visible::before,
.lms-kelas-page .lms-detail-action-btn[data-tooltip]:hover::after,
.lms-kelas-page .lms-detail-action-btn[data-tooltip]:focus-visible::after,
.lms-kelas-page .lms-detail-action-btn[data-tooltip]:hover::before,
.lms-kelas-page .lms-detail-action-btn[data-tooltip]:focus-visible::before {
  opacity: 1;
  transform: translate(-50%, 0);
}

.lms-kelas-page .stakeholders-action-btn[data-tooltip]:hover::after,
.lms-kelas-page .stakeholders-action-btn[data-tooltip]:focus-visible::after,
.lms-kelas-page .stakeholders-action-btn[data-tooltip]:hover::before,
.lms-kelas-page .stakeholders-action-btn[data-tooltip]:focus-visible::before {
  transform: translate(0, -50%);
}

@media (max-width: 640px) {
  .lms-kelas-page .lms-description-line {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .lms-kelas-page .lms-description-line .lms-description-truncate {
    min-width: 0;
    width: 100%;
  }
}

@media (max-width: 768px) {
  .lms-kelas-page .lms-kelas-card .stakeholders-premium-body {
    padding: 12px !important;
  }

  .lms-kelas-page .lms-kelas-toolbar-wrap {
    margin-bottom: 10px !important;
    padding: 10px !important;
    width: 100% !important;
  }

  .lms-kelas-page .lms-kelas-toolbar {
    align-items: stretch !important;
    flex-direction: column !important;
    gap: 10px !important;
    width: 100% !important;
  }

  .lms-kelas-page .kelas-toolbar-search.ev-search {
    flex: 0 0 auto !important;
    flex-basis: auto !important;
    height: 40px !important;
    max-height: 40px !important;
    max-width: none !important;
    min-height: 40px !important;
    min-width: 0 !important;
    width: 100% !important;
  }

  .lms-kelas-page .kelas-toolbar-search.ev-search input {
    height: 100% !important;
    min-height: 0 !important;
  }

  .lms-kelas-page .ev-btn-add {
    justify-content: center !important;
    margin-left: 0 !important;
    width: 100% !important;
  }

  .lms-kelas-page .ev-stat-card {
    min-width: 0;
    width: 100%;
  }
}

/* Dark mode overrides must live at the end so they win against the light defaults above */
.lms-kelas-page.is-dark .ev-hero,
[data-theme-mode="dark"] .lms-kelas-page .ev-hero,
html.dark .lms-kelas-page .ev-hero {
  background:
    radial-gradient(circle at 20% 18%, rgba(56, 189, 248, 0.16), transparent 30%),
    radial-gradient(circle at 78% 12%, rgba(59, 130, 246, 0.14), transparent 26%),
    linear-gradient(135deg, #07111f 0%, #0f1d34 48%, #12365c 100%) !important;
  border: 1px solid rgba(96, 165, 250, 0.14) !important;
  box-shadow: 0 22px 54px rgba(2, 6, 23, 0.38) !important;
}

.lms-kelas-page.is-dark .ev-content-card,
[data-theme-mode="dark"] .lms-kelas-page .ev-content-card,
html.dark .lms-kelas-page .ev-content-card {
  background: linear-gradient(180deg, #0b1220 0%, #111827 100%) !important;
  border-color: #22314a !important;
  box-shadow: 0 22px 54px rgba(2, 6, 23, 0.34) !important;
}

.lms-kelas-page.is-dark .ev-toolbar,
[data-theme-mode="dark"] .lms-kelas-page .ev-toolbar,
html.dark .lms-kelas-page .ev-toolbar {
  background: rgba(15, 23, 42, 0.78) !important;
  border-color: rgba(51, 65, 85, 0.9) !important;
  box-shadow: none !important;
}

.lms-kelas-page.is-dark .ev-search,
[data-theme-mode="dark"] .lms-kelas-page .ev-search,
html.dark .lms-kelas-page .ev-search {
  background: #0b1220 !important;
  border-color: #22314a !important;
}

.lms-kelas-page.is-dark .ev-search input,
[data-theme-mode="dark"] .lms-kelas-page .ev-search input,
html.dark .lms-kelas-page .ev-search input {
  color: #e2e8f0 !important;
}

.lms-kelas-page.is-dark .ev-search input::placeholder,
[data-theme-mode="dark"] .lms-kelas-page .ev-search input::placeholder,
html.dark .lms-kelas-page .ev-search input::placeholder {
  color: #64748b !important;
}

.lms-kelas-page.is-dark .ev-btn-add,
[data-theme-mode="dark"] .lms-kelas-page .ev-btn-add,
html.dark .lms-kelas-page .ev-btn-add {
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.24) !important;
}

.lms-kelas-page.is-dark .ev-stat-card,
[data-theme-mode="dark"] .lms-kelas-page .ev-stat-card,
html.dark .lms-kelas-page .ev-stat-card {
  background: rgba(15, 23, 42, 0.58) !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
  box-shadow: 0 16px 34px rgba(2, 6, 23, 0.24) !important;
}

.lms-kelas-page.is-dark .ev-stat-head span,
.lms-kelas-page.is-dark .ev-stat-card strong,
[data-theme-mode="dark"] .lms-kelas-page .ev-stat-head span,
[data-theme-mode="dark"] .lms-kelas-page .ev-stat-card strong,
html.dark .lms-kelas-page .ev-stat-head span,
html.dark .lms-kelas-page .ev-stat-card strong {
  color: #f8fafc !important;
}

.lms-kelas-page.is-dark .ev-stat-head i,
[data-theme-mode="dark"] .lms-kelas-page .ev-stat-head i,
html.dark .lms-kelas-page .ev-stat-head i {
  color: #fde68a !important;
}

.lms-kelas-page.is-dark .stakeholder-table-wrap,
[data-theme-mode="dark"] .lms-kelas-page .stakeholder-table-wrap,
html.dark .lms-kelas-page .stakeholder-table-wrap {
  background: linear-gradient(180deg, #0b1220 0%, #0f1a2d 100%) !important;
  border-color: #22314a !important;
}

.lms-kelas-page.is-dark .stakeholder-table thead th,
[data-theme-mode="dark"] .lms-kelas-page .stakeholder-table thead th,
html.dark .lms-kelas-page .stakeholder-table thead th {
  background: linear-gradient(180deg, #142a4a 0%, #1d3b64 100%) !important;
  border-color: #284664 !important;
  color: #eaf2ff !important;
}

.lms-kelas-page.is-dark .lms-th-label,
.lms-kelas-page.is-dark .lms-sort-btn,
[data-theme-mode="dark"] .lms-kelas-page .lms-th-label,
[data-theme-mode="dark"] .lms-kelas-page .lms-sort-btn,
html.dark .lms-kelas-page .lms-th-label,
html.dark .lms-kelas-page .lms-sort-btn {
  color: #eaf2ff !important;
}

.lms-kelas-page.is-dark .lms-sort-btn i,
[data-theme-mode="dark"] .lms-kelas-page .lms-sort-btn i,
html.dark .lms-kelas-page .lms-sort-btn i {
  color: #bfdbfe !important;
}

.lms-kelas-page.is-dark .lms-sort-btn:hover,
.lms-kelas-page.is-dark .lms-sort-btn.active,
[data-theme-mode="dark"] .lms-kelas-page .lms-sort-btn:hover,
[data-theme-mode="dark"] .lms-kelas-page .lms-sort-btn.active,
html.dark .lms-kelas-page .lms-sort-btn:hover,
html.dark .lms-kelas-page .lms-sort-btn.active {
  background: rgba(255, 255, 255, 0.08) !important;
  box-shadow: inset 0 0 0 1px rgba(191, 219, 254, 0.24) !important;
}

.lms-kelas-page.is-dark .lms-course-card td,
[data-theme-mode="dark"] .lms-kelas-page .lms-course-card td,
html.dark .lms-kelas-page .lms-course-card td {
  background: #111c2e !important;
  border-color: #22314a !important;
  color: #e2e8f0 !important;
}

.lms-kelas-page.is-dark .lms-course-card:hover td,
.lms-kelas-page.is-dark .lms-course-card.stakeholder-row-expanded td,
[data-theme-mode="dark"] .lms-kelas-page .lms-course-card:hover td,
[data-theme-mode="dark"] .lms-kelas-page .lms-course-card.stakeholder-row-expanded td,
html.dark .lms-kelas-page .lms-course-card:hover td,
html.dark .lms-kelas-page .lms-course-card.stakeholder-row-expanded td {
  background: #14243a !important;
  border-color: rgba(96, 165, 250, 0.38) !important;
}

.lms-kelas-page.is-dark .company-name,
.lms-kelas-page.is-dark .lms-description-truncate,
[data-theme-mode="dark"] .lms-kelas-page .company-name,
[data-theme-mode="dark"] .lms-kelas-page .lms-description-truncate,
html.dark .lms-kelas-page .company-name,
html.dark .lms-kelas-page .lms-description-truncate {
  color: #f8fafc !important;
}

.lms-kelas-page.is-dark .row-number,
[data-theme-mode="dark"] .lms-kelas-page .row-number,
html.dark .lms-kelas-page .row-number {
  color: #cbd5e1 !important;
}

.lms-kelas-page.is-dark .stakeholder-expand-btn,
[data-theme-mode="dark"] .lms-kelas-page .stakeholder-expand-btn,
html.dark .lms-kelas-page .stakeholder-expand-btn {
  background: #0f1a2d !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
  color: #93c5fd !important;
}

.lms-kelas-page.is-dark .stakeholder-row-expanded .stakeholder-expand-btn,
[data-theme-mode="dark"] .lms-kelas-page .stakeholder-row-expanded .stakeholder-expand-btn,
html.dark .lms-kelas-page .stakeholder-row-expanded .stakeholder-expand-btn {
  background: rgba(8, 145, 178, 0.16) !important;
  border-color: rgba(103, 232, 249, 0.28) !important;
  color: #67e8f9 !important;
}

.lms-kelas-page.is-dark .badge-sektor-teal,
[data-theme-mode="dark"] .lms-kelas-page .badge-sektor-teal,
html.dark .lms-kelas-page .badge-sektor-teal {
  background: rgba(4, 120, 87, 0.18) !important;
  border-color: rgba(110, 231, 183, 0.22) !important;
  color: #6ee7b7 !important;
}

.lms-kelas-page.is-dark .badge-sektor-amber,
[data-theme-mode="dark"] .lms-kelas-page .badge-sektor-amber,
html.dark .lms-kelas-page .badge-sektor-amber {
  background: rgba(180, 83, 9, 0.18) !important;
  border-color: rgba(253, 186, 116, 0.24) !important;
  color: #fdba74 !important;
}

.lms-kelas-page.is-dark .stakeholder-expanded-wrapper,
[data-theme-mode="dark"] .lms-kelas-page .stakeholder-expanded-wrapper,
html.dark .lms-kelas-page .stakeholder-expanded-wrapper {
  background: #0b1220 !important;
  border-color: #22314a !important;
}

.lms-kelas-page.is-dark .stakeholder-inner-card,
[data-theme-mode="dark"] .lms-kelas-page .stakeholder-inner-card,
html.dark .lms-kelas-page .stakeholder-inner-card {
  background: #0f172a !important;
  border-color: #22314a !important;
}

.lms-kelas-page.is-dark .stakeholder-detail-list-item,
.lms-kelas-page.is-dark .list-group .bg-light,
[data-theme-mode="dark"] .lms-kelas-page .stakeholder-detail-list-item,
[data-theme-mode="dark"] .lms-kelas-page .list-group .bg-light,
html.dark .lms-kelas-page .stakeholder-detail-list-item,
html.dark .lms-kelas-page .list-group .bg-light {
  background: #111c2e !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
  color: #dbeafe !important;
}

.lms-kelas-page.is-dark .lms-inline-detail,
[data-theme-mode="dark"] .lms-kelas-page .lms-inline-detail,
html.dark .lms-kelas-page .lms-inline-detail {
  color: #93c5fd !important;
}

.lms-kelas-page.is-dark .lms-inline-detail:hover,
.lms-kelas-page.is-dark .lms-inline-detail:focus-visible,
[data-theme-mode="dark"] .lms-kelas-page .lms-inline-detail:hover,
[data-theme-mode="dark"] .lms-kelas-page .lms-inline-detail:focus-visible,
html.dark .lms-kelas-page .lms-inline-detail:hover,
html.dark .lms-kelas-page .lms-inline-detail:focus-visible {
  color: #67e8f9 !important;
}

.lms-kelas-page.is-dark .stakeholders-pagination-copy,
.lms-kelas-page.is-dark .stakeholders-page-pill,
[data-theme-mode="dark"] .lms-kelas-page .stakeholders-pagination-copy,
[data-theme-mode="dark"] .lms-kelas-page .stakeholders-page-pill,
html.dark .lms-kelas-page .stakeholders-pagination-copy,
html.dark .lms-kelas-page .stakeholders-page-pill {
  color: #bfdbfe !important;
}

.lms-kelas-page.is-dark .pagination .page-link,
[data-theme-mode="dark"] .lms-kelas-page .pagination .page-link,
html.dark .lms-kelas-page .pagination .page-link {
  background: #0b1628 !important;
  border-color: rgba(96, 165, 250, 0.22) !important;
  color: #bfdbfe !important;
}

.lms-kelas-page.is-dark .pagination .page-item.active .page-link,
[data-theme-mode="dark"] .lms-kelas-page .pagination .page-item.active .page-link,
html.dark .lms-kelas-page .pagination .page-item.active .page-link {
  background: #2563eb !important;
  border-color: #2563eb !important;
  color: #ffffff !important;
}

/* Consistent LMS row surface */
.lms-kelas-page .lms-course-card {
  --lms-row-bg: #f8fbff;
  --lms-row-hover-bg: #eff6ff;
  --lms-row-border: #d7e7ff;
  --lms-row-hover-border: #b9d7fb;
  --lms-row-accent: #2563eb;
  --bs-table-accent-bg: transparent !important;
  --bs-table-bg: var(--lms-row-bg) !important;
  --bs-table-bg-state: transparent !important;
  --bs-table-bg-type: transparent !important;
  --bs-table-hover-bg: var(--lms-row-hover-bg) !important;
}

.lms-kelas-page .lms-course-card > td {
  background: var(--lms-row-bg) !important;
  background-color: var(--lms-row-bg) !important;
  background-image: none !important;
  --bs-table-accent-bg: transparent !important;
  --bs-table-bg: var(--lms-row-bg) !important;
  --bs-table-bg-state: transparent !important;
  --bs-table-bg-type: transparent !important;
  border-bottom-color: var(--lms-row-border) !important;
  border-top-color: var(--lms-row-border) !important;
  box-shadow: none !important;
}

.lms-kelas-page .lms-course-card > td:first-child {
  border-left-color: var(--lms-row-accent) !important;
}

.lms-kelas-page .lms-course-card > td:last-child {
  border-right-color: var(--lms-row-border) !important;
}

.lms-kelas-page .lms-course-card:hover > td,
.lms-kelas-page .lms-course-card.stakeholder-row-expanded > td {
  background: var(--lms-row-hover-bg) !important;
  background-color: var(--lms-row-hover-bg) !important;
  background-image: none !important;
  --bs-table-accent-bg: transparent !important;
  --bs-table-bg: var(--lms-row-hover-bg) !important;
  --bs-table-bg-state: transparent !important;
  --bs-table-bg-type: transparent !important;
  border-bottom-color: var(--lms-row-hover-border) !important;
  border-top-color: var(--lms-row-hover-border) !important;
  box-shadow: none !important;
}

.lms-kelas-page .lms-course-card:hover > td:first-child,
.lms-kelas-page .lms-course-card.stakeholder-row-expanded > td:first-child {
  box-shadow: none !important;
}

.lms-kelas-page .lms-course-card:hover > td:last-child,
.lms-kelas-page .lms-course-card.stakeholder-row-expanded > td:last-child {
  border-right-color: var(--lms-row-hover-border) !important;
}

.lms-kelas-page .lms-course-card:hover .company-name,
.lms-kelas-page .lms-course-card.stakeholder-row-expanded .company-name {
  color: #1d4ed8 !important;
}

.lms-kelas-page.is-dark .lms-course-card,
[data-theme-mode="dark"] .lms-kelas-page .lms-course-card,
html.dark .lms-kelas-page .lms-course-card {
  --lms-row-bg: #111c2e;
  --lms-row-hover-bg: #14243a;
  --lms-row-border: #22314a;
  --lms-row-hover-border: rgba(96, 165, 250, 0.38);
  --lms-row-accent: #60a5fa;
}
</style>
