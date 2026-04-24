<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useKseStore } from '../../stores/kse';
import { useStakeholdersStore } from '../../stores/stakeholders';
import { useCsirtStore } from '../../stores/csirt';
import { csirtService } from '@/services/csirt.service';
import type { SeCsirt } from '@/types/csirt.types';
import Pageheader from '@/shared/components/pageheader/pageheader.vue';

const route  = useRoute();
const router = useRouter();
const kseStore          = useKseStore();
const stakeholdersStore = useStakeholdersStore();
const csirtStore        = useCsirtStore();

// ── Props / slug ────────────────────────────────────────────
const stakeholderSlug = computed(() => String(route.query.slug || route.params.slug || ''));

const currentStakeholder = computed(() =>
  stakeholdersStore.getStakeholderBySlug(stakeholderSlug.value)
);

// ── Local KSE entry interface ───────────────────────────────
interface KseListEntry {
  id: string;          // compound key used in kseStore, e.g. `${slug}_kse_${ts}`
  namaSistem: string;
  createdAt: string;
  fromApi?: boolean;   // true if entry came from backend API
  seId?: string;       // original SE id from API
  kategoriSe?: string; // category from API
}

const STORAGE_KEY = computed(() => `kse_list_${stakeholderSlug.value}`);

// ── State ────────────────────────────────────────────────────
const kseEntries   = ref<KseListEntry[]>([]);
const searchQuery  = ref('');
const perPage      = ref(10);
const currentPage  = ref(1);
const showAddModal    = ref(false);
const showDeleteModal = ref(false);
const deleteTarget    = ref<KseListEntry | null>(null);
const newNamaSistem   = ref('');
const addError        = ref('');

// ── Initialise ───────────────────────────────────────────────
onMounted(async () => {
  if (!stakeholdersStore.initialized) await stakeholdersStore.initialize();
  if (!csirtStore.initialized) await csirtStore.initialize();
  kseStore.initialize();
  await loadEntries();
});

async function loadEntries() {
  // 1. Load local entries
  let localEntries: KseListEntry[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY.value);
    localEntries = raw ? JSON.parse(raw) : [];
  } catch { localEntries = []; }

  // 2. Fetch SE from csirtStore (same approach as csirt.vue)
  let apiEntries: KseListEntry[] = [];
  try {
    const companyId = currentStakeholder.value?.id;
    if (companyId) {
      // Find the CSIRT for this company from the store
      const myCsirt = csirtStore.csirts.find(c =>
        String(c.id_perusahaan) === String(companyId) ||
        String((c as any).perusahaan?.id) === String(companyId)
      );

      let companySe: SeCsirt[] = [];

      if (myCsirt && myCsirt.id) {
        // Ensure SDM/SE are loaded for this CSIRT (like csirt.vue does)
        await csirtStore.refresh({
          fetchGlobal: false,
          targetCsirtId: myCsirt.id,
          targetCompanyId: companyId,
        });

        // Filter SE from store seList (same matching logic as csirt.vue seItems computed)
        const csirtId = String(myCsirt.id);
        companySe = csirtStore.seList.filter((item: any) => {
          return String(item.id_csirt) === csirtId ||
                 String(item.csirt_id) === csirtId ||
                 String(item.csirt?.id) === csirtId ||
                 (item.id_perusahaan && String(item.id_perusahaan) === String(companyId));
        });
      } else {
        // No CSIRT yet — try direct API fallback
        const csirtFromApi = await csirtService.getCsirtByPerusahaan(companyId).catch(() => null);
        if (csirtFromApi && csirtFromApi.id) {
          companySe = await csirtService.getSeByCsirtId(csirtFromApi.id).catch(() => []);
        }
      }

      apiEntries = companySe.map(se => {
        // Match with local entry to preserve existing store data
        const localMatch = localEntries.find(le =>
          String(le.seId) === String(se.id) ||
          le.id === `${stakeholderSlug.value}_kse_se_${se.id}`
        );
        const entryId = localMatch ? localMatch.id : `${stakeholderSlug.value}_kse_se_${se.id}`;
        
        return {
          id: entryId,
          namaSistem: se.nama_se || '',
          createdAt: localMatch ? localMatch.createdAt : (se as any).created_at || new Date().toISOString(),
          fromApi: true,
          seId: String(se.id),
          kategoriSe: se.kategori_se || '',
        };
      });

      // Load penilaian into KSE store for each API entry
      for (let i = 0; i < companySe.length; i++) {
        kseStore.loadAnswersFromApi(apiEntries[i].id, companySe[i]);
      }
    }
  } catch (e) {
    console.warn('Failed to load SE from API:', e);
  }

  // 3. Merge: API entries first, then unique local entries
  const mappedIds = new Set(apiEntries.map(e => e.id));
  const mappedSeIds = new Set(apiEntries.map(e => e.seId).filter(Boolean));
  const uniqueLocal = localEntries.filter(e =>
    !mappedIds.has(e.id) &&
    !(e.seId && mappedSeIds.has(e.seId))
  );
  kseEntries.value = [...apiEntries, ...uniqueLocal];
}

function saveEntries() {
  const localOnly = kseEntries.value.filter(e => !e.fromApi);
  localStorage.setItem(STORAGE_KEY.value, JSON.stringify(localOnly));
}

// ── Helpers ──────────────────────────────────────────────────
const maxScore = 50;

function getKseDetail(entry: KseListEntry) {
  return kseStore.getKseData(entry.id);
}

function completionPct(entry: KseListEntry): number {
  return kseStore.getCompletionPercentage(entry.id);
}

function scoreOf(entry: KseListEntry): number {
  return getKseDetail(entry).totalBobot;
}

function kategoriOf(entry: KseListEntry): string {
  const storeKat = getKseDetail(entry).kategoriSE;
  if (storeKat && storeKat !== 'Belum Ditentukan') return storeKat;
  if (entry.kategoriSe) return entry.kategoriSe;
  return storeKat || 'Belum Ditentukan';
}

function isSubmitted(entry: KseListEntry): boolean {
  return getKseDetail(entry).isSubmitted;
}

function fmtDate(iso: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateDetail(iso: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Stats ────────────────────────────────────────────────────
const totalKse     = computed(() => kseEntries.value.length);
const countStrategis = computed(() => kseEntries.value.filter(e => kategoriOf(e) === 'Strategis').length);
const countTinggi    = computed(() => kseEntries.value.filter(e => kategoriOf(e) === 'Tinggi').length);
const countRendah    = computed(() => kseEntries.value.filter(e => kategoriOf(e) === 'Rendah').length);
const countDraft     = computed(() => kseEntries.value.filter(e => !isSubmitted(e)).length);

// ── Filter + Paginate ────────────────────────────────────────
const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  let list = [...kseEntries.value];
  if (q) list = list.filter(e =>
    e.namaSistem.toLowerCase().includes(q) ||
    kategoriOf(e).toLowerCase().includes(q)
  );
  return list;
});

const totalPages = computed(() => Math.ceil(filtered.value.length / perPage.value) || 1);

const paginated = computed(() => {
  const start = (currentPage.value - 1) * perPage.value;
  return filtered.value.slice(start, start + perPage.value);
});

const pageNumbers = computed(() => {
  const pages: number[] = [];
  for (let i = 1; i <= totalPages.value; i++) pages.push(i);
  return pages;
});

function onSearch() { currentPage.value = 1; }
function clearSearch() { searchQuery.value = ''; currentPage.value = 1; }

// ── Add KSE ──────────────────────────────────────────────────
function openAdd() { newNamaSistem.value = ''; addError.value = ''; showAddModal.value = true; }
function closeAdd() { showAddModal.value = false; }

async function confirmAdd() {
  if (!newNamaSistem.value.trim()) { addError.value = 'Nama sistem tidak boleh kosong.'; return; }

  const id = `${stakeholderSlug.value}_kse_${Date.now()}`;
  const entry: KseListEntry = {
    id,
    namaSistem: newNamaSistem.value.trim(),
    createdAt:  new Date().toISOString(),
  };

  // Pre-create kseStore entry with namaSistem as jenisUsaha placeholder
  kseStore.updateStakeholderInfo(id, entry.namaSistem, currentStakeholder.value?.sub_sektor?.nama_sub_sektor || currentStakeholder.value?.sektor || '');

  kseEntries.value.unshift(entry);
  saveEntries();
  showAddModal.value = false;

  // ── Integrate with SE CSIRT backend ──────────────────────────
  // Look up the CSIRT for this company so the SE can be created in the backend
  let csirtId = '';
  const companyId = currentStakeholder.value?.id;
  if (companyId) {
    try {
      const myCsirt = await csirtService.getCsirtByPerusahaan(companyId);
      if (myCsirt && myCsirt.id) {
        csirtId = String(myCsirt.id);
      }
    } catch (e) {
      console.warn('[KSE-list] Could not resolve CSIRT for company:', e);
    }
  }

  // Pre-fill respondent profile with company + CSIRT data for the SE creation flow
  localStorage.setItem(`kse_respondent_${id}`, JSON.stringify({
    namaPerusahaan   : currentStakeholder.value?.nama_perusahaan || '',
    jenisUsaha       : currentStakeholder.value?.sub_sektor?.nama_sub_sektor || currentStakeholder.value?.sektor || '',
    namaSistem       : entry.namaSistem,
    alamat           : currentStakeholder.value?.alamat   || '',
    email            : currentStakeholder.value?.email    || '',
    nomorTelepon     : currentStakeholder.value?.telepon  || '',
    tanggalPengisian : new Date().toISOString().split('T')[0],
    ip_se            : '',
    as_number_se     : '',
    pengelola_se     : '',
    fitur_se         : '',
    fromCsirt        : true,
    id_csirt         : csirtId,
    id_perusahaan    : String(companyId || ''),
    id_sub_sektor    : String(currentStakeholder.value?.sub_sektor?.id || ''),
  }));

  // Go to the KSE CRUD form with CSIRT source so SE detail fields are editable
  router.push({ path: '/kse-crud', query: { slug: id, source: 'csirt', stakeholder: stakeholderSlug.value } });
}

// ── View / Edit ───────────────────────────────────────────────
function viewKse(entry: KseListEntry) {
  if (entry.fromApi && entry.seId) {
    router.push({ path: '/kse-crud', query: { seId: entry.seId, stakeholder: stakeholderSlug.value, mode: 'view' } });
  } else {
    router.push({ path: '/kse-crud', query: { slug: entry.id, source: 'kse', stakeholder: stakeholderSlug.value, mode: 'view' } });
  }
}

function editKse(entry: KseListEntry) {
  if (entry.fromApi && entry.seId) {
    router.push({ path: '/kse-crud', query: { seId: entry.seId, source: 'kse', stakeholder: stakeholderSlug.value } });
  } else {
    router.push({ path: '/kse-crud', query: { slug: entry.id, source: 'kse', stakeholder: stakeholderSlug.value } });
  }
}

// ── Delete ────────────────────────────────────────────────────
function openDelete(entry: KseListEntry) { deleteTarget.value = entry; showDeleteModal.value = true; }
function closeDelete() { showDeleteModal.value = false; deleteTarget.value = null; }

async function confirmDelete() {
  if (!deleteTarget.value) return;
  if (deleteTarget.value.fromApi && deleteTarget.value.seId) {
    try { await csirtService.deleteSe(deleteTarget.value.seId as any); }
    catch (e) { console.warn('Failed to delete SE from API:', e); }
  }
  kseEntries.value = kseEntries.value.filter(e => e.id !== deleteTarget.value!.id);
  kseStore.resetStakeholderData(deleteTarget.value.id);
  saveEntries();
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value;
  closeDelete();
}

// ── Pageheader breadcrumb ─────────────────────────────────────
const dataToPass = computed(() => {
  const s = currentStakeholder.value;
  return {
    title: s
      ? { label: `Profile ${s.nama_perusahaan}`, path: `/stakeholders/${stakeholderSlug.value}` }
      : { label: 'Stakeholders', path: '/stakeholders' },
    currentpage: 'KSE',
    activepage: 'KSE',
  };
});

// ── Back ──────────────────────────────────────────────────────
function goBack() {
  if (route.query.from === 'dashboard') {
    router.push({ 
      path: '/dashboard', 
      query: { reopen: route.query.reopen } 
    });
  } else {
    router.push(`/stakeholders/${stakeholderSlug.value}`);
  }
}

// ── Category badge ────────────────────────────────────────────
function kategoriVariant(k: string): string {
  if (k === 'Strategis')      return 'kategori-strategis';
  if (k === 'Tinggi')         return 'kategori-tinggi';
  if (k === 'Rendah')         return 'kategori-rendah';
  return 'kategori-default';
}

function scoreColorClass(entry: KseListEntry): string {
  const k = kategoriOf(entry);
  if (k === 'Strategis') return 'bg-danger';
  if (k === 'Tinggi')    return 'bg-warning';
  if (k === 'Rendah')    return 'bg-primary';
  return 'bg-secondary';
}

function progressClass(pct: number): string {
  if (pct === 100) return 'bg-success';
  if (pct >= 60)   return 'bg-info';
  if (pct >= 30)   return 'bg-warning';
  return 'bg-danger';
}
</script>

<template>
  <!-- ══════════════════ PAGEHEADER ══════════════════ -->
  <Pageheader :propData="dataToPass" />

  <!-- ══════════════════ PAGE ══════════════════ -->
  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card gradient-header-card">

        <!-- ══ HEADER ══════════════════════════════════════════ -->
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3 kse-header">
          <!-- Left: icon + title -->
          <div class="d-flex align-items-center gap-4">
            <div class="header-icon-box">
              <i class="ri-shield-check-line"></i>
              <div class="kse-icon-rings"></div>
            </div>
            <div>
              
              <div class="header-card-title text-white fw-bold">Kategorisasi Sistem Elektronik</div>
              <div class="header-subtitle mt-1">
                {{ currentStakeholder?.sub_sektor?.nama_sub_sektor || currentStakeholder?.sektor || '' }} &bull;
                {{ totalKse }} sistem terdaftar
              </div>
            </div>
          </div>

          <!-- Back to Dashboard Btn -->
          <div v-if="route.query.from === 'dashboard'" class="ms-auto me-2">
            <button @click="goBack" 
                    class="btn btn-sm btn-outline-white border-0 shadow-none text-white d-flex align-items-center gap-1">
              <i class="ri-arrow-left-line"></i> Kembali ke Dashboard
            </button>
          </div>

          <!-- Right: search + add btn -->
          <div class="d-flex gap-2 align-items-center flex-wrap">
            <div class="search-container position-relative">
              <i class="ri-search-line card-search-icon"></i>
              <input
                v-model="searchQuery"
                @input="onSearch"
                type="text"
                class="form-control form-control-sm header-search-input"
                placeholder="Cari sistem elektronik..."
              />
              <button v-if="searchQuery" @click="clearSearch" class="clear-btn">
                <i class="ri-close-circle-fill"></i>
              </button>
            </div>
          </div>
        </div><!-- /header -->

        <div class="card-body p-4">

          <!-- ══ STATS STRIP ════════════════════════════════════ -->
          <div class="stats-strip">
            <div class="stat-card">
              <div class="stat-icon stat-icon-blue"><i class="ri-stack-line"></i></div>
              <div>
                <div class="stat-value">{{ totalKse }}</div>
                <div class="stat-label">Total KSE</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon-red"><i class="ri-alert-fill"></i></div>
              <div>
                <div class="stat-value">{{ countStrategis }}</div>
                <div class="stat-label">Strategis</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon-amber"><i class="ri-arrow-up-circle-fill"></i></div>
              <div>
                <div class="stat-value">{{ countTinggi }}</div>
                <div class="stat-label">Tinggi</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon-teal"><i class="ri-checkbox-circle-fill"></i></div>
              <div>
                <div class="stat-value">{{ countRendah }}</div>
                <div class="stat-label">Rendah</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon-violet"><i class="ri-draft-line"></i></div>
              <div>
                <div class="stat-value">{{ countDraft }}</div>
                <div class="stat-label">Draft</div>
              </div>
            </div>
          </div><!-- /stats -->

          <!-- ══ CONTROLS BAR ═══════════════════════════════════ -->
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 controls-bar mb-3">
            <div class="d-flex align-items-center gap-2">
              <span class="text-muted" style="font-size:13px;">Tampilkan</span>
              <select v-model.number="perPage" class="form-select entries-select" @change="currentPage=1">
                <option :value="5">5</option>
                <option :value="10">10</option>
                <option :value="25">25</option>
                <option :value="50">50</option>
              </select>
              <span class="text-muted" style="font-size:13px;">entri</span>
            </div>
            <!-- <div class="text-muted" style="font-size:13px;">
              Menampilkan
              <strong>{{ Math.min((currentPage - 1) * perPage + 1, filtered.length || 0) }}</strong>
              –
              <strong>{{ Math.min(currentPage * perPage, filtered.length) }}</strong>
              dari <strong>{{ filtered.length }}</strong> hasil
            </div> -->
            <button @click="openAdd" class="kse-add-btn bg-warning">
              <i class="ri-add-line me-1"></i>Tambah KSE
            </button>
          </div>

          <!-- ══ TABLE ══════════════════════════════════════════ -->
          <div class="kse-table-wrap">
            <table class="table kse-table">
              <thead class="kse-thead">
                <tr>
                  <th class="th-no text-center">No</th>
                  <th class="th-sistem">Nama Sistem Elektronik</th>
                  <th class="th-kat text-center">Kategori</th>
                  <th class="th-score text-center">Skor</th>
                  <th class="th-progress">Kelengkapan</th>
                  <th class="th-status text-center">Status</th>
                  <th class="th-date">Dibuat</th>
                  <th class="th-date">Diperbarui</th>
                  <th class="th-act text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <!-- Empty state -->
                <tr v-if="paginated.length === 0">
                  <td colspan="9">
                    <div class="empty-state text-center">
                      <div class="empty-icon-ring">
                        <div class="empty-icon-inner">
                          <i class="ri-shield-check-line"></i>
                        </div>
                      </div>
                      <div class="mt-4">
                        <h6 class="fw-bold empty-state-title">
                          {{ searchQuery ? 'Tidak ada hasil pencarian' : 'Belum ada KSE' }}
                        </h6>
                        <p class="text-muted mb-3" style="font-size:13px">
                          {{ searchQuery
                            ? `Tidak ditemukan KSE dengan kata kunci "${searchQuery}"`
                            : 'Klik tombol Tambah KSE untuk mendaftarkan Sistem Elektronik pertama.' }}
                        </p>
                        <button v-if="!searchQuery" @click="openAdd" class="kse-add-btn">
                          <i class="ri-add-line me-1"></i>Tambah KSE
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>

                <!-- Data rows -->
                <tr
                  v-for="(entry, idx) in paginated"
                  :key="entry.id"
                  class="kse-row"
                >
                  <!-- No -->
                  <td class="text-center">
                    <span class="row-number">{{ (currentPage - 1) * perPage + idx + 1 }}</span>
                  </td>

                  <!-- Nama Sistem -->
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <div class="kse-sys-icon">
                        <i class="ri-computer-line"></i>
                      </div>
                      <div>
                        <div class="kse-sys-name">{{ entry.namaSistem }}</div>
                        <div class="kse-sys-sub">{{ currentStakeholder?.nama_perusahaan }}</div>
                      </div>
                    </div>
                  </td>

                  <!-- Kategori -->
                  <td class="text-center">
                    <span class="kse-badge" :class="kategoriVariant(kategoriOf(entry))">
                      <i class="ri-shield-fill me-1" style="font-size:10px"></i>
                      {{ kategoriOf(entry) }}
                    </span>
                  </td>

                  <!-- Skor -->
                  <td class="text-center">
                    <div class="kse-score-wrap">
                      <span class="kse-score-num">{{ scoreOf(entry) }}</span>
                      <span class="kse-score-max">/ {{ maxScore }}</span>
                    </div>
                    <div class="kse-score-bar">
                      <div
                        class="kse-score-fill"
                        :class="scoreColorClass(entry)"
                        :style="{ width: Math.min(Math.round((scoreOf(entry)/maxScore)*100), 100) + '%' }"
                      ></div>
                    </div>
                  </td>

                  <!-- Kelengkapan -->
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <div class="kse-prog-bar-wrap flex-grow-1">
                        <div
                          class="kse-prog-fill"
                          :class="progressClass(completionPct(entry))"
                          :style="{ width: completionPct(entry) + '%' }"
                        ></div>
                      </div>
                      <span class="kse-prog-pct">{{ completionPct(entry) }}%</span>
                    </div>
                  </td>

                  <!-- Status -->
                  <td class="text-center">
                    <span v-if="isSubmitted(entry)" class="kse-status kse-status-done">
                      <i class="ri-lock-fill"></i> Final
                    </span>
                    <span v-else class="kse-status kse-status-draft">
                      <i class="ri-edit-2-line"></i> Draft
                    </span>
                  </td>

                  <!-- Dibuat -->
                  <td>
                    <span class="kse-date">{{ fmtDate(entry.createdAt) }}</span>
                  </td>

                  <!-- Diperbarui -->
                  <td>
                    <span class="kse-date">{{ fmtDateDetail(getKseDetail(entry).lastUpdated) }}</span>
                  </td>

                  <!-- Aksi -->
                  <td class="text-center">
                    <div class="d-flex justify-content-center gap-1">
                      <button @click="viewKse(entry)" class="btn btn-sm btn-icon btn-wave btn-info-light" title="Lihat Detail">
                        <i class="ri-eye-line"></i>
                      </button>
                      <button
                        @click="editKse(entry)"
                        class="btn btn-sm btn-icon btn-wave btn-success-light"
                        title="Isi / Edit"
                      >
                        <i class="ri-pencil-line"></i>
                      </button>
                      <button @click="openDelete(entry)" class="btn btn-sm btn-icon btn-wave btn-danger-light" title="Hapus">
                        <i class="ri-delete-bin-2-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div><!-- /table-wrap -->

          <!-- ══ PAGINATION ═════════════════════════════════════ -->
          <div v-if="totalPages > 1" class="d-flex justify-content-center mt-4">
            <nav>
              <ul class="pagination mb-0">
                <li class="page-item" :class="{ disabled: currentPage === 1 }">
                  <button class="page-link" @click="currentPage--">
                    <i class="ri-arrow-left-s-line"></i>
                  </button>
                </li>
                <li
                  v-for="p in pageNumbers"
                  :key="p"
                  class="page-item"
                  :class="{ active: currentPage === p }"
                >
                  <button class="page-link" @click="currentPage = p">{{ p }}</button>
                </li>
                <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                  <button class="page-link" @click="currentPage++">
                    <i class="ri-arrow-right-s-line"></i>
                  </button>
                </li>
              </ul>
            </nav>
          </div>

        </div><!-- /card-body -->
      </div><!-- /card -->
    </div>
  </div>

  <!-- ══ ADD MODAL ══════════════════════════════════════════════ -->  <teleport to="body">
    <transition name="kse-modal-fade">
      <div v-if="showAddModal" class="kse-modal-overlay" @click.self="closeAdd">
        <div class="kse-modal-box">
          <!-- Header -->
          <div class="kse-modal-header">
            <div class="d-flex align-items-center gap-3">
              <div class="kse-modal-icon-wrap">
                <i class="ri-add-circle-fill"></i>
              </div>
              <div>
                <div class="kse-modal-title">Tambah KSE Baru</div>
                <div class="kse-modal-sub">{{ currentStakeholder?.nama_perusahaan }}</div>
              </div>
            </div>
            <button @click="closeAdd" class="kse-modal-close"><i class="ri-close-line"></i></button>
          </div>
          <!-- Body -->
          <div class="kse-modal-body">
            <p class="text-muted mb-3" style="font-size:13px">
              Masukkan nama Sistem Elektronik yang akan dikategorisasi.
              Setiap sistem dinilai secara terpisah.
            </p>
            <label class="form-label fw-semibold" style="font-size:13px">
              Nama Sistem Elektronik <span class="text-danger">*</span>
            </label>
            <input
              v-model="newNamaSistem"
              @keyup.enter="confirmAdd"
              type="text"
              class="form-control kse-modal-input"
              :class="{ 'is-invalid': addError }"
              placeholder="cth: SIMKEU, SIMPEG, Core Banking System..."
              autofocus
            />
            <div v-if="addError" class="invalid-feedback">{{ addError }}</div>
            <div class="mt-2 d-flex align-items-center gap-1 text-muted" style="font-size:12px">
              <i class="ri-information-line"></i>
              Setelah ini Anda akan langsung diarahkan ke halaman pengisian KSE.
            </div>
          </div>
          <!-- Footer -->
          <div class="kse-modal-footer">
            <button @click="closeAdd" class="btn btn-light kse-modal-cancel">Batal</button>
            <button @click="confirmAdd" class="kse-modal-confirm-btn">
              <i class="ri-arrow-right-line me-1"></i> Lanjut Isi KSE
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>

  <!-- ══ DELETE MODAL ═══════════════════════════════════════════ -->
  <teleport to="body">
    <transition name="kse-modal-fade">
      <div v-if="showDeleteModal" class="kse-modal-overlay" @click.self="closeDelete">
        <div class="kse-modal-box kse-modal-sm">
          <div class="kse-modal-header kse-modal-header-danger">
            <div class="d-flex align-items-center gap-3">
              <div class="kse-modal-icon-wrap kse-icon-danger">
                <i class="ri-delete-bin-2-fill"></i>
              </div>
              <div>
                <div class="kse-modal-title">Hapus KSE</div>
                <div class="kse-modal-sub">Tindakan ini tidak dapat dibatalkan</div>
              </div>
            </div>
            <button @click="closeDelete" class="kse-modal-close"><i class="ri-close-line"></i></button>
          </div>
          <div class="kse-modal-body">
            <p style="font-size:13.5px">
              Apakah Anda yakin ingin menghapus KSE
              <strong>&ldquo;{{ deleteTarget?.namaSistem }}&rdquo;</strong>?
              Semua data penilaian yang telah diisi akan terhapus permanen.
            </p>
          </div>
          <div class="kse-modal-footer">
            <button @click="closeDelete" class="btn btn-light kse-modal-cancel">Batal</button>
            <button @click="confirmDelete" class="kse-modal-del-btn">
              <i class="ri-delete-bin-2-line me-1"></i>Ya, Hapus
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>

</template>

