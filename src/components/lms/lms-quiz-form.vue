<script lang="ts">
import { ref, computed, onMounted, reactive } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import LmsEditor from "./LmsEditor.vue";
import { useLmsStore, type QuizQuestion, type QuizOption } from "../../stores/lms";
import { useRouter, useRoute } from "vue-router";

export default {
  components: { Pageheader, LmsEditor },
  setup() {
    const lmsStore = useLmsStore();
    const router = useRouter();
    const route = useRoute();

    const isEdit = computed(() => !!route.params.id);
    const pageTitle = computed(() => (isEdit.value ? "Edit Quiz" : "Tambah Quiz"));

    const dataToPass = computed(() => ({
      title: { label: "LMS", path: "/lms/quiz" },
      currentpage: pageTitle.value,
      activepage: pageTitle.value,
    }));

    // Form state
    const judul = ref("");
    const deskripsi = ref("");
    const soalList = ref<QuizQuestion[]>([]);
    const formErrors = ref<Record<string, string>>({});

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

    const makeEmptyQuestion = (): QuizQuestion => ({
      id: uid(),
      pertanyaan: "",
      tipe: "pilihan_ganda",
      opsi: [
        { label: "A", text: "" },
        { label: "B", text: "" },
        { label: "C", text: "" },
        { label: "D", text: "" },
      ],
      jawabanBenar: "A",
    });

    onMounted(() => {
      if (isEdit.value) {
        const quiz = lmsStore.getQuizById(route.params.id as string);
        if (quiz) {
          judul.value = quiz.judul;
          deskripsi.value = quiz.deskripsi;
          soalList.value = JSON.parse(JSON.stringify(quiz.soalList));
        } else {
          showNotification("Quiz tidak ditemukan", "error");
          router.push("/lms/quiz");
        }
      }
    });

    const addQuestion = () => {
      soalList.value.push(makeEmptyQuestion());
    };

    const removeQuestion = (idx: number) => {
      soalList.value.splice(idx, 1);
    };

    const onTipeChange = (idx: number) => {
      const soal = soalList.value[idx];
      if (soal.tipe === "essay") {
        soal.opsi = [];
        soal.jawabanBenar = "";
      } else {
        soal.opsi = [
          { label: "A", text: "" },
          { label: "B", text: "" },
          { label: "C", text: "" },
          { label: "D", text: "" },
        ];
        soal.jawabanBenar = "A";
      }
    };

    const validate = (): boolean => {
      formErrors.value = {};
      if (!judul.value.trim()) formErrors.value.judul = "Judul quiz wajib diisi";
      if (soalList.value.length === 0)
        formErrors.value.soal = "Minimal harus ada 1 soal";

      for (let i = 0; i < soalList.value.length; i++) {
        const s = soalList.value[i];
        if (!s.pertanyaan.trim() || s.pertanyaan === "<p><br></p>") {
          formErrors.value[`soal_${i}`] = `Pertanyaan soal #${i + 1} wajib diisi`;
        }
        if (s.tipe === "pilihan_ganda") {
          const emptyOpts = s.opsi.filter((o) => !o.text.trim());
          if (emptyOpts.length > 0) {
            formErrors.value[`opsi_${i}`] = `Semua opsi soal #${i + 1} wajib diisi`;
          }
        }
      }

      return Object.keys(formErrors.value).length === 0;
    };

    const handleSubmit = () => {
      if (!validate()) return;

      if (isEdit.value) {
        lmsStore.updateQuiz(route.params.id as string, {
          judul: judul.value,
          deskripsi: deskripsi.value,
          soalList: soalList.value,
        });
        showNotification("Quiz berhasil diperbarui!", "success");
      } else {
        lmsStore.createQuiz({
          judul: judul.value,
          deskripsi: deskripsi.value,
          soalList: soalList.value,
        });
        showNotification("Quiz berhasil ditambahkan!", "success");
      }

      setTimeout(() => router.push("/lms/quiz"), 600);
    };

    const goBack = () => router.push("/lms/quiz");

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
      judul,
      deskripsi,
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
              <div class="header-subtitle mt-1">{{ isEdit ? 'Perbarui quiz dan soal' : 'Buat quiz baru dengan soal-soal' }}</div>
            </div>
          </div>
        </div>

        <div class="card-body p-4">
          <form @submit.prevent="handleSubmit">
            <div class="row g-4">
              <!-- Judul Quiz -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Judul Quiz <span class="text-danger">*</span></label>
                <input
                  v-model="judul"
                  type="text"
                  class="form-control kse-modal-input"
                  :class="{ 'is-invalid': formErrors.judul }"
                  placeholder="Masukkan judul quiz..."
                />
                <div v-if="formErrors.judul" class="invalid-feedback">{{ formErrors.judul }}</div>
              </div>

              <!-- Deskripsi -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Deskripsi</label>
                <input
                  v-model="deskripsi"
                  type="text"
                  class="form-control kse-modal-input"
                  placeholder="Deskripsi singkat quiz..."
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
                      <span class="badge rounded-pill px-3 fs-11" :class="soal.tipe === 'pilihan_ganda' ? 'bg-info-transparent' : 'bg-warning-transparent'">
                        {{ soal.tipe === 'pilihan_ganda' ? 'Pilihan Ganda' : 'Essay' }}
                      </span>
                      <i class="ri-arrow-down-s-line fs-18 text-muted transition-icon" :class="{ 'rotate-180': isExpanded(idx) }"></i>
                    </div>
                  </div>

                  <!-- Question Body (expandable) -->
                  <transition name="slide-down">
                    <div v-show="isExpanded(idx)" class="question-body">
                      <!-- Tipe Soal -->
                      <div class="row g-3 mb-3">
                        <div class="col-md-4">
                          <label class="form-label fw-semibold fs-13">Tipe Soal</label>
                          <select
                            v-model="soal.tipe"
                            class="form-select kse-modal-input"
                            @change="onTipeChange(idx)"
                          >
                            <option value="pilihan_ganda">Pilihan Ganda</option>
                            <option value="essay">Essay</option>
                          </select>
                        </div>
                        <div class="col-md-8 d-flex align-items-end">
                          <button type="button" class="btn btn-sm btn-outline-danger d-flex align-items-center gap-1" @click="removeQuestion(idx)">
                            <i class="ri-delete-bin-line"></i> Hapus Soal
                          </button>
                        </div>
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
                      <div v-if="soal.tipe === 'pilihan_ganda'">
                        <label class="form-label fw-semibold fs-13">Opsi Jawaban</label>
                        <div v-if="formErrors[`opsi_${idx}`]" class="text-danger fs-12 mb-2">{{ formErrors[`opsi_${idx}`] }}</div>
                        <div class="row g-2">
                          <div v-for="opsi in soal.opsi" :key="opsi.label" class="col-md-6">
                            <div class="input-group">
                              <span class="input-group-text option-label" :class="{ 'option-correct': soal.jawabanBenar === opsi.label }">
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
                              :class="soal.jawabanBenar === opsi.label ? 'btn-success' : 'btn-outline-secondary'"
                              @click="soal.jawabanBenar = opsi.label"
                            >
                              {{ opsi.label }}
                            </button>
                          </div>
                        </div>
                      </div>

                      <!-- Essay hint -->
                      <div v-else class="alert alert-info-transparent py-2 fs-13 mb-0">
                        <i class="ri-information-line me-1"></i>Soal essay tidak memerlukan opsi jawaban. Peserta akan menjawab dengan teks bebas.
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
                  <button type="submit" class="btn btn-primary px-4 d-flex align-items-center gap-2">
                    <i :class="isEdit ? 'ri-save-line' : 'ri-add-circle-line'"></i>
                    <span>{{ isEdit ? 'Simpan Perubahan' : 'Tambah Quiz' }}</span>
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
