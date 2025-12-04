<script lang="ts">
import SimpleCardComponent from "../../shared/components/@spk/simple-card.vue";
import { ref, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { stakeholdersData, type Stakeholder } from "../../data/dummydata"; // Sesuaikan path

export default {
    data() {
        return {
            dataToPass: {
                title: "Dashboards",
                currentpage: "Stakeholders",
                activepage: "Stakeholders",
            },
            searchValue2: ref(""),
        };
    },
    components: {
        Pageheader,
        SimpleCardComponent,
    },
    setup() {
        const headers = [{
                text: "Nama Perusahaan",
                value: "nama_perusahaan",
                sortable: true
            },
            {
                text: "Jenis Usaha",
                value: "jenis_usaha",
                sortable: true
            },
            {
                text: "Email",
                value: "email"
            },
            {
                text: "Detail",
                value: "detail"
            }
        ];

        const items = ref < Stakeholder[] > ([]);
        const loading = ref(false);

        // Simulasi async data loading
        const loadStakeholders = async () => {
            loading.value = true;

            // Simulasi delay seperti API call
            await new Promise(resolve => setTimeout(resolve, 500));

            // Load data dari dummydata.ts
            items.value = stakeholdersData;

            loading.value = false;
        };

        // Load data saat component mounted
        onMounted(() => {
            loadStakeholders();
        });

        return {
            headers,
            items,
            loading,
            loadStakeholders
        };
    },
};
</script>

<template>
<Pageheader :propData="dataToPass" />
<div class="row">
    <div class="col-xl-12">
        <SimpleCardComponent title="Tabel Daftar Stakeholders">
            <!-- Loading state -->
            <div v-if="loading" class="text-center p-4">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>

            <!-- Table -->
            <template v-else>
                <label class="mb-3">
                    <input type="text" class="form-control form-control-sm" v-model="searchValue2" placeholder="Cari nama perusahaan, jenis usaha, atau email">
                </label>
                <EasyDataTable class="table text-nowrap" :headers="headers" :items="items" border-cell show-index :search-value="searchValue2" :rowsPerPage="10" :rowsItems="[5, 10, 25, 50, 100]">
                    <!-- Custom slot untuk kolom Detail dengan hyperlink -->
                    <template #item-detail="{ detail }">
                        <div class="d-flex justify-content-center">
                            <router-link :to="detail" class="btn btn-info-light btn-wave rounded-pill px-3 py-2 my-1">
                                <i class="bi bi-eye"></i> Lihat Profil
                            </router-link>
                        </div>
                    </template>
                </EasyDataTable>
            </template>
        </SimpleCardComponent>
    </div>
</div>
</template>

<style scoped>
/* Add your styles here */
</style>
