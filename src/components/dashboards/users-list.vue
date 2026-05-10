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
    const searchMode = ref<"user" | "company">("user");

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
    const selectedStatus = ref('Aktif');

    const getUserStatusText = (status?: string) => {
      const s = String(status || '').toLowerCase().trim();
      if (['suspend', 'suspended', 'nonaktif', 'inactive', '0', 'false'].includes(s)) return 'Nonaktif';
      return 'Aktif';
    };

    const getRoleBadgeClass = (role: string) => {
      const r = String(role || '').toLowerCase();
      if (r === 'admin') return 'badge-sektor-red';
      if (r === 'staff') return 'badge-sektor-green';
      if (r === 'user_pic') return 'badge-sektor-orange';
      return 'badge-sektor-sky';
    };

    const getRoleIcon = (role: string) => {
      const r = String(role || '').toLowerCase();
      if (r === 'admin') return 'ri-shield-star-line';
      if (r === 'staff') return 'ri-shield-user-line';
      return 'ri-user-line';
    };

    const companyNameMap = computed(() => {
      const map = new Map<string, string>();
      stakeholdersData.value.forEach((stakeholder) => {
        if (stakeholder.id) map.set(String(stakeholder.id), stakeholder.nama_perusahaan || '-');
      });
      return map;
    });

    const makeUserSearchText = (user: User) => [
      user.name,
      user.display_name,
      user.username,
      user.email,
      user.jabatan,
      user.role,
    ].filter(Boolean).join(' ').toLowerCase();

    type UserListItem = User & {
      companyName: string;
      displayName: string;
      statusText: string;
      statusBadgeClass: string;
      roleBadgeClass: string;
      roleIcon: string;
      avatarLetter: string;
      avatarClass: string;
      userSearchText: string;
      companySearchText: string;
    };

    // Computed items from API data. Keep row-ready fields here so the table
    // doesn't repeatedly normalize status, role, avatar, and company lookup.
    const items = computed<UserListItem[]>(() => {
      const currentUser = authStore.currentUser;
      const companies = companyNameMap.value;

      return usersData.value.map((u) => {
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

        const mergedUser = currentUser && userObj.id === currentUser.id
          ? {
            ...userObj,
            jabatan: profileStore.jabatan || userObj.jabatan,
            name: profileStore.name || userObj.name,
            photo: profileStore.fotoProfileUrl || userObj.photo,
          }
          : userObj;

        const displayName = mergedUser.display_name || mergedUser.name || mergedUser.username || 'User';
        const avatarLetter = displayName.charAt(0).toUpperCase() || 'U';
        const companyName = mergedUser.id_perusahaan ? (companies.get(String(mergedUser.id_perusahaan)) || '-') : '-';
        const statusText = getUserStatusText(mergedUser.status);

        return {
          ...mergedUser,
          companyName,
          displayName,
          statusText,
          statusBadgeClass: statusText === 'Aktif' ? 'badge-sektor-teal' : 'badge-sektor-amber',
          roleBadgeClass: getRoleBadgeClass(mergedUser.role),
          roleIcon: getRoleIcon(mergedUser.role),
          avatarLetter,
          avatarClass: getAvatarColorClass(avatarLetter),
          userSearchText: makeUserSearchText(mergedUser),
          companySearchText: companyName.toLowerCase(),
        };
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
        data = data.filter((i) =>
          searchMode.value === "company"
            ? i.companySearchText.includes(q)
            : i.userSearchText.includes(q)
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

    const paginationCopy = computed(() => {
      const total = filteredData.value.length;
      const start = displayData.value.length ? (currentPage.value - 1) * itemsPerPage.value + 1 : 0;
      const end = Math.min(currentPage.value * itemsPerPage.value, total);
      return `Showing ${start}-${end} of ${total} users`;
    });

    const searchPlaceholder = computed(() =>
      searchMode.value === "company"
        ? "Cari nama perusahaan..."
        : "Cari nama user, email, jabatan, atau role..."
    );

    const fallbackRoles = ['admin', 'staff', 'user_pic', 'user'];
    const roleOptions = computed(() => rolesData.value.length ? rolesData.value : fallbackRoles.map((name, index) => ({ id: -(index + 1), name })));

    const getStatusPayload = (status: string) => {
      const isAktif = status === 'Aktif';
      const statusVal = isAktif ? 'Aktif' : 'Suspend';
      return {
        status: isAktif ? 'Aktif' : 'Nonaktif',
        status_akun: isAktif ? '1' : '0',
        aktif: isAktif ? 1 : 0,
        is_active: isAktif ? 1 : 0,
        is_suspended: isAktif ? 0 : 1,
        dedicatedStatus: statusVal,
      };
    };

    const getDisplayName = (item: User | null) => item?.display_name || item?.name || item?.username || 'User';

    // EDIT ACCESS
    const openEditRoleModal = (item: User) => {
      currentEditItem.value = item;
      selectedRole.value = item.role || 'user';
      selectedStatus.value = getUserStatusText(item.status);
      showEditRoleModal.value = true;
    };

    const updateRole = async () => {
      if (!currentEditItem.value) return;
      loading.value = true;
      try {
        const current = currentEditItem.value;
        const roleObj = rolesData.value.find(r => r.name.toLowerCase() === selectedRole.value.toLowerCase());
        if (!roleObj) {
          showNotification("Data role belum tersedia, coba refresh halaman.", "error");
          return;
        }

        const statusPayload = getStatusPayload(selectedStatus.value);
        const updatePayload: any = {
          id: current.id,
          username: current.username || current.email || '',
          name: current.name || current.display_name || current.username || '',
          email: current.email || current.username || '',
          status: statusPayload.status,
          status_akun: statusPayload.status_akun,
          aktif: statusPayload.aktif,
          is_active: statusPayload.is_active,
          is_suspended: statusPayload.is_suspended,
          role_id: roleObj.id,
        };

        if (current.display_name) updatePayload.display_name = current.display_name;
        if (current.phone) {
          updatePayload.phone = current.phone;
          updatePayload.telepon = current.phone;
        }
        if (current.location) {
          updatePayload.location = current.location;
          updatePayload.alamat = current.location;
        }
        updatePayload.id_jabatan = current.id_jabatan || null;

        await usersService.update(current.id, updatePayload);
        try {
          await usersService.updateStatus(current.id, {
            id: current.id,
            status: statusPayload.dedicatedStatus,
            status_akun: statusPayload.dedicatedStatus,
            aktif: statusPayload.aktif,
            is_active: statusPayload.is_active,
          });
        } catch (statusErr) {
          console.warn("Dedicated status endpoint failed:", statusErr);
        }
        
        // Update local data
        const index = usersData.value.findIndex((u: any) => u.id?.toString() === current.id);
        if (index !== -1) {
          (usersData.value[index] as any).role = selectedRole.value;
          (usersData.value[index] as any).role_name = selectedRole.value;
          (usersData.value[index] as any).status = statusPayload.status;
          (usersData.value[index] as any).status_akun = statusPayload.status_akun;
          (usersData.value[index] as any).aktif = statusPayload.aktif;
          (usersData.value[index] as any).is_active = statusPayload.is_active;
          (usersData.value[index] as any).is_suspended = statusPayload.is_suspended;
        }
        
        showEditRoleModal.value = false;
        showNotification("Akses user berhasil diupdate!", "success");
      } catch (error) {
        console.error('Failed to update user access:', error);
        showNotification("Gagal mengupdate akses user!", "error");
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
        usersStore.users = usersData.value.filter((u: any) => 
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

    const userStats = computed(() => items.value.reduce(
      (stats, user) => {
        const role = user.role?.toLowerCase();
        if (role === 'admin') stats.admin += 1;
        else if (role === 'staff') stats.staff += 1;
        else if (role === 'user_pic' || role === 'pic') stats.userPic += 1;
        else if (role === 'user') stats.user += 1;
        return stats;
      },
      { admin: 0, staff: 0, userPic: 0, user: 0 },
    ));

    onMounted(() => {
      loadUsers();
      setTimeout(() => {
        searchInput.value?.focus();
      }, 500);
    });

    return {
      authStore, items, loading, isInitialLoading, searchInput,
      searchQuery, searchMode, searchPlaceholder, sortField, sortOrder, currentPage, itemsPerPage,
      totalPages, displayData, paginationInfo, paginationCopy, filteredData,
      showDeleteModal, currentDeleteItem,
      showEditRoleModal, currentEditItem, selectedRole, selectedStatus,
      showToast, toastMessage, toastType,
      rolesData, roleOptions, userStats,
      openDeleteModal, deleteUser, openEditRoleModal, updateRole,
      getUserStatusText, getRoleBadgeClass, getDisplayName, clearSearch, toggleSort, getAvatarColorClass,
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

  <div class="role-page-shell">
    <section class="role-hero-card">
      <div class="role-hero-copy">
        <div class="role-breadcrumb">Dashboards <span>/</span> Users</div>
        <h2 class="role-hero-title">Manajemen User</h2>
        <p class="role-hero-desc">Kelola data pengguna, status akun, dan hak akses dalam tampilan yang ringkas.</p>
      </div>
      <div class="role-hero-summary">
        <span class="role-summary-kicker">User Tampil</span>
        <strong>{{ filteredData.length }}</strong>
        <span>dari {{ items.length }} user</span>
      </div>
    </section>

    <section class="role-stats-grid">
      <div class="role-stat-card role-stat-total">
        <span class="role-stat-icon"><i class="ri-team-line"></i></span>
        <div>
          <span class="role-stat-label">Total Users</span>
          <strong>{{ items.length }}</strong>
        </div>
      </div>
      <div class="role-stat-card role-stat-admin">
        <span class="role-stat-icon"><i class="ri-shield-star-line"></i></span>
        <div>
          <span class="role-stat-label">Admin</span>
          <strong>{{ userStats.admin }}</strong>
        </div>
      </div>
      <div class="role-stat-card role-stat-staff">
        <span class="role-stat-icon"><i class="ri-briefcase-line"></i></span>
        <div>
          <span class="role-stat-label">Staff</span>
          <strong>{{ userStats.staff }}</strong>
        </div>
      </div>
      <div class="role-stat-card role-stat-pic">
        <span class="role-stat-icon"><i class="ri-user-settings-line"></i></span>
        <div>
          <span class="role-stat-label">User / PIC</span>
          <strong>{{ userStats.userPic }}</strong>
        </div>
      </div>
      <div class="role-stat-card role-stat-user">
        <span class="role-stat-icon"><i class="ri-user-line"></i></span>
        <div>
          <span class="role-stat-label">User</span>
          <strong>{{ userStats.user }}</strong>
        </div>
      </div>
    </section>

    <section class="role-toolbar-card users-toolbar-card">
      <div class="users-toolbar-left">
        <div class="users-search-tabs" role="tablist" aria-label="Mode pencarian user">
          <button
            type="button"
            class="users-search-tab"
            :class="{ active: searchMode === 'user' }"
            @click="searchMode = 'user'; currentPage = 1"
          >
            <i class="ri-user-search-line"></i>
            User
          </button>
          <button
            type="button"
            class="users-search-tab"
            :class="{ active: searchMode === 'company' }"
            @click="searchMode = 'company'; currentPage = 1"
          >
            <i class="ri-building-4-line"></i>
            Perusahaan
          </button>
        </div>
        <div class="stakeholders-search role-search users-toolbar-search position-relative">
          <i class="ri-search-line header-search-icon"></i>
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            class="form-control form-control-sm header-search-input"
            :placeholder="searchPlaceholder"
          />
          <button v-if="searchQuery" @click="clearSearch" class="clear-btn" title="Clear search">
            <i class="ri-close-circle-fill"></i>
          </button>
        </div>
      </div>
      <div class="users-toolbar-right">
        <div class="role-rows-selector">
          <span>Rows</span>
          <select v-model="itemsPerPage" class="form-select form-select-sm header-rows-select">
            <option v-for="n in [5, 10, 15, 20, 25, 50]" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
      </div>
    </section>

    <section class="role-table-card">
      <div class="card-body p-0 stakeholders-premium-body">
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
                      <div class="company-avatar" :class="item.avatarClass">
                        <img v-if="item.photo" :src="item.photo" :alt="item.displayName" class="company-avatar-img" />
                        <span v-else class="company-avatar-letter">{{ item.avatarLetter }}</span>
                      </div>
                      <div class="company-name-wrap">
                        <span class="company-name d-block fw-bold">{{ item.displayName }}</span>
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
                    <span class="text-muted fs-13">{{ item.companyName }}</span>
                  </td>
                  <td class="align-middle text-center">
                    <span class="badge-sektor" :class="item.statusBadgeClass">
                      <i :class="item.statusText === 'Aktif' ? 'ri-checkbox-circle-line me-1' : 'ri-close-circle-line me-1'"></i>
                      {{ item.statusText }}
                    </span>
                  </td>
                  <td class="align-middle text-center">
                    <span class="badge-sektor" :class="item.roleBadgeClass">
                      <i :class="`${item.roleIcon} me-1`"></i>
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

          <div class="pagination-container stakeholders-pagination">
            <div class="stakeholders-pagination-copy">
              {{ paginationCopy }}
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
    </section>
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

  <!-- Edit Access Modal -->
  <Teleport to="body">
    <div v-if="showEditRoleModal" class="modal-overlay" @click.self="showEditRoleModal = false">
      <div class="modal-dialog modal-dialog-centered user-access-modal-dialog">
        <div class="modal-content border-0 bg-transparent">
          <div class="user-access-modal w-100">
            <div class="user-access-header">
              <div class="d-flex align-items-center gap-3 min-w-0">
                <div class="user-access-header-icon">
                  <i class="ri-shield-user-line"></i>
                </div>
                <div class="min-w-0">
                  <div class="user-access-title">Edit Akses User</div>
                  <div class="user-access-subtitle">Role dan status akun pengguna</div>
                </div>
              </div>
              <button type="button" class="user-access-close" @click="showEditRoleModal = false" title="Tutup">
                <i class="ri-close-line"></i>
              </button>
            </div>

            <div class="user-access-body" v-if="currentEditItem">
              <div class="user-access-summary">
                <div class="user-access-avatar" :class="getAvatarColorClass(getDisplayName(currentEditItem).charAt(0))">
                  <img v-if="currentEditItem.photo" :src="currentEditItem.photo" :alt="getDisplayName(currentEditItem)" />
                  <span v-else>{{ getDisplayName(currentEditItem).charAt(0).toUpperCase() }}</span>
                </div>
                <div class="min-w-0 flex-grow-1">
                  <div class="user-access-name">{{ getDisplayName(currentEditItem) }}</div>
                  <div class="user-access-meta">
                    <span>@{{ currentEditItem.username }}</span>
                    <span v-if="currentEditItem.email">{{ currentEditItem.email }}</span>
                  </div>
                </div>
                <div class="user-access-current">
                  <span class="badge-sektor" :class="getRoleBadgeClass(currentEditItem.role)">{{ currentEditItem.role }}</span>
                  <span class="badge-sektor" :class="getUserStatusText(currentEditItem.status) === 'Aktif' ? 'badge-sektor-teal' : 'badge-sektor-amber'">
                    {{ getUserStatusText(currentEditItem.status) }}
                  </span>
                </div>
              </div>

              <div class="user-access-form-grid">
                <div class="user-access-field">
                  <label class="user-access-label">
                    <i class="ri-shield-keyhole-line"></i>
                    Role Akses
                  </label>
                  <select v-model="selectedRole" class="form-select user-access-select">
                    <option v-for="role in roleOptions" :key="role.id" :value="role.name">{{ role.name }}</option>
                  </select>
                </div>

                <div class="user-access-field">
                  <label class="user-access-label">
                    <i class="ri-toggle-line"></i>
                    Status Akun
                  </label>
                  <div class="user-status-segment" role="group" aria-label="Status akun">
                    <button
                      type="button"
                      class="user-status-option"
                      :class="{ active: selectedStatus === 'Aktif' }"
                      @click="selectedStatus = 'Aktif'"
                    >
                      <i class="ri-checkbox-circle-line"></i>
                      <span>Aktif</span>
                    </button>
                    <button
                      type="button"
                      class="user-status-option"
                      :class="{ active: selectedStatus === 'Nonaktif' }"
                      @click="selectedStatus = 'Nonaktif'"
                    >
                      <i class="ri-close-circle-line"></i>
                      <span>Nonaktif</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="user-access-footer">
              <button class="btn btn-light user-access-cancel" @click="showEditRoleModal = false">Batal</button>
              <button class="btn btn-primary user-access-save" @click="updateRole" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="ri-save-3-line me-1"></i>
                Simpan Akses
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

.user-access-modal-dialog {
  width: min(760px, calc(100vw - 2rem));
  max-width: 760px;
  margin-left: auto;
  margin-right: auto;
  overflow: visible !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
}

.user-access-modal-dialog .modal-content {
  width: 100%;
  overflow: visible;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}

.user-access-modal {
  overflow: hidden;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.85);
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.34);
}

.user-access-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.45rem 1.75rem;
  background: linear-gradient(135deg, #0f3d91 0%, #2563eb 56%, #14b8a6 100%);
  color: #ffffff;
}

.user-access-header-icon {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 12px;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.22);
  font-size: 1.35rem;
}

.user-access-title {
  font-size: 1.08rem;
  font-weight: 800;
  line-height: 1.2;
}

.user-access-subtitle {
  margin-top: 0.15rem;
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.82rem;
  font-weight: 600;
}

.user-access-close {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 0;
  border-radius: 10px;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.14);
  transition: all 0.2s ease;
}

.user-access-close:hover {
  background: rgba(255, 255, 255, 0.24);
}

.user-access-body {
  padding: 1.55rem 1.75rem 1.45rem;
}

.user-access-summary {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.15rem;
  border-radius: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.user-access-avatar {
  width: 58px;
  height: 58px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: 16px;
  color: #ffffff;
  font-weight: 800;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
}

.user-access-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-access-name {
  color: #0f172a;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-access-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  margin-top: 0.25rem;
  color: #64748b;
  font-size: 0.82rem;
  font-weight: 600;
}

.user-access-current {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.35rem;
  flex: 0 0 auto;
  max-width: 190px;
}

.user-access-form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1.2rem;
  margin-top: 1.2rem;
}

.user-access-field {
  min-width: 0;
}

.user-access-label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.6rem;
  color: #475569;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.user-access-label i {
  color: #2563eb;
  font-size: 0.95rem;
}

.user-access-select {
  min-height: 48px;
  border-radius: 12px !important;
  border-color: #dbeafe !important;
  background-color: #f8fbff !important;
  color: #0f172a !important;
  font-weight: 700;
}

.user-access-select:focus {
  border-color: #2563eb !important;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12) !important;
}

.user-status-segment {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
  padding: 0.35rem;
  min-height: 48px;
  border-radius: 12px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
}

.user-status-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-width: 0;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #64748b;
  font-size: 0.82rem;
  font-weight: 800;
  transition: all 0.2s ease;
}

.user-status-option.active {
  background: #ffffff;
  color: #0f766e;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.user-status-option:not(.active):hover {
  color: #1e293b;
}

.user-status-option:last-child.active {
  color: #b45309;
}

.user-access-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.7rem;
  padding: 1.15rem 1.75rem 1.45rem;
  border-top: 1px solid #e2e8f0;
  background: #fbfdff;
}

.user-access-cancel,
.user-access-save {
  min-height: 44px;
  border-radius: 10px !important;
  font-weight: 800 !important;
}

.user-access-save {
  min-width: 160px;
}

@media (max-width: 576px) {
  .user-access-modal-dialog {
    width: calc(100vw - 1rem);
  }

  .user-access-header,
  .user-access-body,
  .user-access-footer {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .user-access-summary {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .user-access-current {
    width: 100%;
    max-width: none;
    justify-content: flex-start;
    padding-left: 62px;
  }

  .user-access-form-grid {
    grid-template-columns: 1fr;
  }

  .user-access-footer {
    flex-direction: column-reverse;
  }

  .user-access-cancel,
  .user-access-save {
    width: 100%;
  }
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

.stakeholder-table .th-no,
.stakeholder-table .stakeholder-row td:first-child,
.stakeholder-table .stakeholder-row:hover td:first-child {
  background: transparent !important;
  box-shadow: none !important;
}

.stakeholder-table .row-number {
  background: transparent !important;
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

.role-page-shell {
  display: grid;
  gap: 16px;
}

.role-hero-card {
  align-items: center;
  background:
    radial-gradient(circle at 10% 0%, rgba(96, 165, 250, 0.24), transparent 30%),
    radial-gradient(circle at 88% 24%, rgba(20, 184, 166, 0.16), transparent 24%),
    linear-gradient(135deg, #071b4f 0%, #173783 46%, #2563eb 100%);
  border: 1px solid rgba(147, 197, 253, 0.28);
  border-radius: 18px;
  box-shadow: 0 22px 55px rgba(37, 99, 235, 0.2), 0 8px 18px rgba(15, 23, 42, 0.08);
  display: flex;
  gap: 18px;
  justify-content: space-between;
  overflow: hidden;
  padding: 21px 26px;
  position: relative;
}

.role-hero-card::before {
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.18), transparent);
  content: "";
  height: 1px;
  left: 0;
  position: absolute;
  top: 0;
  width: 100%;
}

.role-hero-card::after {
  background: linear-gradient(90deg, rgba(96, 165, 250, 0.9), rgba(45, 212, 191, 0.78), rgba(255, 255, 255, 0));
  bottom: 0;
  content: "";
  height: 3px;
  left: 26px;
  position: absolute;
  width: min(360px, 48%);
}

.role-breadcrumb {
  color: rgba(219, 234, 254, 0.9);
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0.08em;
  margin-bottom: 7px;
  text-transform: uppercase;
}

.role-breadcrumb span {
  color: rgba(219, 234, 254, 0.58);
  margin: 0 6px;
}

.role-hero-copy h2 {
  color: #fff;
  font-size: 24px;
  font-weight: 900;
  line-height: 1.1;
  margin: 0;
}

.role-hero-copy p {
  color: rgba(239, 246, 255, 0.88);
  font-size: 13px;
  font-weight: 600;
  margin: 8px 0 0;
  max-width: 58ch;
}

.role-hero-summary {
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  color: #e2e8f0;
  display: grid;
  justify-items: center;
  min-width: 132px;
  padding: 14px 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 12px 24px rgba(15, 23, 42, 0.14);
}

.role-summary-kicker {
  color: #93c5fd;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.role-hero-summary strong {
  color: #fff;
  font-size: 28px;
  font-weight: 950;
  line-height: 1.05;
  margin-top: 3px;
}

.role-hero-summary span:last-child {
  color: #cbd5e1;
  font-size: 11px;
  font-weight: 700;
}

.role-stats-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.role-stat-card {
  align-items: center;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
  display: flex;
  gap: 13px;
  min-height: 86px;
  overflow: hidden;
  padding: 16px;
  position: relative;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.role-stat-card::before {
  background: var(--stat-accent, #2563eb);
  content: "";
  height: 100%;
  left: 0;
  opacity: 0.85;
  position: absolute;
  top: 0;
  width: 4px;
}

.role-stat-card::after {
  background: radial-gradient(circle, var(--stat-soft, rgba(37, 99, 235, 0.1)), transparent 64%);
  content: "";
  height: 92px;
  opacity: 0.72;
  position: absolute;
  right: -32px;
  top: -36px;
  width: 92px;
}

.role-stat-card:hover {
  border-color: rgba(37, 99, 235, 0.28);
  box-shadow: 0 20px 46px rgba(15, 23, 42, 0.11);
  transform: translateY(-2px);
}

.role-stat-icon {
  align-items: center;
  border-radius: 14px;
  display: inline-flex;
  flex: 0 0 44px;
  height: 44px;
  justify-content: center;
  position: relative;
  width: 44px;
  z-index: 1;
}

.role-stat-icon i {
  font-size: 22px;
}

.role-stat-label {
  color: #64748b;
  display: block;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.role-stat-card strong {
  color: #0f172a;
  display: block;
  font-size: 25px;
  font-weight: 950;
  line-height: 1.1;
  margin-top: 3px;
}

.role-stat-card > div {
  position: relative;
  z-index: 1;
}

.role-stat-total { --stat-accent: #2563eb; --stat-soft: rgba(37, 99, 235, 0.14); }
.role-stat-admin { --stat-accent: #dc2626; --stat-soft: rgba(220, 38, 38, 0.14); }
.role-stat-staff { --stat-accent: #16a34a; --stat-soft: rgba(22, 163, 74, 0.14); }
.role-stat-pic { --stat-accent: #ea580c; --stat-soft: rgba(234, 88, 12, 0.14); }
.role-stat-user { --stat-accent: #0284c7; --stat-soft: rgba(2, 132, 199, 0.14); }

.role-stat-total .role-stat-icon { background: rgba(37, 99, 235, 0.11); color: #2563eb; }
.role-stat-admin .role-stat-icon { background: rgba(220, 38, 38, 0.11); color: #dc2626; }
.role-stat-staff .role-stat-icon { background: rgba(22, 163, 74, 0.11); color: #16a34a; }
.role-stat-pic .role-stat-icon { background: rgba(234, 88, 12, 0.11); color: #ea580c; }
.role-stat-user .role-stat-icon { background: rgba(2, 132, 199, 0.11); color: #0284c7; }

.role-toolbar-card {
  align-items: center;
  background: linear-gradient(180deg, #fff, #fbfdff);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 14px 16px;
}

.users-toolbar-card {
  flex-wrap: wrap;
  margin-bottom: 0;
}

.users-toolbar-left,
.users-toolbar-right {
  align-items: center;
  display: flex;
  gap: 12px;
  min-width: 0;
}

.users-toolbar-left {
  flex: 1 1 560px;
  flex-wrap: wrap;
}

.users-toolbar-right {
  flex-shrink: 0;
  justify-content: flex-end;
}

.users-search-tabs {
  align-items: center;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  display: inline-flex;
  gap: 3px;
  padding: 3px;
}

.users-search-tab {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  display: inline-flex;
  font-size: 13px;
  font-weight: 800;
  gap: 7px;
  min-height: 34px;
  padding: 8px 14px;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.users-search-tab:hover {
  background: rgba(255, 255, 255, 0.55);
  color: #0f172a;
}

.users-search-tab.active {
  background: #ffffff;
  box-shadow: 0 5px 16px rgba(15, 23, 42, 0.08);
  color: #0f172a;
}

.role-search.users-toolbar-search {
  max-width: 360px;
}

.role-toolbar-copy {
  display: grid;
  gap: 2px;
}

.role-toolbar-copy span {
  color: #2563eb;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.role-toolbar-copy strong {
  color: #475569;
  font-size: 12px;
  font-weight: 800;
}

.role-toolbar-actions {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  min-width: 0;
}

.role-search {
  flex: 1 1 420px;
  max-width: 460px;
  min-width: 280px;
}

.role-search .header-search-input {
  background: #f8fafc !important;
  border: 1px solid #dbe5f0 !important;
  border-radius: 999px !important;
  box-shadow: none !important;
  color: #0f172a !important;
  height: 42px !important;
  padding-left: 42px !important;
  padding-right: 42px !important;
  width: 100% !important;
}

.role-search .header-search-input:focus {
  background: #fff !important;
  border-color: rgba(37, 99, 235, 0.48) !important;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08) !important;
}

.role-search .header-search-icon {
  color: #64748b !important;
  font-size: 16px;
  left: 16px;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
}

.role-search .clear-btn {
  align-items: center;
  background: transparent;
  border: 0;
  color: #94a3b8;
  display: inline-flex;
  height: 32px;
  justify-content: center;
  position: absolute;
  right: 7px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  z-index: 2;
}

.role-rows-selector {
  align-items: center;
  background: #f8fafc;
  border: 1px solid #dbe5f0;
  border-radius: 999px;
  display: inline-flex;
  gap: 8px;
  min-height: 42px;
  padding: 5px 7px 5px 14px;
}

.role-rows-selector span {
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.role-rows-selector .header-rows-select {
  background-color: #fff !important;
  border: 1px solid #dbe5f0 !important;
  border-radius: 999px !important;
  color: #1e293b !important;
  font-size: 12px !important;
  font-weight: 850;
  height: 30px !important;
  min-width: 72px;
}

.role-table-card {
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}

.role-table-card .stakeholders-table-shell {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.role-table-card .stakeholder-table-wrap {
  margin: 0;
  width: 100%;
}

.role-table-card .stakeholder-thead th {
  background: #f8fafc !important;
  border-bottom: 1px solid #e2e8f0 !important;
  color: #475569 !important;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  padding: 14px 16px;
  text-transform: uppercase;
}

.role-table-card .stakeholder-row td {
  padding: 15px 16px;
  transition: background-color 0.18s ease, box-shadow 0.18s ease;
}

.role-table-card .stakeholder-row:hover td {
  background: #f8fbff !important;
}

.role-table-card .th-no,
.role-table-card .stakeholder-row td:first-child,
.role-table-card .stakeholder-row:hover td:first-child {
  background: transparent !important;
  box-shadow: none !important;
}

.role-table-card .row-number {
  background: transparent !important;
}

.role-table-card .stakeholders-pagination {
  border-top: 1px solid #eef2f7;
  margin-top: 0 !important;
  padding: 16px 18px;
}

.badge-sektor {
  border-radius: 50px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 4px 12px;
  text-transform: uppercase;
}

.company-avatar {
  border-radius: 50%;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  height: 46px;
  width: 46px;
}

.company-avatar-img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

@media (max-width: 1199.98px) {
  .role-stats-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 991.98px) {
  .role-hero-card,
  .role-toolbar-card {
    align-items: stretch;
    flex-direction: column;
  }

  .role-hero-summary {
    align-items: start;
    justify-items: start;
    min-width: 0;
  }

  .role-toolbar-actions {
    justify-content: stretch;
    width: 100%;
  }

  .users-toolbar-left,
  .users-toolbar-right {
    width: 100%;
  }

  .role-search {
    max-width: none;
  }
}

@media (max-width: 767.98px) {
  .role-page-shell {
    gap: 12px;
  }

  .role-hero-card {
    border-radius: 14px;
    padding: 18px;
  }

  .role-hero-copy h2 {
    font-size: 20px;
  }

  .role-stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .role-stat-card {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
    min-height: 124px;
  }

  .role-toolbar-actions {
    flex-direction: column;
  }

  .users-search-tabs,
  .users-toolbar-search,
  .users-toolbar-right,
  .role-rows-selector {
    width: 100%;
  }

  .users-search-tab {
    flex: 1 1 0;
    justify-content: center;
  }

  .role-search,
  .role-rows-selector {
    min-width: 0;
    width: 100%;
  }

  .role-rows-selector {
    justify-content: space-between;
  }

  .role-table-card {
    border-radius: 14px;
  }

  .role-table-card .stakeholder-table-wrap {
    margin: 0;
    width: 100%;
  }

  .role-table-card .stakeholders-pagination {
    align-items: flex-start;
    flex-direction: column;
  }
}

[data-theme-mode='dark'] .role-hero-card {
  background:
    radial-gradient(circle at 10% 0%, rgba(96, 165, 250, 0.2), transparent 30%),
    radial-gradient(circle at 88% 24%, rgba(20, 184, 166, 0.13), transparent 24%),
    linear-gradient(135deg, #06143e 0%, #102a6f 48%, #1d4ed8 100%) !important;
  border-color: rgba(147, 197, 253, 0.2) !important;
  box-shadow: 0 24px 58px rgba(0, 0, 0, 0.34) !important;
}

[data-theme-mode='dark'] .role-toolbar-card,
[data-theme-mode='dark'] .role-table-card,
[data-theme-mode='dark'] .role-stat-card {
  background: linear-gradient(180deg, rgba(17, 24, 39, 0.94), rgba(15, 23, 42, 0.92)) !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.28) !important;
}

[data-theme-mode='dark'] .role-stat-card strong,
[data-theme-mode='dark'] .role-toolbar-copy strong {
  color: #e5edf7 !important;
}

[data-theme-mode='dark'] .role-stat-label,
[data-theme-mode='dark'] .role-rows-selector span {
  color: #9fb0c5 !important;
}

[data-theme-mode='dark'] .role-search .header-search-input,
[data-theme-mode='dark'] .role-rows-selector,
[data-theme-mode='dark'] .role-rows-selector .header-rows-select,
[data-theme-mode='dark'] .users-search-tabs {
  background: rgba(17, 24, 39, 0.82) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: #e5edf7 !important;
}

[data-theme-mode='dark'] .users-search-tab {
  color: #9fb0c5 !important;
}

[data-theme-mode='dark'] .users-search-tab:hover,
[data-theme-mode='dark'] .users-search-tab.active {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #e5edf7 !important;
}

[data-theme-mode='dark'] .role-table-card .stakeholder-row td {
  background: rgba(15, 23, 42, 0.86) !important;
  border-bottom-color: rgba(148, 163, 184, 0.12) !important;
  color: #cbd5e1 !important;
}

[data-theme-mode='dark'] .role-table-card .stakeholder-row:hover td {
  background: rgba(30, 41, 59, 0.72) !important;
}

[data-theme-mode='dark'] .role-table-card .stakeholders-pagination {
  background: rgba(15, 23, 42, 0.94) !important;
  border-top-color: rgba(148, 163, 184, 0.16) !important;
}

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

html[data-theme-mode="dark"] .user-access-modal {
  background: #1e293b !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45) !important;
}

html[data-theme-mode="dark"] .user-access-summary {
  background: rgba(15, 23, 42, 0.72) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

html[data-theme-mode="dark"] .user-access-name,
html[data-theme-mode="dark"] .user-status-option:not(.active):hover {
  color: #f8fafc !important;
}

html[data-theme-mode="dark"] .user-access-meta,
html[data-theme-mode="dark"] .user-access-label {
  color: #94a3b8 !important;
}

html[data-theme-mode="dark"] .user-access-select {
  background-color: #0f172a !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  color: #e2e8f0 !important;
}

html[data-theme-mode="dark"] .user-status-segment {
  background: #0f172a !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
}

html[data-theme-mode="dark"] .user-status-option {
  color: #94a3b8 !important;
}

html[data-theme-mode="dark"] .user-status-option.active {
  background: #1e293b !important;
  color: #2dd4bf !important;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.24) !important;
}

html[data-theme-mode="dark"] .user-status-option:last-child.active {
  color: #fbbf24 !important;
}

html[data-theme-mode="dark"] .user-access-footer {
  background: #172033 !important;
  border-top-color: rgba(255, 255, 255, 0.1) !important;
}

html[data-theme-mode="dark"] .role-hero-card,
html.dark .role-hero-card,
.dark-mode .role-hero-card {
  background:
    radial-gradient(circle at 10% 0%, rgba(96, 165, 250, 0.2), transparent 30%),
    radial-gradient(circle at 88% 24%, rgba(20, 184, 166, 0.13), transparent 24%),
    linear-gradient(135deg, #06143e 0%, #102a6f 48%, #1d4ed8 100%) !important;
  border-color: rgba(147, 197, 253, 0.2) !important;
  box-shadow: 0 24px 58px rgba(0, 0, 0, 0.34) !important;
}

html[data-theme-mode="dark"] .role-toolbar-card,
html.dark .role-toolbar-card,
.dark-mode .role-toolbar-card,
html[data-theme-mode="dark"] .role-table-card,
html.dark .role-table-card,
.dark-mode .role-table-card,
html[data-theme-mode="dark"] .role-stat-card,
html.dark .role-stat-card,
.dark-mode .role-stat-card {
  background: linear-gradient(180deg, rgba(17, 24, 39, 0.94), rgba(15, 23, 42, 0.92)) !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.28) !important;
}

html[data-theme-mode="dark"] .role-stat-card strong,
html.dark .role-stat-card strong,
.dark-mode .role-stat-card strong,
html[data-theme-mode="dark"] .role-toolbar-copy strong,
html.dark .role-toolbar-copy strong,
.dark-mode .role-toolbar-copy strong {
  color: #e5edf7 !important;
}

html[data-theme-mode="dark"] .role-stat-label,
html.dark .role-stat-label,
.dark-mode .role-stat-label,
html[data-theme-mode="dark"] .role-rows-selector span,
html.dark .role-rows-selector span,
.dark-mode .role-rows-selector span {
  color: #9fb0c5 !important;
}

html[data-theme-mode="dark"] .role-search .header-search-input,
html.dark .role-search .header-search-input,
.dark-mode .role-search .header-search-input,
html[data-theme-mode="dark"] .role-rows-selector,
html.dark .role-rows-selector,
.dark-mode .role-rows-selector,
html[data-theme-mode="dark"] .role-rows-selector .header-rows-select,
html.dark .role-rows-selector .header-rows-select,
.dark-mode .role-rows-selector .header-rows-select,
html[data-theme-mode="dark"] .users-search-tabs,
html.dark .users-search-tabs,
.dark-mode .users-search-tabs {
  background: rgba(17, 24, 39, 0.82) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: #e5edf7 !important;
}

html[data-theme-mode="dark"] .users-search-tab,
html.dark .users-search-tab,
.dark-mode .users-search-tab {
  color: #9fb0c5 !important;
}

html[data-theme-mode="dark"] .users-search-tab:hover,
html.dark .users-search-tab:hover,
.dark-mode .users-search-tab:hover,
html[data-theme-mode="dark"] .users-search-tab.active,
html.dark .users-search-tab.active,
.dark-mode .users-search-tab.active {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #e5edf7 !important;
}

html[data-theme-mode="dark"] .role-search .header-search-input::placeholder,
html.dark .role-search .header-search-input::placeholder,
.dark-mode .role-search .header-search-input::placeholder {
  color: rgba(203, 213, 225, 0.72) !important;
}

html[data-theme-mode="dark"] .role-table-card .stakeholder-thead th,
html.dark .role-table-card .stakeholder-thead th,
.dark-mode .role-table-card .stakeholder-thead th {
  background: rgba(30, 41, 59, 0.96) !important;
  border-bottom-color: rgba(148, 163, 184, 0.2) !important;
  color: #dbe7f3 !important;
}

html[data-theme-mode="dark"] .role-table-card .stakeholder-row td,
html.dark .role-table-card .stakeholder-row td,
.dark-mode .role-table-card .stakeholder-row td {
  background: rgba(15, 23, 42, 0.86) !important;
  border-bottom-color: rgba(148, 163, 184, 0.12) !important;
  color: #cbd5e1 !important;
}

html[data-theme-mode="dark"] .role-table-card .stakeholder-row:hover td,
html.dark .role-table-card .stakeholder-row:hover td,
.dark-mode .role-table-card .stakeholder-row:hover td {
  background: rgba(30, 41, 59, 0.72) !important;
}

html[data-theme-mode="dark"] .role-table-card .stakeholders-pagination,
html.dark .role-table-card .stakeholders-pagination,
.dark-mode .role-table-card .stakeholders-pagination {
  background: rgba(15, 23, 42, 0.94) !important;
  border-top-color: rgba(148, 163, 184, 0.16) !important;
}
</style>



