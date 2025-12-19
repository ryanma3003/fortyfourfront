<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { stakeholdersData } from '../data/dummydata';
import Pageheader from '../shared/components/pageheader/pageheader.vue';
import RadarChartIkas from '../shared/components/@spk/charts/ikas-charts.vue';

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

const domains = [
  {
    name: 'IDENTIFIKASI',
    color: 'blue',
    items: [
      'Mengidentifikasi Peran dan tanggung jawab organisasi',
      'Menyusun strategi, kebijakan, dan prosedur Keamanan Siber',
      'Mengelola aset informasi',
      'Menilai dan mengelola risiko Keamanan Siber',
      'Mengelola risiko rantai pasok'
    ]
  },
  {
    name: 'PROTEKSI',
    color: 'purple',
    items: [
      'Mengelola identitas, autentikasi, dan kendali akses',
      'Melindungi aset fisik',
      'Melindungi data',
      'Melindungi aplikasi',
      'Melindungi jaringan',
      'Melindungi sumber daya manusia'
    ]
  },
  {
    name: 'DETEKSI',
    color: 'orange',
    items: [
      'Mengelola deteksi Peristiwa Siber',
      'Menganalisis anomali dan Peristiwa Siber',
      'Memantau Peristiwa Siber berkelanjutan'
    ]
  },
  {
    name: 'PENANGGULANGAN & PEMULIHAN',
    color: 'green',
    items: [
      'Menyusun perencanaan penanggulangan dan pemulihan Insiden Siber',
      'Menganalisis dan melaporkan Insiden Siber',
      'Melaksanakan penanggulangan dan pemulihan Insiden Siber',
      'Meningkatkan keamanan setelah terjadinya Insiden Siber'
    ]
  }
]

const totalRowspan =
  1 + domains.reduce((sum, d) => sum + d.items.length, 0)
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
                    <th rowspan="2" class="left-title">
                      Tingkat Kematangan<br />Keamanan Siber
                    </th>
                    <th colspan="4" class="year-title">2025</th>
                    <th rowspan="2" class="right-title">
                      Kategori Tingkat Kematangan<br />Keamanan Siber
                    </th>
                  </tr>
                  <tr>
                    <th>Target Nilai Kematangan</th>
                    <th>Nilai Kematangan</th>
                    <th>Nilai Kematangan per-Domain</th>
                    <th>Kategori Tingkat Kematangan per-Domain</th>
                  </tr>
                </thead>

                <tbody>
                  <!-- TOTAL -->
                  <tr>
                    <td class="total">Total</td>
                    <td class="center bold">2.51</td>
                    <td class="center">-</td>
                    <td class="center">-</td>
                    <td class="center">INPUT BELUM LENGKAP</td>
                    <td :rowspan="totalRowspan" class="status-big">
                      INPUT BELUM LENGKAP
                    </td>
                  </tr>

                  <!-- DOMAIN LOOP -->
                  <template v-for="(domain, dIndex) in domains" :key="dIndex">
                    <tr v-for="(item, iIndex) in domain.items" :key="iIndex">
                      <!-- DOMAIN LABEL -->
                      <td
                        v-if="iIndex === 0"
                        :rowspan="domain.items.length"
                        :class="['domain', domain.color]"
                      >
                        {{ domain.name }}
                      </td>

                      <!-- ITEM -->
                      <td class="item">{{ item }}</td>
                      <td class="center">2.51</td>
                      <td class="center">-</td>

                      <!-- KATEGORI PER DOMAIN -->
                      <td
                        v-if="iIndex === 0"
                        :rowspan="domain.items.length"
                        class="center"
                      >
                        INPUT BELUM LENGKAP
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
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
