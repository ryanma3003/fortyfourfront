import type { AssessmentData } from '@/types/assessment.types';

/**
 * Risk Assessment Data Structure (Survey Resiko)
 * 5 Categories: Aset, Ancaman, Kerentanan, Dampak, Peluang
 */

export const resikoData: AssessmentData = {
    domains: [
        {
            id: 'risk-survey',
            name: 'SURVEY RESIKO',
            color: '#6366f1', // Indigo
            categories: [
                {
                    id: 'identifikasi-aset',
                    domainId: 'risk-survey',
                    name: 'Identifikasi Aset dan Nilai Aset',
                    subCategories: [
                        {
                            id: 'klasifikasi-aset',
                            categoryId: 'identifikasi-aset',
                            name: 'Klasifikasi Aset',
                            questions: [
                                {
                                    id: 'RS-AS-001',
                                    categoryId: 'identifikasi-aset',
                                    subCategoryId: 'klasifikasi-aset',
                                    text: 'Apakah seluruh aset informasi kritis telah diidentifikasi dan diklasifikasikan?',
                                    scope: 'Tata Kelola',
                                    indexDescriptions: {
                                        0: 'Belum ada identifikasi aset',
                                        1: 'Identifikasi dilakukan secara ad-hoc',
                                        2: 'Hanya sebagian aset utama yang teridentifikasi',
                                        3: 'Seluruh aset kritis telah teridentifikasi',
                                        4: 'Inventaris aset diperbaharui secara berkala',
                                        5: 'Sistem manajemen aset otomatis terimplementasi'
                                    }
                                },
                                {
                                    id: 'RS-AS-002',
                                    categoryId: 'identifikasi-aset',
                                    subCategoryId: 'klasifikasi-aset',
                                    text: 'Sejauh mana organisasi menilai nilai/kritikalitas aset terhadap kelangsungan bisnis?',
                                    scope: 'Tata Kelola',
                                    indexDescriptions: {
                                        0: 'Tidak ada penilaian nilai aset',
                                        1: 'Penilaian nilai aset bersifat subyektif',
                                        2: 'Ada kriteria dasar penilaian nilai aset',
                                        3: 'Penilaian nilai aset berdasarkan kriteria CIA (Confidentiality, Integrity, Availability)',
                                        4: 'BIA (Business Impact Analysis) dilakukan berkala',
                                        5: 'Penilaian nilai aset terintegrasi dengan risk appetite pimpinan'
                                    }
                                }
                            ]
                        }
                    ]
                },
                {
                    id: 'analisis-ancaman',
                    domainId: 'risk-survey',
                    name: 'Analisis Ancaman dan Kerentanan',
                    subCategories: [
                        {
                            id: 'threat-vulnerability',
                            categoryId: 'analisis-ancaman',
                            name: 'Ancaman & Kerentanan',
                            questions: [
                                {
                                    id: 'RS-TH-001',
                                    categoryId: 'analisis-ancaman',
                                    subCategoryId: 'threat-vulnerability',
                                    text: 'Apakah organisasi secara aktif memantau ancaman siber yang relevan dengan industrinya?',
                                    scope: 'Teknologi',
                                    indexDescriptions: {
                                        0: 'Tidak ada pemantauan ancaman',
                                        1: 'Pemantauan hanya dari berita umum',
                                        2: 'Akses terbatas ke feed ancaman/bulletin',
                                        3: 'Threat intelligence monitoring dilakukan rutin',
                                        4: 'Berbagi informasi ancaman dengan pihak eksternal (BSSN/ISAC)',
                                        5: 'Threat hunting proactive dilakukan oleh tim internal'
                                    }
                                },
                                {
                                    id: 'RS-VU-001',
                                    categoryId: 'analisis-ancaman',
                                    subCategoryId: 'threat-vulnerability',
                                    text: 'Seberapa sering pemindaian kerentanan (Vulnerability Assessment) dilakukan pada sistem kritis?',
                                    scope: 'Teknologi',
                                    indexDescriptions: {
                                        0: 'Tidak pernah dilakukan pemindaian',
                                        1: 'Dilakukan jika ada masalah saja',
                                        2: 'Dilakukan 1 tahun sekali',
                                        3: 'Dilakukan berkala (minimal 6 bulan sekali)',
                                        4: 'Pemindaian otomatis dan rutin (mingguan/bulanan)',
                                        5: 'Continuous vulnerability management terimplementasi'
                                    }
                                }
                            ]
                        }
                    ]
                },
                {
                    id: 'mitigasi-kontrol',
                    domainId: 'risk-survey',
                    name: 'Efektivitas Kontrol Mitigasi',
                    subCategories: [
                        {
                            id: 'control-effectiveness',
                            categoryId: 'mitigasi-kontrol',
                            name: 'Efektivitas Kontrol',
                            questions: [
                                {
                                    id: 'RS-MT-001',
                                    categoryId: 'mitigasi-kontrol',
                                    subCategoryId: 'control-effectiveness',
                                    text: 'Apakah rencana mitigasi untuk risiko tinggi telah diimplementasikan sepenuhnya?',
                                    scope: 'Tata Kelola',
                                    indexDescriptions: {
                                        0: 'Belum ada rencana mitigasi',
                                        1: 'Mitigasi hanya pada level wacana',
                                        2: 'Mitigasi sedang dalam tahap perencanaan',
                                        3: 'Mitigasi telah diimplementasikan sebagian besar',
                                        4: 'Kontrol mitigasi teruji dan efektif',
                                        5: 'Kontrol adaptif terhadap perubahan lanskap risiko'
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

export const getTotalRiskQuestionCount = () => {
    let total = 0;
    resikoData.domains.forEach(d => {
        d.categories.forEach(c => {
            c.subCategories.forEach(sc => {
                total += sc.questions.length;
            });
        });
    });
    return total;
};
