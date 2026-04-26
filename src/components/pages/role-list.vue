<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { roleService, type Role } from "../../services/role.service";
import { usersService } from "../../services/users.service";
import type { User } from "../../types/user.types";

const dataToPass = {
  title: { label: "Dashboards", path: "/dashboard" },
  currentpage: "Role List",
  activepage: "Role List",
};

// State
const items       = ref<Role[]>([]);
const users       = ref<User[]>([]);
const loading     = ref(true);
const sortField   = ref<"name">("name");
const sortOrder   = ref<"asc" | "desc">("asc");
const currentPage = ref(1);
const itemsPerPage = ref(100);

// Filtered + sorted
const filteredData = computed(() => {
  let data = items.value;
  return [...data].sort((a, b) => {
    const mod = sortOrder.value === "asc" ? 1 : -1;
    return a[sortField.value].localeCompare(b[sortField.value]) * mod;
  });
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / itemsPerPage.value)));

const displayData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return filteredData.value.slice(start, start + itemsPerPage.value);
});

// User Counts for Header
const userStats = computed(() => {
  const total = users.value.length;
  const admin = users.value.filter(u => {
    const r = (u.role || u.role_name)?.toLowerCase();
    return r === 'admin';
  }).length;
  const staff = users.value.filter(u => {
    const r = (u.role || u.role_name)?.toLowerCase();
    return r === 'staff';
  }).length;
  const standardUser = users.value.filter(u => {
    const r = (u.role || u.role_name)?.toLowerCase();
    return r === 'user';
  }).length;
  const userPic = users.value.filter(u => {
    const r = (u.role || u.role_name)?.toLowerCase();
    return r === 'user_pic' || r === 'pic';
  }).length;
  
  return { total, admin, staff, user: standardUser, userPic };
});

const paginationInfo = computed(() => {
  const start = filteredData.value.length ? (currentPage.value - 1) * itemsPerPage.value + 1 : 0;
  const end   = Math.min(currentPage.value * itemsPerPage.value, filteredData.value.length);
  return `Showing ${start}-${end} of ${filteredData.value.length} roles`;
});

const getRoleColorClass = (name: string) => {
  const n = name?.toLowerCase();
  if (n === "admin") return "avatar-premium-red";
  if (n === "staff") return "avatar-premium-green";
  if (n === "user_pic" || n === "pic") return "avatar-premium-orange";
  if (n === "user")  return "avatar-premium-sky";
  return "avatar-premium-indigo";
};

const getRoleIcon = (name: string) => {
  const n = name?.toLowerCase();
  if (n === "admin")  return "ri-shield-star-line";
  if (n === "staff")  return "ri-briefcase-line";
  return "ri-user-line";
};

const getRoleType = (name: string) => {
  const n = name?.toLowerCase();
  if (n === 'admin' || n === 'staff') return 'Admin Role';
  return 'User Role';
};

const loadRoles = async () => {
  loading.value = true;
  try {
    const [rolesData, usersData] = await Promise.all([
      roleService.getAll(),
      usersService.getAll()
    ]);
    items.value = rolesData;
    users.value = usersData;
  } catch (e) {
    console.error("Failed to load data:", e);
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

watch([], () => (currentPage.value = 1));
onMounted(loadRoles);
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card gradient-header-card stakeholders-shell-card" style="overflow: visible !important;">
        
        <!-- Premium Header -->
        <div class="stakeholder-header stakeholders-premium-header">
          <div class="stakeholders-header-main d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div class="stakeholders-hero-copy1 d-flex flex-column gap-1">
              <div>
                <div class="stakeholders-inline-breadcrumb">Dashboards <span>/</span> Role List</div>
                <div class="card-title mb-0 fw-bold header-card-title stakeholders-hero-title">Manajemen Role</div>
                <div class="header-subtitle mt-1 stakeholders-hero-subtitle">Kelola tingkatan akses dan wewenang pengguna sistem</div>
              </div>
              <div class="stakeholders-meta-stack">
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Total Users</span>
                  <strong><i class="ri-team-line text-primary"></i> {{ userStats.total }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Admin</span>
                  <strong><i class="ri-shield-star-line text-danger"></i> {{ userStats.admin }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Staff</span>
                  <strong><i class="ri-shield-user-line text-success"></i> {{ userStats.staff }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">User / PIC</span>
                  <strong><i class="ri-user-settings-line text-warning"></i> {{ userStats.userPic }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">User</span>
                  <strong><i class="ri-user-line text-info"></i> {{ userStats.user }}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card-body p-4 stakeholders-premium-body">
          
          <!-- Table Container -->
          <div class="table-responsive stakeholder-table-wrap stakeholders-table-shell">
            <table class="table stakeholder-table mb-0">
              <thead class="stakeholder-thead">
                <tr>
                  <th class="th-no" style="width: 60px;">No</th>
                  <th class="sortable fw-semibold" @click="toggleSort('name')" style="cursor: pointer;">
                    <div class="d-flex align-items-center gap-2">
                      <span>Nama Role</span>
                      <i :class="sortField === 'name' ? (sortOrder === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line') : 'ri-expand-up-down-line'" class="fs-14 opacity-50"></i>
                    </div>
                  </th>
                  <th>Deskripsi</th>
                  <th class="text-center">Status Akses</th>
                </tr>
              </thead>
              <tbody>
                <!-- Skeleton Loader -->
                <tr v-if="loading">
                  <td colspan="4" class="p-0">
                    <div class="skeleton-table-body">
                      <div v-for="n in 5" :key="n" class="skeleton-row p-3 d-flex align-items-center gap-3 border-bottom">
                        <div class="skel skel-circle" style="width: 40px; height: 40px;"></div>
                        <div class="flex-grow-1">
                          <div class="skel mb-2" style="width: 30%; height: 16px;"></div>
                          <div class="skel" style="width: 60%; height: 12px;"></div>
                        </div>
                        <div class="skel" style="width: 100px; height: 24px; border-radius: 20px;"></div>
                      </div>
                    </div>
                  </td>
                </tr>

                <!-- Empty State -->
                <tr v-else-if="!displayData.length">
                  <td colspan="4" class="text-center py-5">
                    <div class="empty-state">
                      <div class="empty-icon-ring mb-3"><div class="empty-icon-inner"><i class="ri-shield-keyhole-line"></i></div></div>
                      <h6 class="fw-semibold mb-1 empty-state-title">Data Role Tidak Ditemukan</h6>
                      <p class="text-muted fs-13 mb-3">Tidak ada role yang sesuai dengan kriteria pencarian Anda.</p>
                      <button v-if="searchQuery" @click="clearSearch" class="btn btn-sm btn-primary-light rounded-pill px-4">
                        <i class="ri-refresh-line me-1"></i> Reset Pencarian
                      </button>
                    </div>
                  </td>
                </tr>

                <!-- Data Rows -->
                <template v-else>
                  <tr v-for="(role, i) in displayData" :key="role.id" class="stakeholder-row">
                    <td class="align-middle text-center">
                      <span class="row-number">{{ (currentPage - 1) * itemsPerPage + i + 1 }}</span>
                    </td>
                    <td class="align-middle">
                      <div class="stakeholder-company-cell">
                        <div class="company-avatar" :class="getRoleColorClass(role.name)">
                          <span class="company-avatar-letter">
                            <i :class="getRoleIcon(role.name)" class="fs-16"></i>
                          </span>
                        </div>
                        <div class="company-name-wrap">
                          <span class="company-name d-block fw-bold">{{ role.name }}</span>
                          <span class="text-muted fs-11 text-uppercase letter-spacing-1">{{ getRoleType(role.name) }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="align-middle text-muted fs-13">
                      {{ role.description || '-' }}
                    </td>
                    <td class="align-middle text-center">
                      <span class="badge-sektor" :class="role.name?.toLowerCase() === 'admin' ? 'badge-sektor-teal' : 'badge-sektor-amber'">
                        {{ role.name?.toLowerCase() === 'admin' ? 'Full Access' : 'Limited Access' }}
                      </span>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="pagination-container stakeholders-pagination mt-4">
            <div class="stakeholders-pagination-copy">
              {{ paginationInfo }}
            </div>
            <div class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
              <span class="stakeholders-page-pill">Page {{ currentPage }} of {{ totalPages }}</span>
              <nav v-if="totalPages > 1">
                <ul class="pagination pagination-sm mb-0 gap-1">
                  <li class="page-item" :class="{ disabled: currentPage === 1 }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage--"><i class="ri-arrow-left-s-line"></i></a>
                  </li>
                  <template v-for="p in totalPages" :key="p">
                    <li v-if="p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)" class="page-item" :class="{ active: p === currentPage }">
                      <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = p">{{ p }}</a>
                    </li>
                    <li v-else-if="p === currentPage - 2 || p === currentPage + 2" class="page-item disabled"><span class="page-link border-0 bg-transparent">...</span></li>
                  </template>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage++"><i class="ri-arrow-right-s-line"></i></a>
                  </li>
                </ul>
              </nav>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Skeleton Loading Animation */
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
.skeleton-row { opacity: 0.7; }

/* Custom Badge Adjustments */
.badge-sektor {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 50px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.letter-spacing-1 {
  letter-spacing: 0.05em;
}

/* Header Meta Stack Uniformity */
.stakeholders-meta-stack {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stakeholders-meta-card {
  flex: 1 1 0px; /* Force equal width */
  min-width: 130px; /* Prevent squashing on smaller screens */
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px 10px;
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
  font-size: 10px;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.842);
  margin-bottom: 6px;
  white-space: nowrap;
}

.stakeholders-meta-card strong {
  font-size: 22px;
  color: white;
  display: flex;
  align-items: center;
  gap: 8px;
}

.stakeholders-meta-card strong i {
  font-size: 20px;
}

/* Premium Avatar Styles with High Contrast (Fixing 'warna mati' issue) */
.company-avatar {
  width: 46px; /* Increased for better presence */
  height: 46px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.company-avatar i {
  font-size: 20px !important; /* Larger icons for 'alive' feel */
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Admin: Vibrant Red */
.avatar-premium-red { 
  background: rgba(220, 38, 38, 0.12) !important; 
  color: #dc2626 !important; 
  border: none !important; 
}
.avatar-premium-red i { color: #dc2626 !important; }

/* Staff: Vibrant Green */
.avatar-premium-green { 
  background: rgba(22, 163, 74, 0.12) !important; 
  color: #16a34a !important; 
  border: none !important; 
}
.avatar-premium-green i { color: #16a34a !important; }

/* User PIC: Vibrant Orange */
.avatar-premium-orange { 
  background: rgba(234, 88, 12, 0.12) !important; 
  color: #ea580c !important; 
  border: none !important; 
}
.avatar-premium-orange i { color: #ea580c !important; }

/* User: Vibrant Sky */
.avatar-premium-sky { 
  background: rgba(2, 132, 199, 0.12) !important; 
  color: #0284c7 !important; 
  border: none !important; 
}
.avatar-premium-sky i { color: #0284c7 !important; }

/* Other Roles: Vibrant Indigo */
.avatar-premium-indigo { 
  background: rgba(79, 70, 229, 0.12) !important; 
  color: #4f46e5 !important; 
  border: none !important; 
}
.avatar-premium-indigo i { color: #4f46e5 !important; }

/* Extra Glow on Hover - REMOVED for static look */


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

