import { api } from '@/config/api';
import type { Stakeholder, CreateStakeholderPayload, CreateStakeholderResponse } from '@/types/stakeholders.types';

/**
 * Stakeholders Service
 * Handles data fetching for Stakeholders domain (Perusahaan).
 */
export const stakeholdersService = {
    /**
     * Get all stakeholders
     */
    async getAll(): Promise<Stakeholder[]> {
        return api.get<Stakeholder[]>('/api/perusahaan');
    },

    /**
     * Get stakeholders dropdown list (lightweight, for select/dropdown)
     */
    async getDropdown(): Promise<{ id: number; nama_perusahaan: string }[]> {
        return api.get<{ id: number; nama_perusahaan: string }[]>('/api/perusahaan/dropdown');
    },

    /**
     * Get stakeholder by ID
     */
    async getById(id: string): Promise<Stakeholder> {
        return api.get<Stakeholder>(`/api/perusahaan/${id}`);
    },

    /**
     * Create a new stakeholder
     */
    async create(data: CreateStakeholderPayload): Promise<CreateStakeholderResponse> {
        const formData = new FormData();
        formData.append('nama_perusahaan', data.nama_perusahaan);
        formData.append('id_sub_sektor', data.id_sub_sektor);
        formData.append('email', data.email);
        formData.append('alamat', data.alamat);
        formData.append('telepon', data.telepon);
        formData.append('website', data.website);
        if (data.photo instanceof File) {
            formData.append('photo', data.photo);
        }
        return api.post<CreateStakeholderResponse>('/api/perusahaan', formData);
    },

    /**
     * Update a stakeholder
     */
    async update(id: string, data: Partial<CreateStakeholderPayload>): Promise<Stakeholder> {
        const formData = new FormData();
        if (data.nama_perusahaan) formData.append('nama_perusahaan', data.nama_perusahaan);
        if (data.id_sub_sektor) formData.append('id_sub_sektor', data.id_sub_sektor);
        if (data.email) formData.append('email', data.email);
        if (data.alamat) formData.append('alamat', data.alamat);
        if (data.telepon) formData.append('telepon', data.telepon);
        if (data.website) formData.append('website', data.website);
        if (data.photo instanceof File) {
            formData.append('photo', data.photo);
        }
        return api.put<Stakeholder>(`/api/perusahaan/${id}`, formData);
    },

    /**
     * Delete a stakeholder
     */
    async delete(id: string): Promise<void> {
        return api.delete(`/api/perusahaan/${id}`);
    }
};
