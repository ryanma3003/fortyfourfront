import { api } from '@/config/api';
import type { CsirtMember, SdmCsirt, SeCsirt, CreateCsirtPayload } from '@/types/csirt.types';

/**
 * CSIRT Service
 * Handles data fetching for CSIRT domain.
 */
export const csirtService = {
    /**
     * Get all CSIRT members
     */
    async getMembers(): Promise<CsirtMember[]> {
        return api.get<CsirtMember[]>('/api/csirt');
    },

    /**
     * Get CSIRT member by ID
     */
    async getMemberById(id: number): Promise<CsirtMember> {
        return api.get<CsirtMember>(`/api/csirt/${id}`);
    },

    /**
     * Create a new CSIRT member
     */
    async create(payload: CreateCsirtPayload): Promise<CsirtMember> {
        return api.post<CsirtMember>('/api/csirt', payload);
    },

    /**
     * Update a CSIRT member by ID
     */
    async update(id: number, payload: Partial<CreateCsirtPayload>): Promise<CsirtMember> {
        return api.patch<CsirtMember>(`/api/csirt/${id}`, payload);
    },

    /**
     * Delete a CSIRT member by ID
     */
    async delete(id: number): Promise<void> {
        return api.delete(`/api/csirt/${id}`);
    },

    /**
     * Get SDM (Resources) for a CSIRT
     */
    async getSdmByCsirtId(id: number): Promise<SdmCsirt[]> {
        return api.get<SdmCsirt[]>(`/api/sdm_csirt/${id}`);
    },

    /**
     * Get SE (Systems) for a CSIRT
     */
    async getSeByCsirtId(id: number): Promise<SeCsirt[]> {
        return api.get<SeCsirt[]>(`/api/se_csirt/${id}`);
    }
};
