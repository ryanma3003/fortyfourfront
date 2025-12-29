import { reactive, watchEffect } from 'vue';

export const ikasDataStatic = reactive({
    identifikasi: {
        peran_tanggung_jawab: 2.51,
        strategi_kebijakan: 2.51,
        aset_informasi: 2.51,
        risiko_keamanan: 2.51,
        rantai_pasok: 2.51,
    },
    proteksi: {
        identitas_autentikasi: 2.51,
        aset_fisik: 2.51,
        data: 2.51,
        aplikasi: 2.51,
        jaringan: 2.51,
        sdm: 2.51,
    },
    deteksi: {
        deteksi_peristiwa: 2.51,
        anomali_peristiwa: 2.51,
        pemantauan_berkelanjutan: 2.51,
    },
    gulih: {
        perencanaan_pemulihan: 2.51,
        analisis_pelaporan: 2.51,
        pelaksanaan_pemulihan: 2.51,
        peningkatan_keamanan: 2.51,
    }
});


export const getMaturityLabel = (score: number): string => {
    if (score <= 0) return "INPUT BELUM LENGKAP";
    if (score < 1.50) return "Level 1 - Awal";
    if (score < 2.50) return "Level 2 - Berulang";
    if (score < 3.50) return "Level 3 - Terdefinisi";
    if (score < 4.50) return "Level 4 - Terkelola";
    return "Level 5 - Inovatif";
};

export const ikasDataDynamic = reactive({
    total_rata_rata: 0,
    total_kategori: "INPUT BELUM LENGKAP",
    identifikasi: {
        id: 1,
        nilai_identifikasi: 0,
        kategori_identifikasi: "INPUT BELUM LENGKAP",
        nilai_subdomain1: 0,
        nilai_subdomain2: 0,
        nilai_subdomain3: 0,
        nilai_subdomain4: 0,
        nilai_subdomain5: 0,
    },
    proteksi: {
        id: 2,
        nilai_proteksi: 0,
        kategori_proteksi: "INPUT BELUM LENGKAP",
        nilai_subdomain1: 0,
        nilai_subdomain2: 0,
        nilai_subdomain3: 0,
        nilai_subdomain4: 0,
        nilai_subdomain5: 0,
        nilai_subdomain6: 0,
    },
    deteksi: {
        id: 3,
        nilai_deteksi: 0,
        kategori_deteksi: "INPUT BELUM LENGKAP",
        nilai_subdomain1: 0,
        nilai_subdomain2: 0,
        nilai_subdomain3: 0,
    },
    gulih: {
        id: 4,
        nilai_gulih: 0,
        kategori_gulih: "INPUT BELUM LENGKAP",
        nilai_subdomain1: 0,
        nilai_subdomain2: 0,
        nilai_subdomain3: 0,
        nilai_subdomain4: 0,
    }
});

watchEffect(() => {
    // Calculate averages per domain
    const iden = ikasDataDynamic.identifikasi;
    iden.nilai_identifikasi = Number(((iden.nilai_subdomain1 + iden.nilai_subdomain2 + iden.nilai_subdomain3 + iden.nilai_subdomain4 + iden.nilai_subdomain5) / 5).toFixed(2));
    iden.kategori_identifikasi = getMaturityLabel(iden.nilai_identifikasi);

    const prot = ikasDataDynamic.proteksi;
    prot.nilai_proteksi = Number(((prot.nilai_subdomain1 + prot.nilai_subdomain2 + prot.nilai_subdomain3 + prot.nilai_subdomain4 + prot.nilai_subdomain5 + prot.nilai_subdomain6) / 6).toFixed(2));
    prot.kategori_proteksi = getMaturityLabel(prot.nilai_proteksi);

    const det = ikasDataDynamic.deteksi;
    det.nilai_deteksi = Number(((det.nilai_subdomain1 + det.nilai_subdomain2 + det.nilai_subdomain3) / 3).toFixed(2));
    det.kategori_deteksi = getMaturityLabel(det.nilai_deteksi);

    const gul = ikasDataDynamic.gulih;
    gul.nilai_gulih = Number(((gul.nilai_subdomain1 + gul.nilai_subdomain2 + gul.nilai_gulih + gul.nilai_subdomain3 + gul.nilai_subdomain4) / 4).toFixed(2));
    // Wait, I found another bug in the 'gul' calculation above (summing gul.nilai_gulih). Re-fixing.
    gul.nilai_gulih = Number(((gul.nilai_subdomain1 + gul.nilai_subdomain2 + gul.nilai_subdomain3 + gul.nilai_subdomain4) / 4).toFixed(2));
    gul.kategori_gulih = getMaturityLabel(gul.nilai_gulih);

    // Calculate total average across domains
    ikasDataDynamic.total_rata_rata = Number(((iden.nilai_identifikasi + prot.nilai_proteksi + det.nilai_deteksi + gul.nilai_gulih) / 4).toFixed(2));
    ikasDataDynamic.total_kategori = getMaturityLabel(ikasDataDynamic.total_rata_rata);
});

