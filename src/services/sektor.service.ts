import { api } from '@/config/api'

/**
 * =========================
 * TYPES
 * =========================
 */

/**
 * Sektor (parent)
 */
export interface Sektor {
  id: string | number
  nama_sektor?: string
  nama?: string
  kode_sektor?: string
  [key: string]: any
}

/**
 * SubSektor (child)
 */
export interface SubSektor {
  id: string | number
  nama_sub_sektor?: string
  nama?: string
  kode_sub_sektor?: string
  id_sektor?: string | number
  sektor_id?: string | number
  [key: string]: any
}

/**
 * =========================
 * HELPERS
 * =========================
 */

/** Get display name for Sektor */
export function getSektorName(s: Sektor): string {
  const name = (s.nama_sektor ?? s.nama ?? String(s.id)).trim();
  const upper = name.toUpperCase();
  
  if (upper === 'AGRO') return 'Industri Agro, Surveyor, dan Jasa Konstruksi';
  if (upper === 'ILMATE') return 'Industri Logam, Mesin, Alat Transportasi, dan Elektronika';
  if (upper === 'IKFT') return 'Industri Kimia, Farmasi, Tekstil, dan Kawasan Industri';
  
  return name;
}

/** Get display name for SubSektor */
export function getSubSektorName(s: SubSektor): string {
  return s.nama_sub_sektor ?? s.nama ?? String(s.id)
}

/** Get parent sektor ID from SubSektor */
export function getSubSektorParentId(s: SubSektor): string | number | undefined {
  return s.id_sektor ?? s.sektor_id
}

/**
 * Helper untuk unwrap response Laravel:
 * - []
 * - { data: [] }
 * - { something: [] }
 */
function unwrapArray<T>(res: any, label: string): T[] {

  if (Array.isArray(res)) return res as T[]

  if (res && Array.isArray(res.data)) return res.data as T[]

  if (res && typeof res === 'object') {
    const firstArray = Object.values(res).find(v => Array.isArray(v))
    if (firstArray) return firstArray as T[]
  }

  return []
}

const CACHE_TTL_MS = 5 * 60 * 1000
const listCache = new Map<string, { ts: number; data: any[] }>()
const inFlight = new Map<string, Promise<any[]>>()

async function getCachedList<T>(key: string, fetcher: () => Promise<T[]>): Promise<T[]> {
  const cached = listCache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data as T[]
  }

  const pending = inFlight.get(key)
  if (pending) return pending as Promise<T[]>

  const request = fetcher()
    .then((data) => {
      listCache.set(key, { ts: Date.now(), data })
      return data
    })
    .finally(() => {
      inFlight.delete(key)
    })

  inFlight.set(key, request)
  return request
}

/**
 * =========================
 * SEKTOR SERVICE
 * =========================
 */

export const sektorService = {
  async getAll(): Promise<Sektor[]> {
    return getCachedList<Sektor>('sektor:all', async () => {
      const res = await api.get<any>('/api/sektor')
      return unwrapArray<Sektor>(res, 'sektor')
    })
  },

  async getById(id: string | number): Promise<Sektor> {
    return api.get<Sektor>(`/api/sektor/${id}`)
  },

  async create(data: Omit<Sektor, 'id'>): Promise<Sektor> {
    return api.post<Sektor>('/api/sektor', data)
  },

  async update(id: string | number, data: Partial<Sektor>): Promise<Sektor> {
    return api.put<Sektor>(`/api/sektor/${id}`, data)
  },

  async delete(id: string | number): Promise<void> {
    return api.delete(`/api/sektor/${id}`)
  },
}

/**
 * =========================
 * SUB SEKTOR SERVICE
 * =========================
 */

export const subSektorService = {
  async getAll(): Promise<SubSektor[]> {
    return getCachedList<SubSektor>('sub_sektor:all', async () => {
      const res = await api.get<any>('/api/sub_sektor')
      return unwrapArray<SubSektor>(res, 'sub_sektor')
    })
  },

  /**
   * Ambil sub sektor berdasarkan sektor ID
   * Pastikan backend memang support query param sektor_id
   */
  async getBySektorId(sektorId: string | number): Promise<SubSektor[]> {
    return getCachedList<SubSektor>(`sub_sektor:sektor:${sektorId}`, async () => {
      const res = await api.get<any>(`/api/sub_sektor?sektor_id=${sektorId}`)
      return unwrapArray<SubSektor>(res, `sub_sektor(sektor_id=${sektorId})`)
    })
  },

  async getById(id: string | number): Promise<SubSektor> {
    return api.get<SubSektor>(`/api/sub_sektor/${id}`)
  },

  async create(data: Omit<SubSektor, 'id'>): Promise<SubSektor> {
    return api.post<SubSektor>('/api/sub_sektor', data)
  },

  async update(id: string | number, data: Partial<SubSektor>): Promise<SubSektor> {
    return api.put<SubSektor>(`/api/sub_sektor/${id}`, data)
  },

  async delete(id: string | number): Promise<void> {
    return api.delete(`/api/sub_sektor/${id}`)
  },
}
