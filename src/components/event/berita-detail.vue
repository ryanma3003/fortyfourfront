<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useBeritaStore } from "../../stores/berita";
import { useAuthStore } from "../../stores/auth";
import { useUsersStore } from "../../stores/users";
import { useRouter, useRoute } from "vue-router";
import type { Berita } from "../../types/berita.types";

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

    const showNotification = (msg: string, type: "success" | "error") => {
      toastMessage.value = msg;
      toastType.value = type;
      showToast.value = true;
      setTimeout(() => (showToast.value = false), 3000);
    };

    onMounted(async () => {
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
      }
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
          if (name.startsWith('on') || isUnsafeUrl) node.removeAttribute(attr.name);
        });
      });
      return template.innerHTML;
    };

    const htmlOrFallback = (value: string) => {
      if (!value?.trim()) return 'Tidak ada deskripsi tersedia.';
      return sanitizeRichText(decodeHtmlEntities(value));
    };

    return {
      dataToPass, beritaData, isLoading, goBack, goEdit, showToast, toastMessage, toastType,
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

  <div class="row" v-if="isLoading">
    <div class="col-xl-12">
      <div class="card custom-card">
        <div class="card-body p-5 text-center">
          <span class="spinner-border spinner-border-sm text-primary" style="width: 2rem; height: 2rem;"></span>
          <div class="mt-2 text-muted fs-13">Memuat Detail Berita...</div>
        </div>
      </div>
    </div>
  </div>

  <div class="row" v-else-if="beritaData">
    <div class="col-xl-8">
      <div class="card custom-card">
        <div class="card-body p-4">
          <div class="d-flex align-items-start justify-content-between gap-3 mb-4">
            <div class="d-flex gap-3">
              <button class="btn btn-sm btn-icon btn-light border" @click="goBack" title="Kembali">
                <i class="ri-arrow-left-line"></i>
              </button>
              <div>
                <div class="d-flex align-items-center gap-2 mb-2">
                  <span class="badge bg-primary-transparent text-primary border border-primary border-opacity-25">Berita</span>
                </div>
                <h4 class="fw-bold mb-1 text-dark fs-20">{{ beritaData.judul }}</h4>
                <p class="text-muted fs-13 mb-0">Dipublikasikan oleh {{ getAuthorName(beritaData) }} pada {{ formatDate(beritaData.created_at) }}</p>
              </div>
            </div>
            <button @click="goEdit" class="btn btn-primary btn-sm d-flex align-items-center gap-2">
              <i class="ri-edit-line"></i> Edit
            </button>
          </div>
        </div>
      </div>

      <div class="card custom-card mt-3">
        <div class="card-header">
          <div class="card-title fs-14 fw-semibold">Isi Berita</div>
        </div>
        <div class="card-body p-4">
          <div class="event-html-content text-dark fs-14" v-html="htmlOrFallback(beritaData.deskripsi)"></div>
        </div>
      </div>
    </div>

    <div class="col-xl-4">
      <div class="card custom-card">
        <div class="card-header">
          <div class="card-title fs-14 fw-semibold">Informasi Sistem</div>
        </div>
        <div class="card-body p-0">
          <ul class="list-group list-group-flush">
            <li class="list-group-item d-flex justify-content-between align-items-center p-3">
              <span class="text-muted fs-13 d-flex align-items-center gap-2"><i class="ri-hashtag text-primary"></i> Berita ID</span>
              <span class="fw-semibold text-dark fs-13">#{{ beritaData.id }}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center p-3">
              <span class="text-muted fs-13 d-flex align-items-center gap-2"><i class="ri-user-line text-info"></i> Pembuat</span>
              <span class="fw-medium text-dark fs-13 text-end">{{ getAuthorName(beritaData) }}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center p-3">
              <span class="text-muted fs-13 d-flex align-items-center gap-2"><i class="ri-time-line text-success"></i> Dibuat</span>
              <span class="fw-medium text-dark fs-13 text-end">{{ formatDateShort(beritaData.created_at) }}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center p-3">
              <span class="text-muted fs-13 d-flex align-items-center gap-2"><i class="ri-history-line text-warning"></i> Diupdate</span>
              <span class="fw-medium text-dark fs-13 text-end">{{ formatDateShort(beritaData.updated_at) }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.event-html-content {
  line-height: 1.75;
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
}
</style>
