<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useIkasStore } from '../stores/ikas';
import { stakeholdersData } from '../data/dummydata';
import Pageheader from '../shared/components/pageheader/pageheader.vue';

const router = useRouter();
const route = useRoute();
const ikasStore = useIkasStore();

// Get current stakeholder slug and source from route query
const currentSlug = computed(() => String(route.query.slug || ''));
const currentSource = computed(() => String(route.query.source || ''));

// Get current stakeholder info
const currentStakeholder = computed(() => {
    if (currentSlug.value && stakeholdersData && Array.isArray(stakeholdersData)) {
        return stakeholdersData.find(s => s.slug === currentSlug.value);
    }
    return null;
});

// Local form data (copy of store data for editing)
const formData = reactive({
    identifikasi: {
        nilai_subdomain1: 0,
        nilai_subdomain2: 0,
        nilai_subdomain3: 0,
        nilai_subdomain4: 0,
        nilai_subdomain5: 0,
    },
    proteksi: {
        nilai_subdomain1: 0,
        nilai_subdomain2: 0,
        nilai_subdomain3: 0,
        nilai_subdomain4: 0,
        nilai_subdomain5: 0,
        nilai_subdomain6: 0,
    },
    deteksi: {
        nilai_subdomain1: 0,
        nilai_subdomain2: 0,
        nilai_subdomain3: 0,
    },
    gulih: {
        nilai_subdomain1: 0,
        nilai_subdomain2: 0,
        nilai_subdomain3: 0,
        nilai_subdomain4: 0,
    }
});

// Initialize: load data from store
onMounted(() => {
    ikasStore.initialize();
    
    if (currentSlug.value) {
        const storeData = ikasStore.getIkasData(currentSlug.value);
        // Copy store data to form
        formData.identifikasi = { ...storeData.identifikasi };
        formData.proteksi = { ...storeData.proteksi };
        formData.deteksi = { ...storeData.deteksi };
        formData.gulih = { ...storeData.gulih };
    }
});

// Dynamic page data based on stakeholder and source
const pageData = computed(() => {
    // Build the back path based on source
    let backPath = '/ikas';
    let backQuery = { slug: currentSlug.value };
    if (currentSource.value) {
        backQuery.source = currentSource.value;
    }
    
    return {
        title: { 
            label: currentStakeholder.value 
                ? `IKAS ${currentStakeholder.value.nama_perusahaan}` 
                : "IKAS Dashboard", 
            path: `${backPath}?slug=${currentSlug.value}${currentSource.value ? '&source=' + currentSource.value : ''}` 
        },
        currentpage: "Input Data",
        activepage: "Input Data",
    };
});

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
    if (!currentSlug.value) {
        alert('Error: Stakeholder tidak ditemukan');
        return;
    }

    // Update each subdomain in store
    domains.forEach(domain => {
        domain.items.forEach(item => {
            const value = formData[domain.key][item.key];
            ikasStore.updateSubdomain(currentSlug.value, domain.key, item.key, Number(value) || 0);
        });
    });

    // Navigate back to IKAS page with slug and source
    const query = { slug: currentSlug.value };
    if (currentSource.value) {
        query.source = currentSource.value;
    }
    router.push({ path: '/ikas', query });
};

const cancel = () => {
    // Navigate back to IKAS page with slug and source
    const query = { slug: currentSlug.value };
    if (currentSource.value) {
        query.source = currentSource.value;
    }
    router.push({ path: '/ikas', query });
};
</script>

<template>
    <Pageheader :propData="pageData" />
    <div class="row">
        <div class="col-12">
            <div class="card custom-card">
                <div class="card-header justify-content-between">
                    <div class="card-title">
                        Input Nilai Kematangan Keamanan Siber
                        <span v-if="currentStakeholder" class="text-muted fs-14 ms-2">
                            - {{ currentStakeholder.nama_perusahaan }}
                        </span>
                    </div>
                </div>
                <div class="card-body">
                    <div v-if="!currentSlug" class="alert alert-warning">
                        <i class="ri-alert-line me-2"></i>
                        Tidak ada stakeholder yang dipilih. Silakan kembali dan pilih stakeholder terlebih dahulu.
                    </div>
                    <template v-else>
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
                                        v-model.number="formData[domain.key][item.key]"
                                    >
                                </div>
                            </div>
                        </div>
                        <div class="d-flex justify-content-end gap-2">
                            <button @click="cancel" class="btn btn-light rounded-pill">Cancel</button>
                            <button @click="save" class="btn btn-primary rounded-pill">Save Changes</button>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

