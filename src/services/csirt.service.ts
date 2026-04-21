import { api, ApiRequestError } from '@/config/api';
import type { CsirtMember, SdmCsirt, SeCsirt, CreateCsirtPayload, CreateSePayload } from '@/types/csirt.types';
import { useNotificationStore } from '@/stores/notifications';

/**
 * Robustly unwrap array responses from potentially inconsistent backend endpoints.
 */
function unwrapArray<T>(res: any, label: string): T[] {
    console.debug(`[csirtService] ${label} raw response:`, res);
    if (!res) return [];
    if (Array.isArray(res)) return res as T[];
    if (Array.isArray(res.data)) return res.data as T[];
    if (typeof res === 'object') {
        const firstArray = Object.values(res).find(v => Array.isArray(v));
        if (firstArray) return firstArray as T[];
    }
    return [];
}

/**
 * Robustly unwrap object responses from potentially inconsistent backend endpoints.
 */
function unwrapObject<T>(res: any, label: string): T | null {
    console.debug(`[csirtService] ${label} raw response:`, res);
    if (!res) return null;
    if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) return res.data as T;
    return res as T;
}

/**
 * CSIRT Service
 * Handles data fetching for CSIRT domain.
 */
export const csirtService = {
    /**
     * Get all CSIRT members
     */
    async getMembers(): Promise<CsirtMember[]> {
        const res = await api.get<any>('/api/csirt');
        return unwrapArray<CsirtMember>(res, 'members');
    },

    /**
     * Get CSIRT member by ID
     */
    async getMemberById(id: number | string): Promise<CsirtMember | null> {
        const res = await api.get<any>(`/api/csirt/${id}`);
        return unwrapObject<CsirtMember>(res, `member(${id})`);
    },

    /**
     * Get CSIRT member by id_perusahaan (company ID)
     */
    async getCsirtByPerusahaan(perusahaanId: string | number): Promise<CsirtMember | null> {
        try {
            const res = await api.get<any>(`/api/csirt/perusahaan/${perusahaanId}`);
            return unwrapObject<CsirtMember>(res, `member_by_perusahaan(${perusahaanId})`);
        } catch (e) {
            try {
                const list = await this.getMembers();
                return list.find(c => String(c.id_perusahaan) === String(perusahaanId) || String((c as any).perusahaan?.id) === String(perusahaanId)) || null;
            } catch (err) {}
            return null;
        }
    },

    /**
     * Create a new CSIRT (POST /api/csirt)
     */
    async create(payload: CreateCsirtPayload): Promise<CsirtMember> {
        const form = new FormData();
        form.append('id_perusahaan', String(payload.id_perusahaan));
        form.append('nama_csirt', payload.nama_csirt);
        form.append('web_csirt', payload.web_csirt || '');
        form.append('telepon_csirt', payload.telepon_csirt || '');
        if (payload.photo_csirt instanceof File) form.append('photo_csirt', payload.photo_csirt);
        if (payload.file_rfc2350 instanceof File) form.append('file_rfc2350', payload.file_rfc2350);
        if (payload.file_public_key_pgp instanceof File) form.append('file_public_key_pgp', payload.file_public_key_pgp);
        if (payload.file_surat_tanda_registrasi instanceof File) form.append('file_surat_tanda_registrasi', payload.file_surat_tanda_registrasi);
        return api.post<CsirtMember>('/api/csirt', form);
    },

    /**
     * Update a CSIRT member by ID
     */
    async update(id: string | number, payload: Partial<CreateCsirtPayload> & { photo_csirt?: File | null }): Promise<CsirtMember> {
        useNotificationStore().trackSelfAction('csirt', String(id));
        const form = new FormData();
        if (payload.id_perusahaan != null) form.append('id_perusahaan', String(payload.id_perusahaan));
        if (payload.nama_csirt) form.append('nama_csirt', payload.nama_csirt);
        if (payload.web_csirt) form.append('web_csirt', payload.web_csirt);
        if (payload.telepon_csirt) form.append('telepon_csirt', payload.telepon_csirt);
        if (payload.photo_csirt instanceof File) form.append('photo_csirt', payload.photo_csirt);
        if (payload.file_rfc2350 instanceof File) form.append('file_rfc2350', payload.file_rfc2350);
        if (payload.file_public_key_pgp instanceof File) form.append('file_public_key_pgp', payload.file_public_key_pgp);
        if (payload.file_surat_tanda_registrasi instanceof File) form.append('file_surat_tanda_registrasi', payload.file_surat_tanda_registrasi);
        return api.put<CsirtMember>(`/api/csirt/${id}`, form);
    },

    /**
     * Delete a CSIRT member by ID
     */
    async delete(id: string | number): Promise<void> {
        useNotificationStore().trackSelfAction('csirt', String(id));
        return api.delete(`/api/csirt/${id}`);
    },

    /**
     * Get SDM (Resources) for a CSIRT.
     */
    async getSdmByCsirtId(id: number | string): Promise<SdmCsirt[]> {
        try {
            const result = await api.get<any>(`/api/sdm_csirt?id_csirt=${id}`);
            const list = unwrapArray<any>(result, `sdm_csirt(id_csirt=${id})`);
            return list.map((item: any) => ({
                ...item,
                id_csirt: item.csirt?.id || item.id_csirt
            }));
        } catch (err) {
            if (err instanceof ApiRequestError && err.status === 404) return [];
            throw err;
        }
    },

    /**
     * Get all SDM records
     */
    async getAllSdm(): Promise<SdmCsirt[]> {
        const res = await api.get<any>('/api/sdm_csirt');
        return unwrapArray<SdmCsirt>(res, 'all_sdm');
    },

    /**
     * Get SDM by its own ID
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
     * Update an SDM record
     */
    async updateSdm(id: string | number, payload: Partial<Omit<SdmCsirt, 'id'>>): Promise<SdmCsirt> {
        useNotificationStore().trackSelfAction('sdm_csirt', String(id));
        return api.put<SdmCsirt>(`/api/sdm_csirt/${id}`, payload);
    },

    /**
     * Delete an SDM record
     */
    async deleteSdm(id: string | number): Promise<void> {
        useNotificationStore().trackSelfAction('sdm_csirt', String(id));
        return api.delete(`/api/sdm_csirt/${id}`);
    },

    /**
     * Get SE (Systems) for a CSIRT.
     */
    async getSeByCsirtId(id: number | string): Promise<SeCsirt[]> {
        try {
            const result = await api.get<any>(`/api/se?id_csirt=${id}`);
            const list = unwrapArray<any>(result, `se(id_csirt=${id})`);
            return list.map((item: any) => ({
                ...item,
                id_csirt: item.csirt?.id || item.id_csirt
            }));
        } catch (err) {
            if (err instanceof ApiRequestError && err.status === 404) return [];
            throw err;
        }
    },

    /**
     * Get all SE records
     */
    async getAllSe(): Promise<SeCsirt[]> {
        const res = await api.get<any>('/api/se');
        return unwrapArray<SeCsirt>(res, 'all_se');
    },

    /**
     * Get SE by its own ID
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
     * Update a SE record
     */
    async updateSe(id: number | string, payload: Partial<Omit<SeCsirt, 'id'>>): Promise<SeCsirt> {
        useNotificationStore().trackSelfAction('se_csirt', String(id));
        return api.put<SeCsirt>(`/api/se/${id}`, payload);
    },

    /**
     * Delete a SE record
     */
    async deleteSe(id: number): Promise<void> {
        useNotificationStore().trackSelfAction('se_csirt', String(id));
        return api.delete(`/api/se/${id}`);
    },
};
