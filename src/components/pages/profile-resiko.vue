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
    'data',
  ];

  for (const key of keys) {
    const candidate = parseMaybeJson(value[key]);
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
};

const valueOf = (row: any, keys: string[], fallback = '-') => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return fallback;
};

const normalizeLevel = (value: any) => {
  const text = String(value || '').trim().toLowerCase();
  const score = Number(String(value || '').replace(',', '.'));
  if (text.includes('sangat') || score >= 20 || score === 4) return 'Sangat Tinggi';
  if (text.includes('tinggi') || score >= 12 || score === 3) return 'Tinggi';
  if (text.includes('sedang') || score >= 6 || score === 2) return 'Sedang';
  if (text.includes('rendah') || score >= 1 || score === 1) return 'Rendah';
  return 'Belum Dinilai';
};

const parsedRiskRows = computed(() => {
  const fromStore = currentResult.value?.risks || [];
  const fromPayload = pickFirstArray(unwrapRiskData.value);
  return fromStore.length ? fromStore : fromPayload;
});

const riskRows = computed(() => parsedRiskRows.value.map((row: any, index: number) => {
  const level = normalizeLevel(valueOf(row, [
    'level',
    'level_risiko',
    'tingkat_risiko',
    'nilai_risiko',
    'risk_level',
    'skor_risiko',
  ], ''));

  return {
    id: row?.id || row?.kode || `risk-${index}`,
    asset: valueOf(row, ['aset', 'asset', 'nama_aset', 'namaAset', 'objek', 'komponen']),
    description: valueOf(row, ['deskripsi_risiko', 'deskripsiRisiko', 'risiko', 'risk', 'ancaman', 'kerentanan', 'pertanyaan']),
    impact: valueOf(row, ['impact', 'dampak', 'nilai_dampak', 'impact_level']),
    probability: valueOf(row, ['prob', 'probability', 'probabilitas', 'kemungkinan', 'likelihood', 'nilai_kemungkinan']),
    level,
    status: valueOf(row, ['status', 'status_mitigasi', 'mitigasi_status', 'status_risiko'], 'Terekam'),
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

const riskLevels = computed(() => ['Sangat Tinggi', 'Tinggi', 'Sedang', 'Rendah'].map((label) => ({
  label,
  count: riskRows.value.filter((row) => row.level === label).length,
})));

const respondentFields = computed(() => [
  { label: 'ID Responden', value: respondent.value?.id || '-' },
  { label: 'Nama Lengkap', value: respondent.value?.nama_lengkap || '-' },
  { label: 'Jabatan', value: respondent.value?.jabatan || '-' },
  { label: 'Email', value: respondent.value?.email || '-' },
  { label: 'No. Telepon', value: respondent.value?.no_telepon || '-' },
  { label: 'User ID', value: respondent.value?.user_id || '-' },
  { label: 'ID Perusahaan', value: respondent.value?.id_perusahaan || '-' },
  { label: 'Nama Perusahaan', value: respondent.value?.nama_perusahaan || currentStakeholder.value?.nama_perusahaan || '-' },
  { label: 'Sektor', value: respondent.value?.nama_sektor || '-' },
  { label: 'Sub Sektor', value: respondent.value?.nama_sub_sektor || '-' },
  { label: 'Sertifikat Training', value: respondent.value?.sertifikat_training || '-' },
  { label: 'Dibuat', value: formatDate(respondent.value?.created_at) },
  { label: 'Diperbarui', value: formatDate(respondent.value?.updated_at) },
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
              <span style="display: block; color: #6b7f9c; font-size: .68rem; line-height: 1.2; font-weight: 900; text-transform: uppercase;">{{ field.label }}</span>
              <strong style="display: block; margin-top: .35rem; color: #10233f; font-size: .82rem; line-height: 1.35; font-weight: 850; overflow-wrap: anywhere;">{{ field.value }}</strong>
            </div>
          </div>
        </div>

        <div class="risk-content-grid" style="display: grid; grid-template-columns: 1fr; gap: 1rem; margin-top: 1rem;">
          <div class="risk-section risk-table-section" style="overflow: hidden; border: 1px solid #dbe5f2; border-radius: 10px; background: #ffffff;">
            <div class="risk-section-header" style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.15rem; border-bottom: 1px solid #dbe5f2; background: #f8fafc;">
              <div>
                <h3 style="margin: 0; color: #061b3a; font-size: .95rem; font-weight: 950;">Data Risiko</h3>
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
              <table class="risk-table" style="width: 100%; min-width: 780px; border-collapse: collapse;">
                <thead>
                  <tr>
                    <th style="padding: .85rem 1rem; color: #34445f; background: #f3f6fa; border-bottom: 1px solid #dbe5f2; font-size: .68rem; font-weight: 950; text-transform: uppercase;">Aset</th>
                    <th style="padding: .85rem 1rem; color: #34445f; background: #f3f6fa; border-bottom: 1px solid #dbe5f2; font-size: .68rem; font-weight: 950; text-transform: uppercase;">Deskripsi Risiko</th>
                    <th style="padding: .85rem 1rem; color: #34445f; background: #f3f6fa; border-bottom: 1px solid #dbe5f2; font-size: .68rem; font-weight: 950; text-transform: uppercase;">Impact</th>
                    <th style="padding: .85rem 1rem; color: #34445f; background: #f3f6fa; border-bottom: 1px solid #dbe5f2; font-size: .68rem; font-weight: 950; text-transform: uppercase;">Prob</th>
                    <th style="padding: .85rem 1rem; color: #34445f; background: #f3f6fa; border-bottom: 1px solid #dbe5f2; font-size: .68rem; font-weight: 950; text-transform: uppercase;">Level</th>
                    <th style="padding: .85rem 1rem; color: #34445f; background: #f3f6fa; border-bottom: 1px solid #dbe5f2; font-size: .68rem; font-weight: 950; text-transform: uppercase;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in riskRows" :key="row.id">
                    <td style="padding: .9rem 1rem; color: #203653; border-bottom: 1px solid #edf2f7; font-size: .8rem; font-weight: 700; vertical-align: top;">{{ row.asset }}</td>
                    <td style="padding: .9rem 1rem; color: #203653; border-bottom: 1px solid #edf2f7; font-size: .8rem; font-weight: 700; vertical-align: top;">{{ row.description }}</td>
                    <td style="padding: .9rem 1rem; color: #203653; border-bottom: 1px solid #edf2f7; font-size: .8rem; font-weight: 700; vertical-align: top;">{{ row.impact }}</td>
                    <td style="padding: .9rem 1rem; color: #203653; border-bottom: 1px solid #edf2f7; font-size: .8rem; font-weight: 700; vertical-align: top;">{{ row.probability }}</td>
                    <td style="padding: .9rem 1rem; color: #203653; border-bottom: 1px solid #edf2f7; font-size: .8rem; font-weight: 700; vertical-align: top;"><span class="risk-pill" style="display: inline-flex; align-items: center; min-height: 24px; padding: 0 .6rem; border-radius: 999px; color: #0f3f62; background: #eaf3ff; font-size: .7rem; font-weight: 900;">{{ row.level }}</span></td>
                    <td style="padding: .9rem 1rem; color: #203653; border-bottom: 1px solid #edf2f7; font-size: .8rem; font-weight: 700; vertical-align: top;">{{ row.status }}</td>
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
  background: #f8fafc;
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
  min-height: 70px;
  padding: 0.8rem;
  border: 1px solid #e7eef7;
  border-radius: 8px;
  background: #fbfdff;
}

.respondent-field span {
  display: block;
  color: #6b7f9c;
  font-size: 0.68rem;
  line-height: 1.2;
  font-weight: 900;
  text-transform: uppercase;
}

.respondent-field strong {
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
}

.risk-table {
  width: 100%;
  min-width: 780px;
  border-collapse: collapse;
}

.risk-table th {
  padding: 0.85rem 1rem;
  color: #34445f;
  background: #f3f6fa;
  border-bottom: 1px solid #dbe5f2;
  font-size: 0.68rem;
  font-weight: 950;
  text-transform: uppercase;
}

.risk-table td {
  padding: 0.9rem 1rem;
  color: #203653;
  border-bottom: 1px solid #edf2f7;
  font-size: 0.8rem;
  font-weight: 700;
  vertical-align: top;
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

.risk-page.is-dark .risk-table tbody tr:hover td {
  background: #1b2942 !important;
}

.risk-page.is-dark .risk-pill {
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

:global(html[data-theme-mode="dark"]) .risk-empty.is-error i,
:global(html[data-theme-mode="dark"]) .risk-empty.is-error p,
:global(html.dark) .risk-empty.is-error i,
:global(html.dark) .risk-empty.is-error p,
:global(.dark-mode) .risk-empty.is-error i,
:global(.dark-mode) .risk-empty.is-error p {
  color: #fca5a5 !important;
}

@media (max-width: 1199px) {
  .risk-level-grid,
  .respondent-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .risk-content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .risk-hero,
  .risk-hero-left,
  .risk-hero-right {
    align-items: flex-start;
    flex-direction: column;
  }

  .risk-status {
    width: 100%;
    padding-right: 0;
    border-right: 0;
    text-align: left;
  }

  .risk-body {
    padding: 1rem;
  }

  .risk-level-grid,
  .respondent-grid {
    grid-template-columns: 1fr;
  }
}
</style>
