<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useKseStore } from '../../stores/kse';
import { useStakeholdersStore } from '../../stores/stakeholders';
import { useCsirtStore } from '../../stores/csirt';
import { csirtService } from '@/services/csirt.service';
import { seEditService } from '@/services/se-edit.service';
import type { SeCsirt } from '@/types/csirt.types';
import type { SeEditRequest } from '@/types/se-edit.types';
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
const editRequests    = ref<SeEditRequest[]>([]);

// ── Initialise ───────────────────────────────────────────────
onMounted(async () => {
  if (!stakeholdersStore.initialized) await stakeholdersStore.initialize();
  if (!csirtStore.initialized) await csirtStore.initialize();
  kseStore.initialize();
  await Promise.all([
    loadEntries(),
    fetchEditRequests()
  ]);
});

async function fetchEditRequests() {
  try {
    editRequests.value = await seEditService.getRequests();
  } catch {}
}

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
  } catch {}

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

function hasPendingRequest(seId?: string): boolean {
  if (!seId) return false;
  return editRequests.value.some(r => String(r.id_se) === String(seId) && r.status === 'pending');
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
    } catch {}
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

  // Go to the KSE CRUD form with source so SE detail fields are editable
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
    catch {}
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
  if (route.query.from === 'admin') {
    return {
      title: { label: 'KSE Management', path: '/kse-list-admin' },
      currentpage: 'KSE',
      activepage: 'KSE',
    };
  }
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
  if (route.query.from === 'admin') {
    router.push('/kse-list-admin');
  } else if (route.query.from === 'dashboard') {
    router.push({ 
      path: '/dashboard', 
      query: { reopen: route.query.reopen } 
    });
  } else {
    router.push(`/stakeholders/${stakeholderSlug.value}`);
  }
}

// ── Category badge ────────────────────────────────────────────
function kategoriBadgeClass(k: string): string {
  if (k === 'Strategis') return 'badge-sektor-red';
  if (k === 'Tinggi')    return 'badge-sektor-amber';
  if (k === 'Rendah')    return 'badge-sektor-teal';
  return 'badge-sektor-default';
}

function scoreFillClass(entry: KseListEntry): string {
  const k = kategoriOf(entry);
  if (k === 'Strategis') return 'bg-danger';
  if (k === 'Tinggi')    return 'bg-warning';
  if (k === 'Rendah')    return 'bg-primary';
  return 'bg-secondary';
}

function progressFillClass(pct: number): string {
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
      <!-- Premium Shell Card -->
      <div class="card custom-card gradient-header-card stakeholders-shell-card" style="overflow: visible !important;">
        
        <!-- ══ PREMIUM HEADER ══════════════════════════════════════════ -->
        <div class="stakeholder-header stakeholders-premium-header kse-premium-header">
          <div class="stakeholders-header-main d-flex align-items-center justify-content-between flex-wrap gap-3">
            
            <!-- Left: Hero Copy + Stats Stack -->
            <div class="stakeholders-hero-copy1 d-flex flex-column gap-1">
              <div>
                <div class="stakeholders-inline-breadcrumb">
                  {{ currentStakeholder?.nama_perusahaan || 'Stakeholder' }} <span>/</span> KSE
                </div>
                <div class="card-title mb-0 fw-bold header-card-title stakeholders-hero-title">
                  Kategorisasi Sistem Elektronik
                </div>
                <div class="header-subtitle mt-1 stakeholders-hero-subtitle">
                  {{ currentStakeholder?.sub_sektor?.nama_sub_sektor || currentStakeholder?.sektor || 'Manajemen Kategorisasi SE' }} &bull;
                  {{ totalKse }} sistem terdaftar
                </div>
              </div>

              <!-- Meta Stats Stack -->
              <div class="stakeholders-meta-stack mt-3">
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Total KSE</span>
                  <strong><i class="ri-stack-line text-primary"></i> {{ totalKse }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Strategis</span>
                  <strong><i class="ri-alert-fill text-danger"></i> {{ countStrategis }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Tinggi</span>
                  <strong><i class="ri-arrow-up-circle-fill text-warning"></i> {{ countTinggi }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Rendah</span>
                  <strong><i class="ri-checkbox-circle-fill text-success"></i> {{ countRendah }}</strong>
                </div>
                <div class="stakeholders-meta-card">
                  <span class="stakeholders-meta-label">Draft</span>
                  <strong><i class="ri-draft-line text-info"></i> {{ countDraft }}</strong>
                </div>
              </div>
            </div>

            <!-- Right: Search & Back Btn -->
            <div class="stakeholders-hero-tools d-flex flex-column align-items-end gap-3">
              <div v-if="route.query.from === 'dashboard'">
                <button @click="goBack" 
                        class="btn btn-sm btn-outline-white border-0 shadow-none text-white d-flex align-items-center gap-1 opacity-75 hover-opacity-100">
                  <i class="ri-arrow-left-line"></i> Kembali ke Dashboard
                </button>
              </div>

              <div class="stakeholders-search position-relative">
                <i class="ri-search-line header-search-icon"></i>
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
          </div>

          <!-- Rows Selector -->
          <div class="header-rows-selector d-flex align-items-center gap-2">
            <span class="text-white opacity-75 fs-11 fw-bold text-uppercase">Rows</span>
            <select v-model.number="perPage" class="form-select form-select-sm header-rows-select" @change="currentPage=1">
              <option v-for="n in [5, 10, 25, 50]" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>
        </div>

        <!-- ══ CARD BODY ══════════════════════════════════════════ -->
        <div class="card-body p-4 stakeholders-premium-body">

          <!-- Add Button -->
          <div class="d-flex justify-content-end mb-4">
            <button @click="openAdd" class="btn btn-primary-gradient px-4 py-2 rounded-pill shadow-sm d-flex align-items-center gap-2">
              <div class="btn-icon-pulse"><i class="ri-add-line"></i></div>
              <span class="fw-bold">Tambah KSE Baru</span>
            </button>
          </div>

          <!-- ══ PREMIUM TABLE ══════════════════════════════════════ -->
          <div class="table-responsive stakeholder-table-wrap stakeholders-table-shell">
            <table class="table stakeholder-table mb-0">
              <thead class="stakeholder-thead">
                <tr>
                  <th class="text-center" style="width: 60px;">No</th>
                  <th>Nama Sistem Elektronik</th>
                  <th class="text-center">Kategori</th>
                  <th class="text-center" style="width: 160px;">Skor / Kelengkapan</th>
                  <th class="text-center">Status</th>
                  <th>Dibuat / Diperbarui</th>
                  <th class="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <!-- Empty state -->
                <tr v-if="paginated.length === 0">
                  <td colspan="7">
                    <div class="empty-state text-center py-5">
                      <div class="empty-icon-ring mb-4">
                        <div class="empty-icon-inner">
                          <i class="ri-shield-check-line"></i>
                        </div>
                      </div>
                      <div class="mt-2">
                        <h5 class="fw-bold empty-state-title">
                          {{ searchQuery ? 'Tidak ada hasil pencarian' : 'Belum ada KSE terdaftar' }}
                        </h5>
                        <p class="text-muted mb-4 mx-auto" style="max-width: 400px; font-size:14px">
                          {{ searchQuery
                            ? `Kami tidak menemukan Sistem Elektronik dengan kata kunci "${searchQuery}". Coba gunakan kata kunci lain.`
                            : 'Mulai dengan menambahkan Sistem Elektronik pertama Anda untuk melakukan penilaian kategorisasi.' }}
                        </p>
                        <button v-if="!searchQuery" @click="openAdd" class="btn btn-primary px-4 rounded-pill">
                          <i class="ri-add-line me-1"></i>Tambah KSE Pertama
                        </button>
                        <button v-else @click="clearSearch" class="btn btn-outline-secondary px-4 rounded-pill">
                          <i class="ri-refresh-line me-1"></i>Reset Pencarian
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>

                <!-- Data rows -->
                <tr
                  v-for="(entry, idx) in paginated"
                  :key="entry.id"
                  class="stakeholder-row"
                >
                  <!-- No -->
                  <td class="text-center align-middle">
                    <span class="row-number">{{ (currentPage - 1) * perPage + idx + 1 }}</span>
                  </td>

                  <!-- Nama Sistem -->
                  <td class="align-middle">
                    <div class="d-flex align-items-center gap-3">
                      <div class="kse-sys-avatar" :class="scoreFillClass(entry)">
                        <i class="ri-macbook-line"></i>
                      </div>
                      <div>
                        <div class="kse-sys-name fw-bold fs-14 text-dark mb-0">
                          {{ entry.namaSistem }}
                          <span v-if="hasPendingRequest(entry.seId)" class="badge bg-warning-transparent text-warning ms-1" style="font-size: 9px; vertical-align: middle;">
                            PENDING REVIEW
                          </span>
                        </div>
                        <div class="text-muted fs-11">ID: {{ entry.seId || entry.id.split('_').pop() }}</div>
                      </div>
                    </div>
                  </td>

                  <!-- Kategori -->
                  <td class="text-center align-middle">
                    <span class="badge-sektor" :class="kategoriBadgeClass(kategoriOf(entry))">
                      <i class="ri-shield-fill me-1"></i>
                      {{ kategoriOf(entry) }}
                    </span>
                  </td>

                  <!-- Skor / Kelengkapan -->
                  <td class="align-middle">
                    <div class="mb-2 d-flex justify-content-between align-items-end">
                      <span class="fs-11 fw-bold text-muted">SKOR: {{ scoreOf(entry) }}/{{ maxScore }}</span>
                      <span class="fs-11 fw-bold" :class="completionPct(entry) === 100 ? 'text-success' : 'text-primary'">{{ completionPct(entry) }}%</span>
                    </div>
                    <div class="progress progress-xs mb-1" style="height: 6px; border-radius: 10px;">
                      <div
                        class="progress-bar"
                        :class="progressFillClass(completionPct(entry))"
                        role="progressbar"
                        :style="{ width: completionPct(entry) + '%' }"
                      ></div>
                    </div>
                  </td>

                  <!-- Status -->
                  <td class="text-center align-middle">
                    <span v-if="isSubmitted(entry)" class="badge-sektor badge-sektor-teal">
                      <i class="ri-lock-fill me-1"></i> FINAL
                    </span>
                    <span v-else class="badge-sektor badge-sektor-slate">
                      <i class="ri-edit-2-line me-1"></i> DRAFT
                    </span>
                  </td>

                  <!-- Dibuat / Diperbarui -->
                  <td class="align-middle">
                    <div class="d-flex flex-column">
                      <div class="fs-12 text-dark fw-medium"><i class="ri-calendar-line me-1 text-muted"></i> {{ fmtDate(entry.createdAt) }}</div>
                      <div class="fs-10 text-muted mt-1"><i class="ri-time-line me-1"></i> {{ fmtDateDetail(getKseDetail(entry).lastUpdated) }}</div>
                    </div>
                  </td>

                  <!-- Aksi -->
                  <td class="text-center align-middle">
                    <div class="d-flex justify-content-center gap-2">
                      <button @click="viewKse(entry)" class="btn btn-sm btn-icon btn-wave btn-info-light stakeholders-action-btn" title="Lihat Detail">
                        <i class="ri-eye-line"></i>
                      </button>
                      <button
                        @click="editKse(entry)"
                        class="btn btn-sm btn-icon btn-wave btn-success-light stakeholders-action-btn"
                        title="Isi / Edit"
                      >
                        <i class="ri-pencil-line"></i>
                      </button>
                      <button @click="openDelete(entry)" class="btn btn-sm btn-icon btn-wave btn-danger-light stakeholders-action-btn" title="Hapus">
                        <i class="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div><!-- /table-wrap -->

          <!-- ══ PAGINATION ═════════════════════════════════════ -->
          <div class="pagination-container stakeholders-pagination mt-4">
            <div class="stakeholders-pagination-copy">
              Menampilkan {{ filtered.length ? (currentPage - 1) * perPage + 1 : 0 }}-{{ Math.min(currentPage * perPage, filtered.length) }} dari {{ filtered.length }} KSE
            </div>
            <div class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
              <span class="stakeholders-page-pill">Halaman {{ currentPage }} dari {{ totalPages || 1 }}</span>
              <nav v-if="totalPages > 1">
                <ul class="pagination pagination-sm mb-0 gap-1">
                  <li class="page-item" :class="{ disabled: currentPage === 1 }">
                    <button class="page-link rounded-circle" @click="currentPage = 1" title="First">
                      <i class="ri-skip-back-mini-line"></i>
                    </button>
                  </li>
                  <li class="page-item" :class="{ disabled: currentPage === 1 }">
                    <button class="page-link rounded-circle" @click="currentPage--" title="Previous">
                      <i class="ri-arrow-left-s-line"></i>
                    </button>
                  </li>
                  <template v-for="p in totalPages" :key="p">
                    <li v-if="p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)" class="page-item" :class="{ active: p === currentPage }">
                      <button class="page-link rounded-circle" @click="currentPage = p">{{ p }}</button>
                    </li>
                    <li v-else-if="p === currentPage - 2 || p === currentPage + 2" class="page-item disabled">
                      <span class="page-link border-0 bg-transparent">...</span>
                    </li>
                  </template>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                    <button class="page-link rounded-circle" @click="currentPage++" title="Next">
                      <i class="ri-arrow-right-s-line"></i>
                    </button>
                  </li>
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                    <button class="page-link rounded-circle" @click="currentPage = totalPages" title="Last">
                      <i class="ri-skip-forward-mini-line"></i>
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </div>

        </div><!-- /card-body -->
      </div><!-- /card shell -->
    </div>
  </div>

  <!-- ══ ADD MODAL ══════════════════════════════════════════════ -->
  <teleport to="body">
    <div v-if="showAddModal" class="modal-overlay" @click.self="closeAdd">
      <div class="modal-dialog modal-dialog-centered modal-sm custom-modal">
        <div class="modal-content border-0 bg-transparent">
          <div class="kse-modal-box kse-modal-sm w-100">
            <div class="kse-modal-header pb-3 mb-2" style="border-bottom: 1px solid rgba(0,0,0,0.05);">
              <div class="d-flex align-items-center gap-3">
                <div class="kse-modal-icon-wrap" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">
                  <i class="ri-add-circle-fill"></i>
                </div>
                <div>
                  <div class="kse-modal-title">Tambah KSE Baru</div>
                  <div class="kse-modal-sub fs-11 text-muted">{{ currentStakeholder?.nama_perusahaan }}</div>
                </div>
              </div>
              <button @click="closeAdd" class="btn-close ms-auto shadow-none"></button>
            </div>
            
            <div class="kse-modal-body text-start">
              <p class="text-muted mb-4 fs-13">
                Masukkan nama Sistem Elektronik yang akan dikategorisasi.
                Setiap sistem akan dinilai secara terpisah.
              </p>
              
              <div class="mb-3">
                <label class="form-label fs-12 fw-bold text-uppercase tracking-wider text-muted">Nama Sistem Elektronik <span class="text-danger">*</span></label>
                <input
                  v-model="newNamaSistem"
                  @keyup.enter="confirmAdd"
                  type="text"
                  class="form-control form-control-lg fs-14 border-2"
                  style="border-radius: 12px;"
                  :class="{ 'is-invalid': addError }"
                  placeholder="cth: SIMKEU, Core Banking System..."
                  autofocus
                />
                <div v-if="addError" class="invalid-feedback">{{ addError }}</div>
              </div>
              
              <div class="alert alert-light border d-flex gap-2 p-2 mb-0" style="border-radius: 10px;">
                <i class="ri-information-line text-primary fs-16"></i>
                <div class="fs-11 text-muted">Setelah ini Anda akan diarahkan ke halaman kuesioner penilaian KSE.</div>
              </div>
            </div>

            <div class="kse-modal-footer mt-4 d-flex gap-2">
              <button @click="closeAdd" class="btn btn-light flex-grow-1 py-2 rounded-pill">Batal</button>
              <button @click="confirmAdd" class="btn btn-primary flex-grow-1 py-2 rounded-pill shadow-sm">
                Lanjut Isi KSE <i class="ri-arrow-right-line ms-1"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </teleport>

  <!-- ══ DELETE MODAL ═══════════════════════════════════════════ -->
  <teleport to="body">
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDelete">
      <div class="modal-dialog modal-dialog-centered modal-sm custom-modal">
        <div class="modal-content border-0 bg-transparent">
          <div class="kse-modal-box kse-modal-sm w-100">
            <div class="kse-modal-header kse-modal-header-danger pb-3 mb-2">
              <div class="d-flex align-items-center gap-3">
                <div class="kse-modal-icon-wrap" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">
                  <i class="ri-delete-bin-2-fill"></i>
                </div>
                <div>
                  <div class="kse-modal-title">Hapus KSE</div>
                  <div class="kse-modal-sub text-danger opacity-75 fs-11">Tindakan permanen</div>
                </div>
              </div>
            </div>
            
            <div class="kse-modal-body text-center py-4">
              <div class="mb-3 fs-14">
                Apakah Anda yakin ingin menghapus KSE <br>
                <strong class="text-dark">&ldquo;{{ deleteTarget?.namaSistem }}&rdquo;</strong>?
              </div>
              <p class="text-muted fs-12 mb-0 px-3">
                Semua data penilaian dan riwayat yang telah diisi akan terhapus secara permanen dari sistem.
              </p>
            </div>
            
            <div class="kse-modal-footer d-flex gap-2">
              <button @click="closeDelete" class="btn btn-light flex-grow-1 py-2 rounded-pill">Batal</button>
              <button @click="confirmDelete" class="btn btn-danger flex-grow-1 py-2 rounded-pill shadow-sm">
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </teleport>

</template>

<style scoped>
/* Component Specific Premium Styles */
.kse-premium-header {
  background: 
    radial-gradient(circle at 10% 20%, rgba(37, 99, 235, 0.15), transparent 40%),
    radial-gradient(circle at 90% 80%, rgba(124, 58, 237, 0.1), transparent 40%),
    linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%) !important;
}

.kse-sys-avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.btn-primary-gradient {
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
  border: none;
  color: white;
  transition: all 0.3s ease;
}

.btn-primary-gradient:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3) !important;
  color: white;
}

.btn-icon-pulse {
  width: 24px;
  height: 24px;
  background: rgba(255,255,255,0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-xs {
  background-color: rgba(0,0,0,0.05);
  overflow: visible;
}

[data-theme-mode="dark"] .progress-xs {
  background-color: rgba(255,255,255,0.05);
}

.hover-opacity-100:hover {
  opacity: 1 !important;
}

.stakeholders-action-btn {
  border-radius: 10px !important;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.stakeholders-action-btn:hover {
  transform: translateY(-2px);
}

.kse-modal-box {
  background: #fff;
  border-radius: 20px;
  padding: 1.75rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

[data-theme-mode="dark"] .kse-modal-box {
  background: #1e293b;
  color: #f1f5f9;
}

[data-theme-mode="dark"] .kse-sys-name {
  color: #f1f5f9 !important;
}

[data-theme-mode="dark"] .text-dark {
  color: #f1f5f9 !important;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Animations */
.stakeholder-row {
  animation: fadeIn 0.4s ease-out both;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.btn-icon-pulse i {
  animation: pulse-icon 2s infinite;
}

@keyframes pulse-icon {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}
</style>
