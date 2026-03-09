/**
 * CSIRT Domain Types
 * Represents the contract with the backend.
 */

export interface CsirtMember {
    id: string;
    id_perusahaan?: number;
    nama_csirt: string;
    web_csirt: string;
    telepon_csirt: string;
    file_rfc2350: string;
    file_public_key_pgp: string;
    photo_csirt: string;
    /** Legacy field alias kept for old dummy data */
    img_csirt?: string;
    slug?: string;
    perusahaan?: {
        id: string;
        nama_perusahaan: string;
        alamat: string;
        email: string;
        telepon: string;
        website: string;
        photo: string;
        created_at?: string;
        updated_at?: string;
        sub_sektor?: {
            id: string;
            id_sektor: string;
            nama_sektor: string;
            nama_sub_sektor: string;
            created_at?: string;
            updated_at?: string;
        };
    };
}

export interface CreateCsirtPayload {
    id_perusahaan: string | number;
    slug?: string;
    nama_csirt: string;
    web_csirt: string;
    telepon_csirt: string;
    file_rfc2350?: File | string | null;
    file_public_key_pgp?: File | string | null;
    photo_csirt?: File | string | null;
}

export interface SdmCsirt {
    id: number;
    id_csirt: number;
    nama_personel: string;
    jabatan_csirt: string;
    jabatan_perusahaan: string;
    skill: string;
    sertifikasi: string;
}

export interface SeCsirt {
    id: number;
    id_csirt: number;
    nama_se: string;
    ip_se: string;
    as_number_se: string;
    pengelola_se: string;
    fitur_se: string;
    kategori_se: string;
}
