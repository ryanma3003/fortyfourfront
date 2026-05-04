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

    async getById(id: number): Promise<BeritaDetailResponse> {
        return api.get<BeritaDetailResponse>(`/api/berita/${id}`);
    },

    async create(data: CreateBeritaPayload): Promise<CreateBeritaResponse> {
        return api.post<CreateBeritaResponse>('/api/berita', data);
    },

    async update(id: number, data: UpdateBeritaPayload): Promise<BeritaMutationResponse> {
        return api.put<BeritaMutationResponse>(`/api/berita/${id}`, data);
    },

    async delete(id: number): Promise<BeritaMutationResponse> {
        return api.delete<BeritaMutationResponse>(`/api/berita/${id}`);
    },
};
