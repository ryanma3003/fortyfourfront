<script lang="ts">
import { ref, computed, onMounted, nextTick, onBeforeUnmount } from "vue";
import gsap from "gsap";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useEventStore } from "../../stores/event";
import { useRouter, useRoute } from "vue-router";
import type { Kegiatan } from "../../types/kegiatan.types";
import { sanitizeRichText } from "../../utils/richText";
import { formatEventDate, formatEventDateShort } from "../../utils/eventDate";

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
    const routeEventIdentifier = computed(() => {
      const raw = Array.isArray(route.params.slug) ? route.params.slug[0] : (route.params.slug ?? route.params.id);
      const identifier = String(raw || '').trim();
      return identifier && identifier !== 'NaN' && identifier !== 'undefined' && identifier !== 'null' ? identifier : '';
    });

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
        const hero = document.querySelector('.evd-hero');
        if (!hero) return;
        gsapCtx = gsap.context(() => {
          const chips = document.querySelectorAll('.evd-chip');
          const panels = document.querySelectorAll('.evd-panel');
          const infoRows = document.querySelectorAll('.evd-info-row');
          const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
          tl.from(hero, { y: 18, opacity: 0, duration: 0.45 });
          if (chips.length) tl.from(chips, { y: 10, opacity: 0, duration: 0.26, stagger: 0.04 }, "-=0.2");
          if (panels.length) tl.from(panels, { y: 18, opacity: 0, duration: 0.36, stagger: 0.07 }, "-=0.16");
          if (infoRows.length) tl.from(infoRows, { x: 12, opacity: 0, duration: 0.26, stagger: 0.045 }, "-=0.14");
        }, hero);
      });
    };

    onMounted(async () => {
      syncThemeMode();
      if (typeof document !== "undefined") {
        themeObserver = new MutationObserver(syncThemeMode);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-mode", "class"] });
      }
      try {
        if (!routeEventIdentifier.value) {
          showNotification("Identifier event tidak valid", "error");
          router.push("/event");
          return;
        }

        const data = await eventStore.fetchEventByIdentifier(routeEventIdentifier.value);
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
        if (eventData.value) runDetailAnimation();
      }
    });

    onBeforeUnmount(() => {
      gsapCtx?.revert();
      themeObserver?.disconnect();
    });

    const goBack = () => router.push("/event");
    const goEdit = () => {
      if (eventData.value) {
        router.push(`/event/edit/${encodeURIComponent(String(eventData.value.id))}`);
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

    const htmlOrFallback = (value: string) => {
      if (!value?.trim()) return 'Tidak ada deskripsi tersedia.';
      return sanitizeRichText(value);
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
      formatDate: formatEventDate,
      formatDateShort: formatEventDateShort,
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
          <div class="evd-info-row"><span><i class="ri-time-line"></i>Dibuat</span><strong>{{ formatDateShort(eventData.created_at) }}</strong></div>
          <div class="evd-info-row"><span><i class="ri-history-line"></i>Diupdate</span><strong>{{ formatDateShort(eventData.updated_at) }}</strong></div>
        </div>
      </aside>
    </div>
  </section>
</template>

<style src="../../assets/css/event-berita.css"></style>
