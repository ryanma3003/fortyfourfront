export interface Jabatan {
    id: string;
    nama_jabatan: string;
    created_at?: string;
    updated_at?: string;
}

export interface CreateJabatanPayload {
    nama_jabatan: string;
}
