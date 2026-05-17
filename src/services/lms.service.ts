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
        return normalizeKelas(unwrapDataObject(response));
    },

    /**
     * Get kelas detail with materi + kuis from the kelas response.
     */
    async getKelasDetail(id: string | number): Promise<{ kelas: LmsKelas, materi: LmsMateri[], kuis: LmsKuis[] }> {
        const response = await api.get<any>(`/api/kelas/${id}`);
        const kelas = normalizeKelas(unwrapDataObject(response));
        return {
            kelas,
            materi: kelas.materi || [],
            kuis: getKelasKuis(kelas)
        };
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
        const body = buildKelasPayload(payload, { includeStatus: true });
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
            const { materi } = await this.getKelasDetail(kelasId);
            return materi;
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
            durasi_detik: Number(payload.durasi_detik ?? 0),
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
            durasi_detik: Number(payload.durasi_detik ?? 0),
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
            const { kuis } = await this.getKelasDetail(kelasId);
            return kuis;
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
        const res = await api.post<any>(`/api/kelas/${kelasId}/kuis`, body);
        return normalizeKuis(res?.data ?? res);
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
        const res = await api.put<any>(`/api/kuis/${id}`, body);
        return normalizeKuis(res?.data ?? res);
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

        const res = await api.post<any>(`/api/kuis/${kuisId}/soal`, body);
        return normalizeSoal(res?.data ?? res);
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

        const res = await api.put<any>(`/api/soal/${id}`, body);
        return normalizeSoal(res?.data ?? res);
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

function buildKelasPayload(payload: CreateKelasPayload | UpdateKelasPayload, options: { includeStatus?: boolean } = {}) {
    const judul = payload.judul ?? payload.nama_kelas ?? '';
    const form = new FormData();
    const append = (key: string, value: unknown) => {
        if (value === undefined || value === null) return;
        form.append(key, String(value));
    };

    append('judul', judul);
    append('deskripsi', payload.deskripsi ?? '');
    append('kategori', payload.kategori ?? '');
    append('durasi_jp', Number(payload.durasi_jp ?? 0));
    append('penyelenggara', payload.penyelenggara ?? '');
    append('target_peserta', payload.target_peserta ?? '');
    append('syarat_pendaftaran', payload.syarat_pendaftaran ?? '');
    append('informasi_umum', payload.informasi_umum ?? '');
    if (options.includeStatus) {
        append('status', normalizeKelasStatus(payload.status));
    }

    const thumbnail = (payload as any).thumbnail_file ?? payload.thumbnail;
    if (thumbnail instanceof File) {
        form.append('thumbnail_file', thumbnail);
    } else if (thumbnail) {
        append('thumbnail_url', thumbnail);
    }

    return form;
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

function unwrapDataObject(response: any): any {
    if (!response) return response;
    if (Array.isArray(response)) return response[0] ?? {};
    if (Array.isArray(response?.data)) return response.data[0] ?? {};

    const candidates = [
        response?.data?.kelas,
        response?.data?.detail,
        response?.data?.item,
        response?.data,
        response?.kelas,
        response?.detail,
        response?.item,
        response
    ];

    return candidates.find(candidate => candidate && !Array.isArray(candidate) && typeof candidate === 'object') || response;
}

function getKelasMateri(item: any): LmsMateri[] {
    const rawMateri = item?.materi ?? item?.materi_list ?? item?.materials;
    if (!rawMateri) return [];

    const kelasId = item?.id ?? item?.kelas_id ?? item?.id_kelas ?? '';
    return unwrapDataArray(rawMateri)
        .map(materi => normalizeMateri({
            ...materi,
            id_kelas: materi?.id_kelas ?? materi?.kelas_id ?? kelasId
        }))
        .sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
}

function getKelasKuis(item: any): LmsKuis[] {
    const kelasId = item?.id ?? item?.kelas_id ?? item?.id_kelas ?? '';
    const rawSources = [
        item?.kuis_list,
        item?.quiz_list,
        item?.kuis,
        item?.quiz,
        item?.quizzes
    ];

    const materi = Array.isArray(item?.materi) ? item.materi : getKelasMateri(item);
    for (const m of materi) {
        if ((m as any)?.kuis) rawSources.push((m as any).kuis);
        if ((m as any)?.quiz) rawSources.push((m as any).quiz);
        if ((m as any)?.kuis_list) rawSources.push((m as any).kuis_list);
    }

    const byId = new Map<string, LmsKuis>();
    let syntheticIndex = 0;

    for (const source of rawSources) {
        if (!source) continue;
        const rawKuis = Array.isArray(source) ? source : (isKuisLike(source) ? [source] : unwrapDataArray(source));
        const items = rawKuis.length > 0 ? rawKuis : [source];

        for (const kuis of items) {
            if (!kuis || typeof kuis !== 'object') continue;
            const normalized = normalizeKuis({
                ...kuis,
                id_kelas: kuis?.id_kelas ?? kuis?.kelas_id ?? kelasId
            });
            const key = String(normalized.id || `__inline_${syntheticIndex++}`);
            if (!byId.has(key)) byId.set(key, normalized);
        }
    }

    return [...byId.values()].sort((a: any, b: any) => (a.urutan || 0) - (b.urutan || 0));
}

function isKuisLike(item: any): boolean {
    if (!item || Array.isArray(item) || typeof item !== 'object') return false;
    return (
        item.is_final !== undefined ||
        item.id_materi !== undefined ||
        item.materi_id !== undefined ||
        item.passing_grade !== undefined ||
        item.durasi_menit !== undefined ||
        item.max_attempt !== undefined ||
        item.soal !== undefined
    );
}

function normalizeKelas(item: any): LmsKelas {
    const judul = String(item?.judul ?? item?.nama_kelas ?? item?.nama ?? '').trim();
    const hasMateriPayload = item?.materi !== undefined || item?.materi_list !== undefined || item?.materials !== undefined;
    const materi = getKelasMateri(item);
    const hasKuisPayload =
        item?.kuis_list !== undefined ||
        item?.quiz_list !== undefined ||
        item?.kuis !== undefined ||
        item?.quiz !== undefined ||
        item?.quizzes !== undefined ||
        materi.some(m => Boolean((m as any).kuis || (m as any).quiz || (m as any).kuis_list));
    const kuis = getKelasKuis({ ...item, materi });
    const normalized: LmsKelas = {
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
    if (hasMateriPayload) normalized.materi = materi;
    if (hasKuisPayload) {
        normalized.kuis = kuis;
        (normalized as any).kuis_list = kuis;
    }
    return normalized;
}

function normalizeKelasStatus(status: any): 'published' | 'draft' {
    const normalized = String(status ?? 'published').trim().toLowerCase();
    if (['draft', 'draf'].includes(normalized)) return 'draft';
    return 'published';
}

function normalizeMateri(item: any): LmsMateri {
    const kuis = item?.kuis ? normalizeKuis({
        ...item.kuis,
        id_kelas: item.kuis?.id_kelas ?? item.kuis?.kelas_id ?? item?.id_kelas ?? item?.kelas_id ?? '',
        id_materi: item.kuis?.id_materi ?? item.kuis?.materi_id ?? item?.id ?? item?.materi_id ?? ''
    }) : undefined;

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
        durasi_detik: Number(item?.durasi_detik ?? item?.duration_seconds ?? item?.durasi ?? item?.duration ?? 0),
        urutan: Number(item?.urutan ?? 0),
        file_pendukung: item?.file_pendukung ? unwrapDataArray(item.file_pendukung).map(normalizeFilePendukung) : [],
        ...(kuis ? { kuis } : {})
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
        id_materi: item?.id_materi ?? item?.materi_id ?? null,
        judul: String(item?.judul ?? item?.nama_kuis ?? item?.nama ?? 'Kuis Tanpa Judul').trim(),
        deskripsi: String(item?.deskripsi ?? ''),
        tipe_kuis: String(item?.tipe_kuis ?? item?.tipe ?? (isFinal ? 'final' : 'per_materi')),
        durasi_menit: Number(item?.durasi_menit ?? item?.durasi ?? 0),
        durasi: Number(item?.durasi ?? item?.durasi_menit ?? 0),
        max_attempt: Number(item?.max_attempt ?? item?.attempts ?? 0),
        passing_grade: Number(item?.passing_grade ?? item?.passing_score ?? 0),
        urutan: Number(item?.urutan ?? 0),
        soal: item?.soal ? unwrapDataArray(item.soal).map(normalizeSoal) : [],
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
