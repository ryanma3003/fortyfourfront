<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { roleService, type Role } from "../../services/role.service";

const dataToPass = {
  title: { label: "Dashboards", path: "/dashboard" },
  currentpage: "Role List",
  activepage: "Role List",
};

// State
const items       = ref<Role[]>([]);
const loading     = ref(false);
const searchQuery = ref("");
const sortField   = ref<"name">("name");
const sortOrder   = ref<"asc" | "desc">("asc");
const currentPage = ref(1);
const itemsPerPage = ref(10);

// Filtered + sorted
const filteredData = computed(() => {
  let data = items.value;
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    data = data.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.description?.toLowerCase().includes(q) ?? false)
    );
  }
  return [...data].sort((a, b) => {
    const mod = sortOrder.value === "asc" ? 1 : -1;
    return a[sortField.value].localeCompare(b[sortField.value]) * mod;
  });
});

const totalPages = computed(() => Math.ceil(filteredData.value.length / itemsPerPage.value));

const displayData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return filteredData.value.slice(start, start + itemsPerPage.value);
});

const paginationInfo = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value + 1;
  const end   = Math.min(currentPage.value * itemsPerPage.value, filteredData.value.length);
  return `${start} - ${end} dari ${filteredData.value.length} role`;
});

const getRoleColor = (name: string) => {
  const n = name?.toLowerCase();
  if (n === "admin")  return "avatar-red";
  if (n === "staff")  return "avatar-blue";
  if (n === "user")   return "avatar-teal";
  return "avatar-violet";
};

const getRoleIcon = (name: string) => {
  const n = name?.toLowerCase();
  if (n === "admin")  return "ri-shield-star-line";
  if (n === "staff")  return "ri-briefcase-line";
  return "ri-user-line";
};

const loadRoles = async () => {
  loading.value = true;
  try {
    items.value = await roleService.getAll();
  } catch (e) {
    console.error("Failed to load roles:", e);
    items.value = [];
  } finally {
    loading.value = false;
  }
};

const toggleSort = (field: "name") => {
  if (sortField.value === field) sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  else { sortField.value = field; sortOrder.value = "asc"; }
};

const clearSearch = () => { searchQuery.value = ""; currentPage.value = 1; };

watch([searchQuery, itemsPerPage], () => (currentPage.value = 1));
onMounted(loadRoles);
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card gradient-header-card">

        <!-- Header -->
        <div class="card-header d-flex align-items-center justify-content-between gap-3 users-header">
          <div class="d-flex align-items-center gap-3">
            <div class="header-icon-box">
              <i class="ri-shield-keyhole-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">Daftar Role</div>
              <div class="header-subtitle mt-1">Manajemen role &amp; hak akses sistem</div>
            </div>
          </div>
          <div class="search-container position-relative">
            <i class="ri-search-line card-search-icon"></i>
            <input v-model="searchQuery" type="text" class="form-control form-control-sm header-search-input"
              placeholder="Cari nama atau deskripsi role..." />
            <button v-if="searchQuery" @click="clearSearch" class="clear-btn">
              <i class="ri-close-circle-fill"></i>
            </button>
          </div>
        </div>

        <div class="card-body p-4">

          <!-- Skeleton -->
          <div v-if="loading" class="skeleton-loading p-4">
            <div class="skeleton-row" v-for="n in 5" :key="n">
              <div class="skel skel-no"></div>
              <div class="skel skel-avatar"></div>
              <div class="skel skel-name"></div>
              <div class="skel skel-email"></div>
            </div>
          </div>

          <template v-else>
            <!-- Stats Strip -->
            <div class="stats-strip mb-4">
              <div class="stat-card">
                <div class="stat-icon stat-icon-blue"><i class="ri-shield-keyhole-line"></i></div>
                <div>
                  <div class="stat-value">{{ items.length }}</div>
                  <div class="stat-label">Total Role</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-violet"><i class="ri-shield-star-line"></i></div>
                <div>
                  <div class="stat-value">{{ items.filter(r => r.name?.toLowerCase() === 'admin').length }}</div>
                  <div class="stat-label">Admin</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-teal"><i class="ri-user-line"></i></div>
                <div>
                  <div class="stat-value">{{ items.filter(r => r.name?.toLowerCase() !== 'admin').length }}</div>
                  <div class="stat-label">Non-Admin</div>
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
                    <th class="sortable fw-semibold">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-shield-star-line text-primary"></i>
                        <span class="column-label" @click="toggleSort('name')">Nama Role</span>
                        <div class="sort-arrows">
                          <i class="ri-arrow-up-s-line"   :class="{ active: sortField === 'name' && sortOrder === 'asc'  }" @click.stop="sortField='name'; sortOrder='asc';"></i>
                          <i class="ri-arrow-down-s-line" :class="{ active: sortField === 'name' && sortOrder === 'desc' }" @click.stop="sortField='name'; sortOrder='desc';"></i>
                        </div>
                      </div>
                    </th>
                    <th class="fw-semibold">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-file-text-line text-primary"></i>
                        <span>Deskripsi</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <!-- Empty state -->
                  <tr v-if="!displayData.length">
                    <td colspan="3" class="text-center py-5">
                      <div class="empty-state">
                        <div class="empty-icon-ring mb-3">
                          <div class="empty-icon-inner">
                            <i class="ri-shield-keyhole-line"></i>
                          </div>
                        </div>
                        <h6 class="fw-semibold mb-1 empty-state-title">Tidak Ada Role</h6>
                        <p class="text-muted fs-13 mb-3">Coba ubah kata kunci pencarian Anda</p>
                        <button v-if="searchQuery" @click="clearSearch" class="btn btn-sm btn-outline-primary rounded-pill px-4">
                          <i class="ri-refresh-line me-1"></i>Reset Pencarian
                        </button>
                      </div>
                    </td>
                  </tr>

                  <!-- Rows -->
                  <tr v-for="(role, i) in displayData" :key="role.id" class="users-row">
                    <td class="align-middle text-center">
                      <span class="row-number">{{ (currentPage - 1) * itemsPerPage + i + 1 }}</span>
                    </td>
                    <td class="align-middle">
                      <div class="d-flex align-items-center gap-3">
                        <div class="company-avatar" :class="getRoleColor(role.name)">
                          <span class="company-avatar-letter">
                            <i :class="getRoleIcon(role.name)" style="font-size:1rem;"></i>
                          </span>
                        </div>
                        <span class="company-name">{{ role.name }}</span>
                      </div>
                    </td>
                    <td class="align-middle">
                      <span class="text-muted fs-13">{{ role.description || '-' }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="d-flex flex-wrap justify-content-between align-items-center mt-4 gap-3">
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-light text-muted px-3 py-2">
                  <i class="ri-file-list-3-line me-1"></i>{{ paginationInfo }}
                </span>
              </div>
              <nav>
                <ul class="pagination pagination-sm mb-0 gap-1">
                  <li class="page-item" :class="{ disabled: currentPage === 1 }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = 1"><i class="ri-skip-back-mini-line"></i></a>
                  </li>
                  <li class="page-item" :class="{ disabled: currentPage === 1 }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage--"><i class="ri-arrow-left-s-line"></i></a>
                  </li>
                  <template v-for="p in totalPages" :key="p">
                    <li v-if="p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)"
                      class="page-item" :class="{ active: p === currentPage }">
                      <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = p">{{ p }}</a>
                    </li>
                    <li v-else-if="p === currentPage - 2 || p === currentPage + 2" class="page-item disabled">
                      <span class="page-link border-0 bg-transparent">...</span>
                    </li>
                  </template>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage++"><i class="ri-arrow-right-s-line"></i></a>
                  </li>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = totalPages"><i class="ri-skip-forward-mini-line"></i></a>
                  </li>
                </ul>
              </nav>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

