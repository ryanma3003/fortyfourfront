<script lang="ts">
import { ref, computed } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useLmsStore } from "../../stores/lms";
import { useRouter } from "vue-router";

export default {
  components: { Pageheader },
  data() {
    return {
      dataToPass: {
        title: { label: "Dashboard", path: "/dashboard" },
        currentpage: "LMS — Soal / Quiz",
        activepage: "Quiz",
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

    const filteredData = computed(() => {
      const q = searchQuery.value.toLowerCase().trim();
      if (!q) return lmsStore.quizList;
      return lmsStore.quizList.filter(
        (quiz) =>
          quiz.judul.toLowerCase().includes(q) ||
          quiz.deskripsi.toLowerCase().includes(q)
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

    const goCreate = () => router.push("/lms/quiz/create");
    const goEdit = (id: string) => router.push(`/lms/quiz/edit/${id}`);

    const openDeleteModal = (item: any) => {
      deleteTarget.value = item;
      showDeleteModal.value = true;
    };
    const confirmDelete = () => {
      if (deleteTarget.value) {
        lmsStore.deleteQuiz(deleteTarget.value.id);
        showNotification("Quiz berhasil dihapus!", "success");
      }
      showDeleteModal.value = false;
      deleteTarget.value = null;
    };

    const formatDate = (iso: string) => {
      const d = new Date(iso);
      return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    };

    const countByType = (quiz: any, tipe: string) =>
      quiz.soalList.filter((s: any) => s.tipe === tipe).length;

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
      showToast,
      toastMessage,
      toastType,
      formatDate,
      countByType,
      getAvatarClass,
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
              <i class="ri-questionnaire-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">Daftar Soal / Quiz</div>
              <div class="header-subtitle mt-1">Kelola soal dan quiz pembelajaran LMS</div>
            </div>
          </div>
          <div class="d-flex gap-2 align-items-center flex-wrap header-inner">
            <div class="search-container position-relative">
              <i class="ri-search-line" style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#999;pointer-events:none;z-index:10;font-size:15px;"></i>
              <input v-model="searchQuery" type="text" class="form-control form-control-sm header-search-input"
                placeholder="Cari quiz..." />
              <button v-if="searchQuery" @click="clearSearch" class="clear-btn">
                <i class="ri-close-circle-fill"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="card-body p-4">
          <!-- Stats -->
          <div class="stats-strip mb-4">
            <div class="stat-card">
              <div class="stat-icon stat-icon-violet"><i class="ri-questionnaire-line"></i></div>
              <div>
                <div class="stat-value">{{ lmsStore.totalQuiz }}</div>
                <div class="stat-label">Total Quiz</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon-blue"><i class="ri-file-list-3-line"></i></div>
              <div>
                <div class="stat-value">{{ lmsStore.totalSoal }}</div>
                <div class="stat-label">Total Soal</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon-teal"><i class="ri-book-open-line"></i></div>
              <div>
                <div class="stat-value">{{ lmsStore.totalMateri }}</div>
                <div class="stat-label">Total Materi</div>
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
                <span>Tambah Quiz</span>
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
                      <i class="ri-questionnaire-line text-primary"></i><span>Judul Quiz</span>
                    </div>
                  </th>
                  <th style="width:25%">Deskripsi</th>
                  <th style="width:10%" class="text-center">Jumlah Soal</th>
                  <th style="width:10%" class="text-center">Pilihan Ganda</th>
                  <th style="width:10%" class="text-center">Essay</th>
                  <th style="width:10%">Tanggal</th>
                  <th class="text-center" style="width:100px">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!displayData.length">
                  <td colspan="8" class="text-center py-5">
                    <div class="empty-state">
                      <div class="empty-icon-ring mb-3">
                        <div class="empty-icon-inner"><i class="ri-questionnaire-line"></i></div>
                      </div>
                      <h6 class="fw-semibold mb-1 empty-state-title">Belum Ada Quiz</h6>
                      <p class="text-muted fs-13 mb-3">Klik tombol "Tambah Quiz" untuk membuat quiz baru</p>
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
                    <span class="text-muted fs-13" style="white-space:normal;max-width:250px;display:inline-block;">{{ item.deskripsi }}</span>
                  </td>
                  <td class="align-middle text-center">
                    <span class="badge bg-primary-transparent rounded-pill px-3">{{ item.soalList.length }}</span>
                  </td>
                  <td class="align-middle text-center">
                    <span class="badge bg-info-transparent rounded-pill px-3">{{ countByType(item, 'pilihan_ganda') }}</span>
                  </td>
                  <td class="align-middle text-center">
                    <span class="badge bg-warning-transparent rounded-pill px-3">{{ countByType(item, 'essay') }}</span>
                  </td>
                  <td class="align-middle">
                    <span class="text-muted fs-12">{{ formatDate(item.updatedAt) }}</span>
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
              dari {{ filteredData.length }} quiz
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
                <div class="kse-modal-title">Hapus Quiz</div>
                <div class="kse-modal-sub">Tindakan ini tidak dapat dibatalkan</div>
              </div>
            </div>
            <button class="kse-modal-close" @click="showDeleteModal = false"><i class="ri-close-line"></i></button>
          </div>
          <div class="kse-modal-body">
            <p class="mb-0 fs-14">Yakin ingin menghapus quiz <strong>{{ deleteTarget?.judul }}</strong> beserta {{ deleteTarget?.soalList?.length || 0 }} soal?</p>
          </div>
          <div class="kse-modal-footer">
            <button class="btn btn-light kse-modal-cancel" @click="showDeleteModal = false">Batal</button>
            <button class="btn btn-danger" @click="confirmDelete">
              <i class="ri-delete-bin-line me-1"></i>Hapus
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
</style>
