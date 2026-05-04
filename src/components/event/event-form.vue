<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import LmsEditor from "../lms/LmsEditor.vue";
import { useEventStore } from "../../stores/event";
import { useRouter, useRoute } from "vue-router";
import type { CreateKegiatanPayload } from "../../types/kegiatan.types";

export default {
  components: { Pageheader, LmsEditor },
  setup() {
    const eventStore = useEventStore();
    const router = useRouter();
    const route = useRoute();

    const isEdit = computed(() => !!route.params.id);
    const pageTitle = computed(() => (isEdit.value ? "Edit Event" : "Tambah Event"));

    const dataToPass = computed(() => ({
      title: { label: "Event & Kegiatan", path: "/event" },
      currentpage: pageTitle.value,
      activepage: pageTitle.value,
    }));

    // Form state matching API payload
    const formEvent = ref({
      judul: "",
      deskripsi: "",
      lokasi: "",
      tanggal: "", // datetime-local input value
    });

    const formErrors = ref<Record<string, string>>({});
    const isSaving = ref(false);
    const isLoading = ref(isEdit.value);

    const isRichTextEmpty = (value: string): boolean => {
      const plainText = value
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim();
      return !plainText || value.trim() === "<p><br></p>";
    };

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

    /**
     * Convert an ISO 8601 date string to datetime-local input format
     * e.g. "2024-12-31T15:00:00Z" → "2024-12-31T22:00" (local)
     */
    const toDatetimeLocal = (isoStr: string): string => {
      if (!isoStr) return "";
      try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        // Format: YYYY-MM-DDTHH:MM
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      } catch {
        return isoStr;
      }
    };

    /**
     * Convert datetime-local value to ISO 8601 string for API
     * e.g. "2024-12-31T22:00" → "2024-12-31T15:00:00Z"
     */
    const toISOString = (localStr: string): string => {
      if (!localStr) return "";
      try {
        const d = new Date(localStr);
        if (isNaN(d.getTime())) return localStr;
        return d.toISOString();
      } catch {
        return localStr;
      }
    };

    onMounted(async () => {
      if (isEdit.value) {
        try {
          // Fetch event detail from API
          const ev = await eventStore.fetchEventById(Number(route.params.id));
          if (ev) {
            formEvent.value = {
              judul: ev.judul || "",
              deskripsi: ev.deskripsi || "",
              lokasi: ev.lokasi || "",
              tanggal: toDatetimeLocal(ev.tanggal),
            };
          } else {
            showNotification("Event tidak ditemukan", "error");
            router.push("/event");
          }
        } catch (e) {
           showNotification("Gagal memuat event", "error");
           router.push("/event");
        } finally {
          isLoading.value = false;
        }
      }
    });

    const validate = (): boolean => {
      formErrors.value = {};
      if (!formEvent.value.judul.trim()) formErrors.value.judul = "Judul wajib diisi";
      if (isRichTextEmpty(formEvent.value.deskripsi)) formErrors.value.deskripsi = "Deskripsi wajib diisi";
      if (!formEvent.value.lokasi.trim()) formErrors.value.lokasi = "Lokasi wajib diisi";
      if (!formEvent.value.tanggal) formErrors.value.tanggal = "Tanggal wajib diisi";
      return Object.keys(formErrors.value).length === 0;
    };

    const handleSubmit = async () => {
      if (!validate()) return;

      isSaving.value = true;

      const payload: CreateKegiatanPayload = {
        judul: formEvent.value.judul.trim(),
        deskripsi: formEvent.value.deskripsi.trim(),
        lokasi: formEvent.value.lokasi.trim(),
        tanggal: toISOString(formEvent.value.tanggal),
      };

      try {
        if (isEdit.value) {
          const result = await eventStore.updateEvent(route.params.id as string, payload);
          if (result.success) {
            showNotification("Event berhasil diperbarui!", "success");
            setTimeout(() => router.push("/event"), 600);
          } else {
            showNotification(result.error || "Gagal menyimpan", "error");
          }
        } else {
          const result = await eventStore.createEvent(payload);
          if (result.success) {
            showNotification("Event berhasil ditambahkan!", "success");
            setTimeout(() => router.push("/event"), 600);
          } else {
            showNotification(result.error || "Gagal menyimpan", "error");
          }
        }
      } catch (e: any) {
        showNotification(e.message || "Gagal menyimpan", "error");
      } finally {
        isSaving.value = false;
      }
    };

    const goBack = () => router.push("/event");

    return {
      dataToPass, isEdit, pageTitle, isLoading,
      formEvent, formErrors,
      handleSubmit, goBack,
      showToast, toastMessage, toastType, isSaving,
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
        <!-- Header -->
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3 stakeholder-header">
          <div class="d-flex align-items-center gap-3 header-inner">
            <button class="kse-back-btn" @click="goBack" title="Kembali">
              <i class="ri-arrow-left-line"></i>
            </button>
            <div class="header-icon-box">
              <i class="ri-calendar-event-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">{{ pageTitle }}</div>
              <div class="header-subtitle mt-1">{{ isEdit ? 'Perbarui informasi event' : 'Buat event / kegiatan baru' }}</div>
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
              
              <!-- Judul -->
              <div class="col-md-12">
                <label class="form-label fw-semibold">Judul Event <span class="text-danger">*</span></label>
                <input
                  v-model="formEvent.judul"
                  type="text"
                  class="form-control kse-modal-input"
                  :class="{ 'is-invalid': formErrors.judul }"
                  placeholder="Masukkan judul event..."
                />
                <div v-if="formErrors.judul" class="invalid-feedback">{{ formErrors.judul }}</div>
              </div>

              <!-- Lokasi -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Lokasi <span class="text-danger">*</span></label>
                <input
                  v-model="formEvent.lokasi"
                  type="text"
                  class="form-control kse-modal-input"
                  :class="{ 'is-invalid': formErrors.lokasi }"
                  placeholder="Contoh: Zoom, Jakarta Convention Center, dsb..."
                />
                <div v-if="formErrors.lokasi" class="invalid-feedback">{{ formErrors.lokasi }}</div>
              </div>

              <!-- Tanggal -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Tanggal & Waktu <span class="text-danger">*</span></label>
                <input
                  v-model="formEvent.tanggal"
                  type="datetime-local"
                  class="form-control kse-modal-input"
                  :class="{ 'is-invalid': formErrors.tanggal }"
                />
                <div v-if="formErrors.tanggal" class="invalid-feedback">{{ formErrors.tanggal }}</div>
              </div>

              <!-- Deskripsi -->
              <div class="col-12">
                <label class="form-label fw-semibold">Deskripsi <span class="text-danger">*</span></label>
                <LmsEditor
                  v-model="formEvent.deskripsi"
                  variant="full"
                  :min-height="320"
                  :has-error="!!formErrors.deskripsi"
                  placeholder="Tulis deskripsi detail event di sini... Gunakan heading, list, link, gambar, tabel, dan format teks lainnya."
                />
                <div v-if="formErrors.deskripsi" class="text-danger fs-12 mt-1">{{ formErrors.deskripsi }}</div>
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
