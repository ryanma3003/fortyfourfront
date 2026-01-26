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
        Object.entries(data).forEach(([key, value]) => {
            formData.append(key, value);
        });
        return api.post<CreateStakeholderResponse>('/api/perusahaan', formData);
    },

    /**
     * Update a stakeholder
     */
    async update(id: string, data: Partial<CreateStakeholderPayload>): Promise<Stakeholder> {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                formData.append(key, value);
            }
        });
        return api.put<Stakeholder>(`/api/perusahaan/${id}`, formData);
    },

    /**
     * Delete a stakeholder
     */
    async delete(id: string): Promise<void> {
        return api.delete(`/api/perusahaan/${id}`);
    }
};
