import { defineStore } from 'pinia';
import {
    konversiService,
    type KonversiPoinRecord,
} from '@/services/konversi.service';

let initializePromise: Promise<void> | null = null;
const perusahaanFetchPromises = new Map<string, Promise<KonversiPoinRecord | null>>();

export const useKonversiStore = defineStore('konversi', {
    state: () => ({
        records: [] as KonversiPoinRecord[],
        total: 0,
        initialized: false,
        loading: false,
        error: null as string | null,
        loadingByPerusahaanId: {} as Record<string, boolean>,
        errorByPerusahaanId: {} as Record<string, string>,
    }),

    getters: {
        recordsByPerusahaanId(state): Record<string, KonversiPoinRecord> {
            const map: Record<string, KonversiPoinRecord> = {};
            state.records.forEach((record) => {
                const id = String(record.perusahaan_id || '');
                if (id) map[id] = record;
            });
            return map;
        },

        totalCount(state): number {
            return state.total || state.records.length;
        },

        getByPerusahaanId(): (id: string | number | undefined | null) => KonversiPoinRecord | null {
            return (id: string | number | undefined | null) => {
                if (id === undefined || id === null || id === '') return null;
                return this.recordsByPerusahaanId[String(id)] || null;
            };
        },
    },

    actions: {
        upsertRecord(record: KonversiPoinRecord | null | undefined) {
            if (!record?.perusahaan_id) return;
            const id = String(record.perusahaan_id);
            const index = this.records.findIndex((item) => String(item.perusahaan_id) === id);
            if (index >= 0) {
                this.records.splice(index, 1, record);
            } else {
                this.records.push(record);
                this.total = Math.max(this.total, this.records.length);
            }
        },

        async initialize() {
            if (this.initialized) return;
            if (initializePromise) return initializePromise;

            this.loading = true;
            this.error = null;

            initializePromise = (async () => {
                const result = await konversiService.getAll();
                this.records = result.records;
                this.total = result.total;
                this.initialized = true;
            })();

            try {
                await initializePromise;
            } catch (error: any) {
                console.error('Failed to load konversi data:', error);
                this.error = error.message || 'Gagal memuat data konversi';
                this.records = [];
                this.total = 0;
            } finally {
                this.loading = false;
                initializePromise = null;
            }
        },

        async fetchForPerusahaanId(id: string | number | undefined | null, force = false): Promise<KonversiPoinRecord | null> {
            if (id === undefined || id === null || id === '') return null;
            const normalizedId = String(id);
            const cached = this.recordsByPerusahaanId[normalizedId] || null;
            if (cached && !force) return cached;

            const existing = perusahaanFetchPromises.get(normalizedId);
            if (existing && !force) return existing;

            this.loadingByPerusahaanId[normalizedId] = true;
            delete this.errorByPerusahaanId[normalizedId];

            const promise = (async () => {
                try {
                    const record = await konversiService.getByPerusahaanId(normalizedId);
                    if (record) this.upsertRecord(record);
                    return record;
                } catch (error: any) {
                    this.errorByPerusahaanId[normalizedId] = error?.message || 'Gagal memuat data konversi';
                    return null;
                } finally {
                    this.loadingByPerusahaanId[normalizedId] = false;
                    perusahaanFetchPromises.delete(normalizedId);
                }
            })();

            perusahaanFetchPromises.set(normalizedId, promise);
            return promise;
        },

        async fetchForPerusahaanIds(ids: Array<string | number | undefined | null>, force = false) {
            const uniqueIds = [...new Set(ids.filter((id) => id !== undefined && id !== null && id !== '').map((id) => String(id)))];
            await Promise.allSettled(uniqueIds.map((id) => this.fetchForPerusahaanId(id, force)));
        },

        async refresh() {
            this.loading = true;
            this.error = null;

            try {
                const result = await konversiService.getAll();
                this.records = result.records;
                this.total = result.total;
                this.initialized = true;
            } catch (error: any) {
                console.error('Failed to refresh konversi data:', error);
                this.error = error.message || 'Gagal memperbarui data konversi';
            } finally {
                this.loading = false;
            }
        },
    },
});