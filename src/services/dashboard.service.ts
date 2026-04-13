import { api } from '@/config/api';

/**
 * Dashboard Service
 * Handles data fetching for the Dashboard Summary.
 *
 * GET /api/dashboard/summary
 *   Response: { kse, kse_status, sektor_counts[] }
 *   Params:   from, to, year, quarter, sub_sektor_id, kategori_se
 */

export interface KseData {
    rendah: number;
    strategis: number;
    this_month: number;
    tinggi: number;
    total_se: number;
}

export interface KseStatus {
    belum_mengisi_kse: number;
    sudah_mengisi_kse: number;
    total_perusahaan: number;
}

export interface SektorCount {
    id: string;
    nama_sektor: string;
    this_month: number;
    total: number;
}

export interface DashboardSummary {
    kse: KseData;
    kse_status: KseStatus;
    sektor_counts: SektorCount[];
}

export interface DashboardSummaryParams {
    from?: string;       // Start date (YYYY-MM-DD)
    to?: string;         // End date (YYYY-MM-DD)
    year?: string;       // Filter per tahun, misal 2025
    quarter?: string;    // Filter per kuartal (1-4), harus digunakan bersama year
    sub_sektor_id?: string; // Filter per sub-sektor (UUID)
    kategori_se?: string;   // Filter kategori SE: Strategis | Tinggi | Rendah
}

export const dashboardService = {
    /**
     * Get dashboard summary data with optional filters
     */
    async getSummary(params?: DashboardSummaryParams): Promise<DashboardSummary> {
        let endpoint = '/api/dashboard/summary';

        if (params) {
            const query = new URLSearchParams();
            if (params.from) query.append('from', params.from);
            if (params.to) query.append('to', params.to);
            if (params.year) query.append('year', params.year);
            if (params.quarter) query.append('quarter', params.quarter);
            if (params.sub_sektor_id) query.append('sub_sektor_id', params.sub_sektor_id);
            if (params.kategori_se) query.append('kategori_se', params.kategori_se);

            const qs = query.toString();
            if (qs) endpoint += `?${qs}`;
        }

        return api.get<DashboardSummary>(endpoint);
    },
};
