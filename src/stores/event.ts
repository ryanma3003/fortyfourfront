import { defineStore } from 'pinia';
import { kegiatanService } from '@/services/kegiatan.service';
import type {
    Kegiatan,
    CreateKegiatanPayload,
    UpdateKegiatanPayload,
} from '@/types/kegiatan.types';
import { sanitizeRichText } from '@/utils/richText';

const firstValue = (...values: any[]) => values.find((value) => value !== undefined && value !== null && value !== '');
const CACHE_TTL_MS = 2 * 60 * 1000;

let listFetchPromise: Promise<Kegiatan[]> | null = null;
const detailFetchPromises = new Map<string, Promise<Kegiatan | null>>();

const unwrapKegiatanCollection = (response: any): any[] => {
    if (Array.isArray(response)) return response;
    if (!response || typeof response !== 'object') return [];

    const candidates = [
        response.data,
        response.items,
        response.records,
        response.result,
        response.results,
        response.kegiatan,
        response.events,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate;
        if (candidate && typeof candidate === 'object') {
            const nested = unwrapKegiatanCollection(candidate);
            if (nested.length) return nested;
        }
    }

    return getKegiatanId(response) ? [response] : [];
};

const unwrapKegiatanRecord = (response: any): any => (
    response?.data?.data ||
    response?.data?.kegiatan ||
    response?.data?.event ||
    response?.data ||
    response?.kegiatan ||
    response?.event ||
    response ||
    null
);

export const getKegiatanId = (record: any): string => String(firstValue(
    record?.id,
    record?.ID,
    record?.id_kegiatan,
    record?.kegiatan_id,
    record?.event_id,
    record?.id_event,
    record?.data?.id,
    record?.data?.ID,
    record?.data?.id_kegiatan,
    record?.data?.kegiatan_id,
    record?.data?.event_id,
    record?.data?.id_event,
    '',
)).trim();

const normalizeKegiatan = (record: any): Kegiatan | null => {
    if (!record || typeof record !== 'object') return null;

    const id = getKegiatanId(record);
    if (!id) return null;

    const rawDescription = String(firstValue(record.deskripsi, record.description, record.keterangan, '') || '');

    return {
        ...record,
        id,
        judul: String(firstValue(record.judul, record.title, record.nama_kegiatan, record.nama_event, '') || ''),
        deskripsi: sanitizeRichText(rawDescription) || rawDescription,
        lokasi: String(firstValue(record.lokasi, record.location, record.tempat, '') || ''),
        tanggal: String(firstValue(record.tanggal, record.tanggal_kegiatan, record.event_date, record.date, '') || ''),
        status: String(firstValue(record.status, record.status_kegiatan, '') || ''),
        created_at: String(firstValue(record.created_at, record.createdAt, '') || ''),
        updated_at: String(firstValue(record.updated_at, record.updatedAt, '') || ''),
    };
};

const normalizeKegiatanList = (response: any): Kegiatan[] => (
    unwrapKegiatanCollection(response)
        .map(normalizeKegiatan)
        .filter((item): item is Kegiatan => Boolean(item))
);

export const useEventStore = defineStore('event', {
    state: () => ({
        events: [] as Kegiatan[],
        eventById: {} as Record<string, Kegiatan>,
        lastFetchedAt: 0,
        loading: false,
        initialized: false,
        error: null as string | null,
    }),

    getters: {
        totalEvents: (state) => state.events.length,
        getEventById: (state) => (id: number | string) =>
            state.eventById[String(id)] || state.events.find((e) => String(e.id) === String(id)),
    },

    actions: {
        isCacheFresh(maxAgeMs = CACHE_TTL_MS): boolean {
            return this.initialized && Date.now() - this.lastFetchedAt < maxAgeMs;
        },

        setEvents(items: Kegiatan[]) {
            this.events = items;
            this.eventById = items.reduce((map, item) => {
                map[String(item.id)] = item;
                return map;
            }, {} as Record<string, Kegiatan>);
            this.initialized = true;
            this.lastFetchedAt = Date.now();
        },

        upsertEvent(item: Kegiatan | null) {
            if (!item?.id) return;

            const id = String(item.id);
            const existing = this.eventById[id] || this.events.find((event) => String(event.id) === id);
            const nextItem = { ...(existing || {}), ...item, id };
            const index = this.events.findIndex((event) => String(event.id) === id);

            if (index >= 0) {
                this.events.splice(index, 1, nextItem);
            } else if (this.initialized) {
                this.events.unshift(nextItem);
            }

            this.eventById[id] = nextItem;
            this.lastFetchedAt = Date.now();
        },

        /**
         * Fetch all events from the API.
         * Caches in state; call refresh() to force-reload.
         */
        async fetchEvents(options?: { force?: boolean; maxAgeMs?: number }) {
            const shouldForce = Boolean(options?.force);
            const maxAgeMs = options?.maxAgeMs ?? CACHE_TTL_MS;

            if (!shouldForce && this.isCacheFresh(maxAgeMs)) return this.events;
            if (!shouldForce && listFetchPromise) return listFetchPromise;

            this.loading = true;
            this.error = null;

            listFetchPromise = (async () => {
                const res = await kegiatanService.getAll();
                const items = normalizeKegiatanList(res);
                this.setEvents(items);
                return this.events;
            })();

            try {
                return await listFetchPromise;
            } catch (err: any) {
                console.error('Failed to fetch kegiatan:', err);
                this.error = err.message || 'Gagal memuat data event';
                if (!this.initialized) this.setEvents([]);
                return this.events;
            } finally {
                this.loading = false;
                listFetchPromise = null;
            }
        },

        /**
         * Force-refresh events list from the API.
         */
        async refresh() {
            return this.fetchEvents({ force: true, maxAgeMs: 0 });
        },

        /**
         * Fetch a single event by ID.
         */
        async fetchEventById(id: number | string, options?: { force?: boolean }) {
            const resolvedId = String(id).trim();
            if (!resolvedId || resolvedId === 'NaN' || resolvedId === 'undefined' || resolvedId === 'null') {
                throw new Error('ID kegiatan tidak valid');
            }

            const shouldForce = Boolean(options?.force);
            const cached = this.eventById[resolvedId] || this.events.find((event) => String(event.id) === resolvedId);
            if (!shouldForce && cached) return cached;

            if (!shouldForce && listFetchPromise) {
                await listFetchPromise;
                const fromList = this.eventById[resolvedId] || this.events.find((event) => String(event.id) === resolvedId);
                if (fromList) return fromList;
            }

            const activeDetailFetch = detailFetchPromises.get(resolvedId);
            if (!shouldForce && activeDetailFetch) return activeDetailFetch;

            const detailPromise = (async () => {
                const res = await kegiatanService.getById(resolvedId);
                const item = normalizeKegiatan(unwrapKegiatanRecord(res));
                this.upsertEvent(item);
                return item;
            })();

            detailFetchPromises.set(resolvedId, detailPromise);

            try {
                return await detailPromise;
            } catch (err: any) {
                console.error('Failed to fetch kegiatan detail:', err);
                throw err;
            } finally {
                detailFetchPromises.delete(resolvedId);
            }
        },

        /**
         * Create a new event.
         */
        async createEvent(payload: CreateKegiatanPayload) {
            this.loading = true;
            this.error = null;

            try {
                const res = await kegiatanService.create(payload);
                const createdRecord = normalizeKegiatan(unwrapKegiatanRecord(res));
                if (createdRecord?.judul) {
                    this.upsertEvent(createdRecord);
                } else if (this.initialized) {
                    const createdId = getKegiatanId(unwrapKegiatanRecord(res));
                    if (createdId) {
                        this.upsertEvent({
                            ...payload,
                            id: createdId,
                            status: '',
                            created_at: '',
                            updated_at: '',
                        });
                    } else {
                        this.lastFetchedAt = 0;
                    }
                }
                return { success: true, data: res };
            } catch (err: any) {
                console.error('Failed to create kegiatan:', err);
                this.error = err.message || 'Gagal membuat event';
                this.loading = false;
                return { success: false, error: this.error };
            }
        },

        /**
         * Update an existing event.
         */
        async updateEvent(id: number | string, payload: UpdateKegiatanPayload) {
            this.loading = true;
            this.error = null;

            try {
                await kegiatanService.update(id, payload);
                const resolvedId = String(id);
                this.upsertEvent({
                    ...(this.eventById[resolvedId] || {}),
                    ...payload,
                    id: resolvedId,
                    status: this.eventById[resolvedId]?.status || '',
                    created_at: this.eventById[resolvedId]?.created_at || '',
                    updated_at: this.eventById[resolvedId]?.updated_at || '',
                });
                return { success: true };
            } catch (err: any) {
                console.error('Failed to update kegiatan:', err);
                this.error = err.message || 'Gagal mengupdate event';
                this.loading = false;
                return { success: false, error: this.error };
            }
        },

        /**
         * Delete an event by ID.
         */
        async deleteEvent(id: number | string) {
            this.loading = true;
            this.error = null;

            try {
                const resolvedId = String(id);
                await kegiatanService.delete(resolvedId);
                // Remove locally for instant UI update
                this.events = this.events.filter((e) => String(e.id) !== resolvedId);
                delete this.eventById[resolvedId];
                this.loading = false;
                return { success: true };
            } catch (err: any) {
                console.error('Failed to delete kegiatan:', err);
                this.error = err.message || 'Gagal menghapus event';
                this.loading = false;
                return { success: false, error: this.error };
            }
        },
    },
});
