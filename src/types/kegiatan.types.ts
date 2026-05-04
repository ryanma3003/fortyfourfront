/**
 * Kegiatan (Event) Type Definitions
 * Matches the backend API at /api/kegiatan
 */

export interface Kegiatan {
    id: number;
    judul: string;
    deskripsi: string;
    lokasi: string;
    tanggal: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export interface KegiatanListResponse {
    data: Kegiatan[];
    message: string;
    status: string;
    total: string;
}

export interface KegiatanDetailResponse {
    data: Kegiatan;
    message: string;
    status: string;
}

export interface CreateKegiatanPayload {
    judul: string;
    deskripsi: string;
    lokasi: string;
    tanggal: string; // ISO 8601, e.g. "2024-12-31T15:00:00Z"
}

export interface CreateKegiatanResponse {
    message: string;
    status: string;
    data: {
        id: number;
    };
}

export interface UpdateKegiatanPayload {
    judul: string;
    deskripsi: string;
    lokasi: string;
    tanggal: string;
}

export interface MutationResponse {
    message: string;
    status: string;
}
