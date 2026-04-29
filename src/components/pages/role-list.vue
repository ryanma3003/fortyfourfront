<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { roleService, type Role } from "../../services/role.service";
import { usersService } from "../../services/users.service";
import { casbinService, type CasbinPermission, type CasbinPolicy } from "../../services/casbin.service";
import type { User } from "../../types/user.types";

const dataToPass = {
  title: { label: "Dashboards", path: "/dashboard" },
  currentpage: "Role List",
  activepage: "Role List",
};

const items = ref<Role[]>([]);
const users = ref<User[]>([]);
const permissions = ref<CasbinPermission[]>([]);
const policies = ref<CasbinPolicy[]>([]);
const loading = ref(true);
const permissionLoading = ref(false);
const savingPermissions = ref(false);
const searchQuery = ref("");
const sortField = ref<"name">("name");
const sortOrder = ref<"asc" | "desc">("asc");
const currentPage = ref(1);
const itemsPerPage = ref(10);

const showToast = ref(false);
const toastMessage = ref("");
const toastType = ref<"success" | "error">("success");

const showPermissionModal = ref(false);
const selectedRole = ref<Role | null>(null);
const selectedPermissionKeys = ref<string[]>([]);
const quickAddPermissionKey = ref("");
const manualObj = ref("");
const manualAct = ref("");
const manualLabel = ref("");
const manualGroup = ref("");


const showNotification = (message: string, type: "success" | "error" = "success") => {
  toastMessage.value = message;
  toastType.value = type;
  showToast.value = true;
  window.setTimeout(() => {
    showToast.value = false;
  }, 3200);
};

const normalizePermissionKey = (obj: string, act: string) => `${obj}::${act}`;

const filteredData = computed(() => {
  let data = items.value;
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    data = data.filter((role) =>
      role.name.toLowerCase().includes(q) ||
      (role.description || "").toLowerCase().includes(q)
    );
  }

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

const userStats = computed(() => {
  const total = users.value.length;
  const admin = users.value.filter((u) => {
    const r = (u.role || u.role_name)?.toLowerCase();
    return r === "admin";
  }).length;
  const staff = users.value.filter((u) => {
    const r = (u.role || u.role_name)?.toLowerCase();
    return r === "staff";
  }).length;
  const standardUser = users.value.filter((u) => {
    const r = (u.role || u.role_name)?.toLowerCase();
    return r === "user";
  }).length;
  const userPic = users.value.filter((u) => {
    const r = (u.role || u.role_name)?.toLowerCase();
    return r === "user_pic" || r === "pic";
  }).length;

  return { total, admin, staff, user: standardUser, userPic };
});

const paginationInfo = computed(() => {
  const start = filteredData.value.length ? (currentPage.value - 1) * itemsPerPage.value + 1 : 0;
  const end = Math.min(currentPage.value * itemsPerPage.value, filteredData.value.length);
  return `Showing ${start}-${end} of ${filteredData.value.length} roles`;
});

const getRoleColorClass = (name: string) => {
  const n = name?.toLowerCase();
  if (n === "admin") return "avatar-premium-red";
  if (n === "staff") return "avatar-premium-green";
  if (n === "user_pic" || n === "pic") return "avatar-premium-orange";
  if (n === "user") return "avatar-premium-sky";
  return "avatar-premium-indigo";
};

const getRoleIcon = (name: string) => {
  const n = name?.toLowerCase();
  if (n === "admin") return "ri-shield-star-line";
  if (n === "staff") return "ri-briefcase-line";
  return "ri-user-line";
};

const getRoleType = (name: string) => {
  const n = name?.toLowerCase();
  if (n === "admin" || n === "staff") return "Admin Role";
  return "User Role";
};

const rolePolicyMap = computed(() => {
  const map = new Map<string, CasbinPolicy[]>();
  for (const policy of policies.value) {
    const key = policy.sub.toLowerCase();
    const bucket = map.get(key) || [];
    bucket.push(policy);
    map.set(key, bucket);
  }
  return map;
});

const rolePermissionCount = (roleName: string) =>
  rolePolicyMap.value.get(roleName.toLowerCase())?.length || 0;

const groupedPermissions = computed(() => {
  const groups = new Map<string, CasbinPermission[]>();
  for (const permission of permissions.value) {
    const key = permission.group || permission.obj || "General";
    const bucket = groups.get(key) || [];
    bucket.push(permission);
    groups.set(key, bucket);
  }

  return [...groups.entries()]
    .map(([group, items]) => ({
      group,
      items: [...items].sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.group.localeCompare(b.group));
});

const selectedRolePolicies = computed(() => {
  if (!selectedRole.value) return [];
  return rolePolicyMap.value.get(selectedRole.value.name.toLowerCase()) || [];
});

const availableQuickAddPermissions = computed(() =>
  permissions.value.filter(
    (permission) =>
      !selectedPermissionKeys.value.includes(normalizePermissionKey(permission.obj, permission.act))
  )
);

const syncSelectedPermissionsFromPolicies = (roleName: string) => {
  selectedPermissionKeys.value = (rolePolicyMap.value.get(roleName.toLowerCase()) || []).map((policy) =>
    normalizePermissionKey(policy.obj, policy.act)
  );
  quickAddPermissionKey.value = "";
};

const loadRoles = async () => {
  loading.value = true;
  try {
    const [rolesData, usersData, policiesData] = await Promise.all([
      roleService.getAll(),
      usersService.getAll(),
      casbinService.getPolicies(),
    ]);
    items.value = rolesData;
    users.value = usersData;
    policies.value = policiesData;
  } catch (error) {
    console.error("Failed to load role page data:", error);
    items.value = [];
    users.value = [];
    permissions.value = [];
    policies.value = [];
    showNotification("Gagal memuat data role dan permission.", "error");
  } finally {
    loading.value = false;
  }
};

const reloadPolicies = async () => {
  const latestPolicies = await casbinService.getPolicies();
  policies.value = latestPolicies;
  if (selectedRole.value) {
    syncSelectedPermissionsFromPolicies(selectedRole.value.name);
  }
};

const openPermissionModal = async (role: Role) => {
  selectedRole.value = role;
  showPermissionModal.value = true;
  permissionLoading.value = true;

  try {
    // Backend requires role parameter even for getting permission list
    permissions.value = await casbinService.getPermissions(role.name); 
    await reloadPolicies();
  } catch (error) {
    console.error("Failed to load permissions:", error);
    selectedPermissionKeys.value = [];
    showNotification("Gagal memuat permission role.", "error");
  } finally {
    permissionLoading.value = false;
  }
};

const closePermissionModal = () => {
  showPermissionModal.value = false;
  selectedRole.value = null;
  selectedPermissionKeys.value = [];
  quickAddPermissionKey.value = "";
  manualObj.value = "";
  manualAct.value = "";
  manualLabel.value = "";
  manualGroup.value = "";
};

const addManualPermission = async () => {
  if (!selectedRole.value || !manualObj.value.trim() || !manualAct.value.trim()) {
    showNotification("Objek dan Aksi wajib diisi.", "error");
    return;
  }

  savingPermissions.value = true;
  try {
    await casbinService.addPolicy({
      sub: selectedRole.value.name,
      obj: manualObj.value.trim(),
      act: manualAct.value.trim(),
      label: manualLabel.value.trim(),
      group: manualGroup.value.trim(),
    });
    
    // Reset inputs
    manualObj.value = "";
    manualAct.value = "";
    manualLabel.value = "";
    manualGroup.value = "";
    
    // Refresh data
    await Promise.all([
      reloadPolicies(),
      casbinService.getPermissions(selectedRole.value.name).then(data => permissions.value = data)
    ]);
    
    showNotification("Permission kustom berhasil ditambahkan.", "success");
  } catch (error) {
    console.error("Failed to add manual permission:", error);
    showNotification("Gagal menambahkan permission.", "error");
  } finally {
    savingPermissions.value = false;
  }
};


const addSinglePermission = async () => {
  if (!selectedRole.value || !quickAddPermissionKey.value) return;
  const permission = permissions.value.find(
    (item) => normalizePermissionKey(item.obj, item.act) === quickAddPermissionKey.value
  );
  if (!permission) return;

  savingPermissions.value = true;
  try {
    await casbinService.addPolicy({
      sub: selectedRole.value.name,
      obj: permission.obj,
      act: permission.act,
    });
    await reloadPolicies();
    quickAddPermissionKey.value = "";
    showNotification("Permission berhasil ditambahkan.", "success");
  } catch (error) {
    console.error("Failed to add permission:", error);
    showNotification("Gagal menambahkan permission.", "error");
  } finally {
    savingPermissions.value = false;
  }
};

const saveRolePermissions = async () => {
  if (!selectedRole.value) return;

  savingPermissions.value = true;
  try {
    const payload = selectedPermissionKeys.value
      .map((key) => {
        const [obj, act] = key.split("::");
        return obj && act ? { obj, act } : null;
      })
      .filter(Boolean) as Array<{ obj: string; act: string }>;

    await casbinService.bulkUpsertPolicies(selectedRole.value.name, payload);
    await reloadPolicies();
    showNotification("Permission role berhasil diperbarui.", "success");
  } catch (error) {
    console.error("Failed to save role permissions:", error);
    showNotification("Gagal menyimpan permission role.", "error");
  } finally {
    savingPermissions.value = false;
  }
};

const handleRemovePermission = async (obj: string, act: string) => {
  if (!selectedRole.value) return;
  
  if (!confirm(`Hapus permission ${obj}.${act} untuk role ${selectedRole.value.name}?`)) {
    return;
  }

  savingPermissions.value = true;
  try {
    await casbinService.removePolicy({
      sub: selectedRole.value.name,
      obj,
      act
    });
    
    await Promise.all([
      reloadPolicies(),
      casbinService.getPermissions(selectedRole.value.name).then(data => permissions.value = data)
    ]);
    
    showNotification("Permission berhasil dihapus.", "success");
  } catch (error) {
    console.error("Failed to remove permission:", error);
    showNotification("Gagal menghapus permission.", "error");
  } finally {
    savingPermissions.value = false;
  }
};

const clearSearch = () => {
  searchQuery.value = "";
};

const toggleSort = (field: "name") => {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    sortField.value = field;
    sortOrder.value = "asc";
  }
};

watch([searchQuery, itemsPerPage], () => {
  currentPage.value = 1;
});

watch(totalPages, (pageCount) => {
  if (currentPage.value > pageCount) {
    currentPage.value = pageCount;
  }
});

onMounted(loadRoles);
</script>

<template>
  <Pageheader :propData="dataToPass" />

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
      <div class="card custom-card gradient-header-card stakeholders-shell-card" style="overflow: visible !important;">
        <div class="stakeholder-header stakeholders-premium-header">
          <div class="stakeholders-header-main d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div class="stakeholders-hero-copy1 d-flex flex-column gap-1">
              <div>
                <div class="stakeholders-inline-breadcrumb">Dashboards <span>/</span> Role List</div>
                <div class="card-title mb-0 fw-bold header-card-title stakeholders-hero-title">Manajemen Role</div>
                <div class="header-subtitle mt-1 stakeholders-hero-subtitle">Kelola tingkatan akses dan permission di tiap role</div>
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

            <div class="stakeholders-hero-tools">
              <div class="stakeholders-search position-relative">
                <i class="ri-search-line header-search-icon"></i>
                <input
                  v-model="searchQuery"
                  type="text"
                  class="form-control form-control-sm header-search-input"
                  placeholder="Cari nama role atau deskripsi..."
                />
                <button v-if="searchQuery" @click="clearSearch" class="clear-btn" title="Clear search">
                  <i class="ri-close-circle-fill"></i>
                </button>
              </div>
            </div>
          </div>

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
                  <th class="th-no" style="width: 60px;">No</th>
                  <th class="sortable fw-semibold" @click="toggleSort('name')" style="cursor: pointer;">
                    <div class="d-flex align-items-center gap-2">
                      <span>Nama Role</span>
                      <i :class="sortField === 'name' ? (sortOrder === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line') : 'ri-expand-up-down-line'" class="fs-14 opacity-50"></i>
                    </div>
                  </th>
                  <th>Deskripsi</th>
                  <th class="text-center">Status Akses</th>
                  <th class="text-center">Permission</th>
                  <th class="text-center" style="width: 120px;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="6" class="p-0">
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

                <tr v-else-if="!displayData.length">
                  <td colspan="6" class="text-center py-5">
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
                      {{ role.description || "-" }}
                    </td>
                    <td class="align-middle text-center">
                      <span class="badge-sektor" :class="role.name?.toLowerCase() === 'admin' ? 'badge-sektor-teal' : 'badge-sektor-amber'">
                        {{ role.name?.toLowerCase() === 'admin' ? 'Full Access' : 'Limited Access' }}
                      </span>
                    </td>
                    <td class="align-middle text-center">
                      <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 rounded-pill fw-semibold">
                        {{ rolePermissionCount(role.name) }} permission
                      </span>
                    </td>
                    <td class="align-middle text-center">
                      <button class="btn btn-sm btn-primary-light rounded-pill px-3" @click="openPermissionModal(role)">
                        <i class="ri-shield-keyhole-line me-1"></i> Edit
                      </button>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <div class="pagination-container stakeholders-pagination mt-4">
            <div class="stakeholders-pagination-copy">
              {{ paginationInfo }}
            </div>
            <div class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
              <span class="stakeholders-page-pill">Page {{ currentPage }} of {{ totalPages }}</span>
              <nav v-if="totalPages > 1">
                <ul class="pagination pagination-sm mb-0 gap-1">
                  <li class="page-item" :class="{ disabled: currentPage === 1 }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = 1"><i class="ri-skip-back-mini-line"></i></a>
                  </li>
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
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = totalPages"><i class="ri-skip-forward-mini-line"></i></a>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="showPermissionModal" class="modal-overlay" @click.self="closePermissionModal">
      <div
        class="modal-dialog modal-dialog-centered permission-modal"
        style="width: min(84vw, 860px); max-width: 860px; margin: 1rem auto;"
      >
        <div class="modal-content permission-modal-content border-0 shadow-lg overflow-hidden" style="border-radius: 24px; background: #fff; width: 100%; max-width: none;">
          <div class="modal-header-premium permission-modal-header p-4 d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-3 permission-modal-header-main">
              <div class="header-icon-box bg-white bg-opacity-20 rounded-3 d-flex align-items-center justify-content-center shadow-sm permission-modal-icon-box">
                <i class="ri-shield-keyhole-line fs-24 text-white"></i>
              </div>
              <div class="permission-modal-header-copy">
                <div class="permission-modal-kicker">Manajemen Akses Role</div>
                <h4 class="mb-1 fw-bold tracking-tight text-white">Edit Permission Role</h4>
                <p class="mb-0 fs-13 text-white text-opacity-80 d-flex flex-wrap gap-2 align-items-center">
                  <span class="permission-modal-meta-pill">Role: <strong>{{ selectedRole?.name || "-" }}</strong></span>
                  <span class="permission-modal-meta-pill">{{ selectedRolePolicies.length }} permission aktif</span>
                </p>
              </div>
            </div>
            <button type="button" class="btn permission-modal-close-btn" @click="closePermissionModal">
              <i class="ri-close-line"></i>
            </button>
          </div>

          <div class="modal-body p-0 permission-modal-scroll-body">
            <div v-if="permissionLoading" class="text-center py-5 px-4">
              <div class="spinner-border text-primary mb-3" role="status"></div>
              <div class="text-muted">Memuat permission role...</div>
            </div>

            <div v-else class="p-4 permission-modal-body">
              <div class="permission-toolbar-card">
                <div class="permission-toolbar">
                  <div class="permission-toolbar-copy">
                    <h6 class="mb-1">Permission Tersedia</h6>
                    <p class="text-muted mb-0 fs-13">Centang untuk mengganti permission role, atau tambah cepat lewat dropdown.</p>
                  </div>
                  <div class="permission-toolbar-actions d-flex flex-column gap-3 w-100">
                    <div class="d-flex gap-2 w-100">
                      <select v-model="quickAddPermissionKey" class="form-select flex-grow-1">
                        <option value="">Pilih permission dari daftar</option>
                        <option
                          v-for="permission in availableQuickAddPermissions"
                          :key="permission.id"
                          :value="normalizePermissionKey(permission.obj, permission.act)"
                        >
                          {{ permission.label }} ({{ permission.obj }}.{{ permission.act }})
                        </option>
                      </select>
                      <button class="btn btn-outline-primary px-4" :disabled="!quickAddPermissionKey || savingPermissions" @click="addSinglePermission">
                        <span v-if="savingPermissions" class="spinner-border spinner-border-sm me-1"></span>
                        Tambah
                      </button>
                    </div>

                    <div class="manual-permission-entry p-3 border rounded-3 bg-light bg-opacity-50">
                      <div class="d-flex align-items-center gap-2 mb-2">
                        <i class="ri-edit-2-line text-primary"></i>
                        <span class="fw-bold fs-12 text-uppercase text-muted">Atau Tambah Manual</span>
                      </div>
                      <div class="d-flex flex-wrap gap-2">
                        <div class="flex-grow-1 min-width-150">
                          <label class="fs-10 fw-bold text-muted mb-1 d-block">Label / Deskripsi</label>
                          <input v-model="manualLabel" type="text" class="form-control form-control-sm" placeholder="e.g. Lihat Dashboard" />
                        </div>
                        <div class="flex-grow-1 min-width-150">
                          <label class="fs-10 fw-bold text-muted mb-1 d-block">Object / Resource</label>
                          <input v-model="manualObj" type="text" class="form-control form-control-sm" placeholder="e.g. dashboard" />
                        </div>
                        <div class="flex-grow-1 min-width-150">
                          <label class="fs-10 fw-bold text-muted mb-1 d-block">Action</label>
                          <input v-model="manualAct" type="text" class="form-control form-control-sm" placeholder="e.g. read" />
                        </div>
                        <div class="flex-grow-1 min-width-150">
                          <label class="fs-10 fw-bold text-muted mb-1 d-block">Group / Module</label>
                          <input v-model="manualGroup" type="text" class="form-control form-control-sm" placeholder="e.g. Analytics" />
                        </div>
                        <div class="d-flex align-items-end">
                          <button class="btn btn-primary btn-sm px-4" style="height: 31px;" :disabled="!manualObj || !manualAct || savingPermissions" @click="addManualPermission">
                            Simpan
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="permission-table-shell">
                  <div class="table-responsive permission-table-wrap">
                    <table class="table align-middle mb-0 permission-table">
                      <thead>
                        <tr>
                          <th style="width: 80px;" class="text-center">Pilih</th>
                          <th>Permission</th>
                          <th>Object</th>
                          <th>Action</th>
                          <th>Group</th>
                          <th style="width: 80px;" class="text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        <template v-if="groupedPermissions.length">
                          <template v-for="group in groupedPermissions" :key="group.group">
                            <tr class="permission-group-row">
                              <td colspan="6">{{ group.group }}</td>
                            </tr>
                            <tr v-for="permission in group.items" :key="permission.id">
                              <td class="text-center">
                                <input
                                  v-model="selectedPermissionKeys"
                                  class="form-check-input permission-checkbox"
                                  type="checkbox"
                                  :value="normalizePermissionKey(permission.obj, permission.act)"
                                />
                              </td>
                              <td>
                                <div class="fw-semibold">{{ permission.label }}</div>
                              </td>
                              <td><code>{{ permission.obj }}</code></td>
                              <td><span class="badge bg-light text-dark border text-uppercase">{{ permission.act }}</span></td>
                              <td class="text-muted">{{ permission.group }}</td>
                              <td class="text-center">
                                <button 
                                  v-if="selectedPermissionKeys.includes(normalizePermissionKey(permission.obj, permission.act))"
                                  class="btn btn-sm btn-danger-light rounded-circle"
                                  style="width: 30px; height: 30px; padding: 0;"
                                  @click="handleRemovePermission(permission.obj, permission.act)"
                                  title="Hapus permission"
                                >
                                  <i class="ri-delete-bin-line"></i>
                                </button>
                              </td>
                            </tr>
                          </template>
                        </template>
                        <tr v-else>
                          <td colspan="6" class="text-center py-4 text-muted">Belum ada daftar permission dari endpoint Casbin.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer-premium permission-modal-footer p-4 d-flex gap-3">
            <button type="button" class="btn btn-primary-light rounded-pill px-4 fw-bold" @click="closePermissionModal">
              Tutup
            </button>
            <div class="ms-auto d-flex gap-3 permission-footer-actions">
              <button class="btn btn-primary rounded-pill px-4 fw-bold" :disabled="permissionLoading || savingPermissions" @click="saveRolePermissions">
                <span v-if="savingPermissions" class="spinner-border spinner-border-sm me-1"></span>
                Simpan Permission
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
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
  padding: 20px;
}

.permission-modal {
  width: min(84vw, 860px);
  max-width: 860px;
}

.permission-modal-content {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 2rem);
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.24) !important;
}

.permission-modal-scroll-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.permission-modal-scroll-body::-webkit-scrollbar {
  width: 8px;
}

.permission-modal-scroll-body::-webkit-scrollbar-track {
  background: transparent;
}

.permission-modal-scroll-body::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.45);
  border-radius: 999px;
}

.permission-modal-header {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #fff;
  gap: 1rem;
}

.permission-modal-header-main {
  min-width: 0;
  flex: 1;
}

.permission-modal-header-copy {
  min-width: 0;
}

.permission-modal-icon-box {
  width: 48px;
  height: 48px;
}

.permission-modal-kicker {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
  margin-bottom: 0.25rem;
}

.permission-modal-meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(8px);
}

.permission-modal-close-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.24);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  transition: all 0.2s ease;
}

.permission-modal-close-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  transform: rotate(90deg);
}

.permission-modal-close-btn i {
  font-size: 20px;
  line-height: 1;
}

.permission-modal-body {
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}

.permission-modal-footer {
  position: sticky;
  bottom: 0;
  z-index: 2;
  flex-shrink: 0;
  border-top: 1px solid #e5edf6;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.permission-toolbar-card {
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid #dbe7f5;
  border-radius: 20px;
  padding: 1.25rem;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
}

.permission-toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.permission-toolbar-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  min-width: min(420px, 100%);
}

.permission-toolbar-actions .form-select {
  min-width: 260px;
  flex: 1 1 260px;
}

.permission-table-shell {
  margin-top: 1rem;
  border: 1px solid #dbe7f5;
  border-radius: 18px;
  overflow: hidden;
  background: #fff;
}

.permission-table-wrap {
  max-height: min(48vh, 460px);
  overflow: auto;
  overscroll-behavior: contain;
}

.permission-table-wrap::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.permission-table-wrap::-webkit-scrollbar-track {
  background: transparent;
}

.permission-table-wrap::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.55);
  border-radius: 999px;
}

.permission-table thead th {
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #475569;
  position: sticky;
  top: 0;
  z-index: 1;
}

.permission-group-row td {
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.permission-checkbox {
  width: 18px;
  height: 18px;
}

.permission-footer-actions {
  margin-left: auto;
}

[data-theme-mode='dark'] .permission-modal-footer,
[data-theme-mode='dark'] .permission-toolbar-card,
[data-theme-mode='dark'] .permission-table-shell,
[data-theme-mode='dark'] .permission-table thead th,
[data-theme-mode='dark'] .permission-table-wrap {
  border-color: rgba(255, 255, 255, 0.08) !important;
}

[data-theme-mode='dark'] .permission-modal-body,
[data-theme-mode='dark'] .permission-toolbar-card,
[data-theme-mode='dark'] .permission-table-shell {
  background: #0f172a !important;
}

[data-theme-mode='dark'] .permission-table thead th {
  background: rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
}

[data-theme-mode='dark'] .permission-group-row td {
  background: rgba(59, 130, 246, 0.14);
  color: #93c5fd;
}

[data-theme-mode='dark'] .permission-table tbody tr td,
[data-theme-mode='dark'] .permission-modal-body {
  color: #e2e8f0;
}

[data-theme-mode='dark'] .permission-toolbar-copy p,
[data-theme-mode='dark'] .permission-toolbar-copy h6,
[data-theme-mode='dark'] .permission-modal-body .text-muted {
  color: #94a3b8 !important;
}

[data-theme-mode='dark'] .btn-primary-light {
  background: rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
  border-color: rgba(255, 255, 255, 0.08);
}

@media (max-width: 991.98px) {
  .permission-modal {
    width: 96%;
    max-width: 96%;
  }
}

@media (max-width: 767.98px) {
  .modal-overlay {
    padding: 12px;
    align-items: flex-start;
    overflow-y: auto;
  }

  .permission-modal {
    width: min(94vw, 94vw);
    max-width: 94vw;
  }

  .permission-modal-content {
    max-height: calc(100vh - 1.3rem);
  }

  .permission-modal-header {
    align-items: flex-start !important;
    gap: 0.75rem;
    padding: 1rem !important;
  }

  .permission-modal-icon-box {
    width: 40px;
    height: 40px;
  }

  .permission-modal-kicker {
    font-size: 0.62rem;
    margin-bottom: 0.15rem;
  }

  .permission-modal-header-copy h4 {
    font-size: 0.98rem;
    line-height: 1.2;
  }

  .permission-modal-meta-pill {
    width: calc(50% - 0.25rem);
    min-width: 0;
    justify-content: flex-start;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .permission-modal-close-btn {
    flex-shrink: 0;
    width: 34px;
    height: 34px;
  }

  .permission-modal-body,
  .permission-modal-footer {
    padding-left: 1rem !important;
    padding-right: 1rem !important;
  }

  .permission-toolbar-card {
    padding: 1rem;
  }

  .permission-toolbar-actions {
    min-width: 100%;
  }

  .permission-table-wrap {
    max-height: min(36vh, 320px);
  }

  .permission-footer-actions {
    width: 100%;
    margin-left: 0 !important;
  }

  .permission-footer-actions .btn,
  .permission-modal-footer > .btn {
    width: 100%;
    justify-content: center;
    min-height: 46px;
  }

  .permission-modal-footer {
    flex-direction: column;
    padding-top: 1rem !important;
    padding-bottom: 1rem !important;
    box-shadow: 0 -10px 24px rgba(15, 23, 42, 0.08);
  }
}
</style>

