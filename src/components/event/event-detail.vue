<script lang="ts">
import { ref, computed, onMounted } from "vue";
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

    onMounted(async () => {
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
      }
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

  <div class="row" v-if="isLoading">
    <div class="col-xl-12">
      <div class="card custom-card">
        <div class="card-body p-5 text-center">
          <span class="spinner-border spinner-border-sm text-primary" style="width: 2rem; height: 2rem;"></span>
          <div class="mt-2 text-muted fs-13">Memuat Detail Event...</div>
        </div>
      </div>
    </div>
  </div>

  <div class="row" v-else-if="eventData">
    <div class="col-xl-8">
      
      <!-- HEADER / MAIN INFO CARD -->
      <div class="card custom-card">
        <div class="card-body p-4">
          <div class="d-flex align-items-start justify-content-between gap-3 mb-4">
            <div class="d-flex gap-3">
              <button class="btn btn-sm btn-icon btn-light border" @click="goBack" title="Kembali">
                <i class="ri-arrow-left-line"></i>
              </button>
              <div>
                <div class="d-flex align-items-center gap-2 mb-2">
                  <span class="badge bg-primary-transparent text-primary border border-primary border-opacity-25">Kegiatan</span>
                  <span class="badge border" :class="[getStatusClass(eventData.status), eventData.status?.toLowerCase() === 'upcoming' ? 'border-warning' : (eventData.status?.toLowerCase() === 'aktif' ? 'border-success' : 'border-light')]">
                    {{ getStatusText(eventData.status) }}
                  </span>
                </div>
                <h4 class="fw-bold mb-1 text-dark fs-20">{{ eventData.judul }}</h4>
                <p class="text-muted fs-13 mb-0">Detail informasi kegiatan dan pelaksanaan</p>
              </div>
            </div>
            <button @click="goEdit" class="btn btn-primary btn-sm d-flex align-items-center gap-2">
              <i class="ri-edit-line"></i> Edit
            </button>
          </div>

          <div class="row g-3">
            <div class="col-sm-6">
              <div class="d-flex align-items-center gap-3 p-3 bg-light rounded-2 border border-light">
                <div class="avatar avatar-sm bg-white text-primary border shadow-sm">
                  <i class="ri-map-pin-line fs-16"></i>
                </div>
                <div>
                  <p class="text-muted fs-11 fw-semibold text-uppercase mb-0">Lokasi</p>
                  <h6 class="fw-bold mb-0 fs-13 text-dark">{{ eventData.lokasi || '-' }}</h6>
                </div>
              </div>
            </div>
            <div class="col-sm-6">
              <div class="d-flex align-items-center gap-3 p-3 bg-light rounded-2 border border-light">
                <div class="avatar avatar-sm bg-white text-success border shadow-sm">
                  <i class="ri-calendar-event-line fs-16"></i>
                </div>
                <div>
                  <p class="text-muted fs-11 fw-semibold text-uppercase mb-0">Waktu Pelaksanaan</p>
                  <h6 class="fw-bold mb-0 fs-13 text-dark">{{ formatDate(eventData.tanggal) }}</h6>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- DESCRIPTION CARD -->
      <div class="card custom-card mt-3">
        <div class="card-header">
          <div class="card-title fs-14 fw-semibold">Deskripsi Kegiatan</div>
        </div>
        <div class="card-body p-4">
          <div class="event-html-content text-dark fs-14" v-html="htmlOrFallback(eventData.deskripsi)"></div>
        </div>
      </div>

    </div>
    
    <div class="col-xl-4">
      <!-- SYSTEM INFO CARD -->
      <div class="card custom-card">
        <div class="card-header">
          <div class="card-title fs-14 fw-semibold">Informasi Sistem</div>
        </div>
        <div class="card-body p-0">
          <ul class="list-group list-group-flush">
            <li class="list-group-item d-flex justify-content-between align-items-center p-3">
              <span class="text-muted fs-13 d-flex align-items-center gap-2"><i class="ri-hashtag text-primary"></i> Event ID</span>
              <span class="fw-semibold text-dark fs-13">#{{ eventData.id }}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center p-3">
              <span class="text-muted fs-13 d-flex align-items-center gap-2"><i class="ri-time-line text-success"></i> Dibuat</span>
              <span class="fw-medium text-dark fs-13 text-end">{{ formatDateShort(eventData.created_at) }}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center p-3">
              <span class="text-muted fs-13 d-flex align-items-center gap-2"><i class="ri-history-line text-warning"></i> Diupdate</span>
              <span class="fw-medium text-dark fs-13 text-end">{{ formatDateShort(eventData.updated_at) }}</span>
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
