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

      // Load profile data from storage
      profileStore.loadFromStorage();

      // Get current logged-in user info
      const currentUser = authStore.currentUser;

      // Map users and merge dynamic jabatan for current user
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
      <div class="card custom-card">
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div class="card-title">User List</div>
          <div class="d-flex gap-2 align-items-center flex-wrap flex-grow-1">
            <div class="search-container position-relative ms-auto" style="max-width: 350px; flex: 1">
              <input v-model="searchQuery" type="text" class="form-control form-control-sm" placeholder="Search by name, email, jabatan, or role" />
              <i v-if="!searchQuery" class="ri-search-line search-icon"></i>
              <button v-else @click="clearSearch" class="btn btn-sm clear-btn">
                <i class="ri-close-line"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="card-body p-3">
          <div v-if="loading" class="text-center p-4">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>

          <template v-else>
            <!-- Controls -->
            <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
              <div class="d-flex align-items-center flex-wrap flex-grow-1 gap-2">
                <span class="text-muted fs-13">Show</span>
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
                <span class="text-muted fs-13">per page</span>
              </div>
            </div>

            <!-- Table -->
            <div class="table-responsive">
              <table class="table text-nowrap mb-0">
                <thead>
                  <tr>
                    <th>No</th>
                    <th class="sortable">
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
                    <th>Email</th>
                    <th>Position</th>
                    <th class="sortable">
                      <div class="d-flex align-items-center gap-1">
                        <span
                          class="column-label"
                          @click="toggleSort('role')"
                          title="Click to toggle sort"
                          >Role</span
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
                    <th class="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!displayData.length">
                    <td colspan="6" class="text-center text-muted py-4">
                      <i class="ri-inbox-line fs-2 d-block mb-2"></i>
                      Data not found
                    </td>
                  </tr>
                  <tr v-for="(item, i) in displayData" :key="item.id">
                    <td>{{ (currentPage - 1) * itemsPerPage + i + 1 }}</td>
                    <td class="fw-semibold">{{ item.name }}</td>
                    <td>{{ item.username }}</td>
                    <td>{{ item.jabatan }}</td>
                    <td>
                      <span
                        :class="['badge fs-13', getStatusClass(item.role)]"
                        >{{ item.role }}</span
                      >
                    </td>
                    <td class="text-center">
                      <div
                        class="btn-group-vertical btn-group-sm d-inline-flex gap-1"
                      >
                        <div class="d-flex gap-1">
                          <router-link
                            :to="`/profile-user/${item.slug}`"
                            class="btn btn-sm btn-info-light"
                            title="Lihat Profil"
                          >
                            <i class="ri-eye-line"></i>
                          </router-link>
                          <!-- <button
                            @click="openEditModal(item)"
                            class="btn btn-sm btn-success-light"
                            title="Edit Role"
                          >
                            <i class="ri-edit-line"></i>
                          </button> -->
                          <button
                            @click="openDeleteModal(item)"
                            class="btn btn-sm btn-danger-light"
                            title="Delete"
                          >
                            <i class="ri-delete-bin-line"></i>
                          </button>
                        </div>
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
              <span class="text-muted fs-13">
                Page {{ currentPage }} of {{ totalPages }}
              </span>
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
  <!-- <div
    v-if="showEditModal"
    class="modal fade show d-block"
    tabindex="-1"
    style="background-color: rgba(0, 0, 0, 0.5)"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Edit User</h5>
          <button
            type="button"
            class="btn-close"
            @click="showEditModal = false"
          ></button>
        </div>
        <div class="modal-body" v-if="currentEditItem">
          <div class="mb-3">
            <label class="form-label">Nama</label>
            <input
              type="text"
              class="form-control"
              :value="currentEditItem.name"
              disabled
            />
          </div>
          <div class="mb-3">
            <label class="form-label">Email</label>
            <input
              type="text"
              class="form-control"
              :value="currentEditItem.username"
              disabled
            />
          </div>
          <div class="mb-3">
            <label class="form-label"
              >Jabatan <span class="text-danger">*</span></label
            >
            <input
              v-model="formData.jabatan"
              type="text"
              class="form-control"
              placeholder="Masukkan jabatan"
            />
          </div>
          <div class="mb-3">
            <label class="form-label"
              >Role <span class="text-danger">*</span></label
            >
            <select v-model="formData.role" class="form-select">
              <option value="Admin">Admin</option>
              <option value="User">User</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            @click="showEditModal = false"
          >
            Batal
          </button>
          <button type="button" class="btn btn-primary" @click="updateUser">
            <i class="ri-save-line me-1"></i>Simpan
          </button>
        </div>
      </div>
    </div>
  </div> -->

  <!-- Delete Modal -->
  <div
    v-if="showDeleteModal"
    class="modal fade show d-block"
    tabindex="-1"
    style="background-color: rgba(0, 0, 0, 0.5)"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Hapus User</h5>
          <button
            type="button"
            class="btn-close"
            @click="showDeleteModal = false"
          ></button>
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

<style scoped>
.search-container .search-icon {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  pointer-events: none;
}

.search-container .clear-btn {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  padding: 0.15rem 0.35rem;
  color: #6c757d;
}

.search-container .clear-btn:hover {
  color: #dc3545;
}

.sortable .column-label {
  cursor: pointer;
}

.sortable .column-label:hover {
  color: var(--primary-color);
}

.sort-arrows {
  display: flex;
  flex-direction: column;
  line-height: 0.7;
  font-size: 14px;
}

.sort-arrows i {
  cursor: pointer;
  color: #adb5bd;
  transition: color 0.15s ease;
}

.sort-arrows i:hover {
  color: var(--primary-color);
}

.sort-arrows i.active {
  color: var(--primary-color);
}
</style>
