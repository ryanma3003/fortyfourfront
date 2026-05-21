import { api } from '@/config/api';
import type {
    BeritaListResponse,
    BeritaDetailResponse,
    CreateBeritaPayload,
    CreateBeritaResponse,
    UpdateBeritaPayload,
    BeritaMutationResponse,
} from '@/types/berita.types';

/**
 * Berita Service
 * Handles CRUD operations for the /api/berita endpoints.
 */
export const beritaService = {
    async getAll(): Promise<BeritaListResponse> {
        return api.get<BeritaListResponse>('/api/berita');
    },

    async getById(id: number | string): Promise<BeritaDetailResponse> {
        const resolvedId = String(id).trim();
        if (!resolvedId) {
            throw new Error('ID berita tidak valid');
        }
        return api.get<BeritaDetailResponse>(`/api/berita/${encodeURIComponent(resolvedId)}`);
    },

    async create(data: CreateBeritaPayload): Promise<CreateBeritaResponse> {
        return api.post<CreateBeritaResponse>('/api/berita', data);
    },

    async update(id: number | string, data: UpdateBeritaPayload): Promise<BeritaMutationResponse> {
        const resolvedId = String(id).trim();
        if (!resolvedId) {
            throw new Error('ID berita tidak valid');
        }
        return api.put<BeritaMutationResponse>(`/api/berita/${encodeURIComponent(resolvedId)}`, data);
    },

    async delete(id: number | string): Promise<BeritaMutationResponse> {
        const resolvedId = String(id).trim();
        if (!resolvedId) {
            throw new Error('ID berita tidak valid');
        }
        return api.delete<BeritaMutationResponse>(`/api/berita/${encodeURIComponent(resolvedId)}`);
    },
};
