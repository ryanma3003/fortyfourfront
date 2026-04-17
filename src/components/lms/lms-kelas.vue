<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useLmsStore } from "../../stores/lms";
import { useRouter } from "vue-router";
import { lmsService } from "../../services/lms.service";

export default {
  components: { Pageheader },
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

    const materiCounts = ref<Record<string, number>>({});
    const kuisCounts = ref<Record<string, number>>({});

    const computedTotalMateri = computed(() => {
      let sum = 0;
      for (const k of lmsStore.kelasList) {
        if (k.jumlah_materi !== undefined) sum += Number(k.jumlah_materi);
        else if (k._count?.materi !== undefined) sum += Number(k._count.materi);
        else if (Array.isArray(k.materi)) sum += k.materi.length;
        else sum += (materiCounts.value[k.id] || 0);
      }
      return sum;
    });

    const computedTotalKuis = computed(() => {
      let sum = 0;
      for (const k of lmsStore.kelasList) {
        if (k.jumlah_kuis !== undefined) sum += Number(k.jumlah_kuis);
        else if (k._count?.kuis !== undefined) sum += Number(k._count.kuis);
        else if (Array.isArray(k.kuis_list)) sum += k.kuis_list.length;
        else if (Array.isArray(k.kuis)) sum += k.kuis.length;
        else sum += (kuisCounts.value[k.id] || 0);
      }
      return sum;
    });

    const loadGlobalStats = async () => {
      for (const k of lmsStore.kelasList) {
        if (k.jumlah_materi === undefined && k._count?.materi === undefined && !Array.isArray(k.materi)) {
          lmsService.getMateriByKelas(k.id).then(m => materiCounts.value[k.id] = m.length).catch(() => {});
        }
        if (k.jumlah_kuis === undefined && k._count?.kuis === undefined && !Array.isArray(k.kuis_list) && !Array.isArray(k.kuis)) {
          lmsService.getKuisByKelas(k.id).then(q => kuisCounts.value[k.id] = q.length).catch(() => {});
        }
      }
    };

    // Fetch on mount
    onMounted(async () => {
      try {
        await lmsStore.fetchKelas();
        loadGlobalStats();
      } catch (e: any) {
        showNotification(e.message || "Gagal memuat data kelas", "error");
      }
    });

    const filteredData = computed(() => {
      const q = searchQuery.value.toLowerCase().trim();
      if (!q) return lmsStore.kelasList;
      return lmsStore.kelasList.filter(
        (k) =>
          getKelasName(k).toLowerCase().includes(q) ||
          getKelasDescription(k).toLowerCase().includes(q)
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

    const goCreate = () => router.push("/lms/kelas/create");
    const goEdit = (id: string | number) => router.push(`/lms/kelas/edit/${id}`);

    // Navigate into kelas to manage materi & kuis
    const goMateri = (id: string | number) => router.push({ path: '/lms/materi', state: { kelasId: id } });
    const goKuis = (id: string | number) => router.push({ path: '/lms/quiz', state: { kelasId: id } });

    // Add Materi & Quiz globally
    const goAddMateri = () => router.push(`/lms/materi/create`);
    const goAddQuiz = () => router.push(`/lms/quiz/create`);

    const openDeleteModal = (item: any) => {
      deleteTarget.value = item;
      showDeleteModal.value = true;
    };
    const confirmDelete = async () => {
      if (deleteTarget.value) {
        isDeleting.value = true;
        try {
          await lmsStore.deleteKelas(deleteTarget.value.id);
          showNotification("Kelas berhasil dihapus!", "success");
        } catch (e: any) {
          showNotification(e.message || "Gagal menghapus kelas", "error");
        } finally {
          isDeleting.value = false;
        }
      }
      showDeleteModal.value = false;
      deleteTarget.value = null;
    };

    const formatDate = (iso: string) => {
      if (!iso) return "-";
      const d = new Date(iso);
      return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    };

    const getKelasName = (item: any) => {
      const name = String(item?.nama_kelas ?? "").trim();
      return name || "Tanpa Nama";
    };

    const getKelasDescription = (item: any) =>
      String(item?.deskripsi ?? "").trim();

    const getAvatarLetter = (item: any) => getKelasName(item).charAt(0).toUpperCase();

    const getAvatarClass = (letter: string) => {
      const variants = [
        "avatar-blue","avatar-indigo","avatar-violet","avatar-purple",
        "avatar-teal","avatar-cyan","avatar-green","avatar-amber",
        "avatar-orange","avatar-red",
      ];
      const idx = (letter.toUpperCase().charCodeAt(0) - 65 + variants.length) % variants.length;
      return variants[idx];
    };

    const getStatusClass = (status: string) => {
      const s = (status || '').toLowerCase();
      if (s === 'aktif') return 'badge-sektor-teal';
      if (s === 'draft') return 'badge-sektor-amber';
      return 'badge-sektor-default';
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
      goMateri,
      goKuis,
      goAddMateri,
      goAddQuiz,
      openDeleteModal,
      confirmDelete,
      showDeleteModal,
      deleteTarget,
      isDeleting,
      showToast,
      toastMessage,
      toastType,
      formatDate,
      getKelasName,
      getKelasDescription,
      getAvatarLetter,
      getAvatarClass,
      getStatusClass,
      computedTotalMateri,
      computedTotalKuis
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
              <i class="ri-graduation-cap-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">Daftar Kelas</div>
              <div class="header-subtitle mt-1">Kelola kelas pembelajaran LMS</div>
            </div>
          </div>
          <div class="d-flex gap-2 align-items-center flex-wrap header-inner">
            <div class="search-container position-relative">
              <i class="ri-search-line" style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#999;pointer-events:none;z-index:10;font-size:15px;"></i>
              <input v-model="searchQuery" type="text" class="form-control form-control-sm header-search-input"
                placeholder="Cari kelas..." />
              <button v-if="searchQuery" @click="clearSearch" class="clear-btn">
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
            <p class="text-muted mt-2 fs-13">Memuat data kelas...</p>
          </div>

          <template v-else>
            <!-- Stats -->
            <div class="stats-strip mb-4">
              <div class="stat-card">
                <div class="stat-icon stat-icon-blue"><i class="ri-graduation-cap-line"></i></div>
                <div>
                  <div class="stat-value">{{ lmsStore.totalKelas }}</div>
                  <div class="stat-label">Total Kelas</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-violet"><i class="ri-book-open-line"></i></div>
                <div>
                  <div class="stat-value">{{ computedTotalMateri }}</div>
                  <div class="stat-label">Total Materi</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-teal"><i class="ri-questionnaire-line"></i></div>
                <div>
                  <div class="stat-value">{{ computedTotalKuis }}</div>
                  <div class="stat-label">Total Kuis</div>
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
              <div class="d-flex align-items-center gap-2">
                <button @click="goCreate" class="btn btn-warning d-flex align-items-center gap-2">
                  <i class="ri-add-circle-line fs-16"></i>
                  <span>Tambah Kelas</span>
                </button>
                <button @click="goAddMateri" class="btn btn-info d-flex align-items-center gap-2">
                  <i class="ri-add-circle-line fs-16"></i>
                  <span>Add Materi</span>
                </button>
                <button @click="goAddQuiz" class="btn btn-success d-flex align-items-center gap-2">
                  <i class="ri-add-circle-line fs-16"></i>
                  <span>Add Soal/Quiz</span>
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
                        <i class="ri-graduation-cap-line text-primary"></i><span>Nama Kelas</span>
                      </div>
                    </th>
                    <th style="width:30%">Deskripsi</th>
                    <th style="width:10%" class="text-center">Status</th>
                    <th style="width:12%">Tanggal</th>
                    <th class="text-center" style="width:160px">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!displayData.length">
                    <td colspan="6" class="text-center py-5">
                      <div class="empty-state">
                        <div class="empty-icon-ring mb-3">
                          <div class="empty-icon-inner"><i class="ri-graduation-cap-line"></i></div>
                        </div>
                        <h6 class="fw-semibold mb-1 empty-state-title">Belum Ada Kelas</h6>
                        <p class="text-muted fs-13 mb-3">Klik tombol "Tambah Kelas" untuk membuat kelas baru</p>
                      </div>
                    </td>
                  </tr>
                  <tr v-for="(item, i) in displayData" :key="item.id ?? i" class="stakeholder-row">
                    <td class="align-middle text-center">
                      <span class="row-number">{{ (currentPage - 1) * itemsPerPage + i + 1 }}</span>
                    </td>
                    <td class="align-middle">
                      <div class="d-flex align-items-center gap-3">
                        <div class="company-avatar" :class="getAvatarClass(getAvatarLetter(item))">
                          <span class="company-avatar-letter">{{ getAvatarLetter(item) }}</span>
                        </div>
                        <div class="company-name-wrap">
                          <span class="company-name d-block">{{ getKelasName(item) }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="align-middle">
                      <span class="text-muted fs-13" style="white-space:normal;max-width:300px;display:inline-block;">{{ getKelasDescription(item) || '-' }}</span>
                    </td>
                    <td class="align-middle text-center">
                      <span class="badge-sektor" :class="getStatusClass(item.status || 'draft')">{{ item.status || 'Draft' }}</span>
                    </td>
                    <td class="align-middle">
                      <span class="text-muted fs-12">{{ formatDate(item.updated_at || item.created_at || '') }}</span>
                    </td>
                    <td class="align-middle text-center">
                      <div class="d-flex align-items-center justify-content-center gap-1">
                        <button @click="goMateri(item.id)" class="btn btn-sm btn-icon btn-outline-info" title="Materi">
                          <i class="ri-book-open-line fs-14"></i>
                        </button>
                        <button @click="goKuis(item.id)" class="btn btn-sm btn-icon btn-outline-warning" title="Kuis">
                          <i class="ri-questionnaire-line fs-14"></i>
                        </button>
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
                dari {{ filteredData.length }} kelas
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
                <div class="kse-modal-title">Hapus Kelas</div>
                <div class="kse-modal-sub">Semua materi dan kuis di kelas ini akan ikut terhapus</div>
              </div>
            </div>
            <button class="kse-modal-close" @click="showDeleteModal = false"><i class="ri-close-line"></i></button>
          </div>
          <div class="kse-modal-body">
            <p class="mb-0 fs-14">Yakin ingin menghapus kelas <strong>{{ getKelasName(deleteTarget) }}</strong>?</p>
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
