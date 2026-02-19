<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { Tooltip } from "bootstrap";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { roleService, type Role } from "../../services/role.service";

const dataToPass = {
  title: { label: "Dashboards", path: "/admin/dashboard" },
  currentpage: "Role List",
  activepage: "Role List",
};

// State
const items = ref<Role[]>([]);
const loading = ref(false);
const searchQuery = ref("");
const sortField = ref<"name">("name");
const sortOrder = ref<"asc" | "desc">("asc");
const currentPage = ref(1);
const itemsPerPage = ref(10);

// Filtered and sorted data
const filteredData = computed(() => {
  let data = items.value;

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim();
    data = data.filter((role) => 
      role.name.toLowerCase().includes(query) ||
      (role.description?.toLowerCase().includes(query) ?? false)
    );
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

// Load roles from API
const loadRoles = async () => {
  loading.value = true;
  try {
    const roles = await roleService.getAll();
    items.value = roles;
  } catch (error) {
    console.error('Failed to load roles:', error);
    items.value = [];
  } finally {
    loading.value = false;
  }
};

const toggleSort = (field: "name") => {
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

const initTooltips = () => {
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltipTriggerList.forEach((el) => new Tooltip(el));
};

watch([searchQuery, itemsPerPage], () => (currentPage.value = 1));

watch(displayData, () => {
  nextTick(() => initTooltips());
});

onMounted(() => loadRoles());
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card gradient-header-card">
        <!-- Card Header -->
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3" 
            style="background: radial-gradient(ellipse at top, #032a5c, #084696)">
          <div class="d-flex align-items-center">
            <i class="ri-shield-user-line me-2 fs-18" style="color: white !important;"></i>
            <div class="card-title mb-0" style="color: white !important;">Daftar Role</div>
          </div>
          <div class="d-flex gap-2 align-items-center flex-wrap">
            <div class="search-container position-relative" style="min-width: 300px">
              <input v-model="searchQuery" type="text" class="form-control form-control-sm" 
                placeholder="Cari role..." 
                style="background: #fff; color: #333; border: none; padding-right: 60px;" />
              <i class="ri-search-line search-icon" style="color: #666; right: 35px;"></i>
              <button v-if="searchQuery" @click="clearSearch" class="btn btn-sm clear-btn" style="color: #666;">
                <i class="ri-close-line"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Card Body -->
        <div class="card-body p-3">
          <!-- Loading State -->
          <div v-if="loading" class="text-center p-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="text-muted mt-2 mb-0">Memuat data...</p>
          </div>

          <template v-else>
            <!-- Controls Bar -->
            <div class="controls-bar d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom gap-2">
              <div class="d-flex align-items-center gap-2">
                <div class="d-flex align-items-center bg-light rounded-pill px-3 py-1">
                  <i class="ri-list-ordered me-2 text-primary"></i>
                  <span class="text-muted fs-13 me-2">Tampilkan</span>
                  <select v-model="itemsPerPage" class="form-select form-select-sm border-0 bg-transparent" style="width: 70px">
                    <option v-for="n in [5, 10, 15, 20, 25, 50]" :key="n" :value="n">{{ n }}</option>
                  </select>
                </div>
                <span class="badge bg-primary-transparent text-primary px-3 py-2">
                  <i class="ri-database-2-line me-1"></i>{{ displayData.length }} role
                </span>
              </div>
            </div>

            <!-- Data Table -->
            <div class="table-responsive rounded-3 border">
              <table class="table table-hover text-nowrap mb-0">
                <thead class="table-light">
                  <tr>
                    <th class="fw-semibold text-muted" style="width: 70px">No</th>
                    <!-- Role Name Column (Sortable) -->
                    <th class="sortable fw-semibold" style="width: 200px">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-shield-star-line text-primary"></i>
                        <span class="column-label" @click="toggleSort('name')" title="Click to toggle sort">Nama Role</span>
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
                    <th class="fw-semibold">
                      <div class="d-flex align-items-center gap-2">
                        <i class="ri-file-text-line text-primary"></i>
                        <span>Deskripsi</span>
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <!-- Empty State -->
                  <tr v-if="!displayData.length">
                    <td colspan="3" class="text-center py-5">
                      <div class="empty-state">
                        <div class="empty-icon mb-3">
                          <i class="ri-shield-keyhole-line"></i>
                        </div>
                        <h6 class="text-muted mb-1">No Roles Found</h6>
                        <p class="text-muted fs-13 mb-0">Try adjusting your search criteria</p>
                      </div>
                    </td>
                  </tr>

                  <!-- Role Rows -->
                  <tr v-for="(role, index) in displayData" :key="role.id">
                    <td class="align-middle py-3">
                      <span class="text-muted fw-medium">{{ (currentPage - 1) * itemsPerPage + index + 1 }}</span>
                    </td>
                    <td class="align-middle py-3">
                      <div class="d-flex align-items-center gap-2">
                        <span :class="['avatar avatar-sm avatar-rounded', role.name?.toLowerCase() === 'admin' ? 'bg-danger-transparent' : 'bg-info-transparent']">
                          <i :class="role.name?.toLowerCase() === 'admin' ? 'ri-shield-star-line text-danger' : 'ri-user-line text-info'"></i>
                        </span>
                        <span class="fw-semibold">{{ role.name }}</span>
                      </div>
                    </td>
                    <td class="align-middle py-3">
                      <span class="text-muted">{{ role.description || '-' }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="d-flex flex-wrap justify-content-between align-items-center mt-2 pt-2 border-top gap-2">
              <span class="text-muted fs-13">
                Halaman {{ currentPage }} dari {{ totalPages }}
              </span>
              <nav>
                <ul class="pagination pagination-sm mb-0">
                  <li class="page-item" :class="{ disabled: currentPage === 1 }">
                    <a class="page-link" href="#" @click.prevent="currentPage = 1">
                      <i class="ri-skip-back-mini-line"></i>
                    </a>
                  </li>
                  <li class="page-item" :class="{ disabled: currentPage === 1 }">
                    <a class="page-link" href="#" @click.prevent="currentPage--">
                      <i class="ri-arrow-left-s-line"></i>
                    </a>
                  </li>
                  <template v-for="p in totalPages" :key="p">
                    <li v-if="p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)"
                      class="page-item" :class="{ active: p === currentPage }">
                      <a class="page-link" href="#" @click.prevent="currentPage = p">{{ p }}</a>
                    </li>
                    <li v-else-if="p === currentPage - 2 || p === currentPage + 2" class="page-item disabled">
                      <span class="page-link">...</span>
                    </li>
                  </template>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                    <a class="page-link" href="#" @click.prevent="currentPage++">
                      <i class="ri-arrow-right-s-line"></i>
                    </a>
                  </li>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }">
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

.empty-state { padding: 2rem 1rem; }
.empty-state .empty-icon { width: 80px; height: 80px; margin: 0 auto; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(var(--primary-rgb),0.1), rgba(var(--secondary-rgb),0.1)); border-radius: 50%; }
.empty-state .empty-icon i { font-size: 2.5rem; color: var(--primary-color); opacity: 0.7; }

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
