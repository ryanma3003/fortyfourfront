<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useLmsStore } from "../../stores/lms";
import { useRouter, useRoute } from "vue-router";

export default {
  components: { Pageheader },
  setup() {
    const lmsStore = useLmsStore();
    const router = useRouter();
    const route = useRoute();

    const isEdit = computed(() => !!route.params.id);
    const pageTitle = computed(() => (isEdit.value ? "Edit Kelas" : "Tambah Kelas"));

    const dataToPass = computed(() => ({
      title: { label: "LMS", path: "/lms/kelas" },
      currentpage: pageTitle.value,
      activepage: pageTitle.value,
    }));

    // Form state
    const namaKelas = ref("");
    const deskripsi = ref("");
    const status = ref("published");
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

    onMounted(async () => {
      if (isEdit.value) {
        // Ensure kelas list is loaded
        if (lmsStore.kelasList.length === 0) {
          try {
            await lmsStore.fetchKelas();
          } catch (e: any) {
            // ignore
          }
        }
        const kelas = lmsStore.getKelasById(route.params.id as string);
        if (kelas) {
          namaKelas.value = kelas.nama_kelas;
          deskripsi.value = kelas.deskripsi;
          status.value = kelas.status || "published";
        } else {
          showNotification("Kelas tidak ditemukan", "error");
          router.push("/lms/kelas");
        }
      }
    });

    const validate = (): boolean => {
      formErrors.value = {};
      if (!namaKelas.value.trim()) formErrors.value.nama_kelas = "Judul kelas wajib diisi";
      if (!deskripsi.value.trim()) formErrors.value.deskripsi = "Deskripsi wajib diisi";
      return Object.keys(formErrors.value).length === 0;
    };

    const handleSubmit = async () => {
      if (!validate()) return;

      isSaving.value = true;
      try {
        if (isEdit.value) {
          await lmsStore.updateKelas(route.params.id as string, {
            nama_kelas: namaKelas.value,
            deskripsi: deskripsi.value,
            status: status.value,
          });
          showNotification("Kelas berhasil diperbarui!", "success");
        } else {
          await lmsStore.createKelas({
            nama_kelas: namaKelas.value,
            deskripsi: deskripsi.value,
            status: status.value,
          });
          showNotification("Kelas berhasil ditambahkan!", "success");
        }

        setTimeout(() => router.push("/lms/kelas"), 600);
      } catch (e: any) {
        showNotification(e.message || "Gagal menyimpan kelas", "error");
      } finally {
        isSaving.value = false;
      }
    };

    const goBack = () => router.push("/lms/kelas");

    return {
      dataToPass,
      isEdit,
      pageTitle,
      namaKelas,
      deskripsi,
      status,
      formErrors,
      handleSubmit,
      goBack,
      showToast,
      toastMessage,
      toastType,
      isSaving,
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
              <i class="ri-graduation-cap-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">{{ pageTitle }}</div>
              <div class="header-subtitle mt-1">{{ isEdit ? 'Perbarui informasi kelas' : 'Buat kelas pembelajaran baru' }}</div>
            </div>
          </div>
        </div>

        <div class="card-body p-4">
          <form @submit.prevent="handleSubmit">
            <div class="row g-4">
              <!-- Judul Kelas -->
              <div class="col-md-8">
                <label class="form-label fw-semibold">Judul Kelas <span class="text-danger">*</span></label>
                <input
                  v-model="namaKelas"
                  type="text"
                  class="form-control kse-modal-input"
                  :class="{ 'is-invalid': formErrors.nama_kelas }"
                  placeholder="Masukkan judul kelas..."
                />
                <div v-if="formErrors.nama_kelas" class="invalid-feedback">{{ formErrors.nama_kelas }}</div>
              </div>

              <div class="col-md-4">
                <label class="form-label fw-semibold">Status</label>
                <select v-model="status" class="form-select kse-modal-input">
                  <option value="published">Publish</option>
                  <option value="draft">Draft</option>
                </select>
              </div>

              <!-- Deskripsi -->
              <div class="col-12">
                <label class="form-label fw-semibold">Deskripsi <span class="text-danger">*</span></label>
                <textarea
                  v-model="deskripsi"
                  class="form-control kse-modal-input"
                  :class="{ 'is-invalid': formErrors.deskripsi }"
                  rows="4"
                  placeholder="Deskripsi tentang kelas ini..."
                ></textarea>
                <div v-if="formErrors.deskripsi" class="invalid-feedback">{{ formErrors.deskripsi }}</div>
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
                    <span>{{ isEdit ? 'Simpan Perubahan' : 'Tambah Kelas' }}</span>
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
</style>
