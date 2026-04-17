<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import LmsEditor from "./LmsEditor.vue";
import { useLmsStore } from "../../stores/lms";
import type { LmsSoal, LmsSoalOpsi } from "../../types/lms.types";
import { useRouter, useRoute } from "vue-router";

export default {
  components: { Pageheader, LmsEditor },
  setup() {
    const lmsStore = useLmsStore();
    const router = useRouter();
    const route = useRoute();

    const isEdit = computed(() => !!route.params.id);
    const pageTitle = computed(() => (isEdit.value ? "Edit Kuis" : "Tambah Kuis"));
    const kelasId = computed(() => (route.query.kelasId as string) || history.state?.kelasId || '');

    const dataToPass = computed(() => ({
      title: { label: "Daftar Kuis", path: `/lms/quiz?kelasId=${kelasId.value}` },
      currentpage: pageTitle.value,
      activepage: pageTitle.value,
    }));

    const selectedKelas = ref<string | number>("");
    const selectedMateri = ref<string | number | null>(null);
    const availableMateri = ref<any[]>([]);
    const judul = ref("");
    const deskripsi = ref("");
    const tipeKuis = ref<string>("per_materi");
    const soalList = ref<any[]>([]);
    const formErrors = ref<Record<string, string>>({});
    const isSaving = ref(false);

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

    const uid = () =>
      crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);

    const makeEmptyQuestion = (): any => ({
      id: uid(),
      pertanyaan: "",
      tipe: "pilihan_ganda",
      opsi: [
        { label: "A", text: "" },
        { label: "B", text: "" },
        { label: "C", text: "" },
        { label: "D", text: "" },
      ],
      jawaban_benar: "A",
      _isNew: true, // flag for new questions not yet saved
    });

    const fetchMateriForKelas = async (kid: string) => {
      try {
        await lmsStore.fetchMateri(kid);
        availableMateri.value = lmsStore.materiList;
      } catch (e: any) {
        console.error("Failed to fetch materi for kelas");
      }
    };

    const onKelasChange = async () => {
      selectedMateri.value = null; // reset
      if (selectedKelas.value) {
        await fetchMateriForKelas(selectedKelas.value as string);
      } else {
        availableMateri.value = [];
      }
    };

    onMounted(async () => {
      try {
        await lmsStore.fetchKelas();
      } catch (e: any) {
        console.error("Failed to load kelas:", e.message);
      }

      if (kelasId.value) {
        selectedKelas.value = kelasId.value;
        await fetchMateriForKelas(kelasId.value as string);
      }

      if (isEdit.value) {
        const kuisId = route.params.id as string;
        const kuis = lmsStore.getKuisById(kuisId);
        if (kuis) {
          selectedKelas.value = kuis.id_kelas || selectedKelas.value;
          if (selectedKelas.value) {
            await fetchMateriForKelas(selectedKelas.value as string);
          }
          judul.value = kuis.judul;
          deskripsi.value = kuis.deskripsi;
          tipeKuis.value = kuis.tipe_kuis || 'per_materi';
          selectedMateri.value = kuis.id_materi || null;

          // Fetch soal from API
          try {
            await lmsStore.fetchSoal(kuisId);
            soalList.value = JSON.parse(JSON.stringify(lmsStore.soalList));
          } catch (e: any) {
            // Fallback: use inline soal if available
            soalList.value = JSON.parse(JSON.stringify(kuis.soal || []));
          }
        } else {
          showNotification("Kuis tidak ditemukan", "error");
          router.push("/lms/quiz");
        }
      }
    });

    const addQuestion = () => {
      soalList.value.push(makeEmptyQuestion());
    };

    const removeQuestion = async (idx: number) => {
      const soal = soalList.value[idx];
      // If it's an existing soal (has real id and not new), delete from API
      if (soal && !soal._isNew && soal.id) {
        try {
          await lmsStore.deleteSoal(soal.id);
          showNotification("Soal berhasil dihapus!", "success");
        } catch (e: any) {
          showNotification(e.message || "Gagal menghapus soal", "error");
          return;
        }
      }
      soalList.value.splice(idx, 1);
    };

    const onTipeChange = (idx: number) => {
      // Logic removed since it's always pilihan_ganda
    };

    const validate = (): boolean => {
      formErrors.value = {};
      if (!selectedKelas.value) formErrors.value.selectedKelas = "Kelas wajib dipilih";
      if (!judul.value.trim()) formErrors.value.judul = "Judul kuis wajib diisi";
      if (tipeKuis.value === 'per_materi' && !selectedMateri.value) {
        formErrors.value.selectedMateri = "Materi wajib dipilih untuk kuis per materi";
      }
      if (soalList.value.length === 0)
        formErrors.value.soal = "Minimal harus ada 1 soal";

      for (let i = 0; i < soalList.value.length; i++) {
        const s = soalList.value[i];
        if (!s.pertanyaan.trim() || s.pertanyaan === "<p><br></p>") {
          formErrors.value[`soal_${i}`] = `Pertanyaan soal #${i + 1} wajib diisi`;
        }
        if (s.tipe === "pilihan_ganda" || !s.tipe || s.tipe === 'essay') {
          // Fallback force
          s.tipe = "pilihan_ganda";
          const emptyOpts = (s.opsi || []).filter((o: any) => !o.text.trim());
          if (emptyOpts.length > 0) {
            formErrors.value[`opsi_${i}`] = `Semua opsi soal #${i + 1} wajib diisi`;
          }
        }
      }

      return Object.keys(formErrors.value).length === 0;
    };

    const handleSubmit = async () => {
      if (!validate()) return;

      isSaving.value = true;
      try {
        const kuisId = route.params.id as string;
        
        const kuisPayload = {
          judul: judul.value,
          deskripsi: deskripsi.value,
          tipe_kuis: tipeKuis.value,
          id_materi: tipeKuis.value === 'per_materi' ? selectedMateri.value : null,
        };

        if (isEdit.value) {
          // Update kuis data
          await lmsStore.updateKuis(kuisId, kuisPayload);

          // Process each soal: create new or update existing
          let questionOrder = 1;
          for (const soal of soalList.value) {
            const soalPayload = {
              pertanyaan: soal.pertanyaan,
              tipe: soal.tipe,
              opsi: soal.opsi,
              jawaban_benar: soal.jawaban_benar,
              urutan: questionOrder++,
            };

            if (soal._isNew) {
              await lmsStore.createSoal(kuisId, soalPayload);
            } else {
              await lmsStore.updateSoal(soal.id, soalPayload);
            }
          }

          showNotification("Kuis berhasil diperbarui!", "success");
        } else {
          const kid = selectedKelas.value;
          if (!kid) {
            showNotification("Kelas wajib dipilih", "error");
            isSaving.value = false;
            return;
          }

          // Create kuis
          const newKuis = await lmsStore.createKuis(kid, kuisPayload);

          // Add soal to the newly created kuis
          if (newKuis) {
            let questionOrder = 1;
            for (const soal of soalList.value) {
              await lmsStore.createSoal(newKuis.id, {
                pertanyaan: soal.pertanyaan,
                tipe: soal.tipe,
                opsi: soal.opsi,
                jawaban_benar: soal.jawaban_benar,
                urutan: questionOrder++,
              });
            }
          }

          showNotification("Kuis berhasil ditambahkan!", "success");
        }

        setTimeout(() => router.push({ path: "/lms/quiz", state: { kelasId: selectedKelas.value } }), 600);
      } catch (e: any) {
        showNotification(e.message || "Gagal menyimpan kuis", "error");
      } finally {
        isSaving.value = false;
      }
    };

    const goBack = () => router.push({ path: "/lms/quiz", state: { kelasId: selectedKelas.value || kelasId.value } });

    // Expand/collapse for questions
    const expandedQuestions = ref<Set<number>>(new Set());
    const toggleQuestion = (idx: number) => {
      if (expandedQuestions.value.has(idx)) {
        expandedQuestions.value.delete(idx);
      } else {
        expandedQuestions.value.add(idx);
      }
    };
    const isExpanded = (idx: number) => expandedQuestions.value.has(idx);

    return {
      dataToPass,
      isEdit,
      pageTitle,
      selectedKelas,
      selectedMateri,
      availableMateri,
      onKelasChange,
      lmsStore,
      judul,
      deskripsi,
      tipeKuis,
      soalList,
      formErrors,
      handleSubmit,
      goBack,
      addQuestion,
      removeQuestion,
      onTipeChange,
      showToast,
      toastMessage,
      toastType,
      isSaving,
      toggleQuestion,
      isExpanded,
      expandedQuestions,
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
              <i class="ri-questionnaire-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">{{ pageTitle }}</div>
              <div class="header-subtitle mt-1">{{ isEdit ? 'Perbarui kuis dan soal' : 'Buat kuis baru dengan soal-soal' }}</div>
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
                  <p class="text-muted fs-13 mb-3">Tentukan di kelas mana kuis ini akan ditempatkan.</p>
                  
                  <div class="position-relative">
                    <select
                      v-model="selectedKelas"
                      @change="onKelasChange"
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

              <!-- Pilihan Materi -->
              <div v-show="tipeKuis === 'per_materi'" class="col-12">
                <div class="p-3 border rounded bg-light kse-kelas-selector" :class="{'border-danger': formErrors.selectedMateri}">
                  <label class="form-label fw-bold text-info mb-2 d-flex align-items-center gap-2">
                    <i class="ri-book-open-fill fs-18"></i> Pilih Materi Pembelajaran <span class="text-danger">*</span>
                  </label>
                  <p class="text-muted fs-13 mb-3">Kuis 'per materi' wajib menetapkan modul materi spesifik.</p>
                  
                  <div class="position-relative">
                    <select
                      v-model="selectedMateri"
                      class="form-select shadow-sm"
                      :class="{ 'is-invalid': formErrors.selectedMateri }"
                      style="border-radius: 8px;"
                      :disabled="!selectedKelas"
                    >
                      <option :value="null" disabled>-- {{ selectedKelas ? 'Silakan Pilih Materi' : 'Pilih Kelas Terlebih Dahulu' }} --</option>
                      <option v-for="m in availableMateri" :key="m.id" :value="m.id">
                        📄 {{ m.judul }}
                      </option>
                    </select>
                    <div v-if="formErrors.selectedMateri" class="invalid-feedback d-block fw-medium mt-2">
                      <i class="ri-error-warning-line me-1"></i> {{ formErrors.selectedMateri }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Judul Kuis -->
              <div class="col-md-4">
                <label class="form-label fw-semibold">Judul Kuis <span class="text-danger">*</span></label>
                <input
                  v-model="judul"
                  type="text"
                  class="form-control kse-modal-input"
                  :class="{ 'is-invalid': formErrors.judul }"
                  placeholder="Masukkan judul kuis..."
                />
                <div v-if="formErrors.judul" class="invalid-feedback">{{ formErrors.judul }}</div>
              </div>

              <!-- Tipe Kuis -->
              <div class="col-md-3">
                <label class="form-label fw-semibold">Tipe Kuis</label>
                <select v-model="tipeKuis" class="form-select kse-modal-input">
                  <option value="per_materi">Per Materi</option>
                  <option value="final">Final</option>
                </select>
              </div>

              <!-- Deskripsi -->
              <div class="col-md-5">
                <label class="form-label fw-semibold">Deskripsi</label>
                <input
                  v-model="deskripsi"
                  type="text"
                  class="form-control kse-modal-input"
                  placeholder="Deskripsi singkat kuis..."
                />
              </div>

              <!-- Question Builder -->
              <div class="col-12">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <h6 class="fw-bold mb-0">
                    <i class="ri-list-ordered text-primary me-2"></i>Daftar Soal
                    <span class="badge bg-primary-transparent ms-2">{{ soalList.length }} soal</span>
                  </h6>
                  <button type="button" class="btn btn-sm btn-primary d-flex align-items-center gap-1" @click="addQuestion">
                    <i class="ri-add-line"></i> Tambah Soal
                  </button>
                </div>

                <div v-if="formErrors.soal" class="alert alert-danger py-2 fs-13">
                  <i class="ri-error-warning-line me-1"></i>{{ formErrors.soal }}
                </div>

                <!-- Question Cards -->
                <div v-for="(soal, idx) in soalList" :key="soal.id" class="question-card mb-3">
                  <!-- Question Header -->
                  <div class="question-header" @click="toggleQuestion(idx)">
                    <div class="d-flex align-items-center gap-3">
                      <div class="question-number">{{ idx + 1 }}</div>
                      <div class="flex-grow-1">
                        <div class="question-preview" v-if="soal.pertanyaan && soal.pertanyaan !== '<p><br></p>'" v-html="soal.pertanyaan"></div>
                        <span v-else class="text-muted fs-13 fst-italic">Belum ada pertanyaan...</span>
                      </div>
                      <span class="badge rounded-pill px-3 fs-11 bg-info-transparent">
                        Pilihan Ganda
                      </span>
                      <i class="ri-arrow-down-s-line fs-18 text-muted transition-icon" :class="{ 'rotate-180': isExpanded(idx) }"></i>
                    </div>
                  </div>

                  <!-- Question Body (expandable) -->
                  <transition name="slide-down">
                    <div v-show="isExpanded(idx)" class="question-body">
                      <!-- Soal Controls -->
                      <div class="d-flex justify-content-end mb-3">
                        <button type="button" class="btn btn-sm btn-outline-danger d-flex align-items-center gap-1" @click="removeQuestion(idx)">
                          <i class="ri-delete-bin-line"></i> Hapus Soal
                        </button>
                      </div>

                      <!-- Pertanyaan (WYSIWYG) -->
                      <div class="mb-3">
                        <label class="form-label fw-semibold fs-13">Pertanyaan <span class="text-danger">*</span></label>
                        <LmsEditor
                          v-model="soal.pertanyaan"
                          variant="compact"
                          :min-height="140"
                          :has-error="!!formErrors[`soal_${idx}`]"
                          placeholder="Tulis pertanyaan di sini..."
                        />
                        <div v-if="formErrors[`soal_${idx}`]" class="text-danger fs-12 mt-1">{{ formErrors[`soal_${idx}`] }}</div>
                      </div>

                      <!-- Opsi (Pilihan Ganda) -->
                      <div>
                        <label class="form-label fw-semibold fs-13">Opsi Jawaban</label>
                        <div v-if="formErrors[`opsi_${idx}`]" class="text-danger fs-12 mb-2">{{ formErrors[`opsi_${idx}`] }}</div>
                        <div class="row g-2">
                          <div v-for="opsi in soal.opsi" :key="opsi.label" class="col-md-6">
                            <div class="input-group">
                              <span class="input-group-text option-label" :class="{ 'option-correct': soal.jawaban_benar === opsi.label }">
                                {{ opsi.label }}
                              </span>
                              <input
                                v-model="opsi.text"
                                type="text"
                                class="form-control kse-modal-input"
                                :placeholder="`Opsi ${opsi.label}...`"
                                style="border-radius: 0 10px 10px 0 !important;"
                              />
                            </div>
                          </div>
                        </div>
                        <div class="mt-3">
                          <label class="form-label fw-semibold fs-13">Jawaban Benar</label>
                          <div class="d-flex gap-2">
                            <button
                              v-for="opsi in soal.opsi"
                              :key="opsi.label"
                              type="button"
                              class="btn btn-sm answer-btn"
                              :class="soal.jawaban_benar === opsi.label ? 'btn-success' : 'btn-outline-secondary'"
                              @click="soal.jawaban_benar = opsi.label"
                            >
                              {{ opsi.label }}
                            </button>
                          </div>
                        </div>
                      </div>
                      </div>
                  </transition>
                </div>

                <!-- Empty state for questions -->
                <div v-if="soalList.length === 0" class="text-center py-5">
                  <div class="empty-icon-ring mb-3" style="width:80px;height:80px;margin:0 auto;">
                    <div class="empty-icon-inner" style="width:56px;height:56px;">
                      <i class="ri-file-list-3-line" style="font-size:1.4rem;"></i>
                    </div>
                  </div>
                  <p class="text-muted fs-13 mb-3">Belum ada soal. Klik tombol di atas untuk menambah soal.</p>
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
                    <span>{{ isEdit ? 'Simpan Perubahan' : 'Tambah Kuis' }}</span>
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

<style scoped>
.question-card {
  border: 1.5px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.question-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 2px 12px rgba(37, 99, 235, 0.08);
}

.question-header {
  padding: 14px 18px;
  background: #f8fafc;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}
.question-header:hover {
  background: #eef3fb;
}

.question-number {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
  color: #fff;
  font-weight: 800;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
}

.question-preview {
  font-size: 13px;
  color: #475569;
  max-height: 22px;
  overflow: hidden;
  line-height: 1.4;
}
.question-preview :deep(p) {
  margin: 0;
}

.question-body {
  padding: 18px;
  border-top: 1px solid #e2e8f0;
  background: #fff;
}

.option-label {
  font-weight: 700;
  font-size: 14px;
  width: 42px;
  justify-content: center;
  border-radius: 10px 0 0 10px !important;
  border-color: #dde5f4 !important;
  background: #f1f5f9;
  color: #475569;
  transition: all 0.2s;
}
.option-correct {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
  color: #fff !important;
  border-color: #10b981 !important;
}

.answer-btn {
  width: 38px;
  height: 34px;
  border-radius: 10px !important;
  font-weight: 700;
  font-size: 13px;
}

.transition-icon {
  transition: transform 0.25s ease;
}
.rotate-180 {
  transform: rotate(180deg);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.25s ease;
  max-height: 2000px;
  overflow: hidden;
}
.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

/* Editor styling is inside LmsEditor.vue */

.alert-info-transparent {
  background: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.2);
  color: #0e7490;
  border-radius: 10px;
}
</style>
