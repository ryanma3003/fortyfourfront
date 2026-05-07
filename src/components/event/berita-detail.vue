<script lang="ts">
import { ref, computed, onMounted, nextTick, onBeforeUnmount } from "vue";
import gsap from "gsap";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useBeritaStore } from "../../stores/berita";
import { useAuthStore } from "../../stores/auth";
import { useUsersStore } from "../../stores/users";
import { useRouter, useRoute } from "vue-router";
import type { Berita } from "../../types/berita.types";
import { sanitizeRichText } from "../../utils/richText";

export default {
  components: { Pageheader },
  setup() {
    const beritaStore = useBeritaStore();
    const authStore = useAuthStore();
    const usersStore = useUsersStore();
    const router = useRouter();
    const route = useRoute();

    const dataToPass = computed(() => ({
      title: { label: "Event & Berita", path: "/event/berita" },
      currentpage: "Detail Berita",
      activepage: "Detail Berita",
    }));

    const beritaData = ref<Berita | null>(null);
    const isLoading = ref(true);
    const showToast = ref(false);
    const toastMessage = ref("");
    const toastType = ref<"success" | "error">("success");
    const isDarkMode = ref(false);
    let gsapCtx: gsap.Context | null = null;
    let themeObserver: MutationObserver | undefined;

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

    const runDetailAnimation = () => {
      nextTick(() => {
        gsapCtx?.revert();
        gsapCtx = gsap.context(() => {
          const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
          tl.from(".brd-masthead", { y: 16, opacity: 0, duration: 0.44 })
            .from(".brd-meta-pill", { y: 8, opacity: 0, duration: 0.24, stagger: 0.045 }, "-=0.18")
            .from(".brd-panel", { y: 16, opacity: 0, duration: 0.34, stagger: 0.075 }, "-=0.12")
            .from(".brd-info-row", { x: 12, opacity: 0, duration: 0.24, stagger: 0.045 }, "-=0.12");
        });
      });
    };

    onMounted(async () => {
      syncThemeMode();
      if (typeof document !== "undefined") {
        themeObserver = new MutationObserver(syncThemeMode);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-mode", "class"] });
      }
      try {
        await usersStore.initialize().catch(() => undefined);
        const data = await beritaStore.fetchBeritaById(Number(route.params.id));
        if (data) {
          beritaData.value = data;
        } else {
          showNotification("Berita tidak ditemukan", "error");
          router.push("/event/berita");
        }
      } catch {
        showNotification("Gagal memuat detail berita", "error");
        router.push("/event/berita");
      } finally {
        isLoading.value = false;
        runDetailAnimation();
      }
    });

    onBeforeUnmount(() => {
      gsapCtx?.revert();
      themeObserver?.disconnect();
    });

    const goBack = () => router.push("/event/berita");
    const goEdit = () => {
      if (beritaData.value) router.push(`/event/berita/edit/${beritaData.value.id}`);
    };

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

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '-';
      try {
        return new Date(dateStr).toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return dateStr;
      }
    };

    const formatDateShort = (dateStr: string) => {
      if (!dateStr) return '-';
      try {
        return new Date(dateStr).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return dateStr;
      }
    };

    const htmlOrFallback = (value: string) => {
      if (!value?.trim()) return 'Tidak ada deskripsi tersedia.';
      return sanitizeRichText(value);
    };

    return {
      dataToPass, beritaData, isLoading, isDarkMode, goBack, goEdit, showToast, toastMessage, toastType,
      getAuthorName, formatDate, formatDateShort, htmlOrFallback
    };
  },
};
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <transition name="toast-slide">
    <div v-if="showToast" class="toast-wrapper position-fixed" style="z-index: 9999; top: 20px; right: 20px;">
      <div class="toast-modern" :class="toastType === 'success' ? 'toast-success bg-success text-white' : 'toast-error bg-danger text-white'" role="alert">
        <div class="d-flex p-3 rounded shadow">
          <div class="me-2">
            <i :class="toastType === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'" class="fs-5"></i>
          </div>
          <div>
            <div class="fw-bold mb-1">{{ toastType === 'success' ? 'Berhasil' : 'Gagal' }}</div>
            <div class="fs-13">{{ toastMessage }}</div>
          </div>
        </div>
      </div>
    </div>
  </transition>

  <section :class="['brd-shell', { 'is-dark': isDarkMode }]" v-if="isLoading">
    <div class="brd-loading">
      <span class="spinner-border spinner-border-sm"></span>
      <p>Memuat detail berita...</p>
    </div>
  </section>

  <section :class="['brd-shell', { 'is-dark': isDarkMode }]" v-else-if="beritaData">
    <header class="brd-masthead">
      <div class="brd-line"></div>
      <div class="brd-topbar">
        <button type="button" class="brd-icon-btn" @click="goBack" title="Kembali"><i class="ri-arrow-left-line"></i></button>
        <span class="brd-meta-pill"><i class="ri-newspaper-line"></i> Berita</span>
        <span class="brd-meta-pill"><i class="ri-user-3-line"></i> {{ getAuthorName(beritaData) }}</span>
      </div>
      <h1>{{ beritaData.judul }}</h1>
      <p>Dipublikasikan pada {{ formatDate(beritaData.created_at) }}</p>
      <div class="brd-actions">
        <button type="button" class="brd-btn brd-btn-soft" @click="goBack"><i class="ri-arrow-left-line"></i><span>Kembali</span></button>
        <button type="button" class="brd-btn brd-btn-dark" @click="goEdit"><i class="ri-edit-line"></i><span>Edit Berita</span></button>
      </div>
    </header>

    <div class="brd-layout">
      <main class="brd-panel brd-reader">
        <div class="brd-panel-head">
          <span>Isi Berita</span>
          <i class="ri-quill-pen-line"></i>
        </div>
        <div class="event-html-content" v-html="htmlOrFallback(beritaData.deskripsi)"></div>
      </main>

      <aside class="brd-panel brd-sidebar">
        <div class="brd-panel-head">
          <span>Informasi Sistem</span>
          <i class="ri-information-line"></i>
        </div>
        <div class="brd-info-row"><span><i class="ri-hashtag"></i>Berita ID</span><strong>#{{ beritaData.id }}</strong></div>
        <div class="brd-info-row"><span><i class="ri-user-line"></i>Pembuat</span><strong>{{ getAuthorName(beritaData) }}</strong></div>
        <div class="brd-info-row"><span><i class="ri-time-line"></i>Dibuat</span><strong>{{ formatDateShort(beritaData.created_at) }}</strong></div>
        <div class="brd-info-row"><span><i class="ri-history-line"></i>Diupdate</span><strong>{{ formatDateShort(beritaData.updated_at) }}</strong></div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.brd-shell{position:relative;padding:2px 2px 18px;color:#14213d}
.brd-loading{min-height:260px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;border-radius:18px;background:#f8fbff;border:1px solid #dbeafe;box-shadow:0 18px 42px rgba(20,33,61,.07);color:#2563eb}
.brd-loading p{margin:0;font-size:13px;font-weight:800;color:#52616b}
.brd-masthead{position:relative;overflow:hidden;border-radius:18px;padding:34px 36px;background:linear-gradient(135deg,#f8fbff 0%,#eff6ff 58%,#eaf7ff 100%);border:1px solid #cfe0ff;box-shadow:0 22px 54px rgba(37,99,235,.1)}
.brd-masthead::before{content:"";position:absolute;right:-120px;bottom:-150px;width:360px;height:360px;border-radius:999px;background:radial-gradient(circle,rgba(37,99,235,.13),transparent 66%)}
.brd-topbar{position:relative;z-index:1;display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:18px}
.brd-icon-btn{width:36px;height:36px;border-radius:11px;border:1px solid #cfe0ff;background:#fff;color:#2563eb;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease}
.brd-icon-btn:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(37,99,235,.12)}
.brd-meta-pill{display:inline-flex;align-items:center;gap:7px;border:1px solid #cfe0ff;background:#ffffffb8;border-radius:999px;padding:7px 11px;font-size:11.5px;font-weight:900;color:#1d4ed8}
.brd-masthead h1{position:relative;z-index:1;max-width:900px;margin:0;font-size:34px;line-height:1.16;font-weight:900;color:#14213d;letter-spacing:0}
.brd-masthead p{position:relative;z-index:1;margin:12px 0 0;color:#64748b;font-size:14px;line-height:1.6}
.brd-actions{position:relative;z-index:1;display:flex;gap:9px;flex-wrap:wrap;margin-top:22px}
.brd-btn{border:0;border-radius:11px;display:inline-flex;align-items:center;gap:8px;padding:10px 14px;font-size:13px;font-weight:900;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease}
.brd-btn:hover{transform:translateY(-2px)}
.brd-btn-soft{background:#fff;color:#1d4ed8;border:1px solid #cfe0ff}
.brd-btn-dark{background:#1d4ed8;color:#fff;box-shadow:0 16px 28px rgba(37,99,235,.2)}
.brd-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:18px;margin-top:18px;align-items:start}
.brd-panel{background:#fff;border:1px solid #dbeafe;border-radius:16px;box-shadow:0 18px 42px rgba(20,33,61,.07)}
.brd-reader{padding:30px}
.brd-sidebar{padding:18px;position:sticky;top:90px}
.brd-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid #edf4ff;font-size:13px;font-weight:900;color:#14213d}
.brd-panel-head i{font-size:18px;color:#2563eb}
.brd-info-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 0;border-bottom:1px solid #edf4ff}
.brd-info-row:last-child{border-bottom:0}
.brd-info-row span{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;color:#64748b}
.brd-info-row span i{color:#2563eb}
.brd-info-row strong{font-size:12.5px;color:#14213d;text-align:right;line-height:1.35}
.event-html-content {
  line-height: 1.75;
  color:#253044;
  font-size:14px;
}

.event-html-content :deep(p) {
  margin-bottom: 0.85rem;
}

.event-html-content :deep(ul),
.event-html-content :deep(ol) {
  padding-left: 1.25rem;
  margin-bottom: 0.85rem;
}

.event-html-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius:14px;
  border:1px solid #e2e8f0;
  box-shadow:0 16px 38px rgba(20,33,61,.08);
}

.brd-shell.is-dark,
:global(html[data-theme-mode="dark"]) .brd-shell,
:global(html.dark) .brd-shell {
  color-scheme: dark;
}

.brd-shell.is-dark .brd-loading,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-loading,
:global(html.dark) .brd-shell .brd-loading {
  background: linear-gradient(180deg, #0b1220, #111827);
  border-color: #22314a;
  color: #38bdf8;
  box-shadow: 0 18px 42px rgba(2, 6, 23, 0.34);
}

.brd-shell.is-dark .brd-loading p,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-loading p,
:global(html.dark) .brd-shell .brd-loading p {
  color: #cbd5e1;
}

.brd-shell.is-dark .brd-masthead,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-masthead,
:global(html.dark) .brd-shell .brd-masthead {
  background: linear-gradient(135deg, #081225 0%, #11294d 54%, #164e77 100%);
  border-color: #22314a;
  box-shadow: 0 22px 54px rgba(2, 6, 23, 0.38);
}

.brd-shell.is-dark .brd-masthead::before,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-masthead::before,
:global(html.dark) .brd-shell .brd-masthead::before {
  background: radial-gradient(circle, rgba(125, 211, 252, 0.16), transparent 66%);
}

.brd-shell.is-dark .brd-icon-btn,
.brd-shell.is-dark .brd-meta-pill,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-icon-btn,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-meta-pill,
:global(html.dark) .brd-shell .brd-icon-btn,
:global(html.dark) .brd-shell .brd-meta-pill {
  background: rgba(15, 23, 42, 0.42);
  border-color: rgba(148, 163, 184, 0.24);
  color: #e0f2fe;
}

.brd-shell.is-dark .brd-masthead h1,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-masthead h1,
:global(html.dark) .brd-shell .brd-masthead h1 {
  color: #f8fafc;
}

.brd-shell.is-dark .brd-masthead p,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-masthead p,
:global(html.dark) .brd-shell .brd-masthead p {
  color: rgba(226, 232, 240, 0.82);
}

.brd-shell.is-dark .brd-btn-soft,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-btn-soft,
:global(html.dark) .brd-shell .brd-btn-soft {
  background: rgba(15, 23, 42, 0.46);
  border-color: rgba(148, 163, 184, 0.28);
  color: #f8fafc;
}

.brd-shell.is-dark .brd-btn-dark,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-btn-dark,
:global(html.dark) .brd-shell .brd-btn-dark {
  background: #17243a;
  color: #93c5fd;
  box-shadow: 0 16px 30px rgba(2, 6, 23, 0.28);
}

.brd-shell.is-dark .brd-panel,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-panel,
:global(html.dark) .brd-shell .brd-panel {
  background: linear-gradient(180deg, #0f172a 0%, #111c2e 100%);
  border-color: #22314a;
  box-shadow: 0 18px 42px rgba(2, 6, 23, 0.3);
}

.brd-shell.is-dark .brd-panel-head,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-panel-head,
:global(html.dark) .brd-shell .brd-panel-head {
  border-bottom-color: #24364f;
  color: #f8fafc;
}

.brd-shell.is-dark .brd-panel-head i,
.brd-shell.is-dark .brd-info-row span i,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-panel-head i,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-info-row span i,
:global(html.dark) .brd-shell .brd-panel-head i,
:global(html.dark) .brd-shell .brd-info-row span i {
  color: #38bdf8;
}

.brd-shell.is-dark .brd-info-row,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-info-row,
:global(html.dark) .brd-shell .brd-info-row {
  border-bottom-color: #24364f;
}

.brd-shell.is-dark .brd-info-row span,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-info-row span,
:global(html.dark) .brd-shell .brd-info-row span {
  color: #94a3b8;
}

.brd-shell.is-dark .brd-info-row strong,
:global(html[data-theme-mode="dark"]) .brd-shell .brd-info-row strong,
:global(html.dark) .brd-shell .brd-info-row strong {
  color: #e2e8f0;
}

.brd-shell.is-dark .event-html-content,
:global(html[data-theme-mode="dark"]) .brd-shell .event-html-content,
:global(html.dark) .brd-shell .event-html-content {
  color: #cbd5e1;
}

.brd-shell.is-dark .event-html-content :deep(*),
:global(html[data-theme-mode="dark"]) .brd-shell .event-html-content :deep(*),
:global(html.dark) .brd-shell .event-html-content :deep(*) {
  background-color: transparent !important;
  color: white;
}

.brd-shell.is-dark .event-html-content :deep(div),
.brd-shell.is-dark .event-html-content :deep(p),
.brd-shell.is-dark .event-html-content :deep(li),
.brd-shell.is-dark .event-html-content :deep(blockquote),
:global(html[data-theme-mode="dark"]) .brd-shell .event-html-content :deep(div),
:global(html[data-theme-mode="dark"]) .brd-shell .event-html-content :deep(p),
:global(html[data-theme-mode="dark"]) .brd-shell .event-html-content :deep(li),
:global(html[data-theme-mode="dark"]) .brd-shell .event-html-content :deep(blockquote),
:global(html.dark) .brd-shell .event-html-content :deep(div),
:global(html.dark) .brd-shell .event-html-content :deep(p),
:global(html.dark) .brd-shell .event-html-content :deep(li),
:global(html.dark) .brd-shell .event-html-content :deep(blockquote) {
  border-color: rgba(148, 163, 184, 0.18) !important;
}

.brd-shell.is-dark .event-html-content :deep(h1),
.brd-shell.is-dark .event-html-content :deep(h2),
.brd-shell.is-dark .event-html-content :deep(h3),
.brd-shell.is-dark .event-html-content :deep(h4),
.brd-shell.is-dark .event-html-content :deep(strong),
:global(html[data-theme-mode="dark"]) .brd-shell .event-html-content :deep(h1),
:global(html[data-theme-mode="dark"]) .brd-shell .event-html-content :deep(h2),
:global(html[data-theme-mode="dark"]) .brd-shell .event-html-content :deep(h3),
:global(html[data-theme-mode="dark"]) .brd-shell .event-html-content :deep(h4),
:global(html[data-theme-mode="dark"]) .brd-shell .event-html-content :deep(strong),
:global(html.dark) .brd-shell .event-html-content :deep(h1),
:global(html.dark) .brd-shell .event-html-content :deep(h2),
:global(html.dark) .brd-shell .event-html-content :deep(h3),
:global(html.dark) .brd-shell .event-html-content :deep(h4),
:global(html.dark) .brd-shell .event-html-content :deep(strong) {
  color: #f8fafc;
}

.brd-shell.is-dark .event-html-content :deep(a),
:global(html[data-theme-mode="dark"]) .brd-shell .event-html-content :deep(a),
:global(html.dark) .brd-shell .event-html-content :deep(a) {
  color: #7dd3fc;
}

.brd-shell.is-dark .event-html-content :deep(img),
:global(html[data-theme-mode="dark"]) .brd-shell .event-html-content :deep(img),
:global(html.dark) .brd-shell .event-html-content :deep(img) {
  border-color: #24364f;
  box-shadow: 0 16px 38px rgba(2, 6, 23, 0.32);
}

@media(max-width:1100px){
  .brd-layout{grid-template-columns:1fr}
  .brd-sidebar{position:static}
}

@media(max-width:640px){
  .brd-masthead{padding:26px 24px}
  .brd-masthead h1{font-size:26px}
  .brd-reader{padding:22px}
  .brd-btn{width:100%;justify-content:center}
}
</style>
