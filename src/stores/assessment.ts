import { defineStore } from 'pinia';
import type {
    RespondentProfile,
    AnswerMap,
    Answer,
    AssessmentProgress,
    AnswerIndex
} from '@/types/assessment.types';
import { assessmentData, getTotalQuestionCount } from '@/data/assessment/assessment-data';

const STORAGE_KEYS = {
    RESPONDENT_PROFILE: 'respondent_profile',
    ASSESSMENT_ANSWERS: 'assessment_answers',
    ASSESSMENT_PROGRESS: 'assessment_progress'
};

export const useAssessmentStore = defineStore('assessment', {
    state: () => ({
        respondentProfile: null as RespondentProfile | null,
        answers: {} as AnswerMap,
        progress: {
            currentDomainId: 'identifikasi',
            currentCategoryId: 'governance-risk-mgmt',
            currentSubCategoryId: 'security-policies',
            currentPage: 1,
            lastUpdated: Date.now()
        } as AssessmentProgress,
        initialized: false
    }),

    getters: {
        /**
         * Check if respondent form is completed
         */
        hasRespondentProfile: (state) => state.respondentProfile !== null,

        /**
         * Get total number of questions
         */
        totalQuestions: () => getTotalQuestionCount(),

        /**
         * Get number of answered questions (excluding NA)
         */
        answeredQuestions: (state) => {
            return Object.values(state.answers).length;
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
        currentDomain: (state) => {
            return assessmentData.domains.find(d => d.id === state.progress.currentDomainId);
        },

        /**
         * Get current category
         */
        currentCategory: (state) => {
            const domain = assessmentData.domains.find(d => d.id === state.progress.currentDomainId);
            return domain?.categories.find(c => c.id === state.progress.currentCategoryId);
        },

        /**
         * Get current sub-category
         */
        currentSubCategory: (state) => {
            const domain = assessmentData.domains.find(d => d.id === state.progress.currentDomainId);
            const category = domain?.categories.find(c => c.id === state.progress.currentCategoryId);
            return category?.subCategories.find(sc => sc.id === state.progress.currentSubCategoryId);
        },

        /**
         * Get questions for current page (max 5 per page)
         */
        currentPageQuestions: (state) => {
            const domain = assessmentData.domains.find(d => d.id === state.progress.currentDomainId);
            const category = domain?.categories.find(c => c.id === state.progress.currentCategoryId);
            const subCategory = category?.subCategories.find(sc => sc.id === state.progress.currentSubCategoryId);

            if (!subCategory) return [];

            const questionsPerPage = 5;
            const startIndex = (state.progress.currentPage - 1) * questionsPerPage;
            const endIndex = startIndex + questionsPerPage;

            return subCategory.questions.slice(startIndex, endIndex);
        },

        /**
         * Get total pages for current sub-category
         */
        totalPagesInSubCategory: (state) => {
            const domain = assessmentData.domains.find(d => d.id === state.progress.currentDomainId);
            const category = domain?.categories.find(c => c.id === state.progress.currentCategoryId);
            const subCategory = category?.subCategories.find(sc => sc.id === state.progress.currentSubCategoryId);

            if (!subCategory) return 0;

            const questionsPerPage = 5;
            return Math.ceil(subCategory.questions.length / questionsPerPage);
        },

        /**
         * Get answer for a specific question
         */
        getAnswer: (state) => (questionId: string): Answer | undefined => {
            return state.answers[questionId];
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
         * Initialize store from localStorage
         */
        initialize() {
            if (this.initialized) return;

            // Load respondent profile
            const profileData = localStorage.getItem(STORAGE_KEYS.RESPONDENT_PROFILE);
            if (profileData) {
                try {
                    this.respondentProfile = JSON.parse(profileData);
                } catch (error) {
                    console.error('Error parsing respondent profile:', error);
                }
            }

            // Load answers
            const answersData = localStorage.getItem(STORAGE_KEYS.ASSESSMENT_ANSWERS);
            if (answersData) {
                try {
                    this.answers = JSON.parse(answersData);
                } catch (error) {
                    console.error('Error parsing answers:', error);
                }
            }

            // Load progress
            const progressData = localStorage.getItem(STORAGE_KEYS.ASSESSMENT_PROGRESS);
            if (progressData) {
                try {
                    this.progress = JSON.parse(progressData);
                } catch (error) {
                    console.error('Error parsing progress:', error);
                }
            }

            this.initialized = true;
        },

        /**
         * Save respondent profile
         */
        saveRespondentProfile(profile: RespondentProfile) {
            const now = Date.now();
            const profileWithTimestamp = {
                ...profile,
                updatedAt: now,
                createdAt: profile.createdAt || now
            };

            this.respondentProfile = profileWithTimestamp;
            localStorage.setItem(STORAGE_KEYS.RESPONDENT_PROFILE, JSON.stringify(profileWithTimestamp));
        },

        /**
         * Save or update an answer
         */
        saveAnswer(questionId: string, index: AnswerIndex) {
            const answer: Answer = {
                questionId,
                index,
                updatedAt: Date.now()
            };

            this.answers[questionId] = answer;
            localStorage.setItem(STORAGE_KEYS.ASSESSMENT_ANSWERS, JSON.stringify(this.answers));
        },

        /**
         * Update current progress position
         */
        updateProgress(domainId: string, categoryId: string, subCategoryId: string, page: number) {
            this.progress = {
                currentDomainId: domainId,
                currentCategoryId: categoryId,
                currentSubCategoryId: subCategoryId,
                currentPage: page,
                lastUpdated: Date.now()
            };

            localStorage.setItem(STORAGE_KEYS.ASSESSMENT_PROGRESS, JSON.stringify(this.progress));
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
         * Clear all data (for testing/reset)
         */
        clearAll() {
            this.respondentProfile = null;
            this.answers = {};
            this.progress = {
                currentDomainId: 'identifikasi',
                currentCategoryId: 'governance-risk-mgmt',
                currentSubCategoryId: 'security-policies',
                currentPage: 1,
                lastUpdated: Date.now()
            };

            localStorage.removeItem(STORAGE_KEYS.RESPONDENT_PROFILE);
            localStorage.removeItem(STORAGE_KEYS.ASSESSMENT_ANSWERS);
            localStorage.removeItem(STORAGE_KEYS.ASSESSMENT_PROGRESS);
        }
    }
});
