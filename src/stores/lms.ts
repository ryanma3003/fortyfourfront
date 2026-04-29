import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { lmsService } from '@/services/lms.service'
import type {
  LmsKelas, CreateKelasPayload, UpdateKelasPayload,
  LmsMateri, CreateMateriPayload, UpdateMateriPayload,
  LmsFilePendukung,
  LmsKuis, CreateKuisPayload, UpdateKuisPayload,
  LmsSoal, CreateSoalPayload, UpdateSoalPayload,
  LmsDiskusi
} from '@/types/lms.types'

// Re-export types for backward compatibility with components
export type { LmsMateri, LmsKuis, LmsSoal, LmsKelas, LmsFilePendukung }

export interface QuizOption {
  label: string           // A, B, C, D
  text: string
}

export interface QuizQuestion {
  id: string | number
  pertanyaan: string      // HTML (WYSIWYG)
  tipe: 'pilihan_ganda' | 'essay'
  opsi: QuizOption[]
  jawabanBenar: string    // label of correct option (A / B / C / D), empty for essay
}

// ── Store ───────────────────────────────────────────────────
export const useLmsStore = defineStore('lms', () => {
  // ─── State ─────────────────────────────────────────────────
  const kelasList = ref<LmsKelas[]>([])
  const materiList = ref<LmsMateri[]>([])
  const kuisList = ref<LmsKuis[]>([])
  const soalList = ref<LmsSoal[]>([])
  const diskusiList = ref<LmsDiskusi[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Current active kelas context
  const activeKelasId = ref<string | number | null>(null)

  // ─── Per-Kelas Cache ──────────────────────────────────────
  // Keyed by kelas ID, stores { materi, kuis, timestamp }
  const kelasCache = ref<Record<string, { materi: LmsMateri[], kuis: LmsKuis[], ts: number }>>({})
  // Soal cache keyed by kuis ID
  const soalCache = ref<Record<string, { soal: LmsSoal[], ts: number }>>({})
  // Cache TTL: 5 minutes
  const CACHE_TTL = 5 * 60 * 1000

  const isCacheValid = (ts: number) => Date.now() - ts < CACHE_TTL

  // ─── Kelas ─────────────────────────────────────────────────
  const fetchKelas = async () => {
    loading.value = true
    error.value = null
    try {
      kelasList.value = await lmsService.getKelas()
    } catch (e: any) {
      error.value = e.message || 'Gagal memuat data kelas'
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Skip fetch if already loaded */
  const ensureKelas = async () => {
    if (kelasList.value.length > 0) return
    await fetchKelas()
  }

  const getKelasById = (id: string | number) =>
    kelasList.value.find(k => String(k.id) === String(id))

  const createKelas = async (payload: CreateKelasPayload) => {
    loading.value = true
    error.value = null
    try {
      const result = await lmsService.createKelas(payload)
      kelasList.value.push(result)
      return result
    } catch (e: any) {
      error.value = e.message || 'Gagal membuat kelas'
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateKelas = async (id: string | number, payload: UpdateKelasPayload) => {
    loading.value = true
    error.value = null
    try {
      const result = await lmsService.updateKelas(id, payload)
      const idx = kelasList.value.findIndex(k => String(k.id) === String(id))
      if (idx !== -1) kelasList.value[idx] = result
      return result
    } catch (e: any) {
      error.value = e.message || 'Gagal mengupdate kelas'
      throw e
    } finally {
      loading.value = false
    }
  }

  const deleteKelas = async (id: string | number) => {
    loading.value = true
    error.value = null
    try {
      await lmsService.deleteKelas(id)
      kelasList.value = kelasList.value.filter(k => String(k.id) !== String(id))
      // Clear cache for this kelas
      delete kelasCache.value[String(id)]
    } catch (e: any) {
      error.value = e.message || 'Gagal menghapus kelas'
      throw e
    } finally {
      loading.value = false
    }
  }

  // ─── Kelas Detail (Optimized: materi + kuis in 1 call) ────
  /**
   * Fetch materi + kuis for a kelas in parallel.
   * Uses cache if available and not expired.
   */
  const fetchKelasDetail = async (kelasId: string | number, forceRefresh = false) => {
    const key = String(kelasId)
    const cached = kelasCache.value[key]
    if (!forceRefresh && cached && isCacheValid(cached.ts)) {
      // Return from cache
      materiList.value = cached.materi
      kuisList.value = cached.kuis
      activeKelasId.value = kelasId
      return { materi: cached.materi, kuis: cached.kuis }
    }

    loading.value = true
    error.value = null
    try {
      const { materi, kuis } = await lmsService.getKelasDetail(kelasId)
      // Update cache
      kelasCache.value[key] = { materi, kuis, ts: Date.now() }
      // Update reactive lists
      materiList.value = materi
      kuisList.value = kuis
      activeKelasId.value = kelasId
      return { materi, kuis }
    } catch (e: any) {
      error.value = e.message || 'Gagal memuat detail kelas'
      throw e
    } finally {
      loading.value = false
    }
  }

  // ─── Materi ────────────────────────────────────────────────
  const fetchMateri = async (kelasId?: string | number) => {
    loading.value = true
    error.value = null
    try {
      materiList.value = await lmsService.getMateriByKelas(kelasId)
      activeKelasId.value = kelasId
      // Update cache if kelasId specified
      if (kelasId) {
        const key = String(kelasId)
        if (kelasCache.value[key]) {
          kelasCache.value[key].materi = materiList.value
          kelasCache.value[key].ts = Date.now()
        }
      }
      return materiList.value
    } catch (e: any) {
      error.value = e.message || 'Gagal memuat data materi'
      throw e
    } finally {
      loading.value = false
    }
  }

  const getMateriById = (id: string | number) => {
    // Check current list first
    const found = materiList.value.find(m => String(m.id) === String(id))
    if (found) return found
    // Search all caches
    for (const cached of Object.values(kelasCache.value)) {
      const m = cached.materi.find(m => String(m.id) === String(id))
      if (m) return m
    }
    return undefined
  }

  const createMateri = async (kelasId: string | number, payload: CreateMateriPayload) => {
    loading.value = true
    error.value = null
    try {
      const result = await lmsService.createMateri(kelasId, payload)
      materiList.value.push(result)
      // Invalidate cache for this kelas
      delete kelasCache.value[String(kelasId)]
      return result
    } catch (e: any) {
      error.value = e.message || 'Gagal menambahkan materi'
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateMateri = async (id: string | number, payload: UpdateMateriPayload) => {
    loading.value = true
    error.value = null
    try {
      const result = await lmsService.updateMateri(id, payload)
      const idx = materiList.value.findIndex(m => String(m.id) === String(id))
      if (idx !== -1) materiList.value[idx] = result
      // Invalidate all kelas caches that might contain this materi
      for (const [key, cached] of Object.entries(kelasCache.value)) {
        if (cached.materi.some(m => String(m.id) === String(id))) {
          delete kelasCache.value[key]
        }
      }
      return result
    } catch (e: any) {
      error.value = e.message || 'Gagal mengupdate materi'
      throw e
    } finally {
      loading.value = false
    }
  }

  const deleteMateri = async (id: string | number) => {
    loading.value = true
    error.value = null
    try {
      await lmsService.deleteMateri(id)
      materiList.value = materiList.value.filter(m => String(m.id) !== String(id))
      // Invalidate related cache
      for (const [key, cached] of Object.entries(kelasCache.value)) {
        if (cached.materi.some(m => String(m.id) === String(id))) {
          delete kelasCache.value[key]
        }
      }
    } catch (e: any) {
      error.value = e.message || 'Gagal menghapus materi'
      throw e
    } finally {
      loading.value = false
    }
  }

  // ─── File Pendukung ────────────────────────────────────────
  const uploadFilePendukung = async (materiId: string | number, file: File) => {
    loading.value = true
    error.value = null
    try {
      const result = await lmsService.uploadFilePendukung(materiId, file)
      // Update file_pendukung in the materi ref if present
      const materi = materiList.value.find(m => String(m.id) === String(materiId))
      if (materi) {
        if (!materi.file_pendukung) materi.file_pendukung = []
        materi.file_pendukung.push(result)
      }
      return result
    } catch (e: any) {
      error.value = e.message || 'Gagal mengupload file pendukung'
      throw e
    } finally {
      loading.value = false
    }
  }

  const deleteFilePendukung = async (id: string | number, materiId?: string | number) => {
    loading.value = true
    error.value = null
    try {
      await lmsService.deleteFilePendukung(id)
      // Remove from local materi if materiId provided
      if (materiId) {
        const materi = materiList.value.find(m => String(m.id) === String(materiId))
        if (materi && materi.file_pendukung) {
          materi.file_pendukung = materi.file_pendukung.filter(f => String(f.id) !== String(id))
        }
      }
    } catch (e: any) {
      error.value = e.message || 'Gagal menghapus file pendukung'
      throw e
    } finally {
      loading.value = false
    }
  }

  // ─── Kuis ──────────────────────────────────────────────────
  const fetchKuis = async (kelasId?: string | number) => {
    loading.value = true
    error.value = null
    try {
      kuisList.value = await lmsService.getKuisByKelas(kelasId)
      activeKelasId.value = kelasId
      // Update cache if kelasId specified
      if (kelasId) {
        const key = String(kelasId)
        if (kelasCache.value[key]) {
          kelasCache.value[key].kuis = kuisList.value
          kelasCache.value[key].ts = Date.now()
        }
      }
    } catch (e: any) {
      error.value = e.message || 'Gagal memuat data kuis'
      throw e
    } finally {
      loading.value = false
    }
  }

  const getKuisById = (id: string | number) => {
    // Check current list first
    const found = kuisList.value.find(q => String(q.id) === String(id))
    if (found) return found
    // Search all caches
    for (const cached of Object.values(kelasCache.value)) {
      const q = cached.kuis.find(q => String(q.id) === String(id))
      if (q) return q
    }
    return undefined
  }

  const createKuis = async (kelasId: string | number, payload: CreateKuisPayload) => {
    loading.value = true
    error.value = null
    try {
      const result = await lmsService.createKuis(kelasId, payload)
      kuisList.value.push(result)
      // Invalidate cache
      delete kelasCache.value[String(kelasId)]
      return result
    } catch (e: any) {
      error.value = e.message || 'Gagal membuat kuis'
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateKuis = async (id: string | number, payload: UpdateKuisPayload) => {
    loading.value = true
    error.value = null
    try {
      const result = await lmsService.updateKuis(id, payload)
      const idx = kuisList.value.findIndex(q => String(q.id) === String(id))
      if (idx !== -1) kuisList.value[idx] = result
      return result
    } catch (e: any) {
      error.value = e.message || 'Gagal mengupdate kuis'
      throw e
    } finally {
      loading.value = false
    }
  }

  const deleteKuis = async (id: string | number) => {
    loading.value = true
    error.value = null
    try {
      await lmsService.deleteKuis(id)
      kuisList.value = kuisList.value.filter(q => String(q.id) !== String(id))
      // Invalidate related cache
      for (const [key, cached] of Object.entries(kelasCache.value)) {
        if (cached.kuis.some(q => String(q.id) === String(id))) {
          delete kelasCache.value[key]
        }
      }
      // Also clear soal cache for this kuis
      delete soalCache.value[String(id)]
    } catch (e: any) {
      error.value = e.message || 'Gagal menghapus kuis'
      throw e
    } finally {
      loading.value = false
    }
  }

  // ─── Soal ──────────────────────────────────────────────────
  const fetchSoal = async (kuisId?: string | number) => {
    if (!kuisId) return

    // Check soal cache first
    const key = String(kuisId)
    const cached = soalCache.value[key]
    if (cached && isCacheValid(cached.ts)) {
      soalList.value = cached.soal
      return soalList.value
    }

    loading.value = true
    error.value = null
    try {
      soalList.value = await lmsService.getSoalByKuis(kuisId)
      // Update soal cache
      soalCache.value[key] = { soal: soalList.value, ts: Date.now() }
      return soalList.value
    } catch (e: any) {
      error.value = e.message || 'Gagal memuat data soal'
      throw e
    } finally {
      loading.value = false
    }
  }

  const getSoalById = (id: string | number) =>
    soalList.value.find(s => String(s.id) === String(id))

  const createSoal = async (kuisId: string | number, payload: CreateSoalPayload) => {
    loading.value = true
    error.value = null
    try {
      const result = await lmsService.createSoal(kuisId, payload)
      soalList.value.push(result)
      // Invalidate soal cache
      delete soalCache.value[String(kuisId)]
      return result
    } catch (e: any) {
      error.value = e.message || 'Gagal menambahkan soal'
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateSoal = async (id: string | number, payload: UpdateSoalPayload) => {
    loading.value = true
    error.value = null
    try {
      const result = await lmsService.updateSoal(id, payload)
      const idx = soalList.value.findIndex(s => String(s.id) === String(id))
      if (idx !== -1) soalList.value[idx] = result
      return result
    } catch (e: any) {
      error.value = e.message || 'Gagal mengupdate soal'
      throw e
    } finally {
      loading.value = false
    }
  }

  const deleteSoal = async (id: string | number) => {
    loading.value = true
    error.value = null
    try {
      await lmsService.deleteSoal(id)
      soalList.value = soalList.value.filter(s => String(s.id) !== String(id))
    } catch (e: any) {
      error.value = e.message || 'Gagal menghapus soal'
      throw e
    } finally {
      loading.value = false
    }
  }

  // ─── Diskusi ───────────────────────────────────────────────
  const fetchDiskusi = async (materiId: string | number) => {
    loading.value = true
    error.value = null
    try {
      diskusiList.value = await lmsService.getDiskusiByMateri(materiId)
      return diskusiList.value
    } catch (e: any) {
      error.value = e.message || 'Gagal memuat diskusi'
      throw e
    } finally {
      loading.value = false
    }
  }

  const deleteDiskusi = async (id: string | number) => {
    loading.value = true
    error.value = null
    try {
      await lmsService.deleteDiskusi(id)
      diskusiList.value = diskusiList.value.filter(d => String(d.id) !== String(id))
    } catch (e: any) {
      error.value = e.message || 'Gagal menghapus diskusi'
      throw e
    } finally {
      loading.value = false
    }
  }

  // ─── Stats ─────────────────────────────────────────────────
  const totalKelas = computed(() => kelasList.value.length)
  const totalMateri = computed(() => materiList.value.length)
  const totalKuis = computed(() => kuisList.value.length)
  const totalSoal = computed(() => soalList.value.length)

  // Legacy alias
  const quizList = kuisList
  const totalQuiz = totalKuis

  return {
    // State
    loading,
    error,
    activeKelasId,

    // Cache
    kelasCache,
    soalCache,

    // Kelas
    kelasList,
    fetchKelas,
    ensureKelas,
    getKelasById,
    createKelas,
    updateKelas,
    deleteKelas,

    // Kelas Detail (optimized)
    fetchKelasDetail,

    // Materi
    materiList,
    fetchMateri,
    getMateriById,
    createMateri,
    updateMateri,
    deleteMateri,

    // File Pendukung
    uploadFilePendukung,
    deleteFilePendukung,

    // Kuis
    kuisList,
    fetchKuis,
    getKuisById,
    createKuis,
    updateKuis,
    deleteKuis,

    // Soal
    soalList,
    fetchSoal,
    getSoalById,
    createSoal,
    updateSoal,
    deleteSoal,

    // Legacy aliases
    quizList,

    // Stats
    totalKelas,
    totalMateri,
    totalKuis,
    totalQuiz,
    totalSoal,

    // Diskusi
    diskusiList,
    fetchDiskusi,
    deleteDiskusi,
  }
})
