import { defineStore } from 'pinia';
import { ikasService } from '@/services/ikas.service';
import type { 
  DynamicDomain, DynamicCategory, DynamicQuestion, DynamicSubCategory
} from '@/types/dynamic-assessment.types';
import type { 
  AnswerMap, Answer, AssessmentProgress, RespondentProfile 
} from '@/types/assessment.types';
import { useIkasStore } from '@/stores/ikas';
import { useStakeholdersStore } from '@/stores/stakeholders';

const genericIndexDescriptions: Record<number, string> = {
  0: 'Belum ada implementasi',
  1: 'Ad-hoc / Informal',
  2: 'Terdokumentasi sebagian',
  3: 'Terdefinisi dan terdokumentasi',
  4: 'Terkelola dan terukur',
  5: 'Optimalisasi berkelanjutan'
};

const QUESTIONS_PER_PAGE = 5;

const parseNumberValue = (value: string | number | null | undefined): number => {
    if (typeof value === 'number') return value;
    const parsed = Number(String(value || '').replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : 0;
};

const getPersistedAnswerId = (response: any): string => String(
    response?.id ||
    response?.ID ||
    response?.data?.id ||
    response?.data?.ID ||
    response?.data?.jawaban_id ||
    response?.data?.id_jawaban ||
    response?.data?.data?.id ||
    response?.data?.data?.ID ||
    response?.jawaban_id ||
    response?.id_jawaban ||
    ''
);

const parseMaybeJsonObject = (value: any): Record<string, any> | null => {
    if (!value) return null;
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string') return null;

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

const unwrapAnswerItem = (item: any): any => {
    const payload = parseMaybeJsonObject(item?.payload)
        || parseMaybeJsonObject(item?.body)
        || parseMaybeJsonObject(item?.message)
        || parseMaybeJsonObject(item?.data?.payload)
        || parseMaybeJsonObject(item?.data?.body)
        || parseMaybeJsonObject(item?.data?.message);

    return payload ? { ...item, ...payload } : item;
};

const normalizeMeasurementDate = (tanggal: string | null | undefined, tahun: string | number | null | undefined): string => {
    const normalizedYear = String(tahun || '').match(/\d{4}/)?.[0] || String(new Date().getFullYear());
    const normalizedDate = String(tanggal || '').trim();
    if (normalizedDate && normalizedDate.startsWith(`${normalizedYear}-`)) return normalizedDate;
    if (!normalizedDate && normalizedYear === String(new Date().getFullYear())) {
        return new Date().toISOString().split('T')[0];
    }
    return `${normalizedYear}-01-01`;
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

const getCategoryQuestions = (category?: DynamicCategory): DynamicQuestion[] => {
    if (!category) return [];
    const directQuestions = category.questions || [];
    const subCategoryQuestions = category.subCategories?.flatMap((subCategory) => subCategory.questions || []) || [];
    return [...directQuestions, ...subCategoryQuestions];
};

const getSubCategoryQuestions = (subCategory?: DynamicSubCategory): DynamicQuestion[] => {
    return subCategory?.questions || [];
};

const getFirstSubCategory = (category?: DynamicCategory): DynamicSubCategory | undefined => {
    if (!category) return undefined;
    return category.subCategories?.[0];
};

const getLastSubCategory = (category?: DynamicCategory): DynamicSubCategory | undefined => {
    if (!category || !category.subCategories?.length) return undefined;
    return category.subCategories[category.subCategories.length - 1];
};

const getLastPageForQuestions = (questions: DynamicQuestion[]): number => {
    return Math.ceil((questions || []).length / QUESTIONS_PER_PAGE) || 1;
};

export const useDynamicAssessmentStore = defineStore('dynamicAssessment', {
    state: () => ({
        domains: [] as DynamicDomain[],
        rawJsonString: '' as string,
        currentStakeholderSlug: '' as string,
        respondentProfilesMap: {} as Record<string, RespondentProfile>,
        answersMap: {} as Record<string, AnswerMap>,
        syncedBackendAnswersMap: {} as Record<string, Record<string, number>>,
        backendAnswerIdsMap: {} as Record<string, Record<string, string>>,
        progressMap: {} as Record<string, AssessmentProgress>,
        loading: false,
        error: null as string | null,
        initialized: false,
        dataLoaded: false,
        syncingAnswersCount: 0,
        autoSyncTimer: null as any,
        lastSyncTime: null as number | null,
        lastDomainFetchTime: {} as Record<string, number>,
        lastSyncAttempt: 0
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
            return this.domains.reduce((count, domain) => {
                return count + domain.categories.reduce((domainCount, category) => {
                    const categoryQuestions = getCategoryQuestions(category);
                    return domainCount + categoryQuestions.length;
                }, 0);
            }, 0);
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
            return this.currentSubCategory?.questions[0];
        },

        currentSubCategory(): DynamicSubCategory | undefined {
            const category = this.currentCategory;
            if (!category) return undefined;
            return category.subCategories.find(sc => sc.id === this.progress.currentSubCategoryId) || category.subCategories[0];
        },

        currentPageQuestions(): DynamicQuestion[] {
            const questions = this.currentSubCategory && getSubCategoryQuestions(this.currentSubCategory).length > 0
                ? getSubCategoryQuestions(this.currentSubCategory)
                : getCategoryQuestions(this.currentCategory);
            const startIndex = (this.progress.currentPage - 1) * QUESTIONS_PER_PAGE;
            const endIndex = startIndex + QUESTIONS_PER_PAGE;
            
            return questions.slice(startIndex, endIndex);
        },
        
        totalPagesInSubCategory(): number {
             const questions = this.currentSubCategory && getSubCategoryQuestions(this.currentSubCategory).length > 0
                ? getSubCategoryQuestions(this.currentSubCategory)
                : getCategoryQuestions(this.currentCategory);
             return getLastPageForQuestions(questions);
        },

        totalPagesInCategory(): number {
             return this.totalPagesInSubCategory;
        },

        getAnswer() {
            return (questionId: string): Answer | undefined => {
                return this.answers[questionId];
            };
        },

        breadcrumbPath(): string[] {
            const domain = this.currentDomain;
            const category = this.currentCategory;
            const subCategory = this.currentSubCategory;
            const path: string[] = [];
            if (domain) path.push(domain.name);
            if (category) path.push(category.name);
            if (subCategory) path.push(subCategory.name);
            return path;
        },

        isCompleted(): boolean {
            return this.progress.status === 'COMPLETED';
        },

        isLocked(): boolean {
            return this.isCompleted;
        },

        hasPendingAnswerSync(): boolean {
            return this.syncingAnswersCount > 0;
        },

        hasUnsyncedAnswers(): boolean {
            if (!this.currentStakeholderSlug) return false;
            const answers = this.answersMap[this.currentStakeholderSlug] || {};
            return Object.values(answers).some((answer) => !answer.backendSyncedAt || !!answer.backendSyncError);
        },

        unsyncedAnswerCount(): number {
            if (!this.currentStakeholderSlug) return 0;
            const answers = this.answersMap[this.currentStakeholderSlug] || {};
            return Object.values(answers).filter((answer) => !answer.backendSyncedAt || !!answer.backendSyncError).length;
        }
    },

    actions: {
        async initialize() {
            this.initializeLocalData();
            await this.fetchAssessmentStructure();
        },

        setCurrentStakeholder(slug: string) {
            this.currentStakeholderSlug = slug;
            if (!this.answersMap[slug]) this.answersMap[slug] = {};
            if (!this.syncedBackendAnswersMap[slug]) this.syncedBackendAnswersMap[slug] = {};
            if (!this.backendAnswerIdsMap[slug]) this.backendAnswerIdsMap[slug] = {};

            if (!this.progressMap[slug]) {
                const firstDomain = this.domains[0];
                const firstCategory = firstDomain?.categories?.[0];
                const firstSubCategory = getFirstSubCategory(firstCategory);
                this.progressMap[slug] = createDefaultProgress(
                    firstDomain?.id || '',
                    firstCategory?.id || '',
                    firstSubCategory?.id || ''
                );
            }
        },

        initializeLocalData() {
            if (this.initialized) return;
            this.initialized = true;
        },

        normalizeApiCollection(response: any): any[] {
            if (Array.isArray(response)) return response;

            const collected: any[] = [];
            const seenArrays = new Set<any[]>();
            const collectionKeys = [
                'unified',
                'answers',
                'jawaban',
                'items',
                'records',
                'results',
                'result',
                'main',
                'buffer',
                'main_data',
                'buffer_data',
                'mainData',
                'bufferData',
            ];

            const collect = (value: any, depth = 0) => {
                if (!value || depth > 4) return;
                if (Array.isArray(value)) {
                    if (seenArrays.has(value)) return;
                    seenArrays.add(value);
                    collected.push(...value.map(unwrapAnswerItem));
                    return;
                }
                if (typeof value !== 'object') return;

                for (const key of collectionKeys) {
                    if (Array.isArray(value[key])) {
                        collect(value[key], depth + 1);
                    }
                }

                if (value.data && typeof value.data === 'object') {
                    collect(value.data, depth + 1);
                }
            };

            collect(response);
            if (collected.length) return collected;

            if (response?.data && typeof response.data === 'object') return [unwrapAnswerItem(response.data)];
            if (response && typeof response === 'object') return [unwrapAnswerItem(response)];
            return [];
        },

        buildIkasPayloadFromProfile(stakeholderSlug: string) {
            const stakeholdersStore = useStakeholdersStore();
            const stakeholder = stakeholdersStore.getStakeholderBySlug(stakeholderSlug);
            const profile = this.respondentProfilesMap[stakeholderSlug];

            if (!stakeholder?.id) return null;

            const tahunPengukuran = String(
                profile?.tahunPengukuran ||
                new Date().getFullYear()
            ).match(/\d{4}/)?.[0] || String(new Date().getFullYear());

            return {
                id_perusahaan: stakeholder.id,
                responden: profile?.namaResponden || '',
                jabatan: profile?.jabatanResponden || '',
                telepon: profile?.nomorTelepon || '',
                tanggal: normalizeMeasurementDate(profile?.tanggalPengisian, tahunPengukuran),
                tahun_pengukuran: tahunPengukuran,
                target_nilai: parseNumberValue(profile?.targetNilai || profile?.targetLevel || 0),
            };
        },

        async ensureBackendIkasIdForAnswers(stakeholderSlug: string): Promise<string | null> {
            const ikasStore = useIkasStore();
            const existingIkasId = ikasStore.getBackendIkasId(stakeholderSlug);
            if (existingIkasId) return existingIkasId;

            const payload = this.buildIkasPayloadFromProfile(stakeholderSlug);
            if (!payload) return null;

            const result = await ikasStore.ensureBackendIkasRecord(stakeholderSlug, payload);
            return result.success && result.id ? result.id : null;
        },

        findExistingBackendAnswer(items: any[], question: DynamicQuestion, ikasId: string) {
            const questionId = String(question.originalId || question.id.split('_').pop() || '');
            return items.find((item: any) => {
                const normalizedItem = unwrapAnswerItem(item);
                const itemIkasId = String(normalizedItem?.ikas_id || normalizedItem?.id_ikas || normalizedItem?.ikasId || normalizedItem?.IkasID || '');
                const itemQuestionId = String(
                    normalizedItem?.pertanyaan_identifikasi_id ||
                    normalizedItem?.PertanyaanIdentifikasiID ||
                    normalizedItem?.pertanyaan_proteksi_id ||
                    normalizedItem?.PertanyaanProteksiID ||
                    normalizedItem?.pertanyaan_deteksi_id ||
                    normalizedItem?.PertanyaanDeteksiID ||
                    normalizedItem?.pertanyaan_gulih_id ||
                    normalizedItem?.PertanyaanGulihID ||
                    normalizedItem?.pertanyaan_identifikasi?.id ||
                    normalizedItem?.pertanyaan_proteksi?.id ||
                    normalizedItem?.pertanyaan_deteksi?.id ||
                    normalizedItem?.pertanyaan_gulih?.id ||
                    normalizedItem?.pertanyaan_id ||
                    normalizedItem?.PertanyaanID ||
                    normalizedItem?.id_pertanyaan ||
                    normalizedItem?.pertanyaan?.id ||
                    ''
                );

                return itemIkasId === String(ikasId) && itemQuestionId === questionId;
            }) || null;
        },

        async resolveExistingBackendAnswerId(stakeholderSlug: string, question: DynamicQuestion, ikasId: string): Promise<string> {
            const cachedId = String(this.backendAnswerIdsMap[stakeholderSlug]?.[question.id] || '');
            if (cachedId) return cachedId;

            try {
                const raw = await ikasService.getJawabanByKategori(question.domainKey, ikasId);
                const existing = this.findExistingBackendAnswer(this.normalizeApiCollection(raw), question, ikasId);
                const existingId = getPersistedAnswerId(existing);

                if (existingId) {
                    if (!this.backendAnswerIdsMap[stakeholderSlug]) {
                        this.backendAnswerIdsMap[stakeholderSlug] = {};
                    }
                    this.backendAnswerIdsMap[stakeholderSlug][question.id] = existingId;
                }

                return existingId;
            } catch (error) {
                console.warn('[DynamicAssessment] Failed to resolve existing answer id:', error);
                return '';
            }
        },

        async refreshBackendAnswerId(stakeholderSlug: string, question: DynamicQuestion, ikasId: string): Promise<string> {
            try {
                const raw = await ikasService.getJawabanByKategori(question.domainKey, ikasId);
                const existing = this.findExistingBackendAnswer(this.normalizeApiCollection(raw), question, ikasId);
                const existingId = getPersistedAnswerId(existing);

                if (existingId) {
                    if (!this.backendAnswerIdsMap[stakeholderSlug]) {
                        this.backendAnswerIdsMap[stakeholderSlug] = {};
                    }
                    this.backendAnswerIdsMap[stakeholderSlug][question.id] = existingId;
                }

                return existingId;
            } catch (error) {
                console.warn('[DynamicAssessment] Failed to refresh answer id after create:', error);
                return '';
            }
        },

        async preloadBackendAnswerIds(stakeholderSlug: string, ikasId: string, questions: DynamicQuestion[]) {
            const domainKeys = [...new Set(questions.map((question) => question.domainKey).filter(Boolean))];
            if (!domainKeys.length) return;

            const now = Date.now();
            const keysToFetch = domainKeys.filter(dk => {
                const lastFetch = this.lastDomainFetchTime[`${stakeholderSlug}_${dk}`] || 0;
                return (now - lastFetch) > 10000; // 10 second cache is plenty for single-page sessions
            });

            if (!keysToFetch.length) return;

            if (!this.backendAnswerIdsMap[stakeholderSlug]) {
                this.backendAnswerIdsMap[stakeholderSlug] = {};
            }
            if (!this.syncedBackendAnswersMap[stakeholderSlug]) {
                this.syncedBackendAnswersMap[stakeholderSlug] = {};
            }

            const results = await Promise.all(keysToFetch.map(async (domainKey) => ({
                domainKey,
                items: this.normalizeApiCollection(await ikasService.getJawabanByKategori(domainKey, ikasId).catch(() => [])),
            })));

            keysToFetch.forEach(dk => {
                this.lastDomainFetchTime[`${stakeholderSlug}_${dk}`] = now;
            });

            results.forEach(({ domainKey, items }) => {
                items.forEach((rawItem: any) => {
                    const item = unwrapAnswerItem(rawItem);
                    const itemIkasId = String(item.ikas_id || item.id_ikas || item.ikasId || item.IkasID || '');
                    if (itemIkasId && itemIkasId !== String(ikasId)) return;

                    const numericId = String(
                        item.pertanyaan_identifikasi_id || item.PertanyaanIdentifikasiID ||
                        item.pertanyaan_proteksi_id || item.PertanyaanProteksiID ||
                        item.pertanyaan_deteksi_id || item.PertanyaanDeteksiID ||
                        item.pertanyaan_gulih_id || item.PertanyaanGulihID ||
                        item.pertanyaan_identifikasi?.id || item.pertanyaan_proteksi?.id ||
                        item.pertanyaan_deteksi?.id || item.pertanyaan_gulih?.id ||
                        item.id_pertanyaan || item.pertanyaan_id || item.PertanyaanID || item.pertanyaan?.id || ''
                    );
                    if (!numericId) return;

                    const compositeId = `${domainKey}_${numericId}`;
                    const backendAnswerId = getPersistedAnswerId(item);
                    if (backendAnswerId) {
                        this.backendAnswerIdsMap[stakeholderSlug][compositeId] = backendAnswerId;
                    }

                    const indexValue = Number(
                        item.jawaban ??
                        item.jawaban_identifikasi ??
                        item.jawaban_proteksi ??
                        item.jawaban_deteksi ??
                        item.jawaban_gulih ??
                        item.JawabanIdentifikasi ??
                        item.JawabanProteksi ??
                        item.JawabanDeteksi ??
                        item.JawabanGulih ??
                        item.nilai ??
                        item.index ??
                        NaN
                    );

                    if (Number.isFinite(indexValue)) {
                        this.syncedBackendAnswersMap[stakeholderSlug][compositeId] = indexValue;
                    }
                });
            });
        },

        async fetchAssessmentStructure(options: { includeMasterStructure?: boolean } = {}) {
            if (this.dataLoaded || this.loading) return;

            this.loading = true;
            this.error = null;
            try {
                const includeMasterStructure = options.includeMasterStructure !== false;
                let domainsList: any[] = [];

                // 1. Fetch Domains
                if (includeMasterStructure) {
                    const domainsResp = await ikasService.getDomains();
                    domainsList = Array.isArray(domainsResp) ? domainsResp : ((domainsResp as any).data || []);
                }

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

                // 2. Fetch Pertanyaan and optionally Answers in parallel
                const structurePromises = [
                    ...(includeMasterStructure
                        ? [
                            ikasService.getKategoris().catch(() => []),
                            ikasService.getSubKategoris().catch(() => []),
                            ikasService.getRuangLingkups().catch(() => []),
                        ]
                        : []),
                    ikasService.getPertanyaanByKategori('identifikasi').catch(() => null),
                    ikasService.getPertanyaanByKategori('proteksi').catch(() => null),
                    ikasService.getPertanyaanByKategori('deteksi').catch(() => null),
                    ikasService.getPertanyaanByKategori('gulih').catch(() => null)
                ];

                // If stakeholder slug is present, also hydrate answers concurrently
                let answerHydrationPromise = null;
                if (this.currentStakeholderSlug) {
                    const ikasId = useIkasStore().getBackendIkasId(this.currentStakeholderSlug);
                    if (ikasId) {
                        answerHydrationPromise = this.hydrateAnswersFromBackend(this.currentStakeholderSlug, '');
                    }
                }

                const results = await Promise.all(structurePromises);
                const metadataOffset = includeMasterStructure ? 3 : 0;
                const kategorisResp = includeMasterStructure ? results[0] : [];
                const subKResp = includeMasterStructure ? results[1] : [];
                const rlResp = includeMasterStructure ? results[2] : [];
                const pertanyaanResults = results.slice(metadataOffset);

                // 2.1 Process Kategoris
                const kategorisList = Array.isArray(kategorisResp) ? kategorisResp : ((kategorisResp as any).data || []);
                kategorisList.forEach((k: any) => {
                    const dId = String(k.domain_id || k.DomainID || k.domain?.id || k.Domain?.ID);
                    if (dId && domainMap.has(dId)) {
                        const catMap = domainMap.get(dId).categories;
                        const kId = String(k.id || k.ID);
                        if (!catMap.has(kId)) {
                            catMap.set(kId, {
                                id: kId,
                                name: k.nama_kategori || k.NamaKategori || 'Unknown Kategori',
                                domainId: dId,
                                subCategories: new Map<string, any>(),
                                questions: []
                            });
                        }
                    }
                });

                // 2.2 Process Sub-Kategoris
                const subKList = Array.isArray(subKResp) ? subKResp : (subKResp?.data || []);
                subKList.forEach((sk: any) => {
                    const kategoriId = String(sk.kategori_id || sk.KategoriID || sk.kategori?.id || sk.Kategori?.ID);
                    const domainId = String(sk.domain_id || sk.DomainID || sk.kategori?.domain?.id || sk.kategori?.Domain?.ID || '');
                    if (kategoriId && domainId && domainMap.has(domainId)) {
                        const catMap = domainMap.get(domainId).categories;
                        if (!catMap.has(kategoriId)) {
                            catMap.set(kategoriId, {
                                id: kategoriId,
                                name: sk.kategori?.nama_kategori || sk.nama_kategori || 'Unknown Kategori',
                                domainId: domainId,
                                subCategories: new Map<string, any>(),
                                questions: []
                            });
                        }
                        const category = catMap.get(kategoriId);
                        const subKategoriId = String(sk.id || sk.ID || '');
                        if (subKategoriId && !category.subCategories.has(subKategoriId)) {
                            category.subCategories.set(subKategoriId, {
                                id: subKategoriId,
                                name: sk.nama_sub_kategori || sk.NamaSubKategori || 'Unknown Sub Kategori',
                                categoryId: kategoriId,
                                questions: []
                            });
                        }
                    }
                });

                // 2.3 Process Pertanyaan
                const domainTypesByIndex = ['identifikasi', 'proteksi', 'deteksi', 'gulih'];
                let allQuestions: any[] = [];
                pertanyaanResults.forEach((raw, idx) => {
                    if (raw) {
                        const list = Array.isArray(raw) ? raw : (raw?.data || []);
                        const tagged = list.map((q: any) => ({ ...q, _sourceType: domainTypesByIndex[idx] }));
                        allQuestions = allQuestions.concat(tagged);
                    }
                });

                this.rawJsonString = JSON.stringify(allQuestions.slice(0, 2), null, 2) || '';

                allQuestions.forEach((q: any, index: number) => {
                    try {
                        const sk = q?.sub_kategori || q?.SubKategori || q?.subKategori;
                        const k = sk?.kategori || sk?.Kategori;
                        const d = k?.domain || k?.Domain;
                        const rl = q?.ruang_lingkup || q?.RuangLingkup || q?.ruangLingkup;

                        if (!d || !k || !sk) return;

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
                                subCategories: new Map<string, any>(),
                                questions: []
                            });
                        }
                        
                        const category = catMap.get(kId);
                        const skId = String(sk.id || sk.ID || q.sub_kategori_id || q.SubKategoriID || '');
                        if (skId && !category.subCategories.has(skId)) {
                            category.subCategories.set(skId, {
                                id: skId,
                                name: skName || 'Unknown Sub Kategori',
                                categoryId: kId,
                                questions: []
                            });
                        }
                        
                        const idxDesc: Record<number, string> = {
                            0: q.index0 || q.Index0 || 'Belum ada implementasi',
                            1: q.index1 || q.Index1 || 'Ad-hoc / Informal',
                            2: q.index2 || q.Index2 || 'Terdokumentasi sebagian',
                            3: q.index3 || q.Index3 || 'Terdefinisi dan terdokumentasi',
                            4: q.index4 || q.Index4 || 'Terkelola dan terukur',
                            5: q.index5 || q.Index5 || 'Optimalisasi berkelanjutan'
                        };

                        const sourceType: string = q._sourceType || (
                            domainNameLower.includes('identifikasi') ? 'identifikasi'
                            : domainNameLower.includes('proteksi') ? 'proteksi'
                            : domainNameLower.includes('deteksi') ? 'deteksi'
                            : 'gulih'
                        );
                        const numericId = String(q.id || q.ID);
                        const compositeId = `${sourceType}_${numericId}`;

                        const question: DynamicQuestion = {
                            id: compositeId,
                            originalId: numericId,
                            text: qIdent || skName || 'Pertanyaan',
                            kategoriId: kId,
                            subCategoryId: skId,
                            subCategoryName: skName || 'Unknown Sub Kategori',
                            domainKey: sourceType as any,
                            scope: pName,
                            indexDescriptions: idxDesc
                        };

                        const targetSubCategory = skId && category.subCategories.has(skId)
                            ? category.subCategories.get(skId)
                            : null;

                        if (targetSubCategory) {
                            targetSubCategory.questions.push(question);
                        } else {
                            category.questions.push(question);
                        }
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
                            .sort((c1: any, c2: any) => Number(c1.id) - Number(c2.id))
                            .map((category: any) => ({
                                ...category,
                                subCategories: Array.from((category.subCategories || new Map()).values())
                                    .sort((sc1: any, sc2: any) => Number(sc1.id) - Number(sc2.id))
                            }));
                        return d;
                    });

                // Wait for answer hydration if it was started
                if (answerHydrationPromise) {
                    await answerHydrationPromise;
                }

                this.dataLoaded = true;

                // Sync current progress if there is no progress for this user
                if (this.currentStakeholderSlug && !this.progressMap[this.currentStakeholderSlug]) {
                    if (this.domains.length > 0 && this.domains[0].categories.length > 0) {
                        const firstSubCategory = getFirstSubCategory(this.domains[0].categories[0]);
                        this.progressMap[this.currentStakeholderSlug] = createDefaultProgress(
                            this.domains[0].id, 
                            this.domains[0].categories[0].id, 
                            firstSubCategory?.id || ''
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

        async saveAnswer(questionId: string, index: number, meta?: { evidence?: string; validasi?: string }) {
            if (!this.currentStakeholderSlug || this.isLocked) return;

            if (!this.answersMap[this.currentStakeholderSlug]) {
                this.answersMap[this.currentStakeholderSlug] = {};
            }

            const existing = this.answersMap[this.currentStakeholderSlug][questionId] || {} as any;
            const now = Date.now();
            this.answersMap[this.currentStakeholderSlug][questionId] = {
                questionId,
                index,
                updatedAt: now,
                backendSyncedAt: existing.backendSyncedAt, // Keep previous sync state
                backendSyncError: null,
                evidence: meta?.evidence ?? existing.evidence,
                validasi: meta?.validasi ?? existing.validasi,
            };

            this.syncToIkas(this.currentStakeholderSlug);
            
            // Auto-start sync if not already running
            if (!this.autoSyncTimer) {
                this.startAutoSync();
            }
        },

        async performBulkSync(stakeholderSlug: string, pendingAnswers: Answer[]): Promise<{ success: boolean; errors: string[] }> {
            if (!pendingAnswers.length) return { success: true, errors: [] };
            
            const finalIkasId = await this.ensureBackendIkasIdForAnswers(stakeholderSlug);
            const stakeholder = useStakeholdersStore().getStakeholderBySlug(stakeholderSlug);

            if (!stakeholder?.id || !finalIkasId) {
                const errors = pendingAnswers.map((answer) => answer.questionId);
                return { success: false, errors };
            }

            if (!this.syncedBackendAnswersMap[stakeholderSlug]) {
                this.syncedBackendAnswersMap[stakeholderSlug] = {};
            }
            if (!this.backendAnswerIdsMap[stakeholderSlug]) {
                this.backendAnswerIdsMap[stakeholderSlug] = {};
            }

            const questionById = new Map(
                this.domains
                    .flatMap(domain => domain.categories.flatMap(category => getCategoryQuestions(category)))
                    .map(question => [question.id, question])
            );

            const pendingWithQuestions = pendingAnswers
                .map((answer) => ({ answer, question: questionById.get(answer.questionId) }))
                .filter((item): item is { answer: Answer; question: DynamicQuestion } => !!item.question);

            // Preload all IDs in bulk to avoid per-request GET calls
            await this.preloadBackendAnswerIds(stakeholderSlug, finalIkasId, pendingWithQuestions.map(({ question }) => question));

            const pertanyaanFieldMap: Record<string, string> = {
                identifikasi: 'pertanyaan_identifikasi_id',
                proteksi: 'pertanyaan_proteksi_id',
                deteksi: 'pertanyaan_deteksi_id',
                gulih: 'pertanyaan_gulih_id',
            };
            const jawabanFieldMap: Record<string, string> = {
                identifikasi: 'jawaban_identifikasi',
                proteksi: 'jawaban_proteksi',
                deteksi: 'jawaban_deteksi',
                gulih: 'jawaban_gulih',
            };

            this.syncingAnswersCount += pendingWithQuestions.length;
            const errors: string[] = [];

            await Promise.all(pendingWithQuestions.map(async ({ answer, question }) => {
                try {
                    // Skip if already synced with same value
                    if (this.syncedBackendAnswersMap[stakeholderSlug][answer.questionId] === answer.index) {
                        return;
                    }

                    const domainKey = question.domainKey;
                    const pertanyaanField = pertanyaanFieldMap[domainKey] || 'id_pertanyaan';
                    const jawabanField = jawabanFieldMap[domainKey] || 'jawaban';
                    const numericId = question.originalId ? Number(question.originalId) : Number(answer.questionId.split('_').pop());
                    
                    const createPayload: Record<string, any> = {
                        ikas_id: finalIkasId,
                        [pertanyaanField]: numericId,
                        [jawabanField]: answer.index,
                    };
                    const updatePayload: Record<string, any> = {
                        [jawabanField]: answer.index,
                    };

                    const storedAnswer = this.answersMap[stakeholderSlug]?.[answer.questionId];
                    const evidenceValue = String(storedAnswer?.evidence || '').trim();
                    const keteranganValue = String((storedAnswer as any)?.keterangan || '').trim();
                    const validasiValue = String(storedAnswer?.validasi || '').trim();

                    if (evidenceValue) {
                        createPayload.evidence = evidenceValue;
                        updatePayload.evidence = evidenceValue;
                    }
                    if (keteranganValue) {
                        createPayload.keterangan = keteranganValue;
                        updatePayload.keterangan = keteranganValue;
                    }
                    if (evidenceValue && validasiValue) {
                        createPayload.validasi = validasiValue;
                        updatePayload.validasi = validasiValue;
                    }

                    const existingJawabanId = String(this.backendAnswerIdsMap[stakeholderSlug]?.[answer.questionId] || '');
                    const response = existingJawabanId
                        ? await ikasService.updateJawabanByKategori(domainKey, existingJawabanId, updatePayload)
                        : await ikasService.createJawabanByKategori(domainKey, createPayload);

                    this.syncedBackendAnswersMap[stakeholderSlug][answer.questionId] = answer.index;
                    const persistedId = getPersistedAnswerId(response) || existingJawabanId;
                    if (persistedId) {
                        this.backendAnswerIdsMap[stakeholderSlug][answer.questionId] = persistedId;
                    }
                    if (this.answersMap[stakeholderSlug]?.[answer.questionId]) {
                        this.answersMap[stakeholderSlug][answer.questionId].backendSyncedAt = Date.now();
                        this.answersMap[stakeholderSlug][answer.questionId].backendSyncError = null;
                    }
                } catch (error: any) {
                    console.error('[DynamicAssessment] Failed to sync answer:', error);
                    errors.push(answer.questionId);
                    if (this.answersMap[stakeholderSlug]?.[answer.questionId]) {
                        this.answersMap[stakeholderSlug][answer.questionId].backendSyncError =
                            error?.message || 'Gagal menyimpan jawaban';
                    }
                } finally {
                    this.syncingAnswersCount = Math.max(0, this.syncingAnswersCount - 1);
                }
            }));

            return { success: errors.length === 0, errors };
        },

        startAutoSync() {
            if (this.autoSyncTimer) return;
            
            // Sync every 5 seconds
            this.autoSyncTimer = setInterval(async () => {
                if (!this.currentStakeholderSlug || this.syncingAnswersCount > 0) return;
                
                const answers = this.answersMap[this.currentStakeholderSlug] || {};
                const pending = Object.values(answers).filter(a => 
                    !a.backendSyncedAt || (a.updatedAt && a.backendSyncedAt && a.updatedAt > a.backendSyncedAt)
                );
                
                if (pending.length > 0) {
                    await this.performBulkSync(this.currentStakeholderSlug, pending);
                }
            }, 5000);
        },

        stopAutoSync() {
            if (this.autoSyncTimer) {
                clearInterval(this.autoSyncTimer);
                this.autoSyncTimer = null;
            }
        },

        async syncCurrentPageAnswersToBackend(stakeholderSlug: string): Promise<{ success: boolean; errors: string[] }> {
            const answers = this.answersMap[stakeholderSlug] || {};
            const questions = this.currentPageQuestions;
            const pendingAnswers = questions
                .map((q) => answers[q.id])
                .filter((a): a is Answer => !!a && (!a.backendSyncedAt || (a.updatedAt && a.backendSyncedAt && a.updatedAt > a.backendSyncedAt)));

            return this.performBulkSync(stakeholderSlug, pendingAnswers);
        },


        async hydrateAnswersFromBackend(stakeholderSlug: string, _perusahaanId: string) {
            try {
                const activeIkasId = useIkasStore().getBackendIkasId(stakeholderSlug);
                if (!activeIkasId) {
                    console.warn('[DynamicAssessment] hydrateAnswersFromBackend dibatalkan: ikas_id null');
                    return;
                }

                const fetchAllAnswersForDomain = async (domainKey: 'identifikasi' | 'proteksi' | 'deteksi' | 'gulih') => {
                    const collected: any[] = [];
                    let page = 1;
                    let totalPages = 1;

                    while (page <= totalPages) {
                        const response = await ikasService.getJawabanByKategori(domainKey, activeIkasId, {
                            page,
                            limit: 500,
                        }).catch(() => null);

                        if (!response) break;

                        collected.push(...this.normalizeApiCollection(response));

                        const pagination = response?.pagination || response?.data?.pagination || null;
                        totalPages = Number(
                            pagination?.total_pages ||
                            pagination?.totalPages ||
                            pagination?.last_page ||
                            pagination?.lastPage ||
                            1
                        ) || 1;

                        if (collected.length === 0 && totalPages === 1) {
                            break;
                        }

                        page += 1;
                    }

                    return collected;
                };

                const results = await Promise.all([
                    fetchAllAnswersForDomain('identifikasi'),
                    fetchAllAnswersForDomain('proteksi'),
                    fetchAllAnswersForDomain('deteksi'),
                    fetchAllAnswersForDomain('gulih'),
                ]);

                // Debug: log raw results for each domain fetch
                try {
                } catch (e) {}

                // Process each result set separately to preserve domain type info

                if (!this.answersMap[stakeholderSlug]) {
                    this.answersMap[stakeholderSlug] = {};
                }
                if (!this.syncedBackendAnswersMap[stakeholderSlug]) {
                    this.syncedBackendAnswersMap[stakeholderSlug] = {};
                }
                if (!this.backendAnswerIdsMap[stakeholderSlug]) {
                    this.backendAnswerIdsMap[stakeholderSlug] = {};
                }

                const domainTypes = ['identifikasi', 'proteksi', 'deteksi', 'gulih'];
                results.forEach((rawResult: any, domainIdx: number) => {
                    const items = this.normalizeApiCollection(rawResult);
                    const domainType = domainTypes[domainIdx];

                    items.forEach((rawItem: any) => {
                        const item = unwrapAnswerItem(rawItem);
                        const itemIkasId = String(item.ikas_id || item.id_ikas || item.ikasId || item.IkasID || '');
                        if (itemIkasId && itemIkasId !== String(activeIkasId)) return;

                        const numericId = String(
                            item.pertanyaan_identifikasi_id || item.PertanyaanIdentifikasiID ||
                            item.pertanyaan_proteksi_id || item.PertanyaanProteksiID ||
                            item.pertanyaan_deteksi_id || item.PertanyaanDeteksiID ||
                            item.pertanyaan_gulih_id || item.PertanyaanGulihID ||
                            item.pertanyaan_identifikasi?.id || item.pertanyaan_proteksi?.id ||
                            item.pertanyaan_deteksi?.id || item.pertanyaan_gulih?.id ||
                            item.id_pertanyaan || item.pertanyaan_id || item.PertanyaanID || item.pertanyaan?.id || ''
                        );
                        if (!numericId) return;

                        const compositeId = `${domainType}_${numericId}`;
                        const indexValue = Number(
                            item.jawaban ??
                            item.jawaban_identifikasi ??
                            item.jawaban_proteksi ??
                            item.jawaban_deteksi ??
                            item.jawaban_gulih ??
                            item.JawabanIdentifikasi ??
                            item.JawabanProteksi ??
                            item.JawabanDeteksi ??
                            item.JawabanGulih ??
                            item.nilai ??
                            item.index ??
                            0
                        );

                        this.answersMap[stakeholderSlug][compositeId] = {
                            questionId: compositeId,
                            index: indexValue,
                            updatedAt: Date.now(),
                            backendSyncedAt: Date.now(),
                            backendSyncError: null,
                        };
                        this.syncedBackendAnswersMap[stakeholderSlug][compositeId] = indexValue;
                        const backendAnswerId = String(item.id || item.ID || item.jawaban_id || item.id_jawaban || '');
                        if (backendAnswerId) {
                            this.backendAnswerIdsMap[stakeholderSlug][compositeId] = backendAnswerId;
                        }
                    });
                });

                this.syncToIkas(stakeholderSlug);
            } catch (error) {
                console.warn('[DynamicAssessment] Failed to hydrate answers from backend:', error);
            }
        },

        async syncPendingAnswersToBackend(stakeholderSlug: string): Promise<{ success: boolean; errors: string[] }> {
            const answers = this.answersMap[stakeholderSlug] || {};
            const pendingAnswers = Object.values(answers).filter(a => 
                !a.backendSyncedAt || !!a.backendSyncError || (a.updatedAt && a.backendSyncedAt && a.updatedAt > a.backendSyncedAt)
            );

            return this.performBulkSync(stakeholderSlug, pendingAnswers);
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
                else if (domainNameLower.includes('pemulihan') || domainNameLower.includes('tanggulih') || domainNameLower.includes('gulih')) targetDomainKey = 'tanggulih';
                
                if (!targetDomainKey) continue;
                // Type assertion is safe here as we map to known keys
                const ikasDomainData = (targetData as any)[targetDomainKey];

                let totalDomainAvg = 0;
                let activeCategories = 0;

                domain.categories.forEach((category, idx) => {
                    const subdomainKey = `nilai_subdomain${idx + 1}`;
                    
                    let catSum = 0;
                    let catCount = 0;

                    getCategoryQuestions(category).forEach(q => {
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

        updateProgress(domainId: string, categoryId: string, subCategoryId: string, page: number) {
            if (!this.currentStakeholderSlug) return;

            this.progressMap[this.currentStakeholderSlug] = {
                ...this.progressMap[this.currentStakeholderSlug],
                currentDomainId: domainId,
                currentCategoryId: categoryId,
                currentSubCategoryId: subCategoryId,
                currentPage: page,
                lastUpdated: Date.now()
            };
        },

        completeAssessment(): boolean {
            if (!this.currentStakeholderSlug) return false;
            if (this.hasPendingAnswerSync || this.hasUnsyncedAnswers) {
                console.warn('[DynamicAssessment] Cannot complete assessment while answer sync is pending or failed.');
                return false;
            }
            this.progressMap[this.currentStakeholderSlug].status = 'COMPLETED';
            this.progressMap[this.currentStakeholderSlug].lastUpdated = Date.now();
            return true;
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
            delete this.backendAnswerIdsMap[slug];
            delete this.progressMap[slug];

            if (this.currentStakeholderSlug === slug) {
                const firstDomain = this.domains[0];
                const firstCategory = firstDomain?.categories?.[0];
                const firstSubCategory = getFirstSubCategory(firstCategory);
                this.answersMap[slug] = {};
                this.syncedBackendAnswersMap[slug] = {};
                this.backendAnswerIdsMap[slug] = {};
                this.progressMap[slug] = createDefaultProgress(
                    firstDomain?.id || '',
                    firstCategory?.id || '',
                    firstSubCategory?.id || ''
                );
            }
        },

        clearAllAssessmentState() {
            this.respondentProfilesMap = {};
            this.answersMap = {};
            this.syncedBackendAnswersMap = {};
            this.backendAnswerIdsMap = {};
            this.progressMap = {};
        },

        goToNextPage() {
            const totalPages = this.totalPagesInSubCategory;

            if (this.progress.currentPage < totalPages) {
                this.updateProgress(
                    this.progress.currentDomainId,
                    this.progress.currentCategoryId,
                    this.progress.currentSubCategoryId,
                    this.progress.currentPage + 1
                );
            } else {
                this.goToNextSubCategory();
            }
        },

        goToPreviousPage() {
            if (this.progress.currentPage > 1) {
                this.updateProgress(
                    this.progress.currentDomainId,
                    this.progress.currentCategoryId,
                    this.progress.currentSubCategoryId,
                    this.progress.currentPage - 1
                );
            } else {
                this.goToPreviousSubCategory();
            }
        },

        goToNextSubCategory() {
            const domain = this.currentDomain;
            const category = this.currentCategory;
            const currentSubCategory = this.currentSubCategory;
            if (!domain || !category) return;

            const subCategories = category.subCategories || [];
            const currentSubCategoryIndex = currentSubCategory
                ? subCategories.findIndex(sc => sc.id === currentSubCategory.id)
                : -1;

            if (currentSubCategoryIndex >= 0 && currentSubCategoryIndex < subCategories.length - 1) {
                const nextSubCategory = subCategories[currentSubCategoryIndex + 1];
                this.updateProgress(domain.id, category.id, nextSubCategory.id, 1);
                return;
            }

            const categoryIndex = domain.categories.findIndex(c => c.id === category.id);
            if (categoryIndex < domain.categories.length - 1) {
                const nextCategory = domain.categories[categoryIndex + 1];
                const firstSubCategory = getFirstSubCategory(nextCategory);
                this.updateProgress(domain.id, nextCategory.id, firstSubCategory?.id || '', 1);
                return;
            }

            const domainIndex = this.domains.findIndex(d => d.id === domain.id);
            if (domainIndex < this.domains.length - 1) {
                const nextDomain = this.domains[domainIndex + 1];
                const firstCategory = nextDomain.categories[0];
                const firstSubCategory = getFirstSubCategory(firstCategory);
                if (firstCategory) {
                    this.updateProgress(nextDomain.id, firstCategory.id, firstSubCategory?.id || '', 1);
                }
            }
        },

        goToPreviousSubCategory() {
            const domain = this.currentDomain;
            const category = this.currentCategory;
            const currentSubCategory = this.currentSubCategory;
            if (!domain || !category) return;

            const subCategories = category.subCategories || [];
            const currentSubCategoryIndex = currentSubCategory
                ? subCategories.findIndex(sc => sc.id === currentSubCategory.id)
                : -1;

            if (currentSubCategoryIndex > 0) {
                const prevSubCategory = subCategories[currentSubCategoryIndex - 1];
                this.updateProgress(domain.id, category.id, prevSubCategory.id, getLastPageForQuestions(prevSubCategory.questions));
                return;
            }

            const categoryIndex = domain.categories.findIndex(c => c.id === category.id);
            if (categoryIndex > 0) {
                const prevCategory = domain.categories[categoryIndex - 1];
                const lastSubCategory = getLastSubCategory(prevCategory);
                if (lastSubCategory) {
                    this.updateProgress(domain.id, prevCategory.id, lastSubCategory.id, getLastPageForQuestions(lastSubCategory.questions));
                } else {
                    this.updateProgress(domain.id, prevCategory.id, '', getLastPageForQuestions(getCategoryQuestions(prevCategory)));
                }
                return;
            }

            const domainIndex = this.domains.findIndex(d => d.id === domain.id);
            if (domainIndex > 0) {
                const prevDomain = this.domains[domainIndex - 1];
                const lastCategory = prevDomain.categories[prevDomain.categories.length - 1];
                if (!lastCategory) return;
                const lastSubCategory = getLastSubCategory(lastCategory);
                if (lastSubCategory) {
                    this.updateProgress(prevDomain.id, lastCategory.id, lastSubCategory.id, getLastPageForQuestions(lastSubCategory.questions));
                } else {
                    this.updateProgress(prevDomain.id, lastCategory.id, '', getLastPageForQuestions(getCategoryQuestions(lastCategory)));
                }
            }
        }
    }
});
