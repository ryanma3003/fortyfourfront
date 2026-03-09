import { api } from '@/config/api';
import type { Jabatan, CreateJabatanPayload } from '@/types/jabatan.types';

/**
 * Jabatan Service
 * CRUD operations for /api/jabatan
 */
export const jabatanService = {
    /** GET /api/jabatan — list all jabatan */
    async getAll(): Promise<Jabatan[]> {
        return api.get<Jabatan[]>('/api/jabatan');
    },

    /** GET /api/jabatan/{id} — get jabatan by ID */
    async getById(id: string): Promise<Jabatan> {
        return api.get<Jabatan>(`/api/jabatan/${id}`);
    },

    /** POST /api/jabatan — create new jabatan */
    async create(payload: CreateJabatanPayload): Promise<Jabatan> {
        return api.post<Jabatan>('/api/jabatan', payload);
    },

    /** PUT /api/jabatan/{id} — update jabatan */
    async update(id: string, payload: CreateJabatanPayload): Promise<Jabatan> {
        return api.put<Jabatan>(`/api/jabatan/${id}`, payload);
    },
};
