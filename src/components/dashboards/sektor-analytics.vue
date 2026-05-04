<script setup>
import { ref, computed, onMounted, watch } from "vue";
import {
  sektorService,
  subSektorService,
  getSektorName,
  getSubSektorName,
  getSubSektorParentId,
} from "@/services/sektor.service";
import { useRouter } from "vue-router";
import { useStakeholdersStore } from "@/stores/stakeholders";
import { useDashboardFilterStore } from "@/stores/dashboardFilter";

// ─── State ──────────────────────────────────────────────
const props = defineProps({
  sektorList: { type: Array, default: () => [] },
  subSektorList: { type: Array, default: () => [] },
});

const sektorList = ref([]);
const subSektorList = ref([]);
const loading = ref(true);
const error = ref(null);
const stakeholdersStore = useStakeholdersStore();
const filterStore = useDashboardFilterStore();
const router = useRouter();

// ─── Filters ────────────────────────────────────────────
const searchQuery = ref("");
const selectedSektorId = computed({
  get: () => filterStore.sektorId || "",
  set: (value) => filterStore.setSektorId(value || ""),
});
const selectedSubSektorId = computed({
  get: () => (filterStore.subSektorId === "ALL" ? "" : filterStore.subSektorId || ""),
  set: (value) => filterStore.setSubSektorId(value || ""),
});
const sortBy = ref("name"); // 'name' | 'count'
const sortOrder = ref("asc"); // 'asc' | 'desc'
const viewMode = ref("overview"); // 'overview' | 'table' | 'cards'
const chartLevel = ref("sektor"); // 'sektor' | 'subsektor'
const expandedSektors = ref(new Set());
const isReady = ref(false);
let fetchSeq = 0;

const hasProvidedOptions = computed(() => props.sektorList.length > 0 && props.subSektorList.length > 0);

const syncProvidedOptions = () => {
  if (!hasProvidedOptions.value) return false;
  sektorList.value = props.sektorList;
  subSektorList.value = props.subSektorList;
  return true;
};

// ─── Color Palette ──────────────────────────────────────
const sektorColors = [
  "#2563eb", "#059669", "#ea580c", "#0d9488",
  "#ca8a04", "#dc2626", "#0ea5e9", "#0891b2",
  "#65a30d", "#4f46e5", "#0f766e", "#b45309",
  "#1d4ed8", "#b91c1c", "#475569", "#047857",
];

const sektorColorRules = [
  { keywords: ["agro", "surveyor", "jasa konstruksi"], color: "#2563eb" },
  { keywords: ["kimia", "farmasi", "tekstil", "ikft"], color: "#059669" },
  { keywords: ["logam", "mesin", "alat transportasi", "elektronika", "ilmate"], color: "#ea580c" },
  { keywords: ["kawasan industri"], color: "#0d9488" },
];

const getSektorColor = (index, sektorName = "") => {
  const normalized = String(sektorName || "").toLowerCase();
  const matchedRule = sektorColorRules.find((rule) =>
    rule.keywords.some((keyword) => normalized.includes(keyword))
  );
  return matchedRule?.color || sektorColors[index % sektorColors.length];
};

const hexToRgb = (hex) => {
  const normalized = String(hex || "").replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return { r: 37, g: 99, b: 235 };
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const rgbToHex = ({ r, g, b }) =>
  "#" + [r, g, b].map((value) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0")
  ).join("");

const mixColor = (hex, mixHex, amount) => {
  const base = hexToRgb(hex);
  const mix = hexToRgb(mixHex);
  return rgbToHex({
    r: base.r + (mix.r - base.r) * amount,
    g: base.g + (mix.g - base.g) * amount,
    b: base.b + (mix.b - base.b) * amount,
  });
};

const getSubSektorChartColor = (parentColor, subIndex) => {
  const variants = [
    parentColor,
    mixColor(parentColor, "#ffffff", 0.22),
    mixColor(parentColor, "#0f172a", 0.16),
    mixColor(parentColor, "#ffffff", 0.36),
    mixColor(parentColor, "#0f172a", 0.28),
    mixColor(parentColor, "#38bdf8", 0.18),
  ];
  return variants[subIndex % variants.length];
};

// ─── Fetch Data ─────────────────────────────────────────
const fetchData = async () => {
  const token = ++fetchSeq;
  loading.value = true;
  error.value = null;
  try {
    const optionsPromise = syncProvidedOptions()
      ? Promise.resolve()
      : (async () => {
          const [sektors, subSektors] = await Promise.all([
            sektorService.getAll(),
            subSektorService.getAll(),
          ]);
          if (token !== fetchSeq) return;
          sektorList.value = Array.isArray(sektors) ? sektors : [];
          subSektorList.value = Array.isArray(subSektors) ? subSektors : [];
        })();

    await Promise.all([
      optionsPromise,
      stakeholdersStore.initialized ? Promise.resolve() : stakeholdersStore.initialize(),
    ]);
  } catch (e) {
    console.error("Failed to fetch sektor data:", e);
    error.value = "Gagal memuat data stakeholder. Pastikan API tersedia.";
  } finally {
    if (token === fetchSeq) loading.value = false;
  }
};

onMounted(async () => {
  await fetchData();
  setTimeout(() => {
    isReady.value = true;
  }, 160);
});

watch(
  () => [props.sektorList, props.subSektorList],
  () => {
    if (syncProvidedOptions()) {
      error.value = null;
      loading.value = false;
      isReady.value = true;
    }
  },
  { deep: true }
);

// ─── Computed: Enriched Sektor Data ─────────────────────

/**
 * Resolve the sub_sektor ID from a stakeholder.
 * Strategy priority:
 * 1. sub_sektor.id  (nested object from API response)
 * 2. id_sub_sektor  (flat field, if API sends it)
 * 3. Lookup by nama: match s.sektor (legacy name field) against sub sektor list
 */
const resolveSubSektorId = (s, subSektors) => {
  // 1. Nested object
  if (s.sub_sektor?.id) return String(s.sub_sektor.id);
  // 2. Flat field (some API responses include this)
  if (s.id_sub_sektor) return String(s.id_sub_sektor);
  // 3. Name-based fallback: match legacy sektor string against sub sektor names
  if (s.sektor) {
    const matched = subSektors.find(ss => getSubSektorName(ss) === s.sektor);
    if (matched) return String(matched.id);
  }
  return null;
};

/**
 * Resolve the parent sektor ID from a stakeholder.
 * This is needed for stakeholders where we can identify the sektor
 * via the nested sub_sektor.id_sektor field.
 */
const resolveSektorId = (s, subSektors) => {
  // 1. Nested object has id_sektor
  if (s.sub_sektor?.id_sektor) return String(s.sub_sektor.id_sektor);
  // 2. Flat field
  if (s.id_sub_sektor) {
    const matched = subSektors.find(ss => String(ss.id) === String(s.id_sub_sektor));
    if (matched) {
      const pid = getSubSektorParentId(matched);
      return pid !== undefined ? String(pid) : null;
    }
  }
  // 3. Name-based fallback
  if (s.sektor) {
    const matched = subSektors.find(ss => getSubSektorName(ss) === s.sektor);
    if (matched) {
      const pid = getSubSektorParentId(matched);
      return pid !== undefined ? String(pid) : null;
    }
  }
  return null;
};

const isInDateRange = (createdAt, range) => {
  if (!range || (!range[0] && !range[1])) return true;
  if (!createdAt) return false;

  const date = new Date(createdAt);
  if (isNaN(date.getTime())) return false;

  const start = range[0] ? new Date(range[0]) : null;
  const end = range[1] ? new Date(range[1]) : null;
  if (start) start.setHours(0, 0, 0, 0);
  if (end) end.setHours(23, 59, 59, 999);

  return (!start || date >= start) && (!end || date <= end);
};

const analyticsStakeholders = computed(() => {
  return stakeholdersStore.allStakeholders.filter((stakeholder) =>
    isInDateRange(stakeholder.created_at || stakeholder.updated_at, filterStore.dateRange)
  );
});

const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase());

const stakeholderMatchesSearch = (stakeholder, q) => {
  if (!q) return true;
  return [
    stakeholder?.nama_perusahaan,
    stakeholder?.nama,
    stakeholder?.email,
    stakeholder?.telepon,
    stakeholder?.alamat,
  ].some((value) => String(value || "").toLowerCase().includes(q));
};

const getStakeholdersBySubSektorId = (subSektorId, q = "") => {
  return analyticsStakeholders.value.filter((stakeholder) => {
    const stakeholderSubSektorId = resolveSubSektorId(stakeholder, subSektorList.value);
    return stakeholderSubSektorId
      && String(stakeholderSubSektorId) === String(subSektorId)
      && stakeholderMatchesSearch(stakeholder, q);
  });
};

const enrichedSektors = computed(() => {
  const allStakeholders = analyticsStakeholders.value;
  const allSubSektors = subSektorList.value;

  return sektorList.value.map((sektor, idx) => {
    const children = allSubSektors.filter((ss) => {
      const pid = getSubSektorParentId(ss);
      return pid !== undefined && String(pid) === String(sektor.id);
    });
    const childIds = new Set(children.map(c => String(c.id)));

    // Stakeholders in this sektor (via sub_sektor)
    const sektorStakeholders = allStakeholders.filter(s => {
      const ssId = resolveSubSektorId(s, allSubSektors);
      return ssId && childIds.has(ssId);
    });

    const subSektors = children.map((ss) => {
      const ssStakeholders = allStakeholders.filter(s => {
        const ssId = resolveSubSektorId(s, allSubSektors);
        return ssId && ssId === String(ss.id);
      });
      return {
        ...ss,
        displayName: getSubSektorName(ss),
        stakeholderCount: ssStakeholders.length,
      };
    });

    const displayName = getSektorName(sektor);

    return {
      ...sektor,
      displayName,
      color: getSektorColor(idx, displayName),
      stakeholderCount: sektorStakeholders.length,
      subSektors,
      subSektorCount: children.length,
    };
  });
});


// ─── Computed: Filtered & Sorted Data ───────────────────
const filteredSektors = computed(() => {
  let data = enrichedSektors.value;

  // Filter by selected sektor
  if (selectedSektorId.value) {
    data = data.filter(
      (s) => String(s.id) === String(selectedSektorId.value)
    );
  }

  // Filter by selected sub sektor (show only the parent sektor containing that sub)
  if (selectedSubSektorId.value) {
    data = data.filter((s) =>
      s.subSektors.some(
        (ss) => String(ss.id) === String(selectedSubSektorId.value)
      )
    );
    // Also filter the sub sektors within each sektor to only the selected one
    data = data.map((s) => {
      const subSektors = s.subSektors.filter(
        (ss) => String(ss.id) === String(selectedSubSektorId.value)
      );

      return {
        ...s,
        subSektors,
        subSektorCount: subSektors.length,
        stakeholderCount: subSektors.reduce((total, subSektor) => total + subSektor.stakeholderCount, 0),
      };
    });
  }

  // Filter by search, including stakeholder names inside sub sectors.
  if (normalizedSearchQuery.value) {
    const q = normalizedSearchQuery.value;
    data = data
      .map((sektor) => {
        const sektorMatches = sektor.displayName.toLowerCase().includes(q);
        if (sektorMatches) return sektor;

        const subSektors = sektor.subSektors
          .map((subSektor) => {
            const subSektorMatches = subSektor.displayName.toLowerCase().includes(q);
            const matchedStakeholders = getStakeholdersBySubSektorId(subSektor.id, q);

            if (!subSektorMatches && !matchedStakeholders.length) return null;

            return {
              ...subSektor,
              stakeholderCount: subSektorMatches
                ? subSektor.stakeholderCount
                : matchedStakeholders.length,
            };
          })
          .filter(Boolean);

        return {
          ...sektor,
          subSektors,
          subSektorCount: subSektors.length,
          stakeholderCount: subSektors.reduce((total, subSektor) => total + subSektor.stakeholderCount, 0),
        };
      })
      .filter((sektor) => sektor.subSektors.length || sektor.displayName.toLowerCase().includes(q));
  }

  // Sort
  data = [...data].sort((a, b) => {
    const mod = sortOrder.value === "asc" ? 1 : -1;
    if (sortBy.value === "count") {
      return (a.stakeholderCount - b.stakeholderCount) * mod;
    }
    return a.displayName.localeCompare(b.displayName) * mod;
  });

  return data;
});

const maxFilteredStakeholderCount = computed(() => {
  if (!filteredSektors.value.length) return 1;
  return Math.max(1, ...filteredSektors.value.map((sektor) => sektor.stakeholderCount || 0));
});

const maxFilteredSubSektorStakeholderCount = computed(() => {
  if (!groupedSubSektorStakeholders.value.length) return 1;
  return Math.max(1, ...groupedSubSektorStakeholders.value.map((group) => group.stakeholders.length || 0));
});

// Active filter count for badge
const activeFilterCount = computed(() => {
  let count = 0;
  if (normalizedSearchQuery.value) count++;
  if (selectedSektorId.value) count++;
  if (selectedSubSektorId.value) count++;
  if (sortBy.value !== "name" || sortOrder.value !== "asc") count++;
  return count;
});

// ─── Computed: Filtered Sub Sektors (for sub sektor dropdown) ───
const filteredSubSektorOptions = computed(() => {
  if (!selectedSektorId.value) return subSektorList.value;
  return subSektorList.value.filter((ss) => {
    const pid = getSubSektorParentId(ss);
    return pid !== undefined && String(pid) === String(selectedSektorId.value);
  });
});

const selectedSektorName = computed(() => (
  enrichedSektors.value.find((sektor) => String(sektor.id) === String(selectedSektorId.value))?.displayName || "Sektor"
));

const selectedSubSektorName = computed(() => (
  subSektorList.value.find((subSektor) => String(subSektor.id) === String(selectedSubSektorId.value))
    ? getSubSektorName(subSektorList.value.find((subSektor) => String(subSektor.id) === String(selectedSubSektorId.value)))
    : "Sub Sektor"
));

// ─── Computed: Stats ────────────────────────────────────
const totalSektors = computed(() => sektorList.value.length);
const totalSubSektors = computed(() => subSektorList.value.length);
const totalStakeholders = computed(() => analyticsStakeholders.value.length);
const avgStakeholderPerSektor = computed(() => {
  if (!totalSektors.value) return 0;
  return (totalStakeholders.value / totalSektors.value).toFixed(1);
});
const maxStakeholderSektor = computed(() => {
  if (!enrichedSektors.value.length) return { name: "-", count: 0 };
  const max = enrichedSektors.value.reduce((a, b) =>
    a.stakeholderCount > b.stakeholderCount ? a : b
  );
  return { name: max.displayName, count: max.stakeholderCount };
});
const minStakeholderSektor = computed(() => {
  if (!enrichedSektors.value.length) return { name: "-", count: 0 };
  const min = enrichedSektors.value.reduce((a, b) =>
    a.stakeholderCount < b.stakeholderCount ? a : b
  );
  return { name: min.displayName, count: min.stakeholderCount };
});


// ─── Computed: Flattened Sub Sektor Data (for sub-sektor level charts) ───
const flattenedSubSektors = computed(() => {
  const result = [];
  filteredSektors.value.forEach((sektor) => {
    sektor.subSektors.forEach((ss, subIndex) => {
      result.push({
        ...ss,
        parentName: sektor.displayName,
        parentColor: sektor.color,
        chartColor: getSubSektorChartColor(sektor.color, subIndex),
      });
    });
  });
  return result;
});

const groupedSubSektorStakeholders = computed(() => {
  return flattenedSubSektors.value
    .map((subSektor) => {
      const stakeholders = analyticsStakeholders.value
        .filter((stakeholder) => {
          const subSektorId = resolveSubSektorId(stakeholder, subSektorList.value);
          return subSektorId && String(subSektorId) === String(subSektor.id);
        })
        .filter((stakeholder) => {
          if (!normalizedSearchQuery.value) return true;
          const q = normalizedSearchQuery.value;
          return [
            stakeholder.nama_perusahaan,
            stakeholder.nama,
            stakeholder.email,
            subSektor.displayName,
            subSektor.parentName,
          ].some((value) => String(value || "").toLowerCase().includes(q));
        })
        .sort((a, b) =>
          String(a.nama_perusahaan || a.nama || "").localeCompare(String(b.nama_perusahaan || b.nama || ""))
        );

      return {
        ...subSektor,
        stakeholders,
      };
    })
    .filter((group) => group.stakeholders.length || selectedSubSektorId.value);
});

const openStakeholder = (stakeholder) => {
  if (stakeholder?.slug) {
    router.push(`/stakeholders/${stakeholder.slug}`);
  }
};

// ─── Computed: Chart Data Source (sektor or sub-sektor level) ───
const chartData = computed(() => {
  if (chartLevel.value === 'subsektor') {
    return {
      labels: flattenedSubSektors.value.map(ss => ss.displayName),
      values: flattenedSubSektors.value.map(ss => ss.stakeholderCount),
      colors: flattenedSubSektors.value.map(ss => ss.chartColor),
      tooltipSuffix: flattenedSubSektors.value.map(ss => ` (${ss.parentName})`),
      count: flattenedSubSektors.value.length,
    };
  }
  return {
    labels: filteredSektors.value.map(s => s.displayName),
    values: filteredSektors.value.map(s => s.stakeholderCount),
    colors: filteredSektors.value.map(s => s.color),
    tooltipSuffix: filteredSektors.value.map(() => ''),
    count: filteredSektors.value.length,
  };
});

const barChartHeight = computed(() => {
  if (chartLevel.value === "subsektor") {
    return Math.max(720, chartData.value.count * 24);
  }
  return Math.min(420, Math.max(260, chartData.value.count * 44));
});

const donutChartHeight = computed(() =>
  chartLevel.value === "subsektor" ? 420 : 330
);

// ─── Chart Options: Bar Chart ───────────────────────────
const barChartOptions = computed(() => ({
  chart: {
    type: "bar",
    toolbar: { show: true, tools: { download: true, selection: false, zoom: false, zoomin: false, zoomout: false, pan: false, reset: false } },
    fontFamily: "Inter, sans-serif",
    animations: { enabled: true },
  },
  plotOptions: {
    bar: {
      horizontal: true,
      borderRadius: 5,
      barHeight: chartLevel.value === "subsektor" ? "72%" : "58%",
      distributed: true,
    },
  },
  colors: chartData.value.colors,
  dataLabels: {
    enabled: true,
    formatter: (val) => val + " stakeholder",
    style: { fontSize: "10px", fontWeight: 700, colors: ["#fff"] },
    offsetX: 4,
  },
  xaxis: {
    categories: chartData.value.labels,
    labels: { style: { fontSize: "10px", colors: "#64748b" } },
  },
  yaxis: {
    labels: {
      style: {
        fontSize: chartLevel.value === "subsektor" ? "11px" : "10px",
        colors: "#475569",
      },
      maxWidth: chartLevel.value === "subsektor" ? 230 : 190,
    },
  },
  grid: { borderColor: "#f1f5f9", strokeDashArray: 4 },
  tooltip: {
    fixed: {
      enabled: chartLevel.value === "subsektor",
      position: "topRight",
      offsetX: -24,
      offsetY: 12,
    },
    y: { formatter: (val, opts) => {
      const suffix = chartData.value.tooltipSuffix[opts?.dataPointIndex] || '';
      return val + " stakeholder" + suffix;
    }},
    theme: "dark",
  },
  legend: { show: false },
}));

const barChartSeries = computed(() => [
  {
    name: "Stakeholder",
    data: chartData.value.values,
  },
]);

// ─── Chart Options: Donut Chart ─────────────────────────
const donutChartOptions = computed(() => ({
  chart: {
    type: "donut",
    fontFamily: "Inter, sans-serif",
    parentHeightOffset: 0,
  },
  labels: chartData.value.labels,
  colors: chartData.value.colors,
  plotOptions: {
    pie: {
      customScale: chartLevel.value === "subsektor" ? 1.3 : 1,
      offsetY: chartLevel.value === "subsektor" ? 24 : 0,
      donut: {
        size: chartLevel.value === "subsektor" ? "58%" : "64%",
        labels: {
          show: true,
          name: { fontSize: "11px", fontWeight: 700 },
          value: {
            fontSize: "18px",
            fontWeight: 800,
            formatter: (val) => val,
          },
          total: {
            show: true,
            label: "Total Stakeholder",
            fontSize: "11px",
            color: "#94a3b8",
            formatter: (w) =>
              w.globals.seriesTotals.reduce((a, b) => a + b, 0),
          },
        },
      },
    },
  },
  stroke: { width: 3, colors: ["#fff"] },
  dataLabels: { enabled: false },
  legend: {
    show: true,
    position: "bottom",
    fontSize: "10px",
    fontWeight: 600,
    markers: { width: 8, height: 8, radius: 3 },
    itemMargin: { horizontal: 6, vertical: 3 },
    offsetY: chartLevel.value === "subsektor" ? -8 : 0,
  },
  tooltip: {
    y: { formatter: (val) => val + " stakeholder" },
  },
}));

const donutChartSeries = computed(() => chartData.value.values);



// ─── Actions ────────────────────────────────────────────
const toggleExpand = (sektorId) => {
  if (expandedSektors.value.has(sektorId)) {
    expandedSektors.value.delete(sektorId);
  } else {
    expandedSektors.value.add(sektorId);
  }
  // Force reactivity
  expandedSektors.value = new Set(expandedSektors.value);
};

const resetFilters = () => {
  searchQuery.value = "";
  selectedSektorId.value = "";
  selectedSubSektorId.value = "";
  sortBy.value = "name";
  sortOrder.value = "asc";
};

const sortOptions = [
  { value: 'name', label: 'Nama' },
  { value: 'count', label: 'Jumlah Stakeholder' },
];

const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
};

watch(sortBy, (newSortBy, oldSortBy) => {
  if (newSortBy === "count" && oldSortBy !== "count") {
    sortOrder.value = "desc";
  }
});

watch(selectedSektorId, (newSektorId) => {
  if (!newSektorId || !selectedSubSektorId.value) return;

  const selectedSubSektor = subSektorList.value.find((subSektor) => String(subSektor.id) === String(selectedSubSektorId.value));
  const parentId = selectedSubSektor ? getSubSektorParentId(selectedSubSektor) : null;

  if (!parentId || String(parentId) !== String(newSektorId)) {
    selectedSubSektorId.value = "";
  }
});
</script>

<template>
  <div class="sektor-analytics">
    <!-- ═══════════ SECTION HEADER ═══════════ -->
    <div class="sa-section-header animate-show-up" :style="{ animationDelay: isReady ? '0s' : '2.6s' }">
      <div class="sa-section-header-inner">
        <div class="sa-section-icon">
          <i class="ri-building-4-fill"></i>
        </div>
        <div>
          <h2 class="sa-section-title">Analisis Stakeholder per Sektor</h2>
          <p class="sa-section-subtitle">
            Distribusi stakeholder pada setiap sektor & sub sektor industri
          </p>
        </div>
      </div>
      <div class="sa-view-toggles">
        <button
          class="sa-view-btn"
          :class="{ active: viewMode === 'overview' }"
          @click="viewMode = 'overview'"
          title="Overview"
        >
          <i class="ri-dashboard-line"></i>
        </button>
        <button
          class="sa-view-btn"
          :class="{ active: viewMode === 'table' }"
          @click="viewMode = 'table'"
          title="Table View"
        >
          <i class="ri-table-line"></i>
        </button>
        <button
          class="sa-view-btn"
          :class="{ active: viewMode === 'cards' }"
          @click="viewMode = 'cards'"
          title="Card View"
        >
          <i class="ri-layout-grid-line"></i>
        </button>
      </div>
    </div>

    <!-- ═══════════ LOADING ═══════════ -->
    <div v-if="loading" class="sa-loading">
      <div class="sa-loading-grid">
        <div class="sa-skel sa-skel-stat" v-for="n in 4" :key="n"></div>
      </div>
      <div class="sa-loading-grid sa-loading-grid-2">
        <div class="sa-skel sa-skel-chart"></div>
        <div class="sa-skel sa-skel-chart"></div>
      </div>
    </div>

    <!-- ═══════════ ERROR ═══════════ -->
    <div v-else-if="error" class="sa-error-box">
      <i class="ri-error-warning-line"></i>
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-outline-primary" @click="fetchData">
        <i class="ri-refresh-line me-1"></i>Coba Lagi
      </button>
    </div>

    <!-- ═══════════ MAIN CONTENT ═══════════ -->
    <template v-else>
      

      <!-- ──── FILTER BAR ──── -->
      <div class="sa-filter-bar animate-show-up" :style="{ animationDelay: isReady ? '0s' : '3.0s' }">
        <!-- Filter Header Row -->
        <div class="sa-filter-header">
          <div class="sa-filter-title-wrap">
            <i class="ri-filter-3-line"></i>
            <span class="sa-filter-title">Filter Stakeholder</span>
            <span v-if="activeFilterCount" class="sa-filter-badge">{{ activeFilterCount }}</span>
          </div>
          <div class="sa-filter-actions">
            <span class="sa-result-count">
              <i class="ri-database-2-line"></i>
              {{ filteredSektors.length }} / {{ enrichedSektors.length }} sektor
            </span>
            <button
              class="btn btn-sm sa-reset-btn"
              @click="resetFilters"
              :disabled="!activeFilterCount"
            >
              <i class="ri-refresh-line"></i>
              Reset
            </button>
          </div>
        </div>

        <!-- Filter Controls Row -->
        <div class="sa-filter-controls">
          <!-- Search -->
          <div class="sa-filter-item sa-search-wrap">
            <i class="ri-search-line sa-search-icon"></i>
            <input
              v-model="searchQuery"
              type="text"
              class="form-control form-control-sm sa-search-input"
              placeholder="Cari stakeholder di sektor atau sub sektor..."
            />
            <button
              v-if="searchQuery"
              class="sa-search-clear"
              @click="searchQuery = ''"
            >
              <i class="ri-close-circle-fill"></i>
            </button>
          </div>

          <!-- Sektor Dropdown -->
          <div class="sa-filter-item">
            <label class="sa-filter-label">
              <i class="ri-government-line"></i> Sektor
            </label>
            <select
              v-model="selectedSektorId"
              class="form-select form-select-sm sa-filter-select"
            >
              <option value="">Semua Sektor</option>
              <option
                v-for="s in sektorList"
                :key="s.id"
                :value="s.id"
              >
                {{ getSektorName(s) }}
              </option>
            </select>
          </div>

          <!-- Sub Sektor Dropdown -->
          <div class="sa-filter-item">
            <label class="sa-filter-label">
              <i class="ri-node-tree"></i> Sub Sektor
            </label>
            <select
              v-model="selectedSubSektorId"
              class="form-select form-select-sm sa-filter-select"
              :disabled="!filteredSubSektorOptions.length"
            >
              <option value="">Semua Sub Sektor</option>
              <option
                v-for="ss in filteredSubSektorOptions"
                :key="ss.id"
                :value="ss.id"
              >
                {{ getSubSektorName(ss) }}
              </option>
            </select>
          </div>

          <!-- Sort -->
          <div class="sa-filter-item">
            <label class="sa-filter-label">
              <i class="ri-sort-asc"></i> Urutkan
            </label>
            <div class="sa-sort-group">
              <select
                v-model="sortBy"
                class="form-select form-select-sm sa-filter-select"
              >
                <option value="name">Nama</option>
                <option value="count">Jumlah Stakeholder</option>
              </select>
              <button
                class="btn btn-sm sa-sort-btn"
                @click="toggleSortOrder"
                :title="sortOrder === 'asc' ? 'Ascending' : 'Descending'"
              >
                <i
                  :class="
                    sortOrder === 'asc'
                      ? 'ri-sort-asc'
                      : 'ri-sort-desc'
                  "
                ></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Active Filter Pills -->
        <div v-if="activeFilterCount" class="sa-active-filters">
          <span class="sa-active-label">Filter aktif:</span>
          <span v-if="searchQuery" class="sa-filter-pill">
            <i class="ri-search-line"></i> "{{ searchQuery }}"
            <button @click="searchQuery = ''" class="sa-pill-close"><i class="ri-close-line"></i></button>
          </span>
          <span v-if="selectedSektorId" class="sa-filter-pill sa-pill-sektor">
            <i class="ri-government-line"></i> {{ selectedSektorName }}
            <button @click="selectedSektorId = ''" class="sa-pill-close"><i class="ri-close-line"></i></button>
          </span>
          <span v-if="selectedSubSektorId" class="sa-filter-pill sa-pill-sub">
            <i class="ri-node-tree"></i> {{ selectedSubSektorName }}
            <button @click="selectedSubSektorId = ''" class="sa-pill-close"><i class="ri-close-line"></i></button>
          </span>
          <span v-if="sortBy !== 'name' || sortOrder !== 'asc'" class="sa-filter-pill sa-pill-sort">
            <i :class="sortOrder === 'asc' ? 'ri-sort-asc' : 'ri-sort-desc'"></i> {{ sortBy === 'name' ? 'Nama' : 'Jumlah' }} ({{ sortOrder === 'asc' ? '↑' : '↓' }})
            <button @click="sortBy = 'name'; sortOrder = 'asc'" class="sa-pill-close"><i class="ri-close-line"></i></button>
          </span>
        </div>
      </div>

      <!-- ═══════ VIEW: OVERVIEW (Charts) ═══════ -->
      <div v-if="viewMode === 'overview'" class="sa-charts-section">
        <!-- Chart Level Toggle -->
        <div class="sa-level-toggle-bar animate-show-up" :style="{ animationDelay: isReady ? '0s' : '3.1s' }">
          <div class="sa-level-toggle-label">
            <i class="ri-bar-chart-grouped-line"></i>
            <span>Tampilkan data:</span>
          </div>
          <div class="sa-level-toggle-group">
            <button
              class="sa-level-btn"
              :class="{ active: chartLevel === 'sektor' }"
              @click="chartLevel = 'sektor'"
            >
              <i class="ri-government-line"></i>
              Per Sektor
            </button>
            <button
              class="sa-level-btn"
              :class="{ active: chartLevel === 'subsektor' }"
              @click="chartLevel = 'subsektor'"
            >
              <i class="ri-node-tree"></i>
              Per Sub Sektor
            </button>
          </div>
          <span class="sa-level-info">
            <i class="ri-information-line"></i>
            {{ chartLevel === 'sektor'
              ? filteredSektors.length + ' sektor'
              : flattenedSubSektors.length + ' sub sektor'
            }}
          </span>
        </div>

        <div class="row g-3">
          <!-- Bar Chart -->
          <div
            class="col-xl-7 animate-show-up"
            :style="{ animationDelay: isReady ? '0s' : '3.2s' }"
          >
            <div class="sa-chart-card">
              <div class="sa-chart-header">
                <div class="sa-chart-header-inner">
                  <div class="sa-chart-icon">
                    <i class="ri-bar-chart-horizontal-fill"></i>
                  </div>
                  <div>
                    <div class="sa-chart-title">
                      Distribusi Stakeholder per {{ chartLevel === 'sektor' ? 'Sektor' : 'Sub Sektor' }}
                    </div>
                    <div class="sa-chart-sub">
                      Jumlah stakeholder pada masing-masing {{ chartLevel === 'sektor' ? 'sektor' : 'sub sektor' }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="sa-chart-body" :class="{ 'sa-chart-body--scroll': chartLevel === 'subsektor' }">
                <apexchart
                  v-if="chartData.count"
                  :key="'bar-' + chartLevel"
                  type="bar"
                  :height="barChartHeight"
                  :options="barChartOptions"
                  :series="barChartSeries"
                />
                <div v-else class="sa-empty-chart">
                  <i class="ri-bar-chart-2-line"></i>
                  <span>Tidak ada data</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Donut Chart -->
          <div
            class="col-xl-5 animate-show-up"
            :style="{ animationDelay: isReady ? '0s' : '3.3s' }"
          >
            <div class="sa-chart-card">
              <div class="sa-chart-header">
                <div class="sa-chart-header-inner">
                  <div class="sa-chart-icon">
                    <i class="ri-donut-chart-fill"></i>
                  </div>
                  <div>
                    <div class="sa-chart-title">Proporsi Stakeholder</div>
                    <div class="sa-chart-sub">
                      Distribusi stakeholder antar {{ chartLevel === 'sektor' ? 'sektor' : 'sub sektor' }} industri
                    </div>
                  </div>
                </div>
              </div>
              <div class="sa-chart-body sa-chart-body--donut">
                <apexchart
                  v-if="chartData.count"
                  :key="'donut-' + chartLevel"
                  type="donut"
                  :height="donutChartHeight"
                  :options="donutChartOptions"
                  :series="donutChartSeries"
                />
                <div v-if="!chartData.count" class="sa-empty-chart">
                  <i class="ri-donut-chart-line"></i>
                  <span>Tidak ada data</span>
                </div>
              </div>
            </div>
          </div>


        </div>
      </div>

      <!-- ═══════ VIEW: TABLE ═══════ -->
        <div v-if="viewMode === 'overview' && selectedSubSektorId" class="sa-substakeholder-panel animate-show-up" :style="{ animationDelay: isReady ? '0s' : '3.35s' }">
          <div class="sa-substakeholder-header">
            <div>
              <div class="sa-substakeholder-title">
                <i class="ri-team-line"></i>
                Daftar Stakeholder per Sub Sektor
              </div>
              <div class="sa-substakeholder-sub">
                Mengikuti sektor, sub sektor, pencarian, dan periode dari filter aktif
              </div>
            </div>
            <span class="sa-substakeholder-count">
              {{ groupedSubSektorStakeholders.reduce((sum, group) => sum + group.stakeholders.length, 0) }} stakeholder
            </span>
          </div>

          <div v-if="groupedSubSektorStakeholders.length" class="sa-substakeholder-grid">
            <div
              v-for="group in groupedSubSektorStakeholders"
              :key="'stakeholder-group-' + group.id"
              class="sa-substakeholder-card"
            >
              <div class="sa-substakeholder-card-head">
                <span class="sa-substakeholder-dot" :style="{ background: group.parentColor }"></span>
                <div class="min-w-0">
                  <div class="sa-substakeholder-name" :title="group.displayName">{{ group.displayName }}</div>
                  <div class="sa-substakeholder-parent" :title="group.parentName">{{ group.parentName }}</div>
                </div>
                <span class="sa-substakeholder-badge">{{ group.stakeholders.length }}</span>
              </div>

              <div v-if="group.stakeholders.length" class="sa-stakeholder-list">
                <button
                  v-for="stakeholder in group.stakeholders"
                  :key="stakeholder.id || stakeholder.slug"
                  class="sa-stakeholder-item"
                  @click="openStakeholder(stakeholder)"
                >
                  <span class="sa-stakeholder-avatar">
                    {{ String(stakeholder.nama_perusahaan || stakeholder.nama || '?').charAt(0).toUpperCase() }}
                  </span>
                  <span class="sa-stakeholder-copy">
                    <span class="sa-stakeholder-name">{{ stakeholder.nama_perusahaan || stakeholder.nama || 'Tanpa Nama' }}</span>
                    <span class="sa-stakeholder-meta">{{ stakeholder.email || stakeholder.telepon || '-' }}</span>
                  </span>
                  <i class="ri-arrow-right-up-line"></i>
                </button>
              </div>
              <div v-else class="sa-stakeholder-empty">Tidak ada stakeholder</div>
            </div>
          </div>

          <div v-else class="sa-substakeholder-empty">
            <i class="ri-search-line"></i>
            <span>Tidak ada stakeholder pada filter aktif</span>
          </div>
        </div>

      <div v-if="viewMode === 'table'" class="sa-table-section animate-show-up" :style="{ animationDelay: isReady ? '0s' : '3.4s' }">
        <div class="sa-table-card">
          <div class="sa-chart-header">
            <div class="sa-chart-header-inner">
              <div class="sa-chart-icon">
                <i class="ri-table-2"></i>
              </div>
              <div>
                <div class="sa-chart-title">
                  {{ selectedSubSektorId ? 'Rincian Stakeholder per Sub Sektor' : 'Rincian Stakeholder per Sektor & Sub Sektor' }}
                </div>
                <div class="sa-chart-sub">
                  {{ selectedSubSektorId
                    ? 'Klik baris sub sektor untuk melihat daftar stakeholdernya'
                    : 'Klik baris sektor untuk melihat jumlah stakeholder di tiap sub sektornya'
                  }}
                </div>
              </div>
            </div>
            <div class="sa-table-counter">
              <span class="badge bg-primary-transparent">
                {{ selectedSubSektorId ? groupedSubSektorStakeholders.length + ' sub sektor' : filteredSektors.length + ' sektor' }}
              </span>
            </div>
          </div>

          <div class="sa-table-body">
            <table v-if="selectedSubSektorId" class="sa-table">
              <thead>
                <tr>
                  <th style="width: 40px">#</th>
                  <th>Nama Sub Sektor</th>
                  <th style="width: 180px">Stakeholder</th>
                  <th style="width: 60px"></th>
                </tr>
              </thead>
              <tbody>
                <template
                  v-for="(group, idx) in groupedSubSektorStakeholders"
                  :key="'sub-table-' + group.id"
                >
                  <tr
                    class="sa-sektor-row"
                    :class="{ expanded: expandedSektors.has(group.id) }"
                    @click="toggleExpand(group.id)"
                  >
                    <td class="sa-row-num">{{ idx + 1 }}</td>
                    <td>
                      <div class="sa-sektor-name-cell">
                        <span
                          class="sa-sektor-dot"
                          :style="{ background: group.parentColor }"
                        ></span>
                        <span class="sa-sektor-name">{{ group.displayName }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="sa-count-bar-wrap">
                        <div
                          class="sa-count-bar"
                          :style="{
                            width:
                              (group.stakeholders.length /
                                maxFilteredSubSektorStakeholderCount) *
                                100 +
                              '%',
                            background: group.parentColor,
                          }"
                        ></div>
                        <span class="sa-count-num">{{ group.stakeholders.length }}</span>
                      </div>
                    </td>
                    <td>
                      <i
                        class="sa-expand-icon"
                        :class="
                          expandedSektors.has(group.id)
                            ? 'ri-arrow-up-s-line'
                            : 'ri-arrow-down-s-line'
                        "
                      ></i>
                    </td>
                  </tr>

                  <tr
                    v-if="expandedSektors.has(group.id)"
                    class="sa-sub-section-row"
                  >
                    <td colspan="4" class="p-0">
                      <div class="sa-sub-table-wrap sa-sub-table-wrap--stakeholders">
                        <div
                          v-if="group.stakeholders.length === 0"
                          class="sa-sub-empty"
                        >
                          <i class="ri-information-line"></i>
                          Belum ada stakeholder
                        </div>
                        <button
                          v-for="stakeholder in group.stakeholders"
                          :key="stakeholder.id || stakeholder.slug"
                          class="sa-stakeholder-item"
                          @click.stop="openStakeholder(stakeholder)"
                        >
                          <span class="sa-stakeholder-avatar">
                            {{ String(stakeholder.nama_perusahaan || stakeholder.nama || '?').charAt(0).toUpperCase() }}
                          </span>
                          <span class="sa-stakeholder-copy">
                            <span class="sa-stakeholder-name">{{ stakeholder.nama_perusahaan || stakeholder.nama || 'Tanpa Nama' }}</span>
                            <span class="sa-stakeholder-meta">{{ stakeholder.email || stakeholder.telepon || '-' }}</span>
                          </span>
                          <i class="ri-arrow-right-up-line"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </template>

                <tr v-if="!groupedSubSektorStakeholders.length">
                  <td colspan="4" class="sa-empty-table">
                    <i class="ri-search-line"></i>
                    <span>Tidak ada stakeholder pada sub sektor ini</span>
                  </td>
                </tr>
              </tbody>
            </table>

            <table v-else class="sa-table">
              <thead>
                <tr>
                  <th style="width: 40px">#</th>
                  <th>Nama Sektor</th>
                  <th style="width: 100px">Sub Sektor</th>
                  <th style="width: 160px">Stakeholder</th>
                  <th style="width: 60px"></th>
                </tr>
              </thead>
              <tbody>
                <template
                  v-for="(sektor, idx) in filteredSektors"
                  :key="sektor.id"
                >
                  <!-- Sektor Row -->
                  <tr
                    class="sa-sektor-row"
                    :class="{ expanded: expandedSektors.has(sektor.id) }"
                    @click="toggleExpand(sektor.id)"
                  >
                    <td class="sa-row-num">{{ idx + 1 }}</td>
                    <td>
                      <div class="sa-sektor-name-cell">
                        <span
                          class="sa-sektor-dot"
                          :style="{ background: sektor.color }"
                        ></span>
                        <span class="sa-sektor-name">{{
                          sektor.displayName
                        }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="sa-code-badge">
                        {{ sektor.subSektorCount }} sub
                      </span>
                    </td>
                    <td>
                      <div class="sa-count-bar-wrap">
                        <div
                          class="sa-count-bar"
                          :style="{
                            width:
                              (sektor.stakeholderCount /
                                maxFilteredStakeholderCount) *
                                100 +
                              '%',
                            background: sektor.color,
                          }"
                        ></div>
                        <span class="sa-count-num">{{
                          sektor.stakeholderCount
                        }}</span>
                      </div>
                    </td>
                    <td>
                      <i
                        class="sa-expand-icon"
                        :class="
                          expandedSektors.has(sektor.id)
                            ? 'ri-arrow-up-s-line'
                            : 'ri-arrow-down-s-line'
                        "
                      ></i>
                    </td>
                  </tr>

                  <!-- Expanded Sub Sektor Rows -->
                  <tr
                    v-if="expandedSektors.has(sektor.id)"
                    class="sa-sub-section-row"
                  >
                    <td colspan="5" class="p-0">
                      <div class="sa-sub-table-wrap">
                        <div
                          v-if="sektor.subSektors.length === 0"
                          class="sa-sub-empty"
                        >
                          <i class="ri-information-line"></i>
                          Belum ada sub sektor
                        </div>
                        <div
                          v-for="(sub, subIdx) in sektor.subSektors"
                          :key="sub.id"
                          class="sa-sub-row"
                        >
                          <span class="sa-sub-num">{{ subIdx + 1 }}</span>
                          <span
                            class="sa-sub-dot"
                            :style="{
                              background: sektor.color,
                              opacity: 0.6,
                            }"
                          ></span>
                          <span class="sa-sub-name">{{
                            sub.displayName
                          }}</span>
                          <span class="sa-sub-code">
                            {{ sub.stakeholderCount }} stakeholder
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>

                <tr v-if="!filteredSektors.length">
                  <td colspan="5" class="sa-empty-table">
                    <i class="ri-search-line"></i>
                    <span>Tidak ada data yang cocok</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ═══════ VIEW: CARDS ═══════ -->
      <div v-if="viewMode === 'cards'" class="sa-cards-section animate-show-up" :style="{ animationDelay: isReady ? '0s' : '3.4s' }">
        <div class="row g-3">
          <div
            class="col-xl-3 col-lg-6 col-md-6"
            v-for="(sektor, idx) in filteredSektors"
            :key="sektor.id"
          >
            <div class="sa-sektor-card">
              <div
                class="sa-sektor-card-header"
                :style="{
                  background: `linear-gradient(135deg, ${sektor.color}dd, ${sektor.color}88)`,
                }"
              >
                <div class="sa-sektor-card-title-wrap">
                  <span class="sa-sektor-card-num">{{ idx + 1 }}</span>
                  <div>
                    <div class="sa-sektor-card-title">
                      {{ sektor.displayName }}
                    </div>
                    <div class="sa-sektor-card-code">
                      {{ sektor.kode_sektor || "—" }}
                    </div>
                  </div>
                </div>
                <div class="sa-sektor-card-count">
                  <span class="sa-sektor-card-count-num">{{
                    sektor.stakeholderCount
                  }}</span>
                  <span class="sa-sektor-card-count-label">Stakeholder</span>
                </div>
              </div>
              <div class="sa-sektor-card-body">
                <div
                  v-if="sektor.subSektors.length === 0"
                  class="sa-sub-empty"
                >
                  <i class="ri-information-line"></i>
                  Belum ada sub sektor
                </div>
                <div
                  v-for="sub in sektor.subSektors"
                  :key="sub.id"
                  class="sa-card-sub-item"
                >
                  <div class="d-flex align-items-center gap-2 flex-grow-1">
                    <span
                      class="sa-card-sub-bullet"
                      :style="{ background: sektor.color }"
                    ></span>
                    <span class="sa-card-sub-name">{{ sub.displayName }}</span>
                  </div>
                  <span class="badge bg-light text-dark fw-semibold" style="font-size: 10.5px;">{{ sub.stakeholderCount }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!filteredSektors.length" class="col-12">
            <div class="sa-empty-cards">
              <i class="ri-search-line"></i>
              <span>Tidak ada data yang cocok dengan filter</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ===== PREMIUM SHOW EFFECT ANIMATION ===== */
@keyframes dashboardShowUp {
  0% {
    opacity: 0;
    transform: translateY(30px) scale(0.98);
    filter: blur(4px);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

.animate-show-up {
  animation: dashboardShowUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* ══════════════════════════════════════════════════════════
   SEKTOR ANALYTICS — Premium Dashboard Styles
   ══════════════════════════════════════════════════════════ */

.sektor-analytics {
  margin-top: 1rem;
  margin-bottom: 1.5rem;
}

/* ─── Chart Level Toggle Bar ─────────────────────────── */
.sa-level-toggle-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 0.85rem;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  flex-wrap: wrap;
}
.sa-level-toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
}
.sa-level-toggle-label i {
  font-size: 15px;
  color: #2563eb;
}
.sa-level-toggle-group {
  display: flex;
  gap: 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1.5px solid #e2e8f0;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
.sa-level-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border: none;
  background: transparent;
  font-size: 11.5px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  position: relative;
}
.sa-level-btn i {
  font-size: 14px;
}
.sa-level-btn:not(:last-child) {
  border-right: 1px solid #e2e8f0;
}
.sa-level-btn:hover:not(.active) {
  background: #f8fafc;
  color: #334155;
}
.sa-level-btn.active {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #fff;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
}
.sa-level-btn.active i {
  color: #fff;
}
.sa-level-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: #94a3b8;
  margin-left: auto;
  white-space: nowrap;
}
.sa-level-info i {
  font-size: 13px;
}

/* ─── Section Header ──────────────────────────────────── */
.sa-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.9rem;
  padding: 0.75rem 1.1rem;
  border-radius: 12px;
  background: linear-gradient(
    135deg,
    #0c1e6b 0%,
    #1130a0 25%,
    #1a3fc8 50%,
    #2563eb 75%,
    #3b82f6 100%
  );
  box-shadow: 0 8px 22px rgba(37, 99, 235, 0.18);
  position: relative;
  overflow: hidden;
}
.sa-section-header::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(16, 185, 129, 0.5) 30%,
    rgba(59, 130, 246, 0.8) 60%,
    rgba(167, 243, 208, 0.4) 100%
  );
}
.sa-section-header-inner {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sa-section-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  flex-shrink: 0;
}
.sa-section-icon i {
  font-size: 1.2rem;
  color: #fff;
}
.sa-section-title {
  font-size: 1rem;
  font-weight: 800;
  color: #fff;
  margin: 0;
  line-height: 1.2;
}
.sa-section-subtitle {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.6);
  margin: 2px 0 0;
}

/* View Toggles */
.sa-view-toggles {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 9px;
  padding: 3px;
}
.sa-view-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.98rem;
}
.sa-view-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}
.sa-view-btn.active {
  color: #2563eb;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* ─── Loading ─────────────────────────────────────────── */
.sa-loading {
  padding: 1.5rem 0;
}
.sa-loading-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}
.sa-loading-grid-2 {
  grid-template-columns: 1.4fr 1fr;
}
.sa-skel {
  border-radius: 14px;
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: sa-shimmer 1.5s infinite;
}
.sa-skel-stat {
  height: 100px;
}
.sa-skel-chart {
  height: 340px;
}
@keyframes sa-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* ─── Error ───────────────────────────────────────────── */
.sa-error-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-weight: 600;
  font-size: 13px;
}
.sa-error-box i {
  font-size: 1.4rem;
}

/* ─── Stats Cards ─────────────────────────────────────── */
.sa-stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.25rem;
}
@media (max-width: 991px) {
  .sa-stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 480px) {
  .sa-stats-row {
    grid-template-columns: 1fr;
  }
}
.sa-stat-card {
  border-radius: 16px;
  padding: 1.25rem 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
  overflow: hidden;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s;
  border: 1px solid transparent;
}
.sa-stat-card::after {
  content: '';
  position: absolute;
  top: -30px;
  right: -30px;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  opacity: 0.07;
}
.sa-stat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
}
.sa-stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.sa-stat-icon-wrap {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sa-stat-icon-wrap i {
  font-size: 1.3rem;
}
.sa-stat-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 3px 8px;
  border-radius: 6px;
  opacity: 0.8;
}
.sa-stat-value {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.5px;
}
.sa-stat-label {
  font-size: 12.5px;
  font-weight: 600;
  opacity: 0.65;
  line-height: 1.3;
}
.sa-stat-detail {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 500;
  opacity: 0.5;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sa-stat-detail i {
  font-size: 12px;
  flex-shrink: 0;
}

/* Color variants */
.sa-stat-blue {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-color: #bfdbfe;
  color: #1e40af;
}
.sa-stat-blue .sa-stat-icon-wrap {
  background: rgba(37, 99, 235, 0.15);
  color: #2563eb;
}
.sa-stat-blue .sa-stat-badge {
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
}
.sa-stat-blue::after {
  background: #2563eb;
}

.sa-stat-emerald {
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border-color: #a7f3d0;
  color: #065f46;
}
.sa-stat-emerald .sa-stat-icon-wrap {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}
.sa-stat-emerald .sa-stat-badge {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}
.sa-stat-emerald::after {
  background: #10b981;
}

.sa-stat-teal {
  background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%);
  border-color: #99f6e4;
  color: #115e59;
}
.sa-stat-teal .sa-stat-icon-wrap {
  background: rgba(20, 184, 166, 0.15);
  color: #14b8a6;
}
.sa-stat-teal .sa-stat-badge {
  background: rgba(20, 184, 166, 0.12);
  color: #14b8a6;
}
.sa-stat-teal::after {
  background: #14b8a6;
}

.sa-stat-amber {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border-color: #fde68a;
  color: #92400e;
}
.sa-stat-amber .sa-stat-icon-wrap {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}
.sa-stat-amber .sa-stat-badge {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}
.sa-stat-amber::after {
  background: #f59e0b;
}

/* ─── Filter Bar ──────────────────────────────────────── */
.sa-substakeholder-panel {
  margin-top: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}
.sa-substakeholder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #f8fafc 0%, #eef4ff 100%);
  border-bottom: 1px solid #e2e8f0;
}
.sa-substakeholder-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #172554;
  font-size: 14px;
  font-weight: 800;
}
.sa-substakeholder-title i {
  color: #2563eb;
  font-size: 17px;
}
.sa-substakeholder-sub {
  margin-top: 2px;
  color: #64748b;
  font-size: 11.5px;
  font-weight: 600;
}
.sa-substakeholder-count,
.sa-substakeholder-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}
.sa-substakeholder-count {
  padding: 6px 10px;
}
.sa-substakeholder-badge {
  min-width: 28px;
  height: 24px;
  margin-left: auto;
}
.sa-substakeholder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0.9rem;
  padding: 1rem;
}
.sa-substakeholder-card {
  min-width: 0;
  border: 1px solid #e8eef7;
  border-radius: 10px;
  background: #fbfdff;
  overflow: hidden;
}
.sa-substakeholder-card-head {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0.85rem 0.9rem;
  background: #fff;
  border-bottom: 1px solid #edf2f7;
}
.sa-substakeholder-dot {
  width: 10px;
  height: 10px;
  border-radius: 4px;
  flex-shrink: 0;
}
.sa-substakeholder-name,
.sa-stakeholder-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sa-substakeholder-name {
  color: #172554;
  font-size: 11.5px;
  font-weight: 800;
}
.sa-substakeholder-parent {
  color: #94a3b8;
  font-size: 10.5px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sa-stakeholder-list {
  max-height: 246px;
  overflow-y: auto;
  padding: 0.55rem;
}
.sa-stakeholder-list,
.sa-sub-table-wrap--stakeholders {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}
.sa-stakeholder-list::-webkit-scrollbar,
.sa-sub-table-wrap--stakeholders::-webkit-scrollbar {
  width: 6px;
}
.sa-stakeholder-list::-webkit-scrollbar-thumb,
.sa-sub-table-wrap--stakeholders::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 999px;
}
.sa-stakeholder-item {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 9px;
  padding: 0.55rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  color: inherit;
  transition: background 0.18s ease, transform 0.18s ease;
}
.sa-stakeholder-item:hover {
  background: #eef6ff;
  transform: translateX(2px);
}
.sa-stakeholder-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  flex-shrink: 0;
}
.sa-stakeholder-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.sa-stakeholder-name {
  color: #1e293b;
  font-size: 12px;
  font-weight: 800;
}
.sa-stakeholder-meta,
.sa-stakeholder-more,
.sa-stakeholder-empty,
.sa-substakeholder-empty {
  color: #94a3b8;
  font-size: 10.5px;
  font-weight: 700;
}
.sa-stakeholder-item i {
  color: #94a3b8;
  font-size: 15px;
}
.sa-stakeholder-more {
  padding: 0.5rem 0.65rem 0.25rem;
}
.sa-stakeholder-empty,
.sa-substakeholder-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 1rem;
}
.sa-substakeholder-empty {
  min-height: 120px;
}

.sa-filter-bar {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  margin-bottom: 1rem;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

/* Filter Header */
.sa-filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 1rem;
  background: linear-gradient(135deg, #ffffff 0%, #f8fbff 55%, #f3f7fc 100%);
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.sa-filter-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  color: #334155;
}
.sa-filter-title-wrap > i {
  font-size: 14px;
  color: #2563eb;
}
.sa-filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  padding: 0 6px;
  animation: sa-badge-pop 0.3s ease;
}
@keyframes sa-badge-pop {
  0% { transform: scale(0.5); opacity: 0; }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
.sa-filter-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sa-result-count {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}
.sa-result-count i {
  font-size: 12px;
  color: #2563eb;
}

/* Filter Controls */
.sa-filter-controls {
  display: grid;
  align-items: flex-end;
  grid-template-columns: minmax(210px, 0.85fr) minmax(170px, 1.15fr) minmax(190px, 1.35fr) minmax(170px, 0.8fr);
  gap: 0.75rem;
  padding: 0.8rem 1rem;
}
.sa-filter-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sa-filter-label {
  font-size: 9.5px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
}
.sa-filter-label i {
  font-size: 11px;
  color: #2563eb;
}
.sa-filter-select {
  min-width: 150px;
  border-radius: 7px;
  border-color: #e2e8f0;
  font-size: 12px;
  font-weight: 500;
  height: 34px;
  transition: all 0.2s;
}
.sa-filter-select:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

/* Search */
.sa-search-wrap {
  position: relative;
  flex: 1;
  min-width: 200px;
}
.sa-search-icon {
  position: absolute;
  left: 11px;
  bottom: 9px;
  font-size: 14px;
  color: #94a3b8;
  pointer-events: none;
}
.sa-search-input {
  padding-left: 34px;
  padding-right: 30px;
  border-radius: 7px;
  border-color: #e2e8f0;
  font-size: 12px;
  height: 34px;
  transition: all 0.2s;
}
.sa-search-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
.sa-search-clear {
  position: absolute;
  right: 6px;
  bottom: 7px;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 16px;
  padding: 2px;
  line-height: 1;
  transition: color 0.15s;
}
.sa-search-clear:hover {
  color: #ef4444;
}

/* Sort */
.sa-sort-group {
  display: flex;
  gap: 4px;
}
.sa-sort-group .sa-filter-select {
  min-width: 112px;
}
.sa-sort-btn {
  width: 34px;
  height: 34px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  font-size: 15px;
  transition: all 0.2s;
}
.sa-sort-btn:hover {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}

/* Reset Button */
.sa-reset-btn {
  border-radius: 7px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  white-space: nowrap;
  height: 30px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
}
.sa-reset-btn:hover:not(:disabled) {
  background: #fef2f2;
  color: #ef4444;
  border-color: #fecaca;
}
.sa-reset-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Active Filter Pills */
.sa-active-filters {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.45rem 1rem 0.6rem;
  border-top: 1px solid #f1f5f9;
  flex-wrap: wrap;
}
.sa-active-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  margin-right: 4px;
}
.sa-filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  animation: sa-pill-in 0.25s ease;
}
.sa-filter-pill i {
  font-size: 11px;
}
.sa-pill-sektor {
  background: #f0fdf4;
  color: #15803d;
  border-color: #bbf7d0;
}
.sa-pill-sub {
  background: #f0fdfa;
  color: #0d9488;
  border-color: #99f6e4;
}
.sa-pill-sort {
  background: #fffbeb;
  color: #a16207;
  border-color: #fde68a;
}
.sa-pill-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  font-size: 10px;
  color: inherit;
  transition: all 0.15s;
}
.sa-pill-close:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}
@keyframes sa-pill-in {
  0% { opacity: 0; transform: translateX(-8px) scale(0.9); }
  100% { opacity: 1; transform: translateX(0) scale(1); }
}

/* ─── Chart Cards ─────────────────────────────────────── */
.sa-chart-card,
.sa-table-card {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.055);
  background: #fff;
  border: 1px solid #edf2f7;
}
.sa-chart-header {
  background: linear-gradient(135deg, #ffffff 0%, #f8fbff 55%, #f3f7fc 100%);
  border-bottom: 1px solid #e2e8f0;
  padding: 0.6rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.sa-chart-header-inner {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sa-chart-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 8px;
  background: #eff6ff;
  border: 1px solid #dbeafe;
}
.sa-chart-icon i {
  font-size: 1rem;
  color: #2563eb;
}
.sa-chart-title {
  font-size: 0.86rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.2;
}
.sa-chart-sub {
  font-size: 10px;
  color: #64748b;
  margin-top: 2px;
}
.sa-chart-body {
  padding: 0.85rem 1rem 0.6rem;
  background: #fff;
}
.sa-chart-body--donut {
  padding: 0.25rem 0.45rem 0.35rem;
}
.sa-chart-body--scroll {
  max-height: 640px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-top: 3.4rem;
  padding-right: 0.45rem;
  position: relative;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}
.sa-chart-body--scroll::-webkit-scrollbar {
  width: 6px;
}
.sa-chart-body--scroll::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 999px;
}
.sa-chart-body--scroll :deep(.apexcharts-tooltip) {
  z-index: 20 !important;
  white-space: normal !important;
  max-width: 360px;
}
.sa-chart-body :deep(.apexcharts-legend) {
  justify-content: center !important;
  gap: 2px 8px;
}
.sa-chart-body :deep(.apexcharts-legend.apx-legend-position-bottom) {
  max-height: 130px;
  overflow-y: auto;
  padding: 6px 8px 0;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}
.sa-chart-body :deep(.apexcharts-legend-series) {
  align-items: center;
  margin: 2px 6px !important;
}
.sa-chart-body :deep(.apexcharts-legend-text) {
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sa-empty-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 300px;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 600;
}
.sa-empty-chart i {
  font-size: 2.5rem;
  opacity: 0.3;
}

/* ─── Table ───────────────────────────────────────────── */
.sa-table-counter .badge {
  font-size: 11px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: 20px;
}
.sa-table-body {
  padding: 0;
}
.sa-table {
  width: 100%;
  border-collapse: collapse;
}
.sa-table thead th {
  padding: 12px 16px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
  text-align: left;
}
.sa-table tbody tr {
  transition: background 0.15s;
}
.sa-sektor-row {
  cursor: pointer;
}
.sa-sektor-row:hover {
  background: #f8fafc;
}
.sa-sektor-row.expanded {
  background: #eef2ff;
}
.sa-sektor-row td {
  padding: 12px 16px;
  font-size: 13px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}
.sa-row-num {
  font-weight: 700;
  color: #94a3b8;
  font-size: 12px;
}
.sa-sektor-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sa-sektor-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}
.sa-sektor-name {
  font-weight: 700;
  color: #1e293b;
}
.sa-code-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  background: #f1f5f9;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  font-family: "JetBrains Mono", monospace;
}

/* Count bar */
.sa-count-bar-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sa-count-bar {
  height: 8px;
  border-radius: 4px;
  min-width: 4px;
  transition: width 0.4s ease;
}
.sa-count-num {
  font-weight: 800;
  font-size: 13px;
  color: #334155;
  min-width: 20px;
}

/* Expand icon */
.sa-expand-icon {
  font-size: 1.2rem;
  color: #94a3b8;
  transition: transform 0.2s;
}
.sa-sektor-row.expanded .sa-expand-icon {
  color: #2563eb;
}

/* Sub Sektor Rows */
.sa-sub-section-row td {
  background: #fafbff;
  border-bottom: 2px solid #e2e8f0;
}
.sa-sub-table-wrap {
  padding: 8px 16px 12px 56px;
}
.sa-sub-table-wrap--stakeholders {
  max-height: 246px;
  overflow-y: auto;
}
.sa-sub-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: 8px;
  transition: background 0.15s;
  font-size: 12.5px;
}
.sa-sub-row:hover {
  background: rgba(37, 99, 235, 0.05);
}
.sa-sub-num {
  font-weight: 700;
  color: #94a3b8;
  font-size: 11px;
  min-width: 20px;
}
.sa-sub-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sa-sub-name {
  font-weight: 600;
  color: #334155;
  flex: 1;
}
.sa-sub-code {
  font-size: 11px;
  color: #94a3b8;
  font-family: "JetBrains Mono", monospace;
}
.sa-sub-empty {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  font-size: 12.5px;
  color: #94a3b8;
  font-style: italic;
}
.sa-empty-table {
  text-align: center;
  padding: 3rem 1rem !important;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 600;
}
.sa-empty-table i {
  display: block;
  font-size: 2rem;
  margin-bottom: 8px;
  opacity: 0.3;
}

/* ─── Cards View ──────────────────────────────────────── */
.sa-sektor-card {
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  background: #fff;
  transition: transform 0.2s, box-shadow 0.2s;
  height: 100%;
}
.sa-sektor-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}
.sa-sektor-card-header {
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.sa-sektor-card-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sa-sektor-card-num {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}
.sa-sektor-card-title {
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  line-height: 1.2;
}
.sa-sektor-card-code {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.6);
  font-family: "JetBrains Mono", monospace;
  margin-top: 2px;
}
.sa-sektor-card-count {
  text-align: center;
}
.sa-sektor-card-count-num {
  display: block;
  font-size: 1.5rem;
  font-weight: 900;
  color: #fff;
  line-height: 1;
}
.sa-sektor-card-count-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.sa-sektor-card-body {
  padding: 0.75rem 1rem;
  max-height: 260px;
  overflow-y: auto;
}
.sa-card-sub-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #334155;
  transition: background 0.15s;
}
.sa-card-sub-item:hover {
  background: #f8fafc;
}
.sa-card-sub-bullet {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  opacity: 0.6;
}
.sa-card-sub-name {
  flex: 1;
  line-height: 1.3;
}
.sa-empty-cards {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 3rem;
  color: #94a3b8;
  font-size: 14px;
  font-weight: 600;
}
.sa-empty-cards i {
  font-size: 2.5rem;
  opacity: 0.3;
}

/* ─── Responsive ──────────────────────────────────────── */
@media (max-width: 992px) {
  .sa-stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .sa-loading-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .sa-loading-grid-2 {
    grid-template-columns: 1fr;
  }
  .sa-filter-controls {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .sa-filter-item {
    width: 100%;
  }
  .sa-search-wrap {
    min-width: unset;
  }
  .sa-filter-select {
    min-width: unset;
    width: 100%;
  }
  .sa-sort-group {
    flex: 1;
  }
  .sa-sort-group .sa-filter-select {
    min-width: unset;
    flex: 1;
  }
  .sa-filter-bar {
    flex-direction: column;
    align-items: stretch;
  }
  .sa-reset-btn {
    width: 100%;
  }
}

@media (max-width: 576px) {
  .sa-stats-row {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .sa-stat-card {
    padding: 0.85rem 1rem;
  }
  .sa-stat-value {
    font-size: 1.25rem;
  }
  .sa-section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 0.75rem 0.9rem;
  }
  .sa-section-title {
    font-size: 1rem;
  }
  .sa-view-toggles {
    align-self: flex-end;
  }
  .sa-filter-controls {
    grid-template-columns: 1fr;
  }
  .sa-level-toggle-bar {
    align-items: flex-start;
    flex-direction: column;
  }
  .sa-level-info {
    margin-left: 0;
  }
  .sa-sub-table-wrap {
    padding-left: 24px;
  }
}
</style>
