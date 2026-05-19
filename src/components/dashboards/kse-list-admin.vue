<script setup lang="ts">
import { ref, onMounted, computed, nextTick, watch, onBeforeUnmount } from 'vue';
import gsap from 'gsap';
import { csirtService } from '@/services/csirt.service';
import { seEditService } from '@/services/se-edit.service';
import { usersService } from '@/services/users.service';
import { kseCategories } from '@/data/kse-data';
import type { SeCsirt } from '@/types/csirt.types';
import type { SeEditRequest } from '@/types/se-edit.types';
import type { User } from '@/types/user.types';
import Pageheader from '@/shared/components/pageheader/pageheader.vue';
import { useRouter } from 'vue-router';
import { useStakeholdersStore } from '@/stores/stakeholders';

const router = useRouter();
const stakeholdersStore = useStakeholdersStore();

// State
const kseAdminPageRef = ref<HTMLElement | null>(null);
const seList = ref<SeCsirt[]>([]);
const userList = ref<User[]>([]);
const editRequests = ref<SeEditRequest[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const debouncedSearchQuery = ref('');
const quickFilter = ref<'all' | 'review' | 'strategis' | 'unfinished'>('all');
const hasRunInitialEntrance = ref(false);
let gsapCtx: gsap.Context | null = null;
let tableAnimationFrame: number | null = null;
let searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

// Pagination State
const currentPage = ref(1);
const itemsPerPage = ref(10);

// Review Modal State
const reviewModal = ref(false);
const selectedRequest = ref<SeEditRequest | null>(null);
const adminNotes = ref('');
const isSubmitting = ref(false);

// Delete Modal State
const deleteModal = ref(false);
const deleteTarget = ref<SeCsirt | null>(null);
const actionLoadingId = ref<number | null>(null);
const actionError = ref('');

const pageData = {
    title: 'KSE Management',
    currentpage: 'KSE',
    activepage: 'Admin',
};

// Map questions to API fields for score calculation
const fieldToQuestion: Record<string, string> = {
  nilai_investasi: '1.1',
  anggaran_operasional: '1.2',
  kepatuhan_peraturan: '1.3',
  teknik_kriptografi: '1.4',
  jumlah_pengguna: '1.5',
  data_pribadi: '1.6',
  klasifikasi_data: '1.7',
  kekritisan_proses: '1.8',
  dampak_kegagalan: '1.9',
  potensi_kerugian_dan_dampak_negatif: '1.10',
};

// Build weight map for score calculation
const questionBobotMap: Record<string, Record<string, number>> = {};
kseCategories.forEach(cat => {
  cat.questions.forEach(q => {
    questionBobotMap[q.no] = {
      A: q.options.A.bobot,
      B: q.options.B.bobot,
      C: q.options.C.bobot,
    };
  });
});

const calculateScore = (se: SeCsirt) => {
    let total = 0;
    let answered = 0;
    const totalQuestions = 10;

    Object.entries(fieldToQuestion).forEach(([field, qNo]) => {
        const val = (se as any)[field];
        if (val && (val === 'A' || val === 'B' || val === 'C')) {
            total += questionBobotMap[qNo]?.[val] || 0;
            answered++;
        }
    });

    return {
        score: total,
        completion: Math.round((answered / totalQuestions) * 100)
    };
};

const fetchData = async () => {
    loading.value = true;
    try {
        const [ses, requests, users] = await Promise.all([
            csirtService.getAllSe(),
            seEditService.getRequests(),
            usersService.getAll(),
            stakeholdersStore.initialize()
        ]);
        seList.value = ses;
        editRequests.value = requests;
        userList.value = (users as any).data || users;
    } catch (error) {
        console.error('Failed to fetch data:', error);
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchData();
});

// Computed
const enrichedRequests = computed(() => {
    return editRequests.value.map(req => {
        const se = seList.value.find(s => String(s.id) === String(req.id_se));
        const user = userList.value.find(u => String(u.id) === String(req.id_user));
        
        let changes = req.data_perubahan || (req as any).proposed_changes;
        if (typeof changes === 'string' && changes) {
            try { changes = JSON.parse(changes); } catch (e) {}
        }
        if (!changes || typeof changes !== 'object') changes = {};
        
        const finalSe = req.se || se;
        const finalUser = req.user || user;
        
        return {
            ...req,
            data_perubahan: changes,
            se: finalSe,
            user: finalUser,
            display_user_name: req.nama_user || finalUser?.name || finalUser?.display_name || 'Unknown User',
            display_se_name: req.nama_se || finalSe?.nama_se || 'N/A',
            display_perusahaan: (finalSe as any)?.perusahaan?.nama_perusahaan || 'N/A'
        };
    });
});

const pendingRequests = computed(() => enrichedRequests.value.filter(r => r.status === 'pending'));
const pendingEditIds = computed(() => new Set(pendingRequests.value.map(r => String(r.id_se))));
const pendingRequestBySeId = computed(() => {
    const map = new Map<string, (typeof pendingRequests.value)[number]>();
    pendingRequests.value.forEach((req) => {
        map.set(String(req.id_se), req);
    });
    return map;
});

const normalizeCategory = (value?: string | null) => String(value || '').trim().toLowerCase();

const countStrategis = computed(() => seList.value.filter(s => normalizeCategory(s.kategori_se) === 'strategis').length);
const countTinggi    = computed(() => seList.value.filter(s => normalizeCategory(s.kategori_se) === 'tinggi').length);
const countRendah    = computed(() => seList.value.filter(s => normalizeCategory(s.kategori_se) === 'rendah').length);
const categorizedCount = computed(() => countStrategis.value + countTinggi.value + countRendah.value);
const categoryCoverage = computed(() => {
    if (!seList.value.length) return 0;
    return Math.round((categorizedCount.value / seList.value.length) * 100);
});

const getSeLastChangeValue = (se?: SeCsirt | null) => {
    if (!se) return 0;
    const raw = se.updated_at || se.created_at;
    if (!raw) return 0;
    const normalizedDate = typeof raw === 'string' ? raw.replace('Z', '').split('+')[0] : raw;
    const time = new Date(normalizedDate).getTime();
    return Number.isNaN(time) ? 0 : time;
};

const seAssessmentById = computed(() => {
    const map = new Map<string, ReturnType<typeof calculateScore>>();
    seList.value.forEach((se) => {
        map.set(String(se.id), calculateScore(se));
    });
    return map;
});
const getSeAssessment = (se: SeCsirt) => seAssessmentById.value.get(String(se.id)) || { score: 0, completion: 0 };
const getSeCompletionPercent = (se: SeCsirt) => getSeAssessment(se).completion;
const isSeFullyCompleted = (se: SeCsirt) => getSeCompletionPercent(se) === 100;
const getSeStatusText = (se: SeCsirt) => isSeFullyCompleted(se) ? 'Final' : 'Belum Final';

const isRecentTimestamp = (timestamp: number) => {
    if (!timestamp) return false;
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    return Date.now() - timestamp <= threeDaysMs;
};

type GroupMetrics = {
    latestTimestamp: number;
    hasPendingReview: boolean;
    hasStrategis: boolean;
    hasTinggi: boolean;
    hasRendah: boolean;
    hasUnfinished: boolean;
    isRecentlyUpdated: boolean;
};

type CompanyGroup = {
    id: string;
    stakeholder: any;
    ses: SeCsirt[];
    metrics: GroupMetrics;
};

const searchedGroups = computed(() => {
    const q = debouncedSearchQuery.value.toLowerCase();
    const groups: Record<string, CompanyGroup> = {};
    
    seList.value.forEach(se => {
        const stakeholder = getFullStakeholder(se);
        const companyId = String(stakeholder?.id || se.id_perusahaan || se.perusahaan?.id || 'unknown');
        const pendingRequest = pendingRequestBySeId.value.get(String(se.id));
        
        // Search filter logic
        const matchesSearch = !q || 
               se.nama_se?.toLowerCase().includes(q) ||
               stakeholder?.nama_perusahaan?.toLowerCase().includes(q) ||
               se.perusahaan?.nama_perusahaan?.toLowerCase().includes(q) ||
               pendingRequest?.display_user_name?.toLowerCase().includes(q) ||
               pendingRequest?.user?.email?.toLowerCase().includes(q);
        
        if (matchesSearch) {
            if (!groups[companyId]) {
                groups[companyId] = {
                    id: companyId,
                    stakeholder: stakeholder || se.perusahaan || { nama_perusahaan: 'Unknown Stakeholder' },
                    ses: [],
                    metrics: {
                        latestTimestamp: 0,
                        hasPendingReview: false,
                        hasStrategis: false,
                        hasTinggi: false,
                        hasRendah: false,
                        hasUnfinished: false,
                        isRecentlyUpdated: false,
                    }
                };
            }
            const group = groups[companyId];
            const category = normalizeCategory(se.kategori_se);
            const latestTimestamp = Math.max(group.metrics.latestTimestamp, getSeLastChangeValue(se));

            group.ses.push(se);
            group.metrics.latestTimestamp = latestTimestamp;
            group.metrics.hasPendingReview = group.metrics.hasPendingReview || pendingEditIds.value.has(String(se.id));
            group.metrics.hasStrategis = group.metrics.hasStrategis || category === 'strategis';
            group.metrics.hasTinggi = group.metrics.hasTinggi || category === 'tinggi';
            group.metrics.hasRendah = group.metrics.hasRendah || category === 'rendah';
            group.metrics.hasUnfinished = group.metrics.hasUnfinished || !isSeFullyCompleted(se);
            group.metrics.isRecentlyUpdated = isRecentTimestamp(latestTimestamp);
        }
    });
    
    return Object.values(groups);
});

const quickFilterCounts = computed(() => {
    const counts = {
        all: searchedGroups.value.length,
        review: 0,
        strategis: 0,
        unfinished: 0,
    };

    searchedGroups.value.forEach((group) => {
        const metrics = group.metrics;
        if (metrics.hasPendingReview) counts.review += 1;
        if (metrics.hasStrategis) counts.strategis += 1;
        if (metrics.hasUnfinished) counts.unfinished += 1;
    });

    return counts;
});

const groupedByCompany = computed(() => {
    return searchedGroups.value
        .filter((group) => {
            const metrics = group.metrics;
            if (quickFilter.value === 'review') return metrics.hasPendingReview;
            if (quickFilter.value === 'strategis') return metrics.hasStrategis;
            if (quickFilter.value === 'unfinished') return metrics.hasUnfinished;
            return true;
        })
        .sort((a, b) => {
            const metricsA = a.metrics;
            const metricsB = b.metrics;

            if (metricsA.hasPendingReview !== metricsB.hasPendingReview) {
                return metricsA.hasPendingReview ? -1 : 1;
            }
            if (metricsA.hasStrategis !== metricsB.hasStrategis) {
                return metricsA.hasStrategis ? -1 : 1;
            }
            if (metricsA.isRecentlyUpdated !== metricsB.isRecentlyUpdated) {
                return metricsA.isRecentlyUpdated ? -1 : 1;
            }
            if (metricsA.latestTimestamp !== metricsB.latestTimestamp) {
                return metricsB.latestTimestamp - metricsA.latestTimestamp;
            }
            return (a.stakeholder.nama_perusahaan || '').localeCompare(b.stakeholder.nama_perusahaan || '');
        });
});

const paginatedGroups = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    const end = start + itemsPerPage.value;
    return groupedByCompany.value.slice(start, end);
});

const totalGroupPages = computed(() => Math.max(1, Math.ceil(groupedByCompany.value.length / itemsPerPage.value)));
const visibleRangeStart = computed(() => groupedByCompany.value.length ? (currentPage.value - 1) * itemsPerPage.value + 1 : 0);
const visibleRangeEnd = computed(() => Math.min(currentPage.value * itemsPerPage.value, groupedByCompany.value.length));

const selectedRequestChanges = computed(() => getFilteredChanges(selectedRequest.value));
const selectedRequestChangesCount = computed(() => Object.keys(selectedRequestChanges.value).length);

const refreshData = () => {
    fetchData();
};

// Actions
const getStakeholderSlug = (se: SeCsirt) => {
    const companyId = se.id_perusahaan || se.perusahaan?.id;
    const stakeholder = stakeholdersStore.stakeholders.find(s => String(s.id) === String(companyId));
    return stakeholder?.slug || se.perusahaan?.slug || '';
};

const viewDetail = (se: SeCsirt) => {
    // Redirect to the stakeholder's KSE list view
    // Attempt to find the stakeholder from the store to get the correct slug
    const slug = getStakeholderSlug(se);
    
    if (slug) {
        router.push({ path: '/kse', query: { slug, from: 'admin' } });
    } else {
        console.error('Could not find slug for SE:', se);
    }
};

const editSe = (se: SeCsirt) => {
    router.push({
        path: '/kse-crud',
        query: {
            seId: String(se.id),
            source: 'csirt',
            stakeholder: getStakeholderSlug(se),
            from: 'admin',
        }
    });
};

const openDelete = (se: SeCsirt) => {
    deleteTarget.value = se;
    actionError.value = '';
    deleteModal.value = true;
};

const closeDelete = () => {
    if (actionLoadingId.value) return;
    deleteModal.value = false;
    deleteTarget.value = null;
    actionError.value = '';
};

const confirmDelete = async () => {
    if (!deleteTarget.value) return;
    actionLoadingId.value = deleteTarget.value.id;
    actionError.value = '';
    try {
        await csirtService.deleteSe(deleteTarget.value.id);
        const deletedId = String(deleteTarget.value.id);
        seList.value = seList.value.filter(se => String(se.id) !== deletedId);
        editRequests.value = editRequests.value.filter(req => String(req.id_se) !== deletedId);
        if (currentPage.value > totalGroupPages.value) currentPage.value = totalGroupPages.value;
        deleteModal.value = false;
        deleteTarget.value = null;
        window.dispatchEvent(new Event('se-requests-updated'));
    } catch (error: any) {
        console.error('Delete SE failed:', error);
        actionError.value = error?.message || 'Gagal menghapus sistem elektronik. Silakan coba lagi.';
    } finally {
        actionLoadingId.value = null;
    }
};

const openReview = (req: SeEditRequest) => {
    selectedRequest.value = req;
    adminNotes.value = '';
    reviewModal.value = true;
};

const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedRequest.value) return;
    isSubmitting.value = true;
    try {
        await seEditService.reviewRequest(selectedRequest.value.id, {
            status,
            admin_notes: adminNotes.value
        });
        reviewModal.value = false;
        fetchData();
        window.dispatchEvent(new Event('se-requests-updated'));
    } catch (error) {
        console.error('Review failed:', error);
    } finally {
        isSubmitting.value = false;
    }
};

const approveRequest = (req: SeEditRequest) => {
    openReview(req);
};

const rejectRequest = (req: SeEditRequest) => {
    openReview(req);
};

const getCategoryBadge = (cat: string) => {
    const c = cat?.toLowerCase();
    if (c === 'strategis') return 'badge-sektor-red';
    if (c === 'tinggi') return 'badge-sektor-amber';
    if (c === 'rendah') return 'badge-sektor-green';
    return 'badge-sektor-gray';
};

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'pending': return 'badge-sektor-amber';
        case 'approved': return 'badge-sektor-teal';
        case 'rejected': return 'badge-sektor-red';
        default: return 'badge-sektor-gray';
    }
};

const formatDate = (date?: string | null) => {
    if (!date) return '-';
    const normalizedDate = typeof date === 'string' ? date.replace('Z', '').split('+')[0] : date;
    const d = new Date(normalizedDate);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

const formatTime = (date?: string | null) => {
    if (!date) return '';
    const normalizedDate = typeof date === 'string' ? date.replace('Z', '').split('+')[0] : date;
    const d = new Date(normalizedDate);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Expansion State
const expandedRows = ref<Set<string>>(new Set());
const toggleExpand = (id: string) => {
    if (expandedRows.value.has(id)) {
        expandedRows.value.delete(id);
    } else {
        expandedRows.value.add(id);
    }
};

const excludedFields = ['nama_se', 'ip_se', 'as_number_se', 'pengelola_se', 'fitur_se', 'id_perusahaan', 'id_sub_sektor'];

const getFilteredChanges = (req: any) => {
    if (!req || !req.data_perubahan) return {};
    const changes: any = {};
    Object.entries(req.data_perubahan).forEach(([key, val]) => {
        // Skip excluded fields
        if (excludedFields.includes(key)) return;
        
        // Skip if new value is empty/null/undefined (usually means not touched)
        if (val === null || val === undefined || val === '') return;
        
        // Skip if value is same as current
        const currentVal = req.se ? (req.se as any)[key] : undefined;
        if (String(val) === String(currentVal)) return;
        
        changes[key] = val;
    });
    return changes;
};

const assessmentLabels: Record<string, string> = {
  nama_se: 'Nama Sistem Elektronik',
  id_perusahaan: 'Stakeholder',
  id_sub_sektor: 'Sub Sektor',
  pengelola_se: 'Pengelola SE',
  ip_se: 'IP Address',
  as_number_se: 'AS Number',
  fitur_se: 'Fitur & Layanan',
  nilai_investasi: 'Nilai Investasi',
  anggaran_operasional: 'Anggaran Operasional',
  kepatuhan_peraturan: 'Kepatuhan Peraturan',
  teknik_kriptografi: 'Teknik Kriptografi',
  jumlah_pengguna: 'Jumlah Pengguna',
  data_pribadi: 'Data Pribadi',
  klasifikasi_data: 'Klasifikasi Data',
  kekritisan_proses: 'Kekritisan Proses',
  dampak_kegagalan: 'Dampak Kegagalan',
  potensi_kerugian_dan_dampak_negatif: 'Potensi Kerugian',
};

const getOptionLabel = (key: string, val: any) => {
    // If it's one of the ABC options
    if (['A', 'B', 'C'].includes(String(val)) && fieldToQuestion[key]) {
        const qNo = fieldToQuestion[key];
        const q = kseCategories[0].questions.find(q => q.no === qNo);
        if (q) {
            return (q.options as any)[val]?.label || val;
        }
    }
    return val;
};

const getFullStakeholder = (se: SeCsirt) => {
    const companyId = se.id_perusahaan || se.perusahaan?.id;
    if (!companyId) return null;
    return stakeholdersStore.stakeholdersByIdMap[String(companyId)];
};

const prefersReducedMotion = () => {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const cancelScheduledTableAnimation = () => {
    if (tableAnimationFrame !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(tableAnimationFrame);
        tableAnimationFrame = null;
    }
};

const animateTableRows = (quick = false) => {
    cancelScheduledTableAnimation();

    nextTick(() => {
        if (typeof window === 'undefined') return;

        tableAnimationFrame = window.requestAnimationFrame(() => {
            tableAnimationFrame = null;
            const root = kseAdminPageRef.value;
            if (!root || prefersReducedMotion()) return;

            const rows = Array.from(root.querySelectorAll<HTMLElement>('.lms-table-row'));
            if (!rows.length) return;

            gsap.killTweensOf(rows);
            gsap.set(rows, { clearProps: 'transform,opacity' });
        });
    });
};

const runEntranceAnimations = async () => {
    await nextTick();
    const root = kseAdminPageRef.value;
    if (!root || prefersReducedMotion()) return;

    gsapCtx?.revert();
    gsapCtx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.from('.kse-hero-header', { y: 18, opacity: 0, duration: 0.45, clearProps: 'transform,opacity' })
            .from('.kse-inline-breadcrumb', { y: -8, opacity: 0, duration: 0.28, clearProps: 'transform,opacity' }, '-=0.25')
            .from('.kse-hero-copy h1', { y: 16, opacity: 0, duration: 0.38, clearProps: 'transform,opacity' }, '-=0.18')
            .from('.kse-hero-copy p', { y: 12, opacity: 0, duration: 0.3, clearProps: 'transform,opacity' }, '-=0.24')
            .from('.kse-kpi-card', { y: 16, opacity: 0, scale: 0.96, duration: 0.34, stagger: 0.05, ease: 'back.out(1.35)', clearProps: 'transform,opacity' }, '-=0.12')
            .from('.stakeholders-toolbar', { y: 18, opacity: 0, duration: 0.34, clearProps: 'transform,opacity' }, '-=0.08')
            .from('.kse-list-shell', { y: 18, opacity: 0, duration: 0.4, clearProps: 'transform,opacity' }, '-=0.12');
    }, root);

    animateTableRows(true);
};

watch(loading, (isLoading) => {
    if (!isLoading) {
        if (!hasRunInitialEntrance.value) {
            hasRunInitialEntrance.value = true;
            runEntranceAnimations();
            return;
        }
        animateTableRows();
    }
});

watch(searchQuery, (value) => {
    if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
        debouncedSearchQuery.value = value;
        currentPage.value = 1;
        searchDebounceTimeout = null;
    }, 140);
}, { immediate: true });

watch([paginatedGroups, currentPage, itemsPerPage], () => {
    if (currentPage.value > totalGroupPages.value) currentPage.value = totalGroupPages.value;
    if (!loading.value) animateTableRows(true);
}, { flush: 'post' });

onBeforeUnmount(() => {
    if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
    cancelScheduledTableAnimation();
    gsapCtx?.revert();
});
</script>

<template>
    <div ref="kseAdminPageRef" class="kse-admin-page">
        <Pageheader :propData="pageData" />
        <div class="row">
            <div class="col-xl-12">
                <!-- Premium Shell Card -->
                <div class="card custom-card gradient-header-card stakeholders-shell-card kse-shell-card" style="overflow: visible !important;">
                <header class="kse-hero-header">
                    <div class="kse-hero-content">
                        <div class="kse-hero-copy">
                            <div class="kse-inline-breadcrumb">Dashboard <span>/</span> KSE <span>/</span> Management</div>
                            <h1>KSE Management</h1>
                            <p>Pusat kendali sistem elektronik untuk memantau kategori, kelengkapan penilaian, dan request perubahan dari stakeholder.</p>
                        </div>
                    </div>
                </header>
                
                <!-- ══ PREMIUM HEADER ══════════════════════════════════════════ -->
                <div class="stakeholder-header stakeholders-premium-header">
                    <div class="stakeholders-header-main d-flex align-items-center justify-content-between flex-wrap gap-3">
                        
                        <!-- Left: Title & Hero -->
                        <div class="stakeholders-hero-copy1 d-flex flex-column gap-1">
                            <div>
                                <div class="stakeholders-inline-breadcrumb">Dashboards <span>/</span> KSE Management</div>
                                <div class="card-title mb-0 fw-bold header-card-title stakeholders-hero-title">
                                    Manajemen Sistem Elektronik (KSE)
                                </div>
                                <div class="header-subtitle mt-1 stakeholders-hero-subtitle">
                                    Pusat kendali data, kategorisasi, dan tinjauan perubahan sistem elektronik seluruh stakeholder
                                </div>
                            </div>

                            <!-- Meta Stats Stack -->
                            <div class="stakeholders-meta-stack mt-3">
                                <div class="stakeholders-meta-card">
                                    <span class="stakeholders-meta-label">Total Sistem</span>
                                    <strong><i class="ri-computer-line text-primary"></i> {{ seList.length }}</strong>
                                </div>
                                <div class="stakeholders-meta-card">
                                    <span class="stakeholders-meta-label">Strategis</span>
                                    <strong><i class="ri-shield-flash-fill text-danger"></i> {{ countStrategis }}</strong>
                                </div>
                                <div class="stakeholders-meta-card">
                                    <span class="stakeholders-meta-label">Tinggi</span>
                                    <strong><i class="ri-shield-fill text-warning"></i> {{ countTinggi }}</strong>
                                </div>
                                <div class="stakeholders-meta-card">
                                    <span class="stakeholders-meta-label">Rendah</span>
                                    <strong><i class="ri-shield-line text-info"></i> {{ countRendah }}</strong>
                                </div>
                                <div class="stakeholders-meta-card" 
                                     :class="{ 'active-review': pendingRequests.length > 0 }">
                                    <span class="stakeholders-meta-label">Antrian Review</span>
                                    <strong :class="pendingRequests.length > 0 ? 'text-indigo' : 'text-white-50'">
                                        <i class="ri-edit-2-line" :class="{ 'pulse-icon': pendingRequests.length > 0 }"></i> 
                                        {{ pendingRequests.length }}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        <!-- Right: Tools -->
                        <div class="stakeholders-hero-tools d-flex flex-column align-items-end gap-3">
                            <div class="stakeholders-search position-relative">
                                <i class="ri-search-line header-search-icon"></i>
                                <input
                                    v-model="searchQuery"
                                    type="text"
                                    class="form-control form-control-sm header-search-input"
                                    placeholder="Cari stakeholder, sistem, atau pengaju..."
                                />
                                <button v-if="searchQuery" @click="searchQuery = ''" class="clear-btn">
                                    <i class="ri-close-circle-fill"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ══ CARD BODY ══════════════════════════════════════════ -->
                <div class="card-body p-4 stakeholders-premium-body">
                    <section class="kse-kpi-grid mb-4" aria-label="KSE summary">
                        <article class="kse-kpi-card tone-total">
                            <div class="kse-kpi-icon"><i class="ri-server-line"></i></div>
                            <div>
                                <span>Total Sistem</span>
                                <strong v-if="!loading || seList.length">{{ seList.length }}</strong>
                                <strong v-else class="kse-skel-line kse-skel-kpi"></strong>
                                <small>Data KSE terdaftar</small>
                            </div>
                        </article>
                        <article class="kse-kpi-card tone-danger">
                            <div class="kse-kpi-icon"><i class="ri-shield-keyhole-fill"></i></div>
                            <div>
                                <span>Strategis</span>
                                <strong v-if="!loading || seList.length">{{ countStrategis }}</strong>
                                <strong v-else class="kse-skel-line kse-skel-kpi"></strong>
                                <small>Aset prioritas utama</small>
                            </div>
                        </article>
                        <article class="kse-kpi-card tone-warning">
                            <div class="kse-kpi-icon"><i class="ri-alarm-warning-fill"></i></div>
                            <div>
                                <span>Tinggi</span>
                                <strong v-if="!loading || seList.length">{{ countTinggi }}</strong>
                                <strong v-else class="kse-skel-line kse-skel-kpi"></strong>
                                <small>Perlu pemantauan aktif</small>
                            </div>
                        </article>
                        <article class="kse-kpi-card tone-success">
                            <div class="kse-kpi-icon"><i class="ri-shield-check-line"></i></div>
                            <div>
                                <span>Rendah</span>
                                <strong v-if="!loading || seList.length">{{ countRendah }}</strong>
                                <strong v-else class="kse-skel-line kse-skel-kpi"></strong>
                                <small>Kritikalitas lebih rendah</small>
                            </div>
                        </article>
                        <article class="kse-kpi-card tone-review" :class="{ 'is-hot': pendingRequests.length > 0 }">
                            <div class="kse-kpi-icon"><i class="ri-file-edit-line" :class="{ 'pulse-icon': pendingRequests.length > 0 }"></i></div>
                            <div>
                                <span>Antrian Review</span>
                                <strong v-if="!loading || editRequests.length">{{ pendingRequests.length }}</strong>
                                <strong v-else class="kse-skel-line kse-skel-kpi"></strong>
                                <small>Menunggu keputusan admin</small>
                            </div>
                        </article>
                    </section>

                    <!-- ══ TABLE CONTROLS ══════════════════════════════════════════ -->
                    <div class="controls-bar stakeholders-toolbar stakeholders-filter-bar mb-4">
                        <div class="stakeholders-toolbar-right w-100 d-flex align-items-center justify-content-between">
                            <div class="stakeholders-per-page">
                                <span>Rows</span>
                                <select v-model="itemsPerPage" class="form-select form-select-sm entries-select" @change="currentPage = 1">
                                    <option v-for="n in [5, 10, 15, 20, 25, 50]" :key="n" :value="n">{{ n }}</option>
                                </select>
                            </div>
                            <label class="kse-search" aria-label="Cari stakeholder atau KSE">
                                <i class="ri-search-line"></i>
                                <input
                                    v-model="searchQuery"
                                    type="text"
                                    placeholder="Cari stakeholder, sistem, atau pengaju..."
                                />
                                <button v-if="searchQuery" type="button" @click="searchQuery = ''" aria-label="Clear search">
                                    <i class="ri-close-circle-fill"></i>
                                </button>
                            </label>
                            <button class="btn kse-toolbar-btn d-flex align-items-center gap-2" @click="refreshData" :disabled="loading">
                                <i class="ri-refresh-line" :class="{ 'ri-spin': loading }"></i>
                                <span class="btn-text">Refresh Data</span>
                            </button>
                        </div>
                        <div class="kse-quick-filters mt-3">
                            <button type="button" class="kse-filter-pill" :class="{ active: quickFilter === 'all' }" @click="quickFilter = 'all'; currentPage = 1">Semua ({{ quickFilterCounts.all }})</button>
                            <button type="button" class="kse-filter-pill" :class="{ active: quickFilter === 'review' }" @click="quickFilter = 'review'; currentPage = 1">Perlu Review ({{ quickFilterCounts.review }})</button>
                            <button type="button" class="kse-filter-pill" :class="{ active: quickFilter === 'strategis' }" @click="quickFilter = 'strategis'; currentPage = 1">Strategis ({{ quickFilterCounts.strategis }})</button>
                            <button type="button" class="kse-filter-pill" :class="{ active: quickFilter === 'unfinished' }" @click="quickFilter = 'unfinished'; currentPage = 1">Belum Final ({{ quickFilterCounts.unfinished }})</button>
                        </div>
                    </div>

                    <!-- Unified LMS Card Table Shell -->
                    <div class="card custom-card shadow-sm border-0 overflow-hidden kse-list-shell">
                        
                        <!-- 1. PENDING REQUESTS SECTION (Only if exists) -->
                        <div v-if="pendingRequests.length > 0" class="p-4 bg-warning-transparent border-bottom">
                            <div class="d-flex align-items-center justify-content-between mb-3">
                                <h6 class="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                    <i class="ri-notification-badge-line text-warning fs-18"></i> 
                                    Menunggu Tinjauan Perubahan ({{ pendingRequests.length }})
                                </h6>
                                <span class="badge bg-warning text-dark px-2 py-1 fs-10 fw-bold">ACTION REQUIRED</span>
                            </div>
                            
                            <div class="table-responsive stakeholder-table-wrap border rounded-3 bg-white">
                                <table class="table lms-style-table mb-0 align-middle">
                                    <thead class="stakeholder-thead" style="background: #f8fafc;">
                                        <tr>
                                            <th class="text-center" style="width: 50px;">NO</th>
                                            <th>PENGAJU</th>
                                            <th>SISTEM ELEKTRONIK</th>
                                            <th>DIMINTA PADA</th>
                                            <th class="text-center">STATUS</th>
                                            <th class="text-center">AKSI</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(req, idx) in pendingRequests" :key="req.id" class="kse-review-row">
                                            <td class="text-center text-muted fw-bold">{{ idx + 1 }}</td>
                                            <td>
                                                <div class="d-flex align-items-center gap-2">
                                                    <div class="avatar avatar-xs rounded-circle bg-primary-transparent text-primary">
                                                        {{ (req.user?.name || req.user?.display_name || 'U').charAt(0).toUpperCase() }}
                                                    </div>
                                                    <div>
                                                        <div class="text-dark fw-bold fs-12">{{ req.display_user_name }}</div>
                                                        <div class="text-muted fs-10">{{ req.display_perusahaan || 'Perusahaan tidak diketahui' }}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div class="text-dark fw-bold fs-12 mb-0">{{ req.display_se_name }}</div>
                                            </td>
                                            <td>
                                                <div class="text-dark fs-11 mb-0">{{ formatDate(req.created_at) }}</div>
                                                <div class="text-muted fs-10">{{ formatTime(req.created_at) }} WIB</div>
                                            </td>
                                            <td class="text-center">
                                                <span class="badge bg-warning-transparent text-warning px-2 py-1 rounded-pill fw-bold fs-10">Pending</span>
                                            </td>
                                            <td class="text-center">
                                                <div class="d-flex justify-content-center gap-2">
                                                    <button class="btn btn-sm btn-icon btn-primary-light" @click="openReview(req)" title="Buka detail review perubahan" aria-label="Buka detail review perubahan">
                                                        <i class="ri-eye-line"></i>
                                                    </button>
                                                    <button class="btn btn-sm btn-icon btn-success-light" @click="approveRequest(req)" title="Setujui pengajuan perubahan" aria-label="Setujui pengajuan perubahan">
                                                        <i class="ri-check-line"></i>
                                                    </button>
                                                    <button class="btn btn-sm btn-icon btn-danger-light" @click="rejectRequest(req)" title="Tolak pengajuan perubahan" aria-label="Tolak pengajuan perubahan">
                                                        <i class="ri-close-line"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- 2. GROUPED LIST BY STAKEHOLDER -->
                        <div class="table-responsive">
                            <table class="table table-hover mb-0 align-middle lms-style-table">
                                <thead class="stakeholder-thead">
                                    <tr>
                                        <th class="text-center" style="width: 50px;">NO</th>
                                        <th>Stakeholder / Perusahaan</th>
                                        <th class="text-center">Total KSE</th>
                                        <th class="text-center">Kategori</th>
                                        <th class="text-center">Update Terakhir</th>
                                        <th class="text-center" style="width: 150px;">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-if="loading && seList.length === 0" v-for="index in Math.min(itemsPerPage, 8)" :key="`kse-skeleton-${index}`" class="kse-skeleton-table-row">
                                        <td class="text-center"><span class="kse-skel-line kse-skel-index"></span></td>
                                        <td><div class="d-flex align-items-center gap-3"><span class="kse-skel-icon"></span><div class="flex-grow-1"><span class="kse-skel-line kse-skel-title"></span><span class="kse-skel-line kse-skel-subtitle"></span></div></div></td>
                                        <td class="text-center"><span class="kse-skel-pill"></span></td>
                                        <td class="text-center"><span class="kse-skel-pill"></span></td>
                                        <td><span class="kse-skel-line kse-skel-title"></span></td>
                                        <td class="text-center"><span class="kse-skel-action"></span></td>
                                    </tr>
                                    <tr v-else-if="groupedByCompany.length === 0">
                                        <td colspan="6" class="text-center py-5">
                                            <div class="empty-state py-5">
                                                <div class="empty-icon-ring mb-3"><div class="empty-icon-inner"><i class="ri-government-line"></i></div></div>
                                                <h6 class="fw-bold empty-state-title">Tidak ada stakeholder ditemukan</h6>
                                                <p class="text-muted fs-13">Coba ubah kata kunci pencarian Anda</p>
                                            </div>
                                        </td>
                                    </tr>
                                    
                                    <template v-for="(group, idx) in paginatedGroups" :key="group.id">
                                        <tr class="lms-table-row clickable-row kse-parent-row" :class="{ 'expanded-parent': expandedRows.has(group.id), 'needs-review': group.metrics.hasPendingReview, 'is-priority': group.metrics.hasStrategis, 'is-recent': group.metrics.isRecentlyUpdated }" @click="toggleExpand(group.id)">
                                            <td class="text-center text-muted fw-bold fs-13">{{ (currentPage - 1) * itemsPerPage + idx + 1 }}</td>
                                            <td>
                                                <div class="d-flex align-items-center gap-2">
                                                    <button class="btn btn-sm btn-icon btn-light rounded-circle expansion-toggle-lms" :class="{ 'active': expandedRows.has(group.id) }" @click.stop="toggleExpand(group.id)">
                                                        <i class="ri-arrow-right-s-line"></i>
                                                    </button>
                                                    <div class="d-flex align-items-center gap-3 ms-1">
                                                        <div class="avatar avatar-md rounded-circle bg-primary-transparent text-primary shadow-sm flex-shrink-0" style="width: 42px; height: 42px;">
                                                            <i class="ri-government-line fs-20"></i>
                                                        </div>
                                                        <div class="overflow-hidden">
                                                            <div class="d-flex align-items-center gap-2 flex-wrap">
                                                                <div class="fw-bold text-dark fs-14 text-truncate" style="max-width: 300px;">{{ group.stakeholder.nama_perusahaan }}</div>
                                                                <span v-if="group.metrics.hasPendingReview" class="badge bg-warning text-dark fs-10 fw-bold">Perlu Review</span>
                                                                <span v-if="group.metrics.hasStrategis" class="badge bg-danger-transparent text-danger fs-10 fw-bold">Strategis</span>
                                                                <span v-else-if="group.metrics.isRecentlyUpdated" class="badge bg-info-transparent text-info fs-10 fw-bold">Baru Diperbarui</span>
                                                            </div>
                                                            <div class="text-muted fs-11 text-truncate">{{ group.stakeholder.sektor || 'Sektor belum ditentukan' }}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td class="text-center">
                                                <span class="badge bg-primary-transparent text-primary px-3 py-2 rounded-pill fw-bold fs-12">{{ group.ses.length }} Sistem</span>
                                            </td>
                                            <td class="text-center">
                                                <div class="d-flex justify-content-center flex-wrap gap-1" style="max-width: 150px; margin: 0 auto;">
                                                    <span v-if="group.metrics.hasStrategis" class="badge bg-danger-transparent text-danger fs-10">Strategis</span>
                                                    <span v-if="group.metrics.hasTinggi" class="badge bg-warning-transparent text-warning fs-10">Tinggi</span>
                                                    <span v-if="group.metrics.hasRendah" class="badge bg-info-transparent text-info fs-10">Rendah</span>
                                                </div>
                                            </td>
                                            <td class="text-center">
                                                <div class="text-dark fs-11 fw-medium"><i class="ri-calendar-line text-muted"></i> {{ group.metrics.latestTimestamp ? formatDate(new Date(group.metrics.latestTimestamp).toISOString()) : '-' }}</div>
                                            </td>
                                            <td class="text-center" @click.stop>
                                                <button class="btn btn-sm btn-outline-primary rounded-pill px-3 shadow-sm" title="Buka profil stakeholder" aria-label="Buka profil stakeholder" @click="router.push({ path: `/stakeholders/${group.stakeholder.slug || getStakeholderSlug(group.ses[0])}`, query: { id_perusahaan: group.stakeholder.id || group.ses[0]?.id_perusahaan } })">
                                                    <i class="ri-user-line me-1"></i> Profil
                                                </button>
                                            </td>
                                        </tr>

                                        <tr v-if="expandedRows.has(group.id)" class="expansion-row animate__animated animate__fadeIn">
                                            <td colspan="6" class="px-5 py-3 border-0 kse-child-cell">
                                                <div class="card custom-card mb-0 shadow-sm border-0 overflow-hidden kse-child-card">
                                                    <div class="card-header bg-white border-bottom p-3 d-flex align-items-center justify-content-between">
                                                        <div class="d-flex align-items-center gap-2">
                                                            <i class="ri-list-check-3 text-primary fs-18"></i>
                                                            <h6 class="fw-bold text-dark mb-0 fs-13">Daftar Sistem Elektronik ({{ group.ses.length }})</h6>
                                                        </div>
                                                    </div>
                                                    <div class="card-body p-0">
                                                        <div class="table-responsive">
                                                            <table class="table table-sm table-nowrap mb-0 align-middle kse-child-table">
                                                                <thead>
                                                                    <tr>
                                                                        <th class="ps-4" style="width: 40px;">No</th>
                                                                        <th>Nama Sistem</th>
                                                                        <th class="text-center">Kategori</th>
                                                                        <th class="text-center">Status</th>
                                                                        <th>Kelengkapan</th>
                                                                        <th class="text-center">Aksi</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    <tr v-for="(se, sIdx) in group.ses" :key="se.id" class="border-bottom-0">
                                                                        <td class="ps-4 text-muted fs-11 fw-bold">{{ sIdx + 1 }}</td>
                                                                        <td>
                                                                            <div class="d-flex align-items-center gap-3">
                                                                                <div class="avatar avatar-sm rounded bg-danger-transparent text-danger"><i class="ri-macbook-line"></i></div>
                                                                                <div>
                                                                                    <div class="fw-bold text-dark fs-12">{{ se.nama_se }}</div>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td class="text-center">
                                                                            <span class="badge-sektor" :class="getCategoryBadge(se.kategori_se || '')">{{ se.kategori_se || 'Draft' }}</span>
                                                                        </td>
                                                                        <td class="text-center">
                                                                            <span class="badge rounded-pill px-2 py-1 fs-9 fw-bold" :class="isSeFullyCompleted(se) ? 'bg-success-transparent text-success' : 'bg-warning-transparent text-warning'">
                                                                                <i :class="isSeFullyCompleted(se) ? 'ri-lock-fill me-1' : 'ri-time-line me-1'"></i> {{ getSeStatusText(se).toUpperCase() }}
                                                                            </span>
                                                                        </td>
                                                                        <td>
                                                                            <div class="d-flex align-items-center gap-2" style="width: 100px;">
                                                                                <div class="progress progress-xs flex-grow-1" style="height: 4px;"><div class="progress-bar bg-primary" :style="{ width: getSeCompletionPercent(se) + '%' }"></div></div>
                                                                                <span class="fs-10 fw-bold text-primary">{{ getSeCompletionPercent(se) }}%</span>
                                                                            </div>
                                                                        </td>
                                                                        <td class="text-center pe-3">
                                                                            <div class="d-flex justify-content-center gap-1">
                                                                                <button class="btn btn-icon btn-sm btn-info-light stakeholders-action-btn kse-action-tooltip" data-kse-tooltip="Lihat detail" @click="viewDetail(se)" title="Lihat detail sistem elektronik" aria-label="Lihat detail sistem elektronik"><i class="ri-eye-line"></i></button>
                                                                                <button class="btn btn-icon btn-sm btn-primary-light stakeholders-action-btn kse-action-tooltip" data-kse-tooltip="Edit sistem" @click="editSe(se)" title="Edit sistem elektronik" aria-label="Edit sistem elektronik"><i class="ri-edit-line"></i></button>
                                                                                <button class="btn btn-icon btn-sm btn-danger-light stakeholders-action-btn kse-action-tooltip" data-kse-tooltip="Hapus sistem" @click="openDelete(se)" title="Hapus sistem elektronik" aria-label="Hapus sistem elektronik"><i class="ri-delete-bin-line"></i></button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    </template>
                                </tbody>
                            </table>
                        </div>

                        <!-- ══ PAGINATION ══════════════════════════════════════════ -->
                        <div class="pagination-container stakeholders-pagination p-4 border-top">
                            <div class="stakeholders-pagination-copy">Menampilkan {{ visibleRangeStart }}-{{ visibleRangeEnd }} dari {{ groupedByCompany.length }} Stakeholder</div>
                            <div class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
                                <span class="stakeholders-page-pill">Halaman {{ currentPage }} dari {{ totalGroupPages }}</span>
                                <nav v-if="totalGroupPages > 1">
                                    <ul class="pagination pagination-sm mb-0 gap-1">
                                        <li class="page-item" :class="{ disabled: currentPage === 1 }">
                                            <button class="page-link rounded-circle" @click="currentPage = 1"><i class="ri-skip-back-mini-line"></i></button>
                                        </li>
                                        <li class="page-item" :class="{ disabled: currentPage === 1 }">
                                            <button class="page-link rounded-circle" @click="currentPage--"><i class="ri-arrow-left-s-line"></i></button>
                                        </li>
                                        <template v-for="p in totalGroupPages" :key="p">
                                            <li v-if="p === 1 || p === totalGroupPages || (p >= currentPage - 2 && p <= currentPage + 2)" class="page-item" :class="{ active: p === currentPage }">
                                                <button class="page-link rounded-circle" @click="currentPage = p">{{ p }}</button>
                                            </li>
                                        </template>
                                        <li class="page-item" :class="{ disabled: currentPage === totalGroupPages }">
                                            <button class="page-link rounded-circle" @click="currentPage++"><i class="ri-arrow-right-s-line"></i></button>
                                        </li>
                                    </ul>
                                </nav>
                            </div>
                        </div>
                    </div><!-- /kse-list-shell -->
                </div><!-- /card-body -->
                </div><!-- /premium shell card -->
            </div>
        </div>
    </div>

    <Teleport to="body">
        <div v-if="deleteModal" class="modal-overlay" @click.self="closeDelete">
            <section class="kse-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="kse-delete-title">
                <button class="kse-confirm-close" type="button" :disabled="Boolean(actionLoadingId)" @click="closeDelete">
                    <i class="ri-close-line"></i>
                </button>
                <div class="kse-confirm-icon danger">
                    <i class="ri-delete-bin-6-line"></i>
                </div>
                <div class="kse-confirm-copy">
                    <h3 id="kse-delete-title">Hapus sistem elektronik?</h3>
                    <p>
                        Data KSE <strong>{{ deleteTarget?.nama_se }}</strong> akan dihapus dari daftar admin.
                        Tindakan ini tidak bisa dibatalkan dari halaman ini.
                    </p>
                </div>
                <div class="kse-confirm-record">
                    <span>{{ deleteTarget ? (getFullStakeholder(deleteTarget)?.nama_perusahaan || deleteTarget.perusahaan?.nama_perusahaan || 'N/A') : '-' }}</span>
                    <strong>{{ deleteTarget?.kategori_se || 'N/A' }}</strong>
                </div>
                <div v-if="actionError" class="kse-action-error" role="alert">
                    <i class="ri-error-warning-line"></i>
                    <span>{{ actionError }}</span>
                </div>
                <div class="kse-confirm-actions">
                    <button type="button" class="kse-confirm-secondary" :disabled="Boolean(actionLoadingId)" @click="closeDelete">
                        Batal
                    </button>
                    <button type="button" class="kse-confirm-primary danger" :disabled="Boolean(actionLoadingId)" @click="confirmDelete">
                        <i :class="actionLoadingId ? 'ri-loader-4-line ri-spin' : 'ri-delete-bin-line'"></i>
                        <span>{{ actionLoadingId ? 'Menghapus...' : 'Hapus Data' }}</span>
                    </button>
                </div>
            </section>
        </div>
    </Teleport>

    <!-- Premium Review Modal -->
    <Teleport to="body">
        <div v-if="reviewModal" class="modal-overlay" @click.self="reviewModal = false">
            <div
                class="modal-dialog modal-dialog-centered custom-modal-size"
                style="width: min(84vw, 860px); max-width: 860px; margin: 1rem auto;"
            >
                <div class="modal-content review-modal-content border-0 shadow-lg overflow-hidden" style="border-radius: 24px; background: #fff; width: 100%; max-width: none;">
                    <!-- Modal Header -->
                    <div class="modal-header-premium review-modal-header p-4 d-flex align-items-center justify-content-between" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white;">
                        <div class="d-flex align-items-center gap-3 review-modal-header-main">
                            <div class="header-icon-box review-modal-icon-box rounded-3 d-flex align-items-center justify-content-center shadow-sm">
                                <i class="ri-edit-box-line fs-24"></i>
                            </div>
                            <div class="review-modal-header-copy">
                                <div class="review-modal-kicker">Review Pengajuan Perubahan</div>
                                <h4 class="mb-1 fw-bold tracking-tight text-white">Peninjauan Perubahan Data</h4>
                                <p class="mb-0 fs-13 text-white text-opacity-80 d-flex flex-wrap gap-2 align-items-center">
                                    <span class="review-modal-meta-pill">Sistem: <strong>{{ (selectedRequest as any)?.display_se_name }}</strong></span>
                                    <span class="review-modal-meta-pill">Oleh: <strong>{{ (selectedRequest as any)?.display_user_name }}</strong></span>
                                </p>
                            </div>
                        </div>
                        <button type="button" class="btn review-modal-close-btn" @click="reviewModal = false">
                            <i class="ri-close-line"></i>
                        </button>
                    </div>

                    <div class="modal-body p-0 review-modal-scroll-body" v-if="selectedRequest">
                        <!-- Upper Banner: User Message -->
                        <div v-if="(selectedRequest as any).catatan_user" class="p-4 review-user-note">
                            <div class="d-flex gap-3 review-user-note-inner">
                                <div class="flex-shrink-0">
                                    <div class="avatar avatar-md rounded-circle bg-info text-white shadow-sm">
                                        <i class="ri-message-3-line"></i>
                                    </div>
                                </div>
                                <div class="flex-grow-1">
                                    <div class="fs-11 fw-bold text-info text-uppercase mb-1">Pesan dari Pengaju (User)</div>
                                    <div class="fs-14 text-dark lh-sm review-user-note-text">
                                        "{{ (selectedRequest as any).catatan_user }}"
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="p-4 p-md-4 review-modal-body">
                            <!-- Comparison Grid Header -->
                            <div class="row g-0 mb-3 text-uppercase fs-10 fw-bold letter-spacing-1 text-muted px-2 review-grid-header">
                                <div class="col-md-4">Informasi / Parameter</div>
                                <div class="col-md-4">Data Saat Ini</div>
                                <div class="col-md-4">Perubahan Baru</div>
                            </div>

                            <!-- Comparison Rows -->
                            <div
                                class="comparison-container review-comparison-container rounded-4 overflow-hidden"
                                :class="{ 'review-comparison-scrollable': selectedRequestChangesCount > 1 }"
                            >
                                <div v-if="selectedRequestChangesCount === 0" class="p-5 text-center">
                                    <div class="text-muted fs-13 italic">
                                        <i class="ri-information-line fs-20 d-block mb-2"></i>
                                        Tidak ada perubahan data teknis yang perlu ditinjau.
                                    </div>
                                </div>
                                <template v-else>
                                    <div v-for="(val, key) in selectedRequestChanges" :key="key" 
                                         class="comparison-row review-comparison-row d-flex align-items-center p-3 bg-white transition-base">
                                        <div class="col-md-4 review-comparison-cell review-comparison-label">
                                            <div class="review-mobile-label">Informasi / Parameter</div>
                                            <div class="fw-bold text-slate fs-12">{{ assessmentLabels[key] || key.replace(/_/g, ' ') }}</div>
                                            <div class="text-muted fs-9 text-uppercase letter-spacing-1">{{ key }}</div>
                                        </div>
                                        <div class="col-md-4 review-comparison-cell">
                                            <div class="review-mobile-label">Data Saat Ini</div>
                                            <div class="review-value review-value-old text-muted fs-13 d-flex align-items-center gap-2">
                                                <i class="ri-history-line opacity-50"></i>
                                                {{ getOptionLabel(key, selectedRequest.se ? (selectedRequest.se as any)[key] : '-') }}
                                            </div>
                                        </div>
                                        <div class="col-md-4 review-comparison-cell">
                                            <div class="review-mobile-label">Perubahan Baru</div>
                                            <div class="review-value review-value-new text-primary fw-bold fs-13 d-flex align-items-center gap-2">
                                                <i class="ri-arrow-right-line opacity-50"></i>
                                                <span class="review-value-badge">{{ getOptionLabel(key, val) }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </template>
                            </div>

                            <!-- Admin Feedback Section -->
                            <div class="mt-4 p-4 rounded-4 review-feedback-card">
                                <div class="d-flex align-items-center gap-2 mb-3">
                                    <i class="ri-feedback-line text-primary fs-18"></i>
                                    <h6 class="mb-0 fw-bold fs-14">Umpan Balik Peninjauan</h6>
                                </div>
                                <textarea 
                                    v-model="adminNotes" 
                                    class="form-control review-feedback-input border-2 shadow-sm focus-ring-primary" 
                                    rows="3" 
                                    placeholder="Masukkan alasan persetujuan, penolakan, atau instruksi tambahan untuk stakeholder..."
                                    style="font-size: 13px;"
                                ></textarea>
                                <div class="d-flex align-items-center gap-2 mt-2 px-1">
                                    <i class="ri-information-fill text-muted fs-14"></i>
                                    <span class="text-muted fs-10 italic">Catatan ini akan langsung terkirim dan dapat dilihat oleh pengaju di dashboard mereka.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Modal Footer -->
                    <div class="modal-footer-premium review-modal-footer p-4 d-flex gap-3">
                        <button type="button" class="btn btn-primary-light rounded-pill px-4 fw-bold transition-base" @click="reviewModal = false">
                            Batal & Tutup
                        </button>
                        <div class="ms-auto d-flex gap-3 review-footer-actions">
                            <button type="button" class="btn btn-danger-light rounded-pill px-4 fw-bold d-flex align-items-center gap-2 transition-base" 
                                    :disabled="isSubmitting" @click="handleReview('rejected')">
                                <i class="ri-close-circle-line"></i> TOLAK PERUBAHAN
                            </button>
                            <button type="button" class="btn btn-success rounded-pill px-5 fw-bold d-flex align-items-center gap-2 transition-base shadow-sm" 
                                    :disabled="isSubmitting" @click="handleReview('approved')">
                                <i class="ri-checkbox-circle-line"></i> SETUJUI & UPDATE
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.kse-admin-page {
    --kse-blue: #2563eb;
    --kse-blue-dark: #1d4ed8;
    --kse-border: #e2e8f0;
    --kse-muted: #64748b;
    --kse-text: #0f172a;
    --kse-page-bg: #f6f9fc;
}

.kse-shell-card {
    background: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
}

.kse-shell-card > .stakeholder-header {
    display: none !important;
}

.kse-hero-header {
    align-items: center;
    background: linear-gradient(135deg, #06184f 0%, #183b91 52%, #2f76ea 100%);
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 22px;
    box-shadow: 0 18px 46px rgba(15, 23, 42, 0.16);
    color: #ffffff;
    display: flex;
    gap: 28px;
    justify-content: space-between;
    min-height: 152px;
    overflow: hidden;
    padding: 24px 26px;
    position: relative;
}

.kse-hero-header::after {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0));
    content: "";
    height: 1px;
    inset: 0 20px auto;
    position: absolute;
}

.kse-hero-content,
.kse-hero-tools {
    position: relative;
    z-index: 1;
}

.kse-hero-content {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
}

.kse-hero-copy {
    max-width: 820px;
}

.kse-inline-breadcrumb {
    color: #b9d7ff;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.2;
    margin-bottom: 8px;
}

.kse-inline-breadcrumb span {
    color: rgba(255, 255, 255, 0.58);
    margin: 0 5px;
}

.kse-hero-copy h1 {
    color: #ffffff;
    font-size: 32px;
    font-weight: 850;
    line-height: 1.05;
    margin: 0;
}

.kse-hero-copy p {
    color: rgba(255, 255, 255, 0.86);
    font-size: 16px;
    line-height: 1.45;
    margin: 10px 0 0;
}

.kse-hero-tools {
    flex: 0 1 360px;
    min-width: 300px;
}

.kse-hero-summary-card {
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.24);
    border-radius: 18px;
    box-shadow: 0 18px 38px rgba(2, 6, 23, 0.16);
    padding: 16px;
}

.kse-hero-summary-title,
.kse-hero-summary-stats {
    align-items: center;
    display: flex;
    justify-content: space-between;
}

.kse-hero-summary-title span,
.kse-hero-summary-stats span {
    color: rgba(255, 255, 255, 0.72);
    display: block;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
}

.kse-hero-summary-title strong {
    color: #ffffff;
    font-size: 30px;
    font-weight: 900;
    line-height: 1;
}

.kse-hero-summary-stats {
    gap: 14px;
    margin-top: 14px;
}

.kse-hero-summary-stats div {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    flex: 1;
    padding: 10px;
}

.kse-hero-summary-stats strong {
    color: #ffffff;
    display: block;
    font-size: 18px;
    font-weight: 850;
    margin-top: 2px;
}

.kse-hero-progress {
    background: rgba(255, 255, 255, 0.18);
    border-radius: 999px;
    height: 8px;
    margin-top: 14px;
    overflow: hidden;
}

.kse-hero-progress span {
    background: linear-gradient(90deg, #22c55e, #38bdf8);
    border-radius: inherit;
    display: block;
    height: 100%;
    transition: width 280ms ease;
}

.kse-kpi-grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(5, minmax(0, 1fr));
}

.kse-kpi-card {
    align-items: flex-start;
    background: #ffffff;
    border: 1px solid var(--kse-border);
    border-radius: 16px;
    box-shadow: 0 14px 32px rgba(15, 23, 42, 0.07);
    display: flex;
    gap: 12px;
    min-height: 118px;
    padding: 16px;
    transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.kse-kpi-card:hover {
    border-color: rgba(37, 99, 235, 0.32);
    box-shadow: 0 18px 38px rgba(37, 99, 235, 0.12);
    transform: translateY(-2px);
}

.kse-kpi-icon {
    align-items: center;
    border-radius: 14px;
    display: inline-flex;
    flex: 0 0 42px;
    font-size: 20px;
    height: 42px;
    justify-content: center;
    line-height: 1;
    width: 42px;
}

.kse-kpi-icon i {
    display: inline-flex;
    line-height: 1;
}

.kse-kpi-card span {
    color: var(--kse-muted);
    display: block;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
}

.kse-kpi-card strong {
    color: var(--kse-text);
    display: block;
    font-size: 28px;
    font-weight: 900;
    line-height: 1;
    margin: 8px 0 6px;
}

.kse-kpi-card small {
    color: var(--kse-muted);
    font-size: 12px;
    line-height: 1.3;
}

.tone-total .kse-kpi-icon { background: #dbeafe; color: #1d4ed8; }
.tone-danger .kse-kpi-icon { background: #fee2e2; color: #b91c1c; }
.tone-warning .kse-kpi-icon { background: #fef3c7; color: #b45309; }
.tone-success .kse-kpi-icon { background: #dcfce7; color: #15803d; }
.tone-review .kse-kpi-icon { background: #e0e7ff; color: #4f46e5; }
.tone-review.is-hot { border-color: rgba(79, 70, 229, 0.35); }

.kse-search {
    align-items: center;
    background: #ffffff;
    border: 1px solid var(--kse-border);
    border-radius: 14px;
    color: var(--kse-muted);
    display: flex;
    flex: 1 1 360px;
    gap: 8px;
    min-height: 42px;
    max-width: 520px;
    padding: 0 14px;
    transition: border-color 180ms ease, box-shadow 180ms ease;
}

.kse-search:focus-within {
    border-color: rgba(37, 99, 235, 0.55);
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
}

.kse-search input {
    background: transparent;
    border: 0;
    color: var(--kse-text);
    font-size: 13px;
    min-width: 0;
    outline: 0;
    width: 100%;
}

.kse-search button {
    align-items: center;
    background: transparent;
    border: 0;
    color: #2563eb;
    display: inline-flex;
    justify-content: center;
    padding: 0;
}

.kse-list-shell {
    border-radius: 16px !important;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08) !important;
    transform: none !important;
    filter: none !important;
}

.kse-quick-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.kse-toolbar-btn,
.kse-filter-pill {
    align-items: center;
    display: inline-flex;
    justify-content: center;
    min-height: 36px;
}

.kse-toolbar-btn {
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    border: 1px solid transparent;
    border-radius: 999px;
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.18);
    color: #ffffff;
    font-size: 12px;
    font-weight: 800;
    line-height: 1;
    padding: 0 16px;
    transition: transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
    white-space: nowrap;
}

.kse-toolbar-btn:hover:not(:disabled) {
    box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22);
    color: #ffffff;
    transform: translateY(-1px);
}

.kse-toolbar-btn i,
.kse-filter-pill {
    vertical-align: middle;
}

.kse-toolbar-btn:disabled {
    cursor: not-allowed;
    opacity: 0.75;
}

.kse-filter-pill {
    background: #f8fafc;
    border: 1px solid #dbe5f2;
    border-radius: 999px;
    color: #475569;
    font-size: 12px;
    font-weight: 800;
    line-height: 1;
    padding: 0 14px;
    transition: all 180ms ease;
    white-space: nowrap;
}

.kse-filter-pill:hover {
    border-color: rgba(37, 99, 235, 0.35);
    color: #1d4ed8;
}

.kse-filter-pill.active {
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    border-color: transparent;
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.18);
    color: #ffffff;
}

.kse-review-row {
    background: linear-gradient(90deg, rgba(254, 243, 199, 0.26), rgba(255, 255, 255, 0));
}

.kse-parent-row {
    background: #ffffff;
    transition: background-color 180ms ease, box-shadow 180ms ease;
    transform: none !important;
    filter: none !important;
}

.kse-parent-row.needs-review {
    background: linear-gradient(90deg, rgba(254, 243, 199, 0.35), rgba(255, 255, 255, 0));
}

.kse-parent-row.is-priority {
    box-shadow: inset 3px 0 0 rgba(239, 68, 68, 0.7);
}

.kse-parent-row.is-recent td {
    background-image: linear-gradient(90deg, rgba(224, 242, 254, 0.42), rgba(255, 255, 255, 0));
    background-repeat: no-repeat;
}

.kse-child-cell {
    background: #f7faff;
}

.kse-child-card {
    background: #ffffff;
    border: 1px solid #cfe0fb !important;
    border-left: 4px solid #3b82f6 !important;
    border-radius: 16px;
    margin-left: 18px;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
    transform: none !important;
    filter: none !important;
}

.kse-child-table {
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
}

.kse-child-table thead th {
    background: #f4f8ff !important;
    border-bottom: 1px solid #cfddf2 !important;
    color: #475569;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.04em;
    padding-top: 0.9rem;
    padding-bottom: 0.9rem;
    text-transform: uppercase;
    text-rendering: geometricPrecision;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

.kse-child-table tbody td {
    border-bottom: 1px solid #e6eef8;
    color: #1e293b;
    font-weight: 500;
    text-rendering: geometricPrecision;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

.kse-child-table tbody tr:last-child td {
    border-bottom: 0;
}

.kse-child-table .progress {
    background: #dbe7fb;
    border-radius: 999px;
    overflow: hidden;
}

.kse-child-table .progress-bar {
    background: #1d4ed8 !important;
    border-radius: 999px;
}

.kse-child-table .badge-sektor {
    border-width: 1.5px !important;
    font-size: 11px !important;
    font-weight: 800 !important;
    padding: 0.36rem 0.78rem !important;
}

.kse-child-table .badge.rounded-pill {
    font-size: 11px !important;
    font-weight: 800 !important;
    padding: 0.34rem 0.78rem !important;
}

.kse-child-table .text-primary {
    color: #1d4ed8 !important;
}

.kse-child-table thead th:first-child {
    border-top-left-radius: 12px;
}

.kse-child-table thead th:last-child {
    border-top-right-radius: 12px;
}

.kse-action-tooltip {
    position: relative;
}

.kse-action-tooltip::after {
    background: rgba(15, 23, 42, 0.92);
    border-radius: 8px;
    color: #ffffff;
    content: attr(data-kse-tooltip);
    font-size: 10px;
    font-weight: 700;
    left: 50%;
    opacity: 0;
    padding: 6px 8px;
    pointer-events: none;
    position: absolute;
    top: calc(-100% - 8px);
    transform: translateX(-50%) translateY(4px);
    transition: opacity 160ms ease, transform 160ms ease;
    white-space: nowrap;
    z-index: 5;
}

.kse-action-tooltip:hover::after,
.kse-action-tooltip:focus-visible::after {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}

.kse-skel-line,
.kse-skel-icon,
.kse-skel-pill,
.kse-skel-action {
    background: linear-gradient(90deg, #edf2f7 0%, #f8fafc 44%, #edf2f7 88%);
    background-size: 220% 100%;
    animation: kse-skeleton-shimmer 1.15s ease-in-out infinite;
    display: block;
}

.kse-skel-line {
    border-radius: 999px;
    height: 12px;
}

.kse-skel-kpi {
    height: 28px;
    margin: 8px 0 6px;
    width: 62px;
}

.kse-skel-index { height: 12px; margin: 0 auto; width: 24px; }
.kse-skel-title { height: 13px; margin-bottom: 8px; width: min(180px, 100%); }
.kse-skel-subtitle { height: 10px; width: min(120px, 80%); }
.kse-skel-icon { border-radius: 14px; height: 42px; width: 42px; }
.kse-skel-pill { border-radius: 999px; height: 28px; margin: 0 auto; width: 82px; }
.kse-skel-action { border-radius: 10px; height: 32px; width: 32px; }

@keyframes kse-skeleton-shimmer {
    0% { background-position: 120% 0; }
    100% { background-position: -120% 0; }
}

.kse-confirm-modal {
    background: #ffffff;
    border-radius: 22px;
    box-shadow: 0 28px 80px rgba(15, 23, 42, 0.24);
    max-width: min(92vw, 440px);
    padding: 1.5rem;
    position: relative;
    width: 440px;
}

.kse-confirm-close {
    align-items: center;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    color: #64748b;
    display: inline-flex;
    height: 34px;
    justify-content: center;
    position: absolute;
    right: 1rem;
    top: 1rem;
    width: 34px;
}

.kse-confirm-icon {
    align-items: center;
    border-radius: 18px;
    display: inline-flex;
    font-size: 26px;
    height: 54px;
    justify-content: center;
    width: 54px;
}

.kse-confirm-icon.danger {
    background: #fee2e2;
    color: #b91c1c;
}

.kse-confirm-copy h3 {
    color: #0f172a;
    font-size: 1.12rem;
    font-weight: 850;
    margin: 1rem 0 0.45rem;
}

.kse-confirm-copy p {
    color: #64748b;
    line-height: 1.55;
    margin: 0;
}

.kse-confirm-record {
    align-items: center;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    display: flex;
    justify-content: space-between;
    margin-top: 1rem;
    padding: 0.85rem 1rem;
}

.kse-confirm-record span {
    color: #475569;
    font-size: 0.85rem;
    font-weight: 700;
}

.kse-confirm-record strong {
    color: #1d4ed8;
    font-size: 0.78rem;
    text-transform: uppercase;
}

.kse-action-error {
    align-items: center;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 12px;
    color: #b91c1c;
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
    padding: 0.75rem 0.9rem;
}

.kse-confirm-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1.25rem;
}

.kse-confirm-secondary,
.kse-confirm-primary {
    align-items: center;
    border: 0;
    border-radius: 999px;
    display: inline-flex;
    font-weight: 800;
    gap: 0.45rem;
    justify-content: center;
    min-height: 42px;
    padding: 0 1.1rem;
}

.kse-confirm-secondary {
    background: #f1f5f9;
    color: #475569;
}

.kse-confirm-primary.danger {
    background: linear-gradient(135deg, #ef4444, #b91c1c);
    color: #ffffff;
}

.action-edit:hover {
    box-shadow: 0 10px 20px rgba(37, 99, 235, 0.18);
}

.action-delete:hover {
    box-shadow: 0 10px 20px rgba(239, 68, 68, 0.16);
}

@media (max-width: 1199.98px) {
    .kse-kpi-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

@media (max-width: 991.98px) {
    .kse-hero-header {
        align-items: stretch;
        flex-direction: column;
    }

    .kse-hero-tools {
        min-width: 0;
        width: 100%;
    }

    .kse-kpi-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .stakeholders-toolbar-right {
        flex-wrap: wrap;
        gap: 12px;
    }

    .kse-search {
        flex: 0 0 auto;
        max-width: none;
        order: 3;
        width: 100%;
    }
}

@media (max-width: 575.98px) {
    .kse-hero-header {
        border-radius: 18px;
        min-height: 0;
        padding: 20px;
    }

    .kse-hero-copy h1 {
        font-size: 26px;
    }

    .kse-hero-copy p {
        font-size: 14px;
    }

    .kse-kpi-grid {
        grid-template-columns: 1fr;
    }

    .stakeholders-toolbar-right {
        align-items: stretch !important;
        flex-direction: column;
        gap: 12px;
        justify-content: flex-start !important;
    }

    .stakeholders-per-page {
        align-self: center;
    }

    .kse-toolbar-btn {
        width: 100%;
    }

    .kse-search {
        flex: 0 0 auto;
        min-height: 48px;
        order: unset;
        padding: 0 14px;
        width: 100%;
    }

    .kse-search input {
        font-size: 14px;
    }

    .kse-quick-filters {
        gap: 10px;
        justify-content: flex-start;
    }

    .kse-confirm-actions {
        flex-direction: column;
    }

    .kse-confirm-actions button {
        width: 100%;
    }
}

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

.review-modal-content {
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 2rem);
    box-shadow: 0 28px 80px rgba(15, 23, 42, 0.24) !important;
}

.review-modal-scroll-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
}

.review-modal-scroll-body::-webkit-scrollbar {
    width: 8px;
}

.review-modal-scroll-body::-webkit-scrollbar-track {
    background: transparent;
}

.review-modal-scroll-body::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.45);
    border-radius: 999px;
}

.review-modal-header {
    gap: 1rem;
}

.review-modal-header-main {
    min-width: 0;
    flex: 1;
}

.review-modal-header-copy {
    min-width: 0;
}

.review-modal-icon-box {
    width: 48px;
    height: 48px;
    background: rgba(15, 23, 42, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.24);
    color: #ffffff;
}

.review-modal-icon-box i {
    color: currentColor;
    line-height: 1;
}

.review-modal-kicker {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.72);
    margin-bottom: 0.25rem;
}

.review-modal-meta-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
    backdrop-filter: blur(8px);
}

.review-modal-close-btn {
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

.review-modal-close-btn:hover {
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
    transform: rotate(90deg);
}

.review-modal-close-btn i {
    font-size: 20px;
    line-height: 1;
}

.review-user-note {
    background: linear-gradient(180deg, rgba(14, 165, 233, 0.08) 0%, rgba(255, 255, 255, 0.92) 100%);
    border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.review-user-note-text {
    color: #334155 !important;
    font-style: italic;
}

.review-modal-body {
    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}

.review-grid-header {
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
}

.review-mobile-label {
    display: none;
    margin-bottom: 0.35rem;
    font-size: 0.63rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
}

.review-comparison-container {
    background: #ffffff;
    border: 1px solid #dbe7f5;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
}

.review-comparison-scrollable {
    max-height: min(44vh, 420px);
    overflow-y: auto !important;
    overscroll-behavior: contain;
}

.review-comparison-scrollable::-webkit-scrollbar {
    width: 8px;
}

.review-comparison-scrollable::-webkit-scrollbar-track {
    background: transparent;
}

.review-comparison-scrollable::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.55);
    border-radius: 999px;
}

.review-comparison-row {
    min-height: 88px;
    border-bottom: 1px solid #e9f0f8;
}

.review-comparison-cell {
    min-width: 0;
}

.review-comparison-label {
    padding-right: 0.75rem;
}

.review-comparison-row:last-child {
    border-bottom: none;
}

.review-value {
    line-height: 1.5;
}

.review-value-old {
    color: #64748b !important;
}

.review-value-new {
    color: #1d4ed8 !important;
}

.review-value-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.55rem 0.8rem;
    border-radius: 12px;
    background: linear-gradient(180deg, #eef4ff 0%, #dbeafe 100%);
    color: #1d4ed8;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.review-feedback-card {
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    border: 1px dashed #cbd5e1;
}

.review-feedback-input {
    border-radius: 16px !important;
    border-color: #d7e2f0 !important;
    padding: 0.9rem 1rem !important;
    min-height: 108px;
    resize: vertical;
}

.review-feedback-input:focus {
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 0.2rem rgba(59, 130, 246, 0.12) !important;
}

.review-modal-footer {
    position: sticky;
    bottom: 0;
    z-index: 2;
    flex-shrink: 0;
    border-top: 1px solid #e5edf6;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.transition-base:hover {
    transform: translateY(-1px);
}

@media (max-width: 767.98px) {
    .custom-modal-size {
        width: min(94vw, 94vw) !important;
        max-width: 94vw !important;
        margin: 0.65rem auto !important;
    }

    .review-modal-content {
        max-height: calc(100vh - 1.3rem);
    }

    .review-modal-scroll-body {
        overflow-y: auto;
    }

    .review-modal-header {
        align-items: flex-start !important;
        gap: 0.75rem;
        padding: 1rem !important;
    }

    .review-modal-header-main {
        align-items: flex-start !important;
        gap: 0.7rem !important;
    }

    .review-modal-header .header-icon-box {
        width: 40px !important;
        height: 40px !important;
        border-radius: 12px !important;
    }

    .review-modal-header .header-icon-box i {
        font-size: 18px !important;
    }

    .review-modal-kicker {
        font-size: 0.62rem;
        margin-bottom: 0.15rem;
    }

    .review-modal-header-copy h4 {
        font-size: 0.98rem;
        line-height: 1.2;
        max-width: 11ch;
    }

    .review-modal-meta-pill {
        width: calc(50% - 0.25rem);
        min-width: 0;
        justify-content: flex-start;
        align-items: center;
        flex-wrap: nowrap;
        white-space: nowrap;
        padding: 0.24rem 0.65rem;
        font-size: 0.78rem;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .review-modal-meta-pill strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .review-modal-close-btn {
        flex-shrink: 0;
        width: 34px;
        height: 34px;
        margin-top: 0;
    }

    .review-modal-close-btn i {
        font-size: 17px;
    }

    .review-user-note,
    .review-modal-body,
    .review-modal-footer {
        padding-left: 1.25rem !important;
        padding-right: 1.25rem !important;
    }

    .review-user-note-inner {
        align-items: flex-start !important;
    }

    .review-grid-header {
        display: none !important;
    }

    .review-comparison-row {
        align-items: stretch !important;
        flex-direction: column;
        gap: 0.9rem;
        padding: 1rem !important;
    }

    .review-comparison-scrollable {
        max-height: min(24vh, 220px);
    }

    .review-comparison-cell {
        width: 100% !important;
        max-width: 100% !important;
        flex: 0 0 100% !important;
    }

    .review-comparison-label {
        padding-right: 0;
    }

    .review-mobile-label {
        display: block;
    }

    .review-value {
        align-items: flex-start !important;
        gap: 0.5rem !important;
    }

    .review-value-badge {
        width: 100%;
        justify-content: flex-start;
        line-height: 1.45;
    }

    .review-feedback-card {
        padding: 1rem !important;
    }

    .review-feedback-input {
        min-height: 96px;
    }

    .review-footer-actions {
        width: 100%;
        margin-left: 0 !important;
        flex-direction: column;
        gap: 0.75rem !important;
    }

    .review-footer-actions .btn,
    .review-modal-footer > .btn {
        width: 100%;
        justify-content: center;
        min-height: 46px;
    }

    .review-modal-footer {
        flex-direction: column;
        padding-top: 1rem !important;
        padding-bottom: 1rem !important;
        box-shadow: 0 -10px 24px rgba(15, 23, 42, 0.08);
    }
}

.kse-modal-box {
    background: #fff;
    border-radius: 20px;
    padding: 1.75rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.kse-modal-icon-wrap {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
}

.kse-modal-title {
    font-size: 1.1rem;
    font-weight: 800;
    color: #1e293b;
}

.stakeholders-meta-card.active-meta {
    border-color: #3b82f6 !important;
    background: rgba(59, 130, 246, 0.1) !important;
}

.stakeholders-meta-card.active-meta .stakeholders-meta-label {
    color: #3b82f6 !important;
}

.pulse-icon {
    animation: pulse-orange 2s infinite;
}

@keyframes pulse-orange {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
}

.stakeholder-row {
    animation: fadeIn 0.4s ease-out both;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}

.spinner-spin {
    display: inline-block;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.data-comparison-card::-webkit-scrollbar {
    width: 6px;
}
.data-comparison-card::-webkit-scrollbar-track {
    background: transparent;
}
.data-comparison-card::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.1);
    border-radius: 10px;
}

[data-theme-mode="dark"] .kse-modal-box {
    background: #1e293b;
    color: #f1f5f9;
}

[data-theme-mode="dark"] .kse-modal-title,
[data-theme-mode="dark"] .text-dark {
    color: #f1f5f9 !important;
}

[data-theme-mode="dark"] .data-comparison-card {
    background: rgba(0,0,0,0.2) !important;
    border-color: rgba(255,255,255,0.05) !important;
}

.stakeholders-action-btn {
  border-radius: 10px !important;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
  box-shadow: none !important;
  filter: none !important;
  transform: none !important;
  border-width: 1px !important;
}

.stakeholders-action-btn:hover {
  transform: none !important;
}

.hover-opacity-100:hover {
  opacity: 1 !important;
}

.expansion-toggle-lms {
    width: 24px;
    height: 24px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #fff !important;
    border: 1px solid #dee2e6 !important;
    color: #495057;
    transition: all 0.3s ease;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.expansion-toggle-lms i {
    font-size: 14px;
    transition: transform 0.3s ease;
}

.expansion-toggle-lms.active {
    border-color: #3b82f6 !important;
    color: #3b82f6;
}

.expansion-toggle-lms.active i {
    transform: rotate(90deg);
}

.expansion-toggle-lms:hover {
    background: #f8f9fa !important;
    border-color: #adb5bd !important;
}

.lms-table-row {
    transition: background-color 0.18s ease, color 0.18s ease;
    will-change: auto;
    backface-visibility: hidden;
    transform: translateZ(0);
}

.clickable-row {
    cursor: pointer;
}

.clickable-row:hover {
    background-color: rgba(59, 130, 246, 0.04) !important;
}

.lms-table-row.expanded-parent {
    background-color: rgba(59, 130, 246, 0.02) !important;
}

.lms-style-table thead th {
    border-top: none;
    background-color: #f8fbff !important;
    color: #475569 !important;
    font-weight: 800 !important;
    font-size: 0.74rem !important;
    letter-spacing: 0.06em;
    border-bottom: 1px solid #dbe5f2 !important;
    padding: 0.95rem 1.1rem !important;
    text-transform: uppercase;
    white-space: nowrap;
    text-rendering: geometricPrecision;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

.lms-style-table tbody tr {
    border-bottom: 1px solid #e8eef7;
}

.lms-style-table tbody td {
    color: #1e293b;
    text-rendering: geometricPrecision;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

.kse-admin-page .text-muted {
    color: #64748b !important;
}

.kse-admin-page .badge,
.kse-admin-page .badge-sektor {
    font-weight: 700;
    letter-spacing: 0.01em;
    box-shadow: none !important;
    filter: none !important;
    backdrop-filter: none !important;
}

.ri-spin {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

/* Match User List Stats Style */
.stakeholders-meta-stack {
  display: flex !important;
  gap: 10px !important;
  flex-wrap: wrap !important;
  justify-content: flex-start !important;
  width: 100% !important;
}

.stakeholders-meta-card {
  flex: 1 1 auto !important;
  min-width: 100px !important;
  max-width: 140px !important;
  width: auto !important;
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 12px !important;
  padding: 8px 10px !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  transition: all 0.3s ease !important;
  box-shadow: none !important;
}

.stakeholders-meta-card:hover {
  background: rgba(255, 255, 255, 0.08) !important;
  transform: translateY(-2px);
}

.stakeholders-meta-card.active-review {
  background: rgba(99, 102, 241, 0.1) !important;
  border-color: rgba(99, 102, 241, 0.2) !important;
}

.stakeholders-meta-label {
  font-size: 9px !important;
  text-transform: uppercase !important;
  font-weight: 700 !important;
  color: rgba(255, 255, 255, 0.6) !important;
  margin-bottom: 4px !important;
  white-space: nowrap !important;
}

.stakeholders-meta-card strong {
  font-size: 18px !important;
  color: white !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}

.stakeholders-meta-card strong i {
  font-size: 16px !important;
}

/* Utility Colors */
.text-indigo { color: #818cf8 !important; }
.text-info { color: #22d3ee !important; }
.text-warning { color: #fbbf24 !important; }
.text-danger { color: #f87171 !important; }

</style>

<style>
[data-theme-mode="dark"] .kse-admin-page .kse-kpi-card,
html.dark .kse-admin-page .kse-kpi-card,
[data-theme-mode="dark"] .kse-admin-page .kse-search,
html.dark .kse-admin-page .kse-search,
[data-theme-mode="dark"] .kse-confirm-modal,
html.dark .kse-confirm-modal {
    background: #08111f !important;
    border-color: rgba(148, 163, 184, 0.18) !important;
    color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .kse-admin-page .kse-hero-header,
html.dark .kse-admin-page .kse-hero-header {
    background:
        linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(15, 42, 83, 0.9) 48%, rgba(30, 64, 175, 0.82)),
        radial-gradient(circle at 20% 16%, rgba(96, 165, 250, 0.26), transparent 32%) !important;
    border-color: rgba(96, 165, 250, 0.24) !important;
    box-shadow: 0 20px 54px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
}

[data-theme-mode="dark"] .kse-admin-page .kse-kpi-card strong,
html.dark .kse-admin-page .kse-kpi-card strong,
[data-theme-mode="dark"] .kse-confirm-copy h3,
html.dark .kse-confirm-copy h3 {
    color: #f8fafc !important;
}

[data-theme-mode="dark"] .kse-admin-page .kse-kpi-card span,
[data-theme-mode="dark"] .kse-admin-page .kse-kpi-card small,
html.dark .kse-admin-page .kse-kpi-card span,
html.dark .kse-admin-page .kse-kpi-card small,
[data-theme-mode="dark"] .kse-confirm-copy p,
html.dark .kse-confirm-copy p {
    color: #94a3b8 !important;
}

[data-theme-mode="dark"] .kse-admin-page .kse-search input,
html.dark .kse-admin-page .kse-search input {
    color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .kse-confirm-record,
[data-theme-mode="dark"] .kse-confirm-close,
html.dark .kse-confirm-record,
html.dark .kse-confirm-close {
    background: #0b1220 !important;
    border-color: rgba(148, 163, 184, 0.2) !important;
}

[data-theme-mode="dark"] .kse-admin-page .header-search-input,
html.dark .kse-admin-page .header-search-input {
    background: #0b1220 !important;
    border-color: rgba(148, 163, 184, 0.32) !important;
    color: #e2e8f0 !important;
    box-shadow: none !important;
}

[data-theme-mode="dark"] .kse-admin-page .header-search-input::placeholder,
html.dark .kse-admin-page .header-search-input::placeholder {
    color: #64748b !important;
}

[data-theme-mode="dark"] .kse-admin-page .header-search-icon,
[data-theme-mode="dark"] .kse-admin-page .clear-btn,
html.dark .kse-admin-page .header-search-icon,
html.dark .kse-admin-page .clear-btn {
    color: #93c5fd !important;
}

[data-theme-mode="dark"] .kse-admin-page .stakeholders-toolbar,
html.dark .kse-admin-page .stakeholders-toolbar,
[data-theme-mode="dark"] .kse-admin-page .card.custom-card.shadow-sm,
html.dark .kse-admin-page .card.custom-card.shadow-sm,
[data-theme-mode="dark"] .kse-admin-page .stakeholders-premium-body,
html.dark .kse-admin-page .stakeholders-premium-body {
    background: #08111f !important;
    border-color: rgba(148, 163, 184, 0.16) !important;
}

[data-theme-mode="dark"] .kse-admin-page .entries-select,
html.dark .kse-admin-page .entries-select {
    background-color: #0b1220 !important;
    border-color: rgba(148, 163, 184, 0.32) !important;
    color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .kse-admin-page .entries-select option,
html.dark .kse-admin-page .entries-select option {
    background: #0b1220 !important;
    color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .kse-admin-page .kse-filter-pill,
html.dark .kse-admin-page .kse-filter-pill {
    background: #0b1220 !important;
    border-color: rgba(148, 163, 184, 0.3) !important;
    color: #cbd5e1 !important;
    box-shadow: none !important;
}

[data-theme-mode="dark"] .kse-admin-page .kse-filter-pill:hover,
html.dark .kse-admin-page .kse-filter-pill:hover {
    background: rgba(37, 99, 235, 0.14) !important;
    border-color: rgba(96, 165, 250, 0.5) !important;
    color: #93c5fd !important;
}

[data-theme-mode="dark"] .kse-admin-page .kse-filter-pill.active,
html.dark .kse-admin-page .kse-filter-pill.active {
    background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
    border-color: transparent !important;
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.24) !important;
    color: #ffffff !important;
}

[data-theme-mode="dark"] .kse-admin-page .bg-warning-transparent.border-bottom,
html.dark .kse-admin-page .bg-warning-transparent.border-bottom {
    background: linear-gradient(180deg, rgba(245, 158, 11, 0.11) 0%, #0b1220 100%) !important;
    border-color: rgba(148, 163, 184, 0.16) !important;
}

[data-theme-mode="dark"] .kse-admin-page .bg-warning-transparent.border-bottom h6,
html.dark .kse-admin-page .bg-warning-transparent.border-bottom h6 {
    color: #f8fafc !important;
}

[data-theme-mode="dark"] .kse-admin-page .stakeholder-table-wrap.bg-white,
[data-theme-mode="dark"] .kse-admin-page .table-responsive,
html.dark .kse-admin-page .stakeholder-table-wrap.bg-white,
html.dark .kse-admin-page .table-responsive {
    background: #08111f !important;
    border-color: rgba(148, 163, 184, 0.2) !important;
}

[data-theme-mode="dark"] .kse-admin-page .lms-style-table,
html.dark .kse-admin-page .lms-style-table {
    --bs-table-bg: #08111f !important;
    --bs-table-color: #dbeafe !important;
    --bs-table-hover-bg: rgba(37, 99, 235, 0.12) !important;
    --bs-table-hover-color: #f8fafc !important;
    background: #08111f !important;
    color: #dbeafe !important;
    border-color: rgba(148, 163, 184, 0.18) !important;
}

[data-theme-mode="dark"] .kse-admin-page .lms-style-table thead,
[data-theme-mode="dark"] .kse-admin-page .lms-style-table thead tr,
[data-theme-mode="dark"] .kse-admin-page .lms-style-table thead th,
html.dark .kse-admin-page .lms-style-table thead,
html.dark .kse-admin-page .lms-style-table thead tr,
html.dark .kse-admin-page .lms-style-table thead th {
    background: #111c2e !important;
    background-color: #111c2e !important;
    border-color: rgba(148, 163, 184, 0.22) !important;
    color: #a9bad2 !important;
}

[data-theme-mode="dark"] .kse-admin-page .lms-style-table tbody,
[data-theme-mode="dark"] .kse-admin-page .lms-style-table tbody tr,
[data-theme-mode="dark"] .kse-admin-page .lms-style-table tbody td,
html.dark .kse-admin-page .lms-style-table tbody,
html.dark .kse-admin-page .lms-style-table tbody tr,
html.dark .kse-admin-page .lms-style-table tbody td {
    background: #08111f !important;
    background-color: #08111f !important;
    border-color: rgba(148, 163, 184, 0.18) !important;
    color: #dbeafe !important;
}

[data-theme-mode="dark"] .kse-admin-page .lms-style-table tbody tr:hover,
html.dark .kse-admin-page .lms-style-table tbody tr:hover {
    background: rgba(37, 99, 235, 0.12) !important;
    background-color: rgba(37, 99, 235, 0.12) !important;
}

[data-theme-mode="dark"] .kse-admin-page .text-dark,
html.dark .kse-admin-page .text-dark {
    color: #f8fafc !important;
}

[data-theme-mode="dark"] .kse-admin-page .text-muted,
html.dark .kse-admin-page .text-muted {
    color: #94a3b8 !important;
}

[data-theme-mode="dark"] .kse-admin-page .expansion-toggle-lms,
html.dark .kse-admin-page .expansion-toggle-lms {
    background: #0f172a !important;
    border-color: rgba(148, 163, 184, 0.28) !important;
    color: #cbd5e1 !important;
}

[data-theme-mode="dark"] .kse-admin-page .expansion-row > td,
html.dark .kse-admin-page .expansion-row > td {
    background: #07111f !important;
}

[data-theme-mode="dark"] .kse-admin-page .expansion-row .custom-card,
html.dark .kse-admin-page .expansion-row .custom-card {
    background: #0b1220 !important;
    border-color: rgba(59, 130, 246, 0.38) !important;
}

[data-theme-mode="dark"] .kse-admin-page .expansion-row .bg-white,
[data-theme-mode="dark"] .kse-admin-page .expansion-row .bg-light,
html.dark .kse-admin-page .expansion-row .bg-white,
html.dark .kse-admin-page .expansion-row .bg-light {
    background: #111c2e !important;
    border-color: rgba(148, 163, 184, 0.18) !important;
}

[data-theme-mode="dark"] .kse-admin-page .expansion-row .badge.bg-light,
html.dark .kse-admin-page .expansion-row .badge.bg-light {
    background: rgba(148, 163, 184, 0.14) !important;
    color: #cbd5e1 !important;
}

[data-theme-mode="dark"] .review-modal-content,
[data-theme-mode="dark"] .review-modal-body,
html.dark .review-modal-content,
html.dark .review-modal-body,
html.dark .review-modal-footer,
[data-theme-mode="dark"] .review-modal-footer {
    background: #08111f !important;
    border-color: rgba(148, 163, 184, 0.16) !important;
    color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .review-modal-header,
html.dark .review-modal-header {
    background: linear-gradient(135deg, #10265a 0%, #1d4ed8 100%) !important;
    color: #f8fafc !important;
}

[data-theme-mode="dark"] .review-modal-header h4,
[data-theme-mode="dark"] .review-modal-header .text-white,
html.dark .review-modal-header h4,
html.dark .review-modal-header .text-white {
    color: #f8fafc !important;
}

[data-theme-mode="dark"] .review-modal-icon-box,
html.dark .review-modal-icon-box {
    background: rgba(15, 23, 42, 0.48) !important;
    border: 1px solid rgba(191, 219, 254, 0.22);
    color: #dbeafe !important;
}

[data-theme-mode="dark"] .review-modal-icon-box i,
html.dark .review-modal-icon-box i {
    color: #dbeafe !important;
}

[data-theme-mode="dark"] .review-modal-kicker,
html.dark .review-modal-kicker {
    color: #bfdbfe !important;
}

[data-theme-mode="dark"] .review-modal-meta-pill,
html.dark .review-modal-meta-pill {
    background: rgba(219, 234, 254, 0.14) !important;
    color: #dbeafe !important;
}

[data-theme-mode="dark"] .review-user-note,
html.dark .review-user-note {
    background: linear-gradient(180deg, rgba(14, 165, 233, 0.18) 0%, rgba(8, 17, 31, 0.96) 100%) !important;
    border-bottom-color: rgba(148, 163, 184, 0.18) !important;
}

[data-theme-mode="dark"] .review-user-note-text,
html.dark .review-user-note-text {
    color: #f8fafc !important;
}

[data-theme-mode="dark"] .review-grid-header,
html.dark .review-grid-header,
[data-theme-mode="dark"] .review-mobile-label,
html.dark .review-mobile-label {
    color: #94a3b8 !important;
}

[data-theme-mode="dark"] .review-comparison-container,
[data-theme-mode="dark"] .review-comparison-row,
[data-theme-mode="dark"] .review-feedback-card,
html.dark .review-comparison-container,
html.dark .review-comparison-row,
html.dark .review-feedback-card {
    background: #0b1220 !important;
    border-color: rgba(148, 163, 184, 0.18) !important;
}

[data-theme-mode="dark"] .review-comparison-label .fw-bold,
[data-theme-mode="dark"] .review-feedback-card h6,
html.dark .review-comparison-label .fw-bold,
html.dark .review-feedback-card h6 {
    color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .review-value-old,
html.dark .review-value-old {
    color: #94a3b8 !important;
}

[data-theme-mode="dark"] .review-value-new,
html.dark .review-value-new {
    color: #93c5fd !important;
}

[data-theme-mode="dark"] .review-value-badge,
html.dark .review-value-badge {
    background: rgba(37, 99, 235, 0.2) !important;
    color: #bfdbfe !important;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
}

[data-theme-mode="dark"] .review-feedback-input,
html.dark .review-feedback-input {
    background: #111c2e !important;
    border-color: rgba(148, 163, 184, 0.24) !important;
    color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .review-feedback-input::placeholder,
html.dark .review-feedback-input::placeholder {
    color: #7f8ea3 !important;
}

[data-theme-mode="dark"] .review-modal-footer .btn-primary-light,
html.dark .review-modal-footer .btn-primary-light {
    background: rgba(37, 99, 235, 0.12) !important;
    border-color: rgba(37, 99, 235, 0.18) !important;
    color: #93c5fd !important;
}

[data-theme-mode="dark"] .review-modal-footer .btn-danger-light,
html.dark .review-modal-footer .btn-danger-light {
    background: rgba(239, 68, 68, 0.14) !important;
    border-color: rgba(239, 68, 68, 0.2) !important;
    color: #f87171 !important;
}

.custom-modal-size {
    max-width: 860px !important;
    width: min(84vw, 860px) !important;
    margin: 1rem auto !important;
}

.custom-modal-size .modal-content {
    width: 100%;
}

@media (max-width: 1200px) {
    .custom-modal-size {
        max-width: 96% !important;
        width: 96% !important;
        margin: 0.75rem auto !important;
    }
}
</style>
