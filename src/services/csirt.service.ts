import { api } from '@/config/api';
import type { CsirtMember, SdmCsirt, SeCsirt } from '@/types/csirt.types';

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
