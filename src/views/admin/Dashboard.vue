    <script setup>
    import { ref, computed, onMounted, watch, onUnmounted, nextTick } from "vue";
    import { useRouter, useRoute } from "vue-router";
    import SpkReusebleJobs from "@/shared/components/@spk/dashboards/jobs/dashboard/spk-reuseble-jobs.vue";
    import RadarChartIkas from '@/shared/components/@spk/charts/ikas-charts.vue';
    import SektorAnalytics from '@/components/dashboards/sektor-analytics.vue';

    // ─── Dashboard Widgets ──────────────────────────────────
    import AlertIndicators from '@/components/dashboard-widgets/AlertIndicators.vue';
    import KpiCards from '@/components/dashboard-widgets/KpiCards.vue';
    import InsightCard from '@/components/dashboard-widgets/InsightCard.vue';
    import ActionCenter from '@/components/dashboard-widgets/ActionCenter.vue';
    import ActivityFeed from '@/components/dashboard-widgets/ActivityFeed.vue';
    import GeoMap from '@/components/dashboard-widgets/GeoMap.vue';
    import QuickActions from '@/components/dashboard-widgets/QuickActions.vue';
    import GlobalFilter from '@/components/dashboard-widgets/GlobalFilter.vue';
    import DrillDownModal from '@/components/dashboard-widgets/DrillDownModal.vue';
    import DashboardExport from '@/components/dashboard-widgets/DashboardExport.vue';

    // ─── CSS ────────────────────────────────────────────────
    import '@/assets/css/dashboard-widgets.css';

    // Stores
    import { useStakeholdersStore } from "@/stores/stakeholders";
    import { useIkasStore } from "@/stores/ikas";
    import { useCsirtStore } from "@/stores/csirt";
    import { useDashboardFilterStore } from "@/stores/dashboardFilter";
    import { useNotificationStore } from "@/stores/notifications";

    // Services
    import { sektorService, subSektorService, getSektorName, getSubSektorName, getSubSektorParentId } from "@/services/sektor.service";

    const router = useRouter();
    const route = useRoute();
    const showMetabase = ref(false);
    const isFirstLoad = ref(true);
    const loading = ref(true);
    const summaryMode = ref('KSE'); // 'KSE' or 'IKAS'

    // Stores
    const stakeholdersStore = useStakeholdersStore();
    const ikasStore = useIkasStore();
    const csirtStore = useCsirtStore();
    const filterStore = useDashboardFilterStore();
    const notifStore = useNotificationStore();
    
    // Analytics Chart States
    const kseChartType = ref('donut'); // 'donut' or 'bar'
    const ikasChartType = ref('donut'); // 'donut' or 'radar'
    const analyticsView = ref('distribution'); // 'distribution' or 'completion'
    const kseIkasViewMode = ref('overview'); // 'overview' or 'table'

    // API Data
    const sektorList = ref([]);
    const subSektorList = ref([]);

    // Drill-down modal state
    const drillDownVisible = ref(false);
    const drillDownTitle = ref('');
    const drillDownItems = ref([]);
    const drillDownColumns = ref([]);

    // ─── Datepicker State ───────────────────────────────────
    const date = ref(null);
    const datepickerRef = ref(null);
    const customValue = ref('');
    const customUnit = ref('days');
    const singleDateValue = ref('');

    // Sync datepicker model from filterStore on load
    const initDateFromStore = () => {
        const dr = filterStore.dateRange;
        if (dr && dr[0] && dr[1]) {
            date.value = [new Date(dr[0]), new Date(dr[1])];
        } else {
            const now = new Date();
            date.value = [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31)];
        }
    };

    // Watch datepicker changes → push to filterStore
    watch(date, (newVal) => {
        if (!newVal || !Array.isArray(newVal) || newVal.length < 2) return;
        filterStore.updateDateRange(newVal[0], newVal[1]);
    });

    const applyCustomRange = () => {
        if (!customValue.value || customValue.value <= 0) return;
        const val = parseInt(customValue.value);
        const end = new Date();
        const start = new Date();
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);
        if (customUnit.value === 'days') {
            start.setDate(start.getDate() - val);
        } else if (customUnit.value === 'months') {
            start.setMonth(start.getMonth() - val);
        } else if (customUnit.value === 'years') {
            start.setFullYear(start.getFullYear() - val);
        }
        date.value = [start, end];
        if (datepickerRef.value) datepickerRef.value.closeMenu();
    };

    const applySingleDate = () => {
        if (!singleDateValue.value) return;
        const targetDate = new Date(singleDateValue.value);
        const start = new Date(targetDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(targetDate);
        end.setHours(23, 59, 59, 999);
        date.value = [start, end];
        if (datepickerRef.value) datepickerRef.value.closeMenu();
    };

    // Alert Indicators Visibility Logic
    const showAlertIndicators = ref(false);
    let alertTimeout = null;

    const triggerAlertVisibility = () => {
        showAlertIndicators.value = true;
        if (alertTimeout) clearTimeout(alertTimeout);
        alertTimeout = setTimeout(() => {
            showAlertIndicators.value = false;
        }, 30000); // 30 seconds
    };

    onUnmounted(() => {
        if (alertTimeout) clearTimeout(alertTimeout);
    });

    watch(() => filterStore.error, (newError) => {
        if (newError) {
            triggerAlertVisibility();
        }
    });

    // Helpers for time-based calculations
    function isInCategoryYear(dateStr, targetYear) {
        if (!dateStr || !targetYear) return false;
        return new Date(dateStr).getFullYear() === parseInt(targetYear);
    }

    function isInCategoryQuarter(dateStr, targetYear, targetQuarter) {
        if (!dateStr || !targetYear || !targetQuarter) return false;
        const d = new Date(dateStr);
        const q = Math.floor(d.getMonth() / 3) + 1;
        return d.getFullYear() === parseInt(targetYear) && q === parseInt(targetQuarter);
    }

    const kseStatus = computed(() => {
        const stakeholders = datedStakeholders.value;
        const allSe = datedSeList.value; // Use filtered SE list
        let sudah = 0;

        // Build a fast lookup set for SE IDs within the active date/sector filter
        const allowedSeIds = new Set();
        allSe.forEach(se => allowedSeIds.add(String(se.id)));

        stakeholders.forEach(s => {
            const sId = String(s.id);
            const csirt = csirtStore.csirtByPerusahaanMap[sId];
            
            let hasSe = false;
            
            // Check direct SE associations first
            const sePerusahaan = csirtStore.seByPerusahaanMap[sId];
            if (sePerusahaan && sePerusahaan.some(se => allowedSeIds.has(String(se.id)))) {
                hasSe = true;
            } else if (csirt) {
                // Fallback to CSIRT-associated SE
                const seCsirt = csirtStore.seByCsirtMap[String(csirt.id)];
                if (seCsirt && seCsirt.some(se => allowedSeIds.has(String(se.id)))) {
                    hasSe = true;
                }
            }

            if (hasSe) sudah++;
        });

        return {
            total_perusahaan: stakeholders.length,
            sudah_mengisi_kse: sudah,
            belum_mengisi_kse: Math.max(0, stakeholders.length - sudah)
        };
    });

    const kseData = computed(() => {
        const list = baseSeList.value;
        let strategis = 0, tinggi = 0, rendah = 0;
        list.forEach(se => {
            const kat = (se.kategori_se || '').toLowerCase().trim();
            if (kat === 'strategis') strategis++;
            else if (kat === 'tinggi') tinggi++;
            else if (kat === 'rendah') rendah++;
        });
        return {
            total_se: list.length,
            strategis,
            tinggi,
            rendah,
            this_month: filteredSe.value
        };
    });
    const apiSektorCounts = computed(() => {
        const all = baseStakeholders.value;
        const activeSektorId = filterStore.sektorId;
        const currentYear = filterStore.year ? parseInt(filterStore.year) : new Date().getFullYear();
        const currentQuarter = filterStore.quarter ? parseInt(filterStore.quarter) : Math.floor(new Date().getMonth() / 3) + 1;
        const now = new Date();

        if (activeSektorId) {
            const allSubSektors = subSektorList.value;
            const children = allSubSektors.filter(ss => {
                const pid = getSubSektorParentId(ss);
                return pid !== undefined && String(pid) === String(activeSektorId);
            });

            return children.map(ss => {
                const ssStakeholders = all.filter(st => String(st.sub_sektor?.id || st.id_sub_sektor) === String(ss.id));
                
                const countYear = ssStakeholders.filter(st => isInCategoryYear(st.created_at, currentYear)).length;
                const countQuarter = ssStakeholders.filter(st => isInCategoryQuarter(st.created_at, currentYear, currentQuarter)).length;
                const thisMonth = ssStakeholders.filter(st => {
                    if(!st.created_at) return false;
                    const d = new Date(st.created_at);
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).length;

                return {
                    id: ss.id,
                    nama_sektor: getSubSektorName(ss),
                    total: ssStakeholders.length,
                    this_month: thisMonth,
                    countYear,
                    countQuarter
                };
            }).filter(s => s.total > 0).sort((a,b) => b.total - a.total);
        }

        const allSektors = sektorList.value;
        return allSektors.map(s => {
            const children = subSektorList.value.filter(ss => {
                const pid = getSubSektorParentId(ss);
                return pid !== undefined && String(pid) === String(s.id);
            });
            const childIds = new Set(children.map(c => String(c.id)));

            const sectorStakeholders = all.filter(st => {
                const ssId = st.sub_sektor?.id || st.id_sub_sektor;
                return ssId && childIds.has(String(ssId));
            });

            const countYear = sectorStakeholders.filter(st => isInCategoryYear(st.created_at, currentYear)).length;
            const countQuarter = sectorStakeholders.filter(st => isInCategoryQuarter(st.created_at, currentYear, currentQuarter)).length;
            const thisMonth = sectorStakeholders.filter(st => {
                if(!st.created_at) return false;
                const d = new Date(st.created_at);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length;

            return {
                id: s.id,
                nama_sektor: getSektorName(s),
                total: sectorStakeholders.length,
                this_month: thisMonth,
                countYear,
                countQuarter
            };
        }).filter(s => s.total > 0).sort((a,b) => b.total - a.total);
    });

    // KSE fill rate
    const kseFillRate = computed(() => {
        const s = kseStatus.value;
        if (!s || !s.total_perusahaan) return 0;
        return Math.round((s.sudah_mengisi_kse / s.total_perusahaan) * 100);
    });

    const ikasSummaryData = computed(() => {
        const stakeholders = baseIkasStakeholders.value;
        const range = filterStore.dateRange;
        
        // Filter by date range if active
        const filtered = (range && (range[0] || range[1]))
            ? stakeholders.filter(s => isInDateRange(s.updated_at || s.created_at, range))
            : stakeholders;

        let level1 = 0, level2 = 0, level3 = 0, level4 = 0, level5 = 0;
        let idenTotal = 0, protTotal = 0, detTotal = 0, tangTotal = 0;
        let count = 0;

        filtered.forEach(s => {
            const data = ikasStore.ikasDataMap[s.slug];
            if (!data) return;
            
            const score = Number(data.total_rata_rata || 0);
            if (score < 1.5) level1++;
            else if (score < 2.5) level2++;
            else if (score < 3.5) level3++;
            else if (score < 4.5) level4++;
            else level5++;

            idenTotal += Number(data.identifikasi?.nilai_identifikasi || 0);
            protTotal += Number(data.proteksi?.nilai_proteksi || 0);
            detTotal += Number(data.deteksi?.nilai_deteksi || 0);
            tangTotal += Number(data.tanggulih?.nilai_tanggulih || 0);
            count++;
        });

        return {
            total: filtered.length,
            levels: { 
                level1: { count: level1, label: 'Level 1 - Awal', color: '#e6533c', gradient: 'linear-gradient(135deg, #e6533c 0%, #f87171 100%)' },
                level2: { count: level2, label: 'Level 2 - Berulang', color: '#f5b849', gradient: 'linear-gradient(135deg, #f5b849 0%, #fcd34d 100%)' },
                level3: { count: level3, label: 'Level 3 - Terdefinisi', color: '#0ea5e9', gradient: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)' },
                level4: { count: level4, label: 'Level 4 - Terkelola', color: '#23b7e5', gradient: 'linear-gradient(135deg, #23b7e5 0%, #67e8f9 100%)' },
                level5: { count: level5, label: 'Level 5 - Inovatif', color: '#26bf94', gradient: 'linear-gradient(135deg, #26bf94 0%, #6ee7b7 100%)' }
            },
            averages: {
                identifikasi: count > 0 ? (idenTotal / count).toFixed(2) : 0,
                proteksi: count > 0 ? (protTotal / count).toFixed(2) : 0,
                deteksi: count > 0 ? (detTotal / count).toFixed(2) : 0,
                tanggulih: count > 0 ? (tangTotal / count).toFixed(2) : 0,
            }
        };
    });

    // ─── Analytics Chart Options & Series ───────────────────
    const analyticsChartData = computed(() => {
        if (summaryMode.value === 'KSE') {
            if (analyticsView.value === 'distribution') {
                const data = kseData.value;
                return {
                    labels: ['Strategis', 'Tinggi', 'Rendah'],
                    series: [data.strategis, data.tinggi, data.rendah],
                    colors: ['#e6533c', '#f5b849', '#26bf94']
                };
            } else {
                const status = kseStatus.value;
                return {
                    labels: ['Sudah Mengisi', 'Belum Mengisi'],
                    series: [status.sudah_mengisi_kse, status.belum_mengisi_kse],
                    colors: ['#26bf94', '#e6533c']
                };
            }
        } else {
            // IKAS Mode
            if (analyticsView.value === 'distribution') {
                const levels = ikasSummaryData.value.levels;
                return {
                    labels: ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'],
                    series: [levels.level1.count, levels.level2.count, levels.level3.count, levels.level4.count, levels.level5.count],
                    colors: ['#e6533c', '#f5b849', '#0ea5e9', '#23b7e5', '#26bf94']
                };
            } else {
                const avg = ikasSummaryData.value.averages;
                return {
                    labels: ['Identifikasi', 'Proteksi', 'Deteksi', 'Tanggulih'],
                    series: [Number(avg.identifikasi), Number(avg.proteksi), Number(avg.deteksi), Number(avg.tanggulih)],
                    colors: ['#23b7e5', '#6366f1', '#f5b849', '#26bf94']
                };
            }
        }
    });

    const mainAnalyticsOptions = computed(() => {
        const data = analyticsChartData.value;
        const type = summaryMode.value === 'KSE' ? kseChartType.value : ikasChartType.value;
        
        // Base options
        const options = {
            chart: {
                fontFamily: 'Inter, sans-serif',
                toolbar: { show: false },
                parentHeightOffset: 0
            },
            grid: {
                padding: {
                    top: 15,
                    right: 15,
                    bottom: 15,
                    left: 15
                }
            },
            colors: data.colors,
            labels: data.labels,
            stroke: { width: 2, colors: ['#fff'] },
            dataLabels: { enabled: true },
            legend: {
                position: 'bottom',
                fontSize: '11px',
                fontWeight: 600,
                markers: { radius: 12 },
                itemMargin: { horizontal: 5, vertical: 0 }
            },
            tooltip: { theme: 'dark' }
        };

        if (type === 'pie' || type === 'donut') {
            return {
                ...options,
                chart: { ...options.chart, type: 'donut' },
                dataLabels: { enabled: false },
                stroke: { width: 3, colors: ["#fff"] },
                legend: {
                    position: 'bottom',
                    fontSize: '11px',
                    fontWeight: 600,
                    markers: { width: 10, height: 10, radius: 3 },
                    itemMargin: { horizontal: 8, vertical: 4 }
                },
                plotOptions: {
                    pie: {
                        donut: {
                            size: '68%',
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
                                    label: summaryMode.value === 'KSE' ? 'Total KSE' : 'Total IKAS',
                                    fontSize: "12px",
                                    color: "#94a3b8",
                                    formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0)
                                }
                            }
                        }
                    }
                }
            };
        } else if (type === 'bar') {
            return {
                ...options,
                chart: { ...options.chart, type: 'bar' },
                plotOptions: {
                    bar: {
                        borderRadius: 4,
                        horizontal: false,
                        columnWidth: '55%',
                        distributed: true
                    }
                },
                xaxis: { categories: data.labels },
                legend: { show: false }
            };
        } else if (type === 'radar') {
            return {
                ...options,
                chart: { ...options.chart, type: 'radar' },
                xaxis: { categories: data.labels },
                fill: { opacity: 0.4 },
                markers: { size: 4 }
            };
        }
        return options;
    });

    const mainAnalyticsSeries = computed(() => {
        const data = analyticsChartData.value;
        const type = summaryMode.value === 'KSE' ? kseChartType.value : ikasChartType.value;
        
        if (type === 'bar' || type === 'radar') {
            return [{
                name: 'Jumlah',
                data: data.series
            }];
        }
        return data.series;
    });

    // Top-level summary cards from API data
    const fullSummaryItems = computed(() => {
        const katSe = filterStore.kategoriSe;
        const range = filterStore.dateRange;

        if (summaryMode.value === 'IKAS') {
            const s = ikasSummaryData.value;
            const items = [
                {
                    label: 'Total IKAS',
                    value: baseIkasStakeholders.value.length,
                    icon: 'ri-bar-chart-box-line',
                    gradient: 'linear-gradient(135deg, #23b7e5 0%, #67e8f9 100%)',
                    color: '#23b7e5',
                    category: '',
                },
                {
                    label: filterStore.quarter ? `IKAS Q${filterStore.quarter}` : (filterStore.year ? `IKAS ${filterStore.year}` : 'IKAS Periode Ini'),
                    value: filteredIkasCount.value, // Filtered
                    icon: 'ri-calendar-check-line',
                    gradient: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                    color: '#6366f1',
                    category: '',
                },
                ...Object.values(s.levels).map(lvl => ({
                    label: lvl.label,
                    value: lvl.count,
                    icon: 'ri-bar-chart-fill',
                    gradient: lvl.gradient,
                    color: lvl.color,
                    category: lvl.label.split(' - ')[0], // 'Level 1', 'Level 2', etc.
                }))
            ];

            if (katSe) {
                // If a level filter is active, highlight the active level and mute others
                return items.map(item => ({
                    ...item,
                    isMuted: !(item.label.includes('Total') || item.category === katSe)
                }));
            }
            return items.map(item => ({ ...item, isMuted: false }));
        }

        // --- KSE MODE (Existing) ---
        // Use dated filter for category counts
        const datedSe = (range && (range[0] || range[1]))
            ? baseSeList.value.filter(se => {
                const seDate = se['created_at'] || se['updated_at'];
                if (seDate && isInDateRange(seDate, range)) return true;
                // Fallback to company created_at if SE date is missing
                const csirt = csirtStore.csirts.find(c => String(c.id) === String(se.id_csirt));
                if (csirt?.perusahaan?.created_at && isInDateRange(csirt.perusahaan.created_at, range)) return true;
                return false;
            })
            : baseSeList.value;

        let strategis = 0, tinggi = 0, rendah = 0;
        datedSe.forEach(se => {
            const kat = (se.kategori_se || '').toLowerCase().trim();
            if (kat === 'strategis') strategis++;
            else if (kat === 'tinggi') tinggi++;
            else if (kat === 'rendah') rendah++;
        });

        // Filter total SE count (Respects global date filter)
        const totalVal = datedSe.length;

        const items = [
            {
                label: 'Total SE (KSE)',
                value: totalVal,
                icon: 'ri-git-branch-line',
                gradient: 'linear-gradient(135deg, #23b7e5 0%, #67e8f9 100%)',
                color: '#23b7e5',
                category: '',
            },
            {
                label: filterStore.quarter ? `SE Q${filterStore.quarter}` : (filterStore.year ? `SE ${filterStore.year}` : 'SE Periode Ini'),
                value: filteredSe.value, // Respects global date filters
                icon: 'ri-calendar-check-line',
                gradient: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                color: '#6366f1',
                category: '',
            },
            {
                label: 'SE Strategis',
                value: strategis,
                icon: 'ri-shield-star-line',
                gradient: 'linear-gradient(135deg, #e6533c 0%, #f87171 100%)',
                color: '#e6533c',
                category: 'Strategis',
            },
            {
                label: 'SE Tinggi',
                value: tinggi,
                icon: 'ri-arrow-up-circle-line',
                gradient: 'linear-gradient(135deg, #f5b849 0%, #fcd34d 100%)',
                color: '#f5b849',
                category: 'Tinggi',
            },
            {
                label: 'SE Rendah',
                value: rendah,
                icon: 'ri-arrow-down-circle-line',
                gradient: 'linear-gradient(135deg, #26bf94 0%, #6ee7b7 100%)',
                color: '#26bf94',
                category: 'Rendah',
            },
        ];

        // If category filter is active, highlight the active category and mute others
        if (katSe) {
            return items.map(item => ({
                ...item,
                isMuted: !(item.label.includes('Total') || item.category === katSe || item.label.includes('SE Q') || item.label.includes('SE 20') || item.label.includes('Periode'))
            }));
        }

        return items.map(item => ({ ...item, isMuted: false }));
    });

    function handleKseCardClick(item) {
        // Trigger drill-down modal directly for all cards
        handleDrillDown({ type: item.label });
    }

    const toggleMetabase = () => {
        showMetabase.value = !showMetabase.value;
    };

    // (Custom date state logic removed as it's now handled entirely by GlobalFilter.vue & Pinia)

    // ─── Date range helpers ─────────────────────────────────
    function isInDateRange(createdAt, rangeStrArray) {
        if (!rangeStrArray || !rangeStrArray[0] || !rangeStrArray[1] || !createdAt) return false;
        const d = new Date(createdAt);
        if (isNaN(d.getTime())) return false;
        const start = new Date(rangeStrArray[0]);
        start.setHours(0, 0, 0, 0);
        const end = new Date(rangeStrArray[1]);
        end.setHours(23, 59, 59, 999);
        return d >= start && d <= end;
    }

    // Format date range label for card display
    const dateRangeLabel = computed(() => {
        return filterStore.activeFilterLabel.split(' |')[0];
    });

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    /**
     * Generate dynamic trend data based on current global filter.
     * Granularity (buckets) will follow the selected period:
     * - Year: 12 monthly buckets (Jan-Dec)
     * - Quarter: 3 monthly buckets
     * - Month/Custom: Daily buckets
     * - All Time: 6 monthly buckets (trailing)
     */
    function getTrendData(items, dateField = 'created_at') {
        const year = filterStore.year;
        const quarter = filterStore.quarter;
        const range = filterStore.dateRange;
        
        let start, end, buckets = [], mode = 'monthly';

        // 1. Determine period and granularity
        if (quarter && year) {
            // Quarter: 3 months
            const qInt = parseInt(quarter);
            start = new Date(parseInt(year), (qInt - 1) * 3, 1);
            end = new Date(parseInt(year), qInt * 3, 0);
            mode = 'monthly';
        } else if (year) {
            // Year: 12 months (Jan-Dec)
            start = new Date(parseInt(year), 0, 1);
            end = new Date(parseInt(year), 11, 31);
            mode = 'monthly';
        } else if (range[0] && range[1]) {
            const s = new Date(range[0]);
            const e = new Date(range[1]);
            const diffDays = Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 31) {
                // Short range (e.g. Month): Daily buckets
                start = s;
                end = e;
                mode = 'daily';
            } else {
                // Longer custom range: Monthly buckets
                start = s;
                end = e;
                mode = 'monthly';
            }
        } else {
            // All Time / No range: Show last 6 months trailing
            const now = new Date();
            start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
            end = now;
            mode = 'monthly';
        }

        // 2. Build Buckets
        if (mode === 'monthly') {
            let current = new Date(start.getFullYear(), start.getMonth(), 1);
            while (current <= end) {
                buckets.push({
                    year: current.getFullYear(),
                    month: current.getMonth(),
                    count: 0,
                    label: MONTH_NAMES[current.getMonth()] + ' ' + current.getFullYear()
                });
                current.setMonth(current.getMonth() + 1);
                // Safety break for infinite loops
                if (buckets.length > 60) break; 
            }
        } else {
            let current = new Date(start);
            current.setHours(0,0,0,0);
            const stop = new Date(end);
            stop.setHours(23,59,59,999);
            
            while (current <= stop) {
                buckets.push({
                    year: current.getFullYear(),
                    month: current.getMonth(),
                    day: current.getDate(),
                    count: 0,
                    label: current.getDate() + ' ' + MONTH_NAMES[current.getMonth()]
                });
                current.setDate(current.getDate() + 1);
                if (buckets.length > 40) break;
            }
        }

        // 3. Count items into buckets
        function getField(obj, path) {
            return path.split('.').reduce((o, k) => o && o[k], obj);
        }
        
        items.forEach(item => {
            const raw = getField(item, dateField) || item['created_at'] || item['updated_at'];
            if (!raw || typeof raw !== 'string') return;
            const d = new Date(raw);
            if (isNaN(d.getTime())) return;
            
            const bucket = buckets.find(b => {
                if (mode === 'monthly') {
                    return b.year === d.getFullYear() && b.month === d.getMonth();
                } else {
                    return b.year === d.getFullYear() && b.month === d.getMonth() && b.day === d.getDate();
                }
            });
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
        
        // Initialize Dashboard Filter Config
        filterStore.loadFromStorage();
        initDateFromStore(); // Sync datepicker with stored filter
        
        try {
            // Start fetching all data in parallel
            const corePromises = [
                stakeholdersStore.initialize(),
                ikasStore.initialize(),
                csirtStore.initialize(),
                (async () => {
                    const sektors = sektorList.value.length > 0 ? sektorList.value : await sektorService.getAll();
                    const subSektors = subSektorList.value.length > 0 ? subSektorList.value : await subSektorService.getAll();
                    sektorList.value = sektors;
                    subSektorList.value = subSektors;
                })(),
            ];

            // Start summary data fetch but don't let it block the main layout if it's slow
            const summaryPromise = filterStore.fetchDashboardData();

            // Wait for core data to show the main dashboard structure
            await Promise.all(corePromises);
            
            // Set loading false immediately when core data is ready
            loading.value = false;
            triggerAlertVisibility();

            // Wait for summary data in the background (UI handles its own loading state)
            await summaryPromise;
            
            // Mark initial load as complete after staggered animations would have finished
            setTimeout(() => {
                isFirstLoad.value = false;
            }, 4000);

        } catch (e) {
            console.error("Dashboard data load error:", e);
            loading.value = false; // Ensure we stop loading even on error
        } finally {
            // Handle reopen modal from query param
            if (route.query.reopen) {
                const typeToOpen = String(route.query.reopen).replace('Detail: ', '');
                nextTick(() => {
                    handleDrillDown({ type: typeToOpen });
                    setTimeout(() => {
                        const newQuery = { ...route.query };
                        delete newQuery.reopen;
                        delete newQuery.from;
                        router.replace({ query: newQuery });
                    }, 500);
                });
            }
        }
    });

    // ─── Color Palette ──────────────────────────────────────
    function getColor(colorName) {
        const colors = {
            primary: '#0d47a1', secondary: '#ff9800', warning: '#fdaf22',
            info: '#00c9ff', success: '#32d484', danger: '#ff6757',
            slate: '#64748b', teal: '#14b8a6', blue: '#3b82f6',
            cyan: '#06b6d4', emerald: '#10b981', orange: '#f97316',
        };
        return colors[colorName] || '#0d47a1';
    }

    // ─── Enriched Sektor Data ───────────────────────────────
    const enrichedSektors = computed(() => {
        const range = filterStore.dateRange;
        
        // We NO LONGER filter the list here because we want to show all top 6
        // but highlight the selected one while muting others.
        const sektorsToProcess = sektorList.value;

        return sektorsToProcess.map((sektor) => {
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
                displayName: sektor.nama_sektor ?? sektor.nama ?? String(sektor.id),
                subSektorCount: children.length,
                stakeholderCount,
                stakeholderInRange,
            };
        });
    });

    // ─── Base Filtered Data arrays (Respects Sector) ───
    const baseStakeholders = computed(() => {
        const fId = filterStore.sektorId;
        const subId = filterStore.subSektorId;

        let filtered = stakeholdersStore.allStakeholders;

        // Sector/Sub-sector Filter
        if (fId || subId) {
            filtered = filtered.filter(s => {
                const effectiveSubId = subId === 'ALL' ? '' : subId;
                if (effectiveSubId) return String(s.sub_sektor?.id || s.id_sub_sektor) === String(effectiveSubId);
                if (fId) return String(s.sub_sektor?.id_sektor || s.id_sektor) === String(fId);
                return true;
            });
        }

        return filtered;
    });

    const baseCsirts = computed(() => {
        const fId = filterStore.sektorId;
        const subId = filterStore.subSektorId;
        
        let filtered = csirtStore.csirts;

        // Sector/Sub-sector Filter
        if (fId || subId) {
            filtered = filtered.filter(c => {
                const p = stakeholdersStore.stakeholdersByIdMap[String(c.id_perusahaan)] || c.perusahaan;
                const effectiveSubId = subId === 'ALL' ? '' : subId;
                if (effectiveSubId) return String(p?.sub_sektor?.id || p?.id_sub_sektor) === String(effectiveSubId);
                if (fId) return String(p?.sub_sektor?.id_sektor || p?.id_sektor) === String(fId);
                return true;
            });
        }

        return filtered;
    });

    const baseSdm = computed(() => {
        const fId = filterStore.sektorId;
        const subId = filterStore.subSektorId;
        if (!fId && !subId) return csirtStore.sdmList;
        return csirtStore.sdmList.filter(s => {
            const cId = String(s.id_csirt || s.csirt?.id);
            const csirt = csirtStore.csirtByIdMap[cId];
            if (!csirt) return false;
            
            const p = stakeholdersStore.stakeholdersByIdMap[String(csirt.id_perusahaan)] || csirt.perusahaan;
            const effectiveSubId = subId === 'ALL' ? '' : subId;
            if (effectiveSubId) return String(p?.sub_sektor?.id || p?.id_sub_sektor) === String(effectiveSubId);
            if (fId) return String(p?.sub_sektor?.id_sektor || p?.id_sektor) === String(fId);
            return true;
        });
    });

    const baseSeList = computed(() => {
        const fId = filterStore.sektorId;
        const subId = filterStore.subSektorId;

        let filtered = csirtStore.seList;

        // Sector/Sub-sector Filter
        if (fId || subId) {
            filtered = filtered.filter(se => {
                const cId = String(se.id_csirt || se.csirt_id || se.csirt?.id);
                const csirt = csirtStore.csirtByIdMap[cId];
                
                const pId = csirt?.id_perusahaan || csirt?.perusahaan?.id || se.id_perusahaan;
                const perus = pId ? stakeholdersStore.stakeholdersByIdMap[String(pId)] : null;
                
                if (!perus) return false;
                
                const effectiveSubId = subId === 'ALL' ? '' : subId;
                if (effectiveSubId) return String(perus.sub_sektor?.id || perus.id_sub_sektor) === String(effectiveSubId);
                if (fId) return String(perus.sub_sektor?.id_sektor || perus.id_sektor) === String(fId);
                return true;
            });
        }

        return filtered;
    });

    // --- CSIRT & SE Counts (All time) ───────────────────────
    const totalCsirt = computed(() => {
        // Count ALL stakeholders that have a CSIRT record (both complete and incomplete)
        return baseStakeholders.value.filter(s => !!csirtStore.csirtByPerusahaanMap[String(s.id)]).length;
    });
    const totalSdm = computed(() => baseSdm.value.length);
    const totalSe = computed(() => datedSeList.value.length);
    const totalStakeholders = computed(() => datedStakeholders.value.length);

    // Count stakeholders with complete CSIRT
    const stakeholdersWithCsirt = computed(() => {
        return baseStakeholders.value.filter(s => csirtStore.hasCompleteCsirt(s.id)).length;
    });

    // ─── Base IKAS Stakeholders ──────────────────────────────
    const baseIkasStakeholders = computed(() => {
        return baseStakeholders.value.filter(s => {
            const data = ikasStore.ikasDataMap[s.slug];
            if (!data) return false;
            const val = data.total_rata_rata;
            return val !== null && val !== 0 && val !== 'NA';
        });
    });

    // Count stakeholders with IKAS
    const stakeholdersWithIkas = computed(() => datedIkasStakeholders.value.length);

    // ─── Full Summary Computed Data ─────────────────────────
    const csirtCompletionRate = computed(() => {
        if (!totalStakeholders.value) return 0;
        return Math.round((stakeholdersWithCsirt.value / totalStakeholders.value) * 100);
    });

    const ikasCompletionRate = computed(() => {
        if (!totalStakeholders.value) return 0;
        return Math.round((stakeholdersWithIkas.value / totalStakeholders.value) * 100);
    });

    const totalSektors = computed(() => sektorList.value.length);
    const totalSubSektors = computed(() => subSektorList.value.length);
    // (Re-fetch handling is managed via Pinia debounced actions internally)

    // ─── Active Sub Sektor Summary computed ─────────────────
    const activeSubSektorSummary = computed(() => {
        const subId = filterStore.subSektorId;
        if (!subId || subId === 'ALL') return null;

        // Try to find the specific sub-sektor in the aggregated counts from the API if possible
        // (Though usually apiSektorCounts is at sector level, we keep this for consistency)
        const counts = apiSektorCounts.value || [];
        const target = counts.find(s => String(s.sektor_id || s.id) === String(subId));
        
        // Calculate detailed metrics from the current filtered stakeholder list
        const totalBase = baseStakeholders.value.length;
        
        // KSE Count: Check is_kse flag on stakeholder OR if they have KSE categorization in SE record
        const kseCount = baseStakeholders.value.filter(s => {
            // First check the explicit flag
            if (s.is_kse) return true;
            // Fallback: check if any SE associated with this stakeholder has a category assigned
            const se = csirtStore.seList.find(se => String(se.id_perusahaan) === String(s.id));
            return se && se.kategori_se && se.kategori_se !== 'Belum Dikategorikan';
        }).length;
        
        let csirtCount = 0;
        let ikasCount = 0;
        let lengkapCount = 0;

        baseStakeholders.value.forEach(s => {
            // Check if ANY CSIRT record exists
            const hasCsirtRecord = csirtStore.csirts.some(c => String(c.id_perusahaan) === String(s.id) || String(c.perusahaan?.id) === String(s.id));
            
            const isCsirtComplete = csirtStore.hasCompleteCsirt(s.id);
            
            // Check IKAS status from synced map
            const ikasData = ikasStore.ikasDataMap[s.slug];
            const hasIkas = ikasData && (
                (ikasData.total_rata_rata && ikasData.total_rata_rata !== 'NA' && Number(ikasData.total_rata_rata) !== 0) ||
                ikasStore.backendIkasIds[s.slug]
            );
            
            if (isCsirtComplete) csirtCount++;
            if (hasIkas) ikasCount++;
            
            // Data Lengkap = Has both IKAS and Complete CSIRT
            if (isCsirtComplete && hasIkas) lengkapCount++;
        });

        // Compute percentages for the UI bars (rounded integers to match general summary)
        const getPercent = (count) => {
             if (totalBase === 0) return '0%';
             if (count === 0) return '0%';
             return Math.round((count / totalBase) * 100) + '%';
        };

        const props = {
            csirtCount,
            csirtPercent: getPercent(csirtCount),
            ikasCount,
            ikasPercent: getPercent(ikasCount),
            lengkapCount,
            lengkapPercent: getPercent(lengkapCount)
        };

        if (target) {
            return {
                ...target,
                ...props
            };
        }

        // Return calculated summary if not found in aggregated API counts
        return {
            nama_sektor: subSektorList.value.find(s => String(s.id) === String(subId))?.nama_sub_sektor || 'Detail Stakeholder',
            total: totalBase,
            countYear: baseStakeholders.value.filter(s => isInDateRange(s.created_at, [new Date(new Date().getFullYear(), 0, 1).toISOString(), new Date().toISOString()])).length,
            countQuarter: 0,
            this_month: baseStakeholders.value.filter(s => {
                const d = new Date(s.created_at);
                const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length,
            ...props
        };
    });

    // ─── Date-filtered counts ───────────────────────────────
    const datedStakeholders = computed(() => {
        const range = filterStore.dateRange;
        if (!range || (!range[0] && !range[1])) return baseStakeholders.value;
        return baseStakeholders.value.filter(s => isInDateRange(s.created_at, range));
    });
    const datedCsirts = computed(() => {
        const range = filterStore.dateRange;
        const completeCsirts = baseStakeholders.value.filter(s => csirtStore.hasCompleteCsirt(s.id));
        if (!range || (!range[0] && !range[1])) return completeCsirts;
        return completeCsirts.filter(s => {
            const csirt = csirtStore.csirts.find(c => String(c.id_perusahaan) === String(s.id) || String(c.perusahaan?.id) === String(s.id));
            return isInDateRange(csirt?.perusahaan?.created_at || s.created_at, range);
        });
    });
    const datedSdm = computed(() => {
        const range = filterStore.dateRange;
        if (!range || (!range[0] && !range[1])) return baseSdm.value;
        return baseSdm.value.filter(s => isInDateRange(s.created_at, range));
    });
    const datedIkasStakeholders = computed(() => {
        const range = filterStore.dateRange;
        if (!range || (!range[0] && !range[1])) return baseIkasStakeholders.value;
        return baseIkasStakeholders.value.filter(s => isInDateRange(s.updated_at || s.created_at, range));
    });
    const datedSeList = computed(() => {
        const range = filterStore.dateRange;
        if (!range || (!range[0] && !range[1])) return baseSeList.value;
        return baseSeList.value.filter(se => {
            const seDate = se['created_at'] || se['updated_at'];
            if (seDate && isInDateRange(seDate, range)) return true;
            const csirt = csirtStore.csirts.find(c => String(c.id) === String(se.id_csirt));
            if (csirt?.perusahaan?.created_at && isInDateRange(csirt.perusahaan.created_at, range)) return true;
            return false;
        });
    });
    
    const filteredStakeholders = computed(() => datedStakeholders.value.length);
    const filteredCsirt = computed(() => datedCsirts.value.length);
    const filteredSdm = computed(() => datedSdm.value.length);
    const filteredIkasCount = computed(() => datedIkasStakeholders.value.length);
    const filteredSe = computed(() => datedSeList.value.length);

    // ─── ROW 1 Cards: Sektor-based data ────────────────────
    const sektorCards = computed(() => {
        const sektorColors = ['primary', 'success', 'warning', 'blue', 'info', 'primary', 'teal', 'slate', 'cyan', 'emerald', 'orange', 'secondary'];
        const sektorIcons = [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M223.45,40.07a8,8,0,0,0-7.52-7.52C139.8,28.08,78.82,51,52.82,94a87.09,87.09,0,0,0-12.76,49A101.72,101.72,0,0,0,46.7,175.2a4,4,0,0,0,6.61,1.43l85-86.3a8,8,0,0,1,11.32,11.32L56.74,195.94,42.55,210.13a8.2,8.2,0,0,0-.6,11.1,8,8,0,0,0,11.71.43l16.79-16.79c14.14,6.84,28.41,10.57,42.56,11.07q1.67.06,3.33.06A86.93,86.93,0,0,0,162,203.18C205,177.18,227.93,116.21,223.45,40.07Z"/></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232,120h-8.34a95.07,95.07,0,0,0-8.82-32.9l7.23-4.17a8,8,0,0,0-8-13.86l-7.25,4.19a97,97,0,0,0-24.08-24.08l4.19-7.25a8,8,0,0,0-13.86-8l-4.17,7.23A95.07,95.07,0,0,0,136,32.34V24a8,8,0,0,0-16,0v8.34a95.07,95.07,0,0,0-32.9,8.82l-4.17-7.23a8,8,0,0,0-13.86,8l4.19,7.25A97,97,0,0,0,49.18,73.26l-7.25-4.19a8,8,0,0,0-8,13.86l7.23,4.17A95.07,95.07,0,0,0,32.34,120H24a8,8,0,0,0,0,16h8.34a95.07,95.07,0,0,0,8.82,32.9l-7.23,4.17a8,8,0,0,0,4,14.93,7.92,7.92,0,0,0,4-1.07l7.25-4.19a97,97,0,0,0,24.08,24.08l-4.19,7.25a8,8,0,0,0,13.86,8l4.17-7.23a95.07,95.07,0,0,0,32.9,8.82V232a8,8,0,0,0,16,0v-8.34a95.07,95.07,0,0,0,32.9-8.82l4.17,7.23a8,8,0,0,0,13.86-8l-4.19-7.25a97,97,0,0,0,24.08-24.08l7.25,4.19A8,8,0,0,0,225,184a8,8,0,0,0-2.92-10.93l-7.23-4.17a95.07,95.07,0,0,0,8.82-32.9H232a8,8,0,0,0,0-16ZM72,128A55.91,55.91,0,0,1,93.38,84l25.38,44L93.38,172A55.91,55.91,0,0,1,72,128Zm56,56a55.67,55.67,0,0,1-20.78-4l25.4-44h50.8A56.09,56.09,0,0,1,128,184Zm4.62-64-25.4-44a56,56,0,0,1,76.2,44Z"/></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M221.69,199.77,160,96.92V40h8a8,8,0,0,0,0-16H88a8,8,0,0,0,0,16h8V96.92L34.31,199.77A16,16,0,0,0,48,224H208a16,16,0,0,0,13.72-24.23Zm-90.08-42.91c-15.91-8.05-31.05-12.32-45.22-12.81l24.47-40.8A7.93,7.93,0,0,0,112,99.14V40h32V99.14a7.93,7.93,0,0,0,1.14,4.11L183.36,167C171.4,169.34,154.29,168.34,131.61,156.86Z"/></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.27,47,25.53a8,8,0,0,0,4.2,0c1-.26,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm-37,87.43-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,1,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43Z"/></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M160,136v-8H88v64a8,8,0,0,0,8,8h64v-8a16,16,0,0,1,16-16h32a16,16,0,0,1,16,16v32a16,16,0,0,1-16,16H176a16,16,0,0,1-16-16v-8H96a24,24,0,0,1-24-24V80H64A16,16,0,0,1,48,64V32A16,16,0,0,1,64,16H96a16,16,0,0,1,16,16V64A16,16,0,0,1,96,80H88v32h72v-8a16,16,0,0,1,16-16h32a16,16,0,0,1,16,16v32a16,16,0,0,1-16,16H176A16,16,0,0,1,160,136Z"/></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm-72,78.63V184a8,8,0,0,1-16,0V158.63a24,24,0,1,1,16,0ZM160,80H96V56a32,32,0,0,1,64,0Z"/></svg>',
        ];

        const activeSektorId = filterStore.sektorId;
        const activeSubSektorId = filterStore.subSektorId;
        const range = filterStore.dateRange;

        // ── MODE 1: Sub Sektor (ALL or specific) ──
        if (activeSektorId && activeSubSektorId && activeSubSektorId !== '') {
            // Find all sub-sektors belonging to this sektor
            let targetSubSektors = subSektorList.value.filter(ss => {
                const pid = getSubSektorParentId(ss);
                return pid !== undefined && String(pid) === String(activeSektorId);
            });

            return targetSubSektors.map((ss, idx) => {
                const color = sektorColors[idx % sektorColors.length];
                const ssName = getSubSektorName(ss);

                // Count stakeholders for this sub-sektor
                const ssStakeholders = stakeholdersStore.allStakeholders.filter(s => {
                    const subSektorId = s.sub_sektor?.id || s.id_sub_sektor;
                    return subSektorId && String(subSektorId) === String(ss.id);
                });
                const stakeholderCount = ssStakeholders.length;
                const stakeholderInRange = ssStakeholders.filter(s =>
                    isInDateRange(s.created_at, range)
                ).length;

                const trend = getTrendData(ssStakeholders);

                let isActive = false;
                let isMuted = false;
                
                if (activeSubSektorId !== 'ALL') {
                    isActive = String(ss.id) === String(activeSubSektorId);
                    isMuted = !isActive;
                }

                return {
                    title: ssName,
                    sektorId: ss.id,
                    isSubSektor: true,
                    isMuted: isMuted,
                    avatarClass: "avatar-md flex-shrink-0",
                    ValueClass: "fw-semibold lh-sm",
                    smallText: "fs-12 lh-base",
                    ValueClass1: "fs-12 lh-base",
                    count: String(stakeholderCount),
                    percent: String(stakeholderInRange),
                    monthLabel: dateRangeLabel.value,
                    iconColor: "success fw-medium",
                    cardClass: `dashboard-main-card overflow-hidden ${color} ${isActive ? 'sektor-card-active' : ''} ${isMuted ? 'sektor-card-muted' : ''}`,
                    priceColor: color,
                    svgIcon: sektorIcons[idx % sektorIcons.length],
                    id: `chart-subsektor-${idx}`,
                    type: 'area',
                    height: '50',
                    width: '100',
                    chartSeries: [{ name: ssName, data: trend.data }],
                    chartOptions: buildSparkOptions(color, trend.labels)
                };
            }).sort((a, b) => Number(b.count) - Number(a.count));
        }

        // ── MODE 2 & 3: Tampilkan sektor (Default or no filter) ──
        const sorted = [...enrichedSektors.value]
            .sort((a, b) => b.stakeholderCount - a.stakeholderCount);

        let topSektors = sorted.slice(0, 6);
        
        if (activeSektorId) {
            const hasActive = topSektors.some(s => String(s.id) === String(activeSektorId));
            if (!hasActive) {
                const activeSektor = sorted.find(s => String(s.id) === String(activeSektorId));
                if (activeSektor) {
                    topSektors.pop();
                    topSektors.push(activeSektor);
                }
            }
        }

        return topSektors.map((sektor, idx) => {
            const color = sektorColors[idx % sektorColors.length];

            const trend = getTrendData(
                stakeholdersStore.allStakeholders.filter(s => {
                    const sid = s.sub_sektor?.id || s.id_sub_sektor;
                    return sid && new Set(subSektorList.value.filter(ss => {
                        const pid = getSubSektorParentId(ss);
                        return pid !== undefined && String(pid) === String(sektor.id);
                    }).map(c => String(c.id))).has(String(sid));
                })
            );

            let isActive = false;
            let isMuted = false;
            
            if (activeSektorId) {
                isActive = String(sektor.id) === String(activeSektorId);
                isMuted = !isActive;
            }

            return {
                title: sektor.displayName,
                sektorId: sektor.id,
                isMuted: isMuted,
                avatarClass: "avatar-md flex-shrink-0",
                ValueClass: "fw-semibold lh-sm",
                smallText: "fs-12 lh-base",
                ValueClass1: "fs-12 lh-base",
                count: String(sektor.stakeholderCount),
                percent: String(sektor.stakeholderInRange),
                monthLabel: dateRangeLabel.value,
                iconColor: color + " fw-medium",
                cardClass: `dashboard-main-card overflow-hidden ${color} ${isActive ? 'sektor-card-active' : ''} ${isMuted ? 'sektor-card-muted' : ''}`,
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
        const csirtTrend = getTrendData(baseCsirts.value, 'perusahaan.created_at');
        const ikasTrend = getTrendData(baseIkasStakeholders.value, 'updated_at');
        const seTrend = getTrendData(baseSeList.value);
        const stakeholderTrend = getTrendData(baseStakeholders.value);

        return [
            {
                title: "Total CSIRT",
                count: String(filteredCsirt.value),
                percent: String(filteredCsirt.value),
                monthLabel: dateRangeLabel.value,
                priceColor: "danger",
                iconColor: "danger fw-medium",
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
                title: "Total IKAS",
                count: String(filteredIkasCount.value),
                percent: String(filteredIkasCount.value),
                monthLabel: dateRangeLabel.value,
                priceColor: "info",
                iconColor: "info fw-medium",
                cardClass: "dashboard-main-card overflow-hidden info",
                avatarClass: "avatar-md flex-shrink-0",
                ValueClass: "fw-semibold lh-sm",
                smallText: "fs-12 lh-base",
                ValueClass1: "fs-12 lh-base",
                svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M224,200h-16V64a8,8,0,0,0-8-8H152a8,8,0,0,0-8,8v136H96v-80a8,8,0,0,0-8-8H40a8,8,0,0,0-8,8v80H16a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16ZM160,72h32v128H160ZM48,128H80v72H48Z"/></svg>',
                id: 'chart-ikas',
                type: 'area',
                height: '50',
                width: '100',
                chartSeries: [{ name: 'IKAS', data: ikasTrend.data }],
                chartOptions: buildSparkOptions('info', ikasTrend.labels)
            },
            {
                title: "Sistem Elektronik",
                count: String(filteredSe.value),
                percent: String(filteredSe.value),
                monthLabel: dateRangeLabel.value,
                priceColor: "success",
                iconColor: "success fw-medium",
                cardClass: "dashboard-main-card overflow-hidden success",
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
                chartOptions: buildSparkOptions('success', seTrend.labels)
            },
            {
                title: "Stakeholders",
                count: String(filteredStakeholders.value),
                percent: String(filteredStakeholders.value),
                monthLabel: dateRangeLabel.value,
                priceColor: "secondary",
                iconColor: "secondary fw-medium",
                cardClass: "dashboard-main-card overflow-hidden secondary",
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
                chartOptions: buildSparkOptions('secondary', stakeholderTrend.labels)
            },
        ];
    });

    // ─── Helper: Get Stakeholder Sektor Name ──────────────────
    function getStakeholderSektorName(s) {
        if (!s) return '-';
        // Try nested sub_sektor with multiple paths
        if (s.sub_sektor?.nama_sektor) return s.sub_sektor.nama_sektor;
        if (s.sub_sektor?.sektor?.nama_sektor) return s.sub_sektor.sektor.nama_sektor;
        
        // Fallback: resolve from id_sub_sektor if object is missing
        const subId = s.id_sub_sektor || (s.sub_sektor && s.sub_sektor.id);
        if (subId) {
            const ss = subSektorList.value.find(item => String(item.id) === String(subId));
            if (ss) {
                const sId = getSubSektorParentId(ss);
                const parent = sektorList.value.find(p => String(p.id) === String(sId));
                if (parent) return getSektorName(parent);
            }
        }

        // Try legacy flat field
        if (s.sektor) return s.sektor;
        return '-';
    }

    // ─── Helper: Get Stakeholder Sub-Sektor Name ───────────────
    function getStakeholderSubSektorName(s) {
        if (!s) return '-';
        // Try nested sub_sektor
        if (s.sub_sektor?.nama_sub_sektor) return s.sub_sektor.nama_sub_sektor;
        
        // Fallback: resolve from id_sub_sektor if object is missing
        const subId = s.id_sub_sektor || (s.sub_sektor && s.sub_sektor.id);
        if (subId) {
            const ss = subSektorList.value.find(item => String(item.id) === String(subId));
            if (ss) return getSubSektorName(ss);
        }

        // Fallback to nama_sektor if available
        if (s.sub_sektor?.nama_sektor) return s.sub_sektor.nama_sektor;
        return '-';
    }

    // ─── Helper: Get CSIRT Sektor Name ─────────────────────────
    function getCsirtSektorName(c) {
        if (!c) return '-';
        // Try nested paths
        if (c.perusahaan?.sub_sektor?.nama_sektor) return c.perusahaan.sub_sektor.nama_sektor;
        if (c.perusahaan?.sub_sektor?.sektor?.nama_sektor) return c.perusahaan.sub_sektor.sektor.nama_sektor;
        
        // Fallback to perusahaan resolution
        if (c.perusahaan) return getStakeholderSektorName(c.perusahaan);
        
        if (c.perusahaan?.sektor) return c.perusahaan.sektor;
        return '-';
    }

    // ─── Helper: Get CSIRT Sub-Sektor Name ─────────────────────
    function getCsirtSubSektorName(c) {
        if (!c) return '-';
        // Try nested paths
        if (c.perusahaan?.sub_sektor?.nama_sub_sektor) return c.perusahaan.sub_sektor.nama_sub_sektor;
        
        // Fallback to perusahaan resolution
        if (c.perusahaan) return getStakeholderSubSektorName(c.perusahaan);

        if (c.perusahaan?.sub_sektor?.nama_sektor) return c.perusahaan.sub_sektor.nama_sektor;
        return '-';
    }

    // ─── Drill-Down Handler ─────────────────────────────────
    function handleDrillDown(context) {
        const range = filterStore.dateRange;
        // Gunakan baseStakeholders yang sudah difilter Sektor & Sub Sektor
        let all = baseStakeholders.value;
        
        // Terapkan date range filter
        if (range && (range[0] || range[1])) {
             all = all.filter(s => isInDateRange(s.created_at, range));
        }

        drillDownTitle.value = `Detail: ${context.type || 'Data'}`;
        drillDownColumns.value = ['nama_perusahaan', 'sektor', 'created_at'];

        if (context.type === 'stakeholders' || context.type === 'Stakeholders') {
            drillDownColumns.value = ['nama_perusahaan', 'sektor', 'sub_sektor', 'csirt_status', 'ikas_score', 'created_at'];
            drillDownItems.value = all.map(s => {
                const hasCsirt = csirtStore.hasCompleteCsirt(s.id);
                const ikasData = ikasStore.ikasDataMap[s.slug];
                const hasIkas = ikasData && ikasData.total_rata_rata && ikasData.total_rata_rata !== 'NA' && ikasData.total_rata_rata !== 0;
                return {
                    nama_perusahaan: s.nama_perusahaan || s.nama || '-',
                    sektor: getStakeholderSektorName(s),
                    sub_sektor: getStakeholderSubSektorName(s),
                    csirt_status: hasCsirt ? 'Terdaftar' : 'Belum Terdaftar',
                    ikas_score: hasIkas ? Number(ikasData.total_rata_rata).toFixed(2) : '-',
                    created_at: s.created_at ? new Date(s.created_at).toLocaleDateString('id-ID') : '-',
                    slug: s.slug,
                };
            });
        } else if (context.type === 'csirt' || context.type === 'Total CSIRT') {
            drillDownColumns.value = ['nama_perusahaan', 'sektor', 'sub_sektor', 'csirt_nama', 'csirt_status', 'created_at'];
            drillDownItems.value = baseCsirts.value.map(c => {
                const stakeholder = stakeholdersStore.allStakeholders.find(s => 
                    String(s.id) === String(c.id_perusahaan || c.perusahaan?.id)
                );
                return {
                    nama_perusahaan: stakeholder?.nama_perusahaan || c.perusahaan?.nama_perusahaan || c.nama_csirt || '-',
                    sektor: stakeholder ? getStakeholderSektorName(stakeholder) : getCsirtSektorName(c),
                    sub_sektor: stakeholder ? getStakeholderSubSektorName(stakeholder) : getCsirtSubSektorName(c),
                    csirt_nama: c.nama_csirt || '-',
                    csirt_status: csirtStore.hasCompleteCsirt(c.id_perusahaan || c.perusahaan?.id) ? 'Lengkap' : 'Belum Lengkap',
                    created_at: c.perusahaan?.created_at ? new Date(c.perusahaan.created_at).toLocaleDateString('id-ID') : '-',
                    slug: stakeholder?.slug || c.perusahaan?.slug || c.id,
                };
            });
        } else if (context.type === 'Sistem Elektronik' || context.type.includes('SE') || context.type.includes('Total SE')) {
            // Show filtered Sistem Elektronik records
            drillDownColumns.value = ['nama_perusahaan', 'sektor', 'sub_sektor', 'nama_se', 'kategori_se'];
            
            let seList = baseSeList.value;
            const type = context.type.toLowerCase();

            // 1. Filter by category if card is specific
            if (type.includes('strategis')) seList = seList.filter(se => (se.kategori_se || '').toLowerCase().trim() === 'strategis');
            else if (type.includes('tinggi')) seList = seList.filter(se => (se.kategori_se || '').toLowerCase().trim() === 'tinggi');
            else if (type.includes('rendah')) seList = seList.filter(se => (se.kategori_se || '').toLowerCase().trim() === 'rendah');
            
            // 2. Filter by date if card is period-specific or if global date filter is active
            // All cards in fullSummaryItems (including Total SE (KSE)) should respect the current global period.
            if (range && (range[0] || range[1])) {
                seList = seList.filter(se => {
                    const seDate = se['created_at'] || se['updated_at'];
                    if (seDate && isInDateRange(seDate, range)) return true;
                    // Fallback to company created_at if SE date is missing
                    const csirt = csirtStore.csirts.find(c => String(c.id) === String(se.id_csirt));
                    if (csirt?.perusahaan?.created_at && isInDateRange(csirt.perusahaan.created_at, range)) return true;
                    return false;
                });
            }

            drillDownItems.value = seList.map(se => {
                const csirt = csirtStore.csirts.find(c => String(c.id) === String(se.id_csirt));
                const stakeholder = stakeholdersStore.allStakeholders.find(s => 
                    String(s.id) === String(se.id_perusahaan || csirt?.id_perusahaan || csirt?.perusahaan?.id)
                );
                
                // If we have id_sub_sektor on the SE record, we can use it to resolve names
                let seSektor = '-';
                let seSubSektor = '-';
                const subId = se.id_sub_sektor || stakeholder?.id_sub_sektor || stakeholder?.sub_sektor?.id;
                
                if (subId) {
                    const ss = subSektorList.value.find(item => String(item.id) === String(subId));
                    if (ss) {
                        seSubSektor = getSubSektorName(ss);
                        const sId = getSubSektorParentId(ss);
                        const parent = sektorList.value.find(p => String(p.id) === String(sId));
                        if (parent) seSektor = getSektorName(parent);
                    }
                }

                return {
                    nama_perusahaan: stakeholder?.nama_perusahaan || stakeholder?.nama || se.perusahaan?.nama_perusahaan || csirt?.perusahaan?.nama_perusahaan || '-',
                    sektor: seSektor !== '-' ? seSektor : (stakeholder ? getStakeholderSektorName(stakeholder) : (csirt ? getCsirtSektorName(csirt) : '-')),
                    sub_sektor: seSubSektor !== '-' ? seSubSektor : (stakeholder ? getStakeholderSubSektorName(stakeholder) : (csirt ? getCsirtSubSektorName(csirt) : '-')),
                    nama_se: se.nama_se || se.nama || '-',
                    kategori_se: se.kategori_se || '-',
                    slug: stakeholder?.slug || se.perusahaan?.slug || csirt?.perusahaan?.slug,
                };
            });
        } else if (context.type === 'Total IKAS' || context.type.includes('Level')) {
            // Show stakeholders filtered by maturity level if applicable
            drillDownColumns.value = ['nama_perusahaan', 'sektor', 'sub_sektor', 'ikas_score', 'ikas_kategori'];
            
            let filteredSt = all.filter(s => {
                const data = ikasStore.ikasDataMap[s.slug];
                return data && data.total_rata_rata && data.total_rata_rata !== 'NA' && data.total_rata_rata !== 0;
            });

            // Filter by level if specified in type
            if (context.type.includes('Level')) {
                const levelPrefix = context.type.split(' - ')[0]; // 'Level 1'
                filteredSt = filteredSt.filter(s => {
                    const data = ikasStore.ikasDataMap[s.slug];
                    return data.total_kategori.startsWith(levelPrefix);
                });
            }

            drillDownItems.value = filteredSt.map(s => {
                const ikasData = ikasStore.ikasDataMap[s.slug];
                return {
                    nama_perusahaan: s.nama_perusahaan || s.nama || '-',
                    sektor: getStakeholderSektorName(s),
                    sub_sektor: getStakeholderSubSektorName(s),
                    ikas_score: ikasData?.total_rata_rata ? Number(ikasData.total_rata_rata).toFixed(2) : '-',
                    ikas_kategori: ikasData?.total_kategori || '-',
                    slug: s.slug,
                };
            });
        } else if (context.type === 'Cakupan CSIRT') {
            // Filter only stakeholders with complete CSIRT
            drillDownColumns.value = ['nama_perusahaan', 'sektor', 'sub_sektor', 'csirt_nama', 'csirt_status'];
            drillDownItems.value = all.filter(s => csirtStore.hasCompleteCsirt(s.id))
                .map(s => {
                    const csirtData = csirtStore.csirts.find(c =>
                        String(c.id_perusahaan) === String(s.id) || String(c.perusahaan?.id) === String(s.id)
                    );
                    return {
                        nama_perusahaan: s.nama_perusahaan || s.nama || '-',
                        sektor: getStakeholderSektorName(s),
                        sub_sektor: getStakeholderSubSektorName(s),
                        csirt_nama: csirtData?.nama_csirt || '-',
                        csirt_status: csirtData ? 'Terdaftar' : 'Belum Terdaftar',
                        slug: s.slug,
                    };
                });
        } else if (context.type === 'Cakupan IKAS') {
            // Filter only stakeholders with IKAS data
            drillDownColumns.value = ['nama_perusahaan', 'sektor', 'sub_sektor', 'ikas_score', 'ikas_kategori'];
            drillDownItems.value = all.filter(s => {
                const data = ikasStore.ikasDataMap[s.slug];
                return data && data.total_rata_rata && data.total_rata_rata !== 'NA' && data.total_rata_rata !== 0;
            }).map(s => {
                const ikasData = ikasStore.ikasDataMap[s.slug];
                return {
                    nama_perusahaan: s.nama_perusahaan || s.nama || '-',
                    sektor: getStakeholderSektorName(s),
                    sub_sektor: getStakeholderSubSektorName(s),
                    ikas_score: ikasData?.total_rata_rata ? Number(ikasData.total_rata_rata).toFixed(2) : '-',
                    ikas_kategori: ikasData?.total_kategori || '-',
                    slug: s.slug,
                };
            });
        } else if (context.type === 'Skor IKAS Rata-rata') {
            // Show all stakeholders with their individual IKAS maturity score
            drillDownColumns.value = ['nama_perusahaan', 'sektor', 'sub_sektor', 'ikas_score', 'ikas_maturity'];
            drillDownItems.value = all.filter(s => {
                const data = ikasStore.ikasDataMap[s.slug];
                return data && data.total_rata_rata && data.total_rata_rata !== 'NA' && data.total_rata_rata !== 0;
            }).map(s => {
                const ikasData = ikasStore.ikasDataMap[s.slug];
                return {
                    nama_perusahaan: s.nama_perusahaan || s.nama || '-',
                    sektor: getStakeholderSektorName(s),
                    sub_sektor: getStakeholderSubSektorName(s),
                    ikas_score: ikasData?.total_rata_rata ? Number(ikasData.total_rata_rata).toFixed(2) : '-',
                    ikas_maturity: ikasData?.total_kategori || '-',
                    slug: s.slug,
                };
            });
        } else if (context.type === 'Data Lengkap') {
            // Show stakeholders with both CSIRT and IKAS completed
            drillDownColumns.value = ['nama_perusahaan', 'sektor', 'sub_sektor', 'csirt_status', 'ikas_score'];
            drillDownItems.value = all.filter(s => {
                // Must have complete CSIRT
                const hasCsirt = csirtStore.hasCompleteCsirt(s.id);
                // Must have IKAS data
                const ikasData = ikasStore.ikasDataMap[s.slug];
                const hasIkas = ikasData && ikasData.total_rata_rata && ikasData.total_rata_rata !== 'NA' && ikasData.total_rata_rata !== 0;
                return hasCsirt && hasIkas;
            }).map(s => {
                const csirtData = csirtStore.csirts.find(c =>
                    String(c.id_perusahaan) === String(s.id) || String(c.perusahaan?.id) === String(s.id)
                );
                const ikasData = ikasStore.ikasDataMap[s.slug];
                return {
                    nama_perusahaan: s.nama_perusahaan || s.nama || '-',
                    sektor: getStakeholderSektorName(s),
                    sub_sektor: getStakeholderSubSektorName(s),
                    csirt_status: csirtData ? 'Lengkap' : 'Belum Lengkap',
                    ikas_score: ikasData?.total_rata_rata ? Number(ikasData.total_rata_rata).toFixed(2) : '-',
                    slug: s.slug,
                };
            });
        } else if (context.type === 'Growth Rate') {
            // Show stakeholders added in the last 30 days (current month & last month for comparison)
            drillDownColumns.value = ['nama_perusahaan', 'sektor', 'sub_sektor', 'created_at', 'periode'];
            const now = new Date();
            const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            
            drillDownItems.value = all.map(s => {
                const createdDate = new Date(s.created_at || '');
                let periode = 'Older';
                if (createdDate >= thisMonth) {
                    periode = 'Bulan Ini';
                } else if (createdDate >= lastMonthStart && createdDate < thisMonth) {
                    periode = 'Bulan Lalu';
                }
                return {
                    nama_perusahaan: s.nama_perusahaan || s.nama || '-',
                    sektor: getStakeholderSektorName(s),
                    sub_sektor: getStakeholderSubSektorName(s),
                    created_at: s.created_at ? new Date(s.created_at).toLocaleDateString('id-ID') : '-',
                    periode: periode,
                    slug: s.slug,
                };
            }).filter(item => item.periode !== 'Older'); // Only show this month and last month
        } else if (context.type === 'Update Terakhir') {
            // Pre-calculate mappings to map any event to a stakeholder ID
            const csirtToSt = new Map();
            csirtStore.csirts.forEach(c => {
                csirtToSt.set(String(c.id), String(c.id_perusahaan || c.perusahaan?.id));
            });
            const sdmToSt = new Map();
            csirtStore.sdmList.forEach(s => {
                const csirtId = String(s.id_csirt || s.csirt?.id);
                if (csirtToSt.has(csirtId)) sdmToSt.set(String(s.id), csirtToSt.get(csirtId));
            });
            const seToSt = new Map();
            csirtStore.seList.forEach(s => {
                const csirtId = String(s.id_csirt || s.csirt?.id);
                if (csirtToSt.has(csirtId)) seToSt.set(String(s.id), csirtToSt.get(csirtId));
            });
            
            // Map IKAS by slug and ID
            const ikasToSt = new Map();
            for (const [slug, id] of Object.entries(ikasStore.backendIkasIds)) {
                if (id) {
                    const st = all.find(stakeholder => stakeholder.slug === slug);
                    if (st) {
                        ikasToSt.set(String(id), String(st.id));
                        ikasToSt.set(slug, String(st.id));
                    }
                }
            }
            // Ensure all stakeholder slugs are mapped just in case
            all.forEach(s => {
                if (s.slug) ikasToSt.set(s.slug, String(s.id));
                ikasToSt.set(String(s.id), String(s.id));
            });

            // Find the latest timestamp and action for each stakeholder
            const stLatestUpdate = new Map(); // st_id -> timestamp string
            const stLatestAction = new Map(); // st_id -> label
            
            // Events are already sorted descending
            for (const event of notifStore.events) {
                let stId = null;
                const eId = String(event.entity_id);
                
                if (event.entity === 'stakeholder') stId = ikasToSt.get(eId) || eId;
                else if (event.entity === 'csirt') stId = csirtToSt.get(eId);
                else if (event.entity === 'sdm_csirt') stId = sdmToSt.get(eId);
                else if (event.entity === 'se_csirt') stId = seToSt.get(eId);
                else if (event.entity === 'ikas' || event.entity === 'unknown') stId = ikasToSt.get(eId) || eId;

                // Fallback attempt: if entity_id matches a stakeholder ID directly
                if (!stId && all.some(s => String(s.id) === eId)) {
                    stId = eId;
                }

                if (stId && !stLatestUpdate.has(stId)) {
                    stLatestUpdate.set(stId, event.timestamp);
                    const verbMap = { 'created': 'menambahkan', 'updated': 'memperbarui', 'deleted': 'menghapus' };
                    const entityMap = { 'stakeholder': 'Stakeholder', 'csirt': 'CSIRT', 'sdm_csirt': 'SDM CSIRT', 'se_csirt': 'Sistem Elektronik', 'ikas': 'IKAS', 'user': 'Pengguna' };
                    const userName = event.user?.name || 'Sistem';
                    stLatestAction.set(stId, `${userName} ${verbMap[event.type] || 'Update'} Data ${entityMap[event.entity] || event.entity}`);
                }
            }

            // Show all stakeholders sorted by actual last update time across all related entities
            drillDownColumns.value = ['nama_perusahaan', 'sektor', 'sub_sektor', 'updated_at', 'status_data'];
            drillDownItems.value = all.map(s => {
                const sId = String(s.id);
                let lastUpdate = stLatestUpdate.get(sId);
                let actionLabel = stLatestAction.get(sId);
                
                // Fallback to their updated_at if no events were found
                if (!lastUpdate) {
                    lastUpdate = s.updated_at || s.created_at;
                    actionLabel = 'Data Stakeholder';
                }

                let d = new Date(lastUpdate);
                if (isNaN(d.getTime()) && typeof lastUpdate === 'string') {
                    let cleanStr = lastUpdate.replace(' ', 'T');
                    if (!cleanStr.includes('Z') && !cleanStr.includes('+')) cleanStr += 'Z';
                    d = new Date(cleanStr);
                }
                
                const validTime = !isNaN(d.getTime());

                return {
                    nama_perusahaan: s.nama_perusahaan || s.nama || '-',
                    sektor: getStakeholderSektorName(s),
                    sub_sektor: getStakeholderSubSektorName(s),
                    updated_at: validTime ? d.toLocaleString('id-ID', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '-',
                    _rawTimestamp: validTime ? d.getTime() : 0,
                    status_data: actionLabel,
                    slug: s.slug,
                };
            }).sort((a, b) => b._rawTimestamp - a._rawTimestamp);

        } else {
            drillDownColumns.value = ['nama_perusahaan', 'sektor', 'sub_sektor', 'created_at'];
            drillDownItems.value = all.slice(0, 50).map(s => ({
                nama_perusahaan: s.nama_perusahaan || s.nama || '-',
                sektor: getStakeholderSektorName(s),
                sub_sektor: getStakeholderSubSektorName(s),
                created_at: s.created_at ? new Date(s.created_at).toLocaleDateString('id-ID') : '-',
                slug: s.slug,
            }));
        }

        drillDownVisible.value = true;
    }

    function handleSektorCardClick(card) {
        if (!card.sektorId) return;
        const all = stakeholdersStore.allStakeholders;
        let sektorStakeholders;

        if (card.isSubSektor) {
            // Sub-sektor card: filter by sub-sektor ID directly
            sektorStakeholders = all.filter(s => {
                const subSektorId = s.sub_sektor?.id || s.id_sub_sektor;
                return subSektorId && String(subSektorId) === String(card.sektorId);
            });
        } else {
            // Sektor card: find all sub-sektors belonging to this sektor
            const subSektors = subSektorList.value;
            const children = subSektors.filter(ss => {
                const pid = getSubSektorParentId(ss);
                return pid !== undefined && String(pid) === String(card.sektorId);
            });
            const childIds = new Set(children.map(c => String(c.id)));
            
            sektorStakeholders = all.filter(s => {
                const subSektorId = s.sub_sektor?.id || s.id_sub_sektor;
                return subSektorId && childIds.has(String(subSektorId));
            });
        }

        drillDownTitle.value = `Detail: ${card.title}`;
        drillDownColumns.value = ['nama_perusahaan', 'sektor', 'sub_sektor', 'created_at'];

        // Limit to 1000 items as requested
        drillDownItems.value = sektorStakeholders.slice(0, 1000).map(s => ({
            nama_perusahaan: s.nama_perusahaan || s.nama || '-',
            sektor: getStakeholderSektorName(s),
            sub_sektor: getStakeholderSubSektorName(s),
            created_at: s.created_at ? new Date(s.created_at).toLocaleDateString('id-ID') : '-',
            slug: s.slug,
        }));

        drillDownVisible.value = true;
    }

    function handleDrillDownNavigate(item) {
        drillDownVisible.value = false;
        if (item && item.slug) {
            const title = drillDownTitle.value;
            const searchTitle = title.toLowerCase();
            if (searchTitle.includes('kse') || searchTitle.includes('sistem elektronik') || searchTitle.includes('se ')) {
                router.push({
                    path: '/kse',
                    query: { 
                        slug: item.slug, 
                        from: 'dashboard', 
                        reopen: title 
                    }
                });
            } else if (title.includes('ikas')) {
                router.push(`/ikas?slug=${item.slug}`);
            } else if (title.includes('csirt')) {
                router.push(`/csirt/${item.slug}`);
            } else {
                router.push(`/stakeholders/${item.slug}`);
            }
        } else {
            router.push('/stakeholders');
        }
    }

    // ─── Global Filter Handler ──────────────────────────────
    // This is now purely Pinia-based, no emits needed from GlobalFilter component

    // ─── Quick Action Handlers ──────────────────────────────
    function handleAddStakeholder() {
        router.push('/stakeholders');
    }

    async function handleRefreshData() {
        loading.value = true;
        try {
            await Promise.all([
                stakeholdersStore.refresh(),
                csirtStore.refresh(),
                ikasStore.refresh(),
                filterStore.fetchDashboardData(),
            ]);
        } catch (e) {
            console.error('Refresh failed:', e);
        } finally {
            loading.value = false;
        }
    }

    function handleExportPdf() {
        // Handled by DashboardExport component
    }

    // ─── Sektor Click (from GeoMap) ─────────────────────────
    function handleSektorClick(sektor) {
        handleDrillDown({ type: sektor.name });
    }
    </script>

    <template>
        <!-- HEADER -->
        <div class="d-flex align-items-center justify-content-between mb-3 page-header-breadcrumb flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-20 mb-0">Dashboard</h1>
                <p class="text-muted mb-0" style="font-size:0.78rem;">Command center untuk monitoring stakeholder & CSIRT</p>
            </div>

            <div class="d-flex align-items-center flex-wrap gap-2">
                <!-- Datepicker -->
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

                <!-- Quick Actions -->
                <QuickActions
                    @refresh-data="handleRefreshData"
                />
                <DashboardExport />
                <div>
                    <button v-if="!showMetabase" class="btn btn-primary d-flex align-items-center gap-2 shadow-sm" style="border-radius:10px;" @click="toggleMetabase">
                        <i class="ri-bar-chart-box-line"></i>
                        <span class="d-none d-md-inline">Metabase</span>
                    </button>
                    <button v-if="showMetabase" class="btn btn-primary d-flex align-items-center gap-2 shadow-sm" style="border-radius:10px;" @click="toggleMetabase">
                        <i class="ri-dashboard-3-line"></i>
                        <span class="d-none d-md-inline">Dashboard Utama</span>
                    </button>
                </div>
            </div>
        </div>

        <div v-if="!showMetabase" id="dashboard-capture">
            <!-- ═══ ALERT STATUS BAR ═══ -->
            <AlertIndicators v-if="showAlertIndicators" :summary-error="filterStore.error" />

            <!-- ═══ GLOBAL FILTER (always visible) ═══ -->
            <div class="mb-3">
                <GlobalFilter
                    :sektor-list="sektorList"
                    :sub-sektor-list="subSektorList"
                />
            </div>

            <!-- LOADING SKELETON (10s Lazy Load) -->
            <div v-if="loading" class="row g-3 mb-4">
                <div class="col-md-4" v-for="n in 3" :key="'skel-top-'+n">
                    <div class="card custom-card dashboard-main-card border-0 shadow-sm" style="height: 160px; background: #fff;">
                        <div class="card-body">
                            <div class="placeholder-glow">
                                <div class="d-flex align-items-center gap-2 mb-3">
                                    <span class="placeholder col-2" style="height: 40px; border-radius: 10px;"></span>
                                    <span class="placeholder col-6" style="height: 20px; border-radius: 4px;"></span>
                                </div>
                                <span class="placeholder col-4 mb-2" style="height: 32px; border-radius: 8px;"></span>
                                <div class="d-flex justify-content-between mt-2">
                                    <span class="placeholder col-3" style="height: 14px; border-radius: 4px;"></span>
                                    <span class="placeholder col-5" style="height: 40px; border-radius: 6px;"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-12 mt-4 text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="text-muted mt-2 fs-12 fw-medium">Menyiapkan dashboard...</p>
                </div>
            </div>

            <template v-else>
                <!-- ═══ SEKTOR / SUB SEKTOR CARDS ═══ -->
                <div v-if="filterStore.sektorId" class="d-flex align-items-center gap-2 mb-2 mt-1 animate-show-up" :style="{ animationDelay: isFirstLoad ? '0.1s' : '0s' }">
                    <span class="badge bg-primary-transparent text-primary d-inline-flex align-items-center gap-1" style="font-size: 0.75rem; padding: 5px 12px; border-radius: 8px;">
                        <i class="ri-building-2-line"></i>
                        <span v-if="filterStore.subSektorId">Sub Sektor Terpilih</span>
                        <span v-else>Semua Sub Sektor</span>
                    </span>
                    <span class="text-muted" style="font-size: 0.75rem;">{{ sektorCards.length }} item</span>
                </div>
                <div class="row g-3">
                    <div :class="[
                            sektorCards.length === 1 ? 'col-xl-4 col-md-6' : (sektorCards.length <= 6 ? 'col-xl-4 col-md-6' : 'col-xl-3 col-md-4'),
                            'animate-show-up'
                        ]"
                        v-for="(card, index) in sektorCards"
                        :key="'sektor-' + index"
                        :style="{ animationDelay: isFirstLoad ? `${0.1 + (index * 0.05)}s` : '0s' }"
                        @click="!card.isMuted && handleSektorCardClick(card)">
                        <SpkReusebleJobs
                            titleClass="fs-13 fw-medium mb-0"
                            :listCard="true"
                            :cardClass="`card ${card.cardClass}`"
                            :list="card"
                            :NoCountUp="true"
                        />
                    </div>
                </div>

                <!-- ═══ OPERATIONAL CARDS ═══ -->
                <div class="row g-3 mt-1">
                    <div class="col-xl-3 col-md-6 animate-show-up"
                        v-for="(card, index) in operationalCards"
                        :key="'ops-' + index"
                        :style="{ animationDelay: isFirstLoad ? `${0.4 + (index * 0.1)}s` : '0s' }"
                        @click="handleDrillDown({ type: card.title })">
                        <SpkReusebleJobs
                            titleClass="fs-13 fw-medium mb-0"
                            :listCard="true"
                            :cardClass="`card ${card.cardClass}`"
                            :list="card"
                            :NoCountUp="true"
                        />
                    </div>
                </div>


                <!-- ═══ KPI CARDS (Meaningful KPIs) ═══ -->
                <div class="mb-4 animate-show-up" :style="{ animationDelay: isFirstLoad ? '0.8s' : '0s' }">
                    <KpiCards @drill-down="handleDrillDown" />
                </div>

                <!-- ═══ INSIGHT + ACTIVITY ROW ═══ -->
                <div class="row g-3 mb-4">
                    <div class="col-xl-4 animate-show-up" :style="{ animationDelay: isFirstLoad ? '1.0s' : '0s' }">
                        <InsightCard />
                    </div>
                    <div class="col-xl-4 animate-show-up" :style="{ animationDelay: isFirstLoad ? '1.2s' : '0s' }">
                        <ActionCenter />
                    </div>
                    <div class="col-xl-4 animate-show-up" :style="{ animationDelay: isFirstLoad ? '1.4s' : '0s' }">
                        <ActivityFeed />
                    </div>
                </div>

                <!-- ═══ RINGKASAN DATA (Full Width) ═══ -->
                <div v-if="filterStore.isLoading && !filterStore.summaryData" class="row g-3 mb-4">
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
                <div v-else-if="filterStore.error" class="alert alert-danger d-flex align-items-center gap-2 mb-4">
                    <i class="ri-error-warning-line fs-20"></i>
                    <span>Gagal memuat data dari API. </span>
                    <button class="btn btn-sm btn-outline-danger ms-auto" @click="filterStore.fetchDashboardData">
                        <i class="ri-refresh-line me-1"></i>Coba Lagi
                    </button>
                </div>

                <template v-else-if="filterStore.summaryData">
                    <div class="row g-3 mb-4">
                        <div class="col-xl-12">
                        <!-- ═══════════ ANALISIS KSE & IKAS SECTION ═══════════ -->
                        <div class="kse-ikas-analytics mb-4">
                            <!-- ── SECTION HEADER & FILTERS (COMBINED) ── -->
                            <div class="ki-main-header mb-3 animate-show-up" :style="{ animationDelay: isFirstLoad ? '1.5s' : '0s' }">
                                <div class="ki-header-left">
                                    <div class="ki-header-icon">
                                        <i class="ri-shield-keyhole-line"></i>
                                    </div>
                                    <h2 class="ki-header-title">Analisis Data</h2>
                                    <!-- SE | IKAS segmented control -->
                                    <div class="ki-segmented-control">
                                        <button class="ki-seg-btn" :class="{ active: summaryMode === 'KSE' }" @click="summaryMode = 'KSE'">KSE</button>
                                        <button class="ki-seg-btn" :class="{ active: summaryMode === 'IKAS' }" @click="summaryMode = 'IKAS'">IKAS</button>
                                    </div>
                                </div>
                                
                                <div class="ki-header-right">
                                    <!-- Category Filters -->
                                    <div class="ki-inline-filters" v-if="summaryMode === 'KSE'">
                                        <button v-for="cat in ['Strategis', 'Tinggi', 'Rendah']" 
                                                :key="cat"
                                                class="ki-filter-pill"
                                                :class="filterStore.kategoriSe === cat ? 'active' : ''"
                                                @click="filterStore.setKategoriSe(cat === filterStore.kategoriSe ? '' : cat)">
                                            {{ cat }}
                                        </button>
                                    </div>
                                    <div class="ki-inline-filters" v-else>
                                        <button v-for="cat in ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5']" 
                                                :key="cat"
                                                class="ki-filter-pill"
                                                :class="filterStore.kategoriSe === cat ? 'active' : ''"
                                                @click="filterStore.setKategoriSe(cat === filterStore.kategoriSe ? '' : cat)">
                                            {{ cat }}
                                        </button>
                                    </div>
                                    
                                    <div class="ki-divider"></div>
                                    
                                    <!-- View Toggles -->
                                    <div class="ki-view-toggles">
                                        <button class="ki-view-btn" :class="{ active: kseIkasViewMode === 'overview' }" @click="kseIkasViewMode = 'overview'" title="Visual Overview">
                                            <i class="ri-dashboard-line"></i>
                                        </button>
                                        <button class="ki-view-btn" :class="{ active: kseIkasViewMode === 'table' }" @click="kseIkasViewMode = 'table'" title="Metric Cards">
                                            <i class="ri-layout-grid-line"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- VIEW: TABLE (Premium Metric Cards) -->
                            <div v-if="kseIkasViewMode === 'table'" class="row g-3 animate-show-up" :style="{ animationDelay: '0.1s' }">
                                <div v-for="(item, idx) in fullSummaryItems" :key="summaryMode + '-fs-' + idx"
                                    :class="summaryMode === 'KSE' ? (idx < 2 ? 'col-xl-6' : 'col-xl-4') : (idx < 2 ? 'col-xl-6' : 'col-xl')"
                                    class="col-lg-4 col-md-4 col-sm-6">
                                    <div class="ki-metric-card" 
                                            :class="{ 'ki-metric-active': filterStore.kategoriSe === item.category && item.category, 'ki-metric-muted': item.isMuted }"
                                            @click="!item.isMuted && handleKseCardClick(item)"
                                            :style="{ '--ki-accent': item.color }">
                                        <div class="ki-metric-accent" :style="{ background: item.gradient }"></div>
                                        <div class="ki-metric-watermark">
                                            <i :class="item.icon"></i>
                                        </div>
                                        <div class="ki-metric-body">
                                            <div class="ki-metric-top">
                                                <div class="ki-metric-icon-wrap" :style="{ background: item.color + '12', border: `1px solid ${item.color}20` }">
                                                    <i :class="item.icon" :style="{ color: item.color }"></i>
                                                </div>
                                                <span v-if="filterStore.kategoriSe === item.category && item.category" class="ki-metric-active-badge">Aktif</span>
                                            </div>
                                            <div class="ki-metric-value">{{ (item.value ?? 0).toLocaleString('id-ID') }}</div>
                                            <div class="ki-metric-label">{{ item.label }}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- VIEW: OVERVIEW (The Charts) -->
                            <div v-else class="ki-charts-section">
                                <!-- ── Hero Stats Banner ── -->
                                <div class="ki-hero-banner animate-show-up" style="animation-delay: 0.1s">
                                    <div class="ki-hero-glow"></div>
                                    <div class="ki-hero-inner">
                                        <!-- SVG Ring Progress -->
                                        <div class="ki-ring-wrap">
                                            <svg viewBox="0 0 120 120" class="ki-ring-svg">
                                                <circle cx="60" cy="60" r="52" fill="none" stroke="#f1f5f9" stroke-width="8"/>
                                                <circle cx="60" cy="60" r="52" fill="none" stroke="url(#ringGrad)" stroke-width="8"
                                                    stroke-linecap="round" stroke-dasharray="326.73"
                                                    :stroke-dashoffset="326.73 - (326.73 * (summaryMode === 'KSE' ? kseFillRate : ikasCompletionRate) / 100)"
                                                    class="ki-ring-progress"/>
                                                <defs>
                                                    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                                        <stop offset="0%" stop-color="#3b82f6"/>
                                                        <stop offset="100%" stop-color="#06b6d4"/>
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                            <div class="ki-ring-label">
                                                <span class="ki-ring-value">{{ summaryMode === 'KSE' ? kseFillRate : ikasCompletionRate }}%</span>
                                                <span class="ki-ring-sub">Terisi</span>
                                            </div>
                                        </div>
                                        <!-- Hero Stats -->
                                        <div class="ki-hero-stats">
                                            <h5 class="ki-hero-title">Progress {{ summaryMode }}</h5>
                                            <p class="ki-hero-desc">Status kelengkapan data periode aktif</p>
                                            <div class="ki-hero-pills">
                                                <div class="ki-pill ki-pill-success">
                                                    <i class="ri-checkbox-circle-fill"></i>
                                                    <span>{{ summaryMode === 'KSE' ? (kseStatus?.sudah_mengisi_kse ?? 0) : stakeholdersWithIkas }}</span>
                                                    <small>Sudah</small>
                                                </div>
                                                <div class="ki-pill ki-pill-danger">
                                                    <i class="ri-close-circle-fill"></i>
                                                    <span>{{ summaryMode === 'KSE' ? (kseStatus?.belum_mengisi_kse ?? 0) : Math.max(0, totalStakeholders - stakeholdersWithIkas) }}</span>
                                                    <small>Belum</small>
                                                </div>
                                                <div class="ki-pill ki-pill-info">
                                                    <i class="ri-team-fill"></i>
                                                    <span>{{ totalStakeholders }}</span>
                                                    <small>Total</small>
                                                </div>
                                            </div>
                                        </div>
                                        <!-- CTA -->
                                        <button class="ki-hero-cta" @click="router.push(summaryMode === 'KSE' ? '/kse' : '/ikas')">
                                            Kelola <i class="ri-arrow-right-up-line"></i>
                                        </button>
                                    </div>
                                </div>

                                <div class="row g-3 mt-1">
                                    <!-- Main Chart Column -->
                                    <div class="col-xl-7 animate-show-up" style="animation-delay: 0.15s">
                                        <div class="ki-chart-card h-100">
                                            <div class="ki-chart-header">
                                                <div class="ki-chart-header-left">
                                                    <div class="ki-chart-icon-wrap">
                                                        <i :class="summaryMode === 'KSE' ? 'ri-pie-chart-2-fill' : 'ri-bar-chart-grouped-fill'"></i>
                                                    </div>
                                                    <div>
                                                        <div class="ki-chart-title">Visualisasi {{ summaryMode }}</div>
                                                        <div class="ki-chart-sub">{{ analyticsView === 'distribution' ? (summaryMode === 'KSE' ? 'Distribusi Kategori SE' : 'Distribusi Level Kematangan') : (summaryMode === 'KSE' ? 'Status Pengisian' : 'Rata-rata Domain') }}</div>
                                                    </div>
                                                </div>
                                                <div class="ki-chart-controls">
                                                    <div class="ki-view-toggle">
                                                        <button class="ki-vt-btn" :class="{ active: analyticsView === 'distribution' }" @click="analyticsView = 'distribution'">
                                                            {{ summaryMode === 'KSE' ? 'Distribusi' : 'Level' }}
                                                        </button>
                                                        <button class="ki-vt-btn" :class="{ active: analyticsView === 'completion' }" @click="analyticsView = 'completion'">
                                                            {{ summaryMode === 'KSE' ? 'Status' : 'Domain' }}
                                                        </button>
                                                    </div>
                                                    <div class="ki-chart-type-toggle">
                                                        <button v-for="type in (summaryMode === 'KSE' ? ['donut', 'bar'] : ['donut', 'bar', 'radar'])" 
                                                                :key="type"
                                                                class="ki-ct-btn"
                                                                :class="{ active: (summaryMode === 'KSE' ? kseChartType : ikasChartType) === type }"
                                                                @click="summaryMode === 'KSE' ? kseChartType = type : ikasChartType = type">
                                                            <i :class="type === 'donut' ? 'ri-donut-chart-fill' : (type === 'bar' ? 'ri-bar-chart-fill' : 'ri-radar-line')"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="ki-chart-body d-flex flex-column justify-content-center" style="min-height: 280px; height: 100%;">
                                                <apexchart
                                                    height="280"
                                                    width="100%"
                                                    :type="summaryMode === 'KSE' ? kseChartType : ikasChartType"
                                                    :options="mainAnalyticsOptions"
                                                    :series="mainAnalyticsSeries"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Right Panel: Category Breakdown + Insight -->
                                    <div class="col-xl-5 animate-show-up" style="animation-delay: 0.25s">
                                        <div class="ki-side-panel h-100">
                                            <!-- Category Breakdown -->
                                            <div class="ki-breakdown">
                                                <div class="ki-bp-header">
                                                    <span class="ki-bp-badge">
                                                        <i :class="summaryMode === 'KSE' ? 'ri-shield-star-line' : 'ri-bar-chart-box-line'"></i>
                                                        {{ summaryMode === 'KSE' ? 'Kategori SE' : 'Level Kematangan' }}
                                                    </span>
                                                </div>
                                                <div class="ki-bp-items" v-if="summaryMode === 'KSE'">
                                                    <div v-for="(cat, ci) in [
                                                        { label: 'Strategis', value: kseData.strategis, color: '#e6533c', icon: 'ri-shield-star-fill' },
                                                        { label: 'Tinggi', value: kseData.tinggi, color: '#f5b849', icon: 'ri-arrow-up-circle-fill' },
                                                        { label: 'Rendah', value: kseData.rendah, color: '#26bf94', icon: 'ri-arrow-down-circle-fill' }
                                                    ]" :key="cat.label" class="ki-bp-row" :style="{ animationDelay: (ci * 0.08) + 's' }">
                                                        <div class="ki-bp-left">
                                                            <div class="ki-bp-icon" :style="{ background: cat.color + '18', color: cat.color }">
                                                                <i :class="cat.icon"></i>
                                                            </div>
                                                            <div>
                                                                <div class="ki-bp-label">{{ cat.label }}</div>
                                                                <div class="ki-bp-count">{{ cat.value }} <span>SE</span></div>
                                                            </div>
                                                        </div>
                                                        <div class="ki-bp-bar-wrap">
                                                            <div class="ki-bp-bar">
                                                                <div class="ki-bp-bar-fill" :style="{ width: (kseData.total_se ? Math.max(3, (cat.value / kseData.total_se) * 100) : 0) + '%', background: `linear-gradient(90deg, ${cat.color}88, ${cat.color})` }"></div>
                                                            </div>
                                                            <span class="ki-bp-pct" :style="{ color: cat.color }">{{ kseData.total_se ? Math.round((cat.value / kseData.total_se) * 100) : 0 }}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="ki-bp-items" v-else>
                                                    <div v-for="(lvl, li) in [
                                                        { key: 'level1', label: 'Level 1 · Awal', color: '#e6533c' },
                                                        { key: 'level2', label: 'Level 2 · Berulang', color: '#f5b849' },
                                                        { key: 'level3', label: 'Level 3 · Terdefinisi', color: '#0ea5e9' },
                                                        { key: 'level4', label: 'Level 4 · Terkelola', color: '#23b7e5' },
                                                        { key: 'level5', label: 'Level 5 · Inovatif', color: '#26bf94' }
                                                    ]" :key="lvl.key" class="ki-bp-row" :style="{ animationDelay: (li * 0.06) + 's' }">
                                                        <div class="ki-bp-left">
                                                            <div class="ki-bp-dot" :style="{ background: lvl.color }"></div>
                                                            <div>
                                                                <div class="ki-bp-label">{{ lvl.label }}</div>
                                                                <div class="ki-bp-count">{{ ikasSummaryData.levels[lvl.key]?.count ?? 0 }}</div>
                                                            </div>
                                                        </div>
                                                        <div class="ki-bp-bar-wrap">
                                                            <div class="ki-bp-bar">
                                                                <div class="ki-bp-bar-fill" :style="{ width: (ikasSummaryData.total ? Math.max(3, (ikasSummaryData.levels[lvl.key]?.count / ikasSummaryData.total) * 100) : 0) + '%', background: `linear-gradient(90deg, ${lvl.color}88, ${lvl.color})` }"></div>
                                                            </div>
                                                            <span class="ki-bp-pct" :style="{ color: lvl.color }">{{ ikasSummaryData.total ? Math.round((ikasSummaryData.levels[lvl.key]?.count / ikasSummaryData.total) * 100) : 0 }}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- IKAS Domain Scores or KSE Insight -->
                                            <div class="ki-insight-box">
                                                <template v-if="summaryMode === 'IKAS'">
                                                    <div class="ki-domain-header">
                                                        <i class="ri-focus-3-line"></i> Rata-rata Domain IKAS
                                                    </div>
                                                    <div class="ki-domain-grid">
                                                        <div v-for="(dom, di) in [
                                                            { key: 'identifikasi', label: 'Identifikasi', icon: 'ri-search-eye-line', color: '#3b82f6' },
                                                            { key: 'proteksi', label: 'Proteksi', icon: 'ri-shield-check-line', color: '#0ea5e9' },
                                                            { key: 'deteksi', label: 'Deteksi', icon: 'ri-radar-line', color: '#f5b849' },
                                                            { key: 'tanggulih', label: 'Tanggulih', icon: 'ri-refresh-line', color: '#10b981' }
                                                        ]" :key="dom.key" class="ki-domain-item">
                                                            <div class="ki-domain-icon" :style="{ background: dom.color + '15', color: dom.color }">
                                                                <i :class="dom.icon"></i>
                                                            </div>
                                                            <div class="ki-domain-info">
                                                                <span class="ki-domain-label">{{ dom.label }}</span>
                                                                <div class="ki-domain-score-bar">
                                                                    <div class="ki-domain-fill" :style="{ width: Math.min(100, (Number(ikasSummaryData.averages[dom.key]) / 5) * 100) + '%', background: dom.color }"></div>
                                                                </div>
                                                            </div>
                                                            <span class="ki-domain-val" :style="{ color: dom.color }">{{ ikasSummaryData.averages[dom.key] }}</span>
                                                        </div>
                                                    </div>
                                                </template>
                                                <template v-else>
                                                    <div class="ki-insight-content">
                                                        <div class="ki-insight-icon-wrap">
                                                            <i class="ri-lightbulb-flash-fill"></i>
                                                        </div>
                                                        <h6 class="ki-insight-title">Analisa Strategis</h6>
                                                        <p class="ki-insight-text">
                                                            Terdapat <strong>{{ kseData.strategis }}</strong> SE Strategis dari total <strong>{{ kseData.total_se }}</strong> Sistem Elektronik. Fokus pengawasan pada SE Strategis untuk meminimalisir risiko operasional.
                                                        </p>
                                                        <div class="ki-insight-tip">
                                                            <i class="ri-information-line"></i>
                                                            <span>SE Strategis membutuhkan audit keamanan berkala</span>
                                                        </div>
                                                    </div>
                                                </template>
                                                <button class="ki-export-btn" @click="router.push(summaryMode === 'KSE' ? '/kse' : '/ikas')">
                                                    <i class="ri-external-link-line"></i> Lihat Detail {{ summaryMode }}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                                
                                <!-- ═══ GEO MAP + DISTRIBUSI SEKTOR TABLE ═══ -->
                                <div class="row g-3 mt-1 align-items-stretch">
                                    <div class="col-xl-5 animate-show-up" style="animation-delay: 2.4s">
                                        <GeoMap @sektor-click="handleSektorClick" class="w-100" />
                                    </div>
                                    <div class="col-xl-7 animate-show-up" style="animation-delay: 2.5s">
                                        <!-- 1. LIST STAKEHOLDER (Jika 1 Sub Sektor Dipilih) -->
                                        <div v-if="filterStore.subSektorId && filterStore.subSektorId !== 'ALL'" class="card custom-card mb-0 h-100">
                                            <div class="card-header d-flex flex-column gap-3 py-3">
                                                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                                    <div class="d-flex align-items-center gap-2">
                                                        <div class="fs-rate-icon bg-primary-transparent">
                                                            <i class="ri-list-check-2 text-primary"></i>
                                                        </div>
                                                        <div>
                                                            <h6 class="mb-0 fw-bold">{{ activeSubSektorSummary?.nama_sektor || 'Data Stakeholder Aktif' }}</h6>
                                                            <small class="text-muted">{{ baseStakeholders.length }} stakeholder di sub sektor ini</small>
                                                        </div>
                                                    </div>

                                                    <div v-if="activeSubSektorSummary" class="d-flex gap-3 align-items-center">
                                                        <div class="text-center">
                                                            <span class="text-muted fs-11 d-block fw-medium">TOTAL</span>
                                                            <span class="badge bg-primary-transparent fw-bold">{{ activeSubSektorSummary.total }}</span>
                                                        </div>
                                                        <div class="text-center">
                                                            <span class="text-muted fs-11 d-block fw-medium">THN INI</span>
                                                            <span v-if="activeSubSektorSummary.countYear > 0" class="badge bg-primary-transparent fw-bold">{{ activeSubSektorSummary.countYear }}</span>
                                                            <span v-else class="text-muted small">0</span>
                                                        </div>
                                                        <div class="text-center">
                                                            <span class="text-muted fs-11 d-block fw-medium">QTR INI</span>
                                                            <span v-if="activeSubSektorSummary.countQuarter > 0" class="badge bg-primary-transparent fw-bold">{{ activeSubSektorSummary.countQuarter }}</span>
                                                            <span v-else class="text-muted small">0</span>
                                                        </div>
                                                        <div class="text-center">
                                                            <span class="text-muted fs-11 d-block fw-medium">BLN INI</span>
                                                            <span v-if="activeSubSektorSummary.this_month > 0" class="badge bg-primary-transparent fw-bold">+{{ activeSubSektorSummary.this_month }}</span>
                                                            <span v-else class="text-muted small">0</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div v-if="activeSubSektorSummary" class="d-flex w-100 gap-4 mt-2 mb-1 animate-show-up" :style="{ animationDelay: isFirstLoad ? '2.2s' : '0s' }">
                                                    <!-- CSIRT -->
                                                    <div class="flex-grow-1">
                                                        <div class="d-flex justify-content-between align-items-center mb-1">
                                                            <span class="fs-11 text-muted fw-medium">Sudah CSIRT</span>
                                                            <span class="fs-11 fw-bold text-primary">{{ activeSubSektorSummary.csirtPercent }}</span>
                                                        </div>
                                                        <div class="progress" style="height: 4px;">
                                                            <div class="progress-bar bg-primary" role="progressbar" :style="{ width: activeSubSektorSummary.csirtPercent }"></div>
                                                        </div>
                                                    </div>
                                                    
                                                    <!-- IKAS -->
                                                    <div class="flex-grow-1">
                                                        <div class="d-flex justify-content-between align-items-center mb-1">
                                                            <span class="fs-11 text-muted fw-medium">Sudah IKAS</span>
                                                            <span class="fs-11 fw-bold text-primary">{{ activeSubSektorSummary.ikasPercent }}</span>
                                                        </div>
                                                        <div class="progress" style="height: 4px;">
                                                            <div class="progress-bar bg-primary" role="progressbar" :style="{ width: activeSubSektorSummary.ikasPercent }"></div>
                                                        </div>
                                                    </div>
                                                    
                                                    <!-- Data Lengkap -->
                                                    <div class="flex-grow-1">
                                                        <div class="d-flex justify-content-between align-items-center mb-1">
                                                            <span class="fs-11 text-muted fw-medium">Data Lengkap</span>
                                                            <span class="fs-11 fw-bold text-primary">{{ activeSubSektorSummary.lengkapPercent }}</span>
                                                        </div>
                                                        <div class="progress" style="height: 4px;">
                                                            <div class="progress-bar bg-primary" role="progressbar" :style="{ width: activeSubSektorSummary.lengkapPercent }"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="card-body p-0 animate-show-up" :style="{ animationDelay: isFirstLoad ? '2.4s' : '0s' }">
                                                <div class="table-responsive" style="max-height: 480px; overflow-y: auto;">
                                                    <table class="table table-hover mb-0 fs-sektor-table">
                                                        <thead style="position: sticky; top: 0; background-color: var(--custom-white); z-index: 1; box-shadow: 0 1px 0 rgba(0,0,0,0.05);">
                                                            <tr>
                                                                <th style="width:40px">#</th>
                                                                <th>Nama Stakeholder</th>
                                                                <th class="text-center" style="width:120px">Status CSIRT</th>
                                                                <th class="text-center" style="width:100px">Skor IKAS</th>
                                                                <th class="text-center" style="width:60px">Aksi</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <tr v-for="(s, idx) in baseStakeholders" :key="s.id">
                                                                <td class="text-muted">{{ idx + 1 }}</td>
                                                                <td>
                                                                    <span class="fw-medium text-primary">{{ s.nama_perusahaan || s.nama || 'Tanpa Nama' }}</span>
                                                                </td>
                                                                <td class="text-center">
                                                                    <div v-if="csirtStore.csirts.some(c => String(c.id_perusahaan) === String(s.id) || String(c.perusahaan?.id) === String(s.id))">
                                                                        <i class="ri-checkbox-circle-fill text-primary fs-18" v-if="csirtStore.hasCompleteCsirt(s.id)" title="CSIRT Lengkap"></i>
                                                                        <i class="ri-checkbox-circle-line text-muted fs-18" v-else title="CSIRT Belum Lengkap (Hanya Registrasi)"></i>
                                                                    </div>
                                                                    <span v-else class="text-muted fs-11 fw-medium">-</span>
                                                                </td>
                                                                <td class="text-center">
                                                                    <span class="badge bg-primary-transparent fw-bold" v-if="ikasStore.ikasDataMap[s.slug]?.total_rata_rata">
                                                                        {{ Number(ikasStore.ikasDataMap[s.slug].total_rata_rata).toFixed(2) }}
                                                                    </span>
                                                                    <span v-else class="text-muted small">NA</span>
                                                                </td>
                                                                <td class="text-center">
                                                                    <button class="btn btn-sm btn-icon btn-primary-light" @click="router.push(`/stakeholders/${s.slug}`)" title="Lihat Detail">
                                                                        <i class="ri-arrow-right-up-line"></i>
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                            <tr v-if="baseStakeholders.length === 0">
                                                                <td colspan="5" class="text-center py-4 text-muted">Tidak ada data stakeholder</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- 2. TABEL DISTRIBUSI SEKTOR (Default / Jika Semua Sub Sektor Dipilih) -->
                                        <div v-else-if="apiSektorCounts.length" class="card custom-card mb-0 h-100">
                                            <div class="card-header d-flex align-items-center justify-content-between py-3">
                                                <div class="d-flex align-items-center gap-2">
                                                    <div class="fs-rate-icon bg-primary-transparent">
                                                        <i class="ri-bar-chart-grouped-line text-primary"></i>
                                                    </div>
                                                    <div>
                                                        <h6 class="mb-0 fw-bold">Distribusi Stakeholder per {{ filterStore.sektorId ? 'Sub Sektor' : 'Sektor' }}</h6>
                                                        <small class="text-muted">{{ apiSektorCounts.length }} {{ filterStore.sektorId ? 'sub sektor' : 'sektor' }}</small>
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
                                                                <th class="text-center" style="width:100px">Total</th>
                                                                <th class="text-center" style="width:100px">Thn Ini</th>
                                                                <th class="text-center" style="width:100px">Qtr Ini</th>
                                                                <th class="text-center" style="width:100px">Bln Ini</th>
                                                                <th style="width:180px">Distribusi</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <tr v-for="(sektor, idx) in apiSektorCounts" :key="sektor.id"
                                                                @click="handleDrillDown({ type: sektor.nama_sektor })"
                                                                style="cursor:pointer;">
                                                                <td class="text-muted">{{ idx + 1 }}</td>
                                                                <td>
                                                                    <span class="fw-medium">{{ sektor.nama_sektor }}</span>
                                                                </td>
                                                                <td class="text-center">
                                                                    <span class="badge bg-primary-transparent fw-bold">{{ sektor.total }}</span>
                                                                </td>
                                                                <td class="text-center">
                                                                    <span v-if="sektor.countYear > 0" class="badge bg-info-transparent fw-bold">{{ sektor.countYear }}</span>
                                                                    <span v-else class="text-muted small">0</span>
                                                                </td>
                                                                <td class="text-center">
                                                                    <span v-if="sektor.countQuarter > 0" class="badge bg-info-transparent fw-bold">{{ sektor.countQuarter }}</span>
                                                                    <span v-else class="text-muted small">0</span>
                                                                </td>
                                                                <td class="text-center">
                                                                    <span v-if="sektor.this_month > 0" class="badge bg-success-transparent fw-bold">
                                                                        +{{ sektor.this_month }}
                                                                    </span>
                                                                    <span v-else class="text-muted small">0</span>
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
                                    </div>
                                </div>
                            </template>
        
                <!-- ANALISIS STAKEHOLDER PER SEKTOR -->
                <SektorAnalytics />

                <!-- RADAR CHARTS -->
                <div class="animate-show-up" :style="{ animationDelay: isFirstLoad ? '3.6s' : '0s' }">
                    <RadarChartIkas />
                </div>
            </template>
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

        <!-- DRILL-DOWN MODAL -->
        <DrillDownModal
            :visible="drillDownVisible"
            :title="drillDownTitle"
            :items="drillDownItems"
            :columns="drillDownColumns"
            @close="drillDownVisible = false"
            @navigate="handleDrillDownNavigate"
        />
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
    .summary-stat-card:not(.summary-card-muted):hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 25px rgba(0,0,0,0.08);
    }
    
    .summary-card-muted {
        opacity: 0.45 !important;
        filter: grayscale(85%);
        cursor: not-allowed !important;
        transform: none !important;
        box-shadow: none !important;
    }
    .summary-card-muted * {
        pointer-events: none;
    }

    .summary-trend-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        opacity: 0.7;
    }

    .active-filter-card {
        background: linear-gradient(135deg, rgba(var(--dw-primary-rgb), 0.05) 0%, #fff 100%) !important;
        transform: translateY(-5px);
        box-shadow: 0 10px 25px rgba(var(--dw-primary-rgb), 0.15) !important;
    }
    
    .fs-10 { font-size: 10px; }
    .fw-black { font-weight: 900; }

    /* ===== SKELETON / SHIMMER ===== */
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
        background: linear-gradient(135deg, rgba(30, 64, 175, 0.06) 0%, rgba(59, 130, 246, 0.04) 100%);
        border-radius: 12px;
        border: 1px solid rgba(30, 64, 175, 0.08);
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
        background: linear-gradient(135deg, #0d47a1 0%, #23b7e5 100%);
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

    /* ── Header Filter ── */
    .fs-filter-pill {
        font-size: 0.75rem;
        font-weight: 700;
        color: #4a6fa5;
        background: transparent;
        border: 1px solid transparent;
        padding: 5px 14px;
        transition: all 0.25s ease;
    }

    .fs-filter-pill:hover {
        background: rgba(var(--dw-primary-rgb), 0.05);
        color: var(--dw-primary);
    }

    .fs-filter-pill.active {
        background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%);
        color: #fff !important;
        border-color: transparent;
        box-shadow: 0 4px 12px rgba(37,99,235,0.25);
        transform: translateY(-1px);
    }

    .bg-white-transparent {
        background: rgba(255, 255, 255, 0.6);
        backdrop-filter: blur(4px);
    }

    /* ── Card Animation ── */
    .fs-card-animate {
        animation: fsSlideFade 0.45s ease-out both;
    }

    @keyframes fsSlideFade {
        0% {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
            filter: blur(2px);
        }
        100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
        }
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
        background: rgba(30, 64, 175, 0.03);
    }

    code {
        font-size: 0.72rem;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(30, 64, 175, 0.08);
        color: #0d47a1;
    }

    /* ── Summary Mode Switcher ── */
    .summary-mode-switcher {
        display: flex;
        background: rgba(255, 255, 255, 0.6);
        backdrop-filter: blur(8px);
        padding: 4px;
        border-radius: 50px;
        border: 1px solid rgba(30, 64, 175, 0.15);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }

    .summary-mode-btn {
        border: none;
        background: transparent;
        padding: 6px 18px;
        border-radius: 50px;
        font-size: 0.75rem;
        font-weight: 700;
        color: #64748b;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        outline: none;
    }

    .summary-mode-btn:hover {
        color: #1e40af;
        background: rgba(30, 64, 175, 0.05);
    }

    .summary-mode-btn.active {
        background: #1e40af;
        color: #fff;
        box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);
    }

    /* ── Analytics Styles ── */
    .btn-ghost {
        background: transparent;
        border: none;
        color: #64748b;
        transition: all 0.2s ease;
    }
    .btn-ghost:hover {
        background: rgba(0,0,0,0.05);
        color: #1e40af;
    }
    .btn-white {
        background: #fff;
        border: 1px solid rgba(0,0,0,0.05);
        color: #1e40af;
    }
    .btn-icon {
        width: 32px;
        height: 32px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .transition-all {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .bg-light {
        background-color: #f8f9fa !important;
    }
    .btn-primary-light {
        background: rgba(30, 64, 175, 0.1);
        color: #1e40af;
        border: none;
    }
    .btn-primary-light:hover {
        background: rgba(30, 64, 175, 0.2);
        color: #1d4ed8;
    }

    /* ─── SektorAnalytics Style Clones for KSE/IKAS ─── */
    .sa-section-header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 1.25rem; padding: 1rem 1.5rem; border-radius: 14px;
        background: linear-gradient(135deg, #0c1e6b 0%, #1130a0 25%, #1a3fc8 50%, #2563eb 75%, #3b82f6 100%);
        box-shadow: 0 8px 32px rgba(37, 99, 235, 0.22); position: relative; overflow: hidden;
    }
    .sa-section-header-inner { display: flex; align-items: center; gap: 14px; }
    .sa-section-icon {
        width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
        border-radius: 12px; background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(8px);
    }
    .sa-section-icon i { font-size: 1.5rem; color: #fff; }
    .sa-section-title { font-size: 1.15rem; font-weight: 800; color: #fff; margin: 0; line-height: 1.2; }
    .sa-view-toggles { display: flex; gap: 4px; background: rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 3px; }
    .sa-view-btn {
        width: 36px; height: 36px; border: none; border-radius: 8px; background: transparent;
        color: rgba(255, 255, 255, 0.5); display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.2s; font-size: 1.1rem;
    }
    .sa-view-btn.active { color: #2563eb; background: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); }
    
    .sa-filter-bar {
        border-radius: 14px; background: #fff; border: 1px solid #e2e8f0;
        margin-bottom: 1.25rem; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); overflow: hidden;
    }
    .sa-filter-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.75rem 1.25rem; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; gap: 0.5rem;
    }
    .sa-filter-title { font-size: 13px; font-weight: 700; color: #334155; }
    
    .sa-stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
    .sa-stat-card {
        border-radius: 16px; padding: 1.25rem 1.35rem; display: flex; flex-direction: column; gap: 6px;
        position: relative; overflow: hidden; transition: all 0.25s ease; border: 1px solid transparent;
    }
    .sa-stat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1); }
    .sa-stat-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .sa-stat-icon-wrap { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .sa-stat-icon-wrap i { font-size: 1.3rem; }
    .sa-stat-badge { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 6px; opacity: 0.8; }
    .sa-stat-value { font-size: 1.75rem; font-weight: 800; line-height: 1.1; letter-spacing: -0.5px; }
    .sa-stat-label { font-size: 12.5px; font-weight: 600; opacity: 0.65; }
    .sa-stat-detail { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 500; opacity: 0.5; margin-top: 4px; }

    .sa-stat-blue { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-color: #bfdbfe; color: #1e40af; }
    .sa-stat-blue .sa-stat-icon-wrap { background: rgba(37, 99, 235, 0.15); color: #2563eb; }
    .sa-stat-blue .sa-stat-badge { background: rgba(37, 99, 235, 0.12); color: #2563eb; }
    
    .sa-stat-emerald { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-color: #a7f3d0; color: #065f46; }
    .sa-stat-emerald .sa-stat-icon-wrap { background: rgba(16, 185, 129, 0.15); color: #10b981; }
    .sa-stat-emerald .sa-stat-badge { background: rgba(16, 185, 129, 0.12); color: #10b981; }

    .sa-stat-teal { background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); border-color: #99f6e4; color: #115e59; }
    .sa-stat-teal .sa-stat-icon-wrap { background: rgba(20, 184, 166, 0.15); color: #14b8a6; }
    .sa-stat-teal .sa-stat-badge { background: rgba(20, 184, 166, 0.12); color: #14b8a6; }

    .sa-stat-amber { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-color: #fde68a; color: #92400e; }
    .sa-stat-amber .sa-stat-icon-wrap { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    .sa-stat-amber .sa-stat-badge { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }

    .summary-mode-switcher-alt { display: flex; background: rgba(255, 255, 255, 0.15); padding: 3px; border-radius: 10px; gap: 2px; }
    .sm-btn {
        border: none; background: transparent; padding: 4px 12px; border-radius: 7px;
        font-size: 0.7rem; font-weight: 800; color: rgba(255, 255, 255, 0.7); transition: all 0.2s;
    }
    .sm-btn.active { background: #fff; color: #2563eb; }

    .fs-filter-pill-alt { font-size: 11px; font-weight: 700; color: #64748b; background: #fff; border: 1px solid #e2e8f0; }
    .fs-filter-pill-alt.active { background: #2563eb; color: #fff; border-color: #2563eb; box-shadow: 0 4px 12px rgba(37,99,235,0.2); }
    .active-filter-card-alt { border: 2px solid #2563eb !important; transform: translateY(-5px); box-shadow: 0 15px 35px rgba(37,99,235,0.15) !important; }

    .sa-chart-card { border-radius: 16px; overflow: hidden; background: #fff; border: 1px solid #e2e8f0; }
    .sa-chart-header {
        background: linear-gradient(135deg, #0c1e6b 0%, #1130a0 25%, #1a3fc8 50%, #2563eb 75%, #3b82f6 100%);
        padding: 0.75rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 12px;
    }
    .sa-chart-header-inner { display: flex; align-items: center; gap: 12px; }
    .sa-chart-icon { width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: rgba(255, 255, 255, 0.12); }
    .sa-chart-icon i { font-size: 1.2rem; color: #fff; }
    .sa-chart-title { font-size: 0.95rem; font-weight: 800; color: #fff; line-height: 1.2; }
    .sa-chart-sub { font-size: 11px; color: rgba(255, 255, 255, 0.55); margin-top: 2px; }
    .sa-chart-body { padding: 1.25rem; }
    
    .fs-40 { font-size: 40px; }
    .line-height-1 { line-height: 1; }

    /* ═══════════ KSE/IKAS PREMIUM REDESIGN ═══════════ */

    /* ── Main Header ── */
    .ki-main-header {
        display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
        background: #1e40af; border-radius: 12px; padding: 12px 20px; box-shadow: 0 4px 12px rgba(30,64,175,0.15);
    }
    .ki-header-left { display: flex; align-items: center; gap: 16px; }
    .ki-header-icon {
        width: 36px; height: 36px; border-radius: 8px; background: rgba(255,255,255,0.15);
        display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.2rem;
    }
    .ki-header-title { font-size: 1.1rem; font-weight: 700; color: #fff; margin: 0; }
    
    .ki-segmented-control {
        display: flex; background: rgba(0,0,0,0.15); padding: 4px; border-radius: 8px; gap: 2px;
    }
    .ki-seg-btn {
        background: transparent; border: none; color: rgba(255,255,255,0.7); font-size: 0.8rem;
        font-weight: 700; padding: 6px 16px; border-radius: 6px; cursor: pointer; transition: all 0.2s;
    }
    .ki-seg-btn.active { background: #fff; color: #1e40af; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
    
    .ki-header-right { display: flex; align-items: center; gap: 16px; }
    .ki-inline-filters { display: flex; gap: 6px; }
    .ki-filter-pill {
        background: transparent; border: 1px solid rgba(255,255,255,0.3); color: #fff;
        font-size: 0.75rem; font-weight: 600; padding: 6px 14px; border-radius: 20px;
        cursor: pointer; transition: all 0.2s;
    }
    .ki-filter-pill:hover { background: rgba(255,255,255,0.1); }
    .ki-filter-pill.active { background: #fff; color: #1e40af; border-color: transparent; }
    
    .ki-divider { width: 1px; height: 24px; background: rgba(255,255,255,0.2); }
    
    .ki-view-toggles { display: flex; gap: 4px; }
    .ki-view-btn {
        width: 34px; height: 34px; border: none; background: rgba(255,255,255,0.1); color: #fff;
        border-radius: 8px; display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.2s;
    }
    .ki-view-btn.active { background: #fff; color: #1e40af; }

    /* ── Metric Card ── */
    .ki-metric-card {
        position: relative; border-radius: 16px; overflow: hidden; cursor: pointer;
        background: #fff; border: 1px solid rgba(0,0,0,0.06);
        box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .ki-metric-card:hover { transform: translateY(-5px); box-shadow: 0 12px 32px rgba(0,0,0,0.1); }
    .ki-metric-accent { height: 4px; width: 100%; }
    .ki-metric-watermark {
        position: absolute; right: -8px; top: -8px; opacity: 0.04;
        font-size: 5rem; color: var(--ki-accent, #333); pointer-events: none;
        transform: rotate(-15deg);
    }
    .ki-metric-body { padding: 1.1rem 1.25rem; position: relative; z-index: 1; }
    .ki-metric-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .ki-metric-icon-wrap {
        width: 42px; height: 42px; border-radius: 12px;
        display: flex; align-items: center; justify-content: center; font-size: 1.1rem;
    }
    .ki-metric-active-badge {
        font-size: 0.65rem; font-weight: 800; color: #fff; background: #2563eb;
        padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .ki-metric-value {
        font-size: 1.75rem; font-weight: 900; color: #1e293b;
        letter-spacing: -0.5px; line-height: 1; margin-bottom: 6px;
    }
    .ki-metric-label {
        font-size: 0.7rem; font-weight: 700; color: #94a3b8;
        text-transform: uppercase; letter-spacing: 0.5px;
    }
    .ki-metric-active { border: 2px solid #2563eb !important; transform: translateY(-5px); box-shadow: 0 15px 35px rgba(37,99,235,0.15) !important; }
    .ki-metric-muted { opacity: 0.4; filter: grayscale(85%); cursor: not-allowed !important; transform: none !important; }
    .ki-metric-muted * { pointer-events: none; }

    /* ── Hero Banner ── */
    .ki-hero-banner {
        position: relative; border-radius: 18px; overflow: hidden;
        background: #fff;
        border: 1px solid #e2e8f0;
        box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        padding: 1.25rem 1.5rem;
    }
    .ki-hero-glow {
        display: none;
    }
    .ki-hero-inner {
        position: relative; z-index: 1;
        display: flex; align-items: center; gap: 2rem; flex-wrap: wrap;
    }

    /* ── SVG Ring ── */
    .ki-ring-wrap {
        position: relative; width: 110px; height: 110px; flex-shrink: 0;
    }
    .ki-ring-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ki-ring-progress { transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1); }
    .ki-ring-label {
        position: absolute; inset: 0; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
    }
    .ki-ring-value { font-size: 1.6rem; font-weight: 900; color: #1e293b; line-height: 1; }
    .ki-ring-sub { font-size: 0.65rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }

    /* ── Hero Stats ── */
    .ki-hero-stats { flex: 1; min-width: 200px; }
    .ki-hero-title { font-size: 1.15rem; font-weight: 800; color: #1e293b; margin: 0 0 4px; }
    .ki-hero-desc { font-size: 0.75rem; color: #64748b; margin: 0 0 12px; }
    .ki-hero-pills { display: flex; gap: 8px; flex-wrap: wrap; }
    .ki-pill {
        display: flex; align-items: center; gap: 6px; padding: 8px 14px;
        border-radius: 12px; font-size: 0.8rem; border: 1px solid transparent;
    }
    .ki-pill i { font-size: 1rem; }
    .ki-pill span { font-weight: 800; font-size: 1.05rem; }
    .ki-pill small { font-size: 0.65rem; font-weight: 600; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px; }
    .ki-pill-success { background: rgba(16, 185, 129, 0.1); color: #059669; border-color: rgba(16, 185, 129, 0.2); }
    .ki-pill-danger { background: rgba(239, 68, 68, 0.1); color: #dc2626; border-color: rgba(239, 68, 68, 0.2); }
    .ki-pill-info { background: rgba(59, 130, 246, 0.1); color: #2563eb; border-color: rgba(59, 130, 246, 0.2); }

    .ki-hero-cta {
        background: #f8fafc; color: #1e40af; border: 1px solid #e2e8f0;
        padding: 10px 22px; border-radius: 12px;
        font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.25s;
        display: flex; align-items: center; gap: 6px; white-space: nowrap; flex-shrink: 0;
    }
    .ki-hero-cta:hover { background: #f1f5f9; border-color: #cbd5e1; transform: translateY(-2px); }
    .ki-hero-cta i { font-size: 1rem; }

    /* ── Chart Card ── */
    .ki-chart-card {
        border-radius: 18px; overflow: hidden; background: #fff;
        border: 1px solid #e2e8f0; box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        display: flex; flex-direction: column;
    }
    .ki-chart-header {
        padding: 1rem 1.25rem; display: flex; align-items: center;
        justify-content: space-between; gap: 12px; flex-wrap: wrap;
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border-bottom: 1px solid #e2e8f0;
    }
    .ki-chart-header-left { display: flex; align-items: center; gap: 12px; }
    .ki-chart-icon-wrap {
        width: 40px; height: 40px; border-radius: 12px;
        background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
        display: flex; align-items: center; justify-content: center;
        color: #fff; font-size: 1.1rem; flex-shrink: 0;
    }
    .ki-chart-title { font-size: 0.95rem; font-weight: 800; color: #1e293b; }
    .ki-chart-sub { font-size: 0.72rem; color: #94a3b8; margin-top: 1px; }
    .ki-chart-controls { display: flex; align-items: center; gap: 8px; }
    .ki-view-toggle {
        display: flex; background: #fff; border: 1px solid #e2e8f0;
        border-radius: 10px; padding: 3px; gap: 2px;
    }
    .ki-vt-btn {
        border: none; background: transparent; padding: 5px 14px; border-radius: 8px;
        font-size: 0.72rem; font-weight: 700; color: #94a3b8; cursor: pointer;
        transition: all 0.2s;
    }
    .ki-vt-btn.active { background: #1e40af; color: #fff; box-shadow: 0 2px 8px rgba(30,64,175,0.3); }
    .ki-chart-type-toggle { display: flex; gap: 2px; background: #f1f5f9; border-radius: 10px; padding: 3px; }
    .ki-ct-btn {
        width: 32px; height: 32px; border: none; border-radius: 8px; background: transparent;
        color: #94a3b8; display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.2s; font-size: 0.9rem;
    }
    .ki-ct-btn.active { background: #fff; color: #1e40af; box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
    .ki-chart-body { padding: 1.25rem; }

    /* ── Side Panel ── */
    .ki-side-panel {
        display: flex; flex-direction: column; gap: 1rem;
    }

    /* ── Breakdown Card ── */
    .ki-breakdown {
        border-radius: 18px; background: #fff; border: 1px solid #e2e8f0;
        box-shadow: 0 2px 12px rgba(0,0,0,0.04); padding: 1.25rem; flex: 1;
    }
    .ki-bp-header { margin-bottom: 1rem; }
    .ki-bp-badge {
        display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem;
        font-weight: 800; color: #1e40af; background: rgba(30,64,175,0.08);
        padding: 5px 12px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.3px;
    }
    .ki-bp-badge i { font-size: 0.9rem; }
    .ki-bp-items { display: flex; flex-direction: column; gap: 10px; }
    .ki-bp-row {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 8px 10px; border-radius: 12px; transition: all 0.2s;
        animation: kiBpSlide 0.4s ease-out both;
    }
    .ki-bp-row:hover { background: #f8fafc; }
    @keyframes kiBpSlide { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
    .ki-bp-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .ki-bp-icon {
        width: 34px; height: 34px; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        font-size: 1rem; flex-shrink: 0;
    }
    .ki-bp-dot { width: 10px; height: 10px; border-radius: 4px; flex-shrink: 0; }
    .ki-bp-label { font-size: 0.78rem; font-weight: 700; color: #334155; white-space: nowrap; }
    .ki-bp-count { font-size: 0.72rem; font-weight: 600; color: #94a3b8; }
    .ki-bp-count span { font-weight: 500; }
    .ki-bp-bar-wrap { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 80px; }
    .ki-bp-bar { flex: 1; height: 6px; border-radius: 3px; background: #f1f5f9; overflow: hidden; }
    .ki-bp-bar-fill { height: 100%; border-radius: 3px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
    .ki-bp-pct { font-size: 0.72rem; font-weight: 800; min-width: 32px; text-align: right; }

    /* ── Insight Box ── */
    .ki-insight-box {
        border-radius: 18px; overflow: hidden;
        background: linear-gradient(145deg, #f8faff 0%, #fff 100%);
        border: 1px solid #e2e8f0; box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;
    }
    .ki-domain-header {
        font-size: 0.78rem; font-weight: 800; color: #334155; display: flex;
        align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.3px;
    }
    .ki-domain-header i { font-size: 1rem; color: #3b82f6; }
    .ki-domain-grid { display: flex; flex-direction: column; gap: 10px; }
    .ki-domain-item {
        display: flex; align-items: center; gap: 10px; padding: 8px;
        border-radius: 12px; background: #fff; border: 1px solid #f1f5f9;
        transition: all 0.2s;
    }
    .ki-domain-item:hover { border-color: #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .ki-domain-icon {
        width: 32px; height: 32px; border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        font-size: 0.9rem; flex-shrink: 0;
    }
    .ki-domain-info { flex: 1; min-width: 0; }
    .ki-domain-label { font-size: 0.72rem; font-weight: 600; color: #64748b; margin-bottom: 4px; }
    .ki-domain-score-bar { height: 5px; border-radius: 3px; background: #f1f5f9; overflow: hidden; }
    .ki-domain-fill { height: 100%; border-radius: 3px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
    .ki-domain-val { font-size: 0.95rem; font-weight: 900; flex-shrink: 0; }

    /* ── KSE Insight ── */
    .ki-insight-content { text-align: center; padding: 0.5rem 0; }
    .ki-insight-icon-wrap {
        width: 48px; height: 48px; border-radius: 14px; margin: 0 auto 12px;
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(251, 191, 36, 0.1));
        display: flex; align-items: center; justify-content: center;
    }
    .ki-insight-icon-wrap i { font-size: 1.4rem; color: #f59e0b; }
    .ki-insight-title { font-size: 0.85rem; font-weight: 800; color: #1e293b; margin: 0 0 8px; }
    .ki-insight-text { font-size: 0.75rem; color: #64748b; line-height: 1.6; margin: 0 0 12px; }
    .ki-insight-tip {
        display: flex; align-items: center; gap: 6px; padding: 8px 12px;
        border-radius: 10px; background: rgba(30,64,175,0.06); border: 1px solid rgba(30,64,175,0.08);
    }
    .ki-insight-tip i { font-size: 0.9rem; color: #3b82f6; flex-shrink: 0; }
    .ki-insight-tip span { font-size: 0.7rem; font-weight: 600; color: #3b82f6; }

    /* ── Export Button ── */
    .ki-export-btn {
        width: 100%; padding: 10px; border-radius: 12px; border: 1.5px solid #e2e8f0;
        background: #fff; color: #334155; font-size: 0.78rem; font-weight: 700;
        cursor: pointer; transition: all 0.25s; display: flex; align-items: center;
        justify-content: center; gap: 6px;
    }
    .ki-export-btn:hover { border-color: #3b82f6; color: #1e40af; background: rgba(30,64,175,0.04); }
    .ki-export-btn i { font-size: 0.9rem; }

    /* ── Responsive ── */
    @media (max-width: 1199px) {
        .ki-hero-inner { gap: 1.25rem; }
        .ki-ring-wrap { width: 90px; height: 90px; }
        .ki-ring-value { font-size: 1.3rem; }
    }
    @media (max-width: 767px) {
        .ki-hero-banner { padding: 1.25rem; }
        .ki-hero-inner { flex-direction: column; align-items: flex-start; }
        .ki-ring-wrap { width: 80px; height: 80px; }
        .ki-hero-cta { width: 100%; justify-content: center; }
        .ki-chart-header { flex-direction: column; align-items: flex-start; }
        .ki-chart-controls { width: 100%; justify-content: space-between; }
    }
    </style>
