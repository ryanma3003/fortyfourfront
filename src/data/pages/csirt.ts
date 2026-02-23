export interface csirtMember {
    id: number;
    id_perusahaan: number;
    nama: string;
    web_csirt: string;
    no_telepon: string;
    file_rfc2350: string;
    file_public_key_pgp: string;
    img_csirt: string;
}

export interface sdmCsirt {
    id: number;
    id_csirt: number;
    nama_personel: string;
    jabatan_csirt: string;
    jabatan_perusahaan: string;
    skill: string;
    sertifikasi: string;
}

export interface seCsirt {
    id: number;
    id_csirt: number;
    nama_se: string;
    ip_se: string;
    as_number_se: string;
    pengelola_se: string;
    fitur_se: string;
    kategori_se: string;
}

export const csirtMembersData: csirtMember[] = [
    {
        id: 1,
        id_perusahaan: 1,
        nama: "CSIRT Maju Jaya",
        no_telepon: "08123456789",
        web_csirt: "https://csirt.majujaya.co.id",
        file_rfc2350: "/files/csirt_majujaya_rfc2350.pdf",
        file_public_key_pgp: "/files/csirt_majujaya_pgp.asc",
        img_csirt: "/images/media/Gemini_Generated_Image_k641ivk641ivk641.png"
    },
    {
        id: 2,
        id_perusahaan: 2,
        nama: "CSIRT Berkah Sejahtera",
        no_telepon: "08123456789",
        web_csirt: "https://csirt.berkahsejahtera.com",
        file_rfc2350: "/files/csirt_berkahsejahtera_rfc2350.pdf",
        file_public_key_pgp: "/files/csirt_berkahsejahtera_pgp.asc",
        img_csirt: "/images/media/Gemini_Generated_Image_opvwxxopvwxxopvw.png"
    },
    {
        id: 3,
        id_perusahaan: 3,
        nama: "CSIRT Lestari",
        no_telepon: "08123456789",
        web_csirt: "https://csirt.lestari.id",
        file_rfc2350: "/files/csirt_lestari_rfc2350.pdf",
        file_public_key_pgp: "/files/csirt_lestari_pgp.asc",
        img_csirt: "/images/media/Gemini_Generated_Image_xibjxrxibjxrxibj.png"
    },
    {
        id: 4,
        id_perusahaan: 4,
        nama: "CSIRT Indo Digital",
        no_telepon: "08123456789",
        web_csirt: "https://csirt.indodigitalsolutions.com",
        file_rfc2350: "/files/csirt_indodigitalsolutions_rfc2350.pdf",
        file_public_key_pgp: "/files/csirt_indodigitalsolutions_pgp.asc",
        img_csirt: "/images/media/Gemini_Generated_Image_xibjxrxibjxrxibj.png"
    }
];
export const sdmCsirtData: sdmCsirt[] = [
    {
        id: 1,
        id_csirt: 1,
        nama_personel: "Andi Susanto",
        jabatan_csirt: "Incident Handler",
        jabatan_perusahaan: "IT Security Specialist",
        skill: "Malware Analysis, Network Security",
        sertifikasi: "CEH, CISSP",
    },
    {
        id: 2,
        id_csirt: 1,
        nama_personel: "Rina Wijaya",
        jabatan_csirt: "Security Analyst",
        jabatan_perusahaan: "Network Engineer",
        skill: "Penetration Testing, Network Security",
        sertifikasi: "OSCP, CCNA Security",
    },
    {
        id: 3,
        id_csirt: 1,
        nama_personel: "Andi Susanto",
        jabatan_csirt: "Incident Handler",
        jabatan_perusahaan: "IT Security Specialist",
        skill: "Malware Analysis, Network Security",
        sertifikasi: "CEH, CISSP",
    },
    {
        id: 4,
        id_csirt: 1,
        nama_personel: "Andi Susantop",
        jabatan_csirt: "Incident Handler",
        jabatan_perusahaan: "IT Security Specialist",
        skill: "Malware Analysis, Network Security",
        sertifikasi: "CEH, CISSP",
    },
    {
        id: 2,
        id_csirt: 2,
        nama_personel: "Budi Hartono",
        jabatan_csirt: "CSIRT Manager",
        jabatan_perusahaan: "IT Manager",
        skill: "Incident Response, Risk Management",
        sertifikasi: "CISM, ISO 27001 Lead Implementer",
    },
    {
        id: 3,
        id_csirt: 3,
        nama_personel: "Siti Aminah",
        jabatan_csirt: "Forensic Analyst",
        jabatan_perusahaan: "System Administrator",
        skill: "Digital Forensics, Log Analysis",
        sertifikasi: "GCFA, GCIH",
    },
    {
        id: 4,
        id_csirt: 4,
        nama_personel: "Dewi Sartika",
        jabatan_csirt: "Security Analyst",
        jabatan_perusahaan: "IT Specialist",
        skill: "Threat Intelligence, Vulnerability Assessment",
        sertifikasi: "CISSP, CEH",
    }
];

export const seCsirtData: seCsirt[] = [
    {
        id: 1,
        id_csirt: 1,
        nama_se: "Firewall Utama",
        ip_se: "192.168.1.1",
        as_number_se: "AS12345",
        pengelola_se: "PT Maju Jaya",
        fitur_se: "Firewall, Intrusion Detection",
        kategori_se: "Tinggi",
    },
    {
        id: 2,
        id_csirt: 2,
        nama_se: "Sistem Deteksi Intrusi",
        ip_se: "192.168.2.1",
        as_number_se: "AS67890",
        pengelola_se: "CV Berkah Sejahtera",
        fitur_se: "Intrusion Detection, Log Management",
        kategori_se: "Strategis",
    },
    {
        id: 3,
        id_csirt: 3,
        nama_se: "Endpoint Protection",
        ip_se: "192.168.3.1",
        as_number_se: "AS54321",
        pengelola_se: "PT Lestari",
        fitur_se: "Endpoint Detection, Malware Protection",
        kategori_se: "Tinggi",
    },
    {
        id: 4,
        id_csirt: 4,
        nama_se: "Sistem Deteksi Intrusi",
        ip_se: "192.168.2.1",
        as_number_se: "AS67890",
        pengelola_se: "PT Indo Digital Solutions",
        fitur_se: "Intrusion Detection, Log Management",
        kategori_se: "Rendah",
    }
];