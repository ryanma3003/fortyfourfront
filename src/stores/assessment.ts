import { defineStore } from 'pinia';
import type {
    RespondentProfile,
    AnswerMap,
    Answer,
    AssessmentProgress,
    AnswerIndex
} from '@/types/assessment.types';
import { assessmentData, getTotalQuestionCount } from '@/data/assessment/assessment-data';
import { useIkasStore } from '@/stores/ikas';

const STORAGE_KEYS = {
    RESPONDENT_PROFILES: 'respondent_profiles_map', // Map: slug -> profile
    ASSESSMENT_ANSWERS: 'assessment_answers_map', // Map: slug -> answers
    ASSESSMENT_PROGRESS: 'assessment_progress_map' // Map: slug -> progress
};

// Default progress state
const createDefaultProgress = (): AssessmentProgress => ({
    currentDomainId: 'identifikasi',
    currentCategoryId: 'peran-tanggung-jawab',
    currentSubCategoryId: 'peran-keamanan',
    currentPage: 1,
    lastUpdated: Date.now()
});

export const useAssessmentStore = defineStore('assessment', {
    state: () => ({
        // Current active stakeholder slug
        currentStakeholderSlug: '' as string,
        // Map: stakeholder slug -> RespondentProfile
        respondentProfilesMap: {} as Record<string, RespondentProfile>,
        // Map: stakeholder slug -> AnswerMap
        answersMap: {} as Record<string, AnswerMap>,
        // Map: stakeholder slug -> AssessmentProgress
        progressMap: {} as Record<string, AssessmentProgress>,
        initialized: false
    }),

    getters: {
        /**
         * Get current respondent profile for active stakeholder
         */
        respondentProfile(): RespondentProfile | null {
            if (!this.currentStakeholderSlug) return null;
            return this.respondentProfilesMap[this.currentStakeholderSlug] || null;
        },

        /**
         * Get current answers for active stakeholder
         */
        answers(): AnswerMap {
            if (!this.currentStakeholderSlug) return {};
            return this.answersMap[this.currentStakeholderSlug] || {};
        },

        /**
         * Get current progress for active stakeholder
         */
        progress(): AssessmentProgress {
            if (!this.currentStakeholderSlug) return createDefaultProgress();
            return this.progressMap[this.currentStakeholderSlug] || createDefaultProgress();
        },

        /**
         * Check if respondent form is completed for current stakeholder
         */
        hasRespondentProfile(): boolean {
            return this.respondentProfile !== null;
        },

        /**
         * Get total number of questions
         */
        totalQuestions: () => getTotalQuestionCount(),

        /**
         * Get number of answered questions (excluding NA)
         */
        answeredQuestions(): number {
            return Object.values(this.answers).length;
        },

        /**
         * Get completion percentage
         */
        completionPercentage(): number {
            const total = this.totalQuestions;
            const answered = this.answeredQuestions;
            return total > 0 ? Math.round((answered / total) * 100) : 0;
        },

        /**
         * Get current domain
         */
        currentDomain() {
            return assessmentData.domains.find(d => d.id === this.progress.currentDomainId);
        },

        /**
         * Get current category
         */
        currentCategory() {
            const domain = assessmentData.domains.find(d => d.id === this.progress.currentDomainId);
            return domain?.categories.find(c => c.id === this.progress.currentCategoryId);
        },

        /**
         * Get current sub-category
         */
        currentSubCategory() {
            const domain = assessmentData.domains.find(d => d.id === this.progress.currentDomainId);
            const category = domain?.categories.find(c => c.id === this.progress.currentCategoryId);
            return category?.subCategories.find(sc => sc.id === this.progress.currentSubCategoryId);
        },

        /**
         * Get questions for current page (max 5 per page)
         */
        currentPageQuestions() {
            const domain = assessmentData.domains.find(d => d.id === this.progress.currentDomainId);
            const category = domain?.categories.find(c => c.id === this.progress.currentCategoryId);
            const subCategory = category?.subCategories.find(sc => sc.id === this.progress.currentSubCategoryId);

            if (!subCategory) return [];

            const questionsPerPage = 5;
            const startIndex = (this.progress.currentPage - 1) * questionsPerPage;
            const endIndex = startIndex + questionsPerPage;

            return subCategory.questions.slice(startIndex, endIndex);
        },

        /**
         * Get total pages for current sub-category
         */
        totalPagesInSubCategory() {
            const domain = assessmentData.domains.find(d => d.id === this.progress.currentDomainId);
            const category = domain?.categories.find(c => c.id === this.progress.currentCategoryId);
            const subCategory = category?.subCategories.find(sc => sc.id === this.progress.currentSubCategoryId);

            if (!subCategory) return 0;

            const questionsPerPage = 5;
            return Math.ceil(subCategory.questions.length / questionsPerPage);
        },

        /**
         * Get answer for a specific question
         */
        getAnswer() {
            return (questionId: string): Answer | undefined => {
                return this.answers[questionId];
            };
        },

        /**
         * Get breadcrumb path for current position
         */
        breadcrumbPath(): string[] {
            const domain = this.currentDomain;
            const category = this.currentCategory;
            const subCategory = this.currentSubCategory;

            const path: string[] = [];
            if (domain) path.push(domain.name);
            if (category) path.push(category.name);
            if (subCategory) path.push(subCategory.name);

            return path;
        }
    },

    actions: {
        /**
         * Set current stakeholder slug and load their data
         */
        setCurrentStakeholder(slug: string) {
            this.currentStakeholderSlug = slug;
            
            // Initialize data for this stakeholder if not exists
            if (!this.answersMap[slug]) {
                this.answersMap[slug] = {};
            }
            if (!this.progressMap[slug]) {
                this.progressMap[slug] = createDefaultProgress();
            }
        },

        /**
         * Initialize store from localStorage
         */
        initialize() {
            if (this.initialized) return;

            // Clear old global storage keys (from previous implementation)
            // This ensures clean slate for per-stakeholder storage
            const oldKeys = ['respondent_profile', 'assessment_answers', 'assessment_progress'];
            oldKeys.forEach(key => {
                if (localStorage.getItem(key)) {
                    console.log(`Migrating: removing old global key '${key}'`);
                    localStorage.removeItem(key);
                }
            });

            // Load respondent profiles map
            const profilesData = localStorage.getItem(STORAGE_KEYS.RESPONDENT_PROFILES);
            if (profilesData) {
                try {
                    this.respondentProfilesMap = JSON.parse(profilesData);
                } catch (error) {
                    console.error('Error parsing respondent profiles:', error);
                }
            }

            // Load answers map
            const answersData = localStorage.getItem(STORAGE_KEYS.ASSESSMENT_ANSWERS);
            if (answersData) {
                try {
                    this.answersMap = JSON.parse(answersData);
                } catch (error) {
                    console.error('Error parsing answers:', error);
                }
            }

            // Load progress map
            const progressData = localStorage.getItem(STORAGE_KEYS.ASSESSMENT_PROGRESS);
            if (progressData) {
                try {
                    this.progressMap = JSON.parse(progressData);
                } catch (error) {
                    console.error('Error parsing progress:', error);
                }
            }

            this.initialized = true;
        },

        /**
         * Save respondent profile for current stakeholder
         */
        saveRespondentProfile(profile: RespondentProfile) {
            if (!this.currentStakeholderSlug) return;

            const now = Date.now();
            const profileWithTimestamp = {
                ...profile,
                updatedAt: now,
                createdAt: profile.createdAt || now
            };

            this.respondentProfilesMap[this.currentStakeholderSlug] = profileWithTimestamp;
            localStorage.setItem(STORAGE_KEYS.RESPONDENT_PROFILES, JSON.stringify(this.respondentProfilesMap));
        },

        /**
         * Save or update an answer for current stakeholder
         */
        saveAnswer(questionId: string, index: AnswerIndex) {
            if (!this.currentStakeholderSlug) return;

            const answer: Answer = {
                questionId,
                index,
                updatedAt: Date.now()
            };

            // Ensure answers map exists for this stakeholder
            if (!this.answersMap[this.currentStakeholderSlug]) {
                this.answersMap[this.currentStakeholderSlug] = {};
            }

            this.answersMap[this.currentStakeholderSlug][questionId] = answer;
            localStorage.setItem(STORAGE_KEYS.ASSESSMENT_ANSWERS, JSON.stringify(this.answersMap));

            // Auto-sync to IKAS store so the summary page reflects the latest data
            this.syncToIkas(this.currentStakeholderSlug);
        },

        /**
         * Sync all assessment answers to IKAS store for current stakeholder
         */
        syncToIkas(stakeholderSlug: string) {
            const answers = this.answersMap[stakeholderSlug] || {};
            const ikasStore = useIkasStore();
            ikasStore.syncFromAssessment(stakeholderSlug, answers);
        },

        /**
         * Update current progress position for current stakeholder
         */
        updateProgress(domainId: string, categoryId: string, subCategoryId: string, page: number) {
            if (!this.currentStakeholderSlug) return;

            this.progressMap[this.currentStakeholderSlug] = {
                currentDomainId: domainId,
                currentCategoryId: categoryId,
                currentSubCategoryId: subCategoryId,
                currentPage: page,
                lastUpdated: Date.now()
            };

            localStorage.setItem(STORAGE_KEYS.ASSESSMENT_PROGRESS, JSON.stringify(this.progressMap));
        },

        /**
         * Navigate to next page
         */
        goToNextPage() {
            const totalPages = this.totalPagesInSubCategory;

            if (this.progress.currentPage < totalPages) {
                // Move to next page in same sub-category
                this.updateProgress(
                    this.progress.currentDomainId,
                    this.progress.currentCategoryId,
                    this.progress.currentSubCategoryId,
                    this.progress.currentPage + 1
                );
            } else {
                // Try to move to next sub-category
                this.goToNextSubCategory();
            }
        },

        /**
         * Navigate to previous page
         */
        goToPreviousPage() {
            if (this.progress.currentPage > 1) {
                this.updateProgress(
                    this.progress.currentDomainId,
                    this.progress.currentCategoryId,
                    this.progress.currentSubCategoryId,
                    this.progress.currentPage - 1
                );
            } else {
                // Try to move to previous sub-category
                this.goToPreviousSubCategory();
            }
        },

        /**
         * Navigate to next sub-category
         */
        goToNextSubCategory() {
            const domain = this.currentDomain;
            const category = this.currentCategory;
            const subCategory = this.currentSubCategory;

            if (!domain || !category || !subCategory) return;

            // Find current indices
            const categoryIndex = domain.categories.findIndex(c => c.id === category.id);
            const subCategoryIndex = category.subCategories.findIndex(sc => sc.id === subCategory.id);

            // Try next sub-category in same category
            if (subCategoryIndex < category.subCategories.length - 1) {
                const nextSubCategory = category.subCategories[subCategoryIndex + 1];
                this.updateProgress(domain.id, category.id, nextSubCategory.id, 1);
                return;
            }

            // Try next category in same domain
            if (categoryIndex < domain.categories.length - 1) {
                const nextCategory = domain.categories[categoryIndex + 1];
                const firstSubCategory = nextCategory.subCategories[0];
                this.updateProgress(domain.id, nextCategory.id, firstSubCategory.id, 1);
                return;
            }

            // Try next domain
            const domainIndex = assessmentData.domains.findIndex(d => d.id === domain.id);
            if (domainIndex < assessmentData.domains.length - 1) {
                const nextDomain = assessmentData.domains[domainIndex + 1];
                const firstCategory = nextDomain.categories[0];
                const firstSubCategory = firstCategory.subCategories[0];
                this.updateProgress(nextDomain.id, firstCategory.id, firstSubCategory.id, 1);
            }
        },

        /**
         * Navigate to previous sub-category
         */
        goToPreviousSubCategory() {
            const domain = this.currentDomain;
            const category = this.currentCategory;
            const subCategory = this.currentSubCategory;

            if (!domain || !category || !subCategory) return;

            // Find current indices
            const categoryIndex = domain.categories.findIndex(c => c.id === category.id);
            const subCategoryIndex = category.subCategories.findIndex(sc => sc.id === subCategory.id);

            // Try previous sub-category in same category
            if (subCategoryIndex > 0) {
                const prevSubCategory = category.subCategories[subCategoryIndex - 1];
                // Go to last page of previous sub-category
                const questionsPerPage = 5;
                const lastPage = Math.ceil(prevSubCategory.questions.length / questionsPerPage);
                this.updateProgress(domain.id, category.id, prevSubCategory.id, lastPage);
                return;
            }

            // Try previous category in same domain
            if (categoryIndex > 0) {
                const prevCategory = domain.categories[categoryIndex - 1];
                const lastSubCategory = prevCategory.subCategories[prevCategory.subCategories.length - 1];
                const questionsPerPage = 5;
                const lastPage = Math.ceil(lastSubCategory.questions.length / questionsPerPage);
                this.updateProgress(domain.id, prevCategory.id, lastSubCategory.id, lastPage);
                return;
            }

            // Try previous domain
            const domainIndex = assessmentData.domains.findIndex(d => d.id === domain.id);
            if (domainIndex > 0) {
                const prevDomain = assessmentData.domains[domainIndex - 1];
                const lastCategory = prevDomain.categories[prevDomain.categories.length - 1];
                const lastSubCategory = lastCategory.subCategories[lastCategory.subCategories.length - 1];
                const questionsPerPage = 5;
                const lastPage = Math.ceil(lastSubCategory.questions.length / questionsPerPage);
                this.updateProgress(prevDomain.id, lastCategory.id, lastSubCategory.id, lastPage);
            }
        },

        /**
         * Jump to specific location
         */
        jumpTo(domainId: string, categoryId: string, subCategoryId: string, page: number = 1) {
            this.updateProgress(domainId, categoryId, subCategoryId, page);
        },

        /**
         * Clear all data for current stakeholder
         */
        clearCurrentStakeholder() {
            if (!this.currentStakeholderSlug) return;

            delete this.respondentProfilesMap[this.currentStakeholderSlug];
            delete this.answersMap[this.currentStakeholderSlug];
            delete this.progressMap[this.currentStakeholderSlug];

            localStorage.setItem(STORAGE_KEYS.RESPONDENT_PROFILES, JSON.stringify(this.respondentProfilesMap));
            localStorage.setItem(STORAGE_KEYS.ASSESSMENT_ANSWERS, JSON.stringify(this.answersMap));
            localStorage.setItem(STORAGE_KEYS.ASSESSMENT_PROGRESS, JSON.stringify(this.progressMap));
        },

        /**
         * Clear all data for all stakeholders
         */
        clearAll() {
            this.respondentProfilesMap = {};
            this.answersMap = {};
            this.progressMap = {};
            this.currentStakeholderSlug = '';

            localStorage.removeItem(STORAGE_KEYS.RESPONDENT_PROFILES);
            localStorage.removeItem(STORAGE_KEYS.ASSESSMENT_ANSWERS);
            localStorage.removeItem(STORAGE_KEYS.ASSESSMENT_PROGRESS);
        }
    }
});
