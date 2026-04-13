import { api, ApiRequestError } from '@/config/api';
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
} from '@/types/ikas.types';

/**
 * IKAS Maturity Service
 * Handles all API calls for IKAS assessment endpoints.
 */
export const ikasService = {
    // ─── IKAS (main record) ────────────────────────────────────────

    /** Create a new IKAS assessment record */
    async createIkas(payload: IkasPayload): Promise<IkasResponse> {
        return api.post<IkasResponse>('/api/maturity/ikas', payload);
    },

    /** Get an existing IKAS record by ID */
    async getIkasById(id: string): Promise<IkasResponse> {
        return api.get<IkasResponse>(`/api/maturity/ikas/${id}`);
    },

    /** Get IKAS list by perusahaan ID. Returns null if not found or auth fails. */
    async getIkasByPerusahaan(perusahaanId: string): Promise<any | null> {
        try {
            return await api.get<any>(`/api/maturity/ikas?id_perusahaan=${perusahaanId}`);
        } catch (error) {
            // 401/403 = auth issue, 404 = not found — all mean "no data available"
            if (error instanceof ApiRequestError) {
                console.warn(`[IKAS Service] getIkasByPerusahaan: ${error.status} - ${error.message}`);
            }
            return null;
        }
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
        return api.post<IdentifikasiResponse>('/api/identifikasi', payload);
    },

    /** Get identifikasi by ID */
    async getIdentifikasiById(id: string): Promise<IdentifikasiResponse> {
        return api.get<IdentifikasiResponse>(`/api/identifikasi/${id}`);
    },

    /** Update identifikasi scores */
    async updateIdentifikasi(id: string, payload: Partial<IdentifikasiPayload>): Promise<IdentifikasiResponse> {
        return api.put<IdentifikasiResponse>(`/api/identifikasi/${id}`, payload);
    },

    // ─── Proteksi ──────────────────────────────────────────────────

    /** Save/create proteksi scores */
    async createProteksi(payload: ProteksiPayload): Promise<ProteksiResponse> {
        return api.post<ProteksiResponse>('/api/proteksi', payload);
    },

    /** Get proteksi by ID */
    async getProteksiById(id: string): Promise<ProteksiResponse> {
        return api.get<ProteksiResponse>(`/api/proteksi/${id}`);
    },

    /** Update proteksi scores */
    async updateProteksi(id: string, payload: Partial<ProteksiPayload>): Promise<ProteksiResponse> {
        return api.put<ProteksiResponse>(`/api/proteksi/${id}`, payload);
    },

    // ─── Deteksi ───────────────────────────────────────────────────

    /** Save/create deteksi scores */
    async createDeteksi(payload: DeteksiPayload): Promise<DeteksiResponse> {
        return api.post<DeteksiResponse>('/api/deteksi', payload);
    },

    /** Get deteksi by ID */
    async getDeteksiById(id: string): Promise<DeteksiResponse> {
        return api.get<DeteksiResponse>(`/api/deteksi/${id}`);
    },

    /** Update deteksi scores */
    async updateDeteksi(id: string, payload: Partial<DeteksiPayload>): Promise<DeteksiResponse> {
        return api.put<DeteksiResponse>(`/api/deteksi/${id}`, payload);
    },

    // ─── Gulih ─────────────────────────────────────────────────────

    /** Save/create gulih scores */
    async createGulih(payload: GulihPayload): Promise<GulihResponse> {
        return api.post<GulihResponse>('/api/gulih', payload);
    },

    /** Get gulih by ID */
    async getGulihById(id: string): Promise<GulihResponse> {
        return api.get<GulihResponse>(`/api/gulih/${id}`);
    },

    /** Update gulih scores */
    async updateGulih(id: string, payload: Partial<GulihPayload>): Promise<GulihResponse> {
        return api.put<GulihResponse>(`/api/gulih/${id}`, payload);
    },

    // ─── Pertanyaan IKAS ───────────────────────────────────

    /** Get pertanyaan identifikasi */
    async getPertanyaanIdentifikasi(): Promise<any> {
        return api.get<any>('/api/maturity/pertanyaan-identifikasi');
    },

    /** Get pertanyaan proteksi */
    async getPertanyaanProteksi(): Promise<any> {
        return api.get<any>('/api/maturity/pertanyaan-proteksi');
    },

    /** Get pertanyaan deteksi */
    async getPertanyaanDeteksi(): Promise<any> {
        return api.get<any>('/api/maturity/pertanyaan-deteksi');
    },

    /** Get pertanyaan gulih */
    async getPertanyaanGulih(): Promise<any> {
        return api.get<any>('/api/maturity/pertanyaan-gulih');
    },
};
