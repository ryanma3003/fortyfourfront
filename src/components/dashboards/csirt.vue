<script lang="ts">
import SimpleCardComponent from "../../shared/components/@spk/simple-card.vue";
import { ref, onMounted, watch, computed } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { sdmCsirtData, type sdmCsirt, seCsirtData, type seCsirt } from "../../data/pages/csirt";
import { csirtMembersData, type csirtMember } from "../../data/pages/csirt";
import { useRoute } from "vue-router";
import TableComponent from "../../shared/components/@spk/table-reuseble/table-component.vue";
import { useStakeholdersStore } from "../../stores/stakeholders";

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
        const headers = [
            { text: "Nama Personel" },
            { text: "Jabatan" },
            { text: "Keahlian" },
            { text: "Sertifikasi" }
        ];

        const seHeaders = [
            { text: "Nama SE" },
            { text: "IP SE" },
            { text: "AS Number" },
            { text: "Pengelola" },
            { text: "Fitur" },
            { text: "Kategori" }
        ];

        const items = ref < sdmCsirt[] > ([]);
        const seItems = ref < seCsirt[] > ([]);
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

            // Load data filtered by CSIRT ID
            if (csirtId.value) {
                items.value = sdmCsirtData.filter((member) => member.id_csirt === csirtId.value);
                seItems.value = seCsirtData.filter((item) => item.id_csirt === csirtId.value);
            } else {
                items.value = [];
                seItems.value = [];
            }

            loading.value = false;
        };

        // Load data saat component mounted
        onMounted(async () => {
            loadCSIRTs();
            if (!stakeholdersStore.initialized) {
                await stakeholdersStore.initialize();
            }
        });

        // Watch for route changes
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

        return {
            headers,
            items,
            loading,
            loadCSIRTs,
            currentCsirt,
            dataToPass,
            seHeaders,
            seItems,
            getKategoriBadgeClass
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
<div class="row" v-if="currentCsirt">
    <div class="col-xl-12">
        <SimpleCardComponent title="Tabel Daftar SDM CSIRT">
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
                        v-slot:cell="{ row }"
                    >
                        <td class="align-middle">
                            <div class="fw-semibold text-primary">{{ row.nama_personel }}</div>
                        </td>
                        <td class="align-middle">{{ row.jabatan_csirt }}</td>
                        <td class="align-middle text-muted small">{{ row.skill }}</td>
                        <td class="align-middle">
                            <span class="badge bg-primary-transparent rounded-pill px-3">{{ row.sertifikasi }}</span>
                        </td>
                    </TableComponent>
                </div>
            </template>
        </SimpleCardComponent>
    </div>
</div>

<div class="row" v-if="currentCsirt">
    <div class="col-xl-12">
        <SimpleCardComponent title="Tabel Daftar SE-CSIRT">
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
                        v-slot:cell="{ row }"
                    >
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
                    </TableComponent>
                </div>
            </template>
        </SimpleCardComponent>
    </div>
</div>
</template>

<style scoped>
/* Add your styles here */
</style>
