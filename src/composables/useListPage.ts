import { ref, computed, watch, type ComputedRef } from "vue";

/**
 * Shared composable for list-page components (users-list, stakeholders, etc.)
 * Handles: search, pagination, sort, toast notifications, avatar color
 */
export function useListPage(initialSortField = "name") {
  const searchQuery   = ref("");
  const currentPage   = ref(1);
  const itemsPerPage  = ref(10);
  const sortField     = ref(initialSortField);
  const sortOrder     = ref<"asc" | "desc">("asc");

  // ── Toast ──────────────────────────────────────────────────────────────
  const showToast    = ref(false);
  const toastMessage = ref("");
  const toastType    = ref<"success" | "error">("success");

  const showNotification = (msg: string, type: "success" | "error" = "success") => {
    toastMessage.value = msg;
    toastType.value    = type;
    showToast.value    = true;
    setTimeout(() => (showToast.value = false), 3000);
  };

  // ── Search / Sort ──────────────────────────────────────────────────────
  const clearSearch = () => {
    searchQuery.value  = "";
    currentPage.value  = 1;
  };

  const toggleSort = (f: string) => {
    if (sortField.value === f)
      sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
    else { sortField.value = f; sortOrder.value = "asc"; }
  };

  // ── Avatar colour ──────────────────────────────────────────────────────
  const getAvatarColorClass = (letter: string) => {
    const v = [
      "avatar-blue","avatar-indigo","avatar-violet","avatar-purple",
      "avatar-teal","avatar-cyan","avatar-green","avatar-amber",
      "avatar-orange","avatar-red",
    ];
    return v[(letter.toUpperCase().charCodeAt(0) - 65 + v.length) % v.length];
  };

  // ── Pagination (call after filteredData is defined) ───────────────────
  const makePagination = (filteredData: ComputedRef<any[]>) => ({
    totalPages: computed(() =>
      Math.ceil(filteredData.value.length / itemsPerPage.value)
    ),
    displayData: computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredData.value.slice(start, start + itemsPerPage.value);
    }),
    paginationInfo: computed(() => {
      const total = filteredData.value.length;
      if (!total) return "Tidak ada data";
      const s = (currentPage.value - 1) * itemsPerPage.value + 1;
      const e = Math.min(currentPage.value * itemsPerPage.value, total);
      return `${s} - ${e} dari ${total}`;
    }),
  });

  watch([searchQuery, itemsPerPage], () => (currentPage.value = 1));

  return {
    searchQuery, currentPage, itemsPerPage, sortField, sortOrder,
    showToast, toastMessage, toastType, showNotification,
    clearSearch, toggleSort, getAvatarColorClass, makePagination,
  };
}
