<script lang="ts">
import { ref, computed, onMounted, nextTick, onBeforeUnmount } from "vue";
import gsap from "gsap";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useEventStore } from "../../stores/event";
import { useRouter, useRoute } from "vue-router";
import type { Kegiatan } from "../../types/kegiatan.types";

export default {
  components: { Pageheader },
  setup() {
    const eventStore = useEventStore();
    const router = useRouter();
    const route = useRoute();

    const dataToPass = computed(() => ({
      title: { label: "Event & Kegiatan", path: "/event" },
      currentpage: "Detail Event",
      activepage: "Detail Event",
    }));

    const eventData = ref<Kegiatan | null>(null);
    const isLoading = ref(true);
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

    const runDetailAnimation = () => {
      nextTick(() => {
        gsapCtx?.revert();
        gsapCtx = gsap.context(() => {
          const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
          tl.from(".evd-hero", { y: 18, opacity: 0, duration: 0.45 })
            .from(".evd-chip", { y: 10, opacity: 0, duration: 0.26, stagger: 0.04 }, "-=0.2")
            .from(".evd-panel", { y: 18, opacity: 0, duration: 0.36, stagger: 0.07 }, "-=0.16")
            .from(".evd-info-row", { x: 12, opacity: 0, duration: 0.26, stagger: 0.045 }, "-=0.14");
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
        const id = Number(route.params.id);
        const data = await eventStore.fetchEventById(id);
        if (data) {
          eventData.value = data;
        } else {
          showNotification("Event tidak ditemukan", "error");
          router.push("/event");
        }
      } catch (e) {
        showNotification("Gagal memuat detail event", "error");
        router.push("/event");
      } finally {
        isLoading.value = false;
        runDetailAnimation();
      }
    });

    onBeforeUnmount(() => {
      gsapCtx?.revert();
      themeObserver?.disconnect();
    });

    const goBack = () => router.push("/event");
    const goEdit = () => {
      if (eventData.value) {
        router.push(`/event/edit/${eventData.value.id}`);
      }
    };

    const getStatusClass = (status: string) => {
      const s = (status || '').toLowerCase();
      if (s === 'upcoming' || s === 'akan datang') return 'bg-warning-transparent text-warning';
      if (s === 'ongoing' || s === 'berlangsung' || s === 'sedang berjalan') return 'bg-success-transparent text-success';
      if (s === 'selesai' || s === 'past' || s === 'completed') return 'bg-secondary-transparent text-secondary';
      if (s === 'aktif' || s === 'active') return 'bg-success-transparent text-success';
      return 'bg-light text-muted';
    };

    const getStatusText = (status: string) => {
      const s = (status || '').toLowerCase();
      if (s === 'upcoming' || s === 'akan datang') return 'Upcoming';
      if (s === 'ongoing' || s === 'berlangsung' || s === 'sedang berjalan') return 'Sedang Berjalan';
      if (s === 'selesai' || s === 'past' || s === 'completed') return 'Selesai';
      if (s === 'aktif' || s === 'active') return 'Aktif';
      return status || '-';
    };

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '-';
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', {
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
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', {
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

    const decodeHtmlEntities = (value: string): string => {
      if (typeof document === 'undefined') return value;

      let decoded = value;
      for (let i = 0; i < 2; i += 1) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = decoded;
        const next = textarea.value;
        if (next === decoded) break;
        decoded = next;
      }

      return decoded;
    };

    const sanitizeRichText = (value: string): string => {
      if (typeof document === 'undefined') return value;

      const template = document.createElement('template');
      template.innerHTML = value;

      template.content.querySelectorAll('script, iframe, object, embed').forEach((node) => node.remove());
      template.content.querySelectorAll('*').forEach((node) => {
        [...node.attributes].forEach((attr) => {
          const name = attr.name.toLowerCase();
          const value = attr.value.trim().toLowerCase();
          const isUnsafeUrl = ['href', 'src'].includes(name) && value.startsWith('javascript:');

          if (name.startsWith('on') || isUnsafeUrl) {
            node.removeAttribute(attr.name);
          }
        });
      });

      return template.innerHTML;
    };

    const htmlOrFallback = (value: string) => {
      if (!value?.trim()) return 'Tidak ada deskripsi tersedia.';
      return sanitizeRichText(decodeHtmlEntities(value));
    };

    return {
      dataToPass,
      eventData,
      isLoading,
      isDarkMode,
      goBack,
      goEdit,
      showToast,
      toastMessage,
      toastType,
      getStatusClass,
      getStatusText,
      formatDate,
      formatDateShort,
      htmlOrFallback
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

  <section :class="['evd-shell', { 'is-dark': isDarkMode }]" v-if="isLoading">
    <div class="evd-loading">
      <span class="spinner-border spinner-border-sm"></span>
      <p>Memuat detail event...</p>
    </div>
  </section>

  <section :class="['evd-shell', { 'is-dark': isDarkMode }]" v-else-if="eventData">
    <div class="evd-hero">
      <div class="evd-hero-mark"><i class="ri-calendar-event-line"></i></div>
      <div class="evd-hero-main">
        <div class="evd-kicker">
          <span class="evd-chip">Kegiatan</span>
          <span class="evd-chip evd-chip-status">{{ getStatusText(eventData.status) }}</span>
        </div>
        <h1>{{ eventData.judul }}</h1>
        <p>Ringkasan detail kegiatan, jadwal, lokasi, dan informasi sistem dalam satu tampilan yang mudah discan.</p>
      </div>
      <div class="evd-hero-actions">
        <button type="button" class="evd-btn evd-btn-ghost" @click="goBack"><i class="ri-arrow-left-line"></i><span>Kembali</span></button>
        <button type="button" class="evd-btn evd-btn-primary" @click="goEdit"><i class="ri-edit-line"></i><span>Edit Event</span></button>
      </div>
    </div>

    <div class="evd-grid">
      <main class="evd-panel evd-article">
        <div class="evd-section-head">
          <span>Deskripsi Kegiatan</span>
          <i class="ri-file-text-line"></i>
        </div>
        <div class="event-html-content" v-html="htmlOrFallback(eventData.deskripsi)"></div>
      </main>

      <aside class="evd-side">
        <div class="evd-panel evd-summary">
          <div class="evd-section-head">
            <span>Agenda</span>
            <i class="ri-sparkling-line"></i>
          </div>
          <div class="evd-metric">
            <div class="evd-metric-icon"><i class="ri-map-pin-line"></i></div>
            <div>
              <span>Lokasi</span>
              <strong>{{ eventData.lokasi || '-' }}</strong>
            </div>
          </div>
          <div class="evd-metric">
            <div class="evd-metric-icon"><i class="ri-calendar-check-line"></i></div>
            <div>
              <span>Waktu Pelaksanaan</span>
              <strong>{{ formatDate(eventData.tanggal) }}</strong>
            </div>
          </div>
        </div>

        <div class="evd-panel evd-system">
          <div class="evd-section-head">
            <span>Informasi Sistem</span>
            <i class="ri-database-2-line"></i>
          </div>
          <div class="evd-info-row"><span><i class="ri-hashtag"></i>Event ID</span><strong>#{{ eventData.id }}</strong></div>
          <div class="evd-info-row"><span><i class="ri-time-line"></i>Dibuat</span><strong>{{ formatDateShort(eventData.created_at) }}</strong></div>
          <div class="evd-info-row"><span><i class="ri-history-line"></i>Diupdate</span><strong>{{ formatDateShort(eventData.updated_at) }}</strong></div>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.evd-shell{position:relative;padding:2px 2px 18px}
.evd-loading{min-height:260px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;border:1px solid #dfe7ef;border-radius:18px;background:linear-gradient(180deg,#f8fbff,#eef6ff);color:#2563eb;box-shadow:0 18px 42px rgba(15,23,42,.07)}
.evd-loading p{margin:0;font-size:13px;font-weight:800;color:#475569}
.evd-hero{position:relative;overflow:hidden;display:flex;align-items:flex-start;gap:18px;padding:28px;border-radius:18px;background:linear-gradient(135deg,#0f1f57 0%,#2454d8 54%,#0ea5e9 100%);box-shadow:0 24px 56px rgba(37,99,235,.24);color:#fff}
.evd-hero::before{content:"";position:absolute;right:-90px;top:-110px;width:360px;height:360px;border-radius:999px;background:radial-gradient(circle,rgba(191,219,254,.32),transparent 65%)}
.evd-hero::after{content:"";position:absolute;left:28%;bottom:-150px;width:320px;height:320px;border-radius:999px;background:radial-gradient(circle,rgba(125,211,252,.2),transparent 66%)}
.evd-hero>*{position:relative;z-index:1}
.evd-hero-mark{width:58px;height:58px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);box-shadow:inset 0 -16px 24px rgba(0,0,0,.14)}
.evd-hero-mark i{font-size:28px;color:#bfdbfe}
.evd-hero-main{min-width:0;flex:1}
.evd-kicker{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.evd-chip{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2);font-size:11px;font-weight:900;letter-spacing:.02em;color:#ecfeff}
.evd-chip-status{background:rgba(219,234,254,.18);color:#dbeafe}
.evd-hero h1{font-size:30px;line-height:1.15;font-weight:900;margin:0;letter-spacing:0;color:#fff}
.evd-hero p{max-width:720px;margin:10px 0 0;color:rgba(255,255,255,.78);line-height:1.6;font-size:14px}
.evd-hero-actions{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}
.evd-btn{border:0;border-radius:11px;display:inline-flex;align-items:center;gap:8px;padding:10px 14px;font-size:13px;font-weight:900;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease,background .2s ease}
.evd-btn:hover{transform:translateY(-2px)}
.evd-btn-ghost{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.22)}
.evd-btn-primary{background:#f8fafc;color:#1d4ed8;box-shadow:0 16px 30px rgba(15,23,42,.18)}
.evd-grid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:18px;margin-top:18px;align-items:start}
.evd-panel{border:1px solid #dfe7ef;border-radius:16px;background:#fff;box-shadow:0 18px 42px rgba(15,23,42,.07)}
.evd-article{padding:28px}
.evd-side{display:flex;flex-direction:column;gap:18px}
.evd-summary,.evd-system{padding:18px}
.evd-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid #e8eef4;color:#0f172a;font-size:13px;font-weight:900}
.evd-section-head i{font-size:18px;color:#2563eb}
.evd-metric{display:flex;gap:12px;padding:14px;border-radius:14px;background:#f5f9ff;border:1px solid #dbeafe}
.evd-metric+.evd-metric{margin-top:10px}
.evd-metric-icon{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#fff;color:#2563eb;box-shadow:0 8px 18px rgba(37,99,235,.1)}
.evd-metric span,.evd-info-row span{display:flex;align-items:center;gap:7px;color:#64748b;font-size:12px;font-weight:800}
.evd-metric strong{display:block;margin-top:4px;color:#10203b;font-size:13px;line-height:1.4}
.evd-info-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 0;border-bottom:1px solid #edf2f7}
.evd-info-row:last-child{border-bottom:0}
.evd-info-row i{color:#2563eb}
.evd-info-row strong{font-size:12.5px;color:#10203b;text-align:right}
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
  box-shadow:0 16px 38px rgba(15,23,42,.08);
}

.evd-shell.is-dark,
:global(html[data-theme-mode="dark"]) .evd-shell,
:global(html.dark) .evd-shell {
  color-scheme: dark;
}

.evd-shell.is-dark .evd-loading,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-loading,
:global(html.dark) .evd-shell .evd-loading {
  background: linear-gradient(180deg, #0b1220, #111827);
  border-color: #22314a;
  color: #38bdf8;
  box-shadow: 0 18px 42px rgba(2, 6, 23, 0.34);
}

.evd-shell.is-dark .evd-loading p,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-loading p,
:global(html.dark) .evd-shell .evd-loading p {
  color: #cbd5e1;
}

.evd-shell.is-dark .evd-hero,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-hero,
:global(html.dark) .evd-shell .evd-hero {
  background: linear-gradient(135deg, #081225 0%, #11294d 54%, #164e77 100%);
  box-shadow: 0 24px 56px rgba(2, 6, 23, 0.44);
}

.evd-shell.is-dark .evd-hero-mark,
.evd-shell.is-dark .evd-chip,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-hero-mark,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-chip,
:global(html.dark) .evd-shell .evd-hero-mark,
:global(html.dark) .evd-shell .evd-chip {
  background: rgba(15, 23, 42, 0.42);
  border-color: rgba(148, 163, 184, 0.24);
}

.evd-shell.is-dark .evd-chip,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-chip,
:global(html.dark) .evd-shell .evd-chip {
  color: #e0f2fe;
}

.evd-shell.is-dark .evd-btn-ghost,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-btn-ghost,
:global(html.dark) .evd-shell .evd-btn-ghost {
  background: rgba(15, 23, 42, 0.46);
  border-color: rgba(148, 163, 184, 0.28);
  color: #f8fafc;
}

.evd-shell.is-dark .evd-btn-primary,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-btn-primary,
:global(html.dark) .evd-shell .evd-btn-primary {
  background: #17243a;
  color: #93c5fd;
  box-shadow: 0 16px 30px rgba(2, 6, 23, 0.28);
}

.evd-shell.is-dark .evd-panel,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-panel,
:global(html.dark) .evd-shell .evd-panel {
  background: linear-gradient(180deg, #0f172a 0%, #111c2e 100%);
  border-color: #22314a;
  box-shadow: 0 18px 42px rgba(2, 6, 23, 0.3);
}

.evd-shell.is-dark .evd-section-head,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-section-head,
:global(html.dark) .evd-shell .evd-section-head {
  border-bottom-color: #24364f;
  color: #f8fafc;
}

.evd-shell.is-dark .evd-section-head i,
.evd-shell.is-dark .evd-info-row i,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-section-head i,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-info-row i,
:global(html.dark) .evd-shell .evd-section-head i,
:global(html.dark) .evd-shell .evd-info-row i {
  color: #38bdf8;
}

.evd-shell.is-dark .evd-metric,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-metric,
:global(html.dark) .evd-shell .evd-metric {
  background: #0b1220;
  border-color: #24364f;
}

.evd-shell.is-dark .evd-metric-icon,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-metric-icon,
:global(html.dark) .evd-shell .evd-metric-icon {
  background: #17243a;
  color: #38bdf8;
  box-shadow: none;
}

.evd-shell.is-dark .evd-metric span,
.evd-shell.is-dark .evd-info-row span,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-metric span,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-info-row span,
:global(html.dark) .evd-shell .evd-metric span,
:global(html.dark) .evd-shell .evd-info-row span {
  color: #94a3b8;
}

.evd-shell.is-dark .evd-metric strong,
.evd-shell.is-dark .evd-info-row strong,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-metric strong,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-info-row strong,
:global(html.dark) .evd-shell .evd-metric strong,
:global(html.dark) .evd-shell .evd-info-row strong {
  color: #e2e8f0;
}

.evd-shell.is-dark .evd-info-row,
:global(html[data-theme-mode="dark"]) .evd-shell .evd-info-row,
:global(html.dark) .evd-shell .evd-info-row {
  border-bottom-color: #24364f;
}

.evd-shell.is-dark .event-html-content,
:global(html[data-theme-mode="dark"]) .evd-shell .event-html-content,
:global(html.dark) .evd-shell .event-html-content {
  color: #cbd5e1;
}

.evd-shell.is-dark .event-html-content :deep(h1),
.evd-shell.is-dark .event-html-content :deep(h2),
.evd-shell.is-dark .event-html-content :deep(h3),
.evd-shell.is-dark .event-html-content :deep(h4),
.evd-shell.is-dark .event-html-content :deep(strong),
:global(html[data-theme-mode="dark"]) .evd-shell .event-html-content :deep(h1),
:global(html[data-theme-mode="dark"]) .evd-shell .event-html-content :deep(h2),
:global(html[data-theme-mode="dark"]) .evd-shell .event-html-content :deep(h3),
:global(html[data-theme-mode="dark"]) .evd-shell .event-html-content :deep(h4),
:global(html[data-theme-mode="dark"]) .evd-shell .event-html-content :deep(strong),
:global(html.dark) .evd-shell .event-html-content :deep(h1),
:global(html.dark) .evd-shell .event-html-content :deep(h2),
:global(html.dark) .evd-shell .event-html-content :deep(h3),
:global(html.dark) .evd-shell .event-html-content :deep(h4),
:global(html.dark) .evd-shell .event-html-content :deep(strong) {
  color: #f8fafc;
}

.evd-shell.is-dark .event-html-content :deep(a),
:global(html[data-theme-mode="dark"]) .evd-shell .event-html-content :deep(a),
:global(html.dark) .evd-shell .event-html-content :deep(a) {
  color: #7dd3fc;
}

.evd-shell.is-dark .event-html-content :deep(img),
:global(html[data-theme-mode="dark"]) .evd-shell .event-html-content :deep(img),
:global(html.dark) .evd-shell .event-html-content :deep(img) {
  border-color: #24364f;
  box-shadow: 0 16px 38px rgba(2, 6, 23, 0.32);
}

@media(max-width:1100px){
  .evd-hero{flex-direction:column}
  .evd-hero-actions{justify-content:flex-start}
  .evd-grid{grid-template-columns:1fr}
}

@media(max-width:640px){
  .evd-hero{padding:22px}
  .evd-hero h1{font-size:24px}
  .evd-btn{width:100%;justify-content:center}
  .evd-article{padding:20px}
}
</style>
