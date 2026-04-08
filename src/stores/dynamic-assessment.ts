import { defineStore } from 'pinia';
import type { 
  DynamicDomain, DynamicCategory, DynamicQuestion 
} from '@/types/dynamic-assessment.types';
import type { 
  AnswerMap, Answer, AssessmentProgress, RespondentProfile 
} from '@/types/assessment.types';
import { useIkasStore } from '@/stores/ikas';
import { assessmentData } from '@/data/assessment/assessment-data';

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
        currentStakeholderSlug: '' as string,
        respondentProfilesMap: {} as Record<string, RespondentProfile>,
        answersMap: {} as Record<string, AnswerMap>,
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
        },

        initializeLocalData() {
            if (this.initialized) return;

            const profilesData = localStorage.getItem(STORAGE_KEYS.RESPONDENT_PROFILES);
            if (profilesData) {
                try { this.respondentProfilesMap = JSON.parse(profilesData); } catch (e) {}
            }

            const answersData = localStorage.getItem(STORAGE_KEYS.ASSESSMENT_ANSWERS);
            if (answersData) {
                try { this.answersMap = JSON.parse(answersData); } catch (e) {}
            }

            const progressData = localStorage.getItem(STORAGE_KEYS.ASSESSMENT_PROGRESS);
            if (progressData) {
                try { this.progressMap = JSON.parse(progressData); } catch (e) {}
            }

            this.initialized = true;
        },

        async fetchAssessmentStructure() {
            if (this.dataLoaded) return;
            this.loading = true;
            this.error = null;

            try {
                // Fallback to local data
                this.domains = assessmentData.domains.map(d => {
                    const dynamicCategories: DynamicCategory[] = d.categories.map(c => {
                        const dynamicQuestions: DynamicQuestion[] = [];
                        c.subCategories.forEach(sc => {
                            sc.questions.forEach(q => {
                                dynamicQuestions.push({
                                    id: q.id,
                                    text: q.text,
                                    kategoriId: c.id,
                                    scope: q.scope || 'Tata Kelola',
                                    indexDescriptions: q.indexDescriptions || genericIndexDescriptions
                                });
                            });
                        });
                        return {
                            id: c.id,
                            name: c.name,
                            domainId: d.id,
                            questions: dynamicQuestions
                        };
                    });
                    
                    return {
                        id: d.id,
                        name: d.name,
                        color: d.color || '#00a2e8',
                        categories: dynamicCategories
                    };
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
            localStorage.setItem(STORAGE_KEYS.RESPONDENT_PROFILES, JSON.stringify(this.respondentProfilesMap));
        },

        saveAnswer(questionId: string, index: number) {
            if (!this.currentStakeholderSlug || this.isLocked) return;

            if (!this.answersMap[this.currentStakeholderSlug]) {
                this.answersMap[this.currentStakeholderSlug] = {};
            }

            this.answersMap[this.currentStakeholderSlug][questionId] = { questionId, index, updatedAt: Date.now() };
            localStorage.setItem(STORAGE_KEYS.ASSESSMENT_ANSWERS, JSON.stringify(this.answersMap));

            this.syncToIkas(this.currentStakeholderSlug);
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

            localStorage.setItem(STORAGE_KEYS.ASSESSMENT_PROGRESS, JSON.stringify(this.progressMap));
        },

        completeAssessment() {
            if (!this.currentStakeholderSlug) return;
            this.progressMap[this.currentStakeholderSlug].status = 'COMPLETED';
            this.progressMap[this.currentStakeholderSlug].lastUpdated = Date.now();
            localStorage.setItem(STORAGE_KEYS.ASSESSMENT_PROGRESS, JSON.stringify(this.progressMap));
        },
        
        unlockAssessment() {
            if (!this.currentStakeholderSlug) return;
            this.progressMap[this.currentStakeholderSlug].status = 'IN_PROGRESS';
            this.progressMap[this.currentStakeholderSlug].lastUpdated = Date.now();
            localStorage.setItem(STORAGE_KEYS.ASSESSMENT_PROGRESS, JSON.stringify(this.progressMap));
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
