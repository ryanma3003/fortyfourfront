import { api, ApiRequestError } from '@/config/api';
import type { Pic, CreatePicPayload, UpdatePicPayload } from '@/types/pic.types';

/**
 * PIC Service
 * Handles CRUD operations for Person in Charge (SDM CSIRT) per perusahaan.
 * 
 * NOTE: Each company must have its own separate PICs.
 * Always filter by id_perusahaan to ensure company-specific data.
 */
export const picService = {
    /**
     * Get all PICs (should be used carefully - use getByPerusahaan for company-specific data)
     */
    async getAll(): Promise<Pic[]> {
        return api.get<Pic[]>('/api/pic');
    },

    /**
     * Get all PICs filtered by perusahaan ID (REQUIRED for company-specific filtering)
     * This ensures each company sees only their own PICs.
     */
    async getByPerusahaan(id_perusahaan: string | number): Promise<Pic[]> {
    try {
        const result = await api.get<any>(`/api/pic?id_perusahaan=${id_perusahaan}`);

        let pics: Pic[] = [];
        if (Array.isArray(result)) {
            pics = result;
        } else if (result && Array.isArray(result.data)) {
            pics = result.data;
        } else if (result && result.id) {
            pics = [result];
        }

        // Optional safety filter (boleh dipertahankan)
        return pics.filter(pic => {
            const picCompanyId = pic.perusahaan?.id || (pic as any).id_perusahaan || (pic as any).perusahaan_id;
            return String(picCompanyId) === String(id_perusahaan);
        });

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
        return api.post<Pic>('/api/pic', payload);
    },

    /**
     * Update a PIC by ID (company assignment cannot be changed)
     */
    async update(id: string | number, payload: UpdatePicPayload): Promise<Pic> {
        return api.put<Pic>(`/api/pic/${id}`, payload);
    },

    /**
     * Delete a PIC by ID
     */
    async delete(id: string | number): Promise<void> {
        return api.delete<void>(`/api/pic/${id}`);
    },
};
