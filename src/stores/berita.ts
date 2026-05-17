import { defineStore } from 'pinia';
import { beritaService } from '@/services/berita.service';
import type {
    Berita,
    CreateBeritaPayload,
    UpdateBeritaPayload,
} from '@/types/berita.types';
import { sanitizeRichText } from '@/utils/richText';

const firstValue = (...values: any[]) => values.find((value) => value !== undefined && value !== null && value !== '');
const CACHE_TTL_MS = 2 * 60 * 1000;

let listFetchPromise: Promise<Berita[]> | null = null;
const detailFetchPromises = new Map<string, Promise<Berita | null>>();

const getBeritaId = (record: any): string => String(firstValue(
    record?.id,
    record?.ID,
    record?.id_berita,
    record?.berita_id,
    record?.event_id,
    record?.id_event,
    record?.data?.id,
    record?.data?.id_berita,
    ''
)).trim();

const normalizeBerita = (record: any): Berita | null => {
    if (!record || typeof record !== 'object') return null;
    const id = getBeritaId(record);
    if (!id) return null;

    const rawDescription = String(firstValue(record.deskripsi, record.description, record.keterangan, '') || '');

    return {
        ...record,
        id,
        judul: String(firstValue(record.judul, record.title, record.nama_berita, '') || ''),
        deskripsi: sanitizeRichText(rawDescription) || rawDescription,
        created_at: String(firstValue(record.created_at, record.createdAt, '') || ''),
        updated_at: String(firstValue(record.updated_at, record.updatedAt, '') || ''),
    };
};

const normalizeBeritaList = (response: any): Berita[] => {
    const items = Array.isArray(response?.data) ? response.data : [];
    return items.map(normalizeBerita).filter((item): item is Berita => Boolean(item));
};

export const useBeritaStore = defineStore('berita', {
    state: () => ({
        berita: [] as Berita[],
        beritaById: {} as Record<string, Berita>,
        lastFetchedAt: 0,
        loading: false,
        initialized: false,
        error: null as string | null,
    }),

    getters: {
        totalBerita: (state) => state.berita.length,
        getBeritaById: (state) => (id: number | string) =>
            state.beritaById[String(id)] || state.berita.find((item) => String(item.id) === String(id)),
    },

    actions: {
        isCacheFresh(maxAgeMs = CACHE_TTL_MS): boolean {
            return this.initialized && Date.now() - this.lastFetchedAt < maxAgeMs;
        },

        setBerita(items: Berita[]) {
            this.berita = items;
            this.beritaById = items.reduce((map, item) => {
                map[String(item.id)] = item;
                return map;
            }, {} as Record<string, Berita>);
            this.initialized = true;
            this.lastFetchedAt = Date.now();
        },

        upsertBerita(item: Berita | null) {
            if (!item?.id) return;

            const id = String(item.id);
            const existing = this.beritaById[id] || this.berita.find((entry) => String(entry.id) === id);
            const nextItem = { ...(existing || {}), ...item, id };
            const index = this.berita.findIndex((entry) => String(entry.id) === id);

            if (index >= 0) {
                this.berita.splice(index, 1, nextItem);
            } else if (this.initialized) {
                this.berita.unshift(nextItem);
            }

            this.beritaById[id] = nextItem;
            this.lastFetchedAt = Date.now();
        },

        async fetchBerita(options?: { force?: boolean; maxAgeMs?: number }) {
            const shouldForce = Boolean(options?.force);
            const maxAgeMs = options?.maxAgeMs ?? CACHE_TTL_MS;

            if (!shouldForce && this.isCacheFresh(maxAgeMs)) return this.berita;
            if (!shouldForce && listFetchPromise) return listFetchPromise;

            this.loading = true;
            this.error = null;

            listFetchPromise = (async () => {
                const res = await beritaService.getAll();
                const items = normalizeBeritaList(res);
                this.setBerita(items);
                return this.berita;
            })();

            try {
                return await listFetchPromise;
            } catch (err: any) {
                console.error('Failed to fetch berita:', err);
                this.error = err.message || 'Gagal memuat data berita';
                if (!this.initialized) this.setBerita([]);
                return this.berita;
            } finally {
                this.loading = false;
                listFetchPromise = null;
            }
        },

        async refresh() {
            return this.fetchBerita({ force: true, maxAgeMs: 0 });
        },

        async fetchBeritaById(id: number | string, options?: { force?: boolean }) {
            const resolvedId = String(id).trim();
            if (!resolvedId || resolvedId === 'NaN' || resolvedId === 'undefined' || resolvedId === 'null') {
                throw new Error('ID berita tidak valid');
            }

            const shouldForce = Boolean(options?.force);
            const cached = this.beritaById[resolvedId] || this.berita.find((item) => String(item.id) === resolvedId);
            if (!shouldForce && cached) return cached;

            if (!shouldForce && listFetchPromise) {
                await listFetchPromise;
                const fromList = this.beritaById[resolvedId] || this.berita.find((item) => String(item.id) === resolvedId);
                if (fromList) return fromList;
            }

            const activeDetailFetch = detailFetchPromises.get(resolvedId);
            if (!shouldForce && activeDetailFetch) return activeDetailFetch;

            const detailPromise = (async () => {
                const res = await beritaService.getById(resolvedId);
                const item = normalizeBerita(res?.data);
                this.upsertBerita(item);
                return item;
            })();

            detailFetchPromises.set(resolvedId, detailPromise);

            try {
                return await detailPromise;
            } catch (err: any) {
                console.error('Failed to fetch berita detail:', err);
                throw err;
            } finally {
                detailFetchPromises.delete(resolvedId);
            }
        },

        async createBerita(payload: CreateBeritaPayload) {
            this.loading = true;
            this.error = null;

            try {
                const res = await beritaService.create(payload);
                const createdRecord = normalizeBerita(res?.data);
                if (createdRecord?.judul) {
                    this.upsertBerita(createdRecord);
                } else if (this.initialized) {
                    const createdId = getBeritaId(res?.data);
                    if (createdId) {
                        this.upsertBerita({
                            ...payload,
                            id: createdId,
                            author_id: '',
                            created_at: '',
                            updated_at: '',
                        });
                    } else {
                        this.lastFetchedAt = 0;
                    }
                }
                return { success: true, data: res };
            } catch (err: any) {
                console.error('Failed to create berita:', err);
                this.error = err.message || 'Gagal membuat berita';
                this.loading = false;
                return { success: false, error: this.error };
            }
        },

        async updateBerita(id: number | string, payload: UpdateBeritaPayload) {
            this.loading = true;
            this.error = null;

            try {
                await beritaService.update(id, payload);
                const resolvedId = String(id);
                this.upsertBerita({
                    ...(this.beritaById[resolvedId] || {}),
                    ...payload,
                    id: resolvedId,
                    author_id: this.beritaById[resolvedId]?.author_id || '',
                    created_at: this.beritaById[resolvedId]?.created_at || '',
                    updated_at: this.beritaById[resolvedId]?.updated_at || '',
                });
                return { success: true };
            } catch (err: any) {
                console.error('Failed to update berita:', err);
                this.error = err.message || 'Gagal mengupdate berita';
                this.loading = false;
                return { success: false, error: this.error };
            }
        },

        async deleteBerita(id: number | string) {
            this.loading = true;
            this.error = null;

            try {
                const resolvedId = String(id);
                await beritaService.delete(resolvedId);
                this.berita = this.berita.filter((item) => String(item.id) !== resolvedId);
                delete this.beritaById[resolvedId];
                this.loading = false;
                return { success: true };
            } catch (err: any) {
                console.error('Failed to delete berita:', err);
                this.error = err.message || 'Gagal menghapus berita';
                this.loading = false;
                return { success: false, error: this.error };
            }
        },
    },
});
