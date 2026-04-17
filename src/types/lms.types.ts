/**
 * LMS Domain Types
 * Represents the contract with the backend API.
 */

// ── Kelas ────────────────────────────────────────────────────

export interface LmsKelas {
    id: string | number;
    nama_kelas: string;
    judul?: string;
    deskripsi: string;
    thumbnail?: string;
    status?: string;          // e.g. "aktif", "draft"
    created_at?: string;
    updated_at?: string;
    materi?: LmsMateri[];
    kuis?: LmsKuis[];
}

export interface CreateKelasPayload {
    nama_kelas: string;
    judul?: string;
    deskripsi: string;
    thumbnail?: File | string | null;
    status?: string;
}

export interface UpdateKelasPayload {
    nama_kelas?: string;
    judul?: string;
    deskripsi?: string;
    thumbnail?: File | string | null;
    status?: string;
}

// ── Materi ───────────────────────────────────────────────────

export interface LmsMateri {
    id: string | number;
    id_kelas?: string | number;
    judul: string;
    kategori: string;
    tipe?: 'teks' | 'video' | string;
    deskripsi: string;
    konten?: string;
    konten_html?: string;
    url_video?: string;
    urutan?: number;            // ordering within kelas
    file_pendukung?: LmsFilePendukung[];
    created_at?: string;
    updated_at?: string;
}

export interface CreateMateriPayload {
    judul: string;
    kategori: string;
    tipe?: 'teks' | 'video' | string;
    deskripsi: string;
    konten?: string;
    konten_html?: string;
    url_video?: string;
    urutan?: number;
}

export interface UpdateMateriPayload {
    judul?: string;
    kategori?: string;
    tipe?: 'teks' | 'video' | string;
    deskripsi?: string;
    konten?: string;
    konten_html?: string;
    url_video?: string;
    urutan?: number;
}

// ── File Pendukung ───────────────────────────────────────────

export interface LmsFilePendukung {
    id: string | number;
    id_materi?: string | number;
    nama_file: string;
    path_file: string;
    tipe_file?: string;
    ukuran?: number;
    created_at?: string;
    updated_at?: string;
}

// ── Kuis ─────────────────────────────────────────────────────

export interface LmsKuis {
    id: string | number;
    id_kelas?: string | number;
    judul: string;
    deskripsi: string;
    tipe_kuis?: 'per_materi' | 'final' | string;
    id_materi?: string | number | null;  // null for final quiz
    durasi?: number;            // duration in minutes
    soal?: LmsSoal[];
    created_at?: string;
    updated_at?: string;
}

export interface CreateKuisPayload {
    judul: string;
    deskripsi: string;
    tipe_kuis?: 'per_materi' | 'final' | string;
    id_materi?: string | number | null;
    durasi?: number;
}

export interface UpdateKuisPayload {
    judul?: string;
    deskripsi?: string;
    tipe_kuis?: 'per_materi' | 'final' | string;
    id_materi?: string | number | null;
    durasi?: number;
}

// ── Soal ─────────────────────────────────────────────────────

export interface LmsSoalOpsi {
    label: string;              // A, B, C, D
    text: string;
}

export interface LmsSoal {
    id: string | number;
    id_kuis?: string | number;
    pertanyaan: string;         // HTML (WYSIWYG)
    tipe: 'pilihan_ganda' | 'essay';
    opsi: LmsSoalOpsi[];
    jawaban_benar: string;      // label of correct option (A / B / C / D), empty for essay
    urutan?: number;
    created_at?: string;
    updated_at?: string;
}

export interface CreateSoalPayload {
    pertanyaan: string;
    tipe: 'pilihan_ganda' | 'essay';
    opsi?: LmsSoalOpsi[];
    pilihan_jawaban?: LmsSoalOpsi[];
    jawaban_benar: string;
    urutan?: number;
}

export interface UpdateSoalPayload {
    pertanyaan?: string;
    tipe?: 'pilihan_ganda' | 'essay';
    opsi?: LmsSoalOpsi[];
    pilihan_jawaban?: LmsSoalOpsi[];
    jawaban_benar?: string;
    urutan?: number;
}
