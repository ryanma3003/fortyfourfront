<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import LmsEditor from "./LmsEditor.vue";
import { useLmsStore } from "../../stores/lms";
import { lmsService } from "../../services/lms.service";
import { useRouter, useRoute } from "vue-router";

export default {
  components: { Pageheader, LmsEditor },
  setup() {
    const lmsStore = useLmsStore();
    const router = useRouter();
    const route = useRoute();

    const isEdit = computed(() => !!route.params.id);
    const pageTitle = computed(() => (isEdit.value ? "Edit Materi" : "Tambah Materi"));
    const kelasId = computed(() => (route.query.kelasId as string) || history.state?.kelasId || '');

    const dataToPass = computed(() => ({
      title: { label: "Daftar Kelas", path: `/lms/kelas` },
      currentpage: pageTitle.value,
      activepage: pageTitle.value,
    }));

    // Form state
    const selectedKelas = ref<string | number>("");
    const judul = ref("");
    const kategori = ref("Cybersecurity");
    const tipe = ref("teks");
    const deskripsi = ref("");
    const konten = ref("");
    const url_video = ref("");
    const formErrors = ref<Record<string, string>>({});
    const isSaving = ref(false);

    // File pendukung
    const filePendukungList = ref<any[]>([]);
    const pendingFiles = ref<File[]>([]);
    const isUploadingFile = ref(false);

    // Toast
    const showToast = ref(false);
    const toastMessage = ref("");
    const toastType = ref<"success" | "error">("success");
    const showNotification = (msg: string, type: "success" | "error") => {
      toastMessage.value = msg;
      toastType.value = type;
      showToast.value = true;
      setTimeout(() => (showToast.value = false), 3000);
    };

    const kategoriOptions = [
      "Cybersecurity",
      "CSIRT",
      "Networking",
      "Compliance",
      "Risk Management",
      "Incident Response",
      "Lainnya",
    ];

    onMounted(async () => {
      // Use ensureKelas — skips API call if already loaded
      try {
        await lmsStore.ensureKelas();
      } catch (e: any) {
        console.error("Failed to load kelas:", e.message);
      }

      if (kelasId.value) {
        selectedKelas.value = kelasId.value;
      }

      if (isEdit.value) {
        // Try store first, then cache
        let materi = lmsStore.getMateriById(route.params.id as string);

        // If not in store, fetch the kelas detail to populate cache
        if (!materi && kelasId.value) {
          try {
            await lmsStore.fetchKelasDetail(kelasId.value);
            materi = lmsStore.getMateriById(route.params.id as string);
          } catch (e) {
            console.warn('Failed to fetch kelas detail for materi lookup');
          }
        }

        if (materi) {
          selectedKelas.value = materi.id_kelas || selectedKelas.value;
          judul.value = materi.judul;
          kategori.value = materi.kategori;
          tipe.value = materi.tipe || "teks";
          deskripsi.value = materi.deskripsi;
          konten.value = materi.konten_html || materi.konten || "";
          url_video.value = materi.url_video || "";
          filePendukungList.value = materi.file_pendukung || [];
        } else {
          showNotification("Materi tidak ditemukan", "error");
          router.push("/lms/kelas");
        }
      }
    });

    const validate = (): boolean => {
      formErrors.value = {};
      if (!selectedKelas.value) formErrors.value.selectedKelas = "Kelas wajib dipilih";
      if (!judul.value.trim()) formErrors.value.judul = "Judul wajib diisi";
      if (!kategori.value) formErrors.value.kategori = "Kategori wajib dipilih";
      if (!tipe.value) formErrors.value.tipe = "Tipe materi wajib dipilih";
      
      if (tipe.value === 'teks') {
        if (!konten.value.trim() || konten.value === "<p><br></p>") {
          formErrors.value.konten = "Konten materi wajib diisi untuk tipe teks";
        }
      } else if (tipe.value === 'video') {
         if (!url_video.value.trim()) {
            formErrors.value.url_video = "URL video wajib diisi untuk tipe video";
         }
      }
      return Object.keys(formErrors.value).length === 0;
    };

    const handleSubmit = async () => {
      if (!validate()) return;

      isSaving.value = true;
      try {
        const payload: any = {
            judul: judul.value,
            kategori: kategori.value,
            tipe: tipe.value,
            deskripsi: deskripsi.value,
            konten: konten.value,
            konten_html: konten.value,
            url_video: url_video.value,
        };

        if (isEdit.value) {
          await lmsStore.updateMateri(route.params.id as string, payload);
          showNotification("Materi berhasil diperbarui!", "success");
          
          // Upload pending files in edit mode
          if (pendingFiles.value.length > 0) {
            for (const file of pendingFiles.value) {
              try {
                await lmsStore.uploadFilePendukung(route.params.id as string, file);
              } catch (e: any) {
                console.error('Failed to upload file:', file.name, e);
              }
            }
          }
        } else {
          const kid = selectedKelas.value;
          if (!kid) {
            showNotification("Kelas wajib dipilih", "error");
            isSaving.value = false;
            return;
          }

          // Calculate next urutan to prevent "Duplicate entry" error
          try {
            const existingMateri = await lmsService.getMateriByKelas(String(kid));
            const maxUrutan = Array.isArray(existingMateri) && existingMateri.length > 0
              ? existingMateri.reduce((max: number, m: any) => Math.max(max, m.urutan || 0), 0)
              : 0;
            payload.urutan = maxUrutan + 1;
          } catch (e) {
            console.warn("Failed to calculate urutan, using timestamp fallback");
            payload.urutan = Date.now() % 10000; // Use unique timestamp-based fallback
          }

          const newMateri = await lmsStore.createMateri(kid, payload);

          // Upload pending files if any
          if (newMateri && newMateri.id && pendingFiles.value.length > 0) {
            for (const file of pendingFiles.value) {
              try {
                await lmsStore.uploadFilePendukung(newMateri.id, file);
              } catch (e: any) {
                console.error('Failed to upload file:', file.name, e);
              }
            }
          }

          showNotification("Materi berhasil ditambahkan!", "success");
        }

        setTimeout(() => router.push("/lms/kelas"), 600);
      } catch (e: any) {
        showNotification(e.message || "Gagal menyimpan materi", "error");
      } finally {
        isSaving.value = false;
      }
    };

    // File pendukung handlers
    const onFileSelect = (event: Event) => {
      const input = event.target as HTMLInputElement;
      if (input.files) {
        for (const file of Array.from(input.files)) {
          // Validate PDF only
          if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            showNotification(`File "${file.name}" ditolak. Hanya file PDF yang diperbolehkan.`, "error");
            continue;
          }
          pendingFiles.value.push(file);
        }
      }
      input.value = '';
    };

    const removePendingFile = (idx: number) => {
      pendingFiles.value.splice(idx, 1);
    };

    const uploadFile = async (file: File) => {
      if (!isEdit.value) return;

      // Validate PDF only
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        showNotification("Hanya file PDF yang diperbolehkan.", "error");
        return;
      }

      isUploadingFile.value = true;
      try {
        const result = await lmsStore.uploadFilePendukung(route.params.id as string, file);
        if (result) filePendukungList.value.push(result);
        showNotification("File PDF berhasil diupload!", "success");
      } catch (e: any) {
        showNotification(e.message || "Gagal mengupload file", "error");
      } finally {
        isUploadingFile.value = false;
      }
    };

    const deleteFile = async (fileId: string | number) => {
      try {
        await lmsStore.deleteFilePendukung(fileId, route.params.id as string);
        filePendukungList.value = filePendukungList.value.filter(f => String(f.id) !== String(fileId));
        showNotification("File berhasil dihapus!", "success");
      } catch (e: any) {
        showNotification(e.message || "Gagal menghapus file", "error");
      }
    };

    const goBack = () => router.push("/lms/kelas");

    return {
      dataToPass,
      isEdit,
      pageTitle,
      selectedKelas,
      lmsStore,
      judul,
      kategori,
      tipe,
      deskripsi,
      konten,
      url_video,
      formErrors,
      kategoriOptions,
      handleSubmit,
      goBack,
      showToast,
      toastMessage,
      toastType,
      isSaving,
      // File pendukung
      filePendukungList,
      pendingFiles,
      isUploadingFile,
      onFileSelect,
      removePendingFile,
      uploadFile,
      deleteFile,
    };
  },
};
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Toast -->
  <transition name="toast-slide">
    <div v-if="showToast" class="toast-wrapper position-fixed">
      <div class="toast-modern" :class="toastType === 'success' ? 'toast-success' : 'toast-error'" role="alert">
        <div class="toast-icon-wrap">
          <i :class="toastType === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'"></i>
        </div>
        <div class="toast-content">
          <span class="toast-title">{{ toastType === 'success' ? 'Berhasil' : 'Gagal' }}</span>
          <span class="toast-msg">{{ toastMessage }}</span>
        </div>
      </div>
    </div>
  </transition>

  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card gradient-header-card">
        <!-- Header -->
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3 stakeholder-header">
          <div class="d-flex align-items-center gap-3 header-inner">
            <button class="kse-back-btn" @click="goBack" title="Kembali">
              <i class="ri-arrow-left-line"></i>
            </button>
            <div class="header-icon-box">
              <i class="ri-file-edit-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">{{ pageTitle }}</div>
              <div class="header-subtitle mt-1">{{ isEdit ? 'Perbarui konten materi' : 'Buat materi pembelajaran baru' }}</div>
            </div>
          </div>
        </div>

        <div class="card-body p-4">
          <form @submit.prevent="handleSubmit">
            <div class="row g-4">
              <!-- Pilihan Kelas (BUAS) -->
              <div class="col-12">
                <div class="p-3 border rounded bg-light kse-kelas-selector" :class="{'border-danger': formErrors.selectedKelas}">
                  <label class="form-label fw-bold text-primary mb-2 d-flex align-items-center gap-2">
                    <i class="ri-graduation-cap-fill fs-18"></i> Pilih Kelas Pembelajaran <span class="text-danger">*</span>
                  </label>
                  <p class="text-muted fs-13 mb-3">Tentukan di kelas mana materi ini akan diterbitkan. Pastikan memilih kelas yang tepat.</p>
                  
                  <div class="position-relative">
                    <select
                      v-model="selectedKelas"
                      class="form-select form-select-lg shadow-sm kse-buas-select"
                      :class="{ 'is-invalid': formErrors.selectedKelas }"
                      style="border-radius: 8px; font-weight: 500;"
                    >
                      <option value="" disabled>-- Silakan Pilih Kelas --</option>
                      <option v-for="k in lmsStore.kelasList" :key="k.id" :value="k.id">
                        📝 {{ k.nama_kelas }}
                      </option>
                    </select>
                    <div v-if="formErrors.selectedKelas" class="invalid-feedback d-block fw-medium mt-2">
                      <i class="ri-error-warning-line me-1"></i> {{ formErrors.selectedKelas }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Judul -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Judul Materi <span class="text-danger">*</span></label>
                <input
                  v-model="judul"
                  type="text"
                  class="form-control kse-modal-input"
                  :class="{ 'is-invalid': formErrors.judul }"
                  placeholder="Masukkan judul materi..."
                />
                <div v-if="formErrors.judul" class="invalid-feedback">{{ formErrors.judul }}</div>
              </div>

              <!-- Kategori -->
              <div class="col-md-3">
                <label class="form-label fw-semibold">Kategori <span class="text-danger">*</span></label>
                <select
                  v-model="kategori"
                  class="form-select kse-modal-input"
                  :class="{ 'is-invalid': formErrors.kategori }"
                >
                  <option v-for="kat in kategoriOptions" :key="kat" :value="kat">{{ kat }}</option>
                </select>
                <div v-if="formErrors.kategori" class="invalid-feedback">{{ formErrors.kategori }}</div>
              </div>

              <!-- Tipe -->
              <div class="col-md-3">
                <label class="form-label fw-semibold">Tipe Materi <span class="text-danger">*</span></label>
                <select
                  v-model="tipe"
                  class="form-select kse-modal-input"
                  :class="{ 'is-invalid': formErrors.tipe }"
                >
                  <option value="teks">Teks</option>
                  <option value="video">Video</option>
                </select>
                <div v-if="formErrors.tipe" class="invalid-feedback">{{ formErrors.tipe }}</div>
              </div>

              <!-- Deskripsi -->
              <div class="col-12">
                <label class="form-label fw-semibold">Deskripsi Singkat</label>
                <textarea
                  v-model="deskripsi"
                  class="form-control kse-modal-input"
                  rows="2"
                  placeholder="Deskripsi singkat tentang materi ini..."
                ></textarea>
              </div>

              <!-- URL Video (Conditional) -->
              <div v-show="tipe === 'video'" class="col-12">
                <label class="form-label fw-semibold">URL Video <span class="text-danger">*</span></label>
                <input
                  v-model="url_video"
                  type="text"
                  class="form-control kse-modal-input"
                  :class="{ 'is-invalid': formErrors.url_video }"
                  placeholder="Contoh: https://youtube.com/watch?v=..."
                />
                <div v-if="formErrors.url_video" class="invalid-feedback">{{ formErrors.url_video }}</div>
              </div>

              <!-- WYSIWYG Editor (Conditional) -->
              <div v-show="tipe === 'teks'" class="col-12">
                <label class="form-label fw-semibold">Konten Materi <span class="text-danger">*</span></label>
                <LmsEditor
                  v-model="konten"
                  variant="full"
                  :min-height="360"
                  :has-error="!!formErrors.konten"
                  placeholder="Tulis konten materi di sini... Gunakan heading, list, blockquote, code block, gambar, video, dan lainnya."
                />
                <div v-if="formErrors.konten" class="text-danger fs-12 mt-1">{{ formErrors.konten }}</div>
              </div>

              <!-- File Pendukung -->
              <div class="col-12">
                <label class="form-label fw-semibold">
                  <i class="ri-attachment-2 me-1"></i>File Pendukung
                </label>

                <!-- Existing files (edit mode) -->
                <div v-if="filePendukungList.length > 0" class="mb-3">
                  <div v-for="file in filePendukungList" :key="file.id" class="d-flex align-items-center gap-2 mb-2 p-2 border rounded">
                    <i class="ri-file-line fs-16 text-primary"></i>
                    <span class="flex-grow-1 fs-13">{{ file.nama_file }}</span>
                    <span v-if="file.ukuran" class="text-muted fs-12">{{ (file.ukuran / 1024).toFixed(1) }} KB</span>
                    <button type="button" class="btn btn-sm btn-outline-danger" @click="deleteFile(file.id)" title="Hapus">
                      <i class="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </div>

                <!-- Pending files (create mode) -->
                <div v-if="pendingFiles.length > 0" class="mb-3">
                  <div v-for="(file, idx) in pendingFiles" :key="idx" class="d-flex align-items-center gap-2 mb-2 p-2 border rounded bg-light">
                    <i class="ri-file-upload-line fs-16 text-warning"></i>
                    <span class="flex-grow-1 fs-13">{{ file.name }}</span>
                    <span class="text-muted fs-12">{{ (file.size / 1024).toFixed(1) }} KB</span>
                    <button type="button" class="btn btn-sm btn-outline-danger" @click="removePendingFile(idx)" title="Batal">
                      <i class="ri-close-line"></i>
                    </button>
                  </div>
                </div>

                <div class="d-flex gap-2">
                  <label class="btn btn-sm btn-outline-primary d-flex align-items-center gap-1" style="cursor:pointer;">
                    <i class="ri-file-pdf-line"></i>
                    <span>Pilih File PDF</span>
                    <input type="file" multiple accept="application/pdf" class="d-none" @change="onFileSelect" />
                  </label>
                </div>
              </div>

              <!-- Actions -->
              <div class="col-12">
                <div class="d-flex justify-content-end gap-3 pt-3 border-top">
                  <button type="button" class="btn btn-light px-4" @click="goBack">
                    <i class="ri-close-line me-1"></i>Batal
                  </button>
                  <button type="submit" class="btn btn-primary px-4 d-flex align-items-center gap-2" :disabled="isSaving">
                    <span v-if="isSaving" class="spinner-border spinner-border-sm"></span>
                    <i v-else :class="isEdit ? 'ri-save-line' : 'ri-add-circle-line'"></i>
                    <span>{{ isEdit ? 'Simpan Perubahan' : 'Tambah Materi' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

