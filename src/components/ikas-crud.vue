<script setup>
import { useRouter } from 'vue-router';
import { ikasDataDynamic } from '../data/ikas-data';
import Pageheader from '../shared/components/pageheader/pageheader.vue';

const router = useRouter();

const pageData = {
    title: { label: "IKAS Dashboard", path: "/ikas" },
    currentpage: "IKAS CRUD",
    activepage: "IKAS CRUD",
};

const domains = [
    {
        name: 'IDENTIFIKASI',
        key: 'identifikasi',
        items: [
            { label: 'Mengidentifikasi Peran dan tanggung jawab organisasi', key: 'nilai_subdomain1' },
            { label: 'Menyusun strategi, kebijakan, dan prosedur Keamanan Siber', key: 'nilai_subdomain2' },
            { label: 'Mengelola aset informasi', key: 'nilai_subdomain3' },
            { label: 'Menilai dan mengelola risiko Keamanan Siber', key: 'nilai_subdomain4' },
            { label: 'Mengelola risiko rantai pasok', key: 'nilai_subdomain5' },
        ]
    },
    {
        name: 'PROTEKSI',
        key: 'proteksi',
        items: [
            { label: 'Mengelola identitas, autentikasi, dan kendali akses', key: 'nilai_subdomain1' },
            { label: 'Melindungi aset fisik', key: 'nilai_subdomain2' },
            { label: 'Melindungi data', key: 'nilai_subdomain3' },
            { label: 'Melindungi aplikasi', key: 'nilai_subdomain4' },
            { label: 'Melindungi jaringan', key: 'nilai_subdomain5' },
            { label: 'Melindungi sumber daya manusia', key: 'nilai_subdomain6' },
        ]
    },
    {
        name: 'DETEKSI',
        key: 'deteksi',
        items: [
            { label: 'Mengelola deteksi Peristiwa Siber', key: 'nilai_subdomain1' },
            { label: 'Menganalisis anomali dan Peristiwa Siber', key: 'nilai_subdomain2' },
            { label: 'Memantau Peristiwa Siber berkelanjutan', key: 'nilai_subdomain3' },
        ]
    },
    {
        name: 'PENANGGULANGAN & PEMULIHAN',
        key: 'gulih',
        items: [
            { label: 'Menyusun perencanaan penanggulangan dan pemulihan Insiden Siber', key: 'nilai_subdomain1' },
            { label: 'Menganalisis dan melaporkan Insiden Siber', key: 'nilai_subdomain2' },
            { label: 'Melaksanakan penanggulangan dan pemulihan Insiden Siber', key: 'nilai_subdomain3' },
            { label: 'Meningkatkan keamanan setelah terjadinya Insiden Siber', key: 'nilai_subdomain4' },
        ]
    }
];

const save = () => {
    // Data is already reactive and synced via v-model
    router.push('/ikas');
};

const cancel = () => {
    router.push('/ikas');
};
</script>

<template>
    <Pageheader :propData="pageData" />
    <div class="row">
        <div class="col-12">
            <div class="card custom-card">
                <div class="card-header justify-content-between">
                    <div class="card-title">Input Nilai Kematangan Keamanan Siber</div>
                </div>
                <div class="card-body">
                    <div v-for="domain in domains" :key="domain.key" class="mb-4">
                        <h6 class="fw-bold mb-3 border-bottom pb-2">{{ domain.name }}</h6>
                        <div class="row g-3">
                            <div v-for="item in domain.items" :key="item.key" class="col-md-6 col-lg-4">
                                <label class="form-label fs-12">{{ item.label }}</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    max="5"
                                    min="0"
                                    class="form-control" 
                                    v-model.number="ikasDataDynamic[domain.key][item.key]"
                                >
                            </div>
                        </div>
                    </div>
                    <div class="d-flex justify-content-end gap-2">
                        <button @click="cancel" class="btn btn-light rounded-pill">Cancel</button>
                        <button @click="save" class="btn btn-primary rounded-pill">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
