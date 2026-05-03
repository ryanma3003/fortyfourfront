<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { ikasService } from '../../services/ikas.service';

const props = defineProps({
  stakeholderSlug: {
    type: String,
    default: null
  },
  perusahaanId: {
    type: String,
    default: null
  }
});

// --- STATE ---
const currentYear = new Date().getFullYear();
const availableYears = ref([]);
const selectedYears = ref([currentYear]);
const allIkasRecords = ref([]);
const loading = ref(false);
const error = ref('');

// Color palette for year bars
const yearColors = [
  { bg: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', solid: '#3b82f6', light: 'rgba(59, 130, 246, 0.12)' },
  { bg: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)', solid: '#8b5cf6', light: 'rgba(139, 92, 246, 0.12)' },
  { bg: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', solid: '#10b981', light: 'rgba(16, 185, 129, 0.12)' },
  { bg: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', solid: '#f59e0b', light: 'rgba(245, 158, 11, 0.12)' },
  { bg: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)', solid: '#ef4444', light: 'rgba(239, 68, 68, 0.12)' },
];

// Domain definitions for the comparison chart
const domainDefs = [
  { key: 'identifikasi', label: 'Identifikasi', icon: 'ri-search-eye-line', color: '#2563eb', gradient: 'linear-gradient(135deg, #1e3a8a, #2563eb)' },
  { key: 'proteksi', label: 'Proteksi', icon: 'ri-shield-line', color: '#7c3aed', gradient: 'linear-gradient(135deg, #4c1d95, #7c3aed)' },
  { key: 'deteksi', label: 'Deteksi', icon: 'ri-radar-line', color: '#d97706', gradient: 'linear-gradient(135deg, #78350f, #d97706)' },
  { key: 'tanggulih', label: 'Penanggulangan & Pemulihan', shortLabel: 'Gulih', icon: 'ri-first-aid-kit-line', color: '#059669', gradient: 'linear-gradient(135deg, #064e3b, #059669)' },
];

// Extract domain score from a record
const getDomainScore = (record, domainKey) => {
  if (!record) return 0;
  switch (domainKey) {
    case 'identifikasi': return record.identifikasi?.nilai_identifikasi || record.identifikasi?.nilai_subdomain_avg || 0;
    case 'proteksi': return record.proteksi?.nilai_proteksi || record.proteksi?.nilai_subdomain_avg || 0;
    case 'deteksi': return record.deteksi?.nilai_deteksi || record.deteksi?.nilai_subdomain_avg || 0;
    case 'tanggulih': return record.gulih?.nilai_gulih || record.gulih?.nilai_subdomain_avg || 0;
    default: return 0;
  }
};

// Extract total score
const getTotalScore = (record) => {
  if (!record) return 0;
  return record.nilai_kematangan || record.total_rata_rata || 0;
};

// Group records by year
const toYearNumber = (value) => {
  const year = Number(value);
  return Number.isFinite(year) ? year : null;
};

const recordsByYear = computed(() => {
  const map = {};
  allIkasRecords.value.forEach(record => {
    const date = record.tanggal || record.created_at;
    if (!date) return;
    const year = new Date(date).getFullYear();
    if (!Number.isFinite(year)) return;
    if (!map[year]) map[year] = [];
    map[year].push(record);
  });
  return map;
});

// Get the latest record for a given year
const getRecordForYear = (year) => {
  const records = recordsByYear.value[year];
  if (!records || records.length === 0) return null;
  // Sort by date descending and take the latest
  return records.sort((a, b) => new Date(b.created_at || b.tanggal).getTime() - new Date(a.created_at || a.tanggal).getTime())[0];
};

// Comparison data for selected years
const comparisonData = computed(() => {
  return selectedYears.value.map((year, idx) => {
    const record = getRecordForYear(year);
    const colorIdx = idx % yearColors.length;
    
    const domains = {};
    domainDefs.forEach(d => {
      // Calculate from subdomains if domain-level score isn't available
      let score = getDomainScore(record, d.key);
      if (!score && record) {
        const domData = record[d.key === 'tanggulih' ? 'gulih' : d.key];
        if (domData) {
          const subKeys = Object.keys(domData).filter(k => k.startsWith('nilai_subdomain'));
          const vals = subKeys.map(k => Number(domData[k]) || 0).filter(v => v > 0);
          if (vals.length > 0) {
            score = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
          }
        }
      }
      domains[d.key] = score;
    });

    // Calculate total from domains
    const domainValues = Object.values(domains).filter(v => v > 0);
    const total = domainValues.length > 0 
      ? Number((domainValues.reduce((a, b) => a + b, 0) / domainValues.length).toFixed(2)) 
      : getTotalScore(record);

    return {
      year,
      record,
      total,
      domains,
      color: yearColors[colorIdx],
    };
  }).sort((a, b) => a.year - b.year);
});

// Has comparison data
const hasData = computed(() => comparisonData.value.some(d => d.total > 0 || Object.values(d.domains).some(v => v > 0)));

// Max score for bar widths
const maxScore = 5;

// Toggle year selection
const normalizeSelectedYears = (years) => {
  const uniqueYears = Array.from(new Set(
    years
      .map(toYearNumber)
      .filter((year) => year !== null)
  ));

  const normalized = uniqueYears.length ? uniqueYears : [currentYear];

  return normalized
    .sort((a, b) => a - b)
    .slice(-4);
};

const toggleYear = (year) => {
  const normalizedYear = toYearNumber(year);
  if (normalizedYear === null) return;

  const idx = selectedYears.value.indexOf(normalizedYear);
  if (idx > -1) {
    if (selectedYears.value.length > 1) {
      selectedYears.value = normalizeSelectedYears(
        selectedYears.value.filter((item) => item !== normalizedYear)
      );
    }
  } else {
    selectedYears.value = normalizeSelectedYears([
      ...selectedYears.value,
      normalizedYear,
    ]);
  }
};

// Trend indicator
const getTrend = (domainKey) => {
  if (comparisonData.value.length < 2) return null;
  const sorted = [...comparisonData.value].sort((a, b) => a.year - b.year);
  const first = sorted[0].domains[domainKey];
  const last = sorted[sorted.length - 1].domains[domainKey];
  if (first === 0 && last === 0) return null;
  if (last > first) return 'up';
  if (last < first) return 'down';
  return 'stable';
};

const getTotalTrend = () => {
  if (comparisonData.value.length < 2) return null;
  const sorted = [...comparisonData.value].sort((a, b) => a.year - b.year);
  const first = sorted[0].total;
  const last = sorted[sorted.length - 1].total;
  if (first === 0 && last === 0) return null;
  if (last > first) return 'up';
  if (last < first) return 'down';
  return 'stable';
};

// Maturity label
const getMaturityLabel = (score) => {
  if (score <= 0) return '-';
  if (score < 1.50) return 'Level 1';
  if (score < 2.50) return 'Level 2';
  if (score < 3.50) return 'Level 3';
  if (score < 4.50) return 'Level 4';
  return 'Level 5';
};

// ApexCharts options for the trend line chart
const trendChartOptions = computed(() => ({
  chart: {
    type: 'line',
    height: 300,
    toolbar: { show: false },
    fontFamily: 'Inter, system-ui, sans-serif',
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 800,
    },
    dropShadow: {
      enabled: true,
      top: 3,
      left: 0,
      blur: 6,
      opacity: 0.15,
    },
  },
  stroke: {
    curve: 'smooth',
    width: 3,
  },
  markers: {
    size: 6,
    strokeWidth: 2,
    strokeColors: '#fff',
    hover: { sizeOffset: 3 },
  },
  colors: ['#2563eb', '#7c3aed', '#d97706', '#059669', '#1e3a5f'],
  xaxis: {
    categories: comparisonData.value.map(d => d.year.toString()),
    labels: {
      style: { fontSize: '12px', fontWeight: 600, colors: '#64748b' },
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    min: 0,
    max: 5,
    tickAmount: 5,
    labels: {
      style: { fontSize: '11px', colors: '#94a3b8' },
      formatter: (val) => val.toFixed(1),
    },
  },
  grid: {
    borderColor: '#e2e8f0',
    strokeDashArray: 4,
    xaxis: { lines: { show: false } },
  },
  legend: {
    position: 'top',
    horizontalAlign: 'center',
    fontSize: '12px',
    fontWeight: 600,
    markers: { width: 10, height: 10, radius: 50 },
    itemMargin: { horizontal: 12, vertical: 4 },
  },
  tooltip: {
    theme: 'light',
    y: {
      formatter: (val) => `${val.toFixed(2)} / 5.00`,
    },
  },
}));

const trendChartSeries = computed(() => {
  const sorted = [...comparisonData.value].sort((a, b) => a.year - b.year);
  
  const series = domainDefs.map(d => ({
    name: d.shortLabel || d.label,
    data: sorted.map(item => item.domains[d.key] || 0),
  }));

  series.push({
    name: 'Total Rata-rata',
    data: sorted.map(item => item.total || 0),
  });

  return series;
});

const normalizeIkasRecords = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.records)) return response.records;
  if (response?.id) return [response];
  return [];
};

// Fetch all IKAS records for the stakeholder
const fetchAllRecords = async () => {
  if (!props.perusahaanId) return;
  loading.value = true;
  error.value = '';
  
  try {
    const response = await ikasService.getIkasByPerusahaan(props.perusahaanId);
    const records = normalizeIkasRecords(response);
    
    if (records.length) {
      // Filter records for this perusahaan
      allIkasRecords.value = records.filter(r => 
        String(r.perusahaan?.id || '') === String(props.perusahaanId) ||
        String(r.id_perusahaan || '') === String(props.perusahaanId)
      );
      
      // Build available years from the data
      const years = new Set();
      allIkasRecords.value.forEach(record => {
        const date = record.tanggal || record.created_at;
        if (date) {
          const year = new Date(date).getFullYear();
          if (Number.isFinite(year)) years.add(year);
        }
      });
      
      // Always include the current year
      years.add(currentYear);
      
      // Show the timeline from older years on the left to newer years on the right.
      availableYears.value = Array.from(years).sort((a, b) => a - b);
      
      // Default to the system year only.
      selectedYears.value = [currentYear];
    } else {
      // No data — show current year and some past years
      availableYears.value = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
      selectedYears.value = [currentYear];
    }
  } catch (err) {
    console.error('[IkasComparison] Failed to fetch records:', err);
    error.value = 'Gagal memuat data perbandingan';
    availableYears.value = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
    selectedYears.value = [currentYear];
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchAllRecords();
});

watch(() => props.perusahaanId, () => {
  fetchAllRecords();
});

watch(availableYears, (years) => {
  if (!years.length) return;
  if (!selectedYears.value.length) {
    selectedYears.value = [currentYear];
    return;
  }

  selectedYears.value = normalizeSelectedYears(selectedYears.value);
}, { immediate: true });
</script>

<template>
  <div class="ikas-comparison-section">
    <!-- Year Selector Pill Bar -->
    <div class="year-selector-bar">
      <div class="year-selector-label">
        <i class="ri-calendar-line"></i>
        <span>TAHUN DATA</span>
      </div>
      <div class="year-pills">
        <button
          v-for="year in availableYears"
          :key="year"
          class="year-pill"
          :class="{ active: selectedYears.includes(year) }"
          @click="toggleYear(year)"
        >
          {{ year }}
          <span v-if="year === currentYear" class="current-badge">Terkini</span>
        </button>
      </div>
    </div>

    <!-- Comparison Card -->
    <div class="comparison-card">
      <!-- Header -->
      <div class="comparison-header">
        <div class="comparison-header-inner">
          <div class="comparison-header-icon">
            <i class="ri-line-chart-line"></i>
          </div>
          <div>
            <div class="comparison-header-title">Perbandingan Data Antar Tahun</div>
            <div class="comparison-header-sub">Visualisasi tren nilai kematangan keamanan siber</div>
          </div>
        </div>
        <div class="comparison-header-actions" v-if="hasData">
          <div class="year-legend">
            <span v-for="(item, idx) in comparisonData" :key="item.year" class="legend-chip" :style="{ background: item.color.light, color: item.color.solid }">
              <span class="legend-dot" :style="{ background: item.color.solid }"></span>
              {{ item.year }}
            </span>
          </div>
        </div>
      </div>

      <!-- Body -->
      <div class="comparison-body">
        <!-- Loading State -->
        <div v-if="loading" class="comparison-empty">
          <div class="spinner-border text-primary" role="status" style="width:2.5rem;height:2.5rem;">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="comparison-empty-text">Memuat data perbandingan...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="!hasData" class="comparison-empty">
          <div class="empty-icon-wrapper">
            <i class="ri-bar-chart-grouped-line"></i>
          </div>
          <p class="comparison-empty-text">Belum ada data untuk perbandingan</p>
          <p class="comparison-empty-sub">Data IKAS dari beberapa tahun diperlukan untuk menampilkan perbandingan</p>
        </div>

        <!-- Data View -->
        <template v-else>
          <!-- Total Score Comparison -->
          <div class="total-comparison-strip">
            <div class="total-comparison-label">
              <i class="ri-bar-chart-box-line"></i>
              <span>Total Nilai Kematangan</span>
              <span v-if="getTotalTrend()" class="trend-badge" :class="getTotalTrend()">
                <i :class="{
                  'ri-arrow-up-line': getTotalTrend() === 'up',
                  'ri-arrow-down-line': getTotalTrend() === 'down',
                  'ri-subtract-line': getTotalTrend() === 'stable'
                }"></i>
              </span>
            </div>
            <div class="total-bars">
              <div v-for="item in comparisonData" :key="item.year" class="total-bar-row">
                <span class="total-bar-year" :style="{ color: item.color.solid }">{{ item.year }}</span>
                <div class="total-bar-track">
                  <div class="total-bar-fill"
                    :style="{
                      width: `${(item.total / maxScore) * 100}%`,
                      background: item.color.bg,
                    }"
                  >
                    <span class="total-bar-value" v-if="item.total > 0">{{ item.total.toFixed(2) }}</span>
                  </div>
                </div>
                <span class="total-bar-label">{{ getMaturityLabel(item.total) }}</span>
              </div>
            </div>
          </div>

          <!-- Domain Comparison Grid -->
          <div class="domain-comparison-grid">
            <div v-for="domain in domainDefs" :key="domain.key" class="domain-comparison-card">
              <div class="domain-comp-header">
                <div class="domain-comp-icon" :style="{ background: domain.gradient }">
                  <i :class="domain.icon"></i>
                </div>
                <div class="domain-comp-title-area">
                  <span class="domain-comp-name">{{ domain.shortLabel || domain.label }}</span>
                  <span v-if="getTrend(domain.key)" class="trend-badge small" :class="getTrend(domain.key)">
                    <i :class="{
                      'ri-arrow-up-line': getTrend(domain.key) === 'up',
                      'ri-arrow-down-line': getTrend(domain.key) === 'down',
                      'ri-subtract-line': getTrend(domain.key) === 'stable'
                    }"></i>
                  </span>
                </div>
              </div>
              <div class="domain-comp-bars">
                <div v-for="item in comparisonData" :key="item.year" class="domain-bar-row">
                  <span class="domain-bar-year">{{ item.year }}</span>
                  <div class="domain-bar-track">
                    <div class="domain-bar-fill"
                      :style="{
                        width: item.domains[domain.key] > 0 ? `${(item.domains[domain.key] / maxScore) * 100}%` : '0%',
                        background: item.color.bg,
                      }"
                    ></div>
                  </div>
                  <span class="domain-bar-score" :style="{ color: item.domains[domain.key] > 0 ? item.color.solid : '#94a3b8' }">
                    {{ item.domains[domain.key] > 0 ? item.domains[domain.key].toFixed(2) : '-' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Trend Line Chart -->
          <div class="trend-chart-wrapper" v-if="comparisonData.length >= 2">
            <div class="trend-chart-title">
              <i class="ri-line-chart-line"></i>
              <span>Tren Nilai Kematangan</span>
            </div>
            <apexchart
              type="line"
              :height="300"
              :options="trendChartOptions"
              :series="trendChartSeries"
            />
          </div>

          <!-- Summary Table -->
          <div class="comparison-table-wrapper" v-if="comparisonData.length >= 2">
            <table class="comparison-table">
              <thead>
                <tr>
                  <th class="domain-col">Domain</th>
                  <th v-for="item in comparisonData" :key="item.year" class="year-col">
                    <span class="table-year-badge" :style="{ background: item.color.light, color: item.color.solid }">
                      {{ item.year }}
                    </span>
                  </th>
                  <th class="trend-col" v-if="comparisonData.length >= 2">Tren</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="domain in domainDefs" :key="domain.key">
                  <td class="domain-col">
                    <div class="table-domain-name">
                      <span class="table-domain-dot" :style="{ background: domain.color }"></span>
                      {{ domain.shortLabel || domain.label }}
                    </div>
                  </td>
                  <td v-for="item in comparisonData" :key="item.year" class="year-col">
                    <span :class="{ 'score-zero': item.domains[domain.key] <= 0 }">
                      {{ item.domains[domain.key] > 0 ? item.domains[domain.key].toFixed(2) : '-' }}
                    </span>
                  </td>
                  <td class="trend-col" v-if="comparisonData.length >= 2">
                    <span v-if="getTrend(domain.key)" class="trend-badge" :class="getTrend(domain.key)">
                      <i :class="{
                        'ri-arrow-up-line': getTrend(domain.key) === 'up',
                        'ri-arrow-down-line': getTrend(domain.key) === 'down',
                        'ri-subtract-line': getTrend(domain.key) === 'stable'
                      }"></i>
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                </tr>
                <!-- Total row -->
                <tr class="total-row">
                  <td class="domain-col"><strong>Total</strong></td>
                  <td v-for="item in comparisonData" :key="item.year" class="year-col">
                    <strong :class="{ 'score-zero': item.total <= 0 }">
                      {{ item.total > 0 ? item.total.toFixed(2) : '-' }}
                    </strong>
                  </td>
                  <td class="trend-col" v-if="comparisonData.length >= 2">
                    <span v-if="getTotalTrend()" class="trend-badge" :class="getTotalTrend()">
                      <i :class="{
                        'ri-arrow-up-line': getTotalTrend() === 'up',
                        'ri-arrow-down-line': getTotalTrend() === 'down',
                        'ri-subtract-line': getTotalTrend() === 'stable'
                      }"></i>
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Year Selector Bar ─────────────────────────────────── */
.year-selector-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  background: linear-gradient(135deg, #f0f4ff 0%, #f8faff 50%, #f0f7ff 100%);
  border: 1px solid #dbeafe;
  border-radius: 16px;
  padding: 12px 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.year-selector-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  flex-shrink: 0;
}

.year-selector-label i {
  font-size: 16px;
  color: #94a3b8;
}

.year-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.year-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 50px;
  border: 1.5px solid #cbd5e1;
  background: #fff;
  color: #475569;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
}

.year-pill:hover {
  border-color: #93c5fd;
  background: #eff6ff;
  color: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12);
}

.year-pill.active {
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.35);
}

.year-pill.active:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
  background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
}

.current-badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 50px;
  background: rgba(255, 255, 255, 0.25);
  color: inherit;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.year-pill:not(.active) .current-badge {
  background: #dbeafe;
  color: #2563eb;
}

/* ── Comparison Card ───────────────────────────────────── */
.comparison-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 50px rgba(99, 51, 228, 0.08), 0 4px 16px rgba(37, 99, 235, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04);
  background: #fff;
  border: 1px solid #e8eef6;
}

/* ── Header ────────────────────────────────────────────── */
.comparison-header {
  background: #fff;
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
}

.comparison-header-inner {
  display: flex;
  align-items: center;
  gap: 16px;
}

.comparison-header-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #3b82f6; /* blue avatar */
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.25), 0 2px 4px rgba(59, 130, 246, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.comparison-header-icon i {
  font-size: 1.6rem;
  color: #fff;
}

.comparison-header-title {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}

.comparison-header-sub {
  font-size: 13px;
  font-weight: 500;
  color: #94a3b8;
  margin-top: 4px;
}

.comparison-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.year-legend {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.legend-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: 50px;
  font-size: 12px;
  font-weight: 700;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Body ──────────────────────────────────────────────── */
.comparison-body {
  padding: 24px;
}

/* ── Empty State ───────────────────────────────────────── */
.comparison-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  text-align: center;
}

.empty-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, #eff6ff, #dbeafe);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.empty-icon-wrapper i {
  font-size: 1.8rem;
  color: #93c5fd;
}

.comparison-empty-text {
  font-size: 14px;
  font-weight: 700;
  color: #334155;
  margin: 0 0 4px;
}

.comparison-empty-sub {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}

/* ── Total Score Strip ─────────────────────────────────── */
.total-comparison-strip {
  background: linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%);
  border: 1px solid #dbeafe;
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 24px;
}

.total-comparison-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #1e3a5f;
  margin-bottom: 14px;
}

.total-comparison-label i {
  font-size: 18px;
  color: #2563eb;
}

.total-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.total-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.total-bar-year {
  font-size: 13px;
  font-weight: 800;
  width: 42px;
  text-align: right;
  flex-shrink: 0;
}

.total-bar-track {
  flex: 1;
  height: 28px;
  background: #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
  position: relative;
}

.total-bar-fill {
  height: 100%;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 12px;
  min-width: 0;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.total-bar-value {
  font-size: 11px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
}

.total-bar-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  width: 70px;
  text-align: left;
  flex-shrink: 0;
}

/* ── Domain Comparison Grid ────────────────────────────── */
.domain-comparison-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.domain-comparison-card {
  background: #fff;
  border: 1px solid #e8eef6;
  border-radius: 14px;
  padding: 16px;
  transition: all 0.25s ease;
}

.domain-comparison-card:hover {
  border-color: #bfdbfe;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.08);
  transform: translateY(-2px);
}

.domain-comp-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.domain-comp-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.domain-comp-icon i {
  font-size: 1.1rem;
  color: #fff;
}

.domain-comp-title-area {
  display: flex;
  align-items: center;
  gap: 8px;
}

.domain-comp-name {
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
}

.domain-comp-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.domain-bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.domain-bar-year {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  width: 36px;
  text-align: right;
  flex-shrink: 0;
}

.domain-bar-track {
  flex: 1;
  height: 20px;
  background: #f1f5f9;
  border-radius: 10px;
  overflow: hidden;
}

.domain-bar-fill {
  height: 100%;
  border-radius: 10px;
  min-width: 0;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.domain-bar-score {
  font-size: 12px;
  font-weight: 800;
  width: 36px;
  text-align: left;
  flex-shrink: 0;
}

/* ── Trend Badge ───────────────────────────────────────── */
.trend-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  font-size: 12px;
}

.trend-badge.small {
  width: 20px;
  height: 20px;
  font-size: 10px;
}

.trend-badge.up {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.trend-badge.down {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}

.trend-badge.stable {
  background: rgba(100, 116, 139, 0.12);
  color: #64748b;
}

/* ── Trend Chart ───────────────────────────────────────── */
.trend-chart-wrapper {
  background: #fff;
  border: 1px solid #e8eef6;
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 24px;
}

.trend-chart-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 16px;
}

.trend-chart-title i {
  font-size: 18px;
  color: #2563eb;
}

/* ── Comparison Table ──────────────────────────────────── */
.comparison-table-wrapper {
  border: 1px solid #e8eef6;
  border-radius: 14px;
  overflow: hidden;
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.comparison-table th {
  background: #f8fafc;
  padding: 12px 14px;
  font-weight: 700;
  font-size: 12px;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid #e2e8f0;
  text-align: center;
}

.comparison-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
  text-align: center;
  font-weight: 600;
  color: #334155;
}

.comparison-table .domain-col {
  text-align: left;
  min-width: 140px;
}

.comparison-table .year-col {
  min-width: 80px;
}

.comparison-table .trend-col {
  width: 60px;
}

.table-year-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 50px;
  font-size: 11px;
  font-weight: 800;
}

.table-domain-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.table-domain-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.total-row td {
  background: #f8fafc;
  border-top: 2px solid #e2e8f0;
}

.score-zero {
  color: #94a3b8;
}

/* ── Responsive ────────────────────────────────────────── */
@media (max-width: 768px) {
  .year-selector-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .domain-comparison-grid {
    grid-template-columns: 1fr;
  }

  .comparison-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .total-bar-label {
    display: none;
  }
}
</style>
