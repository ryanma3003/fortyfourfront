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
     * Create a new CSIRT (POST /api/csirt)
     * Sends multipart/form-data so file fields can be uploaded.
     */
    async create(payload: CreateCsirtPayload): Promise<CsirtMember> {
        const form = new FormData();
        form.append('id_perusahaan', String(payload.id_perusahaan));
        form.append('nama_csirt', payload.nama_csirt);
        form.append('web_csirt', payload.web_csirt);
        form.append('telepon_csirt', payload.telepon_csirt);
        if (payload.slug) form.append('slug', payload.slug);
        if (payload.photo_csirt instanceof File)        form.append('photo_csirt',        payload.photo_csirt);
        if (payload.file_rfc2350 instanceof File)       form.append('file_rfc2350',        payload.file_rfc2350);
        if (payload.file_public_key_pgp instanceof File) form.append('file_public_key_pgp', payload.file_public_key_pgp);
        return api.post<CsirtMember>('/api/csirt', form);
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
    async getSdmByCsirtId(id: number | string): Promise<SdmCsirt[]> {
        return api.get<SdmCsirt[]>(`/api/sdm_csirt/${id}`);
    },

    /**
     * Create a new SDM record
     */
    async createSdm(payload: Omit<SdmCsirt, 'id'>): Promise<SdmCsirt> {
        return api.post<SdmCsirt>('/api/sdm_csirt', payload);
    },

    /**
     * Update an SDM record by its own ID
     */
    async updateSdm(id: number, payload: Partial<Omit<SdmCsirt, 'id'>>): Promise<SdmCsirt> {
        return api.patch<SdmCsirt>(`/api/sdm_csirt/${id}`, payload);
    },

    /**
     * Delete an SDM record by its own ID
     */
    async deleteSdm(id: number): Promise<void> {
        return api.delete(`/api/sdm_csirt/${id}`);
    },

    /**
     * Get SE (Systems) for a CSIRT
     */
    async getSeByCsirtId(id: number | string): Promise<SeCsirt[]> {
        return api.get<SeCsirt[]>(`/api/se/${id}`);
    },

    /**
     * Create a new SE record
     */
    async createSe(payload: Omit<SeCsirt, 'id'>): Promise<SeCsirt> {
        return api.post<SeCsirt>('/api/se', payload);
    },

    /**
     * Update a SE record by its own ID
     */
    async updateSe(id: number, payload: Partial<Omit<SeCsirt, 'id'>>): Promise<SeCsirt> {
        return api.patch<SeCsirt>(`/api/se/${id}`, payload);
    },

    /**
     * Delete a SE record by its own ID
     */
    async deleteSe(id: number): Promise<void> {
        return api.delete(`/api/se/${id}`);
    },
};
