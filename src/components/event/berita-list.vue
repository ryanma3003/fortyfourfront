<script lang="ts">
import { ref, computed, onMounted, nextTick, watch, onBeforeUnmount } from "vue";
import gsap from "gsap";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useBeritaStore } from "../../stores/berita";
import { useAuthStore } from "../../stores/auth";
import { useUsersStore } from "../../stores/users";
import { useRouter } from "vue-router";
import type { Berita } from "../../types/berita.types";

export default {
  components: { Pageheader },
  data() {
    return {
      dataToPass: {
        title: { label: "Beranda", path: "/dashboard" },
        currentpage: "Event & Berita",
        activepage: "Berita",
      },
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

    const decodeHtmlEntities = (value: string) => {
      if (typeof document === "undefined") return value;
      let decoded = value;
      for (let i = 0; i < 2; i += 1) {
        const textarea = document.createElement("textarea");
        textarea.innerHTML = decoded;
        const next = textarea.value;
        if (next === decoded) break;
        decoded = next;
      }
      return decoded;
    };

    const stripHtml = (value: string) => {
      return decodeHtmlEntities(value)
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim();
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
      return beritaStore.berita.filter((item) => (item.judul || "").toLowerCase().includes(q));
    });

    const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / itemsPerPage.value)));
    const displayData = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredData.value.slice(start, start + itemsPerPage.value);
    });

    const openCreate = () => router.push("/event/berita/create");
    const openEdit = (item: Berita) => router.push(`/event/berita/edit/${item.id}`);
    const openView = (item: Berita) => router.push(`/event/berita/view/${item.id}`);
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
        const result = await beritaStore.deleteBerita(deleteTarget.value.id);
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

    const formatDate = (dateStr: string) => {
      if (!dateStr) return "-";
      try {
        return new Date(dateStr).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        return dateStr;
      }
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
      formatDate,
      stripHtml,
    };
  },
};
</script>

<template>
  <Pageheader :propData="dataToPass" />

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

  <div :class="['ev-shell', 'ev-news-shell', { 'is-dark': isDarkMode }]">
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
              <p class="ev-hero-desc">Kelola publikasi berita dengan tampilan yang lebih editorial, cepat dibaca, dan tetap nyaman untuk kerja harian.</p>
            </div>
            <div class="ev-hero-stats">
              <div class="ev-stat-card">
                <div class="ev-stat-head"><span>Total Berita</span><i class="ri-newspaper-line"></i></div>
                <strong>{{ beritaStore.totalBerita }}</strong>
              </div>
              <div class="ev-stat-card">
                <div class="ev-stat-head"><span>Terfilter</span><i class="ri-filter-3-line"></i></div>
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
              <div class="ev-avatar" :class="getAvatarClass((item.judul || 'B').charAt(0))">
                {{ (item.judul || 'B').charAt(0).toUpperCase() }}
              </div>
              <div class="ev-item-main">
                <div class="ev-item-top">
                  <div class="ev-title-wrap">
                    <div class="ev-title-main" role="button" tabindex="0" @click="openView(item)" @keydown.enter.prevent="openView(item)" @keydown.space.prevent="openView(item)">{{ item.judul }}</div>
                    <span class="ev-title-sub">{{ stripHtml(item.deskripsi || '') || '-' }}</span>
                  </div>
                </div>
                <div class="ev-meta-grid">
                  <span class="ev-cell-meta"><i class="ri-user-3-line"></i>{{ getAuthorName(item) }}</span>
                  <span class="ev-cell-meta"><i class="ri-time-line"></i>{{ formatDate(item.created_at) }}</span>
                  <span class="ev-cell-meta"><i class="ri-refresh-line"></i>{{ formatDate(item.updated_at) }}</span>
                </div>
              </div>
              <div class="ev-item-side">
                <span class="ev-badge ev-badge-news"><i class="ri-article-line"></i>Terbit</span>
                <div class="ev-actions">
                  <button type="button" @click="openView(item)" class="ev-act ev-act-view" title="Lihat"><i class="ri-eye-line"></i></button>
                  <button type="button" @click="openEdit(item)" class="ev-act ev-act-edit" title="Edit"><i class="ri-edit-2-line"></i></button>
                  <button type="button" @click="openDeleteModal(item)" class="ev-act ev-act-del" title="Hapus"><i class="ri-delete-bin-6-line"></i></button>
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

<style scoped>
.ev-shell{position:relative}
.ev-hero{position:relative;overflow:hidden;border-radius:16px;padding:30px 34px;color:#101827;background:linear-gradient(135deg,#f8fafc 0%,#f3f7ff 48%,#f4f7ed 100%);border:1px solid rgba(148,163,184,.22);box-shadow:0 20px 48px rgba(15,23,42,.08)}
.ev-hero-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(15,23,42,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(15,23,42,.045) 1px,transparent 1px);background-size:28px 28px;mask-image:linear-gradient(90deg,#000 0%,transparent 70%);pointer-events:none}
.ev-hero-body{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;position:relative;z-index:1}
.ev-hero-text{min-width:0;max-width:700px}
.ev-breadcrumb{font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}
.ev-breadcrumb span{color:#cbd5e1;margin:0 6px}
.ev-hero-title{font-size:32px;font-weight:900;line-height:1.08;margin:0;color:#0f172a;letter-spacing:0}
.ev-hero-desc{font-size:14px;color:#64748b;margin:10px 0 0;line-height:1.6}
.ev-hero-stats{display:flex;gap:10px;flex-shrink:0}
.ev-stat-card{background:rgba(255,255,255,.72);border:1px solid rgba(148,163,184,.24);border-radius:8px;padding:15px 16px;min-width:140px;box-shadow:0 16px 34px rgba(15,23,42,.07);backdrop-filter:blur(14px);transition:transform .25s ease,box-shadow .25s ease}
.ev-stat-card:hover{transform:translateY(-3px);box-shadow:0 20px 42px rgba(15,23,42,.1)}
.ev-stat-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.ev-stat-head span{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#64748b}
.ev-stat-head i{font-size:19px;color:#0f766e}
.ev-stat-card strong{font-size:28px;font-weight:900;color:#0f172a;line-height:1}
.ev-content-card{background:#fff;border:1px solid #e8edf4;border-radius:14px;box-shadow:0 16px 42px rgba(15,23,42,.06);padding:20px}
.ev-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px}
.ev-toolbar-left,.ev-toolbar-right{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.ev-toolbar-left{flex:1 1 520px;min-width:0}
.ev-toolbar-right{flex-shrink:0}
.ev-tabs{display:inline-flex;align-items:center;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:3px;gap:3px}
.ev-tab{border:none;background:transparent;padding:8px 16px;border-radius:8px;font-weight:700;font-size:13px;color:#64748b;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:all .2s ease;white-space:nowrap}
.ev-tab:hover{color:#0f172a;background:rgba(255,255,255,.55)}
.ev-tab.active{background:#fff;color:#0f172a;box-shadow:0 5px 16px rgba(15,23,42,.08)}
.ev-search{display:flex;align-items:center;gap:9px;background:#fff;border:1px solid #dbe3ef;border-radius:10px;padding:0 12px;min-height:40px;max-width:360px;width:100%;transition:border-color .2s,box-shadow .2s}
.ev-search:focus-within{border-color:#0f766e;box-shadow:0 0 0 4px rgba(15,118,110,.11)}
.ev-search i{color:#94a3b8;font-size:16px;flex-shrink:0}
.ev-search input{border:0;background:transparent;outline:none;width:100%;color:#0f172a;font-size:13px}
.ev-search-clear{border:none;background:transparent;color:#94a3b8;padding:0;cursor:pointer;display:flex}
.ev-per-page{display:flex;align-items:center;gap:7px;margin:0}
.ev-per-page span{font-size:12px;color:#64748b;font-weight:700}
.ev-select{border:1px solid #dbe3ef;border-radius:8px;padding:6px 9px;font-size:13px;color:#334155;background:#fff;outline:none;cursor:pointer}
.ev-btn-add{display:inline-flex;align-items:center;gap:8px;background:#0f172a;color:#fff;border:none;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:800;cursor:pointer;transition:transform .2s,box-shadow .2s,background .2s;white-space:nowrap}
.ev-btn-add:hover{transform:translateY(-2px);background:#111f35;box-shadow:0 14px 28px rgba(15,23,42,.18)}
.ev-list-wrap{display:flex;flex-direction:column;gap:10px}
.ev-list-item{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:16px;align-items:center;padding:14px;border:1px solid #eef2f7;border-radius:12px;background:linear-gradient(180deg,#fff 0%,#fbfdff 100%);transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease}
.ev-list-item:hover{transform:translateY(-2px);border-color:#cbd5e1;box-shadow:0 16px 32px rgba(15,23,42,.08)}
.ev-item-index{width:42px;height:42px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;font-weight:900}
.ev-item-main{min-width:0;display:flex;flex-direction:column;gap:10px}
.ev-cell-title{display:flex;align-items:center;gap:12px;min-width:0}
.ev-avatar{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;color:#fff;flex-shrink:0;box-shadow:inset 0 -10px 18px rgba(0,0,0,.12)}
.ev-title-wrap{min-width:0;display:flex;flex-direction:column;gap:3px}
.ev-title-main{border:0;background:transparent;padding:0;text-align:left;font-weight:800;font-size:14px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:520px;cursor:pointer}
.ev-title-main:hover{color:#0f766e}
.ev-title-sub{font-size:12.5px;color:#7a8797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:620px;display:block}
.ev-meta-grid{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-left:54px}
.ev-cell-meta{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:#64748b;background:#f8fafc;border:1px solid #eef2f7;border-radius:999px;padding:5px 9px;max-width:100%}
.ev-cell-meta i{font-size:14px;color:#0ea5e9}
.ev-item-side{display:flex;align-items:center;gap:14px;justify-content:flex-end}
.ev-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;font-size:11.5px;font-weight:800;white-space:nowrap;border:1px solid transparent}
.ev-badge-news{background:#ecfeff;color:#0e7490;border-color:#a5f3fc}
.ev-actions{display:flex;gap:6px;justify-content:center}
.ev-act{width:34px;height:34px;border:none;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;transition:transform .2s ease,background .2s ease,color .2s ease}
.ev-act:hover{transform:translateY(-1px)}
.ev-act-view{background:#e0f2fe;color:#0284c7}
.ev-act-edit{background:#dcfce7;color:#16a34a}
.ev-act-del{background:#fee2e2;color:#dc2626}
.ev-act-view:hover{background:#0284c7;color:#fff}
.ev-act-edit:hover{background:#16a34a;color:#fff}
.ev-act-del:hover{background:#dc2626;color:#fff}
.ev-skeleton-wrap{display:flex;flex-direction:column;gap:10px}
.ev-skeleton-row{display:flex;align-items:center;gap:14px;padding:16px;border:1px solid #eef2f7;border-radius:12px;background:#fff}
.ev-skel{background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:ev-shimmer 1.4s infinite;border-radius:7px;height:14px}
.ev-skel-circle{width:42px;height:42px!important;border-radius:10px;flex-shrink:0}
.ev-skel-lines{flex:1;display:flex;flex-direction:column;gap:7px}
.ev-skel-chip{width:110px;height:28px;border-radius:999px}
@keyframes ev-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.ev-empty{text-align:center;padding:54px 20px;border:1px dashed #dbe3ef;border-radius:12px;background:#fbfdff}
.ev-empty-icon{width:58px;height:58px;border-radius:14px;background:#ecfeff;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px}
.ev-empty-icon i{font-size:27px;color:#0891b2}
.ev-empty h6{font-size:15px;font-weight:800;color:#0f172a;margin:0 0 6px}
.ev-empty p{font-size:13px;color:#64748b;margin:0}
.ev-pagination{display:flex;align-items:center;justify-content:space-between;padding:16px 0 0;gap:12px;flex-wrap:wrap}
.ev-page-info{font-size:12.5px;color:#64748b;font-weight:700}
.ev-page-nav{display:flex;align-items:center;gap:5px}
.ev-pg-btn{width:34px;height:34px;border:1px solid #dbe3ef;border-radius:9px;background:#fff;color:#64748b;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;cursor:pointer;transition:all .2s}
.ev-pg-btn:hover:not(:disabled):not(.active){background:#f8fafc;color:#0f172a}
.ev-pg-btn.active{background:#0f172a;color:#fff;border-color:#0f172a}
.ev-pg-btn:disabled{opacity:.42;cursor:not-allowed}
.ev-pg-dots{font-size:12px;color:#94a3b8;padding:0 2px}
.ev-toast-wrapper{position:fixed;top:24px;right:24px;z-index:9999}
.ev-toast{display:flex;align-items:center;gap:12px;padding:14px 18px;border-radius:12px;backdrop-filter:blur(16px);box-shadow:0 18px 40px rgba(15,23,42,.14);min-width:280px}
.ev-toast i{font-size:22px;flex-shrink:0}
.ev-toast div{display:flex;flex-direction:column;gap:2px}
.ev-toast strong{font-size:13px;font-weight:800}
.ev-toast span{font-size:12px;opacity:.86}
.ev-toast-ok{background:rgba(240,253,244,.95);border:1px solid #bbf7d0;color:#166534}
.ev-toast-err{background:rgba(254,242,242,.95);border:1px solid #fecaca;color:#991b1b}
.ev-toast-slide-enter-active,.ev-toast-slide-leave-active{transition:all .35s ease}
.ev-toast-slide-enter-from,.ev-toast-slide-leave-to{opacity:0;transform:translateX(30px)}
.ev-overlay{position:fixed;inset:0;background:rgba(15,23,42,.52);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px}
.ev-modal{background:#fff;border-radius:14px;padding:30px;max-width:390px;width:100%;text-align:center;box-shadow:0 28px 70px rgba(0,0,0,.18)}
.ev-modal-icon{width:54px;height:54px;border-radius:12px;background:#fee2e2;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px}
.ev-modal-icon i{font-size:24px;color:#dc2626}
.ev-modal h5{font-size:17px;font-weight:900;color:#0f172a;margin:0 0 8px}
.ev-modal p{font-size:14px;color:#64748b;margin:0 0 24px;line-height:1.5}
.ev-modal-actions{display:flex;gap:10px;justify-content:center}
.ev-modal-cancel,.ev-modal-confirm{padding:9px 22px;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;transition:all .2s}
.ev-modal-cancel{border:1px solid #dbe3ef;background:#fff;color:#64748b}
.ev-modal-confirm{border:none;background:#dc2626;color:#fff}
.ev-modal-confirm:disabled{opacity:.6;cursor:not-allowed}
.ev-modal-enter-active,.ev-modal-leave-active{transition:all .3s ease}
.ev-modal-enter-from,.ev-modal-leave-to{opacity:0}
.ev-modal-enter-from .ev-modal,.ev-modal-leave-to .ev-modal{transform:scale(.95) translateY(10px)}
.avatar-blue{background:linear-gradient(135deg,#2563eb,#0ea5e9)}
.avatar-teal{background:linear-gradient(135deg,#0f766e,#14b8a6)}
.avatar-amber{background:linear-gradient(135deg,#d97706,#f59e0b)}
.avatar-cyan{background:linear-gradient(135deg,#0891b2,#22d3ee)}
.avatar-slate{background:linear-gradient(135deg,#334155,#64748b)}
.avatar-green{background:linear-gradient(135deg,#16a34a,#22c55e)}
@media(max-width:1100px){
  .ev-hero-body{flex-direction:column;align-items:flex-start}
  .ev-hero-stats{width:100%}
}
@media(max-width:860px){
  .ev-content-card{padding:16px}
  .ev-toolbar,.ev-toolbar-left,.ev-toolbar-right{align-items:stretch;width:100%}
  .ev-toolbar-left,.ev-toolbar-right{justify-content:space-between}
  .ev-search{max-width:none}
  .ev-list-item{grid-template-columns:1fr}
  .ev-item-index{display:none}
  .ev-meta-grid{padding-left:54px}
  .ev-item-side{justify-content:space-between}
}
@media(max-width:640px){
  .ev-hero{padding:24px 20px}
  .ev-hero-title{font-size:26px}
  .ev-hero-stats{flex-direction:column}
  .ev-stat-card{width:100%}
  .ev-tabs,.ev-btn-add{width:100%}
  .ev-tab{flex:1;justify-content:center}
  .ev-btn-add{justify-content:center}
  .ev-meta-grid{padding-left:0}
  .ev-cell-title{align-items:flex-start}
  .ev-item-side{align-items:flex-start;flex-direction:column}
  .ev-title-main,.ev-title-sub{max-width:100%}
}

/* Polished redesign overrides */
.ev-shell{padding:2px}
.ev-news-shell .ev-hero{background:linear-gradient(135deg,#0f1f57 0%,#2454d8 52%,#0ea5e9 100%);color:#fff;border:none;box-shadow:0 22px 58px rgba(37,84,216,.24)}
.ev-news-shell .ev-hero::before{content:"";position:absolute;inset:auto -80px -120px auto;width:360px;height:360px;border-radius:999px;background:radial-gradient(circle,rgba(255,255,255,.26),transparent 64%);pointer-events:none}
.ev-news-shell .ev-hero::after{content:"";position:absolute;left:-110px;top:-140px;width:310px;height:310px;border-radius:999px;background:radial-gradient(circle,rgba(45,212,191,.22),transparent 62%);pointer-events:none}
.ev-news-shell .ev-hero-grid{opacity:.32;mask-image:linear-gradient(90deg,#000 0%,rgba(0,0,0,.5) 62%,transparent 100%)}
.ev-news-shell .ev-hero-tiles{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.ev-news-shell .ev-hero-tile{position:absolute;border:0;border-radius:999px;mix-blend-mode:screen;opacity:.5;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.32),rgba(255,255,255,.1) 38%,rgba(96,165,250,.13) 58%,transparent 76%);animation:ev-news-tile-float 8s ease-in-out infinite}
.ev-news-shell .ev-hero-tile.tile-a{width:390px;height:200px;right:-78px;top:-40px;transform:rotate(-8deg);animation-duration:9s}
.ev-news-shell .ev-hero-tile.tile-b{width:270px;height:270px;left:10%;top:-118px;animation-delay:-1.6s}
.ev-news-shell .ev-hero-tile.tile-c{width:240px;height:240px;right:25%;top:-88px;animation-delay:-3s}
.ev-news-shell .ev-hero-tile.tile-d{width:205px;height:205px;left:32%;bottom:-112px;animation-delay:-4.4s}
.ev-news-shell .ev-hero-tile.tile-e{width:220px;height:220px;right:8%;bottom:-130px;animation-delay:-2.4s}
.ev-news-shell .ev-hero-tile.tile-f{width:165px;height:165px;left:-20px;bottom:-64px;animation-delay:-5s}
@keyframes ev-news-tile-float{0%,100%{translate:0 0;scale:1;opacity:.42}50%{translate:0 -12px;scale:1.035;opacity:.58}}
.ev-news-shell .ev-breadcrumb{color:#bae6fd}
.ev-news-shell .ev-breadcrumb span{color:rgba(255,255,255,.42)}
.ev-news-shell .ev-hero-title{color:#fff;text-shadow:0 10px 28px rgba(15,23,42,.2)}
.ev-news-shell .ev-hero-desc{color:rgba(255,255,255,.88)}
.ev-news-shell .ev-stat-card{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.24);box-shadow:0 16px 34px rgba(15,23,42,.16)}
.ev-news-shell .ev-stat-head span,.ev-news-shell .ev-stat-card strong{color:#fff}
.ev-news-shell .ev-stat-head i{color:#fde68a}
.ev-news-shell .ev-content-card{background:linear-gradient(180deg,#f8fbff 0%,#eef7f7 100%);border-color:#cfe7ef;box-shadow:0 22px 54px rgba(15,118,110,.11)}
.ev-news-shell .ev-toolbar{padding:12px;background:rgba(255,255,255,.72);border:1px solid rgba(203,213,225,.72);border-radius:14px;box-shadow:0 12px 28px rgba(15,118,110,.08)}
.ev-news-shell .ev-tabs{background:#eaf7f8;border-color:#cdebf0}
.ev-news-shell .ev-tab.active{background:#fff;color:#0f766e}
.ev-news-shell .ev-search{background:#f8fbff;border-color:#cdebf0}
.ev-news-shell .ev-btn-add{background:linear-gradient(135deg,#0f766e,#0891b2 55%,#2563eb);box-shadow:0 12px 24px rgba(15,118,110,.22)}
.ev-news-shell .ev-list-wrap{padding:12px;border-radius:16px;background:linear-gradient(180deg,#eaf7f8 0%,#f5fbfc 100%);border:1px solid #cdebf0;box-shadow:inset 0 1px 0 rgba(255,255,255,.78)}
.ev-news-shell .ev-list-item{grid-template-columns:50px minmax(0,1fr) 190px;gap:18px;min-height:116px;padding:16px 18px;border:1px solid #d7edf1;border-left:5px solid #0f766e;border-radius:14px;background:linear-gradient(135deg,#ffffff 0%,#f6fcfc 58%,#eefafa 100%);box-shadow:0 12px 28px rgba(15,118,110,.08)}
.ev-news-shell .ev-list-item:nth-of-type(3n+1){border-left-color:#0f766e}
.ev-news-shell .ev-list-item:nth-of-type(3n+2){border-left-color:#2563eb}
.ev-news-shell .ev-list-item:nth-of-type(3n+3){border-left-color:#0f766e}
.ev-news-shell .ev-list-item:hover{transform:translateY(-3px) scale(1.003);background:linear-gradient(135deg,#ffffff 0%,#eff6ff 55%,#dbeafe 100%);box-shadow:0 18px 36px rgba(30,64,175,.16),0 0 0 1px rgba(37,99,235,.12)}
.ev-news-shell .ev-list-item:hover .ev-item-index{background:#0f172a;box-shadow:0 8px 16px rgba(15,23,42,.24)}
.ev-news-shell .ev-list-item:hover .ev-avatar{transform:translateY(-1px);box-shadow:0 12px 22px rgba(37,99,235,.18),inset 0 -10px 18px rgba(0,0,0,.12)}
.ev-news-shell .ev-list-item:hover .ev-title-main{color:#1d4ed8}
.ev-news-shell .ev-list-item:hover .ev-cell-meta{background:#f8fbff;border-color:#bfdbfe;color:#1e3a8a}
.ev-news-shell .ev-item-index{background:linear-gradient(135deg,#0f766e,#0891b2);border:none;color:#fff;box-shadow:0 10px 22px rgba(15,118,110,.22)}
.ev-news-shell .ev-avatar{width:46px;height:46px;border-radius:12px}
.ev-news-shell .ev-title-main{display:block;border:0!important;outline:none!important;background:transparent!important;box-shadow:none!important;padding:0!important;font-size:15px;line-height:1.25;max-width:100%;color:#10203b}
.ev-news-shell .ev-title-main:focus-visible{color:#0f766e;text-decoration:underline;text-underline-offset:3px}
.ev-news-shell .ev-title-sub{max-width:100%;color:#64748b}
.ev-news-shell .ev-meta-grid{padding-left:58px;gap:8px}
.ev-news-shell .ev-cell-meta{background:#ecfeff;border-color:#cffafe;color:#4b5563}
.ev-news-shell .ev-cell-meta i{color:#0891b2}
.ev-news-shell .ev-item-side{align-self:stretch;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;gap:14px;padding-left:14px;border-left:1px solid #d7edf1}
.ev-news-shell .ev-actions{padding:5px;background:#f7fcfc;border:1px solid #d7edf1;border-radius:12px;box-shadow:0 8px 18px rgba(15,23,42,.05)}
.ev-news-shell .ev-act{width:36px;height:36px;border-radius:10px}
.ev-news-shell .ev-badge{box-shadow:0 8px 16px rgba(15,23,42,.04)}
@media(max-width:860px){
  .ev-news-shell .ev-list-item{grid-template-columns:1fr;min-height:auto}
  .ev-news-shell .ev-item-side{align-items:flex-start;border-left:0;border-top:1px solid #d7edf1;padding-left:0;padding-top:12px;flex-direction:row;justify-content:space-between}
}
@media(max-width:640px){
  .ev-news-shell .ev-toolbar{padding:10px}
  .ev-news-shell .ev-meta-grid{padding-left:0}
  .ev-news-shell .ev-item-side{flex-direction:column}
}

/* Final row positioning */
.ev-news-shell .ev-list-wrap{gap:12px}
.ev-news-shell .ev-list-item{grid-template-columns:30px 50px minmax(0,1fr) auto;align-items:center;min-height:104px;padding:16px 18px;gap:14px}
.ev-news-shell .ev-item-main{gap:11px}
.ev-news-shell .ev-item-top{display:flex;align-items:center;min-width:0}
.ev-news-shell .ev-item-index{width:28px;height:28px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:900;letter-spacing:.02em;color:#fff;background:#111827;box-shadow:0 4px 10px rgba(15,23,42,.16);justify-self:center;align-self:center}
.ev-news-shell .ev-avatar{width:48px;height:48px;border-radius:14px;font-size:16px;transition:transform .22s ease,box-shadow .22s ease}
.ev-news-shell .ev-title-wrap{justify-content:center;gap:4px}
.ev-news-shell .ev-title-main{font-size:15.5px;line-height:1.25}
.ev-news-shell .ev-title-sub{font-size:12.5px;line-height:1.35}
.ev-news-shell .ev-meta-grid{padding-left:0;gap:8px}
.ev-news-shell .ev-item-side{min-width:178px;align-items:flex-end}
.ev-news-shell .ev-actions{display:inline-flex}
@media(max-width:860px){
  .ev-news-shell .ev-list-item{grid-template-columns:30px 48px minmax(0,1fr)}
  .ev-news-shell .ev-item-index{display:inline-flex}
  .ev-news-shell .ev-item-side{grid-column:1/-1;min-width:0;width:100%;align-items:center}
  .ev-news-shell .ev-meta-grid{padding-left:0}
}
@media(max-width:640px){
  .ev-news-shell .ev-list-item{grid-template-columns:28px 46px minmax(0,1fr);gap:10px;padding:14px}
  .ev-news-shell .ev-item-index{width:25px;height:25px;font-size:9.5px;border-radius:8px}
  .ev-news-shell .ev-avatar{width:46px;height:46px}
  .ev-news-shell .ev-meta-grid{padding-left:0}
.ev-news-shell .ev-cell-meta{width:100%;justify-content:flex-start}
  .ev-news-shell .ev-item-side{align-items:flex-start}
}

.ev-news-shell .ev-hero-tile{animation:none}

.ev-news-shell.is-dark {
  color-scheme: dark;
}

.ev-news-shell.is-dark .ev-hero,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-hero,
:global(html.dark) .ev-news-shell .ev-hero {
  background: linear-gradient(135deg, #081225 0%, #11294d 52%, #164e77 100%);
  border-color: rgba(71, 85, 105, 0.5);
  box-shadow: 0 22px 58px rgba(2, 6, 23, 0.42);
  color: #f8fafc;
}

.ev-news-shell.is-dark .ev-breadcrumb,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-breadcrumb,
:global(html.dark) .ev-news-shell .ev-breadcrumb {
  color: #93c5fd;
}

.ev-news-shell.is-dark .ev-breadcrumb span,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-breadcrumb span,
:global(html.dark) .ev-news-shell .ev-breadcrumb span {
  color: rgba(255, 255, 255, 0.4);
}

.ev-news-shell.is-dark .ev-hero-title,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-hero-title,
:global(html.dark) .ev-news-shell .ev-hero-title {
  color: #f8fafc;
}

.ev-news-shell.is-dark .ev-hero-desc,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-hero-desc,
:global(html.dark) .ev-news-shell .ev-hero-desc {
  color: rgba(226, 232, 240, 0.84);
}

.ev-news-shell.is-dark .ev-stat-card,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-stat-card,
:global(html.dark) .ev-news-shell .ev-stat-card {
  background: rgba(15, 23, 42, 0.55);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow: 0 16px 34px rgba(2, 6, 23, 0.28);
}

.ev-news-shell.is-dark .ev-stat-head span,
.ev-news-shell.is-dark .ev-stat-card strong,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-stat-head span,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-stat-card strong,
:global(html.dark) .ev-news-shell .ev-stat-head span,
:global(html.dark) .ev-news-shell .ev-stat-card strong {
  color: #f8fafc;
}

.ev-news-shell.is-dark .ev-content-card,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-content-card,
:global(html.dark) .ev-news-shell .ev-content-card {
  background: linear-gradient(180deg, #0b1220 0%, #111827 100%);
  border-color: #22314a;
  box-shadow: 0 22px 54px rgba(2, 6, 23, 0.34);
}

.ev-news-shell.is-dark .ev-toolbar,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-toolbar,
:global(html.dark) .ev-news-shell .ev-toolbar {
  background: rgba(15, 23, 42, 0.78);
  border-color: rgba(51, 65, 85, 0.85);
  box-shadow: none;
}

.ev-news-shell.is-dark .ev-tabs,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-tabs,
:global(html.dark) .ev-news-shell .ev-tabs {
  background: #111c2e;
  border-color: #24364f;
}

.ev-news-shell.is-dark .ev-tab,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-tab,
:global(html.dark) .ev-news-shell .ev-tab {
  color: #94a3b8;
}

.ev-news-shell.is-dark .ev-tab:hover,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-tab:hover,
:global(html.dark) .ev-news-shell .ev-tab:hover {
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.05);
}

.ev-news-shell.is-dark .ev-tab.active,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-tab.active,
:global(html.dark) .ev-news-shell .ev-tab.active {
  background: #17243a;
  color: #f8fafc;
  box-shadow: none;
}

.ev-news-shell.is-dark .ev-search,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-search,
:global(html.dark) .ev-news-shell .ev-search {
  background: #0b1220;
  border-color: #22314a;
}

.ev-news-shell.is-dark .ev-search i,
.ev-news-shell.is-dark .ev-search input,
.ev-news-shell.is-dark .ev-search-clear,
.ev-news-shell.is-dark .ev-per-page span,
.ev-news-shell.is-dark .ev-select,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-search i,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-search input,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-search-clear,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-per-page span,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-select,
:global(html.dark) .ev-news-shell .ev-search i,
:global(html.dark) .ev-news-shell .ev-search input,
:global(html.dark) .ev-news-shell .ev-search-clear,
:global(html.dark) .ev-news-shell .ev-per-page span,
:global(html.dark) .ev-news-shell .ev-select {
  color: #cbd5e1;
}

.ev-news-shell.is-dark .ev-search input::placeholder,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-search input::placeholder,
:global(html.dark) .ev-news-shell .ev-search input::placeholder {
  color: #64748b;
}

.ev-news-shell.is-dark .ev-select,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-select,
:global(html.dark) .ev-news-shell .ev-select {
  background: #0b1220;
  border-color: #22314a;
}

.ev-news-shell.is-dark .ev-btn-add,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-btn-add,
:global(html.dark) .ev-news-shell .ev-btn-add {
  background: linear-gradient(135deg, #0f766e, #0891b2 55%, #2563eb);
  box-shadow: 0 14px 28px rgba(15, 118, 110, 0.24);
}

.ev-news-shell.is-dark .ev-list-wrap,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-list-wrap,
:global(html.dark) .ev-news-shell .ev-list-wrap {
  background: linear-gradient(180deg, #0b1220 0%, #0f1a2d 100%);
  border-color: #22314a;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.ev-news-shell.is-dark .ev-list-item,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-list-item,
:global(html.dark) .ev-news-shell .ev-list-item {
  background: linear-gradient(180deg, #0f172a 0%, #111c2e 100%);
  border-color: #22314a;
  box-shadow: 0 12px 28px rgba(2, 6, 23, 0.24);
}

.ev-news-shell.is-dark .ev-list-item:hover,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-list-item:hover,
:global(html.dark) .ev-news-shell .ev-list-item:hover {
  background: linear-gradient(180deg, #13213a 0%, #16253f 100%);
  border-color: rgba(96, 165, 250, 0.42);
  box-shadow: 0 18px 34px rgba(2, 6, 23, 0.34);
}

.ev-news-shell.is-dark .ev-item-index,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-item-index,
:global(html.dark) .ev-news-shell .ev-item-index {
  background: linear-gradient(135deg, #0f766e, #0891b2);
  color: #fff;
  box-shadow: 0 10px 22px rgba(15, 118, 110, 0.25);
}

.ev-news-shell.is-dark .ev-title-main,
.ev-news-shell.is-dark .ev-title-sub,
.ev-news-shell.is-dark .ev-page-info,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-title-main,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-title-sub,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-page-info,
:global(html.dark) .ev-news-shell .ev-title-main,
:global(html.dark) .ev-news-shell .ev-title-sub,
:global(html.dark) .ev-news-shell .ev-page-info {
  color: #e2e8f0;
}

.ev-news-shell.is-dark .ev-title-main:hover,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-title-main:hover,
:global(html.dark) .ev-news-shell .ev-title-main:hover {
  color: #93c5fd;
}

.ev-news-shell.is-dark .ev-cell-meta,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-cell-meta,
:global(html.dark) .ev-news-shell .ev-cell-meta {
  background: #0b1220 !important;
  border-color: #24364f !important;
  color: #cbd5e1 !important;
}

.ev-news-shell.is-dark .ev-cell-meta i,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-cell-meta i,
:global(html.dark) .ev-news-shell .ev-cell-meta i {
  color: #38bdf8 !important;
}

.ev-news-shell.is-dark .ev-list-item:hover .ev-cell-meta,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-list-item:hover .ev-cell-meta,
:global(html.dark) .ev-news-shell .ev-list-item:hover .ev-cell-meta {
  background: #111c2e !important;
  border-color: rgba(96, 165, 250, 0.36) !important;
  color: #e2e8f0 !important;
}

.ev-news-shell.is-dark .ev-item-side,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-item-side,
:global(html.dark) .ev-news-shell .ev-item-side {
  border-left-color: #24364f;
}

.ev-news-shell.is-dark .ev-actions,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-actions,
:global(html.dark) .ev-news-shell .ev-actions {
  background: #0b1220;
  border-color: #22314a;
  box-shadow: 0 8px 18px rgba(2, 6, 23, 0.2);
}

.ev-news-shell.is-dark .ev-act-view,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-act-view,
:global(html.dark) .ev-news-shell .ev-act-view {
  background: rgba(14, 165, 233, 0.16);
  color: #7dd3fc;
}

.ev-news-shell.is-dark .ev-act-edit,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-act-edit,
:global(html.dark) .ev-news-shell .ev-act-edit {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
}

.ev-news-shell.is-dark .ev-act-del,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-act-del,
:global(html.dark) .ev-news-shell .ev-act-del {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
}

.ev-news-shell.is-dark .ev-badge-news,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-badge-news,
:global(html.dark) .ev-news-shell .ev-badge-news {
  background: rgba(14, 116, 144, 0.18);
  border-color: rgba(103, 232, 249, 0.24);
  color: #67e8f9;
}

.ev-news-shell.is-dark .ev-skeleton-row,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-skeleton-row,
:global(html.dark) .ev-news-shell .ev-skeleton-row {
  background: #0f172a;
  border-color: #22314a;
}

.ev-news-shell.is-dark .ev-skel,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-skel,
:global(html.dark) .ev-news-shell .ev-skel {
  background: linear-gradient(90deg, #162338 25%, #23344d 50%, #162338 75%);
  background-size: 200% 100%;
}

.ev-news-shell.is-dark .ev-empty,
:global(html[data-theme-mode="dark"]) .ev-news-shell .ev-empty,
:global(html.dark) .ev-news-shell .ev-empty {
  background: #0b1220;
  border-color: #22314a;
}
</style>
