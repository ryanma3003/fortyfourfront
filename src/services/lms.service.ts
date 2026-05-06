import { api } from '@/config/api';
import type {
    LmsKelas, CreateKelasPayload, UpdateKelasPayload,
    LmsMateri, CreateMateriPayload, UpdateMateriPayload,
    LmsFilePendukung,
    LmsKuis, CreateKuisPayload, UpdateKuisPayload,
    LmsSoal, CreateSoalPayload, UpdateSoalPayload,
    LmsFeedback
} from '@/types/lms.types';

/**
 * LMS Service
 * Handles all API calls for Kelas, Materi, File Pendukung, Kuis, and Soal.
 */
export const lmsService = {

    // ─── Kelas ───────────────────────────────────────────────────

    /**
     * Get all kelas
     */
    async getKelas(): Promise<LmsKelas[]> {
        const response = await api.get<any>('/api/kelas');
        return unwrapDataArray(response).map(normalizeKelas);
    },

    /**
     * Get kelas by ID
     */
    async getKelasById(id: string | number): Promise<LmsKelas> {
        const response = await api.get<any>(`/api/kelas/${id}`);
        return normalizeKelas(response?.data ?? response);
    },

    /**
     * Get kelas detail with materi + kuis in parallel (optimized)
     */
    async getKelasDetail(id: string | number): Promise<{ materi: LmsMateri[], kuis: LmsKuis[] }> {
        const [kelasRes, kuisRes] = await Promise.all([
            api.get<any>(`/api/kelas/${id}`),
            api.get<any>(`/api/kelas/${id}/kuis`).catch(() => [])
        ]);
        const kelasData = kelasRes?.data ?? kelasRes;
        const materi = kelasData?.materi ? unwrapDataArray(kelasData.materi).map(normalizeMateri) : [];
        const kuis = unwrapDataArray(kuisRes?.data ?? kuisRes).map(normalizeKuis);
        return { materi, kuis };
    },

    /**
     * Create a new kelas (POST /api/kelas)
     */
    async createKelas(payload: CreateKelasPayload): Promise<LmsKelas> {
        const body = buildKelasPayload(payload);
        const response = await api.post<any>('/api/kelas', body);
        return normalizeKelas(response?.data ?? response);
    },

    /**
     * Update an existing kelas (PUT /api/kelas/{id})
     */
    async updateKelas(id: string | number, payload: UpdateKelasPayload): Promise<LmsKelas> {
        const body = buildKelasPayload(payload);
        const response = await api.put<any>(`/api/kelas/${id}`, body);
        return normalizeKelas(response?.data ?? response);
    },

    /**
     * Delete kelas (DELETE /api/kelas/{id})
     */
    async deleteKelas(id: string | number): Promise<void> {
        return api.delete(`/api/kelas/${id}`);
    },

    // ─── Materi ──────────────────────────────────────────────────

    /**
     * Get materi (by kelas if provided, otherwise all)
     */
    async getMateriByKelas(kelasId?: string | number): Promise<LmsMateri[]> {
        if (!kelasId) {
            try {
                const kls = await this.getKelas();
                const all: LmsMateri[] = [];
                for (const k of kls) {
                    if ((k as any).materi) {
                        unwrapDataArray((k as any).materi).forEach(m => all.push(normalizeMateri({...m, id_kelas: k.id})));
                    }
                }
                return all;
            } catch (e) {
                return [];
            }
        }
        try {
            // Detail Kelas returns `materi` array inside it
            const res = await api.get<any>(`/api/kelas/${kelasId}`);
            const data = res?.data ?? res;
            if (data?.materi) {
                return unwrapDataArray(data.materi).map(normalizeMateri);
            }
            return [];
        } catch (e: any) {
            console.error('[API Error] getMateriByKelas failed:', e);
            return [];
        }
    },

    /**
     * Add materi to kelas (POST /api/kelas/{id}/materi)
     */
    async createMateri(kelasId: string | number, payload: CreateMateriPayload): Promise<LmsMateri> {
        const urlVideo = payload.url_video || '';
        let youtubeId = urlVideo;
        const match = urlVideo.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
        if (match) {
            youtubeId = match[1];
        }

        const requestPayload = {
            judul: payload.judul,
            kategori: payload.kategori || 'Pelajaran',
            tipe: payload.tipe || 'teks',
            deskripsi_singkat: payload.deskripsi || '',
            konten: payload.konten || '',
            konten_html: payload.konten_html || '',
            youtube_id: youtubeId,
            urutan: (payload as any).urutan || 1
        };
        const res = await api.post(`/api/kelas/${kelasId}/materi`, requestPayload);
        return normalizeMateri(res?.data ?? res);
    },

    /**
     * Update materi (PUT /api/materi/{id})
     */
    async updateMateri(id: string | number, payload: UpdateMateriPayload): Promise<LmsMateri> {
        const urlVideo = payload.url_video || '';
        let youtubeId = urlVideo;
        if (urlVideo) {
            const match = urlVideo.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
            if (match) {
                youtubeId = match[1];
            }
        }

        const requestPayload = {
            judul: payload.judul,
            kategori: payload.kategori || 'Pelajaran',
            tipe: payload.tipe || 'teks',
            deskripsi_singkat: payload.deskripsi || '',
            konten: payload.konten || '',
            konten_html: payload.konten_html || '',
            youtube_id: youtubeId,
            ...((payload as any).urutan ? { urutan: (payload as any).urutan } : {})
        };
        const res = await api.put(`/api/materi/${id}`, requestPayload);
        return normalizeMateri(res?.data ?? res);
    },

    /**
     * Delete materi (DELETE /api/materi/{id})
     */
    async deleteMateri(id: string | number): Promise<void> {
        return api.delete(`/api/materi/${id}`);
    },

    // ─── File Pendukung ──────────────────────────────────────────

    /**
     * Upload file pendukung to materi (POST /api/materi/{id}/file-pendukung)
     */
    async uploadFilePendukung(materiId: string | number, file: File): Promise<LmsFilePendukung> {
        const form = new FormData();
        form.append('file', file);
        form.append('file_pendukung', file);
        const res = await api.post<any>(`/api/materi/${materiId}/file-pendukung`, form);
        return normalizeFilePendukung(res?.data ?? res);
    },

    /**
     * Delete file pendukung (DELETE /api/file-pendukung/{id})
     */
    async deleteFilePendukung(id: string | number): Promise<void> {
        return api.delete(`/api/file-pendukung/${id}`);
    },

    // ─── Kuis ────────────────────────────────────────────────────

    /**
     * Get kuis (by kelas if provided, otherwise all)
     */
    async getKuisByKelas(kelasId?: string | number): Promise<LmsKuis[]> {
        if (!kelasId) {
            try {
                const kls = await this.getKelas();
                const all: LmsKuis[] = [];
                for (const k of kls) {
                    if ((k as any).kuis || (k as any).quiz || (k as any).kuis_list) {
                        const arr = (k as any).kuis || (k as any).quiz || (k as any).kuis_list;
                        unwrapDataArray(arr).forEach(q => all.push(normalizeKuis({...q, id_kelas: k.id})));
                    }
                }
                return all;
            } catch (e) {
                return [];
            }
        }
        try {
            // GET /api/kelas/{id_kelas}/kuis
            const res = await api.get<any>(`/api/kelas/${kelasId}/kuis`);
            return unwrapDataArray(res?.data ?? res).map(normalizeKuis);
        } catch (e: any) {
            console.error('[API Error] getKuisByKelas API failed:', e);
            return [];
        }
    },

    /**
     * Create kuis for kelas (POST /api/kelas/{id}/kuis)
     */
    async createKuis(kelasId: string | number, payload: CreateKuisPayload): Promise<LmsKuis> {
        const body = {
            judul: payload.judul,
            deskripsi: payload.deskripsi || '',
            is_final: payload.tipe_kuis === 'final',
            id_materi: payload.tipe_kuis === 'final' ? null : (payload.id_materi || null),
            urutan: (payload as any).urutan || (payload.tipe_kuis === 'final' ? 99 : 1),
            durasi_menit: payload.durasi || (payload as any).durasi_menit || 30,
            max_attempt: (payload as any).max_attempt || 3,
            passing_grade: (payload as any).passing_grade ?? 70,
        };
        return api.post<LmsKuis>(`/api/kelas/${kelasId}/kuis`, body);
    },

    /**
     * Update kuis (PUT /api/kuis/{id})
     */
    async updateKuis(id: string | number, payload: UpdateKuisPayload): Promise<LmsKuis> {
        const body = {
            judul: payload.judul,
            deskripsi: payload.deskripsi || '',
            is_final: payload.tipe_kuis === 'final',
            id_materi: payload.tipe_kuis === 'final' ? null : (payload.id_materi || null),
            urutan: (payload as any).urutan || (payload.tipe_kuis === 'final' ? 99 : 1),
            durasi_menit: payload.durasi || (payload as any).durasi_menit || 30,
            max_attempt: (payload as any).max_attempt || 3,
            passing_grade: (payload as any).passing_grade ?? 70,
        };
        return api.put<LmsKuis>(`/api/kuis/${id}`, body);
    },

    /**
     * Delete kuis (DELETE /api/kuis/{id})
     */
    async deleteKuis(id: string | number): Promise<void> {
        return api.delete(`/api/kuis/${id}`);
    },

    // ─── Soal ────────────────────────────────────────────────────

    /**
     * Get soal (by kuis if provided)
     */
    async getSoalByKuis(kuisId?: string | number): Promise<LmsSoal[]> {
        if (!kuisId) return [];
        try {
            // GET /api/kuis/{id_kuis}/soal
            const res = await api.get<any>(`/api/kuis/${kuisId}/soal`);
            return unwrapDataArray(res?.data ?? res).map(normalizeSoal);
        } catch (e: any) {
            console.error('[API Error] getSoalByKuis failed:', e);
            return [];
        }
    },

    /**
     * Add soal to kuis (POST /api/kuis/{id_kuis}/soal)
     */
    async createSoal(kuisId: string | number, payload: CreateSoalPayload): Promise<LmsSoal> {
        const pilihan = (payload.opsi || []).map((o: any, idx: number) => ({
            teks: o.text || '',
            is_correct: payload.jawaban_benar === o.label,
            urutan: idx + 1
        }));
        
        const body = {
            pertanyaan: payload.pertanyaan || '',
            urutan: (payload as any).urutan || 1,
            pilihan: pilihan
        };

        return api.post<LmsSoal>(`/api/kuis/${kuisId}/soal`, body);
    },

    /**
     * Update soal (PUT /api/soal/{id})
     */
    async updateSoal(id: string | number, payload: UpdateSoalPayload): Promise<LmsSoal> {
        const pilihan = (payload.opsi || []).map((o: any, idx: number) => ({
            teks: o.text || '',
            is_correct: payload.jawaban_benar === o.label,
            urutan: idx + 1
        }));
        
        const body = {
            pertanyaan: payload.pertanyaan || '',
            urutan: (payload as any).urutan || 1,
            pilihan: pilihan
        };

        return api.put<LmsSoal>(`/api/soal/${id}`, body);
    },

    /**
     * Delete soal (DELETE /api/soal/{id})
     */
    async deleteSoal(id: string | number): Promise<void> {
        return api.delete(`/api/soal/${id}`);
    },

    // ─── Feedback ────────────────────────────────────────────────
    async getFeedbackByMateri(materiId: string | number): Promise<LmsFeedback[]> {
        const response = await api.get<any>(`/api/materi/${materiId}/feedback/all`);
        return unwrapDataArray(response).map(normalizeFeedback);
    },
};

function buildKelasPayload(payload: CreateKelasPayload | UpdateKelasPayload) {
    const judul = payload.judul ?? payload.nama_kelas ?? '';
    return {
        judul,
        deskripsi: payload.deskripsi ?? '',
        durasi_jp: Number(payload.durasi_jp ?? 0),
        informasi_umum: payload.informasi_umum ?? '',
        kategori: payload.kategori ?? '',
        penyelenggara: payload.penyelenggara ?? '',
        syarat_pendaftaran: payload.syarat_pendaftaran ?? '',
        target_peserta: payload.target_peserta ?? '',
        thumbnail: payload.thumbnail ?? '',
        status: normalizeKelasStatus(payload.status),
    };
}

function unwrapDataArray(response: any): any[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;

    // Breadth-first search to find the first array
    const queue = [response];
    while (queue.length > 0) {
        const current = queue.shift();
        if (Array.isArray(current)) return current;
        if (current && typeof current === 'object') {
            for (const key of Object.keys(current)) {
                if (Array.isArray(current[key])) return current[key];
                if (current[key] !== null && typeof current[key] === 'object') {
                    queue.push(current[key]);
                }
            }
        }
    }

    return [];
}

function normalizeKelas(item: any): LmsKelas {
    const judul = String(item?.judul ?? item?.nama_kelas ?? item?.nama ?? '').trim();
    return {
        ...item,
        id: item?.id ?? item?.kelas_id ?? '',
        nama_kelas: judul,
        judul,
        deskripsi: String(item?.deskripsi ?? item?.description ?? ''),
        durasi_jp: Number(item?.durasi_jp ?? 0),
        informasi_umum: String(item?.informasi_umum ?? ''),
        kategori: String(item?.kategori ?? ''),
        penyelenggara: String(item?.penyelenggara ?? ''),
        syarat_pendaftaran: String(item?.syarat_pendaftaran ?? ''),
        target_peserta: String(item?.target_peserta ?? ''),
        thumbnail: item?.thumbnail ?? item?.thumnail ?? '',
        status: normalizeKelasStatus(item?.status),
    };
}

function normalizeKelasStatus(status: any): 'published' | 'draft' {
    const normalized = String(status ?? 'published').trim().toLowerCase();
    if (['draft', 'draf'].includes(normalized)) return 'draft';
    return 'published';
}

function normalizeMateri(item: any): LmsMateri {
    return {
        ...item,
        id: item?.id ?? item?.materi_id ?? '',
        id_kelas: item?.id_kelas ?? item?.kelas_id ?? '',
        judul: String(item?.judul ?? item?.nama_materi ?? 'Tanpa Judul').trim(),
        kategori: String(item?.kategori ?? 'Lainnya'),
        deskripsi: String(item?.deskripsi ?? item?.deskripsi_singkat ?? ''),
        tipe: String(item?.tipe ?? item?.type ?? 'teks') as any,
        konten: String(item?.konten ?? item?.konten_html ?? ''),
        url_video: String(item?.url_video ?? item?.youtube_id ?? item?.id_youtube ?? item?.video_url ?? item?.video ?? item?.link_video ?? (item?.tipe === 'video' ? item?.konten : '') ?? item?.url ?? item?.path ?? item?.video_path ?? item?.materi_url ?? ''),
        urutan: Number(item?.urutan ?? 0),
        file_pendukung: item?.file_pendukung ? unwrapDataArray(item.file_pendukung).map(normalizeFilePendukung) : []
    };
}

function normalizeFilePendukung(item: any): LmsFilePendukung {
    return {
        ...item,
        id: item?.id ?? item?.file_id ?? '',
        id_materi: item?.id_materi ?? item?.materi_id ?? '',
        nama_file: String(item?.nama_file ?? item?.name ?? 'Berkas Pendukung'),
        path_file: String(item?.path_file ?? item?.url ?? item?.file_path ?? ''),
        tipe_file: String(item?.tipe_file ?? item?.type ?? 'application/pdf'),
        ukuran: Number(item?.ukuran ?? item?.size ?? 0)
    };
}

function normalizeKuis(item: any): LmsKuis {
    const isFinal = item?.is_final === true || item?.is_final === 'true' || item?.is_final === 1;
    return {
        ...item,
        id: item?.id ?? item?.kuis_id ?? item?.quiz_id ?? '',
        id_kelas: item?.id_kelas ?? item?.kelas_id ?? '',
        judul: String(item?.judul ?? item?.nama_kuis ?? item?.nama ?? 'Kuis Tanpa Judul').trim(),
        deskripsi: String(item?.deskripsi ?? ''),
        tipe_kuis: String(item?.tipe_kuis ?? item?.tipe ?? (isFinal ? 'final' : 'per_materi')),
        durasi_menit: Number(item?.durasi_menit ?? item?.durasi ?? 0),
        max_attempt: Number(item?.max_attempt ?? item?.attempts ?? 0),
        passing_grade: Number(item?.passing_grade ?? item?.passing_score ?? 0),
    };
}

function normalizeSoal(item: any): LmsSoal {
    let opsiRaw = item?.opsi ?? item?.pilihan_jawaban ?? item?.pilihan ?? [];
    if (typeof opsiRaw === 'string') {
        try { opsiRaw = JSON.parse(opsiRaw); } catch { opsiRaw = []; }
    }
    
    const labels = ["A", "B", "C", "D", "E"];
    let mappedOpsi: any[] = [];
    let jawabanBenar = String(item?.jawaban_benar ?? item?.kunci_jawaban ?? item?.kunci ?? '');

    if (Array.isArray(opsiRaw) && opsiRaw.length > 0) {
        mappedOpsi = opsiRaw.map((o: any, idx: number) => {
            const label = labels[idx] || String.fromCharCode(65 + idx);
            // If backend provides is_correct = true, this is the correct answer
            if (o.is_correct || o.kunci === true || o.benar === true) {
                jawabanBenar = label;
            }
            return {
                id: o.id || '',
                label: o.label || label,
                text: o.text ?? o.teks ?? o.jawaban ?? '',
                urutan: o.urutan ?? idx + 1
            };
        });
        
        // Ensure at least 4 items for UI rendering
        while(mappedOpsi.length < 4) {
            const idx = mappedOpsi.length;
            mappedOpsi.push({
                label: labels[idx] || String.fromCharCode(65 + idx),
                text: ''
            });
        }
    } else {
        mappedOpsi = [
            { label: 'A', text: '' },
            { label: 'B', text: '' },
            { label: 'C', text: '' },
            { label: 'D', text: '' }
        ];
    }

    return {
        ...item,
        id: item?.id ?? item?.soal_id ?? '',
        pertanyaan: String(item?.pertanyaan ?? item?.soal ?? item?.text ?? 'Tanpa Pertanyaan').trim(),
        tipe: String(item?.tipe ?? 'pilihan_ganda') as any,
        jawaban_benar: jawabanBenar,
        opsi: mappedOpsi,
    };
}

function normalizeFeedback(item: any): LmsFeedback {
    const feedback = String(item?.feedback ?? item?.komentar ?? item?.comment ?? item?.teks ?? item?.isi ?? '');
    return {
        ...item,
        id: item?.id ?? '',
        id_materi: item?.id_materi ?? item?.materi_id ?? '',
        id_user: item?.id_user ?? item?.user_id ?? '',
        user_name: item?.user?.name ?? item?.user?.nama ?? item?.user_name ?? item?.nama_user ?? item?.nama ?? 'User',
        komentar: feedback,
        feedback,
        rating: item?.rating !== undefined ? Number(item.rating) : undefined,
        created_at: item?.created_at ?? '',
    };
}
