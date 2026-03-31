<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useProfileStore } from "@/stores/profile";
import { useIkasStore } from "@/stores/ikas";
import { useKseStore } from "@/stores/kse";
import { useStakeholdersStore } from "@/stores/stakeholders";
import { useCsirtStore } from "@/stores/csirt";
import RadarChartIkas from '@/shared/components/@spk/charts/ikas-charts.vue';

const router = useRouter();
const authStore = useAuthStore();
const profileStore = useProfileStore();
const ikasStore = useIkasStore();
const kseStore = useKseStore();
const stakeholdersStore = useStakeholdersStore();
const csirtStore = useCsirtStore();

const userSlug = ref('');
const ikasFilled = ref(false);
const kseFilled = ref(false);
const kseCategory = ref('');
const kseColor = ref('');

// Company profile data
const companyName = ref('');
const companySubSektor = ref('');
const companyAlamat = ref('');
const companyEmail = ref('');
const companyTelepon = ref('');
const companyPhoto = ref('');
const companyLoaded = ref(false);

// CSIRT status
const hasCsirt = ref(false);
const csirtName = ref('');
const sdmCount = ref(0);
const seCount = ref(0);

const navigateToIkas = () => {
    if (userSlug.value) {
        router.push(`/ikas-crud?slug=${userSlug.value}&source=dashboard`);
    } else {
        console.error("User slug not found");
    }
};

const navigateToCsirt = () => {
    router.push('/csirt');
};

// --- TAMBAH CSIRT FLOW IN DASHBOARD ---
const showAddCsirtModal = ref(false);
const csirtFormLoading = ref(false);
const csirtFormError = ref('');
const csirtFormSuccess = ref(false);

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
    const idPerusahaan = profileStore.idPerusahaan || authStore.currentUser?.id_perusahaan;
    
    if (!validateCsirtForm()) {
        console.warn("CSIRT Form validation failed", csirtFormErrors.value);
        return;
    }
    
    if (!idPerusahaan) {
        csirtFormError.value = "ID Perusahaan tidak ditemukan pada akun Anda.";
        console.error("Missing id_perusahaan in authStore.currentUser");
        return;
    }
    
    csirtFormLoading.value = true;
    csirtFormError.value = '';
    
    try {
        const result = await csirtStore.createCsirt({
            id_perusahaan       : Number(idPerusahaan),
            nama_csirt          : csirtFormData.value.nama_csirt,
            web_csirt           : csirtFormData.value.web_csirt,
            telepon_csirt       : csirtFormData.value.telepon_csirt,
            photo_csirt         : csirtFormData.value.photo_csirt || "",
            file_rfc2350        : csirtFormData.value.file_rfc2350 || "",
            file_public_key_pgp : csirtFormData.value.file_public_key_pgp || "",
        });
        
        if (result.success) {
            csirtFormSuccess.value = true;
            setTimeout(() => {
                showAddCsirtModal.value = false;
                // Refresh dashboard state
                const created = result.data as any;
                if (created) {
                    hasCsirt.value = true;
                    csirtName.value = created.nama_csirt || csirtFormData.value.nama_csirt;
                    sdmCount.value = 0;
                    seCount.value = 0;
                }
            }, 1500);
        } else {
            csirtFormError.value = result.error || 'Gagal mendaftarkan CSIRT.';
            console.error("API Error creating CSIRT:", result.error);
        }
    } catch (err: any) {
        csirtFormError.value = err?.message || 'Terjadi kesalahan sistem.';
        console.error("Exception in submitAddCsirt:", err);
    } finally {
        csirtFormLoading.value = false;
    }
};

onMounted(async () => {
    if (authStore.currentUser?.id) {
        try {
            // First fetch the latest profile to ensure id_perusahaan is populated from relations
            await profileStore.fetchFromApi();
            
            // Initialize stores
            ikasStore.initialize();
            kseStore.initialize();
            await stakeholdersStore.initialize();
            await csirtStore.initialize();
            
            // Read slug from login session data (no extra API call needed)
            const slug = authStore.currentUser.slug;
            if (slug) {
                userSlug.value = slug;
                
                // Check IKAS Progress
                const progress = ikasStore.getOverallProgress(slug);
                ikasFilled.value = progress.percent > 0;
                
                // Check KSE Status
                const kseData = kseStore.getKseData(slug);
                if (kseData && kseData.kategoriSE && kseData.kategoriSE !== 'Belum Dikategorikan') {
                    kseFilled.value = true;
                    kseCategory.value = kseData.kategoriSE;
                    kseColor.value = kseData.kategoriColor;
                } else {
                    kseFilled.value = false;
                    kseCategory.value = "Belum Dikategorikan";
                    kseColor.value = "#6c757d";
                }
            }

            // Load company profile from id_perusahaan
            const idPerusahaan = profileStore.idPerusahaan || authStore.currentUser.id_perusahaan;
            if (idPerusahaan) {
                const stakeholder = stakeholdersStore.getStakeholderById(String(idPerusahaan));
                if (stakeholder) {
                    companyName.value = stakeholder.nama_perusahaan || '';
                    companySubSektor.value = stakeholder.sub_sektor?.nama_sub_sektor || '';
                    companyAlamat.value = stakeholder.alamat || '';
                    companyEmail.value = stakeholder.email || '';
                    companyTelepon.value = stakeholder.telepon || '';
                    companyPhoto.value = stakeholder.photo || '';
                    companyLoaded.value = true;
                }

                // Check CSIRT status for this company
                const csirt = csirtStore.csirts.find(c =>
                    String(c.id_perusahaan) === String(idPerusahaan) ||
                    String((c).perusahaan?.id) === String(idPerusahaan)
                );
                if (csirt) {
                    hasCsirt.value = true;
                    csirtName.value = csirt.nama_csirt;
                    const csirtId = String(csirt.id);
                    sdmCount.value = csirtStore.sdmList.filter(
                        s => String(s.id_csirt) === csirtId || String((s).csirt?.id) === csirtId
                    ).length;
                    seCount.value = csirtStore.seList.filter(
                        s => String(s.id_csirt) === csirtId || String((s).csirt?.id) === csirtId
                    ).length;
                }
            }
        } catch (error) {
            console.error("Error loading user dashboard data:", error);
        }
    }
});
</script>

<template>
    <div>
        <!-- Header User -->
        <div class="d-flex align-items-center justify-content-between mb-3 page-header-breadcrumb">
             <div>
                <h1 class="page-title fw-medium fs-20 mb-0">Dashboard Data Keamanan</h1>
            </div>
        </div>

        <!-- Company Profile Card -->
        <div v-if="companyLoaded" class="row g-3 mb-3">
            <div class="col-12">
                <div class="card custom-card overflow-hidden">
                    <div class="card-body p-0">
                        <div class="d-flex flex-wrap align-items-center">
                            <!-- Company Info -->
                            <div class="d-flex align-items-center gap-3 p-4 flex-grow-1">
                                <div class="flex-shrink-0">
                                    <div v-if="companyPhoto" class="avatar avatar-xxl bg-light rounded-3 overflow-hidden border" style="width: 72px; height: 72px;">
                                        <img :src="companyPhoto" :alt="companyName" class="img-fluid" style="object-fit: contain; width: 100%; height: 100%; padding: 6px;" />
                                    </div>
                                    <div v-else class="avatar avatar-xxl bg-primary-transparent rounded-3 d-flex align-items-center justify-content-center" style="width: 72px; height: 72px;">
                                        <i class="ri-building-2-line fs-28 text-primary"></i>
                                    </div>
                                </div>
                                <div>
                                    <h4 class="fw-bold mb-1 text-dark">{{ companyName }}</h4>
                                    <span v-if="companySubSektor" class="badge bg-primary-transparent text-primary rounded-pill px-3 py-1 fs-12">
                                        <i class="ri-price-tag-3-line me-1"></i>{{ companySubSektor }}
                                    </span>
                                    <div class="d-flex flex-wrap gap-3 mt-2 text-muted fs-13">
                                        <span v-if="companyAlamat" class="d-flex align-items-center gap-1">
                                            <i class="ri-map-pin-line text-primary"></i> {{ companyAlamat }}
                                        </span>
                                        <span v-if="companyEmail" class="d-flex align-items-center gap-1">
                                            <i class="ri-mail-line text-primary"></i> {{ companyEmail }}
                                        </span>
                                        <span v-if="companyTelepon" class="d-flex align-items-center gap-1">
                                            <i class="ri-phone-line text-primary"></i> {{ companyTelepon }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <!-- CSIRT Quick Status -->
                            <div class="d-flex align-items-center gap-3 p-4 border-start flex-shrink-0">
                                <div class="text-center">
                                    <div v-if="hasCsirt" class="d-flex flex-column align-items-center gap-2">
                                        <span class="badge bg-success-transparent text-success rounded-pill px-3 py-2 fs-12 fw-medium">
                                            <i class="ri-shield-check-line me-1"></i>CSIRT Terdaftar
                                        </span>
                                        <span class="fw-semibold fs-13 text-dark">{{ csirtName }}</span>
                                        <div class="d-flex gap-3 mt-1">
                                            <span class="text-muted fs-12"><i class="ri-group-line me-1 text-primary"></i>SDM: <b>{{ sdmCount }}</b></span>
                                            <span class="text-muted fs-12"><i class="ri-server-line me-1 text-success"></i>SE: <b>{{ seCount }}</b></span>
                                        </div>
                                        <button @click="navigateToCsirt" class="btn btn-sm btn-outline-primary rounded-pill mt-1 px-3">
                                            <i class="ri-arrow-right-line me-1"></i>Kelola CSIRT
                                        </button>
                                    </div>
                                    <div v-else class="d-flex flex-column align-items-center gap-2">
                                        <span class="badge bg-warning-transparent text-warning rounded-pill px-3 py-2 fs-12 fw-medium">
                                            <i class="ri-shield-line me-1"></i>CSIRT Belum Terdaftar
                                        </span>
                                        <button @click="openAddCsirtModal" class="btn btn-sm btn-outline-warning rounded-pill mt-1 px-3">
                                            <i class="ri-add-circle-line me-1"></i>Daftarkan CSIRT
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row g-3">
            <!-- Left Column: Main Content (Chart or CTA) -->
            <div class="col-xxl-9 col-xl-8">
                 <!-- CASE 1: IKAS NOT FILLED -->
                 <div v-if="!ikasFilled" class="card custom-card">
                     <div class="card-body d-flex flex-column align-items-center justify-content-center text-center p-5">
                         <div class="mb-4">
                             <div class="avatar avatar-xxl bg-primary-transparent rounded-circle">
                                 <i class="ri-shield-keyhole-line fs-32 text-primary"></i>
                             </div>
                         </div>
                         <h3 class="fw-bold mb-2">Lengkapi Data IKAS</h3>
                         <p class="text-muted mb-4 fs-15" style="max-width: 500px">
                             Data Instrumen Penilaian Kematangan Keamanan Siber (IKAS) Anda belum lengkap. Silakan lengkapi penilaian mandiri untuk melihat tingkat kematangan keamanan siber perusahaan Anda.
                         </p>
                         <button @click="navigateToIkas" class="btn btn-primary btn-lg shadow-sm waves-effect waves-light">
                             <i class="ri-edit-circle-line me-2"></i> Isi Data IKAS
                         </button>
                         
                     </div>
                 </div>
                 
                 <!-- CASE 2: IKAS FILLED (Radar Charts) -->
                 <RadarChartIkas v-else :stakeholderSlug="userSlug" />

                 <!-- CASE 3: CSIRT NOT REGISTERED CTA -->
                 <div v-if="!hasCsirt" class="card custom-card mt-3">
                     <div class="card-body d-flex flex-column align-items-center justify-content-center text-center p-5">
                         <div class="mb-4">
                             <div class="avatar avatar-xxl bg-warning-transparent rounded-circle">
                                 <i class="ri-shield-line fs-32 text-warning"></i>
                             </div>
                         </div>
                         <h3 class="fw-bold mb-2">Daftarkan Profil CSIRT</h3>
                         <p class="text-muted mb-4 fs-15" style="max-width: 500px">
                             Perusahaan atau instansi Anda belum mendaftarkan profil CSIRT. Daftarkan sekarang untuk mulai mendata SDM dan Sistem Elektronik Anda.
                         </p>
                         <button @click="openAddCsirtModal" class="btn btn-warning btn-lg shadow-sm waves-effect waves-light">
                             <i class="ri-add-circle-line me-2"></i> Daftarkan CSIRT
                         </button>
                     </div>
                 </div>
            </div>
            
            <!-- Right Column: Status Cards -->
            <div class="col-xxl-3 col-xl-4">
                <div class="card custom-card">
                    <div class="card-header">
                         <div class="card-title">Status Data</div>
                    </div>
                    <div class="card-body">
                         <!-- IKAS Status -->
                         <div class="d-flex align-items-center mb-4">
                             <div class="flex-shrink-0">
                                 <div class="avatar avatar-lg bg-light rounded-circle">
                                     <i class="ri-file-list-3-line fs-24 text-primary"></i>
                                 </div>
                             </div>
                             <div class="flex-grow-1 ms-3">
                                 <p class="mb-1 text-muted fs-12 text-uppercase fw-medium">Formulir IKAS</p>
                                 <div class="d-flex align-items-center">
                                     <span class="badge" :class="ikasFilled ? 'bg-success-transparent text-success' : 'bg-warning-transparent text-warning'">
                                         <i :class="ikasFilled ? 'ri-checkbox-circle-line' : 'ri-time-line'" class="me-1"></i>
                                         {{ ikasFilled ? 'Sudah Diisi' : 'Belum Diisi' }}
                                     </span>
                                 </div>
                             </div>
                         </div>
                         
                         <!-- SE Categorization Status -->
                         <div class="d-flex align-items-center mb-4">
                             <div class="flex-shrink-0">
                                 <div class="avatar avatar-lg bg-light rounded-circle">
                                      <i class="ri-building-line fs-24 text-info"></i>
                                 </div>
                             </div>
                             <div class="flex-grow-1 ms-3">
                                 <p class="mb-1 text-muted fs-12 text-uppercase fw-medium">Kategorisasi SE</p>
                                 <h5 class="fw-bold mb-0" :style="{ color: kseColor || 'inherit' }">
                                     {{ kseCategory || 'Belum Ada' }}
                                 </h5>
                                 <small class="text-muted" v-if="kseFilled">Terverifikasi</small>
                                 <small class="text-warning" v-else>Belum lengkap</small>
                             </div>
                         </div>

                         <!-- CSIRT Status -->
                         <div class="d-flex align-items-center">
                             <div class="flex-shrink-0">
                                 <div class="avatar avatar-lg bg-light rounded-circle">
                                      <i class="ri-shield-user-line fs-24 text-success"></i>
                                 </div>
                             </div>
                             <div class="flex-grow-1 ms-3">
                                 <p class="mb-1 text-muted fs-12 text-uppercase fw-medium">CSIRT</p>
                                 <div class="d-flex align-items-center">
                                     <span class="badge" :class="hasCsirt ? 'bg-success-transparent text-success' : 'bg-warning-transparent text-warning'">
                                         <i :class="hasCsirt ? 'ri-shield-check-line' : 'ri-shield-line'" class="me-1"></i>
                                         {{ hasCsirt ? 'Terdaftar' : 'Belum Terdaftar' }}
                                     </span>
                                 </div>
                                 <div v-if="hasCsirt" class="mt-1">
                                     <small class="text-muted">{{ sdmCount }} SDM · {{ seCount }} SE</small>
                                 </div>
                             </div>
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
                                    <span>Perusahaan: <strong>{{ companyName }}</strong></span>
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
                            <button type="button" class="btn btn-primary d-flex align-items-center"
                                @click="submitAddCsirt" :disabled="csirtFormLoading || csirtFormSuccess">
                                <span v-if="csirtFormLoading" class="spinner-border spinner-border-sm me-2" role="status"
                                    aria-hidden="true"></span>
                                <i v-else class="ri-save-line me-1"></i>
                                {{ csirtFormLoading ? 'Menyimpan...' : 'Simpan Data' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Modal overlay and card styling specific to Dashboard */
.modal-overlay {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 1050;
}
.custom-modal {
    max-width: 600px;
}
.gradient-header-card {
    border: none;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    overflow: hidden;
}
.gradient-header-blue {
    background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
    border-bottom: none;
    padding: 1rem 1.5rem;
}
.photo-preview-modal {
    transition: all 0.3s ease;
}
.photo-empty-state {
    pointer-events: none;
}
</style>
```
