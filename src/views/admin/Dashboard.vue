    <script setup>
    import { ref, computed, onMounted, onActivated, watch, onUnmounted, nextTick, defineAsyncComponent } from "vue";
    import { useRouter, useRoute } from "vue-router";

    // ” Dashboard Widgets 
    import AlertIndicators from '@/components/dashboard-widgets/AlertIndicators.vue';
    import GlobalFilter from '@/components/dashboard-widgets/GlobalFilter.vue';

    // ” CSS 
    import '@/assets/css/dashboard-widgets.css';

    // Stores
    import { useStakeholdersStore } from "@/stores/stakeholders";
    import { useIkasStore } from "@/stores/ikas";
    import { useCsirtStore } from "@/stores/csirt";
    import { useKonversiStore } from "@/stores/konversi";
    import { useDashboardFilterStore } from "@/stores/dashboardFilter";
    import { useNotificationStore } from "@/stores/notifications";
    import { getKonversiProgress, isKonversiComplete } from "@/services/konversi.service";

    // Services
    import { sektorService, subSektorService, getSektorName, getSubSektorName, getSubSektorParentId } from "@/services/sektor.service";

    const SpkReusebleJobs = defineAsyncComponent(() => import("@/shared/components/@spk/dashboards/jobs/dashboard/spk-reuseble-jobs.vue"));
    const RadarChartIkas = defineAsyncComponent(() => import('@/shared/components/@spk/charts/ikas-charts.vue'));
    const SektorAnalytics = defineAsyncComponent(() => import('@/components/dashboards/sektor-analytics.vue'));
    const InsightCard = defineAsyncComponent(() => import('@/components/dashboard-widgets/InsightCard.vue'));
    const ActionCenter = defineAsyncComponent(() => import('@/components/dashboard-widgets/ActionCenter.vue'));
    const ActivityFeed = defineAsyncComponent(() => import('@/components/dashboard-widgets/ActivityFeed.vue'));
    const QuickActions = defineAsyncComponent(() => import('@/components/dashboard-widgets/QuickActions.vue'));
    const DrillDownModal = defineAsyncComponent(() => import('@/components/dashboard-widgets/DrillDownModal.vue'));

    const router = useRouter();
    const route = useRoute();
    const showMetabase = ref(false);
    const isFirstLoad = ref(true);
    const loading = ref(true);
    const dashboardDetailsReady = ref(false);
    const lowerSectionsReady = ref(false);
    const summaryMode = ref('KSE'); // 'KSE', 'IKAS', or 'CSIRT'
    const DASHBOARD_LOAD_STAGGER_MS = 40;
    const DASHBOARD_RELOAD_DEBOUNCE_MS = 450;
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let dashboardLoadSeq = 0;
    let dashboardLoadInFlight = false;
    let dashboardFilterInitialized = false;
    let dashboardOptionsPromise = null;
    let lastDashboardLoadAt = 0;

    // Stores
    const stakeholdersStore = useStakeholdersStore();
    const ikasStore = useIkasStore();
    const csirtStore = useCsirtStore();
    const konversiStore = useKonversiStore();
    const filterStore = useDashboardFilterStore();
    const notifStore = useNotificationStore();
    
    // Analytics Chart States
    const kseChartType = ref('donut'); // 'donut' or 'bar'
    const ikasChartType = ref('donut'); // 'donut', 'bar', or 'pie'
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

    // ” Datepicker State ”
    const date = ref(null);
    const datepickerRef = ref(null);
    const customValue = ref('');
    const customUnit = ref('days');
    const singleDateValue = ref('');
    let isSyncingDateFromStore = false;
    const isDashboardDarkMode = ref(false);
    let dashboardThemeObserver = null;

    const syncDashboardTheme = () => {
        if (typeof document === 'undefined') return;
        const root = document.documentElement;
        const body = document.body;
        isDashboardDarkMode.value =
            root.getAttribute('data-theme-mode') === 'dark' ||
            body?.getAttribute('data-theme-mode') === 'dark' ||
            root.classList.contains('dark') ||
            body?.classList.contains('dark');
    };

    // Sync datepicker model from filterStore on load
    const initDateFromStore = () => {
        isSyncingDateFromStore = true;
        const dr = filterStore.dateRange;
        if (dr && dr[0] && dr[1]) {
            date.value = [new Date(dr[0]), new Date(dr[1])];
        } else {
            const now = new Date();
            date.value = [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31)];
        }
        nextTick(() => {
            isSyncingDateFromStore = false;
        });
    };

    // Watch datepicker changes †’ push to filterStore
    watch(date, (newVal) => {
        if (isSyncingDateFromStore) return;
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
        dashboardThemeObserver?.disconnect?.();
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

    const apiKseData = computed(() => {
        const data = filterStore.summaryData?.kse || {};
        return {
            rendah: Number(data.rendah ?? 0) || 0,
            strategis: Number(data.strategis ?? 0) || 0,
            this_month: Number(data.this_month ?? 0) || 0,
            tinggi: Number(data.tinggi ?? 0) || 0,
            total_se: Number(data.total_se ?? 0) || 0,
        };
    });

    const getSeCsirt = (se) => {
        const cId = String(se?.id_csirt || se?.csirt_id || se?.csirt?.id || '');
        return cId ? csirtStore.csirtByIdMap[cId] : null;
    };

    const getSeCompany = (se) => {
        const csirt = getSeCsirt(se);
        const companyId = se?.id_perusahaan || se?.perusahaan?.id || csirt?.id_perusahaan || csirt?.perusahaan?.id;
        return companyId ? (stakeholdersStore.stakeholdersByIdMap[String(companyId)] || se?.perusahaan || csirt?.perusahaan || null) : null;
    };

    const getSeCompanyId = (se) => {
        const csirt = getSeCsirt(se);
        return se?.id_perusahaan || se?.perusahaan?.id || csirt?.id_perusahaan || csirt?.perusahaan?.id || '';
    };

    const getSeFirstDate = (se) => {
        const csirt = getSeCsirt(se);
        const company = getSeCompany(se);
        return se?.created_at || se?.createdAt || se?.tanggal_dibuat || se?.updated_at || se?.updatedAt || csirt?.created_at || company?.created_at || '';
    };

    const getSeFirstTimestamp = (se) => {
        const date = getSeFirstDate(se);
        const time = date ? new Date(date).getTime() : NaN;
        return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
    };

    const firstKseByCompany = computed(() => {
        const firstByCompany = new Map();

        baseSeList.value.forEach((se, index) => {
            const companyId = getSeCompanyId(se);
            const key = companyId ? String(companyId) : `se:${se?.id || index}`;
            const current = firstByCompany.get(key);
            const timestamp = getSeFirstTimestamp(se);

            if (!current || timestamp < current.timestamp) {
                firstByCompany.set(key, { se, timestamp });
            }
        });

        return Array.from(firstByCompany.values()).map((item) => item.se);
    });

    const datedFirstKseByCompany = computed(() => {
        const range = filterStore.dateRange;
        if (!range || (!range[0] && !range[1])) return firstKseByCompany.value;

        return firstKseByCompany.value.filter((se) => {
            const date = getSeFirstDate(se);
            return date ? isInDateRange(date, range) : false;
        });
    });

    const localKseList = computed(() => {
        const kategori = String(filterStore.kategoriSe || '').trim().toLowerCase();
        const list = datedFirstKseByCompany.value;

        if (['strategis', 'tinggi', 'rendah'].includes(kategori)) {
            return list.filter((se) => String(se.kategori_se || '').trim().toLowerCase() === kategori);
        }

        return list;
    });

    const localKseData = computed(() => {
        const source = localKseList.value;
        const categorySource = datedFirstKseByCompany.value;
        const activeCategory = String(filterStore.kategoriSe || '').trim().toLowerCase();
        let strategis = 0, tinggi = 0, rendah = 0;

        categorySource.forEach(se => {
            const kat = (se.kategori_se || '').toLowerCase().trim();
            if (kat === 'strategis') strategis++;
            else if (kat === 'tinggi') tinggi++;
            else if (kat === 'rendah') rendah++;
        });

        if (['strategis', 'tinggi', 'rendah'].includes(activeCategory)) {
            return {
                total_se: source.length,
                strategis: activeCategory === 'strategis' ? source.length : 0,
                tinggi: activeCategory === 'tinggi' ? source.length : 0,
                rendah: activeCategory === 'rendah' ? source.length : 0,
                this_month: source.length,
            };
        }

        return {
            total_se: categorySource.length,
            strategis,
            tinggi,
            rendah,
            this_month: source.length,
        };
    });

    const hasUsableApiKseData = computed(() => {
        const data = apiKseData.value;
        const hasApiNumbers = data.total_se > 0 || data.this_month > 0 || data.strategis > 0 || data.tinggi > 0 || data.rendah > 0;
        return !!filterStore.summaryData?.endpointStatus?.se?.ok && (hasApiNumbers || datedFirstKseByCompany.value.length === 0);
    });

    const apiKseStatus = computed(() => {
        const status = filterStore.summaryData?.kse_status || {};
        return {
            belum_mengisi_kse: Number(status.belum_mengisi_kse ?? 0) || 0,
            sudah_mengisi_kse: Number(status.sudah_mengisi_kse ?? 0) || 0,
            total_perusahaan: Number(status.total_perusahaan ?? 0) || 0,
        };
    });

    const kseStatus = computed(() => {
        const apiStatus = apiKseStatus.value;
        const totalPerusahaan = apiStatus.total_perusahaan || datedStakeholders.value.length;
        const sudahFromStatus = apiStatus.sudah_mengisi_kse || 0;
        const hasApiStatusNumbers = apiStatus.total_perusahaan > 0 || apiStatus.sudah_mengisi_kse > 0 || apiStatus.belum_mengisi_kse > 0;

        if (hasApiStatusNumbers) {
            return {
                total_perusahaan: totalPerusahaan,
                sudah_mengisi_kse: sudahFromStatus,
                belum_mengisi_kse: Math.max(0, totalPerusahaan - sudahFromStatus),
            };
        }

        const stakeholders = datedStakeholders.value;
        const allSe = localKseList.value; // Use filtered SE list
        const filledCompanyIds = new Set();

        allSe.forEach((se) => {
            const companyId = getSeCompanyId(se);
            if (companyId) filledCompanyIds.add(String(companyId));
        });

        return {
            total_perusahaan: stakeholders.length,
            sudah_mengisi_kse: filledCompanyIds.size,
            belum_mengisi_kse: Math.max(0, stakeholders.length - filledCompanyIds.size)
        };
    });

    const kseData = computed(() => {
        if (datedFirstKseByCompany.value.length > 0) return localKseData.value;
        if (hasUsableApiKseData.value) return apiKseData.value;
        return localKseData.value;
    });
    const apiSektorCounts = computed(() => {
        const counts = filterStore.summaryData?.sektor_counts;
        if (!Array.isArray(counts)) return [];

        return counts
            .map((item) => ({
                id: String(item?.id ?? item?.sektor_id ?? item?.sub_sektor_id ?? item?.nama_sektor ?? ''),
                nama_sektor: String(item?.nama_sektor ?? item?.nama_sub_sektor ?? item?.nama ?? 'Tidak diketahui'),
                total: Number(item?.total ?? item?.count ?? item?.jumlah ?? 0) || 0,
                this_month: Number(item?.this_month ?? item?.bulan_ini ?? 0) || 0,
                countYear: Number(item?.countYear ?? item?.count_year ?? item?.tahun_ini ?? 0) || 0,
                countQuarter: Number(item?.countQuarter ?? item?.count_quarter ?? item?.kuartal_ini ?? 0) || 0,
            }))
            .filter((item) => item.total > 0 || item.this_month > 0 || item.countYear > 0 || item.countQuarter > 0)
            .sort((a, b) => b.total - a.total);
    });

    // KSE fill rate
    const kseFillRate = computed(() => {
        const s = kseStatus.value;
        if (!s || !s.total_perusahaan) return 0;
        return Math.round((s.sudah_mengisi_kse / s.total_perusahaan) * 100);
    });

    const apiIkasData = computed(() => {
        const data = filterStore.summaryData?.ikas || {};
        return {
            avg_nilai_kematangan: Number(data.avg_nilai_kematangan ?? 0) || 0,
            avg_target_nilai: Number(data.avg_target_nilai ?? 0) || 0,
            total_ikas: Number(data.total_ikas ?? 0) || 0,
        };
    });

    const apiIkasStatus = computed(() => {
        const status = filterStore.summaryData?.ikas_status || {};
        return {
            belum_mengisi_ikas: Number(status.belum_mengisi_ikas ?? 0) || 0,
            sudah_mengisi_ikas: Number(status.sudah_mengisi_ikas ?? 0) || 0,
            total_perusahaan: Number(status.total_perusahaan ?? 0) || 0,
        };
    });

    const ikasStatusTotal = computed(() => apiIkasStatus.value.total_perusahaan || totalStakeholders.value);
    const ikasFilledCount = computed(() => apiIkasStatus.value.sudah_mengisi_ikas || stakeholdersWithIkas.value);
    const ikasUnfilledCount = computed(() => (
        apiIkasStatus.value.total_perusahaan
            ? apiIkasStatus.value.belum_mengisi_ikas
            : Math.max(0, totalStakeholders.value - stakeholdersWithIkas.value)
    ));

    const apiCsirtData = computed(() => {
        const data = filterStore.summaryData?.csirt_summary || {};
        return {
            belum_lengkap: Number(data.belum_lengkap ?? 0) || 0,
            lengkap: Number(data.lengkap ?? 0) || 0,
            punya_sdm: Number(data.punya_sdm ?? 0) || 0,
            punya_se: Number(data.punya_se ?? 0) || 0,
            this_month: Number(data.this_month ?? 0) || 0,
            total_csirt: Number(data.total_csirt ?? 0) || 0,
        };
    });

    const apiCsirtStatus = computed(() => {
        const status = filterStore.summaryData?.csirt_status || {};
        return {
            belum_membentuk_csirt: Number(status.belum_membentuk_csirt ?? 0) || 0,
            sudah_membentuk_csirt: Number(status.sudah_membentuk_csirt ?? 0) || 0,
            total_perusahaan: Number(status.total_perusahaan ?? 0) || 0,
        };
    });

    const getCsirtCompanyId = (csirt) => csirt?.id_perusahaan || csirt?.perusahaan?.id || '';
    const getCsirtDate = (csirt) => csirt?.created_at || csirt?.createdAt || csirt?.perusahaan?.created_at || '';
    const hasCsirtSdm = (csirt) => {
        const cid = String(csirt?.id || '');
        return !!(cid && csirtStore.sdmByCsirtMap[cid]?.length) || (Array.isArray(csirt?.sdm_csirt) && csirt.sdm_csirt.length > 0);
    };
    const hasCsirtSe = (csirt) => {
        const cid = String(csirt?.id || '');
        const pid = String(getCsirtCompanyId(csirt) || '');
        return !!(cid && csirtStore.seByCsirtMap[cid]?.length)
            || !!(pid && csirtStore.seByPerusahaanMap[pid]?.length)
            || (Array.isArray(csirt?.se_csirt) && csirt.se_csirt.length > 0);
    };

    const firstCsirtByCompany = computed(() => {
        const firstByCompany = new Map();

        baseCsirts.value.forEach((csirt, index) => {
            const companyId = getCsirtCompanyId(csirt);
            const key = companyId ? String(companyId) : `csirt:${csirt?.id || index}`;
            const date = getCsirtDate(csirt);
            const time = date ? new Date(date).getTime() : Number.POSITIVE_INFINITY;
            const timestamp = Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
            const current = firstByCompany.get(key);

            if (!current || timestamp < current.timestamp) {
                firstByCompany.set(key, { csirt, timestamp });
            }
        });

        return Array.from(firstByCompany.values()).map((item) => item.csirt);
    });

    const datedFirstCsirtByCompany = computed(() => {
        const range = filterStore.dateRange;
        if (!range || (!range[0] && !range[1])) return firstCsirtByCompany.value;

        return firstCsirtByCompany.value.filter((csirt) => {
            const date = getCsirtDate(csirt);
            return date ? isInDateRange(date, range) : false;
        });
    });

    const localCsirtData = computed(() => {
        const source = datedFirstCsirtByCompany.value;
        let lengkap = 0;
        let punyaSdm = 0;
        let punyaSe = 0;

        source.forEach((csirt) => {
            const hasSdm = hasCsirtSdm(csirt);
            const hasSe = hasCsirtSe(csirt);
            if (hasSdm) punyaSdm++;
            if (hasSe) punyaSe++;
            if (hasSdm && hasSe) lengkap++;
        });

        return {
            total_csirt: source.length,
            lengkap,
            belum_lengkap: Math.max(0, source.length - lengkap),
            punya_sdm: punyaSdm,
            punya_se: punyaSe,
            this_month: source.length,
        };
    });

    const csirtData = computed(() => {
        if (datedFirstCsirtByCompany.value.length > 0) return localCsirtData.value;
        return apiCsirtData.value;
    });

    const csirtStatus = computed(() => {
        const apiStatus = apiCsirtStatus.value;
        const hasApiStatusNumbers = apiStatus.total_perusahaan > 0 || apiStatus.sudah_membentuk_csirt > 0 || apiStatus.belum_membentuk_csirt > 0;

        if (hasApiStatusNumbers) {
            const total = apiStatus.total_perusahaan || totalStakeholders.value;
            const sudah = apiStatus.sudah_membentuk_csirt || 0;
            return {
                total_perusahaan: total,
                sudah_membentuk_csirt: sudah,
                belum_membentuk_csirt: Math.max(0, total - sudah),
            };
        }

        const companyIds = new Set();
        datedFirstCsirtByCompany.value.forEach((csirt) => {
            const companyId = getCsirtCompanyId(csirt);
            if (companyId) companyIds.add(String(companyId));
        });

        return {
            total_perusahaan: totalStakeholders.value,
            sudah_membentuk_csirt: companyIds.size,
            belum_membentuk_csirt: Math.max(0, totalStakeholders.value - companyIds.size),
        };
    });

    const csirtCompletionRateAnalytics = computed(() => {
        const status = csirtStatus.value;
        if (!status.total_perusahaan) return 0;
        return Math.round((status.sudah_membentuk_csirt / status.total_perusahaan) * 100);
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
            total: apiIkasData.value.total_ikas || filtered.length,
            avgNilaiKematangan: apiIkasData.value.avg_nilai_kematangan,
            avgTargetNilai: apiIkasData.value.avg_target_nilai,
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

    // Analytics Chart Options & Series
    const buildAnalyticsChartData = (view = 'distribution') => {
        if (summaryMode.value === 'KSE') {
            if (view === 'distribution') {
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
        } else if (summaryMode.value === 'CSIRT') {
            if (view === 'distribution') {
                const data = csirtData.value;
                return {
                    labels: ['Lengkap', 'Belum Lengkap', 'Punya SDM', 'Punya SE'],
                    series: [data.lengkap, data.belum_lengkap, data.punya_sdm, data.punya_se],
                    colors: ['#26bf94', '#f5b849', '#0ea5e9', '#6366f1']
                };
            } else {
                const status = csirtStatus.value;
                return {
                    labels: ['Sudah Membentuk', 'Belum Membentuk'],
                    series: [status.sudah_membentuk_csirt, status.belum_membentuk_csirt],
                    colors: ['#26bf94', '#e6533c']
                };
            }
        } else {
            // IKAS Mode
            if (view === 'distribution') {
                const levels = ikasSummaryData.value.levels;
                return {
                    labels: ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'],
                    series: [levels.level1.count, levels.level2.count, levels.level3.count, levels.level4.count, levels.level5.count],
                    colors: ['#e6533c', '#f5b849', '#0ea5e9', '#23b7e5', '#26bf94']
                };
            } else {
                const s = ikasSummaryData.value;
                return {
                    labels: ['Nilai Kematangan', 'Target Nilai'],
                    series: [Number(s.avgNilaiKematangan), Number(s.avgTargetNilai)],
                    colors: ['#23b7e5', '#6366f1']
                };
            }
        }
    };

    const analyticsChartData = computed(() => buildAnalyticsChartData(analyticsView.value));

    const distributionAnalyticsData = computed(() => buildAnalyticsChartData('distribution'));
    const completionAnalyticsData = computed(() => buildAnalyticsChartData('completion'));

    const completionChartType = computed(() => {
        return activeChartType.value;
    });

    const activeChartType = computed(() => {
        if (summaryMode.value === 'IKAS') return ikasChartType.value;
        return kseChartType.value;
    });

    const formatChartNumber = (value) => Number(value || 0).toLocaleString('id-ID');

    const getSlicePercent = (value, series = []) => {
        const total = series.reduce((sum, item) => sum + Number(item || 0), 0);
        if (!total) return 0;
        return (Number(value || 0) / total) * 100;
    };

    const formatSlicePercent = (percent) => {
        if (!Number.isFinite(percent)) return '0%';
        if (percent > 0 && percent < 1) return '<1%';
        return `${Math.round(percent)}%`;
    };

    const formatLegendItem = (seriesName, opts) => {
        const series = opts?.w?.globals?.series || [];
        const value = Number(series?.[opts.seriesIndex] || 0);
        const percent = getSlicePercent(value, series);
        return `${seriesName}  ${formatChartNumber(value)} (${formatSlicePercent(percent)})`;
    };

    const formatPieDataLabel = (_val, opts) => {
        const series = opts?.w?.globals?.series || [];
        const value = Number(series?.[opts.seriesIndex] || 0);
        const percent = getSlicePercent(value, series);

        if (!value || percent < 3) return '';
        return `${formatChartNumber(value)} (${formatSlicePercent(percent)})`;
    };

    const buildAnalyticsTooltip = (data) => ({
        theme: isDashboardDarkMode.value ? 'dark' : 'light',
        fillSeriesColor: false,
        custom: ({ series, seriesIndex, dataPointIndex, w }) => {
            const isAxisSeries = Array.isArray(series?.[seriesIndex]);
            const itemIndex = Number.isInteger(dataPointIndex) && dataPointIndex >= 0 ? dataPointIndex : seriesIndex;
            const value = Number(isAxisSeries ? series?.[seriesIndex]?.[itemIndex] : series?.[seriesIndex] || 0);
            const allSeries = isAxisSeries ? (series?.[seriesIndex] || []) : (w?.globals?.series || []);
            const label = data.labels?.[itemIndex] || w?.globals?.labels?.[itemIndex] || 'Data';
            const color = data.colors?.[itemIndex] || '#2563eb';
            const percent = formatSlicePercent(getSlicePercent(value, allSeries));

            return `
                <div class="ki-chart-tooltip">
                    <span class="ki-chart-tooltip-dot" style="background:${color}"></span>
                    <div>
                        <strong>${label}</strong>
                        <small>${formatChartNumber(value)} data - ${percent}</small>
                    </div>
                </div>
            `;
        }
    });

    const buildVisualItems = (data) => {
        const total = data.series.reduce((sum, item) => sum + Number(item || 0), 0);

        return data.labels.map((label, index) => {
            const value = Number(data.series[index] || 0);
            const percent = getSlicePercent(value, data.series);

            return {
                label,
                value,
                color: data.colors[index] || '#2563eb',
                percent,
                percentLabel: total ? formatSlicePercent(percent) : '0%',
                width: `${Math.max(total ? percent : 0, value ? 3 : 0)}%`,
            };
        });
    };

    const distributionVisualItems = computed(() => buildVisualItems(distributionAnalyticsData.value));
    const completionVisualItems = computed(() => buildVisualItems(completionAnalyticsData.value));

    const buildAnalyticsOptions = (data, type, view = 'distribution') => {
        const isDark = isDashboardDarkMode.value;
        const textColor = isDark ? '#dbeafe' : '#172554';
        const mutedColor = isDark ? '#94a3b8' : '#64748b';
        const axisColor = isDark ? '#cbd5e1' : '#334155';
        const gridColor = isDark ? 'rgba(148, 163, 184, 0.18)' : '#eef3f9';
        const strokeColor = isDark ? '#151a2b' : '#ffffff';

        // Base options
        const options = {
            chart: {
                fontFamily: 'Inter, sans-serif',
                toolbar: { show: false },
                parentHeightOffset: 0,
                animations: {
                    enabled: true,
                    speed: 520,
                    animateGradually: { enabled: true, delay: 80 },
                    dynamicAnimation: { enabled: true, speed: 320 }
                }
            },
            theme: {
                mode: isDark ? 'dark' : 'light'
            },
            foreColor: axisColor,
            grid: {
                borderColor: gridColor,
                padding: {
                    top: 12,
                    right: 18,
                    bottom: 10,
                    left: 18
                }
            },
            colors: data.colors,
            labels: data.labels,
            stroke: { width: 2, colors: [strokeColor] },
            dataLabels: { enabled: true },
            legend: {
                position: 'bottom',
                fontSize: '11px',
                fontWeight: 600,
                labels: {
                    colors: axisColor
                },
                markers: { radius: 12 },
                itemMargin: { horizontal: 5, vertical: 0 }
            },
            tooltip: buildAnalyticsTooltip(data)
        };

        if (type === 'pie') {
            return {
                ...options,
                chart: { ...options.chart, type: 'pie' },
                dataLabels: {
                    enabled: true,
                    formatter: formatPieDataLabel,
                    style: {
                        fontSize: '12px',
                        fontWeight: 900,
                        colors: ['#ffffff']
                    },
                    dropShadow: {
                        enabled: true,
                        top: 1,
                        left: 1,
                        blur: 2,
                        opacity: 0.6,
                        color: '#000000'
                    }
                },
                stroke: { width: 3, colors: [strokeColor] },
                legend: {
                    show: false
                },
                plotOptions: {
                    pie: {
                        customScale: 0.85,
                        expandOnClick: false,
                        dataLabels: {
                            minAngleToShowLabel: 10,
                            offset: -15
                        }
                    }
                }
            };
        } else if (type === 'donut') {
            return {
                ...options,
                chart: { ...options.chart, type },
                dataLabels: { enabled: false },
                stroke: { width: 4, colors: [strokeColor] },
                legend: {
                    show: false
                },
                plotOptions: {
                    pie: {
                        customScale: 0.98,
                        expandOnClick: false,
                        donut: {
                            size: '68%',
                            labels: {
                                show: true,
                                name: {
                                    fontSize: "12px",
                                    fontWeight: 850,
                                    color: mutedColor,
                                    offsetY: -6
                                },
                                value: {
                                    fontSize: "28px",
                                    fontWeight: 900,
                                    color: textColor,
                                    offsetY: 8,
                                    formatter: (val) => formatChartNumber(val),
                                },
                                total: {
                                    show: true,
                                    label: view === 'completion' ? 'Total Status' : (summaryMode.value === 'KSE' ? 'Total KSE' : (summaryMode.value === 'CSIRT' ? 'Total CSIRT' : 'Total IKAS')),
                                    fontSize: "12px",
                                    fontWeight: 850,
                                    color: mutedColor,
                                    formatter: (w) => formatChartNumber(w.globals.seriesTotals.reduce((a, b) => a + b, 0))
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
                dataLabels: {
                    enabled: true,
                    formatter: (val) => {
                        if (!val) return '';
                        const percent = getSlicePercent(Number(val || 0), data.series);
                        return `${formatChartNumber(val)} (${formatSlicePercent(percent)})`;
                    },
                    offsetX: 10,
                    style: {
                        fontSize: '11px',
                        fontWeight: 900,
                        colors: [textColor]
                    },
                    background: {
                        enabled: false
                    },
                    dropShadow: {
                        enabled: true,
                        top: 0,
                        left: 0,
                        blur: 3,
                        color: isDark ? '#0f172a' : '#ffffff',
                        opacity: isDark ? 0.65 : 1
                    }
                },
                grid: {
                    borderColor: gridColor,
                    strokeDashArray: 4,
                    padding: { top: 10, right: 44, bottom: 4, left: 8 }
                },
                plotOptions: {
                    bar: {
                        borderRadius: 7,
                        borderRadiusApplication: 'end',
                        horizontal: true,
                        barHeight: data.labels.length > 3 ? '54%' : '42%',
                        distributed: true
                    }
                },
                xaxis: {
                    categories: data.labels,
                    labels: {
                        show: false
                    },
                    axisBorder: { show: false },
                    axisTicks: { show: false }
                },
                yaxis: {
                    labels: {
                        style: {
                            colors: axisColor,
                            fontSize: '11px',
                            fontWeight: 850
                        },
                        maxWidth: 120
                    }
                },
                legend: { show: false }
            };
        } else if (type === 'area') {
            return {
                ...options,
                chart: { ...options.chart, type: 'area' },
                xaxis: { categories: data.labels },
                stroke: { curve: 'smooth', width: 3 },
                dataLabels: { enabled: false },
                fill: {
                    type: 'gradient',
                    gradient: {
                        shadeIntensity: 0.2,
                        opacityFrom: 0.38,
                        opacityTo: 0.08,
                        stops: [0, 90, 100]
                    }
                },
                markers: { size: 4, strokeWidth: 3, strokeColors: strokeColor },
                legend: { show: false }
            };
        }
        return options;
    };

    const mainAnalyticsOptions = computed(() => {
        const data = analyticsChartData.value;
        const type = activeChartType.value;
        return buildAnalyticsOptions(data, type, analyticsView.value);
    });

    const buildAnalyticsSeries = (data, type) => {
        if (type === 'bar' || type === 'area') {
            return [{
                name: 'Jumlah',
                data: data.series
            }];
        }
        return data.series;
    };

    const mainAnalyticsSeries = computed(() => {
        const data = analyticsChartData.value;
        const type = activeChartType.value;
        return buildAnalyticsSeries(data, type);
    });

    const distributionAnalyticsOptions = computed(() => buildAnalyticsOptions(distributionAnalyticsData.value, activeChartType.value, 'distribution'));
    const distributionAnalyticsSeries = computed(() => buildAnalyticsSeries(distributionAnalyticsData.value, activeChartType.value));
    const completionAnalyticsOptions = computed(() => buildAnalyticsOptions(completionAnalyticsData.value, completionChartType.value, 'completion'));
    const completionAnalyticsSeries = computed(() => buildAnalyticsSeries(completionAnalyticsData.value, completionChartType.value));

    const activeProgressRate = computed(() => {
        if (summaryMode.value === 'KSE') return kseFillRate.value;
        if (summaryMode.value === 'CSIRT') return csirtCompletionRateAnalytics.value;
        return ikasCompletionRate.value;
    });

    const activeFilledCount = computed(() => {
        if (summaryMode.value === 'KSE') return kseStatus.value?.sudah_mengisi_kse ?? 0;
        if (summaryMode.value === 'CSIRT') return csirtStatus.value?.sudah_membentuk_csirt ?? 0;
        return ikasFilledCount.value;
    });

    const activeUnfilledCount = computed(() => {
        if (summaryMode.value === 'KSE') return kseStatus.value?.belum_mengisi_kse ?? 0;
        if (summaryMode.value === 'CSIRT') return csirtStatus.value?.belum_membentuk_csirt ?? 0;
        return ikasUnfilledCount.value;
    });

    const activeStatusTotal = computed(() => {
        if (summaryMode.value === 'KSE') return kseStatus.value?.total_perusahaan ?? 0;
        if (summaryMode.value === 'CSIRT') return csirtStatus.value?.total_perusahaan ?? 0;
        return ikasStatusTotal.value;
    });

    const activeDetailRoute = computed(() => {
        if (summaryMode.value === 'KSE') return '/kse-list-admin';
        if (summaryMode.value === 'CSIRT') return '/csirt-list';
        return '/ikas-list';
    });

    const analyticsPrimaryLabel = computed(() => {
        if (summaryMode.value === 'KSE') return 'Distribusi';
        if (summaryMode.value === 'CSIRT') return 'Kelengkapan';
        return 'Level';
    });

    const analyticsSecondaryLabel = computed(() => {
        if (summaryMode.value === 'KSE') return 'Status';
        if (summaryMode.value === 'CSIRT') return 'Pembentukan';
        return 'Domain';
    });

    const analyticsChartSubtitle = computed(() => {
        if (analyticsView.value === 'distribution') {
            if (summaryMode.value === 'KSE') return 'Distribusi Kategori SE';
            if (summaryMode.value === 'CSIRT') return 'Kelengkapan Data CSIRT';
            return 'Distribusi Level Kematangan';
        }

        if (summaryMode.value === 'KSE') return 'Status Pengisian';
        if (summaryMode.value === 'CSIRT') return 'Status Pembentukan';
        return 'Rata-rata Domain';
    });

    // Top-level summary cards from API data
    const fullSummaryItems = computed(() => {
        const katSe = filterStore.kategoriSe;
        const range = filterStore.dateRange;

        if (summaryMode.value === 'CSIRT') {
            const data = csirtData.value;
            const status = csirtStatus.value;
            const items = [
                {
                    label: 'Total CSIRT',
                    value: data.total_csirt,
                    icon: 'ri-shield-check-line',
                    gradient: 'linear-gradient(135deg, #23b7e5 0%, #67e8f9 100%)',
                    color: '#23b7e5',
                    category: '',
                },
                {
                    label: filterStore.quarter ? `CSIRT Q${filterStore.quarter}` : (filterStore.year ? `CSIRT ${filterStore.year}` : 'CSIRT Periode Ini'),
                    value: data.this_month || data.total_csirt,
                    icon: 'ri-calendar-check-line',
                    gradient: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                    color: '#6366f1',
                    category: '',
                },
                {
                    label: 'CSIRT Lengkap',
                    value: data.lengkap,
                    icon: 'ri-checkbox-circle-line',
                    gradient: 'linear-gradient(135deg, #26bf94 0%, #6ee7b7 100%)',
                    color: '#26bf94',
                    category: '',
                },
                {
                    label: 'CSIRT Belum Lengkap',
                    value: data.belum_lengkap,
                    icon: 'ri-error-warning-line',
                    gradient: 'linear-gradient(135deg, #f5b849 0%, #fcd34d 100%)',
                    color: '#f5b849',
                    category: '',
                },
                {
                    label: 'Sudah Membentuk',
                    value: status.sudah_membentuk_csirt,
                    icon: 'ri-building-4-line',
                    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
                    color: '#0ea5e9',
                    category: '',
                },
            ];

            return items.map(item => ({ ...item, isMuted: false }));
        }

        if (summaryMode.value === 'IKAS') {
            const s = ikasSummaryData.value;
            const items = [
                {
                    label: 'Total IKAS',
                    value: apiIkasData.value.total_ikas,
                    icon: 'ri-bar-chart-box-line',
                    gradient: 'linear-gradient(135deg, #23b7e5 0%, #67e8f9 100%)',
                    color: '#23b7e5',
                    category: '',
                },
                {
                    label: filterStore.quarter ? `IKAS Q${filterStore.quarter}` : (filterStore.year ? `IKAS ${filterStore.year}` : 'IKAS Periode Ini'),
                    value: apiIkasStatus.value.sudah_mengisi_ikas,
                    icon: 'ri-calendar-check-line',
                    gradient: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                    color: '#6366f1',
                    category: '',
                },
                {
                    label: 'Rata-rata Kematangan',
                    value: Number(s.avgNilaiKematangan.toFixed(2)),
                    icon: 'ri-line-chart-line',
                    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
                    color: '#0ea5e9',
                    category: '',
                },
                {
                    label: 'Rata-rata Target',
                    value: Number(s.avgTargetNilai.toFixed(2)),
                    icon: 'ri-focus-3-line',
                    gradient: 'linear-gradient(135deg, #14b8a6 0%, #5eead4 100%)',
                    color: '#14b8a6',
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

        // --- KSE MODE ---
        // Keep KSE aligned with IKAS: prefer /api/dashboard/se, then fall back to local data.
        const s = kseData.value;

        const items = [
            {
                label: 'Total SE (KSE)',
                value: s.total_se,
                icon: 'ri-git-branch-line',
                gradient: 'linear-gradient(135deg, #23b7e5 0%, #67e8f9 100%)',
                color: '#23b7e5',
                category: '',
            },
            {
                label: filterStore.quarter ? `SE Q${filterStore.quarter}` : (filterStore.year ? `SE ${filterStore.year}` : 'SE Periode Ini'),
                value: s.this_month || s.total_se,
                icon: 'ri-calendar-check-line',
                gradient: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                color: '#6366f1',
                category: '',
            },
            {
                label: 'SE Strategis',
                value: s.strategis,
                icon: 'ri-shield-star-line',
                gradient: 'linear-gradient(135deg, #e6533c 0%, #f87171 100%)',
                color: '#e6533c',
                category: 'Strategis',
            },
            {
                label: 'SE Tinggi',
                value: s.tinggi,
                icon: 'ri-arrow-up-circle-line',
                gradient: 'linear-gradient(135deg, #f5b849 0%, #fcd34d 100%)',
                color: '#f5b849',
                category: 'Tinggi',
            },
            {
                label: 'SE Rendah',
                value: s.rendah,
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

    //Date range helpers
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

        const bucketMap = new Map();
        buckets.forEach((bucket) => {
            const key = mode === 'monthly'
                ? `${bucket.year}-${bucket.month}`
                : `${bucket.year}-${bucket.month}-${bucket.day}`;
            bucketMap.set(key, bucket);
        });

        // 3. Count items into buckets
        function getField(obj, path) {
            return path.split('.').reduce((o, k) => o && o[k], obj);
        }
        
        items.forEach(item => {
            const raw = getField(item, dateField) || item['created_at'] || item['updated_at'];
            if (!raw || typeof raw !== 'string') return;
            const d = new Date(raw);
            if (isNaN(d.getTime())) return;

            const key = mode === 'monthly'
                ? `${d.getFullYear()}-${d.getMonth()}`
                : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const bucket = bucketMap.get(key);
            if (bucket) bucket.count++;
        });

        return {
            data: buckets.map(b => b.count),
            labels: buckets.map(b => b.label),
        };
    }

    // ” Fetch all data ”
    /** Build sparkline chart options with month labels in tooltip */
    function buildSparkOptions(color, labels) {
        return {
            chart: {
                type: 'area',
                sparkline: { enabled: true },
                animations: { enabled: false },
                toolbar: { show: false },
            },
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

    const isLatestDashboardLoad = (token) => token === dashboardLoadSeq;

    const initializeDashboardFilter = () => {
        if (dashboardFilterInitialized) return;
        filterStore.loadFromStorage();
        initDateFromStore();
        dashboardFilterInitialized = true;
    };

    const loadDashboardOptions = async () => {
        if (sektorList.value.length && subSektorList.value.length) return;
        if (dashboardOptionsPromise) return dashboardOptionsPromise;

        dashboardOptionsPromise = (async () => {
            const [sektors, subSektors] = await Promise.all([
                sektorList.value.length ? Promise.resolve(sektorList.value) : sektorService.getAll(),
                subSektorList.value.length ? Promise.resolve(subSektorList.value) : subSektorService.getAll(),
            ]);
            sektorList.value = Array.isArray(sektors) ? sektors : [];
            subSektorList.value = Array.isArray(subSektors) ? subSektors : [];
        })();

        try {
            await dashboardOptionsPromise;
        } finally {
            dashboardOptionsPromise = null;
        }
    };

    const hasDashboardCache = () => (
        stakeholdersStore.initialized
        && csirtStore.initialized
        && ikasStore.initialized
        && konversiStore.initialized
        && sektorList.value.length > 0
        && subSektorList.value.length > 0
    );

    const openReopenedDrillDown = () => {
        if (!route.query.reopen) return;

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
    };

    const loadDashboardData = async (options = {}) => {
        const now = Date.now();
        if (!options.force && (dashboardLoadInFlight || now - lastDashboardLoadAt < DASHBOARD_RELOAD_DEBOUNCE_MS)) {
            return;
        }

        initializeDashboardFilter();

        if (options.preferCache && hasDashboardCache()) {
            loading.value = false;
            dashboardDetailsReady.value = true;
            lowerSectionsReady.value = true;
            isFirstLoad.value = false;
            if (!filterStore.summaryData && !filterStore.isLoading) {
                filterStore.fetchDashboardData();
            }
            openReopenedDrillDown();
            return;
        }

        lastDashboardLoadAt = now;
        dashboardLoadInFlight = true;
        const token = ++dashboardLoadSeq;

        loading.value = true;
        dashboardDetailsReady.value = false;
        lowerSectionsReady.value = false;
        isFirstLoad.value = true;

        const loadStore = (store, refreshMethod = 'refresh') => {
            if (options.refresh && store.initialized && typeof store[refreshMethod] === 'function') return store[refreshMethod]();
            return store.initialized ? Promise.resolve() : store.initialize();
        };

        try {
            const summaryPromise = filterStore.fetchDashboardData();

            await Promise.allSettled([
                loadStore(stakeholdersStore),
                loadDashboardOptions(),
            ]);

            if (!isLatestDashboardLoad(token)) return;

            loading.value = false;
            triggerAlertVisibility();

            await delay(DASHBOARD_LOAD_STAGGER_MS);

            await Promise.allSettled([
                loadStore(csirtStore),
                loadStore(ikasStore),
                loadStore(konversiStore),
                summaryPromise,
            ]);

            if (!isLatestDashboardLoad(token)) return;
            dashboardDetailsReady.value = true;

            await delay(DASHBOARD_LOAD_STAGGER_MS);

            if (!isLatestDashboardLoad(token)) return;
            lowerSectionsReady.value = true;
            setTimeout(() => {
                if (isLatestDashboardLoad(token)) isFirstLoad.value = false;
            }, 650);
        } catch (e) {
            console.error("Dashboard data load error:", e);
            if (isLatestDashboardLoad(token)) {
                loading.value = false;
                dashboardDetailsReady.value = true;
                lowerSectionsReady.value = true;
            }
        } finally {
            if (isLatestDashboardLoad(token)) {
                dashboardLoadInFlight = false;
                openReopenedDrillDown();
            }
        }
    };

    onMounted(async () => {
        syncDashboardTheme();
        dashboardThemeObserver = new MutationObserver(syncDashboardTheme);
        dashboardThemeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme-mode', 'class'],
        });
        if (document.body) {
            dashboardThemeObserver.observe(document.body, {
                attributes: true,
                attributeFilter: ['data-theme-mode', 'class'],
            });
        }
        await loadDashboardData({ force: true });
    });

    onActivated(async () => {
        await loadDashboardData({ preferCache: true });
    });

    // ” Color Palette 
    function getColor(colorName) {
        const colors = {
            primary: '#0d47a1', secondary: '#ff9800', warning: '#fdaf22',
            info: '#00c9ff', success: '#32d484', danger: '#ff6757',
            slate: '#64748b', teal: '#14b8a6', blue: '#3b82f6',
            cyan: '#06b6d4', emerald: '#10b981', orange: '#f97316',
        };
        return colors[colorName] || '#0d47a1';
    }

    // ” Enriched Sektor Data ”
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

    // ” Base Filtered Data arrays (Respects Sector) ”
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

    const hasKonversiApiData = computed(() => konversiStore.initialized && konversiStore.records.length > 0);

    const getStakeholderKonversiRecord = (stakeholder) => {
        if (!stakeholder?.id) return null;
        return konversiStore.getByPerusahaanId(stakeholder.id);
    };

    const countCompleteKonversiStakeholders = (stakeholders) => (
        stakeholders.filter((stakeholder) => isKonversiComplete(getStakeholderKonversiRecord(stakeholder))).length
    );

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

    // --- CSIRT & SE Counts (All time) ”
    const totalCsirt = computed(() => {
        // Count ALL stakeholders that have a CSIRT record (both complete and incomplete)
        return baseStakeholders.value.filter(s => !!csirtStore.csirtByPerusahaanMap[String(s.id)]).length;
    });
    const totalSdm = computed(() => baseSdm.value.length);
    const totalSe = computed(() => datedFirstKseByCompany.value.length);
    const totalStakeholders = computed(() => datedStakeholders.value.length);

    // Count stakeholders with complete CSIRT
    const stakeholdersWithCsirt = computed(() => {
        return baseStakeholders.value.filter(s => csirtStore.hasCompleteCsirt(s.id)).length;
    });

    // ” Base IKAS Stakeholders 
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

    // ” Full Summary Computed Data ”
    const csirtCompletionRate = computed(() => {
        if (!totalStakeholders.value) return 0;
        return Math.round((stakeholdersWithCsirt.value / totalStakeholders.value) * 100);
    });

    const ikasCompletionRate = computed(() => {
        const total = ikasStatusTotal.value;
        if (!total) return 0;
        return Math.round((ikasFilledCount.value / total) * 100);
    });

    const totalSektors = computed(() => sektorList.value.length);
    const totalSubSektors = computed(() => subSektorList.value.length);
    // (Re-fetch handling is managed via Pinia debounced actions internally)

    // ” Active Sub Sektor Summary computed ”
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
            
            // Data Lengkap = API konversi marks it complete; fallback stays aligned with legacy rules.
            if (hasKonversiApiData.value) {
                if (isKonversiComplete(getStakeholderKonversiRecord(s))) lengkapCount++;
            } else if (isCsirtComplete && hasIkas) {
                lengkapCount++;
            }
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

    // ” Date-filtered counts ”
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
    const filteredSe = computed(() => localKseList.value.length);
    const operationalCardsReady = computed(() => !loading.value && (!!filterStore.summaryData || dashboardDetailsReady.value));

    const fallbackTrendData = (value = 0) => ({
        data: [0, 0, 0, Number(value) || 0],
        labels: ['Awal', 'Proses', 'Terkini', dateRangeLabel.value],
    });

    // ” ROW 1 Cards: Sektor-based data 
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

        //  MODE 1: Sub Sektor (ALL or specific) 
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

        //  MODE 2 & 3: Tampilkan sektor (Default or no filter) 
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

    // ” ROW 2 Cards: CSIRT, SE, IKAS 
    const operationalCards = computed(() => {
        const csirtCount = apiCsirtStatus.value.sudah_membentuk_csirt || apiCsirtData.value.total_csirt || filteredCsirt.value;
        const ikasCount = apiIkasStatus.value.sudah_mengisi_ikas || apiIkasData.value.total_ikas || filteredIkasCount.value;
        const seCount = apiKseData.value.total_se || filteredSe.value;
        const stakeholderCount = apiCsirtStatus.value.total_perusahaan
            || apiIkasStatus.value.total_perusahaan
            || apiKseStatus.value.total_perusahaan
            || filteredStakeholders.value;

        const useDetailedTrends = dashboardDetailsReady.value;
        const csirtTrend = useDetailedTrends ? getTrendData(baseCsirts.value, 'perusahaan.created_at') : fallbackTrendData(csirtCount);
        const ikasTrend = useDetailedTrends ? getTrendData(baseIkasStakeholders.value, 'updated_at') : fallbackTrendData(ikasCount);
        const seTrend = useDetailedTrends ? getTrendData(firstKseByCompany.value) : fallbackTrendData(seCount);
        const stakeholderTrend = useDetailedTrends ? getTrendData(baseStakeholders.value) : fallbackTrendData(stakeholderCount);

        return [
            {
                title: "Total CSIRT",
                count: String(csirtCount),
                percent: String(csirtCount),
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
                count: String(ikasCount),
                percent: String(ikasCount),
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
                count: String(seCount),
                percent: String(seCount),
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
                count: String(stakeholderCount),
                percent: String(stakeholderCount),
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

    // ” Helper: Get Stakeholder Sektor Name 
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

    // ” Helper: Get Stakeholder Sub-Sektor Name ”
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

    // ” Helper: Get CSIRT Sektor Name ”
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

    // ” Helper: Get CSIRT Sub-Sektor Name ”
    function getCsirtSubSektorName(c) {
        if (!c) return '-';
        // Try nested paths
        if (c.perusahaan?.sub_sektor?.nama_sub_sektor) return c.perusahaan.sub_sektor.nama_sub_sektor;
        
        // Fallback to perusahaan resolution
        if (c.perusahaan) return getStakeholderSubSektorName(c.perusahaan);

        if (c.perusahaan?.sub_sektor?.nama_sektor) return c.perusahaan.sub_sektor.nama_sektor;
        return '-';
    }

    // ” Drill-Down Handler ”
    async function handleDrillDown(context) {
        if (context?.type === 'Data Lengkap') {
            await (konversiStore.initialized ? konversiStore.refresh() : konversiStore.initialize());
        }

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
        } else if (context.type === 'csirt' || context.type.includes('CSIRT') || context.type.includes('Membentuk')) {
            drillDownColumns.value = ['nama_perusahaan', 'sektor', 'sub_sektor', 'csirt_nama', 'csirt_status', 'created_at'];
            let csirtList = [...datedFirstCsirtByCompany.value];
            const type = context.type.toLowerCase();

            if (type.includes('lengkap') && !type.includes('belum')) {
                csirtList = csirtList.filter((c) => hasCsirtSdm(c) && hasCsirtSe(c));
            } else if (type.includes('belum lengkap')) {
                csirtList = csirtList.filter((c) => !(hasCsirtSdm(c) && hasCsirtSe(c)));
            } else if (type.includes('sudah membentuk')) {
                csirtList = csirtList.filter((c) => !!getCsirtCompanyId(c));
            }

            drillDownItems.value = csirtList.map(c => {
                const stakeholder = stakeholdersStore.allStakeholders.find(s =>
                    String(s.id) === String(getCsirtCompanyId(c))
                );
                const complete = hasCsirtSdm(c) && hasCsirtSe(c);
                return {
                    nama_perusahaan: stakeholder?.nama_perusahaan || c.perusahaan?.nama_perusahaan || c.nama_csirt || '-',
                    sektor: stakeholder ? getStakeholderSektorName(stakeholder) : getCsirtSektorName(c),
                    sub_sektor: stakeholder ? getStakeholderSubSektorName(stakeholder) : getCsirtSubSektorName(c),
                    csirt_nama: c.nama_csirt || '-',
                    csirt_status: complete ? 'Lengkap' : 'Belum Lengkap',
                    created_at: getCsirtDate(c) ? new Date(getCsirtDate(c)).toLocaleDateString('id-ID') : '-',
                    slug: stakeholder?.slug || c.perusahaan?.slug || c.id,
                };
            });
        } else if (context.type === 'Sistem Elektronik' || context.type.includes('SE') || context.type.includes('Total SE')) {
            // Show filtered Sistem Elektronik records
            drillDownColumns.value = ['nama_perusahaan', 'sektor', 'sub_sektor', 'nama_se', 'kategori_se'];
            
            let seList = [...datedFirstKseByCompany.value];
            const type = context.type.toLowerCase();

            // 1. Filter by category if card is specific
            if (type.includes('strategis')) seList = seList.filter(se => (se.kategori_se || '').toLowerCase().trim() === 'strategis');
            else if (type.includes('tinggi')) seList = seList.filter(se => (se.kategori_se || '').toLowerCase().trim() === 'tinggi');
            else if (type.includes('rendah')) seList = seList.filter(se => (se.kategori_se || '').toLowerCase().trim() === 'rendah');
            else if (filterStore.kategoriSe) {
                const activeCategory = String(filterStore.kategoriSe || '').toLowerCase().trim();
                seList = seList.filter(se => (se.kategori_se || '').toLowerCase().trim() === activeCategory);
            }

            drillDownItems.value = seList.map(se => {
                const csirt = getSeCsirt(se);
                const stakeholder = getSeCompany(se);
                
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
            drillDownColumns.value = ['nama_perusahaan', 'sektor', 'sub_sektor', 'status_data', 'persentase', 'poin_ikas', 'poin_kse', 'poin_survey', 'poin_csirt', 'total_poin'];
            drillDownItems.value = all.map((s) => {
                const konversi = getStakeholderKonversiRecord(s);
                const progress = getKonversiProgress(konversi);
                return { stakeholder: s, konversi, progress };
            }).filter(({ konversi }) => isKonversiComplete(konversi)).map(({ stakeholder: s, konversi, progress }) => ({
                nama_perusahaan: konversi?.nama_perusahaan || s.nama_perusahaan || s.nama || '-',
                sektor: getStakeholderSektorName(s),
                sub_sektor: getStakeholderSubSektorName(s),
                status_data: progress.isComplete ? 'Lengkap' : 'Belum Lengkap',
                persentase: `${progress.percent}%`,
                poin_ikas: konversi?.poin_ikas ?? '-',
                poin_kse: konversi?.poin_kse ?? '-',
                poin_survey: konversi?.poin_survey ?? '-',
                poin_csirt: konversi?.poin_csirt ?? '-',
                total_poin: konversi?.total_poin ?? '-',
                slug: s.slug,
            }));
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

    // ” Global Filter Handler 
    // This is now purely Pinia-based, no emits needed from GlobalFilter component

    // ” Quick Action Handlers 
    function handleAddStakeholder() {
        router.push('/stakeholders');
    }

    async function handleRefreshData() {
        await loadDashboardData({ force: true, refresh: true });
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

        <div v-if="!showMetabase" id="dashboard-capture" class="dashboard-capture" :class="{ 'is-dark': isDashboardDarkMode }">
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
                <!--  SEKTOR / SUB SEKTOR CARDS  -->
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
                            sektorCards.length === 1 ? 'col-xl-4 col-md-6' : (sektorCards.length === 4 ? 'col-xl-3 col-md-6' : (sektorCards.length <= 6 ? 'col-xl-4 col-md-6' : 'col-xl-3 col-md-4')),
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

                <!--  OPERATIONAL CARDS  -->
                <div v-if="operationalCardsReady" class="row g-3 mt-1">
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


                <!--  INSIGHT + ACTIVITY ROW  -->
                <div class="row g-3 mb-4">
                    <div class="col-xl-4 animate-show-up" :style="{ animationDelay: isFirstLoad ? '1.0s' : '0s' }">
                        <InsightCard :loading="!dashboardDetailsReady"  @drill-down="handleDrillDown" />
                    </div>
                    <div class="col-xl-4 animate-show-up" :style="{ animationDelay: isFirstLoad ? '1.2s' : '0s' }">
                        <ActionCenter :loading="!dashboardDetailsReady" />
                    </div>
                    <div class="col-xl-4 animate-show-up" :style="{ animationDelay: isFirstLoad ? '1.4s' : '0s' }">
                        <ActivityFeed :loading="!dashboardDetailsReady" />
                    </div>
                </div>

                <!--  RINGKASAN DATA (Full Width)  -->
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
                        <!-- • PETA + DISTRIBUSI STAKEHOLDER • -->
                        <div v-if="false" class="row g-3 mb-4 align-items-stretch">
                            <div class="col-xl-5 animate-show-up" :style="{ animationDelay: isFirstLoad ? '1.2s' : '0s' }">
                            </div>
                            <div class="col-xl-7 animate-show-up" :style="{ animationDelay: isFirstLoad ? '1.3s' : '0s' }">
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

                                        <div v-if="activeSubSektorSummary" class="d-flex w-100 gap-4 mt-2 mb-1 animate-show-up" :style="{ animationDelay: isFirstLoad ? '1.4s' : '0s' }">
                                            <div class="flex-grow-1">
                                                <div class="d-flex justify-content-between align-items-center mb-1">
                                                    <span class="fs-11 text-muted fw-medium">Sudah CSIRT</span>
                                                    <span class="fs-11 fw-bold text-primary">{{ activeSubSektorSummary.csirtPercent }}</span>
                                                </div>
                                                <div class="progress" style="height: 4px;">
                                                    <div class="progress-bar bg-primary" role="progressbar" :style="{ width: activeSubSektorSummary.csirtPercent }"></div>
                                                </div>
                                            </div>
                                            <div class="flex-grow-1">
                                                <div class="d-flex justify-content-between align-items-center mb-1">
                                                    <span class="fs-11 text-muted fw-medium">Sudah IKAS</span>
                                                    <span class="fs-11 fw-bold text-primary">{{ activeSubSektorSummary.ikasPercent }}</span>
                                                </div>
                                                <div class="progress" style="height: 4px;">
                                                    <div class="progress-bar bg-primary" role="progressbar" :style="{ width: activeSubSektorSummary.ikasPercent }"></div>
                                                </div>
                                            </div>
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
                                    <div class="card-body p-0 animate-show-up" :style="{ animationDelay: isFirstLoad ? '1.5s' : '0s' }">
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

                        <!-- • ANALISIS KSE & IKAS SECTION • -->
                        <div v-if="lowerSectionsReady" class="kse-ikas-analytics mb-4">
                            <!--  SECTION HEADER & FILTERS (COMBINED)  -->
                            <div class="ki-command-center mb-3 animate-show-up" :style="{ animationDelay: isFirstLoad ? '1.5s' : '0s' }">
                            <div class="ki-main-header">
                                <div class="ki-header-left">
                                    <div class="ki-header-icon">
                                        <i class="ri-shield-keyhole-line"></i>
                                    </div>
                                    <h2 class="ki-header-title">Analisis Data</h2>
                                    <!-- SE | IKAS segmented control -->
                                    <div class="ki-segmented-control">
                                        <button class="ki-seg-btn" :class="{ active: summaryMode === 'KSE' }" @click="summaryMode = 'KSE'">KSE</button>
                                        <button class="ki-seg-btn" :class="{ active: summaryMode === 'IKAS' }" @click="summaryMode = 'IKAS'">IKAS</button>
                                        <button class="ki-seg-btn" :class="{ active: summaryMode === 'CSIRT' }" @click="summaryMode = 'CSIRT'">CSIRT</button>
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
                                    <div class="ki-inline-filters" v-else-if="summaryMode === 'IKAS'">
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

                            <div v-if="kseIkasViewMode === 'overview'" class="ki-hero-banner">
                                <div class="ki-hero-glow"></div>
                                <div class="ki-hero-inner">
                                    <!-- SVG Ring Progress -->
                                    <div class="ki-ring-wrap">
                                        <svg viewBox="0 0 120 120" class="ki-ring-svg">
                                            <circle cx="60" cy="60" r="52" fill="none" stroke="#e8eef7" stroke-width="8"/>
                                            <circle cx="60" cy="60" r="52" fill="none" stroke="url(#ringGrad)" stroke-width="8"
                                                stroke-linecap="round" stroke-dasharray="326.73"
                                                :stroke-dashoffset="326.73 - (326.73 * activeProgressRate / 100)"
                                                class="ki-ring-progress"/>
                                            <defs>
                                                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                                    <stop offset="0%" stop-color="#3b82f6"/>
                                                    <stop offset="100%" stop-color="#06b6d4"/>
                                                </linearGradient>
                                            </defs>
                                        </svg>
                                        <div class="ki-ring-label">
                                            <span class="ki-ring-value">{{ activeProgressRate }}%</span>
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
                                                <span>{{ activeFilledCount }}</span>
                                                <small>Sudah</small>
                                            </div>
                                            <div class="ki-pill ki-pill-danger">
                                                <i class="ri-close-circle-fill"></i>
                                                <span>{{ activeUnfilledCount }}</span>
                                                <small>Belum</small>
                                            </div>
                                            <div class="ki-pill ki-pill-info">
                                                <i class="ri-team-fill"></i>
                                                <span>{{ activeStatusTotal }}</span>
                                                <small>Total</small>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- CTA -->
                                    <button class="ki-hero-cta" @click="router.push(activeDetailRoute)">
                                        Kelola <i class="ri-arrow-right-up-line"></i>
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
                                <div class="row g-3 mt-3">
                                    <!-- Main Chart Column -->
                                    <div class="col-xl-8 animate-show-up" style="animation-delay: 0.15s">
                                        <div class="ki-chart-card h-100">
                                            <div class="ki-chart-header">
                                                <div class="ki-chart-header-left">
                                                    <div class="ki-chart-icon-wrap">
                                                        <i :class="summaryMode === 'KSE' ? 'ri-pie-chart-2-fill' : (summaryMode === 'CSIRT' ? 'ri-shield-check-fill' : 'ri-bar-chart-grouped-fill')"></i>
                                                    </div>
                                                    <div>
                                                        <div class="ki-chart-title">Visualisasi {{ summaryMode }}</div>
                                                        <div class="ki-chart-sub">Distribusi dan status data periode aktif</div>
                                                    </div>
                                                </div>
                                                <div class="ki-chart-controls">
                                                    <div class="ki-chart-type-toggle">
                                                        <button v-for="type in ['donut', 'bar', 'pie']" 
                                                                :key="type"
                                                                class="ki-ct-btn"
                                                                :class="{ active: activeChartType === type }"
                                                                @click="summaryMode === 'IKAS' ? ikasChartType = type : kseChartType = type">
                                                            <i :class="type === 'donut' ? 'ri-donut-chart-fill' : (type === 'bar' ? 'ri-bar-chart-fill' : 'ri-pie-chart-2-fill')"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="ki-chart-body">
                                                <div class="ki-chart-split-grid">
                                                    <div class="ki-chart-pane">
                                                        <div class="ki-chart-pane-title">
                                                            <span>{{ analyticsPrimaryLabel }}</span>
                                                            <small>{{ summaryMode === 'KSE' ? 'Kategori SE' : (summaryMode === 'CSIRT' ? 'Kelengkapan CSIRT' : 'Level Kematangan') }}</small>
                                                        </div>
                                                        <div class="ki-visual-strip">
                                                            <div
                                                                v-for="item in distributionVisualItems"
                                                                :key="'dist-visual-' + item.label"
                                                                class="ki-visual-pill"
                                                            >
                                                                <div class="ki-visual-pill-top">
                                                                    <span class="ki-visual-dot" :style="{ background: item.color }"></span>
                                                                    <span class="ki-visual-label">{{ item.label }}</span>
                                                                </div>
                                                                <div class="ki-visual-value">{{ item.value.toLocaleString('id-ID') }}</div>
                                                                <div class="ki-visual-track">
                                                                    <span :style="{ width: item.width, background: item.color }"></span>
                                                                </div>
                                                                <small>{{ item.percentLabel }}</small>
                                                            </div>
                                                        </div>
                                                        <apexchart
                                                            height="285"
                                                            width="100%"
                                                            :type="activeChartType"
                                                            :options="distributionAnalyticsOptions"
                                                            :series="distributionAnalyticsSeries"
                                                        />
                                                    </div>
                                                    <div class="ki-chart-pane">
                                                        <div class="ki-chart-pane-title">
                                                            <span>{{ analyticsSecondaryLabel }}</span>
                                                            <small>{{ summaryMode === 'KSE' ? 'Status Pengisian' : (summaryMode === 'CSIRT' ? 'Status Pembentukan' : 'Rata-rata Nilai') }}</small>
                                                        </div>
                                                        <div class="ki-visual-strip">
                                                            <div
                                                                v-for="item in completionVisualItems"
                                                                :key="'comp-visual-' + item.label"
                                                                class="ki-visual-pill"
                                                            >
                                                                <div class="ki-visual-pill-top">
                                                                    <span class="ki-visual-dot" :style="{ background: item.color }"></span>
                                                                    <span class="ki-visual-label">{{ item.label }}</span>
                                                                </div>
                                                                <div class="ki-visual-value">{{ item.value.toLocaleString('id-ID') }}</div>
                                                                <div class="ki-visual-track">
                                                                    <span :style="{ width: item.width, background: item.color }"></span>
                                                                </div>
                                                                <small>{{ item.percentLabel }}</small>
                                                            </div>
                                                        </div>
                                                        <apexchart
                                                            height="285"
                                                            width="100%"
                                                            :type="completionChartType"
                                                            :options="completionAnalyticsOptions"
                                                            :series="completionAnalyticsSeries"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Right Panel: Category Breakdown + Insight -->
                                    <div class="col-xl-4 animate-show-up" style="animation-delay: 0.25s">
                                        <div class="ki-side-panel h-100">
                                            <!-- Category Breakdown -->
                                            <div class="ki-breakdown">
                                                <div class="ki-bp-header">
                                                    <span class="ki-bp-badge">
                                                        <i :class="summaryMode === 'KSE' ? 'ri-shield-star-line' : (summaryMode === 'CSIRT' ? 'ri-shield-check-line' : 'ri-bar-chart-box-line')"></i>
                                                        {{ summaryMode === 'KSE' ? 'Kategori SE' : (summaryMode === 'CSIRT' ? 'Kelengkapan CSIRT' : 'Level Kematangan') }}
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
                                                <div class="ki-bp-items" v-else-if="summaryMode === 'IKAS'">
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
                                                <div class="ki-bp-items" v-else>
                                                    <div v-for="(item, ci) in [
                                                        { label: 'Lengkap', value: csirtData.lengkap, total: csirtData.total_csirt, color: '#26bf94', icon: 'ri-checkbox-circle-fill' },
                                                        { label: 'Belum Lengkap', value: csirtData.belum_lengkap, total: csirtData.total_csirt, color: '#f5b849', icon: 'ri-error-warning-fill' },
                                                        { label: 'Punya SDM', value: csirtData.punya_sdm, total: csirtData.total_csirt, color: '#0ea5e9', icon: 'ri-team-fill' },
                                                        { label: 'Punya SE', value: csirtData.punya_se, total: csirtData.total_csirt, color: '#6366f1', icon: 'ri-git-branch-fill' }
                                                    ]" :key="item.label" class="ki-bp-row" :style="{ animationDelay: (ci * 0.08) + 's' }">
                                                        <div class="ki-bp-left">
                                                            <div class="ki-bp-icon" :style="{ background: item.color + '18', color: item.color }">
                                                                <i :class="item.icon"></i>
                                                            </div>
                                                            <div>
                                                                <div class="ki-bp-label">{{ item.label }}</div>
                                                                <div class="ki-bp-count">{{ item.value }} <span>CSIRT</span></div>
                                                            </div>
                                                        </div>
                                                        <div class="ki-bp-bar-wrap">
                                                            <div class="ki-bp-bar">
                                                                <div class="ki-bp-bar-fill" :style="{ width: (item.total ? Math.max(3, (item.value / item.total) * 100) : 0) + '%', background: `linear-gradient(90deg, ${item.color}88, ${item.color})` }"></div>
                                                            </div>
                                                            <span class="ki-bp-pct" :style="{ color: item.color }">{{ item.total ? Math.round((item.value / item.total) * 100) : 0 }}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- IKAS Domain Scores or KSE Insight -->
                                            <div class="ki-insight-box">
                                                <template v-if="summaryMode === 'IKAS'">
                                                    <div class="ki-domain-header">
                                                        <i class="ri-focus-3-line"></i> Agregasi IKAS
                                                    </div>
                                                    <div class="ki-domain-grid">
                                                        <div v-for="(dom, di) in [
                                                            { key: 'avgNilaiKematangan', label: 'Rata-rata Kematangan', icon: 'ri-line-chart-line', color: '#3b82f6' },
                                                            { key: 'avgTargetNilai', label: 'Rata-rata Target', icon: 'ri-focus-3-line', color: '#0ea5e9' }
                                                        ]" :key="dom.key" class="ki-domain-item">
                                                            <div class="ki-domain-icon" :style="{ background: dom.color + '15', color: dom.color }">
                                                                <i :class="dom.icon"></i>
                                                            </div>
                                                            <div class="ki-domain-info">
                                                                <span class="ki-domain-label">{{ dom.label }}</span>
                                                                <div class="ki-domain-score-bar">
                                                                    <div class="ki-domain-fill" :style="{ width: Math.min(100, (Number(ikasSummaryData[dom.key]) / 5) * 100) + '%', background: dom.color }"></div>
                                                                </div>
                                                            </div>
                                                            <span class="ki-domain-val" :style="{ color: dom.color }">{{ Number(ikasSummaryData[dom.key] || 0).toFixed(2) }}</span>
                                                        </div>
                                                    </div>
                                                </template>
                                                <template v-else-if="summaryMode === 'KSE'">
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
                                                <template v-else>
                                                    <div class="ki-insight-content">
                                                        <div class="ki-insight-icon-wrap">
                                                            <i class="ri-shield-check-fill"></i>
                                                        </div>
                                                        <h6 class="ki-insight-title">Analisa Pembentukan</h6>
                                                        <p class="ki-insight-text">
                                                            Terdapat <strong>{{ csirtData.lengkap }}</strong> CSIRT lengkap dari total <strong>{{ csirtData.total_csirt }}</strong> CSIRT pada periode aktif.
                                                        </p>
                                                        <div class="ki-insight-tip">
                                                            <i class="ri-information-line"></i>
                                                            <span>CSIRT lengkap minimal memiliki data SDM dan Sistem Elektronik</span>
                                                        </div>
                                                    </div>
                                                </template>
                                                <button class="ki-export-btn" @click="router.push(activeDetailRoute)">
                                                    <i class="ri-external-link-line"></i> Lihat Detail {{ summaryMode }}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-if="!lowerSectionsReady" class="row g-3 mb-4">
                        <div class="col-xl-8">
                            <div class="card custom-card border-0 shadow-sm" style="min-height: 420px;">
                                <div class="card-body placeholder-glow">
                                    <div class="d-flex align-items-center justify-content-between mb-4">
                                        <div class="d-flex align-items-center gap-2">
                                            <span class="placeholder" style="width:42px;height:42px;border-radius:10px;"></span>
                                            <span class="placeholder col-4" style="height:18px;border-radius:6px;"></span>
                                        </div>
                                        <span class="placeholder col-2" style="height:32px;border-radius:10px;"></span>
                                    </div>
                                    <span class="placeholder col-12 mb-3" style="height:180px;border-radius:14px;"></span>
                                    <div class="row g-3">
                                        <div class="col-md-4" v-for="n in 3" :key="'analysis-skeleton-'+n">
                                            <span class="placeholder col-12 mb-2" style="height:70px;border-radius:12px;"></span>
                                            <span class="placeholder col-8" style="height:12px;border-radius:6px;"></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-xl-4">
                            <div class="card custom-card border-0 shadow-sm" style="min-height: 420px;">
                                <div class="card-body placeholder-glow">
                                    <span class="placeholder col-7 mb-4" style="height:18px;border-radius:6px;"></span>
                                    <div v-for="n in 5" :key="'side-skeleton-'+n" class="d-flex align-items-center gap-3 mb-3">
                                        <span class="placeholder" style="width:38px;height:38px;border-radius:10px;"></span>
                                        <div class="flex-grow-1">
                                            <span class="placeholder col-8 d-block mb-2" style="height:12px;border-radius:6px;"></span>
                                            <span class="placeholder col-5 d-block" style="height:10px;border-radius:6px;"></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                </template>

                <!-- ANALISIS STAKEHOLDER PER SEKTOR -->
                <SektorAnalytics
                    v-if="lowerSectionsReady"
                    :sektor-list="sektorList"
                    :sub-sektor-list="subSektorList"
                />

                <!-- RADAR CHARTS -->
                <div v-if="lowerSectionsReady" class="animate-show-up" :style="{ animationDelay: isFirstLoad ? '3.6s' : '0s' }">
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

    /*  Header Filter  */
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

    /*  Card Animation  */
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

    /*  Rate Card  */
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

    /*  Sektor Table  */
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

    /*  Summary Mode Switcher  */
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

    /*  Analytics Styles  */
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

    /* ” SektorAnalytics Style Clones for KSE/IKAS ” */
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

    /* • KSE/IKAS PREMIUM REDESIGN • */

    .kse-ikas-analytics {
        --ki-brand: #2563eb;
        --ki-brand-deep: #102a7a;
        --ki-cyan: #06b6d4;
        --ki-ink: #111827;
        --ki-muted: #69758c;
        --ki-line: #dbe5f3;
        --ki-soft: #f7faff;
        --ki-shadow: 0 18px 48px rgba(23, 37, 84, 0.09);
    }

    .ki-command-center {
        background: #ffffff;
        border: 1px solid var(--ki-line);
        border-radius: 18px;
        box-shadow: var(--ki-shadow);
        overflow: hidden;
    }

    .ki-command-center .ki-main-header {
        border: 0;
        border-bottom: 0;
        border-radius: 0;
        box-shadow: none;
    }

    .ki-command-center:not(:has(.ki-hero-banner)) .ki-main-header {
        border-bottom: 0;
    }

    .ki-command-center .ki-hero-banner {
        border: 0;
        border-radius: 0;
        box-shadow: none;
        border-top: 1px solid rgba(219, 229, 243, 0.85);
    }

    /*  Main Header  */
    .ki-main-header {
        display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
        background:
            linear-gradient(135deg, #132f99 0%, #1d4ed8 54%, #3b82f6 100%);
        border: 1px solid var(--ki-line);
        border-radius: 14px;
        padding: 13px 16px;
        box-shadow: var(--ki-shadow);
        position: relative;
        overflow: hidden;
    }
    .ki-main-header::before {
        content: "";
        position: absolute;
        inset: 0;
        width: auto;
        background:
            linear-gradient(90deg, rgba(255,255,255,0.14), transparent 34%),
            radial-gradient(circle at 88% 50%, rgba(255,255,255,0.12), transparent 26%);
        pointer-events: none;
    }
    .ki-header-left { display: flex; align-items: center; gap: 10px; min-width: 0; position: relative; z-index: 1; }
    .ki-header-icon {
        width: 38px; height: 38px; border-radius: 11px; background: rgba(255,255,255,0.14);
        display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.1rem;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12);
    }
    .ki-header-title { font-size: 1.04rem; font-weight: 900; color: #fff; margin: 0; white-space: nowrap; }
    
    .ki-segmented-control {
        display: flex; background: rgba(10, 34, 111, 0.28); padding: 4px; border-radius: 11px; gap: 2px;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12);
    }
    .ki-seg-btn {
        background: transparent; border: none; color: rgba(255,255,255,0.72); font-size: 0.75rem;
        font-weight: 900; padding: 7px 18px; border-radius: 9px; cursor: pointer; transition: all 0.2s;
    }
    .ki-seg-btn.active { background: #fff; color: var(--ki-brand); box-shadow: 0 8px 20px rgba(15, 23, 42, 0.16); }
    
    .ki-header-right { display: flex; align-items: center; gap: 10px; min-width: 0; position: relative; z-index: 1; }
    .ki-inline-filters { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
    .ki-filter-pill {
        background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.32); color: #fff;
        font-size: 0.68rem; font-weight: 900; padding: 7px 12px; border-radius: 999px;
        cursor: pointer; transition: all 0.2s;
    }
    .ki-filter-pill:hover { background: rgba(255,255,255,0.16); border-color: rgba(255,255,255,0.55); color: #fff; }
    .ki-filter-pill.active { background: #fff; color: var(--ki-brand); border-color: transparent; box-shadow: 0 8px 18px rgba(15,23,42,0.18); }
    
    .ki-divider { width: 1px; height: 24px; background: rgba(255,255,255,0.22); }
    
    .ki-view-toggles { display: flex; gap: 4px; }
    .ki-view-btn {
        width: 34px; height: 34px; border: 1px solid rgba(255,255,255,0.24); background: rgba(255,255,255,0.1); color: #fff;
        border-radius: 8px; display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.2s;
    }
    .ki-view-btn.active { background: #fff; color: var(--ki-brand); border-color: #fff; }

    /*  Metric Card  */
    .ki-metric-card {
        position: relative; border-radius: 12px; overflow: hidden; cursor: pointer;
        background: #fff; border: 1px solid rgba(0,0,0,0.06);
        box-shadow: var(--ki-shadow); transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .ki-metric-card:hover { transform: translateY(-3px); box-shadow: 0 18px 38px rgba(28,46,86,0.13); }
    .ki-metric-accent { height: 3px; width: 100%; }
    .ki-metric-watermark {
        position: absolute; right: -8px; top: -8px; opacity: 0.04;
        font-size: 5rem; color: var(--ki-accent, #333); pointer-events: none;
        transform: rotate(-15deg);
    }
    .ki-metric-body { padding: 0.9rem 1rem; position: relative; z-index: 1; }
    .ki-metric-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.7rem; }
    .ki-metric-icon-wrap {
        width: 36px; height: 36px; border-radius: 10px;
        display: flex; align-items: center; justify-content: center; font-size: 1.1rem;
    }
    .ki-metric-active-badge {
        font-size: 0.65rem; font-weight: 800; color: #fff; background: #2563eb;
        padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .ki-metric-value {
        font-size: 1.45rem; font-weight: 900; color: var(--ki-ink);
        letter-spacing: -0.5px; line-height: 1; margin-bottom: 6px;
    }
    .ki-metric-label {
        font-size: 0.67rem; font-weight: 800; color: #8b98ad;
        text-transform: uppercase; letter-spacing: 0.5px;
    }
    .ki-metric-active { border: 1px solid #2563eb !important; transform: translateY(-3px); box-shadow: 0 15px 32px rgba(37,99,235,0.15) !important; }
    .ki-metric-muted { opacity: 0.4; filter: grayscale(85%); cursor: not-allowed !important; transform: none !important; }
    .ki-metric-muted * { pointer-events: none; }

    /*  Hero Banner  */
    .ki-hero-banner {
        position: relative; border-radius: 16px; overflow: hidden;
        background:
            radial-gradient(circle at 10% 18%, rgba(37,99,235,0.1), transparent 26%),
            radial-gradient(circle at 92% 16%, rgba(6,182,212,0.11), transparent 24%),
            linear-gradient(135deg, #ffffff 0%, #f7fbff 58%, #eef9ff 100%);
        border: 1px solid var(--ki-line);
        box-shadow: 0 22px 54px rgba(15, 23, 42, 0.08);
        padding: 0.65rem 1rem;
    }
    .ki-hero-glow {
        display: block;
        position: absolute;
        inset: 0;
        background:
            linear-gradient(90deg, rgba(37,99,235,0.045), transparent 34%),
            radial-gradient(circle at 88% 20%, rgba(6,182,212,0.12), transparent 32%);
        opacity: 0.9;
        pointer-events: none;
    }
    .ki-hero-inner {
        position: relative; z-index: 1;
        display: flex; align-items: center; gap: 0.9rem; flex-wrap: wrap;
        min-height: 72px;
    }

    /*  SVG Ring  */
    .ki-ring-wrap {
        position: relative; width: 68px; height: 68px; flex-shrink: 0;
    }
    .ki-ring-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ki-ring-progress { transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1); }
    .ki-ring-label {
        position: absolute; inset: 0; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
    }
    .ki-ring-value { font-size: 1.05rem; font-weight: 900; color: var(--ki-ink); line-height: 1; }
    .ki-ring-sub { font-size: 0.49rem; font-weight: 900; color: #8b98ad; text-transform: uppercase; letter-spacing: 0.5px; }

    /*  Hero Stats  */
    .ki-hero-stats { flex: 1; min-width: 200px; }
    .ki-hero-title { font-size: 0.98rem; font-weight: 900; color: var(--ki-ink); margin: 0 0 1px; }
    .ki-hero-desc { font-size: 0.68rem; color: var(--ki-muted); margin: 0 0 7px; }
    .ki-hero-pills { display: flex; gap: 6px; flex-wrap: wrap; }
    .ki-pill {
        display: flex; align-items: center; gap: 6px; padding: 6px 10px;
        border-radius: 10px; font-size: 0.68rem; border: 1px solid rgba(203, 213, 225, 0.82);
        min-height: 34px;
        background: linear-gradient(135deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.86) 100%);
        color: #334155;
        box-shadow:
            0 9px 22px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255,255,255,0.86);
        backdrop-filter: blur(8px);
    }
    .ki-pill i { font-size: 0.84rem; }
    .ki-pill span { font-weight: 900; font-size: 0.9rem; }
    .ki-pill small { font-size: 0.54rem; font-weight: 850; opacity: 0.82; text-transform: uppercase; letter-spacing: 0.35px; }
    .ki-pill-success {
        color: #047857;
        background: linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.88) 100%);
        border-color: rgba(16,185,129,0.32);
        box-shadow: 0 9px 22px rgba(15,23,42,0.08), inset 0 0 0 1px rgba(16,185,129,0.08);
    }
    .ki-pill-danger {
        color: #dc2626;
        background: linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.88) 100%);
        border-color: rgba(239,68,68,0.32);
        box-shadow: 0 9px 22px rgba(15,23,42,0.08), inset 0 0 0 1px rgba(239,68,68,0.08);
    }
    .ki-pill-info {
        color: #1d4ed8;
        background: linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.88) 100%);
        border-color: rgba(37,99,235,0.32);
        box-shadow: 0 9px 22px rgba(15,23,42,0.08), inset 0 0 0 1px rgba(37,99,235,0.08);
    }

    .ki-hero-cta {
        background: #fff; color: #102a7a; border: 1px solid #d5e2f5;
        padding: 8px 16px; border-radius: 11px;
        font-size: 0.72rem; font-weight: 900; cursor: pointer; transition: all 0.25s;
        display: flex; align-items: center; gap: 6px; white-space: nowrap; flex-shrink: 0;
        box-shadow: 0 12px 28px rgba(37, 99, 235, 0.1);
    }
    .ki-hero-cta:hover { background: #f1f5f9; border-color: #cbd5e1; transform: translateY(-2px); }
    .ki-hero-cta i { font-size: 1rem; }

    /*  Chart Card  */
    .ki-chart-card {
        border-radius: 18px; overflow: hidden; background: #fff;
        border: 1px solid var(--ki-line); box-shadow: var(--ki-shadow);
        display: flex; flex-direction: column;
    }
    .ki-chart-header {
        padding: 1rem 1.1rem; display: flex; align-items: center;
        justify-content: space-between; gap: 12px; flex-wrap: wrap;
        background: #ffffff;
        border-bottom: 1px solid var(--ki-line);
    }
    .ki-chart-header-compact {
        padding: 0.85rem 0.95rem;
        gap: 8px;
    }
    .ki-chart-header-left { display: flex; align-items: center; gap: 9px; }
    .ki-chart-icon-wrap {
        width: 42px; height: 42px; border-radius: 12px;
        background: linear-gradient(135deg, var(--ki-brand-deep) 0%, #0ea5e9 100%);
        display: flex; align-items: center; justify-content: center;
        color: #fff; font-size: 1.12rem; flex-shrink: 0;
    }
    .ki-chart-header-compact .ki-chart-icon-wrap { width: 38px; height: 38px; border-radius: 11px; }
    .ki-chart-icon-wrap-soft { background: linear-gradient(135deg, #1d4ed8 0%, #22c55e 100%); }
    .ki-chart-title { font-size: 1rem; font-weight: 900; color: var(--ki-ink); }
    .ki-chart-sub { font-size: 0.72rem; color: #7b879a; margin-top: 2px; }
    .ki-chart-controls { display: flex; align-items: center; gap: 7px; }
    .ki-view-toggle {
        display: flex; background: #f1f6ff; border: 1px solid #dbeafe;
        border-radius: 11px; padding: 4px; gap: 3px;
    }
    .ki-vt-btn {
        border: none; background: transparent; padding: 7px 15px; border-radius: 8px;
        font-size: 0.72rem; font-weight: 900; color: #8190a7; cursor: pointer;
        transition: all 0.2s;
    }
    .ki-vt-btn.active { background: var(--ki-brand); color: #fff; box-shadow: 0 6px 14px rgba(30,64,175,0.22); }
    .ki-chart-type-toggle { display: flex; gap: 3px; background: #eef4fc; border-radius: 11px; padding: 4px; }
    .ki-ct-btn {
        width: 34px; height: 34px; border: none; border-radius: 8px; background: transparent;
        color: #94a3b8; display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.2s; font-size: 0.94rem;
    }
    .ki-ct-btn.active { background: #fff; color: var(--ki-brand); box-shadow: 0 2px 8px rgba(28,46,86,0.08); }
    .ki-chart-body {
        padding: 1.05rem 1rem 1.15rem;
        background-color: #fbfdff;
        background-image: linear-gradient(180deg, #ffffff 0%, rgba(251,253,255,0.9) 100%);
    }
    .ki-chart-split-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
        min-height: 390px;
        align-items: stretch;
    }
    .ki-chart-pane {
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 0.35rem 0.5rem 0.25rem;
    }
    .ki-chart-pane + .ki-chart-pane {
        border-left: 1px solid rgba(219,234,254,0.9);
    }
    .ki-chart-pane-title {
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        padding: 0 0.35rem 0.35rem;
    }
    .ki-chart-pane-title span {
        font-size: 0.82rem; font-weight: 900; color: #172554;
    }
    .ki-chart-pane-title small {
        font-size: 0.65rem; font-weight: 800; color: #8090a8;
        white-space: nowrap;
    }
    .ki-chart-pane :deep(.apexcharts-pie-label) {
        fill: #ffffff;
    }
    .ki-chart-pane :deep(.apexcharts-datalabel-value),
    .ki-chart-pane :deep(.apexcharts-datalabel-label) {
        fill: #172554 !important;
        stroke: none !important;
    }
    .ki-chart-pane :deep(.apexcharts-legend) {
        gap: 2px 8px !important;
        padding-top: 4px !important;
    }
    .ki-chart-pane :deep(.apexcharts-legend-series) {
        align-items: center;
        border: 1px solid rgba(219, 229, 243, 0.86);
        border-radius: 999px;
        display: inline-flex !important;
        min-height: 26px;
        padding: 5px 9px !important;
        background: rgba(255, 255, 255, 0.82);
        box-shadow: 0 6px 14px rgba(15, 23, 42, 0.04);
    }
    .ki-chart-pane :deep(.apexcharts-legend-text) {
        color: #22304a !important;
        font-size: 11px !important;
        font-weight: 850 !important;
        line-height: 1.2;
    }
    .ki-chart-pane :deep(.apexcharts-tooltip) {
        overflow: visible;
        border: 0 !important;
        border-radius: 12px !important;
        box-shadow: 0 14px 32px rgba(15, 23, 42, 0.16) !important;
    }
    .ki-chart-pane :deep(.ki-chart-tooltip) {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 150px;
        padding: 10px 12px;
        background: #fff;
        border: 1px solid rgba(219, 229, 243, 0.9);
        border-radius: 12px;
    }
    .ki-chart-pane :deep(.ki-chart-tooltip-dot) {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        box-shadow: 0 0 0 4px rgba(15, 23, 42, 0.06);
        flex-shrink: 0;
    }
    .ki-chart-pane :deep(.ki-chart-tooltip strong) {
        display: block;
        color: #172554;
        font-size: 12px;
        font-weight: 900;
        line-height: 1.2;
        margin-bottom: 2px;
    }
    .ki-chart-pane :deep(.ki-chart-tooltip small) {
        display: block;
        color: #64748b;
        font-size: 11px;
        font-weight: 800;
        line-height: 1.2;
    }

    /*  Visual Strip / Pills  */
    .ki-visual-strip {
        display: flex; gap: 8px; margin-bottom: 12px; overflow-x: auto; padding-bottom: 4px;
        scrollbar-width: thin; scrollbar-color: rgba(203, 213, 225, 0.5) transparent;
    }
    .ki-visual-pill {
        flex: 1; min-width: 90px; padding: 8px 10px; border-radius: 10px;
        background: #f8fafc; border: 1px solid #e2e8f0; display: flex;
        flex-direction: column; gap: 4px;
    }
    .ki-visual-pill-top {
        display: flex; align-items: center; gap: 5px;
    }
    .ki-visual-dot {
        width: 8px; height: 8px; border-radius: 50%;
    }
    .ki-visual-label {
        font-size: 0.68rem; font-weight: 700; color: #64748b; white-space: nowrap;
        overflow: hidden; text-overflow: ellipsis;
    }
    .ki-visual-value {
        font-size: 1.05rem; font-weight: 900; color: #1e293b; line-height: 1;
    }
    .ki-visual-track {
        height: 4px; width: 100%; background: #e2e8f0; border-radius: 999px;
        margin-top: 2px; overflow: hidden;
    }
    .ki-visual-track span {
        display: block; height: 100%; border-radius: 999px;
        transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .ki-visual-pill small {
        font-size: 0.65rem; font-weight: 800; color: #94a3b8; margin-top: 1px;
    }

    /*  Side Panel  */
    .ki-side-panel {
        display: flex; flex-direction: column; gap: 0.85rem;
    }

    /*  Breakdown Card  */
    .ki-breakdown {
        border-radius: 18px; background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
        border: 1px solid var(--ki-line);
        box-shadow: var(--ki-shadow); padding: 1rem; flex: 1;
    }
    .ki-bp-header { margin-bottom: 0.85rem; }
    .ki-bp-badge {
        display: inline-flex; align-items: center; gap: 6px; font-size: 0.66rem;
        font-weight: 900; color: #102a7a; background: #eef4ff;
        padding: 7px 10px; border-radius: 9px; text-transform: uppercase; letter-spacing: 0.3px;
    }
    .ki-bp-badge i { font-size: 0.82rem; }
    .ki-bp-items { display: flex; flex-direction: column; gap: 8px; }
    .ki-bp-row {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 9px 10px; border-radius: 12px; transition: all 0.2s;
        background: #fff;
        border: 1px solid #eef3f9;
        animation: kiBpSlide 0.4s ease-out both;
    }
    .ki-bp-row:hover { border-color: #dbeafe; box-shadow: 0 10px 22px rgba(23,37,84,0.06); transform: translateY(-1px); }
    @keyframes kiBpSlide { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
    .ki-bp-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .ki-bp-icon {
        width: 32px; height: 32px; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        font-size: 0.96rem; flex-shrink: 0;
    }
    .ki-bp-dot { width: 9px; height: 9px; border-radius: 4px; flex-shrink: 0; }
    .ki-bp-label { font-size: 0.74rem; font-weight: 900; color: #263348; white-space: nowrap; }
    .ki-bp-count { font-size: 0.66rem; font-weight: 800; color: #8a98ad; }
    .ki-bp-count span { font-weight: 500; }
    .ki-bp-bar-wrap { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 80px; }
    .ki-bp-bar { flex: 1; height: 7px; border-radius: 999px; background: #edf2f8; overflow: hidden; }
    .ki-bp-bar-fill { height: 100%; border-radius: 999px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
    .ki-bp-pct { font-size: 0.7rem; font-weight: 900; min-width: 34px; text-align: right; }

    /*  Insight Box  */
    .ki-insight-box {
        border-radius: 18px; overflow: hidden;
        background: linear-gradient(145deg, #ffffff 0%, #f8fbff 100%);
        border: 1px solid var(--ki-line); box-shadow: var(--ki-shadow);
        padding: 1rem; display: flex; flex-direction: column; gap: 0.85rem;
    }
    .ki-domain-header {
        font-size: 0.72rem; font-weight: 900; color: #334155; display: flex;
        align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.3px;
    }
    .ki-domain-header i { font-size: 1rem; color: #3b82f6; }
    .ki-domain-grid { display: flex; flex-direction: column; gap: 9px; }
    .ki-domain-item {
        display: flex; align-items: center; gap: 9px; padding: 9px;
        border-radius: 12px; background: #fff; border: 1px solid #e9f0fb;
        transition: all 0.2s;
    }
    .ki-domain-item:hover { border-color: #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .ki-domain-icon {
        width: 28px; height: 28px; border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        font-size: 0.82rem; flex-shrink: 0;
    }
    .ki-domain-info { flex: 1; min-width: 0; }
    .ki-domain-label { font-size: 0.66rem; font-weight: 750; color: #64748b; margin-bottom: 4px; }
    .ki-domain-score-bar { height: 7px; border-radius: 999px; background: #f1f5f9; overflow: hidden; }
    .ki-domain-fill { height: 100%; border-radius: 999px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
    .ki-domain-val { font-size: 0.95rem; font-weight: 900; flex-shrink: 0; }

    /*  KSE Insight  */
    .ki-insight-content { text-align: center; padding: 0.1rem 0; }
    .ki-insight-icon-wrap {
        width: 42px; height: 42px; border-radius: 12px; margin: 0 auto 9px;
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(251, 191, 36, 0.1));
        display: flex; align-items: center; justify-content: center;
    }
    .ki-insight-icon-wrap i { font-size: 1.22rem; color: #f59e0b; }
    .ki-insight-title { font-size: 0.8rem; font-weight: 900; color: var(--ki-ink); margin: 0 0 6px; }
    .ki-insight-text { font-size: 0.7rem; color: #64748b; line-height: 1.5; margin: 0 0 10px; }
    .ki-insight-tip {
        display: flex; align-items: center; gap: 6px; padding: 7px 10px;
        border-radius: 9px; background: rgba(29,78,216,0.06); border: 1px solid rgba(29,78,216,0.1);
    }
    .ki-insight-tip i { font-size: 0.82rem; color: #3b82f6; flex-shrink: 0; }
    .ki-insight-tip span { font-size: 0.66rem; font-weight: 750; color: #3b82f6; }

    /*  Export Button  */
    .ki-export-btn {
        width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid #c9d8f2;
        background: #fff; color: #273449; font-size: 0.76rem; font-weight: 900;
        cursor: pointer; transition: all 0.25s; display: flex; align-items: center;
        justify-content: center; gap: 6px;
    }
    .ki-export-btn:hover { border-color: #3b82f6; color: #1e40af; background: rgba(30,64,175,0.04); }
    .ki-export-btn i { font-size: 0.9rem; }

    /*  Dark Mode  */
    :global(html[data-theme-mode="dark"]) .page-header-breadcrumb .page-title,
    :global(html.dark) .page-header-breadcrumb .page-title {
        color: #eef4ff;
    }

    :global(html[data-theme-mode="dark"]) #dashboard-capture .card.custom-card,
    :global(html.dark) #dashboard-capture .card.custom-card {
        background: #151a2b;
        border-color: rgba(148, 163, 184, 0.18);
        color: #dbeafe;
        box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
    }

    :global(html[data-theme-mode="dark"]) #dashboard-capture .dashboard-main-card[style],
    :global(html.dark) #dashboard-capture .dashboard-main-card[style] {
        background: #151a2b !important;
    }

    :global(html[data-theme-mode="dark"]) #dashboard-capture .card-header,
    :global(html.dark) #dashboard-capture .card-header {
        background: #171e31;
        border-bottom-color: rgba(148, 163, 184, 0.16);
        color: #e5eefb;
    }

    :global(html[data-theme-mode="dark"]) .dashboard-datepicker-wrapper :deep(.dp__input),
    :global(html.dark) .dashboard-datepicker-wrapper :deep(.dp__input) {
        background: #151a2b;
        border-color: rgba(147, 197, 253, 0.24);
        color: #e5eefb;
    }

    :global(html[data-theme-mode="dark"]) .dashboard-datepicker-wrapper :deep(.dp__input)::placeholder,
    :global(html.dark) .dashboard-datepicker-wrapper :deep(.dp__input)::placeholder {
        color: #7f8da3;
    }

    :global(html[data-theme-mode="dark"] .dp__menu),
    :global(html.dark .dp__menu) {
        background: #151a2b;
        border-color: rgba(148, 163, 184, 0.22);
        color: #e5eefb;
        box-shadow: 0 22px 54px rgba(0, 0, 0, 0.38);
    }

    :global(html[data-theme-mode="dark"] .dp__calendar_header),
    :global(html[data-theme-mode="dark"] .dp__calendar_header_separator),
    :global(html.dark .dp__calendar_header),
    :global(html.dark .dp__calendar_header_separator) {
        color: #cbd5e1;
        border-color: rgba(148, 163, 184, 0.16);
    }

    :global(html[data-theme-mode="dark"] .dp__cell_inner),
    :global(html[data-theme-mode="dark"] .dp__month_year_select),
    :global(html[data-theme-mode="dark"] .dp__button),
    :global(html.dark .dp__cell_inner),
    :global(html.dark .dp__month_year_select),
    :global(html.dark .dp__button) {
        color: #dbeafe;
    }

    :global(html[data-theme-mode="dark"] .dp__cell_inner:hover),
    :global(html[data-theme-mode="dark"] .dp__month_year_select:hover),
    :global(html[data-theme-mode="dark"] .dp__button:hover),
    :global(html.dark .dp__cell_inner:hover),
    :global(html.dark .dp__month_year_select:hover),
    :global(html.dark .dp__button:hover) {
        background: rgba(37, 99, 235, 0.16);
    }

    :global(html[data-theme-mode="dark"] .dp__range_between),
    :global(html.dark .dp__range_between) {
        background: rgba(37, 99, 235, 0.2);
        border-color: rgba(37, 99, 235, 0.12);
    }

    :global(html[data-theme-mode="dark"] .dp__today),
    :global(html.dark .dp__today) {
        border-color: #60a5fa;
    }

    :global(html[data-theme-mode="dark"]) .dp-custom-range,
    :global(html.dark) .dp-custom-range {
        background: #151a2b;
        color: #dbeafe;
    }

    :global(html[data-theme-mode="dark"]) .dp-sidebar-header,
    :global(html.dark) .dp-sidebar-header {
        color: #e5eefb;
    }

    :global(html[data-theme-mode="dark"]) .dp-sidebar-desc,
    :global(html.dark) .dp-sidebar-desc {
        color: #8fa3bf;
    }

    :global(html[data-theme-mode="dark"]) .dp-sidebar-divider,
    :global(html.dark) .dp-sidebar-divider {
        background: rgba(148, 163, 184, 0.18);
    }

    :global(html[data-theme-mode="dark"]) .dp-num-input,
    :global(html[data-theme-mode="dark"]) .dp-unit-select,
    :global(html[data-theme-mode="dark"]) .dp-date-input,
    :global(html.dark) .dp-num-input,
    :global(html.dark) .dp-unit-select,
    :global(html.dark) .dp-date-input {
        background: rgba(15, 23, 42, 0.78);
        border-color: rgba(147, 197, 253, 0.22);
        color: #e5eefb;
    }

    :global(html[data-theme-mode="dark"]) .kse-ikas-analytics,
    :global(html.dark) .kse-ikas-analytics {
        --ki-ink: #eef4ff;
        --ki-muted: #9aaac0;
        --ki-line: rgba(148, 163, 184, 0.2);
        --ki-soft: #111827;
        --ki-shadow: 0 18px 46px rgba(0, 0, 0, 0.28);
        color-scheme: dark;
    }

    :global(html[data-theme-mode="dark"]) .ki-command-center,
    :global(html.dark) .ki-command-center,
    :global(html[data-theme-mode="dark"]) .ki-chart-card,
    :global(html.dark) .ki-chart-card,
    :global(html[data-theme-mode="dark"]) .ki-breakdown,
    :global(html.dark) .ki-breakdown,
    :global(html[data-theme-mode="dark"]) .ki-insight-box,
    :global(html.dark) .ki-insight-box,
    :global(html[data-theme-mode="dark"]) .ki-metric-card,
    :global(html.dark) .ki-metric-card {
        background: linear-gradient(180deg, #151a2b 0%, #111827 100%);
        border-color: rgba(148, 163, 184, 0.2);
        box-shadow: 0 16px 38px rgba(0, 0, 0, 0.28);
    }

    :global(html[data-theme-mode="dark"]) .ki-command-center .ki-hero-banner,
    :global(html.dark) .ki-command-center .ki-hero-banner,
    :global(html[data-theme-mode="dark"]) .ki-chart-header,
    :global(html.dark) .ki-chart-header {
        border-color: rgba(148, 163, 184, 0.18);
    }

    :global(html[data-theme-mode="dark"]) .ki-hero-banner,
    :global(html.dark) .ki-hero-banner {
        background:
            radial-gradient(circle at 10% 18%, rgba(59, 130, 246, 0.18), transparent 30%),
            radial-gradient(circle at 92% 16%, rgba(6, 182, 212, 0.14), transparent 28%),
            linear-gradient(135deg, #151a2b 0%, #121827 58%, #0f172a 100%);
    }

    :global(html[data-theme-mode="dark"]) .ki-chart-header,
    :global(html.dark) .ki-chart-header {
        background: #151a2b;
    }

    :global(html[data-theme-mode="dark"]) .ki-chart-body,
    :global(html.dark) .ki-chart-body {
        background-color: #111827;
        background-image: linear-gradient(180deg, #151a2b 0%, rgba(17, 24, 39, 0.92) 100%);
    }

    :global(html[data-theme-mode="dark"]) .ki-chart-pane + .ki-chart-pane,
    :global(html.dark) .ki-chart-pane + .ki-chart-pane {
        border-left-color: rgba(148, 163, 184, 0.18);
    }

    :global(html[data-theme-mode="dark"]) .ki-ring-svg circle:first-child,
    :global(html.dark) .ki-ring-svg circle:first-child {
        stroke: rgba(148, 163, 184, 0.2);
    }

    :global(html[data-theme-mode="dark"]) .ki-pill,
    :global(html.dark) .ki-pill,
    :global(html[data-theme-mode="dark"]) .ki-visual-pill,
    :global(html.dark) .ki-visual-pill,
    :global(html[data-theme-mode="dark"]) .ki-bp-row,
    :global(html.dark) .ki-bp-row,
    :global(html[data-theme-mode="dark"]) .ki-domain-item,
    :global(html.dark) .ki-domain-item {
        background: rgba(15, 23, 42, 0.72);
        border-color: rgba(148, 163, 184, 0.18);
        color: #dbeafe;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    }

    :global(html[data-theme-mode="dark"]) .ki-chart-type-toggle,
    :global(html.dark) .ki-chart-type-toggle,
    :global(html[data-theme-mode="dark"]) .ki-view-toggle,
    :global(html.dark) .ki-view-toggle {
        background: rgba(15, 23, 42, 0.76);
        border-color: rgba(148, 163, 184, 0.18);
    }

    :global(html[data-theme-mode="dark"]) .ki-ct-btn.active,
    :global(html.dark) .ki-ct-btn.active {
        background: rgba(37, 99, 235, 0.2);
        color: #bfdbfe;
        box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.22);
    }

    :global(html[data-theme-mode="dark"]) .ki-hero-cta,
    :global(html.dark) .ki-hero-cta,
    :global(html[data-theme-mode="dark"]) .ki-export-btn,
    :global(html.dark) .ki-export-btn {
        background: rgba(15, 23, 42, 0.78);
        border-color: rgba(147, 197, 253, 0.24);
        color: #dbeafe;
    }

    :global(html[data-theme-mode="dark"]) .ki-hero-cta:hover,
    :global(html.dark) .ki-hero-cta:hover,
    :global(html[data-theme-mode="dark"]) .ki-export-btn:hover,
    :global(html.dark) .ki-export-btn:hover {
        background: rgba(37, 99, 235, 0.16);
        border-color: rgba(96, 165, 250, 0.5);
        color: #ffffff;
    }

    :global(html[data-theme-mode="dark"]) .ki-bp-badge,
    :global(html.dark) .ki-bp-badge,
    :global(html[data-theme-mode="dark"]) .ki-insight-tip,
    :global(html.dark) .ki-insight-tip {
        background: rgba(37, 99, 235, 0.14);
        border-color: rgba(96, 165, 250, 0.2);
        color: #93c5fd;
    }

    :global(html[data-theme-mode="dark"]) .ki-bp-bar,
    :global(html.dark) .ki-bp-bar,
    :global(html[data-theme-mode="dark"]) .ki-visual-track,
    :global(html.dark) .ki-visual-track,
    :global(html[data-theme-mode="dark"]) .ki-domain-score-bar,
    :global(html.dark) .ki-domain-score-bar {
        background: rgba(148, 163, 184, 0.18);
    }

    :global(html[data-theme-mode="dark"]) .ki-chart-pane-title span,
    :global(html.dark) .ki-chart-pane-title span,
    :global(html[data-theme-mode="dark"]) .ki-visual-value,
    :global(html.dark) .ki-visual-value,
    :global(html[data-theme-mode="dark"]) .ki-bp-label,
    :global(html.dark) .ki-bp-label,
    :global(html[data-theme-mode="dark"]) .ki-domain-header,
    :global(html.dark) .ki-domain-header,
    :global(html[data-theme-mode="dark"]) .ki-insight-title,
    :global(html.dark) .ki-insight-title {
        color: #eef4ff;
    }

    :global(html[data-theme-mode="dark"]) .ki-chart-pane-title small,
    :global(html.dark) .ki-chart-pane-title small,
    :global(html[data-theme-mode="dark"]) .ki-visual-label,
    :global(html.dark) .ki-visual-label,
    :global(html[data-theme-mode="dark"]) .ki-visual-pill small,
    :global(html.dark) .ki-visual-pill small,
    :global(html[data-theme-mode="dark"]) .ki-bp-count,
    :global(html.dark) .ki-bp-count,
    :global(html[data-theme-mode="dark"]) .ki-domain-label,
    :global(html.dark) .ki-domain-label,
    :global(html[data-theme-mode="dark"]) .ki-insight-text,
    :global(html.dark) .ki-insight-text {
        color: #94a3b8;
    }

    :global(html[data-theme-mode="dark"]) .ki-chart-pane :deep(.apexcharts-datalabel-value),
    :global(html[data-theme-mode="dark"]) .ki-chart-pane :deep(.apexcharts-datalabel-label),
    :global(html.dark) .ki-chart-pane :deep(.apexcharts-datalabel-value),
    :global(html.dark) .ki-chart-pane :deep(.apexcharts-datalabel-label) {
        fill: #dbeafe !important;
    }

    :global(html[data-theme-mode="dark"]) .ki-chart-pane :deep(.apexcharts-legend-series),
    :global(html.dark) .ki-chart-pane :deep(.apexcharts-legend-series) {
        background: rgba(15, 23, 42, 0.74);
        border-color: rgba(148, 163, 184, 0.18);
    }

    :global(html[data-theme-mode="dark"]) .ki-chart-pane :deep(.apexcharts-legend-text),
    :global(html.dark) .ki-chart-pane :deep(.apexcharts-legend-text) {
        color: #dbeafe !important;
    }

    :global(html[data-theme-mode="dark"]) .ki-chart-pane :deep(.ki-chart-tooltip),
    :global(html.dark) .ki-chart-pane :deep(.ki-chart-tooltip),
    :global(html[data-theme-mode="dark"] .ki-chart-tooltip),
    :global(html.dark .ki-chart-tooltip) {
        background: #111827;
        border-color: rgba(148, 163, 184, 0.2);
    }

    :global(html[data-theme-mode="dark"]) .ki-chart-pane :deep(.ki-chart-tooltip strong),
    :global(html.dark) .ki-chart-pane :deep(.ki-chart-tooltip strong),
    :global(html[data-theme-mode="dark"] .ki-chart-tooltip strong),
    :global(html.dark .ki-chart-tooltip strong) {
        color: #eef4ff;
    }

    :global(html[data-theme-mode="dark"]) .ki-chart-pane :deep(.ki-chart-tooltip small),
    :global(html.dark) .ki-chart-pane :deep(.ki-chart-tooltip small),
    :global(html[data-theme-mode="dark"] .ki-chart-tooltip small),
    :global(html.dark .ki-chart-tooltip small) {
        color: #94a3b8;
    }

    /*  Dashboard-root dark layer  */
    .dashboard-capture.is-dark {
        color-scheme: dark;
    }

    .dashboard-capture.is-dark .bg-light {
        background-color: #111827 !important;
    }

    .dashboard-capture.is-dark .btn-white,
    .dashboard-capture.is-dark .summary-mode-switcher-alt,
    .dashboard-capture.is-dark .fs-filter-pill-alt,
    .dashboard-capture.is-dark .sa-view-btn.active,
    .dashboard-capture.is-dark .sm-btn.active {
        background: rgba(15, 23, 42, 0.86) !important;
        border-color: rgba(147, 197, 253, 0.24) !important;
        color: #dbeafe !important;
    }

    .dashboard-capture.is-dark .btn-white:hover {
        background: rgba(37, 99, 235, 0.16) !important;
        border-color: rgba(96, 165, 250, 0.52) !important;
        color: #ffffff !important;
    }

    .dashboard-capture.is-dark .fs-filter-pill-alt.active,
    .dashboard-capture.is-dark .sm-btn.active {
        background: #2563eb !important;
        border-color: #60a5fa !important;
        color: #ffffff !important;
    }

    .dashboard-capture.is-dark .sa-stat-card {
        background: linear-gradient(180deg, #151a2b 0%, #111827 100%) !important;
        border-color: rgba(148, 163, 184, 0.2) !important;
        box-shadow: 0 16px 38px rgba(0, 0, 0, 0.26) !important;
        color: #dbeafe !important;
    }

    .dashboard-capture.is-dark .sa-stat-blue,
    .dashboard-capture.is-dark .sa-stat-emerald,
    .dashboard-capture.is-dark .sa-stat-teal,
    .dashboard-capture.is-dark .sa-stat-amber {
        border-color: rgba(148, 163, 184, 0.18) !important;
    }

    .dashboard-capture.is-dark .sa-stat-blue {
        background: linear-gradient(135deg, rgba(37, 99, 235, 0.18) 0%, rgba(15, 23, 42, 0.95) 100%) !important;
        color: #bfdbfe !important;
    }

    .dashboard-capture.is-dark .sa-stat-emerald {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(15, 23, 42, 0.95) 100%) !important;
        color: #c7f9e7 !important;
    }

    .dashboard-capture.is-dark .sa-stat-teal {
        background: linear-gradient(135deg, rgba(20, 184, 166, 0.18) 0%, rgba(15, 23, 42, 0.95) 100%) !important;
        color: #b6f7ef !important;
    }

    .dashboard-capture.is-dark .sa-stat-amber {
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(15, 23, 42, 0.95) 100%) !important;
        color: #fde68a !important;
    }

    .dashboard-capture.is-dark .sa-view-btn.active {
        color: #eef4ff !important;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.34) !important;
    }

    .dashboard-capture.is-dark .summary-mode-switcher-alt {
        background: rgba(15, 23, 42, 0.66) !important;
    }

    .dashboard-capture.is-dark .ki-seg-btn.active,
    .dashboard-capture.is-dark .ki-filter-pill.active,
    .dashboard-capture.is-dark .ki-view-btn.active,
    .dashboard-capture.is-dark .ki-vt-btn.active {
        background: rgba(15, 23, 42, 0.88) !important;
        border-color: rgba(147, 197, 253, 0.3) !important;
        color: #eef4ff !important;
        box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.14), 0 10px 24px rgba(0, 0, 0, 0.18) !important;
    }

    .dashboard-capture.is-dark .ki-command-center,
    .dashboard-capture.is-dark .ki-chart-card,
    .dashboard-capture.is-dark .ki-breakdown,
    .dashboard-capture.is-dark .ki-insight-box,
    .dashboard-capture.is-dark .ki-metric-card {
        background: linear-gradient(180deg, #151a2b 0%, #111827 100%) !important;
        border-color: rgba(148, 163, 184, 0.22) !important;
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.3) !important;
    }

    .dashboard-capture.is-dark .ki-hero-banner {
        background:
            radial-gradient(circle at 10% 18%, rgba(59, 130, 246, 0.18), transparent 30%),
            radial-gradient(circle at 92% 16%, rgba(34, 211, 238, 0.15), transparent 28%),
            linear-gradient(135deg, #151a2b 0%, #121827 58%, #0f172a 100%) !important;
        border-color: rgba(148, 163, 184, 0.18) !important;
    }

    .dashboard-capture.is-dark .ki-chart-header,
    .dashboard-capture.is-dark .ki-chart-body {
        background: #151a2b !important;
        border-color: rgba(148, 163, 184, 0.18) !important;
    }

    .dashboard-capture.is-dark .ki-chart-body {
        background-image: linear-gradient(180deg, #151a2b 0%, rgba(17, 24, 39, 0.95) 100%) !important;
    }

    .dashboard-capture.is-dark .ki-pill,
    .dashboard-capture.is-dark .ki-visual-pill,
    .dashboard-capture.is-dark .ki-bp-row,
    .dashboard-capture.is-dark .ki-domain-item {
        background: rgba(15, 23, 42, 0.82) !important;
        border-color: rgba(148, 163, 184, 0.2) !important;
        color: #dbeafe !important;
    }

    .dashboard-capture.is-dark .ki-chart-type-toggle,
    .dashboard-capture.is-dark .ki-view-toggle,
    .dashboard-capture.is-dark .ki-hero-cta,
    .dashboard-capture.is-dark .ki-export-btn {
        background: rgba(15, 23, 42, 0.84) !important;
        border-color: rgba(147, 197, 253, 0.24) !important;
        color: #dbeafe !important;
    }

    .dashboard-capture.is-dark .ki-ct-btn.active,
    .dashboard-capture.is-dark .ki-hero-cta:hover,
    .dashboard-capture.is-dark .ki-export-btn:hover {
        background: rgba(37, 99, 235, 0.22) !important;
        border-color: rgba(96, 165, 250, 0.5) !important;
        color: #ffffff !important;
    }

    .dashboard-capture.is-dark .ki-chart-pane + .ki-chart-pane {
        border-left-color: rgba(148, 163, 184, 0.18) !important;
    }

    .dashboard-capture.is-dark .ki-chart-pane-title span,
    .dashboard-capture.is-dark .ki-visual-value,
    .dashboard-capture.is-dark .ki-bp-label,
    .dashboard-capture.is-dark .ki-domain-header,
    .dashboard-capture.is-dark .ki-insight-title,
    .dashboard-capture.is-dark .ki-ring-value,
    .dashboard-capture.is-dark .ki-hero-title,
    .dashboard-capture.is-dark .ki-chart-title,
    .dashboard-capture.is-dark .ki-metric-value {
        color: #eef4ff !important;
    }

    .dashboard-capture.is-dark .ki-chart-pane-title small,
    .dashboard-capture.is-dark .ki-visual-label,
    .dashboard-capture.is-dark .ki-visual-pill small,
    .dashboard-capture.is-dark .ki-bp-count,
    .dashboard-capture.is-dark .ki-domain-label,
    .dashboard-capture.is-dark .ki-insight-text,
    .dashboard-capture.is-dark .ki-ring-sub,
    .dashboard-capture.is-dark .ki-hero-desc,
    .dashboard-capture.is-dark .ki-chart-sub,
    .dashboard-capture.is-dark .ki-metric-label {
        color: #94a3b8 !important;
    }

    .dashboard-capture.is-dark .ki-bp-bar,
    .dashboard-capture.is-dark .ki-visual-track,
    .dashboard-capture.is-dark .ki-domain-score-bar {
        background: rgba(148, 163, 184, 0.18) !important;
    }

    .dashboard-capture.is-dark :deep(.apexcharts-canvas),
    .dashboard-capture.is-dark :deep(.apexcharts-svg) {
        background: transparent !important;
    }

    .dashboard-capture.is-dark :deep(.apexcharts-text),
    .dashboard-capture.is-dark :deep(.apexcharts-datalabel-label),
    .dashboard-capture.is-dark :deep(.apexcharts-datalabel-value),
    .dashboard-capture.is-dark :deep(.apexcharts-legend-text) {
        fill: #dbeafe !important;
        color: #dbeafe !important;
    }

    .dashboard-capture.is-dark :deep(.apexcharts-gridline),
    .dashboard-capture.is-dark :deep(.apexcharts-xaxis line),
    .dashboard-capture.is-dark :deep(.apexcharts-yaxis line) {
        stroke: rgba(148, 163, 184, 0.18) !important;
    }

    .dashboard-capture.is-dark :deep(.sa-section-header) {
        border-color: rgba(147, 197, 253, 0.45) !important;
        box-shadow: 0 16px 36px rgba(37, 99, 235, 0.26) !important;
    }

    .dashboard-capture.is-dark :deep(.sa-filter-bar),
    .dashboard-capture.is-dark :deep(.sa-level-toggle-bar),
    .dashboard-capture.is-dark :deep(.sa-chart-card),
    .dashboard-capture.is-dark :deep(.sa-table-card),
    .dashboard-capture.is-dark :deep(.sa-substakeholder-panel),
    .dashboard-capture.is-dark :deep(.sa-sektor-card),
    .dashboard-capture.is-dark :deep(.sa-empty-cards) {
        background: #151a2b !important;
        border-color: rgba(148, 163, 184, 0.22) !important;
        box-shadow: 0 16px 38px rgba(0, 0, 0, 0.26) !important;
    }

    .dashboard-capture.is-dark :deep(.sa-filter-header),
    .dashboard-capture.is-dark :deep(.sa-chart-header),
    .dashboard-capture.is-dark :deep(.sa-sektor-card-header) {
        background: linear-gradient(180deg, rgba(23, 30, 48, 0.98), rgba(21, 26, 43, 0.96)) !important;
        border-color: rgba(148, 163, 184, 0.18) !important;
    }

    .dashboard-capture.is-dark :deep(.sa-filter-controls),
    .dashboard-capture.is-dark :deep(.sa-chart-body),
    .dashboard-capture.is-dark :deep(.sa-table-body),
    .dashboard-capture.is-dark :deep(.sa-sektor-card-body),
    .dashboard-capture.is-dark :deep(.sa-active-filters) {
        background: #111827 !important;
        border-color: rgba(148, 163, 184, 0.18) !important;
    }

    .dashboard-capture.is-dark :deep(.sa-search-input),
    .dashboard-capture.is-dark :deep(.sa-filter-select),
    .dashboard-capture.is-dark :deep(.sa-sort-btn),
    .dashboard-capture.is-dark :deep(.sa-reset-btn),
    .dashboard-capture.is-dark :deep(.sa-result-count),
    .dashboard-capture.is-dark :deep(.sa-level-toggle-group),
    .dashboard-capture.is-dark :deep(.sa-level-btn) {
        background: rgba(15, 23, 42, 0.88) !important;
        border-color: rgba(147, 197, 253, 0.24) !important;
        color: #dbeafe !important;
        color-scheme: dark;
    }

    .dashboard-capture.is-dark :deep(.sa-search-input::placeholder) {
        color: #7f8da3 !important;
    }

    .dashboard-capture.is-dark :deep(.sa-search-input:focus),
    .dashboard-capture.is-dark :deep(.sa-filter-select:focus) {
        border-color: #60a5fa !important;
        box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.16) !important;
    }

    .dashboard-capture.is-dark :deep(.sa-level-btn.active),
    .dashboard-capture.is-dark :deep(.sa-sort-btn:hover) {
        background: #2563eb !important;
        border-color: #60a5fa !important;
        color: #ffffff !important;
    }

    .dashboard-capture.is-dark :deep(.sa-filter-title-wrap),
    .dashboard-capture.is-dark :deep(.sa-filter-title),
    .dashboard-capture.is-dark :deep(.sa-chart-title),
    .dashboard-capture.is-dark :deep(.sa-level-toggle-label),
    .dashboard-capture.is-dark :deep(.sa-sektor-name),
    .dashboard-capture.is-dark :deep(.sa-sektor-card-title),
    .dashboard-capture.is-dark :deep(.sa-substakeholder-title),
    .dashboard-capture.is-dark :deep(.sa-stakeholder-name) {
        color: #eef4ff !important;
    }

    .dashboard-capture.is-dark :deep(.sa-filter-label),
    .dashboard-capture.is-dark :deep(.sa-chart-sub),
    .dashboard-capture.is-dark :deep(.sa-section-subtitle),
    .dashboard-capture.is-dark :deep(.sa-level-info),
    .dashboard-capture.is-dark :deep(.sa-active-label),
    .dashboard-capture.is-dark :deep(.sa-sektor-card-code),
    .dashboard-capture.is-dark :deep(.sa-substakeholder-sub),
    .dashboard-capture.is-dark :deep(.sa-stakeholder-meta),
    .dashboard-capture.is-dark :deep(.sa-empty-chart),
    .dashboard-capture.is-dark :deep(.sa-empty-cards) {
        color: #94a3b8 !important;
    }

    .dashboard-capture.is-dark :deep(.sa-filter-pill),
    .dashboard-capture.is-dark :deep(.sa-code-badge),
    .dashboard-capture.is-dark :deep(.sa-table-counter .badge) {
        background: rgba(37, 99, 235, 0.16) !important;
        border-color: rgba(96, 165, 250, 0.28) !important;
        color: #bfdbfe !important;
    }

    .dashboard-capture.is-dark :deep(.sa-table thead th) {
        background: rgba(15, 23, 42, 0.94) !important;
        border-color: rgba(148, 163, 184, 0.18) !important;
        color: #94a3b8 !important;
    }

    .dashboard-capture.is-dark :deep(.sa-sektor-row),
    .dashboard-capture.is-dark :deep(.sa-sub-row),
    .dashboard-capture.is-dark :deep(.sa-card-sub-item),
    .dashboard-capture.is-dark :deep(.sa-stakeholder-item) {
        background: rgba(15, 23, 42, 0.68) !important;
        border-color: rgba(148, 163, 184, 0.16) !important;
        color: #dbeafe !important;
    }

    .dashboard-capture.is-dark :deep(.sa-sektor-row:hover),
    .dashboard-capture.is-dark :deep(.sa-sub-row:hover),
    .dashboard-capture.is-dark :deep(.sa-card-sub-item:hover),
    .dashboard-capture.is-dark :deep(.sa-stakeholder-item:hover) {
        background: rgba(37, 99, 235, 0.14) !important;
    }

    .dashboard-capture.is-dark :deep(.sa-count-bar),
    .dashboard-capture.is-dark :deep(.sa-sub-table-wrap),
    .dashboard-capture.is-dark :deep(.sa-stakeholder-list) {
        background: rgba(148, 163, 184, 0.12) !important;
        border-color: rgba(148, 163, 184, 0.16) !important;
    }

    /*  Responsive  */
    @media (max-width: 1199px) {
        .ki-chart-split-grid { grid-template-columns: 1fr; }
        .ki-hero-inner { gap: 0.9rem; }
        .ki-ring-wrap { width: 76px; height: 76px; }
        .ki-ring-value { font-size: 1.15rem; }
        .ki-chart-body { min-height: 280px !important; }
        .ki-chart-split-grid { min-height: 0; }
    }
    @media (max-width: 767px) {
        .ki-main-header { align-items: stretch; padding: 10px; }
        .ki-header-left,
        .ki-header-right { width: 100%; }
        .ki-header-right { justify-content: space-between; }
        .ki-inline-filters { justify-content: flex-start; }
        .ki-divider { display: none; }
        .ki-hero-banner { padding: 0.9rem; }
        .ki-hero-inner { flex-direction: column; align-items: flex-start; }
        .ki-ring-wrap { width: 72px; height: 72px; }
        .ki-hero-pills { width: 100%; }
        .ki-pill { flex: 1 1 92px; justify-content: center; }
        .ki-hero-cta { width: 100%; justify-content: center; }
        .ki-chart-header { flex-direction: column; align-items: flex-start; }
        .ki-chart-controls { width: 100%; justify-content: space-between; }
        .ki-chart-type-toggle { width: 100%; justify-content: center; }
        .ki-view-toggle { flex: 1; }
        .ki-vt-btn { flex: 1; }
        .ki-chart-pane + .ki-chart-pane { border-left: 0; border-top: 1px solid rgba(219,234,254,0.9); padding-top: 0.85rem; }
        .ki-chart-pane-title { align-items: flex-start; flex-direction: column; gap: 2px; }
        .ki-bp-row { align-items: flex-start; flex-direction: column; gap: 7px; }
        .ki-bp-bar-wrap { width: 100%; }
    }
    </style>
