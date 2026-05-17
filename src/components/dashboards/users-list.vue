<script lang="ts">
import { ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from "vue";
import gsap from "gsap";
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

const INACTIVE_STATUSES = new Set(["suspend", "suspended", "nonaktif", "inactive", "0", "false"]);
const FALLBACK_ROLE_OPTIONS = ["admin", "staff", "user_pic", "user"].map((name, index) => ({ id: -(index + 1), name }));
const ROLE_META: Record<string, { badge: string; icon: string }> = {
  admin: { badge: "badge-sektor-red", icon: "ri-shield-star-line" },
  staff: { badge: "badge-sektor-green", icon: "ri-shield-user-line" },
  user_pic: { badge: "badge-sektor-orange", icon: "ri-user-line" },
  pic: { badge: "badge-sektor-orange", icon: "ri-user-line" },
};
const PIC_ROLE_KEYS = new Set(["user_pic", "pic"]);
const NEW_ACCOUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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
    const usersPageRoot = ref<HTMLElement | null>(null);
    const searchInput = ref<HTMLInputElement | null>(null);
    const searchDraft = ref("");
    const reminderSearchDraft = ref("");
    const searchMode = ref<"user" | "company">("user");
    const activeUsersView = ref<"users" | "reminders">("users");
    const selectedPicCandidateIds = ref<Record<string, string>>({});
    const pageHasEntered = ref(false);
    let usersGsapContext: gsap.Context | null = null;
    let rowAnimationFrame = 0;
    let searchDebounceTimeout: ReturnType<typeof setTimeout> | undefined;

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
    const currentUserId = computed(() => String(authStore.currentUser?.id ?? ""));

    const getUserStatusText = (status?: string) => {
      const s = String(status || '').toLowerCase().trim();
      return INACTIVE_STATUSES.has(s) ? 'Nonaktif' : 'Aktif';
    };

    const getRoleBadgeClass = (role: string) => {
      const r = String(role || '').toLowerCase();
      return ROLE_META[r]?.badge || 'badge-sektor-sky';
    };

    const getRoleIcon = (role: string) => {
      const r = String(role || '').toLowerCase();
      return ROLE_META[r]?.icon || 'ri-user-line';
    };

    const normalizeRoleKey = (role?: string) => String(role || '').toLowerCase().trim();
    const isPicRole = (role?: string) => PIC_ROLE_KEYS.has(normalizeRoleKey(role));
    const getCompanyId = (record: any) =>
      String(record?.id_perusahaan || record?.perusahaan_id || record?.perusahaan?.id || '').trim();
    const getRawDisplayName = (record: any) =>
      record?.display_name || record?.name || record?.username || record?.email || 'User';
    const getCreatedValue = (record: any) =>
      record?.joined || record?.created_at || record?.createdAt || '';

    const parseDateMs = (value?: string) => {
      if (!value) return 0;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? 0 : time;
    };

    const formatCreatedLabel = (value?: string) => {
      const time = parseDateMs(value);
      if (!time) return 'Belum tersedia';
      const diff = Date.now() - time;
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      if (days <= 0) return 'Hari ini';
      if (days === 1) return 'Kemarin';
      if (days < 7) return `${days} hari lalu`;
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(time));
    };

    const formatCreatedTooltip = (value?: string) => {
      const time = parseDateMs(value);
      if (!time) return 'Tanggal pembuatan akun belum tersedia dari backend';
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      }).format(new Date(time));
    };

    const isNewAccount = (value?: string) => {
      const time = parseDateMs(value);
      return Boolean(time && Date.now() - time <= NEW_ACCOUNT_WINDOW_MS);
    };

    const companyNameMap = computed(() => {
      const map = new Map<string, string>();
      stakeholdersData.value.forEach((stakeholder) => {
        if (stakeholder.id) map.set(String(stakeholder.id), stakeholder.nama_perusahaan || '-');
      });
      return map;
    });

    type CompanyAccessMeta = {
      id: string;
      name: string;
      totalUsers: number;
      picCount: number;
      picNames: string[];
      picUsers: Array<{ id: string; name: string }>;
      hasPic: boolean;
      hasMultiplePics: boolean;
      healthClass: string;
      healthIcon: string;
      picLabel: string;
      picTitle: string;
    };

    const companyUserMeta = computed(() => {
      const groups = new Map<string, {
        id: string;
        name: string;
        totalUsers: number;
        picUsers: Array<{ id: string; name: string }>;
      }>();

      usersData.value.forEach((user: any) => {
        const companyId = getCompanyId(user);
        if (!companyId) return;

        if (!groups.has(companyId)) {
          groups.set(companyId, {
            id: companyId,
            name: companyNameMap.value.get(companyId) || 'Perusahaan tidak ditemukan',
            totalUsers: 0,
            picUsers: [],
          });
        }

        const group = groups.get(companyId)!;
        group.totalUsers += 1;
        if (isPicRole(user.role || user.role_name)) {
          group.picUsers.push({
            id: String(user.id || ''),
            name: getRawDisplayName(user),
          });
        }
      });

      const result = new Map<string, CompanyAccessMeta>();
      groups.forEach((group, companyId) => {
        const picNames = group.picUsers.map((pic) => pic.name);
        const picCount = group.picUsers.length;
        const hasPic = picCount > 0;
        const hasMultiplePics = picCount > 1;

        result.set(companyId, {
          ...group,
          picCount,
          picNames,
          hasPic,
          hasMultiplePics,
          healthClass: hasMultiplePics ? 'is-duplicate' : hasPic ? 'is-ok' : 'is-missing',
          healthIcon: hasMultiplePics ? 'ri-error-warning-line' : hasPic ? 'ri-shield-check-line' : 'ri-shield-cross-line',
          picLabel: hasMultiplePics ? `${picCount} PIC` : hasPic ? `PIC: ${picNames[0]}` : 'Belum ada PIC',
          picTitle: hasMultiplePics
            ? `Perusahaan ini punya ${picCount} User PIC: ${picNames.join(', ')}. Idealnya hanya 1.`
            : hasPic
              ? `User PIC perusahaan ini: ${picNames[0]}`
              : 'Reminder: perusahaan ini belum punya User PIC. Klik edit akses pada salah satu user lalu ubah role ke User PIC.',
        });
      });

      return result;
    });

    const makeUserSearchText = (user: User) => [
      user.name,
      user.display_name,
      user.username,
      user.email,
      user.jabatan,
      user.role,
      user.id_perusahaan ? companyNameMap.value.get(String(user.id_perusahaan)) : '',
    ].filter(Boolean).join(' ').toLowerCase();

    const hasMeaningfulValue = (value?: string | null) => {
      const normalized = String(value || "").trim().toLowerCase();
      return Boolean(normalized && !["-", "null", "undefined", "n/a"].includes(normalized));
    };

    const getRoleDisplayLabel = (role: string) => {
      const normalized = String(role || "user").toLowerCase();
      if (normalized === "user_pic" || normalized === "pic") return "User PIC";
      if (normalized === "admin") return "Admin";
      if (normalized === "staff") return "Staff";
      if (normalized === "user") return "User";
      return normalized
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    };

    type UserListItem = User & {
      companyName: string;
      companyLabel: string;
      displayName: string;
      hasCompany: boolean;
      hasJabatan: boolean;
      jabatanLabel: string;
      statusText: string;
      statusBadgeClass: string;
      roleBadgeClass: string;
      roleIcon: string;
      roleLabel: string;
      avatarLetter: string;
      avatarClass: string;
      userSearchText: string;
      companySearchText: string;
      createdLabel: string;
      createdTooltip: string;
      createdAtMs: number;
      isNewAccount: boolean;
      companyUserCount: number;
      companyPicCount: number;
      companyPicLabel: string;
      companyPicTitle: string;
      companyHealthClass: string;
      companyHealthIcon: string;
      companyNeedsPicReminder: boolean;
    };

    type CompanyPicReminderRow = {
      companyId: string;
      companyName: string;
      totalUsers: number;
      candidateUsers: UserListItem[];
      primaryUser: UserListItem | null;
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
          joined: (u as any).joined || (u as any).created_at || (u as any).createdAt || '',
          photo: formatImageUrl((u as any).photo || (u as any).foto_profile),
          status: typeof (u as any).status !== 'undefined' ? String((u as any).status) : 
                  typeof (u as any).is_active !== 'undefined' ? ((u as any).is_active ? 'aktif' : 'suspend') :
                  typeof (u as any).is_suspended !== 'undefined' ? ((u as any).is_suspended ? 'suspend' : 'aktif') :
                  typeof (u as any).aktif !== 'undefined' ? ((u as any).aktif == 1 ? 'aktif' : 'suspend') :
                  typeof (u as any).status_akun !== 'undefined' ? String((u as any).status_akun) : '',
          id_perusahaan: getCompanyId(u) || undefined,
          id_jabatan: (u as any).id_jabatan || undefined,
          jabatan_name: (u as any).jabatan_name || undefined,
          role_name: (u as any).role_name || undefined,
          foto_profile: (u as any).foto_profile || undefined
        };

        const mergedUser = currentUser && userObj.id === String(currentUser.id)
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
        const hasCompany = hasMeaningfulValue(companyName);
        const hasJabatan = hasMeaningfulValue(mergedUser.jabatan);
        const statusText = getUserStatusText(mergedUser.status);
        const companyMeta = mergedUser.id_perusahaan ? companyUserMeta.value.get(String(mergedUser.id_perusahaan)) : undefined;
        const createdValue = getCreatedValue(mergedUser);

        return {
          ...mergedUser,
          companyName,
          companyLabel: hasCompany ? companyName : 'Belum terhubung',
          displayName,
          hasCompany,
          hasJabatan,
          jabatanLabel: hasJabatan ? String(mergedUser.jabatan || '') : 'Belum diatur',
          statusText,
          statusBadgeClass: statusText === 'Aktif' ? 'badge-sektor-teal' : 'badge-sektor-amber',
          roleBadgeClass: getRoleBadgeClass(mergedUser.role),
          roleIcon: getRoleIcon(mergedUser.role),
          roleLabel: getRoleDisplayLabel(mergedUser.role),
          avatarLetter,
          avatarClass: getAvatarColorClass(avatarLetter),
          userSearchText: makeUserSearchText(mergedUser),
          companySearchText: companyName.toLowerCase(),
          createdLabel: formatCreatedLabel(createdValue),
          createdTooltip: formatCreatedTooltip(createdValue),
          createdAtMs: parseDateMs(createdValue),
          isNewAccount: isNewAccount(createdValue),
          companyUserCount: companyMeta?.totalUsers || 0,
          companyPicCount: companyMeta?.picCount || 0,
          companyPicLabel: companyMeta?.picLabel || 'Belum tertaut',
          companyPicTitle: companyMeta?.picTitle || 'User belum tertaut ke perusahaan',
          companyHealthClass: companyMeta?.healthClass || 'is-unlinked',
          companyHealthIcon: companyMeta?.healthIcon || 'ri-link-unlink',
          companyNeedsPicReminder: Boolean(
            hasCompany
            && companyMeta
            && !companyMeta.hasPic
            && !isPicRole(mergedUser.role)
            && String(mergedUser.id) !== currentUserId.value
          ),
        };
      });
    });

    const loadUsers = async () => {
      const shouldRefreshUsers = usersStore.initialized;
      const shouldRefreshStakeholders = stakeholdersStore.initialized;
      if (!usersStore.initialized || !stakeholdersStore.initialized) loading.value = true;
      
      try {
        const [roles] = await Promise.all([
          roleService.getAll(),
          usersStore.initialize(),
          stakeholdersStore.initialize(),
          profileStore.switchUser()
        ]);
        
        rolesData.value = roles;

        const refreshTasks = [
          shouldRefreshUsers ? usersStore.refresh() : null,
          shouldRefreshStakeholders ? stakeholdersStore.refresh() : null,
        ].filter(Boolean) as Promise<unknown>[];
        if (refreshTasks.length) void Promise.allSettled(refreshTasks);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        loading.value = false;
      }
    };

    const filteredData = computed(() => {
      let data = items.value;
      const q = searchQuery.value.trim().toLowerCase();
      if (q) {
        data = data.filter((i) =>
          searchMode.value === "company"
            ? i.companySearchText.includes(q)
            : i.userSearchText.includes(q)
        );
      }
      return [...data].sort((a, b) => {
        const mod = sortOrder.value === "asc" ? 1 : -1;
        const field = sortField.value as keyof UserListItem;
        const rawA = a[field];
        const rawB = b[field];
        if (typeof rawA === "number" || typeof rawB === "number") {
          return ((Number(rawA) || 0) - (Number(rawB) || 0)) * mod;
        }
        const valA = (rawA || "").toString();
        const valB = (rawB || "").toString();
        return valA.localeCompare(valB) * mod;
      });
    });

    const companyPicReminderRows = computed<CompanyPicReminderRow[]>(() => {
      const groups = new Map<string, CompanyPicReminderRow>();

      items.value.forEach((item) => {
        if (!item.companyNeedsPicReminder) return;
        const companyId = getCompanyId(item);
        if (!companyId) return;

        if (!groups.has(companyId)) {
          groups.set(companyId, {
            companyId,
            companyName: item.companyName,
            totalUsers: item.companyUserCount,
            candidateUsers: [],
            primaryUser: null,
          });
        }

        const group = groups.get(companyId)!;
        group.candidateUsers.push(item);
        if (!group.primaryUser || String(group.primaryUser.id) === currentUserId.value) {
          group.primaryUser = String(item.id) !== currentUserId.value ? item : group.primaryUser;
        }
      });

      groups.forEach((group) => {
        group.candidateUsers.sort((a, b) => {
          if (String(a.id) === currentUserId.value) return 1;
          if (String(b.id) === currentUserId.value) return -1;
          return a.displayName.localeCompare(b.displayName);
        });
        group.primaryUser = group.primaryUser
          || group.candidateUsers.find((user) => String(user.id) !== currentUserId.value)
          || null;
      });

      return [...groups.values()].sort((a, b) => a.companyName.localeCompare(b.companyName));
    });

    const filteredCompanyPicReminderRows = computed(() => {
      const q = reminderSearchDraft.value.trim().toLowerCase();
      if (!q) return companyPicReminderRows.value;

      return companyPicReminderRows.value.filter((row) => [
        row.companyName,
        row.totalUsers,
        ...row.candidateUsers.flatMap((user) => [
          user.displayName,
          user.username,
          user.email,
          user.roleLabel,
        ]),
      ].filter(Boolean).join(' ').toLowerCase().includes(q));
    });

    const getReminderSelectedUser = (row: CompanyPicReminderRow) => {
      const selectedId = selectedPicCandidateIds.value[row.companyId] || row.primaryUser?.id || '';
      return row.candidateUsers.find((user) => String(user.id) === String(selectedId))
        || row.primaryUser
        || row.candidateUsers[0]
        || null;
    };

    const toggleCreatedSort = () => {
      if (sortField.value === "createdAtMs") {
        toggleSort("createdAtMs");
        return;
      }

      sortField.value = "createdAtMs";
      sortOrder.value = "desc";
    };

    const { totalPages, displayData, paginationInfo } = makePagination(filteredData);

    const paginationPages = computed(() => {
      const total = totalPages.value;
      const page = currentPage.value;
      if (total <= 7) {
        return Array.from({ length: total }, (_, index) => ({
          key: `page-${index + 1}`,
          page: index + 1,
          ellipsis: false,
        }));
      }

      const pages = new Set([1, total, page - 1, page, page + 1]);
      const entries: Array<{ key: string; page: number; ellipsis: boolean }> = [];
      let previous = 0;

      [...pages]
        .filter((p) => p >= 1 && p <= total)
        .sort((a, b) => a - b)
        .forEach((p) => {
          if (previous && p - previous > 1) {
            entries.push({ key: `ellipsis-${previous}-${p}`, page: 0, ellipsis: true });
          }
          entries.push({ key: `page-${p}`, page: p, ellipsis: false });
          previous = p;
        });

      return entries;
    });

    const paginationCopy = computed(() => {
      const total = filteredData.value.length;
      const start = displayData.value.length ? (currentPage.value - 1) * itemsPerPage.value + 1 : 0;
      const end = Math.min(currentPage.value * itemsPerPage.value, total);
      return `Showing ${start}-${end} of ${total} users`;
    });

    const searchPlaceholder = computed(() =>
      searchMode.value === "company"
        ? "Cari perusahaan..."
        : "Cari user, email, jabatan, role..."
    );

    const roleOptions = computed(() => rolesData.value.length ? rolesData.value : FALLBACK_ROLE_OPTIONS);
    const roleLookup = computed(() => {
      const map = new Map<string, Role>();
      rolesData.value.forEach((role) => map.set(role.name.toLowerCase(), role));
      return map;
    });

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
    const getPicRoleOptionName = () =>
      roleOptions.value.find((role) => isPicRole(role.name))?.name || 'user_pic';

    const selectedCompanyAccess = computed(() => {
      const current = currentEditItem.value as any;
      if (!current) return null;

      const companyId = getCompanyId(current);
      const meta = companyId ? companyUserMeta.value.get(companyId) : undefined;
      const otherPicUsers = meta?.picUsers.filter((pic) => String(pic.id) !== String(current.id)) || [];
      const wouldDuplicatePic = Boolean(companyId && isPicRole(selectedRole.value) && otherPicUsers.length > 0);
      const companyNeedsPic = Boolean(companyId && meta && !meta.hasPic);
      const selectedRoleIsPic = isPicRole(selectedRole.value);

      return {
        hasCompany: Boolean(companyId),
        companyName: meta?.name || 'Belum terhubung ke perusahaan',
        totalUsers: meta?.totalUsers || 0,
        picCount: meta?.picCount || 0,
        wouldDuplicatePic,
        icon: wouldDuplicatePic
          ? 'ri-error-warning-line'
          : companyNeedsPic
            ? selectedRoleIsPic ? 'ri-shield-check-line' : 'ri-notification-3-line'
            : meta?.healthIcon || 'ri-link-unlink',
        stateClass: wouldDuplicatePic
          ? 'is-warning'
          : companyNeedsPic && selectedRoleIsPic
            ? 'is-ok'
            : meta?.healthClass || 'is-unlinked',
        summaryText: !companyId
          ? 'User ini belum punya relasi perusahaan.'
          : wouldDuplicatePic
            ? `Sudah ada User PIC: ${otherPicUsers.map((pic) => pic.name).join(', ')}. Pilih role User/Staff/Admin untuk menjaga aturan 1 PIC per perusahaan.`
            : companyNeedsPic
              ? selectedRoleIsPic
                ? 'Siap, user ini akan menjadi User PIC perusahaan.'
                : 'Reminder: perusahaan ini belum punya User PIC. Pilih role User PIC jika user ini PIC perusahaan.'
              : `${meta?.totalUsers || 0} user di perusahaan ini. ${meta?.picLabel || 'Belum ada PIC'}.`,
      };
    });

    const canSaveAccess = computed(() => !loading.value && !selectedCompanyAccess.value?.wouldDuplicatePic);

    // EDIT ACCESS
    const openEditRoleModal = (item: User) => {
      currentEditItem.value = item;
      selectedRole.value = item.role || 'user';
      selectedStatus.value = getUserStatusText(item.status);
      showEditRoleModal.value = true;
    };

    const openPicReminderModal = (item: User) => {
      currentEditItem.value = item;
      selectedRole.value = getPicRoleOptionName();
      selectedStatus.value = getUserStatusText(item.status);
      showEditRoleModal.value = true;
    };

    const openSelectedPicReminderModal = (row: CompanyPicReminderRow) => {
      const selectedUser = getReminderSelectedUser(row);
      if (selectedUser) openPicReminderModal(selectedUser);
    };

    const updateRole = async () => {
      if (!currentEditItem.value) return;
      const roleObj = roleLookup.value.get(selectedRole.value.toLowerCase());
      if (!roleObj) {
        showNotification("Data role belum tersedia, coba refresh halaman.", "error");
        return;
      }
      if (selectedCompanyAccess.value?.wouldDuplicatePic) {
        showNotification("Perusahaan ini sudah punya User PIC. Hanya boleh 1 User PIC per perusahaan.", "error");
        return;
      }

      loading.value = true;
      try {
        const current = currentEditItem.value;
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
        
        usersStore.users = usersStore.users.map((user: any) =>
          user.id?.toString() === current.id
            ? {
                ...user,
                role: selectedRole.value,
                role_name: selectedRole.value,
                status: statusPayload.status,
                status_akun: statusPayload.status_akun,
                aktif: statusPayload.aktif,
                is_active: statusPayload.is_active,
                is_suspended: statusPayload.is_suspended,
              }
            : user
        );
        
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
        usersStore.users = usersStore.users.filter((u: any) =>
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

    const shouldReduceMotion = () =>
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const runEntranceAnimations = () => {
      nextTick(() => {
        const root = usersPageRoot.value;
        if (!root || shouldReduceMotion()) return;

        usersGsapContext?.revert();
        usersGsapContext = gsap.context(() => {
          gsap.timeline({ defaults: { ease: "power3.out", overwrite: "auto" } })
            .from(".role-breadcrumb", { y: -8, opacity: 0, duration: 0.35 })
            .from(".role-hero-title", { y: 18, opacity: 0, duration: 0.42 }, "-=0.16")
            .from(".role-hero-desc, .role-hero-summary", { y: 12, opacity: 0, duration: 0.36, stagger: 0.05 }, "-=0.22")
            .from(".role-stat-card", {
              y: 16,
              opacity: 0,
              scale: 0.985,
              duration: 0.36,
              stagger: 0.055,
              clearProps: "transform,opacity",
            }, "-=0.08")
            .from(".role-toolbar-card, .role-table-card", { y: 18, opacity: 0, duration: 0.36, stagger: 0.06 }, "-=0.1");
        }, root);
      });
    };

    const animateRows = (quick = false) => {
      if (rowAnimationFrame) window.cancelAnimationFrame(rowAnimationFrame);

      nextTick(() => {
        rowAnimationFrame = window.requestAnimationFrame(() => {
          rowAnimationFrame = 0;
          const root = usersPageRoot.value;
          if (!root || shouldReduceMotion()) return;

          const rows = Array.from(root.querySelectorAll<HTMLElement>(".stakeholder-row"));
          if (!rows.length) return;

          gsap.killTweensOf(rows);
          gsap.set(rows, { y: quick ? 8 : 12, opacity: 0, scale: quick ? 0.997 : 0.992, force3D: true });
          gsap.to(rows, {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: quick ? 0.22 : 0.3,
            ease: "power2.out",
            stagger: quick ? 0.025 : 0.035,
            overwrite: "auto",
            clearProps: "transform,opacity",
          });
        });
      });
    };

    const clearUserSearch = () => {
      if (searchDebounceTimeout) window.clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = undefined;
      searchDraft.value = "";
      clearSearch();
    };

    const setSearchMode = (mode: "user" | "company") => {
      searchMode.value = mode;
      currentPage.value = 1;
    };

    const focusSearchInput = () => {
      searchInput.value?.focus();
    };

    const goToPage = (page: number) => {
      currentPage.value = Math.min(Math.max(page, 1), Math.max(totalPages.value, 1));
    };

    const canModifyUser = (item: User) => String(item.id) !== currentUserId.value;

    watch(searchDraft, (value) => {
      if (searchDebounceTimeout) window.clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = window.setTimeout(() => {
        searchQuery.value = value;
        searchDebounceTimeout = undefined;
      }, 140);
    });

    watch(searchQuery, (value) => {
      if (value !== searchDraft.value) searchDraft.value = value;
    });

    watch(searchMode, () => {
      currentPage.value = 1;
    });

    watch(companyPicReminderRows, (rows) => {
      const next: Record<string, string> = { ...selectedPicCandidateIds.value };
      const activeCompanyIds = new Set(rows.map((row) => row.companyId));

      rows.forEach((row) => {
        const currentSelection = next[row.companyId];
        const selectionStillExists = row.candidateUsers.some((user) => String(user.id) === String(currentSelection));
        if (!selectionStillExists) {
          next[row.companyId] = row.primaryUser?.id || row.candidateUsers[0]?.id || '';
        }
      });

      Object.keys(next).forEach((companyId) => {
        if (!activeCompanyIds.has(companyId)) delete next[companyId];
      });

      selectedPicCandidateIds.value = next;
    }, { immediate: true });

    watch(totalPages, (pageCount) => {
      const lastPage = Math.max(pageCount, 1);
      if (currentPage.value > lastPage) currentPage.value = lastPage;
    });

    watch([displayData, loading], (newVals, oldVals) => {
      if (!pageHasEntered.value || loading.value) return;
      const wasLoading = oldVals ? oldVals[1] : false;
      const quick = !wasLoading;
      animateRows(quick);
    }, { flush: "post" });

    onMounted(() => {
      runEntranceAnimations();
      void loadUsers();
      window.setTimeout(() => searchInput.value?.focus(), 350);
      pageHasEntered.value = true;
    });

    onBeforeUnmount(() => {
      usersGsapContext?.revert();
      usersGsapContext = null;
      if (rowAnimationFrame) window.cancelAnimationFrame(rowAnimationFrame);
      if (searchDebounceTimeout) window.clearTimeout(searchDebounceTimeout);
    });

    return {
      items, loading, isInitialLoading, usersPageRoot, searchInput, searchDraft, reminderSearchDraft,
      searchMode, activeUsersView, searchPlaceholder, sortField, sortOrder, currentPage, itemsPerPage,
      totalPages, displayData, paginationCopy, filteredData, paginationPages,
      companyPicReminderRows, filteredCompanyPicReminderRows, selectedPicCandidateIds,
      showDeleteModal, currentDeleteItem,
      showEditRoleModal, currentEditItem, selectedRole, selectedStatus,
      showToast, toastMessage, toastType,
      roleOptions, userStats, selectedCompanyAccess, canSaveAccess,
      openDeleteModal, deleteUser, openEditRoleModal, openPicReminderModal, openSelectedPicReminderModal, updateRole,
      getUserStatusText, getRoleBadgeClass, getRoleDisplayLabel, getDisplayName, clearUserSearch, setSearchMode,
      focusSearchInput, goToPage, canModifyUser, toggleSort, toggleCreatedSort, getAvatarColorClass, getReminderSelectedUser,
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

  <div ref="usersPageRoot" class="role-page-shell">
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
        <div class="users-view-switch-card" aria-label="Pilihan tampilan manajemen user">
          <button
            type="button"
            class="users-view-switch-btn"
            :class="{ active: activeUsersView === 'users' }"
            :aria-pressed="activeUsersView === 'users'"
            @click="activeUsersView = 'users'"
          >
            <i class="ri-table-line"></i>
            <span>User List</span>
            <strong>{{ filteredData.length }}</strong>
          </button>
          <button
            type="button"
            class="users-view-switch-btn users-view-switch-btn--warning"
            :class="{ active: activeUsersView === 'reminders' }"
            :aria-pressed="activeUsersView === 'reminders'"
            @click="activeUsersView = 'reminders'"
          >
            <i class="ri-notification-3-line"></i>
            <span>Reminder PIC</span>
            <strong>{{ companyPicReminderRows.length }}</strong>
          </button>
        </div>

        <div v-if="activeUsersView === 'users'" class="users-search-tabs" role="tablist" aria-label="Mode pencarian user">
          <button
            type="button"
            class="users-search-tab"
            :class="{ active: searchMode === 'user' }"
            :aria-pressed="searchMode === 'user'"
            @click="setSearchMode('user')"
          >
            <i class="ri-user-search-line"></i>
            User
          </button>
          <button
            type="button"
            class="users-search-tab"
            :class="{ active: searchMode === 'company' }"
            :aria-pressed="searchMode === 'company'"
            @click="setSearchMode('company')"
          >
            <i class="ri-building-4-line"></i>
            Perusahaan
          </button>
        </div>

        <div v-if="activeUsersView === 'users'" class="stakeholders-search role-search users-toolbar-search position-relative" @click="focusSearchInput">
          <i class="ri-search-line header-search-icon"></i>
          <input
            ref="searchInput"
            v-model="searchDraft"
            type="text"
            class="form-control form-control-sm header-search-input"
            :placeholder="searchPlaceholder"
          />
          <button v-if="searchDraft" @click="clearUserSearch" class="clear-btn" title="Clear search">
            <i class="ri-close-circle-fill"></i>
          </button>
        </div>

        <div v-else class="stakeholders-search role-search users-toolbar-search position-relative">
          <i class="ri-search-line header-search-icon"></i>
          <input
            v-model="reminderSearchDraft"
            type="text"
            class="form-control form-control-sm header-search-input"
            placeholder="Cari perusahaan atau kandidat PIC..."
          />
          <button v-if="reminderSearchDraft" @click="reminderSearchDraft = ''" class="clear-btn" title="Clear search">
            <i class="ri-close-circle-fill"></i>
          </button>
        </div>
      </div>
      <div class="users-toolbar-right">
        <div v-if="activeUsersView === 'users'" class="role-rows-selector">
          <span>Rows</span>
          <select v-model="itemsPerPage" class="form-select form-select-sm header-rows-select">
            <option v-for="n in [5, 10, 15, 20, 25, 50]" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
        <span v-else class="users-pic-reminder-count">
          <i class="ri-notification-3-line"></i>
          {{ filteredCompanyPicReminderRows.length }} dari {{ companyPicReminderRows.length }}
        </span>
      </div>
    </section>

    <section v-if="activeUsersView === 'reminders'" class="role-table-card users-pic-reminder-card">
      <div class="users-pic-reminder-header">
        <div>
          <span class="users-pic-reminder-kicker">Reminder Admin</span>
          <h3>Perusahaan Butuh User PIC</h3>
          <p>Daftar perusahaan yang belum punya PIC. Admin bisa memilih user mana yang naik menjadi User PIC.</p>
        </div>
        <span class="users-pic-reminder-count">
          <i class="ri-notification-3-line"></i>
          {{ filteredCompanyPicReminderRows.length }} perusahaan
        </span>
      </div>

      <div class="card-body p-0 stakeholders-premium-body">
        <div class="table-responsive stakeholder-table-wrap users-pic-reminder-wrap">
          <table class="table stakeholder-table users-pic-reminder-table mb-0">
            <thead class="stakeholder-thead">
              <tr>
                <th>Perusahaan</th>
                <th class="text-center">Total User</th>
                <th>Kandidat User PIC</th>
                <th>Status</th>
                <th class="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filteredCompanyPicReminderRows.length">
                <td colspan="5" class="text-center py-5">
                  <div class="empty-state">
                    <div class="empty-icon-ring mb-3"><div class="empty-icon-inner"><i class="ri-shield-check-line"></i></div></div>
                    <h6 class="fw-semibold mb-1 empty-state-title">{{ companyPicReminderRows.length ? 'Reminder tidak ditemukan' : 'Semua perusahaan sudah punya User PIC' }}</h6>
                    <p class="text-muted fs-13 mb-0">{{ companyPicReminderRows.length ? 'Coba kata kunci perusahaan atau nama user lain.' : 'Tidak ada reminder yang perlu ditindaklanjuti.' }}</p>
                  </div>
                </td>
              </tr>
              <tr v-for="row in filteredCompanyPicReminderRows" :key="row.companyId" class="stakeholder-row">
                <td class="align-middle">
                  <div class="users-reminder-company">
                    <span class="users-company-text">{{ row.companyName }}</span>
                    <span class="users-reminder-subtext">Belum memiliki User PIC</span>
                  </div>
                </td>
                <td class="align-middle text-center">
                  <span class="users-company-chip users-company-chip--count">
                    <i class="ri-group-line"></i>{{ row.totalUsers }} user
                  </span>
                </td>
                <td class="align-middle">
                  <div class="users-reminder-candidate" v-if="row.candidateUsers.length">
                    <select v-model="selectedPicCandidateIds[row.companyId]" class="form-select form-select-sm users-reminder-select">
                      <option v-for="user in row.candidateUsers" :key="user.id" :value="user.id">
                        {{ user.displayName }} (@{{ user.username }}) - {{ user.roleLabel }}
                      </option>
                    </select>
                    <span class="users-reminder-subtext">{{ row.candidateUsers.length }} kandidat tersedia</span>
                  </div>
                  <span v-else class="users-empty-text">Belum ada kandidat</span>
                </td>
                <td class="align-middle">
                  <span class="users-company-chip users-company-chip--pic is-missing">
                    <i class="ri-notification-3-line"></i>Butuh User PIC
                  </span>
                </td>
                <td class="align-middle text-center">
                  <button
                    type="button"
                    class="btn btn-sm users-reminder-action"
                    :disabled="!getReminderSelectedUser(row)"
                    @click="openSelectedPicReminderModal(row)"
                  >
                    <i class="ri-user-settings-line"></i>
                    Jadikan User PIC
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section v-if="activeUsersView === 'users'" class="role-table-card">
      <div class="card-body p-0 stakeholders-premium-body">
        <div class="table-responsive stakeholder-table-wrap stakeholders-table-shell">
          <table class="table stakeholder-table users-list-table mb-0">
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
                  <th class="sortable text-center" @click="toggleCreatedSort">
                    <div class="d-flex align-items-center justify-content-center gap-2">
                      <span>Dibuat</span>
                      <i :class="sortField === 'createdAtMs' ? (sortOrder === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line') : 'ri-expand-up-down-line'" class="fs-14 opacity-50"></i>
                    </div>
                  </th>
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
                      <button v-if="searchDraft" @click="clearUserSearch" class="btn btn-sm btn-outline-primary rounded-pill px-4">
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
                        <div class="users-user-meta-line">
                          <span class="text-muted fs-12">@{{ item.username }}</span>
                          <span class="users-inline-status" :class="item.statusText === 'Aktif' ? 'is-active' : 'is-inactive'">
                            <i :class="item.statusText === 'Aktif' ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'"></i>
                            {{ item.statusText }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="align-middle">
                    <span class="users-email-text">{{ item.email || item.username }}</span>
                  </td>
                  <td class="align-middle">
                    <span v-if="item.hasJabatan" class="users-jabatan-badge">
                      <i class="ri-briefcase-line"></i>{{ item.jabatanLabel }}
                    </span>
                    <span v-else class="users-empty-text">
                      {{ item.jabatanLabel }}
                    </span>
                  </td>
                  <td class="align-middle">
                    <div class="users-company-stack">
                      <span :class="item.hasCompany ? 'users-company-text' : 'users-empty-text'">{{ item.companyLabel }}</span>
                      <div v-if="item.hasCompany" class="users-company-meta-row">
                        <span class="users-company-chip users-company-chip--count" :title="`${item.companyUserCount} user terdaftar di perusahaan ini`">
                          <i class="ri-group-line"></i>{{ item.companyUserCount }} user
                        </span>
                        <span
                          class="users-company-chip users-company-chip--pic"
                          :class="item.companyHealthClass"
                          :title="item.companyPicTitle"
                        >
                          <i :class="item.companyHealthIcon"></i>{{ item.companyPicLabel }}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td class="align-middle text-center">
                    <div class="users-created-stack" :title="item.createdTooltip">
                      <span class="users-created-note">{{ item.createdLabel }}</span>
                      <span v-if="item.isNewAccount" class="users-new-account-badge">
                        <i class="ri-sparkling-line"></i>Baru
                      </span>
                    </div>
                  </td>
                  <td class="align-middle text-center">
                    <span class="badge-sektor users-role-badge" :class="item.roleBadgeClass">
                      <i :class="`${item.roleIcon} me-1`"></i>
                      {{ item.roleLabel }}
                    </span>
                  </td>
                  <td class="align-middle text-center">
                    <div class="users-action-group">
                      <router-link
                        :to="`/users-profile/${item.slug}`"
                        class="btn btn-sm btn-icon btn-wave btn-info-light stakeholders-action-btn"
                        data-tooltip="Lihat"
                        title="Lihat profil user"
                        aria-label="Lihat profil user"
                      >
                        <i class="ri-eye-line"></i>
                      </router-link>
                      <button
                        v-if="canModifyUser(item)"
                        @click="openEditRoleModal(item)"
                        class="btn btn-sm btn-icon btn-wave btn-success-light stakeholders-action-btn"
                        data-tooltip="Edit akses"
                        title="Edit akses user"
                        aria-label="Edit akses user"
                      >
                        <i class="ri-pencil-line"></i>
                      </button>
                      <button
                        v-if="canModifyUser(item)"
                        @click="openDeleteModal(item)"
                        class="btn btn-sm btn-icon btn-wave btn-danger-light stakeholders-action-btn"
                        data-tooltip="Hapus"
                        title="Hapus user"
                        aria-label="Hapus user"
                      >
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
                    <a class="page-link rounded-circle" href="#" @click.prevent="goToPage(1)" title="First">
                      <i class="ri-skip-back-mini-line"></i>
                    </a>
                  </li>
                  <li class="page-item d-none d-sm-block" :class="{ disabled: currentPage === 1 }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="goToPage(currentPage - 1)" title="Previous">
                      <i class="ri-arrow-left-s-line"></i>
                    </a>
                  </li>
                  <template v-for="entry in paginationPages" :key="entry.key">
                    <li v-if="!entry.ellipsis" class="page-item" :class="{ active: entry.page === currentPage }">
                      <a class="page-link rounded-circle" href="#" @click.prevent="goToPage(entry.page)">{{ entry.page }}</a>
                    </li>
                    <li v-else class="page-item disabled">
                      <span class="page-link border-0 bg-transparent">...</span>
                    </li>
                  </template>
                  <li class="page-item d-none d-sm-block" :class="{ disabled: currentPage === totalPages }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="goToPage(currentPage + 1)" title="Next">
                      <i class="ri-arrow-right-s-line"></i>
                    </a>
                  </li>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                    <a class="page-link rounded-circle" href="#" @click.prevent="goToPage(totalPages)" title="Last">
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
                  <span class="badge-sektor" :class="getRoleBadgeClass(currentEditItem.role)">{{ getRoleDisplayLabel(currentEditItem.role) }}</span>
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
                  <div
                    v-if="selectedCompanyAccess"
                    class="user-access-company-note"
                    :class="selectedCompanyAccess.stateClass"
                  >
                    <i :class="selectedCompanyAccess.icon"></i>
                    <div>
                      <strong>{{ selectedCompanyAccess.companyName }}</strong>
                      <span>{{ selectedCompanyAccess.summaryText }}</span>
                    </div>
                  </div>
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
              <button class="btn btn-primary user-access-save" @click="updateRole" :disabled="!canSaveAccess">
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

.user-access-company-note {
  align-items: flex-start;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  display: flex;
  gap: 10px;
  margin-top: 10px;
  padding: 10px 12px;
}

.user-access-company-note > i {
  flex: 0 0 auto;
  font-size: 17px;
  line-height: 1.2;
  margin-top: 1px;
}

.user-access-company-note div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.user-access-company-note strong {
  color: #0f172a;
  font-size: 12px;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-access-company-note span {
  color: #475569;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.35;
}

.user-access-company-note.is-ok {
  background: #ecfdf5;
  border-color: #a7f3d0;
}

.user-access-company-note.is-ok > i {
  color: #047857;
}

.user-access-company-note.is-missing,
.user-access-company-note.is-unlinked {
  background: #fff7ed;
  border-color: #fed7aa;
}

.user-access-company-note.is-missing > i,
.user-access-company-note.is-unlinked > i {
  color: #c2410c;
}

.user-access-company-note.is-warning,
.user-access-company-note.is-duplicate {
  background: #fef2f2;
  border-color: #fecaca;
}

.user-access-company-note.is-warning > i,
.user-access-company-note.is-duplicate > i {
  color: #dc2626;
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

.stakeholders-search {
  position: relative;
  width: 100% !important;
}

@media (max-width: 768px) {
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
  .th-no, .stakeholder-row td:first-child,
  .stakeholder-thead th:nth-child(3), .stakeholder-row td:nth-child(3),
  .stakeholder-thead th:nth-child(4), .stakeholder-row td:nth-child(4) {
    display: none !important;
  }

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

.users-user-meta-line {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
  min-width: 0;
}

.users-inline-status {
  align-items: center;
  display: inline-flex;
  font-size: 11px;
  font-weight: 750;
  gap: 4px;
  line-height: 1;
  opacity: 0.78;
}

.users-inline-status i {
  font-size: 10px;
}

.users-inline-status.is-active {
  color: #0f766e;
}

.users-inline-status.is-inactive {
  color: #a16207;
}

.users-created-stack {
  align-items: center;
  display: inline-flex;
  flex-direction: column;
  gap: 5px;
  justify-content: center;
  min-width: 84px;
}

.users-new-account-badge,
.users-created-note {
  align-items: center;
  border-radius: 999px;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 10px;
  font-weight: 850;
  gap: 3px;
  line-height: 1;
  padding: 3px 7px;
  white-space: nowrap;
}

.users-new-account-badge {
  background: #f2fbf8;
  border: 1px solid #cfeee2;
  color: #3f7564;
}

.users-created-note {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #64748b;
  min-width: 74px;
  justify-content: center;
}

.users-email-text,
.users-company-text {
  color: #334155;
  font-size: 13px;
  font-weight: 650;
}

.users-company-text {
  color: #475569;
}

.users-company-stack {
  display: grid;
  gap: 6px;
  min-width: 190px;
}

.users-company-meta-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.users-company-chip {
  align-items: center;
  border-radius: 999px;
  display: inline-flex;
  font-size: 10px;
  font-weight: 850;
  gap: 4px;
  line-height: 1;
  max-width: 180px;
  overflow: hidden;
  padding: 4px 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.users-company-chip--button {
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.16s ease;
}

.users-company-chip--button:hover,
.users-company-chip--button:focus-visible {
  border-color: #edc9a6;
  color: #7c461a;
  outline: none;
  transform: translateY(-1px);
}

.users-company-chip i {
  flex: 0 0 auto;
  font-size: 11px;
}

.users-company-chip--count {
  background: #f7fbff;
  border: 1px solid #d7e8f7;
  color: #4b7190;
}

.users-company-chip--pic.is-ok {
  background: #f3fbf8;
  border: 1px solid #d4eee3;
  color: #3f7564;
}

.users-company-chip--pic.is-missing {
  background: #fff8f1;
  border: 1px solid #f5dcc2;
  color: #9a5a22;
}

.users-company-chip--pic.is-duplicate {
  background: #fff5f5;
  border: 1px solid #f3d4d4;
  color: #9f3a3a;
}

.users-company-chip--pic.is-unlinked {
  background: #f8fafc;
  border: 1px solid #dde7f0;
  color: #64748b;
}

.users-empty-text {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 650;
}

.users-jabatan-badge {
  align-items: center;
  background: #f8fafc;
  border: 1px solid #dbe5f0;
  border-radius: 8px;
  color: #1e293b;
  display: inline-flex;
  font-size: 11px;
  font-weight: 750;
  gap: 5px;
  max-width: 190px;
  overflow: hidden;
  padding: 4px 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.users-jabatan-badge i {
  color: #2563eb;
  font-size: 12px;
}

.role-page-shell {
  display: grid;
  gap: 14px;
  max-width: 100%;
  min-width: 0;
  overflow-x: clip;
  width: 100%;
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
  box-sizing: border-box;
  display: flex;
  gap: 18px;
  justify-content: space-between;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  padding: 17px 24px;
  position: relative;
  width: 100%;
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
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.role-breadcrumb span {
  color: rgba(219, 234, 254, 0.58);
  margin: 0 6px;
}

.role-hero-copy h2 {
  color: #fff;
  font-size: 22px;
  font-weight: 900;
  line-height: 1.1;
  margin: 0;
}

.role-hero-copy {
  min-width: 0;
}

.role-hero-copy p {
  color: rgba(239, 246, 255, 0.88);
  font-size: 12px;
  font-weight: 600;
  margin: 6px 0 0;
  max-width: 58ch;
  overflow-wrap: break-word;
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
  min-width: 120px;
  padding: 11px 16px;
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
  font-size: 25px;
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
  gap: 10px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  max-width: 100%;
  min-width: 0;
  width: 100%;
}

.role-stat-card {
  align-items: center;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
  cursor: default;
  display: flex;
  gap: 12px;
  min-height: 74px;
  min-width: 0;
  overflow: hidden;
  padding: 13px 15px;
  position: relative;
  transform: translateY(0);
  transition: border-color 0.2s ease, box-shadow 0.22s ease, transform 0.22s ease;
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
  transition: opacity 0.22s ease, width 0.22s ease;
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
  transform: scale(1);
  transition: opacity 0.22s ease, transform 0.22s ease;
  width: 92px;
}

.role-stat-card:hover {
  border-color: color-mix(in srgb, var(--stat-accent, #2563eb) 34%, transparent);
  box-shadow: 0 22px 46px rgba(15, 23, 42, 0.12);
  transform: translateY(-4px);
}

.role-stat-card:hover::before {
  opacity: 1;
  width: 6px;
}

.role-stat-card:hover::after {
  opacity: 0.82;
  transform: scale(1.08);
}

.role-stat-icon {
  align-items: center;
  border-radius: 14px;
  display: inline-flex;
  flex: 0 0 40px;
  height: 40px;
  justify-content: center;
  position: relative;
  transition: box-shadow 0.22s ease, transform 0.22s ease;
  width: 40px;
  z-index: 1;
}

.role-stat-icon i {
  font-size: 20px;
  transition: transform 0.22s ease;
}

.role-stat-card:hover .role-stat-icon {
  box-shadow: 0 6px 14px color-mix(in srgb, var(--stat-accent, #2563eb) 12%, transparent);
  transform: translateY(-1px);
}

.role-stat-card:hover .role-stat-icon i {
  transform: scale(1.02);
}

.role-stat-card:hover strong {
  color: var(--stat-accent, #2563eb);
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
  font-size: 23px;
  font-weight: 950;
  line-height: 1.1;
  margin-top: 3px;
}

.role-stat-card > div {
  min-width: 0;
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

.users-view-switch-card {
  align-items: center;
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
  display: inline-flex;
  gap: 6px;
  justify-self: start;
  max-width: 100%;
  min-width: 0;
  padding: 5px;
}

.users-view-switch-btn {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 12px;
  color: #64748b;
  cursor: pointer;
  display: inline-flex;
  font-size: 13px;
  font-weight: 850;
  gap: 8px;
  min-height: 40px;
  min-width: 0;
  padding: 9px 14px;
  transition: background-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease;
  white-space: nowrap;
}

.users-view-switch-btn span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.users-view-switch-btn i {
  font-size: 16px;
}

.users-view-switch-btn strong {
  align-items: center;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  color: #475569;
  display: inline-flex;
  font-size: 11px;
  font-weight: 900;
  justify-content: center;
  min-width: 26px;
  padding: 3px 7px;
}

.users-view-switch-btn:hover {
  background: #f8fafc;
  color: #0f172a;
}

.users-view-switch-btn.active {
  background: #f3f9ff;
  box-shadow: 0 7px 18px rgba(37, 99, 235, 0.1);
  color: #377da8;
}

.users-view-switch-btn.active strong {
  background: #ffffff;
  border-color: #d8ebfb;
  color: #377da8;
}

.users-view-switch-btn--warning.active {
  background: #fff8f1;
  box-shadow: 0 7px 18px rgba(154, 90, 34, 0.1);
  color: #9a5a22;
}

.users-view-switch-btn--warning.active strong {
  border-color: #f5dcc2;
  color: #9a5a22;
}

.role-toolbar-card {
  align-items: center;
  background: linear-gradient(180deg, #fff, #fbfdff);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
  box-sizing: border-box;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  max-width: 100%;
  min-width: 0;
  padding: 14px 16px;
  width: 100%;
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
  min-width: 0;
}

.users-toolbar-right {
  flex-shrink: 0;
  justify-content: flex-end;
  min-width: 0;
}

.users-search-tabs {
  align-items: center;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  display: inline-flex;
  gap: 3px;
  max-width: 100%;
  min-width: 0;
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
  min-width: 0;
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

.role-search {
  flex: 1 1 420px;
  max-width: 460px;
  min-width: 280px;
  cursor: text;
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

.role-search .header-search-input::placeholder {
  color: #64748b !important;
  opacity: 1 !important;
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

.users-pic-reminder-card {
  overflow: hidden;
}

.users-pic-reminder-header {
  align-items: center;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  border-bottom: 1px solid #eef2f7;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 18px 20px;
}

.users-pic-reminder-kicker {
  color: #9a5a22;
  display: block;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.users-pic-reminder-header h3 {
  color: #0f172a;
  font-size: 16px;
  font-weight: 850;
  line-height: 1.2;
  margin: 0;
}

.users-pic-reminder-header p {
  color: #64748b;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.4;
  margin: 5px 0 0;
}

.users-pic-reminder-count {
  align-items: center;
  background: #fff8f1;
  border: 1px solid #f5dcc2;
  border-radius: 999px;
  color: #9a5a22;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 850;
  gap: 6px;
  padding: 7px 12px;
  white-space: nowrap;
}

.users-pic-reminder-wrap {
  margin: 0;
  overflow-x: auto;
  width: 100%;
}

.users-pic-reminder-table {
  min-width: 920px;
}

.users-reminder-company {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.users-reminder-subtext {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
}

.users-reminder-candidate {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.users-reminder-select {
  background-color: #f8fafc !important;
  border: 1px solid #dbe5f0 !important;
  border-radius: 10px !important;
  color: #1e293b !important;
  font-size: 12px !important;
  font-weight: 750;
  min-height: 34px !important;
  min-width: 260px;
}

.users-reminder-action {
  align-items: center;
  background: #fff8f1 !important;
  border: 1px solid #f5dcc2 !important;
  border-radius: 999px !important;
  color: #9a5a22 !important;
  display: inline-flex;
  font-size: 12px !important;
  font-weight: 850 !important;
  gap: 6px;
  min-height: 34px;
  padding: 7px 12px !important;
  white-space: nowrap;
}

.users-reminder-action:hover,
.users-reminder-action:focus-visible {
  background: #fff3e6 !important;
  border-color: #edc9a6 !important;
  color: #7c461a !important;
}

.users-reminder-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.role-table-card {
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  box-sizing: border-box;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  position: relative;
  width: 100%;
}

.role-table-card .stakeholders-table-shell {
  border: 0;
  border-radius: 0;
  box-shadow: none;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: visible;
}

.role-table-card .stakeholder-table-wrap {
  margin: 0;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: visible;
  width: 100%;
}

.role-table-card .stakeholders-premium-body {
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.role-table-card .users-list-table {
  margin-bottom: 0;
  min-width: 1220px;
}

.role-table-card .users-list-table th:nth-child(1),
.role-table-card .users-list-table td:nth-child(1) {
  min-width: 56px;
  width: 56px;
}

.role-table-card .users-list-table th:nth-child(2),
.role-table-card .users-list-table td:nth-child(2) {
  min-width: 260px;
  width: 260px;
}

.role-table-card .users-list-table th:nth-child(3),
.role-table-card .users-list-table td:nth-child(3) {
  min-width: 180px;
  width: 180px;
}

.role-table-card .users-list-table th:nth-child(4),
.role-table-card .users-list-table td:nth-child(4) {
  min-width: 160px;
  width: 160px;
}

.role-table-card .users-list-table th:nth-child(5),
.role-table-card .users-list-table td:nth-child(5) {
  min-width: 280px;
  width: 280px;
}

.role-table-card .users-list-table th:nth-child(6),
.role-table-card .users-list-table td:nth-child(6),
.role-table-card .users-list-table th:nth-child(7),
.role-table-card .users-list-table td:nth-child(7) {
  min-width: 130px;
  width: 130px;
}

.role-table-card .users-list-table th:nth-child(8),
.role-table-card .users-list-table td:nth-child(8) {
  min-width: 140px;
  width: 140px;
}

.role-table-card .stakeholder-thead th {
  background: #f8fafc !important;
  border-bottom: 1px solid #e2e8f0 !important;
  color: #475569 !important;
  font-size: 11.5px;
  font-weight: 900;
  letter-spacing: 0.08em;
  padding: 15px 18px;
  text-transform: uppercase;
}

.role-table-card .stakeholder-row td {
  font-size: 13.5px;
  line-height: 1.45;
  padding: 18px;
  transition: background-color 0.18s ease, box-shadow 0.18s ease;
}

.role-table-card .stakeholder-row:hover td {
  background: #f8fbff !important;
}

.role-table-card .stakeholder-row:hover,
.role-table-card .stakeholder-row:focus-within {
  position: relative;
  z-index: 20;
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

.role-table-card .stakeholder-company-cell {
  align-items: center;
  display: flex;
  gap: 12px;
  min-width: 0;
}

.role-table-card .company-name-wrap {
  min-width: 0;
}

.role-table-card .company-name,
.users-email-text,
.users-company-text {
  overflow-wrap: break-word;
  word-break: normal;
}

.role-table-card .stakeholders-action-btn {
  align-items: center;
  display: inline-flex;
  height: 34px;
  justify-content: center;
  min-width: 34px;
  overflow: visible !important;
  position: relative;
}

.role-table-card .stakeholders-action-btn.btn-info-light {
  background: #f3f9ff !important;
  border-color: #d8ebfb !important;
  color: #377da8 !important;
}

.role-table-card .stakeholders-action-btn.btn-success-light {
  background: #f3fbf7 !important;
  border-color: #d5efe2 !important;
  color: #3f8b66 !important;
}

.role-table-card .stakeholders-action-btn.btn-danger-light {
  background: #fff5f5 !important;
  border-color: #f3d7d7 !important;
  color: #a65252 !important;
}

.users-action-group {
  align-items: center;
  display: inline-flex;
  gap: 7px;
  justify-content: center;
  min-width: 120px;
}

.role-table-card .stakeholders-action-btn[data-tooltip]::after {
  background: #0f172a;
  border-radius: 8px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.2);
  color: #fff;
  content: attr(data-tooltip);
  font-size: 11px;
  font-weight: 800;
  left: 50%;
  line-height: 1;
  opacity: 0;
  padding: 6px 8px;
  pointer-events: none;
  position: absolute;
  bottom: calc(100% + 9px);
  transform: translate(-50%, 4px);
  transition: opacity 160ms ease, transform 160ms ease;
  white-space: nowrap;
  z-index: 300;
}

.role-table-card .stakeholders-action-btn[data-tooltip]::before {
  border: 5px solid transparent;
  border-top-color: #0f172a;
  bottom: calc(100% + 4px);
  content: "";
  left: 50%;
  opacity: 0;
  pointer-events: none;
  position: absolute;
  transform: translate(-50%, 4px);
  transition: opacity 160ms ease, transform 160ms ease;
  z-index: 301;
}

.role-table-card .stakeholders-action-btn[data-tooltip]:hover::after,
.role-table-card .stakeholders-action-btn[data-tooltip]:focus-visible::after,
.role-table-card .stakeholders-action-btn[data-tooltip]:hover::before,
.role-table-card .stakeholders-action-btn[data-tooltip]:focus-visible::before {
  opacity: 1;
  transform: translate(-50%, 0);
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

.role-page-shell .users-role-badge {
  background: #f8fafc !important;
  border: 1px solid #dde7f0 !important;
  color: #405064 !important;
  font-weight: 800;
}

.role-page-shell .users-role-badge.badge-sektor-red {
  background: #fff5f5 !important;
  border-color: #f3d4d4 !important;
  color: #944343 !important;
}

.role-page-shell .users-role-badge.badge-sektor-green {
  background: #f2fbf6 !important;
  border-color: #d1eddd !important;
  color: #327a55 !important;
}

.role-page-shell .users-role-badge.badge-sektor-orange {
  background: #fff8f1 !important;
  border-color: #f5dcc2 !important;
  color: #9a5a22 !important;
}

.role-page-shell .users-role-badge.badge-sektor-sky {
  background: #f3f9ff !important;
  border-color: #d8ebfb !important;
  color: #377da8 !important;
}

.role-page-shell .users-role-badge.badge-sektor-red i { color: #b95b5b; }
.role-page-shell .users-role-badge.badge-sektor-green i { color: #54a475; }
.role-page-shell .users-role-badge.badge-sektor-orange i { color: #c47a3a; }
.role-page-shell .users-role-badge.badge-sektor-sky i { color: #5a9fc5; }

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
    width: 100%;
  }

  .users-toolbar-left,
  .users-toolbar-right {
    width: 100%;
  }

  .users-toolbar-left {
    flex: 0 1 auto;
  }

  .users-toolbar-right {
    flex: 0 0 auto;
  }

  .role-search {
    max-width: none;
  }
}

@media (max-width: 767.98px) {
  .role-page-shell {
    gap: 12px;
    overflow-x: hidden;
  }

  .role-hero-card {
    border-radius: 14px;
    padding: 18px;
  }

  .role-hero-copy h2 {
    font-size: 20px;
  }

  .role-hero-copy p {
    max-width: 100%;
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

  .users-search-tabs,
  .users-view-switch-card,
  .users-toolbar-search,
  .users-toolbar-right,
  .users-toolbar-left,
  .role-rows-selector {
    width: 100%;
  }

  .role-toolbar-card,
  .users-toolbar-left {
    gap: 12px;
  }

  .users-view-switch-btn {
    flex: 1 1 0;
    justify-content: center;
    min-width: 0;
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

  .role-table-card .stakeholder-table-wrap,
  .users-pic-reminder-wrap {
    margin: 0;
    overflow-x: auto;
    width: 100%;
  }

  .users-pic-reminder-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .role-table-card .stakeholders-table-shell {
    overflow-x: auto;
  }

  .role-table-card .stakeholders-pagination {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 576px) {
  .role-hero-card,
  .role-toolbar-card {
    padding-left: 14px;
    padding-right: 14px;
  }

  .role-toolbar-card {
    gap: 10px;
    padding-bottom: 14px;
    padding-top: 14px;
  }

  .users-toolbar-left {
    gap: 10px;
  }

  .role-stats-grid {
    grid-template-columns: 1fr;
  }

  .role-stat-card {
    align-items: center;
    flex-direction: row;
    min-height: 76px;
  }

  .users-view-switch-card,
  .users-search-tabs {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .users-view-switch-btn,
  .users-search-tab {
    justify-content: center;
    width: 100%;
  }

  .role-search {
    flex-basis: auto;
    min-width: 0;
  }

  .role-table-card .th-no,
  .role-table-card .stakeholder-row td:first-child,
  .role-table-card .stakeholder-thead th:nth-child(3),
  .role-table-card .stakeholder-row td:nth-child(3),
  .role-table-card .stakeholder-thead th:nth-child(4),
  .role-table-card .stakeholder-row td:nth-child(4) {
    display: table-cell !important;
  }

  .role-table-card .users-list-table {
    min-width: 1160px;
  }

  .role-table-card .stakeholder-row td {
    padding: 16px;
  }
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

html[data-theme-mode="dark"] .user-access-company-note,
html.dark .user-access-company-note,
.dark-mode .user-access-company-note {
  background: rgba(15, 23, 42, 0.72) !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
}

html[data-theme-mode="dark"] .user-access-company-note strong,
html.dark .user-access-company-note strong,
.dark-mode .user-access-company-note strong {
  color: #f8fafc !important;
}

html[data-theme-mode="dark"] .user-access-company-note span,
html.dark .user-access-company-note span,
.dark-mode .user-access-company-note span {
  color: #cbd5e1 !important;
}

html[data-theme-mode="dark"] .user-access-company-note.is-ok,
html.dark .user-access-company-note.is-ok,
.dark-mode .user-access-company-note.is-ok {
  border-color: rgba(94, 234, 212, 0.28) !important;
}

html[data-theme-mode="dark"] .user-access-company-note.is-warning,
html[data-theme-mode="dark"] .user-access-company-note.is-duplicate,
html.dark .user-access-company-note.is-warning,
html.dark .user-access-company-note.is-duplicate,
.dark-mode .user-access-company-note.is-warning,
.dark-mode .user-access-company-note.is-duplicate {
  border-color: rgba(252, 165, 165, 0.28) !important;
}

html[data-theme-mode="dark"] .user-access-company-note.is-missing,
html[data-theme-mode="dark"] .user-access-company-note.is-unlinked,
html.dark .user-access-company-note.is-missing,
html.dark .user-access-company-note.is-unlinked,
.dark-mode .user-access-company-note.is-missing,
.dark-mode .user-access-company-note.is-unlinked {
  border-color: rgba(253, 186, 116, 0.28) !important;
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
html[data-theme-mode="dark"] .users-view-switch-card,
html.dark .users-view-switch-card,
.dark-mode .users-view-switch-card,
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

html[data-theme-mode="dark"] .users-view-switch-btn,
html.dark .users-view-switch-btn,
.dark-mode .users-view-switch-btn {
  color: #9fb0c5 !important;
}

html[data-theme-mode="dark"] .users-view-switch-btn strong,
html.dark .users-view-switch-btn strong,
.dark-mode .users-view-switch-btn strong {
  background: rgba(15, 23, 42, 0.7) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: #a7b6c9 !important;
}

html[data-theme-mode="dark"] .users-view-switch-btn:hover,
html.dark .users-view-switch-btn:hover,
.dark-mode .users-view-switch-btn:hover,
html[data-theme-mode="dark"] .users-view-switch-btn.active,
html.dark .users-view-switch-btn.active,
.dark-mode .users-view-switch-btn.active {
  background: rgba(56, 189, 248, 0.09) !important;
  color: #a7cce0 !important;
}

html[data-theme-mode="dark"] .users-view-switch-btn--warning.active,
html.dark .users-view-switch-btn--warning.active,
.dark-mode .users-view-switch-btn--warning.active {
  background: rgba(251, 146, 60, 0.09) !important;
  color: #d7a777 !important;
}

html[data-theme-mode="dark"] .role-stat-card strong,
html.dark .role-stat-card strong,
.dark-mode .role-stat-card strong {
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

html[data-theme-mode="dark"] .users-pic-reminder-header,
html.dark .users-pic-reminder-header,
.dark-mode .users-pic-reminder-header {
  background: linear-gradient(180deg, rgba(17, 24, 39, 0.94), rgba(15, 23, 42, 0.92)) !important;
  border-bottom-color: rgba(148, 163, 184, 0.16) !important;
}

html[data-theme-mode="dark"] .users-pic-reminder-header h3,
html.dark .users-pic-reminder-header h3,
.dark-mode .users-pic-reminder-header h3 {
  color: #e5edf7 !important;
}

html[data-theme-mode="dark"] .users-pic-reminder-header p,
html.dark .users-pic-reminder-header p,
.dark-mode .users-pic-reminder-header p,
html[data-theme-mode="dark"] .users-reminder-subtext,
html.dark .users-reminder-subtext,
.dark-mode .users-reminder-subtext {
  color: #94a3b8 !important;
}

html[data-theme-mode="dark"] .users-pic-reminder-kicker,
html.dark .users-pic-reminder-kicker,
.dark-mode .users-pic-reminder-kicker,
html[data-theme-mode="dark"] .users-pic-reminder-count,
html.dark .users-pic-reminder-count,
.dark-mode .users-pic-reminder-count,
html[data-theme-mode="dark"] .users-reminder-action,
html.dark .users-reminder-action,
.dark-mode .users-reminder-action {
  color: #d7a777 !important;
}

html[data-theme-mode="dark"] .users-pic-reminder-count,
html.dark .users-pic-reminder-count,
.dark-mode .users-pic-reminder-count,
html[data-theme-mode="dark"] .users-reminder-action,
html.dark .users-reminder-action,
.dark-mode .users-reminder-action {
  background: rgba(251, 146, 60, 0.09) !important;
  border-color: rgba(253, 186, 116, 0.22) !important;
}

html[data-theme-mode="dark"] .users-reminder-select,
html.dark .users-reminder-select,
.dark-mode .users-reminder-select {
  background-color: rgba(15, 23, 42, 0.72) !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
  color: #dbe7f3 !important;
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

html[data-theme-mode="dark"] .users-email-text,
html[data-theme-mode="dark"] .users-company-text,
html.dark .users-email-text,
html.dark .users-company-text,
.dark-mode .users-email-text,
.dark-mode .users-company-text {
  color: #d6e0ed !important;
}

html[data-theme-mode="dark"] .users-created-note,
html.dark .users-created-note,
.dark-mode .users-created-note {
  background: rgba(15, 23, 42, 0.72) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: #94a3b8 !important;
}

html[data-theme-mode="dark"] .users-new-account-badge,
html.dark .users-new-account-badge,
.dark-mode .users-new-account-badge {
  background: rgba(34, 211, 238, 0.1) !important;
  border-color: rgba(103, 232, 249, 0.32) !important;
  color: #67e8f9 !important;
}

html[data-theme-mode="dark"] .users-inline-status.is-active,
html.dark .users-inline-status.is-active,
.dark-mode .users-inline-status.is-active {
  color: #99f6e4 !important;
}

html[data-theme-mode="dark"] .users-inline-status.is-inactive,
html.dark .users-inline-status.is-inactive,
.dark-mode .users-inline-status.is-inactive {
  color: #fde68a !important;
}

html[data-theme-mode="dark"] .users-company-chip--count,
html.dark .users-company-chip--count,
.dark-mode .users-company-chip--count {
  background: rgba(96, 165, 250, 0.11) !important;
  border-color: rgba(147, 197, 253, 0.28) !important;
  color: #93c5fd !important;
}

html[data-theme-mode="dark"] .users-company-chip--pic.is-ok,
html.dark .users-company-chip--pic.is-ok,
.dark-mode .users-company-chip--pic.is-ok {
  background: rgba(45, 212, 191, 0.1) !important;
  border-color: rgba(94, 234, 212, 0.32) !important;
  color: #5eead4 !important;
}

html[data-theme-mode="dark"] .users-company-chip--pic.is-missing,
html.dark .users-company-chip--pic.is-missing,
.dark-mode .users-company-chip--pic.is-missing {
  background: rgba(251, 146, 60, 0.11) !important;
  border-color: rgba(253, 186, 116, 0.32) !important;
  color: #fdba74 !important;
}

html[data-theme-mode="dark"] .users-company-chip--pic.is-duplicate,
html.dark .users-company-chip--pic.is-duplicate,
.dark-mode .users-company-chip--pic.is-duplicate {
  background: rgba(248, 113, 113, 0.11) !important;
  border-color: rgba(252, 165, 165, 0.32) !important;
  color: #fca5a5 !important;
}

html[data-theme-mode="dark"] .users-company-chip--pic.is-unlinked,
html.dark .users-company-chip--pic.is-unlinked,
.dark-mode .users-company-chip--pic.is-unlinked {
  background: rgba(15, 23, 42, 0.72) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: #94a3b8 !important;
}

html[data-theme-mode="dark"] .users-empty-text,
html.dark .users-empty-text,
.dark-mode .users-empty-text {
  color: #94a3b8 !important;
}

html[data-theme-mode="dark"] .users-jabatan-badge,
html.dark .users-jabatan-badge,
.dark-mode .users-jabatan-badge {
  background: rgba(15, 23, 42, 0.72) !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
  color: #e2e8f0 !important;
}

html[data-theme-mode="dark"] .role-table-card .stakeholders-pagination,
html.dark .role-table-card .stakeholders-pagination,
.dark-mode .role-table-card .stakeholders-pagination {
  background: rgba(15, 23, 42, 0.94) !important;
  border-top-color: rgba(148, 163, 184, 0.16) !important;
}

html[data-theme-mode="dark"] .role-table-card .stakeholders-action-btn,
html.dark .role-table-card .stakeholders-action-btn,
.dark-mode .role-table-card .stakeholders-action-btn {
  box-shadow: none !important;
}

html[data-theme-mode="dark"] .role-table-card .stakeholders-action-btn.btn-info-light,
html.dark .role-table-card .stakeholders-action-btn.btn-info-light,
.dark-mode .role-table-card .stakeholders-action-btn.btn-info-light {
  background: rgba(56, 189, 248, 0.1) !important;
  border-color: rgba(125, 211, 252, 0.2) !important;
  color: #8fc5df !important;
}

html[data-theme-mode="dark"] .role-table-card .stakeholders-action-btn.btn-success-light,
html.dark .role-table-card .stakeholders-action-btn.btn-success-light,
.dark-mode .role-table-card .stakeholders-action-btn.btn-success-light {
  background: rgba(52, 211, 153, 0.1) !important;
  border-color: rgba(110, 231, 183, 0.2) !important;
  color: #9ad8be !important;
}

html[data-theme-mode="dark"] .role-table-card .stakeholders-action-btn.btn-danger-light,
html.dark .role-table-card .stakeholders-action-btn.btn-danger-light,
.dark-mode .role-table-card .stakeholders-action-btn.btn-danger-light {
  background: rgba(248, 113, 113, 0.1) !important;
  border-color: rgba(252, 165, 165, 0.2) !important;
  color: #dfa3a3 !important;
}

html[data-theme-mode="dark"] .role-table-card .stakeholders-action-btn:hover,
html.dark .role-table-card .stakeholders-action-btn:hover,
.dark-mode .role-table-card .stakeholders-action-btn:hover,
html[data-theme-mode="dark"] .role-table-card .stakeholders-action-btn:focus-visible,
html.dark .role-table-card .stakeholders-action-btn:focus-visible,
.dark-mode .role-table-card .stakeholders-action-btn:focus-visible {
  background: rgba(51, 65, 85, 0.72) !important;
  border-color: rgba(148, 163, 184, 0.34) !important;
}

html[data-theme-mode="dark"] .role-page-shell .badge-sektor,
html.dark .role-page-shell .badge-sektor,
.dark-mode .role-page-shell .badge-sektor,
html[data-theme-mode="dark"] .user-access-modal .badge-sektor,
html.dark .user-access-modal .badge-sektor,
.dark-mode .user-access-modal .badge-sektor {
  align-items: center;
  border-width: 1px !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
  display: inline-flex;
  gap: 4px;
}

html[data-theme-mode="dark"] .role-page-shell .badge-sektor-teal,
html.dark .role-page-shell .badge-sektor-teal,
.dark-mode .role-page-shell .badge-sektor-teal,
html[data-theme-mode="dark"] .user-access-modal .badge-sektor-teal,
html.dark .user-access-modal .badge-sektor-teal,
.dark-mode .user-access-modal .badge-sektor-teal {
  background: rgba(45, 212, 191, 0.1) !important;
  border-color: rgba(94, 234, 212, 0.42) !important;
  color: #5eead4 !important;
}

html[data-theme-mode="dark"] .role-page-shell .badge-sektor-amber,
html.dark .role-page-shell .badge-sektor-amber,
.dark-mode .role-page-shell .badge-sektor-amber,
html[data-theme-mode="dark"] .user-access-modal .badge-sektor-amber,
html.dark .user-access-modal .badge-sektor-amber,
.dark-mode .user-access-modal .badge-sektor-amber {
  background: rgba(250, 204, 21, 0.1) !important;
  border-color: rgba(253, 224, 71, 0.42) !important;
  color: #facc15 !important;
}

html[data-theme-mode="dark"] .role-page-shell .badge-sektor-red,
html.dark .role-page-shell .badge-sektor-red,
.dark-mode .role-page-shell .badge-sektor-red,
html[data-theme-mode="dark"] .user-access-modal .badge-sektor-red,
html.dark .user-access-modal .badge-sektor-red,
.dark-mode .user-access-modal .badge-sektor-red {
  background: rgba(248, 113, 113, 0.11) !important;
  border-color: rgba(252, 165, 165, 0.4) !important;
  color: #fca5a5 !important;
}

html[data-theme-mode="dark"] .role-page-shell .badge-sektor-green,
html.dark .role-page-shell .badge-sektor-green,
.dark-mode .role-page-shell .badge-sektor-green,
html[data-theme-mode="dark"] .user-access-modal .badge-sektor-green,
html.dark .user-access-modal .badge-sektor-green,
.dark-mode .user-access-modal .badge-sektor-green {
  background: rgba(74, 222, 128, 0.11) !important;
  border-color: rgba(134, 239, 172, 0.4) !important;
  color: #86efac !important;
}

html[data-theme-mode="dark"] .role-page-shell .badge-sektor-orange,
html.dark .role-page-shell .badge-sektor-orange,
.dark-mode .role-page-shell .badge-sektor-orange,
html[data-theme-mode="dark"] .user-access-modal .badge-sektor-orange,
html.dark .user-access-modal .badge-sektor-orange,
.dark-mode .user-access-modal .badge-sektor-orange {
  background: rgba(251, 146, 60, 0.11) !important;
  border-color: rgba(253, 186, 116, 0.4) !important;
  color: #fdba74 !important;
}

html[data-theme-mode="dark"] .role-page-shell .badge-sektor-sky,
html.dark .role-page-shell .badge-sektor-sky,
.dark-mode .role-page-shell .badge-sektor-sky,
html[data-theme-mode="dark"] .user-access-modal .badge-sektor-sky,
html.dark .user-access-modal .badge-sektor-sky,
.dark-mode .user-access-modal .badge-sektor-sky {
  background: rgba(56, 189, 248, 0.11) !important;
  border-color: rgba(125, 211, 252, 0.4) !important;
  color: #7dd3fc !important;
}

html[data-theme-mode="dark"] .role-page-shell .users-role-badge,
html.dark .role-page-shell .users-role-badge,
.dark-mode .role-page-shell .users-role-badge {
  background: rgba(30, 41, 59, 0.68) !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
  color: #c8d4e2 !important;
}

html[data-theme-mode="dark"] .role-page-shell .users-role-badge.badge-sektor-red,
html.dark .role-page-shell .users-role-badge.badge-sektor-red,
.dark-mode .role-page-shell .users-role-badge.badge-sektor-red {
  background: rgba(248, 113, 113, 0.1) !important;
  border-color: rgba(252, 165, 165, 0.24) !important;
  color: #e8a5a5 !important;
}

html[data-theme-mode="dark"] .role-page-shell .users-role-badge.badge-sektor-green,
html.dark .role-page-shell .users-role-badge.badge-sektor-green,
.dark-mode .role-page-shell .users-role-badge.badge-sektor-green {
  background: rgba(74, 222, 128, 0.09) !important;
  border-color: rgba(134, 239, 172, 0.22) !important;
  color: #a9d9b8 !important;
}

html[data-theme-mode="dark"] .role-page-shell .users-role-badge.badge-sektor-orange,
html.dark .role-page-shell .users-role-badge.badge-sektor-orange,
.dark-mode .role-page-shell .users-role-badge.badge-sektor-orange {
  background: rgba(251, 146, 60, 0.09) !important;
  border-color: rgba(253, 186, 116, 0.22) !important;
  color: #e3b285 !important;
}

html[data-theme-mode="dark"] .role-page-shell .users-role-badge.badge-sektor-sky,
html.dark .role-page-shell .users-role-badge.badge-sektor-sky,
.dark-mode .role-page-shell .users-role-badge.badge-sektor-sky {
  background: rgba(56, 189, 248, 0.09) !important;
  border-color: rgba(125, 211, 252, 0.22) !important;
  color: #a7cce0 !important;
}

html[data-theme-mode="dark"] .role-page-shell .users-role-badge.badge-sektor-red i,
html.dark .role-page-shell .users-role-badge.badge-sektor-red i,
.dark-mode .role-page-shell .users-role-badge.badge-sektor-red i { color: #e8a5a5 !important; }

html[data-theme-mode="dark"] .role-page-shell .users-role-badge.badge-sektor-green i,
html.dark .role-page-shell .users-role-badge.badge-sektor-green i,
.dark-mode .role-page-shell .users-role-badge.badge-sektor-green i { color: #a9d9b8 !important; }

html[data-theme-mode="dark"] .role-page-shell .users-role-badge.badge-sektor-orange i,
html.dark .role-page-shell .users-role-badge.badge-sektor-orange i,
.dark-mode .role-page-shell .users-role-badge.badge-sektor-orange i { color: #e3b285 !important; }

html[data-theme-mode="dark"] .role-page-shell .users-role-badge.badge-sektor-sky i,
html.dark .role-page-shell .users-role-badge.badge-sektor-sky i,
.dark-mode .role-page-shell .users-role-badge.badge-sektor-sky i { color: #a7cce0 !important; }

html[data-theme-mode="dark"] .users-company-chip--count,
html.dark .users-company-chip--count,
.dark-mode .users-company-chip--count,
html[data-theme-mode="dark"] .users-company-chip--pic.is-ok,
html.dark .users-company-chip--pic.is-ok,
.dark-mode .users-company-chip--pic.is-ok {
  background: rgba(15, 23, 42, 0.72) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: #a7b6c9 !important;
}

html[data-theme-mode="dark"] .users-company-chip--pic.is-missing,
html.dark .users-company-chip--pic.is-missing,
.dark-mode .users-company-chip--pic.is-missing {
  background: rgba(251, 146, 60, 0.08) !important;
  border-color: rgba(253, 186, 116, 0.22) !important;
  color: #d7a777 !important;
}

html[data-theme-mode="dark"] .users-company-chip--pic.is-duplicate,
html.dark .users-company-chip--pic.is-duplicate,
.dark-mode .users-company-chip--pic.is-duplicate {
  background: rgba(248, 113, 113, 0.08) !important;
  border-color: rgba(252, 165, 165, 0.22) !important;
  color: #dea0a0 !important;
}

html[data-theme-mode="dark"] .users-company-chip--button:hover,
html.dark .users-company-chip--button:hover,
.dark-mode .users-company-chip--button:hover,
html[data-theme-mode="dark"] .users-company-chip--button:focus-visible,
html.dark .users-company-chip--button:focus-visible,
.dark-mode .users-company-chip--button:focus-visible {
  background: rgba(251, 146, 60, 0.13) !important;
  border-color: rgba(253, 186, 116, 0.3) !important;
  color: #e7b889 !important;
}

html[data-theme-mode="dark"] .users-new-account-badge,
html.dark .users-new-account-badge,
.dark-mode .users-new-account-badge {
  background: rgba(52, 211, 153, 0.1) !important;
  border-color: rgba(110, 231, 183, 0.22) !important;
  color: #9ad8be !important;
}
</style>



