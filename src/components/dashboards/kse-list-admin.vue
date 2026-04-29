<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
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
const seList = ref<SeCsirt[]>([]);
const userList = ref<User[]>([]);
const editRequests = ref<SeEditRequest[]>([]);
const loading = ref(true);
const searchQuery = ref('');

// Pagination State
const currentPage = ref(1);
const itemsPerPage = ref(10);

// Review Modal State
const reviewModal = ref(false);
const selectedRequest = ref<SeEditRequest | null>(null);
const adminNotes = ref('');
const isSubmitting = ref(false);

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

onMounted(fetchData);

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

const countStrategis = computed(() => seList.value.filter(s => s.kategori_se === 'Strategis').length);
const countTinggi    = computed(() => seList.value.filter(s => s.kategori_se === 'Tinggi').length);
const countRendah    = computed(() => seList.value.filter(s => s.kategori_se === 'Rendah').length);

const filteredSeList = computed(() => {
    const q = searchQuery.value.toLowerCase();
    return seList.value.filter(se => {
        const stakeholder = getFullStakeholder(se);
        return se.nama_se?.toLowerCase().includes(q) ||
               stakeholder?.nama_perusahaan?.toLowerCase().includes(q) ||
               se.perusahaan?.nama_perusahaan?.toLowerCase().includes(q);
    });
});

const paginatedSeList = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    const end = start + itemsPerPage.value;
    return filteredSeList.value.slice(start, end);
});

const totalSePages = computed(() => Math.ceil(filteredSeList.value.length / itemsPerPage.value));

const paginatedRequests = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    const end = start + itemsPerPage.value;
    return enrichedRequests.value.slice(start, end);
});

const totalRequestPages = computed(() => Math.ceil(enrichedRequests.value.length / itemsPerPage.value));

const refreshData = () => {
    fetchData();
};

// Actions
const viewDetail = (se: SeCsirt) => {
    // Redirect to the stakeholder's KSE list view
    // Attempt to find the stakeholder from the store to get the correct slug
    const companyId = se.id_perusahaan || se.perusahaan?.id;
    const stakeholder = stakeholdersStore.stakeholders.find(s => String(s.id) === String(companyId));
    const slug = stakeholder?.slug || se.perusahaan?.slug || '';
    
    if (slug) {
        router.push({ path: '/kse', query: { slug, from: 'admin' } });
    } else {
        console.error('Could not find slug for SE:', se);
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
const expandedRows = ref<Set<number>>(new Set());
const toggleExpand = (id: number) => {
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

const getFilteredChangesCount = (req: any) => Object.keys(getFilteredChanges(req)).length;

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
</script>

<template>
    <Pageheader :propData="pageData" />

    <div class="row">
        <div class="col-xl-12">
            <!-- Premium Shell Card -->
            <div class="card custom-card gradient-header-card stakeholders-shell-card" style="overflow: visible !important;">
                
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
                                    placeholder="Cari sistem elektronik atau pengaju..."
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

                    <!-- ══ TABLE CONTROLS ══════════════════════════════════════════ -->
                    <div class="controls-bar stakeholders-toolbar stakeholders-filter-bar mb-4">
                        <div class="stakeholders-toolbar-right w-100 d-flex align-items-center justify-content-between">
                            <div class="stakeholders-per-page">
                                <span>Rows</span>
                                <select v-model="itemsPerPage" class="form-select form-select-sm entries-select" @change="currentPage = 1">
                                    <option v-for="n in [5, 10, 15, 20, 25, 50]" :key="n" :value="n">{{ n }}</option>
                                </select>
                            </div>
                            <button class="btn stakeholders-add-btn d-flex align-items-center gap-2" @click="refreshData" :disabled="loading">
                                <i class="ri-refresh-line" :class="{ 'ri-spin': loading }"></i>
                                <span class="btn-text">Refresh Data</span>
                            </button>
                        </div>
                    </div>

                    <!-- Unified LMS Card Table Shell -->
                    <div class="card custom-card shadow-sm border-0 overflow-hidden">
                        
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
                                        <tr v-for="(req, idx) in pendingRequests" :key="req.id">
                                            <td class="text-center text-muted fw-bold">{{ idx + 1 }}</td>
                                            <td>
                                                <div class="d-flex align-items-center gap-2">
                                                    <div class="avatar avatar-xs rounded-circle bg-primary-transparent text-primary">
                                                        {{ (req.user?.name || req.user?.display_name || 'U').charAt(0).toUpperCase() }}
                                                    </div>
                                                    <div>
                                                        <div class="text-dark fw-bold fs-12">{{ req.display_user_name }}</div>
                                                        <div class="text-muted fs-10">{{ req.user?.email || '-' }}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div class="text-dark fw-bold fs-12 mb-0">{{ req.display_se_name }}</div>
                                                <div class="text-muted fs-10">{{ req.display_perusahaan }}</div>
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
                                                    <button class="btn btn-sm btn-icon btn-primary-light" @click="openReview(req)" title="Tinjau">
                                                        <i class="ri-eye-line"></i>
                                                    </button>
                                                    <button class="btn btn-sm btn-icon btn-success-light" @click="approveRequest(req)" title="Setujui">
                                                        <i class="ri-check-line"></i>
                                                    </button>
                                                    <button class="btn btn-sm btn-icon btn-danger-light" @click="rejectRequest(req)" title="Tolak">
                                                        <i class="ri-close-line"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- 2. ALL SYSTEMS LIST -->
                        <div class="table-responsive">
                            <table class="table table-hover mb-0 align-middle lms-style-table">
                                <thead class="stakeholder-thead">
                                    <tr>
                                        <th class="text-center" style="width: 50px;">NO</th>
                                        <th>Nama Sistem Elektronik</th>
                                        <th>Stakeholder</th>
                                        <th class="text-center" style="width: 140px;">Kategori</th>
                                        <th class="text-center" style="width: 120px;">Status</th>
                                        <th style="width: 220px;">Dibuat / Diperbarui</th>
                                        <th class="text-center" style="width: 150px;">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-if="loading && seList.length === 0">
                                        <td colspan="7" class="text-center py-5">
                                            <div class="spinner-border text-primary" role="status"></div>
                                        </td>
                                    </tr>
                                    <tr v-else-if="filteredSeList.length === 0">
                                        <td colspan="7" class="text-center py-5">
                                            <div class="empty-state py-5">
                                                <div class="empty-icon-ring mb-3"><div class="empty-icon-inner"><i class="ri-computer-line"></i></div></div>
                                                <h6 class="fw-bold empty-state-title">Tidak ada sistem ditemukan</h6>
                                                <p class="text-muted fs-13">Coba ubah kata kunci pencarian Anda</p>
                                            </div>
                                        </td>
                                    </tr>
                                    
                                    <template v-for="(se, idx) in paginatedSeList" :key="se.id">
                                        <!-- Main Row -->
                                        <tr class="lms-table-row clickable-row" 
                                            :class="{ 'expanded-parent': expandedRows.has(se.id) }"
                                            @click="toggleExpand(se.id)">
                                            <td class="text-center text-muted fw-bold fs-13">{{ (currentPage - 1) * itemsPerPage + idx + 1 }}</td>
                                            <td>
                                                <div class="d-flex align-items-center gap-2">
                                                    <!-- Expansion Arrow in Circle -->
                                                    <button class="btn btn-sm btn-icon btn-light rounded-circle expansion-toggle-lms" 
                                                            :class="{ 'active': expandedRows.has(se.id) }"
                                                            @click.stop="toggleExpand(se.id)">
                                                        <i class="ri-arrow-right-s-line"></i>
                                                    </button>
                                                    
                                                    <!-- System Info -->
                                                    <div class="d-flex align-items-center gap-3 ms-1">
                                                        <div class="avatar avatar-md rounded-3 bg-danger text-white shadow-sm flex-shrink-0" style="width: 42px; height: 42px;">
                                                            <i class="ri-macbook-line fs-20"></i>
                                                        </div>
                                                        <div class="overflow-hidden">
                                                            <div class="fw-bold text-dark fs-14 text-truncate" style="max-width: 250px;" :title="se.nama_se">{{ se.nama_se }}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div class="d-flex align-items-center gap-2">
                                                    <div class="avatar avatar-xs rounded-circle bg-primary-transparent text-primary flex-shrink-0" style="width: 28px; height: 28px; font-size: 10px;">
                                                        <i class="ri-government-line"></i>
                                                    </div>
                                                    <div class="fw-medium text-dark fs-12 text-truncate" style="max-width: 180px;">
                                                        {{ getFullStakeholder(se)?.nama_perusahaan || se.perusahaan?.nama_perusahaan || 'N/A' }}
                                                    </div>
                                                </div>
                                            </td>
                                            <td class="text-center">
                                                <span class="badge-sektor" :class="getCategoryBadge(se.kategori_se || '')">
                                                    {{ se.kategori_se || 'N/A' }}
                                                </span>
                                            </td>
                                            <td class="text-center">
                                                <span class="badge rounded-pill px-3 py-2 bg-success-transparent text-success fw-bold fs-10">
                                                    <i class="ri-lock-fill me-1"></i> FINAL
                                                </span>
                                            </td>
                                            <td>
                                                <div class="d-flex flex-column gap-1">
                                                    <div class="text-dark fs-12 fw-medium d-flex align-items-center gap-2">
                                                        <i class="ri-calendar-line text-muted"></i> {{ formatDate(se.created_at || '') }}
                                                    </div>
                                                    <div class="text-muted fs-11 d-flex align-items-center gap-2">
                                                        <i class="ri-time-line text-muted"></i> {{ formatDate(se.updated_at || se.created_at || '') }}, {{ formatTime(se.updated_at || se.created_at || '') }}
                                                    </div>
                                                </div>
                                            </td>
                                            <td class="text-center" @click.stop>
                                                <div class="d-flex justify-content-center gap-2">
                                                    <button class="btn btn-sm btn-icon btn-info-light stakeholders-action-btn" @click.stop="viewDetail(se)" title="View Details">
                                                        <i class="ri-eye-line"></i>
                                                    </button>
                                                    <button class="btn btn-sm btn-icon btn-primary-light stakeholders-action-btn" @click.stop title="Edit Data">
                                                        <i class="ri-edit-line"></i>
                                                    </button>
                                                    <button class="btn btn-sm btn-icon btn-danger-light stakeholders-action-btn" @click.stop title="Delete">
                                                        <i class="ri-delete-bin-line"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        <!-- Expanded Detail Row -->
                                        <tr v-if="expandedRows.has(se.id)" class="expansion-row animate__animated animate__fadeIn">
                                            <td colspan="7" class="px-4 py-3 border-0">
                                                <div class="card custom-card mb-0 shadow-sm border-0 w-100 overflow-hidden" style="border-radius: 12px; background: #fbfcfe; border-left: 4px solid #3b82f6 !important;">
                                                    <div class="card-body p-3">
                                                        <!-- Compact Dashboard Header -->
                                                        <div class="d-flex align-items-center justify-content-between mb-3">
                                                            <div class="d-flex align-items-center gap-2">
                                                                <i class="ri-dashboard-3-line text-primary fs-18"></i>
                                                                <h6 class="fw-bold text-dark mb-0 fs-13">Rangkuman Sistem Elektronik</h6>
                                                                <span class="text-muted fs-10 ms-2">| Informasi teknis & administrasi</span>
                                                            </div>
                                                            <button class="btn btn-primary btn-sm rounded-pill px-3 shadow-sm fw-bold fs-10 d-flex align-items-center gap-2" @click="viewDetail(se)">
                                                                KELOLA SISTEM <i class="ri-settings-4-line"></i>
                                                            </button>
                                                        </div>

                                                        <!-- Compact Metric Cards (3 Columns) -->
                                                        <div class="row g-3 mb-3">
                                                            <!-- 1. Network -->
                                                            <div class="col-md-4">
                                                                <div class="p-2 rounded-3 bg-white border border-light-dark shadow-xs h-100">
                                                                    <div class="d-flex align-items-center gap-3">
                                                                        <div class="avatar avatar-md rounded-circle bg-indigo-transparent text-indigo flex-shrink-0">
                                                                            <i class="ri-global-line fs-20"></i>
                                                                        </div>
                                                                        <div class="overflow-hidden">
                                                                            <div class="text-muted fs-9 fw-bold text-uppercase letter-spacing-1">Network & Arsitektur</div>
                                                                            <div class="text-indigo fw-bold fs-12 d-flex align-items-center gap-1">
                                                                                {{ se.ip_se || '-' }}
                                                                                <span class="badge bg-light text-muted fs-9 fw-normal">AS{{ se.as_number_se || '-' }}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <!-- 2. Skor / Kelengkapan -->
                                                            <div class="col-md-4">
                                                                <div class="p-2 rounded-3 bg-white border border-light-dark shadow-xs h-100">
                                                                    <div class="d-flex align-items-center gap-3">
                                                                        <div class="avatar avatar-md rounded-circle bg-emerald-transparent text-success flex-shrink-0">
                                                                            <i class="ri-shield-check-line fs-20"></i>
                                                                        </div>
                                                                        <div class="flex-grow-1">
                                                                            <div class="d-flex justify-content-between align-items-center mb-1">
                                                                                <span class="text-muted fs-10 fw-bold text-uppercase letter-spacing-1">SKOR / KELENGKAPAN</span>
                                                                                <div class="text-end">
                                                                                    <span class="text-success fw-bold fs-11">{{ calculateScore(se).score }}/50</span>
                                                                                    <span class="text-muted fs-10 ms-1">({{ calculateScore(se).completion }}%)</span>
                                                                                </div>
                                                                            </div>
                                                                            <div class="progress progress-xs" style="height: 3px; background: #f1f5f9; border-radius: 10px;">
                                                                                <div class="progress-bar bg-success" :style="{ width: calculateScore(se).completion + '%' }"></div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <!-- 3. Status Verifikasi -->
                                                            <div class="col-md-4">
                                                                <div class="p-2 rounded-3 bg-white border border-light-dark shadow-xs h-100">
                                                                    <div class="d-flex align-items-center gap-3">
                                                                        <div class="avatar avatar-md rounded-circle bg-slate-transparent text-slate flex-shrink-0">
                                                                            <i class="ri-verified-badge-line fs-20 text-primary"></i>
                                                                        </div>
                                                                        <div class="flex-grow-1">
                                                                            <div class="text-muted fs-9 fw-bold text-uppercase letter-spacing-1">Status Verifikasi</div>
                                                                            <div class="text-success fw-bold fs-12 d-flex align-items-center gap-1">
                                                                                Finalized <i class="ri-checkbox-circle-fill text-success fs-14"></i>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <!-- Compact Bottom Section -->
                                                        <div class="row g-3">
                                                            <!-- Features (Compact) -->
                                                            <div class="col-lg-8">
                                                                <div class="p-3 rounded-3 bg-white border h-100 shadow-xs">
                                                                    <div class="fw-bold mb-2 text-dark fs-11 d-flex align-items-center gap-2">
                                                                        <i class="ri-list-settings-line text-primary"></i> Fitur & Layanan Utama
                                                                    </div>
                                                                    <div class="fs-12 text-muted lh-base bg-light bg-opacity-25 p-2 rounded-2 border border-light">
                                                                        {{ se.fitur_se || 'Tidak ada deskripsi fitur layanan tambahan.' }}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <!-- Stakeholder (Slim Card) -->
                                                            <div class="col-lg-4">
                                                                <div class="p-3 rounded-3 bg-indigo-transparent border border-indigo-light h-100 shadow-xs">
                                                                    <div class="d-flex align-items-center gap-3">
                                                                        <div class="avatar avatar-lg rounded-circle bg-white shadow-sm text-indigo border border-indigo-light flex-shrink-0">
                                                                            <i class="ri-government-line fs-20"></i>
                                                                        </div>
                                                                        <div class="overflow-hidden">
                                                                            <div class="text-indigo fw-bold text-uppercase fs-9 mb-1 letter-spacing-1">Profil Stakeholder</div>
                                                                            <div class="text-dark fw-bold fs-13 text-truncate">{{ getFullStakeholder(se)?.nama_perusahaan || se.perusahaan?.nama_perusahaan || 'N/A' }}</div>
                                                                            <div class="text-muted fs-11 text-truncate d-flex align-items-center gap-1">
                                                                                <i class="ri-map-pin-2-line"></i> 
                                                                                <span class="text-truncate">
                                                                                    {{ getFullStakeholder(se)?.sub_sektor?.nama_sektor || '-' }} 
                                                                                    <span class="mx-1 opacity-50">/</span> 
                                                                                    {{ getFullStakeholder(se)?.sub_sektor?.nama_sub_sektor || '-' }}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    </template>
                                </tbody>
                            </table>
                        </div>
                    </div>


                    <!-- ══ TABLE FOOTER ══════════════════════════════════════════ -->
                    <div class="pagination-container stakeholders-pagination mt-4 mb-0 pb-0">
                        <div class="stakeholders-pagination-copy">
                            Showing {{ (currentPage - 1) * itemsPerPage + 1 }}-{{ Math.min(currentPage * itemsPerPage, filteredSeList.length) }} 
                            of {{ filteredSeList.length }} sistem elektronik
                        </div>
                        <div class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
                            <span class="stakeholders-page-pill">Page {{ currentPage }} of {{ totalSePages }}</span>
                            <nav v-if="totalSePages > 1">
                                <ul class="pagination pagination-sm mb-0 gap-1">
                                    <li class="page-item" :class="{ disabled: currentPage === 1 }">
                                        <a class="page-link rounded-circle" href="#" @click.prevent="currentPage--">
                                            <i class="ri-arrow-left-s-line"></i>
                                        </a>
                                    </li>
                                    <template v-for="p in totalSePages" :key="p">
                                        <li v-if="p === 1 || p === totalSePages || (p >= currentPage - 1 && p <= currentPage + 1)" 
                                            class="page-item" :class="{ active: p === currentPage }">
                                            <a class="page-link rounded-circle" href="#" @click.prevent="currentPage = p">{{ p }}</a>
                                        </li>
                                        <li v-else-if="p === currentPage - 2 || p === currentPage + 2" class="page-item disabled">
                                            <span class="page-link border-0 bg-transparent">...</span>
                                        </li>
                                    </template>
                                    <li class="page-item" :class="{ disabled: currentPage === totalSePages }">
                                        <a class="page-link rounded-circle" href="#" @click.prevent="currentPage++">
                                            <i class="ri-arrow-right-s-line"></i>
                                        </a>
                                    </li>
                                </ul>
                            </nav>
                        </div>
                    </div>

                </div><!-- /card-body -->
            </div><!-- /premium shell card -->
        </div>
    </div>

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
                            <div class="header-icon-box bg-white bg-opacity-20 rounded-3 d-flex align-items-center justify-content-center shadow-sm" style="width: 48px; height: 48px;">
                                <i class="ri-edit-box-line fs-24 text-white"></i>
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
                                :class="{ 'review-comparison-scrollable': getFilteredChangesCount(selectedRequest) > 1 }"
                            >
                                <div v-if="getFilteredChangesCount(selectedRequest) === 0" class="p-5 text-center">
                                    <div class="text-muted fs-13 italic">
                                        <i class="ri-information-line fs-20 d-block mb-2"></i>
                                        Tidak ada perubahan data teknis yang perlu ditinjau.
                                    </div>
                                </div>
                                <template v-else>
                                    <div v-for="(val, key) in getFilteredChanges(selectedRequest)" :key="key" 
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
                                    class="form-control review-feedback-input bo    rder-2 shadow-sm focus-ring-primary" 
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
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.stakeholders-action-btn:hover {
  transform: translateY(-2px);
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
    transition: all 0.2s ease;
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
    background-color: #f9fbff !important;
    color: #5a6a85 !important;
    font-weight: 800 !important;
    font-size: 0.69rem !important;
    letter-spacing: 0.06em;
    border-bottom: 1px solid #e2e8f0 !important;
    padding: 0.95rem 1.1rem !important;
    text-transform: uppercase;
    white-space: nowrap;
}

.lms-style-table tbody tr {
    border-bottom: 1px solid #f1f5f9;
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
