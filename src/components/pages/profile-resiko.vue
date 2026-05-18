<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { useResikoStore } from '@/stores/resiko';
import { useAuthStore } from '@/stores/auth';
import Pageheader from '@/shared/components/pageheader/pageheader.vue';

const router = useRouter();
const currentRoute = useRoute();
const stakeholdersStore = useStakeholdersStore();
const resikoStore = useResikoStore();
const authStore = useAuthStore();
const isDarkMode = ref(false);
let themeObserver: MutationObserver | null = null;

const currentSlug = computed(() => String(currentRoute.query.slug || ''));
const queryRespondentId = computed(() => String(
  currentRoute.query.respondentId ||
  currentRoute.query.id_responden ||
  currentRoute.query.responden_id ||
  ''
));
const isAdmin = computed(() => authStore.isAdmin);

const currentStakeholder = computed(() => {
  if (!currentSlug.value) return null;
  return stakeholdersStore.getStakeholderBySlug(currentSlug.value);
});

const currentResult = computed(() => (
  currentSlug.value ? resikoStore.surveyResultsMap[currentSlug.value] : null
));

const respondent = computed(() => {
  const fromResult = currentResult.value?.respondent;
  if (fromResult) return fromResult;
  const companyId = currentStakeholder.value?.id;
  if (!companyId) return null;
  return resikoStore.respondentsByCompanyId[String(companyId)]?.[0] || null;
});

const riskPayload = computed(() => currentResult.value?.raw?.riskPayload || null);
const riskError = computed(() => currentResult.value?.raw?.riskError || null);

const parseMaybeJson = (value: any): any => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const unwrapRiskData = computed(() => {
  const payload = riskPayload.value;
  if (!payload || typeof payload !== 'object') return null;
  return parseMaybeJson(payload.data ?? payload);
});

const pickFirstArray = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];

  const keys = [
    'risiko',
    'risikos',
    'risks',
    'risk',
    'hasil',
    'results',
    'survey_risiko',
    'surveyRisiko',
    'jawaban',
    'responses',
    'items',
    'data',
  ];

  for (const key of keys) {
    const candidate = parseMaybeJson(value[key]);
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
};

const readPath = (source: any, path: string): any => {
  if (!source || !path) return undefined;
  return path.split('.').reduce((acc: any, part: string) => (acc && acc[part] !== undefined ? acc[part] : undefined), source);
};

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const findNestedValue = (source: any, keys: string[], depth = 0, seen = new Set<any>()): any => {
  if (!source || typeof source !== 'object' || depth > 4 || seen.has(source)) return undefined;
  seen.add(source);

  const normalizedKeys = keys.map(normalizeKey);
  for (const [key, value] of Object.entries(source)) {
    if (normalizedKeys.includes(normalizeKey(key)) && value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  for (const value of Object.values(source)) {
    const nested = findNestedValue(value, keys, depth + 1, seen);
    if (nested !== undefined && nested !== null && nested !== '') return nested;
  }

  return undefined;
};

const valueOf = (row: any, keys: string[], fallback = '-') => {
  for (const key of keys) {
    const value = readPath(row, key) ?? readPath(row?.master_risiko, key);
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  const nestedValue = findNestedValue(row, keys);
  if (nestedValue !== undefined && nestedValue !== null && nestedValue !== '') return String(nestedValue);
  return fallback;
};

const parsedRiskRows = computed(() => {
  const fromStore = currentResult.value?.risks || [];
  const fromPayload = pickFirstArray(unwrapRiskData.value);
  return fromStore.length ? fromStore : fromPayload;
});

const isFilled = (value: any) => value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== '-';

const answerOf = (row: any, keys: string[], fallback = '') => valueOf(row, keys, fallback);

const booleanOf = (value: any): boolean | null => {
  if (!isFilled(value)) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const text = String(value).trim().toLowerCase();
  if (['false', '0', 'tidak', 'no', 'n', 'belum', 'none', 'null'].includes(text) || text.includes('tidak')) return false;
  if (['true', '1', 'ya', 'yes', 'y', 'ada', 'pernah', 'sudah', 'terjadi'].includes(text) || text.includes('pernah')) return true;
  return null;
};

const formatOccurrence = (value: any) => {
  const parsed = booleanOf(value);
  if (parsed === true) return 'Pernah Terjadi';
  if (parsed === false) return 'Tidak Pernah';
  return 'Belum Dijawab';
};

const formatControl = (value: any) => {
  const parsed = booleanOf(value);
  if (parsed === true) return 'Ada';
  if (parsed === false) return 'Tidak Ada';
  return 'Belum Dijawab';
};

const joinFilled = (items: string[]) => items.filter(isFilled).join(', ') || '-';

const getImpactSummary = (row: any) => {
  const impacts = [
    ['Reputasi', answerOf(row, ['dampak_reputasi', 'dampakReputasi', 'reputasi', 'risiko_dampak_reputasi', 'risiko_dampak.dampak_reputasi'])],
    ['Operasional', answerOf(row, ['dampak_operasional', 'dampakOperasional', 'operasional', 'risiko_dampak_operasional', 'risiko_dampak.dampak_operasional'])],
    ['Finansial', answerOf(row, ['dampak_finansial', 'dampakFinansial', 'finansial', 'risiko_dampak_finansial', 'risiko_dampak.dampak_finansial'])],
    ['Hukum', answerOf(row, ['dampak_hukum', 'dampakHukum', 'hukum', 'risiko_dampak_hukum', 'risiko_dampak.dampak_hukum'])],
  ]
    .filter(([, value]) => isFilled(value))
    .map(([label, value]) => `${label}: ${value}`);

  return impacts.join(' | ') || answerOf(row, ['dampak', 'impact', 'nilai_dampak', 'level_dampak'], '-');
};

const riskRows = computed(() => parsedRiskRows.value.map((row: any, index: number) => {
  const occurredValue = answerOf(row, ['pernah_terjadi', 'pernahTerjadi', 'is_pernah_terjadi', 'eligibility', 'eligibility_pernah_terjadi', 'risiko_eligibility.pernah_terjadi']);
  const controlValue = answerOf(row, ['ada_pengendalian', 'adaPengendalian', 'has_control', 'pengendalian', 'pengendalian_ada', 'risiko_pengendalian.ada_pengendalian']);
  const reason = answerOf(row, ['alasan', 'alasan_tidak_terjadi', 'alasanTidakTerjadi', 'reason', 'risiko_alasan_alasan', 'risiko_alasan.alasan'], '-');
  const frequency = answerOf(row, ['frekuensi', 'frequency', 'dampak_frekuensi', 'risiko_dampak_frekuensi', 'risiko_dampak.frekuensi'], '-');
  const controlDescription = answerOf(row, ['deskripsi_pengendalian', 'deskripsiPengendalian', 'control_description', 'pengendalian_deskripsi', 'risiko_pengendalian_deskripsi', 'risiko_pengendalian.deskripsi_pengendalian'], '-');
  const impact = getImpactSummary(row);
  const hasAssessment = [occurredValue, reason, impact, frequency, controlValue, controlDescription].some(isFilled);

  return {
    id: row?.id || row?.kode || `risk-${index}`,
    asset: valueOf(row, ['aset', 'asset', 'nama_aset', 'namaAset', 'aset_terdampak', 'asetTerdampak', 'jenis_aset', 'jenisAset', 'kategori_aset', 'kategoriAset', 'objek', 'komponen', 'kategori', 'nama_kategori', 'namaKategori', 'kelompok', 'kelompok_risiko', 'master_risiko.aset', 'master_risiko.nama_aset', 'master_risiko.namaAset', 'master_risiko.kategori', 'master_risiko.nama_kategori'], `Risiko ${index + 1}`),
    description: valueOf(row, ['deskripsi_risiko', 'deskripsiRisiko', 'deskripsi', 'nama_risiko', 'namaRisiko', 'risiko', 'risk', 'ancaman', 'kerentanan', 'pertanyaan', 'master_risiko.deskripsi', 'master_risiko.nama_risiko', 'master_risiko.namaRisiko', 'master_risiko.pertanyaan']),
    occurred: formatOccurrence(occurredValue),
    occurredClass: booleanOf(occurredValue) === true ? 'is-complete' : (booleanOf(occurredValue) === false ? 'is-pending' : ''),
    reason,
    impact,
    frequency,
    control: formatControl(controlValue),
    controlClass: booleanOf(controlValue) === true ? 'is-complete' : (booleanOf(controlValue) === false ? 'is-pending' : ''),
    controlDescription,
    answerSummary: booleanOf(occurredValue) === false ? reason : joinFilled([impact, frequency !== '-' ? `Frekuensi: ${frequency}` : '']),
    status: hasAssessment ? 'Terisi' : 'Belum Terisi',
  };
}));

const rawRiskText = computed(() => {
  const data = riskPayload.value?.data;
  if (typeof data === 'string') return data;
  if (data !== undefined && data !== null) return JSON.stringify(data, null, 2);
  if (riskError.value) return JSON.stringify(riskError.value, null, 2);
  if (riskPayload.value) return JSON.stringify(riskPayload.value, null, 2);
  return '';
});

const surveyStatus = computed(() => {
  if (!respondent.value) return 'Belum Ada Responden';
  if (riskPayload.value?.success === false || riskError.value) return 'Gagal Memuat Risiko';
  if (riskRows.value.length || rawRiskText.value) return 'Lengkap';
  return 'Responden Terekam';
});

const statusClass = computed(() => {
  if (surveyStatus.value === 'Lengkap') return 'is-complete';
  if (surveyStatus.value.includes('Gagal')) return 'is-error';
  return 'is-pending';
});

const riskLevels = computed(() => [
  { label: 'Total Risiko', count: riskRows.value.length },
  { label: 'Pernah Terjadi', count: riskRows.value.filter((row) => row.occurred === 'Pernah Terjadi').length },
  { label: 'Tidak Pernah', count: riskRows.value.filter((row) => row.occurred === 'Tidak Pernah').length },
  { label: 'Ada Pengendalian', count: riskRows.value.filter((row) => row.control === 'Ada').length },
]);

const respondentFields = computed(() => [
  { icon: 'ri-user-3-line', label: 'Nama Lengkap', value: respondent.value?.nama_lengkap || '-' },
  { icon: 'ri-briefcase-4-line', label: 'Jabatan', value: respondent.value?.jabatan || '-' },
  { icon: 'ri-mail-line', label: 'Email', value: respondent.value?.email || '-' },
  { icon: 'ri-phone-line', label: 'No. Telepon', value: respondent.value?.no_telepon || '-' },
  { icon: 'ri-building-4-line', label: 'Nama Perusahaan', value: respondent.value?.nama_perusahaan || currentStakeholder.value?.nama_perusahaan || '-' },
  { icon: 'ri-node-tree', label: 'Sektor', value: respondent.value?.nama_sektor || '-' },
  { icon: 'ri-git-branch-line', label: 'Sub Sektor', value: respondent.value?.nama_sub_sektor || '-' },
  { icon: 'ri-award-line', label: 'Sertifikat Training', value: respondent.value?.sertifikat_training || '-' },
  { icon: 'ri-calendar-check-line', label: 'Dibuat', value: formatDate(respondent.value?.created_at) },
  { icon: 'ri-refresh-line', label: 'Diperbarui', value: formatDate(respondent.value?.updated_at) },
]);

const loadSurveyResult = async () => {
  if (!currentSlug.value) return;

  if (!stakeholdersStore.initialized) {
    await stakeholdersStore.initialize();
  }

  resikoStore.initialize();
  resikoStore.setCurrentStakeholder(currentSlug.value);

  if (queryRespondentId.value) {
    await resikoStore.loadSurveyResultByRespondent(queryRespondentId.value, currentSlug.value);
    return;
  }

  const stakeholder = currentStakeholder.value;
  if (stakeholder?.id) {
    await resikoStore.loadSurveyResultByCompany(stakeholder.id, currentSlug.value, stakeholder.nama_perusahaan || '');
  }
};

const syncThemeMode = () => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;
  isDarkMode.value = (
    root.getAttribute('data-theme-mode') === 'dark' ||
    body?.getAttribute('data-theme-mode') === 'dark' ||
    root.classList.contains('dark') ||
    body?.classList.contains('dark') ||
    body?.classList.contains('dark-mode')
  );
};

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const dataToPass = computed(() => {
  const stakeholderName = currentStakeholder.value?.nama_perusahaan || respondent.value?.nama_perusahaan || 'Stakeholder';
  return {
    title: { label: `Profile ${stakeholderName}`, path: currentSlug.value ? `/stakeholders/${currentSlug.value}` : '/stakeholders' },
    currentpage: 'Manajemen Risiko',
    activepage: 'Profile Risiko',
  };
});

onMounted(() => {
  loadSurveyResult();
  syncThemeMode();

  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    themeObserver = new MutationObserver(syncThemeMode);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme-mode', 'class'],
    });
    if (document.body) {
      themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['data-theme-mode', 'class'],
      });
    }
  }
});

onBeforeUnmount(() => {
  themeObserver?.disconnect();
  themeObserver = null;
});

watch([currentSlug, queryRespondentId], loadSurveyResult);
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <section class="risk-page" :class="{ 'is-dark': isDarkMode }" style="padding-bottom: 1.5rem;">
    <div class="risk-shell" style="overflow: hidden; border: 1px solid #dbe5f2; border-radius: 12px; background: #ffffff; box-shadow: 0 16px 38px rgba(15, 23, 42, 0.08);">
      <div class="risk-hero" style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.25rem 1.5rem; color: #ffffff; background: linear-gradient(135deg, #172f9f 0%, #2f7df6 100%);">
        <div class="risk-hero-left" style="display: flex; align-items: center; gap: 1rem;">
          <span class="risk-hero-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 10px; background: rgba(255,255,255,.14); font-size: 1.35rem;"><i class="ri-shield-check-fill"></i></span>
          <div>
            <h2 style="margin: 0; font-size: 1.05rem; font-weight: 900;">Survey Manajemen Risiko</h2>
            <p style="margin: .25rem 0 0; color: rgba(255,255,255,.72); font-size: .78rem; font-weight: 700;">{{ respondent?.nama_perusahaan || currentStakeholder?.nama_perusahaan || '-' }}</p>
          </div>
        </div>
        <div class="risk-hero-right" style="display: flex; align-items: center; gap: 1rem;">
          <div class="risk-status" :class="statusClass" style="min-width: 170px; padding-right: 1rem; border-right: 1px solid rgba(255,255,255,.18); text-align: right;">
            <span style="display: block; color: rgba(255,255,255,.72); font-size: .65rem; font-weight: 900; text-transform: uppercase;">Status Survey</span>
            <strong style="display: block; margin-top: .2rem; font-size: 1rem; font-weight: 950;">{{ surveyStatus }}</strong>
          </div>
          <button
            v-if="!isAdmin"
            type="button"
            class="risk-action"
            style="display: inline-flex; align-items: center; justify-content: center; gap: .45rem; min-height: 38px; padding: 0 1.15rem; border: 0; border-radius: 8px; color: #12315f; background: #ffffff; font-weight: 850; box-shadow: 0 10px 22px rgba(15,23,42,.12);"
            @click="router.push({ path: '/survey-resiko', query: { slug: currentSlug } })"
          >
            <i class="ri-edit-2-line"></i>
            Update Survey
          </button>
          <span v-else class="risk-action is-readonly" style="display: inline-flex; align-items: center; justify-content: center; gap: .45rem; min-height: 38px; padding: 0 1.15rem; border: 0; border-radius: 8px; color: #12315f; background: #ffffff; font-weight: 850; box-shadow: 0 10px 22px rgba(15,23,42,.12);">
            <i class="ri-eye-line"></i>
            Mode Lihat Hasil
          </span>
        </div>
      </div>

      <div class="risk-body" style="padding: 1.5rem;">
        <div class="risk-level-grid" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; margin-bottom: 1rem;">
          <div v-for="(level, index) in riskLevels" :key="level.label" class="risk-level-card" style="display: flex; align-items: center; gap: .85rem; min-height: 72px; padding: .9rem 1rem; border: 1px solid #dbe5f2; border-radius: 10px; background: #ffffff; box-shadow: 0 10px 24px rgba(15,23,42,.06);">
            <span class="risk-level-icon" :class="`level-${index}`" :style="{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '10px', color: '#fff', fontSize: '1.2rem', background: index < 2 ? '#f59e0b' : (index === 2 ? '#5b5ce2' : '#2563eb') }"><i class="ri-alert-line"></i></span>
            <div>
              <strong style="display: block; color: #1e3558; font-size: 1.35rem; line-height: 1; font-weight: 950;">{{ level.count }}</strong>
              <small style="display: block; margin-top: .25rem; color: #647895; font-size: .75rem; font-weight: 800;">{{ level.label }}</small>
            </div>
          </div>
        </div>

        <div class="risk-section" style="overflow: hidden; border: 1px solid #dbe5f2; border-radius: 10px; background: #ffffff;">
          <div class="risk-section-header" style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.15rem; border-bottom: 1px solid #dbe5f2; background: #f8fafc;">
            <div>
              <h3 style="margin: 0; color: #061b3a; font-size: .95rem; font-weight: 950;">Data Responden</h3>
              <p>Profil pengisi asesmen dan informasi organisasi.</p>
            </div>
            <span style="color: #2563eb; font-size: .75rem; font-weight: 900;">{{ respondent ? 'Terekam' : 'Belum Ada' }}</span>
          </div>
          <div v-if="resikoStore.surveyResultLoading && !respondent" class="risk-loading" style="display: flex; min-height: 150px; align-items: center; justify-content: center; padding: 1.5rem; color: #647895; text-align: center;">Memuat responden survey risiko...</div>
          <div v-else-if="!respondent" class="risk-empty" style="display: flex; min-height: 150px; flex-direction: column; align-items: center; justify-content: center; gap: .5rem; padding: 1.5rem; color: #647895; text-align: center;">
            <i class="ri-user-search-line"></i>
            <strong>Responden belum ditemukan</strong>
            <p>Belum ada data responden manajemen risiko untuk perusahaan ini.</p>
          </div>
          <div v-else class="respondent-grid" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .85rem; padding: 1rem;">
            <div v-for="field in respondentFields" :key="field.label" class="respondent-field" style="min-height: 70px; padding: .8rem; border: 1px solid #e7eef7; border-radius: 8px; background: #fbfdff;">
              <span class="respondent-icon"><i :class="field.icon"></i></span>
              <span class="respondent-copy">
                <span class="respondent-label" style="display: block; color: #6b7f9c; font-size: .68rem; line-height: 1.2; font-weight: 900; text-transform: uppercase;">{{ field.label }}</span>
                <strong class="respondent-value" style="display: block; margin-top: .35rem; color: #10233f; font-size: .82rem; line-height: 1.35; font-weight: 850; overflow-wrap: anywhere;">{{ field.value }}</strong>
              </span>
            </div>
          </div>
        </div>

        <div class="risk-content-grid" style="display: grid; grid-template-columns: 1fr; gap: 1rem; margin-top: 1rem;">
          <div class="risk-section risk-table-section" style="overflow: hidden; border: 1px solid #dbe5f2; border-radius: 10px; background: #ffffff;">
            <div class="risk-section-header" style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.15rem; border-bottom: 1px solid #dbe5f2; background: #f8fafc;">
              <div>
                <h3 style="margin: 0; color: #061b3a; font-size: .95rem; font-weight: 950;">Data Risiko</h3>
                <p>Ringkasan jawaban asesmen untuk setiap risiko.</p>
              </div>
              <span style="color: #2563eb; font-size: .75rem; font-weight: 900;">{{ riskRows.length }} Baris</span>
            </div>

            <div v-if="resikoStore.surveyResultLoading" class="risk-loading" style="display: flex; min-height: 150px; align-items: center; justify-content: center; padding: 1.5rem; color: #647895; text-align: center;">Memuat hasil survey risiko...</div>
            <div v-else-if="resikoStore.surveyResultError" class="risk-empty is-error" style="display: flex; min-height: 150px; flex-direction: column; align-items: center; justify-content: center; gap: .5rem; padding: 1.5rem; color: #dc2626; text-align: center;">
              <i class="ri-error-warning-line"></i>
              <strong>Gagal memuat data</strong>
              <p>{{ resikoStore.surveyResultError }}</p>
            </div>
            <div v-else-if="riskRows.length" class="risk-table-wrap" style="overflow: auto;">
              <table class="risk-table" style="width: 100%; min-width: 1180px; border-collapse: collapse;">
                <thead>
                  <tr>
                    <th style="width: 120px; padding: .85rem 1rem; color: #34445f; background: #f3f6fa; border-bottom: 1px solid #dbe5f2; font-size: .68rem; font-weight: 950; text-transform: uppercase;">Risiko</th>
                    <th style="padding: .85rem 1rem; color: #34445f; background: #f3f6fa; border-bottom: 1px solid #dbe5f2; font-size: .68rem; font-weight: 950; text-transform: uppercase;">Deskripsi Risiko</th>
                    <th style="width: 145px; padding: .85rem 1rem; color: #34445f; background: #f3f6fa; border-bottom: 1px solid #dbe5f2; font-size: .68rem; font-weight: 950; text-transform: uppercase;">Pernah Terjadi</th>
                    <th style="width: 290px; padding: .85rem 1rem; color: #34445f; background: #f3f6fa; border-bottom: 1px solid #dbe5f2; font-size: .68rem; font-weight: 950; text-transform: uppercase;">Alasan / Dampak</th>
                    <th style="width: 115px; padding: .85rem 1rem; color: #34445f; background: #f3f6fa; border-bottom: 1px solid #dbe5f2; font-size: .68rem; font-weight: 950; text-transform: uppercase;">Frekuensi</th>
                    <th style="width: 260px; padding: .85rem 1rem; color: #34445f; background: #f3f6fa; border-bottom: 1px solid #dbe5f2; font-size: .68rem; font-weight: 950; text-transform: uppercase;">Pengendalian</th>
                    <th style="width: 105px; padding: .85rem 1rem; color: #34445f; background: #f3f6fa; border-bottom: 1px solid #dbe5f2; font-size: .68rem; font-weight: 950; text-transform: uppercase;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in riskRows" :key="row.id">
                    <td class="risk-name-cell" data-label="Risiko" style="padding: .9rem 1rem; color: #203653; border-bottom: 1px solid #edf2f7; font-size: .8rem; font-weight: 800; vertical-align: top;">
                      <span class="risk-name-text" style="display: block;">{{ row.asset }}</span>
                    </td>
                    <td data-label="Deskripsi" style="padding: .9rem 1rem; color: #203653; border-bottom: 1px solid #edf2f7; font-size: .8rem; font-weight: 700; vertical-align: top;">{{ row.description }}</td>
                    <td data-label="Pernah Terjadi" style="padding: .9rem 1rem; color: #203653; border-bottom: 1px solid #edf2f7; font-size: .8rem; font-weight: 700; vertical-align: top;">
                      <span class="risk-pill" :class="row.occurredClass">{{ row.occurred }}</span>
                    </td>
                    <td data-label="Alasan / Dampak" style="padding: .9rem 1rem; color: #203653; border-bottom: 1px solid #edf2f7; font-size: .8rem; font-weight: 700; vertical-align: top;">{{ row.answerSummary }}</td>
                    <td data-label="Frekuensi" style="padding: .9rem 1rem; color: #203653; border-bottom: 1px solid #edf2f7; font-size: .8rem; font-weight: 700; vertical-align: top;">{{ row.frequency }}</td>
                    <td data-label="Pengendalian" style="padding: .9rem 1rem; color: #203653; border-bottom: 1px solid #edf2f7; font-size: .8rem; font-weight: 700; vertical-align: top;">
                      <span class="risk-pill" :class="row.controlClass">{{ row.control }}</span>
                      <span style="display: block; margin-top: .45rem; color: #203653;">{{ row.controlDescription }}</span>
                    </td>
                    <td data-label="Status" style="padding: .9rem 1rem; color: #203653; border-bottom: 1px solid #edf2f7; font-size: .8rem; font-weight: 700; vertical-align: top;">
                      <span class="risk-status-chip" :class="{ 'is-complete': row.status === 'Terisi', 'is-pending': row.status !== 'Terisi' }">{{ row.status }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else-if="rawRiskText" class="risk-empty" style="display: flex; min-height: 150px; flex-direction: column; align-items: center; justify-content: center; gap: .5rem; padding: 1.5rem; color: #647895; text-align: center;">
              <i class="ri-file-warning-line"></i>
              <strong>Data risiko belum dapat ditampilkan</strong>
              <p>Hasil survey sudah diterima, tetapi formatnya belum sesuai untuk tabel risiko.</p>
            </div>
            <div v-else class="risk-empty" style="display: flex; min-height: 150px; flex-direction: column; align-items: center; justify-content: center; gap: .5rem; padding: 1.5rem; color: #647895; text-align: center;">
              <i class="ri-file-list-3-line"></i>
              <strong>Data risiko belum tersedia</strong>
              <p>Hasil survey risiko untuk responden ini belum tersedia.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.risk-page {
  padding-bottom: 1.5rem;
}

.risk-shell {
  overflow: hidden;
  border: 1px solid #dbe5f2;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.08);
}

.risk-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  color: #ffffff;
  background: linear-gradient(135deg, #172f9f 0%, #2f7df6 100%);
}

.risk-hero-left,
.risk-hero-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.risk-hero-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 1.35rem;
}

.risk-hero h2 {
  margin: 0;
  color: #ffffff !important;
  font-size: 1.05rem;
  font-weight: 900;
}

.risk-hero p {
  margin: 0.25rem 0 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.78rem;
  font-weight: 700;
}

.risk-status {
  min-width: 170px;
  padding-right: 1rem;
  border-right: 1px solid rgba(255, 255, 255, 0.18);
  text-align: right;
}

.risk-status span {
  display: block;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.65rem;
  font-weight: 900;
  text-transform: uppercase;
}

.risk-status strong {
  display: block;
  margin-top: 0.2rem;
  font-size: 1rem;
  font-weight: 950;
}

.risk-status.is-error strong {
  color: #fecaca;
}

.risk-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 38px;
  padding: 0 1.15rem;
  border: 0;
  border-radius: 8px;
  color: #12315f;
  background: #ffffff;
  font-weight: 850;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.12);
}

.risk-action.is-readonly {
  opacity: 0.95;
}

.risk-body {
  padding: 1.5rem;
}

.risk-level-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.risk-level-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-height: 72px;
  padding: 0.9rem 1rem;
  border: 1px solid #dbe5f2;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.risk-level-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  color: #ffffff;
  font-size: 1.2rem;
  background: #2563eb;
}

.risk-level-icon.level-0,
.risk-level-icon.level-1 {
  background: #f59e0b;
}

.risk-level-icon.level-2 {
  background: #5b5ce2;
}

.risk-level-card strong {
  display: block;
  color: #1e3558;
  font-size: 1.35rem;
  line-height: 1;
  font-weight: 950;
}

.risk-level-card small {
  display: block;
  margin-top: 0.25rem;
  color: #647895;
  font-size: 0.75rem;
  font-weight: 800;
}

.risk-section {
  overflow: hidden;
  border: 1px solid #dbe5f2;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.risk-section + .risk-section {
  margin-top: 1rem;
}

.risk-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.15rem;
  border-bottom: 1px solid #dbe5f2;
  background: linear-gradient(180deg, #fbfdff 0%, #f5f8fc 100%);
}

.risk-section-header h3 {
  margin: 0;
  color: #061b3a;
  font-size: 0.95rem;
  font-weight: 950;
}

.risk-section-header p {
  margin: 0.25rem 0 0;
  color: #647895;
  font-size: 0.72rem;
  font-weight: 700;
}

.risk-section-header > span {
  flex: 0 0 auto;
  color: #2563eb;
  font-size: 0.75rem;
  font-weight: 900;
}

.respondent-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
  padding: 1rem;
}

.respondent-field {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  min-height: 70px;
  padding: 0.8rem;
  border: 1px solid #e7eef7;
  border-radius: 8px;
  background: #fbfdff;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.respondent-field:hover {
  border-color: #bfd4f0;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.08);
  transform: translateY(-1px);
}

.respondent-icon {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 8px;
  color: #2563eb !important;
  background: #eaf3ff;
  font-size: 1rem !important;
}

.respondent-copy {
  display: block;
  min-width: 0;
}

.respondent-label {
  display: block;
  color: #6b7f9c;
  font-size: 0.68rem;
  line-height: 1.2;
  font-weight: 900;
  text-transform: uppercase;
}

.respondent-value {
  display: block;
  margin-top: 0.35rem;
  color: #10233f;
  font-size: 0.82rem;
  line-height: 1.35;
  font-weight: 850;
  overflow-wrap: anywhere;
}

.risk-content-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-top: 1rem;
}

.risk-table-wrap {
  overflow: auto;
  max-width: 100%;
  -webkit-overflow-scrolling: touch;
}

.risk-table {
  width: 100%;
  min-width: 1180px;
  border-collapse: separate !important;
  border-spacing: 0;
  table-layout: fixed;
}

.risk-table th {
  padding: 0.85rem 1rem;
  color: #34445f;
  background: #f3f7fc !important;
  border-bottom: 1px solid #dbe5f2;
  font-size: 0.68rem;
  font-weight: 950;
  text-transform: uppercase;
}

.risk-table tbody tr {
  transition: background 0.18s ease, box-shadow 0.18s ease;
}

.risk-table tbody tr:nth-child(even) td {
  background: #fbfdff !important;
}

.risk-table tbody tr:hover td {
  background: #f2f7ff !important;
}

.risk-table td {
  padding: 0.9rem 1rem;
  color: #203653;
  border-bottom: 1px solid #edf2f7;
  font-size: 0.8rem;
  font-weight: 700;
  vertical-align: top;
}

.risk-name-cell {
  position: relative;
  background: #f8fbff !important;
}

.risk-name-cell::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: #2f7df6;
}

.risk-name-text {
  color: #10233f !important;
  font-weight: 950 !important;
  line-height: 1.35;
}

.risk-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 0.6rem;
  border-radius: 999px;
  color: #0f3f62;
  background: #eaf3ff;
  font-size: 0.7rem;
  font-weight: 900;
}

.risk-status-chip {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 0.65rem;
  border-radius: 999px;
  color: #1e3a8a;
  background: #dbeafe;
  font-size: 0.7rem;
  font-weight: 950;
}

.risk-status-chip.is-complete {
  color: #14532d;
  background: #dcfce7;
}

.risk-status-chip.is-pending {
  color: #92400e;
  background: #fef3c7;
}

.risk-pill.is-complete {
  color: #14532d;
  background: #dcfce7;
}

.risk-pill.is-pending {
  color: #92400e;
  background: #fef3c7;
}

.risk-table td,
.risk-table th {
  overflow-wrap: anywhere;
}

.risk-table td span:not(.risk-pill) {
  overflow-wrap: anywhere;
}

.risk-loading,
.risk-empty {
  display: flex;
  min-height: 150px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  color: #647895;
  text-align: center;
}

.risk-empty i {
  color: #2563eb;
  font-size: 2rem;
}

.risk-empty strong {
  color: #10233f;
  font-weight: 950;
}

.risk-empty p {
  max-width: 360px;
  margin: 0;
  font-size: 0.8rem;
}

.risk-empty.is-error i,
.risk-empty.is-error p {
  color: #dc2626;
}

.risk-page.is-dark .risk-shell {
  color-scheme: dark;
  border-color: #24314f !important;
  background: #111827 !important;
  box-shadow: 0 16px 38px rgba(0, 0, 0, 0.28) !important;
}

.risk-page.is-dark .risk-body {
  background: #111827 !important;
}

.risk-page.is-dark .risk-level-card,
.risk-page.is-dark .risk-section,
.risk-page.is-dark .respondent-field {
  border-color: #2b395a !important;
  background: #172033 !important;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18) !important;
}

.risk-page.is-dark .respondent-icon {
  color: #bfdbfe !important;
  background: rgba(59, 130, 246, 0.18) !important;
}

.risk-page.is-dark .risk-section-header {
  border-color: #2b395a !important;
  background: #1d2940 !important;
}

.risk-page.is-dark .risk-section-header h3,
.risk-page.is-dark .risk-level-card strong,
.risk-page.is-dark .respondent-field strong,
.risk-page.is-dark .risk-empty strong {
  color: #f4f7fb !important;
}

.risk-page.is-dark .risk-level-card small,
.risk-page.is-dark .respondent-field span,
.risk-page.is-dark .risk-loading,
.risk-page.is-dark .risk-empty,
.risk-page.is-dark .risk-empty p {
  color: #a8b6d1 !important;
}

.risk-page.is-dark .respondent-icon {
  color: #bfdbfe !important;
}

.risk-page.is-dark .risk-section-header > span,
.risk-page.is-dark .risk-empty i {
  color: #69a2ff !important;
}

.risk-page.is-dark .risk-action {
  color: #dbeafe !important;
  background: rgba(219, 234, 254, 0.12) !important;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.22) !important;
}

.risk-page.is-dark .risk-table th {
  border-color: #2b395a !important;
  color: #c8d5ed !important;
  background: #1d2940 !important;
}

.risk-page.is-dark .risk-table td {
  border-color: #273653 !important;
  color: #d9e3f5 !important;
  background: #172033 !important;
}

.risk-page.is-dark .risk-table tbody tr:nth-child(even) td,
.risk-page.is-dark .risk-name-cell {
  background: #182338 !important;
}

.risk-page.is-dark .risk-table td span:not(.risk-pill) {
  color: #d9e3f5 !important;
}

.risk-page.is-dark .risk-table tbody tr:hover td {
  background: #1b2942 !important;
}

.risk-page.is-dark .risk-pill {
  color: #bfdbfe !important;
  background: rgba(59, 130, 246, 0.18) !important;
}

.risk-page.is-dark .risk-status-chip {
  color: #bfdbfe !important;
  background: rgba(59, 130, 246, 0.18) !important;
}

.risk-page.is-dark .risk-empty.is-error i,
.risk-page.is-dark .risk-empty.is-error p {
  color: #fca5a5 !important;
}

:global(html[data-theme-mode="dark"]) .risk-shell,
:global(html.dark) .risk-shell,
:global(.dark-mode) .risk-shell {
  color-scheme: dark;
  border-color: #24314f !important;
  background: #111827 !important;
  box-shadow: 0 16px 38px rgba(0, 0, 0, 0.28) !important;
}

:global(html[data-theme-mode="dark"]) .risk-body,
:global(html.dark) .risk-body,
:global(.dark-mode) .risk-body {
  background: #111827 !important;
}

:global(html[data-theme-mode="dark"]) .risk-level-card,
:global(html[data-theme-mode="dark"]) .risk-section,
:global(html[data-theme-mode="dark"]) .respondent-field,
:global(html.dark) .risk-level-card,
:global(html.dark) .risk-section,
:global(html.dark) .respondent-field,
:global(.dark-mode) .risk-level-card,
:global(.dark-mode) .risk-section,
:global(.dark-mode) .respondent-field {
  border-color: #2b395a !important;
  background: #172033 !important;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18) !important;
}

:global(html[data-theme-mode="dark"]) .respondent-icon,
:global(html.dark) .respondent-icon,
:global(.dark-mode) .respondent-icon {
  color: #bfdbfe !important;
  background: rgba(59, 130, 246, 0.18) !important;
}

:global(html[data-theme-mode="dark"]) .risk-section-header,
:global(html.dark) .risk-section-header,
:global(.dark-mode) .risk-section-header {
  border-color: #2b395a !important;
  background: #1d2940 !important;
}

:global(html[data-theme-mode="dark"]) .risk-section-header h3,
:global(html[data-theme-mode="dark"]) .risk-level-card strong,
:global(html[data-theme-mode="dark"]) .respondent-field strong,
:global(html[data-theme-mode="dark"]) .risk-empty strong,
:global(html.dark) .risk-section-header h3,
:global(html.dark) .risk-level-card strong,
:global(html.dark) .respondent-field strong,
:global(html.dark) .risk-empty strong,
:global(.dark-mode) .risk-section-header h3,
:global(.dark-mode) .risk-level-card strong,
:global(.dark-mode) .respondent-field strong,
:global(.dark-mode) .risk-empty strong {
  color: #f4f7fb !important;
}

:global(html[data-theme-mode="dark"]) .risk-level-card small,
:global(html[data-theme-mode="dark"]) .respondent-field span,
:global(html[data-theme-mode="dark"]) .risk-loading,
:global(html[data-theme-mode="dark"]) .risk-empty,
:global(html[data-theme-mode="dark"]) .risk-empty p,
:global(html.dark) .risk-level-card small,
:global(html.dark) .respondent-field span,
:global(html.dark) .risk-loading,
:global(html.dark) .risk-empty,
:global(html.dark) .risk-empty p,
:global(.dark-mode) .risk-level-card small,
:global(.dark-mode) .respondent-field span,
:global(.dark-mode) .risk-loading,
:global(.dark-mode) .risk-empty,
:global(.dark-mode) .risk-empty p {
  color: #a8b6d1 !important;
}

:global(html[data-theme-mode="dark"]) .respondent-icon,
:global(html.dark) .respondent-icon,
:global(.dark-mode) .respondent-icon {
  color: #bfdbfe !important;
}

:global(html[data-theme-mode="dark"]) .risk-section-header > span,
:global(html[data-theme-mode="dark"]) .risk-empty i,
:global(html.dark) .risk-section-header > span,
:global(html.dark) .risk-empty i,
:global(.dark-mode) .risk-section-header > span,
:global(.dark-mode) .risk-empty i {
  color: #69a2ff !important;
}

:global(html[data-theme-mode="dark"]) .risk-action,
:global(html.dark) .risk-action,
:global(.dark-mode) .risk-action {
  color: #dbeafe !important;
  background: rgba(219, 234, 254, 0.12) !important;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.22) !important;
}

:global(html[data-theme-mode="dark"]) .risk-table th,
:global(html.dark) .risk-table th,
:global(.dark-mode) .risk-table th {
  border-color: #2b395a !important;
  color: #c8d5ed !important;
  background: #1d2940 !important;
}

:global(html[data-theme-mode="dark"]) .risk-table td,
:global(html.dark) .risk-table td,
:global(.dark-mode) .risk-table td {
  border-color: #273653 !important;
  color: #d9e3f5 !important;
  background: #172033 !important;
}

:global(html[data-theme-mode="dark"]) .risk-table tbody tr:nth-child(even) td,
:global(html[data-theme-mode="dark"]) .risk-name-cell,
:global(html.dark) .risk-table tbody tr:nth-child(even) td,
:global(html.dark) .risk-name-cell,
:global(.dark-mode) .risk-table tbody tr:nth-child(even) td,
:global(.dark-mode) .risk-name-cell {
  background: #182338 !important;
}

:global(html[data-theme-mode="dark"]) .risk-table td span:not(.risk-pill),
:global(html.dark) .risk-table td span:not(.risk-pill),
:global(.dark-mode) .risk-table td span:not(.risk-pill) {
  color: #d9e3f5 !important;
}

:global(html[data-theme-mode="dark"]) .risk-table tbody tr:hover td,
:global(html.dark) .risk-table tbody tr:hover td,
:global(.dark-mode) .risk-table tbody tr:hover td {
  background: #1b2942 !important;
}

:global(html[data-theme-mode="dark"]) .risk-pill,
:global(html.dark) .risk-pill,
:global(.dark-mode) .risk-pill {
  color: #bfdbfe !important;
  background: rgba(59, 130, 246, 0.18) !important;
}

:global(html[data-theme-mode="dark"]) .risk-status-chip,
:global(html.dark) .risk-status-chip,
:global(.dark-mode) .risk-status-chip {
  color: #bfdbfe !important;
  background: rgba(59, 130, 246, 0.18) !important;
}

:global(html[data-theme-mode="dark"]) .risk-empty.is-error i,
:global(html[data-theme-mode="dark"]) .risk-empty.is-error p,
:global(html.dark) .risk-empty.is-error i,
:global(html.dark) .risk-empty.is-error p,
:global(.dark-mode) .risk-empty.is-error i,
:global(.dark-mode) .risk-empty.is-error p {
  color: #fca5a5 !important;
}

@media (max-width: 1199px) {
  .risk-hero {
    align-items: flex-start !important;
  }

  .risk-hero-right {
    flex: 0 0 auto;
  }

  .risk-level-grid,
  .respondent-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .risk-content-grid {
    grid-template-columns: 1fr !important;
  }

  .risk-table {
    min-width: 1080px !important;
  }
}

@media (max-width: 767px) {
  .risk-page {
    padding-bottom: 1rem !important;
  }

  .risk-shell {
    border-radius: 10px !important;
  }

  .risk-hero,
  .risk-hero-left,
  .risk-hero-right {
    width: 100% !important;
    align-items: flex-start !important;
    flex-direction: column !important;
  }

  .risk-hero {
    gap: 1rem !important;
    padding: 1rem !important;
  }

  .risk-hero-left {
    gap: 0.75rem !important;
  }

  .risk-hero-icon {
    width: 38px !important;
    height: 38px !important;
    flex: 0 0 38px !important;
  }

  .risk-hero h2 {
    font-size: 0.98rem !important;
    line-height: 1.25 !important;
  }

  .risk-hero p {
    max-width: 100% !important;
    overflow-wrap: anywhere !important;
  }

  .risk-status {
    width: 100% !important;
    min-width: 0 !important;
    padding-right: 0 !important;
    padding-bottom: 0.8rem !important;
    border-right: 0 !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.18) !important;
    text-align: left !important;
  }

  .risk-action {
    width: 100% !important;
    min-height: 42px !important;
    padding: 0 0.9rem !important;
  }

  .risk-body {
    padding: 1rem !important;
  }

  .risk-level-grid,
  .respondent-grid {
    grid-template-columns: 1fr !important;
    gap: 0.75rem !important;
  }

  .risk-level-grid {
    margin-bottom: 0.75rem !important;
  }

  .risk-level-card {
    min-height: 66px !important;
    padding: 0.8rem !important;
  }

  .risk-level-icon {
    width: 38px !important;
    height: 38px !important;
    flex: 0 0 38px !important;
  }

  .risk-section-header {
    align-items: flex-start !important;
    flex-direction: column !important;
    gap: 0.35rem !important;
    padding: 0.9rem 1rem !important;
  }

  .risk-section-header > span {
    align-self: flex-start !important;
  }

  .respondent-grid {
    padding: 0.8rem !important;
  }

  .respondent-field {
    min-height: auto !important;
    padding: 0.75rem !important;
  }

  .risk-table-wrap {
    overflow: visible !important;
  }

  .risk-table {
    display: block !important;
    min-width: 0 !important;
    width: 100% !important;
    border-collapse: separate !important;
    table-layout: auto !important;
  }

  .risk-table thead {
    display: none !important;
  }

  .risk-table tbody {
    display: grid !important;
    gap: 0.75rem !important;
    padding: 0.8rem !important;
  }

  .risk-table tr {
    display: block !important;
    overflow: hidden !important;
    border: 1px solid #dbe5f2 !important;
    border-radius: 8px !important;
    background: #ffffff !important;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05) !important;
  }

  .risk-page.is-dark .risk-table tr,
  :global(html[data-theme-mode="dark"]) .risk-table tr,
  :global(html.dark) .risk-table tr,
  :global(.dark-mode) .risk-table tr {
    border-color: #2b395a !important;
    background: #172033 !important;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18) !important;
  }

  .risk-table td {
    display: grid !important;
    grid-template-columns: minmax(102px, 34%) minmax(0, 1fr) !important;
    gap: 0.7rem !important;
    align-items: start !important;
    padding: 0.75rem 0.85rem !important;
    border-bottom: 1px solid #edf2f7 !important;
    font-size: 0.78rem !important;
    line-height: 1.45 !important;
  }

  .risk-table td:last-child {
    border-bottom: 0 !important;
  }

  .risk-table td::before {
    content: attr(data-label);
    position: static !important;
    inset: auto !important;
    width: auto !important;
    background: transparent !important;
    color: #6b7f9c;
    font-size: 0.66rem;
    font-weight: 950;
    line-height: 1.3;
    text-transform: uppercase;
  }

  .risk-page.is-dark .risk-table td::before,
  :global(html[data-theme-mode="dark"]) .risk-table td::before,
  :global(html.dark) .risk-table td::before,
  :global(.dark-mode) .risk-table td::before {
    color: #a8b6d1 !important;
  }

  .risk-pill {
    width: fit-content !important;
    max-width: 100% !important;
    min-height: 22px !important;
    white-space: normal !important;
  }

  .risk-loading,
  .risk-empty {
    min-height: 130px !important;
    padding: 1rem !important;
  }
}

@media (max-width: 420px) {
  .risk-body {
    padding: 0.75rem !important;
  }

  .risk-hero {
    padding: 0.9rem !important;
  }

  .risk-table tbody {
    padding: 0.65rem !important;
  }

  .risk-table td {
    grid-template-columns: 1fr !important;
    gap: 0.3rem !important;
  }

  .risk-level-card strong {
    font-size: 1.2rem !important;
  }
}
</style>
