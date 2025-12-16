// src/data/dummydata.ts

export interface Stakeholder {
    id: number;
    slug: string;
    photo?: string;
    nama_perusahaan: string;
    sektor: string;
    alamat: string;
    telepon: string;
    email: string;
    website: string;
}

import { reactive } from 'vue';

export const stakeholdersData: Stakeholder[] = reactive([
    {
        id: 1,
        slug: "pt-maju-jaya-teknologi",
        photo: "/images/media/Gemini_Generated_Image_k641ivk641ivk641.png",
        nama_perusahaan: "PT Maju Jaya Teknologi",
        sektor: "Teknologi Informasi",
        email: "info@majujaya.co.id",
        alamat: "Jakarta, Indonesia",
        telepon: "+62 21 1234 5678",
        website: "https://majujaya.co.id",
    },
    {
        id: 2,  
        slug: "cv-berkah-sejahtera",
        photo: "/images/media/Gemini_Generated_Image_opvwxxopvwxxopvw.png",
        nama_perusahaan: "CV Berkah Sejahtera",
        sektor: "Perdagangan Umum",
        email: "contact@berkahsejahtera.com",
        alamat: "Surabaya, Indonesia",
        telepon: "+62 31 9876 5432",
        website: "https://berkahsejahtera.com",
    },
    {
        id: 3,
        slug: "pt-indo-digital-solutions",
        photo: "/images/media/Gemini_Generated_Image_xibjxrxibjxrxibj.png",
        nama_perusahaan: "PT Indo Digital Solutions",
        sektor: "Software Development",
        email: "hello@indodigital.id",
        alamat: "Bandung, Indonesia",
        telepon: "+62 22 5555 6666",
        website: "https://indodigital.id",
    },
    {   
        id: 4,
        slug: "pt-karya-mandiri",
        photo: "/images/media/Gemini_Generated_Image_l1penkl1penkl1pe.png",
        nama_perusahaan: "PT Karya Mandiri",
        sektor: "Konstruksi",
        email: "info@karyamandiri.co.id",
        alamat: "Medan, Indonesia",
        telepon: "+62 61 4444 3333",
        website: "https://karyamandiri.co.id",
    }
]);