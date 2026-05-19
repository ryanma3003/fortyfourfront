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

function dedupeSeEntries(entries: SeCsirt[]): SeCsirt[] {
  const uniqueMap = new Map<string, SeCsirt>();

  entries.forEach((entry) => {
    const stableKey = String(
      entry.id ??
      `${entry.id_perusahaan ?? ''}-${entry.id_csirt ?? ''}-${(entry.nama_se || '').trim().toLowerCase()}`
    );

    if (!uniqueMap.has(stableKey)) {
      uniqueMap.set(stableKey, entry);
    }
  });

  return [...uniqueMap.values()];
}

function dedupeKseEntries(entries: KseListEntry[]): KseListEntry[] {
  const uniqueMap = new Map<string, KseListEntry>();

  entries.forEach((entry) => {
    const stableKey = String(
      entry.seId ||
      entry.id ||
      entry.namaSistem.trim().toLowerCase()
    );

    if (!uniqueMap.has(stableKey)) {
      uniqueMap.set(stableKey, entry);
    }
  });

  return [...uniqueMap.values()];
}

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
        companySe = dedupeSeEntries(
          csirtStore.seList.filter((item: any) => {
            return String(item.id_csirt) === csirtId ||
                   String(item.csirt_id) === csirtId ||
                   String(item.csirt?.id) === csirtId ||
                   (item.id_perusahaan && String(item.id_perusahaan) === String(companyId));
          })
        );
      } else {
        // No CSIRT yet — try direct API fallback
        const csirtFromApi = await csirtService.getCsirtByPerusahaan(companyId).catch(() => null);
        if (csirtFromApi && csirtFromApi.id) {
          companySe = dedupeSeEntries(
            await csirtService.getSeByCsirtId(csirtFromApi.id).catch(() => [])
          );
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
  kseEntries.value = dedupeKseEntries([...apiEntries, ...uniqueLocal]);
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
  <div class="kse-admin-page kse-stakeholder-page">
  <!-- ══════════════════ PAGEHEADER ══════════════════ -->
  <Pageheader :propData="dataToPass" />

  <!-- ══════════════════ PAGE ══════════════════ -->
  <div class="row">
    <div class="col-xl-12">
      <!-- Premium Shell Card -->
      <div class="card custom-card gradient-header-card stakeholders-shell-card kse-shell-card" style="overflow: visible !important;">
        
        <!-- ══ PREMIUM HEADER ══════════════════════════════════════════ -->
        <header class="kse-hero-header">
          <div class="kse-hero-content">
            <div class="kse-hero-copy">
              <div class="kse-inline-breadcrumb">
                {{ currentStakeholder?.nama_perusahaan || 'Stakeholder' }} <span>/</span> KSE
              </div>
              <h1>Kategorisasi Sistem Elektronik</h1>
              <p>
                {{ currentStakeholder?.sub_sektor?.nama_sub_sektor || currentStakeholder?.sektor || 'Manajemen Kategorisasi SE' }}
                &bull; {{ totalKse }} sistem terdaftar
              </p>
            </div>
          </div>
        </header>

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

          <section class="kse-kpi-grid mb-4" aria-label="Ringkasan KSE">
            <article class="kse-kpi-card tone-total">
              <div class="kse-kpi-icon"><i class="ri-server-line"></i></div>
              <div>
                <span>Total Sistem</span>
                <strong>{{ totalKse }}</strong>
                <small>Data KSE terdaftar</small>
              </div>
            </article>
            <article class="kse-kpi-card tone-danger">
              <div class="kse-kpi-icon"><i class="ri-shield-keyhole-fill"></i></div>
              <div>
                <span>Strategis</span>
                <strong>{{ countStrategis }}</strong>
                <small>Aset prioritas utama</small>
              </div>
            </article>
            <article class="kse-kpi-card tone-warning">
              <div class="kse-kpi-icon"><i class="ri-alarm-warning-fill"></i></div>
              <div>
                <span>Tinggi</span>
                <strong>{{ countTinggi }}</strong>
                <small>Perlu pemantauan aktif</small>
              </div>
            </article>
            <article class="kse-kpi-card tone-success">
              <div class="kse-kpi-icon"><i class="ri-shield-check-line"></i></div>
              <div>
                <span>Rendah</span>
                <strong>{{ countRendah }}</strong>
                <small>Kritikalitas lebih rendah</small>
              </div>
            </article>
            <article class="kse-kpi-card tone-review" :class="{ 'is-hot': countDraft > 0 }">
              <div class="kse-kpi-icon"><i class="ri-file-edit-line" :class="{ 'pulse-icon': countDraft > 0 }"></i></div>
              <div>
                <span>Draft</span>
                <strong>{{ countDraft }}</strong>
                <small>Belum final</small>
              </div>
            </article>
          </section>

          <div class="controls-bar stakeholders-toolbar stakeholders-filter-bar mb-4">
            <div class="stakeholders-toolbar-right w-100 d-flex align-items-center justify-content-between">
              <div class="stakeholders-per-page">
                <span>Rows</span>
                <select v-model.number="perPage" class="form-select form-select-sm entries-select" @change="currentPage = 1">
                  <option v-for="n in [5, 10, 15, 20, 25, 50]" :key="n" :value="n">{{ n }}</option>
                </select>
              </div>
              <label class="kse-search" aria-label="Cari sistem elektronik">
                <i class="ri-search-line"></i>
                <input
                  v-model="searchQuery"
                  @input="onSearch"
                  type="text"
                  placeholder="Cari sistem elektronik..."
                />
                <button v-if="searchQuery" type="button" @click="clearSearch" aria-label="Clear search">
                  <i class="ri-close-circle-fill"></i>
                </button>
              </label>
              <button
                v-if="route.query.from === 'dashboard'"
                class="btn kse-toolbar-secondary d-flex align-items-center gap-2"
                type="button"
                @click="goBack"
              >
                <i class="ri-arrow-left-line"></i>
                <span class="btn-text">Dashboard</span>
              </button>
              <button class="btn kse-toolbar-btn d-flex align-items-center gap-2" type="button" @click="openAdd">
                <i class="ri-add-line"></i>
                <span class="btn-text">Tambah KSE Baru</span>
              </button>
            </div>
          </div>

          <!-- ══ PREMIUM TABLE ══════════════════════════════════════ -->
          <div class="card custom-card shadow-sm border-0 overflow-hidden kse-list-shell">
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
          <div class="pagination-container stakeholders-pagination p-4 border-top">
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
          </div><!-- /kse-list-shell -->

        </div><!-- /card-body -->
      </div><!-- /card shell -->
    </div>
  </div>

  <!-- ══ ADD MODAL ══════════════════════════════════════════════ -->
  </div><!-- /kse-admin-page -->

  <teleport to="body">
    <div
      v-if="showAddModal"
      class="modal fade show d-flex align-items-center justify-content-center"
      tabindex="-1"
      style="display: flex !important; background: rgba(15, 23, 42, 0.75); position: fixed; inset: 0; z-index: 9999;"
      @click.self="closeAdd"
    >
      <div class="modal-dialog modal-dialog-centered" style="max-width: 400px; width: 100%; margin: 16px;">
        <div class="modal-content border-0 shadow-lg bg-white kse-modal-content" style="border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;">
          <!-- Blue Header like Screenshot -->
          <div class="modal-header border-0 p-4 d-flex align-items-center gap-3" style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white;">
            <div class="d-flex align-items-center justify-content-center bg-white bg-opacity-20 rounded-circle" style="width: 48px; height: 48px;">
              <i class="ri-add-line fs-24"></i>
            </div>
            <div class="flex-grow-1">
              <h5 class="modal-title fw-bold mb-0" style="color: white; font-size: 1.1rem;">Tambah KSE Baru</h5>
              <div class="fs-12 opacity-75">{{ currentStakeholder?.nama_perusahaan }}</div>
            </div>
            <button
              type="button"
              class="btn-close btn-close-white shadow-none"
              @click="closeAdd"
              aria-label="Close"
            ></button>
          </div>

          <div class="modal-body p-4">
            <p class="text-muted mb-4 fs-14">
              Masukkan nama Sistem Elektronik yang akan dikategorisasi. Setiap sistem akan dinilai secara terpisah.
            </p>
            
            <div class="mb-4">
              <label class="form-label fs-12 fw-bold text-uppercase tracking-wider text-muted mb-2">Nama Sistem Elektronik <span class="text-danger">*</span></label>
              <input
                v-model="newNamaSistem"
                @keyup.enter="confirmAdd"
                type="text"
                class="form-control form-control-lg fs-15 border-2 shadow-sm"
                style="border-radius: 14px; border-color: #e2e8f0; padding: 12px 16px;"
                :class="{ 'is-invalid': addError }"
                placeholder="cth: SIMKEU, Core Banking..."
                autofocus
              />
              <div v-if="addError" class="invalid-feedback mt-2">{{ addError }}</div>
            </div>
            
            <div class="alert alert-primary border-0 d-flex gap-3 p-3 mb-0" style="border-radius: 14px; background-color: #f0f7ff;">
              <i class="ri-information-line text-primary fs-20"></i>
              <div class="fs-12 text-primary text-opacity-75 leading-relaxed">Setelah ini Anda akan diarahkan ke halaman kuesioner penilaian KSE.</div>
            </div>
          </div>

          <div class="modal-footer border-0 p-4 pt-0 d-flex gap-2">
            <button
              type="button"
              class="btn btn-light flex-grow-1 fw-semibold py-2"
              style="border-radius: 12px; background-color: #f8fafc; border: none; color: #64748b; height: 48px;"
              @click="closeAdd"
            >
              Batal
            </button>
            <button
              type="button"
              class="btn btn-primary flex-grow-1 fw-semibold py-2 d-flex align-items-center justify-content-center gap-2"
              style="border-radius: 12px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border: none; height: 48px;"
              @click="confirmAdd"
            >
              Lanjut Isi KSE <i class="ri-arrow-right-line"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </teleport>

  <!-- ══ DELETE MODAL ═══════════════════════════════════════════ -->
  <teleport to="body">
    <div
      v-if="showDeleteModal"
      class="modal fade show d-flex align-items-center justify-content-center"
      tabindex="-1"
      style="display: flex !important; background: rgba(15, 23, 42, 0.75); position: fixed; inset: 0; z-index: 9999;"
      @click.self="closeDelete"
    >
      <div class="modal-dialog modal-dialog-centered" style="max-width: 400px; width: 100%; margin: 16px;">
        <div class="modal-content border-0 shadow-lg bg-white kse-modal-content" style="border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;">
          <div class="modal-header border-0 p-4 pb-0 d-flex justify-content-between align-items-center">
            <h5 class="modal-title fw-bold text-dark">Hapus KSE</h5>
            <button
              type="button"
              class="btn-close shadow-none"
              @click="closeDelete"
              aria-label="Close"
            ></button>
          </div>
          
          <div class="modal-body p-4 text-center">
            <div class="d-inline-flex align-items-center justify-content-center bg-danger bg-opacity-10 rounded-circle mb-4" style="width: 80px; height: 80px;">
              <i class="ri-delete-bin-line text-danger fs-40" style="font-size: 2.5rem;"></i>
            </div>
            <h4 class="fw-bold text-dark mb-2">Apakah Anda yakin?</h4>
            <p class="text-muted mb-0 px-2">
              Anda akan menghapus KSE <span class="fw-bold text-dark">"{{ deleteTarget?.namaSistem }}"</span>. 
              Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>

          <div class="modal-footer border-0 p-4 pt-0 d-flex gap-2">
            <button
              type="button"
              class="btn btn-light flex-grow-1 fw-semibold py-2"
              style="border-radius: 12px; background-color: #f8fafc; border: none; color: #64748b; height: 48px;"
              @click="closeDelete"
            >
              Batal
            </button>
            <button
              type="button"
              class="btn btn-danger flex-grow-1 fw-semibold py-2"
              style="border-radius: 12px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border: none; height: 48px;"
              @click="confirmDelete"
            >
              Ya, Hapus
            </button>
          </div>
        </div>
      </div>
    </div>
  </teleport>

</template>

<style scoped>
.kse-admin-page {
  --kse-blue: #2563eb;
  --kse-blue-dark: #1d4ed8;
  --kse-border: #e2e8f0;
  --kse-muted: #64748b;
  --kse-text: #0f172a;
}

.kse-shell-card {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}

.kse-shell-card > .stakeholder-header {
  display: none !important;
}

.kse-hero-header {
  align-items: center;
  background: linear-gradient(135deg, #06184f 0%, #183b91 52%, #2f76ea 100%);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 22px;
  box-shadow: 0 18px 46px rgba(15, 23, 42, 0.16);
  color: #ffffff;
  display: flex;
  gap: 28px;
  justify-content: space-between;
  min-height: 152px;
  overflow: hidden;
  padding: 24px 26px;
  position: relative;
}

.kse-hero-header::after {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0));
  content: "";
  height: 1px;
  inset: 0 20px auto;
  position: absolute;
}

.kse-hero-content {
  position: relative;
  z-index: 1;
}

.kse-hero-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.kse-hero-copy {
  max-width: 820px;
}

.kse-inline-breadcrumb {
  color: #b9d7ff;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 8px;
}

.kse-inline-breadcrumb span {
  color: rgba(255, 255, 255, 0.58);
  margin: 0 5px;
}

.kse-hero-copy h1 {
  color: #ffffff;
  font-size: 32px;
  font-weight: 850;
  line-height: 1.05;
  margin: 0;
}

.kse-hero-copy p {
  color: rgba(255, 255, 255, 0.86);
  font-size: 16px;
  line-height: 1.45;
  margin: 10px 0 0;
}

.kse-kpi-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.kse-kpi-card {
  align-items: flex-start;
  background: #ffffff;
  border: 1px solid var(--kse-border);
  border-radius: 16px;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.07);
  display: flex;
  gap: 12px;
  min-height: 118px;
  padding: 16px;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.kse-kpi-card:hover {
  border-color: rgba(37, 99, 235, 0.32);
  box-shadow: 0 18px 38px rgba(37, 99, 235, 0.12);
  transform: translateY(-2px);
}

.kse-kpi-icon {
  align-items: center;
  border-radius: 14px;
  display: inline-flex;
  flex: 0 0 42px;
  font-size: 20px;
  height: 42px;
  justify-content: center;
  line-height: 1;
  width: 42px;
}

.kse-kpi-icon i {
  display: inline-flex;
  line-height: 1;
}

.kse-kpi-card span {
  color: var(--kse-muted);
  display: block;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.kse-kpi-card strong {
  color: var(--kse-text);
  display: block;
  font-size: 28px;
  font-weight: 900;
  line-height: 1;
  margin: 8px 0 6px;
}

.kse-kpi-card small {
  color: var(--kse-muted);
  font-size: 12px;
  line-height: 1.3;
}

.tone-total .kse-kpi-icon { background: #dbeafe; color: #1d4ed8; }
.tone-danger .kse-kpi-icon { background: #fee2e2; color: #b91c1c; }
.tone-warning .kse-kpi-icon { background: #fef3c7; color: #b45309; }
.tone-success .kse-kpi-icon { background: #dcfce7; color: #15803d; }
.tone-review .kse-kpi-icon { background: #e0e7ff; color: #4f46e5; }
.tone-review.is-hot { border-color: rgba(79, 70, 229, 0.35); }

.kse-search {
  align-items: center;
  background: #ffffff;
  border: 1px solid var(--kse-border);
  border-radius: 14px;
  color: var(--kse-muted);
  display: flex;
  flex: 1 1 360px;
  gap: 8px;
  min-height: 42px;
  max-width: 520px;
  padding: 0 14px;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.kse-search:focus-within {
  border-color: rgba(37, 99, 235, 0.55);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
}

.kse-search input {
  background: transparent;
  border: 0;
  color: var(--kse-text);
  font-size: 13px;
  min-width: 0;
  outline: 0;
  width: 100%;
}

.kse-search button {
  align-items: center;
  background: transparent;
  border: 0;
  color: #2563eb;
  display: inline-flex;
  justify-content: center;
  padding: 0;
}

.kse-list-shell {
  border-radius: 16px !important;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08) !important;
  filter: none !important;
  transform: none !important;
}

.kse-list-shell .stakeholders-pagination {
  background: #ffffff;
  margin-top: 0 !important;
}

.kse-list-shell .stakeholders-pagination-copy {
  line-height: 1.4;
}

.kse-toolbar-btn,
.kse-toolbar-secondary {
  align-items: center;
  border-radius: 999px;
  display: inline-flex;
  font-size: 12px;
  font-weight: 800;
  justify-content: center;
  line-height: 1;
  min-height: 36px;
  padding: 0 16px;
  transition: transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
  white-space: nowrap;
}

.kse-toolbar-btn {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border: 1px solid transparent;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.18);
  color: #ffffff;
}

.kse-toolbar-btn:hover {
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22);
  color: #ffffff;
  transform: translateY(-1px);
}

.kse-toolbar-secondary {
  background: #f8fafc;
  border: 1px solid #dbe5f2;
  color: #475569;
}

.kse-toolbar-secondary:hover {
  border-color: rgba(37, 99, 235, 0.35);
  color: #1d4ed8;
}

.pulse-icon {
  animation: pulse-icon 2s infinite;
}

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

@media (max-width: 1199.98px) {
  .kse-kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 991.98px) {
  .kse-hero-header {
    align-items: stretch;
    flex-direction: column;
  }

  .kse-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stakeholders-toolbar-right {
    flex-wrap: wrap;
    gap: 12px;
  }

  .kse-search {
    flex: 0 0 auto;
    max-width: none;
    order: 3;
    width: 100%;
  }
}

@media (max-width: 575.98px) {
  .kse-hero-header {
    border-radius: 18px;
    min-height: 0;
    padding: 20px;
  }

  .kse-hero-copy h1 {
    font-size: 26px;
  }

  .kse-hero-copy p {
    font-size: 14px;
  }

  .kse-kpi-grid {
    grid-template-columns: 1fr;
  }

  .stakeholders-toolbar-right {
    align-items: stretch !important;
    flex-direction: column;
    gap: 12px;
    justify-content: flex-start !important;
  }

  .stakeholders-per-page {
    align-self: center;
  }

  .kse-toolbar-btn,
  .kse-toolbar-secondary {
    width: 100%;
  }

  .kse-search {
    flex: 0 0 auto;
    min-height: 48px;
    order: unset;
    padding: 0 14px;
    width: 100%;
  }

  .kse-search input {
    font-size: 14px;
  }
}
</style>

<style>
[data-theme-mode="dark"] .kse-admin-page,
html.dark .kse-admin-page {
  --kse-border: rgba(148, 163, 184, 0.18);
  --kse-muted: #94a3b8;
  --kse-text: #f8fafc;
}

[data-theme-mode="dark"] .kse-admin-page .kse-kpi-card,
html.dark .kse-admin-page .kse-kpi-card,
[data-theme-mode="dark"] .kse-admin-page .kse-search,
html.dark .kse-admin-page .kse-search {
  background: #08111f !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
  color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .kse-admin-page .kse-hero-header,
html.dark .kse-admin-page .kse-hero-header {
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(15, 42, 83, 0.9) 48%, rgba(30, 64, 175, 0.82)),
    radial-gradient(circle at 20% 16%, rgba(96, 165, 250, 0.26), transparent 32%) !important;
  border-color: rgba(96, 165, 250, 0.24) !important;
  box-shadow: 0 20px 54px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
}

[data-theme-mode="dark"] .kse-admin-page .kse-kpi-card strong,
html.dark .kse-admin-page .kse-kpi-card strong,
[data-theme-mode="dark"] .kse-admin-page .text-dark,
html.dark .kse-admin-page .text-dark {
  color: #f8fafc !important;
}

[data-theme-mode="dark"] .kse-admin-page .kse-kpi-card span,
[data-theme-mode="dark"] .kse-admin-page .kse-kpi-card small,
[data-theme-mode="dark"] .kse-admin-page .text-muted,
html.dark .kse-admin-page .kse-kpi-card span,
html.dark .kse-admin-page .kse-kpi-card small,
html.dark .kse-admin-page .text-muted {
  color: #94a3b8 !important;
}

[data-theme-mode="dark"] .kse-admin-page .tone-total .kse-kpi-icon,
html.dark .kse-admin-page .tone-total .kse-kpi-icon {
  background: rgba(37, 99, 235, 0.18) !important;
  color: #60a5fa !important;
}

[data-theme-mode="dark"] .kse-admin-page .tone-danger .kse-kpi-icon,
html.dark .kse-admin-page .tone-danger .kse-kpi-icon {
  background: rgba(239, 68, 68, 0.16) !important;
  color: #f87171 !important;
}

[data-theme-mode="dark"] .kse-admin-page .tone-warning .kse-kpi-icon,
html.dark .kse-admin-page .tone-warning .kse-kpi-icon {
  background: rgba(245, 158, 11, 0.18) !important;
  color: #fbbf24 !important;
}

[data-theme-mode="dark"] .kse-admin-page .tone-success .kse-kpi-icon,
html.dark .kse-admin-page .tone-success .kse-kpi-icon {
  background: rgba(34, 197, 94, 0.16) !important;
  color: #4ade80 !important;
}

[data-theme-mode="dark"] .kse-admin-page .tone-review .kse-kpi-icon,
html.dark .kse-admin-page .tone-review .kse-kpi-icon {
  background: rgba(99, 102, 241, 0.18) !important;
  color: #a5b4fc !important;
}

[data-theme-mode="dark"] .kse-admin-page .kse-kpi-icon i,
html.dark .kse-admin-page .kse-kpi-icon i {
  color: currentColor !important;
}

[data-theme-mode="dark"] .kse-admin-page .kse-search input,
html.dark .kse-admin-page .kse-search input {
  color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .kse-admin-page .kse-search input::placeholder,
html.dark .kse-admin-page .kse-search input::placeholder {
  color: #64748b !important;
}

[data-theme-mode="dark"] .kse-admin-page .kse-search button,
html.dark .kse-admin-page .kse-search button {
  color: #93c5fd !important;
}

[data-theme-mode="dark"] .kse-admin-page .stakeholders-toolbar,
[data-theme-mode="dark"] .kse-admin-page .stakeholders-premium-body,
[data-theme-mode="dark"] .kse-admin-page .card.custom-card.shadow-sm,
[data-theme-mode="dark"] .kse-admin-page .kse-list-shell .stakeholders-pagination,
html.dark .kse-admin-page .stakeholders-toolbar,
html.dark .kse-admin-page .stakeholders-premium-body,
html.dark .kse-admin-page .card.custom-card.shadow-sm,
html.dark .kse-admin-page .kse-list-shell .stakeholders-pagination {
  background: #08111f !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
}

[data-theme-mode="dark"] .kse-admin-page .entries-select,
html.dark .kse-admin-page .entries-select {
  background-color: #0b1220 !important;
  border-color: rgba(148, 163, 184, 0.32) !important;
  color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .kse-admin-page .entries-select option,
html.dark .kse-admin-page .entries-select option {
  background: #0b1220 !important;
  color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .kse-admin-page .stakeholder-table-wrap,
[data-theme-mode="dark"] .kse-admin-page .stakeholders-table-shell,
html.dark .kse-admin-page .stakeholder-table-wrap,
html.dark .kse-admin-page .stakeholders-table-shell {
  background: #08111f !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
}

[data-theme-mode="dark"] .kse-admin-page .stakeholder-table,
html.dark .kse-admin-page .stakeholder-table {
  --bs-table-bg: #08111f !important;
  --bs-table-color: #dbeafe !important;
  --bs-table-hover-bg: rgba(37, 99, 235, 0.12) !important;
  --bs-table-hover-color: #f8fafc !important;
  background: #08111f !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
  color: #dbeafe !important;
}

[data-theme-mode="dark"] .kse-admin-page .stakeholder-table thead,
[data-theme-mode="dark"] .kse-admin-page .stakeholder-table thead tr,
[data-theme-mode="dark"] .kse-admin-page .stakeholder-table thead th,
html.dark .kse-admin-page .stakeholder-table thead,
html.dark .kse-admin-page .stakeholder-table thead tr,
html.dark .kse-admin-page .stakeholder-table thead th {
  background: #111c2e !important;
  background-color: #111c2e !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: #a9bad2 !important;
}

[data-theme-mode="dark"] .kse-admin-page .stakeholder-table tbody,
[data-theme-mode="dark"] .kse-admin-page .stakeholder-table tbody tr,
[data-theme-mode="dark"] .kse-admin-page .stakeholder-table tbody td,
html.dark .kse-admin-page .stakeholder-table tbody,
html.dark .kse-admin-page .stakeholder-table tbody tr,
html.dark .kse-admin-page .stakeholder-table tbody td {
  background: #08111f !important;
  background-color: #08111f !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
  color: #dbeafe !important;
}

[data-theme-mode="dark"] .kse-admin-page .stakeholder-table tbody tr:hover,
html.dark .kse-admin-page .stakeholder-table tbody tr:hover {
  background: rgba(37, 99, 235, 0.12) !important;
  background-color: rgba(37, 99, 235, 0.12) !important;
}

[data-theme-mode="dark"] .kse-admin-page .row-number,
html.dark .kse-admin-page .row-number {
  color: #cbd5e1 !important;
}

[data-theme-mode="dark"] .kse-admin-page .progress-xs,
html.dark .kse-admin-page .progress-xs {
  background-color: rgba(255, 255, 255, 0.08) !important;
}

[data-theme-mode="dark"] .kse-admin-page .badge-sektor,
html.dark .kse-admin-page .badge-sektor {
  box-shadow: none !important;
}

[data-theme-mode="dark"] .kse-admin-page .badge-sektor-red,
html.dark .kse-admin-page .badge-sektor-red {
  background: rgba(239, 68, 68, 0.14) !important;
  border-color: rgba(248, 113, 113, 0.42) !important;
  color: #fca5a5 !important;
}

[data-theme-mode="dark"] .kse-admin-page .badge-sektor-amber,
html.dark .kse-admin-page .badge-sektor-amber {
  background: rgba(245, 158, 11, 0.14) !important;
  border-color: rgba(251, 191, 36, 0.42) !important;
  color: #fcd34d !important;
}

[data-theme-mode="dark"] .kse-admin-page .badge-sektor-teal,
html.dark .kse-admin-page .badge-sektor-teal {
  background: rgba(20, 184, 166, 0.14) !important;
  border-color: rgba(45, 212, 191, 0.42) !important;
  color: #5eead4 !important;
}

[data-theme-mode="dark"] .kse-admin-page .badge-sektor-slate,
[data-theme-mode="dark"] .kse-admin-page .badge-sektor-default,
html.dark .kse-admin-page .badge-sektor-slate,
html.dark .kse-admin-page .badge-sektor-default {
  background: rgba(148, 163, 184, 0.12) !important;
  border-color: rgba(148, 163, 184, 0.34) !important;
  color: #cbd5e1 !important;
}

[data-theme-mode="dark"] .kse-admin-page .badge-sektor i,
html.dark .kse-admin-page .badge-sektor i {
  color: currentColor !important;
}

[data-theme-mode="dark"] .kse-admin-page .kse-toolbar-secondary,
html.dark .kse-admin-page .kse-toolbar-secondary {
  background: #0b1220 !important;
  border-color: rgba(148, 163, 184, 0.28) !important;
  color: #cbd5e1 !important;
}

[data-theme-mode="dark"] .kse-admin-page .stakeholders-page-pill,
html.dark .kse-admin-page .stakeholders-page-pill {
  background: #0b1220 !important;
  border-color: rgba(148, 163, 184, 0.28) !important;
  color: #dbeafe !important;
}

[data-theme-mode="dark"] .kse-admin-page .stakeholders-pagination-copy,
html.dark .kse-admin-page .stakeholders-pagination-copy {
  color: #94a3b8 !important;
}

[data-theme-mode="dark"] .kse-admin-page .page-link,
html.dark .kse-admin-page .page-link {
  background: #0b1220 !important;
  border-color: rgba(148, 163, 184, 0.26) !important;
  color: #cbd5e1 !important;
}

[data-theme-mode="dark"] .kse-admin-page .page-item.active .page-link,
html.dark .kse-admin-page .page-item.active .page-link {
  background: #2563eb !important;
  border-color: #2563eb !important;
  color: #ffffff !important;
}

[data-theme-mode="dark"] .kse-modal-content,
html.dark .kse-modal-content {
  background: #08111f !important;
  color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .kse-modal-content .modal-header,
[data-theme-mode="dark"] .kse-modal-content .modal-footer,
html.dark .kse-modal-content .modal-header,
html.dark .kse-modal-content .modal-footer {
  border-color: rgba(148, 163, 184, 0.16) !important;
}

[data-theme-mode="dark"] .kse-modal-content .modal-title,
[data-theme-mode="dark"] .kse-modal-content h4,
[data-theme-mode="dark"] .kse-modal-content .text-dark,
html.dark .kse-modal-content .modal-title,
html.dark .kse-modal-content h4,
html.dark .kse-modal-content .text-dark {
  color: #f8fafc !important;
}

[data-theme-mode="dark"] .kse-modal-content .text-muted,
html.dark .kse-modal-content .text-muted {
  color: #94a3b8 !important;
}

[data-theme-mode="dark"] .kse-modal-content .form-control,
html.dark .kse-modal-content .form-control {
  background: #0b1220 !important;
  border-color: rgba(148, 163, 184, 0.32) !important;
  color: #e2e8f0 !important;
}

[data-theme-mode="dark"] .kse-modal-content .form-control::placeholder,
html.dark .kse-modal-content .form-control::placeholder {
  color: #64748b !important;
}

[data-theme-mode="dark"] .kse-modal-content .alert-primary,
html.dark .kse-modal-content .alert-primary {
  background: rgba(37, 99, 235, 0.14) !important;
  color: #bfdbfe !important;
}

[data-theme-mode="dark"] .kse-modal-content .btn-light,
html.dark .kse-modal-content .btn-light {
  background: #0b1220 !important;
  color: #cbd5e1 !important;
}
</style>
