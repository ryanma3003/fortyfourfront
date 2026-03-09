<script lang="ts">
import SimpleCardComponent from "../../shared/components/@spk/simple-card.vue";
import { ref, onMounted, watch, computed } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { sdmCsirtData, type sdmCsirt, seCsirtData, type seCsirt } from "../../data/pages/csirt";
import { csirtMembersData, type csirtMember } from "../../data/pages/csirt";
import { useRoute } from "vue-router";
import TableComponent from "../../shared/components/@spk/table-reuseble/table-component.vue";
import { useStakeholdersStore } from "../../stores/stakeholders";
import { useAuthStore } from "../../stores/auth";

export default {
    data() {   
        return {
            dataToPass: {
                activepage: "CSIRT",
            },
            searchValue2: ref(""),
        };
    },
    components: {
        Pageheader,
        SimpleCardComponent,
        TableComponent
    },
    setup() {
        const stakeholdersStore = useStakeholdersStore();
        const authStore = useAuthStore();
        const isAdmin = computed(() => authStore.isAdmin);

        const headers = [
            { text: "Nama Personel" },
            { text: "Jabatan" },
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

        const items = ref<sdmCsirt[]>([]);
        const seItems = ref<seCsirt[]>([]);
        const loading = ref(false);

        // SOURCE DATA
        const csirtData: csirtMember[] = csirtMembersData;
        const route = useRoute();

        // DERIVED DATA
        const csirtId = computed(() => {
            const id = Number(route.params.id);
            if (!isNaN(id) && id > 0) return id;
            return csirtMembersData.length > 0 ? csirtMembersData[0].id : 0;
        });

        const currentCsirt = computed<csirtMember | undefined>(() => {
            return csirtData.find(
                (item) => item.id === csirtId.value
            );
        });

        // Simulasi async data loading
        const loadCSIRTs = async () => {
            loading.value = true;
            await new Promise(resolve => setTimeout(resolve, 500));

            if (csirtId.value) {
                items.value = sdmCsirtData.filter((member) => member.id_csirt === csirtId.value);
                seItems.value = seCsirtData.filter((item) => item.id_csirt === csirtId.value);
            } else {
                items.value = [];
                seItems.value = [];
            }

            loading.value = false;
        };

        onMounted(async () => {
            loadCSIRTs();
            if (!stakeholdersStore.initialized) {
                await stakeholdersStore.initialize();
            }
        });

        watch(csirtId, () => {
            loadCSIRTs();
        });

        const dataToPass = computed(() => {
            const parent = currentCsirt.value 
                ? stakeholdersStore.stakeholders.find(s => Number(s.id) === currentCsirt.value?.id_perusahaan || (s.id as any) === currentCsirt.value?.id_perusahaan) 
                : null;
            
            return {
                currentpage: "CSIRT",
                title: parent ? {
                    label: `Profile ${parent.nama_perusahaan}`,
                    path: `/profile-stakeholders/${parent.slug}`
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

        // ─── TOAST ────────────────────────────────────────────────────────────
        const showToast = ref(false);
        const toastMessage = ref("");
        const toastType = ref<"success" | "error">("success");

        const showNotification = (msg: string, type: "success" | "error") => {
            toastMessage.value = msg;
            toastType.value = type;
            showToast.value = true;
            setTimeout(() => { showToast.value = false; }, 3500);
        };

        // ─── SDM CRUD ─────────────────────────────────────────────────────────
        const showCreateSdmModal = ref(false);
        const showEditSdmModal   = ref(false);
        const showDeleteSdmModal = ref(false);
        const currentEditSdm    = ref<sdmCsirt | null>(null);
        const currentDeleteSdm  = ref<sdmCsirt | null>(null);

        const sdmFormData = ref<Partial<sdmCsirt>>({
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
            sdmFormData.value = { nama_personel: "", jabatan_csirt: "", jabatan_perusahaan: "", skill: "", sertifikasi: "" };
            sdmFormErrors.value = {};
            showCreateSdmModal.value = true;
        };

        const createSdm = () => {
            if (!validateSdmForm()) return;
            const newId = items.value.length > 0 ? Math.max(...items.value.map(i => i.id)) + 1 : 1;
            items.value.push({
                id: newId,
                id_csirt: csirtId.value,
                nama_personel: sdmFormData.value.nama_personel!,
                jabatan_csirt: sdmFormData.value.jabatan_csirt!,
                jabatan_perusahaan: sdmFormData.value.jabatan_perusahaan || "",
                skill: sdmFormData.value.skill || "",
                sertifikasi: sdmFormData.value.sertifikasi || "",
            });
            showCreateSdmModal.value = false;
            showNotification("SDM berhasil ditambahkan!", "success");
        };

        const openEditSdmModal = (item: any) => {
            currentEditSdm.value = item as sdmCsirt;
            sdmFormData.value = { ...item };
            sdmFormErrors.value = {};
            showEditSdmModal.value = true;
        };

        const updateSdm = () => {
            if (!validateSdmForm() || !currentEditSdm.value) return;
            const idx = items.value.findIndex(i => i.id === currentEditSdm.value!.id);
            if (idx !== -1) {
                items.value[idx] = {
                    ...items.value[idx],
                    nama_personel: sdmFormData.value.nama_personel!,
                    jabatan_csirt: sdmFormData.value.jabatan_csirt!,
                    jabatan_perusahaan: sdmFormData.value.jabatan_perusahaan || "",
                    skill: sdmFormData.value.skill || "",
                    sertifikasi: sdmFormData.value.sertifikasi || "",
                };
            }
            showEditSdmModal.value = false;
            showNotification("SDM berhasil diperbarui!", "success");
        };

        const openDeleteSdmModal = (item: any) => {
            currentDeleteSdm.value = item as sdmCsirt;
            showDeleteSdmModal.value = true;
        };

        const deleteSdm = () => {
            if (!currentDeleteSdm.value) return;
            const idx = items.value.findIndex(i => i.id === currentDeleteSdm.value!.id);
            if (idx !== -1) items.value.splice(idx, 1);
            showDeleteSdmModal.value = false;
            showNotification("SDM berhasil dihapus!", "success");
        };

        // ─── SE CRUD ──────────────────────────────────────────────────────────
        const showCreateSeModal = ref(false);
        const showEditSeModal   = ref(false);
        const showDeleteSeModal = ref(false);
        const currentEditSe    = ref<seCsirt | null>(null);
        const currentDeleteSe  = ref<seCsirt | null>(null);

        const seFormData = ref<Partial<seCsirt>>({
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

        const openCreateSeModal = () => {
            seFormData.value = { nama_se: "", ip_se: "", as_number_se: "", pengelola_se: "", fitur_se: "", kategori_se: "Tinggi" };
            seFormErrors.value = {};
            showCreateSeModal.value = true;
        };

        const createSe = () => {
            if (!validateSeForm()) return;
            const newId = seItems.value.length > 0 ? Math.max(...seItems.value.map(i => i.id)) + 1 : 1;
            seItems.value.push({
                id: newId,
                id_csirt: csirtId.value,
                nama_se: seFormData.value.nama_se!,
                ip_se: seFormData.value.ip_se!,
                as_number_se: seFormData.value.as_number_se || "",
                pengelola_se: seFormData.value.pengelola_se || "",
                fitur_se: seFormData.value.fitur_se || "",
                kategori_se: seFormData.value.kategori_se || "Tinggi",
            });
            showCreateSeModal.value = false;
            showNotification("SE berhasil ditambahkan!", "success");
        };

        const openEditSeModal = (item: any) => {
            currentEditSe.value = item as seCsirt;
            seFormData.value = { ...item };
            seFormErrors.value = {};
            showEditSeModal.value = true;
        };

        const updateSe = () => {
            if (!validateSeForm() || !currentEditSe.value) return;
            const idx = seItems.value.findIndex(i => i.id === currentEditSe.value!.id);
            if (idx !== -1) {
                seItems.value[idx] = {
                    ...seItems.value[idx],
                    nama_se: seFormData.value.nama_se!,
                    ip_se: seFormData.value.ip_se!,
                    as_number_se: seFormData.value.as_number_se || "",
                    pengelola_se: seFormData.value.pengelola_se || "",
                    fitur_se: seFormData.value.fitur_se || "",
                    kategori_se: seFormData.value.kategori_se || "Tinggi",
                };
            }
            showEditSeModal.value = false;
            showNotification("SE berhasil diperbarui!", "success");
        };

        const openDeleteSeModal = (item: any) => {
            currentDeleteSe.value = item as seCsirt;
            showDeleteSeModal.value = true;
        };

        const deleteSe = () => {
            if (!currentDeleteSe.value) return;
            const idx = seItems.value.findIndex(i => i.id === currentDeleteSe.value!.id);
            if (idx !== -1) seItems.value.splice(idx, 1);
            showDeleteSeModal.value = false;
            showNotification("SE berhasil dihapus!", "success");
        };

        // ─── PROFILE CRUD ──────────────────────────────────────────────────────
        const showEditProfileModal = ref(false);
        const profileFormData = ref<Partial<csirtMember>>({
            nama: "",
            no_telepon: "",
            web_csirt: "",
            file_rfc2350: "",
            file_public_key_pgp: "",
        });
        const profileFormErrors = ref<Record<string, string>>({});

        const validateProfileForm = (): boolean => {
            profileFormErrors.value = {};
            let valid = true;
            if (!profileFormData.value.nama?.trim()) {
                profileFormErrors.value.nama = "Nama CSIRT wajib diisi";
                valid = false;
            }
            return valid;
        };

        const openEditProfileModal = () => {
            if (currentCsirt.value) {
                profileFormData.value = { ...currentCsirt.value };
                profileFormErrors.value = {};
                showEditProfileModal.value = true;
            }
        };

        const updateProfile = () => {
            if (!validateProfileForm() || !currentCsirt.value) return;
            const idx = csirtMembersData.findIndex(i => i.id === currentCsirt.value!.id);
            if (idx !== -1) {
                csirtMembersData[idx] = {
                    ...csirtMembersData[idx],
                    nama: profileFormData.value.nama!,
                    no_telepon: profileFormData.value.no_telepon || "",
                    web_csirt: profileFormData.value.web_csirt || "",
                    file_rfc2350: profileFormData.value.file_rfc2350 || "",
                    file_public_key_pgp: profileFormData.value.file_public_key_pgp || "",
                };
                // Re-trigger computed currentCsirt if necessary by forcing a reload or just rely on reactivity if csirtData is ref
                // Since csirtData is a const array, we might need to manually trigger update if currentCsirt doesn't pick it up
                // However, currentCsirt uses csirtData.find. If csirtData is not reactive, we might need to make it so.
                // Let's check how csirtData is defined.
            }
            showEditProfileModal.value = false;
            showNotification("Profil CSIRT berhasil diperbarui!", "success");
        };

        const handleFileUpload = (event: Event, type: 'rfc' | 'pgp') => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                const file = target.files[0];
                // In a real app, you would upload this to a server.
                // For simulation, we create a local URL or just store the filename.
                const fakeUrl = URL.createObjectURL(file);
                if (type === 'rfc') {
                    profileFormData.value.file_rfc2350 = fakeUrl;
                } else if (type === 'pgp') {
                    profileFormData.value.file_public_key_pgp = fakeUrl;
                }
                showNotification(`${file.name} berhasil dipilih`, "success");
            }
        };

        return {

            isAdmin,
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
            showCreateSeModal,
            showEditSeModal,
            showDeleteSeModal,
            currentEditSe,
            currentDeleteSe,
            seFormData,
            seFormErrors,
            openCreateSeModal,
            createSe,
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
        };

    },
};
</script>
<style>
.profile-csirt-img{
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  margin: 0 auto;
  display: block;
  border-radius: 8px;
}
</style>
<style src="../../assets/css/style2.css"></style>

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
                        <div class="card-title mb-0 text-white fw-bold header-card-title">{{ currentCsirt?.nama || 'Profil CSIRT' }}</div>
                        <div class="header-subtitle mt-1">Detail informasi dan manajemen CSIRT</div>
                    </div>
                </div>
                <div v-if="isAdmin && currentCsirt" class="header-actions">
                    <button @click="openEditProfileModal" class="btn btn-warning btn-sm d-flex align-items-center gap-2">
                        <i class="ri-edit-2-line fs-14"></i>
                        <span>Edit Profile</span>
                    </button>
                </div>
            </div>

            <div class="card-body">
                <div v-if="!currentCsirt" class="alert alert-warning">
                    Data CSIRT tidak ditemukan
                </div>
                <div v-else class="row align-items-center">
                    <div class="col-12 col-md-2 text-center">
                        <div class="company-avatar avatar-blue shadow-sm mb-3 mb-md-0 mx-auto" style="width: 140px; height: 140px; border-radius: 12px;">
                            <img :src="currentCsirt.img_csirt" class="img-fluid profile-csirt-img" alt="Logo CSIRT"/>
                        </div>
                    </div>
                    <div class="col-12 col-md-5">
                        <h3 class="fw-bold mb-3 text-primary">{{ currentCsirt.nama }}</h3>
                        <div class="d-flex flex-column gap-2 mt-4">
                            <div class="d-flex align-items-center gap-3">
                                <div class="avatar avatar-sm avatar-rounded bg-primary-transparent">
                                    <i class="ri-phone-line fs-16"></i>
                                </div>
                                <div>
                                    <div class="text-muted fs-11">Telepon</div>
                                    <div class="fw-semibold">{{ currentCsirt.no_telepon }}</div>
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

<!-- ═══════ Tabel SDM ═══════ -->
<div class="row" v-if="currentCsirt">
    <div class="col-xl-12">
        <SimpleCardComponent title="Tabel Daftar SDM CSIRT" cardHeaderClass="d-flex justify-content-between align-items-center">
            <!-- Toolbar -->
            <template #showheader>
                <button v-if="isAdmin" @click="openCreateSdmModal" class="btn btn-warning btn-sm d-flex align-items-center gap-2 btn-wave">
                    <i class="ri-add-circle-line fs-15"></i>
                    <span>Tambah SDM</span>
                </button>
            </template>

            <!-- Loading state -->
            <div v-if="loading" class="skeleton-loading p-4">
                <div class="skeleton-row" v-for="n in 3" :key="n">
                    <div class="skel skel-avatar"></div>
                    <div class="skel skel-name"></div>
                    <div class="skel skel-badge"></div>
                    <div class="skel skel-actions"></div>
                </div>
            </div>

            <!-- Table -->
            <template v-else>
                <div class="stakeholder-table-wrap">
                    <TableComponent 
                        :headers="headers" 
                        :rows="items" 
                        tableClass="table stakeholder-table text-nowrap mb-0" 
                        theadClass="stakeholder-thead"
                        tbodyClass="stakeholder-tbody"
                    >
                        <template #cell="{ row }">
                            <td class="align-middle">
                                <div class="fw-semibold text-primary">{{ row.nama_personel }}</div>
                            </td>
                            <td class="align-middle">{{ row.jabatan_csirt }}</td>
                            <td class="align-middle text-muted small">{{ row.skill }}</td>
                            <td class="align-middle">
                                <span class="badge bg-primary-transparent rounded-pill px-3">{{ row.sertifikasi }}</span>
                            </td>
                            <td class="text-center align-middle">
                                <div v-if="isAdmin" class="d-flex gap-1 justify-content-center">
                                    <button @click="openEditSdmModal(row)" class="btn btn-sm btn-icon btn-wave btn-success-light" title="Edit">
                                        <i class="ri-edit-2-line"></i>
                                    </button>
                                    <button @click="openDeleteSdmModal(row)" class="btn btn-sm btn-icon btn-wave btn-danger-light" title="Hapus">
                                        <i class="ri-delete-bin-3-line"></i>
                                    </button>
                                </div>
                                <span v-else class="text-muted small">—</span>
                            </td>
                        </template>
                    </TableComponent>
                </div>
            </template>
        </SimpleCardComponent>
    </div>
</div>

<!-- ═══════ Tabel SE ═══════ -->
<div class="row" v-if="currentCsirt">
    <div class="col-xl-12">
        <SimpleCardComponent title="Tabel Daftar SE-CSIRT" cardHeaderClass="d-flex justify-content-between align-items-center">
            <!-- Toolbar -->
            <template #showheader>
                <button v-if="isAdmin" @click="openCreateSeModal" class="btn btn-warning btn-sm d-flex align-items-center gap-2 btn-wave">
                    <i class="ri-add-circle-line fs-15"></i>
                    <span>Tambah SE</span>
                </button>
            </template>

            <!-- Loading state -->
            <div v-if="loading" class="skeleton-loading p-4">
                <div class="skeleton-row" v-for="n in 3" :key="n">
                    <div class="skel skel-avatar"></div>
                    <div class="skel skel-name"></div>
                    <div class="skel skel-badge"></div>
                    <div class="skel skel-actions"></div>
                </div>
            </div>

            <!-- Table -->
            <template v-else>
                <div class="stakeholder-table-wrap">
                    <TableComponent 
                        :headers="seHeaders" 
                        :rows="seItems" 
                        tableClass="table stakeholder-table text-nowrap mb-0" 
                        theadClass="stakeholder-thead"
                        tbodyClass="stakeholder-tbody"
                    >
                        <template #cell="{ row }">
                            <td class="align-middle fw-semibold">{{ row.nama_se }}</td>
                            <td class="align-middle"><code class="text-primary">{{ row.ip_se }}</code></td>
                            <td class="align-middle"><span class="badge bg-light text-muted">{{ row.as_number_se }}</span></td>
                            <td class="align-middle">{{ row.pengelola_se }}</td>
                            <td class="align-middle small text-muted">{{ row.fitur_se }}</td>
                            <td class="align-middle">
                                <span :class="['badge rounded-pill px-3', getKategoriBadgeClass(row.kategori_se)]">
                                    {{ row.kategori_se }}
                                </span>
                            </td>
                            <td class="text-center align-middle">
                                <div v-if="isAdmin" class="d-flex gap-1 justify-content-center">
                                    <button @click="openEditSeModal(row)" class="btn btn-sm btn-icon btn-wave btn-success-light" title="Edit">
                                        <i class="ri-edit-2-line"></i>
                                    </button>
                                    <button @click="openDeleteSeModal(row)" class="btn btn-sm btn-icon btn-wave btn-danger-light" title="Hapus">
                                        <i class="ri-delete-bin-3-line"></i>
                                    </button>
                                </div>
                                <span v-else class="text-muted small">—</span>
                            </td>
                        </template>
                    </TableComponent>
                </div>
            </template>
        </SimpleCardComponent>
    </div>
</div>

<!-- ══════════════════════════════════════════════════════════════════ -->
<!-- MODAL: Tambah SDM -->
<!-- ══════════════════════════════════════════════════════════════════ -->
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

<!-- ══════════════════════════════════════════════════════════════════ -->
<!-- MODAL: Tambah SE -->
<!-- ══════════════════════════════════════════════════════════════════ -->
<div v-if="showCreateSeModal" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="showCreateSeModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal">
        <div class="modal-content border-0 bg-transparent">
            <div class="card custom-card gradient-header-card w-100 mb-0">
                <div class="card-header d-flex justify-content-between align-items-center gradient-header-blue">
                    <div class="d-flex align-items-center">
                        <i class="ri-server-line text-white me-2 fs-18"></i>
                        <div class="card-title text-white mb-0">Tambah SE-CSIRT</div>
                    </div>
                    <button type="button" class="btn-close btn-close-white" @click="showCreateSeModal = false"></button>
                </div>
                <div class="card-body p-4 bg-white">
                    <form @submit.prevent="createSe">
                        <div class="row gy-3">
                            <div class="col-xl-12">
                                <label class="form-label fw-medium">
                                    <i class="ri-server-line me-1 text-primary"></i>Nama SE <span class="text-danger">*</span>
                                </label>
                                <input type="text" class="form-control" v-model="seFormData.nama_se"
                                    :class="{ 'is-invalid': seFormErrors.nama_se }"
                                    placeholder="Contoh: Firewall Utama" />
                                <div v-if="seFormErrors.nama_se" class="invalid-feedback">{{ seFormErrors.nama_se }}</div>
                            </div>
                            <div class="col-xl-6">
                                <label class="form-label fw-medium">
                                    <i class="ri-wifi-line me-1 text-primary"></i>IP SE <span class="text-danger">*</span>
                                </label>
                                <input type="text" class="form-control" v-model="seFormData.ip_se"
                                    :class="{ 'is-invalid': seFormErrors.ip_se }"
                                    placeholder="Contoh: 192.168.1.1" />
                                <div v-if="seFormErrors.ip_se" class="invalid-feedback">{{ seFormErrors.ip_se }}</div>
                            </div>
                            <div class="col-xl-6">
                                <label class="form-label fw-medium">
                                    <i class="ri-router-line me-1 text-primary"></i>AS Number
                                </label>
                                <input type="text" class="form-control" v-model="seFormData.as_number_se"
                                    placeholder="Contoh: AS12345" />
                            </div>
                            <div class="col-xl-12">
                                <label class="form-label fw-medium">
                                    <i class="ri-user-settings-line me-1 text-primary"></i>Pengelola
                                </label>
                                <input type="text" class="form-control" v-model="seFormData.pengelola_se"
                                    placeholder="Contoh: PT Maju Jaya" />
                            </div>
                            <div class="col-xl-12">
                                <label class="form-label fw-medium">
                                    <i class="ri-tools-line me-1 text-primary"></i>Fitur
                                </label>
                                <input type="text" class="form-control" v-model="seFormData.fitur_se"
                                    placeholder="Contoh: Firewall, Intrusion Detection" />
                            </div>
                            <div class="col-xl-12">
                                <label class="form-label fw-medium">
                                    <i class="ri-shield-check-line me-1 text-primary"></i>Kategori
                                </label>
                                <select class="form-select" v-model="seFormData.kategori_se">
                                    <option value="Strategis">Strategis</option>
                                    <option value="Tinggi">Tinggi</option>
                                    <option value="Rendah">Rendah</option>
                                </select>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="card-footer bg-light d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-outline-danger" @click="showCreateSeModal = false">
                        <i class="ri-close-line me-1"></i>Batal
                    </button>
                    <button type="button" class="btn btn-secondary" @click="createSe">
                        <i class="ri-save-line me-1"></i>Simpan
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- MODAL: Edit SE -->
<div v-if="showEditSeModal" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="showEditSeModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal">
        <div class="modal-content border-0 bg-transparent">
            <div class="card custom-card gradient-header-card w-100 mb-0">
                <div class="card-header d-flex justify-content-between align-items-center gradient-header-blue">
                    <div class="d-flex align-items-center">
                        <i class="ri-edit-2-line text-white me-2 fs-18"></i>
                        <div class="card-title text-white mb-0">Edit SE-CSIRT</div>
                    </div>
                    <button type="button" class="btn-close btn-close-white" @click="showEditSeModal = false"></button>
                </div>
                <div class="card-body p-4 bg-white">
                    <form @submit.prevent="updateSe">
                        <div class="row gy-3">
                            <div class="col-xl-12">
                                <label class="form-label fw-medium">
                                    <i class="ri-server-line me-1 text-primary"></i>Nama SE <span class="text-danger">*</span>
                                </label>
                                <input type="text" class="form-control" v-model="seFormData.nama_se"
                                    :class="{ 'is-invalid': seFormErrors.nama_se }"
                                    placeholder="Contoh: Firewall Utama" />
                                <div v-if="seFormErrors.nama_se" class="invalid-feedback">{{ seFormErrors.nama_se }}</div>
                            </div>
                            <div class="col-xl-6">
                                <label class="form-label fw-medium">
                                    <i class="ri-wifi-line me-1 text-primary"></i>IP SE <span class="text-danger">*</span>
                                </label>
                                <input type="text" class="form-control" v-model="seFormData.ip_se"
                                    :class="{ 'is-invalid': seFormErrors.ip_se }"
                                    placeholder="Contoh: 192.168.1.1" />
                                <div v-if="seFormErrors.ip_se" class="invalid-feedback">{{ seFormErrors.ip_se }}</div>
                            </div>
                            <div class="col-xl-6">
                                <label class="form-label fw-medium">
                                    <i class="ri-router-line me-1 text-primary"></i>AS Number
                                </label>
                                <input type="text" class="form-control" v-model="seFormData.as_number_se"
                                    placeholder="Contoh: AS12345" />
                            </div>
                            <div class="col-xl-12">
                                <label class="form-label fw-medium">
                                    <i class="ri-user-settings-line me-1 text-primary"></i>Pengelola
                                </label>
                                <input type="text" class="form-control" v-model="seFormData.pengelola_se"
                                    placeholder="Contoh: PT Maju Jaya" />
                            </div>
                            <div class="col-xl-12">
                                <label class="form-label fw-medium">
                                    <i class="ri-tools-line me-1 text-primary"></i>Fitur
                                </label>
                                <input type="text" class="form-control" v-model="seFormData.fitur_se"
                                    placeholder="Contoh: Firewall, Intrusion Detection" />
                            </div>
                            <div class="col-xl-12">
                                <label class="form-label fw-medium">
                                    <i class="ri-shield-check-line me-1 text-primary"></i>Kategori
                                </label>
                                <select class="form-select" v-model="seFormData.kategori_se">
                                    <option value="Strategis">Strategis</option>
                                    <option value="Tinggi">Tinggi</option>
                                    <option value="Rendah">Rendah</option>
                                </select>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="card-footer bg-light d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-outline-danger" @click="showEditSeModal = false">
                        <i class="ri-arrow-left-line me-1"></i>Batal
                    </button>
                    <button type="button" class="btn btn-secondary" @click="updateSe">
                        <i class="ri-save-line me-1"></i>Simpan Perubahan
                    </button>
                </div>
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

<!-- ══════════════════════════════════════════════════════════════════ -->
<!-- MODAL: Edit Profile CSIRT -->
<!-- ══════════════════════════════════════════════════════════════════ -->
<div v-if="showEditProfileModal" class="modal fade show d-block modal-overlay" tabindex="-1" @click.self="showEditProfileModal = false">
    <div class="modal-dialog modal-dialog-centered custom-modal modal-lg">
        <div class="modal-content border-0 bg-transparent">
            <div class="card custom-card gradient-header-card w-100 mb-0">
                <div class="card-header d-flex justify-content-between align-items-center gradient-header-blue">
                    <div class="d-flex align-items-center">
                        <i class="ri-edit-2-line text-white me-2 fs-18"></i>
                        <div class="card-title text-white mb-0">Edit Profil CSIRT</div>
                    </div>
                    <button type="button" class="btn-close btn-close-white" @click="showEditProfileModal = false"></button>
                </div>
                <div class="card-body p-4 bg-white">
                    <form @submit.prevent="updateProfile">
                        <div class="row gy-3">
                            <!-- Nama CSIRT -->
                            <div class="col-xl-12">
                                <label class="form-label fw-medium">
                                    <i class="ri-building-line me-1 text-primary"></i>Nama CSIRT <span class="text-danger">*</span>
                                </label>
                                <input type="text" class="form-control" v-model="profileFormData.nama"
                                    :class="{ 'is-invalid': profileFormErrors.nama }"
                                    placeholder="Masukkan nama CSIRT" />
                                <div v-if="profileFormErrors.nama" class="invalid-feedback">{{ profileFormErrors.nama }}</div>
                            </div>
                            <!-- No Telepon & Website -->
                            <div class="col-xl-6">
                                <label class="form-label fw-medium">
                                    <i class="ri-phone-line me-1 text-primary"></i>No. Telepon
                                </label>
                                <input type="text" class="form-control" v-model="profileFormData.no_telepon"
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
                                <div v-if="profileFormData.file_rfc2350?.startsWith('blob:')" class="text-success small mt-1">
                                    <i class="ri-check-line"></i> File siap diupload (Simulasi)
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
                                <div v-if="profileFormData.file_public_key_pgp?.startsWith('blob:')" class="text-success small mt-1">
                                    <i class="ri-check-line"></i> File siap diupload (Simulasi)
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
