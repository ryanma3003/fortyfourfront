<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStakeholdersStore } from '../stores/stakeholders';
import { ikasDataStatic } from '../data/ikas-data';
import { useIkasStore } from '../stores/ikas';
import { useAssessmentStore } from '../stores/assessment';
import Pageheader from '../shared/components/pageheader/pageheader.vue';
import RadarChartIkas from '../shared/components/@spk/charts/ikas-charts.vue';

const router = useRouter();
const route = useRoute();
const ikasStore = useIkasStore();
const assessmentStore = useAssessmentStore();
const stakeholdersStore = useStakeholdersStore();

// Initialize store
onMounted(async () => {
    ikasStore.initialize();
    assessmentStore.initialize();
    
    if (!stakeholdersStore.initialized) {
        await stakeholdersStore.initialize();
    }

    // Sync assessment answers to IKAS store for current stakeholder
    const slug = String(route.query.slug || '');
    if (slug) {
        assessmentStore.setCurrentStakeholder(slug);
        assessmentStore.syncToIkas(slug);
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
        tanggulih: { nilai_tanggulih: 0, kategori_tanggulih: "INPUT BELUM LENGKAP", nilai_subdomain1: 0, nilai_subdomain2: 0, nilai_subdomain3: 0, nilai_subdomain4: 0 },
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
                currentpage: "IKAS ",
                activepage: "IKAS",
            };
        }

        if (slug) {
            const stakeholder = stakeholdersStore.getStakeholderBySlug(String(slug));
            console.log("IKAS Debug: Found stakeholder:", stakeholder);

            if (stakeholder) {
                return {
                    title: { label: `Profile ${stakeholder.nama_perusahaan}`, path: `/admin/stakeholders/${stakeholder.slug}` },
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
    if (value === null || value === 0) return '-';
    return value;
};

</script>

<style src="../assets/css/style2.css"></style>
<style scoped>
/* ── IKAS Table ─────────────────────────────────────────── */
.table-wrapper { 
  overflow-x: auto; 
  border-radius: 14px;
  border: 1px solid #dae4f0;
  overflow: hidden;
}

.maturity-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.maturity-table th,
.maturity-table td {
  border: 1px solid #dae4f0;
  padding: 6px 10px;
  vertical-align: middle;
}
.maturity-table thead th {
  background: #f3f4f6;
  color: #4b5563;
  font-size: 0.69rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.left-title, .year-title, .right-title { font-weight: bold; text-align: center; }
.year-title   { font-size: 16px; }
.total        { background: #1e3a5f !important; color: #fff !important; font-weight: bold; text-align: center; }
.item         { font-size: 11.5px; color: #374151; }
.center       { text-align: center; }
.bold         { font-weight: bold; }
.status-big   { font-size: 20px; font-weight: 800; text-align: center; color: #1e3a5f; letter-spacing: 0.02em; }

/* Domain column labels */
.domain {
  color: #fff;
  font-weight: 800;
  text-align: center;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.blue   { background: linear-gradient(180deg, #1e40af, #2563eb); }
.purple { background: linear-gradient(180deg, #5b21b6, #7c3aed); }
.orange { background: linear-gradient(180deg, #b45309, #d97706); }
.green  { background: linear-gradient(180deg, #065f46, #059669); }

/* ── Unified card header ────────────────────────────────── */
.ikas-unified-header {
  background: linear-gradient(135deg, #0c1e6b 0%, #1130a0 25%, #1a3fc8 50%, #2563eb 75%, #3b82f6 100%) !important;
  border-bottom: none !important;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  position: relative;
  overflow: hidden;
  flex-wrap: wrap;
}
.ikas-unified-header::after {
  content: '';
  position: absolute; bottom:0; left:0; right:0; height:2px;
  background: linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.5) 30%, rgba(96,165,250,0.8) 60%, rgba(167,243,208,0.4) 100%);
}
.ikas-header-icon-box {
  width:64px; height:64px; border-radius:14px;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.ikas-header-icon-box i { font-size:2rem; color:#fff; }
.ikas-header-label { font-size:1.2rem; font-weight:800; color:#fff; line-height:1.3; padding-top:8px; }
.ikas-header-stakeholder { font-size:1rem; font-weight:600; color:rgba(255,255,255,0.9); margin-top:6px; display:flex; align-items:center; }
.ikas-header-sektor { font-size:13px; color:rgba(255,255,255,0.65); }
.ikas-header-score-box { text-align:right; flex-shrink:0; }
.ikas-header-score { font-size:2.4rem; font-weight:900; color:#fff; line-height:1; }
.ikas-header-score-lbl { font-size:11px; color:rgba(255,255,255,0.6); letter-spacing:0.04em; text-transform:uppercase; margin-top:2px; }
.ikas-header-kat-badge {
  display:inline-block;
  padding: 8px 20px;
  border-radius:50px;
  background: rgba(255,255,255,0.15);
  color:#fff;
  font-size:0.9rem;
  font-weight:700;
  letter-spacing:0.04em;
  border:1px solid rgba(255,255,255,0.3);
  text-transform:uppercase;
}

/* ── Action buttons area ────────────────────────────────── */
.ikas-action-bar {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid #e8eef6;
}
.btn-ikas-input {
  border: none; border-radius: 50px; padding: 8px 22px;
  color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  box-shadow: 0 4px 14px rgba(31,41,55,0.35);
  transition: opacity 0.2s, transform 0.2s;
}
.btn-ikas-input:hover { opacity: 0.88; transform: translateY(-1px); }
.btn-ikas-upload {
  background: linear-gradient(135deg, #065f46, #059669);
  border: none; border-radius: 50px; padding: 8px 22px;
  color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  box-shadow: 0 4px 14px rgba(5,150,105,0.35);
  transition: opacity 0.2s, transform 0.2s;
}
.btn-ikas-upload:hover  { opacity: 0.88; transform: translateY(-1px); }
.btn-ikas-upload:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

/* ── Domain score summary strip ─────────────────────────── */
.domain-strip {
  display: flex;
  gap: 12px;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.domain-card {
  flex: 1; min-width: 160px;
  border-radius: 14px;
  padding: 14px 18px;
  display: flex; align-items: center; gap: 12px;
  position: relative; overflow: hidden;
}
.domain-card-blue   { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); box-shadow: 0 4px 18px rgba(37,99,235,0.3); }
.domain-card-purple { background: linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%); box-shadow: 0 4px 18px rgba(124,58,237,0.3); }
.domain-card-orange { background: linear-gradient(135deg, #78350f 0%, #d97706 100%); box-shadow: 0 4px 18px rgba(217,119,6,0.3); }
.domain-card-green  { background: linear-gradient(135deg, #064e3b 0%, #059669 100%); box-shadow: 0 4px 18px rgba(5,150,105,0.3); }
.domain-card-icon   { width:42px; height:42px; border-radius:12px; background: rgba(255,255,255,0.18); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.domain-card-icon i { font-size:1.3rem; color:#fff; }
.domain-card-score  { font-size: 1.6rem; font-weight: 900; color:#fff; line-height:1; }
.domain-card-label  { font-size: 11px; color: rgba(255,255,255,0.75); margin-top:3px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; }
.domain-card-kat    { font-size: 11px; color: rgba(255,255,255,0.85); margin-top:2px; font-style:italic; }

/* ── Radar section header ───────────────────────────────── */
.radar-section-header {
  background: linear-gradient(135deg, #0c1e6b 0%, #1130a0 25%, #1a3fc8 50%, #2563eb 75%, #3b82f6 100%);
  border-radius: 0;
  padding: 0.75rem 1.25rem;
  display: flex; align-items: center; gap: 12px;
  position: relative;
}
.radar-section-header::after {
  content: '';
  position: absolute; bottom:0; left:0; right:0; height:2px;
  background: linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.5) 30%, rgba(96,165,250,0.8) 60%, rgba(167,243,208,0.4) 100%);
}
.radar-header-icon   { width:42px; height:48px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.radar-header-icon i { font-size:1.6rem; color:#fff; }
.radar-header-title  { font-size:1rem; font-weight:800; color:#fff; }
.radar-header-sub    { font-size:12px; color:rgba(255,255,255,0.6); margin-top:2px; }
</style>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Main IKAS Card -->
  <div class="row">
    <div class="col-12">
      <div class="card custom-card gradient-header-card">

        <!-- Unified Header -->
        <div class="card-header ikas-unified-header">
          <!-- Left: title + stakeholder -->
          <div class="d-flex align-items-center gap-3">
            <div class="ikas-header-icon-box">
              <i class="ri-building-2-line"></i>
            </div>
            <div>
              <div class="ikas-header-label">IKAS - {{ currentStakeholder?.nama_perusahaan || 'Stakeholder' }}</div>
              <div class="ikas-header-stakeholder">
                <span v-if="currentStakeholder?.sektor" class="ikas-header-sektor">{{ currentStakeholder.sektor }}</span>
              </div>
            </div>
          </div>
          <!-- Right: badge -->
          <div class="ikas-header-score-box">
            <span class="ikas-header-kat-badge">{{ ikasDataDynamic.total_kategori }}</span>
          </div>
        </div>

        <div class="card-body p-4">

          <!-- Domain summary cards -->
          <div class="domain-strip">
            <div class="domain-card domain-card-blue">
              <div class="domain-card-icon"><i class="ri-search-eye-line"></i></div>
              <div>
                <div class="domain-card-score">{{ formatValue(ikasDataDynamic.identifikasi.nilai_identifikasi) || '—' }}</div>
                <div class="domain-card-label">Identifikasi</div>
                <div class="domain-card-kat">{{ ikasDataDynamic.identifikasi.kategori_identifikasi }}</div>
              </div>
            </div>
            <div class="domain-card domain-card-purple">
              <div class="domain-card-icon"><i class="ri-shield-line"></i></div>
              <div>
                <div class="domain-card-score">{{ formatValue(ikasDataDynamic.proteksi.nilai_proteksi) || '—' }}</div>
                <div class="domain-card-label">Proteksi</div>
                <div class="domain-card-kat">{{ ikasDataDynamic.proteksi.kategori_proteksi }}</div>
              </div>
            </div>
            <div class="domain-card domain-card-orange">
              <div class="domain-card-icon"><i class="ri-radar-line"></i></div>
              <div>
                <div class="domain-card-score">{{ formatValue(ikasDataDynamic.deteksi.nilai_deteksi) || '—' }}</div>
                <div class="domain-card-label">Deteksi</div>
                <div class="domain-card-kat">{{ ikasDataDynamic.deteksi.kategori_deteksi }}</div>
              </div>
            </div>
            <div class="domain-card domain-card-green">
              <div class="domain-card-icon"><i class="ri-first-aid-kit-line"></i></div>
              <div>
                <div class="domain-card-score">{{ formatValue(ikasDataDynamic.tanggulih.nilai_tanggulih) || '—' }}</div>
                <div class="domain-card-label">Penanggulangan &amp; Pemulihan</div>
                <div class="domain-card-kat">{{ ikasDataDynamic.tanggulih.kategori_tanggulih }}</div>
              </div>
            </div>
          </div>

          <!-- Maturity table (unchanged logic) -->
          <div class="table-wrapper">
            <table class="maturity-table">
              <thead>
                <tr>
                  <th rowspan="2" colspan="2" class="left-title fs-14">
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
                  <th class="center bold">{{ formatValue(ikasDataDynamic.total_rata_rata) }}</th>
                </tr>
              </thead>

              <tbody>
                <!-- IDENTIFIKASI -->
                <tr>
                  <td rowspan="5" class="domain blue">IDENTIFIKASI</td>
                  <td class="item">Mengidentifikasi Peran dan tanggung jawab organisasi</td>
                  <td class="center">{{ ikasDataStatic.identifikasi.peran_tanggung_jawab }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_subdomain1) }}</td>
                  <td rowspan="5" class="center">{{ formatValue(ikasDataDynamic.identifikasi.nilai_identifikasi) }}</td>
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
                  <td rowspan="6" class="center">{{ formatValue(ikasDataDynamic.proteksi.nilai_proteksi) }}</td>
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
                  <td rowspan="3" class="center">{{ formatValue(ikasDataDynamic.deteksi.nilai_deteksi) }}</td>
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
                  <td rowspan="4" class="domain green">PENANGGULANGAN &amp; PEMULIHAN</td>
                  <td class="item">Menyusun perencanaan penanggulangan dan pemulihan Insiden Siber</td>
                  <td class="center">{{ ikasDataStatic.tanggulih.perencanaan_pemulihan }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.tanggulih.nilai_subdomain1) }}</td>
                  <td rowspan="4" class="center">{{ formatValue(ikasDataDynamic.tanggulih.nilai_tanggulih) }}</td>
                  <td rowspan="4" class="center">{{ ikasDataDynamic.tanggulih.kategori_tanggulih }}</td>
                </tr>
                <tr>
                  <td class="item">Menganalisis dan melaporkan Insiden Siber</td>
                  <td class="center">{{ ikasDataStatic.tanggulih.analisis_pelaporan }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.tanggulih.nilai_subdomain2) }}</td>
                </tr>
                <tr>
                  <td class="item">Melaksanakan penanggulangan dan pemulihan Insiden Siber</td>
                  <td class="center">{{ ikasDataStatic.tanggulih.pelaksanaan_pemulihan }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.tanggulih.nilai_subdomain3) }}</td>
                </tr>
                <tr>
                  <td class="item">Meningkatkan keamanan setelah terjadinya Insiden Siber</td>
                  <td class="center">{{ ikasDataStatic.tanggulih.peningkatan_keamanan }}</td>
                  <td class="center">{{ formatValue(ikasDataDynamic.tanggulih.nilai_subdomain4) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Action bar -->
          <div class="ikas-action-bar">
            <input type="file" ref="fileInput" class="d-none" accept=".xlsx, .xls" @change="handleFile" />
            <button @click="goToIkasCrud" class="btn-secondary btn-glare rounded-pill btn-md btn-ikas-input">
              <i class="ri-edit-box-line"></i> Input Data
            </button>
            <button @click="triggerFileInput" class="btn-ikas-upload" :disabled="loading">
              <span v-if="loading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              <i v-else class="ri-file-excel-2-line"></i>
              {{ loading ? 'Mengupload...' : 'Upload Excel' }}
            </button>
          </div>

        </div>
      </div>
    </div>
  </div>

  <!-- Radar Charts Section -->
  <div class="row">
    <div class="col-12">
      <RadarChartIkas :stakeholder-slug="currentSlug" />
    </div>
  </div>

</template>
