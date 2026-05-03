export interface Aktivitas {
  id: number;
  judul: string;
  deskripsi: string;
  jenis_aktivitas: string[];
  perusahaan_id: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  created_at: string;
  updated_at: string;
}

export interface AktivitasListResponse {
  data: Aktivitas[];
  message: string;
  status: string;
  total: string;
}

export interface AktivitasDetailResponse {
  data: Aktivitas;
  message: string;
  status: string;
  total: string;
}

export interface AktivitasPayload {
  judul: string;
  deskripsi: string;
  jenis_aktivitas: string[];
  perusahaan_id: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
}

export interface JenisAktivitasResponse {
  data: string[];
  message: string;
  status: string;
  total: string;
}

export interface AktivitasMutationResponse {
  data?: Aktivitas | { id: number };
  message: string;
  status: string;
  total?: string;
}
