// IKAS (Indeks Keamanan Siber) Type Definitions

// ─── POST /api/maturity/ikas ───────────────────────────────────────

export interface IkasIdentifikasiPayload {
    nilai_subdomain1: number;
    nilai_subdomain2: number;
    nilai_subdomain3: number;
    nilai_subdomain4: number;
    nilai_subdomain5: number;
}

export interface IkasProteksiPayload {
    nilai_subdomain1: number;
    nilai_subdomain2: number;
    nilai_subdomain3: number;
    nilai_subdomain4: number;
    nilai_subdomain5: number;
    nilai_subdomain6: number;
}

export interface IkasDeteksiPayload {
    nilai_subdomain1: number;
    nilai_subdomain2: number;
    nilai_subdomain3: number;
}

export interface IkasGulihPayload {
    nilai_subdomain1: number;
    nilai_subdomain2: number;
    nilai_subdomain3: number;
    nilai_subdomain4: number;
}

export interface IkasPayload {
    id_perusahaan: string;
    responden: string;
    jabatan: string;
    telepon: string;
    tanggal: string;
    target_nilai: number;
    identifikasi: IkasIdentifikasiPayload;
    proteksi: IkasProteksiPayload;
    deteksi: IkasDeteksiPayload;
    gulih: IkasGulihPayload;
}

export interface IkasResponse extends IkasPayload {
    id_identifikasi: string;
    id_proteksi: string;
    id_deteksi: string;
    id_gulih: string;
}

// ─── POST /api/maturity/domain ─────────────────────────────────────

export interface DomainPayload {
    nama_domain: string;
}

export interface DomainResponse {
    id: string;
    nama_domain: string;
    created_at: string;
    updated_at: string;
}

// ─── POST /api/maturity/kategori ───────────────────────────────────

export interface KategoriPayload {
    domain_id: string;
    nama_kategori: string;
}

export interface KategoriResponse {
    id: string;
    domain_id: string;
    nama_kategori: string;
    created_at: string;
    updated_at: string;
}

// ─── POST /api/maturity/sub-kategori ───────────────────────────────

export interface SubKategoriPayload {
    kategori_id: string;
    nama_sub_kategori: string;
}

export interface SubKategoriResponse {
    id: string;
    kategori_id: string;
    nama_sub_kategori: string;
    created_at: string;
    updated_at: string;
}

// ─── POST /api/maturity/ruang-lingkup ──────────────────────────────

export interface RuangLingkupPayload {
    nama_ruang_lingkup: string;
}

export interface RuangLingkupResponse {
    id: string;
    nama_ruang_lingkup: string;
    created_at: string;
    updated_at: string;
}

// ─── POST /api/identifikasi ────────────────────────────────────────

export interface IdentifikasiPayload {
    nilai_identifikasi: number;
    nilai_subdomain1: number;
    nilai_subdomain2: number;
    nilai_subdomain3: number;
    nilai_subdomain4: number;
    nilai_subdomain5: number;
}

export interface IdentifikasiResponse extends IdentifikasiPayload {
    id: string;
    created_at: string;
    updated_at: string;
}

// ─── POST /api/proteksi ────────────────────────────────────────

export interface ProteksiPayload {
    nilai_proteksi: number;
    nilai_subdomain1: number;
    nilai_subdomain2: number;
    nilai_subdomain3: number;
    nilai_subdomain4: number;
    nilai_subdomain5: number;
    nilai_subdomain6: number;
}

export interface ProteksiResponse extends ProteksiPayload {
    id: string;
    created_at: string;
    updated_at: string;
}

// ─── POST /api/deteksi ─────────────────────────────────────────

export interface DeteksiPayload {
    nilai_deteksi: number;
    nilai_subdomain1: number;
    nilai_subdomain2: number;
    nilai_subdomain3: number;
}

export interface DeteksiResponse extends DeteksiPayload {
    id: string;
    created_at: string;
    updated_at: string;
}

// ─── POST /api/gulih ───────────────────────────────────────────

export interface GulihPayload {
    nilai_gulih: number;
    nilai_subdomain1: number;
    nilai_subdomain2: number;
    nilai_subdomain3: number;
    nilai_subdomain4: number;
}

export interface GulihResponse extends GulihPayload {
    id: string;
    created_at: string;
    updated_at: string;
}

// ─── GET /api/maturity/pertanyaan-identifikasi ─────────────────────

export interface PertanyaanIdentifikasiResponse {
    id: number;
    pertanyaan_identifikasi: string;
    index0: string;
    index1: string;
    index2: string;
    index3: string;
    index4: string;
    index5: string;
    ruang_lingkup: {
        id: number;
        nama_ruang_lingkup: string;
    };
    sub_kategori: {
        id: number;
        nama_sub_kategori: string;
        kategori: {
            id: number;
            nama_kategori: string;
            domain: {
                id: number;
                nama_domain: string;
            };
        };
    };
    created_at: string;
    updated_at: string;
}
