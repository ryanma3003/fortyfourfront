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
import { formatEventDate, formatEventDateShort } from "../../utils/eventDate";

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
    const routeBeritaId = computed(() => {
      const raw = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id;
      const id = String(raw || '').trim();
      return id && id !== 'NaN' && id !== 'undefined' && id !== 'null' ? id : '';
    });

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
        const masthead = document.querySelector('.brd-masthead');
        if (!masthead) return;
        gsapCtx = gsap.context(() => {
          const metaPills = document.querySelectorAll('.brd-meta-pill');
          const panels = document.querySelectorAll('.brd-panel');
          const infoRows = document.querySelectorAll('.brd-info-row');
          const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
          tl.from(masthead, { y: 16, opacity: 0, duration: 0.44 });
          if (metaPills.length) tl.from(metaPills, { y: 8, opacity: 0, duration: 0.24, stagger: 0.045 }, "-=0.18");
          if (panels.length) tl.from(panels, { y: 16, opacity: 0, duration: 0.34, stagger: 0.075 }, "-=0.12");
          if (infoRows.length) tl.from(infoRows, { x: 12, opacity: 0, duration: 0.24, stagger: 0.045 }, "-=0.12");
        }, masthead);
      });
    };

    onMounted(async () => {
      syncThemeMode();
      if (typeof document !== "undefined") {
        themeObserver = new MutationObserver(syncThemeMode);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-mode", "class"] });
      }
      try {
        if (!routeBeritaId.value) {
          showNotification("ID berita tidak valid", "error");
          router.push("/event/berita");
          return;
        }
        await usersStore.initialize().catch(() => undefined);
        const data = await beritaStore.fetchBeritaById(routeBeritaId.value);
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
        if (beritaData.value) runDetailAnimation();
      }
    });

    onBeforeUnmount(() => {
      gsapCtx?.revert();
      themeObserver?.disconnect();
    });

    const goBack = () => router.push("/event/berita");
    const goEdit = () => {
      if (beritaData.value) router.push(`/event/berita/edit/${encodeURIComponent(String(beritaData.value.id))}`);
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

    const htmlOrFallback = (value: string) => {
      if (!value?.trim()) return 'Tidak ada deskripsi tersedia.';
      return sanitizeRichText(value);
    };

    const getTags = (item: Berita | null): string[] => {
      const rawTags = (item as any)?.tags;
      if (Array.isArray(rawTags)) {
        return rawTags.map((tag) => String(tag).trim()).filter(Boolean);
      }
      if (typeof rawTags === "string") {
        return rawTags.split(",").map((tag) => tag.trim()).filter(Boolean);
      }
      return [];
    };

    return {
      dataToPass, beritaData, isLoading, isDarkMode, goBack, goEdit, showToast, toastMessage, toastType,
      getAuthorName, getTags, formatDate: formatEventDate, formatDateShort: formatEventDateShort, htmlOrFallback
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
        <span v-for="tag in getTags(beritaData)" :key="tag" class="brd-meta-pill"><i class="ri-price-tag-3-line"></i> {{ tag }}</span>
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
        <div class="brd-info-row brd-tag-info">
          <span><i class="ri-price-tag-3-line"></i>Tag</span>
          <strong v-if="getTags(beritaData).length" class="brd-tag-list">
            <span v-for="tag in getTags(beritaData)" :key="tag" class="brd-tag-chip">{{ tag }}</span>
          </strong>
          <strong v-else>-</strong>
        </div>
        <div class="brd-info-row"><span><i class="ri-user-line"></i>Pembuat</span><strong>{{ getAuthorName(beritaData) }}</strong></div>
        <div class="brd-info-row"><span><i class="ri-time-line"></i>Dibuat</span><strong>{{ formatDateShort(beritaData.created_at) }}</strong></div>
        <div class="brd-info-row"><span><i class="ri-history-line"></i>Diupdate</span><strong>{{ formatDateShort(beritaData.updated_at) }}</strong></div>
      </aside>
    </div>
  </section>
</template>

<style src="../../assets/css/event-berita.css"></style>
