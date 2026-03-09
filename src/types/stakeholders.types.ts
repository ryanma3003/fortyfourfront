export interface SubSektorNested {
    id: string;
    id_sektor: string;
    nama_sektor: string;
    nama_sub_sektor: string;
    created_at?: string;
    updated_at?: string;
}

export interface Stakeholder {
    id: string;
    slug: string;
    photo?: string;
    nama_perusahaan: string;
    // API returns nested sub_sektor object
    sub_sektor?: SubSektorNested;
    // Legacy flat field (kept for backward compat / display fallback)
    sektor?: string;
    alamat: string;
    telepon: string;
    email: string;
    website: string;
    created_at?: string;
    updated_at?: string;
}

export interface CreateStakeholderPayload {
    alamat: string;
    email: string;
    id_sub_sektor: string;
    nama_perusahaan: string;
    photo?: File | null;
    telepon: string;
    website: string;
}

export interface CreateStakeholderResponse {
    id: string;
    nilai_deteksi: number;
    nilai_subdomain1: number;
    nilai_subdomain2: number;
    nilai_subdomain3: number;
}
