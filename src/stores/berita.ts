import { defineStore } from 'pinia';
import { beritaService } from '@/services/berita.service';
import type {
    Berita,
    CreateBeritaPayload,
    UpdateBeritaPayload,
} from '@/types/berita.types';

export const useBeritaStore = defineStore('berita', {
    state: () => ({
        berita: [] as Berita[],
        loading: false,
        initialized: false,
        error: null as string | null,
    }),

    getters: {
        totalBerita: (state) => state.berita.length,
        getBeritaById: (state) => (id: number | string) =>
            state.berita.find((item) => item.id === Number(id)),
    },

    actions: {
        async fetchBerita() {
            if (this.initialized) return this.berita;

            this.loading = true;
            this.error = null;

            try {
                const res = await beritaService.getAll();
                this.berita = res.data || [];
                this.initialized = true;
            } catch (err: any) {
                console.error('Failed to fetch berita:', err);
                this.error = err.message || 'Gagal memuat data berita';
                this.berita = [];
            } finally {
                this.loading = false;
            }

            return this.berita;
        },

        async refresh() {
            this.loading = true;
            this.error = null;

            try {
                const res = await beritaService.getAll();
                this.berita = res.data || [];
                this.initialized = true;
            } catch (err: any) {
                console.error('Failed to refresh berita:', err);
                this.error = err.message || 'Gagal memuat data berita';
            } finally {
                this.loading = false;
            }
        },

        async fetchBeritaById(id: number) {
            try {
                const res = await beritaService.getById(id);
                return res.data;
            } catch (err: any) {
                console.error('Failed to fetch berita detail:', err);
                throw err;
            }
        },

        async createBerita(payload: CreateBeritaPayload) {
            this.loading = true;
            this.error = null;

            try {
                const res = await beritaService.create(payload);
                await this.refresh();
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
                await beritaService.update(Number(id), payload);
                await this.refresh();
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
                await beritaService.delete(Number(id));
                this.berita = this.berita.filter((item) => item.id !== Number(id));
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
