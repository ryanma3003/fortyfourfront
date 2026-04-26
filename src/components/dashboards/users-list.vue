<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useAuthStore } from "../../stores/auth";
import { useProfileStore } from "../../stores/profile";
import { useUsersStore } from "../../stores/users";
import { useStakeholdersStore } from "../../stores/stakeholders";
import { usersService } from "../../services/users.service";
import { stakeholdersService } from "../../services/stakeholders.service";
import { roleService, type Role } from "../../services/role.service";
import { useListPage } from "../../composables/useListPage";
import { formatImageUrl } from "../../utils/media";
import type { User } from "../../types/user.types";
import type { Stakeholder } from "../../types/stakeholders.types";

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

    const usersStore = useUsersStore();
    const stakeholdersStore = useStakeholdersStore();
    const searchInput = ref<HTMLInputElement | null>(null);

    const {
      searchQuery, currentPage, itemsPerPage, sortField, sortOrder,
      showToast, toastMessage, toastType, showNotification,
      clearSearch, toggleSort, getAvatarColorClass, makePagination,
    } = useListPage("name");

    const loading = ref(false);
    const isInitialLoading = computed(() => !usersStore.initialized && loading.value);

    // Data from API (synchronised with store)
    const rolesData = ref<Role[]>([]);
    const usersData = computed(() => usersStore.users);
    const stakeholdersData = computed(() => stakeholdersStore.stakeholders);

    // CRUD state
    const showDeleteModal  = ref(false);
    const currentDeleteItem = ref<User | null>(null);

    const showEditRoleModal = ref(false);
    const currentEditItem = ref<User | null>(null);
    const selectedRole = ref('');

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
          display_name: (u as any).display_name || '',
          name: (u as any).name || (u as any).username || 'Unknown',
          email: (u as any).email || '',
          phone: (u as any).phone || '',
          location: (u as any).location || '',
          jabatan: (u as any).jabatan || (u as any).jabatan_name || '-',
          role: (u as any).role || (u as any).role_name || 'user',
          joined: (u as any).joined || (u as any).created_at || '',
          photo: formatImageUrl((u as any).photo || (u as any).foto_profile),
          status: typeof (u as any).status !== 'undefined' ? String((u as any).status) : 
                  typeof (u as any).is_active !== 'undefined' ? ((u as any).is_active ? 'aktif' : 'suspend') :
                  typeof (u as any).is_suspended !== 'undefined' ? ((u as any).is_suspended ? 'suspend' : 'aktif') :
                  typeof (u as any).aktif !== 'undefined' ? ((u as any).aktif == 1 ? 'aktif' : 'suspend') :
                  typeof (u as any).status_akun !== 'undefined' ? String((u as any).status_akun) : '',
          id_perusahaan: (u as any).id_perusahaan || undefined,
          id_jabatan: (u as any).id_jabatan || undefined,
          jabatan_name: (u as any).jabatan_name || undefined,
          role_name: (u as any).role_name || undefined,
          foto_profile: (u as any).foto_profile || undefined
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
      // If already has data, don't show loading overlay, just refresh in background
      if (!usersStore.initialized) loading.value = true;
      
      try {
        // Fetch data
        const [roles] = await Promise.all([
          roleService.getAll(),
          usersStore.initialize(),
          stakeholdersStore.initialize(),
          profileStore.switchUser()
        ]);
        
        rolesData.value = roles;
        
        // Always refresh in background to ensure latest data
        usersStore.refresh();
        stakeholdersStore.refresh();
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
            (i.display_name || '').toLowerCase().includes(q) ||
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

    // Helper function to get company name by ID
    const getCompanyName = (companyId: string | undefined): string => {
      if (!companyId) return '-';
      const company = stakeholdersData.value.find(s => s.id === companyId);
      return company?.nama_perusahaan || '-';
    };

    // EDIT ROLE
    const openEditRoleModal = (item: User) => {
      currentEditItem.value = item;
      selectedRole.value = item.role || 'user';
      showEditRoleModal.value = true;
    };

    const updateRole = async () => {
      if (!currentEditItem.value) return;
      loading.value = true;
      try {
        await usersService.update(currentEditItem.value.id, {
          role: selectedRole.value
        });
        
        // Update local data
        const index = usersData.value.findIndex((u: any) => u.id?.toString() === currentEditItem.value?.id);
        if (index !== -1) {
          (usersData.value[index] as any).role = selectedRole.value;
          (usersData.value[index] as any).role_name = selectedRole.value;
        }
        
        showEditRoleModal.value = false;
        showNotification("Role berhasil diupdate!", "success");
      } catch (error) {
        console.error('Failed to update role:', error);
        showNotification("Gagal mengupdate role!", "error");
      } finally {
        loading.value = false;
      }
    };

    // DELETE
    const openDeleteModal = (item: User) => {
      currentDeleteItem.value = item;
      showDeleteModal.value = true;
    };

    const deleteUser = async () => {
      if (!currentDeleteItem.value) return;

      loading.value = true;
      try {
        // Check if user has an associated company
        const userIdPerusahaan = currentDeleteItem.value.id_perusahaan;
        
        // Delete user
        await usersService.delete(currentDeleteItem.value.id);
        
        // If user has an associated company, delete it as well (cascade delete)
        if (userIdPerusahaan) {
          try {
            await stakeholdersService.delete(userIdPerusahaan);
          } catch (companyError) {
            console.warn('Failed to delete associated company:', companyError);
          }
        }
        
        // Remove from local data
        usersData.value = usersData.value.filter((u: any) => 
          u.id?.toString() !== currentDeleteItem.value?.id
        );
        
        showDeleteModal.value = false;
        const message = userIdPerusahaan ? "User dan Perusahaan berhasil dihapus!" : "User berhasil dihapus!";
        showNotification(message, "success");
      } catch (error) {
        console.error('Failed to delete user:', error);
        showNotification("Gagal menghapus user!", "error");
      } finally {
        loading.value = false;
      }
    };

    // User status badges
    const getUserStatusText = (status?: string) => {
      const s = String(status || '').toLowerCase();
      if (['suspend', 'suspended', 'nonaktif', 'inactive', '0', 'false'].includes(s)) return 'Nonaktif';
      return 'Aktif';
    };

    const countAdmin   = computed(() => items.value.filter(u => u.role?.toLowerCase() === 'admin').length);
    const countStaff   = computed(() => items.value.filter(u => u.role?.toLowerCase() === 'staff').length);
    const countUserPic = computed(() => items.value.filter(u => u.role?.toLowerCase() === 'user_pic' || u.role?.toLowerCase() === 'pic').length);
    const countUser    = computed(() => items.value.filter(u => u.role?.toLowerCase() === 'user').length);

    const getRoleBadgeClass = (role: string) => {
      const r = String(role || '').toLowerCase();
      if (r === 'admin') return 'badge-sektor-red';
      if (r === 'staff') return 'badge-sektor-green';
      if (r === 'user_pic') return 'badge-sektor-orange';
      return 'badge-sektor-sky';
    };

    onMounted(() => {
      loadUsers();
      setTimeout(() => {
        searchInput.value?.focus();
      }, 500);
    });

    return {
      authStore, items, loading, isInitialLoading, searchInput,
      searchQuery, sortField, sortOrder, currentPage, itemsPerPage,
      totalPages, displayData, paginationInfo, filteredData,
      showDeleteModal, currentDeleteItem,
      showEditRoleModal, currentEditItem, selectedRole,
      showToast, toastMessage, toastType,
      rolesData, countAdmin, countStaff, countUserPic, countUser,
      openDeleteModal, deleteUser, openEditRoleModal, updateRole,
      getUserStatusText, getRoleBadgeClass, clearSearch, toggleSort, getAvatarColorClass, getCompanyName,
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
      <!-- Premium UI like Stakeholders/LMS -->
      <div class="card custom-card gradient-header-card stakeholders-shell-card" style="overflow: visible !important;">
        <div class="stakeholder-header stakeholders-premium-header">
          <div class="stakeholders-header-main d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div class="stakeholders-hero-copy1 d-flex flex-column gap-1">
              <div>
                <div class="stakeholders-inline-breadcrumb">Dashboards <span>/</span> Users</div>
                <div class="card-title mb-0 fw-bold header-card-title stakeholders-hero-title">Daftar User</div>
                <div class="header-subtitle mt-1 stakeholders-hero-subtitle">Manajemen data pengguna sistem dan hak akses</div>
              </div>
              <div class="stakeholders-meta-stack">
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Total User</span>
                  <strong><i class="ri-group-line text-primary"></i> {{ items.length }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Admin</span>
                  <strong><i class="ri-shield-star-line text-danger"></i> {{ countAdmin }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Staff</span>
                  <strong><i class="ri-shield-user-line text-success"></i> {{ countStaff }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">User PIC</span>
                  <strong><i class="ri-user-settings-line text-warning"></i> {{ countUserPic }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">User</span>
                  <strong><i class="ri-user-line text-info"></i> {{ countUser }}</strong>
                </div>
              </div>
            </div>
            
            <div class="stakeholders-hero-tools">
              <div class="stakeholders-search position-relative">
                <i class="ri-search-line header-search-icon"></i>
                <input ref="searchInput" v-model="searchQuery" type="text" class="form-control form-control-sm header-search-input" 
                  placeholder="Cari nama, email, jabatan, atau role..." />
                <button v-if="searchQuery" @click="clearSearch" class="clear-btn" title="Clear search">
                  <i class="ri-close-circle-fill"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Rows Selector at Absolute Bottom Right -->
          <div class="header-rows-selector d-flex align-items-center gap-2">
            <span class="text-white opacity-75 fs-11 fw-bold text-uppercase">Rows</span>
            <select v-model="itemsPerPage" class="form-select form-select-sm header-rows-select">
              <option v-for="n in [5, 10, 15, 20, 25, 50]" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>
        </div>

        <div class="card-body p-4 stakeholders-premium-body">


          <div class="table-responsive stakeholder-table-wrap stakeholders-table-shell">
            <table class="table stakeholder-table mb-0">
              <thead class="stakeholder-thead">
                <tr>
                  <th class="th-no" style="width: 50px;">No</th>
                  <th class="sortable" @click="toggleSort('name')">
                    <div class="d-flex align-items-center gap-2">
                      <span>User</span>
                      <i :class="sortField === 'name' ? (sortOrder === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line') : 'ri-expand-up-down-line'" class="fs-14 opacity-50"></i>
                    </div>
                  </th>
                  <th>Email</th>
                  <th>Jabatan</th>
                  <th>Perusahaan</th>
                  <th class="text-center">Status</th>
                  <th class="sortable text-center" @click="toggleSort('role')">
                    <div class="d-flex align-items-center justify-content-center gap-2">
                      <span>Role</span>
                      <i :class="sortField === 'role' ? (sortOrder === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line') : 'ri-expand-up-down-line'" class="fs-14 opacity-50"></i>
                    </div>
                  </th>
                  <th class="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="isInitialLoading">
                  <td colspan="8" class="p-0">
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
                  <td colspan="8" class="text-center py-5">
                    <div class="empty-state">
                      <div class="empty-icon-ring mb-3"><div class="empty-icon-inner"><i class="ri-user-search-line"></i></div></div>
                      <h6 class="fw-semibold mb-1 empty-state-title">Tidak Ada User</h6>
                      <p class="text-muted fs-13 mb-3">Coba ubah kata kunci pencarian Anda</p>
                      <button v-if="searchQuery" @click="clearSearch" class="btn btn-sm btn-outline-primary rounded-pill px-4">
                        <i class="ri-refresh-line me-1"></i>Reset Pencarian
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-for="(item, i) in displayData" :key="item.id" class="stakeholder-row">
                  <td class="align-middle text-center">
                    <span class="row-number">{{ (currentPage - 1) * itemsPerPage + i + 1 }}</span>
                  </td>
                  <td class="align-middle">
                    <div class="stakeholder-company-cell">
                      <div class="company-avatar" :class="getAvatarColorClass(item.name.charAt(0))">
                        <img v-if="item.photo" :src="item.photo" :alt="item.name" class="company-avatar-img" />
                        <span v-else class="company-avatar-letter">{{ item.name.charAt(0).toUpperCase() }}</span>
                      </div>
                      <div class="company-name-wrap">
                        <span class="company-name d-block fw-bold">{{ item.display_name || item.name }}</span>
                        <span class="text-muted fs-12">@{{ item.username }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="align-middle">
                    <span class="text-muted fs-13">{{ item.email || item.username }}</span>
                  </td>
                  <td class="align-middle">
                    <span class="badge bg-theme-light text-theme-dark border fs-11 fw-medium px-2 py-1">
                      <i class="ri-briefcase-line me-1 text-primary"></i>{{ item.jabatan }}
                    </span>
                  </td>
                  <td class="align-middle">
                    <span class="text-muted fs-13">{{ getCompanyName(item.id_perusahaan) }}</span>
                  </td>
                  <td class="align-middle text-center">
                    <span class="badge-sektor" :class="getUserStatusText(item.status) === 'Aktif' ? 'badge-sektor-teal' : 'badge-sektor-amber'">
                      <i :class="getUserStatusText(item.status) === 'Aktif' ? 'ri-checkbox-circle-line me-1' : 'ri-close-circle-line me-1'"></i>
                      {{ getUserStatusText(item.status) }}
                    </span>
                  </td>
                  <td class="align-middle text-center">
                    <span class="badge-sektor" :class="getRoleBadgeClass(item.role)">
                      <i :class="item.role === 'admin' ? 'ri-shield-star-line me-1' : (item.role === 'staff' ? 'ri-shield-user-line me-1' : 'ri-user-line me-1')"></i>
                      {{ item.role }}
                    </span>
                  </td>
                  <td class="align-middle text-center">
                    <div class="d-flex gap-1 justify-content-center">
                      <router-link :to="`/users-profile/${item.slug}`" class="btn btn-sm btn-icon btn-wave btn-info-light stakeholders-action-btn" title="Lihat Profil">
                        <i class="ri-eye-line"></i>
                      </router-link>
                      <button v-if="authStore.currentUser?.id !== item.id"
                        @click="openEditRoleModal(item)"
                        class="btn btn-sm btn-icon btn-wave btn-success-light stakeholders-action-btn"
                        title="Edit Role">
                        <i class="ri-pencil-line"></i>
                      </button>
                      <button v-if="authStore.currentUser?.id !== item.id"
                        @click="openDeleteModal(item)"
                        class="btn btn-sm btn-icon btn-wave btn-danger-light stakeholders-action-btn"
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
          <div class="pagination-container stakeholders-pagination mt-4">
            <div class="stakeholders-pagination-copy">
              Showing {{ displayData.length ? (currentPage - 1) * itemsPerPage + 1 : 0 }}-{{ Math.min(currentPage * itemsPerPage, filteredData.length) }} of {{ filteredData.length }} users
            </div>
            <div class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
              <span class="stakeholders-page-pill">Page {{ currentPage }} of {{ totalPages || 1 }}</span>
              <nav v-if="totalPages > 1">
                <ul class="pagination pagination-sm mb-0 gap-1">
                  <li class="page-item" :class="{ disabled: currentPage === 1 }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = 1" title="First">
                      <i class="ri-skip-back-mini-line"></i>
                    </a>
                  </li>
                  <li class="page-item d-none d-sm-block" :class="{ disabled: currentPage === 1 }">
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
                  <li class="page-item d-none d-sm-block" :class="{ disabled: currentPage === totalPages }">
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
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Delete Modal -->
  <Teleport to="body">
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
      <div class="modal-dialog modal-dialog-centered modal-sm custom-modal">
        <div class="modal-content border-0 bg-transparent">
          <div class="kse-modal-box kse-modal-sm w-100">
            <div class="kse-modal-header kse-modal-header-danger">
              <div class="d-flex align-items-center gap-3">
                <div class="kse-modal-icon-wrap"><i class="ri-delete-bin-line"></i></div>
                <div>
                  <div class="kse-modal-title">Hapus User</div>
                </div>
              </div>
            </div>
            <div class="kse-modal-body text-center" v-if="currentDeleteItem">
              <p class="mb-0 fs-14">Apakah Anda yakin ingin menghapus user <strong>{{ currentDeleteItem.name }}</strong>?</p>
              <p class="text-muted fs-12 mt-2">Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div class="kse-modal-footer">
              <button class="btn btn-light kse-modal-cancel" @click="showDeleteModal = false">Batal</button>
              <button class="btn btn-danger" @click="deleteUser" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>Hapus
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Edit Role Modal -->
  <Teleport to="body">
    <div v-if="showEditRoleModal" class="modal-overlay" @click.self="showEditRoleModal = false">
      <div class="modal-dialog modal-dialog-centered modal-sm custom-modal">
        <div class="modal-content border-0 bg-transparent">
          <div class="kse-modal-box kse-modal-sm w-100">
            <div class="kse-modal-header pb-3 mb-2" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <div class="d-flex align-items-center gap-3">
                <div class="kse-modal-icon-wrap" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">
                  <i class="ri-shield-user-line"></i>
                </div>
                <div>
                  <div class="kse-modal-title">Ubah Role User</div>
                </div>
              </div>
            </div>
            <div class="kse-modal-body text-start" v-if="currentEditItem">
              <div class="mb-3">
                <label class="form-label fs-13 text-muted">User</label>
                <div class="fw-semibold">{{ currentEditItem.name }}</div>
              </div>
              <div class="mb-3">
                <label class="form-label fs-13 text-muted">Role Akses</label>
                <select v-model="selectedRole" class="form-select">
                  <option v-for="role in rolesData" :key="role.id" :value="role.name">{{ role.name }}</option>
                  <option v-if="!rolesData.length" value="admin">admin</option>
                  <option v-if="!rolesData.length" value="staff">staff</option>
                  <option v-if="!rolesData.length" value="user_pic">user_pic</option>
                  <option v-if="!rolesData.length" value="user">user</option>
                </select>
              </div>
            </div>
            <div class="kse-modal-footer">
              <button class="btn btn-light kse-modal-cancel" @click="showEditRoleModal = false">Batal</button>
              <button class="btn btn-primary" @click="updateRole" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>Simpan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-modal {
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

/* Skeleton Loading */
.skel {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: skeletonLoad 1.5s infinite;
  border-radius: 4px;
}
.skel-circle { border-radius: 50%; }
@keyframes skeletonLoad {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-row {
  opacity: 0.7;
}

/* Meta Card Styles */
.stakeholders-meta-stack {
  display: flex !important;
  gap: 10px !important;
  flex-wrap: wrap !important;
  justify-content: flex-start !important;
  width: 100% !important;
}

.stakeholders-meta-card {
  flex: 1 1 auto !important;
  min-width: 100px !important;
  max-width: 130px !important;
  width: auto !important;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 8px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  transition: all 0.3s ease;
}

.stakeholders-meta-card:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
}

.stakeholders-meta-label {
  font-size: 9px;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 4px;
  white-space: nowrap;
}

.stakeholders-meta-card strong {
  font-size: 18px;
  color: white;
  display: flex;
  align-items: center;
  gap: 6px;
}

.stakeholders-meta-card strong i {
  font-size: 16px;
}

/* Search alignment tweaks */
.stakeholders-header-main {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  align-items: center !important;
  justify-content: space-between !important;
  width: 100% !important;
  gap: 20px !important;
}

.stakeholders-hero-copy1 {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  width: auto !important;
}

.stakeholders-hero-tools {
  flex: 0 0 350px !important;
  width: 350px !important;
  min-width: 350px !important;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.stakeholders-search {
  position: relative;
  width: 100% !important;
  max-width: 100% !important;
  margin-left: auto;
}

/* Search Bar Refinement - Match csirt-list style */
.header-search-input {
  border-radius: 50px !important;
  background-color: #ffffff !important;
  color: #1e293b !important;
  border: 1.5px solid #e2e8f0 !important;
  padding-left: 2.75rem !important;
  padding-right: 2.75rem !important;
  height: 44px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
  font-weight: 500 !important;
  transition: all 0.2s ease !important;
}

.header-search-input:focus {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1), 0 4px 12px rgba(0, 0, 0, 0.08) !important;
}

.header-search-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  font-size: 18px;
  pointer-events: none;
  z-index: 5;
}

.clear-btn {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 0;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: color 0.2s;
  z-index: 6;
}

.clear-btn:hover {
  color: #475569;
}

@media (max-width: 1250px) {
  .stakeholders-header-main {
    flex-wrap: wrap !important;
    gap: 20px !important;
  }
  .stakeholders-hero-tools {
    flex: 1 1 100% !important;
    width: 100% !important;
    min-width: 100% !important;
    justify-content: stretch !important;
  }
  .stakeholders-search {
    max-width: 100% !important;
  }
  .stakeholders-meta-stack {
    flex-wrap: wrap !important;
  }
  .stakeholders-meta-card {
    flex: 1 1 calc(33.333% - 12px) !important;
    max-width: calc(33.333% - 8px) !important;
  }
}
/* Header Rows Selector */
.header-rows-selector {
  position: absolute;
  right: 1.25rem;
  bottom: 1.15rem;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
}

@media (max-width: 1250px) {
  .header-rows-selector {
    position: static;
    margin-top: 15px;
    margin-left: auto;
    width: fit-content;
    padding-right: 1.25rem;
    padding-bottom: 1rem;
  }
}

.header-rows-selector:hover .header-rows-select {
  background-color: rgba(255, 255, 255, 0.15) !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
}

.header-rows-select {
  width: 72px !important;
  background-color: rgba(255, 255, 255, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  color: white !important;
  border-radius: 8px !important;
  height: 32px !important;
  font-size: 12px !important;
  padding: 0 24px 0 10px !important;
  cursor: pointer;
  transition: all 0.2s ease;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M12 16L6 10H18L12 16Z'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  background-size: 14px;
}


.header-rows-select:focus {
  background-color: rgba(255, 255, 255, 0.15) !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
  box-shadow: none !important;
}

.header-rows-select option {
  background-color: #1e293b;
  color: white;
}

@media (max-width: 768px) {
  .stakeholders-premium-body {
    padding: 1rem !important;
  }

  .stakeholder-table-wrap {
    margin: 0 -1rem;
    width: calc(100% + 2rem);
    border-radius: 0;
  }

  .stakeholders-pagination {
    flex-direction: column;
    gap: 16px;
    align-items: center !important;
    text-align: center;
  }

  .stakeholders-pagination .d-flex {
    justify-content: center !important;
    width: 100%;
  }
}

@media (max-width: 576px) {
  .stakeholders-hero-title {
    font-size: 1.25rem !important;
  }

  .stakeholders-hero-subtitle {
    font-size: 0.75rem !important;
  }

  .stakeholders-meta-stack {
    flex-wrap: wrap !important;
  }

  .stakeholders-meta-card {
    flex: 1 1 calc(50% - 12px) !important;
    max-width: calc(50% - 6px) !important;
  }

  .stakeholders-meta-card strong {
    font-size: 16px;
  }

  .header-search-input {
    height: 40px !important;
    font-size: 13px !important;
  }

  .header-rows-selector {
    margin-top: 15px;
    padding: 6px 12px;
    justify-content: center !important;
  }

  .stakeholders-premium-header {
    padding-bottom: 1.25rem !important;
  }

  /* Hide less important columns on mobile */
  .th-no, .stakeholder-row td:first-child,
  .stakeholder-thead th:nth-child(3), .stakeholder-row td:nth-child(3),
  .stakeholder-thead th:nth-child(5), .stakeholder-row td:nth-child(5) {
    display: none !important;
  }
  
  /* Adjust User column on mobile */
  .stakeholder-company-cell {
    gap: 8px;
  }
  .company-avatar {
    width: 32px !important;
    height: 32px !important;
    min-width: 32px !important;
  }
  .company-name {
    font-size: 13px !important;
  }
  
  /* Make sure table scrolls smoothly */
  .table-responsive {
    -webkit-overflow-scrolling: touch;
  }
}

/* Animations for toast */
.toast-slide-enter-active, .toast-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.toast-slide-leave-to {
  transform: translateY(-20px);
  opacity: 0;
}

.text-theme-dark {
  color: #1e293b !important; /* Elegant black/dark navy */
}

/* --- DARK MODE SUPPORT --- */
[data-theme-mode='dark'] .header-search-input {
  background-color: rgba(255, 255, 255, 0.1) !important;
  color: #ffffff !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
}

[data-theme-mode='dark'] .header-search-input:focus {
  background-color: rgba(255, 255, 255, 0.08) !important;
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2), 0 4px 12px rgba(0, 0, 0, 0.2) !important;
}

[data-theme-mode='dark'] .header-search-input::placeholder {
  color: rgba(255, 255, 255, 0.7) !important;
}

[data-theme-mode='dark'] .header-search-icon {
  color: rgba(255, 255, 255, 0.9) !important;
}

[data-theme-mode='dark'] .bg-theme-light {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

[data-theme-mode='dark'] .text-theme-dark {
  color: #ffffff !important;
}

[data-theme-mode='dark'] .stakeholder-row:hover {
  background-color: rgba(255, 255, 255, 0.02) !important;
}

[data-theme-mode='dark'] .company-name {
  color: #f1f5f9 !important;
}

[data-theme-mode='dark'] .row-number {
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.05);
}

[data-theme-mode='dark'] .empty-icon-inner {
  background: rgba(255, 255, 255, 0.05);
  color: #3b82f6;
}

[data-theme-mode='dark'] .empty-state-title {
  color: #f1f5f9;
}

[data-theme-mode='dark'] .pagination .page-link {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
}

[data-theme-mode='dark'] .pagination .page-item.active .page-link {
  background-color: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

[data-theme-mode='dark'] .pagination .page-item.disabled .page-link {
  background-color: transparent;
  color: rgba(255, 255, 255, 0.2);
}

[data-theme-mode='dark'] .stakeholders-page-pill {
  background: rgba(255, 255, 255, 0.05);
  color: #94a3b8;
}

[data-theme-mode='dark'] .header-rows-selector span {
  color: #ffffff !important;
  opacity: 1 !important;
}

[data-theme-mode='dark'] .stakeholders-inline-breadcrumb {
  color: rgba(255, 255, 255, 0.9) !important;
}

[data-theme-mode='dark'] .stakeholders-inline-breadcrumb span {
  color: rgba(255, 255, 255, 0.5) !important;
}



[data-theme-mode='dark'] .stakeholder-thead,
[data-theme-mode='dark'] table.stakeholder-table thead.stakeholder-thead {
  background-color: #1e293b !important;
}

[data-theme-mode='dark'] .stakeholder-thead th,
[data-theme-mode='dark'] table.stakeholder-table thead.stakeholder-thead th {
  background-color: #1e293b !important;
  color: #f1f5f9 !important;
  border-bottom: 1.5px solid rgba(255, 255, 255, 0.1) !important;
}

[data-theme-mode='dark'] .stakeholder-row td {
  border-bottom-color: rgba(255, 255, 255, 0.05) !important;
}

[data-theme-mode='dark'] .badge-sektor {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

[data-theme-mode='dark'] .badge-sektor-teal { color: #2dd4bf !important; background: rgba(45, 212, 191, 0.1) !important; }
[data-theme-mode='dark'] .badge-sektor-amber { color: #fbbf24 !important; background: rgba(251, 191, 36, 0.1) !important; }
[data-theme-mode='dark'] .badge-sektor-red { color: #f87171 !important; background: rgba(248, 113, 113, 0.1) !important; }
[data-theme-mode='dark'] .badge-sektor-green { color: #4ade80 !important; background: rgba(74, 222, 128, 0.1) !important; }
[data-theme-mode='dark'] .badge-sektor-orange { color: #fb923c !important; background: rgba(251, 146, 60, 0.1) !important; }
[data-theme-mode='dark'] .badge-sektor-sky { color: #38bdf8 !important; background: rgba(56, 189, 248, 0.1) !important; }

</style>

<style>
/* Dark Mode fixes for Teleported Modals */
html[data-theme-mode="dark"] .kse-modal-box {
  background: #1e293b !important;
  border: 1px solid rgba(255,255,255,0.1);
}
html[data-theme-mode="dark"] .kse-modal-body,
html[data-theme-mode="dark"] .fw-semibold {
  color: #e2e8f0 !important;
}
html[data-theme-mode="dark"] .text-muted {
  color: #94a3b8 !important;
}
html[data-theme-mode="dark"] .kse-modal-cancel {
  background: #334155 !important;
  color: #e2e8f0 !important;
  border-color: #475569 !important;
}
html[data-theme-mode="dark"] .kse-modal-cancel:hover {
  background: #475569 !important;
}
html[data-theme-mode="dark"] .form-select {
  background-color: #0f172a !important;
  border-color: rgba(255,255,255,0.1) !important;
  color: #e2e8f0 !important;
}
html[data-theme-mode="dark"] .form-select:focus {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 0.25rem rgba(59, 130, 246, 0.25) !important;
}
html[data-theme-mode="dark"] .kse-modal-header {
  border-bottom: 1px solid rgba(255,255,255,0.1) !important;
}
</style>



