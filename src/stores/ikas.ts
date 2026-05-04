// stores/ikas.ts
import { defineStore } from 'pinia';
import { assessmentData } from '@/data/assessment/assessment-data';
import {
  assessmentToIkasMapping,
  getQuestionIdsForSubdomain,
  calculateSubdomainScore
} from '@/data/assessment/assessment-ikas-mapping';
import { ikasService } from '@/services/ikas.service';
import { useStakeholdersStore } from '@/stores/stakeholders';
import type { IkasPayload } from '@/types/ikas.types';

let initializePromise: Promise<void> | null = null;
let fetchAllPromise: Promise<void> | null = null;

export interface IkasSummaryRecord {
  id: string;
  slug: string;
  id_perusahaan: string;
  score: number;
  category: string;
  is_validated: boolean;
  edit_request_status: string;
  edit_request_reason: string;
  updated_at: string;
  raw: any;
}

// Interface untuk data IKAS per domain

export const domainDetails: any = {
  identifikasi: {
    nilai_subdomain1: [
      {
        subCategoryTitle: 'Sub Kategori 1.1.1: Menetapkan dan mengomunikasikan prioritas untuk misi, tujuan, dan kegiatan pengamanan sistem elektronik di organisasi',
        id: '1.1.1.a',
        label: 'Pimpinan organisasi menetapkan keamanan siber sebagai prioritas di organisasi dalam bentuk kebijakan atau komitmen pimpinan yang sesuai dengan kondisi bisnis/layanan dan operasional organisasi.',
      },
      {
        id: '1.1.1.b',
        label: 'Penyelenggara Sistem Elektronik mengomunikasikan perihal komitmen keamanan siber di organisasinya dengan pihak-pihak yang terkait dengan bisnis/layanan organisasi (termasuk kepada penyedia pihak ketiga).',
      },
      {
        subCategoryTitle: 'Sub Kategori 1.1.2: Mengidentifikasi ketergantungan organisasi dengan pihak terkait lainnya',
        id: '1.1.2.a',
        label: 'Penyelenggara Sistem Elektronik mengidentifikasi unit kerja di internal organisasinya, maupun pihak lain di luar organisasinya yang memiliki ketergantungan, baik secara langsung maupun tidak langsung terhadap operasional layanan Sistem Elektronik di organisasinya.',
      },
      {
        subCategoryTitle: 'Sub Kategori 1.1.3: Mengidentifikasi dan mengorganisasikan peran organisasi di dalam sektor Sistem Elektronik',
        id: '1.1.3.a',
        label: 'Penyelenggara Sistem Elektronik mengidentifikasi dan menetapkan unit kerja atau fungsi yang memiliki tugas dan tanggung jawab dalam menerapkan pengamanan Sistem Elektronik di organisasinya.',
      },
      {
        id: '1.1.3.b',
        label: 'Penyelenggara Sistem Elektronik mengidentifikasi dan menetapkan unit kerja atau fungsi yang memiliki tugas dan tanggung jawab dalam menerapkan pengamanan Sistem Elektronik di organisasinya.',
      }
    ],
    // Add other subdomains as needed
  }
};

export interface IkasIdentifikasi {
  nilai_identifikasi: number | 'NA' | null;
  kategori_identifikasi: string;
  nilai_subdomain1: number | null;
  nilai_subdomain2: number | null;
  nilai_subdomain3: number | null;
  nilai_subdomain4: number | null;
  nilai_subdomain5: number | null;
}

export interface DomainDetail {
  id: string;
  label: string;
  nilai: number | null;
}

export interface IkasProteksi {
  nilai_proteksi: number | 'NA' | null;
  kategori_proteksi: string;
  nilai_subdomain1: number | null;
  nilai_subdomain2: number | null;
  nilai_subdomain3: number | null;
  nilai_subdomain4: number | null;
  nilai_subdomain5: number | null;
  nilai_subdomain6: number | null;
}

export interface IkasDeteksi {
  nilai_deteksi: number | 'NA' | null;
  kategori_deteksi: string;
  nilai_subdomain1: number | null;
  nilai_subdomain2: number | null;
  nilai_subdomain3: number | null;
}

export interface IkasTanggulih {
  nilai_tanggulih: number | 'NA' | null;
  kategori_tanggulih: string;
  nilai_subdomain1: number | null;
  nilai_subdomain2: number | null;
  nilai_subdomain3: number | null;
  nilai_subdomain4: number | null;
}

export interface IkasData {
  total_rata_rata: number | 'NA' | null;
  total_kategori: string;
  identifikasi: IkasIdentifikasi;
  proteksi: IkasProteksi;
  deteksi: IkasDeteksi;
  tanggulih: IkasTanggulih;
  is_validated: boolean;
  edit_request_status: string;
  edit_request_reason: string;
  details: Record<string, Record<string, Record<string, number>>>;
}

const normalizeEditRequestStatus = (record: any, fallback = 'none'): string => {
  const rawStatus =
    record?.edit_request_status ??
    record?.editRequestStatus ??
    record?.request_edit_status ??
    record?.requestEditStatus ??
    record?.status_request_edit ??
    record?.edit_request?.status ??
    record?.request_edit?.status ??
    fallback;

  const status = String(rawStatus || '').trim().toLowerCase();
  return status || 'none';
};

const hasEditRequestStatus = (record: any): boolean => (
  record?.edit_request_status !== undefined ||
  record?.editRequestStatus !== undefined ||
  record?.request_edit_status !== undefined ||
  record?.requestEditStatus !== undefined ||
  record?.status_request_edit !== undefined ||
  record?.edit_request?.status !== undefined ||
  record?.request_edit?.status !== undefined
);

const normalizeEditRequestReason = (record: any, fallback = ''): string => {
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
    fallback;

  return String(rawReason || '').trim();
};

const normalizeValidatedStatus = (record: any, fallback = false): boolean => {
  const rawStatus = record?.is_validated ?? record?.isValidated ?? record?.status ?? fallback;
  if (typeof rawStatus === 'boolean') return rawStatus;
  if (typeof rawStatus === 'number') return rawStatus === 1;

  const normalized = String(rawStatus ?? '').trim().toLowerCase();
  if (['true', '1', 'validated', 'active', 'approved'].includes(normalized)) return true;
  if (['false', '0', 'draft', 'inactive'].includes(normalized)) return false;

  return Boolean(fallback);
};

const unwrapIkasResponse = (response: any): any => response?.data || response?.record || response?.ikas || response || {};

// Helper function untuk label maturity
export const getMaturityLabel = (score: number | 'NA'): string => {
  if (score === 'NA') return "Not Applicable";
  if (score <= 0) return "INPUT BELUM LENGKAP";
  if (score < 1.50) return "Level 1 - Awal";
  if (score < 2.50) return "Level 2 - Berulang";
  if (score < 3.50) return "Level 3 - Terdefinisi";
  if (score < 4.50) return "Level 4 - Terkelola";
  return "Level 5 - Inovatif";
};

// Default data untuk stakeholder baru
const createDefaultIkasData = (): IkasData => ({
  total_rata_rata: 0,
  total_kategori: "INPUT BELUM LENGKAP",
  identifikasi: {
    nilai_identifikasi: 0,
    kategori_identifikasi: "INPUT BELUM LENGKAP",
    nilai_subdomain1: 0,
    nilai_subdomain2: 0,
    nilai_subdomain3: 0,
    nilai_subdomain4: 0,
    nilai_subdomain5: 0,
  },
  proteksi: {
    nilai_proteksi: 0,
    kategori_proteksi: "INPUT BELUM LENGKAP",
    nilai_subdomain1: 0,
    nilai_subdomain2: 0,
    nilai_subdomain3: 0,
    nilai_subdomain4: 0,
    nilai_subdomain5: 0,
    nilai_subdomain6: 0,
  },
  deteksi: {
    nilai_deteksi: 0,
    kategori_deteksi: "INPUT BELUM LENGKAP",
    nilai_subdomain1: 0,
    nilai_subdomain2: 0,
    nilai_subdomain3: 0,
  },
  tanggulih: {
    nilai_tanggulih: 0,
    kategori_tanggulih: "INPUT BELUM LENGKAP",
    nilai_subdomain1: 0,
    nilai_subdomain2: 0,
    nilai_subdomain3: 0,
    nilai_subdomain4: 0,
  },
  is_validated: false,
  edit_request_status: 'none',
  edit_request_reason: '',
  details: {}
});

// localStorage fully removed — all IKAS data is fetched from backend API

export const useIkasStore = defineStore('ikas', {
  state: () => ({
    // Map: stakeholder slug -> IkasData
    ikasDataMap: {} as Record<string, IkasData>,
    ikasSummaryMap: {} as Record<string, IkasSummaryRecord>,
    ikasRawRecords: [] as any[],
    initialized: false,
    ikasVersion: 0, // incremented on every save — lets other components react to changes

    // Backend API state
    backendIkasIds: {} as Record<string, string | null>, // Map stakeholder slug -> backend IKAS ID
    backendSyncedMap: {} as Record<string, boolean>, // Map stakeholder slug -> backend sync state
    domainIds: {} as Record<string, string>, // Maps domain name -> backend ID
    apiLoading: false,
    apiError: null as string | null,
  }),

  getters: {
    // Get IKAS data untuk stakeholder tertentu
    getIkasData(): (slug: string) => IkasData {
      return (slug: string) => {
        if (!this.ikasDataMap[slug]) {
          // Jika belum ada, buat default
          this.ikasDataMap[slug] = createDefaultIkasData();
        }
        return this.ikasDataMap[slug];
      };
    },

    // Get progress info (completed / total) per domain
    hasIkas(): (slug: string) => boolean {
      return (slug: string) => {
        const summary = this.ikasSummaryMap[slug];
        if (summary?.id) return true;

        const id = this.backendIkasIds[slug];
        if (id) return true;

        const data = this.ikasDataMap[slug];
        if (!data) return false;

        const val = data.total_rata_rata;
        return val !== null && val !== 0 && val !== 'NA';
      };
    },

    getIkasSummary(): (slug: string) => IkasSummaryRecord | null {
      return (slug: string) => this.ikasSummaryMap[slug] || null;
    },

    // Get progress info (completed / total) per domain
    getDomainProgress(): (slug: string, domainKey: string) => { completed: number, total: number, percent: number } {
      return (slug: string, domainKey: string) => {
        const data = this.ikasDataMap[slug];
        if (!data) return { completed: 0, total: 0, percent: 0 };

        const domainObj = data[domainKey as keyof IkasData] as any;
        if (!domainObj || typeof domainObj !== 'object') return { completed: 0, total: 0, percent: 0 };

        // Count subdomains (keys starting with 'nilai_subdomain')
        const keys = Object.keys(domainObj).filter(k => k.startsWith('nilai_subdomain'));
        const total = keys.length;
        const completed = keys.filter(k => domainObj[k] !== 0 && domainObj[k] !== null).length; // Assuming 0 is initial/unanswered

        return {
          completed,
          total,
          percent: total > 0 ? Math.round((completed / total) * 100) : 0
        };
      };
    },

    // Get progress info for a specific subdomain (item level)
    getSubdomainProgress(): (slug: string, domainKey: string, subdomainKey: string) => { completed: number, total: number, percent: number } {
      return (slug: string, domainKey: string, subdomainKey: string) => {
        const data = this.ikasDataMap[slug];
        if (!data) return { completed: 0, total: 0, percent: 0 };

        // Check if we have details definition for this subdomain
        // We need to import domainDetails or access it if it's exported in the same file
        // Since domainDetails is exported from this file, we can use it directly?
        // However, this is inside the store definition. domainDetails is defined outside.
        // We can access 'domainDetails' variable if it is in scope.

        const detailsList = domainDetails[domainKey]?.[subdomainKey];

        if (detailsList && Array.isArray(detailsList)) {
          const total = detailsList.length;
          let completed = 0;

          // Check if details exist in stored data
          if (data.details && data.details[domainKey] && data.details[domainKey][subdomainKey]) {
            const storedDetails = data.details[domainKey][subdomainKey];
            completed = detailsList.filter(d => {
              const val = storedDetails[d.id];
              return val !== undefined && val !== null && val !== 0;
            }).length;
          }

          return {
            completed,
            total,
            percent: total > 0 ? Math.round((completed / total) * 100) : 0
          };
        } else {
          // Fallback for subdomains without detailed questions (simple 0-5 input)
          const domainObj = data[domainKey as keyof IkasData] as any;
          if (!domainObj) return { completed: 0, total: 1, percent: 0 };

          const val = domainObj[subdomainKey];
          const isCompleted = val !== null && val !== 0;

          return {
            completed: isCompleted ? 1 : 0,
            total: 1,
            percent: isCompleted ? 100 : 0
          }
        }
      };
    },

    // Get overall progress
    getOverallProgress(): (slug: string) => { percent: number, answered: number, total: number } {
      return (slug: string) => {
        const domains = ['identifikasi', 'proteksi', 'deteksi', 'tanggulih'];
        let totalQuestions = 0;
        let totalAnswered = 0;

        domains.forEach(d => {
          const progress = this.getDomainProgress(slug, d);
          totalQuestions += progress.total;
          totalAnswered += progress.completed;
        });

        return {
          answered: totalAnswered,
          total: totalQuestions,
          percent: totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0
        }
      }
    }
  },

  actions: {
    isMissingDomainEndpointError(error: any): boolean {
      return Number(error?.status) === 404;
    },

    normalizeIkasRecords(response: any): any[] {
      if (Array.isArray(response)) return response;
      if (Array.isArray(response?.data)) return response.data;
      if (response?.id) return [response];
      return [];
    },

    recordMatchesIkasIdentity(record: any, slug: string, ikasId: string | null, perusahaanId = ''): boolean {
      const company = record?.perusahaan || {};
      return (
        (!!ikasId && String(record?.id || '') === String(ikasId)) ||
        (!!slug && String(record?.slug || '') === String(slug)) ||
        (!!slug && String(company?.slug || '') === String(slug)) ||
        (!!perusahaanId && String(record?.id_perusahaan || company?.id || '') === String(perusahaanId))
      );
    },

    patchIkasStatus(slug: string, patch: { is_validated?: boolean; edit_request_status?: string; edit_request_reason?: string }) {
      if (!slug) return;

      const ikasId = this.backendIkasIds[slug] || null;
      const perusahaanId = this.ikasSummaryMap[slug]?.id_perusahaan || '';

      if (!this.ikasDataMap[slug]) {
        this.ikasDataMap[slug] = createDefaultIkasData();
      }

      if (typeof patch.is_validated === 'boolean') {
        this.ikasDataMap[slug].is_validated = patch.is_validated;
      }
      if (patch.edit_request_status !== undefined) {
        this.ikasDataMap[slug].edit_request_status = patch.edit_request_status || 'none';
      }
      if (patch.edit_request_reason !== undefined) {
        this.ikasDataMap[slug].edit_request_reason = patch.edit_request_reason || '';
      }

      if (this.ikasSummaryMap[slug]) {
        if (typeof patch.is_validated === 'boolean') {
          this.ikasSummaryMap[slug].is_validated = patch.is_validated;
        }
        if (patch.edit_request_status !== undefined) {
          this.ikasSummaryMap[slug].edit_request_status = patch.edit_request_status || 'none';
        }
        if (patch.edit_request_reason !== undefined) {
          this.ikasSummaryMap[slug].edit_request_reason = patch.edit_request_reason || '';
        }
      }

      this.ikasRawRecords = this.ikasRawRecords.map((record: any) => (
        this.recordMatchesIkasIdentity(record, slug, ikasId, perusahaanId)
          ? {
              ...record,
              ...(typeof patch.is_validated === 'boolean' ? { is_validated: patch.is_validated, status: patch.is_validated } : {}),
              ...(patch.edit_request_status !== undefined ? { edit_request_status: patch.edit_request_status || 'none' } : {}),
              ...(patch.edit_request_reason !== undefined ? { edit_request_reason: patch.edit_request_reason || '' } : {}),
            }
          : record
      ));
    },

    findLatestIkasRecord(records: any[], perusahaanId: string): any | null {
      const matching = records.filter((record: any) =>
        String(record?.perusahaan?.id || '') === String(perusahaanId) ||
        String(record?.id_perusahaan || '') === String(perusahaanId)
      );

      if (matching.length === 0) return null;

      matching.sort((a: any, b: any) =>
        new Date(b.updated_at || b.created_at || 0).getTime() -
        new Date(a.updated_at || a.created_at || 0).getTime()
      );

      return matching[0] || null;
    },

    numberValue(value: unknown): number {
      const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : 0;
    },

    resolveIkasSlug(record: any): string {
      const stakeholdersStore = useStakeholdersStore();
      const companyId = record?.id_perusahaan || record?.perusahaan?.id;
      const directSlug = record?.perusahaan?.slug || record?.slug;
      if (directSlug) return String(directSlug);

      if (companyId) {
        const stakeholder = stakeholdersStore.getStakeholderById(String(companyId));
        if (stakeholder?.slug) return stakeholder.slug;
      }

      return '';
    },

    upsertSummaryRecord(record: any): IkasSummaryRecord | null {
      const slug = this.resolveIkasSlug(record);
      if (!slug) return null;

      const id = String(record?.id || '');
      const idPerusahaan = String(record?.id_perusahaan || record?.perusahaan?.id || '');
      const score = this.numberValue(record?.nilai_kematangan ?? record?.total_rata_rata ?? record?.score ?? 0);
      const category = getMaturityLabel(score);
      const previousEditRequestStatus = this.ikasDataMap[slug]?.edit_request_status || 'none';
      const editRequestStatus = hasEditRequestStatus(record)
        ? normalizeEditRequestStatus(record, 'none')
        : previousEditRequestStatus;
      const summary: IkasSummaryRecord = {
        id,
        slug,
        id_perusahaan: idPerusahaan,
        score,
        category,
        is_validated: normalizeValidatedStatus(record, this.ikasDataMap[slug]?.is_validated || false),
        edit_request_status: editRequestStatus || 'none',
        edit_request_reason: normalizeEditRequestReason(record, this.ikasDataMap[slug]?.edit_request_reason || ''),
        updated_at: record?.updated_at || record?.tanggal || record?.created_at || '',
        raw: record,
      };

      this.ikasSummaryMap[slug] = summary;
      this.backendIkasIds[slug] = id || null;
      this.backendSyncedMap[slug] = !!id;

      if (!this.ikasDataMap[slug]) {
        this.ikasDataMap[slug] = createDefaultIkasData();
      }

      this.ikasDataMap[slug].total_rata_rata = score;
      this.ikasDataMap[slug].total_kategori = category;
      this.ikasDataMap[slug].is_validated = summary.is_validated;
      this.ikasDataMap[slug].edit_request_status = summary.edit_request_status;
      this.ikasDataMap[slug].edit_request_reason = summary.edit_request_reason;

      return summary;
    },

    // Initialize store and fetch data
    async initialize() {
      if (this.initialized) return;
      if (initializePromise) return initializePromise;
      
      this.apiLoading = true;
      initializePromise = (async () => {
        await this.fetchAllFromBackend();
        this.initialized = true;
      })();

      try {
        await initializePromise;
      } catch (e) {
        console.error('[IKAS Store] Failed to initialize:', e);
      } finally {
        this.apiLoading = false;
        this.ikasVersion++;
        initializePromise = null;
      }
    },

    /** Fetch all IKAS records from backend to populate global state */
    async deleteFromBackend(id: string) {
      this.apiLoading = true;
      try {
        await ikasService.deleteIkas(id);
        
        // Find slug associated with this ID to clear local state
        let slugToClear = '';
        for (const [slug, ikasId] of Object.entries(this.backendIkasIds)) {
          if (ikasId === id) {
            slugToClear = slug;
            break;
          }
        }
        
        if (slugToClear) {
          delete this.backendIkasIds[slugToClear];
          delete this.backendSyncedMap[slugToClear];
          delete this.ikasDataMap[slugToClear];
        }
        
        this.ikasVersion++;
        return true;
      } catch (error) {
        console.error('[IKAS Store] deleteFromBackend failed:', error);
        throw error;
      } finally {
        this.apiLoading = false;
      }
    },

    async fetchAllFromBackend() {
      if (fetchAllPromise) return fetchAllPromise;

      fetchAllPromise = (async () => {
        try {
          const stakeholdersStore = useStakeholdersStore();
          if (!stakeholdersStore.initialized) {
            await stakeholdersStore.initialize();
          }

          const response = await ikasService.getIkasList();
          const records = this.normalizeIkasRecords(response);
          this.ikasRawRecords = records;
          this.ikasSummaryMap = {};
          
          records.forEach((rec: any) => {
            this.upsertSummaryRecord(rec);
          });
          
          this.ikasVersion++;
        } catch (error) {
          console.error('[IKAS Store] fetchAllFromBackend failed:', error);
        } finally {
          fetchAllPromise = null;
        }
      })();

      return fetchAllPromise;
    },

    /** Refresh IKAS data */
    async refresh() {
      await this.fetchAllFromBackend();
    },

    // Signal watchers that IKAS data changed (no localStorage)
    saveToStorage() {
      this.ikasVersion++;
    },

    // Ensure stakeholder data exists
    ensureStakeholderData(slug: string) {
      if (!this.ikasDataMap[slug]) {
        this.ikasDataMap[slug] = createDefaultIkasData();
      }
    },

    getBackendIkasId(slug: string): string | null {
      const id = this.backendIkasIds[slug] || null;
      console.debug('[IKAS Store] getBackendIkasId', { slug, id });
      return id;
    },

    setBackendIkasId(slug: string, id: string | null) {
      this.backendIkasIds[slug] = id;
      this.backendSyncedMap[slug] = !!id;
    },

    requireBackendIkasId(slug: string): string | null {
      const id = this.getBackendIkasId(slug);
      if (!id) {
        this.apiError = 'ikas_id belum tersedia';
        return null;
      }
      return id;
    },

    buildRespondentPayload(slug: string, respondentData?: Partial<IkasPayload>): IkasPayload | null {
      const stakeholdersStore = useStakeholdersStore();
      const stakeholder = stakeholdersStore.getStakeholderBySlug(slug);

      const payload: IkasPayload = {
        id_perusahaan: respondentData?.id_perusahaan || stakeholder?.id || '',
        jabatan: respondentData?.jabatan || '',
        responden: respondentData?.responden || '',
        tanggal: respondentData?.tanggal || new Date().toISOString().split('T')[0],
        target_nilai: Number(respondentData?.target_nilai || 0),
        telepon: respondentData?.telepon || '',
      };

      return payload.id_perusahaan ? payload : null;
    },

    async ensureBackendIkasRecord(
      slug: string,
      respondentData?: Partial<IkasPayload>
    ): Promise<{ success: boolean; id?: string; error?: string }> {
      const existingId = this.getBackendIkasId(slug);
      if (existingId) {
        return { success: true, id: existingId };
      }

      const payload = this.buildRespondentPayload(slug, respondentData);
      if (!payload) {
        return { success: false, error: 'ID perusahaan tidak ditemukan' };
      }

      try {
        const created = await ikasService.createIkas(payload);
        const createdId = String(created?.id || (created as any)?.data?.id || '');
        if (!createdId) {
          return { success: false, error: 'Backend tidak mengembalikan ID IKAS' };
        }

        this.setBackendIkasId(slug, createdId);
        return { success: true, id: createdId };
      } catch (error: any) {
        return { success: false, error: error?.message || 'Gagal membuat data IKAS' };
      }
    },

    // Update subdomain value dan recalculate
    updateSubdomain(slug: string, domain: string, subdomain: string, value: number | null) {
      this.ensureStakeholderData(slug);
      const data = this.ikasDataMap[slug];

      // Update nilai subdomain
      if (data[domain as keyof IkasData] && typeof data[domain as keyof IkasData] === 'object') {
        (data[domain as keyof IkasData] as any)[subdomain] = value;
      }

      // Recalculate averages
      this.recalculate(slug);
      this.saveToStorage();
    },

    // Update semua data untuk stakeholder (bulk update dari CRUD form)
    updateAllData(slug: string, newData: IkasData) {
      this.ikasDataMap[slug] = { ...newData };
      this.recalculate(slug);
      this.saveToStorage();
    },

    // Update detail value dan recalculate subdomain
    updateDetail(slug: string, domain: string, subdomain: string, detailId: string, value: number) {
      this.ensureStakeholderData(slug);
      const data = this.ikasDataMap[slug];

      // Initialize details structure if missing
      if (!data.details) data.details = {};
      if (!data.details[domain]) data.details[domain] = {};
      if (!data.details[domain][subdomain]) data.details[domain][subdomain] = {};

      // Update detail value
      data.details[domain][subdomain][detailId] = value;

      // Recalculate subdomain average
      const detailsList = domainDetails[domain]?.[subdomain];
      if (detailsList) {
        const values: number[] = detailsList.map((d: any) => {
          return Number(data.details[domain][subdomain][d.id] || 0);
        });
        const total = values.reduce((a, b) => a + b, 0);
        const avg = total / values.length;

        // Round to nearest whole number as per original logic
        const roundedAvg = Math.round(avg);

        // Update subdomain value using the existing action logic (direct assignment)
        if (data[domain as keyof IkasData] && typeof data[domain as keyof IkasData] === 'object') {
          (data[domain as keyof IkasData] as any)[subdomain] = roundedAvg;
        }
      }

      this.recalculate(slug);
      this.saveToStorage();
    },

    // Recalculate domain averages dan total
    recalculate(slug: string) {
      const data = this.ikasDataMap[slug];
      if (!data) return;

      // Helper for calculating average ignoring nulls and 'NA' values
      const calculateAverage = (values: (number | 'NA' | null)[]): number | 'NA' => {
        const validValues = values.filter((v): v is number => v !== null && v !== 'NA' && typeof v === 'number');
        const naValues = values.filter(v => v === 'NA');

        // If all values are 'NA', return 'NA'
        if (naValues.length > 0 && validValues.length === 0) return 'NA';

        // If no valid numeric values, return 0
        if (validValues.length === 0) return 0;

        const sum = validValues.reduce((a, b) => a + b, 0);
        return Number((sum / validValues.length).toFixed(2));
      };

      // Identifikasi
      const iden = data.identifikasi;
      const idenValues = [
        iden.nilai_subdomain1,
        iden.nilai_subdomain2,
        iden.nilai_subdomain3,
        iden.nilai_subdomain4,
        iden.nilai_subdomain5
      ];
      iden.nilai_identifikasi = calculateAverage(idenValues);
      iden.kategori_identifikasi = getMaturityLabel(iden.nilai_identifikasi);

      // Proteksi
      const prot = data.proteksi;
      const protValues = [
        prot.nilai_subdomain1,
        prot.nilai_subdomain2,
        prot.nilai_subdomain3,
        prot.nilai_subdomain4,
        prot.nilai_subdomain5,
        prot.nilai_subdomain6
      ];
      prot.nilai_proteksi = calculateAverage(protValues);
      prot.kategori_proteksi = getMaturityLabel(prot.nilai_proteksi);

      // Deteksi
      const det = data.deteksi;
      const detValues = [
        det.nilai_subdomain1,
        det.nilai_subdomain2,
        det.nilai_subdomain3
      ];
      det.nilai_deteksi = calculateAverage(detValues);
      det.kategori_deteksi = getMaturityLabel(det.nilai_deteksi);

      // Tanggulih (Penanggulangan & Pemulihan)
      const tang = data.tanggulih;
      const tangValues = [
        tang.nilai_subdomain1,
        tang.nilai_subdomain2,
        tang.nilai_subdomain3,
        tang.nilai_subdomain4
      ];
      tang.nilai_tanggulih = calculateAverage(tangValues);
      tang.kategori_tanggulih = getMaturityLabel(tang.nilai_tanggulih);

      // Total
      const domainValues = [
        iden.nilai_identifikasi,
        prot.nilai_proteksi,
        det.nilai_deteksi,
        tang.nilai_tanggulih
      ];
      // Calculate total average, excluding 'NA' values
      const validTotalValues = domainValues.filter((v): v is number => v !== null && v !== 'NA' && typeof v === 'number');
      const naTotalValues = domainValues.filter(v => v === 'NA');

      // If all domains are 'NA', total should be 'NA'
      if (naTotalValues.length > 0 && validTotalValues.length === 0) {
        data.total_rata_rata = 'NA';
        data.total_kategori = 'Not Applicable';
      } else if (validTotalValues.length === 0) {
        data.total_rata_rata = 0;
        data.total_kategori = getMaturityLabel(0);
      } else {
        data.total_rata_rata = Number((validTotalValues.reduce((a, b) => a + b, 0) / validTotalValues.length).toFixed(2));
        data.total_kategori = getMaturityLabel(data.total_rata_rata as number);
      }
    },

    // Reset data untuk stakeholder tertentu
    resetStakeholderData(slug: string) {
      this.ikasDataMap[slug] = createDefaultIkasData();
      this.backendIkasIds[slug] = null;
      this.backendSyncedMap[slug] = false;
      this.saveToStorage();
    },

    // Sync data from assessment answers to IKAS subdomain values
    syncFromAssessment(slug: string, answers: Record<string, { index: number }>) {
      this.ensureStakeholderData(slug);
      const data = this.ikasDataMap[slug];

      // Process each IKAS domain
      const iksDomains = ['identifikasi', 'proteksi', 'deteksi', 'tanggulih'] as const;

      iksDomains.forEach(ikasDomain => {
        const domainMapping = assessmentToIkasMapping[ikasDomain];
        if (!domainMapping) return;

        // Process each subdomain in the IKAS domain
        Object.keys(domainMapping).forEach(subdomainKey => {
          const questionIds = getQuestionIdsForSubdomain(
            ikasDomain,
            subdomainKey,
            assessmentData
          );

          const score = calculateSubdomainScore(questionIds, answers);

          // Update subdomain value: number, 'NA', or keep as null
          const domainData = data[ikasDomain as keyof typeof data];
          if (domainData && typeof domainData === 'object') {
            if (score !== null) {
              (domainData as any)[subdomainKey] = score;
            }
          }
        });
      });

      // Recalculate domain averages and total
      this.recalculate(slug);
      this.saveToStorage();
    },

    // ──────────────────────────────────────────────────────────────
    // Backend API Actions
    // ──────────────────────────────────────────────────────────────

    /**
     * Submit IKAS data to backend.
     * POST /api/maturity/ikas (create) or PUT /api/maturity/ikas/{id} (update)
     * Only sends the 6 respondent fields — domain scores are sent separately.
     */
    async submitToBackend(
      slug: string,
      respondentData: {
        id_perusahaan: string;
        responden: string;
        jabatan: string;
        telepon: string;
        tanggal: string;
        target_nilai: number;
      }
    ): Promise<{ success: boolean; error?: string }> {
      this.apiLoading = true;
      this.apiError = null;

      try {
        this.ensureStakeholderData(slug);

        const payload = this.buildRespondentPayload(slug, respondentData);
        if (!payload) {
          throw new Error('Payload IKAS tidak valid');
        }

        let response: any;
        const backendIkasId = this.getBackendIkasId(slug);

        if (backendIkasId) {
          response = await ikasService.updateIkas(backendIkasId, payload);
        } else {
          response = await ikasService.createIkas(payload);
        }

        const resolvedId = String(response?.id || response?.data?.id || backendIkasId || '');
        if (!resolvedId) {
          throw new Error('Backend tidak mengembalikan ikas_id');
        }
        this.setBackendIkasId(slug, resolvedId);

        this.backendSyncedMap[slug] = true;
        this.apiLoading = false;
        return { success: true };
      } catch (error: any) {
        console.error('[IKAS Store] Backend submit failed:', error);
        this.apiError = error.message || 'Gagal menyimpan ke server';
        this.apiLoading = false;
        return { success: false, error: this.apiError || undefined };
      }
    },

    /**
     * Fetch existing IKAS data from backend by perusahaan ID
     * and populate the local store.
     * Uses GET /api/maturity/ikas?id_perusahaan={id} then GET /api/maturity/ikas/{id}
     */
    async fetchFromBackend(
      slug: string,
      perusahaanId: string
    ): Promise<{ success: boolean; exists: boolean; error?: string; respondentData?: any; ikasRecord?: any }> {
      this.apiLoading = true;
      this.apiError = null;
      this.resetStakeholderData(slug);
      this.setBackendIkasId(slug, null);

      try {
        const listResponse = await ikasService.getIkasByPerusahaan(perusahaanId);
        const matchedRecord = this.findLatestIkasRecord(
          this.normalizeIkasRecords(listResponse),
          perusahaanId
        );

        if (!matchedRecord) {
          this.backendSyncedMap[slug] = false;
          this.apiLoading = false;
          return { success: true, exists: false };
        }

        // Save the backend IKAS ID for future updates
        this.setBackendIkasId(slug, matchedRecord.id || null);
        this.backendSyncedMap[slug] = true;

        // Fetch full detailed record by ID (includes nested domain scores)
        let detailedResponse: any = matchedRecord;
        if (matchedRecord.id) {
          try {
            const detailed = await ikasService.getIkasById(matchedRecord.id);
            if (detailed) {
              // Handle { data: {...} } wrapper
              detailedResponse = unwrapIkasResponse(detailed);
            }
          } catch (e) {
            console.warn('[IKAS Store] Could not fetch detailed record, using list data');
          }
        }

        // Populate local store from backend data
        const data = this.ikasDataMap[slug];
        const response = detailedResponse;

        if (response.identifikasi) {
          data.identifikasi.nilai_subdomain1 = response.identifikasi.nilai_subdomain1 || 0;
          data.identifikasi.nilai_subdomain2 = response.identifikasi.nilai_subdomain2 || 0;
          data.identifikasi.nilai_subdomain3 = response.identifikasi.nilai_subdomain3 || 0;
          data.identifikasi.nilai_subdomain4 = response.identifikasi.nilai_subdomain4 || 0;
          data.identifikasi.nilai_subdomain5 = response.identifikasi.nilai_subdomain5 || 0;
        }
        if (response.proteksi) {
          data.proteksi.nilai_subdomain1 = response.proteksi.nilai_subdomain1 || 0;
          data.proteksi.nilai_subdomain2 = response.proteksi.nilai_subdomain2 || 0;
          data.proteksi.nilai_subdomain3 = response.proteksi.nilai_subdomain3 || 0;
          data.proteksi.nilai_subdomain4 = response.proteksi.nilai_subdomain4 || 0;
          data.proteksi.nilai_subdomain5 = response.proteksi.nilai_subdomain5 || 0;
          data.proteksi.nilai_subdomain6 = response.proteksi.nilai_subdomain6 || 0;
        }
        if (response.deteksi) {
          data.deteksi.nilai_subdomain1 = response.deteksi.nilai_subdomain1 || 0;
          data.deteksi.nilai_subdomain2 = response.deteksi.nilai_subdomain2 || 0;
          data.deteksi.nilai_subdomain3 = response.deteksi.nilai_subdomain3 || 0;
        }
        if (response.gulih) {
          data.tanggulih.nilai_subdomain1 = response.gulih.nilai_subdomain1 || 0;
          data.tanggulih.nilai_subdomain2 = response.gulih.nilai_subdomain2 || 0;
          data.tanggulih.nilai_subdomain3 = response.gulih.nilai_subdomain3 || 0;
          data.tanggulih.nilai_subdomain4 = response.gulih.nilai_subdomain4 || 0;
        }
        data.is_validated = normalizeValidatedStatus(response, false);
        data.edit_request_status = normalizeEditRequestStatus(response, data.edit_request_status || 'none');
        data.edit_request_reason = normalizeEditRequestReason(response);

        // Recalculate averages from fetched data
        this.recalculate(slug);
        this.saveToStorage();

        this.apiLoading = false;

        // Return respondent data for the caller to populate profiles
        return {
          success: true,
          exists: true,
          respondentData: {
            responden: matchedRecord.responden || '',
            jabatan: matchedRecord.jabatan || '',
            telepon: matchedRecord.telepon || '',
            tanggal: matchedRecord.tanggal || '',
            target_nilai: matchedRecord.target_nilai || 3,
            nilai_kematangan: matchedRecord.nilai_kematangan || 0,
          },
          ikasRecord: matchedRecord
        };
      } catch (error: any) {
        console.error('[IKAS Store] Fetch from backend failed:', error);
        this.apiError = error.message || 'Gagal mengambil data dari server';
        this.apiLoading = false;
        return { success: false, exists: false, error: this.apiError || undefined };
      }
    },

    /**
     * Initialize domains on the backend (POST the 4 main domains).
     * Returns map of domain name -> backend ID.
     */
    async initDomainsOnBackend(): Promise<Record<string, string>> {
      const domainNames = ['Identifikasi', 'Proteksi', 'Deteksi', 'Penanggulangan & Pemulihan'];

      try {
        // First try to get existing domains
        const existing = await ikasService.getDomains();
        if (existing && existing.length > 0) {
          const map: Record<string, string> = {};
          existing.forEach(d => { map[d.nama_domain] = d.id; });
          this.domainIds = map;
          return map;
        }

        // If no domains exist, create them
        const map: Record<string, string> = {};
        for (const name of domainNames) {
          const resp = await ikasService.createDomain({ nama_domain: name });
          map[name] = resp.id;
        }
        this.domainIds = map;
        return map;
      } catch (error: any) {
        console.error('[IKAS Store] Failed to init domains:', error);
        return {};
      }
    },

    /**
     * Submit identifikasi scores to the backend via POST /api/identifikasi.
     */
    async submitIdentifikasi(slug: string): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
      try {
        this.ensureStakeholderData(slug);
        const iden = this.ikasDataMap[slug].identifikasi;
        const ikasId = this.requireBackendIkasId(slug);
        if (!ikasId) {
          return { success: false, error: 'ikas_id belum tersedia' };
        }

        const payload = {
          ikas_id: ikasId,
          id_perusahaan: useStakeholdersStore().getStakeholderBySlug(slug)?.id,
          nilai_identifikasi: Number(iden.nilai_identifikasi) || 0,
          nilai_subdomain1: Number(iden.nilai_subdomain1) || 0,
          nilai_subdomain2: Number(iden.nilai_subdomain2) || 0,
          nilai_subdomain3: Number(iden.nilai_subdomain3) || 0,
          nilai_subdomain4: Number(iden.nilai_subdomain4) || 0,
          nilai_subdomain5: Number(iden.nilai_subdomain5) || 0,
        };

        await ikasService.createIdentifikasi(payload);
        return { success: true };
      } catch (error: any) {
        if (this.isMissingDomainEndpointError(error)) {
          console.warn('[IKAS Store] Identifikasi endpoint not available, skipping domain summary sync');
          return { success: true, skipped: true };
        }
        console.error('[IKAS Store] Identifikasi submit failed:', error);
        return { success: false, error: error.message || 'Gagal menyimpan identifikasi' };
      }
    },

    /**
     * Submit proteksi scores to the backend via POST /api/proteksi.
     */
    async submitProteksi(slug: string): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
      try {
        this.ensureStakeholderData(slug);
        const prot = this.ikasDataMap[slug].proteksi;
        const ikasId = this.requireBackendIkasId(slug);
        if (!ikasId) {
          return { success: false, error: 'ikas_id belum tersedia' };
        }

        const payload = {
          ikas_id: ikasId,
          id_perusahaan: useStakeholdersStore().getStakeholderBySlug(slug)?.id,
          nilai_proteksi: Number(prot.nilai_proteksi) || 0,
          nilai_subdomain1: Number(prot.nilai_subdomain1) || 0,
          nilai_subdomain2: Number(prot.nilai_subdomain2) || 0,
          nilai_subdomain3: Number(prot.nilai_subdomain3) || 0,
          nilai_subdomain4: Number(prot.nilai_subdomain4) || 0,
          nilai_subdomain5: Number(prot.nilai_subdomain5) || 0,
          nilai_subdomain6: Number(prot.nilai_subdomain6) || 0,
        };

        await ikasService.createProteksi(payload);
        return { success: true };
      } catch (error: any) {
        if (this.isMissingDomainEndpointError(error)) {
          console.warn('[IKAS Store] Proteksi endpoint not available, skipping domain summary sync');
          return { success: true, skipped: true };
        }
        console.error('[IKAS Store] Proteksi submit failed:', error);
        return { success: false, error: error.message || 'Gagal menyimpan proteksi' };
      }
    },

    /**
     * Submit deteksi scores to the backend via POST /api/deteksi.
     */
    async submitDeteksi(slug: string): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
      try {
        this.ensureStakeholderData(slug);
        const det = this.ikasDataMap[slug].deteksi;
        const ikasId = this.requireBackendIkasId(slug);
        if (!ikasId) {
          return { success: false, error: 'ikas_id belum tersedia' };
        }

        const payload = {
          ikas_id: ikasId,
          id_perusahaan: useStakeholdersStore().getStakeholderBySlug(slug)?.id,
          nilai_deteksi: Number(det.nilai_deteksi) || 0,
          nilai_subdomain1: Number(det.nilai_subdomain1) || 0,
          nilai_subdomain2: Number(det.nilai_subdomain2) || 0,
          nilai_subdomain3: Number(det.nilai_subdomain3) || 0,
        };

        await ikasService.createDeteksi(payload);
        return { success: true };
      } catch (error: any) {
        if (this.isMissingDomainEndpointError(error)) {
          console.warn('[IKAS Store] Deteksi endpoint not available, skipping domain summary sync');
          return { success: true, skipped: true };
        }
        console.error('[IKAS Store] Deteksi submit failed:', error);
        return { success: false, error: error.message || 'Gagal menyimpan deteksi' };
      }
    },

    /**
     * Submit gulih scores to the backend via POST /api/gulih.
     */
    async submitGulih(slug: string): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
      try {
        this.ensureStakeholderData(slug);
        const tang = this.ikasDataMap[slug].tanggulih;
        const ikasId = this.requireBackendIkasId(slug);
        if (!ikasId) {
          return { success: false, error: 'ikas_id belum tersedia' };
        }

        const payload = {
          ikas_id: ikasId,
          id_perusahaan: useStakeholdersStore().getStakeholderBySlug(slug)?.id,
          nilai_gulih: Number(tang.nilai_tanggulih) || 0,
          nilai_subdomain1: Number(tang.nilai_subdomain1) || 0,
          nilai_subdomain2: Number(tang.nilai_subdomain2) || 0,
          nilai_subdomain3: Number(tang.nilai_subdomain3) || 0,
          nilai_subdomain4: Number(tang.nilai_subdomain4) || 0,
        };

        await ikasService.createGulih(payload);
        return { success: true };
      } catch (error: any) {
        if (this.isMissingDomainEndpointError(error)) {
          console.warn('[IKAS Store] Gulih endpoint not available, skipping domain summary sync');
          return { success: true, skipped: true };
        }
        console.error('[IKAS Store] Gulih submit failed:', error);
        return { success: false, error: error.message || 'Gagal menyimpan gulih' };
      }
    },

    /**
     * Seed the full assessment structure on the backend:
     * 1. Create 4 domains (Identifikasi, Proteksi, Deteksi, Penanggulangan & Pemulihan)
     * 2. Create kategoris per domain
     * 3. Create sub-kategoris per kategori
     * 4. Create ruang lingkup per sub-kategori
     *
     * Uses the static assessmentData structure as the source of truth.
     */
    async seedAssessmentStructure(): Promise<{ success: boolean; error?: string }> {
      try {

        // Import assessment data structure
        const { assessmentData } = await import('@/data/assessment/assessment-data');

        for (const domain of assessmentData.domains) {
          // 1. Create domain
          let domainResp;
          try {
            domainResp = await ikasService.createDomain({ nama_domain: domain.name });
          } catch {
            // Domain may already exist, try fetching
            const res = await ikasService.getDomains();
            const existing = Array.isArray(res) ? res : (res?.data || []);
            domainResp = existing.find((d: any) => d.nama_domain === domain.name);
            if (!domainResp) {
              console.warn(`[IKAS Store] Could not create/find domain: ${domain.name}`);
              continue;
            }
          }
          
          const domainId = domainResp.id || domainResp.data?.id;

          this.domainIds[domain.name] = domainId;

          // 2. Create kategoris per domain
          for (const category of domain.categories) {
            let kategoriResp;
            try {
              kategoriResp = await ikasService.createKategori({
                domain_id: domainId,
                nama_kategori: category.name,
              });
            } catch {
              console.warn(`[IKAS Store] Could not create kategori (might exist): ${category.name}`);
              continue;
            }

            const kategoriId = kategoriResp.id || kategoriResp.data?.id;
            if (!kategoriId) continue;

            // 3. Create sub-kategoris per kategori
            for (const subCategory of category.subCategories) {
              try {
                await ikasService.createSubKategori({
                  kategori_id: kategoriId,
                  nama_sub_kategori: subCategory.name,
                });
              } catch {
                console.warn(`[IKAS Store] Could not create sub-kategori (might exist): ${subCategory.name}`);
              }
            }
          }
        }

        // 4. Create ruang lingkup entries (Tata Kelola, Sumber Daya Manusia, Teknologi)
        const ruangLingkupNames = ['Tata Kelola', 'Sumber Daya Manusia', 'Teknologi'];
        for (const name of ruangLingkupNames) {
          try {
            await ikasService.createRuangLingkup({ nama_ruang_lingkup: name });
          } catch {
            console.warn(`[IKAS Store] Could not create ruang lingkup: ${name}`);
          }
        }

        return { success: true };
      } catch (error: any) {
        console.error('[IKAS Store] Seed assessment structure failed:', error);
        return { success: false, error: error.message || 'Gagal membuat struktur assessment' };
      }
    },

    /**
     * Validate an IKAS record on the backend.
     */
    async validateIkas(slug: string): Promise<{ success: boolean; error?: string }> {
      this.apiLoading = true;
      try {
        const ikasId = this.requireBackendIkasId(slug);
        if (!ikasId) {
          throw new Error('ikas_id belum tersedia');
        }
        const response = await ikasService.validateIkas(ikasId);
        const updated = unwrapIkasResponse(response);
        const editRequestStatus = normalizeEditRequestStatus(updated, 'none');
        this.patchIkasStatus(slug, {
          is_validated: normalizeValidatedStatus(updated, true),
          edit_request_status: editRequestStatus === 'pending' ? 'none' : editRequestStatus,
          edit_request_reason: normalizeEditRequestReason(updated),
        });
        this.ikasVersion++;
        return { success: true };
      } catch (error: any) {
        console.error('[IKAS Store] validateIkas failed:', error);
        return { success: false, error: error.message || 'Gagal memvalidasi IKAS' };
      } finally {
        this.apiLoading = false;
      }
    },

    /**
     * Approve an edit request for an IKAS record.
     */
    async approveEditIkas(slug: string): Promise<{ success: boolean; error?: string }> {
      this.apiLoading = true;
      try {
        const ikasId = this.requireBackendIkasId(slug);
        if (!ikasId) {
          throw new Error('ikas_id belum tersedia');
        }
        const response = await ikasService.approveEditIkas(ikasId);
        const updated = unwrapIkasResponse(response);
        this.patchIkasStatus(slug, {
          is_validated: normalizeValidatedStatus(updated, false),
          edit_request_status: normalizeEditRequestStatus(updated, 'approved'),
          edit_request_reason: normalizeEditRequestReason(updated),
        });
        this.ikasVersion++;
        return { success: true };
      } catch (error: any) {
        console.error('[IKAS Store] approveEditIkas failed:', error);
        return { success: false, error: error.message || 'Gagal menyetujui edit IKAS' };
      } finally {
        this.apiLoading = false;
      }
    },

    /**
     * Request edit for a validated IKAS record.
     */
    async requestEditIkas(slug: string, reason?: string): Promise<{ success: boolean; error?: string }> {
      this.apiLoading = true;
      try {
        const ikasId = this.requireBackendIkasId(slug);
        if (!ikasId) {
          throw new Error('ikas_id belum tersedia');
        }
        const response = await ikasService.requestEditIkas(ikasId, reason);
        const updated = unwrapIkasResponse(response);
        this.patchIkasStatus(slug, {
          is_validated: normalizeValidatedStatus(updated, true),
          edit_request_status: normalizeEditRequestStatus(updated, 'pending'),
          edit_request_reason: normalizeEditRequestReason(updated, reason || ''),
        });
        this.ikasVersion++;
        return { success: true };
      } catch (error: any) {
        console.error('[IKAS Store] requestEditIkas failed:', error);
        return { success: false, error: error.message || 'Gagal mengajukan request edit IKAS' };
      } finally {
        this.apiLoading = false;
      }
    },

    /**
     * Reject an edit request for an IKAS record.
     */
    async rejectEditIkas(slug: string, reason?: string): Promise<{ success: boolean; error?: string }> {
      this.apiLoading = true;
      try {
        const ikasId = this.requireBackendIkasId(slug);
        if (!ikasId) {
          throw new Error('ikas_id belum tersedia');
        }
        const response = await ikasService.rejectEditIkas(ikasId, reason);
        const updated = unwrapIkasResponse(response);
        this.patchIkasStatus(slug, {
          is_validated: normalizeValidatedStatus(updated, true),
          edit_request_status: normalizeEditRequestStatus(updated, 'rejected'),
          edit_request_reason: normalizeEditRequestReason(updated, reason || ''),
        });
        this.ikasVersion++;
        return { success: true };
      } catch (error: any) {
        console.error('[IKAS Store] rejectEditIkas failed:', error);
        return { success: false, error: error.message || 'Gagal menolak edit IKAS' };
      } finally {
        this.apiLoading = false;
      }
    },

    /**
     * Submit all domain scores to backend in one go.
     */
    async submitAllDomainScores(slug: string): Promise<{ success: boolean; errors: string[]; warnings: string[] }> {
      const errors: string[] = [];
      const warnings: string[] = [];

      const idenResult = await this.submitIdentifikasi(slug);
      if (!idenResult.success) errors.push(`Identifikasi: ${idenResult.error}`);
      else if (idenResult.skipped) warnings.push('Identifikasi summary endpoint tidak tersedia');

      const protResult = await this.submitProteksi(slug);
      if (!protResult.success) errors.push(`Proteksi: ${protResult.error}`);
      else if (protResult.skipped) warnings.push('Proteksi summary endpoint tidak tersedia');

      const detResult = await this.submitDeteksi(slug);
      if (!detResult.success) errors.push(`Deteksi: ${detResult.error}`);
      else if (detResult.skipped) warnings.push('Deteksi summary endpoint tidak tersedia');

      const gulihResult = await this.submitGulih(slug);
      if (!gulihResult.success) errors.push(`Gulih: ${gulihResult.error}`);
      else if (gulihResult.skipped) warnings.push('Gulih summary endpoint tidak tersedia');

      return { success: errors.length === 0, errors, warnings };
    },
  },
});
