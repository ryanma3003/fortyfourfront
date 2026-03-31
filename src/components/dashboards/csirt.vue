<script lang="ts">
import SimpleCardComponent from "../../shared/components/@spk/simple-card.vue";
import { ref, onMounted, watch, computed } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { csirtService } from "../../services/csirt.service";
import type { SdmCsirt, SeCsirt, CsirtMember } from "../../types/csirt.types";
import { useRoute } from "vue-router";
import { useStakeholdersStore } from "../../stores/stakeholders";
import { useAuthStore } from "../../stores/auth";
import { useCsirtStore } from "../../stores/csirt";
import { useKseStore } from "../../stores/kse";
import { useRouter } from "vue-router";

export default {
    components: {
        Pageheader,
        SimpleCardComponent,
    },
    setup() {
        const stakeholdersStore = useStakeholdersStore();
        const authStore = useAuthStore();
        const csirtStore = useCsirtStore();
        const router = useRouter();
        const isAdmin = computed(() => authStore.isAdmin);

        // For user role: check if the logged-in user owns this CSIRT (same id_perusahaan)
        const isOwner = computed(() => {
            if (isAdmin.value) return false; // admin uses isAdmin flag
            if (!authStore.currentUser?.id_perusahaan) return false;
            if (!currentCsirt.value) return false;
            const csirtCompanyId = String(currentCsirt.value.id_perusahaan || (currentCsirt.value as any).perusahaan?.id || '');
            return csirtCompanyId === String(authStore.currentUser.id_perusahaan);
        });

        // Allow CRUD for admin or owner
        const canEdit = computed(() => isAdmin.value || isOwner.value);

        // For CSIRT Creation: target stakeholder
        const newStakeholderSlug = computed(() => String(route.query.stakeholder || ''));
        const newStakeholder = computed(() => {
            if (newStakeholderSlug.value) {
                return stakeholdersStore.getStakeholderBySlug(newStakeholderSlug.value);
            }
            if (!isAdmin.value && authStore.currentUser?.id_perusahaan) {
                return stakeholdersStore.getStakeholderById(String(authStore.currentUser.id_perusahaan));
            }
            return undefined;
        });

        const canCreateCsirt = computed(() => {
            if (currentCsirt.value) return false;
            return !!newStakeholder.value && (isAdmin.value || String(newStakeholder.value.id) === String(authStore.currentUser?.id_perusahaan));
        });

        const headers = [
            { text: "Nama Personel" },
            { text: "CSIRT" },
            { text: "Jabatan CSIRT" },
            { text: "Jabatan Perusahaan" },
            { text: "Keahlian" },
            { text: "Sertifikasi" },
            { text: "Aksi" },
        ];

        const seHeaders = [
            { text: "Nama SE" },
            { text: "IP SE" },
            { text: "AS Number" },
            { text: "Pengelola" },
            { text: "Fitur" },
            { text: "Kategori" },
            { text: "Aksi" },
        ];

        const route = useRoute();
        const csirtSlug = computed(() => String(route.params.id || ''));

        const currentCsirt = computed<CsirtMember | undefined>(() => {
            const slug = csirtSlug.value;

            // User role: auto-resolve CSIRT from id_perusahaan when no slug in URL
            if (!slug && !isAdmin.value && authStore.currentUser?.id_perusahaan) {
                return csirtStore.csirts.find(c =>
                    String(c.id_perusahaan) === String(authStore.currentUser!.id_perusahaan) ||
                    String((c as any).perusahaan?.id) === String(authStore.currentUser!.id_perusahaan)
                );
            }

            if (!slug) return undefined;

            const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            return csirtStore.csirts.find(c => {
                if (String(c.id) === slug) return true;
                if (c.slug === slug) return true;
                const csirtPart = c.slug || toSlug(c.nama_csirt);
                const perusahaanName = (c as any).perusahaan?.nama_perusahaan;
                const perusahaanPart = perusahaanName ? toSlug(perusahaanName) : '';
                const combined = perusahaanPart ? `${csirtPart}-${perusahaanPart}` : csirtPart;
                return combined === slug || csirtPart === slug;
            });
        });

        const csirtId = computed(() => currentCsirt.value?.id || csirtSlug.value);

        // SDM & SE Lists from Store
        const items = computed(() => {
            const id = String(csirtId.value);
            return csirtStore.sdmList.filter(item => 
                String(item.id_csirt) === id || String((item as any).csirt?.id) === id
            );
        });

        const seItems = computed(() => {
            const id = String(csirtId.value);
            return csirtStore.seList.filter(item => 
                String(item.id_csirt) === id || String((item as any).csirt?.id) === id
            );
        });

        const loading = ref(false);

        // Async data loading from API
        const loadCSIRTs = async () => {
            loading.value = true;
            try {
                // Use the store refresh to load everything including SDM/SE lists
                await csirtStore.refresh();
            } catch (err) {
                console.error('Failed to load CSIRT data:', err);
            } finally {
                loading.value = false;
            }
        };

        onMounted(async () => {
            if (!stakeholdersStore.initialized) {
                await stakeholdersStore.initialize();
            }
            if (!csirtStore.initialized) {
                await csirtStore.initialize();
            } else {
                // If already initialized, at least trigger refreshing SDM/SE lists
                await loadCSIRTs();
            }
            
            // Auto open create modal if requested from dashboard
            if (route.query.action === 'create' && canCreateCsirt.value) {
                openAddCsirtModal();
            }
        });

        watch(csirtId, () => {
            loadCSIRTs();
        });

        const dataToPass = computed(() => {
            const from = String(route.query.from || '');

            if (from === 'csirt-admin') {
                return {
                    currentpage: "CSIRT",
                    title: { label: "CSIRT Admin", path: "/csirt-admin" },
                    activepage: "CSIRT",
                };
            }

            // User role: breadcrumb back to user dashboard
            if (!isAdmin.value) {
                return {
                    currentpage: "CSIRT",
                    title: { label: "Dashboard", path: "/dashboards" },
                    activepage: "CSIRT",
                };
            }

            // Parent stakeholder: either from query.stakeholder (profile-stakeholders nav)
            // or derived from currentCsirt.id_perusahaan
            const parent = newStakeholder.value
                ?? (currentCsirt.value
                    ? stakeholdersStore.stakeholders.find(s =>
                        Number(s.id) === currentCsirt.value?.id_perusahaan ||
                        (s.id as any) === currentCsirt.value?.id_perusahaan)
                    : null);

            return {
                currentpage: "CSIRT",
                title: parent ? {
                    label: `Profile ${parent.nama_perusahaan}`,
                    path: `/stakeholders/${parent.slug}`
                } : { label: "Dashboards", path: "/dashboards" },
                activepage: "CSIRT",
            };
        });

        const getKategoriBadgeClass = (kategori: string) => {
            switch (kategori) {
                case "Strategis": return "bg-danger-transparent";
                case "Tinggi": return "bg-warning-transparent";
                case "Rendah": return "bg-success-transparent";
                default: return "bg-info-transparent";
            }
        };

        // --- TOAST ------------------------------------------------------------
        const showToast = ref(false);
        const toastMessage = ref("");
        const toastType = ref<"success" | "error">("success");

        const showNotification = (msg: string, type: "success" | "error") => {
            toastMessage.value = msg;
            toastType.value = type;
            showToast.value = true;
            setTimeout(() => { showToast.value = false; }, 3500);
        };

        // --- SDM CRUD ---------------------------------------------------------
        const showCreateSdmModal = ref(false);
        const showEditSdmModal   = ref(false);
        const showDeleteSdmModal = ref(false);
        const currentEditSdm    = ref<SdmCsirt | null>(null);
        const currentDeleteSdm  = ref<SdmCsirt | null>(null);

        const sdmFormData = ref<Partial<SdmCsirt>>({
            id_csirt: "",
            nama_personel: "",
            jabatan_csirt: "",
            jabatan_perusahaan: "",
            skill: "",
            sertifikasi: "",
        });
        const sdmFormErrors = ref<Record<string, string>>({});

        const validateSdmForm = (): boolean => {
            sdmFormErrors.value = {};
            let valid = true;
            if (!sdmFormData.value.id_csirt) {
                sdmFormErrors.value.id_csirt = "CSIRT wajib dipilih";
                valid = false;
            }
            if (!sdmFormData.value.nama_personel?.trim()) {
                sdmFormErrors.value.nama_personel = "Nama personel wajib diisi";
                valid = false;
            }
            if (!sdmFormData.value.jabatan_csirt?.trim()) {
                sdmFormErrors.value.jabatan_csirt = "Jabatan CSIRT wajib diisi";
                valid = false;
            }
            return valid;
        };

        const openCreateSdmModal = () => {
            sdmFormData.value = { id_csirt: csirtId.value || "", nama_personel: "", jabatan_csirt: "", jabatan_perusahaan: "", skill: "", sertifikasi: "" };
            sdmFormErrors.value = {};
            showCreateSdmModal.value = true;
        };

        const createSdm = async () => {
            if (!validateSdmForm()) return;
            try {
                await csirtService.createSdm({
                    id_csirt: sdmFormData.value.id_csirt!,
                    nama_personel: sdmFormData.value.nama_personel!,
                    jabatan_csirt: sdmFormData.value.jabatan_csirt!,
                    jabatan_perusahaan: sdmFormData.value.jabatan_perusahaan || "",
                    skill: sdmFormData.value.skill || "",
                    sertifikasi: sdmFormData.value.sertifikasi || "",
                });
                await loadCSIRTs();
                showCreateSdmModal.value = false;
                showNotification("SDM berhasil ditambahkan!", "success");
            } catch {
                showNotification("Gagal menambahkan SDM.", "error");
            }
        };

        const openEditSdmModal = (item: any) => {
            currentEditSdm.value = item as SdmCsirt;
            sdmFormData.value = { ...item };
            if (!sdmFormData.value.id_csirt) {
                sdmFormData.value.id_csirt = csirtId.value;
            }
            sdmFormErrors.value = {};
            showEditSdmModal.value = true;
        };

        const updateSdm = async () => {
            if (!validateSdmForm() || !currentEditSdm.value) return;
            try {
                await csirtService.updateSdm(currentEditSdm.value.id, {
                    id_csirt: sdmFormData.value.id_csirt!,
                    nama_personel: sdmFormData.value.nama_personel!,
                    jabatan_csirt: sdmFormData.value.jabatan_csirt!,
                    jabatan_perusahaan: sdmFormData.value.jabatan_perusahaan || "",
                    skill: sdmFormData.value.skill || "",
                    sertifikasi: sdmFormData.value.sertifikasi || "",
                });
                await loadCSIRTs();
                showEditSdmModal.value = false;
                showNotification("SDM berhasil diperbarui!", "success");
            } catch {
                showNotification("Gagal memperbarui SDM.", "error");
            }
        };

        const openDeleteSdmModal = (item: any) => {
            currentDeleteSdm.value = item as SdmCsirt;
            showDeleteSdmModal.value = true;
        };

        const deleteSdm = async () => {
            if (!currentDeleteSdm.value) return;
            try {
                await csirtService.deleteSdm(currentDeleteSdm.value.id);
                await loadCSIRTs();
                showDeleteSdmModal.value = false;
                showNotification("SDM berhasil dihapus!", "success");
            } catch {
                showNotification("Gagal menghapus SDM.", "error");
            }
        };

        // --- SE CRUD ----------------------------------------------------------
        const showEditSeModal   = ref(false);
        const showDeleteSeModal = ref(false);
        const currentEditSe    = ref<SeCsirt | null>(null);
        const currentDeleteSe  = ref<SeCsirt | null>(null);

        const seFormData = ref<Partial<SeCsirt>>({
            nama_se: "",
            ip_se: "",
            as_number_se: "",
            pengelola_se: "",
            fitur_se: "",
            kategori_se: "Tinggi",
        });
        const seFormErrors = ref<Record<string, string>>({});

        const validateSeForm = (): boolean => {
            seFormErrors.value = {};
            let valid = true;
            if (!seFormData.value.nama_se?.trim()) {
                seFormErrors.value.nama_se = "Nama SE wajib diisi";
                valid = false;
            }
            if (!seFormData.value.ip_se?.trim()) {
                seFormErrors.value.ip_se = "IP SE wajib diisi";
                valid = false;
            }
            return valid;
        };

        // Langsung ke KSE respondent form tanpa modal
        const goToAddSe = () => {
            if (!csirtId.value) return;
            const p = currentCsirt.value?.perusahaan;
            const companySlug = String(
                stakeholdersStore.stakeholders.find(
                    s => Number(s.id) === Number(currentCsirt.value?.id_perusahaan || p?.id)
                )?.slug || ''
            );
            const kseId = `${companySlug}_kse_${Date.now()}`;

            // KSE list placeholder (namaSistem will be filled on respondent form)
            const kseListKey = `kse_list_${companySlug}`;
            const existingList = (() => { try { return JSON.parse(localStorage.getItem(kseListKey) || '[]'); } catch { return []; } })();
            existingList.unshift({ id: kseId, namaSistem: '', createdAt: new Date().toISOString() });
            localStorage.setItem(kseListKey, JSON.stringify(existingList));

            // Pre-fill CSIRT company data; SE fields left blank for user to fill on respondent form
            localStorage.setItem(`kse_respondent_${kseId}`, JSON.stringify({
                namaPerusahaan  : p?.nama_perusahaan || '',
                jenisUsaha      : p?.sub_sektor?.nama_sub_sektor || '',
                namaSistem      : '',
                alamat          : p?.alamat  || '',
                email           : p?.email   || '',
                nomorTelepon    : p?.telepon || '',
                tanggalPengisian: new Date().toISOString().split('T')[0],
                ip_se           : '',
                as_number_se    : '',
                pengelola_se    : '',
                fitur_se        : '',
                fromCsirt       : true,
                id_csirt        : csirtId.value,
                id_perusahaan   : String(currentCsirt.value?.id_perusahaan || p?.id || ''),
                id_sub_sektor   : String(p?.sub_sektor?.id || ''),
            }));

            const kseStore = useKseStore();
            kseStore.initialize();
            kseStore.updateStakeholderInfo(kseId, '', p?.sub_sektor?.nama_sub_sektor || '');

            router.push({ path: '/kse-crud', query: { slug: kseId, source: 'csirt', stakeholder: companySlug } });
        };

        // Navigate to KSE page in view-only mode (Lihat Detail)
        const viewSeDetail = (se: SeCsirt) => {
            const p = currentCsirt.value?.perusahaan;
            const companySlug = String(
                stakeholdersStore.stakeholders.find(
                    s => String(s.id) === String(currentCsirt.value?.id_perusahaan || p?.id)
                )?.slug || sessionStorage.getItem('currentStakeholder') || ''
            );
            router.push({ path: '/kse-crud', query: { seId: String(se.id), stakeholder: companySlug, mode: 'view' } });
        };

        // Navigate to KSE page in edit mode (Edit SE � data responden + penilaian)
        const editSePenilaian = (se: SeCsirt) => {
            const p = currentCsirt.value?.perusahaan;
            const companySlug = String(
                stakeholdersStore.stakeholders.find(
                    s => String(s.id) === String(currentCsirt.value?.id_perusahaan || p?.id)
                )?.slug || sessionStorage.getItem('currentStakeholder') || ''
            );
            router.push({ path: '/kse-crud', query: { seId: String(se.id), source: 'csirt', stakeholder: companySlug } });
        };

        const openEditSeModal = (item: any) => {
            currentEditSe.value = item as SeCsirt;
            seFormData.value = { ...item };
            if (!seFormData.value.id_csirt) {
                seFormData.value.id_csirt = csirtId.value;
            }
            seFormErrors.value = {};
            showEditSeModal.value = true;
        };

        const updateSe = async () => {
            if (!validateSeForm() || !currentEditSe.value) return;
            try {
                await csirtService.updateSe(currentEditSe.value.id, {
                    id_csirt: seFormData.value.id_csirt!,
                    nama_se: seFormData.value.nama_se!,
                    ip_se: seFormData.value.ip_se!,
                    as_number_se: seFormData.value.as_number_se || "",
                    pengelola_se: seFormData.value.pengelola_se || "",
                    fitur_se: seFormData.value.fitur_se || "",
                    kategori_se: seFormData.value.kategori_se || "Tinggi",
                });
                await loadCSIRTs();
                showEditSeModal.value = false;
                showNotification("SE berhasil diperbarui!", "success");
            } catch {
                showNotification("Gagal memperbarui SE.", "error");
            }
        };

        const openDeleteSeModal = (item: any) => {
            currentDeleteSe.value = item as SeCsirt;
            showDeleteSeModal.value = true;
        };

        const deleteSe = async () => {
            if (!currentDeleteSe.value) return;
            try {
                await csirtService.deleteSe(currentDeleteSe.value.id);
                await loadCSIRTs();
                showDeleteSeModal.value = false;
                showNotification("SE berhasil dihapus!", "success");
            } catch {
                showNotification("Gagal menghapus SE.", "error");
            }
        };

        // --- TAMBAH CSIRT ------------------------------------------------------
        const showAddCsirtModal    = ref(false);
        const csirtFormLoading     = ref(false);
        const csirtFormError       = ref('');
        const csirtFormSuccess     = ref(false);

        const csirtFormData = ref({
            nama_csirt          : '',
            web_csirt           : '',
            telepon_csirt       : '',
            photo_csirt         : null as File | null,
            photo_csirt_preview : '',
            file_rfc2350        : null as File | null,
            file_public_key_pgp : null as File | null,
        });
        const csirtFormErrors = ref<Record<string, string>>({});

        const openAddCsirtModal = () => {
            csirtFormData.value = { nama_csirt: '', web_csirt: '', telepon_csirt: '', photo_csirt: null, photo_csirt_preview: '', file_rfc2350: null, file_public_key_pgp: null };
            csirtFormErrors.value = {};
            csirtFormError.value = '';
            csirtFormSuccess.value = false;
            showAddCsirtModal.value = true;
        };

        const onCsirtFileChange = (event: Event, field: 'photo_csirt' | 'file_rfc2350' | 'file_public_key_pgp') => {
            const input = event.target as HTMLInputElement;
            if (input.files && input.files[0]) {
                const file = input.files[0];
                csirtFormData.value[field] = file;
                if (field === 'photo_csirt') {
                    const reader = new FileReader();
                    reader.onload = e => {
                        csirtFormData.value.photo_csirt_preview = e.target?.result as string;
                    };
                    reader.readAsDataURL(file);
                }
            }
        };

        const onAddCsirtPhotoChange = (event: Event) => onCsirtFileChange(event, 'photo_csirt');

        const removeAddCsirtPhoto = () => {
            csirtFormData.value.photo_csirt = null;
            csirtFormData.value.photo_csirt_preview = "";
        };

        const validateCsirtForm = (): boolean => {
            csirtFormErrors.value = {};
            if (!csirtFormData.value.nama_csirt.trim())
                csirtFormErrors.value.nama_csirt = 'Nama CSIRT wajib diisi';
            return Object.keys(csirtFormErrors.value).length === 0;
        };

        const submitAddCsirt = async () => {
            if (!validateCsirtForm() || !newStakeholder.value) return;
            csirtFormLoading.value = true;
            csirtFormError.value = '';
            const result = await csirtStore.createCsirt({
                id_perusahaan       : newStakeholder.value.id,
                // Do NOT pass the company slug/UUID as the CSIRT slug.
                // The backend will auto-generate the CSIRT slug from nama_csirt.
                nama_csirt          : csirtFormData.value.nama_csirt,
                web_csirt           : csirtFormData.value.web_csirt,
                telepon_csirt       : csirtFormData.value.telepon_csirt,
                photo_csirt         : csirtFormData.value.photo_csirt,
                file_rfc2350        : csirtFormData.value.file_rfc2350,
                file_public_key_pgp : csirtFormData.value.file_public_key_pgp,
            });
            csirtFormLoading.value = false;
            if (result.success) {
                csirtFormSuccess.value = true;
                // Refresh store to include the new CSIRT
                await csirtStore.refresh();
                setTimeout(() => {
                    showAddCsirtModal.value = false;
                    // Navigate to the newly created CSIRT
                    const created = result.data as any;
                    if (created?.id) router.replace(`/csirt/${created.id}`);
                    else if (newStakeholder.value) router.replace(`/stakeholders/${newStakeholder.value.slug}`);
                }, 1500);
            } else {
                csirtFormError.value = result.error || 'Gagal mendaftarkan CSIRT.';
            }
        };

        // --- PROFILE CRUD ------------------------------------------------------
        const showEditProfileModal = ref(false);
        const profileFormData = ref<Partial<CsirtMember> & { photo_csirt_file?: File | null; file_rfc2350_file?: File | null; file_public_key_pgp_file?: File | null }>({
            nama_csirt: "",
            telepon_csirt: "",
            web_csirt: "",
            file_rfc2350: "",
            file_public_key_pgp: "",
            photo_csirt_file: null,
            file_rfc2350_file: null,
            file_public_key_pgp_file: null,
        });
        const profileFormErrors = ref<Record<string, string>>({});

        const validateProfileForm = (): boolean => {
            profileFormErrors.value = {};
            let valid = true;
            if (!profileFormData.value.nama_csirt?.trim()) {
                profileFormErrors.value.nama_csirt = "Nama CSIRT wajib diisi";
                valid = false;
            }
            return valid;
        };

        const openEditProfileModal = () => {
            if (currentCsirt.value) {
                profileFormData.value = { ...currentCsirt.value, photo_csirt_file: null, file_rfc2350_file: null, file_public_key_pgp_file: null };
                profileFormErrors.value = {};
                showEditProfileModal.value = true;
            }
        };

        const onProfilePhotoChange = (event: Event) => {
            const input = event.target as HTMLInputElement;
            if (input.files && input.files[0]) {
                const file = input.files[0];
                profileFormData.value.photo_csirt_file = file;
                const reader = new FileReader();
                reader.onload = e => {
                    profileFormData.value.photo_csirt = e.target?.result as string;
                };
                reader.readAsDataURL(file);
            }
        };

        const removeProfilePhoto = () => {
            profileFormData.value.photo_csirt = "";
            profileFormData.value.photo_csirt_file = null;
        };

        const updateProfile = async () => {
            if (!validateProfileForm() || !currentCsirt.value) return;
            const oldId = currentCsirt.value.id;
            try {
                await csirtService.update(currentCsirt.value.id, {
                    id_perusahaan       : currentCsirt.value.id_perusahaan ?? currentCsirt.value.perusahaan?.id,
                    nama_csirt          : profileFormData.value.nama_csirt!,
                    telepon_csirt       : profileFormData.value.telepon_csirt || "",
                    web_csirt           : profileFormData.value.web_csirt || "",
                    photo_csirt         : profileFormData.value.photo_csirt_file ?? undefined,
                    file_rfc2350        : profileFormData.value.file_rfc2350_file ?? undefined,
                    file_public_key_pgp : profileFormData.value.file_public_key_pgp_file ?? undefined,
                });
                await csirtStore.refresh();
                showEditProfileModal.value = false;
                showNotification("Profil CSIRT berhasil diperbarui!", "success");

                // Redirect if name/slug changed
                const updated = csirtStore.csirts.find(c => String(c.id) === String(oldId));
                if (updated) {
                    const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-$|\s+/g, '');
                    const newSlug = updated.slug || toSlug(updated.nama_csirt);
                    if (csirtSlug.value !== String(oldId) && csirtSlug.value !== newSlug) {
                        router.replace(`/csirt/${newSlug}`);
                    }
                }
            } catch {
                showNotification("Gagal memperbarui profil CSIRT.", "error");
            }
        };

        const handleFileUpload = (event: Event, type: 'rfc' | 'pgp') => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                const file = target.files[0];
                if (type === 'rfc') {
                    profileFormData.value.file_rfc2350_file = file;
                } else if (type === 'pgp') {
                    profileFormData.value.file_public_key_pgp_file = file;
                }
                showNotification(`${file.name} berhasil dipilih`, "success");
            }
        };

        return {

            isAdmin,
            isOwner,
            canEdit,
            canCreateCsirt,
            csirtStore,
            newStakeholder,
            // Tambah CSIRT
            showAddCsirtModal,
            csirtFormLoading,
            csirtFormError,
            csirtFormSuccess,
            csirtFormData,
            csirtFormErrors,
            openAddCsirtModal,
            onCsirtFileChange,
            validateCsirtForm,
            submitAddCsirt,
            headers,
            items,
            loading,
            loadCSIRTs,
            currentCsirt,
            dataToPass,
            seHeaders,
            seItems,
            getKategoriBadgeClass,
            // Toast
            showToast,
            toastMessage,
            toastType,
            // SDM CRUD
            showCreateSdmModal,
            showEditSdmModal,
            showDeleteSdmModal,
            currentEditSdm,
            currentDeleteSdm,
            sdmFormData,
            sdmFormErrors,
            openCreateSdmModal,
            createSdm,
            openEditSdmModal,
            updateSdm,
            openDeleteSdmModal,
            deleteSdm,
            // SE CRUD
            goToAddSe,
            viewSeDetail,
            editSePenilaian,
            showDeleteSeModal,
            currentEditSe,
            currentDeleteSe,
            seFormData,
            seFormErrors,
            openEditSeModal,
            updateSe,
            openDeleteSeModal,
            deleteSe,
            // PROFILE CRUD
            showEditProfileModal,
            profileFormData,
            profileFormErrors,
            openEditProfileModal,
            updateProfile,
            handleFileUpload,
            onProfilePhotoChange,
            removeProfilePhoto,
            onAddCsirtPhotoChange,
            removeAddCsirtPhoto,
        };

    },
};
</script>
<style scoped>
.profile-photo-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  max-width: 220px;
  margin: 0 auto 16px;
  background: linear-gradient(135deg, #ffffff 0%, #f9f9f9 100%);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.06);
  border: 1px solid #efefef;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.profile-photo-wrapper:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16), 0 4px 8px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.profile-csirt-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 12px;
  display: block;
  border-radius: 12px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .profile-photo-wrapper {
    max-width: 180px;
    margin: 0 auto 12px;
  }
}

@media (max-width: 480px) {
  .profile-photo-wrapper {
    max-width: 150px;
  }
}
</style>

<template>
<Pageheader :propData="dataToPass" />

<!-- Toast Notification -->
<transition name="toast-slide">
  <div v-if="showToast" class="toast-wrapper position-fixed">
    <div class="toast-modern" :class="toastType === 'success' ? 'toast-success' : 'toast-error'" role="alert">
      <div class="toast-icon-wrap">
        <i :class="toastType === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'"></i>
      </div>
      <div class="toast-content">
        <span class="toast-title">{{ toastType === 'success' ? 'Berhasil' : 'Gagal' }}</span>
        <span class="toast-msg">{{ toastMessage }}</span>
      </div>
    </div>
  </div>
</transition>

<div class="row">
    <div class="col-xl-12">
        <div class="card custom-card gradient-header-card">
            <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3 stakeholder-header">
                <div class="d-flex align-items-center gap-3 header-inner">
                    <div class="header-icon-box">
                        <i class="ri-building-2-line"></i>
                    </div>
                    <div>
                        <div class="card-title mb-0 text-white fw-bold header-card-title">{{ currentCsirt?.nama_csirt || 'Profil CSIRT' }}</div>
                        <div class="header-subtitle mt-1">Detail informasi dan manajemen CSIRT</div>
                    </div>
                </div>
                <div class="header-actions d-flex gap-2">
                    <button v-if="canCreateCsirt" @click="openAddCsirtModal" class="btn btn-primary btn-sm d-flex align-items-center gap-2">
                        <i class="ri-add-circle-line fs-14"></i>
                        <span>Tambah CSIRT</span>
                    </button>
                    <button v-if="canEdit && currentCsirt" @click="openEditProfileModal" class="btn btn-warning btn-sm d-flex align-items-center gap-2">
                        <i class="ri-edit-2-line fs-14"></i>
                        <span>Edit CSIRT</span>
                    </button>
                </div>
            </div>

            <div class="card-body">
                <div v-if="!currentCsirt" class="text-center py-5">
                    <div class="empty-state">
                        <div class="avatar avatar-xxl bg-primary-transparent rounded-circle mb-3">
                            <i class="ri-shield-line fs-32 text-primary"></i>
                        </div>
                        <h5 class="fw-bold mb-2">CSIRT Belum Terdaftar</h5>
                        <p class="text-muted mb-4">Perusahaan / instansi ini belum memiliki profil CSIRT.</p>
                        <button v-if="canCreateCsirt" @click="openAddCsirtModal" class="btn btn-primary d-inline-flex align-items-center gap-2">
                            <i class="ri-add-circle-line"></i> Daftarkan CSIRT
                        </button>
                    </div>
                </div>
                <div v-else class="row align-items-center">
                    <div class="col-12 col-md-2 text-center">
                        <div class="profile-photo-wrapper" style="width: 140px; height: 140px; margin: 0 auto 12px;">
                            <img :src="currentCsirt.photo_csirt" class="img-fluid profile-csirt-img" alt="Logo CSIRT"/>
                        </div>
                    </div>
                    <div class="col-12 col-md-5">
                        <h3 class="fw-bold mb-3 text-primary">{{ currentCsirt.nama_csirt }}</h3>
                        <div class="d-flex flex-column gap-2 mt-4">
                            <div class="d-flex align-items-center gap-3">
                                <div class="avatar avatar-sm avatar-rounded bg-primary-transparent">
                                    <i class="ri-phone-line fs-16"></i>
                                </div>
                                <div>
                                    <div class="text-muted fs-11">Telepon</div>
                                    <div class="fw-semibold">{{ currentCsirt.telepon_csirt }}</div>
                                </div>
                            </div>
                            <div class="d-flex align-items-center gap-3 mt-1">
                                <div class="avatar avatar-sm avatar-rounded bg-secondary-transparent">
                                    <i class="ri-global-line fs-16"></i>
                                </div>
                                <div>
                                    <div class="text-muted fs-11">Website</div>
                                    <div class="fw-semibold">
                                        <a :href="currentCsirt.web_csirt" target="_blank">{{ currentCsirt.web_csirt }}</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-md-5 col-sm-12 mt-4 mt-md-0">
                        <!-- Stats strip: SDM & SE counts -->
                        <div class="d-flex gap-3 mb-3">
                            <div class="d-flex align-items-center gap-2 px-3 py-2 rounded-3 bg-primary-transparent flex-fill">
                                <i class="ri-group-line fs-20 text-primary"></i>
                                <div>
                                    <div class="fw-bold fs-18 text-primary">{{ items.length }}</div>
                                    <div class="text-muted fs-11">SDM Terdaftar</div>
                                </div>
                            </div>
                            <div class="d-flex align-items-center gap-2 px-3 py-2 rounded-3 bg-success-transparent flex-fill">
                                <i class="ri-server-line fs-20 text-success"></i>
                                <div>
                                    <div class="fw-bold fs-18 text-success">{{ seItems.length }}</div>
                                    <div class="text-muted fs-11">SE Terdaftar</div>
                                </div>
                            </div>
                        </div>
                        <div class="card bg-light border-0 shadow-none mb-0">
                            <div class="card-body">
                                <h6 class="fw-bold mb-3 fs-13 d-flex align-items-center gap-2">
                                    <i class="ri-links-line text-primary"></i> Dokumen Pendukung
                                </h6>
                                <div class="d-flex flex-column gap-2">
                                    <a v-if="currentCsirt.file_rfc2350" :href="currentCsirt.file_rfc2350" target="_blank" class="btn btn-primary btn-sm btn-wave d-flex align-items-center justify-content-between">
                                        <span><i class="ri-file-pdf-line me-2"></i> RFC 2350</span>
                                        <i class="ri-external-link-line opacity-50"></i>
                                    </a>
                                    <a v-if="currentCsirt.file_public_key_pgp" :href="currentCsirt.file_public_key_pgp" target="_blank" class="btn btn-secondary btn-sm btn-wave d-flex align-items-center justify-content-between">
                                        <span><i class="ri-key-2-line me-2"></i> Public Key PGP</span>
                                        <i class="ri-external-link-line opacity-50"></i>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- ------- Tabel SDM ------- -->
<div class="row" v-if="currentCsirt">
    <div class="col-xl-12">
        <SimpleCardComponent title="Tabel Daftar SDM CSIRT" cardHeaderClass="d-flex justify-content-between align-items-center">
            <!-- Toolbar -->
            <template #showheader>
                <button v-if="canEdit" @click="openCreateSdmModal" class="btn btn-warning btn-sm d-flex align-items-center gap-2 btn-wave">
                    <i class="ri-add-circle-line fs-15"></i>
                    <span>Tambah SDM</span>
                </button>
            </template>

            <!-- Loading state -->
            <div v-if="loading" class="skeleton-loading p-4">
                <div class="skeleton-row" v-for="n in 3" :key="n">
                    <div class="skel skel-no"></div>
                    <div class="skel skel-avatar"></div>
                    <div class="skel skel-name"></div>
                    <div class="skel skel-badge"></div>
                    <div class="skel skel-actions"></div>
                </div>
            </div>

            <!-- Table -->
            <template v-else>
                <div class="table-responsive stakeholder-table-wrap">
                    <table class="table stakeholder-table text-nowrap mb-0" style="table-layout:fixed;width:100%">
                        <colgroup>
                            <col style="width:50px">
                            <col style="width:160px">
                            <col style="width:130px">
                            <col style="width:140px">
                            <col style="width:145px">
                            <col style="width:130px">
                            <col style="width:130px">
                            <col style="width:120px">
                        </colgroup>
                        <thead class="stakeholder-thead">
                            <tr>
                                <th class="th-no">No</th>
                                <th>
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="ri-user-line text-primary"></i>
                                        <span>Nama Personel</span>
                                    </div>
                                </th>
                                <th>
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="ri-shield-line text-primary"></i>
                                        <span>CSIRT</span>
                                    </div>
                                </th>
                                <th>
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="ri-briefcase-line text-primary"></i>
                                        <span>Jabatan CSIRT</span>
                                    </div>
                                </th>
                                <th>
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="ri-building-line text-primary"></i>
                                        <span>Jabatan Perusahaan</span>
                                    </div>
                                </th>
                                <th>
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="ri-tools-line text-primary"></i>
                                        <span>Keahlian</span>
                                    </div>
                                </th>
                                <th>
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="ri-award-line text-primary"></i>
                                        <span>Sertifikasi</span>
                                    </div>
                                </th>
                                <th class="text-center th-actions-sm">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="!items.length">
                                <td colspan="8" class="text-center py-5">
                                    <div class="empty-state">
                                        <div class="empty-icon-ring mb-3">
                                            <div class="empty-icon-inner">
                                                <i class="ri-group-line"></i>
                                            </div>
                                        </div>
                                        <h6 class="fw-semibold mb-1 empty-state-title">Belum Ada SDM</h6>
                                        <p class="text-muted fs-13 mb-0">Tambahkan data SDM CSIRT terlebih dahulu</p>
                                    </div>
                                </td>
                            </tr>
                            <tr v-for="(row, i) in items" :key="row.id" class="stakeholder-row">
                                <td class="align-middle text-center">
                                    <span class="row-number">{{ i + 1 }}</span>
                                </td>
                                <td class="align-middle fw-semibold">{{ row.nama_personel }}</td>
                                <td class="align-middle"><span class="badge bg-info-transparent rounded-pill px-2">{{ row.csirt?.nama_csirt || '-' }}</span></td>
                                <td class="align-middle">{{ row.jabatan_csirt }}</td>
                                <td class="align-middle small text-muted">{{ row.jabatan_perusahaan }}</td>
                                <td class="align-middle small text-muted">{{ row.skill }}</td>
                                <td class="align-middle"><span class="badge bg-primary-transparent rounded-pill px-3">{{ row.sertifikasi }}</span></td>
                                <td class="text-center align-middle">
                                    <div v-if="canEdit" class="d-flex gap-1 justify-content-center">
                                        <button @click="openEditSdmModal(row)" class="btn btn-sm btn-icon btn-wave btn-success-light" title="Edit">
                                            <i class="ri-edit-2-line"></i>
                                        </button>
                                        <button @click="openDeleteSdmModal(row)" class="btn btn-sm btn-icon btn-wave btn-danger-light" title="Hapus">
                                            <i class="ri-delete-bin-3-line"></i>
                                        </button>
                                    </div>
                                    <span v-else class="text-muted small">&#x2212;</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </template>
        </SimpleCardComponent>
    </div>
</div>

<!-- ------- Tabel SE ------- -->
<div class="row" v-if="currentCsirt">
    <div class="col-xl-12">
        <SimpleCardComponent title="Tabel Daftar SE-CSIRT" cardHeaderClass="d-flex justify-content-between align-items-center">
            <!-- Toolbar -->
            <template #showheader>
                <button v-if="canEdit" @click="goToAddSe" class="btn btn-warning btn-sm d-flex align-items-center gap-2 btn-wave">
                    <i class="ri-add-circle-line fs-15"></i>
                    <span>Tambah SE</span>
                </button>
            </template>

            <!-- Loading state -->
            <div v-if="loading" class="skeleton-loading p-4">
                <div class="skeleton-row" v-for="n in 3" :key="n">
                    <div class="skel skel-no"></div>
                    <div class="skel skel-avatar"></div>
                    <div class="skel skel-name"></div>
                    <div class="skel skel-badge"></div>
                    <div class="skel skel-actions"></div>
                </div>
            </div>

            <!-- Table -->
            <template v-else>
                <div class="table-responsive stakeholder-table-wrap">
                    <table class="table stakeholder-table text-nowrap mb-0" style="table-layout:fixed;width:100%">
                        <colgroup>
                            <col style="width:50px">
                            <col style="width:160px">
                            <col style="width:130px">
                            <col style="width:140px">
                            <col style="width:145px">
                            <col style="width:130px">
                            <col style="width:130px">
                            <col style="width:120px">
                        </colgroup>
                        <thead class="stakeholder-thead">
                            <tr>
                                <th class="th-no">No</th>
                                <th>
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="ri-server-line text-primary"></i>
                                        <span>Nama SE</span>
                                    </div>
                                </th>
                                <th>
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="ri-router-line text-primary"></i>
                                        <span>IP SE</span>
                                    </div>
                                </th>
                                <th>
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="ri-global-line text-primary"></i>
                                        <span>AS Number</span>
                                    </div>
                                </th>
                                <th>
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="ri-user-line text-primary"></i>
                                        <span>Pengelola</span>
                                    </div>
                                </th>
                                <th>
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="ri-settings-line text-primary"></i>
                                        <span>Fitur</span>
                                    </div>
                                </th>
                                <th>
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="ri-price-tag-3-line text-primary"></i>
                                        <span>Kategori</span>
                                    </div>
                                </th>
                                <th class="text-center th-actions-sm">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="!seItems.length">
                                <td colspan="8" class="text-center py-5">
                                    <div class="empty-state">
                                        <div class="empty-icon-ring mb-3">
                                            <div class="empty-icon-inner">
                                                <i class="ri-server-line"></i>
                                            </div>
                                        </div>
                                        <h6 class="fw-semibold mb-1 empty-state-title">Belum Ada SE</h6>
                                        <p class="text-muted fs-13 mb-0">Tambahkan data Sistem Elektronik terlebih dahulu</p>
                                    </div>
                                </td>
                            </tr>
                            <tr v-for="(row, i) in seItems" :key="row.id" class="stakeholder-row">
                                <td class="align-middle text-center">
                                    <span class="row-number">{{ i + 1 }}</span>
                                </td>
                                <td class="align-middle fw-semibold">{{ row.nama_se }}</td>
                                <td class="align-middle"><code class="text-primary">{{ row.ip_se }}</code></td>
                                <td class="align-middle"><span class="badge bg-light text-muted">{{ row.as_number_se }}</span></td>
                                <td class="align-middle">{{ row.pengelola_se }}</td>
                                <td class="align-middle small text-muted">{{ row.fitur_se }}</td>
                                <td class="align-middle">
                                    <span v-if="row.kategori_se" :class="['badge rounded-pill px-3', getKategoriBadgeClass(row.kategori_se)]">
                                        {{ row.kategori_se }}
                                    </span>
                                    <span v-else class="badge bg-secondary-transparent rounded-pill px-3 text-muted">
                                        Belum Diisi
                                    </span>
                                </td>
                                <td class="text-center align-middle">
                                    <div class="d-flex gap-1 justify-content-center">
                                        <button @click="viewSeDetail(row)" class="btn btn-sm btn-icon btn-wave btn-info-light" title="Lihat Detail Penilaian">
                                            <i class="ri-eye-line"></i>
                                        </button>
                                        <button v-if="canEdit" @click="editSePenilaian(row)" class="btn btn-sm btn-icon btn-wave btn-success-light" title="Edit SE">
                                            <i class="ri-edit-2-line"></i>
                                        </button>
                                        <button v-if="canEdit" @click="openDeleteSeModal(row)" class="btn btn-sm btn-icon btn-wave btn-danger-light" title="Hapus">
                                            <i class="ri-delete-bin-3-line"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </template>
        </SimpleCardComponent>
    </div>
</div>

<!-- ------------------------------------------------------------------ -->
<!-- MODAL: Tambah SDM -->
<!-- ------------------------------------------------------------------ -->
<div v-if="showCreateSdmModal" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="showCreateSdmModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal">
        <div class="modal-content border-0 bg-transparent">
            <div class="card custom-card gradient-header-card w-100 mb-0">
                <div class="card-header d-flex justify-content-between align-items-center gradient-header-blue">
                    <div class="d-flex align-items-center">
                        <i class="ri-user-add-line text-white me-2 fs-18"></i>
                        <div class="card-title text-white mb-0">Tambah SDM CSIRT</div>
                    </div>
                    <button type="button" class="btn-close btn-close-white" @click="showCreateSdmModal = false"></button>
                </div>
                <div class="card-body p-4 bg-white">
                    <form @submit.prevent="createSdm">
                        <div class="row gy-3">
                            <!-- CSIRT -->
                            <div class="col-xl-12">
                                <label class="form-label fw-medium d-flex align-items-center mb-1">
                                    <span class="text-dark">CSIRT</span> <span class="text-danger ms-1">*</span>
                                </label>
                                <div class="form-group-split-input-card d-flex align-items-center gap-2 p-2 border rounded-3 bg-light" style="cursor: pointer;">
                                    <div class="form-item-icon stat-icon-blue d-flex align-items-center justify-content-center p-2 rounded-2">
                                        <i class="ri-building-2-line fs-5"></i>
                                    </div>
                                    <div class="flex-grow-1">
                                        <select class="form-item-input bg-transparent border-0 w-100 p-0 fs-14" v-model="sdmFormData.id_csirt"
                                            :class="{ 'is-invalid': sdmFormErrors.id_csirt }"
                                            style="outline: none; box-shadow: none;">
                                            <option value="">-- Pilih CSIRT --</option>
                                            <option v-for="c in csirtStore.csirts" :key="c.id" :value="c.id">{{ c.nama_csirt }}</option>
                                        </select>
                                    </div>
                                </div>
                                <div v-if="sdmFormErrors.id_csirt" class="text-danger mt-1 fs-12">{{ sdmFormErrors.id_csirt }}</div>
                            </div>
                            <!-- Nama Personel -->
                            <div class="col-xl-12">
                                <label class="form-label fw-medium d-flex align-items-center mb-1">
                                    <span class="text-dark">Nama Personel</span> <span class="text-danger ms-1">*</span>
                                </label>
                                <div class="form-group-split-input-card d-flex align-items-center gap-2 p-2 border rounded-3 bg-light" @click="$refs.createNamaSdm.focus()" style="cursor: text;">
                                    <div class="form-item-icon stat-icon-blue d-flex align-items-center justify-content-center p-2 rounded-2">
                                        <i class="ri-user-line fs-5"></i>
                                    </div>
                                    <div class="flex-grow-1">
                                        <input ref="createNamaSdm" type="text" class="form-item-input bg-transparent border-0 w-100 p-0 fs-14" v-model="sdmFormData.nama_personel"
                                            :class="{ 'is-invalid': sdmFormErrors.nama_personel }"
                                            placeholder="Masukkan nama personel" style="outline: none; box-shadow: none;" />
                                    </div>
                                </div>
                                <div v-if="sdmFormErrors.nama_personel" class="text-danger mt-1 fs-12">{{ sdmFormErrors.nama_personel }}</div>
                            </div>
                            <!-- Jabatan CSIRT -->
                            <div class="col-xl-6">
                                <label class="form-label fw-medium d-flex align-items-center mb-1">
                                    <span class="text-dark">Jabatan CSIRT</span> <span class="text-danger ms-1">*</span>
                                </label>
                                <div class="form-group-split-input-card d-flex align-items-center gap-2 p-2 border rounded-3 bg-light" @click="$refs.createJabatanCsirt.focus()" style="cursor: text;">
                                    <div class="form-item-icon stat-icon-purple d-flex align-items-center justify-content-center p-2 rounded-2">
                                        <i class="ri-shield-user-line fs-5"></i>
                                    </div>
                                    <div class="flex-grow-1">
                                        <input ref="createJabatanCsirt" type="text" class="form-item-input bg-transparent border-0 w-100 p-0 fs-14" v-model="sdmFormData.jabatan_csirt"
                                            :class="{ 'is-invalid': sdmFormErrors.jabatan_csirt }"
                                            placeholder="Contoh: Incident Handler" style="outline: none; box-shadow: none;" />
                                    </div>
                                </div>
                                <div v-if="sdmFormErrors.jabatan_csirt" class="text-danger mt-1 fs-12">{{ sdmFormErrors.jabatan_csirt }}</div>
                            </div>
                            <!-- Jabatan Perusahaan -->
                            <div class="col-xl-6">
                                <label class="form-label fw-medium d-flex align-items-center mb-1">
                                    <span class="text-dark">Jabatan Perusahaan</span>
                                </label>
                                <div class="form-group-split-input-card d-flex align-items-center gap-2 p-2 border rounded-3 bg-light" @click="$refs.createJabatanPrshn.focus()" style="cursor: text;">
                                    <div class="form-item-icon stat-icon-teal d-flex align-items-center justify-content-center p-2 rounded-2">
                                        <i class="ri-building-line fs-5"></i>
                                    </div>
                                    <div class="flex-grow-1">
                                        <input ref="createJabatanPrshn" type="text" class="form-item-input bg-transparent border-0 w-100 p-0 fs-14" v-model="sdmFormData.jabatan_perusahaan"
                                            placeholder="Contoh: IT Security Specialist" style="outline: none; box-shadow: none;" />
                                    </div>
                                </div>
                            </div>
                            <!-- Keahlian -->
                            <div class="col-xl-12">
                                <label class="form-label fw-medium d-flex align-items-center mb-1">
                                    <span class="text-dark">Keahlian / Skill</span>
                                </label>
                                <div class="form-group-split-input-card d-flex align-items-center gap-2 p-2 border rounded-3 bg-light" @click="$refs.createSkill.focus()" style="cursor: text;">
                                    <div class="form-item-icon stat-icon-orange d-flex align-items-center justify-content-center p-2 rounded-2">
                                        <i class="ri-tools-line fs-5"></i>
                                    </div>
                                    <div class="flex-grow-1">
                                        <input ref="createSkill" type="text" class="form-item-input bg-transparent border-0 w-100 p-0 fs-14" v-model="sdmFormData.skill"
                                            placeholder="Contoh: Malware Analysis, Network Security" style="outline: none; box-shadow: none;" />
                                    </div>
                                </div>
                            </div>
                            <!-- Sertifikasi -->
                            <div class="col-xl-12">
                                <label class="form-label fw-medium d-flex align-items-center mb-1">
                                    <span class="text-dark">Sertifikasi</span>
                                </label>
                                <div class="form-group-split-input-card d-flex align-items-center gap-2 p-2 border rounded-3 bg-light" @click="$refs.createSertifikasi.focus()" style="cursor: text;">
                                    <div class="form-item-icon stat-icon-pink d-flex align-items-center justify-content-center p-2 rounded-2">
                                        <i class="ri-award-line fs-5"></i>
                                    </div>
                                    <div class="flex-grow-1">
                                        <input ref="createSertifikasi" type="text" class="form-item-input bg-transparent border-0 w-100 p-0 fs-14" v-model="sdmFormData.sertifikasi"
                                            placeholder="Contoh: CEH, CISSP" style="outline: none; box-shadow: none;" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="card-footer bg-light d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-outline-danger" @click="showCreateSdmModal = false">
                        <i class="ri-close-line me-1"></i>Batal
                    </button>
                    <button type="button" class="btn btn-secondary" @click="createSdm">
                        <i class="ri-save-line me-1"></i>Simpan
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- MODAL: Edit SDM -->
<div v-if="showEditSdmModal" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="showEditSdmModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal">
        <div class="modal-content border-0 bg-transparent">
            <div class="card custom-card gradient-header-card w-100 mb-0">
                <div class="card-header d-flex justify-content-between align-items-center gradient-header-blue">
                    <div class="d-flex align-items-center">
                        <i class="ri-edit-2-line text-white me-2 fs-18"></i>
                        <div class="card-title text-white mb-0">Edit SDM CSIRT</div>
                    </div>
                    <button type="button" class="btn-close btn-close-white" @click="showEditSdmModal = false"></button>
                </div>
                <div class="card-body p-4 bg-white">
                    <form @submit.prevent="updateSdm">
                        <div class="row gy-3">
                            <div class="col-xl-12">
                                <label class="form-label fw-medium d-flex align-items-center mb-1">
                                    <span class="text-dark">Nama Personel</span> <span class="text-danger ms-1">*</span>
                                </label>
                                <div class="form-group-split-input-card d-flex align-items-center gap-2 p-2 border rounded-3 bg-light" @click="$refs.editNamaSdm.focus()" style="cursor: text;">
                                    <div class="form-item-icon stat-icon-blue d-flex align-items-center justify-content-center p-2 rounded-2">
                                        <i class="ri-user-line fs-5"></i>
                                    </div>
                                    <div class="flex-grow-1">
                                        <input ref="editNamaSdm" type="text" class="form-item-input bg-transparent border-0 w-100 p-0 fs-14" v-model="sdmFormData.nama_personel"
                                            :class="{ 'is-invalid': sdmFormErrors.nama_personel }"
                                            placeholder="Masukkan nama personel" style="outline: none; box-shadow: none;" />
                                    </div>
                                </div>
                                <div v-if="sdmFormErrors.nama_personel" class="text-danger mt-1 fs-12">{{ sdmFormErrors.nama_personel }}</div>
                            </div>
                            <div class="col-xl-6">
                                <label class="form-label fw-medium d-flex align-items-center mb-1">
                                    <span class="text-dark">Jabatan CSIRT</span> <span class="text-danger ms-1">*</span>
                                </label>
                                <div class="form-group-split-input-card d-flex align-items-center gap-2 p-2 border rounded-3 bg-light" @click="$refs.editJabatanCsirt.focus()" style="cursor: text;">
                                    <div class="form-item-icon stat-icon-purple d-flex align-items-center justify-content-center p-2 rounded-2">
                                        <i class="ri-shield-user-line fs-5"></i>
                                    </div>
                                    <div class="flex-grow-1">
                                        <input ref="editJabatanCsirt" type="text" class="form-item-input bg-transparent border-0 w-100 p-0 fs-14" v-model="sdmFormData.jabatan_csirt"
                                            :class="{ 'is-invalid': sdmFormErrors.jabatan_csirt }"
                                            placeholder="Contoh: Incident Handler" style="outline: none; box-shadow: none;" />
                                    </div>
                                </div>
                                <div v-if="sdmFormErrors.jabatan_csirt" class="text-danger mt-1 fs-12">{{ sdmFormErrors.jabatan_csirt }}</div>
                            </div>
                            <div class="col-xl-6">
                                <label class="form-label fw-medium d-flex align-items-center mb-1">
                                    <span class="text-dark">Jabatan Perusahaan</span>
                                </label>
                                <div class="form-group-split-input-card d-flex align-items-center gap-2 p-2 border rounded-3 bg-light" @click="$refs.editJabatanPrshn.focus()" style="cursor: text;">
                                    <div class="form-item-icon stat-icon-teal d-flex align-items-center justify-content-center p-2 rounded-2">
                                        <i class="ri-building-line fs-5"></i>
                                    </div>
                                    <div class="flex-grow-1">
                                        <input ref="editJabatanPrshn" type="text" class="form-item-input bg-transparent border-0 w-100 p-0 fs-14" v-model="sdmFormData.jabatan_perusahaan"
                                            placeholder="Contoh: IT Security Specialist" style="outline: none; box-shadow: none;" />
                                    </div>
                                </div>
                            </div>
                            <div class="col-xl-12">
                                <label class="form-label fw-medium d-flex align-items-center mb-1">
                                    <span class="text-dark">Keahlian / Skill</span>
                                </label>
                                <div class="form-group-split-input-card d-flex align-items-center gap-2 p-2 border rounded-3 bg-light" @click="$refs.editSkill.focus()" style="cursor: text;">
                                    <div class="form-item-icon stat-icon-orange d-flex align-items-center justify-content-center p-2 rounded-2">
                                        <i class="ri-tools-line fs-5"></i>
                                    </div>
                                    <div class="flex-grow-1">
                                        <input ref="editSkill" type="text" class="form-item-input bg-transparent border-0 w-100 p-0 fs-14" v-model="sdmFormData.skill"
                                            placeholder="Contoh: Malware Analysis, Network Security" style="outline: none; box-shadow: none;" />
                                    </div>
                                </div>
                            </div>
                            <div class="col-xl-12">
                                <label class="form-label fw-medium d-flex align-items-center mb-1">
                                    <span class="text-dark">Sertifikasi</span>
                                </label>
                                <div class="form-group-split-input-card d-flex align-items-center gap-2 p-2 border rounded-3 bg-light" @click="$refs.editSertifikasi.focus()" style="cursor: text;">
                                    <div class="form-item-icon stat-icon-pink d-flex align-items-center justify-content-center p-2 rounded-2">
                                        <i class="ri-award-line fs-5"></i>
                                    </div>
                                    <div class="flex-grow-1">
                                        <input ref="editSertifikasi" type="text" class="form-item-input bg-transparent border-0 w-100 p-0 fs-14" v-model="sdmFormData.sertifikasi"
                                            placeholder="Contoh: CEH, CISSP" style="outline: none; box-shadow: none;" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="card-footer bg-light d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-outline-danger" @click="showEditSdmModal = false">
                        <i class="ri-arrow-left-line me-1"></i>Batal
                    </button>
                    <button type="button" class="btn btn-secondary" @click="updateSdm">
                        <i class="ri-save-line me-1"></i>Simpan Perubahan
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- MODAL: Hapus SDM -->
<div v-if="showDeleteSdmModal" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="showDeleteSdmModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Konfirmasi Hapus SDM</h5>
                <button type="button" class="btn-close" @click="showDeleteSdmModal = false"></button>
            </div>
            <div class="modal-body">
                <div class="text-center">
                    <i class="ri-error-warning-line text-danger warning-icon-lg"></i>
                    <h5 class="mt-3">Apakah Anda yakin?</h5>
                    <p class="text-muted">
                        Anda akan menghapus personel <strong>{{ currentDeleteSdm?.nama_personel }}</strong>.
                        Tindakan ini tidak dapat dibatalkan.
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="showDeleteSdmModal = false">Batal</button>
                <button type="button" class="btn btn-danger" @click="deleteSdm">
                    <i class="ri-delete-bin-line me-1"></i>Hapus
                </button>
            </div>
        </div>
    </div>
</div>


<!-- MODAL: Hapus SE -->
<div v-if="showDeleteSeModal" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="showDeleteSeModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Konfirmasi Hapus SE</h5>
                <button type="button" class="btn-close" @click="showDeleteSeModal = false"></button>
            </div>
            <div class="modal-body">
                <div class="text-center">
                    <i class="ri-error-warning-line text-danger warning-icon-lg"></i>
                    <h5 class="mt-3">Apakah Anda yakin?</h5>
                    <p class="text-muted">
                        Anda akan menghapus SE <strong>{{ currentDeleteSe?.nama_se }}</strong>.
                        Tindakan ini tidak dapat dibatalkan.
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="showDeleteSeModal = false">Batal</button>
                <button type="button" class="btn btn-danger" @click="deleteSe">
                    <i class="ri-delete-bin-line me-1"></i>Hapus
                </button>
            </div>
        </div>
    </div>
</div>

<!-- ------------------------------------------------------------------ -->
<!-- MODAL: Edit CSIRT -->
<!-- ------------------------------------------------------------------ -->
<div v-if="showEditProfileModal" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="showEditProfileModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal modal-lg">
        <div class="modal-content border-0 bg-transparent">
            <div class="card custom-card gradient-header-card w-100 mb-0">
                <div class="card-header d-flex justify-content-between align-items-center gradient-header-blue">
                    <div class="d-flex align-items-center">
                        <i class="ri-edit-2-line text-white me-2 fs-18"></i>
                        <div class="card-title text-white mb-0">Edit CSIRT</div>
                    </div>
                    <button type="button" class="btn-close btn-close-white" @click="showEditProfileModal = false"></button>
                </div>
                <div class="card-body p-4 bg-white">
                    <form @submit.prevent="updateProfile">
                        <div class="row gy-3">
                            <!-- Logo / Photo CSIRT -->
                            <div class="col-xl-12">
                                <div class="d-flex flex-column flex-sm-row gap-3 align-items-start">
                                    <!-- Photo Preview -->
                                    <div 
                                      class="photo-preview-modal position-relative overflow-hidden rounded-3 shadow-sm border flex-shrink-0"
                                      :style="{ 
                                        backgroundColor: profileFormData.photo_csirt ? 'transparent' : '#f8f9fa',
                                        width: '180px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                      }"
                                    >
                                      <img v-if="profileFormData.photo_csirt" :src="profileFormData.photo_csirt" class="w-100 h-100 p-2" style="object-fit:contain;" alt="Logo CSIRT" />
                                      <!-- Empty State -->
                                      <div v-if="!profileFormData.photo_csirt" class="position-absolute w-100 h-100 d-flex flex-column align-items-center justify-content-center text-muted photo-empty-state">
                                        <i class="ri-image-add-line fs-2 mb-1 opacity-50"></i>
                                        <span class="fs-11">Belum ada logo</span>
                                      </div>
                                    </div>
                                    <input ref="profilePhotoFile" type="file" accept="image/jpeg,image/png,image/gif" class="d-none" @change="onProfilePhotoChange" />
                                    
                                    <!-- Photo Info & Actions -->
                                    <div class="flex-grow-1">
                                      <h6 class="fw-semibold mb-3 d-flex align-items-center gap-2">
                                        <i class="ri-image-2-line text-primary"></i>
                                        Logo CSIRT
                                      </h6>
                                      <div class="d-flex flex-wrap gap-2 mb-2">
                                        <button type="button" class="btn btn-primary btn-sm" @click="$refs.profilePhotoFile.click()">
                                          <i class="ri-upload-2-line me-1"></i>
                                          {{ profileFormData.photo_csirt ? 'Ganti Logo' : 'Upload Logo' }}
                                        </button>
                                        <button v-if="profileFormData.photo_csirt" type="button" class="btn btn-outline-danger btn-sm" @click="removeProfilePhoto">
                                          <i class="ri-delete-bin-line me-1"></i>Hapus
                                        </button>
                                      </div>
                                      <div class="d-flex align-items-center gap-3 fs-11 text-muted">
                                        <span><i class="ri-file-type-line me-1"></i>JPEG, PNG, GIF</span>
                                        <span><i class="ri-upload-cloud-line me-1"></i>Max 5MB</span>
                                      </div>
                                    </div>
                                  </div>
                            </div>
                            <!-- Nama CSIRT -->
                            <div class="col-xl-12">
                                <label class="form-label fw-medium">
                                    <i class="ri-building-line me-1 text-primary"></i>Nama CSIRT <span class="text-danger">*</span>
                                </label>
                                <input type="text" class="form-control" v-model="profileFormData.nama_csirt"
                                    :class="{ 'is-invalid': profileFormErrors.nama_csirt }"
                                    placeholder="Masukkan nama CSIRT" />
                                <div v-if="profileFormErrors.nama_csirt" class="invalid-feedback">{{ profileFormErrors.nama_csirt }}</div>
                            </div>
                            <!-- No Telepon & Website -->
                            <div class="col-xl-6">
                                <label class="form-label fw-medium">
                                    <i class="ri-phone-line me-1 text-primary"></i>No. Telepon
                                </label>
                                <input type="text" class="form-control" v-model="profileFormData.telepon_csirt"
                                    placeholder="Contoh: 08123456789" />
                            </div>
                            <div class="col-xl-6">
                                <label class="form-label fw-medium">
                                    <i class="ri-global-line me-1 text-primary"></i>Website
                                </label>
                                <input type="text" class="form-control" v-model="profileFormData.web_csirt"
                                    placeholder="Contoh: https://csirt.id" />
                            </div>
                            <!-- Dokumen RFC 2350 -->
                            <div class="col-xl-12">
                                <label class="form-label fw-medium">
                                    <i class="ri-file-pdf-line me-1 text-primary"></i>RFC 2350
                                </label>
                                <div class="input-group w-100 gap-4">
                                    <input type="text" class="form-control" v-model="profileFormData.file_rfc2350"
                                        placeholder="Link atau pilih file" />
                                    <input type="file" ref="rfcFile" class="d-none" @change="handleFileUpload($event, 'rfc')" accept=".pdf" />
                                    <button class="btn btn-primary-light" type="button" @click="$refs.rfcFile.click()">
                                        <i class="ri-upload-2-line me-1"></i>Upload
                                    </button>
                                </div>
                                <div v-if="profileFormData.file_rfc2350_file" class="text-success small mt-1">
                                    <i class="ri-check-line"></i> {{ profileFormData.file_rfc2350_file.name }} siap diupload
                                </div>
                            </div>
                            <!-- Public Key PGP -->
                            <div class="col-xl-12">
                                <label class="form-label fw-medium">
                                    <i class="ri-key-2-line me-1 text-primary"></i>Public Key PGP
                                </label>
                                <div class="input-group w-100 gap-4">
                                    <input type="text" class="form-control" v-model="profileFormData.file_public_key_pgp"
                                        placeholder="Link atau pilih file" />
                                    <input type="file" ref="pgpFile" class="d-none" @change="handleFileUpload($event, 'pgp')" accept=".asc,.txt,.key" />
                                    <button class="btn btn-secondary-light" type="button" @click="$refs.pgpFile.click()">
                                        <i class="ri-upload-2-line me-1"></i>Upload
                                    </button>
                                </div>
                                <div v-if="profileFormData.file_public_key_pgp_file" class="text-success small mt-1">
                                    <i class="ri-check-line"></i> {{ profileFormData.file_public_key_pgp_file.name }} siap diupload
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="card-footer bg-light d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-outline-danger" @click="showEditProfileModal = false">
                        <i class="ri-close-line me-1"></i>Batal
                    </button>
                    <button type="button" class="btn btn-secondary" @click="updateProfile">
                        <i class="ri-save-line me-1"></i>Simpan Perubahan
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- ------------------------------------------------------------------ -->
<!-- MODAL: Daftarkan CSIRT Baru -->
<!-- ------------------------------------------------------------------ -->
<div v-if="showAddCsirtModal" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="showAddCsirtModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal">
        <div class="modal-content border-0 bg-transparent">
            <div class="card custom-card gradient-header-card w-100 mb-0">
                <div class="card-header d-flex justify-content-between align-items-center gradient-header-blue">
                    <div class="d-flex align-items-center">
                        <i class="ri-shield-check-line text-white me-2 fs-18"></i>
                        <div class="card-title text-white mb-0">Daftarkan CSIRT</div>
                    </div>
                    <button type="button" class="btn-close btn-close-white" @click="showAddCsirtModal = false"></button>
                </div>
                <div class="card-body p-4 bg-white">

                    <!-- Success state -->
                    <div v-if="csirtFormSuccess" class="text-center py-4">
                        <i class="ri-checkbox-circle-fill text-success" style="font-size:3rem"></i>
                        <h6 class="mt-2 fw-semibold">CSIRT berhasil didaftarkan!</h6>
                    </div>

                    <form v-else @submit.prevent="submitAddCsirt">
                        <!-- Info perusahaan (readonly) -->
                        <div class="alert alert-light border py-2 mb-3 fs-13 d-flex align-items-center gap-2">
                            <i class="ri-building-2-line text-primary"></i>
                            <span>Perusahaan: <strong>{{ newStakeholder?.nama_perusahaan }}</strong></span>
                        </div>

                        <div class="row gy-3">
                            <!-- Nama CSIRT -->
                            <div class="col-12">
                                <label class="form-label fw-medium">Nama CSIRT <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" :class="{ 'is-invalid': csirtFormErrors.nama_csirt }"
                                    v-model="csirtFormData.nama_csirt" placeholder="Contoh: CSIRT PT. ABC Indonesia" />
                                <div v-if="csirtFormErrors.nama_csirt" class="invalid-feedback">{{ csirtFormErrors.nama_csirt }}</div>
                            </div>
                            <!-- Website -->
                            <div class="col-md-6">
                                <label class="form-label fw-medium">Website CSIRT</label>
                                <input type="url" class="form-control" v-model="csirtFormData.web_csirt"
                                    placeholder="https://csirt.example.com" />
                            </div>
                            <!-- Telepon -->
                            <div class="col-md-6">
                                <label class="form-label fw-medium">Telepon CSIRT</label>
                                <input type="tel" class="form-control" v-model="csirtFormData.telepon_csirt"
                                    placeholder="021-12345678" />
                            </div>
                            <!-- Photo CSIRT -->
                            <div class="col-12">
                                <div class="d-flex flex-column flex-sm-row gap-3 align-items-start">
                                    <!-- Photo Preview -->
                                    <div 
                                      class="photo-preview-modal position-relative overflow-hidden rounded-3 shadow-sm border flex-shrink-0"
                                      :style="{ 
                                        backgroundColor: csirtFormData.photo_csirt_preview ? 'transparent' : '#f8f9fa',
                                        width: '180px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                      }"
                                    >
                                      <img v-if="csirtFormData.photo_csirt_preview" :src="csirtFormData.photo_csirt_preview" class="w-100 h-100 p-2" style="object-fit:contain;" alt="Logo CSIRT" />
                                      <!-- Empty State -->
                                      <div v-if="!csirtFormData.photo_csirt_preview" class="position-absolute w-100 h-100 d-flex flex-column align-items-center justify-content-center text-muted photo-empty-state">
                                        <i class="ri-image-add-line fs-2 mb-1 opacity-50"></i>
                                        <span class="fs-11">Belum ada logo</span>
                                      </div>
                                    </div>
                                    <input ref="addCsirtPhotoInput" type="file" accept="image/jpeg,image/png,image/gif" class="d-none" @change="onAddCsirtPhotoChange" />
                                    
                                    <!-- Photo Info & Actions -->
                                    <div class="flex-grow-1">
                                      <h6 class="fw-semibold mb-3 d-flex align-items-center gap-2">
                                        <i class="ri-image-2-line text-primary"></i>
                                        Logo CSIRT
                                      </h6>
                                      <div class="d-flex flex-wrap gap-2 mb-2">
                                        <button type="button" class="btn btn-primary btn-sm" @click="$refs.addCsirtPhotoInput.click()">
                                          <i class="ri-upload-2-line me-1"></i>
                                          {{ csirtFormData.photo_csirt_preview ? 'Ganti Logo' : 'Upload Logo' }}
                                        </button>
                                        <button v-if="csirtFormData.photo_csirt_preview" type="button" class="btn btn-outline-danger btn-sm" @click="removeAddCsirtPhoto">
                                          <i class="ri-delete-bin-line me-1"></i>Hapus
                                        </button>
                                      </div>
                                      <div class="d-flex align-items-center gap-3 fs-11 text-muted">
                                        <span><i class="ri-file-type-line me-1"></i>JPEG, PNG, GIF</span>
                                        <span><i class="ri-upload-cloud-line me-1"></i>Max 5MB</span>
                                      </div>
                                    </div>
                                </div>
                                <div v-if="csirtFormErrors.photo_csirt" class="text-danger mt-1 fs-12">{{ csirtFormErrors.photo_csirt }}</div>
                            </div>
                            <!-- RFC 2350 -->
                            <div class="col-md-6">
                                <label class="form-label fw-medium">File RFC 2350</label>
                                <input type="file" class="form-control"
                                    @change="onCsirtFileChange($event, 'file_rfc2350')" />
                            </div>
                            <!-- Public Key PGP -->
                            <div class="col-md-6">
                                <label class="form-label fw-medium">File Public Key PGP</label>
                                <input type="file" class="form-control"
                                    @change="onCsirtFileChange($event, 'file_public_key_pgp')" />
                            </div>
                        </div>

                        <div v-if="csirtFormError" class="alert alert-danger py-2 mt-3 fs-13">
                            <i class="ri-error-warning-line me-1"></i>{{ csirtFormError }}
                        </div>
                    </form>
                </div>
                <div class="card-footer bg-light d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-outline-danger" @click="showAddCsirtModal = false">
                        <i class="ri-close-line me-1"></i>Batal
                    </button>
                    <button v-if="!csirtFormSuccess" type="button" class="btn btn-primary" @click="submitAddCsirt" :disabled="csirtFormLoading">
                        <span v-if="csirtFormLoading" class="spinner-border spinner-border-sm me-1"></span>
                        <i v-else class="ri-save-line me-1"></i>
                        Daftarkan
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

</template>


<style>
/* Global style untuk modal - tidak scoped agar bisa override */
@media (min-width: 992px) {
  .modal.fade.show.d-block .modal-dialog {
    margin-left: calc(250px + ((100% - 250px - 1000px) / 2)) !important;
    margin-right: auto !important;
  }
}
</style>

<style scoped>
.warning-icon-lg {
  font-size: 3.5rem;
}
</style>
