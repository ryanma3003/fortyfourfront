import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { lmsService } from '@/services/lms.service'
import type {
  LmsKelas, CreateKelasPayload, UpdateKelasPayload,
  LmsMateri, CreateMateriPayload, UpdateMateriPayload,
  LmsFilePendukung,
  LmsKuis, CreateKuisPayload, UpdateKuisPayload,
  LmsSoal, CreateSoalPayload, UpdateSoalPayload,
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
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Current active kelas context
  const activeKelasId = ref<string | number | null>(null)

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
    } catch (e: any) {
      error.value = e.message || 'Gagal menghapus kelas'
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
    } catch (e: any) {
      error.value = e.message || 'Gagal memuat data materi'
      throw e
    } finally {
      loading.value = false
    }
  }

  const getMateriById = (id: string | number) =>
    materiList.value.find(m => String(m.id) === String(id))

  const createMateri = async (kelasId: string | number, payload: CreateMateriPayload) => {
    loading.value = true
    error.value = null
    try {
      const result = await lmsService.createMateri(kelasId, payload)
      materiList.value.push(result)
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
    } catch (e: any) {
      error.value = e.message || 'Gagal memuat data kuis'
      throw e
    } finally {
      loading.value = false
    }
  }

  const getKuisById = (id: string | number) =>
    kuisList.value.find(q => String(q.id) === String(id))

  const createKuis = async (kelasId: string | number, payload: CreateKuisPayload) => {
    loading.value = true
    error.value = null
    try {
      const result = await lmsService.createKuis(kelasId, payload)
      kuisList.value.push(result)
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
    } catch (e: any) {
      error.value = e.message || 'Gagal menghapus kuis'
      throw e
    } finally {
      loading.value = false
    }
  }

  // ─── Soal ──────────────────────────────────────────────────
  const fetchSoal = async (kuisId?: string | number) => {
    loading.value = true
    error.value = null
    try {
      soalList.value = await lmsService.getSoalByKuis(kuisId)
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

    // Kelas
    kelasList,
    fetchKelas,
    getKelasById,
    createKelas,
    updateKelas,
    deleteKelas,

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
  }
})
