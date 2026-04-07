<script setup>
import { ref, computed, onMounted, watch } from "vue";
import {
  sektorService,
  subSektorService,
  getSektorName,
  getSubSektorName,
  getSubSektorParentId,
} from "@/services/sektor.service";
import { useStakeholdersStore } from "@/stores/stakeholders";

// ─── State ──────────────────────────────────────────────
const sektorList = ref([]);
const subSektorList = ref([]);
const loading = ref(true);
const error = ref(null);
const stakeholdersStore = useStakeholdersStore();

// ─── Filters ────────────────────────────────────────────
const searchQuery = ref("");
const selectedSektorId = ref("");
const selectedSubSektorId = ref("");
const sortBy = ref("name"); // 'name' | 'count'
const sortOrder = ref("asc"); // 'asc' | 'desc'
const viewMode = ref("overview"); // 'overview' | 'table' | 'cards'
const chartLevel = ref("sektor"); // 'sektor' | 'subsektor'
const expandedSektors = ref(new Set());

// ─── Color Palette ──────────────────────────────────────
const sektorColors = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
  "#3b82f6", "#2563eb", "#7c3aed", "#c026d3",
];

const getSektorColor = (index) => sektorColors[index % sektorColors.length];

// ─── Fetch Data ─────────────────────────────────────────
const fetchData = async () => {
  loading.value = true;
  error.value = null;
  try {
    await Promise.all([
      (async () => {
        const [sektors, subSektors] = await Promise.all([
          sektorService.getAll(),
          subSektorService.getAll(),
        ]);
        sektorList.value = sektors;
        subSektorList.value = subSektors;
      })(),
      stakeholdersStore.initialize(),
    ]);
  } catch (e) {
    console.error("Failed to fetch sektor data:", e);
    error.value = "Gagal memuat data stakeholder. Pastikan API tersedia.";
  } finally {
    loading.value = false;
  }
};

onMounted(fetchData);

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

const enrichedSektors = computed(() => {
  const allStakeholders = stakeholdersStore.allStakeholders;
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

    return {
      ...sektor,
      displayName: getSektorName(sektor),
      color: getSektorColor(idx),
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
    data = data.map((s) => ({
      ...s,
      subSektors: s.subSektors.filter(
        (ss) => String(ss.id) === String(selectedSubSektorId.value)
      ),
      subSektorCount: s.subSektors.filter(
        (ss) => String(ss.id) === String(selectedSubSektorId.value)
      ).length,
    }));
  }

  // Filter by search
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    data = data.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        s.subSektors.some((ss) => ss.displayName.toLowerCase().includes(q))
    );
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

// Active filter count for badge
const activeFilterCount = computed(() => {
  let count = 0;
  if (searchQuery.value.trim()) count++;
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

// ─── Computed: Stats ────────────────────────────────────
const totalSektors = computed(() => sektorList.value.length);
const totalSubSektors = computed(() => subSektorList.value.length);
const totalStakeholders = computed(() => stakeholdersStore.allStakeholders.length);
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
    sektor.subSektors.forEach((ss) => {
      result.push({
        ...ss,
        parentName: sektor.displayName,
        parentColor: sektor.color,
      });
    });
  });
  return result;
});

// ─── Computed: Chart Data Source (sektor or sub-sektor level) ───
const chartData = computed(() => {
  if (chartLevel.value === 'subsektor') {
    return {
      labels: flattenedSubSektors.value.map(ss => ss.displayName),
      values: flattenedSubSektors.value.map(ss => ss.stakeholderCount),
      colors: flattenedSubSektors.value.map(ss => ss.parentColor),
      tooltipSuffix: flattenedSubSektors.value.map(ss => ` (${ss.parentName})`),
      count: flattenedSubSektors.value.length,
    };
  }
  return {
    labels: filteredSektors.value.map(s => s.displayName),
    values: filteredSektors.value.map(s => s.stakeholderCount),
    colors: filteredSektors.value.map((_, i) => getSektorColor(i)),
    tooltipSuffix: filteredSektors.value.map(() => ''),
    count: filteredSektors.value.length,
  };
});

// ─── Chart Options: Bar Chart ───────────────────────────
const barChartOptions = computed(() => ({
  chart: {
    type: "bar",
    toolbar: { show: true, tools: { download: true, selection: false, zoom: false, zoomin: false, zoomout: false, pan: false, reset: false } },
    fontFamily: "Inter, sans-serif",
  },
  plotOptions: {
    bar: {
      horizontal: true,
      borderRadius: 6,
      barHeight: "65%",
      distributed: true,
    },
  },
  colors: chartData.value.colors,
  dataLabels: {
    enabled: true,
    formatter: (val) => val + " stakeholder",
    style: { fontSize: "11px", fontWeight: 600, colors: ["#fff"] },
    offsetX: 4,
  },
  xaxis: {
    categories: chartData.value.labels,
    labels: { style: { fontSize: "11px", colors: "#64748b" } },
  },
  yaxis: {
    labels: {
      style: { fontSize: "11px", colors: "#64748b" },
      maxWidth: 220,
    },
  },
  grid: { borderColor: "#f1f5f9", strokeDashArray: 4 },
  tooltip: {
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
  },
  labels: chartData.value.labels,
  colors: chartData.value.colors,
  plotOptions: {
    pie: {
      donut: {
        size: "68%",
        labels: {
          show: true,
          name: { fontSize: "13px", fontWeight: 700 },
          value: {
            fontSize: "20px",
            fontWeight: 800,
            formatter: (val) => val,
          },
          total: {
            show: true,
            label: "Total Stakeholder",
            fontSize: "12px",
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
    position: "bottom",
    fontSize: "11px",
    fontWeight: 600,
    markers: { width: 10, height: 10, radius: 3 },
    itemMargin: { horizontal: 8, vertical: 4 },
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

// Reset sub sektor dropdown when sektor changes
watch(selectedSektorId, () => {
  selectedSubSektorId.value = "";
});
</script>

<template>
  <div class="sektor-analytics">
    <!-- ═══════════ SECTION HEADER ═══════════ -->
    <div class="sa-section-header">
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
      <!-- ──── STATS CARDS ──── -->
      <div class="sa-stats-row">
        <div class="sa-stat-card sa-stat-indigo">
          <div class="sa-stat-top">
            <div class="sa-stat-icon-wrap">
              <i class="ri-building-4-line"></i>
            </div>
            <div class="sa-stat-badge">Total</div>
          </div>
          <div class="sa-stat-value">{{ totalStakeholders }}</div>
          <div class="sa-stat-label">Stakeholder</div>
          <div class="sa-stat-detail">
            <i class="ri-pie-chart-2-line"></i>
            Tersebar di {{ totalSektors }} sektor
          </div>
        </div>

        <div class="sa-stat-card sa-stat-teal">
          <div class="sa-stat-top">
            <div class="sa-stat-icon-wrap">
              <i class="ri-bar-chart-horizontal-line"></i>
            </div>
            <div class="sa-stat-badge">Rata-rata</div>
          </div>
          <div class="sa-stat-value">{{ avgStakeholderPerSektor }}</div>
          <div class="sa-stat-label">Stakeholder / Sektor</div>
          <div class="sa-stat-detail">
            <i class="ri-scales-3-line"></i>
            Distribusi per sektor
          </div>
        </div>

        <div class="sa-stat-card sa-stat-amber">
          <div class="sa-stat-top">
            <div class="sa-stat-icon-wrap">
              <i class="ri-trophy-line"></i>
            </div>
            <div class="sa-stat-badge">Terbanyak</div>
          </div>
          <div class="sa-stat-value">{{ maxStakeholderSektor.count }}</div>
          <div class="sa-stat-label">Stakeholder Terbanyak</div>
          <div class="sa-stat-detail" :title="maxStakeholderSektor.name">
            <i class="ri-building-2-line"></i>
            Sektor {{ maxStakeholderSektor.name }}
          </div>
        </div>
      </div>

      <!-- ──── FILTER BAR ──── -->
      <div class="sa-filter-bar">
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
            <i class="ri-government-line"></i> {{ enrichedSektors.find(s => String(s.id) === String(selectedSektorId))?.displayName || 'Sektor' }}
            <button @click="selectedSektorId = ''" class="sa-pill-close"><i class="ri-close-line"></i></button>
          </span>
          <span v-if="selectedSubSektorId" class="sa-filter-pill sa-pill-sub">
            <i class="ri-node-tree"></i> Sub Sektor
            <button @click="selectedSubSektorId = ''" class="sa-pill-close"><i class="ri-close-line"></i></button>
          </span>
          <span v-if="sortBy !== 'name' || sortOrder !== 'asc'" class="sa-filter-pill sa-pill-sort">
            <i class="ri-sort-asc"></i> {{ sortBy === 'name' ? 'Nama' : 'Jumlah' }} ({{ sortOrder === 'asc' ? '↑' : '↓' }})
            <button @click="sortBy = 'name'; sortOrder = 'asc'" class="sa-pill-close"><i class="ri-close-line"></i></button>
          </span>
        </div>
      </div>

      <!-- ═══════ VIEW: OVERVIEW (Charts) ═══════ -->
      <div v-if="viewMode === 'overview'" class="sa-charts-section">
        <!-- Chart Level Toggle -->
        <div class="sa-level-toggle-bar">
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

        <div class="row g-4">
          <!-- Bar Chart -->
          <div class="col-xl-7">
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
              <div class="sa-chart-body">
                <apexchart
                  v-if="chartData.count"
                  :key="'bar-' + chartLevel"
                  type="bar"
                  :height="Math.max(300, chartData.count * 45)"
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
          <div class="col-xl-5">
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
              <div class="sa-chart-body">
                <apexchart
                  v-if="chartData.count"
                  :key="'donut-' + chartLevel"
                  type="donut"
                  height="380"
                  :options="donutChartOptions"
                  :series="donutChartSeries"
                />
                <div v-else class="sa-empty-chart">
                  <i class="ri-donut-chart-line"></i>
                  <span>Tidak ada data</span>
                </div>
              </div>
            </div>
          </div>


        </div>
      </div>

      <!-- ═══════ VIEW: TABLE ═══════ -->
      <div v-if="viewMode === 'table'" class="sa-table-section">
        <div class="sa-table-card">
          <div class="sa-chart-header">
            <div class="sa-chart-header-inner">
              <div class="sa-chart-icon">
                <i class="ri-table-2"></i>
              </div>
              <div>
                <div class="sa-chart-title">Rincian Stakeholder per Sektor & Sub Sektor</div>
                <div class="sa-chart-sub">
                  Klik baris sektor untuk melihat jumlah stakeholder di tiap sub sektornya
                </div>
              </div>
            </div>
            <div class="sa-table-counter">
              <span class="badge bg-primary-transparent">
                {{ filteredSektors.length }} sektor
              </span>
            </div>
          </div>

          <div class="sa-table-body">
            <table class="sa-table">
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
                                (maxStakeholderSektor.count || 1)) *
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
      <div v-if="viewMode === 'cards'" class="sa-cards-section">
        <div class="row g-3">
          <div
            class="col-xl-4 col-lg-6 col-md-6"
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
/* ══════════════════════════════════════════════════════════
   SEKTOR ANALYTICS — Premium Dashboard Styles
   ══════════════════════════════════════════════════════════ */

.sektor-analytics {
  margin-top: 1.5rem;
  margin-bottom: 2rem;
}

/* ─── Chart Level Toggle Bar ─────────────────────────── */
.sa-level-toggle-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  margin-bottom: 1rem;
  border-radius: 12px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
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
  color: #6366f1;
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
  padding: 6px 16px;
  border: none;
  background: transparent;
  font-size: 12px;
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
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
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
  margin-bottom: 1.25rem;
  padding: 1rem 1.5rem;
  border-radius: 14px;
  background: linear-gradient(
    135deg,
    #0c1e6b 0%,
    #1130a0 25%,
    #1a3fc8 50%,
    #2563eb 75%,
    #3b82f6 100%
  );
  box-shadow: 0 8px 32px rgba(37, 99, 235, 0.22);
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
    rgba(139, 92, 246, 0.5) 30%,
    rgba(96, 165, 250, 0.8) 60%,
    rgba(167, 243, 208, 0.4) 100%
  );
}
.sa-section-header-inner {
  display: flex;
  align-items: center;
  gap: 14px;
}
.sa-section-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  flex-shrink: 0;
}
.sa-section-icon i {
  font-size: 1.5rem;
  color: #fff;
}
.sa-section-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: #fff;
  margin: 0;
  line-height: 1.2;
}
.sa-section-subtitle {
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.6);
  margin: 2px 0 0;
}

/* View Toggles */
.sa-view-toggles {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 3px;
}
.sa-view-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1.1rem;
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
.sa-stat-indigo {
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  border-color: #c7d2fe;
  color: #3730a3;
}
.sa-stat-indigo .sa-stat-icon-wrap {
  background: rgba(99, 102, 241, 0.15);
  color: #6366f1;
}
.sa-stat-indigo .sa-stat-badge {
  background: rgba(99, 102, 241, 0.12);
  color: #6366f1;
}
.sa-stat-indigo::after {
  background: #6366f1;
}

.sa-stat-violet {
  background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
  border-color: #ddd6fe;
  color: #5b21b6;
}
.sa-stat-violet .sa-stat-icon-wrap {
  background: rgba(139, 92, 246, 0.15);
  color: #8b5cf6;
}
.sa-stat-violet .sa-stat-badge {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
}
.sa-stat-violet::after {
  background: #8b5cf6;
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
.sa-filter-bar {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
  margin-bottom: 1.25rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

/* Filter Header */
.sa-filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.sa-filter-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
}
.sa-filter-title-wrap > i {
  font-size: 16px;
  color: #6366f1;
}
.sa-filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
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
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}
.sa-result-count i {
  font-size: 12px;
  color: #6366f1;
}

/* Filter Controls */
.sa-filter-controls {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
  flex: 1;
  padding: 1rem 1.25rem;
}
.sa-filter-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sa-filter-label {
  font-size: 10.5px;
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
  color: #6366f1;
}
.sa-filter-select {
  min-width: 150px;
  border-radius: 8px;
  border-color: #e2e8f0;
  font-size: 12.5px;
  font-weight: 500;
  height: 36px;
  transition: all 0.2s;
}
.sa-filter-select:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
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
  bottom: 10px;
  font-size: 14px;
  color: #94a3b8;
  pointer-events: none;
}
.sa-search-input {
  padding-left: 34px;
  padding-right: 30px;
  border-radius: 8px;
  border-color: #e2e8f0;
  font-size: 12.5px;
  height: 36px;
  transition: all 0.2s;
}
.sa-search-input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
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
  min-width: 120px;
}
.sa-sort-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  font-size: 15px;
  transition: all 0.2s;
}
.sa-sort-btn:hover {
  background: #6366f1;
  color: #fff;
  border-color: #6366f1;
}

/* Reset Button */
.sa-reset-btn {
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  white-space: nowrap;
  height: 34px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
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
  padding: 0.6rem 1.25rem 0.8rem;
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
  background: #eef2ff;
  color: #4338ca;
  border: 1px solid #c7d2fe;
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
  background: #fdf4ff;
  color: #86198f;
  border-color: #f0abfc;
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
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04);
  background: #fff;
  border: none;
}
.sa-chart-header {
  background: linear-gradient(
    135deg,
    #0c1e6b 0%,
    #1130a0 25%,
    #1a3fc8 50%,
    #2563eb 75%,
    #3b82f6 100%
  );
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.sa-chart-header-inner {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sa-chart-icon {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.12);
}
.sa-chart-icon i {
  font-size: 1.2rem;
  color: #fff;
}
.sa-chart-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: #fff;
  line-height: 1.2;
}
.sa-chart-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 2px;
}
.sa-chart-body {
  padding: 1.25rem;
  background: #fff;
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
  color: #6366f1;
}

/* Sub Sektor Rows */
.sa-sub-section-row td {
  background: #fafbff;
  border-bottom: 2px solid #e2e8f0;
}
.sa-sub-table-wrap {
  padding: 8px 16px 12px 56px;
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
  background: rgba(99, 102, 241, 0.05);
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
    flex-direction: column;
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
    gap: 12px;
    padding: 0.85rem 1rem;
  }
  .sa-section-title {
    font-size: 1rem;
  }
  .sa-view-toggles {
    align-self: flex-end;
  }
  .sa-sub-table-wrap {
    padding-left: 24px;
  }
}
</style>
