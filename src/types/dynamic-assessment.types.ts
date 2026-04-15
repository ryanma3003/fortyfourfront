// Types for backend-driven assessment data

export interface BackendDomain {
  id: string;
  nama_domain: string;
  created_at: string;
  updated_at: string;
}

export interface BackendKategori {
  id: string;
  domain_id: string;
  nama_kategori: string;
  created_at: string;
  updated_at: string;
}

export interface BackendSubKategori {
  id: string;
  kategori_id: string;
  nama_sub_kategori: string;
  created_at: string;
  updated_at: string;
}

export interface BackendRuangLingkup {
  id: string;
  nama_ruang_lingkup: string;
  created_at: string;
  updated_at: string;
}

// Assembled assessment structure
export interface DynamicQuestion {
  id: string;              // sub-kategori ID
  text: string;            // sub-kategori nama
  kategoriId: string;      // parent kategori ID
  domainKey: 'identifikasi' | 'proteksi' | 'deteksi' | 'gulih';
  scopeId?: string;        // The ID from backend (optional depending on how we join)
  scope: string;           // ruang lingkup text (default: 'Tata Kelola' or empty if not tied directly)
  indexDescriptions: Record<number, string>; // We supply generic descriptions here
}

export interface DynamicCategory {
  id: string;              // kategori ID
  name: string;            // kategori nama
  domainId: string;
  questions: DynamicQuestion[];
}

export interface DynamicDomain {
  id: string;
  name: string;
  color: string;
  categories: DynamicCategory[];
}
