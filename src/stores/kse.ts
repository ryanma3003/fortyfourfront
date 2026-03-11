// stores/kse.ts
import { defineStore } from 'pinia';
import { kseCategories, getKategoriSE } from '../data/kse-data';
import type { SeCsirt } from '../types/csirt.types';

// Reverse mapping: API field name → question number
const fieldToQuestion: Record<string, string> = {
  nilai_investasi: '1.1',
  anggaran_operasional: '1.2',
  kepatuhan_peraturan: '1.3',
  teknik_kriptografi: '1.4',
  jumlah_pengguna: '1.5',
  data_pribadi: '1.6',
  klasifikasi_data: '1.7',
  kekritisan_proses: '1.8',
  dampak_kegagalan: '1.9',
  potensi_kerugian_dan_dampak_negatif: '1.10',
};

// Build a lookup: questionNo → { optionKey → bobot }
const questionBobotMap: Record<string, Record<string, number>> = {};
kseCategories.forEach(cat => {
  cat.questions.forEach(q => {
    questionBobotMap[q.no] = {
      A: q.options.A.bobot,
      B: q.options.B.bobot,
      C: q.options.C.bobot,
    };
  });
});

export interface KseAnswer {
  questionNo: string;
  selectedOption: 'A' | 'B' | 'C' | null;
  bobot: number;
}

export interface KseStakeholderData {
  namaPerusahaan: string;
  jenisUsaha: string;
  answers: Record<string, KseAnswer>;
  totalBobot: number;
  kategoriSE: string;
  kategoriColor: string;
  lastUpdated: string;
  isSubmitted: boolean;
}

const STORAGE_KEY = 'app_kse_data';

// Create default answers structure
const createDefaultAnswers = (): Record<string, KseAnswer> => {
  const answers: Record<string, KseAnswer> = {};
  kseCategories.forEach(cat => {
    cat.questions.forEach(q => {
      answers[q.no] = {
        questionNo: q.no,
        selectedOption: null,
        bobot: 0,
      };
    });
  });
  return answers;
};

const createDefaultKseData = (): KseStakeholderData => ({
  namaPerusahaan: '',
  jenisUsaha: '',
  answers: createDefaultAnswers(),
  totalBobot: 0,
  kategoriSE: 'Belum Dikategorikan',
  kategoriColor: '#6c757d',
  lastUpdated: '',
  isSubmitted: false,
});

export const useKseStore = defineStore('kse', {
  state: () => ({
    kseDataMap: {} as Record<string, KseStakeholderData>,
    initialized: false,
    kseVersion: 0, // incremented on every save — lets other components react to changes
  }),

  getters: {
    getKseData(): (slug: string) => KseStakeholderData {
      return (slug: string) => {
        if (!this.kseDataMap[slug]) {
          this.kseDataMap[slug] = createDefaultKseData();
        }
        return this.kseDataMap[slug];
      };
    },

    // Get completion percentage for a stakeholder
    getCompletionPercentage(): (slug: string) => number {
      return (slug: string) => {
        const data = this.getKseData(slug);
        const totalQuestions = Object.keys(data.answers).length;
        const answeredQuestions = Object.values(data.answers).filter(
          a => a.selectedOption !== null
        ).length;
        return Math.round((answeredQuestions / totalQuestions) * 100);
      };
    },
  },

  actions: {
    initialize() {
      if (this.initialized) return;

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          this.kseDataMap = JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse stored KSE data:', e);
          this.kseDataMap = {};
        }
      }
      this.initialized = true;
      this.kseVersion++; // signal watchers that store is now loaded
    },

    saveToStorage() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.kseDataMap));
      this.kseVersion++; // signal all watchers that KSE data has changed
    },

    ensureStakeholderData(slug: string) {
      if (!this.kseDataMap[slug]) {
        this.kseDataMap[slug] = createDefaultKseData();
      }
    },

    // Update a single answer
    updateAnswer(
      slug: string,
      questionNo: string,
      selectedOption: 'A' | 'B' | 'C' | null,
      bobot: number
    ) {
      this.ensureStakeholderData(slug);
      const data = this.kseDataMap[slug];
      
      // Prevent update if submitted
      if (data.isSubmitted) return;

      data.answers[questionNo] = {
        questionNo,
        selectedOption,
        bobot,
      };

      this.recalculate(slug);
      this.saveToStorage();
    },

    // Update stakeholder info
    updateStakeholderInfo(slug: string, namaPerusahaan: string, jenisUsaha: string) {
      this.ensureStakeholderData(slug);
      this.kseDataMap[slug].namaPerusahaan = namaPerusahaan;
      this.kseDataMap[slug].jenisUsaha = jenisUsaha;
      this.saveToStorage();
    },

    // Bulk update all data
    updateAllData(slug: string, newData: Partial<KseStakeholderData>) {
      this.ensureStakeholderData(slug);
      this.kseDataMap[slug] = {
        ...this.kseDataMap[slug],
        ...newData,
      };
      this.recalculate(slug);
      this.saveToStorage();
    },

    // Recalculate total and category
    recalculate(slug: string) {
      const data = this.kseDataMap[slug];
      if (!data) return;

      // Calculate total bobot
      let total = 0;
      Object.values(data.answers).forEach(answer => {
        if (answer.selectedOption !== null) {
          total += answer.bobot;
        }
      });
      data.totalBobot = total;

      // Determine category
      const kategori = getKategoriSE(total);
      data.kategoriSE = kategori.kategori;
      data.kategoriColor = kategori.color;
      data.lastUpdated = new Date().toISOString();
    },

    // Reset data for a stakeholder
    resetStakeholderData(slug: string) {
      this.kseDataMap[slug] = createDefaultKseData();
      this.saveToStorage();
    },
    
    // Submit data (Lock)
    submitData(slug: string) {
      this.ensureStakeholderData(slug);
      this.kseDataMap[slug].isSubmitted = true;
      this.saveToStorage();
    },
    
    // Unlock data (Edit)
    unlockData(slug: string) {
      this.ensureStakeholderData(slug);
      this.kseDataMap[slug].isSubmitted = false;
      this.saveToStorage();
    },

    /**
     * Load penilaian answers from API SE data.
     * Reverse-maps API fields (e.g. nilai_investasi: 'A') to KSE question answers.
     */
    loadAnswersFromApi(slug: string, seData: SeCsirt) {
      this.ensureStakeholderData(slug);
      const data = this.kseDataMap[slug];

      let hasChanges = false;

      Object.entries(fieldToQuestion).forEach(([field, questionNo]) => {
        const optionKey = (seData as any)[field] as string | undefined;
        if (optionKey && (optionKey === 'A' || optionKey === 'B' || optionKey === 'C')) {
          const bobot = questionBobotMap[questionNo]?.[optionKey] ?? 0;
          
          // Overwrite the local answer to forcefully sync with the True API source of truth
          if (data.answers[questionNo]?.selectedOption !== optionKey) {
            data.answers[questionNo] = {
              questionNo,
              selectedOption: optionKey as 'A' | 'B' | 'C',
              bobot,
            };
            hasChanges = true;
          }
        }
      });

      if (hasChanges) {
        this.recalculate(slug);
      }

      // Any SE that exists in the backend API was created via 'Simpan & Selesai'.
      // Therefore, it must be considered fully submitted (Final).
      data.isSubmitted = true;

      this.saveToStorage();
    },
  },
});
