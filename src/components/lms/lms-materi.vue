<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useLmsStore } from "../../stores/lms";
import { useRouter, useRoute } from "vue-router";
import { lmsService } from "../../services/lms.service";

export default {
  components: { Pageheader },
  data() {
    return {
      dataToPass: {
        title: { label: "Daftar Kelas", path: "/lms/kelas" },
        currentpage: "LMS — Materi",
        activepage: "Materi",
      },
    };
  },
  setup() {
    const lmsStore = useLmsStore();
    const router = useRouter();
    const route = useRoute();

    const searchQuery = ref("");
    const currentPage = ref(1);
    const itemsPerPage = ref(10);
    const showDeleteModal = ref(false);
    const deleteTarget = ref<any>(null);
    const isDeleting = ref(false);

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

    // Get kelasId from route or history state
    const kelasId = computed(() => route.params.kelasId || route.query.kelasId || history.state?.kelasId || '');

    const soalCounts = ref<Record<string, number>>({});
    const loadMissingSoalCounts = async () => {
      for (const kuis of lmsStore.kuisList) {
        if (
          kuis.jumlah_soal === undefined &&
          kuis.total_soal === undefined &&
          kuis.count_soal === undefined &&
          kuis._count?.soal === undefined && 
          (!Array.isArray(kuis.soal) || kuis.soal.length === 0)
        ) {
          lmsService.getSoalByKuis(kuis.id).then((arr) => {
             soalCounts.value[kuis.id] = arr.length;
          }).catch(() => {});
        }
      }
    };

    const computedTotalSoal = computed(() => {
      let sum = 0;
      for (const k of lmsStore.kuisList) {
        if (k.jumlah_soal !== undefined) sum += Number(k.jumlah_soal);
        else if (k.total_soal !== undefined) sum += Number(k.total_soal);
        else if (k.count_soal !== undefined) sum += Number(k.count_soal);
        else if (k._count?.soal !== undefined) sum += Number(k._count.soal);
        else if (Array.isArray(k.soal)) sum += k.soal.length;
        else sum += (soalCounts.value[k.id] || 0);
      }
      return sum;
    });

    // Fetch materi and kuis on mount
    onMounted(async () => {
      try {
        await Promise.all([
          lmsStore.fetchMateri(kelasId.value as string),
          lmsStore.fetchKuis(kelasId.value as string)
        ]);
        loadMissingSoalCounts();
      } catch (e: any) {
        showNotification(e.message || "Gagal memuat data", "error");
      }
    });

    const filteredData = computed(() => {
      const q = searchQuery.value.toLowerCase().trim();
      if (!q) return lmsStore.materiList;
      return lmsStore.materiList.filter(
        (m) =>
          m.judul.toLowerCase().includes(q) ||
          m.kategori.toLowerCase().includes(q) ||
          m.deskripsi.toLowerCase().includes(q)
      );
    });

    const totalPages = computed(() =>
      Math.max(1, Math.ceil(filteredData.value.length / itemsPerPage.value))
    );
    const displayData = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredData.value.slice(start, start + itemsPerPage.value);
    });

    const clearSearch = () => {
      searchQuery.value = "";
      currentPage.value = 1;
    };

    const goCreate = () => {
      const kid = kelasId.value;
      if (kid) {
        router.push({ path: '/lms/materi/create', state: { kelasId: kid } });
      } else {
        router.push("/lms/materi/create");
      }
    };
    const goEdit = (id: string | number) => {
      const kid = kelasId.value;
      if (kid) {
        router.push({ path: `/lms/materi/edit/${id}`, state: { kelasId: kid } });
      } else {
        router.push(`/lms/materi/edit/${id}`);
      }
    };

    const openDeleteModal = (item: any) => {
      deleteTarget.value = item;
      showDeleteModal.value = true;
    };
    const confirmDelete = async () => {
      if (deleteTarget.value) {
        isDeleting.value = true;
        try {
          await lmsStore.deleteMateri(deleteTarget.value.id);
          showNotification("Materi berhasil dihapus!", "success");
        } catch (e: any) {
          showNotification(e.message || "Gagal menghapus materi", "error");
        } finally {
          isDeleting.value = false;
        }
      }
      showDeleteModal.value = false;
      deleteTarget.value = null;
    };

    const formatDate = (iso: string) => {
      if (!iso) return '-';
      const d = new Date(iso);
      return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    };

    const getKategoriClass = (kat: string) => {
      const map: Record<string, string> = {
        Cybersecurity: "badge-sektor-blue",
        CSIRT: "badge-sektor-teal",
        Networking: "badge-sektor-violet",
        Compliance: "badge-sektor-amber",
      };
      return map[kat] || "badge-sektor-default";
    };

    const getAvatarClass = (letter: string) => {
      const variants = [
        "avatar-blue","avatar-indigo","avatar-violet","avatar-purple",
        "avatar-teal","avatar-cyan","avatar-green","avatar-amber",
        "avatar-orange","avatar-red",
      ];
      const idx = (letter.toUpperCase().charCodeAt(0) - 65 + variants.length) % variants.length;
      return variants[idx];
    };

    return {
      lmsStore,
      searchQuery,
      currentPage,
      itemsPerPage,
      filteredData,
      totalPages,
      displayData,
      clearSearch,
      goCreate,
      goEdit,
      openDeleteModal,
      confirmDelete,
      showDeleteModal,
      deleteTarget,
      isDeleting,
      showToast,
      toastMessage,
      toastType,
      formatDate,
      getKategoriClass,
      getAvatarClass,
      computedTotalSoal,
    };
  },
};
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Toast -->
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
      <div class="card custom-card gradient-header-card">
        <!-- Header -->
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3 stakeholder-header">
          <div class="d-flex align-items-center gap-3 header-inner">
            <div class="header-icon-box">
              <i class="ri-book-open-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">Daftar Materi</div>
              <div class="header-subtitle mt-1">Kelola materi pembelajaran LMS</div>
            </div>
          </div>
          <div class="d-flex gap-2 align-items-center flex-wrap header-inner">
            <div class="search-container position-relative">
              <i class="ri-search-line" style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#999;pointer-events:none;z-index:10;font-size:15px;"></i>
              <input v-model="searchQuery" type="text" class="form-control form-control-sm lms-search-input"
                placeholder="Cari materi..." />
              <button v-if="searchQuery" @click="clearSearch" class="lms-clear-btn">
                <i class="ri-close-circle-fill"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="card-body p-4">
          <!-- Loading -->
          <div v-if="lmsStore.loading" class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="text-muted mt-2 fs-13">Memuat data materi...</p>
          </div>

          <template v-else>
            <!-- Stats -->
            <div class="stats-strip mb-4">
              <div class="stat-card">
                <div class="stat-icon stat-icon-blue"><i class="ri-book-open-line"></i></div>
                <div>
                  <div class="stat-value">{{ lmsStore.totalMateri }}</div>
                  <div class="stat-label">Total Materi</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-violet"><i class="ri-questionnaire-line"></i></div>
                <div>
                  <div class="stat-value">{{ lmsStore.totalKuis }}</div>
                  <div class="stat-label">Total Kuis</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-teal"><i class="ri-file-list-3-line"></i></div>
                <div>
                  <div class="stat-value">{{ computedTotalSoal }}</div>
                  <div class="stat-label">Total Soal</div>
                </div>
              </div>
            </div>

            <!-- Controls -->
            <div class="controls-bar d-flex flex-wrap justify-content-between align-items-center mb-4 pb-3 border-bottom gap-3">
              <div class="d-flex align-items-center gap-3 flex-wrap">
                <div class="d-flex align-items-center gap-2">
                  <span class="text-muted fs-13">Tampilkan</span>
                  <select v-model="itemsPerPage" class="form-select form-select-sm entries-select">
                    <option v-for="n in [5, 10, 15, 20, 50]" :key="n" :value="n">{{ n }}</option>
                  </select>
                  <span class="text-muted fs-13">per halaman</span>
                </div>
              </div>
              <div class="d-flex flex-wrap align-items-center gap-2 ms-auto">
                <button @click="goCreate" class="btn stakeholders-add-btn d-flex align-items-center gap-2" style="background: linear-gradient(180deg, #0d9488 0%, #0f766e 100%) !important; box-shadow: 0 8px 24px rgba(13, 148, 136, 0.22);">
                  <i class="ri-add-circle-line fs-13"></i>
                  <span>Tambah Materi</span>
                </button>
              </div>
            </div>

            <!-- Table -->
            <div class="table-responsive stakeholder-table-wrap">
              <table class="table stakeholder-table text-nowrap mb-0">
                <thead class="stakeholder-thead">
                  <tr>
                    <th style="width:50px">No</th>
                    <th style="width:30%">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-book-2-line text-primary"></i><span>Judul Materi</span>
                      </div>
                    </th>
                    <th style="width:12%">Kategori</th>
                    <th style="width:30%">Deskripsi</th>
                    <th style="width:12%">Tanggal</th>
                    <th class="text-center" style="width:100px">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!displayData.length">
                    <td colspan="6" class="text-center py-5">
                      <div class="empty-state">
                        <div class="empty-icon-ring mb-3">
                          <div class="empty-icon-inner"><i class="ri-book-open-line"></i></div>
                        </div>
                        <h6 class="fw-semibold mb-1 empty-state-title">Belum Ada Materi</h6>
                        <p class="text-muted fs-13 mb-3">Klik tombol "Tambah Materi" untuk membuat materi baru</p>
                      </div>
                    </td>
                  </tr>
                  <tr v-for="(item, i) in displayData" :key="item.id" class="stakeholder-row">
                    <td class="align-middle text-center">
                      <span class="row-number">{{ (currentPage - 1) * itemsPerPage + i + 1 }}</span>
                    </td>
                    <td class="align-middle">
                      <div class="d-flex align-items-center gap-3">
                        <div class="company-avatar" :class="getAvatarClass(item.judul.charAt(0))">
                          <span class="company-avatar-letter">{{ item.judul.charAt(0).toUpperCase() }}</span>
                        </div>
                        <div class="company-name-wrap">
                          <span class="company-name d-block">{{ item.judul }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="align-middle">
                      <span class="badge-sektor" :class="getKategoriClass(item.kategori)">{{ item.kategori }}</span>
                    </td>
                    <td class="align-middle">
                      <span class="text-muted fs-13" style="white-space:normal;max-width:300px;display:inline-block;">{{ item.deskripsi }}</span>
                    </td>
                    <td class="align-middle">
                      <span class="text-muted fs-12">{{ formatDate(item.updated_at || item.created_at || '') }}</span>
                    </td>
                    <td class="align-middle text-center">
                      <div class="d-flex align-items-center justify-content-center gap-1">
                        <button @click="goEdit(item.id)" class="btn btn-sm btn-icon btn-outline-primary" title="Edit">
                          <i class="ri-edit-line fs-14"></i>
                        </button>
                        <button @click="openDeleteModal(item)" class="btn btn-sm btn-icon btn-outline-danger" title="Hapus">
                          <i class="ri-delete-bin-line fs-14"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div v-if="filteredData.length > itemsPerPage" class="d-flex flex-wrap justify-content-between align-items-center mt-4 gap-3 pagination-container">
              <span class="text-muted fs-13">
                Menampilkan {{ (currentPage - 1) * itemsPerPage + 1 }}–{{ Math.min(currentPage * itemsPerPage, filteredData.length) }}
                dari {{ filteredData.length }} materi
              </span>
              <nav>
                <ul class="pagination mb-0 gap-1">
                  <li class="page-item" :class="{ disabled: currentPage <= 1 }">
                    <a class="page-link" @click.prevent="currentPage--" href="#">
                      <i class="ri-arrow-left-s-line"></i>
                    </a>
                  </li>
                  <li v-for="p in totalPages" :key="p" class="page-item" :class="{ active: p === currentPage }">
                    <a class="page-link" @click.prevent="currentPage = p" href="#">{{ p }}</a>
                  </li>
                  <li class="page-item" :class="{ disabled: currentPage >= totalPages }">
                    <a class="page-link" @click.prevent="currentPage++" href="#">
                      <i class="ri-arrow-right-s-line"></i>
                    </a>
                  </li>
                </ul>
              </nav>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- Delete Modal -->
  <Teleport to="body">
    <transition name="kse-modal-fade">
      <div v-if="showDeleteModal" class="kse-modal-overlay" @click.self="showDeleteModal = false">
        <div class="kse-modal-box kse-modal-sm">
          <div class="kse-modal-header kse-modal-header-danger">
            <div class="d-flex align-items-center gap-3">
              <div class="kse-modal-icon-wrap"><i class="ri-delete-bin-line"></i></div>
              <div>
                <div class="kse-modal-title">Hapus Materi</div>
                <div class="kse-modal-sub">Tindakan ini tidak dapat dibatalkan</div>
              </div>
            </div>
            <button class="kse-modal-close" @click="showDeleteModal = false"><i class="ri-close-line"></i></button>
          </div>
          <div class="kse-modal-body">
            <p class="mb-0 fs-14">Yakin ingin menghapus materi <strong>{{ deleteTarget?.judul }}</strong>?</p>
          </div>
          <div class="kse-modal-footer">
            <button class="btn btn-light kse-modal-cancel" @click="showDeleteModal = false">Batal</button>
            <button class="btn btn-danger" @click="confirmDelete" :disabled="isDeleting">
              <span v-if="isDeleting" class="spinner-border spinner-border-sm me-1"></span>
              <i v-else class="ri-delete-bin-line me-1"></i>Hapus
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
</style>
