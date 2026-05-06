<script lang="ts">
import SimpleCardComponent from "../../shared/components/@spk/simple-card.vue";
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { csirtService } from "../../services/csirt.service";
import type { SdmCsirt, SeCsirt, CsirtMember } from "../../types/csirt.types";
import { useRoute } from "vue-router";
import { useStakeholdersStore } from "../../stores/stakeholders";
import { useAuthStore } from "../../stores/auth";
import { useCsirtStore } from "../../stores/csirt";
import { useKseStore } from "../../stores/kse";
import { useRouter } from "vue-router";
import { config } from "../../config/env";
import gsap from "gsap";

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
        const isFullAdmin = computed(() => authStore.isFullAdmin);
        const csirtPageRef = ref<HTMLElement | null>(null);
        const isCsirtDarkMode = ref(false);
        let themeObserver: MutationObserver | null = null;

        const syncCsirtTheme = () => {
            if (typeof document === "undefined") return;
            const root = document.documentElement;
            const body = document.body;
            isCsirtDarkMode.value =
                root.getAttribute("data-theme-mode") === "dark" ||
                body?.getAttribute("data-theme-mode") === "dark" ||
                root.classList.contains("dark") ||
                body?.classList.contains("dark");
        };

        const animateCsirtPage = async () => {
            await nextTick();
            const root = csirtPageRef.value;
            const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
            if (!root || prefersReducedMotion) return;

            const blocks = root.querySelectorAll<HTMLElement>(".csirt-animate");
            const rows = root.querySelectorAll<HTMLElement>(".stakeholder-row");
            const fills = root.querySelectorAll<HTMLElement>(".csirt-meter-fill");
            const animatedElements = [...blocks, ...rows, ...fills];

            gsap.killTweensOf(animatedElements);
            gsap.fromTo(
                blocks,
                { autoAlpha: 0, y: 18 },
                { autoAlpha: 1, y: 0, duration: 0.48, stagger: 0.07, ease: "power3.out" }
            );
            gsap.fromTo(
                rows,
                { autoAlpha: 0, x: -10 },
                { autoAlpha: 1, x: 0, duration: 0.34, stagger: 0.035, ease: "power2.out", delay: 0.12 }
            );
            gsap.fromTo(
                fills,
                { scaleX: 0, transformOrigin: "left center" },
                { scaleX: 1, duration: 0.54, stagger: 0.05, ease: "power2.out", delay: 0.16 }
            );
        };

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
        const canDelete = computed(() => isFullAdmin.value || isOwner.value);

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
                
                // Allow matching by stakeholder slug directly
                const stakeholder = stakeholdersStore.stakeholders.find(s => String(s.id) === String(c.id_perusahaan || (c as any).perusahaan?.id));
                if (stakeholder && stakeholder.slug === slug) return true;
                if ((c as any).perusahaan?.slug && (c as any).perusahaan?.slug === slug) return true;

                const csirtPart = c.slug || toSlug(c.nama_csirt);
                const perusahaanName = (c as any).perusahaan?.nama_perusahaan;
                const perusahaanPart = perusahaanName ? toSlug(perusahaanName) : '';
                const combined = perusahaanPart ? `${csirtPart}-${perusahaanPart}` : csirtPart;
                return combined === slug || csirtPart === slug;
            });
        });

        const csirtId = computed(() => currentCsirt.value?.id);

        // SDM & SE Lists from Store
        const items = computed(() => {
            const id = csirtId.value;
            if (!id) return [];
            const sid = String(id);
            return csirtStore.sdmList.filter(item => 
                String(item.id_csirt) === sid || String((item as any).csirt?.id) === sid
            );
        });

        const seItems = computed(() => {
            const id = csirtId.value;
            if (!id) return [];
            const sid = String(id);
            return csirtStore.seList.filter((item: any) => {
                const currentPerusahaanId = String(currentCsirt.value?.id_perusahaan || (currentCsirt.value as any)?.perusahaan?.id);
                const match = String(item.id_csirt) === sid || 
                              String(item.csirt_id) === sid || 
                              String(item.csirt?.id) === sid || 
                              (item.id_perusahaan && String(item.id_perusahaan) === currentPerusahaanId);
                return match;
            });
        });

        const loading = ref(false);

        // Async data loading from API
        const loadCSIRTs = async () => {
            loading.value = true;
            try {
                // Determine target parameters
                const options = {
                    fetchGlobal: false,
                    targetCsirtId: csirtSlug.value ? csirtSlug.value : undefined,
                    targetCompanyId: !csirtSlug.value && newStakeholder.value ? newStakeholder.value.id : undefined,
                };
                // Use the store refresh to load everything including SDM/SE lists
                await csirtStore.refresh(options);
            } catch (err) {
                console.error('Failed to load CSIRT data:', err);
            } finally {
                loading.value = false;
            }
        };

        onMounted(async () => {
            syncCsirtTheme();
            themeObserver = new MutationObserver(syncCsirtTheme);
            themeObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ["data-theme-mode", "class"],
            });
            if (document.body) {
                themeObserver.observe(document.body, {
                    attributes: true,
                    attributeFilter: ["data-theme-mode", "class"],
                });
            }

            if (!stakeholdersStore.initialized) {
                await stakeholdersStore.initialize();
            }
            if (!csirtStore.initialized) {
                const options = {
                    fetchGlobal: false,
                    targetCsirtId: csirtSlug.value ? csirtSlug.value : undefined,
                    targetCompanyId: !csirtSlug.value && newStakeholder.value ? newStakeholder.value.id : undefined,
                };
                await csirtStore.initialize(options);
            } else {
                // If already initialized, at least trigger refreshing SDM/SE lists
                await loadCSIRTs();
            }
            
            // Auto open create modal if requested from dashboard
            if (route.query.action === 'create' && canCreateCsirt.value) {
                openAddCsirtModal();
            }

            await animateCsirtPage();
        });

        onUnmounted(() => {
            themeObserver?.disconnect();
            const root = csirtPageRef.value;
            if (root) {
                gsap.killTweensOf([...root.querySelectorAll(".csirt-animate, .stakeholder-row, .csirt-meter-fill")]);
            }
        });

        watch(csirtId, () => {
            loadCSIRTs();
        });

        // Debug: log current CSIRT object when it changes to help trace missing files
        watch(currentCsirt, (val) => {
            console.debug('[csirt.vue] currentCsirt changed:', val);
        }, { immediate: true });

        watch([currentCsirt, items, seItems], () => {
            animateCsirtPage();
        });

        const dataToPass = computed(() => {
            const from = String(route.query.from || '');

            if (from === 'csirt-list') {
                return {
                    currentpage: "CSIRT",
                    title: { label: "CSIRT List", path: "/csirt-list" },
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
                const result = await csirtStore.createSdm({
                    id_csirt: sdmFormData.value.id_csirt!,
                    nama_personel: sdmFormData.value.nama_personel!,
                    jabatan_csirt: sdmFormData.value.jabatan_csirt!,
                    jabatan_perusahaan: sdmFormData.value.jabatan_perusahaan || "",
                    skill: sdmFormData.value.skill || "",
                    sertifikasi: sdmFormData.value.sertifikasi || "",
                });
                
                if (result.success) {
                    showCreateSdmModal.value = false;
                    showNotification("SDM berhasil ditambahkan!", "success");
                    loadCSIRTs();
                } else {
                    showNotification("Gagal menambahkan SDM: " + result.error, "error");
                }
            } catch (error: any) {
                console.error("Gagal tambah SDM:", error);
                showNotification("Terjadi kesalahan saat menambahkan SDM", "error");
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
                const result = await csirtStore.updateSdm(currentEditSdm.value.id, {
                    id_csirt: sdmFormData.value.id_csirt!,
                    nama_personel: sdmFormData.value.nama_personel!,
                    jabatan_csirt: sdmFormData.value.jabatan_csirt!,
                    jabatan_perusahaan: sdmFormData.value.jabatan_perusahaan || "",
                    skill: sdmFormData.value.skill || "",
                    sertifikasi: sdmFormData.value.sertifikasi || "",
                });
                if (result.success) {
                    showEditSdmModal.value = false;
                    showNotification("SDM berhasil diperbarui!", "success");
                    loadCSIRTs();
                } else {
                    showNotification("Gagal memperbarui SDM: " + result.error, "error");
                }
            } catch (error: any) {
                console.error("Gagal update SDM:", error);
                showNotification("Terjadi kesalahan saat memperbarui SDM", "error");
            }
        };

        const openDeleteSdmModal = (item: any) => {
            currentDeleteSdm.value = item as SdmCsirt;
            showDeleteSdmModal.value = true;
        };

        const deleteSdm = async () => {
            if (!currentDeleteSdm.value) return;
            try {
                const result = await csirtStore.deleteSdm(currentDeleteSdm.value.id);
                if (result.success) {
                    showDeleteSdmModal.value = false;
                    showNotification("SDM berhasil dihapus!", "success");
                    loadCSIRTs();
                } else {
                    showNotification("Gagal menghapus SDM: " + result.error, "error");
                }
            } catch (error: any) {
                console.error("Gagal hapus SDM:", error);
                showNotification("Terjadi kesalahan saat menghapus SDM", "error");
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

        // Navigate to KSE page in edit mode (Edit SE  data responden + penilaian)
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
                const result = await csirtStore.updateSe(currentEditSe.value.id, {
                    id_csirt: seFormData.value.id_csirt!,
                    nama_se: seFormData.value.nama_se!,
                    ip_se: seFormData.value.ip_se!,
                    as_number_se: seFormData.value.as_number_se || "",
                    pengelola_se: seFormData.value.pengelola_se || "",
                    fitur_se: seFormData.value.fitur_se || "",
                    kategori_se: seFormData.value.kategori_se || "Tinggi",
                });
                if (result.success) {
                    showEditSeModal.value = false;
                    showNotification("SE berhasil diperbarui!", "success");
                    loadCSIRTs();
                } else {
                    showNotification("Gagal memperbarui SE: " + result.error, "error");
                }
            } catch (error: any) {
                console.error("Gagal update SE:", error);
                showNotification("Terjadi kesalahan saat memperbarui SE", "error");
            }
        };

        const openDeleteSeModal = (item: any) => {
            currentDeleteSe.value = item as SeCsirt;
            showDeleteSeModal.value = true;
        };

        const deleteSe = async () => {
            if (!currentDeleteSe.value) return;
            try {
                const result = await csirtStore.deleteSe(currentDeleteSe.value.id);
                if (result.success) {
                    showDeleteSeModal.value = false;
                    showNotification("Sistem Elektronik berhasil dihapus!", "success");
                    loadCSIRTs();
                } else {
                    showNotification("Gagal menghapus SE: " + result.error, "error");
                }
            } catch (error: any) {
                console.error("Gagal hapus SE:", error);
                showNotification("Terjadi kesalahan saat menghapus Sistem Elektronik", "error");
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
            email_csirt         : '',
            photo_csirt         : null as File | null,
            photo_csirt_preview : '',
            file_rfc2350        : null as File | null,
            file_public_key_pgp : null as File | null,
            file_surat_tanda_registrasi : null as File | null,
        });
        const csirtFormErrors = ref<Record<string, string>>({});

        const openAddCsirtModal = () => {
            csirtFormData.value = { nama_csirt: '', web_csirt: '', telepon_csirt: '', email_csirt: '', photo_csirt: null, photo_csirt_preview: '', file_rfc2350: null, file_public_key_pgp: null, file_surat_tanda_registrasi: null };
            csirtFormErrors.value = {};
            csirtFormError.value = '';
            csirtFormSuccess.value = false;
            showAddCsirtModal.value = true;
        };

        const getUploadRule = (field: 'photo_csirt' | 'file_rfc2350' | 'file_public_key_pgp' | 'file_surat_tanda_registrasi') => {
            const rules = {
                photo_csirt: {
                    extensions: ['jpg', 'jpeg', 'png', 'gif'],
                    mimes: ['image/jpeg', 'image/png', 'image/gif'],
                    label: 'JPEG, PNG, atau GIF',
                },
                file_rfc2350: {
                    extensions: ['pdf'],
                    mimes: ['application/pdf'],
                    label: 'PDF',
                },
                file_public_key_pgp: {
                    extensions: ['asc'],
                    mimes: ['application/pgp-keys', 'application/octet-stream', 'text/plain'],
                    label: 'ASC',
                },
                file_surat_tanda_registrasi: {
                    extensions: ['pdf'],
                    mimes: ['application/pdf'],
                    label: 'PDF',
                },
            };
            return rules[field];
        };

        const validateUploadFile = (file: File, field: 'photo_csirt' | 'file_rfc2350' | 'file_public_key_pgp' | 'file_surat_tanda_registrasi'): boolean => {
            const rule = getUploadRule(field);
            const extension = file.name.split('.').pop()?.toLowerCase() || '';
            const isValidExtension = rule.extensions.includes(extension);
            const isValidMime = !file.type || rule.mimes.includes(file.type);

            if (!isValidExtension || !isValidMime) {
                showNotification(`File harus berformat ${rule.label}`, "error");
                return false;
            }
            return true;
        };

        const onCsirtFileChange = (event: Event, field: 'photo_csirt' | 'file_rfc2350' | 'file_public_key_pgp' | 'file_surat_tanda_registrasi') => {
            const input = event.target as HTMLInputElement;
            if (input.files && input.files[0]) {
                const file = input.files[0];
                if (!validateUploadFile(file, field)) {
                    input.value = '';
                    return;
                }
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
                email_csirt         : csirtFormData.value.email_csirt,
                photo_csirt         : csirtFormData.value.photo_csirt,
                file_rfc2350        : csirtFormData.value.file_rfc2350,
                file_public_key_pgp : csirtFormData.value.file_public_key_pgp,
                file_surat_tanda_registrasi : csirtFormData.value.file_surat_tanda_registrasi,
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
        const profileFormData = ref<Partial<CsirtMember> & { photo_csirt_file?: File | null; file_rfc2350_file?: File | null; file_public_key_pgp_file?: File | null; file_surat_tanda_registrasi_file?: File | null }>({
            nama_csirt: "",
            telepon_csirt: "",
            email_csirt: "",
            web_csirt: "",
            file_rfc2350: "",
            file_public_key_pgp: "",
            file_surat_tanda_registrasi: "",
            photo_csirt_file: null,
            file_rfc2350_file: null,
            file_public_key_pgp_file: null,
            file_surat_tanda_registrasi_file: null,
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
                profileFormData.value = { ...currentCsirt.value, photo_csirt_file: null, file_rfc2350_file: null, file_public_key_pgp_file: null, file_surat_tanda_registrasi_file: null };
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
                const result = await csirtStore.updateCsirtById(currentCsirt.value.id, {
                    nama_csirt          : profileFormData.value.nama_csirt!,
                    telepon_csirt       : profileFormData.value.telepon_csirt || "",
                    email_csirt         : profileFormData.value.email_csirt || "",
                    web_csirt           : profileFormData.value.web_csirt || "",
                    photo_csirt         : profileFormData.value.photo_csirt_file ?? undefined,
                    file_rfc2350        : profileFormData.value.file_rfc2350_file ?? undefined,
                    file_public_key_pgp : profileFormData.value.file_public_key_pgp_file ?? undefined,
                    file_surat_tanda_registrasi : profileFormData.value.file_surat_tanda_registrasi_file ?? undefined,
                });
                
                if (result.success) {
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
                } else {
                    showNotification("Gagal memperbarui profil: " + result.error, "error");
                }
            } catch (err: any) {
                console.error("Gagal update profil:", err);
                showNotification("Gagal memperbarui profil CSIRT.", "error");
            }
        };

        const handleFileUpload = (event: Event, type: 'rfc' | 'pgp' | 'str') => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                const file = target.files[0];
                const field = type === 'rfc'
                    ? 'file_rfc2350'
                    : type === 'pgp'
                        ? 'file_public_key_pgp'
                        : 'file_surat_tanda_registrasi';
                if (!validateUploadFile(file, field)) {
                    target.value = '';
                    return;
                }
                if (type === 'rfc') {
                    profileFormData.value.file_rfc2350_file = file;
                } else if (type === 'pgp') {
                    profileFormData.value.file_public_key_pgp_file = file;
                } else if (type === 'str') {
                    profileFormData.value.file_surat_tanda_registrasi_file = file;
                }
                showNotification(`${file.name} berhasil dipilih`, "success");
            }
        };

        const closeEditableModalOnEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;

            if (showEditSdmModal.value) {
                showEditSdmModal.value = false;
                event.preventDefault();
                return;
            }
            if (showCreateSdmModal.value) {
                showCreateSdmModal.value = false;
                event.preventDefault();
                return;
            }
            if (showEditProfileModal.value) {
                showEditProfileModal.value = false;
                event.preventDefault();
                return;
            }
            if (showAddCsirtModal.value) {
                showAddCsirtModal.value = false;
                event.preventDefault();
            }
        };

        onMounted(() => {
            window.addEventListener("keydown", closeEditableModalOnEscape);
        });

        onUnmounted(() => {
            window.removeEventListener("keydown", closeEditableModalOnEscape);
        });

        return {

            isAdmin, isFullAdmin,
            isOwner,
            canEdit,
            canDelete,
            canCreateCsirt,
            csirtPageRef,
            isCsirtDarkMode,
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
            exportPdf: async () => {
                if (currentCsirt.value?.id) {
                    const id = currentCsirt.value.id;
                    const p = currentCsirt.value.perusahaan || stakeholdersStore.stakeholders.find(s => String(s.id) === String(currentCsirt.value?.id_perusahaan));
                    const companyName = p?.nama_perusahaan || currentCsirt.value.nama_csirt || 'csirt';
                    const safeName = companyName.replace(/[^a-z0-9]/gi, '_');
                    const filename = `Data_CSIRT_${safeName}.pdf`;

                    try {
                        const response = await fetch(`${config.api.baseUrl}/api/csirt/${id}/export-pdf`, {
                            credentials: 'include'
                        });
                        if (!response.ok) throw new Error('Gagal mengunduh file');
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = filename;
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        window.URL.revokeObjectURL(url);
                    } catch (error) {
                        console.error("Error exporting PDF:", error);
                    }
                }
            },
            forceDownloadFile: async (fileUrl: string, defaultFileName: string) => {
                try {
                    let finalName = defaultFileName;
                    try {
                        const urlObj = new URL(fileUrl, window.location.origin);
                        const segments = urlObj.pathname.split('/');
                        const lastSegment = segments.pop() || '';
                        if (lastSegment && lastSegment.includes('.')) {
                            finalName = lastSegment;
                        }
                    } catch (e) {}

                    const response = await fetch(fileUrl);
                    if (!response.ok) throw new Error('File not accessible via fetch');
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = finalName;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                } catch (error) {
                    console.error("Download fallback:", error);
                    const link = document.createElement('a');
                    link.href = fileUrl;
                    link.download = defaultFileName;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    document.body.appendChild(link);
                    link.click();
                    if (link.parentNode) link.parentNode.removeChild(link);
                }
            },
            exportPdfSe: async (row: any) => {
                const id = row.id;
                const safeName = (row.nama_se || 'se').replace(/[^a-z0-9]/gi, '_');
                const filename = `Data_SE_${safeName}.pdf`;

                try {
                    const response = await fetch(`${config.api.baseUrl}/api/se/${id}/export-pdf`, {
                        credentials: 'include'
                    });
                    if (!response.ok) throw new Error('Gagal mengunduh file');
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                } catch (error) {
                    console.error("Error exporting SE PDF:", error);
                    // showNotification("Gagal mengunduh PDF SE", "error");
                }
            },
            exportAllSePdf: async () => {
                const idPerusahaan = currentCsirt.value?.id_perusahaan || (currentCsirt.value as any)?.perusahaan?.id;
                const safeName = (currentCsirt.value?.nama_csirt || 'semua').replace(/[^a-z0-9]/gi, '_');
                const filename = `Rekap_SE_${safeName}.pdf`;

                try {
                    const query = isAdmin.value && idPerusahaan
                        ? `?id_perusahaan=${encodeURIComponent(String(idPerusahaan))}`
                        : '';
                    const response = await fetch(`${config.api.baseUrl}/api/se/export-pdf${query}`, {
                        credentials: 'include'
                    });
                    if (!response.ok) throw new Error('Gagal mengunduh file');
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                } catch (error) {
                    console.error("Error exporting all SE PDF:", error);
                }
            },
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

.edit-profile-body {
  max-height: 72vh;
  overflow-y: auto;
}

.csirt-edit-modal {
  position: fixed !important;
  inset: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100vw !important;
  height: 100vh !important;
  padding: 24px 16px !important;
  background: rgba(15, 23, 42, 0.58) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  overflow: auto !important;
  z-index: 10050 !important;
}

.csirt-edit-modal .modal-dialog {
  width: min(920px, calc(100vw - 32px)) !important;
  max-width: 920px !important;
  margin: 0 !important;
  min-height: 0 !important;
  height: auto !important;
  background: transparent !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  overflow: visible !important;
}

.csirt-edit-modal .modal-content {
  width: 100% !important;
  max-width: none !important;
  background: transparent !important;
  box-shadow: none !important;
}

.csirt-edit-dialog {
  min-height: 0 !important;
}

.csirt-edit-dialog .custom-card {
  border-radius: 10px !important;
  overflow: hidden !important;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.22) !important;
}

.edit-logo-panel,
.document-upload-box {
  border: 1px solid #e9edf4;
  background: #fbfcfe;
  border-radius: 8px;
  padding: 16px;
}

.edit-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1f2937;
  font-size: 13px;
  font-weight: 700;
  padding-bottom: 8px;
  border-bottom: 1px solid #edf1f7;
}

.document-upload-box {
  height: 100%;
}

.document-upload-box .form-control {
  min-width: 0;
}

.modal-overlay .form-group-split-input-card {
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.modal-overlay .form-group-split-input-card:focus-within {
  border-color: rgba(37, 99, 235, 0.45) !important;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.modal-overlay .form-item-input,
.modal-overlay .form-control,
.modal-overlay .form-select {
  color: #1f2937;
}

.modal-overlay select.form-item-input,
.modal-overlay .form-select {
  min-height: 30px;
  padding-right: 2rem !important;
  appearance: none;
  background-image:
    linear-gradient(45deg, transparent 50%, currentColor 50%),
    linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position:
    calc(100% - 14px) 52%,
    calc(100% - 9px) 52%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  cursor: pointer;
}

.modal-overlay select.form-item-input option,
.modal-overlay .form-select option {
  color: #0f172a;
  background: #ffffff;
}

.profile-csirt-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 12px;
  display: block;
  border-radius: 12px;
}

.csirt-page-shell {
  --csirt-surface: #ffffff;
  --csirt-surface-soft: #f8fbff;
  --csirt-panel: #f1f5f9;
  --csirt-line: rgba(148, 163, 184, 0.24);
  --csirt-ink: #0f172a;
  --csirt-muted: #64748b;
  --csirt-blue: #2563eb;
  --csirt-cyan: #06b6d4;
  --csirt-teal: #0f766e;
  --csirt-amber: #f59e0b;
  --csirt-red: #ef4444;
  --csirt-shadow: 0 20px 48px rgba(15, 23, 42, 0.08);
}

.csirt-page-shell > .row + .row {
  margin-top: 1.25rem;
}

.csirt-hero-card {
  overflow: visible !important;
  border: 1px solid var(--csirt-line) !important;
  border-radius: 20px !important;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 251, 255, 0.98)),
    radial-gradient(circle at 9% 0%, rgba(37, 99, 235, 0.1), transparent 30%),
    radial-gradient(circle at 91% 0%, rgba(20, 184, 166, 0.1), transparent 30%) !important;
  box-shadow: var(--csirt-shadow) !important;
}

.csirt-hero-header {
  min-height: 82px;
  border: 0 !important;
  border-radius: 20px 20px 0 0 !important;
  background:
    linear-gradient(135deg, #102a7a 0%, #2563eb 58%, #06b6d4 100%) !important;
  position: relative;
  overflow: hidden;
}

.csirt-hero-header::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.16), transparent 34%),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0 1px, transparent 1px 18px);
  opacity: 0.5;
  pointer-events: none;
}

.csirt-hero-header > * {
  position: relative;
  z-index: 1;
}

.csirt-hero-header .header-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

.csirt-hero-header .header-icon-box i {
  font-size: 1.35rem;
}

.csirt-hero-header .btn {
  min-height: 34px;
  border: 0;
  border-radius: 999px;
  padding-inline: 0.85rem;
  font-size: 12px;
  font-weight: 850;
  box-shadow: 0 10px 24px rgba(2, 6, 23, 0.16);
}

.csirt-hero-body {
  padding: 1.25rem !important;
}

.csirt-profile-grid {
  display: grid !important;
  grid-template-columns: 140px minmax(280px, 1fr) minmax(360px, 0.95fr);
  gap: 1.35rem;
  align-items: stretch;
  min-height: 0;
  margin: 0 !important;
}

.csirt-profile-grid > .csirt-logo-column,
.csirt-profile-grid > .csirt-identity-column,
.csirt-profile-grid > .csirt-side-column {
  width: auto !important;
  max-width: none !important;
  flex: none !important;
  padding: 0 !important;
}

.csirt-logo-column {
  grid-column: 1;
  grid-row: 1;
  align-self: stretch;
  align-items: center !important;
  justify-content: center !important;
}

.csirt-identity-column {
  grid-column: 2;
  grid-row: 1;
}

.csirt-side-column {
  grid-column: 3;
  grid-row: 1;
  min-width: 0;
  margin-top: 0;
  justify-content: flex-start;
}

.csirt-logo-column,
.csirt-identity-column,
.csirt-side-column {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.csirt-side-column {
  justify-content: flex-start;
}

.csirt-page-shell .profile-photo-wrapper {
  align-self: center;
  width: 140px !important;
  height: 140px !important;
  margin: 0 !important;
  border-radius: 22px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(241, 245, 249, 0.96)),
    radial-gradient(circle at 50% 20%, rgba(6, 182, 212, 0.18), transparent 54%);
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.12);
}

.csirt-title-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.csirt-identity-column {
  min-width: 0;
  padding: 0.35rem 0.35rem;
  text-align: left !important;
}

.csirt-status-pill,
.csirt-company-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 28px;
  padding: 0.35rem 0.68rem;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 850;
}

.csirt-status-pill {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.csirt-company-pill {
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
}

.csirt-profile-title {
  color: var(--csirt-blue);
  font-size: clamp(1.55rem, 2vw, 2rem);
  letter-spacing: 0;
}

.csirt-contact-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.7rem;
  margin-top: 1rem;
}

.csirt-contact-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
  min-height: 52px;
  padding: 0.52rem 0.75rem;
  border: 1px solid rgba(226, 232, 240, 0.96);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
}

.csirt-contact-item .text-start {
  min-width: 0;
}

.csirt-contact-item .fw-semibold {
  overflow-wrap: anywhere;
}

.csirt-contact-item .fw-semibold,
.csirt-contact-item a {
  color: var(--csirt-ink);
}

.csirt-contact-icon {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
}

.csirt-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.csirt-stat-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 64px;
  padding: 0.8rem 0.95rem;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 14px;
  color: #fff;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.12);
  overflow: hidden;
  position: relative;
}

.csirt-stat-card::after {
  content: "";
  position: absolute;
  left: 0.9rem;
  right: 0.9rem;
  bottom: 0.58rem;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
}

.csirt-stat-card .csirt-meter-fill {
  position: absolute;
  left: 0.9rem;
  bottom: 0.58rem;
  width: 52%;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.54);
  transform-origin: left center;
  pointer-events: none;
}

.csirt-stat-card > i,
.csirt-stat-card > div {
  position: relative;
  z-index: 1;
}

.csirt-stat-card.stat-blue {
  background: linear-gradient(135deg, #1e40af, #2563eb 56%, #0ea5e9);
}

.csirt-stat-card.stat-green {
  background: linear-gradient(135deg, #0f766e, #059669 58%, #14b8a6);
}

.csirt-stat-card i,
.csirt-stat-card .fw-bold,
.csirt-stat-card .text-muted {
  color: #fff !important;
}

.csirt-stat-card .text-muted {
  color: rgba(255, 255, 255, 0.86) !important;
  opacity: 1;
}

.csirt-doc-card {
  flex: 1;
  min-height: 166px;
  padding: 0.95rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(241, 245, 249, 0.92)),
    radial-gradient(circle at 0% 0%, rgba(245, 158, 11, 0.1), transparent 34%);
}

.csirt-doc-body {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.csirt-doc-body > .d-flex {
  flex: 1;
}

.csirt-doc-btn {
  min-height: 36px;
  border: 0;
  border-radius: 10px;
  padding-inline: 0.78rem;
  font-size: 12px;
  font-weight: 850;
}

.csirt-doc-btn.btn-primary {
  background: #1d4ed8 !important;
}

.csirt-doc-btn.btn-secondary {
  background: #f59e0b !important;
}

.csirt-doc-btn.btn-info {
  background: #0891b2 !important;
  color: #fff !important;
}

.csirt-doc-empty {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 38px;
  padding: 0.6rem 0.7rem;
  border: 1px dashed rgba(148, 163, 184, 0.42);
  border-radius: 12px;
  color: var(--csirt-muted);
  font-size: 12px;
  font-weight: 800;
}

:deep(.csirt-table-card) {
  border: 1px solid var(--csirt-line) !important;
  border-radius: 18px !important;
  background: var(--csirt-surface) !important;
  box-shadow: var(--csirt-shadow) !important;
  overflow: hidden;
}

:deep(.csirt-table-card .csirt-table-header) {
  min-height: 64px;
  padding: 1rem 1.25rem !important;
  border-bottom: 1px solid var(--csirt-line) !important;
  background:
    linear-gradient(180deg, #ffffff, #f8fafc),
    radial-gradient(circle at 4% 0%, rgba(37, 99, 235, 0.08), transparent 28%) !important;
}

:deep(.csirt-table-card .card-title) {
  color: var(--csirt-ink);
  font-size: 1rem;
  font-weight: 900;
}

:deep(.csirt-table-card .csirt-table-body) {
  padding: 1.15rem 1.25rem 1.25rem !important;
}

.stakeholder-table-wrap {
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 14px;
  overflow: auto;
  background: var(--csirt-surface);
}

.stakeholder-table {
  --bs-table-bg: transparent;
  --bs-table-color: var(--csirt-ink);
  --bs-table-border-color: rgba(148, 163, 184, 0.16);
  --bs-table-hover-bg: rgba(37, 99, 235, 0.04);
  --bs-table-hover-color: var(--csirt-ink);
  color: var(--csirt-ink);
}

.stakeholder-table .stakeholder-thead th {
  padding: 0.9rem 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.22);
  background: #f1f5f9;
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.stakeholder-table tbody td {
  padding: 0.9rem 1rem;
  border-color: rgba(226, 232, 240, 0.72);
  vertical-align: middle;
}

.stakeholder-table tbody tr:last-child td {
  border-bottom: 0;
}

.stakeholder-row {
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.stakeholder-row:hover {
  background: rgba(37, 99, 235, 0.04);
}

.row-number {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #eef2f7;
  color: #64748b;
  font-size: 12px;
  font-weight: 850;
}

.empty-state-title {
  color: var(--csirt-ink);
}

.empty-icon-ring {
  width: 62px;
  height: 62px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: rgba(37, 99, 235, 0.1);
  color: var(--csirt-blue);
}

.empty-icon-inner i {
  font-size: 1.55rem;
}

.skeleton-row {
  display: grid;
  grid-template-columns: 48px 40px 1fr 120px 100px;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem 0;
}

.skel {
  height: 14px;
  border-radius: 999px;
  background: linear-gradient(90deg, #e2e8f0, #f8fafc, #e2e8f0);
  background-size: 180% 100%;
  animation: csirt-skeleton 1.15s linear infinite;
}

.skel-no { width: 24px; }
.skel-avatar { width: 34px; height: 34px; border-radius: 12px; }
.skel-name { width: 72%; }
.skel-badge { width: 100%; }
.skel-actions { width: 80%; }

@keyframes csirt-skeleton {
  to { background-position: -180% 0; }
}

@media (min-width: 1200px) {
  .csirt-profile-grid {
    grid-template-columns: 140px minmax(280px, 1fr) minmax(360px, 0.95fr);
    gap: 1.5rem;
  }

  .csirt-logo-column {
    grid-column: 1;
    grid-row: 1;
  }

  .csirt-identity-column {
    grid-column: 2;
    grid-row: 1;
  }

  .csirt-side-column {
    grid-column: 3;
    grid-row: 1;
  }

  .csirt-page-shell .profile-photo-wrapper {
    width: 140px !important;
    height: 140px !important;
  }

  .csirt-contact-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (min-width: 1200px) and (max-width: 1399.98px) {
  .csirt-profile-grid {
    grid-template-columns: 130px minmax(250px, 1fr) minmax(330px, 0.95fr);
  }

  .csirt-page-shell .profile-photo-wrapper {
    width: 130px !important;
    height: 130px !important;
  }

  .csirt-contact-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.modal-overlay {
  background: rgba(15, 23, 42, 0.58);
}

.sdm-modal {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 24px 16px !important;
  overflow: auto !important;
}

.sdm-modal .sdm-modal-dialog {
  width: min(800px, calc(100vw - 32px)) !important;
  max-width: 800px !important;
  height: auto !important;
  min-height: 0 !important;
  margin: 0 !important;
  display: block !important;
  background: transparent !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  overflow: visible !important;
}

.sdm-modal .modal-content {
  width: 100% !important;
  max-width: none !important;
  background: transparent !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

.sdm-modal .gradient-header-card {
  border-radius: 10px !important;
  overflow: hidden !important;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.24) !important;
}

.sdm-modal .form-item-icon {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
}

.sdm-modal .form-item-icon i {
  color: #ffffff !important;
  font-size: 1.1rem;
  line-height: 1;
}

.sdm-modal .stat-icon-orange {
  background: linear-gradient(135deg, #c2410c 0%, #f97316 52%, #fdba74 100%);
  box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);
}

.sdm-modal .stat-icon-pink {
  background: linear-gradient(135deg, #be185d 0%, #ec4899 52%, #f9a8d4 100%);
  box-shadow: 0 4px 14px rgba(236, 72, 153, 0.35);
}

:global(html[data-theme-mode="dark"]) .csirt-page-shell,
:global(html.dark) .csirt-page-shell,
.csirt-page-shell.is-dark {
  --csirt-surface: #101827;
  --csirt-surface-soft: #131d2e;
  --csirt-panel: #0b1220;
  --csirt-line: rgba(148, 163, 184, 0.18);
  --csirt-ink: #edf4ff;
  --csirt-muted: #94a3b8;
  --csirt-shadow: 0 22px 52px rgba(0, 0, 0, 0.28);
  color: var(--csirt-ink);
}

:global(html[data-theme-mode="dark"]) .csirt-hero-card,
:global(html.dark) .csirt-hero-card,
.csirt-page-shell.is-dark .csirt-hero-card {
  background:
    linear-gradient(180deg, #111827 0%, #0c1424 100%),
    radial-gradient(circle at 12% 12%, rgba(59, 130, 246, 0.13), transparent 36%),
    radial-gradient(circle at 88% 0%, rgba(20, 184, 166, 0.12), transparent 34%) !important;
  border-color: rgba(148, 163, 184, 0.17) !important;
}

:global(html[data-theme-mode="dark"]) .csirt-hero-header,
:global(html.dark) .csirt-hero-header,
.csirt-page-shell.is-dark .csirt-hero-header {
  background:
    linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 48%, #0f766e 100%) !important;
}

:global(html[data-theme-mode="dark"]) .csirt-page-shell .profile-photo-wrapper,
:global(html.dark) .csirt-page-shell .profile-photo-wrapper,
.csirt-page-shell.is-dark .profile-photo-wrapper {
  background:
    linear-gradient(135deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.98)),
    radial-gradient(circle at 50% 0%, rgba(34, 211, 238, 0.16), transparent 52%);
  border-color: rgba(148, 163, 184, 0.24);
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.36);
}

:global(html[data-theme-mode="dark"]) .csirt-contact-item,
:global(html.dark) .csirt-contact-item,
.csirt-page-shell.is-dark .csirt-contact-item {
  background: rgba(15, 23, 42, 0.62);
  border-color: rgba(148, 163, 184, 0.16);
  box-shadow: none;
}

:global(html[data-theme-mode="dark"]) .csirt-contact-item .fw-semibold,
:global(html[data-theme-mode="dark"]) .csirt-contact-item a,
:global(html.dark) .csirt-contact-item .fw-semibold,
:global(html.dark) .csirt-contact-item a,
.csirt-page-shell.is-dark .csirt-contact-item .fw-semibold,
.csirt-page-shell.is-dark .csirt-contact-item a {
  color: #e5eefb;
}

:global(html[data-theme-mode="dark"]) .csirt-status-pill,
:global(html.dark) .csirt-status-pill,
.csirt-page-shell.is-dark .csirt-status-pill {
  background: rgba(16, 185, 129, 0.15);
  color: #86efac;
}

:global(html[data-theme-mode="dark"]) .csirt-company-pill,
:global(html.dark) .csirt-company-pill,
.csirt-page-shell.is-dark .csirt-company-pill {
  background: rgba(96, 165, 250, 0.16);
  color: #bfdbfe;
}

:global(html[data-theme-mode="dark"]) .csirt-profile-title,
:global(html.dark) .csirt-profile-title,
.csirt-page-shell.is-dark .csirt-profile-title {
  color: #60a5fa;
}

:global(html[data-theme-mode="dark"]) .csirt-doc-card,
:global(html.dark) .csirt-doc-card,
.csirt-page-shell.is-dark .csirt-doc-card {
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.72), rgba(11, 18, 32, 0.86)),
    radial-gradient(circle at 0% 0%, rgba(59, 130, 246, 0.1), transparent 35%);
  border-color: rgba(148, 163, 184, 0.18);
}

:global(html[data-theme-mode="dark"]) .csirt-doc-empty,
:global(html.dark) .csirt-doc-empty,
.csirt-page-shell.is-dark .csirt-doc-empty {
  border-color: rgba(148, 163, 184, 0.26);
  color: #94a3b8;
}

.csirt-page-shell.is-dark :deep(.csirt-table-card) {
  background: #101827 !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
}

.csirt-page-shell.is-dark :deep(.csirt-table-card .csirt-table-header) {
  background:
    linear-gradient(180deg, #121c2d, #101827),
    radial-gradient(circle at 4% 0%, rgba(96, 165, 250, 0.08), transparent 28%) !important;
  border-bottom-color: rgba(148, 163, 184, 0.18) !important;
}

.csirt-page-shell.is-dark :deep(.csirt-table-card .card-title) {
  color: #e5eefb;
}

:global(html[data-theme-mode="dark"]) .stakeholder-table-wrap,
:global(html.dark) .stakeholder-table-wrap,
.csirt-page-shell.is-dark .stakeholder-table-wrap {
  background: #0b1220;
  border-color: rgba(148, 163, 184, 0.16);
}

:global(html[data-theme-mode="dark"]) .stakeholder-table,
:global(html.dark) .stakeholder-table,
.csirt-page-shell.is-dark .stakeholder-table {
  --bs-table-bg: #0b1220;
  --bs-table-color: #dbeafe;
  --bs-table-border-color: rgba(148, 163, 184, 0.12);
  --bs-table-hover-bg: rgba(59, 130, 246, 0.07);
  --bs-table-hover-color: #eff6ff;
  color: #dbeafe;
}

:global(html[data-theme-mode="dark"]) .stakeholder-table .stakeholder-thead th,
:global(html.dark) .stakeholder-table .stakeholder-thead th,
.csirt-page-shell.is-dark .stakeholder-table .stakeholder-thead th {
  background: #111827;
  border-bottom-color: rgba(148, 163, 184, 0.2);
  color: #9fb0c8;
}

:global(html[data-theme-mode="dark"]) .stakeholder-table tbody td,
:global(html.dark) .stakeholder-table tbody td,
.csirt-page-shell.is-dark .stakeholder-table tbody td {
  border-color: rgba(148, 163, 184, 0.12);
  background: transparent;
}

:global(html[data-theme-mode="dark"]) .stakeholder-row:hover,
:global(html.dark) .stakeholder-row:hover,
.csirt-page-shell.is-dark .stakeholder-row:hover {
  background: rgba(96, 165, 250, 0.065);
}

:global(html[data-theme-mode="dark"]) .row-number,
:global(html.dark) .row-number,
.csirt-page-shell.is-dark .row-number {
  background: rgba(59, 130, 246, 0.14);
  color: #bfdbfe;
}

:global(html[data-theme-mode="dark"]) .csirt-page-shell .text-muted,
:global(html.dark) .csirt-page-shell .text-muted,
.csirt-page-shell.is-dark .text-muted {
  color: #94a3b8 !important;
}

:global(html[data-theme-mode="dark"]) .csirt-stat-card .text-muted,
:global(html.dark) .csirt-stat-card .text-muted,
.csirt-page-shell.is-dark .csirt-stat-card .text-muted {
  color: rgba(255, 255, 255, 0.92) !important;
  opacity: 1;
}

:global(html[data-theme-mode="dark"]) .csirt-page-shell .bg-light,
:global(html.dark) .csirt-page-shell .bg-light,
.csirt-page-shell.is-dark .bg-light {
  background: #1e293b !important;
}

:global(html[data-theme-mode="dark"]) .csirt-page-shell .badge.bg-light,
:global(html.dark) .csirt-page-shell .badge.bg-light,
.csirt-page-shell.is-dark .badge.bg-light {
  background: rgba(148, 163, 184, 0.16) !important;
  color: #cbd5e1 !important;
}

:global(html[data-theme-mode="dark"]) .csirt-page-shell code,
:global(html.dark) .csirt-page-shell code,
.csirt-page-shell.is-dark code {
  color: #60a5fa !important;
}

:global(html[data-theme-mode="dark"]) .csirt-page-shell .bg-info-transparent,
:global(html.dark) .csirt-page-shell .bg-info-transparent,
.csirt-page-shell.is-dark .bg-info-transparent {
  background: rgba(14, 165, 233, 0.14) !important;
  color: #67e8f9 !important;
}

:global(html[data-theme-mode="dark"]) .csirt-page-shell .bg-primary-transparent,
:global(html.dark) .csirt-page-shell .bg-primary-transparent,
.csirt-page-shell.is-dark .bg-primary-transparent {
  background: rgba(59, 130, 246, 0.14) !important;
  color: #93c5fd !important;
}

:global(html[data-theme-mode="dark"]) .csirt-page-shell .bg-warning-transparent,
:global(html.dark) .csirt-page-shell .bg-warning-transparent,
.csirt-page-shell.is-dark .bg-warning-transparent {
  background: rgba(245, 158, 11, 0.15) !important;
  color: #fbbf24 !important;
}

:global(html[data-theme-mode="dark"]) .csirt-page-shell .bg-secondary-transparent,
:global(html.dark) .csirt-page-shell .bg-secondary-transparent,
.csirt-page-shell.is-dark .bg-secondary-transparent {
  background: rgba(148, 163, 184, 0.13) !important;
  color: #cbd5e1 !important;
}

:global(html[data-theme-mode="dark"]) .empty-state-title,
:global(html.dark) .empty-state-title,
.csirt-page-shell.is-dark .empty-state-title {
  color: #e5eefb;
}

:global(html[data-theme-mode="dark"]) .skel,
:global(html.dark) .skel,
.csirt-page-shell.is-dark .skel {
  background: linear-gradient(90deg, #1e293b, #263449, #1e293b);
  background-size: 180% 100%;
}

:global(html[data-theme-mode="dark"]) .modal-overlay,
:global(html.dark) .modal-overlay {
  background: rgba(2, 6, 23, 0.72) !important;
}

:global(html[data-theme-mode="dark"]) .modal-overlay .custom-card,
:global(html.dark) .modal-overlay .custom-card,
:global(html[data-theme-mode="dark"]) .modal-overlay .modal-content,
:global(html.dark) .modal-overlay .modal-content {
  background: #111827 !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: #e5eefb !important;
}

:global(html[data-theme-mode="dark"]) .modal-overlay .card-body,
:global(html.dark) .modal-overlay .card-body,
:global(html[data-theme-mode="dark"]) .modal-overlay .card-footer,
:global(html.dark) .modal-overlay .card-footer,
:global(html[data-theme-mode="dark"]) .modal-overlay .bg-white,
:global(html.dark) .modal-overlay .bg-white,
:global(html[data-theme-mode="dark"]) .modal-overlay .bg-light,
:global(html.dark) .modal-overlay .bg-light {
  background: #0f172a !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
  color: #e5eefb !important;
}

:global(html[data-theme-mode="dark"]) .modal-overlay .text-dark,
:global(html.dark) .modal-overlay .text-dark,
:global(html[data-theme-mode="dark"]) .modal-overlay .form-label,
:global(html.dark) .modal-overlay .form-label {
  color: #e5eefb !important;
}

:global(html[data-theme-mode="dark"]) .modal-overlay .form-control,
:global(html.dark) .modal-overlay .form-control,
:global(html[data-theme-mode="dark"]) .modal-overlay .form-select,
:global(html.dark) .modal-overlay .form-select,
:global(html[data-theme-mode="dark"]) .modal-overlay .form-item-input,
:global(html.dark) .modal-overlay .form-item-input,
:global(html[data-theme-mode="dark"]) .modal-overlay .form-group-split-input-card,
:global(html.dark) .modal-overlay .form-group-split-input-card,
:global(html[data-theme-mode="dark"]) .edit-logo-panel,
:global(html.dark) .edit-logo-panel,
:global(html[data-theme-mode="dark"]) .document-upload-box,
:global(html.dark) .document-upload-box {
  background: #172235 !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: #e5eefb !important;
}

:global(html[data-theme-mode="dark"]) .modal-overlay .form-control::placeholder,
:global(html.dark) .modal-overlay .form-control::placeholder,
:global(html[data-theme-mode="dark"]) .modal-overlay .form-item-input::placeholder,
:global(html.dark) .modal-overlay .form-item-input::placeholder {
  color: #64748b !important;
}

:global(html[data-theme-mode="dark"]) .modal-overlay select.form-item-input option,
:global(html.dark) .modal-overlay select.form-item-input option,
:global(html[data-theme-mode="dark"]) .modal-overlay .form-select option,
:global(html.dark) .modal-overlay .form-select option {
  background: #172235 !important;
  color: #e5eefb !important;
}

:global(html[data-theme-mode="dark"]) .sdm-modal .modal-content,
:global(html.dark) .sdm-modal .modal-content {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

/* Responsive adjustments */
@media (max-width: 991.98px) {
  .csirt-hero-body {
    padding: 1.1rem !important;
  }

  .csirt-profile-grid {
    grid-template-columns: 1fr;
    min-height: 0;
    gap: 1rem;
  }

  .csirt-logo-column,
  .csirt-identity-column,
  .csirt-side-column {
    grid-column: 1;
    grid-row: auto;
    align-items: center;
    text-align: center !important;
  }

  .csirt-title-row {
    justify-content: center;
  }

  .csirt-contact-grid {
    grid-template-columns: 1fr;
    width: 100%;
  }

  .csirt-stat-grid {
    grid-template-columns: 1fr;
    width: 100%;
  }

  .csirt-hero-header .header-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

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

<div ref="csirtPageRef" class="csirt-page-shell" :class="{ 'is-dark': isCsirtDarkMode }">
<div class="row csirt-animate">
    <div class="col-xl-12">
        <div class="card custom-card gradient-header-card stakeholders-shell-card csirt-hero-card">   
            <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3 stakeholder-header csirt-hero-header">
                <div class="d-flex align-items-center gap-3 header-inner">
                    <div class="header-icon-box">
                        <i class="ri-shield-check-line"></i>
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
                    <button @click="exportPdf" class="btn btn-danger btn-sm d-flex align-items-center gap-2">
                        <i class="ri-file-pdf-line fs-14"></i>
                        <span>Export PDF</span>
                    </button>
                </div>
            </div>

            <div class="card-body csirt-hero-body">
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
                <div v-else class="row align-items-stretch gy-4 csirt-profile-grid">
                    <div class="col-12 col-xl-auto d-flex justify-content-center justify-content-xl-start csirt-logo-column">
                        <div class="profile-photo-wrapper mb-0" style="width: 140px; height: 140px;">
                            <img :src="currentCsirt.photo_csirt" class="img-fluid profile-csirt-img" alt="Logo CSIRT"/>
                        </div>
                    </div>
                    <div class="col-12 col-xl text-center text-xl-start csirt-identity-column">
                        <h3 class="fw-bold mb-2 csirt-profile-title">{{ currentCsirt.nama_csirt }}</h3>
                        <div class="csirt-title-row">
                            <span class="csirt-status-pill">
                                <i class="ri-pulse-line"></i>
                                {{ currentCsirt.status || 'Aktif' }}
                            </span>
                            <span v-if="currentCsirt.perusahaan?.nama_perusahaan" class="csirt-company-pill">
                                <i class="ri-building-4-line"></i>
                                {{ currentCsirt.perusahaan.nama_perusahaan }}
                            </span>
                        </div>
                        <div class="csirt-contact-grid">
                            <div class="csirt-contact-item">
                                <div class="avatar avatar-sm avatar-rounded bg-primary-transparent flex-shrink-0 csirt-contact-icon">
                                    <i class="ri-phone-line fs-16"></i>
                                </div>
                                <div class="text-start">
                                    <div class="text-muted fs-11">Telepon</div>
                                    <div class="fw-semibold">{{ currentCsirt.telepon_csirt }}</div>
                                </div>
                            </div>
                            <div class="csirt-contact-item">
                                <div class="avatar avatar-sm avatar-rounded bg-info-transparent flex-shrink-0 csirt-contact-icon">
                                    <i class="ri-mail-line fs-16"></i>
                                </div>
                                <div class="text-start">
                                    <div class="text-muted fs-11">Email</div>
                                    <div class="fw-semibold">
                                        <a v-if="currentCsirt.email_csirt" :href="`mailto:${currentCsirt.email_csirt}`">{{ currentCsirt.email_csirt }}</a>
                                        <span v-else>-</span>
                                    </div>
                                </div>
                            </div>
                            <div class="csirt-contact-item">
                                <div class="avatar avatar-sm avatar-rounded bg-secondary-transparent flex-shrink-0 csirt-contact-icon">
                                    <i class="ri-global-line fs-16"></i>
                                </div>
                                <div class="text-start" style="min-width: 0;">
                                    <div class="text-muted fs-11">Website</div>
                                    <div class="fw-semibold text-break" style="word-break: break-all;">
                                        <a :href="currentCsirt.web_csirt" target="_blank">{{ currentCsirt.web_csirt }}</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-xl-5 csirt-side-column">
                        <!-- Stats strip: SDM & SE counts -->
                        <div class="csirt-stat-grid mb-3">
                            <div class="csirt-stat-card stat-blue">
                                <i class="ri-group-line fs-20"></i>
                                <div>
                                    <div class="fw-bold fs-18">{{ items.length }}</div>
                                    <div class="text-muted fs-11">SDM Terdaftar</div>
                                </div>
                                <span class="csirt-meter-fill" aria-hidden="true"></span>
                            </div>
                            <div class="csirt-stat-card stat-green">
                                <i class="ri-server-line fs-20"></i>
                                <div>
                                    <div class="fw-bold fs-18">{{ seItems.length }}</div>
                                    <div class="text-muted fs-11">SE Terdaftar</div>
                                </div>
                                <span class="csirt-meter-fill" aria-hidden="true"></span>
                            </div>
                        </div>
                        <div class="csirt-doc-card">
                            <div class="csirt-doc-body">
                                <h6 class="fw-bold mb-3 fs-13 d-flex align-items-center gap-2">
                                    <i class="ri-links-line text-primary"></i> Dokumen Pendukung
                                </h6>
                                <div class="d-flex flex-column gap-2">
                                    <button v-if="currentCsirt.file_rfc2350" @click="forceDownloadFile(currentCsirt.file_rfc2350, 'RFC2350.pdf')" class="btn btn-primary btn-sm btn-wave d-flex align-items-center justify-content-between csirt-doc-btn">
                                        <span><i class="ri-file-pdf-line me-2"></i> RFC 2350</span>
                                        <i class="ri-download-2-line opacity-50"></i>
                                    </button>
                                    <button v-if="currentCsirt.file_public_key_pgp" @click="forceDownloadFile(currentCsirt.file_public_key_pgp, 'Public_Key_PGP.asc')" class="btn btn-secondary btn-sm btn-wave d-flex align-items-center justify-content-between csirt-doc-btn">
                                        <span><i class="ri-key-2-line me-2"></i> Public Key PGP</span>
                                        <i class="ri-download-2-line opacity-50"></i>
                                    </button>
                                    <button v-if="currentCsirt.file_surat_tanda_registrasi" @click="forceDownloadFile(currentCsirt.file_surat_tanda_registrasi, 'Surat_Tanda_Registrasi.pdf')" class="btn btn-info btn-sm btn-wave d-flex align-items-center justify-content-between csirt-doc-btn">
                                        <span><i class="ri-file-pdf-line me-2"></i> Surat Tanda Registrasi</span>
                                        <i class="ri-download-2-line opacity-50"></i>
                                    </button>
                                    <div v-if="!currentCsirt.file_rfc2350 && !currentCsirt.file_public_key_pgp && !currentCsirt.file_surat_tanda_registrasi" class="csirt-doc-empty">
                                        <i class="ri-folder-warning-line"></i>
                                        <span>Belum ada dokumen pendukung.</span>
                                    </div>
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
<div class="row csirt-animate" v-if="currentCsirt">
    <div class="col-xl-12">
        <SimpleCardComponent
            title="Tabel Daftar SDM CSIRT"
            customCardClass="csirt-table-card"
            cardHeaderClass="d-flex justify-content-between align-items-center csirt-table-header"
            cardClassBody="csirt-table-body"
        >
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
                    <table class="table stakeholder-table text-nowrap mb-0">
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
                                        <button v-if="canDelete" @click="openDeleteSdmModal(row)" class="btn btn-sm btn-icon btn-wave btn-danger-light" title="Hapus">
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
<div class="row csirt-animate" v-if="currentCsirt">
    <div class="col-xl-12">
        <SimpleCardComponent
            title="Tabel Daftar SE-CSIRT"
            customCardClass="csirt-table-card"
            cardHeaderClass="d-flex justify-content-between align-items-center csirt-table-header"
            cardClassBody="csirt-table-body"
        >
            <!-- Toolbar -->
            <template #showheader>
                <div class="d-flex gap-2">
                    <button v-if="canEdit" @click="goToAddSe" class="btn btn-warning btn-sm d-flex align-items-center gap-2 btn-wave">
                        <i class="ri-add-circle-line fs-15"></i>
                        <span>Tambah SE</span>
                    </button>
                    <button @click="exportAllSePdf" class="btn btn-danger btn-sm d-flex align-items-center gap-2 btn-wave">
                        <i class="ri-file-list-3-line fs-15"></i>
                        <span>Rekap SE</span>
                    </button>
                </div>
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
                    <table class="table stakeholder-table text-nowrap mb-0">
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
                                        <button v-if="canDelete" @click="openDeleteSeModal(row)" class="btn btn-sm btn-icon btn-wave btn-danger-light" title="Hapus">
                                            <i class="ri-delete-bin-3-line"></i>
                                        </button>
                                        <button @click="exportPdfSe(row)" class="btn btn-sm btn-icon btn-wave btn-secondary-light" title="Export PDF SE">
                                            <i class="ri-file-pdf-line"></i>
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

</div>

<!-- ------------------------------------------------------------------ -->
<!-- MODAL: Tambah SDM -->
<!-- ------------------------------------------------------------------ -->
<div v-if="showCreateSdmModal" class="modal fade show d-block modal-overlay sdm-modal" tabindex="-1" @click.self="showCreateSdmModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal sdm-modal-dialog">
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
<div v-if="showEditSdmModal" class="modal fade show d-block modal-overlay sdm-modal" tabindex="-1" @click.self="showEditSdmModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal sdm-modal-dialog">
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
<div v-if="showEditProfileModal" class="modal fade show d-block modal-overlay csirt-edit-modal" tabindex="-1" @click.self="showEditProfileModal = false">
    <div class="modal-dialog modal-dialog-centered csirt-edit-dialog">
        <div class="modal-content border-0 bg-transparent">
            <div class="card custom-card gradient-header-card w-100 mb-0">
                <div class="card-header d-flex justify-content-between align-items-center gradient-header-blue">
                    <div class="d-flex align-items-center">
                        <i class="ri-edit-2-line text-white me-2 fs-18"></i>
                        <div class="card-title text-white mb-0">Edit CSIRT</div>
                    </div>
                    <button type="button" class="btn-close btn-close-white" @click="showEditProfileModal = false"></button>
                </div>
                <div class="card-body p-4 bg-white edit-profile-body">
                    <form @submit.prevent="updateProfile">
                        <div class="row gy-3">
                            <!-- Logo / Photo CSIRT -->
                            <div class="col-xl-12">
                                <div class="edit-logo-panel d-flex flex-column flex-sm-row gap-3 align-items-start">
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
                            <div class="col-12">
                                <div class="edit-section-title">
                                    <i class="ri-profile-line text-primary"></i>
                                    <span>Informasi CSIRT</span>
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
                            <!-- No Telepon & Email & Website-->
                            <div class="col-xl-6">
                                <label class="form-label fw-medium">
                                    <i class="ri-phone-line me-1 text-primary"></i>No. Telepon
                                </label>
                                <input type="text" class="form-control" v-model="profileFormData.telepon_csirt"
                                    placeholder="Contoh: 08123456789" />
                            </div>
                            <div class="col-xl-6">
                                <label class="form-label fw-medium">
                                    <i class="ri-mail-line me-1 text-primary"></i>Email
                                </label>
                                <input type="text" class="form-control" v-model="profileFormData.email_csirt"
                                    placeholder="Contoh: [EMAIL_ADDRESS]" />
                            </div>
                            <div class="col-xl-6">
                                <label class="form-label fw-medium">
                                    <i class="ri-global-line me-1 text-primary"></i>Website
                                </label>
                                <input type="text" class="form-control" v-model="profileFormData.web_csirt"
                                    placeholder="Contoh: https://csirt.id" />
                            </div>
                            <div class="col-12">
                                <div class="edit-section-title mt-2">
                                    <i class="ri-folder-upload-line text-primary"></i>
                                    <span>Dokumen Pendukung</span>
                                </div>
                            </div>
                            <!-- Dokumen RFC 2350 -->
                            <div class="col-xl-4 col-md-6">
                                <div class="document-upload-box">
                                <label class="form-label fw-medium">
                                    <i class="ri-file-pdf-line me-1 text-primary"></i>RFC 2350
                                </label>
                                <div class="input-group w-100">
                                    <input type="text" class="form-control" v-model="profileFormData.file_rfc2350"
                                        placeholder="Link atau pilih file" />
                                    <input type="file" ref="rfcFile" class="d-none" @change="handleFileUpload($event, 'rfc')" accept=".pdf" />
                                    <button class="btn btn-primary-light" type="button" @click="$refs.rfcFile.click()">
                                        <i class="ri-upload-2-line me-1"></i>Upload
                                    </button>
                                </div>
                                <div class="fs-11 text-muted mt-1">Hanya file PDF</div>
                                <div v-if="profileFormData.file_rfc2350_file" class="text-success small mt-1">
                                    <i class="ri-check-line"></i> {{ profileFormData.file_rfc2350_file.name }} siap diupload
                                </div>
                                </div>
                            </div>
                            <!-- Public Key PGP -->
                            <div class="col-xl-4 col-md-6">
                                <div class="document-upload-box">
                                <label class="form-label fw-medium">
                                    <i class="ri-key-2-line me-1 text-primary"></i>Public Key PGP
                                </label>
                                <div class="input-group w-100">
                                    <input type="text" class="form-control" v-model="profileFormData.file_public_key_pgp"
                                        placeholder="Link atau pilih file" />
                                    <input type="file" ref="pgpFile" class="d-none" @change="handleFileUpload($event, 'pgp')" accept=".asc" />
                                    <button class="btn btn-secondary-light" type="button" @click="$refs.pgpFile.click()">
                                        <i class="ri-upload-2-line me-1"></i>Upload
                                    </button>
                                </div>
                                <div class="fs-11 text-muted mt-1">Hanya file ASC</div>
                                <div v-if="profileFormData.file_public_key_pgp_file" class="text-success small mt-1">
                                    <i class="ri-check-line"></i> {{ profileFormData.file_public_key_pgp_file.name }} siap diupload
                                </div>
                                </div>
                            </div>
                            <!-- Surat Tanda Registrasi -->
                            <div class="col-xl-4 col-md-6">
                                <div class="document-upload-box">
                                <label class="form-label fw-medium">
                                    <i class="ri-file-pdf-line me-1 text-primary"></i>Surat Tanda Registrasi
                                </label>
                                <div class="input-group w-100">
                                    <input type="text" class="form-control" v-model="profileFormData.file_surat_tanda_registrasi"
                                        placeholder="Link atau pilih file" />
                                    <input type="file" ref="strFile" class="d-none" @change="handleFileUpload($event, 'str')" accept=".pdf" />
                                    <button class="btn btn-info-light" type="button" @click="$refs.strFile.click()">
                                        <i class="ri-upload-2-line me-1"></i>Upload
                                    </button>
                                </div>
                                <div class="fs-11 text-muted mt-1">Hanya file PDF</div>
                                <div v-if="profileFormData.file_surat_tanda_registrasi_file" class="text-success small mt-1">
                                    <i class="ri-check-line"></i> {{ profileFormData.file_surat_tanda_registrasi_file.name }} siap diupload
                                </div>
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
                            <!-- Email -->
                            <div class="col-md-6">
                                <label class="form-label fw-medium">Email CSIRT</label>
                                <input type="email" class="form-control" v-model="csirtFormData.email_csirt"
                                    placeholder="csirt@domain.com" />
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
                                <input type="file" class="form-control" accept=".pdf"
                                    @change="onCsirtFileChange($event, 'file_rfc2350')" />
                            </div>
                            <!-- Public Key PGP -->
                            <div class="col-md-6">
                                <label class="form-label fw-medium">File Public Key PGP</label>
                                <input type="file" class="form-control" accept=".asc"
                                    @change="onCsirtFileChange($event, 'file_public_key_pgp')" />
                            </div>
                            <!-- Surat Tanda Registrasi -->
                            <div class="col-md-6">
                                <label class="form-label fw-medium">Surat Tanda Registrasi</label>
                                <input type="file" class="form-control" accept=".pdf"
                                    @change="onCsirtFileChange($event, 'file_surat_tanda_registrasi')" />
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

  .modal.fade.show.d-block.csirt-edit-modal .modal-dialog {
    margin: 0 !important;
    min-height: 0 !important;
    height: auto !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  .modal.fade.show.d-block.sdm-modal .sdm-modal-dialog {
    width: min(800px, calc(100vw - 32px)) !important;
    max-width: 800px !important;
    margin: 0 !important;
    display: block !important;
    min-height: 0 !important;
    height: auto !important;
    background: transparent !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    overflow: visible !important;
  }
}

[data-theme-mode='dark'] .csirt-edit-modal .custom-card,
.dark .csirt-edit-modal .custom-card {
  background: #111827 !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
  color: #e5eefb !important;
}

[data-theme-mode='dark'] .csirt-edit-modal .card-body,
.dark .csirt-edit-modal .card-body {
  background: #1e293b !important;
  color: #e5eefb !important;
}

[data-theme-mode='dark'] .csirt-edit-modal .card-footer,
.dark .csirt-edit-modal .card-footer {
  background: #0b1220 !important;
  border-top-color: rgba(148, 163, 184, 0.16) !important;
}

[data-theme-mode='dark'] .csirt-edit-modal .edit-logo-panel,
[data-theme-mode='dark'] .csirt-edit-modal .document-upload-box,
.dark .csirt-edit-modal .edit-logo-panel,
.dark .csirt-edit-modal .document-upload-box {
  background: #111827 !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: #e5eefb !important;
}

[data-theme-mode='dark'] .csirt-edit-modal .photo-preview-modal,
.dark .csirt-edit-modal .photo-preview-modal {
  background: #0b1220 !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
  box-shadow: none !important;
}

[data-theme-mode='dark'] .csirt-edit-modal .form-label,
[data-theme-mode='dark'] .csirt-edit-modal h6,
[data-theme-mode='dark'] .csirt-edit-modal .edit-section-title,
.dark .csirt-edit-modal .form-label,
.dark .csirt-edit-modal h6,
.dark .csirt-edit-modal .edit-section-title {
  color: #e5eefb !important;
}

[data-theme-mode='dark'] .csirt-edit-modal .edit-section-title,
.dark .csirt-edit-modal .edit-section-title {
  border-bottom-color: rgba(148, 163, 184, 0.24) !important;
}

[data-theme-mode='dark'] .csirt-edit-modal .form-control,
.dark .csirt-edit-modal .form-control {
  background: #0b1220 !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: #e5eefb !important;
}

[data-theme-mode='dark'] .csirt-edit-modal .form-control::placeholder,
.dark .csirt-edit-modal .form-control::placeholder {
  color: #64748b !important;
}

[data-theme-mode='dark'] .csirt-edit-modal .text-muted,
.dark .csirt-edit-modal .text-muted {
  color: #94a3b8 !important;
}
</style>

<style scoped>
.warning-icon-lg {
  font-size: 3.5rem;
}
</style>
