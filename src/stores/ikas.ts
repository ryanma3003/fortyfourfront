// stores/ikas.ts
import { defineStore } from 'pinia';

// Interface untuk data IKAS per domain
export interface IkasIdentifikasi {
  nilai_identifikasi: number;
  kategori_identifikasi: string;
  nilai_subdomain1: number | null;
  nilai_subdomain2: number | null;
  nilai_subdomain3: number | null;
  nilai_subdomain4: number | null;
  nilai_subdomain5: number | null;
}

export interface IkasProteksi {
  nilai_proteksi: number;
  kategori_proteksi: string;
  nilai_subdomain1: number | null;
  nilai_subdomain2: number | null;
  nilai_subdomain3: number | null;
  nilai_subdomain4: number | null;
  nilai_subdomain5: number | null;
  nilai_subdomain6: number | null;
}

export interface IkasDeteksi {
  nilai_deteksi: number;
  kategori_deteksi: string;
  nilai_subdomain1: number | null;
  nilai_subdomain2: number | null;
  nilai_subdomain3: number | null;
}

export interface IkasGulih {
  nilai_gulih: number;
  kategori_gulih: string;
  nilai_subdomain1: number | null;
  nilai_subdomain2: number | null;
  nilai_subdomain3: number | null;
  nilai_subdomain4: number | null;
}

export interface IkasData {
  total_rata_rata: number;
  total_kategori: string;
  identifikasi: IkasIdentifikasi;
  proteksi: IkasProteksi;
  deteksi: IkasDeteksi;
  gulih: IkasGulih;
}

// Helper function untuk label maturity
export const getMaturityLabel = (score: number): string => {
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
  gulih: {
    nilai_gulih: 0,
    kategori_gulih: "INPUT BELUM LENGKAP",
    nilai_subdomain1: 0,
    nilai_subdomain2: 0,
    nilai_subdomain3: 0,
    nilai_subdomain4: 0,
  }
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

    // Recalculate domain averages dan total
    recalculate(slug: string) {
      const data = this.ikasDataMap[slug];
      if (!data) return;

      // Helper for calculating average ignoring nulls
      const calculateAverage = (values: (number | null)[]): number => {
        const validValues = values.filter((v): v is number => v !== null);
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

      // Gulih
      const gul = data.gulih;
      const gulValues = [
        gul.nilai_subdomain1,
        gul.nilai_subdomain2,
        gul.nilai_subdomain3,
        gul.nilai_subdomain4
      ];
      gul.nilai_gulih = calculateAverage(gulValues);
      gul.kategori_gulih = getMaturityLabel(gul.nilai_gulih);

      // Total
      const totalValues = [
        iden.nilai_identifikasi,
        prot.nilai_proteksi,
        det.nilai_deteksi,
        gul.nilai_gulih
      ];
      // Note: We use simple average of domain scores here regardless of how many subdomains they have
      data.total_rata_rata = Number((totalValues.reduce((a, b) => a + b, 0) / 4).toFixed(2));
      data.total_kategori = getMaturityLabel(data.total_rata_rata);
    },

    // Reset data untuk stakeholder tertentu
    resetStakeholderData(slug: string) {
      this.ikasDataMap[slug] = createDefaultIkasData();
      this.saveToStorage();
    },
  },
});
