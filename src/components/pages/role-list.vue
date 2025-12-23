<script lang="ts">
import SimpleCardComponent from "../../shared/components/@spk/simple-card.vue";
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { Tooltip } from "bootstrap";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import {
  usersDummy as initialUsers,
  rolesDummy,
  permissionsDummy,
  type User,
  getRoleByName,
} from "../../data/roledummydata";

export default {
  data() {
    return {
      dataToPass: {
        title: { label: "Dashboards", path: "/dashboards" },
        currentpage: "Role List",
        activepage: "Role List",
      },
    };
  },
  components: {
    Pageheader,
    SimpleCardComponent,
  },
  setup() {
    const items = ref<User[]>([]);
    const loading = ref(false);
    const showModal = ref(false);
    const showDeleteModal = ref(false);
    const selectedUser = ref<User | null>(null);
    const currentDeleteItem = ref<User | null>(null);
    const newRoleName = ref("");
    const searchQuery = ref("");
    const sortField = ref<"name" | "role">("name");
    const sortOrder = ref<"asc" | "desc">("asc");
    const showPermissionDetails = ref(false);
    const currentPage = ref(1);
    const itemsPerPage = ref(10);

    // Toast state
    const showToast = ref(false);
    const toastMessage = ref("");
    const toastType = ref<"success" | "error">("success");

    const loadUsers = async () => {
      loading.value = true;
      await new Promise((resolve) => setTimeout(resolve, 300));
      items.value = [...initialUsers];
      loading.value = false;
    };

    const filteredData = computed(() => {
      let data = items.value;
      if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase().trim();
        data = data.filter((user) => user.name.toLowerCase().includes(query));
      }
      // Sort
      return [...data].sort((a, b) => {
        const modifier = sortOrder.value === "asc" ? 1 : -1;
        const valA = a[sortField.value].toString().toLowerCase();
        const valB = b[sortField.value].toString().toLowerCase();
        if (valA < valB) return -1 * modifier;
        if (valA > valB) return 1 * modifier;
        return 0;
      });
    });

    const totalPages = computed(() =>
      Math.ceil(filteredData.value.length / itemsPerPage.value)
    );

    const displayData = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredData.value.slice(start, start + itemsPerPage.value);
    });

    const toggleSort = (field: "name" | "role") => {
      if (sortField.value === field) {
        sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
      } else {
        sortField.value = field;
        sortOrder.value = "asc";
      }
    };

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

    const openEditModal = (user: User) => {
      selectedUser.value = { ...user };
      newRoleName.value = user.role;
      showModal.value = true;
    };

    const saveChanges = () => {
      if (selectedUser.value) {
        const roleData = getRoleByName(newRoleName.value);
        const index = items.value.findIndex(
          (u) => u.id === selectedUser.value?.id
        );
        if (index !== -1 && roleData) {
          items.value[index] = {
            ...items.value[index],
            role: roleData.name,
            permissions: roleData.permissions,
            allAccess: roleData.allAccess ?? false,
          };
          showNotification("Role berhasil diperbarui!", "success");
        }
      }
      showModal.value = false;
    };

    // DELETE
    const openDeleteModal = (user: User) => {
      currentDeleteItem.value = user;
      showDeleteModal.value = true;
    };

    const deleteUser = () => {
      if (!currentDeleteItem.value) return;
      items.value = items.value.filter(
        (u) => u.id !== currentDeleteItem.value!.id
      );
      showDeleteModal.value = false;
      showNotification("User berhasil dihapus!", "success");
    };

    const clearSearch = () => {
      searchQuery.value = "";
      currentPage.value = 1;
    };

    watch([searchQuery, itemsPerPage], () => (currentPage.value = 1));

    const initTooltips = () => {
      const tooltipTriggerList = document.querySelectorAll(
        '[data-bs-toggle="tooltip"]'
      );
      tooltipTriggerList.forEach((el) => {
        new Tooltip(el);
      });
    };

    onMounted(() => {
      loadUsers();
    });

    // Initialize tooltips when displayData changes
    watch(displayData, () => {
      nextTick(() => {
        initTooltips();
      });
    });

    return {
      items,
      loading,
      showModal,
      showDeleteModal,
      selectedUser,
      currentDeleteItem,
      newRoleName,
      searchQuery,
      sortField,
      sortOrder,
      currentPage,
      itemsPerPage,
      totalPages,
      displayData,
      toggleSort,
      rolesDummy,
      permissionsDummy,
      getRoleByName,
      openEditModal,
      saveChanges,
      openDeleteModal,
      deleteUser,
      clearSearch,
      showPermissionDetails,
      showToast,
      toastMessage,
      toastType,
    };
  },
};
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Toast Notification -->
  <div
    v-if="showToast"
    class="position-fixed top-0 end-0 p-3"
    style="z-index: 9999"
  >
    <div
      class="toast show"
      :class="{
        'bg-success': toastType === 'success',
        'bg-danger': toastType === 'error',
      }"
      role="alert"
    >
      <div class="toast-body text-white">
        <i
          :class="
            toastType === 'success'
              ? 'ri-checkbox-circle-line'
              : 'ri-error-warning-line'
          "
          class="me-2"
        ></i>
        {{ toastMessage }}
      </div>
    </div>
  </div>

  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card">
        <div
          class="card-header d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3"
        >
          <div class="card-title">User Role Administration</div>

          <!-- Search Input -->
          <div
            class="search-container position-relative flex-grow-1"
            style="max-width: 400px"
          >
            <input
              v-model="searchQuery"
              type="text"
              class="form-control form-control-sm"
              placeholder="Search by name..."
              aria-label="Search users"
            />
            <i v-if="!searchQuery" class="ri-search-line search-icon"></i>
            <button
              v-if="searchQuery"
              @click="clearSearch"
              class="btn btn-sm clear-btn"
              title="Clear search"
            >
              <i class="ri-close-line"></i>
            </button>
          </div>
        </div>

        <div class="card-body p-0 p-sm-3">
          <!-- Loading state -->
          <div v-if="loading" class="text-center p-4">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>

          <template v-else>
            <!-- Controls -->
            <div
              class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2"
            >
              <div class="d-flex align-items-center gap-2">
                <span class="text-muted fs-13">Tampilkan</span>
                <select
                  v-model="itemsPerPage"
                  class="form-select form-select-sm"
                  style="width: 75px"
                >
                  <option
                    v-for="n in [5, 10, 15, 20, 25, 50]"
                    :key="n"
                    :value="n"
                  >
                    {{ n }}
                  </option>
                </select>
                <span class="text-muted fs-13">per halaman</span>
              </div>
            </div>

            <!-- Table -->
            <div class="table-responsive">
              <table class="table table-hover text-nowrap mb-0">
                <thead>
                  <tr>
                    <th scope="col">No</th>
                    <th scope="col" class="sortable">
                      <div class="d-flex align-items-center gap-1">
                        <span
                          class="column-label"
                          @click="toggleSort('name')"
                          title="Click to toggle sort"
                          >Name</span
                        >
                        <div class="sort-arrows">
                          <i
                            class="ri-arrow-up-s-line"
                            :class="{
                              active:
                                sortField === 'name' && sortOrder === 'asc',
                            }"
                            @click.stop="
                              sortField = 'name';
                              sortOrder = 'asc';
                            "
                            title="Sort A-Z"
                          ></i>
                          <i
                            class="ri-arrow-down-s-line"
                            :class="{
                              active:
                                sortField === 'name' && sortOrder === 'desc',
                            }"
                            @click.stop="
                              sortField = 'name';
                              sortOrder = 'desc';
                            "
                            title="Sort Z-A"
                          ></i>
                        </div>
                      </div>
                    </th>
                    <th scope="col" class="sortable">
                      <div class="d-flex align-items-center gap-1">
                        <span
                          class="column-label"
                          @click="toggleSort('role')"
                          title="Click to toggle sort"
                          >Current Role</span
                        >
                        <div class="sort-arrows">
                          <i
                            class="ri-arrow-up-s-line"
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
                          <i
                            class="ri-arrow-down-s-line"
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
                    <th scope="col">Permissions</th>
                    <th scope="col" class="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!displayData.length">
                    <td colspan="5" class="text-center text-muted py-4">
                      <i class="ri-inbox-line fs-2 d-block mb-2"></i>Data tidak
                      ditemukan
                    </td>
                  </tr>
                  <tr v-for="(user, index) in displayData" :key="user.id">
                    <td>{{ (currentPage - 1) * itemsPerPage + index + 1 }}</td>
                    <td>
                      <div class="fw-semibold">{{ user.name }}</div>
                    </td>
                    <td>
                      <span
                        :class="[
                          'badge',
                          'role-badge',
                          user.role === 'Admin'
                            ? 'bg-danger-transparent'
                            : 'bg-info-transparent',
                        ]"
                      >
                        {{ user.role }}
                      </span>
                    </td>
                    <td>
                      <span
                        v-if="user.allAccess"
                        class="text-success small fw-bold"
                        data-bs-toggle="tooltip"
                        data-bs-placement="top"
                        title="All permissions enabled"
                      >
                        <i class="ri-shield-check-line me-1"></i>Full Access
                      </span>
                      <span
                        v-else
                        class="text-muted small permission-tooltip"
                        data-bs-toggle="tooltip"
                        data-bs-placement="top"
                        data-bs-html="true"
                        :title="user.permissions.join(', ') || 'No permissions'"
                      >
                        <i class="ri-lock-2-line me-1"></i
                        >{{ user.permissions.length }} active
                      </span>
                    </td>
                    <td class="text-end">
                      <div class="btn-list">
                        <button
                          class="btn btn-sm btn-icon btn-primary-light me-2"
                          @click="openEditModal(user)"
                          title="Edit Role"
                        >
                          <i class="ri-edit-line"></i>
                        </button>
                        <button
                          class="btn btn-sm btn-icon btn-danger-light"
                          @click="openDeleteModal(user)"
                          title="Delete User"
                        >
                          <i class="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div
              v-if="totalPages > 1"
              class="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-3 border-top gap-2"
            >
              <span class="text-muted fs-13"
                >Halaman {{ currentPage }} dari {{ totalPages }}</span
              >
              <nav>
                <ul class="pagination pagination-sm mb-0">
                  <li
                    class="page-item"
                    :class="{ disabled: currentPage === 1 }"
                  >
                    <a
                      class="page-link"
                      href="#"
                      @click.prevent="currentPage = 1"
                      ><i class="ri-skip-back-mini-line"></i
                    ></a>
                  </li>
                  <li
                    class="page-item"
                    :class="{ disabled: currentPage === 1 }"
                  >
                    <a class="page-link" href="#" @click.prevent="currentPage--"
                      ><i class="ri-arrow-left-s-line"></i
                    ></a>
                  </li>
                  <template v-for="p in totalPages" :key="p">
                    <li
                      v-if="
                        p === 1 ||
                        p === totalPages ||
                        (p >= currentPage - 1 && p <= currentPage + 1)
                      "
                      class="page-item"
                      :class="{ active: p === currentPage }"
                    >
                      <a
                        class="page-link"
                        href="#"
                        @click.prevent="currentPage = p"
                        >{{ p }}</a
                      >
                    </li>
                    <li
                      v-else-if="p === currentPage - 2 || p === currentPage + 2"
                      class="page-item disabled"
                    >
                      <span class="page-link">...</span>
                    </li>
                  </template>
                  <li
                    class="page-item"
                    :class="{ disabled: currentPage === totalPages }"
                  >
                    <a class="page-link" href="#" @click.prevent="currentPage++"
                      ><i class="ri-arrow-right-s-line"></i
                    ></a>
                  </li>
                  <li
                    class="page-item"
                    :class="{ disabled: currentPage === totalPages }"
                  >
                    <a
                      class="page-link"
                      href="#"
                      @click.prevent="currentPage = totalPages"
                      ><i class="ri-skip-forward-mini-line"></i
                    ></a>
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
              <option
                v-for="role in rolesDummy"
                :key="role.id"
                :value="role.name"
              >
                {{ role.name }}
              </option>
            </select>
          </div>

          <div class="alert alert-primary-light border-0 mb-0">
            <div
              class="d-flex align-items-center cursor-pointer"
              @click="showPermissionDetails = !showPermissionDetails"
              style="cursor: pointer"
            >
              <i class="ri-information-line fs-20 me-2"></i>
              <small>
                This role includes
                <strong>{{
                  getRoleByName(newRoleName)?.allAccess
                    ? permissionsDummy.length
                    : getRoleByName(newRoleName)?.permissions.length || 0
                }}</strong>
                specific permissions.
                <i
                  :class="
                    showPermissionDetails
                      ? 'ri-arrow-up-s-line'
                      : 'ri-arrow-down-s-line'
                  "
                  class="ms-1"
                ></i>
              </small>
            </div>

            <!-- Permission Details -->
            <div v-if="showPermissionDetails" class="mt-3 pt-3 border-top">
              <div class="row g-2">
                <template v-if="getRoleByName(newRoleName)?.allAccess">
                  <div
                    v-for="perm in permissionsDummy"
                    :key="perm.id"
                    class="col-6"
                  >
                    <span
                      class="badge bg-success-transparent w-100 text-start py-2 role-badge3"
                    >
                      <i class="ri-check-line me-1"></i>{{ perm.label }}
                    </span>
                  </div>
                </template>
                <template v-else>
                  <div
                    v-for="perm in getRoleByName(newRoleName)?.permissions"
                    :key="perm"
                    class="col-6"
                  >
                    <span
                      class="badge bg-info-transparent w-100 text-start py-2 role-badge3"
                    >
                      <i class="ri-check-line me-1"></i>{{ perm }}
                    </span>
                  </div>
                  <div
                    v-if="!getRoleByName(newRoleName)?.permissions.length"
                    class="col-12"
                  >
                    <span class="text-muted small"
                      >No permissions assigned</span
                    >
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
        <div
          class="card-footer d-flex flex-column flex-sm-row justify-content-end gap-2"
        >
          <button
            class="btn btn-light order-2 order-sm-1"
            @click="showModal = false"
          >
            Cancel
          </button>
          <button
            class="btn btn-primary order-1 order-sm-2"
            @click="saveChanges"
          >
            Update Access
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Delete Confirmation Modal -->
  <div
    v-if="showDeleteModal"
    class="modal fade show d-block"
    tabindex="-1"
    style="background-color: rgba(0, 0, 0, 0.5)"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Konfirmasi Hapus</h5>
          <button
            type="button"
            class="btn-close"
            @click="showDeleteModal = false"
          ></button>
        </div>
        <div class="modal-body text-center">
          <div class="mb-3">
            <i
              class="ri-error-warning-line text-warning"
              style="font-size: 4rem"
            ></i>
          </div>
          <h5 class="mb-2">Apakah Anda yakin?</h5>
          <p class="text-muted mb-0">
            Anda akan menghapus user
            <strong>{{ currentDeleteItem?.name }}</strong
            >. Tindakan ini tidak dapat dibatalkan.
          </p>
        </div>
        <div class="modal-footer justify-content-center">
          <button
            type="button"
            class="btn btn-secondary"
            @click="showDeleteModal = false"
          >
            Batal
          </button>
          <button type="button" class="btn btn-danger" @click="deleteUser">
            <i class="ri-delete-bin-line me-1"></i>Hapus
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style></style>
