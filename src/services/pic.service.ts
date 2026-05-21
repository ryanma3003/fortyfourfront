import { api, ApiRequestError } from '@/config/api';
import { useNotificationStore } from '@/stores/notifications';
import type { Pic, CreatePicPayload, UpdatePicPayload } from '@/types/pic.types';

const PIC_CACHE_TTL_MS = 5 * 60 * 1000;

let allPicsCache: { data: Pic[]; timestamp: number } | null = null;
let allPicsRequest: Promise<Pic[]> | null = null;

const unwrapPicsResponse = (result: any): Pic[] => {
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.data)) return result.data;
    if (result && Array.isArray(result.pics)) return result.pics;
    if (result?.data && Array.isArray(result.data.data)) return result.data.data;
    if (result && result.id) return [result];
    return [];
};

const getPicCompanyId = (pic: Pic): string => String(
    pic.perusahaan?.id ||
    (pic as any).id_perusahaan ||
    (pic as any).perusahaan_id ||
    ''
);

const clearPicCache = () => {
    allPicsCache = null;
    allPicsRequest = null;
};

const getCachedAllPics = async (): Promise<Pic[]> => {
    const now = Date.now();
    if (allPicsCache && now - allPicsCache.timestamp < PIC_CACHE_TTL_MS) {
        return allPicsCache.data;
    }

    if (!allPicsRequest) {
        allPicsRequest = api.get<any>('/api/pic')
            .then((result) => {
                const data = unwrapPicsResponse(result);
                allPicsCache = { data, timestamp: Date.now() };
                return data;
            })
            .finally(() => {
                allPicsRequest = null;
            });
    }

    return allPicsRequest;
};

/**
 * PIC Service
 * Handles CRUD operations for Person in Charge (SDM CSIRT) per perusahaan.
 * 
 * NOTE: Each company must have its own separate PICs.
 * /api/pic/{id} is for a PIC ID, not a perusahaan ID.
 */
export const picService = {
    /**
     * Get all PICs (should be used carefully - use getByPerusahaan for company-specific data)
     */
    async getAll(): Promise<Pic[]> {
        return getCachedAllPics();
    },

    /**
     * Get all PICs for one perusahaan ID.
     */
    async getByPerusahaan(id_perusahaan: string | number): Promise<Pic[]> {
        try {
            const pics = await getCachedAllPics();
            return pics.filter((pic) => getPicCompanyId(pic) === String(id_perusahaan));

        } catch (err) {
            if (err instanceof ApiRequestError && (err.status === 404 || err.status === 429)) {
                return [];
            }
            throw err;
        }
    },

    /**
     * Get a single PIC by ID
     */
    async getById(id: string | number): Promise<Pic> {
        return api.get<Pic>(`/api/pic/${id}`);
    },

    /**
     * Create a new PIC (MUST include id_perusahaan to assign to specific company)
     */
    async create(payload: CreatePicPayload): Promise<Pic> {
        if (!payload.id_perusahaan) {
            throw new Error('id_perusahaan is required when creating a new PIC');
        }
        const result = await api.post<Pic>('/api/pic', payload);
        clearPicCache();
        return result;
    },

    /**
     * Update a PIC by ID (company assignment cannot be changed)
     */
    async update(id: string | number, payload: UpdatePicPayload): Promise<Pic> {
        useNotificationStore().trackSelfAction('pic', String(id));
        const result = await api.put<Pic>(`/api/pic/${id}`, payload);
        clearPicCache();
        return result;
    },

    /**
     * Delete a PIC by ID
     */
    async delete(id: string | number): Promise<void> {
        useNotificationStore().trackSelfAction('pic', String(id));
        const result = await api.delete<void>(`/api/pic/${id}`);
        clearPicCache();
        return result;
    },
};
