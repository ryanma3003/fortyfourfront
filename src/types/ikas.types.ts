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
    jabatan: string;
    responden: string;
    tanggal: string;
    target_nilai: number;
    telepon: string;
}

export interface IkasResponse {
    id: string;
    id_perusahaan: string;
    jabatan: string;
    responden: string;
    tanggal: string;
    target_nilai: number;
    telepon: string;
    perusahaan?: any;
    identifikasi?: any;
    proteksi?: any;
    deteksi?: any;
    gulih?: any;
    nilai_kematangan?: number;
    is_validated: boolean;
    edit_request_status: string;
    edit_request_reason: string;
    created_at: string;
    updated_at: string;
}

export interface IkasAuditLog {
    id: string | number;
    ikas_id?: string | number;
    id_ikas?: string | number;
    id_perusahaan?: string | number;
    perusahaan_id?: string | number;
    action?: string;
    aksi?: string;
    event?: string;
    status?: string;
    title?: string;
    judul?: string;
    description?: string;
    deskripsi?: string;
    note?: string;
    catatan?: string;
    actor?: string;
    user?: string | { name?: string; nama?: string; email?: string };
    created_by?: string;
    created_at?: string;
    updated_at?: string;
}

export interface IkasAuditLogListResponse {
    data: IkasAuditLog[];
    message?: string;
    status?: string;
    total?: string | number;
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

export interface JawabanPayload {
    id?: string;
    id_ikas?: string;
    ikas_id ?: string;
    id_pertanyaan?: string;
    pertanyaan_identifikasi_id?: number | string;
    pertanyaan_proteksi_id?: number | string;
    pertanyaan_deteksi_id?: number | string;
    pertanyaan_gulih_id?: number | string;
    id_perusahaan?: string;
    perusahaan_id?: string;
    jawaban?: number | string;
    jawaban_identifikasi?: number | string;
    jawaban_proteksi?: number | string;
    jawaban_deteksi?: number | string;
    jawaban_gulih?: number | string;
    nilai?: number;
}

export interface JawabanResponse {
    id: string;
    id_ikas?: string;
    ikas_id?: string;
    id_pertanyaan?: string;
    pertanyaan_identifikasi_id?: number | string;
    pertanyaan_proteksi_id?: number | string;
    pertanyaan_deteksi_id?: number | string;
    pertanyaan_gulih_id?: number | string;
    id_perusahaan?: string;
    perusahaan_id?: string;
    jawaban?: number | string;
    jawaban_identifikasi?: number | string;
    jawaban_proteksi?: number | string;
    jawaban_deteksi?: number | string;
    jawaban_gulih?: number | string;
    nilai?: number;
    created_at?: string;
    updated_at?: string;
}

// Specific response shape for Gulih jawaban including nested pertanyaan structure
export interface JawabanGulihResponse extends JawabanResponse {
    evidence?: string;
    jawaban_gulih?: number;
    keterangan?: string;
    pertanyaan_gulih?: {
        id: number;
        pertanyaan_gulih: string;
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
    };
    perusahaan_id?: string;
    created_at?: string;
    updated_at?: string;
    validasi?: string;
}

export interface JawabanIdentifikasiPayload {
    perusahaan_id: string;                    // UUID perusahaan — WAJIB untuk filter GET
    pertanyaan_identifikasi_id: number;       // ID pertanyaan dari backend
    jawaban_identifikasi: number;             // nilai 0-5
    keterangan?: string;
    evidence?: string;
    validasi?: string;
}

export interface JawabanProteksiPayload {
    perusahaan_id: string;
    pertanyaan_proteksi_id: number;
    jawaban_proteksi: number;
    keterangan?: string;
    evidence?: string;
    validasi?: string;
}

export interface JawabanDeteksiPayload {
    perusahaan_id: string;
    pertanyaan_deteksi_id: number;
    jawaban_deteksi: number;
    keterangan?: string;
    evidence?: string;
    validasi?: string;
}

export interface JawabanGulihPayload {
    perusahaan_id: string;
    pertanyaan_gulih_id: number;
    jawaban_gulih: number;
    keterangan?: string;
    evidence?: string;
    validasi?: string;
}
