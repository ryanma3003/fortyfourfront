import { defineStore } from 'pinia';
import { dashboardService } from '@/services/dashboard.service';

function debounce(fn: Function, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

export const useDashboardFilterStore = defineStore('dashboardFilter', {
  state: () => ({
    // Using string "YYYY-MM-DD" or null to easily pass to API
    dateRange: [null, null] as [string | null, string | null],
    year: String(new Date().getFullYear()),
    quarter: '' as string,
    sektorId: '' as string,
    subSektorId: '' as string,
    kategoriSe: '' as string,
    
    // Global data
    isLoading: false,
    error: null as string | null,
    summaryData: null as any,
  }),

  getters: {
    /**
     * Builds the parameters for the API call based on current state.
     */
    apiParams(state) {
      const params: any = {};
      if (state.dateRange[0]) params.from = state.dateRange[0];
      if (state.dateRange[1]) params.to = state.dateRange[1];
      if (state.year) params.year = state.year;
      if (state.quarter) params.quarter = state.quarter;
      // sub_sektor_id is NOT sent to API (backend SQL bug with NULL this_month).
      // Sub-sektor filtering is handled client-side in Dashboard computed properties.
      if (state.sektorId) params.sektor_id = state.sektorId;
      if (state.kategoriSe) params.kategori_se = state.kategoriSe;
      return params;
    },

    /**
     * Returns a human readable string of the current active filters.
     */
    activeFilterLabel(state) {
      let label = state.year ? state.year : 'Semua Waktu';
      if (state.quarter) {
        label = `Q${state.quarter} ${label}`;
      } else if (state.dateRange[0] && state.dateRange[1] && !state.year) {
        label = `${state.dateRange[0]} - ${state.dateRange[1]}`;
      }
      const sektorText = state.sektorId ? 'Filter Sektor Aktif' : 'Semua Sektor';
      return `${label} | ${sektorText}`;
    }
  },

  actions: {
    // ---- Synchronized Setters ----

    updateDateRange(start: Date | string | null, end: Date | string | null) {
      const startStr = this.formatDate(start);
      const endStr = this.formatDate(end);
      this.dateRange = [startStr, endStr];

      // Auto sync year & quarter if possible
      if (startStr && startStr === endStr) {
        // Just one day selected? We keep year/quarter synced if it happens to be 1 Jan - 31 Dec
        // but typically user doesn't pick that. Let's not strictly override year/quarter unless it matches boundaries.
      } else if (startStr && endStr) {
        const dStart = new Date(startStr);
        const dEnd = new Date(endStr);
        if (dStart.getMonth() === 0 && dStart.getDate() === 1 && dEnd.getMonth() === 11 && dEnd.getDate() === 31 && dStart.getFullYear() === dEnd.getFullYear()) {
          this.year = String(dStart.getFullYear());
          this.quarter = '';
        } else {
          // If custom range, we clear year/quarter so that range is the primary truth
          this.year = '';
          this.quarter = '';
        }
      }

      this.triggerFetch();
    },

    updateYear(yearVal: string) {
      this.year = yearVal;
      if (yearVal) {
        if (!this.quarter) {
          // Set to full year
          this.dateRange = [`${yearVal}-01-01`, `${yearVal}-12-31`];
        } else {
          this.updateQuarter(this.quarter, yearVal);
          return; // updateQuarter handles the triggerFetch and dateRange
        }
      } else {
        this.dateRange = [null, null];
        this.quarter = '';
      }
      this.triggerFetch();
    },

    updateQuarter(qVal: string, yVal?: string) {
      this.quarter = qVal;
      const targetYear = yVal || this.year || String(new Date().getFullYear());
      this.year = targetYear;

      if (qVal) {
        const qInt = parseInt(qVal);
        const startMonth = (qInt - 1) * 3;
        const start = new Date(parseInt(targetYear), startMonth, 1);
        const end = new Date(parseInt(targetYear), startMonth + 3, 0); // last day of 3rd month in quarter
        this.dateRange = [this.formatDate(start), this.formatDate(end)];
      } else {
        // Fall back to full year if quarter cleared
        this.dateRange = [`${targetYear}-01-01`, `${targetYear}-12-31`];
      }
      this.triggerFetch();
    },

    setSektorId(id: string) {
      this.sektorId = id;
      this.subSektorId = ''; // Reset sub-sektor
      this.triggerFetch();
    },

    setSubSektorId(id: string) {
      this.subSektorId = id;
      // No API fetch — sub-sektor filtering is handled client-side
      // (backend SQL bug with NULL this_month on sub_sektor_id filter)
      this.saveToStorage();
    },

    setKategoriSe(kategori: string) {
      this.kategoriSe = kategori;
      this.triggerFetch();
    },

    resetFilter() {
      this.year = String(new Date().getFullYear());
      this.quarter = '';
      this.sektorId = '';
      this.subSektorId = '';
      this.kategoriSe = '';
      this.dateRange = [`${this.year}-01-01`, `${this.year}-12-31`];
      this.triggerFetch();
    },

    // Format utility
    formatDate(d: any): string | null {
      if (!d) return null;
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return null;
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    },

    // ---- Data Fetching ----

    /**
     * Debounced wrapper. Calls the actual fetch function.
     */
    triggerFetch: debounce(async function(this: any) {
      await this.fetchDashboardData();
    }, 400),

    async fetchDashboardData() {
      this.isLoading = true;
      this.error = null;
      try {
        const data = await dashboardService.getSummary(this.apiParams);
        this.summaryData = data;
        this.saveToStorage();
      } catch (err: any) {
        console.error('Failed to fetch dashboard summary globally:', err);
        this.error = err.message || 'Gagal memuat data ringkasan dashboard';
      } finally {
        this.isLoading = false;
      }
    },

    // ---- Local Storage ----
    
    saveToStorage() {
      try {
        const persistState = {
          dateRange: this.dateRange,
          year: this.year,
          quarter: this.quarter,
          sektorId: this.sektorId,
          subSektorId: this.subSektorId,
          kategoriSe: this.kategoriSe
        };
        localStorage.setItem('dashboard_filter', JSON.stringify(persistState));
      } catch(e) { }
    },

    loadFromStorage() {
      try {
        const val = localStorage.getItem('dashboard_filter');
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed.year) this.year = parsed.year;
          if (parsed.quarter !== undefined) this.quarter = parsed.quarter;
          if (parsed.dateRange) this.dateRange = parsed.dateRange;
          if (parsed.sektorId) this.sektorId = parsed.sektorId;
          if (parsed.subSektorId) this.subSektorId = parsed.subSektorId;
          if (parsed.kategoriSe) this.kategoriSe = parsed.kategoriSe;
        } else {
          // Default initialization
          this.dateRange = [`${this.year}-01-01`, `${this.year}-12-31`];
        }
      } catch(e) { }
    }
  }
});
