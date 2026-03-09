import { api } from '@/config/api';
import type { Pic, CreatePicPayload, UpdatePicPayload } from '@/types/pic.types';

/**
 * PIC Service
 * Handles CRUD operations for Person in Charge (SDM CSIRT) per perusahaan.
 */
export const picService = {
    /**
     * Get all PICs
     */
    async getAll(): Promise<Pic[]> {
        return api.get<Pic[]>('/api/pic');
    },

    /**
     * Get all PICs filtered by perusahaan ID (via query param)
     */
    async getByPerusahaan(id_perusahaan: string | number): Promise<Pic[]> {
        return api.get<Pic[]>(`/api/pic?id_perusahaan=${id_perusahaan}`);
    },

    /**
     * Get a single PIC by ID
     */
    async getById(id: string | number): Promise<Pic> {
        return api.get<Pic>(`/api/pic/${id}`);
    },

    /**
     * Create a new PIC
     */
    async create(payload: CreatePicPayload): Promise<Pic> {
        return api.post<Pic>('/api/pic', payload);
    },

    /**
     * Update a PIC by ID
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
