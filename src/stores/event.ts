import { defineStore } from 'pinia';
import { kegiatanService } from '@/services/kegiatan.service';
import type {
    Kegiatan,
    CreateKegiatanPayload,
    UpdateKegiatanPayload,
} from '@/types/kegiatan.types';

export const useEventStore = defineStore('event', {
    state: () => ({
        events: [] as Kegiatan[],
        loading: false,
        initialized: false,
        error: null as string | null,
    }),

    getters: {
        totalEvents: (state) => state.events.length,
        getEventById: (state) => (id: number | string) =>
            state.events.find((e) => e.id === Number(id)),
    },

    actions: {
        /**
         * Fetch all events from the API.
         * Caches in state; call refresh() to force-reload.
         */
        async fetchEvents() {
            if (this.initialized) return this.events;

            this.loading = true;
            this.error = null;

            try {
                const res = await kegiatanService.getAll();
                this.events = res.data || [];
                this.initialized = true;
            } catch (err: any) {
                console.error('Failed to fetch kegiatan:', err);
                this.error = err.message || 'Gagal memuat data event';
                this.events = [];
            } finally {
                this.loading = false;
            }

            return this.events;
        },

        /**
         * Force-refresh events list from the API.
         */
        async refresh() {
            this.loading = true;
            this.error = null;

            try {
                const res = await kegiatanService.getAll();
                this.events = res.data || [];
                this.initialized = true;
            } catch (err: any) {
                console.error('Failed to refresh kegiatan:', err);
                this.error = err.message || 'Gagal memuat data event';
            } finally {
                this.loading = false;
            }
        },

        /**
         * Fetch a single event by ID.
         */
        async fetchEventById(id: number) {
            try {
                const res = await kegiatanService.getById(id);
                return res.data;
            } catch (err: any) {
                console.error('Failed to fetch kegiatan detail:', err);
                throw err;
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
                // Refresh list to get full object from backend
                await this.refresh();
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
                await kegiatanService.update(Number(id), payload);
                // Refresh list
                await this.refresh();
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
                await kegiatanService.delete(Number(id));
                // Remove locally for instant UI update
                this.events = this.events.filter((e) => e.id !== Number(id));
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
