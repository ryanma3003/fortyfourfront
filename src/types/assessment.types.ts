// Assessment Type Definitions

export type QuestionScope = 'Tata Kelola' | 'Sumber Daya Manusia' | 'Teknologi';

export type AnswerIndex = 0 | 1 | 2 | 3 | 4 | 5;

export interface IndexDescription {
    [key: number]: string;
}

export interface Question {
    id: string;
    categoryId: string;
    subCategoryId: string;
    text: string;
    scope: QuestionScope;
    indexDescriptions: IndexDescription;
}

export interface SubCategory {
    id: string;
    categoryId: string;
    name: string;
    questions: Question[];
}

export interface Category {
    id: string;
    domainId: string;
    name: string;
    subCategories: SubCategory[];
}

export interface Domain {
    id: string;
    name: string;
    color: string; // For UI styling
    categories: Category[];
}

export interface AssessmentData {
    domains: Domain[];
}

// Answer storage
export interface Answer {
    questionId: string;
    index: number;
    updatedAt: number;
    backendSyncedAt?: number;
    backendSyncError?: string | null;
}

export interface AnswerMap {
    [questionId: string]: Answer;
}

// Progress tracking
export interface AssessmentProgress {
    currentDomainId: string;
    currentCategoryId: string;
    currentSubCategoryId: string;
    currentPage: number;
    status: 'IN_PROGRESS' | 'COMPLETED';
    lastUpdated: number;
}

// Respondent Profile
export interface RespondentProfile {
    instansi: string;          // dari stakeholder.nama_perusahaan (readonly)
    sektor: string;            // dari stakeholder.sub_sektor (readonly)
    alamat: string;            // dari stakeholder.alamat (readonly)
    email: string;             // dari stakeholder.email (readonly)
    namaResponden: string;     // input user → api: responden
    jabatanResponden: string;  // input user → api: jabatan
    nomorTelepon: string;      // input user → api: telepon
    tahunPengukuran: string;
    targetLevel: number;       // → api: target_nilai
    targetNilai: string;       // display range (e.g. "2.51-3.50")
    acuan: string;             // dikosongkan dulu
    tanggalPengisian: string;  // auto tanggal daftar/isi → api: tanggal
    createdAt: number;
    updatedAt: number;
}

// Calculation results (prepared for future use)
export interface SubCategoryResult {
    subCategoryId: string;
    average: number | null;
    totalQuestions: number;
    answeredQuestions: number;
}

export interface CategoryResult {
    categoryId: string;
    average: number | null;
    subCategoryResults: SubCategoryResult[];
}

export interface DomainResult {
    domainId: string;
    average: number | null;
    categoryResults: CategoryResult[];
}

export interface AssessmentResult {
    overallAverage: number | null;
    maturityLevel: string;
    domainResults: DomainResult[];
    totalQuestions: number;
    answeredQuestions: number;
    completionPercentage: number;
}
