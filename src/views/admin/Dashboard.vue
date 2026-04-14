<script setup>
import { ref, computed, onMounted, watch } from "vue";
import SpkReusebleJobs from "@/shared/components/@spk/dashboards/jobs/dashboard/spk-reuseble-jobs.vue";
import RadarChartIkas from '@/shared/components/@spk/charts/ikas-charts.vue';
import SektorAnalytics from '@/components/dashboards/sektor-analytics.vue';

// Stores
import { useStakeholdersStore } from "@/stores/stakeholders";
import { useIkasStore } from "@/stores/ikas";
import { useCsirtStore } from "@/stores/csirt";

// Services
import { sektorService, subSektorService, getSektorName, getSubSektorName, getSubSektorParentId } from "@/services/sektor.service";
import { dashboardService } from "@/services/dashboard.service";

const date = ref();
const showMetabase = ref(false);
const loading = ref(true);

// Stores
const stakeholdersStore = useStakeholdersStore();
const ikasStore = useIkasStore();
const csirtStore = useCsirtStore();

// API Data
const sektorList = ref([]);
const subSektorList = ref([]);

// --- Dashboard Summary (from /api/dashboard/summary) ---
const summaryLoading = ref(false);
const summaryError = ref(false);
const summaryData = ref(null);

// Year & Quarter filter for summary API
const summaryYear = ref(String(new Date().getFullYear()));
const summaryQuarter = ref('');  // '' = all quarters

// Helper: format Date to YYYY-MM-DD for API params
function formatDateParam(d) {
    if (!d) return undefined;
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return undefined;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

async function fetchDashboardSummary() {
    summaryLoading.value = true;
    summaryError.value = false;
    try {
        // Build params from current filters
        const params = {};
        if (summaryYear.value) params.year = summaryYear.value;
        if (summaryQuarter.value) params.quarter = summaryQuarter.value;
        const data = await dashboardService.getSummary(params);
        summaryData.value = data;
        console.log('Dashboard summary:', data);
    } catch (err) {
        console.error('Failed to fetch dashboard summary:', err);
        summaryError.value = true;
    } finally {
        summaryLoading.value = false;
    }
}

// --- Computed: KSE summary cards (from API) ---
const kseData = computed(() => summaryData.value?.kse ?? null);
const kseStatus = computed(() => summaryData.value?.kse_status ?? null);
const apiSektorCounts = computed(() => summaryData.value?.sektor_counts ?? []);

// KSE fill rate
const kseFillRate = computed(() => {
    const s = kseStatus.value;
    if (!s || !s.total_perusahaan) return 0;
    return Math.round((s.sudah_mengisi_kse / s.total_perusahaan) * 100);
});

// Top-level summary cards from API data
const summaryCards = computed(() => {
    const kse = kseData.value;
    const status = kseStatus.value;
    if (!kse && !status) return [];

    return [
        {
            title: 'Total Perusahaan',
            key: 'total_perusahaan',
            count: status?.total_perusahaan ?? 0,
            icon: 'ri-building-2-line',
            color: 'primary',
            gradient: 'linear-gradient(135deg, #845adf 0%, #a78bfa 100%)',
        },
        {
            title: 'Total SE',
            key: 'total_se',
            count: kse?.total_se ?? 0,
            icon: 'ri-git-branch-line',
            color: 'info',
            gradient: 'linear-gradient(135deg, #23b7e5 0%, #67e8f9 100%)',
        },
        {
            title: 'SE Strategis',
            key: 'strategis',
            count: kse?.strategis ?? 0,
            icon: 'ri-shield-star-line',
            color: 'danger',
            gradient: 'linear-gradient(135deg, #e6533c 0%, #f87171 100%)',
        },
        {
            title: 'SE Tinggi',
            key: 'tinggi',
            count: kse?.tinggi ?? 0,
            icon: 'ri-arrow-up-circle-line',
            color: 'warning',
            gradient: 'linear-gradient(135deg, #f5b849 0%, #fcd34d 100%)',
        },
        {
            title: 'SE Rendah',
            key: 'rendah',
            count: kse?.rendah ?? 0,
            icon: 'ri-arrow-down-circle-line',
            color: 'success',
            gradient: 'linear-gradient(135deg, #26bf94 0%, #6ee7b7 100%)',
        },
        {
            title: 'SE Bulan Ini',
            key: 'this_month',
            count: kse?.this_month ?? 0,
            icon: 'ri-calendar-check-line',
            color: 'secondary',
            gradient: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
        },
    ];
});

const toggleMetabase = () => {
    showMetabase.value = !showMetabase.value;
};

const dateRange = computed(() => {
    if (!date.value || !Array.isArray(date.value) || date.value.length < 2) {
        return null;
    }
    return {
        start: date.value[0],
        end: date.value[1]
    };
});

// Initialize date range to current month
const now = new Date();
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
date.value = [monthStart, monthEnd];

// Custom range input state
const datepickerRef = ref(null);
const customValue = ref('');
const customUnit = ref('days');

const applyCustomRange = () => {
    if (!customValue.value || customValue.value <= 0) return;
    const val = parseInt(customValue.value);
    const end = new Date();
    const start = new Date();
    
    // Set to end of day for 'end'
    end.setHours(23, 59, 59, 999);
    
    // Set to start of day for 'start'
    start.setHours(0, 0, 0, 0);

    if (customUnit.value === 'days') {
        start.setDate(start.getDate() - val);
    } else if (customUnit.value === 'months') {
        start.setMonth(start.getMonth() - val);
    } else if (customUnit.value === 'years') {
        start.setFullYear(start.getFullYear() - val);
    }
    
    date.value = [start, end];
    if (datepickerRef.value) {
        datepickerRef.value.closeMenu();
    }
};

const singleDateValue = ref('');

const applySingleDate = () => {
    if (!singleDateValue.value) return;
    const targetDate = new Date(singleDateValue.value);
    
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);
    
    date.value = [start, end];
    if (datepickerRef.value) {
        datepickerRef.value.closeMenu();
    }
};

// ─── Date range helpers ─────────────────────────────────
function isInDateRange(createdAt, range) {
    if (!range || !range.start || !range.end || !createdAt) return false;
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return false;
    const start = new Date(range.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(range.end);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
}

// Format date range label for card display
const dateRangeLabel = computed(() => {
    if (!dateRange.value) return 'bulan ini';
    const s = new Date(dateRange.value.start);
    const e = new Date(dateRange.value.end);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    // Same month?
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
        return months[s.getMonth()] + ' ' + s.getFullYear();
    }
    return months[s.getMonth()] + ' - ' + months[e.getMonth()] + ' ' + e.getFullYear();
});

/**
 * Generate monthly trend data (last 6 months).
 * Returns { data: number[], labels: string[] }
 * dateField supports dot notation e.g. 'perusahaan.created_at'
 */
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function getMonthlyTrend(items, dateField = 'created_at', monthsBack = 6) {
    const now = new Date();
    const buckets = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
        const y = now.getFullYear();
        const m = now.getMonth() - i;
        const d = new Date(y, m, 1);
        buckets.push({
            year: d.getFullYear(),
            month: d.getMonth(),
            count: 0,
            label: MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear(),
        });
    }
    function getField(obj, path) {
        return path.split('.').reduce((o, k) => o && o[k], obj);
    }
    items.forEach(item => {
        const raw = getField(item, dateField) || item['created_at'];
        if (!raw || typeof raw !== 'string') return;
        const d = new Date(raw);
        if (isNaN(d.getTime())) return;
        const bucket = buckets.find(
            b => b.year === d.getFullYear() && b.month === d.getMonth()
        );
        if (bucket) bucket.count++;
    });
    return {
        data: buckets.map(b => b.count),
        labels: buckets.map(b => b.label),
    };
}

/** Build sparkline chart options with month labels in tooltip */
function buildSparkOptions(color, labels) {
    return {
        chart: { type: 'area', sparkline: { enabled: true } },
        stroke: { curve: 'smooth', width: 2 },
        fill: { opacity: 0.3 },
        colors: [getColor(color)],
        xaxis: { categories: labels },
        tooltip: {
            fixed: { enabled: false },
            x: { show: true },
            y: { title: { formatter: () => '' } },
            marker: { show: false }
        }
    };
}

// ─── Fetch all data ─────────────────────────────────────
onMounted(async () => {
    loading.value = true;
    // Fetch summary in parallel (independent)
    fetchDashboardSummary();
    try {
        await Promise.all([
            stakeholdersStore.initialize(),
            ikasStore.initialize(),
            csirtStore.initialize(),
            (async () => {
                const [sektors, subSektors] = await Promise.all([
                    sektorService.getAll(),
                    subSektorService.getAll(),
                ]);
                sektorList.value = sektors;
                subSektorList.value = subSektors;
            })(),
        ]);
    } catch (e) {
        console.error("Dashboard data load error:", e);
    } finally {
        loading.value = false;
    }
});

// ─── Color Palette ──────────────────────────────────────
function getColor(colorName) {
    const colors = {
        primary: '#845adf', secondary: '#23b7e5', warning: '#f5b849',
        info: '#26bf94', success: '#26bf94', danger: '#e6533c',
        purple: '#8c57ff', teal: '#14b8a6', indigo: '#6366f1',
        cyan: '#06b6d4', emerald: '#10b981', rose: '#f43f5e',
    };
    return colors[colorName] || '#845adf';
}

// ─── Enriched Sektor Data ───────────────────────────────
const enrichedSektors = computed(() => {
    const range = dateRange.value;
    return sektorList.value.map((sektor) => {
        const children = subSektorList.value.filter((ss) => {
            const pid = getSubSektorParentId(ss);
            return pid !== undefined && String(pid) === String(sektor.id);
        });
        // Count ALL stakeholders belonging to this sektor
        const childIds = new Set(children.map(c => String(c.id)));
        const sektorStakeholders = stakeholdersStore.allStakeholders.filter(s => {
            const subSektorId = s.sub_sektor?.id || s.id_sub_sektor;
            return subSektorId && childIds.has(String(subSektorId));
        });
        const stakeholderCount = sektorStakeholders.length;
        // Count stakeholders created within date range
        const stakeholderInRange = sektorStakeholders.filter(s =>
            isInDateRange(s.created_at, range)
        ).length;

        return {
            ...sektor,
            displayName: getSektorName(sektor),
            subSektorCount: children.length,
            stakeholderCount,
            stakeholderInRange,
        };
    });
});

// ─── CSIRT & SE Counts (All time) ───────────────────────
const totalCsirt = computed(() => csirtStore.csirts.length);
const totalSdm = computed(() => csirtStore.sdmList.length);
const totalSe = computed(() => csirtStore.seList.length);
const totalStakeholders = computed(() => stakeholdersStore.allStakeholders.length);

// Count stakeholders with complete CSIRT
const stakeholdersWithCsirt = computed(() => {
    return stakeholdersStore.allStakeholders.filter(s => csirtStore.hasCompleteCsirt(s.id)).length;
});

// Count stakeholders with IKAS
const stakeholdersWithIkas = computed(() => {
    return stakeholdersStore.allStakeholders.filter(s => {
        const data = ikasStore.ikasDataMap[s.slug];
        if (!data) return false;
        const val = data.total_rata_rata;
        return val !== null && val !== 0 && val !== 'NA';
    }).length;
});

// ─── Full Summary Computed Data ─────────────────────────
const csirtCompletionRate = computed(() => {
    if (!totalStakeholders.value) return 0;
    return Math.round((stakeholdersWithCsirt.value / totalStakeholders.value) * 100);
});

const ikasCompletionRate = computed(() => {
    if (!totalStakeholders.value) return 0;
    return Math.round((stakeholdersWithIkas.value / totalStakeholders.value) * 100);
});

const avgSdmPerCsirt = computed(() => {
    if (!totalCsirt.value) return 0;
    return (totalSdm.value / totalCsirt.value).toFixed(1);
});

const avgSePerCsirt = computed(() => {
    if (!totalCsirt.value) return 0;
    return (totalSe.value / totalCsirt.value).toFixed(1);
});

const totalSektors = computed(() => sektorList.value.length);
const totalSubSektors = computed(() => subSektorList.value.length);

// IKAS average score
const avgIkasScore = computed(() => {
    const stakeholders = stakeholdersStore.allStakeholders;
    let totalScore = 0;
    let count = 0;
    stakeholders.forEach(s => {
        const data = ikasStore.ikasDataMap[s.slug];
        if (data && data.total_rata_rata && data.total_rata_rata !== 'NA' && data.total_rata_rata !== 0) {
            totalScore += Number(data.total_rata_rata);
            count++;
        }
    });
    if (!count) return 0;
    return (totalScore / count).toFixed(2);
});

// Full summary items: combines API data (kse, kse_status) with local store data
const fullSummaryItems = computed(() => {
    const kse = kseData.value;
    const status = kseStatus.value;
    return [
        {
            label: 'Perusahaan',
            value: status?.total_perusahaan ?? totalStakeholders.value,
            icon: 'ri-building-2-line',
            gradient: 'linear-gradient(135deg, #845adf 0%, #a78bfa 100%)',
            color: '#845adf',
        },
        {
            label: 'Total SE (KSE)',
            value: kse?.total_se ?? totalSe.value,
            icon: 'ri-git-branch-line',
            gradient: 'linear-gradient(135deg, #23b7e5 0%, #67e8f9 100%)',
            color: '#23b7e5',
        },
        {
            label: 'SE Strategis',
            value: kse?.strategis ?? 0,
            icon: 'ri-shield-star-line',
            gradient: 'linear-gradient(135deg, #e6533c 0%, #f87171 100%)',
            color: '#e6533c',
        },
        {
            label: 'SE Tinggi',
            value: kse?.tinggi ?? 0,
            icon: 'ri-arrow-up-circle-line',
            gradient: 'linear-gradient(135deg, #f5b849 0%, #fcd34d 100%)',
            color: '#f5b849',
        },
        {
            label: 'SE Rendah',
            value: kse?.rendah ?? 0,
            icon: 'ri-arrow-down-circle-line',
            gradient: 'linear-gradient(135deg, #26bf94 0%, #6ee7b7 100%)',
            color: '#26bf94',
        },
        {
            label: 'SE Bulan Ini',
            value: kse?.this_month ?? 0,
            icon: 'ri-calendar-check-line',
            gradient: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
            color: '#6366f1',
        },
    ];
});

// Re-fetch summary when year/quarter changes
watch([summaryYear, summaryQuarter], () => {
    fetchDashboardSummary();
});

// ─── Date-filtered counts ───────────────────────────────
const filteredStakeholders = computed(() => {
    const range = dateRange.value;
    return stakeholdersStore.allStakeholders.filter(s => isInDateRange(s.created_at, range)).length;
});
const filteredCsirt = computed(() => {
    const range = dateRange.value;
    return csirtStore.csirts.filter(c => isInDateRange(c.perusahaan?.created_at, range)).length;
});
const filteredSdm = computed(() => {
    const range = dateRange.value;
    return csirtStore.sdmList.filter(s => isInDateRange(s.created_at, range)).length;
});
const filteredSe = computed(() => {
    const range = dateRange.value;
    if (!range) return totalSe.value;
    return csirtStore.seList.filter(se => {
        // Try SE's own created_at first (may exist from API but not typed)
        const seDate = se['created_at'] || se['updated_at'];
        if (seDate && isInDateRange(seDate, range)) return true;
        // Fall back to parent CSIRT's perusahaan.created_at
        const csirt = csirtStore.csirts.find(c => String(c.id) === String(se.id_csirt));
        if (csirt?.perusahaan?.created_at && isInDateRange(csirt.perusahaan.created_at, range)) return true;
        return false;
    }).length;
});

// ─── ROW 1 Cards: Sektor-based data ────────────────────
const sektorCards = computed(() => {
    const sektorColors = ['primary', 'success', 'warning', 'purple', 'info', 'danger', 'teal', 'indigo', 'cyan', 'emerald', 'rose', 'secondary'];
    const sektorIcons = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M223.45,40.07a8,8,0,0,0-7.52-7.52C139.8,28.08,78.82,51,52.82,94a87.09,87.09,0,0,0-12.76,49A101.72,101.72,0,0,0,46.7,175.2a4,4,0,0,0,6.61,1.43l85-86.3a8,8,0,0,1,11.32,11.32L56.74,195.94,42.55,210.13a8.2,8.2,0,0,0-.6,11.1,8,8,0,0,0,11.71.43l16.79-16.79c14.14,6.84,28.41,10.57,42.56,11.07q1.67.06,3.33.06A86.93,86.93,0,0,0,162,203.18C205,177.18,227.93,116.21,223.45,40.07Z"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232,120h-8.34a95.07,95.07,0,0,0-8.82-32.9l7.23-4.17a8,8,0,0,0-8-13.86l-7.25,4.19a97,97,0,0,0-24.08-24.08l4.19-7.25a8,8,0,0,0-13.86-8l-4.17,7.23A95.07,95.07,0,0,0,136,32.34V24a8,8,0,0,0-16,0v8.34a95.07,95.07,0,0,0-32.9,8.82l-4.17-7.23a8,8,0,0,0-13.86,8l4.19,7.25A97,97,0,0,0,49.18,73.26l-7.25-4.19a8,8,0,0,0-8,13.86l7.23,4.17A95.07,95.07,0,0,0,32.34,120H24a8,8,0,0,0,0,16h8.34a95.07,95.07,0,0,0,8.82,32.9l-7.23,4.17a8,8,0,0,0,4,14.93,7.92,7.92,0,0,0,4-1.07l7.25-4.19a97,97,0,0,0,24.08,24.08l-4.19,7.25a8,8,0,0,0,13.86,8l4.17-7.23a95.07,95.07,0,0,0,32.9,8.82V232a8,8,0,0,0,16,0v-8.34a95.07,95.07,0,0,0,32.9-8.82l4.17,7.23a8,8,0,0,0,13.86-8l-4.19-7.25a97,97,0,0,0,24.08-24.08l7.25,4.19A8,8,0,0,0,225,184a8,8,0,0,0-2.92-10.93l-7.23-4.17a95.07,95.07,0,0,0,8.82-32.9H232a8,8,0,0,0,0-16ZM72,128A55.91,55.91,0,0,1,93.38,84l25.38,44L93.38,172A55.91,55.91,0,0,1,72,128Zm56,56a55.67,55.67,0,0,1-20.78-4l25.4-44h50.8A56.09,56.09,0,0,1,128,184Zm4.62-64-25.4-44a56,56,0,0,1,76.2,44Z"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M221.69,199.77,160,96.92V40h8a8,8,0,0,0,0-16H88a8,8,0,0,0,0,16h8V96.92L34.31,199.77A16,16,0,0,0,48,224H208a16,16,0,0,0,13.72-24.23Zm-90.08-42.91c-15.91-8.05-31.05-12.32-45.22-12.81l24.47-40.8A7.93,7.93,0,0,0,112,99.14V40h32V99.14a7.93,7.93,0,0,0,1.14,4.11L183.36,167C171.4,169.34,154.29,168.34,131.61,156.86Z"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.27,47,25.53a8,8,0,0,0,4.2,0c1-.26,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm-37,87.43-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,1,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43Z"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M160,136v-8H88v64a8,8,0,0,0,8,8h64v-8a16,16,0,0,1,16-16h32a16,16,0,0,1,16,16v32a16,16,0,0,1-16,16H176a16,16,0,0,1-16-16v-8H96a24,24,0,0,1-24-24V80H64A16,16,0,0,1,48,64V32A16,16,0,0,1,64,16H96a16,16,0,0,1,16,16V64A16,16,0,0,1,96,80H88v32h72v-8a16,16,0,0,1,16-16h32a16,16,0,0,1,16,16v32a16,16,0,0,1-16,16H176A16,16,0,0,1,160,136Z"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm-72,78.63V184a8,8,0,0,1-16,0V158.63a24,24,0,1,1,16,0ZM160,80H96V56a32,32,0,0,1,64,0Z"/></svg>',
    ];

    // Take top 6 sektor sorted by stakeholder count (or all if less)
    const sorted = [...enrichedSektors.value]
        .sort((a, b) => b.stakeholderCount - a.stakeholderCount);

    return sorted.slice(0, 6).map((sektor, idx) => {
        const color = sektorColors[idx % sektorColors.length];
        const trend = getMonthlyTrend(
            stakeholdersStore.allStakeholders.filter(s => {
                const sid = s.sub_sektor?.id || s.id_sub_sektor;
                return sid && new Set(subSektorList.value.filter(ss => {
                    const pid = getSubSektorParentId(ss);
                    return pid !== undefined && String(pid) === String(sektor.id);
                }).map(c => String(c.id))).has(String(sid));
            })
        );
        return {
            title: sektor.displayName,
            avatarClass: "avatar-md flex-shrink-0",
            ValueClass: "fw-semibold lh-sm",
            smallText: "fs-12 lh-base",
            ValueClass1: "fs-12 lh-base",
            count: String(sektor.stakeholderCount),
            percent: String(sektor.stakeholderInRange),
            monthLabel: dateRangeLabel.value,
            iconColor: "success fw-medium",
            cardClass: `dashboard-main-card overflow-hidden ${color}`,
            priceColor: color,
            svgIcon: sektorIcons[idx % sektorIcons.length],
            id: `chart-sektor-${idx}`,
            type: 'area',
            height: '50',
            width: '100',
            chartSeries: [{ name: sektor.displayName, data: trend.data }],
            chartOptions: buildSparkOptions(color, trend.labels)
        };
    });
});

// ─── ROW 2 Cards: CSIRT, SE, IKAS ──────────────────────
const operationalCards = computed(() => {
    const csirtTrend = getMonthlyTrend(csirtStore.csirts, 'perusahaan.created_at');
    const sdmTrend = getMonthlyTrend(csirtStore.sdmList);
    const seTrend = getMonthlyTrend(csirtStore.seList);
    const stakeholderTrend = getMonthlyTrend(stakeholdersStore.allStakeholders);

    return [
        {
            title: "Total CSIRT",
            count: String(totalCsirt.value),
            percent: String(filteredCsirt.value),
            monthLabel: dateRangeLabel.value,
            priceColor: "danger",
            iconColor: "success fw-medium",
            cardClass: "dashboard-main-card overflow-hidden danger",
            avatarClass: "avatar-md flex-shrink-0",
            ValueClass: "fw-semibold lh-sm",
            smallText: "fs-12 lh-base",
            ValueClass1: "fs-12 lh-base",
            svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm-72,78.63V184a8,8,0,0,1-16,0V158.63a24,24,0,1,1,16,0ZM160,80H96V56a32,32,0,0,1,64,0Z"/></svg>',
            id: 'chart-csirt',
            type: 'area',
            height: '50',
            width: '100',
            chartSeries: [{ name: 'CSIRT', data: csirtTrend.data }],
            chartOptions: buildSparkOptions('danger', csirtTrend.labels)
        },
        {
            title: "SDM CSIRT",
            count: String(totalSdm.value),
            percent: String(filteredSdm.value),
            monthLabel: dateRangeLabel.value,
            priceColor: "info",
            iconColor: "success fw-medium",
            cardClass: "dashboard-main-card overflow-hidden info",
            avatarClass: "avatar-md flex-shrink-0",
            ValueClass: "fw-semibold lh-sm",
            smallText: "fs-12 lh-base",
            ValueClass1: "fs-12 lh-base",
            svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44,44,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z"/></svg>',
            id: 'chart-sdm',
            type: 'area',
            height: '50',
            width: '100',
            chartSeries: [{ name: 'SDM', data: sdmTrend.data }],
            chartOptions: buildSparkOptions('info', sdmTrend.labels)
        },
        {
            title: "Sistem Elektronik",
            count: String(totalSe.value),
            percent: String(filteredSe.value),
            monthLabel: dateRangeLabel.value,
            priceColor: "purple",
            iconColor: "success fw-medium",
            cardClass: "dashboard-main-card overflow-hidden purple",
            avatarClass: "avatar-md flex-shrink-0",
            ValueClass: "fw-semibold lh-sm",
            smallText: "fs-12 lh-base",
            ValueClass1: "fs-12 lh-base",
            svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M160,136v-8H88v64a8,8,0,0,0,8,8h64v-8a16,16,0,0,1,16-16h32a16,16,0,0,1,16,16v32a16,16,0,0,1-16,16H176a16,16,0,0,1-16-16v-8H96a24,24,0,0,1-24-24V80H64A16,16,0,0,1,48,64V32A16,16,0,0,1,64,16H96a16,16,0,0,1,16,16V64A16,16,0,0,1,96,80H88v32h72v-8a16,16,0,0,1,16-16h32a16,16,0,0,1,16,16v32a16,16,0,0,1-16,16H176A16,16,0,0,1,160,136Z"/></svg>',
            id: 'chart-se',
            type: 'area',
            height: '50',
            width: '100',
            chartSeries: [{ name: 'SE', data: seTrend.data }],
            chartOptions: buildSparkOptions('purple', seTrend.labels)
        },
        {
            title: "Stakeholders",
            count: String(totalStakeholders.value),
            percent: String(filteredStakeholders.value),
            monthLabel: dateRangeLabel.value,
            priceColor: "primary",
            iconColor: "success fw-medium",
            cardClass: "dashboard-main-card overflow-hidden primary",
            avatarClass: "avatar-md flex-shrink-0",
            ValueClass: "fw-semibold lh-sm",
            smallText: "fs-12 lh-base",
            ValueClass1: "fs-12 lh-base",
            svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM96,120a32,32,0,1,1,32,32A32,32,0,0,1,96,120Zm-2.15,72a64,64,0,0,1,68.31,0H93.85ZM208,208H178.23a79.42,79.42,0,0,0-36.59-27.71,48,48,0,1,0-27.28,0A79.42,79.42,0,0,0,77.77,208H48V48H208Z"/></svg>',
            id: 'chart-stakeholders',
            type: 'area',
            height: '50',
            width: '100',
            chartSeries: [{ name: 'Stakeholders', data: stakeholderTrend.data }],
            chartOptions: buildSparkOptions('primary', stakeholderTrend.labels)
        },
    ];
});
</script>

<template>
    <!-- HEADER -->
    <div class="d-flex align-items-center justify-content-between mb-3 page-header-breadcrumb flex-wrap gap-2">
        <div>
            <h1 class="page-title fw-medium fs-20 mb-0">Dashboard</h1>
        </div>

        <div class="d-flex align-items-center flex-wrap">
            <div class="dashboard-datepicker-wrapper">
                <Datepicker placeholder="Ketik tgl (DD/MM/YYYY) atau Pilih Rentang"
                    autoApply v-model="date" range
                    :enable-time-picker="false"
                    format="dd MMM yyyy"
                    :text-input="true"
                    ref="datepickerRef">
                    
                    <template #left-sidebar>
                        <div class="dp-custom-range">
                            <!-- Section 1: Quick Range -->
                            <div class="dp-sidebar-section">
                                <div class="dp-sidebar-header">
                                    <i class="ri-timer-line"></i>
                                    <span>Rentang Cepat</span>
                                </div>
                                <p class="dp-sidebar-desc">Mundur dari hari ini</p>
                                <div class="dp-inline-input">
                                    <input type="number" v-model="customValue" class="dp-num-input" min="1" placeholder="7" @keydown.enter="applyCustomRange" />
                                    <select v-model="customUnit" class="dp-unit-select">
                                        <option value="days">Hari</option>
                                        <option value="months">Bulan</option>
                                        <option value="years">Tahun</option>
                                    </select>
                                </div>
                                <button class="dp-sidebar-btn dp-btn-solid" @click="applyCustomRange" :disabled="!customValue || customValue <= 0">
                                    <i class="ri-arrow-left-line"></i> Terapkan
                                </button>
                            </div>
                            
                            <div class="dp-sidebar-divider"></div>
                            
                            <!-- Section 2: Jump to Date -->
                            <div class="dp-sidebar-section">
                                <div class="dp-sidebar-header">
                                    <i class="ri-calendar-check-line"></i>
                                    <span>Loncat ke Tanggal</span>
                                </div>
                                <p class="dp-sidebar-desc">Pilih 1 hari spesifik</p>
                                <input type="date" v-model="singleDateValue" class="dp-date-input" @keydown.enter="applySingleDate" />
                                <button class="dp-sidebar-btn dp-btn-outline" @click="applySingleDate" :disabled="!singleDateValue">
                                    <i class="ri-focus-3-line"></i> Loncat
                                </button>
                            </div>
                        </div>
                    </template>
                </Datepicker>
            </div>
            <div class="ms-2">
                <button v-if="!showMetabase" class="btn btn-primary d-flex align-items-center gap-2 shadow-sm" @click="toggleMetabase">
                    <i class="ri-refresh-line"></i>
                    <span>Dashboard Metabase</span>
                </button>
                <button v-if="showMetabase" class="btn btn-primary d-flex align-items-center gap-2 shadow-sm" @click="toggleMetabase">
                    <i class="ri-refresh-line"></i>
                    <span>Dashboard Utama</span>
                </button>
            </div>
        </div>
    </div>

    <div v-if="!showMetabase">
        <!-- Removed double summary cards from the top as requested -->

        <!-- LOADING SKELETON (for sektor/operational cards) -->
        <div v-if="loading" class="row g-3 mb-3">
            <div class="col-md-4" v-for="n in 6" :key="n">
                <div class="card custom-card dashboard-main-card">
                    <div class="card-body">
                        <div class="placeholder-glow">
                            <span class="placeholder col-4 mb-2" style="height: 32px; border-radius: 8px;"></span>
                            <span class="placeholder col-6" style="height: 14px; border-radius: 4px;"></span>
                            <div class="d-flex justify-content-between mt-3">
                                <span class="placeholder col-3" style="height: 24px; border-radius: 6px;"></span>
                                <span class="placeholder col-4" style="height: 50px; border-radius: 6px;"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <template v-else>
            <!-- ROW 1 - Sektor Cards (top 6 by stakeholder count) -->
            <div class="row g-3">
                <div class="col-xl-4 col-md-6"
                    v-for="(card, index) in sektorCards"
                    :key="'sektor-' + index">
                    <SpkReusebleJobs
                        titleClass="fs-13 fw-medium mb-0"
                        :listCard="true"
                        :cardClass="`card ${card.cardClass}`"
                        :list="card"
                        :NoCountUp="true"
                    />
                </div>
            </div>

            <!-- ROW 2 - Operational Cards: CSIRT, SDM, SE, Stakeholders -->
            <div class="row g-3">
                <div class="col-xl-3 col-md-6"
                    v-for="(card, index) in operationalCards"
                    :key="'ops-' + index">
                    <SpkReusebleJobs
                        titleClass="fs-13 fw-medium mb-0"
                        :listCard="true"
                        :cardClass="`card ${card.cardClass}`"
                        :list="card"
                        :NoCountUp="true"
                    />
                </div>
            </div>
        </template>

        <!-- ============================================ -->
        <!-- RINGKASAN DATA LENGKAP (Full Summary)       -->
        <!-- ============================================ -->
        <div class="full-summary-section" v-if="!loading">
            <!-- Section Header -->
            <div class="fs-section-header">
                <div class="fs-header-left">
                    <div class="fs-header-icon">
                        <i class="ri-dashboard-3-line"></i>
                    </div>
                    <div>
                        <h2 class="fs-header-title mb-0">Ringkasan Data </h2>
                    </div>
                </div>
                <div class="fs-header-right">
                    <!-- Year Filter -->
                    <div class="fs-filter-group">
                        <label class="fs-filter-label-sm"><i class="ri-calendar-line"></i> Tahun</label>
                        <select v-model="summaryYear" class="form-select form-select-sm fs-year-select">
                            <option value="">Semua</option>
                            <option v-for="y in Array.from({length: 5}, (_, i) => String(new Date().getFullYear() - i))" :key="y" :value="y">{{ y }}</option>
                        </select>
                    </div>
                    <!-- Quarter Filter -->
                    <div class="fs-filter-group">
                        <label class="fs-filter-label-sm"><i class="ri-calendar-check-line"></i> Kuartal</label>
                        <select v-model="summaryQuarter" class="form-select form-select-sm fs-year-select" :disabled="!summaryYear">
                            <option value="">Semua</option>
                            <option value="1">Q1 (Jan–Mar)</option>
                            <option value="2">Q2 (Apr–Jun)</option>
                            <option value="3">Q3 (Jul–Sep)</option>
                            <option value="4">Q4 (Okt–Des)</option>
                        </select>
                    </div>
                    <button class="btn btn-sm btn-outline-primary d-flex align-items-center gap-1" @click="fetchDashboardSummary" :disabled="summaryLoading">
                        <i class="ri-refresh-line" :class="{ 'spin-icon': summaryLoading }"></i>
                        <span>Refresh</span>
                    </button>
                    <div class="fs-freshness ms-2">
                        <i class="ri-refresh-line"></i>
                        <span>Live Data</span>
                        <span class="fs-live-dot"></span>
                    </div>
                </div>
            </div>

            <!-- Summary Loading -->
            <div v-if="summaryLoading && !summaryData" class="row g-3 mb-4">
                <div class="col-xl-4 col-lg-6 col-md-6" v-for="n in 6" :key="'skel-fs-'+n">
                    <div class="card custom-card">
                        <div class="card-body p-3">
                            <div class="skeleton-icon shimmer" style="width:40px;height:40px;border-radius:10px"></div>
                            <div class="skeleton-text shimmer mt-3" style="width:50%;height:12px"></div>
                            <div class="skeleton-number shimmer mt-2" style="width:35%;height:22px"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Summary Error -->
            <div v-else-if="summaryError" class="alert alert-danger d-flex align-items-center gap-2 mb-4">
                <i class="ri-error-warning-line fs-20"></i>
                <span>Gagal memuat data dari API. </span>
                <button class="btn btn-sm btn-outline-danger ms-auto" @click="fetchDashboardSummary">
                    <i class="ri-refresh-line me-1"></i>Coba Lagi
                </button>
            </div>

            <template v-else-if="summaryData">
                <!-- ROW 1: KSE Metric Cards (6 cards) -->
                <div class="row g-3 mb-4">
                    <div class="col-xl-2 col-lg-4 col-md-4 col-sm-6 fs-card-animate" v-for="(item, idx) in fullSummaryItems" :key="'fs-'+idx"
                         :style="{ animationDelay: `${idx * 60}ms` }">
                        <div class="card custom-card summary-stat-card overflow-hidden">
                            <div class="card-body p-3 position-relative">
                                <!-- Background decoration -->
                                <div class="summary-bg-decor" :style="{ background: item.gradient, opacity: 0.07 }"></div>
                                
                                <!-- Icon -->
                                <div class="d-flex align-items-center justify-content-between mb-2">
                                    <div class="avatar avatar-md rounded-circle d-flex align-items-center justify-content-center"
                                         :style="{ background: item.gradient }">
                                        <i :class="item.icon" class="fs-18 text-white"></i>
                                    </div>
                                    <div class="summary-trend-dot" :style="{ background: item.color }"></div>
                                </div>
        
                                <!-- Count -->
                                <h3 class="fw-bold mb-1 summary-count" :style="{ color: item.color }">
                                    {{ (item.value ?? 0).toLocaleString('id-ID') }}
                                </h3>
        
                                <!-- Label -->
                                <p class="fs-12 text-muted mb-0 fw-medium text-uppercase ls-1">
                                    {{ item.label }}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ROW 2: Status Cards -->
                <div class="row g-3 mb-4">
                    <!-- Pengisian KSE -->
                    <div class="col-xl-3 col-lg-6 col-md-6">
                        <div class="card custom-card fs-rate-card">
                            <div class="card-body p-3">
                                <div class="d-flex align-items-center gap-2 mb-3">
                                    <div class="fs-rate-icon bg-primary-transparent">
                                        <i class="ri-checkbox-circle-line text-primary"></i>
                                    </div>
                                    <div>
                                        <p class="fs-rate-label mb-0">Pengisian KSE</p>
                                        <small class="text-muted">Perusahaan yang sudah mengisi</small>
                                    </div>
                                </div>
                                <div class="d-flex align-items-end justify-content-between mb-2">
                                    <h3 class="fw-bold mb-0 text-primary">{{ kseFillRate }}%</h3>
                                    <span class="fs-12 text-muted">
                                        {{ kseStatus?.sudah_mengisi_kse ?? 0 }} / {{ kseStatus?.total_perusahaan ?? 0 }}
                                    </span>
                                </div>
                                <div class="progress" style="height: 6px;">
                                    <div class="progress-bar bg-primary" role="progressbar" 
                                         :style="{ width: kseFillRate + '%' }"></div>
                                </div>
                                <div class="fs-insight-row mt-2">
                                    <i class="ri-close-circle-line text-muted"></i>
                                    <span>Belum mengisi: <strong>{{ kseStatus?.belum_mengisi_kse ?? 0 }}</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- CSIRT Completion -->
                    <div class="col-xl-3 col-lg-6 col-md-6">
                        <div class="card custom-card fs-rate-card">
                            <div class="card-body p-3">
                                <div class="d-flex align-items-center gap-2 mb-3">
                                    <div class="fs-rate-icon bg-danger-transparent">
                                        <i class="ri-shield-check-line text-danger"></i>
                                    </div>
                                    <div>
                                        <p class="fs-rate-label mb-0">Cakupan CSIRT</p>
                                        <small class="text-muted">Stakeholder dengan CSIRT</small>
                                    </div>
                                </div>
                                <div class="d-flex align-items-end justify-content-between mb-2">
                                    <h3 class="fw-bold mb-0 text-danger">{{ csirtCompletionRate }}%</h3>
                                    <span class="fs-12 text-muted">{{ stakeholdersWithCsirt }} / {{ totalStakeholders }}</span>
                                </div>
                                <div class="progress" style="height: 6px;">
                                    <div class="progress-bar bg-danger" role="progressbar" 
                                         :style="{ width: csirtCompletionRate + '%' }"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- IKAS Completion -->
                    <div class="col-xl-3 col-lg-6 col-md-6">
                        <div class="card custom-card fs-rate-card">
                            <div class="card-body p-3">
                                <div class="d-flex align-items-center gap-2 mb-3">
                                    <div class="fs-rate-icon bg-success-transparent">
                                        <i class="ri-shield-star-line text-success"></i>
                                    </div>
                                    <div>
                                        <p class="fs-rate-label mb-0">Cakupan IKAS</p>
                                        <small class="text-muted">Stakeholder dengan IKAS</small>
                                    </div>
                                </div>
                                <div class="d-flex align-items-end justify-content-between mb-2">
                                    <h3 class="fw-bold mb-0 text-success">{{ ikasCompletionRate }}%</h3>
                                    <span class="fs-12 text-muted">{{ stakeholdersWithIkas }} / {{ totalStakeholders }}</span>
                                </div>
                                <div class="progress" style="height: 6px;">
                                    <div class="progress-bar bg-success" role="progressbar" 
                                         :style="{ width: ikasCompletionRate + '%' }"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Sektor & Skor IKAS -->
                    <div class="col-xl-3 col-lg-6 col-md-6">
                        <div class="card custom-card fs-rate-card">
                            <div class="card-body p-3">
                                <div class="d-flex align-items-center gap-2 mb-3">
                                    <div class="fs-rate-icon bg-warning-transparent">
                                        <i class="ri-building-4-line text-warning"></i>
                                    </div>
                                    <div>
                                        <p class="fs-rate-label mb-0">Sektor & SDM</p>
                                        <small class="text-muted">Overview</small>
                                    </div>
                                </div>
                                <div class="d-flex align-items-end justify-content-between mb-2">
                                    <h3 class="fw-bold mb-0 text-warning">{{ totalSektors }}</h3>
                                    <span class="fs-12 text-muted">{{ totalSubSektors }} sub sektor</span>
                                </div>
                                <div class="fs-insight-row">
                                    <i class="ri-team-line text-info"></i>
                                    <span>SDM: <strong>{{ totalSdm }}</strong> &middot; SE Lokal: <strong>{{ totalSe }}</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ROW 3: Sektor Counts Table (from API sektor_counts) -->
                <div v-if="apiSektorCounts.length" class="card custom-card mb-4">
                    <div class="card-header d-flex align-items-center justify-content-between py-3">
                        <div class="d-flex align-items-center gap-2">
                            <div class="fs-rate-icon bg-primary-transparent">
                                <i class="ri-bar-chart-grouped-line text-primary"></i>
                            </div>
                            <div>
                                <h6 class="mb-0 fw-bold">Distribusi Stakeholder per Sektor</h6>
                                <small class="text-muted">Data dari API — {{ apiSektorCounts.length }} sektor</small>
                            </div>
                        </div>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover mb-0 fs-sektor-table">
                                <thead>
                                    <tr>
                                        <th style="width:40px">#</th>
                                        <th>Nama Sektor</th>
                                        <th class="text-center" style="width:130px">Total</th>
                                        <th class="text-center" style="width:130px">Bulan Ini</th>
                                        <th style="width:200px">Distribusi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(sektor, idx) in apiSektorCounts" :key="sektor.id">
                                        <td class="text-muted">{{ idx + 1 }}</td>
                                        <td>
                                            <span class="fw-medium">{{ sektor.nama_sektor }}</span>
                                        </td>
                                        <td class="text-center">
                                            <span class="badge bg-primary-transparent fw-bold">{{ sektor.total }}</span>
                                        </td>
                                        <td class="text-center">
                                            <span v-if="sektor.this_month > 0" class="badge bg-success-transparent fw-bold">
                                                +{{ sektor.this_month }}
                                            </span>
                                            <span v-else class="text-muted">-</span>
                                        </td>
                                        <td>
                                            <div class="d-flex align-items-center gap-2">
                                                <div class="progress flex-grow-1" style="height: 5px;">
                                                    <div class="progress-bar" role="progressbar"
                                                         :style="{ 
                                                             width: (apiSektorCounts.length ? Math.max(2, (sektor.total / Math.max(...apiSektorCounts.map(s => s.total || 1))) * 100) : 0) + '%',
                                                             background: `hsl(${(idx * 35) % 360}, 65%, 55%)`
                                                         }"></div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </template>
        </div>

        <!-- ANALISIS STAKEHOLDER PER SEKTOR -->
        <SektorAnalytics />

        <!-- RADAR CHARTS -->
        <RadarChartIkas />
    </div>

    <!-- METABASE EMBED -->
    <div v-else class="row">
        <div class="col-12">
            <div class="card custom-card">
                <div class="card-body p-0">
                    <iframe
                        src="https://metabase.kssindustri.site/public/dashboard/6322d724-0de2-4a91-92d9-94ac85aa7f83"
                        frameborder="0"
                        width="100%"
                        height="800"
                        allowtransparency
                    ></iframe>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* ===== SUMMARY CARD ANIMATIONS ===== */
.summary-card-animate {
    animation: summaryFadeUp 0.5s ease-out both;
}

@keyframes summaryFadeUp {
    from {
        opacity: 0;
        transform: translateY(16px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* ===== SUMMARY STAT CARD ===== */
.summary-stat-card {
    border: 1px solid rgba(0,0,0,0.04);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: default;
}
.summary-stat-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.08);
}

.summary-bg-decor {
    position: absolute;
    top: -30px;
    right: -30px;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    pointer-events: none;
}

.summary-count {
    font-size: 1.65rem;
    letter-spacing: -0.5px;
    position: relative;
    z-index: 1;
}

.summary-trend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    opacity: 0.7;
}

.ls-1 {
    letter-spacing: 0.5px;
}

/* ===== SKELETON / SHIMMER ===== */
.summary-card-skeleton .card-body {
    min-height: 110px;
}
.skeleton-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #e9ecef;
}
.skeleton-text,
.skeleton-number {
    border-radius: 4px;
    background: #e9ecef;
}

.shimmer {
    background: linear-gradient(90deg, #e9ecef 25%, #f8f9fa 50%, #e9ecef 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

/* ===== FULL SUMMARY SECTION ===== */
.full-summary-section {
    margin-top: 1rem;
    margin-bottom: 0.5rem;
}

.fs-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 1.25rem;
    padding: 16px 20px;
    background: linear-gradient(135deg, rgba(132, 90, 223, 0.06) 0%, rgba(99, 102, 241, 0.04) 100%);
    border-radius: 12px;
    border: 1px solid rgba(132, 90, 223, 0.08);
}

.fs-header-left {
    display: flex;
    align-items: center;
    gap: 14px;
}

.fs-header-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, #845adf 0%, #6366f1 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 20px;
    flex-shrink: 0;
}

.fs-header-title {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 0;
    color: var(--default-text-color);
}

.fs-header-subtitle {
    font-size: 0.8rem;
    color: #94a3b8;
    margin: 2px 0 0;
}

.fs-header-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.fs-filter-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.fs-filter-label-sm {
    font-size: 0.65rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    display: flex;
    align-items: center;
    gap: 3px;
}

.fs-year-select {
    min-width: 110px;
    font-size: 0.8rem;
    font-weight: 600;
    border-radius: 8px;
    border: 1px solid rgba(132, 90, 223, 0.15);
    background: rgba(132, 90, 223, 0.03);
    color: var(--default-text-color);
    padding: 4px 10px;
    transition: all 0.2s;
}

.fs-year-select:focus {
    border-color: #845adf;
    box-shadow: 0 0 0 3px rgba(132, 90, 223, 0.1);
}

.fs-year-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.fs-freshness {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: #26bf94;
    font-weight: 600;
    background: rgba(38, 191, 148, 0.08);
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid rgba(38, 191, 148, 0.15);
}

.fs-live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #26bf94;
    animation: livePulse 1.5s ease-in-out infinite;
}

@keyframes livePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.8); }
}

/* ── Card Animation ── */
.fs-card-animate {
    animation: fsSlideFade 0.45s ease-out both;
}

@keyframes fsSlideFade {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
}

/* ── Metric Card ── */
.fs-metric-card {
    border: 1px solid rgba(0,0,0,0.04);
    overflow: hidden;
    position: relative;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fs-metric-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.07);
}

.fs-metric-bg {
    position: absolute;
    top: -20px;
    right: -20px;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    opacity: 0.06;
    pointer-events: none;
}

.fs-metric-label {
    font-size: 0.78rem;
    color: #94a3b8;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.fs-metric-value {
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.3px;
    line-height: 1.2;
}

.fs-metric-compare {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    color: #94a3b8;
    margin-top: 4px;
}

.fs-metric-icon-wrap {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    flex-shrink: 0;
}

/* ── Rate Card ── */
.fs-rate-card {
    border: 1px solid rgba(0,0,0,0.04);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fs-rate-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.07);
}

.fs-rate-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
}

.fs-rate-label {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--default-text-color);
}

.fs-insight-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.77rem;
    color: #64748b;
    padding-top: 6px;
    border-top: 1px dashed rgba(0,0,0,0.06);
    margin-top: 4px;
}

.progress {
    border-radius: 8px;
    background: rgba(0,0,0,0.04);
}

/* ── Spin icon for loading ── */
.spin-icon {
    animation: spinIcon 1s linear infinite;
}

@keyframes spinIcon {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

/* ── Sektor Table ── */
.fs-sektor-table thead th {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #94a3b8;
    border-bottom: 2px solid rgba(0,0,0,0.06);
    padding: 12px 16px;
    background: rgba(0,0,0,0.01);
}

.fs-sektor-table tbody td {
    padding: 10px 16px;
    vertical-align: middle;
    font-size: 0.85rem;
    border-bottom: 1px solid rgba(0,0,0,0.04);
}

.fs-sektor-table tbody tr:hover {
    background: rgba(132, 90, 223, 0.03);
}

code {
    font-size: 0.72rem;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(132, 90, 223, 0.08);
    color: #845adf;
}
</style>
