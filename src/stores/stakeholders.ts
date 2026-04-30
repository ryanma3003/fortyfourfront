// stores/stakeholders.ts
import { defineStore } from 'pinia';
import { stakeholdersService } from '@/services/stakeholders.service';
import type { Stakeholder, CreateStakeholderPayload } from '@/types/stakeholders.types';

let initializePromise: Promise<void> | null = null;
const STAKEHOLDERS_CACHE_KEY = 'vyzor:stakeholders:list:v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

function readStakeholdersCache(): Stakeholder[] | null {
    try {
        const raw = sessionStorage.getItem(STAKEHOLDERS_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.savedAt || Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
        return Array.isArray(parsed.data) ? parsed.data : null;
    } catch {
        return null;
    }
}

function writeStakeholdersCache(data: Stakeholder[]) {
    try {
        sessionStorage.setItem(STAKEHOLDERS_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
    } catch {
        // Ignore storage quota/private-mode failures.
    }
}

export const useStakeholdersStore = defineStore('stakeholders', {
    state: () => ({
        stakeholders: [] as Stakeholder[],
        initialized: false,
        loading: false,
        error: null as string | null,
    }),

    getters: {
        // Get all stakeholders
        allStakeholders(): Stakeholder[] {
            return this.stakeholders;
        },

        // Get stakeholder by slug
        getStakeholderBySlug(): (slug: string) => Stakeholder | undefined {
            return (slug: string) => this.stakeholders.find(s => s.slug === slug);
        },

        // Indexes for O(1) Lookups (cached by Pinia)
        stakeholdersByIdMap(state): Record<string, Stakeholder> {
            const map: Record<string, Stakeholder> = {};
            state.stakeholders.forEach(s => { map[String(s.id)] = s; });
            return map;
        },

        // Get stakeholder by id
        getStakeholderById(): (id: string) => Stakeholder | undefined {
            return (id: string) => this.stakeholders.find(s => s.id === id);
        },
    },

    actions: {
        /** Normalise a backend-returned image path to a full URL.
         *  Handles: full https URLs, relative storage/ paths, bare filenames. */
        formatImageUrl(path: string | undefined | null): string {
            if (!path) return '';
            if (path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('/images/')) return path;
            if (path.startsWith('http://') || path.startsWith('https://')) {
                // Full URL — if the path component is a bare filename (no directory), prepend /uploads/
                try {
                    const url = new URL(path);
                    const parts = url.pathname.split('/').filter(Boolean);
                    if (parts.length === 1) {
                        url.pathname = `/uploads/${parts[0]}`;
                        return url.toString();
                    }
                } catch { /* ignore */ }
                return path;
            }
            // Relative path → prepend backend base URL
            const baseUrl = (import.meta.env.VITE_STORAGE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
            const cleanPath = path.replace(/^\//, '');
            // Bare filename (no slash) → stored in uploads/ directory
            const storagePath = !cleanPath.includes('/') ? `uploads/${cleanPath}` : cleanPath;
            return baseUrl ? `${baseUrl}/${storagePath}` : `/${storagePath}`;
        },

        /**
         * Initialize stakeholders from backend API
         */
        async initialize() {
            if (this.initialized) return;
            if (initializePromise) return initializePromise;

            const cached = readStakeholdersCache();
            if (cached) {
                this.stakeholders = cached;
                this.initialized = true;
                this.error = null;
                return;
            }

            this.loading = true;
            this.error = null;

            initializePromise = (async () => {
                const data = await stakeholdersService.getAll();
                console.log('Stakeholders from backend:', data);
                this.stakeholders = data.map(s => ({
                    ...s,
                    slug: s.slug || this.generateSlug(s.nama_perusahaan),
                    photo: this.formatImageUrl(s.photo),
                }));
                writeStakeholdersCache(this.stakeholders);
                this.initialized = true;
            })();

            try {
                await initializePromise;
                this.loading = false;
            } catch (error: any) {
                console.error('Failed to load stakeholders:', error);
                this.error = error.message || 'Failed to load stakeholders';
                this.loading = false;
                this.stakeholders = [];
            } finally {
                initializePromise = null;
            }
        },

        /**
         * Refresh stakeholders list from backend
         */
        async refresh() {
            this.loading = true;
            this.error = null;

            try {
                const data = await stakeholdersService.getAll();
                this.stakeholders = data.map(s => ({
                    ...s,
                    slug: s.slug || this.generateSlug(s.nama_perusahaan),
                    photo: this.formatImageUrl(s.photo),
                }));
                writeStakeholdersCache(this.stakeholders);
                this.loading = false;
            } catch (error: any) {
                console.error('Failed to refresh stakeholders:', error);
                this.error = error.message || 'Failed to refresh stakeholders';
                this.loading = false;
            }
        },

        /**
         * Create a new stakeholder
         */
        async createStakeholder(payload: CreateStakeholderPayload) {
            this.loading = true;
            this.error = null;

            try {
                const response = await stakeholdersService.create(payload);
                // After creating, we might need to refresh to get the full object with slug etc.
                // Or we can manually fetch the new one if the API supports it.
                // For now, let's just refresh.
                await this.refresh();
                this.loading = false;
                return { success: true, data: response };
            } catch (error: any) {
                console.error('Failed to create stakeholder:', error);
                this.error = error.message || 'Failed to create stakeholder';
                this.loading = false;
                return { success: false, error: this.error };
            }
        },

        /**
         * Update a stakeholder by id
         */
        async updateStakeholderById(id: string, updates: Partial<CreateStakeholderPayload>) {
            this.loading = true;
            this.error = null;

            try {
                const updated = await stakeholdersService.update(id, updates);

                // Refresh the store so any updated relationships or slugs are fully synced
                await this.refresh();

                const newStakeholder = this.stakeholders.find(s => String(s.id) === String(id));

                this.loading = false;
                return { success: true, data: newStakeholder || updated };
            } catch (error: any) {
                console.error('Failed to update stakeholder:', error);
                this.error = error.message || 'Failed to update stakeholder';
                this.loading = false;
                return { success: false, error: this.error };
            }
        },

        /**
         * Delete a stakeholder by id
         */
        async deleteStakeholderById(id: string) {
            this.loading = true;
            this.error = null;

            try {
                await stakeholdersService.delete(id);

                const index = this.stakeholders.findIndex(s => s.id === id);
                if (index !== -1) {
                    this.stakeholders.splice(index, 1);
                }

                this.loading = false;
                return { success: true };
            } catch (error: any) {
                console.error('Failed to delete stakeholder:', error);
                this.error = error.message || 'Failed to delete stakeholder';
                this.loading = false;
                return { success: false, error: this.error };
            }
        },

        generateSlug(name: string): string {
            return name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
        }
    },
});
