import { api, ApiRequestError } from '@/config/api';
import { config } from '@/config/env';
import type {
    IkasPayload,
    IkasResponse,
    DomainPayload,
    DomainResponse,
    KategoriPayload,
    KategoriResponse,
    SubKategoriPayload,
    SubKategoriResponse,
    RuangLingkupPayload,
    RuangLingkupResponse,
    IdentifikasiPayload,
    IdentifikasiResponse,
    ProteksiPayload,
    ProteksiResponse,
    DeteksiPayload,
    DeteksiResponse,
    GulihPayload,
    GulihResponse,
    PertanyaanIdentifikasiResponse,
    JawabanPayload,
    JawabanIdentifikasiPayload,
    JawabanProteksiPayload,
    JawabanDeteksiPayload,
    JawabanGulihPayload,
    IkasAuditLogListResponse,
    JawabanResponse,
    JawabanGulihResponse,
} from '@/types/ikas.types';

/**
 * IKAS Maturity Service
 * Handles all API calls for IKAS assessment endpoints.
 */
export const ikasService = {
    async deleteIkas(id: string): Promise<any> {
        return api.delete<any>(`/api/maturity/ikas/${id}`);
    },
    async exportIkasPdf(id: string): Promise<Response> {
        const cleanBaseUrl = config.api.baseUrl.replace(/\/$/, '');
        const response = await fetch(`${cleanBaseUrl}/api/maturity/ikas/${id}/export`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                Accept: 'application/pdf',
            },
        });

        if (!response.ok) {
            let message = `HTTP Error ${response.status}`;
            try {
                const result = await response.json();
                message = result.message || message;
            } catch {
                message = response.statusText || message;
            }
            throw new Error(message);
        }

        return response;
    },
    resolveKategoriKey(kategori: string): 'identifikasi' | 'proteksi' | 'deteksi' | 'gulih' {
        const normalized = String(kategori || '').toLowerCase();
        if (normalized === 'identifikasi' || normalized === 'proteksi' || normalized === 'deteksi' || normalized === 'gulih') {
            return normalized;
        }
        if (normalized === 'tanggulih' || normalized === 'pemulihan') {
            return 'gulih';
        }
        throw new Error(`Kategori maturity tidak dikenali: ${kategori}`);
    },

    // ─── IKAS (main record) ────────────────────────────────────────

    /** Create a new IKAS assessment record */
    async createIkas(payload: IkasPayload): Promise<IkasResponse> {
        return api.post<IkasResponse>('/api/maturity/ikas', payload);
    },

    /** Get an existing IKAS record by ID */
    async getIkasById(id: string): Promise<IkasResponse> {
        return api.get<IkasResponse>(`/api/maturity/ikas/${id}`);
    },

    /** Validate an IKAS assessment record */
    async validateIkas(id: string): Promise<any> {
        return api.put<any>(`/api/maturity/ikas/${id}/validate`, {
            is_validated: true,
            status: true
        });
    },

    /** Approve an edit request for an IKAS record */
    async approveEditIkas(id: string): Promise<any> {
        return api.put<any>(`/api/maturity/ikas/${id}/approve-edit`, {
            edit_request_status: 'approved',
            is_validated: false,
            status: false
        });
    },

    /** Request edit for a validated IKAS record */
    async requestEditIkas(id: string, reason?: string): Promise<any> {
        return api.post<any>(`/api/maturity/ikas/${id}/request-edit`, {
            reason: reason || ''
        });
    },

    /** Reject an edit request for an IKAS record */
    async rejectEditIkas(id: string, reason?: string): Promise<any> {
        return api.put<any>(`/api/maturity/ikas/${id}/reject-edit`, {
            edit_request_status: 'rejected',
            reason: reason || ''
        });
    },



    /** Get all IKAS records */
    async getIkasList(): Promise<any> {
        return api.get<any>('/api/maturity/ikas');
    },

    /** Get IKAS list by perusahaan ID. Returns null if not found or auth fails. */
    async getIkasByPerusahaan(perusahaanId: string): Promise<any | null> {
        try {
            if (!perusahaanId) {
                return await this.getIkasList();
            }
            return await api.get<any>(`/api/maturity/ikas?id_perusahaan=${perusahaanId}`);
        } catch (error) {
            // 401/403 = auth issue, 404 = not found — all mean "no data available"
            if (error instanceof ApiRequestError) {
                console.warn(`[IKAS Service] getIkasByPerusahaan: ${error.status} - ${error.message}`);
            }
            return null;
        }
    },

    /** Get IKAS audit logs, optionally filtered by IKAS ID, with backend pagination. */
    async getIkasAuditLogs(
        ikasId?: string | number,
        options: { page?: number; limit?: number } = {},
    ): Promise<IkasAuditLogListResponse> {
        const params = new URLSearchParams();
        if (ikasId) params.set('ikas_id', String(ikasId));
        if (options.page) params.set('page', String(options.page));
        if (options.limit) params.set('limit', String(options.limit));

        const query = params.toString() ? `?${params.toString()}` : '';
        return api.get<IkasAuditLogListResponse>(`/api/maturity/ikas-audit-logs${query}`);
    },

    /** Update an existing IKAS record */
    async updateIkas(id: string, payload: Partial<IkasPayload>): Promise<IkasResponse> {
        return api.put<IkasResponse>(`/api/maturity/ikas/${id}`, payload);
    },

    // ─── Domain ────────────────────────────────────────────────────

    /** Create a new domain */
    async createDomain(payload: DomainPayload): Promise<DomainResponse> {
        return api.post<DomainResponse>('/api/maturity/domain', payload);
    },

    /** Get all domains */
    async getDomains(): Promise<DomainResponse[]> {
        return api.get<DomainResponse[]>('/api/maturity/domain');
    },

    // ─── Kategori ──────────────────────────────────────────────────

    /** Create a new kategori under a domain */
    async createKategori(payload: KategoriPayload): Promise<KategoriResponse> {
        return api.post<KategoriResponse>('/api/maturity/kategori', payload);
    },

    /** Get all kategoris */
    async getKategoris(): Promise<KategoriResponse[]> {
        return api.get<KategoriResponse[]>('/api/maturity/kategori');
    },

    // ─── Sub-Kategori ──────────────────────────────────────────────

    /** Create a new sub-kategori under a kategori */
    async createSubKategori(payload: SubKategoriPayload): Promise<SubKategoriResponse> {
        return api.post<SubKategoriResponse>('/api/maturity/sub-kategori', payload);
    },

    /** Get all sub-kategoris */
    async getSubKategoris(): Promise<SubKategoriResponse[]> {
        return api.get<SubKategoriResponse[]>('/api/maturity/sub-kategori');
    },

    // ─── Ruang Lingkup ─────────────────────────────────────────────

    /** Create a new ruang lingkup */
    async createRuangLingkup(payload: RuangLingkupPayload): Promise<RuangLingkupResponse> {
        return api.post<RuangLingkupResponse>('/api/maturity/ruang-lingkup', payload);
    },

    /** Get all ruang lingkups */
    async getRuangLingkups(): Promise<RuangLingkupResponse[]> {
        return api.get<RuangLingkupResponse[]>('/api/maturity/ruang-lingkup');
    },

    // ─── Identifikasi ──────────────────────────────────────────────

    /** Save/create identifikasi scores */
    async createIdentifikasi(payload: IdentifikasiPayload): Promise<IdentifikasiResponse> {
        try {
            return await api.post<IdentifikasiResponse>('/api/maturity/identifikasi', payload);
        } catch (err: any) {
            // If server doesn't allow POST, try update-by-id (PUT) if ikas_id present
            if (err?.status === 405) {
                try {
                    const id = (payload as any)?.ikas_id || (payload as any)?.id_ikas || (payload as any)?.ikasId;
                    if (id) {
                        console.warn('[IKAS Service] POST not allowed, trying PUT /api/maturity/identifikasi/' + id);
                        return await api.put<IdentifikasiResponse>(`/api/maturity/identifikasi/${id}`, payload);
                    }
                } catch (err2: any) {
                    console.warn('[IKAS Service] PUT fallback failed for identifikasi', err2?.message || err2);
                }
            }

            // Fallback to legacy endpoint if server disallows this path/method or not found
            if (err?.status === 405 || err?.status === 404 || err?.status === 409) {
                return api.post<IdentifikasiResponse>('/api/identifikasi', payload);
            }
            throw err;
        }
    },

    /** Get identifikasi by ID */
    async getIdentifikasiById(id: string): Promise<IdentifikasiResponse> {
        return api.get<IdentifikasiResponse>(`/api/maturity/identifikasi/${id}`);
    },

    /** Update identifikasi scores */
    async updateIdentifikasi(id: string, payload: Partial<IdentifikasiPayload>): Promise<IdentifikasiResponse> {
        try {
            return await api.put<IdentifikasiResponse>(`/api/maturity/identifikasi/${id}`, payload);
        } catch (err: any) {
            if (err?.status === 405 || err?.status === 404) {
                return api.put<IdentifikasiResponse>(`/api/identifikasi/${id}`, payload);
            }
            throw err;
        }
    },

    // ─── Proteksi ──────────────────────────────────────────────────

    /** Save/create proteksi scores */
    async createProteksi(payload: ProteksiPayload): Promise<ProteksiResponse> {
        try {
            return await api.post<ProteksiResponse>('/api/maturity/proteksi', payload);
        } catch (err: any) {
            if (err?.status === 405) {
                try {
                    const id = (payload as any)?.ikas_id || (payload as any)?.id_ikas || (payload as any)?.ikasId;
                    if (id) {
                        console.warn('[IKAS Service] POST not allowed, trying PUT /api/maturity/proteksi/' + id);
                        return await api.put<ProteksiResponse>(`/api/maturity/proteksi/${id}`, payload);
                    }
                } catch (err2: any) {
                    console.warn('[IKAS Service] PUT fallback failed for proteksi', err2?.message || err2);
                }
            }

            if (err?.status === 405 || err?.status === 404 || err?.status === 409) {
                return api.post<ProteksiResponse>('/api/proteksi', payload);
            }
            throw err;
        }
    },

    /** Get proteksi by ID */
    async getProteksiById(id: string): Promise<ProteksiResponse> {
        return api.get<ProteksiResponse>(`/api/maturity/proteksi/${id}`);
    },

    /** Update proteksi scores */
    async updateProteksi(id: string, payload: Partial<ProteksiPayload>): Promise<ProteksiResponse> {
        try {
            return await api.put<ProteksiResponse>(`/api/maturity/proteksi/${id}`, payload);
        } catch (err: any) {
            if (err?.status === 405 || err?.status === 404) {
                return api.put<ProteksiResponse>(`/api/proteksi/${id}`, payload);
            }
            throw err;
        }
    },

    // ─── Deteksi ───────────────────────────────────────────────────

    /** Save/create deteksi scores */
    async createDeteksi(payload: DeteksiPayload): Promise<DeteksiResponse> {
        try {
            return await api.post<DeteksiResponse>('/api/maturity/deteksi', payload);
        } catch (err: any) {
            if (err?.status === 405) {
                try {
                    const id = (payload as any)?.ikas_id || (payload as any)?.id_ikas || (payload as any)?.ikasId;
                    if (id) {
                        console.warn('[IKAS Service] POST not allowed, trying PUT /api/maturity/deteksi/' + id);
                        return await api.put<DeteksiResponse>(`/api/maturity/deteksi/${id}`, payload);
                    }
                } catch (err2: any) {
                    console.warn('[IKAS Service] PUT fallback failed for deteksi', err2?.message || err2);
                }
            }

            if (err?.status === 405 || err?.status === 404 || err?.status === 409) {
                return api.post<DeteksiResponse>('/api/deteksi', payload);
            }
            throw err;
        }
    },

    /** Get deteksi by ID */
    async getDeteksiById(id: string): Promise<DeteksiResponse> {
        return api.get<DeteksiResponse>(`/api/maturity/deteksi/${id}`);
    },

    /** Update deteksi scores */
    async updateDeteksi(id: string, payload: Partial<DeteksiPayload>): Promise<DeteksiResponse> {
        try {
            return await api.put<DeteksiResponse>(`/api/maturity/deteksi/${id}`, payload);
        } catch (err: any) {
            if (err?.status === 405 || err?.status === 404) {
                return api.put<DeteksiResponse>(`/api/deteksi/${id}`, payload);
            }
            throw err;
        }
    },

    // ─── Gulih ─────────────────────────────────────────────────────

    /** Save/create gulih scores */
    async createGulih(payload: GulihPayload): Promise<GulihResponse> {
        try {
            return await api.post<GulihResponse>('/api/maturity/gulih', payload);
        } catch (err: any) {
            if (err?.status === 405) {
                try {
                    const id = (payload as any)?.ikas_id || (payload as any)?.id_ikas || (payload as any)?.ikasId;
                    if (id) {
                        console.warn('[IKAS Service] POST not allowed, trying PUT /api/maturity/gulih/' + id);
                        return await api.put<GulihResponse>(`/api/maturity/gulih/${id}`, payload);
                    }
                } catch (err2: any) {
                    console.warn('[IKAS Service] PUT fallback failed for gulih', err2?.message || err2);
                }
            }

            if (err?.status === 405 || err?.status === 404 || err?.status === 409) {
                return api.post<GulihResponse>('/api/gulih', payload);
            }
            throw err;
        }
    },

    /** Get gulih by ID */
    async getGulihById(id: string): Promise<GulihResponse> {
        return api.get<GulihResponse>(`/api/maturity/gulih/${id}`);
    },

    /** Update gulih scores */
    async updateGulih(id: string, payload: Partial<GulihPayload>): Promise<GulihResponse> {
        try {
            return await api.put<GulihResponse>(`/api/maturity/gulih/${id}`, payload);
        } catch (err: any) {
            if (err?.status === 405 || err?.status === 404) {
                return api.put<GulihResponse>(`/api/gulih/${id}`, payload);
            }
            throw err;
        }
    },

    // ─── Pertanyaan IKAS ───────────────────────────────────

    /** Get pertanyaan identifikasi */
    async getPertanyaanIdentifikasi(): Promise<any> {
        return api.get<any>('/api/maturity/pertanyaan-identifikasi');
    },
    async getPertanyaanIdentifikasiById(id: string): Promise<any> {
        return api.get<any>(`/api/maturity/pertanyaan-identifikasi/${id}`);
    },
    async createPertanyaanIdentifikasi(payload: any): Promise<any> {
        return api.post<any>('/api/maturity/pertanyaan-identifikasi', payload);
    },
    async updatePertanyaanIdentifikasi(id: string, payload: any): Promise<any> {
        return api.put<any>(`/api/maturity/pertanyaan-identifikasi/${id}`, payload);
    },
    async deletePertanyaanIdentifikasi(id: string): Promise<any> {
        return api.delete<any>(`/api/maturity/pertanyaan-identifikasi/${id}`);
    },

    /** Get pertanyaan proteksi */
    async getPertanyaanProteksi(): Promise<any> {
        return api.get<any>('/api/maturity/pertanyaan-proteksi');
    },
    async getPertanyaanProteksiById(id: string): Promise<any> {
        return api.get<any>(`/api/maturity/pertanyaan-proteksi/${id}`);
    },
    async createPertanyaanProteksi(payload: any): Promise<any> {
        return api.post<any>('/api/maturity/pertanyaan-proteksi', payload);
    },
    async updatePertanyaanProteksi(id: string, payload: any): Promise<any> {
        return api.put<any>(`/api/maturity/pertanyaan-proteksi/${id}`, payload);
    },
    async deletePertanyaanProteksi(id: string): Promise<any> {
        return api.delete<any>(`/api/maturity/pertanyaan-proteksi/${id}`);
    },

    /** Get pertanyaan deteksi */
    async getPertanyaanDeteksi(): Promise<any> {
        return api.get<any>('/api/maturity/pertanyaan-deteksi');
    },
    async getPertanyaanDeteksiById(id: string): Promise<any> {
        return api.get<any>(`/api/maturity/pertanyaan-deteksi/${id}`);
    },
    async createPertanyaanDeteksi(payload: any): Promise<any> {
        return api.post<any>('/api/maturity/pertanyaan-deteksi', payload);
    },
    async updatePertanyaanDeteksi(id: string, payload: any): Promise<any> {
        return api.put<any>(`/api/maturity/pertanyaan-deteksi/${id}`, payload);
    },
    async deletePertanyaanDeteksi(id: string): Promise<any> {
        return api.delete<any>(`/api/maturity/pertanyaan-deteksi/${id}`);
    },

    /** Get pertanyaan gulih */
    async getPertanyaanGulih(): Promise<any> {
        return api.get<any>('/api/maturity/pertanyaan-gulih');
    },
    async getPertanyaanGulihById(id: string): Promise<any> {
        return api.get<any>(`/api/maturity/pertanyaan-gulih/${id}`);
    },
    async createPertanyaanGulih(payload: any): Promise<any> {
        return api.post<any>('/api/maturity/pertanyaan-gulih', payload);
    },
    async updatePertanyaanGulih(id: string, payload: any): Promise<any> {
        return api.put<any>(`/api/maturity/pertanyaan-gulih/${id}`, payload);
    },
    async deletePertanyaanGulih(id: string): Promise<any> {
        return api.delete<any>(`/api/maturity/pertanyaan-gulih/${id}`);
    },

    async getPertanyaanByKategori(kategori: string): Promise<any> {
        const resolved = this.resolveKategoriKey(kategori);
        return api.get<any>(`/api/maturity/pertanyaan-${resolved}`);
    },

    // Jawaban endpoints
    async getJawabanIdentifikasi(ikasId?: string): Promise<any> {
        const url = ikasId 
            ? `/api/maturity/jawaban-identifikasi?ikas_id=${ikasId}` 
            : '/api/maturity/jawaban-identifikasi';
        return api.get<any>(url);
    },

    async getJawabanIdentifikasiById(id: string): Promise<any> {
        return api.get<any>(`/api/maturity/jawaban-identifikasi/${id}`);
    },

    async createJawabanIdentifikasi(payload: JawabanIdentifikasiPayload): Promise<JawabanResponse> {
        return api.post<JawabanResponse>('/api/maturity/jawaban-identifikasi', payload, undefined, { skipQueue: true });
    },

    async updateJawabanIdentifikasi(id: string, payload: JawabanIdentifikasiPayload): Promise<JawabanResponse> {
        return api.put<JawabanResponse>(`/api/maturity/jawaban-identifikasi/${id}`, payload, undefined, { skipQueue: true });
    },

    async deleteJawabanIdentifikasi(id: string): Promise<any> {
        return api.delete<any>(`/api/maturity/jawaban-identifikasi/${id}`);
    },

    async getJawabanProteksi(ikasId?: string): Promise<any> {
        const url = ikasId 
            ? `/api/maturity/jawaban-proteksi?ikas_id=${ikasId}` 
            : '/api/maturity/jawaban-proteksi';
        return api.get<any>(url);
    },

    async getJawabanProteksiById(id: string): Promise<any> {
        return api.get<any>(`/api/maturity/jawaban-proteksi/${id}`);
    },

    async createJawabanProteksi(payload: JawabanProteksiPayload): Promise<JawabanResponse> {
        return api.post<JawabanResponse>('/api/maturity/jawaban-proteksi', payload, undefined, { skipQueue: true });
    },

    async updateJawabanProteksi(id: string, payload: JawabanProteksiPayload): Promise<JawabanResponse> {
        return api.put<JawabanResponse>(`/api/maturity/jawaban-proteksi/${id}`, payload, undefined, { skipQueue: true });
    },

    async deleteJawabanProteksi(id: string): Promise<any> {
        return api.delete<any>(`/api/maturity/jawaban-proteksi/${id}`);
    },

    async getJawabanDeteksi(ikasId?: string): Promise<any> {
        const url = ikasId 
            ? `/api/maturity/jawaban-deteksi?ikas_id=${ikasId}` 
            : '/api/maturity/jawaban-deteksi';
        return api.get<any>(url);
    },

    async getJawabanDeteksiById(id: string): Promise<any> {
        return api.get<any>(`/api/maturity/jawaban-deteksi/${id}`);
    },

    async createJawabanDeteksi(payload: JawabanDeteksiPayload): Promise<JawabanResponse> {
        return api.post<JawabanResponse>('/api/maturity/jawaban-deteksi', payload, undefined, { skipQueue: true });
    },

    async updateJawabanDeteksi(id: string, payload: JawabanDeteksiPayload): Promise<JawabanResponse> {
        return api.put<JawabanResponse>(`/api/maturity/jawaban-deteksi/${id}`, payload, undefined, { skipQueue: true });
    },

    async deleteJawabanDeteksi(id: string): Promise<any> {
        return api.delete<any>(`/api/maturity/jawaban-deteksi/${id}`);
    },

    async getJawabanGulih(ikasId?: string): Promise<JawabanGulihResponse[]> {
        const url = ikasId 
            ? `/api/maturity/jawaban-gulih?ikas_id=${ikasId}` 
            : '/api/maturity/jawaban-gulih';
        return api.get<JawabanGulihResponse[]>(url);
    },

    async getJawabanGulihById(id: string): Promise<any> {
        return api.get<any>(`/api/maturity/jawaban-gulih/${id}`);
    },

    async createJawabanGulih(payload: JawabanGulihPayload): Promise<JawabanGulihResponse> {
        return api.post<JawabanGulihResponse>('/api/maturity/jawaban-gulih', payload, undefined, { skipQueue: true });
    },

    async updateJawabanGulih(id: string, payload: JawabanGulihPayload): Promise<JawabanGulihResponse> {
        return api.put<JawabanGulihResponse>(`/api/maturity/jawaban-gulih/${id}`, payload, undefined, { skipQueue: true });
    },

    async deleteJawabanGulih(id: string): Promise<any> {
        return api.delete<any>(`/api/maturity/jawaban-gulih/${id}`);
    },

    async getJawabanByKategori(kategori: string, ikasId: string): Promise<any> {
        const resolved = this.resolveKategoriKey(kategori);
        if (!ikasId) {
            throw new Error('ikas_id wajib ada untuk mengambil jawaban maturity');
        }
        return api.get<any>(`/api/maturity/jawaban-${resolved}?ikas_id=${ikasId}`);
    },

    async createJawabanByKategori(kategori: string, payload: JawabanPayload): Promise<any> {
        const resolved = this.resolveKategoriKey(kategori);
        return api.post<any>(`/api/maturity/jawaban-${resolved}`, payload, undefined, { skipQueue: true });
    },

    async updateJawabanByKategori(kategori: string, id: string, payload: JawabanPayload): Promise<any> {
        const resolved = this.resolveKategoriKey(kategori);
        return api.put<any>(`/api/maturity/jawaban-${resolved}/${id}`, payload, undefined, { skipQueue: true });
    },
};
