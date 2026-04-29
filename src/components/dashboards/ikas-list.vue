<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import Pageheader from '@/shared/components/pageheader/pageheader.vue';
import { ikasService } from '@/services/ikas.service';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { getMaturityLabel } from '@/stores/ikas';
import type { Stakeholder } from '@/types/stakeholders.types';

type StatusFilter = 'all' | 'validated' | 'draft' | 'edit-request';

interface IkasRecord {
  id: string;
  slug: string;
  companyName: string;
  sector: string;
  logo: string;
  score: number;
  status: 'validated' | 'draft' | 'edit-request';
  statusLabel: string;
  updatedAt: string;
  createdAt: string;
  targetScore: number;
  respondent: string;
  position: string;
  phone: string;
  domains: {
    key: string;
    label: string;
    score: number;
    color: string;
  }[];
  raw: any;
}

interface KpiItem {
  label: string;
  value: string;
  hint: string;
  icon: string;
  tone: string;
}

const router = useRouter();
const stakeholdersStore = useStakeholdersStore();

const pageData = {
  title: { label: 'Dashboards', path: '/dashboard' },
  currentpage: 'IKAS Management',
  activepage: 'IKAS List',
};

const loading = ref(true);
const rawIkasRecords = ref<any[]>([]);
const searchQuery = ref('');
const sectorFilter = ref('all');
const statusFilter = ref<StatusFilter>('all');
const dateFrom = ref('');
const dateTo = ref('');
const filtersOpen = ref(false);
const selectedRecord = ref<IkasRecord | null>(null);
const currentPage = ref(1);
const pageSize = ref(12);
const lastRefreshAt = ref<Date | null>(null);

const normalizeResponse = (response: any): any[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.records)) return response.records;
  if (response?.id) return [response];
  return [];
};

const numberValue = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getStakeholderForRecord = (record: any): Stakeholder | undefined => {
  const companyId = record?.id_perusahaan || record?.perusahaan?.id;
  const slug = record?.perusahaan?.slug;

  if (slug) {
    const bySlug = stakeholdersStore.getStakeholderBySlug(String(slug));
    if (bySlug) return bySlug;
  }

  if (companyId) {
    return stakeholdersStore.getStakeholderById(String(companyId));
  }

  return undefined;
};

const getDomainScore = (record: any, key: 'identifikasi' | 'proteksi' | 'deteksi' | 'gulih'): number => {
  const data = record?.[key] || record?.[key === 'gulih' ? 'tanggulih' : key] || {};
  const scoreKey = key === 'gulih' ? 'nilai_gulih' : `nilai_${key}`;
  return numberValue(data?.[scoreKey] ?? data?.nilai ?? data?.score ?? 0);
};

const getStatus = (record: any): IkasRecord['status'] => {
  const editStatus = String(record?.edit_request_status || '').toLowerCase();
  if (editStatus === 'pending') return 'edit-request';
  return record?.is_validated ? 'validated' : 'draft';
};

const statusLabelMap: Record<IkasRecord['status'], string> = {
  validated: 'Active',
  draft: 'Inactive',
  'edit-request': 'Edit Request',
};

const mapRecord = (record: any): IkasRecord => {
  const stakeholder = getStakeholderForRecord(record);
  const company = record?.perusahaan || {};
  const slug = stakeholder?.slug || company?.slug || String(record?.slug || record?.id || '');
  const score = numberValue(record?.nilai_kematangan ?? record?.total_rata_rata ?? record?.score ?? 0);
  const status = getStatus(record);
  const sectorObject = stakeholder?.sub_sektor || company?.sub_sektor;

  return {
    id: String(record?.id || slug),
    slug,
    companyName: stakeholder?.nama_perusahaan || company?.nama_perusahaan || record?.nama_perusahaan || 'Unknown Company',
    sector: sectorObject?.nama_sub_sektor || stakeholder?.sektor || company?.sektor || record?.sektor || 'Unassigned',
    logo: stakeholder?.photo || company?.photo || '',
    score,
    status,
    statusLabel: statusLabelMap[status],
    updatedAt: record?.updated_at || record?.tanggal || record?.created_at || '',
    createdAt: record?.created_at || '',
    targetScore: numberValue(record?.target_nilai ?? record?.targetScore ?? 0),
    respondent: record?.responden || '-',
    position: record?.jabatan || '-',
    phone: record?.telepon || '-',
    domains: [
      { key: 'identifikasi', label: 'Identifikasi', score: getDomainScore(record, 'identifikasi'), color: '#2563eb' },
      { key: 'proteksi', label: 'Proteksi', score: getDomainScore(record, 'proteksi'), color: '#0891b2' },
      { key: 'deteksi', label: 'Deteksi', score: getDomainScore(record, 'deteksi'), color: '#16a34a' },
      { key: 'gulih', label: 'Gulih', score: getDomainScore(record, 'gulih'), color: '#f59e0b' },
    ],
    raw: record,
  };
};

const records = computed(() => rawIkasRecords.value.map(mapRecord));

const sectors = computed(() => {
  const unique = new Set(records.value.map((item) => item.sector).filter(Boolean));
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
});

const filteredRecords = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const fromTime = dateFrom.value ? new Date(`${dateFrom.value}T00:00:00`).getTime() : null;
  const toTime = dateTo.value ? new Date(`${dateTo.value}T23:59:59`).getTime() : null;

  return records.value
    .filter((item) => {
      const updatedTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      const matchesQuery = !query ||
        item.companyName.toLowerCase().includes(query) ||
        item.sector.toLowerCase().includes(query);
      const matchesSector = sectorFilter.value === 'all' || item.sector === sectorFilter.value;
      const matchesStatus = statusFilter.value === 'all' || item.status === statusFilter.value;
      const matchesFrom = !fromTime || updatedTime >= fromTime;
      const matchesTo = !toTime || updatedTime <= toTime;

      return matchesQuery && matchesSector && matchesStatus && matchesFrom && matchesTo;
    })
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRecords.value.length / pageSize.value)));
const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredRecords.value.slice(start, start + pageSize.value);
});

const latestUpdate = computed(() => {
  const latest = records.value
    .map((item) => new Date(item.updatedAt || 0).getTime())
    .filter(Boolean)
    .sort((a, b) => b - a)[0];

  return latest ? formatRelativeTime(new Date(latest).toISOString()) : 'No updates';
});

const averageScore = computed(() => {
  if (!records.value.length) return 0;
  return records.value.reduce((sum, item) => sum + item.score, 0) / records.value.length;
});

const kpiItems = computed<KpiItem[]>(() => [
  {
    label: 'Total IKAS',
    value: String(records.value.length),
    hint: `${filteredRecords.value.length} visible after filters`,
    icon: 'ri-database-2-line',
    tone: 'blue',
  },
  {
    label: 'Active IKAS',
    value: String(records.value.filter((item) => item.status === 'validated').length),
    hint: 'Validated assessments',
    icon: 'ri-shield-check-line',
    tone: 'green',
  },
  {
    label: 'Inactive IKAS',
    value: String(records.value.filter((item) => item.status === 'draft').length),
    hint: 'Draft or incomplete',
    icon: 'ri-time-line',
    tone: 'amber',
  },
  {
    label: 'Average Score',
    value: averageScore.value.toFixed(2),
    hint: getMaturityLabel(averageScore.value),
    icon: 'ri-pulse-line',
    tone: 'cyan',
  },
  {
    label: 'Last Updated',
    value: latestUpdate.value,
    hint: lastRefreshAt.value ? `Synced ${formatRelativeTime(lastRefreshAt.value.toISOString())}` : 'Waiting for sync',
    icon: 'ri-refresh-line',
    tone: 'slate',
  },
]);

const clearFilters = () => {
  searchQuery.value = '';
  sectorFilter.value = 'all';
  statusFilter.value = 'all';
  dateFrom.value = '';
  dateTo.value = '';
};

const loadData = async () => {
  loading.value = true;
  try {
    const [ikasResponse] = await Promise.all([
      ikasService.getIkasList(),
      stakeholdersStore.initialize(),
    ]);
    rawIkasRecords.value = normalizeResponse(ikasResponse);
    lastRefreshAt.value = new Date();
    if (!selectedRecord.value && rawIkasRecords.value.length) {
      selectedRecord.value = records.value[0] || null;
    }
  } catch (error) {
    console.error('Failed to load IKAS list:', error);
    rawIkasRecords.value = [];
  } finally {
    loading.value = false;
  }
};

const selectRecord = (record: IkasRecord) => {
  selectedRecord.value = record;
};

const openFullDetail = () => {
  if (!selectedRecord.value?.slug) return;
  router.push({ path: '/ikas', query: { slug: selectedRecord.value.slug, source: 'list' } });
};

const closePanel = () => {
  selectedRecord.value = null;
};

const initials = (name: string) => name
  .split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join('') || 'IK';

const scorePercent = (score: number) => Math.max(0, Math.min(100, (score / 5) * 100));

const scoreTone = (score: number) => {
  if (score < 2) return 'risk';
  if (score < 3.5) return 'watch';
  return 'healthy';
};

const getRadialOptions = (record: IkasRecord) => ({
  chart: {
    sparkline: { enabled: true },
    animations: { enabled: true, speed: 450 },
  },
  colors: [record.score < 2 ? '#ef4444' : record.score < 3.5 ? '#f59e0b' : '#16a34a'],
  plotOptions: {
    radialBar: {
      hollow: { size: '64%' },
      dataLabels: {
        name: { show: false },
        value: {
          formatter: () => record.score.toFixed(2),
          fontSize: '20px',
          fontWeight: 700,
          color: '#0f172a',
        },
      },
    },
  },
  stroke: { lineCap: 'round' },
});

const formatDate = (value: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
};

function formatRelativeTime(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const divisions: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.345, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
  ];
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  let duration = diffSeconds;

  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return '-';
}

watch([searchQuery, sectorFilter, statusFilter, dateFrom, dateTo, pageSize], () => {
  currentPage.value = 1;
});

watch(filteredRecords, (items) => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value;
  if (selectedRecord.value && !items.some((item) => item.id === selectedRecord.value?.id)) {
    selectedRecord.value = items[0] || null;
  }
});

onMounted(loadData);

const KpiCard = defineComponent({
  name: 'KpiCard',
  props: {
    item: { type: Object as () => KpiItem, required: true },
  },
  setup(props) {
    return () => h('article', { class: ['ikas-kpi-card', `tone-${props.item.tone}`] }, [
      h('div', { class: 'ikas-kpi-icon', 'aria-hidden': 'true' }, [h('i', { class: props.item.icon })]),
      h('div', { class: 'ikas-kpi-body' }, [
        h('span', { class: 'ikas-kpi-label' }, props.item.label),
        h('strong', { class: 'ikas-kpi-value' }, props.item.value),
        h('small', { class: 'ikas-kpi-hint' }, props.item.hint),
      ]),
    ]);
  },
});

const FilterBar = defineComponent({
  name: 'FilterBar',
  props: {
    sectors: { type: Array as () => string[], required: true },
    filtersOpen: { type: Boolean, required: true },
    searchQuery: { type: String, required: true },
    sectorFilter: { type: String, required: true },
    statusFilter: { type: String as () => StatusFilter, required: true },
    dateFrom: { type: String, required: true },
    dateTo: { type: String, required: true },
  },
  emits: ['update:searchQuery', 'update:sectorFilter', 'update:statusFilter', 'update:dateFrom', 'update:dateTo', 'update:filtersOpen', 'clear'],
  setup(props, { emit }) {
    return () => h('section', { class: 'ikas-filter-shell', 'aria-label': 'IKAS filters' }, [
      h('div', { class: 'ikas-filter-primary' }, [
        h('label', { class: 'ikas-search', 'aria-label': 'Search by company or sector' }, [
          h('i', { class: 'ri-search-line', 'aria-hidden': 'true' }),
          h('input', {
            value: props.searchQuery,
            type: 'search',
            placeholder: 'Search company or sector...',
            onInput: (event: Event) => emit('update:searchQuery', (event.target as HTMLInputElement).value),
          }),
        ]),
        h('button', {
          class: 'ikas-filter-toggle',
          type: 'button',
          'aria-expanded': String(props.filtersOpen),
          onClick: () => emit('update:filtersOpen', !props.filtersOpen),
        }, [h('i', { class: 'ri-equalizer-line' }), h('span', 'Filters')]),
      ]),
      h('div', { class: ['ikas-filter-fields', props.filtersOpen ? 'is-open' : ''] }, [
        h('label', { class: 'ikas-field' }, [
          h('span', 'Sector'),
          h('select', {
            value: props.sectorFilter,
            onChange: (event: Event) => emit('update:sectorFilter', (event.target as HTMLSelectElement).value),
          }, [
            h('option', { value: 'all' }, 'All sectors'),
            ...props.sectors.map((sector) => h('option', { value: sector }, sector)),
          ]),
        ]),
        h('label', { class: 'ikas-field' }, [
          h('span', 'Status'),
          h('select', {
            value: props.statusFilter,
            onChange: (event: Event) => emit('update:statusFilter', (event.target as HTMLSelectElement).value),
          }, [
            h('option', { value: 'all' }, 'All status'),
            h('option', { value: 'validated' }, 'Active'),
            h('option', { value: 'draft' }, 'Inactive'),
            h('option', { value: 'edit-request' }, 'Edit request'),
          ]),
        ]),
        h('label', { class: 'ikas-field' }, [
          h('span', 'From'),
          h('input', {
            type: 'date',
            value: props.dateFrom,
            onInput: (event: Event) => emit('update:dateFrom', (event.target as HTMLInputElement).value),
          }),
        ]),
        h('label', { class: 'ikas-field' }, [
          h('span', 'To'),
          h('input', {
            type: 'date',
            value: props.dateTo,
            onInput: (event: Event) => emit('update:dateTo', (event.target as HTMLInputElement).value),
          }),
        ]),
        h('button', { class: 'ikas-clear-btn', type: 'button', onClick: () => emit('clear') }, 'Reset'),
      ]),
    ]);
  },
});

const IkasScore = defineComponent({
  name: 'IkasScore',
  props: {
    score: { type: Number, required: true },
  },
  setup(props) {
    return () => h('div', { class: 'ikas-score-cell' }, [
      h('span', { class: ['ikas-score-badge', scoreTone(props.score)] }, props.score.toFixed(2)),
      h('div', { class: 'ikas-score-track', 'aria-hidden': 'true' }, [
        h('span', { class: 'ikas-score-fill', style: { width: `${scorePercent(props.score)}%` } }),
      ]),
    ]);
  },
});

const IkasTableRow = defineComponent({
  name: 'IkasTableRow',
  props: {
    item: { type: Object as () => IkasRecord, required: true },
    selected: { type: Boolean, default: false },
  },
  emits: ['select'],
  setup(props, { emit }) {
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        emit('select', props.item);
      }
    };

    return () => h('tr', {
      class: ['ikas-table-row', props.selected ? 'is-selected' : ''],
      tabindex: 0,
      role: 'button',
      'aria-label': `Open IKAS preview for ${props.item.companyName}`,
      onClick: () => emit('select', props.item),
      onKeydown,
    }, [
      h('td', [
        h('div', { class: 'ikas-company' }, [
          props.item.logo
            ? h('img', { class: 'ikas-avatar', src: props.item.logo, alt: '' })
            : h('span', { class: 'ikas-avatar ikas-avatar-fallback', 'aria-hidden': 'true' }, initials(props.item.companyName)),
          h('div', [
            h('strong', props.item.companyName),
            h('small', `ID ${props.item.id}`),
          ]),
        ]),
      ]),
      h('td', [h('span', { class: 'ikas-sector-pill' }, props.item.sector)]),
      h('td', [h(IkasScore, { score: props.item.score })]),
      h('td', [h('span', { class: ['ikas-status', props.item.status] }, props.item.statusLabel)]),
      h('td', [
        h('div', { class: 'ikas-updated' }, [
          h('strong', formatRelativeTime(props.item.updatedAt)),
          h('small', formatDate(props.item.updatedAt)),
        ]),
      ]),
    ]);
  },
});

const IkasCard = defineComponent({
  name: 'IkasCard',
  props: {
    item: { type: Object as () => IkasRecord, required: true },
    selected: { type: Boolean, default: false },
  },
  emits: ['select'],
  setup(props, { emit }) {
    return () => h('button', {
      class: ['ikas-mobile-card', props.selected ? 'is-selected' : ''],
      type: 'button',
      onClick: () => emit('select', props.item),
      'aria-label': `Open IKAS preview for ${props.item.companyName}`,
    }, [
      h('div', { class: 'ikas-mobile-card-top' }, [
        h('div', { class: 'ikas-company' }, [
          props.item.logo
            ? h('img', { class: 'ikas-avatar', src: props.item.logo, alt: '' })
            : h('span', { class: 'ikas-avatar ikas-avatar-fallback', 'aria-hidden': 'true' }, initials(props.item.companyName)),
          h('div', [
            h('strong', props.item.companyName),
            h('small', props.item.sector),
          ]),
        ]),
        h('span', { class: ['ikas-status', props.item.status] }, props.item.statusLabel),
      ]),
      h(IkasScore, { score: props.item.score }),
      h('div', { class: 'ikas-mobile-meta' }, [
        h('span', formatRelativeTime(props.item.updatedAt)),
        h('span', formatDate(props.item.updatedAt)),
      ]),
    ]);
  },
});
</script>

<template>
  <Pageheader :propData="pageData" />

  <main class="ikas-page">
    <header class="ikas-topbar">
      <div>
        <span class="ikas-eyebrow">Admin Workspace</span>
        <h1>IKAS Management</h1>
      </div>

      <div class="ikas-header-actions">
        <label class="ikas-header-search" aria-label="Search IKAS">
          <i class="ri-search-line" aria-hidden="true"></i>
          <input v-model="searchQuery" type="search" placeholder="Search IKAS..." />
        </label>
        <button class="ikas-icon-btn" type="button" aria-label="Notifications">
          <i class="ri-notification-3-line" aria-hidden="true"></i>
        </button>
        <button class="ikas-profile-btn" type="button" aria-label="Profile menu">
          <span>AD</span>
          <i class="ri-arrow-down-s-line" aria-hidden="true"></i>
        </button>
      </div>
    </header>

    <section class="ikas-realtime-strip" aria-live="polite">
      <div>
        <span class="ikas-live-dot"></span>
        <strong>Real-time sync</strong>
        <small>{{ lastRefreshAt ? `updated ${formatRelativeTime(lastRefreshAt.toISOString())}` : 'connecting...' }}</small>
      </div>
      <button class="ikas-refresh-btn" type="button" :disabled="loading" @click="loadData">
        <i class="ri-refresh-line" aria-hidden="true"></i>
        Refresh
      </button>
    </section>

    <section class="ikas-kpi-grid" aria-label="IKAS summary">
      <KpiCard v-for="item in kpiItems" :key="item.label" :item="item" />
    </section>

    <FilterBar
      v-model:search-query="searchQuery"
      v-model:sector-filter="sectorFilter"
      v-model:status-filter="statusFilter"
      v-model:date-from="dateFrom"
      v-model:date-to="dateTo"
      v-model:filters-open="filtersOpen"
      :sectors="sectors"
      @clear="clearFilters"
    />

    <section class="ikas-content-grid">
      <div class="ikas-list-shell">
        <div class="ikas-list-header">
          <div>
            <h2>All IKAS Records</h2>
            <p>{{ filteredRecords.length }} assessments found</p>
          </div>
          <label class="ikas-page-size">
            <span>Rows</span>
            <select v-model.number="pageSize" aria-label="Rows per page">
              <option :value="8">8</option>
              <option :value="12">12</option>
              <option :value="20">20</option>
            </select>
          </label>
        </div>

        <div v-if="loading" class="ikas-skeleton-list" aria-label="Loading IKAS records">
          <div v-for="index in 7" :key="index" class="ikas-skeleton-row">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>

        <div v-else-if="!filteredRecords.length" class="ikas-empty-state">
          <div class="ikas-empty-illustration" aria-hidden="true">
            <i class="ri-folder-search-line"></i>
          </div>
          <h3>No IKAS data found</h3>
          <p>Try adjusting the search, sector, status, or date range filters.</p>
          <button class="ikas-refresh-btn" type="button" @click="clearFilters">Clear filters</button>
        </div>

        <template v-else>
          <div class="ikas-table-wrap">
            <table class="ikas-table">
              <thead>
                <tr>
                  <th scope="col">Company Name</th>
                  <th scope="col">Sector</th>
                  <th scope="col">IKAS Score</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                <IkasTableRow
                  v-for="item in paginatedRecords"
                  :key="item.id"
                  :item="item"
                  :selected="selectedRecord?.id === item.id"
                  @select="selectRecord"
                />
              </tbody>
            </table>
          </div>

          <div class="ikas-mobile-list">
            <IkasCard
              v-for="item in paginatedRecords"
              :key="item.id"
              :item="item"
              :selected="selectedRecord?.id === item.id"
              @select="selectRecord"
            />
          </div>

          <nav class="ikas-pagination" aria-label="IKAS pagination">
            <button type="button" :disabled="currentPage === 1" @click="currentPage -= 1">
              <i class="ri-arrow-left-s-line" aria-hidden="true"></i>
              Previous
            </button>
            <span>Page {{ currentPage }} of {{ totalPages }}</span>
            <button type="button" :disabled="currentPage === totalPages" @click="currentPage += 1">
              Next
              <i class="ri-arrow-right-s-line" aria-hidden="true"></i>
            </button>
          </nav>
        </template>
      </div>

      <aside v-if="selectedRecord" class="ikas-detail-panel" aria-label="IKAS detail preview">
        <button class="ikas-panel-close" type="button" aria-label="Close detail panel" @click="closePanel">
          <i class="ri-close-line" aria-hidden="true"></i>
        </button>

        <div class="ikas-panel-hero">
          <span class="ikas-avatar ikas-avatar-large ikas-avatar-fallback" aria-hidden="true">
            {{ initials(selectedRecord.companyName) }}
          </span>
          <div>
            <span class="ikas-eyebrow">Detail Preview</span>
            <h2>{{ selectedRecord.companyName }}</h2>
            <p>{{ selectedRecord.sector }}</p>
          </div>
        </div>

        <div class="ikas-panel-score">
          <div>
            <span>IKAS Score</span>
            <strong>{{ selectedRecord.score.toFixed(2) }}</strong>
            <small>{{ getMaturityLabel(selectedRecord.score) }}</small>
          </div>
          <apexchart
            type="radialBar"
            height="154"
            :series="[scorePercent(selectedRecord.score)]"
            :options="getRadialOptions(selectedRecord)"
          />
        </div>

        <div class="ikas-domain-card">
          <h3>Domain Breakdown</h3>
          <div v-for="domain in selectedRecord.domains" :key="domain.key" class="ikas-domain-row">
            <div>
              <span>{{ domain.label }}</span>
              <strong>{{ domain.score.toFixed(2) }}</strong>
            </div>
            <div class="ikas-domain-bar" aria-hidden="true">
              <span :style="{ width: `${scorePercent(domain.score)}%`, background: domain.color }"></span>
            </div>
          </div>
        </div>

        <div class="ikas-panel-meta">
          <div>
            <span>Respondent</span>
            <strong>{{ selectedRecord.respondent }}</strong>
          </div>
          <div>
            <span>Position</span>
            <strong>{{ selectedRecord.position }}</strong>
          </div>
          <div>
            <span>Target</span>
            <strong>{{ selectedRecord.targetScore ? selectedRecord.targetScore.toFixed(2) : '-' }}</strong>
          </div>
          <div>
            <span>Updated</span>
            <strong>{{ formatDate(selectedRecord.updatedAt) }}</strong>
          </div>
        </div>

        <button class="ikas-open-detail" type="button" @click="openFullDetail">
          Open full IKAS
          <i class="ri-arrow-right-line" aria-hidden="true"></i>
        </button>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.ikas-page {
  --ikas-blue: #2563eb;
  --ikas-blue-dark: #1d4ed8;
  --ikas-border: #e2e8f0;
  --ikas-muted: #64748b;
  --ikas-text: #0f172a;
  --ikas-surface: #ffffff;
  --ikas-page-bg: #f6f9fc;
  color: var(--ikas-text);
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 100vh;
  padding-bottom: 24px;
}

.ikas-topbar {
  align-items: center;
  backdrop-filter: blur(18px);
  background: rgba(246, 249, 252, 0.88);
  border: 1px solid rgba(226, 232, 240, 0.78);
  border-radius: 18px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.06);
  display: flex;
  justify-content: space-between;
  padding: 18px 20px;
  position: sticky;
  top: 82px;
  z-index: 9;
}

.ikas-eyebrow {
  color: var(--ikas-blue);
  display: block;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.ikas-topbar h1 {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.1;
  margin: 4px 0 0;
}

.ikas-header-actions,
.ikas-filter-primary,
.ikas-filter-fields,
.ikas-realtime-strip,
.ikas-list-header,
.ikas-pagination,
.ikas-panel-hero,
.ikas-panel-score,
.ikas-company,
.ikas-mobile-card-top,
.ikas-mobile-meta {
  align-items: center;
  display: flex;
}

.ikas-header-actions {
  gap: 10px;
}

.ikas-header-search,
.ikas-search {
  align-items: center;
  background: #ffffff;
  border: 1px solid var(--ikas-border);
  border-radius: 999px;
  color: var(--ikas-muted);
  display: flex;
  gap: 8px;
  min-height: 42px;
  padding: 0 14px;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.ikas-header-search:focus-within,
.ikas-search:focus-within,
.ikas-field:focus-within {
  border-color: rgba(37, 99, 235, 0.55);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
}

.ikas-header-search input,
.ikas-search input {
  background: transparent;
  border: 0;
  color: var(--ikas-text);
  min-width: 240px;
  outline: 0;
}

.ikas-icon-btn,
.ikas-profile-btn,
.ikas-filter-toggle,
.ikas-refresh-btn,
.ikas-clear-btn,
.ikas-pagination button,
.ikas-panel-close,
.ikas-open-detail {
  align-items: center;
  border: 0;
  display: inline-flex;
  font-weight: 700;
  gap: 8px;
  justify-content: center;
  transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease;
}

.ikas-icon-btn,
.ikas-profile-btn {
  background: #ffffff;
  border: 1px solid var(--ikas-border);
  border-radius: 999px;
  color: var(--ikas-text);
  min-height: 42px;
}

.ikas-icon-btn {
  width: 42px;
}

.ikas-profile-btn {
  padding: 0 10px;
}

.ikas-profile-btn span {
  align-items: center;
  background: linear-gradient(135deg, #2563eb, #06b6d4);
  border-radius: 50%;
  color: #ffffff;
  display: inline-flex;
  font-size: 12px;
  height: 28px;
  justify-content: center;
  width: 28px;
}

.ikas-realtime-strip {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(6, 182, 212, 0.1));
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 16px;
  justify-content: space-between;
  padding: 12px 16px;
}

.ikas-realtime-strip > div {
  align-items: center;
  display: flex;
  gap: 10px;
}

.ikas-realtime-strip small {
  color: var(--ikas-muted);
  font-weight: 600;
}

.ikas-live-dot {
  background: #22c55e;
  border-radius: 50%;
  box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.14);
  height: 9px;
  width: 9px;
}

.ikas-refresh-btn,
.ikas-open-detail {
  background: linear-gradient(135deg, #2563eb, #0891b2);
  border-radius: 12px;
  color: #ffffff;
  min-height: 40px;
  padding: 0 14px;
}

.ikas-refresh-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.ikas-kpi-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.ikas-kpi-card {
  background: var(--ikas-surface);
  border: 1px solid var(--ikas-border);
  border-radius: 18px;
  box-shadow: 0 14px 38px rgba(15, 23, 42, 0.06);
  display: flex;
  gap: 14px;
  min-width: 0;
  padding: 18px;
  position: relative;
  overflow: hidden;
}

.ikas-page :deep(.ikas-kpi-card) {
  background: var(--ikas-surface);
  border: 1px solid var(--ikas-border);
  border-radius: 18px;
  box-shadow: 0 14px 38px rgba(15, 23, 42, 0.06);
  display: flex;
  gap: 14px;
  min-height: 112px;
  min-width: 0;
  padding: 18px;
  position: relative;
  overflow: hidden;
}

.ikas-page :deep(.ikas-kpi-card::before) {
  background: var(--accent, #2563eb);
  content: "";
  height: 4px;
  inset: 0 0 auto;
  position: absolute;
}

.ikas-page :deep(.ikas-kpi-card.tone-blue) { --accent: #2563eb; }
.ikas-page :deep(.ikas-kpi-card.tone-green) { --accent: #16a34a; }
.ikas-page :deep(.ikas-kpi-card.tone-amber) { --accent: #f59e0b; }
.ikas-page :deep(.ikas-kpi-card.tone-cyan) { --accent: #0891b2; }
.ikas-page :deep(.ikas-kpi-card.tone-slate) { --accent: #475569; }

.ikas-page :deep(.ikas-kpi-icon) {
  align-items: center;
  background: color-mix(in srgb, var(--accent) 12%, #ffffff);
  border-radius: 14px;
  color: var(--accent);
  display: flex;
  flex: 0 0 42px;
  font-size: 20px;
  height: 42px;
  justify-content: center;
}

.ikas-page :deep(.ikas-kpi-body) {
  min-width: 0;
}

.ikas-page :deep(.ikas-kpi-label) {
  color: var(--ikas-muted);
  display: block;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.2;
  text-transform: uppercase;
}

.ikas-page :deep(.ikas-kpi-value) {
  color: var(--ikas-text);
  display: block;
  font-size: 24px;
  font-weight: 850;
  line-height: 1.1;
  margin-top: 4px;
}

.ikas-page :deep(.ikas-kpi-hint) {
  color: var(--ikas-muted);
  display: block;
  font-size: 12px;
  line-height: 1.35;
  margin-top: 6px;
}

.ikas-kpi-card::before {
  background: var(--accent, #2563eb);
  content: "";
  height: 4px;
  inset: 0 0 auto;
  position: absolute;
}

.ikas-kpi-card.tone-blue { --accent: #2563eb; }
.ikas-kpi-card.tone-green { --accent: #16a34a; }
.ikas-kpi-card.tone-amber { --accent: #f59e0b; }
.ikas-kpi-card.tone-cyan { --accent: #0891b2; }
.ikas-kpi-card.tone-slate { --accent: #475569; }

.ikas-kpi-icon {
  align-items: center;
  background: color-mix(in srgb, var(--accent) 12%, #ffffff);
  border-radius: 14px;
  color: var(--accent);
  display: flex;
  flex: 0 0 42px;
  font-size: 20px;
  height: 42px;
  justify-content: center;
}

.ikas-kpi-body {
  min-width: 0;
}

.ikas-kpi-label,
.ikas-kpi-hint,
.ikas-list-header p,
.ikas-updated small,
.ikas-company small,
.ikas-panel-meta span,
.ikas-panel-score span,
.ikas-panel-score small {
  color: var(--ikas-muted);
}

.ikas-kpi-label {
  display: block;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.ikas-kpi-value {
  display: block;
  font-size: 24px;
  line-height: 1.1;
  margin-top: 4px;
}

.ikas-kpi-hint {
  display: block;
  font-size: 12px;
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-filter-shell,
.ikas-list-shell,
.ikas-detail-panel {
  background: var(--ikas-surface);
  border: 1px solid var(--ikas-border);
  border-radius: 20px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.06);
}

.ikas-filter-shell {
  padding: 12px;
}

.ikas-page :deep(.ikas-filter-shell) {
  background: var(--ikas-surface);
  border: 1px solid var(--ikas-border);
  border-radius: 20px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.06);
  padding: 12px;
}

.ikas-page :deep(.ikas-filter-primary),
.ikas-page :deep(.ikas-filter-fields) {
  align-items: center;
  display: flex;
}

.ikas-page :deep(.ikas-filter-primary) {
  gap: 12px;
}

.ikas-page :deep(.ikas-filter-fields) {
  gap: 12px;
  margin-top: 12px;
}

.ikas-page :deep(.ikas-search) {
  align-items: center;
  background: #ffffff;
  border: 1px solid var(--ikas-border);
  border-radius: 14px;
  color: var(--ikas-muted);
  display: flex;
  flex: 1;
  gap: 8px;
  min-height: 44px;
  padding: 0 14px;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.ikas-page :deep(.ikas-search input) {
  background: transparent;
  border: 0;
  color: var(--ikas-text);
  min-width: 0;
  outline: 0;
  width: 100%;
}

.ikas-page :deep(.ikas-filter-toggle),
.ikas-page :deep(.ikas-clear-btn) {
  align-items: center;
  border-radius: 12px;
  display: inline-flex;
  font-weight: 700;
  gap: 8px;
  justify-content: center;
  min-height: 44px;
  padding: 0 14px;
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.ikas-page :deep(.ikas-filter-toggle) {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: var(--ikas-blue-dark);
}

.ikas-page :deep(.ikas-clear-btn) {
  background: #ffffff;
  border: 1px solid var(--ikas-border);
  color: var(--ikas-muted);
}

.ikas-page :deep(.ikas-field) {
  background: #f8fafc;
  border: 1px solid var(--ikas-border);
  border-radius: 14px;
  flex: 1;
  min-width: 150px;
  padding: 8px 10px;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.ikas-page :deep(.ikas-field span) {
  color: var(--ikas-muted);
  display: block;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 3px;
  text-transform: uppercase;
}

.ikas-page :deep(.ikas-field input),
.ikas-page :deep(.ikas-field select) {
  background: transparent;
  border: 0;
  color: var(--ikas-text);
  font-size: 13px;
  height: 22px;
  outline: 0;
  width: 100%;
}

.ikas-filter-primary {
  gap: 12px;
}

.ikas-search {
  border-radius: 14px;
  flex: 1;
}

.ikas-search input {
  width: 100%;
}

.ikas-filter-toggle {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  color: var(--ikas-blue-dark);
  min-height: 42px;
  padding: 0 14px;
}

.ikas-filter-fields {
  gap: 12px;
  margin-top: 12px;
}

.ikas-field {
  background: #f8fafc;
  border: 1px solid var(--ikas-border);
  border-radius: 14px;
  flex: 1;
  min-width: 150px;
  padding: 8px 10px;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.ikas-field span,
.ikas-page-size span {
  color: var(--ikas-muted);
  display: block;
  font-size: 11px;
  font-weight: 800;
  margin-bottom: 2px;
  text-transform: uppercase;
}

.ikas-field input,
.ikas-field select,
.ikas-page-size select {
  background: transparent;
  border: 0;
  color: var(--ikas-text);
  outline: 0;
  width: 100%;
}

.ikas-clear-btn {
  background: #ffffff;
  border: 1px solid var(--ikas-border);
  border-radius: 12px;
  color: var(--ikas-muted);
  min-height: 48px;
  padding: 0 14px;
}

.ikas-content-grid {
  align-items: start;
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) 360px;
}

.ikas-list-shell {
  min-width: 0;
  padding: 18px;
}

.ikas-list-header {
  justify-content: space-between;
  margin-bottom: 14px;
}

.ikas-list-header h2 {
  font-size: 18px;
  font-weight: 800;
  margin: 0;
}

.ikas-list-header p {
  margin: 2px 0 0;
}

.ikas-page-size {
  background: #f8fafc;
  border: 1px solid var(--ikas-border);
  border-radius: 12px;
  padding: 8px 10px;
}

.ikas-table-wrap {
  overflow-x: auto;
}

.ikas-table {
  border-collapse: separate;
  border-spacing: 0 10px;
  table-layout: fixed;
  min-width: 920px;
  width: 100%;
}

.ikas-table th:nth-child(1),
.ikas-table td:nth-child(1) {
  width: 36%;
}

.ikas-table th:nth-child(2),
.ikas-table td:nth-child(2) {
  width: 21%;
}

.ikas-table th:nth-child(3),
.ikas-table td:nth-child(3) {
  width: 18%;
}

.ikas-table th:nth-child(4),
.ikas-table td:nth-child(4) {
  width: 11%;
}

.ikas-table th:nth-child(5),
.ikas-table td:nth-child(5) {
  width: 14%;
}

.ikas-table th {
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
  padding: 0 16px 4px;
  text-transform: uppercase;
}

.ikas-table-row {
  cursor: pointer;
  outline: none;
  transition: transform 180ms ease;
}

.ikas-table-row td {
  background: #ffffff;
  border-bottom: 1px solid var(--ikas-border);
  border-top: 1px solid var(--ikas-border);
  padding: 14px 16px;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease, background 180ms ease;
}

.ikas-table-row td:first-child {
  border-left: 1px solid var(--ikas-border);
  border-radius: 16px 0 0 16px;
}

.ikas-table-row td:last-child {
  border-radius: 0 16px 16px 0;
  border-right: 1px solid var(--ikas-border);
}

.ikas-table-row:hover td,
.ikas-table-row:focus-visible td,
.ikas-table-row.is-selected td {
  background: #f8fbff;
  border-color: rgba(37, 99, 235, 0.4);
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.08);
}

.ikas-company {
  gap: 12px;
  min-width: 220px;
}

.ikas-company strong {
  color: var(--ikas-text);
  display: block;
  font-weight: 800;
}

.ikas-company small,
.ikas-updated small {
  display: block;
  font-size: 12px;
}

.ikas-avatar {
  border: 1px solid var(--ikas-border);
  border-radius: 14px;
  flex: 0 0 42px;
  height: 42px;
  object-fit: cover;
  width: 42px;
}

.ikas-page :deep(.ikas-table-row) {
  cursor: pointer;
  outline: none;
  transition: transform 180ms ease;
}

.ikas-page :deep(.ikas-table-row td) {
  background: #ffffff;
  border-bottom: 1px solid var(--ikas-border);
  border-top: 1px solid var(--ikas-border);
  padding: 14px 16px;
  transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
  vertical-align: middle;
}

.ikas-page :deep(.ikas-table-row td:first-child) {
  border-left: 1px solid var(--ikas-border);
  border-radius: 16px 0 0 16px;
}

.ikas-page :deep(.ikas-table-row td:last-child) {
  border-radius: 0 16px 16px 0;
  border-right: 1px solid var(--ikas-border);
}

.ikas-page :deep(.ikas-table-row:hover td),
.ikas-page :deep(.ikas-table-row:focus-visible td),
.ikas-page :deep(.ikas-table-row.is-selected td) {
  background: #f8fbff;
  border-color: rgba(37, 99, 235, 0.4);
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.08);
}

.ikas-page :deep(.ikas-company) {
  align-items: center;
  display: flex;
  gap: 12px;
  min-width: 0;
}

.ikas-page :deep(.ikas-company > div) {
  min-width: 0;
}

.ikas-page :deep(.ikas-company strong) {
  color: var(--ikas-text);
  display: block;
  font-size: 13px;
  font-weight: 850;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-page :deep(.ikas-company small) {
  color: var(--ikas-muted);
  display: block;
  font-size: 11px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-page :deep(.ikas-avatar) {
  border: 1px solid var(--ikas-border) !important;
  border-radius: 14px !important;
  flex: 0 0 42px !important;
  height: 42px !important;
  max-height: 42px !important;
  max-width: 42px !important;
  object-fit: cover !important;
  width: 42px !important;
}

.ikas-page :deep(.ikas-avatar-fallback) {
  align-items: center;
  background: linear-gradient(135deg, #dbeafe, #cffafe);
  color: var(--ikas-blue-dark);
  display: inline-flex;
  font-size: 13px;
  font-weight: 900;
  justify-content: center;
}

.ikas-page :deep(.ikas-sector-pill),
.ikas-page :deep(.ikas-status),
.ikas-page :deep(.ikas-score-badge) {
  border-radius: 999px;
  display: inline-flex;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  padding: 8px 10px;
  white-space: nowrap;
}

.ikas-page :deep(.ikas-sector-pill) {
  background: #eff6ff;
  color: #1d4ed8;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ikas-page :deep(.ikas-status.validated) {
  background: #dcfce7;
  color: #166534;
}

.ikas-page :deep(.ikas-status.draft) {
  background: #f1f5f9;
  color: #475569;
}

.ikas-page :deep(.ikas-status.edit-request) {
  background: #fef3c7;
  color: #92400e;
}

.ikas-page :deep(.ikas-score-cell) {
  min-width: 0;
}

.ikas-page :deep(.ikas-score-badge) {
  margin-bottom: 8px;
}

.ikas-page :deep(.ikas-score-badge.risk) {
  background: #fee2e2;
  color: #991b1b;
}

.ikas-page :deep(.ikas-score-badge.watch) {
  background: #fef3c7;
  color: #92400e;
}

.ikas-page :deep(.ikas-score-badge.healthy) {
  background: #dcfce7;
  color: #166534;
}

.ikas-page :deep(.ikas-score-track) {
  background: #e5e7eb;
  border-radius: 999px;
  height: 8px;
  overflow: hidden;
}

.ikas-page :deep(.ikas-score-fill) {
  background: linear-gradient(90deg, #ef4444 0%, #f59e0b 48%, #16a34a 100%);
  border-radius: inherit;
  display: block;
  height: 100%;
  transition: width 280ms ease;
}

.ikas-page :deep(.ikas-updated strong) {
  color: var(--ikas-text);
  display: block;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.25;
}

.ikas-page :deep(.ikas-updated small) {
  color: var(--ikas-muted);
  display: block;
  font-size: 11px;
  line-height: 1.3;
}

.ikas-avatar-fallback {
  align-items: center;
  background: linear-gradient(135deg, #dbeafe, #cffafe);
  color: var(--ikas-blue-dark);
  display: inline-flex;
  font-size: 13px;
  font-weight: 900;
  justify-content: center;
}

.ikas-avatar-large {
  border-radius: 20px;
  flex-basis: 62px;
  height: 62px;
  width: 62px;
}

.ikas-sector-pill,
.ikas-status,
.ikas-score-badge {
  border-radius: 999px;
  display: inline-flex;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  padding: 8px 10px;
  white-space: nowrap;
}

.ikas-sector-pill {
  background: #eff6ff;
  color: #1d4ed8;
}

.ikas-status.validated {
  background: #dcfce7;
  color: #166534;
}

.ikas-status.draft {
  background: #f1f5f9;
  color: #475569;
}

.ikas-status.edit-request {
  background: #fef3c7;
  color: #92400e;
}

.ikas-score-cell {
  min-width: 148px;
}

.ikas-score-badge {
  margin-bottom: 8px;
}

.ikas-score-badge.risk {
  background: #fee2e2;
  color: #991b1b;
}

.ikas-score-badge.watch {
  background: #fef3c7;
  color: #92400e;
}

.ikas-score-badge.healthy {
  background: #dcfce7;
  color: #166534;
}

.ikas-score-track,
.ikas-domain-bar {
  background: #e5e7eb;
  border-radius: 999px;
  height: 8px;
  overflow: hidden;
}

.ikas-score-fill {
  background: linear-gradient(90deg, #ef4444 0%, #f59e0b 48%, #16a34a 100%);
  border-radius: inherit;
  display: block;
  height: 100%;
  transition: width 280ms ease;
}

.ikas-updated {
  min-width: 112px;
}

.ikas-updated strong {
  display: block;
  font-weight: 800;
}

.ikas-mobile-list {
  display: none;
}

.ikas-mobile-card {
  background: #ffffff;
  border: 1px solid var(--ikas-border);
  border-radius: 18px;
  color: inherit;
  display: block;
  padding: 14px;
  text-align: left;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
  width: 100%;
}

.ikas-mobile-card + .ikas-mobile-card {
  margin-top: 12px;
}

.ikas-mobile-card:hover,
.ikas-mobile-card:focus-visible,
.ikas-mobile-card.is-selected {
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.1);
  transform: translateY(-1px);
}

.ikas-mobile-card-top,
.ikas-mobile-meta {
  justify-content: space-between;
}

.ikas-mobile-card .ikas-score-cell {
  margin-top: 14px;
}

.ikas-mobile-meta {
  color: var(--ikas-muted);
  font-size: 12px;
  font-weight: 700;
  margin-top: 10px;
}

.ikas-pagination {
  border-top: 1px solid var(--ikas-border);
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 16px;
}

.ikas-pagination button {
  background: #ffffff;
  border: 1px solid var(--ikas-border);
  border-radius: 12px;
  color: var(--ikas-text);
  min-height: 38px;
  padding: 0 12px;
}

.ikas-pagination button:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.ikas-detail-panel {
  animation: ikasPanelIn 220ms ease both;
  padding: 18px;
  position: sticky;
  top: 188px;
}

.ikas-panel-close {
  background: #f8fafc;
  border: 1px solid var(--ikas-border);
  border-radius: 12px;
  color: var(--ikas-muted);
  float: right;
  height: 36px;
  width: 36px;
}

.ikas-panel-hero {
  clear: both;
  gap: 14px;
  margin-bottom: 18px;
}

.ikas-panel-hero h2 {
  font-size: 18px;
  font-weight: 850;
  margin: 4px 0;
}

.ikas-panel-hero p {
  color: var(--ikas-muted);
  margin: 0;
}

.ikas-panel-score {
  background: linear-gradient(135deg, #eff6ff, #f8fafc);
  border: 1px solid rgba(37, 99, 235, 0.14);
  border-radius: 18px;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 16px;
}

.ikas-panel-score strong {
  display: block;
  font-size: 34px;
  line-height: 1;
  margin: 6px 0;
}

.ikas-domain-card,
.ikas-panel-meta {
  border: 1px solid var(--ikas-border);
  border-radius: 18px;
  padding: 16px;
}

.ikas-domain-card h3 {
  font-size: 15px;
  font-weight: 850;
  margin: 0 0 14px;
}

.ikas-domain-row + .ikas-domain-row {
  margin-top: 12px;
}

.ikas-domain-row > div:first-child {
  display: flex;
  font-size: 13px;
  font-weight: 800;
  justify-content: space-between;
  margin-bottom: 6px;
}

.ikas-domain-bar span {
  border-radius: inherit;
  display: block;
  height: 100%;
  transition: width 280ms ease;
}

.ikas-panel-meta {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 16px;
}

.ikas-panel-meta strong {
  display: block;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-open-detail {
  margin-top: 16px;
  width: 100%;
}

.ikas-skeleton-list {
  display: grid;
  gap: 10px;
}

.ikas-skeleton-row {
  align-items: center;
  border: 1px solid var(--ikas-border);
  border-radius: 16px;
  display: grid;
  gap: 18px;
  grid-template-columns: 1.4fr 0.8fr 1fr;
  padding: 18px;
}

.ikas-skeleton-row span {
  animation: ikasSkeleton 1.1s ease-in-out infinite;
  background: linear-gradient(90deg, #eef2f7, #f8fafc, #eef2f7);
  background-size: 200% 100%;
  border-radius: 999px;
  height: 14px;
}

.ikas-empty-state {
  align-items: center;
  display: flex;
  flex-direction: column;
  min-height: 360px;
  justify-content: center;
  padding: 32px;
  text-align: center;
}

.ikas-empty-illustration {
  align-items: center;
  background: linear-gradient(135deg, #dbeafe, #cffafe);
  border-radius: 28px;
  color: var(--ikas-blue-dark);
  display: flex;
  font-size: 42px;
  height: 92px;
  justify-content: center;
  margin-bottom: 18px;
  width: 92px;
}

.ikas-empty-state h3 {
  font-size: 22px;
  font-weight: 850;
  margin: 0 0 8px;
}

.ikas-empty-state p {
  color: var(--ikas-muted);
  margin-bottom: 18px;
}

.ikas-icon-btn:hover,
.ikas-profile-btn:hover,
.ikas-filter-toggle:hover,
.ikas-refresh-btn:hover,
.ikas-clear-btn:hover,
.ikas-pagination button:not(:disabled):hover,
.ikas-panel-close:hover,
.ikas-open-detail:hover {
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.12);
  transform: translateY(-1px);
}

@keyframes ikasPanelIn {
  from {
    opacity: 0;
    transform: translateX(18px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes ikasSkeleton {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (max-width: 1400px) {
  .ikas-kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ikas-content-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .ikas-detail-panel {
    position: static;
  }
}

@media (max-width: 992px) {
  .ikas-topbar {
    align-items: stretch;
    flex-direction: column;
    gap: 16px;
    top: 70px;
  }

  .ikas-header-actions {
    flex-wrap: wrap;
  }

  .ikas-header-search {
    flex: 1 1 100%;
  }

  .ikas-header-search input {
    min-width: 0;
    width: 100%;
  }

  .ikas-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ikas-filter-fields {
    align-items: stretch;
    display: none;
    flex-direction: column;
  }

  .ikas-filter-fields.is-open {
    display: flex;
  }

  .ikas-clear-btn {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .ikas-page {
    gap: 16px;
  }

  .ikas-realtime-strip,
  .ikas-list-header,
  .ikas-pagination {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .ikas-kpi-grid {
    grid-template-columns: 1fr;
  }

  .ikas-table-wrap {
    display: none;
  }

  .ikas-mobile-list {
    display: block;
  }

  .ikas-panel-score,
  .ikas-mobile-card-top {
    align-items: flex-start;
    flex-direction: column;
  }

  .ikas-panel-meta {
    grid-template-columns: 1fr;
  }

  .ikas-skeleton-row {
    grid-template-columns: 1fr;
  }
}
</style>
