<script lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { stakeholdersData, type Stakeholder } from "../../data/dummydata";
import EasyDataTable from "vue3-easy-data-table";
import "vue3-easy-data-table/dist/style.css";

export default {
  data() {
    return {
      dataToPass: {
        title: { label: "Dashboards", path: "/dashboards" },
        currentpage: "Stakeholders",
        activepage: "Stakeholders",
      },
    };
  },
  components: { Pageheader, EasyDataTable },
  setup() {
    const items = ref<Stakeholder[]>([]);
    const loading = ref(false);
    const searchQuery = ref("");
    const searchValue2 = ref("");
    const sortField = ref<"nama_perusahaan" | "sektor">("nama_perusahaan");
    const sortOrder = ref<"asc" | "desc">("asc");
    const currentPage = ref(1);
    const itemsPerPage = ref(10);

    const headers = [
      { text: "Nama Perusahaan", value: "nama_perusahaan", sortable: true },
      { text: "Sektor", value: "sektor", sortable: true },
      { text: "Email", value: "email", sortable: true },
      { text: "Aksi", value: "id" },
    ];

    const loadStakeholders = async () => {
      loading.value = true;
      await new Promise((r) => setTimeout(r, 500));
      items.value = stakeholdersData;
      loading.value = false;
    };

    const filteredData = computed(() => {
      let data = items.value;
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        data = data.filter(
          (i) =>
            i.nama_perusahaan.toLowerCase().includes(q) ||
            i.sektor.toLowerCase().includes(q) ||
            i.email.toLowerCase().includes(q)
        );
      }
      return [...data].sort((a, b) => {
        const mod = sortOrder.value === "asc" ? 1 : -1;
        return a[sortField.value].localeCompare(b[sortField.value]) * mod;
      });
    });

    const totalPages = computed(() =>
      Math.ceil(filteredData.value.length / itemsPerPage.value)
    );

    const displayData = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredData.value.slice(start, start + itemsPerPage.value);
    });

    const paginationInfo = computed(() => {
      const total = filteredData.value.length;
      if (!total) return "Tidak ada data";
      const start = (currentPage.value - 1) * itemsPerPage.value + 1;
      const end = Math.min(currentPage.value * itemsPerPage.value, total);
      return `${start} - ${end} dari ${total}`;
    });

    watch([searchQuery, itemsPerPage], () => (currentPage.value = 1));

    onMounted(loadStakeholders);

    return {
      items,
      loading,
      searchQuery,
      searchValue2,
      headers,
      sortField,
      sortOrder,
      currentPage,
      itemsPerPage,
      totalPages,
      displayData,
      paginationInfo,
      toggleSort: (f: "nama_perusahaan" | "sektor") => {
        if (sortField.value === f)
          sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
        else {
          sortField.value = f;
          sortOrder.value = "asc";
        }
      },
      clearSearch: () => {
        searchQuery.value = "";
        currentPage.value = 1;
      },
    };
  },
};
</script>

<template>
  <Pageheader :propData="dataToPass" />
  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card">
        <div
          class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3"
        >
          <div class="card-title">Tabel Daftar Stakeholders</div>
          <div
            class="search-container position-relative"
            style="max-width: 350px; flex: 1"
          >
            <input
              v-model="searchQuery"
              type="text"
              class="form-control form-control-sm"
              placeholder="Cari perusahaan, sektor, atau email"
            />
            <i v-if="!searchQuery" class="ri-search-line search-icon"></i>
            <button v-else @click="clearSearch" class="btn btn-sm clear-btn">
              <i class="ri-close-line"></i>
            </button>
          </div>
        </div>

        <div class="card-body p-3">
          <div v-if="loading" class="text-center p-4">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>

          <template v-else>
            <!-- Controls -->
            <div
              class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2"
            >
              <div class="d-flex align-items-center gap-2">
                <span class="text-muted fs-13">Tampilkan</span>
                <select
                  v-model="itemsPerPage"
                  class="form-select form-select-sm"
                  style="width: 75px"
                >
                  <option
                    v-for="n in [5, 10, 15, 20, 25, 50]"
                    :key="n"
                    :value="n"
                  >
                    {{ n }}
                  </option>
                </select>
                <span class="text-muted fs-13">per halaman</span>
              </div>
            </div>

            <!-- Table -->
            <div class="table-responsive">
              <table class="table text-nowrap mb-0">
                <thead>
                  <tr>
                    <th>No</th>
                    <th class="sortable">
                      <div class="d-flex align-items-center gap-1">
                        <span
                          class="column-label"
                          @click="toggleSort('nama_perusahaan')"
                          title="Click to toggle sort"
                          >Nama Perusahaan</span
                        >
                        <div class="sort-arrows">
                          <i
                            class="ri-arrow-up-s-line"
                            :class="{
                              active:
                                sortField === 'nama_perusahaan' &&
                                sortOrder === 'asc',
                            }"
                            @click.stop="
                              sortField = 'nama_perusahaan';
                              sortOrder = 'asc';
                            "
                            title="Sort A-Z"
                          ></i>
                          <i
                            class="ri-arrow-down-s-line"
                            :class="{
                              active:
                                sortField === 'nama_perusahaan' &&
                                sortOrder === 'desc',
                            }"
                            @click.stop="
                              sortField = 'nama_perusahaan';
                              sortOrder = 'desc';
                            "
                            title="Sort Z-A"
                          ></i>
                        </div>
                      </div>
                    </th>
                    <th class="sortable">
                      <div class="d-flex align-items-center gap-1">
                        <span
                          class="column-label"
                          @click="toggleSort('sektor')"
                          title="Click to toggle sort"
                          >Sektor</span
                        >
                        <div class="sort-arrows">
                          <i
                            class="ri-arrow-up-s-line"
                            :class="{
                              active:
                                sortField === 'sektor' && sortOrder === 'asc',
                            }"
                            @click.stop="
                              sortField = 'sektor';
                              sortOrder = 'asc';
                            "
                            title="Sort A-Z"
                          ></i>
                          <i
                            class="ri-arrow-down-s-line"
                            :class="{
                              active:
                                sortField === 'sektor' && sortOrder === 'desc',
                            }"
                            @click.stop="
                              sortField = 'sektor';
                              sortOrder = 'desc';
                            "
                            title="Sort Z-A"
                          ></i>
                        </div>
                      </div>
                    </th>
                    <th>Email</th>
                    <th class="text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!displayData.length">
                    <td colspan="5" class="text-center text-muted py-4">
                      <i class="ri-inbox-line fs-2 d-block mb-2"></i>Data tidak
                      ditemukan
                    </td>
                  </tr>
                  <tr v-for="(item, i) in displayData" :key="item.slug">
                    <td>{{ (currentPage - 1) * itemsPerPage + i + 1 }}</td>
                    <td class="fw-semibold">{{ item.nama_perusahaan }}</td>
                    <td>
                      <span class="badge bg-info-transparent fs-13">{{
                        item.sektor
                      }}</span>
                    </td>
                    <td>{{ item.email }}</td>
                    <td class="text-center">
                      <router-link
                        :to="`/profile-stakeholders/${item.slug}`"
                        class="btn btn-sm btn-info-light me-1"
                      >
                        <i class="ri-eye-line"></i> Lihat Profil
                      </router-link>
                      <router-link
                        :to="`/ikas?slug=${item.slug}`"
                        class="btn btn-sm px-4 btn-warning-light"
                      >
                        <i class="ri-file-chart-line"></i> IKAS
                      </router-link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div
              v-if="totalPages > 1"
              class="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-3 border-top gap-2"
            >
              <span class="text-muted fs-13"
                >Halaman {{ currentPage }} dari {{ totalPages }}</span
              >
              <nav>
                <ul class="pagination pagination-sm mb-0">
                  <li
                    class="page-item"
                    :class="{ disabled: currentPage === 1 }"
                  >
                    <a
                      class="page-link"
                      href="#"
                      @click.prevent="currentPage = 1"
                      ><i class="ri-skip-back-mini-line"></i
                    ></a>
                  </li>
                  <li
                    class="page-item"
                    :class="{ disabled: currentPage === 1 }"
                  >
                    <a class="page-link" href="#" @click.prevent="currentPage--"
                      ><i class="ri-arrow-left-s-line"></i
                    ></a>
                  </li>
                  <template v-for="p in totalPages" :key="p">
                    <li
                      v-if="
                        p === 1 ||
                        p === totalPages ||
                        (p >= currentPage - 1 && p <= currentPage + 1)
                      "
                      class="page-item"
                      :class="{ active: p === currentPage }"
                    >
                      <a
                        class="page-link"
                        href="#"
                        @click.prevent="currentPage = p"
                        >{{ p }}</a
                      >
                    </li>
                    <li
                      v-else-if="p === currentPage - 2 || p === currentPage + 2"
                      class="page-item disabled"
                    >
                      <span class="page-link">...</span>
                    </li>
                  </template>
                  <li
                    class="page-item"
                    :class="{ disabled: currentPage === totalPages }"
                  >
                    <a class="page-link" href="#" @click.prevent="currentPage++"
                      ><i class="ri-arrow-right-s-line"></i
                    ></a>
                  </li>
                  <li
                    class="page-item"
                    :class="{ disabled: currentPage === totalPages }"
                  >
                    <a
                      class="page-link"
                      href="#"
                      @click.prevent="currentPage = totalPages"
                      ><i class="ri-skip-forward-mini-line"></i
                    ></a>
                  </li>
                </ul>
              </nav>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
