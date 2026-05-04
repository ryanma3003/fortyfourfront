/**
 * Berita Type Definitions
 * Matches the backend API at /api/berita
 */

export interface Berita {
    id: number;
    judul: string;
    deskripsi: string;
    author_id: string;
    author_name?: string;
    user_name?: string;
    username?: string;
    author?: {
        id?: string;
        name?: string;
        username?: string;
        display_name?: string;
    };
    user?: {
        id?: string;
        name?: string;
        username?: string;
        display_name?: string;
    };
    created_at: string;
    updated_at: string;
}

export interface BeritaListResponse {
    data: Berita[];
    message: string;
    status: string;
    total?: string | number;
}

export interface BeritaDetailResponse {
    data: Berita;
    message: string;
    status: string;
}

export interface CreateBeritaPayload {
    judul: string;
    deskripsi: string;
    author_id: string;
}

export interface CreateBeritaResponse {
    message: string;
    status: string;
    data: {
        id: number;
    };
}

export interface UpdateBeritaPayload {
    judul: string;
    deskripsi: string;
    author_id: string;
}

export interface BeritaMutationResponse {
    message: string;
    status: string;
}
