<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { stakeholdersData } from '../data/dummydata';
import { ikasDataStatic, ikasDataDynamic } from '../data/ikas-data';
import Pageheader from '../shared/components/pageheader/pageheader.vue';
import RadarChartIkas from '../shared/components/@spk/charts/ikas-charts.vue';

const router = useRouter();

const dataToPass = computed(() => {
    try {
        const slug = route.query.slug;
        console.log("IKAS Debug: Slug is/is not present:", slug);
        
        if (!stakeholdersData || !Array.isArray(stakeholdersData)) {
            console.error("IKAS Error: stakeholdersData is missing or not an array", stakeholdersData);
            return {
                title: { label: "Dashboards", path: "/dashboards" },
                currentpage: "IKAS",
                activepage: "IKAS",
            };
        }

        const stakeholder = slug ? stakeholdersData.find(s => s.slug === String(slug)) : null;
        console.log("IKAS Debug: Found stakeholder:", stakeholder);

        if (stakeholder) {
            return {
                title: { label: `Profile ${stakeholder.nama_perusahaan}`, path: `/profile-stakeholders/${stakeholder.slug}` },
                currentpage: "IKAS",
                activepage: "IKAS",
            };
        }
    } catch (error) {
        console.error("IKAS Error doing computed:", error);
    }

    return {
        title: { label: "Dashboards", path: "/dashboards" },
        currentpage: "IKAS",
        activepage: "IKAS",
    }
});

const route = useRoute();

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

</style>



<template>
  <Pageheader :propData="dataToPass" />
  <div class="row">
    <div class="col-12">
      <div class="card">
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
                    <td class="center">{{ ikasDataDynamic.identifikasi.nilai_subdomain1 }}</td>
                    <td rowspan="5" class="center">{{ ikasDataDynamic.identifikasi.nilai_identifikasi }}</td>
                    <td rowspan="5" class="center">{{ ikasDataDynamic.identifikasi.kategori_identifikasi }}</td>
                    <td rowspan="18" class="status-big">{{ ikasDataDynamic.total_kategori }}</td>
                  </tr>
                  <tr>
                    <td class="item">Menyusun strategi, kebijakan, dan prosedur Keamanan Siber</td>
                    <td class="center">{{ ikasDataStatic.identifikasi.strategi_kebijakan }}</td>
                    <td class="center">{{ ikasDataDynamic.identifikasi.nilai_subdomain2 }}</td>
                  </tr>
                  <tr>
                    <td class="item">Mengelola aset informasi</td>
                    <td class="center">{{ ikasDataStatic.identifikasi.aset_informasi }}</td>
                    <td class="center">{{ ikasDataDynamic.identifikasi.nilai_subdomain3 }}</td>
                  </tr>
                  <tr>
                    <td class="item">Menilai dan mengelola risiko Keamanan Siber</td>
                    <td class="center">{{ ikasDataStatic.identifikasi.risiko_keamanan }}</td>
                    <td class="center">{{ ikasDataDynamic.identifikasi.nilai_subdomain4 }}</td>
                  </tr>
                  <tr>
                    <td class="item">Mengelola risiko rantai pasok</td>
                    <td class="center">{{ ikasDataStatic.identifikasi.rantai_pasok }}</td>
                    <td class="center">{{ ikasDataDynamic.identifikasi.nilai_subdomain5 }}</td>
                  </tr>

                  <!-- PROTEKSI -->
                  <tr>
                    <td rowspan="6" class="domain purple">PROTEKSI</td>
                    <td class="item">Mengelola identitas, autentikasi, dan kendali akses</td>
                    <td class="center">{{ ikasDataStatic.proteksi.identitas_autentikasi }}</td>
                    <td class="center">{{ ikasDataDynamic.proteksi.nilai_subdomain1 }}</td>
                    <td rowspan="6" class="center">{{ ikasDataDynamic.proteksi.nilai_proteksi }}</td>
                    <td rowspan="6" class="center">{{ ikasDataDynamic.proteksi.kategori_proteksi }}</td>
                  </tr>
                  <tr>
                    <td class="item">Melindungi aset fisik</td>
                    <td class="center">{{ ikasDataStatic.proteksi.aset_fisik }}</td>
                    <td class="center">{{ ikasDataDynamic.proteksi.nilai_subdomain2 }}</td>
                  </tr>
                  <tr>
                    <td class="item">Melindungi data</td>
                    <td class="center">{{ ikasDataStatic.proteksi.data }}</td>
                    <td class="center">{{ ikasDataDynamic.proteksi.nilai_subdomain3 }}</td>
                  </tr>
                  <tr>
                    <td class="item">Melindungi aplikasi</td>
                    <td class="center">{{ ikasDataStatic.proteksi.aplikasi }}</td>
                    <td class="center">{{ ikasDataDynamic.proteksi.nilai_subdomain4 }}</td>
                  </tr>
                  <tr>
                    <td class="item">Melindungi jaringan</td>
                    <td class="center">{{ ikasDataStatic.proteksi.jaringan }}</td>
                    <td class="center">{{ ikasDataDynamic.proteksi.nilai_subdomain5 }}</td>
                  </tr>
                  <tr>
                    <td class="item">Melindungi sumber daya manusia</td>
                    <td class="center">{{ ikasDataStatic.proteksi.sdm }}</td>
                    <td class="center">{{ ikasDataDynamic.proteksi.nilai_subdomain6 }}</td>
                  </tr>

                  <!-- DETEKSI -->
                  <tr>
                    <td rowspan="3" class="domain orange">DETEKSI</td>
                    <td class="item">Mengelola deteksi Peristiwa Siber</td>
                    <td class="center">{{ ikasDataStatic.deteksi.deteksi_peristiwa }}</td>
                    <td class="center">{{ ikasDataDynamic.deteksi.nilai_subdomain1 }}</td>
                    <td rowspan="3" class="center">{{ ikasDataDynamic.deteksi.nilai_deteksi }}</td>
                    <td rowspan="3" class="center">{{ ikasDataDynamic.deteksi.kategori_deteksi }}</td>
                  </tr>
                  <tr>
                    <td class="item">Menganalisis anomali dan Peristiwa Siber</td>
                    <td class="center">{{ ikasDataStatic.deteksi.anomali_peristiwa }}</td>
                    <td class="center">{{ ikasDataDynamic.deteksi.nilai_subdomain2 }}</td>
                  </tr>
                  <tr>
                    <td class="item">Memantau Peristiwa Siber berkelanjutan</td>
                    <td class="center">{{ ikasDataStatic.deteksi.pemantauan_berkelanjutan }}</td>
                    <td class="center">{{ ikasDataDynamic.deteksi.nilai_subdomain3 }}</td>
                  </tr>

                  <!-- PENANGGULANGAN & PEMULIHAN -->
                  <tr>
                    <td rowspan="4" class="domain green">PENANGGULANGAN & PEMULIHAN</td>
                    <td class="item">Menyusun perencanaan penanggulangan dan pemulihan Insiden Siber</td>
                    <td class="center">{{ ikasDataStatic.gulih.perencanaan_pemulihan }}</td>
                    <td class="center">{{ ikasDataDynamic.gulih.nilai_subdomain1 }}</td>
                    <td rowspan="4" class="center">{{ ikasDataDynamic.gulih.nilai_gulih }}</td>
                    <td rowspan="4" class="center">{{ ikasDataDynamic.gulih.kategori_gulih }}</td>
                  </tr>
                  <tr>
                    <td class="item">Menganalisis dan melaporkan Insiden Siber</td>
                    <td class="center">{{ ikasDataStatic.gulih.analisis_pelaporan }}</td>
                    <td class="center">{{ ikasDataDynamic.gulih.nilai_subdomain2 }}</td>
                  </tr>
                  <tr>
                    <td class="item">Melaksanakan penanggulangan dan pemulihan Insiden Siber</td>
                    <td class="center">{{ ikasDataStatic.gulih.pelaksanaan_pemulihan }}</td>
                    <td class="center">{{ ikasDataDynamic.gulih.nilai_subdomain3 }}</td>
                  </tr>
                  <tr>
                    <td class="item">Meningkatkan keamanan setelah terjadinya Insiden Siber</td>
                    <td class="center">{{ ikasDataStatic.gulih.peningkatan_keamanan }}</td>
                    <td class="center">{{ ikasDataDynamic.gulih.nilai_subdomain4 }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="d-flex justify-content-end gap-2 mt-3">
              <button @click="router.push('/ikas-crud')" class="btn btn-secondary btn-glare rounded-pill btn-md">Input Data</button>
              <button class="btn btn-success btn-glare rounded-pill btn-md">Upload</button>
            </div>
        </div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-12">
      <div class="card">
        <div class="card-body">
          <RadarChartIkas />
        </div>
      </div>
    </div>
  </div>
  
</template>
