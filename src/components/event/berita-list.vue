<script lang="ts">
import { ref, computed, onMounted, nextTick, watch, onBeforeUnmount } from "vue";
import gsap from "gsap";
import { useBeritaStore } from "../../stores/berita";
import { useAuthStore } from "../../stores/auth";
import { useUsersStore } from "../../stores/users";
import { useRouter } from "vue-router";
import type { Berita } from "../../types/berita.types";
import { richTextToPlainText } from "../../utils/richText";
import { formatEventDateShort } from "../../utils/eventDate";
import { buildContentSlug } from "../../utils/contentSlug";

export default {
  data() {
    return {
      dataToPass: null,
    };
  },
  setup() {
    const beritaStore = useBeritaStore();
    const authStore = useAuthStore();
    const usersStore = useUsersStore();
    const router = useRouter();

    const searchQuery = ref("");
    const currentPage = ref(1);
    const itemsPerPage = ref(10);
    const isLoading = ref(true);
    const showToast = ref(false);
    const toastMessage = ref("");
    const toastType = ref<"success" | "error">("success");
    const activeModal = ref<"delete" | null>(null);
    const deleteTarget = ref<Berita | null>(null);
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

    const normalizePlainText = (value?: string | null) => {
      const spacedHtml = String(value || "")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/(p|div|h[1-6]|li|tr|td|th|blockquote)>/gi, "$& ");

      return richTextToPlainText(spacedHtml).replace(/\s+/g, " ").trim();
    };

    const stripHtml = (value: string) => {
      return normalizePlainText(value);
    };

    const getItemId = (item: Berita) => String(item.id || "").trim();

    const getTags = (item: Berita): string[] => {
      const rawTags = (item as any).tags;
      if (Array.isArray(rawTags)) {
        return rawTags.map((tag) => String(tag).trim()).filter(Boolean);
      }
      if (typeof rawTags === "string") {
        return rawTags.split(",").map((tag) => tag.trim()).filter(Boolean);
      }
      return [];
    };

    const getDescriptionPreview = (value?: string | null, maxLength = 150) => {
      const text = normalizePlainText(value);
      if (!text) return "-";
      return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
    };

    const getPrimaryTag = (item: Berita) => {
      return getTags(item)[0] || "Berita";
    };

    const getTagCode = (item: Berita) => {
      const tag = getPrimaryTag(item).toLowerCase();
      const words = tag.split(/\s+/).filter(Boolean);
      if (words.length > 1) return words.map((word) => word.charAt(0)).join("").slice(0, 3).toUpperCase();
      return tag.slice(0, 3).toUpperCase() || "BRT";
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
        await Promise.all([beritaStore.fetchBerita(), usersStore.initialize().catch(() => undefined)]);
      } catch {
        showNotification("Gagal memuat data berita", "error");
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

    const getAuthorName = (item: Berita) => {
      const raw = item as any;
      const directName =
        raw.author?.display_name ||
        raw.author?.name ||
        raw.author?.username ||
        raw.user?.display_name ||
        raw.user?.name ||
        raw.user?.username ||
        raw.author_name ||
        raw.nama_author ||
        raw.user_name ||
        raw.username;

      if (directName) return directName;

      const authorId = String(item.author_id || "");
      const matchedUser = authorId ? usersStore.getUserById(authorId) : undefined;
      if (matchedUser) {
        return matchedUser.display_name || matchedUser.name || matchedUser.username || "Admin";
      }

      if (authStore.currentUser?.id && authorId === authStore.currentUser.id) {
        return authStore.currentUser.display_name || authStore.currentUser.name || authStore.currentUser.username || "Admin";
      }

      return "Admin";
    };

    const filteredData = computed(() => {
      const q = searchQuery.value.toLowerCase().trim();
      if (!q) return beritaStore.berita;
      return beritaStore.berita.filter((item) => {
        const titleMatch = (item.judul || "").toLowerCase().includes(q);
        const tagMatch = getTags(item).some((tag) => tag.toLowerCase().includes(q));
        return titleMatch || tagMatch;
      });
    });

    const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / itemsPerPage.value)));
    const displayData = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredData.value.slice(start, start + itemsPerPage.value);
    });

    const openCreate = () => router.push("/event/berita/create");
    const openEdit = (item: Berita) => {
      const id = getItemId(item);
      if (!id) {
        showNotification("ID berita tidak valid", "error");
        return;
      }
      router.push(`/event/berita/edit/${encodeURIComponent(id)}`);
    };
    const openView = (item: Berita) => {
      const slug = buildContentSlug(item.slug || item.judul, getItemId(item));
      if (!slug) {
        showNotification("Slug berita tidak valid", "error");
        return;
      }
      router.push(`/event/berita/view/${encodeURIComponent(slug)}`);
    };
    const switchToEvent = () => router.push("/event");

    const openDeleteModal = (item: Berita) => {
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
        const id = getItemId(deleteTarget.value);
        const result = await beritaStore.deleteBerita(id);
        if (result.success) {
          showNotification("Berita berhasil dihapus", "success");
          closeDeleteModal();
        } else {
          showNotification("Gagal menghapus berita: " + (result.error || ""), "error");
        }
      } catch {
        showNotification("Gagal menghapus berita", "error");
      } finally {
        isSaving.value = false;
      }
    };

    const getAvatarClass = (letter: string) => {
      const variants = ["avatar-blue", "avatar-teal", "avatar-amber", "avatar-cyan", "avatar-slate", "avatar-green"];
      const idx = (letter.toUpperCase().charCodeAt(0) - 65 + variants.length) % variants.length;
      return variants[idx];
    };

    return {
      beritaStore,
      searchQuery,
      currentPage,
      itemsPerPage,
      filteredData,
      totalPages,
      displayData,
      isLoading,
      showToast,
      toastMessage,
      toastType,
      activeModal,
      deleteTarget,
      isSaving,
      isDarkMode,
      openCreate,
      openEdit,
      openView,
      switchToEvent,
      openDeleteModal,
      closeDeleteModal,
      confirmDelete,
      goToPage,
      getAvatarClass,
      getAuthorName,
      getTags,
      getPrimaryTag,
      getTagCode,
      getDescriptionPreview,
      formatDate: formatEventDateShort,
      stripHtml,
      isFullAdmin: computed(() => authStore.isFullAdmin)
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

  <div :class="['ev-shell', 'ev-news-shell', 'ev-news-shell--full', { 'is-dark': isDarkMode }]">
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
              <h1 class="ev-hero-title">Manajemen Berita</h1>
              <p class="ev-hero-desc">Kelola publikasi berita </p>
            </div>
            <div class="ev-hero-stats">
              <div class="ev-stat-card">
                <div class="ev-stat-head"><span>Total Berita</span><i class="ri-newspaper-line"></i></div>
                <strong>{{ beritaStore.totalBerita }}</strong>
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
                <button class="ev-tab" type="button" @click="switchToEvent"><i class="ri-calendar-event-line"></i> Event</button>
                <button class="ev-tab active" type="button"><i class="ri-newspaper-line"></i> Berita</button>
              </div>
              <div class="ev-search">
                <i class="ri-search-line"></i>
                <input v-model="searchQuery" type="text" placeholder="Cari judul berita..." />
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
              <button type="button" @click="openCreate()" class="ev-btn-add"><i class="ri-add-line"></i><span>Tambah Berita</span></button>
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
              <div class="ev-empty-icon"><i class="ri-newspaper-line"></i></div>
              <h6>Belum Ada Berita</h6>
              <p>Klik "Tambah Berita" untuk membuat data baru.</p>
            </div>

            <article v-for="(item, i) in displayData" v-else :key="item.id" class="ev-table-row ev-list-item">
              <span class="ev-item-index">{{ String((currentPage - 1) * itemsPerPage + i + 1).padStart(2, '0') }}</span>
              <div
                class="ev-avatar ev-type-avatar ev-news-avatar"
                :class="getAvatarClass(getPrimaryTag(item).charAt(0))"
                :title="`Topik berita: ${getPrimaryTag(item)}`"
                :aria-label="`Topik berita: ${getPrimaryTag(item)}`"
              >
                <span class="ev-avatar-code">{{ getTagCode(item) }}</span>
              </div>
              <div class="ev-item-main">
                <div class="ev-item-top">
                  <div class="ev-title-wrap">
                    <div class="ev-title-main" role="button" tabindex="0" @click="openView(item)" @keydown.enter.prevent="openView(item)" @keydown.space.prevent="openView(item)">{{ item.judul }}</div>
                    <div class="ev-title-meta-line ev-news-summary-line">
                      <span class="ev-title-sub" :title="stripHtml(item.deskripsi || '')">{{ getDescriptionPreview(item.deskripsi) }}</span>
                      <button
                        type="button"
                        class="ev-inline-detail"
                        @click="openView(item)"
                        :aria-label="`Lihat detail berita ${item.judul}`"
                      >
                        Lihat detail
                      </button>
                    </div>
                    <div v-if="getTags(item).length" class="ev-tag-row">
                      <span v-for="tag in getTags(item)" :key="tag" class="ev-tag-chip">
                        <i class="ri-price-tag-3-line"></i>{{ tag }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="ev-meta-grid">
                  <span class="ev-cell-meta"><i class="ri-user-3-line"></i>{{ getAuthorName(item) }}</span>
                  <span class="ev-cell-meta"><i class="ri-time-line"></i>{{ formatDate(item.created_at) }}</span>
                </div>
              </div>
              <div class="ev-item-side">
                <span class="ev-badge ev-badge-news"><i class="ri-article-line"></i>Terbit</span>
                <div class="ev-actions">
                  <button type="button" @click="openView(item)" class="ev-act ev-act-view" data-tooltip="Lihat" aria-label="Lihat detail berita"><i class="ri-eye-line"></i></button>
                  <button type="button" @click="openEdit(item)" class="ev-act ev-act-edit" data-tooltip="Edit" aria-label="Edit berita"><i class="ri-edit-2-line"></i></button>
                  <button v-if="isFullAdmin" type="button" @click="openDeleteModal(item)" class="ev-act ev-act-del" data-tooltip="Hapus" aria-label="Hapus berita"><i class="ri-delete-bin-6-line"></i></button>
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
      <div v-if="activeModal === 'delete' && deleteTarget" class="ev-overlay ev-news-overlay" @click.self="closeDeleteModal">
        <div class="ev-modal">
          <div class="ev-modal-icon"><i class="ri-delete-bin-6-line"></i></div>
          <h5>Hapus Berita</h5>
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


