// stores/csirt.ts
import { defineStore } from 'pinia';
import { csirtService } from '@/services/csirt.service';
import type { CsirtMember, CreateCsirtPayload } from '@/types/csirt.types';

export const useCsirtStore = defineStore('csirt', {
    state: () => ({
        csirts: [] as CsirtMember[],
        initialized: false,
        loading: false,
        error: null as string | null,
    }),

    getters: {
        // Get all csirts
        allCsirts(): CsirtMember[] {
            return this.csirts;
        },

        // Get csirt by ID
        getCsirtById(): (id: number) => CsirtMember | undefined {
            return (id: number) => this.csirts.find(c => c.id === id);
        },
    },

    actions: {
        /**
         * Initialize csirts from backend API
         */
        async initialize() {
            if (this.initialized) return;

            this.loading = true;
            this.error = null;

            try {
                const data = await csirtService.getMembers();
                console.log('CSIRTs from backend:', data);
                this.csirts = data.map(c => ({
                    ...c,
                    slug: c.slug || this.generateSlug(c.nama_csirt)
                }));
                this.initialized = true;
                this.loading = false;
            } catch (error: any) {
                console.error('Failed to load CSIRTs:', error);
                this.error = error.message || 'Failed to load CSIRTs';
                this.loading = false;
                this.csirts = [];
            }
        },

        /**
         * Refresh csirts list from backend
         */
        async refresh() {
            this.loading = true;
            this.error = null;

            try {
                const data = await csirtService.getMembers();
                this.csirts = data.map(c => ({
                    ...c,
                    slug: c.slug || this.generateSlug(c.nama_csirt)
                }));
                this.loading = false;
            } catch (error: any) {
                console.error('Failed to refresh CSIRTs:', error);
                this.error = error.message || 'Failed to refresh CSIRTs';
                this.loading = false;
            }
        },

        /**
         * Create a new CSIRT member
         */
        async createCsirt(payload: CreateCsirtPayload) {
            this.loading = true;
            this.error = null;

            try {
                const response = await csirtService.create(payload);
                await this.refresh();
                this.loading = false;
                return { success: true, data: response };
            } catch (error: any) {
                console.error('Failed to create CSIRT:', error);
                this.error = error.message || 'Failed to create CSIRT';
                this.loading = false;
                return { success: false, error: this.error };
            }
        },

        /**
         * Update a CSIRT member by id
         */
        async updateCsirtById(id: number, updates: Partial<CreateCsirtPayload>) {
            this.loading = true;
            this.error = null;

            try {
                const updated = await csirtService.update(id, updates);
                await this.refresh();
                this.loading = false;
                return { success: true, data: updated };
            } catch (error: any) {
                console.error('Failed to update CSIRT:', error);
                this.error = error.message || 'Failed to update CSIRT';
                this.loading = false;
                return { success: false, error: this.error };
            }
        },

        /**
         * Delete a CSIRT member by id
         */
        async deleteCsirtById(id: number) {
            this.loading = true;
            this.error = null;

            try {
                await csirtService.delete(id);
                const index = this.csirts.findIndex(c => c.id === id);
                if (index !== -1) {
                    this.csirts.splice(index, 1);
                }
                this.loading = false;
                return { success: true };
            } catch (error: any) {
                console.error('Failed to delete CSIRT:', error);
                this.error = error.message || 'Failed to delete CSIRT';
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
