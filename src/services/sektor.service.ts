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
  return s.nama_sektor ?? s.nama ?? String(s.id)
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
  console.log(`[sektorService] ${label} raw response:`, res)

  if (Array.isArray(res)) return res as T[]

  if (res && Array.isArray(res.data)) return res.data as T[]

  if (res && typeof res === 'object') {
    const firstArray = Object.values(res).find(v => Array.isArray(v))
    if (firstArray) return firstArray as T[]
  }

  return []
}

/**
 * =========================
 * SEKTOR SERVICE
 * =========================
 */

export const sektorService = {
  async getAll(): Promise<Sektor[]> {
    const res = await api.get<any>('/api/sektor')
    return unwrapArray<Sektor>(res, 'sektor')
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
    const res = await api.get<any>('/api/sub_sektor')
    return unwrapArray<SubSektor>(res, 'sub_sektor')
  },

  /**
   * Ambil sub sektor berdasarkan sektor ID
   * Pastikan backend memang support query param sektor_id
   */
  async getBySektorId(sektorId: string | number): Promise<SubSektor[]> {
    const res = await api.get<any>(`/api/sub_sektor?sektor_id=${sektorId}`)
    return unwrapArray<SubSektor>(res, `sub_sektor(sektor_id=${sektorId})`)
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