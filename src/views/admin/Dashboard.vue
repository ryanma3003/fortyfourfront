    <script setup>
    import { ref, computed, onMounted, watch, onUnmounted } from "vue";
    import { useRouter } from "vue-router";
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
    const showMetabase = ref(false);
    const loading = ref(true);

    // Stores
    const stakeholdersStore = useStakeholdersStore();
    const ikasStore = useIkasStore();
    const csirtStore = useCsirtStore();
    const filterStore = useDashboardFilterStore();
    const notifStore = useNotificationStore();

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

    // --- Computed: KSE summary cards (Local Computed to support reactive sector filter) ---
    const kseStatus = computed(() => {
        const total = baseStakeholders.value.length;
        let sudah = 0;
        baseStakeholders.value.forEach(s => {
            const csirt = csirtStore.csirts.find(c => String(c.id_perusahaan) === String(s.id) || String(c.perusahaan?.id) === String(s.id));
            if (csirt) {
                const hasSe = baseSeList.value.some(se => String(se.id_csirt) === String(csirt.id) || String(se.csirt?.id) === String(csirt.id));
                if (hasSe) sudah++;
            }
        });
        return {
            total_perusahaan: total,
            sudah_mengisi_kse: sudah,
            belum_mengisi_kse: total - sudah
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

    // Top-level summary cards from API data
    const fullSummaryItems = computed(() => {
        const kse = kseData.value;
        const status = kseStatus.value;
        if (!kse && !status) return [];

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
                label: filterStore.quarter ? `SE Q${filterStore.quarter}` : (filterStore.year ? `SE ${filterStore.year}` : 'SE Periode Ini'),
                value: kse?.this_month ?? 0,
                icon: 'ri-calendar-check-line',
                gradient: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                color: '#6366f1',
            },
        ];
    });

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

    /**
     * Generate monthly trend data (last 6 months).
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
        
        // Initialize Dashboard Filter Config
        filterStore.loadFromStorage();
        initDateFromStore(); // Sync datepicker with stored filter
        
        try {
            await Promise.all([
                filterStore.fetchDashboardData(),
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
            triggerAlertVisibility(); // Show alert indicators after all data is loaded
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
        if (!fId && !subId) return stakeholdersStore.allStakeholders;
        return stakeholdersStore.allStakeholders.filter(s => {
            const effectiveSubId = subId === 'ALL' ? '' : subId;
            if (effectiveSubId) return String(s.sub_sektor?.id || s.id_sub_sektor) === String(effectiveSubId);
            if (fId) return String(s.sub_sektor?.id_sektor || s.id_sektor) === String(fId);
            return true;
        });
    });

    const baseCsirts = computed(() => {
        const fId = filterStore.sektorId;
        const subId = filterStore.subSektorId;
        if (!fId && !subId) return csirtStore.csirts;
        return csirtStore.csirts.filter(c => {
            const effectiveSubId = subId === 'ALL' ? '' : subId;
            if (effectiveSubId) return String(c.perusahaan?.sub_sektor?.id || c.perusahaan?.id_sub_sektor) === String(effectiveSubId);
            if (fId) return String(c.perusahaan?.sub_sektor?.id_sektor || c.perusahaan?.id_sektor) === String(fId);
            return true;
        });
    });

    const baseSdm = computed(() => {
        const fId = filterStore.sektorId;
        const subId = filterStore.subSektorId;
        if (!fId && !subId) return csirtStore.sdmList;
        return csirtStore.sdmList.filter(s => {
            const csirt = csirtStore.csirts.find(c => String(c.id) === String(s.id_csirt));
            if (!csirt) return false;
            const effectiveSubId = subId === 'ALL' ? '' : subId;
            if (effectiveSubId) return String(csirt.perusahaan?.sub_sektor?.id || csirt.perusahaan?.id_sub_sektor) === String(effectiveSubId);
            if (fId) return String(csirt.perusahaan?.sub_sektor?.id_sektor || csirt.perusahaan?.id_sektor) === String(fId);
            return true;
        });
    });

    const baseSeList = computed(() => {
        const fId = filterStore.sektorId;
        const subId = filterStore.subSektorId;
        if (!fId && !subId) return csirtStore.seList;
        return csirtStore.seList.filter(se => {
            const csirt = csirtStore.csirts.find(c => String(c.id) === String(se.id_csirt));
            if (!csirt) return false;
            const effectiveSubId = subId === 'ALL' ? '' : subId;
            if (effectiveSubId) return String(csirt.perusahaan?.sub_sektor?.id || csirt.perusahaan?.id_sub_sektor) === String(effectiveSubId);
            if (fId) return String(csirt.perusahaan?.sub_sektor?.id_sektor || csirt.perusahaan?.id_sektor) === String(fId);
            return true;
        });
    });

    // ─── CSIRT & SE Counts (All time) ───────────────────────
    const totalCsirt = computed(() => baseCsirts.value.length);
    const totalSdm = computed(() => baseSdm.value.length);
    const totalSe = computed(() => baseSeList.value.length);
    const totalStakeholders = computed(() => baseStakeholders.value.length);

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
    const stakeholdersWithIkas = computed(() => baseIkasStakeholders.value.length);

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
            
            // Check CSIRT compliance via store getter (Complete CSIRT)
            const isCsirtComplete = csirtStore.hasCompleteCsirt(s.id);
            
            // Check IKAS status from synced map
            const ikasData = ikasStore.ikasDataMap[s.slug];
            const hasIkas = ikasData && (
                (ikasData.total_rata_rata && ikasData.total_rata_rata !== 'NA' && Number(ikasData.total_rata_rata) !== 0) ||
                ikasStore.backendIkasIds[s.slug]
            );
            
            if (hasCsirtRecord) csirtCount++;
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
    const filteredStakeholders = computed(() => {
        const range = filterStore.dateRange;
        return baseStakeholders.value.filter(s => isInDateRange(s.created_at, range)).length;
    });
    const filteredCsirt = computed(() => {
        const range = filterStore.dateRange;
        return baseCsirts.value.filter(c => isInDateRange(c.perusahaan?.created_at, range)).length;
    });
    const filteredSdm = computed(() => {
        const range = filterStore.dateRange;
        return baseSdm.value.filter(s => isInDateRange(s.created_at, range)).length;
    });
    const filteredIkasCount = computed(() => {
        const range = filterStore.dateRange;
        return baseIkasStakeholders.value.filter(s => isInDateRange(s.updated_at || s.created_at, range)).length;
    });
    const filteredSe = computed(() => {
        const range = filterStore.dateRange;
        if (!range || (!range[0] && !range[1])) return totalSe.value;
        return baseSeList.value.filter(se => {
            const seDate = se['created_at'] || se['updated_at'];
            if (seDate && isInDateRange(seDate, range)) return true;
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

                const trend = getMonthlyTrend(ssStakeholders);

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

            const trend = getMonthlyTrend(
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
                iconColor: "success fw-medium",
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
        const csirtTrend = getMonthlyTrend(baseCsirts.value, 'perusahaan.created_at');
        const ikasTrend = getMonthlyTrend(baseIkasStakeholders.value, 'updated_at');
        const seTrend = getMonthlyTrend(baseSeList.value);
        const stakeholderTrend = getMonthlyTrend(baseStakeholders.value);

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
                title: "Total IKAS",
                count: String(stakeholdersWithIkas.value),
                percent: String(filteredIkasCount.value),
                monthLabel: dateRangeLabel.value,
                priceColor: "info",
                iconColor: "success fw-medium",
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

    // ─── Helper: Get Stakeholder Sektor Name ──────────────────
    function getStakeholderSektorName(s) {
        // Try nested sub_sektor with multiple paths
        if (s.sub_sektor?.nama_sektor) return s.sub_sektor.nama_sektor;
        if (s.sub_sektor?.sektor?.nama_sektor) return s.sub_sektor.sektor.nama_sektor;
        // Try legacy flat field
        if (s.sektor) return s.sektor;
        return '-';
    }

    // ─── Helper: Get Stakeholder Sub-Sektor Name ───────────────
    function getStakeholderSubSektorName(s) {
        // Try nested sub_sektor
        if (s.sub_sektor?.nama_sub_sektor) return s.sub_sektor.nama_sub_sektor;
        // Fallback to nama_sektor if available
        if (s.sub_sektor?.nama_sektor) return s.sub_sektor.nama_sektor;
        return '-';
    }

    // ─── Helper: Get CSIRT Sektor Name ─────────────────────────
    function getCsirtSektorName(c) {
        // Try nested paths
        if (c.perusahaan?.sub_sektor?.nama_sektor) return c.perusahaan.sub_sektor.nama_sektor;
        if (c.perusahaan?.sub_sektor?.sektor?.nama_sektor) return c.perusahaan.sub_sektor.sektor.nama_sektor;
        if (c.perusahaan?.sektor) return c.perusahaan.sektor;
        return '-';
    }

    // ─── Helper: Get CSIRT Sub-Sektor Name ─────────────────────
    function getCsirtSubSektorName(c) {
        // Try nested paths
        if (c.perusahaan?.sub_sektor?.nama_sub_sektor) return c.perusahaan.sub_sektor.nama_sub_sektor;
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
                    csirt_status: hasCsirt ? '✓ Ada' : '✗ Tidak',
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
                    csirt_status: csirtStore.hasCompleteCsirt(c.id_perusahaan || c.perusahaan?.id) ? '✓ Lengkap' : '⚠ Belum Lengkap',
                    created_at: c.perusahaan?.created_at ? new Date(c.perusahaan.created_at).toLocaleDateString('id-ID') : '-',
                    slug: stakeholder?.slug || c.perusahaan?.slug || c.id,
                };
            });
        } else if (context.type === 'Total IKAS') {
            // Show all stakeholders that have IKAS data
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
        } else if (context.type === 'Sistem Elektronik') {
            // Show all Sistem Elektronik records
            drillDownColumns.value = ['nama_perusahaan', 'sektor', 'sub_sektor', 'nama_se', 'kategori_se'];
            drillDownItems.value = baseSeList.value.map(se => {
                const csirt = csirtStore.csirts.find(c => String(c.id) === String(se.id_csirt));
                const stakeholder = stakeholdersStore.allStakeholders.find(s => 
                    String(s.id) === String(csirt?.id_perusahaan || csirt?.perusahaan?.id)
                );
                return {
                    nama_perusahaan: stakeholder?.nama_perusahaan || stakeholder?.nama || csirt?.perusahaan?.nama_perusahaan || '-',
                    sektor: stakeholder ? getStakeholderSektorName(stakeholder) : (csirt ? getCsirtSektorName(csirt) : '-'),
                    sub_sektor: stakeholder ? getStakeholderSubSektorName(stakeholder) : (csirt ? getCsirtSubSektorName(csirt) : '-'),
                    nama_se: se.nama_se || se.nama || '-',
                    kategori_se: se.kategori_se || '-',
                    slug: stakeholder?.slug || csirt?.perusahaan?.slug,
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
                        csirt_status: csirtData ? 'Terdaftar' : 'Tidak Terdaftar',
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
                    csirt_status: csirtData ? '✓ Lengkap' : '✗ Tidak',
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
            const ikasToSt = new Map();
            for (const [slug, id] of Object.entries(ikasStore.backendIkasIds)) {
                if (id) {
                    const st = all.find(stakeholder => stakeholder.slug === slug);
                    if (st) ikasToSt.set(String(id), String(st.id));
                }
            }

            // Find the latest timestamp and action for each stakeholder
            const stLatestUpdate = new Map(); // st_id -> timestamp string
            const stLatestAction = new Map(); // st_id -> label
            
            // Events are already sorted descending
            for (const event of notifStore.events) {
                let stId = null;
                if (event.entity === 'stakeholder') stId = String(event.entity_id);
                else if (event.entity === 'csirt') stId = csirtToSt.get(String(event.entity_id));
                else if (event.entity === 'sdm_csirt') stId = sdmToSt.get(String(event.entity_id));
                else if (event.entity === 'se_csirt') stId = seToSt.get(String(event.entity_id));
                else if (event.entity === 'ikas') stId = ikasToSt.get(String(event.entity_id));

                if (stId && !stLatestUpdate.has(stId)) {
                    stLatestUpdate.set(stId, event.timestamp);
                    const verbMap = { 'created': 'Penambahan', 'updated': 'Perubahan', 'deleted': 'Penghapusan' };
                    const entityMap = { 'stakeholder': 'Stakeholder', 'csirt': 'CSIRT', 'sdm_csirt': 'SDM CSIRT', 'se_csirt': 'SE CSIRT', 'ikas': 'IKAS', 'user': 'Pengguna' };
                    stLatestAction.set(stId, `${verbMap[event.type] || 'Update'} ${entityMap[event.entity] || event.entity}`);
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

                return {
                    nama_perusahaan: s.nama_perusahaan || s.nama || '-',
                    sektor: getStakeholderSektorName(s),
                    sub_sektor: getStakeholderSubSektorName(s),
                    updated_at: lastUpdate ? new Date(lastUpdate).toLocaleString('id-ID', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '-',
                    _rawTimestamp: lastUpdate ? new Date(lastUpdate).getTime() : 0,
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
            const title = drillDownTitle.value.toLowerCase();
            if (title.includes('kse') || title.includes('sistem elektronik')) {
                router.push(`/kse?slug=${item.slug}`);
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

            <!-- ═══ SEKTOR / SUB SEKTOR CARDS ═══ -->
            <!-- Section label -->
            <div v-if="filterStore.sektorId" class="d-flex align-items-center gap-2 mb-2 mt-1">
                <span class="badge bg-primary-transparent text-primary d-inline-flex align-items-center gap-1" style="font-size: 0.75rem; padding: 5px 12px; border-radius: 8px;">
                    <i class="ri-building-2-line"></i>
                    <span v-if="filterStore.subSektorId">Sub Sektor Terpilih</span>
                    <span v-else>Semua Sub Sektor</span>
                </span>
                <span class="text-muted" style="font-size: 0.75rem;">{{ sektorCards.length }} item</span>
            </div>
            <div class="row g-3">
                <div :class="sektorCards.length === 1 ? 'col-xl-4 col-md-6' : (sektorCards.length <= 6 ? 'col-xl-4 col-md-6' : 'col-xl-3 col-md-4')"
                    v-for="(card, index) in sektorCards"
                    :key="'sektor-' + index"
                    @click="!card.isMuted && handleSektorCardClick(card)"
                    :style="card.isMuted ? '' : 'cursor: pointer; transition: transform 0.2s; transition-timing-function: ease-in-out;'"
                    :onmouseover="card.isMuted ? '' : 'this.style.transform=\'translateY(-3px)\''"
                    :onmouseout="card.isMuted ? '' : 'this.style.transform=\'translateY(0)\''">
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
                <div class="col-xl-3 col-md-6"
                    v-for="(card, index) in operationalCards"
                    :key="'ops-' + index"
                    @click="handleDrillDown({ type: card.title })"
                    style="cursor: pointer; transition: transform 0.2s ease;"
                    @mouseover="$event.currentTarget.style.transform = 'translateY(-3px)'"
                    @mouseout="$event.currentTarget.style.transform = 'translateY(0)'">
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
            <div v-if="!loading" class="mb-4">
                <KpiCards @drill-down="handleDrillDown" />
            </div>

            <!-- LOADING SKELETON -->
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
                <!-- ═══ INSIGHT + ACTIVITY ROW ═══ -->
                <div class="row g-3 mb-4">
                    <div class="col-xl-4">
                        <InsightCard />
                    </div>
                    <div class="col-xl-4">
                        <ActionCenter />
                    </div>
                    <div class="col-xl-4">
                        <ActivityFeed />
                    </div>
                </div>

                <!-- ═══ RINGKASAN DATA (Full Width) ═══ -->
                <div class="row g-3 mb-4">
                    <div class="col-xl-12">
                        <!-- RINGKASAN DATA LENGKAP (Full Summary) -->
                        <div class="full-summary-section">
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
                            </div>

                            <!-- Summary Loading -->
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
                                <!-- ROW: KSE Metric Cards (6 cards) -->
                                <div class="row g-3 mb-4">
                                    <div class="col-xl-4 col-lg-4 col-md-4 col-sm-6 fs-card-animate" v-for="(item, idx) in fullSummaryItems" :key="'fs-'+idx"
                                        :style="{ animationDelay: `${idx * 60}ms` }">
                                        <div class="card custom-card summary-stat-card border-0 shadow-sm overflow-hidden" style="border-radius: 14px;">
                                            <div class="card-body p-3 position-relative z-1">
                                                <!-- Abstract Decor Watermark -->
                                                <div class="position-absolute end-0 top-0 p-2" style="opacity: 0.05; z-index: -1; transform: translate(10%, -10%);">
                                                    <i :class="item.icon" style="font-size: 4rem; display: block;"></i>
                                                </div>

                                                <div class="d-flex justify-content-between align-items-start mb-3">
                                                    <div class="avatar rounded-3 d-flex align-items-center justify-content-center"
                                                        :style="{ width: '40px', height: '40px', background: `${item.color}15`, border: `1px solid ${item.color}25` }">
                                                        <i :class="item.icon" class="fs-18" :style="{ color: item.color }"></i>
                                                    </div>
                                                    <div class="summary-trend-dot mt-1" :style="{ background: item.color, opacity: 0.5 }"></div>
                                                </div>
                
                                                <div>
                                                    <h3 class="fw-bold mb-1 text-dark" style="font-size: 1.6rem; letter-spacing: -0.5px;">
                                                        {{ (item.value ?? 0).toLocaleString('id-ID') }}
                                                    </h3>
                                                    <p class="text-muted mb-0 fw-semibold text-uppercase" style="font-size: 0.70rem; letter-spacing: 0.5px; opacity: 0.85;">
                                                        {{ item.label }}
                                                    </p>
                                                </div>
                                                
                                                <!-- Bottom Accent Line -->
                                                <div class="position-absolute bottom-0 start-0 w-100" style="height: 3px;" :style="{ background: item.color }"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- ROW: Status Cards -->
                                <div class="row g-3 mb-4">
                                    <!-- Pengisian KSE -->
                                    <div class="col-xl-4 col-lg-6 col-md-6">
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
                                    <div class="col-xl-4 col-lg-6 col-md-6">
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
                                    <div class="col-xl-4 col-lg-6 col-md-6">
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
                                </div>
                                
                                <!-- ═══ GEO MAP + DISTRIBUSI SEKTOR TABLE ═══ -->
                                <div class="row g-3 mt-1 align-items-stretch">
                                    <div class="col-xl-5 d-flex">
                                        <GeoMap @sektor-click="handleSektorClick" class="w-100" />
                                    </div>
                                    <div class="col-xl-7">
                                        <!-- 1. LIST STAKEHOLDER (Jika 1 Sub Sektor Dipilih) -->
                                        <div v-if="filterStore.subSektorId && filterStore.subSektorId !== 'ALL'" class="card custom-card mb-0 h-100">
                                            <div class="card-header d-flex flex-column gap-3 py-3">
                                                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                                    <div class="d-flex align-items-center gap-2">
                                                        <div class="fs-rate-icon bg-info-transparent">
                                                            <i class="ri-list-check-2 text-info"></i>
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
                                                            <span v-if="activeSubSektorSummary.countYear > 0" class="badge bg-info-transparent fw-bold">{{ activeSubSektorSummary.countYear }}</span>
                                                            <span v-else class="text-muted small">0</span>
                                                        </div>
                                                        <div class="text-center">
                                                            <span class="text-muted fs-11 d-block fw-medium">QTR INI</span>
                                                            <span v-if="activeSubSektorSummary.countQuarter > 0" class="badge bg-purple-transparent fw-bold">{{ activeSubSektorSummary.countQuarter }}</span>
                                                            <span v-else class="text-muted small">0</span>
                                                        </div>
                                                        <div class="text-center">
                                                            <span class="text-muted fs-11 d-block fw-medium">BLN INI</span>
                                                            <span v-if="activeSubSektorSummary.this_month > 0" class="badge bg-success-transparent fw-bold">+{{ activeSubSektorSummary.this_month }}</span>
                                                            <span v-else class="text-muted small">0</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div v-if="activeSubSektorSummary" class="d-flex w-100 gap-4 mt-2 mb-1">
                                                    <!-- CSIRT -->
                                                    <div class="flex-grow-1">
                                                        <div class="d-flex justify-content-between align-items-center mb-1">
                                                            <span class="fs-11 text-muted fw-medium">Sudah CSIRT</span>
                                                            <span class="fs-11 fw-bold text-danger">{{ activeSubSektorSummary.csirtPercent }}</span>
                                                        </div>
                                                        <div class="progress" style="height: 4px;">
                                                            <div class="progress-bar bg-danger" role="progressbar" :style="{ width: activeSubSektorSummary.csirtPercent }"></div>
                                                        </div>
                                                    </div>
                                                    
                                                    <!-- IKAS -->
                                                    <div class="flex-grow-1">
                                                        <div class="d-flex justify-content-between align-items-center mb-1">
                                                            <span class="fs-11 text-muted fw-medium">Sudah IKAS</span>
                                                            <span class="fs-11 fw-bold text-success">{{ activeSubSektorSummary.ikasPercent }}</span>
                                                        </div>
                                                        <div class="progress" style="height: 4px;">
                                                            <div class="progress-bar bg-success" role="progressbar" :style="{ width: activeSubSektorSummary.ikasPercent }"></div>
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
                                            <div class="card-body p-0">
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
                                                                        <i class="ri-checkbox-circle-fill text-success fs-18" v-if="csirtStore.hasCompleteCsirt(s.id)" title="CSIRT Lengkap"></i>
                                                                        <i class="ri-checkbox-circle-line text-muted fs-18" v-else title="CSIRT Belum Lengkap (Hanya Registrasi)"></i>
                                                                    </div>
                                                                    <span v-else class="text-muted fs-11 fw-medium">-</span>
                                                                </td>
                                                                <td class="text-center">
                                                                    <span class="badge bg-success-transparent fw-bold" v-if="ikasStore.ikasDataMap[s.slug]?.total_rata_rata">
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
                                                                    <span v-if="sektor.countQuarter > 0" class="badge bg-purple-transparent fw-bold">{{ sektor.countQuarter }}</span>
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
                        </div>
                    </div>
                </div>
            </template>

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

    .summary-trend-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        opacity: 0.7;
    }

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

    /* ── Card Animation ── */
    .fs-card-animate {
        animation: fsSlideFade 0.45s ease-out both;
    }

    @keyframes fsSlideFade {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
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
