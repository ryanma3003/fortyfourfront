/**
 * Mapping configuration between assessment categories and IKAS subdomains
 * 
 * This file defines how assessment answers should be aggregated into IKAS subdomain values
 */

export interface SubdomainMapping {
    domainId: string;
    categoryIds: string[];
    subCategoryIds: string[];
}

export interface DomainMapping {
    [subdomainKey: string]: SubdomainMapping;
}

export interface AssessmentIkasMapping {
    [ikasDomain: string]: DomainMapping;
}

/**
 * Mapping from IKAS subdomain keys to assessment subcategories
 * 
 * IKAS Domain Structure based on BSSN Framework:
 * - identifikasi: 5 subdomains (nilai_subdomain1 - nilai_subdomain5)
 * - proteksi: 6 subdomains (nilai_subdomain1 - nilai_subdomain6)  
 * - deteksi: 3 subdomains (nilai_subdomain1 - nilai_subdomain3)
 * - tanggulih: 4 subdomains (nilai_subdomain1 - nilai_subdomain4)
 */
export const assessmentToIkasMapping: AssessmentIkasMapping = {
    // ==================== IDENTIFIKASI ====================
    identifikasi: {
        // 1. Mengidentifikasi Peran dan tanggung jawab organisasi
        nilai_subdomain1: {
            domainId: 'identifikasi',
            categoryIds: ['peran-tanggung-jawab'],
            subCategoryIds: ['peran-keamanan']
        },
        // 2. Menyusun strategi, kebijakan, dan prosedur Keamanan Siber
        nilai_subdomain2: {
            domainId: 'identifikasi',
            categoryIds: ['strategi-kebijakan'],
            subCategoryIds: ['kebijakan-keamanan']
        },
        // 3. Mengelola aset informasi
        nilai_subdomain3: {
            domainId: 'identifikasi',
            categoryIds: ['aset-informasi'],
            subCategoryIds: ['inventaris-aset']
        },
        // 4. Menilai dan mengelola risiko Keamanan Siber
        nilai_subdomain4: {
            domainId: 'identifikasi',
            categoryIds: ['risiko-keamanan'],
            subCategoryIds: ['penilaian-risiko']
        },
        // 5. Mengelola risiko rantai pasok
        nilai_subdomain5: {
            domainId: 'identifikasi',
            categoryIds: ['risiko-rantai-pasok'],
            subCategoryIds: ['vendor-management']
        }
    },
    
    // ==================== PROTEKSI ====================
    proteksi: {
        // 1. Mengelola identitas, autentikasi, dan kendali akses
        nilai_subdomain1: {
            domainId: 'proteksi',
            categoryIds: ['identitas-akses'],
            subCategoryIds: ['autentikasi']
        },
        // 2. Melindungi aset fisik
        nilai_subdomain2: {
            domainId: 'proteksi',
            categoryIds: ['aset-fisik'],
            subCategoryIds: ['keamanan-fisik']
        },
        // 3. Melindungi data
        nilai_subdomain3: {
            domainId: 'proteksi',
            categoryIds: ['perlindungan-data'],
            subCategoryIds: ['enkripsi-data']
        },
        // 4. Melindungi aplikasi
        nilai_subdomain4: {
            domainId: 'proteksi',
            categoryIds: ['perlindungan-aplikasi'],
            subCategoryIds: ['keamanan-aplikasi']
        },
        // 5. Melindungi jaringan
        nilai_subdomain5: {
            domainId: 'proteksi',
            categoryIds: ['perlindungan-jaringan'],
            subCategoryIds: ['keamanan-jaringan']
        },
        // 6. Melindungi sumber daya manusia
        nilai_subdomain6: {
            domainId: 'proteksi',
            categoryIds: ['sdm-keamanan'],
            subCategoryIds: ['awareness-training']
        }
    },
    
    // ==================== DETEKSI ====================
    deteksi: {
        // 1. Mengelola deteksi Peristiwa Siber
        nilai_subdomain1: {
            domainId: 'deteksi',
            categoryIds: ['deteksi-peristiwa'],
            subCategoryIds: ['sistem-deteksi']
        },
        // 2. Menganalisis anomali dan Peristiwa Siber
        nilai_subdomain2: {
            domainId: 'deteksi',
            categoryIds: ['analisis-anomali'],
            subCategoryIds: ['analisis-peristiwa']
        },
        // 3. Memantau Peristiwa Siber berkelanjutan
        nilai_subdomain3: {
            domainId: 'deteksi',
            categoryIds: ['pemantauan-berkelanjutan'],
            subCategoryIds: ['monitoring-kontinyu']
        }
    },
    
    // ==================== PENANGGULANGAN & PEMULIHAN ====================
    tanggulih: {
        // 1. Menyusun perencanaan penanggulangan dan pemulihan Insiden Siber
        nilai_subdomain1: {
            domainId: 'tanggulih',
            categoryIds: ['perencanaan-tanggulih'],
            subCategoryIds: ['rencana-response']
        },
        // 2. Menganalisis dan melaporkan Insiden Siber
        nilai_subdomain2: {
            domainId: 'tanggulih',
            categoryIds: ['analisis-pelaporan'],
            subCategoryIds: ['pelaporan-insiden']
        },
        // 3. Melaksanakan penanggulangan dan pemulihan Insiden Siber
        nilai_subdomain3: {
            domainId: 'tanggulih',
            categoryIds: ['pelaksanaan-tanggulih'],
            subCategoryIds: ['containment-recovery']
        },
        // 4. Meningkatkan keamanan setelah terjadinya Insiden Siber
        nilai_subdomain4: {
            domainId: 'tanggulih',
            categoryIds: ['peningkatan-keamanan'],
            subCategoryIds: ['lesson-learned']
        }
    }
};

/**
 * Get all question IDs that should contribute to a specific IKAS subdomain
 */
export function getQuestionIdsForSubdomain(
    ikasDomain: string, 
    subdomainKey: string,
    assessmentData: any
): string[] {
    const mapping = assessmentToIkasMapping[ikasDomain]?.[subdomainKey];
    if (!mapping) return [];

    const questionIds: string[] = [];
    
    const domain = assessmentData.domains.find((d: any) => d.id === mapping.domainId);
    if (!domain) return [];

    domain.categories.forEach((category: any) => {
        if (mapping.categoryIds.includes(category.id)) {
            category.subCategories.forEach((subCategory: any) => {
                if (mapping.subCategoryIds.includes(subCategory.id)) {
                    subCategory.questions.forEach((question: any) => {
                        questionIds.push(question.id);
                    });
                }
            });
        }
    });

    return questionIds;
}

/**
 * Calculate average score from assessment answers for a specific subdomain
 * Returns:
 * - number: The average score
 * - 'NA': All questions are marked as Not Applicable
 * - null: No answers yet
 */
export function calculateSubdomainScore(
    questionIds: string[],
    answers: Record<string, { index: number | string }>
): number | 'NA' | null {
    const scores: number[] = [];
    let naCount = 0;
    let answeredCount = 0;
    
    questionIds.forEach(qId => {
        const answer = answers[qId];
        if (answer && answer.index !== undefined) {
            answeredCount++;
            if (answer.index === 'NA') {
                naCount++;
            } else {
                const indexNum = typeof answer.index === 'string' ? parseInt(answer.index, 10) : answer.index;
                if (!isNaN(indexNum) && indexNum >= 0) {
                    scores.push(indexNum);
                }
            }
        }
    });

    // No answers at all
    if (answeredCount === 0) return null;
    
    // All answered questions are N/A
    if (naCount === answeredCount && naCount > 0) return 'NA';
    
    // Some valid scores
    if (scores.length === 0) return null;
    
    const sum = scores.reduce((a, b) => a + b, 0);
    return Number((sum / scores.length).toFixed(2));
}

/**
 * Get subdomain names for display
 */
export const subdomainNames: Record<string, Record<string, string>> = {
    identifikasi: {
        nilai_subdomain1: 'Peran dan Tanggung Jawab Organisasi',
        nilai_subdomain2: 'Strategi, Kebijakan, dan Prosedur',
        nilai_subdomain3: 'Pengelolaan Aset Informasi',
        nilai_subdomain4: 'Penilaian Risiko Keamanan Siber',
        nilai_subdomain5: 'Risiko Rantai Pasok'
    },
    proteksi: {
        nilai_subdomain1: 'Identitas dan Kendali Akses',
        nilai_subdomain2: 'Perlindungan Aset Fisik',
        nilai_subdomain3: 'Perlindungan Data',
        nilai_subdomain4: 'Perlindungan Aplikasi',
        nilai_subdomain5: 'Perlindungan Jaringan',
        nilai_subdomain6: 'Sumber Daya Manusia'
    },
    deteksi: {
        nilai_subdomain1: 'Deteksi Peristiwa Siber',
        nilai_subdomain2: 'Analisis Anomali',
        nilai_subdomain3: 'Pemantauan Berkelanjutan'
    },
    tanggulih: {
        nilai_subdomain1: 'Perencanaan Penanggulangan',
        nilai_subdomain2: 'Analisis dan Pelaporan',
        nilai_subdomain3: 'Pelaksanaan Penanggulangan',
        nilai_subdomain4: 'Peningkatan Keamanan'
    }
};
