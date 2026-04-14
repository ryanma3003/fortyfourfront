import { api, ApiRequestError } from '@/config/api';
import type { CsirtMember, SdmCsirt, SeCsirt, CreateCsirtPayload, CreateSePayload } from '@/types/csirt.types';

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
    async getMemberById(id: number | string): Promise<CsirtMember> {
        return api.get<CsirtMember>(`/api/csirt/${id}`);
    },

    /**
     * Get CSIRT member by id_perusahaan (company ID)
     */
    async getCsirtByPerusahaan(perusahaanId: string | number): Promise<CsirtMember | null> {
        try {
            // Some backends provide a direct endpoint like /api/csirt/perusahaan/1
            return await api.get<CsirtMember>(`/api/csirt/perusahaan/${perusahaanId}`);
        } catch (e) {
            // fallback to querying with param
            try {
                const list = await api.get<CsirtMember[]>(`/api/csirt?id_perusahaan=${perusahaanId}`);
                if (Array.isArray(list)) {
                    return list.find(c => String(c.id_perusahaan) === String(perusahaanId) || String((c as any).perusahaan?.id) === String(perusahaanId)) || null;
                }
            } catch (err) {}
            return null;
        }
    },

    /**
     * Create a new CSIRT (POST /api/csirt)
     * Sends multipart/form-data so file fields can be uploaded.
     */
    async create(payload: CreateCsirtPayload): Promise<CsirtMember> {
        const form = new FormData();
        // id_perusahaan is a required string field — send the UUID as-is.
        form.append('id_perusahaan', String(payload.id_perusahaan));
        form.append('nama_csirt', payload.nama_csirt);
        form.append('web_csirt', payload.web_csirt || '');
        form.append('telepon_csirt', payload.telepon_csirt || '');
        // photo_csirt is required: the backend always tries to open/save the photo file.
        if (payload.photo_csirt instanceof File) form.append('photo_csirt',         payload.photo_csirt);
        if (payload.file_rfc2350        instanceof File) form.append('file_rfc2350',        payload.file_rfc2350);
        if (payload.file_public_key_pgp instanceof File) form.append('file_public_key_pgp', payload.file_public_key_pgp);
        return api.post<CsirtMember>('/api/csirt', form);
    },

    /**
     * Update a CSIRT member by ID
     */
    async update(id: string | number, payload: Partial<CreateCsirtPayload> & { photo_csirt?: File | null }): Promise<CsirtMember> {
        // Go backend: PUT /api/csirt/{id} with multipart/form-data
        const form = new FormData();
        if (payload.id_perusahaan != null) form.append('id_perusahaan', String(payload.id_perusahaan));
        if (payload.nama_csirt)    form.append('nama_csirt',    payload.nama_csirt);
        if (payload.web_csirt)     form.append('web_csirt',     payload.web_csirt);
        if (payload.telepon_csirt) form.append('telepon_csirt', payload.telepon_csirt);
        if (payload.photo_csirt instanceof File) form.append('photo_csirt', payload.photo_csirt);
        if (payload.file_rfc2350        instanceof File) form.append('file_rfc2350',        payload.file_rfc2350);
        if (payload.file_public_key_pgp instanceof File) form.append('file_public_key_pgp', payload.file_public_key_pgp);
        return api.put<CsirtMember>(`/api/csirt/${id}`, form);
    },

    /**
     * Delete a CSIRT member by ID
     */
    async delete(id: string | number): Promise<void> {
        return api.delete(`/api/csirt/${id}`);
    },

    /**
     * Get SDM (Resources) for a CSIRT.
     * Returns empty array when backend returns 404 (no rows).
     */
    async getSdmByCsirtId(id: number | string): Promise<SdmCsirt[]> {
        try {
            const result = await api.get<any>(`/api/sdm_csirt?id_csirt=${id}`);
            let list = [];
            if (Array.isArray(result)) list = result;
            else if (result && Array.isArray(result.data)) list = result.data;
            else if (result && result.id) list = [result];
            
            return list.map((item: any) => ({
                ...item,
                id_csirt: item.csirt?.id || item.id_csirt
            })).filter((item: any) => String(item.id_csirt) === String(id));
        } catch (err) {
            if (err instanceof ApiRequestError && err.status === 404) return [];
            throw err;
        }
    },

    /**
     * Get all SDM records (GET /api/sdm_csirt)
     */
    async getAllSdm(): Promise<SdmCsirt[]> {
        return api.get<SdmCsirt[]>('/api/sdm_csirt');
    },

    /**
     * Get SDM by its own ID (GET /api/sdm_csirt/{id})
     */
    async getSdmById(id: string | number): Promise<SdmCsirt> {
        return api.get<SdmCsirt>(`/api/sdm_csirt/${id}`);
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
    async updateSdm(id: string | number, payload: Partial<Omit<SdmCsirt, 'id'>>): Promise<SdmCsirt> {
        return api.put<SdmCsirt>(`/api/sdm_csirt/${id}`, payload);
    },

    /**
     * Delete an SDM record by its own ID
     */
    async deleteSdm(id: string | number): Promise<void> {
        return api.delete(`/api/sdm_csirt/${id}`);
    },

    /**
     * Get SE (Systems) for a CSIRT.
     * Returns empty array when backend returns 404 (no rows).
     */
    async getSeByCsirtId(id: number | string): Promise<SeCsirt[]> {
        try {
            const result = await api.get<any>(`/api/se?id_csirt=${id}`);
            let list = [];
            if (Array.isArray(result)) list = result;
            else if (result && Array.isArray(result.data)) list = result.data;
            else if (result && result.id) list = [result];
            
            return list.map((item: any) => ({
                ...item,
                id_csirt: item.csirt?.id || item.id_csirt
            })).filter((item: any) => String(item.id_csirt) === String(id));
        } catch (err) {
            if (err instanceof ApiRequestError && err.status === 404) return [];
            throw err;
        }
    },

    /**
     * Get all SE records (GET /api/se)
     */
    async getAllSe(): Promise<SeCsirt[]> {
        return api.get<SeCsirt[]>('/api/se');
    },

    /**
     * Get SE by its own ID (GET /api/se/{id})
     */
    async getSeById(id: string | number): Promise<SeCsirt> {
        return api.get<SeCsirt>(`/api/se/${id}`);
    },

    /**
     * Create a new SE record
     */
    async createSe(payload: CreateSePayload): Promise<SeCsirt> {
        return api.post<SeCsirt>('/api/se', payload);
    },

    /**
     * Update a SE record by its own ID
     */
    async updateSe(id: number | string, payload: Partial<Omit<SeCsirt, 'id'>>): Promise<SeCsirt> {
        return api.put<SeCsirt>(`/api/se/${id}`, payload);
    },

    /**
     * Delete a SE record by its own ID
     */
    async deleteSe(id: number): Promise<void> {
        return api.delete(`/api/se/${id}`);
    },
};
