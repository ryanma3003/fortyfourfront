import type { AssessmentData } from '@/types/assessment.types';

/**
 * IKAS Assessment Data Structure
 * Based on Excel format: Domain → Category → Sub-Category → Questions
 * Each domain has max 10 questions for demo purposes
 */

export const assessmentData: AssessmentData = {
    domains: [
        {
            id: 'identifikasi',
            name: 'IDENTIFIKASI',
            color: '#00a2e8', // Blue
            categories: [
                {
                    id: 'governance-risk-mgmt',
                    domainId: 'identifikasi',
                    name: 'Governance & Risk Management',
                    subCategories: [
                        {
                            id: 'security-policies',
                            categoryId: 'governance-risk-mgmt',
                            name: 'Security Policies',
                            questions: [
                                {
                                    id: 'ID-GR-SP-001',
                                    categoryId: 'governance-risk-mgmt',
                                    subCategoryId: 'security-policies',
                                    text: 'Apakah organisasi memiliki strategi keamanan informasi yang terdokumentasi dan selaras dengan tujuan bisnis?',
                                    scope: 'Tata Kelola',
                                    indexDescriptions: {
                                        0: 'Tidak ada strategi keamanan informasi',
                                        1: 'Strategi keamanan informasi informal dan tidak terdokumentasi',
                                        2: 'Strategi keamanan informasi terdokumentasi namun belum selaras dengan tujuan bisnis',
                                        3: 'Strategi keamanan informasi terdokumentasi dan selaras dengan tujuan bisnis',
                                        4: 'Strategi keamanan informasi dikelola secara aktif dan ditinjau secara berkala',
                                        5: 'Strategi keamanan informasi terintegrasi penuh dan secara proaktif disesuaikan dengan perubahan lingkungan bisnis'
                                    }
                                },
                                {
                                    id: 'ID-GR-SP-002',
                                    categoryId: 'governance-risk-mgmt',
                                    subCategoryId: 'security-policies',
                                    text: 'Apakah kebijakan keamanan informasi telah didokumentasikan, disetujui, dan dikomunikasikan secara formal?',
                                    scope: 'Tata Kelola',
                                    indexDescriptions: {
                                        0: 'Tidak ada kebijakan keamanan informasi',
                                        1: 'Kebijakan keamanan informasi informal tanpa dokumentasi',
                                        2: 'Kebijakan keamanan informasi terdokumentasi namun belum disetujui secara formal',
                                        3: 'Kebijakan keamanan informasi terdokumentasi, disetujui, dan dikomunikasikan',
                                        4: 'Kebijakan keamanan informasi dikelola dan ditinjau secara berkala',
                                        5: 'Kebijakan keamanan informasi terintegrasi dengan kebijakan organisasi dan diperbarui secara proaktif'
                                    }
                                }
                            ]
                        },
                        {
                            id: 'risk-assessment',
                            categoryId: 'governance-risk-mgmt',
                            name: 'Risk Assessment',
                            questions: [
                                {
                                    id: 'ID-GR-RA-001',
                                    categoryId: 'governance-risk-mgmt',
                                    subCategoryId: 'risk-assessment',
                                    text: 'Apakah organisasi melakukan penilaian risiko keamanan siber secara berkala?',
                                    scope: 'Tata Kelola',
                                    indexDescriptions: {
                                        0: 'Tidak ada penilaian risiko keamanan siber',
                                        1: 'Penilaian risiko dilakukan secara ad-hoc tanpa metodologi formal',
                                        2: 'Penilaian risiko dilakukan dengan metodologi formal namun tidak berkala',
                                        3: 'Penilaian risiko dilakukan secara berkala dengan metodologi yang terdefinisi',
                                        4: 'Penilaian risiko terintegrasi dengan manajemen risiko organisasi dan ditinjau secara berkala',
                                        5: 'Penilaian risiko dilakukan secara berkelanjutan dengan pendekatan proaktif dan prediktif'
                                    }
                                },
                                {
                                    id: 'ID-GR-RA-002',
                                    categoryId: 'governance-risk-mgmt',
                                    subCategoryId: 'risk-assessment',
                                    text: 'Apakah hasil penilaian risiko didokumentasikan dan dikomunikasikan kepada pemangku kepentingan?',
                                    scope: 'Tata Kelola',
                                    indexDescriptions: {
                                        0: 'Tidak ada dokumentasi penilaian risiko',
                                        1: 'Hasil penilaian risiko didokumentasikan secara informal',
                                        2: 'Hasil penilaian risiko didokumentasikan namun komunikasi terbatas',
                                        3: 'Hasil penilaian risiko didokumentasikan dan dikomunikasikan kepada pemangku kepentingan terkait',
                                        4: 'Hasil penilaian risiko dikelola dengan baik dan ditindaklanjuti secara teratur',
                                        5: 'Hasil penilaian risiko terintegrasi dengan sistem manajemen risiko organisasi dan mendorong inovasi keamanan'
                                    }
                                }
                            ]
                        }
                    ]
                },
                {
                    id: 'asset-management',
                    domainId: 'identifikasi',
                    name: 'Asset Management',
                    subCategories: [
                        {
                            id: 'asset-inventory',
                            categoryId: 'asset-management',
                            name: 'Asset Inventory',
                            questions: [
                                {
                                    id: 'ID-AM-AI-001',
                                    categoryId: 'asset-management',
                                    subCategoryId: 'asset-inventory',
                                    text: 'Apakah organisasi memiliki inventaris aset informasi yang lengkap dan terkini?',
                                    scope: 'Teknologi',
                                    indexDescriptions: {
                                        0: 'Tidak ada inventaris aset informasi',
                                        1: 'Inventaris aset informasi tidak lengkap dan tidak terpelihara',
                                        2: 'Inventaris aset informasi ada namun tidak lengkap atau tidak terkini',
                                        3: 'Inventaris aset informasi lengkap dan diperbarui secara berkala',
                                        4: 'Inventaris aset informasi dikelola secara aktif dengan sistem otomatis',
                                        5: 'Inventaris aset informasi terintegrasi penuh dengan sistem manajemen aset organisasi dan real-time'
                                    }
                                },
                                {
                                    id: 'ID-AM-AI-002',
                                    categoryId: 'asset-management',
                                    subCategoryId: 'asset-inventory',
                                    text: 'Apakah setiap aset informasi memiliki pemilik yang bertanggung jawab?',
                                    scope: 'Tata Kelola',
                                    indexDescriptions: {
                                        0: 'Tidak ada penugasan kepemilikan aset',
                                        1: 'Kepemilikan aset tidak jelas atau informal',
                                        2: 'Kepemilikan aset ditentukan namun tidak terdokumentasi dengan baik',
                                        3: 'Setiap aset memiliki pemilik yang jelas dan terdokumentasi',
                                        4: 'Kepemilikan aset dikelola dengan baik dan ditinjau secara berkala',
                                        5: 'Kepemilikan aset terintegrasi dengan framework tata kelola organisasi'
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'proteksi',
            name: 'PROTEKSI',
            color: '#8e44ad', // Purple
            categories: [
                {
                    id: 'access-control',
                    domainId: 'proteksi',
                    name: 'Identity & Access Management',
                    subCategories: [
                        {
                            id: 'authentication',
                            categoryId: 'access-control',
                            name: 'Authentication',
                            questions: [
                                {
                                    id: 'PR-AC-AU-001',
                                    categoryId: 'access-control',
                                    subCategoryId: 'authentication',
                                    text: 'Apakah organisasi menerapkan mekanisme autentikasi yang kuat untuk akses sistem?',
                                    scope: 'Teknologi',
                                    indexDescriptions: {
                                        0: 'Tidak ada mekanisme autentikasi',
                                        1: 'Autentikasi sederhana dengan password lemah',
                                        2: 'Autentikasi dengan password yang memenuhi standar minimum',
                                        3: 'Autentikasi multi-faktor untuk sistem kritis',
                                        4: 'Autentikasi multi-faktor untuk semua sistem dengan monitoring aktif',
                                        5: 'Autentikasi adaptif berbasis risiko dengan teknologi terkini (biometrik, zero-trust)'
                                    }
                                },
                                {
                                    id: 'PR-AC-AU-002',
                                    categoryId: 'access-control',
                                    subCategoryId: 'authentication',
                                    text: 'Apakah terdapat proses manajemen identitas pengguna yang terdokumentasi?',
                                    scope: 'Tata Kelola',
                                    indexDescriptions: {
                                        0: 'Tidak ada proses manajemen identitas',
                                        1: 'Proses manajemen identitas informal dan ad-hoc',
                                        2: 'Proses manajemen identitas terdokumentasi namun tidak konsisten',
                                        3: 'Proses manajemen identitas terdokumentasi dan diterapkan secara konsisten',
                                        4: 'Proses manajemen identitas terotomasi dan ditinjau secara berkala',
                                        5: 'Proses manajemen identitas terintegrasi penuh dengan HR dan sistem lainnya secara otomatis'
                                    }
                                }
                            ]
                        },
                        {
                            id: 'authorization',
                            categoryId: 'access-control',
                            name: 'Authorization',
                            questions: [
                                {
                                    id: 'PR-AC-AZ-001',
                                    categoryId: 'access-control',
                                    subCategoryId: 'authorization',
                                    text: 'Apakah akses ke sistem dan data dibatasi berdasarkan prinsip least privilege?',
                                    scope: 'Teknologi',
                                    indexDescriptions: {
                                        0: 'Tidak ada pembatasan akses',
                                        1: 'Pembatasan akses minimal dan tidak terkelola',
                                        2: 'Pembatasan akses diterapkan namun tidak konsisten',
                                        3: 'Prinsip least privilege diterapkan secara konsisten',
                                        4: 'Least privilege diterapkan dengan review akses berkala dan otomatis',
                                        5: 'Least privilege terintegrasi dengan zero-trust architecture dan monitoring real-time'
                                    }
                                }
                            ]
                        }
                    ]
                },
                {
                    id: 'data-protection',
                    domainId: 'proteksi',
                    name: 'Data Protection',
                    subCategories: [
                        {
                            id: 'data-encryption',
                            categoryId: 'data-protection',
                            name: 'Data Encryption',
                            questions: [
                                {
                                    id: 'PR-DP-DE-001',
                                    categoryId: 'data-protection',
                                    subCategoryId: 'data-encryption',
                                    text: 'Apakah data sensitif dienkripsi saat transit dan saat disimpan?',
                                    scope: 'Teknologi',
                                    indexDescriptions: {
                                        0: 'Tidak ada enkripsi data',
                                        1: 'Enkripsi diterapkan secara terbatas dan tidak konsisten',
                                        2: 'Enkripsi diterapkan untuk sebagian data sensitif',
                                        3: 'Enkripsi diterapkan untuk semua data sensitif at rest dan in transit',
                                        4: 'Enkripsi dikelola dengan baik menggunakan key management system',
                                        5: 'Enkripsi end-to-end dengan hardware security modules dan quantum-safe algorithms'
                                    }
                                },
                                {
                                    id: 'PR-DP-DE-002',
                                    categoryId: 'data-protection',
                                    subCategoryId: 'data-encryption',
                                    text: 'Apakah terdapat kebijakan dan prosedur pengelolaan kunci enkripsi?',
                                    scope: 'Tata Kelola',
                                    indexDescriptions: {
                                        0: 'Tidak ada pengelolaan kunci enkripsi',
                                        1: 'Pengelolaan kunci enkripsi informal tanpa dokumentasi',
                                        2: 'Kebijakan pengelolaan kunci ada namun tidak lengkap',
                                        3: 'Kebijakan dan prosedur pengelolaan kunci terdokumentasi dan diterapkan',
                                        4: 'Pengelolaan kunci menggunakan sistem otomatis dengan audit trail',
                                        5: 'Pengelolaan kunci terintegrasi dengan HSM dan compliance framework'
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'deteksi',
            name: 'DETEKSI',
            color: '#f39c12', // Orange
            categories: [
                {
                    id: 'continuous-monitoring',
                    domainId: 'deteksi',
                    name: 'Continuous Monitoring',
                    subCategories: [
                        {
                            id: 'security-monitoring',
                            categoryId: 'continuous-monitoring',
                            name: 'Security Monitoring',
                            questions: [
                                {
                                    id: 'DE-CM-SM-001',
                                    categoryId: 'continuous-monitoring',
                                    subCategoryId: 'security-monitoring',
                                    text: 'Apakah organisasi memiliki sistem monitoring keamanan yang beroperasi secara berkelanjutan?',
                                    scope: 'Teknologi',
                                    indexDescriptions: {
                                        0: 'Tidak ada sistem monitoring keamanan',
                                        1: 'Monitoring keamanan dilakukan secara manual dan tidak teratur',
                                        2: 'Sistem monitoring dasar tersedia namun tidak komprehensif',
                                        3: 'Sistem monitoring keamanan komprehensif beroperasi 24/7',
                                        4: 'Monitoring keamanan terintegrasi dengan SIEM dan response automation',
                                        5: 'Monitoring keamanan menggunakan AI/ML untuk deteksi anomali dan threat intelligence'
                                    }
                                },
                                {
                                    id: 'DE-CM-SM-002',
                                    categoryId: 'continuous-monitoring',
                                    subCategoryId: 'security-monitoring',
                                    text: 'Apakah log keamanan dikumpulkan, dianalisis, dan dipertahankan sesuai kebijakan?',
                                    scope: 'Teknologi',
                                    indexDescriptions: {
                                        0: 'Tidak ada pengumpulan log keamanan',
                                        1: 'Log keamanan dikumpulkan namun tidak dianalisis',
                                        2: 'Log keamanan dikumpulkan dan dianalisis secara ad-hoc',
                                        3: 'Log keamanan dikumpulkan, dianalisis, dan dipertahankan sesuai kebijakan',
                                        4: 'Log management terotomasi dengan retention policy dan analisis berkala',
                                        5: 'Log management terintegrasi penuh dengan SIEM, threat hunting, dan forensik digital'
                                    }
                                }
                            ]
                        }
                    ]
                },
                {
                    id: 'incident-detection',
                    domainId: 'deteksi',
                    name: 'Incident Detection',
                    subCategories: [
                        {
                            id: 'anomaly-detection',
                            categoryId: 'incident-detection',
                            name: 'Anomaly Detection',
                            questions: [
                                {
                                    id: 'DE-ID-AD-001',
                                    categoryId: 'incident-detection',
                                    subCategoryId: 'anomaly-detection',
                                    text: 'Apakah organisasi memiliki kemampuan untuk mendeteksi anomali dan peristiwa keamanan?',
                                    scope: 'Teknologi',
                                    indexDescriptions: {
                                        0: 'Tidak ada kemampuan deteksi anomali',
                                        1: 'Deteksi anomali manual dan tidak sistematis',
                                        2: 'Kemampuan deteksi anomali dasar dengan false positive tinggi',
                                        3: 'Kemampuan deteksi anomali yang efektif dengan false positive terkendali',
                                        4: 'Deteksi anomali otomatis dengan machine learning dan tuning berkala',
                                        5: 'Deteksi anomali proaktif menggunakan behavioral analytics dan threat intelligence'
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'pulih',
            name: 'PENANGGULANGAN & PEMULIHAN',
            color: '#2ecc71', // Green
            categories: [
                {
                    id: 'incident-response',
                    domainId: 'pulih',
                    name: 'Incident Response',
                    subCategories: [
                        {
                            id: 'response-planning',
                            categoryId: 'incident-response',
                            name: 'Response Planning',
                            questions: [
                                {
                                    id: 'RS-IR-RP-001',
                                    categoryId: 'incident-response',
                                    subCategoryId: 'response-planning',
                                    text: 'Apakah organisasi memiliki rencana respons insiden siber yang terdokumentasi?',
                                    scope: 'Tata Kelola',
                                    indexDescriptions: {
                                        0: 'Tidak ada rencana respons insiden',
                                        1: 'Rencana respons insiden informal tanpa dokumentasi',
                                        2: 'Rencana respons insiden terdokumentasi namun tidak lengkap',
                                        3: 'Rencana respons insiden komprehensif, terdokumentasi, dan dikomunikasikan',
                                        4: 'Rencana respons insiden diuji secara berkala dan diperbaharui',
                                        5: 'Rencana respons insiden terintegrasi dengan business continuity dan dilatih secara rutin'
                                    }
                                },
                                {
                                    id: 'RS-IR-RP-002',
                                    categoryId: 'incident-response',
                                    subCategoryId: 'response-planning',
                                    text: 'Apakah tim respons insiden telah dibentuk dengan peran dan tanggung jawab yang jelas?',
                                    scope: 'Sumber Daya Manusia',
                                    indexDescriptions: {
                                        0: 'Tidak ada tim respons insiden',
                                        1: 'Tim respons insiden informal tanpa peran yang jelas',
                                        2: 'Tim respons insiden dibentuk namun peran tidak terdefinisi dengan baik',
                                        3: 'Tim respons insiden dengan peran dan tanggung jawab yang jelas',
                                        4: 'Tim respons insiden terlatih dengan prosedur eskalasi yang terdefinisi',
                                        5: 'Tim respons insiden tersertifikasi dengan koordinasi eksternal (CSIRT, law enforcement)'
                                    }
                                }
                            ]
                        }
                    ]
                },
                {
                    id: 'recovery',
                    domainId: 'pulih',
                    name: 'Recovery',
                    subCategories: [
                        {
                            id: 'business-continuity',
                            categoryId: 'recovery',
                            name: 'Business Continuity',
                            questions: [
                                {
                                    id: 'RS-RC-BC-001',
                                    categoryId: 'recovery',
                                    subCategoryId: 'business-continuity',
                                    text: 'Apakah organisasi memiliki rencana pemulihan bencana (disaster recovery plan)?',
                                    scope: 'Tata Kelola',
                                    indexDescriptions: {
                                        0: 'Tidak ada rencana pemulihan bencana',
                                        1: 'Rencana pemulihan bencana informal tanpa dokumentasi',
                                        2: 'Rencana pemulihan bencana terdokumentasi namun tidak diuji',
                                        3: 'Rencana pemulihan bencana terdokumentasi dan diuji secara berkala',
                                        4: 'Disaster recovery terotomasi dengan RTO/RPO yang terdefinisi',
                                        5: 'Disaster recovery terintegrasi penuh dengan high availability dan geo-redundancy'
                                    }
                                },
                                {
                                    id: 'RS-RC-BC-002',
                                    categoryId: 'recovery',
                                    subCategoryId: 'business-continuity',
                                    text: 'Apakah backup data dilakukan secara berkala dan diuji pemulihan nya?',
                                    scope: 'Teknologi',
                                    indexDescriptions: {
                                        0: 'Tidak ada backup data',
                                        1: 'Backup data dilakukan ad-hoc tanpa jadwal',
                                        2: 'Backup data terjadwal namun belum pernah diuji',
                                        3: 'Backup data terjadwal dan diuji pemulihan nya secara berkala',
                                        4: 'Backup otomatis dengan monitoring dan verifikasi integritas',
                                        5: 'Backup terotomasi penuh dengan immutable storage dan disaster recovery testing rutin'
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
};

/**
 * Helper function to get all questions from the assessment
 */
export function getAllQuestions() {
    const questions: any[] = [];
    assessmentData.domains.forEach(domain => {
        domain.categories.forEach(category => {
            category.subCategories.forEach(subCategory => {
                questions.push(...subCategory.questions);
            });
        });
    });
    return questions;
}

/**
 * Helper function to get total question count
 */
export function getTotalQuestionCount(): number {
    return getAllQuestions().length;
}

/**
 * Helper function to get questions by domain
 */
export function getQuestionsByDomain(domainId: string) {
    const domain = assessmentData.domains.find(d => d.id === domainId);
    if (!domain) return [];

    const questions: any[] = [];
    domain.categories.forEach(category => {
        category.subCategories.forEach(subCategory => {
            questions.push(...subCategory.questions);
        });
    });
    return questions;
}
