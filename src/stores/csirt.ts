// stores/csirt.ts
import { defineStore } from 'pinia';
import { csirtService } from '@/services/csirt.service';
import type { CsirtMember, CreateCsirtPayload, SdmCsirt, SeCsirt } from '@/types/csirt.types';

export const useCsirtStore = defineStore('csirt', {
    state: () => ({
        csirts: [] as CsirtMember[],
        sdmList: [] as SdmCsirt[],
        seList: [] as SeCsirt[],
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
        getCsirtById(): (id: number | string) => CsirtMember | undefined {
            return (id: number | string) => this.csirts.find(c => String(c.id) === String(id));
        },

        // Check if a stakeholder (by id_perusahaan) has a fully registered CSIRT (has both SDM and SE)
        hasCompleteCsirt(): (perusahaanId: string | number) => boolean {
            return (perusahaanId: string | number) => {
                // Match by flat id_perusahaan OR by nested perusahaan.id (some backends embed the relation)
                const csirt = this.csirts.find(c =>
                    String(c.id_perusahaan) === String(perusahaanId) ||
                    String((c as any).perusahaan?.id) === String(perusahaanId)
                );
                if (!csirt) return false;

                // Check global flat lists (populated by getAllSdm / getAllSe)
                const hasSdmFromList = this.sdmList.some(sdm =>
                    String(sdm.id_csirt) === String(csirt.id) ||
                    String((sdm as any).csirt?.id) === String(csirt.id)
                );
                // Fallback: some backends embed sdm_csirt[] directly inside the CSIRT object
                const hasSdmFromNested = Array.isArray((csirt as any).sdm_csirt) &&
                    (csirt as any).sdm_csirt.length > 0;

                const hasSdfromList2 = this.seList.some(se =>
                    String(se.id_csirt) === String(csirt.id) ||
                    String((se as any).csirt?.id) === String(csirt.id)
                );
                // Fallback: some backends embed se_csirt[] directly inside the CSIRT object
                const hasSefromNested = Array.isArray((csirt as any).se_csirt) &&
                    (csirt as any).se_csirt.length > 0;

                const hasSdm = hasSdmFromList || hasSdmFromNested;
                const hasSe  = hasSdfromList2 || hasSefromNested;

                return hasSdm && hasSe;
            };
        }
    },

    actions: {
        /** Normalise a backend-returned image/file path to a full URL. */
        formatImageUrl(path: string | undefined | null): string {
            if (!path) return '';
            if (path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('/images/')) return path;
            if (path.startsWith('http://') || path.startsWith('https://')) return path;
            const baseUrl = (import.meta.env.VITE_STORAGE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
            const cleanPath = path.replace(/^\//, '');
            return baseUrl ? `${baseUrl}/${cleanPath}` : `/${cleanPath}`;
        },

        /**
         * Initialize csirts from backend API
         */
        async initialize() {
            if (this.initialized) return;

            this.loading = true;
            this.error = null;

            try {
                const [data, sdm, se] = await Promise.all([
                    csirtService.getMembers(),
                    csirtService.getAllSdm().catch((e) => { console.warn('[csirtStore] getAllSdm failed, sdmList will be empty:', e); return []; }),
                    csirtService.getAllSe().catch((e) => { console.warn('[csirtStore] getAllSe failed, seList will be empty:', e); return []; })
                ]);
                console.log('CSIRTs from backend:', data);
                this.csirts = (Array.isArray(data) ? data : []).map(c => ({
                    ...c,
                    slug: c.slug || this.generateSlug(c.nama_csirt),
                    photo_csirt:         this.formatImageUrl(c.photo_csirt),
                    file_rfc2350:        this.formatImageUrl(c.file_rfc2350),
                    file_public_key_pgp: this.formatImageUrl(c.file_public_key_pgp),
                }));
                this.sdmList = Array.isArray(sdm) ? sdm : [];
                this.seList = Array.isArray(se) ? se : [];
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
                const [data, sdm, se] = await Promise.all([
                    csirtService.getMembers(),
                    csirtService.getAllSdm().catch((e) => { console.warn('[csirtStore] getAllSdm failed on refresh:', e); return []; }),
                    csirtService.getAllSe().catch((e) => { console.warn('[csirtStore] getAllSe failed on refresh:', e); return []; })
                ]);
                this.csirts = (Array.isArray(data) ? data : []).map(c => ({
                    ...c,
                    slug: c.slug || this.generateSlug(c.nama_csirt),
                    photo_csirt:         this.formatImageUrl(c.photo_csirt),
                    file_rfc2350:        this.formatImageUrl(c.file_rfc2350),
                    file_public_key_pgp: this.formatImageUrl(c.file_public_key_pgp),
                }));
                this.sdmList = Array.isArray(sdm) ? sdm : [];
                this.seList = Array.isArray(se) ? se : [];
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
        async updateCsirtById(id: number | string, updates: Partial<CreateCsirtPayload>) {
            this.loading = true;
            this.error = null;

            try {
                const updated = await csirtService.update(id, updates as any);
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
        async deleteCsirtById(id: number | string) {
            this.loading = true;
            this.error = null;

            try {
                // 1. Manually delete all child SDM and SE to bypass SQL 'ON DELETE RESTRICT' errors
                const sdms = this.sdmList.filter(s => String(s.id_csirt) === String(id) || String((s as any).csirt?.id) === String(id));
                const ses = this.seList.filter(s => String(s.id_csirt) === String(id) || String((s as any).csirt?.id) === String(id));

                await Promise.all([
                    ...sdms.map(sdm => csirtService.deleteSdm(sdm.id).catch(e => console.warn('Failed to cascade delete SDM:', e))),
                    ...ses.map(se => csirtService.deleteSe(se.id).catch(e => console.warn('Failed to cascade delete SE:', e)))
                ]);

                // 2. Delete the parent CSIRT
                await csirtService.delete(id);
                const index = this.csirts.findIndex(c => String(c.id) === String(id));
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
