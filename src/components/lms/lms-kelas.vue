<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useLmsStore } from "../../stores/lms";
import { lmsService } from "../../services/lms.service";
import LmsEditor from "./LmsEditor.vue";
import { useRouter } from "vue-router";

export default {
  components: { Pageheader, LmsEditor },
  data() {
    return {
      dataToPass: {
        title: { label: "Dashboard", path: "/dashboard" },
        currentpage: "LMS — Kelas",
        activepage: "Kelas",
      },
    };
  },
  setup() {
    const lmsStore = useLmsStore();
    const router = useRouter();
    
    const searchQuery = ref("");
    const currentPage = ref(1);
    const itemsPerPage = ref(10);
    
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

    // Stats — derived from cache instead of separate API calls
    const materiCounts = ref<Record<string, number>>({});
    const kuisCounts = ref<Record<string, number>>({});

    const computedTotalMateri = computed(() => {
      let sum = 0;
      for (const k of lmsStore.kelasList) {
        sum += (materiCounts.value[k.id] || 0);
      }
      return sum;
    });

    const computedTotalKuis = computed(() => {
      let sum = 0;
      for (const k of lmsStore.kelasList) {
        sum += (kuisCounts.value[k.id] || 0);
      }
      return sum;
    });

    /**
     * Load stats in parallel batches — uses getKelasDetail which caches results.
     * Subsequent expands will be instant from cache.
     */
    const isInitialLoading = ref(lmsStore.kelasList.length === 0);

    const initStatsFromCache = () => {
      lmsStore.kelasList.forEach(k => {
        const cached = lmsStore.kelasCache[k.id];
        if (cached) {
          materiCounts.value[k.id] = cached.materi.length;
          kuisCounts.value[k.id] = cached.kuis.length;
        }
      });
    };

    /**
     * Load stats in parallel batches — uses store's cache-aware fetch.
     */
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const isLoadingStats = ref(false);

    const loadGlobalStats = async () => {
      if (isLoadingStats.value) return;
      isLoadingStats.value = true;

      try {
        const pending = lmsStore.kelasList.filter(k => !lmsStore.kelasCache[k.id]);

        for (let i = 0; i < pending.length; i += 2) {
          const batch = pending.slice(i, i + 2);
          await Promise.all(batch.map(k =>
            lmsStore.fetchKelasDetail(k.id).then(({ materi, kuis }) => {
              materiCounts.value[k.id] = materi.length;
              kuisCounts.value[k.id] = kuis.length;
            }).catch(() => {})
          ));

          if (i + 2 < pending.length) await delay(300);
        }
      } finally {
        isLoadingStats.value = false;
      }
    };

    onMounted(() => {
      // 1. If we have data in store, use it immediately (Instant UI)
      if (lmsStore.kelasList.length > 0) {
        initStatsFromCache();
        // Even if we have data, we still trigger loadGlobalStats to refresh counts from cache
        loadGlobalStats(); 
      }

      // 2. Refresh data in background (SWR pattern)
      lmsStore.fetchKelas().then(() => {
        isInitialLoading.value = false;
        initStatsFromCache();
        loadGlobalStats(); 
      }).catch((e: any) => {
        isInitialLoading.value = false;
        if (lmsStore.kelasList.length === 0) {
          showNotification(e.message || "Gagal memuat data kelas", "error");
        }
      });
    });

    const filteredData = computed(() => {
      const q = searchQuery.value.toLowerCase().trim();
      if (!q) return lmsStore.kelasList;
      return lmsStore.kelasList.filter(
        (k) => (k.nama_kelas || "").toLowerCase().includes(q)
      );
    });

    const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / itemsPerPage.value)));
    const displayData = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredData.value.slice(start, start + itemsPerPage.value);
    });

    // Expand logic — uses cached data when available
    const expandedKelasId = ref<string | number | null>(null);
    const classMateriList = ref<any[]>([]);
    const classKuisList = ref<any[]>([]);
    const isLoadingDetail = ref(false);

    const toggleExpand = async (item: any) => {
      if (expandedKelasId.value === item.id) {
        expandedKelasId.value = null;
      } else {
        expandedKelasId.value = item.id;
        isLoadingDetail.value = true;
        try {
          // Uses cache if available (instant), fetches if not
          const { materi, kuis } = await lmsStore.fetchKelasDetail(item.id);
          classMateriList.value = materi;
          classKuisList.value = kuis;
          materiCounts.value[item.id] = materi.length;
          kuisCounts.value[item.id] = kuis.length;
        } catch(e) {
          showNotification("Gagal memuat detail kelas", "error");
        } finally {
          isLoadingDetail.value = false;
        }
      }
    };

    // Modals state
    const activeModal = ref<'kelas' | 'materi' | 'kuis' | 'delete' | null>(null);
    const isEdit = ref(false);
    const isSaving = ref(false);
    const formErrors = ref<Record<string, string>>({});

    const deleteType = ref<'kelas' | 'materi' | 'kuis'>('kelas');
    const deleteTarget = ref<any>(null);

    // KELAS FORM
    const formKelas = ref({ id: '', nama_kelas: '', deskripsi: '', thumbnail: '', status: 'published' });
    const thumbnailPreview = computed(() => formKelas.value.thumbnail || null);

    const openKelasModal = (item?: any) => {
      formErrors.value = {};

      if (item) {
        isEdit.value = true;
        formKelas.value = { 
          id: item.id, 
          nama_kelas: item.nama_kelas, 
          deskripsi: item.deskripsi, 
          thumbnail: item.thumbnail || '',
          status: item.status || 'published' 
        };
      } else {
        isEdit.value = false;
        formKelas.value = { id: '', nama_kelas: '', deskripsi: '', thumbnail: '', status: 'published' };
      }
      activeModal.value = 'kelas';
    };

    const saveKelas = async () => {
      formErrors.value = {};
      if (!formKelas.value.nama_kelas) formErrors.value.nama_kelas = "Wajib diisi";
      if (!formKelas.value.deskripsi) formErrors.value.deskripsi = "Wajib diisi";
      if (Object.keys(formErrors.value).length > 0) return;
      
      isSaving.value = true;
      try {
        if (isEdit.value) {
          await lmsStore.updateKelas(formKelas.value.id, formKelas.value);
          showNotification("Kelas berhasil diperbarui!", "success");
        } else {
          await lmsStore.createKelas(formKelas.value);
          showNotification("Kelas berhasil dibuat!", "success");
        }
        activeModal.value = null;
      } catch (e: any) { 
        showNotification(e.message || "Gagal menyimpan kelas", "error"); 
      }
      finally { isSaving.value = false; }
    };

    // MATERI ROUTING
    const openMateriModal = (kelasId: string, item?: any) => {
      if (item) {
        router.push(`/lms/materi/edit/${item.id}`);
      } else {
        router.push({ path: `/lms/materi/create`, query: { kelasId } });
      }
    };

    // KUIS ROUTING
    const openKuisModal = async (kelasId: string, item?: any) => {
      if (item) {
        router.push(`/lms/quiz/edit/${item.id}`);
      } else {
        router.push({ path: `/lms/quiz/create`, query: { kelasId } });
      }
    };

    // DELETE
    const openDeleteModal = (type: 'kelas'|'materi'|'kuis', item: any) => {
      deleteType.value = type;
      deleteTarget.value = item;
      activeModal.value = 'delete';
    };
    const confirmDelete = async () => {
      isSaving.value = true;
      try {
        if (deleteType.value === 'kelas') {
          await lmsStore.deleteKelas(deleteTarget.value.id);
          if (expandedKelasId.value === deleteTarget.value.id) expandedKelasId.value = null;
        } else if (deleteType.value === 'materi') {
          await lmsStore.deleteMateri(deleteTarget.value.id);
          classMateriList.value = classMateriList.value.filter(m => m.id !== deleteTarget.value.id);
          if(expandedKelasId.value) materiCounts.value[expandedKelasId.value]--;
        } else if (deleteType.value === 'kuis') {
          await lmsStore.deleteKuis(deleteTarget.value.id);
          classKuisList.value = classKuisList.value.filter(k => k.id !== deleteTarget.value.id);
          if(expandedKelasId.value) kuisCounts.value[expandedKelasId.value]--;
        }
        showNotification("Berhasil dihapus", "success");
        activeModal.value = null;
      } catch(e) { showNotification("Gagal menghapus", "error"); }
      finally { isSaving.value = false; }
    };

    const getAvatarClass = (letter: string) => {
      const variants = ["avatar-blue","avatar-indigo","avatar-violet","avatar-purple","avatar-teal","avatar-cyan","avatar-green","avatar-amber","avatar-orange","avatar-red"];
      const idx = (letter.toUpperCase().charCodeAt(0) - 65 + variants.length) % variants.length;
      return variants[idx];
    };

    const findMateriJudul = (idMateri?: string | number) => {
      if (!idMateri) return "Unknown";
      const m = classMateriList.value.find(m => String(m.id) === String(idMateri));
      return m ? m.judul : "Materi tidak ditemukan";
    };

    const countKuisForMateri = (materiId: string | number) => {
      return classKuisList.value.filter(k => String(k.id_materi) === String(materiId)).length;
    };
    
    // UI Expand / Collapse Soal state
    return {
      isInitialLoading,
      router, lmsStore, searchQuery, currentPage, itemsPerPage, filteredData, totalPages, displayData,
      showToast, toastMessage, toastType, 
      computedTotalMateri, computedTotalKuis, materiCounts, kuisCounts,
      expandedKelasId, classMateriList, classKuisList, toggleExpand, isLoadingDetail,
      activeModal, isEdit, isSaving, formErrors,
      formKelas, openKelasModal, saveKelas,
      openMateriModal, openKuisModal,
      openDeleteModal, confirmDelete, deleteType, deleteTarget,
      getAvatarClass, findMateriJudul, countKuisForMateri,
      thumbnailPreview
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
                <div class="stakeholders-inline-breadcrumb">Dashboard <span>/</span> LMS <span>/</span> Kelas</div>
                <div class="card-title mb-0 fw-bold header-card-title stakeholders-hero-title">LMS Kelas</div>
                <div class="header-subtitle mt-1 stakeholders-hero-subtitle">Kelola kelas, materi, dan soal kuis dalam satu halaman</div>
              </div>
              <div class="stakeholders-meta-stack">
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Total Kelas</span>
                  <strong><i class="ri-graduation-cap-line"></i> {{ lmsStore.totalKelas }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Total Materi</span>
                  <strong><i class="ri-book-open-line"></i> {{ computedTotalMateri }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Total Kuis</span>
                  <strong><i class="ri-questionnaire-line"></i> {{ computedTotalKuis }}</strong>
                </div>
              </div>
            </div>
            <div class="stakeholders-hero-tools">
              <div class="stakeholders-search position-relative">
                <i class="ri-search-line lms-search-icon"></i>
                <input v-model="searchQuery" type="text" class="form-control form-control-sm lms-search-input" placeholder="Cari nama kelas..." />
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
              <button @click="openKelasModal()" class="btn stakeholders-add-btn ms-auto d-flex align-items-center gap-2">
                <i class="ri-add-circle-line fs-13"></i>
                <span class="btn-text">Tambah Kelas</span>
              </button>
            </div>
          </div>

          <div class="table-responsive stakeholder-table-wrap stakeholders-table-shell">
            <table class="table stakeholder-table mb-0">
              <thead class="stakeholder-thead">
                <tr>
                  <th class="th-no" style="width: 50px;">No</th>
                  <th>Kelas</th>
                  <th>Deskripsi</th>
                  <th class="text-center">Status</th>
                  <th class="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="isInitialLoading">
                  <td colspan="5" class="p-0">
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
                  <td colspan="5" class="text-center py-5">
                    <div class="empty-state">
                      <div class="empty-icon-ring mb-3"><div class="empty-icon-inner"><i class="ri-graduation-cap-line"></i></div></div>
                      <h6 class="fw-semibold mb-1 empty-state-title">Belum Ada Kelas</h6>
                      <p class="text-muted fs-13 mb-3">Klik tombol "Tambah Kelas" untuk membuat kelas baru.</p>
                    </div>
                  </td>
                </tr>
                <template v-for="(item, i) in displayData" :key="item.id">
                  <tr class="stakeholder-row" :class="{ 'stakeholder-row-expanded': expandedKelasId === item.id }" @click="toggleExpand(item)" style="cursor: pointer;">
                    <td class="align-middle text-center">
                      <span class="row-number">{{ (currentPage - 1) * itemsPerPage + i + 1 }}</span>
                    </td>
                    <td class="align-middle">
                      <div class="stakeholder-company-cell">
                        <button class="stakeholder-expand-btn" @click.stop="toggleExpand(item)" :title="expandedKelasId === item.id ? 'Collapse row' : 'Expand row'">
                          <i :class="expandedKelasId === item.id ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'"></i>
                        </button>
                        <div class="company-avatar overflow-hidden" :class="item.thumbnail ? '' : getAvatarClass((item.nama_kelas || 'K').charAt(0))">
                          <img v-if="item.thumbnail" :src="item.thumbnail" class="w-100 h-100 object-fit-cover" alt="" />
                          <span v-else class="company-avatar-letter">{{ (item.nama_kelas || 'K').charAt(0).toUpperCase() }}</span>
                        </div>
                        <div class="company-name-wrap">
                          <span class="company-name d-block fw-bold">{{ item.nama_kelas }}</span>
                          <span class="text-muted fs-12">{{ materiCounts[item.id] || 0 }} Materi · {{ kuisCounts[item.id] || 0 }} Kuis</span>
                        </div>
                      </div>
                    </td>
                    <td class="align-middle text-muted fs-13">
                      {{ item.deskripsi || '-' }}
                    </td>
                    <td class="align-middle text-center">
                      <span class="badge-sektor" :class="item.status === 'published' ? 'badge-sektor-teal' : 'badge-sektor-amber'">
                        {{ item.status === 'published' ? 'Publish' : 'Draft' }}
                      </span>
                    </td>
                    <td class="align-middle text-center">
                      <div class="d-flex gap-1 justify-content-center">
                        <button @click.stop="router.push('/lms/kelas/view/' + item.id)" class="btn btn-sm btn-icon btn-wave btn-primary-light stakeholders-action-btn" title="Lihat Detail Kelas">
                          <i class="ri-eye-line"></i>
                        </button>
                        <button @click.stop="openKelasModal(item)" class="btn btn-sm btn-icon btn-wave btn-success-light stakeholders-action-btn" title="Edit Kelas">
                          <i class="ri-edit-2-line"></i>
                        </button>
                        <button @click.stop="openDeleteModal('kelas', item)" class="btn btn-sm btn-icon btn-wave btn-danger-light stakeholders-action-btn" title="Hapus Kelas">
                          <i class="ri-delete-bin-3-line"></i>
                        </button>
                      </div>
                    </td>
                  </tr>

                  <!-- EXPANDED ROW: MATERI & KUIS -->
                  <tr v-if="expandedKelasId === item.id" class="stakeholder-detail-row">
                    <td colspan="5" class="p-0 border-0">
                      <div class="stakeholder-expanded-wrapper">
                        <div v-if="isLoadingDetail" class="text-center py-3"><span class="spinner-border spinner-border-sm text-primary"></span><span class="ms-2 fs-13 text-muted">Memuat detail kelas...</span></div>
                        <div v-else class="row g-3">
                          
                          <!-- MATERI LIST -->
                          <div class="col-lg-6 col-12">
                            <div class="card border-0 mb-0 rounded-3 stakeholder-inner-card">
                              <div class="card-header bg-transparent border-bottom-0 d-flex justify-content-between align-items-center pt-3 pb-2 px-3">
                                <h6 class="mb-0 fw-bold d-flex align-items-center gap-2 fs-13 stakeholder-detail-card-title"><i class="ri-book-read-line text-primary fs-16"></i> Daftar Materi</h6>
                                <button @click="openMateriModal(item.id)" class="btn btn-sm rounded-pill px-2 py-1 fw-medium fs-12 stakeholder-sub-add-btn stakeholder-sub-add-btn-primary"><i class="ri-add-line"></i> Materi</button>
                              </div>
                              <div class="card-body px-3 pb-3 pt-0">
                                <div class="list-group rounded-3">
                                  <div v-if="classMateriList.length === 0" class="text-center text-muted py-3 fs-12 bg-light rounded-3">Belum ada materi ditambahkan.</div>
                                  <div v-for="m in classMateriList" :key="m.id" class="list-group-item d-flex justify-content-between align-items-center px-3 py-2 rounded-3 border-0 mb-1 stakeholder-detail-list-item">
                                    <div class="d-flex align-items-start gap-3 overflow-hidden me-2 w-100">
                                      <div class="mt-1 flex-shrink-0" :class="m.tipe === 'video' ? 'text-danger' : 'text-primary'">
                                        <i :class="m.tipe === 'video' ? 'ri-play-circle-fill' : 'ri-file-text-fill'" class="fs-20"></i>
                                      </div>
                                      <div class="overflow-hidden w-100">
                                        <div class="fw-bold fs-13 mb-0 text-truncate stakeholder-detail-card-title">{{ m.judul }}</div>
                                        <div class="d-flex align-items-center gap-2 flex-wrap mt-1">
                                          <span class="badge bg-primary-transparent text-primary fs-11 px-2 py-1 fw-medium"><i class="ri-price-tag-3-line me-1"></i> {{ m.kategori || 'Umum' }}</span>
                                          <span class="text-muted fs-11 text-uppercase fw-bold">{{ m.tipe }}</span>
                                          <span v-if="countKuisForMateri(m.id) > 0" class="badge bg-success-transparent text-success fs-10 fw-bold px-2 py-0-5 rounded-pill">
                                            <i class="ri-checkbox-circle-line me-1"></i> {{ countKuisForMateri(m.id) }} Kuis
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div class="d-flex gap-1 flex-shrink-0">
                                      <button @click="openMateriModal(item.id, m)" class="btn btn-sm btn-icon btn-outline-primary rounded-circle border-0 bg-primary-transparent" title="Edit"><i class="ri-edit-line"></i></button>
                                      <button @click="openDeleteModal('materi', m)" class="btn btn-sm btn-icon btn-outline-danger rounded-circle border-0 bg-danger-transparent" title="Hapus"><i class="ri-delete-bin-line"></i></button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <!-- KUIS LIST -->
                          <div class="col-lg-6 col-12">
                            <div class="card border-0 mb-0 rounded-3 stakeholder-inner-card">
                              <div class="card-header bg-transparent border-bottom-0 d-flex justify-content-between align-items-center pt-3 pb-2 px-3">
                                <h6 class="mb-0 fw-bold d-flex align-items-center gap-2 fs-13 stakeholder-detail-card-title"><i class="ri-shield-check-line text-success fs-16"></i> Daftar Evaluasi / Kuis</h6>
                                <button @click="openKuisModal(item.id)" class="btn btn-sm rounded-pill px-2 py-1 fw-medium fs-12 stakeholder-sub-add-btn stakeholder-sub-add-btn-success"><i class="ri-add-line"></i> Kuis</button>
                              </div>
                              <div class="card-body px-3 pb-3 pt-0">
                                <div class="list-group rounded-3">
                                  <div v-if="classKuisList.length === 0" class="text-center text-muted py-3 fs-12 bg-light rounded-3">Belum ada evaluasi / kuis.</div>
                                  <div v-for="(q, index) in classKuisList" :key="q.id" class="list-group-item d-flex justify-content-between align-items-center px-3 py-2 rounded-3 border-0 mb-1 stakeholder-detail-list-item">
                                    <div class="d-flex align-items-start gap-3 overflow-hidden me-2 w-100">
                                      <div class="mt-1 flex-shrink-0">
                                        <div class="avatar avatar-sm rounded-circle bg-success-transparent text-success fw-bold fs-12 d-flex align-items-center justify-content-center">Q{{ index + 1 }}</div>
                                      </div>
                                      <div class="overflow-hidden w-100">
                                        <div class="fw-bold fs-13 mb-0 text-truncate stakeholder-detail-card-title">{{ q.judul }}</div>
                                        <div class="d-flex align-items-center gap-2 flex-wrap mt-1">
                                          <span v-if="q.tipe_kuis === 'per_materi'" class="badge bg-primary-transparent text-primary fs-11 px-2 py-1 fw-semibold">
                                            <i class="ri-book-open-line me-1"></i> Materi: <span class="text-truncate d-inline-block align-bottom" style="max-width: 80px;">{{ findMateriJudul(q.id_materi) }}</span>
                                          </span>
                                          <span v-else class="badge bg-success-transparent text-success fs-11 px-2 py-1 fw-bold">
                                            <i class="ri-medal-line me-1"></i> FINAL KELAS
                                          </span>
                                          <span class="text-muted fs-11 fw-bold"><i class="ri-timer-line text-muted"></i> {{ q.durasi_menit || q.durasi || 0 }} Menit</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div class="d-flex gap-1 flex-shrink-0">
                                      <button @click="openKuisModal(item.id, q)" class="btn btn-sm btn-icon btn-outline-primary rounded-circle border-0 bg-primary-transparent" title="Edit"><i class="ri-edit-line"></i></button>
                                      <button @click="openDeleteModal('kuis', q)" class="btn btn-sm btn-icon btn-outline-danger rounded-circle border-0 bg-danger-transparent" title="Hapus"><i class="ri-delete-bin-line"></i></button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <div class="pagination-container stakeholders-pagination mt-2 mb-0 pb-0">
            <div class="stakeholders-pagination-copy">
              Showing {{ displayData.length ? (currentPage - 1) * itemsPerPage + 1 : 0 }}-{{ Math.min(currentPage * itemsPerPage, filteredData.length) }} of {{ filteredData.length }} kelas
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

  <!-- ===================== MODALS ===================== -->
  
  <!-- KELAS MODAL -->
  <div v-if="activeModal === 'kelas'" class="modal-overlay" @click.self="activeModal = null">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content border-0 bg-transparent">
        <div class="card custom-card gradient-header-card w-100 mb-0 custom-modal">
          <div class="card-header d-flex justify-content-between align-items-center gap-3 users-header">
            <div class="d-flex align-items-center gap-3"><div class="header-icon-box"><i class="ri-graduation-cap-line"></i></div><div><div class="card-title mb-0 text-white fw-bold header-card-title">{{ isEdit ? 'Edit Kelas' : 'Tambah Kelas Baru' }}</div></div></div>
            <button type="button" class="btn-close btn-close-white" @click="activeModal = null"></button>
          </div>
          <div class="card-body p-4 bg-white">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label fw-semibold">Nama Kelas <span class="text-danger">*</span></label>
                <input v-model="formKelas.nama_kelas" type="text" class="form-control kse-modal-input" :class="{'is-invalid': formErrors.nama_kelas}" placeholder="Masukkan nama kelas...">
                <div class="invalid-feedback">{{ formErrors.nama_kelas }}</div>
              </div>
              <div class="col-12">
                <label class="form-label fw-semibold">Deskripsi <span class="text-danger">*</span></label>
                <textarea v-model="formKelas.deskripsi" class="form-control kse-modal-input" :class="{'is-invalid': formErrors.deskripsi}" rows="3" placeholder="Deskripsi..."></textarea>
                <div class="invalid-feedback">{{ formErrors.deskripsi }}</div>
              </div>
              <div class="col-12">
                <label class="form-label fw-semibold">Thumbnail URL</label>
                
                <div class="d-flex flex-column gap-3">
                  <input
                    v-model="formKelas.thumbnail"
                    type="text"
                    class="form-control kse-modal-input"
                    placeholder="Masukkan URL Gambar (Misal: https://example.com/foto.jpg)"
                  />

                  <div v-if="thumbnailPreview" class="thumbnail-preview-box rounded-4 border p-2 bg-light d-flex align-items-center justify-content-center overflow-hidden position-relative" style="height: 160px;">
                    <img :src="thumbnailPreview" class="w-100 h-100 object-fit-cover rounded-3" alt="Preview" @error="formKelas.thumbnail = ''" />
                    <button @click="formKelas.thumbnail = ''" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 rounded-circle" style="width: 28px; height: 28px; padding: 0;">
                      <i class="ri-close-line"></i>
                    </button>
                  </div>
                  <div v-else class="thumbnail-placeholder rounded-4 border-dashed p-4 text-center bg-light">
                    <i class="ri-image-line fs-1 text-muted opacity-50"></i>
                    <p class="text-muted fs-12 mb-0">Belum ada URL gambar</p>
                  </div>
                </div>
              </div>
              <div class="col-12">
                <label class="form-label fw-semibold">Status</label>
                <select v-model="formKelas.status" class="form-select kse-modal-input">
                  <option value="published">Publish</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
          </div>
          <div class="card-footer bg-light d-flex justify-content-end gap-2">
            <button class="btn btn-outline-danger" @click="activeModal = null">Batal</button>
            <button class="btn btn-primary" @click="saveKelas" :disabled="isSaving"><span v-if="isSaving" class="spinner-border spinner-border-sm me-1"></span>Simpan</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- KELAS MODAL (Materi & Kuis Modals removed, replaced by routing) -->

  <!-- DELETE MODAL -->
  <div v-if="activeModal === 'delete'" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="activeModal = null">
    <div class="modal-dialog modal-dialog-centered modal-sm custom-modal">
      <div class="modal-content border-0 bg-transparent">
        <div class="kse-modal-box kse-modal-sm w-100">
          <div class="kse-modal-header kse-modal-header-danger">
            <div class="d-flex align-items-center gap-3">
              <div class="kse-modal-icon-wrap"><i class="ri-delete-bin-line"></i></div>
              <div>
                <div class="kse-modal-title">Hapus {{ deleteType === 'kelas' ? 'Kelas' : deleteType === 'materi' ? 'Materi' : 'Kuis' }}</div>
              </div>
            </div>
          </div>
          <div class="kse-modal-body text-center">
            <p class="mb-0 fs-14">Yakin ingin menghapus <strong>{{ deleteTarget?.nama_kelas || deleteTarget?.judul }}</strong>?</p>
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
