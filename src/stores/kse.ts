// stores/kse.ts
import { defineStore } from 'pinia';
import { kseCategories, getKategoriSE } from '../data/kse-data';

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
  },
});
