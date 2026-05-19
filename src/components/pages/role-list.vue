<script lang="ts">
import type { Role as CachedRole } from "../../services/role.service";
import type { CasbinPolicy as CachedCasbinPolicy } from "../../services/casbin.service";
import type { User as CachedUser } from "../../types/user.types";

type RolePageCachedData = {
  roles: CachedRole[];
  users: CachedUser[];
  policies: CachedCasbinPolicy[];
  loadedAt: number;
};

let rolePageCache: RolePageCachedData | null = null;
let rolePageCachePromise: Promise<RolePageCachedData> | null = null;
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import gsap from "gsap";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { roleService, type Role } from "../../services/role.service";
import { usersService } from "../../services/users.service";
import { casbinService, type CasbinPermission, type CasbinPolicy } from "../../services/casbin.service";
import type { User } from "../../types/user.types";

type RoleRow = Role & {
  rowNumber: number;
  normalizedName: string;
  colorClass: string;
  iconClass: string;
  roleType: string;
  accessLabel: string;
  accessClass: string;
  permissionCount: number;
};

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
const searchDraft = ref("");
const searchQuery = ref("");
const sortField = ref<"name">("name");
const sortOrder = ref<"asc" | "desc">("asc");
const currentPage = ref(1);
const itemsPerPage = ref(10);
const rolePageRoot = ref<HTMLElement | null>(null);
const roleSearchInput = ref<HTMLInputElement | null>(null);
let roleGsapContext: gsap.Context | null = null;
const pageHasEntered = ref(false);
let toastTimeout: ReturnType<typeof setTimeout> | undefined;
let searchDebounceTimeout: ReturnType<typeof setTimeout> | undefined;
let rowAnimationFrame = 0;

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
  if (toastTimeout) window.clearTimeout(toastTimeout);
  toastMessage.value = message;
  toastType.value = type;
  showToast.value = true;
  toastTimeout = window.setTimeout(() => {
    showToast.value = false;
    toastTimeout = undefined;
  }, 3200);
};

const normalizePermissionKey = (obj: string, act: string) => `${obj}::${act}`;

const roleSearchIndex = computed(() =>
  items.value.map((role) => ({
    role,
    searchText: `${role.name} ${role.description || ""}`.toLowerCase(),
  }))
);

const filteredData = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const data = q
    ? roleSearchIndex.value.filter((entry) => entry.searchText.includes(q)).map((entry) => entry.role)
    : items.value;

  return [...data].sort((a, b) => {
    const mod = sortOrder.value === "asc" ? 1 : -1;
    return a[sortField.value].localeCompare(b[sortField.value], "id", { sensitivity: "base" }) * mod;
  });
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / itemsPerPage.value)));

const displayData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return filteredData.value.slice(start, start + itemsPerPage.value);
});

const userStats = computed(() => {
  const total = users.value.length;
  let admin = 0, staff = 0, user = 0, userPic = 0;
  for (const u of users.value) {
    const r = (u.role || u.role_name)?.toLowerCase();
    if (r === "admin") admin++;
    else if (r === "staff") staff++;
    else if (r === "user") user++;
    else if (r === "user_pic" || r === "pic") userPic++;
  }

  return { total, admin, staff, user, userPic };
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

const rolePermissionCounts = computed(() => {
  const map = new Map<string, number>();
  for (const policy of policies.value) {
    const key = policy.sub.toLowerCase();
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
});

const rolePermissionCount = (roleName: string) =>
  rolePermissionCounts.value.get(roleName.toLowerCase()) || 0;

const displayRows = computed<RoleRow[]>(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return displayData.value.map((role, i) => {
    const normalizedName = role.name?.toLowerCase() || "";
    const isAdmin = normalizedName === "admin";
    return {
      ...role,
      rowNumber: start + i + 1,
      normalizedName,
      colorClass: getRoleColorClass(role.name),
      iconClass: getRoleIcon(role.name),
      roleType: getRoleType(role.name),
      accessLabel: isAdmin ? "Full Access" : "Limited Access",
      accessClass: isAdmin ? "badge-sektor-teal" : "badge-sektor-amber",
      permissionCount: rolePermissionCount(role.name),
    };
  });
});

const visiblePaginationPages = computed(() => {
  const pages: Array<number | "..."> = [];
  for (let page = 1; page <= totalPages.value; page++) {
    if (page === 1 || page === totalPages.value || (page >= currentPage.value - 1 && page <= currentPage.value + 1)) {
      pages.push(page);
    } else if (page === currentPage.value - 2 || page === currentPage.value + 2) {
      pages.push("...");
    }
  }
  return pages;
});

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

const selectedPermissionKeySet = computed(() => new Set(selectedPermissionKeys.value));

const availableQuickAddPermissions = computed(() =>
  permissions.value.filter((permission) => !selectedPermissionKeySet.value.has(normalizePermissionKey(permission.obj, permission.act)))
);

const syncSelectedPermissionsFromPolicies = (roleName: string) => {
  selectedPermissionKeys.value = (rolePolicyMap.value.get(roleName.toLowerCase()) || []).map((policy) =>
    normalizePermissionKey(policy.obj, policy.act)
  );
  quickAddPermissionKey.value = "";
};

const applyRolePageData = (data: RolePageCachedData) => {
  items.value = data.roles;
  users.value = data.users;
  policies.value = data.policies;
};

const fetchRolePageData = () => {
  if (!rolePageCachePromise) {
    rolePageCachePromise = (async () => {
      const [rolesData, usersData, policiesData] = await Promise.all([
        roleService.getAll(),
        usersService.getAll(),
        casbinService.getPolicies(),
      ]);

      rolePageCache = {
        roles: rolesData,
        users: usersData,
        policies: policiesData,
        loadedAt: Date.now(),
      };

      return rolePageCache;
    })().finally(() => {
      rolePageCachePromise = null;
    });
  }

  return rolePageCachePromise;
};

const hydrateRolePageFromCache = () => {
  if (!rolePageCache) return false;
  applyRolePageData(rolePageCache);
  loading.value = false;
  return true;
};

const loadRoles = async (showLoader = true) => {
  const hasCachedData = Boolean(rolePageCache);
  if (showLoader) {
    loading.value = true;
  }

  try {
    const freshData = await fetchRolePageData();
    applyRolePageData(freshData);
  } catch (error) {
    console.error("Failed to load role page data:", error);
    if (!hasCachedData) {
      items.value = [];
      users.value = [];
      permissions.value = [];
      policies.value = [];
    }
    showNotification("Gagal memuat data role dan permission.", "error");
  } finally {
    loading.value = false;
  }
};

const reloadPolicies = async () => {
  const latestPolicies = await casbinService.getPolicies();
  policies.value = latestPolicies;
  if (rolePageCache) {
    rolePageCache = {
      ...rolePageCache,
      policies: latestPolicies,
      loadedAt: Date.now(),
    };
  }
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
  searchDraft.value = "";
  searchQuery.value = "";
  if (searchDebounceTimeout) {
    window.clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = undefined;
  }
  currentPage.value = 1;
  nextTick(() => roleSearchInput.value?.focus());
};

const focusRoleSearch = () => {
  roleSearchInput.value?.focus();
};

const goToPage = (page: number) => {
  const nextPage = Math.min(Math.max(page, 1), totalPages.value);
  if (nextPage !== currentPage.value) {
    currentPage.value = nextPage;
  }
};

const toggleSort = (field: "name") => {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    sortField.value = field;
    sortOrder.value = "asc";
  }
  currentPage.value = 1;
};

const shouldReduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const runEntranceAnimations = () => {
  nextTick(() => {
    const root = rolePageRoot.value;
    if (!root || shouldReduceMotion()) return;

    roleGsapContext?.revert();
    roleGsapContext = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".role-breadcrumb", { y: -10, opacity: 0, duration: 0.45 })
        .from(".role-hero-title", { y: 22, opacity: 0, duration: 0.58 }, "-=0.2")
        .from(".role-hero-desc", { y: 16, opacity: 0, duration: 0.5 }, "-=0.32")
        .from(".role-hero-summary", { opacity: 0, duration: 0.62, ease: "power3.out" }, "-=0.34")
        .from(".role-stat-card", {
        y: 18,
        opacity: 0,
        scale: 0.94,
        duration: 0.42,
        stagger: 0.08,
        ease: "back.out(1.4)",
      }).from(".role-toolbar-card, .role-table-card", {
        y: 26,
        opacity: 0,
        duration: 0.55,
      }, "-=0.18");
    }, root);
  });
};



const animateRows = (quick = false) => {
  if (rowAnimationFrame) {
    window.cancelAnimationFrame(rowAnimationFrame);
  }

  nextTick(() => {
    rowAnimationFrame = window.requestAnimationFrame(() => {
      rowAnimationFrame = 0;
      const root = rolePageRoot.value;
      if (!root || shouldReduceMotion()) return;

      const rows = Array.from(root.querySelectorAll<HTMLElement>(".stakeholder-row"));
      if (!rows.length) return;

      gsap.killTweensOf(rows);
      gsap.set(rows, { y: quick ? 10 : 16, opacity: 0, scale: quick ? 0.995 : 0.99, force3D: true });
      gsap.to(rows, {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: quick ? 0.28 : 0.36,
        ease: "power2.out",
        stagger: quick ? 0.035 : 0.045,
        overwrite: "auto",
        clearProps: "transform,opacity",
      });
    });
  });
};

const animateHover = (
  event: Event,
  active: boolean,
  type: "card" | "row" = "card"
) => {
  if (shouldReduceMotion()) return;
  const target = event.currentTarget as HTMLElement | null;
  if (!target) return;

  const icon = target.querySelector<HTMLElement>(".role-stat-icon, .company-avatar");
  const values = {
    card: { y: -5, scale: 1.018, duration: 0.2 },
    row: { y: -1, scale: 1.002, duration: 0.16 },
  }[type];

  gsap.to(target, {
    y: active ? values.y : 0,
    scale: active ? values.scale : 1,
    duration: values.duration,
    ease: active ? "power2.out" : "power2.inOut",
    overwrite: "auto",
  });

  if (icon) {
    gsap.to(icon, {
      rotate: active ? (type === "row" ? 0 : -2) : 0,
      scale: active ? 1.08 : 1,
      duration: values.duration,
      ease: "power2.out",
      overwrite: "auto",
    });
  }
};

watch(searchDraft, (value) => {
  if (searchDebounceTimeout) window.clearTimeout(searchDebounceTimeout);
  searchDebounceTimeout = window.setTimeout(() => {
    searchQuery.value = value;
    searchDebounceTimeout = undefined;
  }, 140);
});

watch(itemsPerPage, () => {
  currentPage.value = 1;
});

watch(searchQuery, () => {
  currentPage.value = 1;
});

watch(totalPages, (pageCount) => {
  if (currentPage.value > pageCount) {
    currentPage.value = pageCount;
  }
});

watch([displayData, loading], (newVals, oldVals) => {
  if (!pageHasEntered.value || loading.value) return;
  
  const wasLoading = oldVals ? oldVals[1] : false;
  const isNowLoading = newVals[1];
  const quick = !(wasLoading && !isNowLoading);
  
  animateRows(quick);
}, { flush: "post" });

onMounted(() => {
  runEntranceAnimations();
  
  const hasCachedData = hydrateRolePageFromCache();
  if (hasCachedData) {
    void loadRoles(false);
    animateRows();
  } else {
    void loadRoles();
  }
  
  pageHasEntered.value = true;
});

onUnmounted(() => {
  roleGsapContext?.revert();
  roleGsapContext = null;
  if (toastTimeout) window.clearTimeout(toastTimeout);
  if (searchDebounceTimeout) window.clearTimeout(searchDebounceTimeout);
  if (rowAnimationFrame) window.cancelAnimationFrame(rowAnimationFrame);
});
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

  <div ref="rolePageRoot" class="role-page-shell">
    <section class="role-hero-card">
      <div class="role-hero-copy">
        <div class="role-breadcrumb">Dashboards <span>/</span> Role List</div>
        <h2 class="role-hero-title">Manajemen Role</h2>
        <p class="role-hero-desc">Kelola akses, permission, dan cakupan pengguna dalam tampilan yang ringkas.</p>
      </div>
      <div class="role-hero-summary">
        <span class="role-summary-kicker">Role Aktif</span>
        <strong>{{ filteredData.length }}</strong>
        <span>dari {{ items.length }} role</span>
      </div>
    </section>

    <section class="role-stats-grid">
      <div
        class="role-stat-card role-stat-total"
        @mouseenter="animateHover($event, true, 'card')"
        @mouseleave="animateHover($event, false, 'card')"
      >
        <span class="role-stat-icon"><i class="ri-team-line"></i></span>
        <div>
          <span class="role-stat-label">Total Users</span>
          <strong>{{ userStats.total }}</strong>
        </div>
      </div>
      <div
        class="role-stat-card role-stat-admin"
        @mouseenter="animateHover($event, true, 'card')"
        @mouseleave="animateHover($event, false, 'card')"
      >
        <span class="role-stat-icon"><i class="ri-shield-star-line"></i></span>
        <div>
          <span class="role-stat-label">Admin</span>
          <strong>{{ userStats.admin }}</strong>
        </div>
      </div>
      <div
        class="role-stat-card role-stat-staff"
        @mouseenter="animateHover($event, true, 'card')"
        @mouseleave="animateHover($event, false, 'card')"
      >
        <span class="role-stat-icon"><i class="ri-briefcase-line"></i></span>
        <div>
          <span class="role-stat-label">Staff</span>
          <strong>{{ userStats.staff }}</strong>
        </div>
      </div>
      <div
        class="role-stat-card role-stat-pic"
        @mouseenter="animateHover($event, true, 'card')"
        @mouseleave="animateHover($event, false, 'card')"
      >
        <span class="role-stat-icon"><i class="ri-user-settings-line"></i></span>
        <div>
          <span class="role-stat-label">User / PIC</span>
          <strong>{{ userStats.userPic }}</strong>
        </div>
      </div>
      <div
        class="role-stat-card role-stat-user"
        @mouseenter="animateHover($event, true, 'card')"
        @mouseleave="animateHover($event, false, 'card')"
      >
        <span class="role-stat-icon"><i class="ri-user-line"></i></span>
        <div>
          <span class="role-stat-label">User</span>
          <strong>{{ userStats.user }}</strong>
        </div>
      </div>
    </section>

    <section class="role-toolbar-card users-toolbar-card">
      <div class="users-toolbar-left">
        <div class="stakeholders-search role-search users-toolbar-search position-relative" @click="focusRoleSearch">
          <i class="ri-search-line header-search-icon"></i>
          <input
            ref="roleSearchInput"
            v-model="searchDraft"
            type="text"
            class="form-control form-control-sm header-search-input"
            placeholder="Cari nama role atau deskripsi..."
            autocomplete="off"
            @click.stop
            @keydown.stop
          />
          <button v-if="searchDraft" @click="clearSearch" class="clear-btn" title="Clear search">
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
                      <button v-if="searchDraft || searchQuery" @click="clearSearch" class="btn btn-sm btn-primary-light rounded-pill px-4">
                        <i class="ri-refresh-line me-1"></i> Reset Pencarian
                      </button>
                    </div>
                  </td>
                </tr>

                <template v-else>
                  <tr
                    v-for="role in displayRows"
                    :key="role.id"
                    class="stakeholder-row"
                    @mouseenter="animateHover($event, true, 'row')"
                    @mouseleave="animateHover($event, false, 'row')"
                  >
                    <td class="align-middle text-center">
                      <span class="row-number">{{ role.rowNumber }}</span>
                    </td>
                    <td class="align-middle">
                      <div class="stakeholder-company-cell">
                        <div class="company-avatar" :class="role.colorClass">
                          <span class="company-avatar-letter">
                            <i :class="role.iconClass" class="fs-16"></i>
                          </span>
                        </div>
                        <div class="company-name-wrap">
                          <span class="company-name d-block fw-bold">{{ role.name }}</span>
                          <span class="text-muted fs-11 text-uppercase letter-spacing-1">{{ role.roleType }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="align-middle text-muted fs-13">
                      {{ role.description || "-" }}
                    </td>
                    <td class="align-middle text-center">
                      <span class="badge-sektor" :class="role.accessClass">
                        {{ role.accessLabel }}
                      </span>
                    </td>
                    <td class="align-middle text-center">
                      <span class="role-permission-badge">
                        {{ role.permissionCount }} permission
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

        <div class="pagination-container stakeholders-pagination">
          <div class="stakeholders-pagination-copy">
            {{ paginationInfo }}
          </div>
          <div class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
            <span class="stakeholders-page-pill">Page {{ currentPage }} of {{ totalPages }}</span>
            <nav v-if="totalPages > 1">
              <ul class="pagination pagination-sm mb-0 gap-1">
                <li class="page-item" :class="{ disabled: currentPage === 1 }">
                  <a class="page-link rounded-circle" href="#" @click.prevent="goToPage(1)"><i class="ri-skip-back-mini-line"></i></a>
                </li>
                <li class="page-item" :class="{ disabled: currentPage === 1 }">
                  <a class="page-link rounded-circle" href="#" @click.prevent="goToPage(currentPage - 1)"><i class="ri-arrow-left-s-line"></i></a>
                </li>
                <template v-for="(p, index) in visiblePaginationPages" :key="`${p}-${index}`">
                  <li v-if="p !== '...'" class="page-item" :class="{ active: p === currentPage }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="goToPage(Number(p))">{{ p }}</a>
                  </li>
                  <li v-else class="page-item disabled"><span class="page-link border-0 bg-transparent">...</span></li>
                </template>
                <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                  <a class="page-link rounded-circle" href="#" @click.prevent="goToPage(currentPage + 1)"><i class="ri-arrow-right-s-line"></i></a>
                </li>
                <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                  <a class="page-link rounded-circle" href="#" @click.prevent="goToPage(totalPages)"><i class="ri-skip-forward-mini-line"></i></a>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </section>
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
                                  v-if="selectedPermissionKeySet.has(normalizePermissionKey(permission.obj, permission.act))"
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
.role-page-shell {
  display: grid;
  gap: 16px;
}

.role-hero-card {
  align-items: center;
  background: linear-gradient(135deg, #06184f 0%, #183b91 52%, #2f76ea 100%);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 18px;
  box-shadow: 0 18px 46px rgba(15, 23, 42, 0.16);
  display: flex;
  gap: 18px;
  justify-content: space-between;
  overflow: hidden;
  padding: 21px 26px;
  position: relative;
  transform-origin: center;
  will-change: transform;
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
  background: linear-gradient(90deg, rgba(96, 165, 250, 0.9), rgba(47, 118, 234, 0.72), rgba(255, 255, 255, 0));
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
  transform-origin: center;
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
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
  display: flex;
  gap: 13px;
  min-height: 86px;
  padding: 16px;
  overflow: hidden;
  position: relative;
  transform-origin: center;
  will-change: transform;
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
  background:
    linear-gradient(180deg, #fff, #fbfdff);
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
  position: relative;
  z-index: 3;
}

.role-search.users-toolbar-search {
  max-width: 360px;
  cursor: text;
}

.role-search .header-search-input {
  background: #f8fafc !important;
  border: 1px solid #dbe5f0 !important;
  border-radius: 999px !important;
  box-shadow: none !important;
  color: #0f172a !important;
  height: 42px;
  padding-left: 42px !important;
  padding-right: 42px !important;
  pointer-events: auto !important;
  position: relative;
  width: 100% !important;
  z-index: 1;
}

.role-search .header-search-input:focus {
  background: #fff !important;
  border-color: rgba(37, 99, 235, 0.48) !important;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08) !important;
}

.role-search .header-search-icon {
  color: #64748b;
  font-size: 16px;
  left: 16px;
  pointer-events: none;
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
  z-index: 4;
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
  background-color: #fff;
  border: 1px solid #dbe5f0;
  border-radius: 999px;
  color: #1e293b;
  font-size: 12px;
  font-weight: 850;
  height: 30px;
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

.role-table-card .stakeholder-table {
  margin-bottom: 0;
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

.role-table-card .th-no,
.role-table-card .stakeholder-row td:first-child,
.role-table-card .stakeholder-row:hover td:first-child {
  background: transparent !important;
  box-shadow: none !important;
}

.role-table-card .row-number {
  background: transparent !important;
}

.role-permission-badge {
  align-items: center;
  background: #dbeafe;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  color: #1d4ed8;
  display: inline-flex;
  font-size: 11px;
  font-weight: 850;
  justify-content: center;
  line-height: 1;
  min-height: 26px;
  min-width: 92px;
  padding: 0 14px;
  white-space: nowrap;
}

.role-table-card .stakeholder-row:hover td {
  background: #f8fbff !important;
}

.role-table-card .stakeholders-pagination {
  border-top: 1px solid #eef2f7;
  margin-top: 0 !important;
  padding: 16px 18px;
}

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

  .permission-modal {
    width: 96%;
    max-width: 96%;
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

  .users-toolbar-search,
  .users-toolbar-right,
  .role-search,
  .role-rows-selector {
    min-width: 0;
    width: 100%;
  }

  .users-toolbar-left,
  .users-toolbar-right,
  .role-search,
  .role-search.users-toolbar-search {
    flex: 0 0 auto;
  }

  .role-toolbar-card {
    gap: 10px;
    padding: 12px;
  }

  .role-search .header-search-input,
  .role-rows-selector {
    height: 42px;
    min-height: 42px;
  }

  .role-rows-selector {
    justify-content: space-between;
  }

  .role-table-card {
    border-radius: 14px;
  }

  .role-table-card .stakeholders-pagination {
    align-items: flex-start;
    flex-direction: column;
  }

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

<style>
html[data-theme-mode="dark"] .role-hero-card,
html.dark .role-hero-card,
.dark-mode .role-hero-card {
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(15, 42, 83, 0.9) 48%, rgba(30, 64, 175, 0.82)),
    radial-gradient(circle at 20% 16%, rgba(96, 165, 250, 0.26), transparent 32%) !important;
  border-color: rgba(96, 165, 250, 0.24) !important;
  box-shadow: 0 20px 54px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
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

html[data-theme-mode="dark"] .role-stat-card::after,
html.dark .role-stat-card::after,
.dark-mode .role-stat-card::after {
  opacity: 0.18;
}

html[data-theme-mode="dark"] .role-breadcrumb,
html.dark .role-breadcrumb,
.dark-mode .role-breadcrumb {
  color: rgba(219, 234, 254, 0.9) !important;
}

html[data-theme-mode="dark"] .role-breadcrumb span,
html.dark .role-breadcrumb span,
.dark-mode .role-breadcrumb span {
  color: rgba(219, 234, 254, 0.52) !important;
}

html[data-theme-mode="dark"] .role-hero-copy h2,
html.dark .role-hero-copy h2,
.dark-mode .role-hero-copy h2 {
  color: #fff !important;
}

html[data-theme-mode="dark"] .role-hero-copy p,
html.dark .role-hero-copy p,
.dark-mode .role-hero-copy p {
  color: rgba(239, 246, 255, 0.84) !important;
}

html[data-theme-mode="dark"] .role-hero-summary,
html.dark .role-hero-summary,
.dark-mode .role-hero-summary {
  background: rgba(255, 255, 255, 0.09) !important;
  border-color: rgba(255, 255, 255, 0.16) !important;
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
.dark-mode .role-rows-selector span,
html[data-theme-mode="dark"] .role-toolbar-copy strong,
html.dark .role-toolbar-copy strong,
.dark-mode .role-toolbar-copy strong {
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
.dark-mode .role-rows-selector .header-rows-select {
  background: rgba(17, 24, 39, 0.82) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
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

html[data-theme-mode="dark"] .role-permission-badge,
html.dark .role-permission-badge,
.dark-mode .role-permission-badge {
  background: rgba(37, 99, 235, 0.22) !important;
  border-color: rgba(96, 165, 250, 0.32) !important;
  color: #bfdbfe !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

html[data-theme-mode="dark"] .role-table-card .stakeholder-row:hover td,
html.dark .role-table-card .stakeholder-row:hover td,
.dark-mode .role-table-card .stakeholder-row:hover td {
  background: rgba(30, 41, 59, 0.72) !important;
}

html[data-theme-mode="dark"] .role-table-card .th-no,
html.dark .role-table-card .th-no,
.dark-mode .role-table-card .th-no,
html[data-theme-mode="dark"] .role-table-card .stakeholder-row td:first-child,
html.dark .role-table-card .stakeholder-row td:first-child,
.dark-mode .role-table-card .stakeholder-row td:first-child,
html[data-theme-mode="dark"] .role-table-card .stakeholder-row:hover td:first-child,
html.dark .role-table-card .stakeholder-row:hover td:first-child,
.dark-mode .role-table-card .stakeholder-row:hover td:first-child {
  box-shadow: none !important;
}

html[data-theme-mode="dark"] .role-table-card .stakeholders-pagination,
html.dark .role-table-card .stakeholders-pagination,
.dark-mode .role-table-card .stakeholders-pagination {
  background: rgba(15, 23, 42, 0.94) !important;
  border-top-color: rgba(148, 163, 184, 0.16) !important;
}

html[data-theme-mode="dark"] .permission-modal-content,
html.dark .permission-modal-content,
body[data-theme-mode="dark"] .permission-modal-content,
.dark-mode .permission-modal-content {
  background: #0f172a !important;
  border: 1px solid rgba(148, 163, 184, 0.18) !important;
  box-shadow: 0 32px 88px rgba(0, 0, 0, 0.48) !important;
}

html[data-theme-mode="dark"] .permission-modal-header,
html.dark .permission-modal-header,
body[data-theme-mode="dark"] .permission-modal-header,
.dark-mode .permission-modal-header {
  background:
    radial-gradient(circle at 8% 10%, rgba(96, 165, 250, 0.22), transparent 28%),
    linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%) !important;
  color: #ffffff !important;
}

html[data-theme-mode="dark"] .permission-modal-header .text-white,
html.dark .permission-modal-header .text-white,
body[data-theme-mode="dark"] .permission-modal-header .text-white,
.dark-mode .permission-modal-header .text-white,
html[data-theme-mode="dark"] .permission-modal-header h4,
html.dark .permission-modal-header h4,
body[data-theme-mode="dark"] .permission-modal-header h4,
.dark-mode .permission-modal-header h4 {
  color: #ffffff !important;
}

html[data-theme-mode="dark"] .permission-modal-body,
html.dark .permission-modal-body,
body[data-theme-mode="dark"] .permission-modal-body,
.dark-mode .permission-modal-body,
html[data-theme-mode="dark"] .permission-modal-scroll-body,
html.dark .permission-modal-scroll-body,
body[data-theme-mode="dark"] .permission-modal-scroll-body,
.dark-mode .permission-modal-scroll-body {
  background: #0f172a !important;
  color: #e5edf7 !important;
}

html[data-theme-mode="dark"] .permission-modal-footer,
html.dark .permission-modal-footer,
body[data-theme-mode="dark"] .permission-modal-footer,
.dark-mode .permission-modal-footer {
  background: #111827 !important;
  border-top-color: rgba(148, 163, 184, 0.18) !important;
}

html[data-theme-mode="dark"] .permission-toolbar-card,
html.dark .permission-toolbar-card,
body[data-theme-mode="dark"] .permission-toolbar-card,
.dark-mode .permission-toolbar-card,
html[data-theme-mode="dark"] .manual-permission-entry,
html.dark .manual-permission-entry,
body[data-theme-mode="dark"] .manual-permission-entry,
.dark-mode .manual-permission-entry,
html[data-theme-mode="dark"] .permission-table-shell,
html.dark .permission-table-shell,
body[data-theme-mode="dark"] .permission-table-shell,
.dark-mode .permission-table-shell {
  background: #111827 !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
  box-shadow: none !important;
  color: #e5edf7 !important;
}

html[data-theme-mode="dark"] .permission-toolbar-copy h6,
html.dark .permission-toolbar-copy h6,
body[data-theme-mode="dark"] .permission-toolbar-copy h6,
.dark-mode .permission-toolbar-copy h6,
html[data-theme-mode="dark"] .permission-table .fw-semibold,
html.dark .permission-table .fw-semibold,
body[data-theme-mode="dark"] .permission-table .fw-semibold,
.dark-mode .permission-table .fw-semibold {
  color: #e5edf7 !important;
}

html[data-theme-mode="dark"] .permission-toolbar-copy p,
html.dark .permission-toolbar-copy p,
body[data-theme-mode="dark"] .permission-toolbar-copy p,
.dark-mode .permission-toolbar-copy p,
html[data-theme-mode="dark"] .permission-modal-body .text-muted,
html.dark .permission-modal-body .text-muted,
body[data-theme-mode="dark"] .permission-modal-body .text-muted,
.dark-mode .permission-modal-body .text-muted,
html[data-theme-mode="dark"] .manual-permission-entry label,
html.dark .manual-permission-entry label,
body[data-theme-mode="dark"] .manual-permission-entry label,
.dark-mode .manual-permission-entry label {
  color: #9fb0c5 !important;
}

html[data-theme-mode="dark"] .permission-modal .form-select,
html.dark .permission-modal .form-select,
body[data-theme-mode="dark"] .permission-modal .form-select,
.dark-mode .permission-modal .form-select,
html[data-theme-mode="dark"] .permission-modal .form-control,
html.dark .permission-modal .form-control,
body[data-theme-mode="dark"] .permission-modal .form-control,
.dark-mode .permission-modal .form-control {
  background-color: #0b1220 !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
  color: #e5edf7 !important;
}

html[data-theme-mode="dark"] .permission-modal .form-control::placeholder,
html.dark .permission-modal .form-control::placeholder,
body[data-theme-mode="dark"] .permission-modal .form-control::placeholder,
.dark-mode .permission-modal .form-control::placeholder {
  color: #7b8ca5 !important;
}

html[data-theme-mode="dark"] .permission-modal .form-select option,
html.dark .permission-modal .form-select option,
body[data-theme-mode="dark"] .permission-modal .form-select option,
.dark-mode .permission-modal .form-select option {
  background: #111827 !important;
  color: #e5edf7 !important;
}

html[data-theme-mode="dark"] .permission-table,
html.dark .permission-table,
body[data-theme-mode="dark"] .permission-table,
.dark-mode .permission-table {
  color: #dbe7f3 !important;
}

html[data-theme-mode="dark"] .permission-table thead th,
html.dark .permission-table thead th,
body[data-theme-mode="dark"] .permission-table thead th,
.dark-mode .permission-table thead th {
  background: #1e2d40 !important;
  border-bottom-color: rgba(148, 163, 184, 0.22) !important;
  color: #dbe7f3 !important;
}

html[data-theme-mode="dark"] .permission-table tbody tr td,
html.dark .permission-table tbody tr td,
body[data-theme-mode="dark"] .permission-table tbody tr td,
.dark-mode .permission-table tbody tr td {
  background: #111827 !important;
  border-color: rgba(148, 163, 184, 0.14) !important;
  color: #dbe7f3 !important;
}

html[data-theme-mode="dark"] .permission-table tbody tr:not(.permission-group-row):hover td,
html.dark .permission-table tbody tr:not(.permission-group-row):hover td,
body[data-theme-mode="dark"] .permission-table tbody tr:not(.permission-group-row):hover td,
.dark-mode .permission-table tbody tr:not(.permission-group-row):hover td {
  background: #172235 !important;
}

html[data-theme-mode="dark"] .permission-group-row td,
html.dark .permission-group-row td,
body[data-theme-mode="dark"] .permission-group-row td,
.dark-mode .permission-group-row td {
  background: #1a3154 !important;
  color: #bfdbfe !important;
  border-color: rgba(191, 219, 254, 0.2) !important;
}

html[data-theme-mode="dark"] .permission-table code,
html.dark .permission-table code,
body[data-theme-mode="dark"] .permission-table code,
.dark-mode .permission-table code {
  color: #f472b6 !important;
}

html[data-theme-mode="dark"] .permission-table .badge.bg-light,
html.dark .permission-table .badge.bg-light,
body[data-theme-mode="dark"] .permission-table .badge.bg-light,
.dark-mode .permission-table .badge.bg-light {
  background: rgba(148, 163, 184, 0.12) !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
  color: #dbe7f3 !important;
}

html[data-theme-mode="dark"] .permission-modal-close-btn,
html.dark .permission-modal-close-btn,
body[data-theme-mode="dark"] .permission-modal-close-btn,
.dark-mode .permission-modal-close-btn {
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: rgba(255, 255, 255, 0.28) !important;
  color: #ffffff !important;
}

html[data-theme-mode="dark"] .permission-modal-footer .btn-primary-light,
html.dark .permission-modal-footer .btn-primary-light,
body[data-theme-mode="dark"] .permission-modal-footer .btn-primary-light,
.dark-mode .permission-modal-footer .btn-primary-light {
  background: rgba(148, 163, 184, 0.1) !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
  color: #dbe7f3 !important;
}

html[data-theme-mode="dark"] .permission-modal-footer .btn-primary-light:hover,
html.dark .permission-modal-footer .btn-primary-light:hover,
body[data-theme-mode="dark"] .permission-modal-footer .btn-primary-light:hover,
.dark-mode .permission-modal-footer .btn-primary-light:hover {
  background: rgba(37, 99, 235, 0.18) !important;
  border-color: rgba(96, 165, 250, 0.34) !important;
  color: #ffffff !important;
}
</style>
