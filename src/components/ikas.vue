<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import gsap from 'gsap';
import { useRoute, useRouter } from 'vue-router';
import { useStakeholdersStore } from '../stores/stakeholders';
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
let hydrateCurrentStakeholderPromise = null;

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
    if (hydrateCurrentStakeholderPromise) {
        return hydrateCurrentStakeholderPromise;
    }

    // Start store initializations in parallel
    hydrateCurrentStakeholderPromise = (async () => {
      const initPromises = [
            assessmentStore.fetchAssessmentStructure({ includeMasterStructure: false }),
        ];

        if (!stakeholdersStore.initialized) {
            initPromises.push(stakeholdersStore.initialize());
        }
        await Promise.all(initPromises);

        const slug = String(route.query.slug || '');
        if (!slug) return;

        const stakeholder = stakeholdersStore.getStakeholderBySlug(slug);
        assessmentStore.setCurrentStakeholder(slug);
        assessmentStore.resetStakeholderData(slug);

        if (stakeholder?.id) {
            const requestedYear = String(route.query.year || activeMeasurementYear.value || currentMeasurementYear);
            const ikasResult = await ikasStore.fetchFromBackend(
                slug,
                String(route.query.perusahaan_id || stakeholder.id || ''),
                requestedYear,
                String(route.query.ikas_id || '')
            );

            activeMeasurementYear.value = ikasResult.exists
                ? (
                    ikasResult.respondentData?.tahun_pengukuran ||
                    getRecordMeasurementYear(ikasResult.ikasRecord) ||
                    requestedYear ||
                    currentMeasurementYear
                )
                : (requestedYear || currentMeasurementYear);

            if (ikasResult.exists) {
                await assessmentStore.hydrateAnswersFromBackend(slug, stakeholder.id);
            }
        }
    })();

    try {
        await hydrateCurrentStakeholderPromise;
    } finally {
        hydrateCurrentStakeholderPromise = null;
    }
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
const currentIkasSummary = computed(() => (
    currentSlug.value ? ikasStore.getIkasSummary(currentSlug.value) : null
));
const currentIkasId = computed(() => {
    const summaryId = String(currentIkasSummary.value?.id || '');
    const backendId = String(ikasStore.getBackendIkasId(currentSlug.value) || '');
    const resolvedId = summaryId || backendId;
    return resolvedId && !ikasStore.isHiddenIkasId(resolvedId) ? resolvedId : '';
});
const hasActiveIkasRecord = computed(() => !!currentIkasId.value);
const currentPerusahaanId = computed(() => String(route.query.perusahaan_id || currentStakeholder.value?.id || ''));
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

const ikasQuestionAnsweredCount = computed(() => assessmentStore.answeredQuestions || 0);
const ikasQuestionTotalCount = computed(() => assessmentStore.totalQuestions || 0);
const ikasSubdomainProgress = computed(() => {
    if (!currentSlug.value) {
        return { answered: 0, total: 0, percent: 0 };
    }
    return ikasStore.getOverallProgress(currentSlug.value);
});
const ikasAnsweredQuestions = computed(() => (
    ikasQuestionAnsweredCount.value
));
const ikasTotalQuestions = computed(() => (
    ikasQuestionTotalCount.value
));
const ikasCompletionPercentage = computed(() => {
    const total = ikasTotalQuestions.value;
    if (!total) return 0;
    return Math.min(100, Math.round((ikasAnsweredQuestions.value / total) * 100));
});
const ikasPendingQuestions = computed(() => Math.max(ikasTotalQuestions.value - ikasAnsweredQuestions.value, 0));
const ikasProgressUnitLabel = computed(() => (
    'jawaban terisi'
));

const currentTargetScore = computed(() => {
    const slug = currentSlug.value;
    const summary = ikasStore.ikasSummaryMap[slug];
    const raw = summary?.raw;
    return Number(raw?.target_nilai || 0);
});

const currentTargetScoreDisplay = computed(() => (
    currentTargetScore.value > 0 ? currentTargetScore.value.toFixed(2) : '-'
));

const getNumericScore = (value) => {
    if (value === null || value === undefined || value === '' || value === 'NA') return null;
    const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
};

const calculateAverageScore = (values) => {
    const numericValues = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
    const hasNa = values.some((value) => value === 'NA');

    if (hasNa && !numericValues.length) return 'NA';
    if (!numericValues.length) return 0;

    return Number((numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length).toFixed(2));
};

const ikasDisplayTotalScore = computed(() => {
    const data = ikasDataDynamic.value;
    const domainValues = [
        data?.identifikasi?.nilai_identifikasi,
        data?.proteksi?.nilai_proteksi,
        data?.deteksi?.nilai_deteksi,
        data?.tanggulih?.nilai_tanggulih,
    ];

    return calculateAverageScore(domainValues);
});

const ikasPrimaryTotalScore = computed(() => {
    const slug = currentSlug.value;
    const summary = ikasStore.ikasSummaryMap[slug];
    const raw = summary?.raw;
    const explicitScore = getNumericScore(
        raw?.nilai_kematangan ??
        raw?.total_rata_rata ??
        ikasDataDynamic.value?.total_rata_rata
    );

    if (explicitScore !== null) {
        return explicitScore;
    }

    return ikasDisplayTotalScore.value;
});

const ikasDisplayTotalCategory = computed(() => {
    const score = ikasPrimaryTotalScore.value;
    if (score === 'NA') return 'Not Applicable';
    if (score <= 0) return 'INPUT BELUM LENGKAP';
    if (score < 1.5) return 'Level 1 - Awal';
    if (score < 2.5) return 'Level 2 - Berulang';
    if (score < 3.5) return 'Level 3 - Terdefinisi';
    if (score < 4.5) return 'Level 4 - Terkelola';
    return 'Level 5 - Optimal';
});

const isBelowTarget = computed(() => {
    if (!currentTargetScore.value || currentTargetScore.value <= 0) return false;
    const score = Number(ikasPrimaryTotalScore.value || 0);
    return score < currentTargetScore.value;
});

const shouldShowBelowTargetWarning = computed(() => {
    const isEmptyCurrentYear = (
        String(tableMeasurementYear.value) === String(currentMeasurementYear) &&
        !currentIkasId.value
    );

    return isBelowTarget.value && !isEmptyCurrentYear;
});

const popupCardRef = ref(null);
const popupToastRef = ref(null);
const popupState = reactive({
    open: false,
    mode: 'alert',
    variant: 'info',
    title: '',
    message: '',
    confirmText: 'OK',
    cancelText: 'Batal',
    inputValue: '',
    inputPlaceholder: '',
    resolve: null,
});

const toastState = reactive({
    visible: false,
    variant: 'success',
    title: '',
    message: '',
});

const importModalCardRef = ref(null);
const importModalState = reactive({
    open: false,
    stage: 'idle',
    title: 'Import Excel IKAS',
    message: '',
    fileName: '',
    saveLoading: false,
    finishLoading: false,
});

const importIsComplete = computed(() => {
    const total = Number(assessmentStore.totalQuestions || 0);
    return total > 0 && Number(assessmentStore.answeredQuestions || 0) >= total;
});

const openPopup = async ({
    mode = 'alert',
    variant = 'info',
    title = '',
    message = '',
    confirmText = 'OK',
    cancelText = 'Batal',
    inputValue = '',
    inputPlaceholder = '',
} = {}) => {
    popupState.open = true;
    popupState.mode = mode;
    popupState.variant = variant;
    popupState.title = title;
    popupState.message = message;
    popupState.confirmText = confirmText;
    popupState.cancelText = cancelText;
    popupState.inputValue = inputValue;
    popupState.inputPlaceholder = inputPlaceholder;

    await nextTick();
    if (popupCardRef.value) {
        gsap.fromTo(
            popupCardRef.value,
            { y: 20, opacity: 0, scale: 0.96 },
            { y: 0, opacity: 1, scale: 1, duration: 0.28, ease: 'power2.out' }
        );
    }

    return new Promise((resolve) => {
        popupState.resolve = resolve;
    });
};

const closePopup = async (confirmed = false) => {
    const resolver = popupState.resolve;
    if (popupCardRef.value) {
        await gsap.to(popupCardRef.value, {
            y: 12,
            opacity: 0,
            scale: 0.98,
            duration: 0.18,
            ease: 'power2.in',
        });
    }

    popupState.open = false;
    popupState.resolve = null;

    if (resolver) {
        resolver({
            confirmed,
            value: popupState.inputValue,
        });
    }
};

const showToastPopup = async ({
    variant = 'success',
    title = '',
    message = '',
} = {}) => {
    toastState.visible = true;
    toastState.variant = variant;
    toastState.title = title;
    toastState.message = message;

    await nextTick();
    if (popupToastRef.value) {
        gsap.killTweensOf(popupToastRef.value);
        gsap.fromTo(
            popupToastRef.value,
            { x: 30, opacity: 0, scale: 0.96 },
            { x: 0, opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out' }
        );
        gsap.to(popupToastRef.value, {
            opacity: 0,
            x: 18,
            duration: 0.24,
            ease: 'power2.in',
            delay: 2.2,
            onComplete: () => {
                toastState.visible = false;
            },
        });
    }
};

const openImportModal = async ({
    stage = 'uploading',
    title = 'Import Excel IKAS',
    message = '',
    fileName = '',
} = {}) => {
    importModalState.open = true;
    importModalState.stage = stage;
    importModalState.title = title;
    importModalState.message = message;
    importModalState.fileName = fileName;
    importModalState.saveLoading = false;
    importModalState.finishLoading = false;

    await nextTick();
    if (importModalCardRef.value) {
        gsap.fromTo(
            importModalCardRef.value,
            { y: 18, opacity: 0, scale: 0.97 },
            { y: 0, opacity: 1, scale: 1, duration: 0.24, ease: 'power2.out' }
        );
    }
};

const closeImportModal = async (force = false) => {
    if (!force && (importModalState.saveLoading || importModalState.finishLoading)) return;

    if (importModalCardRef.value) {
        await gsap.to(importModalCardRef.value, {
            y: 10,
            opacity: 0,
            scale: 0.98,
            duration: 0.18,
            ease: 'power2.in',
        });
    }

    importModalState.open = false;
};

const finalizeImportedIkas = async (mode = 'save') => {
    const slug = currentSlug.value;
    const stakeholder = currentStakeholder.value;

    if (!slug || !stakeholder?.id) {
        showCornerToast('error', 'Data stakeholder tidak ditemukan.', 'Gagal');
        return;
    }

    const isFinish = mode === 'finish';
    const loadingKey = isFinish ? 'finishLoading' : 'saveLoading';
    if (importModalState.saveLoading || importModalState.finishLoading) return;

    importModalState[loadingKey] = true;

    try {
        const importPayload = getImportMetadata();
        const result = await ikasStore.submitToBackend(slug, {
            id_perusahaan: stakeholder.id,
            responden: importPayload.responden,
            jabatan: importPayload.jabatan,
            telepon: importPayload.telepon,
            tanggal: importPayload.tanggal,
            tahun_pengukuran: activeMeasurementYear.value || currentMeasurementYear,
            target_nilai: importPayload.target_nilai,
        });

        if (!result.success) {
            throw new Error(result.error || 'Gagal menyimpan data IKAS ke server');
        }

        if (isFinish) {
            await hydrateBackendAnswersUntilSettled(slug, stakeholder.id, 5, 1500);
        }

        if (isFinish) {
            importModalState.finishLoading = false;
            await closeImportModal(true);
        }

        showCornerToast(
            'success',
            isFinish
                ? 'Data IKAS berhasil disimpan.'
                : 'Data IKAS berhasil disimpan.',
            'Berhasil'
        );
        window.dispatchEvent(new Event('ikas-requests-updated'));
    } catch (error) {
        console.error('[IKAS] Finalize import failed:', error);
        showCornerToast('error', error?.message || 'Terjadi kesalahan saat menyimpan hasil import.', 'Gagal');
    } finally {
        importModalState.saveLoading = false;
        importModalState.finishLoading = false;
    }
};

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
    assessmentStore.initialize().finally(() => {
        router.push({ path: '/ikas-crud', query });
    });
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
    const ikasId = currentIkasId.value;
    if (!ikasId) {
        await showToastPopup({
            variant: 'warning',
            title: 'Tidak ada data',
            message: 'Tidak ada data penilaian untuk dihapus.',
        });
        return;
    }

    const confirmation = await openPopup({
        mode: 'confirm',
        variant: 'danger',
        title: 'Hapus Data IKAS',
        message: 'Data penilaian IKAS akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.',
        confirmText: 'Ya, Hapus',
        cancelText: 'Batal',
    });

    if (!confirmation.confirmed) {
        return;
    }

    isDeleting.value = true;
    try {
        await ikasStore.deleteFromBackend(ikasId);
        ikasStore.resetStakeholderData(currentSlug.value);
        assessmentStore.resetStakeholderData(currentSlug.value);
        await router.replace({
            path: route.path,
            query: {
                ...route.query,
                ikas_id: undefined,
            },
        });
        await hydrateCurrentStakeholderIkas();
        await showToastPopup({
            variant: 'success',
            title: 'Berhasil dihapus',
            message: 'Data penilaian IKAS berhasil dihapus.',
        });
    } catch (error) {
        console.error('Delete error:', error);
        await showToastPopup({
            variant: 'danger',
            title: 'Gagal menghapus',
            message: error?.message || 'Terjadi kesalahan saat menghapus data.',
        });
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
    const ikasId = currentIkasId.value;
    if (!ikasId) {
        await showToastPopup({
            variant: 'warning',
            title: 'Tidak ada data',
            message: 'Tidak ada data penilaian untuk divalidasi.',
        });
        return;
    }

    const confirmation = await openPopup({
        mode: 'confirm',
        variant: 'primary',
        title: 'Validasi Data IKAS',
        message: 'Pastikan data sudah benar. Setelah divalidasi, data akan dikunci sampai ada request edit.',
        confirmText: 'Validasi',
        cancelText: 'Batal',
    });

    if (!confirmation.confirmed) {
        return;
    }

    isValidating.value = true;
    try {
        console.warn('[IKAS] Triggering validation for ID:', ikasId);
        const result = await ikasStore.validateIkas(currentSlug.value);
        if (result.success) {
            syncIkasRecordState({ editRequestStatus: 'none', isValidated: true });
            await showToastPopup({
                variant: 'success',
                title: 'Validasi berhasil',
                message: 'Data penilaian IKAS berhasil divalidasi.',
            });
        } else {
            console.error('[IKAS] Validation failed:', result.error);
            await showToastPopup({
                variant: 'danger',
                title: 'Validasi gagal',
                message: result.error || 'Gagal memvalidasi data.',
            });
        }
    } catch (err) {
        console.error('[IKAS] Error during validation process:', err);
        await showToastPopup({
            variant: 'danger',
            title: 'Validasi gagal',
            message: 'Terjadi kesalahan saat memvalidasi data.',
        });
    } finally {
        isValidating.value = false;
    }
};

const requestEdit = async () => {
    const ikasId = currentIkasId.value;
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
    const ikasId = currentIkasId.value;
    if (!ikasId) return;

    const confirmation = await openPopup({
        mode: 'confirm',
        variant: 'success',
        title: 'Setujui Request Edit',
        message: 'Permintaan edit akan disetujui dan data IKAS bisa diedit kembali.',
        confirmText: 'Setujui',
        cancelText: 'Batal',
    });

    if (!confirmation.confirmed) return;

    isApproving.value = true;
    try {
        const result = await ikasStore.approveEditIkas(currentSlug.value);
        if (result.success) {
            syncIkasRecordState({ editRequestStatus: 'approved', isValidated: false });
            await showToastPopup({
                variant: 'success',
                title: 'Request disetujui',
                message: 'Permintaan edit IKAS berhasil disetujui.',
            });
        } else {
            await showToastPopup({
                variant: 'danger',
                title: 'Gagal menyetujui',
                message: result.error || 'Gagal menyetujui request edit.',
            });
        }
    } catch (err) {
        console.error('[IKAS] Approve edit error:', err);
        await showToastPopup({
            variant: 'danger',
            title: 'Gagal menyetujui',
            message: 'Terjadi kesalahan saat menyetujui edit.',
        });
    } finally {
        isApproving.value = false;
    }
};

const rejectEdit = async () => {
    const ikasId = currentIkasId.value;
    if (!ikasId) return;

    const promptResult = await openPopup({
        mode: 'prompt',
        variant: 'warning',
        title: 'Tolak Request Edit',
        message: 'Masukkan alasan penolakan agar user tahu apa yang perlu diperbaiki.',
        confirmText: 'Tolak Request',
        cancelText: 'Batal',
        inputPlaceholder: 'Tulis alasan penolakan...',
    });

    if (!promptResult.confirmed) return;
    if (!promptResult.value.trim()) {
        await showToastPopup({
            variant: 'warning',
            title: 'Alasan wajib diisi',
            message: 'Alasan penolakan wajib diisi agar user tahu apa yang perlu diperbaiki.',
        });
        return;
    }

    isRejecting.value = true;
    try {
        const result = await ikasStore.rejectEditIkas(currentSlug.value, promptResult.value.trim());
        if (result.success) {
            syncIkasRecordState({ editRequestStatus: 'rejected', editRequestReason: promptResult.value.trim(), isValidated: true });
            await showToastPopup({
                variant: 'success',
                title: 'Request ditolak',
                message: 'Permintaan edit IKAS berhasil ditolak.',
            });
        } else {
            await showToastPopup({
                variant: 'danger',
                title: 'Gagal menolak',
                message: result.error || 'Gagal menolak request edit.',
            });
        }
    } catch (err) {
        console.error('[IKAS] Reject edit error:', err);
        await showToastPopup({
            variant: 'danger',
            title: 'Gagal menolak',
            message: 'Terjadi kesalahan saat menolak edit.',
        });
    } finally {
        isRejecting.value = false;
    }
};

// --- STATE: Upload Excel Feature ---
const fileInput = ref(null);
const selectedFile = ref(null);
const lastImportResult = ref(null);
const tableData = ref([]);
const loading = ref(false);
const errorMessage = ref('');

const getImportMetadata = () => {
    const slug = currentSlug.value;
    const stakeholder = currentStakeholder.value;
    const summary = slug ? ikasStore.ikasSummaryMap[slug]?.raw || {} : {};
    const profile = slug ? assessmentStore.respondentProfile : null;
    const targetNilai = Number(
        profile?.targetNilai ||
        summary?.target_nilai ||
        0
    ) || 0;

    const fallbackRespondent = String(
        profile?.namaResponden ||
        summary?.responden ||
        stakeholder?.nama_perusahaan ||
        'Import Excel IKAS'
    ).trim();

    return {
        id_perusahaan: currentPerusahaanId.value || stakeholder?.id || summary?.perusahaan?.id || '',
        tanggal: String(
            profile?.tanggalPengisian ||
            summary?.tanggal ||
            summary?.tanggal_pengisian ||
            summary?.tanggal_pengukuran ||
            new Date().toISOString().split('T')[0]
        ).split('T')[0],
        responden: fallbackRespondent || 'Import Excel IKAS',
        telepon: String(profile?.nomorTelepon || summary?.telepon || '-').trim() || '-',
        jabatan: String(profile?.jabatanResponden || summary?.jabatan || '-').trim() || '-',
        target_nilai: targetNilai,
    };
};

const buildRespondentProfileFromImport = () => {
    const stakeholder = currentStakeholder.value;
    const metadata = getImportMetadata();

    return {
        instansi: stakeholder?.nama_perusahaan || '',
        sektor: stakeholder?.sub_sektor?.nama_sub_sektor || stakeholder?.sektor || '',
        alamat: stakeholder?.alamat || '',
        email: stakeholder?.email || '',
        namaResponden: metadata.responden,
        jabatanResponden: metadata.jabatan,
        nomorTelepon: metadata.telepon,
        tahunPengukuran: activeMeasurementYear.value || currentMeasurementYear,
        targetLevel: metadata.target_nilai,
        targetNilai: String(metadata.target_nilai || ''),
        acuan: '',
        tanggalPengisian: metadata.tanggal,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
};

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
        showCornerToast('error', errorMessage.value, 'Gagal upload');
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
        showCornerToast('error', errorMessage.value, 'Gagal upload');
        return;
    }

    loading.value = true;
    errorMessage.value = '';
    await openImportModal({
        stage: 'uploading',
        title: 'Memproses Import Excel',
        message: 'File sedang diunggah dan data IKAS sedang disiapkan.',
        fileName: selectedFile.value?.name || '',
    });

    const formData = new FormData();
    const importMetadata = getImportMetadata();
    formData.append('file', selectedFile.value);
    formData.append('id_perusahaan', String(importMetadata.id_perusahaan || ''));
    formData.append('tanggal', String(importMetadata.tanggal || ''));
    formData.append('responden', String(importMetadata.responden || ''));
    formData.append('telepon', String(importMetadata.telepon || ''));
    formData.append('jabatan', String(importMetadata.jabatan || ''));

    try {
        // Mengirim file ke endpoint backend
        notifStore.trackSelfAction('ikas', '');
        const response = await fetch('/api/maturity/ikas/import', {
            method: 'POST',
            body: formData,
            // Headers untuk Content-Type otomatis diatur oleh browser saat menggunakan FormData
        });

        const result = await response.json();
        lastImportResult.value = result;
        const isSuccess = resolveUploadSuccess(response, result);
        const resolvedMessage = resolveUploadErrorMessage(result, response.ok ? '' : 'Gagal mengupload file');

        if (!isSuccess) {
            throw new Error(resolvedMessage);
        }

        tableData.value = Array.isArray(result?.data) ? result.data : [];
        const stakeholder = currentStakeholder.value;
        const slug = currentSlug.value;
        const importPayload = getImportMetadata();

        await ikasStore.refresh();
        await hydrateCurrentStakeholderIkas();

        if (slug && stakeholder?.id) {
            assessmentStore.saveRespondentProfile(buildRespondentProfileFromImport());

            let finalIkasId = ikasStore.getBackendIkasId(slug);
            if (!finalIkasId) {
                const ensureResult = await ikasStore.ensureBackendIkasRecord(slug, {
                    id_perusahaan: stakeholder.id,
                    responden: importPayload.responden,
                    jabatan: importPayload.jabatan,
                    telepon: importPayload.telepon,
                    tanggal: importPayload.tanggal,
                    tahun_pengukuran: activeMeasurementYear.value || currentMeasurementYear,
                    target_nilai: importPayload.target_nilai,
                });

                if (!ensureResult.success) {
                    throw new Error(ensureResult.error || 'Gagal menyiapkan data IKAS setelah import');
                }

                await ikasStore.refresh();
                await hydrateCurrentStakeholderIkas();
                finalIkasId = ikasStore.getBackendIkasId(slug);
            }

            if (!finalIkasId) {
                throw new Error('IKAS ID tidak ditemukan setelah import');
            }

            await hydrateBackendAnswersUntilSettled(slug, stakeholder.id, 5, 1500);
        }

        importModalState.stage = 'ready';
        importModalState.title = 'Import Excel Selesai';
        importModalState.message = 'Data berhasil diperbarui dari file Excel. Pilih Simpan atau Selesai untuk melanjutkan.';
        importModalState.fileName = selectedFile.value?.name || importModalState.fileName;
        window.dispatchEvent(new Event('ikas-requests-updated'));

    } catch (error) {
        // Handle error response
        console.error('Upload error:', error);
        errorMessage.value = error?.message || 'Terjadi kesalahan saat upload file IKAS.';
        showCornerToast('error', errorMessage.value, 'Gagal upload');
        importModalState.stage = 'error';
        importModalState.title = 'Import Gagal';
        importModalState.message = errorMessage.value;
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const hydrateBackendAnswersUntilSettled = async (slug, perusahaanId, attempts = 5, waitMs = 1200) => {
    let previousCount = -1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        await assessmentStore.hydrateAnswersFromBackend(slug, perusahaanId, { syncIkas: false });
        const currentCount = assessmentStore.answeredQuestions || 0;
        if (currentCount === previousCount) {
            break;
        }
        previousCount = currentCount;

        if (attempt < attempts - 1) {
            await delay(waitMs);
        }
    }
};

const showCornerToast = (type, message, title = '') => {
    const variantMap = {
        success: 'success',
        error: 'danger',
        warning: 'warning',
        info: 'info',
    };

    return showToastPopup({
        variant: variantMap[type] || 'info',
        title: title || (type === 'success' ? 'Berhasil' : type === 'error' ? 'Gagal' : type === 'warning' ? 'Peringatan' : 'Informasi'),
        message,
    });
};

const resolveUploadSuccess = (response, result) => {
    const message = String(result?.message || result?.msg || '');
    const hasSuccessFlag = result?.success === true || result?.status === true || result?.ok === true;
    const messageLooksSuccessful = /berhasil|sukses|success/i.test(message) && !/gagal|error|gagal menyimpan/i.test(message);

    return response.ok && (hasSuccessFlag || messageLooksSuccessful || Array.isArray(result?.data));
};

const resolveUploadErrorMessage = (result, fallbackMessage = '') => {
    const rawMessage = String(
        result?.message ||
        result?.msg ||
        result?.error ||
        result?.errors?.file?.[0] ||
        result?.errors?.nama_perusahaan?.[0] ||
        result?.errors?.namaPerusahaan?.[0] ||
        fallbackMessage ||
        'Terjadi kesalahan saat upload file IKAS.'
    ).trim();

    if (/nama.*perusahaan|perusahaan.*tidak.*sesuai|stakeholder.*tidak.*ditemukan/i.test(rawMessage)) {
        const expectedName = currentStakeholder.value?.nama_perusahaan;
        return expectedName
            ? `Nama perusahaan pada file Excel tidak sesuai. Pastikan nama di file sama dengan "${expectedName}".`
            : 'Nama perusahaan pada file Excel tidak sesuai dengan data stakeholder yang dipilih.';
    }

    if (/berhasil menyimpan data ikas/i.test(rawMessage)) {
        return 'Data IKAS berhasil diperbarui dari file Excel.';
    }

    return rawMessage;
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

.ikas-popup-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(15, 23, 42, 0.38);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.ikas-popup-card {
  width: min(480px, 100%);
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  border: 1px solid rgba(203, 213, 225, 0.9);
  border-radius: 24px;
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.22);
  padding: 26px;
  text-align: center;
}

.ikas-popup-card.is-danger { border-color: rgba(248, 113, 113, 0.4); }
.ikas-popup-card.is-success { border-color: rgba(74, 222, 128, 0.42); }
.ikas-popup-card.is-warning { border-color: rgba(251, 191, 36, 0.46); }
.ikas-popup-card.is-primary { border-color: rgba(96, 165, 250, 0.42); }

.ikas-popup-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  font-size: 30px;
  color: #fff;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

.ikas-popup-card.is-danger .ikas-popup-icon { background: linear-gradient(135deg, #ef4444, #dc2626); }
.ikas-popup-card.is-success .ikas-popup-icon { background: linear-gradient(135deg, #10b981, #059669); }
.ikas-popup-card.is-warning .ikas-popup-icon { background: linear-gradient(135deg, #f59e0b, #d97706); }

.ikas-popup-title {
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 8px;
}

.ikas-popup-message {
  font-size: 14px;
  line-height: 1.6;
  color: #475569;
  margin-bottom: 18px;
}

.ikas-popup-textarea {
  width: 100%;
  border-radius: 18px;
  border: 1px solid #d9e3ef;
  background: #fff;
  padding: 14px 16px;
  resize: vertical;
  min-height: 108px;
  font-size: 14px;
  color: #0f172a;
  outline: none;
}

.ikas-popup-textarea:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.14);
}

.ikas-popup-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 18px;
}

.ikas-popup-btn {
  border: 0;
  border-radius: 999px;
  min-width: 130px;
  padding: 11px 18px;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.22);
}

.ikas-popup-btn.is-danger { background: linear-gradient(135deg, #ef4444, #dc2626); box-shadow: 0 12px 24px rgba(220, 38, 38, 0.22); }
.ikas-popup-btn.is-success { background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 12px 24px rgba(5, 150, 105, 0.22); }
.ikas-popup-btn.is-warning { background: linear-gradient(135deg, #f59e0b, #d97706); box-shadow: 0 12px 24px rgba(217, 119, 6, 0.22); }

.ikas-popup-btn.is-ghost {
  background: #eef2f7;
  color: #334155;
  box-shadow: none;
}

.ikas-import-modal-card {
  text-align: left;
}

.ikas-import-modal-icon {
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
}

.ikas-import-modal-card.is-ready .ikas-import-modal-icon {
  background: linear-gradient(135deg, #10b981, #059669);
}

.ikas-import-modal-card.is-error .ikas-import-modal-icon {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.ikas-import-file {
  align-items: center;
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.14);
  border-radius: 16px;
  color: #1e3a8a;
  display: flex;
  gap: 10px;
  margin-top: 2px;
  padding: 12px 14px;
}

.ikas-import-file i {
  font-size: 1.1rem;
}

.ikas-import-file span {
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-import-summary {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 16px;
}

.ikas-import-summary > div {
  background: rgba(15, 23, 42, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 14px;
  padding: 12px;
}

.ikas-import-summary span {
  color: #64748b;
  display: block;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.ikas-import-summary strong {
  color: #0f172a;
  font-size: 14px;
  font-weight: 800;
}

.ikas-import-actions {
  justify-content: flex-end;
}

.ikas-import-actions .ikas-popup-btn {
  min-width: 118px;
}

.ikas-import-modal-card.is-dark {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(17, 24, 39, 0.96) 100%);
  border-color: rgba(148, 163, 184, 0.22);
}

.ikas-import-modal-card.is-dark .ikas-popup-title,
.ikas-import-modal-card.is-dark .ikas-popup-message,
.ikas-import-modal-card.is-dark .ikas-import-summary strong {
  color: #f8fafc;
}

.ikas-import-modal-card.is-dark .ikas-popup-message,
.ikas-import-modal-card.is-dark .ikas-import-summary span,
.ikas-import-modal-card.is-dark .ikas-import-file {
  color: #cbd5e1;
}

.ikas-import-modal-card.is-dark .ikas-import-file {
  background: rgba(59, 130, 246, 0.16);
  border-color: rgba(96, 165, 250, 0.22);
}

.ikas-import-modal-card.is-dark .ikas-import-summary > div {
  background: rgba(15, 23, 42, 0.6);
  border-color: rgba(148, 163, 184, 0.16);
}

.ikas-toast-wrap {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 1210;
  pointer-events: none;
}

.ikas-toast-card {
  width: min(380px, calc(100vw - 32px));
  display: flex;
  align-items: center;
  gap: 14px;
  border-radius: 18px;
  padding: 16px 18px;
  color: #f8fafc;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
  background: linear-gradient(135deg, #18b27d, #0f9f6e);
}

.ikas-toast-card.is-warning { background: linear-gradient(135deg, #f4a524, #d97706); }
.ikas-toast-card.is-danger { background: linear-gradient(135deg, #ef5350, #dc2626); }
.ikas-toast-card.is-info { background: linear-gradient(135deg, #3b82f6, #2563eb); }

.ikas-toast-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.18);
  font-size: 20px;
  flex-shrink: 0;
}

.ikas-toast-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ikas-toast-copy strong {
  font-size: 14px;
  font-weight: 800;
}

.ikas-toast-copy span {
  font-size: 12.5px;
  line-height: 1.5;
  opacity: 0.92;
}

.ikas-popup-fade-enter-active,
.ikas-popup-fade-leave-active {
  transition: opacity 0.18s ease;
}

.ikas-popup-fade-enter-from,
.ikas-popup-fade-leave-to {
  opacity: 0;
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
            <span class="ikas-header-kat-badge">{{ ikasDisplayTotalCategory }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Below Target Warning -->
  <div v-if="shouldShowBelowTargetWarning" class="row mb-3">
    <div class="col-12">
      <div class="ikas-target-warning">
        <i class="ri-alarm-warning-line"></i>
        <div>
          <strong>Skor IKAS di Bawah Target</strong>
          <span>Skor saat ini <b>{{ Number(ikasPrimaryTotalScore || 0).toFixed(2) }}</b> lebih rendah dari target <b>{{ currentTargetScore.toFixed(2) }}</b> — selisih <b>{{ (currentTargetScore - Number(ikasPrimaryTotalScore || 0)).toFixed(2) }}</b> poin.</span>
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
                    {{ ikasAnsweredQuestions }} dari {{ ikasTotalQuestions }} {{ ikasProgressUnitLabel }}
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
              <span>Data terbaru langsung tercermin di ringkasan IKAS.</span>
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
                  {{ ikasAnsweredQuestions }}/{{ ikasTotalQuestions }} terisi
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
                  <button @click="exportToPdf" class="btn-ikas-pdf" :disabled="exporting || !hasActiveIkasRecord">
                    <span v-if="exporting" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <i v-else class="ri-file-pdf-line"></i>
                    {{ exporting ? 'Mengekspor...' : 'Export PDF' }}
                  </button>
                </div>
              </div>
              <div class="ikas-action-cluster ikas-action-cluster-admin">
                <span class="ikas-action-label">Kontrol status</span>
                <div class="ikas-action-buttons">
                  <button v-if="canRequestEdit && hasActiveIkasRecord && ikasDataDynamic.is_validated" @click="requestEdit" class="btn-ikas-unlock" :disabled="isRequestingEdit">
                    <span v-if="isRequestingEdit" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <i v-else class="ri-edit-2-line"></i>
                    {{ isRequestingEdit ? 'Mengajukan...' : 'Request Edit' }}
                  </button>
                  <button v-if="hasActiveIkasRecord && !ikasDataDynamic.is_validated" @click="validateAssessment" class="btn-ikas-validate" :disabled="isValidating">
                    <span v-if="isValidating" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <i v-else class="ri-checkbox-circle-line"></i>
                    {{ isValidating ? 'Memvalidasi...' : 'Validasi Data' }}
                  </button>
                  <button v-if="hasActiveIkasRecord && ikasDataDynamic.edit_request_status === 'pending'" @click="approveEdit" class="btn-ikas-approve" :disabled="isApproving">
                    <span v-if="isApproving" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <i v-else class="ri-check-line"></i>
                    {{ isApproving ? 'Menyetujui...' : 'Request Acc' }}
                  </button>
                  <button v-if="hasActiveIkasRecord && ikasDataDynamic.edit_request_status === 'pending'" @click="rejectEdit" class="btn-ikas-reject" :disabled="isRejecting">
                    <span v-if="isRejecting" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <i v-else class="ri-close-line"></i>
                    {{ isRejecting ? 'Menolak...' : 'Tolak' }}
                  </button>
                  <button v-if="hasActiveIkasRecord" @click="deleteAssessment" class="btn-ikas-delete" :disabled="isDeleting">
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
                  <th class="center bold">{{ currentTargetScoreDisplay }}</th>
                  <th class="center bold">{{ formatValue(ikasPrimaryTotalScore) }}</th>
                </tr>
              </thead>

              <tbody>
                <!-- IDENTIFIKASI -->
                <tr>
                  <td rowspan="5" class="domain blue">IDENTIFIKASI</td>
                  <td class="item">Mengidentifikasi Peran dan tanggung jawab organisasi</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_subdomain1) }}</td>
                  <td rowspan="5" class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_identifikasi) }}</td>
                  <td rowspan="5" class="center">{{ ikasDataDynamic.identifikasi.kategori_identifikasi }}</td>
                  <td rowspan="18" class="status-big">{{ ikasDisplayTotalCategory }}</td>
                </tr>
                <tr>
                  <td class="item">Menyusun strategi, kebijakan, dan prosedur Keamanan Siber</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_subdomain2) }}</td>
                </tr>
                <tr>
                  <td class="item">Mengelola aset informasi</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_subdomain3) }}</td>
                </tr>
                <tr>
                  <td class="item">Menilai dan mengelola risiko Keamanan Siber</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_subdomain4) }}</td>
                </tr>
                <tr>
                  <td class="item">Mengelola risiko rantai pasok</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_subdomain5) }}</td>
                </tr>

                <!-- PROTEKSI -->
                <tr>
                  <td rowspan="6" class="domain purple">PROTEKSI</td>
                  <td class="item">Mengelola identitas, autentikasi, dan kendali akses</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain1) }}</td>
                  <td rowspan="6" class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_proteksi) }}</td>
                  <td rowspan="6" class="center">{{ ikasDataDynamic.proteksi.kategori_proteksi }}</td>
                </tr>
                <tr>
                  <td class="item">Melindungi aset fisik</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain2) }}</td>
                </tr>
                <tr>
                  <td class="item">Melindungi data</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain3) }}</td>
                </tr>
                <tr>
                  <td class="item">Melindungi aplikasi</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain4) }}</td>
                </tr>
                <tr>
                  <td class="item">Melindungi jaringan</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain5) }}</td>
                </tr>
                <tr>
                  <td class="item">Melindungi sumber daya manusia</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain6) }}</td>
                </tr>

                <!-- DETEKSI -->
                <tr>
                  <td rowspan="3" class="domain orange">DETEKSI</td>
                  <td class="item">Mengelola deteksi Peristiwa Siber</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.deteksi.nilai_subdomain1) }}</td>
                  <td rowspan="3" class="center">{{ formatValue(ikasDataDynamic.deteksi.nilai_deteksi) }}</td>
                  <td rowspan="3" class="center">{{ ikasDataDynamic.deteksi.kategori_deteksi }}</td>
                </tr>
                <tr>
                  <td class="item">Menganalisis anomali dan Peristiwa Siber</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.deteksi.nilai_subdomain2) }}</td>
                </tr>
                <tr>
                  <td class="item">Memantau Peristiwa Siber berkelanjutan</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.deteksi.nilai_subdomain3) }}</td>
                </tr>

                <!-- PENANGGULANGAN & PEMULIHAN -->
                <tr>
                  <td rowspan="4" class="domain green">PENANGGULANGAN &amp; PEMULIHAN</td>
                  <td class="item">Menyusun perencanaan penanggulangan dan pemulihan Insiden Siber</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.tanggulih.nilai_subdomain1) }}</td>
                  <td rowspan="4" class="center">{{ formatValue(ikasDataDynamic.tanggulih.nilai_tanggulih) }}</td>
                  <td rowspan="4" class="center">{{ ikasDataDynamic.tanggulih.kategori_tanggulih }}</td>
                </tr>
                <tr>
                  <td class="item">Menganalisis dan melaporkan Insiden Siber</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.tanggulih.nilai_subdomain2) }}</td>
                </tr>
                <tr>
                  <td class="item">Melaksanakan penanggulangan dan pemulihan Insiden Siber</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.tanggulih.nilai_subdomain3) }}</td>
                </tr>
                <tr>
                  <td class="item">Meningkatkan keamanan setelah terjadinya Insiden Siber</td>
                  <td class="center">{{ currentTargetScoreDisplay }}</td>
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

  <transition name="ikas-popup-fade">
    <div v-if="importModalState.open" class="ikas-popup-overlay">
      <div
        ref="importModalCardRef"
        class="ikas-popup-card ikas-import-modal-card"
        :class="[`is-${importModalState.stage}`, { 'is-dark': isDarkMode }]"
      >
        <div class="ikas-popup-icon ikas-import-modal-icon">
          <span
            v-if="importModalState.stage === 'uploading'"
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          ></span>
          <i v-else-if="importModalState.stage === 'ready'" class="ri-checkbox-circle-line"></i>
          <i v-else class="ri-error-warning-line"></i>
        </div>

        <div class="ikas-popup-title">{{ importModalState.title }}</div>
        <div class="ikas-popup-message">{{ importModalState.message }}</div>

        <div v-if="importModalState.fileName" class="ikas-import-file">
          <i class="ri-file-excel-2-line"></i>
          <span>{{ importModalState.fileName }}</span>
        </div>

        <div v-if="importModalState.stage === 'ready'" class="ikas-import-summary">
          <div>
            <span>Jawaban terisi</span>
            <strong>{{ ikasAnsweredQuestions }}/{{ ikasTotalQuestions }}</strong>
          </div>
          <div>
            <span>Progress</span>
            <strong>{{ ikasCompletionPercentage }}%</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{{ importIsComplete ? 'Siap selesai' : 'Draft' }}</strong>
          </div>
        </div>

        <div v-if="importModalState.stage === 'ready'" class="ikas-popup-actions ikas-import-actions">
          <button
            type="button"
            class="ikas-popup-btn is-warning"
            :disabled="importModalState.saveLoading || importModalState.finishLoading"
            @click="finalizeImportedIkas('save')"
          >
            <span
              v-if="importModalState.saveLoading"
              class="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            ></span>
            Simpan
          </button>
          <button
            type="button"
            class="ikas-popup-btn is-success"
            :disabled="importModalState.saveLoading || importModalState.finishLoading"
            :title="importIsComplete ? 'Simpan dan selesaikan import' : 'Coba baca ulang jawaban lalu selesaikan'"
            @click="finalizeImportedIkas('finish')"
          >
            <span
              v-if="importModalState.finishLoading"
              class="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            ></span>
            Selesai
          </button>
        </div>

        <div v-else-if="importModalState.stage === 'error'" class="ikas-popup-actions ikas-import-actions">
          <button type="button" class="ikas-popup-btn is-ghost" @click="closeImportModal">
            Tutup
          </button>
          <button type="button" class="ikas-popup-btn" @click="triggerFileInput">
            Upload Ulang
          </button>
        </div>
      </div>
    </div>
  </transition>

  <transition name="ikas-popup-fade">
    <div v-if="popupState.open" class="ikas-popup-overlay" @click.self="closePopup(false)">
      <div ref="popupCardRef" class="ikas-popup-card" :class="`is-${popupState.variant}`">
        <div class="ikas-popup-icon">
          <i :class="{
            'ri-delete-bin-6-line': popupState.variant === 'danger',
            'ri-checkbox-circle-line': popupState.variant === 'success',
            'ri-error-warning-line': popupState.variant === 'warning',
            'ri-shield-check-line': popupState.variant === 'primary',
            'ri-information-line': !['danger', 'success', 'warning', 'primary'].includes(popupState.variant)
          }"></i>
        </div>
        <div class="ikas-popup-title">{{ popupState.title }}</div>
        <div class="ikas-popup-message">{{ popupState.message }}</div>

        <textarea
          v-if="popupState.mode === 'prompt'"
          v-model="popupState.inputValue"
          class="ikas-popup-textarea"
          rows="4"
          :placeholder="popupState.inputPlaceholder"
        ></textarea>

        <div class="ikas-popup-actions">
          <button
            v-if="popupState.mode !== 'alert'"
            type="button"
            class="ikas-popup-btn is-ghost"
            @click="closePopup(false)"
          >
            {{ popupState.cancelText }}
          </button>
          <button
            type="button"
            class="ikas-popup-btn"
            :class="`is-${popupState.variant}`"
            @click="closePopup(true)"
          >
            {{ popupState.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </transition>

  <transition name="ikas-popup-fade">
    <div v-if="toastState.visible" class="ikas-toast-wrap">
      <div ref="popupToastRef" class="ikas-toast-card" :class="`is-${toastState.variant}`">
        <div class="ikas-toast-icon">
          <i :class="{
            'ri-checkbox-circle-line': toastState.variant === 'success',
            'ri-error-warning-line': toastState.variant === 'warning',
            'ri-close-circle-line': toastState.variant === 'danger',
            'ri-information-line': !['success', 'warning', 'danger'].includes(toastState.variant)
          }"></i>
        </div>
        <div class="ikas-toast-copy">
          <strong>{{ toastState.title }}</strong>
          <span>{{ toastState.message }}</span>
        </div>
      </div>
    </div>
  </transition>

</template>







