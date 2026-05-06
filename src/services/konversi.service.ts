import { api } from '@/config/api';

export interface KonversiPoinRecord {
    nama_perusahaan: string;
    persentase: number;
    perusahaan_id: string;
    poin_csirt: number;
    poin_ikas: number;
    poin_kse: number;
    poin_survey: number;
    post_survey: number;
    total_poin: number;
    [key: string]: any;
}

export interface KonversiPoinResult {
    records: KonversiPoinRecord[];
    total: number;
    message?: string;
    status?: string;
}

export interface KonversiProgress {
    completed: number;
    total: number;
    percent: number;
    isComplete: boolean;
}

export interface KonversiPointMetric {
    key: string;
    label: string;
    value: number;
    isComplete: boolean;
}

const numberValue = (value: unknown): number => {
    const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
};

const clampPercent = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const hasValue = (value: unknown): boolean => value !== undefined && value !== null && value !== '';

export const KONVERSI_POINT_LABELS: Record<string, string> = {
    poin_ikas: 'IKAS',
    poin_kse: 'KSE',
    poin_survey: 'Survey',
    post_survey: 'Post Survey',
    poin_csirt: 'CSIRT',
};

const DEFAULT_KONVERSI_POINT_KEYS = ['poin_ikas', 'poin_kse', 'poin_csirt', 'poin_survey'];

const looksLikeRecord = (value: any): boolean => {
    if (!value || typeof value !== 'object') return false;
    return ['nama_perusahaan', 'persentase', 'perusahaan_id', 'id_perusahaan', 'poin_csirt', 'poin_ikas', 'poin_kse', 'poin_survey', 'total_poin']
        .some((key) => hasValue(value[key]));
};

const normalizeRecord = (item: any): KonversiPoinRecord => ({
    ...item,
    nama_perusahaan: String(item?.nama_perusahaan ?? item?.perusahaan?.nama_perusahaan ?? item?.nama ?? '-'),
    persentase: numberValue(item?.persentase ?? item?.percentage ?? item?.percent),
    perusahaan_id: String(item?.perusahaan_id ?? item?.id_perusahaan ?? item?.perusahaan?.id ?? ''),
    poin_csirt: numberValue(item?.poin_csirt),
    poin_ikas: numberValue(item?.poin_ikas),
    poin_kse: numberValue(item?.poin_kse),
    poin_survey: numberValue(item?.poin_survey),
    post_survey: numberValue(item?.post_survey),
    total_poin: numberValue(item?.total_poin),
});

export const normalizeKonversiResponse = (response: any): KonversiPoinResult => {
    const recordsSource = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
            ? response.data
            : looksLikeRecord(response?.data)
                ? [response.data]
            : Array.isArray(response?.records)
                ? response.records
                : Array.isArray(response?.items)
                    ? response.items
                    : looksLikeRecord(response)
                        ? [response]
                    : [];

    const records = recordsSource.map(normalizeRecord);
    const total = numberValue(response?.total ?? response?.total_perusahaan ?? records.length);

    return {
        records,
        total: total || records.length,
        message: response?.message,
        status: response?.status,
    };
};

export const getKonversiProgress = (record: KonversiPoinRecord | null | undefined): KonversiProgress => {
    if (!record) {
        return { completed: 0, total: DEFAULT_KONVERSI_POINT_KEYS.length, percent: 0, isComplete: false };
    }

    const pointValues = getKonversiPointMetrics(record).map((item) => item.value);
    const completedPoints = pointValues.filter((point) => point > 0).length;
    const totalPoints = pointValues.length || DEFAULT_KONVERSI_POINT_KEYS.length;
    const apiPercent = numberValue(record.persentase);
    const percent = clampPercent(apiPercent > 0 || completedPoints === 0 ? apiPercent : (completedPoints / totalPoints) * 100);
    const isComplete = percent >= 100 || completedPoints === totalPoints;
    const completed = completedPoints;

    return {
        completed,
        total: totalPoints,
        percent,
        isComplete,
    };
};

export const isKonversiComplete = (record: KonversiPoinRecord | null | undefined): boolean => (
    getKonversiProgress(record).isComplete
);

export const getKonversiTotalPoint = (record: KonversiPoinRecord | null | undefined): number => {
    if (!record) return 0;
    const explicit = numberValue(record.total_poin);
    if (explicit > 0) return explicit;
    return getKonversiPointMetrics(record).reduce((sum, item) => sum + item.value, 0);
};

export const getKonversiPointMetrics = (record: KonversiPoinRecord | null | undefined): KonversiPointMetric[] => {
    const dynamicKeys = record
        ? Object.keys(record).filter((key) => (
            key.startsWith('poin_') &&
            key !== 'total_poin'
        ))
        : [];
    const keys = [
        ...DEFAULT_KONVERSI_POINT_KEYS.filter((key) => !record || dynamicKeys.includes(key)),
        ...dynamicKeys.filter((key) => !DEFAULT_KONVERSI_POINT_KEYS.includes(key)),
    ];

    return keys.map((key) => {
        const value = numberValue(record?.[key]);
        return {
            key,
            label: KONVERSI_POINT_LABELS[key] || key.replace(/^poin_/, '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
            value,
            isComplete: value > 0,
        };
    });
};

export const getKonversiDisplay = (record: KonversiPoinRecord | null | undefined) => {
    const progress = getKonversiProgress(record);
    const pointMetrics = getKonversiPointMetrics(record);
    return {
        totalPoin: getKonversiTotalPoint(record),
        percent: progress.percent,
        completed: progress.completed,
        total: progress.total,
        isComplete: progress.isComplete,
        pointMetrics,
        poin_csirt: numberValue(record?.poin_csirt),
        poin_ikas: numberValue(record?.poin_ikas),
        poin_kse: numberValue(record?.poin_kse),
        poin_survey: numberValue(record?.poin_survey),
        post_survey: numberValue(record?.post_survey),
    };
};

export const konversiService = {
    async getAll(params?: { perusahaan_id?: string | number }): Promise<KonversiPoinResult> {
        const query = params?.perusahaan_id ? `?perusahaan_id=${encodeURIComponent(String(params.perusahaan_id))}` : '';
        const response = await api.get<any>(`/api/konversi${query}`);
        return normalizeKonversiResponse(response);
    },

    async getByPerusahaanId(perusahaanId: string | number): Promise<KonversiPoinRecord | null> {
        const id = String(perusahaanId || '').trim();
        if (!id) return null;

        const attempts = [
            `/api/konversi?perusahaan_id=${encodeURIComponent(id)}`,
            `/api/konversi/${encodeURIComponent(id)}`,
        ];

        for (const endpoint of attempts) {
            try {
                const response = await api.get<any>(endpoint);
                const result = normalizeKonversiResponse(response);
                const match = result.records.find((record) => String(record.perusahaan_id) === id) || result.records[0] || null;
                if (match) return match;
            } catch {
                // Try the next endpoint shape.
            }
        }

        return null;
    },
};
