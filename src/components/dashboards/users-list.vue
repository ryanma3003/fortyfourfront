<script lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import users from "../../utils/users.json";
import { useAuthStore } from "../../stores/auth";
import { useProfileStore } from "../../stores/profile";

interface User {
  id: number;
  slug: string;
  username: string;
  password: string;
  name: string;
  jabatan: string;
  role: string;
  phone: string;
  location: string;
  joined: string;
  token: string;
  photo?: string;
}

export default {
  data() {
    return {
      dataToPass: {
        title: { label: "Dashboards", path: "/dashboards" },
        currentpage: "Users",
        activepage: "Users",
      },
    };
  },
  components: { Pageheader },
  setup() {
    const authStore = useAuthStore();
    const profileStore = useProfileStore();

    const items = ref<User[]>([]);
    const loading = ref(false);
    const searchQuery = ref("");
    const sortField = ref<"name" | "role">("name");
    const sortOrder = ref<"asc" | "desc">("asc");
    const currentPage = ref(1);
    const itemsPerPage = ref(10);

    // CRUD state
    const showEditModal = ref(false);
    const showDeleteModal = ref(false);
    const currentEditItem = ref<User | null>(null);
    const currentDeleteItem = ref<User | null>(null);
    const showToast = ref(false);
    const toastMessage = ref("");
    const toastType = ref<"success" | "error">("success");

    // Form state for editing role
    const formData = ref<{ role: string; jabatan: string }>({
      role: "",
      jabatan: "",
    });

    const loadUsers = async () => {
      loading.value = true;
      await new Promise((r) => setTimeout(r, 500));

      // Load profile data from storage with proper user switching
      profileStore.switchUser();

      // Get current logged-in user info
      const currentUser = authStore.currentUser;

      // Map users and merge dynamic data for current user
      items.value = users.map((u: User) => {
        // If this is the current logged-in user and profile has been customized
        if (
          currentUser &&
          u.id === currentUser.id &&
          profileStore.isCustomized
        ) {
          return {
            ...u,
            jabatan: profileStore.jabatan || u.jabatan,
            name: profileStore.name || u.name,
            photo: profileStore.avatarUrl || u.photo,
          };
        }
        return { ...u };
      });

      loading.value = false;
    };

    const filteredData = computed(() => {
      let data = items.value;
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        data = data.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            i.username.toLowerCase().includes(q) ||
            i.jabatan.toLowerCase().includes(q) ||
            i.role.toLowerCase().includes(q)
        );
      }
      return [...data].sort((a, b) => {
        const mod = sortOrder.value === "asc" ? 1 : -1;
        return a[sortField.value].localeCompare(b[sortField.value]) * mod;
      });
    });

    const totalPages = computed(() =>
      Math.ceil(filteredData.value.length / itemsPerPage.value)
    );

    const displayData = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredData.value.slice(start, start + itemsPerPage.value);
    });

    const paginationInfo = computed(() => {
      const total = filteredData.value.length;
      if (!total) return "Tidak ada data";
      const start = (currentPage.value - 1) * itemsPerPage.value + 1;
      const end = Math.min(currentPage.value * itemsPerPage.value, total);
      return `${start} - ${end} dari ${total}`;
    });

    // Show toast notification
    const showNotification = (
      message: string,
      type: "success" | "error" = "success"
    ) => {
      toastMessage.value = message;
      toastType.value = type;
      showToast.value = true;
      setTimeout(() => {
        showToast.value = false;
      }, 3000);
    };

    // EDIT ROLE
    const openEditModal = (item: User) => {
      currentEditItem.value = item;
      formData.value = { role: item.role, jabatan: item.jabatan };
      showEditModal.value = true;
    };

    const updateUser = () => {
      if (!currentEditItem.value) return;

      const index = items.value.findIndex(
        (i) => i.id === currentEditItem.value!.id
      );
      if (index !== -1) {
        items.value[index] = {
          ...items.value[index],
          role: formData.value.role,
          jabatan: formData.value.jabatan,
        };
        showEditModal.value = false;
        showNotification("User berhasil diperbarui!", "success");
      }
    };

    // DELETE
    const openDeleteModal = (item: User) => {
      currentDeleteItem.value = item;
      showDeleteModal.value = true;
    };

    const deleteUser = () => {
      if (!currentDeleteItem.value) return;

      const index = items.value.findIndex(
        (i) => i.id === currentDeleteItem.value!.id
      );
      if (index !== -1) {
        items.value.splice(index, 1);
        showDeleteModal.value = false;
        showNotification("User berhasil dihapus!", "success");
      }
    };

    // Get status badge class
    const getStatusClass = (role: string) => {
      return role === "Admin"
        ? "bg-danger-transparent"
        : "bg-info-transparent";
    };

    watch([searchQuery, itemsPerPage], () => (currentPage.value = 1));

    onMounted(loadUsers);

    return {
      items,
      loading,
      searchQuery,
      sortField,
      sortOrder,
      currentPage,
      itemsPerPage,
      totalPages,
      displayData,
      paginationInfo,
      showEditModal,
      showDeleteModal,
      currentEditItem,
      currentDeleteItem,
      formData,
      showToast,
      toastMessage,
      toastType,
      openEditModal,
      updateUser,
      openDeleteModal,
      deleteUser,
      getStatusClass,
      toggleSort: (f: "name" | "role") => {
        if (sortField.value === f)
          sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
        else {
          sortField.value = f;
          sortOrder.value = "asc";
        }
      },
      clearSearch: () => {
        searchQuery.value = "";
        currentPage.value = 1;
      },
    };
  },
};
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Toast Notification -->
  <div v-if="showToast" class="position-fixed top-0 end-0 p-3" style="z-index: 9999">
    <div class="toast show" 
      :class="{ 'bg-success': toastType === 'success', 'bg-danger': toastType === 'error' }" 
      role="alert">
      <div class="toast-body text-white">
        <i :class="toastType === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'" class="me-2"></i>
        {{ toastMessage }}
      </div>
    </div>
  </div>

  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card gradient-header-card">
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3" 
            style="background: radial-gradient(ellipse at top, #032a5c, #084696)">
          <div class="d-flex align-items-center">
            <i class="ri-group-line me-2 fs-18" style="color: white !important;"></i>
            <div class="card-title mb-0" style="color: white !important;">Daftar User</div>
          </div>
          <div class="d-flex gap-2 align-items-center flex-wrap">
            <div class="search-container position-relative" style="min-width: 400px">
              <input v-model="searchQuery" type="text" class="form-control form-control-sm" 
                placeholder="Cari nama, email, jabatan, atau role..." 
                style="background: #fff; color: #333; border: none; padding-right: 60px;" />
              <i class="ri-search-line search-icon" style="color: #666; right: 35px;"></i>
              <button v-if="searchQuery" @click="clearSearch" class="btn btn-sm clear-btn" style="color: #666;">
                <i class="ri-close-line"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="card-body p-4">
          <div v-if="loading" class="text-center p-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="text-muted mt-2 mb-0">Memuat data...</p>
          </div>

          <template v-else>
            <!-- Controls Bar -->
            <div class="controls-bar d-flex flex-wrap justify-content-between align-items-center mb-4 pb-3 border-bottom gap-3">
              <div class="d-flex align-items-center gap-2">
                <div class="d-flex align-items-center bg-light rounded-pill px-3 py-1">
                  <i class="ri-list-ordered me-2 text-primary"></i>
                  <span class="text-muted fs-13 me-2">Tampilkan</span>
                  <select v-model="itemsPerPage" class="form-select form-select-sm border-0 bg-transparent" style="width: 70px">
                    <option v-for="n in [5, 10, 15, 20, 25, 50]" :key="n" :value="n">{{ n }}</option>
                  </select>
                </div>
                <span class="badge bg-primary-transparent text-primary px-3 py-2">
                  <i class="ri-database-2-line me-1"></i>{{ displayData.length }} data
                </span>
              </div>
            </div>

            <!-- Table -->
            <div class="table-responsive rounded-3 border">
              <table class="table table-hover text-nowrap mb-0">
                <thead class="table-light">
                  <tr>
                    <th class="fw-semibold text-muted" style="width: 60px">No</th>
                    <th class="sortable fw-semibold">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-user-line text-primary"></i>
                        <span class="column-label" @click="toggleSort('name')" title="Click to toggle sort">Nama</span>
                        <div class="sort-arrows">
                          <i class="ri-arrow-up-s-line" 
                            :class="{ active: sortField === 'name' && sortOrder === 'asc' }" @click.stop="sortField = 'name'; sortOrder = 'asc';" title="Sort A-Z"></i>
                          <i class="ri-arrow-down-s-line" 
                            :class="{ active: sortField === 'name' && sortOrder === 'desc' }" @click.stop="sortField = 'name'; sortOrder = 'desc';" title="Sort Z-A"></i>
                        </div>
                      </div>
                    </th>
                    <th class="fw-semibold">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-mail-line text-primary"></i>
                        <span>Email</span>
                      </div>
                    </th>
                    <th class="fw-semibold">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-briefcase-line text-primary"></i>
                        <span>Jabatan</span>
                      </div>
                    </th>
                    <th class="sortable fw-semibold">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-shield-user-line text-primary"></i>
                        <span class="column-label" @click="toggleSort('role')" title="Click to toggle sort">Role</span>
                        <div class="sort-arrows">
                          <i class="ri-arrow-up-s-line" 
                            :class="{
                              active:
                                sortField === 'role' && sortOrder === 'asc',
                            }"
                            @click.stop="
                              sortField = 'role';
                              sortOrder = 'asc';
                            "
                            title="Sort A-Z"
                          ></i>
                          <i class="ri-arrow-down-s-line" 
                            :class="{
                              active:
                                sortField === 'role' && sortOrder === 'desc',
                            }"
                            @click.stop="
                              sortField = 'role';
                              sortOrder = 'desc';
                            "
                            title="Sort Z-A"
                          ></i>
                        </div>
                      </div>
                    </th>
                    <th class="text-center fw-semibold" style="width: 120px">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!displayData.length">
                    <td colspan="6" class="text-center py-5">
                      <div class="empty-state">
                        <div class="empty-icon mb-3">
                          <i class="ri-user-search-line"></i>
                        </div>
                        <h6 class="text-muted mb-1">No Users Found</h6>
                        <p class="text-muted fs-13 mb-0">Try adjusting your search criteria</p>
                      </div>
                    </td>
                  </tr>
                  <tr v-for="(item, i) in displayData" :key="item.id">
                    <td class="align-middle">
                      <span class="text-muted fw-medium">{{ (currentPage - 1) * itemsPerPage + i + 1 }}</span>
                    </td>
                    <td class="align-middle">
                      <div class="d-flex align-items-center gap-2">
                        <span class="avatar avatar-sm avatar-rounded bg-primary-transparent overflow-hidden">
                          <img v-if="item.photo" :src="item.photo" :alt="item.name" />
                          <span v-else class="text-primary fw-semibold">{{ item.name.charAt(0).toUpperCase() }}</span>
                        </span>
                        <div>
                          <span class="fw-semibold d-block">{{ item.name }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="align-middle">
                      <div class="d-flex align-items-center gap-1">
                        <span class="text-muted fs-13">{{ item.username }}</span>
                      </div>
                    </td>
                    <td class="align-middle">
                      <span class="badge bg-light text-dark border fs-12">
                        <i class="ri-briefcase-line me-1"></i>{{ item.jabatan }}
                      </span>
                    </td>
                    <td class="align-middle">
                      <span :class="['badge rounded-pill px-3 py-2 fs-12', getStatusClass(item.role)]">
                        <i :class="item.role === 'Admin' ? 'ri-shield-star-line me-1' : 'ri-user-line me-1'"></i>
                        {{ item.role }}
                      </span>
                    </td>
                    <td class="text-center align-middle">
                      <div class="d-flex gap-1 justify-content-center">
                        <router-link :to="`/profile-user/${item.slug}`" class="btn btn-sm btn-icon btn-wave btn-info-light" title="Lihat Profil">
                          <i class="ri-eye-line"></i>
                        </router-link>
                        <button 
                          @click="openDeleteModal(item)" class="btn btn-sm btn-icon btn-wave btn-danger-light" title="Delete">
                          <i class="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-3 border-top gap-2">
              <span class="text-muted fs-13">
                Page {{ currentPage }} of {{ totalPages }}
              </span>
              <nav>
                <ul class="pagination pagination-sm mb-0">
                  <li class="page-item" :class="{ disabled: currentPage === 1 }">
                    <a class="page-link" href="#" @click.prevent="currentPage = 1">
                      <i class="ri-skip-back-mini-line"></i></a></li>
                  <li class="page-item" :class="{ disabled: currentPage === 1 }">
                    <a class="page-link" href="#" @click.prevent="currentPage--">
                      <i class="ri-arrow-left-s-line"></i></a></li>
                  <template v-for="p in totalPages" :key="p">
                    <li v-if="p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)" class="page-item" :class="{ active: p === currentPage }">
                      <a class="page-link" href="#" @click.prevent="currentPage = p">{{ p }}</a>
                    </li>
                    <li v-else-if="p === currentPage - 2 || p === currentPage + 2" class="page-item disabled"><span class="page-link">...</span></li>
                  </template>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                    <a class="page-link" href="#" @click.prevent="currentPage++"><i class="ri-arrow-right-s-line"></i></a>
                  </li>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                    <a class="page-link" href="#" @click.prevent="currentPage = totalPages"><i class="ri-skip-forward-mini-line"></i></a>
                  </li>
                </ul>
              </nav>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- Edit Modal -->
  <!-- <div v-if="showEditModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0, 0, 0, 0.5)">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Edit User</h5>
          <button type="button" class="btn-close" @click="showEditModal = false"></button>
        </div>
        <div class="modal-body" v-if="currentEditItem">
          <div class="mb-3">
            <label class="form-label">Nama</label>
            <input type="text" class="form-control" :value="currentEditItem.name" disabled />
          </div>
          <div class="mb-3">
            <label class="form-label">Email</label>
            <input type="text" class="form-control" :value="currentEditItem.username" disabled />
          </div>
          <div class="mb-3">
            <label class="form-label">Jabatan <span class="text-danger">*</span></label>
            <input v-model="formData.jabatan" type="text" class="form-control" placeholder="Masukkan jabatan" />
          </div>
          <div class="mb-3">
            <label class="form-label">Role <span class="text-danger">*</span></label>
            <select v-model="formData.role" class="form-select">
              <option value="Admin">Admin</option>
              <option value="User">User</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="showEditModal = false">Batal</button>
          <button type="button" class="btn btn-primary" @click="updateUser">
            <i class="ri-save-line me-1"></i>Simpan
          </button>
        </div>
      </div>
    </div>
  </div> -->

  <!-- Delete Modal -->
  <div v-if="showDeleteModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0, 0, 0, 0.5)">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Hapus User</h5>
          <button type="button" class="btn-close" @click="showDeleteModal = false"></button>
        </div>
        <div class="modal-body" v-if="currentDeleteItem">
          <p class="mb-0">
            Apakah Anda yakin ingin menghapus user
            <strong>{{ currentDeleteItem.name }}</strong
            >?
          </p>
          <p class="text-muted fs-13 mt-2 mb-0">
            Tindakan ini tidak dapat dibatalkan.
          </p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="showDeleteModal = false">Batal</button>
          <button type="button" class="btn btn-danger" @click="deleteUser">
            <i class="ri-delete-bin-line me-1"></i>Hapus
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gradient-header-card { border: none !important; box-shadow: 0 0.125rem 0.25rem rgba(0,0,0,0.075) !important; overflow: hidden !important; }
.gradient-header-card .card-header { border: none !important; border-radius: 0 !important; margin: 0 !important; }
.gradient-header-card .card-body { border: 1px solid var(--default-border); border-top: none !important; border-radius: 0 !important; }

.search-container { position: relative; }
.search-container input { padding-right: 35px !important; }
.search-container input::placeholder { color: #999; }
.search-icon { position: absolute; right: 35px; top: 50%; transform: translateY(-50%); pointer-events: none; z-index: 10; }
.clear-btn { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); padding: 0.25rem; background: transparent; border: none; }
.clear-btn:hover { color: #333; }

.sortable, .column-label { cursor: pointer; user-select: none; }
.sort-arrows { display: flex; flex-direction: column; line-height: 0.5; }
.sort-arrows i { font-size: 1rem; color: #d1d5db; cursor: pointer; transition: color 0.2s; }
.sort-arrows i:hover { color: #6b7280; }
.sort-arrows i.active { color: #3b82f6; }

.modal.show { display: block; }
.modal.show .modal-dialog { margin: 0 auto; max-width: 600px; }
.toast { min-width: 250px; }

.empty-state { padding: 2rem 1rem; }
.empty-state .empty-icon { width: 80px; height: 80px; margin: 0 auto; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(var(--primary-rgb),0.1), rgba(var(--secondary-rgb),0.1)); border-radius: 50%; }
.empty-state .empty-icon i { font-size: 2.5rem; color: var(--primary-color); opacity: 0.7; }

.btn-icon { width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; }

.email-link { color: var(--default-text-color); transition: all 0.2s ease; }
.email-link:hover { color: var(--primary-color); }
.email-link .email-icon-wrapper { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(var(--primary-rgb),0.1), rgba(var(--info-rgb),0.1)); border-radius: 6px; color: var(--primary-color); font-size: 14px; transition: all 0.2s ease; }
.email-link:hover .email-icon-wrapper { background: linear-gradient(135deg, rgba(var(--primary-rgb),0.2), rgba(var(--info-rgb),0.2)); transform: scale(1.05); }
.email-link .email-text { font-size: 13px; color: #6c757d; transition: color 0.2s ease; }
.email-link:hover .email-text { color: var(--primary-color); }

/* Dark Mode Specific Styles */
html[data-theme-mode="dark"] .card-header[style*="gradient"] .card-title,
html[data-theme-mode="dark"] .card-header[style*="gradient"] i,
html.dark .card-header[style*="gradient"] .card-title,
html.dark .card-header[style*="gradient"] i {
  color: rgb(0, 0, 0) !important;
}

html[data-theme-mode="dark"] .search-container input::placeholder,
html.dark .search-container input::placeholder {
  color: #000000 !important;
}

html[data-theme-mode="dark"] .table thead th,
html.dark .table thead th {
  color: #e2e8f0 !important;
}

html[data-theme-mode="dark"] .table tbody .text-dark,
html.dark .table tbody .text-dark {
  color: #cbd5e0 !important;
}

html[data-theme-mode="dark"] .table tbody .text-muted,
html.dark .table tbody .text-muted {
  color: #a0aec0 !important;
}

html[data-theme-mode="dark"] .badge.bg-light,
html.dark .badge.bg-light {
  background-color: #374151 !important;
  color: #d1d5db !important;
}
</style>
