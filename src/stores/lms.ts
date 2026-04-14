import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ── Types ───────────────────────────────────────────────────
export interface LmsMateri {
  id: string
  judul: string
  kategori: string
  deskripsi: string
  konten: string          // HTML from WYSIWYG editor
  createdAt: string
  updatedAt: string
}

export interface QuizOption {
  label: string           // A, B, C, D
  text: string
}

export interface QuizQuestion {
  id: string
  pertanyaan: string      // HTML (WYSIWYG)
  tipe: 'pilihan_ganda' | 'essay'
  opsi: QuizOption[]
  jawabanBenar: string    // label of correct option (A / B / C / D), empty for essay
}

export interface LmsQuiz {
  id: string
  judul: string
  deskripsi: string
  soalList: QuizQuestion[]
  createdAt: string
  updatedAt: string
}

// ── Helper ──────────────────────────────────────────────────
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)
const now = () => new Date().toISOString()

// ── Store ───────────────────────────────────────────────────
export const useLmsStore = defineStore('lms', () => {
  // ─── Materi ───────────────────────────────────────────────
  const materiList = ref<LmsMateri[]>([
    {
      id: uid(),
      judul: 'Pengenalan Keamanan Siber',
      kategori: 'Cybersecurity',
      deskripsi: 'Materi dasar pengenalan keamanan siber untuk pemula.',
      konten: '<h3>Apa itu Keamanan Siber?</h3><p>Keamanan siber adalah praktik melindungi sistem, jaringan, dan program dari serangan digital. Serangan ini biasanya bertujuan mengakses, mengubah, atau menghancurkan informasi sensitif.</p><h4>Mengapa Penting?</h4><ul><li>Melindungi data sensitif organisasi</li><li>Menjaga kepercayaan stakeholder</li><li>Memenuhi regulasi dan compliance</li></ul>',
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: uid(),
      judul: 'Incident Response Framework',
      kategori: 'CSIRT',
      deskripsi: 'Panduan framework respon insiden untuk tim CSIRT.',
      konten: '<h3>Framework Incident Response</h3><p>Setiap CSIRT harus memiliki framework yang jelas untuk menangani insiden keamanan. Framework ini mencakup beberapa fase:</p><ol><li><strong>Preparation</strong> - Persiapan tim dan tools</li><li><strong>Detection & Analysis</strong> - Deteksi dan analisis insiden</li><li><strong>Containment</strong> - Pembatasan dampak</li><li><strong>Recovery</strong> - Pemulihan sistem</li><li><strong>Post-Incident</strong> - Evaluasi dan pembelajaran</li></ol>',
      createdAt: now(),
      updatedAt: now(),
    },
  ])

  const getMateriById = (id: string) => materiList.value.find(m => m.id === id)

  const createMateri = (data: Omit<LmsMateri, 'id' | 'createdAt' | 'updatedAt'>) => {
    const materi: LmsMateri = { ...data, id: uid(), createdAt: now(), updatedAt: now() }
    materiList.value.push(materi)
    return materi
  }

  const updateMateri = (id: string, data: Partial<LmsMateri>) => {
    const idx = materiList.value.findIndex(m => m.id === id)
    if (idx === -1) return null
    materiList.value[idx] = { ...materiList.value[idx], ...data, updatedAt: now() }
    return materiList.value[idx]
  }

  const deleteMateri = (id: string) => {
    materiList.value = materiList.value.filter(m => m.id !== id)
  }

  // ─── Quiz ─────────────────────────────────────────────────
  const quizList = ref<LmsQuiz[]>([
    {
      id: uid(),
      judul: 'Quiz Dasar Keamanan Siber',
      deskripsi: 'Quiz untuk menguji pemahaman dasar tentang keamanan siber.',
      soalList: [
        {
          id: uid(),
          pertanyaan: '<p>Apa kepanjangan dari <strong>CSIRT</strong>?</p>',
          tipe: 'pilihan_ganda',
          opsi: [
            { label: 'A', text: 'Computer Security Incident Response Team' },
            { label: 'B', text: 'Cyber Security Intelligence Research Team' },
            { label: 'C', text: 'Central Security Information Review Team' },
            { label: 'D', text: 'Computer System Incident Recovery Team' },
          ],
          jawabanBenar: 'A',
        },
        {
          id: uid(),
          pertanyaan: '<p>Jelaskan tahapan utama dalam <em>Incident Response Framework</em>!</p>',
          tipe: 'essay',
          opsi: [],
          jawabanBenar: '',
        },
      ],
      createdAt: now(),
      updatedAt: now(),
    },
  ])

  const getQuizById = (id: string) => quizList.value.find(q => q.id === id)

  const createQuiz = (data: Omit<LmsQuiz, 'id' | 'createdAt' | 'updatedAt'>) => {
    const quiz: LmsQuiz = { ...data, id: uid(), createdAt: now(), updatedAt: now() }
    quizList.value.push(quiz)
    return quiz
  }

  const updateQuiz = (id: string, data: Partial<LmsQuiz>) => {
    const idx = quizList.value.findIndex(q => q.id === id)
    if (idx === -1) return null
    quizList.value[idx] = { ...quizList.value[idx], ...data, updatedAt: now() }
    return quizList.value[idx]
  }

  const deleteQuiz = (id: string) => {
    quizList.value = quizList.value.filter(q => q.id !== id)
  }

  // ─── Stats ────────────────────────────────────────────────
  const totalMateri = computed(() => materiList.value.length)
  const totalQuiz = computed(() => quizList.value.length)
  const totalSoal = computed(() => quizList.value.reduce((sum, q) => sum + q.soalList.length, 0))

  return {
    // Materi
    materiList,
    getMateriById,
    createMateri,
    updateMateri,
    deleteMateri,
    // Quiz
    quizList,
    getQuizById,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    // Stats
    totalMateri,
    totalQuiz,
    totalSoal,
  }
})
