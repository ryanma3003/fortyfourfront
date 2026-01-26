<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStakeholdersStore } from '../stores/stakeholders';
import { ikasDataStatic } from '../data/ikas-data';
import { useIkasStore } from '../stores/ikas';
import Pageheader from '../shared/components/pageheader/pageheader.vue';
import RadarChartIkas from '../shared/components/@spk/charts/ikas-charts.vue';

const router = useRouter();
const route = useRoute();
const ikasStore = useIkasStore();
const stakeholdersStore = useStakeholdersStore();

// Initialize store
onMounted(async () => {
    ikasStore.initialize();
    if (!stakeholdersStore.initialized) {
        await stakeholdersStore.initialize();
    }
});

// Get current stakeholder slug and source
const currentSlug = computed(() => String(route.query.slug || ''));
const currentSource = computed(() => String(route.query.source || ''));

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
        gulih: { nilai_gulih: 0, kategori_gulih: "INPUT BELUM LENGKAP", nilai_subdomain1: 0, nilai_subdomain2: 0, nilai_subdomain3: 0, nilai_subdomain4: 0 },
    };
});

const dataToPass = computed(() => {
    try {
        const slug = route.query.slug;
        const source = route.query.source;
        console.log("IKAS Debug: Slug:", slug, "Source:", source);
        
        // If source is 'list', user came from the list page, so back button should go to list.
        if (source === 'list') {
             return {
                title: { label: "Stakeholders", path: "/stakeholders" },
                currentpage: "IKAS",
                activepage: "IKAS",
            };
        }

        if (slug) {
            const stakeholder = stakeholdersStore.getStakeholderBySlug(String(slug));
            console.log("IKAS Debug: Found stakeholder:", stakeholder);

            if (stakeholder) {
                return {
                    title: { label: `Profile ${stakeholder.nama_perusahaan}`, path: `/profile-stakeholders/${stakeholder.slug}` },
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
    const query = { slug: currentSlug.value };
    if (currentSource.value) {
        query.source = currentSource.value;
    }
    router.push({ path: '/ikas-crud', query });
};

// --- STATE: Upload Excel Feature ---
const fileInput = ref(null);
const selectedFile = ref(null);
const tableData = ref([]);
const loading = ref(false);
const errorMessage = ref('');

// --- FUNCTION: Trigger Input File ---
const triggerFileInput = () => {
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
        alert(errorMessage.value); // Simple alert for now as requested by "logic only" scope
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
        return;
    }

    loading.value = true;
    errorMessage.value = '';

    const formData = new FormData();
    formData.append('file', selectedFile.value);

    try {
        // Mengirim file ke endpoint backend
        const response = await fetch('/api/ikas/import', {
            method: 'POST',
            body: formData,
            // Headers untuk Content-Type otomatis diatur oleh browser saat menggunakan FormData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Gagal mengupload file');
        }

        if (result.success) {
            // Mengisi data hasil response ke state tableData
            tableData.value = result.data;
            alert('Upload berhasil!');
        } else {
            throw new Error(result.message || 'Terjadi kesalahan pada server');
        }

    } catch (error) {
        // Handle error response
        console.error('Upload error:', error);
        errorMessage.value = error.message;
        alert(`Error: ${errorMessage.value}`);
    } finally {
        // Handle loading state
        loading.value = false;
        // Reset input agar bisa upload file yang sama jika perlu
        if (fileInput.value) fileInput.value.value = '';
        selectedFile.value = null; 
    }
};

const formatValue = (value) => {
    return value === null ? 'N/A' : value;
};

</script>

<style scoped>
.table-wrapper {
  overflow-x: auto;
}

.maturity-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th,
td {
  border: 1px solid #000;
  padding: 4px 6px;
  vertical-align: middle;
}

.left-title,
.year-title,
.right-title {
  font-weight: bold;
  text-align: center;
}

.year-title {
  font-size: 18px;
}

.total {
  background: #444;
  color: white;
  font-weight: bold;
  text-align: center;
}

.item {
  font-size: 11px;
}

.center {
  text-align: center;
}

.bold {
  font-weight: bold;
}

.status-big {
  font-size: 26px;
  font-weight: bold;
  text-align: center;
  border-collapse: collapse;
}

/* DOMAIN COLORS */
.domain {
  color: #fff;
  font-weight: bold;
  text-align: center;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}

.blue { background: #00a2e8; }
.purple { background: #8e44ad; }
.orange { background: #f39c12; }
.green { background: #2ecc71; }

/* Gradient Header Card Styling */
.gradient-header-card { border: none !important; box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075) !important; overflow: hidden !important; }
.gradient-header-card .card-header { border: none !important; border-bottom: none !important; border-block-end: none !important; border-radius: 0 !important; margin: 0 !important; }
.gradient-header-card .card-body { border: 1px solid var(--default-border); border-top: none !important; border-radius: 0 !important; }

</style>



<template>
  <Pageheader :propData="dataToPass" />
  <div class="row">
    <div class="col-12">
      <div class="card custom-card gradient-header-card">
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3" 
            style="background: radial-gradient(ellipse at top, #032a5c, #084696)">
          <div class="d-flex align-items-center">
            <i class="ri-building-2-line me-2 fs-18" style="color: white !important;"></i>
            <div class="card-title mb-0" style="color: white !important;">IKAS ({{ currentStakeholder?.nama_perusahaan || 'Stakeholder' }})</div>
          </div>
        </div>
        <div class="card-body">
           <div class="table-wrapper">
              <table class="maturity-table">
                <thead>
                  <tr>
                    <th rowspan="2" colspan="2" class="left-title fs-20">
                      Tingkat Kematangan<br />Keamanan Siber
                    </th>
                    <th colspan="5" class="year-title">2025</th>
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
                    <th class="center bold">2.51</th>
                    <th class="center bold">{{ ikasDataDynamic.total_rata_rata }}</th>
                  </tr>
                </thead>

                <tbody>
                  <!-- IDENTIFIKASI -->
                  <tr>
                    <td rowspan="5" class="domain blue">IDENTIFIKASI</td>
                    <td class="item">Mengidentifikasi Peran dan tanggung jawab organisasi</td>
                    <td class="center">{{ ikasDataStatic.identifikasi.peran_tanggung_jawab }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_subdomain1) }}</td>
                    <td rowspan="5" class="center">{{ ikasDataDynamic.identifikasi.nilai_identifikasi }}</td>
                    <td rowspan="5" class="center">{{ ikasDataDynamic.identifikasi.kategori_identifikasi }}</td>
                    <td rowspan="18" class="status-big">{{ ikasDataDynamic.total_kategori }}</td>
                  </tr>
                  <tr>
                    <td class="item">Menyusun strategi, kebijakan, dan prosedur Keamanan Siber</td>
                    <td class="center">{{ ikasDataStatic.identifikasi.strategi_kebijakan }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_subdomain2) }}</td>
                  </tr>
                  <tr>
                    <td class="item">Mengelola aset informasi</td>
                    <td class="center">{{ ikasDataStatic.identifikasi.aset_informasi }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_subdomain3) }}</td>
                  </tr>
                  <tr>
                    <td class="item">Menilai dan mengelola risiko Keamanan Siber</td>
                    <td class="center">{{ ikasDataStatic.identifikasi.risiko_keamanan }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_subdomain4) }}</td>
                  </tr>
                  <tr>
                    <td class="item">Mengelola risiko rantai pasok</td>
                    <td class="center">{{ ikasDataStatic.identifikasi.rantai_pasok }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_subdomain5) }}</td>
                  </tr>

                  <!-- PROTEKSI -->
                  <tr>
                    <td rowspan="6" class="domain purple">PROTEKSI</td>
                    <td class="item">Mengelola identitas, autentikasi, dan kendali akses</td>
                    <td class="center">{{ ikasDataStatic.proteksi.identitas_autentikasi }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain1) }}</td>
                    <td rowspan="6" class="center">{{ ikasDataDynamic.proteksi.nilai_proteksi }}</td>
                    <td rowspan="6" class="center">{{ ikasDataDynamic.proteksi.kategori_proteksi }}</td>
                  </tr>
                  <tr>
                    <td class="item">Melindungi aset fisik</td>
                    <td class="center">{{ ikasDataStatic.proteksi.aset_fisik }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain2) }}</td>
                  </tr>
                  <tr>
                    <td class="item">Melindungi data</td>
                    <td class="center">{{ ikasDataStatic.proteksi.data }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain3) }}</td>
                  </tr>
                  <tr>
                    <td class="item">Melindungi aplikasi</td>
                    <td class="center">{{ ikasDataStatic.proteksi.aplikasi }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain4) }}</td>
                  </tr>
                  <tr>
                    <td class="item">Melindungi jaringan</td>
                    <td class="center">{{ ikasDataStatic.proteksi.jaringan }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain5) }}</td>
                  </tr>
                  <tr>
                    <td class="item">Melindungi sumber daya manusia</td>
                    <td class="center">{{ ikasDataStatic.proteksi.sdm }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_subdomain6) }}</td>
                  </tr>

                  <!-- DETEKSI -->
                  <tr>
                    <td rowspan="3" class="domain orange">DETEKSI</td>
                    <td class="item">Mengelola deteksi Peristiwa Siber</td>
                    <td class="center">{{ ikasDataStatic.deteksi.deteksi_peristiwa }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.deteksi.nilai_subdomain1) }}</td>
                    <td rowspan="3" class="center">{{ ikasDataDynamic.deteksi.nilai_deteksi }}</td>
                    <td rowspan="3" class="center">{{ ikasDataDynamic.deteksi.kategori_deteksi }}</td>
                  </tr>
                  <tr>
                    <td class="item">Menganalisis anomali dan Peristiwa Siber</td>
                    <td class="center">{{ ikasDataStatic.deteksi.anomali_peristiwa }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.deteksi.nilai_subdomain2) }}</td>
                  </tr>
                  <tr>
                    <td class="item">Memantau Peristiwa Siber berkelanjutan</td>
                    <td class="center">{{ ikasDataStatic.deteksi.pemantauan_berkelanjutan }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.deteksi.nilai_subdomain3) }}</td>
                  </tr>

                  <!-- PENANGGULANGAN & PEMULIHAN -->
                  <tr>
                    <td rowspan="4" class="domain green">PENANGGULANGAN & PEMULIHAN</td>
                    <td class="item">Menyusun perencanaan penanggulangan dan pemulihan Insiden Siber</td>
                    <td class="center">{{ ikasDataStatic.gulih.perencanaan_pemulihan }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.gulih.nilai_subdomain1) }}</td>
                    <td rowspan="4" class="center">{{ ikasDataDynamic.gulih.nilai_gulih }}</td>
                    <td rowspan="4" class="center">{{ ikasDataDynamic.gulih.kategori_gulih }}</td>
                  </tr>
                  <tr>
                    <td class="item">Menganalisis dan melaporkan Insiden Siber</td>
                    <td class="center">{{ ikasDataStatic.gulih.analisis_pelaporan }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.gulih.nilai_subdomain2) }}</td>
                  </tr>
                  <tr>
                    <td class="item">Melaksanakan penanggulangan dan pemulihan Insiden Siber</td>
                    <td class="center">{{ ikasDataStatic.gulih.pelaksanaan_pemulihan }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.gulih.nilai_subdomain3) }}</td>
                  </tr>
                  <tr>
                    <td class="item">Meningkatkan keamanan setelah terjadinya Insiden Siber</td>
                    <td class="center">{{ ikasDataStatic.gulih.peningkatan_keamanan }}</td>
                    <td class="center">{{ formatValue(ikasDataDynamic.gulih.nilai_subdomain4) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="d-flex justify-content-end gap-2 mt-3">
              <button @click="goToIkasCrud" class="btn btn-secondary btn-glare rounded-pill btn-md">Input Data</button>
              <input type="file" ref="fileInput" class="d-none" accept=".xlsx, .xls" @change="handleFile" />
              <button @click="triggerFileInput" class="btn btn-success btn-glare rounded-pill btn-md" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                Upload Excel
              </button>
            </div>
        </div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-12">
      <div class="card">
        <div class="card-body">
          <RadarChartIkas :stakeholder-slug="currentSlug" />
        </div>
      </div>
    </div>
  </div>
  
</template>
