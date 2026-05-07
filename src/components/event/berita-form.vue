<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import LmsEditor from "../lms/LmsEditor.vue";
import { useBeritaStore } from "../../stores/berita";
import { useAuthStore } from "../../stores/auth";
import { useUsersStore } from "../../stores/users";
import { useRouter, useRoute } from "vue-router";
import type { CreateBeritaPayload } from "../../types/berita.types";
import { isRichTextEmpty } from "../../utils/richText";

export default {
  components: { Pageheader, LmsEditor },
  setup() {
    const beritaStore = useBeritaStore();
    const authStore = useAuthStore();
    const usersStore = useUsersStore();
    const router = useRouter();
    const route = useRoute();

    const isEdit = computed(() => !!route.params.id);
    const pageTitle = computed(() => (isEdit.value ? "Edit Berita" : "Tambah Berita"));

    const dataToPass = computed(() => ({
      title: { label: "Event & Berita", path: "/event/berita" },
      currentpage: pageTitle.value,
      activepage: pageTitle.value,
    }));

    const formBerita = ref({
      judul: "",
      deskripsi: "",
      author_id: authStore.currentUser?.id || "",
    });

    const formErrors = ref<Record<string, string>>({});
    const isSaving = ref(false);
    const isLoading = ref(isEdit.value);
    const showToast = ref(false);
    const toastMessage = ref("");
    const toastType = ref<"success" | "error">("success");

    const showNotification = (msg: string, type: "success" | "error") => {
      toastMessage.value = msg;
      toastType.value = type;
      showToast.value = true;
      setTimeout(() => (showToast.value = false), 3000);
    };

    const authorDisplayName = computed(() => {
      const authorId = formBerita.value.author_id;
      const matchedUser = authorId ? usersStore.getUserById(authorId) : undefined;

      return (
        matchedUser?.display_name ||
        matchedUser?.name ||
        matchedUser?.username ||
        authStore.currentUser?.display_name ||
        authStore.currentUser?.name ||
        authStore.currentUser?.username ||
        "Admin"
      );
    });

    onMounted(async () => {
      await usersStore.initialize().catch(() => undefined);

      if (!formBerita.value.author_id && authStore.currentUser?.id) {
        formBerita.value.author_id = authStore.currentUser.id;
      }

      if (isEdit.value) {
        try {
          const item = await beritaStore.fetchBeritaById(Number(route.params.id));
          if (item) {
            formBerita.value = {
              judul: item.judul || "",
              deskripsi: item.deskripsi || "",
              author_id: item.author_id || authStore.currentUser?.id || "",
            };
          } else {
            showNotification("Berita tidak ditemukan", "error");
            router.push("/event/berita");
          }
        } catch {
          showNotification("Gagal memuat berita", "error");
          router.push("/event/berita");
        } finally {
          isLoading.value = false;
        }
      }
    });

    const validate = (): boolean => {
      formErrors.value = {};
      if (!formBerita.value.judul.trim()) formErrors.value.judul = "Judul wajib diisi";
      if (isRichTextEmpty(formBerita.value.deskripsi)) formErrors.value.deskripsi = "Deskripsi wajib diisi";
      if (!formBerita.value.author_id.trim()) formErrors.value.author_id = "Pembuat berita wajib tersedia";
      return Object.keys(formErrors.value).length === 0;
    };

    const handleSubmit = async () => {
      if (!validate()) return;

      isSaving.value = true;

      const payload: CreateBeritaPayload = {
        judul: formBerita.value.judul.trim(),
        deskripsi: formBerita.value.deskripsi.trim(),
        author_id: formBerita.value.author_id.trim(),
      };

      try {
        const result = isEdit.value
          ? await beritaStore.updateBerita(route.params.id as string, payload)
          : await beritaStore.createBerita(payload);

        if (result.success) {
          showNotification(isEdit.value ? "Berita berhasil diperbarui!" : "Berita berhasil ditambahkan!", "success");
          setTimeout(() => router.push("/event/berita"), 600);
        } else {
          showNotification(result.error || "Gagal menyimpan", "error");
        }
      } catch (e: any) {
        showNotification(e.message || "Gagal menyimpan", "error");
      } finally {
        isSaving.value = false;
      }
    };

    const goBack = () => router.push("/event/berita");

    return {
      dataToPass, isEdit, pageTitle, isLoading, formBerita, formErrors, authorDisplayName,
      handleSubmit, goBack, showToast, toastMessage, toastType, isSaving
    };
  },
};
</script>

<template>
  <Pageheader :propData="dataToPass" />

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
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3 stakeholder-header">
          <div class="d-flex align-items-center gap-3 header-inner">
            <button class="kse-back-btn" @click="goBack" title="Kembali">
              <i class="ri-arrow-left-line"></i>
            </button>
            <div class="header-icon-box">
              <i class="ri-newspaper-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">{{ pageTitle }}</div>
              <div class="header-subtitle mt-1">{{ isEdit ? 'Perbarui informasi berita' : 'Buat berita baru' }}</div>
            </div>
          </div>
        </div>

        <div class="card-body p-4">
          <div v-if="isLoading" class="text-center py-5">
            <span class="spinner-border spinner-border-sm text-primary"></span>
            <span class="ms-2">Memuat data...</span>
          </div>
          <form v-else @submit.prevent="handleSubmit">
            <div class="row g-4">
              <div class="col-md-12">
                <label class="form-label fw-semibold">Judul Berita <span class="text-danger">*</span></label>
                <input
                  v-model="formBerita.judul"
                  type="text"
                  class="form-control kse-modal-input"
                  :class="{ 'is-invalid': formErrors.judul }"
                  placeholder="Masukkan judul berita..."
                />
                <div v-if="formErrors.judul" class="invalid-feedback">{{ formErrors.judul }}</div>
              </div>

              <div class="col-md-12">
                <label class="form-label fw-semibold">Pembuat Berita</label>
                <div class="form-control kse-modal-input bg-light d-flex align-items-center gap-2">
                  <i class="ri-user-line text-primary"></i>
                  <span class="fw-medium">{{ authorDisplayName }}</span>
                </div>
                <div v-if="formErrors.author_id" class="text-danger fs-12 mt-1">{{ formErrors.author_id }}</div>
              </div>

              <div class="col-12">
                <label class="form-label fw-semibold">Deskripsi <span class="text-danger">*</span></label>
                <LmsEditor
                  v-model="formBerita.deskripsi"
                  variant="full"
                  :min-height="320"
                  :has-error="!!formErrors.deskripsi"
                  placeholder="Tulis isi berita di sini..."
                />
                <div v-if="formErrors.deskripsi" class="text-danger fs-12 mt-1">{{ formErrors.deskripsi }}</div>
              </div>

              <div class="col-12">
                <div class="d-flex justify-content-end gap-3 pt-3 border-top">
                  <button type="button" class="btn btn-light px-4" @click="goBack">
                    <i class="ri-close-line me-1"></i>Batal
                  </button>
                  <button type="submit" class="btn btn-primary px-4 d-flex align-items-center gap-2" :disabled="isSaving">
                    <span v-if="isSaving" class="spinner-border spinner-border-sm"></span>
                    <i v-else :class="isEdit ? 'ri-save-line' : 'ri-add-circle-line'"></i>
                    <span>{{ isEdit ? 'Simpan Perubahan' : 'Simpan' }}</span>
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
