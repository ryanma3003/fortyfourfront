<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStakeholdersStore } from '../stores/stakeholders';
import { ikasDataStatic } from '../data/ikas-data';
import { useIkasStore } from '../stores/ikas';
import { useDynamicAssessmentStore } from '../stores/dynamic-assessment';
import { useAuthStore } from '../stores/auth';
import { useNotificationStore } from '../stores/notifications';
import { ikasService } from '@/services/ikas.service';
import Pageheader from '../shared/components/pageheader/pageheader.vue';
import RadarChartIkas from '../shared/components/@spk/charts/ikas-charts.vue';
import IkasComparison from './ikas/ikas-comparison.vue';

const router = useRouter();
const route = useRoute();
const ikasStore = useIkasStore();
const assessmentStore = useDynamicAssessmentStore();
const stakeholdersStore = useStakeholdersStore();
const authStore = useAuthStore();
const notifStore = useNotificationStore();
const currentYear = new Date().getFullYear();
const currentMeasurementYear = String(currentYear);
const activeMeasurementYear = ref(String(route.query.year || currentMeasurementYear));
const tableMeasurementYear = computed(() => activeMeasurementYear.value || currentMeasurementYear);

const getRecordMeasurementYear = (record) => {
    const explicitYear = String(
        record?.tahun_pengukuran ||
        record?.tahunPengukuran ||
        record?.tahun ||
        record?.year ||
        '',
    ).match(/\d{4}/)?.[0];

    if (explicitYear) return explicitYear;

    const rawDate = record?.tanggal || record?.tanggal_pengisian || record?.tanggal_pengukuran || record?.created_at || record?.updated_at || '';
    const date = rawDate ? new Date(rawDate) : null;
    return date && !Number.isNaN(date.getTime()) ? String(date.getFullYear()) : '';
};

const hydrateCurrentStakeholderIkas = async () => {
    // Start store initializations in parallel
    const initPromises = [
        ikasStore.initialize(),
        assessmentStore.initialize()
    ];
    
    if (!stakeholdersStore.initialized) {
        initPromises.push(stakeholdersStore.initialize());
    }
    await Promise.all(initPromises);

    const slug = String(route.query.slug || '');
    if (!slug) return;

    const stakeholder = stakeholdersStore.getStakeholderBySlug(slug);
    assessmentStore.setCurrentStakeholder(slug);

    if (stakeholder?.id) {
        const requestedYear = String(route.query.year || '');
        // Fetch IKAS record and answers in parallel
        const [ikasResult] = await Promise.all([
            ikasStore.fetchFromBackend(slug, stakeholder.id, requestedYear),
            assessmentStore.hydrateAnswersFromBackend(slug, stakeholder.id)
        ]);
        
        activeMeasurementYear.value =
            ikasResult.respondentData?.tahun_pengukuran ||
            getRecordMeasurementYear(ikasResult.ikasRecord) ||
            requestedYear ||
            currentMeasurementYear;

        if (!ikasResult.exists) {
            assessmentStore.resetStakeholderData(slug);
        }
    }

    assessmentStore.syncToIkas(slug);
    ikasStore.recalculate(slug);
};

// Theme mode synchronization
const isDarkMode = ref(false);
let themeObserver;

function syncThemeMode() {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const body = document.body;
    isDarkMode.value =
        root.getAttribute("data-theme-mode") === "dark" ||
        body?.getAttribute("data-theme-mode") === "dark" ||
        root.classList.contains("dark") ||
        body?.classList.contains("dark");
}

// Initialize store
onMounted(async () => {
    syncThemeMode();
    themeObserver = new MutationObserver(syncThemeMode);
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme-mode', 'class'],
    });
    if (document.body) {
        themeObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-theme-mode', 'class'],
        });
    }
    await hydrateCurrentStakeholderIkas();
});

onUnmounted(() => {
    themeObserver?.disconnect();
});

watch(
    () => [route.query.slug, route.query.year],
    async ([newSlug], [oldSlug, oldYear]) => {
        if (!newSlug) return;
        if (newSlug === oldSlug && route.query.year === oldYear) return;
        await hydrateCurrentStakeholderIkas();
    }
);

// Get current stakeholder slug and source
const currentSlug = computed(() => String(route.query.slug || ''));
const currentSource = computed(() => String(route.query.source || ''));
const currentIkasId = computed(() => ikasStore.getBackendIkasId(currentSlug.value));
const canRequestEdit = computed(() => authStore.isFullAdmin);

const handleComparisonYearSelected = (year) => {
    const normalizedYear = String(year || '').match(/\d{4}/)?.[0];
    if (!normalizedYear || normalizedYear === activeMeasurementYear.value) return;

    activeMeasurementYear.value = normalizedYear;
    router.replace({
        path: route.path,
        query: {
            ...route.query,
            year: normalizedYear,
        },
    });
};

// Get IKAS data for current stakeholder
const ikasDataDynamic = computed(() => {
    if (currentSlug.value) {
        return ikasStore.getIkasData(currentSlug.value);
    }
    // Return default empty structure if no slug
    return {
        total_rata_rata: 0,
        total_kategori: "INPUT BELUM LENGKAP",
        identifikasi: { nilai_identifikasi: 0, kategori_identifikasi: "INPUT BELUM LENGKAP", nilai_subdomain1: 0, nilai_subdomain2: 0, nilai_subdomain3: 0, nilai_subdomain4: 0, nilai_subdomain5: 0 },
        proteksi: { nilai_proteksi: 0, kategori_proteksi: "INPUT BELUM LENGKAP", nilai_subdomain1: 0, nilai_subdomain2: 0, nilai_subdomain3: 0, nilai_subdomain4: 0, nilai_subdomain5: 0, nilai_subdomain6: 0 },
        deteksi: { nilai_deteksi: 0, kategori_deteksi: "INPUT BELUM LENGKAP", nilai_subdomain1: 0, nilai_subdomain2: 0, nilai_subdomain3: 0 },
        tanggulih: { nilai_tanggulih: 0, kategori_tanggulih: "INPUT BELUM LENGKAP", nilai_subdomain1: 0, nilai_subdomain2: 0, nilai_subdomain3: 0, nilai_subdomain4: 0 },
        is_validated: false,
        edit_request_status: 'none',
        edit_request_reason: '',
    };
});

const ikasAnsweredQuestions = computed(() => assessmentStore.answeredQuestions || 0);
const ikasTotalQuestions = computed(() => assessmentStore.totalQuestions || 0);
const ikasCompletionPercentage = computed(() => {
    const total = ikasTotalQuestions.value;
    if (!total) return 0;
    return Math.min(100, Math.round((ikasAnsweredQuestions.value / total) * 100));
});
const ikasPendingQuestions = computed(() => Math.max(ikasTotalQuestions.value - ikasAnsweredQuestions.value, 0));

const currentTargetScore = computed(() => {
    const slug = currentSlug.value;
    const summary = ikasStore.ikasSummaryMap[slug];
    const raw = summary?.raw;
    return Number(raw?.target_nilai || 0);
});

const isBelowTarget = computed(() => {
    if (!currentTargetScore.value || currentTargetScore.value <= 0) return false;
    const score = Number(ikasDataDynamic.value.total_rata_rata || 0);
    return score < currentTargetScore.value;
});

const editRequestReasonLabel = computed(() => {
    if (ikasDataDynamic.value.edit_request_status === 'rejected') {
        return 'Alasan penolakan';
    }
    if (ikasDataDynamic.value.edit_request_status === 'pending') {
        return 'Alasan pengajuan edit';
    }
    return 'Alasan request edit';
});

const dataToPass = computed(() => {
    try {
        const slug = route.query.slug;
        const source = route.query.source;
        
        // If source is 'list', user came from the list page, so back button should go to list.
        if (source === 'list') {
             return {
                title: { label: "Stakeholders", path: "/stakeholders" },
                currentpage: "IKAS ",
                activepage: "IKAS",
            };
        }

        if (slug) {
            const stakeholder = stakeholdersStore.getStakeholderBySlug(String(slug));

            if (stakeholder) {
                return {
                    title: { label: `Profile ${stakeholder.nama_perusahaan}`, path: `/stakeholders/${stakeholder.slug}` },
                    currentpage: "IKAS",
                    activepage: "IKAS",
                };
            }
        }
    } catch (error) {
        console.error("IKAS Error doing computed:", error);
    }

    return {
        title: { label: "Stakeholders", path: "/stakeholders" },
        currentpage: "IKAS",
        activepage: "IKAS",
    }
});

// Computed property untuk mendapatkan stakeholder berdasarkan slug
const currentStakeholder = computed(() => {
    const slug = route.query.slug;
    if (slug) {
        return stakeholdersStore.getStakeholderBySlug(String(slug));
    }
    return null;
});

// Navigate to IKAS CRUD with slug and source
const goToIkasCrud = () => {
    if (ikasDataDynamic.value.is_validated) {
        alert(canRequestEdit.value
            ? 'Data IKAS sudah tervalidasi. Ajukan Request Edit terlebih dahulu sebelum mengedit data.'
            : 'Data IKAS sudah tervalidasi dan tidak dapat diedit.'
        );
        return;
    }

    const query = { slug: currentSlug.value, year: tableMeasurementYear.value };
    if (currentSource.value) {
        query.source = currentSource.value;
    }
    router.push({ path: '/ikas-crud', query });
};

const ensureEditableIkas = () => {
    if (!ikasDataDynamic.value.is_validated) return true;

    alert(canRequestEdit.value
        ? 'Data IKAS sudah tervalidasi. Ajukan Request Edit dulu agar data bisa diubah.'
        : 'Data IKAS sudah tervalidasi dan tidak dapat diubah.'
    );
    return false;
};

const isDeleting = ref(false);
const deleteAssessment = async () => {
    const ikasId = ikasStore.getBackendIkasId(currentSlug.value);
    if (!ikasId) {
        alert('Tidak ada data penilaian untuk dihapus.');
        return;
    }

    if (!confirm('Apakah Anda yakin ingin menghapus data penilaian IKAS ini? Tindakan ini tidak dapat dibatalkan.')) {
        return;
    }

    isDeleting.value = true;
    try {
        await ikasStore.deleteFromBackend(ikasId);
        alert('Data penilaian berhasil dihapus.');
        // Refresh page or redirect
        router.push({ path: '/stakeholders' });
    } catch (error) {
        console.error('Delete error:', error);
        alert('Gagal menghapus data penilaian: ' + (error.message || 'Unknown error'));
    } finally {
        isDeleting.value = false;
    }
};

const isValidating = ref(false);
const isRequestingEdit = ref(false);

const syncIkasRecordState = ({ editRequestStatus, editRequestReason, isValidated }) => {
    const slug = currentSlug.value;
    const ikasId = currentIkasId.value;
    const stakeholderId = currentStakeholder.value?.id;

    if (ikasStore.ikasDataMap[slug]) {
        if (typeof isValidated === 'boolean') {
            ikasStore.ikasDataMap[slug].is_validated = isValidated;
        }
        if (editRequestStatus !== undefined) {
            ikasStore.ikasDataMap[slug].edit_request_status = editRequestStatus;
        }
        if (editRequestReason !== undefined) {
            ikasStore.ikasDataMap[slug].edit_request_reason = editRequestReason || '';
        }
    }

    if (ikasStore.ikasSummaryMap[slug]) {
        if (typeof isValidated === 'boolean') {
            ikasStore.ikasSummaryMap[slug].is_validated = isValidated;
        }
        if (editRequestStatus !== undefined) {
            ikasStore.ikasSummaryMap[slug].edit_request_status = editRequestStatus;
        }
        if (editRequestReason !== undefined) {
            ikasStore.ikasSummaryMap[slug].edit_request_reason = editRequestReason || '';
        }
    }

    ikasStore.ikasRawRecords = ikasStore.ikasRawRecords.map((record) => {
        const company = record?.perusahaan || {};
        const matchesRecord =
            String(record?.id || '') === String(ikasId || '') ||
            String(record?.slug || '') === String(slug) ||
            String(company?.slug || '') === String(slug) ||
            String(record?.id_perusahaan || company?.id || '') === String(stakeholderId || '');

        if (!matchesRecord) return record;

        return {
            ...record,
            ...(typeof isValidated === 'boolean' ? { is_validated: isValidated, status: isValidated } : {}),
            ...(editRequestStatus !== undefined ? { edit_request_status: editRequestStatus } : {}),
            ...(editRequestReason !== undefined ? { edit_request_reason: editRequestReason || '' } : {}),
        };
    });

    ikasStore.ikasVersion++;
};

const validateAssessment = async () => {
    const ikasId = ikasStore.getBackendIkasId(currentSlug.value);
    if (!ikasId) {
        alert('Tidak ada data penilaian untuk divalidasi.');
        return;
    }

    if (!confirm('Apakah Anda yakin ingin memvalidasi data penilaian IKAS ini?')) {
        return;
    }

    isValidating.value = true;
    try {
        console.warn('[IKAS] Triggering validation for ID:', ikasId);
        const result = await ikasStore.validateIkas(currentSlug.value);
        if (result.success) {
            alert('Data penilaian berhasil divalidasi.');
            syncIkasRecordState({ editRequestStatus: 'none', isValidated: true });
        } else {
            console.error('[IKAS] Validation failed:', result.error);
            alert('Gagal memvalidasi data: ' + result.error);
        }
    } catch (err) {
        console.error('[IKAS] Error during validation process:', err);
        alert('Terjadi kesalahan saat memvalidasi data.');
    } finally {
        isValidating.value = false;
    }
};

const requestEdit = async () => {
    const ikasId = ikasStore.getBackendIkasId(currentSlug.value);
    if (!ikasId) {
        alert('Tidak ada data penilaian untuk diajukan request edit.');
        return;
    }

    if (!canRequestEdit.value) {
        alert('Hanya admin yang dapat mengajukan request edit IKAS.');
        return;
    }

    const reason = prompt('Masukkan alasan pengajuan edit:');
    if (reason === null) return; // User cancelled
    if (!reason.trim()) {
        alert('Alasan pengajuan edit wajib diisi.');
        return;
    }

    isRequestingEdit.value = true;
    try {
        const result = await ikasStore.requestEditIkas(currentSlug.value, reason.trim());
        if (result.success) {
            syncIkasRecordState({ editRequestStatus: 'pending', editRequestReason: reason.trim(), isValidated: true });
            alert('Request edit berhasil diajukan.');
        } else {
            alert('Gagal mengajukan request edit: ' + result.error);
        }
    } catch (err) {
        console.error('[IKAS] Request edit error:', err);
        alert('Terjadi kesalahan saat mengajukan request edit.');
    } finally {
        isRequestingEdit.value = false;
    }
};

const isApproving = ref(false);
const isRejecting = ref(false);

const approveEdit = async () => {
    const ikasId = ikasStore.getBackendIkasId(currentSlug.value);
    if (!ikasId) return;

    if (!confirm('Apakah Anda yakin ingin menyetujui permintaan edit IKAS ini?')) return;

    isApproving.value = true;
    try {
        const result = await ikasStore.approveEditIkas(currentSlug.value);
        if (result.success) {
            alert('Permintaan edit berhasil disetujui.');
            syncIkasRecordState({ editRequestStatus: 'approved', isValidated: false });
        } else {
            alert('Gagal menyetujui edit: ' + result.error);
        }
    } catch (err) {
        console.error('[IKAS] Approve edit error:', err);
        alert('Terjadi kesalahan saat menyetujui edit.');
    } finally {
        isApproving.value = false;
    }
};

const rejectEdit = async () => {
    const ikasId = ikasStore.getBackendIkasId(currentSlug.value);
    if (!ikasId) return;

    const reason = prompt('Masukkan alasan penolakan:');
    if (reason === null) return; // User cancelled
    if (!reason.trim()) {
        alert('Alasan penolakan wajib diisi agar user tahu apa yang perlu diperbaiki.');
        return;
    }

    isRejecting.value = true;
    try {
        const result = await ikasStore.rejectEditIkas(currentSlug.value, reason.trim());
        if (result.success) {
            alert('Permintaan edit berhasil ditolak.');
            syncIkasRecordState({ editRequestStatus: 'rejected', editRequestReason: reason.trim(), isValidated: true });
        } else {
            alert('Gagal menolak edit: ' + result.error);
        }
    } catch (err) {
        console.error('[IKAS] Reject edit error:', err);
        alert('Terjadi kesalahan saat menolak edit.');
    } finally {
        isRejecting.value = false;
    }
};

// --- STATE: Upload Excel Feature ---
const fileInput = ref(null);
const selectedFile = ref(null);
const tableData = ref([]);
const loading = ref(false);
const errorMessage = ref('');

// --- FUNCTION: Trigger Input File ---
const triggerFileInput = () => {
    if (!ensureEditableIkas()) return;

    errorMessage.value = ''; // Reset error msg
    fileInput.value.click();
};

// --- FUNCTION: Handle File Selection ---
const handleFile = (event) => {
    const file = event.target.files[0];
    
    if (!file) return;

    // Validasi ekstensi .xlsx dan .xls
    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    const fileName = file.name.toLowerCase();
    const isValidExt = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!isValidExt) {
        errorMessage.value = 'Format file harus .xlsx atau .xls';
        alert(errorMessage.value); // Simple alert for now as requested by "logic only" scope
        event.target.value = ''; // Reset input
        return;
    }

    selectedFile.value = file;
    // Auto upload saat file dipilih (optional, bisa juga dipisah tombol upload)
    uploadExcel();
};

// --- FUNCTION: Upload Excel to Backend ---
const uploadExcel = async () => {
    if (!selectedFile.value) {
        errorMessage.value = 'Pilih file terlebih dahulu!';
        return;
    }

    loading.value = true;
    errorMessage.value = '';

    const formData = new FormData();
    formData.append('file', selectedFile.value);

    try {
        // Mengirim file ke endpoint backend
        notifStore.trackSelfAction('ikas', '');
        const response = await fetch('/api/maturity/ikas/import', {
            method: 'POST',
            body: formData,
            // Headers untuk Content-Type otomatis diatur oleh browser saat menggunakan FormData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Gagal mengupload file');
        }

        if (result.success) {
            // Mengisi data hasil response ke state tableData
            tableData.value = result.data;
            alert('Upload berhasil!');
        } else {
            throw new Error(result.message || 'Terjadi kesalahan pada server');
        }

    } catch (error) {
        // Handle error response
        console.error('Upload error:', error);
        errorMessage.value = error.message;
        alert(`Error: ${errorMessage.value}`);
    } finally {
        // Handle loading state
        loading.value = false;
        // Reset input agar bisa upload file yang sama jika perlu
        if (fileInput.value) fileInput.value.value = '';
        selectedFile.value = null; 
    }
};

const formatValue = (value) => {
    if (value === null || value === 0) return '-';
    return value;
};

// --- STATE: Export PDF ---
const exporting = ref(false);

const getFileNameFromResponse = (response, fallbackName) => {
    const disposition = response.headers.get('Content-Disposition') || '';
    const fileNameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
    return fileNameMatch ? decodeURIComponent(fileNameMatch[1] || fileNameMatch[2]) : fallbackName;
};

const exportToPdf = async () => {
    const ikasId = currentIkasId.value;
    if (!ikasId) {
        alert('Tidak ada data IKAS untuk diekspor.');
        return;
    }

    exporting.value = true;
    try {
        const response = await ikasService.exportIkasPdf(ikasId);

        const perusahaanName = currentStakeholder.value?.nama_perusahaan || 'Stakeholder';
        const fallbackName = `IKAS_Report_${perusahaanName.replace(/\s+/g, '_')}.pdf`;
        const fileName = getFileNameFromResponse(response, fallbackName);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        alert('PDF Berhasil Diunduh!');
    } catch (error) {
        console.error('PDF Export Error:', error);
        alert('Gagal mengekspor PDF: ' + (error.message || 'Unknown error'));
    } finally {
        exporting.value = false;
    }
};

</script>

<style scoped>
/* ── IKAS Table ─────────────────────────────────────────── */
.table-wrapper { 
  overflow-x: auto; 
  border-radius: 16px;
  border: 1px solid #d9e3ef;
  overflow: hidden;
  background: #fff;
}

.maturity-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1230px;
  table-layout: fixed;
  background: #fff;
  font-size: 12px;
}
.maturity-table .col-domain-label { width: 34px; }
.maturity-table .col-question { width: 390px; }
.maturity-table .col-target { width: 160px; }
.maturity-table .col-score { width: 120px; }
.maturity-table .col-domain-score { width: 180px; }
.maturity-table .col-domain-category { width: 260px; }
.maturity-table .col-total-category { width: 180px; }
.maturity-table th,
.maturity-table td {
  border: 1px solid #d9e3ef;
  padding: 7px 10px;
  vertical-align: middle;
  line-height: 1.25;
}
.maturity-table thead th {
  background: #f6f7fa;
  color: #425466;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.045em;
  text-transform: uppercase;
}
.left-title, .year-title, .right-title { font-weight: bold; text-align: center; }
.left-title   { width: 424px; }
.year-title   { font-size: 15px; }
.total        { background: #203a63 !important; color: #fff !important; font-weight: 800; text-align: center; }
.item         { font-size: 11.5px; color: #334155; min-width: 320px; }
.center       { text-align: center; }
.bold         { font-weight: bold; }
.status-big   { font-size: 19px; font-weight: 800; text-align: center; color: #1e3a5f; letter-spacing: 0.02em; }

/* Domain column labels */
.domain {
  color: #fff;
  font-weight: 800;
  text-align: center;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  width: 28px;
  min-width: 28px;
}
.blue   { background: linear-gradient(180deg, #1e40af, #2563eb); }
.purple { background: linear-gradient(180deg, #5b21b6, #7c3aed); }
.orange { background: linear-gradient(180deg, #b45309, #d97706); }
.green  { background: linear-gradient(180deg, #065f46, #059669); }

/* ── Unified card header ────────────────────────────────── */
.ikas-unified-header {
  background: linear-gradient(135deg, #0c1e6b 0%, #1130a0 25%, #1a3fc8 50%, #2563eb 75%, #3b82f6 100%) !important;
  border-bottom: none !important;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  position: relative;
  overflow: hidden;
  flex-wrap: wrap;
}
.ikas-unified-header::after {
  content: '';
  position: absolute; bottom:0; left:0; right:0; height:2px;
  background: linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.5) 30%, rgba(96,165,250,0.8) 60%, rgba(167,243,208,0.4) 100%);
}
.ikas-header-icon-box {
  width:64px; height:64px; border-radius:14px;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.ikas-header-icon-box i { font-size:2rem; color:#fff; }
.ikas-header-label { font-size:1.2rem; font-weight:800; color:#fff; line-height:1.3; padding-top:8px; }
.ikas-header-stakeholder { font-size:1rem; font-weight:600; color:rgba(255,255,255,0.9); margin-top:6px; display:flex; align-items:center; }
.ikas-header-sektor { font-size:13px; color:rgba(255,255,255,0.65); }
.ikas-header-score-box { text-align:right; flex-shrink:0; }
.ikas-header-score { font-size:2.4rem; font-weight:900; color:#fff; line-height:1; }
.ikas-header-score-lbl { font-size:11px; color:rgba(255,255,255,0.6); letter-spacing:0.04em; text-transform:uppercase; margin-top:2px; }
.ikas-header-kat-badge {
  display:inline-flex;
  align-items:center;
  min-height: 34px;
  padding: 7px 16px;
  border-radius:50px;
  background: rgba(255,255,255,0.15);
  color:#fff;
  font-size:0.78rem;
  font-weight:700;
  letter-spacing:0.04em;
  border:1px solid rgba(255,255,255,0.3);
  text-transform:uppercase;
  text-align:center;
}

/* ── Below Target Warning ───────────────────────────────── */
.ikas-target-warning {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 18px;
  border-radius: 12px;
  background: linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%);
  border: 1px solid #f59e0b;
  color: #92400e;
  font-size: 0.88rem;
  line-height: 1.5;
  animation: warningFadeIn 0.4s ease;
}
.ikas-target-warning > i {
  font-size: 1.5rem;
  color: #d97706;
  flex-shrink: 0;
  margin-top: 2px;
}
.ikas-target-warning strong {
  display: block;
  font-size: 0.95rem;
  font-weight: 800;
  margin-bottom: 2px;
  color: #78350f;
}
.ikas-target-warning b {
  font-weight: 700;
  color: #b45309;
}
@keyframes warningFadeIn {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Action buttons area ────────────────────────────────── */
.ikas-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin: 0 0 1.25rem;
  padding: 12px;
  border: 1px solid #e8eef6;
  border-radius: 12px;
  background: #f8fbff;
}
.ikas-action-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ikas-action-group-admin {
  justify-content: flex-end;
}
.btn-ikas-input {
  border: none; border-radius: 50px; padding: 8px 16px;
  color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  box-shadow: 0 4px 14px rgba(31,41,55,0.35);
  transition: opacity 0.2s, transform 0.2s;
  white-space: nowrap;
  min-height: 36px;
}
.btn-ikas-input:hover { opacity: 0.88; transform: translateY(-1px); }
.btn-ikas-input-locked {
  background: linear-gradient(135deg, #64748b, #94a3b8) !important;
  box-shadow: 0 4px 14px rgba(100,116,139,0.28);
}
.btn-ikas-upload {
  background: linear-gradient(135deg, #065f46, #059669);
  border: none; border-radius: 50px; padding: 8px 16px;
  color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  box-shadow: 0 4px 14px rgba(5,150,105,0.35);
  transition: opacity 0.2s, transform 0.2s;
  white-space: nowrap;
  min-height: 36px;
}
.btn-ikas-upload:hover  { opacity: 0.88; transform: translateY(-1px); }
.btn-ikas-upload:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

.btn-ikas-pdf {
  background: linear-gradient(135deg, #b45309, #d97706);
  border: none; border-radius: 50px; padding: 8px 16px;
  color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  box-shadow: 0 4px 14px rgba(217,119,6,0.35);
  transition: opacity 0.2s, transform 0.2s;
  white-space: nowrap;
  min-height: 36px;
}
.btn-ikas-pdf:hover  { opacity: 0.88; transform: translateY(-1px); }
.btn-ikas-pdf:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

.btn-ikas-delete {
  background: linear-gradient(135deg, #991b1b, #dc2626);
  border: none; border-radius: 50px; padding: 8px 16px;
  color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  box-shadow: 0 4px 14px rgba(220,38,38,0.35);
  transition: opacity 0.2s, transform 0.2s;
  white-space: nowrap;
  min-height: 36px;
}
.btn-ikas-delete:hover  { opacity: 0.88; transform: translateY(-1px); }
.btn-ikas-delete:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

.btn-ikas-validate {
  background: linear-gradient(135deg, #1e40af, #3b82f6);
  border: none; border-radius: 50px; padding: 8px 16px;
  color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  box-shadow: 0 4px 14px rgba(37,99,235,0.35);
  transition: opacity 0.2s, transform 0.2s;
  white-space: nowrap;
  min-height: 36px;
}
.btn-ikas-validate:hover  { opacity: 0.88; transform: translateY(-1px); }
.btn-ikas-validate:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

.btn-ikas-unlock {
  background: linear-gradient(135deg, #92400e, #f59e0b);
  border: none; border-radius: 50px; padding: 8px 16px;
  color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  box-shadow: 0 4px 14px rgba(245,158,11,0.35);
  transition: opacity 0.2s, transform 0.2s;
  white-space: nowrap;
  min-height: 36px;
}
.btn-ikas-unlock:hover  { opacity: 0.88; transform: translateY(-1px); }
.btn-ikas-unlock:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

.btn-ikas-approve {
  background: linear-gradient(135deg, #065f46, #10b981);
  border: none; border-radius: 50px; padding: 8px 16px;
  color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  box-shadow: 0 4px 14px rgba(16,185,129,0.35);
  transition: opacity 0.2s, transform 0.2s;
  white-space: nowrap;
  min-height: 36px;
}
.btn-ikas-approve:hover  { opacity: 0.88; transform: translateY(-1px); }
.btn-ikas-approve:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

.btn-ikas-reject {
  background: linear-gradient(135deg, #7f1d1d, #ef4444);
  border: none; border-radius: 50px; padding: 8px 16px;
  color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  box-shadow: 0 4px 14px rgba(239,68,68,0.35);
  transition: opacity 0.2s, transform 0.2s;
  white-space: nowrap;
  min-height: 36px;
}
.btn-ikas-reject:hover  { opacity: 0.88; transform: translateY(-1px); }
.btn-ikas-reject:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

.ikas-request-note {
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  background: #eff6ff;
  color: #0f172a;
  display: grid;
  gap: 8px;
  margin: -0.25rem 0 1.25rem;
  padding: 12px 14px;
}

.ikas-request-note.rejected {
  background: #fef2f2;
  border-color: #fecaca;
}

.ikas-request-note > div {
  align-items: center;
  color: #1d4ed8;
  display: flex;
  font-size: 12px;
  font-weight: 800;
  gap: 7px;
}

.ikas-request-note.rejected > div {
  color: #991b1b;
}

.ikas-request-note p {
  color: #334155;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.45;
  margin: 0;
  white-space: pre-wrap;
}

/* ── Domain score summary strip ─────────────────────────── */
.domain-strip {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 1.5rem;
}
.domain-card {
  border-radius: 14px;
  min-width: 0;
  padding: 14px 16px;
  display: flex; align-items: center; gap: 12px;
  position: relative; overflow: hidden;
}
.domain-card-blue   { background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); box-shadow: 0 6px 18px rgba(37,99,235,0.26); }
.domain-card-purple { background: linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%); box-shadow: 0 6px 18px rgba(124,58,237,0.24); }
.domain-card-orange { background: linear-gradient(135deg, #b45309 0%, #d97706 100%); box-shadow: 0 6px 18px rgba(217,119,6,0.24); }
.domain-card-green  { background: linear-gradient(135deg, #065f46 0%, #059669 100%); box-shadow: 0 6px 18px rgba(5,150,105,0.24); }
.domain-card-icon   { width:42px; height:42px; border-radius:12px; background: rgba(255,255,255,0.16); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.domain-card-icon i { font-size:1.3rem; color:#fff; }
.domain-card-score  { font-size: 1.6rem; font-weight: 900; color:#fff; line-height:1; }
.domain-card-label  { font-size: 11px; color: rgba(255,255,255,0.75); margin-top:3px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; }
.domain-card-kat    { font-size: 11px; color: rgba(255,255,255,0.85); line-height: 1.25; margin-top:2px; }

/* ── Radar section header ───────────────────────────────── */
.radar-section-header {
  background: linear-gradient(135deg, #0c1e6b 0%, #1130a0 25%, #1a3fc8 50%, #2563eb 75%, #3b82f6 100%);
  border-radius: 0;
  padding: 0.75rem 1.25rem;
  display: flex; align-items: center; gap: 12px;
  position: relative;
}
.radar-section-header::after {
  content: '';
  position: absolute; bottom:0; left:0; right:0; height:2px;
  background: linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.5) 30%, rgba(96,165,250,0.8) 60%, rgba(167,243,208,0.4) 100%);
}
.radar-header-icon   { width:42px; height:48px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.radar-header-icon i { font-size:1.6rem; color:#fff; }
.radar-header-title  { font-size:1rem; font-weight:800; color:#fff; }
.radar-header-sub    { font-size:12px; color:rgba(255,255,255,0.6); margin-top:2px; }

.ikas-shell {
  --ikas-surface: rgba(255, 255, 255, 0.94);
  --ikas-surface-soft: #f8fbff;
  --ikas-border: #dce7f4;
  --ikas-text: #0f172a;
  --ikas-muted: #64748b;
  --ikas-track: #e8eef6;
}

.ikas-hero-card {
  background: transparent;
  box-shadow: none;
}

.ikas-unified-header {
  border-radius: 18px;
  padding: 1.2rem 1.35rem;
  min-height: 102px;
}

.ikas-header-left,
.ikas-header-right {
  align-items: center;
  display: flex;
}

.ikas-header-left {
  gap: 1rem;
  min-width: 280px;
}

.ikas-header-right {
  gap: 0.45rem;
  justify-content: flex-end;
  max-width: 540px;
  flex-wrap: wrap;
}

.ikas-header-icon-box {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.ikas-header-kicker {
  color: rgba(255, 255, 255, 0.68);
  font-size: 0.7rem;
  font-weight: 850;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.ikas-header-label {
  padding-top: 2px;
}

.ikas-main-card {
  background: var(--ikas-surface);
  border: 1px solid var(--ikas-border);
  border-radius: 18px;
  box-shadow: 0 18px 46px rgba(15, 23, 42, 0.06);
}

.ikas-progress-panel {
  background:
    radial-gradient(circle at 8% 0%, rgba(59, 130, 246, 0.14), transparent 34%),
    linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
  border: 1px solid var(--ikas-border);
  border-radius: 16px;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.045);
  margin-bottom: 1rem;
  padding: 1rem 1.1rem;
}

.ikas-progress-head,
.ikas-progress-foot {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.ikas-progress-title-wrap {
  align-items: center;
  display: flex;
  gap: 0.85rem;
}

.ikas-progress-icon {
  align-items: center;
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
  border-radius: 13px;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.22);
  color: #fff;
  display: flex;
  height: 44px;
  justify-content: center;
  width: 44px;
}

.ikas-progress-icon i {
  font-size: 1.4rem;
}

.ikas-progress-title {
  color: var(--ikas-text);
  font-size: 0.95rem;
  font-weight: 850;
}

.ikas-progress-subtitle,
.ikas-progress-foot {
  color: var(--ikas-muted);
  font-size: 0.78rem;
  font-weight: 650;
}

.ikas-progress-stat {
  align-items: flex-end;
  display: grid;
  gap: 0.12rem;
  justify-items: end;
}

.ikas-progress-stat strong {
  color: #1d4ed8;
  font-size: 1.55rem;
  font-weight: 900;
  line-height: 1;
}

.ikas-progress-stat span {
  color: var(--ikas-muted);
  font-size: 0.74rem;
  font-weight: 750;
}

.ikas-progress-track {
  background: var(--ikas-track);
  border-radius: 999px;
  height: 10px;
  margin: 1rem 0 0.75rem;
  overflow: hidden;
  position: relative;
}

.ikas-progress-fill {
  background: linear-gradient(90deg, #2563eb, #0ea5e9, #10b981);
  border-radius: inherit;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.22);
  height: 100%;
  min-width: 8px;
  transition: width 0.28s ease;
}

.ikas-progress-metrics {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 0.8rem;
}

.ikas-progress-metric {
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(203, 213, 225, 0.7);
  border-radius: 12px;
  display: grid;
  gap: 2px;
  padding: 10px 12px;
}

.ikas-progress-metric span {
  color: var(--ikas-muted);
  font-size: 0.7rem;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ikas-progress-metric strong {
  color: var(--ikas-text);
  font-size: 0.96rem;
  font-weight: 900;
  line-height: 1.15;
}

.ikas-year-status-bar {
  align-items: center;
  background: rgba(248, 251, 255, 0.86);
  border: 1px solid var(--ikas-border);
  border-radius: 16px;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.045);
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding: 12px 14px;
}

.ikas-year-status-main {
  align-items: center;
  display: flex;
  gap: 10px;
  min-width: 0;
}

.ikas-year-status-icon {
  align-items: center;
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
  border-radius: 12px;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.18);
  color: #fff;
  display: flex;
  flex-shrink: 0;
  height: 40px;
  justify-content: center;
  width: 40px;
}

.ikas-year-status-icon i {
  font-size: 1.25rem;
}

.ikas-year-status-kicker {
  color: var(--ikas-muted);
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.ikas-year-status-value {
  color: var(--ikas-text);
  font-size: 1rem;
  font-weight: 900;
  line-height: 1.2;
}

.ikas-year-status-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.ikas-year-status-chip {
  align-items: center;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(203, 213, 225, 0.72);
  border-radius: 999px;
  color: #475569;
  display: inline-flex;
  font-size: 0.72rem;
  font-weight: 850;
  gap: 6px;
  min-height: 30px;
  padding: 6px 10px;
}

.ikas-year-status-chip i {
  font-size: 0.92rem;
}

.ikas-year-status-chip.is-valid {
  background: rgba(16, 185, 129, 0.10);
  border-color: rgba(16, 185, 129, 0.22);
  color: #047857;
}

.ikas-year-status-chip.is-draft {
  background: rgba(245, 158, 11, 0.10);
  border-color: rgba(245, 158, 11, 0.22);
  color: #b45309;
}

.ikas-year-status-chip.is-edit {
  background: rgba(37, 99, 235, 0.09);
  border-color: rgba(37, 99, 235, 0.18);
  color: #1d4ed8;
}

.ikas-action-bar {
  background: rgba(248, 251, 255, 0.8);
  border-color: var(--ikas-border);
  border-radius: 16px;
  display: block;
  margin: 0 0 1rem;
  box-shadow: none;
  padding: 14px;
}

.ikas-action-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 12px;
}

.ikas-action-title {
  color: var(--ikas-text);
  font-size: 0.92rem;
  font-weight: 900;
}

.ikas-action-subtitle {
  color: var(--ikas-muted);
  font-size: 0.75rem;
  font-weight: 600;
  margin-top: 2px;
}

.ikas-action-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.ikas-action-meta-chip {
  align-items: center;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(203, 213, 225, 0.72);
  border-radius: 999px;
  color: var(--ikas-text);
  display: inline-flex;
  font-size: 0.72rem;
  font-weight: 850;
  gap: 6px;
  padding: 6px 10px;
}

.ikas-action-meta-chip i {
  font-size: 0.9rem;
}

.ikas-action-meta-chip-muted {
  background: rgba(248, 250, 252, 0.62);
  border-color: rgba(203, 213, 225, 0.52);
  color: #738196;
  font-weight: 750;
}

.ikas-action-grid {
  display: grid;
  gap: 12px;
  width: 100%;
}

.ikas-action-cluster {
  align-items: flex-start;
  background: transparent;
  border: 0;
  border-radius: 0;
  display: grid;
  gap: 8px;
  justify-content: stretch;
  min-width: 0;
  padding: 0;
}

.ikas-action-cluster-admin {
  background: transparent;
  justify-items: stretch;
}

.ikas-action-label {
  color: var(--ikas-muted);
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  min-width: 0;
  text-transform: uppercase;
}

.ikas-action-buttons {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-start;
  min-width: 0;
}

.btn-ikas-input,
.btn-ikas-upload,
.btn-ikas-pdf,
.btn-ikas-delete,
.btn-ikas-validate,
.btn-ikas-unlock,
.btn-ikas-approve,
.btn-ikas-reject {
  border-radius: 999px;
  min-height: 36px;
  padding: 7px 13px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.09);
}

.table-wrapper {
  background: #fff;
  border-radius: 16px;
  box-shadow: none;
  border: 1px solid #d9e3ef;
}

.maturity-table thead th {
  background: #f6f7fa;
  color: #425466;
}

.maturity-table td {
  background: #fff;
}

.maturity-table .total,
.maturity-table td.domain {
  background-clip: padding-box;
}

.maturity-table td.domain.blue {
  background: linear-gradient(180deg, #1e40af, #2563eb) !important;
  color: #fff !important;
}

.maturity-table td.domain.purple {
  background: linear-gradient(180deg, #5b21b6, #7c3aed) !important;
  color: #fff !important;
}

.maturity-table td.domain.orange {
  background: linear-gradient(180deg, #b45309, #d97706) !important;
  color: #fff !important;
}

.maturity-table td.domain.green {
  background: linear-gradient(180deg, #065f46, #059669) !important;
  color: #fff !important;
}

@media (min-width: 992px) {
  .ikas-action-grid {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.9fr);
  }

  .ikas-action-cluster-admin .ikas-action-buttons {
    justify-content: flex-end;
  }
}

@media (max-width: 1199.98px) {
  .domain-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767.98px) {
  .ikas-unified-header,
  .ikas-header-left,
  .ikas-header-right,
  .ikas-progress-head,
  .ikas-progress-foot,
  .ikas-action-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .ikas-header-right,
  .ikas-action-buttons {
    justify-content: flex-start;
  }

  .ikas-header-left {
    min-width: 0;
  }

  .domain-strip,
  .ikas-progress-metrics {
    grid-template-columns: 1fr;
  }

  .ikas-action-meta {
    justify-content: flex-start;
  }

  .ikas-year-status-bar,
  .ikas-year-status-main {
    align-items: flex-start;
    flex-direction: column;
  }

  .ikas-year-status-chips {
    justify-content: flex-start;
  }

  .ikas-progress-panel,
  .ikas-action-bar {
    padding: 0.9rem;
  }

  .ikas-action-buttons,
  .ikas-action-buttons button {
    width: 100%;
  }

  .ikas-action-buttons button {
    justify-content: center;
  }
}

.ikas-shell.is-dark {
  --ikas-surface: rgba(15, 23, 42, 0.92);
  --ikas-surface-soft: rgba(17, 24, 39, 0.88);
  --ikas-border: rgba(148, 163, 184, 0.22);
  --ikas-text: #e5edf7;
  --ikas-muted: #9fb0c5;
  --ikas-track: rgba(148, 163, 184, 0.2);
}

.ikas-shell.is-dark .ikas-main-card,
.ikas-shell.is-dark .ikas-progress-panel {
  background: var(--ikas-surface) !important;
  border-color: var(--ikas-border) !important;
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.28) !important;
}

.ikas-shell.is-dark .table-wrapper {
    background: transparent !important;
    border-color: rgba(255, 255, 255, 0.08) !important;
    box-shadow: none !important;
  }

.ikas-shell.is-dark .ikas-action-bar,
.ikas-shell.is-dark .ikas-action-cluster {
  background: rgba(17, 24, 39, 0.78) !important;
  border-color: var(--ikas-border) !important;
  box-shadow: none !important;
}

.ikas-shell.is-dark .ikas-action-title,
.ikas-shell.is-dark .ikas-action-meta-chip {
  color: #dbe7f3 !important;
}

.ikas-shell.is-dark .ikas-action-meta-chip {
  background: rgba(15, 23, 42, 0.68) !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
}

.ikas-shell.is-dark .ikas-year-status-bar {
  background: rgba(17, 24, 39, 0.78) !important;
  border-color: var(--ikas-border) !important;
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.22) !important;
}

.ikas-shell.is-dark .ikas-year-status-chip {
  background: rgba(15, 23, 42, 0.68) !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
  color: #dbe7f3 !important;
}

.ikas-shell.is-dark .ikas-year-status-chip.is-valid {
  background: rgba(16, 185, 129, 0.14) !important;
  border-color: rgba(16, 185, 129, 0.22) !important;
  color: #6ee7b7 !important;
}

.ikas-shell.is-dark .ikas-year-status-chip.is-draft {
  background: rgba(245, 158, 11, 0.14) !important;
  border-color: rgba(245, 158, 11, 0.22) !important;
  color: #fcd34d !important;
}

.ikas-shell.is-dark .ikas-year-status-chip.is-edit {
  background: rgba(59, 130, 246, 0.14) !important;
  border-color: rgba(59, 130, 246, 0.22) !important;
  color: #bfdbfe !important;
}

.ikas-shell.is-dark .ikas-action-meta-chip-muted {
  background: rgba(15, 23, 42, 0.46) !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
  color: #9fb0c5 !important;
}

.ikas-shell.is-dark .ikas-progress-metric {
  background: rgba(15, 23, 42, 0.64) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
}

.ikas-shell.is-dark .maturity-table {
  background: transparent !important;
}

.ikas-shell.is-dark .maturity-table th {
  background: rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.85) !important;
}

.ikas-shell.is-dark .maturity-table td {
  background: rgba(255, 255, 255, 0.015) !important;
  border-color: rgba(255, 255, 255, 0.06) !important;
  color: rgba(255, 255, 255, 0.75) !important;
}

.ikas-shell.is-dark .maturity-table .total {
  background: rgba(255, 255, 255, 0.07) !important;
  color: #fff !important;
}

.ikas-shell.is-dark .maturity-table td.domain.blue {
  background: rgba(59, 130, 246, 0.12) !important;
  border-left: 4px solid #3b82f6 !important;
  color: #93c5fd !important;
}

.ikas-shell.is-dark .maturity-table td.domain.purple {
  background: rgba(139, 92, 246, 0.12) !important;
  border-left: 4px solid #8b5cf6 !important;
  color: #c4b5fd !important;
}

.ikas-shell.is-dark .maturity-table td.domain.orange {
  background: rgba(245, 158, 11, 0.12) !important;
  border-left: 4px solid #f59e0b !important;
  color: #fcd34d !important;
}

.ikas-shell.is-dark .maturity-table td.domain.green {
  background: rgba(16, 185, 129, 0.12) !important;
  border-left: 4px solid #10b981 !important;
  color: #6ee7b7 !important;
}

.ikas-shell.is-dark .maturity-table .item,
.ikas-shell.is-dark .status-big {
  color: rgba(255, 255, 255, 0.9) !important;
}
</style>

<template>
  <Pageheader :propData="dataToPass" />

  <div id="ikas-report-content" class="ikas-shell p-1" :class="{ 'is-dark': isDarkMode }">
  <!-- Standalone Header Card -->
  <div class="row">
    <div class="col-12">
      <div class="card custom-card border-0 mb-4 ikas-hero-card">
        <div class="card-header ikas-unified-header">
          <div class="ikas-header-left">
            <div class="ikas-header-icon-box">
              <i class="ri-building-2-line"></i>
            </div>
            <div class="ikas-header-copy">
              <div class="ikas-header-kicker">IKAS</div>
              <div class="ikas-header-label">IKAS - {{ currentStakeholder?.nama_perusahaan || 'Stakeholder' }}</div>
              <div class="ikas-header-stakeholder">
                <span v-if="currentStakeholder?.sub_sektor?.nama_sub_sektor || currentStakeholder?.sektor" class="ikas-header-sektor">
                  {{ currentStakeholder?.sub_sektor?.nama_sub_sektor || currentStakeholder?.sektor }}
                </span>
              </div>
            </div>
          </div>
          <div class="ikas-header-right">
            <span class="ikas-header-kat-badge">{{ ikasDataDynamic.total_kategori }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Below Target Warning -->
  <div v-if="isBelowTarget" class="row mb-3">
    <div class="col-12">
      <div class="ikas-target-warning">
        <i class="ri-alarm-warning-line"></i>
        <div>
          <strong>Skor IKAS di Bawah Target</strong>
          <span>Skor saat ini <b>{{ Number(ikasDataDynamic.total_rata_rata || 0).toFixed(2) }}</b> lebih rendah dari target <b>{{ currentTargetScore.toFixed(2) }}</b> — selisih <b>{{ (currentTargetScore - Number(ikasDataDynamic.total_rata_rata || 0)).toFixed(2) }}</b> poin.</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Year-over-Year Comparison Section -->
  <div class="row mb-4">
    <div class="col-12">
      <IkasComparison
        :stakeholder-slug="currentSlug"
        :perusahaan-id="currentStakeholder?.id || ''"
        :active-year="tableMeasurementYear"
        @year-selected="handleComparisonYearSelected"
      />
    </div>
  </div>

  <!-- Main IKAS Card Body -->
  <div class="row">
    <div class="col-12">
      <div class="card custom-card ikas-main-card">
        <div class="card-body p-4">
          <div class="ikas-year-status-bar">
            <div class="ikas-year-status-main">
              <div class="ikas-year-status-icon"><i class="ri-calendar-check-line"></i></div>
              <div>
                <div class="ikas-year-status-kicker">Tahun Data</div>
                <div class="ikas-year-status-value">{{ tableMeasurementYear }}</div>
              </div>
            </div>
            <div class="ikas-year-status-chips">
              <span
                class="ikas-year-status-chip"
                :class="ikasDataDynamic.is_validated ? 'is-valid' : 'is-draft'"
              >
                <i :class="ikasDataDynamic.is_validated ? 'ri-checkbox-circle-line' : 'ri-time-line'"></i>
                {{ ikasDataDynamic.is_validated ? 'Tervalidasi' : 'Belum validasi' }}
              </span>
              <span
                v-if="ikasDataDynamic.edit_request_status === 'pending'"
                class="ikas-year-status-chip is-edit"
              >
                <i class="ri-edit-2-line"></i>
                Edit pending
              </span>
              <span
                v-else-if="ikasDataDynamic.edit_request_status === 'approved'"
                class="ikas-year-status-chip is-edit"
              >
                <i class="ri-check-line"></i>
                Edit disetujui
              </span>
              <span
                v-else-if="ikasDataDynamic.edit_request_status === 'rejected'"
                class="ikas-year-status-chip is-edit"
              >
                <i class="ri-close-line"></i>
                Edit ditolak
              </span>
            </div>
          </div>

          <!-- Domain summary cards -->
          <div class="domain-strip">
            <div class="domain-card domain-card-blue">
              <div class="domain-card-icon"><i class="ri-search-eye-line"></i></div>
              <div>
                <div class="domain-card-score">{{ formatValue(ikasDataDynamic.identifikasi.nilai_identifikasi) || '—' }}</div>
                <div class="domain-card-label">Identifikasi</div>
                <div class="domain-card-kat">{{ ikasDataDynamic.identifikasi.kategori_identifikasi }}</div>
              </div>
            </div>
            <div class="domain-card domain-card-purple">
              <div class="domain-card-icon"><i class="ri-shield-line"></i></div>
              <div>
                <div class="domain-card-score">{{ formatValue(ikasDataDynamic.proteksi.nilai_proteksi) || '—' }}</div>
                <div class="domain-card-label">Proteksi</div>
                <div class="domain-card-kat">{{ ikasDataDynamic.proteksi.kategori_proteksi }}</div>
              </div>
            </div>
            <div class="domain-card domain-card-orange">
              <div class="domain-card-icon"><i class="ri-radar-line"></i></div>
              <div>
                <div class="domain-card-score">{{ formatValue(ikasDataDynamic.deteksi.nilai_deteksi) || '—' }}</div>
                <div class="domain-card-label">Deteksi</div>
                <div class="domain-card-kat">{{ ikasDataDynamic.deteksi.kategori_deteksi }}</div>
              </div>
            </div>
            <div class="domain-card domain-card-green">
              <div class="domain-card-icon"><i class="ri-first-aid-kit-line"></i></div>
              <div>
                <div class="domain-card-score">{{ formatValue(ikasDataDynamic.tanggulih.nilai_tanggulih) || '—' }}</div>
                <div class="domain-card-label">Penanggulangan &amp; Pemulihan</div>
                <div class="domain-card-kat">{{ ikasDataDynamic.tanggulih.kategori_tanggulih }}</div>
              </div>
            </div>
          </div>

          <div class="ikas-progress-panel">
            <div class="ikas-progress-head">
              <div class="ikas-progress-title-wrap">
                <div class="ikas-progress-icon"><i class="ri-progress-3-line"></i></div>
                <div>
                  <div class="ikas-progress-title">Progress IKAS</div>
                  <div class="ikas-progress-subtitle">
                    {{ ikasAnsweredQuestions }} dari {{ ikasTotalQuestions }} jawaban terisi
                  </div>
                </div>
              </div>
              <div class="ikas-progress-stat">
                <strong>{{ ikasCompletionPercentage }}%</strong>
                <span>{{ ikasPendingQuestions }} belum terisi</span>
              </div>
            </div>
            <div class="ikas-progress-track">
              <div class="ikas-progress-fill" :style="{ width: `${ikasCompletionPercentage}%` }"></div>
            </div>
            <div class="ikas-progress-metrics">
              <div class="ikas-progress-metric">
                <span>Terjawab</span>
                <strong>{{ ikasAnsweredQuestions }}/{{ ikasTotalQuestions }}</strong>
              </div>
              <div class="ikas-progress-metric">
                <span>Persentase</span>
                <strong>{{ ikasCompletionPercentage }}%</strong>
              </div>
              <div class="ikas-progress-metric">
                <span>Sisa</span>
                <strong>{{ ikasPendingQuestions }}</strong>
              </div>
            </div>
            <div class="ikas-progress-foot">
              <span>Jawaban terbaru langsung tercermin di ringkasan IKAS.</span>
              <span>Target: 100%</span>
            </div>
          </div>

          <!-- Action toolbar -->
          <div class="ikas-action-bar" data-html2canvas-ignore="true">
            <input type="file" ref="fileInput" class="d-none" accept=".xlsx, .xls" @change="handleFile" />
            <div class="ikas-action-header">
              <div>
                <div class="ikas-action-title">Panel Aksi IKAS</div>
                <div class="ikas-action-subtitle">Kelola input, status, ekspor, dan validasi dari satu area.</div>
              </div>
              <div class="ikas-action-meta">
                <span class="ikas-action-meta-chip">
                  <i class="ri-file-list-3-line"></i>
                  {{ ikasAnsweredQuestions }}/{{ ikasTotalQuestions }} terjawab
                </span>
                <span class="ikas-action-meta-chip">
                  <i class="ri-check-double-line"></i>
                  {{ ikasCompletionPercentage }}% selesai
                </span>
              </div>
            </div>
            <div class="ikas-action-grid">
              <div class="ikas-action-cluster">
                <span class="ikas-action-label">Aksi utama</span>
                <div class="ikas-action-buttons">
                  <button
                    @click="goToIkasCrud"
                    class="btn-secondary btn-glare rounded-pill btn-md btn-ikas-input"
                    :class="{ 'btn-ikas-input-locked': ikasDataDynamic.is_validated }"
                    :title="ikasDataDynamic.is_validated ? 'Buka validasi dulu sebelum edit' : 'Input data IKAS'"
                  >
                    <i class="ri-edit-box-line"></i> Input Data
                  </button>
                  <button @click="triggerFileInput" class="btn-ikas-upload" :disabled="loading">
                    <span v-if="loading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <i v-else class="ri-file-excel-2-line"></i>
                    {{ loading ? 'Mengupload...' : 'Upload Excel' }}
                  </button>
                  <button @click="exportToPdf" class="btn-ikas-pdf" :disabled="exporting || !currentIkasId">
                    <span v-if="exporting" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <i v-else class="ri-file-pdf-line"></i>
                    {{ exporting ? 'Mengekspor...' : 'Export PDF' }}
                  </button>
                </div>
              </div>
              <div class="ikas-action-cluster ikas-action-cluster-admin">
                <span class="ikas-action-label">Kontrol status</span>
                <div class="ikas-action-buttons">
                  <button v-if="canRequestEdit && currentIkasId && ikasDataDynamic.is_validated" @click="requestEdit" class="btn-ikas-unlock" :disabled="isRequestingEdit">
                    <span v-if="isRequestingEdit" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <i v-else class="ri-edit-2-line"></i>
                    {{ isRequestingEdit ? 'Mengajukan...' : 'Request Edit' }}
                  </button>
                  <button v-if="currentIkasId && !ikasDataDynamic.is_validated" @click="validateAssessment" class="btn-ikas-validate" :disabled="isValidating">
                    <span v-if="isValidating" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <i v-else class="ri-checkbox-circle-line"></i>
                    {{ isValidating ? 'Memvalidasi...' : 'Validasi Data' }}
                  </button>
                  <button v-if="ikasDataDynamic.edit_request_status === 'pending'" @click="approveEdit" class="btn-ikas-approve" :disabled="isApproving">
                    <span v-if="isApproving" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <i v-else class="ri-check-line"></i>
                    {{ isApproving ? 'Menyetujui...' : 'Request Acc' }}
                  </button>
                  <button v-if="ikasDataDynamic.edit_request_status === 'pending'" @click="rejectEdit" class="btn-ikas-reject" :disabled="isRejecting">
                    <span v-if="isRejecting" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <i v-else class="ri-close-line"></i>
                    {{ isRejecting ? 'Menolak...' : 'Tolak' }}
                  </button>
                  <button v-if="currentIkasId" @click="deleteAssessment" class="btn-ikas-delete" :disabled="isDeleting">
                    <span v-if="isDeleting" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <i v-else class="ri-delete-bin-line"></i>
                    {{ isDeleting ? 'Menghapus...' : 'Hapus Data' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="ikasDataDynamic.edit_request_reason && ['pending', 'rejected'].includes(ikasDataDynamic.edit_request_status)"
            class="ikas-request-note"
            :class="ikasDataDynamic.edit_request_status"
          >
            <div>
              <i :class="ikasDataDynamic.edit_request_status === 'rejected' ? 'ri-close-circle-line' : 'ri-edit-2-line'"></i>
              <span>{{ editRequestReasonLabel }}</span>
            </div>
            <p>{{ ikasDataDynamic.edit_request_reason }}</p>
          </div>

          <!-- Maturity table (unchanged logic) -->
          <div class="table-wrapper">
            <table class="maturity-table">
              <colgroup>
                <col class="col-domain-label" />
                <col class="col-question" />
                <col class="col-target" />
                <col class="col-score" />
                <col class="col-domain-score" />
                <col class="col-domain-category" />
                <col class="col-total-category" />
              </colgroup>
              <thead>
                <tr>
                  <th rowspan="2" colspan="2" class="left-title fs-14">
                    Tingkat Kematangan<br />Keamanan Siber
                  </th>
                  <th colspan="5" class="year-title">{{ tableMeasurementYear }}</th>
                </tr>
                <tr class="center">
                  <th>Target Nilai Kematangan</th>
                  <th>Nilai Kematangan</th>
                  <th rowspan="2">Nilai Kematangan per-Domain</th>
                  <th rowspan="2">Kategori Tingkat Kematangan per-Domain</th>
                  <th rowspan="2" class="right-title">
                    Kategori Tingkat Kematangan<br />Keamanan Siber
                  </th>
                </tr>
                <tr>
                  <th colspan="2" class="total">Total</th>
                  <th class="center bold">2.51</th>
                  <th class="center bold">{{ formatValue(ikasDataDynamic.total_rata_rata) }}</th>
                </tr>
              </thead>

              <tbody>
                <!-- IDENTIFIKASI -->
                <tr>
                  <td rowspan="5" class="domain blue">IDENTIFIKASI</td>
                  <td class="item">Mengidentifikasi Peran dan tanggung jawab organisasi</td>
                  <td class="center">{{ ikasDataStatic.identifikasi.peran_tanggung_jawab }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_subdomain1) }}</td>
                  <td rowspan="5" class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_identifikasi) }}</td>
                  <td rowspan="5" class="center">{{ ikasDataDynamic.identifikasi.kategori_identifikasi }}</td>
                  <td rowspan="18" class="status-big">{{ ikasDataDynamic.total_kategori }}</td>
                </tr>
                <tr>
                  <td class="item">Menyusun strategi, kebijakan, dan prosedur Keamanan Siber</td>
                  <td class="center">{{ ikasDataStatic.identifikasi.strategi_kebijakan }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_subdomain2) }}</td>
                </tr>
                <tr>
                  <td class="item">Mengelola aset informasi</td>
                  <td class="center">{{ ikasDataStatic.identifikasi.aset_informasi }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_subdomain3) }}</td>
                </tr>
                <tr>
                  <td class="item">Menilai dan mengelola risiko Keamanan Siber</td>
                  <td class="center">{{ ikasDataStatic.identifikasi.risiko_keamanan }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_subdomain4) }}</td>
                </tr>
                <tr>
                  <td class="item">Mengelola risiko rantai pasok</td>
                  <td class="center">{{ ikasDataStatic.identifikasi.rantai_pasok }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_subdomain5) }}</td>
                </tr>

                <!-- PROTEKSI -->
                <tr>
                  <td rowspan="6" class="domain purple">PROTEKSI</td>
                  <td class="item">Mengelola identitas, autentikasi, dan kendali akses</td>
                  <td class="center">{{ ikasDataStatic.proteksi.identitas_autentikasi }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain1) }}</td>
                  <td rowspan="6" class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_proteksi) }}</td>
                  <td rowspan="6" class="center">{{ ikasDataDynamic.proteksi.kategori_proteksi }}</td>
                </tr>
                <tr>
                  <td class="item">Melindungi aset fisik</td>
                  <td class="center">{{ ikasDataStatic.proteksi.aset_fisik }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain2) }}</td>
                </tr>
                <tr>
                  <td class="item">Melindungi data</td>
                  <td class="center">{{ ikasDataStatic.proteksi.data }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain3) }}</td>
                </tr>
                <tr>
                  <td class="item">Melindungi aplikasi</td>
                  <td class="center">{{ ikasDataStatic.proteksi.aplikasi }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain4) }}</td>
                </tr>
                <tr>
                  <td class="item">Melindungi jaringan</td>
                  <td class="center">{{ ikasDataStatic.proteksi.jaringan }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain5) }}</td>
                </tr>
                <tr>
                  <td class="item">Melindungi sumber daya manusia</td>
                  <td class="center">{{ ikasDataStatic.proteksi.sdm }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain6) }}</td>
                </tr>

                <!-- DETEKSI -->
                <tr>
                  <td rowspan="3" class="domain orange">DETEKSI</td>
                  <td class="item">Mengelola deteksi Peristiwa Siber</td>
                  <td class="center">{{ ikasDataStatic.deteksi.deteksi_peristiwa }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.deteksi.nilai_subdomain1) }}</td>
                  <td rowspan="3" class="center">{{ formatValue(ikasDataDynamic.deteksi.nilai_deteksi) }}</td>
                  <td rowspan="3" class="center">{{ ikasDataDynamic.deteksi.kategori_deteksi }}</td>
                </tr>
                <tr>
                  <td class="item">Menganalisis anomali dan Peristiwa Siber</td>
                  <td class="center">{{ ikasDataStatic.deteksi.anomali_peristiwa }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.deteksi.nilai_subdomain2) }}</td>
                </tr>
                <tr>
                  <td class="item">Memantau Peristiwa Siber berkelanjutan</td>
                  <td class="center">{{ ikasDataStatic.deteksi.pemantauan_berkelanjutan }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.deteksi.nilai_subdomain3) }}</td>
                </tr>

                <!-- PENANGGULANGAN & PEMULIHAN -->
                <tr>
                  <td rowspan="4" class="domain green">PENANGGULANGAN &amp; PEMULIHAN</td>
                  <td class="item">Menyusun perencanaan penanggulangan dan pemulihan Insiden Siber</td>
                  <td class="center">{{ ikasDataStatic.tanggulih.perencanaan_pemulihan }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.tanggulih.nilai_subdomain1) }}</td>
                  <td rowspan="4" class="center">{{ formatValue(ikasDataDynamic.tanggulih.nilai_tanggulih) }}</td>
                  <td rowspan="4" class="center">{{ ikasDataDynamic.tanggulih.kategori_tanggulih }}</td>
                </tr>
                <tr>
                  <td class="item">Menganalisis dan melaporkan Insiden Siber</td>
                  <td class="center">{{ ikasDataStatic.tanggulih.analisis_pelaporan }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.tanggulih.nilai_subdomain2) }}</td>
                </tr>
                <tr>
                  <td class="item">Melaksanakan penanggulangan dan pemulihan Insiden Siber</td>
                  <td class="center">{{ ikasDataStatic.tanggulih.pelaksanaan_pemulihan }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.tanggulih.nilai_subdomain3) }}</td>
                </tr>
                <tr>
                  <td class="item">Meningkatkan keamanan setelah terjadinya Insiden Siber</td>
                  <td class="center">{{ ikasDataStatic.tanggulih.peningkatan_keamanan }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.tanggulih.nilai_subdomain4) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  </div>
  <!-- Radar Charts Section -->
  <div class="row">
    <div class="col-12">
      <RadarChartIkas :stakeholder-slug="currentSlug" />
    </div>
  </div>
  </div>

</template>







