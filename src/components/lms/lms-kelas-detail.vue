<script lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import gsap from "gsap";
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
    const detailRoot = ref<HTMLElement | null>(null);
    const learningContentRef = ref<HTMLElement | null>(null);
    const isDarkMode = ref(false);
    let pageGsapCtx: gsap.Context | null = null;
    let mainContentGsapCtx: gsap.Context | null = null;
    let supplementaryGsapCtx: gsap.Context | null = null;
    let themeObserver: MutationObserver | undefined;
    
    // UI State for Preview
    const selectedMateri = ref<LmsMateri | null>(null);
    const selectedKuis = ref<LmsKuis | null>(null);
    const relatedSoal = ref<LmsSoal[]>([]);
    const loadingSoal = ref(false);
    
    // Feedback State
    const feedbackList = computed(() => lmsStore.feedbackList);
    const isLoadingFeedback = ref(false);

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

    const syncThemeMode = () => {
      if (typeof document === "undefined") return;
      const root = document.documentElement;
      isDarkMode.value = root.getAttribute("data-theme-mode") === "dark" || root.classList.contains("dark");
    };

    const isCorrectOpsi = (soal: LmsSoal, opsi: any) =>
      Boolean(opsi.text === soal.jawaban_benar || (soal.jawaban_benar === opsi.label && opsi.text));

    const prefersReducedMotion = () =>
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const runDetailEntranceAnimation = () => {
      nextTick(() => {
        if (prefersReducedMotion()) return;
        const root = detailRoot.value;
        if (!root) return;

        pageGsapCtx?.revert();
        pageGsapCtx = gsap.context(() => {
          const hero = root.querySelector(".lms-preview-hero");
          const heroPieces = root.querySelectorAll(
            ".hero-thumbnail-wrap, .hero-icon-placeholder, .hero-title, .hero-subtitle, .hero-stat-item, .hero-actions"
          );
          const panels = root.querySelectorAll(".lms-overview-card, .lms-syllabus-card");
          const syllabusItems = Array.from(root.querySelectorAll(".syllabus-item")).slice(0, 18);

          const tl = gsap.timeline({ defaults: { ease: "power3.out", overwrite: "auto" } });
          if (hero) tl.fromTo(hero, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, clearProps: "transform,opacity" });
          if (heroPieces.length) {
            tl.fromTo(
              heroPieces,
              { y: 12, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.32, stagger: 0.035, clearProps: "transform,opacity" },
              "-=0.22"
            );
          }
          if (panels.length) {
            tl.fromTo(
              panels,
              { y: 16, opacity: 0, scale: 0.995, force3D: true },
              { y: 0, opacity: 1, scale: 1, duration: 0.36, stagger: 0.06, clearProps: "transform,opacity" },
              "-=0.14"
            );
          }
          if (syllabusItems.length) {
            tl.fromTo(
              syllabusItems,
              { x: 10, opacity: 0 },
              { x: 0, opacity: 1, duration: 0.24, stagger: 0.025, clearProps: "transform,opacity" },
              "-=0.2"
            );
          }
        }, root);
      });
    };

    const runMainContentAnimation = () => {
      nextTick(() => {
        if (prefersReducedMotion()) return;
        const root = detailRoot.value;
        if (!root) return;

        mainContentGsapCtx?.revert();
        mainContentGsapCtx = gsap.context(() => {
          const activePanel = root.querySelector(".lms-player-card, .lms-overview-card");
          if (!activePanel) return;

          gsap.fromTo(
            activePanel,
            { y: 14, opacity: 0.92, scale: 0.996, force3D: true },
            { y: 0, opacity: 1, scale: 1, duration: 0.3, ease: "power2.out", overwrite: "auto", clearProps: "transform,opacity" }
          );
        }, root);
      });
    };

    const runSupplementaryAnimation = (targets: { quiz?: boolean; attachments?: boolean; feedback?: boolean } = {}) => {
      nextTick(() => {
        if (prefersReducedMotion()) return;
        const root = detailRoot.value;
        if (!root) return;

        supplementaryGsapCtx?.revert();
        supplementaryGsapCtx = gsap.context(() => {
          const quizCards = Array.from(root.querySelectorAll(".quiz-soal-card")).slice(0, 8);
          const attachments = Array.from(root.querySelectorAll(".attachment-card")).slice(0, 8);
          const feedbackCard = root.querySelector(".lms-feedback-card");
          const feedbackItems = Array.from(root.querySelectorAll(".discussion-item")).slice(0, 8);

          const tl = gsap.timeline({ defaults: { ease: "power2.out", overwrite: "auto" } });
          if (targets.quiz && quizCards.length) {
            tl.fromTo(
              quizCards,
              { y: 12, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.24, stagger: 0.04, clearProps: "transform,opacity" },
              0
            );
          }
          if (targets.attachments && attachments.length) {
            tl.fromTo(
              attachments,
              { y: 10, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.22, stagger: 0.035, clearProps: "transform,opacity" },
              quizCards.length ? "-=0.08" : 0
            );
          }
          if (targets.feedback && feedbackCard) {
            tl.fromTo(
              feedbackCard,
              { y: 10, opacity: 0.94 },
              { y: 0, opacity: 1, duration: 0.24, clearProps: "transform,opacity" },
              0
            );
          }
          if (targets.feedback && feedbackItems.length) {
            tl.fromTo(
              feedbackItems,
              { y: 8, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.2, stagger: 0.03, clearProps: "transform,opacity" },
              "-=0.08"
            );
          }
        }, root);
      });
    };

    onMounted(async () => {
      syncThemeMode();
      if (typeof document !== "undefined") {
        themeObserver = new MutationObserver(syncThemeMode);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-mode", "class"] });
      }
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
      if (currentKelas.value) runDetailEntranceAnimation();
    });

    onBeforeUnmount(() => {
      pageGsapCtx?.revert();
      mainContentGsapCtx?.revert();
      supplementaryGsapCtx?.revert();
      themeObserver?.disconnect();
    });

    const stripHtml = (html?: string) => {
      if (!html) return "-";
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || "";
    };

    const goBack = () => router.push('/lms/kelas');

    const scrollToLearningContent = async () => {
      await nextTick();
      const target = learningContentRef.value;
      if (!target || typeof window === "undefined") return;

      const topOffset = window.innerWidth < 1200 ? 84 : 96;
      const targetTop = target.getBoundingClientRect().top + window.scrollY - topOffset;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    };

    const viewMateri = async (materi: LmsMateri) => {
      selectedMateri.value = materi;
      selectedKuis.value = null;
      relatedSoal.value = [];
      runMainContentAnimation();
      runSupplementaryAnimation({ attachments: true });
      await scrollToLearningContent();

      // Fetch Feedback
      isLoadingFeedback.value = true;
      try {
        await lmsStore.fetchFeedback(materi.id);
      } catch (e) {
        console.error('Failed to load feedback:', e);
      } finally {
        isLoadingFeedback.value = false;
        runSupplementaryAnimation({ feedback: true });
      }
    };

    const viewKuis = async (kuis: LmsKuis) => {
      selectedKuis.value = kuis;
      selectedMateri.value = null;
      loadingSoal.value = true;
      runMainContentAnimation();
      await scrollToLearningContent();
      try {
        // Uses soal cache if available (instant on re-select)
        await lmsStore.fetchSoal(kuis.id);
        relatedSoal.value = [...lmsStore.soalList];
      } catch (e) {
        relatedSoal.value = [];
      } finally {
        loadingSoal.value = false;
        runSupplementaryAnimation({ quiz: true });
      }
    };

    const closePreview = async () => {
      selectedMateri.value = null;
      selectedKuis.value = null;
      relatedSoal.value = [];
      runMainContentAnimation();
      await scrollToLearningContent();
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
      detailRoot,
      learningContentRef,
      isDarkMode,
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
      isCorrectOpsi,
      activeYoutubeId,
      formatImageUrl,
      feedbackList,
      isLoadingFeedback
    };
  },
};</script>

<template>
  <pageheader :propData="dataToPass" />

  <div ref="detailRoot" class="row lms-kelas-detail-page" :class="{ 'is-lms-dark': isDarkMode }">
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
                  <img :src="currentKelas.thumbnail" class="w-100 h-100 object-fit-cover" alt="Kelas Thumbnail" decoding="async" />
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
                  <p class="hero-subtitle text-white-50 mb-0 fs-15 max-w-2xl line-clamp-1">{{ currentKelas.deskripsi || 'Pengantar Pembelajaran' }}</p>
                </div>
              </div>
              
                <div class="hero-stats-stack mt-3 d-flex flex-wrap gap-4">
                <div v-if="currentKelas.kategori" class="hero-stat-item d-flex align-items-center gap-2 text-white">
                  <div class="stat-icon-wrap"><i class="ri-price-tag-3-line"></i></div>
                  <div>
                    <div class="fs-11 text-white-50 text-uppercase fw-semibold tracking-wide">Kategori</div>
                    <div class="fw-bold fs-14">{{ currentKelas.kategori }}</div>
                  </div>
                </div>
                <div v-if="currentKelas.durasi_jp" class="hero-stat-item d-flex align-items-center gap-2 text-white">
                  <div class="stat-icon-wrap"><i class="ri-time-line"></i></div>
                  <div>
                    <div class="fs-11 text-white-50 text-uppercase fw-semibold tracking-wide">Durasi</div>
                    <div class="fw-bold fs-14">{{ currentKelas.durasi_jp }} JP</div>
                  </div>
                </div>
                <div v-if="currentKelas.penyelenggara" class="hero-stat-item d-flex align-items-center gap-2 text-white">
                  <div class="stat-icon-wrap"><i class="ri-building-line"></i></div>
                  <div>
                    <div class="fs-11 text-white-50 text-uppercase fw-semibold tracking-wide">Penyelenggara</div>
                    <div class="fw-bold fs-14">{{ currentKelas.penyelenggara }}</div>
                  </div>
                </div>
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
          <div ref="learningContentRef" class="col-xl-8 order-2 order-xl-1 lms-learning-content">
            
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

              <div class="card-body p-3 p-md-4" :class="isDarkMode ? 'lms-dark-card' : 'bg-light bg-opacity-50'">
                <div v-if="loadingSoal" class="text-center py-5">
                   <div class="spinner-border text-success" role="status"></div>
                   <p class="mt-3 text-muted fw-medium">Menyiapkan soal evaluasi...</p>
                </div>
                <div v-else-if="relatedSoal.length > 0">
                   <div v-for="(soal, sIdx) in relatedSoal" :key="soal.id" class="card quiz-soal-card shadow-sm mb-4 rounded-4 overflow-hidden transition-all" :class="isDarkMode ? 'lms-dark-card lms-dark-question-border' : 'border-0'">
                      <div class="card-header border-bottom p-3 p-md-4" :class="isDarkMode ? 'lms-dark-section lms-dark-border' : 'bg-white border-light'">
                         <div class="d-flex align-items-center gap-3">
                           <div class="soal-number-badge bg-primary text-white fw-bold rounded-3 d-flex align-items-center justify-content-center shadow-sm" style="width: 36px; height: 36px; font-size: 1rem;">
                             {{ sIdx + 1 }}
                           </div>
                           <div class="soal-text fs-16 fw-bold" :class="isDarkMode ? 'lms-dark-title' : 'text-dark'" v-html="soal.pertanyaan"></div>
                         </div>
                      </div>
                      <div class="card-body p-3 p-md-4">
                         <div class="row g-3">
                            <div v-for="opsi in soal.opsi" :key="opsi.label" class="col-md-6">
                               <div class="quiz-opsi-item p-3 border rounded-3 d-flex align-items-center gap-3 transition-all h-100 position-relative cursor-pointer"
                                 :class="isCorrectOpsi(soal, opsi) ? 'correct-opsi' : (isDarkMode ? 'lms-dark-option' : 'bg-white')">
                                 <div class="opsi-label rounded-circle flex-shrink-0 fw-bold d-flex align-items-center justify-content-center border" 
                                   :class="isCorrectOpsi(soal, opsi) ? 'bg-success text-white border-success' : (isDarkMode ? 'lms-dark-icon lms-dark-muted lms-dark-border' : 'bg-light text-muted border-light')"
                                   style="width: 30px; height: 30px; font-size: 13px;">
                                   {{ opsi.label }}
                                 </div>
                                 <span class="flex-grow-1 fs-14 fw-medium" :class="isCorrectOpsi(soal, opsi) ? (isDarkMode ? 'lms-dark-correct-text' : 'text-success-emphasis') : (isDarkMode ? 'lms-dark-title' : 'text-dark')">
                                   {{ opsi.text || '(Pilihan Kosong)' }}
                                 </span>
                                 <div v-if="isCorrectOpsi(soal, opsi)" class="correct-badge shadow-sm">
                                   <i class="ri-checkbox-circle-fill text-success fs-18"></i>
                                 </div>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
                <div v-else class="text-center py-5 rounded-4 border border-dashed shadow-sm" :class="isDarkMode ? 'lms-dark-soft lms-dark-border' : 'bg-white border-light'">
                   <div class="avatar avatar-xl rounded-circle mb-3 mx-auto d-flex align-items-center justify-content-center" :class="isDarkMode ? 'lms-dark-icon lms-dark-muted' : 'bg-light text-muted'"><i class="ri-ghost-line fs-1"></i></div>
                   <h5 class="fw-bold" :class="isDarkMode ? 'lms-dark-title' : 'text-dark'">Belum Ada Soal</h5>
                   <p class="mb-0" :class="isDarkMode ? 'lms-dark-muted' : 'text-muted'">Kuis ini belum memiliki pertanyaan yang diinputkan.</p>
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
                  <div v-if="currentKelas.informasi_umum || currentKelas.target_peserta || currentKelas.syarat_pendaftaran" class="row g-3 mt-3">
                    <div v-if="currentKelas.informasi_umum" class="col-12">
                      <div class="fw-bold text-dark mb-1">Informasi Umum</div>
                      <div class="text-muted fs-14">{{ currentKelas.informasi_umum }}</div>
                    </div>
                    <div v-if="currentKelas.target_peserta" class="col-md-6">
                      <div class="fw-bold text-dark mb-1">Target Peserta</div>
                      <div class="text-muted fs-14">{{ currentKelas.target_peserta }}</div>
                    </div>
                    <div v-if="currentKelas.syarat_pendaftaran" class="col-md-6">
                      <div class="fw-bold text-dark mb-1">Syarat Pendaftaran</div>
                      <div class="text-muted fs-14">{{ currentKelas.syarat_pendaftaran }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- SYLLABUS SIDEBAR - RIGHT SIDE (col-xl-4) -->
          <div class="col-xl-4 order-1 order-xl-2">
            <div class="card border-0 shadow-sm rounded-4 sticky-top lms-syllabus-card" style="top: 80px; z-index: 10;">
              
              <!-- Sidebar Header -->
              <div class="card-header border-bottom p-3 syllabus-card-header" :class="isDarkMode ? 'lms-dark-panel lms-dark-border' : 'bg-white border-light'">
                <div class="d-flex align-items-start justify-content-between gap-3">
                  <div>
                    <h5 class="fw-bold mb-1" :class="isDarkMode ? 'lms-dark-title' : 'text-dark'">Konten Pembelajaran</h5>
                    <div class="fs-12" :class="isDarkMode ? 'lms-dark-muted' : 'text-muted'">Pilih materi atau kuis untuk melihat pratinjau.</div>
                  </div>
                  <span class="badge rounded-pill px-3 py-2 fs-12 flex-shrink-0" :class="isDarkMode ? 'lms-dark-chip text-primary' : 'bg-primary bg-opacity-10 text-primary'">{{ relatedMateri.length + relatedKuis.length }} Item</span>
                </div>
                <div class="syllabus-summary-strip d-flex align-items-center gap-2 mt-3">
                  <span class="syllabus-summary-chip text-primary" :class="isDarkMode ? 'lms-dark-chip' : ''">
                    <i class="ri-book-open-line"></i>{{ relatedMateri.length }} Materi
                  </span>
                  <span class="syllabus-summary-chip text-success" :class="isDarkMode ? 'lms-dark-chip' : ''">
                    <i class="ri-questionnaire-line"></i>{{ relatedKuis.length }} Kuis
                  </span>
                </div>
              </div>

              <!-- General Info Button -->
              <div class="border-bottom p-2 syllabus-overview-wrap" :class="isDarkMode ? 'lms-dark-card lms-dark-border' : 'bg-white border-light'">
                 <button @click="closePreview" class="w-100 btn text-start d-flex gap-3 align-items-center p-3 rounded-3 transition-all syllabus-overview-btn" :class="[
                   (!selectedMateri && !selectedKuis) ? 'is-active border' : 'border',
                   isDarkMode
                     ? ((!selectedMateri && !selectedKuis) ? 'lms-dark-active-primary' : 'lms-dark-soft')
                     : ((!selectedMateri && !selectedKuis) ? 'bg-primary bg-opacity-10 border-primary' : 'bg-light border-transparent')
                 ]">
                   <div class="avatar avatar-sm rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center syllabus-overview-icon" :class="[
                     (!selectedMateri && !selectedKuis) ? 'bg-primary text-white' : '',
                     isDarkMode && (selectedMateri || selectedKuis) ? 'lms-dark-icon' : '',
                     !isDarkMode && (selectedMateri || selectedKuis) ? 'bg-white text-dark shadow-sm' : ''
                   ]">
                     <i class="ri-information-fill fs-16"></i>
                   </div>
                   <div class="flex-grow-1 min-w-0">
                     <div class="fw-bold fs-14" :class="(!selectedMateri && !selectedKuis) ? 'text-primary' : (isDarkMode ? 'lms-dark-title' : 'text-dark')">Informasi & Deskripsi Kelas</div>
                     <div class="fs-12 mt-1" :class="isDarkMode ? 'lms-dark-muted' : 'text-muted'">Ringkasan dan detail umum kelas</div>
                   </div>
                   <span class="syllabus-action-dot" :class="[
                     (!selectedMateri && !selectedKuis) ? 'text-primary' : (isDarkMode ? 'lms-dark-muted' : 'text-muted'),
                     isDarkMode ? 'lms-dark-icon' : 'bg-white'
                   ]">
                     <i class="ri-arrow-right-s-line fs-18"></i>
                   </span>
                 </button>
              </div>

              <div class="card-body p-0 overflow-auto" style="max-height: calc(100vh - 240px);">
                
                <!-- Materi Section -->
                <div class="syllabus-section">
                  <div class="syllabus-section-header px-3 py-3 border-bottom d-flex align-items-center gap-2" :class="isDarkMode ? 'lms-dark-section lms-dark-border' : 'bg-light bg-opacity-50 border-light'">
                    <span class="syllabus-section-icon text-primary bg-primary bg-opacity-10"><i class="ri-book-open-fill fs-17"></i></span>
                    <h6 class="fw-bold mb-0 flex-grow-1" :class="isDarkMode ? 'lms-dark-title' : 'text-dark'">Daftar Materi</h6>
                    <span class="syllabus-count-pill text-primary" :class="isDarkMode ? 'lms-dark-chip' : ''">{{ relatedMateri.length }}</span>
                  </div>
                  <div class="list-group list-group-flush" v-if="relatedMateri.length > 0">
                    <button v-for="(materi, index) in relatedMateri" :key="materi.id" 
                      @click="viewMateri(materi)"
                      class="list-group-item list-group-item-action p-3 d-flex gap-3 align-items-start border-bottom transition-all syllabus-item syllabus-item-enhanced position-relative border-0 border-bottom"
                      :class="[selectedMateri?.id === materi.id ? 'active-syllabus-materi' : '', isDarkMode ? 'lms-dark-item lms-dark-border' : 'border-light']">
                      
                      <div class="syllabus-step-icon flex-shrink-0 transition-colors" :class="[
                        selectedMateri?.id === materi.id ? 'is-active text-primary' : (materi.tipe === 'video' ? 'text-danger' : 'text-primary'),
                        isDarkMode ? 'lms-dark-file-icon' : ''
                      ]">
                        <i :class="materi.tipe === 'video' ? 'ri-play-circle-fill' : 'ri-file-text-fill'" class="fs-20"></i>
                      </div>
                      <div class="flex-grow-1 overflow-hidden pe-1">
                        <div class="d-flex align-items-center gap-2 mb-1">
                          <span class="syllabus-order" :class="isDarkMode ? 'lms-dark-muted' : 'text-muted'">M{{ index + 1 }}</span>
                          <span v-if="selectedMateri?.id === materi.id" class="active-mini-badge text-primary" :class="isDarkMode ? 'lms-dark-chip' : ''">Dibuka</span>
                        </div>
                        <h6 class="mb-2 fw-semibold fs-14 syllabus-item-title transition-colors" :class="selectedMateri?.id === materi.id ? 'text-primary' : (isDarkMode ? 'lms-dark-title' : 'text-dark')" :title="materi.judul">{{ materi.judul }}</h6>
                        <div class="d-flex align-items-center fs-12 syllabus-meta-row" :class="isDarkMode ? 'lms-dark-muted' : 'text-muted'">
                           <span class="d-flex align-items-center gap-1"><i class="ri-price-tag-3-line"></i> {{ materi.kategori || 'Umum' }}</span>
                           <span class="d-flex align-items-center gap-1"><i class="ri-time-line"></i> 5-10 min</span>
                           <span class="d-flex align-items-center gap-1 text-capitalize"><i :class="materi.tipe === 'video' ? 'ri-video-line' : 'ri-article-line'"></i> {{ materi.tipe || 'teks' }}</span>
                        </div>
                      </div>
                      <span class="syllabus-action-dot flex-shrink-0" :class="[
                        selectedMateri?.id === materi.id ? 'text-primary' : (isDarkMode ? 'lms-dark-muted' : 'text-muted'),
                        isDarkMode ? 'lms-dark-icon' : (selectedMateri?.id === materi.id ? 'bg-white' : 'bg-light')
                      ]">
                        <i class="ri-arrow-right-s-line fs-18"></i>
                      </span>
                      <div class="active-indicator position-absolute top-0 start-0 h-100 bg-primary" :class="selectedMateri?.id === materi.id ? 'opacity-100' : 'opacity-0'"></div>
                    </button>
                  </div>
                  <div v-else class="p-4 text-center text-muted fs-13 border-bottom border-light bg-white syllabus-empty-state">
                    <i class="ri-book-open-line d-block mb-2 fs-24 text-primary opacity-50"></i>
                    Belum ada materi.
                  </div>
                </div>

                <!-- Kuis Section -->
                <div class="syllabus-section">
                  <div class="syllabus-section-header px-3 py-3 border-bottom d-flex align-items-center gap-2" :class="isDarkMode ? 'lms-dark-section lms-dark-border' : 'bg-light bg-opacity-50 border-light'">
                    <span class="syllabus-section-icon text-success bg-success bg-opacity-10"><i class="ri-shield-check-fill fs-17"></i></span>
                    <h6 class="fw-bold mb-0 flex-grow-1" :class="isDarkMode ? 'lms-dark-title' : 'text-dark'">Evaluasi & Kuis</h6>
                    <span class="syllabus-count-pill text-success" :class="isDarkMode ? 'lms-dark-chip' : ''">{{ relatedKuis.length }}</span>
                  </div>
                  <div class="list-group list-group-flush" v-if="relatedKuis.length > 0">
                    <button v-for="(kuis, index) in relatedKuis" :key="kuis.id" 
                      @click="viewKuis(kuis)"
                      class="list-group-item list-group-item-action p-3 d-flex gap-3 align-items-start border-bottom transition-all syllabus-item syllabus-item-enhanced position-relative border-0 border-bottom"
                      :class="[selectedKuis?.id === kuis.id ? 'active-syllabus-kuis' : '', isDarkMode ? 'lms-dark-item lms-dark-border' : 'border-light']">
                      
                      <div class="avatar avatar-sm rounded-circle flex-shrink-0 fw-bold fs-12 d-flex align-items-center justify-content-center syllabus-quiz-badge transition-colors"
                        :class="selectedKuis?.id === kuis.id ? 'bg-success text-white' : 'bg-success bg-opacity-10 text-success'">
                        Q{{ index + 1 }}
                      </div>
                      <div class="flex-grow-1 overflow-hidden pe-1">
                        <div class="d-flex align-items-center gap-2 mb-1">
                          <span class="syllabus-order" :class="isDarkMode ? 'lms-dark-muted' : 'text-muted'">Evaluasi</span>
                          <span v-if="selectedKuis?.id === kuis.id" class="active-mini-badge text-success">Dibuka</span>
                        </div>
                        <h6 class="mb-2 fw-semibold fs-14 syllabus-item-title transition-colors" :class="selectedKuis?.id === kuis.id ? 'text-success' : (isDarkMode ? 'lms-dark-title' : 'text-dark')" :title="kuis.judul">{{ kuis.judul }}</h6>
                        <div class="d-flex fs-12 syllabus-meta-row" :class="isDarkMode ? 'lms-dark-muted' : 'text-muted'">
                          <span class="d-flex align-items-center gap-1"><i class="ri-timer-line"></i> {{ kuis.durasi_menit || kuis.durasi || 0 }} Menit</span>
                          <span class="d-flex align-items-center gap-1"><i class="ri-list-check-2"></i> {{ kuis.tipe_kuis === 'final' ? 'Kuis Akhir' : 'Per Materi' }}</span>
                        </div>
                      </div>
                      <span class="syllabus-action-dot flex-shrink-0" :class="[
                        selectedKuis?.id === kuis.id ? 'text-success' : (isDarkMode ? 'lms-dark-muted' : 'text-muted'),
                        isDarkMode ? 'lms-dark-icon' : (selectedKuis?.id === kuis.id ? 'bg-white' : 'bg-light')
                      ]">
                        <i class="ri-arrow-right-s-line fs-18"></i>
                      </span>
                      <div class="active-indicator position-absolute top-0 start-0 h-100 bg-success" :class="selectedKuis?.id === kuis.id ? 'opacity-100' : 'opacity-0'"></div>
                    </button>
                  </div>
                  <div v-else class="p-4 text-center text-muted fs-13 bg-white pb-5 syllabus-empty-state">
                    <i class="ri-questionnaire-line d-block mb-2 fs-24 text-success opacity-50"></i>
                    Belum ada kuis.
                  </div>
                </div>

              </div>
            </div>

            <!-- Feedback Sidebar Card -->
            <div v-if="selectedMateri" class="card border-0 shadow-sm rounded-4 mt-4 mb-4 lms-feedback-card">
              <div class="card-header bg-white border-bottom border-light p-3 d-flex align-items-center justify-content-between">
                <h5 class="fw-bold mb-0 d-flex align-items-center gap-2">
                  <i class="ri-feedback-line text-primary"></i> Feedback Materi
                </h5>
                <span v-if="feedbackList.length > 0" class="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2 py-1 fs-11">
                  {{ feedbackList.length }}
                </span>
              </div>
              <div class="card-body p-0">
                <div v-if="isLoadingFeedback" class="text-center py-4">
                  <div class="spinner-border text-primary spinner-border-sm" role="status"></div>
                  <p class="mt-2 text-muted fs-13 mb-0">Memuat feedback...</p>
                </div>

                <div v-else-if="feedbackList.length === 0" class="bg-light bg-opacity-50 p-4 text-center">
                  <div class="avatar avatar-md bg-white rounded-circle mb-2 mx-auto d-flex align-items-center justify-content-center shadow-sm border border-light">
                    <i class="ri-feedback-line text-muted"></i>
                  </div>
                  <h6 class="fw-bold text-dark fs-14 mb-1">Belum Ada Feedback</h6>
                  <p class="text-muted fs-12 mb-0">Belum ada feedback pada materi ini.</p>
                </div>

                <div v-else class="discussion-list p-3" style="max-height: 400px; overflow-y: auto;">
                  <div v-for="d in feedbackList" :key="d.id" class="discussion-item mb-3 pb-3 border-bottom border-light last-child-no-border">
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
                          <span v-if="d.rating !== undefined" class="badge bg-warning bg-opacity-10 text-warning rounded-pill fs-11">
                            <i class="ri-star-fill me-1"></i>{{ d.rating }}
                          </span>
                        </div>
                        <div class="discussion-text fs-13 text-dark bg-light bg-opacity-50 p-2 rounded-3 border border-light mt-1" style="white-space: pre-wrap; line-height: 1.4;">{{ d.feedback || d.komentar }}</div>
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

<style scoped>
.line-clamp-1 {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.lms-kelas-detail-page,
.lms-kelas-detail-page * {
  min-width: 0;
}

.lms-kelas-detail-page {
  scroll-behavior: smooth;
}

.lms-learning-content {
  scroll-margin-top: 96px;
}

.lms-preview-hero {
  overflow: hidden;
}

.lms-preview-hero-content,
.hero-main-info {
  min-width: 0;
}

.hero-title,
.hero-subtitle,
.hero-stat-item,
.materi-html-content,
.course-description-content,
.soal-text,
.quiz-opsi-item span {
  overflow-wrap: anywhere;
  word-break: normal;
}

.materi-html-content :deep(img),
.course-description-content :deep(img),
.materi-html-content :deep(video),
.course-description-content :deep(video),
.materi-html-content :deep(iframe),
.course-description-content :deep(iframe) {
  max-width: 100%;
  height: auto;
}

.materi-html-content :deep(table),
.course-description-content :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  white-space: nowrap;
}

.materi-html-content :deep(pre),
.course-description-content :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  white-space: pre-wrap;
}

.lms-syllabus-card {
  overflow: hidden;
}

.syllabus-card-header {
  background: #ffffff;
}

.syllabus-summary-strip {
  flex-wrap: wrap;
}

.syllabus-summary-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 6px 10px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.syllabus-overview-wrap {
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
}

.syllabus-overview-btn {
  min-height: 66px;
}

.syllabus-overview-btn:hover,
.syllabus-item-enhanced:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.syllabus-overview-btn.is-active {
  box-shadow: inset 0 0 0 1px rgba(13, 110, 253, 0.12), 0 10px 24px rgba(13, 110, 253, 0.08);
}

.syllabus-overview-icon,
.syllabus-step-icon,
.syllabus-quiz-badge {
  width: 36px;
  height: 36px;
}

.syllabus-step-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}

.syllabus-step-icon.is-active {
  background: #ffffff;
  box-shadow: 0 8px 18px rgba(13, 110, 253, 0.12);
}

.syllabus-section-header {
  min-height: 54px;
}

.syllabus-section-icon {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.syllabus-count-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 26px;
  padding: 0 9px;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid #eef2f7;
  font-size: 12px;
  font-weight: 800;
}

.syllabus-item-enhanced {
  min-height: 92px;
  background: #ffffff;
  isolation: isolate;
}

.syllabus-item-enhanced.active-syllabus-materi {
  background: #f5f9ff !important;
}

.syllabus-item-enhanced.active-syllabus-kuis {
  background: #f1fcf7 !important;
}

.syllabus-item-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
}

.syllabus-order {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.active-mini-badge {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid #eef2f7;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}

.syllabus-meta-row {
  gap: 10px 14px;
  flex-wrap: wrap;
}

.syllabus-action-dot {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #eef2f7;
  transition: all 0.2s ease;
}

.syllabus-item-enhanced:hover .syllabus-action-dot,
.syllabus-overview-btn:hover .syllabus-action-dot {
  transform: translateX(2px);
}

.active-indicator {
  width: 4px;
  transition: opacity 0.2s ease;
}

.syllabus-empty-state {
  min-height: 96px;
}

.min-w-0 {
  min-width: 0;
}

.lms-dark-panel {
  background: #1f2937 !important;
}

.lms-dark-card {
  background: #111827 !important;
}

.lms-dark-section {
  background: #151d2b !important;
}

.lms-dark-soft {
  background: rgba(255, 255, 255, 0.045) !important;
}

.lms-dark-icon {
  background: rgba(15, 23, 42, 0.78) !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
  color: #cbd5e1 !important;
}

.lms-dark-chip {
  background: rgba(15, 23, 42, 0.78) !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
  box-shadow: none !important;
}

.lms-dark-file-icon {
  background: rgba(15, 23, 42, 0.86) !important;
  border-color: rgba(96, 165, 250, 0.28) !important;
  color: #60a5fa !important;
}

.lms-dark-border {
  border-color: rgba(148, 163, 184, 0.14) !important;
}

.lms-dark-question-border {
  border: 1px solid rgba(226, 232, 240, 0.72) !important;
}

.lms-dark-title {
  color: #f8fafc !important;
}

.lms-dark-muted {
  color: #9fb0c7 !important;
}

.lms-dark-active-primary {
  background: rgba(59, 130, 246, 0.16) !important;
  border-color: rgba(96, 165, 250, 0.45) !important;
}

.lms-dark-option {
  background: #1f2937 !important;
  border-color: rgba(226, 232, 240, 0.65) !important;
  color: #f8fafc !important;
}

.lms-dark-correct-text {
  color: #dcfce7 !important;
}

.is-lms-dark .lms-syllabus-card {
  background: #111827 !important;
}

.is-lms-dark .syllabus-overview-wrap {
  background: #111827 !important;
}

.is-lms-dark .syllabus-item-enhanced.active-syllabus-materi {
  background: rgba(37, 99, 235, 0.18) !important;
}

.is-lms-dark .syllabus-item-enhanced.active-syllabus-kuis {
  background: rgba(34, 197, 94, 0.14) !important;
}

.is-lms-dark .syllabus-item-enhanced:hover {
  background: #141e31 !important;
}

.is-lms-dark .correct-opsi {
  background: rgba(34, 197, 94, 0.16) !important;
  border-color: #22c55e !important;
  color: #dcfce7 !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .lms-syllabus-card {
  background: #111827 !important;
  border: 1px solid rgba(148, 163, 184, 0.14) !important;
  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.32) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .lms-syllabus-card .card-header,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-card-header {
  background: #1f2937 !important;
  border-color: rgba(148, 163, 184, 0.14) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .lms-syllabus-card .text-dark,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .lms-player-card .text-dark,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .lms-overview-card .text-dark {
  color: #f8fafc !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .lms-syllabus-card .text-muted,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .lms-player-card .text-muted,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .lms-overview-card .text-muted {
  color: #9fb0c7 !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-summary-chip,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-count-pill,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .active-mini-badge {
  background: rgba(255, 255, 255, 0.08) !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-overview-wrap {
  background: #111827 !important;
  border-color: rgba(148, 163, 184, 0.14) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-overview-btn {
  background: rgba(255, 255, 255, 0.045) !important;
  border-color: rgba(148, 163, 184, 0.14) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-overview-btn.is-active {
  background: rgba(59, 130, 246, 0.16) !important;
  border-color: rgba(96, 165, 250, 0.45) !important;
  box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.2), 0 14px 28px rgba(0, 0, 0, 0.22);
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-overview-btn .bg-white,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-action-dot.bg-white,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-action-dot.bg-light {
  background: rgba(15, 23, 42, 0.78) !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-overview-btn .text-dark {
  color: #f8fafc !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-section-header {
  background: #151d2b !important;
  border-color: rgba(148, 163, 184, 0.14) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-section-icon.bg-primary,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-section-icon.bg-success {
  background-color: rgba(59, 130, 246, 0.14) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-section-icon.text-success {
  color: #4ade80 !important;
  background-color: rgba(34, 197, 94, 0.14) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-item-enhanced {
  background: #0f1729 !important;
  border-color: rgba(148, 163, 184, 0.12) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-item-enhanced:hover {
  background: #141e31 !important;
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.28);
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-item-enhanced.active-syllabus-materi {
  background: rgba(37, 99, 235, 0.18) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-item-enhanced.active-syllabus-kuis {
  background: rgba(34, 197, 94, 0.14) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-step-icon,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-step-icon.is-active,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-quiz-badge.bg-success {
  background: rgba(255, 255, 255, 0.08) !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-quiz-badge.bg-success.text-white {
  background: #22c55e !important;
  color: #052e16 !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .syllabus-empty-state {
  background: #0f1729 !important;
  border-color: rgba(148, 163, 184, 0.12) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .lms-player-card,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .lms-overview-card {
  background: #111827 !important;
  border: 1px solid rgba(148, 163, 184, 0.14) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .quiz-header {
  background: #0f1729 !important;
  border-color: rgba(34, 197, 94, 0.28) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .quiz-header .badge,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .player-text-header,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .attachment-card {
  background: rgba(255, 255, 255, 0.08) !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
  color: #f8fafc !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .lms-player-card .card-body,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .lms-overview-card .card-body,
:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .quiz-soal-card .card-body {
  background: #111827 !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .quiz-soal-card {
  background: #111827 !important;
  border-color: rgba(226, 232, 240, 0.72) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .quiz-soal-card .card-header {
  background: #1f2937 !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .quiz-opsi-item {
  background: #1f2937 !important;
  border-color: rgba(226, 232, 240, 0.65) !important;
  color: #f8fafc !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .quiz-opsi-item:hover:not(.correct-opsi) {
  background: #263244 !important;
  border-color: rgba(96, 165, 250, 0.75) !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .correct-opsi {
  background: rgba(34, 197, 94, 0.16) !important;
  border-color: #22c55e !important;
  color: #dcfce7 !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .correct-opsi .text-success-emphasis {
  color: #dcfce7 !important;
}

:global(html[data-theme-mode="dark"]) .lms-kelas-detail-page .correct-badge {
  background: #052e16;
}

.quiz-soal-card {
  border: 1px solid #dee2e6 !important;
}

.quiz-opsi-item {
  transition: all 0.2s ease;
  border-width: 1px !important;
  border-color: #d1d5db !important; /* Darker border for visibility */
}

.quiz-opsi-item:hover:not(.correct-opsi) {
  border-color: var(--primary-color) !important;
  background-color: #f8f9fa !important;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.is-lms-dark .quiz-opsi-item:not(.correct-opsi) {
  background: #1f2937 !important;
  border-color: rgba(226, 232, 240, 0.65) !important;
  color: #f8fafc !important;
}

.is-lms-dark .quiz-opsi-item:hover:not(.correct-opsi) {
  background: #263244 !important;
  border-color: rgba(96, 165, 250, 0.78) !important;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.24);
}

.is-lms-dark .quiz-opsi-item:hover:not(.correct-opsi) .opsi-label {
  background: rgba(15, 23, 42, 0.86) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: #cbd5e1 !important;
}

.correct-opsi {
  background: rgba(var(--success-rgb), 0.08) !important;
  border-color: #198754 !important; /* Solid success color */
  border-width: 2px !important;
  box-shadow: 0 4px 15px rgba(var(--success-rgb), 0.2);
}

.soal-number-badge {
  background: linear-gradient(135deg, var(--primary-color), #2563eb) !important;
}

.correct-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
}

@media (max-width: 1199.98px) {
  .lms-learning-content {
    scroll-margin-top: 84px;
  }

  .lms-syllabus-card.sticky-top {
    position: static !important;
    top: auto !important;
  }

  .lms-syllabus-card > .card-body {
    max-height: none !important;
    overflow: visible !important;
  }

  .lms-syllabus-card {
    margin-bottom: 1rem;
  }
}

@media (max-width: 767.98px) {
  .lms-preview-hero {
    border-radius: 18px !important;
  }

  .lms-preview-hero-content {
    align-items: stretch !important;
    gap: 1rem !important;
  }

  .hero-thumbnail-wrap,
  .hero-icon-placeholder {
    width: 100% !important;
    max-width: none;
  }

  .hero-thumbnail-wrap {
    height: auto !important;
    aspect-ratio: 16 / 9;
  }

  .hero-icon-placeholder {
    height: 96px !important;
  }

  .hero-title {
    font-size: 1.35rem !important;
    line-height: 1.25;
  }

  .hero-subtitle {
    white-space: normal;
    -webkit-line-clamp: 2;
    display: -webkit-box;
    -webkit-box-orient: vertical;
  }

  .hero-stats-stack {
    display: grid !important;
    grid-template-columns: 1fr;
    gap: 0.75rem !important;
  }

  .hero-stat-item {
    align-items: flex-start !important;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    padding: 0.75rem;
    width: 100%;
  }

  .hero-actions,
  .hero-back-btn {
    width: 100%;
  }

  .hero-back-btn {
    justify-content: center;
    min-height: 42px;
  }

  .syllabus-card-header .d-flex,
  .syllabus-overview-btn,
  .syllabus-item-enhanced {
    align-items: flex-start !important;
  }

  .syllabus-item-enhanced {
    gap: 0.75rem !important;
    min-height: 0;
  }

  .syllabus-action-dot {
    display: none;
  }

  .player-text-header .d-flex {
    align-items: flex-start !important;
    gap: 0.85rem !important;
  }

  .player-text-header h3,
  .quiz-header h2,
  .lms-overview-card h2 {
    font-size: 1.25rem;
    line-height: 1.3;
  }

  .quiz-header {
    padding: 1.25rem !important;
  }

  .quiz-header .badge {
    width: 100%;
    justify-content: center;
    padding-inline: 0.85rem !important;
    white-space: normal;
  }

  .quiz-soal-card .card-header .d-flex {
    align-items: flex-start !important;
  }

  .quiz-opsi-item {
    align-items: flex-start !important;
  }

  .attachment-card .card-body {
    align-items: flex-start !important;
  }
}

@media (max-width: 420px) {
  .lms-kelas-detail-page {
    margin-inline: -0.25rem;
  }

  .lms-syllabus-card,
  .lms-player-card,
  .lms-overview-card {
    border-radius: 14px !important;
  }

  .syllabus-summary-chip {
    width: 100%;
    justify-content: center;
  }

  .syllabus-overview-btn,
  .syllabus-item-enhanced {
    padding: 0.85rem !important;
  }

  .player-text-header .avatar {
    width: 42px;
    height: 42px;
  }

  .materi-html-content,
  .course-description-content,
  .soal-text,
  .quiz-opsi-item span {
    font-size: 0.9rem !important;
  }
}
</style>

