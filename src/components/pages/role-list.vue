<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { Tooltip } from "bootstrap";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import usersData from "../../utils/users.json";
import { useAuthStore } from "../../stores/auth";
import { rolesDummy, type User, getRoleByName } from "../../data/roledummydata";

const dataToPass = {
  title: { label: "Dashboards", path: "/dashboards" },
  currentpage: "Role List",
  activepage: "Role List",
};
const authStore = useAuthStore();
const isAdmin = computed(() => authStore.isAdmin);
const currentLoggedInUser = computed(() => authStore.currentUser);

const items = ref<User[]>([]);
const loading = ref(false);
const searchQuery = ref("");
const sortField = ref<"name" | "role">("name");
const sortOrder = ref<"asc" | "desc">("asc");
const currentPage = ref(1);
const itemsPerPage = ref(10);

const showModal = ref(false);
const showDeleteModal = ref(false);
const selectedUser = ref<User | null>(null);
const currentDeleteItem = ref<User | null>(null);
const newRoleName = ref("");

const showToast = ref(false);
const toastMessage = ref("");
const toastType = ref<"success" | "error">("success");

const filteredData = computed(() => {
  let data = items.value;

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim();
    data = data.filter((user) => user.name.toLowerCase().includes(query));
  }

  // Sort data
  return [...data].sort((a, b) => {
    const modifier = sortOrder.value === "asc" ? 1 : -1;
    const valA = a[sortField.value].toString().toLowerCase();
    const valB = b[sortField.value].toString().toLowerCase();
    return valA < valB ? -1 * modifier : valA > valB ? 1 * modifier : 0;
  });
});

const totalPages = computed(() =>
  Math.ceil(filteredData.value.length / itemsPerPage.value)
);

const displayData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return filteredData.value.slice(start, start + itemsPerPage.value);
});

const loadUsers = async () => {
  loading.value = true;
  await new Promise((resolve) => setTimeout(resolve, 300));

  items.value = usersData.map((u: any) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    permissions: getRoleByName(u.role)?.permissions ?? [],
    allAccess: getRoleByName(u.role)?.allAccess ?? false,
  }));

  loading.value = false;
};

const showNotification = (
  message: string,
  type: "success" | "error" = "success"
) => {
  toastMessage.value = message;
  toastType.value = type;
  showToast.value = true;
  setTimeout(() => (showToast.value = false), 3000);
};

const toggleSort = (field: "name" | "role") => {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    sortField.value = field;
    sortOrder.value = "asc";
  }
};

const clearSearch = () => {
  searchQuery.value = "";
  currentPage.value = 1;
};

const openEditModal = (user: User) => {
  if (!isAdmin.value) {
    showNotification("Hanya Admin yang dapat mengubah role!", "error");
    return;
  }
  selectedUser.value = { ...user };
  newRoleName.value = user.role;
  showModal.value = true;
};

const saveChanges = () => {
  if (!selectedUser.value) return;

  const roleData = getRoleByName(newRoleName.value);
  const index = items.value.findIndex((u) => u.id === selectedUser.value?.id);

  if (index !== -1 && roleData) {
    items.value[index] = {
      ...items.value[index],
      role: roleData.name,
      permissions: roleData.permissions,
      allAccess: roleData.allAccess ?? false,
    };
    showNotification("Role berhasil diperbarui!", "success");
  }

  showModal.value = false;
};

const openDeleteModal = (user: User) => {
  if (!isAdmin.value) {
    showNotification("Hanya Admin yang dapat menghapus user!", "error");
    return;
  }

  if (currentLoggedInUser.value && user.id === currentLoggedInUser.value.id) {
    showNotification("Anda tidak dapat menghapus diri sendiri!", "error");
    return;
  }

  currentDeleteItem.value = user;
  showDeleteModal.value = true;
};

const deleteUser = () => {
  if (!currentDeleteItem.value) return;

  items.value = items.value.filter((u) => u.id !== currentDeleteItem.value!.id);
  showDeleteModal.value = false;
  showNotification("User berhasil dihapus!", "success");
};

const initTooltips = () => {
  const tooltipTriggerList = document.querySelectorAll(
    '[data-bs-toggle="tooltip"]'
  );
  tooltipTriggerList.forEach((el) => new Tooltip(el));
};

watch([searchQuery, itemsPerPage], () => (currentPage.value = 1));

watch(displayData, () => {
  nextTick(() => initTooltips());
});

onMounted(() => loadUsers());
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Toast Notification -->
  <div v-if="showToast" class="position-fixed top-0 end-0 p-3" style="z-index: 9999">
    <div class="toast show" 
      :class="{
        'bg-success': toastType === 'success',
        'bg-danger': toastType === 'error',
      }" role="alert">
      <div class="toast-body text-white">
        <i :class="toastType === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'" class="me-2"></i>
        {{ toastMessage }}
      </div>
    </div>
  </div>

  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card">
        <!-- Card Header -->
        <div class="card-header d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3">
          <div class="card-title">User Role Administration</div>

          <!-- Search Input -->
          <div class="search-container position-relative flex-grow-1" style="max-width: 400px">
            <input v-model="searchQuery" type="text" class="form-control form-control-sm" placeholder="Search by name..." aria-label="Search users"/>
            <i v-if="!searchQuery" class="ri-search-line search-icon"></i>
            <button v-if="searchQuery" @click="clearSearch" class="btn btn-sm clear-btn" title="Clear search">
              <i class="ri-close-line"></i>
            </button>
          </div>
        </div>

        <!-- Card Body -->
        <div class="card-body p-0 p-sm-3">
          <!-- Loading State -->
          <div v-if="loading" class="text-center p-4">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>

          <template v-else>
            <!-- Non-admin Info Banner
            <div v-if="!isAdmin" class="alert alert-info-transparent border-0 mb-3">
              <i class="ri-information-line me-2"></i>
              <small>
                Anda login sebagai
                <strong>{{ currentLoggedInUser?.role }}</strong
                >. Hanya Admin yang dapat mengubah role user.
              </small>
            </div> -->

            <!-- Items Per Page Control -->
            <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
              <div class="d-flex align-items-center gap-2">
                <span class="text-muted fs-13">Tampilkan</span>
                <select v-model="itemsPerPage" class="form-select form-select-sm" style="width: 75px">
                  <option v-for="n in [5, 10, 15, 20, 25, 50]" :key="n" :value="n">{{ n }}</option>
                </select>
                <span class="text-muted fs-13">per halaman</span>
              </div>
            </div>

            <!-- Data Table -->
            <div class="table-responsive">
              <table class="table table-hover text-nowrap mb-0">
                <thead>
                  <tr>
                    <th scope="col">No</th>

                    <!-- Name Column (Sortable) -->
                    <th scope="col" class="sortable">
                      <div class="d-flex align-items-center gap-1">
                        <span class="column-label" @click="toggleSort('name')" title="Click to toggle sort">Name</span>
                        <div class="sort-arrows">
                          <i class="ri-arrow-up-s-line" 
                            :class="{ active: sortField === 'name' && sortOrder === 'asc' }" 
                            @click.stop="sortField = 'name'; sortOrder = 'asc';" 
                            title="Sort A-Z"></i>
                          <i class="ri-arrow-down-s-line" 
                            :class="{ active: sortField === 'name' && sortOrder === 'desc' }" 
                            @click.stop="sortField = 'name'; sortOrder = 'desc';" 
                            title="Sort Z-A"></i>
                        </div>
                      </div>
                    </th>

                    <!-- Role Column (Sortable)-->
                    <th scope="col" class="sortable">
                      <div class="d-flex align-items-center gap-1">
                        <span class="column-label" @click="toggleSort('role')" title="Click to toggle sort">Current Role</span>
                        <div class="sort-arrows">
                          <i class="ri-arrow-up-s-line" 
                            :class="{ active: sortField === 'role' && sortOrder === 'asc' }" 
                            @click.stop="sortField = 'role'; sortOrder = 'asc';" 
                            title="Sort A-Z"
                          ></i>
                          <i class="ri-arrow-down-s-line" 
                            :class="{ active: sortField === 'role' && sortOrder === 'desc' }"
                            @click.stop="sortField = 'role'; sortOrder = 'desc';"
                            title="Sort Z-A"
                          ></i>
                        </div>
                      </div>
                    </th>
                    <th scope="col">Permissions</th>
                    <th scope="col" class="text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  <!-- Empty State -->
                  <tr v-if="!displayData.length">
                    <td colspan="5" class="text-center text-muted py-4">
                      <i class="ri-inbox-line fs-2 d-block mb-2"></i>
                      Data tidak ditemukan
                    </td>
                  </tr>

                  <!-- User Rows -->
                  <tr v-for="(user, index) in displayData" :key="user.id">
                    <td>{{ (currentPage - 1) * itemsPerPage + index + 1 }}</td>

                    <td>
                      <div class="fw-semibold">{{ user.name }}</div>
                    </td>

                    <td>
                      <span :class="['badge role-badge', user.role === 'Admin' ? 'bg-danger-transparent' : 'bg-info-transparent']">
                        {{ user.role }}
                      </span>
                    </td>

                    <td>
                      <span v-if="user.allAccess" class="text-success small fw-bold" data-bs-toggle="tooltip" data-bs-placement="top" title="All permissions enabled">
                        <i class="ri-shield-check-line me-1"></i>Full Access
                      </span>
                      <span v-else class="text-muted small permission-tooltip" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-html="true" :title="user.permissions.join(', ') || 'No permissions'">
                        <i class="ri-lock-2-line me-1"></i>
                        {{ user.permissions.length }} active
                      </span>
                    </td>

                    <td class="text-center">
                      <div class="btn-list">
                        <button :class="['btn btn-sm btn-icon me-2', isAdmin ? 'btn-primary-light' : 'btn-secondary-light opacity-50']"
                          @click="openEditModal(user)"
                          :title="isAdmin ? 'Edit Role' : 'Hanya Admin yang dapat mengubah role'">
                          <i class="ri-edit-line"></i>
                        </button>
                        <button
                          :class="['btn btn-sm btn-icon', isAdmin ? 'btn-danger-light' : 'btn-secondary-light opacity-50']"
                          @click="openDeleteModal(user)"
                          :title="isAdmin ? 'Delete User' : 'Hanya Admin yang dapat menghapus user'"
                          :disabled="!!(currentLoggedInUser && user.id === currentLoggedInUser.id)">
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
                Halaman {{ currentPage }} dari {{ totalPages }}
              </span>
              <nav>
                <ul class="pagination pagination-sm mb-0">
                  <!-- First Page -->
                  <li class="page-item" 
                      :class="{ disabled: currentPage === 1 }">
                    <a class="page-link" href="#" @click.prevent="currentPage = 1">
                      <i class="ri-skip-back-mini-line"></i>
                    </a>
                  </li>

                  <!-- Previous Page -->
                  <li class="page-item" 
                      :class="{ disabled: currentPage === 1 }">
                    <a class="page-link" href="#" @click.prevent="currentPage--">
                      <i class="ri-arrow-left-s-line"></i>
                    </a>
                  </li>

                  <!-- Page Numbers -->
                  <template v-for="p in totalPages" :key="p">
                    <li v-if="p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)"
                      class="page-item"
                      :class="{ active: p === currentPage }">
                      <a class="page-link" href="#" @click.prevent="currentPage = p">
                        {{ p }}
                      </a>
                    </li>
                    <li v-else-if="p === currentPage - 2 || p === currentPage + 2"
                      class="page-item disabled">
                      <span class="page-link">...</span>
                    </li>
                  </template>

                  <!-- Next Page -->
                  <li class="page-item"
                    :class="{ disabled: currentPage === totalPages }">
                    <a class="page-link" href="#" @click.prevent="currentPage++">
                      <i class="ri-arrow-right-s-line"></i>
                    </a>
                  </li>

                  <!-- Last Page -->
                  <li class="page-item"
                    :class="{ disabled: currentPage === totalPages }">
                    <a class="page-link" href="#" @click.prevent="currentPage = totalPages">
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
  <Transition name="fade">
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content card custom-card shadow-lg mx-3">
        <div class="card-header">
          <div class="card-title text-truncate">
            Edit Role: {{ selectedUser?.name }}
          </div>
        </div>
        <div class="card-body">
          <div class="form-group mb-3">
            <label class="form-label fw-bold">Select Security Role</label>
            <select v-model="newRoleName" class="form-select form-select-lg">
              <option v-for="role in rolesDummy"
                :key="role.id"
                :value="role.name">
                {{ role.name }}
              </option>
            </select>
          </div>
        </div>
        <div class="card-footer d-flex flex-column flex-sm-row justify-content-end gap-2">
          <button class="btn btn-light order-2 order-sm-1" @click="showModal = false">Cancel</button>
          <button class="btn btn-primary order-1 order-sm-2" @click="saveChanges">Update Access</button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Delete Confirmation Modal -->
  <div v-if="showDeleteModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0, 0, 0, 0.5)">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Konfirmasi Hapus</h5>
          <button type="button" class="btn-close" @click="showDeleteModal = false"></button>
        </div>
        <div class="modal-body text-center">
          <div class="mb-3">
            <i class="ri-error-warning-line text-warning" style="font-size: 4rem"></i>
          </div>
          <h5 class="mb-2">Apakah Anda yakin?</h5>
          <p class="text-muted mb-0">
            Anda akan menghapus user
            <strong>{{ currentDeleteItem?.name }}</strong
            >. Tindakan ini tidak dapat dibatalkan.
          </p>
        </div>
        <div class="modal-footer justify-content-center">
          <button type="button" class="btn btn-secondary" @click="showDeleteModal = false">Batal</button>
          <button type="button" class="btn btn-danger" @click="deleteUser">
            <i class="ri-delete-bin-line me-1"></i>Hapus
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
