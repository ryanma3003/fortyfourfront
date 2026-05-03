import { api } from '@/config/api';
import type {
  AktivitasDetailResponse,
  AktivitasListResponse,
  AktivitasMutationResponse,
  AktivitasPayload,
  JenisAktivitasResponse,
} from '@/types/aktivitas.types';

export const aktivitasService = {
  async getByPerusahaan(perusahaanId: string | number): Promise<AktivitasListResponse> {
    return api.get<AktivitasListResponse>(`/api/aktivitas?perusahaan_id=${encodeURIComponent(String(perusahaanId))}`);
  },

  async getJenis(): Promise<JenisAktivitasResponse> {
    return api.get<JenisAktivitasResponse>('/api/aktivitas/jenis');
  },

  async getById(id: number): Promise<AktivitasDetailResponse> {
    return api.get<AktivitasDetailResponse>(`/api/aktivitas/${id}`);
  },

  async create(payload: AktivitasPayload): Promise<AktivitasMutationResponse> {
    return api.post<AktivitasMutationResponse>('/api/aktivitas', payload);
  },

  async update(id: number, payload: AktivitasPayload): Promise<AktivitasMutationResponse> {
    return api.put<AktivitasMutationResponse>(`/api/aktivitas/${id}`, payload);
  },

  async delete(id: number): Promise<AktivitasMutationResponse> {
    return api.delete<AktivitasMutationResponse>(`/api/aktivitas/${id}`);
  },
};
