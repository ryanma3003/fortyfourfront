<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import gsap from 'gsap';
import { useRouter } from 'vue-router';
import Pageheader from '@/shared/components/pageheader/pageheader.vue';
import { ikasService } from '@/services/ikas.service';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { getMaturityLabel, useIkasStore } from '@/stores/ikas';
import type { Stakeholder } from '@/types/stakeholders.types';

type StatusFilter = 'all' | 'validated' | 'draft' | 'edit-request';
type IkasAction = 'validate' | 'approve' | 'reject';

interface IkasRecord {
  id: string;
  slug: string;
  companyName: string;
  sector: string;
  subSector: string;
  logo: string;
  score: number;
  status: 'validated' | 'draft' | 'edit-request';
  statusLabel: string;
  measurementDate: string;
  measurementYear: string;
  updatedAt: string;
  createdAt: string;
  targetScore: number;
  respondent: string;
  position: string;
  phone: string;
  editRequestReason: string;
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
const ikasStore = useIkasStore();

const pageData = {
  title: { label: 'Dashboards', path: '/dashboard' },
  currentpage: 'IKAS Management',
  activepage: 'IKAS List',
};

const loading = ref(true);
const rawIkasRecords = ref<any[]>([]);
const searchQuery = ref('');
const sectorFilter = ref('all');
const subSectorFilter = ref('all');
const statusFilter = ref<StatusFilter>('all');
const currentMeasurementYear = String(new Date().getFullYear());
const yearFilter = ref(currentMeasurementYear);
const monthFilter = ref('all');
const filtersOpen = ref(true);
const selectedRecord = ref<IkasRecord | null>(null);
const currentPage = ref(1);
const pageSize = ref(12);
const lastRefreshAt = ref<Date | null>(null);
const actionLoading = ref<Record<string, IkasAction | undefined>>({});
const actionError = ref('');
const actionConfirmation = ref<{ action: IkasAction; record: IkasRecord } | null>(null);
const rejectReason = ref('');
const exportLoadingId = ref('');
const isDarkMode = ref(false);
const ikasPageRef = ref<HTMLElement | null>(null);
let actionSyncTimer: ReturnType<typeof setTimeout> | undefined;
let themeObserver: MutationObserver | undefined;
let gsapCtx: gsap.Context | null = null;
let isPageTransitioning = false;
let hasRunInitialEntrance = false;

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

const getEditRequestStatus = (record: any): string => {
  const rawStatus =
    record?.edit_request_status ??
    record?.editRequestStatus ??
    record?.request_edit_status ??
    record?.requestEditStatus ??
    record?.status_request_edit ??
    record?.edit_request?.status ??
    record?.request_edit?.status ??
    '';

  return String(rawStatus || '').trim().toLowerCase();
};

const getEditRequestReason = (record: any): string => {
  const rawReason =
    record?.edit_request_reason ??
    record?.editRequestReason ??
    record?.request_edit_reason ??
    record?.requestEditReason ??
    record?.reject_reason ??
    record?.rejectReason ??
    record?.reason ??
    record?.edit_request?.reason ??
    record?.request_edit?.reason ??
    record?.edit_request?.reject_reason ??
    record?.request_edit?.reject_reason ??
    '';

  return String(rawReason || '').trim();
};

const getValidatedStatus = (record: any): boolean => {
  const rawStatus = record?.is_validated ?? record?.isValidated ?? record?.status;
  if (typeof rawStatus === 'boolean') return rawStatus;
  if (typeof rawStatus === 'number') return rawStatus === 1;

  const normalized = String(rawStatus ?? '').trim().toLowerCase();
  if (['true', '1', 'validated', 'active', 'approved'].includes(normalized)) return true;
  if (['false', '0', 'draft', 'inactive'].includes(normalized)) return false;

  return false;
};

const parseIkasDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  let raw = String(value).trim();
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  // Backend returns WIB timestamps mislabeled as UTC.
  // Strip timezone indicators so JS parses them as local time (WIB).
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(raw)) {
    raw = raw.replace(' ', 'T');
  }
  raw = raw.replace(/Z$/i, '');
  raw = raw.replace(/[+-]00:00$/, '');

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getRecordMeasurementDate = (record: any): string => (
  record?.tanggal ||
  record?.tanggal_pengisian ||
  record?.tanggalPengisian ||
  record?.tanggal_pengukuran ||
  record?.tanggalPengukuran ||
  ''
);

const getRecordMeasurementYear = (record: any): string => {
  const explicitYear = String(
    record?.tahun_pengukuran ||
    record?.tahunPengukuran ||
    record?.tahun ||
    record?.year ||
    '',
  ).match(/\d{4}/)?.[0];

  if (explicitYear) return explicitYear;

  const dateValue = getRecordMeasurementDate(record) || record?.created_at || record?.updated_at || '';
  const date = parseIkasDate(dateValue);
  return date ? String(date.getFullYear()) : '';
};

const getRecordSortTime = (record: any): number => {
  const dateValue = record?.updated_at || record?.created_at || getRecordMeasurementDate(record) || '';
  return parseIkasDate(dateValue)?.getTime() || 0;
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

const getRecordCompanyKey = (record: any): string => {
  const stakeholder = getStakeholderForRecord(record);
  const company = record?.perusahaan || {};

  return String(
    stakeholder?.id ||
    record?.id_perusahaan ||
    company?.id ||
    stakeholder?.slug ||
    company?.slug ||
    record?.perusahaan_slug ||
    record?.slug ||
    record?.id ||
    '',
  );
};

const getRecordIdentity = (record: any, resolvedSlug = '') => {
  const stakeholder = getStakeholderForRecord(record);
  const company = record?.perusahaan || {};

  const slugs = [
    resolvedSlug,
    stakeholder?.slug,
    company?.slug,
    record?.perusahaan_slug,
    record?.slug,
  ].filter(Boolean).map(String);

  const companyIds = [
    stakeholder?.id,
    record?.id_perusahaan,
    company?.id,
  ].filter(Boolean).map(String);

  const ikasIds = [
    record?.id,
  ].filter(Boolean).map(String);

  return {
    slugs: new Set(slugs),
    companyIds: new Set(companyIds),
    ikasIds: new Set(ikasIds),
  };
};

const findSummaryForRecord = (record: any, resolvedSlug = '') => {
  const identity = getRecordIdentity(record, resolvedSlug);
  const recordIds = Array.from(identity.ikasIds);
  const summaries = Object.values(ikasStore.ikasSummaryMap);

  if (recordIds.length) {
    return summaries.find((summary) => identity.ikasIds.has(String(summary.id)));
  }

  for (const slug of identity.slugs) {
    const summary = ikasStore.ikasSummaryMap[slug];
    if (summary) return summary;
  }

  return summaries.find((summary) => (
    identity.companyIds.has(String(summary.id_perusahaan)) ||
    identity.slugs.has(String(summary.slug))
  ));
};

const getStoreDataForRecord = (record: any, resolvedSlug = '') => {
  const summary = findSummaryForRecord(record, resolvedSlug);
  return summary?.slug ? ikasStore.ikasDataMap[summary.slug] : undefined;
};

const pickLatestRecordPerCompany = (records: any[], targetYear: string): any[] => {
  const latestByCompany = new Map<string, any>();

  records.forEach((record) => {
    const recordYear = getRecordMeasurementYear(record);
    if (targetYear !== 'all' && recordYear !== targetYear) return;

    const companyKey = getRecordCompanyKey(record);
    if (!companyKey) return;

    const current = latestByCompany.get(companyKey);
    if (!current || getRecordSortTime(record) >= getRecordSortTime(current)) {
      latestByCompany.set(companyKey, record);
    }
  });

  return Array.from(latestByCompany.values());
};

const getDomainScore = (record: any, key: 'identifikasi' | 'proteksi' | 'deteksi' | 'gulih'): number => {
  const data = record?.[key] || record?.[key === 'gulih' ? 'tanggulih' : key] || {};
  const scoreKey = key === 'gulih' ? 'nilai_gulih' : `nilai_${key}`;
  return numberValue(data?.[scoreKey] ?? data?.nilai ?? data?.score ?? 0);
};

const getStatus = (record: any, slug: string): IkasRecord['status'] => {
  // Check Pinia store first for immediate/optimistic UI updates from other components
  const storeData = getStoreDataForRecord(record, slug);
  const storeSummary = findSummaryForRecord(record, slug);
  const storeEditStatus = getEditRequestStatus(storeData);
  const summaryEditStatus = getEditRequestStatus(storeSummary);
  if (storeEditStatus === 'pending' || summaryEditStatus === 'pending') return 'edit-request';

  // Fallback to record data from list API
  const editStatus = getEditRequestStatus(record);
  if (editStatus === 'pending') return 'edit-request';

  // Check validation status
  if (getValidatedStatus(storeData) || getValidatedStatus(storeSummary) || getValidatedStatus(record)) return 'validated';

  return 'draft';
};

const statusLabelMap: Record<IkasRecord['status'], string> = {
  validated: 'Active',
  draft: 'Inactive',
  'edit-request': 'Edit Request',
};

/**
 * Backend returns WIB (UTC+7) timestamps but incorrectly labels them
 * as UTC with a 'Z' suffix (e.g. "2026-05-02T12:03:41Z" is actually 12:03 WIB).
 * Strip the Z so the browser parses them as local time, which is correct.
 */
const normalizeUtcTimestamp = (ts: string): string => {
  if (!ts) return '';
  let s = String(ts).trim();
  // SQL format: "2026-05-02 05:00:00" → "2026-05-02T05:00:00" (local)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
    s = s.replace(' ', 'T');
  }
  // Strip Z suffix — backend timestamps are actually WIB, not UTC
  s = s.replace(/Z$/i, '');
  // Strip +00:00 offset if present (also mislabeled)
  s = s.replace(/[+-]00:00$/, '');
  return s;
};

const mapRecord = (record: any): IkasRecord => {
  const stakeholder = getStakeholderForRecord(record);
  const company = record?.perusahaan || {};
  const slug = stakeholder?.slug || company?.slug || String(record?.slug || record?.id || '');
  const score = numberValue(record?.nilai_kematangan ?? record?.total_rata_rata ?? record?.score ?? 0);
  const status = getStatus(record, slug);
  const sectorObject = stakeholder?.sub_sektor || company?.sub_sektor;
  const measurementDate = getRecordMeasurementDate(record);
  const measurementYear = getRecordMeasurementYear(record);
  const storeData = getStoreDataForRecord(record, slug);
  const storeSummary = findSummaryForRecord(record, slug);

  const _rawTs = record?.updated_at || record?.tanggal || record?.created_at || '';
  const _normTs = normalizeUtcTimestamp(_rawTs);

  return {
    id: String(record?.id || slug),
    slug,
    companyName: stakeholder?.nama_perusahaan || company?.nama_perusahaan || record?.nama_perusahaan || 'Unknown Company',
    sector: sectorObject?.nama_sektor || stakeholder?.sektor || company?.sektor || record?.sektor || 'Unassigned',
    subSector: sectorObject?.nama_sub_sektor || record?.sub_sektor || record?.nama_sub_sektor || 'Unassigned',
    logo: stakeholder?.photo || company?.photo || '',
    score,
    status,
    statusLabel: statusLabelMap[status],
    measurementDate,
    measurementYear,
    updatedAt: _normTs,
    createdAt: normalizeUtcTimestamp(record?.created_at || ''),
    targetScore: numberValue(record?.target_nilai ?? record?.targetScore ?? 0),
    respondent: record?.responden || '-',
    position: record?.jabatan || '-',
    phone: record?.telepon || '-',
    editRequestReason: getEditRequestReason(storeData) || getEditRequestReason(storeSummary) || getEditRequestReason(record),
    domains: [
      { key: 'identifikasi', label: 'Identifikasi', score: getDomainScore(record, 'identifikasi'), color: '#2563eb' },
      { key: 'proteksi', label: 'Proteksi', score: getDomainScore(record, 'proteksi'), color: '#0891b2' },
      { key: 'deteksi', label: 'Deteksi', score: getDomainScore(record, 'deteksi'), color: '#16a34a' },
      { key: 'gulih', label: 'Gulih', score: getDomainScore(record, 'gulih'), color: '#f59e0b' },
    ],
    raw: record,
  };
};

const records = computed(() => {
  // Access ikasVersion to trigger recomputation when store changes (e.g. request-edit from ikas.vue)
  void ikasStore.ikasVersion;
  return pickLatestRecordPerCompany(rawIkasRecords.value, yearFilter.value).map(mapRecord);
});

const sectors = computed(() => {
  const unique = new Set(records.value.map((item) => item.sector).filter(Boolean));
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
});

const subSectors = computed(() => {
  const items = records.value
    .filter((item) => sectorFilter.value === 'all' || item.sector === sectorFilter.value)
    .map((item) => item.subSector)
    .filter(Boolean);
  return Array.from(new Set(items)).sort((a, b) => a.localeCompare(b));
});

const years = computed(() => {
  const values = rawIkasRecords.value
    .map((item) => getRecordMeasurementYear(item))
    .filter(Boolean);
  return Array.from(new Set([currentMeasurementYear, ...values])).sort((a, b) => Number(b) - Number(a));
});

const months = [
  { value: '1', label: 'Januari' },
  { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' },
  { value: '4', label: 'April' },
  { value: '5', label: 'Mei' },
  { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' },
  { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
];

const filteredRecords = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return records.value
    .filter((item) => {
      const measurementDate = parseIkasDate(item.measurementDate || item.createdAt || item.updatedAt || '');
      const itemMonth = measurementDate ? String(measurementDate.getMonth() + 1) : '';
      const matchesQuery = !query ||
        item.companyName.toLowerCase().includes(query) ||
        item.sector.toLowerCase().includes(query) ||
        item.subSector.toLowerCase().includes(query);
      const matchesSector = sectorFilter.value === 'all' || item.sector === sectorFilter.value;
      const matchesSubSector = subSectorFilter.value === 'all' || item.subSector === subSectorFilter.value;
      const matchesStatus = statusFilter.value === 'all' || item.status === statusFilter.value;
      const matchesMonth = monthFilter.value === 'all' || itemMonth === monthFilter.value;

      return matchesQuery && matchesSector && matchesSubSector && matchesStatus && matchesMonth;
    })
    .sort((a, b) => (parseIkasDate(b.updatedAt)?.getTime() || 0) - (parseIkasDate(a.updatedAt)?.getTime() || 0));
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRecords.value.length / pageSize.value)));
const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredRecords.value.slice(start, start + pageSize.value);
});

const latestUpdate = computed(() => {
  const latest = records.value
    .map((item) => parseIkasDate(item.updatedAt)?.getTime() || 0)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];

  return latest ? formatRelativeTime(latest) : 'No updates';
});

const averageScore = computed(() => {
  if (!records.value.length) return 0;
  return records.value.reduce((sum, item) => sum + item.score, 0) / records.value.length;
});

const ikasStakeholderIdentity = computed(() => {
  const ids = new Set<string>();
  const slugs = new Set<string>();

  rawIkasRecords.value.forEach((record) => {
    const stakeholder = getStakeholderForRecord(record);
    const company = record?.perusahaan || {};

    [
      record?.id_perusahaan,
      company?.id,
      stakeholder?.id,
    ].filter(Boolean).forEach((id) => ids.add(String(id)));

    [
      record?.slug,
      company?.slug,
      stakeholder?.slug,
    ].filter(Boolean).forEach((slug) => slugs.add(String(slug)));
  });

  return { ids, slugs };
});

const stakeholdersWithIkasCount = computed(() => {
  const { ids, slugs } = ikasStakeholderIdentity.value;
  const matched = stakeholdersStore.stakeholders.filter((stakeholder) => (
    ids.has(String(stakeholder.id)) || slugs.has(String(stakeholder.slug))
  )).length;

  return matched || Math.max(ids.size, slugs.size);
});

const stakeholdersWithoutIkasCount = computed(() => Math.max(
  0,
  stakeholdersStore.stakeholders.length - stakeholdersWithIkasCount.value,
));

const stakeholderIkasCoverage = computed(() => {
  const total = stakeholdersStore.stakeholders.length;
  if (!total) return 0;
  return Math.round((stakeholdersWithIkasCount.value / total) * 100);
});

const statusCounts = computed(() => ({
  validated: records.value.filter((item) => item.status === 'validated').length,
  draft: records.value.filter((item) => item.status === 'draft').length,
  editRequest: records.value.filter((item) => item.status === 'edit-request').length,
}));

const summaryTopSectors = computed(() => {
  const sectorMap = new Map<string, { label: string; count: number; score: number }>();

  records.value.forEach((record) => {
    const label = record.sector || 'Unassigned';
    const current = sectorMap.get(label) || { label, count: 0, score: 0 };
    current.count += 1;
    current.score += record.score;
    sectorMap.set(label, current);
  });

  return Array.from(sectorMap.values())
    .map((sector) => ({
      ...sector,
      average: sector.count ? sector.score / sector.count : 0,
    }))
    .sort((a, b) => b.count - a.count || b.average - a.average)
    .slice(0, 4);
});

const attentionStats = computed(() => {
  const belowTarget = records.value.filter((item) => item.targetScore > 0 && item.score < item.targetScore).length;
  const lowScore = records.value.filter((item) => item.score < 2).length;

  return [
    {
      label: 'Edit Request',
      value: statusCounts.value.editRequest,
      hint: 'Butuh keputusan Acc / Reject',
      tone: 'edit-request',
      icon: 'ri-edit-2-line',
    },
    {
      label: 'Di Bawah Target',
      value: belowTarget,
      hint: 'Score belum mencapai target',
      tone: 'risk',
      icon: 'ri-arrow-down-line',
    },
    {
      label: 'Inactive',
      value: statusCounts.value.draft,
      hint: 'Belum active / validasi',
      tone: 'draft',
      icon: 'ri-time-line',
    },
    {
      label: 'Skor Rendah',
      value: lowScore,
      hint: 'IKAS di bawah level 2',
      tone: 'risk',
      icon: 'ri-alarm-warning-line',
    },
  ];
});

const attentionRecords = computed(() => records.value
  .map((record) => {
    const belowTarget = record.targetScore > 0 && record.score < record.targetScore;
    const lowScore = record.score < 2;

    if (record.status === 'edit-request') {
      return {
        record,
        priority: 1,
        tone: 'edit-request',
        icon: 'ri-edit-2-line',
        reason: record.editRequestReason ? `Alasan: ${record.editRequestReason}` : 'Permintaan edit menunggu keputusan',
      };
    }

    if (belowTarget) {
      return {
        record,
        priority: 2,
        tone: 'risk',
        icon: 'ri-arrow-down-line',
        reason: `Di bawah target ${(record.targetScore - record.score).toFixed(2)} poin`,
      };
    }

    if (lowScore) {
      return {
        record,
        priority: 3,
        tone: 'risk',
        icon: 'ri-alarm-warning-line',
        reason: 'Skor IKAS masih di bawah level 2',
      };
    }

    if (record.status === 'draft') {
      return {
        record,
        priority: 4,
        tone: 'draft',
        icon: 'ri-time-line',
        reason: 'Belum active / perlu validasi',
      };
    }

    return null;
  })
  .filter(Boolean)
  .sort((a, b) => {
    if (!a || !b) return 0;
    return a.priority - b.priority || a.record.score - b.record.score;
  })
  .slice(0, 5));

const activeFiltersCount = computed(() => [
  searchQuery.value.trim(),
  sectorFilter.value !== 'all',
  subSectorFilter.value !== 'all',
  statusFilter.value !== 'all',
  yearFilter.value !== currentMeasurementYear,
  monthFilter.value !== 'all',
].filter(Boolean).length);

const visibleRangeStart = computed(() => {
  if (!filteredRecords.value.length) return 0;
  return (currentPage.value - 1) * pageSize.value + 1;
});

const visibleRangeEnd = computed(() => Math.min(currentPage.value * pageSize.value, filteredRecords.value.length));

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
    value: String(statusCounts.value.validated),
    hint: 'Validated assessments',
    icon: 'ri-shield-check-line',
    tone: 'green',
  },
  {
    label: 'Inactive IKAS',
    value: String(statusCounts.value.draft),
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
    hint: lastRefreshAt.value ? `Synced ${formatRelativeTime(lastRefreshAt.value)}` : 'Waiting for sync',
    icon: 'ri-refresh-line',
    tone: 'slate',
  },
]);

const clearFilters = () => {
  searchQuery.value = '';
  sectorFilter.value = 'all';
  subSectorFilter.value = 'all';
  statusFilter.value = 'all';
  yearFilter.value = currentMeasurementYear;
  monthFilter.value = 'all';
};

let loadDataPromise: Promise<void> | null = null;

const loadData = async (showLoading = true) => {
  if (loadDataPromise) return loadDataPromise;
  if (!showLoading && document.visibilityState === 'hidden') return;

  if (showLoading) loading.value = true;

  loadDataPromise = (async () => {
    try {
      await Promise.all([
        ikasStore.initialized ? ikasStore.refresh() : ikasStore.initialize(),
        stakeholdersStore.initialize(),
      ]);
      rawIkasRecords.value = normalizeResponse(ikasStore.ikasRawRecords);
      lastRefreshAt.value = new Date();
      if (!records.value.length) {
        selectedRecord.value = null;
      } else if (selectedRecord.value && !records.value.some((item) => item.id === selectedRecord.value?.id)) {
        selectedRecord.value = null;
      }
    } catch (error) {
      console.error('Failed to load IKAS list:', error);
      rawIkasRecords.value = [];
    } finally {
      if (showLoading) loading.value = false;
      loadDataPromise = null;
    }
  })();

  return loadDataPromise;
};

const selectRecord = (record: IkasRecord) => {
  selectedRecord.value = record;
};

const openFullDetail = () => {
  if (!selectedRecord.value?.slug) return;
  router.push({ path: '/ikas', query: { slug: selectedRecord.value.slug, source: 'list' } });
};

const safeFileName = (value: string): string => String(value || 'IKAS')
  .trim()
  .replace(/[\\/:*?"<>|]+/g, '')
  .replace(/\s+/g, '_')
  .slice(0, 80) || 'IKAS';

const getFileNameFromResponse = (response: Response, fallbackName: string): string => {
  const disposition = response.headers.get('Content-Disposition') || '';
  const fileNameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
  return fileNameMatch ? decodeURIComponent(fileNameMatch[1] || fileNameMatch[2]) : fallbackName;
};

const exportRecordPdf = async (record: IkasRecord) => {
  if (!record.id || exportLoadingId.value) return;

  actionError.value = '';
  exportLoadingId.value = record.id;
  try {
    const response = await ikasService.exportIkasPdf(record.id);
    const fallbackName = `IKAS_Report_${safeFileName(record.companyName)}.pdf`;
    const fileName = getFileNameFromResponse(response, fallbackName);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error('Failed to export IKAS PDF:', error);
    actionError.value = error?.message || 'Gagal mengekspor PDF IKAS';
  } finally {
    exportLoadingId.value = '';
  }
};

const closePanel = () => {
  selectedRecord.value = null;
};

const pendingActionFor = (record: IkasRecord) => actionLoading.value[record.id] || '';

const setRecordActionLoading = (record: IkasRecord, action?: IkasAction) => {
  actionLoading.value = {
    ...actionLoading.value,
    [record.id]: action,
  };
};

const updateSelectedRecord = (recordId: string) => {
  selectedRecord.value = records.value.find((item) => item.id === recordId) || selectedRecord.value;
};

const recordsReferToSameIkas = (rawRecord: any, record: IkasRecord) => {
  const rawIdentity = getRecordIdentity(rawRecord, rawRecord?.perusahaan?.slug || rawRecord?.slug || '');
  const recordIdentity = getRecordIdentity(record.raw, record.slug);
  const rawIds = Array.from(rawIdentity.ikasIds);
  const recordIds = Array.from(recordIdentity.ikasIds);

  if (rawIds.length || recordIds.length) {
    return (
      rawIdentity.ikasIds.has(record.id) ||
      recordIdentity.ikasIds.has(String(rawRecord?.id || '')) ||
      rawIds.some((id) => recordIdentity.ikasIds.has(id))
    );
  }

  return (
    [...rawIdentity.companyIds].some((id) => recordIdentity.companyIds.has(id)) ||
    [...rawIdentity.slugs].some((slug) => recordIdentity.slugs.has(slug))
  );
};

const patchStoreActionResult = (action: IkasAction, record: IkasRecord, reason = '') => {
  const summary = findSummaryForRecord(record.raw, record.slug);
  const slug = summary?.slug || record.slug;
  const data = slug ? ikasStore.ikasDataMap[slug] : undefined;
  const nextEditStatus = action === 'approve'
    ? 'approved'
    : action === 'reject'
      ? 'rejected'
      : '';
  const nextValidated = action === 'validate'
    ? true
    : action === 'approve'
      ? false
      : Boolean(data?.is_validated ?? summary?.is_validated ?? record.raw?.is_validated ?? true);

  if (data) {
    data.is_validated = nextValidated;
    if (nextEditStatus || action === 'validate') {
      data.edit_request_status = nextEditStatus || 'none';
    }
    if (reason || action === 'reject') {
      data.edit_request_reason = reason;
    }
  }

  if (summary) {
    summary.is_validated = nextValidated;
    if (nextEditStatus || action === 'validate') {
      summary.edit_request_status = nextEditStatus || 'none';
    }
    if (reason || action === 'reject') {
      summary.edit_request_reason = reason;
    }
  }

  ikasStore.ikasRawRecords = ikasStore.ikasRawRecords.map((rawRecord: any) => (
    recordsReferToSameIkas(rawRecord, record)
      ? {
          ...rawRecord,
          is_validated: nextValidated,
          status: nextValidated,
          edit_request_status: action === 'validate'
            ? (String(rawRecord?.edit_request_status || '').toLowerCase() === 'pending' ? '' : rawRecord?.edit_request_status)
            : nextEditStatus,
          ...(reason || action === 'reject' ? { edit_request_reason: reason } : {}),
        }
      : rawRecord
  ));

  ikasStore.ikasVersion++;
};

const applyLocalActionResult = (action: IkasAction, record: IkasRecord, reason = '') => {
  rawIkasRecords.value = rawIkasRecords.value.map((rawRecord) => {
    if (!recordsReferToSameIkas(rawRecord, record)) return rawRecord;

    if (action === 'validate') {
      return {
        ...rawRecord,
        is_validated: true,
        status: true,
        edit_request_status: rawRecord?.edit_request_status === 'pending' ? '' : rawRecord?.edit_request_status,
      };
    }

    if (action === 'approve') {
      return {
        ...rawRecord,
        is_validated: false,
        status: false,
        edit_request_status: 'approved',
      };
    }

    return {
      ...rawRecord,
      edit_request_status: 'rejected',
      edit_request_reason: reason,
    };
  });

  patchStoreActionResult(action, record, reason);
  updateSelectedRecord(record.id);
};

const scheduleActionSync = () => {
  if (actionSyncTimer) clearTimeout(actionSyncTimer);
  actionSyncTimer = setTimeout(async () => {
    actionSyncTimer = undefined;
    await loadData(false);
  }, 10000);
};

const actionConfirmMeta = computed(() => {
  const pending = actionConfirmation.value;
  if (!pending) {
    return {
      title: '',
      message: '',
      confirmLabel: '',
      icon: 'ri-question-line',
      tone: 'validate',
    };
  }

  if (pending.action === 'validate') {
    return {
      title: 'Validasi data IKAS?',
      message: `Pastikan data IKAS ${pending.record.companyName} sudah benar sebelum diubah menjadi Active.`,
      confirmLabel: 'Validate',
      icon: 'ri-shield-check-line',
      tone: 'validate',
    };
  }

  if (pending.action === 'approve') {
    return {
      title: 'Setujui permintaan edit?',
      message: `Permintaan edit IKAS ${pending.record.companyName} akan disetujui dan status validasinya dibuka.`,
      confirmLabel: 'Acc',
      icon: 'ri-check-line',
      tone: 'approve',
    };
  }

  return {
    title: 'Tolak permintaan edit?',
    message: `Permintaan edit IKAS ${pending.record.companyName} akan ditolak.`,
    confirmLabel: 'Reject',
    icon: 'ri-close-line',
    tone: 'reject',
  };
});

const closeActionConfirmation = () => {
  const pending = actionConfirmation.value;
  if (pending && pendingActionFor(pending.record)) return;
  actionConfirmation.value = null;
  rejectReason.value = '';
};

const handleIkasAction = (action: IkasAction, record: IkasRecord) => {
  if (!record.id || pendingActionFor(record)) return;
  actionError.value = '';
  rejectReason.value = '';
  actionConfirmation.value = { action, record };
};

const executeIkasAction = async (action: IkasAction, record: IkasRecord, reason = ''): Promise<boolean> => {
  if (!record.id || pendingActionFor(record)) return false;

  actionError.value = '';
  if (action === 'reject' && !reason.trim()) {
    actionError.value = 'Alasan penolakan wajib diisi agar user tahu apa yang perlu diperbaiki.';
    return false;
  }
  setRecordActionLoading(record, action);

  try {
    if (action === 'validate') {
      await ikasService.validateIkas(record.id);
    } else if (action === 'approve') {
      await ikasService.approveEditIkas(record.id);
    } else {
      await ikasService.rejectEditIkas(record.id, reason.trim());
    }

    applyLocalActionResult(action, record, reason.trim());
    window.dispatchEvent(new Event('ikas-requests-updated'));
    scheduleActionSync();
    return true;
  } catch (error: any) {
    actionError.value = error?.message || 'Gagal memproses tindakan IKAS';
    return false;
  } finally {
    setRecordActionLoading(record, undefined);
  }
};

const confirmIkasAction = async () => {
  const pending = actionConfirmation.value;
  if (!pending) return;

  const success = await executeIkasAction(pending.action, pending.record, rejectReason.value);
  if (success) {
    actionConfirmation.value = null;
    rejectReason.value = '';
  }
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

const syncThemeMode = () => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  isDarkMode.value = root.getAttribute('data-theme-mode') === 'dark' || root.classList.contains('dark');
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
          color: isDarkMode.value ? '#e5edf7' : '#0f172a',
          offsetY: 5,
        },
      },
    },
  },
  stroke: { lineCap: 'round' },
});

const formatDate = (value: string) => {
  if (!value) return '-';
  const date = parseIkasDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
};

function formatRelativeTime(value: string | number | Date) {
  if (!value) return '-';
  
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    date = new Date(value);
  } else {
    date = parseIkasDate(value);
  }
  
  if (!date) return '-';

  const now = new Date();
  const diffSeconds = Math.abs(Math.round((now.getTime() - date.getTime()) / 1000));

  if (diffSeconds < 60) return 'baru saja';

  const divisions: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.345, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
  ];
  const formatter = new Intl.RelativeTimeFormat('id-ID', { numeric: 'always' });
  let duration = -diffSeconds;

  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return '-';
}

const prefersReducedMotion = () => (
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

const getVisibleMotionItems = () => {
  const root = ikasPageRef.value;
  if (!root) return [];

  return Array.from(root.querySelectorAll<HTMLElement>('.ikas-table-row, .ikas-mobile-card')).filter((item) => (
    item.getClientRects().length > 0
  ));
};

const animateListItems = (quick = false, done?: () => void) => {
  nextTick(() => {
    if (prefersReducedMotion()) {
      done?.();
      return;
    }

    const items = getVisibleMotionItems();
    if (!items.length) {
      done?.();
      return;
    }

    gsap.killTweensOf(items);
    gsap.set(items, { y: quick ? 16 : 24, opacity: 0, scale: quick ? 0.992 : 0.98, force3D: true });

    const tl = gsap.timeline({
      defaults: { duration: quick ? 0.28 : 0.42, ease: 'power3.out', overwrite: 'auto' },
      onComplete: done,
    });

    items.forEach((item, index) => {
      tl.to(item, { y: 0, opacity: 1, scale: 1, clearProps: 'transform,opacity' }, index * (quick ? 0.04 : 0.06));
    });
  });
};

const animateSummaryPanel = (panel: HTMLElement) => {
  const summaryHero = panel.querySelector<HTMLElement>('.ikas-summary-hero');
  const summaryIcon = panel.querySelector<HTMLElement>('.ikas-summary-icon');
  const stats = Array.from(panel.querySelectorAll<HTMLElement>('.ikas-attention-stat'));
  const priorityCard = panel.querySelector<HTMLElement>('.ikas-attention-card');
  const priorityRows = Array.from(panel.querySelectorAll<HTMLElement>('.ikas-attention-row'));
  const priorityEmpty = panel.querySelector<HTMLElement>('.ikas-attention-empty');
  const sectorCard = panel.querySelector<HTMLElement>('.ikas-summary-sector');
  const sectorRows = Array.from(panel.querySelectorAll<HTMLElement>('.ikas-summary-sector-row'));
  const animatedItems = [
    summaryHero,
    summaryIcon,
    priorityCard,
    priorityEmpty,
    sectorCard,
    ...stats,
    ...priorityRows,
    ...sectorRows,
  ].filter(Boolean) as HTMLElement[];

  gsap.killTweensOf(animatedItems);

  const tl = gsap.timeline({ defaults: { ease: 'power3.out', overwrite: 'auto' } });

  if (summaryHero) {
    tl.fromTo(summaryHero, {
      clipPath: 'inset(0 0 100% 0)',
      opacity: 0,
    }, {
      clipPath: 'inset(0 0 0% 0)',
      opacity: 1,
      duration: 0.42,
      clearProps: 'clipPath,opacity',
    }, 0);
  }

  if (summaryIcon) {
    tl.from(summaryIcon, {
      rotate: -18,
      opacity: 0,
      duration: 0.42,
      ease: 'back.out(1.7)',
      clearProps: 'transform,opacity',
    }, 0.08);
  }

  tl.from(stats, {
    y: 14,
    opacity: 0,
    duration: 0.32,
    stagger: { each: 0.055, from: 'edges' },
    clearProps: 'transform,opacity',
  }, 0.14);

  if (priorityCard) {
    tl.from(priorityCard, {
      x: 18,
      opacity: 0,
      duration: 0.36,
      clearProps: 'transform,opacity',
    }, 0.28);
  }

  tl.from(priorityRows, {
    x: (index) => (index % 2 === 0 ? -18 : 18),
    opacity: 0,
    duration: 0.28,
    stagger: 0.045,
    clearProps: 'transform,opacity',
  }, 0.42);

  if (priorityEmpty) {
    tl.from(priorityEmpty, {
      y: 10,
      opacity: 0,
      duration: 0.3,
      ease: 'back.out(1.35)',
      clearProps: 'transform,opacity',
    }, 0.42);
  }

  if (sectorCard) {
    tl.from(sectorCard, {
      clipPath: 'inset(100% 0 0 0)',
      opacity: 0,
      duration: 0.38,
      clearProps: 'clipPath,opacity',
    }, 0.62);
  }

  tl.from(sectorRows, {
    y: 10,
    opacity: 0,
    duration: 0.24,
    stagger: 0.05,
    clearProps: 'transform,opacity',
  }, 0.72);
};

const animateDetailPanel = () => {
  nextTick(() => {
    if (prefersReducedMotion()) return;

    const root = ikasPageRef.value;
    const panel = root?.querySelector<HTMLElement>('.ikas-detail-panel');
    if (!panel) return;

    if (!selectedRecord.value || panel.classList.contains('is-summary')) {
      animateSummaryPanel(panel);
      return;
    }

    const panelChildren = Array.from(panel.querySelectorAll<HTMLElement>('*'));
    const panelSections = Array.from(panel.querySelectorAll<HTMLElement>('.ikas-panel-hero, .ikas-summary-hero, .ikas-action-error, .ikas-detail-actions, .ikas-request-reason, .ikas-detail-facts > div, .ikas-panel-score, .ikas-detail-timeline > div, .ikas-domain-card, .ikas-panel-meta, .ikas-open-detail, .ikas-export-pdf'));

    gsap.killTweensOf(panel);
    gsap.killTweensOf(panelChildren);

    const tl = gsap.timeline({ defaults: { ease: 'power3.out', overwrite: 'auto' } });
    tl.fromTo(panel, { y: 12, opacity: 0.88 }, { y: 0, opacity: 1, duration: 0.3, clearProps: 'transform,opacity' }, 0);
    tl.from(panelSections, {
      y: 14,
      opacity: 0,
      duration: 0.34,
      stagger: 0.05,
      clearProps: 'transform,opacity',
    }, 0.05);
  });
};

const runEntranceAnimations = () => {
  nextTick(() => {
    const root = ikasPageRef.value;
    if (!root || prefersReducedMotion()) {
      animateListItems(true);
      return;
    }

    gsapCtx?.revert();
    gsapCtx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.ikas-hero-header', { y: 18, opacity: 0, duration: 0.48, clearProps: 'transform,opacity' })
        .from('.ikas-inline-breadcrumb', { y: -8, opacity: 0, duration: 0.3, clearProps: 'transform,opacity' }, '-=0.28')
        .from('.ikas-hero-copy h1', { y: 18, opacity: 0, duration: 0.42, clearProps: 'transform,opacity' }, '-=0.18')
        .from('.ikas-hero-copy p', { y: 14, opacity: 0, duration: 0.34, clearProps: 'transform,opacity' }, '-=0.26')
        .from('.ikas-hero-tools', { y: 18, opacity: 0, duration: 0.42, clearProps: 'transform,opacity' }, '-=0.3')
        .from('.ikas-kpi-card', { y: 18, opacity: 0, scale: 0.96, duration: 0.4, stagger: 0.06, ease: 'back.out(1.4)', clearProps: 'transform,opacity' }, '-=0.15')
        .from('.ikas-filter-shell', { y: 22, opacity: 0, duration: 0.42, clearProps: 'transform,opacity' }, '-=0.08')
        .from('.ikas-list-shell', { y: 24, opacity: 0, duration: 0.48, clearProps: 'transform,opacity' }, '-=0.12')
        .from('.ikas-detail-panel', { y: 24, opacity: 0, duration: 0.48, clearProps: 'transform,opacity' }, '-=0.38');
    }, root);

    animateListItems(true);
  });
};

const goToPage = (page: number) => {
  const nextPage = Math.min(Math.max(page, 1), totalPages.value);
  if (nextPage === currentPage.value || isPageTransitioning) return;

  const items = getVisibleMotionItems();
  isPageTransitioning = true;

  const applyPage = () => {
    currentPage.value = nextPage;
    nextTick(() => {
      animateListItems(true, () => {
        isPageTransitioning = false;
      });
    });
  };

  if (!items.length || prefersReducedMotion()) {
    applyPage();
    return;
  }

  gsap.killTweensOf(items);
  const tl = gsap.timeline({
    defaults: { duration: 0.2, ease: 'power1.in', overwrite: 'auto' },
    onComplete: applyPage,
  });

  items.forEach((item, index) => {
    tl.to(item, { y: -12, opacity: 0, scale: 0.985, force3D: true }, index * 0.03);
  });
};

watch(sectorFilter, () => {
  subSectorFilter.value = 'all';
});

watch([searchQuery, sectorFilter, subSectorFilter, statusFilter, yearFilter, monthFilter, pageSize], () => {
  currentPage.value = 1;
});

watch(loading, (isLoading) => {
  if (!isLoading) {
    if (!hasRunInitialEntrance) {
      hasRunInitialEntrance = true;
      runEntranceAnimations();
      return;
    }

    animateListItems();
    animateDetailPanel();
  }
});

watch(filteredRecords, (items) => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value;
  if (selectedRecord.value && !items.some((item) => item.id === selectedRecord.value?.id)) {
    selectedRecord.value = items[0] || null;
  }
  if (!loading.value) animateListItems(true);
});

watch(currentPage, () => {
  if (!isPageTransitioning && !loading.value) animateListItems(true);
});

watch(selectedRecord, () => {
  if (!loading.value) animateDetailPanel();
}, { flush: 'post' });

watch([attentionRecords, summaryTopSectors], () => {
  if (!loading.value && !selectedRecord.value) animateDetailPanel();
}, { flush: 'post' });

watch(
  () => ikasStore.ikasVersion,
  () => {
    rawIkasRecords.value = normalizeResponse(ikasStore.ikasRawRecords);
    if (selectedRecord.value) {
      updateSelectedRecord(selectedRecord.value.id);
    }
  },
);

let autoRefreshTimer: number | null = null;

const handleVisibilityRefresh = () => {
  if (document.visibilityState === 'visible') {
    loadData(false);
  }
};

onMounted(() => {
  syncThemeMode();
  themeObserver = new MutationObserver(syncThemeMode);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-mode', 'class'] });
  loadData(true);
  document.addEventListener('visibilitychange', handleVisibilityRefresh);
  // Keep the list fresh without hammering the maturity API.
  autoRefreshTimer = window.setInterval(() => {
    loadData(false);
  }, 120 * 1000);
});

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityRefresh);
  themeObserver?.disconnect();
  gsapCtx?.revert();
  if (actionSyncTimer) clearTimeout(actionSyncTimer);
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
});

const KpiCard = defineComponent({
  name: 'KpiCard',
  props: {
    item: { type: Object as () => KpiItem, required: true },
  },
  setup(props) {
    return () => h('article', { class: ['ikas-kpi-card', `tone-${props.item.tone}`] }, [
      h('div', { class: 'ikas-kpi-topline' }, [
        h('div', { class: 'ikas-kpi-icon', 'aria-hidden': 'true' }, [h('i', { class: props.item.icon })]),
      ]),
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
    subSectors: { type: Array as () => string[], required: true },
    years: { type: Array as () => string[], required: true },
    months: { type: Array as () => { value: string; label: string }[], required: true },
    filtersOpen: { type: Boolean, required: true },
    loading: { type: Boolean, default: false },
    searchQuery: { type: String, required: true },
    sectorFilter: { type: String, required: true },
    subSectorFilter: { type: String, required: true },
    statusFilter: { type: String as () => StatusFilter, required: true },
    yearFilter: { type: String, required: true },
    monthFilter: { type: String, required: true },
    activeFiltersCount: { type: Number, default: 0 },
  },
  emits: ['update:searchQuery', 'update:sectorFilter', 'update:subSectorFilter', 'update:statusFilter', 'update:yearFilter', 'update:monthFilter', 'update:filtersOpen', 'refresh', 'clear'],
  setup(props, { emit }) {
    return () => h('section', { class: 'ikas-filter-shell', 'aria-label': 'IKAS filters' }, [
      h('div', { class: 'ikas-filter-primary' }, [
        h('div', { class: 'ikas-filter-title' }, [
          h('span', { class: 'ikas-filter-title-row' }, [
            h('span', { class: 'ikas-filter-title-icon', 'aria-hidden': 'true' }, [
              h('i', { class: 'ri-filter-3-line' }),
            ]),
            h('span', { class: 'ikas-filter-title-copy' }, 'Filter & Analisis'),
          ]),
          h('small', props.activeFiltersCount ? `${props.activeFiltersCount} filter aktif` : 'Sesuaikan periode, sektor, dan kategori data'),
        ]),
        h('label', { class: 'ikas-search', 'aria-label': 'Cari IKAS' }, [
          h('i', { class: 'ri-search-line', 'aria-hidden': 'true' }),
          h('input', {
            value: props.searchQuery,
            type: 'search',
            placeholder: 'Cari perusahaan, sektor, atau subsektor...',
            onInput: (event: Event) => emit('update:searchQuery', (event.target as HTMLInputElement).value),
          }),
        ]),
        h('div', { class: 'ikas-filter-actions' }, [
          h('button', {
            class: 'ikas-refresh-btn ikas-filter-refresh',
            type: 'button',
            disabled: props.loading,
            onClick: () => emit('refresh'),
          }, [h('i', { class: 'ri-refresh-line', 'aria-hidden': 'true' }), h('span', 'Refresh')]),
          h('button', {
            class: 'ikas-filter-toggle',
            type: 'button',
            'aria-expanded': String(props.filtersOpen),
            onClick: () => emit('update:filtersOpen', !props.filtersOpen),
          }, [
            h('i', { class: props.filtersOpen ? 'ri-arrow-up-s-line' : 'ri-equalizer-line', 'aria-hidden': 'true' }),
            h('span', props.filtersOpen ? 'Hide' : 'Filters'),
            props.activeFiltersCount ? h('b', props.activeFiltersCount) : null,
          ]),
        ]),
      ]),
      h('div', { class: ['ikas-filter-fields', props.filtersOpen ? 'is-open' : ''] }, [
        h('label', { class: 'ikas-field' }, [
          h('span', [h('i', { class: 'ri-building-4-line', 'aria-hidden': 'true' }), 'Sektor']),
          h('select', {
            value: props.sectorFilter,
            onChange: (event: Event) => emit('update:sectorFilter', (event.target as HTMLSelectElement).value),
          }, [
            h('option', { value: 'all' }, 'Semua sektor'),
            ...props.sectors.map((sector) => h('option', { value: sector }, sector)),
          ]),
        ]),
        h('label', { class: 'ikas-field' }, [
          h('span', [h('i', { class: 'ri-community-line', 'aria-hidden': 'true' }), 'Sub Sektor']),
          h('select', {
            value: props.subSectorFilter,
            onChange: (event: Event) => emit('update:subSectorFilter', (event.target as HTMLSelectElement).value),
          }, [
            h('option', { value: 'all' }, 'Semua subsektor'),
            ...props.subSectors.map((subSector) => h('option', { value: subSector }, subSector)),
          ]),
        ]),
        h('label', { class: 'ikas-field' }, [
          h('span', [h('i', { class: 'ri-shield-check-line', 'aria-hidden': 'true' }), 'Status']),
          h('select', {
            value: props.statusFilter,
            onChange: (event: Event) => emit('update:statusFilter', (event.target as HTMLSelectElement).value),
          }, [
            h('option', { value: 'all' }, 'Semua status'),
            h('option', { value: 'validated' }, 'Active'),
            h('option', { value: 'draft' }, 'Inactive'),
            h('option', { value: 'edit-request' }, 'Edit request'),
          ]),
        ]),
        h('label', { class: 'ikas-field' }, [
          h('span', [h('i', { class: 'ri-calendar-line', 'aria-hidden': 'true' }), 'Tahun Pengukuran']),
          h('select', {
            value: props.yearFilter,
            onChange: (event: Event) => emit('update:yearFilter', (event.target as HTMLSelectElement).value),
          }, [
            h('option', { value: 'all' }, 'Semua tahun (terbaru)'),
            ...props.years.map((year) => h('option', { value: year }, year)),
          ]),
        ]),
        h('label', { class: 'ikas-field' }, [
          h('span', [h('i', { class: 'ri-calendar-event-line', 'aria-hidden': 'true' }), 'Bulan']),
          h('select', {
            value: props.monthFilter,
            onChange: (event: Event) => emit('update:monthFilter', (event.target as HTMLSelectElement).value),
          }, [
            h('option', { value: 'all' }, 'Semua bulan'),
            ...props.months.map((month) => h('option', { value: month.value }, month.label)),
          ]),
        ]),
        h('button', { class: 'ikas-clear-btn', type: 'button', onClick: () => emit('clear') }, [
          h('i', { class: 'ri-restart-line', 'aria-hidden': 'true' }),
          h('span', 'Reset'),
        ]),
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
    return () => h('div', { class: ['ikas-score-cell', scoreTone(props.score)] }, [
      h('div', { class: 'ikas-score-summary' }, [
        h('span', { class: 'ikas-score-badge' }, props.score.toFixed(2)),
        h('span', { class: 'ikas-score-scale' }, '/5'),
      ]),
      h('div', { class: 'ikas-score-track', 'aria-hidden': 'true' }, [
        h('span', { class: 'ikas-score-fill', style: { width: `${scorePercent(props.score)}%` } }),
      ]),
      h('small', { class: 'ikas-score-caption' }, [
        h('i', { class: 'ri-pulse-line', 'aria-hidden': 'true' }),
        h('span', getMaturityLabel(props.score)),
      ]),
    ]);
  },
});

const IkasRecordActions = defineComponent({
  name: 'IkasRecordActions',
  props: {
    item: { type: Object as () => IkasRecord, required: true },
    pendingAction: { type: String as () => IkasAction | '', default: '' },
  },
  emits: ['action'],
  setup(props, { emit }) {
    const isEditRequest = computed(() => props.item.status === 'edit-request');

    const emitAction = (event: MouseEvent, action: IkasAction) => {
      event.stopPropagation();
      emit('action', action, props.item);
    };

    const button = (action: IkasAction, label: string, icon: string, tone: string) => h('button', {
      class: ['ikas-action-btn', tone],
      type: 'button',
      disabled: Boolean(props.pendingAction),
      'aria-label': label,
      title: label,
      onClick: (event: MouseEvent) => emitAction(event, action),
    }, [
      h('i', { class: props.pendingAction === action ? 'ri-loader-4-line ikas-action-spin' : icon, 'aria-hidden': 'true' }),
      h('span', props.pendingAction === action ? '...' : label),
    ]);

    return () => {
      if (props.item.status === 'edit-request') {
        return h('div', { class: ['ikas-record-actions', isEditRequest.value ? 'is-request-actions' : ''] }, [
          button('approve', 'Acc', 'ri-check-line', 'approve'),
          button('reject', 'Reject', 'ri-close-line', 'reject'),
        ]);
      }

      if (props.item.status === 'draft') {
        return h('div', { class: 'ikas-record-actions' }, [
          button('validate', 'Validate', 'ri-shield-check-line', 'validate'),
        ]);
      }

      return h('span', { class: 'ikas-no-action' }, 'Validated');
    };
  },
});

const IkasTableRow = defineComponent({
  name: 'IkasTableRow',
  props: {
    item: { type: Object as () => IkasRecord, required: true },
    selected: { type: Boolean, default: false },
    pendingAction: { type: String as () => IkasAction | '', default: '' },
  },
  emits: ['select', 'action'],
  setup(props, { emit }) {
    const statusIcon = computed(() => {
      if (props.item.status === 'validated') return 'ri-checkbox-circle-line';
      if (props.item.status === 'edit-request') return 'ri-edit-2-line';
      return 'ri-time-line';
    });

    const statusBadge = () => h('span', { class: ['ikas-status', props.item.status] }, [
      h('i', { class: statusIcon.value, 'aria-hidden': 'true' }),
      h('span', props.item.statusLabel),
    ]);

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        emit('select', props.item);
      }
    };

    return () => h('tr', {
      class: ['ikas-table-row', props.selected ? 'is-selected' : ''],
      tabindex: 0,
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
            h('small', [
              h('span', props.item.sector),
              h('span', props.item.subSector),
            ]),
          ]),
        ]),
      ]),
      h('td', [h(IkasScore, { score: props.item.score })]),
      h('td', [statusBadge()]),
      h('td', [
        h('div', { class: 'ikas-updated' }, [
          h('strong', formatRelativeTime(props.item.updatedAt)),
          h('small', formatDate(props.item.updatedAt)),
        ]),
      ]),
      h('td', [
        h(IkasRecordActions, {
          item: props.item,
          pendingAction: props.pendingAction,
          onAction: (action: IkasAction, item: IkasRecord) => emit('action', action, item),
        }),
      ]),
      h('td', [
        h('button', {
          class: 'ikas-row-action',
          type: 'button',
          'aria-label': `Preview ${props.item.companyName}`,
          title: 'Preview detail',
          onClick: (event: MouseEvent) => {
            event.stopPropagation();
            emit('select', props.item);
          },
        }, [h('i', { class: 'ri-arrow-right-line', 'aria-hidden': 'true' })]),
      ]),
    ]);
  },
});

const IkasCard = defineComponent({
  name: 'IkasCard',
  props: {
    item: { type: Object as () => IkasRecord, required: true },
    selected: { type: Boolean, default: false },
    pendingAction: { type: String as () => IkasAction | '', default: '' },
  },
  emits: ['select', 'action'],
  setup(props, { emit }) {
    const statusIcon = computed(() => {
      if (props.item.status === 'validated') return 'ri-checkbox-circle-line';
      if (props.item.status === 'edit-request') return 'ri-edit-2-line';
      return 'ri-time-line';
    });

    const statusBadge = () => h('span', { class: ['ikas-status', props.item.status] }, [
      h('i', { class: statusIcon.value, 'aria-hidden': 'true' }),
      h('span', props.item.statusLabel),
    ]);

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        emit('select', props.item);
      }
    };

    return () => h('article', {
      class: ['ikas-mobile-card', props.selected ? 'is-selected' : ''],
      tabindex: 0,
      role: 'button',
      onClick: () => emit('select', props.item),
      onKeydown,
      'aria-label': `Open IKAS preview for ${props.item.companyName}`,
    }, [
      h('div', { class: 'ikas-mobile-card-top' }, [
        props.item.logo
          ? h('img', { class: 'ikas-avatar', src: props.item.logo, alt: '' })
          : h('span', { class: 'ikas-avatar ikas-avatar-fallback', 'aria-hidden': 'true' }, initials(props.item.companyName)),
        h('div', { class: 'ikas-mobile-company-copy' }, [
          h('strong', props.item.companyName),
          h('small', [
            h('span', props.item.sector),
            h('span', props.item.subSector),
          ]),
          statusBadge(),
        ]),
      ]),
      h('div', { class: 'ikas-mobile-card-content' }, [
        h('div', { class: 'ikas-mobile-score' }, [
          h(IkasScore, { score: props.item.score }),
        ]),
        h('div', { class: 'ikas-mobile-meta' }, [
          h('span', `${formatRelativeTime(props.item.updatedAt)} - ${formatDate(props.item.updatedAt)}`),
        ]),
        h('div', { class: 'ikas-mobile-actions' }, [
          h(IkasRecordActions, {
            item: props.item,
            pendingAction: props.pendingAction,
            onAction: (action: IkasAction, item: IkasRecord) => emit('action', action, item),
          }),
        ]),
      ]),
    ]);
  },
});
</script>

<template>
  <Pageheader :propData="pageData" />

  <main ref="ikasPageRef" :class="['ikas-page', { 'is-dark': isDarkMode }]">
    <header class="ikas-hero-header">
      <div class="ikas-hero-content">
        <div class="ikas-hero-copy">
          <div class="ikas-inline-breadcrumb">Dashboard <span>/</span> IKAS <span>/</span> Management</div>
          <h1>IKAS Management</h1>
          <p>Monitoring penilaian keamanan siber perusahaan dengan ringkasan skor, status validasi, dan rincian domain.</p>
        </div>
      </div>

      <div class="ikas-hero-tools ikas-stakeholder-summary" aria-label="IKAS stakeholder completion">
        <div class="ikas-hero-stakeholder-card">
          <div class="ikas-hero-stakeholder-title">
            <span>Stakeholder IKAS</span>
            <strong>{{ stakeholderIkasCoverage }}%</strong>
          </div>
          <div class="ikas-hero-stakeholder-stats">
            <div>
              <span>Sudah Isi</span>
              <strong>{{ stakeholdersWithIkasCount }}</strong>
            </div>
            <div>
              <span>Belum Isi</span>
              <strong>{{ stakeholdersWithoutIkasCount }}</strong>
            </div>
          </div>
          <div class="ikas-hero-progress" aria-hidden="true">
            <span :style="{ width: `${stakeholderIkasCoverage}%` }"></span>
          </div>
        </div>
      </div>
    </header>

    <template v-if="loading">
      <section class="ikas-kpi-grid" aria-label="IKAS summary loading">
        <article v-for="index in 5" :key="index" class="ikas-kpi-card ikas-kpi-skeleton">
          <div class="ikas-kpi-topline">
            <div class="ikas-kpi-icon ikas-skel-icon"></div>
          </div>
          <div class="ikas-kpi-body">
            <span class="ikas-skel-line ikas-skel-mini"></span>
            <strong class="ikas-skel-line ikas-skel-kpi"></strong>
            <small class="ikas-skel-line ikas-skel-mini"></small>
          </div>
        </article>
      </section>

      <section class="ikas-filter-shell ikas-filter-skeleton" aria-hidden="true">
        <div class="ikas-filter-primary">
          <div class="ikas-filter-title">
            <span class="ikas-filter-title-row">
              <span class="ikas-filter-title-icon ikas-skel-icon"></span>
              <span class="ikas-skel-line ikas-skel-filter-title"></span>
            </span>
            <span class="ikas-skel-line ikas-skel-filter-subtitle"></span>
          </div>
          <div class="ikas-skeleton-search"></div>
          <div class="ikas-filter-actions">
            <span class="ikas-skel-pill"></span>
            <span class="ikas-skel-pill"></span>
          </div>
        </div>
        <div class="ikas-filter-fields is-open">
          <div v-for="index in 5" :key="index" class="ikas-field ikas-skeleton-field">
            <span class="ikas-skel-line ikas-skel-mini"></span>
            <div class="ikas-skel-select"></div>
          </div>
          <div class="ikas-clear-btn ikas-skel-clear"></div>
        </div>
      </section>

      <section class="ikas-content-grid" aria-label="IKAS loading content">
        <div class="ikas-list-shell">
          <div class="ikas-list-header">
            <div>
              <div class="ikas-skel-line ikas-skel-list-title"></div>
              <div class="ikas-skel-line ikas-skel-list-subtitle"></div>
            </div>
            <div class="ikas-skel-select ikas-skel-rows"></div>
          </div>

          <div class="ikas-skeleton-list" aria-label="Loading IKAS records">
            <div v-for="index in 6" :key="index" class="ikas-skeleton-row">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>

          <div class="ikas-pagination ikas-skeleton-pagination" aria-hidden="true">
            <span class="ikas-skel-pill ikas-skel-page-btn"></span>
            <span class="ikas-skel-line ikas-skel-page-info"></span>
            <span class="ikas-skel-pill ikas-skel-page-btn"></span>
          </div>
        </div>

        <aside class="ikas-detail-panel is-summary" aria-label="IKAS insight panel loading">
          <div class="ikas-skeleton-panel-shell">
            <div class="ikas-skeleton-summary-header">
              <div>
                <span class="ikas-skel-line ikas-skel-mini"></span>
                <span class="ikas-skel-line ikas-skel-detail-title"></span>
                <span class="ikas-skel-line ikas-skel-detail-subtitle"></span>
              </div>
              <span class="ikas-skel-icon ikas-skel-detail-badge"></span>
            </div>

            <div class="ikas-attention-grid">
              <div v-for="index in 4" :key="index" class="ikas-attention-stat ikas-skeleton-tile">
                <span class="ikas-skel-icon"></span>
                <span class="ikas-skel-line ikas-skel-mini"></span>
                <strong class="ikas-skel-line ikas-skel-tile-number"></strong>
                <small class="ikas-skel-line ikas-skel-tile-sub"></small>
              </div>
            </div>

            <div class="ikas-attention-card ikas-skeleton-card">
              <div class="ikas-card-title">
                <span class="ikas-skel-line ikas-skel-card-title"></span>
                <span class="ikas-skel-pill"></span>
              </div>
              <div class="ikas-skeleton-list compact">
                <div v-for="index in 5" :key="index" class="ikas-skeleton-row is-panel">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>

            <div class="ikas-summary-sector ikas-skeleton-card">
              <div class="ikas-card-title">
                <span class="ikas-skel-line ikas-skel-card-title"></span>
                <span class="ikas-skel-pill"></span>
              </div>
              <div class="ikas-skeleton-list compact">
                <div v-for="index in 3" :key="index" class="ikas-skeleton-row is-sector">
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </template>

    <template v-else>
      <section class="ikas-kpi-grid" aria-label="IKAS summary">
        <KpiCard v-for="item in kpiItems" :key="item.label" :item="item" />
      </section>

      <FilterBar
        v-model:search-query="searchQuery"
        v-model:sector-filter="sectorFilter"
        v-model:sub-sector-filter="subSectorFilter"
        v-model:status-filter="statusFilter"
        v-model:year-filter="yearFilter"
        v-model:month-filter="monthFilter"
        v-model:filters-open="filtersOpen"
        :sectors="sectors"
        :sub-sectors="subSectors"
        :years="years"
        :months="months"
        :loading="loading"
        :active-filters-count="activeFiltersCount"
        @refresh="loadData"
        @clear="clearFilters"
      />

      <section class="ikas-content-grid">
        <div class="ikas-list-shell">
          <div class="ikas-list-header">
            <div>
              <h2>All IKAS Records</h2>
              <p>
                Showing {{ visibleRangeStart }}-{{ visibleRangeEnd }} of {{ filteredRecords.length }} assessments
              </p>
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

          <div v-if="!filteredRecords.length" class="ikas-empty-state">
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
                <colgroup>
                  <col class="ikas-col-company" />
                  <col class="ikas-col-score" />
                  <col class="ikas-col-status" />
                  <col class="ikas-col-updated" />
                  <col class="ikas-col-actions" />
                  <col class="ikas-col-detail" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Company Name</th>
                    <th scope="col">IKAS Score</th>
                    <th scope="col">Status</th>
                    <th scope="col">Last Updated</th>
                    <th scope="col">Tindakan</th>
                    <th scope="col">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  <IkasTableRow
                    v-for="item in paginatedRecords"
                    :key="item.id"
                    :item="item"
                    :selected="selectedRecord?.id === item.id"
                    :pending-action="pendingActionFor(item)"
                    @select="selectRecord"
                    @action="handleIkasAction"
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
                :pending-action="pendingActionFor(item)"
                @select="selectRecord"
                @action="handleIkasAction"
              />
            </div>

            <nav class="ikas-pagination" aria-label="IKAS pagination">
              <button type="button" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">
                <i class="ri-arrow-left-s-line" aria-hidden="true"></i>
                Previous
              </button>
              <span>Page {{ currentPage }} of {{ totalPages }}</span>
              <button type="button" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">
                Next
                <i class="ri-arrow-right-s-line" aria-hidden="true"></i>
              </button>
            </nav>
          </template>
        </div>

        <aside class="ikas-detail-panel" :class="{ 'is-summary': !selectedRecord }" aria-label="IKAS insight panel">
        <template v-if="selectedRecord">
        <button class="ikas-panel-close" type="button" aria-label="Show IKAS analytics" @click="closePanel">
          <i class="ri-close-line" aria-hidden="true"></i>
        </button>

        <div class="ikas-panel-hero">
          <img
            v-if="selectedRecord.logo"
            class="ikas-avatar ikas-avatar-large"
            :src="selectedRecord.logo"
            alt=""
          />
          <span v-else class="ikas-avatar ikas-avatar-large ikas-avatar-fallback" aria-hidden="true">
            {{ initials(selectedRecord.companyName) }}
          </span>
          <div>
            <span class="ikas-eyebrow">Detail Preview</span>
            <h2>{{ selectedRecord.companyName }}</h2>
            <p>{{ selectedRecord.sector }} / {{ selectedRecord.subSector }}</p>
          </div>
          <span class="ikas-panel-status" :class="selectedRecord.status">{{ selectedRecord.statusLabel }}</span>
        </div>

        <div v-if="actionError" class="ikas-action-error" role="alert">
          <i class="ri-error-warning-line" aria-hidden="true"></i>
          <span>{{ actionError }}</span>
        </div>

        <div class="ikas-detail-actions" aria-label="IKAS actions">
          <IkasRecordActions
            :item="selectedRecord"
            :pending-action="pendingActionFor(selectedRecord)"
            @action="handleIkasAction"
          />
        </div>

        <div v-if="selectedRecord.editRequestReason" class="ikas-request-reason">
          <span>{{ selectedRecord.status === 'edit-request' ? 'Alasan pengajuan edit' : 'Alasan request terakhir' }}</span>
          <p>{{ selectedRecord.editRequestReason }}</p>
        </div>

        <div class="ikas-detail-facts" aria-label="Selected IKAS summary">
          <div>
            <span>Sektor</span>
            <strong>{{ selectedRecord.sector }}</strong>
          </div>
          <div>
            <span>Subsektor</span>
            <strong>{{ selectedRecord.subSector }}</strong>
          </div>
        </div>

        <div class="ikas-panel-score">
          <div>
            <span>IKAS Score</span>
            <strong>{{ selectedRecord.score.toFixed(2) }}</strong>
            <small>{{ getMaturityLabel(selectedRecord.score) }}</small>
            <div class="ikas-score-target">
              <span>Target {{ selectedRecord.targetScore ? selectedRecord.targetScore.toFixed(2) : '-' }}</span>
              <b :class="!selectedRecord.targetScore ? 'is-neutral' : selectedRecord.score >= selectedRecord.targetScore ? 'is-positive' : 'is-negative'">
                {{ selectedRecord.targetScore ? (selectedRecord.score - selectedRecord.targetScore).toFixed(2) : '-' }}
              </b>
            </div>
          </div>
          <apexchart
            type="radialBar"
            height="118"
            :series="[scorePercent(selectedRecord.score)]"
            :options="getRadialOptions(selectedRecord)"
          />
        </div>

        <div class="ikas-detail-timeline">
          <div>
            <i class="ri-calendar-check-line" aria-hidden="true"></i>
            <span>Tahun Pengukuran</span>
            <strong>{{ selectedRecord.measurementYear || '-' }}</strong>
          </div>
          <div>
            <i class="ri-time-line" aria-hidden="true"></i>
            <span>Tanggal Pengisian</span>
            <strong>{{ formatDate(selectedRecord.measurementDate || selectedRecord.createdAt) }}</strong>
          </div>
        </div>

        <div class="ikas-domain-card">
          <div class="ikas-card-title">
            <h3>Domain Breakdown</h3>
            <span>{{ selectedRecord.domains.length }} domain</span>
          </div>
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
            <span>Phone</span>
            <strong>{{ selectedRecord.phone || '-' }}</strong>
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
          Lihat detail lengkap
          <i class="ri-arrow-right-line" aria-hidden="true"></i>
        </button>
        <button
          class="ikas-export-pdf"
          type="button"
          :disabled="exportLoadingId === selectedRecord.id"
          @click="exportRecordPdf(selectedRecord)"
        >
          <i
            :class="exportLoadingId === selectedRecord.id ? 'ri-loader-4-line ikas-action-spin' : 'ri-file-pdf-line'"
            aria-hidden="true"
          ></i>
          <span>{{ exportLoadingId === selectedRecord.id ? 'Mengekspor...' : 'Export PDF' }}</span>
        </button>
        </template>

        <template v-else>
          <div class="ikas-summary-hero">
            <div>
              <span class="ikas-eyebrow">Admin Attention</span>
              <h2>Yang perlu ditindak</h2>
              <p>{{ attentionRecords.length }} prioritas teratas dari {{ records.length }} assessment IKAS.</p>
            </div>
            <span class="ikas-summary-icon" aria-hidden="true">
              <i class="ri-alarm-warning-line"></i>
            </span>
          </div>

          <div class="ikas-attention-grid" aria-label="IKAS admin attention counters">
            <div v-for="item in attentionStats" :key="item.label" :class="['ikas-attention-stat', item.tone]">
              <i :class="item.icon" aria-hidden="true"></i>
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
              <small>{{ item.hint }}</small>
            </div>
          </div>

          <div class="ikas-attention-card">
            <div class="ikas-card-title">
              <h3>Prioritas Tindakan</h3>
              <span>{{ attentionRecords.length }} item</span>
            </div>
            <div v-if="!attentionRecords.length" class="ikas-attention-empty">
              <i class="ri-checkbox-circle-line" aria-hidden="true"></i>
              <strong>Semua aman</strong>
              <span>Tidak ada edit request, data bawah target, atau draft yang perlu ditindak.</span>
            </div>
            <button
              v-for="item in attentionRecords"
              v-else
              :key="item.record.id"
              :class="['ikas-attention-row', item.tone]"
              type="button"
              @click="selectRecord(item.record)"
            >
              <i :class="item.icon" aria-hidden="true"></i>
              <div>
                <strong>{{ item.record.companyName }}</strong>
                <span>{{ item.reason }}</span>
              </div>
              <b>{{ item.record.score.toFixed(2) }}</b>
            </button>
          </div>

          <div class="ikas-summary-sector">
            <div class="ikas-card-title">
              <h3>Sektor Terbanyak</h3>
              <span>{{ summaryTopSectors.length }} sektor</span>
            </div>
            <div v-for="sector in summaryTopSectors" :key="sector.label" class="ikas-summary-sector-row">
              <div>
                <strong>{{ sector.label }}</strong>
                <span>{{ sector.count }} assessment</span>
              </div>
              <b>{{ sector.average.toFixed(2) }}</b>
            </div>
          </div>
        </template>
        </aside>
      </section>
    </template>

    <div
      v-if="actionConfirmation"
      class="ikas-confirm-backdrop"
      role="presentation"
      @click.self="closeActionConfirmation"
    >
      <section
        class="ikas-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ikas-action-confirm-title"
      >
        <button
          class="ikas-confirm-close"
          type="button"
          aria-label="Tutup konfirmasi"
          :disabled="Boolean(pendingActionFor(actionConfirmation.record))"
          @click="closeActionConfirmation"
        >
          <i class="ri-close-line" aria-hidden="true"></i>
        </button>

        <div :class="['ikas-confirm-icon', actionConfirmMeta.tone]" aria-hidden="true">
          <i :class="actionConfirmMeta.icon"></i>
        </div>

        <div class="ikas-confirm-copy">
          <h3 id="ikas-action-confirm-title">{{ actionConfirmMeta.title }}</h3>
          <p>{{ actionConfirmMeta.message }}</p>
        </div>

        <div class="ikas-confirm-record">
          <span>{{ actionConfirmation.record.companyName }}</span>
          <strong>{{ actionConfirmation.record.measurementYear || '-' }}</strong>
        </div>

        <div v-if="actionConfirmation.record.editRequestReason" class="ikas-confirm-reason">
          <span>Alasan dari user</span>
          <p>{{ actionConfirmation.record.editRequestReason }}</p>
        </div>

        <label v-if="actionConfirmation.action === 'reject'" class="ikas-reject-field">
          <span>Alasan penolakan untuk user</span>
          <textarea
            v-model="rejectReason"
            rows="3"
            placeholder="Contoh: Mohon lengkapi data domain Proteksi sebelum diedit ulang."
            :disabled="Boolean(pendingActionFor(actionConfirmation.record))"
          ></textarea>
        </label>

        <div v-if="actionError" class="ikas-action-error ikas-confirm-error" role="alert">
          <i class="ri-error-warning-line" aria-hidden="true"></i>
          <span>{{ actionError }}</span>
        </div>

        <div class="ikas-confirm-actions">
          <button
            class="ikas-confirm-secondary"
            type="button"
            :disabled="Boolean(pendingActionFor(actionConfirmation.record))"
            @click="closeActionConfirmation"
          >
            Cancel
          </button>
          <button
            :class="['ikas-confirm-primary', actionConfirmMeta.tone]"
            type="button"
            :disabled="Boolean(pendingActionFor(actionConfirmation.record))"
            @click="confirmIkasAction"
          >
            <i
              :class="pendingActionFor(actionConfirmation.record) ? 'ri-loader-4-line ikas-action-spin' : actionConfirmMeta.icon"
              aria-hidden="true"
            ></i>
            <span>{{ pendingActionFor(actionConfirmation.record) ? 'Processing...' : actionConfirmMeta.confirmLabel }}</span>
          </button>
        </div>
      </section>
    </div>
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

.ikas-hero-header {
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

.ikas-hero-header::after {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0));
  content: "";
  height: 1px;
  inset: 0 20px auto;
  position: absolute;
}

.ikas-hero-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.ikas-hero-copy {
  max-width: 820px;
}

.ikas-inline-breadcrumb {
  color: #b9d7ff;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 8px;
}

.ikas-inline-breadcrumb span {
  color: rgba(255, 255, 255, 0.58);
  margin: 0 5px;
}

.ikas-hero-copy h1 {
  color: #ffffff;
  font-size: 32px;
  font-weight: 850;
  line-height: 1.05;
  margin: 0;
}

.ikas-hero-copy p {
  color: rgba(255, 255, 255, 0.86);
  font-size: 16px;
  line-height: 1.45;
  margin: 10px 0 0;
}

.ikas-hero-tools {
  align-items: center;
  display: flex;
  flex: 0 1 640px;
  gap: 10px;
  min-width: 420px;
  position: relative;
  z-index: 2;
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

.ikas-hero-tools > .ikas-header-search {
  border-color: rgba(255, 255, 255, 0.82);
  flex: 1 1 auto;
  box-shadow: 0 16px 34px rgba(2, 6, 23, 0.12);
  min-height: 48px;
  padding: 0 18px;
  width: auto;
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

.ikas-hero-tools > .ikas-header-search input {
  min-width: 0;
  width: 100%;
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
  justify-content: space-between;
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
.ikas-page :deep(.ikas-filter-refresh),
.ikas-page :deep(.ikas-clear-btn) {
  align-items: center;
  border: 1px solid transparent;
  border-radius: 12px;
  display: inline-flex;
  font-weight: 700;
  gap: 8px;
  justify-content: center;
  min-height: 44px;
  padding: 0 14px;
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.ikas-page :deep(.ikas-filter-title) {
  min-width: 0;
}

.ikas-page :deep(.ikas-filter-title span) {
  align-items: center;
  color: var(--ikas-text);
  display: flex;
  font-size: 14px;
  font-weight: 850;
  gap: 6px;
  line-height: 1.2;
}

.ikas-page :deep(.ikas-filter-title span i) {
  color: var(--ikas-blue);
  font-size: 16px;
}

.ikas-page :deep(.ikas-filter-title small) {
  color: var(--ikas-muted);
  display: block;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  margin-top: 2px;
}

.ikas-page :deep(.ikas-filter-actions) {
  align-items: center;
  display: flex;
  flex: 0 0 auto;
  gap: 10px;
}

.ikas-page :deep(.ikas-filter-refresh) {
  background: linear-gradient(135deg, #2563eb, #0891b2);
  border-color: transparent;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.16);
  color: #ffffff;
  min-height: 44px;
}

.ikas-page :deep(.ikas-filter-refresh i),
.ikas-page :deep(.ikas-filter-toggle i) {
  font-size: 16px;
  line-height: 1;
}

.ikas-page :deep(.ikas-filter-refresh:hover:not(:disabled)) {
  box-shadow: 0 14px 26px rgba(37, 99, 235, 0.2);
  transform: translateY(-1px);
}

.ikas-page :deep(.ikas-filter-refresh:disabled) {
  cursor: not-allowed;
  opacity: 0.66;
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
  justify-content: space-between;
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
  min-width: 1040px;
  width: 100%;
}

.ikas-table th:nth-child(1),
.ikas-table td:nth-child(1) {
  width: 30%;
}

.ikas-table th:nth-child(2),
.ikas-table td:nth-child(2) {
  width: 16%;
}

.ikas-table th:nth-child(3),
.ikas-table td:nth-child(3) {
  width: 18%;
}

.ikas-table th:nth-child(4),
.ikas-table td:nth-child(4) {
  width: 15%;
}

.ikas-table th:nth-child(5),
.ikas-table td:nth-child(5) {
  width: 9%;
}

.ikas-table th:nth-child(6),
.ikas-table td:nth-child(6) {
  width: 12%;
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

.ikas-page :deep(.ikas-subsector-pill) {
  background: #ecfeff;
  color: #0e7490;
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

.ikas-subsector-pill {
  background: #ecfeff;
  color: #0e7490;
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

.ikas-skeleton-list.compact {
  gap: 8px;
}

.ikas-skeleton-row {
  align-items: center;
  animation: ikasSkeletonPanelIn 0.4s ease both;
  border: 1px solid var(--ikas-border);
  border-radius: 16px;
  display: grid;
  gap: 18px;
  grid-template-columns: 1.4fr 0.8fr 1fr;
  overflow: hidden;
  padding: 18px;
}

.ikas-skeleton-row.is-panel {
  gap: 12px;
  grid-template-columns: 28px minmax(0, 1fr) 58px;
  padding: 12px 14px;
}

.ikas-skeleton-row.is-sector {
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) 48px;
  padding: 12px 14px;
}

.ikas-skeleton-row span {
  animation: ikasSkeleton 1.1s ease-in-out infinite;
  background: linear-gradient(90deg, #eef2f7, #f8fafc, #eef2f7);
  background-size: 200% 100%;
  border-radius: 999px;
  height: 14px;
}

.ikas-skeleton-hero,
.ikas-skeleton-panel-shell,
.ikas-filter-skeleton,
.ikas-kpi-skeleton,
.ikas-skeleton-card {
  overflow: hidden;
}

.ikas-skel-line {
  animation: ikasSkeleton 1.2s ease-in-out infinite;
  background: linear-gradient(90deg, #edf2f7, #f8fafc, #edf2f7);
  background-size: 200% 100%;
  border-radius: 999px;
  display: block;
}

.ikas-skel-icon {
  animation: ikasSkeleton 1.2s ease-in-out infinite;
  background: linear-gradient(90deg, #e6edf7, #f8fafc, #e6edf7);
  background-size: 200% 100%;
  border-radius: 12px;
  display: inline-flex;
  flex: 0 0 auto;
}

.ikas-skel-pill {
  animation: ikasSkeleton 1.2s ease-in-out infinite;
  background: linear-gradient(90deg, #edf2f7, #f8fafc, #edf2f7);
  background-size: 200% 100%;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 999px;
  display: inline-flex;
  height: 24px;
  width: 64px;
}

.ikas-skel-breadcrumb {
  height: 12px;
  width: 190px;
}

.ikas-skel-title {
  height: 28px;
  width: min(380px, 72%);
}

.ikas-skel-desc {
  height: 16px;
  width: min(520px, 88%);
}

.ikas-skel-mini {
  height: 10px;
  width: 100%;
}

.ikas-skel-number {
  height: 24px;
  width: 76px;
}

.ikas-skel-kpi {
  height: 30px;
  width: 88px;
}

.ikas-skel-filter-title {
  height: 13px;
  width: 160px;
}

.ikas-skel-filter-subtitle {
  height: 12px;
  width: 250px;
}

.ikas-skeleton-search,
.ikas-skel-select,
.ikas-skel-clear {
  animation: ikasSkeleton 1.2s ease-in-out infinite;
  background: linear-gradient(90deg, #eef2f7, #f8fafc, #eef2f7);
  background-size: 200% 100%;
  border: 1px solid #dbe5f3;
  border-radius: 12px;
}

.ikas-skeleton-search {
  height: 42px;
  width: 100%;
}

.ikas-skel-select {
  height: 44px;
  width: 100%;
}

.ikas-skel-clear {
  height: 48px;
}

.ikas-skel-list-title {
  height: 18px;
  width: 170px;
}

.ikas-skel-list-subtitle {
  height: 12px;
  margin-top: 6px;
  width: 250px;
}

.ikas-skel-rows {
  height: 38px;
  width: 86px;
}

.ikas-skel-page-btn {
  height: 34px;
  width: 92px;
}

.ikas-skel-page-info {
  height: 12px;
  width: 180px;
}

.ikas-skeleton-panel-shell {
  display: grid;
  gap: 12px;
}

.ikas-skeleton-summary-header {
  align-items: center;
  border-bottom: 1px solid var(--ikas-border);
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) 42px;
  padding-bottom: 12px;
}

.ikas-skel-detail-title {
  height: 18px;
  margin-top: 8px;
  width: 180px;
}

.ikas-skel-detail-subtitle {
  height: 12px;
  margin-top: 6px;
  width: 240px;
}

.ikas-skel-detail-badge {
  height: 42px;
  width: 42px;
}

.ikas-skeleton-tile {
  border: 1px solid var(--ikas-border);
  border-radius: 10px;
  display: grid;
  gap: 6px;
  padding: 10px;
}

.ikas-skeleton-tile .ikas-skel-icon {
  height: 30px;
  width: 30px;
}

.ikas-skel-tile-number {
  height: 24px;
  width: 36px;
}

.ikas-skel-tile-sub {
  height: 12px;
  width: 100%;
}

.ikas-skeleton-card {
  border: 1px solid var(--ikas-border);
  border-radius: 10px;
  padding: 12px;
}

.ikas-skel-card-title {
  height: 16px;
  width: 132px;
}

.ikas-skeleton-card .ikas-card-title {
  align-items: center;
}

.ikas-page.is-dark .ikas-skel-line,
.ikas-page.is-dark .ikas-skel-icon,
.ikas-page.is-dark .ikas-skel-pill,
.ikas-page.is-dark .ikas-skeleton-search,
.ikas-page.is-dark .ikas-skel-select,
.ikas-page.is-dark .ikas-skel-clear,
.ikas-page.is-dark .ikas-skeleton-row span,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-skel-line,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-skel-icon,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-skel-pill,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-skeleton-search,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-skel-select,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-skel-clear,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-skeleton-row span,
:global(html.dark) .ikas-page .ikas-skel-line,
:global(html.dark) .ikas-page .ikas-skel-icon,
:global(html.dark) .ikas-page .ikas-skel-pill,
:global(html.dark) .ikas-page .ikas-skeleton-search,
:global(html.dark) .ikas-page .ikas-skel-select,
:global(html.dark) .ikas-page .ikas-skel-clear,
:global(html.dark) .ikas-page .ikas-skeleton-row span {
  background: linear-gradient(90deg, #162338 25%, #23344d 50%, #162338 75%);
  background-size: 200% 100%;
  border-color: rgba(51, 65, 85, 0.9);
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

@keyframes ikasSkeletonPanelIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
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
  .ikas-hero-header {
    align-items: stretch;
    flex-direction: column;
    gap: 18px;
    min-height: 0;
    padding: 24px;
  }

  .ikas-hero-content {
    min-height: 0;
  }

  .ikas-hero-tools {
    flex: 0 1 auto;
    min-width: 0;
    width: 100%;
  }

  .ikas-hero-copy h1 {
    font-size: 30px;
  }

  .ikas-hero-copy p {
    font-size: 15px;
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

  .ikas-page :deep(.ikas-filter-actions) {
    width: 100%;
  }

  .ikas-page :deep(.ikas-filter-actions button) {
    flex: 1;
  }
}

@media (max-width: 768px) {
  .ikas-page {
    gap: 16px;
  }

  .ikas-hero-header {
    border-radius: 18px;
    padding: 20px;
  }

  .ikas-hero-tools {
    align-items: stretch;
    flex-direction: column;
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

/* Refined IKAS dashboard UI */
.ikas-page {
  --ikas-blue: #2463eb;
  --ikas-blue-dark: #1e40af;
  --ikas-cyan: #0e7490;
  --ikas-green: #15803d;
  --ikas-amber: #b45309;
  --ikas-red: #b91c1c;
  --ikas-border: #dbe3ef;
  --ikas-muted: #64748b;
  --ikas-soft: #f5f7fb;
  --ikas-text: #0f172a;
  --ikas-surface: #ffffff;
  gap: 18px;
}

.ikas-hero-header {
  align-items: stretch;
  background:
    radial-gradient(circle at 18% 18%, rgba(59, 130, 246, 0.22), transparent 30%),
    linear-gradient(135deg, #071a59 0%, #102d80 35%, #1f4fbd 68%, #2f73ea 100%);
  border: 1px solid rgba(191, 219, 254, 0.24);
  border-radius: 18px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  min-height: 152px;
  padding: 24px 26px;
}

.ikas-hero-header::after {
  display: none;
}

.ikas-hero-copy h1 {
  font-size: 29px;
  line-height: 1.08;
}

.ikas-hero-copy p {
  max-width: 720px;
}

.ikas-hero-tools {
  display: grid;
  flex: 0 0 440px;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  min-width: 0;
}

.ikas-hero-stat {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 94px;
  min-width: 0;
  padding: 14px;
}

.ikas-hero-stat span {
  color: rgba(219, 234, 254, 0.74);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.15;
  text-transform: uppercase;
}

.ikas-hero-stat strong {
  color: #ffffff;
  display: block;
  font-size: 22px;
  font-weight: 850;
  line-height: 1.15;
  margin-top: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-hero-tools.ikas-stakeholder-summary {
  display: flex;
}

.ikas-hero-stakeholder-card {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  justify-content: center;
  min-height: 104px;
  padding: 16px;
  width: 100%;
}

.ikas-hero-stakeholder-title,
.ikas-hero-stakeholder-stats {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.ikas-hero-stakeholder-title span,
.ikas-hero-stakeholder-stats span {
  color: rgba(219, 234, 254, 0.74);
  display: block;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.15;
  text-transform: uppercase;
}

.ikas-hero-stakeholder-title strong {
  color: #ffffff;
  font-size: 24px;
  font-weight: 900;
  line-height: 1;
}

.ikas-hero-stakeholder-stats > div {
  min-width: 0;
}

.ikas-hero-stakeholder-stats strong {
  color: #ffffff;
  display: block;
  font-size: 24px;
  font-weight: 850;
  line-height: 1;
  margin-top: 5px;
}

.ikas-hero-progress {
  background: rgba(15, 23, 42, 0.28);
  border-radius: 999px;
  height: 8px;
  overflow: hidden;
}

.ikas-hero-progress span {
  background: linear-gradient(90deg, #22c55e, #38bdf8);
  border-radius: inherit;
  display: block;
  height: 100%;
  transition: width 260ms ease;
}

.ikas-kpi-grid {
  gap: 12px;
}

.ikas-page :deep(.ikas-kpi-card) {
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
  flex-direction: column;
  gap: 14px;
  min-height: 128px;
  padding: 16px;
}

.ikas-page :deep(.ikas-kpi-card::before) {
  height: 3px;
}

.ikas-page :deep(.ikas-kpi-topline) {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.ikas-page :deep(.ikas-kpi-icon) {
  border-radius: 8px;
  height: 38px;
  width: 38px;
}

.ikas-page :deep(.ikas-kpi-marker) {
  background: var(--accent, var(--ikas-blue));
  border-radius: 999px;
  display: block;
  height: 8px;
  opacity: 0.72;
  width: 8px;
}

.ikas-page :deep(.ikas-kpi-value) {
  font-size: 26px;
  line-height: 1;
}

.ikas-page :deep(.ikas-filter-shell),
.ikas-list-shell,
.ikas-detail-panel {
  border-color: var(--ikas-border);
  border-radius: 8px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
}

.ikas-page :deep(.ikas-filter-shell) {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 251, 255, 0.96)),
    radial-gradient(circle at 0 0, rgba(36, 99, 235, 0.09), transparent 34%);
  border: 1px solid rgba(203, 213, 225, 0.78);
  border-radius: 16px;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  overflow: hidden;
  padding: 16px;
  position: relative;
}

.ikas-page :deep(.ikas-filter-shell::before) {
  background: linear-gradient(90deg, rgba(37, 99, 235, 0.74), rgba(14, 116, 144, 0.44), transparent);
  content: "";
  height: 1px;
  inset: 0 16px auto;
  opacity: 0.72;
  position: absolute;
}

.ikas-page :deep(.ikas-filter-primary) {
  align-items: center;
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(210px, 0.55fr) minmax(320px, 1.45fr) auto;
  position: relative;
  z-index: 1;
}

.ikas-page :deep(.ikas-filter-title) {
  align-items: center;
  display: grid;
  gap: 2px;
  min-width: 0;
}

.ikas-page :deep(.ikas-filter-title-row) {
  align-items: center;
  color: var(--ikas-text);
  display: inline-flex;
  gap: 10px;
  min-width: 0;
}

.ikas-page :deep(.ikas-filter-title-icon) {
  align-items: center;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.14), rgba(14, 116, 144, 0.1));
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 10px;
  color: var(--ikas-blue-dark);
  display: inline-flex;
  flex: 0 0 34px;
  height: 34px;
  justify-content: center;
  width: 34px;
}

.ikas-page :deep(.ikas-filter-title-copy) {
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-page :deep(.ikas-filter-title span) {
  font-size: 14px;
}

.ikas-page :deep(.ikas-filter-title small) {
  color: #64748b;
  display: block;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
  margin-left: 44px;
}

.ikas-page :deep(.ikas-search) {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(203, 213, 225, 0.9);
  border-radius: 12px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  color: #64748b;
  min-height: 50px;
  padding: 0 16px;
}

.ikas-page :deep(.ikas-search i) {
  color: var(--ikas-blue-dark);
  font-size: 18px;
  opacity: 0.78;
}

.ikas-page :deep(.ikas-search input) {
  color: #0f172a;
  font-size: 14px;
  font-weight: 650;
}

.ikas-page :deep(.ikas-filter-actions) {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  min-width: max-content;
}

.ikas-page :deep(.ikas-filter-toggle),
.ikas-page :deep(.ikas-filter-refresh),
.ikas-page :deep(.ikas-clear-btn),
.ikas-page :deep(.ikas-field),
.ikas-page-size,
.ikas-pagination button,
.ikas-panel-close,
.ikas-open-detail {
  border-radius: 12px;
}

.ikas-page :deep(.ikas-filter-refresh),
.ikas-page :deep(.ikas-filter-toggle),
.ikas-page :deep(.ikas-clear-btn) {
  font-size: 13px;
  font-weight: 850;
  min-height: 50px;
  padding: 0 16px;
}

.ikas-page :deep(.ikas-filter-refresh) {
  background: linear-gradient(135deg, #1d4ed8, #0891b2);
  border: 1px solid rgba(29, 78, 216, 0.2);
  box-shadow: 0 14px 28px rgba(29, 78, 216, 0.2);
  color: #ffffff;
}

.ikas-page :deep(.ikas-filter-refresh i),
.ikas-page :deep(.ikas-filter-toggle i),
.ikas-page :deep(.ikas-clear-btn i) {
  font-size: 16px;
  line-height: 1;
}

.ikas-page :deep(.ikas-filter-refresh:hover:not(:disabled)) {
  box-shadow: 0 18px 34px rgba(29, 78, 216, 0.24);
}

.ikas-page :deep(.ikas-filter-toggle) {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(37, 99, 235, 0.2);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  color: var(--ikas-blue-dark);
}

.ikas-page :deep(.ikas-filter-toggle b) {
  align-items: center;
  background: linear-gradient(135deg, var(--ikas-blue), #0e7490);
  border-radius: 999px;
  color: #ffffff;
  display: inline-flex;
  font-size: 10px;
  height: 18px;
  justify-content: center;
  min-width: 18px;
  padding: 0 5px;
}

.ikas-page :deep(.ikas-filter-fields) {
  align-items: stretch;
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(5, minmax(150px, 1fr)) auto;
  margin-top: 14px;
  position: relative;
  z-index: 1;
}

.ikas-page :deep(.ikas-field) {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(203, 213, 225, 0.82);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.035), inset 0 1px 0 rgba(255, 255, 255, 0.72);
  min-height: 60px;
  min-width: 0;
  padding: 10px 12px;
}

.ikas-page :deep(.ikas-field span) {
  color: #64748b;
  font-size: 10px;
  font-weight: 900;
  margin-bottom: 5px;
}

.ikas-page :deep(.ikas-field select) {
  color: #0f172a;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  height: 24px;
}

.ikas-page :deep(.ikas-clear-btn) {
  align-self: stretch;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(203, 213, 225, 0.92);
  color: #475569;
  min-width: 100px;
}

.ikas-page :deep(.ikas-clear-btn:hover) {
  background: #ffffff;
  border-color: rgba(37, 99, 235, 0.28);
  color: var(--ikas-blue-dark);
}

/* Premium white command filter */
.ikas-page :deep(.ikas-filter-shell) {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 252, 0.98)),
    radial-gradient(circle at 0 0, rgba(14, 116, 144, 0.08), transparent 32%);
  border: 1px solid rgba(203, 213, 225, 0.82);
  border-radius: 16px;
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  padding: 12px 14px;
}

.ikas-page :deep(.ikas-filter-shell::before) {
  background: linear-gradient(90deg, #0f766e, #2563eb 52%, transparent);
  inset: 0 24px auto;
  opacity: 0.72;
}

.ikas-page :deep(.ikas-filter-shell::after) {
  background:
    linear-gradient(90deg, rgba(14, 116, 144, 0.06), transparent 36%),
    linear-gradient(180deg, rgba(37, 99, 235, 0.04), transparent 58%);
  content: "";
  inset: 0;
  opacity: 1;
  pointer-events: none;
  position: absolute;
}

.ikas-page :deep(.ikas-filter-primary),
.ikas-page :deep(.ikas-filter-fields) {
  position: relative;
  z-index: 1;
}

.ikas-page :deep(.ikas-filter-primary) {
  align-items: center;
  gap: 10px 14px;
  grid-template-columns: minmax(220px, 0.42fr) minmax(560px, 1.8fr) auto;
  grid-template-areas:
    "title search actions";
}

.ikas-page :deep(.ikas-filter-title-row) {
  color: #0f172a;
  display: contents;
}

.ikas-page :deep(.ikas-filter-title-icon) {
  background: linear-gradient(135deg, rgba(15, 118, 110, 0.12), rgba(37, 99, 235, 0.12));
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 11px;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.09);
  color: #0f766e;
  flex-basis: 32px;
  grid-row: 1 / 3;
  height: 32px;
  margin-top: 1px;
  width: 32px;
}

.ikas-page :deep(.ikas-filter-title-copy) {
  color: #0f172a;
  font-size: 14px;
  line-height: 1.15;
}

.ikas-page :deep(.ikas-filter-title small) {
  color: #64748b;
  font-size: 11px;
  line-height: 1.15;
  margin-left: 0;
  margin-top: 2px;
}

.ikas-page :deep(.ikas-filter-title) {
  align-items: center;
  column-gap: 10px;
  display: grid;
  grid-area: title;
  grid-template-columns: 32px minmax(0, 1fr);
  grid-template-rows: auto auto;
}

.ikas-page :deep(.ikas-filter-actions) {
  grid-area: actions;
}

.ikas-page :deep(.ikas-search) {
  grid-area: search;
  width: 100%;
}

.ikas-page :deep(.ikas-search) {
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.42);
  border-radius: 12px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.045), inset 0 1px 0 rgba(255, 255, 255, 0.95);
  min-height: 42px;
  padding: 0 14px;
}

.ikas-page :deep(.ikas-search:focus-within),
.ikas-page :deep(.ikas-field:focus-within) {
  border-color: rgba(15, 118, 110, 0.55);
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.09), 0 12px 26px rgba(15, 23, 42, 0.07);
}

.ikas-page :deep(.ikas-search i) {
  color: #0f766e;
  font-size: 17px;
  opacity: 1;
}

.ikas-page :deep(.ikas-search input) {
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
}

.ikas-page :deep(.ikas-search input::placeholder) {
  color: #64748b;
  font-weight: 700;
}

.ikas-page :deep(.ikas-filter-refresh),
.ikas-page :deep(.ikas-filter-toggle),
.ikas-page :deep(.ikas-clear-btn) {
  border-radius: 12px;
  min-height: 42px;
  padding: 0 14px;
}

.ikas-page :deep(.ikas-filter-refresh) {
  background: linear-gradient(135deg, #0f766e, #2563eb);
  border: 1px solid rgba(15, 118, 110, 0.16);
  box-shadow: 0 12px 22px rgba(37, 99, 235, 0.16);
  color: #ffffff;
}

.ikas-page :deep(.ikas-filter-refresh i) {
  color: #ffffff;
}

.ikas-page :deep(.ikas-filter-toggle) {
  background: #ffffff;
  border: 1px solid rgba(37, 99, 235, 0.18);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.045);
  color: #1d4ed8;
}

.ikas-page :deep(.ikas-filter-toggle b) {
  background: #0f766e;
  color: #ffffff;
}

.ikas-page :deep(.ikas-filter-fields) {
  background: #f8fafc;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 14px;
  display: none;
  gap: 8px;
  margin-top: 10px;
  padding: 8px;
}

.ikas-page :deep(.ikas-filter-fields.is-open) {
  display: grid;
}

.ikas-page :deep(.ikas-field) {
  background: #ffffff;
  border: 1px solid rgba(203, 213, 225, 0.85);
  border-radius: 12px;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.03);
  min-height: 50px;
  padding: 7px 10px;
}

.ikas-page :deep(.ikas-field:hover) {
  background: #ffffff;
  border-color: rgba(15, 118, 110, 0.32);
}

.ikas-page :deep(.ikas-field span) {
  color: #64748b;
  font-size: 9px;
  letter-spacing: 0;
  margin-bottom: 3px;
}

.ikas-page :deep(.ikas-field select) {
  color: #0f172a;
  font-size: 13px;
  font-weight: 850;
  height: 22px;
}

.ikas-page :deep(.ikas-field select option) {
  background: #ffffff;
  color: #0f172a;
}

.ikas-page :deep(.ikas-clear-btn) {
  background: #ffffff;
  border: 1px solid rgba(203, 213, 225, 0.95);
  color: #475569;
}

.ikas-page :deep(.ikas-clear-btn:hover) {
  background: #f8fafc;
  border-color: rgba(15, 118, 110, 0.32);
  color: #0f766e;
}

/* Reference-style filter skin without extra period controls */
.ikas-page :deep(.ikas-filter-shell) {
  background: #ffffff;
  border: 1px solid #d7e3f4;
  border-radius: 16px;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.07);
  overflow: hidden;
  padding: 0;
}

.ikas-page :deep(.ikas-filter-shell::before),
.ikas-page :deep(.ikas-filter-shell::after) {
  display: none;
}

.ikas-page :deep(.ikas-filter-primary) {
  align-items: center;
  background: #ffffff;
  border-bottom: 1px solid #e6edf7;
  display: grid;
  gap: 14px;
  grid-template-areas: "title search actions";
  grid-template-columns: minmax(260px, 0.75fr) minmax(320px, 1.15fr) auto;
  padding: 16px 26px;
}

.ikas-page :deep(.ikas-filter-title) {
  align-items: center;
  column-gap: 14px;
  display: grid;
  grid-area: title;
  grid-template-columns: 48px minmax(0, 1fr);
  grid-template-rows: auto auto;
}

.ikas-page :deep(.ikas-filter-title-row) {
  display: contents;
}

.ikas-page :deep(.ikas-filter-title-icon) {
  align-items: center;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 9px;
  box-shadow: none;
  color: #2563eb;
  display: inline-flex;
  font-size: 17px;
  grid-row: 1 / span 2;
  height: 34px;
  justify-content: center;
  margin: 0;
  width: 34px;
}

.ikas-page :deep(.ikas-filter-title-copy) {
  color: #0f2a55;
  font-size: 18px;
  font-weight: 900;
  line-height: 1.15;
}

.ikas-page :deep(.ikas-filter-title small) {
  color: #64748b;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.2;
  margin-top: 4px;
}

.ikas-page :deep(.ikas-search) {
  background: #f8fbff;
  border: 1px solid #d7e3f4;
  border-radius: 12px;
  box-shadow: none;
  grid-area: search;
  min-height: 44px;
  padding: 0 14px;
  width: 100%;
}

.ikas-page :deep(.ikas-search:focus-within) {
  border-color: #93b8f3;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.09);
}

.ikas-page :deep(.ikas-search i) {
  color: #2563eb;
}

.ikas-page :deep(.ikas-search input) {
  color: #0f2a55;
  font-size: 13px;
  font-weight: 750;
}

.ikas-page :deep(.ikas-filter-actions) {
  grid-area: actions;
}

.ikas-page :deep(.ikas-filter-refresh),
.ikas-page :deep(.ikas-filter-toggle),
.ikas-page :deep(.ikas-clear-btn) {
  border-radius: 12px;
  min-height: 42px;
}

.ikas-page :deep(.ikas-filter-refresh) {
  background: #2563eb;
  border-color: #2563eb;
  box-shadow: 0 10px 18px rgba(37, 99, 235, 0.2);
}

.ikas-page :deep(.ikas-filter-toggle) {
  background: #ffffff;
  border-color: #d7e3f4;
  color: #1d4ed8;
}

.ikas-page :deep(.ikas-filter-toggle b) {
  background: #2563eb;
  color: #ffffff;
}

.ikas-page :deep(.ikas-filter-fields) {
  background: #f8fbff;
  border: 0;
  border-radius: 0;
  display: none;
  gap: 14px;
  grid-template-columns: repeat(5, minmax(145px, 1fr)) auto;
  margin: 0;
  padding: 18px 26px 26px;
}

.ikas-page :deep(.ikas-filter-fields.is-open) {
  display: grid;
}

.ikas-page :deep(.ikas-field) {
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  display: grid;
  gap: 10px;
  min-height: 0;
  padding: 0;
}

.ikas-page :deep(.ikas-field:hover) {
  background: transparent;
  border-color: transparent;
}

.ikas-page :deep(.ikas-field span) {
  align-items: center;
  color: #25324a;
  display: inline-flex;
  font-size: 11px;
  font-weight: 900;
  gap: 6px;
  letter-spacing: 0;
  line-height: 1;
  margin: 0;
  text-transform: uppercase;
}

.ikas-page :deep(.ikas-field span i) {
  color: #2563eb;
  font-size: 14px;
}

.ikas-page :deep(.ikas-field select) {
  appearance: auto;
  background: #ffffff;
  border: 1px solid #d7e3f4;
  border-radius: 10px;
  color: #08264d;
  font-size: 14px;
  font-weight: 750;
  height: 44px;
  min-width: 0;
  outline: 0;
  padding: 0 12px;
  width: 100%;
}

.ikas-page :deep(.ikas-field select:focus) {
  border-color: #93b8f3;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.09);
}

.ikas-page :deep(.ikas-clear-btn) {
  align-self: end;
  background: #ffffff;
  border: 1px solid #d7e3f4;
  color: #475569;
  height: 44px;
  min-width: 96px;
}

.ikas-page :deep(.ikas-clear-btn:hover) {
  background: #eff6ff;
  border-color: #9fc0f2;
  color: #1d4ed8;
}

/* Compact filter sizing pass */
.ikas-page :deep(.ikas-filter-shell) {
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.055);
}

.ikas-page :deep(.ikas-filter-primary) {
  gap: 12px;
  grid-template-columns: minmax(220px, 0.42fr) minmax(520px, 1.45fr) auto;
  padding: 12px 20px;
}

.ikas-page :deep(.ikas-filter-title) {
  column-gap: 10px;
  grid-template-columns: 34px minmax(0, 1fr);
}

.ikas-page :deep(.ikas-filter-title-icon) {
  align-items: center;
  border-radius: 9px;
  color: #2563eb;
  display: inline-flex;
  font-size: 16px;
  height: 32px;
  justify-content: center;
  width: 32px;
}

.ikas-page :deep(.ikas-filter-title-icon i) {
  align-items: center;
  color: #2563eb;
  display: inline-flex;
  font-size: 16px;
  height: 16px;
  justify-content: center;
  line-height: 1;
  width: 16px;
}

.ikas-page :deep(.ikas-filter-title-icon i::before) {
  display: block;
  line-height: 1;
}

.ikas-page :deep(.ikas-filter-title-copy) {
  display: block;
  font-size: 15px;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-page :deep(.ikas-filter-title small) {
  display: block;
  font-size: 11.5px;
  line-height: 1.15;
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-page :deep(.ikas-search) {
  border-radius: 10px;
  min-height: 38px;
  padding: 0 12px;
  max-width: none;
}

.ikas-page :deep(.ikas-search i) {
  font-size: 15px;
}

.ikas-page :deep(.ikas-search input) {
  font-size: 12.5px;
  font-weight: 750;
}

.ikas-page :deep(.ikas-filter-actions) {
  gap: 8px;
  white-space: nowrap;
}

.ikas-page :deep(.ikas-filter-refresh),
.ikas-page :deep(.ikas-filter-toggle),
.ikas-page :deep(.ikas-clear-btn) {
  border-radius: 10px;
  font-size: 12px;
  min-height: 38px;
  padding: 0 12px;
}

.ikas-page :deep(.ikas-filter-refresh i),
.ikas-page :deep(.ikas-filter-toggle i),
.ikas-page :deep(.ikas-clear-btn i) {
  font-size: 15px;
}

.ikas-page :deep(.ikas-filter-fields) {
  gap: 12px;
  grid-template-columns: repeat(5, minmax(130px, 1fr)) auto;
  padding: 14px 20px 18px;
}

.ikas-page :deep(.ikas-field) {
  gap: 8px;
}

.ikas-page :deep(.ikas-field span) {
  font-size: 10px;
  gap: 5px;
}

.ikas-page :deep(.ikas-field span i) {
  font-size: 13px;
}

.ikas-page :deep(.ikas-field select) {
  border-radius: 9px;
  font-size: 13px;
  height: 38px;
  padding: 0 10px;
}

.ikas-page :deep(.ikas-clear-btn) {
  height: 38px;
  min-width: 86px;
}

.ikas-content-grid {
  gap: 14px;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 380px);
}

.ikas-list-shell {
  padding: 16px;
}

.ikas-list-header {
  margin-bottom: 10px;
}

.ikas-list-header h2 {
  font-size: 17px;
}

.ikas-table {
  border-spacing: 0 8px;
  min-width: 980px;
}

.ikas-table th {
  color: #64748b;
  padding: 0 14px 2px;
}

.ikas-page :deep(.ikas-table-row td) {
  padding: 12px 14px;
}

.ikas-page :deep(.ikas-table-row td:first-child) {
  border-radius: 8px 0 0 8px;
}

.ikas-page :deep(.ikas-table-row td:last-child) {
  border-radius: 0 8px 8px 0;
}

.ikas-page :deep(.ikas-table-row:hover td),
.ikas-page :deep(.ikas-table-row:focus-visible td),
.ikas-page :deep(.ikas-table-row.is-selected td) {
  background: #f8fbff;
  border-color: rgba(36, 99, 235, 0.35);
  box-shadow: none;
}

.ikas-page :deep(.ikas-avatar) {
  border-radius: 8px !important;
}

.ikas-page :deep(.ikas-company strong) {
  font-size: 13px;
}

.ikas-page :deep(.ikas-sector-pill),
.ikas-page :deep(.ikas-status),
.ikas-page :deep(.ikas-score-badge),
.ikas-panel-status {
  border-radius: 999px;
  font-size: 11px;
  padding: 7px 9px;
}

.ikas-page :deep(.ikas-score-cell) {
  min-width: 132px;
}

.ikas-page :deep(.ikas-score-track),
.ikas-domain-bar {
  height: 7px;
}

.ikas-page :deep(.ikas-score-caption) {
  color: var(--ikas-muted);
  display: block;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-page :deep(.ikas-updated) {
  align-items: center;
  display: grid;
  gap: 2px 10px;
  grid-template-columns: minmax(0, 1fr) auto;
  min-width: 126px;
}

.ikas-page :deep(.ikas-row-action) {
  align-items: center;
  background: #eef6ff;
  border: 1px solid #c7dcff;
  border-radius: 8px;
  color: var(--ikas-blue-dark);
  display: inline-flex;
  grid-row: 1 / span 2;
  height: 30px;
  justify-content: center;
  width: 30px;
}

.ikas-mobile-card {
  border-radius: 8px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.ikas-pagination {
  font-size: 13px;
}

.ikas-detail-panel {
  padding: 16px;
  top: 132px;
}

.ikas-panel-close {
  height: 34px;
  width: 34px;
}

.ikas-panel-hero {
  align-items: flex-start;
  display: grid;
  gap: 12px;
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.ikas-avatar-large {
  border-radius: 8px;
  flex-basis: 58px;
  height: 58px !important;
  width: 58px !important;
}

.ikas-panel-hero h2 {
  font-size: 17px;
  line-height: 1.25;
}

.ikas-panel-status.validated {
  background: #dcfce7;
  color: #166534;
}

.ikas-panel-status.draft {
  background: #f1f5f9;
  color: #475569;
}

.ikas-panel-status.edit-request {
  background: #fef3c7;
  color: #92400e;
}

.ikas-panel-score {
  background: #f8fafc;
  border-radius: 8px;
  padding: 14px;
}

.ikas-panel-score strong {
  font-size: 32px;
}

.ikas-domain-card,
.ikas-panel-meta {
  background: #ffffff;
  border-radius: 8px;
  padding: 14px;
}

.ikas-panel-meta {
  gap: 10px;
}

.ikas-panel-meta > div {
  background: #f8fafc;
  border: 1px solid #e8eef7;
  border-radius: 8px;
  min-width: 0;
  padding: 10px;
}

.ikas-open-detail {
  min-height: 42px;
}

.ikas-skeleton-row,
.ikas-empty-illustration {
  border-radius: 8px;
}

/* Detail preview panel cleanup */
.ikas-detail-panel {
  border-radius: 10px;
  padding: 18px;
  position: sticky;
}

.ikas-panel-close {
  align-items: center;
  background: #f8fafc;
  border: 1px solid #dbe5f3;
  border-radius: 10px;
  color: #64748b;
  display: inline-flex;
  height: 34px;
  justify-content: center;
  position: absolute;
  right: 18px;
  top: 18px;
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
  width: 34px;
}

.ikas-panel-close:hover {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.ikas-panel-hero {
  align-items: center;
  display: grid;
  gap: 10px 12px;
  grid-template-columns: 44px minmax(0, 1fr);
  margin-bottom: 16px;
  min-height: 72px;
  padding-right: 44px;
}

.ikas-panel-hero .ikas-avatar-large {
  border-radius: 8px;
  flex-basis: 44px;
  height: 44px !important;
  width: 44px !important;
}

.ikas-panel-hero > div {
  min-width: 0;
}

.ikas-panel-hero .ikas-eyebrow {
  font-size: 10px;
  line-height: 1;
  margin-bottom: 6px;
}

.ikas-panel-hero h2 {
  font-size: 16px;
  line-height: 1.2;
  margin: 0 0 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-panel-hero p {
  color: #64748b;
  display: -webkit-box;
  font-size: 13px;
  line-height: 1.35;
  margin: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.ikas-panel-status {
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  grid-column: 2;
  justify-self: start;
  line-height: 1;
  padding: 7px 10px;
}

.ikas-panel-score {
  align-items: center;
  background: #f8fafc;
  border: 1px solid #dbe5f3;
  border-radius: 10px;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) 132px;
  margin-bottom: 14px;
  min-height: 132px;
  padding: 14px 14px 14px 16px;
}

.ikas-panel-score span {
  color: #64748b;
  font-size: 12px;
  font-weight: 750;
}

.ikas-panel-score strong {
  color: #0f172a;
  display: block;
  font-size: 30px;
  line-height: 1;
  margin: 8px 0;
}

.ikas-panel-score small {
  color: #64748b;
  display: block;
  font-size: 12px;
  line-height: 1.35;
  max-width: 96px;
}

.ikas-panel-score .vue-apexcharts {
  justify-self: end;
  max-width: 132px;
}

.ikas-domain-card,
.ikas-panel-meta {
  border: 1px solid #dbe5f3;
  border-radius: 10px;
  padding: 14px;
}

.ikas-domain-card h3 {
  font-size: 14px;
  line-height: 1.2;
  margin-bottom: 14px;
}

.ikas-domain-row + .ikas-domain-row {
  margin-top: 12px;
}

.ikas-domain-row > div:first-child {
  align-items: center;
  font-size: 12px;
  margin-bottom: 6px;
}

.ikas-domain-row > div:first-child span,
.ikas-domain-row > div:first-child strong {
  line-height: 1.2;
}

.ikas-domain-bar {
  height: 7px;
}

.ikas-panel-meta {
  gap: 10px;
  margin-top: 14px;
}

.ikas-panel-meta > div {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
}

.ikas-panel-meta span {
  color: #64748b;
  font-size: 11px;
  line-height: 1.2;
}

.ikas-panel-meta strong {
  color: #0f172a;
  font-size: 12px;
  line-height: 1.25;
  margin-top: 4px;
}

.ikas-open-detail {
  border-radius: 10px;
  min-height: 42px;
}

/* Refined detail panel */
.ikas-detail-panel {
  background: #ffffff;
  border: 1px solid #dbe5f3;
  border-radius: 12px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
  overflow: hidden;
  padding: 16px;
}

.ikas-detail-panel::before {
  background: linear-gradient(90deg, #2563eb, #0f766e);
  content: "";
  height: 3px;
  inset: 0 0 auto;
  position: absolute;
}

.ikas-panel-close {
  background: #ffffff;
  border-color: #dbe5f3;
  border-radius: 8px;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.05);
  height: 32px;
  right: 14px;
  top: 14px;
  width: 32px;
  z-index: 2;
}

.ikas-panel-close:hover {
  background: #f8fafc;
  border-color: #93c5fd;
  color: #1d4ed8;
  transform: translateY(-1px);
}

.ikas-panel-hero {
  align-items: start;
  border-bottom: 1px solid #e8eef7;
  gap: 10px 12px;
  grid-template-columns: 42px minmax(0, 1fr);
  margin: -2px 0 14px;
  min-height: 0;
  padding: 0 42px 14px 0;
}

.ikas-panel-hero .ikas-avatar-large {
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  box-shadow: none;
  height: 42px !important;
  width: 42px !important;
}

.ikas-panel-hero .ikas-eyebrow {
  color: #64748b;
  font-size: 9px;
  font-weight: 900;
  line-height: 1;
  margin-bottom: 5px;
}

.ikas-panel-hero h2 {
  color: #0f172a;
  font-size: 15px;
  font-weight: 850;
  line-height: 1.25;
  margin-bottom: 4px;
}

.ikas-panel-hero p {
  color: #64748b;
  font-size: 12px;
  line-height: 1.25;
  -webkit-line-clamp: 1;
}

.ikas-panel-status {
  align-self: start;
  border: 1px solid transparent;
  font-size: 10.5px;
  font-weight: 850;
  grid-column: 2;
  line-height: 1;
  margin-top: 2px;
  padding: 6px 9px;
}

.ikas-detail-facts {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 12px;
}

.ikas-detail-facts > div {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  min-width: 0;
  padding: 10px;
}

.ikas-detail-facts span {
  color: #64748b;
  display: block;
  font-size: 9.5px;
  font-weight: 900;
  line-height: 1;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.ikas-detail-facts strong {
  color: #0f172a;
  display: block;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-panel-score {
  background: #f8fafc;
  border-color: #e2e8f0;
  border-radius: 10px;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) 116px;
  margin-bottom: 12px;
  min-height: 112px;
  padding: 12px;
}

.ikas-panel-score span {
  font-size: 10.5px;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}

.ikas-panel-score strong {
  font-size: 28px;
  font-weight: 900;
  margin: 7px 0 5px;
}

.ikas-panel-score small {
  font-size: 11px;
  line-height: 1.25;
  max-width: 120px;
}

.ikas-panel-score .vue-apexcharts,
.ikas-panel-score .apexcharts-canvas,
.ikas-panel-score svg {
  max-width: 116px !important;
}

.ikas-score-target {
  align-items: center;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  display: inline-flex;
  gap: 7px;
  margin-top: 10px;
  max-width: 100%;
  padding: 5px 7px;
}

.ikas-score-target span {
  color: #64748b;
  font-size: 9.5px;
  font-weight: 850;
  line-height: 1;
  text-transform: none;
}

.ikas-score-target b {
  border-radius: 999px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  font-weight: 900;
  line-height: 1;
  padding: 4px 6px;
}

.ikas-score-target b.is-positive {
  background: #dcfce7;
  color: #166534;
}

.ikas-score-target b.is-negative {
  background: #fee2e2;
  color: #991b1b;
}

.ikas-score-target b.is-neutral {
  background: #f1f5f9;
  color: #475569;
}

.ikas-detail-timeline {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 12px;
}

.ikas-detail-timeline > div {
  align-items: center;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  display: grid;
  gap: 2px 8px;
  grid-template-columns: 30px minmax(0, 1fr);
  min-width: 0;
  padding: 9px;
}

.ikas-detail-timeline i {
  align-items: center;
  background: #eff6ff;
  border-radius: 8px;
  color: #1d4ed8;
  display: inline-flex;
  font-size: 15px;
  grid-row: 1 / span 2;
  height: 30px;
  justify-content: center;
  width: 30px;
}

.ikas-detail-timeline span {
  color: #64748b;
  font-size: 9.5px;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
}

.ikas-detail-timeline strong {
  color: #0f172a;
  font-size: 11.5px;
  font-weight: 850;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-domain-card,
.ikas-panel-meta {
  background: #ffffff;
  border-color: #e2e8f0;
  border-radius: 10px;
  padding: 12px;
}

.ikas-card-title {
  align-items: center;
  display: flex;
  gap: 10px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.ikas-domain-card h3 {
  color: #0f172a;
  font-size: 13px;
  font-weight: 850;
  margin: 0;
}

.ikas-card-title span {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  color: #475569;
  font-size: 10px;
  font-weight: 850;
  line-height: 1;
  padding: 5px 7px;
}

.ikas-domain-row + .ikas-domain-row {
  margin-top: 10px;
}

.ikas-domain-row > div:first-child {
  display: grid;
  font-size: 11.5px;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) auto;
  margin-bottom: 6px;
}

.ikas-domain-row > div:first-child span {
  color: #475569;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-domain-row > div:first-child strong {
  color: #0f172a;
  font-variant-numeric: tabular-nums;
}

.ikas-domain-bar {
  background: #edf2f7;
  border-radius: 999px;
  height: 6px;
}

.ikas-panel-meta {
  gap: 8px;
  margin-top: 12px;
}

.ikas-panel-meta > div {
  background: #f8fafc;
  border-color: #e8eef7;
  border-radius: 8px;
  padding: 9px;
}

.ikas-panel-meta span {
  font-size: 9.5px;
  font-weight: 900;
  text-transform: uppercase;
}

.ikas-panel-meta strong {
  font-size: 11.5px;
  font-weight: 800;
  margin-top: 4px;
}

.ikas-open-detail {
  align-items: center;
  background: #0f172a;
  border: 1px solid #0f172a;
  border-radius: 9px;
  box-shadow: none;
  color: #ffffff;
  display: inline-flex;
  font-size: 12px;
  font-weight: 850;
  gap: 8px;
  justify-content: center;
  margin-top: 12px;
  min-height: 40px;
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.ikas-open-detail:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
  transform: translateY(-1px);
}

.ikas-export-pdf {
  align-items: center;
  background: #991b1b;
  border: 1px solid #991b1b;
  border-radius: 9px;
  color: #ffffff;
  display: inline-flex;
  font-size: 12px;
  font-weight: 850;
  gap: 8px;
  justify-content: center;
  margin-top: 8px;
  min-height: 40px;
  position: relative;
  transition: background 160ms ease, border-color 160ms ease, opacity 160ms ease, transform 160ms ease;
  width: 100%;
  z-index: 1;
}

.ikas-export-pdf:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
  transform: translateY(-1px);
}

.ikas-export-pdf:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.ikas-detail-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.ikas-detail-panel::after {
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.07), transparent 38%),
    linear-gradient(225deg, rgba(15, 118, 110, 0.07), transparent 34%);
  content: "";
  inset: 3px 0 auto;
  height: 92px;
  pointer-events: none;
  position: absolute;
}

.ikas-panel-hero,
.ikas-detail-actions,
.ikas-detail-facts,
.ikas-panel-score,
.ikas-detail-timeline,
.ikas-domain-card,
.ikas-panel-meta,
.ikas-open-detail {
  position: relative;
  z-index: 1;
}

.ikas-panel-hero {
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.78), rgba(255, 255, 255, 0));
  border-radius: 10px 10px 0 0;
}

.ikas-panel-hero h2 {
  letter-spacing: 0;
}

.ikas-panel-status.edit-request {
  border-color: #fde68a;
}

.ikas-detail-facts > div,
.ikas-detail-timeline > div,
.ikas-panel-meta > div {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.ikas-detail-facts > div:hover,
.ikas-detail-timeline > div:hover,
.ikas-panel-meta > div:hover {
  border-color: #c7d7ee;
}

.ikas-panel-score {
  background:
    radial-gradient(circle at 84% 50%, rgba(245, 158, 11, 0.1), transparent 34%),
    linear-gradient(180deg, #fbfdff, #f8fafc);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.ikas-panel-score strong,
.ikas-panel-score .apexcharts-text {
  font-variant-numeric: tabular-nums;
}

.ikas-score-target {
  box-shadow: 0 5px 14px rgba(15, 23, 42, 0.04);
}

.ikas-detail-timeline i {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.ikas-domain-card {
  background:
    linear-gradient(180deg, rgba(248, 250, 252, 0.76), rgba(255, 255, 255, 0) 24%),
    #ffffff;
}

.ikas-domain-row > div:first-child span {
  font-weight: 800;
}

.ikas-domain-bar {
  overflow: hidden;
}

.ikas-domain-bar span {
  border-radius: inherit;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2);
  display: block;
  height: 100%;
}

.ikas-panel-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ikas-panel-meta > div:nth-child(5) {
  grid-column: span 1;
}

.ikas-open-detail {
  width: 100%;
}

.ikas-summary-hero {
  align-items: start;
  border-bottom: 1px solid #e8eef7;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) 42px;
  margin: -2px 0 14px;
  padding: 0 0 14px;
  position: relative;
  z-index: 1;
}

.ikas-summary-hero h2 {
  color: #0f172a;
  font-size: 16px;
  font-weight: 900;
  line-height: 1.25;
  margin: 5px 0 5px;
}

.ikas-summary-hero p {
  color: #64748b;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.35;
  margin: 0;
}

.ikas-summary-icon {
  align-items: center;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  color: #1d4ed8;
  display: inline-flex;
  font-size: 20px;
  height: 42px;
  justify-content: center;
  width: 42px;
}

.ikas-summary-sector {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-top: 12px;
  padding: 12px;
  position: relative;
  z-index: 1;
}

.ikas-summary-sector-row {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 9px 0;
}

.ikas-summary-sector-row + .ikas-summary-sector-row {
  border-top: 1px solid #edf2f7;
}

.ikas-summary-sector-row strong {
  color: #0f172a;
  display: block;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-summary-sector-row span {
  color: #64748b;
  display: block;
  font-size: 10.5px;
  font-weight: 750;
  line-height: 1.2;
  margin-top: 4px;
}

.ikas-summary-sector-row b {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  color: #0f172a;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 900;
  line-height: 1;
  padding: 6px 8px;
}

.ikas-attention-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 12px;
  position: relative;
  z-index: 1;
}

.ikas-attention-stat {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 10px;
}

.ikas-attention-stat i {
  align-items: center;
  border-radius: 8px;
  display: inline-flex;
  font-size: 15px;
  height: 30px;
  justify-content: center;
  margin-bottom: 3px;
  width: 30px;
}

.ikas-attention-stat.edit-request i {
  background: #fff7ed;
  color: #9a3412;
}

.ikas-attention-stat.risk i {
  background: #fee2e2;
  color: #991b1b;
}

.ikas-attention-stat.draft i {
  background: #f1f5f9;
  color: #475569;
}

.ikas-attention-stat span {
  color: #64748b;
  font-size: 9.5px;
  font-weight: 900;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.ikas-attention-stat strong {
  color: #0f172a;
  font-size: 22px;
  font-variant-numeric: tabular-nums;
  font-weight: 900;
  line-height: 1;
}

.ikas-attention-stat small {
  color: #64748b;
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1.25;
}

.ikas-attention-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-bottom: 12px;
  padding: 12px;
  position: relative;
  z-index: 1;
}

.ikas-attention-row {
  align-items: center;
  background: #ffffff;
  border: 1px solid #edf2f7;
  border-radius: 9px;
  display: grid;
  gap: 9px;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  margin-top: 8px;
  padding: 9px;
  text-align: left;
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
  width: 100%;
}

.ikas-attention-row:hover {
  background: #f8fbff;
  border-color: #bfdbfe;
  transform: translateY(-1px);
}

.ikas-attention-row > i {
  align-items: center;
  border-radius: 8px;
  display: inline-flex;
  font-size: 15px;
  height: 30px;
  justify-content: center;
  width: 30px;
}

.ikas-attention-row.edit-request > i {
  background: #fff7ed;
  color: #9a3412;
}

.ikas-attention-row.risk > i {
  background: #fee2e2;
  color: #991b1b;
}

.ikas-attention-row.draft > i {
  background: #f1f5f9;
  color: #475569;
}

.ikas-attention-row strong {
  color: #0f172a;
  display: block;
  font-size: 11.5px;
  font-weight: 900;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-attention-row span {
  color: #64748b;
  display: block;
  font-size: 10.5px;
  font-weight: 750;
  line-height: 1.25;
  margin-top: 4px;
}

.ikas-attention-row b {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  color: #0f172a;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 900;
  line-height: 1;
  padding: 6px 8px;
}

.ikas-attention-empty {
  align-items: center;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 9px;
  color: #166534;
  display: grid;
  gap: 5px 10px;
  grid-template-columns: 34px minmax(0, 1fr);
  padding: 10px;
}

.ikas-attention-empty i {
  align-items: center;
  background: #dcfce7;
  border-radius: 9px;
  display: inline-flex;
  font-size: 18px;
  grid-row: 1 / span 2;
  height: 34px;
  justify-content: center;
  width: 34px;
}

.ikas-attention-empty strong {
  font-size: 12px;
  font-weight: 900;
  line-height: 1.2;
}

.ikas-attention-empty span {
  color: #15803d;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.3;
}

/* Compact hero stakeholder card */
.ikas-hero-tools.ikas-stakeholder-summary {
  align-self: center;
  flex: 0 0 340px;
  max-width: 340px;
}

.ikas-hero-stakeholder-card {
  border-radius: 10px;
  gap: 10px;
  min-height: 86px;
  padding: 12px 14px;
}

.ikas-hero-stakeholder-title,
.ikas-hero-stakeholder-stats {
  gap: 10px;
}

.ikas-hero-stakeholder-title span,
.ikas-hero-stakeholder-stats span {
  font-size: 9.5px;
  line-height: 1.1;
}

.ikas-hero-stakeholder-title strong {
  font-size: 22px;
}

.ikas-hero-stakeholder-stats strong {
  font-size: 20px;
  margin-top: 4px;
}

.ikas-hero-progress {
  height: 6px;
}

/* Compact KPI cards */
.ikas-page :deep(.ikas-kpi-grid) {
  gap: 10px;
}

.ikas-page :deep(.ikas-kpi-card) {
  background: #ffffff;
  border-color: #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.035);
  gap: 9px;
  min-height: 94px;
  padding: 12px 14px 13px;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.ikas-page :deep(.ikas-kpi-card::before) {
  background: var(--accent);
  height: 2px;
  opacity: 0.88;
}

.ikas-page :deep(.ikas-kpi-card::after) {
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 4%, transparent), transparent 46%);
  content: "";
  inset: 0;
  opacity: 0;
  pointer-events: none;
  position: absolute;
  transition: opacity 180ms ease;
}

.ikas-page :deep(.ikas-kpi-card:hover) {
  border-color: color-mix(in srgb, var(--accent) 28%, #cbd5e1);
  box-shadow:
    0 12px 24px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.94);
  transform: translateY(-2px);
}

.ikas-page :deep(.ikas-kpi-card:hover::after) {
  opacity: 1;
}

.ikas-page :deep(.ikas-kpi-topline) {
  min-height: 32px;
  justify-content: flex-start;
}

.ikas-page :deep(.ikas-kpi-icon) {
  border-radius: 8px;
  box-shadow: none;
  flex-basis: 34px;
  font-size: 17px;
  height: 34px;
  transition:
    background 180ms ease,
    color 180ms ease,
    transform 180ms ease;
  width: 34px;
}

.ikas-page :deep(.ikas-kpi-card:hover .ikas-kpi-icon) {
  background: color-mix(in srgb, var(--accent) 14%, #ffffff);
  color: var(--accent);
  transform: translateY(-1px);
}

.ikas-page :deep(.ikas-kpi-label) {
  font-size: 10.5px;
  letter-spacing: 0;
  line-height: 1.1;
}

.ikas-page :deep(.ikas-kpi-value) {
  font-size: 22px;
  line-height: 1;
  margin-top: 5px;
}

.ikas-page :deep(.ikas-kpi-hint) {
  font-size: 11.5px;
  line-height: 1.25;
  margin-top: 6px;
}

/* Compact horizontal rows control */
.ikas-page-size {
  align-items: center;
  background: #ffffff;
  border: 1px solid #dbe5f3;
  border-radius: 999px;
  display: inline-flex;
  gap: 8px;
  min-height: 36px;
  padding: 0 10px 0 12px;
}

.ikas-page-size span {
  color: #64748b;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  margin: 0;
  text-transform: uppercase;
}

.ikas-page-size select {
  background: transparent;
  border: 0;
  color: #0f172a;
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
  height: 28px;
  outline: 0;
  padding: 0 2px;
  width: auto;
}

/* Clean table alignment */
.ikas-table-wrap {
  overflow-x: auto;
  padding-bottom: 2px;
}

.ikas-table {
  border-collapse: separate;
  border-spacing: 0 7px;
  min-width: 1040px;
  table-layout: fixed;
  width: 100%;
}

.ikas-col-company {
  width: 39%;
}

.ikas-col-score {
  width: 15%;
}

.ikas-col-status {
  width: 15%;
}

.ikas-col-updated {
  width: 15%;
}

.ikas-col-actions {
  width: 10%;
}

.ikas-col-detail {
  width: 6%;
}

.ikas-table th {
  color: #64748b;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1;
  padding: 0 16px 7px;
  text-transform: uppercase;
  white-space: nowrap;
}

.ikas-table th,
.ikas-table td {
  box-sizing: border-box;
}

.ikas-table th:nth-child(1),
.ikas-table td:nth-child(1) {
  width: 39%;
}

.ikas-table th:nth-child(2),
.ikas-table td:nth-child(2) {
  width: 15%;
}

.ikas-table th:nth-child(3),
.ikas-table td:nth-child(3) {
  width: 15%;
}

.ikas-table th:nth-child(4),
.ikas-table td:nth-child(4) {
  width: 15%;
}

.ikas-table th:nth-child(5),
.ikas-table td:nth-child(5) {
  width: 10%;
}

.ikas-table th:nth-child(6),
.ikas-table td:nth-child(6) {
  width: 6%;
}

.ikas-table th:nth-child(1),
.ikas-table td:nth-child(1),
.ikas-table th:nth-child(2),
.ikas-table td:nth-child(2),
.ikas-table th:nth-child(3),
.ikas-table td:nth-child(3),
.ikas-table th:nth-child(4),
.ikas-table td:nth-child(4) {
  text-align: left;
}

.ikas-table th:nth-child(5),
.ikas-table td:nth-child(5),
.ikas-table th:nth-child(6),
.ikas-table td:nth-child(6) {
  text-align: center;
}

.ikas-table th:nth-child(5) {
  transform: translateX(-18px);
}

.ikas-page :deep(.ikas-table-row td) {
  border-color: #dbe5f3;
  overflow: hidden;
  padding: 9px 12px;
  vertical-align: middle;
}

.ikas-page :deep(.ikas-table-row td:first-child) {
  border-radius: 10px 0 0 10px;
}

.ikas-page :deep(.ikas-table-row td:last-child) {
  border-radius: 0 10px 10px 0;
}

.ikas-page :deep(.ikas-table-row:hover td),
.ikas-page :deep(.ikas-table-row:focus-visible td),
.ikas-page :deep(.ikas-table-row.is-selected td) {
  background: #f8fbff;
  border-color: #a9c7ff;
  box-shadow: none;
}

.ikas-page :deep(.ikas-company) {
  gap: 10px;
  min-width: 0;
}

.ikas-page :deep(.ikas-company strong) {
  font-size: 13px;
  line-height: 1.2;
  max-width: 340px;
}

.ikas-page :deep(.ikas-company small) {
  font-size: 11px;
  line-height: 1.25;
  max-width: 390px;
}

.ikas-page :deep(.ikas-company small span) {
  display: inline;
}

.ikas-page :deep(.ikas-company small span:first-child) {
  color: #1d4ed8;
  font-weight: 850;
}

.ikas-page :deep(.ikas-company small span + span)::before {
  color: #94a3b8;
  content: " / ";
  font-weight: 700;
}

.ikas-page :deep(.ikas-company small span + span) {
  color: #0e7490;
  font-weight: 750;
}

.ikas-page :deep(.ikas-avatar) {
  border-radius: 8px !important;
  flex-basis: 36px !important;
  height: 36px !important;
  max-height: 36px !important;
  max-width: 36px !important;
  width: 36px !important;
}

.ikas-page :deep(.ikas-sector-pill),
.ikas-page :deep(.ikas-status),
.ikas-page :deep(.ikas-score-badge) {
  border-radius: 999px;
  font-size: 10.5px;
  line-height: 1;
  padding: 6px 9px;
}

.ikas-page :deep(.ikas-sector-stack) {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.ikas-page :deep(.ikas-sector-stack strong) {
  color: #1d4ed8;
  display: block;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.2;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-page :deep(.ikas-sector-stack small) {
  color: #0e7490;
  display: block;
  font-size: 11px;
  font-weight: 750;
  line-height: 1.25;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-page :deep(.ikas-score-cell) {
  --score-accent: #d97706;
  --score-accent-dark: #92400e;
  --score-accent-soft: #fef3c7;
  --score-glow: rgba(245, 158, 11, 0.24);
  margin-inline: 0;
  max-width: 128px;
  min-width: 0;
  text-align: left;
  width: 100%;
}

.ikas-page :deep(.ikas-score-cell.risk) {
  --score-accent: #ef4444;
  --score-accent-dark: #991b1b;
  --score-accent-soft: #fee2e2;
  --score-glow: rgba(239, 68, 68, 0.2);
}

.ikas-page :deep(.ikas-score-cell.watch) {
  --score-accent: #f59e0b;
  --score-accent-dark: #92400e;
  --score-accent-soft: #fef3c7;
  --score-glow: rgba(245, 158, 11, 0.24);
}

.ikas-page :deep(.ikas-score-cell.healthy) {
  --score-accent: #10b981;
  --score-accent-dark: #047857;
  --score-accent-soft: #d1fae5;
  --score-glow: rgba(16, 185, 129, 0.22);
}

.ikas-page :deep(.ikas-score-summary) {
  align-items: center;
  display: inline-flex;
  gap: 3px;
  margin-bottom: 4px;
}

.ikas-page :deep(.ikas-score-badge) {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0)),
    var(--score-accent-soft);
  border: 1px solid color-mix(in srgb, var(--score-accent) 24%, #ffffff);
  box-shadow: 0 3px 8px var(--score-glow);
  color: var(--score-accent-dark);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  font-weight: 900;
  min-width: 38px;
  padding: 4px 7px;
  text-align: center;
}

.ikas-page :deep(.ikas-score-scale) {
  color: #94a3b8;
  font-size: 9px;
  font-weight: 850;
  line-height: 1;
}

.ikas-page :deep(.ikas-score-track) {
  background: #e7ecf3;
  border-radius: 999px;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.08);
  height: 5px;
  overflow: hidden;
  position: relative;
  width: 100%;
}

.ikas-page :deep(.ikas-score-fill) {
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--score-accent) 72%, #ef4444), var(--score-accent));
  border-radius: inherit;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--score-accent) 12%, transparent);
  display: block;
  height: 100%;
}

.ikas-page :deep(.ikas-score-caption) {
  align-items: center;
  color: var(--score-accent-dark);
  display: inline-flex;
  font-size: 9.5px;
  font-weight: 850;
  gap: 3px;
  line-height: 1.1;
  margin-top: 3px;
  max-width: 128px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-page :deep(.ikas-score-caption i) {
  color: var(--score-accent);
  font-size: 10px;
  line-height: 1;
}

.ikas-page :deep(.ikas-status) {
  align-items: center;
  gap: 5px;
  justify-content: center;
  min-width: 68px;
  max-width: 100%;
}

.ikas-page :deep(.ikas-table-row td:nth-child(5)),
.ikas-page :deep(.ikas-table-row td:nth-child(6)) {
  padding-left: 8px;
  padding-right: 8px;
}

.ikas-page :deep(.ikas-table-row td:nth-child(6)) {
  text-align: center;
}

.ikas-page :deep(.ikas-status),
.ikas-page :deep(.ikas-record-actions),
.ikas-page :deep(.ikas-row-action) {
  vertical-align: middle;
}

.ikas-page :deep(.ikas-status.edit-request) {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  min-width: 0;
  padding-inline: 8px;
  width: fit-content;
}

.ikas-page :deep(.ikas-status.edit-request i) {
  font-size: 13px;
  line-height: 1;
}

.ikas-page :deep(.ikas-updated) {
  display: block;
  min-width: 0;
  text-align: left;
}

.ikas-page :deep(.ikas-updated strong) {
  font-size: 11.5px;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-page :deep(.ikas-updated small) {
  font-size: 10.5px;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-page :deep(.ikas-row-action) {
  align-items: center;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 7px;
  color: #2563eb;
  display: inline-flex;
  height: 28px;
  justify-content: center;
  margin-inline: auto;
  opacity: 0.78;
  transition: background 160ms ease, border-color 160ms ease, opacity 160ms ease, transform 160ms ease;
  width: 28px;
}

.ikas-page :deep(.ikas-record-actions) {
  align-items: center;
  display: grid;
  gap: 5px;
  justify-items: stretch;
  margin-inline: auto;
  max-width: 78px;
  transform: translateX(-18px);
  width: 100%;
}

.ikas-page :deep(.ikas-record-actions.is-request-actions) {
  max-width: 78px;
}

.ikas-page :deep(.ikas-action-btn) {
  align-items: center;
  border: 1px solid transparent;
  border-radius: 8px;
  display: inline-flex;
  font-size: 10.5px;
  font-weight: 850;
  gap: 4px;
  justify-content: center;
  line-height: 1;
  min-height: 28px;
  min-width: 0;
  padding: 0 7px;
  transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease, opacity 160ms ease, transform 160ms ease;
  width: 100%;
  white-space: nowrap;
}

.ikas-page :deep(.ikas-action-btn:hover:not(:disabled)) {
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.ikas-page :deep(.ikas-action-btn:disabled) {
  cursor: not-allowed;
  opacity: 0.68;
}

.ikas-page :deep(.ikas-action-btn.validate) {
  background: #dcfce7;
  border-color: #bbf7d0;
  color: #166534;
  max-width: 78px;
}

.ikas-page :deep(.ikas-action-btn.approve) {
  background: #dbeafe;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.ikas-page :deep(.ikas-action-btn.reject) {
  background: #fee2e2;
  border-color: #fecaca;
  color: #991b1b;
}

.ikas-page :deep(.ikas-action-spin) {
  animation: ikas-spin 800ms linear infinite;
}

.ikas-page :deep(.ikas-no-action) {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 800;
}

.ikas-detail-actions {
  border-bottom: 1px solid #e8eef7;
  margin: -4px 0 12px;
  padding: 0 0 12px;
}

.ikas-detail-actions :deep(.ikas-record-actions) {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-inline: 0;
  max-width: none;
  transform: none;
  width: 100%;
}

.ikas-detail-actions :deep(.ikas-record-actions:not(.is-request-actions)) {
  grid-template-columns: 1fr;
}

.ikas-detail-actions :deep(.ikas-action-btn) {
  min-height: 34px;
}

.ikas-detail-actions :deep(.ikas-action-btn.validate) {
  max-width: none;
}

.ikas-detail-actions :deep(.ikas-no-action) {
  display: block;
  text-align: left;
}

.ikas-detail-panel .ikas-detail-actions {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin: -2px 0 14px;
  padding: 10px;
}

.ikas-request-reason,
.ikas-confirm-reason,
.ikas-reject-field {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  display: grid;
  gap: 6px;
  margin: 0 0 14px;
  padding: 10px 12px;
}

.ikas-confirm-reason,
.ikas-reject-field {
  margin: 12px 0 0;
}

.ikas-request-reason span,
.ikas-confirm-reason span,
.ikas-reject-field span {
  color: #64748b;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1;
  text-transform: uppercase;
}

.ikas-request-reason p,
.ikas-confirm-reason p {
  color: #0f172a;
  font-size: 12.5px;
  font-weight: 700;
  line-height: 1.45;
  margin: 0;
  white-space: pre-wrap;
}

.ikas-reject-field textarea {
  background: #ffffff;
  border: 1px solid #dbe5f3;
  border-radius: 8px;
  color: #0f172a;
  font-size: 12.5px;
  font-weight: 650;
  line-height: 1.45;
  min-height: 78px;
  outline: 0;
  padding: 9px 10px;
  resize: vertical;
  width: 100%;
}

.ikas-reject-field textarea:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
}

.ikas-detail-panel .ikas-detail-actions :deep(.ikas-record-actions),
.ikas-detail-panel .ikas-detail-actions :deep(.ikas-record-actions.is-request-actions) {
  align-items: stretch;
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  justify-items: stretch;
  margin-inline: 0;
  max-width: none;
  transform: none;
  width: 100%;
}

.ikas-detail-panel .ikas-detail-actions :deep(.ikas-record-actions:not(.is-request-actions)) {
  grid-template-columns: 1fr;
}

.ikas-detail-panel .ikas-detail-actions :deep(.ikas-action-btn) {
  border-radius: 9px;
  font-size: 11.5px;
  gap: 6px;
  min-height: 38px;
  padding: 0 12px;
}

.ikas-detail-panel .ikas-detail-actions :deep(.ikas-action-btn.validate) {
  max-width: none;
}

.ikas-detail-panel .ikas-detail-actions :deep(.ikas-action-btn i) {
  font-size: 14px;
}

.ikas-action-error {
  align-items: center;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 9px;
  color: #991b1b;
  display: flex;
  font-size: 12px;
  font-weight: 750;
  gap: 8px;
  margin: -4px 0 12px;
  padding: 9px 10px;
}

.ikas-confirm-backdrop {
  align-items: center;
  background: rgba(15, 23, 42, 0.42);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 18px;
  position: fixed;
  z-index: 1200;
}

.ikas-confirm-modal {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24);
  max-width: 390px;
  padding: 18px;
  position: relative;
  width: min(390px, 100%);
}

.ikas-confirm-close {
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #64748b;
  display: inline-flex;
  height: 30px;
  justify-content: center;
  position: absolute;
  right: 12px;
  top: 12px;
  width: 30px;
}

.ikas-confirm-close:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.ikas-confirm-icon {
  align-items: center;
  border-radius: 10px;
  display: inline-flex;
  font-size: 20px;
  height: 42px;
  justify-content: center;
  margin-bottom: 12px;
  width: 42px;
}

.ikas-confirm-icon.validate,
.ikas-confirm-primary.validate {
  background: #dcfce7;
  color: #166534;
}

.ikas-confirm-icon.approve,
.ikas-confirm-primary.approve {
  background: #dbeafe;
  color: #1d4ed8;
}

.ikas-confirm-icon.reject,
.ikas-confirm-primary.reject {
  background: #fee2e2;
  color: #991b1b;
}

.ikas-confirm-copy h3 {
  color: #0f172a;
  font-size: 17px;
  font-weight: 900;
  line-height: 1.25;
  margin: 0 36px 7px 0;
}

.ikas-confirm-copy p {
  color: #64748b;
  font-size: 12.5px;
  font-weight: 650;
  line-height: 1.45;
  margin: 0;
}

.ikas-confirm-record {
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  display: flex;
  gap: 10px;
  justify-content: space-between;
  margin-top: 14px;
  min-width: 0;
  padding: 9px 10px;
}

.ikas-confirm-record span {
  color: #0f172a;
  font-size: 12px;
  font-weight: 850;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-confirm-record strong {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  color: #475569;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  padding: 5px 8px;
}

.ikas-confirm-error {
  margin: 12px 0 0;
}

.ikas-confirm-actions {
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr 1fr;
  margin-top: 16px;
}

.ikas-confirm-secondary,
.ikas-confirm-primary {
  align-items: center;
  border: 1px solid transparent;
  border-radius: 9px;
  display: inline-flex;
  font-size: 12px;
  font-weight: 900;
  gap: 7px;
  justify-content: center;
  min-height: 36px;
  padding: 0 12px;
}

.ikas-confirm-secondary {
  background: #ffffff;
  border-color: #dbe5f3;
  color: #475569;
}

.ikas-confirm-primary {
  border-color: transparent;
}

.ikas-confirm-primary:disabled,
.ikas-confirm-secondary:disabled {
  cursor: not-allowed;
  opacity: 0.68;
}

@keyframes ikas-spin {
  to {
    transform: rotate(360deg);
  }
}

.ikas-page :deep(.ikas-table-row:hover .ikas-row-action),
.ikas-page :deep(.ikas-table-row:focus-visible .ikas-row-action),
.ikas-page :deep(.ikas-table-row.is-selected .ikas-row-action) {
  background: #dbeafe;
  border-color: #93c5fd;
  opacity: 1;
  transform: translateX(1px);
}

:global(html[data-theme-mode="dark"]) .ikas-page,
:global(html.dark) .ikas-page {
  --ikas-blue: #60a5fa;
  --ikas-blue-dark: #93c5fd;
  --ikas-border: #263449;
  --ikas-muted: #94a3b8;
  --ikas-text: #e5edf7;
  --ikas-surface: #101827;
  --ikas-page-bg: #0b1120;
  --ikas-soft: #111c2d;
  background:
    radial-gradient(circle at 12% 0%, rgba(37, 99, 235, 0.16), transparent 32%),
    radial-gradient(circle at 88% 8%, rgba(14, 116, 144, 0.13), transparent 30%),
    var(--ikas-page-bg);
  color: var(--ikas-text);
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(input),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(select),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(textarea),
:global(html.dark) .ikas-page :deep(input),
:global(html.dark) .ikas-page :deep(select),
:global(html.dark) .ikas-page :deep(textarea) {
  color-scheme: dark;
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(input::placeholder),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(textarea::placeholder),
:global(html.dark) .ikas-page :deep(input::placeholder),
:global(html.dark) .ikas-page :deep(textarea::placeholder) {
  color: #64748b;
}

:global(html[data-theme-mode="dark"]) .ikas-hero-header,
:global(html.dark) .ikas-hero-header {
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(15, 42, 83, 0.9) 48%, rgba(30, 64, 175, 0.82)),
    radial-gradient(circle at 20% 16%, rgba(96, 165, 250, 0.26), transparent 32%);
  border-color: rgba(96, 165, 250, 0.24);
  box-shadow: 0 20px 54px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

:global(html[data-theme-mode="dark"]) .ikas-filter-shell,
:global(html[data-theme-mode="dark"]) .ikas-list-shell,
:global(html[data-theme-mode="dark"]) .ikas-detail-panel,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-filter-shell),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-kpi-card),
:global(html[data-theme-mode="dark"]) .ikas-kpi-card,
:global(html[data-theme-mode="dark"]) .ikas-mobile-card,
:global(html.dark) .ikas-filter-shell,
:global(html.dark) .ikas-list-shell,
:global(html.dark) .ikas-detail-panel,
:global(html.dark) .ikas-page :deep(.ikas-filter-shell),
:global(html.dark) .ikas-page :deep(.ikas-kpi-card),
:global(html.dark) .ikas-kpi-card,
:global(html.dark) .ikas-mobile-card {
  background: rgba(16, 24, 39, 0.96);
  border-color: var(--ikas-border);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
}

:global(html[data-theme-mode="dark"]) .ikas-detail-panel,
:global(html.dark) .ikas-detail-panel {
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(16, 24, 39, 0.98)),
    var(--ikas-surface);
}

:global(html[data-theme-mode="dark"]) .ikas-detail-panel::after,
:global(html.dark) .ikas-detail-panel::after {
  background:
    linear-gradient(135deg, rgba(96, 165, 250, 0.08), transparent 38%),
    linear-gradient(225deg, rgba(45, 212, 191, 0.07), transparent 34%);
}

:global(html[data-theme-mode="dark"]) .ikas-header-search,
:global(html[data-theme-mode="dark"]) .ikas-search,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-search),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-field),
:global(html[data-theme-mode="dark"]) .ikas-field,
:global(html[data-theme-mode="dark"]) .ikas-page-size,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-clear-btn),
:global(html[data-theme-mode="dark"]) .ikas-clear-btn,
:global(html[data-theme-mode="dark"]) .ikas-icon-btn,
:global(html[data-theme-mode="dark"]) .ikas-profile-btn,
:global(html[data-theme-mode="dark"]) .ikas-panel-close,
:global(html[data-theme-mode="dark"]) .ikas-mobile-footer button,
:global(html.dark) .ikas-header-search,
:global(html.dark) .ikas-search,
:global(html.dark) .ikas-page :deep(.ikas-search),
:global(html.dark) .ikas-page :deep(.ikas-field),
:global(html.dark) .ikas-field,
:global(html.dark) .ikas-page-size,
:global(html.dark) .ikas-page :deep(.ikas-clear-btn),
:global(html.dark) .ikas-clear-btn,
:global(html.dark) .ikas-icon-btn,
:global(html.dark) .ikas-profile-btn,
:global(html.dark) .ikas-panel-close,
:global(html.dark) .ikas-mobile-footer button {
  background: #0f172a;
  border-color: var(--ikas-border);
  color: var(--ikas-muted);
}

:global(html[data-theme-mode="dark"]) .ikas-hero-tools > .ikas-header-search,
:global(html.dark) .ikas-hero-tools > .ikas-header-search {
  background: rgba(15, 23, 42, 0.78);
  border-color: rgba(148, 163, 184, 0.32);
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28);
}

:global(html[data-theme-mode="dark"]) .ikas-header-search input,
:global(html[data-theme-mode="dark"]) .ikas-search input,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-search input),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-field input),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-field select),
:global(html[data-theme-mode="dark"]) .ikas-field input,
:global(html[data-theme-mode="dark"]) .ikas-field select,
:global(html[data-theme-mode="dark"]) .ikas-page-size select,
:global(html.dark) .ikas-header-search input,
:global(html.dark) .ikas-search input,
:global(html.dark) .ikas-page :deep(.ikas-search input),
:global(html.dark) .ikas-page :deep(.ikas-field input),
:global(html.dark) .ikas-page :deep(.ikas-field select),
:global(html.dark) .ikas-field input,
:global(html.dark) .ikas-field select,
:global(html.dark) .ikas-page-size select {
  color: var(--ikas-text);
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-field select option),
:global(html[data-theme-mode="dark"]) .ikas-field select option,
:global(html.dark) .ikas-page :deep(.ikas-field select option),
:global(html.dark) .ikas-field select option {
  background: #0f172a;
  color: var(--ikas-text);
}

:global(html[data-theme-mode="dark"]) .ikas-realtime-strip,
:global(html.dark) .ikas-realtime-strip {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.12), rgba(45, 212, 191, 0.08));
  border-color: rgba(96, 165, 250, 0.2);
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-kpi-icon),
:global(html[data-theme-mode="dark"]) .ikas-kpi-icon,
:global(html.dark) .ikas-page :deep(.ikas-kpi-icon),
:global(html.dark) .ikas-kpi-icon {
  background: color-mix(in srgb, var(--accent) 18%, #0f172a);
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-kpi-card:hover),
:global(html.dark) .ikas-page :deep(.ikas-kpi-card:hover) {
  border-color: color-mix(in srgb, var(--accent) 40%, #263449);
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.34);
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-table-row td),
:global(html[data-theme-mode="dark"]) .ikas-table-row td,
:global(html.dark) .ikas-page :deep(.ikas-table-row td),
:global(html.dark) .ikas-table-row td {
  background: #111827;
  border-color: var(--ikas-border);
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-table-row:hover td),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-table-row:focus-visible td),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-table-row.is-selected td),
:global(html[data-theme-mode="dark"]) .ikas-table-row:hover td,
:global(html[data-theme-mode="dark"]) .ikas-table-row:focus-visible td,
:global(html[data-theme-mode="dark"]) .ikas-table-row.is-selected td,
:global(html.dark) .ikas-page :deep(.ikas-table-row:hover td),
:global(html.dark) .ikas-page :deep(.ikas-table-row:focus-visible td),
:global(html.dark) .ikas-page :deep(.ikas-table-row.is-selected td),
:global(html.dark) .ikas-table-row:hover td,
:global(html.dark) .ikas-table-row:focus-visible td,
:global(html.dark) .ikas-table-row.is-selected td {
  background: #17233a;
  border-color: rgba(96, 165, 250, 0.42);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
}

:global(html[data-theme-mode="dark"]) .ikas-table th,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-table th),
:global(html.dark) .ikas-table th,
:global(html.dark) .ikas-page :deep(.ikas-table th) {
  color: #94a3b8;
}

:global(html[data-theme-mode="dark"]) .ikas-company strong,
:global(html[data-theme-mode="dark"]) .ikas-updated strong,
:global(html[data-theme-mode="dark"]) .ikas-list-header h2,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-company strong),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-updated strong),
:global(html.dark) .ikas-company strong,
:global(html.dark) .ikas-updated strong,
:global(html.dark) .ikas-list-header h2,
:global(html.dark) .ikas-page :deep(.ikas-company strong),
:global(html.dark) .ikas-page :deep(.ikas-updated strong) {
  color: var(--ikas-text);
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-avatar),
:global(html[data-theme-mode="dark"]) .ikas-avatar,
:global(html.dark) .ikas-page :deep(.ikas-avatar),
:global(html.dark) .ikas-avatar {
  border-color: var(--ikas-border) !important;
  background: #0f172a;
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-avatar-fallback),
:global(html[data-theme-mode="dark"]) .ikas-avatar-fallback,
:global(html.dark) .ikas-page :deep(.ikas-avatar-fallback),
:global(html.dark) .ikas-avatar-fallback {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.24), rgba(45, 212, 191, 0.18));
  color: #bfdbfe;
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-score-track),
:global(html[data-theme-mode="dark"]) .ikas-score-track,
:global(html[data-theme-mode="dark"]) .ikas-domain-bar,
:global(html.dark) .ikas-page :deep(.ikas-score-track),
:global(html.dark) .ikas-score-track,
:global(html.dark) .ikas-domain-bar {
  background: #263449;
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-score-badge),
:global(html.dark) .ikas-page :deep(.ikas-score-badge) {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0)),
    color-mix(in srgb, var(--score-accent) 18%, #0f172a);
  border-color: color-mix(in srgb, var(--score-accent) 30%, #263449);
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-status.validated),
:global(html[data-theme-mode="dark"]) .ikas-panel-status.validated,
:global(html.dark) .ikas-page :deep(.ikas-status.validated),
:global(html.dark) .ikas-panel-status.validated {
  background: rgba(34, 197, 94, 0.16);
  border-color: rgba(74, 222, 128, 0.28);
  color: #86efac;
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-status.draft),
:global(html[data-theme-mode="dark"]) .ikas-panel-status.draft,
:global(html.dark) .ikas-page :deep(.ikas-status.draft),
:global(html.dark) .ikas-panel-status.draft {
  background: rgba(148, 163, 184, 0.14);
  border-color: rgba(148, 163, 184, 0.24);
  color: #cbd5e1;
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-status.edit-request),
:global(html[data-theme-mode="dark"]) .ikas-panel-status.edit-request,
:global(html.dark) .ikas-page :deep(.ikas-status.edit-request),
:global(html.dark) .ikas-panel-status.edit-request {
  background: rgba(245, 158, 11, 0.16);
  border-color: rgba(251, 191, 36, 0.32);
  color: #fbbf24;
}

:global(html[data-theme-mode="dark"]) .ikas-detail-panel .ikas-detail-actions,
:global(html[data-theme-mode="dark"]) .ikas-request-reason,
:global(html[data-theme-mode="dark"]) .ikas-panel-score,
:global(html[data-theme-mode="dark"]) .ikas-domain-card,
:global(html[data-theme-mode="dark"]) .ikas-panel-meta,
:global(html[data-theme-mode="dark"]) .ikas-detail-facts > div,
:global(html[data-theme-mode="dark"]) .ikas-detail-timeline > div,
:global(html[data-theme-mode="dark"]) .ikas-panel-meta > div,
:global(html.dark) .ikas-detail-panel .ikas-detail-actions,
:global(html.dark) .ikas-request-reason,
:global(html.dark) .ikas-panel-score,
:global(html.dark) .ikas-domain-card,
:global(html.dark) .ikas-panel-meta,
:global(html.dark) .ikas-detail-facts > div,
:global(html.dark) .ikas-detail-timeline > div,
:global(html.dark) .ikas-panel-meta > div {
  background: #0f172a;
  border-color: var(--ikas-border);
}

:global(html[data-theme-mode="dark"]) .ikas-panel-hero,
:global(html.dark) .ikas-panel-hero {
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.72), rgba(16, 24, 39, 0));
  border-color: var(--ikas-border);
}

:global(html[data-theme-mode="dark"]) .ikas-panel-hero h2,
:global(html[data-theme-mode="dark"]) .ikas-panel-score strong,
:global(html[data-theme-mode="dark"]) .ikas-panel-meta strong,
:global(html[data-theme-mode="dark"]) .ikas-domain-row strong,
:global(html[data-theme-mode="dark"]) .ikas-card-title h3,
:global(html.dark) .ikas-panel-hero h2,
:global(html.dark) .ikas-panel-score strong,
:global(html.dark) .ikas-panel-meta strong,
:global(html.dark) .ikas-domain-row strong,
:global(html.dark) .ikas-card-title h3 {
  color: var(--ikas-text);
}

:global(html[data-theme-mode="dark"]) .ikas-panel-hero p,
:global(html[data-theme-mode="dark"]) .ikas-panel-hero .ikas-eyebrow,
:global(html[data-theme-mode="dark"]) .ikas-panel-score span,
:global(html[data-theme-mode="dark"]) .ikas-panel-score small,
:global(html[data-theme-mode="dark"]) .ikas-panel-meta span,
:global(html[data-theme-mode="dark"]) .ikas-domain-row span,
:global(html.dark) .ikas-panel-hero p,
:global(html.dark) .ikas-panel-hero .ikas-eyebrow,
:global(html.dark) .ikas-panel-score span,
:global(html.dark) .ikas-panel-score small,
:global(html.dark) .ikas-panel-meta span,
:global(html.dark) .ikas-domain-row span {
  color: var(--ikas-muted);
}

:global(html[data-theme-mode="dark"]) .ikas-attention-stat,
:global(html[data-theme-mode="dark"]) .ikas-attention-card,
:global(html[data-theme-mode="dark"]) .ikas-summary-sector,
:global(html[data-theme-mode="dark"]) .ikas-attention-row,
:global(html[data-theme-mode="dark"]) .ikas-summary-sector-row,
:global(html.dark) .ikas-attention-stat,
:global(html.dark) .ikas-attention-card,
:global(html.dark) .ikas-summary-sector,
:global(html.dark) .ikas-attention-row,
:global(html.dark) .ikas-summary-sector-row {
  background: #0f172a;
  border-color: var(--ikas-border);
  color: var(--ikas-text);
}

:global(html[data-theme-mode="dark"]) .ikas-summary-hero,
:global(html.dark) .ikas-summary-hero {
  border-color: var(--ikas-border);
}

:global(html[data-theme-mode="dark"]) .ikas-summary-hero h2,
:global(html[data-theme-mode="dark"]) .ikas-attention-row strong,
:global(html[data-theme-mode="dark"]) .ikas-summary-sector-row strong,
:global(html.dark) .ikas-summary-hero h2,
:global(html.dark) .ikas-attention-row strong,
:global(html.dark) .ikas-summary-sector-row strong {
  color: var(--ikas-text);
}

:global(html[data-theme-mode="dark"]) .ikas-summary-hero p,
:global(html[data-theme-mode="dark"]) .ikas-attention-row span,
:global(html[data-theme-mode="dark"]) .ikas-summary-sector-row span,
:global(html.dark) .ikas-summary-hero p,
:global(html.dark) .ikas-attention-row span,
:global(html.dark) .ikas-summary-sector-row span {
  color: var(--ikas-muted);
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-action-btn.validate),
:global(html.dark) .ikas-page :deep(.ikas-action-btn.validate) {
  background: rgba(34, 197, 94, 0.16);
  border-color: rgba(74, 222, 128, 0.24);
  color: #86efac;
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-action-btn.approve),
:global(html.dark) .ikas-page :deep(.ikas-action-btn.approve) {
  background: rgba(59, 130, 246, 0.16);
  border-color: rgba(96, 165, 250, 0.28);
  color: #93c5fd;
}

:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-action-btn.reject),
:global(html.dark) .ikas-page :deep(.ikas-action-btn.reject) {
  background: rgba(239, 68, 68, 0.16);
  border-color: rgba(248, 113, 113, 0.28);
  color: #fca5a5;
}

:global(html[data-theme-mode="dark"]) .ikas-action-error,
:global(html.dark) .ikas-action-error {
  background: rgba(127, 29, 29, 0.34);
  border-color: rgba(248, 113, 113, 0.3);
  color: #fecaca;
}

:global(html[data-theme-mode="dark"]) .ikas-confirm-backdrop,
:global(html.dark) .ikas-confirm-backdrop {
  background: rgba(2, 6, 23, 0.72);
}

:global(html[data-theme-mode="dark"]) .ikas-confirm-modal,
:global(html.dark) .ikas-confirm-modal {
  background: #101827;
  border-color: var(--ikas-border);
  box-shadow: 0 28px 70px rgba(0, 0, 0, 0.54);
}

:global(html[data-theme-mode="dark"]) .ikas-confirm-close,
:global(html[data-theme-mode="dark"]) .ikas-confirm-record,
:global(html[data-theme-mode="dark"]) .ikas-confirm-record strong,
:global(html[data-theme-mode="dark"]) .ikas-confirm-reason,
:global(html[data-theme-mode="dark"]) .ikas-reject-field,
:global(html[data-theme-mode="dark"]) .ikas-reject-field textarea,
:global(html[data-theme-mode="dark"]) .ikas-confirm-secondary,
:global(html.dark) .ikas-confirm-close,
:global(html.dark) .ikas-confirm-record,
:global(html.dark) .ikas-confirm-record strong,
:global(html.dark) .ikas-confirm-reason,
:global(html.dark) .ikas-reject-field,
:global(html.dark) .ikas-reject-field textarea,
:global(html.dark) .ikas-confirm-secondary {
  background: #0f172a;
  border-color: var(--ikas-border);
  color: var(--ikas-text);
}

:global(html[data-theme-mode="dark"]) .ikas-confirm-copy h3,
:global(html[data-theme-mode="dark"]) .ikas-confirm-record span,
:global(html[data-theme-mode="dark"]) .ikas-confirm-reason p,
:global(html[data-theme-mode="dark"]) .ikas-request-reason p,
:global(html.dark) .ikas-confirm-copy h3,
:global(html.dark) .ikas-confirm-record span,
:global(html.dark) .ikas-confirm-reason p,
:global(html.dark) .ikas-request-reason p {
  color: var(--ikas-text);
}

:global(html[data-theme-mode="dark"]) .ikas-confirm-copy p,
:global(html[data-theme-mode="dark"]) .ikas-confirm-reason span,
:global(html[data-theme-mode="dark"]) .ikas-reject-field span,
:global(html[data-theme-mode="dark"]) .ikas-request-reason span,
:global(html.dark) .ikas-confirm-copy p,
:global(html.dark) .ikas-confirm-reason span,
:global(html.dark) .ikas-reject-field span,
:global(html.dark) .ikas-request-reason span {
  color: var(--ikas-muted);
}

:global(html[data-theme-mode="dark"]) .ikas-confirm-icon.validate,
:global(html[data-theme-mode="dark"]) .ikas-confirm-primary.validate,
:global(html.dark) .ikas-confirm-icon.validate,
:global(html.dark) .ikas-confirm-primary.validate {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
}

:global(html[data-theme-mode="dark"]) .ikas-confirm-icon.approve,
:global(html[data-theme-mode="dark"]) .ikas-confirm-primary.approve,
:global(html.dark) .ikas-confirm-icon.approve,
:global(html.dark) .ikas-confirm-primary.approve {
  background: rgba(59, 130, 246, 0.16);
  color: #93c5fd;
}

:global(html[data-theme-mode="dark"]) .ikas-confirm-icon.reject,
:global(html[data-theme-mode="dark"]) .ikas-confirm-primary.reject,
:global(html.dark) .ikas-confirm-icon.reject,
:global(html.dark) .ikas-confirm-primary.reject {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
}

.ikas-page.is-dark {
  --ikas-blue: #60a5fa;
  --ikas-blue-dark: #93c5fd;
  --ikas-border: #263449;
  --ikas-muted: #94a3b8;
  --ikas-text: #e5edf7;
  --ikas-surface: #101827;
  --ikas-page-bg: #0b1120;
  --ikas-soft: #111c2d;
  background:
    radial-gradient(circle at 12% 0%, rgba(37, 99, 235, 0.16), transparent 32%),
    radial-gradient(circle at 88% 8%, rgba(14, 116, 144, 0.13), transparent 30%),
    var(--ikas-page-bg) !important;
  color: var(--ikas-text) !important;
}

.ikas-page.is-dark,
.ikas-page.is-dark * {
  scrollbar-color: #334155 #0f172a;
}

.ikas-page.is-dark input,
.ikas-page.is-dark select,
.ikas-page.is-dark textarea,
.ikas-page.is-dark :deep(input),
.ikas-page.is-dark :deep(select),
.ikas-page.is-dark :deep(textarea) {
  color-scheme: dark;
}

.ikas-page.is-dark input::placeholder,
.ikas-page.is-dark textarea::placeholder,
.ikas-page.is-dark :deep(input::placeholder),
.ikas-page.is-dark :deep(textarea::placeholder) {
  color: #64748b !important;
}

.ikas-page.is-dark .ikas-hero-header {
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(15, 42, 83, 0.92) 48%, rgba(30, 64, 175, 0.86)),
    radial-gradient(circle at 20% 16%, rgba(96, 165, 250, 0.28), transparent 32%) !important;
  border-color: rgba(96, 165, 250, 0.24) !important;
  box-shadow: 0 20px 54px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
}

.ikas-page.is-dark .ikas-filter-shell,
.ikas-page.is-dark .ikas-list-shell,
.ikas-page.is-dark .ikas-detail-panel,
.ikas-page.is-dark .ikas-mobile-card,
.ikas-page.is-dark .ikas-attention-card,
.ikas-page.is-dark .ikas-summary-sector,
.ikas-page.is-dark :deep(.ikas-filter-shell),
.ikas-page.is-dark :deep(.ikas-kpi-card) {
  background: #101827 !important;
  border-color: var(--ikas-border) !important;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32) !important;
  color: var(--ikas-text) !important;
}

.ikas-page.is-dark .ikas-detail-panel {
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(16, 24, 39, 0.98)),
    var(--ikas-surface) !important;
}

.ikas-page.is-dark .ikas-detail-panel::after {
  background:
    linear-gradient(135deg, rgba(96, 165, 250, 0.08), transparent 38%),
    linear-gradient(225deg, rgba(45, 212, 191, 0.07), transparent 34%) !important;
}

.ikas-page.is-dark .ikas-header-search,
.ikas-page.is-dark .ikas-search,
.ikas-page.is-dark .ikas-field,
.ikas-page.is-dark .ikas-page-size,
.ikas-page.is-dark .ikas-clear-btn,
.ikas-page.is-dark .ikas-icon-btn,
.ikas-page.is-dark .ikas-profile-btn,
.ikas-page.is-dark .ikas-panel-close,
.ikas-page.is-dark .ikas-mobile-footer button,
.ikas-page.is-dark :deep(.ikas-search),
.ikas-page.is-dark :deep(.ikas-field),
.ikas-page.is-dark :deep(.ikas-clear-btn),
.ikas-page.is-dark :deep(.ikas-filter-toggle) {
  background: #0f172a !important;
  border-color: var(--ikas-border) !important;
  color: var(--ikas-muted) !important;
}

.ikas-page.is-dark .ikas-hero-tools > .ikas-header-search {
  background: rgba(15, 23, 42, 0.78) !important;
  border-color: rgba(148, 163, 184, 0.32) !important;
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28) !important;
}

.ikas-page.is-dark input,
.ikas-page.is-dark select,
.ikas-page.is-dark textarea,
.ikas-page.is-dark :deep(input),
.ikas-page.is-dark :deep(select),
.ikas-page.is-dark :deep(textarea) {
  background: transparent !important;
  color: var(--ikas-text) !important;
}

.ikas-page.is-dark select option,
.ikas-page.is-dark :deep(select option) {
  background: #0f172a !important;
  color: var(--ikas-text) !important;
}

.ikas-page.is-dark .ikas-realtime-strip {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.12), rgba(45, 212, 191, 0.08)) !important;
  border-color: rgba(96, 165, 250, 0.2) !important;
}

.ikas-page.is-dark .ikas-table-row td,
.ikas-page.is-dark :deep(.ikas-table-row td) {
  background: #111827 !important;
  border-color: var(--ikas-border) !important;
  color: var(--ikas-text) !important;
}

.ikas-page.is-dark .ikas-table-row:hover td,
.ikas-page.is-dark .ikas-table-row:focus-visible td,
.ikas-page.is-dark .ikas-table-row.is-selected td,
.ikas-page.is-dark :deep(.ikas-table-row:hover td),
.ikas-page.is-dark :deep(.ikas-table-row:focus-visible td),
.ikas-page.is-dark :deep(.ikas-table-row.is-selected td) {
  background: #17233a !important;
  border-color: rgba(96, 165, 250, 0.42) !important;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28) !important;
}

.ikas-page.is-dark .ikas-table th,
.ikas-page.is-dark :deep(.ikas-table th) {
  color: #94a3b8 !important;
}

.ikas-page.is-dark .ikas-company strong,
.ikas-page.is-dark .ikas-updated strong,
.ikas-page.is-dark .ikas-list-header h2,
.ikas-page.is-dark .ikas-panel-hero h2,
.ikas-page.is-dark .ikas-panel-score strong,
.ikas-page.is-dark .ikas-panel-meta strong,
.ikas-page.is-dark .ikas-domain-row strong,
.ikas-page.is-dark .ikas-card-title h3,
.ikas-page.is-dark .ikas-summary-hero h2,
.ikas-page.is-dark .ikas-attention-row strong,
.ikas-page.is-dark .ikas-summary-sector-row strong,
.ikas-page.is-dark :deep(.ikas-company strong),
.ikas-page.is-dark :deep(.ikas-updated strong),
.ikas-page.is-dark :deep(.ikas-kpi-value),
.ikas-page.is-dark :deep(.ikas-filter-title span) {
  color: var(--ikas-text) !important;
}

.ikas-page.is-dark .ikas-company small,
.ikas-page.is-dark .ikas-updated small,
.ikas-page.is-dark .ikas-list-header p,
.ikas-page.is-dark .ikas-panel-hero p,
.ikas-page.is-dark .ikas-panel-hero .ikas-eyebrow,
.ikas-page.is-dark .ikas-panel-score span,
.ikas-page.is-dark .ikas-panel-score small,
.ikas-page.is-dark .ikas-panel-meta span,
.ikas-page.is-dark .ikas-domain-row span,
.ikas-page.is-dark .ikas-summary-hero p,
.ikas-page.is-dark .ikas-attention-row span,
.ikas-page.is-dark .ikas-summary-sector-row span,
.ikas-page.is-dark :deep(.ikas-kpi-label),
.ikas-page.is-dark :deep(.ikas-kpi-hint),
.ikas-page.is-dark :deep(.ikas-filter-title small),
.ikas-page.is-dark :deep(.ikas-field span) {
  color: var(--ikas-muted) !important;
}

.ikas-page.is-dark :deep(.ikas-kpi-icon) {
  background: color-mix(in srgb, var(--accent) 18%, #0f172a) !important;
}

.ikas-page.is-dark :deep(.ikas-kpi-card:hover) {
  border-color: color-mix(in srgb, var(--accent) 40%, #263449) !important;
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.34) !important;
}

.ikas-page.is-dark .ikas-avatar,
.ikas-page.is-dark :deep(.ikas-avatar) {
  background: #0f172a !important;
  border-color: var(--ikas-border) !important;
}

.ikas-page.is-dark .ikas-avatar-fallback,
.ikas-page.is-dark :deep(.ikas-avatar-fallback) {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.24), rgba(45, 212, 191, 0.18)) !important;
  color: #bfdbfe !important;
}

.ikas-page.is-dark .ikas-score-track,
.ikas-page.is-dark .ikas-domain-bar,
.ikas-page.is-dark :deep(.ikas-score-track) {
  background: #263449 !important;
}

.ikas-page.is-dark :deep(.ikas-score-badge) {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0)),
    color-mix(in srgb, var(--score-accent) 18%, #0f172a) !important;
  border-color: color-mix(in srgb, var(--score-accent) 30%, #263449) !important;
}

.ikas-page.is-dark .ikas-detail-panel .ikas-detail-actions,
.ikas-page.is-dark .ikas-request-reason,
.ikas-page.is-dark .ikas-panel-score,
.ikas-page.is-dark .ikas-domain-card,
.ikas-page.is-dark .ikas-panel-meta,
.ikas-page.is-dark .ikas-detail-facts > div,
.ikas-page.is-dark .ikas-detail-timeline > div,
.ikas-page.is-dark .ikas-panel-meta > div,
.ikas-page.is-dark .ikas-attention-stat,
.ikas-page.is-dark .ikas-attention-row,
.ikas-page.is-dark .ikas-summary-sector-row {
  background: #0f172a !important;
  border-color: var(--ikas-border) !important;
  color: var(--ikas-text) !important;
}

.ikas-page.is-dark .ikas-panel-hero,
.ikas-page.is-dark .ikas-summary-hero {
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.72), rgba(16, 24, 39, 0)) !important;
  border-color: var(--ikas-border) !important;
}

.ikas-page.is-dark :deep(.ikas-status.validated),
.ikas-page.is-dark .ikas-panel-status.validated {
  background: rgba(34, 197, 94, 0.16) !important;
  border-color: rgba(74, 222, 128, 0.28) !important;
  color: #86efac !important;
}

.ikas-page.is-dark :deep(.ikas-status.draft),
.ikas-page.is-dark .ikas-panel-status.draft {
  background: rgba(148, 163, 184, 0.14) !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
  color: #cbd5e1 !important;
}

.ikas-page.is-dark :deep(.ikas-status.edit-request),
.ikas-page.is-dark .ikas-panel-status.edit-request {
  background: rgba(245, 158, 11, 0.16) !important;
  border-color: rgba(251, 191, 36, 0.32) !important;
  color: #fbbf24 !important;
}

.ikas-page.is-dark :deep(.ikas-action-btn.validate) {
  background: rgba(34, 197, 94, 0.16) !important;
  border-color: rgba(74, 222, 128, 0.24) !important;
  color: #86efac !important;
}

.ikas-page.is-dark :deep(.ikas-action-btn.approve) {
  background: rgba(59, 130, 246, 0.16) !important;
  border-color: rgba(96, 165, 250, 0.28) !important;
  color: #93c5fd !important;
}

.ikas-page.is-dark :deep(.ikas-action-btn.reject) {
  background: rgba(239, 68, 68, 0.16) !important;
  border-color: rgba(248, 113, 113, 0.28) !important;
  color: #fca5a5 !important;
}

.ikas-page.is-dark .ikas-action-error {
  background: rgba(127, 29, 29, 0.34) !important;
  border-color: rgba(248, 113, 113, 0.3) !important;
  color: #fecaca !important;
}

.ikas-page.is-dark .ikas-confirm-backdrop {
  color-scheme: dark;
}

.ikas-page.is-dark .ikas-confirm-backdrop {
  background: rgba(2, 6, 23, 0.72) !important;
}

.ikas-page.is-dark .ikas-confirm-backdrop .ikas-confirm-modal {
  background: #101827 !important;
  border-color: var(--ikas-border) !important;
  box-shadow: 0 28px 70px rgba(0, 0, 0, 0.54) !important;
}

.ikas-page.is-dark .ikas-confirm-backdrop .ikas-confirm-close,
.ikas-page.is-dark .ikas-confirm-backdrop .ikas-confirm-record,
.ikas-page.is-dark .ikas-confirm-backdrop .ikas-confirm-record strong,
.ikas-page.is-dark .ikas-confirm-backdrop .ikas-confirm-reason,
.ikas-page.is-dark .ikas-confirm-backdrop .ikas-reject-field,
.ikas-page.is-dark .ikas-confirm-backdrop .ikas-reject-field textarea,
.ikas-page.is-dark .ikas-confirm-backdrop .ikas-confirm-secondary {
  background: #0f172a !important;
  border-color: var(--ikas-border) !important;
  color: var(--ikas-text) !important;
}

.ikas-page.is-dark .ikas-confirm-backdrop .ikas-confirm-copy h3,
.ikas-page.is-dark .ikas-confirm-backdrop .ikas-confirm-record span,
.ikas-page.is-dark .ikas-confirm-backdrop .ikas-confirm-reason p {
  color: var(--ikas-text) !important;
}

.ikas-page.is-dark .ikas-confirm-backdrop .ikas-confirm-copy p,
.ikas-page.is-dark .ikas-confirm-backdrop .ikas-confirm-reason span,
.ikas-page.is-dark .ikas-confirm-backdrop .ikas-reject-field span {
  color: var(--ikas-muted) !important;
}

/* Final dark-mode skin: keep this after the dense light-theme passes above. */
.ikas-page.is-dark,
:global(html[data-theme-mode="dark"]) .ikas-page,
:global(html.dark) .ikas-page {
  --ikas-blue: #60a5fa;
  --ikas-blue-dark: #93c5fd;
  --ikas-border: rgba(148, 163, 184, 0.22);
  --ikas-muted: #9aa8bc;
  --ikas-text: #e8eef8;
  --ikas-surface: #101827;
  --ikas-page-bg: #08111f;
  --ikas-soft: #0f1b2e;
  --ikas-dark-panel: #101827;
  --ikas-dark-panel-2: #0f172a;
  --ikas-dark-panel-3: #111c2e;
  background:
    radial-gradient(circle at 10% 0%, rgba(37, 99, 235, 0.14), transparent 34%),
    radial-gradient(circle at 90% 6%, rgba(14, 165, 233, 0.1), transparent 32%),
    var(--ikas-page-bg) !important;
  color: var(--ikas-text) !important;
  color-scheme: dark;
}

.ikas-page.is-dark .ikas-filter-shell,
.ikas-page.is-dark .ikas-list-shell,
.ikas-page.is-dark .ikas-detail-panel,
.ikas-page.is-dark .ikas-mobile-card,
.ikas-page.is-dark .ikas-domain-card,
.ikas-page.is-dark .ikas-panel-meta,
.ikas-page.is-dark .ikas-attention-card,
.ikas-page.is-dark .ikas-summary-sector,
.ikas-page.is-dark :deep(.ikas-filter-shell),
.ikas-page.is-dark :deep(.ikas-kpi-card),
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-filter-shell,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-list-shell,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-detail-panel,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-mobile-card,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-domain-card,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-panel-meta,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-attention-card,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-summary-sector,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-filter-shell),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-kpi-card),
:global(html.dark) .ikas-page .ikas-filter-shell,
:global(html.dark) .ikas-page .ikas-list-shell,
:global(html.dark) .ikas-page .ikas-detail-panel,
:global(html.dark) .ikas-page .ikas-mobile-card,
:global(html.dark) .ikas-page .ikas-domain-card,
:global(html.dark) .ikas-page .ikas-panel-meta,
:global(html.dark) .ikas-page .ikas-attention-card,
:global(html.dark) .ikas-page .ikas-summary-sector,
:global(html.dark) .ikas-page :deep(.ikas-filter-shell),
:global(html.dark) .ikas-page :deep(.ikas-kpi-card) {
  background: var(--ikas-dark-panel) !important;
  border-color: var(--ikas-border) !important;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.28) !important;
  color: var(--ikas-text) !important;
}

.ikas-page.is-dark .ikas-hero-header,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-hero-header,
:global(html.dark) .ikas-page .ikas-hero-header {
  background:
    linear-gradient(135deg, rgba(8, 17, 31, 0.96), rgba(16, 42, 86, 0.93) 50%, rgba(30, 64, 175, 0.86)),
    radial-gradient(circle at 16% 18%, rgba(96, 165, 250, 0.24), transparent 34%) !important;
  border-color: rgba(96, 165, 250, 0.22) !important;
  box-shadow: 0 20px 54px rgba(0, 0, 0, 0.38) !important;
}

.ikas-page.is-dark :deep(.ikas-filter-primary),
.ikas-page.is-dark :deep(.ikas-filter-fields),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-filter-primary),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-filter-fields),
:global(html.dark) .ikas-page :deep(.ikas-filter-primary),
:global(html.dark) .ikas-page :deep(.ikas-filter-fields) {
  background: var(--ikas-dark-panel-2) !important;
  border-color: var(--ikas-border) !important;
}

.ikas-page.is-dark .ikas-header-search,
.ikas-page.is-dark .ikas-search,
.ikas-page.is-dark .ikas-page-size,
.ikas-page.is-dark .ikas-pagination button,
.ikas-page.is-dark .ikas-panel-close,
.ikas-page.is-dark .ikas-card-title span,
.ikas-page.is-dark .ikas-summary-icon,
.ikas-page.is-dark .ikas-score-target,
.ikas-page.is-dark :deep(.ikas-search),
.ikas-page.is-dark :deep(.ikas-field),
.ikas-page.is-dark :deep(.ikas-field select),
.ikas-page.is-dark :deep(.ikas-filter-toggle),
.ikas-page.is-dark :deep(.ikas-clear-btn),
.ikas-page.is-dark :deep(.ikas-row-action),
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-header-search,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-search,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-page-size,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-pagination button,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-panel-close,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-card-title span,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-summary-icon,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-score-target,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-search),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-field),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-field select),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-filter-toggle),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-clear-btn),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-row-action),
:global(html.dark) .ikas-page .ikas-header-search,
:global(html.dark) .ikas-page .ikas-search,
:global(html.dark) .ikas-page .ikas-page-size,
:global(html.dark) .ikas-page .ikas-pagination button,
:global(html.dark) .ikas-page .ikas-panel-close,
:global(html.dark) .ikas-page .ikas-card-title span,
:global(html.dark) .ikas-page .ikas-summary-icon,
:global(html.dark) .ikas-page .ikas-score-target,
:global(html.dark) .ikas-page :deep(.ikas-search),
:global(html.dark) .ikas-page :deep(.ikas-field),
:global(html.dark) .ikas-page :deep(.ikas-field select),
:global(html.dark) .ikas-page :deep(.ikas-filter-toggle),
:global(html.dark) .ikas-page :deep(.ikas-clear-btn),
:global(html.dark) .ikas-page :deep(.ikas-row-action) {
  background: var(--ikas-dark-panel-2) !important;
  border-color: var(--ikas-border) !important;
  color: var(--ikas-muted) !important;
  box-shadow: none !important;
}

.ikas-page.is-dark input,
.ikas-page.is-dark select,
.ikas-page.is-dark textarea,
.ikas-page.is-dark :deep(input),
.ikas-page.is-dark :deep(select),
.ikas-page.is-dark :deep(textarea),
:global(html[data-theme-mode="dark"]) .ikas-page input,
:global(html[data-theme-mode="dark"]) .ikas-page select,
:global(html[data-theme-mode="dark"]) .ikas-page textarea,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(input),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(select),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(textarea),
:global(html.dark) .ikas-page input,
:global(html.dark) .ikas-page select,
:global(html.dark) .ikas-page textarea,
:global(html.dark) .ikas-page :deep(input),
:global(html.dark) .ikas-page :deep(select),
:global(html.dark) .ikas-page :deep(textarea) {
  background: transparent !important;
  color: var(--ikas-text) !important;
}

.ikas-page.is-dark select option,
.ikas-page.is-dark :deep(select option),
:global(html[data-theme-mode="dark"]) .ikas-page select option,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(select option),
:global(html.dark) .ikas-page select option,
:global(html.dark) .ikas-page :deep(select option) {
  background: #0f172a !important;
  color: var(--ikas-text) !important;
}

.ikas-page.is-dark .ikas-list-header h2,
.ikas-page.is-dark .ikas-panel-hero h2,
.ikas-page.is-dark .ikas-summary-hero h2,
.ikas-page.is-dark .ikas-card-title h3,
.ikas-page.is-dark .ikas-domain-row strong,
.ikas-page.is-dark .ikas-panel-meta strong,
.ikas-page.is-dark .ikas-detail-facts strong,
.ikas-page.is-dark .ikas-detail-timeline strong,
.ikas-page.is-dark .ikas-attention-row strong,
.ikas-page.is-dark .ikas-summary-sector-row strong,
.ikas-page.is-dark .ikas-request-reason p,
.ikas-page.is-dark :deep(.ikas-kpi-value),
.ikas-page.is-dark :deep(.ikas-company strong),
.ikas-page.is-dark :deep(.ikas-updated strong),
.ikas-page.is-dark :deep(.ikas-filter-title-copy),
.ikas-page.is-dark :deep(.ikas-filter-title span),
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-list-header h2,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-panel-hero h2,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-summary-hero h2,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-card-title h3,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-domain-row strong,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-panel-meta strong,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-detail-facts strong,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-detail-timeline strong,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-attention-row strong,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-summary-sector-row strong,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-request-reason p,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-kpi-value),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-company strong),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-updated strong),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-filter-title-copy),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-filter-title span),
:global(html.dark) .ikas-page .ikas-list-header h2,
:global(html.dark) .ikas-page .ikas-panel-hero h2,
:global(html.dark) .ikas-page .ikas-summary-hero h2,
:global(html.dark) .ikas-page .ikas-card-title h3,
:global(html.dark) .ikas-page .ikas-domain-row strong,
:global(html.dark) .ikas-page .ikas-panel-meta strong,
:global(html.dark) .ikas-page .ikas-detail-facts strong,
:global(html.dark) .ikas-page .ikas-detail-timeline strong,
:global(html.dark) .ikas-page .ikas-attention-row strong,
:global(html.dark) .ikas-page .ikas-summary-sector-row strong,
:global(html.dark) .ikas-page .ikas-request-reason p,
:global(html.dark) .ikas-page :deep(.ikas-kpi-value),
:global(html.dark) .ikas-page :deep(.ikas-company strong),
:global(html.dark) .ikas-page :deep(.ikas-updated strong),
:global(html.dark) .ikas-page :deep(.ikas-filter-title-copy),
:global(html.dark) .ikas-page :deep(.ikas-filter-title span) {
  color: var(--ikas-text) !important;
}

.ikas-page.is-dark .ikas-list-header p,
.ikas-page.is-dark .ikas-panel-hero p,
.ikas-page.is-dark .ikas-summary-hero p,
.ikas-page.is-dark .ikas-domain-row span,
.ikas-page.is-dark .ikas-panel-meta span,
.ikas-page.is-dark .ikas-detail-facts span,
.ikas-page.is-dark .ikas-detail-timeline span,
.ikas-page.is-dark .ikas-attention-row span,
.ikas-page.is-dark .ikas-summary-sector-row span,
.ikas-page.is-dark .ikas-request-reason span,
.ikas-page.is-dark .ikas-card-title span,
.ikas-page.is-dark :deep(.ikas-kpi-label),
.ikas-page.is-dark :deep(.ikas-kpi-hint),
.ikas-page.is-dark :deep(.ikas-company small),
.ikas-page.is-dark :deep(.ikas-updated small),
.ikas-page.is-dark :deep(.ikas-score-caption),
.ikas-page.is-dark :deep(.ikas-filter-title small),
.ikas-page.is-dark :deep(.ikas-field span),
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-list-header p,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-panel-hero p,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-summary-hero p,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-domain-row span,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-panel-meta span,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-detail-facts span,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-detail-timeline span,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-attention-row span,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-summary-sector-row span,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-request-reason span,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-card-title span,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-kpi-label),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-kpi-hint),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-company small),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-updated small),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-score-caption),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-filter-title small),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-field span),
:global(html.dark) .ikas-page .ikas-list-header p,
:global(html.dark) .ikas-page .ikas-panel-hero p,
:global(html.dark) .ikas-page .ikas-summary-hero p,
:global(html.dark) .ikas-page .ikas-domain-row span,
:global(html.dark) .ikas-page .ikas-panel-meta span,
:global(html.dark) .ikas-page .ikas-detail-facts span,
:global(html.dark) .ikas-page .ikas-detail-timeline span,
:global(html.dark) .ikas-page .ikas-attention-row span,
:global(html.dark) .ikas-page .ikas-summary-sector-row span,
:global(html.dark) .ikas-page .ikas-request-reason span,
:global(html.dark) .ikas-page .ikas-card-title span,
:global(html.dark) .ikas-page :deep(.ikas-kpi-label),
:global(html.dark) .ikas-page :deep(.ikas-kpi-hint),
:global(html.dark) .ikas-page :deep(.ikas-company small),
:global(html.dark) .ikas-page :deep(.ikas-updated small),
:global(html.dark) .ikas-page :deep(.ikas-score-caption),
:global(html.dark) .ikas-page :deep(.ikas-filter-title small),
:global(html.dark) .ikas-page :deep(.ikas-field span) {
  color: var(--ikas-muted) !important;
}

.ikas-page.is-dark .ikas-table th,
.ikas-page.is-dark :deep(.ikas-table th),
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-table th,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-table th),
:global(html.dark) .ikas-page .ikas-table th,
:global(html.dark) .ikas-page :deep(.ikas-table th) {
  color: #8fa0b8 !important;
}

.ikas-page.is-dark :deep(.ikas-table-row td),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-table-row td),
:global(html.dark) .ikas-page :deep(.ikas-table-row td) {
  background: #111c2e !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
  color: var(--ikas-text) !important;
}

.ikas-page.is-dark :deep(.ikas-table-row:hover td),
.ikas-page.is-dark :deep(.ikas-table-row:focus-visible td),
.ikas-page.is-dark :deep(.ikas-table-row.is-selected td),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-table-row:hover td),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-table-row:focus-visible td),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-table-row.is-selected td),
:global(html.dark) .ikas-page :deep(.ikas-table-row:hover td),
:global(html.dark) .ikas-page :deep(.ikas-table-row:focus-visible td),
:global(html.dark) .ikas-page :deep(.ikas-table-row.is-selected td) {
  background: #17243a !important;
  border-color: rgba(96, 165, 250, 0.36) !important;
}

.ikas-page.is-dark .ikas-panel-hero,
.ikas-page.is-dark .ikas-summary-hero,
.ikas-page.is-dark .ikas-panel-score,
.ikas-page.is-dark .ikas-request-reason,
.ikas-page.is-dark .ikas-detail-panel .ikas-detail-actions,
.ikas-page.is-dark .ikas-detail-facts > div,
.ikas-page.is-dark .ikas-detail-timeline > div,
.ikas-page.is-dark .ikas-panel-meta > div,
.ikas-page.is-dark .ikas-attention-stat,
.ikas-page.is-dark .ikas-attention-row,
.ikas-page.is-dark .ikas-summary-sector-row,
.ikas-page.is-dark .ikas-summary-sector-row b,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-panel-hero,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-summary-hero,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-panel-score,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-request-reason,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-detail-panel .ikas-detail-actions,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-detail-facts > div,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-detail-timeline > div,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-panel-meta > div,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-attention-stat,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-attention-row,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-summary-sector-row,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-summary-sector-row b,
:global(html.dark) .ikas-page .ikas-panel-hero,
:global(html.dark) .ikas-page .ikas-summary-hero,
:global(html.dark) .ikas-page .ikas-panel-score,
:global(html.dark) .ikas-page .ikas-request-reason,
:global(html.dark) .ikas-page .ikas-detail-panel .ikas-detail-actions,
:global(html.dark) .ikas-page .ikas-detail-facts > div,
:global(html.dark) .ikas-page .ikas-detail-timeline > div,
:global(html.dark) .ikas-page .ikas-panel-meta > div,
:global(html.dark) .ikas-page .ikas-attention-stat,
:global(html.dark) .ikas-page .ikas-attention-row,
:global(html.dark) .ikas-page .ikas-summary-sector-row,
:global(html.dark) .ikas-page .ikas-summary-sector-row b {
  background: var(--ikas-dark-panel-2) !important;
  border-color: var(--ikas-border) !important;
  box-shadow: none !important;
  color: var(--ikas-text) !important;
}

.ikas-page.is-dark .ikas-domain-bar,
.ikas-page.is-dark :deep(.ikas-score-track),
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-domain-bar,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-score-track),
:global(html.dark) .ikas-page .ikas-domain-bar,
:global(html.dark) .ikas-page :deep(.ikas-score-track) {
  background: #25344b !important;
}

.ikas-page.is-dark :deep(.ikas-kpi-icon),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-kpi-icon),
:global(html.dark) .ikas-page :deep(.ikas-kpi-icon) {
  background: color-mix(in srgb, var(--accent) 18%, #0f172a) !important;
  color: color-mix(in srgb, var(--accent) 88%, #e0f2fe) !important;
}

.ikas-page.is-dark :deep(.ikas-score-badge),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-score-badge),
:global(html.dark) .ikas-page :deep(.ikas-score-badge) {
  background: color-mix(in srgb, var(--score-accent) 18%, #0f172a) !important;
  border-color: color-mix(in srgb, var(--score-accent) 30%, #334155) !important;
  color: color-mix(in srgb, var(--score-accent) 82%, #f8fafc) !important;
}

.ikas-page.is-dark :deep(.ikas-status.validated),
.ikas-page.is-dark .ikas-panel-status.validated,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-status.validated),
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-panel-status.validated,
:global(html.dark) .ikas-page :deep(.ikas-status.validated),
:global(html.dark) .ikas-page .ikas-panel-status.validated {
  background: rgba(34, 197, 94, 0.16) !important;
  border-color: rgba(74, 222, 128, 0.28) !important;
  color: #86efac !important;
}

.ikas-page.is-dark :deep(.ikas-status.draft),
.ikas-page.is-dark .ikas-panel-status.draft,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-status.draft),
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-panel-status.draft,
:global(html.dark) .ikas-page :deep(.ikas-status.draft),
:global(html.dark) .ikas-page .ikas-panel-status.draft {
  background: rgba(148, 163, 184, 0.14) !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
  color: #cbd5e1 !important;
}

.ikas-page.is-dark :deep(.ikas-status.edit-request),
.ikas-page.is-dark .ikas-panel-status.edit-request,
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-status.edit-request),
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-panel-status.edit-request,
:global(html.dark) .ikas-page :deep(.ikas-status.edit-request),
:global(html.dark) .ikas-page .ikas-panel-status.edit-request {
  background: rgba(245, 158, 11, 0.16) !important;
  border-color: rgba(251, 191, 36, 0.3) !important;
  color: #fbbf24 !important;
}

.ikas-page.is-dark :deep(.ikas-action-btn.validate),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-action-btn.validate),
:global(html.dark) .ikas-page :deep(.ikas-action-btn.validate) {
  background: rgba(34, 197, 94, 0.16) !important;
  border-color: rgba(74, 222, 128, 0.24) !important;
  color: #86efac !important;
}

.ikas-page.is-dark :deep(.ikas-action-btn.approve),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-action-btn.approve),
:global(html.dark) .ikas-page :deep(.ikas-action-btn.approve) {
  background: rgba(59, 130, 246, 0.16) !important;
  border-color: rgba(96, 165, 250, 0.28) !important;
  color: #93c5fd !important;
}

.ikas-page.is-dark :deep(.ikas-action-btn.reject),
:global(html[data-theme-mode="dark"]) .ikas-page :deep(.ikas-action-btn.reject),
:global(html.dark) .ikas-page :deep(.ikas-action-btn.reject) {
  background: rgba(239, 68, 68, 0.16) !important;
  border-color: rgba(248, 113, 113, 0.28) !important;
  color: #fca5a5 !important;
}

.ikas-page.is-dark .ikas-open-detail,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-open-detail,
:global(html.dark) .ikas-page .ikas-open-detail {
  background: #2563eb !important;
  border-color: #2563eb !important;
  color: #ffffff !important;
}

/* Responsive table cards */
.ikas-mobile-card {
  display: grid;
  gap: 14px;
  overflow: hidden;
}

.ikas-mobile-card-top {
  align-items: flex-start;
  display: grid;
  gap: 14px;
  grid-template-columns: auto minmax(0, 1fr);
  justify-content: initial;
}

.ikas-mobile-card .ikas-company,
.ikas-mobile-card :deep(.ikas-company) {
  align-items: flex-start;
  min-width: 0;
}

.ikas-mobile-card .ikas-company > div,
.ikas-mobile-card :deep(.ikas-company > div) {
  min-width: 0;
}

.ikas-mobile-card :deep(.ikas-company strong),
.ikas-mobile-card :deep(.ikas-company small) {
  max-width: none;
  white-space: normal;
}

.ikas-mobile-card :deep(.ikas-company small) {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.ikas-mobile-company-copy {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.ikas-mobile-company-copy strong {
  color: var(--ikas-text);
  display: block;
  font-size: 13px;
  font-weight: 850;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.ikas-mobile-company-copy small {
  color: var(--ikas-muted);
  display: -webkit-box;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.25;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.ikas-mobile-company-copy small span + span::before {
  content: " / ";
}

.ikas-mobile-company-copy :deep(.ikas-status) {
  justify-self: start;
  margin-top: 2px;
  min-width: 0;
}

.ikas-mobile-card-content {
  align-items: stretch;
  border-top: 1px solid rgba(219, 229, 243, 0.9);
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr);
  padding-top: 16px;
}

.ikas-mobile-score {
  grid-column: 1 / -1;
  margin-bottom: 6px;
  min-width: 0;
}

.ikas-mobile-card .ikas-score-cell,
.ikas-mobile-card :deep(.ikas-score-cell) {
  display: grid;
  gap: 7px;
  margin-top: 0;
  max-width: none;
  min-width: 0;
  width: 100%;
}

.ikas-mobile-card :deep(.ikas-score-track) {
  height: 5px;
  max-width: none;
}

.ikas-mobile-card :deep(.ikas-score-caption) {
  font-size: 10px;
  max-width: none;
}

.ikas-mobile-meta {
  align-items: center;
  display: grid;
  justify-content: start;
  margin-top: 8px;
  min-width: 0;
}

.ikas-mobile-meta span {
  line-height: 1.2;
}

.ikas-mobile-meta span:first-child {
  color: var(--ikas-text);
  font-size: 12px;
  font-weight: 850;
}

.ikas-mobile-actions {
  justify-self: stretch;
  margin-top: 10px;
  min-width: 0;
  width: 100%;
}

.ikas-page .ikas-mobile-card .ikas-mobile-score {
  margin-bottom: 10px;
}

.ikas-page .ikas-mobile-card .ikas-mobile-meta {
  margin-top: 10px;
}

.ikas-page .ikas-mobile-card .ikas-mobile-actions {
  margin-top: 12px;
}

.ikas-mobile-card :deep(.ikas-record-actions) {
  display: grid;
  gap: 6px;
  margin-inline: 0;
  max-width: none;
  min-width: 0;
  transform: none;
  width: 100%;
}

.ikas-mobile-card :deep(.ikas-record-actions.is-request-actions) {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-width: 0;
}

.ikas-mobile-card :deep(.ikas-action-btn) {
  min-height: 32px;
  padding-inline: 10px;
  width: 100%;
}

.ikas-mobile-card :deep(.ikas-action-btn.validate) {
  max-width: none;
}

.ikas-mobile-card :deep(.ikas-no-action) {
  align-items: center;
  background: #f8fafc;
  border: 1px solid #dbe5f3;
  border-radius: 999px;
  display: inline-flex;
  justify-content: center;
  min-height: 26px;
  padding: 0 12px;
  white-space: nowrap;
  width: 100%;
}

.ikas-page.is-dark .ikas-mobile-card-content,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-mobile-card-content,
:global(html.dark) .ikas-page .ikas-mobile-card-content {
  border-color: rgba(148, 163, 184, 0.2);
}

.ikas-page.is-dark .ikas-mobile-meta span:first-child,
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-mobile-meta span:first-child,
:global(html.dark) .ikas-page .ikas-mobile-meta span:first-child {
  color: var(--ikas-text) !important;
}

.ikas-page.is-dark .ikas-mobile-card :deep(.ikas-no-action),
:global(html[data-theme-mode="dark"]) .ikas-page .ikas-mobile-card :deep(.ikas-no-action),
:global(html.dark) .ikas-page .ikas-mobile-card :deep(.ikas-no-action) {
  background: var(--ikas-dark-panel-2) !important;
  border-color: var(--ikas-border) !important;
  color: var(--ikas-muted) !important;
}

@media (max-width: 1400px) {
  .ikas-content-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .ikas-detail-panel {
    top: auto;
  }
}

@media (max-width: 1100px) {
  .ikas-page :deep(.ikas-filter-primary) {
    grid-template-columns: 1fr;
    grid-template-areas:
      "title"
      "search"
      "actions";
  }

  .ikas-page :deep(.ikas-filter-actions) {
    justify-content: stretch;
    width: 100%;
  }

  .ikas-page :deep(.ikas-filter-actions button) {
    flex: 1;
  }

  .ikas-page :deep(.ikas-filter-fields) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 992px) {
  .ikas-hero-header {
    align-items: stretch;
    flex-direction: column;
    padding: 18px;
    min-height: 0;
  }

  .ikas-hero-tools {
    flex-basis: auto;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
  }

  .ikas-hero-tools.ikas-stakeholder-summary {
    align-self: stretch;
    flex: 0 1 auto;
    max-width: none;
    width: 100%;
  }

  .ikas-hero-stakeholder-card {
    min-height: 0;
  }
}

@media (max-width: 768px) {
  .ikas-hero-header {
    border-radius: 8px;
    gap: 14px;
    padding: 16px;
  }

  .ikas-hero-copy h1 {
    font-size: 26px;
  }

  .ikas-hero-tools {
    flex: 0 1 auto;
    grid-template-columns: 1fr;
  }

  .ikas-hero-tools.ikas-stakeholder-summary {
    flex: 0 1 auto;
  }

  .ikas-hero-stat {
    min-height: 72px;
  }

  .ikas-page :deep(.ikas-filter-fields) {
    display: none;
    grid-template-columns: 1fr;
  }

  .ikas-page :deep(.ikas-filter-fields.is-open) {
    display: grid;
  }

  .ikas-page :deep(.ikas-clear-btn) {
    min-height: 44px;
  }

  .ikas-list-header {
    align-items: stretch;
    display: grid;
    gap: 12px;
  }

  .ikas-page-size {
    justify-content: space-between;
    width: 100%;
  }

  .ikas-mobile-card {
    border-radius: 12px;
    gap: 12px;
    padding: 14px;
  }

  .ikas-mobile-card-top {
    align-items: flex-start;
    gap: 10px;
    grid-template-columns: auto minmax(0, 1fr);
  }

  .ikas-mobile-company-copy :deep(.ikas-status) {
    justify-self: start;
  }

  .ikas-mobile-card-content {
    align-items: stretch;
    gap: 22px;
    grid-template-columns: 1fr;
    padding-top: 16px;
  }

  .ikas-mobile-card :deep(.ikas-score-track),
  .ikas-mobile-card :deep(.ikas-score-caption) {
    max-width: none;
  }

  .ikas-mobile-card :deep(.ikas-score-summary) {
    margin-bottom: 0;
  }

  .ikas-mobile-score,
  .ikas-page .ikas-mobile-card .ikas-mobile-score {
    margin-bottom: 12px;
  }

  .ikas-mobile-meta,
  .ikas-page .ikas-mobile-card .ikas-mobile-meta {
    margin-top: 12px;
  }

  .ikas-mobile-actions {
    justify-self: stretch;
    margin-top: 14px;
    width: 100%;
  }

  .ikas-page .ikas-mobile-card .ikas-mobile-actions {
    margin-top: 14px;
  }

  .ikas-mobile-card :deep(.ikas-record-actions),
  .ikas-mobile-card :deep(.ikas-record-actions:not(.is-request-actions)) {
    grid-template-columns: 1fr;
    min-width: 0;
    width: 100%;
  }

  .ikas-mobile-card :deep(.ikas-record-actions.is-request-actions) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    min-width: 0;
    width: 100%;
  }

  .ikas-mobile-card :deep(.ikas-action-btn) {
    font-size: 11px;
    overflow: hidden;
  }

  .ikas-mobile-card :deep(.ikas-action-btn span) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ikas-mobile-card :deep(.ikas-no-action) {
    min-width: 0;
    width: 100%;
  }

  .ikas-list-shell,
  .ikas-detail-panel {
    padding: 14px;
  }

  .ikas-panel-hero {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .ikas-panel-status {
    grid-column: 1 / -1;
    justify-self: start;
  }
}

@media (max-width: 360px) {
  .ikas-list-shell {
    padding-inline: 12px;
  }

  .ikas-mobile-card :deep(.ikas-record-actions.is-request-actions) {
    width: 100%;
  }

  .ikas-mobile-card :deep(.ikas-no-action) {
    min-width: 0;
    width: 100%;
  }
}

/* Final header sizing + GSAP-friendly motion targets */
.ikas-hero-copy h1 {
  font-size: 24px;
  font-weight: 820;
  line-height: 1.12;
}

.ikas-hero-copy p {
  font-size: 13px;
  line-height: 1.5;
  max-width: 660px;
}

.ikas-list-header h2 {
  font-size: 15px;
  line-height: 1.2;
}

.ikas-list-header p {
  font-size: 12px;
  line-height: 1.35;
}

.ikas-page {
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.ikas-attention-card .ikas-card-title,
.ikas-summary-sector .ikas-card-title {
  align-items: center;
  margin-bottom: 10px;
}

.ikas-attention-card .ikas-card-title h3,
.ikas-summary-sector .ikas-card-title h3 {
  color: var(--ikas-text);
  font-size: 15px;
  font-weight: 850;
  line-height: 1.2;
  margin: 0;
}

.ikas-attention-card .ikas-card-title span,
.ikas-summary-sector .ikas-card-title span {
  flex: 0 0 auto;
  font-size: 9.5px;
  padding: 5px 7px;
}

@media (max-width: 768px) {
  .ikas-hero-copy h1 {
    font-size: 22px;
  }

  .ikas-hero-copy p {
    font-size: 12.5px;
  }

  .ikas-list-header h2 {
    font-size: 14px;
  }
}
</style>
