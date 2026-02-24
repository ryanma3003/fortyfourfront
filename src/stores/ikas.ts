// stores/ikas.ts
import { defineStore } from 'pinia';
import { assessmentData } from '@/data/assessment/assessment-data';
import {
  assessmentToIkasMapping,
  getQuestionIdsForSubdomain,
  calculateSubdomainScore
} from '@/data/assessment/assessment-ikas-mapping';

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
  details: Record<string, Record<string, Record<string, number>>>;
}

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
  details: {}
});

const STORAGE_KEY = 'app_ikas_data';

export const useIkasStore = defineStore('ikas', {
  state: () => ({
    // Map: stakeholder slug -> IkasData
    ikasDataMap: {} as Record<string, IkasData>,
    initialized: false,
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
    // Initialize dari localStorage
    initialize() {
      if (this.initialized) return;

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          this.ikasDataMap = JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse stored IKAS data:', e);
          this.ikasDataMap = {};
        }
      }
      this.initialized = true;
    },

    // Save ke localStorage
    saveToStorage() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ikasDataMap));
    },

    // Ensure stakeholder data exists
    ensureStakeholderData(slug: string) {
      if (!this.ikasDataMap[slug]) {
        this.ikasDataMap[slug] = createDefaultIkasData();
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
  },
});
