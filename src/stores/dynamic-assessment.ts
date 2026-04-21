import { defineStore } from 'pinia';
import { ikasService } from '@/services/ikas.service';
import type { 
  DynamicDomain, DynamicCategory, DynamicQuestion 
} from '@/types/dynamic-assessment.types';
import type { 
  AnswerMap, Answer, AssessmentProgress, RespondentProfile 
} from '@/types/assessment.types';
import { useIkasStore } from '@/stores/ikas';
import { useStakeholdersStore } from '@/stores/stakeholders';

const STORAGE_KEYS = {
    RESPONDENT_PROFILES: 'dynamic_respondent_profiles_map',
    ASSESSMENT_ANSWERS: 'dynamic_assessment_answers_map',
    ASSESSMENT_PROGRESS: 'dynamic_assessment_progress_map'
};

const genericIndexDescriptions: Record<number, string> = {
  0: 'Belum ada implementasi',
  1: 'Ad-hoc / Informal',
  2: 'Terdokumentasi sebagian',
  3: 'Terdefinisi dan terdokumentasi',
  4: 'Terkelola dan terukur',
  5: 'Optimalisasi berkelanjutan'
};

// Default progress state
const createDefaultProgress = (domainId: string, categoryId: string, subCategoryId: string): AssessmentProgress => ({
    currentDomainId: domainId,
    currentCategoryId: categoryId,
    currentSubCategoryId: subCategoryId,
    currentPage: 1,
    status: 'IN_PROGRESS',
    lastUpdated: Date.now()
});

export const useDynamicAssessmentStore = defineStore('dynamicAssessment', {
    state: () => ({
        domains: [] as DynamicDomain[],
        rawJsonString: '' as string,
        currentStakeholderSlug: '' as string,
        respondentProfilesMap: {} as Record<string, RespondentProfile>,
        answersMap: {} as Record<string, AnswerMap>,
        syncedBackendAnswersMap: {} as Record<string, Record<string, number>>,
        progressMap: {} as Record<string, AssessmentProgress>,
        loading: false,
        error: null as string | null,
        initialized: false,
        dataLoaded: false
    }),

    getters: {
        respondentProfile(): RespondentProfile | null {
            if (!this.currentStakeholderSlug) return null;
            return this.respondentProfilesMap[this.currentStakeholderSlug] || null;
        },

        answers(): AnswerMap {
            if (!this.currentStakeholderSlug) return {};
            return this.answersMap[this.currentStakeholderSlug] || {};
        },

        progress(): AssessmentProgress {
            if (!this.currentStakeholderSlug) {
                return createDefaultProgress('', '', '');
            }
            return this.progressMap[this.currentStakeholderSlug] || createDefaultProgress('', '', '');
        },

        hasRespondentProfile(): boolean {
            return this.respondentProfile !== null;
        },

        totalQuestions(): number {
            let count = 0;
            this.domains.forEach(d => {
                d.categories.forEach(c => {
                    count += c.questions.length;
                });
            });
            return count;
        },

        answeredQuestions(): number {
            return Object.keys(this.answers).length;
        },

        completionPercentage(): number {
            const total = this.totalQuestions;
            const answered = this.answeredQuestions;
            return total > 0 ? Math.round((answered / total) * 100) : 0;
        },

        currentDomain(): DynamicDomain | undefined {
            return this.domains.find(d => d.id === this.progress.currentDomainId);
        },

        currentCategory(): DynamicCategory | undefined {
            const domain = this.currentDomain;
            return domain?.categories.find(c => c.id === this.progress.currentCategoryId);
        },

        currentQuestion(): DynamicQuestion | undefined {
            // Note: in dynamic, sub-category = question
            const category = this.currentCategory;
            return category?.questions.find(q => q.id === this.progress.currentSubCategoryId);
        },

        currentPageQuestions(): DynamicQuestion[] {
            // Because each sub-kategori is 1 question, we paginate one "category" 
            // but let's show all questions for a category on one page, or paginate questions.
            // Let's paginate questions: 5 per page.
            if (!this.currentCategory) return [];
            
            const questionsPerPage = 5;
            const startIndex = (this.progress.currentPage - 1) * questionsPerPage;
            const endIndex = startIndex + questionsPerPage;
            
            return this.currentCategory.questions.slice(startIndex, endIndex);
        },
        
        totalPagesInCategory(): number {
             if (!this.currentCategory) return 0;
             const questionsPerPage = 5;
             return Math.ceil(this.currentCategory.questions.length / questionsPerPage);
        },

        getAnswer() {
            return (questionId: string): Answer | undefined => {
                return this.answers[questionId];
            };
        },

        breadcrumbPath(): string[] {
            const domain = this.currentDomain;
            const category = this.currentCategory;
            const path: string[] = [];
            if (domain) path.push(domain.name);
            if (category) path.push(category.name);
            return path;
        },

        isCompleted(): boolean {
            return this.progress.status === 'COMPLETED';
        },

        isLocked(): boolean {
            return this.isCompleted;
        }
    },

    actions: {
        setCurrentStakeholder(slug: string) {
            this.currentStakeholderSlug = slug;
            if (!this.answersMap[slug]) this.answersMap[slug] = {};

            if (!this.progressMap[slug]) {
                const firstDomain = this.domains[0];
                const firstCategory = firstDomain?.categories?.[0];
                this.progressMap[slug] = createDefaultProgress(
                    firstDomain?.id || '',
                    firstCategory?.id || '',
                    ''
                );
            }
        },

        initializeLocalData() {
            if (this.initialized) return;
            // Hapus cache legacy supaya data IKAS/responden tidak bocor antar perusahaan.
            localStorage.removeItem(STORAGE_KEYS.RESPONDENT_PROFILES);
            localStorage.removeItem(STORAGE_KEYS.ASSESSMENT_ANSWERS);
            localStorage.removeItem(STORAGE_KEYS.ASSESSMENT_PROGRESS);

            this.initialized = true;
        },

        async fetchAssessmentStructure() {
            if (this.dataLoaded || this.loading) return;

            this.loading = true;
            this.error = null;
            try {
                // 1. Fetch Domains
                const domainsResp = await ikasService.getDomains();
                const domainsList = Array.isArray(domainsResp) ? domainsResp : ((domainsResp as any).data || []);

                const domainColors = ['#00a2e8', '#8e44ad', '#f1c40f', '#27ae60'];
                const domainMap = new Map<string, any>();

                // Seed all available domains from backend
                domainsList.forEach((d: any) => {
                    const dId = String(d.id || d.ID);
                    domainMap.set(dId, {
                        id: dId,
                        name: d.nama_domain || d.NamaDomain,
                        color: '',
                        categories: new Map<string, any>()
                    });
                });

                // 1.5 Fetch Kategoris to seed empty categories in UI sidebar
                try {
                    const kategorisResp = await ikasService.getKategoris();
                    const kategorisList = Array.isArray(kategorisResp) ? kategorisResp : ((kategorisResp as any).data || []);
                    kategorisList.forEach((k: any) => {
                        const dId = String(k.domain_id || k.DomainID || k.domain?.id || k.Domain?.ID); // Handle various formats
                        if (dId && domainMap.has(dId)) {
                            const catMap = domainMap.get(dId).categories;
                            const kId = String(k.id || k.ID);
                            if (!catMap.has(kId)) {
                                catMap.set(kId, {
                                    id: kId,
                                    name: k.nama_kategori || k.NamaKategori || 'Unknown Kategori',
                                    domainId: dId,
                                    questions: []
                                });
                            }
                        }
                    });
                } catch (err) {
                    console.warn('[DynamicAssessment] Failed to fetch kategoris for seeding', err);
                }

                // 2. Fetch Pertanyaan for all 4 endpoints concurrently but safely
                const apiPromises = [
                    ikasService.getPertanyaanIdentifikasi().catch(e => null),
                    ikasService.getPertanyaanProteksi().catch(e => null),
                    ikasService.getPertanyaanDeteksi().catch(e => null),
                    ikasService.getPertanyaanGulih().catch(e => null)
                ];
                
                const results = await Promise.all(apiPromises);
                
                const domainTypesByIndex = ['identifikasi', 'proteksi', 'deteksi', 'gulih'];
                let allQuestions: any[] = [];
                results.forEach((raw, idx) => {
                    if (raw) {
                        const list = Array.isArray(raw) ? raw : (raw?.data || []);
                        // Tag each question with which API endpoint it came from
                        const tagged = list.map((q: any) => ({ ...q, _sourceType: domainTypesByIndex[idx] }));
                        allQuestions = allQuestions.concat(tagged);
                    }
                });

                // Keep raw sample for UI debugging if empty
                this.rawJsonString = JSON.stringify(allQuestions.slice(0, 2), null, 2) || '';

                if (allQuestions.length === 0) {
                     console.log("[DynamicAssessment] No questions found across all endpoints, but domains are loaded.");
                }

                allQuestions.forEach((q: any, index: number) => {
                    try {
                        // Support both lowercase and PascalCase from Golang
                        const sk = q?.sub_kategori || q?.SubKategori || q?.subKategori;
                        const k = sk?.kategori || sk?.Kategori;
                        const d = k?.domain || k?.Domain;
                        const rl = q?.ruang_lingkup || q?.RuangLingkup || q?.ruangLingkup;

                        if (!d || !k || !sk) {
                            console.warn(`[DynamicAssessment] Skipping malformed question at index ${index}:`, q);
                            return;
                        }

                        // Use String for keys to ensure .has() works consistently
                        const dId = String(d.id || d.ID);
                        const kId = String(k.id || k.ID);
                        const domainNameLower = String(d.nama_domain || d.NamaDomain || '').toLowerCase();
                        const skName = sk.nama_sub_kategori || sk.NamaSubKategori;
                        const qIdent = q.pertanyaan_identifikasi || q.pertanyaan_proteksi || q.pertanyaan_deteksi || q.pertanyaan_gulih || q.Pertanyaan || '';
                        const pName = rl ? (rl.nama_ruang_lingkup || rl.NamaRuangLingkup) : 'Tata Kelola';

                        if (!domainMap.has(dId)) {
                            domainMap.set(dId, {
                                id: dId,
                                name: d.nama_domain || d.NamaDomain || 'Unknown Domain',
                                color: '',
                                categories: new Map<string, any>()
                            });
                        }
                        
                        const catMap = domainMap.get(dId).categories;
                        if (!catMap.has(kId)) {
                            catMap.set(kId, {
                                id: kId,
                                name: k.nama_kategori || k.NamaKategori || 'Unknown Kategori',
                                domainId: dId,
                                questions: [] // will hold questions (pertanyaan)
                            });
                        }
                        
                        const qList = catMap.get(kId).questions;
                        
                        const idxDesc: Record<number, string> = {
                            0: q.index0 || q.Index0 || 'Belum ada implementasi',
                            1: q.index1 || q.Index1 || 'Ad-hoc / Informal',
                            2: q.index2 || q.Index2 || 'Terdokumentasi sebagian',
                            3: q.index3 || q.Index3 || 'Terdefinisi dan terdokumentasi',
                            4: q.index4 || q.Index4 || 'Terkelola dan terukur',
                            5: q.index5 || q.Index5 || 'Optimalisasi berkelanjutan'
                        };

                        // Use _sourceType from fetch tagging for reliable domain key
                        const sourceType: string = q._sourceType || (
                            domainNameLower.includes('identifikasi') ? 'identifikasi'
                            : domainNameLower.includes('proteksi') ? 'proteksi'
                            : domainNameLower.includes('deteksi') ? 'deteksi'
                            : 'gulih'
                        );
                        const numericId = String(q.id || q.ID);
                        // Use composite ID to avoid collisions across domains
                        // (e.g. pertanyaan-identifikasi id=1 vs pertanyaan-proteksi id=1)
                        const compositeId = `${sourceType}_${numericId}`;

                        qList.push({
                            id: compositeId,
                            originalId: numericId,
                            text: skName + (qIdent ? ` - ${qIdent}` : ''),
                            kategoriId: kId,
                            domainKey: sourceType as any,
                            scope: pName,
                            indexDescriptions: idxDesc
                        });
                    } catch (err) {
                        console.error(`[DynamicAssessment] Error parsing question ${index}:`, err);
                    }
                });

                let domainIndex = 0;
                this.domains = Array.from(domainMap.values())
                    .sort((a: any, b: any) => Number(a.id) - Number(b.id))
                    .map((d: any) => {
                        d.color = domainColors[domainIndex % domainColors.length];
                        domainIndex++;
                        d.categories = Array.from(d.categories.values())
                            .sort((c1: any, c2: any) => Number(c1.id) - Number(c2.id));
                            
                        return d;
                    });

                this.dataLoaded = true;

                // Sync current progress if there is no progress for this user
                if (this.currentStakeholderSlug && !this.progressMap[this.currentStakeholderSlug]) {
                    if (this.domains.length > 0 && this.domains[0].categories.length > 0) {
                        this.progressMap[this.currentStakeholderSlug] = createDefaultProgress(
                            this.domains[0].id, 
                            this.domains[0].categories[0].id, 
                            '' // Subcategory ID not used directly for pagination if we paginate by category
                        );
                    } else if (this.domains.length > 0) {
                        this.progressMap[this.currentStakeholderSlug] = createDefaultProgress(
                            this.domains[0].id, 
                            'no-category-yet', 
                            ''
                        );
                    }
                }

            } catch (error: any) {
                console.error('[DynamicAssessment] Fetch failed:', error);
                this.error = 'Gagal memuat data assessment dari server';
            } finally {
                this.loading = false;
            }
        },

        saveRespondentProfile(profile: RespondentProfile) {
            if (!this.currentStakeholderSlug) return;
            const now = Date.now();
            this.respondentProfilesMap[this.currentStakeholderSlug] = {
                ...profile, updatedAt: now, createdAt: profile.createdAt || now
            };
        },

        async saveAnswer(questionId: string, index: number) {
            if (!this.currentStakeholderSlug || this.isLocked) return;

            if (!this.answersMap[this.currentStakeholderSlug]) {
                this.answersMap[this.currentStakeholderSlug] = {};
            }

            this.answersMap[this.currentStakeholderSlug][questionId] = {
                questionId,
                index,
                updatedAt: Date.now(),
                backendSyncError: null
            };

            this.syncToIkas(this.currentStakeholderSlug);
            await this.syncAnswerToBackend(this.currentStakeholderSlug, questionId, index);
        },

        async syncAnswerToBackend(stakeholderSlug: string, questionId: string, index: number) {
            // Get perusahaan_id from stakeholders store
            const stakeholdersStore = useStakeholdersStore();
            const stakeholder = stakeholdersStore.getStakeholderBySlug(stakeholderSlug);
            
            // Backend also requires ikas_id (Assessment record ID)
            const ikasStore = useIkasStore();
            const backendIkasId = ikasStore.getBackendIkasId(stakeholderSlug);

            if (!stakeholder?.id) {
                console.warn('[DynamicAssessment] No stakeholder found for slug:', stakeholderSlug);
                return;
            }

            if (!backendIkasId) {
                console.error('[DynamicAssessment] Missing ikas_id for stakeholder:', stakeholderSlug);
                // Attempt to fetch if missing (happens on refresh)
                await ikasStore.fetchFromBackend(stakeholderSlug, stakeholder.id);
            }
            
            // Re-fetch after possible hydrate
            const finalIkasId = backendIkasId || ikasStore.getBackendIkasId(stakeholderSlug);
            if (!finalIkasId) {
                console.error('[DynamicAssessment] ikas_id is still missing. Cannot sync answer.');
                return;
            }

            const question = this.domains
                .flatMap(domain => domain.categories)
                .flatMap(category => category.questions)
                .find(item => item.id === questionId);

            if (!question) return;

            if (!this.syncedBackendAnswersMap[stakeholderSlug]) {
                this.syncedBackendAnswersMap[stakeholderSlug] = {};
            }

            if (this.syncedBackendAnswersMap[stakeholderSlug][questionId] === index) {
                return;
            }

            // Backend expects domain-specific foreign key names for the question ID:
            // pertanyaan_identifikasi_id, pertanyaan_proteksi_id, etc.
            const domainKey = question.domainKey;
            const pertanyaanFieldMap: Record<string, string> = {
                identifikasi: 'pertanyaan_identifikasi_id',
                proteksi: 'pertanyaan_proteksi_id',
                deteksi: 'pertanyaan_deteksi_id',
                gulih: 'pertanyaan_gulih_id',
            };
            const pertanyaanField = pertanyaanFieldMap[domainKey] || 'id_pertanyaan';

            // Use the original numeric ID (not the composite ID) for the backend payload
            const numericId = question.originalId ? Number(question.originalId) : Number(questionId.split('_').pop());

            // Each jawaban endpoint expects its own domain-specific field name
            const jawabanFieldMap: Record<string, string> = {
                identifikasi: 'jawaban_identifikasi',
                proteksi: 'jawaban_proteksi',
                deteksi: 'jawaban_deteksi',
                gulih: 'jawaban_gulih',
            };
            const jawabanField = jawabanFieldMap[domainKey] || 'jawaban_identifikasi';

            // Build the payload — backend needs BOTH ikas_id and perusahaan_id
            const payload: Record<string, any> = {
                ikas_id: finalIkasId,
                perusahaan_id: stakeholder.id,
                [pertanyaanField]: numericId,
                [jawabanField]: index,
            };

            try {
                if (domainKey === 'identifikasi') {
                    await ikasService.createJawabanIdentifikasi(payload as any);
                } else if (domainKey === 'proteksi') {
                    await ikasService.createJawabanProteksi(payload as any);
                } else if (domainKey === 'deteksi') {
                    await ikasService.createJawabanDeteksi(payload as any);
                } else {
                    await ikasService.createJawabanGulih(payload as any);
                }

                this.syncedBackendAnswersMap[stakeholderSlug][questionId] = index;
                if (this.answersMap[stakeholderSlug]?.[questionId]) {
                    this.answersMap[stakeholderSlug][questionId].backendSyncedAt = Date.now();
                    this.answersMap[stakeholderSlug][questionId].backendSyncError = null;
                }
            } catch (error: any) {
                console.error('[DynamicAssessment] Failed to sync answer to backend:', error);
                if (this.answersMap[stakeholderSlug]?.[questionId]) {
                    this.answersMap[stakeholderSlug][questionId].backendSyncError =
                        error?.message || 'Gagal menyimpan jawaban';
                }
            }
        },

        async hydrateAnswersFromBackend(stakeholderSlug: string, perusahaanId: string) {
            try {
                const results = await Promise.all([
                    ikasService.getJawabanIdentifikasi(perusahaanId).catch(() => []),
                    ikasService.getJawabanProteksi(perusahaanId).catch(() => []),
                    ikasService.getJawabanDeteksi(perusahaanId).catch(() => []),
                    ikasService.getJawabanGulih(perusahaanId).catch(() => []),
                ]);

                // Process each result set separately to preserve domain type info

                if (!this.answersMap[stakeholderSlug]) {
                    this.answersMap[stakeholderSlug] = {};
                }
                if (!this.syncedBackendAnswersMap[stakeholderSlug]) {
                    this.syncedBackendAnswersMap[stakeholderSlug] = {};
                }

                // Tag each answer with its source domain type for composite ID matching
                const domainTypes = ['identifikasi', 'proteksi', 'deteksi', 'gulih'];
                results.forEach((rawResult: any, domainIdx: number) => {
                    const items = Array.isArray(rawResult) ? rawResult : (rawResult?.data || []);
                    const domainType = domainTypes[domainIdx];

                    items
                        .filter((item: any) => {
                            const itemPerusahaanId = String(item.perusahaan_id || item.id_perusahaan || item.perusahaan?.id || '');
                            const itemIkasId = String(item.ikas_id || item.id_ikas || item.ikas?.id || '');
                            return itemPerusahaanId === String(perusahaanId) || itemIkasId === String(perusahaanId);
                        })
                        .forEach((item: any) => {
                            const numericId = String(
                                item.pertanyaan_identifikasi_id || item.pertanyaan_proteksi_id ||
                                item.pertanyaan_deteksi_id || item.pertanyaan_gulih_id ||
                                item.id_pertanyaan || item.pertanyaan_id || item.pertanyaan?.id || ''
                            );
                            if (!numericId) return;

                            // Build composite ID that matches the question store
                            const compositeId = `${domainType}_${numericId}`;
                            const indexValue = Number(item.jawaban ?? item.jawaban_identifikasi ?? item.nilai ?? item.index ?? 0);

                            this.answersMap[stakeholderSlug][compositeId] = {
                                questionId: compositeId,
                                index: indexValue,
                                updatedAt: Date.now(),
                                backendSyncedAt: Date.now(),
                                backendSyncError: null,
                            };
                            this.syncedBackendAnswersMap[stakeholderSlug][compositeId] = indexValue;
                        });
                });

                this.syncToIkas(stakeholderSlug);
            } catch (error) {
                console.warn('[DynamicAssessment] Failed to hydrate answers from backend:', error);
            }
        },

        /**
         * Calculates averages for all categories within each domain
         * and writes them to the ikasStore subdomains mapping.
         */
        syncToIkas(stakeholderSlug: string) {
            if (!this.dataLoaded) return;
            
            const answers = this.answersMap[stakeholderSlug] || {};
            const ikasStore = useIkasStore();
            ikasStore.ensureStakeholderData(stakeholderSlug);
            const targetData = ikasStore.ikasDataMap[stakeholderSlug];

            // In BSSN mapping: Identifikasi=5, Proteksi=6, Deteksi=3, Tanggulih=4
            // Since backend gives us dynamic categories, we sort them (assuming they come in right order)
            // and assign avg to subdomains 1 to N
            
            for (const domain of this.domains) {
                const domainNameLower = domain.name.toLowerCase();
                let targetDomainKey = '';
                
                if (domainNameLower.includes('identifikasi')) targetDomainKey = 'identifikasi';
                else if (domainNameLower.includes('proteksi')) targetDomainKey = 'proteksi';
                else if (domainNameLower.includes('deteksi')) targetDomainKey = 'deteksi';
                else if (domainNameLower.includes('pemulihan') || domainNameLower.includes('tanggulih')) targetDomainKey = 'tanggulih';
                
                if (!targetDomainKey) continue;
                // Type assertion is safe here as we map to known keys
                const ikasDomainData = (targetData as any)[targetDomainKey];

                let totalDomainAvg = 0;
                let activeCategories = 0;

                domain.categories.forEach((category, idx) => {
                    const subdomainKey = `nilai_subdomain${idx + 1}`;
                    
                    let catSum = 0;
                    let catCount = 0;

                    category.questions.forEach(q => {
                        const ans = answers[q.id];
                        if (ans && typeof ans.index === 'number') {
                            catSum += ans.index;
                            catCount++;
                        }
                    });

                    const avg = catCount > 0 ? Number((catSum / catCount).toFixed(2)) : 0;
                    if (ikasDomainData[subdomainKey] !== undefined) {
                        ikasDomainData[subdomainKey] = avg;
                    }
                    
                    if (catCount > 0) {
                        totalDomainAvg += avg;
                        activeCategories++;
                    }
                });

                // Set total domain score
                const overallScoreKey = `nilai_${targetDomainKey}`;
                ikasDomainData[overallScoreKey] = activeCategories > 0 ? Number((totalDomainAvg / activeCategories).toFixed(2)) : 0;
            }
        },

        updateProgress(domainId: string, categoryId: string, page: number) {
            if (!this.currentStakeholderSlug) return;

            this.progressMap[this.currentStakeholderSlug] = {
                ...this.progressMap[this.currentStakeholderSlug],
                currentDomainId: domainId,
                currentCategoryId: categoryId,
                currentPage: page,
                lastUpdated: Date.now()
            };
        },

        completeAssessment() {
            if (!this.currentStakeholderSlug) return;
            this.progressMap[this.currentStakeholderSlug].status = 'COMPLETED';
            this.progressMap[this.currentStakeholderSlug].lastUpdated = Date.now();
        },
        
        unlockAssessment() {
            if (!this.currentStakeholderSlug) return;
            this.progressMap[this.currentStakeholderSlug].status = 'IN_PROGRESS';
            this.progressMap[this.currentStakeholderSlug].lastUpdated = Date.now();
        },

        resetStakeholderData(slug: string) {
            delete this.respondentProfilesMap[slug];
            delete this.answersMap[slug];
            delete this.syncedBackendAnswersMap[slug];
            delete this.progressMap[slug];

            if (this.currentStakeholderSlug === slug) {
                const firstDomain = this.domains[0];
                const firstCategory = firstDomain?.categories?.[0];
                this.answersMap[slug] = {};
                this.progressMap[slug] = createDefaultProgress(
                    firstDomain?.id || '',
                    firstCategory?.id || '',
                    ''
                );
            }
        },

        clearAllAssessmentState() {
            this.respondentProfilesMap = {};
            this.answersMap = {};
            this.syncedBackendAnswersMap = {};
            this.progressMap = {};
            localStorage.removeItem(STORAGE_KEYS.RESPONDENT_PROFILES);
            localStorage.removeItem(STORAGE_KEYS.ASSESSMENT_ANSWERS);
            localStorage.removeItem(STORAGE_KEYS.ASSESSMENT_PROGRESS);
        },

        goToNextPage() {
            const totalPages = this.totalPagesInCategory;

            if (this.progress.currentPage < totalPages) {
                this.updateProgress(
                    this.progress.currentDomainId,
                    this.progress.currentCategoryId,
                    this.progress.currentPage + 1
                );
            } else {
                this.goToNextCategory();
            }
        },

        goToPreviousPage() {
            if (this.progress.currentPage > 1) {
                this.updateProgress(
                    this.progress.currentDomainId,
                    this.progress.currentCategoryId,
                    this.progress.currentPage - 1
                );
            } else {
                this.goToPreviousCategory();
            }
        },

        goToNextCategory() {
            const domain = this.currentDomain;
            const category = this.currentCategory;
            if (!domain || !category) return;

            const categoryIndex = domain.categories.findIndex(c => c.id === category.id);

            if (categoryIndex < domain.categories.length - 1) {
                const nextCategory = domain.categories[categoryIndex + 1];
                this.updateProgress(domain.id, nextCategory.id, 1);
            } else {
                const domainIndex = this.domains.findIndex(d => d.id === domain.id);
                if (domainIndex < this.domains.length - 1) {
                    const nextDomain = this.domains[domainIndex + 1];
                    const firstCategory = nextDomain.categories[0];
                    if (firstCategory) {
                        this.updateProgress(nextDomain.id, firstCategory.id, 1);
                    }
                }
            }
        },

        goToPreviousCategory() {
            const domain = this.currentDomain;
            const category = this.currentCategory;
            if (!domain || !category) return;

            const categoryIndex = domain.categories.findIndex(c => c.id === category.id);

            if (categoryIndex > 0) {
                const prevCategory = domain.categories[categoryIndex - 1];
                const lastPage = Math.ceil(prevCategory.questions.length / 5) || 1;
                this.updateProgress(domain.id, prevCategory.id, lastPage);
            } else {
                const domainIndex = this.domains.findIndex(d => d.id === domain.id);
                if (domainIndex > 0) {
                    const prevDomain = this.domains[domainIndex - 1];
                    const lastCategory = prevDomain.categories[prevDomain.categories.length - 1];
                    if (lastCategory) {
                        const lastPage = Math.ceil(lastCategory.questions.length / 5) || 1;
                        this.updateProgress(prevDomain.id, lastCategory.id, lastPage);
                    }
                }
            }
        }
    }
});
