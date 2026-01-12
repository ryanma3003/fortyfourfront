<script lang="ts">
import SimpleCardComponent from "../../shared/components/@spk/simple-card.vue";
import { ref, onMounted, watch, computed } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { sdmCsirtData, type sdmCsirt, seCsirtData, type seCsirt } from "../../data/pages/csirt";
import { csirtMembersData, type csirtMember } from "../../data/pages/csirt";
import { useRoute } from "vue-router";
import TableComponent from "../../shared/components/@spk/table-reuseble/table-component.vue";
import { stakeholdersData } from "../../data/dummydata";

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
        onMounted(() => {
            loadCSIRTs();
        });

        // Watch for route changes
        watch(csirtId, () => {
            loadCSIRTs();
        });

        const dataToPass = computed(() => {
            const parent = currentCsirt.value 
                ? stakeholdersData.find(s => s.id === currentCsirt.value?.id_perusahaan) 
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

        return {
            headers,
            items,
            loading,
            loadCSIRTs,
            currentCsirt,
            dataToPass,
            seHeaders,
            seItems
        };
    },
};
</script>
<style>
.profile-csirt-img{
  max-width: 100%;
  height: auto;
  object-fit: contain;
  margin: 0 auto;
  display: block;
}
</style>

<template>
<Pageheader :propData="dataToPass" />
<div class="row">
    <div class="col-xl-12">
        <div class="card custom-card gradient-header-card">
            <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3" 
            style="background: radial-gradient(ellipse at top, #032a5c, #084696)">
          <div class="d-flex align-items-center">
            <i class="ri-building-2-line me-2 fs-18" style="color: white !important;"></i>
            <div class="card-title mb-0" style="color: white !important;">{{ currentCsirt?.nama || 'CSIRT' }}</div>
          </div>
        </div>
            <div class="card-body">
                <div v-if="!currentCsirt" class="alert alert-warning">
                    Data CSIRT tidak ditemukan
                </div>
                <div v-else class="row align-items-center">
                    <div class="col-12 col-sm-4 col-md-2 col-lg-2 text-center">
                        <img :src="currentCsirt.img_csirt" class="img-fluid rounded-pill profile-csirt-img" alt="Logo CSIRT"/>
                    </div>
                    <div class="col-12 col-sm-8 col-md-6">
                        <h2 class="fw-bold">{{ currentCsirt.nama }}</h2>
                        <div
                            class="mb-2 d-flex align-items-center gap-1 flex-wrap"
                          >
                            <span
                              class="avatar avatar-sm avatar-rounded text-default"
                            >
                              <i class="ri-phone-line align-middle fs-15"></i>
                            </span>
                            <span class="fw-medium text-default"
                              >Telepon :
                            </span>
                            {{ currentCsirt.no_telepon }}
                        </div>
                        <div
                            class="mb-2 d-flex align-items-center gap-1 flex-wrap"
                          >
                            <span
                              class="avatar avatar-sm avatar-rounded text-default"
                            >
                              <i class="ri-global-line align-middle fs-15"></i>
                            </span>
                            <span class="fw-medium text-default"
                              >Website :
                            </span>
                            {{ currentCsirt.web_csirt }}
                        </div>
                    </div>
                    <div class="col-12 col-md-4">
                        <div class="d-flex flex-column gap-2">
                            <a v-if="currentCsirt.file_rfc2350" :href="currentCsirt.file_rfc2350" target="_blank" class="btn btn-primary-light btn-wave">
                                <i class="ri-file-pdf-line me-2"></i> RFC 2350
                            </a>
                            <a v-if="currentCsirt.file_public_key_pgp" :href="currentCsirt.file_public_key_pgp" target="_blank" class="btn btn-secondary-light btn-wave">
                                <i class="ri-key-2-line me-2"></i> Public Key PGP
                            </a>
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
            <div v-if="loading" class="text-center p-4">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>

            <!-- Table -->
            <template v-else>
                <TableComponent 
                    :headers="headers" 
                    :rows="items" 
                    tableClass="table text-nowrap" 
                    v-slot:cell="{ row }"
                >
                    <td>
                        {{ row.nama_personel }}
                    </td>
                    <td>{{ row.jabatan_csirt }}</td>
                    <td>{{ row.skill }}</td>
                    <td><span class="badge bg-light text-dark">{{ row.sertifikasi }}</span></td>
                </TableComponent>
            </template>
        </SimpleCardComponent>
    </div>
</div>

<div class="row" v-if="currentCsirt">
    <div class="col-xl-12">
        <SimpleCardComponent title="Tabel Daftar SE-CSIRT">
            <!-- Loading state -->
            <div v-if="loading" class="text-center p-4">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>

            <!-- Table -->
            <template v-else>
                <TableComponent 
                    :headers="seHeaders" 
                    :rows="seItems" 
                    tableClass="table text-nowrap" 
                    v-slot:cell="{ row }"
                >
                    <td>{{ row.nama_se }}</td>
                    <td class="text-success small fw-bold">{{ row.ip_se }}</td>
                    <td>{{ row.as_number_se }}</td>
                    <td>{{ row.pengelola_se }}</td>
                    <td>{{ row.fitur_se }}</td>
                    <td><span class="badge bg-light text-dark">{{ row.kategori_se }}</span></td>
                </TableComponent>
            </template>
        </SimpleCardComponent>
    </div>
</div>
</template>

<style scoped>
/* Add your styles here */
</style>
