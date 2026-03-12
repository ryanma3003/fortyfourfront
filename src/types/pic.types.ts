export interface Perusahaan {
    id: string | number;
    nama_perusahaan: string;
}

export interface Pic {
    id: string | number;
    nama: string;
    telepon: string;
    perusahaan?: Perusahaan;
    id_perusahaan?: string | number;
    created_at?: string;
    updated_at?: string;
}

export interface CreatePicPayload {
    nama: string;
    telepon: string;
    id_perusahaan: string | number;
}

export interface UpdatePicPayload {
    nama?: string;
    telepon?: string;
}
