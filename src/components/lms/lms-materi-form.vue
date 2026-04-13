<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import LmsEditor from "./LmsEditor.vue";
import { useLmsStore } from "../../stores/lms";
import { useRouter, useRoute } from "vue-router";

export default {
  components: { Pageheader, LmsEditor },
  setup() {
    const lmsStore = useLmsStore();
    const router = useRouter();
    const route = useRoute();

    const isEdit = computed(() => !!route.params.id);
    const pageTitle = computed(() => (isEdit.value ? "Edit Materi" : "Tambah Materi"));

    const dataToPass = computed(() => ({
      title: { label: "LMS", path: "/lms/materi" },
      currentpage: pageTitle.value,
      activepage: pageTitle.value,
    }));

    // Form state
    const judul = ref("");
    const kategori = ref("Cybersecurity");
    const deskripsi = ref("");
    const konten = ref("");
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

    const kategoriOptions = [
      "Cybersecurity",
      "CSIRT",
      "Networking",
      "Compliance",
      "Risk Management",
      "Incident Response",
      "Lainnya",
    ];

    onMounted(() => {
      if (isEdit.value) {
        const materi = lmsStore.getMateriById(route.params.id as string);
        if (materi) {
          judul.value = materi.judul;
          kategori.value = materi.kategori;
          deskripsi.value = materi.deskripsi;
          konten.value = materi.konten;
        } else {
          showNotification("Materi tidak ditemukan", "error");
          router.push("/lms/materi");
        }
      }
    });

    const validate = (): boolean => {
      formErrors.value = {};
      if (!judul.value.trim()) formErrors.value.judul = "Judul wajib diisi";
      if (!kategori.value) formErrors.value.kategori = "Kategori wajib dipilih";
      if (!konten.value.trim() || konten.value === "<p><br></p>")
        formErrors.value.konten = "Konten materi wajib diisi";
      return Object.keys(formErrors.value).length === 0;
    };

    const handleSubmit = () => {
      if (!validate()) return;

      if (isEdit.value) {
        lmsStore.updateMateri(route.params.id as string, {
          judul: judul.value,
          kategori: kategori.value,
          deskripsi: deskripsi.value,
          konten: konten.value,
        });
        showNotification("Materi berhasil diperbarui!", "success");
      } else {
        lmsStore.createMateri({
          judul: judul.value,
          kategori: kategori.value,
          deskripsi: deskripsi.value,
          konten: konten.value,
        });
        showNotification("Materi berhasil ditambahkan!", "success");
      }

      setTimeout(() => router.push("/lms/materi"), 600);
    };

    const goBack = () => router.push("/lms/materi");

    return {
      dataToPass,
      isEdit,
      pageTitle,
      judul,
      kategori,
      deskripsi,
      konten,
      formErrors,
      kategoriOptions,
      handleSubmit,
      goBack,
      showToast,
      toastMessage,
      toastType,
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
              <!-- Judul -->
              <div class="col-md-8">
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
              <div class="col-md-4">
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

              <!-- WYSIWYG Editor -->
              <div class="col-12">
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

              <!-- Actions -->
              <div class="col-12">
                <div class="d-flex justify-content-end gap-3 pt-3 border-top">
                  <button type="button" class="btn btn-light px-4" @click="goBack">
                    <i class="ri-close-line me-1"></i>Batal
                  </button>
                  <button type="submit" class="btn btn-primary px-4 d-flex align-items-center gap-2">
                    <i :class="isEdit ? 'ri-save-line' : 'ri-add-circle-line'"></i>
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

<style scoped>
/* All editor styling is inside LmsEditor.vue */
</style>
