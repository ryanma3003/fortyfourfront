<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useAuthStore } from "../../stores/auth";
import { useProfileStore } from "../../stores/profile";
import { usersService } from "../../services/users.service";
import { roleService, type Role } from "../../services/role.service";
import { useListPage } from "../../composables/useListPage";


interface User {
  id: string;
  slug: string;
  username: string;
  name: string;
  jabatan: string;
  role: string;
  photo?: string;
  joined?: string;
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

    const {
      searchQuery, currentPage, itemsPerPage, sortField, sortOrder,
      showToast, toastMessage, toastType, showNotification,
      clearSearch, toggleSort, getAvatarColorClass, makePagination,
    } = useListPage("name");

    const loading = ref(false);

    // Data from API
    const usersData = ref<User[]>([]);
    const rolesData = ref<Role[]>([]);

    // CRUD state
    const showEditModal    = ref(false);
    const showDeleteModal  = ref(false);
    const currentEditItem  = ref<User | null>(null);
    const currentDeleteItem = ref<User | null>(null);

    // Form state for editing role
    const formData = ref<{ role: string }>({ role: "" });

    // Computed items from API data
    const items = computed(() => {
      // Get current logged-in user info
      const currentUser = authStore.currentUser;
      
      // Map users from API
      return usersData.value.map(u => {
        const userObj: User = {
          id: (u as any).id?.toString() || '',
          slug: (u as any).slug || (u as any).username || (u as any).id?.toString() || '',
          username: (u as any).username || (u as any).email || '',
          name: (u as any).name || (u as any).username || 'Unknown',
          jabatan: (u as any).jabatan || '',
          role: (u as any).role || (u as any).role_name || 'user',
          photo: (u as any).photo,
          joined: (u as any).joined || (u as any).created_at
        };

        // If this is the current logged-in user, use profile store data
        if (currentUser && userObj.id === currentUser.id) {
          return {
            ...userObj,
            jabatan: profileStore.jabatan || userObj.jabatan,
            name: profileStore.name || userObj.name,
            photo: profileStore.fotoProfileUrl || userObj.photo,
          };
        }
        return userObj;
      });
    });

    const loadUsers = async () => {
      loading.value = true;
      try {
        // Fetch users and roles from API in parallel
        const [users, roles] = await Promise.all([
          usersService.getAll(),
          roleService.getAll()
        ]);
        
        usersData.value = users as any;
        rolesData.value = roles;
        
        // Load profile data
        await profileStore.switchUser();
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        loading.value = false;
      }
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
        const valA = (a[sortField.value as keyof User] || "").toString();
        const valB = (b[sortField.value as keyof User] || "").toString();
        return valA.localeCompare(valB) * mod;
      });
    });

    const { totalPages, displayData, paginationInfo } = makePagination(filteredData);

    // EDIT ROLE
    const openEditModal = (item: User) => {
      currentEditItem.value = item;
      formData.value = { role: item.role };
      showEditModal.value = true;
    };

    const updateUser = async () => {
      if (!currentEditItem.value) return;

      try {
        // Find the role ID from the selected role name
        const selectedRoleName = formData.value.role;
        const roleObj = rolesData.value.find(r => 
          r.name.toLowerCase() === selectedRoleName.toLowerCase()
        );
        
        if (roleObj) {
          // Use role service to assign role
          await roleService.assignToUser(currentEditItem.value.id, roleObj.id);
        } else {
          // Fallback: update directly via users service
          await usersService.update(currentEditItem.value.id, {
            role: selectedRoleName
          });
        }
        
        // Update local data
        const index = usersData.value.findIndex((u: any) => u.id?.toString() === currentEditItem.value?.id);
        if (index !== -1) {
          (usersData.value[index] as any).role = selectedRoleName;
        }
        
        showEditModal.value = false;
        showNotification("Role berhasil diperbarui!", "success");
      } catch (error) {
        console.error('Failed to update role:', error);
        showNotification("Gagal memperbarui role!", "error");
      }
    };

    // DELETE
    const openDeleteModal = (item: User) => {
      currentDeleteItem.value = item;
      showDeleteModal.value = true;
    };

    const deleteUser = async () => {
      if (!currentDeleteItem.value) return;

      try {
        await usersService.delete(currentDeleteItem.value.id);
        
        // Remove from local data
        usersData.value = usersData.value.filter((u: any) => 
          u.id?.toString() !== currentDeleteItem.value?.id
        );
        
        showDeleteModal.value = false;
        showNotification("User berhasil dihapus!", "success");
      } catch (error) {
        console.error('Failed to delete user:', error);
        showNotification("Gagal menghapus user!", "error");
      }
    };

    // Get status badge class
    const getStatusClass = (role: string) =>
      role === "admin" ? "bg-danger-transparent" : "bg-info-transparent";

    const countAdmins  = computed(() => items.value.filter(u => u.role === 'admin').length);
    const countRegular = computed(() => items.value.filter(u => u.role !== 'admin').length);

    onMounted(loadUsers);

    return {
      authStore, items, loading,
      searchQuery, sortField, sortOrder, currentPage, itemsPerPage,
      totalPages, displayData, paginationInfo,
      showEditModal, showDeleteModal, currentEditItem, currentDeleteItem,
      formData, showToast, toastMessage, toastType,
      rolesData, countAdmins, countRegular,
      openEditModal, updateUser, openDeleteModal, deleteUser,
      getStatusClass, clearSearch, toggleSort, getAvatarColorClass,
    };
  },
};
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Toast Notification -->
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
        <div class="card-header d-flex align-items-center justify-content-between gap-3 users-header">
          <div class="d-flex align-items-center gap-3">
            <div class="header-icon-box">
              <i class="ri-group-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">Daftar User</div>
              <div class="header-subtitle mt-1">Manajemen data pengguna sistem</div>
            </div>
          </div>
          <div class="search-container position-relative">
            <i class="ri-search-line card-search-icon"></i>
            <input v-model="searchQuery" type="text" class="form-control form-control-sm header-search-input"
              placeholder="Cari nama, email, jabatan, atau role..." />
            <button v-if="searchQuery" @click="clearSearch" class="clear-btn">
              <i class="ri-close-circle-fill"></i>
            </button>
          </div>
        </div>

        <div class="card-body p-4">
          <div v-if="loading" class="skeleton-loading p-4">
            <div class="skeleton-row" v-for="n in 5" :key="n">
              <div class="skel skel-no"></div>
              <div class="skel skel-avatar"></div>
              <div class="skel skel-name"></div>
              <div class="skel skel-badge"></div>
              <div class="skel skel-email"></div>
              <div class="skel skel-actions"></div>
            </div>
          </div>

          <template v-else>
            <!-- Stats Strip -->
            <div class="stats-strip mb-4">
              <div class="stat-card">
                <div class="stat-icon stat-icon-blue"><i class="ri-group-line"></i></div>
                <div>
                  <div class="stat-value">{{ items.length }}</div>
                  <div class="stat-label">Total User</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-violet"><i class="ri-shield-star-line"></i></div>
                <div>
                  <div class="stat-value">{{ countAdmins }}</div>
                  <div class="stat-label">Admin</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-teal"><i class="ri-user-line"></i></div>
                <div>
                  <div class="stat-value">{{ countRegular }}</div>
                  <div class="stat-label">Regular User</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-amber"><i class="ri-shield-keyhole-line"></i></div>
                <div>
                  <div class="stat-value">{{ rolesData.length }}</div>
                  <div class="stat-label">Total Role</div>
                </div>
              </div>
            </div>

            <!-- Controls Bar -->
            <div class="controls-bar d-flex flex-wrap justify-content-between align-items-center mb-4 pb-3 border-bottom gap-3">
              <div class="d-flex align-items-center gap-2">
                <span class="text-muted fs-13">Tampilkan</span>
                <select v-model="itemsPerPage" class="form-select form-select-sm entries-select">
                  <option v-for="n in [5, 10, 15, 20, 25, 50]" :key="n" :value="n">{{ n }}</option>
                </select>
                <span class="text-muted fs-13">per halaman</span>
              </div>
            </div>

            <!-- Table -->
            <div class="table-responsive users-table-wrap">
              <table class="table users-table text-nowrap mb-0">
                <thead class="users-thead">
                  <tr>
                    <th class="th-no">No</th>
                    <th class="sortable fw-semibold th-name">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-user-line text-primary"></i>
                        <span class="column-label" @click="toggleSort('name')">Nama</span>
                        <div class="sort-arrows">
                          <i class="ri-arrow-up-s-line" :class="{ active: sortField === 'name' && sortOrder === 'asc' }" @click.stop="sortField = 'name'; sortOrder = 'asc';"></i>
                          <i class="ri-arrow-down-s-line" :class="{ active: sortField === 'name' && sortOrder === 'desc' }" @click.stop="sortField = 'name'; sortOrder = 'desc';"></i>
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
                        <span class="column-label" @click="toggleSort('role')">Role</span>
                        <div class="sort-arrows">
                          <i class="ri-arrow-up-s-line" :class="{ active: sortField === 'role' && sortOrder === 'asc' }" @click.stop="sortField = 'role'; sortOrder = 'asc';"></i>
                          <i class="ri-arrow-down-s-line" :class="{ active: sortField === 'role' && sortOrder === 'desc' }" @click.stop="sortField = 'role'; sortOrder = 'desc';"></i>
                        </div>
                      </div>
                    </th>
                    <th class="text-center fw-semibold th-actions-sm">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!displayData.length">
                    <td colspan="6" class="text-center py-5">
                      <div class="empty-state">
                        <div class="empty-icon-ring mb-3">
                          <div class="empty-icon-inner">
                            <i class="ri-user-search-line"></i>
                          </div>
                        </div>
                        <h6 class="fw-semibold mb-1 empty-state-title">Tidak Ada User</h6>
                        <p class="text-muted fs-13 mb-3">Coba ubah kata kunci pencarian Anda</p>
                        <button v-if="searchQuery" @click="clearSearch" class="btn btn-sm btn-outline-primary rounded-pill px-4">
                          <i class="ri-refresh-line me-1"></i>Reset Pencarian
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-for="(item, i) in displayData" :key="item.id" class="users-row">
                    <td class="align-middle text-center">
                      <span class="row-number">{{ (currentPage - 1) * itemsPerPage + i + 1 }}</span>
                    </td>
                    <td class="align-middle">
                      <div class="d-flex align-items-center gap-3">
                        <div class="company-avatar" :class="getAvatarColorClass(item.name.charAt(0))">
                          <img v-if="item.photo" :src="item.photo" :alt="item.name" class="company-avatar-img" />
                          <span v-else class="company-avatar-letter">{{ item.name.charAt(0).toUpperCase() }}</span>
                        </div>
                        <div>
                          <span class="company-name d-block">{{ item.name }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="align-middle">
                      <span class="text-muted fs-13">{{ item.username }}</span>
                    </td>
                    <td class="align-middle">
                      <span class="badge bg-light text-dark border fs-12">
                        <i class="ri-briefcase-line me-1"></i>{{ item.jabatan }}
                      </span>
                    </td>
                    <td class="align-middle">
                      <span :class="['badge rounded-pill px-3 py-2 fs-12', getStatusClass(item.role)]">
                        <i :class="item.role === 'admin' ? 'ri-shield-star-line me-1' : 'ri-user-line me-1'"></i>
                        {{ item.role }}
                      </span>
                    </td>
                    <td class="text-center align-middle">
                      <div class="d-flex gap-1 justify-content-center">
                        <router-link :to="`/users/${item.slug}`" class="btn btn-sm btn-icon btn-wave btn-info-light" title="Lihat Profil">
                          <i class="ri-eye-line"></i>
                        </router-link>
                        <button v-if="authStore.currentUser?.id !== item.id"
                          @click="openEditModal(item)"
                          class="btn btn-sm btn-icon btn-wave btn-warning-light"
                          title="Edit Role">
                          <i class="ri-pencil-line"></i>
                        </button>
                        <button v-if="authStore.currentUser?.id !== item.id"
                          @click="openDeleteModal(item)"
                          class="btn btn-sm btn-icon btn-wave btn-danger-light"
                          title="Hapus">
                          <i class="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="d-flex flex-wrap justify-content-between align-items-center mt-4 gap-3">
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-light text-muted px-3 py-2">
                  <i class="ri-file-list-3-line me-1"></i>
                  {{ paginationInfo }}
                </span>
              </div>
              <nav>
                <ul class="pagination pagination-sm mb-0 gap-1">
                  <li class="page-item" :class="{ disabled: currentPage === 1 }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = 1" title="First">
                      <i class="ri-skip-back-mini-line"></i>
                    </a>
                  </li>
                  <li class="page-item" :class="{ disabled: currentPage === 1 }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage--" title="Previous">
                      <i class="ri-arrow-left-s-line"></i>
                    </a>
                  </li>
                  <template v-for="p in totalPages" :key="p">
                    <li v-if="p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)" class="page-item" :class="{ active: p === currentPage }">
                      <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = p">{{ p }}</a>
                    </li>
                    <li v-else-if="p === currentPage - 2 || p === currentPage + 2" class="page-item disabled">
                      <span class="page-link border-0 bg-transparent">...</span>
                    </li>
                  </template>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage++" title="Next">
                      <i class="ri-arrow-right-s-line"></i>
                    </a>
                  </li>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = totalPages" title="Last">
                      <i class="ri-skip-forward-mini-line"></i>
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

  <!-- Edit Role Modal -->
  <Teleport to="body">
  <div v-if="showEditModal" class="modal-overlay" tabindex="-1" @click="showEditModal = false">
    <div class="modal-dialog modal-dialog-md" @click.stop>
      <div class="modal-content rounded-4 border-0 shadow-lg">
        <div class="modal-header border-0 pb-0">
          <h5 class="modal-title fw-bold"><i class="ri-shield-user-line me-2 text-warning"></i>Edit Role</h5>
          <button type="button" class="btn-close" @click="showEditModal = false"></button>
        </div>
        <div class="modal-body pt-2" v-if="currentEditItem">
          <div class="d-flex align-items-center gap-3 mb-4 p-3 bg-light rounded-3">
            <span class="company-avatar modal-avatar-md">
              <img v-if="currentEditItem.photo" :src="currentEditItem.photo" :alt="currentEditItem.name" />
              <span v-else>{{ currentEditItem.name.charAt(0).toUpperCase() }}</span>
            </span>
            <div>
              <h6 class="mb-0 fw-semibold">{{ currentEditItem.name }}</h6>
              <span class="text-muted fs-13">{{ currentEditItem.username }}</span>
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label fw-semibold">Role <span class="text-danger">*</span></label>
            <select v-model="formData.role" class="form-select">
              <option v-for="role in rolesData" :key="role.id" :value="role.name">{{ role.name }}</option>
              <option v-if="!rolesData.length" value="admin">Admin</option>
              <option v-if="!rolesData.length" value="user">User</option>
            </select>
          </div>
        </div>
        <div class="modal-footer border-0 pt-0">
          <button type="button" class="btn btn-light" @click="showEditModal = false">Batal</button>
          <button type="button" class="btn btn-warning" @click="updateUser">
            <i class="ri-save-line me-1"></i>Simpan
          </button>
        </div>
      </div>
    </div>
  </div>
  </Teleport>

  <!-- Delete Modal -->
  <Teleport to="body">
  <div v-if="showDeleteModal" class="modal-overlay" tabindex="-1">
    <div class="modal-dialog modal-dialog-sm">
      <div class="modal-content rounded-4 border-0 shadow-lg">
        <div class="modal-header border-0 pb-0">
          <h5 class="modal-title fw-bold"><i class="ri-delete-bin-line me-2 text-danger"></i>Hapus User</h5>
          <button type="button" class="btn-close" @click="showDeleteModal = false"></button>
        </div>
        <div class="modal-body pt-2" v-if="currentDeleteItem">
          <p class="mb-1">Apakah Anda yakin ingin menghapus user <strong>{{ currentDeleteItem.name }}</strong>?</p>
          <p class="text-muted fs-13 mb-0">Tindakan ini tidak dapat dibatalkan.</p>
        </div>
        <div class="modal-footer border-0 pt-0">
          <button type="button" class="btn btn-light" @click="showDeleteModal = false">Batal</button>
          <button type="button" class="btn btn-danger" @click="deleteUser">
            <i class="ri-delete-bin-line me-1"></i>Hapus
          </button>
        </div>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<style src="../../assets/css/style2.css"></style>

