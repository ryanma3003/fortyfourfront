<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useLmsStore } from "../../stores/lms";
import { useRoute, useRouter } from "vue-router";
import type { LmsKelas, LmsMateri, LmsKuis, LmsSoal } from "../../types/lms.types";
import { formatImageUrl } from '@/utils/media';

export default {
  components: { Pageheader },
  setup() {
    const lmsStore = useLmsStore();
    const route = useRoute();
    const router = useRouter();

    const loading = ref(true);
    const kelasId = computed(() => route.params.id as string);
    
    // UI State for Preview
    const selectedMateri = ref<LmsMateri | null>(null);
    const selectedKuis = ref<LmsKuis | null>(null);
    const relatedSoal = ref<LmsSoal[]>([]);
    const loadingSoal = ref(false);
    
    // Diskusi State
    const diskusiList = computed(() => lmsStore.diskusiList);
    const isLoadingDiskusi = ref(false);

    // Data lists (populated from API)
    const materiList = ref<LmsMateri[]>([]);
    const kuisList = ref<LmsKuis[]>([]);

    const currentKelas = computed<LmsKelas | undefined>(() => 
      lmsStore.kelasList.find((k) => String(k.id) === kelasId.value)
    );

    // Use local refs instead of filtering global store
    const relatedMateri = computed<LmsMateri[]>(() => 
      [...materiList.value].sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
    );
    const relatedKuis = computed<LmsKuis[]>(() => 
      [...kuisList.value].sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
    );

    const dataToPass = computed(() => ({
      title: { label: "Daftar Kelas", path: "/lms/kelas" },
      currentpage: "Preview Kelas",
      activepage: "Preview",
    }));

    onMounted(async () => {
      loading.value = true;
      
      try {
        // Ensure kelas list is loaded (skips if already cached)
        await lmsStore.ensureKelas();

        // Fetch materi + kuis for this kelas (uses cache if available)
        const { materi, kuis } = await lmsStore.fetchKelasDetail(kelasId.value);
        materiList.value = materi;
        kuisList.value = kuis;
      } catch (e: any) {
        console.error('Failed to load kelas detail:', e);
      }
      
      loading.value = false;
    });

    const stripHtml = (html?: string) => {
      if (!html) return "-";
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || "";
    };

    const goBack = () => router.push('/lms/kelas');

    const viewMateri = async (materi: LmsMateri) => {
      selectedMateri.value = materi;
      selectedKuis.value = null;
      relatedSoal.value = [];

      // Fetch Diskusi
      isLoadingDiskusi.value = true;
      try {
        await lmsStore.fetchDiskusi(materi.id);
      } catch (e) {
        console.error('Failed to load diskusi:', e);
      } finally {
        isLoadingDiskusi.value = false;
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const deleteDiskusi = async (diskusiId: string | number) => {
      if (!confirm("Yakin ingin menghapus komentar ini?")) return;
      try {
        await lmsStore.deleteDiskusi(diskusiId);
      } catch (e) {
        console.error('Failed to delete diskusi:', e);
      }
    };

    const viewKuis = async (kuis: LmsKuis) => {
      selectedKuis.value = kuis;
      selectedMateri.value = null;
      loadingSoal.value = true;
      try {
        // Uses soal cache if available (instant on re-select)
        await lmsStore.fetchSoal(kuis.id);
        relatedSoal.value = [...lmsStore.soalList];
      } catch (e) {
        relatedSoal.value = [];
      } finally {
        loadingSoal.value = false;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const closePreview = () => {
      selectedMateri.value = null;
      selectedKuis.value = null;
      relatedSoal.value = [];
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const getYoutubeId = (url?: string) => {
      if (!url || typeof url !== 'string') return null;
      
      const trimmedUrl = url.trim();
      if (!trimmedUrl) return null;

      // 1. If it's already a 11-char ID
      if (trimmedUrl.length === 11 && !trimmedUrl.includes('/') && !trimmedUrl.includes('.') && !trimmedUrl.includes(':')) {
        return trimmedUrl;
      }

      // 2. Comprehensive Regex for all YouTube formats (Standard, Shorts, Live, Embed, etc.)
      // Matches: youtube.com, youtu.be, youtube-nocookie.com
      // Paths: /watch?v=, /v/, /e/, /embed/, /shorts/, /live/
      const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/|youtube-nocookie\.com\/(?:v|e(?:mbed)?)\/)([^"&?\/\s]{11})/i;
      const match = trimmedUrl.match(regex);
      
      if (match && match[1]) {
        return match[1];
      }

      // 3. Fallback for common patterns if regex fails
      try {
        const urlObj = new URL(trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`);
        
        // Handle youtu.be
        if (urlObj.hostname === 'youtu.be') {
          const id = urlObj.pathname.slice(1, 12);
          if (id.length === 11) return id;
        }
        
        // Handle v= parameter
        const v = urlObj.searchParams.get('v');
        if (v && v.length === 11) return v;
        
        // Handle path segments (shorts, live, embed)
        const pathSegments = urlObj.pathname.split('/');
        const idFromPath = pathSegments.find(s => s.length === 11);
        if (idFromPath) return idFromPath;
      } catch (e) {
        // Not a valid URL, try manual split
        if (trimmedUrl.includes('v=')) {
          const id = trimmedUrl.split('v=')[1]?.substring(0, 11);
          if (id && id.length === 11) return id;
        }
      }

      return null;
    };

    const activeYoutubeId = computed(() => {
      if (!selectedMateri.value) return null;
      return getYoutubeId(selectedMateri.value.url_video);
    });

    return {
      loading,
      currentKelas,
      relatedMateri,
      relatedKuis,
      dataToPass,
      stripHtml,
      goBack,
      selectedMateri,
      selectedKuis,
      relatedSoal,
      loadingSoal,
      viewMateri,
      viewKuis,
      closePreview,
      getYoutubeId,
      activeYoutubeId,
      formatImageUrl,
      diskusiList,
      isLoadingDiskusi,
      deleteDiskusi,
      viewKuis
    };
  },
};</script>

<template>
  <pageheader :propData="dataToPass" />

  <div class="row">
    <div class="col-xl-12">
      <!-- Skeleton Loader -->
      <div v-if="loading" class="card custom-card">
        <div class="card-body p-5 skeleton-loading">
            <div class="skel skel-name mb-4" style="height: 200px;"></div>
            <div class="row">
                <div class="col-6"><div class="skel" style="height: 300px;"></div></div>
                <div class="col-6"><div class="skel" style="height: 300px;"></div></div>
            </div>
        </div>
      </div>

      <template v-else-if="currentKelas">
        <!-- New Unique Premium Header Hero -->
        <div class="lms-preview-hero rounded-4 mb-3 shadow-sm">
          <div class="hero-glow-blob blob-1"></div>
          <div class="hero-glow-blob blob-2"></div>
          <div class="lms-preview-hero-content d-flex justify-content-between align-items-end flex-wrap gap-4 position-relative z-1">
            <div class="hero-main-info flex-grow-1">
              <div class="d-flex align-items-start gap-4 flex-wrap flex-md-nowrap mb-3">
                <div v-if="currentKelas.thumbnail" class="hero-thumbnail-wrap flex-shrink-0 shadow-lg rounded-4 overflow-hidden border border-white border-opacity-25" style="width: 180px; height: 110px;">
                  <img :src="currentKelas.thumbnail" class="w-100 h-100 object-fit-cover" alt="Kelas Thumbnail" />
                </div>
                <div v-else class="hero-icon-placeholder flex-shrink-0 bg-white bg-opacity-10 rounded-4 d-flex align-items-center justify-content-center shadow-lg border border-white border-opacity-10" style="width: 110px; height: 110px;">
                  <i class="ri-graduation-cap-line text-white fs-1"></i>
                </div>
                <div class="flex-grow-1">
                  <div class="mb-2 d-flex align-items-center gap-2">
                     <span class="badge bg-white text-dark px-3 py-1 rounded-pill fw-bold shadow-sm d-inline-flex align-items-center gap-2" style="font-size: 11px;">
                       <span class="status-dot" :class="currentKelas.status === 'published' ? 'bg-success' : 'bg-warning'"></span>
                       <span class="text-capitalize">{{ currentKelas.status || "Unknown" }}</span>
                     </span>
                  </div>
                  <h1 class="hero-title text-white fw-black mb-1 fs-32">{{ currentKelas.nama_kelas }}</h1>
                  <p class="hero-subtitle text-white-50 mb-0 fs-15 max-w-2xl line-clamp-2">{{ currentKelas.deskripsi || 'Pengantar Pembelajaran' }}</p>
                </div>
              </div>
              
              <div class="hero-stats-stack mt-3 d-flex flex-wrap gap-4">
                <div class="hero-stat-item d-flex align-items-center gap-2 text-white">
                  <div class="stat-icon-wrap"><i class="ri-calendar-line"></i></div>
                  <div>
                    <div class="fs-11 text-white-50 text-uppercase fw-semibold tracking-wide">Dibuat Pada</div>
                    <div class="fw-bold fs-14">{{ currentKelas.created_at?.split('T')[0] || '-' }}</div>
                  </div>
                </div>
                <div class="hero-stat-item d-flex align-items-center gap-2 text-white">
                  <div class="stat-icon-wrap"><i class="ri-book-open-line"></i></div>
                  <div>
                    <div class="fs-11 text-white-50 text-uppercase fw-semibold tracking-wide">Total Materi</div>
                    <div class="fw-bold fs-14">{{ relatedMateri.length }} Materi</div>
                  </div>
                </div>
                <div class="hero-stat-item d-flex align-items-center gap-2 text-white">
                  <div class="stat-icon-wrap"><i class="ri-questionnaire-line"></i></div>
                  <div>
                    <div class="fs-11 text-white-50 text-uppercase fw-semibold tracking-wide">Total Kuis</div>
                    <div class="fw-bold fs-14">{{ relatedKuis.length }} Kuis</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="hero-actions flex-shrink-0 pb-1">
               <button @click="goBack" class="btn btn-white btn-lg rounded-pill px-4 fw-bold shadow-sm text-primary d-flex align-items-center gap-2 hero-back-btn">
                 <i class="ri-arrow-left-line"></i> Kembali ke Daftar
               </button>
            </div>
          </div>
        </div>

        <div class="row g-3">
          <!-- MAIN CONTENT AREA (Player & Details) - LEFT SIDE (col-xl-8) -->
          <div class="col-xl-8 order-2 order-xl-1">
            
            <!-- Video / Text Player -->
            <div v-if="selectedMateri" class="card border-0 shadow-sm rounded-4 overflow-hidden lms-player-card">
              <!-- Video Header -->
              <div v-if="selectedMateri.tipe === 'video'" class="player-video-wrapper bg-black">
                <div class="ratio ratio-16x9">
                  <iframe 
                    v-if="activeYoutubeId"
                    :src="`https://www.youtube.com/embed/${activeYoutubeId}?autoplay=0&rel=0`" 
                    title="YouTube video player" 
                    frameborder="0" 
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                  </iframe>
                  <video 
                    v-else-if="selectedMateri.url_video && (selectedMateri.url_video.includes('.mp4') || selectedMateri.url_video.includes('.webm') || selectedMateri.url_video.includes('.ogg'))"
                    :src="selectedMateri.url_video" 
                    controls 
                    class="h-100 w-100">
                  </video>
                  <div v-else class="d-flex align-items-center justify-content-center text-white flex-column h-100 p-4">
                    <i class="ri-video-off-line mb-2 text-muted" style="font-size: 3.5rem;"></i>
                    <h5 class="text-white-50 mt-2 mb-1">Video tidak dapat dimuat</h5>
                    <p class="text-muted fs-13 text-center mb-0 px-4">
                      Format URL tidak dikenali: <code class="text-warning bg-dark px-2 py-1 rounded">{{ selectedMateri.url_video || '(Kosong)' }}</code>
                    </p>
                  </div>
                </div>
              </div>
              
              <!-- Text Material Header -->
              <div v-else class="player-text-header bg-primary bg-opacity-10 p-3 p-md-4 border-bottom border-primary border-opacity-10">
                <div class="d-flex align-items-center gap-4">
                   <div class="avatar avatar-xl bg-primary text-white rounded-4 shadow-sm flex-shrink-0">
                     <i class="ri-file-text-line fs-24"></i>
                   </div>
                   <div>
                     <span class="badge bg-primary text-white mb-2 px-2 py-1 rounded-pill">Materi Teks</span>
                     <h3 class="fw-bold mb-1 text-dark">{{ selectedMateri.judul }}</h3>
                     <div class="text-muted fs-14"><i class="ri-folder-open-line me-1"></i> {{ selectedMateri.kategori || 'Umum' }}</div>
                   </div>
                </div>
              </div>

              <!-- Material Content Body -->
              <div class="card-body p-3 p-md-4">
                <div v-if="selectedMateri.tipe === 'video'" class="mb-4 pb-3 border-bottom border-dashed border-light">
                  <span class="badge bg-danger bg-opacity-10 text-danger mb-3 px-3 py-2 rounded-pill"><i class="ri-video-line me-1"></i> Video Pembelajaran</span>
                  <h3 class="fw-bold mb-3 text-dark">{{ selectedMateri.judul }}</h3>
                  <p class="text-muted fs-15 leading-loose mb-0">{{ stripHtml(selectedMateri.deskripsi) }}</p>
                </div>

                <div v-if="selectedMateri.konten" class="materi-content-area">
                   <h5 class="fw-bold mb-3 text-dark d-flex align-items-center gap-2">
                     <i class="ri-article-line text-primary"></i> Isi Materi
                   </h5>
                   <div class="materi-html-content fs-15 text-dark" v-html="selectedMateri.konten"></div>
                </div>

                <!-- File Pendukung -->
                <div v-if="selectedMateri.file_pendukung && selectedMateri.file_pendukung.length > 0" class="mt-5 pt-4 border-top border-dashed border-light">
                  <h5 class="fw-bold mb-3 text-dark d-flex align-items-center gap-2">
                    <i class="ri-attachment-2 text-primary"></i> File Pendukung
                  </h5>
                  <div class="row g-3">
                    <div v-for="file in selectedMateri.file_pendukung" :key="file.id" class="col-md-6">
                      <a :href="formatImageUrl(file.path_file)" :download="file.nama_file" target="_blank" class="card attachment-card border border-light shadow-none mb-0 rounded-4 text-decoration-none transition-all">
                        <div class="card-body p-3 d-flex align-items-center gap-3">
                          <div class="avatar bg-primary bg-opacity-10 rounded-3 flex-shrink-0">
                            <i class="ri-file-download-line fs-20 text-primary"></i>
                          </div>
                          <div class="flex-grow-1 overflow-hidden">
                            <h6 class="mb-1 fs-14 fw-semibold text-truncate text-dark" :title="file.nama_file">{{ file.nama_file }}</h6>
                            <div class="text-muted fs-12">{{ file.ukuran ? (file.ukuran / 1024).toFixed(1) + ' KB' : 'PDF' }}</div>
                          </div>
                          <div class="flex-shrink-0 text-primary opacity-50 attachment-arrow transition-all">
                            <i class="ri-download-cloud-2-line fs-20"></i>
                          </div>
                        </div>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Quiz Player -->
            <div v-else-if="selectedKuis" class="card border-0 shadow-sm rounded-4 overflow-hidden lms-player-card">
              <div class="quiz-header text-center p-4 border-bottom border-success border-opacity-10 position-relative">
                <div class="quiz-header-bg"></div>
                <div class="avatar avatar-xxl bg-success text-white rounded-circle shadow-sm mb-3 position-relative z-1 mx-auto d-flex align-items-center justify-content-center" style="width: 70px; height: 70px;">
                  <i class="ri-questionnaire-line fs-1"></i>
                </div>
                <h2 class="fw-black text-dark mb-3 position-relative z-1">{{ selectedKuis.judul }}</h2>
                <div class="d-flex justify-content-center gap-3 flex-wrap position-relative z-1">
                  <div class="badge bg-white text-dark px-4 py-2 rounded-pill shadow-sm border border-light fs-14 fw-medium d-flex align-items-center gap-2">
                    <i class="ri-timer-line text-warning fs-18"></i> {{ selectedKuis.durasi_menit || selectedKuis.durasi || 0 }} Menit
                  </div>
                  <div class="badge bg-white text-dark px-4 py-2 rounded-pill shadow-sm border border-light fs-14 fw-medium d-flex align-items-center gap-2">
                    <i class="ri-list-check-2 text-info fs-18"></i> {{ relatedSoal.length }} Soal
                  </div>
                  <div v-if="selectedKuis.passing_grade" class="badge bg-white text-dark px-4 py-2 rounded-pill shadow-sm border border-light fs-14 fw-medium d-flex align-items-center gap-2">
                    <i class="ri-bar-chart-line text-success fs-18"></i> Passing Grade: {{ selectedKuis.passing_grade }}%
                  </div>
                  <div v-if="selectedKuis.max_attempt" class="badge bg-white text-dark px-4 py-2 rounded-pill shadow-sm border border-light fs-14 fw-medium d-flex align-items-center gap-2">
                    <i class="ri-refresh-line text-primary fs-18"></i> Maks {{ selectedKuis.max_attempt }}x Percobaan
                  </div>
                </div>
              </div>

              <div class="card-body p-3 p-md-4 bg-light bg-opacity-50">
                <div v-if="loadingSoal" class="text-center py-5">
                   <div class="spinner-border text-success" role="status"></div>
                   <p class="mt-3 text-muted fw-medium">Menyiapkan soal evaluasi...</p>
                </div>
                <div v-else-if="relatedSoal.length > 0">
                   <div v-for="(soal, sIdx) in relatedSoal" :key="soal.id" class="card quiz-soal-card border-0 shadow-sm mb-4 rounded-4 transition-all">
                      <div class="card-body p-3 p-md-4">
                         <div class="d-flex gap-3 mb-3">
                           <div class="soal-number bg-success bg-opacity-10 text-success fw-black rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px; font-size: 1.1rem;">
                             {{ sIdx + 1 }}
                           </div>
                           <div class="soal-text fs-16 text-dark fw-semibold pt-1 leading-relaxed" v-html="soal.pertanyaan"></div>
                         </div>
                         <div class="row g-3 ps-xl-5">
                            <div v-for="opsi in soal.opsi" :key="opsi.label" class="col-md-6">
                               <div class="quiz-opsi-item p-3 border rounded-3 d-flex align-items-center gap-3 transition-all h-100"
                                 :class="opsi.text === soal.jawaban_benar || (soal.jawaban_benar === opsi.label && opsi.text) ? 'correct-opsi border-success' : 'bg-white border-light'">
                                 <div class="opsi-label rounded-circle flex-shrink-0 fw-bold d-flex align-items-center justify-content-center" 
                                   :class="opsi.text === soal.jawaban_benar || (soal.jawaban_benar === opsi.label && opsi.text) ? 'bg-success text-white' : 'bg-light text-muted'"
                                   style="width: 32px; height: 32px;">
                                   {{ opsi.label }}
                                 </div>
                                 <span class="flex-grow-1 fs-14 fw-medium" :class="opsi.text === soal.jawaban_benar || (soal.jawaban_benar === opsi.label && opsi.text) ? 'text-success-emphasis' : 'text-dark'">
                                   {{ opsi.text || '(Pilihan Kosong)' }}
                                 </span>
                                 <i v-if="opsi.text === soal.jawaban_benar || (soal.jawaban_benar === opsi.label && opsi.text)" class="ri-checkbox-circle-fill text-success fs-20"></i>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
                <div v-else class="text-center py-5 bg-white rounded-4 border border-dashed border-light shadow-sm">
                   <div class="avatar avatar-xl bg-light text-muted rounded-circle mb-3 mx-auto d-flex align-items-center justify-content-center"><i class="ri-ghost-line fs-1"></i></div>
                   <h5 class="fw-bold text-dark">Belum Ada Soal</h5>
                   <p class="text-muted mb-0">Kuis ini belum memiliki pertanyaan yang diinputkan.</p>
                </div>
              </div>
            </div>

            <!-- Empty State / Course Overview -->
            <div v-else class="card border-0 shadow-sm rounded-4 overflow-hidden lms-overview-card h-100">
              <div class="card-body p-3 p-md-4 d-flex flex-column h-100">
                <div class="text-center mb-5 py-4">
                  <div class="overview-icon-container mb-3 mx-auto position-relative" style="width: 80px; height: 80px;">
                     <div class="overview-icon-bg bg-primary bg-opacity-10 rounded-circle w-100 h-100 position-absolute pulse-anim"></div>
                     <div class="overview-icon-inner bg-white rounded-circle w-100 h-100 position-absolute d-flex align-items-center justify-content-center shadow-sm border border-light" style="z-index: 2;">
                        <i class="ri-rocket-2-fill text-primary" style="font-size: 2.5rem;"></i>
                     </div>
                  </div>
                  <h2 class="fw-black text-dark mb-2">Pratinjau Kelas Aktif</h2>
                  <p class="text-muted fs-16 px-xl-5 mb-0 max-w-3xl mx-auto">
                    Pilih materi atau kuis dari navigasi di sebelah kanan untuk melihat detail konten pembelajaran.
                  </p>
                </div>

                <div class="bg-light bg-opacity-50 rounded-4 p-3 p-md-4 border border-light flex-grow-1">
                  <h5 class="fw-bold mb-4 text-dark d-flex align-items-center gap-2 pb-3 border-bottom border-light">
                    <i class="ri-information-fill text-primary fs-20"></i> Informasi & Deskripsi Kelas
                  </h5>
                  <div class="course-description-content fs-15 text-dark leading-loose" v-html="currentKelas.deskripsi || '<p class=\'text-muted fst-italic\'>Tidak ada deskripsi tersedia untuk kelas ini.</p>'"></div>
                </div>
              </div>
            </div>

          </div>

          <!-- SYLLABUS SIDEBAR - RIGHT SIDE (col-xl-4) -->
          <div class="col-xl-4 order-1 order-xl-2">
            <div class="card border-0 shadow-sm rounded-4 sticky-top lms-syllabus-card" style="top: 80px; z-index: 10;">
              
              <!-- Sidebar Header -->
              <div class="card-header bg-white border-bottom border-light p-3">
                <h5 class="fw-bold mb-0 d-flex align-items-center justify-content-between">
                  <span>Konten Pembelajaran</span>
                  <span class="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-2 fs-12">{{ relatedMateri.length + relatedKuis.length }} Item</span>
                </h5>
              </div>

              <!-- General Info Button -->
              <div class="bg-white border-bottom border-light p-2">
                 <button @click="closePreview" class="w-100 btn text-start d-flex gap-3 align-items-center p-2 rounded-3 transition-all" :class="(!selectedMateri && !selectedKuis) ? 'bg-primary bg-opacity-10 border-primary border' : 'bg-light border-transparent border'">
                   <div class="avatar avatar-sm rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center" :class="(!selectedMateri && !selectedKuis) ? 'bg-primary text-white' : 'bg-white text-dark shadow-sm'">
                     <i class="ri-information-fill fs-16"></i>
                   </div>
                   <div class="fw-bold fs-14 flex-grow-1" :class="(!selectedMateri && !selectedKuis) ? 'text-primary' : 'text-dark'">
                     Informasi & Deskripsi Kelas
                   </div>
                   <i class="ri-arrow-right-s-line fs-18" :class="(!selectedMateri && !selectedKuis) ? 'text-primary' : 'text-muted'"></i>
                 </button>
              </div>

              <div class="card-body p-0 overflow-auto" style="max-height: calc(100vh - 240px);">
                
                <!-- Materi Section -->
                <div class="syllabus-section">
                  <div class="syllabus-section-header bg-light bg-opacity-50 px-3 py-2 border-bottom border-light d-flex align-items-center gap-2">
                    <i class="ri-book-open-fill text-primary fs-18"></i>
                    <h6 class="fw-bold text-dark mb-0 flex-grow-1">Daftar Materi</h6>
                    <span class="fs-12 fw-semibold text-muted">{{ relatedMateri.length }}</span>
                  </div>
                  <div class="list-group list-group-flush" v-if="relatedMateri.length > 0">
                    <button v-for="materi in relatedMateri" :key="materi.id" 
                      @click="viewMateri(materi)"
                      class="list-group-item list-group-item-action p-3 d-flex gap-3 align-items-start border-bottom border-light transition-all syllabus-item position-relative border-0 border-bottom"
                      :class="selectedMateri?.id === materi.id ? 'active-syllabus-materi' : ''">
                      
                      <div class="syllabus-icon flex-shrink-0 mt-1 transition-colors" :class="selectedMateri?.id === materi.id ? 'text-primary' : (materi.tipe === 'video' ? 'text-danger' : 'text-primary')">
                        <i :class="materi.tipe === 'video' ? 'ri-play-circle-fill' : 'ri-file-text-fill'" class="fs-24"></i>
                      </div>
                      <div class="flex-grow-1 overflow-hidden pe-2">
                        <h6 class="mb-2 fw-semibold fs-14 text-dark text-truncate transition-colors" :class="selectedMateri?.id === materi.id ? 'text-primary' : ''">{{ materi.judul }}</h6>
                        <div class="d-flex align-items-center gap-3 text-muted fs-12">
                           <span class="d-flex align-items-center gap-1"><i class="ri-price-tag-3-line"></i> {{ materi.kategori || 'Umum' }}</span>
                           <span class="d-flex align-items-center gap-1"><i class="ri-time-line"></i> 5-10 min</span>
                        </div>
                      </div>
                      <div class="active-indicator position-absolute top-0 start-0 h-100 bg-primary" :class="selectedMateri?.id === materi.id ? 'opacity-100' : 'opacity-0'" style="width: 4px; transition: all 0.3s ease;"></div>
                    </button>
                  </div>
                  <div v-else class="p-4 text-center text-muted fs-13 border-bottom border-light bg-white">Belum ada materi.</div>
                </div>

                <!-- Kuis Section -->
                <div class="syllabus-section">
                  <div class="syllabus-section-header bg-light bg-opacity-50 px-3 py-2 border-bottom border-light d-flex align-items-center gap-2">
                    <i class="ri-shield-check-fill text-success fs-18"></i>
                    <h6 class="fw-bold text-dark mb-0 flex-grow-1">Evaluasi & Kuis</h6>
                    <span class="fs-12 fw-semibold text-muted">{{ relatedKuis.length }}</span>
                  </div>
                  <div class="list-group list-group-flush" v-if="relatedKuis.length > 0">
                    <button v-for="(kuis, index) in relatedKuis" :key="kuis.id" 
                      @click="viewKuis(kuis)"
                      class="list-group-item list-group-item-action p-3 d-flex gap-3 align-items-start border-bottom border-light transition-all syllabus-item position-relative border-0 border-bottom"
                      :class="selectedKuis?.id === kuis.id ? 'active-syllabus-kuis' : ''">
                      
                      <div class="avatar avatar-sm rounded-circle flex-shrink-0 fw-bold fs-12 d-flex align-items-center justify-content-center mt-1 transition-colors"
                        :class="selectedKuis?.id === kuis.id ? 'bg-success text-white' : 'bg-success bg-opacity-10 text-success'">
                        Q{{ index + 1 }}
                      </div>
                      <div class="flex-grow-1 overflow-hidden pe-2">
                        <h6 class="mb-2 fw-semibold fs-14 text-dark text-truncate transition-colors" :class="selectedKuis?.id === kuis.id ? 'text-success' : ''">{{ kuis.judul }}</h6>
                        <div class="d-flex gap-3 fs-12 text-muted">
                          <span class="d-flex align-items-center gap-1"><i class="ri-timer-line"></i> {{ kuis.durasi_menit || kuis.durasi || 0 }} Menit</span>
                          <span class="d-flex align-items-center gap-1"><i class="ri-list-check-2"></i> {{ kuis.tipe_kuis === 'final' ? 'Kuis Akhir' : 'Per Materi' }}</span>
                        </div>
                      </div>
                      <div class="active-indicator position-absolute top-0 start-0 h-100 bg-success" :class="selectedKuis?.id === kuis.id ? 'opacity-100' : 'opacity-0'" style="width: 4px; transition: all 0.3s ease;"></div>
                    </button>
                  </div>
                  <div v-else class="p-4 text-center text-muted fs-13 bg-white pb-5">Belum ada kuis.</div>
                </div>

              </div>
            </div>

            <!-- Discussion / Diskusi Sidebar Card -->
            <div v-if="selectedMateri" class="card border-0 shadow-sm rounded-4 mt-4 mb-4">
              <div class="card-header bg-white border-bottom border-light p-3 d-flex align-items-center justify-content-between">
                <h5 class="fw-bold mb-0 d-flex align-items-center gap-2">
                  <i class="ri-chat-voice-line text-primary"></i> Diskusi Materi
                </h5>
                <span v-if="diskusiList.length > 0" class="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2 py-1 fs-11">
                  {{ diskusiList.length }}
                </span>
              </div>
              <div class="card-body p-0">
                <div v-if="isLoadingDiskusi" class="text-center py-4">
                  <div class="spinner-border text-primary spinner-border-sm" role="status"></div>
                  <p class="mt-2 text-muted fs-13 mb-0">Memuat diskusi...</p>
                </div>

                <div v-else-if="diskusiList.length === 0" class="bg-light bg-opacity-50 p-4 text-center">
                  <div class="avatar avatar-md bg-white rounded-circle mb-2 mx-auto d-flex align-items-center justify-content-center shadow-sm border border-light">
                    <i class="ri-chat-off-line text-muted"></i>
                  </div>
                  <h6 class="fw-bold text-dark fs-14 mb-1">Belum Ada Diskusi</h6>
                  <p class="text-muted fs-12 mb-0">Belum ada komentar pada materi ini.</p>
                </div>

                <div v-else class="discussion-list p-3" style="max-height: 400px; overflow-y: auto;">
                  <div v-for="d in diskusiList" :key="d.id" class="discussion-item mb-3 pb-3 border-bottom border-light last-child-no-border">
                    <div class="d-flex align-items-start gap-2">
                      <div class="user-avatar-sm rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center fw-bold flex-shrink-0" style="width: 32px; height: 32px; font-size: 13px;">
                        {{ (d.user_name || 'U').charAt(0).toUpperCase() }}
                      </div>
                      <div class="flex-grow-1 overflow-hidden">
                        <div class="d-flex justify-content-between align-items-start mb-1">
                          <div>
                            <div class="fw-bold fs-13 text-dark text-truncate" style="max-width: 150px;">{{ d.user_name }}</div>
                            <div class="text-muted" style="font-size: 10px;">{{ d.created_at }}</div>
                          </div>
                          <button @click="deleteDiskusi(d.id)" class="btn btn-sm btn-icon btn-ghost-danger rounded-circle p-1" style="width: 24px; height: 24px;" title="Hapus Komentar">
                            <i class="ri-delete-bin-line fs-14"></i>
                          </button>
                        </div>
                        <div class="discussion-text fs-13 text-dark bg-light bg-opacity-50 p-2 rounded-3 border border-light mt-1" style="white-space: pre-wrap; line-height: 1.4;">{{ d.komentar }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </template>
      <div v-else class="card border-0 shadow-sm rounded-4">
        <div class="card-body text-center p-5">
           <div class="avatar avatar-xxl bg-danger bg-opacity-10 text-danger rounded-circle mb-4 mx-auto d-flex align-items-center justify-content-center">
             <i class="ri-error-warning-fill" style="font-size: 3rem;"></i>
           </div>
           <h4 class="fw-bold mb-2 text-dark">Kelas Tidak Ditemukan</h4>
           <p class="text-muted fs-15 mb-4 max-w-md mx-auto">Kelas yang Anda cari mungkin sudah dihapus, statusnya tidak aktif, atau ID kelas tidak valid.</p>
           <button @click="goBack" class="btn btn-primary rounded-pill px-4 py-2 fw-medium shadow-sm d-inline-flex align-items-center gap-2">
             <i class="ri-arrow-left-line"></i> Kembali ke Daftar Kelas
           </button>
        </div>
      </div>
    </div>
  </div>
</template>

