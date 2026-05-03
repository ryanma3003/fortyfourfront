import { api } from '@/config/api';
import type {
    KegiatanListResponse,
    KegiatanDetailResponse,
    CreateKegiatanPayload,
    CreateKegiatanResponse,
    UpdateKegiatanPayload,
    MutationResponse,
} from '@/types/kegiatan.types';

/**
 * Kegiatan (Event) Service
 * Handles CRUD operations for the /api/kegiatan endpoints.
 */
export const kegiatanService = {
    /**
     * GET /api/kegiatan
     * Fetch all events
     */
    async getAll(): Promise<KegiatanListResponse> {
        return api.get<KegiatanListResponse>('/api/kegiatan');
    },

    /**
     * GET /api/kegiatan/{id}
     * Fetch event detail by ID
     */
    async getById(id: number): Promise<KegiatanDetailResponse> {
        return api.get<KegiatanDetailResponse>(`/api/kegiatan/${id}`);
    },

    /**
     * POST /api/kegiatan
     * Create a new event
     */
    async create(data: CreateKegiatanPayload): Promise<CreateKegiatanResponse> {
        return api.post<CreateKegiatanResponse>('/api/kegiatan', data);
    },

    /**
     * PUT /api/kegiatan/{id}
     * Update an existing event
     */
    async update(id: number, data: UpdateKegiatanPayload): Promise<MutationResponse> {
        return api.put<MutationResponse>(`/api/kegiatan/${id}`, data);
    },

    /**
     * DELETE /api/kegiatan/{id}
     * Delete an event
     */
    async delete(id: number): Promise<MutationResponse> {
        return api.delete<MutationResponse>(`/api/kegiatan/${id}`);
    },
};
