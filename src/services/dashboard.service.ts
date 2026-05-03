import { api } from '@/config/api';

/**
 * Dashboard Service
 * Handles data fetching for the Dashboard Summary.
 *
 * The backend split the old /api/dashboard/summary endpoint into:
 *   GET /api/dashboard/sektor
 *   GET /api/dashboard/ikas
 *   GET /api/dashboard/se
 *   GET /api/dashboard/csirt
 *
 * This service keeps the previous summary shape available for existing
 * dashboard consumers, while exposing the raw split responses for richer UI.
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

export interface CsirtData {
    belum_lengkap: number;
    lengkap: number;
    punya_sdm: number;
    punya_se: number;
    this_month: number;
    total_csirt: number;
}

export interface CsirtStatus {
    belum_membentuk_csirt: number;
    sudah_membentuk_csirt: number;
    total_perusahaan: number;
}

export interface SektorCount {
    id: string;
    nama_sektor: string;
    this_month: number;
    total: number;
    countYear?: number;
    countQuarter?: number;
}

export interface DashboardSummary {
    kse: KseData;
    kse_status: KseStatus;
    sektor_counts: SektorCount[];
    ikas?: {
        avg_nilai_kematangan: number;
        avg_target_nilai: number;
        total_ikas: number;
    };
    ikas_status?: {
        belum_mengisi_ikas: number;
        sudah_mengisi_ikas: number;
        total_perusahaan: number;
    };
    se?: Record<string, any>;
    csirt?: Record<string, any>;
    csirt_summary?: CsirtData;
    csirt_status?: CsirtStatus;
    raw?: {
        sektor?: any;
        ikas?: any;
        se?: any;
        csirt?: any;
    };
    endpointStatus?: Record<'sektor' | 'ikas' | 'se' | 'csirt', {
        ok: boolean;
        endpoint: string;
        error?: string;
    }>;
}

export interface DashboardSummaryParams {
    from?: string;       // Start date (YYYY-MM-DD)
    to?: string;         // End date (YYYY-MM-DD)
    year?: string;       // Filter per tahun, misal 2025
    quarter?: string;    // Filter per kuartal (1-4), harus digunakan bersama year
    sektor_id?: string;  // Filter per sektor (UUID)
    sub_sektor_id?: string; // Filter per sub-sektor (UUID)
    kategori_se?: string;   // Filter kategori SE: Strategis | Tinggi | Rendah
}

const DASHBOARD_ENDPOINTS = {
    sektor: '/api/dashboard/sektor',
    ikas: '/api/dashboard/ikas',
    se: '/api/dashboard/se',
    csirt: '/api/dashboard/csirt',
} as const;

type DashboardEndpointKey = keyof typeof DASHBOARD_ENDPOINTS;

const numberValue = (value: unknown): number => {
    const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
};

const unwrapPayload = (response: any): any => {
    if (response && typeof response === 'object' && 'data' in response) {
        return response.data;
    }
    return response;
};

const firstNumber = (source: any, keys: string[]): number => {
    const normalizedSource = source && typeof source === 'object' ? source : {};

    const findCaseInsensitive = (target: any, key: string): unknown => {
        if (!target || typeof target !== 'object') return undefined;
        const direct = target[key];
        if (direct !== undefined) return direct;

        const foundKey = Object.keys(target).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
        return foundKey ? target[foundKey] : undefined;
    };

    for (const key of keys) {
        const value = key.split('.').reduce((acc, part) => findCaseInsensitive(acc, part), normalizedSource);
        if (value !== undefined && value !== null && value !== '') return numberValue(value);
    }
    return 0;
};

const asArray = (value: any): any[] => {
    const payload = unwrapPayload(value);
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.sektor_counts)) return payload.sektor_counts;
    if (Array.isArray(payload?.sektor)) return payload.sektor;
    if (Array.isArray(payload?.sektors)) return payload.sektors;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.records)) return payload.records;
    return [];
};

const buildEndpoint = (baseEndpoint: string, params?: DashboardSummaryParams, key?: DashboardEndpointKey): string => {
    if (!params) return baseEndpoint;

    const query = new URLSearchParams();
    if (params.from) query.append('from', params.from);
    if (params.to) query.append('to', params.to);
    if (params.year) query.append('year', params.year);
    if (params.quarter) query.append('quarter', params.quarter);
    if (params.sektor_id) query.append('sektor_id', params.sektor_id);
    if (params.sub_sektor_id) query.append('sub_sektor_id', params.sub_sektor_id);
    if (key === 'se' && params.kategori_se) query.append('kategori_se', params.kategori_se);

    const qs = query.toString();
    return qs ? `${baseEndpoint}?${qs}` : baseEndpoint;
};

const mapSektorCounts = (sektorPayload: any): SektorCount[] => {
    return asArray(sektorPayload).map((item) => ({
        id: String(item?.id ?? item?.sektor_id ?? item?.sub_sektor_id ?? item?.nama_sektor ?? item?.nama ?? ''),
        nama_sektor: String(item?.nama_sektor ?? item?.nama_sub_sektor ?? item?.nama ?? item?.label ?? 'Tidak diketahui'),
        this_month: numberValue(item?.this_month ?? item?.bulan_ini ?? item?.month_count ?? 0),
        total: numberValue(item?.total ?? item?.count ?? item?.jumlah ?? item?.total_perusahaan ?? 0),
        countYear: numberValue(item?.countYear ?? item?.count_year ?? item?.tahun_ini ?? item?.year_count ?? 0),
        countQuarter: numberValue(item?.countQuarter ?? item?.count_quarter ?? item?.kuartal_ini ?? item?.quarter_count ?? 0),
    }));
};

const mapKseData = (sePayload: any): KseData => {
    const payload = unwrapPayload(sePayload) || {};
    const source = payload.kse || payload.summary || payload;
    const kategori = source.kategori || source.kategori_se || {};

    return {
        rendah: firstNumber({ ...source, kategori }, ['rendah', 'kategori.rendah', 'kategori_se.rendah']),
        strategis: firstNumber({ ...source, kategori }, ['strategis', 'kategori.strategis', 'kategori_se.strategis']),
        this_month: firstNumber(source, ['this_month', 'bulan_ini', 'periode_ini']),
        tinggi: firstNumber({ ...source, kategori }, ['tinggi', 'kategori.tinggi', 'kategori_se.tinggi']),
        total_se: firstNumber(source, ['total_se', 'total_kse', 'total_sistem_elektronik', 'total', 'jumlah', 'count']),
    };
};

const mapKseStatus = (sePayload: any): KseStatus => {
    const payload = unwrapPayload(sePayload) || {};
    const source = payload.kse_status || payload.status_pengisian || payload.status || payload;

    return {
        belum_mengisi_kse: firstNumber(source, ['belum_mengisi_kse', 'belum_mengisi', 'belum', 'not_filled']),
        sudah_mengisi_kse: firstNumber(source, ['sudah_mengisi_kse', 'sudah_mengisi', 'sudah', 'filled']),
        total_perusahaan: firstNumber(source, ['total_perusahaan', 'total_stakeholder', 'total_stakeholders', 'total']),
    };
};

const mapIkasData = (ikasPayload: any): NonNullable<DashboardSummary['ikas']> => {
    const payload = unwrapPayload(ikasPayload) || {};
    const source = payload.ikas || payload.summary || payload;

    return {
        avg_nilai_kematangan: firstNumber(source, ['avg_nilai_kematangan', 'avgNilaiKematangan', 'average_nilai_kematangan']),
        avg_target_nilai: firstNumber(source, ['avg_target_nilai', 'avgTargetNilai', 'average_target_nilai']),
        total_ikas: firstNumber(source, ['total_ikas', 'totalIkas', 'total', 'count']),
    };
};

const mapIkasStatus = (ikasPayload: any): NonNullable<DashboardSummary['ikas_status']> => {
    const payload = unwrapPayload(ikasPayload) || {};
    const source = payload.ikas_status || payload.status_pengisian || payload.status || payload;

    return {
        belum_mengisi_ikas: firstNumber(source, ['belum_mengisi_ikas', 'belum_mengisi', 'belum', 'not_filled']),
        sudah_mengisi_ikas: firstNumber(source, ['sudah_mengisi_ikas', 'sudah_mengisi', 'sudah', 'filled']),
        total_perusahaan: firstNumber(source, ['total_perusahaan', 'total_stakeholder', 'total_stakeholders', 'total']),
    };
};

const mapCsirtData = (csirtPayload: any): CsirtData => {
    const payload = unwrapPayload(csirtPayload) || {};
    const source = payload.csirt || payload.summary || payload.agregasi || payload;
    const status = source.status || source.status_pembentukan || {};

    return {
        belum_lengkap: firstNumber({ ...source, status }, ['belum_lengkap', 'incomplete', 'status.belum_lengkap']),
        lengkap: firstNumber({ ...source, status }, ['lengkap', 'complete', 'status.lengkap']),
        punya_sdm: firstNumber(source, ['punya_sdm', 'total_sdm_csirt', 'total_sdm', 'sdm']),
        punya_se: firstNumber(source, ['punya_se', 'total_se_csirt', 'total_se', 'se']),
        this_month: firstNumber(source, ['this_month', 'bulan_ini', 'periode_ini']),
        total_csirt: firstNumber(source, ['total_csirt', 'total', 'jumlah', 'count']),
    };
};

const mapCsirtStatus = (csirtPayload: any): CsirtStatus => {
    const payload = unwrapPayload(csirtPayload) || {};
    const source = payload.csirt_status || payload.status_pembentukan || payload.status || payload;

    return {
        belum_membentuk_csirt: firstNumber(source, ['belum_membentuk_csirt', 'belum_membentuk', 'belum', 'not_formed', 'belum_mengisi']),
        sudah_membentuk_csirt: firstNumber(source, ['sudah_membentuk_csirt', 'sudah_membentuk', 'sudah', 'formed', 'sudah_mengisi']),
        total_perusahaan: firstNumber(source, ['total_perusahaan', 'total_stakeholder', 'total_stakeholders', 'total']),
    };
};

const buildSplitSummary = (
    results: Partial<Record<DashboardEndpointKey, any>>,
    endpointStatus: DashboardSummary['endpointStatus'],
): DashboardSummary => {
    const sektor = unwrapPayload(results.sektor);
    const ikas = unwrapPayload(results.ikas);
    const se = unwrapPayload(results.se);
    const csirt = unwrapPayload(results.csirt);

    return {
        kse: mapKseData(se),
        kse_status: mapKseStatus(se),
        sektor_counts: mapSektorCounts(sektor),
        ikas: mapIkasData(ikas),
        ikas_status: mapIkasStatus(ikas),
        csirt_summary: mapCsirtData(csirt),
        csirt_status: mapCsirtStatus(csirt),
        se,
        csirt,
        raw: { sektor, ikas, se, csirt },
        endpointStatus,
    };
};

export const dashboardService = {
    /**
     * Get dashboard summary data with optional filters.
     * Fetches the four split dashboard endpoints and merges them into the
     * previous consumer-friendly shape.
     */
    async getSummary(params?: DashboardSummaryParams): Promise<DashboardSummary> {
        const entries = Object.entries(DASHBOARD_ENDPOINTS) as [DashboardEndpointKey, string][];
        const settled = await Promise.allSettled(
            entries.map(([key, endpoint]) => api.get<any>(buildEndpoint(endpoint, params, key)).then((data) => ({ key, data }))),
        );

        const data: Partial<Record<DashboardEndpointKey, any>> = {};
        const endpointStatus = {} as NonNullable<DashboardSummary['endpointStatus']>;

        settled.forEach((result, index) => {
            const [key, endpoint] = entries[index];
            if (result.status === 'fulfilled') {
                data[key] = result.value.data;
                endpointStatus[key] = { ok: true, endpoint };
            } else {
                endpointStatus[key] = {
                    ok: false,
                    endpoint,
                    error: result.reason instanceof Error ? result.reason.message : 'Gagal memuat data',
                };
            }
        });

        if (!Object.values(endpointStatus).some((status) => status.ok)) {
            const message = Object.values(endpointStatus)
                .map((status) => `${status.endpoint}: ${status.error}`)
                .join(' | ');
            throw new Error(message || 'Gagal memuat semua ringkasan dashboard');
        }

        return buildSplitSummary(data, endpointStatus);
    },
};
