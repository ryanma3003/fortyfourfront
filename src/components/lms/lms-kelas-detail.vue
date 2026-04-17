<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useLmsStore } from "../../stores/lms";
import { lmsService } from "../../services/lms.service";
import { useRoute, useRouter } from "vue-router";
import type { LmsKelas, LmsMateri, LmsKuis, LmsSoal } from "../../types/lms.types";

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

    const currentKelas = computed<LmsKelas | undefined>(() => 
      lmsStore.kelasList.find((k) => String(k.id) === kelasId.value)
    );

    const relatedMateri = computed<LmsMateri[]>(() => 
      lmsStore.materiList.filter((m) => String(m.id_kelas) === kelasId.value)
    );

    const relatedKuis = computed<LmsKuis[]>(() => 
      lmsStore.kuisList.filter((k) => String(k.id_kelas) === kelasId.value)
    );

    const dataToPass = computed(() => ({
      title: { label: "Daftar Kelas", path: "/lms/kelas" },
      currentpage: "Preview Kelas",
      activepage: "Preview",
    }));

    onMounted(async () => {
      loading.value = true;
      if (lmsStore.kelasList.length === 0) {
        await lmsStore.fetchKelas();
      }
      // Explicitly pass kelasId to ensure we get ONLY data for this class
      await Promise.all([
        lmsStore.fetchMateri(kelasId.value),
        lmsStore.fetchKuis(kelasId.value)
      ]);
      loading.value = false;
    });

    const getStatusVariant = (status: string | undefined) => {
      switch (status?.toLowerCase()) {
        case "published": return "success";
        case "draft": return "secondary";
        default: return "primary";
      }
    };

    const stripHtml = (html?: string) => {
      if (!html) return "-";
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || "";
    };

    const goBack = () => router.push('/lms/kelas');

    const viewMateri = (materi: LmsMateri) => {
      selectedMateri.value = materi;
      selectedKuis.value = null;
      setTimeout(() => {
        document.getElementById('detail-preview-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    };

    const viewKuis = async (kuis: LmsKuis) => {
      selectedKuis.value = kuis;
      selectedMateri.value = null;
      loadingSoal.value = true;
      try {
        relatedSoal.value = await lmsService.getSoalByKuis(kuis.id);
      } catch (e) {
        relatedSoal.value = [];
      } finally {
        loadingSoal.value = false;
      }
      setTimeout(() => {
        document.getElementById('detail-preview-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    };

    const closePreview = () => {
      selectedMateri.value = null;
      selectedKuis.value = null;
      relatedSoal.value = [];
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const getYoutubeId = (url?: string) => {
      if (!url) return null;
      const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
      return match ? match[1] : url; // fallback to raw string if it's already an ID
    };

    return {
      loading,
      currentKelas,
      relatedMateri,
      relatedKuis,
      dataToPass,
      getStatusVariant,
      stripHtml,
      goBack,
      selectedMateri,
      selectedKuis,
      relatedSoal,
      loadingSoal,
      viewMateri,
      viewKuis,
      closePreview,
      getYoutubeId
    };
  },
};
</script>

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
        <!-- Header Info Card -->
        <div class="card custom-card overflow-hidden shadow-sm">
          <div class="card-body p-0">
            <div class="bg-primary-transparent p-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div class="d-flex gap-4 align-items-center">
                <div class="avatar avatar-xxl bg-white rounded-3 border border-primary border-opacity-10 shadow-sm" style="width: 100px; height: 100px; flex-shrink: 0;">
                  <img v-if="currentKelas.thumbnail" :src="currentKelas.thumbnail" alt="Thumbnail" class="w-100 h-100 object-fit-cover rounded-3">
                  <i v-else class="ri-book-3-line fs-1 text-primary"></i>
                </div>
                <div>
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <span :class="`badge bg-${getStatusVariant(currentKelas.status)}-transparent rounded-pill px-3`">
                      {{ currentKelas.status || "Unknown" }}
                    </span>
                    <span class="text-muted fs-12"><i class="ri-calendar-line me-1"></i>{{ currentKelas.created_at?.split('T')[0] || '-' }}</span>
                  </div>
                  <h4 class="fw-bold mb-1" style="letter-spacing: -0.5px;">{{ currentKelas.nama_kelas }}</h4>
                  <p class="text-muted mb-0 fs-14 opacity-75">{{ currentKelas.judul || "Pengantar Pembelajaran" }}</p>
                </div>
              </div>
              <button @click="goBack" class="btn btn-primary-light btn-wave rounded-pill px-4">
                <i class="ri-arrow-left-line me-1"></i> Kembali ke Daftar
              </button>
            </div>
            <div class="p-4 border-top">
              <h6 class="fw-semibold mb-2 fs-15"><i class="ri-information-line me-2 text-primary"></i>Deskripsi Kelas</h6>
              <div class="text-muted fs-14 leading-relaxed" v-html="currentKelas.deskripsi || 'Tidak ada deskripsi tersedia.'"></div>
            </div>
          </div>
        </div>

        <div class="row">
          <!-- Left Column: Lists -->
          <div :class="selectedMateri || selectedKuis ? 'col-xl-4' : 'col-xl-6'">
            <div class="card custom-card">
              <div class="card-header d-flex justify-content-between align-items-center py-3">
                <div class="card-title fs-14 fw-bold mb-0">
                  <i class="ri-book-open-line text-info me-2"></i> Daftar Materi
                </div>
                <span class="badge bg-info-transparent rounded-pill">{{ relatedMateri.length }} Materi</span>
              </div>
              <div class="card-body p-0 overflow-auto" style="max-height: 500px;">
                <div class="list-group list-group-flush" v-if="relatedMateri.length > 0">
                  <div v-for="(materi, index) in relatedMateri" :key="materi.id" 
                    @click="viewMateri(materi)"
                    class="list-group-item list-group-item-action d-flex align-items-start gap-3 p-3 border-start-3"
                    :class="selectedMateri?.id === materi.id ? 'active-item' : ''">
                    <div class="avatar avatar-sm rounded-circle flex-shrink-0" :class="materi.tipe === 'video' ? 'bg-danger-transparent' : 'bg-info-transparent'">
                      <i :class="materi.tipe === 'video' ? 'ri-play-circle-line' : 'ri-file-text-line'"></i>
                    </div>
                    <div class="flex-grow-1 overflow-hidden">
                      <div class="d-flex justify-content-between align-items-center mb-1">
                        <h6 class="mb-0 fw-semibold fs-13 text-truncate">{{ materi.judul }}</h6>
                      </div>
                      <div class="d-flex align-items-center gap-2">
                         <span class="badge bg-light text-muted fs-10">{{ materi.kategori }}</span>
                         <span class="text-muted fs-11"><i class="ri-time-line me-1"></i>5-10 min</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="text-center p-5 text-muted">
                   <p class="mb-0 fs-13">Belum ada materi.</p>
                </div>
              </div>
            </div>

            <div class="card custom-card mt-4">
              <div class="card-header d-flex justify-content-between align-items-center py-3">
                <div class="card-title fs-14 fw-bold mb-0">
                  <i class="ri-questionnaire-line text-success me-2"></i> Daftar Kuis
                </div>
                <span class="badge bg-success-transparent rounded-pill">{{ relatedKuis.length }} Kuis</span>
              </div>
              <div class="card-body p-0 overflow-auto" style="max-height: 500px;">
                <div class="list-group list-group-flush" v-if="relatedKuis.length > 0">
                  <div v-for="(kuis, index) in relatedKuis" :key="kuis.id" 
                    @click="viewKuis(kuis)"
                    class="list-group-item list-group-item-action d-flex align-items-start gap-3 p-3 border-start-3"
                    :class="selectedKuis?.id === kuis.id ? 'active-item' : ''">
                    <div class="avatar avatar-sm bg-success-transparent rounded flex-shrink-0 fw-bold fs-11">
                      Q{{ index + 1 }}
                    </div>
                    <div class="flex-grow-1">
                      <h6 class="mb-1 fw-semibold fs-13">{{ kuis.judul }}</h6>
                      <div class="d-flex gap-3 fs-11 text-muted">
                        <span><i class="ri-timer-line me-1"></i>{{ kuis.durasi || 0 }}m</span>
                        <span><i class="ri-list-check-2 me-1"></i>Kuis</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="text-center p-5 text-muted">
                   <p class="mb-0 fs-13">Belum ada kuis.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Detail View Area -->
          <div :id="'detail-preview-area'" :class="selectedMateri || selectedKuis ? 'col-xl-8' : 'col-xl-6'">
            <div v-if="selectedMateri" class="card custom-card sticky-top border-primary-light shadow-sm" style="top: 80px; z-index: 100;">
              <div class="card-header d-flex justify-content-between align-items-center bg-info-transparent py-3">
                <div class="card-title mb-0">
                  <span class="text-primary fw-bold">Materi Preview:</span> {{ selectedMateri.judul }}
                </div>
                <button @click="closePreview" class="btn btn-sm btn-icon btn-light rounded-circle shadow-sm">
                  <i class="ri-close-line"></i>
                </button>
              </div>
              <div class="card-body p-4">
                <!-- Video Player if Video -->
                <div v-if="selectedMateri.tipe === 'video'" class="mb-4">
                   <div class="ratio ratio-16x9 rounded-3 overflow-hidden shadow-sm bg-black">
                      <iframe 
                        v-if="getYoutubeId(selectedMateri.url_video)"
                        :src="`https://www.youtube.com/embed/${getYoutubeId(selectedMateri.url_video)}`" 
                        title="YouTube video player" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        allowfullscreen>
                      </iframe>
                      <div v-else class="d-flex align-items-center justify-content-center text-white flex-column">
                        <i class="ri-video-off-line fs-1 mb-2"></i>
                        <p>Video URL tidak valid.</p>
                      </div>
                   </div>
                </div>

                <div class="mb-4">
                  <h6 class="fw-bold mb-2 fs-15 text-primary">Tentang Materi Ini</h6>
                  <p class="text-muted fs-14">{{ stripHtml(selectedMateri.deskripsi) }}</p>
                </div>

                <div v-if="selectedMateri.konten" class="content-body border rounded-3 p-4 bg-light bg-opacity-50">
                   <h6 class="fw-bold mb-3 border-bottom pb-2">Isi Materi</h6>
                   <div class="materi-html-content fs-14" v-html="selectedMateri.konten"></div>
                </div>
              </div>
            </div>

            <div v-else-if="selectedKuis" class="card custom-card sticky-top border-success-light shadow-sm" style="top: 80px; z-index: 100;">
              <div class="card-header d-flex justify-content-between align-items-center bg-success-transparent py-3">
                <div class="card-title mb-0">
                  <span class="text-success fw-bold">Kuis Preview:</span> {{ selectedKuis.judul }}
                </div>
                <button @click="closePreview" class="btn btn-sm btn-icon btn-light rounded-circle shadow-sm">
                  <i class="ri-close-line"></i>
                </button>
              </div>
              <div class="card-body p-4">
                <div class="d-flex align-items-center gap-4 mb-4 p-3 bg-light rounded-3">
                   <div class="text-center">
                      <div class="fs-12 text-muted">Durasi</div>
                      <div class="fw-bold fs-16">{{ selectedKuis.durasi || 0 }} m</div>
                   </div>
                   <div class="border-end h-100 mx-2" style="width: 1px; height: 30px !important;"></div>
                   <div class="text-center">
                      <div class="fs-12 text-muted">Total Soal</div>
                      <div class="fw-bold fs-16">{{ relatedSoal.length }}</div>
                   </div>
                   <div class="ms-auto">
                      <span class="badge bg-success rounded-pill px-3 py-2">Preview Mode</span>
                   </div>
                </div>

                <div v-if="loadingSoal" class="text-center p-5">
                   <div class="spinner-border text-success" role="status"></div>
                   <p class="mt-2 text-muted">Memuat pertanyaan...</p>
                </div>
                <div v-else-if="relatedSoal.length > 0">
                   <h6 class="fw-bold mb-4 border-bottom pb-2">Daftar Pertanyaan</h6>
                   <div v-for="(soal, sIdx) in relatedSoal" :key="soal.id" class="soal-item mb-5">
                      <div class="d-flex gap-3 mb-3">
                         <span class="badge bg-success-transparent rounded-circle flex-shrink-0" style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">{{ sIdx + 1 }}</span>
                         <div class="fw-semibold fs-15 text-dark" v-html="soal.pertanyaan"></div>
                      </div>
                      <div class="row g-3 ms-4">
                         <div v-for="opsi in soal.opsi" :key="opsi.label" class="col-6">
                            <div class="p-2 border rounded-3 fs-13 d-flex align-items-center gap-2"
                               :class="opsi.text === soal.jawaban_benar || (soal.jawaban_benar === opsi.label && opsi.text) ? 'bg-success-transparent border-success fw-bold' : 'bg-white'">
                               <span class="fw-bold text-muted" style="min-width: 20px;">{{ opsi.label }}.</span>
                               <span>{{ opsi.text || '(Kosong)' }}</span>
                               <i v-if="opsi.text === soal.jawaban_benar || (soal.jawaban_benar === opsi.label && opsi.text)" class="ri-checkbox-circle-fill text-success ms-auto"></i>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
                <div v-else class="text-center p-5 bg-light rounded-3 border-dashed">
                   <i class="ri-question-mark fs-1 text-muted opacity-50 mb-2"></i>
                   <p class="text-muted mb-0">Belum ada pertanyaan di kuis ini.</p>
                </div>
              </div>
            </div>

            <div v-else class="card custom-card d-flex align-items-center justify-content-center p-5 bg-light bg-opacity-25 border-dashed" style="min-height: 400px;">
               <div class="text-center opacity-50">
                  <div class="avatar avatar-xxl bg-white rounded-circle shadow-sm mb-4 mx-auto border" style="width: 120px; height: 120px;">
                     <i class="ri-layout-right-2-line text-primary fs-1"></i>
                  </div>
                  <h5 class="fw-bold text-dark">Pilih Materi atau Kuis</h5>
                  <p class="text-muted px-5">Klik salah satu materi di kiri untuk melihat isi konten, atau pilih kuis untuk melihat daftar soal evaluasi.</p>
               </div>
            </div>
          </div>
        </div>

      </template>
      <div v-else class="card custom-card">
        <div class="card-body text-center p-5">
           <i class="ri-error-warning-line fs-1 text-danger mb-3 d-block"></i>
           <h5 class="fw-semibold">Kelas tidak ditemukan.</h5>
           <p class="text-muted">Kelas yang Anda cari mungkin sudah dihapus atau ID tidak valid.</p>
           <button @click="goBack" class="btn btn-primary mt-2">Kembali ke Daftar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;  
  overflow: hidden;
}
.object-fit-cover {
  object-fit: cover;
}
.border-start-3 {
  border-left: 3px solid transparent;
}
.active-item {
  background-color: var(--primary-01) !important;
  border-left: 3px solid var(--primary-bg) !important;
  color: var(--primary-bg);
}
.active-item h6 {
  color: var(--primary-bg) !important;
}
.materi-html-content :deep(p) {
  margin-bottom: 1rem;
}
.leading-relaxed {
  line-height: 1.6;
}
.border-dashed {
  border: 2px dashed #dee2e6 !important;
}
.materi-list-scroll {
  max-height: 500px;
  overflow-y: auto;
}
</style>
