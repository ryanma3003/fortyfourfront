<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useEventStore } from "../../stores/event";
import { useRouter } from "vue-router";
import type { Kegiatan } from "../../types/kegiatan.types";

export default {
  components: { Pageheader },
  data() {
    return {
      dataToPass: {
        title: { label: "Dashboard", path: "/dashboard" },
        currentpage: "Event & Kegiatan",
        activepage: "Event & Kegiatan",
      },
    };
  },
  setup() {
    const eventStore = useEventStore();
    const router = useRouter();
    
    const searchQuery = ref("");
    const currentPage = ref(1);
    const itemsPerPage = ref(10);
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
        await eventStore.fetchEvents();
      } catch (e: any) {
        showNotification("Gagal memuat data event", "error");
      } finally {
        isLoading.value = false;
      }
    });

    const filteredData = computed(() => {
      const q = searchQuery.value.toLowerCase().trim();
      if (!q) return eventStore.events;
      return eventStore.events.filter(
        (k) =>
          (k.judul || "").toLowerCase().includes(q) ||
          (k.lokasi || "").toLowerCase().includes(q) ||
          stripHtml(k.deskripsi || "").toLowerCase().includes(q)
      );
    });

    const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / itemsPerPage.value)));
    const displayData = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredData.value.slice(start, start + itemsPerPage.value);
    });

    // Modals state
    const activeModal = ref<'delete' | null>(null);
    const deleteTarget = ref<Kegiatan | null>(null);
    const isSaving = ref(false);

    const openCreate = () => router.push('/event/create');
    const openEdit = (item: Kegiatan) => router.push(`/event/edit/${item.id}`);
    const openView = (item: Kegiatan) => router.push(`/event/view/${item.id}`);

    // DELETE
    const openDeleteModal = (item: Kegiatan) => {
      deleteTarget.value = item;
      activeModal.value = 'delete';
    };
    const confirmDelete = async () => {
      if (!deleteTarget.value) return;
      isSaving.value = true;
      try {
        const result = await eventStore.deleteEvent(deleteTarget.value.id);
        if (result.success) {
          showNotification("Event berhasil dihapus", "success");
          activeModal.value = null;
        } else {
          showNotification("Gagal menghapus event: " + (result.error || ''), "error");
        }
      } catch(e: any) { 
        showNotification("Gagal menghapus event", "error"); 
      } finally { 
        isSaving.value = false; 
      }
    };

    const getAvatarClass = (letter: string) => {
      const variants = ["avatar-blue","avatar-indigo","avatar-violet","avatar-purple","avatar-teal","avatar-cyan","avatar-green","avatar-amber","avatar-orange","avatar-red"];
      const idx = (letter.toUpperCase().charCodeAt(0) - 65 + variants.length) % variants.length;
      return variants[idx];
    };

    const getStatusClass = (status: string) => {
      const s = (status || '').toLowerCase();
      if (s === 'upcoming' || s === 'akan datang') return 'badge-sektor-amber';
      if (s === 'ongoing' || s === 'berlangsung' || s === 'sedang berjalan') return 'badge-sektor-teal';
      if (s === 'selesai' || s === 'past' || s === 'completed') return 'bg-secondary-transparent text-secondary';
      if (s === 'aktif' || s === 'active') return 'badge-sektor-teal';
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

    const stripHtml = (value: string) => {
      return value
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim();
    };
    
    return {
      isLoading,
      router, eventStore, searchQuery, currentPage, itemsPerPage, filteredData, totalPages, displayData,
      showToast, toastMessage, toastType,
      activeModal, isSaving, deleteTarget,
      openCreate, openEdit, openView, openDeleteModal, confirmDelete,
      getAvatarClass, getStatusClass, getStatusText, formatDate, stripHtml
    };
  }
};
</script>

<template>
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
      <!-- Premium UI like Stakeholders -->
      <div class="card custom-card gradient-header-card stakeholders-shell-card" style="overflow: visible !important;">
        <div class="stakeholder-header stakeholders-premium-header">
          <div class="stakeholders-header-main d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div class="stakeholders-hero-copy1 d-flex flex-column gap-1">
              <div>
                <div class="stakeholders-inline-breadcrumb">Dashboard <span>/</span> Event & Kegiatan</div>
                <div class="card-title mb-0 fw-bold header-card-title stakeholders-hero-title">Event & Kegiatan</div>
                <div class="header-subtitle mt-1 stakeholders-hero-subtitle">Kelola event, workshop dan kegiatan</div>
              </div>
              <div class="stakeholders-meta-stack">
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Total Kegiatan</span>
                  <strong><i class="ri-calendar-event-line"></i> {{ eventStore.totalEvents }}</strong>
                </div>
              </div>
            </div>
            <div class="stakeholders-hero-tools">
              <div class="stakeholders-search position-relative">
                <i class="ri-search-line lms-search-icon"></i>
                <input v-model="searchQuery" type="text" class="form-control form-control-sm lms-search-input" placeholder="Cari judul, lokasi..." />
                <button v-if="searchQuery" @click="searchQuery = ''" class="lms-clear-btn" title="Clear search">
                  <i class="ri-close-circle-fill"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="card-body p-4 stakeholders-premium-body">
          <div class="controls-bar stakeholders-toolbar stakeholders-filter-bar mb-4">
            <div class="stakeholders-toolbar-right">
              <div class="stakeholders-per-page">
                <span>Rows</span>
                <select v-model="itemsPerPage" class="form-select form-select-sm entries-select">
                  <option v-for="n in [5, 10, 15, 20]" :key="n" :value="n">{{ n }}</option>
                </select>
              </div>
              <button @click="openCreate()" class="btn stakeholders-add-btn ms-auto d-flex align-items-center gap-2">
                <i class="ri-add-circle-line fs-13"></i>
                <span class="btn-text">Tambah Event</span>
              </button>
            </div>
          </div>

          <div class="table-responsive stakeholder-table-wrap stakeholders-table-shell">
            <table class="table stakeholder-table mb-0">
              <thead class="stakeholder-thead">
                <tr>
                  <th class="th-no" style="width: 50px;">No</th>
                  <th>Judul</th>
                  <th>Lokasi</th>
                  <th>Tanggal</th>
                  <th class="text-center">Status</th>
                  <th class="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="isLoading">
                  <td colspan="6" class="p-0">
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
                  <td colspan="6" class="text-center py-5">
                    <div class="empty-state">
                      <div class="empty-icon-ring mb-3"><div class="empty-icon-inner"><i class="ri-calendar-event-line"></i></div></div>
                      <h6 class="fw-semibold mb-1 empty-state-title">Belum Ada Data</h6>
                      <p class="text-muted fs-13 mb-3">Klik tombol "Tambah Event" untuk membuat event baru.</p>
                    </div>
                  </td>
                </tr>
                <template v-for="(item, i) in displayData" :key="item.id">
                  <tr class="stakeholder-row">
                    <td class="align-middle text-center">
                      <span class="row-number">{{ (currentPage - 1) * itemsPerPage + i + 1 }}</span>
                    </td>
                    <td class="align-middle">
                      <div class="stakeholder-company-cell">
                        <div class="company-avatar overflow-hidden" :class="getAvatarClass((item.judul || 'E').charAt(0))">
                          <span class="company-avatar-letter">{{ (item.judul || 'E').charAt(0).toUpperCase() }}</span>
                        </div>
                        <div class="company-name-wrap">
                          <span class="company-name d-block fw-bold">{{ item.judul }}</span>
                          <span class="text-muted fs-12 text-truncate" style="max-width: 250px; display: inline-block;">{{ stripHtml(item.deskripsi || '') || '-' }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="align-middle">
                      <span class="d-flex align-items-center gap-1 fs-13">
                        <i class="ri-map-pin-line text-primary"></i>
                        {{ item.lokasi || '-' }}
                      </span>
                    </td>
                    <td class="align-middle">
                      <div class="d-flex flex-column gap-1 fs-12 text-muted">
                        <span v-if="item.tanggal"><i class="ri-calendar-line text-primary me-1"></i> <span class="fw-medium text-dark">{{ formatDate(item.tanggal) }}</span></span>
                        <span v-else>-</span>
                      </div>
                    </td>
                    <td class="align-middle text-center">
                      <span class="badge-sektor" :class="getStatusClass(item.status)">
                        {{ getStatusText(item.status) }}
                      </span>
                    </td>
                    <td class="align-middle text-center">
                      <div class="d-flex gap-1 justify-content-center">
                        <button @click="openView(item)" class="btn btn-sm btn-icon btn-wave btn-info-light stakeholders-action-btn" title="View">
                          <i class="ri-eye-line"></i>
                        </button>
                        <button @click="openEdit(item)" class="btn btn-sm btn-icon btn-wave btn-success-light stakeholders-action-btn" title="Edit">
                          <i class="ri-edit-2-line"></i>
                        </button>
                        <button @click="openDeleteModal(item)" class="btn btn-sm btn-icon btn-wave btn-danger-light stakeholders-action-btn" title="Hapus">
                          <i class="ri-delete-bin-3-line"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <div class="pagination-container stakeholders-pagination mt-2 mb-0 pb-0">
            <div class="stakeholders-pagination-copy">
              Showing {{ displayData.length ? (currentPage - 1) * itemsPerPage + 1 : 0 }}-{{ Math.min(currentPage * itemsPerPage, filteredData.length) }} of {{ filteredData.length }} items
            </div>
            <div class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
              <span class="stakeholders-page-pill">Page {{ currentPage }} of {{ totalPages || 1 }}</span>
              <nav v-if="totalPages > 1">
                <ul class="pagination pagination-sm mb-0 gap-1">
                  <li class="page-item" :class="{ disabled: currentPage === 1 }"><a class="page-link rounded-circle" href="#" @click.prevent="currentPage--"><i class="ri-arrow-left-s-line"></i></a></li>
                  <template v-for="p in totalPages" :key="p">
                    <li v-if="p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)" class="page-item" :class="{ active: p === currentPage }">
                      <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = p">{{ p }}</a>
                    </li>
                    <li v-else-if="p === currentPage - 2 || p === currentPage + 2" class="page-item disabled"><span class="page-link border-0 bg-transparent">...</span></li>
                  </template>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }"><a class="page-link rounded-circle" href="#" @click.prevent="currentPage++"><i class="ri-arrow-right-s-line"></i></a></li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- DELETE MODAL -->
  <div v-if="activeModal === 'delete'" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="activeModal = null">
    <div class="modal-dialog modal-dialog-centered modal-sm custom-modal">
      <div class="modal-content border-0 bg-transparent">
        <div class="kse-modal-box kse-modal-sm w-100">
          <div class="kse-modal-header kse-modal-header-danger">
            <div class="d-flex align-items-center gap-3">
              <div class="kse-modal-icon-wrap"><i class="ri-delete-bin-line"></i></div>
              <div>
                <div class="kse-modal-title">Hapus Event</div>
              </div>
            </div>
          </div>
          <div class="kse-modal-body text-center">
            <p class="mb-0 fs-14">Yakin ingin menghapus <strong>{{ deleteTarget?.judul }}</strong>?</p>
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

<style scoped>
</style>
