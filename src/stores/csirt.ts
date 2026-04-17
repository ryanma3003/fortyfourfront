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
        async initialize(options?: { fetchGlobal?: boolean; targetCsirtId?: string | number; targetCompanyId?: string | number }) {
            if (this.initialized && (!options || options.fetchGlobal !== false)) return;

            this.loading = true;
            this.error = null;

            try {
                if (options && options.fetchGlobal === false) {
                    await this.fetchSpecific(options);
                    this.initialized = true;
                    this.loading = false;
                    return;
                }

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
                    file_surat_tanda_registrasi: this.formatImageUrl(c.file_surat_tanda_registrasi || (c as any).file_str),
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
        async refresh(options?: { fetchGlobal?: boolean; targetCsirtId?: string | number; targetCompanyId?: string | number }) {
            this.loading = true;
            this.error = null;

            try {
                if (options && options.fetchGlobal === false) {
                    await this.fetchSpecific(options);
                    this.loading = false;
                    return;
                }

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
                    file_surat_tanda_registrasi: this.formatImageUrl(c.file_surat_tanda_registrasi || (c as any).file_str),
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

        async fetchSpecific(options: { targetCsirtId?: string | number; targetCompanyId?: string | number }) {
            let targetId: string | number | undefined = undefined;

            try {
                if (options.targetCsirtId) {
                    const param = String(options.targetCsirtId);
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
                    if (/^\d+$/.test(param) || isUUID) {
                        const specific = await csirtService.getMemberById(param).catch(() => null);
                        if (specific) {
                            targetId = specific.id;
                            const formatted = {
                                ...specific,
                                slug: specific.slug || this.generateSlug(specific.nama_csirt),
                                photo_csirt: this.formatImageUrl(specific.photo_csirt),
                                file_rfc2350: this.formatImageUrl(specific.file_rfc2350),
                                file_public_key_pgp: this.formatImageUrl(specific.file_public_key_pgp),
                                file_surat_tanda_registrasi: this.formatImageUrl(specific.file_surat_tanda_registrasi || (specific as any).file_str),
                            };
                            const existingIdx = this.csirts.findIndex(e => String(e.id) === String(specific.id));
                            if (existingIdx >= 0) this.csirts[existingIdx] = formatted;
                            else this.csirts.push(formatted);
                        }
                    } else {
                        if (this.csirts.length === 0) {
                            const data = await csirtService.getMembers().catch(() => []);
                            this.csirts = (Array.isArray(data) ? data : []).map(c => ({
                                ...c,
                                slug: c.slug || this.generateSlug(c.nama_csirt),
                                photo_csirt: this.formatImageUrl(c.photo_csirt),
                                file_rfc2350: this.formatImageUrl(c.file_rfc2350),
                                file_public_key_pgp: this.formatImageUrl(c.file_public_key_pgp),
                                file_surat_tanda_registrasi: this.formatImageUrl(c.file_surat_tanda_registrasi),
                            }));
                        }
                        const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                        const found = this.csirts.find(c => {
                            if (String(c.id) === param || c.slug === param) return true;
                            const csirtPart = c.slug || toSlug(c.nama_csirt);
                            return csirtPart === param;
                        });
                        if (found) {
                            targetId = found.id;
                            const specific = await csirtService.getMemberById(targetId).catch(() => null);
                            if (specific) {
                                const existingIdx = this.csirts.findIndex(e => String(e.id) === String(specific.id));
                                const formatted = {
                                    ...specific,
                                    slug: specific.slug || this.generateSlug(specific.nama_csirt),
                                    photo_csirt: this.formatImageUrl(specific.photo_csirt),
                                    file_rfc2350: this.formatImageUrl(specific.file_rfc2350),
                                    file_public_key_pgp: this.formatImageUrl(specific.file_public_key_pgp),
                                    file_surat_tanda_registrasi: this.formatImageUrl(specific.file_surat_tanda_registrasi),
                                };
                                if (existingIdx >= 0) this.csirts[existingIdx] = formatted;
                                else this.csirts.push(formatted);
                            }
                        }
                    }
                } else if (options.targetCompanyId) {
                    const c = await csirtService.getCsirtByPerusahaan(options.targetCompanyId).catch(() => null);
                    if (c) {
                        targetId = c.id;
                        const existingIdx = this.csirts.findIndex(e => String(e.id) === String(c.id));
                                const formatted = {
                                    ...c,
                                    slug: c.slug || this.generateSlug(c.nama_csirt),
                                    photo_csirt: this.formatImageUrl(c.photo_csirt),
                                    file_rfc2350: this.formatImageUrl(c.file_rfc2350),
                                    file_public_key_pgp: this.formatImageUrl(c.file_public_key_pgp),
                                    file_surat_tanda_registrasi: this.formatImageUrl(c.file_surat_tanda_registrasi || (c as any).file_str),
                                };
                        if (existingIdx >= 0) this.csirts[existingIdx] = formatted;
                        else this.csirts.push(formatted);
                    }
                }

                if (targetId) {
                    const [sdm, se] = await Promise.all([
                        csirtService.getSdmByCsirtId(targetId).catch(() => []),
                        csirtService.getSeByCsirtId(targetId).catch(() => [])
                    ]);

                    if (Array.isArray(sdm)) {
                        this.sdmList = this.sdmList.filter(s => String(s.id_csirt) !== String(targetId) && String((s as any).csirt?.id) !== String(targetId));
                        this.sdmList.push(...sdm);
                    }
                    if (Array.isArray(se)) {
                        this.seList = this.seList.filter(s => String(s.id_csirt) !== String(targetId) && String((s as any).csirt?.id) !== String(targetId));
                        this.seList.push(...se);
                    }
                }
            } catch (err) {
                console.error("fetchSpecific error:", err);
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
