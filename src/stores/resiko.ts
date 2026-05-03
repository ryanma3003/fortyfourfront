import { defineStore } from 'pinia';
import type {
    RespondentProfile,
    AnswerMap,
    Answer,
    AssessmentProgress
} from '@/types/assessment.types';
import { resikoData, getTotalRiskQuestionCount } from '@/data/assessment/resiko-data';
import { resikoService, type SurveyRiskResponse } from '@/services/resiko.service';

const STORAGE_KEYS = {
    RESIKO_RESPONDENT_PROFILES: 'resiko_respondent_profiles_map',
    RESIKO_ANSWERS: 'resiko_answers_map',
    RESIKO_PROGRESS: 'resiko_progress_map'
};

const createDefaultProgress = (): AssessmentProgress => ({
    currentDomainId: 'risk-survey',
    currentCategoryId: 'identifikasi-aset',
    currentSubCategoryId: 'klasifikasi-aset',
    currentPage: 1,
    status: 'IN_PROGRESS',
    lastUpdated: Date.now()
});

export const useResikoStore = defineStore('resiko', {
    state: () => ({
        currentStakeholderSlug: '' as string,
        respondentProfilesMap: {} as Record<string, RespondentProfile>,
        answersMap: {} as Record<string, AnswerMap>,
        progressMap: {} as Record<string, AssessmentProgress>,
        surveyResultsMap: {} as Record<string, SurveyRiskResponse>,
        surveyResultLoading: false,
        surveyResultError: null as string | null,
        resikoVersion: 0, // Signal for reactivity
        initialized: false
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
            if (!this.currentStakeholderSlug) return createDefaultProgress();
            return this.progressMap[this.currentStakeholderSlug] || createDefaultProgress();
        },

        hasRespondentProfile(): boolean {
            return this.respondentProfile !== null;
        },

        totalQuestions: () => getTotalRiskQuestionCount(),

        answeredQuestions(): number {
            return Object.values(this.answers).length;
        },

        completionPercentage(): number {
            const total = this.totalQuestions;
            const answered = this.answeredQuestions;
            return total > 0 ? Math.round((answered / total) * 100) : 0;
        },

        currentDomain(): any {
            const progress = this.progress;
            return resikoData.domains.find(d => d.id === progress.currentDomainId);
        },

        currentCategory(): any {
            const domain = this.currentDomain;
            const progress = this.progress;
            return domain?.categories.find((c: any) => c.id === progress.currentCategoryId);
        },

        currentSubCategory(): any {
            const category = this.currentCategory;
            const progress = this.progress;
            return category?.subCategories.find((sc: any) => sc.id === progress.currentSubCategoryId);
        },

        currentPageQuestions(): any[] {
            const subCategory = this.currentSubCategory;
            if (!subCategory) return [];

            const progress = this.progress;
            const questionsPerPage = 5;
            const startIndex = (progress.currentPage - 1) * questionsPerPage;
            return subCategory.questions.slice(startIndex, startIndex + questionsPerPage);
        },

        totalPagesInSubCategory(): number {
            const subCategory = this.currentSubCategory;
            if (!subCategory) return 0;
            return Math.ceil(subCategory.questions.length / 5);
        },

        isCompleted(): boolean {
            return this.progress.status === 'COMPLETED';
        },

        currentSurveyResult(): SurveyRiskResponse | null {
            if (!this.currentStakeholderSlug) return null;
            return this.surveyResultsMap[this.currentStakeholderSlug] || null;
        }
    },

    actions: {
        setCurrentStakeholder(slug: string) {
            this.currentStakeholderSlug = slug;
            if (!this.answersMap[slug]) this.answersMap[slug] = {};
            if (!this.progressMap[slug]) this.progressMap[slug] = createDefaultProgress();
        },

        saveAnswer(questionId: string, index: number) {
            if (!this.currentStakeholderSlug) return;
            
            this.answersMap[this.currentStakeholderSlug][questionId] = {
                questionId,
                index,
                updatedAt: Date.now()
            };
            
            this.progressMap[this.currentStakeholderSlug].lastUpdated = Date.now();
            this.saveToDisk();
        },

        saveRespondentProfile(profile: RespondentProfile) {
            if (!this.currentStakeholderSlug) return;
            this.respondentProfilesMap[this.currentStakeholderSlug] = profile;
            this.saveToDisk();
        },

        async loadSurveyResult(stakeholderId: string | number, slug = this.currentStakeholderSlug) {
            if (!stakeholderId || !slug) return null;

            this.surveyResultLoading = true;
            this.surveyResultError = null;

            try {
                const result = await resikoService.getSurveyByRespondentOrCompanyId(stakeholderId);
                this.surveyResultsMap[slug] = result;

                if (result.respondent) {
                    const respondent = result.respondent;
                    const existing = this.respondentProfilesMap[slug];
                    this.respondentProfilesMap[slug] = {
                        instansi: respondent.instansi || respondent.nama_perusahaan || existing?.instansi || '',
                        sektor: respondent.sektor || existing?.sektor || '',
                        alamat: respondent.alamat || existing?.alamat || '',
                        email: respondent.email || existing?.email || '',
                        namaResponden: respondent.responden || respondent.nama_responden || respondent.namaResponden || existing?.namaResponden || '',
                        jabatanResponden: respondent.jabatan || respondent.jabatan_responden || respondent.jabatanResponden || existing?.jabatanResponden || '',
                        nomorTelepon: respondent.telepon || respondent.nomor_telepon || respondent.nomorTelepon || existing?.nomorTelepon || '',
                        tahunPengukuran: respondent.tanggal ? new Date(respondent.tanggal).getFullYear().toString() : existing?.tahunPengukuran || new Date().getFullYear().toString(),
                        targetLevel: Number(respondent.target_level || existing?.targetLevel || 0),
                        targetNilai: String(respondent.target_nilai || existing?.targetNilai || ''),
                        acuan: respondent.acuan || existing?.acuan || '',
                        tanggalPengisian: respondent.tanggal ? String(respondent.tanggal).split('T')[0] : existing?.tanggalPengisian || '',
                        createdAt: existing?.createdAt || Date.now(),
                        updatedAt: Date.now(),
                    };
                    this.saveToDisk();
                }

                return result;
            } catch (error: any) {
                this.surveyResultError = error?.message || 'Gagal memuat hasil survey risiko';
                return null;
            } finally {
                this.surveyResultLoading = false;
            }
        },

        completeAssessment() {
            if (!this.currentStakeholderSlug) return;
            this.progressMap[this.currentStakeholderSlug].status = 'COMPLETED';
            this.saveToDisk();
        },

        initialize() {
            if (this.initialized) return;

            try {
                const profiles = localStorage.getItem(STORAGE_KEYS.RESIKO_RESPONDENT_PROFILES);
                const answers = localStorage.getItem(STORAGE_KEYS.RESIKO_ANSWERS);
                const progress = localStorage.getItem(STORAGE_KEYS.RESIKO_PROGRESS);

                if (profiles) this.respondentProfilesMap = JSON.parse(profiles);
                if (answers) this.answersMap = JSON.parse(answers);
                if (progress) this.progressMap = JSON.parse(progress);
            } catch (e) {
                console.error('Failed to load risk survey data', e);
            }

            this.initialized = true;
        },

        saveToDisk() {
            localStorage.setItem(STORAGE_KEYS.RESIKO_RESPONDENT_PROFILES, JSON.stringify(this.respondentProfilesMap));
            localStorage.setItem(STORAGE_KEYS.RESIKO_ANSWERS, JSON.stringify(this.answersMap));
            localStorage.setItem(STORAGE_KEYS.RESIKO_PROGRESS, JSON.stringify(this.progressMap));
        },

        goToNextPage() {
            const progress = this.progress;
            if (progress.currentPage < this.totalPagesInSubCategory) {
                progress.currentPage++;
            } else {
                // Move to next subcategory/category logic
                this.moveToNextSection();
            }
            this.saveToDisk();
        },

        moveToNextSection() {
            const domain = this.currentDomain;
            if (!domain) return;

            const category = this.currentCategory;
            const subCategory = this.currentSubCategory;
            if (!category || !subCategory) return;

            const catIndex = domain.categories.findIndex((c: any) => c.id === category.id);
            const subIndex = category.subCategories.findIndex((s: any) => s.id === subCategory.id);

            if (subIndex < category.subCategories.length - 1) {
                this.progress.currentSubCategoryId = category.subCategories[subIndex + 1].id;
                this.progress.currentPage = 1;
            } else if (catIndex < domain.categories.length - 1) {
                const nextCat = domain.categories[catIndex + 1];
                this.progress.currentCategoryId = nextCat.id;
                this.progress.currentSubCategoryId = nextCat.subCategories[0].id;
                this.progress.currentPage = 1;
            }
        }
    }
});
