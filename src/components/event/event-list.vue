<script lang="ts">
import { ref, computed, onMounted, nextTick, watch, onBeforeUnmount } from "vue";
import gsap from "gsap";
import { getKegiatanId, useEventStore } from "../../stores/event";
import { useRouter } from "vue-router";
import type { Kegiatan } from "../../types/kegiatan.types";
import { richTextToPlainText } from "../../utils/richText";
import { formatEventDateShort } from "../../utils/eventDate";
import { buildContentSlug } from "../../utils/contentSlug";
import { useAuthStore } from "../../stores/auth";

export default {
  data() {
    return {
      dataToPass: null,
    };
  },
  setup() {
    const eventStore = useEventStore();
    const router = useRouter();
    const authStore = useAuthStore();
    const isFullAdmin = computed(() => authStore.isFullAdmin);

    const searchQuery = ref("");
    const currentPage = ref(1);
    const itemsPerPage = ref(10);
    const isLoading = ref(true);
    const showToast = ref(false);
    const toastMessage = ref("");
    const toastType = ref<"success" | "error">("success");
    const activeModal = ref<"delete" | null>(null);
    const deleteTarget = ref<Kegiatan | null>(null);
    const isSaving = ref(false);
    const isDarkMode = ref(false);
    let gsapCtx: gsap.Context | null = null;
    let isPageTransitioning = false;
    let themeObserver: MutationObserver | undefined;

    const syncThemeMode = () => {
      if (typeof document === "undefined") return;
      const root = document.documentElement;
      isDarkMode.value = root.getAttribute("data-theme-mode") === "dark" || root.classList.contains("dark");
    };

    const showNotification = (msg: string, type: "success" | "error") => {
      toastMessage.value = msg;
      toastType.value = type;
      showToast.value = true;
      setTimeout(() => (showToast.value = false), 3000);
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

    const animateRows = (quick = false, done?: () => void) => {
      nextTick(() => {
        const rows = Array.from(document.querySelectorAll<HTMLElement>(".ev-table-row"));
        if (!rows.length) {
          done?.();
          return;
        }
        gsap.killTweensOf(rows);

        const tl = gsap.timeline({
          defaults: { duration: quick ? 0.34 : 0.38, ease: "power2.out", overwrite: "auto" },
          onComplete: done,
        });
        const gap = quick ? 0.075 : 0.055;

        rows.forEach((row, index) => {
          gsap.set(row, { y: quick ? 14 : 18, opacity: 0, scale: quick ? 0.992 : 0.985, force3D: true });
          tl.to(row, { y: 0, opacity: 1, scale: 1, clearProps: "transform,opacity" }, index * gap);
        });
      });
    };

    const goToPage = (page: number) => {
      const nextPage = Math.min(Math.max(page, 1), totalPages.value);
      if (nextPage === currentPage.value || isPageTransitioning) return;

      const rows = Array.from(document.querySelectorAll<HTMLElement>(".ev-table-row"));
      isPageTransitioning = true;

      const changePage = () => {
        currentPage.value = nextPage;
        nextTick(() => {
          animateRows(true, () => {
            isPageTransitioning = false;
          });
        });
      };

      if (!rows.length) {
        changePage();
        return;
      }

      gsap.killTweensOf(rows);
      const tl = gsap.timeline({
        defaults: { duration: 0.2, ease: "power1.in", overwrite: "auto" },
        onComplete: changePage,
      });

      rows.forEach((row, index) => {
        tl.to(row, { y: -12, opacity: 0, scale: 0.99, force3D: true }, index * 0.055);
      });
    };

    onMounted(async () => {
      closeDeleteModal();
      syncThemeMode();
      if (typeof document !== "undefined") {
        themeObserver = new MutationObserver(syncThemeMode);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-mode", "class"] });
      }
      runEntranceAnimations();
      try {
        await eventStore.fetchEvents();
      } catch {
        showNotification("Gagal memuat data event", "error");
      } finally {
        isLoading.value = false;
      }
    });

    watch(isLoading, (v) => {
      if (!v) animateRows();
    });
    watch(currentPage, () => {
      if (!isPageTransitioning) animateRows(true);
    });
    watch([searchQuery, itemsPerPage], () => {
      currentPage.value = 1;
      animateRows(true);
    });
    onBeforeUnmount(() => {
      gsapCtx?.revert();
      themeObserver?.disconnect();
      closeDeleteModal();
    });

    const filteredData = computed(() => {
      const q = searchQuery.value.toLowerCase().trim();
      if (!q) return eventStore.events;
      return eventStore.events.filter((k) => (k.judul || "").toLowerCase().includes(q));
    });

    const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / itemsPerPage.value)));
    const displayData = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredData.value.slice(start, start + itemsPerPage.value);
    });

    const openCreate = () => router.push("/event/create");
    const getItemId = (item: Kegiatan) => getKegiatanId(item);

    const openEdit = (item: Kegiatan) => {
      const id = getItemId(item);
      if (!id) {
        showNotification("ID event tidak valid", "error");
        return;
      }
      router.push(`/event/edit/${encodeURIComponent(id)}`);
    };
    const openView = (item: Kegiatan) => {
      const slug = buildContentSlug(item.slug || item.judul, getItemId(item));
      if (!slug) {
        showNotification("Slug event tidak valid", "error");
        return;
      }
      router.push(`/event/view/${encodeURIComponent(slug)}`);
    };
    const switchToBerita = () => router.push("/event/berita");

    const openDeleteModal = (item: Kegiatan) => {
      deleteTarget.value = item;
      activeModal.value = "delete";
    };

    const closeDeleteModal = () => {
      activeModal.value = null;
      deleteTarget.value = null;
      isSaving.value = false;
    };

    const confirmDelete = async () => {
      if (!deleteTarget.value) return;
      isSaving.value = true;
      try {
        const result = await eventStore.deleteEvent(deleteTarget.value.id);
        if (result.success) {
          showNotification("Event berhasil dihapus", "success");
          closeDeleteModal();
        } else {
          showNotification("Gagal menghapus event: " + (result.error || ""), "error");
        }
      } catch {
        showNotification("Gagal menghapus event", "error");
      } finally {
        isSaving.value = false;
      }
    };

    const getAvatarClass = (letter: string) => {
      const variants = ["avatar-blue", "avatar-teal", "avatar-amber", "avatar-cyan", "avatar-slate", "avatar-green"];
      const idx = (letter.toUpperCase().charCodeAt(0) - 65 + variants.length) % variants.length;
      return variants[idx];
    };

    const getStatusClass = (status: string) => {
      const s = (status || "").toLowerCase();
      if (s === "upcoming" || s === "akan datang") return "ev-badge-upcoming";
      if (s === "ongoing" || s === "berlangsung" || s === "sedang berjalan") return "ev-badge-ongoing";
      if (s === "selesai" || s === "past" || s === "completed") return "ev-badge-completed";
      if (s === "aktif" || s === "active") return "ev-badge-active";
      return "ev-badge-default";
    };

    const getStatusText = (status: string) => {
      const s = (status || "").toLowerCase();
      if (s === "upcoming" || s === "akan datang") return "Akan Datang";
      if (s === "ongoing" || s === "berlangsung" || s === "sedang berjalan") return "Sedang Berjalan";
      if (s === "selesai" || s === "past" || s === "completed") return "Selesai";
      if (s === "aktif" || s === "active") return "Aktif";
      return status || "-";
    };

    const getStatusIcon = (status: string) => {
      const s = (status || "").toLowerCase();
      if (s === "upcoming" || s === "akan datang") return "ri-calendar-schedule-line";
      if (s === "ongoing" || s === "berlangsung" || s === "sedang berjalan") return "ri-live-line";
      if (s === "selesai" || s === "past" || s === "completed") return "ri-checkbox-circle-line";
      if (s === "aktif" || s === "active") return "ri-flashlight-line";
      return "ri-information-line";
    };

    const normalizePlainText = (value?: string | null) => {
      const spacedHtml = String(value || "")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/(p|div|h[1-6]|li|tr|td|th|blockquote)>/gi, "$& ");

      return richTextToPlainText(spacedHtml).replace(/\s+/g, " ").trim();
    };

    const stripHtml = (value: string) => {
      return normalizePlainText(value);
    };

    const getDescriptionPreview = (value?: string | null, maxLength = 150) => {
      const text = normalizePlainText(value);
      if (!text) return "-";
      return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
    };

    const getEventType = (item: Kegiatan) => {
      const explicitType = String(
        (item as any).kategori || (item as any).category || (item as any).jenis || (item as any).tipe || ""
      ).trim();
      if (explicitType) return explicitType;

      const searchableText = `${item.judul || ""} ${normalizePlainText(item.deskripsi)} ${item.lokasi || ""}`.toLowerCase();

      if (/(webinar|zoom|online)/.test(searchableText)) return "Webinar";
      if (/(workshop|lokakarya)/.test(searchableText)) return "Workshop";
      if (/(summit|conference|konferensi)/.test(searchableText)) return "Summit";
      if (/(training|pelatihan|bootcamp)/.test(searchableText)) return "Pelatihan";
      if (/seminar/.test(searchableText)) return "Seminar";
      if (/(kompetisi|lomba|ctf)/.test(searchableText)) return "Kompetisi";

      return "Event";
    };

    const getEventTypeCode = (item: Kegiatan) => {
      const type = getEventType(item).toLowerCase();
      if (type === "webinar") return "WEB";
      if (type === "workshop") return "WS";
      if (type === "summit") return "SUM";
      if (type === "pelatihan") return "TRN";
      if (type === "seminar") return "SEM";
      if (type === "kompetisi") return "KMP";

      const words = type.split(/\s+/).filter(Boolean);
      if (words.length > 1) return words.map((word) => word.charAt(0)).join("").slice(0, 3).toUpperCase();
      return type.slice(0, 3).toUpperCase() || "EVT";
    };

    return {
      isLoading,
      eventStore,
      searchQuery,
      currentPage,
      itemsPerPage,
      filteredData,
      totalPages,
      displayData,
      showToast,
      toastMessage,
      toastType,
      activeModal,
      isSaving,
      isDarkMode,
      deleteTarget,
      openCreate,
      openEdit,
      openView,
      openDeleteModal,
      closeDeleteModal,
      confirmDelete,
      goToPage,
      switchToBerita,
      getAvatarClass,
      getStatusClass,
      getStatusText,
      getStatusIcon,
      getEventType,
      getEventTypeCode,
      getDescriptionPreview,
      formatDate: formatEventDateShort,
      stripHtml,
      isFullAdmin,
    };
  },
};
</script>

<template>
  <transition name="ev-toast-slide">
    <div v-if="showToast" class="ev-toast-wrapper">
      <div class="ev-toast" :class="toastType === 'success' ? 'ev-toast-ok' : 'ev-toast-err'" role="alert">
        <i :class="toastType === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'"></i>
        <div>
          <strong>{{ toastType === 'success' ? 'Berhasil' : 'Gagal' }}</strong>
          <span>{{ toastMessage }}</span>
        </div>
      </div>
    </div>
  </transition>

  <div :class="['ev-shell', { 'is-dark': isDarkMode }]">
    <div class="row">
      <div class="col-xl-12">
        <header class="ev-hero mb-4">
          <div class="ev-hero-grid"></div>
          <div class="ev-hero-tiles" aria-hidden="true">
            <span class="ev-hero-tile tile-a"></span>
            <span class="ev-hero-tile tile-b"></span>
            <span class="ev-hero-tile tile-c"></span>
            <span class="ev-hero-tile tile-d"></span>
            <span class="ev-hero-tile tile-e"></span>
            <span class="ev-hero-tile tile-f"></span>
          </div>
          <div class="ev-hero-body">
            <div class="ev-hero-text">
              <div class="ev-breadcrumb">Beranda <span>/</span> Event &amp; Berita</div>
              <h1 class="ev-hero-title">Manajemen Event</h1>
              <p class="ev-hero-desc">Kelola agenda, lokasi, dan status kegiatan </p>
            </div>
            <div class="ev-hero-stats">
              <div class="ev-stat-card">
                <div class="ev-stat-head"><span>Total Event</span><i class="ri-calendar-event-line"></i></div>
                <strong>{{ eventStore.totalEvents }}</strong>
              </div>
              <div class="ev-stat-card">
                <div class="ev-stat-head"><span>Ditampilkan</span><i class="ri-filter-3-line"></i></div>
                <strong>{{ filteredData.length }}</strong>
              </div>
            </div>
          </div>
        </header>

        <section class="ev-content-card">
          <div class="ev-toolbar">
            <div class="ev-toolbar-left">
              <div class="ev-tabs" role="tablist" aria-label="Event dan berita">
                <button class="ev-tab active" type="button"><i class="ri-calendar-event-line"></i> Event</button>
                <button class="ev-tab" type="button" @click="switchToBerita"><i class="ri-newspaper-line"></i> Berita</button>
              </div>
              <div class="ev-search">
                <i class="ri-search-line"></i>
                <input v-model="searchQuery" type="text" placeholder="Cari judul event..." />
                <button v-if="searchQuery" type="button" @click="searchQuery = ''" class="ev-search-clear"><i class="ri-close-circle-fill"></i></button>
              </div>
            </div>
            <div class="ev-toolbar-right">
              <label class="ev-per-page">
                <span>Baris</span>
                <select v-model="itemsPerPage" class="ev-select">
                  <option v-for="n in [5, 10, 15, 20]" :key="n" :value="n">{{ n }}</option>
                </select>
              </label>
              <button type="button" @click="openCreate()" class="ev-btn-add"><i class="ri-add-line"></i><span>Tambah Event</span></button>
            </div>
          </div>

          <div class="ev-list-wrap">
            <div v-if="isLoading" class="ev-skeleton-wrap">
              <div v-for="n in 5" :key="n" class="ev-skeleton-row">
                <div class="ev-skel ev-skel-circle"></div>
                <div class="ev-skel-lines">
                  <div class="ev-skel" style="width:48%;height:14px"></div>
                  <div class="ev-skel" style="width:30%;height:11px"></div>
                </div>
                <div class="ev-skel ev-skel-chip"></div>
              </div>
            </div>

            <div v-else-if="!displayData.length" class="ev-empty">
              <div class="ev-empty-icon"><i class="ri-calendar-event-line"></i></div>
              <h6>Belum Ada Event</h6>
              <p>Klik "Tambah Event" untuk membuat data baru.</p>
            </div>

            <article v-for="(item, i) in displayData" v-else :key="item.id" class="ev-table-row ev-list-item">
              <span class="ev-item-index">{{ String((currentPage - 1) * itemsPerPage + i + 1).padStart(2, '0') }}</span>
              <div
                class="ev-avatar ev-type-avatar"
                :class="getAvatarClass(getEventType(item).charAt(0))"
                :title="`Tipe event: ${getEventType(item)}`"
                :aria-label="`Tipe event: ${getEventType(item)}`"
              >
                <span class="ev-avatar-code">{{ getEventTypeCode(item) }}</span>
              </div>
              <div class="ev-item-main">
                <div class="ev-item-top">
                  <div class="ev-title-wrap">
                    <div class="ev-title-main" role="button" tabindex="0" @click="openView(item)" @keydown.enter.prevent="openView(item)" @keydown.space.prevent="openView(item)">{{ item.judul }}</div>
                    <div class="ev-title-meta-line">
                      <span class="ev-event-type">{{ getEventType(item) }}</span>
                      <span class="ev-title-sub" :title="stripHtml(item.deskripsi || '')">{{ getDescriptionPreview(item.deskripsi) }}</span>
                      <button
                        type="button"
                        class="ev-inline-detail"
                        @click="openView(item)"
                        :aria-label="`Lihat detail event ${item.judul}`"
                      >
                        Lihat detail
                      </button>
                    </div>
                  </div>
                </div>
                <div class="ev-meta-grid">
                  <span class="ev-cell-meta"><i class="ri-map-pin-2-line"></i>{{ item.lokasi || '-' }}</span>
                  <span class="ev-cell-meta"><i class="ri-calendar-2-line"></i>{{ formatDate(item.tanggal) }}</span>
                </div>
              </div>
              <div class="ev-item-side">
                <span class="ev-badge" :class="getStatusClass(item.status)">
                  <i :class="getStatusIcon(item.status)"></i>{{ getStatusText(item.status) }}
                </span>
                <div class="ev-actions">
                  <button type="button" @click="openView(item)" class="ev-act ev-act-view" data-tooltip="Lihat" aria-label="Lihat detail event"><i class="ri-eye-line"></i></button>
                  <button type="button" @click="openEdit(item)" class="ev-act ev-act-edit" data-tooltip="Edit" aria-label="Edit event"><i class="ri-edit-2-line"></i></button>
                  <button v-if="isFullAdmin" type="button" @click="openDeleteModal(item)" class="ev-act ev-act-del" data-tooltip="Hapus" aria-label="Hapus event"><i class="ri-delete-bin-6-line"></i></button>
                </div>
              </div>
            </article>
          </div>

          <div class="ev-pagination">
            <span class="ev-page-info">Menampilkan {{ displayData.length ? (currentPage - 1) * itemsPerPage + 1 : 0 }}-{{ Math.min(currentPage * itemsPerPage, filteredData.length) }} dari {{ filteredData.length }}</span>
            <div class="ev-page-nav" v-if="totalPages > 1">
              <button class="ev-pg-btn" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)"><i class="ri-arrow-left-s-line"></i></button>
              <template v-for="p in totalPages" :key="p">
                <button v-if="p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)" class="ev-pg-btn" :class="{ active: p === currentPage }" @click="goToPage(p)">{{ p }}</button>
                <span v-else-if="p === currentPage - 2 || p === currentPage + 2" class="ev-pg-dots">...</span>
              </template>
              <button class="ev-pg-btn" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)"><i class="ri-arrow-right-s-line"></i></button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>

  <teleport to="body">
    <transition name="ev-modal">
      <div v-if="activeModal === 'delete' && deleteTarget" class="ev-overlay" @click.self="closeDeleteModal">
        <div class="ev-modal">
          <div class="ev-modal-icon"><i class="ri-delete-bin-6-line"></i></div>
          <h5>Hapus Event</h5>
          <p>Yakin ingin menghapus <strong>{{ deleteTarget?.judul }}</strong>?</p>
          <div class="ev-modal-actions">
            <button class="ev-modal-cancel" @click="closeDeleteModal">Batal</button>
            <button class="ev-modal-confirm" @click="confirmDelete" :disabled="isSaving">
              <span v-if="isSaving" class="spinner-border spinner-border-sm me-1"></span>Hapus
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style src="../../assets/css/event-berita.css"></style>

